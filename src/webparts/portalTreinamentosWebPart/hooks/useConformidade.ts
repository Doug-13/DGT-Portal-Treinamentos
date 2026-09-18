import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  ConformidadeService,
  IItemConformidade,
  IResumoConformidade
} from '../services/ConformidadeService';

export interface IUseConformidade {
  itens:
    IItemConformidade[];

  resumo:
    IResumoConformidade;

  carregando:
    boolean;

  erro:
    string;

  recarregar:
    () => Promise<void>;
}

const resumoInicial:
  IResumoConformidade = {
    total: 0,
    concluidos: 0,
    pendentes: 0,
    vencidos: 0,
    aVencer: 0,
    bloqueados: 0,
    emAndamento: 0,
    reprovados: 0,
    conformidadePercentual: 0
  };

export const useConformidade = (
  dataverse:
    DataverseService
): IUseConformidade => {

  const [
    itens,
    setItens
  ] =
    React.useState<
      IItemConformidade[]
    >([]);

  const [
    resumo,
    setResumo
  ] =
    React.useState<
      IResumoConformidade
    >(
      resumoInicial
    );

  const [
    carregando,
    setCarregando
  ] =
    React.useState(
      true
    );

  const [
    erro,
    setErro
  ] =
    React.useState('');

  const service =
    React.useMemo(
      () =>
        new ConformidadeService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const recarregar =
    React.useCallback(
      async (): Promise<void> => {

        setCarregando(
          true
        );

        setErro('');

        try {
          const dados =
            await service
              .carregar();

          setItens(
            dados.itens
          );

          setResumo(
            dados.resumo
          );
        } catch (e) {
          setItens([]);
          setResumo(
            resumoInicial
          );

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar conformidade.'
          );
        } finally {
          setCarregando(
            false
          );
        }
      },
      [
        service
      ]
    );

  React.useEffect(
    () => {
      recarregar()
        .catch(
          (
            error:
              unknown
          ) =>
            console.error(
              error
            )
        );
    },
    [
      recarregar
    ]
  );

  return {
    itens,
    resumo,
    carregando,
    erro,
    recarregar
  };
};
