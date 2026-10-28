import * as React from 'react';
import * as ReactDOM from 'react-dom';

// ============================================================
// KITS — ELEMENTOS VISUAIS COMUNS
//
// Identidade visual DGT (MIV_DGT_160420_01): azul 202A44, ciano
// 05C3DD, apoio índigo 485CC7 / cinza 888B8D / cinza claro D9D9D6.
// Sem verde e sem vermelho: alerta em índigo, confirmação em ciano,
// e a diferença é reforçada por ícone e peso, não só pela cor.
// ============================================================

export const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  cinza: '#888B8D',
  cinzaClaro: '#D9D9D6',
  fundo: '#F2F2F2',
  cianoClaro: '#E6F9FC',
  azulClaro: '#EDF0F5',
  indigoClaro: '#E8EAF8',
  branco: '#FFFFFF',
  texto2: '#5B6275'
};

export const FONTE = "Barlow, Arial, sans-serif";

export const painel: React.CSSProperties = {
  background: COR.branco,
  border: `1px solid ${COR.cinzaClaro}`,
  borderRadius: '10px',
  padding: '18px 20px'
};

export const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: COR.azul,
  marginBottom: '6px'
};

export const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '36px',
  padding: '7px 10px',
  border: `1px solid ${COR.cinzaClaro}`,
  borderRadius: '6px',
  fontSize: '14px',
  fontFamily: FONTE,
  color: COR.azul,
  background: COR.branco
};

export const ajuda: React.CSSProperties = {
  fontSize: '12.5px',
  color: COR.texto2,
  marginTop: '5px',
  lineHeight: 1.45
};

export const botao = (
  tipo: 'principal' | 'secundario' | 'discreto' = 'principal',
  desabilitado = false
): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '36px',
  padding: tipo === 'discreto' ? '0 8px' : '0 16px',
  borderRadius: '6px',
  border: tipo === 'secundario' ? `1px solid ${COR.cinzaClaro}` : 0,
  background: tipo === 'principal' ? COR.azul : tipo === 'secundario' ? COR.branco : 'transparent',
  color: tipo === 'principal' ? COR.branco : COR.azul,
  fontWeight: 600,
  fontSize: '13.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.45 : 1,
  whiteSpace: 'nowrap',
  fontFamily: FONTE
});

export type TomSelo = 'azul' | 'ciano' | 'indigo' | 'cinza';

const TONS: Record<TomSelo, { cor: string; fundo: string }> = {
  azul: { cor: COR.azul, fundo: COR.azulClaro },
  ciano: { cor: '#036E7D', fundo: COR.cianoClaro },
  indigo: { cor: COR.indigo, fundo: COR.indigoClaro },
  cinza: { cor: COR.texto2, fundo: COR.fundo }
};

export const Selo: React.FC<{ tom: TomSelo; children: React.ReactNode; titulo?: string }> = ({ tom, children, titulo }) => (
  <span
    title={titulo}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 9px',
      borderRadius: '999px',
      background: TONS[tom].fundo,
      color: TONS[tom].cor,
      fontSize: '12px',
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}
  >
    {children}
  </span>
);

// Aviso em faixa (alerta = índigo com ícone; informação = cinza).
export const Aviso: React.FC<{ tipo: 'alerta' | 'info' | 'ok'; children: React.ReactNode; acao?: React.ReactNode }> = ({ tipo, children, acao }) => {
  const cor = tipo === 'alerta' ? COR.indigo : tipo === 'ok' ? '#036E7D' : COR.texto2;
  const fundo = tipo === 'alerta' ? COR.indigoClaro : tipo === 'ok' ? COR.cianoClaro : COR.fundo;
  const simbolo = tipo === 'alerta' ? '!' : tipo === 'ok' ? '✓' : 'i';
  return (
    <div role={tipo === 'alerta' ? 'alert' : 'status'} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', background: fundo, borderLeft: `4px solid ${cor}`, color: COR.azul, fontSize: '13.5px', lineHeight: 1.45, marginBottom: '14px' }}>
      <span aria-hidden="true" style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: cor, color: COR.branco, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>{simbolo}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {acao}
    </div>
  );
};

// Número com − e + (mais fácil que digitar no celular).
export const Numero: React.FC<{
  valor: number;
  aoMudar: (n: number) => void;
  minimo?: number;
  maximo?: number;
  passo?: number;
  desabilitado?: boolean;
  rotuloAcessivel?: string;
}> = ({ valor, aoMudar, minimo = 0, maximo = 9999, passo = 1, desabilitado, rotuloAcessivel }) => {
  const limitar = (n: number): number => Math.min(maximo, Math.max(minimo, Math.round(n * 100) / 100));
  const botaoPasso: React.CSSProperties = { width: '32px', border: 0, background: COR.azulClaro, color: COR.azul, fontSize: '16px', fontWeight: 700, cursor: desabilitado ? 'not-allowed' : 'pointer', fontFamily: FONTE };
  return (
    <div style={{ display: 'inline-flex', height: '34px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '6px', overflow: 'hidden', opacity: desabilitado ? 0.5 : 1 }}>
      <button type="button" aria-label="Diminuir" style={botaoPasso} disabled={desabilitado || valor <= minimo} onClick={() => aoMudar(limitar(valor - passo))}>−</button>
      <input
        aria-label={rotuloAcessivel}
        value={String(valor)}
        disabled={desabilitado}
        inputMode="decimal"
        onChange={e => {
          const n = Number(e.target.value.replace(',', '.'));
          if (!isNaN(n)) {
            aoMudar(limitar(n));
          }
        }}
        style={{ width: '54px', border: 0, textAlign: 'center', fontSize: '14px', fontFamily: FONTE, color: COR.azul, fontWeight: 600 }}
      />
      <button type="button" aria-label="Aumentar" style={botaoPasso} disabled={desabilitado || valor >= maximo} onClick={() => aoMudar(limitar(valor + passo))}>+</button>
    </div>
  );
};

// Interruptor sim/não.
export const Interruptor: React.FC<{ marcado: boolean; aoMudar: (v: boolean) => void; texto: string; desabilitado?: boolean }> = ({ marcado, aoMudar, texto, desabilitado }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: desabilitado ? 'not-allowed' : 'pointer', fontSize: '13.5px', color: COR.azul, opacity: desabilitado ? 0.5 : 1 }}>
    <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={e => aoMudar(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
    <span aria-hidden="true" style={{ width: '34px', height: '20px', borderRadius: '999px', background: marcado ? COR.ciano : COR.cinzaClaro, position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: marcado ? '17px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: COR.branco, transition: 'left .15s' }} />
    </span>
    {texto}
  </label>
);

// Janela modal (portal no body: escapa do layout do SharePoint).
export const Modal: React.FC<{
  titulo: string;
  subtitulo?: string;
  aoFechar: () => void;
  rodape: React.ReactNode;
  largura?: number;
  children: React.ReactNode;
}> = ({ titulo, subtitulo, aoFechar, rodape, largura = 640, children }) => {

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        aoFechar();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={aoFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(32, 42, 68, .45)', zIndex: 100000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto', fontFamily: FONTE }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: COR.branco, borderRadius: '12px', width: '100%', maxWidth: `${largura}px`, boxShadow: '0 18px 48px rgba(32, 42, 68, .28)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: `3px solid ${COR.ciano}` }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: COR.azul, textTransform: 'uppercase', letterSpacing: '.02em' }}>{titulo}</div>
          {subtitulo && <div style={{ ...ajuda, marginTop: '4px' }}>{subtitulo}</div>}
        </div>
        <div style={{ padding: '18px 22px' }}>{children}</div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${COR.cinzaClaro}`, display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>{rodape}</div>
      </div>
    </div>,
    document.body
  );
};

export const formatarQtd = (n: number): string =>
  Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const formatarDataHora = (valor: string): string => {
  if (!valor) {
    return '—';
  }
  const data = new Date(valor);
  return isNaN(data.getTime())
    ? '—'
    : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Campo "Motivo da alteração" — obrigatório em toda gravação.
export const CampoMotivo: React.FC<{ valor: string; aoMudar: (v: string) => void; desabilitado?: boolean }> = ({ valor, aoMudar, desabilitado }) => (
  <div style={{ marginTop: '14px' }}>
    <label style={rotulo} htmlFor="kits-motivo">Motivo da alteração</label>
    <textarea
      id="kits-motivo"
      value={valor}
      disabled={desabilitado}
      onChange={e => aoMudar(e.target.value)}
      rows={2}
      placeholder="Ex.: troca do modelo homologado pelo fornecedor; alinhado com o pré-vendas em 20/10."
      style={{ ...campo, resize: 'vertical' }}
    />
    <div style={ajuda}>Fica no histórico junto com o antes e o depois.</div>
  </div>
);
