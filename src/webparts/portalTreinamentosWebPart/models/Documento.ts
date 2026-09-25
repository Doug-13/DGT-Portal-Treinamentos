export interface IDocumento {
  id: string;

  codigo: string;

  titulo: string;

  documento: string;

  descricao?: string;

  categoria: string;

  // Necessário para localizar o Gestor da área (quem aprova este
  // documento) em "Áreas e acessos".
  areaId?: string;

  // Nome da área — usado como pasta no SharePoint ao enviar o
  // arquivo de uma nova revisão.
  area?: string;

  // Prazo da próxima revisão periódica (AAAA-MM-DD). Definido
  // automaticamente na publicação de cada revisão.
  prazoRevisao?: string;

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

  dataAprovacao?: string;

  criadoEm?: string;

  criadoPor?: string;
}

// Evento do histórico do documento (tabela dgt_auditorianegocio, ou
// derivado das próprias revisões para registros anteriores ao
// histórico existir).
export type TipoEventoDocumento =
  | 'REVISAO_CRIADA'
  | 'REVISAO_EDITADA'
  | 'ARQUIVO_SUBSTITUIDO'
  | 'ENVIADA_APROVACAO'
  | 'REPROVADA'
  | 'APROVADA_PUBLICADA'
  | 'REVISAO_SUBSTITUIDA'
  | 'OUTRO';

export interface IDocumentoEvento {
  id: string;

  tipo: TipoEventoDocumento;

  titulo: string;

  descricao: string;

  data: string;

  usuario: string;

  revisaoId?: string;

  revisao?: string;

  statusAnterior?: string;

  statusNovo?: string;

  motivo?: string;

  arquivoUrl?: string;

  // true = reconstruído a partir dos dados da revisão (não existe
  // registro de auditoria gravado para ele).
  derivado: boolean;
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