import {
  IAnaliseGoNoGo,
  IBomRegistro,
  IDemandaBom
} from '../../services/bom/BomService';

import {
  IItemBom,
  IRegistroAlteracaoBom,
  ISelecaoKit,
  nomeKitDoPonto
} from '../../services/bom/montadorBom';

import {
  totalIntegracao,
  totalManutencao
} from '../../services/hh/complementosHH';

import { IResumoValoresBom } from '../../services/hh/valoresProjeto';

import logoDgt from '../../assets/logo-dgt.png';

// ============================================================
// PDF DO B.O.M. (arquivo .pdf baixado direto, sem janela de impressão)
//
// Antes o PDF era uma página HTML aberta em nova janela para imprimir,
// o que depende de pop-up liberado e de "Salvar como PDF". Agora o
// arquivo é montado com jsPDF + jspdf-autotable (já usados no portal,
// carregados sob demanda) e baixado na hora.
// ============================================================

export interface ILinhaBom extends IItemBom {
  valorUnitario?: number;
  total?: number;
}

export interface IDadosPdfBom {
  bom: IBomRegistro;
  demanda: IDemandaBom;
  analise?: IAnaliseGoNoGo;
  selecao?: ISelecaoKit;
  linhas: ILinhaBom[];
  valorTotal: number;
  semPreco: number;
  alertas: string[];
  enviado: boolean;
  dataEnvio?: string;
  historico: IRegistroAlteracaoBom[];
  resumoValores: IResumoValoresBom;
}

type Rgb = [number, number, number];

const AZUL: Rgb = [32, 42, 68];
const CIANO: Rgb = [5, 195, 221];
const CINZA: Rgb = [136, 139, 141];
const FUNDO: Rgb = [237, 240, 245];
const ZEBRA: Rgb = [242, 242, 242];
const BORDA: Rgb = [217, 217, 214];
const VERMELHO: Rgb = [180, 35, 24];
const VERDE: Rgb = [16, 124, 16];
const BRANCO: Rgb = [255, 255, 255];

const MARGEM = 14;

// As fontes padrão do PDF só têm o alfabeto latino: troca os
// símbolos que ficariam como "?" no arquivo.
export const textoPdf = (valor: unknown): string =>
  String(valor === undefined || valor === null ? '' : valor)
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/[\u2264]/g, '<=')
    .replace(/[\u2265]/g, '>=')
    .replace(/[\u0100-\uFFFF]/g, '');

const moeda = (v: number): string =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const numero = (v: number, casas = 2): string =>
  Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

const dois = (n: number): string => (n < 10 ? `0${n}` : String(n));

const data = (valor?: string): string => {
  if (!valor) {
    return '-';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (m && valor.length <= 10) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = new Date(valor);
  return isNaN(d.getTime()) ? valor : `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const dataHora = (valor?: string): string => {
  if (!valor) {
    return '-';
  }
  const d = new Date(valor);
  return isNaN(d.getTime())
    ? data(valor)
    : `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
};

export const solucoesDoPonto = (ponto: ISelecaoKit['pontos'][number]): string =>
  [
    ponto.safeCity ? 'Safe City' : '',
    ponto.smartDetect ? 'Smart Detect' : '',
    ponto.faceDetect ? 'Face Detect' : '',
    ponto.safeWay ? 'Safe Way' : ''
  ].filter(Boolean).join(', ') || '-';

const numeroBom = (bom: IBomRegistro): string => String(bom.numero || '').replace(/^BOM\s*/i, '');

export const nomeArquivoPdfBom = (bom: IBomRegistro, demanda: IDemandaBom): string => {
  const limpo = (s: string): string => textoPdf(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').substring(0, 60);
  return `BOM-${limpo(numeroBom(bom))}-${limpo(bom.revisao || '')}-${limpo(demanda.nome || '')}.pdf`.replace(/-+/g, '-');
};

// Logo como PNG (o arquivo do pacote pode vir como URL ou data URL).
const logoComoPng = (): Promise<{ dataUrl: string; largura: number; altura: number } | undefined> =>
  new Promise(resolve => {
    try {
      const imagem = new Image();
      imagem.crossOrigin = 'anonymous';
      imagem.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imagem.naturalWidth || imagem.width;
          canvas.height = imagem.naturalHeight || imagem.height;
          const ctx = canvas.getContext('2d');
          if (!ctx || !canvas.width || !canvas.height) {
            resolve(undefined);
            return;
          }
          ctx.drawImage(imagem, 0, 0);
          resolve({ dataUrl: canvas.toDataURL('image/png'), largura: canvas.width, altura: canvas.height });
        } catch {
          resolve(undefined);
        }
      };
      imagem.onerror = () => resolve(undefined);
      imagem.src = logoDgt;
    } catch {
      resolve(undefined);
    }
  });

// ------------------------------------------------------------
// Montagem
// ------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export const gerarPdfBom = async (dados: IDadosPdfBom, opcoes?: { semLogo?: boolean }): Promise<Blob> => {

  const { bom, demanda, analise, selecao, linhas, valorTotal, semPreco, alertas, enviado, dataEnvio, historico, resumoValores } = dados;

  const modJsPdf: any = await import(/* webpackChunkName: 'implantacoes-pdf' */ 'jspdf');
  const modTabela: any = await import(/* webpackChunkName: 'implantacoes-pdf' */ 'jspdf-autotable');
  const JsPdf = modJsPdf.jsPDF || (modJsPdf.default && modJsPdf.default.jsPDF) || modJsPdf.default;
  const autoTable: (doc: any, opcoes: any) => void = modTabela.autoTable || modTabela.default;

  const doc: any = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura: number = doc.internal.pageSize.getWidth();
  const altura: number = doc.internal.pageSize.getHeight();
  const util = largura - MARGEM * 2;
  let y = MARGEM;

  const cor = (c: Rgb, tipo: 'texto' | 'fundo' | 'linha'): void => {
    if (tipo === 'texto') {
      doc.setTextColor(c[0], c[1], c[2]);
    } else if (tipo === 'fundo') {
      doc.setFillColor(c[0], c[1], c[2]);
    } else {
      doc.setDrawColor(c[0], c[1], c[2]);
    }
  };

  const garantirEspaco = (mm: number): void => {
    if (y + mm > altura - 18) {
      doc.addPage();
      y = MARGEM;
    }
  };

  const titulo = (texto: string): void => {
    garantirEspaco(22);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    cor(AZUL, 'texto');
    doc.text(textoPdf(texto.toUpperCase()), MARGEM, y);
    const w = doc.getTextWidth(textoPdf(texto.toUpperCase()));
    cor(CIANO, 'linha');
    doc.setLineWidth(0.6);
    doc.line(MARGEM, y + 1.6, MARGEM + w, y + 1.6);
    y += 6;
  };

  const paragrafo = (texto: string, tamanho = 9, rgb: Rgb = AZUL, estilo = 'normal'): void => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanho);
    cor(rgb, 'texto');
    const partes: string[] = doc.splitTextToSize(textoPdf(texto), util);
    partes.forEach(p => {
      garantirEspaco(5);
      doc.text(p, MARGEM, y);
      y += tamanho * 0.45;
    });
    y += 1.5;
  };

  const base = {
    margin: { left: MARGEM, right: MARGEM, bottom: 18, top: MARGEM },
    styles: { font: 'helvetica', fontSize: 8.5, textColor: AZUL, cellPadding: 1.8, lineColor: BORDA, lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: AZUL, textColor: BRANCO, fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: FUNDO, textColor: AZUL, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA }
  };

  const tabela = (opcoesTabela: any): void => {
    autoTable(doc, { ...base, ...opcoesTabela, startY: y });
    y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 3;
  };

  const kv = (pares: Array<[string, string]>): void => {
    tabela({
      theme: 'grid',
      body: pares.map(([k, v]) => [textoPdf(k), textoPdf(v || '-')]),
      columnStyles: { 0: { cellWidth: util * 0.3, fillColor: ZEBRA, fontStyle: 'bold' } },
      alternateRowStyles: {}
    });
  };

  // ---------------- capa ----------------
  const alturaCapa = 30;
  cor(AZUL, 'fundo');
  doc.rect(MARGEM, y, util, alturaCapa, 'F');
  cor(CIANO, 'fundo');
  doc.rect(MARGEM, y + alturaCapa - 1.2, util, 1.2, 'F');

  let xTexto = MARGEM + 6;
  const logo = opcoes && opcoes.semLogo ? undefined : await logoComoPng();
  if (logo) {
    const h = 14;
    const w = Math.min(36, (logo.largura / logo.altura) * h);
    cor(BRANCO, 'fundo');
    doc.roundedRect(MARGEM + 5, y + (alturaCapa - h) / 2 - 2, w + 4, h + 4, 1.5, 1.5, 'F');
    doc.addImage(logo.dataUrl, 'PNG', MARGEM + 7, y + (alturaCapa - h) / 2, w, h);
    xTexto = MARGEM + 5 + w + 10;
  }

  cor(BRANCO, 'texto');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('BILL OF MATERIALS', xTexto, y + 8);
  cor(CIANO, 'texto');
  doc.setFontSize(10);
  doc.text(textoPdf(`BOM ${numeroBom(bom)} · ${bom.revisao || ''}`), xTexto, y + 13.5);
  cor(BRANCO, 'texto');
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(textoPdf(demanda.nome), largura - MARGEM - xTexto - 4)[0] || '', xTexto, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const local = [demanda.cliente, [demanda.municipio, demanda.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  const emissao = `emitido em ${dataHora(new Date().toISOString())}${enviado ? ` · enviado para aprovação${dataEnvio ? ` em ${data(dataEnvio)}` : ''}` : ''}`;
  doc.text(doc.splitTextToSize(textoPdf([local, emissao].filter(Boolean).join(' · ')), largura - MARGEM - xTexto - 4)[0] || '', xTexto, y + 24);
  y += alturaCapa + 5;

  // ---------------- indicadores ----------------
  const kpis: Array<[string, string]> = [
    ['Pontos', String(selecao ? selecao.pontos.reduce((t, p) => t + (p.quantidade || 0), 0) : 0)],
    ['Linhas de itens', String(linhas.length)],
    ['Valor CIGAM', moeda(valorTotal)],
    ['Sem preço', String(semPreco)],
    ['Total do projeto', moeda(resumoValores.total)]
  ];
  const gap = 2;
  const wk = (util - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([rotulo, valor], i) => {
    const x = MARGEM + i * (wk + gap);
    cor(FUNDO, 'fundo');
    doc.rect(x, y, wk, 13, 'F');
    cor(CIANO, 'fundo');
    doc.rect(x, y, 1.2, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    cor(CINZA, 'texto');
    doc.text(textoPdf(rotulo.toUpperCase()), x + 3, y + 4.5);
    doc.setFontSize(9.5);
    cor(AZUL, 'texto');
    doc.text(textoPdf(valor), x + 3, y + 10);
  });
  y += 17;

  // ---------------- 1. identificação ----------------
  titulo('1. Identificação');
  kv([
    ['Demanda', `${demanda.numero || ''} · ${demanda.nome || ''}`],
    ['Cliente', demanda.cliente],
    ['Município / UF', [demanda.municipio, demanda.uf].filter(Boolean).join(' / ')],
    ['Canal / modalidade', [demanda.canal, demanda.modalidade].filter(Boolean).join(' · ')],
    ['Tipo de projeto', demanda.tipoProjeto],
    ['Tipo de entrega', demanda.tipoEntrega],
    ['Oportunidade CRM', demanda.numeroCrm],
    ['Prazo de entrega', data(demanda.prazoEntrega)],
    ['Responsável pelo B.O.M.', bom.responsavelNome],
    ['Responsáveis da demanda', (demanda.responsaveis || []).filter(r => r.ativo).map(r => r.nome).join(', ')]
  ]);

  // ---------------- 2. Go/No-Go ----------------
  titulo('2. Análise Go/No-Go');
  if (analise) {
    paragrafo(`${String(analise.decisao || '').toUpperCase()} · ${numero(analise.pontuacao)} pontos · ${analise.avaliadorNome || ''} · ${data(analise.data)}`, 9.5, AZUL, 'bold');
    if (analise.parecer) {
      paragrafo(`Parecer: ${analise.parecer}`);
    }
  } else {
    paragrafo('Sem análise registrada.', 9, CINZA);
  }

  // ---------------- 3. composição ----------------
  titulo('3. Composição da solução');
  const corpoPontos: any[] = [];
  (selecao ? selecao.pontos : []).forEach(p => {
    const vigentes = historico.filter(r => r.pontoId === p.id && r.situacao === 'aplicada');
    corpoPontos.push([
      { content: textoPdf(p.nome), styles: { fontStyle: 'bold' } },
      textoPdf(nomeKitDoPonto(p) + (vigentes.length ? `\nkit alterado: ${vigentes.length} item(ns)` : '')),
      String(p.quantidade), String(p.camerasVideo), String(p.camerasOcr),
      textoPdf(solucoesDoPonto(p))
    ]);
    vigentes.forEach(r => {
      const a = r.alteracao;
      const linhasAlt = [
        `- Sai: ${a.removido.descricao} (${a.removido.codigo || 'sem código'} · ${r.quantidadeRemovida} un.)`,
        a.acao === 'substituir' && a.adicionado ? `+ Entra: ${a.adicionado.descricao} (${a.adicionado.codigo || 'sem código'} · ${r.quantidadeAdicionada} un.)` : 'Cancelado sem substituto',
        `${a.acao === 'substituir' ? 'Substituído' : 'Cancelado'} por ${a.por || 'usuário não identificado'} · ${dataHora(a.em)} · Motivo: ${a.motivo}`
      ];
      corpoPontos.push([
        '',
        { content: textoPdf(linhasAlt.join('\n')), colSpan: 5, styles: { fontSize: 7.5, textColor: CINZA, fillColor: [255, 252, 247] } }
      ]);
    });
  });
  tabela({
    head: [['Ponto', 'Kit', 'Qtd.', 'Vídeo', 'OCR', 'Soluções'].map(textoPdf)],
    body: corpoPontos.length ? corpoPontos : [[{ content: 'Nenhum ponto.', colSpan: 6 }]],
    columnStyles: { 2: { halign: 'right', cellWidth: 12 }, 3: { halign: 'right', cellWidth: 13 }, 4: { halign: 'right', cellWidth: 12 } }
  });

  // ---------------- 4. itens ----------------
  titulo('4. Itens do B.O.M.');
  tabela({
    head: [['Código CIGAM', 'Descrição', 'Categoria', 'Qtd.', 'Valor unit.', 'Total'].map(textoPdf)],
    body: linhas.map(l => [
      l.pendente || !l.codigo ? { content: 'sem código', styles: { fontStyle: 'italic', textColor: [180, 83, 9] } } : textoPdf(l.codigo),
      textoPdf(l.descricao + (l.substituto ? ' (substituto)' : '')),
      textoPdf(l.categoria),
      numero(l.quantidade, 0),
      l.valorUnitario !== undefined ? moeda(l.valorUnitario) : '-',
      l.total !== undefined ? moeda(l.total) : '-'
    ]),
    foot: [[
      { content: textoPdf(`Total com valores do CIGAM${semPreco ? ` (${semPreco} item(ns) sem preço não somados)` : ''}`), colSpan: 5 },
      { content: moeda(valorTotal), styles: { halign: 'right' } }
    ]],
    showFoot: 'lastPage',
    columnStyles: {
      0: { cellWidth: 24, font: 'courier', fontSize: 7.5 },
      2: { cellWidth: 24 },
      3: { halign: 'right', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 26 }
    }
  });

  // ---------------- 5. alterações ----------------
  titulo('5. Alterações nos kits');
  if (historico.length) {
    tabela({
      head: [['Ponto / kit', 'Alteração', 'Quem / quando', 'Situação'].map(textoPdf)],
      body: historico.map(r => {
        const a = r.alteracao;
        return [
          textoPdf(`${r.pontoNome}\n${r.kit}`),
          textoPdf(`- ${a.removido.descricao} (${a.removido.codigo || 'sem código'})` +
            (a.acao === 'substituir' && a.adicionado ? `\n+ ${a.adicionado.descricao} (${a.adicionado.codigo || 'sem código'})` : '\nCancelado sem substituto') +
            `\nMotivo: ${a.motivo}`),
          textoPdf(`${a.por || 'usuário não identificado'}\n${dataHora(a.em)}` +
            (a.desfeita ? `\nDesfeita por ${a.desfeita.por || 'usuário não identificado'} · ${dataHora(a.desfeita.em)}${a.desfeita.motivo ? ` (${a.desfeita.motivo})` : ''}` : '')),
          {
            content: r.situacao === 'aplicada' ? 'Em vigor' : r.situacao === 'desfeita' ? 'Desfeita' : 'Não aplicada',
            styles: { fontStyle: 'bold', textColor: r.situacao === 'aplicada' ? VERDE : r.situacao === 'desfeita' ? CINZA : VERMELHO }
          }
        ];
      }),
      columnStyles: { 0: { cellWidth: 36 }, 2: { cellWidth: 42 }, 3: { cellWidth: 20 } }
    });
  } else {
    paragrafo('Nenhum item trocado ou cancelado.', 9, CINZA);
  }

  // ---------------- 6. integração e manutenção ----------------
  titulo('6. Integração e manutenção');
  const c = selecao ? selecao.complementosHH : undefined;
  const i = c ? c.integracao : undefined;
  const m = c ? c.manutencao : undefined;
  const resp = (x?: { tem: boolean }): string => (x ? (x.tem ? 'Sim' : 'Não') : 'Não respondido');
  const paresComp: Array<[string, string]> = [['Tem integração?', resp(i)]];
  if (i && i.tem) {
    paresComp.push(['Integração', `${numero(i.horas, 0)} h × ${moeda(i.valorHora)} + BDI ${numero(i.bdi || 0)}% = ${moeda(totalIntegracao(i))}`]);
  }
  paresComp.push(['Tem contrato de manutenção?', resp(m)]);
  if (m && m.tem) {
    paresComp.push(['Manutenção', `${numero(m.pontos, 0)} ponto(s) × ${moeda(m.valorPonto)} = ${moeda(totalManutencao(m))}`]);
  }
  kv(paresComp);

  // ---------------- 7. totais ----------------
  titulo('7. Totais do projeto');
  tabela({
    head: [['Composição', 'Cálculo', 'Valor'].map(textoPdf)],
    body: [
      ['Itens do kit', textoPdf(`Valores do CIGAM${resumoValores.itensSemPreco ? ` · ${resumoValores.itensSemPreco} item(ns) sem preço fora` : ''}`), moeda(resumoValores.valorItens)],
      ...resumoValores.areas.map(a => [textoPdf(a.nome), textoPdf(`${numero(a.pctFixo * 100)}% sobre os itens`), moeda(a.valor)]),
      ['Integração', textoPdf(i && i.tem ? `${numero(i.horas, 0)} h × ${moeda(i.valorHora)} + BDI ${numero(i.bdi || 0)}%` : resp(i) === 'Não' ? 'Não tem' : resp(i)), moeda(resumoValores.integracao)],
      ['Manutenção', textoPdf(m && m.tem ? `${numero(m.pontos, 0)} ponto(s) × ${moeda(m.valorPonto)}` : resp(m) === 'Não' ? 'Não tem' : resp(m)), moeda(resumoValores.manutencao)]
    ].map(r => r.map(textoPdf)),
    foot: [[{ content: 'Total do projeto', colSpan: 2 }, { content: moeda(resumoValores.total), styles: { halign: 'right' } }]],
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 34 } }
  });

  // ---------------- 8. alertas ----------------
  titulo('8. Alertas e pendências');
  if (alertas.length) {
    alertas.forEach(a => paragrafo(`- ${a}`, 8.5));
  } else {
    paragrafo('Nenhuma pendência.', 9, CINZA);
  }

  // ---------------- rodapé em todas as páginas ----------------
  const paginas: number = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    cor(BORDA, 'linha');
    doc.setLineWidth(0.2);
    doc.line(MARGEM, altura - 12, largura - MARGEM, altura - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    cor(CINZA, 'texto');
    doc.text(textoPdf(`BOM ${numeroBom(bom)} ${bom.revisao || ''} · Portal DGT · Arquitetura de Soluções`), MARGEM, altura - 8);
    doc.text(`DGT Tecnologia · página ${p} de ${paginas}`, largura - MARGEM, altura - 8, { align: 'right' });
  }

  return doc.output('blob') as Blob;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Baixa o arquivo (âncora com download; o SharePoint não bloqueia
// porque não abre janela nova).
export const baixarBlob = (blob: Blob, nome: string): void => {
  const nav = window.navigator as unknown as { msSaveOrOpenBlob?: (b: Blob, n: string) => void };
  if (nav.msSaveOrOpenBlob) {
    nav.msSaveOrOpenBlob(blob, nome);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};
