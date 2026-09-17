import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IAtribuicaoManual,
  IResultadoAtribuicao,
  ITrilhaAtribuicao,
  IUsuarioAtribuicao,
  OrigemAtribuicao
} from '../../services/AtribuicaoAdminService';

export interface IAtribuirTreinamentoPageProps {
  usuarios: IUsuarioAtribuicao[];
  treinamentos: ITreinamentoAdmin[];
  trilhas: ITrilhaAtribuicao[];
  carregando: boolean;
  processando: boolean;
  erro: string;
  resultado?: IResultadoAtribuicao;

  onVoltar:
    () => void;

  onAtribuir:
    (
      dados:
        IAtribuicaoManual
    ) => Promise<IResultadoAtribuicao>;

  onLimparResultado:
    () => void;
}

const inputStyle:
  React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #d8dee8',
  borderRadius: '8px',
  background: '#fff'
};

const buttonPrimary:
  React.CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: '8px',
  background: '#1677ff',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
};

const buttonSecondary:
  React.CSSProperties = {
  padding: '9px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#fff',
  cursor: 'pointer'
};

const origens:
  OrigemAtribuicao[] = [
    'Individual',
    'Grupo',
    'Função',
    'Reciclagem',
    'Revisão documental',
    'Mudança de função'
  ];

const AtribuirTreinamentoPage:
  React.FC<IAtribuirTreinamentoPageProps> = (
    props
  ) => {

    const [
      usuarioId,
      setUsuarioId
    ] =
      React.useState('');

    const [
      treinamentoId,
      setTreinamentoId
    ] =
      React.useState('');

    const [
      trilhaId,
      setTrilhaId
    ] =
      React.useState('');

    const [
      origem,
      setOrigem
    ] =
      React.useState<
        OrigemAtribuicao
      >('Individual');

    const [
      origemId,
      setOrigemId
    ] =
      React.useState('');

    const [
      dataLimite,
      setDataLimite
    ] =
      React.useState('');

    const [
      observacao,
      setObservacao
    ] =
      React.useState('');

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const salvar =
      async (): Promise<void> => {

        setErroLocal('');

        if (!usuarioId) {
          setErroLocal(
            'Selecione o usuário.'
          );
          return;
        }

        if (!treinamentoId) {
          setErroLocal(
            'Selecione o treinamento.'
          );
          return;
        }

        try {

          await props
            .onAtribuir({
              usuarioId,
              treinamentoId,
              trilhaId:
                trilhaId || undefined,
              origem,
              origemId:
                origemId || undefined,
              dataLimite:
                dataLimite || undefined,
              observacao:
                observacao || undefined
            });

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao atribuir treinamento.'
          );
        }
      };

    const limpar =
      (): void => {

        setUsuarioId('');
        setTreinamentoId('');
        setTrilhaId('');
        setOrigem('Individual');
        setOrigemId('');
        setDataLimite('');
        setObservacao('');
        setErroLocal('');

        props.onLimparResultado();
      };

    return (
      <section>

        <PageHeader
          titulo="Atribuir treinamento"
          subtitulo="Crie atribuições individuais preservando regras, histórico e rastreabilidade."
        />

        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '18px'
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
            Voltar
          </button>

          <button
            type="button"
            onClick={
              limpar
            }
            style={
              buttonSecondary
            }
          >
            Limpar
          </button>
        </div>

        {(
          props.erro ||
          erroLocal
        ) && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#fde7e9',
              color: '#a4262c'
            }}
          >
            {
              erroLocal ||
              props.erro
            }
          </div>
        )}

        {props.resultado && (
          <div
            style={{
              marginBottom: '16px',
              padding: '14px',
              borderRadius: '10px',
              background:
                props.resultado.sucesso
                  ? '#e7f5ee'
                  : '#fff4ce',
              color:
                props.resultado.sucesso
                  ? '#13795b'
                  : '#6a4b00'
            }}
          >
            <strong>
              {
                props.resultado
                  .sucesso
                  ? 'Atribuição processada'
                  : 'Atenção'
              }
            </strong>

            <div
              style={{
                marginTop: '4px'
              }}
            >
              {
                props.resultado
                  .mensagem
              }
            </div>

            {props.resultado.reutilizado && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '12px'
                }}
              >
                Um treinamento concluído e válido foi reaproveitado.
              </div>
            )}
          </div>
        )}

        <div
          style={{
            maxWidth: '900px',
            padding: '22px',
            border: '1px solid #e5e7eb',
            borderRadius: '14px',
            background: '#fff'
          }}
        >

          {props.carregando ? (
            <div>
              Carregando dados...
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: '16px'
                }}
              >

                <div>
                  <label>
                    Usuário *
                  </label>

                  <select
                    value={
                      usuarioId
                    }
                    onChange={
                      event =>
                        setUsuarioId(
                          event.target.value
                        )
                    }
                    style={{
                      ...inputStyle,
                      marginTop: '6px'
                    }}
                  >
                    <option value="">
                      Selecione
                    </option>

                    {props.usuarios.map(
                      usuario => (
                        <option
                          key={
                            usuario.id
                          }
                          value={
                            usuario.id
                          }
                        >
                          {
                            usuario.nome
                          }
                          {
                            usuario.email
                              ? ` - ${usuario.email}`
                              : ''
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label>
                    Treinamento *
                  </label>

                  <select
                    value={
                      treinamentoId
                    }
                    onChange={
                      event =>
                        setTreinamentoId(
                          event.target.value
                        )
                    }
                    style={{
                      ...inputStyle,
                      marginTop: '6px'
                    }}
                  >
                    <option value="">
                      Selecione
                    </option>

                    {props.treinamentos
                      .filter(
                        item =>
                          item.ativo
                      )
                      .map(
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

                <div>
                  <label>
                    Trilha
                  </label>

                  <select
                    value={
                      trilhaId
                    }
                    onChange={
                      event =>
                        setTrilhaId(
                          event.target.value
                        )
                    }
                    style={{
                      ...inputStyle,
                      marginTop: '6px'
                    }}
                  >
                    <option value="">
                      Sem trilha
                    </option>

                    {props.trilhas.map(
                      trilha => (
                        <option
                          key={
                            trilha.id
                          }
                          value={
                            trilha.id
                          }
                        >
                          {
                            trilha.nome
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label>
                    Origem *
                  </label>

                  <select
                    value={
                      origem
                    }
                    onChange={
                      event =>
                        setOrigem(
                          event.target
                            .value as OrigemAtribuicao
                        )
                    }
                    style={{
                      ...inputStyle,
                      marginTop: '6px'
                    }}
                  >
                    {origens.map(
                      item => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label>
                    Referência da origem
                  </label>

                  <input
                    value={
                      origemId
                    }
                    onChange={
                      event =>
                        setOrigemId(
                          event.target.value
                        )
                    }
                    placeholder="Opcional"
                    style={{
                      ...inputStyle,
                      marginTop: '6px'
                    }}
                  />
                </div>

                <div>
                  <label>
                    Data limite
                  </label>

                  <input
                    type="date"
                    value={
                      dataLimite
                    }
                    onChange={
                      event =>
                        setDataLimite(
                          event.target.value
                        )
                    }
                    style={{
                      ...inputStyle,
                      marginTop: '6px'
                    }}
                  />
                </div>

              </div>

              <div
                style={{
                  marginTop: '16px'
                }}
              >
                <label>
                  Observação
                </label>

                <textarea
                  rows={4}
                  value={
                    observacao
                  }
                  onChange={
                    event =>
                      setObservacao(
                        event.target.value
                      )
                  }
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    marginTop: '6px'
                  }}
                />
              </div>

              <button
                type="button"
                disabled={
                  props.processando
                }
                onClick={() => {
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
                style={{
                  ...buttonPrimary,
                  marginTop: '20px'
                }}
              >
                {
                  props.processando
                    ? 'Processando...'
                    : 'Atribuir treinamento'
                }
              </button>
            </>
          )}

        </div>

      </section>
    );
  };

export default AtribuirTreinamentoPage;
