import * as React from 'react';
import { StatusTreinamento } from '../../models/Treinamento';

export interface ITrainingStatusProps {
  status: StatusTreinamento;
  className?: string;
}

const TrainingStatus: React.FC<ITrainingStatusProps> = ({ status, className }) => (
  <span className={className} data-status={status}>
    {status}
  </span>
);

export default TrainingStatus;
