import * as React from 'react';

import {
  IEditarModuloConteudo,
  IModuloConteudoAdmin,
  IModuloCardItem,
  INovoModuloConteudo,
  TipoConteudoModulo
} from '../../services/ModuloConteudoAdminService';

export interface IModuloConteudosEditorProps {

  // Modo em que o editor deve abrir: 'preview' (somente visualização,
  // como o colaborador verá) ou 'edicao' (lista administrativa, com
  // botões de adicionar/editar/mover). Padrão: 'edicao'.
  modoInicial?:
    'edicao' | 'preview';

  moduloId:
    string;

  moduloTitulo:
    string;

  conteudos:
    IModuloConteudoAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  onFechar:
    () => void;

  onCriar:
    (
      dados:
        INovoModuloConteudo
    ) => Promise<void>;

  onEditar:
    (
      dados:
        IEditarModuloConteudo
    ) => Promise<void>;

  onDefinirAtivo:
    (
      id:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  onMoverAcima:
    (
      item:
        IModuloConteudoAdmin
    ) => Promise<void>;

  onMoverAbaixo:
    (
      item:
        IModuloConteudoAdmin
    ) => Promise<void>;
}

const tipos:
  {
    tipo:
      TipoConteudoModulo;

    icon:
      string;

    descricao:
      string;
  }[] = [
    {
      tipo:
        'Texto',

      icon:
        '¶',

      descricao:
        'Texto para leitura do treinamento.'
    },
    {
      tipo:
        'Vídeo',

      icon:
        '▶',

      descricao:
        'Link para vídeo, Stream, SharePoint ou YouTube.'
    },
    {
      tipo:
        'Material',

      icon:
        '▤',

      descricao:
        'PDF, procedimento, apostila ou material no SharePoint.'
    },
    {
      tipo:
        'Link',

      icon:
        '↗',

      descricao:
        'Link para sistema, página ou conteúdo externo.'
    },
    {
      tipo:
        'Imagem',

      icon:
        '▧',

      descricao:
        'Imagem ou ilustração de apoio.'
    },
    {
      tipo:
        'Cards',

      icon:
        '▦',

      descricao:
        'De 1 a 3 cards distribuídos horizontalmente.'
    },    {
      tipo:
        'Destaque',

      icon:
        '!',

      descricao:
        'Aviso, observação ou ponto importante.'
    }
  ];

const inputStyle:
  React.CSSProperties = {
  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '10px 12px',

  border:
    '1px solid #D8E2EC',

  borderRadius:
    '8px',

  fontSize:
    '14px',

  color:
    '#18324A',

  background:
    '#FFFFFF'
};

const primary:
  React.CSSProperties = {
  padding:
    '10px 15px',

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
    'pointer'
};

const secondary:
  React.CSSProperties = {
  padding:
    '9px 13px',

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

const danger:
  React.CSSProperties = {
  ...secondary,

  border:
    '1px solid #B42318',

  color:
    '#B42318'
};

const ModuloConteudosEditor:
  React.FC<
    IModuloConteudosEditorProps
  > = (
    props
  ) => {

    const [
      formulario,
      setFormulario
    ] =
      React.useState(
        false
      );

    const [
      editando,
      setEditando
    ] =
      React.useState<
        IModuloConteudoAdmin | undefined
      >(
        undefined
      );

    const [
      tipo,
      setTipo
    ] =
      React.useState<
        TipoConteudoModulo
      >(
        'Texto'
      );

    const [
      titulo,
      setTitulo
    ] =
      React.useState('');

    const [
      conteudo,
      setConteudo
    ] =
      React.useState('');

    const [
      url,
      setUrl
    ] =
      React.useState('');


    const [
      cards,
      setCards
    ] =
      React.useState<
        IModuloCardItem[]
      >([
        {
          numero:
            '01',

          titulo:
            '',

          descricao:
            ''
        }
      ]);
    const [
      ordem,
      setOrdem
    ] =
      React.useState('1');

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
      revisandoConteudo,
      setRevisandoConteudo
    ] =
      React.useState(false);

    const [
      modoPreview,
      setModoPreview
    ] =
      React.useState(
        props.modoInicial ===
          'preview'
      );

    const precisaTexto =
      tipo ===
        'Texto' ||
      tipo ===
        'Destaque';

    const precisaUrl =
      tipo ===
        'Vídeo' ||
      tipo ===
        'Material' ||
      tipo ===
        'Link' ||
      tipo ===
        'Imagem';

    const abrirNovo =
      (
        novoTipo:
          TipoConteudoModulo
      ): void => {

        setEditando(
          undefined
        );

        setTipo(
          novoTipo
        );

        setTitulo('');
        setConteudo('');
        setUrl('');
        setCards([
          {
            numero:
              '01',

            titulo:
              '',

            descricao:
              ''
          }
        ]);

        setOrdem(
          String(
            props.conteudos.length +
            1
          )
        );

        setObrigatorio(
          true
        );

        setAtivo(
          true
        );

        setErroLocal('');
        setRevisandoConteudo(false);

        setFormulario(
          true
        );
      };

    const abrirEditar =
      (
        item:
          IModuloConteudoAdmin
      ): void => {

        setEditando(
          item
        );

        setTipo(
          item.tipo
        );

        setTitulo(
          item.titulo
        );

        setConteudo(
          item.conteudo
        );

        setUrl(
          item.url
        );
        setCards(
          item.cards &&
          item.cards.length >
            0
            ? item.cards
            : [
                {
                  numero:
                    '01',

                  titulo:
                    '',

                  descricao:
                    ''
                }
              ]
        );

        setOrdem(
          String(
            item.ordem
          )
        );

        setObrigatorio(
          item.obrigatorio
        );

        setAtivo(
          item.ativo
        );

        setErroLocal('');
        setRevisandoConteudo(false);

        setFormulario(
          true
        );
      };

    const validarFormularioConteudo =
      (): boolean => {

        setErroLocal('');

        const ordemNumero =
          Number(
            ordem
          );

        if (
          !Number.isFinite(
            ordemNumero
          ) ||
          ordemNumero <=
            0
        ) {
          setErroLocal(
            'Informe uma ordem válida.'
          );

          return false;
        }

        if (
          precisaTexto &&
          !conteudo.trim()
        ) {
          setErroLocal(
            'Informe o texto do conteúdo.'
          );

          return false;
        }

        if (
          precisaUrl &&
          !url.trim()
        ) {
          setErroLocal(
            'Informe a URL do conteúdo.'
          );

          return false;
        }

        if (
          tipo ===
            'Cards' &&
          cards.some(
            card =>
              !card.titulo.trim() ||
              !card.descricao.trim()
          )
        ) {
          setErroLocal(
            'Preencha título e descrição de todos os cards.'
          );

          return false;
        }

        return true;
      };

    // Passo 1: valida e abre a revisão. Nada é gravado ainda.
    const abrirRevisaoConteudo =
      (): void => {

        if (
          !validarFormularioConteudo()
        ) {
          return;
        }

        setRevisandoConteudo(
          true
        );
      };

    // Passo 2: chamado a partir da revisão — só então o bloco de
    // conteúdo é efetivamente criado/atualizado no Dataverse.
    const salvar =
      async (): Promise<void> => {

        if (
          !validarFormularioConteudo()
        ) {
          setRevisandoConteudo(
            false
          );
          return;
        }

        const ordemNumero =
          Number(
            ordem
          );

        try {

          const base:
            INovoModuloConteudo = {

            moduloId:
              props.moduloId,

            tipo,

            titulo:
              titulo.trim(),

            conteudo:
              conteudo.trim(),

            url:
              url.trim(),

            ordem:
              ordemNumero,

            obrigatorio,

            ativo,

            cards:
              tipo ===
                'Cards'
                ? cards
                : undefined          };

          if (
            editando
          ) {

            await props
              .onEditar({
                ...base,

                id:
                  editando.id
              });

          } else {

            await props
              .onCriar(
                base
              );
          }

          setFormulario(
            false
          );

          setRevisandoConteudo(
            false
          );

        } catch (e) {

          // Volta para a edição (não a revisão) para mostrar o erro
          // junto dos campos.
          setRevisandoConteudo(
            false
          );

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar conteúdo.'
          );
        }
      };

    const renderResumo =
      (
        item:
          IModuloConteudoAdmin
      ): React.ReactNode => {

        if (
          item.tipo ===
            'Cards'
        ) {

          const quantidade =
            item.cards?.length ||
            0;

          return (
            <span>
              {
                `${quantidade} card${quantidade === 1 ? '' : 's'}`
              }
            </span>
          );
        }
        if (
          item.tipo ===
            'Texto' ||
          item.tipo ===
            'Destaque'
        ) {
          const texto =
            item.conteudo
              .replace(
                /\s+/g,
                ' '
              )
              .trim();

          return (
            <span>
              {
                texto.length >
                  130
                  ? `${texto.substring(
                    0,
                    130
                  )}...`
                  : texto
              }
            </span>
          );
        }

        return (
          <span>
            {
              item.url ||
              'URL não informada'
            }
          </span>
        );
      };

    // Renderiza o bloco como ele vai aparecer de fato para o
    // colaborador (não a visão compacta de administração).
    const renderPreviewItem =
      (
        item:
          IModuloConteudoAdmin
      ): React.ReactNode => {

        const cardStyle:
          React.CSSProperties = {
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '14px',
          background: '#FFFFFF',
          opacity: item.ativo ? 1 : 0.5
        };

        const badgeInativo =
          !item.ativo && (
            <span
              style={{
                display: 'inline-block',
                marginBottom: '8px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#A4262C',
                background: '#FDE7E9',
                borderRadius: '999px'
              }}
            >
              Inativo — não aparece para o colaborador
            </span>
          );

        if (item.tipo === 'Cards') {
          const quantidade = item.cards?.length || 0;
          return (
            <div key={item.id} style={cardStyle}>
              {badgeInativo}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(quantidade, 1)}, 1fr)`,
                  gap: '12px'
                }}
              >
                {(item.cards || []).map((card, indice) => (
                  <div
                    key={indice}
                    style={{
                      border: '1px solid #CFE0F0',
                      borderRadius: '10px',
                      padding: '14px',
                      background: '#F7FBFF'
                    }}
                  >
                    <strong style={{ display: 'block', color: '#0B2D4D', marginBottom: '6px' }}>
                      {card.titulo || '—'}
                    </strong>
                    <span style={{ fontSize: '13px', color: '#334155' }}>
                      {card.descricao || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (item.tipo === 'Destaque') {
          return (
            <div
              key={item.id}
              style={{
                ...cardStyle,
                background: '#FFF8E6',
                border: '1px solid #F2C94C'
              }}
            >
              {badgeInativo}
              {item.titulo && (
                <strong style={{ display: 'block', marginBottom: '6px', color: '#6A4B00' }}>
                  ⚠ {item.titulo}
                </strong>
              )}
              <span style={{ whiteSpace: 'pre-wrap', color: '#6A4B00' }}>
                {item.conteudo || '—'}
              </span>
            </div>
          );
        }

        if (item.tipo === 'Texto') {
          return (
            <div key={item.id} style={cardStyle}>
              {badgeInativo}
              {item.titulo && (
                <strong style={{ display: 'block', marginBottom: '8px', color: '#0B2D4D', fontSize: '17px' }}>
                  {item.titulo}
                </strong>
              )}
              {item.conteudo ? (
                // O conteúdo é HTML (o mesmo formato usado na execução real
                // do treinamento) — renderiza de fato, em vez de mostrar as tags.
                <div
                  dangerouslySetInnerHTML={{
                    __html: item.conteudo
                  }}
                  style={{ color: '#334155', lineHeight: 1.7, fontSize: '15px' }}
                />
              ) : (
                <span style={{ color: '#94A3B8' }}>—</span>
              )}
            </div>
          );
        }

        if (item.tipo === 'Pergunta rápida') {
          return (
            <div key={item.id} style={cardStyle}>
              {badgeInativo}
              <strong style={{ display: 'block', marginBottom: '10px', color: '#0B2D4D' }}>
                ❓ {item.titulo || 'Pergunta rápida'}
              </strong>
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                O conteúdo desta pergunta é gerenciado separadamente (pergunta e alternativas).
              </span>
            </div>
          );
        }

        // Vídeo, Material, Link, Imagem
        const rotulo:
          Record<string, string> = {
          'Vídeo': '▶ Abrir vídeo',
          'Video': '▶ Abrir vídeo',
          'Material': '▤ Baixar material',
          'Link': '↗ Abrir link',
          'Imagem': '▧ Ver imagem'
        };

        return (
          <div key={item.id} style={cardStyle}>
            {badgeInativo}
            {item.titulo && (
              <strong style={{ display: 'block', marginBottom: '8px', color: '#0B2D4D' }}>
                {item.titulo}
              </strong>
            )}
            {item.tipo === 'Imagem' && item.url && (
              <img
                src={item.url}
                alt={item.titulo || 'Imagem do conteúdo'}
                style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px', display: 'block' }}
              />
            )}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                style={{ ...secondary, textDecoration: 'none', display: 'inline-block' }}
              >
                {rotulo[item.tipo] || 'Abrir'}
              </a>
            ) : (
              <span style={{ color: '#A4262C', fontSize: '13px' }}>URL não informada</span>
            )}
          </div>
        );
      };

    return (
      <section
        style={{
          marginTop:
            '22px',

          padding:
            '20px',

          background:
            '#FFFFFF',

          border:
            '2px solid #CFE0F0',

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
              '16px',

            alignItems:
              'flex-start',

            flexWrap:
              'wrap',

            marginBottom:
              '18px'
          }}
        >

          <div>

            <span
              style={{
                display:
                  'block',

                color:
                  '#64748B',

                fontSize:
                  '12px',

                fontWeight:
                  700,

                textTransform:
                  'uppercase'
              }}
            >
              Conteúdo modular
            </span>

            <h2
              style={{
                margin:
                  '5px 0 4px',

                color:
                  '#0B2D4D'
              }}
            >
              {
                props.moduloTitulo
              }
            </h2>

            <p
              style={{
                margin:
                  0,

                color:
                  '#64748B'
              }}
            >
              Adicione textos, vídeos, materiais, links, imagens, cards e destaques na ordem em que o funcionário deverá visualizar.
            </p>

          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setModoPreview(!modoPreview)}
              style={modoPreview ? primary : secondary}
            >
              {modoPreview ? '✎ Voltar para edição' : '👁 Pré-visualizar módulo'}
            </button>

            <button
              type="button"
              onClick={
                props.onFechar
              }
              style={
                secondary
              }
            >
              Fechar conteúdo
            </button>
          </div>

        </div>

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(155px, 1fr))',

            gap:
              '10px',

            marginBottom:
              '20px'
          }}
        >

          {tipos.map(
            item => (

              <button
                key={
                  item.tipo
                }
                type="button"
                disabled={
                  props.processando
                }
                onClick={() =>
                  abrirNovo(
                    item.tipo
                  )
                }
                style={{
                  textAlign:
                    'left',

                  padding:
                    '13px',

                  border:
                    '1px solid #CFE0F0',

                  borderRadius:
                    '10px',

                  background:
                    '#F7FBFF',

                  color:
                    '#0B2D4D',

                  cursor:
                    'pointer'
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
                  {
                    item.icon
                  } + {
                    item.tipo
                  }
                </strong>

                <small
                  style={{
                    color:
                      '#64748B'
                  }}
                >
                  {
                    item.descricao
                  }
                </small>

              </button>
            )
          )}

        </div>

        {
          props.erro &&
          (
            <div
              style={{
                padding:
                  '12px',

                marginBottom:
                  '14px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C',

                borderRadius:
                  '8px'
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
                style={{
                  padding:
                    '26px',

                  textAlign:
                    'center'
                }}
              >
                Carregando conteúdos...
              </div>
            )
            : modoPreview
            ? (
              <div
                style={{
                  display: 'grid',
                  gap: '4px',
                  padding: '16px',
                  background: '#F1F5F9',
                  borderRadius: '12px'
                }}
              >
                <span style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                  Assim o colaborador verá este módulo:
                </span>

                {props.conteudos.length === 0 && (
                  <div
                    style={{
                      padding: '28px',
                      border: '1px dashed #B8C9D9',
                      borderRadius: '10px',
                      textAlign: 'center',
                      color: '#64748B',
                      background: '#FFFFFF'
                    }}
                  >
                    Este módulo ainda não possui conteúdo.
                  </div>
                )}

                {props.conteudos
                  .slice()
                  .sort((a, b) => a.ordem - b.ordem)
                  .map(item => renderPreviewItem(item))}
              </div>
            )
            : (
              <div
                style={{
                  display:
                    'grid',

                  gap:
                    '10px'
                }}
              >

                {
                  props.conteudos.length ===
                    0 &&
                  (
                    <div
                      style={{
                        padding:
                          '28px',

                        border:
                          '1px dashed #B8C9D9',

                        borderRadius:
                          '10px',

                        textAlign:
                          'center',

                        color:
                          '#64748B'
                      }}
                    >
                      Este módulo ainda não possui conteúdo.
                      Escolha um dos blocos acima para começar.
                    </div>
                  )
                }

                {props.conteudos.map(
                  (
                    item,
                    indice
                  ) => (

                    <article
                      key={
                        item.id
                      }
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '52px 120px minmax(220px, 1fr) auto',

                        gap:
                          '12px',

                        alignItems:
                          'center',

                        padding:
                          '14px',

                        border:
                          item.ativo
                            ? '1px solid #D8E2EC'
                            : '1px dashed #CBD5E1',

                        borderRadius:
                          '10px',

                        background:
                          item.ativo
                            ? '#FFFFFF'
                            : '#F8FAFC',

                        opacity:
                          item.ativo
                            ? 1
                            : 0.7
                      }}
                    >

                      <strong>
                        #{
                          item.ordem
                        }
                      </strong>

                      <span
                        style={{
                          fontWeight:
                            700,

                          color:
                            '#0B5CAB'
                        }}
                      >
                        {
                          item.tipo
                        }
                      </span>

                      <div>

                        {
                          item.titulo &&
                          (
                            <strong
                              style={{
                                display:
                                  'block',

                                marginBottom:
                                  '4px'
                              }}
                            >
                              {
                                item.titulo
                              }
                            </strong>
                          )
                        }

                        <span
                          style={{
                            color:
                              '#64748B',

                            fontSize:
                              '13px',

                            wordBreak:
                              'break-word'
                          }}
                        >
                          {
                            renderResumo(
                              item
                            )
                          }
                        </span>

                      </div>

                      <div
                        style={{
                          display:
                            'flex',

                          gap:
                            '6px',

                          flexWrap:
                            'wrap',

                          justifyContent:
                            'flex-end'
                        }}
                      >

                        <button
                          type="button"
                          disabled={
                            indice ===
                              0 ||
                            props.processando
                          }
                          onClick={() => {

                            props
                              .onMoverAcima(
                                item
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
                            secondary
                          }
                          title="Mover para cima"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          disabled={
                            indice ===
                              props.conteudos.length -
                                1 ||
                            props.processando
                          }
                          onClick={() => {

                            props
                              .onMoverAbaixo(
                                item
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
                            secondary
                          }
                          title="Mover para baixo"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            abrirEditar(
                              item
                            )
                          }
                          style={
                            secondary
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
                                item.id,
                                !item.ativo
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
                            item.ativo
                              ? danger
                              : secondary
                          }
                        >
                          {
                            item.ativo
                              ? 'Desativar'
                              : 'Ativar'
                          }
                        </button>

                      </div>

                    </article>
                  )
                )}

              </div>
            )
        }

        {
          formulario &&
          (
            <div
              style={{
                position:
                  'fixed',

                inset:
                  0,

                zIndex:
                  11000,

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
                    '#FFFFFF',

                  borderRadius:
                    '16px'
                }}
              >

                <h2
                  style={{
                    marginTop:
                      0,

                    color:
                      '#0B2D4D'
                  }}
                >
                  {
                    editando
                      ? `Editar ${tipo}`
                      : `Adicionar ${tipo}`
                  }
                </h2>

                {
                  erroLocal &&
                  (
                    <div
                      style={{
                        marginBottom:
                          '15px',

                        padding:
                          '12px',

                        background:
                          '#FFF4CE',

                        color:
                          '#6A4B00',

                        borderRadius:
                          '8px'
                      }}
                    >
                      {
                        erroLocal
                      }
                    </div>
                  )
                }

                {!revisandoConteudo && (
                <>

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
                        event.target
                          .value as
                          TipoConteudoModulo
                      )
                  }
                  style={{
                    ...inputStyle,

                    marginTop:
                      '6px'
                  }}
                >
                  {tipos.map(
                    item => (
                      <option
                        key={
                          item.tipo
                        }
                        value={
                          item.tipo
                        }
                      >
                        {
                          item.tipo
                        }
                      </option>
                    )
                  )}
                </select>

                <div
                  style={{
                    height:
                      '13px'
                  }}
                />

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
                        event.target
                          .value
                      )
                  }
                  placeholder="Título opcional do bloco"
                  style={{
                    ...inputStyle,

                    marginTop:
                      '6px'
                  }}
                />

                {
                  precisaTexto &&
                  (
                    <>
                      <div
                        style={{
                          height:
                            '13px'
                        }}
                      />

                      <label>
                        Texto para leitura *
                      </label>

                      <textarea
                        rows={
                          14
                        }
                        value={
                          conteudo
                        }
                        onChange={
                          event =>
                            setConteudo(
                              event.target
                                .value
                            )
                        }
                        placeholder={
                          tipo ===
                            'Destaque'
                            ? 'Digite o aviso ou informação importante...'
                            : 'Digite aqui o conteúdo que o funcionário deverá ler...'
                        }
                        style={{
                          ...inputStyle,

                          marginTop:
                            '6px',

                          resize:
                            'vertical',

                          lineHeight:
                            1.6
                        }}
                      />

                      <small
                        style={{
                          display:
                            'block',

                          marginTop:
                            '5px',

                          color:
                            '#64748B'
                        }}
                      >
                        Este campo será exibido diretamente no treinamento para leitura do funcionário.
                      </small>
                    </>
                  )
                }

                {
                  precisaUrl &&
                  (
                    <>
                      <div
                        style={{
                          height:
                            '13px'
                        }}
                      />

                      <label>
                        URL *
                      </label>

                      <input
                        value={
                          url
                        }
                        onChange={
                          event =>
                            setUrl(
                              event.target
                                .value
                            )
                        }
                        placeholder={
                          tipo ===
                            'Vídeo'
                            ? 'https://... vídeo'
                            : tipo ===
                                'Material'
                              ? 'https://... SharePoint/PDF'
                              : tipo ===
                                  'Imagem'
                                ? 'https://... imagem'
                                : 'https://...'
                        }
                        style={{
                          ...inputStyle,

                          marginTop:
                            '6px'
                        }}
                      />

                      {
                        tipo ===
                          'Material' &&
                        (
                          <small
                            style={{
                              display:
                                'block',

                              marginTop:
                                '5px',

                              color:
                                '#64748B'
                            }}
                          >
                            Preferencialmente utilize arquivos armazenados no SharePoint.
                          </small>
                        )
                      }
                    </>
                  )
                }


                {
                  tipo ===
                    'Cards' &&
                  (
                    <>
                      <div
                        style={{
                          height:
                            '13px'
                        }}
                      />

                      <label>
                        Quantidade de cards
                      </label>

                      <select
                        value={
                          cards.length
                        }
                        onChange={
                          event => {

                            const quantidade =
                              Number(
                                event.target.value
                              );

                            setCards(
                              atuais => {

                                const nova =
                                  atuais.slice(
                                    0,
                                    quantidade
                                  );

                                while (
                                  nova.length <
                                  quantidade
                                ) {

                                  const indice =
                                    nova.length;

                                  nova.push({
                                    numero:
                                      (
                                        '00' +
                                        String(
                                          indice + 1
                                        )
                                      ).slice(
                                        -2
                                      ),

                                    titulo:
                                      '',

                                    descricao:
                                      ''
                                  });
                                }

                                return nova;
                              }
                            );
                          }
                        }
                        style={{
                          ...inputStyle,

                          marginTop:
                            '6px'
                        }}
                      >
                        <option value={1}>
                          1 card
                        </option>

                        <option value={2}>
                          2 cards
                        </option>

                        <option value={3}>
                          3 cards
                        </option>
                      </select>

                      <div
                        style={{
                          display:
                            'grid',

                          gridTemplateColumns:
                            `repeat(${cards.length}, minmax(0, 1fr))`,

                          gap:
                            '12px',

                          marginTop:
                            '14px'
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
                                  padding:
                                    '14px',

                                  border:
                                    '1px solid #D8E2EC',

                                  borderRadius:
                                    '10px',

                                  background:
                                    '#F8FAFC'
                                }}
                              >
                                <label>
                                  Número
                                </label>

                                <input
                                  value={
                                    cardItem.numero
                                  }
                                  onChange={
                                    event => {

                                      const nova =
                                        [...cards];

                                      nova[indice] = {
                                        ...cardItem,

                                        numero:
                                          event.target.value
                                      };

                                      setCards(
                                        nova
                                      );
                                    }
                                  }
                                  style={{
                                    ...inputStyle,

                                    marginTop:
                                      '6px'
                                  }}
                                />

                                <div
                                  style={{
                                    height:
                                      '10px'
                                  }}
                                />

                                <label>
                                  Título *
                                </label>

                                <input
                                  value={
                                    cardItem.titulo
                                  }
                                  onChange={
                                    event => {

                                      const nova =
                                        [...cards];

                                      nova[indice] = {
                                        ...cardItem,

                                        titulo:
                                          event.target.value
                                      };

                                      setCards(
                                        nova
                                      );
                                    }
                                  }
                                  placeholder="Ex.: O que é"
                                  style={{
                                    ...inputStyle,

                                    marginTop:
                                      '6px'
                                  }}
                                />

                                <div
                                  style={{
                                    height:
                                      '10px'
                                  }}
                                />

                                <label>
                                  Descrição *
                                </label>

                                <textarea
                                  rows={
                                    6
                                  }
                                  value={
                                    cardItem.descricao
                                  }
                                  onChange={
                                    event => {

                                      const nova =
                                        [...cards];

                                      nova[indice] = {
                                        ...cardItem,

                                        descricao:
                                          event.target.value
                                      };

                                      setCards(
                                        nova
                                      );
                                    }
                                  }
                                  placeholder="Texto do card..."
                                  style={{
                                    ...inputStyle,

                                    marginTop:
                                      '6px',

                                    resize:
                                      'vertical'
                                  }}
                                />
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
                      'grid',

                    gridTemplateColumns:
                      '160px 1fr 1fr',

                    gap:
                      '14px',

                    marginTop:
                      '16px',

                    alignItems:
                      'center'
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
                        ordem
                      }
                      onChange={
                        event =>
                          setOrdem(
                            event.target
                              .value
                          )
                      }
                      style={{
                        ...inputStyle,

                        marginTop:
                          '6px'
                      }}
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
                        '21px'
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
                            event.target
                              .checked
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

                      alignItems:
                        'center',

                      marginTop:
                        '21px'
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
                            event.target
                              .checked
                          )
                      }
                    />

                    Ativo
                  </label>

                </div>

                </>
                )}

                {revisandoConteudo && (
                  <div
                    style={{
                      padding: '14px 16px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      color: '#0B2D4D'
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '10px' }}>
                      Confira antes de salvar
                    </strong>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '8px', fontSize: '14px' }}>
                      <span style={{ color: '#64748B' }}>Tipo</span>
                      <span>{tipo}</span>

                      <span style={{ color: '#64748B' }}>Título</span>
                      <span>{titulo.trim() || '—'}</span>

                      <span style={{ color: '#64748B' }}>Ordem</span>
                      <span>{ordem}</span>

                      <span style={{ color: '#64748B' }}>Obrigatório</span>
                      <span>{obrigatorio ? 'Sim' : 'Não'}</span>

                      <span style={{ color: '#64748B' }}>Ativo</span>
                      <span>{ativo ? 'Sim' : 'Não'}</span>
                    </div>

                    {precisaTexto && (
                      <>
                        <div style={{ height: '10px' }} />
                        <span style={{ color: '#64748B', fontSize: '13px' }}>Texto</span>
                        <div
                          style={{
                            marginTop: '4px',
                            padding: '10px',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {conteudo.trim() || '—'}
                        </div>
                      </>
                    )}

                    {precisaUrl && (
                      <>
                        <div style={{ height: '10px' }} />
                        <span style={{ color: '#64748B', fontSize: '13px' }}>URL</span>
                        <div style={{ marginTop: '4px', fontSize: '14px', wordBreak: 'break-all' }}>
                          {url.trim() || '—'}
                        </div>
                      </>
                    )}

                    {tipo === 'Cards' && (
                      <>
                        <div style={{ height: '10px' }} />
                        <span style={{ color: '#64748B', fontSize: '13px' }}>Cards</span>
                        {cards.map((card, indiceCard) => (
                          <div
                            key={indiceCard}
                            style={{
                              marginTop: '6px',
                              padding: '8px 10px',
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px'
                            }}
                          >
                            <strong style={{ fontSize: '13px' }}>{card.titulo || '—'}</strong>
                            <div style={{ fontSize: '13px', color: '#334155' }}>{card.descricao || '—'}</div>
                          </div>
                        ))}
                      </>
                    )}

                    <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                      Nada foi salvo ainda. Se algo estiver errado, clique em
                      &quot;Voltar e editar&quot;.
                    </p>
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
                      if (revisandoConteudo) {
                        setRevisandoConteudo(false);
                        return;
                      }
                      setFormulario(
                        false
                      );
                    }}
                    style={
                      secondary
                    }
                  >
                    {revisandoConteudo ? 'Voltar e editar' : 'Cancelar'}
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {

                      if (!revisandoConteudo) {
                        abrirRevisaoConteudo();
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
                      primary
                    }
                  >
                    {
                      revisandoConteudo
                        ? (props.processando ? 'Salvando...' : 'Confirmar e salvar conteúdo')
                        : 'Revisar antes de salvar'
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

export default ModuloConteudosEditor;