import * as React from 'react';
import { ITreinamento } from '../../models/Treinamento';
import TrainingStatus from './TrainingStatus';
import TrainingProgress from './TrainingProgress';

export interface ITrainingCardProps {
  treinamento: ITreinamento;
  onAbrir: (treinamento: ITreinamento) => void;
  className?: string;
}

const TrainingCard: React.FC<ITrainingCardProps> = ({
  treinamento,
  onAbrir,
  className
}) => (
  <article className={className}>
    {treinamento.imagem && (
      <img
        src={treinamento.imagem}
        alt=""
        style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 10 }}
      />
    )}

    <div style={{ paddingTop: 12 }}>
      <TrainingStatus status={treinamento.status} />

      <h3>{treinamento.nome}</h3>
      <p>{treinamento.descricao}</p>

      <div style={{ margin: '12px 0' }}>
        <TrainingProgress progresso={treinamento.progresso} />
      </div>

      <button
        type="button"
        onClick={() => onAbrir(treinamento)}
        disabled={treinamento.status === 'Bloqueado'}
      >
        {treinamento.status === 'Em andamento' ? 'Continuar' : 'Abrir treinamento'}
      </button>
    </div>
  </article>
);

export default TrainingCard;
