import {
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  lerJson,
  gravarJson,
  removerChave
} from '../../utils/armazenamentoLocal';

// ============================================================
// REPOSITÓRIO DO ESTADO DO FLUXO (instâncias por revisão)
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

// Mantido igual à versão anterior para não perder simulações já
// iniciadas.
const PREFIXO_CHAVE =
  'dgt-portal:fluxo-teste:';

export class FluxoRepositorioLocal
  implements IFluxoRepositorio {

  public readonly local: boolean =
    true;

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {

    return lerJson<IFluxoInstancia | undefined>(
      PREFIXO_CHAVE + revisaoId,
      undefined
    );
  }

  public async salvar(
    instancia: IFluxoInstancia
  ): Promise<void> {

    gravarJson(
      PREFIXO_CHAVE + instancia.revisaoId,
      instancia
    );
  }

  public async remover(
    revisaoId: string
  ): Promise<void> {

    removerChave(
      PREFIXO_CHAVE + revisaoId
    );
  }
}
