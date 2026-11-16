// ============================================================
// FEATURE FLAGS
//
// Liga/desliga funcionalidades sem remover código. Depois de
// alterar, gere o pacote novamente.
// ============================================================

// Onde o fluxo configurável grava os dados:
//
//   'dataverse' → produção. Processos, metadados, fluxos, estado das
//                 revisões, pendências e histórico ficam no Dataverse
//                 (tabelas dgt_fluxo, dgt_processometadado,
//                 dgt_tarefafluxo, dgt_historicofluxo e colunas novas).
//                 Exige que as tabelas tenham sido criadas
//                 (scripts/dataverse/criar-tabelas-fluxo.ps1).
//
//   'local'     → modo de teste. Tudo fica no navegador de quem testa
//                 (localStorage), com usuários simulados.
export type ModoPersistenciaFluxo =
  | 'dataverse'
  | 'local';

export const FEATURE_FLAGS: {
  FLUXO_CONFIGURAVEL_TESTE: boolean;
  FLUXO_PERSISTENCIA: ModoPersistenciaFluxo;
  CABECALHO_BUSCA_GLOBAL: boolean;
  CABECALHO_ATALHOS_SEM_ACAO: boolean;
} = {

  // Liga o módulo Processos, o editor de fluxo e a aba "Fluxo" do
  // documento. Com false, o portal volta ao fluxo fixo antigo.
  // (O nome foi mantido por compatibilidade.)
  FLUXO_CONFIGURAVEL_TESTE: true,

  FLUXO_PERSISTENCIA: 'dataverse',

  // Campo "Pesquisar..." do cabeçalho. Ainda não pesquisa nada (não tem
  // ação ligada); fica oculto para não prometer uma busca que não existe.
  // Ligue (true) quando a busca global for implementada.
  CABECALHO_BUSCA_GLOBAL: false,

  // Botões "Notificações" e "Aplicativos" do cabeçalho. Ainda não têm
  // ação (os avisos já aparecem no canto da tela e em "Aguardando você").
  // Ligue (true) quando ganharem comportamento.
  CABECALHO_ATALHOS_SEM_ACAO: false
};

export const fluxoNoDataverse = (): boolean =>
  FEATURE_FLAGS.FLUXO_PERSISTENCIA === 'dataverse';
