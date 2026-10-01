import {
  IFluxoHistorico,
  IFluxoInstancia,
  IFluxoTarefa
} from '../../../models/Fluxo';

import {
  DataverseService
} from '../../DataverseService';

import {
  IContextoGravacaoFluxo,
  IFluxoRepositorio
} from '../FluxoRepositorioLocal';

import {
  escaparOData,
  guid,
  HISTORICO,
  lerJsonSeguro,
  REVISAO_FLUXO,
  TABELA_DOCUMENTO_REVISAO,
  TABELA_FLUXO,
  TABELA_HISTORICO_FLUXO,
  TABELA_TAREFA_FLUXO,
  TABELA_USUARIO,
  TAREFA,
  texto
} from './esquemaFluxo';

// ============================================================
// ESTADO DO FLUXO DE CADA REVISÃO NO DATAVERSE
//
// Fonte da verdade: dgt_documentorevisao
//   dgt_estadofluxojson → estado completo (etapa, valores, histórico)
//   dgt_etapaatual / dgt_situacaofluxo / dgt_fluxo → para consulta
//
// A gravação usa a ETag da revisão: se outra pessoa avançou a mesma
// revisão ao mesmo tempo, a segunda gravação é recusada (erro
// CONFLITO) e a tela pede para recarregar.
//
// Depois de gravar o estado, o repositório replica:
//   - cada pendência nova/concluída em dgt_tarefafluxo
//   - cada passo novo do histórico em dgt_historicofluxo
// Essas tabelas servem para "Minhas pendências", auditoria, Power
// Automate e Power BI.
// ============================================================

interface IEstadoLido {
  instancia: IFluxoInstancia;
  etag: string;
}

const limitar = (
  valor: string,
  tamanho: number
): string =>
  (valor || '').length > tamanho
    ? `${valor.slice(0, tamanho - 1)}…`
    : (valor || '');

export class FluxoRepositorioDataverse
  implements IFluxoRepositorio {

  public readonly local: boolean =
    false;

  private readonly dataverse:
    DataverseService;

  // Último estado lido/gravado de cada revisão (para a ETag e para
  // saber o que é novo no histórico e nas pendências).
  private readonly cache:
    Record<string, IEstadoLido> = {};

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {

    const id =
      guid(revisaoId);

    const lido =
      await this.dataverse.obterRegistro(
        TABELA_DOCUMENTO_REVISAO,
        id,
        [REVISAO_FLUXO.estadoJson, REVISAO_FLUXO.fluxoValor]
      );

    if (!lido) {
      return undefined;
    }

    const instancia =
      lerJsonSeguro<IFluxoInstancia | undefined>(
        texto(lido.registro, REVISAO_FLUXO.estadoJson),
        undefined
      );

    if (!instancia) {
      delete this.cache[id];
      return undefined;
    }

    this.cache[id] = {
      instancia: JSON.parse(JSON.stringify(instancia)) as IFluxoInstancia,
      etag: lido.etag
    };

    return instancia;
  }

  public async salvar(
    instancia: IFluxoInstancia,
    contexto: IContextoGravacaoFluxo = {}
  ): Promise<string[]> {

    const id =
      guid(instancia.revisaoId);

    const anterior =
      this.cache[id];

    // Primeira gravação desta revisão nesta sessão: confirma que
    // ninguém iniciou o fluxo antes (evita dois inícios simultâneos).
    let etag =
      anterior ? anterior.etag : '';

    if (!anterior) {
      const lido =
        await this.dataverse.obterRegistro(
          TABELA_DOCUMENTO_REVISAO,
          id,
          [REVISAO_FLUXO.estadoJson]
        );

      if (lido && texto(lido.registro, REVISAO_FLUXO.estadoJson)) {
        const erro = new Error(
          'O fluxo desta revisão já foi iniciado por outra pessoa. Recarregue a página.'
        ) as Error & { codigo?: string };
        erro.codigo = 'CONFLITO';
        throw erro;
      }

      etag = lido ? lido.etag : '';
    }

    const dados: Record<string, unknown> = {
      [REVISAO_FLUXO.estadoJson]: JSON.stringify(instancia),
      [REVISAO_FLUXO.etapaAtual]: instancia.status === 'concluido' ? 'fim' : limitar(instancia.elementoAtualId, 100),
      [REVISAO_FLUXO.situacaoFluxo]: instancia.status
    };

    if (contexto.fluxoRegistroId) {
      dados[REVISAO_FLUXO.fluxoBind] =
        await this.dataverse.referenciaLookup(TABELA_FLUXO, contexto.fluxoRegistroId);
    }

    const novaEtag =
      await this.dataverse.atualizarRegistro(
        TABELA_DOCUMENTO_REVISAO,
        id,
        dados,
        etag || undefined
      );

    this.cache[id] = {
      instancia: JSON.parse(JSON.stringify(instancia)) as IFluxoInstancia,
      etag: novaEtag || etag
    };

    // Réplicas auxiliares: falhas viram avisos (o estado já foi gravado).
    const avisos: string[] = [];

    try {
      await this.replicarTarefas(instancia, anterior ? anterior.instancia : undefined, contexto);
    } catch (error) {
      console.error(error);
      avisos.push('As pendências desta etapa não puderam ser registradas em dgt_tarefafluxo.');
    }

    try {
      await this.replicarHistorico(instancia, anterior ? anterior.instancia : undefined, contexto);
    } catch (error) {
      console.error(error);
      avisos.push('O histórico desta ação não pôde ser registrado em dgt_historicofluxo.');
    }

    return avisos;
  }

  public async remover(): Promise<void> {
    throw new Error(
      'No Dataverse o fluxo de uma revisão não pode ser reiniciado: o histórico é preservado.'
    );
  }

  // ----------------------------------------------------------
  // Réplicas
  // ----------------------------------------------------------

  private chaveTarefa(
    instancia: IFluxoInstancia,
    tarefa: IFluxoTarefa
  ): string {
    return `${guid(instancia.revisaoId)}:${tarefa.id}`;
  }

  private async replicarTarefas(
    instancia: IFluxoInstancia,
    anterior: IFluxoInstancia | undefined,
    contexto: IContextoGravacaoFluxo
  ): Promise<void> {

    const anteriores: Record<string, IFluxoTarefa> = {};

    (anterior ? anterior.tarefas : []).forEach(
      tarefa => { anteriores[tarefa.id] = tarefa; }
    );

    for (const tarefa of instancia.tarefas) {

      const antes =
        anteriores[tarefa.id];

      if (!antes) {

        const dados: Record<string, unknown> = {
          [TAREFA.nome]: limitar(`${tarefa.elementoNome} — ${contexto.rotuloRevisao || instancia.revisao}`, 200),
          [TAREFA.chave]: this.chaveTarefa(instancia, tarefa),
          [TAREFA.revisaoBind]: await this.dataverse.referenciaLookup(TABELA_DOCUMENTO_REVISAO, instancia.revisaoId),
          [TAREFA.etapaId]: limitar(tarefa.elementoId, 100),
          [TAREFA.etapaNome]: limitar(tarefa.elementoNome, 200),
          [TAREFA.situacao]: tarefa.status,
          [TAREFA.responsaveisJson]: JSON.stringify(tarefa.responsaveisResolvidos || [])
        };

        if (contexto.fluxoRegistroId) {
          dados[TAREFA.fluxoBind] = await this.dataverse.referenciaLookup(TABELA_FLUXO, contexto.fluxoRegistroId);
        }

        if (tarefa.prazo) {
          dados[TAREFA.prazo] = tarefa.prazo;
        }

        await this.dataverse.criarRegistro(TABELA_TAREFA_FLUXO, dados);
        continue;
      }

      if (antes.status !== tarefa.status) {

        const encontrados =
          await this.dataverse.listarRegistros(
            TABELA_TAREFA_FLUXO,
            `$select=${TAREFA.id}&$filter=${TAREFA.chave} eq '${escaparOData(this.chaveTarefa(instancia, tarefa))}'`
          );

        const dados: Record<string, unknown> = {
          [TAREFA.situacao]: tarefa.status
        };

        if (tarefa.concluidaEm) {
          dados[TAREFA.concluidaEm] = tarefa.concluidaEm;
        }

        const ultimo =
          instancia.historico.find(item => item.elementoId === tarefa.elementoId && !item.sistema);

        if (ultimo) {
          dados[TAREFA.acaoRotulo] = limitar(ultimo.acaoRotulo, 200);

          if (/^[0-9a-f-]{36}$/i.test(guid(ultimo.executadoPorId))) {
            dados[TAREFA.concluidaPorBind] = await this.dataverse.referenciaLookup(TABELA_USUARIO, ultimo.executadoPorId);
          }
        }

        for (const encontrado of encontrados) {
          await this.dataverse.atualizarRegistro(
            TABELA_TAREFA_FLUXO,
            guid(encontrado[TAREFA.id]),
            dados
          );
        }
      }
    }
  }

  private async replicarHistorico(
    instancia: IFluxoInstancia,
    anterior: IFluxoInstancia | undefined,
    contexto: IContextoGravacaoFluxo
  ): Promise<void> {

    const conhecidos =
      (anterior ? anterior.historico : []).map(item => item.id);

    // O histórico fica do mais novo para o mais antigo; grava na
    // ordem em que aconteceu.
    const novos: IFluxoHistorico[] =
      instancia.historico
        .filter(item => conhecidos.indexOf(item.id) < 0)
        .reverse();

    for (const item of novos) {

      const dados: Record<string, unknown> = {
        [HISTORICO.nome]: limitar(`${item.acaoRotulo} — ${item.elementoNome}`, 200),
        [HISTORICO.chave]: `${guid(instancia.revisaoId)}:${item.id}`,
        [HISTORICO.revisaoBind]: await this.dataverse.referenciaLookup(TABELA_DOCUMENTO_REVISAO, instancia.revisaoId),
        [HISTORICO.etapaId]: limitar(item.elementoId, 100),
        [HISTORICO.etapaNome]: limitar(item.elementoNome, 200),
        [HISTORICO.acaoChave]: limitar(item.acaoChave, 100),
        [HISTORICO.acaoRotulo]: limitar(item.acaoRotulo, 200),
        [HISTORICO.resultado]: limitar(item.resultado, 100),
        [HISTORICO.comentario]: limitar(item.comentario || '', 10000),
        [HISTORICO.executadoPorNome]: limitar(item.executadoPorNome, 200),
        [HISTORICO.sistema]: item.sistema,
        [HISTORICO.dataEvento]: item.data
      };

      if (contexto.fluxoRegistroId) {
        dados[HISTORICO.fluxoBind] = await this.dataverse.referenciaLookup(TABELA_FLUXO, contexto.fluxoRegistroId);
      }

      if (!item.sistema && /^[0-9a-f-]{36}$/i.test(guid(item.executadoPorId))) {
        dados[HISTORICO.executadoPorBind] = await this.dataverse.referenciaLookup(TABELA_USUARIO, item.executadoPorId);
      }

      await this.dataverse.criarRegistro(TABELA_HISTORICO_FLUXO, dados);
    }
  }
}
