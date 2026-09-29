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
    // A aba "Histórico" (Meu histórico) foi retirada do menu.
    // O histórico agora é consultado em cada treinamento, pelo botão
    // "Histórico" da Gestão. A página e a rota 'historico' continuam
    // no código: para reexibir a aba, basta restaurar este item:
    //   { pagina: 'historico', label: 'Histórico', icon: 'clock' },
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

// ============================================================
// MENU (ABAS) DO MÓDULO DOCUMENTOS — mesmo padrão de Treinamentos
// ============================================================

const itensDocumentos:
  IItemMenuTreinamento[] = [
    {
      pagina: 'documentos',
      label: 'Visão geral',
      icon: 'home'
    },
    {
      pagina: 'novoDocumento',
      label: 'Novo documento',
      icon: 'filePlus'
    },
    {
      pagina: 'gestaoDocumentos',
      label: 'Gestão',
      icon: 'settings'
    }
  ];

export const obterMenuDocumentos = (
  contexto?: IContextoAcesso
): IItemMenuTreinamento[] =>
  itensDocumentos.filter(
    item =>
      podeAcessarRota(
        item.pagina,
        contexto
      )
  );
