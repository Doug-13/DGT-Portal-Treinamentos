// ============================================================
// AVISOS NO CANTO DA TELA — PREFERÊNCIAS (no navegador)
//
// Guardadas no localStorage, por usuário (e-mail): valem só neste
// navegador/computador. Também guarda o que o usuário já viu (para não
// repetir o aviso) e o histórico dos últimos avisos.
// ============================================================

export type TipoAviso = 'fluxo' | 'treinamentos' | 'orcamento' | 'licitacoes';

export type PosicaoAviso = 'inferiorDireito' | 'superiorDireito';

export interface IPreferenciasAvisos {
  ativo: boolean;
  tipos: { [tipo in TipoAviso]: boolean };
  posicao: PosicaoAviso;
  // Segundos na tela (0 = fica até fechar).
  duracaoSegundos: number;
  som: boolean;
  // De quantos em quantos minutos o portal procura novidades.
  intervaloMinutos: number;
}

export interface IAviso {
  // Chave estável: o mesmo id nunca é avisado duas vezes.
  id: string;
  tipo: TipoAviso;
  titulo: string;
  detalhe: string;
  data: string;
  // O que o botão "Abrir" faz.
  acao?: { pagina?: string; documentoId?: string };
}

export const ROTULO_TIPO_AVISO: { [tipo in TipoAviso]: string } = {
  fluxo: 'Etapa de fluxo aguardando você (documentos, treinamentos, orçamento)',
  treinamentos: 'Treinamento novo atribuído ou prazo vencendo',
  orcamento: 'Orçamento devolvido, em aprovação ou aprovado',
  licitacoes: 'Alteração nas licitações acompanhadas'
};

export const PREFERENCIAS_PADRAO: IPreferenciasAvisos = {
  ativo: true,
  tipos: { fluxo: true, treinamentos: true, orcamento: true, licitacoes: true },
  posicao: 'inferiorDireito',
  duracaoSegundos: 12,
  som: false,
  intervaloMinutos: 2
};

// Evento disparado quando as preferências mudam (o vigia de avisos
// recarrega na hora) e para o botão "Testar aviso".
export const EVENTO_PREFERENCIAS = 'dgt-avisos-preferencias';
export const EVENTO_TESTE = 'dgt-avisos-teste';

const chave = (email: string, sufixo: string): string =>
  `dgt-portal-avisos:${(email || 'anonimo').trim().toLowerCase()}:${sufixo}`;

const ler = <T>(nome: string, padrao: T): T => {
  try {
    const texto = window.localStorage.getItem(nome);
    return texto ? (JSON.parse(texto) as T) : padrao;
  } catch {
    return padrao;
  }
};

const gravar = (nome: string, valor: unknown): void => {
  try {
    window.localStorage.setItem(nome, JSON.stringify(valor));
  } catch {
    // Navegador sem armazenamento (modo privado, cota): segue sem gravar.
  }
};

export const lerPreferencias = (email: string): IPreferenciasAvisos => {
  const lidas = ler<Partial<IPreferenciasAvisos>>(chave(email, 'preferencias'), {});
  return {
    ...PREFERENCIAS_PADRAO,
    ...lidas,
    tipos: { ...PREFERENCIAS_PADRAO.tipos, ...(lidas.tipos || {}) }
  };
};

export const gravarPreferencias = (email: string, preferencias: IPreferenciasAvisos): void => {
  gravar(chave(email, 'preferencias'), preferencias);
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_PREFERENCIAS));
  } catch {
    // Navegador antigo: as preferências valem no próximo carregamento.
  }
};

// Ids já vistos. undefined = primeira vez neste navegador.
export const lerVistos = (email: string): string[] | undefined => {
  const lidos = ler<string[] | undefined>(chave(email, 'vistos'), undefined);
  return Array.isArray(lidos) ? lidos : undefined;
};

export const gravarVistos = (email: string, ids: string[]): void => {
  // Mantém só os mais recentes.
  gravar(chave(email, 'vistos'), ids.slice(-1500));
};

export const lerHistorico = (email: string): IAviso[] => {
  const lidos = ler<IAviso[]>(chave(email, 'historico'), []);
  return Array.isArray(lidos) ? lidos : [];
};

export const acrescentarHistorico = (email: string, avisos: IAviso[]): void => {
  if (avisos.length === 0) {
    return;
  }
  gravar(chave(email, 'historico'), avisos.concat(lerHistorico(email)).slice(0, 30));
};

export const limparHistorico = (email: string): void => {
  gravar(chave(email, 'historico'), []);
};
