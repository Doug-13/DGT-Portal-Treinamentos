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

import {
  ESTILOS_BPMN,
  VERSAO_ESTILOS_BPMN
} from './estilosBpmn';

// Estilos do bpmn-js: injetados na página uma única vez, como texto.
// (Importar os .css pelo webpack do SPFx quebra o "npm run start";
// veja scripts/gerar-estilos-bpmn.js.)
const ID_ESTILOS = `dgt-estilos-bpmn-${VERSAO_ESTILOS_BPMN}`;

const injetarEstilos = (): void => {

  if (document.getElementById(ID_ESTILOS)) {
    return;
  }

  const estilo =
    document.createElement('style');

  estilo.id = ID_ESTILOS;

  // Mesma regra de segurança (CSP) usada pelos estilos do SPFx.
  const nonce =
    (window as unknown as { CSPSettings?: { nonce?: string } }).CSPSettings?.nonce;

  if (nonce) {
    estilo.setAttribute('nonce', nonce);
  }
  estilo.appendChild(document.createTextNode(ESTILOS_BPMN));

  document.head.appendChild(estilo);
};

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

// O provedor devolve uma FUNÇÃO que recebe as entradas já montadas
// pelo bpmn-js e retorna só as permitidas (devolver um objeto apenas
// somaria entradas, sem remover as outras).
function FiltroPaleta(this: any, palette: any): void {
  palette.registerProvider(500, this);
}

FiltroPaleta.$inject = ['palette'];

FiltroPaleta.prototype.getPaletteEntries = function (): (entradas: Record<string, unknown>) => Record<string, unknown> {
  return (entradas: Record<string, unknown>) => {
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
};

// Evento interno: pedir para abrir a configuração de um elemento.
const EVENTO_CONFIGURAR = 'dgt.configurar';

function FiltroContexto(this: any, contextPad: any, eventBus: any): void {
  this._eventBus = eventBus;
  contextPad.registerProvider(500, this);
}

FiltroContexto.$inject = ['contextPad', 'eventBus'];

FiltroContexto.prototype.getContextPadEntries = function (this: any, elemento: any): (entradas: Record<string, unknown>) => Record<string, unknown> {

  const eventBus = this._eventBus;

  return (entradas: Record<string, unknown>) => {

    CONTEXTO_BLOQUEADO.forEach(chave => { delete entradas[chave]; });

    // Botão "Configurar" no menu do elemento (abre o modal).
    if (elemento && elemento.type !== 'label') {
      entradas['dgt.configurar'] = {
        group: 'edit',
        html: '<div class="entry" style="display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;color:#202A44">⚙</div>',
        title: 'Configurar',
        action: {
          click: () => eventBus.fire(EVENTO_CONFIGURAR, { element: elemento })
        }
      };
    }

    return entradas;
  };
};

// Duplo clique abre a configuração (no lugar da edição do texto
// direto no desenho; o nome é editado no modal).
function DuploCliqueConfigura(this: any, eventBus: any): void {
  eventBus.on('element.dblclick', 1500, (evento: any) => {

    let elemento = evento && evento.element;

    if (elemento && elemento.type === 'label' && elemento.labelTarget) {
      elemento = elemento.labelTarget;
    }

    if (!elemento || elemento.type === 'bpmn:Process' || elemento.type === 'bpmn:Collaboration') {
      return;
    }

    eventBus.fire(EVENTO_CONFIGURAR, { element: elemento });

    // Impede a edição do texto direto no desenho.
    return false;
  });
}

DuploCliqueConfigura.$inject = ['eventBus'];

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
  __init__: ['filtroPaleta', 'filtroContexto', 'duploCliqueConfigura'],
  filtroPaleta: ['type', FiltroPaleta],
  filtroContexto: ['type', FiltroContexto],
  duploCliqueConfigura: ['type', DuploCliqueConfigura],
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

  injetarEstilos();

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

    aoConfigurar(callback: (elemento: IElementoSelecionadoBpmn) => void): void {
      servico('eventBus').on(
        EVENTO_CONFIGURAR,
        (evento: any) => {
          const info = resumo(evento && evento.element);
          if (info) {
            callback(info);
          }
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
