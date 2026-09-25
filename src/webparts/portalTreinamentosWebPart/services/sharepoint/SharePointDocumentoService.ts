import {
  SPHttpClient,
  SPHttpClientResponse
} from '@microsoft/sp-http';

export interface IUploadDocumentoResultado {
  arquivoUrl:
    string;

  serverRelativeUrl:
    string;

  nomeArquivo:
    string;

  biblioteca:
    string;
}

interface IRootFolderResponse {
  ServerRelativeUrl?: string;
}

interface IUploadResponse {
  Name?: string;
  ServerRelativeUrl?: string;
}

const escaparOData =
  (
    valor:
      string
  ): string =>
    valor.replace(
      /'/g,
      "''"
    );

const limparSegmento =
  (
    valor:
      string
  ): string => {

    return valor
      .trim()
      .split('/')
      .join('-')
      .replace(
        /[~"#%&*:<>?\\{|}]/g,
        '-'
      )
      .replace(
        /\s+/g,
        ' '
      );
  };

const lerArquivo =
  (
    arquivo:
      File
  ): Promise<ArrayBuffer> => {

    return new Promise<
      ArrayBuffer
    >(
      (
        resolve,
        reject
      ) => {

        const reader =
          new FileReader();

        reader.onload =
          (): void => {

            if (
              reader.result instanceof
                ArrayBuffer
            ) {
              resolve(
                reader.result
              );

              return;
            }

            reject(
              new Error(
                'Não foi possível ler o arquivo selecionado.'
              )
            );
          };

        reader.onerror =
          (): void => {

            reject(
              new Error(
                'Erro ao ler o arquivo selecionado.'
              )
            );
          };

        reader.readAsArrayBuffer(
          arquivo
        );
      }
    );
  };

export class SharePointDocumentoService {

  private readonly client:
    SPHttpClient;

  private readonly siteUrl:
    string;

  private readonly biblioteca:
    string;

  public constructor(
    client:
      SPHttpClient,

    siteUrl:
      string,

    biblioteca =
      'Documentos de Treinamentos'
  ) {

    this.client =
      client;

    this.siteUrl =
      siteUrl.replace(
        /\/$/,
        ''
      );

    this.biblioteca =
      biblioteca;
  }


  // Endereço do site onde os documentos ficam — usado para montar a
  // pré-visualização (Doc.aspx) dos arquivos do Office.
  public get urlSite(): string {
    return this.siteUrl;
  }

  private async criarBibliotecaDocumentos():
    Promise<void> {

    const url =
      `${this.siteUrl}/_api/web/lists`;

    const response:
      SPHttpClientResponse =
      await this.client.post(
        url,
        SPHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json;odata=nometadata',

            'Content-Type':
              'application/json;odata=nometadata'
          },

          body:
            JSON.stringify({
              BaseTemplate:
                101,

              Title:
                this.biblioteca,

              Description:
                'Biblioteca de documentos controlados do Portal DGT.'
            })
        }
      );

    if (
      !response.ok &&
      response.status !==
        409
    ) {

      const detalhe =
        await response.text();

      throw new Error(
        `A biblioteca "${this.biblioteca}" não existe e não foi possível criá-la automaticamente. ` +
        `SharePoint retornou ${response.status}. ${detalhe}`
      );
    }
  }
  private async obterRootFolder():
    Promise<string> {

    const titulo =
      escaparOData(
        this.biblioteca
      );

    const url =
      `${this.siteUrl}/_api/web/lists/getbytitle('${titulo}')/RootFolder?$select=ServerRelativeUrl`;

    const response:
      SPHttpClientResponse =
      await this.client.get(
        url,
        SPHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json;odata=nometadata'
          }
        }
      );

    if (
      !response.ok
    ) {

      if (
        response.status ===
          404
      ) {

        await this
          .criarBibliotecaDocumentos();

        const novaResposta:
          SPHttpClientResponse =
          await this.client.get(
            url,
            SPHttpClient.configurations.v1,
            {
              headers: {
                Accept:
                  'application/json;odata=nometadata'
              }
            }
          );

        if (
          !novaResposta.ok
        ) {

          const detalheNovaResposta =
            await novaResposta.text();

          throw new Error(
            `A biblioteca "${this.biblioteca}" foi solicitada, mas ainda não pôde ser localizada. ` +
            `SharePoint retornou ${novaResposta.status}. ${detalheNovaResposta}`
          );
        }

        const novosDados =
          (
            await novaResposta.json()
          ) as IRootFolderResponse;

        if (
          !novosDados.ServerRelativeUrl
        ) {
          throw new Error(
            `A biblioteca "${this.biblioteca}" foi criada, mas não retornou ServerRelativeUrl.`
          );
        }

        return novosDados
          .ServerRelativeUrl;
      }

      const detalhe =
        await response.text();

      throw new Error(
        `Não foi possível localizar a biblioteca "${this.biblioteca}". ` +
        `SharePoint retornou ${response.status}. ${detalhe}`
      );
    }

    const dados =
      (
        await response.json()
      ) as IRootFolderResponse;

    if (
      !dados.ServerRelativeUrl
    ) {

      throw new Error(
        `A biblioteca "${this.biblioteca}" não retornou ServerRelativeUrl.`
      );
    }

    return dados
      .ServerRelativeUrl;
  }

  private async garantirPasta(
    serverRelativeUrl:
      string
  ): Promise<void> {

    const pasta =
      escaparOData(
        serverRelativeUrl
      );

    const consultarUrl =
      `${this.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${pasta}')`;

    const consulta =
      await this.client.get(
        consultarUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json;odata=nometadata'
          }
        }
      );

    if (
      consulta.ok
    ) {
      return;
    }

    if (
      consulta.status !==
        404
    ) {

      const detalhe =
        await consulta.text();

      throw new Error(
        `Erro ao verificar pasta no SharePoint. ${consulta.status}. ${detalhe}`
      );
    }

    const criarUrl =
      `${this.siteUrl}/_api/web/folders/AddUsingPath(decodedurl='${pasta}')`;

    const criar =
      await this.client.post(
        criarUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json;odata=nometadata'
          }
        }
      );

    if (
      !criar.ok
    ) {

      const detalhe =
        await criar.text();

      throw new Error(
        `Não foi possível criar a pasta "${serverRelativeUrl}". ` +
        `${criar.status}. ${detalhe}`
      );
    }
  }

  public async uploadArquivo(
    area:
      string,

    codigoDocumento:
      string,

    revisao:
      string,

    arquivo:
      File,

    // true = substitui o arquivo da MESMA revisão (usado ao editar
    // uma revisão ainda em Elaboração). Revisões publicadas nunca são
    // sobrescritas porque cada revisão tem a sua própria pasta.
    sobrescrever:
      boolean = false
  ):
    Promise<IUploadDocumentoResultado> {

    if (
      !area.trim()
    ) {

      throw new Error(
        'Área não informada para o upload.'
      );
    }

    if (
      !codigoDocumento.trim()
    ) {

      throw new Error(
        'Código do documento não informado para o upload.'
      );
    }

    if (
      !revisao.trim()
    ) {

      throw new Error(
        'Revisão não informada para o upload.'
      );
    }

    if (
      !arquivo
    ) {

      throw new Error(
        'Selecione o arquivo do documento.'
      );
    }

    const root =
      await this.obterRootFolder();

    const areaSegura =
      limparSegmento(
        area
      );

    const codigo =
      limparSegmento(
        codigoDocumento
          .toUpperCase()
      );

    const revisaoSegura =
      limparSegmento(
        revisao
      );


    const pastaArea =
      `${root}/${areaSegura}`;

    const pastaDocumento =
      `${pastaArea}/${codigo}`;

    const pastaRevisao =
      `${pastaDocumento}/${revisaoSegura}`;

    await this.garantirPasta(
      pastaArea
    );

    await this.garantirPasta(
      pastaDocumento
    );

    await this.garantirPasta(
      pastaRevisao
    );

    const extensaoIndice =
      arquivo.name
        .lastIndexOf('.');

    const extensao =
      extensaoIndice >=
        0
        ? arquivo.name
          .substring(
            extensaoIndice
          )
        : '';

    const revisaoArquivo =
      revisaoSegura
        .replace(
          /[^A-Za-z0-9_-]/g,
          ''
        );

    const nomeArquivo =
      limparSegmento(
        `${codigo}_${revisaoArquivo}`
      ) +
      extensao;

    const pastaEscapada =
      escaparOData(
        pastaRevisao
      );

    const arquivoEscapado =
      escaparOData(
        nomeArquivo
      );

    const uploadUrl =
      `${this.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${pastaEscapada}')` +
      `/Files/AddUsingPath(decodedurl='${arquivoEscapado}',overwrite=${sobrescrever ? 'true' : 'false'})`;

    const conteudo =
      await lerArquivo(
        arquivo
      );

    const response:
      SPHttpClientResponse =
      await this.client.post(
        uploadUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json;odata=nometadata',

            'Content-Type':
              'application/octet-stream'
          },

          body:
            conteudo as unknown as
              string
        }
      );

    if (
      !response.ok
    ) {

      const detalhe =
        await response.text();

      throw new Error(
        `Não foi possível enviar o arquivo ao SharePoint. ` +
        `${response.status}. ${detalhe}`
      );
    }

    const enviado =
      (
        await response.json()
      ) as IUploadResponse;

    const serverRelativeUrl =
      enviado.ServerRelativeUrl ||
      `${pastaRevisao}/${nomeArquivo}`;

    const arquivoUrl =
      serverRelativeUrl
        .indexOf('http') ===
          0
          ? serverRelativeUrl
          : `${this.siteUrl.split('/sites/')[0]}${serverRelativeUrl}`;

    return {
      arquivoUrl,
      serverRelativeUrl,
      nomeArquivo:
        enviado.Name ||
        nomeArquivo,
      biblioteca:
        this.biblioteca
    };
  }
}





