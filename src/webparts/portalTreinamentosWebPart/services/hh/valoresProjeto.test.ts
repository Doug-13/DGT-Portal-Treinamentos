import { resumoValoresBom } from './valoresProjeto';

// ============================================================
// TESTE — totais do projeto (itens + % fixo + integração + manutenção)
// ============================================================

describe('totais do projeto', () => {

  it('aplica 7% (Implantação) e 0,5% (Supply) sobre o valor dos itens', () => {
    const r = resumoValoresBom(100000);
    expect(r.areas.map(a => [a.nome, a.valor])).toEqual([['Implantação', 7000], ['Supply', 500]]);
    expect(r.totalAreas).toBe(7500);
    expect(r.total).toBe(107500);
  });

  it('soma integração (com BDI) e manutenção', () => {
    const r = resumoValoresBom(100000, {
      integracao: { tem: true, horas: 40, valorHora: 150, bdi: 25 },
      manutencao: { tem: true, pontos: 5, valorPonto: 200 }
    }, 2);
    expect(r.integracao).toBe(7500);
    expect(r.manutencao).toBe(1000);
    expect(r.total).toBe(116000);
    expect(r.itensSemPreco).toBe(2);
  });

  it('respostas "Não" não somam; sem valor dos itens, áreas zeradas', () => {
    const r = resumoValoresBom(0, {
      integracao: { tem: false, horas: 40, valorHora: 150, bdi: 25 },
      manutencao: { tem: false, pontos: 5, valorPonto: 200 }
    });
    expect(r.total).toBe(0);
  });

  it('arredonda em centavos', () => {
    expect(resumoValoresBom(1234.57).areas[1].valor).toBe(6.17);
  });
});
