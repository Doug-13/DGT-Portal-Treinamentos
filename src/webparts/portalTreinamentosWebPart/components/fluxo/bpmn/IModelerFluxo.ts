import {
  IBpmnSnapshot
} from '../../../services/fluxo/bpmn/bpmnConversao';

import {
  criarModelerFluxo
} from './modelerFluxo';

// ============================================================
// Contrato do editor BPMN usado pelas telas.
//
// A implementação fica em modelerFluxo.ts (única parte que conhece
// o bpmn-js); as telas usam só este contrato.
// ============================================================

export interface IElementoSelecionadoBpmn {
  id: string;
  tipoBpmn: string;
  nome: string;
  conexao: boolean;
  origemId?: string;
  destinoId?: string;
}

export interface IModelerFluxo {
  importar(xml: string): Promise<string[]>;
  exportarXml(): Promise<string>;
  snapshot(): IBpmnSnapshot;
  elemento(id: string): IElementoSelecionadoBpmn | undefined;
  renomear(id: string, nome: string): void;
  selecionar(id: string): void;
  aoSelecionar(callback: (elemento: IElementoSelecionadoBpmn | undefined) => void): void;
  aoAlterar(callback: () => void): void;
  aoConfigurar(callback: (elemento: IElementoSelecionadoBpmn) => void): void;
  ajustarNaTela(): void;
  aproximar(passo: number): void;
  desfazer(): void;
  refazer(): void;
  destruir(): void;
}

export type CriarModelerFluxo =
  (container: HTMLElement) => IModelerFluxo;

// O editor (bpmn-js) é incluído no pacote principal do web part.
//
// Uma primeira versão baixava o editor sob demanda, em um pacote
// separado (chunk). No SharePoint isso se mostrou instável: quando
// mais de uma cópia do web part é carregada na mesma página/sessão
// (ex.: versão publicada + versão local do "npm run start"), os
// pacotes extras podem ser registrados na cópia errada e o editor
// não abre ("criar is not a function"). Incluindo no pacote
// principal, esse problema deixa de existir.
export const carregarEditorBpmn = async (): Promise<CriarModelerFluxo> =>
  criarModelerFluxo;
