import {
  ChaveModuloPortal,
  moduloLiberado
} from './modulosPortal';

// ADMINISTRADOR DO MÓDULO (dgt_modulosacesso "admin:<módulo>"): tudo
// o que o Administrador faz, só naquele módulo — todas as áreas do
// módulo, aprovações e telas de administração. Ex.: administrador de
// Treinamentos gerencia treinamentos de todas as áreas e atribui para
// todos; de Documentos vê e aprova qualquer documento. Usuários e
// acessos continua só com o Administrador global.

// ============================================================
// REGRAS DE ACESSO DO PORTAL (fonte única)
//
// Usadas pelo AutorizacaoService (contexto do usuário logado), pelo
// RoutePermissionService (rotas) e pelo ResumoAcessoEfetivo (tela
// "Usuários e acessos" / "Meu perfil"). Alterou a regra? Altere AQUI.
//
// PERFIS GLOBAIS (dgt_usuario.dgt_perfilacesso)
//   Funcionario (Colaborador) → próprios treinamentos e documentos.
//   Gestor        → acompanha equipe, atribui treinamentos, vê
//                   conformidade/indicadores gerenciais e APROVA
//                   documentos. NÃO cria conteúdo.
//   Editor        → cria e mantém conteúdo dos MÓDULOS liberados e
//                   acompanha equipe/atribui nas ÁREAS liberadas.
//                   NÃO cadastra usuários nem altera acessos.
//   Administrador → tudo, inclusive usuários, acessos e permissões.
//
// PAPÉIS POR ÁREA (dgt_usuarioarea.dgt_perfilarea)
//   Membro                → participa da área.
//   Gestor                → gestão de pessoas e aprovação naquela área
//                           (mesmo com perfil global Colaborador).
//   Editor                → editor com escopo naquela área (mesmo com
//                           perfil global Colaborador).
//   Administrador da área → TUDO o que o Administrador faz, mas só
//                           naquela área: pessoas, aprovação, criar e
//                           manter conteúdo dos módulos liberados e as
//                           visões de administração dos módulos (ex.:
//                           todas as planilhas de orçamento da área),
//                           mesmo com perfil global Colaborador. Não
//                           cadastra usuários nem altera acessos (isso
//                           continua só com o Administrador global).
//
// ESCOPO DE PESSOAS (equipe, atribuição, conformidade)
//   Administrador ou Gestor global      → todas as áreas.
//   Editor global SEM área de Editor    → todas as áreas.
//   Demais                              → áreas onde é Gestor/Editor.
//
// IMPORTANTE: isto organiza a TELA. A proteção dos dados é feita
// pelas Security Roles do Dataverse e pelos plugins do servidor.
// ============================================================

export type PerfilGlobal =
  | 'Funcionario'
  | 'Editor'
  | 'Gestor'
  | 'Administrador';

export type PapelArea =
  | 'Membro'
  | 'Gestor'
  | 'Administrador da área'
  | 'Editor';

export interface IVinculoRegra {
  areaId: string;
  areaNome: string;
  perfil: string;
}

export interface IRegrasAcesso {
  admin: boolean;

  // Editor (global ou em alguma área) e Gestor (global ou de área)
  editor: boolean;
  gestor: boolean;

  areasGestor: string[];
  areasEditor: string[];
  // Áreas em que é "Administrador da área" (admin com escopo na área).
  areasAdministrador: string[];
  // Módulos que administra (além do Administrador global, que é tudo).
  modulosAdministrados: ChaveModuloPortal[];

  // undefined = todas as áreas
  escopoAreas?: string[];

  // Áreas cujo CONTEÚDO (treinamentos) a pessoa pode criar e manter.
  // undefined = todas (Administrador, ou Editor global sem papel de
  // Editor em áreas específicas). Editor na área RH → só RH; para ir
  // além, inclua a pessoa como Editor em outra área.
  areasConteudo?: string[];

  // Pessoas
  podeVerEquipe: boolean;
  podeAtribuirTreinamentos: boolean;
  podeVerIndicadoresGerenciais: boolean;

  // Aprovação de documentos (o recorte pela área do documento é
  // feito na tela/fluxo de aprovação)
  podeAprovarDocumentos: boolean;

  // Conteúdo, por módulo
  podeGerenciarTreinamentos: boolean;
  podeGerenciarDocumentos: boolean;
  podeGerenciarProcessos: boolean;
  podeGerenciarDashboards: boolean;

  // Administração
  podeGerenciarUsuarios: boolean;
}

const guid = (valor: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const ehPapelGestor = (papel: string): boolean =>
  papel === 'Gestor' || papel === 'Administrador da área';

export const ehPapelEditor = (papel: string): boolean =>
  papel === 'Editor';

export const ehPapelAdministradorArea = (papel: string): boolean =>
  papel === 'Administrador da área';

// É Administrador (global) ou Administrador da área informada?
export const administraArea = (
  perfil: string,
  areasAdministrador: string[] | undefined,
  areaId: string | undefined
): boolean =>
  perfil === 'Administrador' ||
  (!!areaId && (areasAdministrador || []).some(id => guid(id) === guid(areaId)));

// O conteúdo (ex.: treinamento) da área informada está no escopo de
// edição da pessoa? Sem lista = todas as áreas. Conteúdo SEM área só
// é visto por quem tem escopo total.
export const noEscopoDeConteudo = (
  areasConteudo: string[] | undefined,
  areaId: string | undefined
): boolean => {
  if (!areasConteudo) {
    return true;
  }
  const alvo = guid(areaId || '');
  return !!alvo && areasConteudo.some(id => guid(id) === alvo);
};

// Catálogo de treinamentos: quais áreas o usuário enxerga.
//   undefined → todas (Administrador, administrador de Treinamentos,
//                Editor sem recorte de área);
//   lista     → áreas de Editor + Gestor + Administrador da área. Se o
//               Gestor não tiver área de gestão cadastrada, usa as
//               áreas em que ele está vinculado.
export const areasCatalogo = (
  contexto: {
    perfil: string;
    areasConteudo?: string[];
    areasGestor?: string[];
    areasAdministrador?: string[];
    vinculosArea?: Array<{ areaId: string }>;
  } | undefined
): string[] | undefined => {

  if (!contexto) {
    return [];
  }

  if (contexto.perfil === 'Administrador' || contexto.areasConteudo === undefined) {
    return undefined;
  }

  const unir = (lista: string[]): string[] =>
    lista.filter((id, i) => !!id && lista.map(guid).indexOf(guid(id)) === i);

  const areas = unir([
    ...(contexto.areasConteudo || []),
    ...(contexto.areasGestor || []),
    ...(contexto.areasAdministrador || [])
  ]);

  if (areas.length > 0) {
    return areas;
  }

  return unir((contexto.vinculosArea || []).map(v => v.areaId));
};

export const calcularRegrasAcesso = (
  perfil: PerfilGlobal | string,
  vinculosAtivos: IVinculoRegra[],
  modulos?: ChaveModuloPortal[],
  modulosAdministradosInformados?: ChaveModuloPortal[]
): IRegrasAcesso => {

  const admin = perfil === 'Administrador';

  // Só vale para módulos liberados (o próprio gravar já garante).
  const modulosAdministrados =
    admin
      ? []
      : (modulosAdministradosInformados || []).filter(chave => moduloLiberado(perfil, modulos, chave));

  const administra = (chave: ChaveModuloPortal): boolean =>
    admin || modulosAdministrados.indexOf(chave) >= 0;

  const areasGestor =
    vinculosAtivos
      .filter(v => ehPapelGestor(v.perfil))
      .map(v => v.areaId);

  const areasEditor =
    vinculosAtivos
      .filter(v => ehPapelEditor(v.perfil))
      .map(v => v.areaId);

  // Administrador da área: gestor E editor daquela área.
  const areasAdministrador =
    vinculosAtivos
      .filter(v => ehPapelAdministradorArea(v.perfil))
      .map(v => v.areaId);

  const editor =
    admin ||
    perfil === 'Editor' ||
    areasEditor.length > 0 ||
    areasAdministrador.length > 0;

  const gestor =
    admin ||
    perfil === 'Gestor' ||
    areasGestor.length > 0;

  let escopoAreas: string[] | undefined;

  if (
    admin ||
    administra('treinamentos') ||
    perfil === 'Gestor' ||
    (perfil === 'Editor' && areasEditor.length === 0)
  ) {
    escopoAreas = undefined;
  } else {
    const vistos: Record<string, boolean> = {};
    escopoAreas = [];
    areasGestor.concat(areasEditor).forEach(id => {
      const chave = guid(id);
      if (chave && !vistos[chave]) {
        vistos[chave] = true;
        (escopoAreas as string[]).push(id);
      }
    });
  }

  // Conteúdo: áreas de Editor + áreas de Administrador da área.
  // (Usado na Gestão de Treinamentos: o administrador de Treinamentos
  // vê e mantém os treinamentos de todas as áreas.)
  const areasConteudo: string[] | undefined =
    admin || administra('treinamentos') || (perfil === 'Editor' && areasEditor.length === 0)
      ? undefined
      : areasEditor
        .concat(areasAdministrador)
        .filter((id, i, lista) => lista.map(guid).indexOf(guid(id)) === i);

  const modulo = (chave: ChaveModuloPortal): boolean =>
    moduloLiberado(perfil, modulos, chave);

  const conteudo = (chave: ChaveModuloPortal): boolean =>
    administra(chave) || (editor && modulo(chave));

  const pessoas = admin || editor || gestor || administra('treinamentos');

  return {
    admin,
    editor,
    gestor,
    areasGestor,
    areasEditor,
    areasAdministrador,
    modulosAdministrados,
    escopoAreas,
    areasConteudo,

    podeVerEquipe: pessoas,
    podeAtribuirTreinamentos: pessoas,
    podeVerIndicadoresGerenciais: pessoas,

    podeAprovarDocumentos: gestor || administra('documentos'),

    podeGerenciarTreinamentos: conteudo('treinamentos'),
    podeGerenciarDocumentos: conteudo('documentos'),
    podeGerenciarProcessos: conteudo('processos'),
    podeGerenciarDashboards: conteudo('indicadores'),

    podeGerenciarUsuarios: admin
  };
};

// ============================================================
// RECORTE DE PESSOAS PELO ESCOPO DE ÁREAS
// ============================================================

export interface IVinculoPessoaArea {
  usuarioId: string;
  usuarioNome?: string;
  usuarioEmail?: string;
  areaId: string;
  ativo: boolean;
}

export interface IEscopoPessoas {
  ids: Record<string, boolean>;
  emails: Record<string, boolean>;
  nomes: Record<string, boolean>;
}

// undefined = sem recorte (vê todos)
export const montarEscopoPessoas = (
  escopoAreas: string[] | undefined,
  vinculos: IVinculoPessoaArea[]
): IEscopoPessoas | undefined => {

  if (!escopoAreas) {
    return undefined;
  }

  const areas: Record<string, boolean> = {};
  escopoAreas.forEach(id => { areas[guid(id)] = true; });

  const escopo: IEscopoPessoas = { ids: {}, emails: {}, nomes: {} };

  vinculos
    .filter(v => v.ativo && areas[guid(v.areaId)])
    .forEach(v => {
      escopo.ids[guid(v.usuarioId)] = true;
      if (v.usuarioEmail) {
        escopo.emails[v.usuarioEmail.trim().toLowerCase()] = true;
      }
      if (v.usuarioNome) {
        escopo.nomes[v.usuarioNome.trim().toLowerCase()] = true;
      }
    });

  return escopo;
};

export const pessoaNoEscopo = (
  escopo: IEscopoPessoas | undefined,
  pessoa: { id?: string | number; email?: string; nome?: string }
): boolean => {

  if (!escopo) {
    return true;
  }

  const id = guid(String(pessoa.id === undefined || pessoa.id === null ? '' : pessoa.id));
  if (id && escopo.ids[id]) return true;

  const email = (pessoa.email || '').trim().toLowerCase();
  if (email && escopo.emails[email]) return true;

  const nome = (pessoa.nome || '').trim().toLowerCase();
  if (nome && escopo.nomes[nome]) return true;

  return false;
};

export const areaNoEscopo = (
  escopoAreas: string[] | undefined,
  areaId: string
): boolean =>
  !escopoAreas ||
  escopoAreas.some(id => guid(id) === guid(areaId));
