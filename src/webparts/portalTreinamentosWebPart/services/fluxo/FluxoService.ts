import {
  AcaoSistemaFluxo,
  IFluxoDefinicao,
  IFluxoInstancia,
  IFluxoResponsavel,
  IResponsavelResolvido
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  IFluxoCatalogo
} from './FluxoCatalogoLocal';

import {
  aplicarMetadadosNaDefinicao,
  IMetadadosRepositorio
} from '../processos/MetadadosProcessoService';

import {
  executarAcao,
  IDadosInicioFluxo,
  IExecucaoAcao,
  iniciarInstancia,
  IResultadoExecucao
} from './FluxoEngine';

import {
  IContextoGravacaoFluxo,
  IFluxoRepositorio
} from './FluxoRepositorioLocal';

// ============================================================
// SERVIÇO DO FLUXO DE REVISÃO
//
// Junta: catálogo (fluxo do processo) + metadados do processo +
// motor (regras) + repositório (estado da revisão).
//
// Regra: o fluxo pertence ao PROCESSO. O documento é vinculado a
// um processo e a revisão usa a versão PUBLICADA do fluxo desse
// processo no momento em que começa — e fica nela até o fim.
// ============================================================

export interface IContextoExecucaoFluxo {
  // Converte os responsáveis da etapa em pessoas/áreas reais
  // (gravado na pendência). Sem ele, a pendência fica sem resolução.
  resolverResponsaveis?: (responsaveis: IFluxoResponsavel[]) => IResponsavelResolvido[];

  rotuloRevisao?: string;

  // Executa as tarefas de sistema (ex.: publicar a revisão) ANTES de
  // gravar o novo estado. Se falhar, nada é gravado e a ação volta
  // com o erro — o fluxo não fica "concluído" sem a publicação.
  executarAcoesSistema?: (acoes: AcaoSistemaFluxo[], instancia: IFluxoInstancia) => Promise<void>;
}

export class FluxoService {

  private readonly repositorio:
    IFluxoRepositorio;

  private readonly catalogo:
    IFluxoCatalogo;

  private readonly metadados:
    IMetadadosRepositorio;

  public constructor(
    repositorio: IFluxoRepositorio,
    catalogo: IFluxoCatalogo,
    metadados: IMetadadosRepositorio
  ) {
    this.repositorio = repositorio;
    this.catalogo = catalogo;
    this.metadados = metadados;
  }

  public get gravaApenasLocalmente(): boolean {
    return this.repositorio.local && this.catalogo.local;
  }

  // Definição EXATA (id + versão) com que a revisão começou, com os
  // metadados ATUAIS do processo (rótulos, tipos, colunas e ordem).
  public async definicaoDaInstancia(
    instancia: IFluxoInstancia
  ): Promise<IFluxoDefinicao | undefined> {

    const definicao =
      await this.catalogo.obterVersao(
        instancia.fluxoId,
        instancia.fluxoVersao
      );

    if (!definicao) {
      return undefined;
    }

    const processoId =
      instancia.processoId || definicao.processoId;

    return processoId
      ? aplicarMetadadosNaDefinicao(definicao, await this.metadados.listar(processoId))
      : definicao;
  }

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {
    return this.repositorio.obter(revisaoId);
  }

  private preencherResponsaveis(
    instancia: IFluxoInstancia,
    contexto?: IContextoExecucaoFluxo
  ): void {

    if (!contexto || !contexto.resolverResponsaveis) {
      return;
    }

    instancia.tarefas.forEach(
      tarefa => {
        if (tarefa.status === 'pendente' && !tarefa.responsaveisResolvidos) {
          tarefa.responsaveisResolvidos =
            (contexto.resolverResponsaveis as (responsaveis: IFluxoResponsavel[]) => IResponsavelResolvido[])(tarefa.responsaveis);
        }
      }
    );
  }

  private contextoGravacao(
    definicao: IFluxoDefinicao,
    instancia: IFluxoInstancia,
    contexto?: IContextoExecucaoFluxo
  ): IContextoGravacaoFluxo {

    const etapa =
      definicao.elementos.find(item => item.id === instancia.elementoAtualId);

    return {
      fluxoRegistroId: definicao.registroId,
      rotuloRevisao: contexto ? contexto.rotuloRevisao : undefined,
      statusDocumento: etapa ? etapa.statusDocumento : undefined
    };
  }

  // Inicia o fluxo da revisão com a versão publicada do processo.
  // Se a revisão já tem fluxo, devolve o existente (não reinicia).
  public async iniciar(
    processo: IProcesso,
    dados: IDadosInicioFluxo,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoExecucao> {

    const existente =
      await this.repositorio.obter(dados.revisaoId);

    if (existente) {
      return { ok: true, erros: [], instancia: existente, acoesSistema: [] };
    }

    const publicada =
      await this.catalogo.versaoPublicada(processo.id);

    if (!publicada) {
      return {
        ok: false,
        erros: [`O processo "${processo.nome}" ainda não tem fluxo publicado.`],
        acoesSistema: []
      };
    }

    const definicao =
      aplicarMetadadosNaDefinicao(publicada, await this.metadados.listar(processo.id));

    const resultado =
      iniciarInstancia(
        definicao,
        { ...dados, simulado: this.repositorio.local }
      );

    if (resultado.ok && resultado.instancia) {

      resultado.instancia.processoId = processo.id;
      resultado.instancia.processoNome = processo.nome;

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  public async executar(
    revisaoId: string,
    execucao: IExecucaoAcao,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoExecucao> {

    // Sempre relê antes de agir: se outra pessoa avançou a revisão,
    // a ação é validada contra o estado atual.
    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      return {
        ok: false,
        erros: ['O fluxo desta revisão ainda não foi iniciado.'],
        acoesSistema: []
      };
    }

    const definicao =
      await this.definicaoDaInstancia(instancia);

    if (!definicao) {
      return {
        ok: false,
        erros: [`A versão ${instancia.fluxoVersao} do fluxo usada por esta revisão não foi encontrada.`],
        acoesSistema: []
      };
    }

    const resultado =
      executarAcao(definicao, instancia, execucao);

    if (resultado.ok && resultado.instancia) {

      if (
        resultado.acoesSistema.length > 0 &&
        contexto &&
        contexto.executarAcoesSistema
      ) {
        try {
          await contexto.executarAcoesSistema(resultado.acoesSistema, resultado.instancia);
        } catch (error) {
          console.error(error);
          return {
            ok: false,
            erros: [
              `A ação não foi concluída porque a tarefa automática falhou: ${error instanceof Error ? error.message : String(error)}`
            ],
            acoesSistema: []
          };
        }
      }

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  public async reiniciar(
    revisaoId: string
  ): Promise<void> {
    await this.repositorio.remover(revisaoId);
  }
}
