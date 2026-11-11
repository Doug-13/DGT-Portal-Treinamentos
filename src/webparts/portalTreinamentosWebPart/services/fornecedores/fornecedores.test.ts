import {
  calcularDvCnpj,
  cnpjValido,
  formatarCnpj,
  mascararCnpj,
  normalizarCnpj,
  validarCnpjDigitado
} from '../../utils/cnpj';

import {
  IDocumentoFornecedor,
  IFornecedor,
  ITipoDocumentoFornecedor
} from './modeloFornecedores';

import {
  calcularSituacao,
  estadoPeloVencimento,
  sugerirVencimento
} from './situacaoDocumental';

// ============================================================
// TESTES — módulo Fornecedores
//
// Os CNPJs daqui são SINTÉTICOS: a base é inventada e os dígitos
// verificadores são calculados no próprio teste. Nenhum CNPJ real.
// ============================================================

const montar = (base12: string): string => base12 + calcularDvCnpj(base12);

describe('cnpj', () => {

  it('valida CNPJ numérico gerado a partir de uma base inventada', () => {
    const cnpj = montar('112223330001');
    expect(cnpj.length).toBe(14);
    expect(cnpjValido(cnpj)).toBe(true);
    expect(cnpjValido(formatarCnpj(cnpj))).toBe(true);
  });

  it('valida CNPJ alfanumérico (formato da Receita a partir de 07/2026)', () => {
    const cnpj = montar('AB1CD2EF0001');
    expect(cnpjValido(cnpj)).toBe(true);
    expect(cnpjValido(cnpj.toLowerCase())).toBe(true);
  });

  it('recusa dígito verificador errado, letras no DV e sequências repetidas', () => {
    const cnpj = montar('112223330001');
    const errado = cnpj.substring(0, 12) + (cnpj.charAt(12) === '9' ? '0' : '9') + cnpj.charAt(13);
    expect(cnpjValido(errado)).toBe(false);
    expect(cnpjValido('11222333000AB')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
  });

  it('normaliza, formata e mascara', () => {
    const cnpj = montar('112223330001');
    expect(normalizarCnpj(formatarCnpj(cnpj))).toBe(cnpj);
    expect(formatarCnpj(cnpj)).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    expect(mascararCnpj(cnpj)).toBe('11.***.***/0001-**');
  });

  it('explica o erro de digitação', () => {
    expect(validarCnpjDigitado('')).toBe('Informe o CNPJ.');
    expect(validarCnpjDigitado('1234')).toContain('14 posições');
    expect(validarCnpjDigitado(montar('112223330001'))).toBeUndefined();
  });
});

const hoje = new Date(2026, 10, 10); // 10/11/2026

const fornecedor = (categoria: string): IFornecedor => ({
  id: 'f1', razaoSocial: 'Empresa Teste', nomeFantasia: '', cnpj: '', categoria,
  criticidade: '', status: 'Em homologação', uf: '', cidade: '', endereco: '',
  inscricaoEstadual: '', inscricaoMunicipal: '', regimeTributario: '',
  situacaoCadastral: '', dataSituacao: '', dataAbertura: '', naturezaJuridica: '', porte: '', cnaePrincipal: '',
  contatoComercial: { nome: '', email: '', telefone: '' },
  contatoFiscal: { nome: '', email: '', telefone: '' },
  contatoFinanceiro: { nome: '', email: '', telefone: '' },
  observacoes: '', ultimaConsultaCnpj: '', ultimaConsultaSancoes: '', resultadoSancoes: 'Não consultado',
  ativo: true, criadoEm: ''
});

const tipo = (id: string, extra: Partial<ITipoDocumentoFornecedor> = {}): ITipoDocumentoFornecedor => ({
  id, nome: id, descricao: '', categorias: [], obrigatorio: true, exigeValidade: true,
  visibilidade: 'Interno', ordem: 1, ativo: true, ...extra
});

const doc = (tipoId: string, vencimento: string, extra: Partial<IDocumentoFornecedor> = {}): IDocumentoFornecedor => ({
  id: `${tipoId}-${vencimento}`, fornecedorId: 'f1', tipoId, tipoNome: tipoId, titulo: '', emissao: '2026-01-01',
  vencimento, arquivoUrl: '', arquivoNome: '', observacoes: '', situacao: 'Vigente', registradoPor: '', criadoEm: '', ...extra
});

describe('situacaoDocumental', () => {

  it('classifica pelo vencimento', () => {
    expect(estadoPeloVencimento('2026-11-09', hoje).estado).toBe('Vencido');
    expect(estadoPeloVencimento('2026-11-10', hoje).estado).toBe('A vencer');
    expect(estadoPeloVencimento('2026-12-10', hoje).estado).toBe('A vencer');
    expect(estadoPeloVencimento('2026-12-11', hoje).estado).toBe('OK');
    expect(estadoPeloVencimento('', hoje).estado).toBe('Sem validade');
  });

  it('aponta obrigatório faltando, vencido e a vencer; ignora opcional nunca enviado', () => {
    const tipos = [
      tipo('cnd'),
      tipo('fgts'),
      tipo('cartao', { exigeValidade: false }),
      tipo('balanco', { obrigatorio: false }),
      tipo('pgr', { categorias: ['Terceirizado em campo'] })
    ];
    const docs = [doc('cnd', '2026-10-01'), doc('fgts', '2026-11-20')];
    const s = calcularSituacao(fornecedor('Material'), tipos, docs, hoje);

    expect(s.itens.map(i => i.tipo.id).sort()).toEqual(['balanco', 'cartao', 'cnd', 'fgts']);
    expect(s.vencidos).toBe(1);
    expect(s.aVencer).toBe(1);
    expect(s.faltando).toBe(1);                       // cartão
    expect(s.pendencias.some(p => p.tipo.id === 'balanco')).toBe(false);
  });

  it('usa só a versão vigente mais recente e ignora as substituídas', () => {
    const tipos = [tipo('cnd')];
    const docs = [
      doc('cnd', '2026-01-01', { emissao: '2025-07-01' }),
      doc('cnd', '2027-05-01', { emissao: '2026-11-01' }),
      doc('cnd', '2020-01-01', { emissao: '2027-01-01', situacao: 'Substituído' })
    ];
    const s = calcularSituacao(fornecedor('Serviço'), tipos, docs, hoje);
    expect(s.itens[0].documento && s.itens[0].documento.vencimento).toBe('2027-05-01');
    expect(s.pendencias.length).toBe(0);
  });

  it('sugere o vencimento pela validade padrão do tipo', () => {
    expect(sugerirVencimento('2026-11-10', 180)).toBe('2027-05-09');
    expect(sugerirVencimento('2026-11-10', undefined)).toBe('');
    expect(sugerirVencimento('', 30)).toBe('');
  });
});
