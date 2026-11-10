import {
  avaliarFormula,
  referenciasDaFormula,
  validarFormula
} from './formulaOrcamento';

import {
  IRegraCalculo,
  ILinhaCalculavel,
  aplicarRegras
} from './calculoOrcamento';

import {
  calcularDre
} from './dreOrcamento';

// ============================================================
// TESTES — fórmulas das regras de cálculo (+ − * / e %)
// ============================================================

const constante = (valor: number): number[] => [valor, valor, valor, valor, valor, valor, valor, valor, valor, valor, valor, valor];

describe('Fórmulas das regras', () => {

  it('respeita precedência, parênteses, % e números com vírgula', () => {
    const valores = (ref: string): number[] => constante(ref === 'grupo:A' ? 100 : 40);
    expect(avaliarFormula('[grupo:A] + [grupo:B] * 2', valores)[0]).toBe(180);
    expect(avaliarFormula('([grupo:A] + [grupo:B]) * 2', valores)[0]).toBe(280);
    expect(avaliarFormula('-[grupo:A] * 1,65%', valores)[0]).toBeCloseTo(-1.65, 6);
    expect(avaliarFormula('[grupo:A] / [grupo:B]', valores)[0]).toBe(2.5);
    expect(avaliarFormula('[grupo:A] / 0', valores)[0]).toBe(0);
  });

  it('aponta erros de escrita', () => {
    expect(validarFormula('[grupo:A] +')).toContain('incompleta');
    expect(validarFormula('([grupo:A]')).toContain('Parêntese');
    expect(validarFormula('[xyz]')).toContain('Referência inválida');
    expect(validarFormula('2 # 3')).toContain('não permitido');
    expect(validarFormula('-[linha:LAIR] * 9%')).toBeUndefined();
  });

  it('lista as referências usadas', () => {
    expect(referenciasDaFormula('-([grupo:RECEITA BRUTA] + [conta:4.3.1.01.01.001]) * 7,6% + [grupo:RECEITA BRUTA]'))
      .toEqual(['grupo:RECEITA BRUTA', 'conta:4.3.1.01.01.001']);
  });

  it('CSLL por fórmula "-[linha:LAIR] * 9%" fecha com o LAIR', () => {
    const linha = (grupo: string, codigo: string, valor: number, ordem: number): ILinhaCalculavel =>
      ({ chave: `${grupo}|${codigo}`, grupo, codigo, ordem, valores: constante(valor) });
    const linhas = [
      linha('RECEITA BRUTA', '3.1.1.02.01.001', 1000, 1),
      linha('Despesas Gerais', '4.2.1.01.06.002', 300, 2),
      linha('CSLL', '3.1.2.01.02.005', 0, 3)
    ];
    const regra: IRegraCalculo = {
      id: 'r1', nome: 'CSLL', contaDestino: '3.1.2.01.02.005', contaDestinoNome: 'CSLL', grupoDestino: 'CSLL',
      tipoBase: 'Formula', base: ['-[linha:LAIR] * 9%'], percentual: 0, ordem: 1, ativo: true
    };
    const calculadas = aplicarRegras(linhas, [regra]);
    const dre = calcularDre(calculadas);
    // LAIR = 1000 − 300 = 700; CSLL = −63 na tela (63 gravado).
    expect(dre.LAIR[0]).toBe(700);
    expect(dre.CSLL[0]).toBe(-63);
    expect(calculadas[2].valores[0]).toBe(63);
  });
});
