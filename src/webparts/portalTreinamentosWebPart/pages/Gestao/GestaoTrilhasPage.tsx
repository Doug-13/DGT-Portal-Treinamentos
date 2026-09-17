import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IAdicionarTreinamentoTrilha,
  IEditarTreinamentoTrilha,
  IEditarTrilha,
  INovaTrilha,
  ITrilhaAdmin,
  ITrilhaTreinamentoAdmin
} from '../../services/TrilhaAdminService';

export interface IGestaoTrilhasPageProps {

  trilhas:
    ITrilhaAdmin[];

  trilhaSelecionada?:
    ITrilhaAdmin;

  treinamentosTrilha:
    ITrilhaTreinamentoAdmin[];

  treinamentos:
    ITreinamentoAdmin[];

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
    ) => Promise<void>;

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

  onAdicionarTreinamento:
    (
      dados:
        IAdicionarTreinamentoTrilha
    ) => Promise<void>;

  onEditarTreinamento:
    (
      dados:
        IEditarTreinamentoTrilha
    ) => Promise<void>;

  onRemoverTreinamento:
    (
      relacaoId:
        string
    ) => Promise<void>;
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
    '1px solid #d8dee8',

  borderRadius:
    '8px',

  background:
    '#ffffff'
};

const buttonPrimary:
  React.CSSProperties = {

  padding:
    '10px 16px',

  border:
    'none',

  borderRadius:
    '8px',

  background:
    '#1677ff',

  color:
    '#ffffff',

  fontWeight:
    700,

  cursor:
    'pointer'
};

const buttonSecondary:
  React.CSSProperties = {

  padding:
    '9px 14px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '8px',

  background:
    '#ffffff',

  color:
    '#334155',

  cursor:
    'pointer'
};

const GestaoTrilhasPage:
  React.FC<
    IGestaoTrilhasPageProps
  > = (
    props
  ) => {

    const [
      mostrarNovaTrilha,
      setMostrarNovaTrilha
    ] =
      React.useState(
        false
      );

    const [
      editandoTrilha,
      setEditandoTrilha
    ] =
      React.useState<
        ITrilhaAdmin | undefined
      >(undefined);

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
      dias,
      setDias
    ] =
      React.useState(
        '30'
      );

    const [
      ativa,
      setAtiva
    ] =
      React.useState(
        true
      );

    const [
      treinamentoId,
      setTreinamentoId
    ] =
      React.useState('');

    const [
      ordem,
      setOrdem
    ] =
      React.useState('');

    const [
      obrigatorio,
      setObrigatorio
    ] =
      React.useState(
        true
      );

    const [
      regraLiberacao,
      setRegraLiberacao
    ] =
      React.useState(
        'Sequencial'
      );

    const [
      diasTreinamento,
      setDiasTreinamento
    ] =
      React.useState(
        '0'
      );

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const abrirNovaTrilha =
      (): void => {

        setEditandoTrilha(
          undefined
        );

        setNome('');
        setDescricao('');
        setDias('30');
        setAtiva(true);
        setErroLocal('');

        setMostrarNovaTrilha(
          true
        );
      };

    const abrirEditarTrilha = (
      trilha:
        ITrilhaAdmin
    ): void => {

      setEditandoTrilha(
        trilha
      );

      setNome(
        trilha.nome
      );

      setDescricao(
        trilha.descricao
      );

      setDias(
        String(
          trilha.diasParaConclusao
        )
      );

      setAtiva(
        trilha.ativa
      );

      setErroLocal('');

      setMostrarNovaTrilha(
        true
      );
    };

    const salvarTrilha =
      async (): Promise<void> => {

        setErroLocal('');

        const diasNumero =
          Number(
            dias
          );

        if (
          !nome.trim()
        ) {

          setErroLocal(
            'Informe o nome da trilha.'
          );

          return;
        }

        if (
          Number.isNaN(
            diasNumero
          ) ||
          diasNumero <
          0
        ) {

          setErroLocal(
            'Informe um prazo válido.'
          );

          return;
        }

        try {

          if (
            editandoTrilha
          ) {

            await props
              .onEditarTrilha({

                id:
                  editandoTrilha.id,

                nome:
                  nome.trim(),

                descricao:
                  descricao.trim(),

                diasParaConclusao:
                  diasNumero,

                ativa
              });

          } else {

            await props
              .onCriarTrilha({

                nome:
                  nome.trim(),

                descricao:
                  descricao.trim(),

                diasParaConclusao:
                  diasNumero,

                ativa
              });
          }

          setMostrarNovaTrilha(
            false
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Não foi possível salvar a trilha.'
          );
        }
      };

    const adicionarTreinamento =
      async (): Promise<void> => {

        if (
          !props.trilhaSelecionada
        ) {
          return;
        }

        setErroLocal('');

        const ordemNumero =
          Number(
            ordem
          );

        const diasNumero =
          Number(
            diasTreinamento
          );

        if (
          !treinamentoId
        ) {

          setErroLocal(
            'Selecione um treinamento.'
          );

          return;
        }

        if (
          Number.isNaN(
            ordemNumero
          ) ||
          ordemNumero <=
          0
        ) {

          setErroLocal(
            'Informe uma ordem válida.'
          );

          return;
        }

        try {

          await props
            .onAdicionarTreinamento({

              trilhaId:
                props
                  .trilhaSelecionada
                  .id,

              treinamentoId,

              ordem:
                ordemNumero,

              obrigatorio,

              regraLiberacao,

              diasParaConclusao:
                Number.isNaN(
                  diasNumero
                )
                  ? 0
                  : diasNumero
            });

          setTreinamentoId('');

          setOrdem(
            String(
              props
                .treinamentosTrilha
                .length +
              2
            )
          );

          setObrigatorio(
            true
          );

          setRegraLiberacao(
            'Sequencial'
          );

          setDiasTreinamento(
            '0'
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao adicionar treinamento.'
          );
        }
      };

    const alterarOrdem = (
      item:
        ITrilhaTreinamentoAdmin,
      novaOrdem:
        number
    ): void => {

      if (
        novaOrdem <=
        0
      ) {
        return;
      }

      props
        .onEditarTreinamento({

          id:
            item.id,

          ordem:
            novaOrdem,

          obrigatorio:
            item.obrigatorio,

          regraLiberacao:
            item.regraLiberacao,

          diasParaConclusao:
            item.diasParaConclusao,

          ativo:
            true
        })
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

    const treinamentosDisponiveis =
      props.treinamentos
        .filter(
          treinamento =>
            treinamento.ativo
        )
        .filter(
          treinamento =>
            !props
              .treinamentosTrilha
              .some(
                item =>
                  item
                    .treinamentoId
                    .replace(
                      /[{}]/g,
                      ''
                    )
                    .toLowerCase() ===
                  treinamento
                    .id
                    .replace(
                      /[{}]/g,
                      ''
                    )
                    .toLowerCase()
              )
        );

    return (
      <section>

        <PageHeader
          titulo="Gestão de trilhas"
          subtitulo="Configure trilhas, cursos, sequência e regras de liberação."
          acao={
            <button
              type="button"
              onClick={
                props.onVoltar
              }
              style={
                buttonSecondary
              }
            >
              Voltar
            </button>
          }
        />

        {props.erro && (

          <div
            style={{
              marginBottom:
                '16px',

              padding:
                '12px 14px',

              borderRadius:
                '8px',

              background:
                '#fde7e9',

              color:
                '#a4262c'
            }}
          >
            {props.erro}
          </div>
        )}

        {erroLocal && (

          <div
            style={{
              marginBottom:
                '16px',

              padding:
                '12px 14px',

              borderRadius:
                '8px',

              background:
                '#fff4ce',

              color:
                '#6a4b00'
            }}
          >
            {erroLocal}
          </div>
        )}

        {!props.trilhaSelecionada ? (

          <>

            <div
              style={{
                display:
                  'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                marginBottom:
                  '18px'
              }}
            >

              <div>

                <strong
                  style={{
                    display:
                      'block',

                    color:
                      '#0b1f3a',

                    fontSize:
                      '18px'
                  }}
                >
                  Trilhas cadastradas
                </strong>

                <span
                  style={{
                    color:
                      '#64748b',

                    fontSize:
                      '13px'
                  }}
                >
                  {
                    props.trilhas.length
                  } trilha(s)
                </span>

              </div>

              <button
                type="button"
                onClick={
                  abrirNovaTrilha
                }
                style={
                  buttonPrimary
                }
              >
                + Nova trilha
              </button>

            </div>

            {props.carregando ? (

              <div
                style={{
                  padding:
                    '30px',

                  textAlign:
                    'center'
                }}
              >
                Carregando trilhas...
              </div>

            ) : (

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(280px, 1fr))',

                  gap:
                    '16px'
                }}
              >

                {props.trilhas.map(
                  trilha => (

                    <article
                      key={
                        trilha.id
                      }
                      style={{
                        padding:
                          '20px',

                        background:
                          '#ffffff',

                        border:
                          '1px solid #e5e7eb',

                        borderRadius:
                          '14px'
                      }}
                    >

                      <div
                        style={{
                          display:
                            'flex',

                          justifyContent:
                            'space-between',

                          gap:
                            '12px'
                        }}
                      >

                        <div>

                          <h3
                            style={{
                              margin:
                                0,

                              color:
                                '#0b1f3a'
                            }}
                          >
                            {
                              trilha.nome
                            }
                          </h3>

                          <p
                            style={{
                              color:
                                '#64748b',

                              fontSize:
                                '13px'
                            }}
                          >
                            {
                              trilha.descricao ||
                              'Sem descrição.'
                            }
                          </p>

                        </div>

                        <span
                          style={{
                            height:
                              'fit-content',

                            padding:
                              '5px 9px',

                            borderRadius:
                              '20px',

                            background:
                              trilha.ativa
                                ? '#e7f5ee'
                                : '#f1f5f9',

                            color:
                              trilha.ativa
                                ? '#13795b'
                                : '#64748b',

                            fontSize:
                              '12px',

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

                      <div
                        style={{
                          display:
                            'grid',

                          gridTemplateColumns:
                            '1fr 1fr',

                          gap:
                            '10px',

                          margin:
                            '18px 0'
                        }}
                      >

                        <div>
                          <strong>
                            {
                              trilha
                                .quantidadeTreinamentos
                            }
                          </strong>

                          <span
                            style={{
                              display:
                                'block',

                              color:
                                '#64748b',

                              fontSize:
                                '12px'
                            }}
                          >
                            treinamentos
                          </span>
                        </div>

                        <div>
                          <strong>
                            {
                              trilha
                                .diasParaConclusao ||
                              '-'
                            }
                          </strong>

                          <span
                            style={{
                              display:
                                'block',

                              color:
                                '#64748b',

                              fontSize:
                                '12px'
                            }}
                          >
                            dias para concluir
                          </span>
                        </div>

                      </div>

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
                          onClick={() => {

                            props
                              .onSelecionarTrilha(
                                trilha
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
                            buttonPrimary
                          }
                        >
                          Gerenciar cursos
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            abrirEditarTrilha(
                              trilha
                            )
                          }
                          style={
                            buttonSecondary
                          }
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          disabled={
                            props.processando
                          }
                          onClick={() => {

                            props
                              .onDefinirTrilhaAtiva(
                                trilha.id,
                                !trilha.ativa
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
                            buttonSecondary
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
                )}

              </div>
            )}

          </>

        ) : (

          <>

            <div
              style={{
                display:
                  'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                marginBottom:
                  '20px',

                gap:
                  '16px'
              }}
            >

              <div>

                <button
                  type="button"
                  onClick={
                    props.onLimparSelecao
                  }
                  style={{
                    ...buttonSecondary,
                    marginBottom:
                      '10px'
                  }}
                >
                  ← Trilhas
                </button>

                <h2
                  style={{
                    margin:
                      0,

                    color:
                      '#0b1f3a'
                  }}
                >
                  {
                    props
                      .trilhaSelecionada
                      .nome
                  }
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  abrirEditarTrilha(
                    props
                      .trilhaSelecionada as ITrilhaAdmin
                  )
                }
                style={
                  buttonSecondary
                }
              >
                Editar trilha
              </button>

            </div>

            {/* ADICIONAR TREINAMENTO */}

            <div
              style={{
                marginBottom:
                  '22px',

                padding:
                  '20px',

                background:
                  '#ffffff',

                border:
                  '1px solid #e5e7eb',

                borderRadius:
                  '14px'
              }}
            >

              <h3
                style={{
                  marginTop:
                    0,

                  color:
                    '#0b1f3a'
                }}
              >
                Adicionar treinamento
              </h3>

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    '2fr 100px 160px 160px',

                  gap:
                    '12px'
                }}
              >

                <select
                  value={
                    treinamentoId
                  }
                  onChange={
                    event =>
                      setTreinamentoId(
                        event.target.value
                      )
                  }
                  style={
                    inputStyle
                  }
                >

                  <option value="">
                    Selecione um treinamento
                  </option>

                  {treinamentosDisponiveis.map(
                    treinamento => (

                      <option
                        key={
                          treinamento.id
                        }
                        value={
                          treinamento.id
                        }
                      >
                        {
                          treinamento.codigo
                        } - {
                          treinamento.nome
                        }
                      </option>
                    )
                  )}

                </select>

                <input
                  type="number"
                  min={
                    1
                  }
                  placeholder="Ordem"
                  value={
                    ordem
                  }
                  onChange={
                    event =>
                      setOrdem(
                        event.target.value
                      )
                  }
                  style={
                    inputStyle
                  }
                />

                <select
                  value={
                    regraLiberacao
                  }
                  onChange={
                    event =>
                      setRegraLiberacao(
                        event.target.value
                      )
                  }
                  style={
                    inputStyle
                  }
                >
                  <option value="Sequencial">
                    Sequencial
                  </option>

                  <option value="Imediata">
                    Imediata
                  </option>
                </select>

                <input
                  type="number"
                  min={
                    0
                  }
                  placeholder="Prazo (dias)"
                  value={
                    diasTreinamento
                  }
                  onChange={
                    event =>
                      setDiasTreinamento(
                        event.target.value
                      )
                  }
                  style={
                    inputStyle
                  }
                />

              </div>

              <label
                style={{
                  display:
                    'flex',

                  gap:
                    '8px',

                  alignItems:
                    'center',

                  marginTop:
                    '14px'
                }}
              >

                <input
                  type="checkbox"
                  checked={
                    obrigatorio
                  }
                  onChange={
                    event =>
                      setObrigatorio(
                        event.target.checked
                      )
                  }
                />

                Treinamento obrigatório

              </label>

              <button
                type="button"
                disabled={
                  props.processando
                }
                onClick={() => {

                  adicionarTreinamento()
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
                  ...buttonPrimary,

                  marginTop:
                    '16px'
                }}
              >
                Adicionar à trilha
              </button>

            </div>

            {/* CONTEÚDO DA TRILHA */}

            <div
              style={{
                background:
                  '#ffffff',

                border:
                  '1px solid #e5e7eb',

                borderRadius:
                  '14px',

                overflow:
                  'hidden'
              }}
            >

              {props.carregandoConteudo ? (

                <div
                  style={{
                    padding:
                      '30px',

                    textAlign:
                      'center'
                  }}
                >
                  Carregando treinamentos...
                </div>

              ) : (

                props
                  .treinamentosTrilha
                  .map(
                    (
                      item,
                      indice
                    ) => (

                      <div
                        key={
                          item.id
                        }
                        style={{
                          display:
                            'grid',

                          gridTemplateColumns:
                            '70px 1fr 140px 120px 230px',

                          gap:
                            '12px',

                          alignItems:
                            'center',

                          padding:
                            '16px',

                          borderBottom:
                            indice <
                            props
                              .treinamentosTrilha
                              .length -
                            1
                              ? '1px solid #edf0f4'
                              : 'none'
                        }}
                      >

                        <div
                          style={{
                            width:
                              '38px',

                            height:
                              '38px',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'center',

                            borderRadius:
                              '50%',

                            background:
                              '#eef5ff',

                            color:
                              '#1677ff',

                            fontWeight:
                              700
                          }}
                        >
                          {
                            item.ordem
                          }
                        </div>

                        <div>

                          <strong>
                            {
                              item
                                .treinamentoNome
                            }
                          </strong>

                          <span
                            style={{
                              display:
                                'block',

                              marginTop:
                                '4px',

                              color:
                                '#64748b',

                              fontSize:
                                '12px'
                            }}
                          >
                            {
                              item
                                .treinamentoCodigo
                            }
                          </span>

                        </div>

                        <span>
                          {
                            item.obrigatorio
                              ? 'Obrigatório'
                              : 'Opcional'
                          }
                        </span>

                        <span>
                          {
                            item.regraLiberacao ||
                            'Sequencial'
                          }
                        </span>

                        <div
                          style={{
                            display:
                              'flex',

                            gap:
                              '6px',

                            flexWrap:
                              'wrap'
                          }}
                        >

                          <button
                            type="button"
                            disabled={
                              item.ordem <=
                              1 ||
                              props.processando
                            }
                            onClick={() =>
                              alterarOrdem(
                                item,
                                item.ordem -
                                1
                              )
                            }
                            style={
                              buttonSecondary
                            }
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            disabled={
                              props.processando
                            }
                            onClick={() =>
                              alterarOrdem(
                                item,
                                item.ordem +
                                1
                              )
                            }
                            style={
                              buttonSecondary
                            }
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            disabled={
                              props.processando
                            }
                            onClick={() => {

                              props
                                .onRemoverTreinamento(
                                  item.id
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
                              buttonSecondary
                            }
                          >
                            Remover
                          </button>

                        </div>

                      </div>
                    )
                  )
              )}

            </div>

          </>
        )}

        {/* MODAL TRILHA */}

        {mostrarNovaTrilha && (

          <div
            style={{
              position:
                'fixed',

              inset:
                0,

              zIndex:
                10000,

              display:
                'flex',

              justifyContent:
                'center',

              alignItems:
                'center',

              padding:
                '20px',

              background:
                'rgba(15,23,42,.55)'
            }}
          >

            <div
              style={{
                width:
                  '100%',

                maxWidth:
                  '620px',

                padding:
                  '24px',

                borderRadius:
                  '16px',

                background:
                  '#ffffff'
              }}
            >

              <h2
                style={{
                  marginTop:
                    0
                }}
              >
                {
                  editandoTrilha
                    ? 'Editar trilha'
                    : 'Nova trilha'
                }
              </h2>

              <label>
                Nome
              </label>

              <input
                value={
                  nome
                }
                onChange={
                  event =>
                    setNome(
                      event.target.value
                    )
                }
                style={
                  inputStyle
                }
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
                  4
                }
                value={
                  descricao
                }
                onChange={
                  event =>
                    setDescricao(
                      event.target.value
                    )
                }
                style={{
                  ...inputStyle,

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
                Dias para conclusão
              </label>

              <input
                type="number"
                min={
                  0
                }
                value={
                  dias
                }
                onChange={
                  event =>
                    setDias(
                      event.target.value
                    )
                }
                style={
                  inputStyle
                }
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
                        event.target.checked
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

                  gap:
                    '10px',

                  marginTop:
                    '24px'
                }}
              >

                <button
                  type="button"
                  onClick={() =>
                    setMostrarNovaTrilha(
                      false
                    )
                  }
                  style={
                    buttonSecondary
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

                    salvarTrilha()
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
                    buttonPrimary
                  }
                >
                  {
                    props.processando
                      ? 'Salvando...'
                      : 'Salvar'
                  }
                </button>

              </div>

            </div>

          </div>
        )}

      </section>
    );
  };

export default GestaoTrilhasPage;