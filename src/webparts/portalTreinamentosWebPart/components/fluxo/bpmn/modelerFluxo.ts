/* eslint-disable @typescript-eslint/no-explicit-any */
import Modeler from 'bpmn-js/lib/Modeler';

import {
  IBpmnConexao,
  IBpmnForma,
  IBpmnSnapshot
} from '../../../services/fluxo/bpmn/bpmnConversao';

import {
  IElementoSelecionadoBpmn,
  IModelerFluxo
} from './IModelerFluxo';

// Estilos do bpmn-js (carregados só junto com o editor).
require('bpmn-js/dist/assets/diagram-js.css');
require('bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css');

// ============================================================
// IMPLEMENTAÇÃO DO EDITOR COM bpmn-js
//
// Único arquivo que importa o bpmn-js diretamente.
// ============================================================

// ------------------------------------------------------------
// Paleta e menu de contexto: só os elementos suportados
// ------------------------------------------------------------

const PALETA_PERMITIDA: string[] = [
  'hand-tool',
  'lasso-tool',
  'space-tool',
  'global-connect-tool',
  'tool-separator',
  'create.start-event',
  'create.end-event',
  'create.exclusive-gateway',
  'create.task'
];

const CONTEXTO_BLOQUEADO: string[] = [
  'append.receive-task',
  'append.message-intermediate-event',
  'append.timer-intermediate-event',
  'append.condition-intermediate-event',
  'append.signal-intermediate-event',
  'append.compensation-activity',
  'append.intermediate-event'
];

function FiltroPaleta(this: any, palette: any, paletteProvider: any): void {
  this._original = paletteProvider;
  palette.registerProvider(500, this);
}

FiltroPaleta.$inject = ['palette', 'paletteProvider'];

FiltroPaleta.prototype.getPaletteEntries = function (this: any): Record<string, unknown> {
  const entradas = this._original.getPaletteEntries();
  const filtradas: Record<string, unknown> = {};

  Object.keys(entradas).forEach(
    chave => {
      if (PALETA_PERMITIDA.indexOf(chave) >= 0) {
        filtradas[chave] = entradas[chave];
      }
    }
  );

  return filtradas;
};

function FiltroContexto(this: any, contextPad: any): void {
  contextPad.registerProvider(500, this);
}

FiltroContexto.$inject = ['contextPad'];

FiltroContexto.prototype.getContextPadEntries = function (): (entradas: Record<string, unknown>) => Record<string, unknown> {
  return (entradas: Record<string, unknown>) => {
    CONTEXTO_BLOQUEADO.forEach(chave => { delete entradas[chave]; });
    return entradas;
  };
};

// ------------------------------------------------------------
// Tradução dos textos do editor
// ------------------------------------------------------------

const TRADUCOES: Record<string, string> = {
  'Activate hand tool': 'Mover a tela',
  'Activate lasso tool': 'Selecionar vários',
  'Activate create/remove space tool': 'Abrir/fechar espaço',
  'Activate global connect tool': 'Ligar elementos',
  'Create start event': 'Início',
  'Create end event': 'Fim',
  'Create gateway': 'Decisão',
  'Create task': 'Etapa',
  'Append task': 'Adicionar etapa',
  'Append end event': 'Adicionar fim',
  'Append gateway': 'Adicionar decisão',
  'Add text annotation': 'Adicionar anotação',
  'Change element': 'Trocar tipo',
  'Connect to other element': 'Ligar a outro elemento',
  'Connect using association': 'Ligar anotação',
  'Delete': 'Excluir',
  'Task': 'Etapa (tarefa)',
  'User task': 'Etapa com responsável',
  'Manual task': 'Etapa manual',
  'Service task': 'Tarefa de sistema',
  'Script task': 'Tarefa de sistema (script)',
  'Exclusive gateway': 'Decisão (exclusiva)',
  'Start event': 'Início',
  'End event': 'Fim'
};

const traduzir = (
  texto: string,
  substituicoes?: Record<string, string>
): string => {
  const base = TRADUCOES[texto] || texto;

  return base.replace(
    /{([^}]+)}/g,
    (_trecho: string, chave: string) =>
      substituicoes && substituicoes[chave] !== undefined
        ? substituicoes[chave]
        : `{${chave}}`
  );
};

const moduloPersonalizado = {
  __init__: ['filtroPaleta', 'filtroContexto'],
  filtroPaleta: ['type', FiltroPaleta],
  filtroContexto: ['type', FiltroContexto],
  translate: ['value', traduzir]
};

// ------------------------------------------------------------
// Fábrica
// ------------------------------------------------------------

const resumo = (
  elemento: any
): IElementoSelecionadoBpmn | undefined => {

  if (!elemento || elemento.type === 'label' || elemento.type === 'bpmn:Process') {
    return undefined;
  }

  return {
    id: elemento.id,
    tipoBpmn: elemento.type,
    nome: (elemento.businessObject && elemento.businessObject.name) || '',
    conexao: !!elemento.waypoints,
    origemId: elemento.source ? elemento.source.id : undefined,
    destinoId: elemento.target ? elemento.target.id : undefined
  };
};

export const criarModelerFluxo = (
  container: HTMLElement
): IModelerFluxo => {

  const modeler: any =
    new Modeler({
      container,
      additionalModules: [moduloPersonalizado]
    });

  const servico = (nome: string): any => modeler.get(nome);

  return {

    async importar(xml: string): Promise<string[]> {
      const resultado = await modeler.importXML(xml);
      servico('canvas').zoom('fit-viewport', 'auto');
      return ((resultado && resultado.warnings) || []).map(
        (aviso: any) => String((aviso && aviso.message) || aviso)
      );
    },

    async exportarXml(): Promise<string> {
      const resultado = await modeler.saveXML({ format: true });
      return resultado.xml || '';
    },

    snapshot(): IBpmnSnapshot {

      const formas: IBpmnForma[] = [];
      const conexoes: IBpmnConexao[] = [];

      servico('elementRegistry').getAll().forEach(
        (elemento: any) => {

          if (!elemento || elemento.type === 'label' || !elemento.businessObject) {
            return;
          }

          if (elemento.type === 'bpmn:Process' || elemento.type === 'bpmn:Collaboration') {
            return;
          }

          const nome =
            (elemento.businessObject.name || '').trim();

          const rotulo =
            elemento.label && elemento.label.width
              ? {
                x: elemento.label.x,
                y: elemento.label.y,
                largura: elemento.label.width,
                altura: elemento.label.height
              }
              : undefined;

          if (elemento.waypoints) {
            conexoes.push({
              id: elemento.id,
              tipo: elemento.type,
              nome,
              origemId: elemento.source ? elemento.source.id : '',
              destinoId: elemento.target ? elemento.target.id : '',
              pontos: elemento.waypoints.map((ponto: any) => ({ x: ponto.x, y: ponto.y })),
              rotulo
            });
            return;
          }

          formas.push({
            id: elemento.id,
            tipo: elemento.type,
            nome,
            x: elemento.x,
            y: elemento.y,
            largura: elemento.width,
            altura: elemento.height,
            rotulo
          });
        }
      );

      return { formas, conexoes };
    },

    elemento(id: string): IElementoSelecionadoBpmn | undefined {
      return resumo(servico('elementRegistry').get(id));
    },

    renomear(id: string, nome: string): void {
      const elemento = servico('elementRegistry').get(id);

      if (elemento) {
        servico('modeling').updateLabel(elemento, nome);
      }
    },

    selecionar(id: string): void {
      const elemento = servico('elementRegistry').get(id);

      if (elemento) {
        servico('selection').select(elemento);
      }
    },

    aoSelecionar(callback: (elemento: IElementoSelecionadoBpmn | undefined) => void): void {
      servico('eventBus').on(
        'selection.changed',
        (evento: any) => {
          const selecionados = (evento && evento.newSelection) || [];
          callback(selecionados.length === 1 ? resumo(selecionados[0]) : undefined);
        }
      );
    },

    aoAlterar(callback: () => void): void {
      servico('eventBus').on('commandStack.changed', () => callback());
    },

    ajustarNaTela(): void {
      servico('canvas').zoom('fit-viewport', 'auto');
    },

    aproximar(passo: number): void {
      servico('zoomScroll').stepZoom(passo);
    },

    desfazer(): void {
      servico('commandStack').undo();
    },

    refazer(): void {
      servico('commandStack').redo();
    },

    destruir(): void {
      modeler.destroy();
    }
  };
};
