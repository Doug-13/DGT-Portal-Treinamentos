export interface IUsuario {
  id: string;
  nome: string;
  email: string;
  upn?: string;
  entraObjectId?: string;
  cargo?: string;
  matricula?: string;
  ativo: boolean;
}

export interface IColaborador {
  id: string | number;
  nome: string;
  funcao: string;
  setor: string;
  concluidos: number;
  pendentes: number;
  conformidade: string;
}
