// ============================================================
// PROGRESSO DO TREINAMENTO (regra única)
//
// Usada pela tela do treinamento (useModulos) e pelos cartões
// da tela inicial / Meus treinamentos (ProgressoTreinamentoService),
// para que as duas telas mostrem SEMPRE o mesmo percentual.
//
//   • Base = módulos obrigatórios. Se o treinamento não tiver
//     nenhum obrigatório, a base passa a ser todos os módulos.
//   • Progresso = concluídos da base / total da base.
//   • Avaliação liberada = todos os obrigatórios concluídos
//     (sem obrigatórios = liberada).
// ============================================================

export interface IItemProgressoModulo {
  obrigatorio: boolean;
  concluido: boolean;
}

export interface IResultadoProgresso {
  progresso: number;
  concluidos: number;
  total: number;
  avaliacaoLiberada: boolean;
}

export const calcularProgressoModulos = (
  itens: IItemProgressoModulo[]
): IResultadoProgresso => {

  const obrigatorios = itens.filter(item => item.obrigatorio);

  const base = obrigatorios.length > 0
    ? obrigatorios
    : itens;

  const concluidos = base.filter(item => item.concluido).length;

  return {
    progresso: base.length > 0
      ? Math.round((concluidos / base.length) * 100)
      : 0,
    concluidos,
    total: base.length,
    avaliacaoLiberada:
      obrigatorios.length === 0 ||
      obrigatorios.every(item => item.concluido)
  };
};
