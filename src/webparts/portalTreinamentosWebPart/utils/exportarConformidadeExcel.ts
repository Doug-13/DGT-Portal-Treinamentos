// ============================================================
// EXPORTAÇÃO DA CONFORMIDADE PARA EXCEL (.xlsx)
//
// - Exporta exatamente as linhas que estão na tela (respeita
//   pesquisa, área e status).
// - Datas saem como datas de verdade (dd/mm/aaaa), para o usuário
//   conseguir ordenar e filtrar no Excel.
// - O ExcelJS (já dependência do projeto) é carregado sob demanda,
//   em chunk próprio, só quando alguém clica em exportar.
// ============================================================

import type * as ExcelJSTipos from 'exceljs';

import {
  IItemConformidade,
  lerDataConformidade
} from '../services/ConformidadeService';

type ExcelJSModulo = typeof ExcelJSTipos;

const COR_AZUL = 'FF202A44';
const COR_CIANO = 'FF05C3DD';

const carregarExcelJS = async (): Promise<ExcelJSModulo> => {
  const modulo = await import(/* webpackChunkName: 'conformidade-excel' */ 'exceljs');
  const m = modulo as unknown as { default?: ExcelJSModulo };
  return (m.default || modulo) as ExcelJSModulo;
};

// Data só com dia para o Excel: meia-noite UTC do mesmo dia, para a
// célula não mudar de dia por causa do fuso.
const dataExcel = (
  valor?: string
): Date | undefined => {

  const data =
    lerDataConformidade(valor);

  return data
    ? new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()))
    : undefined;
};

export const situacaoDoPrazo = (
  item: IItemConformidade
): string => {

  const dias =
    item.diasParaPrazo;

  if (dias === undefined) {
    return item.prazo ? '' : 'Sem prazo definido';
  }

  if (dias < 0) {
    return `Prazo expirado há ${-dias} dia${dias === -1 ? '' : 's'}`;
  }

  if (dias === 0) {
    return 'Prazo termina hoje';
  }

  return `Falta${dias === 1 ? '' : 'm'} ${dias} dia${dias === 1 ? '' : 's'}`;
};

const nomeArquivo = (): string => {
  const hoje = new Date();
  const dois = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `conformidade-treinamentos-${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}.xlsx`;
};

export const exportarConformidadeExcel = async (
  itens: IItemConformidade[],
  filtrosAplicados: string
): Promise<void> => {

  const ExcelJS =
    await carregarExcelJS();

  const livro =
    new ExcelJS.Workbook();

  livro.creator = 'Portal de Treinamentos DGT';
  livro.created = new Date();

  const planilha =
    livro.addWorksheet('Conformidade', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

  planilha.columns = [
    { header: 'Usuário', key: 'usuario', width: 30 },
    { header: 'Área', key: 'area', width: 36 },
    { header: 'Treinamento', key: 'treinamento', width: 46 },
    { header: 'Trilha', key: 'trilha', width: 24 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Prazo para realização', key: 'prazo', width: 20, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Situação do prazo', key: 'situacaoPrazo', width: 26 },
    { header: 'Conclusão', key: 'conclusao', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Validade', key: 'validade', width: 13, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Dias para vencer a validade', key: 'dias', width: 16 },
    { header: 'Origem', key: 'origem', width: 16 }
  ];

  itens.forEach(
    item => {
      planilha.addRow({
        usuario: item.usuario,
        area: item.areas?.map(area => area.nome).join(', ') || 'Sem área',
        treinamento: item.treinamento,
        trilha: item.trilha && item.trilha !== '-' ? item.trilha : '',
        status: item.status,
        prazo: dataExcel(item.prazo),
        situacaoPrazo: situacaoDoPrazo(item),
        conclusao: dataExcel(item.conclusao),
        validade: dataExcel(item.validade),
        dias: item.diasParaVencer,
        origem: item.origem && item.origem !== '-' ? item.origem : ''
      });
    }
  );

  // Cabeçalho na identidade visual do portal.
  const cabecalho =
    planilha.getRow(1);

  cabecalho.height = 22;

  cabecalho.eachCell(
    celula => {
      celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_AZUL } };
      celula.alignment = { vertical: 'middle', wrapText: true };
      celula.border = { bottom: { style: 'medium', color: { argb: COR_CIANO } } };
    }
  );

  // Destaque de prazo expirado (texto em vermelho na situação).
  itens.forEach(
    (item, indice) => {
      if (item.diasParaPrazo !== undefined && item.diasParaPrazo < 0) {
        planilha.getRow(indice + 2).getCell('situacaoPrazo').font = {
          bold: true,
          color: { argb: 'FFA4262C' }
        };
      }
    }
  );

  if (itens.length > 0) {
    planilha.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: itens.length + 1, column: planilha.columns.length }
    };
  }

  // Aba com os filtros usados, para quem receber o arquivo.
  const info =
    livro.addWorksheet('Filtros');

  info.columns = [
    { key: 'campo', width: 22 },
    { key: 'valor', width: 60 }
  ];

  info.addRow({ campo: 'Gerado em', valor: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) });
  info.addRow({ campo: 'Filtros aplicados', valor: filtrosAplicados || 'Nenhum' });
  info.addRow({ campo: 'Linhas exportadas', valor: itens.length });
  info.getColumn(1).font = { bold: true };

  const buffer =
    await livro.xlsx.writeBuffer();

  const blob =
    new Blob(
      [buffer as ArrayBuffer],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = nomeArquivo();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
