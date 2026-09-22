import * as React from 'react';

import {
  IModuloTreinamento
} from '../../models/Modulo';

import {
  IConteudoModuloExecucao,
  IPerguntaRapidaExecucao
} from '../../hooks/useModuloExecucao';

export interface IModuloExecucaoPageProps {

  modulo:
    IModuloTreinamento;

  conteudos:
    IConteudoModuloExecucao[];

  carregando:
    boolean;

  erro:
    string;

  podeConcluir:
    boolean;

  processando:
    boolean;

  onVoltar:
    () => void;

  onResponderPergunta:
    (
      pergunta:
        IPerguntaRapidaExecucao,
      alternativaIds:
        string[]
    ) => Promise<boolean>;

  onConcluir:
    () => Promise<void>;
}

interface ISelecaoPergunta {
  perguntaId:
    string;

  alternativaIds:
    string[];

  respondida:
    boolean;

  correta:
    boolean;
}


interface IVideoModal {
  titulo: string;
  urlOriginal: string;
  embedUrl: string;
  thumbnailUrl: string;
  tipo: 'youtube' | 'vimeo' | 'arquivo' | 'link';
}

const obterYoutubeId = (url: string): string => {
  const valor = (url || '').trim();
  const expressoes = [
    /youtu\.be\/([^?&#/]+)/i,
    /youtube\.com\/watch\?v=([^?&#/]+)/i,
    /youtube\.com\/embed\/([^?&#/]+)/i,
    /youtube\.com\/shorts\/([^?&#/]+)/i
  ];

  for (let i = 0; i < expressoes.length; i += 1) {
    const resultado = valor.match(expressoes[i]);
    if (resultado && resultado[1]) {
      return resultado[1];
    }
  }

  return '';
};

const obterVideoModal = (titulo: string, url: string): IVideoModal => {
  const valor = (url || '').trim();
  const youtubeId = obterYoutubeId(valor);

  if (youtubeId) {
    return {
      titulo,
      urlOriginal: valor,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      tipo: 'youtube'
    };
  }

  const vimeo = valor.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeo && vimeo[1]) {
    return {
      titulo,
      urlOriginal: valor,
      embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`,
      thumbnailUrl: '',
      tipo: 'vimeo'
    };
  }

  const minusculo = valor.toLowerCase();
  if (minusculo.indexOf('.mp4') >= 0 || minusculo.indexOf('.webm') >= 0 || minusculo.indexOf('.ogg') >= 0) {
    return { titulo, urlOriginal: valor, embedUrl: valor, thumbnailUrl: '', tipo: 'arquivo' };
  }

  return { titulo, urlOriginal: valor, embedUrl: valor, thumbnailUrl: '', tipo: 'link' };
};

const card:
  React.CSSProperties = {
  padding:
    '20px',

  border:
    '1px solid #D8E2EC',

  borderRadius:
    '14px',

  background:
    '#FFFFFF'
};

const botao:
  React.CSSProperties = {
  padding:
    '10px 14px',

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
    'pointer'
};

const botaoPrimario:
  React.CSSProperties = {
  ...botao,

  border:
    '1px solid #0B5CAB',

  background:
    '#0B5CAB',

  color:
    '#FFFFFF'
};

const ModuloExecucaoPage:
  React.FC<
    IModuloExecucaoPageProps
  > = (
    props
  ) => {

    const [
      selecoes,
      setSelecoes
    ] =
      React.useState<
        ISelecaoPergunta[]
      >([]);

    const [
      respondendoId,
      setRespondendoId
    ] =
      React.useState('');

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const [
      videoModal,
      setVideoModal
    ] =
      React.useState<
        IVideoModal | undefined
      >(undefined);

    const obterSelecao =
      (
        perguntaId:
          string
      ): ISelecaoPergunta => {

        const encontrada:
          ISelecaoPergunta | undefined =
          selecoes.find(
            item =>
              item.perguntaId ===
              perguntaId
          );

        if (
          encontrada
        ) {
          return encontrada;
        }

        const vazia:
          ISelecaoPergunta = {
          perguntaId,
          alternativaIds:
            [],
          respondida:
            false,
          correta:
            false
        };

        return vazia;
      };

    const alternarAlternativa =
      (
        pergunta:
          IPerguntaRapidaExecucao,
        alternativaId:
          string
      ): void => {

        const multipla =
          pergunta.tipo ===
          100000001;

        setSelecoes(
          lista => {

            const encontrada:
              ISelecaoPergunta | undefined =
              lista.find(
                item =>
                  item.perguntaId ===
                  pergunta.id
              );

            const atual:
              ISelecaoPergunta =
              encontrada || {
                perguntaId:
                  pergunta.id,
                alternativaIds:
                  [],
                respondida:
                  false,
                correta:
                  false
              };

            let alternativaIds:
              string[];

            if (
              multipla
            ) {

              alternativaIds =
                atual.alternativaIds
                  .indexOf(
                    alternativaId
                  ) >=
                  0
                  ? atual
                    .alternativaIds
                    .filter(
                      id =>
                        id !==
                        alternativaId
                    )
                  : [
                    ...atual
                      .alternativaIds,
                    alternativaId
                  ];

            } else {

              alternativaIds = [
                alternativaId
              ];
            }

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
                alternativaIds,
                respondida:
                  false,
                correta:
                  false
              }
            ];
          }
        );
      };

    const responder =
      async (
        pergunta:
          IPerguntaRapidaExecucao
      ): Promise<void> => {

        const atual:
          ISelecaoPergunta =
          obterSelecao(
            pergunta.id
          );

        if (
          atual.alternativaIds
            .length ===
          0
        ) {

          setErroLocal(
            'Selecione uma resposta antes de confirmar.'
          );

          return;
        }

        setErroLocal('');
        setRespondendoId(
          pergunta.id
        );

        try {

          const correta =
            await props
              .onResponderPergunta(
                pergunta,
                atual.alternativaIds
              );

          setSelecoes(
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
                  ...atual,
                  respondida:
                    true,
                  correta
                }
              ];
            }
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Não foi possível registrar a resposta.'
          );

        } finally {

          setRespondendoId(
            ''
          );
        }
      };

    const abrirVideo =
      (
        item:
          IConteudoModuloExecucao
      ): void => {

        setVideoModal(
          obterVideoModal(
            item.titulo ||
            'Vídeo',
            item.url
          )
        );
      };

    const fecharVideo =
      (): void => {
        setVideoModal(
          undefined
        );
      };

    const renderConteudo =
      (
        item:
          IConteudoModuloExecucao
      ): React.ReactNode => {

        switch (
          item.tipo
        ) {

          case 'Texto':

            return (
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    item.conteudo
                }}
                style={{
                  color:
                    '#334155',

                  lineHeight:
                    1.7,

                  fontSize:
                    '15px'
                }}
              />
            );

          case 'Cards': {

            let cardsDoConteudo =
              item.cards ||
              [];

            if (
              cardsDoConteudo.length ===
                0 &&
              item.conteudo &&
              item.conteudo.indexOf(
                '__DGT_CARDS__:'
              ) ===
                0
            ) {

              try {

                const parseados =
                  JSON.parse(
                    item.conteudo.substring(
                      '__DGT_CARDS__:'.length
                    )
                  ) as {
                    numero: string;
                    titulo: string;
                    descricao: string;
                  }[];

                if (
                  Array.isArray(
                    parseados
                  )
                ) {
                  cardsDoConteudo =
                    parseados;
                }

              } catch {

                cardsDoConteudo =
                  [];
              }
            }

            const cards =
              cardsDoConteudo
                .slice(
                  0,
                  3
                );
            const quantidade =
              Math.max(
                1,
                cards.length
              );

            return (
              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    `repeat(${quantidade}, minmax(0, 1fr))`,

                  gap:
                    '22px'
                }}
              >
                {
                  cards.map(
                    (
                      cardItem,
                      indice
                    ) => (
                      <div
                        key={
                          indice
                        }
                        style={{
                          minHeight:
                            '210px',

                          padding:
                            '20px',

                          border:
                            '1px solid #E2E8F0',

                          background:
                            '#FFFFFF',

                          boxShadow:
                            '0 3px 12px rgba(15,23,42,.08)'
                        }}
                      >
                        <div
                          style={{
                            marginBottom:
                              '14px',

                            color:
                              '#7C8594',

                            fontSize:
                              '14px',

                            letterSpacing:
                              '0.08em'
                          }}
                        >
                          {
                            cardItem.numero ||
                            (
                              '00' +
                              String(
                                indice + 1
                              )
                            ).slice(
                              -2
                            )
                          }
                        </div>

                        <h3
                          style={{
                            margin:
                              '0 0 24px',

                            color:
                              '#20283F',

                            fontSize:
                              '20px',

                            lineHeight:
                              1.2,

                            textTransform:
                              'uppercase'
                          }}
                        >
                          {
                            cardItem.titulo
                          }
                        </h3>

                        <div
                          style={{
                            color:
                              '#273248',

                            fontSize:
                              '15px',

                            lineHeight:
                              1.5
                          }}
                        >
                          {
                            cardItem.descricao
                          }
                        </div>
                      </div>
                    )
                  )
                }
              </div>
            );
          }
          case 'Destaque':

            return (
              <div
                style={{
                  padding:
                    '16px',

                  borderLeft:
                    '4px solid #F59E0B',

                  background:
                    '#FFF8E1',

                  borderRadius:
                    '8px',

                  color:
                    '#5C4300',

                  lineHeight:
                    1.6
                }}
              >
                {
                  item.conteudo
                }
              </div>
            );

          case 'Imagem':

            return (
              <img
                src={
                  item.url
                }
                alt={
                  item.titulo ||
                  'Imagem do módulo'
                }
                style={{
                  maxWidth:
                    '100%',

                  borderRadius:
                    '12px',

                  display:
                    'block'
                }}
              />
            );

          case 'Vídeo': {

            const video =
              obterVideoModal(
                item.titulo ||
                'Vídeo',
                item.url
              );

            return (
              <div
                style={{
                  maxWidth:
                    '760px'
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    abrirVideo(
                      item
                    )
                  }
                  style={{
                    width:
                      '100%',
                    padding:
                      0,
                    border:
                      '1px solid #D8E2EC',
                    borderRadius:
                      '12px',
                    overflow:
                      'hidden',
                    background:
                      '#0B2D4D',
                    cursor:
                      'pointer',
                    textAlign:
                      'left'
                  }}
                >
                  <div
                    style={{
                      position:
                        'relative',
                      paddingTop:
                        '56.25%',
                      background:
                        video.thumbnailUrl
                          ? '#0B2D4D'
                          : 'linear-gradient(135deg, #0B2D4D, #1769AA)'
                    }}
                  >
                    {
                      video.thumbnailUrl &&
                      (
                        <img
                          src={
                            video.thumbnailUrl
                          }
                          alt=""
                          style={{
                            position:
                              'absolute',
                            inset:
                              0,
                            width:
                              '100%',
                            height:
                              '100%',
                            objectFit:
                              'cover'
                          }}
                        />
                      )
                    }

                    <span
                      style={{
                        position:
                          'absolute',
                        left:
                          '50%',
                        top:
                          '50%',
                        transform:
                          'translate(-50%, -50%)',
                        width:
                          '66px',
                        height:
                          '66px',
                        borderRadius:
                          '50%',
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        background:
                          'rgba(255,255,255,.95)',
                        color:
                          '#0B5CAB',
                        fontSize:
                          '27px',
                        boxShadow:
                          '0 6px 20px rgba(0,0,0,.25)'
                      }}
                    >
                      ▶
                    </span>
                  </div>
                </button>

                <div
                  style={{
                    marginTop:
                      '8px',
                    color:
                      '#64748B',
                    fontSize:
                      '12px'
                  }}
                >
                  Clique na pré-visualização para assistir sem sair do módulo.
                </div>
              </div>
            );
          }

          case 'Material':

            return (
              <a
                href={
                  item.url
                }
                target="_blank"
                rel="noreferrer"
                style={{
                  ...botao,

                  display:
                    'inline-block',

                  textDecoration:
                    'none'
                }}
              >
                ▤ Abrir material
              </a>
            );

          case 'Link':

            return (
              <a
                href={
                  item.url
                }
                target="_blank"
                rel="noreferrer"
                style={{
                  ...botao,

                  display:
                    'inline-block',

                  textDecoration:
                    'none'
                }}
              >
                ↗ Abrir link
              </a>
            );

          case 'Pergunta rápida': {

            if (
              !item.pergunta
            ) {

              return (
                <div
                  style={{
                    color:
                      '#64748B'
                  }}
                >
                  Pergunta rápida sem configuração.
                </div>
              );
            }

            const pergunta =
              item.pergunta;

            const atual =
              obterSelecao(
                pergunta.id
              );

            const multipla =
              pergunta.tipo ===
              100000001;

            return (
              <div
                style={{
                  padding:
                    '18px',

                  border:
                    '1px solid #B9D7F0',

                  borderRadius:
                    '12px',

                  background:
                    '#F7FBFF'
                }}
              >

                <div
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      700,

                    color:
                      '#0B5CAB',

                    marginBottom:
                      '6px'
                  }}
                >
                  TESTE SEU CONHECIMENTO
                </div>

                <h3
                  style={{
                    margin:
                      '0 0 14px',

                    color:
                      '#0B2D4D'
                  }}
                >
                  {
                    pergunta.enunciado
                  }
                </h3>

                <div
                  style={{
                    display:
                      'grid',

                    gap:
                      '9px'
                  }}
                >
                  {
                    pergunta.alternativas
                      .map(
                        (
                          alternativa:
                            IPerguntaRapidaExecucao['alternativas'][number]
                        ) => {

                          const selecionada =
                            atual
                              .alternativaIds
                              .indexOf(
                                alternativa.id
                              ) >=
                            0;

                          return (
                            <label
                              key={
                                alternativa.id
                              }
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '10px',

                                alignItems:
                                  'center',

                                padding:
                                  '12px',

                                border:
                                  selecionada
                                    ? '1px solid #1677FF'
                                    : '1px solid #D8E2EC',

                                borderRadius:
                                  '8px',

                                background:
                                  selecionada
                                    ? '#EEF6FF'
                                    : '#FFFFFF',

                                cursor:
                                  'pointer'
                              }}
                            >
                              <input
                                type={
                                  multipla
                                    ? 'checkbox'
                                    : 'radio'
                                }
                                checked={
                                  selecionada
                                }
                                onChange={() =>
                                  alternarAlternativa(
                                    pergunta,
                                    alternativa.id
                                  )
                                }
                              />

                              <span
                                style={{
                                  color:
                                    '#334155'
                                }}
                              >
                                {
                                  alternativa.texto
                                }
                              </span>
                            </label>
                          );
                        }
                      )
                  }
                </div>

                <div
                  style={{
                    marginTop:
                      '12px',

                    display:
                      'flex',

                    alignItems:
                      'center',

                    gap:
                      '12px',

                    flexWrap:
                      'wrap'
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      respondendoId ===
                      pergunta.id
                    }
                    onClick={() => {

                      void responder(
                        pergunta
                      );

                    }}
                    style={
                      botaoPrimario
                    }
                  >
                    {
                      respondendoId ===
                        pergunta.id
                        ? 'Verificando...'
                        : 'Confirmar resposta'
                    }
                  </button>

                  {
                    atual.respondida &&
                    pergunta
                      .mostrarFeedback &&
                    (
                      <span
                        style={{
                          color:
                            atual.correta
                              ? '#13795B'
                              : '#B42318',

                          fontWeight:
                            700
                        }}
                      >
                        {
                          atual.correta
                            ? pergunta
                              .feedbackAcerto
                            : pergunta
                              .feedbackErro
                        }
                      </span>
                    )
                  }
                </div>

              </div>
            );
          }

          default:

            return (
              <div>
                {
                  item.conteudo
                }
              </div>
            );
        }
      };

    return (
      <section>

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
              botao
            }
          >
            ← Voltar ao treinamento
          </button>

          <div
            style={{
              color:
                '#64748B',

              fontSize:
                '13px'
            }}
          >
            Módulo {
              props.modulo.ordem
            }
          </div>
        </div>

        <article
          style={{
            border:
              '1px solid #D8E2EC',
            borderRadius:
              '14px',
            background:
              '#FFFFFF',
            overflow:
              'hidden'
          }}
        >
          <header
            style={{
              padding:
                '22px 24px',
              borderBottom:
                '1px solid #E8EEF4'
            }}
          >
          <h1
            style={{
              margin:
                '0 0 8px',

              color:
                '#0B2D4D'
            }}
          >
            {
              props.modulo.titulo
            }
          </h1>

          {
            props.modulo.descricao &&
            (
              <p
                style={{
                  margin:
                    0,

                  color:
                    '#475569',

                  lineHeight:
                    1.6
                }}
              >
                {
                  props.modulo.descricao
                }
              </p>
            )
          }
          </header>

        {
          props.erro &&
          (
            <div
              style={{
                ...card,

                marginBottom:
                  '16px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C'
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
                ...card,

                marginBottom:
                  '16px',

                background:
                  '#FFF4CE',

                color:
                  '#6A4B00'
              }}
            >
              {
                erroLocal
              }
            </div>
          )
        }

        {
          props.carregando
            ? (
              <div
                style={{
                  padding:
                    '28px 24px',
                  color:
                    '#64748B'
                }}
              >
                Carregando conteúdo do módulo...
              </div>
            )
            : props.conteudos.length ===
                0
              ? (
                <div
                  style={{
                    padding:
                      '28px 24px',
                    color:
                      '#64748B'
                  }}
                >
                  Nenhum conteúdo foi cadastrado para este módulo.
                </div>
              )
              : (
                <div
                  style={{
                    padding:
                      '0 24px'
                  }}
                >
                  {
                    props.conteudos.map(
                      (
                        item,
                        indice
                      ) => (
                        <section
                          key={
                            item.id
                          }
                          style={{
                            padding:
                              '22px 0',
                            borderBottom:
                              indice <
                                props.conteudos.length - 1
                                ? '1px solid #E8EEF4'
                                : 'none'
                          }}
                        >
                          {
                            item.titulo &&
                            (
                              <h2
                                style={{
                                  margin:
                                    '0 0 14px',

                                  color:
                                    '#0B2D4D',

                                  fontSize:
                                    '18px'
                                }}
                              >
                                {
                                  indice +
                                  1
                                }. {
                                  item.titulo
                                }
                              </h2>
                            )
                          }

                          {
                            renderConteudo(
                              item
                            )
                          }
                        </section>
                      )
                    )
                  }
                </div>
              )
        }

        <footer
          style={{
            padding:
              '18px 24px',
            borderTop:
              '1px solid #E8EEF4',
            background:
              '#F8FAFC',
            display:
              'flex',
            justifyContent:
              'flex-end'
          }}
        >
          <button
            type="button"
            disabled={
              !props.podeConcluir ||
              props.processando ||
              props.carregando
            }
            onClick={() => {

              props
                .onConcluir()
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
              ...botaoPrimario,

              background:
                props.podeConcluir
                  ? '#13795B'
                  : '#CBD5E1',

              borderColor:
                props.podeConcluir
                  ? '#13795B'
                  : '#CBD5E1',

              cursor:
                props.podeConcluir
                  ? 'pointer'
                  : 'not-allowed'
            }}
          >
            {
              props.processando
                ? 'Concluindo...'
                : props.podeConcluir
                  ? 'Concluir módulo ✓'
                  : 'Responda as perguntas obrigatórias'
            }
          </button>
        </footer>

        </article>

        {
          videoModal &&
          (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position:
                  'fixed',
                inset:
                  0,
                zIndex:
                  99999,
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                padding:
                  '24px',
                background:
                  'rgba(6,20,35,.78)'
              }}
              onMouseDown={
                evento => {
                  if (evento.target === evento.currentTarget) {
                    fecharVideo();
                  }
                }
              }
            >
              <div
                style={{
                  width:
                    'min(1000px, 96vw)',
                  borderRadius:
                    '14px',
                  overflow:
                    'hidden',
                  background:
                    '#FFFFFF',
                  boxShadow:
                    '0 18px 60px rgba(0,0,0,.35)'
                }}
              >
                <div
                  style={{
                    padding:
                      '13px 16px',
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap:
                      '12px'
                  }}
                >
                  <strong
                    style={{
                      color:
                        '#0B2D4D'
                    }}
                  >
                    {
                      videoModal.titulo
                    }
                  </strong>

                  <button
                    type="button"
                    onClick={
                      fecharVideo
                    }
                    style={{
                      width:
                        '38px',
                      height:
                        '38px',
                      border:
                        '1px solid #D8E2EC',
                      borderRadius:
                        '8px',
                      background:
                        '#FFFFFF',
                      cursor:
                        'pointer',
                      fontSize:
                        '18px'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    background:
                      '#000000'
                  }}
                >
                  {
                    videoModal.tipo === 'arquivo'
                      ? (
                        <video
                          src={
                            videoModal.embedUrl
                          }
                          controls
                          autoPlay
                          style={{
                            width:
                              '100%',
                            display:
                              'block'
                          }}
                        />
                      )
                      : videoModal.tipo === 'youtube' ||
                        videoModal.tipo === 'vimeo'
                        ? (
                          <div
                            style={{
                              position:
                                'relative',
                              paddingTop:
                                '56.25%'
                            }}
                          >
                            <iframe
                              src={
                                videoModal.embedUrl
                              }
                              title={
                                videoModal.titulo
                              }
                              allow="autoplay; encrypted-media; picture-in-picture"
                              allowFullScreen
                              style={{
                                position:
                                  'absolute',
                                inset:
                                  0,
                                width:
                                  '100%',
                                height:
                                  '100%',
                                border:
                                  0
                              }}
                            />
                          </div>
                        )
                        : (
                          <div
                            style={{
                              padding:
                                '28px',
                              background:
                                '#FFFFFF',
                              textAlign:
                                'center'
                            }}
                          >
                            <a
                              href={
                                videoModal.urlOriginal
                              }
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                ...botaoPrimario,
                                display:
                                  'inline-block',
                                textDecoration:
                                  'none'
                              }}
                            >
                              Abrir vídeo em nova janela
                            </a>
                          </div>
                        )
                  }
                </div>
              </div>
            </div>
          )
        }

      </section>
    );
  };

export default ModuloExecucaoPage;


