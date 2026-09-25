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

  // Só o Gestor da área do documento (ou um Administrador) pode
  // aprovar e publicar. Quem não tem essa permissão vê o status,
  // mas não consegue acionar o botão.
  podeAprovar:
    boolean;
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

    const status =
      normalizar(
        props.revisao.status
      );

    // Qualquer valor não reconhecido (vazio, ou um status legado de
    // antes deste fluxo existir) é tratado como "elaboracao" — evita
    // uma revisão ficar sem nenhum botão de ação.
    const estagio:
      'elaboracao' | 'revisao' | 'aprovacao' | 'vigente' =
      status === 'revisao' ||
      status === 'aprovacao' ||
      status === 'vigente'
        ? status
        : 'elaboracao';

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

      color:
        '#1F2937',

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
              // Elaboração: só precisa ser enviado para o Gestor
              // avaliar — a decisão acontece na etapa seguinte.
              estagio === 'elaboracao' && (
                <button
                  type="button"
                  disabled={props.processando}
                  style={botaoBase}
                  onClick={() =>
                    executar(
                      () =>
                        props.onEnviarAprovacao(props.revisao)
                    )
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
                props.podeAprovar
                  ? (
                    <>
                      <button
                        type="button"
                        disabled={props.processando}
                        style={{
                          ...botaoBase,
                          border: 0,
                          background: '#0E9F6E',
                          color: '#FFFFFF'
                        }}
                        onClick={() =>
                          props.onPublicar(props.revisao)
                        }
                      >
                        ✓ Aprovar
                      </button>

                      <button
                        type="button"
                        disabled={props.processando}
                        style={{
                          ...botaoBase,
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
              // Vigente é estado final: para alterar o documento é
              // preciso criar uma NOVA revisão (botão "+ Nova revisão"
              // desta tela, ou "Criar nova revisão" no detalhe do
              // documento). A revisão vigente não volta para o fluxo.
              estagio === 'vigente' && (
                <span
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: '#E6F9FC',
                    color: '#202A44',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  Para alterar, crie uma nova revisão.
                </span>
              )
            }

            {
              // "Revisão" não existe mais como etapa do fluxo atual —
              // isto é só compatibilidade com alguma revisão antiga
              // que ainda esteja com esse status.
              estagio === 'revisao' && (
                <button
                  type="button"
                  disabled={props.processando}
                  style={botaoBase}
                  onClick={() =>
                    executar(
                      () =>
                        props.onDevolverElaboracao(props.revisao)
                    )
                  }
                >
                  Ir para elaboração
                </button>
              )
            }
          </div>
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

        {
          mensagemReprovado &&
          (
            <div
              style={{
                marginTop: '12px',
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
                    disabled={!motivoReprovacao.trim() || props.processando}
                    onClick={() => {

                      const motivo =
                        motivoReprovacao.trim();

                      setMostrarReprovar(false);

                      executar(async () => {

                        await props.onDevolverElaboracao(
                          props.revisao
                        );

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
      </div>
    );
  };

export default DocumentoWorkflowCard;