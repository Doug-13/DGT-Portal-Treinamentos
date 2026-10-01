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

  ativo: boolean;

  origem: OrigemRegistroProcesso;
}

export interface IDocumentoProcessoVinculo {
  id: string;

  documentoId: string;

  processoId: string;

  // Processo cujo fluxo governa a revisão do documento.
  // No Dataverse ainda não existe coluna para isso; no modo de
  // teste a escolha fica no navegador.
  principal: boolean;

  origem: OrigemRegistroProcesso;
}
