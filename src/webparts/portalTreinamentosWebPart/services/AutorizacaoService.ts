import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

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
// IMPORTANTE: isto organiza a TELA. A proteção real dos dados está nas
// Security Roles do Dataverse (DGT - Treinamentos - <Perfil>).
// ============================================================

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
}

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

    const gestorOuAdmin =
      perfil ===
        'Gestor' ||
      admin;

    // Quem mantém conteúdo (treinamentos, trilhas, avaliações,
    // documentos). O Editor NÃO recebe permissões de gestão de pessoas
    // nem de aprovação.
    const editorOuAdmin =
      perfil ===
        'Editor' ||
      admin;

    return {
      usuarioId:
        texto(
          registro,
          'dgt_usuarioid'
        ),

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

      podeGerenciarUsuarios:
        admin,

      podeGerenciarTrilhas:
        editorOuAdmin,

      podeGerenciarAvaliacoes:
        editorOuAdmin,

      podeAtribuirTreinamentos:
        gestorOuAdmin,

      podeVerEquipe:
        gestorOuAdmin,

      podeVerIndicadoresGerenciais:
        gestorOuAdmin
    };
  }
}
