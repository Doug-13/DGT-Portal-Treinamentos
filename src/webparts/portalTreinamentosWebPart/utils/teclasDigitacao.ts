// ============================================================
// Digitação protegida dos atalhos da página do SharePoint.
//
// O SharePoint escuta o teclado no documento inteiro: "?" abre o
// diálogo "Atalhos de teclado". No teclado ABNT2, a tecla ";" / ":"
// tem o mesmo código da tecla "/" / "?" do teclado americano — então
// digitar ":" (Shift + ;) num campo do portal abria o diálogo.
//
// Correção: quando a tecla é um caractere comum (sem Ctrl/Alt/Cmd)
// digitado num campo editável, o evento não sobe além do <body>.
// O próprio campo e os handlers do portal (React, Esc, Enter, Ctrl+…)
// continuam funcionando: só listeners do documento/janela deixam de
// ver letras e símbolos digitados em campos.
// ============================================================

const EVENTOS: Array<'keydown' | 'keypress' | 'keyup'> = ['keydown', 'keypress', 'keyup'];

export function ehCampoEditavel(alvo: EventTarget | undefined | null): boolean { // eslint-disable-line @rushstack/no-new-null
  const el = alvo as HTMLElement | undefined;
  if (!el || typeof el.tagName !== 'string') {
    return false;
  }
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag === 'INPUT') {
    const tipo = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return ['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color'].indexOf(tipo) < 0;
  }
  return !!el.isContentEditable;
}

// Tecla que produz um caractere (letra, número, símbolo, espaço),
// sem modificador de atalho. Shift é permitido (":", "?", maiúsculas).
export function ehTeclaDeDigitacao(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return typeof e.key === 'string' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

// Alvo real do evento. Dentro de uma shadow root (painel de
// Implantações), e.target no <body> é o elemento hospedeiro, não o
// campo: o primeiro item do composedPath() é o campo digitado.
function alvoReal(e: Event): EventTarget | undefined {
  const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
  return caminho.length > 0 ? caminho[0] : (e.target || undefined);
}

// Tecla física do "/" americano (keyCode 191 / code "Slash") que NÃO
// produziu "/" nem "?": é o ";" / ":" do ABNT2. O SharePoint confunde
// com "?" mesmo fora de campo. O "?" de verdade (outra tecla no ABNT2)
// continua abrindo os atalhos.
export function ehDoisPontosAbnt(e: Pick<KeyboardEvent, 'key' | 'keyCode' | 'code'>): boolean {
  const teclaBarra = e.keyCode === 191 || e.code === 'Slash';
  return teclaBarra && e.key !== '/' && e.key !== '?';
}

function aoTeclar(e: KeyboardEvent): void {
  if (ehDoisPontosAbnt(e) || (ehTeclaDeDigitacao(e) && ehCampoEditavel(alvoReal(e)))) {
    e.stopPropagation();
  }
}

// Registra no <body> (fase de bolha): cobre o web part e os modais
// renderizados direto no <body> (createPortal). Devolve a remoção.
export function protegerDigitacaoDosAtalhosDaPagina(doc: Document = document): () => void {
  const corpo = doc.body;
  if (!corpo) {
    return () => undefined;
  }
  EVENTOS.forEach(tipo => corpo.addEventListener(tipo, aoTeclar));
  return () => EVENTOS.forEach(tipo => corpo.removeEventListener(tipo, aoTeclar));
}
