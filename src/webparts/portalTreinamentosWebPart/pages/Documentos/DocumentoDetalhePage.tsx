import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface IDocumentoDetalhePageProps {
  documento?: IDocumento;

  revisoes:
    IDocumentoRevisao[];

  carregando:
    boolean;

  erro:
    string;

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

const DocumentoDetalhePage:
  React.FC<IDocumentoDetalhePageProps> = ({

    documento,
    revisoes,
    carregando,
    erro,
    onVoltar

  }) => {

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
                          revisao.status
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

                  </article>
                )
              )}

            </div>

          </div>
        )}

      </section>
    );
  };

export default DocumentoDetalhePage;