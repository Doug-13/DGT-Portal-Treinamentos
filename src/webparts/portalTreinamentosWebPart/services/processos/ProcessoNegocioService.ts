import {
  IDocumentoProcessoVinculo
} from '../../models/Processo';

import {
  DataverseService
} from '../DataverseService';

import {
  obterPersistenciaFluxo
} from '../fluxo/persistenciaFluxo';

// ============================================================
// PROCESSOS DE NEGÓCIO (Área → Processo → documentos)
//
//   dgt_processonegocio       → o processo da área (agrupa documentos)
//   dgt_processonegociofluxo  → exceção de fluxo por tipo de documento
//   dgt_documento.dgt_processonegocio → processo do documento (um só)
//
// O FLUXO continua sendo o registro de dgt_processo (com versões). O
// processo diz qual fluxo seus documentos seguem:
//   exceção do tipo do documento → senão, fluxo padrão do processo.
// Ao definir o processo de um documento (ou mudar o fluxo do processo),
// o vínculo do documento com o fluxo (dgt_documentoprocesso) é
// ajustado. Revisões já em andamento terminam no fluxo em que estão;
// a próxima revisão segue o fluxo novo.
// ============================================================

export interface IExcecaoFluxoProcesso {
  id?: string;
  tipoDocumento: string;
  fluxoId: string;
  fluxoNome?: string;
}

export interface IProcessoNegocio {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  areaId: string;
  areaNome: string;
  fluxoPadraoId: string;
  fluxoPadraoNome: string;
  ordem: number;
  ativo: boolean;
  excecoes: IExcecaoFluxoProcesso[];
}

export interface IDadosProcessoNegocio {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  areaId: string;
  fluxoPadraoId: string;
  ordem: number;
  ativo: boolean;
  excecoes: IExcecaoFluxoProcesso[];
}

export interface IResultadoSincronizacao {
  documentoId: string;
  ok: boolean;
  mensagem: string;
}

const TABELA = 'dgt_processonegocio';
const TABELA_EXCECAO = 'dgt_processonegociofluxo';

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: Record<string, unknown>,
  campo: string
): string =>
  registro[campo] === undefined || registro[campo] === null
    ? ''
    : String(registro[campo]);

const formatado = (
  registro: Record<string, unknown>,
  campo: string
): string =>
  texto(registro, `${campo}@OData.Community.Display.V1.FormattedValue`);

// Fluxo que um documento do tipo informado segue neste processo.
export const fluxoDoProcessoParaTipo = (
  processo: IProcessoNegocio | undefined,
  tipoDocumento: string
): string => {

  if (!processo) {
    return '';
  }

  const tipo =
    (tipoDocumento || '').trim().toUpperCase();

  const excecao =
    processo.excecoes.find(item => item.tipoDocumento.toUpperCase() === tipo && !!item.fluxoId);

  return excecao ? excecao.fluxoId : processo.fluxoPadraoId;
};

export class ProcessoNegocioService {

  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // LEITURA
  // ----------------------------------------------------------

  public async listar(): Promise<IProcessoNegocio[]> {

    let registros: Record<string, unknown>[];

    try {
      registros =
        await this.dataverse.listarRegistros(
          TABELA,
          '$select=dgt_processonegocioid,dgt_name,dgt_codigo,dgt_descricao,dgt_ordem,dgt_ativo,_dgt_area_value,_dgt_fluxopadrao_value' +
          '&$orderby=dgt_codigo asc'
        );
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      if (/dgt_processonegocio|EntitySet|não encontrad|not found|404/i.test(mensagem)) {
        throw new Error(
          'As tabelas de processos ainda não existem. Rode scripts/dataverse/criar-tabelas-processos-negocio.ps1.'
        );
      }
      throw error;
    }

    let excecoes: Record<string, unknown>[] = [];

    try {
      excecoes =
        await this.dataverse.listarRegistros(
          TABELA_EXCECAO,
          '$select=dgt_processonegociofluxoid,dgt_tipodocumento,_dgt_processonegocio_value,_dgt_fluxo_value' +
          '&$filter=dgt_ativo eq true'
        );
    } catch (error) {
      console.error(error);
    }

    return registros.map(
      registro => {
        const id = guid(registro.dgt_processonegocioid);
        return {
          id,
          codigo: texto(registro, 'dgt_codigo'),
          nome: texto(registro, 'dgt_name'),
          descricao: texto(registro, 'dgt_descricao'),
          areaId: guid(registro._dgt_area_value),
          areaNome: formatado(registro, '_dgt_area_value'),
          fluxoPadraoId: guid(registro._dgt_fluxopadrao_value),
          fluxoPadraoNome: formatado(registro, '_dgt_fluxopadrao_value'),
          ordem: Number(registro.dgt_ordem || 0),
          ativo: registro.dgt_ativo !== false,
          excecoes:
            excecoes
              .filter(item => guid(item._dgt_processonegocio_value) === id)
              .map(item => ({
                id: guid(item.dgt_processonegociofluxoid),
                tipoDocumento: texto(item, 'dgt_tipodocumento').toUpperCase(),
                fluxoId: guid(item._dgt_fluxo_value),
                fluxoNome: formatado(item, '_dgt_fluxo_value')
              }))
        };
      }
    );
  }

  // { documentoId → processoId }
  public async processoPorDocumento(): Promise<Record<string, string>> {

    const registros =
      await this.dataverse.listarRegistros(
        'dgt_documento',
        '$select=dgt_documentoid,_dgt_processonegocio_value&$filter=_dgt_processonegocio_value ne null'
      );

    const mapa: Record<string, string> = {};

    registros.forEach(
      registro => {
        mapa[guid(registro.dgt_documentoid)] = guid(registro._dgt_processonegocio_value);
      }
    );

    return mapa;
  }

  // ----------------------------------------------------------
  // GRAVAÇÃO
  // ----------------------------------------------------------

  public async salvar(
    dados: IDadosProcessoNegocio
  ): Promise<string> {

    if (!dados.nome.trim()) {
      throw new Error('Informe o nome do processo.');
    }

    if (!dados.areaId) {
      throw new Error('Escolha a área do processo.');
    }

    if (!dados.fluxoPadraoId) {
      throw new Error('Escolha o fluxo padrão do processo.');
    }

    const codigo =
      dados.codigo.trim().toUpperCase();

    if (!codigo) {
      throw new Error('Informe o código do processo.');
    }

    // Código único entre os processos.
    const mesmoCodigo =
      await this.dataverse.listarRegistros(
        TABELA,
        `$select=dgt_processonegocioid&$filter=dgt_codigo eq '${codigo.replace(/'/g, "''")}'`
      );

    if (mesmoCodigo.some(item => guid(item.dgt_processonegocioid) !== guid(dados.id))) {
      throw new Error(`Já existe um processo com o código ${codigo}.`);
    }

    const registro: Record<string, unknown> = {
      dgt_name: dados.nome.trim().substring(0, 100),
      dgt_codigo: codigo.substring(0, 30),
      dgt_descricao: dados.descricao.trim(),
      dgt_ordem: dados.ordem || 0,
      dgt_ativo: dados.ativo,
      'dgt_Area@odata.bind': await this.dataverse.referenciaLookup('dgt_area', dados.areaId),
      'dgt_FluxoPadrao@odata.bind': await this.dataverse.referenciaLookup('dgt_processo', dados.fluxoPadraoId)
    };

    let id = guid(dados.id);

    if (id) {
      await this.dataverse.atualizarRegistro(TABELA, id, registro);
    } else {
      id = guid(await this.dataverse.criarRegistro(TABELA, registro));
    }

    await this.salvarExcecoes(id, dados.excecoes);

    return id;
  }

  private async salvarExcecoes(
    processoId: string,
    excecoes: IExcecaoFluxoProcesso[]
  ): Promise<void> {

    const atuais =
      await this.dataverse.listarRegistros(
        TABELA_EXCECAO,
        '$select=dgt_processonegociofluxoid,dgt_tipodocumento,_dgt_fluxo_value' +
        `&$filter=_dgt_processonegocio_value eq ${processoId} and dgt_ativo eq true`
      );

    const desejadas =
      excecoes.filter(item => !!item.tipoDocumento && !!item.fluxoId);

    // Desativa as que saíram ou mudaram.
    for (const atual of atuais) {
      const tipo = texto(atual, 'dgt_tipodocumento').toUpperCase();
      const continua = desejadas.find(
        item => item.tipoDocumento.toUpperCase() === tipo && guid(item.fluxoId) === guid(atual._dgt_fluxo_value)
      );
      if (!continua) {
        await this.dataverse.atualizarRegistro(TABELA_EXCECAO, guid(atual.dgt_processonegociofluxoid), { dgt_ativo: false });
      }
    }

    // Cria as novas.
    for (const item of desejadas) {
      const existe = atuais.some(
        atual =>
          texto(atual, 'dgt_tipodocumento').toUpperCase() === item.tipoDocumento.toUpperCase() &&
          guid(atual._dgt_fluxo_value) === guid(item.fluxoId)
      );
      if (!existe) {
        await this.dataverse.criarRegistro(TABELA_EXCECAO, {
          dgt_name: `${item.tipoDocumento.toUpperCase()}`.substring(0, 100),
          dgt_tipodocumento: item.tipoDocumento.toUpperCase().substring(0, 20),
          dgt_ativo: true,
          'dgt_ProcessoNegocio@odata.bind': await this.dataverse.referenciaLookup(TABELA, processoId),
          'dgt_Fluxo@odata.bind': await this.dataverse.referenciaLookup('dgt_processo', item.fluxoId)
        });
      }
    }
  }

  // Define (ou retira) o processo de um documento.
  public async definirProcessoDoDocumento(
    documentoId: string,
    processoId: string | undefined
  ): Promise<void> {

    if (processoId) {
      await this.dataverse.atualizarRegistro('dgt_documento', documentoId, {
        'dgt_ProcessoNegocio@odata.bind': await this.dataverse.referenciaLookup(TABELA, processoId)
      });
    } else {
      await this.dataverse.limparLookup('dgt_documento', documentoId, 'dgt_ProcessoNegocio');
    }
  }

  // Faz o documento seguir o fluxo informado: vínculo principal com o
  // fluxo e desativação dos demais. Revisão em andamento com fluxo já
  // iniciado termina no fluxo em que está (o estado dela não muda).
  public async sincronizarFluxoDoDocumento(
    documentoId: string,
    fluxoId: string,
    vinculos?: IDocumentoProcessoVinculo[]
  ): Promise<'semMudanca' | 'alterado'> {

    if (!fluxoId) {
      return 'semMudanca';
    }

    const persistencia =
      obterPersistenciaFluxo(this.dataverse);

    const lista =
      vinculos ||
      (await persistencia.processos.carregar(true, [])).vinculos;

    const doDocumento =
      lista.filter(item => item.documentoId === guid(documentoId));

    const ja =
      doDocumento.length === 1 &&
      doDocumento[0].processoId === guid(fluxoId);

    if (ja) {
      if (!doDocumento[0].principal) {
        await persistencia.processos.definirPrincipal(documentoId, fluxoId, lista);
      }
      return 'semMudanca';
    }

    if (!doDocumento.some(item => item.processoId === guid(fluxoId))) {
      await persistencia.processos.vincularDocumento(documentoId, fluxoId, lista);
    }

    const recarregados =
      (await persistencia.processos.carregar(true, [])).vinculos;

    await persistencia.processos.definirPrincipal(documentoId, fluxoId, recarregados);

    for (const vinculo of recarregados.filter(
      item => item.documentoId === guid(documentoId) && item.processoId !== guid(fluxoId)
    )) {
      await persistencia.processos.removerVinculo(vinculo);
    }

    return 'alterado';
  }
}
