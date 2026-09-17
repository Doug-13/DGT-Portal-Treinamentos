export interface IDocumento {
  id: string;

  codigo: string;

  titulo: string;

  documento: string;

  descricao?: string;

  categoria: string;

  tipo: string;

  status: string;

  revisao: string;

  revisaoAtual: string;

  responsavelId?: string;

  responsavel?: string;

  ativo: boolean;
}

export interface IDocumentoRevisao {
  id: string;

  documentoId: string;

  nome: string;

  revisao: string;

  dataRevisao?: string;

  dataVigencia?: string;

  arquivoUrl?: string;

  biblioteca?: string;

  sharePointItemId?: string;

  responsavelId?: string;

  responsavel?: string;

  aprovadoPorId?: string;

  aprovadoPor?: string;

  motivoAlteracao?: string;

  descricaoAlteracoes?: string;

  requerRetreinamento: boolean;

  justificativa?: string;

  status: string;

  ativa: boolean;
}

export interface ITreinamentoDocumento {
  id: string;

  nome: string;

  treinamentoId: string;

  documentoId: string;

  obrigatorio: boolean;

  ordem: number;

  observacao?: string;

  ativo: boolean;
}