// ============================================================
// ARMAZENAMENTO LOCAL (modo de teste)
//
// Lê e grava JSON no localStorage do navegador. Se o navegador
// bloquear o localStorage, usa memória (o dado dura só enquanto a
// página estiver aberta).
//
// Usado APENAS pelas funcionalidades em teste. Nada aqui chega ao
// Dataverse.
// ============================================================

export const PREFIXO_ARMAZENAMENTO_TESTE =
  'dgt-portal:teste:';

const memoria: Record<string, string> = {};

export const lerTexto = (
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

export const gravarTexto = (
  chave: string,
  valor: string
): void => {

  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    memoria[chave] = valor;
  }
};

export const removerChave = (
  chave: string
): void => {

  try {
    window.localStorage.removeItem(chave);
  } catch {
    // ignora
  }

  delete memoria[chave];
};

export const lerJson = <T>(
  chave: string,
  padrao: T
): T => {

  const bruto =
    lerTexto(chave);

  if (!bruto) {
    return padrao;
  }

  try {
    return JSON.parse(bruto) as T;
  } catch {
    // Conteúdo corrompido: descarta.
    removerChave(chave);
    return padrao;
  }
};

export const gravarJson = (
  chave: string,
  valor: unknown
): void => {

  gravarTexto(
    chave,
    JSON.stringify(valor)
  );
};

export const gerarIdLocal = (
  prefixo: string
): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
