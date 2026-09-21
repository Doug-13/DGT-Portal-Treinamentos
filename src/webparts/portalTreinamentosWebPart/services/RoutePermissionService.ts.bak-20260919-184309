import {
  IContextoAcesso
} from './AutorizacaoService';

export interface IResultadoPermissaoRota {
  permitido: boolean;
  mensagem?: string;
}

export type NivelAcessoRota =
  | 'Publica'
  | 'Funcionario'
  | 'Gestor'
  | 'Administrador';

interface IRegraRota {
  rota: string;
  nivel: NivelAcessoRota;
}

const regras:
  IRegraRota[] = [

    // Funcionário
    { rota: 'inicio', nivel: 'Funcionario' },
    { rota: 'treinamentos', nivel: 'Funcionario' },
    { rota: 'trilhas', nivel: 'Funcionario' },
    { rota: 'documentos', nivel: 'Funcionario' },
    { rota: 'documentoDetalhe', nivel: 'Funcionario' },
    { rota: 'historico', nivel: 'Funcionario' },
    { rota: 'certificados', nivel: 'Funcionario' },
    { rota: 'executarTreinamento', nivel: 'Funcionario' },
    { rota: 'avaliacao', nivel: 'Funcionario' },
    { rota: 'suporte', nivel: 'Funcionario' },

    // Gestor
    { rota: 'equipe', nivel: 'Gestor' },
    { rota: 'atribuirTreinamento', nivel: 'Gestor' },
    { rota: 'gestaoConformidade', nivel: 'Gestor' },
    { rota: 'indicadores', nivel: 'Gestor' },

    // Administrador
    { rota: 'gestao', nivel: 'Administrador' },
    { rota: 'novoTreinamento', nivel: 'Administrador' },
    { rota: 'gestaoTrilhas', nivel: 'Administrador' },
    { rota: 'gestaoModulos', nivel: 'Administrador' },
    { rota: 'gestaoAvaliacoes', nivel: 'Administrador' },
    { rota: 'gestaoDocumentos', nivel: 'Administrador' }
  ];

const pesoPerfil = (
  perfil:
    IContextoAcesso['perfil']
): number => {

  switch (perfil) {

    case 'Administrador':
      return 3;

    case 'Gestor':
      return 2;

    case 'Funcionario':
    default:
      return 1;
  }
};

const pesoNivel = (
  nivel:
    NivelAcessoRota
): number => {

  switch (nivel) {

    case 'Administrador':
      return 3;

    case 'Gestor':
      return 2;

    case 'Funcionario':
      return 1;

    case 'Publica':
    default:
      return 0;
  }
};

export const verificarPermissaoRota = (
  rota: string,
  contexto?: IContextoAcesso
): IResultadoPermissaoRota => {

  const regra =
    regras.find(
      item =>
        item.rota ===
        rota
    );

  if (
    !regra ||
    regra.nivel ===
      'Publica'
  ) {
    return {
      permitido: true
    };
  }

  if (!contexto) {
    return {
      permitido: false,
      mensagem:
        'Não foi possível identificar as permissões do usuário.'
    };
  }

  if (!contexto.ativo) {
    return {
      permitido: false,
      mensagem:
        'Seu usuário está inativo no Portal de Treinamentos.'
    };
  }

  const permitido =
    pesoPerfil(
      contexto.perfil
    ) >=
    pesoNivel(
      regra.nivel
    );

  if (permitido) {
    return {
      permitido: true
    };
  }

  return {
    permitido: false,
    mensagem:
      regra.nivel ===
        'Administrador'
        ? 'Esta área é restrita aos administradores do Portal de Treinamentos.'
        : 'Esta área é destinada a gestores e administradores.'
  };
};

export const podeAcessarRota = (
  rota: string,
  contexto?: IContextoAcesso
): boolean =>
  verificarPermissaoRota(
    rota,
    contexto
  ).permitido;
