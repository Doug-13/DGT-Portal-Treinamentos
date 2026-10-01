import {
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  IFluxoCatalogo
} from './FluxoCatalogoLocal';

import {
  aplicarMetadadosNaDefinicao,
  obterMetadadosProcesso
} from '../processos/MetadadosProcessoService';

import {
  executarAcao,
  IDadosInicioFluxo,
  IExecucaoAcao,
  iniciarInstancia,
  IResultadoExecucao
} from './FluxoEngine';

import {
  IFluxoRepositorio
} from './FluxoRepositorioLocal';

// ============================================================
// SERVIÇO DO FLUXO DE REVISÃO
//
// Junta as três peças:
//   catálogo (fluxo do processo) + motor (regras) + repositório
//
// Regra: o fluxo pertence ao PROCESSO. O documento é vinculado a
// um processo e a revisão usa a versão PUBLICADA do fluxo desse
// processo no momento em que começa — e fica nela até o fim.
//
// Hoje: catálogo e repositório no navegador (modo de teste).
// Futuro: dgt_fluxo no Dataverse + motor na Custom API.
// ============================================================

export class FluxoService {

  private readonly repositorio:
    IFluxoRepositorio;

  private readonly catalogo:
    IFluxoCatalogo;

  public constructor(
    repositorio: IFluxoRepositorio,
    catalogo: IFluxoCatalogo
  ) {
    this.repositorio = repositorio;
    this.catalogo = catalogo;
  }

  public get gravaApenasLocalmente(): boolean {
    return this.repositorio.local && this.catalogo.local;
  }

  // Definição EXATA (id + versão) com que a revisão começou.
  // Os metadados (rótulos, tipos, colunas e ORDEM) vêm do processo.
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
      ? aplicarMetadadosNaDefinicao(definicao, obterMetadadosProcesso(processoId))
      : definicao;
  }

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {

    return this.repositorio.obter(revisaoId);
  }

  // Inicia o fluxo da revisão com a versão publicada do processo.
  // Se a revisão já tem fluxo, devolve o existente (não reinicia).
  public async iniciar(
    processo: IProcesso,
    dados: IDadosInicioFluxo
  ): Promise<IResultadoExecucao> {

    const existente =
      await this.repositorio.obter(dados.revisaoId);

    if (existente) {
      return {
        ok: true,
        erros: [],
        instancia: existente,
        acoesSistema: []
      };
    }

    const definicao =
      await this.catalogo.versaoPublicada(processo.id);

    if (!definicao) {
      return {
        ok: false,
        erros: [
          `O processo "${processo.nome}" ainda não tem fluxo publicado.`
        ],
        acoesSistema: []
      };
    }

    const resultado =
      iniciarInstancia(
        definicao,
        {
          ...dados,
          simulado: this.repositorio.local
        }
      );

    if (
      resultado.ok &&
      resultado.instancia
    ) {
      resultado.instancia.processoId =
        processo.id;

      resultado.instancia.processoNome =
        processo.nome;

      await this.repositorio.salvar(
        resultado.instancia
      );
    }

    return resultado;
  }

  public async executar(
    revisaoId: string,
    execucao: IExecucaoAcao
  ): Promise<IResultadoExecucao> {

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
        erros: [
          `A versão ${instancia.fluxoVersao} do fluxo usada por esta revisão não foi encontrada.`
        ],
        acoesSistema: []
      };
    }

    const resultado =
      executarAcao(
        definicao,
        instancia,
        execucao
      );

    if (
      resultado.ok &&
      resultado.instancia
    ) {
      await this.repositorio.salvar(
        resultado.instancia
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
