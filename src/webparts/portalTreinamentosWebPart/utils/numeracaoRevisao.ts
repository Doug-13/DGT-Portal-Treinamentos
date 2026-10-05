// ============================================================
// NUMERAÇÃO DE REVISÕES: REVISÃO E SUB-REVISÃO
//
//   Revisão      → número inteiro com 2 dígitos:  00, 01, 02, 03...
//   Sub-revisão  → letra(s) após o número:        00A, 00B, 00C...
//
// Rótulo gravado em dgt_documentorevisao.dgt_revisao: "Rev.00",
// "Rev.00A", "Rev.01"... (texto; não exige coluna nova).
//
// Ordem: 00 < 00A < 00B < ... < 00Z < 00AA < 01 < 01A ...
//
// REGRA GERAL
//   • Revisão EM TRABALHO sempre tem letra: o documento nasce Rev.00A
//     e cada nova revisão nasce com a próxima numeração + A (Rev.01A).
//   • Revisão APROVADA/PUBLICADA nunca tem letra: Rev.00, Rev.01...
//     (a publicação tira a letra que tiver sobrado).
//
// EVENTO DE REVISÃO do fluxo do processo (muda o rótulo da própria
// revisão quando é percorrido):
//
//   Sub-revisão    → próxima letra:   00A → 00B · 00 → 00A
//   Revisão        → com letra:       tira a letra      (00B → 00)
//                    sem letra:       próxima revisão   (00 → 01A)
//                    (só avança se a revisão já foi fechada antes
//                    neste fluxo; revisões antigas criadas sem letra
//                    continuam com o mesmo número)
//   Nova revisão   → sempre a próxima revisão: 00B → 01A · 00 → 01A
//   Fechar revisão → só tira a letra:          00B → 00 · 00 continua 00
//
// Assim uma aprovação nunca "pula" número: 00A → 00 (aprovou),
// 00 → 01A (revisar), 01A → 01 (aprovou de novo).
// ============================================================

export type TipoEventoRevisao =
  | 'subrevisao'
  | 'revisao'
  | 'novaRevisao'
  | 'fechar';

export interface IRevisaoInterpretada {
  prefixo: string;
  numero: number;
  digitos: number;
  sub: string;
}

export const PREFIXO_PADRAO = 'Rev.';
const DIGITOS_PADRAO = 2;

// "Rev.00A" → { prefixo: 'Rev.', numero: 0, digitos: 2, sub: 'A' }
export const interpretarRevisao = (
  rotulo?: string
): IRevisaoInterpretada | undefined => {

  const texto =
    (rotulo || '').trim();

  const encontrado =
    texto.match(/^(.*?)(\d+)([A-Za-z]*)$/);

  if (!encontrado) {
    return undefined;
  }

  return {
    prefixo: encontrado[1],
    numero: Number(encontrado[2]),
    digitos: Math.max(DIGITOS_PADRAO, encontrado[2].length),
    sub: encontrado[3].toUpperCase()
  };
};

export const formatarRevisao = (
  revisao: IRevisaoInterpretada
): string => {

  let numero =
    String(revisao.numero);

  while (numero.length < revisao.digitos) {
    numero = `0${numero}`;
  }

  return `${revisao.prefixo}${numero}${revisao.sub}`;
};

// '' → 'A' · 'A' → 'B' · 'Z' → 'AA' · 'AZ' → 'BA'
export const proximaLetra = (
  sub: string
): string => {

  const letras =
    (sub || '').toUpperCase().split('');

  let i =
    letras.length - 1;

  while (i >= 0) {

    if (letras[i] !== 'Z') {
      letras[i] = String.fromCharCode(letras[i].charCodeAt(0) + 1);
      return letras.join('');
    }

    letras[i] = 'A';
    i--;
  }

  return `A${letras.join('')}`;
};

const compararSub = (
  a: string,
  b: string
): number =>
  a.length !== b.length
    ? a.length - b.length
    : a < b ? -1 : a > b ? 1 : 0;

// Negativo: a vem antes de b. Rótulos sem número vão para o início.
export const compararRevisoes = (
  a?: string,
  b?: string
): number => {

  const ra = interpretarRevisao(a);
  const rb = interpretarRevisao(b);

  if (!ra || !rb) {
    return (ra ? 1 : 0) - (rb ? 1 : 0);
  }

  return ra.numero !== rb.numero
    ? ra.numero - rb.numero
    : compararSub(ra.sub, rb.sub);
};

export const maiorRevisao = (
  rotulos: string[]
): string | undefined =>
  rotulos
    .filter(rotulo => !!interpretarRevisao(rotulo))
    .sort(compararRevisoes)
    .pop();

// Próxima revisão INTEIRA a partir de um rótulo (sem sub-revisão).
export const proximaRevisaoInteira = (
  base?: string
): string => {

  const atual =
    interpretarRevisao(base);

  if (!atual) {
    return `${PREFIXO_PADRAO}00`;
  }

  return formatarRevisao({
    ...atual,
    numero: atual.numero + 1,
    sub: ''
  });
};

// Próxima SUB-REVISÃO a partir de um rótulo.
export const proximaSubRevisao = (
  base?: string
): string => {

  const atual =
    interpretarRevisao(base);

  if (!atual) {
    return `${PREFIXO_PADRAO}00`;
  }

  return formatarRevisao({
    ...atual,
    sub: proximaLetra(atual.sub)
  });
};

// Revisão inteira, sem a sub-revisão: "Rev.00B" → "Rev.00".
export const revisaoInteira = (
  rotulo?: string
): string => {

  const atual =
    interpretarRevisao(rotulo);

  return atual
    ? formatarRevisao({ ...atual, sub: '' })
    : `${PREFIXO_PADRAO}00`;
};

// Rótulo de uma revisão em trabalho a partir de outra: próxima
// numeração com a letra A ("Rev.00" → "Rev.01A"; nada → "Rev.00A").
export const proximaRevisaoEmTrabalho = (
  base?: string
): string =>
  base
    ? `${proximaRevisaoInteira(base)}A`
    : `${PREFIXO_PADRAO}00A`;

// Rótulo que a revisão recebe ao passar pelo evento de revisão.
// jaFechada: a revisão já passou por um fechamento neste fluxo (ou
// seja, "00" é um número aprovado, não um rascunho antigo sem letra).
export const rotuloPeloEvento = (
  tipo: TipoEventoRevisao,
  rotuloAtual: string,
  jaFechada: boolean = true
): string => {

  const atual =
    interpretarRevisao(rotuloAtual);

  if (tipo === 'subrevisao') {
    return proximaSubRevisao(rotuloAtual);
  }

  if (tipo === 'fechar') {
    return revisaoInteira(rotuloAtual);
  }

  if (tipo === 'novaRevisao') {
    return proximaRevisaoEmTrabalho(revisaoInteira(rotuloAtual));
  }

  // 'revisao'
  if (atual && atual.sub) {
    return revisaoInteira(rotuloAtual);
  }

  return jaFechada
    ? proximaRevisaoEmTrabalho(rotuloAtual)
    : rotuloAtual;
};

export const DESCRICAO_TIPO_EVENTO_REVISAO: Record<TipoEventoRevisao, string> = {
  subrevisao: 'Sub-revisão: próxima letra (00 → 00A → 00B)',
  revisao: 'Revisão: tira a letra ou abre a próxima revisão (00A → 00 · 00 → 01A)',
  novaRevisao: 'Nova revisão: sempre abre a próxima revisão (00B → 01A · 00 → 01A)',
  fechar: 'Fechar revisão: só tira a letra (00B → 00 · 00 continua 00)'
};

export const NOME_PADRAO_EVENTO_REVISAO: Record<TipoEventoRevisao, string> = {
  subrevisao: 'Sub-revisão',
  revisao: 'Revisão',
  novaRevisao: 'Nova revisão',
  fechar: 'Fechar revisão'
};

// Texto do passo no histórico.
export const ROTULO_HISTORICO_EVENTO_REVISAO: Record<TipoEventoRevisao, string> = {
  subrevisao: 'Nova sub-revisão',
  revisao: 'Revisão',
  novaRevisao: 'Nova revisão',
  fechar: 'Revisão fechada'
};
