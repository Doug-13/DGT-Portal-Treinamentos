import {
  gerarModeloExecutadoCsv,
  lerExecutadoCsv
} from './orcamentoComum';

import {
  ILinhaOrcamento
} from '../../services/orcamento/OrcamentoService';

// ============================================================
// TESTES — Executado: modelo e importação por CSV
// ============================================================

const linha = (grupo: string, codigo: string, conta: string): ILinhaOrcamento => ({
  id: codigo,
  chave: `${grupo}|${codigo}`,
  planilhaId: 'p',
  grupo,
  codigo,
  conta,
  descricao: '',
  ordem: 1,
  valores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
});

const LINHAS = [
  linha('RECEITA BRUTA', '3.1.1.02.01.001', 'RECEITA DE LOCAÇÃO'),
  linha('Despesas Gerais', '4.2.1.01.06.002', 'ASSISTENCIA CONTABIL'),
  linha('Custos Diretos Locações Bens (sem amortização)', '6.1.1.01.01.001', 'SALARIOS E ORDENADOS')
];

describe('Executado por CSV', () => {

  it('lê o arquivo no layout do Exportar CSV (valores como na tela)', () => {
    const csv = [
      'Cenário;Linha;Código;Conta;Jan/2027;Fev/2027;Mar/2027;Abr/2027;Mai/2027;Jun/2027;Jul/2027;Ago/2027;Set/2027;Out/2027;Nov/2027;Dez/2027;Total',
      'Executado;RECEITA BRUTA;;TOTAL;1000;0;0;0;0;0;0;0;0;0;0;0;1000',
      'Executado;RECEITA BRUTA;3.1.1.02.01.001;RECEITA DE LOCAÇÃO;1.000,50;0;0;0;0;0;0;0;0;0;0;0;1000,5',
      'Executado;Despesas Gerais;4.2.1.01.06.002;ASSISTENCIA CONTABIL;-250;-R$ 300,00;0;0;0;0;0;0;0;0;0;0;-550',
      'Executado;X;9.9.9;INEXISTENTE;1;0;0;0;0;0;0;0;0;0;0;0;1',
      'Executado;Custos Diretos Locações Bens (sem amortização);4.1.4.01.01.018;MÃE;5;0;0;0;0;0;0;0;0;0;0;0;5'
    ].join('\r\n');
    const resultado = lerExecutadoCsv(csv, LINHAS);
    expect(resultado.contasLidas).toBe(2);
    expect(resultado.valores['RECEITA BRUTA|3.1.1.02.01.001'][0]).toBe(1000.5);
    // Despesa negativa na tela → gravada positiva.
    expect(resultado.valores['Despesas Gerais|4.2.1.01.06.002'].slice(0, 2)).toEqual([250, 300]);
    expect(resultado.naoEncontradas).toEqual(['9.9.9']);
  });

  it('o modelo gerado volta igual na importação', () => {
    const comExecutado = LINHAS.map(item => ({ ...item, executado: [10, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }));
    const lido = lerExecutadoCsv(gerarModeloExecutadoCsv(2027, comExecutado), LINHAS);
    expect(lido.contasLidas).toBe(3);
    expect(lido.valores['Despesas Gerais|4.2.1.01.06.002'].slice(0, 2)).toEqual([10, 20]);
  });

  it('recusa arquivo sem cabeçalho reconhecido', () => {
    expect(() => lerExecutadoCsv('a;b\r\n1;2', LINHAS)).toThrow('Cabeçalho não reconhecido');
  });
});
