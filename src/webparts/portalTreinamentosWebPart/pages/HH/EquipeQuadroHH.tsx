import * as React from 'react';

import {
  IFamiliaPO,
  IItemEquipeCampo,
  TIPOS_CUSTO,
  TipoCusto,
  ehMaoDeObra
} from '../../services/hh/modeloHH';

import {
  BotaoMini,
  COR,
  EntradaNumero,
  EntradaTexto,
  LinhaIndicador,
  Secao,
  Tabela,
  campo,
  horas,
  moeda,
  novoId,
  numero,
  td,
  tdTotal
} from './hhComum';

import { ISecaoHHProps } from './tiposTela';

// ============================================================
// HH — EQUIPE DE CAMPO e QUADRO P.O. AGREGADO
// ============================================================

const botaoAdicionar: React.CSSProperties = { border: 0, background: COR.azul, color: COR.branco, borderRadius: '6px', padding: '0 14px', minHeight: '34px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' };

export const EquipeCampoHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {
  const e = resultado.equipe;
  const familias = dados.quadroPO.map(f => f.familia);

  const mudarItem = (id: string, parcial: Partial<IItemEquipeCampo>): void =>
    mudar(d => ({ ...d, equipeCampo: d.equipeCampo.map(i => (i.id === id ? { ...i, ...parcial } : i)) }));

  return (
    <div>
      <Secao
        titulo="Equipe de campo — itens de custo"
        subtitulo='Tipo de custo: "Recorrente" entra todo mês; "1° mês" é diluído pelos meses da premissa; "Anual" ÷ 12. Valores de mão de obra já incluem o fator de encargos.'
        acoes={editavel && (
          <button type="button" style={botaoAdicionar} onClick={() => mudar(d => ({ ...d, equipeCampo: [...d.equipeCampo, { id: novoId('e'), item: 'Novo item', tipo: 'Recorrente', valor: 0, quantidade: 1, maoDeObra: false }] }))}>+ Item</button>
        )}
      >
        <Tabela minimo="1100px" colunas={[{ titulo: 'Item', largura: '210px' }, { titulo: 'Tipo de custo', largura: '130px' }, { titulo: 'Valor referência (R$)', direita: true }, { titulo: 'Qtd.', direita: true }, { titulo: 'Custo 1º mês', direita: true }, { titulo: 'Custo anual', direita: true }, { titulo: 'Recorrente/mês', direita: true }, { titulo: 'Mão de obra' }, { titulo: '' }]}>
          {e.itens.map(i => {
            const orig = dados.equipeCampo.filter(x => x.id === i.id)[0];
            return (
              <tr key={i.id} style={{ opacity: i.quantidade ? 1 : 0.6 }}>
                <td style={td()}>
                  {editavel ? <EntradaTexto valor={i.item} rotulo="Item" aoMudar={v => mudarItem(i.id, { item: v, maoDeObra: ehMaoDeObra(v) })} /> : i.item}
                  {orig && orig.observacao && <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>{orig.observacao}</div>}
                </td>
                <td style={td()}>
                  {editavel
                    ? (
                      <select aria-label="Tipo de custo" value={i.tipo} onChange={ev => mudarItem(i.id, { tipo: ev.target.value as TipoCusto })} style={{ ...campo, minHeight: '32px', padding: '4px 6px', background: COR.cianoClaro }}>
                        {TIPOS_CUSTO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )
                    : i.tipo}
                </td>
                <td style={td(true)}>
                  {i.vinculado
                    ? <span title={`Salário médio de "${orig && orig.familiaVinculada}" × fator de encargos`}><strong>{numero(i.valor, 2)}</strong><div style={{ fontSize: '11px', color: COR.indigo }}>do quadro P.O.</div></span>
                    : editavel ? <EntradaNumero valor={i.valor} largura="110px" rotulo="Valor" aoMudar={v => mudarItem(i.id, { valor: v || 0 })} /> : numero(i.valor, 2)}
                  {editavel && (
                    <select aria-label="Vincular ao quadro" title="Vincular ao salário médio de uma família do quadro P.O." value={(orig && orig.familiaVinculada) || ''} onChange={ev => mudarItem(i.id, { familiaVinculada: ev.target.value || undefined })} style={{ ...campo, minHeight: '26px', padding: '2px 4px', fontSize: '11.5px', marginTop: '4px', width: '110px' }}>
                      <option value="">valor digitado</option>
                      {familias.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  )}
                </td>
                <td style={td(true)}>{editavel ? <EntradaNumero valor={i.quantidade} largura="64px" rotulo="Quantidade" aoMudar={v => mudarItem(i.id, { quantidade: v || 0 })} /> : numero(i.quantidade)}</td>
                <td style={td(true)}>{numero(i.primeiroMes, 2)}</td>
                <td style={td(true)}>{numero(i.anual, 2)}</td>
                <td style={td(true)}>{numero(i.recorrente, 2)}</td>
                <td style={td()}><input type="checkbox" aria-label="Mão de obra" disabled={!editavel} checked={i.maoDeObra} onChange={ev => mudarItem(i.id, { maoDeObra: ev.target.checked })} /></td>
                <td style={td(true)}>{editavel && <BotaoMini titulo="Remover item" aoClicar={() => mudar(d => ({ ...d, equipeCampo: d.equipeCampo.filter(x => x.id !== i.id) }))}>✕</BotaoMini>}</td>
              </tr>
            );
          })}
          <tr>
            <td style={tdTotal()} colSpan={4}>Subtotal</td>
            <td style={tdTotal(true)}>{numero(e.subtotal.primeiroMes, 2)}</td>
            <td style={tdTotal(true)}>{numero(e.subtotal.anual, 2)}</td>
            <td style={tdTotal(true)}>{numero(e.subtotal.recorrente, 2)}</td>
            <td style={tdTotal()} colSpan={2} />
          </tr>
        </Tabela>
      </Secao>

      <Secao titulo="Indicadores da equipe de campo">
        <Tabela colunas={[{ titulo: 'Indicador' }, { titulo: 'Valor', direita: true, largura: '170px' }, { titulo: 'Como é calculado' }]}>
          <LinhaIndicador rotulo="Custo mensal equivalente (R$)" valor={moeda(e.custoMensalEquivalente)} como="Recorrente + itens de 1º mês ÷ meses de diluição + anuais ÷ 12." />
          <LinhaIndicador rotulo="Pessoas na equipe de campo" valor={numero(e.pessoas)} como="Premissas." />
          <LinhaIndicador rotulo="Horas produtivas da equipe/mês" valor={horas(e.horasProdutivas)} como="Pessoas × horas produtivas por colaborador." />
          <LinhaIndicador destaque rotulo="HH da equipe de campo (R$/h)" valor={moeda(e.hh)} como="Custo mensal equivalente ÷ horas produtivas da equipe." />
          <LinhaIndicador rotulo="HH só mão de obra (R$/h)" valor={moeda(e.hhMaoDeObra)} como="Só os itens marcados como mão de obra ÷ horas produtivas da equipe." />
          <LinhaIndicador rotulo="Pontos/localidades atendidos por dia" valor={numero(e.pontosDia)} como="Premissas." />
          <LinhaIndicador rotulo="Pontos/localidades atendidos por mês" valor={numero(e.pontosMes)} como="Pontos por dia × dias úteis." />
          <LinhaIndicador destaque rotulo="Custo por ponto/localidade atendido (R$)" valor={moeda(e.custoPorPonto)} como="Custo mensal equivalente ÷ pontos por mês." />
          <LinhaIndicador rotulo="Horas-homem por ponto/localidade" valor={numero(e.horasHomemPorPonto, 4)} como="Horas produtivas da equipe ÷ pontos por mês." />
        </Tabela>
      </Secao>
    </div>
  );
};

export const QuadroPOHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {
  const q = resultado.quadro;
  const mudarFam = (id: string, parcial: Partial<IFamiliaPO>): void =>
    mudar(d => ({ ...d, quadroPO: d.quadroPO.map(f => (f.id === id ? { ...f, ...parcial } : f)) }));

  return (
    <Secao
      titulo="Quadro P.O. — agregado por família de função"
      subtitulo="LGPD: sem nomes nem valores individuais, só grupos com 3 ou mais posições. HH por família = salário total × fator de encargos ÷ (posições × horas produtivas). Não inclui benefícios, veículos, licenças nem terceiros."
      acoes={editavel && (
        <button type="button" style={botaoAdicionar} onClick={() => mudar(d => ({ ...d, quadroPO: [...d.quadroPO, { id: novoId('q'), familia: 'Nova família', posicoes: 3, salarioTotal: 0 }] }))}>+ Família</button>
      )}
    >
      {dados.quadroPO.some(f => f.posicoes > 0 && f.posicoes < 3) && (
        <div style={{ marginBottom: '10px', fontSize: '13px', color: COR.indigo, fontWeight: 600 }}>! Há família com menos de 3 posições: agrupe para não expor salário individual (LGPD).</div>
      )}
      <Tabela minimo="1000px" colunas={[{ titulo: 'Família de função', largura: '260px' }, { titulo: 'Posições', direita: true }, { titulo: 'Ocupadas', direita: true }, { titulo: 'Salário total/mês', direita: true }, { titulo: 'Salário médio', direita: true }, { titulo: 'Custo c/ encargos/mês', direita: true }, { titulo: 'Horas produtivas', direita: true }, { titulo: 'HH (R$/h)', direita: true }, { titulo: '' }]}>
        {q.familias.map((f, i) => {
          const orig = dados.quadroPO[i];
          return (
            <tr key={orig.id}>
              <td style={td()}>
                {editavel ? <EntradaTexto valor={orig.familia} rotulo="Família" aoMudar={v => mudarFam(orig.id, { familia: v })} /> : f.familia}
                {orig.composicao && <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>{orig.composicao}</div>}
              </td>
              <td style={td(true)}>{editavel ? <EntradaNumero valor={orig.posicoes} largura="64px" rotulo="Posições" aoMudar={v => mudarFam(orig.id, { posicoes: v || 0 })} /> : numero(f.posicoes)}</td>
              <td style={td(true)}>{editavel ? <EntradaNumero vazioPermitido valor={orig.ocupadas} largura="64px" rotulo="Ocupadas" aoMudar={v => mudarFam(orig.id, { ocupadas: v })} /> : (f.ocupadas === undefined || (f.ocupadas as unknown) === null ? '—' : numero(f.ocupadas))}</td>
              <td style={td(true)}>{editavel ? <EntradaNumero valor={orig.salarioTotal} largura="112px" rotulo="Salário total" aoMudar={v => mudarFam(orig.id, { salarioTotal: v || 0 })} /> : numero(f.salarioTotal, 2)}</td>
              <td style={td(true)}>{numero(f.salarioMedio, 2)}</td>
              <td style={td(true)}>{numero(f.custoEncargos, 2)}</td>
              <td style={td(true)}>{numero(f.horasProdutivas, 0)}</td>
              <td style={td(true, { fontWeight: 700 })}>{moeda(f.hh)}</td>
              <td style={td(true)}>{editavel && <BotaoMini titulo="Remover família" aoClicar={() => mudar(d => ({ ...d, quadroPO: d.quadroPO.filter(x => x.id !== orig.id) }))}>✕</BotaoMini>}</td>
            </tr>
          );
        })}
        <tr>
          <td style={tdTotal()}>Total</td>
          <td style={tdTotal(true)}>{numero(q.total.posicoes)}</td>
          <td style={tdTotal(true)}>{numero(q.total.ocupadas || 0)}</td>
          <td style={tdTotal(true)}>{numero(q.total.salarioTotal, 2)}</td>
          <td style={tdTotal(true)}>{numero(q.total.salarioMedio, 2)}</td>
          <td style={tdTotal(true)}>{numero(q.total.custoEncargos, 2)}</td>
          <td style={tdTotal(true)}>{numero(q.total.horasProdutivas, 0)}</td>
          <td style={tdTotal(true)}>{moeda(q.total.hh)}</td>
          <td style={tdTotal()} />
        </tr>
      </Tabela>
    </Secao>
  );
};
