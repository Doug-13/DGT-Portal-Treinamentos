import * as React from 'react';

export interface ILoadingProps {
  mensagem?: string;
  className?: string;
}

const Loading: React.FC<ILoadingProps> = ({
  mensagem = 'Carregando...',
  className
}) => (
  <div
    className={className}
    role="status"
    aria-live="polite"
    style={{ padding: '24px 0', textAlign: 'center' }}
  >
    <strong>{mensagem}</strong>
  </div>
);

export default Loading;
