/**
 * @jest-environment jsdom
 */
// Fontes simuladas (antes dos imports, para o mock valer).
jest.mock('../../services/dashboards/fontesDashboard', () => {
  const real = jest.requireActual('../../services/dashboards/fontesDashboard');
  return {
    ...real,
    carregarFonte: async (id: string) => {
      if (id === 'orcamento.planilhas') {
        return [{ area: 'CTL · CONTROLADORIA', situacao: 'Em aprovação', etapa: 'Controladoria', atrasada: 'Sim', diasAtraso: 3, totalOrcado: 1000, totalExecutado: 900, planilhas: 1 }];
      }
      if (id === 'orcamento.linhas') {
        return [{ area: 'CTL · CONTROLADORIA', grupo: 'Despesas Gerais', codigo: '4.1', conta: 'Aluguel', mes: 1, situacao: 'Aprovada', orcado: -500, executado: -650, diferenca: -150 }];
      }
      return ['RECEITA BRUTA', 'ROL', 'CUSTOS', 'DESPESAS', 'EBITDA', 'LL'].map(indicadorId => ({
        area: 'CTL · CONTROLADORIA', indicador: indicadorId, indicadorId, tipoLinha: 'resultado', mes: 1, orcado: 1000, executado: 900
      }));
    }
  };
});

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import DashboardPortalView from './DashboardPortalView';
import { EXEMPLOS_DASHBOARD } from '../../services/dashboards/exemplosDashboard';
import { DataverseService } from '../../services/DataverseService';

// ============================================================
// TESTE DA TELA — dashboard com páginas (abas) e aba da IA
// As fontes são simuladas (topo do arquivo): o teste não acessa o Dataverse.
// ============================================================


let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

const renderizar = async (definicao = EXEMPLOS_DASHBOARD.controladoria): Promise<void> => {
  await act(async () => {
    ReactDOM.render(
      <DashboardPortalView dashboardId="d1" definicao={definicao} dataverseService={{} as DataverseService} areas={[]} />,
      raiz
    );
  });
};

const abas = (): HTMLButtonElement[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('nav[aria-label="Páginas do painel"] button'));

const clicarAba = (rotulo: string): void => {
  const aba = abas().filter(botao => (botao.textContent || '').trim() === rotulo)[0];
  expect(aba).toBeDefined();
  act(() => { aba.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

const titulosDeSecao = (): string[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('section > div:first-child'))
    .map((el: HTMLElement) => (el.textContent || '').trim());

const caixaIaVisivel = (): boolean => {
  const caixa = raiz.querySelector('.dgt-assistente-dashboard') as HTMLElement | null;
  return !!caixa && (caixa.parentElement as HTMLElement).style.display !== 'none';
};

describe('Dashboard com páginas', () => {

  it('mostra uma aba por página e a aba da IA; abre na primeira página', async () => {
    await renderizar();
    expect(abas().map(aba => (aba.textContent || '').trim()))
      .toEqual(['Visão geral', 'Resultado (DRE)', 'Por área', 'Desvios', 'Aprovações', '✦ Pergunte à IA']);
    expect(titulosDeSecao()).toEqual(['Resultado do ano', 'Tendência']);
    expect(caixaIaVisivel()).toBe(false);
  });

  it('cada aba mostra só as seções da sua página', async () => {
    await renderizar();
    clicarAba('Aprovações');
    expect(titulosDeSecao()).toEqual(['Andamento do CONT-001', 'Planilhas por área']);
    clicarAba('Desvios');
    expect(titulosDeSecao()).toEqual(['Onde o executado se afasta do orçado']);
  });

  it('a aba da IA mostra a caixa de perguntas, sem as seções', async () => {
    await renderizar();
    clicarAba('✦ Pergunte à IA');
    expect(titulosDeSecao()).toEqual([]);
    expect(caixaIaVisivel()).toBe(true);
    expect(raiz.textContent).toMatch(/Resuma o resultado do ano/);
  });

  it('dashboard sem páginas: sem abas, tudo numa tela (como antes)', async () => {
    await renderizar(EXEMPLOS_DASHBOARD['orcamento-area']);
    expect(abas()).toHaveLength(0);
    expect(titulosDeSecao().length).toBe(EXEMPLOS_DASHBOARD['orcamento-area'].secoes.length);
  });
});
