import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  administraModulo
} from '../../utils/modulosPortal';

// ============================================================
// IMPLANTAÇÕES — sessão e permissões
//
// O painel tinha login, usuários, setores e perfis próprios. No
// portal isso deixa de existir: quem entra é quem tem o módulo
// "implantacoes" liberado (Usuários e acessos) e o que cada um faz
// vem do PERFIL NO PORTAL:
//
//   Colaborador (Funcionário)  consulta: carteira, projetos e físico x financeiro
//   Editor                     opera tudo (projetos, faturamento, PMO, campo) + assistente
//   Gestor                     igual ao Editor
//   Administrador / Administrador do módulo
//                              tudo, mais e-mails (relatórios) e importação
//
// As telas de usuários, setores, perfis e histórico do painel não
// recebem permissão de ninguém (ficam ocultas): o cadastro é o do portal.
//
// IMPORTANTE: como no restante do portal, isto organiza a TELA.
// ============================================================

export type AcaoPainel =
  | 'ver'
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'exportar'
  | 'administrar';

export type PermissoesPainel = Record<string, AcaoPainel[]>;

export interface IUsuarioPainel {
  id: string;
  nome: string;
  email: string;
  setor: string;
  setorNome: string;
  perfil: string;
  perfilNome: string;
}

export interface ISessaoPainel {
  ativado: boolean;
  usuario: IUsuarioPainel;
  perms: PermissoesPainel;
}

const TUDO: AcaoPainel[] = ['ver', 'criar', 'editar', 'excluir', 'exportar'];

const operacional = (): PermissoesPainel => ({
  carteira: ['ver', 'exportar'],
  projetos: TUDO.slice(),
  financeiro: TUDO.slice(),
  pmo: TUDO.slice(),
  campo: TUDO.slice(),
  assistente: ['ver']
});

export const ehAdministradorImplantacoes = (
  contexto?: IContextoAcesso
): boolean =>
  !!contexto &&
  administraModulo(contexto.perfil, contexto.modulosAdministrados, 'implantacoes');

export const permissoesImplantacoes = (
  contexto?: IContextoAcesso
): PermissoesPainel => {

  if (!contexto || !contexto.ativo) {
    return {};
  }

  if (ehAdministradorImplantacoes(contexto)) {
    const perms = operacional();
    perms.relatorio = ['ver', 'criar', 'editar', 'administrar'];
    perms.importacao = ['administrar'];
    return perms;
  }

  if (contexto.perfil === 'Editor' || contexto.perfil === 'Gestor') {
    return operacional();
  }

  // Colaborador: só consulta (o antigo perfil "Consulta").
  return {
    carteira: ['ver'],
    projetos: ['ver'],
    financeiro: ['ver']
  };
};

const NOME_PERFIL: Record<string, string> = {
  Funcionario: 'Colaborador (consulta)',
  Editor: 'Editor',
  Gestor: 'Gestor',
  Administrador: 'Administrador'
};

export const sessaoImplantacoes = (
  contexto?: IContextoAcesso
): ISessaoPainel => {

  // O "setor" do painel (usado em Minhas atividades e na auditoria)
  // é a primeira área do usuário no portal.
  const area =
    contexto && contexto.vinculosArea && contexto.vinculosArea.length > 0
      ? contexto.vinculosArea[0]
      : undefined;

  const administra = ehAdministradorImplantacoes(contexto);

  return {
    ativado: true,
    usuario: {
      id: contexto ? contexto.usuarioId : '',
      nome: contexto ? contexto.nome : '',
      email: contexto ? contexto.email : '',
      setor: area ? area.areaId : '',
      setorNome: area ? area.areaNome : '',
      perfil: contexto ? contexto.perfil : '',
      perfilNome: administra
        ? 'Administrador'
        : NOME_PERFIL[contexto ? contexto.perfil : ''] || ''
    },
    perms: permissoesImplantacoes(contexto)
  };
};

export const podeNoPainel = (
  perms: PermissoesPainel,
  recurso: string,
  acao?: string
): boolean =>
  (perms[recurso] || []).indexOf((acao || 'ver') as AcaoPainel) >= 0;

// Funcionalidade (permissão) de cada coleção da base — mesma regra
// do servidor antigo (recurso_de).
export const recursoDaColecao = (
  colecao: string,
  id: string
): string => {

  if (colecao === 'agendaCampo' || colecao === 'agendaSerie') {
    return 'campo';
  }

  if (colecao === 'faturamentos') {
    return 'financeiro';
  }

  if (colecao === 'config' && (id === 'stakeholders' || id === 'equipe')) {
    return 'pmo';
  }

  if (colecao === 'config' && id === 'relatorio') {
    return 'relatorio';
  }

  return 'projetos';
};

// Coleções que o usuário não vê (mesma regra do servidor antigo).
export const colecoesOcultas = (
  perms: PermissoesPainel
): string[] => {

  const ocultas: string[] = [];

  if (!podeNoPainel(perms, 'financeiro')) {
    ocultas.push('faturamentos');
  }

  if (!podeNoPainel(perms, 'campo')) {
    ocultas.push('agendaCampo', 'agendaSerie');
  }

  return ocultas;
};
