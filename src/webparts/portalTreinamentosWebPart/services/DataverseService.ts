import { IEnvioAvaliacao, IResultadoAvaliacao } from '../models/Avaliacao';
import {
  AadHttpClient,
  AadHttpClientResponse
} from '@microsoft/sp-http';

export interface IDataverseRecord {
  [key: string]: unknown;
}

interface IDataverseResponse {
  value?: IDataverseRecord[];
}

export class DataverseService {
  private readonly client: AadHttpClient;
  private readonly apiUrl: string;

  public constructor(client: AadHttpClient, apiUrl: string) {
    this.client = client;
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }

  private async get(endpoint: string): Promise<IDataverseRecord[]> {
    const url = `${this.apiUrl}/${endpoint}`;

    const response: AadHttpClientResponse = await this.client.get(
      url,
      AadHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          Prefer:
            'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
        }
      }
    );

    if (!response.ok) {
      const detalhe = await response.text();
      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }

    const data = await response.json() as IDataverseResponse;
    return data.value || [];
  }

  private async getObject(
    endpoint: string
  ): Promise<IDataverseRecord> {
    const url = `${this.apiUrl}/${endpoint}`;

    const response: AadHttpClientResponse = await this.client.get(
      url,
      AadHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    if (!response.ok) {
      const detalhe = await response.text();
      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }

    return await response.json() as IDataverseRecord;
  }

  private async postObject(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<IDataverseRecord> {
    const url = `${this.apiUrl}/${endpoint}`;

    const response: AadHttpClientResponse = await this.client.post(
      url,
      AadHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const detalhe = await response.text();
      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }

    const textoResposta = await response.text();

    if (!textoResposta) {
      return {};
    }

    return JSON.parse(textoResposta) as IDataverseRecord;
  }

  private async patch(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<void> {
    const url = `${this.apiUrl}/${endpoint}`;

    const response: AadHttpClientResponse = await this.client.fetch(
      url,
      AadHttpClient.configurations.v1,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const detalhe = await response.text();
      throw new Error(
        `Dataverse retornou ${response.status} ${response.statusText}. ${detalhe}`
      );
    }
  }

  public async getTreinamentos(): Promise<IDataverseRecord[]> {
    return this.get('dgt_treinamentos');
  }

  public async getUsuarioTreinamentos(): Promise<IDataverseRecord[]> {
    return this.get('dgt_usuariotreinamentos');
  }

  public async getModulosTreinamento(
    treinamentoId: string
  ): Promise<IDataverseRecord[]> {
    if (!treinamentoId) {
      return [];
    }

    const idLimpo = treinamentoId.replace(/[{}]/g, '').trim();

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

    return this.get(endpoint);
  }

  public async getUsuarioModulos(
    usuarioTreinamentoId: string
  ): Promise<IDataverseRecord[]> {
    if (!usuarioTreinamentoId) {
      return [];
    }

    const idLimpo = usuarioTreinamentoId.replace(/[{}]/g, '').trim();

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

    return this.get(endpoint);
  }

  public async iniciarUsuarioTreinamento(
    usuarioTreinamentoId: string
  ): Promise<void> {
    if (!usuarioTreinamentoId) {
      throw new Error('ID da atribuição do treinamento não informado.');
    }

    const idLimpo = usuarioTreinamentoId.replace(/[{}]/g, '').trim();

    await this.patch(
      `dgt_usuariotreinamentos(${idLimpo})`,
      { dgt_status: 100000002 }
    );
  }

  public async iniciarUsuarioModulo(
    usuarioModuloId: string
  ): Promise<void> {
    if (!usuarioModuloId) {
      throw new Error('ID do registro Usuário Módulo não informado.');
    }

    const idLimpo = usuarioModuloId.replace(/[{}]/g, '').trim();

    await this.patch(
      `dgt_usuariomodulos(${idLimpo})`,
      {
        dgt_status: 100000001,
        dgt_datainicio: new Date().toISOString()
      }
    );
  }

  public async concluirUsuarioModulo(
    usuarioModuloId: string
  ): Promise<void> {
    if (!usuarioModuloId) {
      throw new Error('ID do registro Usuário Módulo não informado.');
    }

    const idLimpo = usuarioModuloId.replace(/[{}]/g, '').trim();

    await this.patch(
      `dgt_usuariomodulos(${idLimpo})`,
      {
        dgt_status: 100000002,
        dgt_dataconclusao: new Date().toISOString()
      }
    );
  }

  private readonly entitySetCache: Record<string, string> = {};

  private async getEntitySetName(logicalName: string): Promise<string> {
    const existente = this.entitySetCache[logicalName];

    if (existente) {
      return existente;
    }

    const metadata = await this.getObject(
      `EntityDefinitions(LogicalName='${logicalName}')?$select=EntitySetName`
    );

    const entitySetName = String(metadata.EntitySetName || '');

    if (!entitySetName) {
      throw new Error(`EntitySetName não localizado para ${logicalName}.`);
    }

    this.entitySetCache[logicalName] = entitySetName;
    return entitySetName;
  }

  public async getAvaliacoesTreinamento(
    treinamentoId: string
  ): Promise<IDataverseRecord[]> {
    if (!treinamentoId) {
      return [];
    }

    const entitySet = await this.getEntitySetName('dgt_avaliacao');
    const idLimpo = treinamentoId.replace(/[{}]/g, '').trim();

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

  public async getQuestoesAvaliacao(
    avaliacaoId: string
  ): Promise<IDataverseRecord[]> {
    if (!avaliacaoId) {
      return [];
    }

    const entitySet = await this.getEntitySetName('dgt_questao');
    const idLimpo = avaliacaoId.replace(/[{}]/g, '').trim();

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

  public async getAlternativasQuestao(
    questaoId: string
  ): Promise<IDataverseRecord[]> {
    if (!questaoId) {
      return [];
    }

    const entitySet = await this.getEntitySetName('dgt_alternativa');
    const idLimpo = questaoId.replace(/[{}]/g, '').trim();

    // Importante: dgt_correta NÃO é enviado ao navegador.
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

  public async getTentativasUsuarioAvaliacao(
    usuarioTreinamentoId: string,
    avaliacaoId: string
  ): Promise<IDataverseRecord[]> {
    if (!usuarioTreinamentoId || !avaliacaoId) {
      return [];
    }

    const entitySet = await this.getEntitySetName('dgt_tentativa');
    const usuarioId = usuarioTreinamentoId.replace(/[{}]/g, '').trim();
    const avaliacaoIdLimpo = avaliacaoId.replace(/[{}]/g, '').trim();

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

  public async processarAvaliacao(
    payload: IEnvioAvaliacao
  ): Promise<IResultadoAvaliacao> {
    const resposta = await this.postObject(
      'dgt_ProcessarAvaliacao',
      {
        PayloadJson: JSON.stringify(payload)
      }
    );

    const resultadoJson = String(resposta.ResultadoJson || '');

    if (!resultadoJson) {
      throw new Error(
        'A Custom API não retornou o resultado da avaliação.'
      );
    }

    return JSON.parse(resultadoJson) as IResultadoAvaliacao;
  }

}
