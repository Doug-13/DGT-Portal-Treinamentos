import {
  IFluxoDefinicao,
  IFluxoTransicao
} from '../../models/Fluxo';

// ============================================================
// CORREÇÕES AUTOMÁTICAS DO DESENHO
//
// Armadilha comum: a ligação ETAPA → DECISÃO recebe a condição
// "O botão clicado for → X". Ela passa a deixar chegar à decisão só o
// botão X; os outros botões (ex.: Devolver) nunca chegam lá, mesmo com
// a decisão configurada certa. Como quem separa os botões é a decisão,
// a ligação etapa → decisão deve ser "Qualquer botão" (sempre).
// ============================================================

export interface ILigacaoQueBarraBotoes {
  transicaoId: string;
  etapaId: string;
  etapaNome: string;
  decisaoNome: string;
  // Botão que a ligação deixa passar hoje.
  botaoPermitido: string;
  // Botões da etapa que a decisão trata, mas que não chegam a ela.
  botoesBarrados: string[];
}

const saidasDe = (definicao: IFluxoDefinicao, id: string): IFluxoTransicao[] =>
  definicao.transicoes.filter(item => item.origemId === id);

export const ligacoesQueBarramBotoes = (
  definicao: IFluxoDefinicao
): ILigacaoQueBarraBotoes[] => {

  const encontradas: ILigacaoQueBarraBotoes[] = [];

  definicao.elementos
    .filter(etapa => etapa.tipo === 'tarefaHumana')
    .forEach(etapa => {
      const saidas = saidasDe(definicao, etapa.id);
      saidas
        .filter(ligacao => ligacao.tipoCondicao === 'resultado')
        .forEach(ligacao => {
          const decisao = definicao.elementos.find(item => item.id === ligacao.destinoId);
          if (!decisao || decisao.tipo !== 'gateway') {
            return;
          }
          const resultadosDaDecisao =
            saidasDe(definicao, decisao.id)
              .filter(item => item.tipoCondicao === 'resultado' && !!item.resultado)
              .map(item => item.resultado as string);
          // Botões que a decisão trata, que esta ligação barra e que
          // nenhuma outra saída da etapa leva adiante.
          const barrados =
            etapa.acoes.filter(acao =>
              acao.resultado !== ligacao.resultado &&
              resultadosDaDecisao.indexOf(acao.resultado) >= 0 &&
              !saidas.some(outra =>
                outra.id !== ligacao.id &&
                (outra.tipoCondicao === 'sempre' || outra.padrao || (outra.tipoCondicao === 'resultado' && outra.resultado === acao.resultado))));
          if (barrados.length === 0) {
            return;
          }
          const permitido = etapa.acoes.find(acao => acao.resultado === ligacao.resultado);
          encontradas.push({
            transicaoId: ligacao.id,
            etapaId: etapa.id,
            etapaNome: etapa.nome,
            decisaoNome: decisao.nome || 'decisão',
            botaoPermitido: permitido ? permitido.rotulo : (ligacao.resultado || '—'),
            botoesBarrados: barrados.map(acao => acao.rotulo)
          });
        });
    });

  return encontradas;
};

export const mensagemLigacaoQueBarra = (item: ILigacaoQueBarraBotoes): string =>
  `A ligação "${item.etapaNome} → ${item.decisaoNome}" só deixa passar o botão "${item.botaoPermitido}", ` +
  `por isso ${item.botoesBarrados.length > 1 ? 'os botões' : 'o botão'} "${item.botoesBarrados.join('", "')}" não ` +
  `${item.botoesBarrados.length > 1 ? 'chegam' : 'chega'} à decisão. Como a decisão já separa os botões, deixe essa ligação como ` +
  '"Qualquer botão" (ou use "Corrigir automaticamente").';

// Devolve a definição com essas ligações em "Qualquer botão" (sempre).
export const corrigirLigacoesParaDecisao = (
  definicao: IFluxoDefinicao
): { definicao: IFluxoDefinicao; corrigidas: ILigacaoQueBarraBotoes[] } => {
  const corrigidas = ligacoesQueBarramBotoes(definicao);
  const ids = corrigidas.map(item => item.transicaoId);
  return {
    corrigidas,
    definicao: {
      ...definicao,
      transicoes: definicao.transicoes.map(item =>
        ids.indexOf(item.id) >= 0 ? { ...item, tipoCondicao: 'sempre', resultado: undefined } : item)
    }
  };
};
