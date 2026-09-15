export interface IDocumento {
  id: string | number;
  codigo: string;
  documento: string;
  categoria: string;
  status: string;
  revisao: string;
}

export interface IDocumentoRevisao {
  id: string;
  documentoId: string;
  revisao: string;
  dataRevisao?: string;
  dataVigencia?: string;
  arquivoUrl?: string;
  responsavel?: string;
  motivoAlteracao?: string;
  descricaoAlteracoes?: string;
  requerRetreinamento: boolean;
  justificativa?: string;
  status: string;
}
