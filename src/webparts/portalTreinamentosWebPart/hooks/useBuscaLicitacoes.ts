import * as React from 'react';

import {
  IFiltrosLicitacao,
  ILicitacaoResultado,
  IProgressoBusca,
  IResumoBusca
} from '../models/Licitacao';

import {
  buscarLicitacoes
} from '../services/PncpService';

// ============================================================
// MÓDULO LICITAÇÕES — ESTADO DA BUSCA
//
// • Resultados aparecem conforme as páginas chegam (não espera
//   o fim da busca, como no terminal).
// • A lista é mantida ordenada por score (maior primeiro).
// • Cancelar interrompe na próxima requisição / espera.
// • Sair da tela cancela automaticamente a busca em andamento.
// • Nada é gravado: os resultados vivem só na memória da tela.
// ============================================================

export interface IUseBuscaLicitacoes {
  buscando: boolean;
  resultados: ILicitacaoResultado[];
  progresso?: IProgressoBusca;
  resumo?: IResumoBusca;
  filtrosUsados?: IFiltrosLicitacao;
  iniciar: (filtros: IFiltrosLicitacao) => void;
  cancelar: () => void;
  limpar: () => void;
}

const ordenarPorScore = (
  itens: ILicitacaoResultado[]
): ILicitacaoResultado[] =>
  itens
    .slice()
    .sort((a, b) => b.score - a.score);

export const useBuscaLicitacoes = (): IUseBuscaLicitacoes => {

  const [buscando, setBuscando] = React.useState<boolean>(false);
  const [resultados, setResultados] = React.useState<ILicitacaoResultado[]>([]);
  const [progresso, setProgresso] = React.useState<IProgressoBusca | undefined>(undefined);
  const [resumo, setResumo] = React.useState<IResumoBusca | undefined>(undefined);
  const [filtrosUsados, setFiltrosUsados] = React.useState<IFiltrosLicitacao | undefined>(undefined);

  const controleRef = React.useRef<AbortController | undefined>(undefined);
  const montadoRef = React.useRef<boolean>(true);

  React.useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (controleRef.current) {
        controleRef.current.abort();
      }
    };
  }, []);

  const iniciar = React.useCallback(
    (filtros: IFiltrosLicitacao): void => {

      if (controleRef.current) {
        controleRef.current.abort();
      }

      const controle = new AbortController();
      controleRef.current = controle;

      setBuscando(true);
      setResultados([]);
      setResumo(undefined);
      setProgresso(undefined);
      setFiltrosUsados(filtros);

      buscarLicitacoes(
        filtros,
        {
          onProgresso: novo => {
            if (montadoRef.current && controleRef.current === controle) {
              setProgresso(novo);
            }
          },
          onResultados: novos => {
            if (montadoRef.current && controleRef.current === controle) {
              setResultados(atual => ordenarPorScore(atual.concat(novos)));
            }
          }
        },
        controle.signal
      )
        .then(final => {
          if (montadoRef.current && controleRef.current === controle) {
            setResumo(final);
          }
        })
        .catch(erro => {
          // buscarLicitacoes já trata os erros; isto é só proteção.
          console.error('[Licitações] Falha inesperada na busca:', erro);
        })
        .then(() => {
          if (montadoRef.current && controleRef.current === controle) {
            setBuscando(false);
            controleRef.current = undefined;
          }
        })
        .catch(() => undefined);
    },
    []
  );

  const cancelar = React.useCallback((): void => {
    if (controleRef.current) {
      controleRef.current.abort();
    }
  }, []);

  const limpar = React.useCallback((): void => {
    if (controleRef.current) {
      controleRef.current.abort();
      controleRef.current = undefined;
    }
    setBuscando(false);
    setResultados([]);
    setResumo(undefined);
    setProgresso(undefined);
    setFiltrosUsados(undefined);
  }, []);

  return {
    buscando,
    resultados,
    progresso,
    resumo,
    filtrosUsados,
    iniciar,
    cancelar,
    limpar
  };
};

export default useBuscaLicitacoes;
