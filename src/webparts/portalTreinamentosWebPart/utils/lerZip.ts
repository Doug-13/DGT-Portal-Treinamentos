// ============================================================
// LEITURA DE .ZIP NO NAVEGADOR (sem biblioteca externa)
//
// Lê o diretório central do ZIP e descompacta cada arquivo com o
// DecompressionStream nativo do navegador ("deflate-raw"), presente
// no Edge e no Chrome atuais. Suporta os métodos 0 (sem compressão)
// e 8 (deflate), que são os que o Windows, o 7-Zip e o Python geram.
// Não suporta ZIP64 (arquivos acima de 4 GB) nem ZIP com senha.
// ============================================================

export interface IArquivoZip {
  // Caminho dentro do zip (ex.: "imagens/fluxo.png").
  caminho: string;

  // Só o nome (ex.: "fluxo.png").
  nome: string;

  dados: Uint8Array;
}

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

interface IConstrutorDescompressao {
  new (formato: string): TransformStream<Uint8Array, Uint8Array>;
}

const descomprimir = async (
  dados: Uint8Array
): Promise<Uint8Array> => {

  const Construtor =
    (window as unknown as { DecompressionStream?: IConstrutorDescompressao }).DecompressionStream;

  if (!Construtor) {
    throw new Error(
      'Este navegador não consegue abrir arquivos .zip. Extraia o zip no computador e envie os arquivos soltos.'
    );
  }

  const fluxo =
    new Blob([dados]).stream().pipeThrough(new Construtor('deflate-raw'));

  return new Uint8Array(
    await new Response(fluxo).arrayBuffer()
  );
};

export const ehZip = (
  arquivo: File
): boolean =>
  /\.zip$/i.test(arquivo.name) ||
  arquivo.type === 'application/zip' ||
  arquivo.type === 'application/x-zip-compressed';

export const lerZip = async (
  arquivo: File
): Promise<IArquivoZip[]> => {

  const buffer =
    new Uint8Array(await arquivo.arrayBuffer());

  const visao =
    new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // 1) Fim do diretório central (procura de trás para frente).
  let fim = -1;

  const limite =
    Math.max(0, buffer.length - 65557);

  for (let indice = buffer.length - 22; indice >= limite; indice--) {
    if (visao.getUint32(indice, true) === ASSINATURA_FIM) {
      fim = indice;
      break;
    }
  }

  if (fim < 0) {
    throw new Error(`"${arquivo.name}" não é um .zip válido.`);
  }

  const total =
    visao.getUint16(fim + 10, true);

  let posicao =
    visao.getUint32(fim + 16, true);

  const decodificador =
    new TextDecoder('utf-8');

  const arquivos: IArquivoZip[] = [];

  // 2) Cada entrada do diretório central.
  for (let entrada = 0; entrada < total; entrada++) {

    if (visao.getUint32(posicao, true) !== ASSINATURA_CENTRAL) {
      throw new Error(`"${arquivo.name}" está corrompido (diretório central inválido).`);
    }

    const flags = visao.getUint16(posicao + 8, true);
    const metodo = visao.getUint16(posicao + 10, true);
    const tamanhoComprimido = visao.getUint32(posicao + 20, true);
    const tamanhoNome = visao.getUint16(posicao + 28, true);
    const tamanhoExtra = visao.getUint16(posicao + 30, true);
    const tamanhoComentario = visao.getUint16(posicao + 32, true);
    const inicioLocal = visao.getUint32(posicao + 42, true);

    const caminho =
      decodificador.decode(buffer.subarray(posicao + 46, posicao + 46 + tamanhoNome));

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;

    // Pastas, lixo do macOS e arquivos ocultos ficam de fora.
    if (
      /\/$/.test(caminho) ||
      /(^|\/)__MACOSX\//.test(caminho) ||
      /(^|\/)\./.test(caminho)
    ) {
      continue;
    }

    if ((flags & 0x1) !== 0) {
      throw new Error(`"${caminho}" está protegido por senha. Gere o zip sem senha.`);
    }

    if (visao.getUint32(inicioLocal, true) !== ASSINATURA_LOCAL) {
      throw new Error(`"${arquivo.name}" está corrompido (cabeçalho de "${caminho}").`);
    }

    const inicioDados =
      inicioLocal + 30 +
      visao.getUint16(inicioLocal + 26, true) +
      visao.getUint16(inicioLocal + 28, true);

    const bruto =
      buffer.subarray(inicioDados, inicioDados + tamanhoComprimido);

    let dados: Uint8Array;

    if (metodo === 0) {
      dados = bruto.slice();
    } else if (metodo === 8) {
      dados = await descomprimir(bruto);
    } else {
      throw new Error(`"${caminho}" usa um tipo de compressão não suportado (${metodo}).`);
    }

    const partes =
      caminho.split('/');

    arquivos.push({
      caminho,
      nome: partes[partes.length - 1],
      dados
    });
  }

  return arquivos;
};

const TIPOS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  json: 'application/json'
};

// Converte uma entrada do zip em File (para os serviços que já
// trabalham com File: análise do JSON e envio da imagem).
export const arquivoDoZip = (
  item: IArquivoZip
): File => {
  const extensao = (item.nome.split('.').pop() || '').toLowerCase();
  return new File([item.dados], item.nome, { type: TIPOS[extensao] || 'application/octet-stream' });
};
