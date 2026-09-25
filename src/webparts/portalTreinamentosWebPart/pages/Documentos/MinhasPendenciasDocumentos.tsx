import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import {
  IPendenciaDocumento,
  TipoPendenciaDocumento
} from '../../hooks/useDocumentosPendencias';

// ============================================================
// PAINEL "MINHAS PENDÊNCIAS" — só aparece quando há pendências
// ============================================================

export interface IMinhasPendenciasDocumentosProps {
  pendencias: IPendenciaDocumento[];
  carregando: boolean;
  erro: string;
  onAbrirDocumento?: (documento: IDocumento) => void;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';

const GRUPOS: Array<{
  tipo: TipoPendenciaDocumento;
  titulo: string;
  descricao: string;
  acao: string;
  cor: string;
  fundo: string;
}> = [
  {
    tipo: 'aprovar',
    titulo: 'Aguardando sua aprovação',
    descricao: 'Revisões enviadas pelo responsável para você avaliar.',
    acao: 'Avaliar',
    cor: '#B45309',
    fundo: '#FFF4E5'
  },
  {
    tipo: 'elaborar',
    titulo: 'Em elaboração por você',
    descricao: 'Revisões sob sua responsabilidade que ainda não foram enviadas.',
    acao: 'Continuar',
    cor: '#485CC7',
    fundo: '#E8EAF8'
  }
];

const corIdade = (
  dias: number
): string =>
  dias >= 15
    ? '#B42318'
    : dias >= 7
      ? '#B45309'
      : '#64748B';

const textoIdade = (
  dias: number
): string =>
  dias === 0
    ? 'hoje'
    : dias === 1
      ? 'há 1 dia'
      : `há ${dias} dias`;

const MinhasPendenciasDocumentos:
  React.FC<IMinhasPendenciasDocumentosProps> = ({
    pendencias,
    carregando,
    erro,
    onAbrirDocumento
  }) => {

    const [recolhido, setRecolhido] =
      React.useState(false);

    // Regra pedida: o painel só existe quando o usuário tem algo a fazer.
    if (
      !erro &&
      pendencias.length === 0
    ) {
      return null;
    }

    const gruposComItens =
      GRUPOS
        .map(
          grupo => ({
            ...grupo,
            itens: pendencias.filter(
              pendencia => pendencia.tipo === grupo.tipo
            )
          })
        )
        .filter(
          grupo => grupo.itens.length > 0
        );

    const atrasadas =
      pendencias.filter(
        pendencia => pendencia.diasParado >= 7
      ).length;

    return (
      <div
        style={{
          marginTop: '12px',
          background: '#FFFFFF',
          border: `1px solid ${COR_CIANO}`,
          borderLeft: `5px solid ${COR_CIANO}`,
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        <button
          type="button"
          onClick={() => setRecolhido(!recolhido)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            border: 0,
            background: '#E6F9FC',
            color: COR_AZUL,
            textAlign: 'left',
            cursor: 'pointer'
          }}
        >
          <span>
            <strong style={{ fontSize: '14px' }}>
              🔔 Minhas pendências ({pendencias.length})
            </strong>

            {
              atrasadas > 0 &&
              (
                <span
                  style={{
                    marginLeft: '10px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#FDE7E9',
                    color: '#B42318',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  {atrasadas} parada(s) há 7+ dias
                </span>
              )
            }

            {
              carregando &&
              (
                <span style={{ marginLeft: '10px', fontSize: '11px', color: '#64748B' }}>
                  atualizando...
                </span>
              )
            }
          </span>

          <span style={{ fontSize: '12px', fontWeight: 700 }}>
            {recolhido ? 'Mostrar ▾' : 'Recolher ▴'}
          </span>
        </button>

        {
          erro &&
          (
            <div style={{ padding: '10px 16px', color: '#A4262C', fontSize: '12.5px' }}>
              {erro}
            </div>
          )
        }

        {
          !recolhido &&
          (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '0'
              }}
            >
              {
                gruposComItens.map(
                  grupo => (
                    <div
                      key={grupo.tipo}
                      style={{
                        padding: '12px 16px 14px',
                        borderTop: '1px solid #E2E8F0'
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          color: grupo.cor,
                          fontSize: '13px'
                        }}
                      >
                        {grupo.titulo} ({grupo.itens.length})
                      </strong>

                      <span
                        style={{
                          display: 'block',
                          marginBottom: '8px',
                          color: '#64748B',
                          fontSize: '11.5px'
                        }}
                      >
                        {grupo.descricao}
                      </span>

                      {
                        grupo.itens.map(
                          pendencia => (
                            <div
                              key={pendencia.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 0',
                                borderBottom: '1px solid #F1F5F9'
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <strong
                                  style={{
                                    display: 'block',
                                    color: COR_AZUL,
                                    fontSize: '12.5px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={pendencia.documento.titulo}
                                >
                                  {pendencia.documento.titulo}
                                </strong>

                                <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                                  {pendencia.documento.codigo} · {pendencia.revisao}
                                  {' · '}
                                  <span
                                    style={{
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      background: grupo.fundo,
                                      color: grupo.cor,
                                      fontWeight: 700
                                    }}
                                  >
                                    {pendencia.status}
                                  </span>
                                  {' · '}
                                  <span
                                    style={{
                                      color: corIdade(pendencia.diasParado),
                                      fontWeight: pendencia.diasParado >= 7 ? 700 : 400
                                    }}
                                  >
                                    {textoIdade(pendencia.diasParado)}
                                  </span>
                                </span>
                              </div>

                              {
                                onAbrirDocumento &&
                                (
                                  <button
                                    type="button"
                                    onClick={() => onAbrirDocumento(pendencia.documento)}
                                    style={{
                                      padding: '6px 12px',
                                      border: 0,
                                      borderRadius: '7px',
                                      background: COR_AZUL,
                                      color: '#FFFFFF',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {grupo.acao} →
                                  </button>
                                )
                              }
                            </div>
                          )
                        )
                      }
                    </div>
                  )
                )
              }
            </div>
          )
        }
      </div>
    );
  };

export default MinhasPendenciasDocumentos;
