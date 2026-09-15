import * as React from 'react';

export interface IEmptyStateProps {
  titulo: string;
  descricao?: string;
  acaoTexto?: string;
  onAcao?: () => void;
  className?: string;
}

const EmptyState: React.FC<IEmptyStateProps> = ({
  titulo,
  descricao,
  acaoTexto,
  onAcao,
  className
}) => (
  <div
    className={className}
    style={{
      padding: 32,
      textAlign: 'center',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      background: '#fff'
    }}
  >
    <h3 style={{ margin: '0 0 8px' }}>{titulo}</h3>
    {descricao && <p style={{ margin: '0 0 16px' }}>{descricao}</p>}
    {acaoTexto && onAcao && (
      <button type="button" onClick={onAcao}>
        {acaoTexto}
      </button>
    )}
  </div>
);

export default EmptyState;
