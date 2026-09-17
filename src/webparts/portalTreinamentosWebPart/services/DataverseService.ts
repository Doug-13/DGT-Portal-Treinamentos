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
        'dgt_diasparaconclusao',
        'dgt_ativo'
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
        'dgt_ativo'
      ].join(',') +
      '&$filter=dgt_ativo eq true' +
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
        'dgt_ativo',
        '_dgt_documento_value',
        '_dgt_treinamento_value'
      ].join(',') +
      `&$filter=_dgt_treinamento_value eq ${idLimpo}` +
      ' and dgt_ativo eq true' +
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
}