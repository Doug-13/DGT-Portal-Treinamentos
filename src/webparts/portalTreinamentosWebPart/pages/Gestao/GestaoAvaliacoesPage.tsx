import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import FluxoTreinamentoEtapas from
  '../../components/common/FluxoTreinamentoEtapas';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IAlternativaAdmin,
  IAvaliacaoAdmin,
  IEditarAlternativa,
  IEditarAvaliacao,
  IEditarQuestao,
  INovaAlternativa,
  INovaAvaliacao,
  INovaQuestao,
  INovaQuestaoCompleta,
  IQuestaoAdmin,
  TipoQuestaoCriacao
} from '../../services/AvaliacaoAdminService';

export interface IGestaoAvaliacoesPageProps {

  treinamentos:
    ITreinamentoAdmin[];

  treinamentoId:
    string;

  avaliacaoSelecionada?:
    IAvaliacaoAdmin;

  questaoSelecionada?:
    IQuestaoAdmin;

  avaliacoes:
    IAvaliacaoAdmin[];

  questoes:
    IQuestaoAdmin[];

  alternativas:
    IAlternativaAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  onVoltar:
    () => void;

  onSelecionarTreinamento:
    (
      id:
        string
    ) => Promise<void>;

  onSelecionarAvaliacao:
    (
      item:
        IAvaliacaoAdmin
    ) => Promise<void>;

  onSelecionarQuestao:
    (
      item:
        IQuestaoAdmin
    ) => Promise<void>;

  onCriarAvaliacao:
    (
      dados:
        INovaAvaliacao
    ) => Promise<void>;

  onEditarAvaliacao:
    (
      dados:
        IEditarAvaliacao
    ) => Promise<void>;

  onDefinirAvaliacaoAtiva:
    (
      id:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  onCriarQuestao:
    (
      dados:
        INovaQuestao
    ) => Promise<void>;

  onCriarQuestaoCompleta:
    (
      dados:
        INovaQuestaoCompleta
    ) => Promise<void>;

  onEditarQuestao:
    (
      dados:
        IEditarQuestao
    ) => Promise<void>;

  onDefinirQuestaoAtiva:
    (
      id:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  onCriarAlternativa:
    (
      dados:
        INovaAlternativa
    ) => Promise<void>;

  onEditarAlternativa:
    (
      dados:
        IEditarAlternativa
    ) => Promise<void>;

  onDefinirAlternativaAtiva:
    (
      id:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  modoFluxo?:
    boolean;

  onConcluir?:
    () => Promise<void>;

  onImportarJson:
    (
      arquivo:
        File
    ) => Promise<string>;

  onEtapaClick?:
    (
      etapa:
        1 | 2 | 3
    ) => void;
}

interface IRespostaRascunho {

  id?:
    string;

  texto:
    string;

  correta:
    boolean;

  ativa?:
    boolean;
}

const C = {
  azul:
    '#0B5CAB',

  azulEscuro:
    '#0B2D4D',

  branco:
    '#FFFFFF',

  texto:
    '#18324A',

  secundario:
    '#64748B',

  borda:
    '#D8E2EC',

  verde:
    '#13795B',

  verdeClaro:
    '#E7F5EE',

  vermelho:
    '#B42318',

  vermelhoClaro:
    '#FDE7E9',

  amareloClaro:
    '#FFF8E1'
};

const card:
  React.CSSProperties = {

  padding:
    '18px',

  background:
    C.branco,

  border:
    `1px solid ${C.borda}`,

  borderRadius:
    '14px'
};

const btn:
  React.CSSProperties = {

  padding:
    '9px 13px',

  border:
    `1px solid ${C.azul}`,

  background:
    C.branco,

  color:
    C.azul,

  borderRadius:
    '8px',

  cursor:
    'pointer',

  fontWeight:
    700
};

const btnPrimary:
  React.CSSProperties = {

  ...btn,

  background:
    C.azul,

  color:
    C.branco
};

const btnDanger:
  React.CSSProperties = {

  ...btn,

  border:
    `1px solid ${C.vermelho}`,

  color:
    C.vermelho
};

const input:
  React.CSSProperties = {

  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '10px 12px',

  border:
    `1px solid ${C.borda}`,

  borderRadius:
    '8px',

  color:
    C.texto,

  background:
    C.branco
};

const tipos:
  Array<{
    tipo:
      TipoQuestaoCriacao;

    titulo:
      string;

    descricao:
      string;
  }> = [
    {
      tipo:
        'Escolha única',

      titulo:
        '◉ Escolha única',

      descricao:
        'Uma resposta correta entre várias opções.'
    },
    {
      tipo:
        'Múltipla escolha',

      titulo:
        '☑ Múltipla escolha',

      descricao:
        'Permite duas ou mais respostas corretas.'
    },
    {
      tipo:
        'Verdadeiro/Falso',

      titulo:
        'V/F Verdadeiro ou falso',

      descricao:
        'Duas opções fixas para resposta rápida.'
    },
    {
      tipo:
        'Sim/Não',

      titulo:
        'S/N Sim ou não',

      descricao:
        'Duas opções fixas: Sim e Não.'
    }
  ];

const respostasIniciais =
  (
    tipo:
      TipoQuestaoCriacao
  ):
    IRespostaRascunho[] => {

    if (
      tipo ===
        'Verdadeiro/Falso'
    ) {
      return [
        {
          texto:
            'Verdadeiro',

          correta:
            true
        },
        {
          texto:
            'Falso',

          correta:
            false
        }
      ];
    }

    if (
      tipo ===
        'Sim/Não'
    ) {
      return [
        {
          texto:
            'Sim',

          correta:
            true
        },
        {
          texto:
            'Não',

          correta:
            false
        }
      ];
    }

    return [
      {
        texto:
          '',

        correta:
          true
      },
      {
        texto:
          '',

        correta:
          false
      }
    ];
  };

const inferirTipoQuestao =
  (
    questao:
      IQuestaoAdmin,
    alternativas:
      IAlternativaAdmin[]
  ):
    TipoQuestaoCriacao => {

    if (
      questao.multiplasRespostas
    ) {
      return 'Múltipla escolha';
    }

    const textos =
      alternativas
        .filter(
          item =>
            item.ativa
        )
        .map(
          item =>
            item.texto
              .trim()
              .toLowerCase()
        );

    if (
      textos.length ===
        2 &&
      textos.indexOf(
        'verdadeiro'
      ) >=
        0 &&
      textos.indexOf(
        'falso'
      ) >=
        0
    ) {
      return 'Verdadeiro/Falso';
    }

    if (
      textos.length ===
        2 &&
      textos.indexOf(
        'sim'
      ) >=
        0 &&
      (
        textos.indexOf(
          'não'
        ) >=
          0 ||
        textos.indexOf(
          'nao'
        ) >=
          0
      )
    ) {
      return 'Sim/Não';
    }

    return 'Escolha única';
  };

const GestaoAvaliacoesPage:
  React.FC<
    IGestaoAvaliacoesPageProps
  > = (
    props
  ) => {

    const inputJsonRef =
      React.useRef<
        HTMLInputElement
      >(
        null
      );

    const [
      importandoJson,
      setImportandoJson
    ] =
      React.useState(
        false
      );

    const [
      mensagemImportacao,
      setMensagemImportacao
    ] =
      React.useState('');

    const [
      erroImportacao,
      setErroImportacao
    ] =
      React.useState('');

    const [
      concluindoFluxo,
      setConcluindoFluxo
    ] =
      React.useState(
        false
      );

    const [
      erroConclusao,
      setErroConclusao
    ] =
      React.useState('');

    const treinamento =
      React.useMemo(
        () =>
          props.treinamentos
            .find(
              item =>
                item.id ===
                props.treinamentoId
            ),
        [
          props.treinamentoId,
          props.treinamentos
        ]
      );

    // ==========================================================
    // MODAL AVALIAÇÃO
    // ==========================================================

    const [
      modalAvaliacao,
      setModalAvaliacao
    ] =
      React.useState(
        false
      );

    const [
      editandoAvaliacao,
      setEditandoAvaliacao
    ] =
      React.useState<
        IAvaliacaoAdmin | undefined
      >(
        undefined
      );

    const [
      nomeAvaliacao,
      setNomeAvaliacao
    ] =
      React.useState(
        'Avaliação final'
      );

    const [
      descricaoAvaliacao,
      setDescricaoAvaliacao
    ] =
      React.useState('');

    const [
      nota,
      setNota
    ] =
      React.useState(
        '70'
      );

    const [
      quantidade,
      setQuantidade
    ] =
      React.useState(
        '10'
      );

    const [
      tentativas,
      setTentativas
    ] =
      React.useState(
        '3'
      );

    const [
      tempoLimite,
      setTempoLimite
    ] =
      React.useState(
        '0'
      );

    const [
      sortearQuestoes,
      setSortearQuestoes
    ] =
      React.useState(
        true
      );

    const [
      embaralharQuestoes,
      setEmbaralharQuestoes
    ] =
      React.useState(
        true
      );

    const [
      embaralharAlternativas,
      setEmbaralharAlternativas
    ] =
      React.useState(
        true
      );

    const [
      mostrarResultado,
      setMostrarResultado
    ] =
      React.useState(
        true
      );

    const [
      mostrarRespostasCorretas,
      setMostrarRespostasCorretas
    ] =
      React.useState(
        false
      );

    const [
      avaliacaoAtiva,
      setAvaliacaoAtiva
    ] =
      React.useState(
        true
      );

    // ==========================================================
    // MODAL QUESTÃO
    // ==========================================================

    const [
      modalQuestao,
      setModalQuestao
    ] =
      React.useState(
        false
      );

    const [
      editandoQuestao,
      setEditandoQuestao
    ] =
      React.useState<
        IQuestaoAdmin | undefined
      >(
        undefined
      );

    const [
      aguardandoAlternativasEdicao,
      setAguardandoAlternativasEdicao
    ] =
      React.useState(
        false
      );

    const [
      tipoQuestao,
      setTipoQuestao
    ] =
      React.useState<
        TipoQuestaoCriacao
      >(
        'Escolha única'
      );

    const [
      enunciado,
      setEnunciado
    ] =
      React.useState('');

    const [
      ordemQuestao,
      setOrdemQuestao
    ] =
      React.useState(
        '1'
      );

    const [
      peso,
      setPeso
    ] =
      React.useState(
        '1'
      );

    const [
      questaoAtiva,
      setQuestaoAtiva
    ] =
      React.useState(
        true
      );

    const [
      respostas,
      setRespostas
    ] =
      React.useState<
        IRespostaRascunho[]
      >(
        respostasIniciais(
          'Escolha única'
        )
      );

    const [
      erroModal,
      setErroModal
    ] =
      React.useState('');

    // ==========================================================
    // ABRIR AVALIAÇÃO
    // ==========================================================

    const abrirAvaliacao =
      (): void => {

        if (
          !props.treinamentoId
        ) {
          return;
        }

        setEditandoAvaliacao(
          undefined
        );

        setNomeAvaliacao(
          'Avaliação final'
        );

        setDescricaoAvaliacao('');

        setNota(
          String(
            treinamento
              ?.notaMinima ||
            70
          )
        );

        setQuantidade(
          '10'
        );

        setTentativas(
          '3'
        );

        setTempoLimite(
          '0'
        );

        setSortearQuestoes(
          true
        );

        setEmbaralharQuestoes(
          true
        );

        setEmbaralharAlternativas(
          true
        );

        setMostrarResultado(
          true
        );

        setMostrarRespostasCorretas(
          false
        );

        setAvaliacaoAtiva(
          true
        );

        setErroModal('');

        setModalAvaliacao(
          true
        );
      };

    const abrirEditarAvaliacao =
      (
        avaliacao:
          IAvaliacaoAdmin
      ): void => {

        setEditandoAvaliacao(
          avaliacao
        );

        setNomeAvaliacao(
          avaliacao.nome
        );

        setDescricaoAvaliacao(
          avaliacao.descricao
        );

        setNota(
          String(
            avaliacao.notaMinima
          )
        );

        setQuantidade(
          String(
            avaliacao.quantidadeQuestoes
          )
        );

        setTentativas(
          String(
            avaliacao.tentativasPermitidas
          )
        );

        setTempoLimite(
          String(
            avaliacao.tempoLimiteMin
          )
        );

        setSortearQuestoes(
          avaliacao.sortearQuestoes
        );

        setEmbaralharQuestoes(
          avaliacao.embaralharQuestoes
        );

        setEmbaralharAlternativas(
          avaliacao.embaralharAlternativas
        );

        setMostrarResultado(
          avaliacao.mostrarResultado
        );

        setMostrarRespostasCorretas(
          avaliacao.mostrarRespostasCorretas
        );

        setAvaliacaoAtiva(
          avaliacao.ativa
        );

        setErroModal('');

        setModalAvaliacao(
          true
        );
      };

    const salvarAvaliacao =
      async (): Promise<void> => {

        setErroModal('');

        const n =
          Number(
            nota
          );

        const q =
          Number(
            quantidade
          );

        const t =
          Number(
            tentativas
          );

        const tempo =
          Number(
            tempoLimite
          );

        if (
          !nomeAvaliacao
            .trim()
        ) {

          setErroModal(
            'Informe o nome da avaliação.'
          );

          return;
        }

        if (
          !Number.isFinite(
            n
          ) ||
          n <
            0 ||
          n >
            100
        ) {

          setErroModal(
            'Nota mínima deve estar entre 0 e 100.'
          );

          return;
        }

        if (
          !Number.isFinite(
            q
          ) ||
          q <=
            0 ||
          !Number.isFinite(
            t
          ) ||
          t <=
            0
        ) {

          setErroModal(
            'Quantidade de questões e tentativas devem ser maiores que zero.'
          );

          return;
        }

        if (
          !Number.isFinite(
            tempo
          ) ||
          tempo <
            0
        ) {

          setErroModal(
            'Tempo limite inválido.'
          );

          return;
        }

        const base:
          INovaAvaliacao = {

          treinamentoId:
            props.treinamentoId,

          nome:
            nomeAvaliacao
              .trim(),

          descricao:
            descricaoAvaliacao
              .trim(),

          notaMinima:
            n,

          quantidadeQuestoes:
            q,

          tentativasPermitidas:
            t,

          tempoLimiteMin:
            tempo,

          sortearQuestoes,

          embaralharQuestoes,

          embaralharAlternativas,

          mostrarResultado,

          mostrarRespostasCorretas,

          ativa:
            avaliacaoAtiva
        };

        try {

          if (
            editandoAvaliacao
          ) {

            await props
              .onEditarAvaliacao({
                ...base,

                id:
                  editandoAvaliacao.id
              });

          } else {

            await props
              .onCriarAvaliacao(
                base
              );
          }

          setModalAvaliacao(
            false
          );

        } catch (e) {

          setErroModal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar avaliação.'
          );
        }
      };

    // ==========================================================
    // QUESTÕES
    // ==========================================================

    const abrirQuestao =
      (): void => {

        if (
          !props.avaliacaoSelecionada
        ) {
          return;
        }

        setEditandoQuestao(
          undefined
        );

        setAguardandoAlternativasEdicao(
          false
        );

        setTipoQuestao(
          'Escolha única'
        );

        setEnunciado('');

        setOrdemQuestao(
          String(
            props.questoes.length +
            1
          )
        );

        setPeso(
          '1'
        );

        setQuestaoAtiva(
          true
        );

        setRespostas(
          respostasIniciais(
            'Escolha única'
          )
        );

        setErroModal('');

        setModalQuestao(
          true
        );
      };

    const abrirEditarQuestao =
      async (
        questao:
          IQuestaoAdmin
      ): Promise<void> => {

        setEditandoQuestao(
          questao
        );

        setEnunciado(
          questao.enunciado
        );

        setOrdemQuestao(
          String(
            questao.ordem
          )
        );

        setPeso(
          String(
            questao.peso
          )
        );

        setQuestaoAtiva(
          questao.ativa
        );

        setAguardandoAlternativasEdicao(
          true
        );

        setErroModal('');

        await props
          .onSelecionarQuestao(
            questao
          );

        setModalQuestao(
          true
        );
      };

    React.useEffect(
      () => {

        if (
          !editandoQuestao ||
          !aguardandoAlternativasEdicao
        ) {
          return;
        }

        if (
          props.questaoSelecionada
            ?.id !==
          editandoQuestao.id
        ) {
          return;
        }

        const lista =
          props.alternativas
            .filter(
              item =>
                item.ativa
            )
            .map(
              item => ({
                id:
                  item.id,

                texto:
                  item.texto,

                correta:
                  item.correta,

                ativa:
                  item.ativa
              })
            );

        if (
          lista.length ===
            0 &&
          props.carregando
        ) {
          return;
        }

        const tipo =
          inferirTipoQuestao(
            editandoQuestao,
            props.alternativas
          );

        setTipoQuestao(
          tipo
        );

        setRespostas(
          lista.length >
            0
            ? lista
            : respostasIniciais(
              tipo
            )
        );

        setAguardandoAlternativasEdicao(
          false
        );

      },
      [
        aguardandoAlternativasEdicao,
        editandoQuestao,
        props.alternativas,
        props.carregando,
        props.questaoSelecionada
      ]
    );

    const trocarTipo =
      (
        novoTipo:
          TipoQuestaoCriacao
      ): void => {

        setTipoQuestao(
          novoTipo
        );

        if (
          novoTipo ===
            'Verdadeiro/Falso' ||
          novoTipo ===
            'Sim/Não'
        ) {

          setRespostas(
            respostasIniciais(
              novoTipo
            )
          );
        }
      };

    const marcarCorreta =
      (
        indice:
          number
      ): void => {

        setRespostas(
          lista =>
            lista.map(
              (
                item,
                i
              ) => {

                if (
                  tipoQuestao ===
                    'Múltipla escolha'
                ) {

                  return i ===
                    indice
                    ? {
                      ...item,

                      correta:
                        !item.correta
                    }
                    : item;
                }

                return {
                  ...item,

                  correta:
                    i ===
                    indice
                };
              }
            )
        );
      };

    const adicionarResposta =
      (): void => {

        setRespostas(
          lista => [
            ...lista,
            {
              texto:
                '',

              correta:
                false
            }
          ]
        );
      };

    const removerResposta =
      (
        indice:
          number
      ): void => {

        setRespostas(
          lista =>
            lista.filter(
              (
                _,
                i
              ) =>
                i !==
                indice
            )
        );
      };

    const salvarQuestao =
      async (): Promise<void> => {

        setErroModal('');

        if (
          !props.avaliacaoSelecionada
        ) {
          return;
        }

        if (
          !enunciado
            .trim()
        ) {

          setErroModal(
            'Informe a pergunta.'
          );

          return;
        }

        const ordem =
          Number(
            ordemQuestao
          );

        const p =
          Number(
            peso
          );

        if (
          !Number.isFinite(
            ordem
          ) ||
          ordem <=
            0
        ) {

          setErroModal(
            'Informe uma ordem válida.'
          );

          return;
        }

        if (
          !Number.isFinite(
            p
          ) ||
          p <=
            0
        ) {

          setErroModal(
            'Informe um peso válido.'
          );

          return;
        }

        const validas =
          respostas
            .filter(
              item =>
                item.texto
                  .trim()
            );

        if (
          validas.length <
            2
        ) {

          setErroModal(
            'Cadastre pelo menos duas respostas.'
          );

          return;
        }

        const corretas =
          validas
            .filter(
              item =>
                item.correta
            )
            .length;

        if (
          corretas ===
            0
        ) {

          setErroModal(
            'Marque pelo menos uma resposta correta.'
          );

          return;
        }

        if (
          tipoQuestao !==
            'Múltipla escolha' &&
          corretas !==
            1
        ) {

          setErroModal(
            'Este tipo deve possuir exatamente uma resposta correta.'
          );

          return;
        }

        try {

          if (
            !editandoQuestao
          ) {

            await props
              .onCriarQuestaoCompleta({
                avaliacaoId:
                  props.avaliacaoSelecionada.id,

                enunciado:
                  enunciado
                    .trim(),

                ordem,

                peso:
                  p,

                tipo:
                  tipoQuestao,

                alternativas:
                  validas.map(
                    item => ({
                      texto:
                        item.texto
                          .trim(),

                      correta:
                        item.correta
                    })
                  )
              });

            setModalQuestao(
              false
            );

            return;
          }

          await props
            .onEditarQuestao({
              id:
                editandoQuestao.id,

              avaliacaoId:
                props.avaliacaoSelecionada.id,

              nome:
                editandoQuestao.nome ||
                `Questão ${ordem}`,

              enunciado:
                enunciado
                  .trim(),

              ordem,

              peso:
                p,

              multiplasRespostas:
                tipoQuestao ===
                'Múltipla escolha',

              ativa:
                questaoAtiva
            });

          const idsMantidos:
            string[] = [];

          for (
            let indice = 0;
            indice <
              validas.length;
            indice +=
              1
          ) {

            const resposta =
              validas[
                indice
              ];

            if (
              resposta.id
            ) {

              idsMantidos.push(
                resposta.id
              );

              await props
                .onEditarAlternativa({
                  id:
                    resposta.id,

                  questaoId:
                    editandoQuestao.id,

                  texto:
                    resposta.texto
                      .trim(),

                  ordem:
                    indice +
                    1,

                  correta:
                    resposta.correta,

                  ativa:
                    true
                });

            } else {

              await props
                .onCriarAlternativa({
                  questaoId:
                    editandoQuestao.id,

                  texto:
                    resposta.texto
                      .trim(),

                  ordem:
                    indice +
                    1,

                  correta:
                    resposta.correta,

                  ativa:
                    true
                });
            }
          }

          const removidas =
            props.alternativas
              .filter(
                alternativa =>
                  alternativa.ativa &&
                  idsMantidos
                    .indexOf(
                      alternativa.id
                    ) <
                    0
              );

          for (
            let indice = 0;
            indice <
              removidas.length;
            indice +=
              1
          ) {

            await props
              .onDefinirAlternativaAtiva(
                removidas[
                  indice
                ].id,
                false
              );
          }

          await props
            .onSelecionarQuestao({
              ...editandoQuestao,

              enunciado:
                enunciado
                  .trim(),

              ordem,

              peso:
                p,

              multiplasRespostas:
                tipoQuestao ===
                'Múltipla escolha',

              ativa:
                questaoAtiva
            });

          setModalQuestao(
            false
          );

        } catch (e) {

          setErroModal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar questão.'
          );
        }
      };

    // ==========================================================
    // IMPORTAÇÃO
    // ==========================================================

    const importarArquivo =
      (
        arquivo:
          File
      ): void => {

        setImportandoJson(
          true
        );

        setMensagemImportacao('');
        setErroImportacao('');

        props
          .onImportarJson(
            arquivo
          )
          .then(
            mensagem => {

              setMensagemImportacao(
                mensagem
              );

              return props
                .onSelecionarTreinamento(
                  props.treinamentoId
                );
            }
          )
          .catch(
            (
              error:
                unknown
            ) => {

              setErroImportacao(
                error instanceof Error
                  ? error.message
                  : 'Erro ao importar JSON.'
              );
            }
          )
          .then(
            () => {

              setImportandoJson(
                false
              );

              if (
                inputJsonRef.current
              ) {

                inputJsonRef.current.value =
                  '';
              }
            }
          )
          .catch(
            (
              error:
                unknown
            ) =>
              console.error(
                error
              )
          );
      };

    return (
      <section>

        <PageHeader
          titulo={
            props.modoFluxo
              ? 'Avaliação do treinamento'
              : 'Gestão de avaliações'
          }
          subtitulo={
            props.modoFluxo
              ? 'Etapa 3 de 3 — configure a prova, revise questões importadas e conclua o cadastro.'
              : 'Crie, importe e edite avaliações, questões e alternativas.'
          }
        />

        {
          props.modoFluxo &&
          (
            <FluxoTreinamentoEtapas
              etapa={
                3
              }
              permitirNavegacao={
                true
              }
              onEtapaClick={
                props.onEtapaClick
              }
            />
          )
        }

        <input
          ref={
            inputJsonRef
          }
          type="file"
          accept=".json,application/json"
          style={{
            display:
              'none'
          }}
          onChange={
            event => {

              const arquivo =
                event.target
                  .files &&
                event.target
                  .files[
                    0
                  ];

              if (
                arquivo
              ) {
                importarArquivo(
                  arquivo
                );
              }
            }
          }
        />

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            alignItems:
              'center',

            gap:
              '12px',

            flexWrap:
              'wrap',

            marginBottom:
              '18px'
          }}
        >
          <button
            type="button"
            onClick={
              props.onVoltar
            }
            style={
              btn
            }
          >
            {
              props.modoFluxo
                ? 'Sair do cadastro'
                : 'Voltar'
            }
          </button>

          <div
            style={{
              display:
                'flex',

              gap:
                '8px',

              flexWrap:
                'wrap'
            }}
          >
            <button
              type="button"
              disabled={
                !props.treinamentoId ||
                importandoJson
              }
              onClick={() =>
                inputJsonRef.current
                  ?.click()
              }
              style={{
                ...btn,

                opacity:
                  !props.treinamentoId ||
                  importandoJson
                    ? .55
                    : 1
              }}
            >
              {
                importandoJson
                  ? 'Importando JSON...'
                  : '⬆ Importar prova por JSON'
              }
            </button>

            <button
              type="button"
              disabled={
                !props.treinamentoId
              }
              onClick={
                abrirAvaliacao
              }
              style={{
                ...btnPrimary,

                opacity:
                  props.treinamentoId
                    ? 1
                    : .55
              }}
            >
              + Nova avaliação
            </button>
          </div>
        </div>

        {
          mensagemImportacao &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                background:
                  C.verdeClaro,

                color:
                  C.verde
              }}
            >
              {
                mensagemImportacao
              }

              <strong
                style={{
                  display:
                    'block',

                  marginTop:
                    '6px'
                }}
              >
                A prova importada pode ser editada normalmente abaixo.
              </strong>
            </div>
          )
        }

        {
          erroImportacao &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                background:
                  C.vermelhoClaro,

                color:
                  C.vermelho
              }}
            >
              {
                erroImportacao
              }
            </div>
          )
        }

        {
          props.erro &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                background:
                  C.vermelhoClaro,

                color:
                  C.vermelho
              }}
            >
              {
                props.erro
              }
            </div>
          )
        }

        {
          props.modoFluxo
            ? (
              <div
                style={{
                  ...card,

                  marginBottom:
                    '18px',

                  background:
                    '#F8FAFC'
                }}
              >
                <span
                  style={{
                    color:
                      C.secundario,

                    fontSize:
                      '12px'
                  }}
                >
                  Treinamento em configuração
                </span>

                <strong
                  style={{
                    display:
                      'block',

                    marginTop:
                      '4px',

                    color:
                      C.azulEscuro
                  }}
                >
                  {
                    treinamento
                      ? `${treinamento.codigo} - ${treinamento.nome}`
                      : 'Treinamento selecionado'
                  }
                </strong>
              </div>
            )
            : (
              <div
                style={{
                  ...card,

                  marginBottom:
                    '18px'
                }}
              >
                <label>
                  Treinamento
                </label>

                <select
                  value={
                    props.treinamentoId
                  }
                  style={{
                    ...input,

                    marginTop:
                      '8px'
                  }}
                  onChange={
                    event => {

                      props
                        .onSelecionarTreinamento(
                          event.target
                            .value
                        )
                        .catch(
                          (
                            error:
                              unknown
                          ) =>
                            console.error(
                              error
                            )
                        );
                    }
                  }
                >
                  <option value="">
                    Selecione
                  </option>

                  {
                    props.treinamentos
                      .map(
                        item => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {
                              item.codigo
                            } - {
                              item.nome
                            }
                          </option>
                        )
                      )
                  }
                </select>
              </div>
            )
        }

        {
          props.carregando
            ? (
              <div
                style={
                  card
                }
              >
                Carregando...
              </div>
            )
            : (
              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    'minmax(250px,.9fr) minmax(430px,1.5fr) minmax(310px,1fr)',

                  gap:
                    '16px',

                  alignItems:
                    'start'
                }}
              >

                {/* AVALIAÇÕES */}
                <div
                  style={
                    card
                  }
                >
                  <h3
                    style={{
                      marginTop:
                        0,

                      color:
                        C.azulEscuro
                    }}
                  >
                    Avaliações
                  </h3>

                  {
                    props.avaliacoes.length ===
                      0 &&
                    (
                      <p
                        style={{
                          color:
                            C.secundario
                        }}
                      >
                        Nenhuma avaliação cadastrada.
                      </p>
                    )
                  }

                  {
                    props.avaliacoes.map(
                      avaliacao => (
                        <div
                          key={
                            avaliacao.id
                          }
                          style={{
                            padding:
                              '11px 0',

                            borderBottom:
                              '1px solid #EDF0F4'
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              ...btn,

                              width:
                                '100%',

                              textAlign:
                                'left',

                              background:
                                props.avaliacaoSelecionada
                                  ?.id ===
                                avaliacao.id
                                  ? '#EEF6FF'
                                  : C.branco
                            }}
                            onClick={() => {

                              props
                                .onSelecionarAvaliacao(
                                  avaliacao
                                )
                                .catch(
                                  (
                                    error:
                                      unknown
                                  ) =>
                                    console.error(
                                      error
                                    )
                                );

                            }}
                          >
                            {
                              avaliacao.nome
                            }
                          </button>

                          <div
                            style={{
                              display:
                                'flex',

                              justifyContent:
                                'space-between',

                              marginTop:
                                '7px',

                              fontSize:
                                '12px',

                              color:
                                C.secundario
                            }}
                          >
                            <span>
                              Nota: {
                                avaliacao.notaMinima
                              }%
                            </span>

                            <span>
                              {
                                avaliacao.quantidadeQuestoes
                              } questões
                            </span>
                          </div>

                          <div
                            style={{
                              display:
                                'flex',

                              gap:
                                '6px',

                              marginTop:
                                '9px',

                              flexWrap:
                                'wrap'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                abrirEditarAvaliacao(
                                  avaliacao
                                )
                              }
                              style={
                                btn
                              }
                            >
                              Editar avaliação
                            </button>

                            <button
                              type="button"
                              disabled={
                                props.processando
                              }
                              onClick={() => {

                                props
                                  .onDefinirAvaliacaoAtiva(
                                    avaliacao.id,
                                    !avaliacao.ativa
                                  )
                                  .catch(
                                    (
                                      error:
                                        unknown
                                    ) =>
                                      console.error(
                                        error
                                      )
                                  );

                              }}
                              style={
                                avaliacao.ativa
                                  ? btnDanger
                                  : btn
                              }
                            >
                              {
                                avaliacao.ativa
                                  ? 'Desativar'
                                  : 'Ativar'
                              }
                            </button>
                          </div>
                        </div>
                      )
                    )
                  }
                </div>

                {/* QUESTÕES */}
                <div
                  style={
                    card
                  }
                >
                  <div
                    style={{
                      display:
                        'flex',

                      justifyContent:
                        'space-between',

                      alignItems:
                        'center',

                      gap:
                        '10px'
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin:
                            '0 0 3px',

                          color:
                            C.azulEscuro
                        }}
                      >
                        Questões
                      </h3>

                      <small
                        style={{
                          color:
                            C.secundario
                        }}
                      >
                        Questões importadas também podem ser alteradas.
                      </small>
                    </div>

                    <button
                      type="button"
                      disabled={
                        !props.avaliacaoSelecionada
                      }
                      onClick={
                        abrirQuestao
                      }
                      style={{
                        ...btnPrimary,

                        opacity:
                          props.avaliacaoSelecionada
                            ? 1
                            : .5
                      }}
                    >
                      + Nova questão
                    </button>
                  </div>

                  {
                    props.avaliacaoSelecionada &&
                    props.questoes.length ===
                      0 &&
                    (
                      <p
                        style={{
                          color:
                            C.secundario,

                          marginTop:
                            '18px'
                        }}
                      >
                        Nenhuma questão cadastrada.
                      </p>
                    )
                  }

                  {
                    props.questoes.map(
                      questao => (
                        <div
                          key={
                            questao.id
                          }
                          style={{
                            marginTop:
                              '12px',

                            padding:
                              '13px',

                            border:
                              props.questaoSelecionada
                                ?.id ===
                              questao.id
                                ? `2px solid ${C.azul}`
                                : `1px solid ${C.borda}`,

                            borderRadius:
                              '10px',

                            background:
                              questao.ativa
                                ? C.branco
                                : '#F8FAFC',

                            opacity:
                              questao.ativa
                                ? 1
                                : .7
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {

                              props
                                .onSelecionarQuestao(
                                  questao
                                )
                                .catch(
                                  (
                                    error:
                                      unknown
                                  ) =>
                                    console.error(
                                      error
                                    )
                                );

                            }}
                            style={{
                              width:
                                '100%',

                              border:
                                0,

                              background:
                                'transparent',

                              textAlign:
                                'left',

                              cursor:
                                'pointer',

                              color:
                                C.texto
                            }}
                          >
                            <strong>
                              {
                                questao.ordem
                              }.
                            </strong>{' '}
                            {
                              questao.enunciado
                            }
                          </button>

                          <div
                            style={{
                              display:
                                'flex',

                              gap:
                                '8px',

                              marginTop:
                                '9px',

                              alignItems:
                                'center',

                              flexWrap:
                                'wrap'
                            }}
                          >
                            <span
                              style={{
                                padding:
                                  '3px 7px',

                                borderRadius:
                                  '999px',

                                background:
                                  '#EEF4F8',

                                fontSize:
                                  '11px',

                                fontWeight:
                                  700
                              }}
                            >
                              {
                                questao.multiplasRespostas
                                  ? 'Múltipla escolha'
                                  : 'Escolha única'
                              }
                            </span>

                            <span
                              style={{
                                color:
                                  C.secundario,

                                fontSize:
                                  '12px'
                              }}
                            >
                              Peso {
                                questao.peso
                              }
                            </span>
                          </div>

                          <div
                            style={{
                              display:
                                'flex',

                              gap:
                                '6px',

                              marginTop:
                                '10px',

                              flexWrap:
                                'wrap'
                            }}
                          >
                            <button
                              type="button"
                              disabled={
                                props.processando
                              }
                              onClick={() => {

                                abrirEditarQuestao(
                                  questao
                                )
                                  .catch(
                                    (
                                      error:
                                        unknown
                                    ) =>
                                      console.error(
                                        error
                                      )
                                  );

                              }}
                              style={
                                btn
                              }
                            >
                              Editar questão e respostas
                            </button>

                            <button
                              type="button"
                              disabled={
                                props.processando
                              }
                              onClick={() => {

                                props
                                  .onDefinirQuestaoAtiva(
                                    questao.id,
                                    !questao.ativa
                                  )
                                  .catch(
                                    (
                                      error:
                                        unknown
                                    ) =>
                                      console.error(
                                        error
                                      )
                                  );

                              }}
                              style={
                                questao.ativa
                                  ? btnDanger
                                  : btn
                              }
                            >
                              {
                                questao.ativa
                                  ? 'Desativar'
                                  : 'Ativar'
                              }
                            </button>
                          </div>
                        </div>
                      )
                    )
                  }
                </div>

                {/* RESPOSTAS */}
                <div
                  style={
                    card
                  }
                >
                  <h3
                    style={{
                      marginTop:
                        0,

                      color:
                        C.azulEscuro
                    }}
                  >
                    Respostas
                  </h3>

                  {
                    !props.questaoSelecionada &&
                    (
                      <p
                        style={{
                          color:
                            C.secundario
                        }}
                      >
                        Selecione uma questão.
                      </p>
                    )
                  }

                  {
                    props.alternativas
                      .filter(
                        item =>
                          item.ativa
                      )
                      .map(
                        alternativa => (
                          <div
                            key={
                              alternativa.id
                            }
                            style={{
                              marginTop:
                                '9px',

                              padding:
                                '11px',

                              border:
                                `1px solid ${
                                  alternativa.correta
                                    ? '#A7D7C5'
                                    : C.borda
                                }`,

                              borderRadius:
                                '9px',

                              background:
                                alternativa.correta
                                  ? C.verdeClaro
                                  : C.branco
                            }}
                          >
                            <strong>
                              {
                                alternativa.ordem
                              }.
                            </strong>{' '}
                            {
                              alternativa.texto
                            }

                            <div
                              style={{
                                marginTop:
                                  '5px',

                                fontSize:
                                  '12px',

                                color:
                                  alternativa.correta
                                    ? C.verde
                                    : C.secundario,

                                fontWeight:
                                  alternativa.correta
                                    ? 700
                                    : 400
                              }}
                            >
                              {
                                alternativa.correta
                                  ? '✓ Correta'
                                  : 'Incorreta'
                              }
                            </div>
                          </div>
                        )
                      )
                  }

                  {
                    props.questaoSelecionada &&
                    (
                      <button
                        type="button"
                        onClick={() => {

                          abrirEditarQuestao(
                            props.questaoSelecionada as
                              IQuestaoAdmin
                          )
                            .catch(
                              (
                                error:
                                  unknown
                              ) =>
                                console.error(
                                  error
                                )
                            );

                        }}
                        style={{
                          ...btn,

                          width:
                            '100%',

                          marginTop:
                            '12px'
                        }}
                      >
                        Editar respostas
                      </button>
                    )
                  }
                </div>

              </div>
            )
        }

        {/* FINALIZAR FLUXO */}
        {
          props.modoFluxo &&
          props.onConcluir &&
          (
            <div
              style={{
                marginTop:
                  '24px',

                padding:
                  '18px',

                background:
                  '#FFFFFF',

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '14px'
              }}
            >
              {
                erroConclusao &&
                (
                  <div
                    style={{
                      marginBottom:
                        '12px',

                      padding:
                        '12px',

                      borderRadius:
                        '8px',

                      background:
                        C.vermelhoClaro,

                      color:
                        C.vermelho
                    }}
                  >
                    {
                      erroConclusao
                    }
                  </div>
                )
              }

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  gap:
                    '16px',

                  alignItems:
                    'center',

                  flexWrap:
                    'wrap'
                }}
              >
                <div>
                  <strong
                    style={{
                      display:
                        'block',

                      color:
                        C.azulEscuro,

                      marginBottom:
                        '4px'
                    }}
                  >
                    Finalizar criação do treinamento
                  </strong>

                  <span
                    style={{
                      color:
                        C.secundario,

                      fontSize:
                        '13px'
                    }}
                  >
                    Revise os módulos e a avaliação antes de encerrar.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={
                    props.avaliacoes.length ===
                      0 ||
                    concluindoFluxo ||
                    props.processando
                  }
                  onClick={() => {

                    if (
                      !props.onConcluir
                    ) {
                      return;
                    }

                    setConcluindoFluxo(
                      true
                    );

                    setErroConclusao('');

                    props
                      .onConcluir()
                      .catch(
                        (
                          error:
                            unknown
                        ) => {

                          setErroConclusao(
                            error instanceof Error
                              ? error.message
                              : 'Não foi possível concluir o treinamento.'
                          );
                        }
                      )
                      .then(
                        () => {

                          setConcluindoFluxo(
                            false
                          );
                        }
                      )
                      .catch(
                        (
                          error:
                            unknown
                        ) =>
                          console.error(
                            error
                          )
                      );

                  }}
                  style={{
                    ...btnPrimary,

                    padding:
                      '11px 20px',

                    opacity:
                      props.avaliacoes.length ===
                        0 ||
                      concluindoFluxo ||
                      props.processando
                        ? .55
                        : 1
                  }}
                >
                  {
                    concluindoFluxo
                      ? 'Salvando...'
                      : 'Salvar e encerrar'
                  }
                </button>
              </div>
            </div>
          )
        }

        {/* MODAL AVALIAÇÃO */}
        {
          modalAvaliacao &&
          (
            <div
              style={{
                position:
                  'fixed',

                inset:
                  0,

                zIndex:
                  12000,

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',

                padding:
                  '20px',

                background:
                  'rgba(15,23,42,.58)'
              }}
            >
              <div
                style={{
                  width:
                    '100%',

                  maxWidth:
                    '760px',

                  maxHeight:
                    '92vh',

                  overflowY:
                    'auto',

                  padding:
                    '24px',

                  background:
                    C.branco,

                  borderRadius:
                    '16px'
                }}
              >
                <h2
                  style={{
                    marginTop:
                      0,

                    color:
                      C.azulEscuro
                  }}
                >
                  {
                    editandoAvaliacao
                      ? 'Editar avaliação'
                      : 'Nova avaliação'
                  }
                </h2>

                {
                  erroModal &&
                  (
                    <div
                      style={{
                        padding:
                          '12px',

                        background:
                          C.vermelhoClaro,

                        color:
                          C.vermelho,

                        borderRadius:
                          '8px',

                        marginBottom:
                          '14px'
                      }}
                    >
                      {
                        erroModal
                      }
                    </div>
                  )
                }

                <label>
                  Nome
                </label>

                <input
                  value={
                    nomeAvaliacao
                  }
                  onChange={
                    event =>
                      setNomeAvaliacao(
                        event.target
                          .value
                      )
                  }
                  style={{
                    ...input,

                    marginTop:
                      '6px'
                  }}
                />

                <div
                  style={{
                    height:
                      '12px'
                  }}
                />

                <label>
                  Descrição
                </label>

                <textarea
                  rows={
                    3
                  }
                  value={
                    descricaoAvaliacao
                  }
                  onChange={
                    event =>
                      setDescricaoAvaliacao(
                        event.target
                          .value
                      )
                  }
                  style={{
                    ...input,

                    marginTop:
                      '6px',

                    resize:
                      'vertical'
                  }}
                />

                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      'repeat(4, minmax(130px, 1fr))',

                    gap:
                      '12px',

                    marginTop:
                      '14px'
                  }}
                >
                  <div>
                    <label>
                      Nota mínima (%)
                    </label>

                    <input
                      type="number"
                      value={
                        nota
                      }
                      onChange={
                        event =>
                          setNota(
                            event.target
                              .value
                          )
                      }
                      style={{
                        ...input,

                        marginTop:
                          '6px'
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      Questões da prova
                    </label>

                    <input
                      type="number"
                      value={
                        quantidade
                      }
                      onChange={
                        event =>
                          setQuantidade(
                            event.target
                              .value
                          )
                      }
                      style={{
                        ...input,

                        marginTop:
                          '6px'
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      Tentativas
                    </label>

                    <input
                      type="number"
                      value={
                        tentativas
                      }
                      onChange={
                        event =>
                          setTentativas(
                            event.target
                              .value
                          )
                      }
                      style={{
                        ...input,

                        marginTop:
                          '6px'
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      Tempo limite (min)
                    </label>

                    <input
                      type="number"
                      min={
                        0
                      }
                      value={
                        tempoLimite
                      }
                      onChange={
                        event =>
                          setTempoLimite(
                            event.target
                              .value
                          )
                      }
                      style={{
                        ...input,

                        marginTop:
                          '6px'
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      'repeat(2, minmax(220px, 1fr))',

                    gap:
                      '10px',

                    marginTop:
                      '18px',

                    padding:
                      '14px',

                    background:
                      '#F8FAFC',

                    borderRadius:
                      '10px'
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        sortearQuestoes
                      }
                      onChange={
                        event =>
                          setSortearQuestoes(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Sortear questões
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        embaralharQuestoes
                      }
                      onChange={
                        event =>
                          setEmbaralharQuestoes(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Embaralhar questões
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        embaralharAlternativas
                      }
                      onChange={
                        event =>
                          setEmbaralharAlternativas(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Embaralhar alternativas
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        mostrarResultado
                      }
                      onChange={
                        event =>
                          setMostrarResultado(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Mostrar resultado
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        mostrarRespostasCorretas
                      }
                      onChange={
                        event =>
                          setMostrarRespostasCorretas(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Mostrar respostas corretas
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        avaliacaoAtiva
                      }
                      onChange={
                        event =>
                          setAvaliacaoAtiva(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Avaliação ativa
                  </label>
                </div>

                <div
                  style={{
                    display:
                      'flex',

                    justifyContent:
                      'flex-end',

                    gap:
                      '10px',

                    marginTop:
                      '22px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setModalAvaliacao(
                        false
                      )
                    }
                    style={
                      btn
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {

                      salvarAvaliacao()
                        .catch(
                          (
                            error:
                              unknown
                          ) =>
                            console.error(
                              error
                            )
                        );

                    }}
                    style={
                      btnPrimary
                    }
                  >
                    {
                      props.processando
                        ? 'Salvando...'
                        : editandoAvaliacao
                          ? 'Salvar alterações'
                          : 'Salvar avaliação'
                    }
                  </button>
                </div>

              </div>
            </div>
          )
        }

        {/* MODAL QUESTÃO */}
        {
          modalQuestao &&
          (
            <div
              style={{
                position:
                  'fixed',

                inset:
                  0,

                zIndex:
                  12000,

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',

                padding:
                  '20px',

                background:
                  'rgba(15,23,42,.62)'
              }}
            >
              <div
                style={{
                  width:
                    '100%',

                  maxWidth:
                    '920px',

                  maxHeight:
                    '92vh',

                  overflowY:
                    'auto',

                  padding:
                    '24px',

                  background:
                    C.branco,

                  borderRadius:
                    '16px'
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 4px',

                    color:
                      C.azulEscuro
                  }}
                >
                  {
                    editandoQuestao
                      ? 'Editar questão e respostas'
                      : 'Nova questão'
                  }
                </h2>

                <p
                  style={{
                    margin:
                      '0 0 18px',

                    color:
                      C.secundario
                  }}
                >
                  {
                    editandoQuestao
                      ? 'Altere o enunciado, tipo, ordem, peso e respostas importadas.'
                      : 'Escolha o tipo, escreva a pergunta e cadastre as respostas na mesma tela.'
                  }
                </p>

                {
                  erroModal &&
                  (
                    <div
                      style={{
                        padding:
                          '12px',

                        background:
                          C.vermelhoClaro,

                        color:
                          C.vermelho,

                        borderRadius:
                          '8px',

                        marginBottom:
                          '14px'
                      }}
                    >
                      {
                        erroModal
                      }
                    </div>
                  )
                }

                {
                  aguardandoAlternativasEdicao
                    ? (
                      <div
                        style={{
                          padding:
                            '18px',

                          background:
                            '#F8FAFC',

                          borderRadius:
                            '10px',

                          marginBottom:
                            '16px'
                        }}
                      >
                        Carregando respostas da questão...
                      </div>
                    )
                    : (
                      <>
                        <strong>
                          Tipo da questão
                        </strong>

                        <div
                          style={{
                            display:
                              'grid',

                            gridTemplateColumns:
                              'repeat(4,1fr)',

                            gap:
                              '9px',

                            marginTop:
                              '9px',

                            marginBottom:
                              '18px'
                          }}
                        >
                          {
                            tipos.map(
                              item => (
                                <button
                                  key={
                                    item.tipo
                                  }
                                  type="button"
                                  onClick={() =>
                                    trocarTipo(
                                      item.tipo
                                    )
                                  }
                                  style={{
                                    padding:
                                      '13px',

                                    border:
                                      tipoQuestao ===
                                        item.tipo
                                        ? `2px solid ${C.azul}`
                                        : `1px solid ${C.borda}`,

                                    borderRadius:
                                      '10px',

                                    background:
                                      tipoQuestao ===
                                        item.tipo
                                        ? '#EEF6FF'
                                        : C.branco,

                                    textAlign:
                                      'left',

                                    cursor:
                                      'pointer'
                                  }}
                                >
                                  <strong
                                    style={{
                                      display:
                                        'block',

                                      color:
                                        C.azul,

                                      marginBottom:
                                        '5px'
                                    }}
                                  >
                                    {
                                      item.titulo
                                    }
                                  </strong>

                                  <small
                                    style={{
                                      color:
                                        C.secundario
                                    }}
                                  >
                                    {
                                      item.descricao
                                    }
                                  </small>
                                </button>
                              )
                            )
                          }
                        </div>

                        <label>
                          Pergunta
                        </label>

                        <textarea
                          rows={
                            3
                          }
                          value={
                            enunciado
                          }
                          onChange={
                            event =>
                              setEnunciado(
                                event.target
                                  .value
                              )
                          }
                          style={{
                            ...input,

                            marginTop:
                              '6px',

                            resize:
                              'vertical'
                          }}
                        />

                        <div
                          style={{
                            display:
                              'grid',

                            gridTemplateColumns:
                              '160px 160px 1fr',

                            gap:
                              '12px',

                            marginTop:
                              '14px'
                          }}
                        >
                          <div>
                            <label>
                              Ordem
                            </label>

                            <input
                              type="number"
                              min={
                                1
                              }
                              value={
                                ordemQuestao
                              }
                              onChange={
                                event =>
                                  setOrdemQuestao(
                                    event.target
                                      .value
                                  )
                              }
                              style={{
                                ...input,

                                marginTop:
                                  '6px'
                              }}
                            />
                          </div>

                          <div>
                            <label>
                              Peso
                            </label>

                            <input
                              type="number"
                              min={
                                0.1
                              }
                              step={
                                0.1
                              }
                              value={
                                peso
                              }
                              onChange={
                                event =>
                                  setPeso(
                                    event.target
                                      .value
                                  )
                              }
                              style={{
                                ...input,

                                marginTop:
                                  '6px'
                              }}
                            />
                          </div>

                          <label
                            style={{
                              display:
                                'flex',

                              alignItems:
                                'center',

                              gap:
                                '8px',

                              marginTop:
                                '24px'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                questaoAtiva
                              }
                              onChange={
                                event =>
                                  setQuestaoAtiva(
                                    event.target
                                      .checked
                                  )
                              }
                            />

                            Questão ativa
                          </label>
                        </div>

                        <div
                          style={{
                            marginTop:
                              '20px'
                          }}
                        >
                          <div
                            style={{
                              display:
                                'flex',

                              justifyContent:
                                'space-between',

                              gap:
                                '12px',

                              alignItems:
                                'center'
                            }}
                          >
                            <strong>
                              Respostas
                            </strong>

                            {
                              tipoQuestao !==
                                'Verdadeiro/Falso' &&
                              tipoQuestao !==
                                'Sim/Não' &&
                              (
                                <button
                                  type="button"
                                  onClick={
                                    adicionarResposta
                                  }
                                  style={
                                    btn
                                  }
                                >
                                  + Resposta
                                </button>
                              )
                            }
                          </div>

                          {
                            respostas.map(
                              (
                                resposta,
                                indice
                              ) => (
                                <div
                                  key={
                                    resposta.id ||
                                    `nova-${indice}`
                                  }
                                  style={{
                                    display:
                                      'grid',

                                    gridTemplateColumns:
                                      '34px minmax(220px,1fr) auto',

                                    gap:
                                      '10px',

                                    alignItems:
                                      'center',

                                    marginTop:
                                      '10px'
                                  }}
                                >
                                  <input
                                    type={
                                      tipoQuestao ===
                                        'Múltipla escolha'
                                        ? 'checkbox'
                                        : 'radio'
                                    }
                                    checked={
                                      resposta.correta
                                    }
                                    onChange={() =>
                                      marcarCorreta(
                                        indice
                                      )
                                    }
                                  />

                                  <input
                                    value={
                                      resposta.texto
                                    }
                                    disabled={
                                      tipoQuestao ===
                                        'Verdadeiro/Falso' ||
                                      tipoQuestao ===
                                        'Sim/Não'
                                    }
                                    onChange={
                                      event => {

                                        const valor =
                                          event.target
                                            .value;

                                        setRespostas(
                                          lista =>
                                            lista.map(
                                              (
                                                item,
                                                i
                                              ) =>
                                                i ===
                                                  indice
                                                  ? {
                                                    ...item,

                                                    texto:
                                                      valor
                                                  }
                                                  : item
                                            )
                                        );

                                      }}
                                    style={
                                      input
                                    }
                                  />

                                  {
                                    respostas.length >
                                      2 &&
                                    tipoQuestao !==
                                      'Verdadeiro/Falso' &&
                                    tipoQuestao !==
                                      'Sim/Não' &&
                                    (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removerResposta(
                                            indice
                                          )
                                        }
                                        style={
                                          btnDanger
                                        }
                                      >
                                        Remover
                                      </button>
                                    )
                                  }
                                </div>
                              )
                            )
                          }
                        </div>
                      </>
                    )
                }

                <div
                  style={{
                    display:
                      'flex',

                    justifyContent:
                      'flex-end',

                    gap:
                      '10px',

                    marginTop:
                      '24px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setModalQuestao(
                        false
                      )
                    }
                    style={
                      btn
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando ||
                      aguardandoAlternativasEdicao
                    }
                    onClick={() => {

                      salvarQuestao()
                        .catch(
                          (
                            error:
                              unknown
                          ) =>
                            console.error(
                              error
                            )
                        );

                    }}
                    style={{
                      ...btnPrimary,

                      opacity:
                        props.processando ||
                        aguardandoAlternativasEdicao
                          ? .55
                          : 1
                    }}
                  >
                    {
                      props.processando
                        ? 'Salvando...'
                        : editandoQuestao
                          ? 'Salvar alterações'
                          : 'Salvar questão'
                    }
                  </button>
                </div>

              </div>
            </div>
          )
        }

      </section>
    );
  };

export default GestaoAvaliacoesPage;
