export interface IAlternativaAvaliacao {
  id: string;
  texto: string;
  ordem: number;
}

export interface IQuestaoAvaliacao {
  id: string;
  nome: string;
  enunciado: string;
  ordem: number;
  peso: number;
  multiplasRespostas: boolean;
  alternativas: IAlternativaAvaliacao[];
}

export interface IAvaliacao {
  id: string;
  nome: string;
  descricao: string;
  notaMinima: number;
  quantidadeQuestoes: number;
  tentativasPermitidas: number;
  tempoLimiteMin: number;
  sortearQuestoes: boolean;
  embaralharQuestoes: boolean;
  embaralharAlternativas: boolean;
  mostrarResultado: boolean;
  mostrarRespostasCorretas: boolean;
  questoes: IQuestaoAvaliacao[];
}

export interface IRespostaEnvioAvaliacao {
  questaoId: string;
  alternativasSelecionadas: string[];
}

export interface IEnvioAvaliacao {
  usuarioTreinamentoId: string;
  avaliacaoId: string;
  dataInicio: string;
  dataTermino: string;
  tempoUtilizadoSeg: number;
  numeroTentativa: number;
  respostas: IRespostaEnvioAvaliacao[];
}

export interface IEstadoTentativasAvaliacao {
  realizadas: number;
  permitidas: number;
  restantes: number;
  proximaTentativa: number;
}

export interface IResultadoAvaliacao {
  sucesso: boolean;
  mensagem: string;
  tentativaId: string;
  nota: number;
  acertos: number;
  erros: number;
  aprovado: boolean;
  total: number;
  numeroTentativa: number;
  tentativasRestantes: number;
  treinamentoConcluido: boolean;
  proximoTreinamentoLiberado: boolean;
  proximoTreinamentoNome: string;
  dataValidade?: string;
}
