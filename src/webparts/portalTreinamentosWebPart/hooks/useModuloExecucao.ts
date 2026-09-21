import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../services/DataverseService';

import {
  ModuloConteudoAdminService,
  IModuloConteudoAdmin
} from '../services/ModuloConteudoAdminService';

export interface IAlternativaPerguntaExecucao {
  id:
    string;

  texto:
    string;

  correta:
    boolean;

  ordem:
    number;
}

export interface IPerguntaRapidaExecucao {
  id:
    string;

  conteudoModuloId:
    string;

  enunciado:
    string;

  tipo:
    number;

  exigirAcerto:
    boolean;

  mostrarFeedback:
    boolean;

  feedbackAcerto:
    string;

  feedbackErro:
    string;

  alternativas:
    IAlternativaPerguntaExecucao[];
}

export interface IConteudoModuloExecucao
  extends
    IModuloConteudoAdmin {
  pergunta?:
    IPerguntaRapidaExecucao;
}

export interface IRespostaPerguntaExecucao {
  perguntaId:
    string;

  correta:
    boolean;
}

export interface IUseModuloExecucao {
  conteudos:
    IConteudoModuloExecucao[];

  carregando:
    boolean;

  erro:
    string;

  respostas:
    IRespostaPerguntaExecucao[];

  carregar:
    (
      moduloId:
        string,
      usuarioTreinamentoId:
        string
    ) => Promise<void>;

  responderPergunta:
    (
      pergunta:
        IPerguntaRapidaExecucao,
      alternativaIds:
        string[]
    ) => Promise<boolean>;

  podeConcluir:
    boolean;

  limpar:
    () => void;
}

const texto =
  (
    registro:
      IDataverseRecord,
    campo:
      string,
    padrao =
      ''
  ): string => {

    const valor =
      registro[
        campo
      ];

    return (
      valor ===
        undefined ||
      valor ===
        null
    )
      ? padrao
      : String(
          valor
        );
  };

const numero =
  (
    registro:
      IDataverseRecord,
    campo:
      string,
    padrao =
      0
  ): number => {

    const valor =
      Number(
        registro[
          campo
        ]
      );

    return Number.isFinite(
      valor
    )
      ? valor
      : padrao;
  };

const booleano =
  (
    registro:
      IDataverseRecord,
    campo:
      string,
    padrao =
      false
  ): boolean => {

    const valor =
      registro[
        campo
      ];

    return typeof valor ===
      'boolean'
      ? valor
      : padrao;
  };

const guid =
  (
    valor:
      unknown
  ): string =>
    String(
      valor ||
      ''
    )
      .replace(
        /[{}]/g,
        ''
      )
      .trim()
      .toLowerCase();

export const useModuloExecucao =
  (
    dataverse:
      DataverseService
  ):
    IUseModuloExecucao => {

    const conteudoService =
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
      conteudos,
      setConteudos
    ] =
      React.useState<
        IConteudoModuloExecucao[]
      >([]);

    const [
      carregando,
      setCarregando
    ] =
      React.useState(
        false
      );

    const [
      erro,
      setErro
    ] =
      React.useState('');

    const [
      respostas,
      setRespostas
    ] =
      React.useState<
        IRespostaPerguntaExecucao[]
      >([]);

    const usuarioTreinamentoAtual =
      React.useRef('');

    const carregar =
      React.useCallback(
        async (
          moduloId:
            string,
          usuarioTreinamentoId:
            string
        ): Promise<void> => {

          usuarioTreinamentoAtual.current =
            usuarioTreinamentoId;

          setCarregando(
            true
          );

          setErro('');
          setRespostas(
            []
          );

          try {

            const base =
              (
                await conteudoService
                  .listar(
                    moduloId
                  )
              )
                .filter(
                  item =>
                    item.ativo
                );

            const resultado:
              IConteudoModuloExecucao[] = [];

            for (
              const item of
              base
            ) {

              if (
                item.tipo !==
                  'Pergunta rápida'
              ) {

                resultado.push(
                  item
                );

                continue;
              }

              const perguntas =
                await dataverse
                  .getPerguntaRapidaModulo(
                    item.id
                  );

              const registro =
                perguntas[
                  0
                ];

              if (
                !registro
              ) {

                resultado.push(
                  item
                );

                continue;
              }

              const perguntaId =
                guid(
                  registro
                    .dgt_moduloperguntaid
                );

              const alternativasBrutas =
                await dataverse
                  .getAlternativasPerguntaRapidaModulo(
                    perguntaId
                  );

              const alternativas:
                IAlternativaPerguntaExecucao[] =
                alternativasBrutas
                  .map(
                    alternativa => ({
                      id:
                        guid(
                          alternativa
                            .dgt_moduloperguntaalternativaid
                        ),

                      texto:
                        texto(
                          alternativa,
                          'dgt_texto'
                        ),

                      correta:
                        booleano(
                          alternativa,
                          'dgt_correta'
                        ),

                      ordem:
                        numero(
                          alternativa,
                          'dgt_ordem'
                        )
                    })
                  )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      a.ordem -
                      b.ordem
                  );

              resultado.push({
                ...item,

                pergunta: {
                  id:
                    perguntaId,

                  conteudoModuloId:
                    item.id,

                  enunciado:
                    texto(
                      registro,
                      'dgt_enunciado'
                    ),

                  tipo:
                    numero(
                      registro,
                      'dgt_tipopergunta'
                    ),

                  exigirAcerto:
                    booleano(
                      registro,
                      'dgt_exigiracerto',
                      true
                    ),

                  mostrarFeedback:
                    booleano(
                      registro,
                      'dgt_mostrarfeedback',
                      true
                    ),

                  feedbackAcerto:
                    texto(
                      registro,
                      'dgt_feedbackacerto',
                      'Correto.'
                    ),

                  feedbackErro:
                    texto(
                      registro,
                      'dgt_feedbackerro',
                      'Revise o conteúdo e tente novamente.'
                    ),

                  alternativas
                }
              });
            }

            setConteudos(
              resultado
            );

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar o conteúdo do módulo.'
            );

            setConteudos(
              []
            );

          } finally {

            setCarregando(
              false
            );
          }
        },
        [
          conteudoService,
          dataverse
        ]
      );

    const responderPergunta =
      React.useCallback(
        async (
          pergunta:
            IPerguntaRapidaExecucao,
          alternativaIds:
            string[]
        ): Promise<boolean> => {

          const selecionadas =
            alternativaIds
              .map(
                guid
              )
              .sort();

          const corretas =
            pergunta.alternativas
              .filter(
                alternativa =>
                  alternativa.correta
              )
              .map(
                alternativa =>
                  guid(
                    alternativa.id
                  )
              )
              .sort();

          const correta =
            selecionadas.length ===
              corretas.length &&
            selecionadas.every(
              (
                id,
                indice
              ) =>
                id ===
                corretas[
                  indice
                ]
            );

          const anterior =
            respostas.find(
              item =>
                item.perguntaId ===
                pergunta.id
            );

          const tentativa =
            anterior
              ? 2
              : 1;

          if (
            usuarioTreinamentoAtual.current
          ) {

            await dataverse
              .registrarRespostaPerguntaRapida(
                pergunta.id,
                usuarioTreinamentoAtual.current,
                JSON.stringify(
                  alternativaIds
                ),
                correta,
                tentativa
              );
          }

          setRespostas(
            lista => {

              const semAtual =
                lista.filter(
                  item =>
                    item.perguntaId !==
                    pergunta.id
                );

              return [
                ...semAtual,
                {
                  perguntaId:
                    pergunta.id,
                  correta
                }
              ];
            }
          );

          return correta;
        },
        [
          dataverse,
          respostas
        ]
      );

    const perguntasObrigatorias =
      conteudos
        .filter(
          item =>
            item.tipo ===
              'Pergunta rápida' &&
            item.pergunta
              ?.exigirAcerto
        )
        .map(
          item =>
            item.pergunta
        )
        .filter(
          (
            pergunta
          ):
            pergunta is
              IPerguntaRapidaExecucao =>
            !!pergunta
        );

    const podeConcluir =
      perguntasObrigatorias
        .every(
          pergunta =>
            respostas.some(
              resposta =>
                resposta.perguntaId ===
                  pergunta.id &&
                resposta.correta
            )
        );

    const limpar =
      React.useCallback(
        (): void => {

          setConteudos(
            []
          );

          setErro('');
          setRespostas(
            []
          );

          usuarioTreinamentoAtual.current =
            '';
        },
        []
      );

    return {
      conteudos,
      carregando,
      erro,
      respostas,
      carregar,
      responderPergunta,
      podeConcluir,
      limpar
    };
  };
