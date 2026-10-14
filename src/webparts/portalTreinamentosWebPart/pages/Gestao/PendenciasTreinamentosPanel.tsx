import * as React from 'react';

import {
  IPendenciaDocumento
} from '../../hooks/useDocumentosPendencias';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IControleTreinamento
} from '../../services/TreinamentoDocumentoControleService';

// ============================================================
// GESTÃO DE TREINAMENTOS — "Fluxo de revisão dos treinamentos"
//
//   Aguardando você → etapas do fluxo (TRE-001) em que o usuário é
//                     o responsável (ou revisões que ele elabora).
//   Em revisão      → todos os treinamentos com revisão em andamento,
//                     para acompanhar e analisar.
// ============================================================

export interface IPendenciasTreinamentosPanelProps {
  treinamentos: ITreinamentoAdmin[];

  // treinamentoId → documento de controle
  controles: Record<string, IControleTreinamento>;

  pendencias: IPendenciaDocumento[];
  carregando: boolean;
  erro: string;

  onAnalisar: (treinamento: ITreinamentoAdmin) => void;
  onRecarregar?: () => void;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  ciano10: '#E6F9FC',
  azul10: '#EDF0F5',
  indigo10: '#E8EAF8',
  borda: '#E2E8F0',
  textoSec: '#64748B',
  atraso: '#B42318',
  atencao: '#B45309'
};

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const dataBr = (valor?: string): string => {
  if (!valor) {
    return '';
  }
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
};

const atrasado = (prazo?: string): boolean => {
  if (!prazo) {
    return false;
  }
  const d = new Date(prazo.length === 10 ? `${prazo}T23:59:59` : prazo);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
};

const textoIdade = (dias: number): string =>
  dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`;

const ROTULO_TIPO: Record<string, string> = {
  fluxo: 'Etapa do fluxo',
  elaborar: 'Elaboração',
  aprovar: 'Aprovação'
};

const LIMITE_EM_REVISAO = 6;

const botaoAnalisar: React.CSSProperties = {
  border: `1px solid ${COR.azul}`,
  background: COR.azul,
  color: '#FFFFFF',
  borderRadius: '8px',
  padding: '6px 12px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit'
};

const PendenciasTreinamentosPanel: React.FC<IPendenciasTreinamentosPanelProps> = ({
  treinamentos,
  controles,
  pendencias,
  carregando,
  erro,
  onAnalisar,
  onRecarregar
}) => {

  const [verTodos, setVerTodos] =
    React.useState(false);

  // documentoId → treinamento
  const porDocumento =
    React.useMemo(
      () => {
        const mapa: Record<string, ITreinamentoAdmin> = {};
        treinamentos.forEach(treinamento => {
          const controle = controles[guid(treinamento.id)];
          if (controle) {
            mapa[guid(controle.documentoId)] = treinamento;
          }
        });
        return mapa;
      },
      [treinamentos, controles]
    );

  const minhas =
    pendencias
      .map(pendencia => ({
        pendencia,
        treinamento: porDocumento[guid(pendencia.documento.id)]
      }))
      .filter(item => !!item.treinamento) as Array<{ pendencia: IPendenciaDocumento; treinamento: ITreinamentoAdmin }>;

  const emRevisao =
    treinamentos
      .map(treinamento => ({ treinamento, controle: controles[guid(treinamento.id)] }))
      .filter(item => !!item.controle && !!item.controle.revisaoEmAndamento)
      .sort((a, b) => a.treinamento.codigo.localeCompare(b.treinamento.codigo));

  const emRevisaoVisiveis =
    verTodos ? emRevisao : emRevisao.slice(0, LIMITE_EM_REVISAO);

  const atrasadas =
    minhas.filter(item => atrasado(item.pendencia.prazo)).length;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${COR.borda}`,
        borderLeft: `4px solid ${COR.ciano}`,
        borderRadius: '12px',
        padding: '18px 20px',
        marginBottom: '22px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, color: COR.azul, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '.03em' }}>
            Fluxo de revisão dos treinamentos
          </h3>
          <div style={{ color: COR.textoSec, fontSize: '13px', marginTop: '4px' }}>
            Criação e revisões de treinamentos seguem o processo de treinamentos: etapas, responsáveis e prazos.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ background: COR.ciano10, color: COR.azul, borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>
            {minhas.length} aguardando você
          </span>
          {atrasadas > 0 && (
            <span style={{ background: '#FDECEC', color: COR.atraso, borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>
              {atrasadas} com prazo vencido
            </span>
          )}
          <span style={{ background: COR.indigo10, color: COR.indigo, borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>
            {emRevisao.length} em revisão
          </span>
          {onRecarregar && (
            <button
              type="button"
              onClick={onRecarregar}
              disabled={carregando}
              style={{ ...botaoAnalisar, background: '#FFFFFF', color: COR.azul, opacity: carregando ? 0.5 : 1 }}
            >
              {carregando ? 'Atualizando...' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div style={{ marginTop: '12px', color: COR.atraso, fontSize: '13px' }}>{erro}</div>
      )}

      {/* -------------------------------- aguardando você */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ fontWeight: 700, color: COR.azul, fontSize: '13px', marginBottom: '8px' }}>
          Aguardando você
        </div>

        {carregando && minhas.length === 0 && (
          <div style={{ color: COR.textoSec, fontSize: '13px' }}>Carregando suas pendências...</div>
        )}

        {!carregando && minhas.length === 0 && (
          <div style={{ color: COR.textoSec, fontSize: '13px' }}>
            Nenhuma etapa aguardando você.
          </div>
        )}

        {minhas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {minhas.map(({ pendencia, treinamento }) => {
              const vencido = atrasado(pendencia.prazo);
              return (
                <div
                  key={pendencia.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: COR.azul10
                  }}
                >
                  <div style={{ minWidth: '220px', flex: 1 }}>
                    <div style={{ fontWeight: 700, color: COR.azul }}>
                      {treinamento.codigo} — {treinamento.nome}
                    </div>
                    <div style={{ fontSize: '12px', color: COR.textoSec, marginTop: '2px' }}>
                      {ROTULO_TIPO[pendencia.tipo] || 'Pendência'}: <strong>{pendencia.etapa || pendencia.status}</strong>
                      {' · '}{pendencia.revisao}
                      {' · '}{textoIdade(pendencia.diasParado)}
                    </div>
                  </div>

                  {pendencia.prazo && (
                    <div style={{ fontSize: '12px', fontWeight: 700, color: vencido ? COR.atraso : pendencia.diasParado >= 7 ? COR.atencao : COR.textoSec }}>
                      {vencido ? 'Prazo vencido em ' : 'Prazo: '}{dataBr(pendencia.prazo)}
                    </div>
                  )}

                  <button type="button" style={botaoAnalisar} onClick={() => onAnalisar(treinamento)}>
                    Analisar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -------------------------------- em revisão (todos) */}
      {emRevisao.length > 0 && (
        <div style={{ marginTop: '18px' }}>
          <div style={{ fontWeight: 700, color: COR.azul, fontSize: '13px', marginBottom: '8px' }}>
            Treinamentos em revisão
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                {emRevisaoVisiveis.map(({ treinamento, controle }) => (
                  <tr key={treinamento.id} style={{ borderTop: `1px solid ${COR.borda}` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700, color: COR.azul, whiteSpace: 'nowrap' }}>
                      {treinamento.codigo}
                    </td>
                    <td style={{ padding: '8px 6px' }}>{treinamento.nome}</td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                      <span style={{ background: '#FFF4E5', color: COR.atencao, borderRadius: '20px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>
                        {controle.revisaoEmAndamento ? `${controle.revisaoEmAndamento.revisao} em ${controle.revisaoEmAndamento.status || 'Elaboração'}` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', color: COR.textoSec, whiteSpace: 'nowrap' }}>
                      {controle.revisaoVigente ? `Vigente: ${controle.revisaoVigente}` : 'Ainda não publicado'}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <button
                        type="button"
                        style={{ ...botaoAnalisar, background: '#FFFFFF', color: COR.azul }}
                        onClick={() => onAnalisar(treinamento)}
                      >
                        Analisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {emRevisao.length > LIMITE_EM_REVISAO && (
            <button
              type="button"
              onClick={() => setVerTodos(!verTodos)}
              style={{ marginTop: '8px', border: 'none', background: 'transparent', color: COR.indigo, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              {verTodos ? 'Mostrar menos' : `Ver todos (${emRevisao.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PendenciasTreinamentosPanel;
