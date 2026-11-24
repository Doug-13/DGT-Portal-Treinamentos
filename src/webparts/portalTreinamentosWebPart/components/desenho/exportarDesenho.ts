import logoDgt from '../../assets/logo-dgt.png';

// ============================================================
// EXPORTAÇÃO DO DESENHO DE PROCESSO
//
//   PDF  → cabeçalho no padrão DGT + desenho ajustado à página
//   PNG  → imagem do desenho (alta resolução)
//   SVG  → desenho vetorial (abre no navegador, Inkscape etc.)
//   BPMN → arquivo do desenho (reabre no portal ou em outra
//          ferramenta BPMN, ex.: Camunda Modeler)
//
// Tudo é gerado no navegador; nada é enviado para fora.
// ============================================================

const COR_AZUL: [number, number, number] = [32, 42, 68];      // #202A44
const COR_CIANO: [number, number, number] = [5, 195, 221];     // #05C3DD
const COR_CINZA: [number, number, number] = [94, 102, 112];    // #5E6670
const COR_BORDA: [number, number, number] = [217, 217, 214];   // #D9D9D6

export type FormatoPaginaPdf = 'a4' | 'a3';

export interface ICabecalhoPdfDesenho {
  titulo: string;
  codigo: string;
  versao: number;
  status: string;
  processo?: string;
  area?: string;
  elaboradoPor?: string;
  aprovadoPor?: string;
  dataPublicacao?: string;
}

interface IImagemPng {
  dataUrl: string;
  largura: number;
  altura: number;
}

// Maior lado da imagem gerada. Acima disso alguns navegadores
// recusam o canvas (desenhos muito grandes).
const LADO_MAXIMO_PX = 8000;

const carregarImagem = (
  origem: string
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error('Não foi possível gerar a imagem do desenho.'));
    imagem.src = origem;
  });

// Tamanho do desenho lido do próprio SVG (width/height ou viewBox).
const tamanhoDoSvg = (
  svg: string
): { largura: number; altura: number } => {

  const documento =
    new DOMParser().parseFromString(svg, 'image/svg+xml');

  const raiz = documento.documentElement;

  let largura = parseFloat(raiz.getAttribute('width') || '0');
  let altura = parseFloat(raiz.getAttribute('height') || '0');

  if (!largura || !altura) {
    const viewBox = (raiz.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (viewBox.length === 4) {
      largura = viewBox[2];
      altura = viewBox[3];
    }
  }

  return {
    largura: largura || 800,
    altura: altura || 600
  };
};

export const svgParaPng = async (
  svg: string,
  escala: number = 3
): Promise<IImagemPng> => {

  const { largura, altura } = tamanhoDoSvg(svg);

  const escalaFinal =
    Math.min(escala, LADO_MAXIMO_PX / Math.max(largura, altura));

  const imagem =
    await carregarImagem(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(largura * escalaFinal));
  canvas.height = Math.max(1, Math.round(altura * escalaFinal));

  const contexto = canvas.getContext('2d');

  if (!contexto) {
    throw new Error('O navegador não permitiu gerar a imagem do desenho.');
  }

  // Fundo branco (o SVG do bpmn-js é transparente).
  contexto.fillStyle = '#FFFFFF';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    largura: canvas.width,
    altura: canvas.height
  };
};

// Logo da DGT como PNG (data URL). Se falhar, o PDF sai sem logo.
const logoComoPng = async (): Promise<IImagemPng | undefined> => {
  try {
    const imagem = await carregarImagem(logoDgt);
    const canvas = document.createElement('canvas');
    canvas.width = imagem.naturalWidth || imagem.width;
    canvas.height = imagem.naturalHeight || imagem.height;
    const contexto = canvas.getContext('2d');
    if (!contexto || !canvas.width || !canvas.height) {
      return undefined;
    }
    contexto.drawImage(imagem, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      largura: canvas.width,
      altura: canvas.height
    };
  } catch {
    return undefined;
  }
};

const dataHoraAtual = (): string => {
  const agora = new Date();
  const dois = (valor: number): string => (valor < 10 ? `0${valor}` : String(valor));
  return `${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${agora.getFullYear()} ${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
};

// ------------------------------------------------------------
// PDF
// ------------------------------------------------------------

export const gerarPdfDesenho = async (
  svg: string,
  cabecalho: ICabecalhoPdfDesenho,
  formato: FormatoPaginaPdf
): Promise<Blob> => {

  // Mesmo carregamento sob demanda usado pelo painel de Implantações.
  const modulo =
    await import(/* webpackChunkName: 'implantacoes-pdf' */ 'jspdf');

  const JsPdf = modulo.jsPDF;

  const pdf = new JsPdf({
    orientation: 'landscape',
    unit: 'mm',
    format: formato
  });

  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();
  const margem = 10;

  // ---------- Cabeçalho ----------

  const alturaCabecalho = 26;
  const topo = margem;

  pdf.setDrawColor(...COR_BORDA);
  pdf.setLineWidth(0.3);
  pdf.rect(margem, topo, larguraPagina - margem * 2, alturaCabecalho);

  // Faixa ciano à esquerda (identidade DGT)
  pdf.setFillColor(...COR_CIANO);
  pdf.rect(margem, topo, 2, alturaCabecalho, 'F');

  // Logo
  const logo = await logoComoPng();
  let xTexto = margem + 6;

  if (logo) {
    const alturaLogo = 12;
    const larguraLogo = Math.min(40, (logo.largura / logo.altura) * alturaLogo);
    pdf.addImage(logo.dataUrl, 'PNG', margem + 6, topo + (alturaCabecalho - alturaLogo) / 2, larguraLogo, alturaLogo);
    xTexto = margem + 6 + larguraLogo + 6;
  }

  // Bloco da direita: código / versão / situação
  const larguraDireita = 62;
  const xDireita = larguraPagina - margem - larguraDireita;

  pdf.setDrawColor(...COR_BORDA);
  pdf.line(xDireita, topo, xDireita, topo + alturaCabecalho);

  pdf.setTextColor(...COR_CINZA);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('CÓDIGO', xDireita + 4, topo + 6);
  pdf.text('VERSÃO', xDireita + 4, topo + 14);
  pdf.text('SITUAÇÃO', xDireita + 4, topo + 22);

  pdf.setTextColor(...COR_AZUL);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(cabecalho.codigo || '—', xDireita + 22, topo + 6);
  pdf.text(String(cabecalho.versao), xDireita + 22, topo + 14);
  pdf.text(cabecalho.status || '—', xDireita + 22, topo + 22);

  // Bloco do meio: título e dados do processo
  const larguraTexto = xDireita - xTexto - 4;

  pdf.setTextColor(...COR_AZUL);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  const linhasTitulo = pdf.splitTextToSize(cabecalho.titulo || 'Desenho de processo', larguraTexto) as string[];
  pdf.text(linhasTitulo.slice(0, 1), xTexto, topo + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...COR_CINZA);

  const linhaProcesso = [
    cabecalho.area ? `Área: ${cabecalho.area}` : '',
    cabecalho.processo ? `Processo: ${cabecalho.processo}` : ''
  ].filter(Boolean).join('   ·   ');

  const linhaResponsaveis = [
    `Elaborado por: ${cabecalho.elaboradoPor || '—'}`,
    `Aprovado por: ${cabecalho.aprovadoPor || '—'}`,
    cabecalho.dataPublicacao ? `Publicado em: ${cabecalho.dataPublicacao}` : ''
  ].filter(Boolean).join('   ·   ');

  if (linhaProcesso) {
    pdf.text(pdf.splitTextToSize(linhaProcesso, larguraTexto)[0] as string, xTexto, topo + 15);
  }
  pdf.text(pdf.splitTextToSize(linhaResponsaveis, larguraTexto)[0] as string, xTexto, topo + 21);

  // ---------- Desenho ----------

  const alturaRodape = 8;
  const areaX = margem;
  const areaY = topo + alturaCabecalho + 4;
  const areaLargura = larguraPagina - margem * 2;
  const areaAltura = alturaPagina - areaY - margem - alturaRodape;

  const png = await svgParaPng(svg, 3);

  const proporcao = Math.min(areaLargura / png.largura, areaAltura / png.altura);
  const larguraDesenho = png.largura * proporcao;
  const alturaDesenho = png.altura * proporcao;

  pdf.addImage(
    png.dataUrl,
    'PNG',
    areaX + (areaLargura - larguraDesenho) / 2,
    areaY + (areaAltura - alturaDesenho) / 2,
    larguraDesenho,
    alturaDesenho
  );

  // ---------- Rodapé ----------

  const yRodape = alturaPagina - margem;

  pdf.setDrawColor(...COR_BORDA);
  pdf.line(margem, yRodape - 5, larguraPagina - margem, yRodape - 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...COR_CINZA);
  pdf.text(`DGT TECNOLOGIA  ·  Gerado pelo Portal DGT em ${dataHoraAtual()}`, margem, yRodape - 1);
  pdf.text('Página 1 de 1', larguraPagina - margem, yRodape - 1, { align: 'right' });

  return pdf.output('blob');
};

// ------------------------------------------------------------
// Download
// ------------------------------------------------------------

export const nomeArquivoDesenho = (
  codigo: string,
  titulo: string,
  versao: number,
  extensao: string
): string => {
  const base = [codigo, titulo]
    .filter(Boolean)
    .join('_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) || 'desenho';
  return `${base}_v${versao}.${extensao}`;
};

export const baixarArquivo = (
  conteudo: Blob,
  nome: string
): void => {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Converte "data:image/png;base64,..." em arquivo (sem rede).
export const dataUrlParaBlob = (
  dataUrl: string
): Blob => {
  const [cabecalho, dados] = dataUrl.split(',');
  const tipo = (/data:([^;]+)/.exec(cabecalho) || [])[1] || 'application/octet-stream';
  const binario = atob(dados || '');
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return new Blob([bytes], { type: tipo });
};
