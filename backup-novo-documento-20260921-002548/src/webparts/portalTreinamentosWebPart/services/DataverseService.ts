import {
  AadHttpClient,
  AadHttpClientResponse
} from '@microsoft/sp-http';

import {
  IEnvioAvaliacao,
  IResultadoAvaliacao
} from '../models/Avaliacao';

// ============================================================
// TIPOS DATAVERSE
// ============================================================

export interface IDataverseRecord {
  [key: string]: unknown;
}

interface IDataverseResponse {
  value?: IDataverseRecord[];
}

// ============================================================
// SERVICE
// ============================================================

export class DataverseService {

  private readonly client:
    AadHttpClient;

  private readonly apiUrl:
    string;

  private readonly entitySetCache:
    Record<string, string> = {};

  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  public constructor(
    client: AadHttpClient,
    apiUrl: string
  ) {

    this.client =
      client;

    this.apiUrl =
      apiUrl.replace(
        /\/$/,
        ''
      );
  }

  // ==========================================================
  // GET LISTA
  // ==========================================================

  private async get(
    endpoint: string
  ): Promise<IDataverseRecord[]> {

    const url =
      `${this.apiUrl}/${endpoint}`;

    const response:
      AadHttpClientResponse =
      await this.client.get(
        url,
        AadHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json',

            'OData-MaxVersion':
              '4.0',

            'OData-Version':
              '4.0',

            Prefer:
              'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
          }
        }
      );

    if (!response.ok) {

      const detalhe =
        await response.text();

      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }

    const data =
      (await response.json()) as IDataverseResponse;

    return (
      data.value ||
      []
    );
  }

  // ============================================================
  // GESTÃO DE TRILHAS
  // ============================================================

  public async getTrilhasAdministrativas():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_trilhaid',
        'dgt_name',
        'dgt_descricao',
        'dgt_ativa'
      ].join(',') +
      '&$orderby=dgt_name asc'
    );
  }

  public async getTodosTrilhaTreinamentos():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhatreinamento'
      );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_trilhatreinamentoid',
        'dgt_name',
        'dgt_ordem',
        'dgt_obrigatorio',
        'dgt_regraliberacao',
        'dgt_diasparaconclusao',
        'dgt_ativo',
        '_dgt_trilha_value',
        '_dgt_treinamento_value'
      ].join(',')
    );
  }

  public async getTrilhaTreinamentosAdmin(
    trilhaId:
      string
  ): Promise<IDataverseRecord[]> {

    if (
      !trilhaId
    ) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhatreinamento'
      );

    const id =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_trilhatreinamentoid',
        'dgt_name',
        'dgt_ordem',
        'dgt_obrigatorio',
        'dgt_regraliberacao',
        'dgt_diasparaconclusao',
        'dgt_ativo',
        '_dgt_trilha_value',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_trilha_value eq ${id}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async criarTrilha(
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    return this.postObject(
      entitySet,
      dados
    );
  }

  public async atualizarTrilha(
    trilhaId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    if (
      !trilhaId
    ) {

      throw new Error(
        'ID da trilha não informado.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    const id =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  public async criarTrilhaTreinamento(
    trilhaId:
      string,
    treinamentoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    if (
      !trilhaId ||
      !treinamentoId
    ) {

      throw new Error(
        'Trilha e treinamento são obrigatórios.'
      );
    }

    const [
      relacaoSet,
      trilhaSet,
      treinamentoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_trilhatreinamento'
        ),

        this.getEntitySetName(
          'dgt_trilha'
        ),

        this.getEntitySetName(
          'dgt_treinamento'
        )
      ]);

    const trilha =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const treinamento =
      treinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.postObject(
      relacaoSet,
      {
        ...dados,

        'dgt_Trilha@odata.bind':
          `/${trilhaSet}(${trilha})`,

        'dgt_Treinamento@odata.bind':
          `/${treinamentoSet}(${treinamento})`
      }
    );
  }

  public async atualizarTrilhaTreinamento(
    relacaoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    if (
      !relacaoId
    ) {

      throw new Error(
        'ID da relação Trilha/Treinamento não informado.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhatreinamento'
      );

    const id =
      relacaoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }
  // ==========================================================
  // GET OBJETO
  // ==========================================================

  private async getObject(
    endpoint: string
  ): Promise<IDataverseRecord> {

    const url =
      `${this.apiUrl}/${endpoint}`;

    const response:
      AadHttpClientResponse =
      await this.client.get(
        url,
        AadHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json',

            'OData-MaxVersion':
              '4.0',

            'OData-Version':
              '4.0'
          }
        }
      );

    if (!response.ok) {

      const detalhe =
        await response.text();

      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }

    return (
      await response.json()
    ) as IDataverseRecord;
  }

  // ==========================================================
  // POST
  // ==========================================================

  private async postObject(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const url =
      `${this.apiUrl}/${endpoint}`;

    const response:
      AadHttpClientResponse =
      await this.client.post(
        url,
        AadHttpClient.configurations.v1,
        {
          headers: {
            Accept:
              'application/json',

            'Content-Type':
              'application/json',

            'OData-MaxVersion':
              '4.0',

            'OData-Version':
              '4.0',

            Prefer:
              'return=representation'
          },

          body:
            JSON.stringify(
              body
            )
        }
      );

    if (!response.ok) {

      const detalhe =
        await response.text();

      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }

    const textoResposta =
      await response.text();

    if (!textoResposta) {
      return {};
    }

    return JSON.parse(
      textoResposta
    ) as IDataverseRecord;
  }

  // ==========================================================
  // PATCH
  // ==========================================================

  private async patch(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<void> {

    const url =
      `${this.apiUrl}/${endpoint}`;

    const response:
      AadHttpClientResponse =
      await this.client.fetch(
        url,
        AadHttpClient.configurations.v1,
        {
          method:
            'PATCH',

          headers: {
            Accept:
              'application/json',

            'Content-Type':
              'application/json; charset=utf-8',

            'OData-MaxVersion':
              '4.0',

            'OData-Version':
              '4.0'
          },

          body:
            JSON.stringify(
              body
            )
        }
      );

    if (!response.ok) {

      const detalhe =
        await response.text();

      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }
  }

  // ==========================================================
  // ENTITY SET NAME
  // ==========================================================

  private async getEntitySetName(
    logicalName: string
  ): Promise<string> {

    const existente =
      this.entitySetCache[
      logicalName
      ];

    if (existente) {
      return existente;
    }

    const metadata =
      await this.getObject(
        `EntityDefinitions(LogicalName='${logicalName}')?$select=EntitySetName`
      );

    const entitySetName =
      String(
        metadata.EntitySetName ||
        ''
      );

    if (!entitySetName) {

      throw new Error(
        `EntitySetName não localizado para ${logicalName}.`
      );
    }

    this.entitySetCache[
      logicalName
    ] =
      entitySetName;

    return entitySetName;
  }

  // ==========================================================
  // TREINAMENTOS
  // ==========================================================

  public async getTreinamentos():
    Promise<IDataverseRecord[]> {

    return this.get(
      'dgt_treinamentos'
    );
  }

  // ==========================================================
  // USUÁRIO TREINAMENTOS
  // ==========================================================

  public async getUsuarioTreinamentos():
    Promise<IDataverseRecord[]> {

    return this.get(
      'dgt_usuariotreinamentos'
    );
  }

  // ==========================================================
  // USUÁRIOS
  // ==========================================================

  public async getUsuarios():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_usuario'
      );

    return this.get(
      `${entitySet}` +
      '?$select=' +
      [
        'dgt_usuarioid',
        'dgt_name',
        'dgt_email',
        'dgt_upn',
        'dgt_ativo'
      ].join(',') +
      '&$filter=dgt_ativo eq true' +
      '&$orderby=dgt_name asc'
    );
  }

  // ==========================================================
  // TRILHAS
  // ==========================================================

  public async getTrilhas():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    return this.get(
      `${entitySet}` +
      '?$select=' +
      [
        'dgt_trilhaid',
        'dgt_name',
        'dgt_descricao',
        'dgt_ativa'
      ].join(',') +
      '&$filter=dgt_ativa eq true' +
      '&$orderby=dgt_name asc'
    );
  }

  // ==========================================================
  // TRILHA TREINAMENTOS
  // ==========================================================

  public async getTrilhaTreinamentos(
    trilhaId?: string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhatreinamento'
      );

    if (!trilhaId) {

      return this.get(
        entitySet
      );
    }

    const idLimpo =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}` +
      `?$filter=_dgt_trilha_value eq ${idLimpo}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  // ==========================================================
  // MÓDULOS DO TREINAMENTO
  // ==========================================================

  public async getModulosTreinamento(
    treinamentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!treinamentoId) {
      return [];
    }

    const idLimpo =
      treinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const endpoint =
      'dgt_modulos' +
      '?$select=' +
      [
        'dgt_moduloid',
        'dgt_titulo',
        'dgt_descricao',
        'dgt_ordem',
        'dgt_duracaomin',
        'dgt_tipomodulo',
        'dgt_obrigatorio',
        'dgt_ativo',
        'dgt_urlconteudo',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_treinamento_value eq ${idLimpo} and dgt_ativo eq true` +
      '&$orderby=dgt_ordem asc';

    return this.get(
      endpoint
    );
  }

  // ==========================================================
  // USUÁRIO MÓDULOS
  // ==========================================================

  public async getUsuarioModulos(
    usuarioTreinamentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!usuarioTreinamentoId) {
      return [];
    }

    const idLimpo =
      usuarioTreinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const endpoint =
      'dgt_usuariomodulos' +
      '?$select=' +
      [
        'dgt_usuariomoduloid',
        'dgt_name',
        'dgt_status',
        'dgt_datainicio',
        'dgt_dataconclusao',
        'dgt_tempoutilizadoseg',
        'dgt_ativo',
        '_dgt_modulo_value',
        '_dgt_usuariotreinamento_value'
      ].join(',') +
      `&$filter=_dgt_usuariotreinamento_value eq ${idLimpo} and dgt_ativo eq true`;

    return this.get(
      endpoint
    );
  }

  // ==========================================================
  // INICIAR TREINAMENTO
  // ==========================================================

  public async iniciarUsuarioTreinamento(
    usuarioTreinamentoId: string
  ): Promise<void> {

    if (!usuarioTreinamentoId) {

      throw new Error(
        'ID da atribuição do treinamento não informado.'
      );
    }

    const idLimpo =
      usuarioTreinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `dgt_usuariotreinamentos(${idLimpo})`,
      {
        dgt_status:
          100000002
      }
    );
  }


  // ==========================================================
  // GARANTIR REGISTRO USUÁRIO MÓDULO
  // ==========================================================

  public async garantirUsuarioModulo(
    usuarioTreinamentoId:
      string,
    moduloId:
      string,
    moduloTitulo:
      string
  ): Promise<string> {

    const usuarioTreinamento =
      usuarioTreinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const modulo =
      moduloId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const existentes =
      await this.getUsuarioModulos(
        usuarioTreinamento
      );

    const existente =
      existentes.find(
        item =>
          String(
            item._dgt_modulo_value ||
            ''
          )
            .replace(
              /[{}]/g,
              ''
            )
            .trim()
            .toLowerCase() ===
          modulo.toLowerCase()
      );

    if (
      existente
    ) {

      return String(
        existente
          .dgt_usuariomoduloid ||
        ''
      )
        .replace(
          /[{}]/g,
          ''
        )
        .trim();
    }

    const [
      usuarioModuloSet,
      usuarioTreinamentoSet,
      moduloSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_usuariomodulo'
        ),

        this.getEntitySetName(
          'dgt_usuariotreinamento'
        ),

        this.getEntitySetName(
          'dgt_modulo'
        )
      ]);

    const criado =
      await this.postObject(
        usuarioModuloSet,
        {
          dgt_name:
            moduloTitulo ||
            'Módulo',

          dgt_status:
            100000000,

          dgt_ativo:
            true,

          'dgt_UsuarioTreinamento@odata.bind':
            `/${usuarioTreinamentoSet}(${usuarioTreinamento})`,

          'dgt_Modulo@odata.bind':
            `/${moduloSet}(${modulo})`
        }
      );

    const idCriado =
      String(
        criado
          .dgt_usuariomoduloid ||
        ''
      )
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    if (
      idCriado
    ) {
      return idCriado;
    }

    const recarregados =
      await this.getUsuarioModulos(
        usuarioTreinamento
      );

    const localizado =
      recarregados.find(
        item =>
          String(
            item._dgt_modulo_value ||
            ''
          )
            .replace(
              /[{}]/g,
              ''
            )
            .trim()
            .toLowerCase() ===
          modulo.toLowerCase()
      );

    const idLocalizado =
      String(
        localizado
          ?.dgt_usuariomoduloid ||
        ''
      )
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    if (
      !idLocalizado
    ) {
      throw new Error(
        'O progresso do módulo foi criado, mas o registro não pôde ser localizado.'
      );
    }

    return idLocalizado;
  }
  // ==========================================================
  // INICIAR MÓDULO
  // ==========================================================

  public async iniciarUsuarioModulo(
    usuarioModuloId: string
  ): Promise<void> {

    if (!usuarioModuloId) {

      throw new Error(
        'ID do registro Usuário Módulo não informado.'
      );
    }

    const idLimpo =
      usuarioModuloId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `dgt_usuariomodulos(${idLimpo})`,
      {
        dgt_status:
          100000001,

        dgt_datainicio:
          new Date()
            .toISOString()
      }
    );
  }

  // ==========================================================
  // CONCLUIR MÓDULO
  // ==========================================================

  public async concluirUsuarioModulo(
    usuarioModuloId: string
  ): Promise<void> {

    if (!usuarioModuloId) {

      throw new Error(
        'ID do registro Usuário Módulo não informado.'
      );
    }

    const idLimpo =
      usuarioModuloId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `dgt_usuariomodulos(${idLimpo})`,
      {
        dgt_status:
          100000002,

        dgt_dataconclusao:
          new Date()
            .toISOString()
      }
    );
  }

  // ==========================================================
  // AVALIAÇÕES
  // ==========================================================

  public async getAvaliacoesTreinamento(
    treinamentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!treinamentoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_avaliacao'
      );

    const idLimpo =
      treinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_avaliacaoid',
        'dgt_name',
        'dgt_descricao',
        'dgt_notaminima',
        'dgt_quantidadequestoes',
        'dgt_tentativaspermitidas',
        'dgt_tempolimitemin',
        'dgt_sortearquestoes',
        'dgt_embaralharquestoes',
        'dgt_embaralharalternativas',
        'dgt_mostrarresultado',
        'dgt_mostrarrespostascorretas',
        'dgt_ativa',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_treinamento_value eq ${idLimpo} and dgt_ativa eq true`
    );
  }

  // ==========================================================
  // QUESTÕES
  // ==========================================================

  public async getQuestoesAvaliacao(
    avaliacaoId: string
  ): Promise<IDataverseRecord[]> {

    if (!avaliacaoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_questao'
      );

    const idLimpo =
      avaliacaoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_questaoid',
        'dgt_name',
        'dgt_enunciado',
        'dgt_ordem',
        'dgt_peso',
        'dgt_multiplasrespostas',
        'dgt_tipoquestao',
        'dgt_ativa',
        '_dgt_avaliacao_value'
      ].join(',') +
      `&$filter=_dgt_avaliacao_value eq ${idLimpo} and dgt_ativa eq true` +
      '&$orderby=dgt_ordem asc'
    );
  }

  // ==========================================================
  // ALTERNATIVAS
  // ==========================================================

  public async getAlternativasQuestao(
    questaoId: string
  ): Promise<IDataverseRecord[]> {

    if (!questaoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_alternativa'
      );

    const idLimpo =
      questaoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    // A resposta correta nunca é enviada ao navegador.

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_alternativaid',
        'dgt_name',
        'dgt_ordem',
        'dgt_ativa',
        '_dgt_questao_value'
      ].join(',') +
      `&$filter=_dgt_questao_value eq ${idLimpo} and dgt_ativa eq true` +
      '&$orderby=dgt_ordem asc'
    );
  }

  // ==========================================================
  // TENTATIVAS DE AVALIAÇÃO
  // ==========================================================

  public async getTentativasUsuarioAvaliacao(
    usuarioTreinamentoId: string,
    avaliacaoId: string
  ): Promise<IDataverseRecord[]> {

    if (
      !usuarioTreinamentoId ||
      !avaliacaoId
    ) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_tentativa'
      );

    const usuarioId =
      usuarioTreinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const avaliacaoIdLimpo =
      avaliacaoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_tentativaid',
        'dgt_numerotentativa',
        'dgt_status',
        'dgt_aprovado',
        'dgt_nota',
        'dgt_ativa',
        '_dgt_usuariotreinamento_value',
        '_dgt_avaliacao_value'
      ].join(',') +
      `&$filter=_dgt_usuariotreinamento_value eq ${usuarioId}` +
      ` and _dgt_avaliacao_value eq ${avaliacaoIdLimpo}` +
      ' and dgt_ativa eq true' +
      '&$orderby=dgt_numerotentativa desc'
    );
  }

  // ==========================================================
  // PROCESSAR AVALIAÇÃO
  // ==========================================================

  public async processarAvaliacao(
    payload: IEnvioAvaliacao
  ): Promise<IResultadoAvaliacao> {

    const resposta =
      await this.postObject(
        'dgt_ProcessarAvaliacao',
        {
          PayloadJson:
            JSON.stringify(
              payload
            )
        }
      );

    const resultadoJson =
      String(
        resposta.ResultadoJson ||
        ''
      );

    if (!resultadoJson) {

      throw new Error(
        'A Custom API não retornou o resultado da avaliação.'
      );
    }

    return JSON.parse(
      resultadoJson
    ) as IResultadoAvaliacao;
  }

  // ==========================================================
  // DOCUMENTOS
  // ==========================================================

  public async getDocumentos():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_documento'
      );

    return this.get(
      `${entitySet}` +
      '?$select=' +
      [
        'dgt_documentoid',
        'dgt_name',
        'dgt_codigo',
        'dgt_titulo',
        'dgt_descricao',
        'dgt_tipo',
        'dgt_status',
        'dgt_revisaoatual',
        'dgt_ativo',
        '_dgt_responsavel_value'
      ].join(',') +
      '&$filter=dgt_ativo eq true' +
      '&$orderby=dgt_codigo asc'
    );
  }

  // ==========================================================
  // REVISÕES DO DOCUMENTO
  // ==========================================================

  public async getDocumentoRevisoes(
    documentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!documentoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_documentorevisao'
      );

    const idLimpo =
      documentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}` +
      '?$select=' +
      [
        'dgt_documentorevisaoid',
        'dgt_name',
        'dgt_revisao',
        'dgt_datarevisao',
        'dgt_datavigencia',
        'dgt_arquivourl',
        'dgt_biblioteca',
        'dgt_sharepointitemid',
        'dgt_motivoalteracao',
        'dgt_descricaoalteracoes',
        'dgt_requerretreinamento',
        'dgt_justificativa',
        'dgt_status',
        'dgt_ativa',
        '_dgt_documento_value',
        '_dgt_responsavel_value',
        '_dgt_aprovadopor_value'
      ].join(',') +
      `&$filter=_dgt_documento_value eq ${idLimpo}` +
      '&$orderby=dgt_datarevisao desc'
    );
  }

  // ==========================================================
  // TREINAMENTO DOCUMENTOS
  // ==========================================================

  public async getTreinamentoDocumentos(
    treinamentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!treinamentoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_treinamentodocumento'
      );

    const idLimpo =
      treinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}` +
      '?$select=' +
      [
        'dgt_treinamentodocumentoid',
        'dgt_name',
        'dgt_obrigatorio',
        'dgt_observacao',
        'dgt_ordem',
        'dgt_ativa',
        '_dgt_documento_value',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_treinamento_value eq ${idLimpo}` +
      ' and dgt_ativa eq true' +
      '&$orderby=dgt_ordem asc'
    );
  }

  // ==========================================================
  // CRIAR TREINAMENTO
  // ==========================================================

  public async criarTreinamento(
    dados: Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_treinamento'
      );

    return this.postObject(
      entitySet,
      dados
    );
  }

  // ==========================================================
  // ATUALIZAR TREINAMENTO
  // ==========================================================

  public async atualizarTreinamento(
    treinamentoId: string,
    dados: Record<string, unknown>
  ): Promise<void> {

    if (!treinamentoId) {

      throw new Error(
        'ID do treinamento não informado.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_treinamento'
      );

    const idLimpo =
      treinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${idLimpo})`,
      dados
    );
  }
  // ============================================================
  // GESTÃO DE MÓDULOS
  // ============================================================

  public async getModulosTreinamentoAdmin(
    treinamentoId:
      string
  ): Promise<IDataverseRecord[]> {

    if (!treinamentoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_modulo'
      );

    const id =
      treinamentoId
        .replace(/[{}]/g, '')
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_moduloid',
        'dgt_titulo',
        'dgt_descricao',
        'dgt_ordem',
        'dgt_duracaomin',
        'dgt_tipomodulo',
        'dgt_obrigatorio',
        'dgt_ativo',
        'dgt_urlconteudo',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_treinamento_value eq ${id}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async criarModulo(
    treinamentoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    if (!treinamentoId) {
      throw new Error(
        'Treinamento não informado.'
      );
    }

    const [
      moduloSet,
      treinamentoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_modulo'
        ),

        this.getEntitySetName(
          'dgt_treinamento'
        )
      ]);

    const treinamento =
      treinamentoId
        .replace(/[{}]/g, '')
        .trim();

    return this.postObject(
      moduloSet,
      {
        ...dados,

        'dgt_Treinamento@odata.bind':
          `/${treinamentoSet}(${treinamento})`
      }
    );
  }

  public async atualizarModulo(
    moduloId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    if (!moduloId) {
      throw new Error(
        'Módulo não informado.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_modulo'
      );

    const id =
      moduloId
        .replace(/[{}]/g, '')
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  // ============================================================
  // GESTÃO DE AVALIAÇÕES
  // ============================================================

  public async getAvaliacoesTreinamentoAdmin(
    treinamentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!treinamentoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_avaliacao'
      );

    const id =
      treinamentoId
        .replace(/[{}]/g, '')
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_avaliacaoid',
        'dgt_name',
        'dgt_descricao',
        'dgt_notaminima',
        'dgt_quantidadequestoes',
        'dgt_tentativaspermitidas',
        'dgt_tempolimitemin',
        'dgt_sortearquestoes',
        'dgt_embaralharquestoes',
        'dgt_embaralharalternativas',
        'dgt_mostrarresultado',
        'dgt_mostrarrespostascorretas',
        'dgt_ativa',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_treinamento_value eq ${id}`
    );
  }

  public async criarAvaliacao(
    treinamentoId: string,
    dados: Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      avaliacaoSet,
      treinamentoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_avaliacao'
        ),
        this.getEntitySetName(
          'dgt_treinamento'
        )
      ]);

    const id =
      treinamentoId
        .replace(/[{}]/g, '')
        .trim();

    return this.postObject(
      avaliacaoSet,
      {
        ...dados,

        'dgt_Treinamento@odata.bind':
          `/${treinamentoSet}(${id})`
      }
    );
  }

  public async atualizarAvaliacao(
    avaliacaoId: string,
    dados: Record<string, unknown>
  ): Promise<void> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_avaliacao'
      );

    const id =
      avaliacaoId
        .replace(/[{}]/g, '')
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  // ============================================================
  // GESTÃO DE QUESTÕES
  // ============================================================

  public async getQuestoesAvaliacaoAdmin(
    avaliacaoId: string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_questao'
      );

    const id =
      avaliacaoId
        .replace(/[{}]/g, '')
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_questaoid',
        'dgt_name',
        'dgt_enunciado',
        'dgt_ordem',
        'dgt_peso',
        'dgt_multiplasrespostas',
        'dgt_ativa',
        '_dgt_avaliacao_value'
      ].join(',') +
      `&$filter=_dgt_avaliacao_value eq ${id}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async criarQuestao(
    avaliacaoId: string,
    dados: Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      questaoSet,
      avaliacaoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_questao'
        ),
        this.getEntitySetName(
          'dgt_avaliacao'
        )
      ]);

    const id =
      avaliacaoId
        .replace(/[{}]/g, '')
        .trim();

    return this.postObject(
      questaoSet,
      {
        ...dados,

        'dgt_Avaliacao@odata.bind':
          `/${avaliacaoSet}(${id})`
      }
    );
  }

  public async atualizarQuestao(
    questaoId: string,
    dados: Record<string, unknown>
  ): Promise<void> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_questao'
      );

    const id =
      questaoId
        .replace(/[{}]/g, '')
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  // ============================================================
  // GESTÃO DE ALTERNATIVAS
  // ============================================================

  public async getAlternativasQuestaoAdmin(
    questaoId: string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_alternativa'
      );

    const id =
      questaoId
        .replace(/[{}]/g, '')
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_alternativaid',
        'dgt_name',
        'dgt_ordem',
        'dgt_correta',
        'dgt_ativa',
        '_dgt_questao_value'
      ].join(',') +
      `&$filter=_dgt_questao_value eq ${id}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async criarAlternativa(
    questaoId: string,
    dados: Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      alternativaSet,
      questaoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_alternativa'
        ),
        this.getEntitySetName(
          'dgt_questao'
        )
      ]);

    const id =
      questaoId
        .replace(/[{}]/g, '')
        .trim();

    return this.postObject(
      alternativaSet,
      {
        ...dados,

        'dgt_Questao@odata.bind':
          `/${questaoSet}(${id})`
      }
    );
  }

  public async atualizarAlternativa(
    alternativaId: string,
    dados: Record<string, unknown>
  ): Promise<void> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_alternativa'
      );

    const id =
      alternativaId
        .replace(/[{}]/g, '')
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  // ============================================================
  // ATRIBUIÇÃO CENTRALIZADA
  // ============================================================

  public async processarAtribuicao(
    payload:
      Record<string, unknown>
  ): Promise<{
    sucesso: boolean;
    mensagem: string;
    usuarioTreinamentoId?: string;
    reutilizado?: boolean;
    criado?: boolean;
    liberado?: boolean;
  }> {

    const resposta =
      await this.postObject(
        'dgt_ProcessarAtribuicao',
        {
          PayloadJson:
            JSON.stringify(
              payload
            )
        }
      );

    const resultadoJson =
      String(
        resposta.ResultadoJson ||
        ''
      );

    if (!resultadoJson) {
      throw new Error(
        'A API de atribuição não retornou ResultadoJson.'
      );
    }

    return JSON.parse(
      resultadoJson
    ) as {
      sucesso: boolean;
      mensagem: string;
      usuarioTreinamentoId?: string;
      reutilizado?: boolean;
      criado?: boolean;
      liberado?: boolean;
    };
  }

  // ============================================================
  // BLOCO B - REVISÃO DOCUMENTAL
  // Adicionar dentro da classe DataverseService
  // ============================================================

  public async processarRevisaoDocumento(
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {

    const resposta =
      await this.postObject(
        'dgt_ProcessarRevisaoDocumento',
        {
          PayloadJson:
            JSON.stringify(
              payload
            )
        }
      );

    const resultadoJson =
      String(
        resposta.ResultadoJson ||
        ''
      );

    if (!resultadoJson) {
      throw new Error(
        'A API de revisão documental não retornou ResultadoJson.'
      );
    }

    return JSON.parse(
      resultadoJson
    ) as Record<string, unknown>;
  }

  // ============================================================
  // AUTORIZAÇÃO - SUBSTITUIR o método getUsuarioAcessoPorEmail
  // ============================================================

  public async getUsuarioAcessoPorEmail(
    email: string
  ): Promise<IDataverseRecord[]> {

    if (!email.trim()) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_usuario'
      );

    const emailSeguro =
      email
        .trim()
        .replace(
          /'/g,
          "''"
        );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_usuarioid',
        'dgt_name',
        'dgt_email',
        'dgt_ativo',
        'dgt_perfilacesso'
      ].join(',') +
      `&$filter=dgt_email eq '${emailSeguro}'` +
      '&$top=1'
    );
  }
  // ============================================================
  // GESTÃO DOCUMENTAL ADMINISTRATIVA
  // ADICIONAR UMA ÚNICA VEZ DENTRO DA CLASSE DataverseService
  // ============================================================

  public async getDocumentosAdmin():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_documento'
      );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_documentoid',
        'dgt_name',
        'dgt_codigo',
        'dgt_titulo',
        'dgt_descricao',
        'dgt_tipo',
        'dgt_revisaoatual',
        'dgt_status',
        'dgt_ativo'
      ].join(',') +
      '&$orderby=dgt_codigo asc'
    );
  }

  public async getRevisoesDocumentoAdmin(
    documentoId: string
  ): Promise<IDataverseRecord[]> {

    if (!documentoId) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_documentorevisao'
      );

    const id =
      documentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_documentorevisaoid',
        'dgt_name',
        'dgt_revisao',
        'dgt_datarevisao',
        'dgt_datavigencia',
        'dgt_motivoalteracao',
        'dgt_descricaoalteracoes',
        'dgt_requerretreinamento',
        'dgt_justificativa',
        'dgt_status',
        'dgt_ativa',
        '_dgt_documento_value'
      ].join(',') +
      `&$filter=_dgt_documento_value eq ${id}` +
      '&$orderby=createdon desc'
    );
  }

  public async criarDocumentoRevisao(
    documentoId: string,
    dados: Record<string, unknown>
  ): Promise<IDataverseRecord> {

    if (!documentoId) {
      throw new Error(
        'Documento não informado.'
      );
    }

    const revisoesSet =
      await this.getEntitySetName(
        'dgt_documentorevisao'
      );

    const documentosSet =
      await this.getEntitySetName(
        'dgt_documento'
      );

    const id =
      documentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.postObject(
      revisoesSet,
      {
        ...dados,
        'dgt_Documento@odata.bind':
          `/${documentosSet}(${id})`
      }
    );
  }
  public async processarReciclagem(
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {

    const resposta =
      await this.postObject(
        'dgt_ProcessarReciclagem',
        {
          PayloadJson:
            JSON.stringify(
              payload
            )
        }
      );

    const resultadoJson =
      String(
        resposta.ResultadoJson ||
        ''
      );

    if (!resultadoJson) {
      throw new Error(
        'A API de reciclagem não retornou ResultadoJson.'
      );
    }

    return JSON.parse(
      resultadoJson
    ) as Record<string, unknown>;
  }


  // ============================================================
  // GESTÃO DE ÁREAS
  // ============================================================

  public async getAreasAdmin():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_area'
      );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_areaid',
        'dgt_name',
        'dgt_sigla',
        'dgt_ativo'
      ].join(',') +
      '&$orderby=dgt_name asc'
    );
  }

  public async criarArea(
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_area'
      );

    return this.postObject(
      entitySet,
      dados
    );
  }

  public async atualizarArea(
    areaId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    if (!areaId) {
      throw new Error(
        'Área não informada.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_area'
      );

    const id =
      areaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  // ============================================================
  // USUÁRIOS POR ÁREA
  // ============================================================

  public async getUsuariosAreasAdmin():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_usuarioarea'
      );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_usuarioareaid',
        'dgt_name',
        'dgt_perfilarea',
        'dgt_ativo',
        '_dgt_usuario_value',
        '_dgt_area_value'
      ].join(',') +
      '&$orderby=createdon desc'
    );
  }

  public async criarUsuarioArea(
    usuarioId:
      string,
    areaId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    if (!usuarioId) {
      throw new Error(
        'Usuário não informado.'
      );
    }

    if (!areaId) {
      throw new Error(
        'Área não informada.'
      );
    }

    const [
      usuarioAreaSet,
      usuarioSet,
      areaSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_usuarioarea'
        ),

        this.getEntitySetName(
          'dgt_usuario'
        ),

        this.getEntitySetName(
          'dgt_area'
        )
      ]);

    const usuario =
      usuarioId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const area =
      areaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.postObject(
      usuarioAreaSet,
      {
        ...dados,

        'dgt_Usuario@odata.bind':
          `/${usuarioSet}(${usuario})`,

        'dgt_Area@odata.bind':
          `/${areaSet}(${area})`
      }
    );
  }

  public async atualizarUsuarioArea(
    vinculoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    if (!vinculoId) {
      throw new Error(
        'Vínculo usuário/área não informado.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_usuarioarea'
      );

    const id =
      vinculoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }


  // ============================================================
  // CONTEUDOS MODULARES
  // ============================================================

  public async getConteudosModuloAdmin(
    moduloId:
      string
  ): Promise<IDataverseRecord[]> {

    if (
      !moduloId
    ) {
      return [];
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_moduloconteudo'
      );

    const id =
      moduloId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_moduloconteudoid',
        'dgt_name',
        'dgt_tipoconteudo',
        'dgt_titulo',
        'dgt_conteudo',
        'dgt_url',
        'dgt_ordem',
        'dgt_obrigatorio',
        'dgt_ativo',
        '_dgt_modulo_value'
      ].join(',') +
      `&$filter=_dgt_modulo_value eq ${id}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async criarConteudoModulo(
    moduloId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    if (
      !moduloId
    ) {
      throw new Error(
        'Modulo nao informado.'
      );
    }

    const [
      conteudoSet,
      moduloSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_moduloconteudo'
        ),

        this.getEntitySetName(
          'dgt_modulo'
        )
      ]);

    const id =
      moduloId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.postObject(
      conteudoSet,
      {
        ...dados,

        'dgt_Modulo@odata.bind':
          `/${moduloSet}(${id})`
      }
    );
  }

  public async atualizarConteudoModulo(
    conteudoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    if (
      !conteudoId
    ) {
      throw new Error(
        'Conteudo nao informado.'
      );
    }

    const entitySet =
      await this.getEntitySetName(
        'dgt_moduloconteudo'
      );

    const id =
      conteudoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }


  // ============================================================
  // PERGUNTAS RAPIDAS DO MODULO
  // ============================================================

  public async criarPerguntaRapidaModulo(
    conteudoModuloId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      perguntaSet,
      conteudoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_modulopergunta'
        ),

        this.getEntitySetName(
          'dgt_moduloconteudo'
        )
      ]);

    const id =
      conteudoModuloId
        .replace(
          /[{}]/g,
          ''
        );

    return this.postObject(
      perguntaSet,
      {
        ...dados,

        'dgt_ModuloConteudo@odata.bind':
          `/${conteudoSet}(${id})`
      }
    );
  }

  public async criarAlternativaPerguntaRapidaModulo(
    perguntaId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      alternativaSet,
      perguntaSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_moduloperguntaalternativa'
        ),

        this.getEntitySetName(
          'dgt_modulopergunta'
        )
      ]);

    const id =
      perguntaId
        .replace(
          /[{}]/g,
          ''
        );

    return this.postObject(
      alternativaSet,
      {
        ...dados,

        'dgt_ModuloPergunta@odata.bind':
          `/${perguntaSet}(${id})`
      }
    );
  }

  public async getPerguntaRapidaModulo(
    conteudoModuloId:
      string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_modulopergunta'
      );

    const id =
      conteudoModuloId
        .replace(
          /[{}]/g,
          ''
        );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_moduloperguntaid',
        'dgt_name',
        'dgt_enunciado',
        'dgt_tipopergunta',
        'dgt_exigiracerto',
        'dgt_mostrarfeedback',
        'dgt_feedbackacerto',
        'dgt_feedbackerro',
        'dgt_ativo',
        '_dgt_moduloconteudo_value'
      ].join(',') +
      `&$filter=_dgt_moduloconteudo_value eq ${id} and dgt_ativo eq true`
    );
  }

  public async getAlternativasPerguntaRapidaModulo(
    perguntaId:
      string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_moduloperguntaalternativa'
      );

    const id =
      perguntaId
        .replace(
          /[{}]/g,
          ''
        );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_moduloperguntaalternativaid',
        'dgt_texto',
        'dgt_correta',
        'dgt_ordem',
        'dgt_ativo',
        '_dgt_modulopergunta_value'
      ].join(',') +
      `&$filter=_dgt_modulopergunta_value eq ${id} and dgt_ativo eq true` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async registrarRespostaPerguntaRapida(
    perguntaId:
      string,
    usuarioTreinamentoId:
      string,
    respostaJson:
      string,
    correta:
      boolean,
    tentativa:
      number
  ): Promise<IDataverseRecord> {

    const [
      respostaSet,
      perguntaSet,
      usuarioTreinamentoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_moduloperguntaresposta'
        ),

        this.getEntitySetName(
          'dgt_modulopergunta'
        ),

        this.getEntitySetName(
          'dgt_usuariotreinamento'
        )
      ]);

    return this.postObject(
      respostaSet,
      {
        dgt_name:
          `Resposta ${new Date().toISOString()}`,

        dgt_respostajson:
          respostaJson,

        dgt_correta:
          correta,

        dgt_tentativa:
          tentativa,

        dgt_dataresposta:
          new Date()
            .toISOString(),

        'dgt_ModuloPergunta@odata.bind':
          `/${perguntaSet}(${perguntaId.replace(/[{}]/g, '')})`,

        'dgt_UsuarioTreinamento@odata.bind':
          `/${usuarioTreinamentoSet}(${usuarioTreinamentoId.replace(/[{}]/g, '')})`
      }
    );
  }


  // ============================================================
  // FLUXO DE TRILHAS
  // ============================================================

  public async getTrilhasFluxo():
    Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_trilhaid',
        'dgt_name',
        'dgt_codigo',
        'dgt_descricao',
        'dgt_observacoes',
        'dgt_ativa',
        'dgt_todasareas'
      ].join(',') +
      '&$orderby=dgt_name asc'
    );
  }

  public async criarTrilhaFluxo(
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    return this.postObject(
      entitySet,
      dados
    );
  }

  public async atualizarTrilhaFluxo(
    trilhaId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilha'
      );

    const id =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  public async getTrilhaTreinamentosFluxo(
    trilhaId:
      string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhatreinamento'
      );

    const id =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_trilhatreinamentoid',
        'dgt_name',
        'dgt_ordem',
        'dgt_obrigatorio',
        'dgt_diasparaconclusao',
        'dgt_ativo',
        '_dgt_trilha_value',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_trilha_value eq ${id}` +
      '&$orderby=dgt_ordem asc'
    );
  }

  public async criarTrilhaTreinamentoFluxo(
    trilhaId:
      string,
    treinamentoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      relacaoSet,
      trilhaSet,
      treinamentoSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_trilhatreinamento'
        ),

        this.getEntitySetName(
          'dgt_trilha'
        ),

        this.getEntitySetName(
          'dgt_treinamento'
        )
      ]);

    const trilha =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const treinamento =
      treinamentoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.postObject(
      relacaoSet,
      {
        ...dados,

        'dgt_Trilha@odata.bind':
          `/${trilhaSet}(${trilha})`,

        'dgt_Treinamento@odata.bind':
          `/${treinamentoSet}(${treinamento})`
      }
    );
  }

  public async atualizarTrilhaTreinamentoFluxo(
    relacaoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhatreinamento'
      );

    const id =
      relacaoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

  public async getTrilhaAreasFluxo(
    trilhaId:
      string
  ): Promise<IDataverseRecord[]> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhaarea'
      );

    const id =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.get(
      `${entitySet}?$select=` +
      [
        'dgt_trilhaareaid',
        'dgt_name',
        'dgt_ativo',
        '_dgt_trilha_value',
        '_dgt_area_value'
      ].join(',') +
      `&$filter=_dgt_trilha_value eq ${id}`
    );
  }

  public async criarTrilhaAreaFluxo(
    trilhaId:
      string,
    areaId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<IDataverseRecord> {

    const [
      relacaoSet,
      trilhaSet,
      areaSet
    ] =
      await Promise.all([
        this.getEntitySetName(
          'dgt_trilhaarea'
        ),

        this.getEntitySetName(
          'dgt_trilha'
        ),

        this.getEntitySetName(
          'dgt_area'
        )
      ]);

    const trilha =
      trilhaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    const area =
      areaId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    return this.postObject(
      relacaoSet,
      {
        ...dados,

        'dgt_Trilha@odata.bind':
          `/${trilhaSet}(${trilha})`,

        'dgt_Area@odata.bind':
          `/${areaSet}(${area})`
      }
    );
  }

  public async atualizarTrilhaAreaFluxo(
    relacaoId:
      string,
    dados:
      Record<string, unknown>
  ): Promise<void> {

    const entitySet =
      await this.getEntitySetName(
        'dgt_trilhaarea'
      );

    const id =
      relacaoId
        .replace(
          /[{}]/g,
          ''
        )
        .trim();

    await this.patch(
      `${entitySet}(${id})`,
      dados
    );
  }

}






