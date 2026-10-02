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

// Informações extras para gravar no Dataverse (o modo local ignora).
export interface IContextoGravacaoFluxo {
  // Id do registro da versão do fluxo (dgt_fluxo).
  fluxoRegistroId?: string;

  // Texto curto da revisão (ex.: "POP-001 Rev.04"), usado nos nomes
  // das pendências e do histórico.
  rotuloRevisao?: string;

  // Status do documento na etapa atual (Elaboração/Revisão/Aprovação).
  statusDocumento?: string;
}

export interface IFluxoRepositorio {

  // true = grava apenas no navegador (modo de teste).
  readonly local: boolean;

  obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined>;

  // Devolve avisos não bloqueantes (ex.: falha ao gravar o histórico
  // auxiliar), quando houver.
  salvar(
    instancia: IFluxoInstancia,
    contexto?: IContextoGravacaoFluxo
  ): Promise<string[]>;

  remover(
    revisaoId: string
  ): Promise<void>;

  // Depois das tarefas automáticas (renumerar, publicar), que alteram
  // a própria revisão, atualiza a versão (ETag) guardada para que a
  // gravação do estado do fluxo não seja recusada como conflito.
  renovarVersao?(
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
  ): Promise<string[]> {

    gravarJson(
      PREFIXO_CHAVE + instancia.revisaoId,
      instancia
    );

    return [];
  }

  public async remover(
    revisaoId: string
  ): Promise<void> {

    removerChave(
      PREFIXO_CHAVE + revisaoId
    );
  }
}
