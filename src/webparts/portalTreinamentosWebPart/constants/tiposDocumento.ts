// ============================================================
// TIPOS DE DOCUMENTO (sigla usada no código: ÁREA-TIPO-NNN)
// Compartilhado entre Novo documento e Processos.
// ============================================================

export interface ITipoDocumento {
  sigla: string;
  nome: string;
  descricao: string;
}

export const TIPOS_DOCUMENTO:
  ITipoDocumento[] = [
    { sigla: 'MAP', nome: 'Mapeamento de Processos (As IS)', descricao: 'Documento base do mapeamento macro do processo: fluxo geral, escopo e limites.' },
    { sigla: 'BPM', nome: 'Mapeamento BPM (To Be)', descricao: 'Modelagem do processo em notação BPMN.' },
    { sigla: 'LIP', nome: 'Levantamento Inicial do Processo', descricao: 'Registro do levantamento inicial realizado com o dono do processo.' },
    { sigla: 'RAC', nome: 'Matriz RACI', descricao: 'Matriz de responsabilidades: Aprovador, Aprovador, Consultado e Informado.' },
    { sigla: 'RMF', nome: 'Relatório de Mapeamento Final', descricao: 'Consolidação final do mapeamento, pronta para validação do dono do processo.' },
    { sigla: 'DDN', nome: 'Descrição de Negócios', descricao: 'Descrição do contexto de negócio em que o processo está inserido.' },
    { sigla: 'DPC', nome: 'Definição dos Processos Críticos', descricao: 'Identificação e justificativa dos processos críticos da área.' },
    { sigla: 'TOR', nome: 'Termo de Referência de Reunião', descricao: 'Registro formal de pauta, participantes e decisões da reunião de mapeamento.' },
    { sigla: 'PDA', nome: 'Plano de Ação', descricao: 'Plano de ação corretiva ou de melhoria, por exemplo 5W2H.' },
    { sigla: 'PIV', nome: 'Priorização de ICs e IVs', descricao: 'Priorização de indicadores críticos e indicadores de valor.' },
    { sigla: 'AES', nome: 'Acompanhamento da Estratégia', descricao: 'Painel de acompanhamento dos objetivos e metas estratégicas.' },
    { sigla: 'POP', nome: 'Procedimento Operacional Padrão', descricao: 'Passo a passo padronizado de execução de um processo.' },
    { sigla: 'RNC', nome: 'Relatório de Não Conformidade', descricao: 'Registro de não conformidades identificadas em auditoria de processos.' },
    { sigla: 'FAC', nome: 'Ferramentas de Análise de Causa', descricao: 'Aplicação de ferramentas de análise de causa raiz.' },
    { sigla: 'PDC', nome: 'Controle de Ciclos de Melhoria', descricao: 'Acompanhamento de ciclos PDCA de melhoria contínua.' },
    { sigla: 'MNS', nome: 'Manual de Nomenclatura e Simbologia', descricao: 'Define regras de nomenclatura, áreas, tipos de documento e pastas de processo.' },
    { sigla: 'LMP', nome: 'Lista Mestra de Processos', descricao: 'Controla sequenciais, nomes de processos e respectivas pastas.' },
    { sigla: 'LMD', nome: 'Lista Mestra de Documentos', descricao: 'Controla sequencial, revisão e status dos documentos controlados.' },

    { sigla: 'MQI', nome: 'Manual da Qualidade Integrado', descricao: 'Recodificada de MQ — Manual da Qualidade/do SGI.' },
    { sigla: 'PSQ', nome: 'Procedimento Sistêmico da Qualidade', descricao: 'Recodificada de PQ — procedimento sistêmico, aplicável a toda a organização.' },
    { sigla: 'POS', nome: 'Procedimento Operacional Setorial', descricao: 'Recodificada de PO — procedimento de um setor ou processo específico.' },
    { sigla: 'IT', nome: 'Instrução de Trabalho', descricao: 'Sem alteração — exceção documentada, 2 letras.' },
    { sigla: 'FRM', nome: 'Formulário', descricao: 'Recodificada de FR — modelo em branco a ser preenchido. ' },
    { sigla: 'REG', nome: 'Registro da Qualidade', descricao: 'Recodificada de RQ — evidência objetiva de execução.' },
    { sigla: 'FLX', nome: 'Fluxograma / Mapa de Processo', descricao: 'Sem alteração.' },
    { sigla: 'DOE', nome: 'Documento de Origem Externo', descricao: 'Recodificada de DE — norma, legislação, manual de fabricante ou documento de cliente.' },


  ];

// Tipo a partir do código do documento (ARQ-POP-001 → POP).
export const tipoDoCodigo = (
  codigo?: string
): string => {
  const partes = (codigo || '').trim().toUpperCase().split('-');
  return partes.length >= 3 ? partes[1] : '';
};

export const nomeDoTipo = (
  sigla: string
): string => {
  const tipo = TIPOS_DOCUMENTO.find(item => item.sigla === sigla);
  return tipo ? tipo.nome : sigla;
};
