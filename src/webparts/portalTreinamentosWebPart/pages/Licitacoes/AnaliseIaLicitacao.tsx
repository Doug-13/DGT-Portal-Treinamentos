import * as React from 'react';

import {
  DecisaoParecer
} from '../../models/Licitacao';

import {
  IAnaliseIaLicitacao,
  IEstadoAnaliseIa,
  RecomendacaoIa,
  ROTULO_RECOMENDACAO_IA
} from '../../models/LicitacaoIa';

import {
  COR,
  FONTE
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — ANÁLISE DA IA (tela)
//
//   AnaliseIaBloco  usado no cartão da busca (compacto, expande) e
//                   no painel do edital (completo)
//
// Aparece SÓ para editais sem parecer. "Usar sugestão" abre a
// janela do parecer já com a decisão e o texto sugeridos — a
// pessoa revisa e confirma. A IA nunca decide sozinha.
// ============================================================

const VISUAL: Record<RecomendacaoIa, { cor: string; fundo: string; icone: string }> = {
  Participar: { cor: '#047C8C', fundo: COR.cianoClaro, icone: '✓' },
  NaoParticipar: { cor: '#9B2C1F', fundo: '#FDECEA', icone: '✕' },
  Avaliar: { cor: '#B45309', fundo: '#FFF4E5', icone: '?' }
};

const botao: React.CSSProperties = {
  border: `1px solid ${COR.cinzaClaro}`,
  borderRadius: 7,
  padding: '5px 11px',
  background: '#ffffff',
  color: COR.azul,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONTE,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

// Barra de compatibilidade: verde-água (alta), âmbar (média), vermelho (baixa).
const corCompatibilidade = (valor: number): string =>
  valor >= 60 ? '#047C8C' : valor >= 35 ? '#B45309' : '#9B2C1F';

const decisaoDaRecomendacao = (r: RecomendacaoIa): DecisaoParecer | undefined =>
  r === 'Participar' ? 'Participar' : r === 'NaoParticipar' ? 'NaoParticipar' : undefined;

const ListaIa: React.FC<{ titulo: string; itens: string[]; cor: string }> = ({ titulo, itens, cor }) =>
  itens.length === 0 ? null : (
    <div style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
        {titulo}
      </span>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: COR.azul, lineHeight: 1.5 }}>
        {itens.map((t, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{t}</li>)}
      </ul>
    </div>
  );

export interface IAnaliseIaBlocoProps {
  estado: IEstadoAnaliseIa;
  completo?: boolean;
  onAnalisar: () => void;
  onUsarSugestao: (decisao: DecisaoParecer | undefined, justificativa: string) => void;
}

export const AnaliseIaBloco: React.FC<IAnaliseIaBlocoProps> = ({
  estado,
  completo = false,
  onAnalisar,
  onUsarSugestao
}) => {

  const [aberto, setAberto] = React.useState<boolean>(completo);

  const moldura = (cor: string, conteudo: React.ReactNode): React.ReactElement => (
    <div
      style={{
        marginBottom: completo ? 22 : 12,
        padding: completo ? '14px 16px' : '10px 12px',
        borderRadius: 8,
        background: '#FAFBFF',
        border: `1px solid ${COR.cinzaClaro}`,
        borderLeft: `3px solid ${cor}`,
        fontFamily: FONTE
      }}
    >
      {conteudo}
    </div>
  );

  const titulo = (
    <span style={{ fontSize: 11, fontWeight: 700, color: COR.indigo, textTransform: 'uppercase', letterSpacing: '.05em' }}>
      🤖 Análise da IA
    </span>
  );

  if (estado.situacao === 'naoIniciada') {
    return moldura(COR.indigo, (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {titulo}
        <span style={{ fontSize: 12, color: COR.textoSecundario }}>Ainda não analisado.</span>
        <button type="button" style={botao} onClick={onAnalisar}>Analisar com IA</button>
      </div>
    ));
  }

  if (estado.situacao === 'aguardando' || estado.situacao === 'analisando') {
    return moldura(COR.indigo, (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {titulo}
        <span style={{ fontSize: 12, color: COR.textoSecundario }}>
          {estado.situacao === 'analisando' ? 'Analisando com base no histórico de pareceres…' : 'Na fila para análise…'}
        </span>
      </div>
    ));
  }

  if (estado.situacao === 'erro' || !estado.analise) {
    return moldura('#9B2C1F', (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {titulo}
        <span style={{ fontSize: 12, color: '#9B2C1F' }}>Não foi possível analisar: {estado.erro || 'erro desconhecido'}</span>
        <button type="button" style={botao} onClick={onAnalisar}>Tentar de novo</button>
      </div>
    ));
  }

  const a: IAnaliseIaLicitacao = estado.analise;
  const v = VISUAL[a.recomendacao];
  const temDetalhes = a.pontosFavoraveis.length + a.riscos.length + a.semelhantes.length > 0;

  return moldura(v.cor, (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {titulo}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 10px',
            borderRadius: 999,
            background: v.fundo,
            color: v.cor,
            border: `1px solid ${v.cor}`,
            fontSize: 12,
            fontWeight: 700
          }}
        >
          <span aria-hidden="true">{v.icone}</span>
          Sugestão: {ROTULO_RECOMENDACAO_IA[a.recomendacao]}
        </span>
        <span
          title={`Compatibilidade do edital com a DGT (portfólio, critérios e histórico). Certeza da IA na sugestão: ${a.confianca}%.`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: COR.textoSecundario }}
        >
          Compatibilidade
          <span style={{ width: 60, height: 5, borderRadius: 3, background: COR.neutro, overflow: 'hidden', display: 'inline-block' }}>
            <span style={{ display: 'block', width: `${a.compatibilidade}%`, height: '100%', background: corCompatibilidade(a.compatibilidade) }} />
          </span>
          <strong style={{ color: corCompatibilidade(a.compatibilidade) }}>{a.compatibilidade}%</strong>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!completo && temDetalhes && (
            <button type="button" style={botao} onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
              {aberto ? '▴ Menos' : '▾ Detalhes'}
            </button>
          )}
          <button
            type="button"
            style={{ ...botao, background: v.fundo, borderColor: v.cor, color: v.cor }}
            onClick={() => onUsarSugestao(decisaoDaRecomendacao(a.recomendacao), a.justificativaSugerida || a.resumo)}
            title="Abre o parecer com a decisão e o texto sugeridos para você revisar"
          >
            Usar sugestão
          </button>
          <button type="button" style={botao} onClick={onAnalisar} title="Gerar uma nova análise">↻</button>
        </span>
      </div>

      {a.resumo && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: COR.azul, lineHeight: 1.5 }}>{a.resumo}</p>
      )}

      {(aberto || completo) && temDetalhes && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
          <ListaIa titulo="Pontos favoráveis" itens={a.pontosFavoraveis} cor="#047C8C" />
          <ListaIa titulo="Riscos" itens={a.riscos} cor="#9B2C1F" />
          <ListaIa titulo="Editais parecidos" itens={a.semelhantes} cor={COR.indigo} />
        </div>
      )}

      <span style={{ display: 'block', marginTop: 6, fontSize: 10.5, color: COR.textoSecundario }}>
        {a.provedor === 'simulado'
          ? 'Sugestão calculada pelo histórico de pareceres da DGT (modo simulado, sem API de IA).'
          : `Gerada por IA (${a.modeloIa || 'modelo configurado'}).`}
        {' '}Prompt v{a.promptVersao}. Revise antes de decidir.
      </span>
    </>
  ));
};

export default AnaliseIaBloco;
