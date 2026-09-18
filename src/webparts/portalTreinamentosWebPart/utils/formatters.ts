export const formatarDataPtBr = (
  valor?: string | null
): string => {

  if (!valor) {
    return '-';
  }

  const data =
    new Date(
      valor
    );

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return valor;
  }

  return data
    .toLocaleDateString(
      'pt-BR'
    );
};

export const formatarPercentual = (
  valor?: number | null
): string => {

  if (
    valor === undefined ||
    valor === null ||
    Number.isNaN(
      valor
    )
  ) {
    return '-';
  }

  return `${Math.round(valor)}%`;
};

export const formatarNumero = (
  valor?: number | null
): string => {

  if (
    valor === undefined ||
    valor === null ||
    Number.isNaN(
      valor
    )
  ) {
    return '0';
  }

  return new Intl.NumberFormat(
    'pt-BR'
  ).format(
    valor
  );
};
