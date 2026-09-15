import * as React from 'react';

export interface IErrorMessageProps {
  mensagem: string;
  titulo?: string;
  onTentarNovamente?: () => void;
  className?: string;
}

const ErrorMessage: React.FC<IErrorMessageProps> = ({
  mensagem,
  titulo = 'Não foi possível concluir a operação',
  onTentarNovamente,
  className
}) => {
  if (!mensagem) {
    return null;
  }

  return (
    <div
      className={className}
      role="alert"
      style={{
        padding: 16,
        border: '1px solid #f1aeb5',
        borderRadius: 8,
        background: '#fff5f5'
      }}
    >
      <strong>{titulo}</strong>
      <div style={{ marginTop: 6 }}>{mensagem}</div>

      {onTentarNovamente && (
        <button
          type="button"
          onClick={onTentarNovamente}
          style={{ marginTop: 12 }}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
