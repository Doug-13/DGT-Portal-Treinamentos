import * as React from 'react';

import { ITreinamento } from '../../../models/Treinamento';
import { IDocumento } from '../../../models/Documento';
import Loading from '../../../components/common/Loading';
import EmptyState from '../../../components/common/EmptyState';
import ErrorMessage from '../../../components/common/ErrorMessage';

import {
  IEventoCalendario
} from '../../../services/microsoft365/CalendarService';

export interface IInicioPageProps {
  primeiroNome: string;
  treinamentos: ITreinamento[];
  documentos: IDocumento[];
  carregando: boolean;
  erro: string;
  quantidadeTrilhas: number;

  eventosCalendario:
    IEventoCalendario[];

  carregandoCalendario:
    boolean;

  erroCalendario:
    string;

  onAbrirTreinamento: (treinamento: ITreinamento) => void;
  onVerTreinamentos: () => void;
  onVerDocumentos: () => void;
}

const card: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3EAF1',
  borderRadius: '14px'
};

const linkButton: React.CSSProperties = {
  border: 0,
  padding: 0,
  background: 'transparent',
  color: '#0867D7',
  fontWeight: 700,
  cursor: 'pointer'
};

const InicioIntranetPage: React.FC<IInicioPageProps> = ({
  primeiroNome,
  treinamentos,
  documentos,
  carregando,
  erro,
  quantidadeTrilhas,
  eventosCalendario,
  carregandoCalendario,
  erroCalendario,
  onVerTreinamentos,
  onVerDocumentos
}) => {
  const concluidos = treinamentos.filter(item => item.status === 'Concluído').length;
  const andamento = treinamentos.filter(item => item.status === 'Em andamento').length;
  const pendentes = treinamentos.filter(item => item.status === 'Disponível').length;
  const vencidos = treinamentos.filter(item => item.status === 'Vencido').length;
  const total = treinamentos.length;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const acessos = [
    ['🎓', 'Treinamentos', 'Acesse suas trilhas, cursos e certificados.', onVerTreinamentos, 'linear-gradient(135deg,#E4F4FF,#D5EBFF)'],
    ['📄', 'Documentos', 'POPs, procedimentos, políticas e muito mais.', onVerDocumentos, 'linear-gradient(135deg,#E9FAF4,#DCF4EA)'],
    ['⚙', 'Processos', 'Acesse os principais processos da empresa.', undefined, 'linear-gradient(135deg,#F0EDFF,#E5DFFF)'],
    ['▥', 'Indicadores', 'Resultados, métricas e dashboards.', undefined, 'linear-gradient(135deg,#FFF7E3,#FFEFC4)'],
    ['👥', 'RH e Pessoas', 'Informações, benefícios e serviços.', undefined, 'linear-gradient(135deg,#FFF0F4,#FFE2E9)'],
    ['🔗', 'Sistemas', 'Acesse nossos sistemas e ferramentas.', undefined, 'linear-gradient(135deg,#F3F6F8,#E8EDF2)']
  ];

  const formatarEvento =
    (
      valor:
        string
    ):
      Date | undefined => {

      if (
        !valor
      ) {
        return undefined;
      }

      const data =
        new Date(
          valor
        );

      return Number.isNaN(
        data.getTime()
      )
        ? undefined
        : data;
    };

  const abrirUrl =
    (
      url:
        string
    ): void => {

      if (
        !url
      ) {
        return;
      }

      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );
    };

  const abrirCalendario =
    (): void => {

      window.open(
        'https://outlook.office.com/calendar/view/week',
        '_blank',
        'noopener,noreferrer'
      );
    };


  return (
    <section style={{ color: '#0B2D4D' }}>
      <div
        style={{
          minHeight: '230px',
          padding: '34px 42px',
          display: 'grid',
          gridTemplateColumns: '1.15fr .85fr',
          gap: '28px',
          borderRadius: '18px',
          background: 'linear-gradient(120deg,#DCEFFF 0%,#B9DAF4 52%,#86B3D7 100%)',
          overflow: 'hidden'
        }}
      >
        <div style={{ alignSelf: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '40px', color: '#07345B', letterSpacing: '-1px' }}>
            Olá, {primeiroNome}! 👋
          </h1>
          <div style={{ marginTop: '7px', fontSize: '24px', color: '#123F68' }}>
            Bem-vindo à Intranet DGT
          </div>
          <p style={{ margin: '7px 0 0', maxWidth: '500px', color: '#2C5374', lineHeight: 1.5 }}>
            Conhecimento, processos e pessoas conectados para um futuro ainda maior.
          </p>
          <div style={{ display: 'flex', gap: '34px', flexWrap: 'wrap', marginTop: '28px' }}>
            <span>🛡 <strong>Segurança</strong><br /><small>em primeiro lugar</small></span>
            <span>👥 <strong>Pessoas</strong><br /><small>que fazem a diferença</small></span>
            <span>◇ <strong>Resultados</strong><br /><small>que constroem o amanhã</small></span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
          <div style={{ width: '270px', padding: '18px 20px', borderRadius: '14px', background: 'rgba(4,42,73,.82)', color: '#fff', lineHeight: 1.45 }}>
            “Desenvolver pessoas também é construir o futuro.”
            <div style={{ marginTop: '12px', textAlign: 'right', fontWeight: 800 }}>DGT</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <h2 style={{ margin: 0 }}>Acesso rápido</h2>
        <span style={{ color: '#0867D7', fontWeight: 700, fontSize: '13px' }}>⚙ Personalizar</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(150px,1fr))', gap: '12px', marginTop: '12px' }}>
        {acessos.map(item => (
          <button
            key={String(item[1])}
            type="button"
            onClick={item[3] as (() => void) | undefined}
            style={{
              minHeight: '170px',
              padding: '18px',
              textAlign: 'left',
              border: '1px solid #E5EAF0',
              borderRadius: '14px',
              background: String(item[4]),
              cursor: item[3] ? 'pointer' : 'default'
            }}
          >
            <div style={{ fontSize: '29px' }}>{String(item[0])}</div>
            <strong style={{ display: 'block', marginTop: '14px', fontSize: '18px', color: '#0A2845' }}>{String(item[1])}</strong>
            <span style={{ display: 'block', marginTop: '5px', color: '#405A73', fontSize: '13px', lineHeight: 1.4 }}>{String(item[2])}</span>
            <span style={{ display: 'block', marginTop: '12px', textAlign: 'right', color: '#0867D7', fontWeight: 800 }}>→</span>
          </button>
        ))}
      </div>

      {erro && <div style={{ marginTop: '16px' }}><ErrorMessage mensagem={erro} /></div>}

      {carregando ? (
        <div style={{ marginTop: '22px' }}><Loading mensagem="Carregando portal..." /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr .9fr .9fr', gap: '16px', marginTop: '20px' }}>
            <article style={{ ...card, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '17px' }}>📣 Comunicados</strong>
                <button type="button" onClick={onVerDocumentos} style={linkButton}>Ver todos</button>
              </div>
              {documentos.slice(0, 3).length === 0 ? (
                <div style={{ marginTop: '12px' }}><EmptyState titulo="Nenhum comunicado recente" /></div>
              ) : documentos.slice(0, 3).map(documento => (
                <div key={documento.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: '10px', padding: '11px 0', borderBottom: '1px solid #EDF1F5' }}>
                  <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: '#EEF6FF' }}>📄</div>
                  <div>
                    <strong style={{ display: 'block' }}>{documento.titulo}</strong>
                    <small style={{ color: '#64748B' }}>{documento.codigo} · Rev. {documento.revisaoAtual || '-'}</small>
                  </div>
                </div>
              ))}
            </article>

            <article style={{ ...card, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '17px' }}>🎓 Meus treinamentos</strong>
                <button type="button" onClick={onVerTreinamentos} style={linkButton}>Ver todos</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '145px 1fr', gap: '18px', alignItems: 'center', marginTop: '18px' }}>
                <div style={{ width: '140px', height: '140px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(#07966B 0 ${percentual}%, #E7ECF1 ${percentual}% 100%)` }}>
                  <div style={{ width: '92px', height: '92px', borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <strong style={{ fontSize: '28px' }}>{percentual}%</strong>
                    <small>Concluídos</small>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '9px', fontSize: '13px' }}>
                  <span>🟢 Concluídos <strong style={{ float: 'right' }}>{concluidos}</strong></span>
                  <span>🟠 Em andamento <strong style={{ float: 'right' }}>{andamento}</strong></span>
                  <span>🔵 Pendentes <strong style={{ float: 'right' }}>{pendentes}</strong></span>
                  <span>🔴 Vencidos <strong style={{ float: 'right' }}>{vencidos}</strong></span>
                </div>
              </div>
              <button type="button" onClick={onVerTreinamentos} style={{ width: '100%', marginTop: '18px', padding: '11px 14px', border: 0, borderRadius: '8px', background: '#073A67', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Acessar meus treinamentos →
              </button>
            </article>

            <article
              style={{
                ...card,
                padding:
                  '16px'
              }}
            >
              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'center',

                  gap:
                    '10px'
                }}
              >
                <strong
                  style={{
                    fontSize:
                      '17px'
                  }}
                >
                  🗓 Próximos eventos
                </strong>

                <button
                  type="button"
                  onClick={
                    abrirCalendario
                  }
                  style={
                    linkButton
                  }
                >
                  Ver calendário →
                </button>
              </div>

              {
                carregandoCalendario
                  ? (
                    <div
                      style={{
                        padding:
                          '22px 0',

                        color:
                          '#64748B',

                        textAlign:
                          'center'
                      }}
                    >
                      Carregando agenda...
                    </div>
                  )
                  : erroCalendario
                    ? (
                      <div
                        style={{
                          marginTop:
                            '12px',

                          padding:
                            '11px',

                          borderRadius:
                            '8px',

                          background:
                            '#FFF8E1',

                          color:
                            '#6A4B00',

                          fontSize:
                            '12px',

                          lineHeight:
                            1.45
                        }}
                      >
                        Não foi possível carregar a agenda.

                        <div
                          style={{
                            marginTop:
                              '4px',

                            color:
                              '#806400'
                          }}
                        >
                          Verifique se a permissão Calendars.Read foi aprovada no SharePoint Admin Center.
                        </div>
                      </div>
                    )
                    : eventosCalendario.length ===
                        0
                      ? (
                        <div
                          style={{
                            marginTop:
                              '12px'
                          }}
                        >
                          <EmptyState
                            titulo="Nenhum evento nos próximos dias"
                          />
                        </div>
                      )
                      : eventosCalendario.map(
                        evento => {

                          const inicioEvento =
                            formatarEvento(
                              evento.inicio
                            );

                          const fimEvento =
                            formatarEvento(
                              evento.fim
                            );

                          const dia =
                            inicioEvento
                              ? String(
                                inicioEvento.getDate()
                              )
                              : '--';

                          const mes =
                            inicioEvento
                              ? inicioEvento
                                .toLocaleDateString(
                                  'pt-BR',
                                  {
                                    month:
                                      'short'
                                  }
                                )
                                .replace(
                                  '.',
                                  ''
                                )
                                .toUpperCase()
                              : '---';

                          const horario =
                            evento.diaInteiro
                              ? 'Dia inteiro'
                              : inicioEvento
                                ? `${inicioEvento.toLocaleTimeString(
                                  'pt-BR',
                                  {
                                    hour:
                                      '2-digit',
                                    minute:
                                      '2-digit'
                                  }
                                )}${
                                  fimEvento
                                    ? ` - ${fimEvento.toLocaleTimeString(
                                      'pt-BR',
                                      {
                                        hour:
                                          '2-digit',
                                        minute:
                                          '2-digit'
                                      }
                                    )}`
                                    : ''
                                }`
                                : '-';

                          return (
                            <div
                              key={
                                evento.id
                              }
                              style={{
                                display:
                                  'grid',

                                gridTemplateColumns:
                                  '54px minmax(0,1fr)',

                                gap:
                                  '12px',

                                padding:
                                  '12px 0',

                                borderBottom:
                                  '1px solid #EDF1F5'
                              }}
                            >
                              <div
                                style={{
                                  padding:
                                    '7px 5px',

                                  borderRadius:
                                    '8px',

                                  background:
                                    '#EFF7F7',

                                  textAlign:
                                    'center'
                                }}
                              >
                                <strong
                                  style={{
                                    display:
                                      'block',

                                    fontSize:
                                      '20px'
                                  }}
                                >
                                  {
                                    dia
                                  }
                                </strong>

                                <small>
                                  {
                                    mes
                                  }
                                </small>
                              </div>

                              <div>
                                <strong
                                  style={{
                                    display:
                                      'block',

                                    color:
                                      '#0A2845',

                                    lineHeight:
                                      1.35
                                  }}
                                >
                                  {
                                    evento.titulo
                                  }
                                </strong>

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
                                  ◷ {
                                    horario
                                  }
                                </small>

                                {
                                  evento.local &&
                                  (
                                    <small
                                      style={{
                                        display:
                                          'block',

                                        marginTop:
                                          '3px',

                                        color:
                                          '#64748B'
                                      }}
                                    >
                                      📍 {
                                        evento.local
                                      }
                                    </small>
                                  )
                                }

                                {
                                  evento.joinUrl &&
                                  (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirUrl(
                                          evento.joinUrl
                                        )
                                      }
                                      style={{
                                        marginTop:
                                          '7px',

                                        padding:
                                          '6px 9px',

                                        border:
                                          0,

                                        borderRadius:
                                          '6px',

                                        background:
                                          '#5B5FC7',

                                        color:
                                          '#FFFFFF',

                                        fontSize:
                                          '11px',

                                        fontWeight:
                                          700,

                                        cursor:
                                          'pointer'
                                      }}
                                    >
                                      Entrar no Teams
                                    </button>
                                  )
                                }

                                {
                                  !evento.joinUrl &&
                                  evento.webLink &&
                                  (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirUrl(
                                          evento.webLink
                                        )
                                      }
                                      style={{
                                        marginTop:
                                          '7px',

                                        padding:
                                          0,

                                        border:
                                          0,

                                        background:
                                          'transparent',

                                        color:
                                          '#0867D7',

                                        fontSize:
                                          '11px',

                                        fontWeight:
                                          700,

                                        cursor:
                                          'pointer'
                                      }}
                                    >
                                      Abrir evento →
                                    </button>
                                  )
                                }
                              </div>
                            </div>
                          );
                        }
                      )
              }
            </article>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginTop: '16px' }}>
            {[
              ['Treinamentos concluídos', concluidos],
              ['Em andamento', andamento],
              ['Pendentes', pendentes],
              ['Trilhas', quantidadeTrilhas],
              ['Documentos', documentos.length]
            ].map(item => (
              <div key={String(item[0])} style={{ ...card, padding: '14px 16px' }}>
                <small style={{ color: '#64748B' }}>{item[0]}</small>
                <strong style={{ display: 'block', marginTop: '4px', fontSize: '24px' }}>{item[1]}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default InicioIntranetPage;
