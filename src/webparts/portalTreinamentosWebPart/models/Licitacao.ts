// ============================================================
// MÓDULO LICITAÇÕES — MODELOS
//
// Port do "Agente de Licitações V6" (Python) para o portal.
// Consulta a API pública do PNCP (Portal Nacional de Contratações
// Públicas) diretamente do navegador.
//
// LGPD / política da organização:
//   Os registros do PNCP trazem o CNPJ do órgão (inclusive dentro
//   do numeroControlePNCP). Esse dado é usado SOMENTE em memória,
//   para remover duplicidades e montar o link do edital.
//   Ele NÃO é exibido na tela, NÃO vai para o relatório impresso
//   e NÃO é gravado no Dataverse nem no navegador.
// ============================================================

export const MODALIDADES_PNCP: {
  [codigo: number]: string;
} = {
  1: 'Leilão - Eletrônico',
  2: 'Diálogo Competitivo',
  3: 'Concurso',
  4: 'Concorrência - Eletrônica',
  5: 'Concorrência - Presencial',
  6: 'Pregão - Eletrônico',
  7: 'Pregão - Presencial',
  8: 'Dispensa de Licitação',
  9: 'Inexigibilidade',
  10: 'Manifestação de Interesse',
  11: 'Pré-qualificação',
  12: 'Credenciamento',
  13: 'Leilão - Presencial'
};

// Mesmos atalhos do menu do script Python.
export interface IPresetModalidades {
  id: string;
  label: string;
  codigos: number[];
}

export const PRESETS_MODALIDADES: IPresetModalidades[] = [
  { id: 'pregao', label: 'Pregão Eletrônico', codigos: [6] },
  { id: 'concorrencia', label: 'Concorrência Eletrônica', codigos: [4] },
  { id: 'dispensa', label: 'Dispensa de Licitação', codigos: [8] },
  { id: 'inexigibilidade', label: 'Inexigibilidade', codigos: [9] },
  { id: 'pregaoConcorrencia', label: 'Pregão + Concorrência', codigos: [6, 4] },
  { id: 'pregaoConcorrenciaDispensa', label: 'Pregão + Concorrência + Dispensa', codigos: [6, 4, 8] },
  { id: 'principais', label: 'Principais modalidades', codigos: [6, 4, 8, 9] },
  { id: 'todas', label: 'Todas as modalidades', codigos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }
];

export const UFS_BRASIL: string[] = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

// 1 = assunto exato · 2 = qualquer palavra · 3 = assunto + relacionadas
export type ModoBuscaAssunto = '1' | '2' | '3';

export interface IFiltrosLicitacao {
  assunto: string;
  uf?: string;
  diasBusca: number;
  modalidades: number[];
  modoBusca: ModoBuscaAssunto;
  palavrasObrigatorias: string[];
  palavrasRelacionadas: string[];
  palavrasNegativas: string[];
  valorMinimo?: number;
  valorMaximo?: number;
  scoreMinimo: number;
}

// Registro "cru" do PNCP (endpoint /contratacoes/publicacao e
// detalhe /orgaos/{orgao}/compras/{ano}/{sequencial}). Só os campos
// que o portal lê. O CNPJ que vem em orgaoEntidade NÃO é declarado
// aqui de propósito: o portal não lê esse campo.
export interface IRegistroPncp {
  numeroControlePNCP?: string;
  numeroCompra?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  processo?: string;
  objetoCompra?: string;
  objeto?: string;
  informacaoComplementar?: string;
  modalidadeNome?: string;
  modoDisputaNome?: string;
  tipoInstrumentoConvocatorioNome?: string;
  situacaoCompraNome?: string;
  srp?: boolean;
  amparoLegal?: {
    nome?: string;
    descricao?: string;
  };
  justificativaPresencial?: string;
  valorTotalEstimado?: number | string;
  valorTotalHomologado?: number | string;
  dataPublicacaoPncp?: string;
  dataInclusao?: string;
  dataAtualizacao?: string;
  dataAtualizacaoGlobal?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  linkSistemaOrigem?: string;
  linkProcessoEletronico?: string;
  usuarioNome?: string;
  orgaoEntidade?: {
    razaoSocial?: string;
    nome?: string;
    esferaId?: string;
    poderId?: string;
  };
  unidadeOrgao?: {
    municipioNome?: string;
    nomeMunicipio?: string;
    ufSigla?: string;
    uf?: string;
    ufNome?: string;
    nomeUnidade?: string;
    codigoUnidade?: string;
  };
  fontesOrcamentarias?: Array<{
    nome?: string;
    descricao?: string;
  }>;
}

export interface IRespostaPaginaPncp {
  data?: IRegistroPncp[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginasRestantes?: number;
  temMaisPaginas?: boolean;
  empty?: boolean;
}

// Dados do edital usados na pré-visualização (já vêm na busca).
export interface IDadosEdital {
  processo?: string;
  informacaoComplementar?: string;
  modoDisputa?: string;
  instrumentoConvocatorio?: string;
  situacao?: string;
  srp?: boolean;
  amparoLegalNome?: string;
  amparoLegalDescricao?: string;
  justificativaPresencial?: string;
  valorHomologado?: number;
  unidadeCompradora?: string;
  codigoUnidade?: string;
  esfera?: string;
  poder?: string;
  sistemaOrigem?: string;
  linkSistemaOrigem?: string;
  linkProcessoEletronico?: string;
  dataInclusao?: string;
  dataAtualizacao?: string;
  fontesOrcamentarias: string[];
}

export interface ILicitacaoResultado {
  // Chave interna (só em memória) para a lista do React.
  chave: string;
  score: number;
  motivos: string[];
  numero: string;
  orgao: string;
  local: string;
  modalidade: string;
  objeto: string;
  valor?: number;
  publicacao?: string;
  abertura?: string;
  encerramento?: string;
  url: string;
  // Identificador PNCP: usado SOMENTE em memória para consultar
  // itens e documentos do edital. Nunca é exibido nem gravado.
  idPncp?: string;
  dados: IDadosEdital;
}

// ------------------------------------------------------------
// Pré-visualização do edital (itens e documentos)
// ------------------------------------------------------------

export interface IItemEdital {
  numeroItem: number;
  descricao: string;
  tipo: string;
  quantidade?: number;
  unidade?: string;
  valorUnitario?: number;
  valorTotal?: number;
  sigiloso: boolean;
  criterioJulgamento?: string;
  beneficio?: string;
  situacao?: string;
  categoria?: string;
}

export interface IDocumentoEdital {
  sequencial: number;
  titulo: string;
  tipo: string;
  publicacao?: string;
  url: string;
}

export type SituacaoCarga = 'carregando' | 'ok' | 'vazio' | 'erro';

export interface ICargaEdital<T> {
  situacao: SituacaoCarga;
  dados: T;
  erro?: string;
  // Itens: true quando o limite de páginas foi atingido.
  truncado?: boolean;
}

export interface IProgressoBusca {
  modalidadeAtual: string;
  indiceModalidade: number;
  totalModalidades: number;
  pagina: number;
  totalPaginasModalidade?: number;
  registrosBrutos: number;
  registrosUnicos: number;
  descartados: number;
  aderentes: number;
  mensagem?: string;
}

export interface IResumoBusca {
  inicio: Date;
  fim: Date;
  registrosBrutos: number;
  registrosUnicos: number;
  descartados: number;
  aderentes: number;
  falhas: string[];
  cancelada: boolean;
  duracaoSegundos: number;
}

// ------------------------------------------------------------
// Parecer da DGT sobre o edital (Participar / Não participar)
//
// Cada decisão é um registro NOVO na tabela dgt_licitacaoparecer.
// Nada é sobrescrito nem apagado: o parecer vigente é o mais
// recente e os anteriores formam o histórico do edital.
//
// LGPD: a chave do edital é montada SEM o CNPJ do órgão (ver
// gerarChaveEdital em LicitacaoParecerService) e o link do PNCP
// (que contém o CNPJ) NÃO é gravado.
// ------------------------------------------------------------

export type DecisaoParecer =
  | 'Participar'
  | 'NaoParticipar';

export const ROTULO_DECISAO: { [decisao: string]: string } = {
  Participar: 'Participar',
  NaoParticipar: 'Não participar'
};

export interface IParecerLicitacao {
  id: string;
  chaveEdital: string;
  decisao: DecisaoParecer;
  justificativa: string;
  orgao: string;
  local: string;
  modalidade: string;
  numero: string;
  objeto: string;
  valorEstimado?: number;
  encerramento?: string;
  score?: number;
  responsavel: string;
  registradoEm: string;
}

// Parecer vigente + histórico (mais recente primeiro).
export interface ISituacaoParecer {
  atual: IParecerLicitacao;
  historico: IParecerLicitacao[];
}

export type FiltroParecer =
  | 'todos'
  | 'semParecer'
  | 'Participar'
  | 'NaoParticipar';
