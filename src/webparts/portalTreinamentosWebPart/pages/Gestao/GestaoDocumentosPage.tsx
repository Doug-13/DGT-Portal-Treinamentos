import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IDocumentoAdmin,
  INovaRevisaoDocumento,
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
        INovaRevisaoDocumento
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
      requerRetreinamento,
      setRequerRetreinamento
    ] =
      React.useState(false);

    const [
      justificativa,
      setJustificativa
    ] =
      React.useState('');

    const criarRevisao =
      async (): Promise<void> => {

        if (
          !props.documentoSelecionado
        ) {
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

          requerRetreinamento,

          justificativa:
            justificativa.trim()
        });

        setRevisao('');
        setMotivoAlteracao('');
        setDescricaoAlteracoes('');
        setRequerRetreinamento(false);
        setJustificativa('');
      };

    return (
      <section>
        <PageHeader
          titulo="Gestão documental"
          subtitulo="Documentos, revisões, vigência e retreinamentos."
        />

        <button
          type="button"
          onClick={
            props.onVoltar
          }
        >
          ← Voltar
        </button>

        {props.erro && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: '#fde7e9',
              color: '#a4262c'
            }}
          >
            {props.erro}
          </div>
        )}

        {props.erroPublicacao && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: '#fff4ce',
              color: '#8a6116'
            }}
          >
            {props.erroPublicacao}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(280px, 360px) 1fr',
            gap: '18px',
            marginTop: '20px'
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              background: '#fff',
              padding: '14px'
            }}
          >
            <strong>
              Documentos
            </strong>

            {props.carregando ? (
              <p>
                Carregando...
              </p>
            ) : (
              props.documentos.map(
                item => (
                  <button
                    key={item.id}
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
                      display: 'block',
                      width: '100%',
                      marginTop: '10px',
                      padding: '12px',
                      textAlign: 'left',
                      border:
                        '1px solid #e5e7eb',
                      borderRadius: '8px',
                      background:
                        props
                          .documentoSelecionado
                          ?.id ===
                        item.id
                          ? '#eff6ff'
                          : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <strong>
                      {item.codigo || '-'}
                    </strong>

                    <div>
                      {item.titulo}
                    </div>
                  </button>
                )
              )
            )}
          </div>

          <div>
            {!props.documentoSelecionado ? (
              <div
                style={{
                  padding: '28px',
                  border:
                    '1px solid #e5e7eb',
                  borderRadius: '12px',
                  background: '#fff'
                }}
              >
                Selecione um documento.
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '18px',
                    border:
                      '1px solid #e5e7eb',
                    borderRadius: '12px',
                    background: '#fff'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <strong>
                        {
                          props
                            .documentoSelecionado
                            .titulo
                        }
                      </strong>

                      <div>
                        {
                          props
                            .documentoSelecionado
                            .codigo
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
                    marginTop: '16px',
                    padding: '18px',
                    border:
                      '1px solid #e5e7eb',
                    borderRadius: '12px',
                    background: '#fff'
                  }}
                >
                  <strong>
                    Revisões
                  </strong>

                  {props.revisoes.length === 0 && (
                    <p>
                      Nenhuma revisão cadastrada.
                    </p>
                  )}

                  {props.revisoes.map(
                    item => (
                      <div
                        key={item.id}
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          border:
                            '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'space-between',
                            gap: '12px'
                          }}
                        >
                          <div>
                            <strong>
                              Revisão {
                                item.revisao
                              }
                            </strong>

                            <div>
                              {
                                item
                                  .requerRetreinamento
                                  ? 'Exige retreinamento'
                                  : 'Sem retreinamento'
                              }
                            </div>
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
                  )}
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    padding: '18px',
                    border:
                      '1px solid #e5e7eb',
                    borderRadius: '12px',
                    background: '#fff'
                  }}
                >
                  <strong>
                    Nova revisão
                  </strong>

                  <input
                    value={revisao}
                    placeholder="Ex.: 04"
                    onChange={
                      event =>
                        setRevisao(
                          event.target.value
                        )
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing:
                        'border-box',
                      marginTop: '12px',
                      padding: '10px'
                    }}
                  />

                  <input
                    value={motivoAlteracao}
                    placeholder="Motivo da alteração"
                    onChange={
                      event =>
                        setMotivoAlteracao(
                          event.target.value
                        )
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing:
                        'border-box',
                      marginTop: '10px',
                      padding: '10px'
                    }}
                  />

                  <textarea
                    value={
                      descricaoAlteracoes
                    }
                    placeholder="Descrição das alterações"
                    onChange={
                      event =>
                        setDescricaoAlteracoes(
                          event.target.value
                        )
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing:
                        'border-box',
                      marginTop: '10px',
                      padding: '10px',
                      minHeight: '90px'
                    }}
                  />

                  <label
                    style={{
                      display: 'block',
                      marginTop: '12px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        requerRetreinamento
                      }
                      onChange={
                        event =>
                          setRequerRetreinamento(
                            event.target
                              .checked
                          )
                      }
                    />{' '}
                    Esta revisão exige retreinamento
                  </label>

                  {!requerRetreinamento && (
                    <textarea
                      value={justificativa}
                      placeholder="Justificativa para não exigir retreinamento"
                      onChange={
                        event =>
                          setJustificativa(
                            event.target.value
                          )
                      }
                      style={{
                        display: 'block',
                        width: '100%',
                        boxSizing:
                          'border-box',
                        marginTop: '10px',
                        padding: '10px',
                        minHeight: '80px'
                      }}
                    />
                  )}

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
                      marginTop: '12px'
                    }}
                  >
                    {
                      props.processando
                        ? 'Salvando...'
                        : 'Criar revisão'
                    }
                  </button>
                </div>
              </>
            )}
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

              return resultado;
            }
          }
        />

        {props.resultadoPublicacao && (
          <ResultadoPublicacaoRevisaoCard
            resultado={
              props.resultadoPublicacao
            }
            onFechar={
              props
                .onLimparResultadoPublicacao
            }
          />
        )}
      </section>
    );
  };

export default GestaoDocumentosPage;
