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
// Quem define o rótulo final é o EVENTO DE REVISÃO do fluxo do
// processo, ao ser percorrido:
//
//   Nova revisão     → próximo inteiro da última revisão publicada
//                      (00 → 01 · 00B → 01)
//   Nova sub-revisão → próxima letra da última revisão publicada
//                      (00 → 00A · 00A → 00B · 01 → 01A)
//
//   Sem nenhuma revisão publicada, as duas regras dão "Rev.00"
//   (a primeira emissão é sempre a revisão inteira).
// ============================================================

export type TipoEventoRevisao =
  | 'revisao'
  | 'subrevisao';

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

// Rótulo que a revisão recebe ao passar pelo evento de revisão.
// publicadas: rótulos das revisões já publicadas (vigente e
// obsoletas), SEM a revisão que está passando pelo evento.
export const rotuloPeloEvento = (
  tipo: TipoEventoRevisao,
  publicadas: string[]
): string => {

  const base =
    maiorRevisao(publicadas);

  if (!base) {
    return `${PREFIXO_PADRAO}00`;
  }

  return tipo === 'subrevisao'
    ? proximaSubRevisao(base)
    : proximaRevisaoInteira(base);
};

export const DESCRICAO_TIPO_EVENTO_REVISAO: Record<TipoEventoRevisao, string> = {
  revisao: 'Nova revisão (00 → 01)',
  subrevisao: 'Nova sub-revisão (00 → 00A)'
};
