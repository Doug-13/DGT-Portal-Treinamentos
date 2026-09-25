import * as React from 'react';

import { ITreinamento } from '../../../models/Treinamento';
import { IDocumento } from '../../../models/Documento';
import Loading from '../../../components/common/Loading';
import ErrorMessage from '../../../components/common/ErrorMessage';

import {
  IEventoCalendario
} from '../../../services/microsoft365/CalendarService';

import ModuloCabecalho, {
  CABECALHOS_MODULO
} from '../../../components/layout/ModuloCabecalho';

import ResumoModulo, {
  CORES_INDICADOR,
  IIndicadorResumo
} from '../../../components/common/ResumoModulo';

import {
  Icones,
  IconeChave
} from '../../../components/common/Icones';

import {
  diaBrasilia,
  formatarHoraBrasilia,
  mesCurtoBrasilia,
  rotuloDiaRelativo
} from '../../../utils/fusoHorario';

// ============================================================
// INÍCIO DA INTRANET — mesmo padrão visual dos módulos:
//   hero → saudação + indicadores → acesso rápido → painéis
// ============================================================

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

  // Opcional: abre a tela do documento direto do painel.
  onAbrirDocumento?: (documento: IDocumento) => void;
}

const COR_AZUL = '#202A44';

const painel: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3EAF1',
  borderRadius: '14px',
  padding: '16px 18px',
  boxShadow: '0 2px 8px rgba(15,35,55,.04)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0
};

const linkButton: React.CSSProperties = {
  border: 0,
  padding: 0,
  background: 'transparent',
  color: '#0867D7',
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: 'pointer'
};

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

const TituloPainel:
  React.FC<{
    icone: IconeChave;
    titulo: string;
    cor: string;
    acao?: { texto: string; onClick: () => void };
  }> = ({
    icone,
    titulo,
    cor,
    acao
  }) => {

    const Icone =
      Icones[icone];

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '10px'
        }}
      >
        <strong
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#0A2845',
            fontSize: '15px'
          }}
        >
          <span style={{ display: 'inline-flex', color: cor }}>
            <Icone />
          </span>
          {titulo}
        </strong>

        {
          acao &&
          (
            <button
              type="button"
              onClick={acao.onClick}
              style={linkButton}
            >
              {acao.texto}
            </button>
          )
        }
      </div>
    );
  };

interface IAcessoRapido {
  titulo: string;
  descricao: string;
  icone: IconeChave;
  fundo: string;
  cor: string;
  onClick?: () => void;
}

const CartaoAcesso:
  React.FC<{ item: IAcessoRapido }> = ({ item }) => {

    const Icone =
      Icones[item.icone];

    const disponivel =
      !!item.onClick;

    return (
      <button
        type="button"
        onClick={item.onClick}
        disabled={!disponivel}
        title={disponivel ? `Abrir ${item.titulo}` : 'Em breve'}
        style={{
          position: 'relative',
          minHeight: '132px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '16px',
          textAlign: 'left',
          border: '1px solid #E3EAF1',
          borderRadius: '14px',
          background: '#FFFFFF',
          color: '#1F2937',
          fontSize: '13px',
          fontWeight: 400,
          cursor: disponivel ? 'pointer' : 'default',
          opacity: disponivel ? 1 : 0.62,
          boxShadow: disponivel ? '0 2px 8px rgba(15,35,55,.05)' : 'none',
          transition: 'box-shadow .15s, transform .15s'
        }}
        onMouseEnter={event => {
          if (disponivel) {
            event.currentTarget.style.boxShadow = '0 8px 20px rgba(15,35,55,.10)';
            event.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={event => {
          event.currentTarget.style.boxShadow = disponivel ? '0 2px 8px rgba(15,35,55,.05)' : 'none';
          event.currentTarget.style.transform = 'none';
        }}
      >
        <span
          style={{
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '11px',
            background: item.fundo,
            color: item.cor
          }}
        >
          <Icone />
        </span>

        <strong style={{ color: '#0A2845', fontSize: '15px' }}>
          {item.titulo}
        </strong>

        <span style={{ color: '#5C7287', fontSize: '12px', lineHeight: 1.4 }}>
          {item.descricao}
        </span>

        <span
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            padding: disponivel ? 0 : '2px 8px',
            borderRadius: '10px',
            background: disponivel ? 'transparent' : '#F1F5F9',
            color: disponivel ? '#0867D7' : '#64748B',
            fontSize: disponivel ? '16px' : '10.5px',
            fontWeight: 800
          }}
        >
          {disponivel ? '→' : 'Em breve'}
        </span>
      </button>
    );
  };

// ============================================================
// PÁGINA
// ============================================================

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
  onAbrirTreinamento,
  onVerTreinamentos,
  onVerDocumentos,
  onAbrirDocumento
}) => {

  const concluidos = treinamentos.filter(item => item.status === 'Concluído').length;
  const andamento = treinamentos.filter(item => item.status === 'Em andamento').length;
  const pendentes = treinamentos.filter(item => item.status === 'Disponível').length;
  const vencidos = treinamentos.filter(item => item.status === 'Vencido').length;
  const total = treinamentos.length;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  // Treinamento para "continuar de onde parou".
  const continuar =
    treinamentos.find(item => item.status === 'Em andamento') ||
    treinamentos.find(item => item.status === 'Disponível');

  // Só documentos vigentes aparecem no início.
  const documentosVigentes =
    documentos.filter(
      documento => normalizar(documento.status) === 'vigente'
    );

  const indicadores: IIndicadorResumo[] = [
    {
      titulo: 'Concluídos',
      valor: concluidos,
      icone: 'graduationCap',
      ...CORES_INDICADOR.verde,
      detalhe: 'treinamentos',
      onClick: onVerTreinamentos
    },
    {
      titulo: 'Em andamento',
      valor: andamento,
      icone: 'play',
      ...CORES_INDICADOR.laranja,
      detalhe: 'treinamentos',
      onClick: onVerTreinamentos
    },
    {
      titulo: 'Pendentes',
      valor: pendentes,
      icone: 'hourglass',
      ...CORES_INDICADOR.vermelho,
      detalhe: 'para iniciar',
      onClick: onVerTreinamentos
    },
    {
      titulo: 'Trilhas',
      valor: quantidadeTrilhas,
      icone: 'layers',
      ...CORES_INDICADOR.roxo,
      detalhe: 'inscritas',
      onClick: onVerTreinamentos
    },
    {
      titulo: 'Documentos',
      valor: documentosVigentes.length,
      icone: 'fileText',
      ...CORES_INDICADOR.azul,
      detalhe: 'vigentes',
      onClick: onVerDocumentos
    }
  ];

  // Módulos ainda não construídos aparecem como "Em breve".
  const acessos: IAcessoRapido[] = [
    { titulo: 'Treinamentos', descricao: 'Trilhas, cursos, avaliações e certificados.', icone: 'graduationCap', fundo: '#E4F4FF', cor: '#0B67D1', onClick: onVerTreinamentos },
    { titulo: 'Documentos', descricao: 'POPs, procedimentos, políticas e mais.', icone: 'fileText', fundo: '#E7F6EC', cor: '#107C41', onClick: onVerDocumentos },
    { titulo: 'Processos', descricao: 'Os principais processos da empresa.', icone: 'settings', fundo: '#F0EDFF', cor: '#6D5BD0' },
    { titulo: 'Indicadores', descricao: 'Resultados, métricas e dashboards.', icone: 'barChart', fundo: '#FFF3DE', cor: '#C2760C' },
    { titulo: 'RH e Pessoas', descricao: 'Informações, benefícios e serviços.', icone: 'users', fundo: '#FFE9EE', cor: '#C0392B' },
    { titulo: 'Sistemas', descricao: 'Sistemas e ferramentas corporativas.', icone: 'layers', fundo: '#E6F9FC', cor: '#05838F' }
  ];

  const abrirUrl = (
    url: string
  ): void => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const abrirCalendario = (): void =>
    abrirUrl('https://outlook.office.com/calendar/view/week');

  const legenda = [
    { rotulo: 'Concluídos', valor: concluidos, cor: '#07966B' },
    { rotulo: 'Em andamento', valor: andamento, cor: '#E08A0B' },
    { rotulo: 'Pendentes', valor: pendentes, cor: '#1D4ED8' },
    { rotulo: 'Vencidos', valor: vencidos, cor: '#C0392B' }
  ];

  return (
    <section style={{ color: '#0B2D4D' }}>

      {/* HERO — mesmo componente dos módulos */}

      <ModuloCabecalho
        config={CABECALHOS_MODULO.inicio}
        abas={[]}
        paginaAtual="inicio"
        navegar={() => undefined}
      />

      <div style={{ marginTop: '18px' }}>
        <ResumoModulo
          primeiroNome={primeiroNome}
          mensagem="Bem-vindo à Intranet DGT. Aqui está um resumo do seu dia."
          indicadores={indicadores}
        />
      </div>

      {/* ACESSO RÁPIDO */}

      <h2
        style={{
          margin: '22px 0 10px',
          color: '#0A2845',
          fontSize: '16px'
        }}
      >
        Acesso rápido
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '12px'
        }}
      >
        {acessos.map(item => (
          <CartaoAcesso key={item.titulo} item={item} />
        ))}
      </div>

      {erro && <div style={{ marginTop: '16px' }}><ErrorMessage mensagem={erro} /></div>}

      {carregando ? (
        <div style={{ marginTop: '22px' }}><Loading mensagem="Carregando portal..." /></div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px',
            marginTop: '20px'
          }}
        >

          {/* MEUS TREINAMENTOS */}

          <article style={painel}>
            <TituloPainel
              icone="graduationCap"
              titulo="Meus treinamentos"
              cor="#0B67D1"
              acao={{ texto: 'Ver todos →', onClick: onVerTreinamentos }}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '18px',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `conic-gradient(#07966B 0 ${percentual}%, #E7ECF1 ${percentual}% 100%)`
                }}
              >
                <div
                  style={{
                    width: '82px',
                    height: '82px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <strong style={{ fontSize: '24px', color: '#0B2D4D' }}>{percentual}%</strong>
                  <small style={{ color: '#5C7287', fontSize: '11px' }}>concluído</small>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                {legenda.map(item => (
                  <div
                    key={item.rotulo}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '10px 1fr auto',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#334155'
                    }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.cor }} />
                    <span>{item.rotulo}</span>
                    <strong style={{ color: '#0B2D4D' }}>{item.valor}</strong>
                  </div>
                ))}
              </div>
            </div>

            {
              continuar &&
              (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#F5F8FB',
                    border: '1px solid #E3EAF1'
                  }}
                >
                  <small style={{ display: 'block', color: '#5C7287', fontSize: '11px' }}>
                    {continuar.status === 'Em andamento' ? 'Continue de onde parou' : 'Próximo treinamento'}
                  </small>
                  <strong
                    style={{
                      display: 'block',
                      marginTop: '2px',
                      color: '#0A2845',
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={continuar.nome}
                  >
                    {continuar.nome}
                  </strong>
                  {
                    continuar.status === 'Em andamento' &&
                    (
                      <div style={{ marginTop: '6px', height: '5px', borderRadius: '5px', background: '#E2E8F0' }}>
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(100, continuar.progresso || 0))}%`,
                            height: '100%',
                            borderRadius: '5px',
                            background: '#E08A0B'
                          }}
                        />
                      </div>
                    )
                  }
                </div>
              )
            }

            <button
              type="button"
              onClick={() =>
                continuar
                  ? onAbrirTreinamento(continuar)
                  : onVerTreinamentos()
              }
              style={{
                width: '100%',
                marginTop: 'auto',
                padding: '11px 14px',
                border: 0,
                borderRadius: '8px',
                background: COR_AZUL,
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {continuar ? 'Continuar treinamento →' : 'Acessar meus treinamentos →'}
            </button>
          </article>

          {/* DOCUMENTOS VIGENTES */}

          <article style={painel}>
            <TituloPainel
              icone="fileText"
              titulo="Documentos vigentes"
              cor="#107C41"
              acao={{ texto: 'Ver todos →', onClick: onVerDocumentos }}
            />

            {
              documentosVigentes.length === 0
                ? (
                  <div style={{ padding: '20px 0', color: '#64748B', fontSize: '13px', textAlign: 'center' }}>
                    Nenhum documento vigente disponível.
                  </div>
                )
                : documentosVigentes.slice(0, 5).map(documento => (
                  <button
                    key={documento.id}
                    type="button"
                    onClick={() =>
                      onAbrirDocumento
                        ? onAbrirDocumento(documento)
                        : onVerDocumentos()
                    }
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 1fr',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '9px 6px',
                      border: 0,
                      borderBottom: '1px solid #EDF1F5',
                      borderRadius: 0,
                      background: 'transparent',
                      color: '#1F2937',
                      fontSize: '13px',
                      fontWeight: 400,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      style={{
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '9px',
                        background: '#E7F6EC',
                        color: '#107C41'
                      }}
                    >
                      <Icones.fileText />
                    </span>

                    <span style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: 'block',
                          color: '#0A2845',
                          fontSize: '13px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {documento.titulo}
                      </strong>
                      <small style={{ color: '#64748B', fontSize: '11.5px' }}>
                        {documento.codigo} · {documento.revisaoAtual || '-'}
                        {documento.area ? ` · ${documento.area}` : ''}
                      </small>
                    </span>
                  </button>
                ))
            }
          </article>

          {/* PRÓXIMOS EVENTOS */}

          <article style={painel}>
            <TituloPainel
              icone="clock"
              titulo="Próximos eventos"
              cor="#5B5FC7"
              acao={{ texto: 'Ver calendário →', onClick: abrirCalendario }}
            />

            {
              carregandoCalendario
                ? (
                  <div style={{ padding: '22px 0', color: '#64748B', textAlign: 'center', fontSize: '13px' }}>
                    Carregando agenda...
                  </div>
                )
                : erroCalendario
                  ? (
                    <div
                      style={{
                        padding: '11px',
                        borderRadius: '8px',
                        background: '#FFF8E1',
                        color: '#6A4B00',
                        fontSize: '12px',
                        lineHeight: 1.45
                      }}
                    >
                      Não foi possível carregar a agenda.
                      <div style={{ marginTop: '4px', color: '#806400' }}>
                        Verifique se a permissão Calendars.Read foi aprovada no SharePoint Admin Center.
                      </div>
                    </div>
                  )
                  : eventosCalendario.length === 0
                    ? (
                      <div style={{ padding: '20px 0', color: '#64748B', fontSize: '13px', textAlign: 'center' }}>
                        Nenhum evento nos próximos dias.
                      </div>
                    )
                    : eventosCalendario.map(evento => {

                      // Horários SEMPRE em Brasília (utils/fusoHorario.ts)
                      const relativo =
                        rotuloDiaRelativo(evento.inicio);

                      const horario =
                        evento.diaInteiro
                          ? 'Dia inteiro'
                          : `${formatarHoraBrasilia(evento.inicio)}${evento.fim ? ` – ${formatarHoraBrasilia(evento.fim)}` : ''}`;

                      return (
                        <div
                          key={evento.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '52px minmax(0,1fr)',
                            gap: '12px',
                            padding: '10px 0',
                            borderBottom: '1px solid #EDF1F5'
                          }}
                        >
                          <div
                            style={{
                              padding: '6px 4px',
                              borderRadius: '9px',
                              background: relativo === 'Hoje' ? '#5B5FC7' : '#EEF0FB',
                              color: relativo === 'Hoje' ? '#FFFFFF' : '#3B3F9E',
                              textAlign: 'center',
                              height: 'fit-content'
                            }}
                          >
                            <strong style={{ display: 'block', fontSize: '18px', lineHeight: 1.1 }}>
                              {diaBrasilia(evento.inicio)}
                            </strong>
                            <small style={{ fontSize: '10.5px', fontWeight: 700 }}>
                              {mesCurtoBrasilia(evento.inicio)}
                            </small>
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <strong
                              style={{
                                display: 'block',
                                color: '#0A2845',
                                fontSize: '13px',
                                lineHeight: 1.35
                              }}
                            >
                              {evento.titulo}
                            </strong>

                            <small style={{ display: 'block', marginTop: '3px', color: '#475569', fontSize: '12px' }}>
                              {relativo && <strong style={{ color: '#5B5FC7' }}>{relativo} · </strong>}
                              {horario}
                            </small>

                            {
                              evento.local &&
                              (
                                <small style={{ display: 'block', marginTop: '2px', color: '#64748B', fontSize: '11.5px' }}>
                                  {evento.local}
                                </small>
                              )
                            }

                            {
                              evento.joinUrl
                                ? (
                                  <button
                                    type="button"
                                    onClick={() => abrirUrl(evento.joinUrl)}
                                    style={{
                                      marginTop: '6px',
                                      padding: '5px 10px',
                                      border: 0,
                                      borderRadius: '6px',
                                      background: '#5B5FC7',
                                      color: '#FFFFFF',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Entrar no Teams
                                  </button>
                                )
                                : evento.webLink &&
                                (
                                  <button
                                    type="button"
                                    onClick={() => abrirUrl(evento.webLink)}
                                    style={{
                                      ...linkButton,
                                      marginTop: '6px',
                                      fontSize: '11.5px'
                                    }}
                                  >
                                    Abrir evento →
                                  </button>
                                )
                            }
                          </div>
                        </div>
                      );
                    })
            }
          </article>
        </div>
      )}

      <p
        style={{
          margin: '16px 0 0',
          color: '#94A3B8',
          fontSize: '11px',
          textAlign: 'right'
        }}
      >
        Horários exibidos no fuso de Brasília.
      </p>

    </section>
  );
};

export default InicioIntranetPage;
