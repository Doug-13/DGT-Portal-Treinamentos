// ============================================================
// PROCESSOS
//
// IProcesso                 → dgt_processo
// IDocumentoProcessoVinculo → dgt_documentoprocesso
//
// origem:
//   'dataverse' = registro lido do Dataverse (somente leitura aqui)
//   'teste'     = registro criado no modo de teste, salvo apenas
//                 no navegador (localStorage)
// ============================================================

export type OrigemRegistroProcesso =
  | 'dataverse'
  | 'teste';

export interface IProcesso {
  id: string;

  codigo: string;

  nome: string;

  descricao?: string;

  // Área dona do processo (dgt_area). Ainda não existe coluna em
  // dgt_processo; no teste fica só nos processos locais.
  areaId?: string;

  areaNome?: string;

  ativo: boolean;

  origem: OrigemRegistroProcesso;
}

export interface IDocumentoProcessoVinculo {
  id: string;

  documentoId: string;

  // Vínculo feito na criação do documento, antes de o id existir:
  // o documento é encontrado depois pelo código (único).
  documentoCodigo?: string;

  processoId: string;

  // Processo cujo fluxo governa a revisão do documento.
  // No Dataverse ainda não existe coluna para isso; no modo de
  // teste a escolha fica no navegador.
  principal: boolean;

  origem: OrigemRegistroProcesso;
}
