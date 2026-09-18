import * as React from 'react';

export interface IStatusBadgeProps {
  status:
    string;
}

const normalizar = (
  valor: string
): string =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim();

const StatusBadge:
  React.FC<IStatusBadgeProps> = ({
    status
  }) => {

    const valor =
      normalizar(
        status
      );

    let background =
      '#eef2f7';

    let color =
      '#475569';

    if (
      valor.indexOf(
        'conclu'
      ) >= 0 ||
      valor.indexOf(
        'aprov'
      ) >= 0
    ) {
      background =
        '#dcfce7';
      color =
        '#166534';
    }
    else if (
      valor.indexOf(
        'venc'
      ) >= 0 ||
      valor.indexOf(
        'reprov'
      ) >= 0
    ) {
      background =
        '#fee2e2';
      color =
        '#991b1b';
    }
    else if (
      valor.indexOf(
        'andamento'
      ) >= 0 ||
      valor.indexOf(
        'dispon'
      ) >= 0
    ) {
      background =
        '#dbeafe';
      color =
        '#1d4ed8';
    }
    else if (
      valor.indexOf(
        'bloque'
      ) >= 0
    ) {
      background =
        '#f1f5f9';
      color =
        '#64748b';
    }
    else if (
      valor.indexOf(
        'pend'
      ) >= 0 ||
      valor.indexOf(
        'a vencer'
      ) >= 0
    ) {
      background =
        '#fef3c7';
      color =
        '#92400e';
    }

    return (
      <span
        style={{
          display:
            'inline-flex',
          alignItems:
            'center',
          minHeight:
            '26px',
          padding:
            '4px 9px',
          borderRadius:
            '999px',
          background,
          color,
          fontSize:
            '12px',
          fontWeight:
            600,
          whiteSpace:
            'nowrap'
        }}
      >
        {status}
      </span>
    );
  };

export default StatusBadge;
