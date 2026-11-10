import {
  IFluxoDefinicao
} from '../../models/Fluxo';

// ============================================================
// COMPATIBILIDADE DE UM FLUXO COM AMBIENTES
//
// Um ambiente pode usar qualquer fluxo de Processos → Fluxos, inclusive
// um desenhado para DOCUMENTOS. Algumas etapas só fazem sentido para
// documentos; no ambiente elas são ignoradas (o fluxo não trava, segue
// adiante). Esta lista avisa o administrador do que não vai acontecer.
// ============================================================

export const avisosFluxoAmbiente = (
  definicao: IFluxoDefinicao
): string[] => {

  const avisos: string[] = [];

  definicao.elementos.forEach(elemento => {

    // Script funciona em ambientes (não é ação de documento).
    if (elemento.tipo === 'tarefaSistema' && elemento.acaoSistema && elemento.acaoSistema !== 'executarScript') {
      avisos.push(`"${elemento.nome}": publicação de documento — no ambiente apenas segue adiante.`);
    }

    if (elemento.tipo === 'eventoRevisao') {
      avisos.push(`"${elemento.nome}": evento de revisão de documento — ignorado no ambiente.`);
    }

    // (String: o tipo "subprocesso" só existe quando a funcionalidade
    // de subprocesso está no código.)
    if (String(elemento.tipo) === 'subprocesso') {
      avisos.push(`"${elemento.nome}": subprocesso cria documentos — não cria nada a partir de um ambiente (só fica registrado).`);
    }

    if (elemento.tipo === 'tarefaHumana' && elemento.anexoArquivo && elemento.anexoArquivo !== 'nao') {
      avisos.push(`"${elemento.nome}": pede o arquivo da revisão — no ambiente o anexo não é solicitado.`);
    }

    if (elemento.tipo === 'tarefaHumana' && elemento.permiteEditarDocumento) {
      avisos.push(`"${elemento.nome}": permite editar o documento — não se aplica ao ambiente.`);
    }
  });

  return avisos;
};
