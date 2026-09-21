import {
  Pagina
} from '../constants/routes';

import {
  IContextoAcesso
} from './AutorizacaoService';

import {
  podeAcessarRota
} from './RoutePermissionService';

export interface IItemMenuTreinamento {
  pagina: Pagina;
  label: string;
  icon: string;
}

const todosItens:
  IItemMenuTreinamento[] = [
    {
      pagina: 'treinamentosVisaoGeral',
      label: 'Visão geral',
      icon: '⌂'
    },
    {
      pagina: 'treinamentos',
      label: 'Meus treinamentos',
      icon: '▶'
    },
    {
      pagina: 'trilhas',
      label: 'Trilhas',
      icon: '▰'
    },
    {
      pagina: 'historico',
      label: 'Histórico',
      icon: '◷'
    },
    {
      pagina: 'certificados',
      label: 'Certificados',
      icon: '▣'
    },
    {
      pagina: 'equipe',
      label: 'Minha equipe',
      icon: '♟'
    },
    {
      pagina: 'gestaoConformidade',
      label: 'Conformidade',
      icon: '◉'
    },
    {
      pagina: 'gestao',
      label: 'Gestão',
      icon: '⚙'
    }
  ];

export const obterMenuTreinamento = (
  contexto?: IContextoAcesso
): IItemMenuTreinamento[] =>
  todosItens.filter(
    item =>
      podeAcessarRota(
        item.pagina,
        contexto
      )
  );

