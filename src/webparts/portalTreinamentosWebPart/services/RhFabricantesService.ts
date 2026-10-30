import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  detectarDadoSensivel
} from './LicitacaoParecerService';

import {
  DIAS_AVISO_VENCIMENTO,
  RhCertificadosService
} from './RhCertificadosService';

// ============================================================
// RH E PESSOAS — FABRICANTES E TERCEIROS
//
// Leva para o portal a planilha CONTROLE DE CERTIFICAÇÕES:
//   RESUMO      → dgt_certificacaofabricante (categoria "Certificação
//                 de fabricante"): criticidade, área, pessoa,
//                 fabricante, certificação, status, emissão,
//                 vencimento, observações (+ documento anexado)
//   CREA - CFT  → dgt_certificacaofabricante (categoria "Registro
//                 profissional"): pessoa, título, órgão
//   CONTATOS    → dgt_fabricante: fabricante e contato
//   (novo)      → dgt_declaracaofabricante: declarações/cartas
//   (novo)      → dgt_terceiro: pessoas SEM acesso ao portal
//
// A pessoa de uma certificação é um COLABORADOR (dgt_usuario) ou um
// TERCEIRO (dgt_terceiro). Terceiros são cadastrados aqui mesmo: não
// precisam de conta no Microsoft 365.
//
// Tabelas: scripts/dataverse/criar-tabelas-fabricantes-terceiros.ps1
// Nada é apagado: "Remover" só desativa (dgt_ativo = Não).
// LGPD: CPF, CNPJ, senhas e dados bancários são bloqueados.
// ============================================================

export const TABELAS_FAB = {
  terceiro: 'dgt_terceiro',
  fabricante: 'dgt_fabricante',
  certificacao: 'dgt_certificacaofabricante',
  declaracao: 'dgt_declaracaofabricante'
};

export type CategoriaCertificacao = 'Certificação de fabricante' | 'Registro profissional';

export const CATEGORIAS: CategoriaCertificacao[] = ['Certificação de fabricante', 'Registro profissional'];

export type Criticidade = 'Alta' | 'Média' | 'Baixa';

export const CRITICIDADES: Criticidade[] = ['Alta', 'Média', 'Baixa'];

// Status informado à mão (o resto sai da data de vencimento).
export type StatusManual = '' | 'Em andamento' | 'N/A';

export const STATUS_MANUAIS: Array<{ valor: StatusManual; rotulo: string }> = [
  { valor: '', rotulo: 'Automático (pela data de vencimento)' },
  { valor: 'Em andamento', rotulo: 'Em andamento (renovação/curso em curso)' },
  { valor: 'N/A', rotulo: 'N/A (não se aplica)' }
];

// Status final, como na capa da planilha (OK / NOK / Em andamento /
// N/A), com "A vencer" separado do OK para aparecer antes.
export type StatusCertificacao = 'OK' | 'A vencer' | 'NOK' | 'Em andamento' | 'N/A';

export const STATUS_CERTIFICACAO: StatusCertificacao[] = ['NOK', 'A vencer', 'Em andamento', 'OK', 'N/A'];

export const TIPOS_DECLARACAO: string[] = [
  'Declaração de parceria / canal',
  'Carta de revenda autorizada',
  'Declaração de credenciamento técnico',
  'Carta de solidariedade / garantia',
  'Declaração de exclusividade',
  'Outra'
];

export interface ITerceiro {
  id: string;
  nome: string;
  empresa: string;
  area: string;
  funcao: string;
  email: string;
  telefone: string;
  observacoes: string;
  ativo: boolean;
}

export interface IFabricante {
  id: string;
  nome: string;
  contatoNome: string;
  contatoTelefone: string;
  contatoEmail: string;
  site: string;
  observacoes: string;
}

export interface IPessoaRef {
  tipo: 'colaborador' | 'terceiro';
  id: string;
  nome: string;
  detalhe: string; // cargo (colaborador) ou empresa (terceiro)
}

export interface ICertificacao {
  id: string;
  categoria: CategoriaCertificacao;
  pessoa?: IPessoaRef;
  pessoaNome: string;
  emissor: string;       // fabricante ou órgão (CREA, CFT...)
  titulo: string;        // certificação ou título profissional
  criticidade: Criticidade | '';
  area: string;
  statusManual: StatusManual;
  status: StatusCertificacao;
  diasParaVencer?: number;
  emissao: string;       // yyyy-mm-dd
  vencimento: string;
  numero: string;
  observacoes: string;
  arquivoUrl: string;
  registradoPor: string;
}

export interface IDeclaracao {
  id: string;
  fabricante: string;
  tipo: string;
  titulo: string;
  emissao: string;
  vencimento: string;
  status: StatusCertificacao;
  diasParaVencer?: number;
  observacoes: string;
  arquivoUrl: string;
  registradoPor: string;
}

export interface IDadosFabricantes {
  disponivel: boolean;     // false = tabelas ainda não criadas
  terceiros: ITerceiro[];
  fabricantes: IFabricante[];
  certificacoes: ICertificacao[];
  declaracoes: IDeclaracao[];
  colaboradores: IPessoaRef[];
}

// ------------------------------------------------------------
// Auxiliares
// ------------------------------------------------------------

const guid = (valor: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const soData = (valor: string): string => (valor || '').substring(0, 10);

const ehTabelaInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

export const normalizarNome = (nome: string): string =>
  (nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();

// Status pela data (planilha: OK se vencimento > hoje, senão NOK).
export const statusPelaData = (
  vencimento: string,
  manual: StatusManual = ''
): { status: StatusCertificacao; dias?: number } => {

  if (manual === 'Em andamento' || manual === 'N/A') {
    return { status: manual };
  }
  if (!vencimento) {
    return { status: 'OK' };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(vencimento);
  if (!m) {
    return { status: 'OK' };
  }
  const data = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) {
    return { status: 'NOK', dias };
  }
  return { status: dias <= DIAS_AVISO_VENCIMENTO ? 'A vencer' : 'OK', dias };
};

// Bloqueia CPF, CNPJ, senha e dados bancários (política da DGT).
const verificarSensivel = (...campos: string[]): void => {
  const motivo = detectarDadoSensivel(campos.join(' \n '));
  if (motivo) {
    throw new Error(
      `Os campos contêm ${motivo}. Remova esse dado: pela política da DGT (LGPD), ` +
      'CPF, CNPJ, senhas e dados bancários não podem ser gravados no portal.'
    );
  }
};

const limitar = (valor: string | undefined, tamanho: number): string =>
  (valor || '').trim().substring(0, tamanho);

// ------------------------------------------------------------
// Serviço
// ------------------------------------------------------------

export class RhFabricantesService {

  private readonly dataverse: DataverseService;
  private readonly certificados: RhCertificadosService;

  public constructor(dataverse: DataverseService, certificados: RhCertificadosService) {
    this.dataverse = dataverse;
    this.certificados = certificados;
  }

  // ==========================================================
  // LEITURA
  // ==========================================================

  public async carregar(): Promise<IDadosFabricantes> {

    const usuarios = await this.dataverse.listarRegistros(
      'dgt_usuario',
      '$select=dgt_usuarioid,dgt_name,dgt_email,dgt_cargo&$filter=dgt_ativo eq true'
    );

    const colaboradores: IPessoaRef[] = usuarios
      .map(u => ({
        tipo: 'colaborador' as const,
        id: guid(u.dgt_usuarioid),
        nome: texto(u, 'dgt_name') || texto(u, 'dgt_email'),
        detalhe: texto(u, 'dgt_cargo')
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    let registros: IDataverseRecord[][];

    try {
      registros = await Promise.all([
        this.dataverse.listarRegistros(TABELAS_FAB.terceiro,
          '$select=dgt_terceiroid,dgt_name,dgt_empresa,dgt_area,dgt_funcao,dgt_email,dgt_telefone,dgt_observacoes,dgt_ativo'),
        this.dataverse.listarRegistros(TABELAS_FAB.fabricante,
          '$select=dgt_fabricanteid,dgt_name,dgt_contatonome,dgt_contatotelefone,dgt_contatoemail,dgt_site,dgt_observacoes&$filter=dgt_ativo eq true'),
        this.dataverse.listarRegistros(TABELAS_FAB.certificacao,
          '$select=dgt_certificacaofabricanteid,dgt_name,_dgt_usuario_value,_dgt_terceiro_value,dgt_pessoanome,dgt_categoria,dgt_emissor,' +
          'dgt_criticidade,dgt_area,dgt_statusmanual,dgt_dataemissao,dgt_datavencimento,dgt_numeroregistro,dgt_observacoes,' +
          'dgt_arquivourl,dgt_responsavelnome&$filter=dgt_ativo eq true'),
        this.dataverse.listarRegistros(TABELAS_FAB.declaracao,
          '$select=dgt_declaracaofabricanteid,dgt_name,dgt_fabricante,dgt_tipo,dgt_dataemissao,dgt_datavencimento,dgt_observacoes,' +
          'dgt_arquivourl,dgt_responsavelnome&$filter=dgt_ativo eq true')
      ]);
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return { disponivel: false, terceiros: [], fabricantes: [], certificacoes: [], declaracoes: [], colaboradores };
      }
      throw erro;
    }

    const [regTerceiros, regFabricantes, regCertificacoes, regDeclaracoes] = registros;

    const terceiros: ITerceiro[] = regTerceiros
      .map(r => ({
        id: guid(r.dgt_terceiroid),
        nome: texto(r, 'dgt_name'),
        empresa: texto(r, 'dgt_empresa'),
        area: texto(r, 'dgt_area'),
        funcao: texto(r, 'dgt_funcao'),
        email: texto(r, 'dgt_email'),
        telefone: texto(r, 'dgt_telefone'),
        observacoes: texto(r, 'dgt_observacoes'),
        ativo: r.dgt_ativo !== false
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const fabricantes: IFabricante[] = regFabricantes
      .map(r => ({
        id: guid(r.dgt_fabricanteid),
        nome: texto(r, 'dgt_name'),
        contatoNome: texto(r, 'dgt_contatonome'),
        contatoTelefone: texto(r, 'dgt_contatotelefone'),
        contatoEmail: texto(r, 'dgt_contatoemail'),
        site: texto(r, 'dgt_site'),
        observacoes: texto(r, 'dgt_observacoes')
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const porColaborador: Record<string, IPessoaRef> = {};
    colaboradores.forEach(c => { porColaborador[c.id] = c; });
    const porTerceiro: Record<string, IPessoaRef> = {};
    terceiros.forEach(t => { porTerceiro[t.id] = { tipo: 'terceiro', id: t.id, nome: t.nome, detalhe: t.empresa || 'Terceiro' }; });

    const certificacoes: ICertificacao[] = regCertificacoes.map(r => {
      const usuario = guid(r._dgt_usuario_value);
      const terceiro = guid(r._dgt_terceiro_value);
      const pessoa = (usuario && porColaborador[usuario]) || (terceiro && porTerceiro[terceiro]) || undefined;
      const manual = (texto(r, 'dgt_statusmanual') as StatusManual) || '';
      const vencimento = soData(texto(r, 'dgt_datavencimento'));
      const { status, dias } = statusPelaData(vencimento, manual);
      const categoria = (texto(r, 'dgt_categoria') as CategoriaCertificacao) || 'Certificação de fabricante';
      return {
        id: guid(r.dgt_certificacaofabricanteid),
        categoria: CATEGORIAS.indexOf(categoria) >= 0 ? categoria : 'Certificação de fabricante',
        pessoa,
        pessoaNome: pessoa ? pessoa.nome : texto(r, 'dgt_pessoanome'),
        emissor: texto(r, 'dgt_emissor'),
        titulo: texto(r, 'dgt_name'),
        criticidade: (texto(r, 'dgt_criticidade') as Criticidade) || '',
        area: texto(r, 'dgt_area'),
        statusManual: manual,
        status,
        diasParaVencer: dias,
        emissao: soData(texto(r, 'dgt_dataemissao')),
        vencimento,
        numero: texto(r, 'dgt_numeroregistro'),
        observacoes: texto(r, 'dgt_observacoes'),
        arquivoUrl: texto(r, 'dgt_arquivourl'),
        registradoPor: texto(r, 'dgt_responsavelnome')
      };
    });

    const declaracoes: IDeclaracao[] = regDeclaracoes.map(r => {
      const vencimento = soData(texto(r, 'dgt_datavencimento'));
      const { status, dias } = statusPelaData(vencimento);
      return {
        id: guid(r.dgt_declaracaofabricanteid),
        fabricante: texto(r, 'dgt_fabricante'),
        tipo: texto(r, 'dgt_tipo'),
        titulo: texto(r, 'dgt_name'),
        emissao: soData(texto(r, 'dgt_dataemissao')),
        vencimento,
        status,
        diasParaVencer: dias,
        observacoes: texto(r, 'dgt_observacoes'),
        arquivoUrl: texto(r, 'dgt_arquivourl'),
        registradoPor: texto(r, 'dgt_responsavelnome')
      };
    });

    return { disponivel: true, terceiros, fabricantes, certificacoes, declaracoes, colaboradores };
  }

  // ==========================================================
  // TERCEIROS
  // ==========================================================

  public async salvarTerceiro(t: Omit<ITerceiro, 'id' | 'ativo'> & { id?: string }, responsavel: string): Promise<string> {
    if (!t.nome.trim()) {
      throw new Error('Informe o nome do terceiro.');
    }
    if (t.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email.trim())) {
      throw new Error('O e-mail informado não é válido.');
    }
    if (t.telefone && /[^\d\s()+-]/.test(t.telefone)) {
      throw new Error('O telefone deve ter só números, espaços, parênteses, + e -.');
    }
    verificarSensivel(t.nome, t.empresa, t.area, t.funcao, t.email, t.observacoes);

    const dados = {
      dgt_name: limitar(t.nome, 200),
      dgt_empresa: limitar(t.empresa, 200),
      dgt_area: limitar(t.area, 100),
      dgt_funcao: limitar(t.funcao, 200),
      dgt_email: limitar(t.email, 200),
      dgt_telefone: limitar(t.telefone, 50),
      dgt_observacoes: limitar(t.observacoes, 4000)
    };

    if (t.id) {
      await this.dataverse.atualizarRegistro(TABELAS_FAB.terceiro, t.id, dados);
      return t.id;
    }
    return guid(await this.dataverse.criarRegistro(TABELAS_FAB.terceiro, {
      ...dados,
      dgt_responsavelnome: limitar(responsavel, 200),
      dgt_ativo: true
    }));
  }

  public async definirTerceiroAtivo(id: string, ativo: boolean): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_FAB.terceiro, id, { dgt_ativo: ativo });
  }

  // ==========================================================
  // FABRICANTES
  // ==========================================================

  public async salvarFabricante(f: Omit<IFabricante, 'id'> & { id?: string }): Promise<string> {
    if (!f.nome.trim()) {
      throw new Error('Informe o nome do fabricante.');
    }
    if (f.contatoTelefone && /[^\d\s()+/-]/.test(f.contatoTelefone)) {
      throw new Error('O telefone deve ter só números, espaços, parênteses, /, + e -.');
    }
    verificarSensivel(f.nome, f.contatoNome, f.contatoEmail, f.site, f.observacoes);

    const dados = {
      dgt_name: limitar(f.nome, 200),
      dgt_contatonome: limitar(f.contatoNome, 200),
      dgt_contatotelefone: limitar(f.contatoTelefone, 100),
      dgt_contatoemail: limitar(f.contatoEmail, 300),
      dgt_site: limitar(f.site, 300),
      dgt_observacoes: limitar(f.observacoes, 4000)
    };

    if (f.id) {
      await this.dataverse.atualizarRegistro(TABELAS_FAB.fabricante, f.id, dados);
      return f.id;
    }
    return guid(await this.dataverse.criarRegistro(TABELAS_FAB.fabricante, { ...dados, dgt_ativo: true }));
  }

  public async removerFabricante(id: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_FAB.fabricante, id, { dgt_ativo: false });
  }

  // ==========================================================
  // CERTIFICAÇÕES (fabricante e registro profissional)
  // ==========================================================

  public async salvarCertificacao(
    c: {
      id?: string;
      categoria: CategoriaCertificacao;
      pessoa: IPessoaRef;
      emissor: string;
      titulo: string;
      criticidade: Criticidade | '';
      area: string;
      statusManual: StatusManual;
      emissao: string;
      vencimento: string;
      numero: string;
      observacoes: string;
      arquivo?: File;
      arquivoUrlAtual?: string;
    },
    responsavel: string
  ): Promise<void> {

    if (!c.pessoa) {
      throw new Error('Escolha o colaborador ou o terceiro.');
    }
    if (!c.titulo.trim()) {
      throw new Error(c.categoria === 'Registro profissional' ? 'Informe o título profissional.' : 'Informe a certificação.');
    }
    if (!c.emissor.trim()) {
      throw new Error(c.categoria === 'Registro profissional' ? 'Informe o órgão (ex.: CFT/RS, CREA-RS).' : 'Informe o fabricante.');
    }
    if (c.emissao && c.vencimento && c.vencimento < c.emissao) {
      throw new Error('O vencimento não pode ser anterior à emissão.');
    }
    verificarSensivel(c.titulo, c.emissor, c.area, c.numero, c.observacoes);

    let arquivo: { url: string; nome: string } | undefined;
    if (c.arquivo) {
      arquivo = await this.certificados.enviarDocumentoEm(
        ['Fabricantes', c.pessoa.tipo === 'terceiro' ? 'Terceiros' : 'Colaboradores', c.pessoa.id],
        c.categoria === 'Registro profissional' ? 'registro' : 'certificacao',
        c.arquivo
      );
    }

    const tabelaPessoa = c.pessoa.tipo === 'terceiro' ? TABELAS_FAB.terceiro : 'dgt_usuario';
    const referencia = await this.dataverse.referenciaLookup(tabelaPessoa, c.pessoa.id);

    const dados: Record<string, unknown> = {
      dgt_name: limitar(c.titulo, 200),
      dgt_categoria: c.categoria,
      dgt_pessoanome: limitar(c.pessoa.nome, 200),
      dgt_emissor: limitar(c.emissor, 200),
      dgt_criticidade: c.criticidade || '',
      dgt_area: limitar(c.area, 100),
      dgt_statusmanual: c.statusManual || '',
      dgt_dataemissao: c.emissao || null,
      dgt_datavencimento: c.vencimento || null,
      dgt_numeroregistro: limitar(c.numero, 100),
      dgt_observacoes: limitar(c.observacoes, 4000),
      ...(c.pessoa.tipo === 'terceiro'
        ? { 'dgt_Terceiro@odata.bind': referencia }
        : { 'dgt_Usuario@odata.bind': referencia }),
      ...(arquivo ? { dgt_arquivourl: arquivo.url, dgt_arquivonome: limitar(arquivo.nome, 255) } : {})
    };

    if (c.id) {
      await this.dataverse.atualizarRegistro(TABELAS_FAB.certificacao, c.id, dados);
    } else {
      await this.dataverse.criarRegistro(TABELAS_FAB.certificacao, {
        ...dados,
        dgt_responsavelnome: limitar(responsavel, 200),
        dgt_ativo: true
      });
    }
  }

  public async removerCertificacao(id: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_FAB.certificacao, id, { dgt_ativo: false });
  }

  // ==========================================================
  // DECLARAÇÕES
  // ==========================================================

  public async salvarDeclaracao(
    d: {
      id?: string;
      fabricante: string;
      tipo: string;
      titulo: string;
      emissao: string;
      vencimento: string;
      observacoes: string;
      arquivo?: File;
    },
    responsavel: string
  ): Promise<void> {

    if (!d.fabricante.trim()) {
      throw new Error('Informe o fabricante.');
    }
    if (!d.titulo.trim()) {
      throw new Error('Informe a descrição da declaração.');
    }
    if (d.emissao && d.vencimento && d.vencimento < d.emissao) {
      throw new Error('O vencimento não pode ser anterior à emissão.');
    }
    if (!d.id && !d.arquivo) {
      throw new Error('Anexe o documento da declaração (PDF ou imagem).');
    }
    verificarSensivel(d.fabricante, d.titulo, d.observacoes);

    let arquivo: { url: string; nome: string } | undefined;
    if (d.arquivo) {
      arquivo = await this.certificados.enviarDocumentoEm(['Declaracoes', normalizarNome(d.fabricante).toLowerCase()], 'declaracao', d.arquivo);
    }

    const dados: Record<string, unknown> = {
      dgt_name: limitar(d.titulo, 200),
      dgt_fabricante: limitar(d.fabricante, 200),
      dgt_tipo: limitar(d.tipo, 100),
      dgt_dataemissao: d.emissao || null,
      dgt_datavencimento: d.vencimento || null,
      dgt_observacoes: limitar(d.observacoes, 4000),
      ...(arquivo ? { dgt_arquivourl: arquivo.url, dgt_arquivonome: limitar(arquivo.nome, 255) } : {})
    };

    if (d.id) {
      await this.dataverse.atualizarRegistro(TABELAS_FAB.declaracao, d.id, dados);
    } else {
      await this.dataverse.criarRegistro(TABELAS_FAB.declaracao, {
        ...dados,
        dgt_responsavelnome: limitar(responsavel, 200),
        dgt_ativo: true
      });
    }
  }

  public async removerDeclaracao(id: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_FAB.declaracao, id, { dgt_ativo: false });
  }
}

// ------------------------------------------------------------
// Importação da planilha (colar do Excel)
// ------------------------------------------------------------

export interface ILinhaImportada {
  linha: number;
  criticidade: Criticidade | '';
  area: string;
  pessoaNome: string;
  emissor: string;
  titulo: string;
  statusPlanilha: string;
  emissao: string;
  vencimento: string;
  observacoes: string;
  pessoa?: IPessoaRef;
  erro?: string;
}

const dataDoExcel = (valor: string): string => {
  const v = (valor || '').trim();
  if (!v) {
    return '';
  }
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(v);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${`0${m[2]}`.slice(-2)}-${`0${m[1]}`.slice(-2)}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  // Número de série do Excel (dias desde 1899-12-30).
  if (/^\d{5}$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
    return d.toISOString().substring(0, 10);
  }
  return '';
};

const criticidadeDe = (valor: string): Criticidade | '' => {
  const v = normalizarNome(valor);
  return v === 'ALTA' ? 'Alta' : v === 'MEDIA' ? 'Média' : v === 'BAIXA' ? 'Baixa' : '';
};

// Colunas da aba RESUMO (B a J): Criticidade, Área, Colaborador,
// Fabricante, Certificação, Status, Emissão, Vencimento, Observações.
export const interpretarResumo = (
  textoColado: string,
  pessoas: IPessoaRef[]
): ILinhaImportada[] => {

  const porNome: Record<string, IPessoaRef> = {};
  pessoas.forEach(p => { porNome[normalizarNome(p.nome)] = p; });

  return textoColado
    .split(/\r?\n/)
    .map((linha, i) => ({ c: linha.split('\t'), i }))
    .filter(x => x.c.some(v => v.trim()))
    .filter(x => normalizarNome(x.c[0]) !== 'CRITICIDADE')
    .map(({ c, i }) => {
      const pessoaNome = (c[2] || '').trim();
      const item: ILinhaImportada = {
        linha: i + 1,
        criticidade: criticidadeDe(c[0] || ''),
        area: (c[1] || '').trim(),
        pessoaNome,
        emissor: (c[3] || '').trim(),
        titulo: (c[4] || '').trim(),
        statusPlanilha: (c[5] || '').trim(),
        emissao: dataDoExcel(c[6] || ''),
        vencimento: dataDoExcel(c[7] || ''),
        observacoes: (c[8] || '').trim(),
        pessoa: porNome[normalizarNome(pessoaNome)]
      };
      if (!pessoaNome) {
        item.erro = 'Sem nome da pessoa.';
      } else if (!item.titulo) {
        item.erro = 'Sem certificação.';
      } else if (detectarDadoSensivel([item.titulo, item.emissor, item.observacoes].join(' '))) {
        item.erro = 'Contém dado sensível (CPF, CNPJ, senha ou dado bancário).';
      }
      // Na planilha o fabricante às vezes vem vazio e a certificação
      // começa por ele ("INTELBRAS - DEFENSE IA", "GENETEC").
      if (!item.emissor && item.titulo) {
        item.emissor = item.titulo.split(/\s+-\s+/)[0].trim();
      }
      return item;
    });
};
