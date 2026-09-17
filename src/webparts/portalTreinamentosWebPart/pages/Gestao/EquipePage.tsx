import * as React from 'react';

import {
  IColaborador
} from '../../models/Usuario';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface IEquipePageProps {
  colaboradores?: IColaborador[];
  carregando?: boolean;
  erro?: string;
  onVoltar: () => void;
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

const Indicador: React.FC<{
  titulo: string;
  valor: number;
}> = ({
  titulo,
  valor
}) => (
  <div
    style={{
      padding: '17px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px'
    }}
  >
    <span
      style={{
        display: 'block',
        color: '#64748b',
        fontSize: '13px'
      }}
    >
      {titulo}
    </span>

    <strong
      style={{
        display: 'block',
        marginTop: '5px',
        color: '#0b1f3a',
        fontSize: '24px'
      }}
    >
      {valor}
    </strong>
  </div>
);

const Cabecalho: React.FC<{
  children: React.ReactNode;
}> = ({
  children
}) => (
  <th
    style={{
      padding: '13px 14px',
      textAlign: 'left',
      fontSize: '12px',
      color: '#475569',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    {children}
  </th>
);

const Celula: React.FC<{
  children: React.ReactNode;
}> = ({
  children
}) => (
  <td
    style={{
      padding: '14px',
      color: '#334155',
      fontSize: '13px'
    }}
  >
    {children}
  </td>
);

// ============================================================
// PÁGINA
// ============================================================

const EquipePage:
  React.FC<IEquipePageProps> = ({
    colaboradores = [],
    carregando = false,
    erro = '',
    onVoltar
  }) => {

    const [
      pesquisa,
      setPesquisa
    ] = React.useState('');

    // ==========================================================
    // FILTRO
    // ==========================================================

    const listaFiltrada =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          if (!termo) {
            return colaboradores;
          }

          return colaboradores.filter(
            item => {

              const nome =
                item.nome
                  .toLowerCase();

              const email =
                (
                  item.email ||
                  ''
                ).toLowerCase();

              const funcao =
                (
                  item.funcao ||
                  ''
                ).toLowerCase();

              const setor =
                (
                  item.setor ||
                  ''
                ).toLowerCase();

              return (
                nome.includes(termo) ||
                email.includes(termo) ||
                funcao.includes(termo) ||
                setor.includes(termo)
              );
            }
          );
        },
        [
          colaboradores,
          pesquisa
        ]
      );

    // ==========================================================
    // INDICADORES
    // ==========================================================

    const totalConcluidos =
      colaboradores.reduce(
        (
          total,
          item
        ) =>
          total +
          item.concluidos,
        0
      );

    const totalPendentes =
      colaboradores.reduce(
        (
          total,
          item
        ) =>
          total +
          item.pendentes,
        0
      );

    const totalVencidos =
      colaboradores.reduce(
        (
          total,
          item
        ) =>
          total +
          (
            item.vencidos ||
            0
          ),
        0
      );

    // ==========================================================
    // CARREGANDO
    // ==========================================================

    if (carregando) {

      return (
        <section>

          <PageHeader
            titulo="Minha equipe"
            subtitulo="Carregando dados dos colaboradores..."
            acao={
              <button
                type="button"
                onClick={onVoltar}
              >
                Voltar
              </button>
            }
          />

          <div
            style={{
              padding: '30px',
              textAlign: 'center',
              color: '#64748b'
            }}
          >
            Carregando equipe...
          </div>

        </section>
      );
    }

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
      <section>

        <PageHeader
          titulo="Minha equipe"
          subtitulo="Acompanhe progresso, pendências e conformidade dos colaboradores."
          acao={
            <button
              type="button"
              onClick={onVoltar}
            >
              Voltar
            </button>
          }
        />

        {/* ERRO */}

        {erro && (
          <div
            style={{
              marginBottom: '18px',
              padding: '14px 16px',
              background: '#fde7e9',
              border: '1px solid #f1aeb5',
              borderRadius: '10px',
              color: '#a4262c'
            }}
          >
            {erro}
          </div>
        )}

        {/* INDICADORES */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '22px'
          }}
        >
          <Indicador
            titulo="Colaboradores"
            valor={colaboradores.length}
          />

          <Indicador
            titulo="Concluídos"
            valor={totalConcluidos}
          />

          <Indicador
            titulo="Pendentes"
            valor={totalPendentes}
          />

          <Indicador
            titulo="Vencidos"
            valor={totalVencidos}
          />
        </div>

        {/* PESQUISA */}

        <div
          style={{
            marginBottom: '18px'
          }}
        >
          <input
            type="search"
            placeholder="Pesquisar colaborador..."
            value={pesquisa}
            onChange={
              event =>
                setPesquisa(
                  event.target.value
                )
            }
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '11px 14px',
              border:
                '1px solid #d8dee8',
              borderRadius: '9px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* SEM RESULTADOS */}

        {listaFiltrada.length === 0 ? (

          <EmptyState
            titulo={
              pesquisa
                ? 'Nenhum colaborador encontrado'
                : 'Nenhum colaborador carregado'
            }
            descricao={
              pesquisa
                ? 'Tente pesquisar por outro nome, e-mail, função ou setor.'
                : 'Os colaboradores cadastrados no Dataverse serão exibidos aqui.'
            }
          />

        ) : (

          // ====================================================
          // TABELA
          // ====================================================

          <div
            style={{
              overflowX: 'auto',
              background: '#ffffff',
              border:
                '1px solid #e5e7eb',
              borderRadius: '14px'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse:
                  'collapse'
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      '#f8fafc'
                  }}
                >
                  <Cabecalho>
                    Colaborador
                  </Cabecalho>

                  <Cabecalho>
                    Função
                  </Cabecalho>

                  <Cabecalho>
                    Setor
                  </Cabecalho>

                  <Cabecalho>
                    Concluídos
                  </Cabecalho>

                  <Cabecalho>
                    Pendentes
                  </Cabecalho>

                  <Cabecalho>
                    Vencidos
                  </Cabecalho>

                  <Cabecalho>
                    Total
                  </Cabecalho>

                  <Cabecalho>
                    Conformidade
                  </Cabecalho>
                </tr>
              </thead>

              <tbody>

                {listaFiltrada.map(
                  item => (

                    <tr
                      key={
                        String(
                          item.id
                        )
                      }
                      style={{
                        borderTop:
                          '1px solid #edf0f4'
                      }}
                    >

                      {/* COLABORADOR */}

                      <Celula>

                        <strong
                          style={{
                            display: 'block',
                            color: '#1f2937'
                          }}
                        >
                          {item.nome}
                        </strong>

                        {item.email && (
                          <span
                            style={{
                              display: 'block',
                              color: '#64748b',
                              fontSize: '12px',
                              marginTop: '3px'
                            }}
                          >
                            {item.email}
                          </span>
                        )}

                      </Celula>

                      {/* FUNÇÃO */}

                      <Celula>
                        {
                          item.funcao ||
                          '-'
                        }
                      </Celula>

                      {/* SETOR */}

                      <Celula>
                        {
                          item.setor ||
                          '-'
                        }
                      </Celula>

                      {/* CONCLUÍDOS */}

                      <Celula>
                        <span
                          style={{
                            color: '#16825d',
                            fontWeight: 700
                          }}
                        >
                          {item.concluidos}
                        </span>
                      </Celula>

                      {/* PENDENTES */}

                      <Celula>
                        <span
                          style={{
                            color: '#b45309',
                            fontWeight: 700
                          }}
                        >
                          {item.pendentes}
                        </span>
                      </Celula>

                      {/* VENCIDOS */}

                      <Celula>
                        <span
                          style={{
                            color: '#a4262c',
                            fontWeight: 700
                          }}
                        >
                          {
                            item.vencidos ||
                            0
                          }
                        </span>
                      </Celula>

                      {/* TOTAL */}

                      <Celula>
                        {
                          item.total ??
                          (
                            item.concluidos +
                            item.pendentes +
                            (
                              item.vencidos ||
                              0
                            )
                          )
                        }
                      </Celula>

                      {/* CONFORMIDADE */}

                      <Celula>

                        <span
                          style={{
                            display:
                              'inline-block',
                            padding:
                              '5px 9px',
                            borderRadius:
                              '20px',
                            background:
                              '#e8f2ff',
                            color:
                              '#0f6cbd',
                            fontWeight:
                              700
                          }}
                        >
                          {
                            item.conformidade
                          }
                        </span>

                      </Celula>

                    </tr>
                  )
                )}

              </tbody>
            </table>
          </div>
        )}

      </section>
    );
  };

export default EquipePage;