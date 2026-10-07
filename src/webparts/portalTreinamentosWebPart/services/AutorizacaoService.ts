import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  ChaveModuloPortal,
  lerModulosAcesso
} from '../utils/modulosPortal';

import {
  calcularRegrasAcesso
} from '../utils/regrasAcesso';

// ============================================================
// CONTEXTO DE ACESSO DO USUÁRIO LOGADO
//
// As regras (o que cada perfil, papel por área e módulo libera)
// ficam em utils/regrasAcesso.ts — fonte única usada também pelas
// rotas e pela tela "Usuários e acessos".
//
// IMPORTANTE: isto organiza a TELA. A proteção real dos dados está nas
// Security Roles do Dataverse e nos plugins do servidor.
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

  // Novos (regras de Editor/Gestor por área e módulo)
  podeAprovarDocumentos?: boolean;
  podeGerenciarProcessos?: boolean;
  podeGerenciarDashboards?: boolean;

  // Papéis por área (ativos) e áreas em que o usuário é gestor
  // (Gestor ou Administrador da área) ou editor.
  vinculosArea?: IVinculoAcesso[];
  areasGestor?: string[];
  areasEditor?: string[];

  // Áreas cujas pessoas o usuário acompanha (equipe, atribuição,
  // conformidade). undefined = todas.
  escopoAreas?: string[];

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

// Somente o Administrador cadastra usuários e altera acessos.
export const podeAdministrarAcessos = (
  contexto?: IContextoAcesso
): boolean =>
  !!contexto &&
  contexto.perfil === 'Administrador';

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

  const resumir = (lista: string[]): string =>
    lista.length === 1 ? lista[0] : `${lista.length} áreas`;

  const gestorEm =
    (contexto.vinculosArea || [])
      .filter(item => item.perfil === 'Gestor' || item.perfil === 'Administrador da área')
      .map(item => item.areaNome);

  const editorEm =
    (contexto.vinculosArea || [])
      .filter(item => item.perfil === 'Editor')
      .map(item => item.areaNome);

  const partes: string[] = [global];

  if (gestorEm.length > 0 && contexto.perfil !== 'Gestor') {
    partes.push(`Gestor em ${resumir(gestorEm)}`);
  }

  if (editorEm.length > 0) {
    partes.push(`Editor em ${resumir(editorEm)}`);
  }

  return partes.join(' · ');
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
                  : Number(item.dgt_perfilarea) === 100000003
                    ? 'Editor'
                    : 'Membro')
          }));
    } catch (error) {
      console.error('Não foi possível ler os papéis por área:', error);
    }

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

    const regras =
      calcularRegrasAcesso(
        perfil,
        vinculosArea,
        modulosPermitidos
      );

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
        regras.podeGerenciarTreinamentos,

      podeGerenciarDocumentos:
        regras.podeGerenciarDocumentos,

      podeGerenciarUsuarios:
        regras.podeGerenciarUsuarios,

      podeGerenciarTrilhas:
        regras.podeGerenciarTreinamentos,

      podeGerenciarAvaliacoes:
        regras.podeGerenciarTreinamentos,

      podeAtribuirTreinamentos:
        regras.podeAtribuirTreinamentos,

      podeVerEquipe:
        regras.podeVerEquipe,

      podeVerIndicadoresGerenciais:
        regras.podeVerIndicadoresGerenciais,

      podeAprovarDocumentos:
        regras.podeAprovarDocumentos,

      podeGerenciarProcessos:
        regras.podeGerenciarProcessos,

      podeGerenciarDashboards:
        regras.podeGerenciarDashboards,

      areasGestor:
        regras.areasGestor,

      areasEditor:
        regras.areasEditor,

      escopoAreas:
        regras.escopoAreas,

      vinculosArea,
      modulosPermitidos
    };
  }
}
