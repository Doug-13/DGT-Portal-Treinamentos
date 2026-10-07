import {
  ITreinamento
} from './Treinamento';

export interface ITrilhaTreinamento {

  id: string;

  treinamentoId: string;

  usuarioTreinamentoId?: string;

  ordem: number;

  obrigatorio: boolean;

  regraLiberacao: string;

  status:
    ITreinamento['status'];

  progresso: number;

  treinamento?:
    ITreinamento;
}

export interface ITrilha {

  id: string;

  nome: string;

  descricao: string;

  ativa: boolean;

  treinamentos:
    ITrilhaTreinamento[];

  progresso: number;

  concluidos: number;

  total: number;

  // true  -> o usuário possui atribuição nesta trilha;
  // false -> a trilha aparece apenas por visibilidade de área
  //          e ainda não foi atribuída ao usuário.
  atribuida?: boolean;
}