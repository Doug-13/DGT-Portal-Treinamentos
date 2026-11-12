// ============================================================
// FORNECEDORES — TIPOS E CONSTANTES (fase 1, uso interno)
//
// Escopo: "Plataforma de Homologação e Gestão de Fornecedores"
// (Suprimentos, minuta 1.0 de 06/11/2026). Esta fase cobre o que a
// equipe da DGT faz dentro do portal: cadastro mestre, documentos com
// validade, consultas automáticas (CNPJá e CEIS/CNEP) e status.
// O portal do fornecedor (acesso externo), o kanban de homologação
// com aprovações e a integração com o CIGAM ficam para as próximas
// fases.
//
// Os nomes das tabelas e colunas DEVEM ser iguais aos de
// scripts/dataverse/criar-tabelas-fornecedores.ps1
// ============================================================

export const TABELAS_FORN = {
  fornecedor: 'dgt_fornecedor',
  tipoDocumento: 'dgt_tipodocumentofornecedor',
  documento: 'dgt_fornecedordocumento',
  consulta: 'dgt_fornecedorconsulta',
  historico: 'dgt_fornecedorhistorico'
};

// Custom API (plugin ConsultarFornecedorPlugin). As chaves do CNPJá e
// do Portal da Transparência ficam SÓ na Configuração segura do passo.
export const API_CONSULTAR_FORNECEDOR = 'dgt_ConsultarFornecedor';

// Categorias do escopo (o formulário e os documentos exigidos mudam
// conforme a categoria).
export const CATEGORIAS_FORNECEDOR: string[] = [
  'Material',
  'Serviço',
  'Terceirizado em campo',
  'Transporte'
];

// Status do cadastro mestre (escopo, RF-20).
export type StatusFornecedor =
  | 'Em homologação'
  | 'Homologado'
  | 'Com restrição'
  | 'Suspenso'
  | 'Bloqueado'
  | 'Descredenciado';

export const STATUS_FORNECEDOR: StatusFornecedor[] = [
  'Em homologação',
  'Homologado',
  'Com restrição',
  'Suspenso',
  'Bloqueado',
  'Descredenciado'
];

export type Criticidade = 'A' | 'B' | 'C' | '';

export const CRITICIDADES: Array<{ valor: Criticidade; rotulo: string }> = [
  { valor: '', rotulo: 'Não definida' },
  { valor: 'A', rotulo: 'A — crítico' },
  { valor: 'B', rotulo: 'B — importante' },
  { valor: 'C', rotulo: 'C — baixo impacto' }
];

// Ficha de Cadastramento (RTC), seção 3.
export const REGIMES_TRIBUTARIOS: string[] = [
  '',
  'Simples Nacional Tradicional',
  'Simples Nacional Híbrido',
  'Lucro Presumido',
  'Lucro Real'
];

export type ResultadoSancoes = 'Não consultado' | 'Nada consta' | 'Com registro' | 'Erro na consulta';

export type Visibilidade = 'Interno' | 'Externo';

export const VISIBILIDADES: Array<{ valor: Visibilidade; rotulo: string }> = [
  { valor: 'Interno', rotulo: 'Interno — só a DGT vê' },
  { valor: 'Externo', rotulo: 'Externo — o fornecedor também verá (portal futuro)' }
];

export interface IContatoFornecedor {
  nome: string;
  email: string;
  telefone: string;
}

export interface IFornecedor {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  // Vazio quando a pessoa não está no perfil de segurança de campo
  // "DGT - Fornecedores - CNPJ".
  cnpj: string;
  categoria: string;
  criticidade: Criticidade;
  status: StatusFornecedor;
  uf: string;
  cidade: string;
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regimeTributario: string;
  situacaoCadastral: string;
  dataSituacao: string;
  dataAbertura: string;
  naturezaJuridica: string;
  porte: string;
  cnaePrincipal: string;
  contatoComercial: IContatoFornecedor;
  contatoFiscal: IContatoFornecedor;
  contatoFinanceiro: IContatoFornecedor;
  observacoes: string;
  ultimaConsultaCnpj: string;
  ultimaConsultaSancoes: string;
  resultadoSancoes: ResultadoSancoes;
  ativo: boolean;
  criadoEm: string;
}

export interface ITipoDocumentoFornecedor {
  id: string;
  nome: string;
  descricao: string;
  // Vazio = vale para todas as categorias.
  categorias: string[];
  obrigatorio: boolean;
  exigeValidade: boolean;
  // Sugestão de validade ao registrar (dias a partir da emissão).
  validadeDias?: number;
  visibilidade: Visibilidade;
  ordem: number;
  ativo: boolean;
}

export type SituacaoDocumento = 'Vigente' | 'Substituído';

export interface IDocumentoFornecedor {
  id: string;
  fornecedorId: string;
  tipoId: string;
  tipoNome: string;
  titulo: string;
  emissao: string;      // yyyy-mm-dd
  vencimento: string;   // yyyy-mm-dd (vazio = sem validade)
  arquivoUrl: string;
  arquivoNome: string;
  observacoes: string;
  situacao: SituacaoDocumento;
  registradoPor: string;
  criadoEm: string;
}

export type TipoConsulta = 'CNPJ' | 'CEIS' | 'CNEP' | 'CEPIM' | 'LENIENCIA';

export const ROTULO_CONSULTA: Record<TipoConsulta, string> = {
  CNPJ: 'Receita (CNPJ)',
  CEIS: 'CEIS',
  CNEP: 'CNEP',
  CEPIM: 'CEPIM',
  LENIENCIA: 'Acordos de leniência'
};

export interface IConsultaFornecedor {
  id: string;
  fornecedorId: string;
  tipo: TipoConsulta;
  resultado: string;
  resumo: string;
  fonte: string;
  executadoPor: string;
  quando: string;
}

export interface IHistoricoFornecedor {
  id: string;
  acao: string;
  descricao: string;
  usuario: string;
  quando: string;
}

export interface IDadosFornecedores {
  disponivel: boolean;   // false = tabelas ainda não criadas
  fornecedores: IFornecedor[];
  tipos: ITipoDocumentoFornecedor[];
  documentos: IDocumentoFornecedor[];   // somente vigentes
}

// Dados que a consulta prévia (CNPJá) devolve para preencher o cadastro.
export interface IDadosReceita {
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataSituacao: string;
  dataAbertura: string;
  naturezaJuridica: string;
  porte: string;
  cnaePrincipal: string;
  uf: string;
  cidade: string;
  endereco: string;
}

export interface IResultadoPrevia {
  existente?: { id: string; razaoSocial: string; ativo: boolean };
  dados?: IDadosReceita;
  aviso?: string;
}

export interface IResultadoConsulta {
  cnpj?: { ok: boolean; mensagem: string };
  ceis?: { ok: boolean; registros: number; mensagem: string };
  cnep?: { ok: boolean; registros: number; mensagem: string };
  cepim?: { ok: boolean; registros: number; mensagem: string };
  leniencia?: { ok: boolean; registros: number; vigentes?: number; mensagem: string };
  resultadoSancoes?: ResultadoSancoes;
}

// Sugestões de tipos de documento para começar (o Administrador do
// módulo confirma e ajusta). Validades em branco de propósito: o prazo
// de cada certidão precisa ser confirmado por Suprimentos.
export const TIPOS_SUGERIDOS: Array<Omit<ITipoDocumentoFornecedor, 'id' | 'ativo'>> = [
  { nome: 'Cartão CNPJ (Comprovante de Inscrição e Situação Cadastral)', descricao: 'Ficha de Cadastramento (RTC), seção 4.', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 10 },
  { nome: 'Certidão Negativa de Débitos federais (CND)', descricao: 'Ficha RTC: renovação obrigatória a cada 6 meses.', categorias: [], obrigatorio: true, exigeValidade: true, validadeDias: 180, visibilidade: 'Interno', ordem: 20 },
  { nome: 'Certificado de Regularidade do FGTS (CRF)', descricao: '', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 30 },
  { nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT)', descricao: '', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 40 },
  { nome: 'Certidão de regularidade estadual', descricao: '', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 50 },
  { nome: 'Certidão de regularidade municipal', descricao: '', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 60 },
  { nome: 'Consulta consolidada de pessoa jurídica (TCU)', descricao: 'TCU, CNJ, CEIS e CNEP num só documento. Emitida no site do TCU.', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 70 },
  { nome: 'Contrato social (consolidado)', descricao: 'Com a distribuição de quotas entre os sócios.', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Interno', ordem: 80 },
  { nome: 'Balanço / DRE do último exercício', descricao: '', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Interno', ordem: 90 },
  { nome: 'Ficha de Cadastramento e Alinhamento Fiscal (RTC) assinada', descricao: 'Com a declaração de veracidade.', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 100 },
  { nome: 'PGR da empresa', descricao: 'Programa de Gerenciamento de Riscos.', categorias: ['Terceirizado em campo'], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 110 },
  { nome: 'PCMSO da empresa', descricao: 'Programa de Controle Médico de Saúde Ocupacional (documento da empresa, sem dados de colaboradores).', categorias: ['Terceirizado em campo'], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 120 },
  { nome: 'Nota fiscal de serviço', descricao: 'Exemplo de documento externo (o fornecedor verá no portal futuro).', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Externo', ordem: 200 }
];
