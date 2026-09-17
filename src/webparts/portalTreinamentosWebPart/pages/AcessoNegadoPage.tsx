import * as React from 'react';

export interface IAcessoNegadoPageProps {
  mensagem?: string;
  onVoltar?: () => void;
}

const AcessoNegadoPage:
  React.FC<IAcessoNegadoPageProps> = ({
    mensagem,
    onVoltar
  }) => {

    return (
      <section
        style={{
          minHeight: '420px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            padding: '32px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            background: '#fff'
          }}
        >
          <div
            style={{
              fontSize: '46px',
              marginBottom: '12px'
            }}
          >
            🔒
          </div>

          <h2
            style={{
              marginBottom: '8px'
            }}
          >
            Acesso restrito
          </h2>

          <p
            style={{
              color: '#64748b',
              lineHeight: 1.5
            }}
          >
            {
              mensagem ||
              'Seu perfil não possui permissão para acessar esta área.'
            }
          </p>

          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              style={{
                marginTop: '18px',
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                background: '#1677ff',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Voltar ao início
            </button>
          )}
        </div>
      </section>
    );
  };

export default AcessoNegadoPage;
