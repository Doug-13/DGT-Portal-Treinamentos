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
// ADMINISTRADOR DO MÓDULO: na mesma lista, entradas "admin:<módulo>"
// (ex.: ["treinamentos","documentos","admin:treinamentos"]). Quem
// administra um módulo tem, SÓ nele, os poderes do Administrador
// global (todas as áreas, aprovações, telas de administração). Usuários
// e acessos, Áreas e configurações do portal continuam só com o
// Administrador global. Listas antigas (sem "admin:") continuam valendo.
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
  | 'arquitetura'
  | 'indicadores'
  | 'orcamento'
  | 'rh'
  | 'kits'
  | 'hh';

export interface IModuloPortal {
  chave: ChaveModuloPortal;
  nome: string;
  descricao: string;
  // Liberado para todos quando o usuário não tem lista própria.
  padrao: boolean;
  padraoPerfis?: string[];
}

export const MODULOS_PORTAL: IModuloPortal[] = [
  { chave: 'treinamentos', nome: 'Treinamentos', descricao: 'Trilhas, cursos, avaliações, certificados e gestão de treinamentos.', padrao: true },
  { chave: 'documentos', nome: 'Documentos', descricao: 'Procedimentos, políticas, revisões e aprovações.', padrao: true },
  { chave: 'processos', nome: 'Processos', descricao: 'Mapeamento de processos e fluxos de revisão.', padrao: true },
  { chave: 'licitacoes', nome: 'Licitações', descricao: 'Busca de oportunidades no PNCP. Liberar só para quem trabalha com licitações.', padrao: false },
  { chave: 'arquitetura', nome: 'Arquitetura de Soluções', descricao: 'Demandas, Matriz Go/No-Go e B.O.M. Liberar para a equipe de Arquitetura.', padrao: false },
  { chave: 'indicadores', nome: 'Indicadores', descricao: 'Indicadores consolidados (Power BI). Dados sensíveis: Colaborador e Editor só com liberação.', padrao: false, padraoPerfis: ['Gestor', 'Administrador'] },
  { chave: 'orcamento', nome: 'Planejamento orçamentário', descricao: 'Planilha de orçamento anual. Cada um vê só a sua; o Administrador vê todas. Padrão para Gestor; demais só com liberação.', padrao: false, padraoPerfis: ['Gestor', 'Administrador'] },
  { chave: 'kits', nome: 'Kits (catálogo do B.O.M.)', descricao: 'Equipamentos homologados, composição dos kits e regras do montador de B.O.M. Liberar para Arquitetura (consulta). Alterar: Administrador do módulo.', padrao: false, padraoPerfis: ['Administrador'] },
  { chave: 'hh', nome: 'Cálculo de HH', descricao: 'Homem-hora por área (Implantação, Suporte...) com as fórmulas das planilhas de HH. A versão vigente alimenta o B.O.M. Alterar: Administrador do módulo.', padrao: false, padraoPerfis: ['Administrador'] },
  { chave: 'rh', nome: 'RH e Pessoas', descricao: 'Certificados e validades de todos os colaboradores. Liberar só para o RH.', padrao: false, padraoPerfis: ['Administrador'] }
];

// Módulo a que uma página pertence (undefined = página geral, sempre
// acessível: Início, Meu perfil, Ajuda...).
export const moduloDaPagina = (
  pagina: Pagina | string
): ChaveModuloPortal | undefined => {

  if (pagina === 'indicadores') {
    return 'indicadores';
  }

  if (pagina === 'planejamentoOrcamentario') {
    return 'orcamento';
  }

  if (pagina === 'rhPessoas') {
    return 'rh';
  }

  if (pagina === 'kits') {
    return 'kits';
  }

  if (pagina === 'calculoHH') {
    return 'hh';
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

export const PREFIXO_ADMIN_MODULO = 'admin:';

// Módulos que o usuário ADMINISTRA (entradas "admin:<módulo>").
export const lerModulosAdministrados = (
  valor: unknown
): ChaveModuloPortal[] => {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return [];
  }
  try {
    const lista = JSON.parse(String(valor));
    if (!Array.isArray(lista)) {
      return [];
    }
    const validas = MODULOS_PORTAL.map(item => item.chave as string);
    return lista
      .map(item => String(item))
      .filter(item => item.indexOf(PREFIXO_ADMIN_MODULO) === 0)
      .map(item => item.substring(PREFIXO_ADMIN_MODULO.length))
      .filter((item, indice, todos) => validas.indexOf(item) >= 0 && todos.indexOf(item) === indice) as ChaveModuloPortal[];
  } catch {
    return [];
  }
};

// Administrador global ou administrador deste módulo?
export const administraModulo = (
  perfil: string | undefined,
  administrados: ChaveModuloPortal[] | undefined,
  chave: ChaveModuloPortal
): boolean =>
  perfil === 'Administrador' || (administrados || []).indexOf(chave) >= 0;

export const MODULOS_PADRAO: ChaveModuloPortal[] =
  MODULOS_PORTAL.filter(item => item.padrao).map(item => item.chave);

const mesmoConjunto = (
  a: ChaveModuloPortal[],
  b: ChaveModuloPortal[]
): boolean =>
  a.length === b.length && a.every(item => b.indexOf(item) >= 0);

// Módulos padrão de um perfil (quando o usuário não tem lista própria).
export const modulosPadraoDoPerfil = (
  perfil: string | undefined
): ChaveModuloPortal[] =>
  MODULOS_PORTAL
    .filter(item => item.padrao || (!!perfil && (item.padraoPerfis || []).indexOf(perfil) >= 0))
    .map(item => item.chave);

export const modulosEfetivos = (
  perfil: string | undefined,
  modulos: ChaveModuloPortal[] | undefined
): ChaveModuloPortal[] =>
  perfil === 'Administrador'
    ? MODULOS_PORTAL.map(item => item.chave)
    : (modulos && modulos.length > 0 ? modulos : modulosPadraoDoPerfil(perfil));

export const moduloLiberado = (
  perfil: string | undefined,
  modulos: ChaveModuloPortal[] | undefined,
  chave: ChaveModuloPortal
): boolean =>
  modulosEfetivos(perfil, modulos).indexOf(chave) >= 0;

// Igual ao padrão → grava vazio (segue o padrão se ele mudar).
export const gravarModulosAcesso = (
  modulos: ChaveModuloPortal[] | undefined,
  // Módulos que o usuário administra (ficam como "admin:<módulo>" e o
  // módulo também entra na lista de liberados).
  administrados?: ChaveModuloPortal[]
): string => {
  const admins = (administrados || []).filter((item, indice, lista) => lista.indexOf(item) === indice);
  if (admins.length > 0) {
    const liberados = (modulos && modulos.length > 0 ? modulos : MODULOS_PADRAO).slice();
    admins.forEach(chave => {
      if (liberados.indexOf(chave) < 0) {
        liberados.push(chave);
      }
    });
    return JSON.stringify((liberados as string[]).concat(admins.map(chave => `${PREFIXO_ADMIN_MODULO}${chave}`)));
  }
  return modulos && modulos.length > 0 && !mesmoConjunto(modulos, MODULOS_PADRAO)
    ? JSON.stringify(modulos)
    : '';
};
