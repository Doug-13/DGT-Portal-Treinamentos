import * as React from 'react';

import {
  IModuloTreinamento,
  StatusUsuarioModulo
} from '../../models/Modulo';

export interface IModuleCardProps {
  modulo:
    IModuloTreinamento;

  treinamentoEmAndamento:
    boolean;

  processando?:
    boolean;

  onIniciar:
    (
      modulo:
        IModuloTreinamento
    ) => void;

  onConcluir:
    (
      modulo:
        IModuloTreinamento
    ) => void;

  onAbrir:
    (
      modulo:
        IModuloTreinamento
    ) => void;

  className?:
    string;
}

const tipoIcone =
  (
    tipo:
      string
  ): string => {

    const nome =
      tipo.toLowerCase();

    if (
      nome.indexOf(
        'vídeo'
      ) >=
        0 ||
      nome.indexOf(
        'video'
      ) >=
        0
    ) {
      return '▶';
    }

    if (
      nome.indexOf(
        'documento'
      ) >=
        0
    ) {
      return '▤';
    }

    if (
      nome.indexOf(
        'link'
      ) >=
        0
    ) {
      return '↗';
    }

    return '▣';
  };

const statusConfig =
  (
    status:
      number
  ): {
    texto:
      string;

    fundo:
      string;

    cor:
      string;
  } => {

    if (
      status ===
        StatusUsuarioModulo.Concluido
    ) {
      return {
        texto:
          'Concluído',

        fundo:
          '#E7F5EE',

        cor:
          '#13795B'
      };
    }

    if (
      status ===
        StatusUsuarioModulo.EmAndamento
    ) {
      return {
        texto:
          'Em andamento',

        fundo:
          '#EEF6FF',

        cor:
          '#0B5CAB'
      };
    }

    return {
      texto:
        'Não iniciado',

      fundo:
        '#F1F5F9',

      cor:
        '#475569'
    };
  };

const ModuleCard:
  React.FC<
    IModuleCardProps
  > = ({
    modulo,
    treinamentoEmAndamento,
    processando = false,
    onIniciar,
    onConcluir,
    onAbrir,
    className
  }) => {

    const concluido =
      modulo.statusModulo ===
      StatusUsuarioModulo.Concluido;

    const emAndamento =
      modulo.statusModulo ===
      StatusUsuarioModulo.EmAndamento;

    const status =
      statusConfig(
        modulo.statusModulo
      );

    const podeIniciar =
      treinamentoEmAndamento &&
      !concluido &&
      !processando;

    return (
      <article
        className={
          className
        }
        style={{
          overflow:
            'hidden',

          border:
            emAndamento
              ? '1px solid #8DBCE7'
              : concluido
                ? '1px solid #A7D7C5'
                : '1px solid #D8E2EC',

          borderRadius:
            '14px',

          background:
            '#FFFFFF',

          boxShadow:
            '0 4px 14px rgba(15, 35, 55, 0.06)'
        }}
      >

        <div
          style={{
            height:
              '5px',

            background:
              concluido
                ? '#13795B'
                : emAndamento
                  ? '#0B5CAB'
                  : '#CBD5E1'
          }}
        />

        <div
          style={{
            padding:
              '18px'
          }}
        >

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              gap:
                '18px',

              alignItems:
                'flex-start'
            }}
          >

            <div
              style={{
                display:
                  'flex',

                gap:
                  '14px',

                minWidth:
                  0,

                flex:
                  1
              }}
            >

              <div
                style={{
                  width:
                    '42px',

                  height:
                    '42px',

                  minWidth:
                    '42px',

                  display:
                    'flex',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  borderRadius:
                    '10px',

                  background:
                    '#EEF6FF',

                  color:
                    '#0B5CAB',

                  fontSize:
                    '19px',

                  fontWeight:
                    700
                }}
              >
                {
                  tipoIcone(
                    modulo.tipoModuloNome
                  )
                }
              </div>

              <div
                style={{
                  minWidth:
                    0
                }}
              >

                <div
                  style={{
                    color:
                      '#64748B',

                    fontSize:
                      '12px',

                    fontWeight:
                      700,

                    marginBottom:
                      '4px'
                  }}
                >
                  MÓDULO {
                    modulo.ordem
                  }
                </div>

                <h3
                  style={{
                    margin:
                      '0 0 7px',

                    color:
                      '#0B2D4D',

                    fontSize:
                      '18px',

                    lineHeight:
                      1.3
                  }}
                >
                  {
                    modulo.titulo
                  }
                </h3>

                <div
                  style={{
                    display:
                      'flex',

                    flexWrap:
                      'wrap',

                    gap:
                      '7px'
                  }}
                >

                  <span
                    style={{
                      padding:
                        '4px 8px',

                      background:
                        '#F1F5F9',

                      borderRadius:
                        '999px',

                      color:
                        '#334155',

                      fontSize:
                        '12px',

                      fontWeight:
                        600
                    }}
                  >
                    {
                      modulo.tipoModuloNome
                    }
                  </span>

                  <span
                    style={{
                      padding:
                        '4px 8px',

                      background:
                        '#F1F5F9',

                      borderRadius:
                        '999px',

                      color:
                        '#334155',

                      fontSize:
                        '12px',

                      fontWeight:
                        600
                    }}
                  >
                    {
                      modulo.duracaoMin
                    } min
                  </span>

                  {
                    modulo.obrigatorio &&
                    (
                      <span
                        style={{
                          padding:
                            '4px 8px',

                          background:
                            '#FFF4CE',

                          borderRadius:
                            '999px',

                          color:
                            '#6A4B00',

                          fontSize:
                            '12px',

                          fontWeight:
                            700
                        }}
                      >
                        Obrigatório
                      </span>
                    )
                  }

                </div>

              </div>

            </div>

            <span
              style={{
                padding:
                  '6px 10px',

                borderRadius:
                  '999px',

                background:
                  status.fundo,

                color:
                  status.cor,

                fontSize:
                  '12px',

                fontWeight:
                  700,

                whiteSpace:
                  'nowrap'
              }}
            >
              {
                status.texto
              }
            </span>

          </div>

          {
            modulo.descricao &&
            (
              <p
                style={{
                  margin:
                    '16px 0 0',

                  color:
                    '#475569',

                  lineHeight:
                    1.55,

                  fontSize:
                    '14px'
                }}
              >
                {
                  modulo.descricao
                }
              </p>
            )
          }

          <div
            style={{
              marginTop:
                '18px',

              paddingTop:
                '14px',

              borderTop:
                '1px solid #EDF1F5',

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

            <div
              style={{
                color:
                  '#64748B',

                fontSize:
                  '12px'
              }}
            >
              {
                concluido
                  ? '✓ Este módulo já foi concluído.'
                  : emAndamento
                    ? 'Continue o módulo de onde parou.'
                    : treinamentoEmAndamento
                      ? 'Pronto para iniciar.'
                      : 'Inicie o treinamento para liberar este módulo.'
              }
            </div>

            <div
              style={{
                display:
                  'flex',

                gap:
                  '8px',

                flexWrap:
                  'wrap'
              }}
            >

              {
                modulo.urlConteudo &&
                (
                  <a
                    href={
                      modulo.urlConteudo
                    }
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding:
                        '9px 13px',

                      border:
                        '1px solid #0B5CAB',

                      borderRadius:
                        '8px',

                      textDecoration:
                        'none',

                      color:
                        '#0B5CAB',

                      fontWeight:
                        700,

                      fontSize:
                        '13px'
                    }}
                  >
                    Abrir material ↗
                  </a>
                )
              }

              {
                !concluido &&
                !emAndamento &&
                (
                  <button
                    type="button"
                    disabled={
                      !podeIniciar
                    }
                    onClick={() =>
                      onAbrir(
                        modulo
                      )
                    }
                    style={{
                      padding:
                        '9px 15px',

                      border:
                        0,

                      borderRadius:
                        '8px',

                      background:
                        podeIniciar
                          ? '#0B5CAB'
                          : '#CBD5E1',

                      color:
                        '#FFFFFF',

                      cursor:
                        podeIniciar
                          ? 'pointer'
                          : 'not-allowed',

                      fontWeight:
                        700,

                      fontSize:
                        '13px'
                    }}
                  >
                    {
                      processando
                        ? 'Iniciando...'
                        : 'Iniciar módulo →'
                    }
                  </button>
                )
              }

              {
                emAndamento &&
                (
                  <>
                    <button
                      type="button"
                      disabled={
                        processando
                      }
                      onClick={() =>
                        onAbrir(
                          modulo
                        )
                      }
                      style={{
                        padding:
                          '9px 15px',

                        border:
                          '1px solid #0B5CAB',

                        borderRadius:
                          '8px',

                        background:
                          '#FFFFFF',

                        color:
                          '#0B5CAB',

                        cursor:
                          'pointer',

                        fontWeight:
                          700
                      }}
                    >
                      Continuar módulo
                    </button>

                    <button
                      type="button"
                      disabled={
                        processando
                      }
                      onClick={() =>
                        onConcluir(
                          modulo
                        )
                      }
                      style={{
                        padding:
                          '9px 15px',

                        border:
                          0,

                        borderRadius:
                          '8px',

                        background:
                          '#13795B',

                        color:
                          '#FFFFFF',

                        cursor:
                          'pointer',

                        fontWeight:
                          700
                      }}
                    >
                      {
                        processando
                          ? 'Processando...'
                          : 'Concluir módulo ✓'
                      }
                    </button>
                  </>
                )
              }

              {
                concluido &&
                (
                  <span
                    style={{
                      padding:
                        '9px 13px',

                      borderRadius:
                        '8px',

                      background:
                        '#E7F5EE',

                      color:
                        '#13795B',

                      fontWeight:
                        700,

                      fontSize:
                        '13px'
                    }}
                  >
                    ✓ Módulo concluído
                  </span>
                )
              }

            </div>

          </div>

        </div>

      </article>
    );
  };

export default ModuleCard;
