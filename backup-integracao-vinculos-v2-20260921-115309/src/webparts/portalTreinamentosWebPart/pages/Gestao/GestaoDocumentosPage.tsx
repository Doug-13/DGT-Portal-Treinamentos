import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IDocumentoAdmin,
  INovaRevisaoDocumentoArquivo,
  IRevisaoAdmin
} from '../../services/DocumentoAdminService';

import {
  IPublicarRevisao,
  IResultadoPublicacaoRevisao
} from '../../services/RevisaoDocumentoAdminService';

import PublicarRevisaoModal from
  './PublicarRevisaoModal';

import ResultadoPublicacaoRevisaoCard from
  './ResultadoPublicacaoRevisaoCard';

export interface IGestaoDocumentosPageProps {
  documentos:
    IDocumentoAdmin[];

  documentoSelecionado?:
    IDocumentoAdmin;

  revisoes:
    IRevisaoAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  processandoPublicacao:
    boolean;

  erroPublicacao:
    string;

  resultadoPublicacao?:
    IResultadoPublicacaoRevisao;

  onVoltar:
    () => void;

  onSelecionarDocumento:
    (
      documento:
        IDocumentoAdmin
    ) => Promise<void>;

  onCriarRevisao:
    (
      dados:
        INovaRevisaoDocumentoArquivo
    ) => Promise<void>;

  onLimparSelecao:
    () => void;

  onPublicarRevisao:
    (
      dados:
        IPublicarRevisao
    ) => Promise<IResultadoPublicacaoRevisao>;

  onLimparResultadoPublicacao:
    () => void;
}

const input:
  React.CSSProperties = {
    width:
      '100%',

    boxSizing:
      'border-box',

    padding:
      '10px 12px',

    border:
      '1px solid #CBD5E1',

    borderRadius:
      '8px',

    background:
      '#FFFFFF'
  };

const card:
  React.CSSProperties = {
    padding:
      '18px',

    border:
      '1px solid #E2E8F0',

    borderRadius:
      '12px',

    background:
      '#FFFFFF'
  };

const GestaoDocumentosPage:
  React.FC<IGestaoDocumentosPageProps> = (
    props
  ) => {

    const [
      revisaoParaPublicar,
      setRevisaoParaPublicar
    ] =
      React.useState<
        IRevisaoAdmin | undefined
      >(undefined);

    const [
      revisao,
      setRevisao
    ] =
      React.useState('');

    const [
      motivoAlteracao,
      setMotivoAlteracao
    ] =
      React.useState('');

    const [
      descricaoAlteracoes,
      setDescricaoAlteracoes
    ] =
      React.useState('');

    const [
      arquivo,
      setArquivo
    ] =
      React.useState<
        File | undefined
      >(undefined);

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const criarRevisao =
      async (): Promise<void> => {

        setErroLocal('');

        if (
          !props.documentoSelecionado
        ) {
          return;
        }

        if (
          !revisao.trim()
        ) {

          setErroLocal(
            'Informe a nova revisão.'
          );

          return;
        }

        if (
          !motivoAlteracao.trim()
        ) {

          setErroLocal(
            'Informe o motivo da alteração.'
          );

          return;
        }

        if (
          !descricaoAlteracoes.trim()
        ) {

          setErroLocal(
            'Descreva as alterações realizadas.'
          );

          return;
        }

        if (
          !arquivo
        ) {

          setErroLocal(
            'Selecione o arquivo da nova revisão.'
          );

          return;
        }

        await props.onCriarRevisao({
          documentoId:
            props.documentoSelecionado.id,

          revisao:
            revisao.trim(),

          motivoAlteracao:
            motivoAlteracao.trim(),

          descricaoAlteracoes:
            descricaoAlteracoes.trim(),

          requerRetreinamento:
            false,

          justificativa:
            'Definido na publicação da revisão.',

          responsavel:
            props
              .documentoSelecionado
              .responsavel,

          arquivo
        });

        setRevisao('');
        setMotivoAlteracao('');
        setDescricaoAlteracoes('');
        setArquivo(
          undefined
        );
      };

    return (
      <section>
        <PageHeader
          titulo="Gestão documental"
          subtitulo="Documentos, revisões, arquivos, vigência e retreinamentos."
        />

        <button
          type="button"
          onClick={
            props.onVoltar
          }
          style={{
            padding:
              '8px 12px',

            border:
              '1px solid #CBD5E1',

            borderRadius:
              '8px',

            background:
              '#FFFFFF',

            cursor:
              'pointer'
          }}
        >
          ← Voltar
        </button>

        {
          (
            props.erro ||
            erroLocal
          ) &&
          (
            <div
              style={{
                marginTop:
                  '16px',

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
                erroLocal ||
                props.erro
              }
            </div>
          )
        }

        {
          props.erroPublicacao &&
          (
            <div
              style={{
                marginTop:
                  '16px',

                padding:
                  '12px',

                borderRadius:
                  '8px',

                background:
                  '#FFF4CE',

                color:
                  '#8A6116'
              }}
            >
              {
                props.erroPublicacao
              }
            </div>
          )
        }

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(280px, 360px) 1fr',

            gap:
              '18px',

            marginTop:
              '20px'
          }}
        >
          <div
            style={
              card
            }
          >
            <strong>
              Documentos
            </strong>

            {
              props.carregando
                ? (
                  <p>
                    Carregando...
                  </p>
                )
                : props.documentos.map(
                  item => (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() => {

                        props
                          .onSelecionarDocumento(
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
                      style={{
                        display:
                          'block',

                        width:
                          '100%',

                        marginTop:
                          '10px',

                        padding:
                          '12px',

                        textAlign:
                          'left',

                        border:
                          '1px solid #E2E8F0',

                        borderRadius:
                          '8px',

                        background:
                          props
                            .documentoSelecionado
                            ?.id ===
                            item.id
                            ? '#EFF6FF'
                            : '#FFFFFF',

                        cursor:
                          'pointer'
                      }}
                    >
                      <strong>
                        {
                          item.codigo ||
                          '-'
                        }
                      </strong>

                      <div>
                        {
                          item.titulo
                        }
                      </div>

                      {
                        item.area &&
                        (
                          <small
                            style={{
                              display:
                                'block',

                              marginTop:
                                '4px',

                              color:
                                '#64748B'
                            }}
                          >
                            Área: {
                              item.area
                            }
                          </small>
                        )
                      }
                    </button>
                  )
                )
            }
          </div>

          <div>
            {
              !props.documentoSelecionado
                ? (
                  <div
                    style={
                      card
                    }
                  >
                    Selecione um documento.
                  </div>
                )
                : (
                  <>
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

                          gap:
                            '12px'
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              fontSize:
                                '18px'
                            }}
                          >
                            {
                              props
                                .documentoSelecionado
                                .titulo
                            }
                          </strong>

                          <div
                            style={{
                              marginTop:
                                '4px',

                              color:
                                '#64748B'
                            }}
                          >
                            {
                              props
                                .documentoSelecionado
                                .codigo
                            }

                            {
                              props
                                .documentoSelecionado
                                .area
                                ? ` • ${props.documentoSelecionado.area}`
                                : ''
                            }
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={
                            props.onLimparSelecao
                          }
                        >
                          Fechar
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        ...card,
                        marginTop:
                          '16px'
                      }}
                    >
                      <strong>
                        Revisões
                      </strong>

                      {
                        props.revisoes.length ===
                          0 &&
                        (
                          <p>
                            Nenhuma revisão cadastrada.
                          </p>
                        )
                      }

                      {
                        props.revisoes.map(
                          item => (
                            <div
                              key={
                                item.id
                              }
                              style={{
                                marginTop:
                                  '12px',

                                padding:
                                  '12px',

                                border:
                                  '1px solid #E2E8F0',

                                borderRadius:
                                  '8px'
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    'flex',

                                  alignItems:
                                    'center',

                                  justifyContent:
                                    'space-between',

                                  gap:
                                    '12px'
                                }}
                              >
                                <div>
                                  <strong>
                                    Revisão {
                                      item.revisao
                                    }
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        '4px',

                                      color:
                                        '#64748B',

                                      fontSize:
                                        '12px'
                                    }}
                                  >
                                    {
                                      item.status ||
                                      'Em elaboração'
                                    }
                                  </div>

                                  {
                                    item.arquivoUrl &&
                                    (
                                      <a
                                        href={
                                          item.arquivoUrl
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          display:
                                            'inline-block',

                                          marginTop:
                                            '5px',

                                          color:
                                            '#0867D7',

                                          fontSize:
                                            '12px'
                                        }}
                                      >
                                        Abrir arquivo
                                      </a>
                                    )
                                  }
                                </div>

                                <button
                                  type="button"
                                  disabled={
                                    props
                                      .processandoPublicacao
                                  }
                                  onClick={() =>
                                    setRevisaoParaPublicar(
                                      item
                                    )
                                  }
                                >
                                  Publicar revisão
                                </button>
                              </div>
                            </div>
                          )
                        )
                      }
                    </div>

                    <div
                      style={{
                        ...card,
                        marginTop:
                          '16px'
                      }}
                    >
                      <strong
                        style={{
                          fontSize:
                            '17px'
                        }}
                      >
                        + Nova revisão
                      </strong>

                      <p
                        style={{
                          color:
                            '#64748B',

                          fontSize:
                            '12px',

                          lineHeight:
                            1.5
                        }}
                      >
                        A revisão será criada como rascunho. A decisão sobre retreinamento será realizada somente no momento da publicação.
                      </p>

                      <label>
                        Nova revisão *
                      </label>

                      <input
                        value={
                          revisao
                        }
                        placeholder="Ex.: Rev.02"
                        onChange={
                          event =>
                            setRevisao(
                              event.target.value
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
                        Motivo da alteração *
                      </label>

                      <input
                        value={
                          motivoAlteracao
                        }
                        placeholder="Ex.: Atualização do processo operacional"
                        onChange={
                          event =>
                            setMotivoAlteracao(
                              event.target.value
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
                        Descrição das alterações *
                      </label>

                      <textarea
                        value={
                          descricaoAlteracoes
                        }
                        placeholder="Descreva claramente o que foi alterado nesta revisão."
                        onChange={
                          event =>
                            setDescricaoAlteracoes(
                              event.target.value
                            )
                        }
                        style={{
                          ...input,

                          marginTop:
                            '6px',

                          minHeight:
                            '100px',

                          resize:
                            'vertical'
                        }}
                      />

                      <div
                        style={{
                          height:
                            '12px'
                        }}
                      />

                      <label>
                        Arquivo da nova revisão *
                      </label>

                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={
                          event => {

                            const item =
                              event.target.files &&
                              event.target.files[
                                0
                              ];

                            setArquivo(
                              item ||
                              undefined
                            );
                          }
                        }
                        style={{
                          ...input,
                          marginTop:
                            '6px'
                        }}
                      />

                      {
                        arquivo &&
                        (
                          <div
                            style={{
                              marginTop:
                                '8px',

                              padding:
                                '10px',

                              borderRadius:
                                '8px',

                              background:
                                '#EFF6FF',

                              color:
                                '#334155',

                              fontSize:
                                '12px'
                            }}
                          >
                            Arquivo selecionado: <strong>{
                              arquivo.name
                            }</strong>
                          </div>
                        )
                      }

                      <button
                        type="button"
                        disabled={
                          props.processando
                        }
                        onClick={() => {

                          criarRevisao()
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
                          marginTop:
                            '14px',

                          padding:
                            '10px 14px',

                          border:
                            0,

                          borderRadius:
                            '8px',

                          background:
                            '#0867D7',

                          color:
                            '#FFFFFF',

                          fontWeight:
                            700,

                          cursor:
                            props.processando
                              ? 'not-allowed'
                              : 'pointer'
                        }}
                      >
                        {
                          props.processando
                            ? 'Salvando...'
                            : 'Criar nova revisão'
                        }
                      </button>
                    </div>
                  </>
                )
            }
          </div>
        </div>

        <PublicarRevisaoModal
          aberto={
            !!revisaoParaPublicar
          }
          documentoRevisaoId={
            revisaoParaPublicar
              ?.id ||
            ''
          }
          revisao={
            revisaoParaPublicar
              ?.revisao ||
            ''
          }
          requerRetreinamento={
            revisaoParaPublicar
              ?.requerRetreinamento ||
            false
          }
          processando={
            props.processandoPublicacao
          }
          onCancelar={() =>
            setRevisaoParaPublicar(
              undefined
            )
          }
          onPublicar={
            async dados => {

              const resultado =
                await props
                  .onPublicarRevisao(
                    dados
                  );

              setRevisaoParaPublicar(
                undefined
              );

              if (
                props.documentoSelecionado
              ) {

                await props
                  .onSelecionarDocumento(
                    props.documentoSelecionado
                  );
              }

              return resultado;
            }
          }
        />

        {
          props.resultadoPublicacao &&
          (
            <ResultadoPublicacaoRevisaoCard
              resultado={
                props.resultadoPublicacao
              }
              onFechar={
                props
                  .onLimparResultadoPublicacao
              }
            />
          )
        }
      </section>
    );
  };

export default GestaoDocumentosPage;

