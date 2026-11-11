/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import PainelPropriedadesFluxo from './PainelPropriedadesFluxo';

import {
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  IConfigElemento,
  configPadraoElemento
} from '../../services/fluxo/bpmn/bpmnConversao';

const dois = (n: number): string => (n < 10 ? `0${n}` : String(n));

// ============================================================
// TESTE DA TELA — aba "Metadados" do editor da atividade
// Processo com 52 metadados; a atividade exibe 9.
// ============================================================

const METADADOS: IFluxoMetadado[] = Array.from({ length: 52 }, (_v, i) => ({
  chave: `campo${i + 1}`,
  rotulo: `Campo ${dois(i + 1)}`,
  tipo: 'texto'
}));

// 9 campos exibidos (com modos variados e já configurados).
const configInicial = (): IConfigElemento => ({
  ...configPadraoElemento('tarefaHumana'),
  campos: [1, 2, 3, 5, 8, 13, 21, 34, 40].map((n, i) => ({
    chave: `campo${n}`,
    rotulo: `Campo ${dois(n)}`,
    tipo: 'texto' as const,
    obrigatorio: i < 6,
    somenteLeitura: i === 8 ? true : undefined
  }))
});

const Teste: React.FC<{ editavel: boolean; onConfig?: (c: IConfigElemento) => void }> = ({ editavel, onConfig }) => {
  const [config, setConfig] = React.useState<IConfigElemento>(configInicial());
  return (
    <PainelPropriedadesFluxo
      secao="campos"
      selecionado={{ id: 'atividade1', tipoBpmn: 'bpmn:UserTask', nome: 'Programar e confirmar elegibilidade', conexao: false }}
      tipo="tarefaHumana"
      editavel={editavel}
      configElemento={config}
      onAlterarElemento={novo => { setConfig(novo); if (onConfig) { onConfig(novo); } }}
      onAlterarTransicao={() => undefined}
      resultadosDisponiveis={[]}
      metadados={METADADOS}
      onRenomear={() => undefined}
      saidas={[]}
      onAlterarSaida={() => undefined}
      onDefinirPadraoSaida={() => undefined}
      onRenomearSaida={() => undefined}
      onSelecionarSaida={() => undefined}
    />
  );
};

let raiz: HTMLDivElement;

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.appendChild(raiz);
});

afterEach(() => {
  ReactDOM.unmountComponentAtNode(raiz);
  raiz.remove();
});

const montar = (editavel: boolean, onConfig?: (c: IConfigElemento) => void): void => {
  act(() => { ReactDOM.render(<Teste editavel={editavel} onConfig={onConfig} />, raiz); });
};

const seletoresDeModo = (): HTMLSelectElement[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('select[aria-label^="Uso do campo "]'));

const legendas = (): string[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('legend')).map((item: HTMLElement) => (item.textContent || '').trim());

const botoesAdicionar = (): HTMLButtonElement[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('button[aria-label^="Adicionar o campo "]'));

const expandir = (): void => {
  const botao = raiz.querySelector('button[aria-expanded]') as HTMLButtonElement;
  act(() => { botao.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

const escolher = (select: HTMLSelectElement, valor: string): void => {
  act(() => {
    // Atribuição pelo setter nativo (React 17 controla o valor).
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (setter && setter.set) { setter.set.call(select, valor); }
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('Aba Metadados da atividade (52 metadados, 9 na atividade)', () => {

  it('ao abrir: só os 9 campos no topo e "Campos nesta etapa" recolhido abaixo', () => {
    montar(true);
    const ls = legendas();
    expect(ls[0]).toBe('Metadados da atividade (9)');
    expect(ls[1]).toBe('▶ Campos nesta etapa (43 disponível(is))');
    expect(seletoresDeModo()).toHaveLength(9);
    // Ordem do processo e modos preservados.
    expect(seletoresDeModo().map(item => item.getAttribute('aria-label'))).toEqual(
      ['01', '02', '03', '05', '08', '13', '21', '34', '40'].map(n => `Uso do campo Campo ${n}`));
    expect(seletoresDeModo().map(item => item.value)).toEqual(
      ['obrigatorio', 'obrigatorio', 'obrigatorio', 'obrigatorio', 'obrigatorio', 'obrigatorio', 'editavel', 'editavel', 'leitura']);
    // Recolhido: nada para adicionar à vista; sem o editor de definição dos campos.
    expect(botoesAdicionar()).toHaveLength(0);
    expect(raiz.textContent).not.toMatch(/Metadados do processo\s*$/);
  });

  it('expandir mostra só os 43 não vinculados, com busca pelo nome', () => {
    montar(true);
    expandir();
    expect(botoesAdicionar()).toHaveLength(43);
    const busca = raiz.querySelector('input[aria-label="Buscar campo pelo nome"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (setter && setter.set) { setter.set.call(busca, 'Campo 4'); }
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // "Campo 4" → 41..49 (o 40 já está na atividade).
    expect(botoesAdicionar().map(item => item.getAttribute('aria-label'))).toEqual(
      ['41', '42', '43', '44', '45', '46', '47', '48', '49'].map(n => `Adicionar o campo Campo ${n} a esta etapa`));
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (setter && setter.set) { setter.set.call(busca, 'campo 04'); }
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(botoesAdicionar().map(item => item.getAttribute('aria-label'))).toEqual(['Adicionar o campo Campo 04 a esta etapa']);
  });

  it('adicionar leva a 10 (na ordem do processo); "Não exibir" volta a 9 e o campo fica disponível de novo', () => {
    let ultimo: IConfigElemento | undefined;
    montar(true, c => { ultimo = c; });
    expandir();
    const adicionarCampo04 = botoesAdicionar().find(item => item.getAttribute('aria-label') === 'Adicionar o campo Campo 04 a esta etapa') as HTMLButtonElement;
    act(() => { adicionarCampo04.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(legendas()[0]).toBe('Metadados da atividade (10)');
    expect(seletoresDeModo()).toHaveLength(10);
    expect(seletoresDeModo()[3].getAttribute('aria-label')).toBe('Uso do campo Campo 04');
    expect(seletoresDeModo()[3].value).toBe('editavel');
    expect(botoesAdicionar()).toHaveLength(42);
    // Só a configuração DESTA atividade mudou, sem tocar nos outros modos.
    expect(ultimo && ultimo.campos.map(c => c.chave)).toEqual(['campo1', 'campo2', 'campo3', 'campo4', 'campo5', 'campo8', 'campo13', 'campo21', 'campo34', 'campo40']);

    escolher(seletoresDeModo()[3], 'oculto');
    expect(legendas()[0]).toBe('Metadados da atividade (9)');
    expect(seletoresDeModo()).toHaveLength(9);
    expect(botoesAdicionar()).toHaveLength(43);
    expect(seletoresDeModo()[8].value).toBe('leitura');
  });

  it('versão publicada: somente consulta (sem adicionar e modos bloqueados)', () => {
    montar(false);
    expect(seletoresDeModo()).toHaveLength(9);
    expect(seletoresDeModo().every(item => item.disabled)).toBe(true);
    expandir();
    expect(botoesAdicionar()).toHaveLength(0);
    expect(raiz.textContent).toMatch(/Campo 04/);
  });
});
