import {
  SPHttpClient,
  SPHttpClientResponse
} from '@microsoft/sp-http';

import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  SituacaoArquivoCertificado
} from '../models/Treinamento';

// ============================================================
// CERTIFICADOS — VÍNCULO COM O PDF NO SHAREPOINT
//
// A tela Certificados só mostrava os dados do treinamento e o
// aviso fixo "O arquivo PDF será vinculado...". O PDF gerado
// pelo fluxo nunca aparecia.
//
// Agora, para cada treinamento concluído:
//   1. Lê o registro dgt_certificado da atribuição (o mais
//      recente e ativo): número, emissão, dgt_arquivourl e
//      dgt_biblioteca.
//   2. Se dgt_arquivourl estiver preenchido → usa esse endereço.
//   3. Senão, procura o arquivo "<número>.pdf" na biblioteca:
//        <biblioteca>/<número>.pdf
//        <biblioteca>/Emitidos/<número>.pdf
//      Biblioteca = dgt_biblioteca, ou "Certificados" do site do
//      portal (BIBLIOTECA_PADRAO).
//
// Assim o PDF aparece mesmo que o fluxo do Power Automate não
// grave o endereço de volta no Dataverse.
// ============================================================

export const BIBLIOTECA_PADRAO = 'Certificados';

const PASTAS_PROCURA = ['', 'Emitidos'];

const TAMANHO_LOTE = 25;

export interface ICertificadoArquivo {
  numero: string;
  emissao: string;
  arquivoUrl?: string;
  downloadUrl?: string;
  // Miniatura gerada pelo SharePoint (1ª página do PDF).
  previewUrl?: string;
  situacao: SituacaoArquivoCertificado;
}

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const ehGuid = (valor: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const semBarraFinal = (url: string): string =>
  url.replace(/\/+$/, '');

// "https://x.sharepoint.com/sites/abc/Certificados" → "https://x.sharepoint.com/sites/abc"
const webDaUrl = (urlAbsoluta: string, padrao: string): string => {
  const m = /^(https:\/\/[^/]+(?:\/(?:sites|teams)\/[^/]+)?)/i.exec(urlAbsoluta);
  return m ? m[1] : padrao;
};

const origemDe = (url: string): string => {
  const m = /^(https:\/\/[^/]+)/i.exec(url);
  return m ? m[1] : '';
};

export class CertificadoService {

  private readonly dataverse: DataverseService;
  private readonly spHttpClient: SPHttpClient;
  private readonly siteUrl: string;

  public constructor(
    dataverse: DataverseService,
    spHttpClient: SPHttpClient,
    siteUrl: string
  ) {
    this.dataverse = dataverse;
    this.spHttpClient = spHttpClient;
    this.siteUrl = semBarraFinal(siteUrl);
  }

  // { usuarioTreinamentoId → arquivo do certificado }
  public async carregarPorAtribuicao(
    usuarioTreinamentoIds: string[]
  ): Promise<Record<string, ICertificadoArquivo>> {

    const ids = usuarioTreinamentoIds
      .map(guid)
      .filter(ehGuid)
      .filter((id, i, lista) => lista.indexOf(id) === i);

    if (ids.length === 0) {
      return {};
    }

    const registros: IDataverseRecord[] = [];

    for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
      const lote = ids.slice(i, i + TAMANHO_LOTE);
      const parte = await this.dataverse.listarRegistros(
        'dgt_certificado',
        '$select=dgt_certificadoid,dgt_numero,dgt_name,dgt_arquivourl,dgt_biblioteca,' +
        'dgt_dataemissao,_dgt_usuariotreinamento_value,createdon' +
        '&$filter=dgt_ativo eq true and (' +
        lote.map(id => `_dgt_usuariotreinamento_value eq ${id}`).join(' or ') +
        ')' +
        '&$orderby=createdon desc'
      );
      parte.forEach(r => registros.push(r));
    }

    // Mais recente por atribuição (a lista já vem ordenada).
    const porAtribuicao: Record<string, IDataverseRecord> = {};

    registros.forEach(r => {
      const id = guid(r._dgt_usuariotreinamento_value);
      if (!porAtribuicao[id]) {
        porAtribuicao[id] = r;
      }
    });

    const resultado: Record<string, ICertificadoArquivo> = {};

    await Promise.all(
      Object.keys(porAtribuicao).map(async id => {
        resultado[id] = await this.resolverArquivo(porAtribuicao[id]);
      })
    );

    return resultado;
  }

  private async resolverArquivo(
    registro: IDataverseRecord
  ): Promise<ICertificadoArquivo> {

    const numero = texto(registro, 'dgt_numero') || texto(registro, 'dgt_name');
    const emissao = texto(registro, 'dgt_dataemissao') || texto(registro, 'createdon');
    const informado = texto(registro, 'dgt_arquivourl');

    // 1) Endereço gravado pelo fluxo
    if (informado) {
      const absoluta = /^https:\/\//i.test(informado)
        ? informado
        : `${origemDe(this.siteUrl)}${informado.indexOf('/') === 0 ? '' : '/'}${informado}`;

      return {
        numero,
        emissao,
        situacao: 'disponivel',
        arquivoUrl: absoluta,
        downloadUrl: this.urlDownload(absoluta),
        previewUrl: this.urlPreview(absoluta)
      };
    }

    if (!numero) {
      return { numero, emissao, situacao: 'gerando' };
    }

    // 2) Procura "<número>.pdf" na biblioteca
    const biblioteca = this.urlBiblioteca(texto(registro, 'dgt_biblioteca'));
    const web = webDaUrl(biblioteca, this.siteUrl);
    const nomeArquivo = /\.pdf$/i.test(numero) ? numero : `${numero}.pdf`;

    let semAcesso = false;

    for (const pasta of PASTAS_PROCURA) {

      const absoluta = `${biblioteca}${pasta ? `/${pasta}` : ''}/${nomeArquivo}`;
      const relativa = absoluta.substring(origemDe(absoluta).length);

      const situacao = await this.verificarArquivo(web, relativa);

      if (situacao === 'existe') {
        return {
          numero,
          emissao,
          situacao: 'disponivel',
          arquivoUrl: absoluta,
          downloadUrl: this.urlDownload(absoluta),
          previewUrl: this.urlPreview(absoluta)
        };
      }

      if (situacao === 'semAcesso') {
        semAcesso = true;
      }
    }

    return {
      numero,
      emissao,
      situacao: semAcesso ? 'semAcesso' : 'gerando'
    };
  }

  // dgt_biblioteca aceita URL completa, caminho do servidor
  // ("/sites/x/Certificados") ou só o nome ("Certificados").
  private urlBiblioteca(valor: string): string {

    const v = semBarraFinal((valor || '').trim());

    if (/^https:\/\//i.test(v)) {
      return v;
    }

    if (v.indexOf('/') === 0) {
      return `${origemDe(this.siteUrl)}${v}`;
    }

    return `${this.siteUrl}/${v || BIBLIOTECA_PADRAO}`;
  }

  private urlDownload(absoluta: string): string {
    const web = webDaUrl(absoluta, this.siteUrl);
    return `${web}/_layouts/15/download.aspx?SourceUrl=${encodeURIComponent(absoluta)}`;
  }

  // Miniatura da 1ª página, gerada pelo próprio SharePoint
  // (mesmo serviço das miniaturas da biblioteca de documentos).
  private urlPreview(absoluta: string): string {
    const web = webDaUrl(absoluta, this.siteUrl);
    return `${web}/_layouts/15/getpreview.ashx?path=${encodeURIComponent(absoluta)}&resolution=3`;
  }

  private async verificarArquivo(
    web: string,
    caminhoServidor: string
  ): Promise<'existe' | 'naoExiste' | 'semAcesso'> {

    const caminho = caminhoServidor.replace(/'/g, "''");

    try {
      const resposta: SPHttpClientResponse =
        await this.spHttpClient.get(
          `${web}/_api/web/GetFileByServerRelativePath(decodedurl='${encodeURIComponent(caminho)}')?$select=Exists`,
          SPHttpClient.configurations.v1
        );

      if (resposta.ok) {
        const dados = (await resposta.json()) as { Exists?: boolean };
        return dados.Exists === false ? 'naoExiste' : 'existe';
      }

      if (resposta.status === 401 || resposta.status === 403) {
        return 'semAcesso';
      }

      return 'naoExiste';

    } catch {
      return 'naoExiste';
    }
  }
}
