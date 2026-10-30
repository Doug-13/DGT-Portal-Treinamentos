import * as React from 'react';

import {
  COR,
  FONTE,
  campo,
  celula,
  celulaCabecalho,
  painel
} from '../Kits/kitsComum';

// ============================================================
// CÁLCULO DE HH — ELEMENTOS COMUNS
//
// Mesmo padrão visual da aba Kits (identidade DGT). Campos editáveis
// têm fundo azul-claro, como as células de entrada das planilhas;
// valores calculados ficam em texto.
// ============================================================

export { COR, FONTE, campo, celula, celulaCabecalho, painel };

export const moeda = (v: number, casas = 2): string =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

// Com 2 casas (valores em R$) mostra sempre as duas: 8.968,00.
export const numero = (v: number, casas = 1): string =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas === 2 ? 2 : 0, maximumFractionDigits: casas });

export const pct = (v: number, casas = 1): string =>
  `${(Number(v || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const horas = (v: number): string => `${numero(v, 1)} h`;

const lerNumero = (texto: string): number | undefined => {
  const limpo = texto.replace(/R\$|%|\s/g, '').trim();
  if (limpo === '') {
    return undefined;
  }
  // "1.234,56" (pt-BR) ou "1234.56"
  const normal = limpo.indexOf(',') >= 0 ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return isNaN(n) ? undefined : n;
};

// Campo numérico pt-BR. Percentual: mostra 7 e grava 0,07.
export const EntradaNumero: React.FC<{
  valor: number | undefined;
  aoMudar: (v: number | undefined) => void;
  percentual?: boolean;
  desabilitado?: boolean;
  vazioPermitido?: boolean;
  largura?: string;
  rotulo?: string;
  casas?: number;
}> = ({ valor, aoMudar, percentual, desabilitado, vazioPermitido, largura = '120px', rotulo, casas = 4 }) => {

  const mostrar = (v: number | undefined): string =>
    (v as unknown) === null || v === undefined ? '' : (percentual ? v * 100 : v).toLocaleString('pt-BR', { maximumFractionDigits: casas });

  const [texto, setTexto] = React.useState(mostrar(valor));
  const [focado, setFocado] = React.useState(false);

  React.useEffect(() => {
    if (!focado) {
      setTexto(mostrar(valor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, focado]);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <input
        aria-label={rotulo}
        value={texto}
        disabled={desabilitado}
        inputMode="decimal"
        onFocus={() => setFocado(true)}
        onChange={e => {
          setTexto(e.target.value);
          const n = lerNumero(e.target.value);
          if (n !== undefined) {
            aoMudar(percentual ? n / 100 : n);
          } else if (e.target.value.trim() === '' && vazioPermitido) {
            aoMudar(undefined);
          }
        }}
        onBlur={() => {
          setFocado(false);
          if (texto.trim() === '' && !vazioPermitido) {
            aoMudar(0);
          }
        }}
        style={{
          ...campo,
          width: largura,
          minHeight: '32px',
          padding: '5px 8px',
          textAlign: 'right',
          background: desabilitado ? '#F7F8FA' : COR.cianoClaro,
          borderColor: desabilitado ? COR.cinzaClaro : '#9BE3EE',
          fontVariantNumeric: 'tabular-nums'
        }}
      />
      {percentual && <span style={{ color: COR.texto2, fontSize: '13px' }}>%</span>}
    </span>
  );
};

export const EntradaTexto: React.FC<{
  valor: string;
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
  largura?: string;
  rotulo?: string;
  placeholder?: string;
}> = ({ valor, aoMudar, desabilitado, largura = '100%', rotulo, placeholder }) => (
  <input
    aria-label={rotulo}
    value={valor || ''}
    disabled={desabilitado}
    placeholder={placeholder}
    onChange={e => aoMudar(e.target.value)}
    style={{ ...campo, width: largura, minHeight: '32px', padding: '5px 8px', background: desabilitado ? '#F7F8FA' : COR.cianoClaro, borderColor: desabilitado ? COR.cinzaClaro : '#9BE3EE' }}
  />
);

export const Secao: React.FC<{ titulo: string; subtitulo?: React.ReactNode; acoes?: React.ReactNode; children: React.ReactNode }> = ({ titulo, subtitulo, acoes, children }) => (
  <section style={{ ...painel, marginBottom: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
      <div style={{ flex: 1, minWidth: '220px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>{titulo}</h3>
        {subtitulo && <div style={{ fontSize: '13px', color: COR.texto2, marginTop: '3px', lineHeight: 1.45 }}>{subtitulo}</div>}
      </div>
      {acoes}
    </div>
    {children}
  </section>
);

// Tabela simples com rolagem horizontal.
export const Tabela: React.FC<{ colunas: Array<{ titulo: string; direita?: boolean; largura?: string }>; children: React.ReactNode; rodape?: React.ReactNode; minimo?: string }> = ({ colunas, children, rodape, minimo = '640px' }) => (
  <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '8px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: minimo, boxShadow: 'none', borderRadius: 0 }}>
      <thead>
        <tr>
          {colunas.map(c => (
            <th key={c.titulo} style={{ ...celulaCabecalho, textAlign: c.direita ? 'right' : 'left', width: c.largura }}>{c.titulo}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {rodape && <tfoot>{rodape}</tfoot>}
    </table>
  </div>
);

export const td = (direita?: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  ...celula,
  padding: '7px 12px',
  textAlign: direita ? 'right' : 'left',
  fontVariantNumeric: 'tabular-nums',
  ...extra
});

export const tdTotal = (direita?: boolean): React.CSSProperties => td(direita, { fontWeight: 700, background: COR.azulClaro });

// Linha "Indicador | Valor | Como é calculado" (como o Resumo HH).
export const LinhaIndicador: React.FC<{ rotulo: string; valor: React.ReactNode; como?: string; destaque?: boolean; recuo?: boolean }> = ({ rotulo, valor, como, destaque, recuo }) => (
  <tr style={{ background: destaque ? COR.cianoClaro : 'transparent' }}>
    <td style={td(false, { paddingLeft: recuo ? '28px' : '12px', fontWeight: destaque ? 700 : 400 })}>{rotulo}</td>
    <td style={td(true, { fontWeight: destaque ? 700 : 600, whiteSpace: 'nowrap', fontSize: destaque ? '16px' : '14px' })}>{valor}</td>
    <td style={td(false, { color: COR.texto2, fontSize: '13px' })}>{como}</td>
  </tr>
);

export const BotaoMini: React.FC<{ aoClicar: () => void; titulo: string; children: React.ReactNode; desabilitado?: boolean }> = ({ aoClicar, titulo, children, desabilitado }) => (
  <button
    type="button"
    title={titulo}
    aria-label={titulo}
    disabled={desabilitado}
    onClick={aoClicar}
    style={{ border: 0, background: 'none', padding: '4px 6px', color: COR.indigo, cursor: desabilitado ? 'not-allowed' : 'pointer', fontSize: '15px', fontFamily: FONTE, borderRadius: '4px', minHeight: 0 }}
  >
    {children}
  </button>
);

export const novoId = (prefixo: string): string =>
  `${prefixo}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
