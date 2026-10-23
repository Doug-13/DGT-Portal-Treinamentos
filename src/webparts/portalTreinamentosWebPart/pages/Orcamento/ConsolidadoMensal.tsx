import * as React from 'react';

import {
  IAreaOrcamento,
  ILinhaOrcamento,
  IPlanilhaOrcamento,
  totalLinha
} from '../../services/orcamento/OrcamentoService';

import {
  STATUS_PLANILHA,
  statusEntregue
} from '../../services/orcamento/esquemaOrcamento';

import TabelaOrcamento from './TabelaOrcamento';

import {
  COR,
  CartaoNumero,
  baixarCsv,
  botao,
  campo,
  cartao,
  consolidarLinhas,
  formatarMoeda,
  gerarCsvOrcamento,
  nomeArquivoSeguro,
  somar,
  somarComSinal
} from './orcamentoComum';

import {
  calcularDre,
  totalAnualDre
} from '../../services/orcamento/dreOrcamento';

// ============================================================
// CONSOLIDADO GERAL MÊS A MÊS (Administrador)
//
// Soma todas as planilhas do ano (ou as filtradas por área/situação)
// conta a conta, mês a mês. Duas visões: por grupo (resumo) ou com
// todas as contas (detalhe).
// ============================================================

export interface IConsolidadoMensalProps {
  // (grupo|código) → regra que calcula a conta (marca ƒ nas contas).
  calculadas?: { [chave: string]: string };
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

  // Valores com sinal (como na planilha).
  const dre = calcularDre(consolidadas);
  const receita = totalAnualDre('RECEITA BRUTA', dre);
  // Total = receitas − deduções, custos e despesas.
  const totalAno = Math.round(consolidadas.reduce((soma, linha) => soma + somar(somarComSinal([linha])), 0) * 100) / 100;
  const lucroLiquido = totalAnualDre('LL', dre);

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
        <CartaoNumero titulo="Receita bruta (ano)" valor={formatarMoeda(receita)} detalhe={`${consolidadas.length} conta(s) com valor`} />
        <CartaoNumero titulo="Total do ano" valor={formatarMoeda(totalAno)} detalhe="Receitas − deduções, custos e despesas" />
        <CartaoNumero titulo="Lucro líquido (ano)" valor={formatarMoeda(lucroLiquido)} />
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
      ) : (
        // Formato da planilha: seções, grupos, resultados (Lucro Bruto,
        // LAIR, EBITDA…) e %; "Detalhar por conta" mostra as contas.
        <TabelaOrcamento
          linhas={consolidadas}
          ano={props.ano}
          somenteLeitura={true}
          somenteTotais={!detalhar}
          calculadas={props.calculadas}
        />
      )}
    </>
  );
};

export default ConsolidadoMensal;
