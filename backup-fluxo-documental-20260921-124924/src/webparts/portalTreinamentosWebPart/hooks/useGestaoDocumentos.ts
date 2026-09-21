import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  DocumentoAdminService,
  IDocumentoAdmin,
  INovoDocumentoAdmin,
  INovoDocumentoCompleto,
  INovaRevisaoDocumento,
  INovaRevisaoDocumentoArquivo,
  IRevisaoAdmin
} from '../services/DocumentoAdminService';

import {
  SharePointDocumentoService
} from '../services/sharepoint/SharePointDocumentoService';

export interface IUseGestaoDocumentos {
  documentos: IDocumentoAdmin[];
  documentoSelecionado?: IDocumentoAdmin;
  revisoes: IRevisaoAdmin[];
  carregando: boolean;
  processando: boolean;
  erro: string;

  selecionarDocumento:
    (documento: IDocumentoAdmin) => Promise<void>;

  criarDocumentoCompleto:
    (
      dados:
        INovoDocumentoCompleto
    ) => Promise<void>;
  criarDocumento:
    (
      dados:
        INovoDocumentoAdmin
    ) => Promise<void>;
  criarRevisaoComArquivo:
    (
      dados:
        INovaRevisaoDocumentoArquivo
    ) => Promise<void>;
  criarRevisao:
    (dados: INovaRevisaoDocumento) => Promise<void>;

  limparSelecao:
    () => void;
}

export const useGestaoDocumentos = (
  dataverse: DataverseService,
  sharePoint: SharePointDocumentoService
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

  const criarDocumentoCompleto =
    React.useCallback(
      async (
        dados:
          INovoDocumentoCompleto
      ): Promise<void> => {

        setProcessando(
          true
        );

        setErro('');

        try {

          if (
            !dados.arquivo
          ) {
            throw new Error(
              'Selecione o arquivo do documento.'
            );
          }

          const documentoCriado =
            await service
              .criarDocumento(
                dados
              );

          if (
            !documentoCriado.id
          ) {
            throw new Error(
              'O documento foi criado, mas o Dataverse não retornou o ID.'
            );
          }

          const upload =
            await sharePoint
              .uploadArquivo(
                dados.area,
                dados.codigo,
                dados.revisaoInicial,
                dados.arquivo
              );

          await service
            .criarRevisao({
              documentoId:
                documentoCriado.id,

              revisao:
                dados.revisaoInicial,

              dataRevisao:
                new Date()
                  .toISOString(),

              arquivoUrl:
                upload.arquivoUrl,

              responsavel:
                dados.responsavel,

              motivoAlteracao:
                'Criação inicial do documento',

              descricaoAlteracoes:
                'Primeira revisão cadastrada no Portal DGT.',

              requerRetreinamento:
                false,

              justificativa:
                'Não se aplica à criação inicial do documento.'
            });

          setDocumentos(
            await service
              .listarDocumentos()
          );

        } catch (e) {

          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao criar documento completo.';

          setErro(
            mensagem
          );

          throw e;

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        service,
        sharePoint
      ]
    );
  const criarDocumento =
    React.useCallback(
      async (
        dados:
          INovoDocumentoAdmin
      ): Promise<void> => {

        setProcessando(
          true
        );

        setErro('');

        try {

          await service
            .criarDocumento(
              dados
            );

          setDocumentos(
            await service
              .listarDocumentos()
          );

        } catch (e) {

          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao criar documento.';

          setErro(
            mensagem
          );

          throw e;

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        service
      ]
    );
  const criarRevisaoComArquivo =
    React.useCallback(
      async (
        dados:
          INovaRevisaoDocumentoArquivo
      ): Promise<void> => {

        if (
          !documentoSelecionado
        ) {
          throw new Error(
            'Selecione o documento.'
          );
        }

        if (
          !dados.arquivo
        ) {
          throw new Error(
            'Selecione o arquivo da nova revisão.'
          );
        }

        setProcessando(
          true
        );

        setErro('');

        try {

          const upload =
            await sharePoint
              .uploadArquivo(
                documentoSelecionado.area,
                documentoSelecionado.codigo,
                dados.revisao,
                dados.arquivo
              );

          await service
            .criarRevisao({
              ...dados,

              arquivoUrl:
                upload.arquivoUrl,

              requerRetreinamento:
                false,

              justificativa:
                'Definido na publicação da revisão.'
            });

          setRevisoes(
            await service
              .listarRevisoes(
                documentoSelecionado.id
              )
          );

        } catch (e) {

          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao criar nova revisão.';

          setErro(
            mensagem
          );

          throw e;

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        documentoSelecionado,
        service,
        sharePoint
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
    criarRevisaoComArquivo,
    criarDocumentoCompleto,
    criarDocumento,
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




