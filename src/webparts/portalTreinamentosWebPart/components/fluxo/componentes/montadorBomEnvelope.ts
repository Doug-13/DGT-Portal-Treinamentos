import {
  ISelecaoKit,
  montarBom,
  normalizarSelecao
} from '../../../services/bom/montadorBom';

import {
  IEnvelopeComponente
} from '../../../services/fluxo/valorComponente';

// ============================================================
// Montador de B.O.M. → envelope do campo "Componente"
// (puro: usado pela tela e pelos testes)
// ============================================================

export const envelopeDoMontador = (
  selecao: ISelecaoKit
): IEnvelopeComponente => {
  const normalizada = normalizarSelecao(selecao);
  const resultado = montarBom(normalizada);
  const erros = resultado.alertas.filter(item => item.nivel === 'erro').map(item => `${item.origem}: ${item.mensagem}`);
  if (normalizada.pontos.length === 0) {
    erros.push('Adicione pelo menos um ponto.');
  }
  return {
    dados: normalizada,
    valido: erros.length === 0,
    erros,
    resumo:
      `${resultado.totais.pontos} ponto(s) · ${resultado.itens.length} itens · ` +
      `${resultado.totais.camerasVideo} câm. vídeo · ${resultado.totais.camerasOcr} câm. LPR`,
    itens: resultado.itens.map(item => ({
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      categoria: String(item.categoria)
    }))
  };
};
