// ============================================================
// ABRIR UM REGISTRO DE OUTRO AMBIENTE
//
// Um link em "Documentos relacionados" (ex.: Auditoria → RNC em Não
// Conformidades) troca de ambiente e pede para abrir o registro.
// O pedido fica guardado aqui até a página do ambiente de destino
// carregar a lista e consumi-lo (mesmo padrão de
// solicitarAberturaProcesso).
// ============================================================

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

let pedido: { ambienteChave: string; registroId: string } | undefined;

export const solicitarAberturaRegistro = (
  ambienteChave: string,
  registroId: string
): void => {
  pedido = { ambienteChave, registroId: guid(registroId) };
};

// Devolve o id do registro a abrir neste ambiente (e esquece o pedido).
export const consumirAberturaRegistro = (
  ambienteChave: string
): string | undefined => {
  if (!pedido || pedido.ambienteChave !== ambienteChave) {
    return undefined;
  }
  const id = pedido.registroId;
  pedido = undefined;
  return id;
};
