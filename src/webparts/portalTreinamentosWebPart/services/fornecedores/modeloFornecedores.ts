// ============================================================
// FORNECEDORES — TIPOS E CONSTANTES (fase 1, uso interno)
//
// Escopo: "Plataforma de Homologação e Gestão de Fornecedores"
// (Suprimentos, minuta 1.0 de 06/11/2026). Esta fase cobre o que a
// equipe da DGT faz dentro do portal: cadastro mestre, documentos com
// validade, consultas e certidões automáticas, kanban de homologação
// (ciclos, transição manual) e colaboradores do prestador (ASO e NR).
// O portal do fornecedor (acesso externo), notificações do kanban e a
// integração com o CIGAM ficam para as próximas fases.
//
// Os nomes das tabelas e colunas DEVEM ser iguais aos de
// scripts/dataverse/criar-tabelas-fornecedores.ps1
// ============================================================

export const TABELAS_FORN = {
  fornecedor: 'dgt_fornecedor',
  tipoDocumento: 'dgt_tipodocumentofornecedor',
  documento: 'dgt_fornecedordocumento',
  consulta: 'dgt_fornecedorconsulta',
  historico: 'dgt_fornecedorhistorico',
  ciclo: 'dgt_fornecedorhomologacao',
  colaborador: 'dgt_fornecedorcolaborador',
  colaboradorDocumento: 'dgt_colaboradordocumento',
  contrato: 'dgt_fornecedorcontrato'
};

// Processo do motor de fluxos (Processos → Fluxos) que governa a
// homologação. Plano B: primeiro processo ativo cujo nome contenha o texto.
export const PROCESSO_HOMOLOGACAO = {
  CODIGO: 'SUP-HOM',
  NOME_CONTEM: 'homologacao de fornecedor'
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
  | 'Descredenciado'
  | 'Reprovado';

export const STATUS_FORNECEDOR: StatusFornecedor[] = [
  'Em homologação',
  'Homologado',
  'Com restrição',
  'Suspenso',
  'Bloqueado',
  'Descredenciado',
  'Reprovado'
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

// ------------------------------------------------------------
// Ficha de Cadastro de Fornecedor — SUP-CPL-01 v1.0
// (respondida pelo fornecedor no Microsoft Forms; o Power Automate
// envia as respostas à ação "receberFicha" do plugin)
// ------------------------------------------------------------

// Caixa que recebe os documentos do fornecedor (opção A: e-mail com
// protocolo). O fluxo do Power Automate usa o mesmo endereço.
export const EMAIL_DOCUMENTOS_FORNECEDORES = 'fornecedores@dgt.com.br';

export const TIPOS_SOLICITACAO: string[] = [
  'Cadastro inicial',
  'Atualização periódica',
  'Alteração de dados cadastrais / bancários'
];

export const CATEGORIAS_FICHA: string[] = [
  'Materiais / produtos',
  'Prestação de serviços',
  'Serviços terceirizados com cessão de mão de obra',
  'Representação comercial / preposto',
  'Locação de equipamentos / imóveis'
];

export const PORTES_FICHA: string[] = ['', 'MEI', 'ME', 'EPP', 'Médio porte', 'Grande porte'];

export const FAIXAS_FATURAMENTO_SIMPLES: string[] = [
  '',
  'Até R$ 180.000,00',
  'De R$ 180.000,01 a R$ 360.000,00',
  'De R$ 360.000,01 a R$ 720.000,00',
  'De R$ 720.000,01 a R$ 1.800.000,00',
  'De R$ 1.800.000,01 a R$ 3.600.000,00',
  'De R$ 3.600.000,01 a R$ 4.800.000,00'
];

export const ANEXOS_SIMPLES: string[] = [
  '',
  'Anexo I – Comércio',
  'Anexo II – Indústria',
  'Anexo III – Serviços com alíquota reduzida',
  'Anexo IV – Serviços com contribuição patronal',
  'Anexo V – Serviços com alíquota mais elevada'
];

export const PREVISOES_MUDANCA_REGIME: string[] = ['', 'Sim', 'Não', 'Em análise contábil'];

export type RespostaQuestionario = '' | 'Sim' | 'Não' | 'Não se aplica / Não sei';

export const RESPOSTAS_QUESTIONARIO: RespostaQuestionario[] = ['', 'Sim', 'Não', 'Não se aplica / Não sei'];

// Item 6. "Sim" não reprova: destaca para análise. Nas perguntas 6.8 e
// 6.9 (programa de integridade, LGPD) o ponto de atenção é o "Não".
export const QUESTOES_INTEGRIDADE: Array<{ id: string; texto: string; atencaoQuando: 'Sim' | 'Não' }> = [
  { id: '6.1', texto: 'A empresa está em recuperação judicial, recuperação extrajudicial ou processo de falência?', atencaoQuando: 'Sim' },
  { id: '6.2', texto: 'Há processos judiciais relevantes em que a empresa figure como ré ou executada, ou em que sócios com poderes de administração figurem como réus?', atencaoQuando: 'Sim' },
  { id: '6.3', texto: 'Há processos administrativos, concluídos ou em curso, visando à imposição de penalidades (tributário, trabalhista, ambiental, licitações e contratos, CADE, TCU, CGU, TCE e outros)?', atencaoQuando: 'Sim' },
  { id: '6.4', texto: 'A empresa ou seus sócios constam no CEIS, no CNEP ou possuem impedimento de licitar ou contratar com a administração pública?', atencaoQuando: 'Sim' },
  { id: '6.5', texto: 'A empresa consta em cadastros de inadimplentes (Serasa, SPC ou similares)?', atencaoQuando: 'Sim' },
  { id: '6.6', texto: 'Algum sócio, administrador ou representante exerce cargo, emprego ou função pública, ou tem familiar que atue em órgão público em licitações, contratos ou fiscalização relacionados à DGT?', atencaoQuando: 'Sim' },
  { id: '6.7', texto: 'Algum sócio, administrador ou representante possui vínculo familiar ou pessoal próximo com colaborador da DGT, ou algum colaborador da DGT possui participação na empresa?', atencaoQuando: 'Sim' },
  { id: '6.8', texto: 'A empresa possui programa de integridade (código de ética, canal de denúncias, política anticorrupção, análise de riscos)?', atencaoQuando: 'Não' },
  { id: '6.9', texto: 'A empresa está adequada à LGPD (políticas de privacidade, encarregado de dados designado)?', atencaoQuando: 'Não' },
  { id: '6.10', texto: 'A execução do fornecimento envolve mão de obra terceirizada ou subcontratada?', atencaoQuando: 'Sim' },
  { id: '6.11', texto: 'A atividade exige licenciamento ambiental?', atencaoQuando: 'Sim' }
];

// Item 8 (texto da ficha v1.0, sujeito à validação jurídica).
export const DECLARACOES_FICHA: Array<{ titulo: string; texto: string }> = [
  { titulo: 'Veracidade', texto: 'As informações prestadas são verdadeiras e exatas, e se compromete a enviar as CNDs renovadas a cada 6 meses e a comunicar imediatamente qualquer alteração cadastral, societária ou no regime tributário.' },
  { titulo: 'Conformidade legal', texto: 'Cumpre a legislação aplicável à sua atividade, incluindo as normas fiscais, trabalhistas, previdenciárias e ambientais.' },
  { titulo: 'Trabalho digno', texto: 'Não utiliza, direta ou indiretamente, trabalho infantil, trabalho escravo ou em condição análoga à de escravo.' },
  { titulo: 'Integridade e anticorrupção', texto: 'Adota práticas de integridade e ética nos negócios, não oferece nem promete vantagem indevida a agentes públicos ou privados e observa a Lei nº 12.846/2013 (Lei Anticorrupção).' },
  { titulo: 'Conflito de interesses', texto: 'Comunicará à DGT qualquer situação de conflito de interesses, bem como a instauração de processos ou sanções relevantes.' },
  { titulo: 'Proteção de dados', texto: 'Trata dados pessoais em conformidade com a Lei nº 13.709/2018 (LGPD) e teve acesso ao aviso de privacidade aplicável a fornecedores.' },
  { titulo: 'Consultas', texto: 'Está ciente de que a DGT poderá realizar consultas em bases públicas e privadas (Receita Federal, TST, CEIS, CNEP, birôs de crédito, tribunais) para fins de homologação e due diligence.' }
];

export interface ISocio {
  nome: string;
  cargo: string;
  cpf: string;            // só dígitos; coluna protegida
  participacao: string;
}

// dgt_quadrosocietario (JSON, coluna com segurança de campo).
export interface IQuadroSocietario {
  socios: ISocio[];
  participaOutras: '' | 'Sim' | 'Não';
  outrasSociedades: string;
  grupoEconomico: '' | 'Sim' | 'Não';
  grupoEconomicoDetalhe: string;
}

// dgt_dadosbancarios (JSON, coluna com segurança de campo).
export interface IDadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipoChavePix: string;
  chavePix: string;
  titular: string;
  cnpjTitular: string;
}

export interface IDeclaracoesFicha {
  aceitas: boolean;
  representante: string;
  cargo: string;
  local: string;
  data: string;   // yyyy-mm-dd
}

// ------------------------------------------------------------
// Item 9 — uso interno (Suprimentos / Compliance)
// ------------------------------------------------------------

export type ClassificacaoRisco = '' | 'Baixo' | 'Médio' | 'Alto';

export const CLASSIFICACOES_RISCO: ClassificacaoRisco[] = ['', 'Baixo', 'Médio', 'Alto'];

export type ResultadoHomologacao = '' | 'Aprovado' | 'Aprovado com ressalvas' | 'Pendente' | 'Reprovado';

export const RESULTADOS_HOMOLOGACAO: ResultadoHomologacao[] = ['Pendente', 'Aprovado', 'Aprovado com ressalvas', 'Reprovado'];

export type IdVerificacao =
  | 'receita'
  | 'cnds'
  | 'cndt'
  | 'ceisCnep'
  | 'credito'
  | 'financeira'
  | 'judicial'
  | 'questionario'
  | 'bancario';

// Checklist do item 9. "fonte" diz de onde vem a sugestão automática.
export const VERIFICACOES_HOMOLOGACAO: Array<{ id: IdVerificacao; rotulo: string; fonte: string }> = [
  { id: 'receita', rotulo: 'Situação cadastral na Receita Federal', fonte: 'Automática (CNPJá)' },
  { id: 'cnds', rotulo: 'CNDs Federal, FGTS, Estadual e Municipal válidas', fonte: 'Automática (Infosimples; estadual e municipal conforme cobertura)' },
  { id: 'cndt', rotulo: 'CNDT (TST) e CEAT (TRT da sede)', fonte: 'Automática (Infosimples; CEAT conforme o TRT configurado)' },
  { id: 'ceisCnep', rotulo: 'Consulta CEIS e CNEP (Portal da Transparência)', fonte: 'Automática (com CEPIM e leniência)' },
  { id: 'credito', rotulo: 'Consulta a birôs de crédito (Serasa / SPC)', fonte: 'Manual — referência: pergunta 6.5' },
  { id: 'financeira', rotulo: 'Análise financeira (balanço / DRE) — área contábil', fonte: 'Manual' },
  { id: 'judicial', rotulo: 'Análise de processos judiciais — Jurídico', fonte: 'Manual' },
  { id: 'questionario', rotulo: 'Respostas positivas do questionário analisadas', fonte: 'Manual — o sistema destaca as respostas de atenção' },
  { id: 'bancario', rotulo: 'Dados bancários conferidos (titularidade = CNPJ)', fonte: 'Semiautomática — compara o CNPJ do titular' }
];

export interface IVerificacao {
  ok: boolean;
  data: string;          // yyyy-mm-dd
  responsavel: string;
}

// Campos do item 9 que o card do kanban edita (administrador do módulo).
export interface IDadosHomologacao {
  classificacaoRisco: ClassificacaoRisco;
  resultadoHomologacao: ResultadoHomologacao;
  ressalvas: string;
  validadeCadastro: string;
  verificacoes: Partial<Record<IdVerificacao, IVerificacao>>;
  responsavelSuprimentos: string;
  responsavelCompliance: string;
  bancarioConferido: boolean;
}

export type ResultadoCertidoes = 'Não consultado' | 'Regular' | 'Com pendência' | 'Verificar';

export type CodigoCertidao = 'cnd_federal' | 'fgts' | 'cndt' | 'cnd_estadual' | 'cnd_municipal' | 'ceat';

// Certidões emitidas pela Infosimples (plugin). "tipo" é o valor
// gravado em dgt_fornecedorconsulta.dgt_tipo.
export const CERTIDOES: Array<{ codigo: CodigoCertidao; tipo: TipoConsulta; rotulo: string }> = [
  { codigo: 'cnd_federal', tipo: 'CND_FEDERAL', rotulo: 'CND Federal' },
  { codigo: 'fgts', tipo: 'FGTS', rotulo: 'FGTS (CRF)' },
  { codigo: 'cndt', tipo: 'CNDT', rotulo: 'CNDT' },
  { codigo: 'cnd_estadual', tipo: 'CND_ESTADUAL', rotulo: 'CND Estadual' },
  { codigo: 'cnd_municipal', tipo: 'CND_MUNICIPAL', rotulo: 'CND Municipal' },
  { codigo: 'ceat', tipo: 'CEAT', rotulo: 'CEAT (TRT)' }
];

export interface IContatoFornecedor {
  nome: string;
  email: string;
  telefone: string;
}

// ------------------------------------------------------------
// Kanban de homologação: um card = um ciclo (dgt_fornecedorhomologacao).
// Ciclo concluído (Homologado/Reprovado) vira histórico somente leitura;
// renovação ou recontratação abre um ciclo NOVO. A etapa segue o motor
// de fluxos (processo SUP-HOM): a coluna do kanban (dgt_etapa) é
// DERIVADA da etapa do fluxo (ver homologacao.ts › etapaKanbanDoFluxo).
// Ninguém move card à mão.
// ------------------------------------------------------------

export type EtapaHomologacao =
  | 'Ficha recebida'
  | 'Documentos pendentes'
  | 'Em análise'
  | 'Aguardando Jurídico'
  | 'Concluído';

export const ETAPAS_HOMOLOGACAO: Array<{ id: EtapaHomologacao; rotulo: string }> = [
  { id: 'Ficha recebida', rotulo: 'Ficha recebida' },
  { id: 'Documentos pendentes', rotulo: 'Documentos pendentes' },
  { id: 'Em análise', rotulo: 'Em análise (Suprimentos)' },
  { id: 'Aguardando Jurídico', rotulo: 'Aguardando Jurídico' },
  { id: 'Concluído', rotulo: 'Homologado / Reprovado' }
];

export const MOTIVOS_CICLO: string[] = [
  'Cadastro inicial',
  'Atualização periódica',
  'Alteração de dados cadastrais / bancários',
  'Renovação da homologação',
  'Recontratação'
];

export interface ICicloHomologacao {
  id: string;
  fornecedorId: string;
  numero: number;
  motivo: string;
  etapa: EtapaHomologacao;
  etapaDesde: string;
  concluidoEm: string;        // vazio = ciclo aberto
  protocolo: string;
  classificacaoRisco: ClassificacaoRisco;
  resultadoHomologacao: ResultadoHomologacao;
  ressalvas: string;
  validadeCadastro: string;   // yyyy-mm-dd
  verificacoes: Partial<Record<IdVerificacao, IVerificacao>>;
  responsavelSuprimentos: string;
  responsavelCompliance: string;
  bancarioConferido: boolean; // retrato na conclusão
  abertoPor: string;
  criadoEm: string;
  // Motor de fluxos (SUP-HOM). Sem fluxoIniciado, o ciclo ainda não tem
  // instância (ex.: aberto pela ficha, no plugin).
  fluxoIniciado: boolean;
  etapaAtual: string;           // id da etapa do fluxo
  prazoEtapa: string;
  responsaveisEtapa: string;    // JSON, mesmo formato de dgt_responsaveisjson
}

// ------------------------------------------------------------
// Colaboradores do prestador (dgt_fornecedorcolaborador). CPF só na
// coluna protegida; sem e-mail e sem telefone.
// ------------------------------------------------------------

export interface IColaboradorFornecedor {
  id: string;
  fornecedorId: string;
  nome: string;
  funcao: string;
  // Vazio para quem não está no perfil "DGT - Fornecedores - CPF de colaboradores".
  cpf: string;
  observacoes: string;
  ativo: boolean;
  criadoEm: string;
}

// Tipos de documento de colaborador: CADASTRÁVEIS em Tipos de documento
// (dgt_tipodocumentofornecedor com dgt_aplicaa = "Colaborador"). O campo
// "obrigatório" significa "obrigatório para todos os colaboradores".
// "NR aplicável" (criado pelo script) pede a norma em texto: um vigente
// por norma. Os demais tipos: um vigente por tipo.
export const NOME_TIPO_NR_APLICAVEL = 'NR aplicável';

export const NOME_TIPO_ASO = 'ASO';

const semAcentoModelo = (valor: string): string =>
  (valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// O tipo pede a norma (NR-10, NR-35...) ao registrar?
export const tipoExigeNorma = (nomeTipo: string): boolean =>
  semAcentoModelo(nomeTipo) === semAcentoModelo(NOME_TIPO_NR_APLICAVEL);

export const mesmoNomeDeTipo = (a: string, b: string): boolean => semAcentoModelo(a) === semAcentoModelo(b);

export interface IDocumentoColaborador {
  id: string;
  colaboradorId: string;
  // Id do tipo cadastrado (dgt_TipoDocumento). Vazio nos registros
  // antigos: o tipo é achado pelo nome (dgt_tipo).
  tipoId: string;
  tipo: string;           // nome do tipo (ex.: ASO, NR aplicável, Integração)
  norma: string;          // "NR aplicável": qual norma (ex.: NR-10)
  emissao: string;        // yyyy-mm-dd
  vencimento: string;     // yyyy-mm-dd
  arquivoUrl: string;
  arquivoNome: string;
  observacoes: string;
  situacao: SituacaoDocumento;
  registradoPor: string;
  criadoEm: string;
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

  // Ficha SUP-CPL-01
  protocolo: string;
  origem: string;
  tipoSolicitacao: string;
  fichaRecebidaEm: string;
  cep: string;
  telefone: string;
  site: string;
  emailPedidos: string;
  porteDeclarado: string;
  categoriaFornecimento: string;
  descricaoFornecimento: string;
  contatoIntegridade: IContatoFornecedor;
  // undefined = sem permissão de leitura (perfil de segurança de campo)
  // ou ficha ainda não recebida.
  quadroSocietario?: IQuadroSocietario;
  faixaFaturamento: string;
  anexoSimples: string;
  previsaoMudancaRegime: string;
  dadosBancarios?: IDadosBancarios;
  bancarioConferido: boolean;
  questionario: Record<string, RespostaQuestionario>;
  certificacoes: string;
  detalhamentoPositivas: string;
  declaracoes?: IDeclaracoesFicha;

  // Item 9
  classificacaoRisco: ClassificacaoRisco;
  resultadoHomologacao: ResultadoHomologacao;
  ressalvas: string;
  validadeCadastro: string;   // yyyy-mm-dd
  verificacoes: Partial<Record<IdVerificacao, IVerificacao>>;
  responsavelSuprimentos: string;
  responsavelCompliance: string;

  // Certidões (Infosimples)
  ultimaConsultaCertidoes: string;
  resultadoCertidoes: ResultadoCertidoes;
  vencimentoCertidoes: string;   // yyyy-mm-dd

  // Assinatura da ficha (Clicksign — aguardando o token)
  assinaturaStatus: string;
}

// A quem o tipo se aplica: à empresa (documentos do fornecedor) ou a cada
// colaborador do prestador. Vazio (tipos antigos) = Empresa.
export type AplicaATipo = 'Empresa' | 'Colaborador';

export interface ITipoDocumentoFornecedor {
  id: string;
  aplicaA?: AplicaATipo;
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
  // Certidão que o plugin emite e registra sozinho neste tipo (vazio = manual).
  codigoConsulta?: CodigoCertidao | '';
}

// "A conferir": arquivo recebido por e-mail (Fluxo 2/2b), ainda sem tipo
// e datas — NÃO conta como documento válido até a analista conferir.
// "Descartado": anexo que não era documento (logo, assinatura…).
// "Convertido em contrato": o arquivo da fila virou um contrato (aba
// Contratos); também não conta como documento entregue.
export type SituacaoDocumento = 'Vigente' | 'Substituído' | 'A conferir' | 'Descartado' | 'Convertido em contrato';

export const SITUACAO_A_CONFERIR: SituacaoDocumento = 'A conferir';

export const SITUACAO_CONVERTIDO_CONTRATO: SituacaoDocumento = 'Convertido em contrato';

export const lerSituacaoDocumento = (valor: string): SituacaoDocumento =>
  valor === 'Substituído' || valor === 'A conferir' || valor === 'Descartado' || valor === 'Convertido em contrato' ? valor : 'Vigente';

// ------------------------------------------------------------
// Contratos do fornecedor (dgt_fornecedorcontrato). Vários por
// fornecedor; projeto em texto livre. Encerrar em vez de excluir.
// "Vencido" e "Vence em N dias" são calculados pelo fim da vigência.
// ------------------------------------------------------------

export type SituacaoContratoGravada = 'Vigente' | 'Encerrado';

export type OrigemContrato = 'Manual' | 'E-mail';

export interface IContratoFornecedor {
  id: string;
  fornecedorId: string;
  nome: string;
  projeto: string;
  dataAssinatura: string;   // yyyy-mm-dd
  inicioVigencia: string;   // yyyy-mm-dd
  fimVigencia: string;      // yyyy-mm-dd (vazio = prazo indeterminado)
  arquivoUrl: string;
  arquivoNome: string;
  observacoes: string;
  situacao: SituacaoContratoGravada;
  origem: OrigemContrato;
  documentoOrigemId: string;
  registradoPor: string;
  criadoEm: string;
}

// Relatório de homologação (PDF) emitido — lista em
// dgt_fornecedorhomologacao.dgt_relatoriosjson.
export interface IRelatorioEmitido {
  emitidoEm: string;   // ISO
  fase: string;
  nome: string;
  url: string;
  geradoPor: string;
  final: boolean;
}

// Tipo de documento (Empresa) do relatório final; criado pelo script.
export const NOME_TIPO_RELATORIO_HOMOLOGACAO = 'Relatório de homologação';

// Antecedência dos avisos de vencimento (Power Automate, docs/fornecedores.md):
// documentos manuais ao fornecedor e contratos para Suprimentos.
export const DIAS_AVISO_VENCIMENTO = 15;

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

export type TipoConsulta =
  | 'CNPJ' | 'CEIS' | 'CNEP' | 'CEPIM' | 'LENIENCIA'
  | 'CND_FEDERAL' | 'FGTS' | 'CNDT' | 'CND_ESTADUAL' | 'CND_MUNICIPAL' | 'CEAT';

export const ROTULO_CONSULTA: Record<TipoConsulta, string> = {
  CNPJ: 'Receita (CNPJ)',
  CEIS: 'CEIS',
  CNEP: 'CNEP',
  CEPIM: 'CEPIM',
  LENIENCIA: 'Acordos de leniência',
  CND_FEDERAL: 'CND Federal (Receita/PGFN)',
  FGTS: 'FGTS (CRF)',
  CNDT: 'CNDT (TST)',
  CND_ESTADUAL: 'CND Estadual',
  CND_MUNICIPAL: 'CND Municipal',
  CEAT: 'CEAT (ações trabalhistas — TRT)'
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
  // SÓ tipos da EMPRESA (situação documental, Conferir, e-mail ao
  // fornecedor, checklist, relatório). Os de colaborador ficam à parte.
  tipos: ITipoDocumentoFornecedor[];
  tiposColaborador: ITipoDocumentoFornecedor[];
  documentos: IDocumentoFornecedor[];   // somente vigentes
  aConferir: IDocumentoFornecedor[];    // recebidos por e-mail, ainda não conferidos
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
  certidoes?: Partial<Record<CodigoCertidao, {
    ok: boolean;
    regular?: boolean;     // ausente/nulo = a fonte não deixou claro (conferir o comprovante)
    validade?: string;
    pulada?: boolean;
    semCobertura?: boolean;
    mensagem: string;
  }>>;
  resultadoCertidoes?: ResultadoCertidoes;
}

// Sugestões de tipos de documento (Ficha SUP-CPL-01, item 7). O
// Administrador do módulo confirma e ajusta. Os nomes das certidões são
// os da versão anterior, para que "Criar sugestões" ligue a consulta
// automática nos tipos que já existem. A validade padrão só é usada
// quando a fonte não informa a validade da certidão.
export const TIPOS_SUGERIDOS: Array<Omit<ITipoDocumentoFornecedor, 'id' | 'ativo'>> = [
  { nome: 'Cartão CNPJ (Comprovante de Inscrição e Situação Cadastral)', descricao: 'Ficha SUP-CPL-01, item 7 — atualizado.', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 10 },
  { nome: 'Contrato social (consolidado)', descricao: 'Contrato social ou estatuto, e alterações / consolidação vigente.', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 15 },
  { nome: 'Documento de identificação do representante legal', descricao: 'RG e CPF do sócio administrador; procuração, se assinado por procurador. Acesso restrito.', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 18 },
  { nome: 'Certidão Negativa de Débitos federais (CND)', descricao: 'Certidão Conjunta Receita Federal / PGFN. Emitida automaticamente (Infosimples).', categorias: [], obrigatorio: true, exigeValidade: true, validadeDias: 180, visibilidade: 'Interno', ordem: 20, codigoConsulta: 'cnd_federal' },
  { nome: 'Certificado de Regularidade do FGTS (CRF)', descricao: 'Caixa Econômica Federal. Emitido automaticamente (Infosimples).', categorias: [], obrigatorio: true, exigeValidade: true, validadeDias: 30, visibilidade: 'Interno', ordem: 30, codigoConsulta: 'fgts' },
  { nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT)', descricao: 'Tribunal Superior do Trabalho. Emitida automaticamente (Infosimples).', categorias: [], obrigatorio: true, exigeValidade: true, validadeDias: 180, visibilidade: 'Interno', ordem: 40, codigoConsulta: 'cndt' },
  { nome: 'Certidão Eletrônica de Ações Trabalhistas (CEAT)', descricao: 'TRT da sede da empresa. Automática quando a UF tem rota configurada no plugin (RS = TRT4). Sem validade na fonte: 30 dias por padrão.', categorias: [], obrigatorio: false, exigeValidade: true, validadeDias: 30, visibilidade: 'Interno', ordem: 45, codigoConsulta: 'ceat' },
  { nome: 'Certidão de regularidade estadual', descricao: 'Da sede da empresa. Automática quando a UF tem rota configurada no plugin.', categorias: [], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 50, codigoConsulta: 'cnd_estadual' },
  { nome: 'Certidão de regularidade municipal', descricao: 'Da sede da empresa. Automática quando o município tem rota configurada no plugin.', categorias: [], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 60, codigoConsulta: 'cnd_municipal' },
  { nome: 'Comprovante dos dados bancários', descricao: 'Cabeçalho de extrato ou declaração do banco, em nome do CNPJ cadastrado.', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 65 },
  { nome: 'Consulta consolidada de pessoa jurídica (TCU)', descricao: 'TCU, CNJ, CEIS e CNEP num só documento. Emitida no site do TCU.', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 70 },
  { nome: 'Balanço / DRE do último exercício', descricao: 'Conforme risco: e relatório de auditoria, se houver.', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Interno', ordem: 90 },
  { nome: 'Relação de processos judiciais', descricao: 'Conforme risco: empresa e sócios com poderes de administração.', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Interno', ordem: 92 },
  { nome: 'Documentação do programa de integridade', descricao: 'Conforme risco: preferencialmente o Relatório de Conformidade do Programa (RCP — Portaria CGU nº 909/2015).', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Interno', ordem: 94 },
  { nome: 'Certificações (ISO, Empresa Pró-Ética e outras)', descricao: 'Conforme risco.', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 96 },
  { nome: 'Licenças ambientais', descricao: 'Quando a atividade exigir (pergunta 6.11).', categorias: [], obrigatorio: false, exigeValidade: true, visibilidade: 'Interno', ordem: 98 },
  { nome: 'Ficha de Cadastro SUP-CPL-01 assinada', descricao: 'Ficha consolidada com as declarações do item 8, assinada pelo representante legal (Clicksign).', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Interno', ordem: 100 },
  { nome: 'PGR da empresa', descricao: 'Programa de Gerenciamento de Riscos.', categorias: ['Terceirizado em campo'], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 110 },
  { nome: 'PCMSO da empresa', descricao: 'Programa de Controle Médico de Saúde Ocupacional (documento da empresa, sem dados de colaboradores).', categorias: ['Terceirizado em campo'], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 120 },
  { nome: 'Nota fiscal de serviço', descricao: 'Exemplo de documento externo (o fornecedor verá no portal futuro).', categorias: [], obrigatorio: false, exigeValidade: false, visibilidade: 'Externo', ordem: 200 }
];
