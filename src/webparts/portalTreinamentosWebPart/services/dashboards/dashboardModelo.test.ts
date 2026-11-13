import {
  Linha,
  agregar,
  agrupar,
  aplicarFiltro,
  farolDe,
  ordenarGrupos,
  paginasDoDashboard,
  validarDashboard
} from './dashboardModelo';

import {
  CATALOGO_DASHBOARD
} from './fontesDashboard';

import {
  EXEMPLOS_DASHBOARD
} from './exemplosDashboard';

// ============================================================
// TESTES — dashboards do portal (formato dgt-portal/dashboard@1)
// Os exemplos da skill "dashboard-dgt" (exemplosDashboard.ts) precisam
// ser válidos contra o catálogo de fontes.
// ============================================================

describe('Dashboards do portal', () => {

  it('os exemplos da skill são válidos', () => {
    const nomes = Object.keys(EXEMPLOS_DASHBOARD);
    expect(nomes.length).toBeGreaterThanOrEqual(2);
    nomes.forEach(nome => {
      const resultado = validarDashboard(JSON.stringify(EXEMPLOS_DASHBOARD[nome]), CATALOGO_DASHBOARD);
      expect({ nome, erros: resultado.erros }).toEqual({ nome, erros: [] });
    });
  });

  it('aponta fonte, campo e agregação inválidos', () => {
    const resultado = validarDashboard({
      formato: 'dgt-portal/dashboard@1',
      titulo: 'Teste',
      secoes: [{
        titulo: 'S',
        itens: [
          { tipo: 'cartao', titulo: 'A', fonte: 'nao.existe', medida: 'x' },
          { tipo: 'cartao', titulo: 'B', fonte: 'orcamento.linhas', medida: 'conta', agregacao: 'soma' },
          { tipo: 'grafico', grafico: 'pizza', titulo: 'C', fonte: 'orcamento.linhas', dimensao: 'mes', series: [{ medida: 'orcado' }] }
        ]
      }]
    }, CATALOGO_DASHBOARD);
    expect(resultado.erros.join(' | ')).toContain('fonte "nao.existe" não existe');
    expect(resultado.erros.join(' | ')).toContain('"conta" não é numérico');
    expect(resultado.erros.join(' | ')).toContain('grafico "pizza" inválido');
  });

  it('filtra, agrupa e agrega', () => {
    const linhas: Linha[] = [
      { area: 'PRO', mes: 1, orcado: 100, status: 'Vencido' },
      { area: 'PRO', mes: 2, orcado: 50, status: 'Em dia' },
      { area: 'CTL', mes: 1, orcado: 30, status: 'Vencido' }
    ];
    expect(agregar(aplicarFiltro(linhas, { area: 'PRO' }), { medida: 'orcado' })).toBe(150);
    expect(agregar(aplicarFiltro(linhas, { status: ['Vencido', 'Vence em 30 dias'] }), { medida: '*', agregacao: 'contagem' })).toBe(2);
    expect(agregar(linhas, { medida: 'area', agregacao: 'contagemDistinta' })).toBe(2);
    expect(agrupar(linhas, ['mes']).map(grupo => agregar(grupo.linhas, { medida: 'orcado' }))).toEqual([130, 50]);
  });

  it('farol: verde ≥ 80%, amarelo 70–79%, vermelho < 70% (custos: menor é melhor)', () => {
    expect(farolDe(85, 100).farol).toBe('verde');
    expect(farolDe(75, 100).farol).toBe('amarelo');
    expect(farolDe(60, 100).farol).toBe('vermelho');
    // Custo executado −120 para orçado −100: estourou (100/120 = 83%) → verde no limite; −150 → vermelho.
    expect(farolDe(-150, -100, 'menor').farol).toBe('vermelho');
  });

  it('páginas: agrupa as seções em abas, na ordem; sem "pagina" fica uma página só', () => {
    const controladoria = EXEMPLOS_DASHBOARD.controladoria;
    expect(paginasDoDashboard(controladoria).map(p => p.titulo))
      .toEqual(['Visão geral', 'Resultado (DRE)', 'Por área', 'Desvios', 'Aprovações']);
    expect(paginasDoDashboard(EXEMPLOS_DASHBOARD['orcamento-area']).map(p => p.titulo)).toEqual(['Visão geral']);
    const misto = {
      ...controladoria,
      secoes: [
        { titulo: 'A', itens: controladoria.secoes[0].itens },
        { titulo: 'B', pagina: 'Detalhe', itens: controladoria.secoes[0].itens },
        { titulo: 'C', itens: controladoria.secoes[0].itens }
      ]
    };
    expect(paginasDoDashboard(misto).map(p => `${p.titulo}:${p.secoes.map(x => x.secao.titulo).join('')}`))
      .toEqual(['Visão geral:A', 'Detalhe:BC']);
  });

  it('páginas: "pagina" vazia ou longa demais é recusada', () => {
    const base = EXEMPLOS_DASHBOARD.controladoria;
    const vazia = { ...base, secoes: [{ ...base.secoes[0], pagina: ' ' }] };
    const longa = { ...base, secoes: [{ ...base.secoes[0], pagina: 'x'.repeat(41) }] };
    expect(validarDashboard(JSON.stringify(vazia), CATALOGO_DASHBOARD).erros.join(' ')).toMatch(/pagina/);
    expect(validarDashboard(JSON.stringify(longa), CATALOGO_DASHBOARD).erros.join(' ')).toMatch(/40 caracteres/);
  });

  it('ordenar "nenhum" mantém a ordem da fonte (ex.: linhas da DRE)', () => {
    const itens = [{ rotulo: 'Receita', valor: 10 }, { rotulo: 'Custos', valor: -5 }, { rotulo: 'Lucro', valor: 5 }];
    expect(ordenarGrupos(itens, 'nenhum').map(i => i.rotulo)).toEqual(['Receita', 'Custos', 'Lucro']);
    expect(ordenarGrupos(itens, 'valor desc').map(i => i.rotulo)).toEqual(['Receita', 'Lucro', 'Custos']);
  });
});
