import {
  DataverseService
} from '../../../services/DataverseService';

// Contrato dos componentes NATIVOS do campo "Componente".
export interface IPropsComponenteNativo {
  // Envelope gravado (JSON) — ver services/fluxo/valorComponente.ts.
  valor: string;
  // Recebe o NOVO envelope (JSON).
  onAlterar: (valor: string) => void;
  somenteLeitura: boolean;
  parametros?: Record<string, string>;
  // Valores dos outros campos do registro/documento.
  valoresRegistro?: Record<string, string>;
  dataverseService?: DataverseService;
}
