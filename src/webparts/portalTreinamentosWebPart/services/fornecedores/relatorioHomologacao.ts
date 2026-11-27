import {
  IFluxoHistorico
} from '../../models/Fluxo';

import {
  ETAPAS_HOMOLOGACAO,
  ICicloHomologacao,
  IConsultaFornecedor,
  IFornecedor,
  ROTULO_CONSULTA,
  VERIFICACOES_HOMOLOGACAO
} from './modeloFornecedores';

import {
  ISituacaoDocumental
} from './situacaoDocumental';

import {
  sugerirVerificacoes
} from './homologacao';

import {
  formatarCnpj
} from '../../utils/cnpj';

// ============================================================
// FORNECEDORES — RELATÓRIO DE HOMOLOGAÇÃO (PDF)
//
// montarConteudoRelatorio: PURA e testada — decide o que entra.
// gerarPdfRelatorio: desenha com jspdf + jspdf-autotable (carregados
// sob demanda).
//
// NUNCA entram: dados bancários (nem "conferido") e CPF de sócios ou
// colaboradores. Textos livres (comentários, ressalvas) passam por
// semCpf. CNPJ só quando o usuário que gera tem o campo visível
// (perfil de campo): vazio = a linha é omitida. Só documentos da
// EMPRESA (a situação documental já não tem tipos de colaborador).
// ============================================================

export const TITULO_RELATORIO = 'Relatório de homologação de fornecedor';

export const TEXTO_PREVIA = 'PRÉVIA — homologação em andamento';

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const dois = (n: number): string => (n < 10 ? `0${n}` : String(n));

export const dataHoraBr = (d: Date): string =>
  `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;

const dataHoraIsoBr = (iso: string): string => {
  const t = Date.parse(iso || '');
  return isNaN(t) ? '—' : dataHoraBr(new Date(t));
};

// CPF em texto livre (comentário, ressalva) nunca vai para o PDF.
export const semCpf = (texto: string): string =>
  (texto || '').replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF removido]');

// Fase atual: rótulo da etapa, ou "Concluído — <resultado>".
export const faseDoCiclo = (ciclo: Pick<ICicloHomologacao, 'concluidoEm' | 'etapa' | 'resultadoHomologacao'>): string => {
  if (ciclo.concluidoEm) {
    return `Concluído — ${ciclo.resultadoHomologacao || 'Pendente'}`;
  }
  const etapa = ETAPAS_HOMOLOGACAO.filter(e => e.id === ciclo.etapa)[0];
  return etapa ? etapa.rotulo : ciclo.etapa;
};

// Mesma regra de nomes do módulo (pasta do fornecedor no SharePoint):
// sem ~ " # % & * : < > ? / \ { | }, espaços simples.
export const limparNomeArquivo = (texto: string): string =>
  (texto || '')
    .replace(/[~"#%&*:<>?/\\{|}]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

// Relatorio homologacao <protocolo> ciclo <n> - <fase> - <yyyy-MM-dd HHmm>.pdf (sem CNPJ)
export const nomeArquivoRelatorio = (protocolo: string, numero: number, fase: string, emitidoEm: Date): string => {
  const data = `${emitidoEm.getFullYear()}-${dois(emitidoEm.getMonth() + 1)}-${dois(emitidoEm.getDate())} ${dois(emitidoEm.getHours())}${dois(emitidoEm.getMinutes())}`;
  return limparNomeArquivo(`Relatorio homologacao ${protocolo || 'sem protocolo'} ciclo ${numero} - ${fase} - ${data}`) + '.pdf';
};

export interface IDadosRelatorio {
  fornecedor: IFornecedor;
  ciclo: ICicloHomologacao;
  situacao: ISituacaoDocumental;
  consultas: IConsultaFornecedor[];
  // Histórico do fluxo (dgt_fluxoestado), em qualquer ordem.
  historicoFluxo: IFluxoHistorico[];
  // Parecer do Jurídico (campo "parecer" do fluxo), se houver.
  parecer: string;
  emitidoEm: Date;
  geradoPor: string;
}

export interface ISecaoRelatorio {
  titulo: string;
  // Tabela de pares (rótulo, valor) ou tabela com colunas.
  pares?: Array<[string, string]>;
  colunas?: string[];
  linhas?: string[][];
  vazio?: string;
}

export interface IConteudoRelatorio {
  titulo: string;
  fase: string;
  previa: boolean;
  emitidoEm: string;
  geradoPor: string;
  secoes: ISecaoRelatorio[];
}

export const montarConteudoRelatorio = (d: IDadosRelatorio): IConteudoRelatorio => {
  const { fornecedor: f, ciclo: c } = d;
  const concluido = !!c.concluidoEm;

  // 1. Fornecedor
  const pares: Array<[string, string]> = [['Razão social', f.razaoSocial]];
  if (f.nomeFantasia) { pares.push(['Nome fantasia', f.nomeFantasia]); }
  // CNPJ só se o campo veio (perfil de campo de quem gera).
  if ((f.cnpj || '').trim()) { pares.push(['CNPJ', formatarCnpj(f.cnpj)]); }
  pares.push(['Categoria', f.categoria || '—']);
  pares.push(['Protocolo', c.protocolo || f.protocolo || '—']);
  pares.push(['Ciclo', `${c.numero} — ${c.motivo || 'homologação'}`]);
  pares.push(['Aberto em', dataHoraIsoBr(c.criadoEm)]);

  // 2. Checklist do item 9 — SEM a verificação bancária.
  const sugestoes = sugerirVerificacoes(f, d.situacao);
  const checklist = VERIFICACOES_HOMOLOGACAO
    .filter(v => v.id !== 'bancario')
    .map(v => {
      const marcada = (c.verificacoes || {})[v.id];
      const ok = !!marcada && marcada.ok;
      return [
        v.rotulo,
        ok ? 'OK' : 'Pendente',
        ok ? (marcada!.responsavel || '—') : '—',
        ok ? dataBr(marcada!.data) : '—',
        semCpf(sugestoes[v.id] ? sugestoes[v.id].texto : '')
      ];
    });

  // 3. Consultas: a última de cada tipo.
  const ultimas: Record<string, IConsultaFornecedor> = {};
  d.consultas.forEach(q => {
    const atual = ultimas[q.tipo];
    if (!atual || q.quando > atual.quando) {
      ultimas[q.tipo] = q;
    }
  });
  const consultas = Object.keys(ultimas)
    .map(k => ultimas[k])
    .sort((a, b) => (ROTULO_CONSULTA[a.tipo] || a.tipo).localeCompare(ROTULO_CONSULTA[b.tipo] || b.tipo, 'pt-BR'))
    .map(q => [ROTULO_CONSULTA[q.tipo] || q.tipo, dataHoraIsoBr(q.quando), q.resultado || '—', semCpf(q.resumo || '').substring(0, 300)]);

  // 4. Documentos da empresa: vigentes e os pendentes/vencidos.
  const documentos = d.situacao.itens
    .filter(i => !!i.documento || i.estado === 'Faltando')
    .map(i => [
      i.tipo.nome,
      i.documento ? dataBr(i.documento.emissao) : '—',
      i.documento && i.documento.vencimento ? dataBr(i.documento.vencimento) : '—',
      i.estado === 'OK' ? 'Em dia' : i.estado
    ]);

  // 5. Decisão
  const decisao: Array<[string, string]> = [
    ['Classificação de risco', c.classificacaoRisco || (concluido ? '—' : 'Pendente')],
    ['Validade do cadastro', c.validadeCadastro ? dataBr(c.validadeCadastro) : (concluido ? '—' : 'Pendente')],
    ['Resultado', concluido ? (c.resultadoHomologacao || '—') : 'Pendente'],
    ['Ressalvas', semCpf(c.ressalvas) || '—'],
    ['Parecer do Jurídico', semCpf(d.parecer) || '—'],
    ['Suprimentos', c.responsavelSuprimentos || '—'],
    ['Jurídico', c.responsavelCompliance || '—']
  ];

  // 6. Linha do tempo (do mais antigo ao mais recente)
  const linhaDoTempo = d.historicoFluxo
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map(h => [dataHoraIsoBr(h.data), h.elementoNome, h.acaoRotulo, h.executadoPorNome || '—', semCpf(h.comentario || '')]);

  return {
    titulo: TITULO_RELATORIO,
    fase: faseDoCiclo(c),
    previa: !concluido,
    emitidoEm: dataHoraBr(d.emitidoEm),
    geradoPor: d.geradoPor,
    secoes: [
      { titulo: '1. Fornecedor', pares },
      { titulo: '2. Checklist do item 9', colunas: ['Verificação', 'Situação', 'Quem marcou', 'Quando', 'Observação'], linhas: checklist },
      { titulo: '3. Consultas', colunas: ['Consulta', 'Data', 'Resultado', 'Resumo'], linhas: consultas, vazio: 'Nenhuma consulta registrada.' },
      { titulo: '4. Documentos da empresa', colunas: ['Documento', 'Emissão', 'Validade', 'Situação'], linhas: documentos, vazio: 'Nenhum documento exigido.' },
      { titulo: '5. Decisão', pares: decisao },
      { titulo: '6. Linha do tempo', colunas: ['Data', 'Etapa', 'Ação', 'Quem', 'Comentário'], linhas: linhaDoTempo, vazio: 'Fluxo ainda não iniciado.' }
    ]
  };
};

// ------------------------------------------------------------
// PDF (jspdf + jspdf-autotable, carregados só ao gerar)
// ------------------------------------------------------------

// Fontes padrão do PDF (Helvetica ≈ Arial) não têm alguns símbolos.
export const textoPdf = (texto: string): string =>
  (texto || '')
    .replace(/[—–]/g, '-')
    .replace(/→/g, '->')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/✓/g, 'OK');

const AZUL: [number, number, number] = [32, 42, 68];      // #202A44
const CIANO: [number, number, number] = [5, 195, 221];    // #05C3DD

interface IDocPdf {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (nome: string, estilo?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  rect: (x: number, y: number, w: number, h: number, estilo?: string) => void;
  text: (texto: string | string[], x: number, y: number, opcoes?: Record<string, unknown>) => void;
  addPage: () => void;
  setPage: (n: number) => void;
  getNumberOfPages: () => number;
  output: (tipo: 'blob') => Blob;
}

export const gerarPdfRelatorio = async (conteudo: IConteudoRelatorio): Promise<Blob> => {
  const modJs = await import(/* webpackChunkName: 'fornecedores-pdf' */ 'jspdf');
  const modTabela = await import(/* webpackChunkName: 'fornecedores-pdf' */ 'jspdf-autotable');
  const JsPdf = (modJs as unknown as { jsPDF: new (o: Record<string, unknown>) => IDocPdf }).jsPDF;
  const autoTable = (modTabela as unknown as { autoTable: (doc: IDocPdf, o: Record<string, unknown>) => void }).autoTable;

  const doc = new JsPdf({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 14;

  // Cabeçalho
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
  doc.rect(0, 0, largura, 30, 'F');
  doc.setFillColor(CIANO[0], CIANO[1], CIANO[2]);
  doc.rect(0, 30, largura, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(textoPdf(conteudo.titulo), margem, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(textoPdf(`Emitido em ${conteudo.emitidoEm} por ${conteudo.geradoPor}`), margem, 19);
  doc.text(textoPdf(`Fase atual: ${conteudo.fase}`), margem, 25);

  let y = 38;
  if (conteudo.previa) {
    doc.setFillColor(255, 244, 229);
    doc.rect(margem, y - 5, largura - 2 * margem, 8, 'F');
    doc.setTextColor(181, 71, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(textoPdf(TEXTO_PREVIA), margem + 3, y);
    y += 8;
  }

  const estiloCabecalho = { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 };
  const estiloCorpo = { fontSize: 8.5, textColor: AZUL, cellPadding: 1.6 };

  conteudo.secoes.forEach(secao => {
    doc.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > altura - 30) {
      doc.addPage();
      y = 18;
    }
    doc.text(textoPdf(secao.titulo), margem, y + 4);
    const inicio = y + 7;
    const corpo = secao.pares
      ? secao.pares.map(p => [textoPdf(p[0]), textoPdf(p[1])])
      : (secao.linhas && secao.linhas.length > 0
        ? secao.linhas.map(l => l.map(textoPdf))
        : [[textoPdf(secao.vazio || '—')]]);
    autoTable(doc, {
      startY: inicio,
      margin: { left: margem, right: margem, top: 16, bottom: 16 },
      head: secao.pares || !(secao.linhas && secao.linhas.length > 0) ? undefined : [(secao.colunas || []).map(textoPdf)],
      body: corpo,
      theme: 'grid',
      styles: estiloCorpo,
      headStyles: estiloCabecalho,
      columnStyles: secao.pares ? { 0: { fontStyle: 'bold', cellWidth: 48 } } : undefined
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable || { finalY: inicio }).finalY + 6;
  });

  // Rodapé (página X/Y) e marca d'água da prévia em todas as páginas.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    if (conteudo.previa) {
      doc.setTextColor(235, 235, 235);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      doc.text('PREVIA', largura / 2, altura / 2, { align: 'center', angle: 35 });
    }
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(textoPdf(`DGT - ${conteudo.titulo} - ${conteudo.fase}`), margem, altura - 8);
    doc.text(`Página ${i}/${paginas}`, largura - margem, altura - 8, { align: 'right' });
  }

  return doc.output('blob');
};
