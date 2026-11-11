import * as React from 'react';

import {
  IPedidoAssinatura
} from '../../services/assinatura/controleAssinatura';

import {
  IConfigAssinatura,
  NOME_SITUACAO
} from '../../services/fluxo/assinaturaFluxo';

// ============================================================
// ASSINATURA DIGITAL — acompanhamento na etapa
// ============================================================

export interface IPainelAssinaturaProps {
  nomeEtapa: string;
  pedido?: IPedidoAssinatura;
  config?: IConfigAssinatura;
  erros: string[];
  processando: boolean;
  podeAdministrar: boolean;
  onConferir: () => void;
  onReenviar?: () => void;
  // Administrador: libera o fluxo sem a assinatura (motivo obrigatório).
  onLiberar?: (motivo: string) => void;
}

const COR = { azul: '#202A44', texto2: '#64748B', borda: '#E5E7EB', verde: '#107C10', ambar: '#B45309', vermelho: '#B42318' };

const corSituacao = (situacao?: string): string =>
  situacao === 'assinado' ? COR.verde : situacao === 'erro' || situacao === 'recusado' || situacao === 'expirado' ? COR.vermelho : COR.ambar;

const dataHora = (valor?: string): string => {
  if (!valor) {
    return '';
  }
  const data = new Date(valor);
  return isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const botao = (principal: boolean, desabilitado: boolean, perigo = false): React.CSSProperties => ({
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${perigo ? COR.vermelho : COR.borda}`,
  background: principal ? '#0877c9' : '#FFFFFF',
  color: principal ? '#FFFFFF' : perigo ? COR.vermelho : COR.azul,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.6 : 1
});

const PainelAssinatura: React.FC<IPainelAssinaturaProps> = (props) => {

  const { pedido, config } = props;
  const situacao = pedido ? pedido.situacao : undefined;

  return (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '14px 16px', background: '#FFFFFF', color: COR.azul, fontSize: '13px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <strong style={{ fontSize: '14px', flex: 1 }}>✍ {props.nomeEtapa}</strong>
        {situacao && (
          <span style={{ padding: '3px 10px', borderRadius: '999px', fontWeight: 800, fontSize: '12px', color: corSituacao(situacao), background: '#F7F9FB', border: `1px solid ${corSituacao(situacao)}` }}>
            {NOME_SITUACAO[situacao] || situacao}
          </span>
        )}
      </div>

      <div style={{ color: COR.texto2, fontSize: '12.5px', marginBottom: '8px' }}>
        O fluxo segue quando o documento estiver assinado
        {config && config.campoSituacao ? ' (recusa, expiração ou cancelamento também seguem, para a decisão seguinte)' : ''}.
        O envio e o retorno são feitos pelo Power Automate{config ? ` (${config.provedor === 'clicksign' ? 'Clicksign' : config.provedor})` : ''}.
      </div>

      {props.erros.length > 0 && (
        <div style={{ background: '#FDE7E9', color: '#8A1C14', borderRadius: '6px', padding: '8px 10px', marginBottom: '8px' }}>
          {props.erros.map(item => <div key={item}>• {item}</div>)}
        </div>
      )}

      {!pedido && props.erros.length === 0 && <div style={{ color: COR.texto2 }}>Registrando o pedido de assinatura...</div>}

      {pedido && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 12px', marginBottom: '8px' }}>
            {pedido.signatarios.map(item => (
              <React.Fragment key={item.email}>
                <span>
                  {pedido.ordemSequencial ? `${item.ordem}. ` : ''}<strong>{item.nome}</strong>
                  <span style={{ color: COR.texto2 }}> · {item.papel === 'assinar' ? 'assina' : item.papel === 'aprovar' ? 'aprova' : 'testemunha'}</span>
                </span>
                <span style={{ color: item.assinadoEm ? COR.verde : COR.texto2, whiteSpace: 'nowrap' }}>
                  {item.assinadoEm ? `✓ ${dataHora(item.assinadoEm)}` : (item.situacao || 'aguardando')}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: COR.texto2, lineHeight: '18px' }}>
            Arquivo(s): {pedido.arquivos.map(item => item.nome).join(', ') || '—'}
            {pedido.prazo && <> · prazo {dataHora(pedido.prazo)}</>}
          </div>
          {pedido.linkAcompanhamento && (
            <div style={{ marginTop: '4px' }}><a href={pedido.linkAcompanhamento} target="_blank" rel="noopener noreferrer">Acompanhar no provedor</a></div>
          )}
          {pedido.arquivoAssinado && (
            <div style={{ marginTop: '4px' }}><a href={pedido.arquivoAssinado} target="_blank" rel="noopener noreferrer">Abrir o arquivo assinado</a></div>
          )}
          {pedido.situacao === 'erro' && pedido.erro && (
            <div style={{ marginTop: '6px', color: COR.vermelho }}>Erro no envio: {pedido.erro}</div>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <button type="button" disabled={props.processando} onClick={props.onConferir} style={botao(true, props.processando)}>
          {props.processando ? 'Conferindo...' : 'Conferir agora'}
        </button>
        {pedido && pedido.situacao === 'erro' && props.onReenviar && (
          <button type="button" disabled={props.processando} onClick={props.onReenviar} style={botao(false, props.processando)}>Reenviar</button>
        )}
        {props.podeAdministrar && props.onLiberar && (
          <button
            type="button"
            disabled={props.processando}
            onClick={() => {
              const motivo = window.prompt('Liberar o fluxo SEM a assinatura. Informe o motivo (fica no histórico):', '');
              if (motivo && motivo.trim().length >= 5 && props.onLiberar) {
                props.onLiberar(motivo.trim());
              } else if (motivo !== null) {
                window.alert('Informe um motivo com pelo menos 5 caracteres.');
              }
            }}
            style={botao(false, props.processando, true)}
          >
            Liberar sem assinatura
          </button>
        )}
      </div>
    </div>
  );
};

export default PainelAssinatura;
