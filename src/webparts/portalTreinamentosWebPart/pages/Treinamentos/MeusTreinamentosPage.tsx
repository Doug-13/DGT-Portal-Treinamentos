import * as React from 'react';

import {
  ITreinamento,
  StatusTreinamento
} from '../../models/Treinamento';

import TreinamentoCard from
  '../../components/treinamentos/TreinamentoCard';

import Loading from
  '../../components/common/Loading';

import EmptyState from
  '../../components/common/EmptyState';

import ErrorMessage from
  '../../components/common/ErrorMessage';

// ============================================================
// PROPS
// ============================================================

export interface IMeusTreinamentosPageProps {
  treinamentos: ITreinamento[];

  carregando: boolean;

  erro: string;

  onAbrirTreinamento: (
    treinamento: ITreinamento
  ) => void;
}

// ============================================================
// FILTROS
// ============================================================

type Ordenacao =
  | 'recomendada'
  | 'nome'
  | 'progresso';

// Ordem e cores das "pílulas" de status (mesmas cores do card).
const STATUS_FILTRO: Array<{
  status: StatusTreinamento;
  cor: string;
  fundo: string;
}> = [
  { status: 'Em andamento', cor: '#A46600', fundo: '#FFF3DE' },
  { status: 'Disponível', cor: '#176ED1', fundo: '#EAF4FF' },
  { status: 'Vencido', cor: '#B04A32', fundo: '#FDECE7' },
  { status: 'Reprovado', cor: '#C43131', fundo: '#FFE9EE' },
  { status: 'Bloqueado', cor: '#657789', fundo: '#F1F5F9' },
  { status: 'Concluído', cor: '#087653', fundo: '#E8F8F1' },
  { status: 'Cancelado', cor: '#52687D', fundo: '#F1F5F9' }
];

// "Recomendada": o que exige ação primeiro.
const PRIORIDADE_STATUS: Record<string, number> = {
  'Em andamento': 1,
  'Vencido': 2,
  'Reprovado': 3,
  'Disponível': 4,
  'Bloqueado': 5,
  'Concluído': 6,
  'Cancelado': 7
};

const normalizar = (
  valor?: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const campo: React.CSSProperties = {
  height: '38px',
  padding: '0 12px',
  boxSizing: 'border-box',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  background: '#FFFFFF',
  color: '#1F2937',
  fontSize: '13px',
  fontFamily: 'inherit'
};

// ============================================================
// CABEÇALHO
// ============================================================

const Cabecalho: React.FC = () => (
  <div
    style={{
      marginBottom: 14
    }}
  >
    <h1
      style={{
        margin: '0 0 4px'
      }}
    >
      Meus treinamentos
    </h1>

    <p
      style={{
        margin: 0,
        color: '#61768b'
      }}
    >
      Acompanhe seus treinamentos disponíveis,
      em andamento, concluídos e bloqueados.
    </p>
  </div>
);

// ============================================================
// COMPONENTE
// ============================================================

const MeusTreinamentosPage:
  React.FC<IMeusTreinamentosPageProps> = ({
    treinamentos,
    carregando,
    erro,
    onAbrirTreinamento
  }) => {

  const [pesquisa, setPesquisa] =
    React.useState('');

  // Vazio = todos os status.
  const [statusSelecionados, setStatusSelecionados] =
    React.useState<StatusTreinamento[]>([]);

  const [ordenacao, setOrdenacao] =
    React.useState<Ordenacao>('recomendada');

  // Quantidade por status (para as pílulas).
  const contagem =
    React.useMemo(
      () => {
        const resultado: Record<string, number> = {};

        treinamentos.forEach(
          treinamento => {
            resultado[treinamento.status] =
              (resultado[treinamento.status] || 0) + 1;
          }
        );

        return resultado;
      },
      [
        treinamentos
      ]
    );

  const alternarStatus = (
    status: StatusTreinamento
  ): void =>
    setStatusSelecionados(
      atual =>
        atual.indexOf(status) >= 0
          ? atual.filter(item => item !== status)
          : [...atual, status]
    );

  const filtrados =
    React.useMemo(
      () => {

        const termo =
          normalizar(pesquisa);

        const lista =
          treinamentos.filter(
            treinamento => {

              const texto =
                normalizar(
                  [
                    treinamento.nome,
                    treinamento.codigo,
                    treinamento.descricao
                  ].join(' ')
                );

              return (
                (!termo || texto.indexOf(termo) >= 0) &&
                (
                  statusSelecionados.length === 0 ||
                  statusSelecionados.indexOf(treinamento.status) >= 0
                )
              );
            }
          );

        if (ordenacao === 'nome') {
          return lista
            .slice()
            .sort(
              (a, b) =>
                (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
            );
        }

        if (ordenacao === 'progresso') {
          return lista
            .slice()
            .sort(
              (a, b) =>
                (b.progresso || 0) - (a.progresso || 0)
            );
        }

        // Recomendada: status que pedem ação primeiro; dentro do
        // mesmo status, mantém a ordem original (ordem da trilha).
        return lista
          .map((item, indice) => ({ item, indice }))
          .sort(
            (a, b) =>
              (PRIORIDADE_STATUS[a.item.status] || 9) -
              (PRIORIDADE_STATUS[b.item.status] || 9) ||
              a.indice - b.indice
          )
          .map(registro => registro.item);
      },
      [
        treinamentos,
        pesquisa,
        statusSelecionados,
        ordenacao
      ]
    );

  const temFiltro =
    !!pesquisa.trim() ||
    statusSelecionados.length > 0 ||
    ordenacao !== 'recomendada';

  const limparFiltros = (): void => {
    setPesquisa('');
    setStatusSelecionados([]);
    setOrdenacao('recomendada');
  };

  // ==========================================================
  // CARREGANDO
  // ==========================================================

  if (
    carregando
  ) {

    return (
      <section>
        <Cabecalho />

        <Loading
          mensagem="Carregando treinamentos..."
        />
      </section>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section>

      <Cabecalho />

      {
        erro && (
          <ErrorMessage
            mensagem={erro}
          />
        )
      }

      {
        treinamentos.length === 0
          ? (
            <EmptyState
              titulo="Nenhum treinamento atribuído"
            />
          )
          : (
            <>
              {/* ==================================================
                  FILTROS
              ================================================== */}

              <div
                style={{
                  padding: '12px 14px',
                  marginBottom: '14px',
                  background: '#FFFFFF',
                  border: '1px solid #E3EAF1',
                  borderRadius: '12px'
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1fr) 190px',
                    gap: '10px'
                  }}
                >
                  <input
                    type="search"
                    value={pesquisa}
                    onChange={event => setPesquisa(event.target.value)}
                    placeholder="Pesquisar por nome, código ou descrição..."
                    aria-label="Pesquisar treinamentos"
                    style={campo}
                  />

                  <select
                    value={ordenacao}
                    onChange={event => setOrdenacao(event.target.value as Ordenacao)}
                    aria-label="Ordenar treinamentos"
                    style={campo}
                  >
                    <option value="recomendada">Ordenar: prioridade</option>
                    <option value="nome">Ordenar: nome (A–Z)</option>
                    <option value="progresso">Ordenar: maior progresso</option>
                  </select>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginTop: '10px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStatusSelecionados([])}
                    aria-pressed={statusSelecionados.length === 0}
                    style={{
                      padding: '5px 12px',
                      border: statusSelecionados.length === 0
                        ? '1px solid #202A44'
                        : '1px solid #CBD5E1',
                      borderRadius: '999px',
                      background: statusSelecionados.length === 0 ? '#202A44' : '#FFFFFF',
                      color: statusSelecionados.length === 0 ? '#FFFFFF' : '#334155',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Todos ({treinamentos.length})
                  </button>

                  {
                    STATUS_FILTRO
                      .filter(item => (contagem[item.status] || 0) > 0)
                      .map(
                        item => {

                          const ativo =
                            statusSelecionados.indexOf(item.status) >= 0;

                          return (
                            <button
                              key={item.status}
                              type="button"
                              onClick={() => alternarStatus(item.status)}
                              aria-pressed={ativo}
                              style={{
                                padding: '5px 12px',
                                border: ativo
                                  ? `1px solid ${item.cor}`
                                  : '1px solid #E2E8F0',
                                borderRadius: '999px',
                                background: ativo ? item.cor : item.fundo,
                                color: ativo ? '#FFFFFF' : item.cor,
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {item.status} ({contagem[item.status]})
                            </button>
                          );
                        }
                      )
                  }

                  <span
                    style={{
                      marginLeft: 'auto',
                      color: '#64748B',
                      fontSize: '12px'
                    }}
                  >
                    {filtrados.length} de {treinamentos.length} treinamento(s)
                  </span>

                  {
                    temFiltro &&
                    (
                      <button
                        type="button"
                        onClick={limparFiltros}
                        style={{
                          padding: '5px 10px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Limpar filtros
                      </button>
                    )
                  }
                </div>
              </div>

              {/* ==================================================
                  LISTA
              ================================================== */}

              {
                filtrados.length === 0
                  ? (
                    <EmptyState
                      titulo="Nenhum treinamento encontrado"
                      descricao="Ajuste a pesquisa ou os filtros de status."
                    />
                  )
                  : (
                    <div
                      style={{
                        display: 'grid',

                        gridTemplateColumns:
                          'repeat(auto-fill,minmax(240px,1fr))',

                        gap: 14,

                        alignItems: 'stretch'
                      }}
                    >
                      {
                        filtrados.map(
                          treinamento => (
                            <TreinamentoCard
                              key={
                                `${
                                  treinamento.id
                                }-${
                                  treinamento.usuarioTreinamentoId ||
                                  ''
                                }`
                              }
                              treinamento={
                                treinamento
                              }
                              modo="completo"
                              onAbrir={
                                onAbrirTreinamento
                              }
                            />
                          )
                        )
                      }
                    </div>
                  )
              }
            </>
          )
      }

    </section>
  );
};

export default MeusTreinamentosPage;
