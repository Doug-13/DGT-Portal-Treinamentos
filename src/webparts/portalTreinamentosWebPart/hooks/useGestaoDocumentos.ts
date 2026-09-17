import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  DocumentoAdminService,
  IDocumentoAdmin,
  INovaRevisaoDocumento,
  IRevisaoAdmin
} from '../services/DocumentoAdminService';

export interface IUseGestaoDocumentos {
  documentos: IDocumentoAdmin[];
  documentoSelecionado?: IDocumentoAdmin;
  revisoes: IRevisaoAdmin[];
  carregando: boolean;
  processando: boolean;
  erro: string;

  selecionarDocumento:
    (documento: IDocumentoAdmin) => Promise<void>;

  criarRevisao:
    (dados: INovaRevisaoDocumento) => Promise<void>;

  limparSelecao:
    () => void;
}

export const useGestaoDocumentos = (
  dataverse: DataverseService
): IUseGestaoDocumentos => {

  const [
    documentos,
    setDocumentos
  ] =
    React.useState<
      IDocumentoAdmin[]
    >([]);

  const [
    documentoSelecionado,
    setDocumentoSelecionado
  ] =
    React.useState<
      IDocumentoAdmin | undefined
    >(undefined);

  const [
    revisoes,
    setRevisoes
  ] =
    React.useState<
      IRevisaoAdmin[]
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

  const service =
    React.useMemo(
      () =>
        new DocumentoAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const carregarDocumentos =
    React.useCallback(
      async (): Promise<void> => {

        setCarregando(true);
        setErro('');

        try {
          setDocumentos(
            await service
              .listarDocumentos()
          );
        } catch (e) {
          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar documentos.'
          );
        } finally {
          setCarregando(false);
        }
      },
      [
        service
      ]
    );

  const selecionarDocumento =
    React.useCallback(
      async (
        documento:
          IDocumentoAdmin
      ): Promise<void> => {

        setDocumentoSelecionado(
          documento
        );

        setCarregando(true);
        setErro('');

        try {
          setRevisoes(
            await service
              .listarRevisoes(
                documento.id
              )
          );
        } catch (e) {
          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar revisões.'
          );
        } finally {
          setCarregando(false);
        }
      },
      [
        service
      ]
    );

  const criarRevisao =
    React.useCallback(
      async (
        dados:
          INovaRevisaoDocumento
      ): Promise<void> => {

        setProcessando(true);
        setErro('');

        try {
          await service
            .criarRevisao(
              dados
            );

          if (
            documentoSelecionado
          ) {
            setRevisoes(
              await service
                .listarRevisoes(
                  documentoSelecionado.id
                )
            );
          }
        } catch (e) {
          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao criar revisão.';

          setErro(
            mensagem
          );

          throw e;
        } finally {
          setProcessando(false);
        }
      },
      [
        documentoSelecionado,
        service
      ]
    );

  const limparSelecao =
    React.useCallback(
      (): void => {
        setDocumentoSelecionado(
          undefined
        );
        setRevisoes([]);
      },
      []
    );

  React.useEffect(
    () => {
      carregarDocumentos()
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
      carregarDocumentos
    ]
  );

  return {
    documentos,
    documentoSelecionado,
    revisoes,
    carregando,
    processando,
    erro,
    selecionarDocumento,
    criarRevisao,
    limparSelecao
  };
};
