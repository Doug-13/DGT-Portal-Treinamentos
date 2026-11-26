import { IItemBom } from './montadorBom';

// ============================================================
// VALORES DO B.O.M. (preço unitário do CIGAM × quantidade)
//
// Os valores vêm da aba Kits (dgt_kititem.dgt_valor, gravado pelo
// plugin AtualizarValoresCigamPlugin). Aqui só se faz a conta: o
// portal nunca consulta o CIGAM.
//
// Os códigos são comparados só pelos dígitos: "310.005.0082" e
// "3100050082" são o mesmo item.
// ============================================================

export type MapaPrecos = Record<string, number>;

export const chaveCodigo = (codigo: string | undefined): string =>
  String(codigo || '').replace(/\D/g, '');

// Monta o mapa a partir dos itens do catálogo (só valores > 0).
export const mapaPrecosDoCatalogo = (itens: Array<{ codigo: string; valor?: number }>): MapaPrecos => {
  const mapa: MapaPrecos = {};
  itens.forEach(item => {
    if (item.codigo && typeof item.valor === 'number' && !isNaN(item.valor) && item.valor > 0) {
      mapa[item.codigo] = item.valor;
      const chave = chaveCodigo(item.codigo);
      if (chave) {
        mapa[chave] = item.valor;
      }
    }
  });
  return mapa;
};

// Valor unitário do item, ou undefined se não houver código ou preço.
export const valorDoItem = (precos: MapaPrecos | undefined, codigo: string | undefined): number | undefined => {
  if (!precos || !codigo) {
    return undefined;
  }
  if (precos[codigo] !== undefined) {
    return precos[codigo];
  }
  const chave = chaveCodigo(codigo);
  return chave && precos[chave] !== undefined ? precos[chave] : undefined;
};

export interface ITotalBom {
  total: number;
  comValor: number;
  semValor: number;   // com código, mas sem preço do CIGAM
  semCodigo: number;  // não consultados no CIGAM
}

export const totalizarItens = (itens: IItemBom[], precos: MapaPrecos | undefined): ITotalBom => {
  const r: ITotalBom = { total: 0, comValor: 0, semValor: 0, semCodigo: 0 };
  itens.forEach(item => {
    if (!item.codigo || item.pendente) {
      r.semCodigo++;
      return;
    }
    const valor = valorDoItem(precos, item.codigo);
    if (valor === undefined) {
      r.semValor++;
      return;
    }
    r.comValor++;
    r.total += valor * (Number(item.quantidade) || 0);
  });
  r.total = Math.round(r.total * 100) / 100;
  return r;
};

export const formatarMoeda = (v: number): string =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
