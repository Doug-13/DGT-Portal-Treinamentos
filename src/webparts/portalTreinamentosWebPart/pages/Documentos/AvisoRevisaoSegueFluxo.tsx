import * as React from 'react';

// ============================================================
// AVISO NA ABA REVISÃO: esta revisão segue o fluxo do processo.
// Substitui os botões do fluxo fixo antigo.
// ============================================================

export interface IAvisoRevisaoSegueFluxoProps {
  processoNome: string;
  onAbrir: () => void;
}

const AvisoRevisaoSegueFluxo: React.FC<IAvisoRevisaoSegueFluxoProps> = ({
  processoNome,
  onAbrir
}) => (
  <div
    style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
      border: '1px solid #D9D9D6',
      borderLeft: '4px solid #05C3DD',
      borderRadius: '8px',
      padding: '12px 14px',
      fontSize: '13.5px',
      color: '#202A44'
    }}
  >
    <span style={{ flexGrow: 1 }}>
      Esta revisão segue o fluxo do processo
      <strong> {processoNome || 'vinculado'}</strong>.
      As etapas, aprovações e a publicação são feitas na aba “Fluxo de revisão”.
    </span>
    <button
      type="button"
      onClick={onAbrir}
      style={{
        minHeight: '38px',
        padding: '0 16px',
        borderRadius: '6px',
        border: '2px solid #202A44',
        background: '#202A44',
        color: '#FFFFFF',
        fontWeight: 700,
        cursor: 'pointer'
      }}
    >
      Abrir o fluxo
    </button>
  </div>
);

export default AvisoRevisaoSegueFluxo;
