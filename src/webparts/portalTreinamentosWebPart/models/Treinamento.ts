export type StatusTreinamento =
  | 'Bloqueado'
  | 'Disponível'
  | 'Em andamento'
  | 'Concluído'
  | 'Reprovado'
  | 'Vencido'
  | 'Cancelado';

export interface ITreinamento {
  id: string;
  usuarioTreinamentoId?: string;
  nome: string;
  codigo: string;
  descricao: string;
  status: StatusTreinamento;
  progresso: number;
  cargaHoraria: string;
  validadeMeses?: number;
  ativo: boolean;
  imagem: string;
}

export interface IHistorico {
  id: string;
  treinamento: string;
  trilha: string;
  status: string;
  conclusao: string;
  nota: string;
  validade: string;
}

export interface ICertificado {
  id: string;
  treinamento: string;
  codigo: string;
  conclusao: string;
  validade: string;
  cargaHoraria: string;
}
