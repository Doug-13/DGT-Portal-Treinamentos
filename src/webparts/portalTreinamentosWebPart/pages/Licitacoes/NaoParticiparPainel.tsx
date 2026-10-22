import * as React from 'react';

import {
  IParecerLicitacao
} from '../../models/Licitacao';

import {
  formatarMoeda
} from '../../utils/licitacoesFiltro';

import {
  formatarDataSnapshot
} from '../../utils/snapshotLicitacao';

import {
  COR,
  FONTE
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — EDITAIS MARCADOS COMO "NÃO PARTICIPAR"
//
// Lista o parecer vigente de cada edital descartado pela DGT, com a
// justificativa, quem decidiu e quando — sem precisar buscar de novo.
// "Buscar este edital" preenche a busca (modo Edital específico)
// para reabrir o edital e, se for o caso, mudar o parecer.
// ============================================================

export interface INaoParticiparPainelProps {
  pareceres: IParecerLicitacao[];
  carregando: boolean;
  historicoDe: (chaveEdital: string) => IParecerLicitacao[];
  onBuscarEdital: (parecer: IParecerLicitacao) => void;
}

type Ordem = 'recentes' | 'encerramento' | 'valor';

const VERMELHO = '#9B2C1F';

const dataHora = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const NaoParticiparPainel: React.FC<INaoParticiparPainelProps> = ({
  pareceres,
  carregando,
  historicoDe,
  onBuscarEdital
}) => {

  const [busca, setBusca] = React.useState<string>('');
  const [ordem, setOrdem] = React.useState<Ordem>('recentes');
  const [abertos, setAbertos] = React.useState<Record<string, boolean>>({});

  const lista = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pareceres
      .filter(p => !termo || `${p.orgao} ${p.local} ${p.numero} ${p.objeto} ${p.justificativa} ${p.responsavel}`.toLowerCase().indexOf(termo) >= 0)
      .slice()
      .sort((a, b) => {
        if (ordem === 'valor') {
          return (b.valorEstimado || 0) - (a.valorEstimado || 0);
        }
        if (ordem === 'encerramento') {
          return (b.encerramento || '').localeCompare(a.encerramento || '');
        }
        return (b.registradoEm || '').localeCompare(a.registradoEm || '');
      });
  }, [pareceres, busca, ordem]);

  if (carregando) {
    return <p style={{ fontSize: 13, color: COR.textoSecundario }}>Carregando pareceres…</p>;
  }

  return (
    <div style={{ fontFamily: FONTE }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por órgão, município, número, objeto ou justificativa…"
          aria-label="Filtrar editais marcados como não participar"
          style={{ flex: '1 1 320px', padding: '8px 11px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: 7, fontSize: 13, fontFamily: FONTE }}
        />
        <label style={{ fontSize: 12.5, color: COR.textoSecundario }}>
          Ordenar por{' '}
          <select
            value={ordem}
            onChange={e => setOrdem(e.target.value as Ordem)}
            style={{ padding: '6px 8px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: 6, fontSize: 12.5, fontFamily: FONTE }}
          >
            <option value="recentes">Parecer mais recente</option>
            <option value="encerramento">Encerramento das propostas</option>
            <option value="valor">Valor estimado</option>
          </select>
        </label>
        <span style={{ fontSize: 12.5, color: COR.textoSecundario }}>
          {lista.length} de {pareceres.length} edital(is)
        </span>
      </div>

      {pareceres.length === 0
        ? (
          <div style={{ padding: 18, borderRadius: 10, border: `1px dashed ${COR.cinzaClaro}`, fontSize: 13.5, color: COR.textoSecundario }}>
            Nenhum edital marcado como <strong>Não participar</strong> ainda.
          </div>
        )
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(p => {
              const historico = historicoDe(p.chaveEdital);
              const aberto = !!abertos[p.chaveEdital];
              return (
                <div
                  key={p.id || p.chaveEdital}
                  style={{ background: '#ffffff', border: `1px solid ${COR.cinzaClaro}`, borderLeft: `4px solid #C0392B`, borderRadius: 10, padding: '12px 14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 11.5, color: COR.textoSecundario }}>
                        {p.modalidade || 'Edital'} · {p.local} · Nº {p.numero || '—'}
                      </span>
                      <strong style={{ display: 'block', fontSize: 14.5, color: COR.azul }}>{p.orgao}</strong>
                    </div>
                    <span style={{ alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: VERMELHO, background: '#FDECEA', border: `1px solid ${VERMELHO}` }}>
                      ✕ Não participar
                    </span>
                  </div>

                  <p style={{ margin: '6px 0', fontSize: 13, color: COR.azul, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: aberto ? 20 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.objeto}
                  </p>

                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: COR.textoSecundario }}>
                    <span>Valor: <strong style={{ color: COR.azul }}>{formatarMoeda(p.valorEstimado)}</strong></span>
                    <span>Encerramento: <strong style={{ color: COR.azul }}>{p.encerramento ? formatarDataSnapshot(p.encerramento) : '—'}</strong></span>
                    <span>Decidido por <strong style={{ color: COR.azul }}>{p.responsavel}</strong> em {dataHora(p.registradoEm)}</span>
                  </div>

                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 7, background: '#FFF8F7', fontSize: 12.5, color: COR.azul, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    <strong>Justificativa:</strong> {p.justificativa}
                  </div>

                  {aberto && historico.length > 1 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: COR.textoSecundario }}>
                      {historico.slice(1).map(h => (
                        <li key={h.id}>
                          {h.decisao === 'Participar' ? '✓ Participar' : '✕ Não participar'} — {h.responsavel}, {dataHora(h.registradoEm)}: {h.justificativa}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setAbertos(a => ({ ...a, [p.chaveEdital]: !aberto }))}
                      style={{ border: `1px solid ${COR.cinzaClaro}`, background: '#ffffff', color: COR.azul, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, fontFamily: FONTE, cursor: 'pointer' }}
                    >
                      {aberto ? '▴ Menos' : `▾ Detalhes${historico.length > 1 ? ` (${historico.length} pareceres)` : ''}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuscarEdital(p)}
                      title="Preenche a busca com este edital (modo Edital específico) para reabri-lo e, se for o caso, mudar o parecer"
                      style={{ border: `1px solid ${COR.cinzaClaro}`, background: '#ffffff', color: COR.indigo, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, fontFamily: FONTE, cursor: 'pointer' }}
                    >
                      🔍 Buscar este edital
                    </button>
                  </div>
                </div>
              );
            })}
            {lista.length === 0 && (
              <p style={{ fontSize: 13, color: COR.textoSecundario }}>Nenhum edital com este filtro.</p>
            )}
          </div>
        )}
    </div>
  );
};

export default NaoParticiparPainel;
