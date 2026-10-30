import * as React from 'react';

import {
  COR,
  LinhaIndicador,
  Secao,
  Tabela,
  horas,
  moeda,
  numero,
  pct
} from './hhComum';

import { ISecaoHHProps } from './tiposTela';

// ============================================================
// HH — RESUMO (aba "Resumo HH" da planilha)
// ============================================================

const COLS = [{ titulo: 'Indicador' }, { titulo: 'Valor', direita: true, largura: '170px' }, { titulo: 'Como é calculado' }];

const Destaque: React.FC<{ rotulo: string; valor: string; detalhe: string; principal?: boolean }> = ({ rotulo, valor, detalhe, principal }) => (
  <div style={{ flex: '1 1 220px', padding: '16px 18px', borderRadius: '10px', background: principal ? COR.azul : COR.branco, color: principal ? COR.branco : COR.azul, border: `1px solid ${principal ? COR.azul : COR.cinzaClaro}`, boxShadow: principal ? `inset 0 -4px 0 ${COR.ciano}` : 'none' }}>
    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.85 }}>{rotulo}</div>
    <div style={{ fontSize: '28px', fontWeight: 700, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    <div style={{ fontSize: '12.5px', opacity: 0.8, lineHeight: 1.4 }}>{detalhe}</div>
  </div>
);

const ResumoHH: React.FC<ISecaoHHProps> = ({ dados, resultado }) => {
  const r = resultado.resumo;
  const p = dados.premissas;

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Destaque principal rotulo="HH por ponto/localidade" valor={moeda(r.hhPorPonto)} detalhe="Valor médio para o B.O.M (R$ por ponto)." />
        <Destaque rotulo="% fixo no B.O.M" valor={pct(r.pctFixo)} detalhe={`Analista de Projetos ${pct(r.pctAnalista)} + Suprimentos ${pct(r.pctSuprimentos, 2)}.`} />
        <Destaque rotulo="B.O.M mínimo por ponto" valor={moeda(r.bomMinimoPorPonto)} detalhe="Abaixo disso, o % fixo não cobre o HH do ponto." />
        <Destaque rotulo="HH da equipe de campo" valor={`${moeda(r.hhEquipe)}/h`} detalhe={`${numero(r.horasHomemPorPonto, 2)} horas-homem por ponto.`} />
      </div>

      <Secao titulo="Valor para o B.O.M">
        <Tabela colunas={COLS}>
          <LinhaIndicador destaque rotulo="HH por ponto/localidade — valor MÉDIO para o B.O.M (R$/ponto)" valor={moeda(r.hhPorPonto)} como="HH da equipe de campo × horas-homem por ponto (memória abaixo)." />
          <LinhaIndicador rotulo="% FIXO aplicado no B.O.M" valor={pct(r.pctFixo, 2)} como="% Analista de Projetos + % Suprimentos (premissas). É o percentual usado na construção do B.O.M." />
          <LinhaIndicador recuo rotulo="• % Analista de Projetos (horas no projeto)" valor={pct(r.pctAnalista, 2)} como={`Premissa editável: ${pct(r.pctAnalista)} do custo total ÷ ${moeda(p.valorHoraAnalista, 0)}/h.`} />
          <LinhaIndicador recuo rotulo="• % Suprimentos" valor={pct(r.pctSuprimentos, 2)} como={`Premissa editável: ${pct(r.pctSuprimentos)} do custo total ÷ ${moeda(p.valorHoraSuprimentos, 0)}/h.`} />
          <LinhaIndicador rotulo="B.O.M mínimo por ponto para o % fixo cobrir o HH (R$)" valor={moeda(r.bomMinimoPorPonto)} como="HH por ponto ÷ % fixo. Abaixo desse valor de B.O.M por ponto, o % fixo não cobre o HH." />
          <LinhaIndicador rotulo="Valor médio do B.O.M por ponto/localidade (R$)" valor={r.valorMedioBomPonto ? moeda(r.valorMedioBomPonto) : '—'} como="Opcional, informado nas premissas. Base do % real." />
          <LinhaIndicador rotulo="% real do HH sobre o B.O.M por ponto" valor={r.valorMedioBomPonto ? pct(r.pctReal, 2) : '—'} como="HH por ponto ÷ valor médio do B.O.M por ponto." />
          <LinhaIndicador rotulo="Leitura" valor="" como={r.leitura} />
        </Tabela>
      </Secao>

      <Secao titulo="Regra de alocação de horas no projeto" subtitulo="Preencha o custo total do projeto nas premissas para ver as horas alocadas. No B.O.M. o custo vem do próprio projeto.">
        <Tabela colunas={COLS}>
          <LinhaIndicador rotulo="Custo total do projeto (B.O.M) (R$)" valor={moeda(r.custoTotalProjeto)} como="Informado nas premissas." />
          <LinhaIndicador rotulo="Analista de Projetos — valor alocado (R$)" valor={moeda(r.valorAnalista)} como={`${pct(r.pctAnalista)} do custo total.`} />
          <LinhaIndicador rotulo="Analista de Projetos — horas alocadas (h)" valor={horas(r.horasAnalista)} como={`Valor alocado ÷ ${moeda(p.valorHoraAnalista, 0)}/h.`} />
          <LinhaIndicador rotulo="Suprimentos — valor alocado (R$)" valor={moeda(r.valorSuprimentos)} como={`${pct(r.pctSuprimentos)} do custo total.`} />
          <LinhaIndicador rotulo="Suprimentos — horas alocadas (h)" valor={horas(r.horasSuprimentos)} como={`Valor alocado ÷ ${moeda(p.valorHoraSuprimentos, 0)}/h.`} />
          <LinhaIndicador rotulo="Total alocado ao HH no projeto (R$)" valor={moeda(r.totalAlocado)} como={`Analista de Projetos + Suprimentos (${pct(r.pctFixo)} do custo total).`} />
          <LinhaIndicador rotulo="Total de horas alocadas no projeto (h)" valor={horas(r.totalHorasAlocadas)} como="Horas do Analista de Projetos + horas de Suprimentos." />
        </Tabela>
      </Secao>

      <Secao titulo="Memória do valor por ponto/localidade">
        <Tabela colunas={COLS}>
          <LinhaIndicador rotulo="HH da equipe de campo (R$/h)" valor={moeda(r.hhEquipeCampo)} como="Equipe de campo: custo mensal equivalente ÷ horas produtivas da equipe." />
          <LinhaIndicador rotulo="Pessoas na equipe de campo" valor={numero(r.pessoasEquipe)} como="Premissas." />
          <LinhaIndicador rotulo="Horas produtivas por pessoa/mês" valor={horas(r.horasProdutivasPessoa)} como={`${numero(p.horasMes)} h × produtividade de ${pct(p.produtividade, 0)} (premissas).`} />
          <LinhaIndicador rotulo="Pontos/localidades por dia" valor={numero(r.pontosDia)} como="Premissas." />
          <LinhaIndicador rotulo="Dias úteis no mês" valor={numero(r.diasUteis)} como="Premissas." />
          <LinhaIndicador rotulo="Pontos/localidades por mês" valor={numero(r.pontosMes)} como="Pontos por dia × dias úteis." />
          <LinhaIndicador rotulo="Horas-homem por ponto/localidade" valor={numero(r.horasHomemPorPonto, 4)} como="Pessoas × horas produtivas ÷ pontos por mês." />
          <LinhaIndicador destaque rotulo="HH por ponto/localidade (R$/ponto)" valor={moeda(r.hhPorPonto)} como="HH da equipe de campo × horas-homem por ponto." />
        </Tabela>
      </Secao>

      <Secao titulo="Indicadores de HH (R$/h)">
        <Tabela colunas={COLS}>
          <LinhaIndicador rotulo="HH cheio da área — mês de referência (R$/h)" valor={moeda(r.hhCheioMesRef)} como={`Custo da área em ${r.mesReferencia} ÷ (headcount × ${numero(p.horasMes)} h × ${pct(p.produtividade, 0)}).`} />
          <LinhaIndicador rotulo="HH pessoal da área — mês de referência (R$/h)" valor={moeda(r.hhPessoalMesRef)} como="Só o grupo Pessoal ÷ horas produtivas." />
          <LinhaIndicador rotulo="HH cheio — média dos meses com custo (R$/h)" valor={moeda(r.hhCheioMedia)} como="Meses com custo, ponderados pelas horas." />
          <LinhaIndicador rotulo="HH da equipe de campo (R$/h)" valor={moeda(r.hhEquipe)} como="Custo mensal equivalente da equipe ÷ horas produtivas da equipe." />
          <LinhaIndicador rotulo="HH só mão de obra da equipe de campo (R$/h)" valor={moeda(r.hhMaoDeObra)} como="Técnicos + periculosidade + sobreaviso ÷ horas produtivas da equipe." />
          <LinhaIndicador rotulo="Custo por ponto/localidade da equipe de campo (R$)" valor={moeda(r.custoPorPontoEquipe)} como="Custo mensal equivalente da equipe ÷ (pontos/dia × dias úteis)." />
          <LinhaIndicador rotulo="HH médio do quadro P.O. (R$/h)" valor={moeda(r.hhQuadro)} como="Salário total × fator de encargos ÷ (posições × horas produtivas)." />
          <LinhaIndicador rotulo={'HH de referência do RH, aba "Média HH" (R$/h)'} valor={moeda(r.hhRh)} como={`Valor do RH sobre ${numero(p.horasMes)} h (sem produtividade), para comparação.`} />
          <LinhaIndicador rotulo="HH do RH ajustado à produtividade (R$/h)" valor={moeda(r.hhRhAjustado)} como="Referência do RH ÷ produtividade, comparável aos demais." />
          <LinhaIndicador rotulo="Diferença: HH do quadro P.O. vs RH ajustado" valor={pct(r.diferencaQuadroRh)} como="Positivo = hora do quadro da área mais cara que a referência do RH ajustada." />
        </Tabela>
      </Secao>

      <Secao titulo="Apoio">
        <Tabela colunas={COLS}>
          <LinhaIndicador rotulo="Mês de referência" valor={r.mesReferencia} como="Premissas." />
          <LinhaIndicador rotulo="Custo da área no mês de referência (R$)" valor={moeda(r.custoMesRef)} como="HH mensal." />
          <LinhaIndicador rotulo="Headcount no mês de referência" valor={numero(r.headcountMesRef)} como="HH mensal." />
          <LinhaIndicador rotulo="Horas produtivas da área no mês" valor={horas(r.horasMesRef)} como="HH mensal." />
          <LinhaIndicador rotulo="Horas produtivas/mês por colaborador" valor={horas(r.horasProdutivasMes)} como="Premissas." />
          <LinhaIndicador rotulo="Custo mensal equivalente da equipe de campo (R$)" valor={moeda(r.custoMensalEquipe)} como="Equipe de campo." />
          <LinhaIndicador rotulo="Pontos/localidades atendidos por mês" valor={numero(r.pontosAtendidosMes)} como="Equipe de campo." />
          <LinhaIndicador rotulo="Horas-homem por ponto/localidade" valor={numero(r.horasHomemPonto, 4)} como="Equipe de campo." />
        </Tabela>
      </Secao>
    </div>
  );
};

export default ResumoHH;
