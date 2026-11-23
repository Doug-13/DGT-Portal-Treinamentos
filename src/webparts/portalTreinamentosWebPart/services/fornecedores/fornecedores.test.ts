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

import {
  cicloAberto,
  etapaValida,
  pontosDeAtencao,
  proximoNumeroCiclo,
  statusPeloResultado,
  sugerirVerificacoes,
  validarConclusao,
  verificacoesOk
} from './homologacao';

import {
  chaveNorma,
  cpfValido,
  mascararCpf,
  situacaoColaborador
} from './colaboradores';

import {
  ICicloHomologacao,
  IDadosHomologacao,
  IDocumentoColaborador
} from './modeloFornecedores';

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

const fornecedor = (categoria: string, extra: Partial<IFornecedor> = {}): IFornecedor => ({
  id: 'f1', razaoSocial: 'Empresa Teste', nomeFantasia: '', cnpj: '', categoria,
  criticidade: '', status: 'Em homologação', uf: '', cidade: '', endereco: '',
  inscricaoEstadual: '', inscricaoMunicipal: '', regimeTributario: '',
  situacaoCadastral: '', dataSituacao: '', dataAbertura: '', naturezaJuridica: '', porte: '', cnaePrincipal: '',
  contatoComercial: { nome: '', email: '', telefone: '' },
  contatoFiscal: { nome: '', email: '', telefone: '' },
  contatoFinanceiro: { nome: '', email: '', telefone: '' },
  observacoes: '', ultimaConsultaCnpj: '', ultimaConsultaSancoes: '', resultadoSancoes: 'Não consultado',
  ativo: true, criadoEm: '',
  protocolo: '', origem: 'Portal', tipoSolicitacao: '', fichaRecebidaEm: '', cep: '', telefone: '', site: '',
  emailPedidos: '', porteDeclarado: '', categoriaFornecimento: '', descricaoFornecimento: '',
  contatoIntegridade: { nome: '', email: '', telefone: '' },
  faixaFaturamento: '', anexoSimples: '', previsaoMudancaRegime: '', bancarioConferido: false,
  questionario: {}, certificacoes: '', detalhamentoPositivas: '',
  classificacaoRisco: '', resultadoHomologacao: '', ressalvas: '', validadeCadastro: '', verificacoes: {},
  responsavelSuprimentos: '', responsavelCompliance: '',
  ultimaConsultaCertidoes: '', resultadoCertidoes: 'Não consultado', vencimentoCertidoes: '', assinaturaStatus: '',
  ...extra
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

  it('documento recebido por e-mail ("A conferir") ou descartado não conta como entregue', () => {
    const tipos = [tipo('cnd')];
    const docs = [
      doc('cnd', '2027-05-01', { situacao: 'A conferir' }),
      doc('cnd', '2027-06-01', { situacao: 'Descartado' })
    ];
    const s = calcularSituacao(fornecedor('Serviço'), tipos, docs, hoje);
    expect(s.faltando).toBe(1);
    expect(s.itens[0].documento).toBeUndefined();
  });

  it('sugere o vencimento pela validade padrão do tipo', () => {
    expect(sugerirVencimento('2026-11-10', 180)).toBe('2027-05-09');
    expect(sugerirVencimento('2026-11-10', undefined)).toBe('');
    expect(sugerirVencimento('', 30)).toBe('');
  });
});

describe('homologacao (item 9 da ficha)', () => {

  it('destaca "Sim" nas perguntas de risco e "Não" em integridade/LGPD', () => {
    const pontos = pontosDeAtencao({ '6.1': 'Não', '6.5': 'Sim', '6.8': 'Não', '6.9': 'Sim', '6.10': 'Não se aplica / Não sei' });
    expect(pontos.map(p => p.id)).toEqual(['6.5', '6.8']);
    expect(pontosDeAtencao({})).toEqual([]);
  });

  it('muda o status conforme o resultado da homologação', () => {
    expect(statusPeloResultado('Aprovado', 'Em homologação')).toBe('Homologado');
    expect(statusPeloResultado('Aprovado com ressalvas', 'Reprovado')).toBe('Homologado');
    expect(statusPeloResultado('Aprovado', 'Suspenso')).toBe('Suspenso');
    expect(statusPeloResultado('Reprovado', 'Em homologação')).toBe('Reprovado');
    expect(statusPeloResultado('Pendente', 'Em homologação')).toBe('Em homologação');
  });

  it('sugere as verificações a partir das consultas, certidões e da ficha', () => {
    const cnpj = montar('112223330001');
    const outro = montar('998887770001');
    const tipos = [
      tipo('cnd', { codigoConsulta: 'cnd_federal' }),
      tipo('fgts', { codigoConsulta: 'fgts' }),
      tipo('cndt', { codigoConsulta: 'cndt' })
    ];
    const docs = [doc('cnd', '2027-03-01'), doc('fgts', '2026-11-01'), doc('cndt', '2027-03-01')];
    const f = fornecedor('Serviço', {
      cnpj,
      situacaoCadastral: 'Ativa',
      resultadoSancoes: 'Com registro',
      questionario: { '6.5': 'Sim' },
      dadosBancarios: { banco: 'x', agencia: '1', conta: '2', tipoChavePix: '', chavePix: '', titular: 'Empresa Teste', cnpjTitular: outro }
    });
    const v = sugerirVerificacoes(f, calcularSituacao(f, tipos, docs, hoje));

    expect(v.receita.situacao).toBe('ok');
    expect(v.ceisCnep.situacao).toBe('atencao');
    expect(v.cnds.situacao).toBe('atencao');          // FGTS vencido
    expect(v.cndt.situacao).toBe('ok');
    expect(v.credito.situacao).toBe('atencao');       // 6.5 = Sim
    expect(v.questionario.situacao).toBe('atencao');
    expect(v.bancario.situacao).toBe('atencao');      // titular com outro CNPJ

    const certo = fornecedor('Serviço', {
      cnpj,
      dadosBancarios: { banco: 'x', agencia: '1', conta: '2', tipoChavePix: '', chavePix: '', titular: 'Empresa Teste', cnpjTitular: cnpj },
      bancarioConferido: true
    });
    expect(sugerirVerificacoes(certo, calcularSituacao(certo, [], [], hoje)).bancario.situacao).toBe('ok');
    expect(sugerirVerificacoes(certo, calcularSituacao(certo, [], [], hoje)).cnds.situacao).toBe('pendente');
  });

  it('considera a CEAT junto com a CNDT', () => {
    const tipos = [tipo('cndt', { codigoConsulta: 'cndt' }), tipo('ceat', { codigoConsulta: 'ceat' })];
    const f = fornecedor('Serviço');
    const soCndt = sugerirVerificacoes(f, calcularSituacao(f, tipos, [doc('cndt', '2027-03-01')], hoje));
    expect(soCndt.cndt.situacao).toBe('pendente');   // falta a CEAT
    const ambas = sugerirVerificacoes(f, calcularSituacao(f, tipos, [doc('cndt', '2027-03-01'), doc('ceat', '2026-12-31')], hoje));
    expect(ambas.cndt.situacao).toBe('ok');
  });
});

// ------------------------------------------------------------
// Kanban (ciclos de homologação)
// ------------------------------------------------------------

const ciclo = (numero: number, extra: Partial<ICicloHomologacao> = {}): ICicloHomologacao => ({
  id: `c${numero}`,
  fornecedorId: 'f1',
  numero,
  motivo: 'Cadastro inicial',
  etapa: 'Ficha recebida',
  etapaDesde: '2026-11-01T10:00:00Z',
  concluidoEm: '',
  protocolo: '',
  classificacaoRisco: '',
  resultadoHomologacao: 'Pendente',
  ressalvas: '',
  validadeCadastro: '',
  verificacoes: {},
  responsavelSuprimentos: '',
  responsavelCompliance: '',
  bancarioConferido: false,
  abertoPor: '',
  criadoEm: '2026-11-01T10:00:00Z',
  fluxoIniciado: false,
  etapaAtual: '',
  prazoEtapa: '',
  responsaveisEtapa: '',
  ...extra
});

const dados = (extra: Partial<IDadosHomologacao> = {}): IDadosHomologacao => ({
  classificacaoRisco: '',
  resultadoHomologacao: 'Pendente',
  ressalvas: '',
  validadeCadastro: '',
  verificacoes: {},
  responsavelSuprimentos: '',
  responsavelCompliance: '',
  bancarioConferido: false,
  ...extra
});

describe('kanban de homologação', () => {

  it('só conclui com resultado definido e as exigências de cada resultado', () => {
    expect(validarConclusao(dados())).toMatch(/defina o resultado/);
    expect(validarConclusao(dados({ resultadoHomologacao: 'Aprovado' }))).toMatch(/risco/);
    expect(validarConclusao(dados({ resultadoHomologacao: 'Aprovado', classificacaoRisco: 'Baixo' }))).toMatch(/validade/);
    expect(validarConclusao(dados({ resultadoHomologacao: 'Aprovado', classificacaoRisco: 'Baixo', validadeCadastro: '2027-11-01' }))).toBe('');
    expect(validarConclusao(dados({ resultadoHomologacao: 'Aprovado com ressalvas', classificacaoRisco: 'Médio', validadeCadastro: '2027-11-01' }))).toMatch(/ressalvas/);
    expect(validarConclusao(dados({ resultadoHomologacao: 'Reprovado' }))).toMatch(/ressalvas/);
    expect(validarConclusao(dados({ resultadoHomologacao: 'Reprovado', ressalvas: 'Parecer jurídico 12/2026' }))).toBe('');
  });

  it('acha o ciclo aberto e numera o próximo; concluídos são histórico', () => {
    const ciclos = [
      ciclo(1, { etapa: 'Concluído', concluidoEm: '2025-11-01T00:00:00Z', resultadoHomologacao: 'Aprovado' }),
      ciclo(2, { etapa: 'Em análise' })
    ];
    expect(cicloAberto(ciclos)!.numero).toBe(2);
    expect(cicloAberto([ciclos[0]])).toBeUndefined();
    expect(proximoNumeroCiclo(ciclos)).toBe(3);
    expect(proximoNumeroCiclo([])).toBe(1);
  });

  it('coluna gravada desconhecida volta para a primeira', () => {
    expect(etapaValida('qualquer coisa')).toBe('Ficha recebida');
  });

  it('conta as verificações marcadas', () => {
    expect(verificacoesOk(dados({
      verificacoes: {
        receita: { ok: true, data: '2026-11-10', responsavel: 'Analista' },
        cnds: { ok: false, data: '', responsavel: '' },
        cndt: { ok: true, data: '2026-11-10', responsavel: 'Analista' }
      }
    }))).toBe(2);
  });
});

// ------------------------------------------------------------
// Colaboradores do prestador. CPF SINTÉTICO: base inventada e
// dígitos calculados aqui. Nenhum CPF real.
// ------------------------------------------------------------

const cpfSintetico = (base9: string): string => {
  const dv = (base: string, peso: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) { soma += Number(base.charAt(i)) * (peso - i); }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(base9, 10);
  return base9 + d1 + dv(base9 + d1, 11);
};

const docColaborador = (tipoDoc: 'ASO' | 'NR aplicável', norma: string, vencimento: string, extra: Partial<IDocumentoColaborador> = {}): IDocumentoColaborador => ({
  id: `${tipoDoc}-${norma}-${vencimento}`,
  colaboradorId: 'col1',
  tipo: tipoDoc,
  norma,
  emissao: '2026-01-01',
  vencimento,
  arquivoUrl: '',
  arquivoNome: '',
  observacoes: '',
  situacao: 'Vigente',
  registradoPor: '',
  criadoEm: '2026-01-01T00:00:00Z',
  ...extra
});

describe('colaboradores', () => {

  it('valida o dígito do CPF e mascara para exibição', () => {
    const cpf = cpfSintetico('901234567');
    expect(cpfValido(cpf)).toBe(true);
    expect(cpfValido(cpf.substring(0, 10) + ((Number(cpf.charAt(10)) + 1) % 10))).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
    expect(mascararCpf(cpf)).toBe(`***.***.${cpf.substring(6, 9)}-${cpf.substring(9)}`);
  });

  it('trata a mesma NR escrita de jeitos diferentes como uma só', () => {
    expect(chaveNorma('NR 10')).toBe(chaveNorma('nr-10'));
    expect(chaveNorma('NR10')).toBe('NR-10');
  });

  it('aponta ASO faltando ou vencido e NR vencida', () => {
    expect(situacaoColaborador([], hoje).pendente).toBe(true);
    expect(situacaoColaborador([], hoje).aso.estado).toBe('Faltando');

    const emDia = situacaoColaborador([docColaborador('ASO', '', '2027-06-01'), docColaborador('NR aplicável', 'NR-35', '2027-06-01')], hoje);
    expect(emDia.pendente).toBe(false);
    expect(emDia.nrs.map(n => n.rotulo)).toEqual(['NR-35']);

    const nrVencida = situacaoColaborador([docColaborador('ASO', '', '2027-06-01'), docColaborador('NR aplicável', 'NR-10', '2026-10-01')], hoje);
    expect(nrVencida.pendente).toBe(true);

    // Versão substituída não conta; vale a vigente mais recente.
    const renovado = situacaoColaborador([
      docColaborador('ASO', '', '2026-10-01', { situacao: 'Substituído' }),
      docColaborador('ASO', '', '2027-10-01', { emissao: '2026-10-02' })
    ], hoje);
    expect(renovado.aso.estado).toBe('OK');
  });
});
