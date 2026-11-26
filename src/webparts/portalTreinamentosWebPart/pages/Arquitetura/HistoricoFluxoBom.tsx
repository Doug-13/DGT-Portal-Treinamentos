import * as React from 'react';

import {
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  COR,
  cartao,
  formatarData,
  formatarDataHora
} from './arquiteturaComum';

// ============================================================
// HISTÓRICO DO B.O.M. (fluxo ARQ-SOL)
//
// Sempre visível na tela do B.O.M., do mais recente para o mais
// antigo: ações e decisões (com quem e quando), comentários,
// mudanças de etapa e os responsáveis e o prazo de cada etapa
// iniciada. Lê o estado do fluxo; nada é apagado.
// ============================================================

interface IEventoHistorico {
  id: string;
  data: string;
  etapa: string;
  evento: string;
  por: string;
  detalhe?: string;
  comentario?: string;
  tipo: 'acao' | 'devolucao' | 'etapa' | 'sistema';
}

export interface IHistoricoFluxoBomProps {
  instancia: IFluxoInstancia;
}

const ESTILO_TIPO: Record<IEventoHistorico['tipo'], { cor: string; fundo: string; rotulo: string }> = {
  acao: { cor: '#0E7C56', fundo: '#E7F6EC', rotulo: 'Ação' },
  devolucao: { cor: '#B42318', fundo: '#FDE7E9', rotulo: 'Devolução' },
  etapa: { cor: '#0F6CBD', fundo: '#E8F2FF', rotulo: 'Etapa' },
  sistema: { cor: '#6B7280', fundo: '#F1F5F9', rotulo: 'Sistema' }
};

const HistoricoFluxoBom: React.FC<IHistoricoFluxoBomProps> = ({ instancia }) => {

  const eventos: IEventoHistorico[] = [];

  instancia.historico.forEach(passo => {
    const devolucao = /devol|reprov|ajust|voltar|refazer|reabrir|reavaliar/i.test(`${passo.resultado} ${passo.acaoChave} ${passo.acaoRotulo}`);
    eventos.push({
      id: passo.id,
      data: passo.data,
      etapa: passo.elementoNome,
      evento: passo.acaoRotulo,
      por: passo.sistema ? 'Sistema' : passo.executadoPorNome || '—',
      comentario: passo.comentario,
      tipo: passo.sistema ? 'sistema' : devolucao ? 'devolucao' : 'acao'
    });
  });

  instancia.tarefas.forEach(tarefa => {
    const responsaveis = (tarefa.responsaveisResolvidos || []).map(item => item.descricao).filter(item => !!item);
    eventos.push({
      id: `t-${tarefa.id}`,
      data: tarefa.criadaEm,
      etapa: tarefa.elementoNome,
      evento: tarefa.status === 'cancelada' ? 'Etapa iniciada (depois cancelada)' : 'Etapa iniciada',
      por: '—',
      detalhe: [
        responsaveis.length > 0 ? `Responsáveis: ${responsaveis.join(', ')}` : '',
        tarefa.prazo ? `Prazo: ${formatarData(tarefa.prazo.substring(0, 10))}` : '',
        tarefa.status === 'concluida' && tarefa.concluidaEm
          ? `Concluída em ${formatarDataHora(tarefa.concluidaEm)}${tarefa.concluidaPorNome ? ` por ${tarefa.concluidaPorNome}` : ''}`
          : tarefa.status === 'pendente' ? 'Em andamento' : ''
      ].filter(item => !!item).join(' · '),
      tipo: 'etapa'
    });
  });

  eventos.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  return (
    <div style={{ ...cartao, marginTop: '18px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: COR.azul }}>Histórico do B.O.M.</h3>
      <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: COR.texto2 }}>
        Ações, decisões, comentários, etapas e responsáveis do fluxo — do mais recente para o mais antigo. Versão do fluxo: v{instancia.fluxoVersao}.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
          <thead>
            <tr>
              {['Data e hora', 'Etapa', 'Registro', 'Por', 'Comentário / detalhes'].map(coluna => (
                <th key={coluna} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', color: COR.texto2, background: '#F8FAFC', borderBottom: `1px solid ${COR.borda}` }}>{coluna}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '12px', fontSize: '13px', color: COR.texto2 }}>Nenhum registro ainda.</td></tr>
            )}
            {eventos.map(item => {
              const estilo = ESTILO_TIPO[item.tipo];
              return (
                <tr key={item.id}>
                  <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '12.5px', color: COR.texto2, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{formatarDataHora(item.data)}</td>
                  <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px', color: COR.azul, verticalAlign: 'top' }}>{item.etapa}</td>
                  <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px', verticalAlign: 'top' }}>
                    <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: estilo.cor, background: estilo.fundo, borderRadius: '999px', padding: '1px 8px', marginRight: '6px' }}>{estilo.rotulo}</span>
                    <span style={{ fontWeight: 700, color: item.tipo === 'devolucao' ? estilo.cor : COR.azul }}>{item.evento}</span>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px', color: COR.azul, verticalAlign: 'top' }}>{item.por}</td>
                  <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px', color: COR.azul, verticalAlign: 'top', whiteSpace: 'pre-line' }}>
                    {item.comentario || ''}
                    {item.detalhe && <div style={{ fontSize: '12px', color: COR.texto2, marginTop: item.comentario ? '3px' : 0 }}>{item.detalhe}</div>}
                    {!item.comentario && !item.detalhe && <span style={{ color: COR.texto2 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoricoFluxoBom;
