// ============================================================
// IMPLANTAÇÕES — ambiente do painel dentro da página do portal
//
// O painel foi escrito como uma página inteira: usa document.body,
// document.querySelector, window.scrollY, location.hash... Em vez de
// um quadro (iframe) com rolagem própria, ele agora é desenhado no
// fluxo normal da página, dentro de uma SHADOW ROOT:
//
//   - os estilos do painel ficam isolados do portal (e vice-versa);
//   - o painel recebe um "document" e um "window" de fachada que
//     apontam para a shadow root (body, head, querySelector, eventos)
//     e para a janela real (rolagem, tamanhos, location, bibliotecas);
//   - tudo o que o painel registra (eventos na janela, temporizadores,
//     animações) é anotado e desfeito ao sair da página.
//
// O endereço (#painel, #pmo, #g3…) passa a ser o da página do portal:
// links diretos para uma tela do painel funcionam. Ao sair, o #… é
// retirado do endereço.
// ============================================================

type Funcao = (...args: unknown[]) => unknown;

interface IRegistroEvento {
  alvo: EventTarget;
  tipo: string;
  funcao: EventListenerOrEventListenerObject;
  opcoes?: boolean | AddEventListenerOptions;
}

export interface IAmbientePainel {
  documento: Document;
  janela: Window;
  corpo: HTMLElement;
  cabeca: HTMLElement;
  desmontar: () => void;
}

// Eventos que também precisam ser ouvidos FORA da shadow root
// (atalhos de teclado sem foco no painel; arrastar e soltar que termina
// fora dele). Os que nascem dentro do painel não são repetidos.
const TAMBEM_NO_DOCUMENTO = [
  'keydown',
  'keyup',
  'pointermove',
  'pointerup',
  'pointercancel',
  'mousedown'
];

// Ancestral que rola a página (no SharePoint costuma ser uma div, não a janela).
// Em tela cheia, quem rola é o próprio painel.
const areaDeRolagem = (elemento: HTMLElement): HTMLElement | undefined => {

  if (document.fullscreenElement === elemento) {
    return elemento;
  }

  let atual = elemento.parentElement;

  while (atual && atual !== document.body && atual !== document.documentElement) {
    const estilo = window.getComputedStyle(atual);
    if (/(auto|scroll|overlay)/.test(estilo.overflowY) && atual.scrollHeight > atual.clientHeight) {
      return atual;
    }
    atual = atual.parentElement;
  }

  return undefined;
};

export const montarAmbientePainel = (
  hospedeiro: HTMLElement,
  css: string,
  html: string
): IAmbientePainel => {

  const sombra = hospedeiro.shadowRoot || hospedeiro.attachShadow({ mode: 'open' });

  sombra.innerHTML =
    `<style>${css}</style>` +
    '<div data-implhead hidden></div>' +
    `<div data-implbody class="carregando">${html}</div>`;

  const cabeca = sombra.querySelector('[data-implhead]') as HTMLElement;
  const corpo = sombra.querySelector('[data-implbody]') as HTMLElement;

  const eventos: IRegistroEvento[] = [];
  const repetidos = new Map<EventListenerOrEventListenerObject, EventListener>();
  const temporizadores = new Set<number>();
  const intervalos = new Set<number>();
  const quadros = new Set<number>();

  const anotar = (
    alvo: EventTarget,
    tipo: string,
    funcao: EventListenerOrEventListenerObject,
    opcoes?: boolean | AddEventListenerOptions
  ): void => {
    alvo.addEventListener(tipo, funcao, opcoes);
    eventos.push({ alvo, tipo, funcao, opcoes });
  };

  const desanotar = (
    alvo: EventTarget,
    tipo: string,
    funcao: EventListenerOrEventListenerObject,
    opcoes?: boolean | EventListenerOptions
  ): void => {
    alvo.removeEventListener(tipo, funcao, opcoes);
    for (let i = eventos.length - 1; i >= 0; i--) {
      if (eventos[i].alvo === alvo && eventos[i].tipo === tipo && eventos[i].funcao === funcao) {
        eventos.splice(i, 1);
        break;
      }
    }
  };

  // ----------------------------------------------------------
  // document de fachada
  // ----------------------------------------------------------

  // Preenchido logo abaixo (os ouvintes repetidos chamam com this = document de fachada).
  const fachada: { documento?: Document } = {};

  const proprioDocumento: Record<string, unknown> = {
    body: corpo,
    head: cabeca,
    documentElement: corpo,
    querySelector: (seletor: string) => sombra.querySelector(seletor),
    querySelectorAll: (seletor: string) => sombra.querySelectorAll(seletor),
    getElementById: (id: string) => sombra.getElementById(id),
    elementFromPoint: (x: number, y: number) => sombra.elementFromPoint(x, y),
    addEventListener: (
      tipo: string,
      funcao: EventListenerOrEventListenerObject,
      opcoes?: boolean | AddEventListenerOptions
    ) => {

      anotar(sombra, tipo, funcao, opcoes);

      if (TAMBEM_NO_DOCUMENTO.indexOf(tipo) >= 0 && funcao) {

        const repetido: EventListener = evento => {
          if (evento.composedPath().indexOf(hospedeiro) >= 0) {
            return;
          }
          if (typeof funcao === 'function') {
            funcao.call(fachada.documento, evento);
          } else {
            funcao.handleEvent(evento);
          }
        };

        repetidos.set(funcao, repetido);
        anotar(document, tipo, repetido, opcoes);
      }
    },
    removeEventListener: (
      tipo: string,
      funcao: EventListenerOrEventListenerObject,
      opcoes?: boolean | EventListenerOptions
    ) => {

      desanotar(sombra, tipo, funcao, opcoes);

      const repetido = repetidos.get(funcao);

      if (repetido) {
        desanotar(document, tipo, repetido, opcoes);
        repetidos.delete(funcao);
      }
    }
  };

  const documento: Document = fachada.documento = new Proxy(document, {
    get: (alvo, propriedade) => {

      if (propriedade === 'activeElement') {
        return sombra.activeElement || corpo;
      }

      if (typeof propriedade === 'string' && Object.prototype.hasOwnProperty.call(proprioDocumento, propriedade)) {
        return proprioDocumento[propriedade];
      }

      const valor = (alvo as unknown as Record<string | symbol, unknown>)[propriedade];

      return typeof valor === 'function' ? (valor as Funcao).bind(alvo) : valor;
    }
  });

  // ----------------------------------------------------------
  // window de fachada
  // ----------------------------------------------------------

  // O que o painel grava em window (SESSAO, PODE, __sync…) fica aqui,
  // sem sujar a janela do portal. Bibliotecas carregadas por <script>
  // (Leaflet, SheetJS, ExcelJS, jsPDF) continuam na janela real.
  const proprias: Record<string, unknown> = {};

  // Menus do painel são posicionados com "b.bottom + window.scrollY",
  // relativos ao body da página original. Aqui o "body" é o contêiner
  // (position: relative): a "rolagem" é a distância até o topo dele.
  const deslocamento = (): DOMRect => corpo.getBoundingClientRect();

  const rolar = (x: number, y: number): void => {
    const area = areaDeRolagem(hospedeiro);
    if (area) {
      area.scrollBy(x, y);
    } else {
      window.scrollBy(x, y);
    }
  };

  const proprioJanela: Record<string, unknown> = {
    addEventListener: (tipo: string, funcao: EventListenerOrEventListenerObject, opcoes?: boolean | AddEventListenerOptions) =>
      anotar(window, tipo, funcao, opcoes),
    removeEventListener: (tipo: string, funcao: EventListenerOrEventListenerObject, opcoes?: boolean | EventListenerOptions) =>
      desanotar(window, tipo, funcao, opcoes),
    setTimeout: (funcao: TimerHandler, ms?: number, ...args: unknown[]) => {
      const id = window.setTimeout(
        (...valores: unknown[]) => {
          temporizadores.delete(id);
          if (typeof funcao === 'function') {
            (funcao as Funcao)(...valores);
          }
        },
        ms,
        ...args
      );
      temporizadores.add(id);
      return id;
    },
    clearTimeout: (id: number) => {
      temporizadores.delete(id);
      window.clearTimeout(id);
    },
    setInterval: (funcao: TimerHandler, ms?: number, ...args: unknown[]) => {
      const id = window.setInterval(funcao, ms, ...args);
      intervalos.add(id);
      return id;
    },
    clearInterval: (id: number) => {
      intervalos.delete(id);
      window.clearInterval(id);
    },
    requestAnimationFrame: (funcao: FrameRequestCallback) => {
      const id = window.requestAnimationFrame(tempo => {
        quadros.delete(id);
        funcao(tempo);
      });
      quadros.add(id);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      quadros.delete(id);
      window.cancelAnimationFrame(id);
    },
    scrollBy: (x: number, y: number) => rolar(Number(x) || 0, Number(y) || 0),
    // O painel só usa scrollTo(0, 0) ao trocar de tela: leva o topo do
    // painel para a vista, se ele tiver ficado para cima.
    scrollTo: () => {
      if (document.fullscreenElement === hospedeiro) {
        hospedeiro.scrollTop = 0;
      } else if (hospedeiro.getBoundingClientRect().top < 0) {
        hospedeiro.scrollIntoView({ block: 'start' });
      }
    }
  };

  const janela = new Proxy(window, {
    get: (alvo, propriedade) => {

      if (propriedade === 'scrollY' || propriedade === 'pageYOffset') {
        return -(deslocamento().top + corpo.clientTop);
      }

      if (propriedade === 'scrollX' || propriedade === 'pageXOffset') {
        return -(deslocamento().left + corpo.clientLeft);
      }

      if (propriedade === 'document') {
        return documento;
      }

      if (typeof propriedade === 'string') {

        if (Object.prototype.hasOwnProperty.call(proprias, propriedade)) {
          return proprias[propriedade];
        }

        if (Object.prototype.hasOwnProperty.call(proprioJanela, propriedade)) {
          return proprioJanela[propriedade];
        }
      }

      const valor = (alvo as unknown as Record<string | symbol, unknown>)[propriedade];

      // Funções da janela (fetch, getComputedStyle, matchMedia…) presas à
      // janela real. Construtores (URL, Blob, FormData…) vão como estão,
      // para manter os métodos estáticos (URL.createObjectURL).
      if (typeof valor === 'function' && typeof propriedade === 'string' && /^[a-z]/.test(propriedade)) {
        return (valor as Funcao).bind(alvo);
      }

      return valor;
    },
    set: (_alvo, propriedade, valor) => {
      if (typeof propriedade === 'string') {
        proprias[propriedade] = valor;
      }
      return true;
    },
    has: (alvo, propriedade) =>
      (typeof propriedade === 'string' && Object.prototype.hasOwnProperty.call(proprias, propriedade)) ||
      propriedade in alvo
  });

  // ----------------------------------------------------------
  // Posição do painel na janela (CSS --impl-left / --impl-top):
  // a lista de projetos aberta fica sobre o painel, abaixo do topo dele.
  // ----------------------------------------------------------

  let posicaoPendente = 0;

  // --impl-top: onde o painel começa a aparecer na tela (o topo dele ou,
  // depois de rolar, o topo da área que rola — abaixo do cabeçalho do portal).
  const atualizarPosicao = (): void => {
    posicaoPendente = 0;
    const caixa = hospedeiro.getBoundingClientRect();
    const area = areaDeRolagem(hospedeiro);
    const topoArea = area ? Math.max(0, area.getBoundingClientRect().top) : 0;
    hospedeiro.style.setProperty('--impl-left', `${Math.max(0, Math.round(caixa.left))}px`);
    hospedeiro.style.setProperty('--impl-right', `${Math.max(0, Math.round(document.documentElement.clientWidth - caixa.right))}px`);
    hospedeiro.style.setProperty('--impl-top', `${Math.round(Math.max(topoArea, caixa.top))}px`);
  };

  const agendarPosicao = (): void => {
    if (!posicaoPendente) {
      posicaoPendente = window.requestAnimationFrame(atualizarPosicao);
    }
  };

  atualizarPosicao();
  // captura: pega também a rolagem de divs do SharePoint, não só a da janela
  anotar(window, 'scroll', agendarPosicao, { capture: true, passive: true });
  anotar(window, 'resize', agendarPosicao);
  anotar(document, 'fullscreenchange', agendarPosicao);

  // ----------------------------------------------------------
  // Saída da página
  // ----------------------------------------------------------

  const desmontar = (): void => {

    eventos.splice(0).forEach(registro =>
      registro.alvo.removeEventListener(registro.tipo, registro.funcao, registro.opcoes)
    );

    repetidos.clear();

    temporizadores.forEach(id => window.clearTimeout(id));
    intervalos.forEach(id => window.clearInterval(id));
    quadros.forEach(id => window.cancelAnimationFrame(id));
    if (posicaoPendente) {
      window.cancelAnimationFrame(posicaoPendente);
    }
    temporizadores.clear();
    intervalos.clear();
    quadros.clear();

    // Fecha diálogos abertos (ficam na camada superior do navegador).
    const dialogos = sombra.querySelectorAll('dialog[open]');
    for (let i = 0; i < dialogos.length; i++) {
      try {
        (dialogos[i] as HTMLDialogElement).close();
      } catch {
        // já fechado
      }
    }

    if (document.fullscreenElement === hospedeiro) {
      document.exitFullscreen().catch(() => undefined);
    }

    sombra.innerHTML = '';

    // Tira o #tela do painel do endereço do portal.
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  };

  return {
    documento,
    janela: janela as Window,
    corpo,
    cabeca,
    desmontar
  };
};
