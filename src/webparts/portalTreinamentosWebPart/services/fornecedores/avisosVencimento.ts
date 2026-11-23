import {
  DIAS_AVISO_VENCIMENTO,
  IDocumentoColaborador,
  IDocumentoFornecedor,
  StatusFornecedor
} from './modeloFornecedores';

import {
  diasAte
} from './situacaoDocumental';

// ============================================================
// FORNECEDORES — AVISO DE VENCIMENTO AO FORNECEDOR (regra pura)
//
// O envio é do Power Automate (docs/fornecedores.md, D3/E1); estas
// funções são a MESMA regra, escrita aqui para ficar testada e
// documentada num lugar só:
//   • só documentos MANUAIS: o plugin grava "… (automático)" em
//     dgt_responsavelnome ao emitir certidão — esses a DGT renova
//     sozinha. CND estadual/municipal enviada à mão (sem rota) ENTRA;
//   • Vigente, vencendo entre hoje e hoje + 15 dias;
//   • documentos de colaboradores ATIVOS (ASO e NRs) também;
//   • só fornecedores Homologado ou Em homologação;
//   • um aviso por documento: dgt_avisovencimentoem preenchido = já
//     avisado (documento renovado é um registro novo, sem a data).
// ============================================================

export const MARCA_AUTOMATICO = '(automático)';

export const STATUS_COM_AVISO: StatusFornecedor[] = ['Homologado', 'Em homologação'];

export const ehDocumentoAutomatico = (registradoPor: string): boolean =>
  (registradoPor || '').trim().toLowerCase().endsWith(MARCA_AUTOMATICO);

const venceNaJanela = (vencimento: string, hoje: Date, antecedencia: number): boolean => {
  const dias = diasAte(vencimento, hoje);
  return dias !== undefined && dias >= 0 && dias <= antecedencia;
};

export const documentoNoAvisoAoFornecedor = (
  doc: Pick<IDocumentoFornecedor, 'situacao' | 'vencimento' | 'registradoPor'> & { avisoVencimentoEm?: string },
  hoje: Date = new Date(),
  antecedencia: number = DIAS_AVISO_VENCIMENTO
): boolean =>
  doc.situacao === 'Vigente' &&
  !ehDocumentoAutomatico(doc.registradoPor) &&
  !doc.avisoVencimentoEm &&
  venceNaJanela(doc.vencimento, hoje, antecedencia);

export const documentoColaboradorNoAviso = (
  doc: Pick<IDocumentoColaborador, 'situacao' | 'vencimento'> & { avisoVencimentoEm?: string },
  colaboradorAtivo: boolean,
  hoje: Date = new Date(),
  antecedencia: number = DIAS_AVISO_VENCIMENTO
): boolean =>
  colaboradorAtivo &&
  doc.situacao === 'Vigente' &&
  !doc.avisoVencimentoEm &&
  venceNaJanela(doc.vencimento, hoje, antecedencia);

export const fornecedorRecebeAviso = (status: StatusFornecedor): boolean =>
  STATUS_COM_AVISO.indexOf(status) >= 0;
