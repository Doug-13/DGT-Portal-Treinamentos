import * as React from 'react';

import {
  GRUPOS_CUSTO,
  GrupoCusto,
  ILinhaCusto
} from '../../services/hh/modeloHH';

import {
  BotaoMini,
  COR,
  EntradaNumero,
  EntradaTexto,
  Secao,
  Tabela,
  campo,
  moeda,
  novoId,
  numero,
  pct,
  td,
  tdTotal
} from './hhComum';

import { ISecaoHHProps } from './tiposTela';

// ============================================================
// HH — CUSTO MENSAL e HH MENSAL (abas "Custo Mensal" e "HH Mensal")
// ============================================================

const NOMES_VINCULO: Record<string, string> = {
  quadroPO: 'quadro P.O. × encargos',
  terceiros: 'terceiros da equipe de apoio',
  operacional: 'custos operacionais do grupo'
};

export const CustoMensalHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {

  const meses = dados.meses;
  const c = resultado.custos;
  const [grupo, setGrupo] = React.useState<'' | GrupoCusto>('');

  const mudarLinha = (id: string, fn: (l: ILinhaCusto) => ILinhaCusto): void =>
    mudar(d => ({ ...d, custos: d.custos.map(l => (l.id === id ? fn(l) : l)) }));

  const visiveis = c.linhas.filter(l => !grupo || l.grupo === grupo);

  return (
    <div>
      <Secao
        titulo="Custo mensal da área (R$)"
        subtitulo="Custo realizado por conta/item e mês (Mapa contábil, sinal invertido). Linhas marcadas como calculadas vêm de outras partes do cálculo."
        acoes={(
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select aria-label="Grupo" value={grupo} onChange={e => setGrupo(e.target.value as '' | GrupoCusto)} style={{ ...campo, width: 'auto', minHeight: '34px' }}>
              <option value="">Todos os grupos</option>
              {GRUPOS_CUSTO.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {editavel && (
              <button type="button" onClick={() => mudar(d => ({ ...d, custos: [...d.custos, { id: novoId('c'), item: 'Nova conta', grupo: grupo || 'Pessoal', valores: {} }] }))} style={{ border: 0, background: COR.azul, color: COR.branco, borderRadius: '6px', padding: '0 14px', minHeight: '34px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}>
                + Linha
              </button>
            )}
          </div>
        )}
      >
        <Tabela minimo="1750px" colunas={[{ titulo: 'Item / conta contábil', largura: '300px' }, { titulo: 'Grupo', largura: '150px' }, ...meses.map(m => ({ titulo: m, direita: true })), { titulo: `Total`, direita: true }, { titulo: '' }]}>
          {visiveis.map(l => {
            const original = dados.custos.filter(x => x.id === l.id)[0];
            return (
              <tr key={l.id}>
                <td style={td()}>
                  {editavel ? <EntradaTexto valor={l.item} largura="270px" rotulo="Item" aoMudar={v => mudarLinha(l.id, x => ({ ...x, item: v }))} /> : l.item}
                  {l.vinculo && <div style={{ fontSize: '11.5px', color: COR.indigo, marginTop: '2px' }}>calculado: {NOMES_VINCULO[l.vinculo]} ({original && original.mesVinculo})</div>}
                </td>
                <td style={td()}>
                  {editavel
                    ? (
                      <select aria-label="Grupo" value={l.grupo} onChange={e => mudarLinha(l.id, x => ({ ...x, grupo: e.target.value as GrupoCusto }))} style={{ ...campo, width: '140px', minHeight: '32px', padding: '4px 6px', background: COR.cianoClaro }}>
                        {GRUPOS_CUSTO.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )
                    : l.grupo}
                </td>
                {meses.map(m => (
                  <td key={m} style={td(true)}>
                    {l.vinculo && original && m === original.mesVinculo
                      ? <strong title="Calculado">{numero(l.valores[m], 2)}</strong>
                      : editavel
                        ? <EntradaNumero valor={original ? original.valores[m] : 0} largura="104px" rotulo={`${l.item} ${m}`} aoMudar={v => mudarLinha(l.id, x => ({ ...x, valores: { ...x.valores, [m]: v || 0 } }))} />
                        : numero(l.valores[m], 2)}
                  </td>
                ))}
                <td style={tdTotal(true)}>{numero(l.total, 2)}</td>
                <td style={td(true)}>
                  {editavel && !l.vinculo && <BotaoMini titulo="Remover linha" aoClicar={() => { if (window.confirm(`Remover "${l.item}"?`)) { mudar(d => ({ ...d, custos: d.custos.filter(x => x.id !== l.id) })); } }}>✕</BotaoMini>}
                </td>
              </tr>
            );
          })}
          <tr>
            <td style={tdTotal()} colSpan={2}>Total custo da área</td>
            {meses.map(m => <td key={m} style={tdTotal(true)}>{numero(c.totalMes[m], 2)}</td>)}
            <td style={tdTotal(true)}>{numero(c.total, 2)}</td>
            <td style={tdTotal()} />
          </tr>
          <tr>
            <td style={td()} colSpan={2}>Conferência: total do Mapa contábil</td>
            {meses.map(m => (
              <td key={m} style={td(true)}>
                {editavel
                  ? <EntradaNumero vazioPermitido valor={dados.conferenciaMapa[m]} largura="104px" rotulo={`Conferência ${m}`} aoMudar={v => mudar(d => ({ ...d, conferenciaMapa: { ...d.conferenciaMapa, [m]: v } }))} />
                  : c.conferencia[m] === undefined ? '' : numero(c.conferencia[m] as number, 2)}
              </td>
            ))}
            <td style={td()} colSpan={2} />
          </tr>
          <tr>
            <td style={td()} colSpan={2}>Diferença (deve ser zero)</td>
            {meses.map(m => (
              <td key={m} style={td(true, { color: Math.abs(c.diferenca[m]) > 0.005 ? COR.indigo : COR.texto2, fontWeight: Math.abs(c.diferenca[m]) > 0.005 ? 700 : 400 })}>
                {Math.abs(c.diferenca[m]) > 0.005 ? `! ${numero(c.diferenca[m], 2)}` : '0'}
              </td>
            ))}
            <td style={td()} colSpan={2} />
          </tr>
        </Tabela>
      </Secao>

      <Secao titulo="Resumo por grupo">
        <Tabela minimo="1200px" colunas={[{ titulo: 'Grupo' }, ...meses.map(m => ({ titulo: m, direita: true })), { titulo: 'Total', direita: true }, { titulo: '% do total', direita: true }]}>
          {c.porGrupo.map(g => (
            <tr key={g.grupo}>
              <td style={td()}>{g.grupo}</td>
              {meses.map(m => <td key={m} style={td(true)}>{numero(g.valores[m], 2)}</td>)}
              <td style={tdTotal(true)}>{numero(g.total, 2)}</td>
              <td style={td(true)}>{pct(g.pct)}</td>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </div>
  );
};

export const HHMensal: React.FC<ISecaoHHProps> = ({ dados, resultado }) => {
  const h = resultado.hhMensal;
  const p = dados.premissas;
  const linha = (m: typeof h.media, total?: boolean): React.ReactNode => {
    const estilo = total ? tdTotal : td;
    const ref = m.mes === p.mesReferencia;
    return (
      <tr key={m.mes} style={{ background: ref ? COR.cianoClaro : 'transparent' }}>
        <td style={estilo()}>{total ? 'Média dos meses com custo (ponderada)' : m.mes}{ref ? ' · referência' : ''}</td>
        <td style={estilo(true)}>{moeda(m.custoTotal)}</td>
        <td style={estilo(true)}>{moeda(m.custoPessoal)}</td>
        <td style={estilo(true)}>{numero(m.headcount, 2)}</td>
        <td style={estilo(true)}>{numero(m.horasProdutivas, 0)}</td>
        <td style={estilo(true)}>{moeda(m.hhCheio)}</td>
        <td style={estilo(true)}>{moeda(m.hhPessoal)}</td>
        <td style={estilo(true)}>{moeda(m.custoPorPessoa)}</td>
      </tr>
    );
  };
  return (
    <Secao
      titulo="HH da área por mês (R$/hora)"
      subtitulo={`HH = custo do mês ÷ (headcount do mês × ${numero(p.horasMes)} h × ${pct(p.produtividade, 0)}). "Cheio" usa todo o custo da área; "Pessoal" só o grupo Pessoal. Meses sem custo ficam com HH zero e não entram na média.`}
    >
      <Tabela minimo="900px" colunas={[{ titulo: 'Mês' }, { titulo: 'Custo total', direita: true }, { titulo: 'Custo pessoal', direita: true }, { titulo: 'Headcount', direita: true }, { titulo: 'Horas produtivas', direita: true }, { titulo: 'HH cheio (R$/h)', direita: true }, { titulo: 'HH pessoal (R$/h)', direita: true }, { titulo: 'Custo médio por pessoa', direita: true }]}>
        {h.meses.map(m => linha(m))}
        {linha(h.media, true)}
      </Tabela>
    </Secao>
  );
};
