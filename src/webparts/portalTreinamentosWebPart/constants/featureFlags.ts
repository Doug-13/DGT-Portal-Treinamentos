// ============================================================
// FEATURE FLAGS
//
// Liga/desliga funcionalidades em teste sem remover código.
// Para esconder uma funcionalidade, troque o valor para false e
// gere o pacote novamente.
// ============================================================

export const FEATURE_FLAGS = {

  // Aba "Fluxo (teste)" no detalhe do documento.
  //
  // Simula o fluxo de revisão configurável (etapas, responsáveis,
  // ações, gateways e histórico) inspirado no NewFlow.
  //
  // IMPORTANTE: nesta fase NADA é gravado no Dataverse. O estado
  // da simulação fica apenas no navegador (localStorage) de quem
  // está testando. O fluxo real (Elaboração → Aprovação → Vigente)
  // continua funcionando normalmente na aba "Revisão".
  FLUXO_CONFIGURAVEL_TESTE: true

} as const;
