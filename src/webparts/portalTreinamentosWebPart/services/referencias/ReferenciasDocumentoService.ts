import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  IValorDocumento,
  codigoTipoDocumento,
  extrairReferencias
} from '../fluxo/valorDocumento';

import {
  escaparOData
} from '../fluxo/dataverse/esquemaFluxo';

import {
  TreinamentoDocumentoAdminService
} from '../TreinamentoDocumentoAdminService';

import {
  CONTROLE_DOCUMENTAL
} from '../../constants/controleDocumental';

// ============================================================
// REFERÊNCIAS ENTRE DOCUMENTOS (metadados "Documento referenciado")
//
// As referências ficam gravadas nos valores do fluxo de cada revisão
// (dgt_documentorevisao.dgt_estadofluxojson → valores). Daqui saem
// as duas direções:
//
//   Referencia        → documentos que ESTE documento cita
//   Referenciado por  → documentos que citam ESTE documento
//
// Vale, para cada documento e campo, a revisão MAIS RECENTE que tem o
// campo preenchido (se a revisão nova tirou a referência, ela some).
//
// VÍNCULO COM TREINAMENTOS (dgt_treinamentodocumento)
//
// Ao executar uma etapa, as referências que envolvem um treinamento
// (documento de controle TRN) viram vínculo treinamento × documento:
//
//   POP-001 referencia PRO-TRN-003  → treinamento TRN-003 ↔ POP-001
//   PRO-TRN-003 referencia POP-001  → treinamento TRN-003 ↔ POP-001
//
// O vínculo é o mesmo usado pelo retreinamento por revisão documental.
// Nada é apagado: tirar a referência NÃO desfaz o vínculo (pode ser
// desativado na Gestão de documentos).
// ============================================================

export interface IDocumentoResumoReferencia {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  status: string;
  areaNome: string;
  ativo: boolean;
}

export interface IReferenciaDocumento {
  documento: IDocumentoResumoReferencia;
  // Rótulo do metadado (ex.: "Documento Referenciado Filho").
  campo: string;
  // Revisão em que a referência foi feita.
  revisao: string;
  revisaoStatus: string;
}

export interface IReferenciasDocumento {
  referencia: IReferenciaDocumento[];
  referenciadoPor: IReferenciaDocumento[];
}

export interface IVinculosTreinamentoDocumento {
  // Documento comum: treinamentos ligados a ele.
  treinamentos: Array<{
    id: string;
    codigo: string;
    nome: string;
    obrigatorio: boolean;
    relacaoId: string;
    observacao: string;
    automatico: boolean;
  }>;
  // Documento de controle (TRN): o treinamento e os documentos ligados a ele.
  treinamentoDoControle?: { id: string; codigo: string; nome: string };
  documentosDoTreinamento: IDocumentoResumoReferencia[];
}

const guid = (
  valor: unknown
): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor).trim();
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(registro, `${campo}@OData.Community.Display.V1.FormattedValue`) ||
  texto(registro, campo);

// Aceita o código ("TRN") ou o rótulo completo ("TRN - Treinamento").
export const ehDocumentoControle = (
  tipo?: string
): boolean =>
  (tipo || '').trim().split(/[\s\-–—]+/)[0].toUpperCase() === CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO;

// ------------------------------------------------------------
// Cache curto dos documentos (2 minutos)
// ------------------------------------------------------------

let cacheDocumentos: { lidoEm: number; lista: Promise<IDocumentoResumoReferencia[]> } | undefined;

export const carregarDocumentos = (
  dataverse: DataverseService,
  forcar = false
): Promise<IDocumentoResumoReferencia[]> => {

  if (!forcar && cacheDocumentos && Date.now() - cacheDocumentos.lidoEm < 2 * 60 * 1000) {
    return cacheDocumentos.lista;
  }

  const lista =
    dataverse.getDocumentos()
      .then(registros =>
        registros.map(registro => ({
          id: guid(registro.dgt_documentoid),
          codigo: texto(registro, 'dgt_codigo'),
          titulo: texto(registro, 'dgt_titulo') || texto(registro, 'dgt_name'),
          // dgt_tipo é escolha: o código (POP, TRN...) vem do valor formatado.
          tipo: codigoTipoDocumento(registro),
          status: formatado(registro, 'dgt_status'),
          areaNome: formatado(registro, '_dgt_area_value'),
          ativo: registro.dgt_ativo !== false
        }))
      );

  lista.catch(() => { cacheDocumentos = undefined; });

  cacheDocumentos = { lidoEm: Date.now(), lista };
  return lista;
};

// Documento citado que não está mais na lista (inativo/excluído):
// mostra o que ficou gravado na referência.
const resumoDoValor = (
  valor: IValorDocumento,
  documentos: IDocumentoResumoReferencia[]
): IDocumentoResumoReferencia =>
  documentos.find(doc => doc.id === valor.id) || {
    id: valor.id,
    codigo: valor.codigo,
    titulo: valor.titulo,
    tipo: '',
    status: 'Não encontrado',
    areaNome: '',
    ativo: false
  };

// ------------------------------------------------------------
// Leitura das referências
// ------------------------------------------------------------

interface IReferenciaBruta {
  documentoId: string;
  chave: string;
  processoId: string;
  revisao: string;
  revisaoStatus: string;
  citados: IValorDocumento[];
}

const lerReferenciasBrutas = async (
  dataverse: DataverseService
): Promise<IReferenciaBruta[]> => {

  const revisoes =
    await dataverse.listarRegistros(
      'dgt_documentorevisao',
      '$select=dgt_documentorevisaoid,_dgt_documento_value,dgt_revisao,dgt_status,createdon,dgt_estadofluxojson' +
      '&$filter=dgt_estadofluxojson ne null' +
      '&$orderby=createdon desc'
    );

  // Mais recente primeiro: a 1ª ocorrência de (documento, campo) vale.
  const vistos: Record<string, boolean> = {};
  const resultado: IReferenciaBruta[] = [];

  revisoes.forEach(registro => {

    const json = texto(registro, 'dgt_estadofluxojson');

    // Atalho barato: sem "codigo" não há referência gravada.
    if (!json || json.indexOf('codigo') < 0) {
      return;
    }

    let estado: { valores?: Record<string, string>; processoId?: string } = {};

    try {
      estado = JSON.parse(json);
    } catch {
      return;
    }

    const documentoId = guid(registro._dgt_documento_value);
    const valores = estado.valores || {};

    Object.keys(valores).forEach(chave => {
      const marca = `${documentoId}|${chave}`;

      if (vistos[marca] || !(valores[chave] || '').trim()) {
        return;
      }

      const citados = extrairReferencias(valores[chave]);

      if (citados.length === 0) {
        return;
      }

      vistos[marca] = true;

      resultado.push({
        documentoId,
        chave,
        processoId: guid(estado.processoId),
        revisao: texto(registro, 'dgt_revisao'),
        revisaoStatus: formatado(registro, 'dgt_status'),
        citados
      });
    });
  });

  return resultado;
};

// Rótulos dos metadados (processo + chave → nome do campo).
const lerRotulosCampos = async (
  dataverse: DataverseService
): Promise<Record<string, string>> => {

  const rotulos: Record<string, string> = {};

  try {
    (await dataverse.listarRegistros(
      'dgt_processometadado',
      '$select=dgt_chave,dgt_name,_dgt_processo_value'
    )).forEach(registro => {
      const chave = texto(registro, 'dgt_chave');
      rotulos[`${guid(registro._dgt_processo_value)}|${chave}`] = texto(registro, 'dgt_name');
      rotulos[`|${chave}`] = rotulos[`|${chave}`] || texto(registro, 'dgt_name');
    });
  } catch (erro) {
    console.error(erro);
  }

  return rotulos;
};

export const carregarReferenciasDocumento = async (
  dataverse: DataverseService,
  documentoId: string
): Promise<IReferenciasDocumento> => {

  const id = guid(documentoId);

  const [brutas, documentos, rotulos] =
    await Promise.all([
      lerReferenciasBrutas(dataverse),
      carregarDocumentos(dataverse, true),
      lerRotulosCampos(dataverse)
    ]);

  const rotuloDe = (bruta: IReferenciaBruta): string =>
    rotulos[`${bruta.processoId}|${bruta.chave}`] ||
    rotulos[`|${bruta.chave}`] ||
    bruta.chave;

  const referencia: IReferenciaDocumento[] = [];
  const referenciadoPor: IReferenciaDocumento[] = [];

  brutas.forEach(bruta => {

    if (bruta.documentoId === id) {
      bruta.citados.forEach(citado => {
        referencia.push({
          documento: resumoDoValor(citado, documentos),
          campo: rotuloDe(bruta),
          revisao: bruta.revisao,
          revisaoStatus: bruta.revisaoStatus
        });
      });
      return;
    }

    if (bruta.citados.some(citado => citado.id === id)) {
      const quemCita = documentos.find(doc => doc.id === bruta.documentoId);

      if (quemCita) {
        referenciadoPor.push({
          documento: quemCita,
          campo: rotuloDe(bruta),
          revisao: bruta.revisao,
          revisaoStatus: bruta.revisaoStatus
        });
      }
    }
  });

  const ordenar = (a: IReferenciaDocumento, b: IReferenciaDocumento): number =>
    a.campo.localeCompare(b.campo) || a.documento.codigo.localeCompare(b.documento.codigo);

  return {
    referencia: referencia.sort(ordenar),
    referenciadoPor: referenciadoPor.sort(ordenar)
  };
};

// ------------------------------------------------------------
// Treinamentos
// ------------------------------------------------------------

// Treinamento de um documento de controle (TRN): o vínculo com o
// treinamento de mesmo código; se não houver, busca pelo código.
const treinamentoDoControle = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string }
): Promise<{ id: string; codigo: string; nome: string } | undefined> => {

  // REGRA (a mesma do controle documental): o treinamento de um
  // documento TRN é o de CÓDIGO IDÊNTICO ao do documento — e só ele.
  // Nunca usar "o primeiro vínculo que existir": um documento TRN pode
  // estar vinculado a outros treinamentos (ex.: como referência) e isso
  // levava a vincular o treinamento errado.
  const codigo =
    (documento.codigo || '').trim();

  if (!codigo) {
    return undefined;
  }

  const registros =
    await dataverse.listarRegistros(
      'dgt_treinamento',
      `$select=dgt_treinamentoid,dgt_codigo,dgt_name,dgt_ativo&$filter=dgt_codigo eq '${escaparOData(codigo)}'`
    );

  const exatos =
    registros.filter(item => texto(item, 'dgt_codigo').toUpperCase() === codigo.toUpperCase());

  const escolhido =
    exatos.find(item => item.dgt_ativo !== false) || exatos[0];

  if (escolhido) {
    return { id: guid(escolhido.dgt_treinamentoid), codigo: texto(escolhido, 'dgt_codigo'), nome: texto(escolhido, 'dgt_name') };
  }

  // Sem treinamento de mesmo código: usa o VÍNCULO DE CONTROLE, que o
  // portal grava com uma observação fixa ao criar o documento do
  // treinamento. Vínculos comuns (referência, cadastro) NÃO servem.
  if (documento.id) {
    const controles =
      (await new TreinamentoDocumentoAdminService(dataverse).listarPorDocumento(documento.id))
        .filter(item => item.ativo && (item.observacao || '').trim() === CONTROLE_DOCUMENTAL.OBSERVACAO_VINCULO);

    if (controles.length === 1) {
      return { id: guid(controles[0].treinamentoId), codigo: controles[0].treinamentoCodigo, nome: controles[0].treinamentoNome };
    }
  }

  return undefined;
};

// Texto para o aviso quando o treinamento de um documento TRN não é
// encontrado: mostra a que treinamentos o documento está ligado.
const diagnosticoControle = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string }
): Promise<string> => {
  try {
    const vinculos =
      (await new TreinamentoDocumentoAdminService(dataverse).listarPorDocumento(documento.id))
        .filter(item => item.ativo);

    if (vinculos.length === 0) {
      return ` Não existe treinamento com o código ${documento.codigo} e o documento não está ligado a nenhum treinamento.`;
    }

    return ` Não existe treinamento com o código ${documento.codigo}. O documento está ligado a: ` +
      vinculos
        .map(item => `${item.treinamentoCodigo || '?'} (${(item.observacao || 'sem observação').trim()})`)
        .join('; ') +
      '. Nenhum desses é o vínculo de controle do treinamento.';
  } catch {
    return '';
  }
};

// Vínculo criado automaticamente a partir de uma referência.
export const ehVinculoAutomatico = (
  observacao?: string
): boolean =>
  (observacao || '').indexOf('Vínculo criado pela referência') === 0;

export const carregarVinculosTreinamento = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string; tipo: string }
): Promise<IVinculosTreinamentoDocumento> => {

  if (!ehDocumentoControle(documento.tipo)) {
    const vinculos =
      await new TreinamentoDocumentoAdminService(dataverse).listarPorDocumento(documento.id);

    return {
      treinamentos:
        vinculos
          .filter(item => item.ativo)
          .map(item => ({
            id: guid(item.treinamentoId),
            codigo: item.treinamentoCodigo,
            nome: item.treinamentoNome,
            obrigatorio: item.obrigatorio,
            relacaoId: guid(item.id),
            observacao: item.observacao || '',
            automatico: ehVinculoAutomatico(item.observacao)
          })),
      documentosDoTreinamento: []
    };
  }

  const treinamento =
    await treinamentoDoControle(dataverse, documento);

  if (!treinamento) {
    return { treinamentos: [], documentosDoTreinamento: [] };
  }

  const [registros, documentos] =
    await Promise.all([
      dataverse.getTreinamentoDocumentos(treinamento.id),
      carregarDocumentos(dataverse)
    ]);

  const proprioId = guid(documento.id);

  return {
    treinamentos: [],
    treinamentoDoControle: treinamento,
    documentosDoTreinamento:
      registros
        .map(registro => guid(registro._dgt_documento_value))
        .filter(id => !!id && id !== proprioId)
        .map(id => documentos.find(doc => doc.id === id))
        .filter((doc): doc is IDocumentoResumoReferencia => !!doc)
  };
};

// ------------------------------------------------------------
// Sincronização: referência → vínculo treinamento × documento
// ------------------------------------------------------------

// Ordem do novo vínculo: depois dos documentos que o treinamento já
// tem (dgt_ordem aceita de 1 a 10000; 0 é recusado pelo Dataverse).
const proximaOrdem = async (
  dataverse: DataverseService,
  treinamentoId: string
): Promise<number> => {
  try {
    const existentes = await dataverse.getTreinamentoDocumentos(treinamentoId);
    return Math.min(10000, Math.max(1, existentes.length + 1));
  } catch {
    return 1;
  }
};

export const sincronizarVinculosTreinamento = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string; tipo: string },
  valores: Record<string, string>,
  rotuloRevisao?: string
): Promise<number> => {

  const citados: IValorDocumento[] = [];

  Object.keys(valores || {}).forEach(chave => {
    extrairReferencias(valores[chave]).forEach(item => {
      if (!citados.some(atual => atual.id === item.id)) {
        citados.push(item);
      }
    });
  });

  if (citados.length === 0) {
    return 0;
  }

  const documentos = await carregarDocumentos(dataverse);
  const tipoDe = (id: string): string => {
    const doc = documentos.find(item => item.id === id);
    return doc ? doc.tipo : '';
  };

  const servico = new TreinamentoDocumentoAdminService(dataverse);
  const pares: Array<{ documentoId: string; treinamento: { id: string; codigo: string } }> = [];

  if (ehDocumentoControle(documento.tipo)) {
    // Treinamento citando documentos.
    const citadosDocumentos =
      citados.filter(item => !ehDocumentoControle(tipoDe(item.id)));

    if (citadosDocumentos.length > 0) {
      const treinamento = await treinamentoDoControle(dataverse, documento);
      if (!treinamento) {
        throw new Error(`Treinamento do documento ${documento.codigo} não encontrado.${await diagnosticoControle(dataverse, documento)}`);
      }
      citadosDocumentos.forEach(item => pares.push({ documentoId: item.id, treinamento }));
    }
  } else {
    // Documento citando treinamentos.
    for (const item of citados.filter(citado => ehDocumentoControle(tipoDe(citado.id)))) {
      const treinamento = await treinamentoDoControle(dataverse, { id: item.id, codigo: item.codigo });
      if (!treinamento) {
        throw new Error(`Treinamento do documento ${item.codigo} não encontrado.${await diagnosticoControle(dataverse, { id: item.id, codigo: item.codigo })}`);
      }
      pares.push({ documentoId: guid(documento.id), treinamento });
    }
  }

  let criados = 0;

  for (const par of pares) {
    try {
      await servico.vincular({
        documentoId: par.documentoId,
        treinamentoId: par.treinamento.id,
        obrigatorio: true,
        ordem: await proximaOrdem(dataverse, par.treinamento.id),
        observacao:
          `Vínculo criado pela referência no fluxo de ${documento.codigo}` +
          `${rotuloRevisao ? ` (${rotuloRevisao})` : ''}.`
      });
      criados++;
    } catch (erro) {
      // "Já está vinculado" não é erro: o vínculo já existe.
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (mensagem.indexOf('já está vinculado') < 0) {
        throw erro;
      }
    }
  }

  return criados;
};

// ------------------------------------------------------------
// Vínculo DIRETO treinamento × documentos (tela do treinamento)
// ------------------------------------------------------------

export interface IDocumentoDoTreinamento {
  relacaoId: string;
  documento: IDocumentoResumoReferencia;
}

// Documentos ativos ligados ao treinamento, sem o próprio documento
// de controle (TRN).
export const listarDocumentosDoTreinamento = async (
  dataverse: DataverseService,
  treinamentoId: string
): Promise<IDocumentoDoTreinamento[]> => {

  const [registros, documentos] =
    await Promise.all([
      dataverse.getTreinamentoDocumentos(treinamentoId),
      carregarDocumentos(dataverse, true)
    ]);

  const lista: IDocumentoDoTreinamento[] = [];

  registros.forEach(registro => {
    const documentoId = guid(registro._dgt_documento_value);
    const documento = documentos.find(doc => doc.id === documentoId);

    if (documento && !ehDocumentoControle(documento.tipo)) {
      lista.push({
        relacaoId: guid(registro.dgt_treinamentodocumentoid),
        documento
      });
    }
  });

  return lista.sort((a, b) => a.documento.codigo.localeCompare(b.documento.codigo));
};

// Cria (ou reativa) o vínculo. Já vinculado não é erro.
export const vincularDocumentoAoTreinamento = async (
  dataverse: DataverseService,
  treinamentoId: string,
  documentoId: string,
  observacao: string
): Promise<void> => {
  try {
    await new TreinamentoDocumentoAdminService(dataverse).vincular({
      documentoId: guid(documentoId),
      treinamentoId: guid(treinamentoId),
      obrigatorio: true,
      ordem: await proximaOrdem(dataverse, treinamentoId),
      observacao
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (mensagem.indexOf('já está vinculado') < 0) {
      throw erro;
    }
  }
};

// Desativa o vínculo (nada é apagado: o histórico fica no registro).
export const desvincularDocumentoDoTreinamento = async (
  dataverse: DataverseService,
  relacaoId: string
): Promise<void> => {
  await new TreinamentoDocumentoAdminService(dataverse).desativar(relacaoId);
};
