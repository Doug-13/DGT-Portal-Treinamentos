// ============================================================
// PRAZOS (SLA) DA TAREFA DE LICITAÇÃO NO CLICKUP
//
// Contados em dias úteis ANTES da Data Pregão (encerramento das
// propostas), pela regra de utils/diasUteis.ts:
//
//                                normal   urgente
//   Prazo Análise Inicial          7        6
//   Prazo Análise Técnica          6        5
//   Prazo Impugnação               4        4
//   Prazo Checklist Final          3        3
//   Prazo Proposta e Estratégia    2        2
//   Vencimento da tarefa       Data Pregão  7 dias úteis antes
//
// A mesma tabela está em CriarTarefaClickUpPlugin.cs (que completa
// os campos quando o portal não os envia): mude os dois juntos.
// ============================================================

import { subtrairDiasUteis } from '../../utils/diasUteis';

export const DIAS_UTEIS_PRAZOS = {
  normal: { analiseInicial: 7, analiseTecnica: 6, impugnacao: 4, checklist: 3, proposta: 2 },
  urgente: { analiseInicial: 6, analiseTecnica: 5, impugnacao: 4, checklist: 3, proposta: 2 }
};

// Vencimento da tarefa no modo urgente (dias úteis antes do pregão).
export const DIAS_UTEIS_VENCIMENTO_URGENTE = 7;

export interface IPrazosClickUp {
  dataPregao: number;
  prazoAnaliseInicial: number;
  prazoAnaliseTecnica: number;
  prazoImpugnacao: number;
  prazoChecklist: number;
  prazoProposta: number;
  // due_date da tarefa
  vencimento: number;
}

// undefined quando não há Data Pregão válida.
export const calcularPrazosClickUp = (dataPregao: Date | undefined, urgente: boolean): IPrazosClickUp | undefined => {
  if (!dataPregao || isNaN(dataPregao.getTime())) {
    return undefined;
  }
  const dias = urgente ? DIAS_UTEIS_PRAZOS.urgente : DIAS_UTEIS_PRAZOS.normal;
  const antes = (n: number): number => subtrairDiasUteis(dataPregao, n).getTime();
  return {
    dataPregao: dataPregao.getTime(),
    prazoAnaliseInicial: antes(dias.analiseInicial),
    prazoAnaliseTecnica: antes(dias.analiseTecnica),
    prazoImpugnacao: antes(dias.impugnacao),
    prazoChecklist: antes(dias.checklist),
    prazoProposta: antes(dias.proposta),
    vencimento: urgente ? antes(DIAS_UTEIS_VENCIMENTO_URGENTE) : dataPregao.getTime()
  };
};
