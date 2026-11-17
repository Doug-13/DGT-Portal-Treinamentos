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

// Treinamento atribuído a um colaborador (dgt_usuariotreinamento),
// usado no detalhe da tela "Minha equipe".
export interface ITreinamentoColaborador {
  // Id da atribuição.
  id: string;
  treinamentoId: string;
  nome: string;

  // Rótulo exibido (Concluído, Em andamento, Disponível, Bloqueado,
  // Vencido, Reprovado...).
  status: string;

  // Mesma classificação usada nos totais da linha do colaborador.
  situacao: 'concluido' | 'pendente' | 'vencido';

  trilha?: string;

  dataAtribuicao?: string;
  // Prazo para realizar o treinamento (dgt_datalimite).
  dataLimite?: string;
  dataConclusao?: string;
  // Validade do certificado (dgt_datavalidade).
  dataValidade?: string;
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

  // Treinamentos atribuídos (ativos). Opcional para manter
  // compatibilidade com os mocks.
  treinamentos?: ITreinamentoColaborador[];
}