// ============================================================
// ESQUEMA DOS AMBIENTES DINÂMICOS NO DATAVERSE
//
// Os nomes DEVEM ser iguais aos do script
// scripts/dataverse/criar-tabelas-ambientes.ps1
// ============================================================

export const TABELAS_AMBIENTE = {
  ambiente: 'dgt_ambiente',
  registro: 'dgt_ambienteregistro',
  processo: 'dgt_processo',
  area: 'dgt_area',
  usuario: 'dgt_usuario'
};

export const AMBIENTE = {
  id: 'dgt_ambienteid',
  nome: 'dgt_name',
  chave: 'dgt_chave',
  descricao: 'dgt_descricao',
  subtitulo: 'dgt_subtitulo',
  icone: 'dgt_icone',
  ordem: 'dgt_ordem',
  ativo: 'dgt_ativo',
  liberadoParaTodos: 'dgt_liberadoparatodos',
  perfisPadrao: 'dgt_perfispadrao',
  prefixoCodigo: 'dgt_prefixocodigo',
  rotuloRegistro: 'dgt_rotuloregistro',
  // Telas configuráveis (layoutAmbiente.ts). Coluna opcional: sem ela
  // o ambiente usa o layout gerado do fluxo.
  layout: 'dgt_layoutjson',
  // Anexos (colunas opcionais).
  permiteAnexos: 'dgt_permiteanexos',
  bibliotecaAnexos: 'dgt_bibliotecaanexos',
  // Lookup → dgt_processo
  processoValor: '_dgt_processo_value',
  processoBind: 'dgt_Processo@odata.bind'
};

export const REGISTRO = {
  id: 'dgt_ambienteregistroid',
  titulo: 'dgt_name',
  codigo: 'dgt_codigo',
  descricao: 'dgt_descricao',
  situacao: 'dgt_situacao',
  etapaAtual: 'dgt_etapaatual',
  // Colunas opcionais (telas configuráveis).
  etapaAtualId: 'dgt_etapaatualid',
  valores: 'dgt_valoresjson',
  prazoEtapa: 'dgt_prazoetapa',
  responsaveisEtapa: 'dgt_responsaveisetapa',
  fluxoEstado: 'dgt_fluxoestado',
  concluidoEm: 'dgt_concluidoem',
  criadoEm: 'createdon',
  // Lookups
  ambienteValor: '_dgt_ambiente_value',
  ambienteBind: 'dgt_Ambiente@odata.bind',
  areaValor: '_dgt_area_value',
  areaBind: 'dgt_Area@odata.bind',
  solicitanteValor: '_dgt_solicitante_value',
  solicitanteBind: 'dgt_Solicitante@odata.bind'
};

export const ANOTACAO_FORMATADA = '@OData.Community.Display.V1.FormattedValue';

// Prefixo do código do processo criado para cada ambiente.
export const PREFIXO_PROCESSO_AMBIENTE = 'AMB-';
