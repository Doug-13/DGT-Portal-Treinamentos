import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type PerfilAcesso =
  | 'Funcionario'
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

  return String(
    valor
  ).trim() || padrao;
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

const normalizarPerfil = (
  valor: string
): PerfilAcesso => {

  const perfil =
    valor
      .trim()
      .toLowerCase();

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

    if (!email.trim()) {
      throw new Error(
        'E-mail do usuário não informado.'
      );
    }

    const registros =
      await this.dataverse
        .getUsuarioAcessoPorEmail(
          email
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
        texto(
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
          email
        ),

      perfil,
      ativo,

      podeGerenciarTreinamentos:
        admin,

      podeGerenciarDocumentos:
        admin,

      podeGerenciarUsuarios:
        admin,

      podeAtribuirTreinamentos:
        gestorOuAdmin,

      podeVerEquipe:
        gestorOuAdmin,

      podeVerIndicadoresGerenciais:
        gestorOuAdmin
    };
  }
}
