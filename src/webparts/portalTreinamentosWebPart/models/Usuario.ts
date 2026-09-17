export interface IUsuario {
  id: string;
  nome: string;
  email: string;
  upn?: string;
  entraObjectId?: string;

  cargo?: string;
  setor?: string;
  matricula?: string;

  ativo: boolean;
}

export interface IColaborador {
  // Mantemos string | number por enquanto porque
  // ainda existe colaborador mockado com id numérico.
  id: string | number;

  nome: string;
  email?: string;

  funcao: string;
  setor: string;

  concluidos: number;
  pendentes: number;

  // Opcionais temporariamente para manter
  // compatibilidade com os mocks atuais.
  vencidos?: number;
  total?: number;

  conformidade: string;
}