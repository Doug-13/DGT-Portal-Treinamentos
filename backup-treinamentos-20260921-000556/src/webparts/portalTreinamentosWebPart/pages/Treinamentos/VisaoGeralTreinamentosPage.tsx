import * as React from 'react';

import {
  ITreinamento
} from '../../models/Treinamento';

import Loading from
  '../../components/common/Loading';

import EmptyState from
  '../../components/common/EmptyState';

import ErrorMessage from
  '../../components/common/ErrorMessage';

import TreinamentoCard from
  '../../components/treinamentos/TreinamentoCard';

export interface IVisaoGeralTreinamentosPageProps {

  treinamentos:
    ITreinamento[];

  carregando:
    boolean;

  erro:
    string;

  quantidadeTrilhas:
    number;

  onAbrirTreinamento:
    (
      treinamento:
        ITreinamento
    ) => void;

  onVerTreinamentos:
    () => void;
}

const indicador:
  React.CSSProperties = {

  padding:
    '16px 18px',

  border:
    '1px solid #E4EAF0',

  borderRadius:
    '12px',

  background:
    '#FFFFFF'
};

const VisaoGeralTreinamentosPage:
  React.FC<
    IVisaoGeralTreinamentosPageProps
  > = ({
    treinamentos,
    carregando,
    erro,
    quantidadeTrilhas,
    onAbrirTreinamento,
    onVerTreinamentos
  }) => {

    const concluidos =
      treinamentos.filter(
        item =>
          item.status ===
          'Concluído'
      ).length;

    const andamento =
      treinamentos.filter(
        item =>
          item.status ===
          'Em andamento'
      ).length;

    const pendentes =
      treinamentos.filter(
        item =>
          item.status ===
          'Disponível'
      ).length;

    const vencidos =
      treinamentos.filter(
        item =>
          item.status ===
          'Vencido'
      ).length;

    const continuar =
      treinamentos.find(
        item =>
          item.status ===
          'Em andamento'
      );

    return (
      <section>

        <div>
          <h1
            style={{
              margin:
                0,

              color:
                '#0B2D4D'
            }}
          >
            Visão geral
          </h1>

          <p
            style={{
              margin:
                '5px 0 0',

              color:
                '#64748B'
            }}
          >
            Acompanhe sua jornada de aprendizagem, pendências e trilhas.
          </p>
        </div>

        {
          erro &&
          (
            <div
              style={{
                marginTop:
                  '16px'
              }}
            >
              <ErrorMessage
                mensagem={
                  erro
                }
              />
            </div>
          )
        }

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(5,minmax(130px,1fr))',

            gap:
              '12px',

            marginTop:
              '18px'
          }}
        >
          <div style={indicador}>
            <small>Concluídos</small>
            <strong style={{ display: 'block', fontSize: '25px', marginTop: '5px' }}>
              {concluidos}
            </strong>
          </div>

          <div style={indicador}>
            <small>Em andamento</small>
            <strong style={{ display: 'block', fontSize: '25px', marginTop: '5px' }}>
              {andamento}
            </strong>
          </div>

          <div style={indicador}>
            <small>Pendentes</small>
            <strong style={{ display: 'block', fontSize: '25px', marginTop: '5px' }}>
              {pendentes}
            </strong>
          </div>

          <div style={indicador}>
            <small>Vencidos</small>
            <strong style={{ display: 'block', fontSize: '25px', marginTop: '5px' }}>
              {vencidos}
            </strong>
          </div>

          <div style={indicador}>
            <small>Trilhas</small>
            <strong style={{ display: 'block', fontSize: '25px', marginTop: '5px' }}>
              {quantidadeTrilhas}
            </strong>
          </div>
        </div>

        {
          carregando
            ? (
              <div
                style={{
                  marginTop:
                    '20px'
                }}
              >
                <Loading
                  mensagem="Carregando treinamentos..."
                />
              </div>
            )
            : (
              <>
                <div
                  style={{
                    marginTop:
                      '18px',

                    padding:
                      '18px',

                    border:
                      '1px solid #E4EAF0',

                    borderRadius:
                      '14px',

                    background:
                      '#FFFFFF'
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',

                      justifyContent:
                        'space-between',

                      alignItems:
                        'center',

                      gap:
                        '12px'
                    }}
                  >
                    <strong>
                      Continuar treinamento
                    </strong>

                    <button
                      type="button"
                      onClick={
                        onVerTreinamentos
                      }
                      style={{
                        border:
                          0,

                        background:
                          'transparent',

                        color:
                          '#0867D7',

                        cursor:
                          'pointer',

                        fontWeight:
                          700
                      }}
                    >
                      Ver todos →
                    </button>
                  </div>

                  {
                    continuar
                      ? (
                        <div
                          style={{
                            display:
                              'grid',

                            gridTemplateColumns:
                              '180px 1fr auto',

                            gap:
                              '16px',

                            alignItems:
                              'center',

                            marginTop:
                              '14px'
                          }}
                        >
                          <img
                            src={
                              continuar.imagem
                            }
                            alt=""
                            style={{
                              width:
                                '180px',

                              height:
                                '96px',

                              objectFit:
                                'cover',

                              borderRadius:
                                '9px'
                            }}
                          />

                          <div>
                            <strong
                              style={{
                                color:
                                  '#0B2D4D'
                              }}
                            >
                              {
                                continuar.nome
                              }
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  '7px',

                                height:
                                  '8px',

                                borderRadius:
                                  '999px',

                                background:
                                  '#E3E9EE',

                                overflow:
                                  'hidden'
                              }}
                            >
                              <div
                                style={{
                                  width:
                                    `${continuar.progresso}%`,

                                  height:
                                    '100%',

                                  background:
                                    '#0B85E5'
                                }}
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onAbrirTreinamento(
                                continuar
                              )
                            }
                          >
                            Continuar →
                          </button>
                        </div>
                      )
                      : (
                        <div
                          style={{
                            marginTop:
                              '14px'
                          }}
                        >
                          <EmptyState
                            titulo="Nenhum treinamento em andamento"
                          />
                        </div>
                      )
                  }
                </div>

                <div
                  style={{
                    marginTop:
                      '18px'
                  }}
                >
                  <strong>
                    Meus treinamentos
                  </strong>

                  <div
                    style={{
                      display:
                        'grid',

                      gridTemplateColumns:
                        'repeat(4,minmax(0,1fr))',

                      gap:
                        '12px',

                      marginTop:
                        '12px'
                    }}
                  >
                    {
                      treinamentos
                        .slice(
                          0,
                          4
                        )
                        .map(
                          treinamento => (
                            <TreinamentoCard
                              key={
                                `${treinamento.id}-${treinamento.usuarioTreinamentoId || ''}`
                              }
                              treinamento={
                                treinamento
                              }
                              modo="compacto"
                              onAbrir={
                                onAbrirTreinamento
                              }
                            />
                          )
                        )
                    }
                  </div>
                </div>
              </>
            )
        }

      </section>
    );
  };

export default VisaoGeralTreinamentosPage;
