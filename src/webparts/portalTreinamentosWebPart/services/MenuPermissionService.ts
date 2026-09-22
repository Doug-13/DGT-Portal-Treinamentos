import {
  Pagina
} from '../constants/routes';

import {
  IContextoAcesso
} from './AutorizacaoService';

import {
  podeAcessarRota
} from './RoutePermissionService';

import {
  IconeChave
} from '../components/common/Icones';

export interface IItemMenuTreinamento {
  pagina: Pagina;
  label: string;
  // Chave de um ícone SVG (ver components/common/Icones.tsx),
  // não mais um caractere Unicode — glifos como ⌂ ▰ ◷ ♟ dependem
  // da fonte carregada e ficam invisíveis/monocromáticos.
  icon: IconeChave;
}

const todosItens:
  IItemMenuTreinamento[] = [
    {
      pagina: 'treinamentosVisaoGeral',
      label: 'Visão geral',
      icon: 'home'
    },
    {
      pagina: 'treinamentos',
      label: 'Meus treinamentos',
      icon: 'play'
    },
    {
      pagina: 'trilhas',
      label: 'Trilhas',
      icon: 'layers'
    },
    {
      pagina: 'historico',
      label: 'Histórico',
      icon: 'clock'
    },
    {
      pagina: 'certificados',
      label: 'Certificados',
      icon: 'award'
    },
    {
      pagina: 'equipe',
      label: 'Minha equipe',
      icon: 'users'
    },
    {
      pagina: 'gestaoConformidade',
      label: 'Conformidade',
      icon: 'checkCircle'
    },
    {
      pagina: 'gestao',
      label: 'Gestão',
      icon: 'settings'
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