import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IEditarModulo,
  IModuloAdmin,
  INovoModulo,
  ModuloAdminService
} from '../services/ModuloAdminService';

export interface IUseGestaoModulos {

  treinamentoId:
    string;

  modulos:
    IModuloAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  selecionarTreinamento:
    (
      treinamentoId:
        string
    ) => Promise<void>;

  criar:
    (
      dados:
        INovoModulo
    ) => Promise<void>;

  editar:
    (
      dados:
        IEditarModulo
    ) => Promise<void>;

  definirAtivo:
    (
      moduloId:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  limpar:
    () => void;
}

export const useGestaoModulos = (
  dataverse:
    DataverseService
): IUseGestaoModulos => {

  const [
    treinamentoId,
    setTreinamentoId
  ] =
    React.useState('');

  const [
    modulos,
    setModulos
  ] =
    React.useState<
      IModuloAdmin[]
    >([]);

  const [
    carregando,
    setCarregando
  ] =
    React.useState(
      false
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

  const service =
    React.useMemo(
      () =>
        new ModuloAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const carregar =
    React.useCallback(
      async (
        id:
          string
      ): Promise<void> => {

        if (!id) {
          setModulos([]);
          return;
        }

        setCarregando(
          true
        );

        setErro('');

        try {

          const dados =
            await service
              .listarPorTreinamento(
                id
              );

          setModulos(
            dados
          );

        } catch (e) {

          setModulos([]);

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar módulos.'
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

  const selecionarTreinamento =
    React.useCallback(
      async (
        id:
          string
      ): Promise<void> => {

        setTreinamentoId(
          id
        );

        await carregar(
          id
        );
      },
      [
        carregar
      ]
    );

  const criar =
    React.useCallback(
      async (
        dados:
          INovoModulo
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .criar(
              dados
            );

          await carregar(
            dados.treinamentoId
          );

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        carregar,
        service
      ]
    );

  const editar =
    React.useCallback(
      async (
        dados:
          IEditarModulo
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .editar(
              dados
            );

          await carregar(
            dados.treinamentoId
          );

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        carregar,
        service
      ]
    );

  const definirAtivo =
    React.useCallback(
      async (
        moduloId:
          string,
        ativo:
          boolean
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .definirAtivo(
              moduloId,
              ativo
            );

          if (
            treinamentoId
          ) {

            await carregar(
              treinamentoId
            );
          }

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        carregar,
        service,
        treinamentoId
      ]
    );

  const limpar =
    React.useCallback(
      (): void => {

        setTreinamentoId('');
        setModulos([]);
        setErro('');
      },
      []
    );

  return {
    treinamentoId,
    modulos,
    carregando,
    processando,
    erro,
    selecionarTreinamento,
    criar,
    editar,
    definirAtivo,
    limpar
  };
};