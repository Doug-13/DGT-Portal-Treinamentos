import {
  IDadosEdital,
  IDocumentoEdital,
  IFiltrosLicitacao,
  IItemEdital,
  ILicitacaoResultado,
  IResumoBusca,
  MODALIDADES_PNCP
} from '../models/Licitacao';

import {
  formatarDataHoraPncp,
  formatarDataPncp,
  formatarMoeda
} from './licitacoesFiltro';

// ============================================================
// LICITAÇÕES — RELATÓRIO PARA IMPRESSÃO / PDF
//
// Substitui o ReportLab do script Python sem adicionar
// dependência ao projeto: abre uma janela com o relatório no
// padrão visual DGT e chama a impressão do navegador, onde o
// usuário escolhe "Salvar como PDF".
//
// O relatório não contém CNPJ nem o identificador PNCP.
// ============================================================

const esc = (
  valor: unknown
): string =>
  String(valor === undefined || valor === null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const lista = (
  itens: string[]
): string =>
  itens.length > 0 ? itens.join(', ') : 'Nenhuma';

const MODO: { [modo: string]: string } = {
  '1': 'Assunto exato',
  '2': 'Qualquer palavra do assunto',
  '3': 'Assunto + palavras relacionadas'
};

export const montarHtmlRelatorio = (
  filtros: IFiltrosLicitacao,
  resultados: ILicitacaoResultado[],
  resumo: IResumoBusca | undefined,
  urlLogo?: string
): string => {

  const agora = new Date().toLocaleString('pt-BR');

  const periodo = resumo
    ? `${resumo.inicio.toLocaleDateString('pt-BR')} a ${resumo.fim.toLocaleDateString('pt-BR')}`
    : `Últimos ${filtros.diasBusca} dias`;

  const linhasFiltro: Array<[string, string]> = [
    ['Assunto', filtros.assunto],
    ['Tipo de filtro', MODO[filtros.modoBusca] || filtros.modoBusca],
    ['Período', periodo],
    ['UF', filtros.uf || 'Brasil inteiro'],
    ['Modalidades', filtros.modalidades.map(codigo => MODALIDADES_PNCP[codigo] || String(codigo)).join(', ')],
    ['Palavras obrigatórias', lista(filtros.palavrasObrigatorias)],
    ['Palavras relacionadas', lista(filtros.palavrasRelacionadas)],
    ['Palavras excluídas', lista(filtros.palavrasNegativas)],
    ['Valor mínimo', formatarMoeda(filtros.valorMinimo)],
    ['Valor máximo', formatarMoeda(filtros.valorMaximo)],
    ['Score mínimo', `${filtros.scoreMinimo}%`]
  ];

  const linhasResumo: Array<[string, string]> = resumo
    ? [
      ['Registros recebidos do PNCP', resumo.registrosBrutos.toLocaleString('pt-BR')],
      ['Registros únicos', resumo.registrosUnicos.toLocaleString('pt-BR')],
      ['Descartados no pré-filtro', resumo.descartados.toLocaleString('pt-BR')],
      ['Resultados aderentes', resultados.length.toLocaleString('pt-BR')],
      ['Situação', resumo.cancelada ? 'Busca cancelada antes do fim (resultados parciais)' : 'Busca concluída']
    ]
    : [['Resultados aderentes', resultados.length.toLocaleString('pt-BR')]];

  const tabela = (
    linhas: Array<[string, string]>
  ): string =>
    '<table class="kv">' +
    linhas
      .map(([chave, valor]) => `<tr><th>${esc(chave)}</th><td>${esc(valor)}</td></tr>`)
      .join('') +
    '</table>';

  const blocos = resultados
    .map((item, indice) => `
      <section class="item">
        <div class="item-topo">
          <span class="item-num">${indice + 1}</span>
          <span class="score">Aderência ${item.score}%</span>
        </div>
        <h3>${esc(item.orgao)}</h3>
        <p class="objeto">${esc(item.objeto)}</p>
        ${tabela([
          ['Local', item.local],
          ['Modalidade', item.modalidade],
          ['Número', item.numero],
          ['Valor estimado', formatarMoeda(item.valor)],
          ['Publicação', formatarDataPncp(item.publicacao)],
          ['Abertura das propostas', formatarDataPncp(item.abertura)],
          ['Encerramento das propostas', formatarDataPncp(item.encerramento)]
        ])}
        <p class="motivos"><strong>Motivos da aderência:</strong> ${esc(item.motivos.join(' · ') || 'Sem detalhes')}</p>
        <p class="link"><a href="${esc(item.url)}">Abrir licitação no PNCP</a></p>
      </section>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de Licitações — ${esc(filtros.assunto)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Barlow, Arial, sans-serif; color: #202A44; font-size: 11px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: center;
           border-bottom: 3px solid #05C3DD; padding-bottom: 10px; margin-bottom: 16px; }
  header img { height: 34px; }
  h1 { font-size: 18px; margin: 0; text-transform: uppercase; letter-spacing: .02em; }
  h2 { font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; }
  h3 { font-size: 13px; margin: 6px 0 4px; }
  .gerado { color: #888B8D; font-size: 10px; }
  table.kv { width: 100%; border-collapse: collapse; margin: 6px 0; }
  table.kv th { width: 34%; text-align: left; font-weight: 600; background: #EDF0F5;
                padding: 5px 8px; border: 1px solid #D9D9D6; vertical-align: top; }
  table.kv td { padding: 5px 8px; border: 1px solid #D9D9D6; vertical-align: top; }
  .item { border: 1px solid #D9D9D6; border-left: 4px solid #05C3DD; border-radius: 6px;
          padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .item-topo { display: flex; justify-content: space-between; align-items: center; }
  .item-num { color: #888B8D; font-weight: 600; }
  .score { background: #E6F9FC; border: 1px solid #05C3DD; border-radius: 999px;
           padding: 2px 10px; font-weight: 600; }
  .objeto { margin: 4px 0 8px; line-height: 1.45; }
  .motivos { margin: 6px 0 2px; color: #202A44; }
  .link a { color: #485CC7; }
  .vazio { padding: 20px; background: #F2F2F2; border-radius: 6px; }
  footer { margin-top: 20px; border-top: 1px solid #D9D9D6; padding-top: 6px;
           color: #888B8D; font-size: 9px; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>Relatório de licitações</h1>
      <div class="gerado">Gerado em ${esc(agora)} · Fonte: PNCP — Portal Nacional de Contratações Públicas</div>
    </div>
    ${urlLogo ? `<img src="${esc(urlLogo)}" alt="DGT">` : ''}
  </header>

  <h2>Resumo da consulta</h2>
  ${tabela(linhasResumo)}

  <h2>Filtros utilizados</h2>
  ${tabela(linhasFiltro)}

  <h2>Oportunidades encontradas (${resultados.length})</h2>
  ${blocos || '<div class="vazio">Nenhuma licitação encontrada com os filtros utilizados.</div>'}

  <footer>Portal DGT · Módulo Licitações · Dados públicos obtidos da API de consulta do PNCP.</footer>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;
};

export const abrirRelatorioImpressao = (
  filtros: IFiltrosLicitacao,
  resultados: ILicitacaoResultado[],
  resumo: IResumoBusca | undefined,
  urlLogo?: string
): boolean => {

  const janela = window.open('', '_blank');

  if (!janela) {
    return false;
  }

  janela.document.open();
  janela.document.write(
    montarHtmlRelatorio(filtros, resultados, resumo, urlLogo)
  );
  janela.document.close();

  return true;
};

// ============================================================
// FICHA DO EDITAL (pré-visualização) — impressão e texto
// ============================================================

export interface IConteudoFicha {
  item: ILicitacaoResultado;
  dados: IDadosEdital;
  situacaoPrazo: string;
  itens: IItemEdital[];
  documentos: IDocumentoEdital[];
}

const simNao = (valor?: boolean): string =>
  valor === undefined ? '-' : (valor ? 'Sim' : 'Não');

export const linhasFichaTecnica = (
  conteudo: IConteudoFicha
): Array<[string, string]> => {

  const { item, dados } = conteudo;

  const linhas: Array<[string, string | undefined]> = [
    ['Órgão', item.orgao],
    ['Unidade compradora', dados.unidadeCompradora
      ? `${dados.unidadeCompradora}${dados.codigoUnidade ? ` (${dados.codigoUnidade})` : ''}`
      : undefined],
    ['Local', item.local],
    ['Esfera / Poder', [dados.esfera, dados.poder].filter(Boolean).join(' / ') || undefined],
    ['Modalidade', item.modalidade],
    ['Modo de disputa', dados.modoDisputa],
    ['Instrumento convocatório', dados.instrumentoConvocatorio],
    ['Amparo legal', dados.amparoLegalNome],
    ['Registro de preços (SRP)', simNao(dados.srp)],
    ['Situação', dados.situacao],
    ['Número da compra', item.numero],
    ['Processo', dados.processo],
    ['Valor estimado', formatarMoeda(item.valor)],
    ['Valor homologado', dados.valorHomologado !== undefined ? formatarMoeda(dados.valorHomologado) : undefined],
    ['Fontes orçamentárias', dados.fontesOrcamentarias.length > 0 ? dados.fontesOrcamentarias.join(', ') : undefined],
    ['Prazo de propostas', conteudo.situacaoPrazo],
    ['Abertura das propostas', formatarDataHoraPncp(item.abertura)],
    ['Encerramento das propostas', formatarDataHoraPncp(item.encerramento)],
    ['Publicação no PNCP', formatarDataHoraPncp(item.publicacao)],
    ['Última atualização', dados.dataAtualizacao ? formatarDataHoraPncp(dados.dataAtualizacao) : undefined],
    ['Sistema de origem', dados.sistemaOrigem],
    ['Justificativa (presencial)', dados.justificativaPresencial]
  ];

  return linhas
    .filter(([, valor]) => valor !== undefined && valor !== '' && valor !== '-')
    .map(([chave, valor]) => [chave, valor as string]);
};

export const montarResumoTexto = (
  conteudo: IConteudoFicha
): string => {

  const { item } = conteudo;

  const linhas = [
    `LICITAÇÃO — ${item.orgao}`,
    '',
    `Objeto: ${item.objeto}`,
    ''
  ];

  linhasFichaTecnica(conteudo).forEach(([chave, valor]) => {
    linhas.push(`${chave}: ${valor}`);
  });

  linhas.push('');
  linhas.push(`Aderência: ${item.score}% (${item.motivos.join('; ') || 'sem detalhes'})`);

  if (conteudo.itens.length > 0) {
    linhas.push(`Itens: ${conteudo.itens.length}`);
  }

  if (conteudo.documentos.length > 0) {
    linhas.push(`Documentos publicados: ${conteudo.documentos.map(doc => doc.titulo).join('; ')}`);
  }

  linhas.push('');
  linhas.push(`Edital no PNCP: ${item.url}`);

  return linhas.join('\n');
};

export const abrirFichaImpressao = (
  conteudo: IConteudoFicha,
  urlLogo?: string
): boolean => {

  const { item, dados, itens, documentos } = conteudo;

  const tabelaFicha =
    '<table class="kv">' +
    linhasFichaTecnica(conteudo)
      .map(([chave, valor]) => `<tr><th>${esc(chave)}</th><td>${esc(valor)}</td></tr>`)
      .join('') +
    '</table>';

  const tabelaItens = itens.length === 0
    ? '<div class="vazio">Itens não disponíveis no PNCP.</div>'
    : '<table class="itens"><thead><tr>' +
      '<th>Item</th><th>Descrição</th><th>Qtd.</th><th>Unid.</th><th>Valor unit.</th><th>Valor total</th><th>Benefício</th>' +
      '</tr></thead><tbody>' +
      itens.map(it => `<tr>
        <td>${it.numeroItem}</td>
        <td>${esc(it.descricao)}</td>
        <td>${it.quantidade !== undefined ? it.quantidade.toLocaleString('pt-BR') : '-'}</td>
        <td>${esc(it.unidade || '-')}</td>
        <td>${it.sigiloso ? 'Sigiloso' : esc(formatarMoeda(it.valorUnitario))}</td>
        <td>${it.sigiloso ? 'Sigiloso' : esc(formatarMoeda(it.valorTotal))}</td>
        <td>${esc(it.beneficio || '-')}</td>
      </tr>`).join('') +
      '</tbody></table>';

  const listaDocs = documentos.length === 0
    ? '<div class="vazio">Nenhum documento publicado.</div>'
    : '<ul>' + documentos.map(doc =>
      `<li><strong>${esc(doc.tipo)}</strong> — <a href="${esc(doc.url)}">${esc(doc.titulo)}</a>` +
      `${doc.publicacao ? ` (${esc(formatarDataPncp(doc.publicacao))})` : ''}</li>`
    ).join('') + '</ul>';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Ficha do edital — ${esc(item.orgao)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Barlow, Arial, sans-serif; color: #202A44; font-size: 11px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: center;
           border-bottom: 3px solid #05C3DD; padding-bottom: 10px; margin-bottom: 14px; }
  header img { height: 32px; }
  h1 { font-size: 16px; margin: 0; text-transform: uppercase; }
  h2 { font-size: 12px; margin: 16px 0 6px; text-transform: uppercase; }
  .sub { color: #888B8D; font-size: 10px; }
  .objeto { font-size: 12px; line-height: 1.5; background: #EDF0F5; padding: 10px 12px; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; }
  table.kv th { width: 32%; text-align: left; background: #EDF0F5; padding: 5px 8px; border: 1px solid #D9D9D6; font-weight: 600; vertical-align: top; }
  table.kv td { padding: 5px 8px; border: 1px solid #D9D9D6; vertical-align: top; }
  table.itens th { background: #202A44; color: #fff; padding: 5px 6px; text-align: left; font-size: 10px; }
  table.itens td { padding: 5px 6px; border-bottom: 1px solid #D9D9D6; font-size: 10px; vertical-align: top; }
  table.itens tr { page-break-inside: avoid; }
  .vazio { padding: 10px; background: #F2F2F2; border-radius: 6px; }
  a { color: #485CC7; }
  ul { padding-left: 18px; margin: 4px 0; }
  li { margin-bottom: 3px; }
  footer { margin-top: 18px; border-top: 1px solid #D9D9D6; padding-top: 6px; color: #888B8D; font-size: 9px; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>Ficha do edital</h1>
      <div class="sub">${esc(item.modalidade)} · ${esc(item.local)} · Nº ${esc(item.numero)} · Aderência ${item.score}%</div>
    </div>
    ${urlLogo ? `<img src="${esc(urlLogo)}" alt="DGT">` : ''}
  </header>

  <h2>${esc(item.orgao)}</h2>
  <div class="objeto">${esc(item.objeto)}</div>

  ${dados.informacaoComplementar ? `<h2>Informação complementar</h2><p>${esc(dados.informacaoComplementar)}</p>` : ''}

  <h2>Ficha técnica</h2>
  ${tabelaFicha}

  <h2>Itens (${itens.length})</h2>
  ${tabelaItens}

  <h2>Documentos</h2>
  ${listaDocs}

  <p><a href="${esc(item.url)}">Abrir o edital no PNCP</a></p>

  <footer>Gerado em ${esc(new Date().toLocaleString('pt-BR'))} · Portal DGT · Fonte: PNCP.</footer>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;

  const janela = window.open('', '_blank');

  if (!janela) {
    return false;
  }

  janela.document.open();
  janela.document.write(html);
  janela.document.close();

  return true;
};
