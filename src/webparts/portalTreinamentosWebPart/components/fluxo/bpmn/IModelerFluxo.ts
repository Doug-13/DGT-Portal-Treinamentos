import {
  IBpmnSnapshot
} from '../../../services/fluxo/bpmn/bpmnConversao';

// ============================================================
// Contrato do editor BPMN usado pelas telas.
//
// A implementação (modelerFluxo.ts) importa o bpmn-js e é
// carregada sob demanda, em um pacote separado, só quando alguém
// abre o editor. Assim o portal não fica mais pesado para quem
// apenas consulta documentos e treinamentos.
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
  ajustarNaTela(): void;
  aproximar(passo: number): void;
  desfazer(): void;
  refazer(): void;
  destruir(): void;
}

export type CriarModelerFluxo =
  (container: HTMLElement) => IModelerFluxo;

export const carregarEditorBpmn = async (): Promise<CriarModelerFluxo> => {

  const modulo =
    await import(
      /* webpackChunkName: 'editor-fluxo-bpmn' */
      './modelerFluxo'
    );

  return modulo.criarModelerFluxo;
};
