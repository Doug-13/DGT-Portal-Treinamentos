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

// Variável especial do webpack: pasta de onde os pacotes extras
// (chunks) são baixados.
declare let __webpack_public_path__: string;

const NOME_PACOTE_PRINCIPAL =
  /portal-treinamentos-web-part_[0-9a-f]+\.js/i;

// Em algumas formas de carregamento do SharePoint o webpack não
// descobre corretamente a pasta do pacote (fica vazia, relativa à
// página ou apontando para o carregador do SharePoint), e o download
// do editor falha com "ChunkLoadError". Aqui a pasta é sempre a do
// pacote principal deste web part, que já foi carregado.
export const ajustarCaminhoDosPacotes = (): string => {

  try {

    const enderecos: string[] = [];

    Array.from(document.getElementsByTagName('script')).forEach(
      script => {
        if (script.src) {
          enderecos.push(script.src);
        }
      }
    );

    if (window.performance && typeof window.performance.getEntriesByType === 'function') {
      window.performance.getEntriesByType('resource').forEach(
        entrada => enderecos.push(entrada.name)
      );
    }

    const principal =
      enderecos.find(endereco => NOME_PACOTE_PRINCIPAL.test(endereco.split('?')[0]));

    if (principal) {
      const semConsulta =
        principal.split('?')[0];

      __webpack_public_path__ =
        semConsulta.slice(0, semConsulta.lastIndexOf('/') + 1);
    }

    return __webpack_public_path__ || '';

  } catch (error) {
    console.error(error);
    return '';
  }
};

export const carregarEditorBpmn = async (): Promise<CriarModelerFluxo> => {

  ajustarCaminhoDosPacotes();

  const modulo =
    await import(
      /* webpackChunkName: 'editor-fluxo-bpmn' */
      './modelerFluxo'
    );

  return modulo.criarModelerFluxo;
};
