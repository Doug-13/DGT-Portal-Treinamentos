// ============================================================
// PLANEJAMENTO ORÇAMENTÁRIO — ESQUEMA NO DATAVERSE
//
// Nomes das tabelas/colunas criados pelo script
// scripts/dataverse/criar-tabelas-orcamento.ps1. Os dois DEVEM
// continuar iguais.
//
// Modelo:
//   dgt_orcamentoplanilha  → UMA planilha por ÁREA e ANO, compartilhada
//                            pelos gestores da área (gestor de 2 áreas
//                            = 2 planilhas). Fica com a EQUIPE da área
//                            como proprietária (ver sincronizar-
//                            equipes-orcamento.ps1). Sem área ("Geral")
//                            = uma por pessoa.
//   dgt_orcamentolinha     → cada linha (conta) da planilha, com os
//                            valores de janeiro a dezembro
//   dgt_orcamentoevento    → histórico da planilha (enviada,
//                            devolvida para ajuste + motivo...)
//   dgt_orcamentoalteracao → log de alterações linha a linha
//                            (valor anterior → novo, quem, quando)
//   dgt_orcamentoregra     → regras de cálculo (ex.: PIS = 1,65% da
//                            Receita bruta), editáveis pelo Admin
//   dgt_orcamentoconfigarea→ grupos de contas que cada área preenche
//
// Ciclo da planilha:
//   Em preenchimento → (gestor envia) → Enviada
//   Enviada → (Administrador devolve, com motivo) → Devolvida para ajuste
//   Devolvida para ajuste → (gestor ajusta e reenvia) → Enviada
//   (prazo para o ajuste: PRAZO_AJUSTE_DIAS_UTEIS dias úteis)
//
// Regras de histórico:
//   • linha removida pelo gestor é DESATIVADA (dgt_ativo = Não),
//     nunca excluída;
//   • código, conta e grupo são gravados como texto, então mudar o
//     plano de contas não altera o que já foi lançado.
// ============================================================

export const TABELAS_ORCAMENTO = {
  planilha: 'dgt_orcamentoplanilha',
  linha: 'dgt_orcamentolinha',
  evento: 'dgt_orcamentoevento',
  alteracao: 'dgt_orcamentoalteracao',
  regra: 'dgt_orcamentoregra',
  configArea: 'dgt_orcamentoconfigarea'
};

export const PLANILHA = {
  id: 'dgt_orcamentoplanilhaid',
  nome: 'dgt_name',
  ano: 'dgt_ano',
  gestor: 'dgt_gestor',
  gestorValor: '_dgt_gestor_value',
  gestorNome: 'dgt_gestornome',
  // Área da planilha (pesquisa) + nome gravado como texto.
  area: 'dgt_area',
  areaValor: '_dgt_area_value',
  areas: 'dgt_areas',
  status: 'dgt_status',
  dataEnvio: 'dgt_dataenvio',
  observacao: 'dgt_observacao',
  // Última devolução (o gestor lê daqui o motivo; o histórico
  // completo fica em dgt_orcamentoevento).
  motivoDevolucao: 'dgt_motivodevolucao',
  dataDevolucao: 'dgt_datadevolucao',
  devolvidoPor: 'dgt_devolvidopor',
  prazoAjuste: 'dgt_prazoajuste',
  // Fluxo de aprovação (processo CONT-001): estado completo em JSON
  // (etapa, tarefas, prazos, histórico) + resumo para as listas.
  fluxoEstado: 'dgt_fluxoestado',
  etapaAtual: 'dgt_etapaatual',
  prazoEtapa: 'dgt_prazoetapa',
  // Equipe proprietária (null quando o dono é um usuário).
  equipeValor: '_owningteam_value',
  ativo: 'dgt_ativo',
  criadoEm: 'createdon',
  alteradoEm: 'modifiedon'
};

export const EVENTO = {
  id: 'dgt_orcamentoeventoid',
  nome: 'dgt_name',
  planilhaValor: '_dgt_planilha_value',
  tipo: 'dgt_tipo',
  motivo: 'dgt_motivo',
  usuarioNome: 'dgt_usuarionome',
  criadoEm: 'createdon'
};

export const ALTERACAO = {
  id: 'dgt_orcamentoalteracaoid',
  nome: 'dgt_name',
  planilhaValor: '_dgt_planilha_value',
  linhaId: 'dgt_linhaid',
  grupo: 'dgt_grupo',
  codigo: 'dgt_codigo',
  conta: 'dgt_conta',
  tipo: 'dgt_tipo',
  origem: 'dgt_origem',
  detalhes: 'dgt_detalhes',
  resumo: 'dgt_resumo',
  usuarioNome: 'dgt_usuarionome',
  criadoEm: 'createdon'
};

export type TipoAlteracao = 'Inclusão' | 'Alteração' | 'Remoção';
export type OrigemAlteracao = 'Gestor' | 'Cálculo automático';

export const REGRA = {
  id: 'dgt_orcamentoregraid',
  nome: 'dgt_name',
  contaDestino: 'dgt_contadestino',
  contaDestinoNome: 'dgt_contadestinonome',
  tipoBase: 'dgt_tipobase',
  base: 'dgt_base',
  percentual: 'dgt_percentual',
  ordem: 'dgt_ordem',
  ativo: 'dgt_ativo',
  alteradoEm: 'modifiedon'
};

export type TipoBaseRegra = 'Grupo' | 'Contas';

export const CONFIG_AREA = {
  id: 'dgt_orcamentoconfigareaid',
  nome: 'dgt_name',
  areaValor: '_dgt_area_value',
  areaNome: 'dgt_areanome',
  grupos: 'dgt_grupos',
  // Equipe (owner team) da área, criada pelo script de sincronização.
  equipeId: 'dgt_equipeid',
  ativo: 'dgt_ativo',
  alteradoEm: 'modifiedon'
};

// Proprietário de um registro (para gravar na equipe da área).
export const BIND_PROPRIETARIO = 'ownerid@odata.bind';

// 'Enviada' e 'Devolvida para ajuste' (modo simples) ou o nome da
// etapa/ação do fluxo de aprovação (ex.: "Avaliação Controladoria:
// Aprovado").
export type TipoEventoOrcamento = string;

export const LINHA = {
  id: 'dgt_orcamentolinhaid',
  nome: 'dgt_name',
  planilha: 'dgt_planilha',
  planilhaValor: '_dgt_planilha_value',
  cenario: 'dgt_cenario',
  grupo: 'dgt_grupo',
  codigo: 'dgt_codigo',
  conta: 'dgt_conta',
  descricao: 'dgt_descricao',
  ordem: 'dgt_ordem',
  ativo: 'dgt_ativo',
  meses: [
    'dgt_jan',
    'dgt_fev',
    'dgt_mar',
    'dgt_abr',
    'dgt_mai',
    'dgt_jun',
    'dgt_jul',
    'dgt_ago',
    'dgt_set',
    'dgt_out',
    'dgt_nov',
    'dgt_dez'
  ]
};

// Nome de navegação de cada pesquisa (para gravar com @odata.bind).
// É o SchemaName da coluna de pesquisa criada pelo script.
export const BIND_ORCAMENTO = {
  planilhaGestor: 'dgt_Gestor@odata.bind',
  linhaPlanilha: 'dgt_Planilha@odata.bind',
  eventoPlanilha: 'dgt_Planilha@odata.bind',
  planilhaArea: 'dgt_Area@odata.bind',
  alteracaoPlanilha: 'dgt_Planilha@odata.bind',
  configArea: 'dgt_Area@odata.bind'
};

export const NOMES_MESES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez'
];

// Com o fluxo de aprovação (CONT-001):
//   Em preenchimento → Em aprovação (etapas de avaliação) → Aprovada
//   Reprovação em qualquer avaliação → Devolvida para ajuste.
// Sem o fluxo (processo não encontrado) vale o modo simples:
//   Em preenchimento → Enviada → (Administrador) Devolvida para ajuste.
export type StatusPlanilha =
  | 'Em preenchimento'
  | 'Enviada'
  | 'Em aprovação'
  | 'Aprovada'
  | 'Devolvida para ajuste';

export const STATUS_PLANILHA: {
  emPreenchimento: StatusPlanilha;
  enviada: StatusPlanilha;
  emAprovacao: StatusPlanilha;
  aprovada: StatusPlanilha;
  devolvida: StatusPlanilha;
} = {
  emPreenchimento: 'Em preenchimento',
  enviada: 'Enviada',
  emAprovacao: 'Em aprovação',
  aprovada: 'Aprovada',
  devolvida: 'Devolvida para ajuste'
};

// Planilha que o gestor pode editar (preenchimento ou ajuste).
export const statusEditavel = (status: StatusPlanilha): boolean =>
  status === 'Em preenchimento' || status === 'Devolvida para ajuste';

// Planilha já entregue pelo gestor (aguardando, em análise ou aprovada).
export const statusEntregue = (status: StatusPlanilha): boolean =>
  status === 'Enviada' || status === 'Em aprovação' || status === 'Aprovada';

// Processo cujo fluxo publicado governa a aprovação do orçamento
// (Processos → CONT-001). Sem ele, o portal usa o modo simples.
export const PROCESSO_ORCAMENTO = {
  CODIGO: 'CONT-001',
  // Plano B: primeiro processo ativo cujo nome contenha este texto.
  NOME_CONTEM: 'orcament'
};

// Tamanho mínimo do motivo da devolução (evita "ajustar", "ver").
export const MOTIVO_DEVOLUCAO_MINIMO = 10;

// Prazo do gestor para ajustar e reenviar a planilha devolvida.
export const PRAZO_AJUSTE_DIAS_UTEIS = 2;

// Chave da "área" de quem não tem área vinculada (ex.: perfil global
// Gestor sem papel por área): a planilha fica sem área (Geral).
export const AREA_GERAL = { id: '', nome: 'Geral (sem área)' };

export const CENARIO_ORCADO = 'Orçado';

// Ano sugerido ao abrir a tela: o próximo ano (o orçamento é
// preenchido no ano anterior ao de execução).
export const anoPadraoOrcamento = (): number =>
  new Date().getFullYear() + 1;
