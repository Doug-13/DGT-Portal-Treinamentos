import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  ChaveModuloPortal,
  lerModulosAcesso
} from '../utils/modulosPortal';

// ============================================================
// PERFIS GLOBAIS DO PORTAL (campo dgt_usuario.dgt_perfilacesso)
//
// Funcionario   → realiza os próprios treinamentos e consulta documentos.
// Editor        → cria e mantém conteúdo: treinamentos, módulos,
//                 avaliações, trilhas, documentos e revisões (elaboração
//                 e envio para aprovação). NÃO aprova nem publica
//                 revisões, NÃO atribui treinamentos, NÃO vê equipe/
//                 indicadores e NÃO administra áreas e acessos.
// Gestor        → acompanha equipe, atribui treinamentos, vê
//                 conformidade/indicadores. A aprovação de documentos
//                 continua dependendo de ser Gestor DA ÁREA do documento
//                 (dgt_usuarioarea).
// Administrador → tudo.
//
// PAPÉIS POR ÁREA (dgt_usuarioarea.dgt_perfilarea): Membro, Gestor,
// Administrador da área. Quem é Gestor (ou Administrador) em pelo
// menos uma área recebe os recursos de gestão (equipe, atribuição,
// indicadores, usuários e acessos) LIMITADOS às suas áreas — mesmo
// que o perfil global seja Funcionário. Assim uma pessoa pode ser
// "usuária" em uma área e "gestora" em outra.
//
// MÓDULOS (dgt_usuario.dgt_modulosacesso, opcional): lista de módulos
// liberados ao usuário. Vazio = todos os que o perfil permite.
//
// IMPORTANTE: isto organiza a TELA. A proteção real dos dados está nas
// Security Roles do Dataverse (DGT - Treinamentos - <Perfil>).
// ============================================================

export interface IVinculoAcesso {
  areaId: string;
  areaNome: string;
  perfil: string;
}

export type PerfilAcesso =
  | 'Funcionario'
  | 'Editor'
  | 'Gestor'
  | 'Administrador';

export interface IContextoAcesso {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: PerfilAcesso;
  ativo: boolean;

  podeGerenciarTreinamentos: boolean;
  podeGerenciarDocumentos: boolean;
  podeGerenciarUsuarios: boolean;
  podeGerenciarTrilhas: boolean;
  podeGerenciarAvaliacoes: boolean;

  podeAtribuirTreinamentos: boolean;
  podeVerEquipe: boolean;
  podeVerIndicadoresGerenciais: boolean;

  // Papéis por área (ativos) e áreas em que o usuário é gestor.
  vinculosArea?: IVinculoAcesso[];
  areasGestor?: string[];

  // Módulos liberados (undefined = todos os que o perfil permite).
  modulosPermitidos?: ChaveModuloPortal[];
}

// Gestor de pelo menos uma área (ou Gestor/Administrador global).
export const ehGestorEmAlgumaArea = (
  contexto?: IContextoAcesso
): boolean =>
  !!contexto &&
  (
    contexto.perfil === 'Gestor' ||
    contexto.perfil === 'Administrador' ||
    (contexto.areasGestor || []).length > 0
  );

// Texto do perfil no topo: "Gestor (PRO) · Membro (DEV)", "Administrador"...
export const descreverPerfil = (
  contexto?: IContextoAcesso
): string => {

  if (!contexto) {
    return '';
  }

  const global =
    contexto.perfil === 'Funcionario' ? 'Colaborador' : contexto.perfil;

  if (contexto.perfil === 'Administrador') {
    return 'Administrador';
  }

  const gestorEm =
    (contexto.vinculosArea || [])
      .filter(item => item.perfil !== 'Membro')
      .map(item => item.areaNome);

  return gestorEm.length > 0 && contexto.perfil !== 'Gestor'
    ? `${global} · Gestor em ${gestorEm.length === 1 ? gestorEm[0] : `${gestorEm.length} áreas`}`
    : global;
};

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {

  const valor =
    registro[campo];

  if (
    valor === undefined ||
    valor === null
  ) {
    return padrao;
  }

  return (
    String(valor).trim() ||
    padrao
  );
};

const textoFormatado = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {

  const chave =
    `${campo}@OData.Community.Display.V1.FormattedValue`;

  const valor =
    registro[chave];

  if (
    valor !== undefined &&
    valor !== null &&
    String(valor).trim()
  ) {
    return String(
      valor
    ).trim();
  }

  return texto(
    registro,
    campo,
    padrao
  );
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {

  const valor =
    registro[campo];

  if (
    typeof valor ===
    'boolean'
  ) {
    return valor;
  }

  if (
    valor === 1 ||
    valor === '1' ||
    valor === 'true'
  ) {
    return true;
  }

  if (
    valor === 0 ||
    valor === '0' ||
    valor === 'false'
  ) {
    return false;
  }

  return padrao;
};

export const normalizarPerfil = (
  valor: string
): PerfilAcesso => {

  const perfil =
    valor
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      );

  if (
    perfil ===
    'administrador'
  ) {
    return 'Administrador';
  }

  if (
    perfil ===
    'gestor'
  ) {
    return 'Gestor';
  }

  // Aceita "Editor", "Editora" e "Editor de conteúdo".
  if (
    perfil ===
      'editor' ||
    perfil ===
      'editora' ||
    perfil.indexOf(
      'editor de conteudo'
    ) === 0
  ) {
    return 'Editor';
  }

  return 'Funcionario';
};

export class AutorizacaoService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async carregar(
    email: string
  ): Promise<IContextoAcesso> {

    const emailNormalizado =
      email
        .trim()
        .toLowerCase();

    if (!emailNormalizado) {
      throw new Error(
        'E-mail do usuário não informado.'
      );
    }

    const registros =
      await this.dataverse
        .getUsuarioAcessoPorEmail(
          emailNormalizado
        );

    const registro =
      registros[0];

    if (!registro) {
      throw new Error(
        'Seu usuário não está cadastrado no Portal de Treinamentos.'
      );
    }

    const ativo =
      booleano(
        registro,
        'dgt_ativo',
        true
      );

    if (!ativo) {
      throw new Error(
        'Seu usuário está inativo no Portal de Treinamentos.'
      );
    }

    const perfil =
      normalizarPerfil(
        textoFormatado(
          registro,
          'dgt_perfilacesso',
          'Funcionario'
        )
      );

    const admin =
      perfil ===
      'Administrador';

    const usuarioId =
      texto(
        registro,
        'dgt_usuarioid'
      );

    // Papéis por área (falha na leitura não impede o login).
    let vinculosArea: IVinculoAcesso[] = [];

    try {
      const registrosArea =
        await this.dataverse.getUsuariosAreasAdmin();

      const meuId =
        usuarioId.replace(/[{}]/g, '').toLowerCase();

      vinculosArea =
        registrosArea
          .filter(
            item =>
              texto(item, '_dgt_usuario_value').replace(/[{}]/g, '').toLowerCase() === meuId &&
              booleano(item, 'dgt_ativo', true)
          )
          .map(item => ({
            areaId: texto(item, '_dgt_area_value'),
            areaNome:
              texto(item, '_dgt_area_value@OData.Community.Display.V1.FormattedValue') ||
              'Área',
            perfil:
              texto(item, 'dgt_perfilarea@OData.Community.Display.V1.FormattedValue') ||
              (Number(item.dgt_perfilarea) === 100000001
                ? 'Gestor'
                : Number(item.dgt_perfilarea) === 100000002
                  ? 'Administrador da área'
                  : 'Membro')
          }));
    } catch (error) {
      console.error('Não foi possível ler os papéis por área:', error);
    }

    const areasGestor =
      vinculosArea
        .filter(item => item.perfil !== 'Membro')
        .map(item => item.areaId);

    // Módulos liberados (coluna opcional dgt_modulosacesso).
    let modulosPermitidos: ChaveModuloPortal[] | undefined;

    if (!admin && usuarioId) {
      try {
        const lido =
          await this.dataverse.obterRegistro(
            'dgt_usuario',
            usuarioId,
            ['dgt_modulosacesso']
          );
        modulosPermitidos =
          lido && lido.registro
            ? lerModulosAcesso((lido.registro as Record<string, unknown>).dgt_modulosacesso)
            : undefined;
      } catch {
        // Coluna ainda não criada: sem restrição de módulos.
        modulosPermitidos = undefined;
      }
    }

    const gestorOuAdmin =
      perfil ===
        'Gestor' ||
      admin ||
      areasGestor.length > 0;

    // Quem mantém conteúdo (treinamentos, trilhas, avaliações,
    // documentos). O Editor NÃO recebe permissões de gestão de pessoas
    // nem de aprovação.
    const editorOuAdmin =
      perfil ===
        'Editor' ||
      admin;

    return {
      usuarioId,

      nome:
        texto(
          registro,
          'dgt_name'
        ),

      email:
        texto(
          registro,
          'dgt_email',
          emailNormalizado
        ),

      perfil,
      ativo,

      podeGerenciarTreinamentos:
        editorOuAdmin,

      podeGerenciarDocumentos:
        editorOuAdmin,

      // Administrador: todos. Gestor de área: só as suas áreas
      // (a tela "Usuários e acessos" aplica o recorte).
      podeGerenciarUsuarios:
        admin || areasGestor.length > 0 || perfil === 'Gestor',

      podeGerenciarTrilhas:
        editorOuAdmin,

      podeGerenciarAvaliacoes:
        editorOuAdmin,

      podeAtribuirTreinamentos:
        gestorOuAdmin,

      podeVerEquipe:
        gestorOuAdmin,

      podeVerIndicadoresGerenciais:
        gestorOuAdmin,

      vinculosArea,
      areasGestor,
      modulosPermitidos
    };
  }
}
