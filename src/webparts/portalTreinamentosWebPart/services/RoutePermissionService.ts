import {
  IContextoAcesso
} from '../services/AutorizacaoService';

export interface IResultadoPermissaoRota {
  permitido: boolean;
  mensagem?: string;
}

const rotasAdministrativas:
  string[] = [
    'gestao',
    'gestaoTreinamentos',
    'novoTreinamento',
    'gestaoTrilhas',
    'gestaoModulos',
    'gestaoAvaliacoes',
    'gestaoDocumentos'
  ];

const rotasGestor:
  string[] = [
    'equipe',
    'atribuirTreinamento',
    'indicadores'
  ];

export const verificarPermissaoRota = (
  rota: string,
  contexto?: IContextoAcesso
): IResultadoPermissaoRota => {

  if (!contexto) {
    return {
      permitido: false,
      mensagem:
        'Não foi possível identificar as permissões do usuário.'
    };
  }

  if (
    rotasAdministrativas.indexOf(
      rota
    ) >= 0 &&
    contexto.perfil !==
      'Administrador'
  ) {
    return {
      permitido: false,
      mensagem:
        'Esta área é restrita aos administradores do Portal de Treinamentos.'
    };
  }

  if (
    rotasGestor.indexOf(
      rota
    ) >= 0 &&
    contexto.perfil ===
      'Funcionario'
  ) {
    return {
      permitido: false,
      mensagem:
        'Esta área é destinada a gestores e administradores.'
    };
  }

  return {
    permitido: true
  };
};
