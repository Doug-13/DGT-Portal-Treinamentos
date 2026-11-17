import { calcularPrazosClickUp } from './prazosClickUp';

// Datas locais (o cálculo usa o fuso do navegador, como no portal).
const dois = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
const dia = (d: Date): string =>
  `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}:${dois(d.getMinutes())}`;

describe('prazos da tarefa de licitação no ClickUp', () => {

  // Pregão numa segunda-feira sem feriados por perto: 23/11/2026 09:00.
  const pregao = new Date(2026, 10, 23, 9, 0);

  it('modo normal: análises 7 e 6 dias úteis antes, vencimento na data do pregão', () => {
    const p = calcularPrazosClickUp(pregao, false);
    expect(p).toBeDefined();
    if (!p) { return; }
    // 20/11 (sex) é feriado: 19 (1), 18 (2), 17 (3), 16 (4), 13 (5), 12 (6), 11 (7)
    expect(dia(new Date(p.prazoAnaliseInicial))).toBe('2026-11-11 09:00');
    expect(dia(new Date(p.prazoAnaliseTecnica))).toBe('2026-11-12 09:00');
    expect(dia(new Date(p.prazoImpugnacao))).toBe('2026-11-16 09:00');
    expect(dia(new Date(p.prazoChecklist))).toBe('2026-11-17 09:00');
    expect(dia(new Date(p.prazoProposta))).toBe('2026-11-18 09:00');
    expect(p.vencimento).toBe(pregao.getTime());
  });

  it('modo urgente: análises 6 e 5 dias úteis antes, vencimento 7 dias úteis antes', () => {
    const p = calcularPrazosClickUp(pregao, true);
    expect(p).toBeDefined();
    if (!p) { return; }
    expect(dia(new Date(p.prazoAnaliseInicial))).toBe('2026-11-12 09:00');
    expect(dia(new Date(p.prazoAnaliseTecnica))).toBe('2026-11-13 09:00');
    expect(dia(new Date(p.prazoImpugnacao))).toBe('2026-11-16 09:00');
    expect(dia(new Date(p.vencimento))).toBe('2026-11-11 09:00');
  });

  it('pula fim de semana e feriado nacional', () => {
    // Pregão na quarta 22/04/2026 (21/04 Tiradentes): 7 dias úteis antes = 10/04 (sex).
    const p = calcularPrazosClickUp(new Date(2026, 3, 22, 10, 0), false);
    expect(p && dia(new Date(p.prazoAnaliseInicial))).toBe('2026-04-10 10:00');
  });

  it('sem data de pregão válida não calcula', () => {
    expect(calcularPrazosClickUp(undefined, false)).toBeUndefined();
    expect(calcularPrazosClickUp(new Date('x'), true)).toBeUndefined();
  });
});
