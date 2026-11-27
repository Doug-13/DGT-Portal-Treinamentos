/**
 * @jest-environment jsdom
 */
import {
  ehCampoEditavel,
  ehTeclaDeDigitacao,
  protegerDigitacaoDosAtalhosDaPagina
} from './teclasDigitacao';

// ============================================================
// Digitar ":" / "?" num campo do portal não pode chegar aos atalhos
// do SharePoint (listener no documento); Esc, Enter e Ctrl+… chegam.
// ============================================================

describe('Digitação × atalhos da página', () => {

  let remover: () => void;
  let vistosNoDocumento: string[];
  const ouvirDocumento = (e: KeyboardEvent): void => { vistosNoDocumento.push(e.key); };

  beforeEach(() => {
    document.body.innerHTML = '<input id="campo" /><textarea id="texto"></textarea><button id="botao"></button><div id="div"></div>';
    vistosNoDocumento = [];
    document.addEventListener('keydown', ouvirDocumento);
    remover = protegerDigitacaoDosAtalhosDaPagina();
  });

  afterEach(() => {
    remover();
    document.removeEventListener('keydown', ouvirDocumento);
  });

  const teclar = (id: string, init: KeyboardEventInit): void => {
    document.getElementById(id)!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  };

  it('":" e "?" digitados num campo não chegam ao documento; o próprio campo recebe', () => {
    const noCampo: string[] = [];
    document.getElementById('campo')!.addEventListener('keydown', e => noCampo.push(e.key));
    teclar('campo', { key: ':', shiftKey: true });
    teclar('texto', { key: '?', shiftKey: true });
    expect(vistosNoDocumento).toEqual([]);
    expect(noCampo).toEqual([':']);
  });

  it('Esc, Enter e Ctrl+… chegam ao documento (handlers do portal)', () => {
    teclar('campo', { key: 'Escape' });
    teclar('campo', { key: 'Enter' });
    teclar('campo', { key: 'a', ctrlKey: true, shiftKey: true });
    expect(vistosNoDocumento).toEqual(['Escape', 'Enter', 'a']);
  });

  it('fora de campo editável não muda nada', () => {
    teclar('botao', { key: '?', shiftKey: true });
    teclar('div', { key: ':', shiftKey: true });
    expect(vistosNoDocumento).toEqual(['?', ':']);
  });

  it('remover desfaz a proteção', () => {
    remover();
    teclar('campo', { key: ':', shiftKey: true });
    expect(vistosNoDocumento).toEqual([':']);
    remover = () => undefined;
  });

  it('classificação de tecla e campo', () => {
    expect(ehTeclaDeDigitacao({ key: ':', ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    expect(ehTeclaDeDigitacao({ key: 'F1', ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
    expect(ehTeclaDeDigitacao({ key: 'k', ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(ehCampoEditavel(checkbox)).toBe(false);
    expect(ehCampoEditavel(document.getElementById('campo'))).toBe(true);
    expect(ehCampoEditavel(null)).toBe(false);
  });
});
