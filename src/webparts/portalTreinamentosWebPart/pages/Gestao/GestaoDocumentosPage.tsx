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

import DocumentoTreinamentosCard from
  './DocumentoTreinamentosCard';

import {
  ITreinamentoDocumentoAdmin
} from '../../services/TreinamentoDocumentoAdminService';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';
import DocumentoWorkflowCard from
  './DocumentoWorkflowCard';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

export interface IGestaoDocumentosPageProps {
  documentos:
    IDocumentoAdmin[];

  // Usados para decidir quem pode aprovar/publicar: só o Gestor
  // da área do documento, ou um Administrador.
  contexto?:
    IContextoAcesso;

  usuariosAreas:
    IUsuarioAreaAdmin[];

  documentoSelecionado?:
    IDocumentoAdmin;

  revisoes:
    IRevisaoAdmin[];
  vinculosTreinamentos:
    ITreinamentoDocumentoAdmin[];

  treinamentosDisponiveis:
    ITreinamentoAdmin[];

  carregandoTreinamentos:
    boolean;

  processandoTreinamentos:
    boolean;

  erroTreinamentos:
    string;

  onVincularTreinamento:
    (
      documentoId: string,
      treinamentoId: string,
      obrigatorio: boolean,
      ordem: number,
      observacao: string
    ) => Promise<void>;

  onDesativarTreinamento:
    (
      documentoId: string,
      relacaoId: string
    ) => Promise<void>;

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
  onEnviarRevisao:
    (
      revisao:
        IRevisaoAdmin
    ) => Promise<void>;

  onEnviarAprovacao:
    (
      revisao:
        IRevisaoAdmin
    ) => Promise<void>;

  onDevolverElaboracao:
    (
      revisao:
        IRevisaoAdmin
    ) => Promise<void>;
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

    // Só o Gestor ativo da área do documento (ou um Administrador)
    // pode aprovar e publicar a revisão.
    const podeAprovarDocumentoSelecionado =
      React.useMemo(
        () => {

          if (
            !props.documentoSelecionado
          ) {
            return false;
          }

          if (
            props.contexto?.perfil === 'Administrador'
          ) {
            return true;
          }

          const email =
            (props.contexto?.email || '')
              .trim()
              .toLowerCase();

          if (
            !email
          ) {
            return false;
          }

          return props.usuariosAreas.some(
            vinculo =>
              vinculo.areaId === props.documentoSelecionado!.areaId &&
              vinculo.perfil === 'Gestor' &&
              vinculo.ativo &&
              vinculo.usuarioEmail.trim().toLowerCase() === email
          );
        },
        [
          props.documentoSelecionado,
          props.contexto,
          props.usuariosAreas
        ]
      );

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

                            {
                              props
                                .documentoSelecionado
                                .tipo
                                ? ` • ${props.documentoSelecionado.tipo}`
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

                      <div
                        style={{
                          marginTop: '14px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                          gap: '10px',
                          fontSize: '13px'
                        }}
                      >
                        <div>
                          <span style={{ display: 'block', color: '#64748B', fontSize: '11px' }}>
                            Status
                          </span>
                          <strong>
                            {
                              props.documentoSelecionado.status ||
                              'Em elaboração'
                            }
                          </strong>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748B', fontSize: '11px' }}>
                            Aprovador / Responsável
                          </span>
                          <strong>
                            {
                              props.documentoSelecionado.responsavel ||
                              '—'
                            }
                          </strong>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748B', fontSize: '11px' }}>
                            Revisão atual
                          </span>
                          <strong>
                            {
                              props.documentoSelecionado.revisaoAtual ||
                              '—'
                            }
                          </strong>
                        </div>
                      </div>

                      {
                        props.documentoSelecionado.descricao &&
                        (
                          <div
                            style={{
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #E2E8F0',
                              color: '#475569',
                              fontSize: '13px',
                              lineHeight: 1.5
                            }}
                          >
                            {
                              props.documentoSelecionado.descricao
                            }
                          </div>
                        )
                      }

                      {
                        // Diagnóstico: por que o botão de aprovar aparece
                        // (ou não) para o usuário logado. Evita dúvida do
                        // tipo "sou o responsável e não consigo aprovar".
                        (() => {

                          const gestoresDaAreaDocumento =
                            props.documentoSelecionado
                              ? props.usuariosAreas.filter(
                                v =>
                                  v.areaId === props.documentoSelecionado!.areaId &&
                                  v.perfil === 'Gestor' &&
                                  v.ativo
                              )
                              : [];

                          return (
                            <div
                              style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid #E2E8F0',
                                fontSize: '12px',
                                color: '#64748B',
                                lineHeight: 1.6
                              }}
                            >
                              Você está logado como{' '}
                              <strong>
                                {props.contexto?.email || 'usuário não identificado'}
                              </strong>
                              {
                                props.contexto?.perfil === 'Administrador'
                                  ? ' — perfil Administrador, pode aprovar qualquer documento.'
                                  : gestoresDaAreaDocumento.length === 0
                                    ? (
                                      <>
                                        {' '}— esta área não tem nenhum Gestor cadastrado em
                                        {' '}<strong>Áreas e acessos</strong>, então ninguém
                                        consegue aprovar este documento ainda.
                                      </>
                                    )
                                    : (
                                      <>
                                        {' '}— Gestor(es) desta área:{' '}
                                        <strong>
                                          {
                                            gestoresDaAreaDocumento
                                              .map(g => `${g.usuarioNome} (${g.usuarioEmail})`)
                                              .join(', ')
                                          }
                                        </strong>.
                                        {
                                          podeAprovarDocumentoSelecionado
                                            ? ' Você é um deles: o botão de aprovar aparece na revisão abaixo.'
                                            : ' Seu e-mail não bate com nenhum deles, por isso o botão de aprovar não aparece.'
                                        }
                                      </>
                                    )
                              }
                            </div>
                          );
                        })()
                      }
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

                                <DocumentoWorkflowCard
                            revisao={
                              item
                            }
                            processando={
                              props.processando
                            }
                            onEnviarRevisao={
                              props.onEnviarRevisao
                            }
                            onEnviarAprovacao={
                              props.onEnviarAprovacao
                            }
                            onDevolverElaboracao={
                              props.onDevolverElaboracao
                            }
                            onPublicar={
                              revisaoSelecionada =>
                                setRevisaoParaPublicar(
                                  revisaoSelecionada
                                )
                            }
                            podeAprovar={
                              podeAprovarDocumentoSelecionado
                            }
                          />
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

        {
          props.documentoSelecionado &&
          (
            <DocumentoTreinamentosCard
              vinculos={
                props.vinculosTreinamentos
              }
              treinamentos={
                props.treinamentosDisponiveis
              }
              processando={
                props.processandoTreinamentos
              }
              erro={
                props.erroTreinamentos
              }
              onVincular={
                async (
                  treinamentoId,
                  obrigatorio,
                  ordem,
                  observacao
                ) => {

                  if (
                    !props.documentoSelecionado
                  ) {
                    return;
                  }

                  await props
                    .onVincularTreinamento(
                      props.documentoSelecionado.id,
                      treinamentoId,
                      obrigatorio,
                      ordem,
                      observacao
                    );
                }
              }
              onDesativar={
                async relacaoId => {

                  if (
                    !props.documentoSelecionado
                  ) {
                    return;
                  }

                  await props
                    .onDesativarTreinamento(
                      props.documentoSelecionado.id,
                      relacaoId
                    );
                }
              }
            />
          )
        }
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
          ehPrimeiraRevisao={
            props.revisoes.length <= 1
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