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

  return valor === undefined ||
    valor === null
      ? padrao
      : String(valor);
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {

  const valor =
    registro[campo];

  if (typeof valor === 'boolean') {
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

  const normalizado =
    valor
      .trim()
      .toLowerCase();

  if (
    normalizado === 'administrador' ||
    normalizado === 'admin' ||
    normalizado === 'rh'
  ) {
    return 'Administrador';
  }

  if (
    normalizado === 'gestor' ||
    normalizado === 'manager'
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

  public async obterContexto(
    email:
      string
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
        'Usuário não cadastrado no Portal de Treinamentos.'
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
        'Usuário inativo no Portal de Treinamentos.'
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

    return {
      usuarioId:
        texto(
          registro,
          'dgt_usuarioid'
        ),

      nome:
        texto(
          registro,
          'dgt_name',
          'Usuário'
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
        perfil ===
        'Administrador',

      podeGerenciarDocumentos:
        perfil ===
        'Administrador',

      podeGerenciarUsuarios:
        perfil ===
        'Administrador',

      podeAtribuirTreinamentos:
        perfil ===
          'Administrador' ||
        perfil ===
          'Gestor',

      podeVerEquipe:
        perfil ===
          'Administrador' ||
        perfil ===
          'Gestor',

      podeVerIndicadoresGerenciais:
        perfil ===
          'Administrador' ||
        perfil ===
          'Gestor'
    };
  }
}
