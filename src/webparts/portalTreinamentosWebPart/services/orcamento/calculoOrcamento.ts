import {
  TipoBaseRegra
} from './esquemaOrcamento';

import {
  PLANO_CONTAS
} from './planoContasOrcamento';

// ============================================================
// REGRAS DE CÁLCULO DO ORÇAMENTO
//
// Uma regra diz: "a conta DESTINO = PERCENTUAL% × soma da BASE",
// mês a mês, dentro da MESMA planilha. A base é um ou mais GRUPOS
// (ex.: Receita bruta) ou uma lista de CONTAS (códigos).
//
// Exemplo: (-) PIS = 1,65% de "Receita bruta".
//
// • As regras são aplicadas na ordem (campo Ordem). Uma regra pode
//   usar como base o resultado de uma regra anterior.
// • A conta destino nunca entra na própria base.
// • A linha calculada fica bloqueada para digitação.
// • Só vale para planilhas que têm a linha da conta destino.
// ============================================================

export interface IRegraCalculo {
  id: string;
  nome: string;
  contaDestino: string;
  contaDestinoNome: string;
  tipoBase: TipoBaseRegra;
  // Nomes de grupo (tipoBase = Grupo) ou códigos de conta (Contas).
  base: string[];
  // Em %, ex.: 1.65 para 1,65%.
  percentual: number;
  ordem: number;
  ativo: boolean;
}

// Formato mínimo de linha que o cálculo precisa.
export interface ILinhaCalculavel {
  chave: string;
  grupo: string;
  codigo: string;
  ordem: number;
  valores: number[];
}

const arredondar = (valor: number): number =>
  Math.round((valor || 0) * 100) / 100;

export const regrasAtivas = (
  regras: IRegraCalculo[]
): IRegraCalculo[] =>
  regras
    .filter(regra => regra.ativo && !!regra.contaDestino)
    .sort((a, b) => a.ordem - b.ordem);

const entraNaBase = (
  linha: ILinhaCalculavel,
  regra: IRegraCalculo
): boolean =>
  linha.codigo !== regra.contaDestino &&
  (regra.tipoBase === 'Grupo'
    ? regra.base.indexOf(linha.grupo) >= 0
    : regra.base.indexOf(linha.codigo) >= 0);

// Aplica as regras e devolve a lista com os valores das linhas
// calculadas atualizados. Linhas que não mudaram continuam sendo o
// MESMO objeto (a tabela não redesenha à toa).
export const aplicarRegras = <T extends ILinhaCalculavel>(
  linhas: T[],
  regras: IRegraCalculo[]
): T[] => {

  const ativas = regrasAtivas(regras);

  if (ativas.length === 0) {
    return linhas;
  }

  let resultado = linhas.slice();

  ativas.forEach(regra => {

    // Linha destino: a primeira (pela ordem) com o código da regra.
    // Duplicatas da conta calculada ficam zeradas.
    const destinos =
      resultado
        .filter(linha => linha.codigo === regra.contaDestino)
        .sort((a, b) => a.ordem - b.ordem);

    if (destinos.length === 0) {
      return;
    }

    const base = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    resultado.forEach(linha => {
      if (entraNaBase(linha, regra)) {
        linha.valores.forEach((valor, mes) => {
          base[mes] += valor || 0;
        });
      }
    });

    const calculados =
      base.map(valor => arredondar(valor * (regra.percentual || 0) / 100));

    resultado = resultado.map(linha => {
      const indice = destinos.indexOf(linha);
      if (indice < 0) {
        return linha;
      }
      const novos = indice === 0 ? calculados : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const igual = novos.every((valor, mes) => valor === linha.valores[mes]);
      return igual ? linha : { ...linha, valores: novos };
    });
  });

  return resultado;
};

const formatarPercentual = (valor: number): string =>
  (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// Texto curto da regra: "1,65% de Receita bruta".
export const descreverRegra = (
  regra: IRegraCalculo
): string => {

  const nomesBase =
    regra.tipoBase === 'Grupo'
      ? regra.base
      : regra.base.map(codigo => {
        const conta = PLANO_CONTAS.filter(item => item.codigo === codigo)[0];
        return conta ? conta.conta : codigo;
      });

  const base =
    nomesBase.length <= 2
      ? nomesBase.join(' + ')
      : `${nomesBase.slice(0, 2).join(' + ')} + ${nomesBase.length - 2} outra(s)`;

  return `${formatarPercentual(regra.percentual)}% de ${base || '(base vazia)'}`;
};

// Mapa código da conta → descrição da regra que a calcula.
export const contasCalculadas = (
  regras: IRegraCalculo[]
): { [codigo: string]: string } => {
  const mapa: { [codigo: string]: string } = {};
  regrasAtivas(regras).forEach(regra => {
    mapa[regra.contaDestino] = descreverRegra(regra);
  });
  return mapa;
};

// Problemas de configuração (mostrados na tela de regras).
export const validarRegra = (
  regra: IRegraCalculo,
  todas: IRegraCalculo[]
): string[] => {

  const problemas: string[] = [];

  if (!regra.contaDestino) {
    problemas.push('Escolha a conta que será calculada.');
  }

  if (regra.base.length === 0) {
    problemas.push('Escolha pelo menos um grupo ou conta como base.');
  }

  if (regra.tipoBase === 'Contas' && regra.base.indexOf(regra.contaDestino) >= 0) {
    problemas.push('A conta calculada não pode fazer parte da própria base.');
  }

  if (!isFinite(regra.percentual) || regra.percentual < 0 || regra.percentual > 100) {
    problemas.push('O percentual deve estar entre 0 e 100.');
  }

  if (
    regra.ativo &&
    todas.some(outra => outra.id !== regra.id && outra.ativo && outra.contaDestino === regra.contaDestino)
  ) {
    problemas.push('Já existe outra regra ativa calculando esta conta.');
  }

  return problemas;
};

// Sugestões iniciais (impostos sobre vendas sobre a Receita bruta).
// Criadas INATIVAS e com 0%: o Administrador informa as alíquotas
// corretas para o regime tributário da empresa e ativa.
export const REGRAS_SUGERIDAS: Array<Pick<IRegraCalculo, 'contaDestino' | 'tipoBase' | 'base' | 'ordem'>> = [
  { contaDestino: '3.1.2.01.02.001', tipoBase: 'Grupo', base: ['Receita bruta'], ordem: 10 }, // (-) ICMS
  { contaDestino: '3.1.2.01.02.002', tipoBase: 'Grupo', base: ['Receita bruta'], ordem: 20 }, // (-) ISSQN
  { contaDestino: '3.1.2.01.02.003', tipoBase: 'Grupo', base: ['Receita bruta'], ordem: 30 }, // (-) COFINS
  { contaDestino: '3.1.2.01.02.004', tipoBase: 'Grupo', base: ['Receita bruta'], ordem: 40 }  // (-) PIS
];
