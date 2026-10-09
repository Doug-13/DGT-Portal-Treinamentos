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
  cargaHorariaMin?: number;
  notaMinima?: number;
  validadeMeses?: number;
  ativo: boolean;
  imagem: string;
  imagemUrl?: string;
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

// Situação do PDF do certificado (ver CertificadoService):
//   disponivel  PDF localizado no SharePoint
//   gerando     certificado ainda não emitido / PDF ainda não salvo
//   semAcesso   o PDF existe, mas o usuário não tem acesso à biblioteca
export type SituacaoArquivoCertificado =
  | 'disponivel'
  | 'gerando'
  | 'semAcesso';

export interface ICertificado {
  id: string;
  treinamento: string;
  codigo: string;
  conclusao: string;
  validade: string;
  cargaHoraria: string;

  // Preenchidos a partir de dgt_certificado + biblioteca do SharePoint
  numero?: string;
  emissao?: string;
  arquivoUrl?: string;
  downloadUrl?: string;
  previewUrl?: string;
  situacaoArquivo?: SituacaoArquivoCertificado;

  // Revisão do treinamento em que a pessoa foi treinada (só na
  // tela; o PDF do certificado não muda) e a revisão vigente.
  treinamentoId?: string;
  dataConclusaoIso?: string;
  revisao?: string;
  revisaoAtual?: string;
}
