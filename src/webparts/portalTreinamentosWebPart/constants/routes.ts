export type Pagina =
  | 'inicio'
  | 'treinamentos'
  | 'documentos'
  | 'documentoDetalhe'
  | 'historico'
  | 'certificados'
  | 'suporte'
  | 'gestao'
  | 'novoTreinamento'
  | 'atribuirTreinamento'
  | 'gestaoTrilhas'
  | 'gestaoModulos'
  | 'gestaoAvaliacoes'
  | 'gestaoDocumentos'
  | 'trilhas'
  | 'equipe'
  | 'executarTreinamento'
  | 'avaliacao'
  | 'indicadores';

export const ROTAS = {
  INICIO: 'inicio',
  TREINAMENTOS: 'treinamentos',
  DOCUMENTOS: 'documentos',
  DOCUMENTO_DETALHE: 'documentoDetalhe',
  HISTORICO: 'historico',
  CERTIFICADOS: 'certificados',
  SUPORTE: 'suporte',
  GESTAO: 'gestao',
  NOVO_TREINAMENTO: 'novoTreinamento',
  ATRIBUIR_TREINAMENTO: 'atribuirTreinamento',
  GESTAO_TRILHAS: 'gestaoTrilhas',
  GESTAO_MODULOS: 'gestaoModulos',
  GESTAO_AVALIACOES: 'gestaoAvaliacoes',
  GESTAO_DOCUMENTOS: 'gestaoDocumentos',
  TRILHAS: 'trilhas',
  EQUIPE: 'equipe',
  EXECUTAR_TREINAMENTO: 'executarTreinamento',
  AVALIACAO: 'avaliacao',
  INDICADORES: 'indicadores'
} as const;
