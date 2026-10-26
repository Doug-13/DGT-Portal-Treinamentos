import * as React from 'react';

import {
  MOTIVO_DEVOLUCAO_MINIMO
} from '../../services/orcamento/esquemaOrcamento';

import {
  COR,
  FONTE,
  botao,
  campo
} from './orcamentoComum';

// ============================================================
// DEVOLVER PARA AJUSTE (Administrador)
//
// O motivo é obrigatório: ele aparece para o gestor como pendência
// de ajuste na tela do orçamento e fica no histórico da planilha.
// ============================================================

export interface IDevolverPlanilhaModalProps {
  gestorNome: string;
  ano: number;
  enviando: boolean;
  erro: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}

const DevolverPlanilhaModal: React.FC<IDevolverPlanilhaModalProps> = (props) => {

  const [motivo, setMotivo] = React.useState('');
  const [tentou, setTentou] = React.useState(false);

  const { onCancelar, enviando } = props;

  React.useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape' && !enviando) {
        onCancelar();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onCancelar, enviando]);

  const tamanho = motivo.trim().length;
  const valido = tamanho >= MOTIVO_DEVOLUCAO_MINIMO;

  const confirmar = (): void => {
    setTentou(true);
    if (valido && !props.enviando) {
      props.onConfirmar(motivo.trim());
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Devolver planilha para ajuste"
      onClick={() => { if (!props.enviando) { props.onCancelar(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, .45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: FONTE
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 20px 50px rgba(15,23,42,.25)'
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${COR.borda}` }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: COR.azul }}>
            Devolver para ajuste
          </div>
          <div style={{ fontSize: '13px', color: COR.texto2, marginTop: '4px' }}>
            A planilha de <strong>{props.ano}</strong> volta para <strong>{props.gestorNome}</strong>, que poderá(ão) editá-la e reenviar. O motivo aparece como pendência de ajuste.
          </div>
        </div>

        <div style={{ padding: '16px 22px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: COR.azul, marginBottom: '6px' }}>
            Motivo da devolução <span style={{ color: COR.perigo }}>*</span>
          </label>
          <textarea
            autoFocus
            rows={5}
            maxLength={4000}
            value={motivo}
            onChange={evento => setMotivo(evento.target.value)}
            placeholder="Ex.: Os valores de Viagens e estadias estão acima do teto aprovado para 2027. Revise e detalhe as contas de despesas com veículos."
            aria-label="Motivo da devolução"
            aria-invalid={tentou && !valido}
            style={{
              ...campo,
              resize: 'vertical',
              minHeight: '110px',
              borderColor: tentou && !valido ? COR.perigo : COR.borda
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px' }}>
            <span style={{ color: tentou && !valido ? COR.perigo : COR.texto2 }}>
              {tentou && !valido
                ? `O motivo é obrigatório (mínimo de ${MOTIVO_DEVOLUCAO_MINIMO} caracteres).`
                : 'Obrigatório. Seja específico: o gestor vai ajustar com base neste texto.'}
            </span>
            <span style={{ color: COR.texto2 }}>{motivo.length}/4000</span>
          </div>

          {props.erro && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: '#FDE7E9', color: COR.perigo, fontSize: '13px' }}>
              {props.erro}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: `1px solid ${COR.borda}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={props.onCancelar} disabled={props.enviando} style={botao('secundario', props.enviando)}>
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={props.enviando} style={botao('perigo', props.enviando)}>
            {props.enviando ? 'Devolvendo...' : 'Devolver para ajuste'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevolverPlanilhaModal;
