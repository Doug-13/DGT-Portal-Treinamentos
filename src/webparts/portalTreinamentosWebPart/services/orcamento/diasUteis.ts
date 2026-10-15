// ============================================================
// DIAS ÚTEIS (prazo de ajuste da planilha devolvida)
//
// Considera sábado, domingo e os feriados NACIONAIS (fixos +
// Sexta-feira Santa). Feriados estaduais/municipais e pontos
// facultativos (Carnaval, Corpus Christi) NÃO entram: inclua-os em
// FERIADOS_EXTRAS se a empresa não trabalhar nesses dias.
// ============================================================

// "MM-DD" que se repetem todo ano.
const FERIADOS_FIXOS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Dia da Consciência Negra
  '12-25'  // Natal
];

// Datas específicas "AAAA-MM-DD" (feriados locais, recessos...).
// Ex.: '2027-02-08', '2027-02-09' para considerar o Carnaval.
export const FERIADOS_EXTRAS: string[] = [];

const dois = (numero: number): string =>
  numero < 10 ? `0${numero}` : String(numero);

const chaveData = (data: Date): string =>
  `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;

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

const cacheFeriados: { [ano: number]: string[] } = {};

const feriadosDoAno = (ano: number): string[] => {
  if (!cacheFeriados[ano]) {
    const sextaSanta = pascoa(ano);
    sextaSanta.setDate(sextaSanta.getDate() - 2);
    cacheFeriados[ano] =
      FERIADOS_FIXOS.map(item => `${ano}-${item}`)
        .concat([chaveData(sextaSanta)])
        .concat(FERIADOS_EXTRAS.filter(item => item.substring(0, 4) === String(ano)));
  }
  return cacheFeriados[ano];
};

export const ehDiaUtil = (data: Date): boolean => {
  const semana = data.getDay();
  if (semana === 0 || semana === 6) {
    return false;
  }
  return feriadosDoAno(data.getFullYear()).indexOf(chaveData(data)) < 0;
};

// Fim (23:59:59) do N-ésimo dia útil DEPOIS de "inicio".
// Ex.: devolvida na sexta à tarde, 2 dias úteis → terça 23:59.
export const adicionarDiasUteis = (
  inicio: Date,
  dias: number
): Date => {
  const data = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  let contados = 0;
  while (contados < dias) {
    data.setDate(data.getDate() + 1);
    if (ehDiaUtil(data)) {
      contados++;
    }
  }
  data.setHours(23, 59, 59, 0);
  return data;
};

export interface ISituacaoPrazo {
  atrasado: boolean;
  // Dias úteis que faltam (incluindo hoje, se for útil) ou de atraso.
  diasUteis: number;
  texto: string;
}

// Situação do prazo em relação a "agora". "inicioIso" é a data da
// devolução: o próprio dia da devolução não conta como dia de prazo.
export const situacaoPrazo = (
  prazoIso: string,
  inicioIso?: string,
  agora: Date = new Date()
): ISituacaoPrazo | undefined => {

  if (!prazoIso) {
    return undefined;
  }

  const prazo = new Date(prazoIso);

  if (isNaN(prazo.getTime())) {
    return undefined;
  }

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diaPrazo = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());

  if (agora.getTime() <= prazo.getTime()) {
    // Dias úteis restantes: de hoje (ou do dia seguinte à devolução)
    // até o dia do prazo, inclusive.
    const cursor = new Date(hoje.getTime());
    const inicio = inicioIso ? new Date(inicioIso) : undefined;
    if (inicio && !isNaN(inicio.getTime())) {
      const diaSeguinte = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1);
      if (diaSeguinte.getTime() > cursor.getTime()) {
        cursor.setTime(diaSeguinte.getTime());
      }
    }
    let restantes = 0;
    while (cursor.getTime() <= diaPrazo.getTime()) {
      if (ehDiaUtil(cursor)) {
        restantes++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return {
      atrasado: false,
      diasUteis: restantes,
      texto:
        hoje.getTime() === diaPrazo.getTime()
          ? 'vence hoje'
          : restantes === 1
            ? 'falta 1 dia útil'
            : `faltam ${restantes} dias úteis`
    };
  }

  // Atrasado: dias úteis depois do prazo até hoje (inclusive).
  let atraso = 0;
  const cursor = new Date(diaPrazo.getTime());
  cursor.setDate(cursor.getDate() + 1);
  while (cursor.getTime() <= hoje.getTime()) {
    if (ehDiaUtil(cursor)) {
      atraso++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  atraso = Math.max(atraso, 1);
  return {
    atrasado: true,
    diasUteis: atraso,
    texto: atraso === 1 ? '1 dia útil de atraso' : `${atraso} dias úteis de atraso`
  };
};
