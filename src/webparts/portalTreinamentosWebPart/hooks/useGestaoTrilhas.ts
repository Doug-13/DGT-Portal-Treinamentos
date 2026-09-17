import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IAdicionarTreinamentoTrilha,
  IEditarTreinamentoTrilha,
  IEditarTrilha,
  INovaTrilha,
  ITrilhaAdmin,
  ITrilhaTreinamentoAdmin,
  TrilhaAdminService
} from '../services/TrilhaAdminService';

export interface IUseGestaoTrilhas {

  trilhas:
    ITrilhaAdmin[];

  trilhaSelecionada?:
    ITrilhaAdmin;

  treinamentosTrilha:
    ITrilhaTreinamentoAdmin[];

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
    ) => Promise<void>;

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

  adicionarTreinamento:
    (
      dados:
        IAdicionarTreinamentoTrilha
    ) => Promise<void>;

  editarTreinamento:
    (
      dados:
        IEditarTreinamentoTrilha
    ) => Promise<void>;

  removerTreinamento:
    (
      relacaoId:
        string
    ) => Promise<void>;
}

export const useGestaoTrilhas = (
  dataverse:
    DataverseService
): IUseGestaoTrilhas => {

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
    >(undefined);

  const [
    treinamentosTrilha,
    setTreinamentosTrilha
  ] =
    React.useState<
      ITrilhaTreinamentoAdmin[]
    >([]);

  const [
    carregando,
    setCarregando
  ] =
    React.useState(
      true
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
              .listarTrilhas();

          setTrilhas(
            dados
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

  const selecionarTrilha =
    React.useCallback(
      async (
        trilha:
          ITrilhaAdmin
      ): Promise<void> => {

        setTrilhaSelecionada(
          trilha
        );

        setCarregandoConteudo(
          true
        );

        setErro('');

        try {

          const itens =
            await service
              .listarTreinamentosTrilha(
                trilha.id
              );

          setTreinamentosTrilha(
            itens
          );

        } catch (e) {

          setTreinamentosTrilha(
            []
          );

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar treinamentos da trilha.'
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

  const atualizarConteudoSelecionado =
    React.useCallback(
      async (): Promise<void> => {

        if (
          !trilhaSelecionada
        ) {
          return;
        }

        const itens =
          await service
            .listarTreinamentosTrilha(
              trilhaSelecionada.id
            );

        setTreinamentosTrilha(
          itens
        );

        const trilhasAtualizadas =
          await service
            .listarTrilhas();

        setTrilhas(
          trilhasAtualizadas
        );

        const trilhaAtualizada =
          trilhasAtualizadas.find(
            item =>
              item.id ===
              trilhaSelecionada.id
          );

        if (
          trilhaAtualizada
        ) {

          setTrilhaSelecionada(
            trilhaAtualizada
          );
        }
      },
      [
        service,
        trilhaSelecionada
      ]
    );

  const criarTrilha =
    React.useCallback(
      async (
        dados:
          INovaTrilha
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .criarTrilha(
              dados
            );

          await carregar();

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

        try {

          await service
            .editarTrilha(
              dados
            );

          await carregar();

          if (
            trilhaSelecionada?.id ===
            dados.id
          ) {

            setTrilhaSelecionada(
              atual =>
                atual
                  ? {
                      ...atual,

                      nome:
                        dados.nome,

                      descricao:
                        dados.descricao,

                      diasParaConclusao:
                        dados.diasParaConclusao,

                      ativa:
                        dados.ativa
                    }
                  : undefined
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
        trilhaSelecionada
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

        try {

          await service
            .definirTrilhaAtiva(
              trilhaId,
              ativa
            );

          await carregar();

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

  const adicionarTreinamento =
    React.useCallback(
      async (
        dados:
          IAdicionarTreinamentoTrilha
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .adicionarTreinamento(
              dados
            );

          await atualizarConteudoSelecionado();

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        atualizarConteudoSelecionado,
        service
      ]
    );

  const editarTreinamento =
    React.useCallback(
      async (
        dados:
          IEditarTreinamentoTrilha
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .editarTreinamentoTrilha(
              dados
            );

          await atualizarConteudoSelecionado();

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        atualizarConteudoSelecionado,
        service
      ]
    );

  const removerTreinamento =
    React.useCallback(
      async (
        relacaoId:
          string
      ): Promise<void> => {

        setProcessando(
          true
        );

        try {

          await service
            .removerTreinamento(
              relacaoId
            );

          await atualizarConteudoSelecionado();

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        atualizarConteudoSelecionado,
        service
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
              'Erro ao carregar gestão de trilhas:',
              error
            )
        );

    },
    [
      carregar
    ]
  );

  return {

    trilhas,

    trilhaSelecionada,

    treinamentosTrilha,

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

    adicionarTreinamento,

    editarTreinamento,

    removerTreinamento
  };
};