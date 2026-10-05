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
// "licitacoes"]). Vazio ou coluna inexistente = módulos PADRÃO
// (os marcados com padrao: true). Licitações não é padrão: só
// aparece para quem tiver o módulo liberado explicitamente.
//
// O Administrador sempre acessa todos os módulos.
//
// ESTA é a única regra de módulo do portal: o menu, as rotas
// (RoutePermissionService), "Meu perfil" e "Usuários e acessos"
// usam modulosEfetivos/moduloLiberado daqui.
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
  // Liberado para todos quando o usuário não tem lista própria.
  padrao: boolean;
}

export const MODULOS_PORTAL: IModuloPortal[] = [
  { chave: 'treinamentos', nome: 'Treinamentos', descricao: 'Trilhas, cursos, avaliações, certificados e gestão de treinamentos.', padrao: true },
  { chave: 'documentos', nome: 'Documentos', descricao: 'Procedimentos, políticas, revisões e aprovações.', padrao: true },
  { chave: 'processos', nome: 'Processos', descricao: 'Mapeamento de processos e fluxos de revisão.', padrao: true },
  { chave: 'licitacoes', nome: 'Licitações', descricao: 'Busca de oportunidades no PNCP. Liberar só para quem trabalha com licitações.', padrao: false },
  { chave: 'indicadores', nome: 'Indicadores', descricao: 'Indicadores consolidados (Power BI).', padrao: true }
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

export const MODULOS_PADRAO: ChaveModuloPortal[] =
  MODULOS_PORTAL.filter(item => item.padrao).map(item => item.chave);

const mesmoConjunto = (
  a: ChaveModuloPortal[],
  b: ChaveModuloPortal[]
): boolean =>
  a.length === b.length && a.every(item => b.indexOf(item) >= 0);

// Módulos que o usuário realmente acessa.
export const modulosEfetivos = (
  perfil: string | undefined,
  modulos: ChaveModuloPortal[] | undefined
): ChaveModuloPortal[] =>
  perfil === 'Administrador'
    ? MODULOS_PORTAL.map(item => item.chave)
    : (modulos && modulos.length > 0 ? modulos : MODULOS_PADRAO);

export const moduloLiberado = (
  perfil: string | undefined,
  modulos: ChaveModuloPortal[] | undefined,
  chave: ChaveModuloPortal
): boolean =>
  modulosEfetivos(perfil, modulos).indexOf(chave) >= 0;

// Igual ao padrão → grava vazio (segue o padrão se ele mudar).
export const gravarModulosAcesso = (
  modulos: ChaveModuloPortal[] | undefined
): string =>
  modulos && modulos.length > 0 && !mesmoConjunto(modulos, MODULOS_PADRAO)
    ? JSON.stringify(modulos)
    : '';
