import * as React from 'react';

import {
  IPublicarRevisao,
  IResultadoPublicacaoRevisao
} from '../../services/RevisaoDocumentoAdminService';

export interface IPublicarRevisaoModalProps {
  aberto:
    boolean;

  documentoRevisaoId:
    string;

  revisao:
    string;

  requerRetreinamento:
    boolean;

  processando:
    boolean;

  onCancelar:
    () => void;

  onPublicar:
    (
      dados:
        IPublicarRevisao
    ) => Promise<IResultadoPublicacaoRevisao>;
}

const input:
  React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px'
  };

const PublicarRevisaoModal:
  React.FC<IPublicarRevisaoModalProps> = ({
    aberto,
    documentoRevisaoId,
    revisao,
    requerRetreinamento,
    processando,
    onCancelar,
    onPublicar
  }) => {

    const [
      dataVigencia,
      setDataVigencia
    ] =
      React.useState('');

    const [
      dataLimite,
      setDataLimite
    ] =
      React.useState('');

    const publicar =
      async (): Promise<void> => {

        await onPublicar({
          documentoRevisaoId,

          dataVigencia:
            dataVigencia
              ? new Date(
                  `${dataVigencia}T12:00:00`
                ).toISOString()
              : '',

          dataLimite:
            dataLimite
              ? new Date(
                  `${dataLimite}T23:59:59`
                ).toISOString()
              : ''
        });
      };

    if (!aberto) {
      return null;
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 12000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background:
            'rgba(15,23,42,.60)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            padding: '24px',
            borderRadius: '16px',
            background: '#fff'
          }}
        >
          <h2
            style={{
              marginTop: 0
            }}
          >
            Publicar revisão {revisao}
          </h2>

          <p
            style={{
              color: '#64748b'
            }}
          >
            A publicação torna esta revisão vigente.
            {
              requerRetreinamento
                ? ' Os usuários impactados serão processados para retreinamento.'
                : ' Esta revisão não exige retreinamento.'
            }
          </p>

          <label>
            Data de vigência
          </label>

          <input
            type="date"
            value={dataVigencia}
            onChange={
              event =>
                setDataVigencia(
                  event.target.value
                )
            }
            style={input}
          />

          {
            requerRetreinamento &&
            (
              <>
                <div
                  style={{
                    height: '14px'
                  }}
                />

                <label>
                  Prazo para retreinamento
                </label>

                <input
                  type="date"
                  value={dataLimite}
                  onChange={
                    event =>
                      setDataLimite(
                        event.target.value
                      )
                  }
                  style={input}
                />
              </>
            )
          }

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '22px'
            }}
          >
            <button
              type="button"
              onClick={onCancelar}
              disabled={processando}
              style={{
                padding: '10px 14px',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={processando}
              onClick={() => {
                publicar()
                  .catch(
                    (
                      error:
                        unknown
                    ) =>
                      console.error(
                        error
                      )
                  );
              }}
              style={{
                padding: '10px 14px',
                border: 'none',
                borderRadius: '8px',
                background: '#1677ff',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {
                processando
                  ? 'Publicando...'
                  : 'Publicar revisão'
              }
            </button>
          </div>
        </div>
      </div>
    );
  };

export default PublicarRevisaoModal;
