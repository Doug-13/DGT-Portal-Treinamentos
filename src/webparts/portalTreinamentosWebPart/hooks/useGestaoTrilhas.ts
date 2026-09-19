import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IEditarTrilha,
  INovaTrilha,
  ITrilhaAdmin,
  ITrilhaAreaAdmin,
  ITrilhaTreinamentoAdmin,
  ITrilhaTreinamentoEdicao,
  TrilhaAdminService
} from '../services/TrilhaAdminService';

export interface IUseGestaoTrilhas {
  trilhas:
    ITrilhaAdmin[];

  trilhaSelecionada?:
    ITrilhaAdmin;

  treinamentosTrilha:
    ITrilhaTreinamentoAdmin[];

  areasTrilha:
    ITrilhaAreaAdmin[];

  carregando:
    boolean;

  carregandoConteudo:
    boolean;

  processando:
    boolean;

  erro:
    string;

  carregar:
    () => Promise<void>;

  selecionarTrilha:
    (
      trilha:
        ITrilhaAdmin
    ) => Promise<void>;

  limparSelecao:
    () => void;

  criarTrilha:
    (
      dados:
        INovaTrilha
    ) => Promise<ITrilhaAdmin>;

  editarTrilha:
    (
      dados:
        IEditarTrilha
    ) => Promise<void>;

  definirTrilhaAtiva:
    (
      trilhaId:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  salvarTreinamentos:
    (
      trilhaId:
        string,
      itens:
        ITrilhaTreinamentoEdicao[]
    ) => Promise<void>;

  salvarAreas:
    (
      trilhaId:
        string,
      todasAreas:
        boolean,
      areaIds:
        string[]
    ) => Promise<void>;
}

export const useGestaoTrilhas =
  (
    dataverse:
      DataverseService
  ):
    IUseGestaoTrilhas => {

    const service =
      React.useMemo(
        () =>
          new TrilhaAdminService(
            dataverse
          ),
        [
          dataverse
        ]
      );

    const [
      trilhas,
      setTrilhas
    ] =
      React.useState<
        ITrilhaAdmin[]
      >([]);

    const [
      trilhaSelecionada,
      setTrilhaSelecionada
    ] =
      React.useState<
        ITrilhaAdmin | undefined
      >(
        undefined
      );

    const [
      treinamentosTrilha,
      setTreinamentosTrilha
    ] =
      React.useState<
        ITrilhaTreinamentoAdmin[]
      >([]);

    const [
      areasTrilha,
      setAreasTrilha
    ] =
      React.useState<
        ITrilhaAreaAdmin[]
      >([]);

    const [
      carregando,
      setCarregando
    ] =
      React.useState(
        false
      );

    const [
      carregandoConteudo,
      setCarregandoConteudo
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
        async (): Promise<void> => {

          setCarregando(
            true
          );

          setErro('');

          try {

            const lista =
              await service
                .listarTrilhas();

            setTrilhas(
              lista
            );

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar trilhas.'
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

        void carregar();

      },
      [
        carregar
      ]
    );

    const carregarConteudo =
      React.useCallback(
        async (
          trilha:
            ITrilhaAdmin
        ): Promise<void> => {

          setCarregandoConteudo(
            true
          );

          setErro('');

          try {

            const [
              treinamentos,
              areas
            ] =
              await Promise.all([
                service
                  .listarTreinamentosTrilha(
                    trilha.id
                  ),

                service
                  .listarAreasTrilha(
                    trilha.id
                  )
              ]);

            setTreinamentosTrilha(
              treinamentos
            );

            setAreasTrilha(
              areas
            );

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar a configuração da trilha.'
            );

          } finally {

            setCarregandoConteudo(
              false
            );
          }
        },
        [
          service
        ]
      );

    const selecionarTrilha =
      React.useCallback(
        async (
          trilha:
            ITrilhaAdmin
        ): Promise<void> => {

          setTrilhaSelecionada(
            trilha
          );

          await carregarConteudo(
            trilha
          );
        },
        [
          carregarConteudo
        ]
      );

    const limparSelecao =
      React.useCallback(
        (): void => {

          setTrilhaSelecionada(
            undefined
          );

          setTreinamentosTrilha(
            []
          );

          setAreasTrilha(
            []
          );

          setErro('');
        },
        []
      );

    const criarTrilha =
      React.useCallback(
        async (
          dados:
            INovaTrilha
        ): Promise<ITrilhaAdmin> => {

          setProcessando(
            true
          );

          setErro('');

          try {

            const criada =
              await service
                .criarTrilha(
                  dados
                );

            await carregar();

            setTrilhaSelecionada(
              criada
            );

            setTreinamentosTrilha(
              []
            );

            setAreasTrilha(
              []
            );

            return criada;

          } catch (e) {

            const mensagem =
              e instanceof Error
                ? e.message
                : 'Erro ao criar trilha.';

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
          carregar,
          service
        ]
      );

    const editarTrilha =
      React.useCallback(
        async (
          dados:
            IEditarTrilha
        ): Promise<void> => {

          setProcessando(
            true
          );

          setErro('');

          try {

            await service
              .editarTrilha(
                dados
              );

            await carregar();

            const atualizada =
              await service
                .obterTrilha(
                  dados.id
                );

            if (
              atualizada
            ) {
              setTrilhaSelecionada(
                atualizada
              );
            }

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao editar trilha.'
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
          service
        ]
      );

    const definirTrilhaAtiva =
      React.useCallback(
        async (
          trilhaId:
            string,
          ativa:
            boolean
        ): Promise<void> => {

          setProcessando(
            true
          );

          setErro('');

          try {

            await service
              .definirTrilhaAtiva(
                trilhaId,
                ativa
              );

            await carregar();

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao alterar trilha.'
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
          service
        ]
      );

    const salvarTreinamentos =
      React.useCallback(
        async (
          trilhaId:
            string,
          itens:
            ITrilhaTreinamentoEdicao[]
        ): Promise<void> => {

          setProcessando(
            true
          );

          setErro('');

          try {

            await service
              .salvarTreinamentos(
                trilhaId,
                itens
              );

            if (
              trilhaSelecionada &&
              trilhaSelecionada.id ===
              trilhaId
            ) {
              await carregarConteudo(
                trilhaSelecionada
              );
            }

            await carregar();

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao salvar treinamentos da trilha.'
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
          carregarConteudo,
          service,
          trilhaSelecionada
        ]
      );

    const salvarAreas =
      React.useCallback(
        async (
          trilhaId:
            string,
          todasAreas:
            boolean,
          areaIds:
            string[]
        ): Promise<void> => {

          setProcessando(
            true
          );

          setErro('');

          try {

            await service
              .salvarAreas(
                trilhaId,
                todasAreas,
                areaIds
              );

            const atualizada =
              await service
                .obterTrilha(
                  trilhaId
                );

            if (
              atualizada
            ) {

              setTrilhaSelecionada(
                atualizada
              );

              await carregarConteudo(
                atualizada
              );
            }

            await carregar();

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao salvar áreas da trilha.'
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
          carregarConteudo,
          service
        ]
      );

    return {
      trilhas,
      trilhaSelecionada,
      treinamentosTrilha,
      areasTrilha,
      carregando,
      carregandoConteudo,
      processando,
      erro,
      carregar,
      selecionarTrilha,
      limparSelecao,
      criarTrilha,
      editarTrilha,
      definirTrilhaAtiva,
      salvarTreinamentos,
      salvarAreas
    };
  };
