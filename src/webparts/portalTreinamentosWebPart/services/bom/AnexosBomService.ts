import {
  SPHttpClient,
  SPHttpClientResponse
} from '@microsoft/sp-http';

import {
  SharePointDocumentoService
} from '../sharepoint/SharePointDocumentoService';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — ANEXOS DO GO/NO-GO
//
// Os arquivos ficam no SharePoint, na biblioteca "Arquitetura de
// Soluções" (criada automaticamente no primeiro envio), na pasta
//   Go-No-Go/<número do B.O.M.>
// Nada é gravado no Dataverse: a lista é lida da própria pasta.
// ============================================================

export const BIBLIOTECA_ARQUITETURA = 'Arquitetura de Soluções';
export const PASTA_GO_NO_GO = 'Go-No-Go';

export interface IAnexoBom {
  nome: string;
  url: string;
  caminho: string;
  tamanho: number;
  enviadoEm: string;
}

// Mesma limpeza de nome usada no envio (SharePointDocumentoService).
const limparSegmento = (valor: string): string =>
  valor
    .trim()
    .split('/')
    .join('-')
    .replace(/[~"#%&*:<>?\\{|}]/g, '-')
    .replace(/\s+/g, ' ');

const escaparOData = (valor: string): string =>
  valor.replace(/'/g, "''");

export class AnexosBomService {

  private readonly envio: SharePointDocumentoService;

  public constructor(
    private readonly client: SPHttpClient,
    private readonly siteUrl: string
  ) {
    this.envio = new SharePointDocumentoService(client, siteUrl, BIBLIOTECA_ARQUITETURA);
  }

  private async pastaDoBom(numeroBom: string): Promise<string> {
    const resposta: SPHttpClientResponse =
      await this.client.get(
        `${this.siteUrl}/_api/web/lists/getbytitle('${escaparOData(BIBLIOTECA_ARQUITETURA)}')/RootFolder?$select=ServerRelativeUrl`,
        SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

    if (!resposta.ok) {
      // Biblioteca ainda não criada: nenhum anexo.
      return '';
    }

    const raiz = (await resposta.json()) as { ServerRelativeUrl?: string };
    return `${raiz.ServerRelativeUrl || ''}/${PASTA_GO_NO_GO}/${limparSegmento(numeroBom)}`;
  }

  public async listar(numeroBom: string): Promise<IAnexoBom[]> {

    const pasta = await this.pastaDoBom(numeroBom);

    if (!pasta) {
      return [];
    }

    const resposta: SPHttpClientResponse =
      await this.client.get(
        `${this.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${escaparOData(pasta)}')/Files?$select=Name,ServerRelativeUrl,Length,TimeCreated&$orderby=TimeCreated desc`,
        SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

    if (resposta.status === 404) {
      return [];
    }

    if (!resposta.ok) {
      throw new Error(`Não foi possível listar os anexos (${resposta.status}).`);
    }

    const dados = (await resposta.json()) as {
      value?: Array<{ Name: string; ServerRelativeUrl: string; Length: string; TimeCreated: string }>;
    };

    const origem = new URL(this.siteUrl).origin;

    return (dados.value || []).map(item => ({
      nome: item.Name,
      caminho: item.ServerRelativeUrl,
      url: `${origem}${encodeURI(item.ServerRelativeUrl)}`,
      tamanho: Number(item.Length) || 0,
      enviadoEm: item.TimeCreated
    }));
  }

  public async enviar(numeroBom: string, arquivo: File): Promise<void> {
    await this.envio.enviarArquivoEmPasta(
      [PASTA_GO_NO_GO, numeroBom],
      arquivo.name,
      arquivo
    );
  }

  // Vai para a lixeira do site (recuperável).
  public async remover(anexo: IAnexoBom): Promise<void> {
    const resposta: SPHttpClientResponse =
      await this.client.post(
        `${this.siteUrl}/_api/web/GetFileByServerRelativePath(decodedurl='${escaparOData(anexo.caminho)}')/recycle()`,
        SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

    if (!resposta.ok) {
      throw new Error(`Não foi possível remover o anexo (${resposta.status}).`);
    }
  }
}
