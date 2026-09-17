import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IEditarTreinamento,
  INovoTreinamento,
  ITreinamentoAdmin,
  TreinamentoAdminService
} from '../services/TreinamentoAdminService';

export interface IUseGestaoTreinamentos {

  treinamentos:
    ITreinamentoAdmin[];

  carregando:
    boolean;

  processandoId:
    string;

  erro:
    string;

  carregar:
    () => Promise<void>;

  criar:
    (
      dados:
        INovoTreinamento
    ) => Promise<void>;

  editar:
    (
      dados:
        IEditarTreinamento
    ) => Promise<void>;

  definirAtivo:
    (
      treinamentoId:
        string,
      ativo:
        boolean
    ) => Promise<void>;
}

export const useGestaoTreinamentos = (
  dataverse:
    DataverseService
): IUseGestaoTreinamentos => {

  const [
    treinamentos,
    setTreinamentos
  ] =
    React.useState<
      ITreinamentoAdmin[]
    >([]);

  const [
    carregando,
    setCarregando
  ] =
    React.useState(
      true
    );

  const [
    processandoId,
    setProcessandoId
  ] =
    React.useState('');

  const [
    erro,
    setErro
  ] =
    React.useState('');

  const service =
    React.useMemo(
      () =>
        new TreinamentoAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  // ============================================================
  // CARREGAR
  // ============================================================

  const carregar =
    React.useCallback(
      async (): Promise<void> => {

        setCarregando(
          true
        );

        setErro('');

        try {

          const dados =
            await service
              .listar();

          setTreinamentos(
            dados
          );

        } catch (e) {

          setTreinamentos(
            []
          );

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar treinamentos.'
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

  // ============================================================
  // CRIAR
  // ============================================================

  const criar =
    React.useCallback(
      async (
        dados:
          INovoTreinamento
      ): Promise<void> => {

        setErro('');

        await service
          .criar(
            dados
          );

        await carregar();
      },
      [
        carregar,
        service
      ]
    );

  // ============================================================
  // EDITAR
  // ============================================================

  const editar =
    React.useCallback(
      async (
        dados:
          IEditarTreinamento
      ): Promise<void> => {

        setErro('');

        setProcessandoId(
          dados.id
        );

        try {

          await service
            .editar(
              dados
            );

          await carregar();

        } finally {

          setProcessandoId('');
        }
      },
      [
        carregar,
        service
      ]
    );

  // ============================================================
  // ATIVAR / DESATIVAR
  // ============================================================

  const definirAtivo =
    React.useCallback(
      async (
        treinamentoId:
          string,
        ativo:
          boolean
      ): Promise<void> => {

        setErro('');

        setProcessandoId(
          treinamentoId
        );

        try {

          await service
            .definirAtivo(
              treinamentoId,
              ativo
            );

          setTreinamentos(
            atual =>
              atual.map(
                treinamento =>
                  treinamento.id ===
                    treinamentoId
                    ? {
                        ...treinamento,
                        ativo
                      }
                    : treinamento
              )
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao atualizar treinamento.'
          );

          throw e;

        } finally {

          setProcessandoId('');
        }
      },
      [
        service
      ]
    );

  // ============================================================
  // CARREGAMENTO INICIAL
  // ============================================================

  React.useEffect(
    () => {

      carregar()
        .catch(
          (
            error:
              unknown
          ) =>
            console.error(
              'Erro ao carregar gestão de treinamentos:',
              error
            )
        );

    },
    [
      carregar
    ]
  );

  return {

    treinamentos,

    carregando,

    processandoId,

    erro,

    carregar,

    criar,

    editar,

    definirAtivo
  };
};