import {
  AadHttpClient,
  AadHttpClientFactory
} from '@microsoft/sp-http';

// ============================================================
// CRM — CONEXÃO (token do Entra ID para o ambiente do CRM)
//
// O web part registra aqui a fábrica de clientes AAD ao abrir o
// portal (PortalTreinamentosWebPart.ts). O cliente do CRM só é
// criado quando alguém abre a tela do CRM: se o token do CRM falhar,
// o restante do portal (Treinamentos, Documentos...) não é afetado.
//
// O token é pedido para a URL do ambiente do CRM. A permissão de API
// já aprovada para o portal ("Dynamics CRM" / "Dataverse" →
// user_impersonation) vale para TODOS os ambientes do mesmo tenant:
// não é preciso aprovar outra permissão no SharePoint.
// ============================================================

let fabrica: AadHttpClientFactory | undefined;

const clientes: Record<string, Promise<AadHttpClient>> = {};

export const registrarFabricaCrm = (
  fabricaAad: AadHttpClientFactory
): void => {
  fabrica = fabricaAad;
};

export const conexaoCrmDisponivel = (): boolean =>
  !!fabrica;

export const obterClienteCrm = (
  recurso: string
): Promise<AadHttpClient> => {

  const chave = recurso.replace(/\/$/, '').toLowerCase();

  if (!fabrica) {
    return Promise.reject(
      new Error('A conexão com o CRM não foi inicializada pelo web part.')
    );
  }

  if (!clientes[chave]) {
    clientes[chave] = fabrica
      .getClient(chave)
      .catch((erro: unknown) => {
        // Não guarda a falha: a próxima tentativa pede o token de novo.
        delete clientes[chave];
        throw erro;
      });
  }

  return clientes[chave];
};
