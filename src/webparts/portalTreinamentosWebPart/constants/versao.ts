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

export const VERSAO_PORTAL = "1.0.1";

export const VERSAO_SOLUCAO = "1.0.1.0";

export const DATA_BUILD = "2026-09-30T14:42:44.284Z";

export const COMMIT_BUILD = "263e3c6";

export const NOVIDADES: INovidadeVersao[] = [
  {
    "versao": "1.0.1",
    "data": "2026-09-30",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  }
];
