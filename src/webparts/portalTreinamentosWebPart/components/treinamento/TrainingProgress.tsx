import * as React from 'react';

export interface ITrainingProgressProps {
  progresso: number;
  mostrarTexto?: boolean;
  className?: string;
}

const limitar = (valor: number): number =>
  Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 0));

const TrainingProgress: React.FC<ITrainingProgressProps> = ({
  progresso,
  mostrarTexto = true,
  className
}) => {
  const valor = limitar(progresso);

  return (
    <div className={className}>
      {mostrarTexto && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Progresso</span>
          <strong>{valor}%</strong>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valor}
        style={{ height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${valor}%`,
            height: '100%',
            background: 'currentColor',
            transition: 'width .2s ease'
          }}
        />
      </div>
    </div>
  );
};

export default TrainingProgress;
