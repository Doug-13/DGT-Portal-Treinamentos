// ============================================================
// KITS (catálogo do montador de B.O.M.) — ESQUEMA NO DATAVERSE
//
// Tabelas e colunas criadas por scripts/dataverse/criar-tabelas-kits.ps1.
// Os dois DEVEM continuar iguais.
//
//   dgt_kititem        Itens e equipamentos (código CIGAM, descrição,
//                      categoria, tipo e atributos técnicos)
//   dgt_kitkit         Parâmetros de cada kit (máx. câmeras, OCR...)
//   dgt_kitcomposicao  Linhas do kit-base (item × quantidade × regra)
//   dgt_kitalteracao   Histórico de alterações (nunca é apagado)
//
// Regra de histórico: nada é excluído. Item ou linha retirada é
// DESATIVADA (dgt_ativo = Não) e a alteração fica registrada.
// ============================================================

export const TABELAS_KITS = {
  item: 'dgt_kititem',
  kit: 'dgt_kitkit',
  composicao: 'dgt_kitcomposicao',
  alteracao: 'dgt_kitalteracao'
};

export const COL_ITEM = {
  id: 'dgt_kititemid',
  descricao: 'dgt_name',
  chave: 'dgt_chave',
  codigo: 'dgt_codigo',
  categoria: 'dgt_categoria',
  tipo: 'dgt_tipo',
  atributos: 'dgt_atributos',
  situacao: 'dgt_situacao',
  observacao: 'dgt_observacao',
  ordem: 'dgt_ordem',
  ativo: 'dgt_ativo'
};

export const COL_KIT = {
  id: 'dgt_kitkitid',
  nome: 'dgt_name',
  chave: 'dgt_chave',
  codigoCigam: 'dgt_codigocigam',
  maxCameras: 'dgt_maxcameras',
  aceitaOcr: 'dgt_aceitaocr',
  sinalizacao: 'dgt_sinalizacao',
  descricao: 'dgt_descricao',
  ativo: 'dgt_ativo'
};

export const COL_COMPOSICAO = {
  id: 'dgt_kitcomposicaoid',
  nome: 'dgt_name',
  kit: 'dgt_kit',
  itemChave: 'dgt_itemchave',
  quantidade: 'dgt_quantidade',
  regra: 'dgt_regra',
  condicao: 'dgt_condicao',
  ordem: 'dgt_ordem',
  observacao: 'dgt_observacao',
  ativo: 'dgt_ativo'
};

export const COL_ALTERACAO = {
  id: 'dgt_kitalteracaoid',
  resumo: 'dgt_name',
  entidade: 'dgt_entidade',
  chave: 'dgt_chave',
  acao: 'dgt_acao',
  motivo: 'dgt_motivo',
  detalhes: 'dgt_detalhes',
  usuarioNome: 'dgt_usuarionome'
};

// Tipo do item: decide em que lista do montador ele aparece.
export type TipoItemKit =
  | 'item'
  | 'cameraVideo'
  | 'cameraOcr'
  | 'switch'
  | 'controladorPorta'
  | 'controladorPne';

export const TIPOS_ITEM: Array<{ tipo: TipoItemKit; nome: string; plural: string; ajuda: string }> = [
  { tipo: 'item', nome: 'Item de kit', plural: 'Itens de kit', ajuda: 'Peças, infraestrutura, serviços, licenças e adesivos usados na composição dos kits.' },
  { tipo: 'cameraVideo', nome: 'Câmera de vídeo', plural: 'Câmeras de vídeo', ajuda: 'Aparece na escolha de modelo de videomonitoramento do ponto.' },
  { tipo: 'cameraOcr', nome: 'Câmera OCR/LPR', plural: 'Câmeras OCR/LPR', ajuda: 'Aparece na escolha de modelo de leitura de placas (Safe Way).' },
  { tipo: 'switch', nome: 'Switch', plural: 'Switches', ajuda: 'O montador confere o orçamento PoE e as portas com estes dados.' },
  { tipo: 'controladorPorta', nome: 'Controlador de porta', plural: 'Controladores de porta', ajuda: 'Leitora facial escolhida no ponto de porta.' },
  { tipo: 'controladorPne', nome: 'Controlador PNE', plural: 'Controlador PNE', ajuda: 'Leitora usada nas catracas PNE (2 por catraca). Só um fica em uso.' }
];

export type SituacaoItemKit = 'Homologado' | 'Em homologação' | 'Descontinuado';

export const SITUACOES_ITEM: SituacaoItemKit[] = ['Homologado', 'Em homologação', 'Descontinuado'];

export interface IAtributosItemKit {
  formato?: 'Dome' | 'Bullet';
  zoomOptico?: boolean;
  consumoW?: number;
  poe?: boolean;
  orcamentoW?: number;
  portasPoe?: number;
  padrao?: boolean;
  usoCatraca?: boolean;
}
