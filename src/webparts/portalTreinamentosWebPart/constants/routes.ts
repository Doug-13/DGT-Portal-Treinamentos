export type Pagina =
  | 'inicio'
  | 'treinamentos'
  | 'documentos'
  | 'historico'
  | 'certificados'
  | 'suporte'
  | 'gestao'
  | 'novoTreinamento'
  | 'atribuirTreinamento'
  | 'trilhas'
  | 'equipe'
  | 'executarTreinamento'
  | 'avaliacao';

export const ROTAS = {
  INICIO: 'inicio',
  TREINAMENTOS: 'treinamentos',
  DOCUMENTOS: 'documentos',
  HISTORICO: 'historico',
  CERTIFICADOS: 'certificados',
  SUPORTE: 'suporte',
  GESTAO: 'gestao',
  NOVO_TREINAMENTO: 'novoTreinamento',
  ATRIBUIR_TREINAMENTO: 'atribuirTreinamento',
  TRILHAS: 'trilhas',
  EQUIPE: 'equipe',
  EXECUTAR_TREINAMENTO: 'executarTreinamento',
  AVALIACAO: 'avaliacao'
} as const;
