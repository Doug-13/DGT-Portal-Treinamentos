import {
  IFluxoCampo,
  IFluxoDefinicao,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  gravarJson,
  lerJson,
  PREFIXO_ARMAZENAMENTO_TESTE
} from '../../utils/armazenamentoLocal';

// ============================================================
// METADADOS DO PROCESSO
//
// Os metadados pertencem ao PROCESSO, não à versão do fluxo. Todas
// as versões do fluxo usam a lista atual do processo, e a ORDEM da
// lista é a ordem em que os campos aparecem nas telas.
//
// Futuro: tabela dgt_processometadado (ou coluna JSON em
// dgt_processo). Hoje: localStorage do navegador.
// ============================================================

const PREFIXO =
  `${PREFIXO_ARMAZENAMENTO_TESTE}metadados-processo:`;

const copiar = <T>(valor: T): T =>
  JSON.parse(JSON.stringify(valor)) as T;

// undefined = o processo ainda não tem lista salva (nem vazia).
const lerBruto = (
  processoId: string
): IFluxoMetadado[] | undefined =>
  lerJson<IFluxoMetadado[] | undefined>(
    PREFIXO + processoId,
    undefined
  );

export const obterMetadadosProcesso = (
  processoId: string
): IFluxoMetadado[] =>
  lerBruto(processoId) || [];

export const salvarMetadadosProcesso = (
  processoId: string,
  metadados: IFluxoMetadado[]
): void => {
  gravarJson(
    PREFIXO + processoId,
    metadados
  );
};

// Processos criados antes desta mudança guardavam os metadados na
// versão do fluxo. Na primeira leitura, eles passam para o processo
// (do rascunho ou, se não houver, da versão mais nova).
export const migrarMetadadosDasVersoes = (
  processoId: string,
  versoes: IFluxoDefinicao[]
): IFluxoMetadado[] => {

  const atual =
    lerBruto(processoId);

  if (atual) {
    return atual;
  }

  const fonte =
    versoes.find(versao => versao.status === 'rascunho' && !!versao.metadados) ||
    versoes
      .slice()
      .sort((a, b) => b.versao - a.versao)
      .find(versao => !!versao.metadados && versao.metadados.length > 0);

  const metadados =
    fonte && fonte.metadados
      ? copiar(fonte.metadados)
      : [];

  if (versoes.length > 0) {
    salvarMetadadosProcesso(processoId, metadados);
  }

  return metadados;
};

// Usa a lista ATUAL do processo na definição: rótulo, tipo, opções e
// colunas de cada campo vêm do processo, e os campos de cada etapa
// ficam na mesma ordem da tela de processos. Campos cujo metadado
// foi excluído do processo continuam com os dados da versão (para
// revisões antigas não quebrarem), no fim da lista.
export const aplicarMetadadosNaDefinicao = (
  definicao: IFluxoDefinicao,
  metadados: IFluxoMetadado[]
): IFluxoDefinicao => {

  if (metadados.length === 0 && (!definicao.metadados || definicao.metadados.length === 0)) {
    return definicao;
  }

  const ordem =
    metadados.map(item => item.chave);

  const posicao = (
    chave: string
  ): number => {
    const indice = ordem.indexOf(chave);
    return indice < 0 ? ordem.length + 1 : indice;
  };

  return {
    ...definicao,
    metadados: metadados.length > 0 ? metadados : definicao.metadados,
    elementos: definicao.elementos.map(
      elemento => ({
        ...elemento,
        campos: elemento.campos
          .map(
            (campo): IFluxoCampo => {
              const metadado =
                metadados.find(item => item.chave === campo.chave);

              return metadado
                ? {
                  ...campo,
                  rotulo: metadado.rotulo,
                  tipo: metadado.tipo,
                  opcoes: metadado.opcoes,
                  colunas: metadado.colunas,
                  ajuda: metadado.ajuda
                }
                : campo;
            }
          )
          .sort((a, b) => posicao(a.chave) - posicao(b.chave))
      })
    )
  };
};

// Em quantas etapas cada metadado é usado, somando todas as versões
// do fluxo do processo. O rascunho em edição (se houver) entra pelas
// configurações atuais, no lugar da versão rascunho gravada.
export const contarUsoMetadados = (
  versoes: IFluxoDefinicao[],
  camposDoRascunho?: Array<{ campos: IFluxoCampo[] }>
): Record<string, number> => {

  const uso: Record<string, number> = {};

  const somar = (
    campos: IFluxoCampo[]
  ): void => {
    campos.forEach(
      campo => { uso[campo.chave] = (uso[campo.chave] || 0) + 1; }
    );
  };

  versoes.forEach(
    versao => {
      if (camposDoRascunho && versao.status === 'rascunho') {
        return;
      }

      versao.elementos.forEach(elemento => somar(elemento.campos));
    }
  );

  if (camposDoRascunho) {
    camposDoRascunho.forEach(item => somar(item.campos));
  }

  return uso;
};
