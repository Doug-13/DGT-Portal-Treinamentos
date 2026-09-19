import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type PerfilArea =
  | 'Membro'
  | 'Gestor'
  | 'Administrador da área';

export interface IAreaAdmin {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;
}

export interface INovaArea {
  nome: string;
  sigla: string;
  ativa: boolean;
}

export interface IEditarArea extends INovaArea {
  id: string;
}

export interface IUsuarioDisponivelArea {
  id: string;
  nome: string;
  email: string;
}

export interface IUsuarioAreaAdmin {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioEmail: string;
  areaId: string;
  areaNome: string;
  areaSigla: string;
  perfil: PerfilArea;
  ativo: boolean;
}

export interface INovoUsuarioArea {
  usuarioId: string;
  areaId: string;
  perfil: PerfilArea;
  ativo: boolean;
}

export interface IEditarUsuarioArea
  extends INovoUsuarioArea {
  id: string;
}

const PERFIL_AREA: Record<
  PerfilArea,
  number
> = {
  Membro: 100000000,
  Gestor: 100000001,
  'Administrador da área': 100000002
};

const PERFIL_AREA_REVERSO: Record<
  number,
  PerfilArea
> = {
  100000000: 'Membro',
  100000001: 'Gestor',
  100000002: 'Administrador da área'
};

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];

  if (
    valor === undefined ||
    valor === null
  ) {
    return padrao;
  }

  return String(valor).trim() || padrao;
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {
  const valor = registro[campo];

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

const perfilArea = (
  registro: IDataverseRecord
): PerfilArea => {
  const formatado =
    texto(
      registro,
      'dgt_perfilarea@OData.Community.Display.V1.FormattedValue'
    );

  if (
    formatado === 'Membro' ||
    formatado === 'Gestor' ||
    formatado === 'Administrador da área'
  ) {
    return formatado;
  }

  const valor =
    Number(
      registro.dgt_perfilarea ??
      100000000
    );

  return (
    PERFIL_AREA_REVERSO[valor] ||
    'Membro'
  );
};

export class AreaAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async listarAreas():
    Promise<IAreaAdmin[]> {

    const registros =
      await this.dataverse
        .getAreasAdmin();

    return registros
      .map(
        registro => ({
          id:
            texto(
              registro,
              'dgt_areaid'
            ),

          nome:
            texto(
              registro,
              'dgt_name',
              'Área'
            ),

          sigla:
            texto(
              registro,
              'dgt_sigla'
            ),

          ativa:
            booleano(
              registro,
              'dgt_ativo',
              true
            )
        })
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async listarUsuarios():
    Promise<IUsuarioDisponivelArea[]> {

    const registros =
      await this.dataverse
        .getUsuarios();

    return registros
      .map(
        registro => ({
          id:
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
              'dgt_email'
            )
        })
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async listarUsuariosArea():
    Promise<IUsuarioAreaAdmin[]> {

    const [
      vinculos,
      usuarios,
      areas
    ] =
      await Promise.all([
        this.dataverse
          .getUsuariosAreasAdmin(),

        this.listarUsuarios(),

        this.listarAreas()
      ]);

    const usuariosMap =
      new Map(
        usuarios.map(
          usuario => [
            usuario.id,
            usuario
          ]
        )
      );

    const areasMap =
      new Map(
        areas.map(
          area => [
            area.id,
            area
          ]
        )
      );

    return vinculos
      .map(
        registro => {
          const usuarioId =
            texto(
              registro,
              '_dgt_usuario_value'
            );

          const areaId =
            texto(
              registro,
              '_dgt_area_value'
            );

          const usuario =
            usuariosMap.get(
              usuarioId
            );

          const area =
            areasMap.get(
              areaId
            );

          return {
            id:
              texto(
                registro,
                'dgt_usuarioareaid'
              ),

            usuarioId,

            usuarioNome:
              usuario?.nome ||
              'Usuário',

            usuarioEmail:
              usuario?.email ||
              '',

            areaId,

            areaNome:
              area?.nome ||
              'Área',

            areaSigla:
              area?.sigla ||
              '',

            perfil:
              perfilArea(
                registro
              ),

            ativo:
              booleano(
                registro,
                'dgt_ativo',
                true
              )
          };
        }
      )
      .sort(
        (a, b) =>
          a.areaNome.localeCompare(
            b.areaNome,
            'pt-BR'
          ) ||
          a.usuarioNome.localeCompare(
            b.usuarioNome,
            'pt-BR'
          )
      );
  }

  public async criarArea(
    dados: INovaArea
  ): Promise<void> {

    this.validarArea(
      dados
    );

    await this.dataverse
      .criarArea({
        dgt_name:
          dados.nome.trim(),

        dgt_sigla:
          dados.sigla
            .trim()
            .toUpperCase(),

        dgt_ativo:
          dados.ativa
      });
  }

  public async editarArea(
    dados: IEditarArea
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'Área não informada.'
      );
    }

    this.validarArea(
      dados
    );

    await this.dataverse
      .atualizarArea(
        dados.id,
        {
          dgt_name:
            dados.nome.trim(),

          dgt_sigla:
            dados.sigla
              .trim()
              .toUpperCase(),

          dgt_ativo:
            dados.ativa
        }
      );
  }

  public async definirAreaAtiva(
    areaId: string,
    ativa: boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarArea(
        areaId,
        {
          dgt_ativo:
            ativa
        }
      );
  }

  public async vincularUsuario(
    dados: INovoUsuarioArea
  ): Promise<void> {

    this.validarUsuarioArea(
      dados
    );

    await this.dataverse
      .criarUsuarioArea(
        dados.usuarioId,
        dados.areaId,
        {
          dgt_name:
            'Vínculo usuário/área',

          dgt_perfilarea:
            PERFIL_AREA[
              dados.perfil
            ],

          dgt_ativo:
            dados.ativo
        }
      );
  }

  public async editarUsuarioArea(
    dados: IEditarUsuarioArea
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'Vínculo não informado.'
      );
    }

    this.validarUsuarioArea(
      dados
    );

    await this.dataverse
      .atualizarUsuarioArea(
        dados.id,
        {
          dgt_perfilarea:
            PERFIL_AREA[
              dados.perfil
            ],

          dgt_ativo:
            dados.ativo
        }
      );
  }

  public async definirUsuarioAreaAtivo(
    vinculoId: string,
    ativo: boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarUsuarioArea(
        vinculoId,
        {
          dgt_ativo:
            ativo
        }
      );
  }

  private validarArea(
    dados: INovaArea
  ): void {

    if (!dados.nome.trim()) {
      throw new Error(
        'Informe o nome da área.'
      );
    }

    if (!dados.sigla.trim()) {
      throw new Error(
        'Informe a sigla da área.'
      );
    }

    if (
      dados.sigla.trim().length >
      10
    ) {
      throw new Error(
        'A sigla deve possuir no máximo 10 caracteres.'
      );
    }
  }

  private validarUsuarioArea(
    dados: INovoUsuarioArea
  ): void {

    if (!dados.usuarioId) {
      throw new Error(
        'Selecione um usuário.'
      );
    }

    if (!dados.areaId) {
      throw new Error(
        'Selecione uma área.'
      );
    }
  }
}
