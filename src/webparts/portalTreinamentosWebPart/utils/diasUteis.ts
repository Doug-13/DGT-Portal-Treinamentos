// ============================================================
// DIAS ÚTEIS (prazos internos das licitações)
//
// Dia útil = segunda a sexta, fora os feriados NACIONAIS:
//   fixos   01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12
//   móveis  Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi
// Feriados estaduais/municipais não entram (variam por cliente).
//
// A mesma regra está em CriarTarefaClickUpPlugin.cs.
// ============================================================

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
const pascoa = (ano: number): Date => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
};

const chaveDia = (data: Date): string =>
  `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`;

const cacheFeriados: { [ano: number]: Set<string> } = {};

const feriadosDoAno = (ano: number): Set<string> => {
  if (cacheFeriados[ano]) {
    return cacheFeriados[ano];
  }
  const lista = new Set<string>();
  [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]]
    .forEach(([mes, dia]) => lista.add(`${ano}-${mes}-${dia}`));
  const p = pascoa(ano);
  [-48, -47, -2, 60].forEach(deslocamento => {
    const d = new Date(p.getFullYear(), p.getMonth(), p.getDate() + deslocamento);
    lista.add(chaveDia(d));
  });
  cacheFeriados[ano] = lista;
  return lista;
};

export const ehDiaUtil = (data: Date): boolean => {
  const semana = data.getDay();
  return semana !== 0 && semana !== 6 && !feriadosDoAno(data.getFullYear()).has(chaveDia(data));
};

// Volta N dias úteis a partir da data (mantém a hora).
export const subtrairDiasUteis = (data: Date, dias: number): Date => {
  const resultado = new Date(data.getTime());
  let faltam = dias;
  while (faltam > 0) {
    resultado.setDate(resultado.getDate() - 1);
    if (ehDiaUtil(resultado)) {
      faltam--;
    }
  }
  return resultado;
};
