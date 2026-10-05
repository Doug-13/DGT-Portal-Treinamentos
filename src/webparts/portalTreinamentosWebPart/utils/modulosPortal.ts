import {
  Pagina
} from '../constants/routes';

import {
  obterModuloPagina
} from '../constants/moduleRoutes';

// ============================================================
// MÓDULOS DO PORTAL (controle de acesso por usuário)
//
// Cada usuário pode ter uma lista de módulos liberados, gravada em
// dgt_usuario.dgt_modulosacesso (texto JSON, ex.: ["treinamentos",
// "documentos"]). Lista vazia ou coluna inexistente = TODOS os
// módulos que o perfil permite (comportamento anterior).
//
// O Administrador sempre acessa todos os módulos.
// ============================================================

export type ChaveModuloPortal =
  | 'treinamentos'
  | 'documentos'
  | 'processos'
  | 'licitacoes'
  | 'indicadores';

export interface IModuloPortal {
  chave: ChaveModuloPortal;
  nome: string;
  descricao: string;
}

export const MODULOS_PORTAL: IModuloPortal[] = [
  { chave: 'treinamentos', nome: 'Treinamentos', descricao: 'Trilhas, cursos, avaliações, certificados e gestão de treinamentos.' },
  { chave: 'documentos', nome: 'Documentos', descricao: 'Procedimentos, políticas, revisões e aprovações.' },
  { chave: 'processos', nome: 'Processos', descricao: 'Mapeamento de processos e fluxos de revisão.' },
  { chave: 'licitacoes', nome: 'Licitações', descricao: 'Busca de oportunidades no PNCP.' },
  { chave: 'indicadores', nome: 'Indicadores', descricao: 'Indicadores consolidados (Power BI).' }
];

// Módulo a que uma página pertence (undefined = página geral, sempre
// acessível: Início, Meu perfil, Ajuda...).
export const moduloDaPagina = (
  pagina: Pagina | string
): ChaveModuloPortal | undefined => {

  if (pagina === 'indicadores') {
    return 'indicadores';
  }

  const modulo =
    obterModuloPagina(pagina as Pagina);

  return modulo === 'outro' || (modulo as string) === 'inicio'
    ? undefined
    : modulo as ChaveModuloPortal;
};

// Lê o JSON gravado no Dataverse. Inválido/vazio = sem restrição.
export const lerModulosAcesso = (
  valor: unknown
): ChaveModuloPortal[] | undefined => {

  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return undefined;
  }

  try {
    const lista = JSON.parse(String(valor));
    if (!Array.isArray(lista)) {
      return undefined;
    }
    const validas = MODULOS_PORTAL.map(item => item.chave as string);
    const filtrada = lista
      .map(item => String(item))
      .filter(item => validas.indexOf(item) >= 0) as ChaveModuloPortal[];
    return filtrada.length > 0 ? filtrada : undefined;
  } catch {
    return undefined;
  }
};

export const gravarModulosAcesso = (
  modulos: ChaveModuloPortal[] | undefined
): string =>
  modulos && modulos.length > 0 && modulos.length < MODULOS_PORTAL.length
    ? JSON.stringify(modulos)
    : '';
