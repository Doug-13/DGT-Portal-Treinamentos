import {
  DataverseService
} from './DataverseService';

import {
  SharePointDocumentoService
} from './sharepoint/SharePointDocumentoService';

// ============================================================
// MÍDIAS DE TREINAMENTO (imagens enviadas pelo portal)
//
//   Arquivo  → SharePoint, biblioteca "Midias de Treinamento",
//              pasta = código do treinamento.
//   Registro → Dataverse, tabela dgt_midia
//              (scripts/dataverse/criar-tabela-midias.ps1).
//
// Regras:
//   • cada envio recebe um NOME ÚNICO (nome-original-xxxxxx.png):
//     um arquivo nunca é sobrescrito. Assim a imagem nova nunca
//     reaproveita o endereço de uma antiga (fim do "cache") e cada
//     revisão do treinamento continua mostrando a imagem que tinha;
//   • só imagens (PNG, JPG, GIF, WEBP), até 5 MB;
//   • o conteúdo do módulo guarda o endereço direto do arquivo, então
//     todas as telas que já mostram imagens continuam funcionando.
// ============================================================

export const BIBLIOTECA_MIDIAS = 'Midias de Treinamento';

const TABELA = 'dgt_midia';

export const TAMANHO_MAXIMO_MIDIA_BYTES = 5 * 1024 * 1024;

const EXTENSOES_PERMITIDAS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
};

export const EXTENSOES_MIDIA_ACEITAS =
  Object.keys(EXTENSOES_PERMITIDAS).map(item => `.${item}`).join(',');

export interface IMidiaTreinamento {
  id: string;
  nome: string;
  nomeArquivo: string;
  url: string;
  tipoMime: string;
  tamanhoBytes: number;
  enviadoPor: string;
  criadoEm: string;
  ativo: boolean;
}

export interface ITreinamentoMidia {
  id: string;
  codigo: string;
}

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: Record<string, unknown>,
  campo: string
): string =>
  registro[campo] === undefined || registro[campo] === null
    ? ''
    : String(registro[campo]);

const extensaoDe = (
  nome: string
): string => {
  const indice = nome.lastIndexOf('.');
  return indice >= 0 ? nome.substring(indice + 1).toLowerCase() : '';
};

// "Fluxo do Processo (v2).PNG" → "fluxo-do-processo-v2"
const slug = (
  nome: string
): string =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'imagem';

const sufixoAleatorio = (): string =>
  `${new Date().getTime().toString(36).slice(-3)}${Math.random().toString(36).slice(2, 5)}`;

export const formatarTamanho = (
  bytes: number
): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Validação antes de enviar (também usada pela tela).
export const validarArquivoMidia = (
  arquivo: File
): string => {

  const extensao =
    extensaoDe(arquivo.name);

  if (!EXTENSOES_PERMITIDAS[extensao]) {
    return `"${arquivo.name}": formato não aceito. Use PNG, JPG, GIF ou WEBP.`;
  }

  if (arquivo.size > TAMANHO_MAXIMO_MIDIA_BYTES) {
    return `"${arquivo.name}" tem ${formatarTamanho(arquivo.size)}. O limite é ${formatarTamanho(TAMANHO_MAXIMO_MIDIA_BYTES)} — reduza a imagem (ex.: salve como JPG).`;
  }

  if (arquivo.size === 0) {
    return `"${arquivo.name}" está vazio.`;
  }

  return '';
};

export class MidiaTreinamentoService {

  private readonly dataverse: DataverseService;

  private readonly sharePoint: SharePointDocumentoService;

  public constructor(
    dataverse: DataverseService,
    sharePoint: SharePointDocumentoService
  ) {
    this.dataverse = dataverse;
    this.sharePoint = sharePoint;
  }

  private mapear(
    registro: Record<string, unknown>
  ): IMidiaTreinamento {
    return {
      id: guid(registro.dgt_midiaid),
      nome: texto(registro, 'dgt_name'),
      nomeArquivo: texto(registro, 'dgt_nomearquivo'),
      url: texto(registro, 'dgt_url'),
      tipoMime: texto(registro, 'dgt_tipomime'),
      tamanhoBytes: Number(registro.dgt_tamanhobytes || 0),
      enviadoPor: texto(registro, 'dgt_enviadopor'),
      criadoEm: texto(registro, 'createdon'),
      ativo: registro.dgt_ativo !== false
    };
  }

  // Mídias ativas do treinamento, das mais novas para as mais antigas.
  // Lança erro com mensagem clara se a tabela ainda não existir.
  public async listar(
    treinamentoId: string
  ): Promise<IMidiaTreinamento[]> {

    const id =
      guid(treinamentoId);

    if (!id) {
      return [];
    }

    try {

      const registros =
        await this.dataverse.listarRegistros(
          TABELA,
          '$select=dgt_midiaid,dgt_name,dgt_nomearquivo,dgt_url,dgt_tipomime,dgt_tamanhobytes,dgt_enviadopor,dgt_ativo,createdon' +
          `&$filter=_dgt_treinamento_value eq ${id} and dgt_ativo eq true` +
          '&$orderby=createdon desc'
        );

      return registros.map(registro => this.mapear(registro));

    } catch (error) {

      const mensagem =
        error instanceof Error ? error.message : String(error);

      if (/dgt_midia|EntitySet|não encontrad|not found|404/i.test(mensagem)) {
        throw new Error(
          'A tabela de mídias (dgt_midia) ainda não existe ou você não tem permissão de leitura. ' +
          'Rode scripts/dataverse/criar-tabela-midias.ps1 e confira o perfil de segurança.'
        );
      }

      throw error;
    }
  }

  // Envia a imagem para o SharePoint (nome único) e registra no
  // Dataverse. Devolve a mídia criada (com o endereço direto).
  public async enviar(
    arquivo: File,
    treinamento: ITreinamentoMidia,
    enviadoPor: string
  ): Promise<IMidiaTreinamento> {

    const erro =
      validarArquivoMidia(arquivo);

    if (erro) {
      throw new Error(erro);
    }

    const treinamentoId =
      guid(treinamento.id);

    if (!treinamentoId) {
      throw new Error('Selecione o treinamento antes de enviar imagens.');
    }

    const extensao =
      extensaoDe(arquivo.name);

    const baseOriginal =
      arquivo.name.substring(0, arquivo.name.length - extensao.length - 1);

    const nomeUnico =
      `${slug(baseOriginal)}-${sufixoAleatorio()}.${extensao}`;

    const pasta =
      (treinamento.codigo || treinamentoId)
        .trim()
        .toUpperCase();

    const enviado =
      await this.sharePoint.enviarArquivoEmPasta(
        [pasta],
        nomeUnico,
        arquivo
      );

    const dados: Record<string, unknown> = {
      dgt_name: arquivo.name.substring(0, 200),
      dgt_nomearquivo: enviado.nomeArquivo.substring(0, 255),
      dgt_url: enviado.arquivoUrl,
      dgt_caminho: enviado.serverRelativeUrl,
      dgt_tipomime: (arquivo.type || EXTENSOES_PERMITIDAS[extensao]).substring(0, 100),
      dgt_tamanhobytes: arquivo.size,
      dgt_enviadopor: (enviadoPor || '').substring(0, 200),
      dgt_ativo: true,
      'dgt_Treinamento@odata.bind':
        await this.dataverse.referenciaLookup('dgt_treinamento', treinamentoId)
    };

    let id = '';

    try {
      id =
        await this.dataverse.criarRegistro(
          TABELA,
          dados
        );
    } catch (error) {
      console.error(error);
      throw new Error(
        `A imagem foi enviada ao SharePoint (${enviado.nomeArquivo}), mas não foi possível registrá-la no Dataverse ` +
        `(${error instanceof Error ? error.message : String(error)}). Confira se a tabela dgt_midia existe e se o seu ` +
        'perfil pode criar registros nela.'
      );
    }

    return {
      id: guid(id),
      nome: arquivo.name,
      nomeArquivo: enviado.nomeArquivo,
      url: enviado.arquivoUrl,
      tipoMime: String(dados.dgt_tipomime),
      tamanhoBytes: arquivo.size,
      enviadoPor: enviadoPor || '',
      criadoEm: new Date().toISOString(),
      ativo: true
    };
  }
}
