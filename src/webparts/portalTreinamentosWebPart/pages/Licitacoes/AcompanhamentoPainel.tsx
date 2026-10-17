import * as React from 'react';

import {
  IUseAcompanhamentoLicitacoes
} from '../../hooks/useAcompanhamentoLicitacoes';

import {
  IAcompanhamento,
  IAlteracaoLicitacao
} from '../../services/licitacoes/AcompanhamentoLicitacaoService';

import {
  TipoAlteracao,
  formatarDataSnapshot
} from '../../utils/snapshotLicitacao';

import {
  COR,
  FONTE
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — ACOMPANHAMENTO (estilo "monitor")
//
//   à esquerda  editais acompanhados (situação + novidades)
//   à direita   linha do tempo: o que mudou, quando e de onde veio
//               (busca / verificação automática), com o valor
//               anterior riscado e o novo destacado
// ============================================================

export interface IAcompanhamentoPainelProps {
  acompanhamento: IUseAcompanhamentoLicitacoes;
  ehAdministrador: boolean;
}

type Filtro = 'todos' | 'novidades';

const VISUAL_TIPO: Record<TipoAlteracao, { icone: string; cor: string; rotulo: string }> = {
  inicio: { icone: '★', cor: COR.indigo, rotulo: 'Início' },
  situacao: { icone: '⚑', cor: '#9B2C1F', rotulo: 'Situação' },
  data: { icone: '🗓', cor: '#B45309', rotulo: 'Data' },
  valor: { icone: 'R$', cor: '#047C8C', rotulo: 'Valor' },
  objeto: { icone: '✎', cor: COR.indigo, rotulo: 'Objeto' },
  documento: { icone: '📎', cor: '#0B5CAB', rotulo: 'Documento' },
  item: { icone: '#', cor: '#6D28D9', rotulo: 'Item' }
};

const corSituacao = (situacao: string): { cor: string; fundo: string } => {
  const s = (situacao || '').toLowerCase();
  if (/suspens|revogad|anulad|cancelad|desert|fracass/.test(s)) {
    return { cor: '#9B2C1F', fundo: '#FDECEA' };
  }
  if (/homolog|conclu|encerrad/.test(s)) {
    return { cor: '#13795B', fundo: '#E7F5EE' };
  }
  return { cor: '#047C8C', fundo: COR.cianoClaro };
};

const dataHora = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString('pt-BR')} | ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const botao = (principal: boolean, desabilitado = false): React.CSSProperties => ({
  padding: '7px 13px',
  borderRadius: 7,
  border: principal ? 0 : `1px solid ${COR.cinzaClaro}`,
  background: principal ? COR.botao : '#ffffff',
  color: principal ? '#ffffff' : COR.azul,
  fontWeight: 700,
  fontSize: 12.5,
  fontFamily: FONTE,
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.5 : 1,
  whiteSpace: 'nowrap'
});

const SeloSituacao: React.FC<{ situacao: string }> = ({ situacao }) => {
  if (!situacao) {
    return null;
  }
  const v = corSituacao(situacao);
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: v.cor, background: v.fundo, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {situacao}
    </span>
  );
};

const ItemLinhaTempo: React.FC<{ alteracao: IAlteracaoLicitacao }> = ({ alteracao }) => {
  const v = VISUAL_TIPO[alteracao.tipo] || VISUAL_TIPO.situacao;
  const longo = alteracao.tipo === 'objeto';
  return (
    <li style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
        <strong style={{ fontSize: 13, color: COR.azul, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, borderRadius: 6, background: `${v.cor}18`, color: v.cor, fontSize: 11, fontWeight: 800 }}>
            {v.icone}
          </span>
          {alteracao.descricao}
          {!alteracao.lida && (
            <span style={{ fontSize: 10, fontWeight: 800, color: '#ffffff', background: '#C0392B', borderRadius: 999, padding: '1px 7px' }}>NOVA</span>
          )}
        </strong>
        <span style={{ fontSize: 11.5, color: COR.textoSecundario, whiteSpace: 'nowrap' }}>
          {alteracao.origem === 'automatica' ? 'Verificação automática' : alteracao.origem === 'busca' ? 'Detectado na busca' : 'Portal'} · {dataHora(alteracao.detectadaEm)}
        </span>
      </div>
      <div style={{ background: '#ffffff', border: `1px solid ${COR.cinzaClaro}`, borderLeft: `3px solid ${v.cor}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: COR.azul, lineHeight: 1.5 }}>
        {alteracao.tipo === 'inicio'
          ? <>Edital passou a ser acompanhado. Situação: <strong>{alteracao.novo}</strong></>
          : alteracao.anterior && alteracao.novo
            ? (
              longo
                ? (
                  <>
                    <div style={{ color: COR.textoSecundario, textDecoration: 'line-through', marginBottom: 6 }}>{alteracao.anterior}</div>
                    <div><mark style={{ background: '#FFE58F', padding: '0 2px' }}>{alteracao.novo}</mark></div>
                  </>
                )
                : (
                  <>
                    <span style={{ color: COR.textoSecundario, textDecoration: 'line-through' }}>{alteracao.anterior}</span>
                    {'  →  '}
                    <mark style={{ background: '#FFE58F', fontWeight: 700, padding: '0 3px' }}>{alteracao.novo}</mark>
                  </>
                )
            )
            : alteracao.novo
              ? <mark style={{ background: '#FFE58F', padding: '0 3px' }}>{alteracao.novo}</mark>
              : <span style={{ color: COR.textoSecundario, textDecoration: 'line-through' }}>{alteracao.anterior}</span>}
      </div>
    </li>
  );
};

const AcompanhamentoPainel: React.FC<IAcompanhamentoPainelProps> = ({
  acompanhamento,
  ehAdministrador
}) => {

  const [selecionadoId, setSelecionadoId] = React.useState<string>('');
  const [filtro, setFiltro] = React.useState<Filtro>('todos');
  const [busca, setBusca] = React.useState<string>('');

  const lista = acompanhamento.acompanhamentos
    .filter(a => filtro === 'todos' || acompanhamento.naoLidas(a.id) > 0)
    .filter(a => {
      const t = busca.trim().toLowerCase();
      return !t || `${a.orgao} ${a.numero} ${a.local} ${a.objeto}`.toLowerCase().indexOf(t) >= 0;
    })
    .sort((x, y) => {
      const nx = acompanhamento.naoLidas(x.id);
      const ny = acompanhamento.naoLidas(y.id);
      return ny - nx || (y.ultimaVerificacao || '').localeCompare(x.ultimaVerificacao || '');
    });

  const selecionado: IAcompanhamento | undefined =
    acompanhamento.acompanhamentos.find(a => a.id === selecionadoId) || lista[0];

  const linhaTempo = selecionado
    ? acompanhamento.alteracoes.filter(a => a.acompanhamentoId === selecionado.id)
    : [];

  // Ao abrir um edital, as novidades dele ficam como lidas.
  React.useEffect(() => {
    if (selecionado && acompanhamento.naoLidas(selecionado.id) > 0) {
      const id = selecionado.id;
      const tempo = window.setTimeout(() => acompanhamento.marcarLidas(id), 1500);
      return () => window.clearTimeout(tempo);
    }
    return undefined;
  }, [selecionado ? selecionado.id : '']);

  if (acompanhamento.situacao === 'carregando') {
    return <p style={{ fontSize: 13, color: COR.textoSecundario }}>Carregando acompanhamentos…</p>;
  }

  if (acompanhamento.situacao === 'tabelaInexistente') {
    return (
      <p style={{ padding: 14, borderRadius: 8, background: '#FFF4E5', fontSize: 13, color: COR.azul }}>
        O acompanhamento ainda não foi ativado: rode o script
        {' '}<code>scripts\dataverse\criar-tabelas-acompanhamento-licitacoes.ps1</code>.
      </p>
    );
  }

  const algumAutomatico = acompanhamento.acompanhamentos.some(a => a.automatico);

  return (
    <div style={{ fontFamily: FONTE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 999,
            background: algumAutomatico ? '#E7F5EE' : '#FFF4E5',
            color: algumAutomatico ? '#13795B' : '#B45309',
            fontWeight: 700
          }}
          title={algumAutomatico
            ? 'O identificador do PNCP é guardado criptografado e o fluxo diário verifica os editais.'
            : 'A linha do tempo é atualizada quando o edital aparece numa busca ou é aberto no Pré-visualizar.'}
        >
          {algumAutomatico ? '● Verificação automática ligada' : '● Verificação pela busca (fase 1)'}
        </span>
        {acompanhamento.mensagem && (
          <span role="status" style={{ fontSize: 12.5, color: COR.textoSecundario }}>{acompanhamento.mensagem}</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {ehAdministrador && (
            <button
              type="button"
              style={botao(false, acompanhamento.processandoChave === '*')}
              disabled={acompanhamento.processandoChave === '*'}
              onClick={() => { acompanhamento.verificarAgora().catch(() => undefined); }}
              title="Executa agora a verificação automática (fase 2)"
            >
              {acompanhamento.processandoChave === '*' ? 'Verificando…' : '↻ Verificar agora'}
            </button>
          )}
          <button type="button" style={botao(false)} onClick={acompanhamento.recarregar}>Atualizar lista</button>
        </span>
      </div>

      {acompanhamento.acompanhamentos.length === 0
        ? (
          <div style={{ padding: 18, borderRadius: 10, border: `1px dashed ${COR.cinzaClaro}`, fontSize: 13.5, color: COR.textoSecundario, lineHeight: 1.6 }}>
            Nenhum edital acompanhado ainda. Na busca, clique em <strong>☆ Acompanhar</strong> no edital — ou registre o
            parecer <strong>Participar</strong>, que já passa a acompanhar automaticamente.
          </div>
        )
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 16, alignItems: 'start' }}>

            {/* Lista */}
            <div style={{ border: `1px solid ${COR.cinzaClaro}`, borderRadius: 10, background: '#ffffff', overflow: 'hidden' }}>
              <div style={{ padding: 10, borderBottom: `1px solid ${COR.cinzaClaro}` }}>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Órgão, número ou objeto…"
                  aria-label="Filtrar editais acompanhados"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: 6, fontSize: 13, fontFamily: FONTE }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {(['todos', 'novidades'] as Filtro[]).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFiltro(f)}
                      style={{ ...botao(filtro === f), padding: '5px 12px', fontSize: 12 }}
                    >
                      {f === 'todos' ? `Todos (${acompanhamento.acompanhamentos.length})` : `Com novidades (${acompanhamento.totalNaoLidas})`}
                    </button>
                  ))}
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 620, overflowY: 'auto' }}>
                {lista.map(a => {
                  const ativo = selecionado && selecionado.id === a.id;
                  const novas = acompanhamento.naoLidas(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelecionadoId(a.id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 14px',
                          border: 0,
                          borderBottom: `1px solid ${COR.cinzaClaro}`,
                          borderLeft: `4px solid ${ativo ? COR.ciano : novas > 0 ? '#C0392B' : 'transparent'}`,
                          background: ativo ? COR.cianoClaro : '#ffffff',
                          cursor: 'pointer',
                          fontFamily: FONTE
                        }}
                      >
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: 13.5, color: COR.azul }}>{a.numero || 'Edital'}</strong>
                          {novas > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff', background: '#C0392B', borderRadius: 999, padding: '1px 8px' }}>{novas}</span>
                          )}
                        </span>
                        <span style={{ display: 'block', fontSize: 12.5, color: COR.azul, margin: '2px 0 6px' }}>{a.orgao}</span>
                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <SeloSituacao situacao={a.situacao} />
                          {a.encerramento && (
                            <span style={{ fontSize: 11, color: COR.textoSecundario }}>encerra {formatarDataSnapshot(a.encerramento)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {lista.length === 0 && (
                  <li style={{ padding: 14, fontSize: 12.5, color: COR.textoSecundario }}>Nada com este filtro.</li>
                )}
              </ul>
            </div>

            {/* Linha do tempo */}
            {selecionado && (
              <div style={{ border: `1px solid ${COR.cinzaClaro}`, borderRadius: 10, overflow: 'hidden', background: '#F6F8FB' }}>
                <div style={{ background: '#3E4B63', color: '#ffffff', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 17 }}>{selecionado.numero || 'Edital'}</strong>
                      <span style={{ display: 'block', fontSize: 13 }}><strong>Órgão:</strong> {selecionado.orgao} · {selecionado.local}</span>
                      <span style={{ display: 'block', fontSize: 13 }}>
                        <strong>Datas:</strong> Abertura {formatarDataSnapshot(selecionado.abertura)} · Encerramento {formatarDataSnapshot(selecionado.encerramento)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <button
                        type="button"
                        style={{ ...botao(false, acompanhamento.processandoChave === selecionado.chaveEdital), background: 'transparent', color: '#ffffff', borderColor: 'rgba(255,255,255,.5)' }}
                        disabled={acompanhamento.processandoChave === selecionado.chaveEdital}
                        onClick={() => {
                          if (window.confirm('Parar de acompanhar este edital? O histórico continua guardado.')) {
                            acompanhamento.parar(selecionado).catch(() => undefined);
                          }
                        }}
                      >
                        Parar de acompanhar
                      </button>
                    </div>
                  </div>
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.85, marginTop: 6 }}>
                    {selecionado.automatico ? 'Verificação automática diária' : 'Atualizado nas buscas'} · última verificação {dataHora(selecionado.ultimaVerificacao)}
                  </span>
                </div>

                <div style={{ padding: '14px 18px' }}>
                  <strong style={{ display: 'block', fontSize: 13.5, color: COR.azul, marginBottom: 10 }}>Alterações do edital</strong>
                  {linhaTempo.length === 0
                    ? <p style={{ fontSize: 13, color: COR.textoSecundario }}>Nenhuma alteração registrada ainda.</p>
                    : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {linhaTempo.map(a => <ItemLinhaTempo key={a.id} alteracao={a} />)}
                      </ul>
                    )}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default AcompanhamentoPainel;
