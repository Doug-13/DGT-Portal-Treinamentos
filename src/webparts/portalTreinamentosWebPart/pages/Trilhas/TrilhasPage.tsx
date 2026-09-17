import * as React from 'react';

import {
  ITrilha
} from '../../models/Trilha';

import {
  ITreinamento
} from '../../models/Treinamento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface ITrilhasPageProps {
  trilhas: ITrilha[];

  carregando?: boolean;

  erro?: string;

  onAbrirTreinamento?:
    (treinamento: ITreinamento) => void;
}

const obterCorStatus = (
  status: string
): string => {

  switch (status) {

    case 'Concluído':
      return '#16825d';

    case 'Em andamento':
      return '#1677ff';

    case 'Disponível':
      return '#0f6cbd';

    case 'Reprovado':
      return '#d83b01';

    case 'Vencido':
      return '#a4262c';

    case 'Bloqueado':
      return '#8a8886';

    default:
      return '#605e5c';
  }
};

const obterIconeStatus = (
  status: string
): string => {

  switch (status) {

    case 'Concluído':
      return '✓';

    case 'Em andamento':
      return '▶';

    case 'Disponível':
      return '●';

    case 'Reprovado':
      return '!';

    case 'Vencido':
      return '⌛';

    case 'Bloqueado':
      return '🔒';

    default:
      return '○';
  }
};

const TrilhasPage:
  React.FC<ITrilhasPageProps> = ({
    trilhas,
    carregando = false,
    erro = '',
    onAbrirTreinamento
  }) => {

    if (carregando) {
      return (
        <section>
          <PageHeader
            titulo="Trilhas"
            subtitulo="Carregando suas trilhas de aprendizagem..."
          />

          <div
            style={{
              padding: '32px',
              textAlign: 'center'
            }}
          >
            Carregando trilhas...
          </div>
        </section>
      );
    }

    if (erro) {
      return (
        <section>
          <PageHeader
            titulo="Trilhas"
            subtitulo="Não foi possível carregar suas trilhas."
          />

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#fde7e9',
              color: '#a4262c'
            }}
          >
            {erro}
          </div>
        </section>
      );
    }

    return (
      <section>

        <PageHeader
          titulo="Trilhas"
          subtitulo={
            trilhas.length === 1
              ? 'Você possui 1 trilha de aprendizagem vinculada.'
              : `Você possui ${trilhas.length} trilhas de aprendizagem vinculadas.`
          }
        />

        {trilhas.length === 0 ? (

          <EmptyState
            titulo="Nenhuma trilha vinculada"
            descricao="Quando uma trilha for atribuída a você, ela será exibida nesta página."
          />

        ) : (

          <div
            style={{
              display: 'grid',
              gap: '20px'
            }}
          >

            {trilhas.map(trilha => (

              <article
                key={trilha.id}
                style={{
                  background: '#ffffff',
                  border:
                    '1px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow:
                    '0 4px 18px rgba(15, 23, 42, 0.06)'
                }}
              >

                {/* CABEÇALHO */}

                <div
                  style={{
                    padding: '22px 24px',
                    borderBottom:
                      '1px solid #edf0f4'
                  }}
                >

                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems:
                        'flex-start',
                      gap: '20px',
                      flexWrap: 'wrap'
                    }}
                  >

                    <div>

                      <h3
                        style={{
                          margin: 0,
                          fontSize: '20px',
                          color: '#0b1f3a'
                        }}
                      >
                        {trilha.nome}
                      </h3>

                      {trilha.descricao && (
                        <p
                          style={{
                            margin:
                              '6px 0 0',
                            color: '#64748b'
                          }}
                        >
                          {trilha.descricao}
                        </p>
                      )}

                    </div>

                    <div
                      style={{
                        minWidth: '160px',
                        textAlign: 'right'
                      }}
                    >

                      <strong
                        style={{
                          display: 'block',
                          fontSize: '20px',
                          color: '#1677ff'
                        }}
                      >
                        {trilha.progresso}%
                      </strong>

                      <span
                        style={{
                          color: '#64748b',
                          fontSize: '13px'
                        }}
                      >
                        {trilha.concluidos}
                        {' de '}
                        {trilha.total}
                        {' concluídos'}
                      </span>

                    </div>

                  </div>

                  {/* PROGRESSO */}

                  <div
                    style={{
                      marginTop: '16px',
                      height: '8px',
                      borderRadius: '10px',
                      background: '#e8edf4',
                      overflow: 'hidden'
                    }}
                  >

                    <div
                      style={{
                        width:
                          `${trilha.progresso}%`,
                        height: '100%',
                        background:
                          '#1677ff',
                        borderRadius: '10px',
                        transition:
                          'width 0.3s ease'
                      }}
                    />

                  </div>

                </div>

                {/* CURSOS */}

                <div
                  style={{
                    padding:
                      '8px 24px 20px'
                  }}
                >

                  {trilha.treinamentos.length === 0 ? (

                    <p
                      style={{
                        color: '#64748b'
                      }}
                    >
                      Nenhum treinamento
                      cadastrado nesta trilha.
                    </p>

                  ) : (

                    trilha.treinamentos.map(
                      item => {

                        const treinamento =
                          item.treinamento;

                        const podeAbrir =
                          treinamento &&
                          item.status !==
                            'Bloqueado';

                        return (

                          <div
                            key={
                              item.id ||
                              `${trilha.id}-${item.treinamentoId}`
                            }
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                '46px 1fr auto',
                              gap: '14px',
                              alignItems: 'center',
                              padding:
                                '15px 0',
                              borderBottom:
                                '1px solid #edf0f4'
                            }}
                          >

                            {/* ORDEM */}

                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius:
                                  '50%',
                                background:
                                  '#f1f5f9',
                                display: 'flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                fontWeight: 700,
                                color:
                                  '#0b1f3a'
                              }}
                            >
                              {item.ordem}
                            </div>

                            {/* DADOS */}

                            <div>

                              <strong
                                style={{
                                  display:
                                    'block',
                                  color:
                                    '#1f2937',
                                  fontSize:
                                    '15px'
                                }}
                              >
                                {treinamento?.nome ||
                                  'Treinamento'}
                              </strong>

                              <div
                                style={{
                                  display:
                                    'flex',
                                  gap: '10px',
                                  marginTop:
                                    '5px',
                                  flexWrap:
                                    'wrap',
                                  fontSize:
                                    '12px',
                                  color:
                                    '#64748b'
                                }}
                              >

                                {treinamento?.codigo && (
                                  <span>
                                    {
                                      treinamento.codigo
                                    }
                                  </span>
                                )}

                                {treinamento?.cargaHoraria && (
                                  <span>
                                    {
                                      treinamento.cargaHoraria
                                    }
                                  </span>
                                )}

                                {item.obrigatorio && (
                                  <span>
                                    Obrigatório
                                  </span>
                                )}

                              </div>

                            </div>

                            {/* STATUS */}

                            <div
                              style={{
                                display: 'flex',
                                alignItems:
                                  'center',
                                gap: '10px'
                              }}
                            >

                              <span
                                style={{
                                  color:
                                    obterCorStatus(
                                      item.status
                                    ),
                                  fontWeight:
                                    600,
                                  fontSize:
                                    '13px',
                                  whiteSpace:
                                    'nowrap'
                                }}
                              >
                                {
                                  obterIconeStatus(
                                    item.status
                                  )
                                }
                                {' '}
                                {item.status}
                              </span>

                              {podeAbrir &&
                                onAbrirTreinamento && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        treinamento
                                      ) {
                                        onAbrirTreinamento(
                                          {
                                            ...treinamento,
                                            status:
                                              item.status,
                                            progresso:
                                              item.progresso,
                                            usuarioTreinamentoId:
                                              item.usuarioTreinamentoId
                                          }
                                        );
                                      }
                                    }}
                                    style={{
                                      border:
                                        'none',
                                      background:
                                        '#1677ff',
                                      color:
                                        '#ffffff',
                                      borderRadius:
                                        '8px',
                                      padding:
                                        '8px 13px',
                                      cursor:
                                        'pointer',
                                      fontWeight:
                                        600
                                    }}
                                  >
                                    Abrir
                                  </button>
                                )}

                            </div>

                          </div>
                        );
                      }
                    )
                  )}

                </div>

              </article>
            ))}

          </div>
        )}

      </section>
    );
  };

export default TrilhasPage;