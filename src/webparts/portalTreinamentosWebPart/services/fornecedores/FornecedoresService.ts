import {
  SPHttpClient
} from '@microsoft/sp-http';

import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  detectarDadoSensivel
} from '../LicitacaoParecerService';

import {
  SharePointDocumentoService
} from '../sharepoint/SharePointDocumentoService';

import {
  cnpjValido,
  normalizarCnpj
} from '../../utils/cnpj';

import {
  API_CONSULTAR_FORNECEDOR,
  ClassificacaoRisco,
  ICicloHomologacao,
  IContratoFornecedor,
  IRelatorioEmitido,
  NOME_TIPO_RELATORIO_HOMOLOGACAO,
  OrigemContrato,
  tipoExigeNorma,
  IColaboradorFornecedor,
  IDadosHomologacao,
  IDocumentoColaborador,
  CodigoCertidao,
  Criticidade,
  IDadosBancarios,
  EMAIL_DOCUMENTOS_FORNECEDORES,
  IDeclaracoesFicha,
  IdVerificacao,
  IQuadroSocietario,
  IVerificacao,
  ResultadoCertidoes,
  ResultadoHomologacao,
  RespostaQuestionario,
  RESULTADOS_HOMOLOGACAO,
  IConsultaFornecedor,
  IContatoFornecedor,
  IDadosFornecedores,
  IDocumentoFornecedor,
  IFornecedor,
  IHistoricoFornecedor,
  IResultadoConsulta,
  IResultadoPrevia,
  ITipoDocumentoFornecedor,
  lerSituacaoDocumento,
  ResultadoSancoes,
  SITUACAO_A_CONFERIR,
  SITUACAO_CONVERTIDO_CONTRATO,
  STATUS_FORNECEDOR,
  StatusFornecedor,
  TABELAS_FORN,
  TIPOS_SUGERIDOS,
  TipoConsulta,
  Visibilidade
} from './modeloFornecedores';

import {
  etapaValida,
  proximoNumeroCiclo,
  statusPeloResultado,
  validarConclusao,
  verificacoesOk
} from './homologacao';

import {
  IDadosContrato,
  validarContrato
} from './contratos';

import {
  chaveDocumento,
  cpfValido,
  normalizarCpf
} from './colaboradores';

import {
  REMETENTE_FORNECEDORES,
  TIPO_EMAIL_PEDIDO_DOCUMENTOS,
  assuntoPedidoDocumentos,
  corpoPedidoDocumentos,
  destinatarioPedido,
  validarPedidoDocumentos
} from './pedidoDocumentos';

// ============================================================
// FORNECEDORES — SERVIÇO (Dataverse + SharePoint)
//
// Tabelas: scripts/dataverse/criar-tabelas-fornecedores.ps1
// Consultas externas: Custom API dgt_ConsultarFornecedor → plugin
// ConsultarFornecedorPlugin (CNPJá e Portal da Transparência). O
// navegador NUNCA vê as chaves dessas APIs.
//
// Regras:
//   • Nada é apagado. Fornecedor sai de uso com dgt_ativo = Não;
//     documento novo do mesmo tipo marca o anterior como Substituído.
//   • CNPJ só existe em dgt_fornecedor.dgt_cnpj (coluna protegida por
//     segurança de campo). Ele não pode ser alterado depois do
//     cadastro: se estiver errado, desative e cadastre de novo.
//   • Nos campos de texto livre (observações, contatos) continuam
//     bloqueados CPF, CNPJ, senhas e dados bancários.
//   • Toda alteração gera uma linha em dgt_fornecedorhistorico.
// ============================================================

// Onde os documentos anexados ficam: site de Suprimentos, pasta
// "Contratos Fornecedores" (já existente; o portal só cria, dentro dela,
// a subpasta de cada fornecedor). Quem anexa precisa de Editar nessa
// pasta — o envio usa a permissão da própria pessoa.
export const CONFIG_DOCUMENTOS_FORNECEDORES = {
  siteUrl: 'https://dgtnh.sharepoint.com/sites/Suprimentos',
  biblioteca: 'Documentos (Suprimentos)',
  pasta: '/sites/Suprimentos/Shared Documents/General/03. CONTRATOS/Contratos/Contratos Fornecedores'
};

const guid = (valor: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const soData = (valor: string): string => (valor || '').substring(0, 10);

const limitar = (valor: string | undefined, tamanho: number): string =>
  (valor || '').trim().substring(0, tamanho);

const ehTabelaInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

// Mensagem limpa de um erro do Dataverse/plugin.
export const mensagemErro = (erro: unknown): string => {
  const bruto = erro instanceof Error ? erro.message : String(erro || '');
  const json = /\{[\s\S]*\}/.exec(bruto);
  if (json) {
    try {
      const dados = JSON.parse(json[0]) as { error?: { message?: string } };
      if (dados.error && dados.error.message) {
        return dados.error.message.substring(0, 400);
      }
    } catch {
      return bruto.substring(0, 400);
    }
  }
  if (/\b404\b|Resource not found|0x80060888|Could not find/i.test(bruto) && bruto.indexOf(API_CONSULTAR_FORNECEDOR) >= 0) {
    return `A Custom API ${API_CONSULTAR_FORNECEDOR} ainda não existe no Dataverse (rode criar-tabelas-fornecedores.ps1 e registre o passo do plugin).`;
  }
  return bruto.substring(0, 400);
};

const verificarSensivel = (...campos: string[]): void => {
  const motivo = detectarDadoSensivel(campos.join(' \n '));
  if (motivo) {
    throw new Error(
      `Os campos contêm ${motivo}. Remova esse dado: pela política da DGT (LGPD), ` +
      'CPF, CNPJ, senhas e dados bancários não podem ser gravados nos textos livres. ' +
      'O CNPJ do fornecedor vai somente no campo CNPJ do cadastro.'
    );
  }
};

// Contato gravado como "Nome | e-mail | telefone" (uma coluna por papel).
const lerContato = (valor: string): IContatoFornecedor => {
  const partes = (valor || '').split('|').map(p => p.trim());
  return { nome: partes[0] || '', email: partes[1] || '', telefone: partes[2] || '' };
};

const gravarContato = (c: IContatoFornecedor): string =>
  [c.nome, c.email, c.telefone].some(v => !!(v || '').trim())
    ? limitar([c.nome, c.email, c.telefone].map(v => (v || '').replace(/\|/g, '/').trim()).join(' | '), 500)
    : '';

const statusValido = (valor: string): StatusFornecedor =>
  (STATUS_FORNECEDOR.indexOf(valor as StatusFornecedor) >= 0 ? valor : 'Em homologação') as StatusFornecedor;

const resultadoValido = (valor: string): ResultadoSancoes =>
  (['Nada consta', 'Com registro', 'Erro na consulta'].indexOf(valor) >= 0 ? valor : 'Não consultado') as ResultadoSancoes;

const lerCategorias = (valor: string): string[] =>
  (valor || '').split(';').map(c => c.trim()).filter(Boolean);

const lerJson = <T>(valor: string): T | undefined => {
  if (!valor) {
    return undefined;
  }
  try {
    return JSON.parse(valor) as T;
  } catch {
    return undefined;
  }
};

const resultadoCertidoesValido = (valor: string): ResultadoCertidoes =>
  (['Regular', 'Com pendência', 'Verificar'].indexOf(valor) >= 0 ? valor : 'Não consultado') as ResultadoCertidoes;

const CODIGOS_CERTIDAO: CodigoCertidao[] = ['cnd_federal', 'fgts', 'cndt', 'cnd_estadual', 'cnd_municipal', 'ceat'];

const COLUNAS_CICLO =
  'dgt_fornecedorhomologacaoid,_dgt_fornecedor_value,dgt_numero,dgt_motivo,dgt_etapa,dgt_etapadesde,dgt_concluidoem,dgt_protocolo,' +
  'dgt_classificacaorisco,dgt_resultadohomologacao,dgt_ressalvas,dgt_validadecadastro,dgt_verificacoes,' +
  'dgt_responsavelsuprimentos,dgt_responsavelcompliance,dgt_bancarioconferido,dgt_responsavelnome,createdon';

// Colunas do motor de fluxos (SUP-HOM). Só lidas quando já existem
// (script criar-tabelas-fornecedores.ps1 rodado de novo).
const COLUNAS_CICLO_FLUXO = 'dgt_etapaatual,dgt_prazoetapa,dgt_responsaveisetapa,dgt_fluxoestado';

const COLUNAS_CONTRATO =
  'dgt_fornecedorcontratoid,_dgt_fornecedor_value,dgt_name,dgt_projeto,dgt_dataassinatura,dgt_iniciovigencia,dgt_fimvigencia,' +
  'dgt_arquivourl,dgt_arquivonome,dgt_observacoes,dgt_situacao,dgt_origem,_dgt_documentoorigem_value,dgt_responsavelnome,createdon';

const COLUNAS_COLABORADOR =
  'dgt_fornecedorcolaboradorid,_dgt_fornecedor_value,dgt_name,dgt_funcao,dgt_cpf,dgt_observacoes,dgt_ativo,createdon';

const COLUNAS_DOC_COLABORADOR =
  'dgt_colaboradordocumentoid,_dgt_colaborador_value,dgt_tipo,dgt_norma,dgt_dataemissao,dgt_datavencimento,' +
  'dgt_arquivourl,dgt_arquivonome,dgt_observacoes,dgt_situacao,dgt_responsavelnome,createdon';

// Novos dados do colaborador (o CPF só é enviado quando informado/alterado).
export interface IDadosColaborador {
  nome: string;
  funcao: string;
  cpf: string;
  observacoes: string;
  ativo: boolean;
}

export interface INovoDocumentoColaborador {
  tipo: ITipoDocumentoFornecedor;
  norma: string;
  emissao: string;
  vencimento: string;
  observacoes: string;
  arquivo?: File;
  linkArquivo?: string;
}

// Colunas lidas do fornecedor (as protegidas voltam vazias para quem
// não está no perfil de segurança de campo).
const COLUNAS_FORNECEDOR =
  'dgt_fornecedorid,dgt_name,dgt_nomefantasia,dgt_cnpj,dgt_categoria,dgt_criticidade,dgt_status,dgt_uf,dgt_cidade,' +
  'dgt_endereco,dgt_inscricaoestadual,dgt_inscricaomunicipal,dgt_regimetributario,dgt_situacaocadastral,dgt_datasituacao,' +
  'dgt_dataabertura,dgt_naturezajuridica,dgt_porte,dgt_cnaeprincipal,dgt_contatocomercial,dgt_contatofiscal,' +
  'dgt_contatofinanceiro,dgt_observacoes,dgt_ultimaconsultacnpj,dgt_ultimaconsultasancoes,dgt_resultadosancoes,dgt_ativo,createdon,' +
  'dgt_protocolo,dgt_origem,dgt_tiposolicitacao,dgt_ficharecebidaem,dgt_cep,dgt_telefone,dgt_site,dgt_emailpedidos,' +
  'dgt_portedeclarado,dgt_categoriafornecimento,dgt_descricaofornecimento,dgt_contatointegridade,dgt_quadrosocietario,' +
  'dgt_faixafaturamento,dgt_anexosimples,dgt_previsaomudancaregime,dgt_dadosbancarios,dgt_bancarioconferido,' +
  'dgt_questionario,dgt_certificacoes,dgt_detalhamentopositivas,dgt_declaracoes,dgt_classificacaorisco,' +
  'dgt_resultadohomologacao,dgt_ressalvas,dgt_validadecadastro,dgt_verificacoes,dgt_responsavelsuprimentos,' +
  'dgt_responsavelcompliance,dgt_ultimaconsultacertidoes,dgt_resultadocertidoes,dgt_vencimentocertidoes,dgt_assinaturastatus';



// Campos do fornecedor que a tela edita (e o histórico compara).
const CAMPOS_EDITAVEIS: Array<{ campo: keyof IFornecedor; coluna: string; rotulo: string; tamanho: number }> = [
  { campo: 'razaoSocial', coluna: 'dgt_name', rotulo: 'Razão social', tamanho: 200 },
  { campo: 'nomeFantasia', coluna: 'dgt_nomefantasia', rotulo: 'Nome fantasia', tamanho: 200 },
  { campo: 'categoria', coluna: 'dgt_categoria', rotulo: 'Categoria', tamanho: 100 },
  { campo: 'criticidade', coluna: 'dgt_criticidade', rotulo: 'Criticidade', tamanho: 5 },
  { campo: 'status', coluna: 'dgt_status', rotulo: 'Status', tamanho: 50 },
  { campo: 'uf', coluna: 'dgt_uf', rotulo: 'UF', tamanho: 2 },
  { campo: 'cidade', coluna: 'dgt_cidade', rotulo: 'Cidade', tamanho: 120 },
  { campo: 'endereco', coluna: 'dgt_endereco', rotulo: 'Endereço', tamanho: 400 },
  { campo: 'inscricaoEstadual', coluna: 'dgt_inscricaoestadual', rotulo: 'Inscrição estadual', tamanho: 30 },
  { campo: 'inscricaoMunicipal', coluna: 'dgt_inscricaomunicipal', rotulo: 'Inscrição municipal', tamanho: 30 },
  { campo: 'regimeTributario', coluna: 'dgt_regimetributario', rotulo: 'Regime tributário', tamanho: 60 },
  { campo: 'observacoes', coluna: 'dgt_observacoes', rotulo: 'Observações', tamanho: 4000 },
  // Ficha SUP-CPL-01
  { campo: 'tipoSolicitacao', coluna: 'dgt_tiposolicitacao', rotulo: 'Tipo de solicitação', tamanho: 60 },
  { campo: 'cep', coluna: 'dgt_cep', rotulo: 'CEP', tamanho: 9 },
  { campo: 'telefone', coluna: 'dgt_telefone', rotulo: 'Telefone geral', tamanho: 40 },
  { campo: 'site', coluna: 'dgt_site', rotulo: 'Site', tamanho: 200 },
  { campo: 'emailPedidos', coluna: 'dgt_emailpedidos', rotulo: 'E-mail para pedidos / NF', tamanho: 200 },
  { campo: 'porteDeclarado', coluna: 'dgt_portedeclarado', rotulo: 'Porte declarado', tamanho: 30 },
  { campo: 'categoriaFornecimento', coluna: 'dgt_categoriafornecimento', rotulo: 'Categoria de fornecimento (ficha)', tamanho: 300 },
  { campo: 'descricaoFornecimento', coluna: 'dgt_descricaofornecimento', rotulo: 'Produtos / serviços', tamanho: 4000 },
  { campo: 'faixaFaturamento', coluna: 'dgt_faixafaturamento', rotulo: 'Faixa de faturamento', tamanho: 100 },
  { campo: 'anexoSimples', coluna: 'dgt_anexosimples', rotulo: 'Anexo do Simples', tamanho: 200 },
  { campo: 'previsaoMudancaRegime', coluna: 'dgt_previsaomudancaregime', rotulo: 'Previsão de mudança de regime', tamanho: 50 },
  { campo: 'certificacoes', coluna: 'dgt_certificacoes', rotulo: 'Certificações', tamanho: 2000 },
  { campo: 'detalhamentoPositivas', coluna: 'dgt_detalhamentopositivas', rotulo: 'Detalhamento das respostas positivas', tamanho: 4000 }
];

// Textos longos: o histórico diz só "alterado(a)".
const CAMPOS_LONGOS = ['observacoes', 'descricaoFornecimento', 'certificacoes', 'detalhamentoPositivas'];

export interface INovoFornecedor {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  categoria: string;
  criticidade: Criticidade;
  uf: string;
  cidade: string;
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regimeTributario: string;
  contatoComercial: IContatoFornecedor;
  contatoFiscal: IContatoFornecedor;
  contatoFinanceiro: IContatoFornecedor;
  observacoes: string;
}

export interface INovoDocumento {
  tipo: ITipoDocumentoFornecedor;
  titulo: string;
  emissao: string;
  vencimento: string;
  observacoes: string;
  arquivo?: File;
  linkArquivo?: string;
}

export class FornecedoresService {

  private readonly dataverse: DataverseService;
  private readonly envio?: SharePointDocumentoService;
  private colunasFluxoCiclo: boolean | undefined;
  private colunaAplicaA: boolean | undefined;
  private colunaTipoDocColaborador: boolean | undefined;

  public constructor(
    dataverse: DataverseService,
    spHttpClient?: SPHttpClient,
    siteUrlPortal?: string
  ) {
    this.dataverse = dataverse;
    const site = CONFIG_DOCUMENTOS_FORNECEDORES.siteUrl || siteUrlPortal || '';
    this.envio = spHttpClient && site
      ? new SharePointDocumentoService(
        spHttpClient, site, CONFIG_DOCUMENTOS_FORNECEDORES.biblioteca, CONFIG_DOCUMENTOS_FORNECEDORES.pasta)
      : undefined;
  }

  public get envioDisponivel(): boolean {
    return !!this.envio;
  }

  // ==========================================================
  // LEITURA
  // ==========================================================

  public async carregar(): Promise<IDadosFornecedores> {

    let registros: IDataverseRecord[][];

    try {
      registros = await Promise.all([
        this.dataverse.listarRegistros(TABELAS_FORN.fornecedor, `$select=${COLUNAS_FORNECEDOR}`),
        this.listarTipos(),
        this.dataverse.listarRegistros(TABELAS_FORN.documento,
          '$select=dgt_fornecedordocumentoid,dgt_name,_dgt_fornecedor_value,_dgt_tipodocumento_value,dgt_dataemissao,' +
          'dgt_datavencimento,dgt_arquivourl,dgt_arquivonome,dgt_observacoes,dgt_situacao,dgt_responsavelnome,createdon' +
          "&$filter=dgt_situacao eq 'Vigente'"),
        // Recebidos por e-mail (Fluxo 2) que ainda não foram conferidos.
        this.dataverse.listarRegistros(TABELAS_FORN.documento,
          '$select=dgt_fornecedordocumentoid,dgt_name,_dgt_fornecedor_value,_dgt_tipodocumento_value,dgt_dataemissao,' +
          'dgt_datavencimento,dgt_arquivourl,dgt_arquivonome,dgt_observacoes,dgt_situacao,dgt_responsavelnome,createdon' +
          `&$filter=dgt_situacao eq '${SITUACAO_A_CONFERIR}'`)
      ]);
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return { disponivel: false, fornecedores: [], tipos: [], tiposColaborador: [], documentos: [], aConferir: [] };
      }
      throw erro;
    }

    const [regFornecedores, regTipos, regDocumentos, regAConferir] = registros;

    const todosTipos = regTipos.map(r => this.lerTipo(r))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
    // Isolamento: tipos de colaborador NUNCA entram no que trata
    // documentos da empresa (situação, Conferir, e-mail, checklist, relatório).
    const tipos = todosTipos.filter(t => t.aplicaA !== 'Colaborador');

    const nomeTipo: Record<string, string> = {};
    tipos.forEach(t => { nomeTipo[t.id] = t.nome; });

    return {
      disponivel: true,
      fornecedores: regFornecedores.map(r => this.lerFornecedor(r))
        .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR')),
      tipos,
      tiposColaborador: todosTipos.filter(t => t.aplicaA === 'Colaborador'),
      documentos: regDocumentos.map(r => this.lerDocumento(r, nomeTipo)),
      aConferir: regAConferir.map(r => this.lerDocumento(r, nomeTipo))
    };
  }

  // Tipos de documento (com dgt_aplicaa, quando a coluna já existe).
  private async listarTipos(): Promise<IDataverseRecord[]> {
    const base =
      'dgt_tipodocumentofornecedorid,dgt_name,dgt_descricao,dgt_categorias,dgt_obrigatorio,dgt_exigevalidade,' +
      'dgt_validadedias,dgt_visibilidade,dgt_ordem,dgt_ativo,dgt_codigoconsulta';
    return this.dataverse.listarRegistros(TABELAS_FORN.tipoDocumento,
      `$select=${(await this.temColunaAplicaA()) ? `${base},dgt_aplicaa` : base}`);
  }

  // Coluna "Aplica-se a" (Empresa/Colaborador) já existe?
  public async temColunaAplicaA(): Promise<boolean> {
    if (this.colunaAplicaA === undefined) {
      try {
        await this.dataverse.listarRegistros(TABELAS_FORN.tipoDocumento, '$select=dgt_aplicaa&$top=1');
        this.colunaAplicaA = true;
      } catch {
        this.colunaAplicaA = false;
      }
    }
    return this.colunaAplicaA;
  }

  private async temColunaTipoDocColaborador(): Promise<boolean> {
    if (this.colunaTipoDocColaborador === undefined) {
      try {
        await this.dataverse.listarRegistros(TABELAS_FORN.colaboradorDocumento, '$select=_dgt_tipodocumento_value&$top=1');
        this.colunaTipoDocColaborador = true;
      } catch {
        this.colunaTipoDocColaborador = false;
      }
    }
    return this.colunaTipoDocColaborador;
  }

  // Todas as versões (inclusive substituídas) de um fornecedor.
  public async listarDocumentos(fornecedorId: string, tipos: ITipoDocumentoFornecedor[]): Promise<IDocumentoFornecedor[]> {
    const nomeTipo: Record<string, string> = {};
    tipos.forEach(t => { nomeTipo[t.id] = t.nome; });
    const regs = await this.dataverse.listarRegistros(TABELAS_FORN.documento,
      '$select=dgt_fornecedordocumentoid,dgt_name,_dgt_fornecedor_value,_dgt_tipodocumento_value,dgt_dataemissao,' +
      'dgt_datavencimento,dgt_arquivourl,dgt_arquivonome,dgt_observacoes,dgt_situacao,dgt_responsavelnome,createdon' +
      `&$filter=_dgt_fornecedor_value eq ${guid(fornecedorId)}&$orderby=createdon desc`);
    return regs.map(r => this.lerDocumento(r, nomeTipo));
  }

  public async listarConsultas(fornecedorId: string): Promise<IConsultaFornecedor[]> {
    const regs = await this.dataverse.listarRegistros(TABELAS_FORN.consulta,
      '$select=dgt_fornecedorconsultaid,_dgt_fornecedor_value,dgt_tipo,dgt_resultado,dgt_resumo,dgt_fonte,dgt_executadopor,createdon' +
      `&$filter=_dgt_fornecedor_value eq ${guid(fornecedorId)}&$orderby=createdon desc&$top=100`);
    return regs.map(r => ({
      id: guid(r.dgt_fornecedorconsultaid),
      fornecedorId: guid(r._dgt_fornecedor_value),
      tipo: (texto(r, 'dgt_tipo') || 'CNPJ') as TipoConsulta,
      resultado: texto(r, 'dgt_resultado'),
      resumo: texto(r, 'dgt_resumo'),
      fonte: texto(r, 'dgt_fonte'),
      executadoPor: texto(r, 'dgt_executadopor'),
      quando: texto(r, 'createdon')
    }));
  }

  public async listarHistorico(fornecedorId: string): Promise<IHistoricoFornecedor[]> {
    const regs = await this.dataverse.listarRegistros(TABELAS_FORN.historico,
      '$select=dgt_fornecedorhistoricoid,dgt_name,dgt_descricao,dgt_usuarionome,createdon' +
      `&$filter=_dgt_fornecedor_value eq ${guid(fornecedorId)}&$orderby=createdon desc&$top=200`);
    return regs.map(r => ({
      id: guid(r.dgt_fornecedorhistoricoid),
      acao: texto(r, 'dgt_name'),
      descricao: texto(r, 'dgt_descricao'),
      usuario: texto(r, 'dgt_usuarionome'),
      quando: texto(r, 'createdon')
    }));
  }

  // ==========================================================
  // CONSULTAS EXTERNAS (Custom API → plugin)
  // ==========================================================

  // Antes de cadastrar: o CNPJ já existe? O que a Receita (CNPJá) diz?
  public async consultarPrevia(cnpj: string): Promise<IResultadoPrevia> {
    const numero = normalizarCnpj(cnpj);
    if (!cnpjValido(numero)) {
      throw new Error('CNPJ inválido.');
    }
    try {
      return await this.dataverse.chamarCustomApiJson(API_CONSULTAR_FORNECEDOR, { acao: 'previa', cnpj: numero }) as IResultadoPrevia;
    } catch (erro) {
      throw new Error(mensagemErro(erro));
    }
  }

  public async consultar(
    fornecedorId: string,
    consultas: Array<'cnpj' | 'sancoes' | CodigoCertidao>,
    usuarioNome: string
  ): Promise<IResultadoConsulta> {
    try {
      return await this.dataverse.chamarCustomApiJson(API_CONSULTAR_FORNECEDOR, {
        acao: 'consultar',
        fornecedorId: guid(fornecedorId),
        consultas,
        usuarioNome: limitar(usuarioNome, 200)
      }) as IResultadoConsulta;
    } catch (erro) {
      throw new Error(mensagemErro(erro));
    }
  }

  // ==========================================================
  // GRAVAÇÃO — FORNECEDOR
  // ==========================================================

  public async criarFornecedor(dados: INovoFornecedor, usuarioNome: string): Promise<string> {

    const cnpj = normalizarCnpj(dados.cnpj);
    if (!cnpjValido(cnpj)) {
      throw new Error('CNPJ inválido.');
    }
    if (!dados.razaoSocial.trim()) {
      throw new Error('Informe a razão social.');
    }
    if (!dados.categoria) {
      throw new Error('Escolha a categoria do fornecedor.');
    }

    verificarSensivel(
      dados.observacoes,
      gravarContato(dados.contatoComercial),
      gravarContato(dados.contatoFiscal),
      gravarContato(dados.contatoFinanceiro)
    );

    // Duplicidade conferida no servidor (o plugin lê todos os CNPJs).
    const previa = await this.consultarPrevia(cnpj).catch(() => undefined);
    if (previa && previa.existente) {
      throw new Error(
        `Este CNPJ já está cadastrado como "${previa.existente.razaoSocial}"` +
        (previa.existente.ativo ? '.' : ' (inativo — reative o cadastro existente).'));
    }

    const id = await this.dataverse.criarRegistro(TABELAS_FORN.fornecedor, {
      dgt_name: limitar(dados.razaoSocial, 200),
      dgt_cnpj: cnpj,
      dgt_nomefantasia: limitar(dados.nomeFantasia, 200),
      dgt_categoria: limitar(dados.categoria, 100),
      dgt_criticidade: dados.criticidade || '',
      dgt_status: 'Em homologação',
      dgt_uf: limitar(dados.uf, 2).toUpperCase(),
      dgt_cidade: limitar(dados.cidade, 120),
      dgt_endereco: limitar(dados.endereco, 400),
      dgt_inscricaoestadual: limitar(dados.inscricaoEstadual, 30),
      dgt_inscricaomunicipal: limitar(dados.inscricaoMunicipal, 30),
      dgt_regimetributario: limitar(dados.regimeTributario, 60),
      dgt_contatocomercial: gravarContato(dados.contatoComercial),
      dgt_contatofiscal: gravarContato(dados.contatoFiscal),
      dgt_contatofinanceiro: gravarContato(dados.contatoFinanceiro),
      dgt_observacoes: limitar(dados.observacoes, 4000),
      dgt_resultadosancoes: 'Não consultado',
      dgt_responsavelnome: limitar(usuarioNome, 200),
      dgt_ativo: true
    });

    await this.registrarHistorico(id, 'Cadastro', `Fornecedor cadastrado (categoria ${dados.categoria}).`, usuarioNome);
    return id;
  }

  public async atualizarFornecedor(
    novo: IFornecedor,
    anterior: IFornecedor,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {

    if (!motivo.trim()) {
      throw new Error('Informe o motivo da alteração.');
    }
    if (!novo.razaoSocial.trim()) {
      throw new Error('A razão social não pode ficar vazia.');
    }

    const dados: Record<string, unknown> = {};
    const mudancas: string[] = [];
    // Só o que a pessoa mudou passa pelo bloqueio de dados sensíveis (o
    // texto que veio do formulário do fornecedor não trava a edição).
    const textosAlterados: string[] = [motivo];

    CAMPOS_EDITAVEIS.forEach(c => {
      const valorNovo = limitar(String(novo[c.campo] || ''), c.tamanho);
      const valorAntigo = String(anterior[c.campo] || '').trim();
      if (valorNovo !== valorAntigo) {
        dados[c.coluna] = c.campo === 'uf' ? valorNovo.toUpperCase() : valorNovo;
        textosAlterados.push(valorNovo);
        mudancas.push(CAMPOS_LONGOS.indexOf(c.campo) >= 0
          ? `${c.rotulo}: alterado(a)`
          : `${c.rotulo}: "${valorAntigo || '—'}" → "${valorNovo || '—'}"`);
      }
    });

    const contatos: Array<{ campo: 'contatoComercial' | 'contatoFiscal' | 'contatoFinanceiro' | 'contatoIntegridade'; coluna: string; rotulo: string }> = [
      { campo: 'contatoComercial', coluna: 'dgt_contatocomercial', rotulo: 'Contato comercial' },
      { campo: 'contatoFiscal', coluna: 'dgt_contatofiscal', rotulo: 'Contato fiscal/contábil' },
      { campo: 'contatoFinanceiro', coluna: 'dgt_contatofinanceiro', rotulo: 'Contato financeiro' },
      { campo: 'contatoIntegridade', coluna: 'dgt_contatointegridade', rotulo: 'Contato integridade/compliance' }
    ];
    contatos.forEach(c => {
      const valorNovo = gravarContato(novo[c.campo]);
      if (valorNovo !== gravarContato(anterior[c.campo])) {
        dados[c.coluna] = valorNovo;
        textosAlterados.push(valorNovo);
        mudancas.push(`${c.rotulo}: alterado`);
      }
    });

    // Item 8 da ficha (declarações): antes → depois de cada campo.
    const decNova = novo.declaracoes;
    const decAntiga = anterior.declaracoes;
    if (decNova && JSON.stringify(decNova) !== JSON.stringify(decAntiga || {})) {
      const vazia: IDeclaracoesFicha = { aceitas: false, representante: '', cargo: '', local: '', data: '' };
      const antes = { ...vazia, ...(decAntiga || {}) };
      const limpa: IDeclaracoesFicha = {
        aceitas: !!decNova.aceitas,
        representante: limitar(decNova.representante, 200),
        cargo: limitar(decNova.cargo, 120),
        local: limitar(decNova.local, 120),
        data: soData(decNova.data)
      };
      const rotulos: Array<{ chave: keyof IDeclaracoesFicha; rotulo: string }> = [
        { chave: 'aceitas', rotulo: 'Declarações aceitas' },
        { chave: 'representante', rotulo: 'Representante legal' },
        { chave: 'cargo', rotulo: 'Cargo do representante' },
        { chave: 'local', rotulo: 'Local das declarações' },
        { chave: 'data', rotulo: 'Data das declarações' }
      ];
      const exibir = (v: unknown): string => (typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v || '').trim() || '—');
      const diferencas = rotulos.filter(r => exibir(limpa[r.chave]) !== exibir(antes[r.chave]));
      if (diferencas.length > 0) {
        dados.dgt_declaracoes = JSON.stringify(limpa);
        textosAlterados.push(limpa.representante, limpa.cargo, limpa.local);
        diferencas.forEach(r => mudancas.push(`${r.rotulo}: "${exibir(antes[r.chave])}" → "${exibir(limpa[r.chave])}"`));
      }
    }

    verificarSensivel(...textosAlterados);

    if (novo.ativo !== anterior.ativo) {
      dados.dgt_ativo = novo.ativo;
      mudancas.push(novo.ativo ? 'Cadastro reativado' : 'Cadastro desativado');
    }

    if (mudancas.length === 0) {
      return;
    }

    await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, novo.id, dados);

    const acao = novo.status !== anterior.status
      ? `Status: ${novo.status}`
      : novo.ativo !== anterior.ativo
        ? (novo.ativo ? 'Reativação' : 'Desativação')
        : 'Alteração';

    await this.registrarHistorico(novo.id, acao, `${mudancas.join('\n')}\nMotivo: ${limitar(motivo, 1000)}`, usuarioNome);
  }

  // ==========================================================
  // GRAVAÇÃO — FICHA (questionário, quadro societário, bancário)
  // ==========================================================

  public async salvarQuestionario(
    fornecedor: IFornecedor,
    respostas: Record<string, RespostaQuestionario>,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    if (!motivo.trim()) {
      throw new Error('Informe o motivo da alteração.');
    }
    verificarSensivel(motivo);
    const alteradas = Object.keys({ ...fornecedor.questionario, ...respostas })
      .filter(k => (respostas[k] || '') !== (fornecedor.questionario[k] || ''))
      .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
    if (alteradas.length === 0) {
      return;
    }
    await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, fornecedor.id, {
      dgt_questionario: JSON.stringify(respostas).substring(0, 2000)
    });
    await this.registrarHistorico(fornecedor.id, 'Questionário alterado',
      `${alteradas.map(k => `${k}: "${fornecedor.questionario[k] || '—'}" → "${respostas[k] || '—'}"`).join('\n')}\nMotivo: ${limitar(motivo, 1000)}`,
      usuarioNome);
  }

  // Coluna protegida: o histórico registra só QUE mudou, nunca os valores.
  public async salvarQuadroSocietario(
    fornecedor: IFornecedor,
    quadro: IQuadroSocietario,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    if (!motivo.trim()) {
      throw new Error('Informe o motivo da alteração.');
    }
    verificarSensivel(motivo);
    const limpo: IQuadroSocietario = {
      socios: quadro.socios
        .filter(s => s.nome.trim())
        .map(s => ({
          nome: limitar(s.nome, 200),
          cargo: limitar(s.cargo, 120),
          cpf: (s.cpf || '').replace(/\D/g, '').substring(0, 11),
          participacao: limitar(s.participacao, 20)
        })),
      participaOutras: quadro.participaOutras,
      outrasSociedades: limitar(quadro.outrasSociedades, 1500),
      grupoEconomico: quadro.grupoEconomico,
      grupoEconomicoDetalhe: limitar(quadro.grupoEconomicoDetalhe, 1500)
    };
    await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, fornecedor.id, {
      dgt_quadrosocietario: JSON.stringify(limpo)
    });
    await this.registrarHistorico(fornecedor.id, 'Quadro societário alterado',
      `${limpo.socios.length} sócio(s)/administrador(es) no quadro (valores na coluna protegida).\nMotivo: ${limitar(motivo, 1000)}`, usuarioNome);
  }

  // Coluna protegida. Toda alteração volta para "não conferido": a ficha
  // exige confirmação por contato telefônico independente.
  public async salvarDadosBancarios(
    fornecedor: IFornecedor,
    dados: IDadosBancarios,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    if (!motivo.trim()) {
      throw new Error('Informe o motivo da alteração (ex.: solicitação formal assinada recebida em dd/mm).');
    }
    verificarSensivel(motivo);
    const limpo: IDadosBancarios = {
      banco: limitar(dados.banco, 120),
      agencia: limitar(dados.agencia, 20),
      conta: limitar(dados.conta, 30),
      tipoChavePix: limitar(dados.tipoChavePix, 30),
      chavePix: limitar(dados.chavePix, 120),
      titular: limitar(dados.titular, 200),
      cnpjTitular: normalizarCnpj(dados.cnpjTitular || '')
    };
    if (limpo.cnpjTitular && !cnpjValido(limpo.cnpjTitular)) {
      throw new Error('CNPJ do titular inválido.');
    }
    await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, fornecedor.id, {
      dgt_dadosbancarios: JSON.stringify(limpo),
      dgt_bancarioconferido: false
    });
    await this.registrarHistorico(fornecedor.id, 'Dados bancários alterados',
      'Dados bancários alterados (valores na coluna protegida). Confirmar por contato telefônico independente antes de pagar.' +
      `\nMotivo: ${limitar(motivo, 1000)}`, usuarioNome);
  }

  // ==========================================================
  // PEDIDO DE DOCUMENTOS (botão do administrador, aba Ficha)
  //
  // Grava o e-mail na fila padrão (o fluxo central envia). Para: sempre
  // o "E-mail para pedidos / NF"; de: sempre fornecedores@ (sem a coluna
  // do remetente, não grava). O histórico não leva o endereço.
  // ==========================================================

  public async solicitarDocumentos(
    fornecedor: IFornecedor,
    documentos: string[],
    observacao: string,
    usuarioNome: string
  ): Promise<void> {
    const para = destinatarioPedido(fornecedor);
    const lista = documentos.map(d => limitar(d, 200)).filter(Boolean);
    const validacao = validarPedidoDocumentos(fornecedor, lista);
    if (!validacao.ok) {
      throw new Error(validacao.erro);
    }
    verificarSensivel(observacao, ...lista);

    const linha: Record<string, unknown> = {
      dgt_name: assuntoPedidoDocumentos(fornecedor),
      dgt_para: para.substring(0, 320),
      dgt_corpo: corpoPedidoDocumentos(fornecedor, lista, limitar(observacao, 1500)),
      dgt_tipo: TIPO_EMAIL_PEDIDO_DOCUMENTOS,
      dgt_motivo: `pedidoDocs:${fornecedor.id}:${new Date().getTime()}`.substring(0, 200),
      dgt_status: 'Pendente',
      dgt_remetente: REMETENTE_FORNECEDORES
    };

    try {
      await this.dataverse.criarRegistro('dgt_implemail', linha);
    } catch (erro) {
      const m = erro instanceof Error ? erro.message : String(erro);
      if (/dgt_remetente/i.test(m)) {
        // Sem a coluna, o e-mail sairia pela conta padrão, não de fornecedores@.
        throw new Error('A fila de e-mails ainda não tem a coluna do remetente (dgt_remetente). Rode scripts/dataverse/criar-tabelas-fornecedores.ps1.');
      } else if (/403|privilege|prvCreate|permiss/i.test(m)) {
        throw new Error('Sem permissão para gravar na fila de e-mails (dgt_implemail). Peça ao administrador o privilégio Criar nessa tabela.');
      } else {
        throw erro;
      }
    }

    await this.registrarHistorico(fornecedor.id, 'Documentos solicitados por e-mail',
      `De: ${EMAIL_DOCUMENTOS_FORNECEDORES} · Para: e-mail para pedidos / NF\nDocumentos:\n${lista.map(d => `• ${d}`).join('\n')}` +
      (observacao.trim() ? `\nObservação: ${limitar(observacao, 1000)}` : ''), usuarioNome);
  }

  // ==========================================================
  // HOMOLOGAÇÃO — CICLOS (kanban; administrador do módulo grava)
  //
  // Um card = um ciclo (dgt_fornecedorhomologacao). Transição manual.
  // Ao concluir, o resultado vai também para o cadastro do fornecedor
  // (status, risco, validade...), que é o que lista e cabeçalho mostram.
  // Ciclo concluído não muda mais: renovação abre um ciclo novo.
  // ==========================================================

  // Sem fornecedorId: todos os ciclos abertos e os concluídos nos
  // últimos "diasConcluidos" dias (quadro geral do módulo).
  public async listarCiclos(fornecedorId?: string, diasConcluidos: number = 60): Promise<{ disponivel: boolean; ciclos: ICicloHomologacao[] }> {
    let filtro: string;
    if (fornecedorId) {
      filtro = `_dgt_fornecedor_value eq ${guid(fornecedorId)}`;
    } else {
      const corte = new Date(Date.now() - diasConcluidos * 86400000).toISOString();
      filtro = `(dgt_concluidoem eq null or dgt_concluidoem ge ${corte})`;
    }
    try {
      const colunas = (await this.temColunasFluxoCiclo()) ? `${COLUNAS_CICLO},${COLUNAS_CICLO_FLUXO}` : COLUNAS_CICLO;
      const regs = await this.dataverse.listarRegistros(TABELAS_FORN.ciclo,
        `$select=${colunas}&$filter=${filtro}&$orderby=dgt_numero desc`);
      return { disponivel: true, ciclos: regs.map(r => this.lerCiclo(r)) };
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return { disponivel: false, ciclos: [] };
      }
      throw new Error(mensagemErro(erro));
    }
  }

  // As colunas do motor (dgt_fluxoestado…) já existem no Dataverse?
  public async temColunasFluxoCiclo(): Promise<boolean> {
    if (this.colunasFluxoCiclo === undefined) {
      try {
        await this.dataverse.listarRegistros(TABELAS_FORN.ciclo, `$select=${COLUNAS_CICLO_FLUXO}&$top=1`);
        this.colunasFluxoCiclo = true;
      } catch {
        this.colunasFluxoCiclo = false;
      }
    }
    return this.colunasFluxoCiclo;
  }

  // Abre o card na primeira coluna. A etapa a partir daí segue o motor
  // de fluxos (HomologacaoFluxoService.iniciar, chamado pela tela).
  public async iniciarCiclo(
    fornecedor: IFornecedor,
    ciclos: ICicloHomologacao[],
    motivo: string,
    usuarioNome: string
  ): Promise<string> {
    if (ciclos.some(c => !c.concluidoEm)) {
      throw new Error('Este fornecedor já tem um ciclo de homologação em aberto.');
    }
    if (!motivo.trim()) {
      throw new Error('Escolha o motivo do ciclo.');
    }
    const numero = proximoNumeroCiclo(ciclos);
    const id = await this.dataverse.criarRegistro(TABELAS_FORN.ciclo, {
      dgt_name: limitar(`Ciclo ${numero} — ${motivo}`, 200),
      'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
      dgt_numero: numero,
      dgt_motivo: limitar(motivo, 60),
      dgt_etapa: 'Ficha recebida',
      dgt_etapadesde: new Date().toISOString(),
      dgt_protocolo: limitar(fornecedor.protocolo, 30),
      dgt_classificacaorisco: fornecedor.classificacaoRisco || '',
      dgt_resultadohomologacao: 'Pendente',
      dgt_bancarioconferido: false,
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });
    await this.registrarHistorico(fornecedor.id, 'Homologação: ciclo aberto',
      `Ciclo ${numero} (${motivo}) aberto.`, usuarioNome);
    return guid(id);
  }

  // Homologação feita antes do kanban (campos do cadastro) → ciclo 1
  // concluído, para o histórico não começar vazio.
  public async registrarCicloAnterior(fornecedor: IFornecedor, usuarioNome: string): Promise<void> {
    const resultado = fornecedor.resultadoHomologacao;
    if (resultado !== 'Aprovado' && resultado !== 'Aprovado com ressalvas' && resultado !== 'Reprovado') {
      throw new Error('O cadastro não tem uma homologação concluída para registrar.');
    }
    await this.dataverse.criarRegistro(TABELAS_FORN.ciclo, {
      dgt_name: 'Ciclo 1 — homologação anterior ao kanban',
      'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
      dgt_numero: 1,
      dgt_motivo: 'Homologação anterior ao kanban',
      dgt_etapa: 'Concluído',
      dgt_etapadesde: new Date().toISOString(),
      dgt_concluidoem: new Date().toISOString(),
      dgt_protocolo: limitar(fornecedor.protocolo, 30),
      dgt_classificacaorisco: fornecedor.classificacaoRisco || '',
      dgt_resultadohomologacao: resultado,
      dgt_ressalvas: limitar(fornecedor.ressalvas, 4000),
      dgt_validadecadastro: fornecedor.validadeCadastro || null,
      dgt_verificacoes: JSON.stringify(fornecedor.verificacoes || {}).substring(0, 4000),
      dgt_responsavelsuprimentos: limitar(fornecedor.responsavelSuprimentos, 200),
      dgt_responsavelcompliance: limitar(fornecedor.responsavelCompliance, 200),
      dgt_bancarioconferido: fornecedor.bancarioConferido,
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });
    await this.registrarHistorico(fornecedor.id, 'Homologação: ciclo anterior registrado',
      `A homologação que já estava no cadastro (${resultado}) virou o ciclo 1, concluído.`, usuarioNome);
  }

  private dadosDoCiclo(d: IDadosHomologacao): Record<string, unknown> {
    return {
      dgt_classificacaorisco: d.classificacaoRisco || '',
      dgt_resultadohomologacao: d.resultadoHomologacao || 'Pendente',
      dgt_ressalvas: limitar(d.ressalvas, 4000),
      dgt_validadecadastro: d.validadeCadastro || null,
      dgt_verificacoes: JSON.stringify(d.verificacoes || {}).substring(0, 4000),
      dgt_responsavelsuprimentos: limitar(d.responsavelSuprimentos, 200),
      dgt_responsavelcompliance: limitar(d.responsavelCompliance, 200)
    };
  }

  // Grava o card sem concluir. A conferência bancária é do CADASTRO
  // (volta a "não" quando os dados bancários mudam).
  public async salvarCiclo(
    ciclo: ICicloHomologacao,
    fornecedor: IFornecedor,
    d: IDadosHomologacao,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    if (ciclo.concluidoEm) {
      throw new Error('Ciclo concluído é somente leitura.');
    }
    if (!motivo.trim()) {
      throw new Error('Informe o motivo / referência da alteração.');
    }
    verificarSensivel(d.ressalvas, d.responsavelSuprimentos, d.responsavelCompliance, motivo);

    await this.dataverse.atualizarRegistro(TABELAS_FORN.ciclo, ciclo.id, this.dadosDoCiclo(d));
    if (d.bancarioConferido !== fornecedor.bancarioConferido) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, fornecedor.id, { dgt_bancarioconferido: d.bancarioConferido });
    }

    const linhas: string[] = [];
    if ((d.resultadoHomologacao || 'Pendente') !== ciclo.resultadoHomologacao) { linhas.push(`Resultado: "${ciclo.resultadoHomologacao}" → "${d.resultadoHomologacao || 'Pendente'}"`); }
    if (d.classificacaoRisco !== ciclo.classificacaoRisco) { linhas.push(`Risco: "${ciclo.classificacaoRisco || '—'}" → "${d.classificacaoRisco || '—'}"`); }
    if (d.validadeCadastro !== ciclo.validadeCadastro) { linhas.push(`Validade do cadastro: ${d.validadeCadastro || '—'}`); }
    if (d.bancarioConferido !== fornecedor.bancarioConferido) { linhas.push(d.bancarioConferido ? 'Dados bancários conferidos (contato telefônico)' : 'Conferência bancária desmarcada'); }
    linhas.push(`Verificações OK: ${verificacoesOk(d)} de 9`);

    await this.registrarHistorico(fornecedor.id, 'Homologação atualizada',
      `Ciclo ${ciclo.numero} (${ciclo.etapa})\n${linhas.join('\n')}\nMotivo: ${limitar(motivo, 1000)}`, usuarioNome);
  }

  // Leva o card para "Homologado / Reprovado" e fecha o ciclo.
  public async concluirCiclo(
    ciclo: ICicloHomologacao,
    fornecedor: IFornecedor,
    d: IDadosHomologacao,
    motivo: string,
    usuarioNome: string
  ): Promise<StatusFornecedor> {
    if (ciclo.concluidoEm) {
      throw new Error('Este ciclo já foi concluído.');
    }
    if (!motivo.trim()) {
      throw new Error('Informe o motivo / referência do parecer.');
    }
    const problema = validarConclusao(d);
    if (problema) {
      throw new Error(problema);
    }
    verificarSensivel(d.ressalvas, d.responsavelSuprimentos, d.responsavelCompliance, motivo);

    const resultado = d.resultadoHomologacao;
    const status = statusPeloResultado(resultado, fornecedor.status);
    const agora = new Date().toISOString();

    await this.dataverse.atualizarRegistro(TABELAS_FORN.ciclo, ciclo.id, {
      ...this.dadosDoCiclo(d),
      dgt_etapa: 'Concluído',
      dgt_etapadesde: agora,
      dgt_concluidoem: agora,
      dgt_bancarioconferido: d.bancarioConferido
    });

    await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, fornecedor.id, {
      dgt_classificacaorisco: d.classificacaoRisco || '',
      dgt_resultadohomologacao: resultado,
      dgt_ressalvas: limitar(d.ressalvas, 4000),
      dgt_validadecadastro: d.validadeCadastro || null,
      dgt_verificacoes: JSON.stringify(d.verificacoes || {}).substring(0, 4000),
      dgt_responsavelsuprimentos: limitar(d.responsavelSuprimentos, 200),
      dgt_responsavelcompliance: limitar(d.responsavelCompliance, 200),
      dgt_bancarioconferido: d.bancarioConferido,
      dgt_status: status
    });

    const linhas = [
      `Ciclo ${ciclo.numero} (${ciclo.motivo}) concluído: ${resultado}`,
      `Risco: ${d.classificacaoRisco || '—'} · validade do cadastro: ${d.validadeCadastro || '—'}`,
      `Verificações OK: ${verificacoesOk(d)} de 9`
    ];
    if (status !== fornecedor.status) { linhas.push(`Status: "${fornecedor.status}" → "${status}"`); }
    await this.registrarHistorico(fornecedor.id, `Homologação: ${resultado}`,
      `${linhas.join('\n')}\nMotivo: ${limitar(motivo, 1000)}`, usuarioNome);

    return status;
  }

  // ==========================================================
  // COLABORADORES DO PRESTADOR (CPF em coluna protegida)
  // ==========================================================

  public async listarColaboradores(fornecedorId: string): Promise<{
    disponivel: boolean;
    colaboradores: IColaboradorFornecedor[];
    documentos: IDocumentoColaborador[];
  }> {
    let colaboradores: IColaboradorFornecedor[];
    try {
      const regs = await this.dataverse.listarRegistros(TABELAS_FORN.colaborador,
        `$select=${COLUNAS_COLABORADOR}&$filter=_dgt_fornecedor_value eq ${guid(fornecedorId)}&$orderby=dgt_name asc`);
      colaboradores = regs.map(r => this.lerColaborador(r));
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return { disponivel: false, colaboradores: [], documentos: [] };
      }
      throw new Error(mensagemErro(erro));
    }

    // Documentos de todos os colaboradores, em blocos (filtro OR por id).
    const documentos: IDocumentoColaborador[] = [];
    for (let i = 0; i < colaboradores.length; i += 20) {
      const filtro = colaboradores.slice(i, i + 20).map(c => `_dgt_colaborador_value eq ${c.id}`).join(' or ');
      const colunas = (await this.temColunaTipoDocColaborador()) ? `${COLUNAS_DOC_COLABORADOR},_dgt_tipodocumento_value` : COLUNAS_DOC_COLABORADOR;
      const regs = await this.dataverse.listarRegistros(TABELAS_FORN.colaboradorDocumento,
        `$select=${colunas}&$filter=${filtro}&$orderby=createdon desc`);
      regs.forEach(r => documentos.push(this.lerDocumentoColaborador(r)));
    }
    return { disponivel: true, colaboradores, documentos };
  }

  public async salvarColaborador(
    fornecedor: IFornecedor,
    dados: IDadosColaborador,
    anterior: IColaboradorFornecedor | undefined,
    outros: IColaboradorFornecedor[],
    usuarioNome: string
  ): Promise<void> {
    const nome = limitar(dados.nome, 200);
    if (!nome) {
      throw new Error('Informe o nome do colaborador.');
    }
    const cpf = normalizarCpf(dados.cpf);
    if (cpf && !cpfValido(cpf)) {
      throw new Error('CPF inválido (confira os dígitos).');
    }
    if (cpf && outros.some(o => o.id !== (anterior ? anterior.id : '') && o.cpf === cpf)) {
      throw new Error('Já existe um colaborador com este CPF neste fornecedor.');
    }
    // CPF só no campo próprio; nunca em texto livre.
    verificarSensivel(dados.funcao, dados.observacoes);

    const registro: Record<string, unknown> = {
      dgt_name: nome,
      dgt_funcao: limitar(dados.funcao, 120),
      dgt_observacoes: limitar(dados.observacoes, 2000),
      dgt_ativo: dados.ativo
    };
    // Quem não lê o CPF (perfil de segurança de campo) vê vazio: vazio
    // não apaga o que está gravado.
    const cpfMudou = !!cpf && (!anterior || cpf !== anterior.cpf);
    if (cpfMudou) {
      registro.dgt_cpf = cpf;
    }

    if (anterior) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.colaborador, anterior.id, registro);
      const mudancas: string[] = [];
      if (nome !== anterior.nome) { mudancas.push(`Nome: "${anterior.nome}" → "${nome}"`); }
      if (limitar(dados.funcao, 120) !== anterior.funcao) { mudancas.push(`Função: "${anterior.funcao || '—'}" → "${limitar(dados.funcao, 120) || '—'}"`); }
      if (cpfMudou) { mudancas.push(anterior.cpf ? 'CPF alterado (valor na coluna protegida)' : 'CPF informado (valor na coluna protegida)'); }
      if (limitar(dados.observacoes, 2000) !== anterior.observacoes) { mudancas.push('Observações alteradas'); }
      if (dados.ativo !== anterior.ativo) { mudancas.push(dados.ativo ? 'Reativado' : 'Desativado'); }
      if (mudancas.length > 0) {
        await this.registrarHistorico(fornecedor.id, 'Colaborador alterado', `${nome}\n${mudancas.join('\n')}`, usuarioNome);
      }
      return;
    }

    await this.dataverse.criarRegistro(TABELAS_FORN.colaborador, {
      ...registro,
      'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });
    await this.registrarHistorico(fornecedor.id, 'Colaborador cadastrado',
      `${nome}${dados.funcao ? ` (${limitar(dados.funcao, 120)})` : ''}${cpf ? ' — CPF na coluna protegida' : ' — sem CPF'}.`, usuarioNome);
  }

  // Tipo CADASTRADO (aplica-se a Colaborador). "NR aplicável" pede a
  // norma. Nova versão do mesmo tipo (ou da mesma norma) deixa a anterior
  // Substituída.
  public async registrarDocumentoColaborador(
    fornecedor: IFornecedor,
    colaborador: IColaboradorFornecedor,
    dados: INovoDocumentoColaborador,
    documentosDoColaborador: IDocumentoColaborador[],
    tiposColaborador: ITipoDocumentoFornecedor[],
    usuarioNome: string
  ): Promise<void> {
    const tipo = dados.tipo;
    if (!tipo || !tipo.id || tipo.aplicaA !== 'Colaborador') {
      throw new Error('Escolha um tipo de documento de colaborador.');
    }
    const exigeNorma = tipoExigeNorma(tipo.nome);
    const norma = exigeNorma ? limitar(dados.norma, 120) : '';
    if (exigeNorma && !norma) {
      throw new Error('Informe qual NR se aplica a este colaborador (ex.: NR-10, NR-35).');
    }
    if (!dados.emissao) {
      throw new Error('Informe a data de emissão.');
    }
    if (tipo.exigeValidade && !dados.vencimento) {
      throw new Error(`"${tipo.nome}" exige data de validade.`);
    }
    if (dados.vencimento && dados.vencimento < dados.emissao) {
      throw new Error('A validade não pode ser anterior à emissão.');
    }
    if (!dados.arquivo && !(dados.linkArquivo || '').trim()) {
      throw new Error('Anexe o arquivo (ou informe o link dele no SharePoint).');
    }
    if (dados.linkArquivo && !/^https:\/\//i.test(dados.linkArquivo.trim())) {
      throw new Error('O link do arquivo precisa começar com https://');
    }
    verificarSensivel(norma, dados.observacoes);

    const rotulo = norma ? `${tipo.nome} — ${norma}` : tipo.nome;
    let arquivoUrl = (dados.linkArquivo || '').trim();
    let arquivoNome = '';
    if (dados.arquivo) {
      const pastaColaborador = `${limitar(colaborador.nome, 80)} (${colaborador.id.substring(0, 8)})`;
      const enviado = await this.enviarArquivo(
        [this.pastaFornecedor(fornecedor), 'Colaboradores', pastaColaborador],
        `${norma ? `NR ${norma.replace(/^NR[-\s]*/i, '')}` : limitar(tipo.nome, 60)} - ${dados.emissao}`,
        dados.arquivo);
      arquivoUrl = enviado.url;
      arquivoNome = enviado.nome;
    }

    const registro: Record<string, unknown> = {
      dgt_name: limitar(rotulo, 200),
      'dgt_Colaborador@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.colaborador, colaborador.id),
      dgt_tipo: limitar(tipo.nome, 30),
      dgt_norma: norma,
      dgt_dataemissao: dados.emissao,
      dgt_datavencimento: dados.vencimento || null,
      dgt_arquivourl: limitar(arquivoUrl, 2000),
      dgt_arquivonome: limitar(arquivoNome, 255),
      dgt_observacoes: limitar(dados.observacoes, 2000),
      dgt_situacao: 'Vigente',
      dgt_responsavelnome: limitar(usuarioNome, 200)
    };
    if (await this.temColunaTipoDocColaborador()) {
      registro['dgt_TipoDocumento@odata.bind'] = await this.dataverse.referenciaLookup(TABELAS_FORN.tipoDocumento, tipo.id);
    }
    await this.dataverse.criarRegistro(TABELAS_FORN.colaboradorDocumento, registro);

    // Versão anterior do mesmo tipo (ou da mesma norma) → Substituído.
    const chave = chaveDocumento({ tipoId: tipo.id, tipo: tipo.nome, norma }, tiposColaborador);
    const anteriores = documentosDoColaborador.filter(d => d.situacao === 'Vigente' && chaveDocumento(d, tiposColaborador) === chave);
    for (const anterior of anteriores) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.colaboradorDocumento, anterior.id, { dgt_situacao: 'Substituído' });
    }

    await this.registrarHistorico(fornecedor.id, anteriores.length > 0 ? 'Colaborador: documento renovado' : 'Colaborador: documento registrado',
      `${colaborador.nome} — ${rotulo}: emissão ${dados.emissao}${dados.vencimento ? `, validade ${dados.vencimento}` : ', sem validade'}.`, usuarioNome);
  }

  // ==========================================================
  // GRAVAÇÃO — DOCUMENTOS
  // ==========================================================

  public async registrarDocumento(
    fornecedor: IFornecedor,
    dados: INovoDocumento,
    vigentesDoTipo: IDocumentoFornecedor[],
    usuarioNome: string
  ): Promise<void> {

    const tipo = dados.tipo;

    if (!dados.emissao) {
      throw new Error('Informe a data de emissão do documento.');
    }
    if (tipo.exigeValidade && !dados.vencimento) {
      throw new Error(`"${tipo.nome}" exige data de validade.`);
    }
    if (dados.vencimento && dados.vencimento < dados.emissao) {
      throw new Error('A validade não pode ser anterior à emissão.');
    }
    if (!dados.arquivo && !(dados.linkArquivo || '').trim()) {
      throw new Error('Anexe o arquivo (ou informe o link dele no SharePoint).');
    }
    if (dados.linkArquivo && !/^https:\/\//i.test(dados.linkArquivo.trim())) {
      throw new Error('O link do arquivo precisa começar com https://');
    }

    verificarSensivel(dados.titulo, dados.observacoes);

    let arquivoUrl = (dados.linkArquivo || '').trim();
    let arquivoNome = '';

    if (dados.arquivo) {
      const enviado = await this.enviarArquivo([this.pastaFornecedor(fornecedor)], `${limitar(tipo.nome, 80)} - ${dados.emissao}`, dados.arquivo);
      arquivoUrl = enviado.url;
      arquivoNome = enviado.nome;
    }

    await this.dataverse.criarRegistro(TABELAS_FORN.documento, {
      dgt_name: limitar(dados.titulo || tipo.nome, 200),
      'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
      'dgt_TipoDocumento@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.tipoDocumento, tipo.id),
      dgt_dataemissao: dados.emissao,
      dgt_datavencimento: dados.vencimento || null,
      dgt_arquivourl: limitar(arquivoUrl, 2000),
      dgt_arquivonome: limitar(arquivoNome, 255),
      dgt_observacoes: limitar(dados.observacoes, 4000),
      dgt_situacao: 'Vigente',
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });

    // A versão anterior do mesmo tipo fica no histórico como Substituída.
    for (const anterior of vigentesDoTipo) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.documento, anterior.id, { dgt_situacao: 'Substituído' });
    }

    await this.registrarHistorico(
      fornecedor.id,
      vigentesDoTipo.length > 0 ? 'Documento renovado' : 'Documento registrado',
      `${tipo.nome}: emissão ${dados.emissao}${dados.vencimento ? `, validade ${dados.vencimento}` : ', sem validade'}.`,
      usuarioNome);
  }

  // Documento recebido por e-mail ("A conferir"): a analista informa o
  // tipo e as datas; o registro passa a Vigente e substitui a versão
  // anterior do mesmo tipo. O arquivo já está na pasta do fornecedor.
  public async conferirDocumento(
    fornecedor: IFornecedor,
    recebido: IDocumentoFornecedor,
    dados: { tipo: ITipoDocumentoFornecedor; emissao: string; vencimento: string; observacoes: string },
    vigentesDoTipo: IDocumentoFornecedor[],
    usuarioNome: string
  ): Promise<void> {

    const tipo = dados.tipo;

    if (recebido.situacao !== SITUACAO_A_CONFERIR) {
      throw new Error('Este documento já foi conferido ou descartado. Atualize a tela.');
    }
    if (!tipo || !tipo.id) {
      throw new Error('Escolha o tipo do documento.');
    }
    if (!dados.emissao) {
      throw new Error('Informe a data de emissão do documento.');
    }
    if (tipo.exigeValidade && !dados.vencimento) {
      throw new Error(`"${tipo.nome}" exige data de validade.`);
    }
    if (dados.vencimento && dados.vencimento < dados.emissao) {
      throw new Error('A validade não pode ser anterior à emissão.');
    }

    verificarSensivel(dados.observacoes);

    const observacoes = [recebido.observacoes, (dados.observacoes || '').trim()].filter(Boolean).join(' ');

    await this.dataverse.atualizarRegistro(TABELAS_FORN.documento, recebido.id, {
      dgt_name: limitar(tipo.nome, 200),
      'dgt_TipoDocumento@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.tipoDocumento, tipo.id),
      dgt_dataemissao: dados.emissao,
      dgt_datavencimento: dados.vencimento || null,
      dgt_observacoes: limitar(observacoes, 4000),
      dgt_situacao: 'Vigente',
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });

    for (const anterior of vigentesDoTipo.filter(d => d.id !== recebido.id)) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.documento, anterior.id, { dgt_situacao: 'Substituído' });
    }

    await this.registrarHistorico(
      fornecedor.id,
      'Documento conferido',
      `${tipo.nome} (arquivo recebido por e-mail: ${recebido.arquivoNome || recebido.titulo}): emissão ${dados.emissao}` +
      `${dados.vencimento ? `, validade ${dados.vencimento}` : ', sem validade'}.`,
      usuarioNome);
  }

  // Anexo que não é documento (logo, assinatura, arquivo errado). O
  // arquivo continua na pasta do SharePoint; só sai da fila.
  public async descartarDocumento(
    fornecedor: IFornecedor,
    recebido: IDocumentoFornecedor,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    if (recebido.situacao !== SITUACAO_A_CONFERIR) {
      throw new Error('Este documento já foi conferido ou descartado. Atualize a tela.');
    }
    const texto = (motivo || '').trim();
    if (!texto) {
      throw new Error('Informe o motivo do descarte.');
    }
    verificarSensivel(texto);
    await this.dataverse.atualizarRegistro(TABELAS_FORN.documento, recebido.id, {
      dgt_situacao: 'Descartado',
      dgt_observacoes: limitar(`${recebido.observacoes} Descartado: ${texto}`.trim(), 4000),
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });
    await this.registrarHistorico(
      fornecedor.id,
      'Documento descartado',
      `${recebido.arquivoNome || recebido.titulo}: ${texto}`,
      usuarioNome);
  }

  // ==========================================================
  // RELATÓRIO DE HOMOLOGAÇÃO (PDF) — arquivamento
  // Pasta do fornecedor › "Homologação". Cada emissão entra na lista
  // dgt_relatoriosjson do ciclo e no histórico. O relatório FINAL (na
  // conclusão) também vira documento do tipo "Relatório de
  // homologação"; as prévias não (não substituem versões).
  // ==========================================================

  public async listarRelatorios(cicloId: string): Promise<{ disponivel: boolean; relatorios: IRelatorioEmitido[] }> {
    try {
      const lido = await this.dataverse.obterRegistro(TABELAS_FORN.ciclo, cicloId, ['dgt_relatoriosjson']);
      const lista = lido ? lerJson<IRelatorioEmitido[]>(texto(lido.registro, 'dgt_relatoriosjson')) : undefined;
      return { disponivel: true, relatorios: Array.isArray(lista) ? lista : [] };
    } catch {
      return { disponivel: false, relatorios: [] };
    }
  }

  public async arquivarRelatorio(
    fornecedor: IFornecedor,
    ciclo: ICicloHomologacao,
    pdf: Blob,
    nomeArquivo: string,
    meta: { fase: string; final: boolean; geradoPor: string; emitidoEm: Date }
  ): Promise<{ relatorio: IRelatorioEmitido; avisos: string[] }> {

    const avisos: string[] = [];
    const arquivo = new File([pdf], nomeArquivo, { type: 'application/pdf' });
    const enviado = await this.enviarArquivo(
      [this.pastaFornecedor(fornecedor), 'Homologação'],
      nomeArquivo.replace(/\.pdf$/i, ''),
      arquivo);

    const relatorio: IRelatorioEmitido = {
      emitidoEm: meta.emitidoEm.toISOString(),
      fase: meta.fase,
      nome: enviado.nome || nomeArquivo,
      url: enviado.url,
      geradoPor: meta.geradoPor,
      final: meta.final
    };

    // Lista do ciclo (sem a coluna: o arquivo fica no SharePoint e avisa).
    try {
      const atual = await this.listarRelatorios(ciclo.id);
      if (!atual.disponivel) {
        throw new Error('coluna dgt_relatoriosjson não encontrada');
      }
      await this.dataverse.atualizarRegistro(TABELAS_FORN.ciclo, ciclo.id, {
        dgt_relatoriosjson: JSON.stringify(atual.relatorios.concat([relatorio])).substring(0, 100000)
      });
    } catch (erro) {
      avisos.push(`O relatório foi salvo no SharePoint, mas não entrou na lista do ciclo (rode de novo criar-tabelas-fornecedores.ps1): ${mensagemErro(erro)}`);
    }

    await this.registrarHistorico(fornecedor.id, `Relatório de homologação emitido (fase ${meta.fase})`,
      `Ciclo ${ciclo.numero}${meta.final ? ' — relatório final' : ' — prévia'}: ${relatorio.nome}`, meta.geradoPor);

    if (meta.final) {
      try {
        await this.registrarRelatorioComoDocumento(fornecedor, relatorio, meta.geradoPor);
      } catch (erro) {
        avisos.push(`O relatório final foi salvo, mas não foi registrado em Documentos: ${mensagemErro(erro)}`);
      }
    }

    return { relatorio, avisos };
  }

  private async registrarRelatorioComoDocumento(fornecedor: IFornecedor, relatorio: IRelatorioEmitido, usuarioNome: string): Promise<void> {
    const nomeTipo = NOME_TIPO_RELATORIO_HOMOLOGACAO.replace(/'/g, "''");
    const tipos = await this.dataverse.listarRegistros(TABELAS_FORN.tipoDocumento,
      `$select=dgt_tipodocumentofornecedorid,dgt_name&$filter=dgt_name eq '${nomeTipo}'&$top=1`);
    if (tipos.length === 0) {
      throw new Error(`tipo "${NOME_TIPO_RELATORIO_HOMOLOGACAO}" não existe (rode de novo criar-tabelas-fornecedores.ps1).`);
    }
    const tipoId = guid(tipos[0].dgt_tipodocumentofornecedorid);
    const emissao = relatorio.emitidoEm.substring(0, 10);

    const anteriores = await this.dataverse.listarRegistros(TABELAS_FORN.documento,
      `$select=dgt_fornecedordocumentoid&$filter=_dgt_fornecedor_value eq ${guid(fornecedor.id)} and _dgt_tipodocumento_value eq ${tipoId} and dgt_situacao eq 'Vigente'`);

    await this.dataverse.criarRegistro(TABELAS_FORN.documento, {
      dgt_name: NOME_TIPO_RELATORIO_HOMOLOGACAO,
      'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
      'dgt_TipoDocumento@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.tipoDocumento, tipoId),
      dgt_dataemissao: emissao,
      dgt_datavencimento: null,
      dgt_arquivourl: limitar(relatorio.url, 2000),
      dgt_arquivonome: limitar(relatorio.nome, 255),
      dgt_observacoes: limitar(`Relatório final do ciclo (${relatorio.fase}).`, 4000),
      dgt_situacao: 'Vigente',
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });
    for (const anterior of anteriores) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.documento, guid(anterior.dgt_fornecedordocumentoid), { dgt_situacao: 'Substituído' });
    }
  }

  // ==========================================================
  // CONTRATOS (dgt_fornecedorcontrato)
  // Vários por fornecedor. Encerrar em vez de excluir. Arquivo na
  // pasta do fornecedor, subpasta "Contratos".
  // ==========================================================

  // Sem fornecedorId: todos (visão Contratos do módulo).
  public async listarContratos(fornecedorId?: string): Promise<{ disponivel: boolean; contratos: IContratoFornecedor[] }> {
    const filtro = fornecedorId ? `&$filter=_dgt_fornecedor_value eq ${guid(fornecedorId)}` : '';
    try {
      const regs = await this.dataverse.listarRegistros(TABELAS_FORN.contrato, `$select=${COLUNAS_CONTRATO}${filtro}`);
      return { disponivel: true, contratos: regs.map(r => this.lerContrato(r)) };
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return { disponivel: false, contratos: [] };
      }
      throw new Error(mensagemErro(erro));
    }
  }

  private corpoContrato(d: IDadosContrato): Record<string, unknown> {
    return {
      dgt_name: limitar(d.nome, 200),
      dgt_projeto: limitar(d.projeto, 200),
      dgt_dataassinatura: d.dataAssinatura || null,
      dgt_iniciovigencia: d.inicioVigencia || null,
      dgt_fimvigencia: d.fimVigencia || null,
      dgt_observacoes: limitar(d.observacoes, 4000)
    };
  }

  private descreverContrato(d: IDadosContrato): string {
    return `${d.nome} · projeto ${d.projeto} · vigência ${d.inicioVigencia || '—'} a ${d.fimVigencia || 'indeterminado'}` +
      `${d.dataAssinatura ? ` · assinado em ${d.dataAssinatura}` : ''}`;
  }

  // Novo (contrato undefined) ou edição. Arquivo: envio ou link.
  public async salvarContrato(
    fornecedor: IFornecedor,
    contrato: IContratoFornecedor | undefined,
    d: IDadosContrato,
    arquivo: { arquivo?: File; link?: string },
    usuarioNome: string
  ): Promise<void> {
    const problema = validarContrato(d);
    if (problema) {
      throw new Error(problema);
    }
    if (contrato && contrato.situacao === 'Encerrado') {
      throw new Error('Contrato encerrado não pode ser alterado.');
    }
    const link = (arquivo.link || '').trim();
    if (link && !/^https:\/\//i.test(link)) {
      throw new Error('O link do arquivo precisa começar com https://');
    }
    verificarSensivel(d.nome, d.projeto, d.observacoes);

    const corpo = this.corpoContrato(d);
    if (arquivo.arquivo) {
      const enviado = await this.enviarArquivo(
        [this.pastaFornecedor(fornecedor), 'Contratos'],
        `${limitar(d.nome, 80)} - ${d.inicioVigencia}`,
        arquivo.arquivo);
      corpo.dgt_arquivourl = limitar(enviado.url, 2000);
      corpo.dgt_arquivonome = limitar(enviado.nome, 255);
    } else if (link) {
      corpo.dgt_arquivourl = limitar(link, 2000);
    }

    if (!contrato) {
      await this.dataverse.criarRegistro(TABELAS_FORN.contrato, {
        ...corpo,
        'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
        dgt_situacao: 'Vigente',
        dgt_origem: 'Manual',
        dgt_responsavelnome: limitar(usuarioNome, 200)
      });
      await this.registrarHistorico(fornecedor.id, 'Contrato registrado', this.descreverContrato(d), usuarioNome);
      return;
    }

    await this.dataverse.atualizarRegistro(TABELAS_FORN.contrato, contrato.id, corpo);
    await this.registrarHistorico(fornecedor.id, 'Contrato alterado', this.descreverContrato(d), usuarioNome);
  }

  public async encerrarContrato(
    fornecedor: IFornecedor,
    contrato: IContratoFornecedor,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    const texto = (motivo || '').trim();
    if (!texto) {
      throw new Error('Informe o motivo do encerramento.');
    }
    if (contrato.situacao === 'Encerrado') {
      throw new Error('Este contrato já está encerrado.');
    }
    verificarSensivel(texto);
    await this.dataverse.atualizarRegistro(TABELAS_FORN.contrato, contrato.id, {
      dgt_situacao: 'Encerrado',
      dgt_observacoes: limitar(`${contrato.observacoes} Encerrado: ${texto}`.trim(), 4000)
    });
    await this.registrarHistorico(fornecedor.id, 'Contrato encerrado', `${contrato.nome} (${contrato.projeto}): ${texto}`, usuarioNome);
  }

  // Item da fila "A conferir" que é um contrato (ex.: retorno do
  // Clicksign): cria o contrato com o MESMO arquivo e tira o item da fila.
  public async converterEmContrato(
    fornecedor: IFornecedor,
    recebido: IDocumentoFornecedor,
    d: IDadosContrato,
    usuarioNome: string
  ): Promise<void> {
    if (recebido.situacao !== SITUACAO_A_CONFERIR) {
      throw new Error('Este documento já foi conferido ou descartado. Atualize a tela.');
    }
    const problema = validarContrato(d);
    if (problema) {
      throw new Error(problema);
    }
    verificarSensivel(d.nome, d.projeto, d.observacoes);

    await this.dataverse.criarRegistro(TABELAS_FORN.contrato, {
      ...this.corpoContrato(d),
      'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedor.id),
      'dgt_DocumentoOrigem@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.documento, recebido.id),
      dgt_arquivourl: limitar(recebido.arquivoUrl, 2000),
      dgt_arquivonome: limitar(recebido.arquivoNome || recebido.titulo, 255),
      dgt_situacao: 'Vigente',
      dgt_origem: 'E-mail',
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });

    await this.dataverse.atualizarRegistro(TABELAS_FORN.documento, recebido.id, {
      dgt_situacao: SITUACAO_CONVERTIDO_CONTRATO,
      dgt_observacoes: limitar(`${recebido.observacoes} Convertido no contrato "${d.nome}".`.trim(), 4000),
      dgt_responsavelnome: limitar(usuarioNome, 200)
    });

    await this.registrarHistorico(fornecedor.id, 'Contrato registrado (arquivo recebido por e-mail)',
      `${this.descreverContrato(d)} · arquivo ${recebido.arquivoNome || recebido.titulo}`, usuarioNome);
  }

  // ==========================================================
  // GRAVAÇÃO — TIPOS DE DOCUMENTO (Administrador do módulo)
  // ==========================================================

  public async salvarTipo(tipo: ITipoDocumentoFornecedor): Promise<void> {
    if (!tipo.nome.trim()) {
      throw new Error('Informe o nome do tipo de documento.');
    }
    verificarSensivel(tipo.nome, tipo.descricao);

    const colaborador = tipo.aplicaA === 'Colaborador';
    const comColuna = await this.temColunaAplicaA();
    if (colaborador && !comColuna) {
      throw new Error('Tipos de colaborador exigem a coluna "Aplica-se a": rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1.');
    }

    const dados: Record<string, unknown> = {
      dgt_name: limitar(tipo.nome, 200),
      dgt_descricao: limitar(tipo.descricao, 2000),
      // Categorias, visibilidade e consulta automática não se aplicam a colaborador.
      dgt_categorias: colaborador ? '' : limitar(tipo.categorias.join(';'), 500),
      dgt_obrigatorio: tipo.obrigatorio,
      dgt_exigevalidade: tipo.exigeValidade,
      dgt_validadedias: tipo.validadeDias && tipo.validadeDias > 0 ? Math.round(tipo.validadeDias) : null,
      dgt_visibilidade: tipo.visibilidade,
      dgt_ordem: Math.round(tipo.ordem || 0),
      dgt_ativo: tipo.ativo,
      dgt_codigoconsulta: colaborador ? null : (tipo.codigoConsulta || null)
    };
    if (comColuna) {
      dados.dgt_aplicaa = colaborador ? 'Colaborador' : 'Empresa';
    }

    if (tipo.id) {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.tipoDocumento, tipo.id, dados);
    } else {
      await this.dataverse.criarRegistro(TABELAS_FORN.tipoDocumento, dados);
    }
  }

  // Cria os tipos sugeridos que ainda não existem (pelo nome) e liga a
  // consulta automática nos que já existem sem ela.
  public async importarTiposSugeridos(existentes: ITipoDocumentoFornecedor[]): Promise<number> {
    let alterados = 0;
    for (const sugerido of TIPOS_SUGERIDOS) {
      const existente = existentes.filter(t => t.nome.trim().toLowerCase() === sugerido.nome.trim().toLowerCase())[0];
      if (!existente) {
        await this.salvarTipo({ ...sugerido, id: '', ativo: true });
        alterados++;
      } else if (sugerido.codigoConsulta && !existente.codigoConsulta) {
        await this.salvarTipo({ ...existente, codigoConsulta: sugerido.codigoConsulta });
        alterados++;
      }
    }
    return alterados;
  }

  // ==========================================================
  // AUXILIARES
  // ==========================================================

  private pastaFornecedor(fornecedor: IFornecedor): string {
    return `${limitar(fornecedor.razaoSocial, 80)} (${fornecedor.id.substring(0, 8)})`;
  }

  // Envia ao SharePoint de Suprimentos (permissão de quem anexa).
  private async enviarArquivo(pastas: string[], nomeSemExtensao: string, arquivo: File): Promise<{ url: string; nome: string }> {
    if (!this.envio) {
      throw new Error('O envio de arquivos não está disponível nesta página. Informe o link do arquivo.');
    }
    const extensao = /\.[^.]+$/.exec(arquivo.name);
    try {
      const enviado = await this.envio.enviarArquivoEmPasta(pastas, `${nomeSemExtensao}${extensao ? extensao[0] : ''}`, arquivo);
      return { url: enviado.arquivoUrl, nome: enviado.nomeArquivo };
    } catch (erro) {
      const m = erro instanceof Error ? erro.message : String(erro);
      throw new Error(
        /\b(401|403|404)\b/.test(m)
          ? 'Não foi possível gravar na pasta "Contratos Fornecedores" do site de Suprimentos ' +
            '(sem permissão de edição ou pasta inexistente). Peça acesso a Suprimentos ou informe o link do arquivo.'
          : m);
    }
  }

  // Passo do fluxo de homologação no histórico do fornecedor.
  public async registrarHistoricoFluxo(fornecedorId: string, acao: string, descricao: string, usuarioNome: string): Promise<void> {
    await this.registrarHistorico(fornecedorId, acao, descricao, usuarioNome);
  }

  private async registrarHistorico(fornecedorId: string, acao: string, descricao: string, usuarioNome: string): Promise<void> {
    try {
      await this.dataverse.criarRegistro(TABELAS_FORN.historico, {
        dgt_name: limitar(acao, 200),
        'dgt_Fornecedor@odata.bind': await this.dataverse.referenciaLookup(TABELAS_FORN.fornecedor, fornecedorId),
        dgt_descricao: limitar(descricao, 4000),
        dgt_usuarionome: limitar(usuarioNome, 200)
      });
    } catch {
      // O histórico não pode impedir a gravação principal, que já foi feita.
    }
  }

  private lerFornecedor(r: IDataverseRecord): IFornecedor {
    return {
      id: guid(r.dgt_fornecedorid),
      razaoSocial: texto(r, 'dgt_name'),
      nomeFantasia: texto(r, 'dgt_nomefantasia'),
      cnpj: texto(r, 'dgt_cnpj'),
      categoria: texto(r, 'dgt_categoria'),
      criticidade: (texto(r, 'dgt_criticidade') as Criticidade) || '',
      status: statusValido(texto(r, 'dgt_status')),
      uf: texto(r, 'dgt_uf'),
      cidade: texto(r, 'dgt_cidade'),
      endereco: texto(r, 'dgt_endereco'),
      inscricaoEstadual: texto(r, 'dgt_inscricaoestadual'),
      inscricaoMunicipal: texto(r, 'dgt_inscricaomunicipal'),
      regimeTributario: texto(r, 'dgt_regimetributario'),
      situacaoCadastral: texto(r, 'dgt_situacaocadastral'),
      dataSituacao: soData(texto(r, 'dgt_datasituacao')),
      dataAbertura: soData(texto(r, 'dgt_dataabertura')),
      naturezaJuridica: texto(r, 'dgt_naturezajuridica'),
      porte: texto(r, 'dgt_porte'),
      cnaePrincipal: texto(r, 'dgt_cnaeprincipal'),
      contatoComercial: lerContato(texto(r, 'dgt_contatocomercial')),
      contatoFiscal: lerContato(texto(r, 'dgt_contatofiscal')),
      contatoFinanceiro: lerContato(texto(r, 'dgt_contatofinanceiro')),
      observacoes: texto(r, 'dgt_observacoes'),
      ultimaConsultaCnpj: texto(r, 'dgt_ultimaconsultacnpj'),
      ultimaConsultaSancoes: texto(r, 'dgt_ultimaconsultasancoes'),
      resultadoSancoes: resultadoValido(texto(r, 'dgt_resultadosancoes')),
      ativo: r.dgt_ativo !== false,
      criadoEm: texto(r, 'createdon'),

      protocolo: texto(r, 'dgt_protocolo'),
      origem: texto(r, 'dgt_origem') || 'Portal',
      tipoSolicitacao: texto(r, 'dgt_tiposolicitacao'),
      fichaRecebidaEm: texto(r, 'dgt_ficharecebidaem'),
      cep: texto(r, 'dgt_cep'),
      telefone: texto(r, 'dgt_telefone'),
      site: texto(r, 'dgt_site'),
      emailPedidos: texto(r, 'dgt_emailpedidos'),
      porteDeclarado: texto(r, 'dgt_portedeclarado'),
      categoriaFornecimento: texto(r, 'dgt_categoriafornecimento'),
      descricaoFornecimento: texto(r, 'dgt_descricaofornecimento'),
      contatoIntegridade: lerContato(texto(r, 'dgt_contatointegridade')),
      quadroSocietario: lerJson<IQuadroSocietario>(texto(r, 'dgt_quadrosocietario')),
      faixaFaturamento: texto(r, 'dgt_faixafaturamento'),
      anexoSimples: texto(r, 'dgt_anexosimples'),
      previsaoMudancaRegime: texto(r, 'dgt_previsaomudancaregime'),
      dadosBancarios: lerJson<IDadosBancarios>(texto(r, 'dgt_dadosbancarios')),
      bancarioConferido: r.dgt_bancarioconferido === true,
      questionario: lerJson<Record<string, RespostaQuestionario>>(texto(r, 'dgt_questionario')) || {},
      certificacoes: texto(r, 'dgt_certificacoes'),
      detalhamentoPositivas: texto(r, 'dgt_detalhamentopositivas'),
      declaracoes: lerJson<IDeclaracoesFicha>(texto(r, 'dgt_declaracoes')),
      classificacaoRisco: (['Baixo', 'Médio', 'Alto'].indexOf(texto(r, 'dgt_classificacaorisco')) >= 0
        ? texto(r, 'dgt_classificacaorisco') : '') as ClassificacaoRisco,
      resultadoHomologacao: (RESULTADOS_HOMOLOGACAO.indexOf(texto(r, 'dgt_resultadohomologacao') as ResultadoHomologacao) >= 0
        ? texto(r, 'dgt_resultadohomologacao') : '') as ResultadoHomologacao,
      ressalvas: texto(r, 'dgt_ressalvas'),
      validadeCadastro: soData(texto(r, 'dgt_validadecadastro')),
      verificacoes: lerJson<Partial<Record<IdVerificacao, IVerificacao>>>(texto(r, 'dgt_verificacoes')) || {},
      responsavelSuprimentos: texto(r, 'dgt_responsavelsuprimentos'),
      responsavelCompliance: texto(r, 'dgt_responsavelcompliance'),
      ultimaConsultaCertidoes: texto(r, 'dgt_ultimaconsultacertidoes'),
      resultadoCertidoes: resultadoCertidoesValido(texto(r, 'dgt_resultadocertidoes')),
      vencimentoCertidoes: soData(texto(r, 'dgt_vencimentocertidoes')),
      assinaturaStatus: texto(r, 'dgt_assinaturastatus')
    };
  }

  private lerCiclo(r: IDataverseRecord): ICicloHomologacao {
    return {
      id: guid(r.dgt_fornecedorhomologacaoid),
      fornecedorId: guid(r._dgt_fornecedor_value),
      numero: Number(r.dgt_numero) || 0,
      motivo: texto(r, 'dgt_motivo'),
      etapa: etapaValida(texto(r, 'dgt_etapa')),
      etapaDesde: texto(r, 'dgt_etapadesde') || texto(r, 'createdon'),
      concluidoEm: texto(r, 'dgt_concluidoem'),
      protocolo: texto(r, 'dgt_protocolo'),
      classificacaoRisco: (['Baixo', 'Médio', 'Alto'].indexOf(texto(r, 'dgt_classificacaorisco')) >= 0
        ? texto(r, 'dgt_classificacaorisco') : '') as ClassificacaoRisco,
      resultadoHomologacao: (RESULTADOS_HOMOLOGACAO.indexOf(texto(r, 'dgt_resultadohomologacao') as ResultadoHomologacao) >= 0
        ? texto(r, 'dgt_resultadohomologacao') : 'Pendente') as ResultadoHomologacao,
      ressalvas: texto(r, 'dgt_ressalvas'),
      validadeCadastro: soData(texto(r, 'dgt_validadecadastro')),
      verificacoes: lerJson<Partial<Record<IdVerificacao, IVerificacao>>>(texto(r, 'dgt_verificacoes')) || {},
      responsavelSuprimentos: texto(r, 'dgt_responsavelsuprimentos'),
      responsavelCompliance: texto(r, 'dgt_responsavelcompliance'),
      bancarioConferido: r.dgt_bancarioconferido === true,
      abertoPor: texto(r, 'dgt_responsavelnome'),
      criadoEm: texto(r, 'createdon'),
      fluxoIniciado: !!texto(r, 'dgt_fluxoestado'),
      etapaAtual: texto(r, 'dgt_etapaatual'),
      prazoEtapa: texto(r, 'dgt_prazoetapa'),
      responsaveisEtapa: texto(r, 'dgt_responsaveisetapa')
    };
  }

  private lerContrato(r: IDataverseRecord): IContratoFornecedor {
    return {
      id: guid(r.dgt_fornecedorcontratoid),
      fornecedorId: guid(r._dgt_fornecedor_value),
      nome: texto(r, 'dgt_name'),
      projeto: texto(r, 'dgt_projeto'),
      dataAssinatura: soData(texto(r, 'dgt_dataassinatura')),
      inicioVigencia: soData(texto(r, 'dgt_iniciovigencia')),
      fimVigencia: soData(texto(r, 'dgt_fimvigencia')),
      arquivoUrl: texto(r, 'dgt_arquivourl'),
      arquivoNome: texto(r, 'dgt_arquivonome'),
      observacoes: texto(r, 'dgt_observacoes'),
      situacao: texto(r, 'dgt_situacao') === 'Encerrado' ? 'Encerrado' : 'Vigente',
      origem: (texto(r, 'dgt_origem') === 'E-mail' ? 'E-mail' : 'Manual') as OrigemContrato,
      documentoOrigemId: guid(r._dgt_documentoorigem_value),
      registradoPor: texto(r, 'dgt_responsavelnome'),
      criadoEm: texto(r, 'createdon')
    };
  }

  private lerColaborador(r: IDataverseRecord): IColaboradorFornecedor {
    return {
      id: guid(r.dgt_fornecedorcolaboradorid),
      fornecedorId: guid(r._dgt_fornecedor_value),
      nome: texto(r, 'dgt_name'),
      funcao: texto(r, 'dgt_funcao'),
      cpf: normalizarCpf(texto(r, 'dgt_cpf')),
      observacoes: texto(r, 'dgt_observacoes'),
      ativo: r.dgt_ativo !== false,
      criadoEm: texto(r, 'createdon')
    };
  }

  private lerDocumentoColaborador(r: IDataverseRecord): IDocumentoColaborador {
    return {
      id: guid(r.dgt_colaboradordocumentoid),
      colaboradorId: guid(r._dgt_colaborador_value),
      tipoId: guid(r._dgt_tipodocumento_value),
      tipo: texto(r, 'dgt_tipo'),
      norma: texto(r, 'dgt_norma'),
      emissao: soData(texto(r, 'dgt_dataemissao')),
      vencimento: soData(texto(r, 'dgt_datavencimento')),
      arquivoUrl: texto(r, 'dgt_arquivourl'),
      arquivoNome: texto(r, 'dgt_arquivonome'),
      observacoes: texto(r, 'dgt_observacoes'),
      situacao: lerSituacaoDocumento(texto(r, 'dgt_situacao')),
      registradoPor: texto(r, 'dgt_responsavelnome'),
      criadoEm: texto(r, 'createdon')
    };
  }

  private lerTipo(r: IDataverseRecord): ITipoDocumentoFornecedor {
    const dias = Number(r.dgt_validadedias);
    return {
      id: guid(r.dgt_tipodocumentofornecedorid),
      aplicaA: texto(r, 'dgt_aplicaa') === 'Colaborador' ? 'Colaborador' : 'Empresa',
      nome: texto(r, 'dgt_name'),
      descricao: texto(r, 'dgt_descricao'),
      categorias: lerCategorias(texto(r, 'dgt_categorias')),
      obrigatorio: r.dgt_obrigatorio === true,
      exigeValidade: r.dgt_exigevalidade === true,
      validadeDias: dias > 0 ? dias : undefined,
      visibilidade: (texto(r, 'dgt_visibilidade') === 'Externo' ? 'Externo' : 'Interno') as Visibilidade,
      ordem: Number(r.dgt_ordem) || 0,
      ativo: r.dgt_ativo !== false,
      codigoConsulta: (CODIGOS_CERTIDAO.indexOf(texto(r, 'dgt_codigoconsulta') as CodigoCertidao) >= 0
        ? texto(r, 'dgt_codigoconsulta') : '') as CodigoCertidao | ''
    };
  }

  private lerDocumento(r: IDataverseRecord, nomeTipo: Record<string, string>): IDocumentoFornecedor {
    const tipoId = guid(r._dgt_tipodocumento_value);
    return {
      id: guid(r.dgt_fornecedordocumentoid),
      fornecedorId: guid(r._dgt_fornecedor_value),
      tipoId,
      tipoNome: nomeTipo[tipoId] || texto(r, '_dgt_tipodocumento_value@OData.Community.Display.V1.FormattedValue') || 'Documento',
      titulo: texto(r, 'dgt_name'),
      emissao: soData(texto(r, 'dgt_dataemissao')),
      vencimento: soData(texto(r, 'dgt_datavencimento')),
      arquivoUrl: texto(r, 'dgt_arquivourl'),
      arquivoNome: texto(r, 'dgt_arquivonome'),
      observacoes: texto(r, 'dgt_observacoes'),
      situacao: lerSituacaoDocumento(texto(r, 'dgt_situacao')),
      registradoPor: texto(r, 'dgt_responsavelnome'),
      criadoEm: texto(r, 'createdon')
    };
  }
}
