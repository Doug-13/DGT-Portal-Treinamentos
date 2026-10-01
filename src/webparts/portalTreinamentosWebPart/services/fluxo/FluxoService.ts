import {
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  FLUXOS_TESTE,
  FLUXO_POP_PROCEDIMENTO_V2
} from './definicoes/fluxoPopProcedimento';

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
// SERVIÇO DO FLUXO
//
// Junta as três peças:
//   definição (qual fluxo)  +  motor (regras)  +  repositório (onde grava)
//
// Hoje: definições fixas no código + repositório local.
// Futuro: definições vindas de dgt_fluxo + repositório Dataverse
//         + motor rodando na Custom API.
// ============================================================

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export class FluxoService {

  private readonly repositorio:
    IFluxoRepositorio;

  private readonly definicoes:
    IFluxoDefinicao[];

  public constructor(
    repositorio: IFluxoRepositorio,
    definicoes: IFluxoDefinicao[] = FLUXOS_TESTE
  ) {
    this.repositorio = repositorio;
    this.definicoes = definicoes;
  }

  public get gravaApenasLocalmente(): boolean {
    return this.repositorio.local;
  }

  // Fluxo padrão para um tipo de documento.
  public definicaoParaTipo(
    tipoDocumento: string
  ): IFluxoDefinicao {

    const tipo =
      normalizar(tipoDocumento);

    const encontrada =
      this.definicoes.find(
        definicao =>
          definicao.status === 'publicado' &&
          definicao.tiposDocumento.some(
            item => normalizar(item) === tipo
          )
      );

    return encontrada || FLUXO_POP_PROCEDIMENTO_V2;
  }

  // Definição EXATA (id + versão) com que a revisão começou.
  public definicaoDaInstancia(
    instancia: IFluxoInstancia
  ): IFluxoDefinicao | undefined {

    return this.definicoes.find(
      definicao =>
        definicao.id === instancia.fluxoId &&
        definicao.versao === instancia.fluxoVersao
    );
  }

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {

    return this.repositorio.obter(revisaoId);
  }

  public async iniciar(
    tipoDocumento: string,
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
      this.definicaoParaTipo(tipoDocumento);

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
      this.definicaoDaInstancia(instancia);

    if (!definicao) {
      return {
        ok: false,
        erros: [
          `A versão ${instancia.fluxoVersao} do fluxo "${instancia.fluxoId}" não está mais disponível.`
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
