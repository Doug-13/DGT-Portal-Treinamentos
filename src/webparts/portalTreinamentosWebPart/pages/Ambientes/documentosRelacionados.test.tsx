/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import DocumentosRelacionados, {
  IReferenciaResolvida
} from './DocumentosRelacionados';

// ============================================================
// TESTES — Documentos relacionados (cartões com situação e link)
// ============================================================

const grupos = [{
  chave: 'rncEmitidos',
  rotulo: 'RNC emitidos (um por linha NC do checklist)',
  documentos: [
    { id: '11111111-1111-1111-1111-111111111111', codigo: 'RNC-2026-0001', titulo: 'AUD-2026-0002 — RNC item 4 (Execução)' },
    { id: '22222222-2222-2222-2222-222222222222', codigo: 'RNC-2026-0002', titulo: 'AUD-2026-0002 — RNC item 5 (Registros e rastreabilidade)' }
  ]
}];

const resolvidos: IReferenciaResolvida[] = [{
  tipo: 'registro', id: '11111111-1111-1111-1111-111111111111', codigo: 'RNC-2026-0001',
  titulo: 'AUD-2026-0002 — RNC item 4 (Execução)', ambienteNome: 'Não Conformidades', ambienteChave: 'nao-conformidades',
  mesmoAmbiente: false, situacao: 'emAndamento', etapaAtual: 'Análise de causa'
}];

describe('Documentos relacionados', () => {

  let raiz: HTMLDivElement;

  beforeEach(() => {
    raiz = document.createElement('div');
    document.body.appendChild(raiz);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(raiz);
    raiz.remove();
  });

  it('mostra cada referência como cartão, com situação, etapa e título sem o código do registro', async () => {
    await act(async () => {
      ReactDOM.render(
        <DocumentosRelacionados grupos={grupos} codigoRegistro="AUD-2026-0002" resolver={async () => resolvidos} onAbrir={() => undefined} />,
        raiz
      );
    });

    const cartoes = raiz.querySelectorAll('button[data-referencia]');
    expect(cartoes.length).toBe(2);
    const primeiro = cartoes[0].textContent || '';
    expect(primeiro).toContain('RNC-2026-0001');
    expect(primeiro).toContain('Em andamento');
    expect(primeiro).toContain('RNC item 4 (Execução)');
    expect(primeiro).not.toContain('AUD-2026-0002');
    expect(primeiro).toContain('Não Conformidades');
    expect(primeiro).toContain('Etapa: Análise de causa');
    // Referência que não pôde ser lida continua listada, com aviso.
    expect(cartoes[1].textContent || '').toContain('sem acesso ou removido');
  });

  it('abre a referência resolvida ao clicar', async () => {
    const abertos: IReferenciaResolvida[] = [];
    await act(async () => {
      ReactDOM.render(
        <DocumentosRelacionados grupos={grupos} codigoRegistro="AUD-2026-0002" resolver={async () => resolvidos} onAbrir={ref => abertos.push(ref)} />,
        raiz
      );
    });

    act(() => {
      (raiz.querySelector('button[data-referencia="RNC-2026-0001"]') as HTMLButtonElement).click();
    });

    expect(abertos.length).toBe(1);
    expect(abertos[0].ambienteChave).toBe('nao-conformidades');
    expect(abertos[0].id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('cartão tem fundo branco inline (não herda o azul do botão global) e mostra o registro de origem', async () => {
    const origem = [{
      chave: '__origem', rotulo: 'Originado por — Emitir RNC das NC do checklist, linha 5', origem: true,
      documentos: [{ id: '33333333-3333-3333-3333-333333333333', codigo: 'AUD-2026-0002', titulo: '001/2026' }]
    }];
    await act(async () => {
      ReactDOM.render(
        <DocumentosRelacionados grupos={origem} codigoRegistro="RNC-2026-0002" resolver={async () => [{
          tipo: 'registro', id: '33333333-3333-3333-3333-333333333333', codigo: 'AUD-2026-0002', titulo: '001/2026',
          ambienteNome: 'Auditoria', ambienteChave: 'auditoria', mesmoAmbiente: false, situacao: 'emAndamento', etapaAtual: 'Emitir relatório'
        }]} onAbrir={() => undefined} />,
        raiz
      );
    });
    expect(raiz.textContent || '').toContain('Originado por');
    const cartao = raiz.querySelector('button[data-referencia="AUD-2026-0002"]') as HTMLButtonElement;
    expect(cartao).not.toBeNull();
    expect(cartao.style.background).toMatch(/#ffffff|rgb\(255, 255, 255\)/i);
    expect(cartao.textContent || '').toContain('Auditoria');
  });

  it('sem onAbrir, os cartões não são botões', async () => {
    await act(async () => {
      ReactDOM.render(<DocumentosRelacionados grupos={grupos} codigoRegistro="AUD-2026-0002" />, raiz);
    });
    expect(raiz.querySelectorAll('button').length).toBe(0);
    expect(raiz.querySelectorAll('[data-referencia]').length).toBe(2);
  });
});
