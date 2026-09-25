// ============================================================
// FUSO HORÁRIO — horário de Brasília em todo o portal
//
// O Microsoft Graph devolve os eventos em UTC SEM o "Z" no final
// (ex.: "2026-10-01T12:00:00.0000000"). O navegador lê isso como hora
// LOCAL, então uma reunião das 09:00 (Brasília) aparecia como 12:00.
// Aqui a data é marcada como UTC e sempre exibida em Brasília,
// independentemente do fuso configurado no computador do usuário.
// ============================================================

export const FUSO_BRASILIA = 'America/Sao_Paulo';

const temFuso = (
  valor: string
): boolean =>
  /(Z|[+-]\d{2}:?\d{2})$/i.test(valor);

// Converte o dateTime do Graph em ISO com "Z" (UTC real).
// Eventos de dia inteiro: mantém o DIA (meio-dia UTC), para não
// "voltar" um dia ao converter para Brasília.
export const normalizarDataGraph = (
  dateTime?: string,
  timeZone?: string,
  diaInteiro?: boolean
): string => {

  const valor =
    (dateTime || '').trim();

  if (!valor) {
    return '';
  }

  if (diaInteiro) {
    return `${valor.substring(0, 10)}T12:00:00Z`;
  }

  if (temFuso(valor)) {
    return valor;
  }

  const fuso =
    (timeZone || 'UTC').toUpperCase();

  // Pedimos os eventos em UTC (Prefer: outlook.timezone="UTC").
  if (
    fuso === 'UTC' ||
    fuso === 'COORDINATED UNIVERSAL TIME'
  ) {
    // Remove frações além de milissegundos: "12:00:00.0000000"
    const semFracaoLonga =
      valor.replace(/(\.\d{3})\d+$/, '$1');

    return `${semFracaoLonga}Z`;
  }

  return valor;
};

const paraData = (
  valor: string | Date
): Date | undefined => {

  const data =
    valor instanceof Date
      ? valor
      : new Date(valor);

  return Number.isNaN(data.getTime())
    ? undefined
    : data;
};

export const formatarHoraBrasilia = (
  valor: string | Date
): string => {

  const data =
    paraData(valor);

  return data
    ? data.toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: FUSO_BRASILIA
      }
    )
    : '';
};

export const diaBrasilia = (
  valor: string | Date
): string => {

  const data =
    paraData(valor);

  return data
    ? data.toLocaleDateString(
      'pt-BR',
      {
        day: 'numeric',
        timeZone: FUSO_BRASILIA
      }
    )
    : '--';
};

export const mesCurtoBrasilia = (
  valor: string | Date
): string => {

  const data =
    paraData(valor);

  return data
    ? data
      .toLocaleDateString(
        'pt-BR',
        {
          month: 'short',
          timeZone: FUSO_BRASILIA
        }
      )
      .replace('.', '')
      .toUpperCase()
    : '---';
};

// "AAAA-MM-DD" do dia em Brasília (para comparar "hoje"/"amanhã").
export const chaveDiaBrasilia = (
  valor: string | Date
): string => {

  const data =
    paraData(valor);

  if (!data) {
    return '';
  }

  // en-CA formata como AAAA-MM-DD
  return data.toLocaleDateString(
    'en-CA',
    {
      timeZone: FUSO_BRASILIA
    }
  );
};

// "Hoje", "Amanhã" ou "" para as demais datas.
export const rotuloDiaRelativo = (
  valor: string | Date
): string => {

  const chave =
    chaveDiaBrasilia(valor);

  const hoje =
    chaveDiaBrasilia(new Date());

  const amanha =
    chaveDiaBrasilia(
      new Date(Date.now() + 86400000)
    );

  if (chave && chave === hoje) {
    return 'Hoje';
  }

  if (chave && chave === amanha) {
    return 'Amanhã';
  }

  return '';
};
