import {
  IFluxoResponsavel,
  IResponsavelResolvido
} from '../../models/Fluxo';

// ============================================================
// NOTIFICAÇÕES DO FLUXO
//
// Duas formas de configurar, com a MESMA estrutura (IConfigNotificacao):
//
//   • Aba "Notificações" de uma atividade (tarefa humana): avisa quando
//     a atividade COMEÇA (ao chegar nela) ou quando é CONCLUÍDA (com
//     filtro opcional pelo resultado da ação: Aprovar, Reprovar...).
//
//   • Evento de notificação (círculo com carta, no desenho): avisa
//     quando o fluxo PASSA por ele. Não para o fluxo.
//
// Caminho do aviso (aproveita a fila de e-mails que já existe):
//   motor (FluxoEngine) anota o pedido na instância
//   → FluxoService resolve os destinatários e monta o texto
//   → NotificacaoFluxoService grava UMA LINHA POR DESTINATÁRIO em
//     dgt_implemail (dgt_tipo = "notificacaoFluxo"):
//       e-mail → dgt_status "Pendente"      (fluxo de e-mail já existente)
//       Teams  → dgt_status "PendenteTeams" (fluxo "DGT - Notificações Teams")
//   → o Power Automate envia e grava "Enviado" ou "Falha".
//
// Nenhuma credencial fica no portal: o envio é feito pelas conexões
// do Power Automate.
// ============================================================

export type MomentoNotificacao = 'aoChegar' | 'aoConcluir';

// 'portal' fica só por compatibilidade com configurações antigas: é
// ignorado (o aviso no portal das etapas pendentes já existe, via
// dgt_tarefafluxo).
export type CanalNotificacao = 'email' | 'teams' | 'portal';

export const CANAIS_NOTIFICACAO: Array<{ valor: CanalNotificacao; nome: string }> = [
  { valor: 'email', nome: 'E-mail (Outlook)' },
  { valor: 'teams', nome: 'Teams (chat)' }
];

export const MOMENTOS_NOTIFICACAO: Array<{ valor: MomentoNotificacao; nome: string }> = [
  { valor: 'aoChegar', nome: 'Quando a atividade começar' },
  { valor: 'aoConcluir', nome: 'Quando a atividade for concluída' }
];

export interface IConfigNotificacao {
  // Identifica a notificação dentro do elemento (não muda ao editar).
  chave: string;

  // Desligada = fica configurada, mas não envia.
  ativa: boolean;

  // Só nas atividades. No evento de notificação é sempre "ao passar".
  momento: MomentoNotificacao;

  // aoConcluir: só envia quando a ação tiver um destes resultados
  // (ex.: ['reprovado']). Vazio = qualquer ação.
  resultados?: string[];

  // Atividade: inclui os responsáveis da própria atividade.
  incluirResponsaveisEtapa?: boolean;

  // Mesmos tipos de responsável do fluxo (autor, área, usuário, campo
  // Usuário, cargo...). Resolvidos na hora do envio.
  destinatarios: IFluxoResponsavel[];

  // E-mails fixos (ex.: caixa compartilhada), separados por ";".
  // Só para e-mail; não valem para Teams nem portal.
  emailsAdicionais?: string;

  canais: CanalNotificacao[];

  // Aceitam marcadores (ver MARCADORES_NOTIFICACAO).
  assunto: string;
  mensagem: string;
}

// Marcadores aceitos no assunto e na mensagem.
export const MARCADORES_NOTIFICACAO: Array<{ marcador: string; descricao: string }> = [
  { marcador: '{registro}', descricao: 'Documento / registro (código e título)' },
  { marcador: '{revisao}', descricao: 'Revisão atual' },
  { marcador: '{etapa}', descricao: 'Nome da atividade ou do evento' },
  { marcador: '{acao}', descricao: 'Ação executada (ex.: Aprovar)' },
  { marcador: '{comentario}', descricao: 'Comentário de quem executou a ação' },
  { marcador: '{executor}', descricao: 'Quem executou a ação' },
  { marcador: '{prazo}', descricao: 'Prazo da atividade (dd/mm/aaaa)' },
  { marcador: '{processo}', descricao: 'Nome do processo' },
  { marcador: '{link}', descricao: 'Link do portal' },
  { marcador: '{campo:chave}', descricao: 'Valor de um metadado (troque "chave" pela chave do campo)' }
];

// Pedido anotado pelo motor na instância (transitório: o FluxoService
// retira da instância antes de gravar e entrega ao despachante).
export interface INotificacaoSolicitada {
  // Chave única do pedido (não envia duas vezes o mesmo aviso).
  chave: string;
  elementoId: string;
  elementoNome: string;
  origem: 'atividade' | 'evento';
  momento: MomentoNotificacao | 'aoPassar';
  config: IConfigNotificacao;
  // Responsáveis da atividade (quando incluirResponsaveisEtapa).
  responsaveisEtapa: IFluxoResponsavel[];
  // Dados da ação que provocou o aviso.
  acaoRotulo?: string;
  resultado?: string;
  comentario?: string;
  executorNome?: string;
  prazo?: string;
  solicitadaEm: string;
}

// Pessoa que vai receber (já resolvida).
export interface IDestinatarioNotificacao {
  usuarioId?: string;
  nome: string;
  email: string;
}

// Quem entrega os pedidos (Dataverse em produção; nada no modo de teste).
export interface IDespachanteNotificacoes {
  // Devolve avisos não bloqueantes (ex.: falha ao gravar um pedido).
  registrar(
    pedidos: INotificacaoSolicitada[],
    dados: IDadosMensagemNotificacao
  ): Promise<string[]>;
}

// Dados da instância usados para montar o texto.
export interface IDadosMensagemNotificacao {
  origem: string;
  alvoId: string;
  registro: string;
  revisao: string;
  processo: string;
  valores: Record<string, string>;
  link: string;
  // Mesma regra das pendências (autor, área, cargo, campo Usuário...).
  // O despachante transforma o resultado em pessoas com e-mail.
  // Ausente = só os e-mails adicionais recebem.
  resolverResponsaveis?: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>) => IResponsavelResolvido[];
}

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

export const novaChaveNotificacao = (): string =>
  `not-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const configNotificacaoPadrao = (
  origem: 'atividade' | 'evento'
): IConfigNotificacao => ({
  chave: novaChaveNotificacao(),
  ativa: true,
  momento: 'aoChegar',
  resultados: [],
  incluirResponsaveisEtapa: origem === 'atividade',
  destinatarios: origem === 'evento'
    ? [{ tipo: 'autorRevisao', descricao: 'Autor da revisão', papelTeste: 'autor' }]
    : [],
  emailsAdicionais: '',
  // E-mail sempre; Teams opcional.
  canais: ['email'],
  assunto: origem === 'evento'
    ? '{registro} — {etapa}'
    : '{registro} aguarda você na etapa {etapa}',
  mensagem: origem === 'evento'
    ? 'Olá,\n\nO registro {registro} passou pela etapa {etapa}.\n\n{link}'
    : 'Olá,\n\nO registro {registro} chegou na etapa {etapa}. Prazo: {prazo}.\n\nAcesse: {link}'
});

const dataCurta = (valor?: string): string => {
  if (!valor) {
    return '';
  }
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    return valor;
  }
  const dois = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`;
};

// Valor de metadado legível (Usuário/Área/Documento são gravados como JSON).
const valorLegivel = (bruto: string): string => {
  const texto = (bruto || '').trim();
  if (!texto || (texto[0] !== '{' && texto[0] !== '[')) {
    return texto === 'sim' ? 'Sim' : texto === 'nao' ? 'Não' : texto;
  }
  try {
    const lido = JSON.parse(texto) as unknown;
    const nomeDe = (item: Record<string, unknown>): string =>
      String(item.nome || item.titulo || item.codigo || item.sigla || '');
    if (Array.isArray(lido)) {
      return lido.map(item => (item && typeof item === 'object' ? nomeDe(item as Record<string, unknown>) : String(item))).filter(Boolean).join(', ');
    }
    return lido && typeof lido === 'object' ? nomeDe(lido as Record<string, unknown>) : texto;
  } catch {
    return texto;
  }
};

export const montarTextoNotificacao = (
  modelo: string,
  pedido: INotificacaoSolicitada,
  dados: IDadosMensagemNotificacao
): string =>
  (modelo || '')
    .replace(/\{campo:([^}]+)\}/g, (_tudo, chave: string) => valorLegivel(dados.valores[chave.trim()] || ''))
    .replace(/\{registro\}/g, dados.registro || '')
    .replace(/\{revisao\}/g, dados.revisao || '')
    .replace(/\{etapa\}/g, pedido.elementoNome || '')
    .replace(/\{acao\}/g, pedido.acaoRotulo || '')
    .replace(/\{comentario\}/g, pedido.comentario || '')
    .replace(/\{executor\}/g, pedido.executorNome || '')
    .replace(/\{prazo\}/g, dataCurta(pedido.prazo) || 'sem prazo')
    .replace(/\{processo\}/g, dados.processo || '')
    .replace(/\{link\}/g, dados.link || '');

export const emailsDoTexto = (texto?: string): string[] =>
  (texto || '')
    .split(/[;,\s]+/)
    .map(item => item.trim().toLowerCase())
    .filter(item => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item))
    .filter((item, indice, lista) => lista.indexOf(item) === indice);

// A notificação vale para este momento/resultado?
export const notificacaoSeAplica = (
  config: IConfigNotificacao,
  momento: MomentoNotificacao,
  resultado?: string
): boolean => {
  if (!config.ativa || config.momento !== momento) {
    return false;
  }
  if (momento === 'aoConcluir' && config.resultados && config.resultados.length > 0) {
    return !!resultado && config.resultados.indexOf(resultado) >= 0;
  }
  return true;
};

// Atividade: só os RESPONSÁVEIS DA ATIVIDADE recebem, sempre por e-mail;
// o Teams é opcional. Outros destinatários e e-mails adicionais
// ficam só no evento de notificação.
export const normalizarNotificacaoAtividade = (
  config: IConfigNotificacao
): IConfigNotificacao => ({
  ...config,
  incluirResponsaveisEtapa: true,
  destinatarios: [],
  emailsAdicionais: '',
  canais: config.canais.indexOf('teams') >= 0 ? ['email', 'teams'] : ['email']
});

// Erros de configuração (usados na validação do fluxo e na aba).
export const validarConfigNotificacao = (
  config: IConfigNotificacao,
  nomeElemento: string
): string[] => {
  const erros: string[] = [];
  if (!config.ativa) {
    return erros;
  }
  const temDestino =
    !!config.incluirResponsaveisEtapa ||
    config.destinatarios.length > 0 ||
    emailsDoTexto(config.emailsAdicionais).length > 0;
  if (!temDestino) {
    erros.push(`A notificação de "${nomeElemento}" não tem destinatários.`);
  }
  if (config.canais.filter(canal => canal !== 'portal').length === 0) {
    erros.push(`Escolha pelo menos um canal na notificação de "${nomeElemento}".`);
  }
  if (!(config.assunto || '').trim()) {
    erros.push(`Informe o assunto da notificação de "${nomeElemento}".`);
  }
  if (!(config.mensagem || '').trim()) {
    erros.push(`Escreva a mensagem da notificação de "${nomeElemento}".`);
  }
  if ((config.emailsAdicionais || '').trim() && emailsDoTexto(config.emailsAdicionais).length === 0) {
    erros.push(`Os e-mails adicionais da notificação de "${nomeElemento}" não são válidos.`);
  }
  return erros;
};
