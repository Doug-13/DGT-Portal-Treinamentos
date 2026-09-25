import * as React from 'react';

import {
  IDocumentoEvento,
  TipoEventoDocumento
} from '../../models/Documento';

// ============================================================
// ABA "HISTÓRICO" DO DOCUMENTO — linha do tempo de auditoria
// ============================================================

export interface IDocumentoHistoricoTabProps {
  eventos: IDocumentoEvento[];
  carregando: boolean;
  erro: string;
  onRecarregar: () => void;
}

const COR_AZUL = '#202A44';

const ESTILO_EVENTO:
  Record<TipoEventoDocumento, { cor: string; fundo: string; icone: string; rotulo: string }> = {
  REVISAO_CRIADA: { cor: '#485CC7', fundo: '#E8EAF8', icone: '+', rotulo: 'Criação' },
  REVISAO_EDITADA: { cor: '#0F6CBD', fundo: '#E8F2FF', icone: '✎', rotulo: 'Edição' },
  ARQUIVO_SUBSTITUIDO: { cor: '#0F6CBD', fundo: '#E8F2FF', icone: '⇪', rotulo: 'Arquivo' },
  ENVIADA_APROVACAO: { cor: '#B45309', fundo: '#FFF4E5', icone: '→', rotulo: 'Aprovação' },
  REPROVADA: { cor: '#B42318', fundo: '#FDE7E9', icone: '✕', rotulo: 'Reprovação' },
  APROVADA_PUBLICADA: { cor: '#107C10', fundo: '#E7F6EC', icone: '✓', rotulo: 'Publicação' },
  REVISAO_SUBSTITUIDA: { cor: '#64748B', fundo: '#F1F5F9', icone: '⟲', rotulo: 'Substituição' },
  OUTRO: { cor: '#64748B', fundo: '#F1F5F9', icone: '•', rotulo: 'Evento' }
};

const formatarDataHora = (
  valor: string
): string => {

  if (!valor) {
    return '-';
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return valor;
  }

  return data.toLocaleString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
};

const DocumentoHistoricoTab:
  React.FC<IDocumentoHistoricoTabProps> = ({
    eventos,
    carregando,
    erro,
    onRecarregar
  }) => {

    const [filtroRevisao, setFiltroRevisao] =
      React.useState('');

    const revisoesDisponiveis =
      React.useMemo(
        () => {
          const lista: string[] = [];

          eventos.forEach(
            evento => {
              if (
                evento.revisao &&
                lista.indexOf(evento.revisao) < 0
              ) {
                lista.push(evento.revisao);
              }
            }
          );

          return lista;
        },
        [eventos]
      );

    const filtrados =
      filtroRevisao
        ? eventos.filter(evento => evento.revisao === filtroRevisao)
        : eventos;

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}
        >
          <span
            style={{
              color: '#64748B',
              fontSize: '13px'
            }}
          >
            Todos os eventos do documento, do mais recente para o mais antigo. Nenhum registro é apagado.
          </span>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <select
              value={filtroRevisao}
              onChange={event => setFiltroRevisao(event.target.value)}
              style={{
                padding: '7px 10px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '12.5px'
              }}
            >
              <option value="">Todas as revisões</option>
              {
                revisoesDisponiveis.map(
                  revisao => (
                    <option key={revisao} value={revisao}>
                      {revisao}
                    </option>
                  )
                )
              }
            </select>

            <button
              type="button"
              disabled={carregando}
              onClick={onRecarregar}
              style={{
                padding: '7px 12px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                background: '#FFFFFF',
                color: COR_AZUL,
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: carregando ? 'not-allowed' : 'pointer'
              }}
            >
              Atualizar
            </button>
          </div>
        </div>

        {
          erro &&
          (
            <div
              style={{
                padding: '12px 14px',
                marginBottom: '16px',
                borderRadius: '8px',
                background: '#FDE7E9',
                color: '#A4262C',
                fontSize: '13px'
              }}
            >
              {erro}
            </div>
          )
        }

        {
          carregando
            ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                Carregando histórico...
              </div>
            )
            : filtrados.length === 0
              ? (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748B',
                    background: '#FFFFFF',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '12px'
                  }}
                >
                  Nenhum evento registrado ainda.
                </div>
              )
              : (
                <ol
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    position: 'relative'
                  }}
                >
                  {
                    filtrados.map(
                      (evento, indice) => {

                        const estilo =
                          ESTILO_EVENTO[evento.tipo] ||
                          ESTILO_EVENTO.OUTRO;

                        const ultimo =
                          indice === filtrados.length - 1;

                        return (
                          <li
                            key={evento.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '36px 1fr',
                              gap: '12px'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                              }}
                            >
                              <span
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: estilo.fundo,
                                  color: estilo.cor,
                                  fontWeight: 800,
                                  fontSize: '14px',
                                  border: `2px solid ${estilo.cor}`,
                                  flexShrink: 0
                                }}
                              >
                                {estilo.icone}
                              </span>

                              {
                                !ultimo &&
                                (
                                  <span
                                    style={{
                                      flex: 1,
                                      width: '2px',
                                      minHeight: '18px',
                                      background: '#E2E8F0'
                                    }}
                                  />
                                )
                              }
                            </div>

                            <div
                              style={{
                                marginBottom: ultimo ? 0 : '14px',
                                padding: '12px 16px',
                                background: '#FFFFFF',
                                border: '1px solid #E5E7EB',
                                borderRadius: '12px'
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  flexWrap: 'wrap'
                                }}
                              >
                                <div>
                                  {
                                    evento.revisao &&
                                    (
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          marginRight: '8px',
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          background: COR_AZUL,
                                          color: '#FFFFFF',
                                          fontSize: '11px',
                                          fontWeight: 700
                                        }}
                                      >
                                        {evento.revisao}
                                      </span>
                                    )
                                  }

                                  <strong
                                    style={{
                                      color: '#1F2937',
                                      fontSize: '13.5px'
                                    }}
                                  >
                                    {evento.titulo}
                                  </strong>
                                </div>

                                <span
                                  style={{
                                    color: '#64748B',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {formatarDataHora(evento.data)}
                                </span>
                              </div>

                              <div
                                style={{
                                  marginTop: '6px',
                                  color: '#64748B',
                                  fontSize: '12px'
                                }}
                              >
                                Por <strong style={{ color: '#334155' }}>{evento.usuario}</strong>
                                {
                                  evento.statusAnterior && evento.statusNovo &&
                                  (
                                    <> · {evento.statusAnterior} → <strong style={{ color: estilo.cor }}>{evento.statusNovo}</strong></>
                                  )
                                }
                                {
                                  evento.derivado &&
                                  (
                                    <span
                                      title="Evento reconstruído a partir dos dados da revisão (registrado antes do histórico existir)."
                                      style={{
                                        marginLeft: '8px',
                                        padding: '1px 6px',
                                        borderRadius: '6px',
                                        background: '#F1F5F9',
                                        color: '#64748B',
                                        fontSize: '10.5px'
                                      }}
                                    >
                                      registro anterior
                                    </span>
                                  )
                                }
                              </div>

                              {
                                evento.descricao &&
                                (
                                  <p
                                    style={{
                                      margin: '8px 0 0',
                                      color: '#475569',
                                      fontSize: '13px',
                                      lineHeight: 1.5,
                                      whiteSpace: 'pre-wrap'
                                    }}
                                  >
                                    {evento.descricao}
                                  </p>
                                )
                              }

                              {
                                evento.arquivoUrl &&
                                (
                                  <a
                                    href={evento.arquivoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-block',
                                      marginTop: '8px',
                                      color: '#485CC7',
                                      fontSize: '12.5px',
                                      fontWeight: 700
                                    }}
                                  >
                                    Abrir arquivo
                                  </a>
                                )
                              }
                            </div>
                          </li>
                        );
                      }
                    )
                  }
                </ol>
              )
        }
      </div>
    );
  };

export default DocumentoHistoricoTab;
