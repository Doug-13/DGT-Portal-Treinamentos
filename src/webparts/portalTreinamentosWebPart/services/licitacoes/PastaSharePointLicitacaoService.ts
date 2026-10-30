import {
  ILicitacaoResultado
} from '../../models/Licitacao';

// ============================================================
// LICITAÇÕES — PASTA DO EDITAL NO SHAREPOINT (DGT - Comercial)
//
// Ao "Participar", cria (se ainda não existir) a estrutura:
//
//   CLIENTE NOVO (a pasta da cidade ainda não existe):
//     General › {Estado} › Público › Clientes › {Cidade} › {Ano} › Edital
//     ex.: General/Rio Grande do Sul/Público/Clientes/Mostardas/2026/Edital
//
//   CLIENTE QUE JÁ EXISTE (a pasta da cidade já existe):
//     … › {Cidade} › {Ano} › Edital {número}
//     ex.: …/Clientes/Mostardas/2026/Edital PE 44-2026
//   Assim os arquivos de cada edital ficam numa pasta própria e não se
//   misturam com o que já estava na pasta do cliente.
//
// Pastas que já existem são reaproveitadas (nada é sobrescrito).
// Usa a sessão do SharePoint de quem clicou: a pessoa precisa de
// permissão de EDIÇÃO na biblioteca Documentos do site DGT - Comercial.
// ============================================================

export const PASTA_EDITAIS = {
  siteUrl: 'https://dgtnh.sharepoint.com/sites/DGT-Comercial2',
  // Caminho do servidor da biblioteca "Documentos" (Shared Documents)
  biblioteca: '/sites/DGT-Comercial2/Shared Documents',
  // {estado} {cidade} {ano} são substituídos; o resto é fixo.
  modelo: ['General', '{estado}', 'Público', 'Clientes', '{cidade}', '{ano}'],
  // Última pasta: cliente novo → "Edital"; cliente existente → "Edital {número}".
  pastaEdital: 'Edital',
  // Posição da pasta da cidade no modelo (para saber se o cliente já existe).
  indiceCidade: 4
};

// "PE 44/2026" → "PE 44-2026" ("/" não é aceito em nome de pasta).
export const nomePastaEditalNumerado = (numero: string): string => {
  const limpo = (numero || '').replace(/[/\\]/g, '-').replace(/\s+/g, ' ').trim();
  return limpo ? `${PASTA_EDITAIS.pastaEdital} ${limpo}` : `${PASTA_EDITAIS.pastaEdital} ${new Date().toISOString().substring(0, 10)}`;
};

const ESTADOS: { [uf: string]: string } = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
};

// "MOSTARDAS" / "mostardas" → "Mostardas"; "SAO LEOPOLDO" → "Sao Leopoldo"
// (mantém acentos quando vierem no PNCP: "São Leopoldo").
const nomeProprio = (texto: string): string =>
  (texto || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(p => p.length > 0)
    .map((p, i) => (i > 0 && /^(de|da|do|das|dos|e)$/.test(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

// Caracteres que o SharePoint não aceita em nomes de pasta.
const segmentoSeguro = (texto: string): string =>
  (texto || '')
    .replace(/["*:<>?/\\|#%~&{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .substring(0, 120);

const escaparOData = (valor: string): string => valor.replace(/'/g, "''");

export interface IPastaEdital {
  caminho: string;   // caminho no servidor (/sites/.../Edital)
  url: string;       // link para abrir a pasta no navegador
  criada: boolean;   // false = já existia
  // true = a pasta do cliente (cidade) já existia: os arquivos foram
  // para "Edital {número}" dentro do ano.
  clienteExistia?: boolean;
}

export const montarSegmentosPasta = (item: Pick<ILicitacaoResultado, 'local' | 'orgao' | 'numero' | 'publicacao'>): string[] => {

  const [cidadeBruta, ufBruta] = (item.local || '').split('/');
  const uf = (ufBruta || '').trim().toUpperCase();
  const cidade = nomeProprio((cidadeBruta || item.orgao || 'Sem cidade').trim());
  const estado = ESTADOS[uf] || uf || 'Sem estado';

  const anoNumero = /\/(\d{4})\b/.exec(item.numero || '');
  const anoPublicacao = /^(\d{4})/.exec(item.publicacao || '');
  const ano = anoNumero ? anoNumero[1] : anoPublicacao ? anoPublicacao[1] : String(new Date().getFullYear());

  return PASTA_EDITAIS.modelo.map(parte =>
    segmentoSeguro(
      parte
        .replace('{estado}', estado)
        .replace('{cidade}', cidade)
        .replace('{ano}', ano)
    ));
};

export const urlDaPasta = (caminho: string): string =>
  `${PASTA_EDITAIS.siteUrl}/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent(caminho)}`;

// Caminho no servidor a partir do link guardado (…AllItems.aspx?id=…).
export const caminhoDaUrl = (url: string): string => {
  const m = /[?&]id=([^&]+)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : '';
};

export type ResultadoEnvio = 'enviado' | 'existente';

export class PastaSharePointLicitacaoService {

  // Grava um arquivo na pasta. Se já existir um arquivo com o mesmo
  // nome, NÃO sobrescreve (devolve "existente").
  public async enviarArquivo(
    caminhoPasta: string,
    nomeArquivo: string,
    conteudo: Blob
  ): Promise<ResultadoEnvio> {

    const nome = segmentoSeguro(nomeArquivo) || 'documento';
    const caminhoArquivo = `${caminhoPasta}/${nome}`;

    if (await this.existeArquivo(caminhoArquivo)) {
      return 'existente';
    }

    const resposta = await fetch(
      `${PASTA_EDITAIS.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(caminhoPasta))}')` +
      `/Files/AddUsingPath(decodedurl='${encodeURIComponent(escaparOData(nome))}',overwrite=false)`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json;odata=nometadata',
          'X-RequestDigest': await this.obterDigest()
        },
        body: await conteudo.arrayBuffer()
      }
    );

    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Sem permissão de edição na pasta do edital no SharePoint.');
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Não foi possível gravar "${nome}" (${resposta.status}). ${detalhe.substring(0, 160)}`);
    }

    return 'enviado';
  }

  private async existeArquivo(caminho: string): Promise<boolean> {
    const resposta = await fetch(
      `${PASTA_EDITAIS.siteUrl}/_api/web/GetFileByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(caminho))}')?$select=Exists`,
      { credentials: 'same-origin', headers: { Accept: 'application/json;odata=nometadata' } }
    );
    if (!resposta.ok) {
      return false;
    }
    const dados = (await resposta.json()) as { Exists?: boolean };
    return dados.Exists !== false;
  }


  private digest?: { valor: string; expira: number };

  // Garante a pasta do edital e devolve o caminho e o link.
  public async garantirPasta(
    item: Pick<ILicitacaoResultado, 'local' | 'orgao' | 'numero' | 'publicacao'>
  ): Promise<IPastaEdital> {

    const segmentos = montarSegmentosPasta(item);
    let caminho = PASTA_EDITAIS.biblioteca;
    let criada = false;
    let clienteExistia = false;

    for (let i = 0; i < segmentos.length; i++) {
      caminho = `${caminho}/${segmentos[i]}`;
      const existia = await this.existe(caminho);
      if (i === PASTA_EDITAIS.indiceCidade) {
        clienteExistia = existia;
      }
      if (!existia) {
        await this.criar(caminho);
        criada = true;
      }
    }

    // Cliente que já existe: pasta própria com o número do edital.
    const ultima = segmentoSeguro(
      clienteExistia ? nomePastaEditalNumerado(item.numero || '') : PASTA_EDITAIS.pastaEdital
    );

    caminho = `${caminho}/${ultima}`;
    if (!(await this.existe(caminho))) {
      await this.criar(caminho);
      criada = true;
    }

    return { caminho, url: urlDaPasta(caminho), criada, clienteExistia };
  }

  private async existe(caminho: string): Promise<boolean> {
    const resposta = await fetch(
      `${PASTA_EDITAIS.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(caminho))}')?$select=Exists`,
      { credentials: 'same-origin', headers: { Accept: 'application/json;odata=nometadata' } }
    );
    if (resposta.status === 404) {
      return false;
    }
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Sem acesso ao site DGT - Comercial para criar a pasta do edital.');
    }
    if (!resposta.ok) {
      throw new Error(`Não foi possível verificar a pasta no SharePoint (${resposta.status}).`);
    }
    const dados = (await resposta.json()) as { Exists?: boolean };
    return dados.Exists !== false;
  }

  private async criar(caminho: string): Promise<void> {
    const resposta = await fetch(
      `${PASTA_EDITAIS.siteUrl}/_api/web/folders/AddUsingPath(decodedurl='${encodeURIComponent(escaparOData(caminho))}')`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json;odata=nometadata',
          'X-RequestDigest': await this.obterDigest()
        }
      }
    );
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Sem permissão de edição na biblioteca Documentos do site DGT - Comercial para criar a pasta do edital.');
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Não foi possível criar a pasta "${caminho.split('/').pop()}" (${resposta.status}). ${detalhe.substring(0, 160)}`);
    }
  }

  // Token de formulário do site (exigido em POST no SharePoint).
  private async obterDigest(): Promise<string> {
    if (this.digest && this.digest.expira > Date.now()) {
      return this.digest.valor;
    }
    const resposta = await fetch(`${PASTA_EDITAIS.siteUrl}/_api/contextinfo`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=nometadata' }
    });
    if (!resposta.ok) {
      throw new Error(`Sem acesso ao site DGT - Comercial (${resposta.status}).`);
    }
    const dados = (await resposta.json()) as { FormDigestValue: string; FormDigestTimeoutSeconds: number };
    this.digest = {
      valor: dados.FormDigestValue,
      expira: Date.now() + Math.max(60, (dados.FormDigestTimeoutSeconds || 1800) - 60) * 1000
    };
    return this.digest.valor;
  }
}
