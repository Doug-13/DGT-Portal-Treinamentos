import * as React from 'react';

import {
  RotulosGrafico
} from '../../services/dashboards/dashboardModelo';

// ============================================================
// GRÁFICOS DOS DASHBOARDS DO PORTAL (SVG, sem biblioteca)
// barras (verticais, empilhadas e horizontais), linhas e rosca.
// Cores da identidade DGT.
//
// Legibilidade:
//  - rótulos das categorias: "auto" mede os nomes e, se não couberem
//    lado a lado, inclina (-40°) ou deixa na vertical; a área do
//    gráfico cresce para baixo para o texto caber;
//  - valores: escritos sobre as barras (e dentro dos segmentos
//    empilhados que têm espaço) quando há poucas barras, ou sempre/
//    nunca, conforme "mostrarValores";
//  - nome completo e valor exato ao passar o mouse (<title>).
// ============================================================

export const PALETA = ['#21BADC', '#0B1E2D', '#1FA971', '#E6A400', '#D84C3E', '#6B7C8C', '#1596B4', '#8C3B4A', '#2E5A87', '#9AA9B8'];

// Cor do texto sobre cada cor da paleta (contraste).
const TEXTO_SOBRE = ['#0B1E2D', '#FFFFFF', '#FFFFFF', '#0B1E2D', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#0B1E2D'];

export interface ISerieGrafico {
  nome: string;
  valores: number[];
}

export interface IGraficoProps {
  categorias: string[];
  series: ISerieGrafico[];
  formatar: (valor: number) => string;
  // Altura da área de desenho (sem os rótulos).
  altura?: number;
  rotulos?: RotulosGrafico;
  mostrarValores?: boolean;
}

const LARGURA = 640;
const FONTE = 10.5;
const MARGEM = { topo: 18, direita: 14, esquerda: 76 };

// Largura aproximada do texto, por tipo de caractere (maiúsculas são
// bem mais largas; nomes de área costumam vir em caixa alta).
const larguraTexto = (texto: string, tamanho = FONTE): number => {
  let unidades = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charAt(i);
    if (c === ' ' || c === '·' || c === '.' || c === ',' || c === 'I' || c === 'i' || c === 'l' || c === 'j' || c === '|') {
      unidades += 0.32;
    } else if (c >= '0' && c <= '9') {
      unidades += 0.6;
    } else if (c !== c.toLowerCase()) {
      unidades += c === 'M' || c === 'W' ? 0.9 : 0.7;
    } else {
      unidades += c === 'm' || c === 'w' ? 0.85 : 0.56;
    }
  }
  return unidades * tamanho;
};

const cortar = (texto: string, maximo: number): string =>
  texto.length > maximo ? `${texto.substring(0, Math.max(1, maximo - 1))}…` : texto;

// Valor curto para escrever sobre a barra (ex.: 1,2 mil).
const curto = (valor: number, formatar: (v: number) => string): string => {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1000000) {
    return `${(valor / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (absoluto >= 10000) {
    return `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return formatar(valor).replace(/^R\$\s?/, '');
};

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

// ------------------------------------------------------------
// Rótulos das categorias
// ------------------------------------------------------------

export interface ILayoutRotulos {
  angulo: number;
  maximoCaracteres: number;
  base: number;
}

export const layoutRotulos = (categorias: string[], larguraCategoria: number, modo: RotulosGrafico = 'auto'): ILayoutRotulos => {
  const maior = categorias.reduce((m, c) => Math.max(m, larguraTexto(c)), 0);
  let angulo = 0;
  if (modo === 'inclinado') {
    angulo = -40;
  } else if (modo === 'vertical') {
    angulo = -90;
  } else if (modo === 'auto' && maior > larguraCategoria - 6) {
    angulo = categorias.length > 24 || larguraCategoria < 14 ? -90 : -40;
  }
  if (angulo === 0) {
    const caberia = Math.max(4, Math.floor((larguraCategoria - 6) / (FONTE * 0.62)));
    return { angulo, maximoCaracteres: Math.min(30, caberia), base: 30 };
  }
  const maximoCaracteres = angulo === -40 ? 24 : 26;
  const comprimento = Math.min(maior, larguraTexto('x'.repeat(maximoCaracteres)));
  const seno = Math.sin((Math.abs(angulo) * Math.PI) / 180);
  return { angulo, maximoCaracteres, base: Math.min(170, Math.round(comprimento * seno + FONTE + 18)) };
};

// Rótulos inclinados "crescem" para a esquerda: aumenta a margem para o
// primeiro nome não passar da borda do gráfico.
const margemEsquerda = (categorias: string[], modo: RotulosGrafico | undefined): { esquerda: number; larguraCategoria: number; layout: ILayoutRotulos } => {
  const n = Math.max(1, categorias.length);
  let esquerda = MARGEM.esquerda;
  let larguraCategoria = (LARGURA - esquerda - MARGEM.direita) / n;
  let layout = layoutRotulos(categorias, larguraCategoria, modo);
  if (layout.angulo === -40) {
    const cosseno = Math.cos((40 * Math.PI) / 180);
    let falta = 0;
    categorias.forEach((categoria, i) => {
      const comprimento = larguraTexto(cortar(categoria, layout.maximoCaracteres)) * cosseno;
      falta = Math.max(falta, comprimento - (esquerda + larguraCategoria * (i + 0.5)) + 8);
    });
    if (falta > 0) {
      esquerda = Math.min(220, esquerda + falta);
      larguraCategoria = (LARGURA - esquerda - MARGEM.direita) / n;
      layout = layoutRotulos(categorias, larguraCategoria, modo);
    }
  }
  return { esquerda, larguraCategoria, layout };
};

const RotuloCategoria: React.FC<{ texto: string; x: number; y: number; layout: ILayoutRotulos }> = ({ texto, x, y, layout }) => (
  <text
    x={x}
    y={y}
    textAnchor={layout.angulo === 0 ? 'middle' : 'end'}
    dominantBaseline={layout.angulo === -90 ? 'middle' : undefined}
    transform={layout.angulo === 0 ? undefined : `rotate(${layout.angulo} ${x} ${y})`}
    fontSize={FONTE}
    fill="#475569"
  >
    <title>{texto}</title>
    {cortar(texto, layout.maximoCaracteres)}
  </text>
);

// ------------------------------------------------------------
// Legenda e eixos
// ------------------------------------------------------------

const Legenda: React.FC<{ series: ISerieGrafico[] }> = ({ series }) =>
  series.length > 1 ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', fontSize: '11.5px', color: '#475569', marginTop: '6px' }}>
      {series.map((serie, indice) => (
        <span key={serie.nome} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <i style={{ width: '10px', height: '10px', borderRadius: '2px', background: PALETA[indice % PALETA.length], display: 'inline-block' }} />
          {serie.nome}
        </span>
      ))}
    </div>
  ) : null;

const EixoY: React.FC<{ marcas: number[]; y: (v: number) => number; formatar: (v: number) => string; esquerda?: number }> = ({ marcas, y, formatar, esquerda = MARGEM.esquerda }) => (
  <g>
    {marcas.map(marca => (
      <g key={marca}>
        <line x1={esquerda} x2={LARGURA - MARGEM.direita} y1={y(marca)} y2={y(marca)} stroke={marca === 0 ? '#94A3B8' : '#EEF2F6'} />
        <text x={esquerda - 6} y={y(marca) + 4} textAnchor="end" fontSize={FONTE} fill="#6B7C8C">{formatar(marca)}</text>
      </g>
    ))}
  </g>
);

const limites = (series: ISerieGrafico[], n: number, empilhado?: boolean): { minimo: number; maximo: number } => {
  let minimo = 0;
  let maximo = 0;
  for (let i = 0; i < n; i++) {
    if (empilhado) {
      let positivo = 0;
      let negativo = 0;
      series.forEach(serie => { const v = serie.valores[i] || 0; if (v >= 0) { positivo += v; } else { negativo += v; } });
      maximo = Math.max(maximo, positivo);
      minimo = Math.min(minimo, negativo);
    } else {
      series.forEach(serie => { const v = serie.valores[i] || 0; maximo = Math.max(maximo, v); minimo = Math.min(minimo, v); });
    }
  }
  return { minimo, maximo };
};

// ------------------------------------------------------------
// Barras verticais (agrupadas ou empilhadas)
// ------------------------------------------------------------

export const GraficoBarras: React.FC<IGraficoProps & { empilhado?: boolean }> = (props) => {
  const n = Math.max(1, props.categorias.length);
  const { minimo, maximo } = limites(props.series, n, props.empilhado);
  const { min, max, marcas } = escala(minimo, maximo);
  const { esquerda, larguraCategoria, layout } = margemEsquerda(props.categorias, props.rotulos);
  const area = (props.altura || 280) - MARGEM.topo - 52;
  const alturaSvg = MARGEM.topo + area + layout.base;
  const y = (v: number): number => MARGEM.topo + ((max - v) / (max - min)) * area;
  const grupos = props.empilhado ? 1 : props.series.length;
  const larguraBarra = Math.max(3, Math.min(42, (larguraCategoria * 0.72) / grupos));
  const mostrar = props.mostrarValores !== undefined
    ? props.mostrarValores
    : (props.empilhado ? n <= 20 : n * grupos <= 30) && larguraBarra >= 10;

  return (
    <div>
      <svg viewBox={`0 0 ${LARGURA} ${alturaSvg}`} width="100%" role="img" style={{ display: 'block' }}>
        <EixoY marcas={marcas} y={y} formatar={props.formatar} esquerda={esquerda} />
        {props.categorias.map((categoria, i) => {
          const centro = esquerda + larguraCategoria * i + larguraCategoria / 2;
          let acumuladoPositivo = 0;
          let acumuladoNegativo = 0;
          const barras = props.series.map((serie, s) => {
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
            const alturaBarra = Math.max(0.5, Math.abs(base - topo));
            const texto = curto(valor, props.formatar);
            const cabeDentro = props.empilhado && alturaBarra >= FONTE + 4 && larguraBarra >= larguraTexto(texto, 9.5) + 4;
            return (
              <g key={serie.nome}>
                <rect x={x} y={Math.min(topo, base)} width={larguraBarra - 1} height={alturaBarra} rx={2} fill={PALETA[s % PALETA.length]}>
                  <title>{`${categoria} — ${serie.nome}: ${props.formatar(valor)}`}</title>
                </rect>
                {mostrar && valor !== 0 && props.empilhado && cabeDentro && (
                  <text x={x + (larguraBarra - 1) / 2} y={Math.min(topo, base) + alturaBarra / 2 + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={TEXTO_SOBRE[s % TEXTO_SOBRE.length]} pointerEvents="none">
                    {texto}
                  </text>
                )}
                {mostrar && !props.empilhado && (
                  <text
                    x={x + (larguraBarra - 1) / 2}
                    y={valor >= 0 ? topo - 4 : base + 11}
                    textAnchor="middle"
                    fontSize={grupos > 1 ? 9 : 10}
                    fontWeight={700}
                    fill="#334155"
                    pointerEvents="none"
                  >
                    {texto}
                  </text>
                )}
              </g>
            );
          });
          const total = props.series.reduce((soma, serie) => soma + (serie.valores[i] || 0), 0);
          return (
            <g key={`${categoria}-${i}`}>
              {barras}
              {mostrar && props.empilhado && props.series.length > 1 && (
                <text x={centro} y={y(acumuladoPositivo) - 4} textAnchor="middle" fontSize={10} fontWeight={800} fill="#0B1E2D" pointerEvents="none">
                  {curto(total, props.formatar)}
                </text>
              )}
              <RotuloCategoria texto={categoria} x={centro} y={MARGEM.topo + area + (layout.angulo === 0 ? 16 : 10)} layout={layout} />
            </g>
          );
        })}
      </svg>
      <Legenda series={props.series} />
    </div>
  );
};

// ------------------------------------------------------------
// Barras horizontais (nomes longos ou muitas categorias)
// ------------------------------------------------------------

export const GraficoBarrasHorizontais: React.FC<IGraficoProps & { empilhado?: boolean }> = (props) => {
  const n = Math.max(1, props.categorias.length);
  const { minimo, maximo } = limites(props.series, n, props.empilhado);
  const { min, max, marcas } = escala(minimo, maximo);
  const maiorRotulo = props.categorias.reduce((m, c) => Math.max(m, larguraTexto(cortar(c, 34))), 0);
  const esquerda = Math.min(220, Math.max(60, Math.round(maiorRotulo + 14)));
  const grupos = props.empilhado ? 1 : props.series.length;
  const linha = Math.max(24, 12 + grupos * 10);
  const topo = 8;
  const alturaSvg = topo + linha * n + 26;
  const larguraUtil = LARGURA - esquerda - MARGEM.direita - 44;
  const x = (v: number): number => esquerda + ((v - min) / (max - min)) * larguraUtil;
  const espessura = Math.max(6, (linha * 0.66) / grupos);
  const mostrar = props.mostrarValores !== undefined ? props.mostrarValores : n * grupos <= 40;

  return (
    <div>
      <svg viewBox={`0 0 ${LARGURA} ${alturaSvg}`} width="100%" role="img" style={{ display: 'block' }}>
        {marcas.map(marca => (
          <g key={marca}>
            <line x1={x(marca)} x2={x(marca)} y1={topo} y2={topo + linha * n} stroke={marca === 0 ? '#94A3B8' : '#EEF2F6'} />
            <text x={x(marca)} y={topo + linha * n + 16} textAnchor="middle" fontSize={FONTE} fill="#6B7C8C">{props.formatar(marca)}</text>
          </g>
        ))}
        {props.categorias.map((categoria, i) => {
          const meio = topo + linha * i + linha / 2;
          let acumuladoPositivo = 0;
          let acumuladoNegativo = 0;
          const barras = props.series.map((serie, s) => {
            const valor = serie.valores[i] || 0;
            let inicio: number;
            let fim: number;
            let yBarra: number;
            if (props.empilhado) {
              yBarra = meio - espessura / 2;
              if (valor >= 0) {
                inicio = x(acumuladoPositivo);
                acumuladoPositivo += valor;
                fim = x(acumuladoPositivo);
              } else {
                fim = x(acumuladoNegativo);
                acumuladoNegativo += valor;
                inicio = x(acumuladoNegativo);
              }
            } else {
              yBarra = meio - (espessura * grupos) / 2 + espessura * s;
              inicio = x(Math.min(valor, 0));
              fim = x(Math.max(valor, 0));
            }
            const comprimento = Math.max(0.5, Math.abs(fim - inicio));
            const texto = curto(valor, props.formatar);
            const cabeDentro = props.empilhado && comprimento >= larguraTexto(texto, 9.5) + 8 && espessura >= 11;
            return (
              <g key={serie.nome}>
                <rect x={Math.min(inicio, fim)} y={yBarra} width={comprimento} height={espessura - 1} rx={2} fill={PALETA[s % PALETA.length]}>
                  <title>{`${categoria} — ${serie.nome}: ${props.formatar(valor)}`}</title>
                </rect>
                {mostrar && valor !== 0 && props.empilhado && cabeDentro && (
                  <text x={Math.min(inicio, fim) + comprimento / 2} y={yBarra + espessura / 2 + 3} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={TEXTO_SOBRE[s % TEXTO_SOBRE.length]} pointerEvents="none">
                    {texto}
                  </text>
                )}
                {mostrar && !props.empilhado && (
                  <text x={valor >= 0 ? fim + 4 : inicio - 4} y={yBarra + espessura / 2 + 3.5} textAnchor={valor >= 0 ? 'start' : 'end'} fontSize={10} fontWeight={700} fill="#334155" pointerEvents="none">
                    {texto}
                  </text>
                )}
              </g>
            );
          });
          const total = props.series.reduce((soma, serie) => soma + (serie.valores[i] || 0), 0);
          return (
            <g key={`${categoria}-${i}`}>
              <text x={esquerda - 8} y={meio + 3.5} textAnchor="end" fontSize={FONTE} fill="#334155">
                <title>{categoria}</title>
                {cortar(categoria, 34)}
              </text>
              {barras}
              {mostrar && props.empilhado && props.series.length > 1 && (
                <text x={x(acumuladoPositivo) + 4} y={meio + 3.5} textAnchor="start" fontSize={10} fontWeight={800} fill="#0B1E2D" pointerEvents="none">
                  {curto(total, props.formatar)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Legenda series={props.series} />
    </div>
  );
};

// ------------------------------------------------------------
// Linhas
// ------------------------------------------------------------

export const GraficoLinhas: React.FC<IGraficoProps> = (props) => {
  const n = Math.max(1, props.categorias.length);
  const todos = props.series.reduce((lista: number[], serie) => lista.concat(serie.valores.map(v => v || 0)), [0]);
  const { min, max, marcas } = escala(Math.min(...todos), Math.max(...todos));
  const { esquerda, larguraCategoria: passo, layout } = margemEsquerda(props.categorias, props.rotulos);
  const area = (props.altura || 280) - MARGEM.topo - 52;
  const alturaSvg = MARGEM.topo + area + layout.base;
  const y = (v: number): number => MARGEM.topo + ((max - v) / (max - min)) * area;
  const x = (i: number): number => esquerda + passo * i + passo / 2;
  const mostrar = props.mostrarValores !== undefined ? props.mostrarValores : n <= 14 && props.series.length <= 2;

  return (
    <div>
      <svg viewBox={`0 0 ${LARGURA} ${alturaSvg}`} width="100%" role="img" style={{ display: 'block' }}>
        <EixoY marcas={marcas} y={y} formatar={props.formatar} esquerda={esquerda} />
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
              <g key={i}>
                <circle cx={x(i)} cy={y(serie.valores[i] || 0)} r={3.5} fill={PALETA[s % PALETA.length]}>
                  <title>{`${categoria} — ${serie.nome}: ${props.formatar(serie.valores[i] || 0)}`}</title>
                </circle>
                {mostrar && (
                  <text x={x(i)} y={y(serie.valores[i] || 0) + (s === 0 ? -8 : 15)} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={PALETA[s % PALETA.length]} pointerEvents="none">
                    {curto(serie.valores[i] || 0, props.formatar)}
                  </text>
                )}
              </g>
            ))}
          </g>
        ))}
        {props.categorias.map((categoria, i) => (
          <RotuloCategoria key={i} texto={categoria} x={x(i)} y={MARGEM.topo + area + (layout.angulo === 0 ? 16 : 10)} layout={layout} />
        ))}
      </svg>
      <Legenda series={props.series} />
    </div>
  );
};

// ------------------------------------------------------------
// Rosca
// ------------------------------------------------------------

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
          const meio = inicio + fatia / 2;
          const percentual = Math.round((valor / total) * 100);
          return (
            <g key={i}>
              <path d={d} fill={PALETA[i % PALETA.length]}>
                <title>{`${props.categorias[i]}: ${props.formatar(props.series[0].valores[i] || 0)} (${percentual}%)`}</title>
              </path>
              {props.mostrarValores !== false && percentual >= 6 && (
                <text x={120 + (raio - espessura / 2) * Math.cos(meio)} y={120 + (raio - espessura / 2) * Math.sin(meio) + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXTO_SOBRE[i % TEXTO_SOBRE.length]} pointerEvents="none">
                  {`${percentual}%`}
                </text>
              )}
            </g>
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
