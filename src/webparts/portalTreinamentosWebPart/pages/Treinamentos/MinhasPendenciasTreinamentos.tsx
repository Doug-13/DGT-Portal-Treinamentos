import * as React from 'react';

import {
  ITreinamento
} from '../../models/Treinamento';

import {
  IDocumento
} from '../../models/Documento';

import {
  IPendenciaDocumento
} from '../../hooks/useDocumentosPendencias';

import {
  CONTROLE_DOCUMENTAL
} from '../../constants/controleDocumental';

import {
  ESTILOS_STATUS_TREINAMENTO,
  EtapaFluxoBadge,
  StatusDocumentoBadge
} from '../../components/common/StatusDocumento';

// ============================================================
// VISÃO GERAL DE TREINAMENTOS — "MINHAS PENDÊNCIAS"
//
// Reúne, num só lugar, tudo o que depende de uma ação do usuário:
//
//   1. Fluxo de treinamentos → etapas do fluxo de revisão de um
//      treinamento (documento de controle TRN) sob responsabilidade
//      do usuário: elaborar, revisar, aprovar (como gestor) etc.
//   2. Documentos            → etapas do fluxo de POP, IT, política...
//      aguardando o usuário.
//   3. Treinamentos a fazer  → os treinamentos do próprio usuário que
//      pedem ação: vencidos (reciclagem), reprovados (refazer), em
//      andamento (continuar) e disponíveis (iniciar).
//
// As pendências 1 e 2 vêm do mesmo cálculo da tela Documentos
// (useDocumentosPendencias): só aparece o que está de fato aguardando
// o usuário. Documento publicado sem revisão em andamento não entra.
// ============================================================

export interface IMinhasPendenciasTreinamentosProps {
  pendencias: IPendenciaDocumento[];
  carregando: boolean;
  erro: string;

  // Treinamentos atribuídos ao usuário logado.
  treinamentos: ITreinamento[];

  onAbrirTreinamento: (treinamento: ITreinamento) => void;
  onVerTreinamentos: () => void;

  // Pendências de documentos comuns abrem o documento.
  onAbrirDocumento?: (documento: IDocumento) => void;

  // Pendências do fluxo de treinamentos são tratadas na Gestão.
  // Sem esta função (usuário sem acesso à Gestão), o botão não aparece.
  onAbrirGestao?: () => void;

  onRecarregar?: () => void;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  ciano10: '#E6F9FC',
  indigo: '#485CC7',
  borda: '#E3EAF1',
  linha: '#F1F5F9',
  textoSec: '#64748B',
  atraso: '#B42318',
  atencao: '#B45309'
};

const LIMITE_POR_GRUPO = 5;

const ehControle = (
  documento: IDocumento
): boolean =>
  (documento.tipo || '').trim().toUpperCase() ===
  CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO;

const textoIdade = (
  dias: number
): string =>
  dias === 0
    ? 'hoje'
    : dias === 1
      ? 'há 1 dia'
      : `há ${dias} dias`;

const corIdade = (
  dias: number
): string =>
  dias >= 15
    ? COR.atraso
    : dias >= 7
      ? COR.atencao
      : COR.textoSec;

const dataBr = (
  valor?: string
): string => {
  if (!valor) {
    return '';
  }
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return isNaN(data.getTime()) ? valor : data.toLocaleDateString('pt-BR');
};

const prazoVencido = (
  prazo?: string
): boolean => {
  if (!prazo) {
    return false;
  }
  const data = new Date(prazo.length === 10 ? `${prazo}T23:59:59` : prazo);
  return !isNaN(data.getTime()) && data.getTime() < Date.now();
};

// Papel do usuário na pendência (ajuda a entender "por que é minha").
const PAPEL: Record<string, string> = {
  fluxo: 'Etapa sob sua responsabilidade',
  aprovar: 'Aprovação como gestor da área',
  elaborar: 'Revisão sob sua responsabilidade'
};

// Treinamentos do próprio usuário que pedem ação, em ordem de urgência.
const ACAO_TREINAMENTO: Record<string, { ordem: number; acao: string }> = {
  'Vencido': { ordem: 0, acao: 'Refazer' },
  'Reprovado': { ordem: 1, acao: 'Refazer' },
  'Em andamento': { ordem: 2, acao: 'Continuar' },
  'Disponível': { ordem: 3, acao: 'Iniciar' }
};

const botaoPrimario: React.CSSProperties = {
  padding: '6px 12px',
  border: 0,
  borderRadius: '7px',
  background: COR.azul,
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit'
};

const botaoLink: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  color: '#0867D7',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px',
  padding: 0,
  fontFamily: 'inherit'
};

const Grupo: React.FC<{
  icone: string;
  titulo: string;
  descricao: string;
  quantidade: number;
  vazio: string;
  rodape?: React.ReactNode;
}> = ({
  icone,
  titulo,
  descricao,
  quantidade,
  vazio,
  rodape,
  children
}) => (
  <div
    style={{
      padding: '12px 16px 14px',
      borderTop: `1px solid ${COR.borda}`,
      minWidth: 0
    }}
  >
    <strong
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: COR.azul,
        fontSize: '13px'
      }}
    >
      <span aria-hidden="true">{icone}</span>
      {titulo}
      <span
        style={{
          padding: '0 7px',
          borderRadius: '10px',
          background: quantidade > 0 ? COR.azul : '#E2E8F0',
          color: quantidade > 0 ? '#FFFFFF' : COR.textoSec,
          fontSize: '11px',
          lineHeight: '18px'
        }}
      >
        {quantidade}
      </span>
    </strong>

    <span
      style={{
        display: 'block',
        margin: '2px 0 8px',
        color: COR.textoSec,
        fontSize: '11.5px'
      }}
    >
      {descricao}
    </span>

    {
      quantidade === 0
        ? (
          <span
            style={{
              display: 'block',
              padding: '10px 0',
              color: '#94A3B8',
              fontSize: '12px'
            }}
          >
            {vazio}
          </span>
        )
        : children
    }

    {rodape}
  </div>
);

const Linha: React.FC<{
  titulo: string;
  acao?: React.ReactNode;
}> = ({
  titulo,
  acao,
  children
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 0',
      borderBottom: `1px solid ${COR.linha}`
    }}
  >
    <div style={{ minWidth: 0 }}>
      <strong
        title={titulo}
        style={{
          display: 'block',
          color: COR.azul,
          fontSize: '12.5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          marginTop: '3px',
          fontSize: '11.5px',
          color: COR.textoSec
        }}
      >
        {children}
      </span>
    </div>

    {acao}
  </div>
);

const LinhaPendencia: React.FC<{
  pendencia: IPendenciaDocumento;
  acao?: React.ReactNode;
}> = ({
  pendencia,
  acao
}) => (
  <Linha
    titulo={pendencia.documento.titulo || pendencia.documento.codigo}
    acao={acao}
  >
    <span>
      {[pendencia.documento.codigo, pendencia.revisao].filter(item => !!item).join(' · ')}
    </span>

    {
      pendencia.etapa
        ? <EtapaFluxoBadge etapa={pendencia.etapa} aguardandoVoce={true} />
        : <StatusDocumentoBadge status={pendencia.status} />
    }

    <span title={PAPEL[pendencia.tipo]}>
      {PAPEL[pendencia.tipo]}
    </span>

    {
      pendencia.prazo
        ? (
          <span
            style={{
              color: prazoVencido(pendencia.prazo) ? COR.atraso : COR.textoSec,
              fontWeight: prazoVencido(pendencia.prazo) ? 700 : 400
            }}
          >
            prazo {dataBr(pendencia.prazo)}
          </span>
        )
        : (
          <span
            style={{
              color: corIdade(pendencia.diasParado),
              fontWeight: pendencia.diasParado >= 7 ? 700 : 400
            }}
          >
            {textoIdade(pendencia.diasParado)}
          </span>
        )
    }
  </Linha>
);

const MinhasPendenciasTreinamentos:
  React.FC<IMinhasPendenciasTreinamentosProps> = ({
    pendencias,
    carregando,
    erro,
    treinamentos,
    onAbrirTreinamento,
    onVerTreinamentos,
    onAbrirDocumento,
    onAbrirGestao,
    onRecarregar
  }) => {

    const [recolhido, setRecolhido] =
      React.useState(false);

    const doFluxoTreinamentos =
      pendencias.filter(item => ehControle(item.documento));

    const deDocumentos =
      pendencias.filter(item => !ehControle(item.documento));

    const aFazer =
      treinamentos
        .filter(item => !!ACAO_TREINAMENTO[item.status])
        .sort((a, b) => ACAO_TREINAMENTO[a.status].ordem - ACAO_TREINAMENTO[b.status].ordem);

    const total =
      doFluxoTreinamentos.length +
      deDocumentos.length +
      aFazer.length;

    const atrasadas =
      pendencias.filter(item => item.diasParado >= 7 || prazoVencido(item.prazo)).length +
      aFazer.filter(item => item.status === 'Vencido').length;

    // Nada a fazer: só uma linha discreta (sem colunas vazias).
    if (total === 0 && !erro) {
      return (
        <div
          id="minhas-pendencias"
          style={{
            marginTop: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: '12px',
            border: carregando ? `1px solid ${COR.borda}` : '1px solid #ABEFC6',
            background: carregando ? '#F8FAFC' : '#ECFDF3',
            color: '#067647',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          <span style={carregando ? { color: COR.textoSec, fontWeight: 400 } : undefined}>
            {carregando ? 'Verificando suas pendências...' : '✓ Tudo em dia — nenhuma pendência aguardando você.'}
          </span>

          {
            onRecarregar &&
            (
              <button
                type="button"
                onClick={onRecarregar}
                disabled={carregando}
                style={{ ...botaoLink, opacity: carregando ? 0.5 : 1 }}
              >
                ⟳ Atualizar
              </button>
            )
          }
        </div>
      );
    }

    return (
      <article
        id="minhas-pendencias"
        style={{
          marginTop: '16px',
          background: '#FFFFFF',
          border: `1px solid ${total > 0 ? COR.ciano : COR.borda}`,
          borderLeft: `5px solid ${total > 0 ? COR.ciano : COR.borda}`,
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15, 35, 55, .04)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            background: total > 0 ? COR.ciano10 : '#F8FAFC'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <strong style={{ fontSize: '14px', color: COR.azul }}>
              🔔 Minhas pendências ({total})
            </strong>

            <span style={{ fontSize: '11.5px', color: COR.textoSec }}>
              Tudo o que está aguardando uma ação sua.
            </span>

            {
              atrasadas > 0 &&
              (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#FEF3F2',
                    color: COR.atraso,
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  {atrasadas === 1 ? '1 exige atenção' : `${atrasadas} exigem atenção`}
                </span>
              )
            }

            {
              carregando &&
              (
                <span style={{ fontSize: '11px', color: COR.textoSec }}>
                  atualizando...
                </span>
              )
            }
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {
              onRecarregar &&
              (
                <button
                  type="button"
                  onClick={onRecarregar}
                  disabled={carregando}
                  style={{ ...botaoLink, opacity: carregando ? 0.5 : 1 }}
                >
                  ⟳ Atualizar
                </button>
              )
            }

            <button
              type="button"
              onClick={() => setRecolhido(!recolhido)}
              style={{ ...botaoLink, color: COR.azul }}
            >
              {recolhido ? 'Mostrar ▾' : 'Recolher ▴'}
            </button>
          </span>
        </div>

        {
          erro &&
          (
            <div style={{ padding: '8px 16px', color: COR.atraso, fontSize: '12.5px' }}>
              {erro}
            </div>
          )
        }

        {
          !recolhido &&
          (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
              }}
            >
              {doFluxoTreinamentos.length > 0 && (
              <Grupo
                icone="🎓"
                titulo="Fluxo de treinamentos"
                descricao="Revisões de treinamentos aguardando você: elaborar, revisar ou aprovar."
                quantidade={doFluxoTreinamentos.length}
                vazio={carregando ? 'Carregando...' : 'Nenhuma etapa aguardando você.'}
                rodape={
                  doFluxoTreinamentos.length > 0 && !onAbrirGestao
                    ? (
                      <span style={{ display: 'block', marginTop: '8px', fontSize: '11.5px', color: COR.textoSec }}>
                        Essas etapas são executadas em Treinamentos › Gestão. Se você não vê essa aba,
                        peça acesso ao administrador.
                      </span>
                    )
                    : undefined
                }
              >
                {
                  doFluxoTreinamentos.map(
                    pendencia => (
                      <LinhaPendencia
                        key={pendencia.id}
                        pendencia={pendencia}
                        acao={
                          onAbrirGestao
                            ? (
                              <button
                                type="button"
                                onClick={onAbrirGestao}
                                title="Abrir na Gestão de treinamentos"
                                style={botaoPrimario}
                              >
                                Abrir →
                              </button>
                            )
                            : undefined
                        }
                      />
                    )
                  )
                }
              </Grupo>
              )}

              {deDocumentos.length > 0 && (
              <Grupo
                icone="📄"
                titulo="Documentos"
                descricao="POPs, ITs e demais documentos com etapa aguardando você."
                quantidade={deDocumentos.length}
                vazio={carregando ? 'Carregando...' : 'Nenhum documento aguardando você.'}
              >
                {
                  deDocumentos.map(
                    pendencia => (
                      <LinhaPendencia
                        key={pendencia.id}
                        pendencia={pendencia}
                        acao={
                          onAbrirDocumento
                            ? (
                              <button
                                type="button"
                                onClick={() => onAbrirDocumento(pendencia.documento)}
                                style={botaoPrimario}
                              >
                                Abrir →
                              </button>
                            )
                            : undefined
                        }
                      />
                    )
                  )
                }
              </Grupo>
              )}

              {aFazer.length > 0 && (
              <Grupo
                icone="📚"
                titulo="Treinamentos para realizar"
                descricao="Seus treinamentos vencidos, reprovados, em andamento ou disponíveis."
                quantidade={aFazer.length}
                vazio="Nenhum treinamento pendente. Tudo em dia! 🎉"
                rodape={
                  aFazer.length > LIMITE_POR_GRUPO
                    ? (
                      <button
                        type="button"
                        onClick={onVerTreinamentos}
                        style={{ ...botaoLink, marginTop: '8px' }}
                      >
                        Ver todos ({aFazer.length}) →
                      </button>
                    )
                    : undefined
                }
              >
                {
                  aFazer
                    .slice(0, LIMITE_POR_GRUPO)
                    .map(
                      treinamento => {
                        const info = ACAO_TREINAMENTO[treinamento.status];
                        return (
                          <Linha
                            key={treinamento.usuarioTreinamentoId || treinamento.id}
                            titulo={treinamento.nome}
                            acao={
                              <button
                                type="button"
                                onClick={() => onAbrirTreinamento(treinamento)}
                                style={botaoPrimario}
                              >
                                {info.acao} →
                              </button>
                            }
                          >
                            {treinamento.codigo && <span>{treinamento.codigo}</span>}
                            <StatusDocumentoBadge
                              status={treinamento.status}
                              estiloFixo={ESTILOS_STATUS_TREINAMENTO[treinamento.status]}
                            />
                            {
                              treinamento.status === 'Em andamento' &&
                              <span>{Math.round(treinamento.progresso || 0)}% concluído</span>
                            }
                          </Linha>
                        );
                      }
                    )
                }
              </Grupo>
              )}
            </div>
          )
        }
      </article>
    );
  };

export default MinhasPendenciasTreinamentos;
