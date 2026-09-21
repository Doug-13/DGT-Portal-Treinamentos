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

  requerRetreinamento?:
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
    width:
      '100%',

    boxSizing:
      'border-box',

    padding:
      '10px 12px',

    border:
      '1px solid #CBD5E1',

    borderRadius:
      '8px',

    background:
      '#FFFFFF'
  };

const PublicarRevisaoModal:
  React.FC<IPublicarRevisaoModalProps> = ({
    aberto,
    documentoRevisaoId,
    revisao,
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
      requerRetreinamento,
      setRequerRetreinamento
    ] =
      React.useState<
        boolean | undefined
      >(undefined);

    const [
      justificativa,
      setJustificativa
    ] =
      React.useState('');

    const [
      dataLimite,
      setDataLimite
    ] =
      React.useState('');

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    React.useEffect(
      () => {

        if (
          aberto
        ) {

          setDataVigencia('');
          setRequerRetreinamento(
            undefined
          );
          setJustificativa('');
          setDataLimite('');
          setErroLocal('');
        }

      },
      [
        aberto,
        documentoRevisaoId
      ]
    );

    const publicar =
      async (): Promise<void> => {

        setErroLocal('');

        if (
          requerRetreinamento ===
            undefined
        ) {

          setErroLocal(
            'Informe se esta revisão exige retreinamento.'
          );

          return;
        }

        if (
          !requerRetreinamento &&
          !justificativa.trim()
        ) {

          setErroLocal(
            'Informe a justificativa para não exigir retreinamento.'
          );

          return;
        }

        if (
          requerRetreinamento &&
          !dataLimite
        ) {

          setErroLocal(
            'Informe o prazo para conclusão do retreinamento.'
          );

          return;
        }

        await onPublicar({
          documentoRevisaoId,

          requerRetreinamento,

          justificativa:
            justificativa.trim(),

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

    if (
      !aberto
    ) {
      return null;
    }

    return (
      <div
        style={{
          position:
            'fixed',

          inset:
            0,

          zIndex:
            12000,

          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            'center',

          padding:
            '20px',

          background:
            'rgba(15,23,42,.60)'
        }}
      >
        <div
          style={{
            width:
              '100%',

            maxWidth:
              '620px',

            maxHeight:
              '90vh',

            overflowY:
              'auto',

            padding:
              '24px',

            borderRadius:
              '16px',

            background:
              '#FFFFFF'
          }}
        >
          <h2
            style={{
              marginTop:
                0,

              marginBottom:
                '6px'
            }}
          >
            Publicar revisão {
              revisao
            }
          </h2>

          <p
            style={{
              marginTop:
                0,

              color:
                '#64748B',

              lineHeight:
                1.5
            }}
          >
            A publicação torna esta revisão vigente e preserva as revisões anteriores no histórico.
          </p>

          {
            erroLocal &&
            (
              <div
                style={{
                  marginBottom:
                    '16px',

                  padding:
                    '11px 12px',

                  borderRadius:
                    '8px',

                  background:
                    '#FDE7E9',

                  color:
                    '#A4262C'
                }}
              >
                {
                  erroLocal
                }
              </div>
            )
          }

          <label>
            Data de vigência
          </label>

          <input
            type="date"
            value={
              dataVigencia
            }
            onChange={
              event =>
                setDataVigencia(
                  event.target.value
                )
            }
            style={{
              ...input,
              marginTop:
                '6px'
            }}
          />

          <div
            style={{
              marginTop:
                '20px',

              padding:
                '16px',

              border:
                '1px solid #D9E4EF',

              borderRadius:
                '12px',

              background:
                '#F8FBFE'
            }}
          >
            <strong
              style={{
                display:
                  'block',

                marginBottom:
                  '10px',

                color:
                  '#0A2845'
              }}
            >
              Esta revisão exige retreinamento?
            </strong>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  '10px'
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setRequerRetreinamento(
                    true
                  )
                }
                style={{
                  padding:
                    '12px',

                  border:
                    requerRetreinamento ===
                      true
                      ? '2px solid #0867D7'
                      : '1px solid #CBD5E1',

                  borderRadius:
                    '9px',

                  background:
                    requerRetreinamento ===
                      true
                      ? '#EAF4FF'
                      : '#FFFFFF',

                  color:
                    '#0A2845',

                  fontWeight:
                    700,

                  cursor:
                    'pointer'
                }}
              >
                Sim, exige
              </button>

              <button
                type="button"
                onClick={() =>
                  setRequerRetreinamento(
                    false
                  )
                }
                style={{
                  padding:
                    '12px',

                  border:
                    requerRetreinamento ===
                      false
                      ? '2px solid #0867D7'
                      : '1px solid #CBD5E1',

                  borderRadius:
                    '9px',

                  background:
                    requerRetreinamento ===
                      false
                      ? '#EAF4FF'
                      : '#FFFFFF',

                  color:
                    '#0A2845',

                  fontWeight:
                    700,

                  cursor:
                    'pointer'
                }}
              >
                Não exige
              </button>
            </div>

            {
              requerRetreinamento ===
                true &&
              (
                <div
                  style={{
                    marginTop:
                      '16px'
                  }}
                >
                  <label>
                    Prazo para concluir o retreinamento *
                  </label>

                  <input
                    type="date"
                    value={
                      dataLimite
                    }
                    onChange={
                      event =>
                        setDataLimite(
                          event.target.value
                        )
                    }
                    style={{
                      ...input,
                      marginTop:
                        '6px'
                    }}
                  />

                  <div
                    style={{
                      marginTop:
                        '9px',

                      padding:
                        '10px',

                      borderRadius:
                        '8px',

                      background:
                        '#FFF8E1',

                      color:
                        '#604A00',

                      fontSize:
                        '12px',

                      lineHeight:
                        1.45
                    }}
                  >
                    Ao publicar, os treinamentos vinculados ao documento serão identificados e os usuários anteriormente treinados serão processados para uma nova atribuição com origem “Revisão documental”.
                  </div>
                </div>
              )
            }

            {
              requerRetreinamento ===
                false &&
              (
                <div
                  style={{
                    marginTop:
                      '16px'
                  }}
                >
                  <label>
                    Justificativa para não retreinar *
                  </label>

                  <textarea
                    value={
                      justificativa
                    }
                    placeholder="Explique por que as alterações desta revisão não exigem novo treinamento."
                    onChange={
                      event =>
                        setJustificativa(
                          event.target.value
                        )
                    }
                    style={{
                      ...input,

                      marginTop:
                        '6px',

                      minHeight:
                        '95px',

                      resize:
                        'vertical'
                    }}
                  />
                </div>
              )
            }
          </div>

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'flex-end',

              gap:
                '10px',

              marginTop:
                '22px'
            }}
          >
            <button
              type="button"
              onClick={
                onCancelar
              }
              disabled={
                processando
              }
              style={{
                padding:
                  '10px 14px',

                border:
                  '1px solid #CBD5E1',

                borderRadius:
                  '8px',

                background:
                  '#FFFFFF',

                cursor:
                  'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={
                processando
              }
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
                padding:
                  '10px 16px',

                border:
                  'none',

                borderRadius:
                  '8px',

                background:
                  processando
                    ? '#94A3B8'
                    : '#0867D7',

                color:
                  '#FFFFFF',

                fontWeight:
                  700,

                cursor:
                  processando
                    ? 'not-allowed'
                    : 'pointer'
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
