/**
 * @jest-environment jsdom
 */
// Fontes simuladas: registram as áreas pedidas por fonte.
const pedidos: Array<{ fonte: string; areaIds?: string[] }> = [];
jest.mock('../../services/dashboards/fontesDashboard', () => {
  const real = jest.requireActual('../../services/dashboards/fontesDashboard');
  return {
    ...real,
    carregarFonte: async (fonte: string, contexto: { areaIds?: string[] }) => {
      pedidos.push({ fonte, areaIds: contexto.areaIds });
      return [];
    }
  };
});

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import DashboardPortalView from './DashboardPortalView';
import { areasDaFonte, moduloDaFonte, veTodasAsAreasNaFonte } from '../../services/dashboards/acessoFontes';
import { IDefinicaoDashboard } from '../../services/dashboards/dashboardModelo';
import { DataverseService } from '../../services/DataverseService';

// ============================================================
// ÁREAS POR FONTE — Administrador do módulo vê todas as áreas nas
// fontes do módulo (caso: Controladoria administra o orçamento).
// ============================================================

describe('Regra de áreas por fonte', () => {

  it('administrador do módulo vê todas as áreas só nas fontes daquele módulo', () => {
    expect(moduloDaFonte('orcamento.dre')).toBe('orcamento');
    expect(veTodasAsAreasNaFonte('orcamento.dre', ['ctl'], ['orcamento'])).toBe(true);
    expect(veTodasAsAreasNaFonte('treinamentos.atribuicoes', ['ctl'], ['orcamento'])).toBe(false);
    expect(veTodasAsAreasNaFonte('orcamento.dre', ['ctl'], [])).toBe(false);
    // Quem já vê todas (Administrador / Indicadores) continua vendo.
    expect(veTodasAsAreasNaFonte('treinamentos.atribuicoes', undefined, [])).toBe(true);
  });

  it('área escolhida no filtro: só vale onde a pessoa pode vê-la', () => {
    expect(areasDaFonte('orcamento.dre', '', ['ctl'], ['orcamento'])).toBeUndefined();
    expect(areasDaFonte('orcamento.dre', 'cpu', ['ctl'], ['orcamento'])).toEqual(['cpu']);
    expect(areasDaFonte('treinamentos.atribuicoes', 'cpu', ['ctl'], ['orcamento'])).toEqual([]);
    expect(areasDaFonte('treinamentos.atribuicoes', 'ctl', ['ctl'], ['orcamento'])).toEqual(['ctl']);
    expect(areasDaFonte('treinamentos.atribuicoes', '', ['ctl'], ['orcamento'])).toEqual(['ctl']);
  });
});

describe('Painel da Controladoria (participa só da CTL, administra o orçamento)', () => {
  let raiz: HTMLDivElement;
  beforeEach(() => { pedidos.length = 0; raiz = document.createElement('div'); document.body.appendChild(raiz); });
  afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

  const definicao: IDefinicaoDashboard = {
    formato: 'dgt-portal/dashboard@1',
    titulo: 'Receita de locação',
    filtros: { ano: true, area: true },
    secoes: [{
      titulo: 'Meta',
      itens: [
        { tipo: 'cartao', titulo: 'Meta', fonte: 'orcamento.linhas', medida: 'orcado', agregacao: 'soma' },
        { tipo: 'cartao', titulo: 'Treinamentos', fonte: 'treinamentos.atribuicoes', medida: 'atribuicoes', agregacao: 'soma' }
      ]
    }]
  };

  it('orçamento de todas as áreas; treinamentos só da CTL; seletor oferece todas as áreas', async () => {
    await act(async () => {
      ReactDOM.render(
        <DashboardPortalView
          definicao={definicao}
          dataverseService={{} as DataverseService}
          areas={[{ id: 'ctl', nome: 'CTL · CONTROLADORIA' }, { id: 'cpu', nome: 'CPU · COMERCIAL PÚBLICO' }]}
          areasPermitidas={['ctl']}
          modulosAdministrados={['orcamento']}
        />,
        raiz
      );
    });
    expect(pedidos.filter(p => p.fonte === 'orcamento.linhas')[0].areaIds).toBeUndefined();
    expect(pedidos.filter(p => p.fonte === 'treinamentos.atribuicoes')[0].areaIds).toEqual(['ctl']);
    const opcoes = Array.prototype.slice.call(raiz.querySelectorAll('select option')).map((o: HTMLOptionElement) => o.textContent);
    expect(opcoes).toContain('CPU · COMERCIAL PÚBLICO');
    expect(opcoes).toContain('Todas as áreas');
  });

  it('sem administrar o módulo: tudo limitado à CTL (comportamento anterior)', async () => {
    await act(async () => {
      ReactDOM.render(
        <DashboardPortalView definicao={definicao} dataverseService={{} as DataverseService} areas={[{ id: 'ctl', nome: 'CTL' }, { id: 'cpu', nome: 'CPU' }]} areasPermitidas={['ctl']} />,
        raiz
      );
    });
    expect(pedidos.every(p => (p.areaIds || []).join() === 'ctl')).toBe(true);
    const opcoes = Array.prototype.slice.call(raiz.querySelectorAll('select option')).map((o: HTMLOptionElement) => o.textContent);
    expect(opcoes).not.toContain('CPU');
  });
});
