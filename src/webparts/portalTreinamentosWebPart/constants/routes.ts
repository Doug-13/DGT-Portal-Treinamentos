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
  | 'trilhas'
  | 'equipe'
  | 'executarTreinamento'
  | 'avaliacao';

export const ROTAS = {

  INICIO:
    'inicio',

  TREINAMENTOS:
    'treinamentos',

  DOCUMENTOS:
    'documentos',

  DOCUMENTO_DETALHE:
    'documentoDetalhe',

  HISTORICO:
    'historico',

  CERTIFICADOS:
    'certificados',

  SUPORTE:
    'suporte',

  GESTAO:
    'gestao',

  NOVO_TREINAMENTO:
    'novoTreinamento',

  ATRIBUIR_TREINAMENTO:
    'atribuirTreinamento',

  GESTAO_TRILHAS:
    'gestaoTrilhas',

  TRILHAS:
    'trilhas',

  EQUIPE:
    'equipe',

  EXECUTAR_TREINAMENTO:
    'executarTreinamento',

  AVALIACAO:
    'avaliacao'

} as const;