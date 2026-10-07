import {
  ChaveModuloPortal,
  moduloLiberado
} from './modulosPortal';

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
//   Gestor / Administrador da área → gestão de pessoas e aprovação
//                           naquela área (mesmo com perfil global
//                           Colaborador).
//   Editor                → editor com escopo naquela área (mesmo com
//                           perfil global Colaborador).
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

  // undefined = todas as áreas
  escopoAreas?: string[];

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

export const calcularRegrasAcesso = (
  perfil: PerfilGlobal | string,
  vinculosAtivos: IVinculoRegra[],
  modulos?: ChaveModuloPortal[]
): IRegrasAcesso => {

  const admin = perfil === 'Administrador';

  const areasGestor =
    vinculosAtivos
      .filter(v => ehPapelGestor(v.perfil))
      .map(v => v.areaId);

  const areasEditor =
    vinculosAtivos
      .filter(v => ehPapelEditor(v.perfil))
      .map(v => v.areaId);

  const editor =
    admin ||
    perfil === 'Editor' ||
    areasEditor.length > 0;

  const gestor =
    admin ||
    perfil === 'Gestor' ||
    areasGestor.length > 0;

  let escopoAreas: string[] | undefined;

  if (
    admin ||
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

  const modulo = (chave: ChaveModuloPortal): boolean =>
    moduloLiberado(perfil, modulos, chave);

  const conteudo = (chave: ChaveModuloPortal): boolean =>
    admin || (editor && modulo(chave));

  const pessoas = admin || editor || gestor;

  return {
    admin,
    editor,
    gestor,
    areasGestor,
    areasEditor,
    escopoAreas,

    podeVerEquipe: pessoas,
    podeAtribuirTreinamentos: pessoas,
    podeVerIndicadoresGerenciais: pessoas,

    podeAprovarDocumentos: gestor,

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
