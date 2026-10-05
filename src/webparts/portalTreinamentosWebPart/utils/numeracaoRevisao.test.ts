import {
  compararRevisoes,
  maiorRevisao,
  proximaLetra,
  proximaRevisaoInteira,
  proximaRevisaoEmTrabalho,
  proximaSubRevisao,
  revisaoInteira,
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
    expect(revisaoInteira('Rev.02C')).toBe('Rev.02');
  });

  it('define o rótulo pelo evento de revisão', () => {
    // Sub-revisão
    expect(rotuloPeloEvento('subrevisao', 'Rev.00A')).toBe('Rev.00B');
    expect(rotuloPeloEvento('subrevisao', 'Rev.00')).toBe('Rev.00A');
    expect(rotuloPeloEvento('subrevisao', 'Rev.01B')).toBe('Rev.01C');
    expect(rotuloPeloEvento('subrevisao', 'Rev.01')).toBe('Rev.01A');
    // Revisão
    expect(rotuloPeloEvento('revisao', 'Rev.00A')).toBe('Rev.00');
    expect(rotuloPeloEvento('revisao', 'Rev.00')).toBe('Rev.01A');
    expect(rotuloPeloEvento('revisao', 'Rev.01B')).toBe('Rev.01');
    expect(rotuloPeloEvento('revisao', 'Rev.01')).toBe('Rev.02A');
    // Revisão antiga sem letra, nunca fechada neste fluxo: não pula número
    expect(rotuloPeloEvento('revisao', 'Rev.00', false)).toBe('Rev.00');
    // Nova revisão e Fechar
    expect(rotuloPeloEvento('novaRevisao', 'Rev.00B')).toBe('Rev.01A');
    expect(rotuloPeloEvento('fechar', 'Rev.00B')).toBe('Rev.00');
    expect(rotuloPeloEvento('fechar', 'Rev.00')).toBe('Rev.00');
  });

  it('nunca pula número numa aprovação sem reprovação', () => {
    // Criado 00A → aprovou → revisou → aprovou de novo
    let rotulo = proximaRevisaoEmTrabalho(undefined);
    expect(rotulo).toBe('Rev.00A');
    rotulo = rotuloPeloEvento('revisao', rotulo);
    expect(rotulo).toBe('Rev.00');
    rotulo = rotuloPeloEvento('revisao', rotulo);
    expect(rotulo).toBe('Rev.01A');
    rotulo = rotuloPeloEvento('revisao', rotulo);
    expect(rotulo).toBe('Rev.01');
  });

});
