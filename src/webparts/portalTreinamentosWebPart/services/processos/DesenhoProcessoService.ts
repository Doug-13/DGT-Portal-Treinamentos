import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

// ============================================================
// DESENHOS DE PROCESSO (tabela dgt_desenhoprocesso)
//
// Fluxogramas de DOCUMENTAÇÃO (substituem o Visio). Não têm
// regras de funcionamento e NUNCA são lidos pelo motor de fluxo
// (dgt_fluxo continua sendo só dos fluxos executáveis).
//
// Versões:
//   • cada versão é um registro; as versões de um mesmo desenho
//     têm o mesmo dgt_grupo;
//   • só a versão "rascunho" pode ser alterada;
//   • publicar uma versão arquiva a publicada anterior;
//   • nada é apagado: "Arquivar desenho" apenas desativa
//     (dgt_ativo = Não) todas as versões.
// ============================================================

const TABELA = 'dgt_desenhoprocesso';

const TABELA_PROCESSO = 'dgt_processonegocio';

// Navegação do lookup (nome de esquema da coluna).
const NAVEGACAO_PROCESSO = 'dgt_ProcessoNegocio';

// Limite da coluna dgt_xml (texto longo). Ver o script de criação.
export const TAMANHO_MAXIMO_XML = 1048576;

export type StatusDesenho =
  | 'rascunho'
  | 'publicado'
  | 'arquivado';

export const ROTULO_STATUS_DESENHO: Record<StatusDesenho, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Arquivado'
};

export interface IDesenhoProcesso {
  id: string;
  grupo: string;
  titulo: string;
  codigo: string;
  descricao: string;
  processoId: string;
  processoNome: string;
  versao: number;
  status: StatusDesenho;
  elaboradoPor: string;
  aprovadoPor: string;
  observacao: string;
  dataPublicacao: string;
  modificadoEm: string;
  ativo: boolean;
}

export interface IDesenhoProcessoCompleto extends IDesenhoProcesso {
  xml: string;
  etag: string;
}

export interface IDadosDesenho {
  titulo: string;
  codigo: string;
  descricao: string;
  processoId: string;
  elaboradoPor: string;
  aprovadoPor: string;
  observacao: string;
}

const COLUNAS_LISTA = [
  'dgt_desenhoprocessoid',
  'dgt_name',
  'dgt_codigo',
  'dgt_descricao',
  'dgt_grupo',
  'dgt_versao',
  'dgt_status',
  'dgt_elaboradopor',
  'dgt_aprovadopor',
  'dgt_observacao',
  'dgt_datapublicacao',
  'dgt_ativo',
  '_dgt_processonegocio_value',
  'modifiedon'
];

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor).trim();
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(registro, `${campo}@OData.Community.Display.V1.FormattedValue`);

const statusValido = (
  valor: string
): StatusDesenho =>
  valor === 'publicado' || valor === 'arquivado' ? valor : 'rascunho';

const novoGrupo = (): string => {
  const cripto = (window as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cripto && typeof cripto.randomUUID === 'function') {
    return cripto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, caractere => {
    const aleatorio = Math.floor(Math.random() * 16);
    const valor = caractere === 'x' ? aleatorio : (aleatorio % 4) + 8;
    return valor.toString(16);
  });
};

const paraDesenho = (
  registro: IDataverseRecord
): IDesenhoProcesso => ({
  id: guid(registro.dgt_desenhoprocessoid),
  grupo: texto(registro, 'dgt_grupo'),
  titulo: texto(registro, 'dgt_name'),
  codigo: texto(registro, 'dgt_codigo'),
  descricao: texto(registro, 'dgt_descricao'),
  processoId: guid(registro._dgt_processonegocio_value),
  processoNome: formatado(registro, '_dgt_processonegocio_value'),
  versao: Number(registro.dgt_versao || 1),
  status: statusValido(texto(registro, 'dgt_status')),
  elaboradoPor: texto(registro, 'dgt_elaboradopor'),
  aprovadoPor: texto(registro, 'dgt_aprovadopor'),
  observacao: texto(registro, 'dgt_observacao'),
  dataPublicacao: texto(registro, 'dgt_datapublicacao'),
  modificadoEm: texto(registro, 'modifiedon'),
  ativo: registro.dgt_ativo !== false
});

const verificarTamanho = (
  xml: string
): void => {
  if (xml.length > TAMANHO_MAXIMO_XML) {
    throw new Error(
      'O desenho ficou grande demais para ser salvo (limite de 1 milhão de caracteres). ' +
      'Divida-o em subprocessos ou em mais de um desenho.'
    );
  }
};

const mensagemTabelaAusente = (
  erro: unknown
): Error => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (/dgt_desenhoprocesso|EntitySet|não encontrad|not found|404/i.test(mensagem)) {
    return new Error(
      'A tabela de desenhos ainda não existe. Rode scripts/dataverse/criar-tabela-desenhos-processo.ps1.'
    );
  }
  return erro instanceof Error ? erro : new Error(mensagem);
};

export class DesenhoProcessoService {

  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // LEITURA
  // ----------------------------------------------------------

  // Todas as versões ativas (sem o XML, que é pesado).
  public async listar(): Promise<IDesenhoProcesso[]> {
    try {
      const registros =
        await this.dataverse.listarRegistros(
          TABELA,
          `$select=${COLUNAS_LISTA.join(',')}` +
          '&$filter=dgt_ativo eq true' +
          '&$orderby=dgt_codigo asc,dgt_versao desc'
        );
      return registros.map(paraDesenho);
    } catch (erro) {
      throw mensagemTabelaAusente(erro);
    }
  }

  public async obter(
    id: string
  ): Promise<IDesenhoProcessoCompleto | undefined> {

    const resultado =
      await this.dataverse.obterRegistro(
        TABELA,
        id,
        [...COLUNAS_LISTA, 'dgt_xml']
      );

    if (!resultado) {
      return undefined;
    }

    return {
      ...paraDesenho(resultado.registro),
      xml: texto(resultado.registro, 'dgt_xml'),
      etag: resultado.etag
    };
  }

  // ----------------------------------------------------------
  // GRAVAÇÃO
  // ----------------------------------------------------------

  private async camposProcesso(
    processoId: string
  ): Promise<Record<string, unknown>> {
    if (!processoId) {
      return {};
    }
    return {
      [`${NAVEGACAO_PROCESSO}@odata.bind`]:
        await this.dataverse.referenciaLookup(TABELA_PROCESSO, processoId)
    };
  }

  public async criar(
    dados: IDadosDesenho,
    xml: string
  ): Promise<string> {

    verificarTamanho(xml);

    try {
      return await this.dataverse.criarRegistro(TABELA, {
        dgt_name: dados.titulo.trim(),
        dgt_codigo: dados.codigo.trim(),
        dgt_descricao: dados.descricao.trim(),
        dgt_grupo: novoGrupo(),
        dgt_versao: 1,
        dgt_status: 'rascunho',
        dgt_xml: xml,
        dgt_elaboradopor: dados.elaboradoPor.trim(),
        dgt_aprovadopor: dados.aprovadoPor.trim(),
        dgt_observacao: dados.observacao.trim(),
        dgt_ativo: true,
        ...(await this.camposProcesso(dados.processoId))
      });
    } catch (erro) {
      throw mensagemTabelaAusente(erro);
    }
  }

  // Salva o rascunho. Com etag: recusa se outra pessoa salvou antes
  // (erro com codigo = 'CONFLITO'). Devolve o novo etag.
  public async salvarRascunho(
    atual: IDesenhoProcessoCompleto,
    dados: IDadosDesenho,
    xml: string
  ): Promise<string> {

    if (atual.status !== 'rascunho') {
      throw new Error('Somente a versão em rascunho pode ser alterada. Crie uma nova versão.');
    }

    verificarTamanho(xml);

    const novoEtag =
      await this.dataverse.atualizarRegistro(
        TABELA,
        atual.id,
        {
          dgt_name: dados.titulo.trim(),
          dgt_codigo: dados.codigo.trim(),
          dgt_descricao: dados.descricao.trim(),
          dgt_xml: xml,
          dgt_elaboradopor: dados.elaboradoPor.trim(),
          dgt_aprovadopor: dados.aprovadoPor.trim(),
          dgt_observacao: dados.observacao.trim(),
          ...(await this.camposProcesso(dados.processoId))
        },
        atual.etag || undefined
      );

    // Processo retirado: limpa o lookup.
    if (!dados.processoId && atual.processoId) {
      await this.dataverse.limparLookup(TABELA, atual.id, NAVEGACAO_PROCESSO);
    }

    return novoEtag;
  }

  // Publica a versão e arquiva a publicada anterior do mesmo desenho.
  public async publicar(
    atual: IDesenhoProcessoCompleto,
    aprovadoPor: string
  ): Promise<void> {

    if (atual.status !== 'rascunho') {
      throw new Error('Esta versão já foi publicada.');
    }

    if (!aprovadoPor.trim()) {
      throw new Error('Informe quem aprovou o desenho antes de publicar.');
    }

    await this.dataverse.atualizarRegistro(
      TABELA,
      atual.id,
      {
        dgt_status: 'publicado',
        dgt_aprovadopor: aprovadoPor.trim(),
        dgt_datapublicacao: new Date().toISOString()
      },
      atual.etag || undefined
    );

    // Primeiro publica, depois arquiva as anteriores: se a segunda
    // parte falhar, a versão nova já vale (é a de número maior).
    const versoes =
      (await this.listar()).filter(
        item => item.grupo === atual.grupo && item.id !== atual.id && item.status === 'publicado'
      );

    for (const versao of versoes) {
      await this.dataverse.atualizarRegistro(TABELA, versao.id, { dgt_status: 'arquivado' });
    }
  }

  // Nova versão em rascunho, copiada da versão informada.
  public async novaVersao(
    base: IDesenhoProcessoCompleto,
    elaboradoPor: string
  ): Promise<string> {

    const versoes =
      (await this.listar()).filter(item => item.grupo === base.grupo);

    if (versoes.some(item => item.status === 'rascunho')) {
      throw new Error('Já existe uma versão em rascunho deste desenho. Abra-a pela lista de versões.');
    }

    const maior =
      versoes.reduce((acumulado, item) => Math.max(acumulado, item.versao), base.versao);

    return this.dataverse.criarRegistro(TABELA, {
      dgt_name: base.titulo,
      dgt_codigo: base.codigo,
      dgt_descricao: base.descricao,
      dgt_grupo: base.grupo,
      dgt_versao: maior + 1,
      dgt_status: 'rascunho',
      dgt_xml: base.xml,
      dgt_elaboradopor: elaboradoPor.trim(),
      dgt_aprovadopor: '',
      dgt_observacao: '',
      dgt_ativo: true,
      ...(await this.camposProcesso(base.processoId))
    });
  }

  // "Remove" o desenho da lista sem apagar nada: desativa todas as
  // versões. Pode ser revertido no Dataverse (dgt_ativo = Sim).
  public async arquivarDesenho(
    grupo: string
  ): Promise<void> {

    const versoes =
      (await this.listar()).filter(item => item.grupo === grupo);

    for (const versao of versoes) {
      await this.dataverse.atualizarRegistro(TABELA, versao.id, { dgt_ativo: false });
    }
  }
}
