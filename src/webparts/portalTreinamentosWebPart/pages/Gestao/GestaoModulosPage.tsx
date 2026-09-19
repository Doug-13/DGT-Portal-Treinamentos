import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import FluxoTreinamentoEtapas from
  '../../components/common/FluxoTreinamentoEtapas';

import ModuloConteudosEditor from
  './ModuloConteudosEditor';

import {
  IEditarModuloConteudo,
  IModuloConteudoAdmin,
  INovoModuloConteudo
} from '../../services/ModuloConteudoAdminService';

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

  moduloConteudoSelecionadoId:
    string;

  conteudosModulo:
    IModuloConteudoAdmin[];

  carregandoConteudosModulo:
    boolean;

  processandoConteudosModulo:
    boolean;

  erroConteudosModulo:
    string;

  onSelecionarModuloConteudo:
    (
      moduloId:
        string
    ) => Promise<void>;

  onLimparModuloConteudo:
    () => void;

  onCriarConteudoModulo:
    (
      dados:
        INovoModuloConteudo
    ) => Promise<void>;

  onEditarConteudoModulo:
    (
      dados:
        IEditarModuloConteudo
    ) => Promise<void>;

  onDefinirConteudoModuloAtivo:
    (
      id:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  onMoverConteudoModuloAcima:
    (
      item:
        IModuloConteudoAdmin
    ) => Promise<void>;

  onMoverConteudoModuloAbaixo:
    (
      item:
        IModuloConteudoAdmin
    ) => Promise<void>;

  modoFluxo?:
    boolean;

  onAvancar?:
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
    '1px solid #0B5CAB',

  borderRadius:
    '8px',

  background:
    '#0B5CAB',

  color:
    '#FFFFFF',

  fontWeight:
    700,

  cursor:
    'pointer',

  opacity:
    1
};

const buttonSecondary:
  React.CSSProperties = {
  padding:
    '9px 14px',

  border:
    '1px solid #0B5CAB',

  borderRadius:
    '8px',

  background:
    '#FFFFFF',

  color:
    '#0B5CAB',

  fontWeight:
    700,

  cursor:
    'pointer',

  opacity:
    1
};

const buttonDanger:
  React.CSSProperties = {
  padding:
    '9px 14px',

  border:
    '1px solid #B42318',

  borderRadius:
    '8px',

  background:
    '#FFFFFF',

  color:
    '#B42318',

  fontWeight:
    700,

  cursor:
    'pointer',

  opacity:
    1
};

const GestaoModulosPage:
  React.FC<
    IGestaoModulosPageProps
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

    const [
      moduloAguardandoConteudo,
      setModuloAguardandoConteudo
    ] =
      React.useState<{
        treinamentoId:
          string;

        titulo:
          string;

        ordem:
          number;
      } | null>(
        null
      );

    const [
      avancando,
      setAvancando
    ] =
      React.useState(
        false
      );

    const treinamentoSelecionado =
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

    React.useEffect(
      () => {

        if (
          !moduloAguardandoConteudo
        ) {
          return;
        }

        const moduloCriado =
          props.modulos
            .filter(
              modulo =>
                modulo.treinamentoId ===
                  moduloAguardandoConteudo.treinamentoId &&
                modulo.titulo
                  .trim()
                  .toLowerCase() ===
                moduloAguardandoConteudo.titulo
                  .trim()
                  .toLowerCase() &&
                modulo.ordem ===
                  moduloAguardandoConteudo.ordem
            )
            .slice()
            .reverse()[0];

        if (
          !moduloCriado?.id
        ) {
          return;
        }

        setModuloAguardandoConteudo(
          null
        );

        props
          .onSelecionarModuloConteudo(
            moduloCriado.id
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

      },
      [
        moduloAguardandoConteudo,
        props.modulos,
        props.onSelecionarModuloConteudo
      ]
    );

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

        if (
          !Number.isFinite(
            ordemNumero
          ) ||
          ordemNumero <= 0
        ) {
          setErroLocal(
            'Informe uma ordem válida.'
          );
          return;
        }

        if (
          !Number.isFinite(
            duracaoNumero
          ) ||
          duracaoNumero < 0
        ) {
          setErroLocal(
            'Informe uma duração válida.'
          );
          return;
        }

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

              // Campo legado mantido apenas para compatibilidade.
              // O conteúdo real agora é criado em blocos modulares.
              tipoModulo:
                'Página',

              obrigatorio,

              ativo,

              urlConteudo:
                ''
            });

          } else {

            setModuloAguardandoConteudo({
              treinamentoId:
                props.treinamentoId,

              titulo:
                titulo.trim(),

              ordem:
                ordemNumero
            });

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

              // Campo legado mantido apenas para compatibilidade.
              // O conteúdo real agora é criado em blocos modulares.
              tipoModulo:
                'Página',

              obrigatorio,

              ativo,

              urlConteudo:
                ''
            });
          }

          setMostrarFormulario(
            false
          );

        } catch (e) {

          if (
            !editando
          ) {
            setModuloAguardandoConteudo(
              null
            );
          }

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar módulo.'
          );
        }
      };

    const avancar =
      async (): Promise<void> => {

        if (
          !props.onAvancar
        ) {
          return;
        }

        if (
          props.modulos.length ===
          0
        ) {
          setErroLocal(
            'Cadastre pelo menos um módulo antes de continuar para a avaliação.'
          );
          return;
        }

        setAvancando(
          true
        );

        setErroLocal('');

        try {

          await props
            .onAvancar();

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Não foi possível avançar para a avaliação.'
          );

        } finally {

          setAvancando(
            false
          );
        }
      };

    return (
      <section>

        <PageHeader
          titulo={
            props.modoFluxo
              ? 'Módulos do treinamento'
              : 'Gestão de módulos'
          }
          subtitulo={
            props.modoFluxo
              ? 'Etapa 2 de 3 — cadastre o conteúdo do treinamento e avance para a avaliação.'
              : 'Cadastre e organize o conteúdo interno dos treinamentos.'
          }
        />

        {
          props.modoFluxo &&
          (
            <FluxoTreinamentoEtapas
              etapa={2}
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
                  .files[0];

              if (
                !arquivo
              ) {
                return;
              }

              setImportandoJson(
                true
              );

              setMensagemImportacao('');
              setErroImportacao('');

              void props
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
                );
            }
          }
        />

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'flex-end',

            marginBottom:
              '14px'
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
              ...buttonSecondary,

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
                : '⬆ Importar módulos por JSON'
            }
          </button>
        </div>

        {
          mensagemImportacao &&
          (
            <div
              style={{
                marginBottom:
                  '14px',

                padding:
                  '12px',

                borderRadius:
                  '8px',

                background:
                  '#E7F5EE',

                color:
                  '#13795B'
              }}
            >
              {
                mensagemImportacao
              }
            </div>
          )
        }

        {
          erroImportacao &&
          (
            <div
              style={{
                marginBottom:
                  '14px',

                padding:
                  '12px',

                borderRadius:
                  '8px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C'
              }}
            >
              {
                erroImportacao
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

            marginBottom:
              '20px',

            alignItems:
              'center',

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
              buttonSecondary
            }
          >
            {
              props.modoFluxo
                ? 'Sair do cadastro'
                : 'Voltar'
            }
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

        {
          props.modoFluxo
            ? (
              <div
                style={{
                  padding:
                    '18px',

                  background:
                    '#f8fafc',

                  border:
                    '1px solid #e5e7eb',

                  borderRadius:
                    '12px',

                  marginBottom:
                    '20px'
                }}
              >
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
                  Treinamento em configuração
                </span>

                <strong
                  style={{
                    display:
                      'block',

                    marginTop:
                      '4px',

                    color:
                      '#0b1f3a'
                  }}
                >
                  {
                    treinamentoSelecionado
                      ? `${treinamentoSelecionado.codigo} - ${treinamentoSelecionado.nome}`
                      : 'Treinamento selecionado'
                  }
                </strong>
              </div>
            )
            : (
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
            )
        }

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

            {
              props.modulos.length ===
              0 &&
              (
                <div
                  style={{
                    padding:
                      '28px',

                    border:
                      '1px dashed #cbd5e1',

                    borderRadius:
                      '12px',

                    background:
                      '#ffffff',

                    textAlign:
                      'center',

                    color:
                      '#64748b'
                  }}
                >
                  Nenhum módulo cadastrado.
                  Clique em <strong>+ Novo módulo</strong> para começar.
                </div>
              )
            }

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
                      '70px minmax(240px, 1fr) 120px 100px 310px',

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
                      onClick={() => {

                        if (
                          props.moduloConteudoSelecionadoId ===
                          modulo.id
                        ) {
                          props
                            .onLimparModuloConteudo();

                          return;
                        }

                        props
                          .onSelecionarModuloConteudo(
                            modulo.id
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
                        props.moduloConteudoSelecionadoId ===
                          modulo.id
                          ? buttonPrimary
                          : buttonSecondary
                      }
                    >
                      {
                        props.moduloConteudoSelecionadoId ===
                          modulo.id
                          ? 'Fechar conteúdo'
                          : '+ Adicionar conteúdo'
                      }
                    </button>

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
                        modulo.ativo
                          ? buttonDanger
                          : buttonSecondary
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

        {
          props.moduloConteudoSelecionadoId &&
          (
            <ModuloConteudosEditor
              moduloId={
                props.moduloConteudoSelecionadoId
              }

              moduloTitulo={
                props.modulos
                  .find(
                    item =>
                      item.id ===
                      props.moduloConteudoSelecionadoId
                  )
                  ?.titulo ||
                'Módulo'
              }

              conteudos={
                props.conteudosModulo
              }

              carregando={
                props.carregandoConteudosModulo
              }

              processando={
                props.processandoConteudosModulo
              }

              erro={
                props.erroConteudosModulo
              }

              onFechar={
                props.onLimparModuloConteudo
              }

              onCriar={
                props.onCriarConteudoModulo
              }

              onEditar={
                props.onEditarConteudoModulo
              }

              onDefinirAtivo={
                props.onDefinirConteudoModuloAtivo
              }

              onMoverAcima={
                props.onMoverConteudoModuloAcima
              }

              onMoverAbaixo={
                props.onMoverConteudoModuloAbaixo
              }
            />
          )
        }

        {
          props.modoFluxo &&
          (
            <div
              style={{
                display:
                  'flex',

                justifyContent:
                  'flex-end',

                marginTop:
                  '24px'
              }}
            >
              <button
                type="button"
                disabled={
                  props.modulos.length ===
                    0 ||
                  avancando
                }
                onClick={() => {
                  avancar()
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

                  opacity:
                    props.modulos.length ===
                      0 ||
                    avancando
                      ? 0.55
                      : 1,

                  cursor:
                    props.modulos.length ===
                      0 ||
                    avancando
                      ? 'default'
                      : 'pointer'
                }}
              >
                {
                  avancando
                    ? 'Abrindo avaliação...'
                    : 'Continuar para avaliação →'
                }
              </button>
            </div>
          )
        }

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
                  '760px',

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

              <h2
                style={{
                  marginBottom:
                    '6px',

                  color:
                    '#0B2D4D'
                }}
              >
                {
                  editando
                    ? 'Editar módulo'
                    : 'Novo módulo'
                }
              </h2>

              <p
                style={{
                  marginTop:
                    0,

                  marginBottom:
                    '20px',

                  color:
                    '#64748B',

                  lineHeight:
                    1.5
                }}
              >
                Primeiro cadastre a estrutura do módulo.
                Os materiais e conteúdos serão adicionados em blocos,
                permitindo combinar texto, vídeo, PDF, links e imagens.
              </p>

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

              <div style={{height:'12px'}} />

              <label>
                Descrição
              </label>

              <textarea
                rows={4}
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
                    '1fr 1fr',

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
                    min={1}
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
                    Duração estimada (min)
                  </label>

                  <input
                    type="number"
                    min={0}
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
              </div>

              <div
                style={{
                  marginTop:
                    '16px',

                  padding:
                    '14px 16px',

                  background:
                    '#F0F7FF',

                  border:
                    '1px solid #B9D7F0',

                  borderRadius:
                    '10px',

                  color:
                    '#0B2D4D'
                }}
              >
                <strong
                  style={{
                    display:
                      'block',

                    marginBottom:
                      '5px'
                  }}
                >
                  Conteúdo do módulo
                </strong>

                <span
                  style={{
                    fontSize:
                      '13px',

                    lineHeight:
                      1.5
                  }}
                >
                  Ao salvar um novo módulo, o editor de conteúdo será
                  aberto automaticamente. Nele você poderá adicionar
                  textos para leitura, vídeos, materiais, links,
                  imagens e destaques.
                </span>
              </div>

              <label
                style={{
                  display:
                    'flex',

                  gap:
                    '8px',

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
                  {
                    props.processando
                      ? 'Salvando...'
                      : 'Salvar módulo'
                  }
                </button>

              </div>

            </div>

          </div>
        )}

      </section>
    );
  };

export default GestaoModulosPage;
