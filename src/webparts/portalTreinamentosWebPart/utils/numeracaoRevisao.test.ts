import {
  compararRevisoes,
  maiorRevisao,
  proximaLetra,
  proximaRevisaoInteira,
  proximaSubRevisao,
  rotuloPeloEvento
} from './numeracaoRevisao';

// ============================================================
// TESTES DA NUMERAÇÃO DE REVISÃO / SUB-REVISÃO
// Rodam no "heft test" (que já faz parte do npm run build).
// ============================================================

describe('numeracaoRevisao', () => {

  it('incrementa a letra da sub-revisão', () => {
    expect(proximaLetra('')).toBe('A');
    expect(proximaLetra('A')).toBe('B');
    expect(proximaLetra('Z')).toBe('AA');
    expect(proximaLetra('AZ')).toBe('BA');
  });

  it('ordena revisões e sub-revisões', () => {
    const ordenadas = ['Rev.01', 'Rev.00B', 'Rev.00', 'Rev.00A', 'Rev.00AA', 'Rev.00Z']
      .sort(compararRevisoes);
    expect(ordenadas).toEqual(['Rev.00', 'Rev.00A', 'Rev.00B', 'Rev.00Z', 'Rev.00AA', 'Rev.01']);
    expect(maiorRevisao(['Rev.00', 'Rev.00C', 'Rev.00A'])).toBe('Rev.00C');
  });

  it('calcula a próxima revisão inteira e a próxima sub-revisão', () => {
    expect(proximaRevisaoInteira('Rev.00B')).toBe('Rev.01');
    expect(proximaRevisaoInteira('Rev.09')).toBe('Rev.10');
    expect(proximaSubRevisao('Rev.00')).toBe('Rev.00A');
    expect(proximaSubRevisao('Rev.00A')).toBe('Rev.00B');
    expect(proximaSubRevisao('Rev.01')).toBe('Rev.01A');
  });

  it('define o rótulo pelo evento de revisão', () => {
    expect(rotuloPeloEvento('revisao', [])).toBe('Rev.00');
    expect(rotuloPeloEvento('subrevisao', [])).toBe('Rev.00');
    expect(rotuloPeloEvento('subrevisao', ['Rev.00'])).toBe('Rev.00A');
    expect(rotuloPeloEvento('subrevisao', ['Rev.00', 'Rev.00A'])).toBe('Rev.00B');
    expect(rotuloPeloEvento('revisao', ['Rev.00', 'Rev.00B'])).toBe('Rev.01');
    expect(rotuloPeloEvento('subrevisao', ['Rev.00', 'Rev.00B', 'Rev.01'])).toBe('Rev.01A');
  });
});
