import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IAlternativaAdmin,
  IAvaliacaoAdmin,
  IEditarAlternativa,
  IEditarAvaliacao,
  IEditarQuestao,
  INovaAlternativa,
  INovaAvaliacao,
  INovaQuestao,
  IQuestaoAdmin
} from '../../services/AvaliacaoAdminService';

export interface IGestaoAvaliacoesPageProps {
  treinamentos: ITreinamentoAdmin[];
  treinamentoId: string;
  avaliacaoSelecionada?: IAvaliacaoAdmin;
  questaoSelecionada?: IQuestaoAdmin;
  avaliacoes: IAvaliacaoAdmin[];
  questoes: IQuestaoAdmin[];
  alternativas: IAlternativaAdmin[];
  carregando: boolean;
  processando: boolean;
  erro: string;
  onVoltar: () => void;

  onSelecionarTreinamento:
    (id: string) => Promise<void>;

  onSelecionarAvaliacao:
    (item: IAvaliacaoAdmin) => Promise<void>;

  onSelecionarQuestao:
    (item: IQuestaoAdmin) => Promise<void>;

  onCriarAvaliacao:
    (dados: INovaAvaliacao) => Promise<void>;

  onEditarAvaliacao:
    (dados: IEditarAvaliacao) => Promise<void>;

  onDefinirAvaliacaoAtiva:
    (id: string, ativa: boolean) => Promise<void>;

  onCriarQuestao:
    (dados: INovaQuestao) => Promise<void>;

  onEditarQuestao:
    (dados: IEditarQuestao) => Promise<void>;

  onDefinirQuestaoAtiva:
    (id: string, ativa: boolean) => Promise<void>;

  onCriarAlternativa:
    (dados: INovaAlternativa) => Promise<void>;

  onEditarAlternativa:
    (dados: IEditarAlternativa) => Promise<void>;

  onDefinirAlternativaAtiva:
    (id: string, ativa: boolean) => Promise<void>;
}

const card:
  React.CSSProperties = {
  padding: '18px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px'
};

const btn:
  React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  borderRadius: '8px',
  cursor: 'pointer'
};

const btnPrimary:
  React.CSSProperties = {
  ...btn,
  border: 'none',
  background: '#1677ff',
  color: '#fff',
  fontWeight: 700
};

const input:
  React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: '1px solid #d8dee8',
  borderRadius: '8px'
};

const GestaoAvaliacoesPage:
  React.FC<IGestaoAvaliacoesPageProps> = (
    props
  ) => {

    const criarAvaliacao =
      (): void => {

        if (!props.treinamentoId) {
          window.alert(
            'Selecione um treinamento.'
          );
          return;
        }

        const nome =
          window.prompt(
            'Nome da avaliação:'
          );

        if (!nome) {
          return;
        }

        props
          .onCriarAvaliacao({
            treinamentoId:
              props.treinamentoId,
            nome,
            descricao: '',
            notaMinima: 70,
            quantidadeQuestoes: 10,
            tentativasPermitidas: 3,
            tempoLimiteMin: 0,
            sortearQuestoes: true,
            embaralharQuestoes: true,
            embaralharAlternativas: true,
            mostrarResultado: true,
            mostrarRespostasCorretas: false,
            ativa: true
          })
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

    const criarQuestao =
      (): void => {

        if (
          !props.avaliacaoSelecionada
        ) {
          return;
        }

        const enunciado =
          window.prompt(
            'Enunciado da questão:'
          );

        if (!enunciado) {
          return;
        }

        props
          .onCriarQuestao({
            avaliacaoId:
              props
                .avaliacaoSelecionada
                .id,
            nome:
              `Questão ${props.questoes.length + 1}`,
            enunciado,
            ordem:
              props.questoes.length + 1,
            peso: 1,
            multiplasRespostas: false,
            ativa: true
          })
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

    const criarAlternativa =
      (): void => {

        if (!props.questaoSelecionada) {
          return;
        }

        const texto =
          window.prompt(
            'Texto da alternativa:'
          );

        if (!texto) {
          return;
        }

        const correta =
          window.confirm(
            'Esta alternativa é correta?'
          );

        props
          .onCriarAlternativa({
            questaoId:
              props
                .questaoSelecionada
                .id,
            texto,
            ordem:
              props.alternativas.length + 1,
            correta,
            ativa: true
          })
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
      <section>

        <PageHeader
          titulo="Gestão de avaliações"
          subtitulo="Configure provas, banco de questões e alternativas."
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
            onClick={props.onVoltar}
            style={btn}
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={criarAvaliacao}
            style={btnPrimary}
          >
            + Nova avaliação
          </button>
        </div>

        {props.erro && (
          <div
            style={{
              ...card,
              marginBottom: '16px',
              color: '#a4262c',
              background: '#fde7e9'
            }}
          >
            {props.erro}
          </div>
        )}

        <div
          style={{
            ...card,
            marginBottom: '18px'
          }}
        >
          <label>
            Treinamento
          </label>

          <select
            value={props.treinamentoId}
            onChange={
              event => {
                props
                  .onSelecionarTreinamento(
                    event.target.value
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
              }
            }
            style={{
              ...input,
              marginTop: '8px'
            }}
          >
            <option value="">
              Selecione
            </option>

            {props.treinamentos.map(
              item => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.codigo} - {item.nome}
                </option>
              )
            )}
          </select>
        </div>

        {props.carregando ? (
          <div style={card}>
            Carregando...
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(260px, 1fr) minmax(320px, 1.3fr) minmax(300px, 1fr)',
              gap: '16px',
              alignItems: 'start'
            }}
          >

            {/* AVALIAÇÕES */}
            <div style={card}>
              <h3>Avaliações</h3>

              {props.avaliacoes.map(
                avaliacao => (
                  <div
                    key={avaliacao.id}
                    style={{
                      padding: '12px 0',
                      borderBottom:
                        '1px solid #edf0f4'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        props
                          .onSelecionarAvaliacao(
                            avaliacao
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
                        ...btn,
                        width: '100%',
                        textAlign: 'left',
                        fontWeight:
                          props.avaliacaoSelecionada?.id ===
                          avaliacao.id
                            ? 700
                            : 400
                      }}
                    >
                      {avaliacao.nome}
                    </button>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#64748b'
                      }}
                    >
                      <span>
                        Nota: {avaliacao.notaMinima}%
                      </span>

                      <span>
                        {avaliacao.quantidadeQuestoes} questões
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={props.processando}
                      onClick={() => {
                        props
                          .onDefinirAvaliacaoAtiva(
                            avaliacao.id,
                            !avaliacao.ativa
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
                        ...btn,
                        marginTop: '8px'
                      }}
                    >
                      {avaliacao.ativa
                        ? 'Desativar'
                        : 'Ativar'}
                    </button>
                  </div>
                )
              )}
            </div>

            {/* QUESTÕES */}
            <div style={card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center'
                }}
              >
                <h3>Questões</h3>

                <button
                  type="button"
                  onClick={criarQuestao}
                  disabled={
                    !props.avaliacaoSelecionada
                  }
                  style={btnPrimary}
                >
                  + Questão
                </button>
              </div>

              {props.questoes.map(
                questao => (
                  <div
                    key={questao.id}
                    style={{
                      padding: '12px 0',
                      borderBottom:
                        '1px solid #edf0f4'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        props
                          .onSelecionarQuestao(
                            questao
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
                        ...btn,
                        width: '100%',
                        textAlign: 'left'
                      }}
                    >
                      <strong>
                        {questao.ordem}.
                      </strong>{' '}
                      {questao.enunciado}
                    </button>

                    <button
                      type="button"
                      disabled={props.processando}
                      onClick={() => {
                        props
                          .onDefinirQuestaoAtiva(
                            questao.id,
                            !questao.ativa
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
                        ...btn,
                        marginTop: '8px'
                      }}
                    >
                      {questao.ativa
                        ? 'Desativar'
                        : 'Ativar'}
                    </button>
                  </div>
                )
              )}
            </div>

            {/* ALTERNATIVAS */}
            <div style={card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center'
                }}
              >
                <h3>Alternativas</h3>

                <button
                  type="button"
                  onClick={criarAlternativa}
                  disabled={
                    !props.questaoSelecionada
                  }
                  style={btnPrimary}
                >
                  + Alternativa
                </button>
              </div>

              {props.alternativas.map(
                alternativa => (
                  <div
                    key={alternativa.id}
                    style={{
                      padding: '12px 0',
                      borderBottom:
                        '1px solid #edf0f4'
                    }}
                  >
                    <div>
                      <strong>
                        {alternativa.ordem}.
                      </strong>{' '}
                      {alternativa.texto}
                    </div>

                    <div
                      style={{
                        marginTop: '5px',
                        fontSize: '12px',
                        color:
                          alternativa.correta
                            ? '#13795b'
                            : '#64748b'
                      }}
                    >
                      {alternativa.correta
                        ? 'Correta'
                        : 'Incorreta'}
                    </div>

                    <button
                      type="button"
                      disabled={props.processando}
                      onClick={() => {
                        props
                          .onDefinirAlternativaAtiva(
                            alternativa.id,
                            !alternativa.ativa
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
                        ...btn,
                        marginTop: '8px'
                      }}
                    >
                      {alternativa.ativa
                        ? 'Desativar'
                        : 'Ativar'}
                    </button>
                  </div>
                )
              )}
            </div>

          </div>
        )}

      </section>
    );
  };

export default GestaoAvaliacoesPage;
