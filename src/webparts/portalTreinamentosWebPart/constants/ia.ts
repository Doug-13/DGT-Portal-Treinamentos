// ============================================================
// IA (Claude) — configuração do portal
//
// A chamada ao Claude é feita pelo plugin do Dataverse
// AnalisarLicitacaoIaPlugin (Custom API dgt_AnalisarLicitacaoIa).
// A CHAVE da Anthropic fica SOMENTE na "Configuração segura" do
// passo do plugin (Plugin Registration Tool) — nunca no portal,
// no código ou no Git.
// ============================================================

// Modelo sugerido ao configurar o prompt (Licitações › Configurar IA).
export const IA_MODELO_PADRAO = 'claude-sonnet-5-5';

// Nome da Custom API no Dataverse.
export const IA_CUSTOM_API = 'dgt_AnalisarLicitacaoIa';
