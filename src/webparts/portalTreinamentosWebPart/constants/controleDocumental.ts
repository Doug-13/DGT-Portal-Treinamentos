// ============================================================
// CONTROLE DOCUMENTAL DOS TREINAMENTOS
//
// Cada treinamento é controlado por um DOCUMENTO DE CONTROLE
// (dgt_documento) com:
//   • o MESMO código do treinamento (ex.: PRO-TRN-007);
//   • o tipo TRN (dgt_documento.dgt_tipo);
//   • vínculo ao processo de treinamentos (ex.: TRE-001), cujo fluxo
//     publicado define etapas, responsáveis, prazos e a decisão de
//     retreinamento;
//   • vínculo em dgt_treinamentodocumento (o plugin
//     ProcessarRevisaoDocumentoPlugin usa esse vínculo para gerar os
//     retreinamentos quando a revisão exige).
//
// O treinamento só fica ATIVO depois que a primeira revisão do
// documento de controle é publicada pelo fluxo.
//
// Pré-requisito no Dataverse:
//   scripts/dataverse/criar-tipo-documento-treinamento.ps1
//   (cria a opção TRN em dgt_documento.dgt_tipo).
// ============================================================

export const CONTROLE_DOCUMENTAL = {

  // Liga/desliga. Com false o portal volta ao comportamento antigo
  // (revisão direta do treinamento, sem fluxo).
  HABILITADO: true,

  // Código do processo cujo fluxo os treinamentos seguem.
  // Se não for encontrado, usa o primeiro processo cujo nome
  // contenha "treinamento".
  PROCESSO_CODIGO: 'TRE-001',

  // Rótulo da opção em dgt_documento.dgt_tipo.
  TIPO_DOCUMENTO: 'TRN',

  // Revisão em que o documento de controle nasce.
  REVISAO_INICIAL: 'Rev.00A',

  // Ordem do vínculo treinamento × documento (dgt_ordem aceita de
  // 1 a 10000). Usa o máximo para ficar depois dos documentos de
  // conteúdo (POP, IT…) nas listas administrativas.
  ORDEM_VINCULO: 10000,

  // Texto gravado no vínculo treinamento × documento (auditoria).
  // Também identifica o vínculo de controle, que não aparece na lista
  // de documentos do treinamento para o colaborador.
  OBSERVACAO_VINCULO:
    'Documento de controle do treinamento (gerado automaticamente pelo portal).'
};

export const controleDocumentalHabilitado = (): boolean =>
  CONTROLE_DOCUMENTAL.HABILITADO === true;
