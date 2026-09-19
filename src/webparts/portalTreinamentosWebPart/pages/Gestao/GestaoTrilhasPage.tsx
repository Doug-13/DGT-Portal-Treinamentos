import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import FluxoTrilhaEtapas from
  '../../components/common/FluxoTrilhaEtapas';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IEditarTrilha,
  INovaTrilha,
  ITrilhaAdmin,
  ITrilhaAreaAdmin,
  ITrilhaTreinamentoAdmin,
  ITrilhaTreinamentoEdicao
} from '../../services/TrilhaAdminService';

export interface IGestaoTrilhasPageProps {

  trilhas:
    ITrilhaAdmin[];

  trilhaSelecionada?:
    ITrilhaAdmin;

  treinamentosTrilha:
    ITrilhaTreinamentoAdmin[];

  areasTrilha:
    ITrilhaAreaAdmin[];

  treinamentos:
    ITreinamentoAdmin[];

  areas:
    IAreaAdmin[];

  carregando:
    boolean;

  carregandoConteudo:
    boolean;

  processando:
    boolean;

  erro:
    string;

  onVoltar:
    () => void;

  onSelecionarTrilha:
    (
      trilha:
        ITrilhaAdmin
    ) => Promise<void>;

  onLimparSelecao:
    () => void;

  onCriarTrilha:
    (
      dados:
        INovaTrilha
    ) => Promise<ITrilhaAdmin>;

  onEditarTrilha:
    (
      dados:
        IEditarTrilha
    ) => Promise<void>;

  onDefinirTrilhaAtiva:
    (
      trilhaId:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  onSalvarTreinamentos:
    (
      trilhaId:
        string,
      itens:
        ITrilhaTreinamentoEdicao[]
    ) => Promise<void>;

  onSalvarAreas:
    (
      trilhaId:
        string,
      todasAreas:
        boolean,
      areaIds:
        string[]
    ) => Promise<void>;
}

interface IItemTreinamentoLocal {
  treinamentoId:
    string;

  selecionado:
    boolean;

  ordem:
    number;

  obrigatorio:
    boolean;

  diasParaConclusao:
    number;
}

const inputStyle:
  React.CSSProperties = {
  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '10px 12px',

  border:
    '1px solid #d8e2ec',

  borderRadius:
    '8px',

  fontSize:
    '14px',

  color:
    '#18324a',

  background:
    '#ffffff'
};

const cardStyle:
  React.CSSProperties = {
  padding:
    '18px',

  border:
    '1px solid #d8e2ec',

  borderRadius:
    '14px',

  background:
    '#ffffff'
};

const btn:
  React.CSSProperties = {
  padding:
    '9px 13px',

  border:
    '1px solid #0b5cab',

  background:
    '#ffffff',

  color:
    '#0b5cab',

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
    '#0b5cab',

  color:
    '#ffffff'
};

const btnDanger:
  React.CSSProperties = {
  ...btn,

  border:
    '1px solid #b42318',

  color:
    '#b42318'
};

const GestaoTrilhasPage:
  React.FC<
    IGestaoTrilhasPageProps
  > = (
    props
  ) => {

    const [
      etapa,
      setEtapa
    ] =
      React.useState<
        1 | 2 | 3
      >(
        1
      );

    const [
      modoFluxo,
      setModoFluxo
    ] =
      React.useState(
        false
      );

    const [
      nome,
      setNome
    ] =
      React.useState('');

    const [
      descricao,
      setDescricao
    ] =
      React.useState('');

    const [
      observacoes,
      setObservacoes
    ] =
      React.useState('');

    const [
      ativa,
      setAtiva
    ] =
      React.useState(
        true
      );

    const [
      itensTreinamento,
      setItensTreinamento
    ] =
      React.useState<
        IItemTreinamentoLocal[]
      >([]);

    const [
      todasAreas,
      setTodasAreas
    ] =
      React.useState(
        true
      );

    const [
      areasSelecionadas,
      setAreasSelecionadas
    ] =
      React.useState<
        string[]
      >([]);

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const trilhaAtual =
      props.trilhaSelecionada;

    const iniciarNova =
      (): void => {

        props
          .onLimparSelecao();

        setNome('');
        setDescricao('');
        setObservacoes('');
        setAtiva(true);
        setItensTreinamento([]);
        setTodasAreas(true);
        setAreasSelecionadas([]);
        setEtapa(1);
        setErroLocal('');
        setModoFluxo(true);
      };

    const prepararEdicao =
      React.useCallback(
        (
          trilha:
            ITrilhaAdmin
        ): void => {

          setNome(
            trilha.nome
          );

          setDescricao(
            trilha.descricao
          );

          setObservacoes(
            trilha.observacoes
          );

          setAtiva(
            trilha.ativa
          );

          setTodasAreas(
            trilha.todasAreas
          );

          setEtapa(1);
          setErroLocal('');
          setModoFluxo(true);
        },
        []
      );

    React.useEffect(
      () => {

        if (
          !props.trilhaSelecionada
        ) {
          return;
        }

        const selecionados =
          props.treinamentosTrilha
            .filter(
              item =>
                item.ativo
            );

        const locais =
          props.treinamentos
            .map(
              treinamento => {

                const relacao =
                  selecionados.find(
                    item =>
                      item.treinamentoId ===
                      treinamento.id
                  );

                return {
                  treinamentoId:
                    treinamento.id,

                  selecionado:
                    !!relacao,

                  ordem:
                    relacao?.ordem ||
                    0,

                  obrigatorio:
                    relacao?.obrigatorio ??
                    true,

                  diasParaConclusao:
                    relacao
                      ?.diasParaConclusao ||
                    30
                };
              }
            );

        setItensTreinamento(
          locais
        );

        const areas =
          props.areasTrilha
            .filter(
              item =>
                item.ativa
            )
            .map(
              item =>
                item.areaId
            );

        setAreasSelecionadas(
          areas
        );

        setTodasAreas(
          props.trilhaSelecionada
            .todasAreas
        );

      },
      [
        props.areasTrilha,
        props.treinamentos,
        props.treinamentosTrilha,
        props.trilhaSelecionada
      ]
    );

    const editar =
      async (
        trilha:
          ITrilhaAdmin
      ): Promise<void> => {

        await props
          .onSelecionarTrilha(
            trilha
          );

        prepararEdicao(
          trilha
        );
      };

    const salvarEtapa1 =
      async (): Promise<void> => {

        setErroLocal('');

        try {

          if (
            trilhaAtual
          ) {

            await props
              .onEditarTrilha({
                id:
                  trilhaAtual.id,

                nome:
                  nome.trim(),

                descricao:
                  descricao.trim(),

                observacoes:
                  observacoes.trim(),

                ativa
              });

            setEtapa(
              2
            );

            return;
          }

          const criada =
            await props
              .onCriarTrilha({
                nome:
                  nome.trim(),

                descricao:
                  descricao.trim(),

                observacoes:
                  observacoes.trim(),

                ativa
              });

          await props
            .onSelecionarTrilha(
              criada
            );

          setEtapa(
            2
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar trilha.'
          );
        }
      };

    const alternarTreinamento =
      (
        treinamentoId:
          string
      ): void => {

        setItensTreinamento(
          lista => {

            const atual =
              lista.find(
                item =>
                  item.treinamentoId ===
                  treinamentoId
              );

            if (
              atual
            ) {

              return lista.map(
                item =>
                  item.treinamentoId ===
                    treinamentoId
                    ? {
                      ...item,
                      selecionado:
                        !item.selecionado,

                      ordem:
                        !item.selecionado &&
                        item.ordem <=
                          0
                          ? lista.filter(
                            x =>
                              x.selecionado
                          ).length +
                            1
                          : item.ordem
                    }
                    : item
              );
            }

            return [
              ...lista,
              {
                treinamentoId,
                selecionado:
                  true,
                ordem:
                  lista.filter(
                    item =>
                      item.selecionado
                  ).length +
                  1,
                obrigatorio:
                  true,
                diasParaConclusao:
                  30
              }
            ];
          }
        );
      };

    const atualizarItem =
      (
        treinamentoId:
          string,
        dados:
          Partial<
            IItemTreinamentoLocal
          >
      ): void => {

        setItensTreinamento(
          lista =>
            lista.map(
              item =>
                item.treinamentoId ===
                  treinamentoId
                  ? {
                    ...item,
                    ...dados
                  }
                  : item
            )
        );
      };

    const salvarEtapa2 =
      async (): Promise<void> => {

        if (
          !trilhaAtual
        ) {
          return;
        }

        setErroLocal('');

        try {

          const selecionados =
            itensTreinamento
              .filter(
                item =>
                  item.selecionado
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  a.ordem -
                  b.ordem
              )
              .map(
                (
                  item,
                  indice
                ) => ({
                  treinamentoId:
                    item.treinamentoId,

                  ordem:
                    item.ordem >
                      0
                      ? item.ordem
                      : indice +
                        1,

                  obrigatorio:
                    item.obrigatorio,

                  diasParaConclusao:
                    item.diasParaConclusao
                })
              );

          await props
            .onSalvarTreinamentos(
              trilhaAtual.id,
              selecionados
            );

          setEtapa(
            3
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar treinamentos.'
          );
        }
      };

    const alternarArea =
      (
        areaId:
          string
      ): void => {

        setAreasSelecionadas(
          lista =>
            lista.indexOf(
              areaId
            ) >=
              0
              ? lista.filter(
                id =>
                  id !==
                  areaId
              )
              : [
                ...lista,
                areaId
              ]
        );
      };

    const salvarEtapa3 =
      async (): Promise<void> => {

        if (
          !trilhaAtual
        ) {
          return;
        }

        setErroLocal('');

        try {

          await props
            .onSalvarAreas(
              trilhaAtual.id,
              todasAreas,
              todasAreas
                ? []
                : areasSelecionadas
            );

          setModoFluxo(
            false
          );

          setEtapa(
            1
          );

          props
            .onLimparSelecao();

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar público da trilha.'
          );
        }
      };

    if (
      modoFluxo
    ) {

      return (
        <section>

          <PageHeader
            titulo={
              trilhaAtual
                ? 'Editar trilha'
                : 'Nova trilha'
            }
            subtitulo={
              etapa ===
                1
                ? 'Etapa 1 de 3 — cadastre os dados gerais da trilha.'
                : etapa ===
                    2
                  ? 'Etapa 2 de 3 — selecione os treinamentos e defina a ordem.'
                  : 'Etapa 3 de 3 — escolha quais áreas poderão visualizar a trilha.'
            }
          />

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'flex-end',

              marginBottom:
                '12px'
            }}
          >
            <button
              type="button"
              onClick={() => {

                setModoFluxo(
                  false
                );

                setEtapa(
                  1
                );

                props
                  .onLimparSelecao();
              }}
              style={
                btn
              }
            >
              ← Voltar
            </button>
          </div>

          <FluxoTrilhaEtapas
            etapa={
              etapa
            }
            permitirNavegacao={
              !!trilhaAtual
            }
            onEtapaClick={
              setEtapa
            }
          />

          {
            props.erro &&
            (
              <div
                style={{
                  ...cardStyle,

                  marginBottom:
                    '14px',

                  background:
                    '#fde7e9',

                  color:
                    '#a4262c'
                }}
              >
                {
                  props.erro
                }
              </div>
            )
          }

          {
            erroLocal &&
            (
              <div
                style={{
                  ...cardStyle,

                  marginBottom:
                    '14px',

                  background:
                    '#fff4ce',

                  color:
                    '#6a4b00'
                }}
              >
                {
                  erroLocal
                }
              </div>
            )
          }

          {
            etapa ===
              1 &&
            (
              <div
                style={{
                  ...cardStyle,

                  maxWidth:
                    '980px'
                }}
              >

                {
                  trilhaAtual &&
                  (
                    <div
                      style={{
                        marginBottom:
                          '16px',

                        padding:
                          '12px 14px',

                        background:
                          '#f8fafc',

                        borderRadius:
                          '8px',

                        color:
                          '#334155'
                      }}
                    >
                      Código: <strong>
                        {
                          trilhaAtual.codigo
                        }
                      </strong>
                    </div>
                  )
                }

                <label>
                  Nome da trilha *
                </label>

                <input
                  value={
                    nome
                  }
                  onChange={
                    event =>
                      setNome(
                        event.target
                          .value
                      )
                  }
                  placeholder="Ex.: Formação Produção"
                  style={{
                    ...inputStyle,

                    marginTop:
                      '6px'
                  }}
                />

                <div
                  style={{
                    height:
                      '14px'
                  }}
                />

                <label>
                  Descrição
                </label>

                <textarea
                  rows={
                    5
                  }
                  value={
                    descricao
                  }
                  onChange={
                    event =>
                      setDescricao(
                        event.target
                          .value
                      )
                  }
                  style={{
                    ...inputStyle,

                    marginTop:
                      '6px',

                    resize:
                      'vertical'
                  }}
                />

                <div
                  style={{
                    height:
                      '14px'
                  }}
                />

                <label>
                  Observações
                </label>

                <textarea
                  rows={
                    3
                  }
                  value={
                    observacoes
                  }
                  onChange={
                    event =>
                      setObservacoes(
                        event.target
                          .value
                      )
                  }
                  style={{
                    ...inputStyle,

                    marginTop:
                      '6px',

                    resize:
                      'vertical'
                  }}
                />

                <label
                  style={{
                    display:
                      'flex',

                    alignItems:
                      'center',

                    gap:
                      '8px',

                    marginTop:
                      '16px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      ativa
                    }
                    onChange={
                      event =>
                        setAtiva(
                          event.target
                            .checked
                        )
                    }
                  />

                  Trilha ativa
                </label>

                <div
                  style={{
                    display:
                      'flex',

                    justifyContent:
                      'flex-end',

                    marginTop:
                      '22px'
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {

                      void salvarEtapa1();

                    }}
                    style={
                      btnPrimary
                    }
                  >
                    {
                      props.processando
                        ? 'Salvando...'
                        : 'Salvar e continuar →'
                    }
                  </button>
                </div>

              </div>
            )
          }

          {
            etapa ===
              2 &&
            (
              <div
                style={
                  cardStyle
                }
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
                      'center',

                    marginBottom:
                      '16px',

                    flexWrap:
                      'wrap'
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin:
                          0,

                        color:
                          '#0b2d4d'
                      }}
                    >
                      Treinamentos da trilha
                    </h3>

                    <p
                      style={{
                        margin:
                          '5px 0 0',

                        color:
                          '#334155'
                      }}
                    >
                      Selecione os cursos, defina a ordem e o prazo de conclusão.
                    </p>
                  </div>

                  <span
                    style={{
                      color:
                        '#334155',

                      fontSize:
                        '13px'
                    }}
                  >
                    {
                      itensTreinamento
                        .filter(
                          item =>
                            item.selecionado
                        )
                        .length
                    } selecionado(s)
                  </span>
                </div>

                <div
                  style={{
                    display:
                      'grid',

                    gap:
                      '10px'
                  }}
                >
                  {
                    props.treinamentos
                      .filter(
                        item =>
                          item.ativo
                      )
                      .map(
                        treinamento => {

                          const item =
                            itensTreinamento
                              .find(
                                atual =>
                                  atual.treinamentoId ===
                                  treinamento.id
                              ) || {
                                treinamentoId:
                                  treinamento.id,
                                selecionado:
                                  false,
                                ordem:
                                  0,
                                obrigatorio:
                                  true,
                                diasParaConclusao:
                                  30
                              };

                          return (
                            <div
                              key={
                                treinamento.id
                              }
                              style={{
                                display:
                                  'grid',

                                gridTemplateColumns:
                                  '34px minmax(260px, 1fr) 100px 145px 170px',

                                gap:
                                  '12px',

                                alignItems:
                                  'center',

                                padding:
                                  '12px',

                                border:
                                  item.selecionado
                                    ? '1px solid #8bbde8'
                                    : '1px solid #e2e8f0',

                                borderRadius:
                                  '10px',

                                background:
                                  item.selecionado
                                    ? '#f5faff'
                                    : '#ffffff'
                              }}
                            >

                              <input
                                type="checkbox"
                                checked={
                                  item.selecionado
                                }
                                onChange={() =>
                                  alternarTreinamento(
                                    treinamento.id
                                  )
                                }
                              />

                              <div>
                                <strong>
                                  {
                                    treinamento.codigo
                                  } - {
                                    treinamento.nome
                                  }
                                </strong>

                                {
                                  treinamento.descricao &&
                                  (
                                    <div
                                      style={{
                                        marginTop:
                                          '3px',

                                        color:
                                          '#64748b',

                                        fontSize:
                                          '12px'
                                      }}
                                    >
                                      {
                                        treinamento.descricao
                                      }
                                    </div>
                                  )
                                }
                              </div>

                              <div>
                                <label
                                  style={{
                                    fontSize:
                                      '11px',

                                    color:
                                      '#64748b'
                                  }}
                                >
                                  Ordem
                                </label>

                                <input
                                  type="number"
                                  min={
                                    1
                                  }
                                  disabled={
                                    !item.selecionado
                                  }
                                  value={
                                    item.ordem ||
                                    ''
                                  }
                                  onChange={
                                    event =>
                                      atualizarItem(
                                        treinamento.id,
                                        {
                                          ordem:
                                            Number(
                                              event.target
                                                .value
                                            )
                                        }
                                      )
                                  }
                                  style={{
                                    ...inputStyle,

                                    marginTop:
                                      '4px'
                                  }}
                                />
                              </div>

                              <label
                                style={{
                                  display:
                                    'flex',

                                  gap:
                                    '7px',

                                  alignItems:
                                    'center'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  disabled={
                                    !item.selecionado
                                  }
                                  checked={
                                    item.obrigatorio
                                  }
                                  onChange={
                                    event =>
                                      atualizarItem(
                                        treinamento.id,
                                        {
                                          obrigatorio:
                                            event.target
                                              .checked
                                        }
                                      )
                                  }
                                />

                                Obrigatório
                              </label>

                              <div>
                                <label
                                  style={{
                                    fontSize:
                                      '11px',

                                    color:
                                      '#64748b'
                                  }}
                                >
                                  Prazo (dias)
                                </label>

                                <input
                                  type="number"
                                  min={
                                    0
                                  }
                                  disabled={
                                    !item.selecionado
                                  }
                                  value={
                                    item.diasParaConclusao
                                  }
                                  onChange={
                                    event =>
                                      atualizarItem(
                                        treinamento.id,
                                        {
                                          diasParaConclusao:
                                            Number(
                                              event.target
                                                .value
                                            )
                                        }
                                      )
                                  }
                                  style={{
                                    ...inputStyle,

                                    marginTop:
                                      '4px'
                                  }}
                                />
                              </div>

                            </div>
                          );
                        }
                      )
                  }
                </div>

                <div
                  style={{
                    display:
                      'flex',

                    justifyContent:
                      'space-between',

                    marginTop:
                      '22px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(
                        1
                      )
                    }
                    style={
                      btn
                    }
                  >
                    ← Voltar
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {

                      void salvarEtapa2();

                    }}
                    style={
                      btnPrimary
                    }
                  >
                    Salvar e continuar →
                  </button>
                </div>

              </div>
            )
          }

          {
            etapa ===
              3 &&
            (
              <div
                style={
                  cardStyle
                }
              >

                <h3
                  style={{
                    marginTop:
                      0,

                    color:
                      '#0b2d4d'
                  }}
                >
                  Quem pode visualizar esta trilha?
                </h3>

                <p
                  style={{
                    color:
                      '#334155',

                    fontSize:
                      '14px',

                    lineHeight:
                      1.5,

                    fontWeight:
                      500
                  }}
                >
                  A visibilidade da trilha pode ser geral ou restrita a uma ou mais áreas.
                </p>

                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      '1fr 1fr',

                    gap:
                      '12px',

                    marginTop:
                      '18px'
                  }}
                >

                  <button
                    type="button"
                    onClick={() =>
                      setTodasAreas(
                        true
                      )
                    }
                    style={{
                      ...cardStyle,

                      textAlign:
                        'left',

                      cursor:
                        'pointer',

                      border:
                        todasAreas
                          ? '2px solid #1677ff'
                          : '1px solid #d8e2ec',

                      background:
                        todasAreas
                          ? '#e7f2ff'
                          : '#ffffff',

                      color:
                        '#0b2d4d'
                    }}
                  >
                    <strong
                      style={{
                        color:
                          '#0b2d4d',

                        fontSize:
                          '14px',

                        fontWeight:
                          700
                      }}
                    >
                      Todas as áreas
                    </strong>

                    <span
                      style={{
                        display:
                          'block',

                        marginTop:
                          '5px',

                        color:
                          '#334155',

                        fontSize:
                          '13px',

                        fontWeight:
                          500,

                        lineHeight:
                          1.45
                      }}
                    >
                      Qualquer colaborador elegível poderá visualizar a trilha.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTodasAreas(
                        false
                      )
                    }
                    style={{
                      ...cardStyle,

                      textAlign:
                        'left',

                      cursor:
                        'pointer',

                      border:
                        !todasAreas
                          ? '2px solid #1677ff'
                          : '1px solid #d8e2ec',

                      background:
                        !todasAreas
                          ? '#e7f2ff'
                          : '#ffffff',

                      color:
                        '#0b2d4d'
                    }}
                  >
                    <strong
                      style={{
                        color:
                          '#0b2d4d',

                        fontSize:
                          '14px',

                        fontWeight:
                          700
                      }}
                    >
                      Áreas específicas
                    </strong>

                    <span
                      style={{
                        display:
                          'block',

                        marginTop:
                          '5px',

                        color:
                          '#334155',

                        fontSize:
                          '13px',

                        fontWeight:
                          500,

                        lineHeight:
                          1.45
                      }}
                    >
                      Apenas colaboradores das áreas selecionadas visualizarão a trilha.
                    </span>
                  </button>

                </div>

                {
                  !todasAreas &&
                  (
                    <div
                      style={{
                        marginTop:
                          '18px',

                        display:
                          'grid',

                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(220px, 1fr))',

                        gap:
                          '10px'
                      }}
                    >
                      {
                        props.areas
                          .filter(
                            area =>
                              area.ativa
                          )
                          .map(
                            area => {

                              const selecionada =
                                areasSelecionadas
                                  .indexOf(
                                    area.id
                                  ) >=
                                0;

                              return (
                                <label
                                  key={
                                    area.id
                                  }
                                  style={{
                                    display:
                                      'flex',

                                    gap:
                                      '9px',

                                    alignItems:
                                      'center',

                                    padding:
                                      '12px',

                                    border:
                                      selecionada
                                        ? '1px solid #8bbde8'
                                        : '1px solid #e2e8f0',

                                    borderRadius:
                                      '9px',

                                    background:
                                      selecionada
                                        ? '#f5faff'
                                        : '#ffffff',

                                    cursor:
                                      'pointer'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      selecionada
                                    }
                                    onChange={() =>
                                      alternarArea(
                                        area.id
                                      )
                                    }
                                  />

                                  <span>
                                    <strong>
                                      {
                                        area.sigla
                                      }
                                    </strong>
                                    {' - '}
                                    {
                                      area.nome
                                    }
                                  </span>
                                </label>
                              );
                            }
                          )
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

                    marginTop:
                      '24px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setEtapa(
                        2
                      )
                    }
                    style={
                      btn
                    }
                  >
                    ← Voltar
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {

                      void salvarEtapa3();

                    }}
                    style={
                      btnPrimary
                    }
                  >
                    {
                      props.processando
                        ? 'Salvando...'
                        : 'Salvar e encerrar'
                    }
                  </button>
                </div>

              </div>
            )
          }

        </section>
      );
    }

    return (
      <section>

        <PageHeader
          titulo="Gestão de trilhas"
          subtitulo="Crie trilhas, organize a sequência dos treinamentos e defina quais áreas poderão visualizá-las."
        />

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            gap:
              '10px',

            marginBottom:
              '18px',

            flexWrap:
              'wrap'
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
            ← Voltar
          </button>

          <button
            type="button"
            onClick={
              iniciarNova
            }
            style={
              btnPrimary
            }
          >
            + Nova trilha
          </button>
        </div>

        {
          props.erro &&
          (
            <div
              style={{
                ...cardStyle,

                marginBottom:
                  '14px',

                background:
                  '#fde7e9',

                color:
                  '#a4262c'
              }}
            >
              {
                props.erro
              }
            </div>
          )
        }

        {
          props.carregando
            ? (
              <div
                style={
                  cardStyle
                }
              >
                Carregando trilhas...
              </div>
            )
            : (
              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(320px, 1fr))',

                  gap:
                    '14px'
                }}
              >
                {
                  props.trilhas.map(
                    trilha => (
                      <article
                        key={
                          trilha.id
                        }
                        style={
                          cardStyle
                        }
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
                              'flex-start'
                          }}
                        >
                          <div>
                            <span
                              style={{
                                color:
                                  '#64748b',

                                fontSize:
                                  '11px',

                                fontWeight:
                                  700
                              }}
                            >
                              {
                                trilha.codigo ||
                                'TRILHA'
                              }
                            </span>

                            <h3
                              style={{
                                margin:
                                  '4px 0 6px',

                                color:
                                  '#0b2d4d'
                              }}
                            >
                              {
                                trilha.nome
                              }
                            </h3>
                          </div>

                          <span
                            style={{
                              padding:
                                '5px 9px',

                              borderRadius:
                                '999px',

                              background:
                                trilha.ativa
                                  ? '#e7f5ee'
                                  : '#f1f5f9',

                              color:
                                trilha.ativa
                                  ? '#13795b'
                                  : '#64748b',

                              fontSize:
                                '11px',

                              fontWeight:
                                700
                            }}
                          >
                            {
                              trilha.ativa
                                ? 'Ativa'
                                : 'Inativa'
                            }
                          </span>
                        </div>

                        {
                          trilha.descricao &&
                          (
                            <p
                              style={{
                                color:
                                  '#64748b',

                                fontSize:
                                  '13px',

                                lineHeight:
                                  1.5
                              }}
                            >
                              {
                                trilha.descricao
                              }
                            </p>
                          )
                        }

                        <div
                          style={{
                            display:
                              'grid',

                            gridTemplateColumns:
                              '1fr 1fr',

                            gap:
                              '10px',

                            marginTop:
                              '14px'
                          }}
                        >
                          <div
                            style={{
                              padding:
                                '10px',

                              background:
                                '#f8fafc',

                              borderRadius:
                                '8px'
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'block',

                                color:
                                  '#64748b',

                                fontSize:
                                  '11px'
                              }}
                            >
                              Treinamentos
                            </span>

                            <strong>
                              {
                                trilha.quantidadeTreinamentos
                              }
                            </strong>
                          </div>

                          <div
                            style={{
                              padding:
                                '10px',

                              background:
                                '#f8fafc',

                              borderRadius:
                                '8px'
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'block',

                                color:
                                  '#64748b',

                                fontSize:
                                  '11px'
                              }}
                            >
                              Visibilidade
                            </span>

                            <strong>
                              {
                                trilha.todasAreas
                                  ? 'Todas as áreas'
                                  : `${trilha.quantidadeAreas} área(s)`
                              }
                            </strong>
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              'flex',

                            gap:
                              '8px',

                            marginTop:
                              '16px',

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

                              void editar(
                                trilha
                              );

                            }}
                            style={
                              btn
                            }
                          >
                            Editar trilha
                          </button>

                          <button
                            type="button"
                            disabled={
                              props.processando
                            }
                            onClick={() => {

                              void props
                                .onDefinirTrilhaAtiva(
                                  trilha.id,
                                  !trilha.ativa
                                );

                            }}
                            style={
                              trilha.ativa
                                ? btnDanger
                                : btn
                            }
                          >
                            {
                              trilha.ativa
                                ? 'Desativar'
                                : 'Ativar'
                            }
                          </button>
                        </div>

                      </article>
                    )
                  )
                }
              </div>
            )
        }

      </section>
    );
  };

export default GestaoTrilhasPage;
