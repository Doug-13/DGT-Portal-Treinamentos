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
  CodigoCertidao,
  Criticidade,
  IDadosBancarios,
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
  ResultadoSancoes,
  STATUS_FORNECEDOR,
  StatusFornecedor,
  TABELAS_FORN,
  TIPOS_SUGERIDOS,
  TipoConsulta,
  Visibilidade
} from './modeloFornecedores';

import {
  statusPeloResultado
} from './homologacao';

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

const CODIGOS_CERTIDAO: CodigoCertidao[] = ['cnd_federal', 'fgts', 'cndt', 'cnd_estadual', 'cnd_municipal'];

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

// Dados do item 9 (uso interno) que o administrador do módulo grava.
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
        this.dataverse.listarRegistros(TABELAS_FORN.tipoDocumento,
          '$select=dgt_tipodocumentofornecedorid,dgt_name,dgt_descricao,dgt_categorias,dgt_obrigatorio,dgt_exigevalidade,' +
          'dgt_validadedias,dgt_visibilidade,dgt_ordem,dgt_ativo,dgt_codigoconsulta'),
        this.dataverse.listarRegistros(TABELAS_FORN.documento,
          '$select=dgt_fornecedordocumentoid,dgt_name,_dgt_fornecedor_value,_dgt_tipodocumento_value,dgt_dataemissao,' +
          'dgt_datavencimento,dgt_arquivourl,dgt_arquivonome,dgt_observacoes,dgt_situacao,dgt_responsavelnome,createdon' +
          "&$filter=dgt_situacao eq 'Vigente'")
      ]);
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return { disponivel: false, fornecedores: [], tipos: [], documentos: [] };
      }
      throw erro;
    }

    const [regFornecedores, regTipos, regDocumentos] = registros;

    const tipos = regTipos.map(r => this.lerTipo(r))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

    const nomeTipo: Record<string, string> = {};
    tipos.forEach(t => { nomeTipo[t.id] = t.nome; });

    return {
      disponivel: true,
      fornecedores: regFornecedores.map(r => this.lerFornecedor(r))
        .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR')),
      tipos,
      documentos: regDocumentos.map(r => this.lerDocumento(r, nomeTipo))
    };
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
  // GRAVAÇÃO — HOMOLOGAÇÃO (item 9; administrador do módulo)
  // ==========================================================

  public async salvarHomologacao(
    fornecedor: IFornecedor,
    dados: IDadosHomologacao,
    motivo: string,
    usuarioNome: string
  ): Promise<StatusFornecedor> {

    const resultado: ResultadoHomologacao = dados.resultadoHomologacao || 'Pendente';
    const aprovado = resultado === 'Aprovado' || resultado === 'Aprovado com ressalvas';

    if (!motivo.trim()) {
      throw new Error('Informe o motivo / referência do parecer.');
    }
    if (aprovado && !dados.classificacaoRisco) {
      throw new Error('Defina a classificação de risco antes de aprovar.');
    }
    if (aprovado && !dados.validadeCadastro) {
      throw new Error('Informe a validade do cadastro / próxima revisão antes de aprovar.');
    }
    if ((resultado === 'Aprovado com ressalvas' || resultado === 'Reprovado') && !dados.ressalvas.trim()) {
      throw new Error('Descreva as ressalvas, medidas de mitigação ou a referência ao parecer.');
    }
    verificarSensivel(dados.ressalvas, dados.responsavelSuprimentos, dados.responsavelCompliance, motivo);

    const status = statusPeloResultado(resultado, fornecedor.status);

    await this.dataverse.atualizarRegistro(TABELAS_FORN.fornecedor, fornecedor.id, {
      dgt_classificacaorisco: dados.classificacaoRisco || '',
      dgt_resultadohomologacao: resultado,
      dgt_ressalvas: limitar(dados.ressalvas, 4000),
      dgt_validadecadastro: dados.validadeCadastro || null,
      dgt_verificacoes: JSON.stringify(dados.verificacoes || {}).substring(0, 4000),
      dgt_responsavelsuprimentos: limitar(dados.responsavelSuprimentos, 200),
      dgt_responsavelcompliance: limitar(dados.responsavelCompliance, 200),
      dgt_bancarioconferido: dados.bancarioConferido,
      dgt_status: status
    });

    const linhas: string[] = [];
    if (resultado !== fornecedor.resultadoHomologacao) { linhas.push(`Resultado: "${fornecedor.resultadoHomologacao || '—'}" → "${resultado}"`); }
    if (dados.classificacaoRisco !== fornecedor.classificacaoRisco) { linhas.push(`Risco: "${fornecedor.classificacaoRisco || '—'}" → "${dados.classificacaoRisco || '—'}"`); }
    if (dados.validadeCadastro !== fornecedor.validadeCadastro) { linhas.push(`Validade do cadastro: ${dados.validadeCadastro || '—'}`); }
    if (dados.bancarioConferido !== fornecedor.bancarioConferido) { linhas.push(dados.bancarioConferido ? 'Dados bancários conferidos (contato telefônico)' : 'Conferência bancária desmarcada'); }
    if (status !== fornecedor.status) { linhas.push(`Status: "${fornecedor.status}" → "${status}"`); }
    const verificacoes = dados.verificacoes || {};
    const marcadas = Object.keys(verificacoes).filter(k => (verificacoes as Record<string, IVerificacao>)[k].ok).length;
    linhas.push(`Verificações OK: ${marcadas} de 9`);

    await this.registrarHistorico(fornecedor.id, status !== fornecedor.status ? `Homologação: ${resultado}` : 'Homologação atualizada',
      `${linhas.join('\n')}\nMotivo: ${limitar(motivo, 1000)}`, usuarioNome);

    return status;
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
      if (!this.envio) {
        throw new Error('O envio de arquivos não está disponível nesta página. Informe o link do arquivo.');
      }
      const extensao = /\.[^.]+$/.exec(dados.arquivo.name);
      const pastaFornecedor = `${limitar(fornecedor.razaoSocial, 80)} (${fornecedor.id.substring(0, 8)})`;
      const nome = `${limitar(tipo.nome, 80)} - ${dados.emissao}${extensao ? extensao[0] : ''}`;
      try {
        const enviado = await this.envio.enviarArquivoEmPasta([pastaFornecedor], nome, dados.arquivo);
        arquivoUrl = enviado.arquivoUrl;
        arquivoNome = enviado.nomeArquivo;
      } catch (erro) {
        const m = erro instanceof Error ? erro.message : String(erro);
        throw new Error(
          /\b(401|403|404)\b/.test(m)
            ? 'Não foi possível gravar na pasta "Contratos Fornecedores" do site de Suprimentos ' +
              '(sem permissão de edição ou pasta inexistente). Peça acesso a Suprimentos ou informe o link do arquivo.'
            : m);
      }
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

  // ==========================================================
  // GRAVAÇÃO — TIPOS DE DOCUMENTO (Administrador do módulo)
  // ==========================================================

  public async salvarTipo(tipo: ITipoDocumentoFornecedor): Promise<void> {
    if (!tipo.nome.trim()) {
      throw new Error('Informe o nome do tipo de documento.');
    }
    verificarSensivel(tipo.nome, tipo.descricao);

    const dados: Record<string, unknown> = {
      dgt_name: limitar(tipo.nome, 200),
      dgt_descricao: limitar(tipo.descricao, 2000),
      dgt_categorias: limitar(tipo.categorias.join(';'), 500),
      dgt_obrigatorio: tipo.obrigatorio,
      dgt_exigevalidade: tipo.exigeValidade,
      dgt_validadedias: tipo.validadeDias && tipo.validadeDias > 0 ? Math.round(tipo.validadeDias) : null,
      dgt_visibilidade: tipo.visibilidade,
      dgt_ordem: Math.round(tipo.ordem || 0),
      dgt_ativo: tipo.ativo,
      dgt_codigoconsulta: tipo.codigoConsulta || null
    };

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

  private lerTipo(r: IDataverseRecord): ITipoDocumentoFornecedor {
    const dias = Number(r.dgt_validadedias);
    return {
      id: guid(r.dgt_tipodocumentofornecedorid),
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
      situacao: texto(r, 'dgt_situacao') === 'Substituído' ? 'Substituído' : 'Vigente',
      registradoPor: texto(r, 'dgt_responsavelnome'),
      criadoEm: texto(r, 'createdon')
    };
  }
}
