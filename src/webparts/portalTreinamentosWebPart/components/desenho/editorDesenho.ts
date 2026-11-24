/* eslint-disable @typescript-eslint/no-explicit-any */
import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import {
  ESTILOS_BPMN,
  VERSAO_ESTILOS_BPMN
} from '../fluxo/bpmn/estilosBpmn';

// ============================================================
// EDITOR DO MODO DESENHO (documentação de processos)
//
// Substitui o Visio para desenhar fluxogramas. Diferente do editor
// de FLUXOS (components/fluxo/bpmn/modelerFluxo.ts):
//
//   • usa a paleta COMPLETA do BPMN (raias, subprocessos, objetos
//     de dados, anotações, grupos...);
//   • NÃO tem responsáveis, ações, prazos nem metadados;
//   • o desenho NUNCA é lido pelo motor de fluxo.
//
// Único arquivo do modo Desenho que importa o bpmn-js.
// ============================================================

// Mesmo id usado pelo editor de fluxos: os estilos são injetados
// uma única vez, venha o editor de onde vier.
const ID_ESTILOS = `dgt-estilos-bpmn-${VERSAO_ESTILOS_BPMN}`;

const injetarEstilos = (): void => {

  if (document.getElementById(ID_ESTILOS)) {
    return;
  }

  const estilo =
    document.createElement('style');

  estilo.id = ID_ESTILOS;

  const nonce =
    (window as unknown as { CSPSettings?: { nonce?: string } }).CSPSettings?.nonce;

  if (nonce) {
    estilo.setAttribute('nonce', nonce);
  }

  estilo.appendChild(document.createTextNode(ESTILOS_BPMN));

  document.head.appendChild(estilo);
};

// ------------------------------------------------------------
// Tradução dos textos do editor
// ------------------------------------------------------------

const TRADUCOES: Record<string, string> = {
  // Paleta
  'Activate hand tool': 'Mover a tela',
  'Activate lasso tool': 'Selecionar vários',
  'Activate create/remove space tool': 'Abrir/fechar espaço',
  'Activate global connect tool': 'Ligar elementos',
  'Create start event': 'Início',
  'Create intermediate/boundary event': 'Evento intermediário',
  'Create end event': 'Fim',
  'Create gateway': 'Decisão',
  'Create task': 'Atividade',
  'Create data object reference': 'Documento / dado',
  'Create data store reference': 'Sistema / base de dados',
  'Create expanded sub-process': 'Subprocesso',
  'Create pool/participant': 'Piscina (com raias)',
  'Create group': 'Agrupamento',
  'Create element': 'Mais elementos',

  // Menu de contexto
  'Append task': 'Adicionar atividade',
  'Append end event': 'Adicionar fim',
  'Append gateway': 'Adicionar decisão',
  'Append intermediate/boundary event': 'Adicionar evento',
  'Append element': 'Adicionar elemento',
  'Add text annotation': 'Adicionar anotação',
  'Change element': 'Trocar tipo ou cor',
  'Change type': 'Trocar tipo',
  'Connect to other element': 'Ligar a outro elemento',
  'Connect using association': 'Ligar anotação',
  'Connect using data input association': 'Ligar dado de entrada',
  'Delete': 'Excluir',
  'Add lane above': 'Adicionar raia acima',
  'Add lane below': 'Adicionar raia abaixo',
  'Divide into two lanes': 'Dividir em duas raias',
  'Divide into three lanes': 'Dividir em três raias',
  'Set color': 'Cor',

  // Elementos (menu "Trocar tipo")
  'Task': 'Atividade',
  'User task': 'Atividade de pessoa',
  'Manual task': 'Atividade manual',
  'Service task': 'Atividade de sistema',
  'Script task': 'Atividade automática (script)',
  'Send task': 'Enviar',
  'Receive task': 'Receber',
  'Business rule task': 'Regra de negócio',
  'Call activity': 'Chamar outro processo',
  'Sub-process': 'Subprocesso',
  'Sub-process (collapsed)': 'Subprocesso (recolhido)',
  'Sub-process (expanded)': 'Subprocesso (expandido)',
  'Exclusive gateway': 'Decisão (um caminho)',
  'Parallel gateway': 'Paralelo (todos os caminhos)',
  'Inclusive gateway': 'Decisão (um ou mais caminhos)',
  'Event-based gateway': 'Decisão por evento',
  'Complex gateway': 'Decisão complexa',
  'Start event': 'Início',
  'End event': 'Fim',
  'Intermediate throw event': 'Evento intermediário',
  'Message start event': 'Início por mensagem',
  'Timer start event': 'Início por data/hora',
  'Message end event': 'Fim com mensagem',
  'Terminate end event': 'Fim (encerra tudo)',
  'Message intermediate catch event': 'Aguardar mensagem',
  'Timer intermediate catch event': 'Aguardar prazo',
  'Data object reference': 'Documento / dado',
  'Data store reference': 'Sistema / base de dados',
  'Text annotation': 'Anotação',
  'Group': 'Agrupamento',
  'Pool': 'Piscina',
  'Lane': 'Raia',
  'Participant': 'Piscina',
  'Sequence flow': 'Seta',
  'Default flow': 'Caminho padrão',
  'Conditional flow': 'Caminho condicional',
  'Search in diagram': 'Procurar no desenho'
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


// ------------------------------------------------------------
// Desenho inicial: uma piscina com duas raias (equivale ao
// "fluxograma multifuncional" do Visio).
// ------------------------------------------------------------

const escaparXml = (
  valor: string
): string =>
  (valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const xmlDesenhoInicial = (
  titulo: string
): string =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
  'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
  'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ' +
  'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ' +
  'id="Definicoes_1" targetNamespace="http://bpmn.io/schema/bpmn">\n' +
  '  <bpmn:collaboration id="Colaboracao_1">\n' +
  `    <bpmn:participant id="Piscina_1" name="${escaparXml(titulo || 'Processo')}" processRef="Processo_1" />\n` +
  '  </bpmn:collaboration>\n' +
  '  <bpmn:process id="Processo_1" isExecutable="false">\n' +
  '    <bpmn:laneSet id="ConjuntoRaias_1">\n' +
  '      <bpmn:lane id="Raia_1" name="Área / cargo 1">\n' +
  '        <bpmn:flowNodeRef>Inicio_1</bpmn:flowNodeRef>\n' +
  '      </bpmn:lane>\n' +
  '      <bpmn:lane id="Raia_2" name="Área / cargo 2" />\n' +
  '    </bpmn:laneSet>\n' +
  '    <bpmn:startEvent id="Inicio_1" name="Início" />\n' +
  '  </bpmn:process>\n' +
  '  <bpmndi:BPMNDiagram id="Diagrama_1">\n' +
  '    <bpmndi:BPMNPlane id="Plano_1" bpmnElement="Colaboracao_1">\n' +
  '      <bpmndi:BPMNShape id="Piscina_1_di" bpmnElement="Piscina_1" isHorizontal="true">\n' +
  '        <dc:Bounds x="120" y="80" width="900" height="400" />\n' +
  '      </bpmndi:BPMNShape>\n' +
  '      <bpmndi:BPMNShape id="Raia_1_di" bpmnElement="Raia_1" isHorizontal="true">\n' +
  '        <dc:Bounds x="150" y="80" width="870" height="200" />\n' +
  '      </bpmndi:BPMNShape>\n' +
  '      <bpmndi:BPMNShape id="Raia_2_di" bpmnElement="Raia_2" isHorizontal="true">\n' +
  '        <dc:Bounds x="150" y="280" width="870" height="200" />\n' +
  '      </bpmndi:BPMNShape>\n' +
  '      <bpmndi:BPMNShape id="Inicio_1_di" bpmnElement="Inicio_1">\n' +
  '        <dc:Bounds x="202" y="162" width="36" height="36" />\n' +
  '        <bpmndi:BPMNLabel>\n' +
  '          <dc:Bounds x="206" y="205" width="28" height="14" />\n' +
  '        </bpmndi:BPMNLabel>\n' +
  '      </bpmndi:BPMNShape>\n' +
  '    </bpmndi:BPMNPlane>\n' +
  '  </bpmndi:BPMNDiagram>\n' +
  '</bpmn:definitions>\n';

// ------------------------------------------------------------
// Cores
//
// Paleta fixa (identidade DGT + cores de apoio), para os desenhos
// ficarem padronizados. "preenchimento" = fundo; "borda" = linha
// e texto. Ficam gravadas no próprio BPMN (bioc:fill/bioc:stroke e
// color:background-color/border-color), então aparecem no PDF, no
// PNG/SVG e em outras ferramentas BPMN.
// ------------------------------------------------------------

export interface ICorDesenho {
  nome: string;
  preenchimento: string;
  borda: string;
}

export const CORES_DESENHO: ICorDesenho[] = [
  { nome: 'Azul DGT', preenchimento: '#DDE2EE', borda: '#202A44' },
  { nome: 'Ciano DGT', preenchimento: '#D7F5F9', borda: '#03879A' },
  { nome: 'Verde', preenchimento: '#E3F4E1', borda: '#2E7D32' },
  { nome: 'Amarelo', preenchimento: '#FFF4CC', borda: '#9A7400' },
  { nome: 'Laranja', preenchimento: '#FFE5D0', borda: '#C2410C' },
  { nome: 'Vermelho', preenchimento: '#FDE2E1', borda: '#B42318' },
  { nome: 'Roxo', preenchimento: '#ECE5F6', borda: '#6A3FA0' },
  { nome: 'Cinza', preenchimento: '#EEEEEE', borda: '#5E6670' }
];

const corPorNome = (
  nome: string
): ICorDesenho =>
  CORES_DESENHO.filter(cor => cor.nome === nome)[0];

// ------------------------------------------------------------
// Cores padrão (automáticas)
//
//   Atividades → Azul DGT
//   Decisões   → Amarelo
//
// Aplicadas ao criar o elemento, ao trocar o tipo (chave de boca)
// e ao abrir desenhos antigos que ainda estão sem cor. Depois disso
// a pessoa pode trocar a cor pela chave de boca.
// ------------------------------------------------------------

export const corPadraoDoElemento = (
  elemento: any
): ICorDesenho | undefined => {
  if (!elemento || !elemento.businessObject || elemento.type === 'label') {
    return undefined;
  }
  if (is(elemento, 'bpmn:Gateway')) {
    return corPorNome('Amarelo');
  }
  if (is(elemento, 'bpmn:Task') || is(elemento, 'bpmn:CallActivity')) {
    return corPorNome('Azul DGT');
  }
  return undefined;
};

const temCor = (
  elemento: any
): boolean => {
  const di = elemento && elemento.di;
  if (!di || !di.get) {
    return false;
  }
  try {
    return !!(di.get('color:background-color') || di.get('bioc:fill'));
  } catch {
    return false;
  }
};

const coresDoComando = (
  elemento: any,
  cor: ICorDesenho | undefined
): any => {
  if (!cor) {
    return undefined;
  }
  return elemento.waypoints
    ? { stroke: cor.borda }
    : { fill: cor.preenchimento, stroke: cor.borda };
};

function CoresPadrao(this: any, eventBus: any, modeling: any): void {

  (CommandInterceptor as any).call(this, eventBus);

  // Elemento novo (paleta, "adicionar" do menu, colar): só pinta se
  // ainda não tiver cor (o que foi colado mantém a cor de origem).
  this.postExecuted('shape.create', (evento: any) => {
    const forma = evento.context && evento.context.shape;
    const cor = corPadraoDoElemento(forma);
    if (cor && !temCor(forma)) {
      modeling.setColor([forma], coresDoComando(forma, cor));
    }
  });

  // Tipo trocado: assume a cor padrão do novo tipo (ex.: atividade
  // que virou decisão passa de azul para amarelo).
  this.postExecuted('shape.replace', (evento: any) => {
    const forma = evento.context && evento.context.newShape;
    const cor = corPadraoDoElemento(forma);
    if (cor) {
      modeling.setColor([forma], coresDoComando(forma, cor));
    }
  });
}

CoresPadrao.prototype = Object.create((CommandInterceptor as any).prototype);
CoresPadrao.prototype.constructor = CoresPadrao;
(CoresPadrao as any).$inject = ['eventBus', 'modeling'];

// ------------------------------------------------------------
// Cor pela CHAVE DE BOCA
//
// A chave de boca do menu de contexto abre o menu "Trocar tipo ou
// cor". As cores entram nesse mesmo menu (no topo), para qualquer
// elemento: atividades, decisões, eventos, raias, piscinas, setas e
// anotações. Com vários elementos selecionados, a chave de boca
// aparece também e o menu mostra só as cores.
// ------------------------------------------------------------

const ICONE_COR = (
  preenchimento: string,
  borda: string
): string =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
    `<rect x="2" y="2" width="16" height="16" rx="3" fill="${preenchimento}" stroke="${borda}" stroke-width="2"/>` +
    '</svg>'
  );

const ICONE_PADRAO =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
    '<rect x="2" y="2" width="16" height="16" rx="3" fill="#FFFFFF" stroke="#202A44" stroke-width="2"/>' +
    '<path d="M4 16 L16 4" stroke="#B42318" stroke-width="2"/>' +
    '</svg>'
  );

const GRUPO_COR = { id: 'a-cor', name: 'Cor' };

const elementosDoAlvo = (
  alvo: any
): any[] =>
  (Array.isArray(alvo) ? alvo : [alvo]).filter(
    (item: any) =>
      item &&
      item.businessObject &&
      item.type !== 'label' &&
      item.type !== 'bpmn:Process' &&
      item.type !== 'bpmn:Collaboration'
  );

function MenuCores(this: any, popupMenu: any, modeling: any): void {

  this._modeling = modeling;

  // Prioridade alta: o grupo "Cor" aparece antes dos tipos.
  popupMenu.registerProvider('bpmn-replace', 2000, this);
}

(MenuCores as any).$inject = ['popupMenu', 'modeling'];

MenuCores.prototype.getPopupMenuEntries = function (alvo: any): Record<string, any> {

  const modeling = this._modeling;
  const elementos = elementosDoAlvo(alvo);

  if (!elementos.length) {
    return {};
  }

  const pintar = (cor: ICorDesenho | undefined, padrao: boolean): void => {
    const formas = elementos.filter((item: any) => !item.waypoints);
    const linhas = elementos.filter((item: any) => !!item.waypoints);

    if (padrao) {
      // Cada elemento volta à cor padrão do seu tipo (ou sem cor).
      elementos.forEach((item: any) => {
        modeling.setColor([item], coresDoComando(item, corPadraoDoElemento(item)));
      });
      return;
    }

    if (formas.length) {
      modeling.setColor(formas, cor ? { fill: cor.preenchimento, stroke: cor.borda } : undefined);
    }
    if (linhas.length) {
      modeling.setColor(linhas, cor ? { stroke: cor.borda } : undefined);
    }
  };

  const entradas: Record<string, any> = {};

  entradas['cor-padrao'] = {
    label: 'Cor padrão',
    description: 'Atividade azul, decisão amarela',
    imageUrl: ICONE_PADRAO,
    group: GRUPO_COR,
    action: () => pintar(undefined, true)
  };

  CORES_DESENHO.forEach(cor => {
    entradas[`cor-${cor.nome}`] = {
      label: cor.nome,
      imageUrl: ICONE_COR(cor.preenchimento, cor.borda),
      group: GRUPO_COR,
      action: () => pintar(cor, false)
    };
  });

  entradas['cor-nenhuma'] = {
    label: 'Sem cor',
    imageUrl: ICONE_COR('#FFFFFF', '#000000'),
    group: GRUPO_COR,
    action: () => pintar(undefined, false)
  };

  return entradas;
};

// Chave de boca também quando há VÁRIOS elementos selecionados
// (o bpmn-js só mostra "Excluir" nesse caso).
function ChaveDeBocaMultipla(this: any, contextPad: any, popupMenu: any, translate: any): void {
  this._contextPad = contextPad;
  this._popupMenu = popupMenu;
  this._translate = translate;
  contextPad.registerProvider(this);
}

(ChaveDeBocaMultipla as any).$inject = ['contextPad', 'popupMenu', 'translate'];

ChaveDeBocaMultipla.prototype.getContextPadEntries = function (): Record<string, any> {
  return {};
};

ChaveDeBocaMultipla.prototype.getMultiElementContextPadEntries = function (elementos: any[]): Record<string, any> {

  const contextPad = this._contextPad;
  const popupMenu = this._popupMenu;
  const translate = this._translate;

  if (!elementosDoAlvo(elementos).length) {
    return {};
  }

  return {
    'cor-multipla': {
      group: 'edit',
      className: 'bpmn-icon-screw-wrench',
      title: translate('Change element'),
      action: {
        click: (evento: any, alvo: any) => {
          const pad = contextPad.getPad(alvo).html;
          const retangulo = pad.getBoundingClientRect();
          popupMenu.open(alvo, 'bpmn-replace', {
            x: retangulo.left,
            y: retangulo.bottom + 5,
            cursor: { x: evento.x, y: evento.y }
          }, {
            title: 'Cor dos elementos selecionados',
            width: 260
          });
        }
      }
    }
  };
};

const moduloLeitura = {
  translate: ['value', traduzir]
};

const moduloEdicao = {
  __init__: ['coresPadrao', 'menuCores', 'chaveDeBocaMultipla'],
  coresPadrao: ['type', CoresPadrao],
  menuCores: ['type', MenuCores],
  chaveDeBocaMultipla: ['type', ChaveDeBocaMultipla],
  translate: ['value', traduzir]
};

// ------------------------------------------------------------
// Contrato usado pelas telas
// ------------------------------------------------------------

export interface IEditorDesenho {
  importar(xml: string): Promise<string[]>;
  exportarXml(): Promise<string>;
  exportarSvg(): Promise<string>;
  aoAlterar(callback: () => void): void;

  // Seleção (quantos elementos estão selecionados) e cores.
  aoSelecionar(callback: (quantidade: number) => void): void;

  // Sem cor = volta ao padrão (preto e branco). Devolve quantos
  // elementos receberam a cor (0 = nada selecionado).
  aplicarCor(cor?: ICorDesenho): number;
  ajustarNaTela(): void;
  aproximar(passo: number): void;
  desfazer(): void;
  refazer(): void;
  destruir(): void;
}

// somenteLeitura = true → visualizador (navegar e dar zoom, sem
// editar). Usado para versões publicadas/arquivadas e para quem
// não tem permissão de edição.
export const criarEditorDesenho = (
  container: HTMLElement,
  somenteLeitura: boolean
): IEditorDesenho => {

  injetarEstilos();

  const instancia: any =
    somenteLeitura
      ? new NavigatedViewer({ container, additionalModules: [moduloLeitura] })
      : new Modeler({ container, additionalModules: [moduloEdicao] });

  const servico = (nome: string): any => {
    try {
      return instancia.get(nome);
    } catch {
      return undefined;
    }
  };

  // "Ajustar na tela" só funciona com a área já visível e com
  // tamanho. Se o container ainda está com 0 px (tela montando,
  // aba oculta), o bpmn-js calcula uma escala infinita e lança
  // "Failed to execute 'scale' on 'SVGMatrix'". Por isso: espera o
  // próximo quadro, confere o tamanho e nunca deixa o erro subir.
  const ajustarSeguro = (tentativas: number = 10): void => {
    window.requestAnimationFrame(() => {
      const canvas = servico('canvas');
      if (!canvas) {
        return;
      }
      if (container.clientWidth < 10 || container.clientHeight < 10) {
        if (tentativas > 0) {
          window.setTimeout(() => ajustarSeguro(tentativas - 1), 100);
        }
        return;
      }
      try {
        canvas.zoom('fit-viewport', 'auto');
      } catch (erro) {
        // Desenho vazio ou sem tamanho: mantém o zoom atual.
        console.warn('[Desenho] não foi possível ajustar na tela', erro);
      }
    });
  };

  // Elementos selecionados que aceitam cor. Rótulos viram o
  // elemento a que pertencem; a raiz (processo/colaboração) é ignorada.
  const selecionados = (): any[] => {
    const selecao = servico('selection');
    if (!selecao) {
      return [];
    }
    const lista: any[] = [];
    (selecao.get() as any[]).forEach(item => {
      const elemento = item && item.labelTarget ? item.labelTarget : item;
      if (
        elemento &&
        elemento.businessObject &&
        elemento.type !== 'bpmn:Process' &&
        elemento.type !== 'bpmn:Collaboration' &&
        lista.indexOf(elemento) < 0
      ) {
        lista.push(elemento);
      }
    });
    return lista;
  };

  return {

    aoSelecionar(callback: (quantidade: number) => void): void {
      const eventBus = servico('eventBus');
      if (eventBus) {
        eventBus.on('selection.changed', () => callback(selecionados().length));
      }
    },

    aplicarCor(cor?: ICorDesenho): number {
      const modeling = servico('modeling');
      const elementos = selecionados();
      if (!modeling || !elementos.length) {
        return 0;
      }
      // Linhas (setas e associações) só têm traço.
      const formas = elementos.filter(item => !item.waypoints);
      const linhas = elementos.filter(item => !!item.waypoints);
      if (formas.length) {
        modeling.setColor(formas, cor ? { fill: cor.preenchimento, stroke: cor.borda } : undefined);
      }
      if (linhas.length) {
        modeling.setColor(linhas, cor ? { stroke: cor.borda } : undefined);
      }
      return elementos.length;
    },

    async importar(xml: string): Promise<string[]> {
      const resultado = await instancia.importXML(xml);

      // Desenhos antigos: aplica a cor padrão onde ainda não há cor.
      // Não entra no "desfazer" nem conta como alteração, mas fica
      // gravado no próximo "Salvar rascunho".
      if (!somenteLeitura) {
        const registro = servico('elementRegistry');
        const modeling = servico('modeling');
        const pilha = servico('commandStack');
        if (registro && modeling && pilha) {
          let aplicou = false;
          (registro.getAll() as any[]).forEach(elemento => {
            const cor = corPadraoDoElemento(elemento);
            if (cor && !temCor(elemento)) {
              modeling.setColor([elemento], coresDoComando(elemento, cor));
              aplicou = true;
            }
          });
          if (aplicou) {
            pilha.clear();
          }
        }
      }

      ajustarSeguro();
      return ((resultado && resultado.warnings) || []).map(
        (aviso: any) => String((aviso && aviso.message) || aviso)
      );
    },

    async exportarXml(): Promise<string> {
      const resultado = await instancia.saveXML({ format: true });
      return resultado.xml || '';
    },

    async exportarSvg(): Promise<string> {
      const resultado = await instancia.saveSVG();
      return resultado.svg || '';
    },

    aoAlterar(callback: () => void): void {
      const eventBus = servico('eventBus');
      if (eventBus) {
        eventBus.on('commandStack.changed', () => callback());
      }
    },

    ajustarNaTela(): void {
      ajustarSeguro(0);
    },

    aproximar(passo: number): void {
      const zoomScroll = servico('zoomScroll');
      if (zoomScroll) {
        try {
          zoomScroll.stepZoom(passo);
        } catch (erro) {
          console.warn('[Desenho] zoom', erro);
        }
      }
    },

    desfazer(): void {
      const pilha = servico('commandStack');
      if (pilha) {
        pilha.undo();
      }
    },

    refazer(): void {
      const pilha = servico('commandStack');
      if (pilha) {
        pilha.redo();
      }
    },

    destruir(): void {
      instancia.destroy();
    }
  };
};