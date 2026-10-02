import {
  IDadosEdital,
  IDocumentoEdital,
  IItemEdital,
  IRegistroPncp
} from '../models/Licitacao';

import {
  converterValor,
  extrairDadosEdital,
  interpretarIdPncp
} from '../utils/licitacoesFiltro';

// ============================================================
// LICITAÇÕES — DETALHES DO EDITAL (PNCP)
//
// Endpoints públicos (sem autenticação):
//   Detalhe    GET /api/consulta/v1/orgaos/{o}/compras/{ano}/{seq}
//   Itens      GET /api/pncp/v1/orgaos/{o}/compras/{ano}/{seq}/itens
//   Documentos GET /api/pncp/v1/orgaos/{o}/compras/{ano}/{seq}/arquivos
//   Arquivo    GET (url devolvida na lista de documentos)
//
// {o} é o identificador do órgão no PNCP. Ele é montado em memória
// a partir do numeroControlePNCP, só para chamar a API, e nunca é
// exibido, registrado em log nem gravado.
//
// Cada parte é carregada separadamente: se o endpoint de itens
// falhar (o PNCP às vezes responde 5xx nele), o restante da
// pré-visualização continua funcionando.
// ============================================================

const BASE_CONSULTA = 'https://pncp.gov.br/api/consulta/v1';
const BASE_PNCP = 'https://pncp.gov.br/api/pncp/v1';

const TAMANHO_PAGINA_ITENS = 50;
const MAX_PAGINAS_ITENS = 20; // até 1.000 itens
const TIMEOUT_MS = 45000;

// Cache em memória (some ao recarregar a página).
const cacheItens = new Map<string, IItemEdital[]>();
const cacheDocumentos = new Map<string, IDocumentoEdital[]>();
const cacheDetalhe = new Map<string, IDadosEdital>();

const caminhoCompra = (
  idPncp: string
): string => {

  const ref = interpretarIdPncp(idPncp);

  if (!ref) {
    throw new Error('Identificador do edital em formato inesperado.');
  }

  return `/orgaos/${ref.orgao}/compras/${ref.ano}/${ref.sequencial}`;
};

const buscarJson = async (
  url: string,
  signal?: AbortSignal
): Promise<{ status: number; json?: unknown }> => {

  const controle = new AbortController();
  const repassar = (): void => controle.abort();
  const idTimeout = window.setTimeout(() => controle.abort(), TIMEOUT_MS);

  if (signal) {
    signal.addEventListener('abort', repassar);
  }

  try {
    const resposta = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      signal: controle.signal
    });

    if (resposta.status === 204 || resposta.status === 404) {
      return { status: resposta.status };
    }

    if (!resposta.ok) {
      throw new Error(`O PNCP respondeu HTTP ${resposta.status}.`);
    }

    return {
      status: resposta.status,
      json: await resposta.json()
    };

  } catch (erro) {

    if (signal && signal.aborted) {
      const cancelado = new Error('Cancelado.');
      cancelado.name = 'AbortError';
      throw cancelado;
    }

    if ((erro as Error).name === 'AbortError') {
      throw new Error('O PNCP demorou demais para responder.');
    }

    if (erro instanceof TypeError) {
      throw new Error('Falha de conexão com o PNCP.');
    }

    throw erro;

  } finally {
    window.clearTimeout(idTimeout);
    if (signal) {
      signal.removeEventListener('abort', repassar);
    }
  }
};

const numero = (valor: unknown): number | undefined =>
  converterValor(valor);

const texto = (valor: unknown): string | undefined => {
  const t = valor === undefined || valor === null ? '' : String(valor).trim();
  return t ? t : undefined;
};

// ------------------------------------------------------------
// Detalhe atualizado da compra
// ------------------------------------------------------------

export const carregarDetalheEdital = async (
  idPncp: string,
  signal?: AbortSignal
): Promise<IDadosEdital | undefined> => {

  const emCache = cacheDetalhe.get(idPncp);

  if (emCache) {
    return emCache;
  }

  const { json } = await buscarJson(
    `${BASE_CONSULTA}${caminhoCompra(idPncp)}`,
    signal
  );

  if (!json || typeof json !== 'object') {
    return undefined;
  }

  const dados = extrairDadosEdital(json as IRegistroPncp);
  cacheDetalhe.set(idPncp, dados);

  return dados;
};

// ------------------------------------------------------------
// Itens
// ------------------------------------------------------------

interface IItemBruto {
  numeroItem?: number;
  descricao?: string;
  materialOuServico?: string;
  materialOuServicoNome?: string;
  quantidade?: number | string;
  unidadeMedida?: string;
  valorUnitarioEstimado?: number | string;
  valorTotal?: number | string;
  orcamentoSigiloso?: boolean;
  criterioJulgamentoNome?: string;
  tipoBeneficioNome?: string;
  situacaoCompraItemNome?: string;
  itemCategoriaNome?: string;
}

const converterItem = (
  bruto: IItemBruto,
  indice: number
): IItemEdital => ({
  numeroItem: bruto.numeroItem || indice + 1,
  descricao: texto(bruto.descricao) || '-',
  tipo:
    texto(bruto.materialOuServicoNome) ||
    (bruto.materialOuServico === 'M'
      ? 'Material'
      : bruto.materialOuServico === 'S'
        ? 'Serviço'
        : '-'),
  quantidade: numero(bruto.quantidade),
  unidade: texto(bruto.unidadeMedida),
  valorUnitario: numero(bruto.valorUnitarioEstimado),
  valorTotal: numero(bruto.valorTotal),
  sigiloso: !!bruto.orcamentoSigiloso,
  criterioJulgamento: texto(bruto.criterioJulgamentoNome),
  beneficio: texto(bruto.tipoBeneficioNome),
  situacao: texto(bruto.situacaoCompraItemNome),
  categoria: texto(bruto.itemCategoriaNome)
});

export const carregarItensEdital = async (
  idPncp: string,
  signal?: AbortSignal
): Promise<{ itens: IItemEdital[]; truncado: boolean }> => {

  const emCache = cacheItens.get(idPncp);

  if (emCache) {
    return { itens: emCache, truncado: false };
  }

  const itens: IItemEdital[] = [];
  let truncado = false;

  for (let pagina = 1; pagina <= MAX_PAGINAS_ITENS; pagina++) {

    const { json } = await buscarJson(
      `${BASE_PNCP}${caminhoCompra(idPncp)}/itens` +
      `?pagina=${pagina}&tamanhoPagina=${TAMANHO_PAGINA_ITENS}`,
      signal
    );

    const lista: IItemBruto[] = Array.isArray(json)
      ? json as IItemBruto[]
      : (json && Array.isArray((json as { data?: unknown }).data)
        ? (json as { data: IItemBruto[] }).data
        : []);

    lista.forEach(bruto => itens.push(converterItem(bruto, itens.length)));

    if (lista.length < TAMANHO_PAGINA_ITENS) {
      break;
    }

    if (pagina === MAX_PAGINAS_ITENS) {
      truncado = true;
    }
  }

  itens.sort((a, b) => a.numeroItem - b.numeroItem);

  if (!truncado) {
    cacheItens.set(idPncp, itens);
  }

  return { itens, truncado };
};

// ------------------------------------------------------------
// Documentos
// ------------------------------------------------------------

interface IDocumentoBruto {
  sequencialDocumento?: number;
  titulo?: string;
  tipoDocumentoNome?: string;
  tipoDocumentoDescricao?: string;
  dataPublicacaoPncp?: string;
  statusAtivo?: boolean;
  url?: string;
  uri?: string;
}

export const carregarDocumentosEdital = async (
  idPncp: string,
  signal?: AbortSignal
): Promise<IDocumentoEdital[]> => {

  const emCache = cacheDocumentos.get(idPncp);

  if (emCache) {
    return emCache;
  }

  const caminho = caminhoCompra(idPncp);

  const { json } = await buscarJson(
    `${BASE_PNCP}${caminho}/arquivos`,
    signal
  );

  const lista: IDocumentoBruto[] = Array.isArray(json)
    ? json as IDocumentoBruto[]
    : [];

  const documentos = lista
    .filter(doc => doc.statusAtivo !== false)
    .map((doc, indice) => {
      const sequencial = doc.sequencialDocumento || indice + 1;
      return {
        sequencial,
        titulo: texto(doc.titulo) || `Documento ${sequencial}`,
        tipo: texto(doc.tipoDocumentoNome) || texto(doc.tipoDocumentoDescricao) || 'Documento',
        publicacao: texto(doc.dataPublicacaoPncp),
        url:
          texto(doc.url) ||
          texto(doc.uri) ||
          `https://pncp.gov.br/pncp-api/v1${caminho}/arquivos/${sequencial}`
      };
    });

  // Edital primeiro, depois por ordem de publicação
  documentos.sort((a, b) => {
    const aEdital = /edital/i.test(a.tipo) ? 0 : 1;
    const bEdital = /edital/i.test(b.tipo) ? 0 : 1;
    return aEdital - bEdital || a.sequencial - b.sequencial;
  });

  cacheDocumentos.set(idPncp, documentos);

  return documentos;
};

// ------------------------------------------------------------
// Arquivo (para exibir dentro do portal)
// ------------------------------------------------------------

export type TipoArquivoEdital = 'pdf' | 'imagem' | 'texto' | 'compactado' | 'outro';

export interface IArquivoEdital {
  urlObjeto: string;
  tipo: TipoArquivoEdital;
  tamanhoBytes: number;
}

const detectarTipo = async (
  blob: Blob
): Promise<TipoArquivoEdital> => {

  const mime = (blob.type || '').toLowerCase();

  if (mime.indexOf('pdf') >= 0) return 'pdf';
  if (mime.indexOf('image/') === 0) return 'imagem';
  if (mime.indexOf('text/') === 0) return 'texto';
  if (mime.indexOf('zip') >= 0 || mime.indexOf('rar') >= 0 || mime.indexOf('7z') >= 0) return 'compactado';

  // Muitos arquivos chegam como application/octet-stream:
  // olha a assinatura dos primeiros bytes.
  try {
    const cabecalho = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const assinatura = String.fromCharCode(cabecalho[0], cabecalho[1], cabecalho[2], cabecalho[3]);

    if (assinatura === '%PDF') return 'pdf';
    if (assinatura.substring(0, 2) === 'PK' || assinatura === 'Rar!') return 'compactado';
  } catch {
    // ignora: tipo continua desconhecido
  }

  return 'outro';
};

export const baixarArquivoEdital = async (
  url: string,
  signal?: AbortSignal
): Promise<IArquivoEdital> => {

  let resposta: Response;

  try {
    resposta = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal
    });
  } catch (erro) {
    if (signal && signal.aborted) {
      throw erro;
    }
    throw new Error(
      'O navegador não conseguiu ler o arquivo direto do PNCP. Use “Baixar” para abri-lo em outra aba.'
    );
  }

  if (!resposta.ok) {
    throw new Error(`O PNCP respondeu HTTP ${resposta.status} ao baixar o arquivo.`);
  }

  const blobOriginal = await resposta.blob();
  const tipo = await detectarTipo(blobOriginal);

  // Reetiqueta como PDF para o visualizador do navegador abrir
  // o arquivo em vez de baixá-lo.
  const blob = tipo === 'pdf' && blobOriginal.type !== 'application/pdf'
    ? new Blob([blobOriginal], { type: 'application/pdf' })
    : blobOriginal;

  return {
    urlObjeto: URL.createObjectURL(blob),
    tipo,
    tamanhoBytes: blob.size
  };
};
