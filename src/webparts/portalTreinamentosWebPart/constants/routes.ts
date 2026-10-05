export type Pagina =
  | 'inicio'
  | 'treinamentosVisaoGeral'
  | 'treinamentos'
  | 'documentos'
  | 'novoDocumento'
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
  | 'gestaoAreas'
  | 'trilhas'
  | 'equipe'
  | 'executarTreinamento'
  | 'executarModulo'
  | 'avaliacao'
  | 'indicadores'
  | 'gestaoConformidade'
  | 'catalogoTreinamentos'
  | 'testeTreinamento'
  | 'processos'

  // Módulo Licitações (PNCP)
  | 'licitacoes'
  | 'licitacoesTeste'
  // Conta do usuário (menu do nome, no topo)
  | 'meuPerfil'
  | 'usuariosAcessos';

export const ROTAS = {
  INICIO: 'inicio',
  TREINAMENTOS_VISAO_GERAL: 'treinamentosVisaoGeral',
  TREINAMENTOS: 'treinamentos',
  DOCUMENTOS: 'documentos',
  NOVO_DOCUMENTO: 'novoDocumento',
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
  GESTAO_AREAS: 'gestaoAreas',
  TRILHAS: 'trilhas',
  EQUIPE: 'equipe',
  EXECUTAR_TREINAMENTO: 'executarTreinamento',
  EXECUTAR_MODULO: 'executarModulo',
  AVALIACAO: 'avaliacao',
  INDICADORES: 'indicadores',
  GESTAO_CONFORMIDADE: 'gestaoConformidade',
  CATALOGO_TREINAMENTOS: 'catalogoTreinamentos',
  TESTE_TREINAMENTO: 'testeTreinamento',
  PROCESSOS: 'processos',
  LICITACOES: 'licitacoes',
  LICITACOES_TESTE: 'licitacoesTeste',
  MEU_PERFIL: 'meuPerfil',
  USUARIOS_ACESSOS: 'usuariosAcessos',
} as const;



