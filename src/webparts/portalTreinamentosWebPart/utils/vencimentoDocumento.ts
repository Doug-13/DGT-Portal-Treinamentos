import {
  IDocumento
} from '../models/Documento';

// ============================================================
// VENCIMENTO DO DOCUMENTO (revisão periódica)
//
// Todo documento deve ser revisado a cada PRAZO_REVISAO_MESES.
//
//   1. Se já houve publicação, vale o prazo gravado na publicação
//      (dgt_prazorevisao, calculado pelo Dataverse a partir da
//      vigência da revisão).
//   2. Senão, vale a data de criação + PRAZO_REVISAO_MESES.
//
// Assim, a cada nova revisão publicada o prazo "recomeça".
// ============================================================

import {
  PERIODICIDADE_REVISAO_MESES
} from '../services/DocumentoRevisaoFluxoService';

export const PRAZO_REVISAO_MESES = PERIODICIDADE_REVISAO_MESES;

export type OrigemVencimento = 'publicacao' | 'criacao';

export interface IVencimentoDocumento {
  data: string;            // AAAA-MM-DD
  origem: OrigemVencimento;
}

const somarMeses = (
  dataIso: string,
  meses: number
): string => {

  const [ano, mes, dia] = dataIso.substring(0, 10).split('-').map(Number);

  const alvo = new Date(ano, mes - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();

  alvo.setDate(Math.min(dia, ultimoDia));

  const mm = ('0' + (alvo.getMonth() + 1)).slice(-2);
  const dd = ('0' + alvo.getDate()).slice(-2);

  return `${alvo.getFullYear()}-${mm}-${dd}`;
};

const dataValida = (
  valor?: string
): boolean =>
  !!valor && /^\d{4}-\d{2}-\d{2}/.test(valor);

export const vencimentoDocumento = (
  documento: Pick<IDocumento, 'prazoRevisao' | 'criadoEm'>
): IVencimentoDocumento | undefined => {

  if (dataValida(documento.prazoRevisao)) {
    return {
      data: (documento.prazoRevisao as string).substring(0, 10),
      origem: 'publicacao'
    };
  }

  if (dataValida(documento.criadoEm)) {
    return {
      data: somarMeses(documento.criadoEm as string, PRAZO_REVISAO_MESES),
      origem: 'criacao'
    };
  }

  return undefined;
};

export const formatarDataCurta = (
  valor?: string
): string =>
  dataValida(valor)
    ? `${(valor as string).substring(8, 10)}/${(valor as string).substring(5, 7)}/${(valor as string).substring(0, 4)}`
    : '-';
