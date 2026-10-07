import {
  DataverseService
} from './DataverseService';

import {
  AreaAdminService,
  IAreaAdmin,
  IUsuarioAreaAdmin,
  IUsuarioDisponivelArea,
  PerfilArea
} from './AreaAdminService';

import {
  IContextoAcesso,
  PerfilAcesso
} from './AutorizacaoService';

import {
  ChaveModuloPortal,
  gravarModulosAcesso,
  lerModulosAcesso
} from '../utils/modulosPortal';

// ============================================================
// USUÁRIOS E ACESSOS
//
// Junta, por usuário: perfil global, papéis por área e módulos
// liberados. Aplica o recorte de quem está gerenciando:
//
//   Administrador  → todos os usuários; altera perfil global,
//                    módulos e qualquer papel em qualquer área.
//   Gestor de área → só os usuários das áreas em que é Gestor (ou
//                    Administrador da área); inclui/retira pessoas
//                    dessas áreas e define Membro ou Gestor nelas.
//                    Não altera perfil global nem módulos (valem
//                    para o portal inteiro, não só para a área).
//
// Gravação reaproveita o AreaAdminService (mesmas regras da tela
// "Áreas e acessos").
// ============================================================

export interface IUsuarioAcesso {
  usuario: IUsuarioDisponivelArea;
  vinculos: IUsuarioAreaAdmin[];
  modulos?: ChaveModuloPortal[];
}

export interface IDadosUsuariosAcessos {
  usuarios: IUsuarioAcesso[];
  areas: IAreaAdmin[];
  // Áreas que quem está logado pode gerenciar.
  areasGerenciaveis: IAreaAdmin[];
  // false = a coluna dgt_modulosacesso ainda não existe no Dataverse.
  modulosDisponiveis: boolean;
}

const guid = (
  valor?: string
): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export class UsuariosAcessosService {

  private readonly dataverse: DataverseService;
  private readonly areas: AreaAdminService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
    this.areas = new AreaAdminService(dataverse);
  }

  public ehAdministrador(
    contexto?: IContextoAcesso
  ): boolean {
    return !!contexto && contexto.perfil === 'Administrador';
  }

  public async carregar(
    contexto?: IContextoAcesso
  ): Promise<IDadosUsuariosAcessos> {

    const [usuarios, vinculos, areas] =
      await Promise.all([
        this.areas.listarUsuarios(),
        this.areas.listarUsuariosArea(),
        this.areas.listarAreas()
      ]);

    // Módulos (coluna opcional).
    let modulosDisponiveis = true;
    const modulosPorUsuario: { [id: string]: ChaveModuloPortal[] | undefined } = {};

    try {
      const registros =
        await this.dataverse.listarRegistros(
          'dgt_usuario',
          '$select=dgt_usuarioid,dgt_modulosacesso'
        );
      registros.forEach(registro => {
        modulosPorUsuario[guid(String(registro.dgt_usuarioid || ''))] =
          lerModulosAcesso(registro.dgt_modulosacesso);
      });
    } catch {
      modulosDisponiveis = false;
    }

    const admin =
      this.ehAdministrador(contexto);

    const minhasAreas =
      (contexto?.areasGestor || []).map(guid);

    const areasGerenciaveis =
      admin
        ? areas
        : areas.filter(area => minhasAreas.indexOf(guid(area.id)) >= 0);

    const idsGerenciaveis =
      areasGerenciaveis.map(area => guid(area.id));

    const lista: IUsuarioAcesso[] =
      usuarios.map(usuario => ({
        usuario,
        vinculos: vinculos.filter(item => guid(item.usuarioId) === guid(usuario.id)),
        modulos: modulosPorUsuario[guid(usuario.id)]
      }));

    // Gestor: só quem está (ativo ou não) em uma das suas áreas.
    const visiveis =
      admin
        ? lista
        : lista.filter(item =>
          item.vinculos.some(vinculo => idsGerenciaveis.indexOf(guid(vinculo.areaId)) >= 0)
        );

    return {
      usuarios: visiveis,
      areas,
      areasGerenciaveis,
      modulosDisponiveis
    };
  }

  // Somente o Administrador cadastra pessoas nas áreas e altera
  // papéis (regra do portal: Editor e Gestor não gerenciam acessos).
  public podeGerenciarArea(
    contexto: IContextoAcesso | undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _areaId: string
  ): boolean {
    return this.ehAdministrador(contexto);
  }

  public async definirPerfilGlobal(
    contexto: IContextoAcesso | undefined,
    usuarioId: string,
    perfil: PerfilAcesso
  ): Promise<void> {
    if (!this.ehAdministrador(contexto)) {
      throw new Error('Somente administradores alteram o perfil do portal.');
    }
    await this.areas.definirPerfilAcesso(usuarioId, perfil);
  }

  public async definirModulos(
    contexto: IContextoAcesso | undefined,
    usuarioId: string,
    modulos: ChaveModuloPortal[] | undefined
  ): Promise<void> {

    if (!this.ehAdministrador(contexto)) {
      throw new Error('Somente administradores alteram os módulos liberados.');
    }

    try {
      await this.dataverse.atualizarRegistro(
        'dgt_usuario',
        usuarioId,
        { dgt_modulosacesso: gravarModulosAcesso(modulos) }
      );
    } catch (error) {
      throw new Error(
        'Não foi possível gravar os módulos. Confira se a coluna "Módulos de acesso" ' +
        '(dgt_modulosacesso) foi criada na tabela Usuário do Dataverse. ' +
        `Detalhe: ${(error as Error).message}`
      );
    }
  }

  public async salvarVinculo(
    contexto: IContextoAcesso | undefined,
    dados: {
      id?: string;
      usuarioId: string;
      areaId: string;
      perfil: PerfilArea;
      ativo: boolean;
    }
  ): Promise<void> {

    if (!this.podeGerenciarArea(contexto, dados.areaId)) {
      throw new Error('Somente administradores incluem pessoas nas áreas e alteram papéis.');
    }

    if (dados.perfil === 'Administrador da área' && !this.ehAdministrador(contexto)) {
      throw new Error('Somente administradores definem "Administrador da área".');
    }

    if (dados.id) {
      await this.areas.editarUsuarioArea({ ...dados, id: dados.id });
    } else {
      await this.areas.vincularUsuario(dados);
    }
  }
}
