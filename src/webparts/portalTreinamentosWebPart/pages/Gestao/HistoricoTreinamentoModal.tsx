import * as React from 'react';

import {
  IEventoTreinamento,
  TipoEventoTreinamento
} from '../../services/TreinamentoHistoricoService';

// ============================================================
// HISTÓRICO DO TREINAMENTO (modal)
//
// Linha do tempo com todos os eventos do treinamento e da sua
// estrutura (módulos, avaliação, questões, documentos, trilhas):
// quem fez, quando, o quê, e o valor anterior/novo de cada campo.
// ============================================================

export interface IHistoricoTreinamentoModalProps {
  aberto: boolean;
  treinamentoNome: string;
  treinamentoCodigo: string;
  carregando: boolean;
  erro: string;
  eventos: IEventoTreinamento[];
  onFechar: () => void;
  onRecarregar: () => void;
}

const cores = {
  azul: '#0B5CAB',
  azulEscuro: '#0B2D4D',
  branco: '#FFFFFF',
  texto: '#18324A',
  textoSecundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9',
  ambar: '#B45309',
  ambarClaro: '#FFF4E5',
  cinzaClaro: '#EEF2F6'
};

const ROTULO_TIPO: Record<TipoEventoTreinamento, string> = {
  CRIACAO: 'Criação',
  ALTERACAO: 'Alteração',
  EXCLUSAO: 'Exclusão',
  OUTRO: 'Evento'
};

const COR_TIPO: Record<TipoEventoTreinamento, { fundo: string; texto: string }> = {
  CRIACAO: { fundo: cores.verdeClaro, texto: cores.verde },
  ALTERACAO: { fundo: '#EAF3FB', texto: cores.azul },
  EXCLUSAO: { fundo: cores.vermelhoClaro, texto: cores.vermelho },
  OUTRO: { fundo: cores.cinzaClaro, texto: cores.textoSecundario }
};

type Filtro = 'todos' | TipoEventoTreinamento;

const formatarData = (
  data?: Date
): string =>
  data
    ? data.toLocaleString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    )
    : '—';

const valorOuVazio = (
  valor: string
): string =>
  valor && valor.trim()
    ? valor
    : '(vazio)';

const botao: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: `1px solid ${cores.borda}`,
  background: cores.branco,
  color: cores.texto,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const HistoricoTreinamentoModal: React.FC<IHistoricoTreinamentoModalProps> = (
  props
) => {

  const [
    filtro,
    setFiltro
  ] = React.useState<Filtro>('todos');

  const [
    expandidos,
    setExpandidos
  ] = React.useState<Record<string, boolean>>({});

  React.useEffect(
    () => {
      if (props.aberto) {
        setFiltro('todos');
        setExpandidos({});
      }
    },
    [
      props.aberto
    ]
  );

  const eventosFiltrados =
    React.useMemo(
      () =>
        filtro === 'todos'
          ? props.eventos
          : props.eventos.filter(
            evento =>
              evento.tipo === filtro
          ),
      [
        filtro,
        props.eventos
      ]
    );

  if (!props.aberto) {
    return null;
  }

  const alternar = (
    id: string
  ): void =>
    setExpandidos(
      atual => ({
        ...atual,
        [id]: !atual[id]
      })
    );

  const filtros: Array<{ id: Filtro; rotulo: string }> = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'CRIACAO', rotulo: 'Criações' },
    { id: 'ALTERACAO', rotulo: 'Alterações' },
    { id: 'EXCLUSAO', rotulo: 'Exclusões' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Histórico do treinamento"
      onClick={props.onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 45, 77, 0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '880px',
          background: cores.branco,
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(11, 45, 77, 0.25)',
          color: cores.texto
        }}
      >

        {/* Cabeçalho */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${cores.borda}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'flex-start'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                color: cores.textoSecundario,
                fontWeight: 600,
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}
            >
              Histórico do treinamento
            </div>

            <h2
              style={{
                margin: '4px 0 0',
                fontSize: '19px',
                color: cores.azulEscuro
              }}
            >
              {props.treinamentoNome}
            </h2>

            {props.treinamentoCodigo && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '13px',
                  color: cores.textoSecundario,
                  fontWeight: 600
                }}
              >
                {props.treinamentoCodigo}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={props.onRecarregar}
              disabled={props.carregando}
              style={{ ...botao, opacity: props.carregando ? 0.6 : 1 }}
            >
              Atualizar
            </button>

            <button
              type="button"
              onClick={props.onFechar}
              style={botao}
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div
          style={{
            padding: '14px 24px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            borderBottom: `1px solid ${cores.borda}`,
            background: cores.fundo
          }}
        >
          {filtros.map(item => {
            const ativo = filtro === item.id;
            const quantidade =
              item.id === 'todos'
                ? props.eventos.length
                : props.eventos.filter(e => e.tipo === item.id).length;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltro(item.id)}
                style={{
                  ...botao,
                  padding: '6px 12px',
                  background: ativo ? cores.azulEscuro : cores.branco,
                  color: ativo ? cores.branco : cores.texto,
                  borderColor: ativo ? cores.azulEscuro : cores.borda
                }}
              >
                {item.rotulo} ({quantidade})
              </button>
            );
          })}
        </div>

        {/* Corpo */}
        <div style={{ padding: '20px 24px 26px' }}>

          {props.erro && (
            <div
              style={{
                padding: '12px 14px',
                background: cores.vermelhoClaro,
                color: cores.vermelho,
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px'
              }}
            >
              {props.erro}
            </div>
          )}

          {props.carregando && (
            <div style={{ color: cores.textoSecundario, fontSize: '14px' }}>
              Carregando histórico...
            </div>
          )}

          {!props.carregando && !props.erro && eventosFiltrados.length === 0 && (
            <div
              style={{
                padding: '22px',
                textAlign: 'center',
                color: cores.textoSecundario,
                background: cores.fundo,
                borderRadius: '10px',
                fontSize: '14px',
                lineHeight: 1.5
              }}
            >
              Nenhum evento registrado{filtro !== 'todos' ? ' neste filtro' : ''}.
              <br />
              <small>
                O histórico passa a ser registrado a partir da ativação do
                plugin de auditoria. Alterações anteriores não aparecem aqui.
              </small>
            </div>
          )}

          {!props.carregando && eventosFiltrados.length > 0 && (
            <ol
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                borderLeft: `2px solid ${cores.borda}`,
                marginLeft: '8px'
              }}
            >
              {eventosFiltrados.map(evento => {
                const cor = COR_TIPO[evento.tipo];
                const aberto = !!expandidos[evento.id];
                const temAlteracoes = evento.alteracoes.length > 0;

                return (
                  <li
                    key={evento.id}
                    style={{
                      position: 'relative',
                      padding: '0 0 18px 20px'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: '-7px',
                        top: '4px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: cor.texto,
                        border: `2px solid ${cores.branco}`
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: cor.fundo,
                          color: cor.texto
                        }}
                      >
                        {ROTULO_TIPO[evento.tipo]}
                      </span>

                      {evento.tabelaRotulo && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: cores.cinzaClaro,
                            color: cores.textoSecundario
                          }}
                        >
                          {evento.tabelaRotulo}
                        </span>
                      )}

                      <span style={{ fontSize: '12px', color: cores.textoSecundario }}>
                        {formatarData(evento.data)} · {evento.usuario}
                      </span>

                      {!evento.registradoPeloServidor && evento.origem && (
                        <span
                          title="Evento registrado pelo portal, não pelo plugin de auditoria do servidor."
                          style={{ fontSize: '11px', color: cores.ambar }}
                        >
                          ({evento.origem})
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '14px',
                        fontWeight: 600
                      }}
                    >
                      {evento.titulo}
                    </div>

                    {evento.descricao && (
                      <div
                        style={{
                          marginTop: '2px',
                          fontSize: '13px',
                          color: cores.textoSecundario,
                          lineHeight: 1.45
                        }}
                      >
                        {evento.descricao}
                      </div>
                    )}

                    {temAlteracoes && (
                      <button
                        type="button"
                        onClick={() => alternar(evento.id)}
                        style={{
                          marginTop: '6px',
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          color: cores.azul,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {aberto
                          ? 'Ocultar detalhes'
                          : `Ver ${evento.alteracoes.length} campo(s)`}
                      </button>
                    )}

                    {temAlteracoes && aberto && (
                      <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '12px'
                          }}
                        >
                          <thead>
                            <tr style={{ background: cores.fundo }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', width: '26%' }}>Campo</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', width: '37%' }}>Antes</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', width: '37%' }}>Depois</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evento.alteracoes.map((alteracao, indice) => (
                              <tr
                                key={`${evento.id}-${indice}`}
                                style={{ borderTop: `1px solid ${cores.borda}` }}
                              >
                                <td style={{ padding: '6px 8px', fontWeight: 600, verticalAlign: 'top' }}>
                                  {alteracao.rotulo}
                                </td>
                                <td
                                  style={{
                                    padding: '6px 8px',
                                    color: cores.vermelho,
                                    verticalAlign: 'top',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {valorOuVazio(alteracao.anterior)}
                                </td>
                                <td
                                  style={{
                                    padding: '6px 8px',
                                    color: cores.verde,
                                    verticalAlign: 'top',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {valorOuVazio(alteracao.novo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoricoTreinamentoModal;
