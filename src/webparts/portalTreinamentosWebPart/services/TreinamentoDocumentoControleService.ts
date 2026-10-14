import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  IDocumentoRevisao
} from '../models/Documento';

import {
  dataHojeSomenteData,
  numeroRevisao,
  obterRevisaoEmAndamento,
  obterRevisaoVigente
} from './DocumentoRevisaoFluxoService';

import {
  DocumentoHistoricoService
} from './DocumentoHistoricoService';

import {
  TABELA_REVISAO_TREINAMENTO,
  ehTabelaRevisaoInexistente,
  rotuloRevisao
} from './TreinamentoRevisaoService';

import {
  revisaoInteira
} from '../utils/numeracaoRevisao';

import {
  obterPersistenciaFluxo
} from './fluxo/persistenciaFluxo';

import {
  escaparOData
} from './fluxo/dataverse/esquemaFluxo';

import {
  CONTROLE_DOCUMENTAL
} from '../constants/controleDocumental';

import {
  TreinamentoConteudoRevisaoService
} from './TreinamentoConteudoRevisaoService';

// ============================================================
// TREINAMENTO TRATADO COMO DOCUMENTO
//
// Documento de controle = dgt_documento com o MESMO código do
// treinamento, tipo TRN, vinculado ao processo de treinamentos
// (TRE-001) e ao próprio treinamento (dgt_treinamentodocumento).
//
//   Treinamento  → identidade do curso (conteúdo, módulos, avaliação)
//   Documento    → controle: revisões, etapas, responsáveis e prazos
//   Revisão      → versão (Rev.00A … Rev.00 → Rev.01A … Rev.01)
//   Atribuição   → evidência de que a pessoa foi treinada
//
// Regras:
//   • O treinamento nasce INATIVO; fica ativo quando a primeira
//     revisão do documento de controle é publicada pelo fluxo.
//   • A partir da Rev.01, cada publicação é espelhada em
//     dgt_treinamentorevisao (Certificados e Histórico continuam
//     mostrando a revisão em que a pessoa foi treinada).
//   • O retreinamento é feito pelo plugin ProcessarRevisaoDocumento,
//     que lê os treinamentos vinculados ao documento.
//   • Nada é apagado: todas as operações são idempotentes (podem ser
//     repetidas sem duplicar registros).
// ============================================================

export interface IUsuarioControle {
  id: string;
  nome: string;
}

export interface IRevisaoControleResumo {
  id: string;
  revisao: string;
  status: string;
}

export interface IControleTreinamento {
  treinamentoId: string;
  documentoId: string;
  codigo: string;
  statusDocumento: string;

  // Revisão vigente (ex.: Rev.01). Vazio enquanto nada foi publicado.
  revisaoVigente: string;

  // Revisão em andamento no fluxo (ex.: Rev.02A em Elaboração).
  revisaoEmAndamento?: IRevisaoControleResumo;

  // true = já existe revisão publicada (o treinamento pode ser ativado).
  vigente: boolean;
}

export interface IOpcoesDocumentoControle {
  // Treinamentos antigos que já estão em uso: o documento nasce com
  // a revisão informada já VIGENTE (sem passar pelo fluxo), e só as
  // próximas revisões seguem o fluxo.
  jaVigenteNaRevisao?: string;

  motivo?: string;
}

export interface IResultadoDocumentoControle {
  documentoId: string;
  codigo: string;
  criado: boolean;
  processoNome: string;
  avisos: string[];
}

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const ehGuid = (valor: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

const texto = (r: IDataverseRecord | undefined, campo: string): string => {
  if (!r) {
    return '';
  }
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const formatado = (r: IDataverseRecord, campo: string): string =>
  texto(r, `${campo}@OData.Community.Display.V1.FormattedValue`);

const normalizar = (valor: string): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const lotes = <T>(itens: T[], tamanho: number): T[][] => {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultado.push(itens.slice(i, i + tamanho));
  }
  return resultado;
};

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro || 'erro desconhecido');

// Perfil "Gestor" em dgt_usuarioarea.dgt_perfilarea (ver AreaAdminService).
const PERFIL_GESTOR_VALOR = 100000001;

export class TreinamentoDocumentoControleService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // ==========================================================
  // LEITURA
  // ==========================================================

  // { treinamentoId → controle } somente para os treinamentos que já
  // têm documento de controle.
  public async mapear(
    treinamentos: Array<{ id: string; codigo: string }>
  ): Promise<Record<string, IControleTreinamento>> {

    const porCodigo: Record<string, string> = {};

    treinamentos.forEach(item => {
      const codigo = (item.codigo || '').trim().toUpperCase();
      if (codigo && ehGuid(guid(item.id))) {
        porCodigo[codigo] = guid(item.id);
      }
    });

    const codigos = Object.keys(porCodigo);

    if (codigos.length === 0) {
      return {};
    }

    const documentos: IDataverseRecord[] = [];

    for (const lote of lotes(codigos, 20)) {
      (await this.dataverse.listarRegistros(
        'dgt_documento',
        '$select=dgt_documentoid,dgt_codigo,dgt_revisaoatual,dgt_status' +
        '&$filter=' + lote.map(c => `dgt_codigo eq '${escaparOData(c)}'`).join(' or ')
      )).forEach(r => documentos.push(r));
    }

    if (documentos.length === 0) {
      return {};
    }

    const revisoesPorDocumento =
      await this.revisoesPorDocumento(
        documentos.map(d => guid(d.dgt_documentoid))
      );

    const mapa: Record<string, IControleTreinamento> = {};

    documentos.forEach(doc => {

      const codigo = texto(doc, 'dgt_codigo').toUpperCase();
      const treinamentoId = porCodigo[codigo];
      const documentoId = guid(doc.dgt_documentoid);

      if (!treinamentoId || !documentoId) {
        return;
      }

      const revisoes = revisoesPorDocumento[documentoId] || [];
      const vigente = obterRevisaoVigente(revisoes);
      const andamento = obterRevisaoEmAndamento(revisoes);

      mapa[treinamentoId] = {
        treinamentoId,
        documentoId,
        codigo,
        statusDocumento: formatado(doc, 'dgt_status'),
        revisaoVigente: vigente ? revisaoInteira(vigente.revisao) : '',
        revisaoEmAndamento: andamento
          ? { id: andamento.id, revisao: andamento.revisao, status: andamento.status || 'Elaboração' }
          : undefined,
        vigente: !!vigente
      };
    });

    return mapa;
  }

  // Controle de um único treinamento (lê o código no Dataverse).
  public async obterPorTreinamento(
    treinamentoId: string
  ): Promise<IControleTreinamento | undefined> {

    const treinamento = await this.lerTreinamento(treinamentoId);

    if (!treinamento) {
      return undefined;
    }

    const mapa = await this.mapear([
      { id: treinamentoId, codigo: texto(treinamento, 'dgt_codigo') }
    ]);

    return mapa[guid(treinamentoId)];
  }

  // ==========================================================
  // CRIAÇÃO (idempotente)
  // ==========================================================

  public async garantirDocumentoControle(
    treinamentoId: string,
    usuario: IUsuarioControle,
    opcoes: IOpcoesDocumentoControle = {}
  ): Promise<IResultadoDocumentoControle> {

    const treinamento = await this.lerTreinamento(treinamentoId);

    if (!treinamento) {
      throw new Error('Treinamento não encontrado no Dataverse.');
    }

    const codigo = texto(treinamento, 'dgt_codigo').toUpperCase();

    if (!codigo) {
      throw new Error(
        'O treinamento ainda não tem código. Verifique o plugin GerarCodigoTreinamento e tente novamente.'
      );
    }

    const nome = texto(treinamento, 'dgt_name') || codigo;
    const areaId = guid(treinamento._dgt_area_value);
    const avisos: string[] = [];

    // 1) Documento
    let documentoId = await this.buscarDocumentoPorCodigo(codigo);
    let criado = false;

    if (!documentoId) {
      documentoId = await this.criarDocumento(
        codigo,
        nome,
        texto(treinamento, 'dgt_descricao'),
        areaId,
        usuario,
        !!opcoes.jaVigenteNaRevisao,
        opcoes.jaVigenteNaRevisao
      );
      criado = true;
    }

    // 2) Revisão inicial (se o documento ainda não tem nenhuma)
    const revisoes =
      (await this.revisoesPorDocumento([documentoId]))[documentoId] || [];

    if (revisoes.length === 0) {
      await this.criarRevisaoInicial(
        documentoId,
        codigo,
        usuario,
        opcoes
      );

      // Treinamento já em uso: registra o conteúdo atual na revisão
      // vigente (para consulta depois que ela ficar obsoleta).
      if (opcoes.jaVigenteNaRevisao) {
        const criadas =
          (await this.revisoesPorDocumento([documentoId]))[documentoId] || [];

        const vigente = obterRevisaoVigente(criadas);

        if (vigente) {
          const aviso =
            await new TreinamentoConteudoRevisaoService(this.dataverse)
              .registrar(vigente.id, guid(treinamentoId), revisaoInteira(vigente.revisao));

          if (aviso) {
            avisos.push(aviso);
          }
        }
      }
    }

    // 3) Vínculo treinamento × documento (usado no retreinamento)
    try {
      await this.garantirVinculoTreinamento(documentoId, guid(treinamentoId));
    } catch (erro) {
      avisos.push(`Não foi possível vincular o documento ao treinamento: ${mensagem(erro)}`);
    }

    // 4) Vínculo com o processo (o fluxo de revisão)
    let processoNome = '';

    try {
      processoNome = await this.garantirProcesso(documentoId);

      if (!processoNome) {
        avisos.push(
          `Processo ${CONTROLE_DOCUMENTAL.PROCESSO_CODIGO} não encontrado: o documento ${codigo} foi criado sem fluxo. ` +
          'Cadastre o processo (Processos → Novo processo) e vincule o documento.'
        );
      }
    } catch (erro) {
      avisos.push(`Não foi possível vincular o documento ao processo: ${mensagem(erro)}`);
    }

    // 5) Histórico (nunca interrompe)
    if (criado) {
      const aviso =
        await new DocumentoHistoricoService(this.dataverse).registrarSemInterromper({
          documentoId,
          tipo: 'REVISAO_CRIADA',
          titulo: opcoes.jaVigenteNaRevisao
            ? 'Treinamento colocado sob controle documental'
            : 'Documento de controle do treinamento criado',
          descricao: opcoes.jaVigenteNaRevisao
            ? `Treinamento ${codigo} passou a ser controlado como documento, vigente na ${opcoes.jaVigenteNaRevisao}. As próximas revisões seguem o fluxo do processo.`
            : `Treinamento ${codigo} criado. A ${CONTROLE_DOCUMENTAL.REVISAO_INICIAL} segue o fluxo do processo até a publicação.`,
          statusNovo: opcoes.jaVigenteNaRevisao ? 'Vigente' : 'Elaboração',
          motivo: opcoes.motivo,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome
        });

      if (aviso) {
        avisos.push(aviso);
      }
    }

    return {
      documentoId,
      codigo,
      criado,
      processoNome,
      avisos
    };
  }

  // ==========================================================
  // PUBLICAÇÃO (chamada depois que a revisão do documento foi
  // publicada pelo fluxo ou pelo modal de publicação)
  // ==========================================================

  // Devolve uma mensagem para a tela ('' quando o documento não é
  // documento de controle de treinamento).
  public async aoPublicarRevisao(
    documentoId: string,
    documentoRevisaoId: string,
    resultado?: { usuariosImpactados?: number; atribuicoesCriadas?: number },
    responsavelNome?: string
  ): Promise<string> {

    const doc =
      await this.dataverse.obterRegistro('dgt_documento', documentoId, ['dgt_codigo']);

    const codigo = texto(doc ? doc.registro : undefined, 'dgt_codigo').toUpperCase();

    if (!codigo) {
      return '';
    }

    const treinamentos =
      await this.dataverse.listarRegistros(
        'dgt_treinamento',
        `$select=dgt_treinamentoid,dgt_codigo,dgt_ativo&$filter=dgt_codigo eq '${escaparOData(codigo)}'&$top=1`
      );

    if (treinamentos.length === 0) {
      return '';
    }

    const treinamento = treinamentos[0];
    const treinamentoId = guid(treinamento.dgt_treinamentoid);
    const partes: string[] = [];

    // Garante o vínculo treinamento × documento (corrige documentos
    // criados quando o vínculo falhou). Necessário para os
    // retreinamentos das próximas revisões.
    try {
      await this.garantirVinculoTreinamento(documentoId, treinamentoId);
    } catch (erro) {
      partes.push(`Atenção: não foi possível vincular o documento ao treinamento (${mensagem(erro)}).`);
    }

    // Revisão publicada
    const lida =
      await this.dataverse.obterRegistro(
        'dgt_documentorevisao',
        documentoRevisaoId,
        ['dgt_revisao', 'dgt_motivoalteracao', 'dgt_descricaoalteracoes', 'dgt_requerretreinamento', 'dgt_justificativa']
      );

    const revisao = lida ? lida.registro : undefined;
    const rotulo = revisaoInteira(texto(revisao, 'dgt_revisao'));

    // 1) Ativa o treinamento (primeira publicação)
    if (treinamento.dgt_ativo !== true) {
      await this.dataverse.atualizarRegistro('dgt_treinamento', treinamentoId, { dgt_ativo: true });
      partes.push(`Treinamento ${codigo} ativado (${rotulo || 'revisão publicada'}).`);
    }

    // 1.1) Registra o conteúdo do treinamento nesta revisão (para
    //      consultar depois que ela ficar obsoleta).
    const avisoConteudo =
      await new TreinamentoConteudoRevisaoService(this.dataverse)
        .registrar(documentoRevisaoId, treinamentoId, rotulo);

    if (avisoConteudo) {
      partes.push(avisoConteudo);
    }

    // 2) Espelha a revisão em dgt_treinamentorevisao (Rev.01 em diante)
    const numero = numeroRevisao(rotulo);

    if (numero > 0) {
      try {
        const existentes =
          await this.dataverse.listarRegistros(
            TABELA_REVISAO_TREINAMENTO,
            `$select=dgt_treinamentorevisaoid&$filter=_dgt_treinamento_value eq ${treinamentoId} and dgt_numero eq ${numero}&$top=1`
          );

        if (existentes.length === 0) {

          const retreinar = !!revisao && revisao.dgt_requerretreinamento === true;

          await this.dataverse.criarRegistro(
            TABELA_REVISAO_TREINAMENTO,
            {
              dgt_name: `${codigo} ${rotuloRevisao(numero)}`.substring(0, 200),
              'dgt_Treinamento@odata.bind': await this.dataverse.referenciaLookup('dgt_treinamento', treinamentoId),
              dgt_numero: numero,
              dgt_datavigencia: new Date().toISOString(),
              dgt_motivo: (texto(revisao, 'dgt_motivoalteracao') || 'Revisão publicada pelo fluxo do processo.').substring(0, 4000),
              dgt_descricaoalteracoes: (texto(revisao, 'dgt_descricaoalteracoes') || '-').substring(0, 4000),
              dgt_requerretreinamento: retreinar,
              dgt_justificativa: (texto(revisao, 'dgt_justificativa') || '').substring(0, 4000),
              dgt_usuariosimpactados: resultado && typeof resultado.usuariosImpactados === 'number' ? resultado.usuariosImpactados : null,
              dgt_atribuicoescriadas: resultado && typeof resultado.atribuicoesCriadas === 'number' ? resultado.atribuicoesCriadas : null,
              dgt_responsavelnome: (responsavelNome || '').substring(0, 200)
            }
          );

          partes.push(`Revisão ${rotuloRevisao(numero)} registrada no histórico do treinamento.`);
        }
      } catch (erro) {
        if (!ehTabelaRevisaoInexistente(erro)) {
          throw erro;
        }
        // Tabela de revisões de treinamento ainda não criada: ignora.
      }
    }

    return partes.join(' ');
  }

  // ==========================================================
  // AUXILIARES
  // ==========================================================

  private async lerTreinamento(
    treinamentoId: string
  ): Promise<IDataverseRecord | undefined> {

    const id = guid(treinamentoId);

    if (!ehGuid(id)) {
      return undefined;
    }

    const lido =
      await this.dataverse.obterRegistro(
        'dgt_treinamento',
        id,
        ['dgt_codigo', 'dgt_name', 'dgt_descricao', 'dgt_ativo', '_dgt_area_value']
      );

    return lido ? lido.registro : undefined;
  }

  private async buscarDocumentoPorCodigo(codigo: string): Promise<string> {
    const encontrados =
      await this.dataverse.listarRegistros(
        'dgt_documento',
        `$select=dgt_documentoid&$filter=dgt_codigo eq '${escaparOData(codigo)}'&$top=1`
      );

    return encontrados.length > 0 ? guid(encontrados[0].dgt_documentoid) : '';
  }

  private async revisoesPorDocumento(
    documentoIds: string[]
  ): Promise<Record<string, IDocumentoRevisao[]>> {

    const ids = documentoIds.map(guid).filter(ehGuid);
    const mapa: Record<string, IDocumentoRevisao[]> = {};

    for (const lote of lotes(ids, 20)) {

      const registros =
        await this.dataverse.listarRegistros(
          'dgt_documentorevisao',
          '$select=dgt_documentorevisaoid,dgt_revisao,dgt_status,dgt_ativa,_dgt_documento_value' +
          '&$filter=' + lote.map(id => `_dgt_documento_value eq ${id}`).join(' or ')
        );

      registros.forEach(r => {
        const documentoId = guid(r._dgt_documento_value);

        (mapa[documentoId] = mapa[documentoId] || []).push({
          id: guid(r.dgt_documentorevisaoid),
          documentoId,
          nome: '',
          revisao: texto(r, 'dgt_revisao'),
          status: formatado(r, 'dgt_status'),
          ativa: r.dgt_ativa === true,
          requerRetreinamento: false
        });
      });
    }

    return mapa;
  }

  private async opcaoPorTrecho(
    tabela: string,
    coluna: string,
    trecho: RegExp
  ): Promise<number | undefined> {

    const opcoes = await this.dataverse.getChoiceOptions(tabela, coluna);
    const encontrada = opcoes.find(item => trecho.test(normalizar(item.label)));

    return encontrada
      ? encontrada.value
      : opcoes.length > 0 ? opcoes[0].value : undefined;
  }

  private async gestorDaArea(areaId: string): Promise<string> {

    if (!ehGuid(areaId)) {
      return '';
    }

    const vinculos =
      await this.dataverse.listarRegistros(
        'dgt_usuarioarea',
        `$select=_dgt_usuario_value,dgt_perfilarea,dgt_ativo&$filter=_dgt_area_value eq ${areaId} and dgt_ativo eq true`
      );

    const gestor =
      vinculos.find(v =>
        Number(v.dgt_perfilarea) === PERFIL_GESTOR_VALOR ||
        normalizar(formatado(v, 'dgt_perfilarea')) === 'gestor');

    return gestor ? guid(gestor._dgt_usuario_value) : '';
  }

  private async criarDocumento(
    codigo: string,
    nome: string,
    descricao: string,
    areaId: string,
    usuario: IUsuarioControle,
    vigente: boolean,
    revisaoVigente?: string
  ): Promise<string> {

    let tipo: number;

    try {
      tipo =
        await this.dataverse.getChoiceOptionValue(
          'dgt_documento',
          'dgt_tipo',
          CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO
        );
    } catch {
      throw new Error(
        `O tipo de documento "${CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO}" não existe no Dataverse. ` +
        'Execute scripts/dataverse/criar-tipo-documento-treinamento.ps1 e tente novamente ' +
        '(em Gestão de treinamentos, menu ⋮ → "Colocar sob controle documental").'
      );
    }

    if (!ehGuid(areaId)) {
      throw new Error('O treinamento não tem área definida: edite o treinamento e selecione a área.');
    }

    const status =
      await this.opcaoPorTrecho('dgt_documento', 'dgt_status', vigente ? /vigente/ : /elabora/);

    // Responsável pelo documento: Gestor da área; sem gestor, quem criou.
    const responsavel =
      (await this.gestorDaArea(areaId)) || guid(usuario.id);

    const dados: Record<string, unknown> = {
      dgt_name: nome.substring(0, 100),
      dgt_codigo: codigo,
      dgt_titulo: nome.substring(0, 200),
      dgt_descricao: descricao || `Documento de controle do treinamento ${codigo}.`,
      dgt_tipo: tipo,
      dgt_revisaoatual: vigente
        ? revisaoInteira(revisaoVigente || rotuloRevisao(0))
        : CONTROLE_DOCUMENTAL.REVISAO_INICIAL,
      dgt_ativo: true
    };

    if (status !== undefined) {
      dados.dgt_status = status;
    }

    const criado =
      ehGuid(responsavel)
        ? await this.dataverse.criarDocumentoAdminComAreaEAprovador(areaId, responsavel, dados)
        : await this.dataverse.criarDocumentoAdminComArea(areaId, dados);

    const id = guid(criado.dgt_documentoid) || await this.buscarDocumentoPorCodigo(codigo);

    if (!id) {
      throw new Error('O documento de controle foi criado, mas o Dataverse não retornou o ID.');
    }

    return id;
  }

  private async criarRevisaoInicial(
    documentoId: string,
    codigo: string,
    usuario: IUsuarioControle,
    opcoes: IOpcoesDocumentoControle
  ): Promise<void> {

    const vigente = !!opcoes.jaVigenteNaRevisao;

    const rotulo =
      vigente
        ? revisaoInteira(opcoes.jaVigenteNaRevisao || rotuloRevisao(0))
        : CONTROLE_DOCUMENTAL.REVISAO_INICIAL;

    const status =
      await this.dataverse.getChoiceOptionValue(
        'dgt_documentorevisao',
        'dgt_status',
        vigente ? 'Vigente' : 'Elaboração'
      );

    const hoje = dataHojeSomenteData();

    const dados: Record<string, unknown> = {
      dgt_name: `${codigo} - ${rotulo}`.substring(0, 100),
      dgt_revisao: rotulo,
      dgt_datarevisao: hoje,
      dgt_motivoalteracao: (
        opcoes.motivo ||
        (vigente ? 'Treinamento colocado sob controle documental' : 'Criação do treinamento')
      ).substring(0, 100),
      dgt_descricaoalteracoes: vigente
        ? `Registro da revisão vigente do treinamento ${codigo} no controle documental. Conteúdo não alterado.`
        : `Elaboração inicial do treinamento ${codigo} (dados, módulos e avaliação).`,
      dgt_requerretreinamento: false,
      dgt_justificativa: vigente
        ? 'Registro inicial do controle documental: não altera conclusões existentes.'
        : 'Não se aplica à criação do treinamento.',
      dgt_status: status,
      dgt_ativa: true
    };

    if (vigente) {
      dados.dgt_datavigencia = hoje;
      dados.dgt_dataaprovacao = new Date().toISOString();
    }

    await this.dataverse.criarDocumentoRevisaoComResponsavel(
      documentoId,
      guid(usuario.id),
      dados
    );
  }

  private async garantirVinculoTreinamento(
    documentoId: string,
    treinamentoId: string
  ): Promise<void> {

    const existentes =
      await this.dataverse.listarRegistros(
        'dgt_treinamentodocumento',
        '$select=dgt_treinamentodocumentoid,dgt_ativo' +
        `&$filter=_dgt_documento_value eq ${documentoId} and _dgt_treinamento_value eq ${treinamentoId}`
      );

    if (existentes.some(item => item.dgt_ativo === true)) {
      return;
    }

    if (existentes.length > 0) {
      await this.dataverse.atualizarTreinamentoDocumento(
        guid(existentes[0].dgt_treinamentodocumentoid),
        { dgt_ativo: true, dgt_obrigatorio: true }
      );
      return;
    }

    await this.dataverse.criarTreinamentoDocumento(
      documentoId,
      treinamentoId,
      {
        dgt_name: 'Documento de controle',
        dgt_obrigatorio: true,
        dgt_ordem: CONTROLE_DOCUMENTAL.ORDEM_VINCULO,
        dgt_observacao: CONTROLE_DOCUMENTAL.OBSERVACAO_VINCULO,
        dgt_ativo: true
      }
    );
  }

  // Devolve o nome do processo vinculado ('' se não encontrado).
  private async garantirProcesso(documentoId: string): Promise<string> {

    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const dados = await persistencia.processos.carregar(true, []);

    const codigoProcesso = normalizar(CONTROLE_DOCUMENTAL.PROCESSO_CODIGO);

    const ativos = dados.processos.filter(item => item.ativo !== false);

    const processo =
      ativos.find(item => normalizar(item.codigo) === codigoProcesso) ||
      ativos.find(item => /treinamento/.test(normalizar(item.nome)));

    if (!processo) {
      return '';
    }

    await persistencia.processos.vincularDocumento(
      documentoId,
      processo.id,
      dados.vinculos
    );

    // Atualiza o cache para a tela do documento já saber que ele
    // segue o fluxo.
    await persistencia.processos.carregar(true, []);

    return processo.codigo ? `${processo.codigo} — ${processo.nome}` : processo.nome;
  }
}
