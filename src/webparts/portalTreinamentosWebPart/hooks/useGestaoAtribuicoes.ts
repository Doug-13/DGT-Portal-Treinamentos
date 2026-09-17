import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  AtribuicaoAdminService,
  IAtribuicaoManual,
  IResultadoAtribuicao,
  ITrilhaAtribuicao,
  IUsuarioAtribuicao
} from '../services/AtribuicaoAdminService';

export interface IUseGestaoAtribuicoes {
  usuarios: IUsuarioAtribuicao[];
  trilhas: ITrilhaAtribuicao[];
  carregando: boolean;
  processando: boolean;
  erro: string;
  resultado?: IResultadoAtribuicao;

  carregar:
    () => Promise<void>;

  atribuir:
    (
      dados:
        IAtribuicaoManual
    ) => Promise<IResultadoAtribuicao>;

  limparResultado:
    () => void;
}

export const useGestaoAtribuicoes = (
  dataverse: DataverseService
): IUseGestaoAtribuicoes => {

  const [
    usuarios,
    setUsuarios
  ] =
    React.useState<
      IUsuarioAtribuicao[]
    >([]);

  const [
    trilhas,
    setTrilhas
  ] =
    React.useState<
      ITrilhaAtribuicao[]
    >([]);

  const [
    carregando,
    setCarregando
  ] =
    React.useState(
      true
    );

  const [
    processando,
    setProcessando
  ] =
    React.useState(
      false
    );

  const [
    erro,
    setErro
  ] =
    React.useState('');

  const [
    resultado,
    setResultado
  ] =
    React.useState<
      IResultadoAtribuicao | undefined
    >(undefined);

  const service =
    React.useMemo(
      () =>
        new AtribuicaoAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const carregar =
    React.useCallback(
      async (): Promise<void> => {

        setCarregando(true);
        setErro('');

        try {

          const [
            dadosUsuarios,
            dadosTrilhas
          ] =
            await Promise.all([
              service.listarUsuarios(),
              service.listarTrilhas()
            ]);

          setUsuarios(
            dadosUsuarios
          );

          setTrilhas(
            dadosTrilhas
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar dados para atribuição.'
          );

        } finally {

          setCarregando(false);
        }
      },
      [
        service
      ]
    );

  const atribuir =
    React.useCallback(
      async (
        dados:
          IAtribuicaoManual
      ): Promise<IResultadoAtribuicao> => {

        setProcessando(true);
        setErro('');
        setResultado(undefined);

        try {

          const retorno =
            await service
              .atribuir(
                dados
              );

          setResultado(
            retorno
          );

          return retorno;

        } catch (e) {

          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao processar atribuição.';

          setErro(
            mensagem
          );

          throw e;

        } finally {

          setProcessando(false);
        }
      },
      [
        service
      ]
    );

  const limparResultado =
    React.useCallback(
      (): void => {

        setResultado(
          undefined
        );

        setErro('');
      },
      []
    );

  React.useEffect(
    () => {

      carregar()
        .catch(
          (
            error:
              unknown
          ) =>
            console.error(
              'Erro ao carregar gestão de atribuições:',
              error
            )
        );

    },
    [
      carregar
    ]
  );

  return {
    usuarios,
    trilhas,
    carregando,
    processando,
    erro,
    resultado,
    carregar,
    atribuir,
    limparResultado
  };
};
