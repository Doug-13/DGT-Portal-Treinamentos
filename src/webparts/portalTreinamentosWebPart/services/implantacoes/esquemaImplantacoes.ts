// ============================================================
// IMPLANTAÇÕES — esquema no Dataverse
//
// O painel guarda os dados como "documentos" (projeto → coleção →
// documento), no mesmo formato da base original (um JSON por
// documento). Uma única tabela guarda todos:
//
//   dgt_implregistro
//     dgt_balde       projeto ("_root" = dados gerais e lista de projetos)
//     dgt_colecao     atividades, faturamentos, config, projetos, agendaCampo...
//     dgt_chave       id do documento dentro da coleção
//     dgt_chaveunica  balde|coleção|chave (chave alternativa: impede duplicar)
//     dgt_dados       o documento em JSON
//     dgt_excluido    exclusão lógica (o portal nunca apaga histórico)
//
// Script: scripts/dataverse/criar-tabelas-implantacoes.ps1
// ============================================================

export const TABELA_IMPL_REGISTRO = 'dgt_implregistro';

export const IMPL = {
  id: 'dgt_implregistroid',
  nome: 'dgt_name',
  balde: 'dgt_balde',
  colecao: 'dgt_colecao',
  chave: 'dgt_chave',
  chaveUnica: 'dgt_chaveunica',
  dados: 'dgt_dados',
  excluido: 'dgt_excluido',
  modificadoEm: 'modifiedon'
};

// Balde dos dados gerais (lista de projetos, equipe, agenda de campo,
// configuração dos e-mails).
export const BALDE_RAIZ = '_root';

// Limite da coluna dgt_dados (Memo). O maior documento da base
// original tinha ~56 mil caracteres.
export const LIMITE_DADOS = 1000000;

export const chaveUnica = (
  balde: string,
  colecao: string,
  chave: string
): string =>
  `${balde}|${colecao}|${chave}`;

// ------------------------------------------------------------
// Fila de e-mails (relatórios do painel)
//
// O portal grava uma linha por e-mail em dgt_implemail com status
// "Pendente"; um fluxo do Power Automate envia e marca "Enviado" ou
// "Falha" (docs/implantacoes.md).
// ------------------------------------------------------------

export const TABELA_IMPL_EMAIL = 'dgt_implemail';

export const IMPL_EMAIL = {
  assunto: 'dgt_name',
  para: 'dgt_para',
  corpo: 'dgt_corpo',
  tipo: 'dgt_tipo',
  motivo: 'dgt_motivo',
  status: 'dgt_status'
};

export const STATUS_EMAIL_PENDENTE = 'Pendente';
