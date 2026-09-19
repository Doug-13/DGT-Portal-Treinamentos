import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IDgtTrainingJsonV1,
  IResultadoValidacaoImport
} from '../../services/TreinamentoImportValidator';

import {
  IResultadoImportacaoTreinamento
} from '../../services/TreinamentoImportService';

export interface IImportarTreinamentoPageProps {
  arquivoNome:
    string;

  dados?:
    IDgtTrainingJsonV1;

  validacao:
    IResultadoValidacaoImport;

  lendo:
    boolean;

  importando:
    boolean;

  erro:
    string;

  resultado?:
    IResultadoImportacaoTreinamento;

  onVoltar:
    () => void;

  onArquivo:
    (
      arquivo:
        File
    ) => Promise<void>;

  onImportar:
    () => Promise<void>;

  onLimpar:
    () => void;
}

const card:
  React.CSSProperties = {
  padding:
    '18px',

  background:
    '#FFFFFF',

  border:
    '1px solid #D8E2EC',

  borderRadius:
    '14px'
};

const btn:
  React.CSSProperties = {
  padding:
    '10px 15px',

  border:
    '1px solid #0B5CAB',

  borderRadius:
    '8px',

  background:
    '#FFFFFF',

  color:
    '#0B5CAB',

  fontWeight:
    700,

  cursor:
    'pointer'
};

const btnPrimary:
  React.CSSProperties = {
  ...btn,

  background:
    '#0B5CAB',

  color:
    '#FFFFFF'
};

const ImportarTreinamentoPage:
  React.FC<
    IImportarTreinamentoPageProps
  > = (
    props
  ) => {

    const inputRef =
      React.useRef<
        HTMLInputElement
      >(
        null
      );

    const resumo =
      React.useMemo(
        () => {

          if (
            !props.dados
          ) {
            return undefined;
          }

          const conteudos =
            props.dados.modulos
              .reduce(
                (
                  total,
                  modulo
                ) =>
                  total +
                  modulo.conteudos.length,
                0
              );

          const perguntasRapidas =
            props.dados.modulos
              .reduce(
                (
                  total,
                  modulo
                ) =>
                  total +
                  modulo.conteudos
                    .filter(
                      item =>
                        item.tipo ===
                        'PerguntaRapida'
                    )
                    .length,
                0
              );

          return {
            modulos:
              props.dados.modulos.length,

            conteudos,

            perguntasRapidas,

            questoes:
              props.dados
                .avaliacao
                ?.questoes
                .length ||
              0
          };
        },
        [
          props.dados
        ]
      );

    return (
      <section>

        <PageHeader
          titulo="Importar treinamento"
          subtitulo="Envie um arquivo JSON no padrão DGT Training JSON v1, valide o conteúdo e revise antes de gravar no Dataverse."
          acao={
            <button
              type="button"
              onClick={
                props.onVoltar
              }
              style={
                btn
              }
            >
              ← Voltar
            </button>
          }
        />

        <div
          style={{
            ...card,

            marginBottom:
              '16px'
          }}
        >

          <input
            ref={
              inputRef
            }
            type="file"
            accept=".json,application/json"
            style={{
              display:
                'none'
            }}
            onChange={
              event => {

                const arquivo =
                  event.target
                    .files?.[0];

                if (
                  !arquivo
                ) {
                  return;
                }

                props
                  .onArquivo(
                    arquivo
                  )
                  .catch(
                    (
                      error:
                        unknown
                    ) =>
                      console.error(
                        error
                      )
                  );
              }
            }
          />

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              gap:
                '12px',

              alignItems:
                'center',

              flexWrap:
                'wrap'
            }}
          >

            <div>
              <strong
                style={{
                  display:
                    'block',

                  color:
                    '#0B2D4D'
                }}
              >
                Arquivo JSON
              </strong>

              <span
                style={{
                  color:
                    '#64748B',

                  fontSize:
                    '13px'
                }}
              >
                {
                  props.arquivoNome ||
                  'Nenhum arquivo selecionado.'
                }
              </span>
            </div>

            <div
              style={{
                display:
                  'flex',

                gap:
                  '8px'
              }}
            >

              {
                props.arquivoNome &&
                (
                  <button
                    type="button"
                    onClick={
                      props.onLimpar
                    }
                    style={
                      btn
                    }
                  >
                    Limpar
                  </button>
                )
              }

              <button
                type="button"
                disabled={
                  props.lendo
                }
                onClick={() =>
                  inputRef.current
                    ?.click()
                }
                style={
                  btnPrimary
                }
              >
                {
                  props.lendo
                    ? 'Lendo...'
                    : 'Selecionar JSON'
                }
              </button>

            </div>

          </div>

        </div>

        {
          props.erro &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                color:
                  '#A4262C',

                background:
                  '#FDE7E9'
              }}
            >
              {
                props.erro
              }
            </div>
          )
        }

        {
          props.validacao.erros
            .length >
            0 &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                background:
                  '#FFF4CE'
              }}
            >
              <strong
                style={{
                  color:
                    '#7A5B00'
                }}
              >
                Corrija antes de importar
              </strong>

              <ul>
                {
                  props.validacao.erros
                    .map(
                      (
                        erro,
                        indice
                      ) => (
                        <li
                          key={
                            indice
                          }
                        >
                          {
                            erro
                          }
                        </li>
                      )
                    )
                }
              </ul>
            </div>
          )
        }

        {
          props.validacao.avisos
            .length >
            0 &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                background:
                  '#EEF6FF'
              }}
            >
              <strong>
                Avisos
              </strong>

              <ul>
                {
                  props.validacao.avisos
                    .map(
                      (
                        aviso,
                        indice
                      ) => (
                        <li
                          key={
                            indice
                          }
                        >
                          {
                            aviso
                          }
                        </li>
                      )
                    )
                }
              </ul>
            </div>
          )
        }

        {
          props.dados &&
          resumo &&
          (
            <>

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(160px, 1fr))',

                  gap:
                    '12px',

                  marginBottom:
                    '16px'
                }}
              >

                {
                  [
                    [
                      'Módulos',
                      resumo.modulos
                    ],
                    [
                      'Blocos de conteúdo',
                      resumo.conteudos
                    ],
                    [
                      'Perguntas rápidas',
                      resumo.perguntasRapidas
                    ],
                    [
                      'Questões da prova',
                      resumo.questoes
                    ]
                  ].map(
                    item => (
                      <div
                        key={
                          String(
                            item[0]
                          )
                        }
                        style={
                          card
                        }
                      >
                        <span
                          style={{
                            display:
                              'block',

                            color:
                              '#64748B',

                            fontSize:
                              '12px'
                          }}
                        >
                          {
                            item[0]
                          }
                        </span>

                        <strong
                          style={{
                            display:
                              'block',

                            marginTop:
                              '4px',

                            fontSize:
                              '24px',

                            color:
                              '#0B2D4D'
                          }}
                        >
                          {
                            item[1]
                          }
                        </strong>
                      </div>
                    )
                  )
                }

              </div>

              <div
                style={{
                  ...card,

                  marginBottom:
                    '16px'
                }}
              >

                <h3
                  style={{
                    marginTop:
                      0
                  }}
                >
                  Pré-visualização
                </h3>

                <div
                  style={{
                    marginBottom:
                      '16px'
                  }}
                >
                  <strong>
                    {
                      props.dados
                        .treinamento
                        .nome
                    }
                  </strong>

                  <div
                    style={{
                      color:
                        '#64748B',

                      marginTop:
                        '4px'
                    }}
                  >
                    Área: {
                      props.dados
                        .treinamento
                        .area
                    }
                    {' · '}
                    Tipo: {
                      props.dados
                        .treinamento
                        .tipo
                    }
                    {' · '}
                    {
                      props.dados
                        .treinamento
                        .cargaHorariaMin
                    } min
                  </div>
                </div>

                {
                  props.dados.modulos
                    .map(
                      modulo => (
                        <div
                          key={
                            `${modulo.ordem}-${modulo.titulo}`
                          }
                          style={{
                            padding:
                              '14px 0',

                            borderTop:
                              '1px solid #EDF0F4'
                          }}
                        >
                          <strong>
                            {
                              modulo.ordem
                            }. {
                              modulo.titulo
                            }
                          </strong>

                          <div
                            style={{
                              marginTop:
                                '8px',

                              display:
                                'grid',

                              gap:
                                '6px'
                            }}
                          >
                            {
                              modulo.conteudos
                                .map(
                                  (
                                    conteudo,
                                    indice
                                  ) => (
                                    <div
                                      key={
                                        indice
                                      }
                                      style={{
                                        padding:
                                          '8px 10px',

                                        background:
                                          conteudo.tipo ===
                                            'PerguntaRapida'
                                            ? '#EEF6FF'
                                            : '#F8FAFC',

                                        borderRadius:
                                          '7px'
                                      }}
                                    >
                                      <strong>
                                        {
                                          indice +
                                          1
                                        }. {
                                          conteudo.tipo
                                        }
                                      </strong>

                                      {
                                        conteudo.titulo &&
                                        (
                                          <span>
                                            {' — '}
                                            {
                                              conteudo.titulo
                                            }
                                          </span>
                                        )
                                      }

                                      {
                                        conteudo.tipo ===
                                          'PerguntaRapida' &&
                                        (
                                          <div
                                            style={{
                                              marginTop:
                                                '4px',

                                              color:
                                                '#0B5CAB'
                                            }}
                                          >
                                            {
                                              conteudo
                                                .pergunta
                                                ?.enunciado
                                            }
                                          </div>
                                        )
                                      }
                                    </div>
                                  )
                                )
                            }
                          </div>
                        </div>
                      )
                    )
                }

              </div>

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'flex-end'
                }}
              >
                <button
                  type="button"
                  disabled={
                    !props.validacao
                      .valido ||
                    props.importando
                  }
                  onClick={() => {

                    props
                      .onImportar()
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
                    ...btnPrimary,

                    padding:
                      '11px 20px',

                    opacity:
                      props.validacao
                        .valido &&
                      !props.importando
                        ? 1
                        : .55
                  }}
                >
                  {
                    props.importando
                      ? 'Importando...'
                      : 'Importar treinamento'
                  }
                </button>
              </div>

            </>
          )
        }

        {
          props.resultado &&
          (
            <div
              style={{
                ...card,

                marginTop:
                  '18px',

                background:
                  '#E7F5EE',

                border:
                  '1px solid #A7D7C5'
              }}
            >
              <h3
                style={{
                  marginTop:
                    0,

                  color:
                    '#13795B'
                }}
              >
                Importação concluída
              </h3>

              <div>
                Código: {
                  props.resultado
                    .treinamentoCodigo ||
                  'gerado pelo Dataverse'
                }
              </div>

              <div>
                Módulos: {
                  props.resultado
                    .modulosCriados
                }
              </div>

              <div>
                Conteúdos: {
                  props.resultado
                    .conteudosCriados
                }
              </div>

              <div>
                Perguntas rápidas: {
                  props.resultado
                    .perguntasRapidasCriadas
                }
              </div>

              <div>
                Questões da prova: {
                  props.resultado
                    .questoesCriadas
                }
              </div>
            </div>
          )
        }

      </section>
    );
  };

export default ImportarTreinamentoPage;
