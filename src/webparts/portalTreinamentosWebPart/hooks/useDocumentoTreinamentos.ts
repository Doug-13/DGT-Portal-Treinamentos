import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  TreinamentoDocumentoAdminService,
  ITreinamentoDocumentoAdmin
} from '../services/TreinamentoDocumentoAdminService';

export interface IUseDocumentoTreinamentos {
  vinculos:
    ITreinamentoDocumentoAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  carregar:
    (
      documentoId:
        string
    ) => Promise<void>;

  vincular:
    (
      documentoId:
        string,

      treinamentoId:
        string,

      obrigatorio:
        boolean,

      ordem:
        number,

      observacao:
        string
    ) => Promise<void>;

  desativar:
    (
      documentoId:
        string,

      relacaoId:
        string
    ) => Promise<void>;

  limpar:
    () => void;
}

export const useDocumentoTreinamentos = (
  dataverse:
    DataverseService
): IUseDocumentoTreinamentos => {

  const service =
    React.useMemo(
      () =>
        new TreinamentoDocumentoAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const [
    vinculos,
    setVinculos
  ] =
    React.useState<
      ITreinamentoDocumentoAdmin[]
    >([]);

  const [
    carregando,
    setCarregando
  ] =
    React.useState(false);

  const [
    processando,
    setProcessando
  ] =
    React.useState(false);

  const [
    erro,
    setErro
  ] =
    React.useState('');

  const carregar =
    React.useCallback(
      async (
        documentoId:
          string
      ): Promise<void> => {

        if (
          !documentoId
        ) {
          setVinculos([]);
          return;
        }

        setCarregando(true);
        setErro('');

        try {
          setVinculos(
            await service
              .listarPorDocumento(
                documentoId
              )
          );
        } catch (e) {
          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar treinamentos vinculados.'
          );
        } finally {
          setCarregando(false);
        }
      },
      [
        service
      ]
    );

  const vincular =
    React.useCallback(
      async (
        documentoId:
          string,

        treinamentoId:
          string,

        obrigatorio:
          boolean,

        ordem:
          number,

        observacao:
          string
      ): Promise<void> => {

        setProcessando(true);
        setErro('');

        try {
          await service.vincular({
            documentoId,
            treinamentoId,
            obrigatorio,
            ordem,
            observacao
          });

          setVinculos(
            await service
              .listarPorDocumento(
                documentoId
              )
          );
        } catch (e) {
          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao vincular treinamento.';

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

  const desativar =
    React.useCallback(
      async (
        documentoId:
          string,

        relacaoId:
          string
      ): Promise<void> => {

        setProcessando(true);
        setErro('');

        try {
          await service
            .desativar(
              relacaoId
            );

          setVinculos(
            await service
              .listarPorDocumento(
                documentoId
              )
          );
        } catch (e) {
          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao desvincular treinamento.';

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

  const limpar =
    React.useCallback(
      (): void => {
        setVinculos([]);
        setErro('');
      },
      []
    );

  return {
    vinculos,
    carregando,
    processando,
    erro,
    carregar,
    vincular,
    desativar,
    limpar
  };
};
