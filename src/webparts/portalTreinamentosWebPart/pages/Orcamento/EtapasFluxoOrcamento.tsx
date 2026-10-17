import * as React from 'react';

import {
  IFluxoDefinicao,
  IFluxoElemento
} from '../../models/Fluxo';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  tarefaPendente
} from '../../services/fluxo/FluxoEngine';

import {
  IDadosRevisaoResponsaveis,
  descreverResolvido,
  resolverResponsaveis
} from '../../services/fluxo/ResolvedorResponsaveis';

import {
  IEstadoFluxoPlanilha
} from '../../services/orcamento/OrcamentoFluxoService';

import {
  situacaoDoFluxo,
  ultimoPassoHumano
} from '../../services/orcamento/situacaoFluxoOrcamento';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import {
  COR,
  FONTE,
  SeloPrazo,
  cartao,
  formatarDataHora
} from './orcamentoComum';

// ============================================================
// ETAPAS DO FLUXO DE APROVAÇÃO (visão rápida)
//
// Faixa horizontal com as etapas do processo CONT-001, na ordem do
// caminho principal (ex.: Preenchimento → Diretor da Área →
// Controladoria → Diretoria Financeira → Aprovado):
//   ✓ concluída (quem concluiu e quando)
//   ● etapa atual (responsável e prazo)
//   ○ próximas etapas (responsável e prazo previsto)
// Na devolução, a etapa que reprovou fica marcada.
// ============================================================

export interface IEtapasFluxoOrcamentoProps {
  estado: IEstadoFluxoPlanilha;
  dadosResponsaveis: IDadosRevisaoResponsaveis;
  vinculos: IUsuarioAreaAdmin[];
  usuarios: Array<{ id: string; nome: string }>;
  // Botão "Ver desenho, ações e histórico".
  onVerDetalhes?: () => void;
}

type SituacaoEtapa = 'concluida' | 'atual' | 'pendente';

// Etapas com responsável na ordem do caminho principal (sem as setas
// de reprovação).
export const etapasEmOrdem = (
  definicao: IFluxoDefinicao
): IFluxoElemento[] => {

  const inicio = definicao.elementos.filter(item => item.tipo === 'inicio')[0];

  if (!inicio) {
    return [];
  }

  const visitados: string[] = [];
  const etapas: IFluxoElemento[] = [];
  const fila: string[] = [inicio.id];

  while (fila.length > 0) {
    const atual = fila.shift() as string;
    if (visitados.indexOf(atual) >= 0) {
      continue;
    }
    visitados.push(atual);
    const elemento = definicao.elementos.filter(item => item.id === atual)[0];
    if (elemento && elemento.tipo === 'tarefaHumana') {
      etapas.push(elemento);
    }
    definicao.transicoes
      .filter(transicao => transicao.origemId === atual && !transicao.excecao)
      .forEach(transicao => fila.push(transicao.destinoId));
  }

  return etapas;
};

const CORES: { [situacao: string]: { circulo: string; texto: string; borda: string; fundo: string } } = {
  concluida: { circulo: COR.azul, texto: '#FFFFFF', borda: COR.azul, fundo: '#F1F5F9' },
  atual: { circulo: COR.ciano, texto: COR.azul, borda: COR.ciano, fundo: '#F0FCFE' },
  pendente: { circulo: '#FFFFFF', texto: COR.texto2, borda: '#CBD5E1', fundo: '#FFFFFF' }
};

const EtapasFluxoOrcamento: React.FC<IEtapasFluxoOrcamentoProps> = (props) => {

  const { instancia, definicao } = props.estado;

  const etapas = etapasEmOrdem(definicao);
  const concluido = instancia.status === 'concluido';
  const indiceAtual = etapas.map(item => item.id).indexOf(instancia.elementoAtualId);
  const tarefa = tarefaPendente(instancia);
  const situacaoPlanilha = situacaoDoFluxo(instancia, definicao);
  const ultimo = ultimoPassoHumano(instancia);
  const devolvida = situacaoPlanilha === 'Devolvida para ajuste';

  const situacaoDaEtapa = (indice: number): SituacaoEtapa => {
    if (concluido) {
      return 'concluida';
    }
    if (indiceAtual < 0) {
      return 'pendente';
    }
    return indice < indiceAtual ? 'concluida' : indice === indiceAtual ? 'atual' : 'pendente';
  };

  // Último passo de cada etapa (histórico: mais recente primeiro).
  const ultimoNaEtapa = (elementoId: string): typeof instancia.historico[0] | undefined =>
    instancia.historico.filter(passo => passo.elementoId === elementoId && !passo.sistema && passo.acaoChave !== 'iniciar')[0];

  const responsaveisDe = (elemento: IFluxoElemento, atual: boolean): string => {
    const resolvidos =
      atual && tarefa && tarefa.responsaveisResolvidos
        ? tarefa.responsaveisResolvidos
        : resolverResponsaveis(elemento.responsaveis, props.dadosResponsaveis);
    return resolvidos
      .map(item => descreverResolvido(item, props.vinculos, props.usuarios))
      .filter((texto, indice, lista) => !!texto && lista.indexOf(texto) === indice)
      .join(' · ') || 'Responsável não configurado';
  };

  if (etapas.length === 0) {
    return null;
  }

  return (
    <div style={{ ...cartao, fontFamily: FONTE }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Etapas da aprovação · {instancia.processoNome || definicao.nome} · v{definicao.versao}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: COR.azul, marginTop: '2px' }}>
            {concluido
              ? '✓ Todas as etapas concluídas — orçamento aprovado'
              : devolvida
                ? `Devolvida para ajuste${ultimo ? ` por ${ultimo.elementoNome}` : ''}`
                : `Etapa ${Math.max(indiceAtual, 0) + 1} de ${etapas.length}: ${indiceAtual >= 0 ? etapas[indiceAtual].nome : '—'}`}
          </div>
        </div>
        {props.onVerDetalhes && (
          <button
            type="button"
            onClick={props.onVerDetalhes}
            style={{ border: `1px solid ${COR.borda}`, background: '#FFFFFF', borderRadius: '6px', padding: '6px 12px', fontSize: '12.5px', fontWeight: 700, color: COR.azulAcao, cursor: 'pointer', fontFamily: FONTE }}
          >
            Ver desenho, ações e histórico ↓
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', overflowX: 'auto', paddingBottom: '4px' }}>
        {etapas.map((elemento, indice) => {
          const situacao = situacaoDaEtapa(indice);
          const cores = CORES[situacao];
          const passo = ultimoNaEtapa(elemento.id);
          const reprovou = devolvida && !!ultimo && ultimo.elementoId === elemento.id;
          const atual = situacao === 'atual';
          return (
            <React.Fragment key={elemento.id}>
              <div
                style={{
                  flex: '1 1 0',
                  minWidth: '180px',
                  border: `2px solid ${reprovou ? COR.perigo : cores.borda}`,
                  borderRadius: '10px',
                  background: reprovou ? '#FFF5F5' : cores.fundo,
                  padding: '10px 12px',
                  boxShadow: atual ? '0 0 0 3px rgba(5,195,221,.2)' : undefined
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      flexShrink: 0,
                      borderRadius: '999px',
                      border: `2px solid ${cores.borda}`,
                      background: cores.circulo,
                      color: cores.texto,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                  >
                    {situacao === 'concluida' ? '✓' : indice + 1}
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: COR.azul, lineHeight: 1.2 }}>{elemento.nome}</span>
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '.3px', color: reprovou ? COR.perigo : atual ? '#00707F' : COR.texto2 }}>
                  {reprovou
                    ? 'Reprovou'
                    : atual
                      ? (indice === 0 && devolvida ? 'Em ajuste' : 'Etapa atual')
                      : situacao === 'concluida' ? 'Concluída' : 'Próxima'}
                </div>

                <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '3px' }}>
                  {responsaveisDe(elemento, atual)}
                </div>

                {situacao === 'concluida' && passo && (
                  <div style={{ fontSize: '12px', color: COR.azul, marginTop: '4px' }}>
                    {passo.acaoRotulo} por {passo.executadoPorNome || '—'} em {formatarDataHora(passo.data)}
                  </div>
                )}

                {reprovou && ultimo && ultimo.comentario && (
                  <div style={{ fontSize: '12px', color: COR.perigo, marginTop: '4px', whiteSpace: 'pre-line' }}>
                    “{ultimo.comentario}”
                  </div>
                )}

                {atual && tarefa && tarefa.prazo ? (
                  <div style={{ marginTop: '6px' }}>
                    <SeloPrazo prazo={tarefa.prazo} situacao={situacaoPrazo(tarefa.prazo, tarefa.criadaEm)} />
                  </div>
                ) : situacao === 'pendente' && elemento.prazoDiasUteis ? (
                  <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '4px' }}>
                    Prazo: {elemento.prazoDiasUteis} dia(s) útil(eis)
                  </div>
                ) : null}
              </div>

              <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', padding: '0 6px', color: '#94A3B8', fontSize: '18px', flexShrink: 0 }}>
                →
              </div>
            </React.Fragment>
          );
        })}

        {/* Fim */}
        <div
          style={{
            flex: '0 0 auto',
            minWidth: '110px',
            border: `2px solid ${concluido ? '#107C10' : '#CBD5E1'}`,
            borderRadius: '10px',
            background: concluido ? '#E7F6EC' : '#FFFFFF',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span style={{ fontSize: '18px', color: concluido ? '#107C10' : '#94A3B8' }}>{concluido ? '✓' : '○'}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: concluido ? '#107C10' : COR.texto2 }}>Aprovado</span>
          {concluido && instancia.concluidoEm && (
            <span style={{ fontSize: '11px', color: COR.texto2 }}>{formatarDataHora(instancia.concluidoEm)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EtapasFluxoOrcamento;
