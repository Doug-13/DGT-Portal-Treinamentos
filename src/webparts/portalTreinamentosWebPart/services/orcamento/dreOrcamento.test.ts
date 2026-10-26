import {
  aplicarRegras,
  IRegraCalculo,
  ILinhaCalculavel,
  REGRAS_PLANILHA_2027
} from './calculoOrcamento';

import {
  calcularDre,
  totalAnualDre
} from './dreOrcamento';

import {
  PLANO_CONTAS
} from './planoContasOrcamento';

// ============================================================
// TESTE — DRE e regras iguais à planilha Orçamento_2027.xlsm
//
// Os valores esperados foram obtidos recalculando a própria planilha
// (aba ORÇAMENTO 2027, mês de janeiro) com estes lançamentos:
//   Receitas 3.1.1.02.01.001…005 e 3.1.1.02.02.001 = 100 cada
//   P&D 4.1.5.01.01.001 = 1.000 · Alimentação 4.2.1.01.01.003 = 50
//   Juros passivos 4.2.1.01.08.001 = 20 (e 20 no ajuste do EBITDA)
//   Juros ativos 3.1.3.01.01.001 = 30 · Depreciação 4.2.1.01.06.006 = 40
//   Perdas 4.3.1.01.01.001 = 10 · Mercadorias 4.1.1.01.01.001 = 300
//   CUSTO MOD 4.1.4.01.01.018 = 200 (aqui no subitem 6.1.1.01.01.001)
//   Comissões CSS = 3% da receita (fórmula da aba SUPORTE)
// No portal os custos são digitados POSITIVOS (o sinal vem da conta).
// ============================================================

let sequencia = 0;

const linha = (grupo: string, codigo: string, janeiro: number): ILinhaCalculavel => {
  sequencia++;
  return {
    chave: `l${sequencia}`,
    grupo,
    codigo,
    ordem: sequencia,
    valores: [janeiro, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  };
};

const regras: IRegraCalculo[] = REGRAS_PLANILHA_2027.map((modelo, indice) => ({
  id: `r${indice}`,
  nome: modelo.contaDestino,
  contaDestino: modelo.contaDestino,
  contaDestinoNome: modelo.contaDestino,
  grupoDestino: modelo.grupoDestino,
  tipoBase: 'Misto',
  base: modelo.base,
  percentual: modelo.percentual,
  ordem: modelo.ordem,
  ativo: true
}));

const lancamentos = (): ILinhaCalculavel[] => [
  linha('RECEITA BRUTA', '3.1.1.02.01.001', 100),
  linha('RECEITA BRUTA', '3.1.1.02.01.002', 100),
  linha('RECEITA BRUTA', '3.1.1.02.01.003', 100),
  linha('RECEITA BRUTA', '3.1.1.02.01.004', 100),
  linha('RECEITA BRUTA', '3.1.1.02.01.005', 100),
  linha('RECEITA BRUTA', '3.1.1.02.02.001', 100),
  linha('Custos Pesquisa e Desenvolvimento', '4.1.5.01.01.001', 1000),
  linha('Salários indiretos', '4.2.1.01.01.003', 50),
  linha('Despesas financeiras', '4.2.1.01.08.001', 20),
  linha('Receitas financeiras', '3.1.3.01.01.001', 30),
  linha('Despesas Gerais', '4.2.1.01.06.006', 40),
  linha('Operações descontinuadas', '4.3.1.01.01.001', 10),
  linha('Mercadorias para revenda', '4.1.1.01.01.001', 300),
  linha('Custos Diretos Locações Bens (sem amortização)', '6.1.1.01.01.001', 200),
  linha('Receitas e Despesas financeiras (ajuste do EBITDA)', '4.2.1.01.08.001', 20),
  // Contas calculadas pelas regras (começam zeradas).
  linha('Comissões', '4.1.4.01.01.013', 0),
  linha('Impostos', '3.1.2.01.02.001', 0),
  linha('Impostos', '3.1.2.01.02.002', 0),
  linha('Impostos', '3.1.2.01.02.003', 0),
  linha('Impostos', '3.1.2.01.02.004', 0),
  linha('Impostos', 'CBS', 0),
  linha('Amortização Projetos', '4.1.2.01.01.001', 0),
  linha('CSLL', '3.1.2.01.02.005', 0),
  linha('CSLL', 'LEIBEM-CSLL', 0),
  linha('IR', '3.1.2.01.02.006', 0),
  linha('IR', 'LEIBEM-IR', 0)
];

const valorDe = (linhas: ILinhaCalculavel[], grupo: string, codigo: string): number =>
  (linhas.filter(item => item.grupo === grupo && item.codigo === codigo)[0] || { valores: [0] }).valores[0];

describe('DRE e regras = planilha Orçamento 2027', () => {

  const calculadas = aplicarRegras(lancamentos(), regras);
  const dre = calcularDre(calculadas);
  const jan = (id: string): number => dre[id][0];

  it('o plano traz os subitens 6.1.1.01 sob a conta 4.1.4.01.01.018', () => {
    const subitens = PLANO_CONTAS.filter(item => item.pai === '4.1.4.01.01.018');
    expect(subitens.length).toBe(81);
    expect(subitens[0].subdivisao).toBe('6.1.1.01.01 · DESPESAS COM PESSOAL');
    expect(subitens.filter(item => item.subdivisao === '6.1.1.01.02 · CUSTOS GERAIS').length).toBe(22);
  });

  it('calcula impostos, comissão e amortização como a planilha', () => {
    expect(valorDe(calculadas, 'Impostos', '3.1.2.01.02.001')).toBeCloseTo(17, 2);      // ICMS
    expect(valorDe(calculadas, 'Impostos', '3.1.2.01.02.002')).toBeCloseTo(12, 2);      // ISSQN
    expect(valorDe(calculadas, 'Impostos', '3.1.2.01.02.003')).toBeCloseTo(36.632, 1);  // COFINS
    expect(valorDe(calculadas, 'Impostos', '3.1.2.01.02.004')).toBeCloseTo(7.953, 1);   // PIS
    expect(valorDe(calculadas, 'Impostos', 'CBS')).toBeCloseTo(9.21, 2);                // CBS
    expect(valorDe(calculadas, 'Comissões', '4.1.4.01.01.013')).toBeCloseTo(18, 2);
    expect(valorDe(calculadas, 'Amortização Projetos', '4.1.2.01.01.001')).toBeCloseTo(30, 2);
  });

  it('chega aos mesmos resultados da planilha (janeiro)', () => {
    expect(jan('RECEITA BRUTA')).toBeCloseTo(600, 2);
    expect(jan('DEDUCOES')).toBeCloseTo(-100.795, 1);
    expect(jan('ROL')).toBeCloseTo(499.205, 1);
    expect(jan('CUSTOS')).toBeCloseTo(-500, 2);
    expect(jan('LOAA')).toBeCloseTo(-0.795, 1);
    expect(jan('LB')).toBeCloseTo(-1030.795, 1);
    expect(jan('DESPESAS')).toBeCloseTo(-100, 2);
    expect(jan('LO')).toBeCloseTo(-1130.795, 1);
    expect(jan('LAIR')).toBeCloseTo(-1120.795, 1);
    expect(jan('CSLL')).toBeCloseTo(109.87155, 1);
    expect(jan('IR')).toBeCloseTo(305.19875, 1);
    expect(jan('LL')).toBeCloseTo(-705.7247, 1);
    expect(jan('DA')).toBeCloseTo(-70, 2);
    expect(jan('EBITDA')).toBeCloseTo(-1040.795, 1);
    // Planilha: -1,734658 (fração) = -173,47%.
    expect(jan('PCT_EBITDA')).toBeCloseTo(-173.47, 1);
    expect(totalAnualDre('EBITDA', dre)).toBeCloseTo(-1040.795, 1);
  });

  it('deduções aparecem negativas e a Lei do Bem reduz a CSLL', () => {
    expect(jan('Impostos')).toBeLessThan(0);
    // CSLL sobre prejuízo + Lei do Bem: positivos (como na planilha).
    expect(jan('CSLL')).toBeGreaterThan(0);
  });
});
