import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  administraModulo
} from '../../utils/modulosPortal';

// ============================================================
// IMPLANTAÇÕES — usuários, setores, perfis e permissões
//
// Como no painel original, o acesso é controlado DENTRO do módulo
// (Configurações › Gestão de usuários, Setores, Perfis e permissões):
//
//   - No portal, só o ADMINISTRADOR DO MÓDULO "implantacoes" (ou o
//     Administrador do portal) é configurado. Ele entra sempre, com o
//     perfil Administrador, mesmo sem cadastro no painel.
//   - Ele cadastra os demais pelo e-mail corporativo (o mesmo do
//     login do Microsoft 365), com setor e perfil. Não há senha: quem
//     abre o portal já está identificado.
//   - Quem não está cadastrado (ou está inativo) vê "sem acesso".
//
// Perfis iniciais (os do app original): Administrador, Diretoria /
// Head, Gestão, Analistas / Assistentes / Estagiários e Consulta,
// com as permissões por funcionalidade × ação. O Administrador tem
// sempre tudo. Permissões individuais substituem as do perfil.
//
// Os cadastros ficam em dgt_implregistro (projeto "_root"):
// acessoUsuarios, acessoSetores e acessoPerfis.
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

// Documentos de cadastro (coleções acesso*)
export interface ICadastroUsuario {
  nome: string;
  email: string;
  setor: string;
  perfil: string;
  perms?: PermissoesPainel;
  ativo: boolean;
  criadoEm?: string;
  criadoPor?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  ultimoLogin?: string;
}

export interface ICadastroSetor {
  nome: string;
  ativo: boolean;
  criadoEm?: string;
  criadoPor?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export interface ICadastroPerfil {
  nome: string;
  descricao: string;
  perms: PermissoesPainel;
  sistema?: boolean;
  total?: boolean;
  criadoEm?: string;
  criadoPor?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export interface IAcessos {
  usuarios: Record<string, ICadastroUsuario>;
  setores: Record<string, ICadastroSetor>;
  perfis: Record<string, ICadastroPerfil>;
}

export const COLECAO_USUARIOS = 'acessoUsuarios';
export const COLECAO_SETORES = 'acessoSetores';
export const COLECAO_PERFIS = 'acessoPerfis';

export const COLECOES_ACESSO = [COLECAO_USUARIOS, COLECAO_SETORES, COLECAO_PERFIS];

// ------------------------------------------------------------
// Funcionalidades e ações (iguais às do app original)
// ------------------------------------------------------------

export const ACOES: Record<AcaoPainel, string> = {
  ver: 'Visualizar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  exportar: 'Exportar',
  administrar: 'Administrar'
};

export const RECURSOS: Array<{ id: string; nome: string; acoes: AcaoPainel[] }> = [
  { id: 'carteira', nome: 'Painel da carteira', acoes: ['ver', 'exportar'] },
  { id: 'projetos', nome: 'Projetos, cronograma e atividades', acoes: ['ver', 'criar', 'editar', 'excluir', 'exportar'] },
  { id: 'financeiro', nome: 'Faturamento (físico x financeiro)', acoes: ['ver', 'criar', 'editar', 'excluir', 'exportar'] },
  { id: 'pmo', nome: 'Painel PMO e stakeholders', acoes: ['ver', 'criar', 'editar', 'excluir', 'exportar'] },
  { id: 'campo', nome: 'Equipes de campo e roteirização', acoes: ['ver', 'criar', 'editar', 'excluir', 'exportar'] },
  { id: 'assistente', nome: 'Assistente IA', acoes: ['ver'] },
  { id: 'usuarios', nome: 'Gestão de usuários', acoes: ['ver', 'criar', 'editar', 'excluir', 'administrar'] },
  { id: 'setores', nome: 'Setores', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { id: 'perfis', nome: 'Perfis e permissões', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { id: 'historico', nome: 'Histórico de atividades', acoes: ['ver', 'exportar'] }
];

export const CATEGORIAS: Record<string, string> = {
  acesso: 'Acesso',
  usuario: 'Usuários',
  setor: 'Setores',
  perfil: 'Perfis e permissões',
  dados: 'Dados',
  relatorio: 'E-mails e relatórios'
};

const ACOES_DE: Record<string, AcaoPainel[]> = {};
RECURSOS.forEach(r => { ACOES_DE[r.id] = r.acoes; });

export const permissoesTotais = (): PermissoesPainel => {
  const p: PermissoesPainel = {};
  RECURSOS.forEach(r => { p[r.id] = r.acoes.slice(); });
  return p;
};

const OPERACIONAIS = ['carteira', 'projetos', 'financeiro', 'pmo', 'campo'];

const operacionais = (): PermissoesPainel => {
  const p: PermissoesPainel = {};
  OPERACIONAIS.forEach(k => { p[k] = ACOES_DE[k].slice(); });
  return p;
};

export const SETORES_INICIAIS = [
  'Projetos',
  'Implantação',
  'Engenharia',
  'Suporte',
  'Comercial',
  'Administrativo',
  'Tecnologia da Informação',
  'Diretoria'
];

export const PERFIS_INICIAIS: Record<string, ICadastroPerfil> = {
  administrador: {
    nome: 'Administrador',
    descricao: 'Acesso total: tudo, inclusive usuários, setores, perfis, histórico e e-mails.',
    perms: permissoesTotais(),
    sistema: true,
    total: true
  },
  diretoria: {
    nome: 'Diretoria / Head',
    descricao: 'Acesso total somente leitura: vê tudo (inclusive as configurações) e exporta, sem criar, editar ou excluir.',
    perms: (() => {
      const p: PermissoesPainel = {};
      RECURSOS.forEach(r => { p[r.id] = r.acoes.filter(a => a === 'ver' || a === 'exportar'); });
      return p;
    })(),
    sistema: true
  },
  gestor: {
    nome: 'Gestão',
    descricao: 'Funcionalidades operacionais completas, consulta de usuários, setores e do histórico.',
    perms: { ...operacionais(), assistente: ['ver'], usuarios: ['ver'], setores: ['ver'], historico: ['ver'] },
    sistema: true
  },
  colaborador: {
    nome: 'Analistas / Assistentes / Estagiários',
    descricao: 'Funcionalidades operacionais (projetos, cronogramas, faturamento, PMO, campo e assistente), sem acesso às configurações.',
    perms: { ...operacionais(), assistente: ['ver'] },
    sistema: true
  },
  consulta: {
    nome: 'Consulta (demais áreas)',
    descricao: 'Financeiro, controladoria, supply e demais áreas: só visualiza os projetos (inclusive físico x financeiro) e o painel da carteira.',
    perms: { carteira: ['ver'], projetos: ['ver'], financeiro: ['ver'] },
    sistema: true
  }
};

export const ORDEM_PERFIS = ['administrador', 'diretoria', 'gestor', 'colaborador', 'consulta'];

// Só funcionalidades e ações conhecidas.
export const limparPermissoes = (valor: unknown): PermissoesPainel => {

  const saida: PermissoesPainel = {};

  if (!valor || typeof valor !== 'object') {
    return saida;
  }

  Object.keys(valor as Record<string, unknown>).forEach(k => {
    const lista = (valor as Record<string, unknown>)[k];
    if (ACOES_DE[k] && Array.isArray(lista)) {
      saida[k] = lista.filter(a => ACOES_DE[k].indexOf(a as AcaoPainel) >= 0) as AcaoPainel[];
    }
  });

  return saida;
};

// Permissões efetivas: as do perfil, com as individuais substituindo
// as da funcionalidade (mesma regra do app original).
export const permissoesDe = (
  acessos: IAcessos,
  usuario: ICadastroUsuario | undefined
): PermissoesPainel => {

  if (!usuario) {
    return {};
  }

  const perfil = acessos.perfis[usuario.perfil];

  if (perfil && perfil.total) {
    return permissoesTotais();
  }

  const base = limparPermissoes(perfil ? perfil.perms : {});
  const individuais = limparPermissoes(usuario.perms);

  Object.keys(individuais).forEach(k => { base[k] = individuais[k]; });

  const saida: PermissoesPainel = {};
  Object.keys(base).forEach(k => {
    if (base[k].length) {
      saida[k] = base[k];
    }
  });

  return saida;
};

// Acréscimos do portal sobre as permissões do app:
//   relatorio (E-mails e relatórios) = quem administra usuários (como no original)
//   importacao (base antiga)         = perfil com acesso total
const completarPermissoes = (
  perms: PermissoesPainel,
  total: boolean
): PermissoesPainel => {

  const saida: PermissoesPainel = { ...perms };

  if ((perms.usuarios || []).indexOf('administrar') >= 0) {
    saida.relatorio = ['ver', 'criar', 'editar', 'administrar'];
  }

  if (total) {
    saida.importacao = ['administrar'];
  }

  return saida;
};

// ------------------------------------------------------------
// Sessão
// ------------------------------------------------------------

export type SituacaoAcesso = 'ok' | 'semCadastro' | 'inativo';

export interface IResultadoSessao {
  situacao: SituacaoAcesso;
  sessao: ISessaoPainel;
  // Administradores cadastrados (para a mensagem de "sem acesso").
  administradores: string[];
}

// Administrador do módulo no portal (Usuários e acessos) ou
// Administrador do portal: entra sempre como Administrador do painel.
export const ehAdministradorImplantacoes = (
  contexto?: IContextoAcesso
): boolean =>
  !!contexto &&
  administraModulo(contexto.perfil, contexto.modulosAdministrados, 'implantacoes');

const normalizarEmail = (valor: unknown): string =>
  String(valor || '').trim().toLowerCase();

export const usuarioPorEmail = (
  acessos: IAcessos,
  email: string
): { id: string; usuario: ICadastroUsuario } | undefined => {

  const alvo = normalizarEmail(email);

  if (!alvo) {
    return undefined;
  }

  const id = Object.keys(acessos.usuarios).filter(k => normalizarEmail(acessos.usuarios[k].email) === alvo)[0];

  return id ? { id, usuario: acessos.usuarios[id] } : undefined;
};

export const montarSessao = (
  contexto: IContextoAcesso | undefined,
  acessos: IAcessos
): IResultadoSessao => {

  const email = contexto ? contexto.email : '';
  const achado = usuarioPorEmail(acessos, email);
  const adminPortal = ehAdministradorImplantacoes(contexto);

  const administradores =
    Object.keys(acessos.usuarios)
      .filter(k => acessos.usuarios[k].ativo && (acessos.perfis[acessos.usuarios[k].perfil] || {} as ICadastroPerfil).total)
      .map(k => acessos.usuarios[k].nome);

  const vazio: ISessaoPainel = {
    ativado: true,
    usuario: { id: '', nome: contexto ? contexto.nome : '', email, setor: '', setorNome: '', perfil: '', perfilNome: '' },
    perms: {}
  };

  // Cadastrado e ativo: vale o cadastro do painel.
  if (achado && achado.usuario.ativo) {

    const u = achado.usuario;
    const perfil = acessos.perfis[u.perfil];
    const setor = acessos.setores[u.setor];
    const total = !!(perfil && perfil.total) || adminPortal;

    return {
      situacao: 'ok',
      administradores,
      sessao: {
        ativado: true,
        usuario: {
          id: achado.id,
          nome: u.nome,
          email: u.email,
          setor: u.setor,
          setorNome: setor ? setor.nome : '',
          perfil: total ? 'administrador' : u.perfil,
          perfilNome: total ? 'Administrador' : (perfil ? perfil.nome : '')
        },
        perms: completarPermissoes(total ? permissoesTotais() : permissoesDe(acessos, u), total)
      }
    };
  }

  // Administrador do módulo no portal: entra sempre (mesmo inativo ou
  // sem cadastro no painel), para nunca ficar sem quem administre.
  if (adminPortal && contexto) {
    return {
      situacao: 'ok',
      administradores,
      sessao: {
        ativado: true,
        usuario: {
          id: achado ? achado.id : `portal:${contexto.usuarioId}`,
          nome: contexto.nome,
          email: contexto.email,
          setor: achado ? achado.usuario.setor : '',
          setorNome: achado && acessos.setores[achado.usuario.setor] ? acessos.setores[achado.usuario.setor].nome : '',
          perfil: 'administrador',
          perfilNome: 'Administrador'
        },
        perms: completarPermissoes(permissoesTotais(), true)
      }
    };
  }

  return {
    situacao: achado ? 'inativo' : 'semCadastro',
    administradores,
    sessao: vazio
  };
};

// ------------------------------------------------------------
// Regras usadas pela base de dados
// ------------------------------------------------------------

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

  if (COLECOES_ACESSO.indexOf(colecao) >= 0) {
    return 'usuarios';
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

// Perfis iniciais que faltarem (antes da primeira configuração, ou
// quando o app ganhar um perfil novo) e o Administrador sempre com tudo.
export const completarAcessos = (acessos: IAcessos): IAcessos => {

  const perfis: Record<string, ICadastroPerfil> = { ...acessos.perfis };

  ORDEM_PERFIS.forEach(k => {
    if (!perfis[k]) {
      perfis[k] = { ...PERFIS_INICIAIS[k] };
    }
  });

  perfis.administrador = { ...perfis.administrador, perms: permissoesTotais(), total: true, sistema: true };

  return { usuarios: acessos.usuarios, setores: acessos.setores, perfis };
};
