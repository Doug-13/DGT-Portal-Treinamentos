import * as React from 'react';

// ============================================================
// GRÁFICOS DOS DASHBOARDS DO PORTAL (SVG, sem biblioteca)
// barras, barras empilhadas, linhas e rosca. Valor exato ao passar o
// mouse (<title>). Cores da identidade DGT.
// ============================================================

export const PALETA = ['#21BADC', '#0B1E2D', '#1FA971', '#E6A400', '#D84C3E', '#6B7C8C', '#1596B4', '#8C3B4A', '#2E5A87', '#9AA9B8'];

export interface ISerieGrafico {
  nome: string;
  valores: number[];
}

export interface IGraficoProps {
  categorias: string[];
  series: ISerieGrafico[];
  formatar: (valor: number) => string;
  altura?: number;
}

const LARGURA = 640;
const MARGEM = { topo: 16, direita: 12, base: 52, esquerda: 76 };

const escala = (minimo: number, maximo: number): { min: number; max: number; marcas: number[] } => {
  let min = Math.min(0, minimo);
  let max = Math.max(0, maximo);
  if (min === max) {
    max = min + 1;
  }
  const passoBruto = (max - min) / 4;
  const potencia = Math.pow(10, Math.floor(Math.log10(Math.abs(passoBruto) || 1)));
  const passo = [1, 2, 2.5, 5, 10].map(f => f * potencia).filter(p => p >= passoBruto)[0] || passoBruto;
  min = Math.floor(min / passo) * passo;
  max = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = min; v <= max + passo / 2; v += passo) {
    marcas.push(Math.round(v * 100) / 100);
  }
  return { min, max, marcas };
};

const Legenda: React.FC<{ series: ISerieGrafico[] }> = ({ series }) =>
  series.length > 1 ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
      {series.map((serie, indice) => (
        <span key={serie.nome} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <i style={{ width: '10px', height: '10px', borderRadius: '2px', background: PALETA[indice % PALETA.length], display: 'inline-block' }} />
          {serie.nome}
        </span>
      ))}
    </div>
  ) : null;

const rotuloCurto = (texto: string): string => (texto.length > 14 ? `${texto.substring(0, 13)}…` : texto);

const Eixos: React.FC<{ marcas: number[]; y: (v: number) => number; formatar: (v: number) => string; largura: number }> = ({ marcas, y, formatar, largura }) => (
  <g>
    {marcas.map(marca => (
      <g key={marca}>
        <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(marca)} y2={y(marca)} stroke={marca === 0 ? '#94A3B8' : '#EEF2F6'} />
        <text x={MARGEM.esquerda - 6} y={y(marca) + 4} textAnchor="end" fontSize="10.5" fill="#6B7C8C">{formatar(marca)}</text>
      </g>
    ))}
  </g>
);

export const GraficoBarras: React.FC<IGraficoProps & { empilhado?: boolean }> = (props) => {
  const altura = props.altura || 280;
  const n = Math.max(1, props.categorias.length);
  let minimo = 0;
  let maximo = 0;
  props.categorias.forEach((_c, i) => {
    if (props.empilhado) {
      let positivo = 0;
      let negativo = 0;
      props.series.forEach(serie => { const v = serie.valores[i] || 0; if (v >= 0) { positivo += v; } else { negativo += v; } });
      maximo = Math.max(maximo, positivo);
      minimo = Math.min(minimo, negativo);
    } else {
      props.series.forEach(serie => { const v = serie.valores[i] || 0; maximo = Math.max(maximo, v); minimo = Math.min(minimo, v); });
    }
  });
  const { min, max, marcas } = escala(minimo, maximo);
  const area = altura - MARGEM.topo - MARGEM.base;
  const y = (v: number): number => MARGEM.topo + ((max - v) / (max - min)) * area;
  const larguraCategoria = (LARGURA - MARGEM.esquerda - MARGEM.direita) / n;
  const grupos = props.empilhado ? 1 : props.series.length;
  const larguraBarra = Math.max(3, Math.min(42, (larguraCategoria * 0.72) / grupos));

  return (
    <div>
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} width="100%" role="img" style={{ display: 'block' }}>
        <Eixos marcas={marcas} y={y} formatar={props.formatar} largura={LARGURA} />
        {props.categorias.map((categoria, i) => {
          const centro = MARGEM.esquerda + larguraCategoria * i + larguraCategoria / 2;
          let acumuladoPositivo = 0;
          let acumuladoNegativo = 0;
          return (
            <g key={`${categoria}-${i}`}>
              {props.series.map((serie, s) => {
                const valor = serie.valores[i] || 0;
                let x: number;
                let topo: number;
                let base: number;
                if (props.empilhado) {
                  x = centro - larguraBarra / 2;
                  if (valor >= 0) {
                    base = y(acumuladoPositivo);
                    acumuladoPositivo += valor;
                    topo = y(acumuladoPositivo);
                  } else {
                    topo = y(acumuladoNegativo);
                    acumuladoNegativo += valor;
                    base = y(acumuladoNegativo);
                  }
                } else {
                  x = centro - (larguraBarra * grupos) / 2 + larguraBarra * s;
                  topo = y(Math.max(valor, 0));
                  base = y(Math.min(valor, 0));
                }
                return (
                  <rect key={serie.nome} x={x} y={Math.min(topo, base)} width={larguraBarra - 1} height={Math.max(0.5, Math.abs(base - topo))} rx={2} fill={PALETA[s % PALETA.length]}>
                    <title>{`${categoria} — ${serie.nome}: ${props.formatar(valor)}`}</title>
                  </rect>
                );
              })}
              <text x={centro} y={altura - MARGEM.base + 16} textAnchor="middle" fontSize="10.5" fill="#475569">{rotuloCurto(categoria)}</text>
            </g>
          );
        })}
      </svg>
      <Legenda series={props.series} />
    </div>
  );
};

export const GraficoLinhas: React.FC<IGraficoProps> = (props) => {
  const altura = props.altura || 280;
  const n = Math.max(1, props.categorias.length);
  const todos = props.series.reduce((lista: number[], serie) => lista.concat(serie.valores.map(v => v || 0)), [0]);
  const { min, max, marcas } = escala(Math.min(...todos), Math.max(...todos));
  const area = altura - MARGEM.topo - MARGEM.base;
  const y = (v: number): number => MARGEM.topo + ((max - v) / (max - min)) * area;
  const passo = (LARGURA - MARGEM.esquerda - MARGEM.direita) / n;
  const x = (i: number): number => MARGEM.esquerda + passo * i + passo / 2;

  return (
    <div>
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} width="100%" role="img" style={{ display: 'block' }}>
        <Eixos marcas={marcas} y={y} formatar={props.formatar} largura={LARGURA} />
        {props.series.map((serie, s) => (
          <g key={serie.nome}>
            <polyline
              fill="none"
              stroke={PALETA[s % PALETA.length]}
              strokeWidth={2.5}
              strokeDasharray={s === 1 ? '6 4' : undefined}
              points={props.categorias.map((_c, i) => `${x(i)},${y(serie.valores[i] || 0)}`).join(' ')}
            />
            {props.categorias.map((categoria, i) => (
              <circle key={i} cx={x(i)} cy={y(serie.valores[i] || 0)} r={3.5} fill={PALETA[s % PALETA.length]}>
                <title>{`${categoria} — ${serie.nome}: ${props.formatar(serie.valores[i] || 0)}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {props.categorias.map((categoria, i) => (
          <text key={i} x={x(i)} y={altura - MARGEM.base + 16} textAnchor="middle" fontSize="10.5" fill="#475569">{rotuloCurto(categoria)}</text>
        ))}
      </svg>
      <Legenda series={props.series} />
    </div>
  );
};

export const GraficoRosca: React.FC<IGraficoProps> = (props) => {
  const valores = (props.series[0] ? props.series[0].valores : []).map(v => Math.abs(v || 0));
  const total = valores.reduce((soma, v) => soma + v, 0);
  const raio = 90;
  const espessura = 34;
  let angulo = -Math.PI / 2;
  const ponto = (a: number, r: number): string => `${120 + r * Math.cos(a)} ${120 + r * Math.sin(a)}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg viewBox="0 0 240 240" width="220" height="220" role="img">
        {total === 0 && <circle cx={120} cy={120} r={raio - espessura / 2} fill="none" stroke="#EEF2F6" strokeWidth={espessura} />}
        {valores.map((valor, i) => {
          if (!valor) {
            return null;
          }
          const fatia = (valor / total) * Math.PI * 2;
          const inicio = angulo;
          const fim = angulo + fatia - (valores.filter(Boolean).length > 1 ? 0.01 : 0);
          angulo += fatia;
          const grande = fatia > Math.PI ? 1 : 0;
          const d = valores.filter(Boolean).length === 1
            ? `M ${ponto(-Math.PI / 2, raio)} A ${raio} ${raio} 0 1 1 ${ponto(Math.PI * 1.5 - 0.001, raio)} L ${ponto(Math.PI * 1.5 - 0.001, raio - espessura)} A ${raio - espessura} ${raio - espessura} 0 1 0 ${ponto(-Math.PI / 2, raio - espessura)} Z`
            : `M ${ponto(inicio, raio)} A ${raio} ${raio} 0 ${grande} 1 ${ponto(fim, raio)} L ${ponto(fim, raio - espessura)} A ${raio - espessura} ${raio - espessura} 0 ${grande} 0 ${ponto(inicio, raio - espessura)} Z`;
          return (
            <path key={i} d={d} fill={PALETA[i % PALETA.length]}>
              <title>{`${props.categorias[i]}: ${props.formatar(props.series[0].valores[i] || 0)} (${Math.round((valor / total) * 100)}%)`}</title>
            </path>
          );
        })}
        <text x={120} y={116} textAnchor="middle" fontSize="20" fontWeight={800} fill="#0B1E2D">{props.formatar(props.series[0] ? props.series[0].valores.reduce((s, v) => s + (v || 0), 0) : 0)}</text>
        <text x={120} y={134} textAnchor="middle" fontSize="10.5" fill="#6B7C8C">total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', color: '#334155' }}>
        {props.categorias.map((categoria, i) => (
          <span key={`${categoria}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <i style={{ width: '10px', height: '10px', borderRadius: '2px', background: PALETA[i % PALETA.length], display: 'inline-block' }} />
            {categoria}: <strong>{props.formatar(props.series[0] ? props.series[0].valores[i] || 0 : 0)}</strong>
            {total > 0 && <span style={{ color: '#6B7C8C' }}>({Math.round((valores[i] / total) * 100)}%)</span>}
          </span>
        ))}
      </div>
    </div>
  );
};
