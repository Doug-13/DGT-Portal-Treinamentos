import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  AreaAdminService,
  IAreaAdmin,
  IEditarArea,
  IEditarUsuarioArea,
  INovaArea,
  INovoUsuarioArea,
  IUsuarioAreaAdmin,
  IUsuarioDisponivelArea
} from '../services/AreaAdminService';

export interface IUseGestaoAreas {

  areas:
    IAreaAdmin[];

  usuarios:
    IUsuarioDisponivelArea[];

  usuariosAreas:
    IUsuarioAreaAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  carregar:
    () => Promise<void>;

  criarArea:
    (
      dados:
        INovaArea
    ) => Promise<void>;

  editarArea:
    (
      dados:
        IEditarArea
    ) => Promise<void>;

  definirAreaAtiva:
    (
      areaId:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  vincularUsuario:
    (
      dados:
        INovoUsuarioArea
    ) => Promise<void>;

  editarUsuarioArea:
    (
      dados:
        IEditarUsuarioArea
    ) => Promise<void>;

  definirUsuarioAreaAtivo:
    (
      vinculoId:
        string,
      ativo:
        boolean
    ) => Promise<void>;
}

export const useGestaoAreas = (
  dataverse:
    DataverseService
): IUseGestaoAreas => {

  const [
    areas,
    setAreas
  ] =
    React.useState<
      IAreaAdmin[]
    >([]);

  const [
    usuarios,
    setUsuarios
  ] =
    React.useState<
      IUsuarioDisponivelArea[]
    >([]);

  const [
    usuariosAreas,
    setUsuariosAreas
  ] =
    React.useState<
      IUsuarioAreaAdmin[]
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
        new AreaAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const carregar =
    React.useCallback(
      async (): Promise<void> => {

        setCarregando(
          true
        );

        setErro('');

        try {

          const [
            dadosAreas,
            dadosUsuarios,
            dadosVinculos
          ] =
            await Promise.all([
              service.listarAreas(),
              service.listarUsuarios(),
              service.listarUsuariosArea()
            ]);

          setAreas(
            dadosAreas
          );

          setUsuarios(
            dadosUsuarios
          );

          setUsuariosAreas(
            dadosVinculos
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Não foi possível carregar áreas e acessos.'
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

  const executar =
    React.useCallback(
      async (
        acao:
          () => Promise<void>
      ): Promise<void> => {

        setProcessando(
          true
        );

        setErro('');

        try {

          await acao();

          await carregar();

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Não foi possível concluir a operação.'
          );

          throw e;

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        carregar
      ]
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
              error
            )
        );

    },
    [
      carregar
    ]
  );

  return {
    areas,
    usuarios,
    usuariosAreas,
    carregando,
    processando,
    erro,
    carregar,

    criarArea:
      dados =>
        executar(
          () =>
            service.criarArea(
              dados
            )
        ),

    editarArea:
      dados =>
        executar(
          () =>
            service.editarArea(
              dados
            )
        ),

    definirAreaAtiva:
      (
        areaId,
        ativa
      ) =>
        executar(
          () =>
            service.definirAreaAtiva(
              areaId,
              ativa
            )
        ),

    vincularUsuario:
      dados =>
        executar(
          () =>
            service.vincularUsuario(
              dados
            )
        ),

    editarUsuarioArea:
      dados =>
        executar(
          () =>
            service.editarUsuarioArea(
              dados
            )
        ),

    definirUsuarioAreaAtivo:
      (
        vinculoId,
        ativo
      ) =>
        executar(
          () =>
            service.definirUsuarioAreaAtivo(
              vinculoId,
              ativo
            )
        )
  };
};
