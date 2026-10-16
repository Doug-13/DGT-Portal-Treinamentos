import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoHistorico,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  STATUS_PLANILHA,
  StatusPlanilha
} from './esquemaOrcamento';

// ============================================================
// SITUAÇÃO DA PLANILHA A PARTIR DO FLUXO DE APROVAÇÃO (CONT-001)
//
// Regras puras (sem acesso a dados), testadas em
// situacaoFluxoOrcamento.test.ts:
//   1ª etapa (preenchimento), nunca avaliada → Em preenchimento
//   1ª etapa depois de uma avaliação          → Devolvida para ajuste
//   qualquer outra etapa                      → Em aprovação
//   fluxo concluído                           → Aprovada
// ============================================================

// Primeira etapa com responsável a partir do início: é a etapa de
// preenchimento da planilha (no CONT-001, "Preenchimento de
// Informações").
export const etapaDePreenchimento = (
  definicao: IFluxoDefinicao
): IFluxoElemento | undefined => {

  const inicio = definicao.elementos.filter(item => item.tipo === 'inicio')[0];

  if (!inicio) {
    return undefined;
  }

  const visitados: string[] = [];
  const fila: string[] = [inicio.id];

  while (fila.length > 0) {
    const atual = fila.shift() as string;
    if (visitados.indexOf(atual) >= 0) {
      continue;
    }
    visitados.push(atual);
    const elemento = definicao.elementos.filter(item => item.id === atual)[0];
    if (elemento && elemento.tipo === 'tarefaHumana') {
      return elemento;
    }
    definicao.transicoes
      .filter(transicao => transicao.origemId === atual && !transicao.excecao)
      .forEach(transicao => fila.push(transicao.destinoId));
  }

  return undefined;
};

// Último passo feito por uma pessoa (não pelo sistema). O motor grava
// o histórico do MAIS RECENTE para o mais antigo (índice 0 = último).
export const ultimoPassoHumano = (
  instancia: IFluxoInstancia
): IFluxoHistorico | undefined => {
  for (let i = 0; i < instancia.historico.length; i++) {
    const passo = instancia.historico[i];
    if (!passo.sistema && passo.acaoChave !== 'iniciar') {
      return passo;
    }
  }
  return undefined;
};

export const situacaoDoFluxo = (
  instancia: IFluxoInstancia,
  definicao: IFluxoDefinicao
): StatusPlanilha => {

  if (instancia.status === 'concluido') {
    return STATUS_PLANILHA.aprovada;
  }

  const preenchimento = etapaDePreenchimento(definicao);

  if (!preenchimento || instancia.elementoAtualId !== preenchimento.id) {
    return STATUS_PLANILHA.emAprovacao;
  }

  // Voltou ao preenchimento depois de alguma avaliação?
  const ultimo = ultimoPassoHumano(instancia);

  return ultimo && ultimo.elementoId !== preenchimento.id
    ? STATUS_PLANILHA.devolvida
    : STATUS_PLANILHA.emPreenchimento;
};
