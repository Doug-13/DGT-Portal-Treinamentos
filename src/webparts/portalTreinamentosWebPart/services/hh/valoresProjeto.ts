import { AREAS_BOM } from './calculoHH';

import {
  IComplementosHH,
  totalIntegracao,
  totalManutencao
} from './complementosHH';

// ============================================================
// TOTAIS DO PROJETO (etapa Cálculo de HH → B.O.M. pronto)
//
// Parte do valor dos itens da Seleção de kit (preços do CIGAM):
//   Itens do kit                         = Σ quantidade × valor CIGAM
//   Implantação / Supply                 = valor dos itens × % fixo da área
//   Integração                           = horas × valor HH × (1 + BDI)
//   Manutenção                           = pontos × valor do ponto
//   Total do projeto                     = soma de tudo
// O HH dos pontos (custo pela planilha de HH) não soma: serve para
// conferir se o valor pelo % fixo cobre o custo da área.
// ============================================================

export interface IValorAreaProjeto {
  chave: string;
  nome: string;
  pctFixo: number;
  valor: number;            // valor dos itens × % fixo
}

export interface IResumoValoresBom {
  valorItens: number;
  itensSemPreco: number;    // itens que não entraram no valor
  areas: IValorAreaProjeto[];
  totalAreas: number;
  integracao: number;
  manutencao: number;
  total: number;
  calculadoEm?: string;
}

const centavos = (v: number): number => Math.round((Number(v) || 0) * 100) / 100;

export const resumoValoresBom = (
  valorItens: number,
  complementos?: IComplementosHH,
  itensSemPreco = 0
): IResumoValoresBom => {
  const base = centavos(Math.max(0, valorItens));
  const areas: IValorAreaProjeto[] = Object.keys(AREAS_BOM).map(chave => ({
    chave,
    nome: AREAS_BOM[chave].nome,
    pctFixo: AREAS_BOM[chave].pctFixo,
    valor: centavos(base * AREAS_BOM[chave].pctFixo)
  }));
  const totalAreas = centavos(areas.reduce((t, a) => t + a.valor, 0));
  const integracao = centavos(totalIntegracao(complementos ? complementos.integracao : undefined));
  const manutencao = centavos(totalManutencao(complementos ? complementos.manutencao : undefined));
  return {
    valorItens: base,
    itensSemPreco,
    areas,
    totalAreas,
    integracao,
    manutencao,
    total: centavos(base + totalAreas + integracao + manutencao)
  };
};
