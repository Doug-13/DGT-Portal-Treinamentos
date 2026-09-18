import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IEditarTreinamento,
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

export interface IGestaoPageProps {

  treinamentos:
  ITreinamentoAdmin[];

  carregando:
  boolean;

  erro:
  string;

  processandoId:
  string;

  onNovoTreinamento:
  () => void;

  onAtribuirTreinamento:
  () => void;

  onTrilhas:
  () => void;

  onEquipe:
  () => void;

  onEditarTreinamento:
  (
    dados:
      IEditarTreinamento
  ) => Promise<void>;

  onDefinirAtivo:
  (
    treinamentoId:
      string,
    ativo:
      boolean
  ) => Promise<void>;

  onModulos: () => void;

  onAvaliacoes: () => void;

  onDocumentos: () => void;

  onConformidade: () => void;

  onIndicadores: () => void;

}

// ============================================================
// ESTILOS
// ============================================================

const thStyle:
  React.CSSProperties = {

  padding:
    '12px 14px',

  textAlign:
    'left',

  fontSize:
    '12px',

  color:
    '#64748b',

  background:
    '#f8fafc',

  whiteSpace:
    'nowrap'
};

const tdStyle:
  React.CSSProperties = {

  padding:
    '13px 14px',

  borderTop:
    '1px solid #edf0f4',

  color:
    '#334155',

  fontSize:
    '13px',

  verticalAlign:
    'middle'
};

const inputStyle:
  React.CSSProperties = {

  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '10px 11px',

  border:
    '1px solid #d8dee8',

  borderRadius:
    '8px',

  fontSize:
    '14px'
};

// ============================================================
// CARD
// ============================================================

const Acao:
  React.FC<{
    titulo: string;
    descricao: string;
    icone: string;
    onClick: () => void;
  }> = ({
    titulo,
    descricao,
    icone,
    onClick
  }) => (

    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        padding:
          '20px',

        textAlign:
          'left',

        border:
          '1px solid #e5e7eb',

        borderRadius:
          '14px',

        background:
          '#ffffff',

        cursor:
          'pointer'
      }}
    >

      <div
        style={{
          fontSize:
            '24px',

          marginBottom:
            '12px'
        }}
      >
        {icone}
      </div>

      <strong
        style={{
          display:
            'block',

          color:
            '#0b1f3a',

          fontSize:
            '15px'
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          display:
            'block',

          marginTop:
            '6px',

          color:
            '#64748b',

          fontSize:
            '12px',

          lineHeight:
            1.45
        }}
      >
        {descricao}
      </span>

    </button>
  );

// ============================================================
// COMPONENTE
// ============================================================

const GestaoPage:
  React.FC<
    IGestaoPageProps
  > = (
    props
  ) => {

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const [
      editando,
      setEditando
    ] =
      React.useState<
        ITreinamentoAdmin | undefined
      >(undefined);

    const [
      nome,
      setNome
    ] =
      React.useState('');

    const [
      codigo,
      setCodigo
    ] =
      React.useState('');

    const [
      descricao,
      setDescricao
    ] =
      React.useState('');

    const [
      carga,
      setCarga
    ] =
      React.useState('');

    const [
      nota,
      setNota
    ] =
      React.useState('');

    const [
      validade,
      setValidade
    ] =
      React.useState('');

    const [
      salvando,
      setSalvando
    ] =
      React.useState(
        false
      );

    const [
      erroEdicao,
      setErroEdicao
    ] =
      React.useState('');

    // ==========================================================
    // FILTRO
    // ==========================================================

    const filtrados =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          if (
            !termo
          ) {

            return props
              .treinamentos;
          }

          return props
            .treinamentos
            .filter(
              item =>
                item.nome
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.codigo
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.descricao
                  .toLowerCase()
                  .includes(
                    termo
                  )
            );

        },
        [
          pesquisa,
          props.treinamentos
        ]
      );

    // ==========================================================
    // ABRIR EDIÇÃO
    // ==========================================================

    const abrirEdicao = (
      treinamento:
        ITreinamentoAdmin
    ): void => {

      setEditando(
        treinamento
      );

      setNome(
        treinamento.nome
      );

      setCodigo(
        treinamento.codigo
      );

      setDescricao(
        treinamento.descricao
      );

      setCarga(
        String(
          treinamento.cargaHorariaMin
        )
      );

      setNota(
        String(
          treinamento.notaMinima
        )
      );

      setValidade(
        String(
          treinamento.validadeMeses
        )
      );

      setErroEdicao('');
    };

    // ==========================================================
    // FECHAR EDIÇÃO
    // ==========================================================

    const fecharEdicao =
      (): void => {

        setEditando(
          undefined
        );

        setErroEdicao('');
      };

    // ==========================================================
    // SALVAR EDIÇÃO
    // ==========================================================

    const salvarEdicao =
      async (): Promise<void> => {

        if (
          !editando
        ) {

          return;
        }

        setErroEdicao('');

        const cargaNumero =
          Number(
            carga
          );

        const notaNumero =
          Number(
            nota
          );

        const validadeNumero =
          Number(
            validade
          );

        if (
          !nome.trim()
        ) {

          setErroEdicao(
            'Informe o nome.'
          );

          return;
        }

        if (
          !codigo.trim()
        ) {

          setErroEdicao(
            'Informe o código.'
          );

          return;
        }

        if (
          Number.isNaN(
            cargaNumero
          ) ||
          cargaNumero <=
          0
        ) {

          setErroEdicao(
            'Carga horária inválida.'
          );

          return;
        }

        if (
          Number.isNaN(
            notaNumero
          ) ||
          notaNumero <
          0 ||
          notaNumero >
          100
        ) {

          setErroEdicao(
            'Nota mínima inválida.'
          );

          return;
        }

        setSalvando(
          true
        );

        try {

          await props
            .onEditarTreinamento({

              id:
                editando.id,

              nome:
                nome.trim(),

              codigo:
                codigo
                  .trim()
                  .toUpperCase(),

              descricao:
                descricao.trim(),

              cargaHorariaMin:
                cargaNumero,

              notaMinima:
                notaNumero,

              validadeMeses:
                validadeNumero,

              ativo:
                editando.ativo
            });

          fecharEdicao();

        } catch (e) {

          setErroEdicao(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar alterações.'
          );

        } finally {

          setSalvando(
            false
          );
        }
      };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
      <section>

        <PageHeader
          titulo="Gestão de treinamentos"
          subtitulo="Cadastros, trilhas, atribuições e acompanhamento da plataforma."
        />

        {/* AÇÕES */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',

            gap:
              '14px',

            marginBottom:
              '28px'
          }}
        >

          <Acao
            titulo="Novo treinamento"
            descricao="Cadastre um novo treinamento."
            icone="+"
            onClick={
              props.onNovoTreinamento
            }
          />

          <Acao
            titulo="Atribuir treinamento"
            descricao="Atribua treinamentos diretamente."
            icone="◎"
            onClick={
              props.onAtribuirTreinamento
            }
          />

          <Acao
            titulo="Gerenciar trilhas"
            descricao="Organize cursos, sequência e regras."
            icone="▰"
            onClick={
              props.onTrilhas
            }
          />

          <Acao
            titulo="Minha equipe"
            descricao="Acompanhe conformidade e pendências."
            icone="♟"
            onClick={
              props.onEquipe
            }
          />

          <Acao
            titulo="Gerenciar módulos"
            descricao="Organize o conteúdo dos treinamentos."
            icone="▤"
            onClick={
              props.onModulos
            }
          />

          <Acao
            titulo="Avaliações e questões"
            descricao="Configure provas, banco de questões e alternativas."
            icone="✓"
            onClick={
              props.onAvaliacoes
            }
          />
          <Acao
            titulo="Módulos"
            descricao="Gerencie os módulos dos treinamentos."
            icone="▦"
            onClick={
              props.onModulos
            }
          />

          <Acao
            titulo="Avaliações"
            descricao="Gerencie avaliações, questões e alternativas."
            icone="✓"
            onClick={
              props.onAvaliacoes
            }
          />

          <Acao
            titulo="Conformidade"
            descricao="Acompanhe concluídos, pendências, vencidos e próximos do vencimento."
            icone="◉"
            onClick={
              props.onConformidade
            }
          />

          <Acao
            titulo="Documentos"
            descricao="Gerencie documentos, revisões e retreinamentos."
            icone="▤"
            onClick={
              props.onDocumentos
            }
          />
          
          <Acao
            titulo="Indicadores"
            descricao="Acompanhe conformidade, vencimentos e desempenho."
            icone="▥"
            onClick={
              props.onIndicadores
            }
          />

        </div>

        {/* LISTAGEM */}

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

          <div
            style={{
              padding:
                '18px',

              borderBottom:
                '1px solid #e5e7eb',

              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              gap:
                '15px',

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
                    '#0b1f3a',

                  fontSize:
                    '16px'
                }}
              >
                Treinamentos cadastrados
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
                  props
                    .treinamentos
                    .length
                } treinamento(s)
              </span>

            </div>

            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                ...inputStyle,

                maxWidth:
                  '320px'
              }}
            />

          </div>

          {props.erro && (

            <div
              style={{
                margin:
                  '16px',

                padding:
                  '12px',

                background:
                  '#fde7e9',

                color:
                  '#a4262c',

                borderRadius:
                  '8px'
              }}
            >
              {props.erro}
            </div>
          )}

          {props.carregando ? (

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

            <div
              style={{
                overflowX:
                  'auto'
              }}
            >

              <table
                style={{
                  width:
                    '100%',

                  borderCollapse:
                    'collapse'
                }}
              >

                <thead>

                  <tr>

                    <th style={thStyle}>
                      Código
                    </th>

                    <th style={thStyle}>
                      Treinamento
                    </th>

                    <th style={thStyle}>
                      Carga
                    </th>

                    <th style={thStyle}>
                      Nota
                    </th>

                    <th style={thStyle}>
                      Validade
                    </th>

                    <th style={thStyle}>
                      Status
                    </th>

                    <th style={thStyle}>
                      Ações
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filtrados.map(
                    treinamento => {

                      const processando =
                        props.processandoId ===
                        treinamento.id;

                      return (

                        <tr
                          key={
                            treinamento.id
                          }
                        >

                          <td style={tdStyle}>

                            <strong>
                              {
                                treinamento.codigo ||
                                '-'
                              }
                            </strong>

                          </td>

                          <td style={tdStyle}>

                            <strong
                              style={{
                                color:
                                  '#1f2937'
                              }}
                            >
                              {
                                treinamento.nome
                              }
                            </strong>

                            {treinamento.descricao && (

                              <span
                                style={{
                                  display:
                                    'block',

                                  marginTop:
                                    '4px',

                                  color:
                                    '#64748b',

                                  fontSize:
                                    '12px',

                                  maxWidth:
                                    '380px'
                                }}
                              >
                                {
                                  treinamento.descricao
                                }
                              </span>
                            )}

                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .cargaHorariaMin
                            } min
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .notaMinima
                            }%
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .validadeMeses >
                                0
                                ? `${treinamento.validadeMeses} meses`
                                : 'Sem validade'
                            }
                          </td>

                          <td style={tdStyle}>

                            <span
                              style={{
                                display:
                                  'inline-block',

                                padding:
                                  '5px 9px',

                                borderRadius:
                                  '20px',

                                background:
                                  treinamento.ativo
                                    ? '#e7f5ee'
                                    : '#f1f5f9',

                                color:
                                  treinamento.ativo
                                    ? '#13795b'
                                    : '#64748b',

                                fontSize:
                                  '12px',

                                fontWeight:
                                  700
                              }}
                            >
                              {
                                treinamento.ativo
                                  ? 'Ativo'
                                  : 'Inativo'
                              }
                            </span>

                          </td>

                          <td style={tdStyle}>

                            <div
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '7px',

                                flexWrap:
                                  'wrap'
                              }}
                            >

                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() =>
                                  abrirEdicao(
                                    treinamento
                                  )
                                }
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() => {

                                  props
                                    .onDefinirAtivo(
                                      treinamento.id,
                                      !treinamento.ativo
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
                                  processando
                                    ? 'Processando...'
                                    : treinamento.ativo
                                      ? 'Desativar'
                                      : 'Ativar'
                                }
                              </button>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

        {/* MODAL DE EDIÇÃO */}

        {editando && (

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

              alignItems:
                'center',

              justifyContent:
                'center',

              padding:
                '20px',

              background:
                'rgba(15, 23, 42, 0.50)'
            }}
          >

            <div
              style={{
                width:
                  '100%',

                maxWidth:
                  '700px',

                maxHeight:
                  '90vh',

                overflowY:
                  'auto',

                padding:
                  '24px',

                background:
                  '#ffffff',

                borderRadius:
                  '16px',

                boxShadow:
                  '0 20px 60px rgba(0,0,0,.20)'
              }}
            >

              <h2
                style={{
                  margin:
                    '0 0 20px',

                  color:
                    '#0b1f3a'
                }}
              >
                Editar treinamento
              </h2>

              {erroEdicao && (

                <div
                  style={{
                    padding:
                      '12px',

                    marginBottom:
                      '16px',

                    background:
                      '#fde7e9',

                    color:
                      '#a4262c',

                    borderRadius:
                      '8px'
                  }}
                >
                  {erroEdicao}
                </div>
              )}

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
                Código
              </label>

              <input
                value={
                  codigo
                }
                onChange={
                  event =>
                    setCodigo(
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
                  display:
                    'grid',

                  gridTemplateColumns:
                    'repeat(3, minmax(0, 1fr))',

                  gap:
                    '14px',

                  marginTop:
                    '14px'
                }}
              >

                <div>

                  <label>
                    Carga (min)
                  </label>

                  <input
                    type="number"
                    value={
                      carga
                    }
                    onChange={
                      event =>
                        setCarga(
                          event.target.value
                        )
                    }
                    style={
                      inputStyle
                    }
                  />

                </div>

                <div>

                  <label>
                    Nota mínima
                  </label>

                  <input
                    type="number"
                    value={
                      nota
                    }
                    onChange={
                      event =>
                        setNota(
                          event.target.value
                        )
                    }
                    style={
                      inputStyle
                    }
                  />

                </div>

                <div>

                  <label>
                    Validade
                  </label>

                  <input
                    type="number"
                    value={
                      validade
                    }
                    onChange={
                      event =>
                        setValidade(
                          event.target.value
                        )
                    }
                    style={
                      inputStyle
                    }
                  />

                </div>

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
                    '24px'
                }}
              >

                <button
                  type="button"
                  disabled={
                    salvando
                  }
                  onClick={
                    fecharEdicao
                  }
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={
                    salvando
                  }
                  onClick={() => {

                    salvarEdicao()
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
                    salvando
                      ? 'Salvando...'
                      : 'Salvar alterações'
                  }
                </button>

              </div>

            </div>

          </div>
        )}

      </section>
    );
  };

export default GestaoPage;