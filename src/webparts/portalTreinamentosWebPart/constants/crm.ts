// ============================================================
// CRM (DYNAMICS 365 / DATAVERSE) — CONFIGURAÇÃO
//
// O portal lê os dados do CRM direto do ambiente Dataverse em que o
// CRM foi configurado (hoje: "DGT - CRM - POC"). Esse ambiente é
// DIFERENTE do ambiente do portal ("Ambiente do DGT - Automação
// Processos"), por isso tem URL e token próprios.
//
// COMO PREENCHER A URL:
//   make.powerapps.com → selecione o ambiente "DGT - CRM - POC" →
//   engrenagem (canto superior direito) → "Detalhes da sessão" →
//   copie a "URL da instância" (ex.: https://orgxxxxxxx.crm3.dynamics.com).
//   Ou: Power Platform admin center → Ambientes → DGT - CRM - POC →
//   campo "URL do ambiente".
//
// appId (opcional): id do aplicativo controlado por modelos, usado no
// botão "Abrir no Dynamics" para abrir o registro dentro do app certo.
//   make.powerapps.com → Aplicativos → "DGT - CRM" → ... → Detalhes →
//   "ID do aplicativo". Os apps "DGT - CRM" e "DGT - CRM IA Lab" são
//   duas INTERFACES sobre o MESMO ambiente: os dados são os mesmos.
//
// Para ligar outro ambiente no futuro (ex.: produção), basta incluir
// mais um item na lista. Com 2 ou mais, a tela mostra um seletor.
// ============================================================

export interface IAmbienteCrm {
  chave: string;
  nome: string;
  // URL do ambiente, SEM "/api/data" e sem barra no final.
  url: string;
  appId?: string;
  appNome?: string;
}

export const CRM_AMBIENTES: IAmbienteCrm[] = [
  {
    chave: 'poc',
    nome: 'DGT - CRM - POC',
    // Região: Canadá (crm3). URL obtida em "Listar meus ambientes".
    url: 'https://orgdfea9cfb.crm3.dynamics.com',
    appId: '',
    appNome: 'DGT - CRM'
  }
];

export const CRM_VERSAO_API = 'v9.2';

// Quantidade de linhas por página nas listas.
export const CRM_TAMANHO_PAGINA = 50;

// ============================================================
// TABELAS EXIBIDAS
//
// "colunas" é a lista DESEJADA. Antes de consultar, o serviço confere
// nos metadados quais colunas existem no ambiente e descarta as que
// não existem (ex.: tabela de Vendas sem algum campo). Assim a tela
// não quebra se o CRM tiver sido configurado de outro jeito.
//
// LGPD / política da DGT: NÃO incluir aqui colunas com CPF, CNPJ,
// senhas ou dados bancários. O portal só busca as colunas listadas.
// ============================================================

export type TipoColunaCrm = 'texto' | 'moeda' | 'data' | 'numero' | 'percentual' | 'escolha' | 'lookup';

export interface IColunaCrm {
  nome: string;      // logical name (lookup: o nome do campo, ex.: ownerid)
  rotulo: string;
  tipo: TipoColunaCrm;
  // Mostrar na tabela (as demais aparecem só no detalhe).
  naLista?: boolean;
}

export interface ITabelaCrm {
  chave: string;
  logicalName: string;
  rotulo: string;
  rotuloSingular: string;
  colunas: IColunaCrm[];
  // Filtro OData fixo para a aba "Ativos/Abertos".
  filtroAtivos?: string;
  ordenacao: string;
  // Campos onde a busca por texto procura (contains).
  camposBusca: string[];
}

export const CRM_TABELAS: ITabelaCrm[] = [
  {
    chave: 'contas',
    logicalName: 'account',
    rotulo: 'Contas',
    rotuloSingular: 'Conta',
    filtroAtivos: 'statecode eq 0',
    ordenacao: 'modifiedon desc',
    camposBusca: ['name', 'accountnumber', 'address1_city'],
    colunas: [
      { nome: 'name', rotulo: 'Nome', tipo: 'texto', naLista: true },
      { nome: 'accountnumber', rotulo: 'Código', tipo: 'texto', naLista: true },
      { nome: 'industrycode', rotulo: 'Segmento', tipo: 'escolha', naLista: true },
      { nome: 'address1_city', rotulo: 'Cidade', tipo: 'texto', naLista: true },
      { nome: 'address1_stateorprovince', rotulo: 'UF', tipo: 'texto', naLista: true },
      { nome: 'primarycontactid', rotulo: 'Contato principal', tipo: 'lookup' },
      { nome: 'telephone1', rotulo: 'Telefone', tipo: 'texto' },
      { nome: 'emailaddress1', rotulo: 'E-mail', tipo: 'texto' },
      { nome: 'websiteurl', rotulo: 'Site', tipo: 'texto' },
      { nome: 'ownerid', rotulo: 'Proprietário', tipo: 'lookup', naLista: true },
      { nome: 'modifiedon', rotulo: 'Modificado em', tipo: 'data', naLista: true }
    ]
  },
  {
    chave: 'contatos',
    logicalName: 'contact',
    rotulo: 'Contatos',
    rotuloSingular: 'Contato',
    filtroAtivos: 'statecode eq 0',
    ordenacao: 'modifiedon desc',
    camposBusca: ['fullname', 'emailaddress1', 'jobtitle'],
    colunas: [
      { nome: 'fullname', rotulo: 'Nome', tipo: 'texto', naLista: true },
      { nome: 'jobtitle', rotulo: 'Cargo', tipo: 'texto', naLista: true },
      { nome: 'parentcustomerid', rotulo: 'Empresa', tipo: 'lookup', naLista: true },
      { nome: 'emailaddress1', rotulo: 'E-mail', tipo: 'texto', naLista: true },
      { nome: 'telephone1', rotulo: 'Telefone', tipo: 'texto' },
      { nome: 'mobilephone', rotulo: 'Celular', tipo: 'texto' },
      { nome: 'address1_city', rotulo: 'Cidade', tipo: 'texto' },
      { nome: 'ownerid', rotulo: 'Proprietário', tipo: 'lookup', naLista: true },
      { nome: 'modifiedon', rotulo: 'Modificado em', tipo: 'data', naLista: true }
    ]
  },
  {
    chave: 'leads',
    logicalName: 'lead',
    rotulo: 'Leads',
    rotuloSingular: 'Lead',
    filtroAtivos: 'statecode eq 0',
    ordenacao: 'createdon desc',
    camposBusca: ['fullname', 'subject', 'companyname'],
    colunas: [
      { nome: 'subject', rotulo: 'Tópico', tipo: 'texto', naLista: true },
      { nome: 'fullname', rotulo: 'Nome', tipo: 'texto', naLista: true },
      { nome: 'companyname', rotulo: 'Empresa', tipo: 'texto', naLista: true },
      { nome: 'leadsourcecode', rotulo: 'Origem', tipo: 'escolha', naLista: true },
      { nome: 'statuscode', rotulo: 'Status', tipo: 'escolha', naLista: true },
      { nome: 'emailaddress1', rotulo: 'E-mail', tipo: 'texto' },
      { nome: 'telephone1', rotulo: 'Telefone', tipo: 'texto' },
      { nome: 'ownerid', rotulo: 'Proprietário', tipo: 'lookup', naLista: true },
      { nome: 'createdon', rotulo: 'Criado em', tipo: 'data', naLista: true }
    ]
  },
  {
    chave: 'oportunidades',
    logicalName: 'opportunity',
    rotulo: 'Oportunidades',
    rotuloSingular: 'Oportunidade',
    filtroAtivos: 'statecode eq 0',
    ordenacao: 'estimatedclosedate asc',
    camposBusca: ['name'],
    colunas: [
      { nome: 'name', rotulo: 'Oportunidade', tipo: 'texto', naLista: true },
      { nome: 'customerid', rotulo: 'Cliente', tipo: 'lookup', naLista: true },
      { nome: 'estimatedvalue', rotulo: 'Valor estimado', tipo: 'moeda', naLista: true },
      { nome: 'closeprobability', rotulo: 'Probabilidade', tipo: 'percentual', naLista: true },
      { nome: 'estimatedclosedate', rotulo: 'Fechamento previsto', tipo: 'data', naLista: true },
      { nome: 'stepname', rotulo: 'Etapa', tipo: 'texto', naLista: true },
      { nome: 'statuscode', rotulo: 'Status', tipo: 'escolha' },
      { nome: 'ownerid', rotulo: 'Proprietário', tipo: 'lookup', naLista: true },
      { nome: 'modifiedon', rotulo: 'Modificado em', tipo: 'data' }
    ]
  }
];