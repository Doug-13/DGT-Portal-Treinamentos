/**
 * @jest-environment jsdom
 */
// Fontes simuladas (antes dos imports, para o mock valer).
jest.mock('../../services/dashboards/fontesDashboard', () => {
  const real = jest.requireActual('../../services/dashboards/fontesDashboard');
  const areas = ['ARQ · ARQUITETURA DE SOLUÇÕES', 'CPU · COMERCIAL PÚBLICO', 'PRO · PROCESSOS', 'CTL · CONTROLADORIA', 'GER · GERAL', 'CPR · COMERCIAL PRIVADO',
    'LIC · LICITAÇÕES', 'DEV · DESENVOLVIMENTO', 'TI · TECNOLOGIA DA INFORMAÇÃO', 'ADM · ADMINISTRATIVO', 'CS · CUSTOMER SUCCESS', 'INT · INTELIGÊNCIA'];
  return {
    ...real,
    carregarFonte: async () => areas.reduce((linhas: Array<Record<string, unknown>>, area, i) =>
      linhas.concat([
        { area, usuario: `Pessoa ${i}`, concluido: 'Sim', situacaoPrazo: 'Em dia', situacaoValidade: 'Em dia', atribuicoes: 2 + i },
        { area, usuario: `Pessoa ${i}`, concluido: 'Não', situacaoPrazo: 'Vencido', situacaoValidade: 'Vencido', atribuicoes: 10 + i, diasAtraso: i }
      ]), [])
  };
});

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import DashboardPortalView from './DashboardPortalView';
import { layoutRotulos } from './graficosDashboard';
import { IDefinicaoDashboard, validarDashboard } from '../../services/dashboards/dashboardModelo';
import { CATALOGO_DASHBOARD } from '../../services/dashboards/fontesDashboard';
import { DataverseService } from '../../services/DataverseService';

// ============================================================
// GRÁFICOS LEGÍVEIS E EDIÇÃO DE VISUAIS NA TELA
// ============================================================

const definicao: IDefinicaoDashboard = {
  formato: 'dgt-portal/dashboard@1',
  titulo: 'Teste',
  filtros: { ano: true, area: true },
  secoes: [{
    titulo: 'Execução',
    itens: [
      { tipo: 'cartao', titulo: 'Atribuídos', fonte: 'treinamentos.atribuicoes', medida: 'atribuicoes', agregacao: 'soma' },
      { tipo: 'grafico', grafico: 'barrasEmpilhadas', titulo: 'Execução por área', fonte: 'treinamentos.atribuicoes', dimensao: 'area', serieDimensao: 'concluido', series: [{ medida: 'atribuicoes' }], formato: 'inteiro' }
    ]
  }]
};

let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

const renderizar = async (onSalvar?: (d: IDefinicaoDashboard) => Promise<void>): Promise<void> => {
  await act(async () => {
    ReactDOM.render(
      <DashboardPortalView dashboardId="d1" definicao={definicao} dataverseService={{} as DataverseService} areas={[]} onSalvarDefinicao={onSalvar} />,
      raiz
    );
  });
};

const botao = (texto: string | RegExp): HTMLButtonElement => {
  const achado = Array.prototype.slice.call(raiz.querySelectorAll('button'))
    .filter((b: HTMLButtonElement) => (typeof texto === 'string' ? (b.textContent || '').trim() === texto : texto.test(b.getAttribute('aria-label') || b.textContent || '')))[0];
  expect(achado).toBeDefined();
  return achado;
};

const clicar = async (alvo: HTMLElement): Promise<void> => {
  await act(async () => { alvo.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

const escolher = async (rotulo: string, valor: string): Promise<void> => {
  const campo = Array.prototype.slice.call(raiz.querySelectorAll('label'))
    .filter((l: HTMLLabelElement) => (l.textContent || '').indexOf(rotulo) === 0)[0] as HTMLLabelElement;
  const select = campo.querySelector('select') as HTMLSelectElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value') as PropertyDescriptor;
    (setter.set as (v: string) => void).call(select, valor);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('Rótulos legíveis', () => {

  it('nomes curtos ficam na horizontal; longos inclinam; muitos ficam na vertical', () => {
    expect(layoutRotulos(['Jan', 'Fev', 'Mar'], 180).angulo).toBe(0);
    const areas = Array.from({ length: 14 }, (_v, i) => `ÁREA ${i} · NOME BEM COMPRIDO`);
    expect(layoutRotulos(areas, 39).angulo).toBe(-40);
    expect(layoutRotulos(Array.from({ length: 30 }, (_v, i) => `Pessoa número ${i}`), 18).angulo).toBe(-90);
    expect(layoutRotulos(['Jan'], 180, 'vertical').angulo).toBe(-90);
    // Inclinado reserva espaço embaixo para o texto caber.
    expect(layoutRotulos(areas, 39).base).toBeGreaterThan(60);
  });

  it('o gráfico de áreas sai com os nomes inclinados e o total sobre cada barra', async () => {
    await renderizar();
    const inclinados = Array.prototype.slice.call(raiz.querySelectorAll('svg text[transform]')) as SVGTextElement[];
    expect(inclinados.length).toBe(12);
    expect(inclinados[0].getAttribute('transform')).toMatch(/rotate\(-40/);
    // Total da 1ª barra (maior primeiro): INT, 13 + 21 = 34.
    expect(raiz.querySelector('svg')!.textContent).toMatch(/34/);
  });
});

describe('Editar visual (✎)', () => {

  it('troca o tipo na hora e quem gerencia salva no dashboard', async () => {
    const salvar = jest.fn(async () => undefined);
    await renderizar(salvar);
    await clicar(botao(/Editar Execução por área/));
    await escolher('Tipo de gráfico', 'barrasHorizontais');
    // Horizontal: nomes à esquerda, sem rotação.
    expect(raiz.querySelectorAll('svg text[transform]')).toHaveLength(0);
    expect(raiz.textContent).toMatch(/Salve para que todos vejam assim/);
    await clicar(botao('Salvar no dashboard'));
    expect(salvar).toHaveBeenCalledTimes(1);
    const salvo = (salvar.mock.calls[0] as unknown as [IDefinicaoDashboard])[0];
    expect(salvo.secoes[0].itens[1]).toMatchObject({ grafico: 'barrasHorizontais' });
    expect(validarDashboard(JSON.stringify(salvo), CATALOGO_DASHBOARD).erros).toEqual([]);
  });

  it('desfazer volta ao salvo; sem permissão, o ajuste vale só na tela', async () => {
    await renderizar();
    await clicar(botao(/Editar Execução por área/));
    await escolher('Nomes no eixo', 'vertical');
    expect((raiz.querySelector('svg text[transform]') as Element).getAttribute('transform')).toMatch(/rotate\(-90/);
    expect(raiz.textContent).toMatch(/valem só enquanto você estiver nesta tela/);
    expect(raiz.textContent).not.toMatch(/Salvar no dashboard/);
    await clicar(botao('Desfazer ajustes'));
    expect((raiz.querySelector('svg text[transform]') as Element).getAttribute('transform')).toMatch(/rotate\(-40/);
  });

  it('opções inválidas no JSON são recusadas', () => {
    const ruim = { ...definicao, secoes: [{ ...definicao.secoes[0], itens: [{ ...definicao.secoes[0].itens[1], rotulos: 'diagonal', altura: 'enorme' }] }] };
    const erros = validarDashboard(JSON.stringify(ruim), CATALOGO_DASHBOARD).erros.join(' ');
    expect(erros).toMatch(/rotulos/);
    expect(erros).toMatch(/altura/);
  });
});

describe('Filtros da tela', () => {
  it('filtro por campo recalcula os visuais e "Limpar filtros" volta ao total', async () => {
    const comFiltro = { ...definicao, filtros: { ano: true, area: true, campos: ['concluido'] } };
    await act(async () => {
      ReactDOM.render(<DashboardPortalView dashboardId="d1" definicao={comFiltro} dataverseService={{} as DataverseService} areas={[]} />, raiz);
    });
    const texto = (): string => (raiz.textContent || '').replace(/\s+/g, ' ');
    // Total de atribuições: soma de (2+i) e (10+i) para i = 0..11 = 276.
    expect(texto()).toMatch(/Atribuídos\s*276/);
    const rotulo = Array.prototype.slice.call(raiz.querySelectorAll('label')).filter((l: HTMLLabelElement) => /^Concluído/.test(l.textContent || ''))[0] as HTMLLabelElement;
    const select = rotulo.querySelector('select') as HTMLSelectElement;
    expect(Array.prototype.slice.call(select.options).map((o: HTMLOptionElement) => o.value)).toEqual(['', 'Não', 'Sim']);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value') as PropertyDescriptor;
      (setter.set as (v: string) => void).call(select, 'Sim');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Só os concluídos: soma de (2+i) = 90.
    expect(texto()).toMatch(/Atribuídos\s*90/);
    await clicar(botao('Limpar filtros'));
    expect(texto()).toMatch(/Atribuídos\s*276/);
  });
});

describe('Tamanho dos visuais', () => {

  const cartaoDoGrafico = (): HTMLElement =>
    (raiz.querySelector('[aria-label="Redimensionar Execução por área"]') as HTMLElement).parentElement as HTMLElement;

  it('deslizante de largura muda a grade na hora e vai para o JSON salvo', async () => {
    const salvar = jest.fn(async () => undefined);
    await renderizar(salvar);
    expect(cartaoDoGrafico().style.gridColumn).toBe('span 6');
    await clicar(botao(/Editar Execução por área/));
    const deslizante = raiz.querySelector('input[aria-label="Largura do visual"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') as PropertyDescriptor;
      (setter.set as (v: string) => void).call(deslizante, '9');
      deslizante.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(cartaoDoGrafico().style.gridColumn).toBe('span 9');
    expect(raiz.textContent).toMatch(/Largura: 75% da linha/);
    await clicar(botao('Salvar no dashboard'));
    const salvo = (salvar.mock.calls[0] as unknown as [IDefinicaoDashboard])[0];
    expect(salvo.secoes[0].itens[1]).toMatchObject({ larguraGrade: 9 });
    expect(validarDashboard(JSON.stringify(salvo), CATALOGO_DASHBOARD).erros).toEqual([]);
  });

  it('arrastar a alça ◢ aumenta largura (encaixando na grade) e altura', async () => {
    await renderizar();
    const alca = raiz.querySelector('[aria-label="Redimensionar Execução por área"]') as HTMLElement;
    const cartao = cartaoDoGrafico();
    // Grade de 1200 px; o visual começa com meia linha (593 px).
    Object.defineProperty(cartao.parentElement as HTMLElement, 'clientWidth', { configurable: true, value: 1200 });
    cartao.getBoundingClientRect = () => ({ width: 593 } as DOMRect);
    await act(async () => {
      alca.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 400 }));
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 500 }));
      window.dispatchEvent(new MouseEvent('pointerup', {}));
    });
    // +300 px ≈ 9 colunas de 12; altura 280 + 100 = 380 px.
    expect(cartaoDoGrafico().style.gridColumn).toBe('span 9');
    expect(raiz.textContent).toMatch(/Você ajustou visuais deste painel/);
    await clicar(botao(/Editar Execução por área/));
    expect(raiz.textContent).toMatch(/Altura: 380 px/);
  });
});
