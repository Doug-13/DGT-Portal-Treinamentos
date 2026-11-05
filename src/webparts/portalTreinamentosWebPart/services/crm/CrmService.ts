import {
  AadHttpClient,
  AadHttpClientResponse
} from '@microsoft/sp-http';

import {
  CRM_TAMANHO_PAGINA,
  CRM_VERSAO_API,
  IAmbienteCrm,
  IColunaCrm,
  ITabelaCrm
} from '../../constants/crm';

import {
  obterClienteCrm
} from './CrmConexao';

// ============================================================
// CRM — SERVIÇO DE LEITURA (Dataverse Web API do ambiente do CRM)
//
// Somente leitura nesta primeira fase. Toda consulta usa $select com
// colunas conferidas nos metadados, então colunas que não existem no
// ambiente são ignoradas em vez de derrubar a tela.
//
// A segurança é a do próprio Dataverse do CRM: cada pessoa só recebe
// os registros que a Security Role dela no ambiente "DGT - CRM - POC"
// permite ver. O portal não amplia nem contorna esse acesso.
// ============================================================

export const FORMATADO = '@OData.Community.Display.V1.FormattedValue';

export interface IRegistroCrm {
  [campo: string]: unknown;
}

export interface IMetadadosTabelaCrm {
  logicalName: string;
  entitySetName: string;
  idPrimario: string;
  nomePrimario: string;
  rotulo: string;
  atributos: string[];
}

export interface IPaginaCrm {
  registros: IRegistroCrm[];
  total?: number;
  totalLimitado?: boolean;
  proximaPagina?: string;
}

export interface IEtapaPipeline {
  etapa: string;
  quantidade: number;
  valor: number;
}

export interface ITabelaPersonalizadaCrm {
  logicalName: string;
  entitySetName: string;
  rotulo: string;
  idPrimario: string;
  nomePrimario: string;
}

export interface IAmbienteDescoberto {
  nome: string;
  url: string;
  regiao: string;
}

interface IRespostaLista {
  value?: IRegistroCrm[];
  '@odata.count'?: number;
  '@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded'?: boolean;
  '@odata.nextLink'?: string;
}

interface IRotulo {
  UserLocalizedLabel?: { Label?: string };
}

interface IMetadadosApi {
  LogicalName: string;
  EntitySetName: string;
  PrimaryIdAttribute: string;
  PrimaryNameAttribute: string;
  DisplayCollectionName?: IRotulo;
  Attributes?: Array<{ LogicalName: string }>;
}

const rotuloDe = (rotulo: IRotulo | undefined, padrao: string): string =>
  (rotulo && rotulo.UserLocalizedLabel && rotulo.UserLocalizedLabel.Label) || padrao;

const escaparOData = (texto: string): string =>
  texto.replace(/'/g, "''");

export const campoConsulta = (coluna: IColunaCrm): string =>
  coluna.tipo === 'lookup' ? `_${coluna.nome}_value` : coluna.nome;

export class CrmService {

  private readonly ambiente: IAmbienteCrm;

  private readonly baseUrl: string;

  private readonly apiUrl: string;

  private readonly cacheMetadados: Record<string, Promise<IMetadadosTabelaCrm | undefined>> = {};

  public constructor(ambiente: IAmbienteCrm) {
    this.ambiente = ambiente;
    this.baseUrl = (ambiente.url || '').replace(/\/+$/, '');
    this.apiUrl = `${this.baseUrl}/api/data/${CRM_VERSAO_API}`;
  }

  public get configurado(): boolean {
    return /^https:\/\/[^/]+\.dynamics\.com$/i.test(this.baseUrl);
  }

  // ==========================================================
  // HTTP
  // ==========================================================

  private async requisitar(
    endpointOuUrl: string,
    tamanhoPagina?: number
  ): Promise<unknown> {

    if (!this.configurado) {
      throw new Error('A URL do ambiente do CRM não está configurada (constants/crm.ts).');
    }

    const cliente: AadHttpClient = await obterClienteCrm(this.baseUrl);

    const url = /^https:/i.test(endpointOuUrl)
      ? endpointOuUrl
      : `${this.apiUrl}/${endpointOuUrl}`;

    const prefer = ['odata.include-annotations="*"'];
    if (tamanhoPagina) {
      prefer.push(`odata.maxpagesize=${tamanhoPagina}`);
    }

    const resposta: AadHttpClientResponse = await cliente.get(
      url,
      AadHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          Prefer: prefer.join(',')
        }
      }
    );

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      const erro = new Error(
        `CRM retornou ${resposta.status} ${resposta.statusText}. ${detalhe}`
      ) as Error & { status?: number };
      erro.status = resposta.status;
      throw erro;
    }

    return resposta.json();
  }

  // ==========================================================
  // TESTE DE CONEXÃO (WhoAmI)
  // ==========================================================

  public async testarConexao(): Promise<string> {
    const dados = await this.requisitar('WhoAmI()') as { UserId?: string };
    return dados.UserId || '';
  }

  // ==========================================================
  // METADADOS
  // ==========================================================

  public obterMetadados(
    logicalName: string
  ): Promise<IMetadadosTabelaCrm | undefined> {

    if (!this.cacheMetadados[logicalName]) {
      this.cacheMetadados[logicalName] = this.requisitar(
        `EntityDefinitions(LogicalName='${escaparOData(logicalName)}')` +
        '?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,DisplayCollectionName' +
        '&$expand=Attributes($select=LogicalName)'
      )
        .then(dados => {
          const meta = dados as IMetadadosApi;
          return {
            logicalName: meta.LogicalName,
            entitySetName: meta.EntitySetName,
            idPrimario: meta.PrimaryIdAttribute,
            nomePrimario: meta.PrimaryNameAttribute,
            rotulo: rotuloDe(meta.DisplayCollectionName, meta.LogicalName),
            atributos: (meta.Attributes || []).map(a => a.LogicalName)
          } as IMetadadosTabelaCrm;
        })
        .catch((erro: Error & { status?: number }) => {
          // 404 = a tabela não existe neste ambiente (ex.: sem o app de Vendas).
          if (erro.status === 404) {
            return undefined;
          }
          delete this.cacheMetadados[logicalName];
          throw erro;
        });
    }

    return this.cacheMetadados[logicalName];
  }

  // Colunas da configuração que existem de fato no ambiente.
  public colunasExistentes(
    tabela: ITabelaCrm,
    meta: IMetadadosTabelaCrm
  ): IColunaCrm[] {
    return tabela.colunas.filter(c => meta.atributos.indexOf(c.nome) >= 0);
  }

  // ==========================================================
  // LISTAGEM
  // ==========================================================

  public async listar(
    tabela: ITabelaCrm,
    opcoes: { busca?: string; somenteAtivos?: boolean }
  ): Promise<IPaginaCrm & { meta?: IMetadadosTabelaCrm; colunas: IColunaCrm[] }> {

    const meta = await this.obterMetadados(tabela.logicalName);

    if (!meta) {
      return { registros: [], colunas: [] };
    }

    const colunas = this.colunasExistentes(tabela, meta);

    const select = [meta.idPrimario]
      .concat(colunas.map(campoConsulta))
      .filter((v, i, lista) => lista.indexOf(v) === i);

    const filtros: string[] = [];

    if (opcoes.somenteAtivos && tabela.filtroAtivos && meta.atributos.indexOf('statecode') >= 0) {
      filtros.push(tabela.filtroAtivos);
    }

    const busca = (opcoes.busca || '').trim();
    const camposBusca = tabela.camposBusca.filter(c => meta.atributos.indexOf(c) >= 0);

    if (busca && camposBusca.length > 0) {
      filtros.push(
        '(' +
        camposBusca
          .map(c => `contains(${c},'${escaparOData(busca)}')`)
          .join(' or ') +
        ')'
      );
    }

    const campoOrdem = tabela.ordenacao.split(' ')[0];
    const ordem = meta.atributos.indexOf(campoOrdem) >= 0
      ? `&$orderby=${encodeURIComponent(tabela.ordenacao)}`
      : '';

    const endpoint =
      `${meta.entitySetName}?$select=${select.join(',')}` +
      (filtros.length > 0 ? `&$filter=${encodeURIComponent(filtros.join(' and '))}` : '') +
      ordem +
      '&$count=true';

    const pagina = await this.paginaDe(endpoint);

    return { ...pagina, meta, colunas };
  }

  public proximaPagina(url: string): Promise<IPaginaCrm> {
    return this.paginaDe(url);
  }

  private async paginaDe(endpointOuUrl: string): Promise<IPaginaCrm> {
    const dados = await this.requisitar(endpointOuUrl, CRM_TAMANHO_PAGINA) as IRespostaLista;
    return {
      registros: dados.value || [],
      total: dados['@odata.count'],
      totalLimitado: !!dados['@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded'],
      proximaPagina: dados['@odata.nextLink']
    };
  }

  // ==========================================================
  // INDICADORES
  // ==========================================================

  // Quantidade de registros (até 5.000 — limite do $count do Dataverse).
  public async contar(
    tabela: ITabelaCrm,
    somenteAtivos: boolean
  ): Promise<number | undefined> {

    const meta = await this.obterMetadados(tabela.logicalName);

    if (!meta) {
      return undefined;
    }

    const filtro = somenteAtivos && tabela.filtroAtivos && meta.atributos.indexOf('statecode') >= 0
      ? `&$filter=${encodeURIComponent(tabela.filtroAtivos)}`
      : '';

    const dados = await this.requisitar(
      `${meta.entitySetName}?$select=${meta.idPrimario}${filtro}&$count=true`,
      1
    ) as IRespostaLista;

    return dados['@odata.count'];
  }

  // Oportunidades abertas agrupadas por etapa do processo de vendas.
  public async pipeline(): Promise<IEtapaPipeline[] | undefined> {

    const meta = await this.obterMetadados('opportunity');

    if (!meta || meta.atributos.indexOf('estimatedvalue') < 0) {
      return undefined;
    }

    const campoEtapa = meta.atributos.indexOf('stepname') >= 0 ? 'stepname' : 'statuscode';

    const apply =
      `filter(statecode eq 0)/groupby((${campoEtapa}),` +
      'aggregate(estimatedvalue with sum as valor,$count as quantidade))';

    const dados = await this.requisitar(
      `${meta.entitySetName}?$apply=${encodeURIComponent(apply)}`
    ) as IRespostaLista;

    return (dados.value || [])
      .map(linha => ({
        etapa: String(
          linha[`${campoEtapa}${FORMATADO}`] ||
          linha[campoEtapa] ||
          'Sem etapa definida'
        ),
        quantidade: Number(linha.quantidade || 0),
        valor: Number(linha.valor || 0)
      }))
      .sort((a, b) => b.valor - a.valor);
  }

  // ==========================================================
  // TABELAS PERSONALIZADAS (ex.: as criadas para o "CRM IA Lab")
  // ==========================================================

  public async listarTabelasPersonalizadas(): Promise<ITabelaPersonalizadaCrm[]> {

    const dados = await this.requisitar(
      'EntityDefinitions' +
      '?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,DisplayCollectionName' +
      '&$filter=IsCustomEntity eq true and IsIntersect eq false and IsActivity eq false'
    ) as { value?: IMetadadosApi[] };

    return (dados.value || [])
      .filter(m => !!m.EntitySetName && !!m.PrimaryNameAttribute)
      .map(m => ({
        logicalName: m.LogicalName,
        entitySetName: m.EntitySetName,
        rotulo: rotuloDe(m.DisplayCollectionName, m.LogicalName),
        idPrimario: m.PrimaryIdAttribute,
        nomePrimario: m.PrimaryNameAttribute
      }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  }

  public async listarGenerico(
    tabela: ITabelaPersonalizadaCrm,
    busca: string
  ): Promise<IPaginaCrm> {

    const filtro = busca.trim()
      ? `&$filter=${encodeURIComponent(`contains(${tabela.nomePrimario},'${escaparOData(busca.trim())}')`)}`
      : '';

    return this.paginaDe(
      `${tabela.entitySetName}?$select=${tabela.idPrimario},${tabela.nomePrimario},createdon,modifiedon,_ownerid_value` +
      `${filtro}&$orderby=${encodeURIComponent('modifiedon desc')}&$count=true`
    );
  }

  // ==========================================================
  // LINK PARA O DYNAMICS
  // ==========================================================

  public linkRegistro(logicalName: string, id: string): string {
    const app = this.ambiente.appId ? `appid=${encodeURIComponent(this.ambiente.appId)}&` : '';
    return `${this.baseUrl}/main.aspx?${app}pagetype=entityrecord&etn=${encodeURIComponent(logicalName)}&id=${encodeURIComponent(id)}`;
  }

  public linkLista(logicalName: string): string {
    const app = this.ambiente.appId ? `appid=${encodeURIComponent(this.ambiente.appId)}&` : '';
    return `${this.baseUrl}/main.aspx?${app}pagetype=entitylist&etn=${encodeURIComponent(logicalName)}`;
  }
}

// ============================================================
// DESCOBERTA DE AMBIENTES (Global Discovery Service)
//
// Lista os ambientes Dataverse que o usuário logado consegue acessar.
// Usado só na tela de configuração, para ajudar a achar a URL certa.
// ============================================================

export const descobrirAmbientesCrm = async (): Promise<IAmbienteDescoberto[]> => {

  const recurso = 'https://globaldisco.crm.dynamics.com';
  const cliente = await obterClienteCrm(recurso);

  const resposta = await cliente.get(
    `${recurso}/api/discovery/v2.0/Instances?$select=FriendlyName,Url,Region`,
    AadHttpClient.configurations.v1,
    { headers: { Accept: 'application/json' } }
  );

  if (!resposta.ok) {
    throw new Error(`Discovery retornou ${resposta.status} ${resposta.statusText}. ${await resposta.text()}`);
  }

  const dados = await resposta.json() as {
    value?: Array<{ FriendlyName?: string; Url?: string; Region?: string }>;
  };

  return (dados.value || [])
    .map(i => ({ nome: i.FriendlyName || '', url: i.Url || '', regiao: i.Region || '' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
};
