import * as React from 'react';

import {
  INovaPerguntaRapidaModulo,
  ModuloPerguntaAdminService,
  TipoPerguntaRapida
} from '../../services/ModuloPerguntaAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

export interface IPerguntaRapidaEditorProps {
  dataverse:
    DataverseService;

  conteudoModuloId:
    string;

  onSalvo:
    () => void;

  onCancelar:
    () => void;
}

interface IAlternativaLocal {
  texto:
    string;

  correta:
    boolean;
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
    '1px solid #D8E2EC',

  borderRadius:
    '8px',

  color:
    '#18324A',

  background:
    '#FFFFFF'
};

const btn:
  React.CSSProperties = {
  padding:
    '9px 13px',

  border:
    '1px solid #0B5CAB',

  background:
    '#FFFFFF',

  color:
    '#0B5CAB',

  borderRadius:
    '8px',

  cursor:
    'pointer',

  fontWeight:
    700
};

const btnPrimary:
  React.CSSProperties = {
  ...btn,

  background:
    '#0B5CAB',

  color:
    '#FFFFFF'
};

const PerguntaRapidaEditor:
  React.FC<
    IPerguntaRapidaEditorProps
  > = ({
    dataverse,
    conteudoModuloId,
    onSalvo,
    onCancelar
  }) => {

    const service =
      React.useMemo(
        () =>
          new ModuloPerguntaAdminService(
            dataverse
          ),
        [
          dataverse
        ]
      );

    const [
      tipo,
      setTipo
    ] =
      React.useState<
        TipoPerguntaRapida
      >(
        'EscolhaUnica'
      );

    const [
      enunciado,
      setEnunciado
    ] =
      React.useState('');

    const [
      exigirAcerto,
      setExigirAcerto
    ] =
      React.useState(
        true
      );

    const [
      mostrarFeedback,
      setMostrarFeedback
    ] =
      React.useState(
        true
      );

    const [
      feedbackAcerto,
      setFeedbackAcerto
    ] =
      React.useState(
        'Correto. Você pode continuar.'
      );

    const [
      feedbackErro,
      setFeedbackErro
    ] =
      React.useState(
        'Revise o conteúdo anterior e tente novamente.'
      );

    const [
      alternativas,
      setAlternativas
    ] =
      React.useState<
        IAlternativaLocal[]
      >([
        {
          texto:
            '',
          correta:
            true
        },
        {
          texto:
            '',
          correta:
            false
        }
      ]);

    const [
      salvando,
      setSalvando
    ] =
      React.useState(
        false
      );

    const [
      erro,
      setErro
    ] =
      React.useState('');

    const prepararTipo =
      (
        novoTipo:
          TipoPerguntaRapida
      ): void => {

        setTipo(
          novoTipo
        );

        if (
          novoTipo ===
            'VerdadeiroFalso'
        ) {
          setAlternativas([
            {
              texto:
                'Verdadeiro',
              correta:
                true
            },
            {
              texto:
                'Falso',
              correta:
                false
            }
          ]);

          return;
        }

        if (
          novoTipo ===
            'SimNao'
        ) {
          setAlternativas([
            {
              texto:
                'Sim',
              correta:
                true
            },
            {
              texto:
                'Não',
              correta:
                false
            }
          ]);

          return;
        }

        setAlternativas([
          {
            texto:
              '',
            correta:
              true
          },
          {
            texto:
              '',
            correta:
              false
          }
        ]);
      };

    const marcarCorreta =
      (
        indice:
          number
      ): void => {

        setAlternativas(
          lista =>
            lista.map(
              (
                item,
                i
              ) => {

                if (
                  tipo ===
                    'MultiplaEscolha'
                ) {
                  return i ===
                    indice
                    ? {
                      ...item,
                      correta:
                        !item.correta
                    }
                    : item;
                }

                return {
                  ...item,
                  correta:
                    i ===
                    indice
                };
              }
            )
        );
      };

    const salvar =
      async (): Promise<void> => {

        setSalvando(
          true
        );

        setErro('');

        try {

          const dados:
            INovaPerguntaRapidaModulo = {

            conteudoModuloId,

            enunciado:
              enunciado.trim(),

            tipo,

            exigirAcerto,

            mostrarFeedback,

            feedbackAcerto,

            feedbackErro,

            alternativas
          };

          await service.criar(
            dados
          );

          onSalvo();

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar pergunta.'
          );

        } finally {

          setSalvando(
            false
          );
        }
      };

    return (
      <div
        style={{
          padding:
            '18px',

          border:
            '1px solid #B9D7F0',

          borderRadius:
            '12px',

          background:
            '#F7FBFF'
        }}
      >

        <h3
          style={{
            marginTop:
              0,

            color:
              '#0B2D4D'
          }}
        >
          Pergunta rápida
        </h3>

        <p
          style={{
            color:
              '#64748B'
          }}
        >
          Esta pergunta é formativa e aparece no meio do módulo.
          Ela não entra na nota da prova final.
        </p>

        {
          erro &&
          (
            <div
              style={{
                marginBottom:
                  '12px',

                padding:
                  '10px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C',

                borderRadius:
                  '8px'
              }}
            >
              {
                erro
              }
            </div>
          )
        }

        <label>
          Tipo
        </label>

        <select
          value={
            tipo
          }
          onChange={
            event =>
              prepararTipo(
                event.target
                  .value as
                  TipoPerguntaRapida
              )
          }
          style={{
            ...input,

            marginTop:
              '6px'
          }}
        >
          <option value="EscolhaUnica">
            Escolha única
          </option>

          <option value="MultiplaEscolha">
            Múltipla escolha
          </option>

          <option value="VerdadeiroFalso">
            Verdadeiro/Falso
          </option>

          <option value="SimNao">
            Sim/Não
          </option>
        </select>

        <div
          style={{
            height:
              '12px'
          }}
        />

        <label>
          Pergunta
        </label>

        <textarea
          rows={
            4
          }
          value={
            enunciado
          }
          onChange={
            event =>
              setEnunciado(
                event.target
                  .value
              )
          }
          style={{
            ...input,

            marginTop:
              '6px',

            resize:
              'vertical'
          }}
        />

        <div
          style={{
            marginTop:
              '16px'
          }}
        >
          <strong>
            Respostas
          </strong>
        </div>

        {
          alternativas.map(
            (
              alternativa,
              indice
            ) => (
              <div
                key={
                  indice
                }
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    '40px 1fr',

                  gap:
                    '8px',

                  alignItems:
                    'center',

                  marginTop:
                    '8px'
                }}
              >
                <input
                  type={
                    tipo ===
                      'MultiplaEscolha'
                      ? 'checkbox'
                      : 'radio'
                  }
                  checked={
                    alternativa.correta
                  }
                  onChange={() =>
                    marcarCorreta(
                      indice
                    )
                  }
                />

                <input
                  value={
                    alternativa.texto
                  }
                  disabled={
                    tipo ===
                      'VerdadeiroFalso' ||
                    tipo ===
                      'SimNao'
                  }
                  onChange={
                    event =>
                      setAlternativas(
                        lista =>
                          lista.map(
                            (
                              item,
                              i
                            ) =>
                              i ===
                                indice
                                ? {
                                  ...item,
                                  texto:
                                    event.target.value
                                }
                                : item
                          )
                      )
                  }
                  style={
                    input
                  }
                />
              </div>
            )
          )
        }

        {
          (
            tipo ===
              'EscolhaUnica' ||
            tipo ===
              'MultiplaEscolha'
          ) &&
          (
            <button
              type="button"
              onClick={() =>
                setAlternativas(
                  lista => [
                    ...lista,
                    {
                      texto:
                        '',
                      correta:
                        false
                    }
                  ]
                )
              }
              style={{
                ...btn,

                marginTop:
                  '10px'
              }}
            >
              + Adicionar resposta
            </button>
          )
        }

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              '1fr 1fr',

            gap:
              '12px',

            marginTop:
              '18px'
          }}
        >

          <label
            style={{
              display:
                'flex',

              gap:
                '8px'
            }}
          >
            <input
              type="checkbox"
              checked={
                exigirAcerto
              }
              onChange={
                event =>
                  setExigirAcerto(
                    event.target
                      .checked
                  )
              }
            />

            Exigir acerto para continuar
          </label>

          <label
            style={{
              display:
                'flex',

              gap:
                '8px'
            }}
          >
            <input
              type="checkbox"
              checked={
                mostrarFeedback
              }
              onChange={
                event =>
                  setMostrarFeedback(
                    event.target
                      .checked
                  )
              }
            />

            Mostrar feedback
          </label>

        </div>

        {
          mostrarFeedback &&
          (
            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  '12px',

                marginTop:
                  '14px'
              }}
            >

              <div>
                <label>
                  Feedback de acerto
                </label>

                <textarea
                  rows={
                    3
                  }
                  value={
                    feedbackAcerto
                  }
                  onChange={
                    event =>
                      setFeedbackAcerto(
                        event.target
                          .value
                      )
                  }
                  style={{
                    ...input,

                    marginTop:
                      '6px'
                  }}
                />
              </div>

              <div>
                <label>
                  Feedback de erro
                </label>

                <textarea
                  rows={
                    3
                  }
                  value={
                    feedbackErro
                  }
                  onChange={
                    event =>
                      setFeedbackErro(
                        event.target
                          .value
                      )
                  }
                  style={{
                    ...input,

                    marginTop:
                      '6px'
                  }}
                />
              </div>

            </div>
          )
        }

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'flex-end',

            gap:
              '10px',

            marginTop:
              '18px'
          }}
        >
          <button
            type="button"
            onClick={
              onCancelar
            }
            style={
              btn
            }
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={
              salvando
            }
            onClick={() => {

              salvar()
                .catch(
                  error =>
                    console.error(
                      error
                    )
                );
            }}
            style={
              btnPrimary
            }
          >
            {
              salvando
                ? 'Salvando...'
                : 'Salvar pergunta'
            }
          </button>
        </div>

      </div>
    );
  };

export default PerguntaRapidaEditor;
