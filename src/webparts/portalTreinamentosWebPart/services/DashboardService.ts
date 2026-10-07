import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

// ================================================================
// DASHBOARDS (abas da página Indicadores)
// ================================================================
// Tabela dgt_dashboard (criada por
// scripts/dataverse/criar-tabela-dashboards.ps1):
//   dgt_name       Nome da aba
//   dgt_url        Link de incorporação (Power BI ou outro)
//   dgt_descricao  Descrição exibida acima do dashboard
//   dgt_ordem      Ordem das abas
//   dgt_altura     Altura do painel em pixels
//   dgt_publico    Quem vê: Todos | Gestor | Administrador
//   dgt_ativo      Aba visível no portal
// ================================================================

export type PublicoDashboard =
  | 'Todos'
  | 'Gestor'
  | 'Administrador';

export interface IDashboard {
  id: string;
  nome: string;
  url: string;
  descricao: string;
  ordem: number;
  altura: number;
  publico: PublicoDashboard;
  ativo: boolean;
}

export type IDashboardEdicao =
  Omit<IDashboard, 'id'> & { id?: string };

export const TABELA_DASHBOARD = 'dgt_dashboard';

export const ALTURA_PADRAO = 760;

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null
    ? padrao
    : String(valor);
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {
  const valor = registro[campo];
  if (typeof valor === 'boolean') return valor;
  if (valor === 1 || valor === '1' || valor === 'true') return true;
  if (valor === 0 || valor === '0' || valor === 'false') return false;
  return padrao;
};

const normalizarPublico = (
  valor: string
): PublicoDashboard => {
  const v = (valor || '').trim().toLowerCase();
  if (v.indexOf('admin') === 0) return 'Administrador';
  if (v.indexOf('gestor') === 0) return 'Gestor';
  return 'Todos';
};

// ================================================================
// LINKS DO POWER BI
// ================================================================

export interface IAnaliseLink {
  valido: boolean;
  urlIncorporacao: string;
  aviso: string;
}

// Aceita:
//  - link de incorporação segura (Arquivo > Inserir relatório >
//    SharePoint Online / Site ou portal):  .../reportEmbed?reportId=...
//  - link do relatório aberto no navegador:
//    .../groups/{workspace}/reports/{relatorio}/{pagina}?...
//    (convertido automaticamente para reportEmbed)
//  - link de "Publicar na Web" (view?r=...) — público, use com cuidado
//  - qualquer outro https (outras ferramentas)
export const analisarLink = (
  bruto: string
): IAnaliseLink => {

  const url = (bruto || '').trim();

  if (!url) {
    return { valido: false, urlIncorporacao: '', aviso: 'Informe o link do dashboard.' };
  }

  if (!/^https:\/\//i.test(url)) {
    return { valido: false, urlIncorporacao: '', aviso: 'O link deve começar com https://' };
  }

  if (/app\.powerbi\.com/i.test(url)) {

    if (/reportEmbed/i.test(url)) {
      const final =
        /autoAuth=/i.test(url)
          ? url
          : `${url}${url.indexOf('?') >= 0 ? '&' : '?'}autoAuth=true`;

      return { valido: true, urlIncorporacao: final, aviso: '' };
    }

    if (/\/view\?r=/i.test(url)) {
      return {
        valido: true,
        urlIncorporacao: url,
        aviso: 'Link de "Publicar na Web": qualquer pessoa com o link vê os dados, sem login. Prefira o link de incorporação segura.'
      };
    }

    const relatorio =
      /\/groups\/([0-9a-f-]{36}|me)\/reports\/([0-9a-f-]{36})(?:\/([^/?#]+))?/i.exec(url);

    if (relatorio) {
      const workspace = relatorio[1];
      const reportId = relatorio[2];
      const pagina = relatorio[3];

      const ctid = /[?&]ctid=([0-9a-f-]{36})/i.exec(url);

      let final =
        `https://app.powerbi.com/reportEmbed?reportId=${reportId}&autoAuth=true`;

      if (workspace.toLowerCase() !== 'me') {
        final += `&groupId=${workspace}`;
      }

      if (pagina && pagina.toLowerCase() !== 'reportsection' && !/^[0-9a-f-]{36}$/i.test(pagina)) {
        final += `&pageName=${pagina}`;
      }

      if (ctid) {
        final += `&ctid=${ctid[1]}`;
      }

      return { valido: true, urlIncorporacao: final, aviso: '' };
    }

    if (/\/(list|datasets|dashboards)/i.test(url) || /subfolderId=/i.test(url)) {
      return {
        valido: false,
        urlIncorporacao: '',
        aviso: 'Este link é da lista do workspace, não de um relatório. Abra o relatório e use Arquivo > Inserir relatório > SharePoint Online (ou copie o link do navegador com o relatório aberto).'
      };
    }

    return {
      valido: true,
      urlIncorporacao: url,
      aviso: 'Link do Power BI em formato não reconhecido. Se não carregar, use Arquivo > Inserir relatório > SharePoint Online.'
    };
  }

  return { valido: true, urlIncorporacao: url, aviso: '' };
};

// Quem pode ver cada aba
export const podeVerDashboard = (
  dashboard: IDashboard,
  perfil?: string
): boolean => {
  const p = (perfil || '').toLowerCase();

  if (dashboard.publico === 'Todos') return true;
  if (p === 'administrador') return true;
  if (dashboard.publico === 'Gestor') return p === 'gestor';

  return false;
};

export class DashboardService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async listar(): Promise<IDashboard[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_DASHBOARD,
        '$select=dgt_dashboardid,dgt_name,dgt_url,dgt_descricao,dgt_ordem,dgt_altura,dgt_publico,dgt_ativo' +
        '&$orderby=dgt_ordem asc,dgt_name asc'
      );

    return registros
      .map(registro => ({
        id: texto(registro, 'dgt_dashboardid'),
        nome: texto(registro, 'dgt_name', 'Dashboard'),
        url: texto(registro, 'dgt_url'),
        descricao: texto(registro, 'dgt_descricao'),
        ordem: Number(texto(registro, 'dgt_ordem', '0')) || 0,
        altura: Number(texto(registro, 'dgt_altura', '0')) || ALTURA_PADRAO,
        publico: normalizarPublico(texto(registro, 'dgt_publico', 'Todos')),
        ativo: booleano(registro, 'dgt_ativo', true)
      }))
      .sort((a, b) =>
        a.ordem - b.ordem ||
        a.nome.localeCompare(b.nome, 'pt-BR')
      );
  }

  public async salvar(dados: IDashboardEdicao): Promise<void> {

    const nome = (dados.nome || '').trim();

    if (!nome) {
      throw new Error('Informe o nome da aba.');
    }

    const link = analisarLink(dados.url);

    if (!link.valido) {
      throw new Error(link.aviso);
    }

    const registro: Record<string, unknown> = {
      dgt_name: nome.substring(0, 200),
      dgt_url: link.urlIncorporacao,
      dgt_descricao: (dados.descricao || '').trim().substring(0, 500),
      dgt_ordem: Math.round(dados.ordem || 0),
      dgt_altura: Math.max(300, Math.min(3000, Math.round(dados.altura || ALTURA_PADRAO))),
      dgt_publico: dados.publico,
      dgt_ativo: dados.ativo
    };

    if (dados.id) {
      await this.dataverse.atualizarRegistro(
        TABELA_DASHBOARD,
        dados.id,
        registro
      );
    } else {
      await this.dataverse.criarRegistro(
        TABELA_DASHBOARD,
        registro
      );
    }
  }

  public async definirAtivo(id: string, ativo: boolean): Promise<void> {
    await this.dataverse.atualizarRegistro(
      TABELA_DASHBOARD,
      id,
      { dgt_ativo: ativo }
    );
  }

  public async excluir(id: string): Promise<void> {
    await this.dataverse.excluirRegistro(
      TABELA_DASHBOARD,
      id
    );
  }
}
