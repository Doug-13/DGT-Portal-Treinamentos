import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IEditarModulo,
  IModuloAdmin,
  INovoModulo
} from '../../services/ModuloAdminService';

export interface IGestaoModulosPageProps {

  treinamentos:
    ITreinamentoAdmin[];

  treinamentoId:
    string;

  modulos:
    IModuloAdmin[];

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
      treinamentoId:
        string
    ) => Promise<void>;

  onCriar:
    (
      dados:
        INovoModulo
    ) => Promise<void>;

  onEditar:
    (
      dados:
        IEditarModulo
    ) => Promise<void>;

  onDefinirAtivo:
    (
      moduloId:
        string,
      ativo:
        boolean
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
    '8px'
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

  cursor:
    'pointer'
};

const GestaoModulosPage:
  React.FC<
    IGestaoModulosPageProps
  > = (
    props
  ) => {

    const [
      editando,
      setEditando
    ] =
      React.useState<
        IModuloAdmin | undefined
      >(undefined);

    const [
      mostrarFormulario,
      setMostrarFormulario
    ] =
      React.useState(
        false
      );

    const [
      titulo,
      setTitulo
    ] =
      React.useState('');

    const [
      descricao,
      setDescricao
    ] =
      React.useState('');

    const [
      ordem,
      setOrdem
    ] =
      React.useState('1');

    const [
      duracao,
      setDuracao
    ] =
      React.useState('0');

    const [
      tipo,
      setTipo
    ] =
      React.useState(
        'Página'
      );

    const [
      url,
      setUrl
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
      ativo,
      setAtivo
    ] =
      React.useState(
        true
      );

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const abrirNovo =
      (): void => {

        if (
          !props.treinamentoId
        ) {
          setErroLocal(
            'Selecione um treinamento primeiro.'
          );

          return;
        }

        setEditando(
          undefined
        );

        setTitulo('');
        setDescricao('');

        setOrdem(
          String(
            props.modulos.length +
            1
          )
        );

        setDuracao('0');
        setTipo('Página');
        setUrl('');
        setObrigatorio(true);
        setAtivo(true);
        setErroLocal('');

        setMostrarFormulario(
          true
        );
      };

    const abrirEditar = (
      modulo:
        IModuloAdmin
    ): void => {

      setEditando(
        modulo
      );

      setTitulo(
        modulo.titulo
      );

      setDescricao(
        modulo.descricao
      );

      setOrdem(
        String(
          modulo.ordem
        )
      );

      setDuracao(
        String(
          modulo.duracaoMin
        )
      );

      setTipo(
        modulo.tipoModulo ||
        'Página'
      );

      setUrl(
        modulo.urlConteudo
      );

      setObrigatorio(
        modulo.obrigatorio
      );

      setAtivo(
        modulo.ativo
      );

      setErroLocal('');

      setMostrarFormulario(
        true
      );
    };

    const salvar =
      async (): Promise<void> => {

        setErroLocal('');

        if (
          !props.treinamentoId
        ) {
          setErroLocal(
            'Selecione um treinamento.'
          );

          return;
        }

        if (
          !titulo.trim()
        ) {
          setErroLocal(
            'Informe o título do módulo.'
          );

          return;
        }

        const ordemNumero =
          Number(
            ordem
          );

        const duracaoNumero =
          Number(
            duracao
          );

        try {

          if (
            editando
          ) {

            await props.onEditar({
              id:
                editando.id,

              treinamentoId:
                props.treinamentoId,

              titulo:
                titulo.trim(),

              descricao:
                descricao.trim(),

              ordem:
                ordemNumero,

              duracaoMin:
                duracaoNumero,

              tipoModulo:
                tipo,

              obrigatorio,

              ativo,

              urlConteudo:
                url.trim()
            });

          } else {

            await props.onCriar({
              treinamentoId:
                props.treinamentoId,

              titulo:
                titulo.trim(),

              descricao:
                descricao.trim(),

              ordem:
                ordemNumero,

              duracaoMin:
                duracaoNumero,

              tipoModulo:
                tipo,

              obrigatorio,

              ativo,

              urlConteudo:
                url.trim()
            });
          }

          setMostrarFormulario(
            false
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar módulo.'
          );
        }
      };

    return (
      <section>

        <PageHeader
          titulo="Gestão de módulos"
          subtitulo="Cadastre e organize o conteúdo interno dos treinamentos."
        />

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            gap:
              '16px',

            marginBottom:
              '20px',

            alignItems:
              'center'
          }}
        >

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

          <button
            type="button"
            onClick={
              abrirNovo
            }
            style={
              buttonPrimary
            }
          >
            + Novo módulo
          </button>

        </div>

        {props.erro && (

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
            {props.erro}
          </div>
        )}

        {erroLocal && (

          <div
            style={{
              padding:
                '12px',

              marginBottom:
                '16px',

              background:
                '#fff4ce',

              color:
                '#6a4b00',

              borderRadius:
                '8px'
            }}
          >
            {erroLocal}
          </div>
        )}

        <div
          style={{
            padding:
              '20px',

            background:
              '#ffffff',

            border:
              '1px solid #e5e7eb',

            borderRadius:
              '14px',

            marginBottom:
              '20px'
          }}
        >

          <label>
            Treinamento
          </label>

          <select
            value={
              props.treinamentoId
            }
            onChange={
              event => {

                props
                  .onSelecionarTreinamento(
                    event.target.value
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
            style={{
              ...inputStyle,

              marginTop:
                '8px'
            }}
          >

            <option value="">
              Selecione um treinamento
            </option>

            {props.treinamentos.map(
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
            Carregando módulos...
          </div>

        ) : (

          <div
            style={{
              display:
                'grid',

              gap:
                '12px'
            }}
          >

            {props.modulos.map(
              modulo => (

                <article
                  key={
                    modulo.id
                  }
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      '70px 1fr 130px 120px 220px',

                    gap:
                      '16px',

                    alignItems:
                      'center',

                    padding:
                      '18px',

                    border:
                      '1px solid #e5e7eb',

                    borderRadius:
                      '12px',

                    background:
                      '#ffffff'
                  }}
                >

                  <strong>
                    #{modulo.ordem}
                  </strong>

                  <div>

                    <strong>
                      {
                        modulo.titulo
                      }
                    </strong>

                    <span
                      style={{
                        display:
                          'block',

                        marginTop:
                          '4px',

                        fontSize:
                          '12px',

                        color:
                          '#64748b'
                      }}
                    >
                      {
                        modulo.descricao
                      }
                    </span>

                  </div>

                  <span>
                    {
                      modulo.tipoModulo ||
                      'Página'
                    }
                  </span>

                  <span>
                    {
                      modulo.duracaoMin
                    } min
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
                      onClick={() =>
                        abrirEditar(
                          modulo
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
                          .onDefinirAtivo(
                            modulo.id,
                            !modulo.ativo
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
                        modulo.ativo
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

        {mostrarFormulario && (

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
                  '16px'
              }}
            >

              <h2>
                {
                  editando
                    ? 'Editar módulo'
                    : 'Novo módulo'
                }
              </h2>

              <label>
                Título
              </label>

              <input
                value={
                  titulo
                }
                onChange={
                  event =>
                    setTitulo(
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
                    '12px'
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
                    '1fr 1fr 1fr',

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

                </div>

                <div>

                  <label>
                    Duração
                  </label>

                  <input
                    type="number"
                    value={
                      duracao
                    }
                    onChange={
                      event =>
                        setDuracao(
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
                    Tipo
                  </label>

                  <select
                    value={
                      tipo
                    }
                    onChange={
                      event =>
                        setTipo(
                          event.target.value
                        )
                    }
                    style={
                      inputStyle
                    }
                  >
                    <option value="Página">
                      Página
                    </option>

                    <option value="Vídeo">
                      Vídeo
                    </option>

                    <option value="PDF">
                      PDF
                    </option>

                    <option value="Link">
                      Link
                    </option>

                    <option value="Documento">
                      Documento
                    </option>
                  </select>

                </div>

              </div>

              <div
                style={{
                  marginTop:
                    '14px'
                }}
              >

                <label>
                  URL do conteúdo
                </label>

                <input
                  value={
                    url
                  }
                  onChange={
                    event =>
                      setUrl(
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

                  marginTop:
                    '16px'
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

                Obrigatório

              </label>

              <label
                style={{
                  display:
                    'flex',

                  gap:
                    '8px',

                  marginTop:
                    '10px'
                }}
              >

                <input
                  type="checkbox"
                  checked={
                    ativo
                  }
                  onChange={
                    event =>
                      setAtivo(
                        event.target.checked
                      )
                  }
                />

                Ativo

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
                    setMostrarFormulario(
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

                    salvar()
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
                  Salvar
                </button>

              </div>

            </div>

          </div>
        )}

      </section>
    );
  };

export default GestaoModulosPage;