import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

// ============================================================
// REMOÇÃO DE UM FLUXO (dgt_processo) — SOMENTE ADMINISTRADOR
//
// O que pertence ao fluxo:
//   dgt_processo                → o fluxo (cartão)
//   dgt_fluxo                   → versões (rascunho/publicada/arquivada)
//   dgt_processometadado        → metadados do fluxo
//   dgt_documentoprocesso       → vínculos documento × fluxo
//   dgt_tarefafluxo             → pendências das etapas (por versão)
//   dgt_historicofluxo          → tramitação (por versão)
//   dgt_processonegociofluxo    → exceções de processos de negócio
//   dgt_processonegocio.dgt_fluxopadrao → fluxo padrão de processos de negócio
//
// Regras:
//   1. Com documentos VINCULADOS (ativos): não remove. Primeiro os
//      documentos são transferidos para outro fluxo.
//   2. Sem documentos, mas com revisões que JÁ PASSARAM por este
//      fluxo (histórico de documentos transferidos): não apaga — o
//      histórico das revisões depende das versões do fluxo. O fluxo é
//      ARQUIVADO (some da lista; nada é perdido).
//   3. Sem documentos e sem histórico: remove o fluxo e TODOS os
//      dados ligados a ele (lista acima). Processos de negócio que o
//      usavam como padrão ficam sem fluxo padrão.
// ============================================================

export interface IAnaliseExclusaoFluxo {
  processoId: string;

  // Documentos vinculados (ativos) → precisam ser transferidos.
  documentosVinculados: number;

  // Revisões de documentos que usaram alguma versão deste fluxo.
  revisoesComHistorico: number;

  versoes: string[];
  metadados: string[];
  vinculosInativos: string[];
  tarefas: string[];
  historicos: string[];
  excecoesProcessoNegocio: string[];
  processosNegocioPadrao: Array<{ id: string; nome: string }>;

  // 'transferir' | 'arquivar' | 'excluir'
  acao: 'transferir' | 'arquivar' | 'excluir';
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

// Divide uma lista de ids em lotes para filtros OData "or".
const lotes = <T>(
  lista: T[],
  tamanho: number
): T[][] => {
  const resultado: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) {
    resultado.push(lista.slice(i, i + tamanho));
  }
  return resultado;
};

// Lê ids de uma tabela; tabela/coluna inexistente → lista vazia.
const lerIds = async (
  dataverse: DataverseService,
  tabela: string,
  colunaId: string,
  filtro: string
): Promise<IDataverseRecord[]> => {
  try {
    return await dataverse.listarRegistros(
      tabela,
      `$select=${colunaId}&$filter=${filtro}`
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (/EntitySet|não encontrad|not found|404|Could not find a property/i.test(mensagem)) {
      return [];
    }
    throw erro;
  }
};

export class ExclusaoFluxoService {

  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async analisar(
    processoIdOriginal: string
  ): Promise<IAnaliseExclusaoFluxo> {

    const processoId = guid(processoIdOriginal);
    const dv = this.dataverse;

    const [vinculos, versoes, metadados, processosNegocio, excecoes] =
      await Promise.all([
        lerIds(dv, 'dgt_documentoprocesso', 'dgt_documentoprocessoid,dgt_ativo', `_dgt_processo_value eq ${processoId}`),
        lerIds(dv, 'dgt_fluxo', 'dgt_fluxoid', `_dgt_processo_value eq ${processoId}`),
        lerIds(dv, 'dgt_processometadado', 'dgt_processometadadoid', `_dgt_processo_value eq ${processoId}`),
        lerIds(dv, 'dgt_processonegocio', 'dgt_processonegocioid,dgt_name', `_dgt_fluxopadrao_value eq ${processoId}`),
        lerIds(dv, 'dgt_processonegociofluxo', 'dgt_processonegociofluxoid', `_dgt_fluxo_value eq ${processoId}`)
      ]);

    const idsVersoes = versoes.map(item => guid(item.dgt_fluxoid)).filter(id => !!id);

    // Revisões, tarefas e histórico ligados às versões.
    let revisoes = 0;
    const tarefas: string[] = [];
    const historicos: string[] = [];

    for (const lote of lotes(idsVersoes, 15)) {
      const filtro = lote.map(id => `_dgt_fluxo_value eq ${id}`).join(' or ');

      const [rev, tar, his] = await Promise.all([
        lerIds(dv, 'dgt_documentorevisao', 'dgt_documentorevisaoid', `(${filtro})`),
        lerIds(dv, 'dgt_tarefafluxo', 'dgt_tarefafluxoid', `(${filtro})`),
        lerIds(dv, 'dgt_historicofluxo', 'dgt_historicofluxoid', `(${filtro})`)
      ]);

      revisoes += rev.length;
      tar.forEach(item => tarefas.push(guid(item.dgt_tarefafluxoid)));
      his.forEach(item => historicos.push(guid(item.dgt_historicofluxoid)));
    }

    const documentosVinculados =
      vinculos.filter(item => item.dgt_ativo !== false).length;

    return {
      processoId,
      documentosVinculados,
      revisoesComHistorico: revisoes,
      versoes: idsVersoes,
      metadados: metadados.map(item => guid(item.dgt_processometadadoid)),
      vinculosInativos: vinculos.filter(item => item.dgt_ativo === false).map(item => guid(item.dgt_documentoprocessoid)),
      tarefas,
      historicos,
      excecoesProcessoNegocio: excecoes.map(item => guid(item.dgt_processonegociofluxoid)),
      processosNegocioPadrao: processosNegocio.map(item => ({
        id: guid(item.dgt_processonegocioid),
        nome: texto(item, 'dgt_name')
      })),
      acao:
        documentosVinculados > 0
          ? 'transferir'
          : revisoes > 0
            ? 'arquivar'
            : 'excluir'
    };
  }

  // Arquiva: o fluxo some da lista (dgt_ativo = false). Nada é apagado.
  public async arquivar(
    processoId: string
  ): Promise<void> {
    await this.dataverse.atualizarRegistro('dgt_processo', guid(processoId), { dgt_ativo: false });
  }

  // Remove o fluxo e todos os dados ligados a ele. Refaz a análise
  // antes (protege contra mudanças desde a abertura da confirmação).
  public async excluir(
    processoId: string,
    onProgresso?: (mensagem: string) => void
  ): Promise<void> {

    const analise = await this.analisar(processoId);

    if (analise.acao !== 'excluir') {
      throw new Error(
        analise.acao === 'transferir'
          ? 'O fluxo ainda tem documentos vinculados. Transfira os documentos antes de remover.'
          : 'O fluxo tem histórico de revisões de documentos e não pode ser apagado; ele pode ser arquivado.'
      );
    }

    const apagar = async (tabela: string, ids: string[], rotulo: string): Promise<void> => {
      for (let i = 0; i < ids.length; i++) {
        if (onProgresso) {
          onProgresso(`${rotulo} (${i + 1}/${ids.length})...`);
        }
        await this.dataverse.excluirRegistro(tabela, ids[i]);
      }
    };

    // Quem aponta para o fluxo primeiro; o fluxo por último.
    await apagar('dgt_tarefafluxo', analise.tarefas, 'Removendo pendências');
    await apagar('dgt_historicofluxo', analise.historicos, 'Removendo histórico do fluxo');
    await apagar('dgt_processonegociofluxo', analise.excecoesProcessoNegocio, 'Removendo exceções de processos');

    for (const processo of analise.processosNegocioPadrao) {
      if (onProgresso) {
        onProgresso(`Retirando o fluxo padrão de "${processo.nome}"...`);
      }
      await this.dataverse.limparLookup('dgt_processonegocio', processo.id, 'dgt_FluxoPadrao');
    }

    await apagar('dgt_documentoprocesso', analise.vinculosInativos, 'Removendo vínculos antigos');
    await apagar('dgt_processometadado', analise.metadados, 'Removendo metadados');
    await apagar('dgt_fluxo', analise.versoes, 'Removendo versões do fluxo');

    if (onProgresso) {
      onProgresso('Removendo o fluxo...');
    }
    await this.dataverse.excluirRegistro('dgt_processo', analise.processoId);
  }
}
