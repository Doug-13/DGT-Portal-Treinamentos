import * as React from 'react';

import {
  CategoriaPassoFluxo,
  IDocumentoEvento,
  TipoEventoDocumento
} from '../../models/Documento';

import {
  ESTILO_PASSO_FLUXO
} from '../../services/fluxo/categoriaPasso';

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
  FLUXO: { cor: '#202A44', fundo: '#DFF6FA', icone: '▸', rotulo: 'Fluxo' },
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
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {
                (['aprovado', 'reprovado', 'subrevisao', 'revisao', 'publicado', 'avanco'] as CategoriaPassoFluxo[]).map(
                  categoria => {
                    const item = ESTILO_PASSO_FLUXO[categoria];
                    return (
                      <span
                        key={categoria}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: item.fundo,
                          color: item.cor,
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {item.icone} {item.rotulo}
                      </span>
                    );
                  }
                )
              }
            </span>
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
                <section
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      background: COR_AZUL,
                      color: '#FFFFFF',
                      padding: '12px 20px',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase'
                    }}
                  >
                    Histórico da tramitação
                  </div>

                  <ol style={{ listStyle: 'none', margin: 0, padding: '4px 20px 12px' }}>
                    {
                      filtrados.map(
                        evento => {

                          const estilo =
                            evento.tipo === 'FLUXO' && evento.categoriaFluxo
                              ? ESTILO_PASSO_FLUXO[evento.categoriaFluxo]
                              : ESTILO_EVENTO[evento.tipo] || ESTILO_EVENTO.OUTRO;

                          // Contexto (etapa) e ação: passos do fluxo têm
                          // os dois; eventos antigos usam o tipo + título.
                          const contexto =
                            evento.etapa || estilo.rotulo;

                          const acao =
                            evento.acao || evento.titulo;

                          const rotuloRevisao =
                            evento.revisaoNoMomento || evento.revisao;

                          return (
                            <li
                              key={evento.id}
                              style={{
                                padding: '10px 0 10px 12px',
                                borderBottom: '1px solid #E5E7EB',
                                borderLeft: `4px solid ${estilo.cor}`,
                                marginBottom: '2px'
                              }}
                            >
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12.5px', color: COR_AZUL }}>
                                <span
                                  title={estilo.rotulo}
                                  aria-hidden="true"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: estilo.fundo,
                                    color: estilo.cor,
                                    border: `1.5px solid ${estilo.cor}`,
                                    fontSize: '11px',
                                    fontWeight: 800
                                  }}
                                >
                                  {estilo.icone}
                                </span>
                                <strong>{formatarDataHora(evento.data)}</strong>
                                <span>{contexto}</span>
                                {
                                  rotuloRevisao && (
                                    <span style={{ fontSize: '11px', fontWeight: 700, background: COR_AZUL, color: '#FFFFFF', borderRadius: '5px', padding: '1px 6px' }}>
                                      {rotuloRevisao}
                                    </span>
                                  )
                                }
                                {
                                  evento.derivado && (
                                    <span style={{ fontSize: '11px', color: '#64748B', background: '#F1F5F9', borderRadius: '5px', padding: '1px 6px' }}>
                                      registro anterior
                                    </span>
                                  )
                                }
                              </div>

                              <div style={{ fontWeight: 700, fontSize: '14px', color: estilo.cor, marginTop: '2px' }}>
                                {acao}
                              </div>

                              <div style={{ fontSize: '12.5px', color: '#334155' }}>
                                {
                                  evento.usuario === 'Sistema'
                                    ? (
                                      <>
                                        Automático
                                        {
                                          evento.acionadoPor && (
                                            <> · ação de <strong>{evento.acionadoPor}</strong></>
                                          )
                                        }
                                      </>
                                    )
                                    : (
                                      <>
                                        Executado por{' '}
                                        <strong>
                                          {evento.usuario && evento.usuario !== '-' ? evento.usuario : 'usuário não identificado'}
                                        </strong>
                                      </>
                                    )
                                }
                              </div>

                              {
                                evento.statusAnterior && evento.statusNovo && evento.statusAnterior !== evento.statusNovo && (
                                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                                    Status: {evento.statusAnterior} → {evento.statusNovo}
                                  </div>
                                )
                              }

                              {
                                evento.descricao && (
                                  <div
                                    style={{
                                      marginTop: '6px',
                                      padding: '6px 10px',
                                      background: '#F2F2F2',
                                      borderLeft: '3px solid #05C3DD',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      color: COR_AZUL,
                                      whiteSpace: 'pre-wrap'
                                    }}
                                  >
                                    {evento.descricao}
                                  </div>
                                )
                              }
                            </li>
                          );
                        }
                      )
                    }
                  </ol>
                </section>
              )
        }
      </div>
    );
  };

export default DocumentoHistoricoTab;
