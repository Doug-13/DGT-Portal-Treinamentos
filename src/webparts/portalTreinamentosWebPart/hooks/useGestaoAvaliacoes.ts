import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  AvaliacaoAdminService,
  IAlternativaAdmin,
  IAvaliacaoAdmin,
  IEditarAlternativa,
  IEditarAvaliacao,
  IEditarQuestao,
  INovaAlternativa,
  INovaAvaliacao,
  INovaQuestao,
  INovaQuestaoCompleta,
  IQuestaoAdmin
} from '../services/AvaliacaoAdminService';

export interface IUseGestaoAvaliacoes {
  treinamentoId: string;
  avaliacaoSelecionada?: IAvaliacaoAdmin;
  questaoSelecionada?: IQuestaoAdmin;
  avaliacoes: IAvaliacaoAdmin[];
  questoes: IQuestaoAdmin[];
  alternativas: IAlternativaAdmin[];
  carregando: boolean;
  processando: boolean;
  erro: string;

  selecionarTreinamento:
    (treinamentoId: string) => Promise<void>;

  selecionarAvaliacao:
    (avaliacao: IAvaliacaoAdmin) => Promise<void>;

  selecionarQuestao:
    (questao: IQuestaoAdmin) => Promise<void>;

  criarAvaliacao:
    (dados: INovaAvaliacao) => Promise<void>;

  editarAvaliacao:
    (dados: IEditarAvaliacao) => Promise<void>;

  definirAvaliacaoAtiva:
    (id: string, ativa: boolean) => Promise<void>;

  criarQuestao:
    (dados: INovaQuestao) => Promise<void>;

  criarQuestaoCompleta:
    (
      dados:
        INovaQuestaoCompleta
    ) => Promise<void>;

  editarQuestao:
    (dados: IEditarQuestao) => Promise<void>;

  definirQuestaoAtiva:
    (id: string, ativa: boolean) => Promise<void>;

  criarAlternativa:
    (dados: INovaAlternativa) => Promise<void>;

  editarAlternativa:
    (dados: IEditarAlternativa) => Promise<void>;

  definirAlternativaAtiva:
    (id: string, ativa: boolean) => Promise<void>;
}

export const useGestaoAvaliacoes = (
  dataverse: DataverseService
): IUseGestaoAvaliacoes => {

  const [
    treinamentoId,
    setTreinamentoId
  ] = React.useState('');

  const [
    avaliacaoSelecionada,
    setAvaliacaoSelecionada
  ] = React.useState<
    IAvaliacaoAdmin | undefined
  >(undefined);

  const [
    questaoSelecionada,
    setQuestaoSelecionada
  ] = React.useState<
    IQuestaoAdmin | undefined
  >(undefined);

  const [
    avaliacoes,
    setAvaliacoes
  ] = React.useState<
    IAvaliacaoAdmin[]
  >([]);

  const [
    questoes,
    setQuestoes
  ] = React.useState<
    IQuestaoAdmin[]
  >([]);

  const [
    alternativas,
    setAlternativas
  ] = React.useState<
    IAlternativaAdmin[]
  >([]);

  const [
    carregando,
    setCarregando
  ] = React.useState(false);

  const [
    processando,
    setProcessando
  ] = React.useState(false);

  const [
    erro,
    setErro
  ] = React.useState('');

  const service =
    React.useMemo(
      () =>
        new AvaliacaoAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const carregarAvaliacoes =
    React.useCallback(
      async (
        id: string
      ): Promise<void> => {

        if (!id) {
          setAvaliacoes([]);
          return;
        }

        const dados =
          await service
            .listarAvaliacoes(
              id
            );

        setAvaliacoes(
          dados
        );
      },
      [
        service
      ]
    );

  const carregarQuestoes =
    React.useCallback(
      async (
        id: string
      ): Promise<void> => {

        const dados =
          await service
            .listarQuestoes(
              id
            );

        setQuestoes(
          dados
        );
      },
      [
        service
      ]
    );

  const carregarAlternativas =
    React.useCallback(
      async (
        id: string
      ): Promise<void> => {

        const dados =
          await service
            .listarAlternativas(
              id
            );

        setAlternativas(
          dados
        );
      },
      [
        service
      ]
    );

  const selecionarTreinamento =
    React.useCallback(
      async (
        id: string
      ): Promise<void> => {

        setTreinamentoId(
          id
        );

        setAvaliacaoSelecionada(
          undefined
        );

        setQuestaoSelecionada(
          undefined
        );

        setQuestoes([]);
        setAlternativas([]);

        setCarregando(true);
        setErro('');

        try {

          await carregarAvaliacoes(
            id
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar avaliações.'
          );

        } finally {

          setCarregando(false);
        }
      },
      [
        carregarAvaliacoes
      ]
    );

  const selecionarAvaliacao =
    React.useCallback(
      async (
        avaliacao:
          IAvaliacaoAdmin
      ): Promise<void> => {

        setAvaliacaoSelecionada(
          avaliacao
        );

        setQuestaoSelecionada(
          undefined
        );

        setAlternativas([]);

        setCarregando(true);
        setErro('');

        try {

          await carregarQuestoes(
            avaliacao.id
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar questões.'
          );

        } finally {

          setCarregando(false);
        }
      },
      [
        carregarQuestoes
      ]
    );

  const selecionarQuestao =
    React.useCallback(
      async (
        questao:
          IQuestaoAdmin
      ): Promise<void> => {

        setQuestaoSelecionada(
          questao
        );

        setCarregando(true);
        setErro('');

        try {

          await carregarAlternativas(
            questao.id
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar alternativas.'
          );

        } finally {

          setCarregando(false);
        }
      },
      [
        carregarAlternativas
      ]
    );

  const criarAvaliacao =
    React.useCallback(
      async (
        dados:
          INovaAvaliacao
      ): Promise<void> => {

        setProcessando(true);

        try {
          await service
            .criarAvaliacao(
              dados
            );

          await carregarAvaliacoes(
            dados.treinamentoId
          );
        } finally {
          setProcessando(false);
        }
      },
      [
        carregarAvaliacoes,
        service
      ]
    );

  const editarAvaliacao =
    React.useCallback(
      async (
        dados:
          IEditarAvaliacao
      ): Promise<void> => {

        setProcessando(true);

        try {

          await service
            .editarAvaliacao(
              dados
            );

          await carregarAvaliacoes(
            dados.treinamentoId
          );

          setAvaliacaoSelecionada(
            atual =>
              atual &&
              atual.id === dados.id
                ? {
                    ...atual,
                    ...dados
                  }
                : atual
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarAvaliacoes,
        service
      ]
    );

  const definirAvaliacaoAtiva =
    React.useCallback(
      async (
        id: string,
        ativa: boolean
      ): Promise<void> => {

        setProcessando(true);

        try {

          await service
            .definirAvaliacaoAtiva(
              id,
              ativa
            );

          if (treinamentoId) {
            await carregarAvaliacoes(
              treinamentoId
            );
          }

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarAvaliacoes,
        service,
        treinamentoId
      ]
    );

  const criarQuestao =
    React.useCallback(
      async (
        dados:
          INovaQuestao
      ): Promise<void> => {

        setProcessando(true);

        try {

          await service
            .criarQuestao(
              dados
            );

          await carregarQuestoes(
            dados.avaliacaoId
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarQuestoes,
        service
      ]
    );


  const criarQuestaoCompleta =
    React.useCallback(
      async (
        dados:
          INovaQuestaoCompleta
      ): Promise<void> => {

        setProcessando(
          true
        );

        setErro('');

        try {

          const criada =
            await service
              .criarQuestaoCompleta(
                dados
              );

          await carregarQuestoes(
            dados.avaliacaoId
          );

          setQuestaoSelecionada(
            criada
          );

          await carregarAlternativas(
            criada.id
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao criar questão.'
          );

          throw e;

        } finally {

          setProcessando(
            false
          );
        }
      },
      [
        carregarAlternativas,
        carregarQuestoes,
        service
      ]
    );

  const editarQuestao =
    React.useCallback(
      async (
        dados:
          IEditarQuestao
      ): Promise<void> => {

        setProcessando(true);

        try {

          await service
            .editarQuestao(
              dados
            );

          await carregarQuestoes(
            dados.avaliacaoId
          );

          setQuestaoSelecionada(
            atual =>
              atual &&
              atual.id === dados.id
                ? {
                    ...atual,
                    ...dados
                  }
                : atual
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarQuestoes,
        service
      ]
    );

  const definirQuestaoAtiva =
    React.useCallback(
      async (
        id: string,
        ativa: boolean
      ): Promise<void> => {

        if (!avaliacaoSelecionada) {
          return;
        }

        setProcessando(true);

        try {

          await service
            .definirQuestaoAtiva(
              id,
              ativa
            );

          await carregarQuestoes(
            avaliacaoSelecionada.id
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        avaliacaoSelecionada,
        carregarQuestoes,
        service
      ]
    );

  const criarAlternativa =
    React.useCallback(
      async (
        dados:
          INovaAlternativa
      ): Promise<void> => {

        setProcessando(true);

        try {

          await service
            .criarAlternativa(
              dados
            );

          await carregarAlternativas(
            dados.questaoId
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarAlternativas,
        service
      ]
    );

  const editarAlternativa =
    React.useCallback(
      async (
        dados:
          IEditarAlternativa
      ): Promise<void> => {

        setProcessando(true);

        try {

          await service
            .editarAlternativa(
              dados
            );

          await carregarAlternativas(
            dados.questaoId
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarAlternativas,
        service
      ]
    );

  const definirAlternativaAtiva =
    React.useCallback(
      async (
        id: string,
        ativa: boolean
      ): Promise<void> => {

        if (!questaoSelecionada) {
          return;
        }

        setProcessando(true);

        try {

          await service
            .definirAlternativaAtiva(
              id,
              ativa
            );

          await carregarAlternativas(
            questaoSelecionada.id
          );

        } finally {
          setProcessando(false);
        }
      },
      [
        carregarAlternativas,
        questaoSelecionada,
        service
      ]
    );

  return {
    treinamentoId,
    avaliacaoSelecionada,
    questaoSelecionada,
    avaliacoes,
    questoes,
    alternativas,
    carregando,
    processando,
    erro,
    selecionarTreinamento,
    selecionarAvaliacao,
    selecionarQuestao,
    criarAvaliacao,
    editarAvaliacao,
    definirAvaliacaoAtiva,
    criarQuestao,
    criarQuestaoCompleta,
    editarQuestao,
    definirQuestaoAtiva,
    criarAlternativa,
    editarAlternativa,
    definirAlternativaAtiva
  };
};
