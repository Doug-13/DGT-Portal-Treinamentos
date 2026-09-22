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

import {
  IConteudoModuloJson,
  IModuloImportJson,
  IModuloJson
} from '../../services/ImportacaoJsonEtapasService';

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

  onAnalisarJson:
    (
      arquivo:
        File
    ) => Promise<IModuloImportJson>;

  onConfirmarImportacaoJson:
    (
      dados:
        IModuloImportJson
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
      previaImportacao,
      setPreviaImportacao
    ] =
      React.useState<
        IModuloImportJson | null
      >(null);

    const [
      confirmandoImportacao,
      setConfirmandoImportacao
    ] =
      React.useState(false);

    const [
      erroPreviaImportacao,
      setErroPreviaImportacao
    ] =
      React.useState('');

    // Controla em qual modo o editor de conteúdo do módulo selecionado
    // deve abrir: 'preview' (botão "Pré-visualizar" da lista) ou
    // 'edicao' (botão "Editar módulo", dentro do próprio modal, ou
    // após criar/importar um módulo).
    const [
      modoConteudoSelecionado,
      setModoConteudoSelecionado
    ] =
      React.useState<
        'preview' | 'edicao'
      >('preview');

    // Guarda o título do primeiro módulo importado para, assim que ele
    // aparecer em props.modulos (após o recarregamento), abrir o editor
    // de conteúdo automaticamente e permitir adicionar novos itens.
    const [
      moduloImportadoAguardandoConteudo,
      setModuloImportadoAguardandoConteudo
    ] =
      React.useState<{
        treinamentoId: string;
        titulo: string;
      } | null>(null);

    React.useEffect(
      () => {

        if (
          !moduloImportadoAguardandoConteudo
        ) {
          return;
        }

        const moduloEncontrado =
          props.modulos
            .filter(
              modulo =>
                modulo.treinamentoId ===
                  moduloImportadoAguardandoConteudo.treinamentoId &&
                modulo.titulo
                  .trim()
                  .toLowerCase() ===
                moduloImportadoAguardandoConteudo.titulo
                  .trim()
                  .toLowerCase()
            )
            .slice()
            .reverse()[0];

        if (
          !moduloEncontrado?.id
        ) {
          return;
        }

        setModuloImportadoAguardandoConteudo(
          null
        );

        setModoConteudoSelecionado(
          'edicao'
        );

        props
          .onSelecionarModuloConteudo(
            moduloEncontrado.id
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
        moduloImportadoAguardandoConteudo,
        props.modulos
      ]
    );


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
      revisandoModulo,
      setRevisandoModulo
    ] =
      React.useState(false);

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
        setRevisandoModulo(false);

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
      setRevisandoModulo(false);

      setMostrarFormulario(
        true
      );

      // Já seleciona o conteúdo deste módulo, para que o editor de
      // blocos apareça junto — na mesma tela, sem passo extra.
      setModoConteudoSelecionado(
        'edicao'
      );

      if (
        props.moduloConteudoSelecionadoId !==
          modulo.id
      ) {
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
      }
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

        setModoConteudoSelecionado(
          'edicao'
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

    const validarFormularioModulo =
      (): boolean => {

        setErroLocal('');

        if (
          !props.treinamentoId
        ) {
          setErroLocal(
            'Selecione um treinamento.'
          );

          return false;
        }

        if (
          !titulo.trim()
        ) {
          setErroLocal(
            'Informe o título do módulo.'
          );

          return false;
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
          return false;
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
          return false;
        }

        return true;
      };

    // Passo 1: valida os campos e abre a revisão (nada é gravado
    // ainda). O usuário confirma na revisão ou volta para ajustar.
    const abrirRevisaoModulo =
      (): void => {

        if (
          !validarFormularioModulo()
        ) {
          return;
        }

        setRevisandoModulo(
          true
        );
      };

    // Passo 2: chamado a partir da tela de revisão. Só então o
    // módulo é efetivamente criado/atualizado no Dataverse.
    const salvar =
      async (): Promise<void> => {

        if (
          !validarFormularioModulo()
        ) {
          setRevisandoModulo(
            false
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

          setRevisandoModulo(
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

          // Volta para a tela de edição (não a de revisão) para
          // que o usuário veja o erro junto dos campos editáveis.
          setRevisandoModulo(
            false
          );

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar módulo.'
          );
        }
      };

    // ==========================================================
    // PRÉVIA DE IMPORTAÇÃO POR JSON — nada foi gravado ainda.
    // As funções abaixo só alteram o estado local (previaImportacao).
    // ==========================================================

    const atualizarModuloPrevia = (
      indiceModulo: number,
      alteracoes: Partial<IModuloJson>
    ): void => {

      setPreviaImportacao(atual => {
        if (!atual) { return atual; }

        const modulos = atual.modulos.map((modulo, indice) =>
          indice === indiceModulo
            ? { ...modulo, ...alteracoes }
            : modulo
        );

        return { ...atual, modulos };
      });
    };

    const removerModuloPrevia = (
      indiceModulo: number
    ): void => {

      setPreviaImportacao(atual => {
        if (!atual) { return atual; }

        return {
          ...atual,
          modulos: atual.modulos.filter((_, indice) => indice !== indiceModulo)
        };
      });
    };

    const atualizarConteudoPrevia = (
      indiceModulo: number,
      indiceConteudo: number,
      alteracoes: Partial<IConteudoModuloJson>
    ): void => {

      setPreviaImportacao(atual => {
        if (!atual) { return atual; }

        const modulos = atual.modulos.map((modulo, im) => {
          if (im !== indiceModulo) { return modulo; }

          const conteudos = modulo.conteudos.map((conteudo, ic) =>
            ic === indiceConteudo
              ? { ...conteudo, ...alteracoes }
              : conteudo
          );

          return { ...modulo, conteudos };
        });

        return { ...atual, modulos };
      });
    };

    const removerConteudoPrevia = (
      indiceModulo: number,
      indiceConteudo: number
    ): void => {

      setPreviaImportacao(atual => {
        if (!atual) { return atual; }

        const modulos = atual.modulos.map((modulo, im) => {
          if (im !== indiceModulo) { return modulo; }

          return {
            ...modulo,
            conteudos: modulo.conteudos.filter((_, ic) => ic !== indiceConteudo)
          };
        });

        return { ...atual, modulos };
      });
    };

    const confirmarImportacao = async (): Promise<void> => {

      if (!previaImportacao) { return; }

      if (previaImportacao.modulos.length === 0) {
        setErroPreviaImportacao(
          'Não há módulos para importar — todos foram removidos da prévia.'
        );
        return;
      }

      setConfirmandoImportacao(true);
      setErroPreviaImportacao('');

      try {

        // Guarda o título do primeiro módulo importado antes de limpar
        // a prévia, para localizá-lo assim que a lista for recarregada.
        const primeiroModuloImportado =
          previaImportacao.modulos[0]?.titulo;

        const mensagem = await props.onConfirmarImportacaoJson(previaImportacao);

        setMensagemImportacao(
          `${mensagem} Você já pode adicionar novos itens ao módulo abaixo.`
        );
        setErroImportacao('');
        setPreviaImportacao(null);

        await props.onSelecionarTreinamento(props.treinamentoId);

        if (primeiroModuloImportado) {
          setModuloImportadoAguardandoConteudo({
            treinamentoId: props.treinamentoId,
            titulo: primeiroModuloImportado
          });
        }

      } catch (error: unknown) {

        setErroPreviaImportacao(
          error instanceof Error
            ? error.message
            : 'Erro ao gravar os módulos importados.'
        );

      } finally {

        setConfirmandoImportacao(false);
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

    const editorConteudoSelecionado:
      React.ReactNode =
        props.moduloConteudoSelecionadoId
          ? (
            <ModuloConteudosEditor
              // A key força o componente a reiniciar (e reaplicar o modo
              // inicial correto) sempre que o módulo ou o modo mudarem.
              key={
                `${props.moduloConteudoSelecionadoId}-${modoConteudoSelecionado}`
              }

              modoInicial={
                modoConteudoSelecionado
              }

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
          : null;

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
              : 'Cadastre, importe e edite módulos e conteúdos internos dos treinamentos.'
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
              setErroPreviaImportacao('');

              void props
                .onAnalisarJson(
                  arquivo
                )
                .then(
                  dados => {
                    // Não grava nada ainda: apenas abre a prévia
                    // para o usuário revisar e ajustar antes de salvar.
                    setPreviaImportacao(
                      dados
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
                        : 'Erro ao ler o arquivo JSON.'
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
                ? 'Lendo arquivo...'
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

                        const jaEstaEmPreview =
                          props.moduloConteudoSelecionadoId ===
                            modulo.id &&
                          modoConteudoSelecionado ===
                            'preview';

                        if (
                          jaEstaEmPreview
                        ) {
                          props
                            .onLimparModuloConteudo();

                          return;
                        }

                        setModoConteudoSelecionado(
                          'preview'
                        );

                        if (
                          props.moduloConteudoSelecionadoId !==
                            modulo.id
                        ) {
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
                        }
                      }}
                      style={
                        props.moduloConteudoSelecionadoId ===
                          modulo.id &&
                        modoConteudoSelecionado ===
                          'preview'
                          ? buttonPrimary
                          : buttonSecondary
                      }
                    >
                      {
                        props.moduloConteudoSelecionadoId ===
                          modulo.id &&
                        modoConteudoSelecionado ===
                          'preview'
                          ? 'Fechar pré-visualização'
                          : '👁 Pré-visualizar'
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
                      Editar módulo
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
          // Quando está editando um módulo existente, o editor de
          // conteúdo aparece DENTRO do próprio modal (ver mais abaixo).
          // Fora do modal, ele continua aparecendo aqui embaixo, como
          // antes — inclusive após criar um módulo novo ou importar por JSON.
          // A pré-visualização (modo 'preview') NÃO aparece aqui: ela abre
          // em tela própria (modal), veja mais abaixo — assim não fica
          // escondida lá embaixo quando há muitos módulos na lista.
          !(mostrarFormulario && editando) &&
          modoConteudoSelecionado === 'edicao' &&
          editorConteudoSelecionado
        }

        {
          // Pré-visualização em tela própria (modal), para não depender
          // da posição do módulo na lista.
          props.moduloConteudoSelecionadoId &&
          modoConteudoSelecionado === 'preview' &&
          (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10002,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '20px',
                overflowY: 'auto',
                background: 'rgba(15,23,42,.55)'
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '1000px',
                  marginBottom: '40px'
                }}
              >
                {editorConteudoSelecionado}
              </div>
            </div>
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

                // Editando um módulo existente: o modal também mostra o
                // editor de conteúdo completo, então precisa de mais espaço.
                maxWidth:
                  editando
                    ? '1180px'
                    : '760px',

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

              {erroLocal && (
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#FDE7E9',
                    color: '#A4262C',
                    fontSize: '13px'
                  }}
                >
                  {erroLocal}
                </div>
              )}

              {!revisandoModulo && (
              <>

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

              </>
              )}

              {revisandoModulo && (
                <div
                  style={{
                    padding:
                      '14px 16px',
                    background:
                      '#F8FAFC',
                    border:
                      '1px solid #E2E8F0',
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
                        '10px'
                    }}
                  >
                    Confira antes de salvar
                  </strong>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '8px', fontSize: '14px' }}>
                    <span style={{ color: '#64748B' }}>Título</span>
                    <span>{titulo.trim() || '—'}</span>

                    <span style={{ color: '#64748B' }}>Descrição</span>
                    <span>{descricao.trim() || '—'}</span>

                    <span style={{ color: '#64748B' }}>Ordem</span>
                    <span>{ordem}</span>

                    <span style={{ color: '#64748B' }}>Duração estimada</span>
                    <span>{duracao} min</span>

                    <span style={{ color: '#64748B' }}>Obrigatório</span>
                    <span>{obrigatorio ? 'Sim' : 'Não'}</span>

                    <span style={{ color: '#64748B' }}>Ativo</span>
                    <span>{ativo ? 'Sim' : 'Não'}</span>
                  </div>

                  <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                    Nada foi salvo ainda. Se algo estiver errado, clique em
                    &quot;Voltar e editar&quot;. Ao confirmar, o módulo será
                    {editando ? ' atualizado' : ' criado'} no Dataverse{!editando ? ' e o editor de conteúdo será aberto em seguida' : ''}.
                  </p>
                </div>
              )}

              {editando && (
                <div style={{ marginTop: '20px' }}>
                  {editorConteudoSelecionado}
                </div>
              )}

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
                  onClick={() => {
                    if (revisandoModulo) {
                      setRevisandoModulo(false);
                      return;
                    }
                    setMostrarFormulario(
                      false
                    );
                  }}
                  style={
                    buttonSecondary
                  }
                >
                  {revisandoModulo ? 'Voltar e editar' : 'Cancelar'}
                </button>

                <button
                  type="button"
                  disabled={
                    props.processando
                  }
                  onClick={() => {

                    if (!revisandoModulo) {
                      abrirRevisaoModulo();
                      return;
                    }

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
                    revisandoModulo
                      ? (props.processando ? 'Salvando...' : 'Confirmar e salvar módulo')
                      : 'Revisar antes de salvar'
                  }
                </button>

              </div>

            </div>

          </div>
        )}

        {previaImportacao && (

          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10001,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '20px',
              overflowY: 'auto',
              background: 'rgba(15,23,42,.55)'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '860px',
                padding: '24px',
                background: '#ffffff',
                borderRadius: '16px',
                marginBottom: '40px'
              }}
            >
              <h2 style={{ marginBottom: '6px', color: '#0B2D4D' }}>
                Revisar importação por JSON
              </h2>

              <p style={{ marginTop: 0, marginBottom: '18px', color: '#64748B', lineHeight: 1.5 }}>
                Nada foi gravado ainda. Ajuste títulos, descrições e
                conteúdos abaixo, remova o que não for necessário e só
                então confirme para salvar no Dataverse.
              </p>

              {erroPreviaImportacao && (
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#FDE7E9',
                    color: '#A4262C',
                    fontSize: '13px'
                  }}
                >
                  {erroPreviaImportacao}
                </div>
              )}

              {previaImportacao.modulos.map((modulo, indiceModulo) => (
                <div
                  key={indiceModulo}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '14px',
                    background: '#F8FAFC'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <strong style={{ color: '#0B2D4D' }}>
                      Módulo #{indiceModulo + 1}
                    </strong>

                    <button
                      type="button"
                      onClick={() => removerModuloPrevia(indiceModulo)}
                      style={{ ...buttonDanger, padding: '4px 10px', fontSize: '12px' }}
                    >
                      Remover módulo
                    </button>
                  </div>

                  <div style={{ height: '10px' }} />

                  <label style={{ fontSize: '13px' }}>Título</label>
                  <input
                    value={modulo.titulo}
                    onChange={event =>
                      atualizarModuloPrevia(indiceModulo, { titulo: event.target.value })
                    }
                    style={inputStyle}
                  />

                  <div style={{ height: '10px' }} />

                  <label style={{ fontSize: '13px' }}>Descrição</label>
                  <textarea
                    rows={2}
                    value={modulo.descricao || ''}
                    onChange={event =>
                      atualizarModuloPrevia(indiceModulo, { descricao: event.target.value })
                    }
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <div>
                      <label style={{ fontSize: '13px' }}>Ordem</label>
                      <input
                        type="number"
                        min={1}
                        value={modulo.ordem}
                        onChange={event =>
                          atualizarModuloPrevia(indiceModulo, { ordem: Number(event.target.value) })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '13px' }}>Duração (min)</label>
                      <input
                        type="number"
                        min={0}
                        value={modulo.duracaoMin || 0}
                        onChange={event =>
                          atualizarModuloPrevia(indiceModulo, { duracaoMin: Number(event.target.value) })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '20px' }}>
                        <input
                          type="checkbox"
                          checked={modulo.obrigatorio ?? true}
                          onChange={event =>
                            atualizarModuloPrevia(indiceModulo, { obrigatorio: event.target.checked })
                          }
                        />
                        Obrigatório
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <strong style={{ fontSize: '13px', color: '#0B2D4D' }}>
                      Conteúdos ({modulo.conteudos.length})
                    </strong>

                    {modulo.conteudos.map((conteudo, indiceConteudo) => (
                      <div
                        key={indiceConteudo}
                        style={{
                          border: '1px solid #E2E8F0',
                          borderRadius: '10px',
                          padding: '12px',
                          marginTop: '10px',
                          background: '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0B5CAB' }}>
                            #{indiceConteudo + 1} — {conteudo.tipo}
                          </span>

                          <button
                            type="button"
                            onClick={() => removerConteudoPrevia(indiceModulo, indiceConteudo)}
                            style={{ ...buttonDanger, padding: '3px 8px', fontSize: '11px' }}
                          >
                            Remover
                          </button>
                        </div>

                        {conteudo.tipo !== 'Cards' && conteudo.tipo !== 'PerguntaRapida' && (
                          <>
                            <div style={{ height: '8px' }} />
                            <label style={{ fontSize: '12px' }}>Título do bloco</label>
                            <input
                              value={conteudo.titulo || ''}
                              onChange={event =>
                                atualizarConteudoPrevia(indiceModulo, indiceConteudo, { titulo: event.target.value })
                              }
                              style={inputStyle}
                            />

                            <div style={{ height: '8px' }} />
                            <label style={{ fontSize: '12px' }}>
                              {conteudo.tipo === 'Video' || conteudo.tipo === 'Link' || conteudo.tipo === 'Material' || conteudo.tipo === 'Imagem'
                                ? 'URL / conteúdo'
                                : 'Texto'}
                            </label>
                            <textarea
                              rows={3}
                              value={conteudo.conteudo || conteudo.conteudoHtml || conteudo.url || ''}
                              onChange={event =>
                                atualizarConteudoPrevia(indiceModulo, indiceConteudo,
                                  conteudo.url !== undefined && conteudo.conteudo === undefined
                                    ? { url: event.target.value }
                                    : { conteudo: event.target.value }
                                )
                              }
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          </>
                        )}

                        {conteudo.tipo === 'Cards' && (
                          <>
                            <div style={{ height: '8px' }} />
                            {(conteudo.cards || []).map((card, indiceCard) => (
                              <div key={indiceCard} style={{ marginTop: '6px', paddingTop: '6px', borderTop: indiceCard > 0 ? '1px dashed #E2E8F0' : undefined }}>
                                <label style={{ fontSize: '12px' }}>Card {indiceCard + 1} — título</label>
                                <input
                                  value={card.titulo}
                                  onChange={event => {
                                    const novosCards = (conteudo.cards || []).map((c, i) =>
                                      i === indiceCard ? { ...c, titulo: event.target.value } : c
                                    );
                                    atualizarConteudoPrevia(indiceModulo, indiceConteudo, { cards: novosCards });
                                  }}
                                  style={inputStyle}
                                />
                                <label style={{ fontSize: '12px' }}>Card {indiceCard + 1} — descrição</label>
                                <textarea
                                  rows={2}
                                  value={card.descricao}
                                  onChange={event => {
                                    const novosCards = (conteudo.cards || []).map((c, i) =>
                                      i === indiceCard ? { ...c, descricao: event.target.value } : c
                                    );
                                    atualizarConteudoPrevia(indiceModulo, indiceConteudo, { cards: novosCards });
                                  }}
                                  style={{ ...inputStyle, resize: 'vertical' }}
                                />
                              </div>
                            ))}
                          </>
                        )}

                        {conteudo.tipo === 'PerguntaRapida' && conteudo.pergunta && (
                          <>
                            <div style={{ height: '8px' }} />
                            <label style={{ fontSize: '12px' }}>Enunciado</label>
                            <textarea
                              rows={2}
                              value={conteudo.pergunta.enunciado}
                              onChange={event =>
                                atualizarConteudoPrevia(indiceModulo, indiceConteudo, {
                                  pergunta: { ...conteudo.pergunta!, enunciado: event.target.value }
                                })
                              }
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />

                            {conteudo.pergunta.alternativas.map((alternativa, indiceAlternativa) => (
                              <div key={indiceAlternativa} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <input
                                  type="checkbox"
                                  checked={alternativa.correta}
                                  onChange={event => {
                                    const novasAlternativas = conteudo.pergunta!.alternativas.map((a, i) =>
                                      i === indiceAlternativa ? { ...a, correta: event.target.checked } : a
                                    );
                                    atualizarConteudoPrevia(indiceModulo, indiceConteudo, {
                                      pergunta: { ...conteudo.pergunta!, alternativas: novasAlternativas }
                                    });
                                  }}
                                />
                                <input
                                  value={alternativa.texto}
                                  onChange={event => {
                                    const novasAlternativas = conteudo.pergunta!.alternativas.map((a, i) =>
                                      i === indiceAlternativa ? { ...a, texto: event.target.value } : a
                                    );
                                    atualizarConteudoPrevia(indiceModulo, indiceConteudo, {
                                      pergunta: { ...conteudo.pergunta!, alternativas: novasAlternativas }
                                    });
                                  }}
                                  style={{ ...inputStyle, flex: 1 }}
                                />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  disabled={confirmandoImportacao}
                  onClick={() => setPreviaImportacao(null)}
                  style={{ ...buttonSecondary, opacity: confirmandoImportacao ? 0.55 : 1 }}
                >
                  Cancelar importação
                </button>

                <button
                  type="button"
                  disabled={confirmandoImportacao}
                  onClick={() => {
                    confirmarImportacao().catch((error: unknown) => console.error(error));
                  }}
                  style={{ ...buttonPrimary, opacity: confirmandoImportacao ? 0.55 : 1 }}
                >
                  {confirmandoImportacao ? 'Salvando...' : 'Confirmar e importar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </section>
    );
  };

export default GestaoModulosPage;