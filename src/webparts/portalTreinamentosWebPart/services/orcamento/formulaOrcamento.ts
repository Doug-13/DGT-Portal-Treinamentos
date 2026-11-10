// ============================================================
// FÓRMULAS DAS REGRAS DE CÁLCULO
//
// Expressões com + − * / e parênteses, números (1,65 ou 1.65), % (9%
// = 0,09) e referências entre colchetes:
//   [grupo:RECEITA BRUTA]          total do grupo
//   [linha:LAIR]                   seção/resultado da DRE
//   [conta:3.1.1.02.01.005]        conta (todas as linhas do código)
//   [conta:4.2.1.01.08.001@Despesas financeiras]  conta de um grupo
//
// Os valores das referências vêm COM SINAL (receitas +, custos e
// despesas −), como na planilha. Exemplos:
//   -[conta:3.1.1.02.01.005] * 17%
//   -([grupo:RECEITA BRUTA] + [conta:4.3.1.01.01.001]) * 7,6%
//   -[linha:LAIR] * 9%
// Divisão por zero dá 0.
// ============================================================

type No =
  | { tipo: 'numero'; valor: number }
  | { tipo: 'ref'; ref: string }
  | { tipo: 'negativo'; no: No }
  | { tipo: 'binario'; operador: '+' | '-' | '*' | '/'; esquerda: No; direita: No };

interface IToken {
  tipo: 'numero' | 'ref' | 'operador' | 'abre' | 'fecha' | 'porcento';
  texto: string;
  posicao: number;
}

const PREFIXOS_VALIDOS = ['grupo:', 'linha:', 'conta:'];

const tokenizar = (expressao: string): IToken[] => {
  const tokens: IToken[] = [];
  let i = 0;
  while (i < expressao.length) {
    const c = expressao[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '[') {
      const fim = expressao.indexOf(']', i);
      if (fim < 0) {
        throw new Error(`Colchete aberto sem fechar na posição ${i + 1}.`);
      }
      const ref = expressao.substring(i + 1, fim).trim();
      if (!PREFIXOS_VALIDOS.some(prefixo => ref.indexOf(prefixo) === 0) || ref.length <= 6) {
        throw new Error(`Referência inválida "[${ref}]". Use [grupo:…], [linha:…] ou [conta:…].`);
      }
      tokens.push({ tipo: 'ref', texto: ref, posicao: i });
      i = fim + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let fim = i;
      while (fim < expressao.length && /[0-9.,]/.test(expressao[fim])) {
        fim++;
      }
      tokens.push({ tipo: 'numero', texto: expressao.substring(i, fim), posicao: i });
      i = fim;
      continue;
    }
    if ('+-*/'.indexOf(c) >= 0) {
      tokens.push({ tipo: 'operador', texto: c, posicao: i });
    } else if (c === '(') {
      tokens.push({ tipo: 'abre', texto: c, posicao: i });
    } else if (c === ')') {
      tokens.push({ tipo: 'fecha', texto: c, posicao: i });
    } else if (c === '%') {
      tokens.push({ tipo: 'porcento', texto: c, posicao: i });
    } else {
      throw new Error(`Caractere não permitido "${c}" na posição ${i + 1}.`);
    }
    i++;
  }
  return tokens;
};

// "1.234,56" / "1,65" / "1.65" → número.
const lerNumero = (texto: string): number => {
  let limpo = texto;
  if (limpo.indexOf(',') >= 0) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  }
  const valor = Number(limpo);
  if (!isFinite(valor)) {
    throw new Error(`Número inválido "${texto}".`);
  }
  return valor;
};

// Gramática: expressão = termo (('+'|'-') termo)* ;
//            termo = fator (('*'|'/') fator)* ;
//            fator = '-' fator | '+' fator | primário '%'? ;
//            primário = número | referência | '(' expressão ')'.
class Analisador {

  private readonly tokens: IToken[];
  private pos = 0;

  public constructor(tokens: IToken[]) {
    this.tokens = tokens;
  }

  public analisar(): No {
    if (this.tokens.length === 0) {
      throw new Error('Escreva a fórmula.');
    }
    const raiz = this.expressao();
    if (this.pos < this.tokens.length) {
      const sobra = this.tokens[this.pos];
      throw new Error(`"${sobra.texto}" inesperado na posição ${sobra.posicao + 1}.`);
    }
    return raiz;
  }

  private atual(): IToken | undefined {
    return this.tokens[this.pos];
  }

  private ehOperador(...operadores: string[]): boolean {
    const token = this.atual();
    return !!token && token.tipo === 'operador' && operadores.indexOf(token.texto) >= 0;
  }

  private expressao(): No {
    let no = this.termo();
    while (this.ehOperador('+', '-')) {
      const operador = (this.atual() as IToken).texto as '+' | '-';
      this.pos++;
      no = { tipo: 'binario', operador, esquerda: no, direita: this.termo() };
    }
    return no;
  }

  private termo(): No {
    let no = this.fator();
    while (this.ehOperador('*', '/')) {
      const operador = (this.atual() as IToken).texto as '*' | '/';
      this.pos++;
      no = { tipo: 'binario', operador, esquerda: no, direita: this.fator() };
    }
    return no;
  }

  private fator(): No {
    if (this.ehOperador('-', '+')) {
      const negativo = (this.atual() as IToken).texto === '-';
      this.pos++;
      const interno = this.fator();
      return negativo ? { tipo: 'negativo', no: interno } : interno;
    }
    let no = this.primario();
    const token = this.atual();
    if (token && token.tipo === 'porcento') {
      this.pos++;
      no = { tipo: 'binario', operador: '/', esquerda: no, direita: { tipo: 'numero', valor: 100 } };
    }
    return no;
  }

  private primario(): No {
    const token = this.atual();
    if (!token) {
      throw new Error('Fórmula incompleta.');
    }
    if (token.tipo === 'numero') {
      this.pos++;
      return { tipo: 'numero', valor: lerNumero(token.texto) };
    }
    if (token.tipo === 'ref') {
      this.pos++;
      return { tipo: 'ref', ref: token.texto };
    }
    if (token.tipo === 'abre') {
      this.pos++;
      const no = this.expressao();
      const fecha = this.atual();
      if (!fecha || fecha.tipo !== 'fecha') {
        throw new Error('Parêntese aberto sem fechar.');
      }
      this.pos++;
      return no;
    }
    throw new Error(`"${token.texto}" inesperado na posição ${token.posicao + 1}.`);
  }
}

export const compilarFormula = (expressao: string): No =>
  new Analisador(tokenizar(expressao || '')).analisar();

// Referências usadas na fórmula (sem repetir).
export const referenciasDaFormula = (expressao: string): string[] => {
  const lista: string[] = [];
  const coletar = (no: No): void => {
    if (no.tipo === 'ref' && lista.indexOf(no.ref) < 0) {
      lista.push(no.ref);
    } else if (no.tipo === 'negativo') {
      coletar(no.no);
    } else if (no.tipo === 'binario') {
      coletar(no.esquerda);
      coletar(no.direita);
    }
  };
  try {
    coletar(compilarFormula(expressao));
  } catch {
    // Fórmula inválida: sem referências.
  }
  return lista;
};

// undefined = fórmula válida; senão, a mensagem do problema.
export const validarFormula = (expressao: string): string | undefined => {
  try {
    compilarFormula(expressao);
    return undefined;
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
};

// Calcula a fórmula mês a mês. valorDe devolve os 12 meses (com sinal)
// de uma referência.
export const avaliarFormula = (
  expressao: string,
  valorDe: (ref: string) => number[]
): number[] => {
  const raiz = compilarFormula(expressao);
  const cache: { [ref: string]: number[] } = {};
  const valores = (ref: string): number[] => {
    if (!cache[ref]) {
      cache[ref] = valorDe(ref);
    }
    return cache[ref];
  };
  const avaliar = (no: No, mes: number): number => {
    switch (no.tipo) {
      case 'numero':
        return no.valor;
      case 'ref':
        return valores(no.ref)[mes] || 0;
      case 'negativo':
        return -avaliar(no.no, mes);
      default: {
        const a = avaliar(no.esquerda, mes);
        const b = avaliar(no.direita, mes);
        if (no.operador === '+') {
          return a + b;
        }
        if (no.operador === '-') {
          return a - b;
        }
        if (no.operador === '*') {
          return a * b;
        }
        return b === 0 ? 0 : a / b;
      }
    }
  };
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(mes => avaliar(raiz, mes));
};
