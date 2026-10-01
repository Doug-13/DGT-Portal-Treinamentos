import {
  IFluxoInstancia
} from '../../models/Fluxo';

// ============================================================
// REPOSITÓRIO DO ESTADO DO FLUXO
//
// IFluxoRepositorio é o "contrato" de onde o estado do fluxo é
// lido e gravado. Nesta fase existe só a implementação LOCAL
// (localStorage do navegador). Quando as tabelas forem criadas,
// basta escrever um FluxoRepositorioDataverse com os mesmos
// métodos — telas, hook e motor não mudam.
//
// Os métodos já são assíncronos (Promise) para que a troca pelo
// Dataverse não exija reescrever quem os chama.
// ============================================================

export interface IFluxoRepositorio {

  // true = grava apenas no navegador (modo de teste).
  readonly local: boolean;

  obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined>;

  salvar(
    instancia: IFluxoInstancia
  ): Promise<void>;

  remover(
    revisaoId: string
  ): Promise<void>;
}

const PREFIXO_CHAVE =
  'dgt-portal:fluxo-teste:';

// Usado quando o navegador bloqueia o localStorage (ex.: modo
// privado com restrições). O estado dura só enquanto a página
// estiver aberta.
const memoria: Record<string, string> = {};

const lerArmazenamento = (
  chave: string
): string | undefined => {

  try {
    const valor =
      window.localStorage.getItem(chave);

    return valor === null
      ? undefined
      : valor;
  } catch {
    return memoria[chave];
  }
};

const gravarArmazenamento = (
  chave: string,
  valor: string
): void => {

  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    memoria[chave] = valor;
  }
};

const removerArmazenamento = (
  chave: string
): void => {

  try {
    window.localStorage.removeItem(chave);
  } catch {
    // ignora
  }

  delete memoria[chave];
};

export class FluxoRepositorioLocal
  implements IFluxoRepositorio {

  public readonly local: boolean =
    true;

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {

    const bruto =
      lerArmazenamento(
        PREFIXO_CHAVE + revisaoId
      );

    if (!bruto) {
      return undefined;
    }

    try {
      return JSON.parse(bruto) as IFluxoInstancia;
    } catch {
      // Conteúdo corrompido: descarta e recomeça a simulação.
      removerArmazenamento(
        PREFIXO_CHAVE + revisaoId
      );

      return undefined;
    }
  }

  public async salvar(
    instancia: IFluxoInstancia
  ): Promise<void> {

    gravarArmazenamento(
      PREFIXO_CHAVE + instancia.revisaoId,
      JSON.stringify(instancia)
    );
  }

  public async remover(
    revisaoId: string
  ): Promise<void> {

    removerArmazenamento(
      PREFIXO_CHAVE + revisaoId
    );
  }
}
