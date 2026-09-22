import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IPublicarRevisao,
  IResultadoPublicacaoRevisao
} from '../../services/RevisaoDocumentoAdminService';

import PublicarRevisaoModal from
  '../Gestao/PublicarRevisaoModal';

import ResultadoPublicacaoRevisaoCard from
  '../Gestao/ResultadoPublicacaoRevisaoCard';

export interface IDocumentoDetalhePageProps {
  documento?: IDocumento;

  revisoes:
    IDocumentoRevisao[];

  carregando:
    boolean;

  erro:
    string;

  // Usados para o fluxo de aprovação: só o Gestor da área do
  // documento (ou um Administrador) pode aprovar e publicar.
  contexto?:
    IContextoAcesso;

  usuariosAreas:
    IUsuarioAreaAdmin[];

  processando:
    boolean;

  onEnviarRevisao:
    (
      revisao:
        IDocumentoRevisao
    ) => Promise<void>;

  onEnviarAprovacao:
    (
      revisao:
        IDocumentoRevisao
    ) => Promise<void>;

  onDevolverElaboracao:
    (
      revisao:
        IDocumentoRevisao
    ) => Promise<void>;

  processandoPublicacao:
    boolean;

  erroPublicacao:
    string;

  resultadoPublicacao?:
    IResultadoPublicacaoRevisao;

  onPublicarRevisao:
    (
      dados:
        IPublicarRevisao
    ) => Promise<IResultadoPublicacaoRevisao>;

  onLimparResultadoPublicacao:
    () => void;

  onVoltar:
    () => void;
}

// ============================================================
// UTILITÁRIOS
// ============================================================

const formatarData = (
  valor?: string
): string => {

  if (!valor) {
    return '-';
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return valor;
  }

  return data.toLocaleDateString(
    'pt-BR'
  );
};

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

const Card:
  React.FC<{
    titulo: string;
    valor: string;
  }> = ({
    titulo,
    valor
  }) => (

    <div
      style={{
        background:
          '#ffffff',
        border:
          '1px solid #e5e7eb',
        borderRadius:
          '12px',
        padding:
          '16px'
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
        {titulo}
      </span>

      <strong
        style={{
          display:
            'block',
          marginTop:
            '5px',
          color:
            '#0b1f3a'
        }}
      >
        {valor}
      </strong>

    </div>
  );

const Informacao:
  React.FC<{
    titulo: string;
    valor: string;
  }> = ({
    titulo,
    valor
  }) => (

    <div>

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
        {titulo}
      </span>

      <strong
        style={{
          display:
            'block',
          marginTop:
            '3px',
          color:
            '#334155',
          fontSize:
            '13px'
        }}
      >
        {valor}
      </strong>

    </div>
  );

const BlocoTexto:
  React.FC<{
    titulo: string;
    texto: string;
  }> = ({
    titulo,
    texto
  }) => (

    <div
      style={{
        marginTop:
          '16px'
      }}
    >

      <strong
        style={{
          display:
            'block',
          color:
            '#334155',
          fontSize:
            '13px'
        }}
      >
        {titulo}
      </strong>

      <p
        style={{
          margin:
            '5px 0 0',
          color:
            '#64748b',
          lineHeight:
            1.5
        }}
      >
        {texto}
      </p>

    </div>
  );

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

const normalizarStatus = (
  valor:
    string
): string =>

  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim();

const botaoAcaoBase:
  React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  color: '#1F2937',
  fontSize: '12.5px',
  fontWeight: 700
};

const AcoesFluxoRevisao:
  React.FC<{
    revisao: IDocumentoRevisao;
    processando: boolean;
    podeAprovar: boolean;
    onEnviarRevisao: (revisao: IDocumentoRevisao) => Promise<void>;
    onEnviarAprovacao: (revisao: IDocumentoRevisao) => Promise<void>;
    onDevolverElaboracao: (revisao: IDocumentoRevisao) => Promise<void>;
    onAbrirPublicar: () => void;
  }> = ({
    revisao,
    processando,
    podeAprovar,
    onEnviarRevisao,
    onEnviarAprovacao,
    onDevolverElaboracao,
    onAbrirPublicar
  }) => {

    const [
      mostrarReprovar,
      setMostrarReprovar
    ] =
      React.useState(false);

    const [
      motivoReprovacao,
      setMotivoReprovacao
    ] =
      React.useState('');

    const [
      mensagemReprovado,
      setMensagemReprovado
    ] =
      React.useState('');

    const executar =
      (
        acao:
          () => Promise<void>
      ): void => {

        acao()
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

    const statusNormalizado =
      normalizarStatus(
        revisao.status
      );

    // Qualquer valor não reconhecido (vazio, ou um status legado de
    // antes deste fluxo existir) é tratado como "Elaboração" — evita
    // uma revisão ficar sem nenhum botão de ação.
    const estagio:
      'elaboracao' | 'revisao' | 'aprovacao' | 'vigente' =
      statusNormalizado === 'revisao' ||
      statusNormalizado === 'aprovacao' ||
      statusNormalizado === 'vigente'
        ? statusNormalizado
        : 'elaboracao';

    const botaoAcao:
      React.CSSProperties = {
      ...botaoAcaoBase,
      cursor:
        processando
          ? 'not-allowed'
          : 'pointer'
    };

    return (
      <>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '12px'
          }}
        >
          {
            // Elaboração: o documento só precisa ser enviado para o
            // Gestor avaliar — a decisão em si acontece na etapa
            // seguinte (Aprovação), não aqui.
            estagio === 'elaboracao' && (
              <button
                type="button"
                disabled={processando}
                style={botaoAcao}
                onClick={() =>
                  executar(() => onEnviarAprovacao(revisao))
                }
              >
                Enviar para avaliação do Gestor
              </button>
            )
          }

          {
            // Aprovação ("Gestor avalia o documento"): só aqui o
            // Gestor decide. Aprovado → Vigente. Reprovado → volta
            // para Elaboração.
            estagio === 'aprovacao' &&
            (
              podeAprovar
                ? (
                  <>
                    <button
                      type="button"
                      disabled={processando}
                      style={{
                        ...botaoAcao,
                        border: 0,
                        background: '#0E9F6E',
                        color: '#FFFFFF'
                      }}
                      onClick={onAbrirPublicar}
                    >
                      ✓ Aprovar
                    </button>

                    <button
                      type="button"
                      disabled={processando}
                      style={{
                        ...botaoAcao,
                        border: 0,
                        background: '#D92D20',
                        color: '#FFFFFF'
                      }}
                      onClick={() => {
                        setMotivoReprovacao('');
                        setMensagemReprovado('');
                        setMostrarReprovar(true);
                      }}
                    >
                      ✕ Reprovar
                    </button>
                  </>
                )
                : (
                  <span
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: '#FFF4E5',
                      color: '#B45309',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                    title="Somente o Gestor da área (ou um Administrador) pode aprovar este documento."
                  >
                    Aguardando aprovação do Gestor da área
                  </span>
                )
            )
          }

          {
            // Vigente: reabrir manda direto para o Gestor avaliar de
            // novo — não volta para Elaboração.
            estagio === 'vigente' && (
              <button
                type="button"
                disabled={processando}
                style={botaoAcao}
                onClick={() =>
                  executar(() => onEnviarAprovacao(revisao))
                }
              >
                Enviar para revisão
              </button>
            )
          }

          {
            // "Revisão" não existe mais como etapa do fluxo atual —
            // isto é só compatibilidade com alguma revisão antiga que
            // ainda esteja com esse status.
            estagio === 'revisao' && (
              <button
                type="button"
                disabled={processando}
                style={botaoAcao}
                onClick={() =>
                  executar(() => onDevolverElaboracao(revisao))
                }
              >
                Ir para elaboração
              </button>
            )
          }
        </div>

        {
          estagio === 'vigente' && (
            <span
              style={{
                display: 'inline-block',
                marginTop: '8px',
                padding: '7px 10px',
                borderRadius: '999px',
                background: '#E7F6EC',
                color: '#107C10',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              Vigente
            </span>
          )
        }

        {
          mensagemReprovado &&
          (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#FDE7E9',
                color: '#A4262C',
                fontSize: '12px',
                lineHeight: 1.5
              }}
            >
              {mensagemReprovado}
            </div>
          )
        }

        {
          mostrarReprovar &&
          (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'rgba(15,23,42,.55)'
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '420px',
                  padding: '22px',
                  background: '#FFFFFF',
                  borderRadius: '14px'
                }}
              >
                <strong style={{ display: 'block', marginBottom: '6px', color: '#0B2D4D' }}>
                  Reprovar esta revisão
                </strong>

                <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '13px', lineHeight: 1.5 }}>
                  Explique o que precisa ser ajustado. O elaborador verá este motivo.
                </p>

                <textarea
                  rows={4}
                  value={motivoReprovacao}
                  onChange={event => setMotivoReprovacao(event.target.value)}
                  placeholder="Ex.: faltou detalhar o passo 3, corrigir o responsável..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarReprovar(false)}
                    style={{
                      padding: '9px 14px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      color: '#1F2937',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={!motivoReprovacao.trim() || processando}
                    onClick={() => {

                      const motivo =
                        motivoReprovacao.trim();

                      setMostrarReprovar(false);

                      executar(async () => {

                        await onDevolverElaboracao(revisao);

                        setMensagemReprovado(
                          `Reprovado: ${motivo}`
                        );
                      });
                    }}
                    style={{
                      padding: '9px 14px',
                      border: 0,
                      borderRadius: '8px',
                      background: motivoReprovacao.trim() ? '#B42318' : '#E8A6A0',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: motivoReprovacao.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Confirmar reprovação
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </>
    );
  };

const DocumentoDetalhePage:
  React.FC<IDocumentoDetalhePageProps> = ({

    documento,
    revisoes,
    carregando,
    erro,
    contexto,
    usuariosAreas,
    processando,
    onEnviarRevisao,
    onEnviarAprovacao,
    onDevolverElaboracao,
    processandoPublicacao,
    erroPublicacao,
    resultadoPublicacao,
    onPublicarRevisao,
    onLimparResultadoPublicacao,
    onVoltar

  }) => {

    const [
      revisaoParaPublicar,
      setRevisaoParaPublicar
    ] =
      React.useState<
        IDocumentoRevisao | undefined
      >(undefined);

    // Gestores ativos da área deste documento — são os únicos que
    // podem aprovar e publicar, além de um Administrador.
    const gestoresDaArea =
      React.useMemo(
        () => {

          if (
            !documento?.areaId
          ) {
            return [];
          }

          return usuariosAreas.filter(
            vinculo =>
              vinculo.areaId === documento.areaId &&
              vinculo.perfil === 'Gestor' &&
              vinculo.ativo
          );
        },
        [
          documento,
          usuariosAreas
        ]
      );

    const podeAprovar =
      React.useMemo(
        () => {

          if (
            contexto?.perfil === 'Administrador'
          ) {
            return true;
          }

          const email =
            (contexto?.email || '')
              .trim()
              .toLowerCase();

          if (
            !email
          ) {
            return false;
          }

          return gestoresDaArea.some(
            vinculo =>
              vinculo.usuarioEmail
                .trim()
                .toLowerCase() === email
          );
        },
        [
          contexto,
          gestoresDaArea
        ]
      );

    if (!documento) {

      return (
        <section>

          <PageHeader
            titulo="Documento"
            subtitulo="Documento não localizado."
            acao={
              <button
                type="button"
                onClick={onVoltar}
              >
                Voltar
              </button>
            }
          />

        </section>
      );
    }

    return (
      <section>

        <PageHeader
          titulo={
            `${documento.codigo} - ${documento.titulo}`
          }
          subtitulo={
            documento.descricao ||
            'Detalhes e histórico de revisões.'
          }
          acao={
            <button
              type="button"
              onClick={onVoltar}
            >
              Voltar
            </button>
          }
        />

        {/* RESUMO */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '24px'
          }}
        >

          <Card
            titulo="Tipo"
            valor={
              documento.tipo
            }
          />

          <Card
            titulo="Revisão atual"
            valor={
              documento.revisaoAtual
            }
          />

          <Card
            titulo="Status"
            valor={
              documento.status
            }
          />

          <Card
            titulo="Responsável"
            valor={
              documento.responsavel ||
              '-'
            }
          />

        </div>

        {
          // Diagnóstico: explica por que o botão de aprovar aparece
          // (ou não) para quem está vendo esta tela agora.
          contexto &&
          (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontSize: '12px',
                color: '#64748B',
                lineHeight: 1.6
              }}
            >
              Você está logado como{' '}
              <strong>
                {contexto.email || 'usuário não identificado'}
              </strong>
              {
                contexto.perfil === 'Administrador'
                  ? ' — perfil Administrador, pode aprovar qualquer documento.'
                  : !documento.areaId
                    ? ' — este documento não tem área definida, então não é possível saber quem aprova.'
                    : gestoresDaArea.length === 0
                      ? (
                        <>
                          {' '}— esta área não tem nenhum Gestor cadastrado em{' '}
                          <strong>Gestão → Áreas e acessos</strong>, então ninguém
                          consegue aprovar este documento ainda.
                        </>
                      )
                      : (
                        <>
                          {' '}— Gestor(es) desta área:{' '}
                          <strong>
                            {
                              gestoresDaArea
                                .map(g => `${g.usuarioNome} (${g.usuarioEmail})`)
                                .join(', ')
                            }
                          </strong>.
                          {
                            podeAprovar
                              ? ' Você é um deles: os botões de aprovação aparecem na revisão abaixo.'
                              : ' Seu e-mail não bate com nenhum deles, por isso os botões de aprovação não aparecem.'
                          }
                        </>
                      )
              }
            </div>
          )
        }

        {erro && (
          <div
            style={{
              padding: '14px',
              marginBottom:
                '18px',
              background:
                '#fde7e9',
              color:
                '#a4262c',
              borderRadius:
                '10px'
            }}
          >
            {erro}
          </div>
        )}

        {carregando ? (

          <div
            style={{
              padding:
                '30px',
              textAlign:
                'center'
            }}
          >
            Carregando revisões...
          </div>

        ) : revisoes.length === 0 ? (

          <EmptyState
            titulo="Nenhuma revisão localizada"
            descricao="O histórico de revisões deste documento será exibido aqui."
          />

        ) : (

          <div>

            <h2
              style={{
                marginBottom:
                  '16px',
                color:
                  '#0b1f3a'
              }}
            >
              Histórico de revisões
            </h2>

            <div
              style={{
                display:
                  'grid',
                gap:
                  '14px'
              }}
            >

              {revisoes.map(
                revisao => (

                  <article
                    key={
                      revisao.id
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
                          '20px',
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
                              '#1f2937'
                          }}
                        >
                          Revisão {
                            revisao.revisao
                          }
                        </h3>

                        <span
                          style={{
                            display:
                              'block',
                            marginTop:
                              '5px',
                            color:
                              '#64748b',
                            fontSize:
                              '13px'
                          }}
                        >
                          Revisada em {
                            formatarData(
                              revisao.dataRevisao
                            )
                          }
                        </span>

                      </div>

                      <span
                        style={{
                          padding:
                            '6px 10px',
                          borderRadius:
                            '20px',
                          background:
                            '#e8f2ff',
                          color:
                            '#0f6cbd',
                          fontWeight:
                            700,
                          fontSize:
                            '12px',
                          height:
                            'fit-content'
                        }}
                      >
                        {
                          revisao.status ||
                          'Elaboração'
                        }
                      </span>

                    </div>

                    <div
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(180px, 1fr))',
                        gap:
                          '12px',
                        marginTop:
                          '18px'
                      }}
                    >

                      <Informacao
                        titulo="Vigência"
                        valor={
                          formatarData(
                            revisao.dataVigencia
                          )
                        }
                      />

                      <Informacao
                        titulo="Responsável"
                        valor={
                          revisao.responsavel ||
                          '-'
                        }
                      />

                      <Informacao
                        titulo="Aprovado por"
                        valor={
                          revisao.aprovadoPor ||
                          '-'
                        }
                      />

                      <Informacao
                        titulo="Retreinamento"
                        valor={
                          revisao.requerRetreinamento
                            ? 'Obrigatório'
                            : 'Não requerido'
                        }
                      />

                    </div>

                    {revisao.motivoAlteracao && (
                      <BlocoTexto
                        titulo="Motivo da alteração"
                        texto={
                          revisao.motivoAlteracao
                        }
                      />
                    )}

                    {revisao.descricaoAlteracoes && (
                      <BlocoTexto
                        titulo="Alterações realizadas"
                        texto={
                          revisao.descricaoAlteracoes
                        }
                      />
                    )}

                    {revisao.justificativa && (
                      <BlocoTexto
                        titulo="Justificativa"
                        texto={
                          revisao.justificativa
                        }
                      />
                    )}

                    {revisao.requerRetreinamento && (
                      <div
                        style={{
                          marginTop:
                            '16px',
                          padding:
                            '12px 14px',
                          background:
                            '#fff4ce',
                          color:
                            '#8a6d00',
                          borderRadius:
                            '9px',
                          fontWeight:
                            600
                        }}
                      >
                        Esta revisão exige retreinamento dos usuários impactados.
                      </div>
                    )}

                    {revisao.arquivoUrl && (
                      <div
                        style={{
                          marginTop:
                            '18px'
                        }}
                      >
                        <a
                          href={
                            revisao.arquivoUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display:
                              'inline-block',
                            padding:
                              '9px 14px',
                            background:
                              '#1677ff',
                            color:
                              '#ffffff',
                            borderRadius:
                              '8px',
                            textDecoration:
                              'none',
                            fontWeight:
                              600
                          }}
                        >
                          Abrir documento
                        </a>
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: '18px',
                        paddingTop: '16px',
                        borderTop: '1px solid #E2E8F0'
                      }}
                    >
                      <AcoesFluxoRevisao
                        revisao={revisao}
                        processando={processando}
                        podeAprovar={podeAprovar}
                        onEnviarRevisao={onEnviarRevisao}
                        onEnviarAprovacao={onEnviarAprovacao}
                        onDevolverElaboracao={onDevolverElaboracao}
                        onAbrirPublicar={() =>
                          setRevisaoParaPublicar(revisao)
                        }
                      />
                    </div>

                  </article>
                )
              )}

            </div>

          </div>
        )}

        <PublicarRevisaoModal
          aberto={
            !!revisaoParaPublicar
          }
          documentoRevisaoId={
            revisaoParaPublicar?.id ||
            ''
          }
          revisao={
            revisaoParaPublicar?.revisao ||
            ''
          }
          ehPrimeiraRevisao={
            revisoes.length <= 1
          }
          requerRetreinamento={
            revisaoParaPublicar?.requerRetreinamento ||
            false
          }
          processando={
            processandoPublicacao
          }
          onCancelar={() =>
            setRevisaoParaPublicar(undefined)
          }
          onPublicar={
            async dados => {

              const resultado =
                await onPublicarRevisao(dados);

              setRevisaoParaPublicar(
                undefined
              );

              return resultado;
            }
          }
        />

        {
          erroPublicacao &&
          !revisaoParaPublicar &&
          (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#FDE7E9',
                color: '#A4262C'
              }}
            >
              {erroPublicacao}
            </div>
          )
        }

        {
          resultadoPublicacao &&
          (
            <div
              style={{
                marginTop: '16px'
              }}
            >
              <ResultadoPublicacaoRevisaoCard
                resultado={
                  resultadoPublicacao
                }
                onFechar={
                  onLimparResultadoPublicacao
                }
              />
            </div>
          )
        }

      </section>
    );
  };

export default DocumentoDetalhePage;