import {
  IContextoAcesso,
  PerfilAcesso
} from './AutorizacaoService';

import {
  MODULOS_PORTAL,
  moduloDaPagina,
  moduloLiberado
} from '../utils/modulosPortal';

// ============================================================
// PERMISSÃO DE ROTAS DO PORTAL
//
// O modelo anterior usava "peso" (Funcionário < Gestor < Administrador).
// Com o perfil Editor isso deixou de funcionar, porque o Editor não
// está "acima" nem "abaixo" do Gestor: ele mantém conteúdo, mas não
// acompanha equipe nem aprova. Por isso cada rota agora lista
// explicitamente os perfis que podem acessá-la.
//
// Rotas que NÃO estão na lista são tratadas como públicas.
//
// IMPORTANTE: isto organiza a TELA. A proteção real dos dados está nas
// Security Roles do Dataverse.
// ============================================================

export interface IResultadoPermissaoRota {
  permitido: boolean;
  mensagem?: string;
}

// Mantido para compatibilidade com código que ainda importe o tipo.
export type NivelAcessoRota =
  | 'Publica'
  | 'Funcionario'
  | 'Gestor'
  | 'Administrador';

interface IRegraRota {
  rota: string;
  perfis: PerfilAcesso[];
}

const TODOS: PerfilAcesso[] = [
  'Funcionario',
  'Editor',
  'Gestor',
  'Administrador'
];

const CONTEUDO: PerfilAcesso[] = [
  'Editor',
  'Administrador'
];

// Acompanhar equipe, atribuir e ver conformidade: Gestor e Editor
// (cada um no seu escopo de áreas) e Administrador.
const ACOMPANHAR_PESSOAS: PerfilAcesso[] = [
  'Editor',
  'Gestor',
  'Administrador'
];

const SOMENTE_ADMIN: PerfilAcesso[] = [
  'Administrador'
];

// Módulo Licitações (consulta pública ao PNCP): qualquer perfil, desde
// que o MÓDULO esteja liberado ao usuário (Usuários e acessos). Por
// padrão o módulo NÃO é liberado (utils/modulosPortal.ts).
const LICITACOES: PerfilAcesso[] = [
  'Funcionario',
  'Editor',
  'Gestor',
  'Administrador'
];

const regras:
  IRegraRota[] = [

    // Todos os perfis
    { rota: 'inicio', perfis: TODOS },
    { rota: 'treinamentosVisaoGeral', perfis: TODOS },
    { rota: 'treinamentos', perfis: TODOS },
    { rota: 'trilhas', perfis: TODOS },
    { rota: 'documentos', perfis: TODOS },
    { rota: 'documentoDetalhe', perfis: TODOS },
    { rota: 'historico', perfis: TODOS },
    { rota: 'certificados', perfis: TODOS },
    { rota: 'executarTreinamento', perfis: TODOS },
    { rota: 'executarModulo', perfis: TODOS },
    { rota: 'avaliacao', perfis: TODOS },
    { rota: 'suporte', perfis: TODOS },

    // Módulo Processos (modo de teste). Todos consultam; somente
    // Editor e Administrador alteram fluxos (controlado na tela).
    { rota: 'processos', perfis: TODOS },

    // Acompanhamento de pessoas (Editor, Gestor e Administrador; o
    // recorte pelas áreas de cada um é aplicado nos dados).
    { rota: 'equipe', perfis: ACOMPANHAR_PESSOAS },
    { rota: 'atribuirTreinamento', perfis: ACOMPANHAR_PESSOAS },
    { rota: 'gestaoConformidade', perfis: ACOMPANHAR_PESSOAS },

    // Indicadores: a entrada é controlada pelo MÓDULO (Usuários e
    // acessos). O que cada perfil vê lá dentro é tratado na página.
    { rota: 'indicadores', perfis: TODOS },

    // Cadastro de documentos: quem mantém conteúdo (Editor e
    // Administrador). O Gestor aprova, não cria.
    { rota: 'novoDocumento', perfis: CONTEUDO },

    // Gestão de conteúdo (Editor e Administrador)
    { rota: 'gestao', perfis: CONTEUDO },
    { rota: 'novoTreinamento', perfis: CONTEUDO },
    { rota: 'gestaoTrilhas', perfis: CONTEUDO },
    { rota: 'gestaoModulos', perfis: CONTEUDO },
    { rota: 'gestaoAvaliacoes', perfis: CONTEUDO },
    { rota: 'gestaoDocumentos', perfis: CONTEUDO },

    // Catálogo e modo de teste (visão do colaborador, sem registros).
    // Para liberar só ao Administrador, troque CONTEUDO por SOMENTE_ADMIN.
    { rota: 'catalogoTreinamentos', perfis: CONTEUDO },
    { rota: 'testeTreinamento', perfis: CONTEUDO },

    // Somente Administrador
    // (antes não havia regra para esta rota, o que a tornava pública)
    { rota: 'gestaoAreas', perfis: SOMENTE_ADMIN },

    // Usuários e acessos: somente Administrador
    { rota: 'usuariosAcessos', perfis: SOMENTE_ADMIN },

    // Licitações (PNCP)

    { rota: 'licitacoes', perfis: LICITACOES },
    { rota: 'licitacoesTeste', perfis: LICITACOES }
  ];

const mensagemNegado = (
  perfis: PerfilAcesso[]
): string => {

  if (
    perfis.length === 1 &&
    perfis[0] === 'Administrador'
  ) {
    return 'Esta área é restrita aos administradores do Portal de Treinamentos.';
  }

  if (
    perfis.indexOf('Editor') >= 0 &&
    perfis.indexOf('Gestor') >= 0 &&
    perfis.indexOf('Funcionario') < 0
  ) {
    return 'Esta área é destinada a editores, gestores e administradores.';
  }

  if (
    perfis.indexOf('Editor') >= 0 &&
    perfis.indexOf('Gestor') < 0
  ) {
    return 'Esta área é destinada aos editores de conteúdo e administradores.';
  }

  if (
    perfis.indexOf('Gestor') >= 0 &&
    perfis.indexOf('Editor') < 0
  ) {
    return 'Esta área é destinada a gestores e administradores.';
  }

  return 'Seu perfil não possui permissão para acessar esta área.';
};

export const verificarPermissaoRota = (
  rota: string,
  contexto?: IContextoAcesso
): IResultadoPermissaoRota => {

  // Módulo não liberado para o usuário (Administrador sempre acessa).
  const modulo =
    moduloDaPagina(rota);

  if (
    modulo &&
    contexto &&
    !moduloLiberado(contexto.perfil, contexto.modulosPermitidos, modulo)
  ) {
    const nome =
      (MODULOS_PORTAL.find(item => item.chave === modulo) || { nome: modulo }).nome;
    return {
      permitido: false,
      mensagem: `O módulo ${nome} não está liberado para o seu usuário. Fale com o gestor da sua área ou com um administrador.`
    };
  }

  const regra =
    regras.find(
      item =>
        item.rota ===
        rota
    );

  if (!regra) {
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

  // Gestor de alguma área conta como "Gestor" e Editor de alguma
  // área conta como "Editor" (o recorte pelas áreas é feito nos dados).
  const perfisEfetivos: PerfilAcesso[] =
    [contexto.perfil];

  if (contexto.perfil !== 'Administrador') {
    if ((contexto.areasGestor || []).length > 0) {
      perfisEfetivos.push('Gestor');
    }
    if ((contexto.areasEditor || []).length > 0) {
      perfisEfetivos.push('Editor');
    }
  }

  if (
    perfisEfetivos.some(
      perfil => regra.perfis.indexOf(perfil) >= 0
    )
  ) {
    return {
      permitido: true
    };
  }

  return {
    permitido: false,
    mensagem:
      mensagemNegado(
        regra.perfis
      )
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
