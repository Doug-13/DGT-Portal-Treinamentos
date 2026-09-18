import * as React from 'react';
import { ITreinamento } from '../../models/Treinamento';
import { IDocumento } from '../../models/Documento';
import Loading from '../../components/common/Loading';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';

export interface IInicioPageProps {
  primeiroNome: string;
  treinamentos: ITreinamento[];
  documentos: IDocumento[];
  carregando: boolean;
  erro: string;
  quantidadeTrilhas: number;
  onAbrirTreinamento: (treinamento: ITreinamento) => void;
  onVerTreinamentos: () => void;
  onVerDocumentos: () => void;
}

const indicadorStyle: React.CSSProperties = {
  flex: '1 1 160px',
  minHeight: 88,
  padding: '15px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  borderRadius: 11,
  border: '1px solid #e4ebf0',
  background: '#fff'
};

const Trilha: React.FC<{ nome: string; progresso: number }> = ({ nome, progresso }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <strong>{nome}</strong><strong>{progresso}%</strong>
    </div>
    <div style={{ height: 7, marginTop: 7, borderRadius: 10, background: '#e2e8ee', overflow: 'hidden' }}>
      <div style={{ width: `${progresso}%`, height: '100%', borderRadius: 10, background: '#0b85e5' }} />
    </div>
  </div>
);

const InicioPage: React.FC<IInicioPageProps> = ({
  primeiroNome,
  treinamentos,
  carregando,
  erro,
  quantidadeTrilhas,
  onAbrirTreinamento,
  onVerTreinamentos
}) => {
  const concluidos = treinamentos.filter(t => t.status === 'Concluído').length;
  const andamento = treinamentos.filter(t => t.status === 'Em andamento').length;
  const pendentes = treinamentos.filter(t => t.status === 'Disponível').length;
  const vencidos = treinamentos.filter(t => t.status === 'Vencido').length;

  const continuar = treinamentos.find(t => t.status === 'Em andamento');
  const cards = treinamentos.slice(0, 4);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Olá, {primeiroNome}! 👋</h1>
          <p style={{ marginTop: 4 }}>Aqui está um resumo da sua jornada de aprendizado.</p>
        </div>
        <span style={{ fontSize: 11, color: '#58708a', paddingTop: 8 }}>
          Portal de Conhecimento e Treinamentos DGT
        </span>
      </div>

      {erro && <ErrorMessage mensagem={erro} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
        <div style={{ ...indicadorStyle, background: 'linear-gradient(135deg,#effcf8,#e4f7f0)' }}>
          <span style={{ fontSize: 29 }}>🎓</span>
          <div><strong style={{ fontSize: 24 }}>{concluidos}</strong><div style={{ fontSize: 11 }}>Concluídos</div></div>
        </div>
        <div style={{ ...indicadorStyle, background: 'linear-gradient(135deg,#fff8eb,#fff0d8)' }}>
          <span style={{ fontSize: 29 }}>▶️</span>
          <div><strong style={{ fontSize: 24 }}>{andamento}</strong><div style={{ fontSize: 11 }}>Em andamento</div></div>
        </div>
        <div style={{ ...indicadorStyle, background: 'linear-gradient(135deg,#fff2f4,#ffe5e9)' }}>
          <span style={{ fontSize: 29 }}>🕒</span>
          <div><strong style={{ fontSize: 24 }}>{pendentes}</strong><div style={{ fontSize: 11 }}>Pendentes</div></div>
        </div>
        <div style={{ ...indicadorStyle, background: 'linear-gradient(135deg,#eef7ff,#e3f0fc)' }}>
          <span style={{ fontSize: 29 }}>📅</span>
          <div><strong style={{ fontSize: 24 }}>{vencidos}</strong><div style={{ fontSize: 11 }}>Vencidos</div></div>
        </div>
        <div style={{ ...indicadorStyle, background: 'linear-gradient(135deg,#f7f3ff,#eee8ff)' }}>
          <span style={{ fontSize: 29 }}>📚</span>
          <div><strong style={{ fontSize: 24 }}>{quantidadeTrilhas}</strong><div style={{ fontSize: 11 }}>Trilhas inscritas</div></div>
        </div>
      </div>

      {carregando ? (
        <div style={{ marginTop: 22 }}><Loading mensagem="Carregando treinamentos..." /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,.8fr)', gap: 16, marginTop: 16 }}>
            <article style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #e6edf2', display: 'flex', justifyContent: 'space-between' }}>
                <strong>🧳 &nbsp;Continuar treinamento</strong>
                <button type="button" onClick={onVerTreinamentos} style={{ background: 'transparent', color: '#0877d1', padding: 0 }}>
                  Ver meus treinamentos →
                </button>
              </div>

              {continuar ? (
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '190px 1fr auto', gap: 18, alignItems: 'center' }}>
                  <img
                    src={continuar.imagem}
                    alt=""
                    style={{ width: 190, height: 100, borderRadius: 8, objectFit: 'cover' }}
                  />
                  <div>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 10, background: '#2699ef', color: '#fff', fontSize: 9 }}>
                      EM ANDAMENTO
                    </span>
                    <h2 style={{ margin: '5px 0' }}>{continuar.nome}</h2>
                    <p style={{ margin: 0 }}>{continuar.descricao || `Carga horária: ${continuar.cargaHoraria}`}</p>
                    <div style={{ height: 8, marginTop: 13, borderRadius: 10, background: '#dfe6ec', overflow: 'hidden' }}>
                      <div style={{ width: `${continuar.progresso}%`, height: '100%', background: '#1287ed' }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => onAbrirTreinamento(continuar)}>Continuar →</button>
                </div>
              ) : (
                <div style={{ padding: 18 }}><EmptyState titulo="Nenhum treinamento em andamento" /></div>
              )}
            </article>

            <article style={{ padding: 0 }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #e6edf2', display: 'flex', justifyContent: 'space-between' }}>
                <strong>🗓 &nbsp;Próximos treinamentos</strong><span style={{ color: '#0877d1', fontSize: 10 }}>Ver todos →</span>
              </div>
              <div style={{ padding: 14, display: 'grid', gap: 11 }}>
                <div><strong>15 SET</strong> &nbsp; Brigada de Emergência</div>
                <div><strong>20 SET</strong> &nbsp; Semana da Qualidade</div>
                <div><strong>28 SET</strong> &nbsp; Atualização NR-35</div>
              </div>
            </article>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,.8fr)', gap: 16, marginTop: 16 }}>
            <article style={{ padding: 0 }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #e6edf2', display: 'flex', justifyContent: 'space-between' }}>
                <strong>🎓 &nbsp;Meus treinamentos</strong>
                <button type="button" onClick={onVerTreinamentos} style={{ background: 'transparent', color: '#0877d1', padding: 0 }}>Ver todos →</button>
              </div>

              <div
                style={{
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
                  gap: 12
                }}
              >
                {cards.map(t => {
                  const concluido = t.status === 'Concluído';
                  const bloqueado = t.status === 'Bloqueado';
                  const emAndamento = t.status === 'Em andamento';
                  const disponivel = t.status === 'Disponível';

                  let corStatus = '#0877d1';

                  if (concluido) {
                    corStatus = '#217346';
                  }

                  if (bloqueado) {
                    corStatus = '#60758a';
                  }

                  if (emAndamento) {
                    corStatus = '#a46600';
                  }

                  let textoBotao = 'Abrir treinamento';

                  if (concluido) {
                    textoBotao = '✓ Treinamento concluído';
                  } else if (bloqueado) {
                    textoBotao = '🔒 Pré-requisito';
                  } else if (emAndamento) {
                    textoBotao = 'Continuar';
                  } else if (disponivel) {
                    textoBotao = 'Iniciar treinamento';
                  }

                  return (
                    <div
                      key={`${t.id}-${t.usuarioTreinamentoId || ''}`}
                      style={{
                        position: 'relative',
                        border: concluido
                          ? '1px solid #9fd4b2'
                          : '1px solid #e3eaf0',
                        borderRadius: 9,
                        overflow: 'hidden',
                        background: concluido
                          ? '#fbfffc'
                          : '#ffffff',
                        boxShadow: concluido
                          ? '0 2px 7px rgba(33,115,70,.10)'
                          : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 165
                      }}
                    >
                      <div
                        style={{
                          position: 'relative'
                        }}
                      >
                        <img
                          src={t.imagem}
                          alt={t.nome}
                          style={{
                            width: '100%',
                            height: 70,
                            objectFit: 'cover',
                            display: 'block'
                          }}
                        />

                        {concluido && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 7px',
                              borderRadius: 12,
                              background: '#217346',
                              color: '#ffffff',
                              fontSize: 8,
                              fontWeight: 700,
                              boxShadow: '0 2px 5px rgba(0,0,0,.15)'
                            }}
                          >
                            <span>✓</span>
                            <span>CONCLUÍDO</span>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          padding: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: corStatus,
                            minHeight: 14
                          }}
                        >
                          {t.status.toUpperCase()}
                        </span>

                        <strong
                          style={{
                            display: 'block',
                            margin: '6px 0',
                            minHeight: 32,
                            fontSize: 12,
                            lineHeight: '16px',
                            color: '#173153'
                          }}
                        >
                          {t.nome}
                        </strong>

                        <small
                          style={{
                            color: '#52687d',
                            minHeight: 16
                          }}
                        >
                          {t.cargaHoraria}
                        </small>

                        <button
                          type="button"
                          disabled={bloqueado}
                          onClick={() => onAbrirTreinamento(t)}
                          style={{
                            width: '100%',
                            minHeight: 28,
                            marginTop: 'auto',
                            border: concluido
                              ? '1px solid #9fd4b2'
                              : 'none',
                            borderRadius: 5,
                            background: bloqueado
                              ? '#dce5ec'
                              : concluido
                                ? '#e5f4eb'
                                : '#2879ca',
                            color: bloqueado
                              ? '#81909d'
                              : concluido
                                ? '#217346'
                                : '#ffffff',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: bloqueado
                              ? 'not-allowed'
                              : 'pointer'
                          }}
                        >
                          {textoBotao}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article style={{ padding: 0 }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid #e6edf2' }}><strong>🧩 &nbsp;Trilhas em andamento</strong></div>
              <div style={{ padding: 15, display: 'grid', gap: 16 }}>
                <Trilha nome="Formação Produção" progresso={75} />
                <Trilha nome="Segurança Corporativa" progresso={40} />
                <Trilha nome="Qualidade" progresso={20} />
              </div>
            </article>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,.8fr)', gap: 16, marginTop: 16 }}>
            <article style={{ padding: 14 }}>
              <strong>⭐ &nbsp;Trilhas recomendadas para você</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
                {['Liderança DGT', 'Meio Ambiente', 'Gestão da Qualidade', 'Compliance'].map((nome, i) => (
                  <div key={nome} style={{ padding: 12, borderRadius: 8, background: i % 2 === 0 ? '#f2f8ff' : '#f0fbf7' }}>
                    <strong style={{ fontSize: 11 }}>{nome}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article style={{ padding: 14 }}>
              <strong>⏱ &nbsp;Acesso rápido</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={onVerTreinamentos}>Catálogo</button>
                <button type="button" onClick={onVerTreinamentos}>Certificados</button>
                <button type="button" onClick={onVerTreinamentos}>Dúvidas</button>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
};



export default InicioPage;
