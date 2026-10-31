import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  IValorDocumento,
  codigoTipoDocumento,
  lerReferenciasGravadas
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
// Nada é apagado. O treinamento de um TRN é sempre o de MESMO código
// (resolverTreinamentoDoControle). Vínculos criados automaticamente
// pelas referências que não correspondem mais a elas são DESATIVADOS
// na próxima execução de etapa; vínculos manuais não são tocados.
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
  // relacaoId/observacao/automatico: usados pela aba Referências
  // (botão "Desvincular" e alerta "não corresponde às referências").
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

// Início da observação gravada nos vínculos criados pelas referências.
const PREFIXO_OBSERVACAO_AUTOMATICA =
  'Vínculo criado pela referência no fluxo de ';

export const ehVinculoAutomatico = (
  observacao?: string
): boolean =>
  (observacao || '').trim().toUpperCase()
    .indexOf(PREFIXO_OBSERVACAO_AUTOMATICA.toUpperCase()) === 0;

export const ehDocumentoControle = (
  tipo?: string
): boolean =>
  (tipo || '').trim().toUpperCase() === CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO;

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
          // dgt_tipo é escolha: o código (POP, TRN…) vem do valor formatado.
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

      const citados = lerReferenciasGravadas(valores[chave]);

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

export interface ITreinamentoResolvido {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

const normalizarCodigo = (
  valor: string
): string =>
  (valor || '').trim().toUpperCase();

// Treinamento de um documento de controle (TRN) — resolução ESTRITA.
//
// Regra única: o treinamento é o dgt_treinamento com o MESMO código do
// documento (ARQ-TRN-002 ↔ ARQ-TRN-002). Sem treinamento com esse
// código, não há treinamento — nada de "qualquer vínculo do documento",
// vínculo de controle antigo ou nome/título (os três já ligaram o
// treinamento errado quando documento e treinamento ficaram com
// códigos diferentes).
export const resolverTreinamentoDoControle = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string }
): Promise<ITreinamentoResolvido | undefined> => {

  const codigo = normalizarCodigo(documento.codigo);

  if (!codigo) {
    return undefined;
  }

  const registros =
    await dataverse.listarRegistros(
      'dgt_treinamento',
      '$select=dgt_treinamentoid,dgt_codigo,dgt_name,dgt_ativo' +
      `&$filter=dgt_codigo eq '${escaparOData(codigo)}'`
    );

  const mesmoCodigo =
    registros.filter(registro => normalizarCodigo(texto(registro, 'dgt_codigo')) === codigo);

  if (mesmoCodigo.length > 1) {
    console.warn(`[Referências] Há ${mesmoCodigo.length} treinamentos com o código ${codigo}. Usando o ativo (ou o primeiro).`);
  }

  const escolhido =
    mesmoCodigo.find(registro => registro.dgt_ativo !== false) ||
    mesmoCodigo[0];

  return escolhido
    ? {
      id: guid(escolhido.dgt_treinamentoid),
      codigo: texto(escolhido, 'dgt_codigo'),
      nome: texto(escolhido, 'dgt_name'),
      ativo: escolhido.dgt_ativo !== false
    }
    : undefined;
};

// ------------------------------------------------------------
// Opções de treinamento nos campos "Documento referenciado"
// ------------------------------------------------------------
//
// Documento TRN só pode ser escolhido se existir um treinamento ATIVO
// com o MESMO código. O título mostrado (e gravado na referência) passa
// a ser o NOME DO TREINAMENTO, para que o que se vê na lista seja
// exatamente o treinamento que será vinculado.

export interface ITreinamentoPorCodigo {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

let cacheTreinamentos:
  { lidoEm: number; mapa: Promise<Record<string, ITreinamentoPorCodigo>> } | undefined;

export const carregarTreinamentosPorCodigo = (
  dataverse: DataverseService,
  forcar = false
): Promise<Record<string, ITreinamentoPorCodigo>> => {

  if (!forcar && cacheTreinamentos && Date.now() - cacheTreinamentos.lidoEm < 2 * 60 * 1000) {
    return cacheTreinamentos.mapa;
  }

  const mapa =
    dataverse.listarRegistros(
      'dgt_treinamento',
      '$select=dgt_treinamentoid,dgt_codigo,dgt_name,dgt_ativo'
    ).then(registros => {
      const resultado: Record<string, ITreinamentoPorCodigo> = {};

      registros.forEach(registro => {
        const codigo = normalizarCodigo(texto(registro, 'dgt_codigo'));
        if (!codigo) {
          return;
        }

        const item: ITreinamentoPorCodigo = {
          id: guid(registro.dgt_treinamentoid),
          codigo,
          nome: texto(registro, 'dgt_name'),
          ativo: registro.dgt_ativo !== false
        };

        // Código repetido: o ativo prevalece.
        if (!resultado[codigo] || (!resultado[codigo].ativo && item.ativo)) {
          resultado[codigo] = item;
        }
      });

      return resultado;
    });

  mapa.catch(() => { cacheTreinamentos = undefined; });

  cacheTreinamentos = { lidoEm: Date.now(), mapa };
  return mapa;
};

// Mantém os documentos comuns como estão; dos TRN, só os que têm
// treinamento ATIVO de mesmo código, com o título trocado pelo nome do
// treinamento.
export const ajustarOpcoesTreinamento = <T extends { codigo: string; titulo: string; tipo: string }>(
  documentos: T[],
  treinamentos: Record<string, ITreinamentoPorCodigo>
): T[] => {

  const resultado: T[] = [];

  documentos.forEach(doc => {
    if (!ehDocumentoControle(doc.tipo)) {
      resultado.push(doc);
      return;
    }

    const treinamento = treinamentos[normalizarCodigo(doc.codigo)];

    if (treinamento && treinamento.ativo) {
      resultado.push({ ...doc, titulo: treinamento.nome || doc.titulo });
    }
  });

  return resultado;
};

// Nome antigo, mantido para o restante do arquivo.
const treinamentoDoControle = resolverTreinamentoDoControle;

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
//
// Regras (versão corrigida):
//   • o treinamento de cada TRN é resolvido de forma ESTRITA
//     (resolverTreinamentoDoControle);
//   • a lista de documentos é relida quando algum documento citado
//     não está no cache (documento recém-criado era ignorado);
//   • o código usado é o ATUAL do documento (não o gravado na
//     referência, que pode estar desatualizado);
//   • vínculos criados AUTOMATICAMENTE pelas referências deste
//     documento que não correspondem mais às referências atuais são
//     DESATIVADOS (nunca apagados) — corrige o vínculo errado que já
//     foi gravado. Vínculos manuais e o de controle não são tocados.

export interface IResultadoSincronizacaoVinculos {
  criados: number;
  desativados: number;
  avisos: string[];
}

const observacaoAutomatica = (
  codigoDocumento: string,
  rotuloRevisao?: string
): string =>
  `${PREFIXO_OBSERVACAO_AUTOMATICA}${codigoDocumento}` +
  `${rotuloRevisao ? ` (${rotuloRevisao})` : ''}.`;

// true se a observação foi gravada pela sincronização das referências
// do documento informado (ARQ-MAP-001 não casa com ARQ-MAP-0011).
const criadoPelasReferenciasDe = (
  observacao: string,
  codigoDocumento: string
): boolean => {
  const base = `${PREFIXO_OBSERVACAO_AUTOMATICA}${codigoDocumento}`.toUpperCase();
  const obs = (observacao || '').trim().toUpperCase();
  return obs === `${base}.` || obs.indexOf(`${base} (`) === 0;
};

export const sincronizarVinculosTreinamentoDetalhado = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string; tipo: string },
  valores: Record<string, string>,
  rotuloRevisao?: string
): Promise<IResultadoSincronizacaoVinculos> => {

  const resultado: IResultadoSincronizacaoVinculos = { criados: 0, desativados: 0, avisos: [] };
  const documentoId = guid(documento.id);
  const codigoDocumento = normalizarCodigo(documento.codigo);

  if (!documentoId || !codigoDocumento) {
    return resultado;
  }

  const citados: IValorDocumento[] = [];

  Object.keys(valores || {}).forEach(chave => {
    lerReferenciasGravadas(valores[chave]).forEach(item => {
      if (item.id && item.id !== documentoId && !citados.some(atual => atual.id === item.id)) {
        citados.push(item);
      }
    });
  });

  // Documento citado fora do cache (ex.: criado há pouco): relê.
  let documentos = await carregarDocumentos(dataverse);

  if (citados.some(item => !documentos.some(doc => doc.id === item.id))) {
    documentos = await carregarDocumentos(dataverse, true);
  }

  const docDe = (id: string): IDocumentoResumoReferencia | undefined =>
    documentos.find(item => item.id === id);

  const servico = new TreinamentoDocumentoAdminService(dataverse);
  const observacao = observacaoAutomatica(documento.codigo.trim(), rotuloRevisao);

  // Pares esperados documento × treinamento.
  const pares: Array<{ documentoId: string; treinamento: ITreinamentoResolvido }> = [];

  if (ehDocumentoControle(documento.tipo)) {

    // Treinamento (TRN) citando documentos.
    const treinamento = await treinamentoDoControle(dataverse, { id: documentoId, codigo: codigoDocumento });

    if (!treinamento) {
      if (citados.length > 0) {
        resultado.avisos.push(`Não existe treinamento com o código ${codigoDocumento}: os documentos citados não foram vinculados.`);
      }
    } else {
      citados.forEach(item => {
        const doc = docDe(item.id);
        if (!doc) {
          resultado.avisos.push(`Documento ${item.codigo || item.id} não encontrado: vínculo não criado.`);
          return;
        }
        if (!ehDocumentoControle(doc.tipo)) {
          pares.push({ documentoId: doc.id, treinamento });
        }
      });

      // Correção: documentos ligados a ESTE treinamento pelas referências
      // DESTE documento que não são mais citados.
      const esperados = pares.map(par => par.documentoId);
      const ligados = await dataverse.getTreinamentoDocumentos(treinamento.id);

      for (const registro of ligados) {
        const ligadoId = guid(registro._dgt_documento_value);
        if (
          esperados.indexOf(ligadoId) < 0 &&
          criadoPelasReferenciasDe(texto(registro, 'dgt_observacao'), codigoDocumento)
        ) {
          await servico.desativar(guid(registro.dgt_treinamentodocumentoid));
          resultado.desativados++;
        }
      }
    }

  } else {

    // Documento comum citando treinamentos (TRN).
    for (const item of citados) {
      const doc = docDe(item.id);

      if (!doc || !ehDocumentoControle(doc.tipo)) {
        continue;
      }

      const treinamento =
        await treinamentoDoControle(dataverse, { id: doc.id, codigo: doc.codigo || item.codigo });

      if (treinamento && !treinamento.ativo) {
        resultado.avisos.push(
          `O treinamento ${treinamento.codigo} (${treinamento.nome}) está inativo: vínculo não criado. Escolha um treinamento ativo.`
        );
      } else if (treinamento) {
        pares.push({ documentoId, treinamento });
      } else {
        resultado.avisos.push(
          `O documento ${doc.codigo || item.codigo} não tem treinamento com o mesmo código: vínculo não criado.`
        );
      }
    }

    // Correção: vínculos automáticos DESTE documento com treinamento que
    // não corresponde às referências atuais (ex.: ARQ-TRN-001 no lugar
    // de ARQ-TRN-002).
    const esperados = pares.map(par => par.treinamento.id);
    const atuais = await servico.listarPorDocumento(documentoId);

    for (const vinculo of atuais) {
      if (
        vinculo.ativo &&
        esperados.indexOf(guid(vinculo.treinamentoId)) < 0 &&
        criadoPelasReferenciasDe(vinculo.observacao, codigoDocumento)
      ) {
        await servico.desativar(vinculo.id);
        resultado.desativados++;
      }
    }
  }

  for (const par of pares) {
    try {
      await servico.vincular({
        documentoId: par.documentoId,
        treinamentoId: par.treinamento.id,
        obrigatorio: true,
        ordem: 0,
        observacao
      });
      resultado.criados++;
    } catch (erro) {
      // "Já está vinculado" não é erro: o vínculo já existe.
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (mensagem.indexOf('já está vinculado') < 0) {
        throw erro;
      }
    }
  }

  if (resultado.avisos.length > 0 || resultado.desativados > 0) {
    console.warn('[Referências] Sincronização de vínculos:', resultado);
  }

  return resultado;
};

// Assinatura original (usada pelo fluxo de revisão): devolve o número de
// vínculos criados. Avisos e correções ficam no console.
export const sincronizarVinculosTreinamento = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string; tipo: string },
  valores: Record<string, string>,
  rotuloRevisao?: string
): Promise<number> =>
  (await sincronizarVinculosTreinamentoDetalhado(dataverse, documento, valores, rotuloRevisao)).criados;

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
      ordem: 0,
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