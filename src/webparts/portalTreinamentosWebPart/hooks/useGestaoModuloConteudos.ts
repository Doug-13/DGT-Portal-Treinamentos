import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IEditarModuloConteudo,
  IModuloConteudoAdmin,
  INovoModuloConteudo,
  ModuloConteudoAdminService
} from '../services/ModuloConteudoAdminService';

export interface IUseGestaoModuloConteudos {
  moduloId:
    string;

  conteudos:
    IModuloConteudoAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  selecionarModulo:
    (
      moduloId:
        string
    ) => Promise<void>;

  limpar:
    () => void;

  criar:
    (
      dados:
        INovoModuloConteudo
    ) => Promise<void>;

  editar:
    (
      dados:
        IEditarModuloConteudo
    ) => Promise<void>;

  definirAtivo:
    (
      id:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  moverAcima:
    (
      item:
        IModuloConteudoAdmin
    ) => Promise<void>;

  moverAbaixo:
    (
      item:
        IModuloConteudoAdmin
    ) => Promise<void>;
}

export const useGestaoModuloConteudos =
  (
    dataverse:
      DataverseService
  ):
    IUseGestaoModuloConteudos => {

    const service =
      React.useMemo(
        () =>
          new ModuloConteudoAdminService(
            dataverse
          ),
        [
          dataverse
        ]
      );

    const [
      moduloId,
      setModuloId
    ] =
      React.useState('');

    const [
      conteudos,
      setConteudos
    ] =
      React.useState<
        IModuloConteudoAdmin[]
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

    const carregar =
      React.useCallback(
        async (
          id:
            string
        ): Promise<void> => {

          if (
            !id
          ) {
            setConteudos(
              []
            );

            return;
          }

          setCarregando(
            true
          );

          setErro('');

          try {

            const lista =
              await service
                .listar(
                  id
                );

            setConteudos(
              lista
            );

          } catch (e) {

            setConteudos(
              []
            );

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar conteúdos do módulo.'
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

    const selecionarModulo =
      React.useCallback(
        async (
          id:
            string
        ): Promise<void> => {

          setModuloId(
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

    const limpar =
      React.useCallback(
        (): void => {

          setModuloId('');
          setConteudos([]);
          setErro('');
        },
        []
      );

    const executar =
      React.useCallback(
        async (
          acao:
            () =>
              Promise<void>
        ): Promise<void> => {

          setProcessando(
            true
          );

          setErro('');

          try {

            await acao();

            if (
              moduloId
            ) {
              await carregar(
                moduloId
              );
            }

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao processar conteúdo do módulo.'
            );

            throw e;

          } finally {

            setProcessando(
              false
            );
          }
        },
        [
          carregar,
          moduloId
        ]
      );

    const criar =
      React.useCallback(
        async (
          dados:
            INovoModuloConteudo
        ): Promise<void> => {

          await executar(
            () =>
              service.criar(
                dados
              )
          );
        },
        [
          executar,
          service
        ]
      );

    const editar =
      React.useCallback(
        async (
          dados:
            IEditarModuloConteudo
        ): Promise<void> => {

          await executar(
            () =>
              service.editar(
                dados
              )
          );
        },
        [
          executar,
          service
        ]
      );

    const definirAtivo =
      React.useCallback(
        async (
          id:
            string,
          ativo:
            boolean
        ): Promise<void> => {

          await executar(
            () =>
              service.definirAtivo(
                id,
                ativo
              )
          );
        },
        [
          executar,
          service
        ]
      );

    const mover =
      React.useCallback(
        async (
          item:
            IModuloConteudoAdmin,
          deslocamento:
            number
        ): Promise<void> => {

          const indice =
            conteudos
              .findIndex(
                atual =>
                  atual.id ===
                  item.id
              );

          const outroIndice =
            indice +
            deslocamento;

          if (
            indice <
              0 ||
            outroIndice <
              0 ||
            outroIndice >=
              conteudos.length
          ) {
            return;
          }

          const outro =
            conteudos[
              outroIndice
            ];

          await executar(
            () =>
              service.mover(
                item,
                outro
              )
          );
        },
        [
          conteudos,
          executar,
          service
        ]
      );

    const moverAcima =
      React.useCallback(
        (
          item:
            IModuloConteudoAdmin
        ): Promise<void> =>
          mover(
            item,
            -1
          ),
        [
          mover
        ]
      );

    const moverAbaixo =
      React.useCallback(
        (
          item:
            IModuloConteudoAdmin
        ): Promise<void> =>
          mover(
            item,
            1
          ),
        [
          mover
        ]
      );

    return {
      moduloId,
      conteudos,
      carregando,
      processando,
      erro,
      selecionarModulo,
      limpar,
      criar,
      editar,
      definirAtivo,
      moverAcima,
      moverAbaixo
    };
  };
