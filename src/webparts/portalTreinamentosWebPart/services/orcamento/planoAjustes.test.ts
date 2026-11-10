import {
  CONTAS_MAE,
  PLANO_CONTAS,
  aplicarAjustesPlano,
  contaBase,
  termoExibido,
  versaoPlano
} from './planoContasOrcamento';

import {
  linhasDoModelo
} from './OrcamentoService';

// ============================================================
// TESTES — ajustes do plano de contas (aba Plano de contas)
// ============================================================

describe('Ajustes do plano de contas', () => {

  const total = PLANO_CONTAS.length;
  const pd = (codigo: string): typeof PLANO_CONTAS[0] | undefined =>
    PLANO_CONTAS.filter(conta => conta.grupo === 'Custos Pesquisa e Desenvolvimento' && conta.codigo === codigo)[0];

  afterEach(() => aplicarAjustesPlano([]));

  it('renomeia, desativa e inclui (subitem na conta mãe) sem perder o plano base', () => {
    const versao = versaoPlano();
    aplicarAjustesPlano([
      { tipo: 'conta', grupo: 'Custos Pesquisa e Desenvolvimento', codigo: '6.5.1.01.01.001', nome: 'SALÁRIOS P&D', ativa: true },
      { tipo: 'conta', grupo: 'Custos Pesquisa e Desenvolvimento', codigo: '6.5.1.01.01.013', nome: 'UNIFORMES - P&D', ativa: false },
      { tipo: 'conta', grupo: 'Custos Pesquisa e Desenvolvimento', codigo: '6.5.1.01.01.027', nome: 'BÔNUS - P&D', pai: '4.1.5.01.01.001', incluida: true, ativa: true },
      { tipo: 'conta', grupo: 'Custos Pesquisa e Desenvolvimento', codigo: '4.1.5.01.01.001', nome: 'CUSTO MÃO DE OBRA P&D' }
    ]);
    expect(versaoPlano()).toBe(versao + 1);
    expect(PLANO_CONTAS.length).toBe(total + 1);
    expect((pd('6.5.1.01.01.001') as typeof PLANO_CONTAS[0]).conta).toBe('SALÁRIOS P&D');
    expect((contaBase('Custos Pesquisa e Desenvolvimento', '6.5.1.01.01.001') as typeof PLANO_CONTAS[0]).conta).toBe('SALARIOS E ORDENADOS - P&D');
    expect((pd('6.5.1.01.01.013') as typeof PLANO_CONTAS[0]).inativa).toBe(true);
    const nova = pd('6.5.1.01.01.027') as typeof PLANO_CONTAS[0];
    expect(nova.pai).toBe('4.1.5.01.01.001');
    expect(nova.incluida).toBe(true);
    // Logo depois do último subitem da mesma conta mãe.
    const indice = PLANO_CONTAS.indexOf(nova);
    expect(PLANO_CONTAS[indice - 1].codigo).toBe('6.5.1.01.01.026');
    expect(CONTAS_MAE['4.1.5.01.01.001']).toBe('CUSTO MÃO DE OBRA P&D');
    // Desativada não entra nas planilhas novas; incluída entra.
    const modelo = linhasDoModelo('p', ['Custos Pesquisa e Desenvolvimento']).map(linha => linha.codigo);
    expect(modelo.indexOf('6.5.1.01.01.013')).toBe(-1);
    expect(modelo.indexOf('6.5.1.01.01.027')).toBeGreaterThan(-1);
  });

  it('termos de grupos e linhas da DRE mudam só o nome exibido', () => {
    aplicarAjustesPlano([{ tipo: 'termo', grupo: '', codigo: 'EBITDA', nome: 'EBITDA (gerencial)' }]);
    expect(termoExibido('EBITDA', 'EBITDA')).toBe('EBITDA (gerencial)');
    expect(termoExibido('LAIR', 'Lucro Líquido Antes do IRPJ/CSLL')).toBe('Lucro Líquido Antes do IRPJ/CSLL');
  });

  it('sem ajustes volta ao plano base', () => {
    aplicarAjustesPlano([{ tipo: 'conta', grupo: 'Custos Pesquisa e Desenvolvimento', codigo: '6.5.1.01.01.099', nome: 'X', incluida: true }]);
    aplicarAjustesPlano([]);
    expect(PLANO_CONTAS.length).toBe(total);
    expect(CONTAS_MAE['4.1.5.01.01.001']).toBe('CUSTO MOD P&D');
    expect(termoExibido('EBITDA', 'EBITDA')).toBe('EBITDA');
  });
});
