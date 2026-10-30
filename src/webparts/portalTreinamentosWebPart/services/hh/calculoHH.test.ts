import { calcularHH, horasDoLancamento, hhParaBom } from './calculoHH';
import { IDadosHH, dadosVazios } from './modeloHH';

// ============================================================
// TESTE — motor do cálculo de HH
//
// Dados fictícios, com resultados conferidos à mão pelas fórmulas das
// planilhas (a validação com as planilhas reais — 587 valores — foi
// feita na implantação, fora do repositório, para não versionar dados
// de custo da empresa).
// ============================================================

const base = (): IDadosHH => {
  const d = dadosVazios('teste', 'Área de teste');
  d.meses = ['ago/26', 'set/26'];
  d.premissas = { ...d.premissas, mesReferencia: 'set/26', mesesDiluicao: 12, headcountInterno: 10, pontosPorDia: 2, pessoasEquipeCampo: 2, hhReferenciaRh: 40 };
  d.quadroPO = [{ id: 'q1', familia: 'Técnicos', posicoes: 4, salarioTotal: 12000 }];
  d.equipeCampo = [
    { id: 'e1', item: 'Veículo', tipo: 'Recorrente', valor: 4000, quantidade: 1, maoDeObra: false },
    { id: 'e2', item: 'Notebook', tipo: '1° mês', valor: 6000, quantidade: 1, maoDeObra: false },
    { id: 'e3', item: 'Técnico Pleno', tipo: 'Recorrente', valor: 0, familiaVinculada: 'Técnicos', quantidade: 2, maoDeObra: true }
  ];
  d.custos = [
    { id: 'c1', item: 'Salários', grupo: 'Pessoal', valores: { 'ago/26': 0, 'set/26': 33000 } },
    { id: 'c2', item: 'Combustível', grupo: 'Veículos', valores: { 'set/26': 3000 } }
  ];
  return d;
};

describe('cálculo de HH (fórmulas das planilhas)', () => {

  it('equipe de campo e HH por ponto', () => {
    const r = calcularHH(base());
    // Técnico: salário médio 3.000 × 1,9 = 5.700 × 2 = 11.400
    expect(r.equipe.itens[2].valor).toBeCloseTo(5700, 6);
    // 4.000 + 11.400 + 6.000/12 = 15.900
    expect(r.equipe.custoMensalEquivalente).toBeCloseTo(15900, 6);
    // 2 × 220 × 0,75 = 330 h → 48,1818 R$/h
    expect(r.equipe.hh).toBeCloseTo(15900 / 330, 6);
    // pontos/mês 42; horas-homem por ponto 330/42; HH por ponto = 15.900/42
    expect(r.resumo.hhPorPonto).toBeCloseTo(15900 / 42, 6);
    expect(r.resumo.bomMinimoPorPonto).toBeCloseTo(15900 / 42 / 0.075, 6);
    expect(r.equipe.hhMaoDeObra).toBeCloseTo(11400 / 330, 6);
  });

  it('HH mensal: só meses com custo entram na média', () => {
    const r = calcularHH(base());
    expect(r.hhMensal.meses[0].hhCheio).toBe(0);
    // set: 36.000 ÷ (10 × 165) = 21,8181
    expect(r.hhMensal.meses[1].hhCheio).toBeCloseTo(36000 / 1650, 6);
    expect(r.hhMensal.media.hhCheio).toBeCloseTo(36000 / 1650, 6);
    expect(r.resumo.hhPessoalMesRef).toBeCloseTo(33000 / 1650, 6);
    expect(r.custos.porGrupo.filter(g => g.grupo === 'Veículos')[0].pct).toBeCloseTo(3000 / 36000, 6);
  });

  it('alocação de horas no projeto e % real', () => {
    const d = base();
    d.premissas.custoTotalProjeto = 100000;
    d.premissas.valorMedioBomPonto = 10000;
    const r = calcularHH(d);
    expect(r.resumo.valorAnalista).toBeCloseTo(7000, 6);
    expect(r.resumo.horasAnalista).toBeCloseTo(7000 / 90, 6);
    expect(r.resumo.horasSuprimentos).toBeCloseTo(500 / 50, 6);
    expect(r.resumo.pctReal).toBeCloseTo(15900 / 42 / 10000, 6);
    expect(r.resumo.leitura).toContain('cobre o HH');
  });

  it('lançamentos: rateio dos internos para a jornada', () => {
    expect(horasDoLancamento('22:00', '02:00')).toBeCloseTo(4, 6);
    const d = base();
    d.premissas.terceirosOrigem = 'equipe';
    d.apoio = {
      colaboradores: [
        { codigo: 'Interno 01', vinculo: 'Interno', atuacao: '', familia: 'Técnicos', periculosidade: false, modalidade: '', valorContrato: 0, incluiHH: true, fracaoMes: 1 },
        { codigo: 'Terceiro 01', vinculo: 'Terceiro', atuacao: '', familia: '', periculosidade: false, modalidade: 'Hora', valorContrato: 50, incluiHH: true, fracaoMes: 1 }
      ],
      custosOperacionais: [],
      lancamentos: [
        { colaborador: 'Interno 01', data: '2026-09-01', projeto: '100', atividade: '', inicio: '08:00', fim: '12:00', considerar: true },
        { colaborador: 'Interno 01', data: '2026-09-01', projeto: 'INTERNO', atividade: '', inicio: '13:00', fim: '15:00', considerar: true },
        { colaborador: 'Terceiro 01', data: '2026-09-01', projeto: '100', atividade: '', inicio: '08:00', fim: '18:00', considerar: true },
        { colaborador: 'Terceiro 01', data: '2026-09-02', projeto: '200', atividade: '', inicio: '08:00', fim: '10:00', considerar: false }
      ],
      projetos: []
    };
    const r = calcularHH(d);
    const a = r.apoio!;
    // Interno: 6 h lançadas no dia → 8,8 h consideradas (4/6 projeto)
    expect(a.colaboradores[0].horasConsideradas).toBeCloseTo(8.8, 6);
    expect(a.colaboradores[0].horasProjeto).toBeCloseTo(8.8 * 4 / 6, 6);
    // Terceiro por hora: 10 h × 50
    expect(a.colaboradores[1].custoConsiderado).toBeCloseTo(500, 6);
    expect(a.colaboradores[1].dias).toBe(1);
    expect(r.premissas.terceiros).toBe(1);
    expect(a.projetos.map(p => p.projeto)).toEqual(['100', '200']);
    expect(a.projetos[0].pessoas).toBe(2);
  });

  it('uso no B.O.M.', () => {
    const b = hhParaBom('teste', base(), 3, 200000);
    expect(b.hhPontos).toBeCloseTo(3 * 15900 / 42, 6);
    expect(b.valorSuprimentos).toBeCloseTo(1000, 6);
  });
});
