import * as React from 'react';

import {
  IAreaOrcamento,
  ILinhaOrcamento,
  IPlanilhaOrcamento,
  totalLinha
} from '../../services/orcamento/OrcamentoService';

import {
  NOMES_MESES,
  STATUS_PLANILHA,
  statusEntregue
} from '../../services/orcamento/esquemaOrcamento';

import TabelaOrcamento from './TabelaOrcamento';

import {
  COR,
  CartaoNumero,
  FONTE,
  agruparLinhas,
  baixarCsv,
  botao,
  campo,
  cartao,
  consolidarLinhas,
  formatarMoeda,
  formatarValor,
  gerarCsvOrcamento,
  nomeArquivoSeguro,
  somar,
  somarMeses
} from './orcamentoComum';

// ============================================================
// CONSOLIDADO GERAL MÊS A MÊS (Administrador)
//
// Soma todas as planilhas do ano (ou as filtradas por área/situação)
// conta a conta, mês a mês. Duas visões: por grupo (resumo) ou com
// todas as contas (detalhe).
// ============================================================

export interface IConsolidadoMensalProps {
  ano: number;
  planilhas: IPlanilhaOrcamento[];
  linhas: ILinhaOrcamento[];
  areas: IAreaOrcamento[];
  onVoltar: () => void;
}

type FiltroSituacao = 'todas' | 'enviadas' | 'pendentes';

const ConsolidadoMensal: React.FC<IConsolidadoMensalProps> = (props) => {

  const [areaId, setAreaId] = React.useState<string>('*');
  const [situacao, setSituacao] = React.useState<FiltroSituacao>('todas');
  const [detalhar, setDetalhar] = React.useState(false);

  const planilhasFiltradas =
    props.planilhas.filter(item =>
      (areaId === '*' || item.areaId === areaId) &&
      (situacao === 'todas' ||
        (situacao === 'enviadas' ? statusEntregue(item.status) : !statusEntregue(item.status)))
    );

  const ids = planilhasFiltradas.map(item => item.id);

  const consolidadas =
    React.useMemo(
      () => consolidarLinhas(props.linhas.filter(linha => ids.indexOf(linha.planilhaId) >= 0))
        .filter(linha => totalLinha(linha) !== 0),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.linhas, ids.join('|')]
    );

  const grupos = agruparLinhas(consolidadas);
  const totais = somarMeses(consolidadas);
  const total = somar(totais);

  // Áreas que aparecem nas planilhas (inclui "Geral").
  const areasComPlanilha: IAreaOrcamento[] = [];
  props.planilhas.forEach(item => {
    if (!areasComPlanilha.some(area => area.id === item.areaId)) {
      const cadastrada = props.areas.filter(area => area.id === item.areaId)[0];
      areasComPlanilha.push({ id: item.areaId, nome: cadastrada ? cadastrada.nome : (item.areaNome || 'Geral (sem área)') });
    }
  });
  areasComPlanilha.sort((a, b) => a.nome.localeCompare(b.nome));

  const nomeFiltro =
    areaId === '*' ? 'todas as áreas' : (areasComPlanilha.filter(area => area.id === areaId)[0] || { nome: '' }).nome;

  const celula: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '13px',
    color: COR.azul,
    borderBottom: `1px solid ${COR.borda}`,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontFamily: FONTE
  };

  const exportar = (): void => {
    baixarCsv(
      `${nomeArquivoSeguro(`Orcamento_${props.ano}_consolidado_${nomeFiltro}`)}.csv`,
      gerarCsvOrcamento(props.ano, props.linhas.filter(linha => ids.indexOf(linha.planilhaId) >= 0), true)
    );
  };

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <button type="button" onClick={props.onVoltar} style={botao('secundario')}>
          ← Voltar
        </button>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: COR.azul }}>Consolidado geral mês a mês — {props.ano}</div>
          <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
            {planilhasFiltradas.length} planilha(s) · {nomeFiltro}
          </div>
        </div>
        <button type="button" onClick={exportar} disabled={planilhasFiltradas.length === 0} style={botao('principal', planilhasFiltradas.length === 0)}>
          Exportar CSV
        </button>
      </div>

      <div style={{ ...cartao, display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: COR.azul, display: 'flex', alignItems: 'center', gap: '8px' }}>
          Área
          <select value={areaId} onChange={evento => setAreaId(evento.target.value)} style={{ ...campo, width: 'auto', minWidth: '220px' }}>
            <option value="*">Todas as áreas</option>
            {areasComPlanilha.map(area => (
              <option key={area.id || 'geral'} value={area.id}>{area.nome}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '13px', fontWeight: 600, color: COR.azul, display: 'flex', alignItems: 'center', gap: '8px' }}>
          Situação
          <select value={situacao} onChange={evento => setSituacao(evento.target.value as FiltroSituacao)} style={{ ...campo, width: 'auto' }}>
            <option value="todas">Todas</option>
            <option value="enviadas">Enviadas (em aprovação ou aprovadas)</option>
            <option value="pendentes">Em preenchimento / devolvidas</option>
          </select>
        </label>
        <label style={{ fontSize: '13px', color: COR.azul, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={detalhar} onChange={evento => setDetalhar(evento.target.checked)} />
          Detalhar por conta
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <CartaoNumero titulo="Total anual" valor={formatarMoeda(total)} detalhe={`${consolidadas.length} conta(s) com valor`} />
        <CartaoNumero titulo="Média mensal" valor={formatarMoeda(total / 12)} />
        <CartaoNumero
          titulo="Planilhas consideradas"
          valor={String(planilhasFiltradas.length)}
          detalhe={`${planilhasFiltradas.filter(item => statusEntregue(item.status)).length} enviada(s) · ${planilhasFiltradas.filter(item => item.status === STATUS_PLANILHA.aprovada).length} aprovada(s)`}
        />
      </div>

      {consolidadas.length === 0 ? (
        <div style={{ ...cartao, textAlign: 'center', color: COR.texto2, fontSize: '13.5px' }}>
          Nenhum valor lançado nas planilhas selecionadas.
        </div>
      ) : detalhar ? (
        <TabelaOrcamento linhas={consolidadas} ano={props.ano} somenteLeitura={true} />
      ) : (
        <div style={{ overflow: 'auto', maxHeight: '68vh', maxWidth: '100%', border: `1px solid ${COR.borda}`, borderRadius: '10px', background: '#FFFFFF' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: FONTE }}>
            <thead>
              <tr>
                <th style={{ ...celula, textAlign: 'left', background: '#F1F5F9', position: 'sticky', left: 0, top: 0, minWidth: '240px', zIndex: 3 }}>Grupo</th>
                {NOMES_MESES.map(mes => (
                  <th key={mes} style={{ ...celula, background: '#F1F5F9', minWidth: '96px', position: 'sticky', top: 0, zIndex: 2 }}>{mes}/{String(props.ano).substring(2)}</th>
                ))}
                <th style={{ ...celula, background: '#F1F5F9', minWidth: '112px', position: 'sticky', top: 0, zIndex: 2 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(grupo => (
                <tr key={grupo.grupo}>
                  <td style={{ ...celula, textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: '#FFFFFF', boxShadow: `1px 0 0 ${COR.borda}`, whiteSpace: 'normal' }}>
                    {grupo.grupo}
                  </td>
                  {grupo.totais.map((valor, mes) => (
                    <td key={mes} style={celula}>{valor ? formatarValor(valor) : <span style={{ color: '#CBD5E1' }}>0,00</span>}</td>
                  ))}
                  <td style={{ ...celula, fontWeight: 700 }}>{formatarValor(grupo.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...celula, textAlign: 'left', background: COR.azul, color: '#FFFFFF', fontWeight: 700, position: 'sticky', left: 0 }}>TOTAL GERAL</td>
                {totais.map((valor, mes) => (
                  <td key={mes} style={{ ...celula, background: COR.azul, color: '#FFFFFF', fontWeight: 700 }}>{formatarValor(valor)}</td>
                ))}
                <td style={{ ...celula, background: COR.azul, color: '#FFFFFF', fontWeight: 700 }}>{formatarValor(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
};

export default ConsolidadoMensal;
