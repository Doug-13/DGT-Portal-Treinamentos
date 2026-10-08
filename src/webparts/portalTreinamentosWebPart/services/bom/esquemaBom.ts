// ============================================================
// ARQUITETURA DE SOLUÇÕES (B.O.M.) — ESQUEMA NO DATAVERSE
//
// Nomes das tabelas/colunas e valores das escolhas criados pelo
// script scripts/dataverse/criar-tabelas-bom.ps1. Os dois DEVEM
// continuar iguais.
//
// Fase 1: Dados da demanda e Matriz Go/No-Go. Seleção de kit e
// Cálculo de HH entram numa fase seguinte.
// ============================================================

export const TABELAS_BOM = {
  demanda: 'dgt_bom_demanda',
  demandaResponsavel: 'dgt_bom_demandaresponsavel',
  bom: 'dgt_bom_bom',
  criterio: 'dgt_bom_criterio',
  analise: 'dgt_bom_analise',
  analiseNota: 'dgt_bom_analisenota'
};

export const DEMANDA = {
  id: 'dgt_bom_demandaid',
  nome: 'dgt_name',
  numero: 'dgt_bom_numero',
  cliente: 'dgt_bom_cliente',
  codigoCigam: 'dgt_bom_codigocigam',
  municipio: 'dgt_bom_municipio',
  uf: 'dgt_bom_uf',
  numeroCrm: 'dgt_bom_numerocrm',
  canal: 'dgt_bom_canal',
  modalidade: 'dgt_bom_modalidade',
  executivoVendas: 'dgt_bom_executivovendas',
  dataEntrada: 'dgt_bom_dataentrada',
  prazoEntrega: 'dgt_bom_prazoentrega',
  statusDemanda: 'dgt_bom_statusdemanda',
  observacaoEtapa: 'dgt_bom_observacaoetapa',
  tipoEntrega: 'dgt_bom_tipoentrega',
  solucoesInteresse: 'dgt_bom_solucoesinteresse',
  tipoProjeto: 'dgt_bom_tipoprojeto',
  pontosEstimados: 'dgt_bom_pontosestimados',
  escopo: 'dgt_bom_escopo',
  linkEdital: 'dgt_bom_linkedital',
  origem: 'dgt_bom_origem',
  cadastroCompleto: 'dgt_bom_cadastrocompleto',
  area: 'dgt_bom_area',
  ativo: 'dgt_bom_ativo'
};

export const DEMANDA_RESPONSAVEL = {
  id: 'dgt_bom_demandaresponsavelid',
  demanda: 'dgt_bom_demanda',
  usuario: 'dgt_bom_usuario',
  principal: 'dgt_bom_principal',
  ativo: 'dgt_bom_ativo'
};

export const BOM = {
  id: 'dgt_bom_bomid',
  numero: 'dgt_name',
  demanda: 'dgt_bom_demanda',
  revisao: 'dgt_bom_revisao',
  responsavel: 'dgt_bom_responsavel',
  etapa: 'dgt_bom_etapa',
  dataEnvio: 'dgt_bom_dataenvio',
  ativo: 'dgt_bom_ativo'
};

export const CRITERIO = {
  id: 'dgt_bom_criterioid',
  nome: 'dgt_name',
  descricao: 'dgt_bom_descricao',
  peso: 'dgt_bom_peso',
  ordem: 'dgt_bom_ordem',
  ativo: 'dgt_bom_ativo'
};

export const ANALISE = {
  id: 'dgt_bom_analiseid',
  nome: 'dgt_name',
  demanda: 'dgt_bom_demanda',
  bom: 'dgt_bom_bom',
  avaliador: 'dgt_bom_avaliador',
  dataAnalise: 'dgt_bom_dataanalise',
  pontuacao: 'dgt_bom_pontuacao',
  decisao: 'dgt_bom_decisao',
  parecer: 'dgt_bom_parecer',
  liberaKit: 'dgt_bom_liberakit'
};

export const ANALISE_NOTA = {
  id: 'dgt_bom_analisenotaid',
  nome: 'dgt_name',
  analise: 'dgt_bom_analise',
  criterio: 'dgt_bom_criterio',
  criterioNome: 'dgt_bom_criterionome',
  peso: 'dgt_bom_peso',
  nota: 'dgt_bom_nota',
  pontos: 'dgt_bom_pontos',
  justificativa: 'dgt_bom_justificativa'
};

// Valores das escolhas (100000000 + posição, na ordem do script).
const opcoes = <T extends string>(textos: T[]): Record<T, number> =>
  textos.reduce(
    (mapa, texto, indice) => ({ ...mapa, [texto]: 100000000 + indice }),
    {} as Record<T, number>
  );

export const OPCOES_BOM = {
  uf: opcoes(['RS', 'SC', 'PR', 'SP', 'Outro']),
  canal: opcoes(['Público', 'Privado']),
  modalidade: opcoes(['Edital / licitação', 'Adesão a ata', 'Proposta direta', 'POC / demonstração', 'Aditivo de contrato']),
  statusDemanda: opcoes(['Lead qualificado', 'Na fila', 'Em andamento', 'Concluído']),
  tipoEntrega: opcoes(['POC — Prova de conceito', 'AT — Análise técnica', 'PT — Proposta técnica', 'BOM — Bill of Materials']),
  solucoesInteresse: opcoes(['Safe City', 'Smart Detect', 'Face Detect', 'Safe Way', 'Bridgefy Data', 'Bridgefy Go', 'Crime Report']),
  tipoProjeto: opcoes(['Aquisição', 'Locação 12 meses', 'Locação 24 meses', 'Locação 36 meses', 'Locação 60 meses']),
  origem: opcoes(['Portal', 'Planilha Go/No-Go', 'Licitações (PNCP)']),
  etapa: opcoes(['Dados da demanda', 'Go/No-Go pendente', 'Bloqueado no Go/No-Go', 'Seleção de kit', 'Cálculo de HH', 'B.O.M. pronto', 'Enviado para aprovação']),
  decisao: opcoes(['GO', 'GO com restrição', 'NO-GO'])
};

// Regras da Matriz Go/No-Go (iguais ao protótipo / Planilha_GonoGo.xlsx).
export const LIMITE_GO = 80;
export const LIMITE_GO_COM_RESTRICAO = 60;

export type DecisaoGoNoGo = 'GO' | 'GO com restrição' | 'NO-GO';

// Pontuação 0–100: Σ (nota × peso) × 0,20 (nota de 1 a 5; pesos somam 100).
export const calcularPontuacao = (
  notas: Array<{ nota: number; peso: number }>
): number =>
  Math.round(notas.reduce((soma, item) => soma + item.nota * item.peso * 0.2, 0) * 100) / 100;

export const decisaoPorPontuacao = (
  pontuacao: number
): DecisaoGoNoGo =>
  pontuacao >= LIMITE_GO
    ? 'GO'
    : pontuacao >= LIMITE_GO_COM_RESTRICAO
      ? 'GO com restrição'
      : 'NO-GO';

// Libera a seleção de kit: GO, ou GO com restrição COM parecer.
export const liberaSelecaoKit = (
  decisao: DecisaoGoNoGo,
  parecer?: string
): boolean =>
  decisao === 'GO' ||
  (decisao === 'GO com restrição' && !!(parecer || '').trim());

// Nome de navegação de cada pesquisa (para gravar com @odata.bind).
// É o SchemaName da coluna de pesquisa criado pelo script.
export const BIND_BOM = {
  demandaArea: 'dgt_bom_Area@odata.bind',
  demandaExecutivo: 'dgt_bom_ExecutivoVendas@odata.bind',
  responsavelDemanda: 'dgt_bom_Demanda@odata.bind',
  responsavelUsuario: 'dgt_bom_Usuario@odata.bind',
  bomDemanda: 'dgt_bom_Demanda@odata.bind',
  bomResponsavel: 'dgt_bom_Responsavel@odata.bind',
  analiseDemanda: 'dgt_bom_Demanda@odata.bind',
  analiseBom: 'dgt_bom_Bom@odata.bind',
  analiseAvaliador: 'dgt_bom_Avaliador@odata.bind',
  notaAnalise: 'dgt_bom_Analise@odata.bind',
  notaCriterio: 'dgt_bom_Criterio@odata.bind'
};

// Texto ⇄ valor das escolhas.
export const valorOpcao = (
  mapa: Record<string, number>,
  texto?: string
): number | null =>
  texto && mapa[texto] !== undefined ? mapa[texto] : null;

export const textoOpcao = (
  mapa: Record<string, number>,
  valor: unknown
): string => {
  const numero = Number(valor);
  const achado = Object.keys(mapa).find(chave => mapa[chave] === numero);
  return achado || '';
};
