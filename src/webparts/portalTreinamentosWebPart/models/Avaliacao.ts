export interface IAvaliacao {
  id: string;
  nome: string;
  treinamentoId: string;
  notaMinima: number;
  quantidadeQuestoes: number;
  tentativasPermitidas: number;
  tempoLimiteMin: number;
  sortearQuestoes: boolean;
  embaralharQuestoes: boolean;
  embaralharAlternativas: boolean;
  mostrarResultado: boolean;
  mostrarRespostasCorretas: boolean;
  ativa: boolean;
}

export interface IQuestao {
  id: string;
  avaliacaoId: string;
  nome: string;
  enunciado: string;
  ordem: number;
  peso: number;
  tipoQuestao: number;
  multiplasRespostas: boolean;
  ativa: boolean;
  alternativas?: IAlternativa[];
}

export interface IAlternativa {
  id: string;
  questaoId: string;
  nome: string;
  ordem: number;
  correta: boolean;
  justificativa?: string;
  ativa: boolean;
}
