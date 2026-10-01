// ============================================================
// ESQUEMA DO FLUXO NO DATAVERSE
//
// Nomes das tabelas e colunas usadas pelo fluxo configurável.
// DEVEM ser iguais aos criados por
//   scripts/dataverse/criar-tabelas-fluxo.ps1
// (e descritos em docs/fluxo-dataverse.md).
//
// Lookups: o valor lido vem em "_<coluna>_value"; para gravar usa-se
// "<SchemaName>@odata.bind".
// ============================================================

export const TABELA_FLUXO = 'dgt_fluxo';
export const TABELA_PROCESSO_METADADO = 'dgt_processometadado';
export const TABELA_TAREFA_FLUXO = 'dgt_tarefafluxo';
export const TABELA_HISTORICO_FLUXO = 'dgt_historicofluxo';

export const TABELA_PROCESSO = 'dgt_processo';
export const TABELA_DOCUMENTO_PROCESSO = 'dgt_documentoprocesso';
export const TABELA_DOCUMENTO_REVISAO = 'dgt_documentorevisao';
export const TABELA_DOCUMENTO = 'dgt_documento';
export const TABELA_AREA = 'dgt_area';
export const TABELA_USUARIO = 'dgt_usuario';

// dgt_fluxo
export const FLUXO = {
  id: 'dgt_fluxoid',
  nome: 'dgt_name',
  processoValor: '_dgt_processo_value',
  processoBind: 'dgt_Processo@odata.bind',
  versao: 'dgt_versao',
  situacao: 'dgt_situacao',
  definicaoJson: 'dgt_definicaojson',
  bpmnXml: 'dgt_bpmnxml',
  modelo: 'dgt_modelo',
  publicadoEm: 'dgt_publicadoem',
  arquivadoEm: 'dgt_arquivadoem',
  criadoEm: 'createdon'
};

// dgt_processometadado
export const METADADO = {
  id: 'dgt_processometadadoid',
  nome: 'dgt_name',
  processoValor: '_dgt_processo_value',
  processoBind: 'dgt_Processo@odata.bind',
  chave: 'dgt_chave',
  tipo: 'dgt_tipo',
  ordem: 'dgt_ordem',
  opcoesJson: 'dgt_opcoesjson',
  colunasJson: 'dgt_colunasjson',
  ajuda: 'dgt_ajuda',
  ativo: 'dgt_ativo'
};

// dgt_tarefafluxo
export const TAREFA = {
  id: 'dgt_tarefafluxoid',
  nome: 'dgt_name',
  chave: 'dgt_chave',
  revisaoValor: '_dgt_documentorevisao_value',
  revisaoBind: 'dgt_DocumentoRevisao@odata.bind',
  fluxoValor: '_dgt_fluxo_value',
  fluxoBind: 'dgt_Fluxo@odata.bind',
  etapaId: 'dgt_etapaid',
  etapaNome: 'dgt_etapanome',
  situacao: 'dgt_situacao',
  responsaveisJson: 'dgt_responsaveisjson',
  prazo: 'dgt_prazo',
  concluidaEm: 'dgt_concluidaem',
  concluidaPorBind: 'dgt_ConcluidaPor@odata.bind',
  acaoRotulo: 'dgt_acaorotulo',
  criadoEm: 'createdon'
};

// dgt_historicofluxo
export const HISTORICO = {
  id: 'dgt_historicofluxoid',
  nome: 'dgt_name',
  chave: 'dgt_chave',
  revisaoBind: 'dgt_DocumentoRevisao@odata.bind',
  fluxoBind: 'dgt_Fluxo@odata.bind',
  etapaId: 'dgt_etapaid',
  etapaNome: 'dgt_etapanome',
  acaoChave: 'dgt_acaochave',
  acaoRotulo: 'dgt_acaorotulo',
  resultado: 'dgt_resultado',
  comentario: 'dgt_comentario',
  executadoPorBind: 'dgt_ExecutadoPor@odata.bind',
  executadoPorNome: 'dgt_executadopornome',
  sistema: 'dgt_sistema',
  dataEvento: 'dgt_dataevento'
};

// Colunas novas em tabelas existentes
export const PROCESSO_EXTRA = {
  areaValor: '_dgt_area_value',
  areaBind: 'dgt_Area@odata.bind'
};

export const DOCUMENTO_PROCESSO_EXTRA = {
  principal: 'dgt_principal'
};

export const REVISAO_FLUXO = {
  fluxoValor: '_dgt_fluxo_value',
  fluxoBind: 'dgt_Fluxo@odata.bind',
  etapaAtual: 'dgt_etapaatual',
  situacaoFluxo: 'dgt_situacaofluxo',
  estadoJson: 'dgt_estadofluxojson'
};

// Lookups já existentes em dgt_documentoprocesso
export const DOCUMENTO_PROCESSO = {
  id: 'dgt_documentoprocessoid',
  nome: 'dgt_name',
  documentoValor: '_dgt_documento_value',
  documentoBind: 'dgt_Documento@odata.bind',
  processoValor: '_dgt_processo_value',
  processoBind: 'dgt_Processo@odata.bind',
  ativo: 'dgt_ativo'
};

export const ANOTACAO_FORMATADA =
  '@OData.Community.Display.V1.FormattedValue';

export const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

export const texto = (
  registro: Record<string, unknown>,
  campo: string
): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

export const escaparOData = (
  valor: string
): string =>
  String(valor || '').replace(/'/g, "''");

export const lerJsonSeguro = <T>(
  textoJson: string,
  padrao: T
): T => {
  if (!textoJson) {
    return padrao;
  }
  try {
    return JSON.parse(textoJson) as T;
  } catch {
    return padrao;
  }
};
