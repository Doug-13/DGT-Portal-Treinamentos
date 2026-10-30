import { IResultadoHH } from '../../services/hh/calculoHH';
import { IDadosHH } from '../../services/hh/modeloHH';

// Props comuns das seções do cálculo de HH.
export interface ISecaoHHProps {
  dados: IDadosHH;
  resultado: IResultadoHH;
  editavel: boolean;
  // Alteração imutável dos dados (recalcula na hora).
  mudar: (fn: (d: IDadosHH) => IDadosHH) => void;
}
