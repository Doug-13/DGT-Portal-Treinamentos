import * as React from 'react';

import {
  IRevisaoAdmin
} from '../../services/DocumentoAdminService';

export interface IDocumentoWorkflowCardProps {
  revisao:
    IRevisaoAdmin;

  processando:
    boolean;

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

  onPublicar:
    (
      revisao:
        IRevisaoAdmin
    ) => void;
}

const normalizar = (
  valor:
    string
): string => {

  return (
    valor ||
    ''
  )
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim();
};

const DocumentoWorkflowCard:
  React.FC<IDocumentoWorkflowCardProps> = (
    props
  ) => {

    const status =
      normalizar(
        props.revisao.status
      );

    const botaoBase:
      React.CSSProperties = {
      padding:
        '8px 12px',

      borderRadius:
        '8px',

      border:
        '1px solid #CBD5E1',

      background:
        '#FFFFFF',

      cursor:
        props.processando
          ? 'not-allowed'
          : 'pointer'
    };

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

    return (
      <div
        style={{
          marginTop:
            '10px',

          padding:
            '12px',

          border:
            '1px solid #E2E8F0',

          borderRadius:
            '9px',

          background:
            '#F8FAFC'
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
              '12px',

            flexWrap:
              'wrap'
          }}
        >
          <div>
            <div
              style={{
                fontSize:
                  '11px',

                color:
                  '#64748B'
              }}
            >
              Status do fluxo
            </div>

            <strong>
              {
                props.revisao.status ||
                'Elaboração'
              }
            </strong>
          </div>

          <div
            style={{
              display:
                'flex',

              gap:
                '8px',

              flexWrap:
                'wrap'
            }}
          >
            {
              (
                !status ||
                status ===
                  'elaboracao'
              ) &&
              (
                <button
                  type="button"
                  disabled={
                    props.processando
                  }
                  style={
                    botaoBase
                  }
                  onClick={() =>
                    executar(
                      () =>
                        props
                          .onEnviarRevisao(
                            props.revisao
                          )
                    )
                  }
                >
                  Enviar para revisão
                </button>
              )
            }

            {
              status ===
                'revisao' &&
              (
                <>
                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    style={
                      botaoBase
                    }
                    onClick={() =>
                      executar(
                        () =>
                          props
                            .onDevolverElaboracao(
                              props.revisao
                            )
                      )
                    }
                  >
                    Devolver para elaboração
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    style={
                      botaoBase
                    }
                    onClick={() =>
                      executar(
                        () =>
                          props
                            .onEnviarAprovacao(
                              props.revisao
                            )
                      )
                    }
                  >
                    Enviar para aprovação
                  </button>
                </>
              )
            }

            {
              status ===
                'aprovacao' &&
              (
                <>
                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    style={
                      botaoBase
                    }
                    onClick={() =>
                      executar(
                        () =>
                          props
                            .onEnviarRevisao(
                              props.revisao
                            )
                      )
                    }
                  >
                    Devolver para revisão
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    style={{
                      ...botaoBase,

                      border:
                        0,

                      background:
                        '#0867D7',

                      color:
                        '#FFFFFF',

                      fontWeight:
                        700
                    }}
                    onClick={() =>
                      props.onPublicar(
                        props.revisao
                      )
                    }
                  >
                    Aprovar e publicar
                  </button>
                </>
              )
            }

            {
              status ===
                'vigente' &&
              (
                <span
                  style={{
                    padding:
                      '7px 10px',

                    borderRadius:
                      '999px',

                    background:
                      '#E7F6EC',

                    color:
                      '#107C10',

                    fontSize:
                      '12px',

                    fontWeight:
                      700
                  }}
                >
                  Vigente
                </span>
              )
            }
          </div>
        </div>

        <div
          style={{
            marginTop:
              '10px',

            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit,minmax(180px,1fr))',

            gap:
              '8px',

            fontSize:
              '12px',

            color:
              '#475569'
          }}
        >
          <div>
            Criado por:
            {' '}
            <strong>
              {
                props.revisao.criadoPor ||
                '-'
              }
            </strong>
          </div>

          <div>
            Modificado por:
            {' '}
            <strong>
              {
                props.revisao.modificadoPor ||
                '-'
              }
            </strong>
          </div>

          <div>
            Aprovado por:
            {' '}
            <strong>
              {
                props.revisao.aprovadoPor ||
                '-'
              }
            </strong>
          </div>
        </div>
      </div>
    );
  };

export default DocumentoWorkflowCard;
