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
}
