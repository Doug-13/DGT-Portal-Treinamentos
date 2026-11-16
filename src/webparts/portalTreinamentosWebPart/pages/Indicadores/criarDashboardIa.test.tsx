/**
 * @jest-environment jsdom
 */
// Fontes simuladas (antes dos imports, para o mock valer).
jest.mock('../../services/dashboards/fontesDashboard', () => {
  const real = jest.requireActual('../../services/dashboards/fontesDashboard');
  return {
    ...real,
    carregarFonte: async () => [{ area: 'PRO · PROCESSOS', usuario: 'Ana', treinamento: 'NR-12', concluido: 'Sim', situacaoPrazo: 'Em dia', situacaoValidade: 'Em dia', atribuicoes: 1, trilhas: 1, tentativas: 1, aprovacoes: 1, certificados: 1 }]
  };
});

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import CriarDashboardIaModal from './CriarDashboardIaModal';
import { EXEMPLOS_DASHBOARD } from '../../services/dashboards/exemplosDashboard';
import { DataverseService } from '../../services/DataverseService';
import { DashboardService } from '../../services/DashboardService';

// ============================================================
// TELA ✦ CRIAR COM IA — descrever, gerar, ver a prévia e salvar
// ============================================================

let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

const digitar = async (campo: HTMLTextAreaElement, texto: string): Promise<void> => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value') as PropertyDescriptor;
    (setter.set as (v: string) => void).call(campo, texto);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const clicar = async (texto: RegExp): Promise<void> => {
  const botao = Array.prototype.slice.call(raiz.querySelectorAll('button')).filter((b: HTMLButtonElement) => texto.test(b.textContent || ''))[0] as HTMLButtonElement;
  expect(botao).toBeDefined();
  await act(async () => { botao.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('✦ Criar dashboard com IA', () => {

  it('gera, mostra a prévia com o resumo e salva como dashboard pessoal', async () => {
    const chamadas: Array<Record<string, unknown>> = [];
    const dataverse = {
      executarCustomApiJson: async (_api: string, payload: Record<string, unknown>) => {
        chamadas.push(payload);
        return { resumo: 'Painel com a execução do seu time.', semDados: ['Carga horária dos treinamentos'], definicao: JSON.stringify(EXEMPLOS_DASHBOARD.treinamentos) };
      }
    } as unknown as DataverseService;
    const salvar = jest.fn(async () => 'novo-id');
    const servico = { salvar } as unknown as DashboardService;
    const onSalvo = jest.fn();

    await act(async () => {
      ReactDOM.render(
        <CriarDashboardIaModal
          dataverseService={dataverse}
          dashboardService={servico}
          acesso={{ perfil: 'Gestor', modulosPermitidos: ['treinamentos'], veTodasAsAreas: false }}
          areas={[]}
          areasPermitidas={['area-pro']}
          onSalvo={onSalvo}
          onFechar={() => undefined}
        />,
        raiz
      );
    });

    // Só as fontes liberadas aparecem como dados disponíveis.
    expect(raiz.textContent).toMatch(/Treinamentos — atribuições por usuário/);
    expect(raiz.textContent).not.toMatch(/Orçamento/);

    await digitar(raiz.querySelector('textarea') as HTMLTextAreaElement, 'execução dos treinamentos do meu time');
    await clicar(/Criar painel/);

    expect(chamadas[0].pedido).toBe('execução dos treinamentos do meu time');
    expect(raiz.textContent).toMatch(/Painel com a execução do seu time/);
    expect(raiz.textContent).toMatch(/Carga horária dos treinamentos/);
    // Prévia com abas do painel gerado.
    expect(raiz.textContent).toMatch(/Prévia com os seus dados/);
    expect(raiz.querySelector('nav[aria-label="Páginas do painel"]')).not.toBeNull();

    await clicar(/Salvar em Meus dashboards/);
    expect(salvar).toHaveBeenCalledTimes(1);
    const dados = (salvar.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(dados).toMatchObject({ pessoal: true, tipo: 'Portal', nome: EXEMPLOS_DASHBOARD.treinamentos.titulo });
    expect(onSalvo).toHaveBeenCalledWith('novo-id');
  });

  it('sem nenhuma fonte liberada, avisa e não deixa criar', async () => {
    await act(async () => {
      ReactDOM.render(
        <CriarDashboardIaModal
          dataverseService={{} as DataverseService}
          dashboardService={{} as DashboardService}
          acesso={{ perfil: 'Colaborador', modulosPermitidos: ['rh'], veTodasAsAreas: false }}
          areas={[]}
          onSalvo={() => undefined}
          onFechar={() => undefined}
        />,
        raiz
      );
    });
    expect(raiz.textContent).toMatch(/não tem acesso a nenhuma fonte/);
    expect(raiz.querySelector('textarea')).toBeNull();
  });
});
