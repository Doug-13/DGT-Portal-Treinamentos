// ============================================================
// ARQUIVO GERADO AUTOMATICAMENTE por scripts/versao.js
// Não edite à mão: anote as mudanças em CHANGELOG.md
// ("## [Não publicado]") e rode npm run build.
// ============================================================

export type TipoNovidade = 'Novo' | 'Melhoria' | 'Correção';

export interface INovidadeItem {
  tipo: TipoNovidade;
  texto: string;
}

export interface INovidadeVersao {
  versao: string;
  data: string;
  itens: INovidadeItem[];
}

export const VERSAO_PORTAL = "1.0.4";

export const VERSAO_SOLUCAO = "1.0.4.0";

export const DATA_BUILD = "2026-09-30T18:08:43.740Z";

export const COMMIT_BUILD = "c5fdb48";

export const NOVIDADES: INovidadeVersao[] = [];
