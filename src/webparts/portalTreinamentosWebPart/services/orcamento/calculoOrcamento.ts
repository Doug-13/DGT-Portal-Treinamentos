import {
  TipoBaseRegra
} from './esquemaOrcamento';

import {
  PLANO_CONTAS,
  nomeGrupoAtual
} from './planoContasOrcamento';

import {
  ILinhaDre,
  calcularDre,
  nomeDaReferencia,
  valoresComSinal,
  valoresDaConta
} from './dreOrcamento';

// ============================================================
// REGRAS DE CÁLCULO DO ORÇAMENTO
//
// "Conta DESTINO = PERCENTUAL% × soma da BASE", mês a mês, dentro da
// mesma planilha — como as fórmulas da aba ORÇAMENTO 2027:
//   (-) ICMS   = 17%  × Serviço de promoção de vendas
//   (-) COFINS = 7,6% × (Receita bruta − perdas − créditos…)
//   CSLL       = 9%   × Lucro antes do IRPJ/CSLL
//
// A BASE soma valores COM SINAL (receitas +, custos/despesas −), igual
// à planilha. Assim um crédito (custo) reduz o imposto, e a "Lei do
// Bem" (sobre P&D, que é negativo) reduz a CSLL/IR.
//
// Itens da base (tipoBase 'Misto'):
//   grupo:<nome>          → total do grupo
//   linha:<id da DRE>     → seção/resultado (ex.: linha:LAIR, linha:CUSTOS)
//   conta:<código>[@grupo]→ conta (o grupo desfaz códigos repetidos)
// Regras antigas ('Grupo' / 'Contas') continuam valendo.
//
// • Ordem: regras de ordem menor são calculadas antes (uma regra pode
//   usar o resultado de outra; CSLL/IR por último).
// • A linha calculada fica bloqueada para digitação.
// • Só vale para planilhas que têm a linha da conta destino.
// ============================================================

export interface IRegraCalculo {
  id: string;
  nome: string;
  contaDestino: string;
  contaDestinoNome: string;
  // Grupo da conta destino (quando o código aparece em mais de um
  // grupo, ex.: 4.1.2.01.01.001). Vazio = qualquer grupo.
  grupoDestino?: string;
  tipoBase: TipoBaseRegra;
  // 'Grupo': nomes de grupo · 'Contas': códigos · 'Misto': referências.
  base: string[];
  // Em %, ex.: 1.65 para 1,65%.
  percentual: number;
  ordem: number;
  ativo: boolean;
}

// Formato mínimo de linha que o cálculo precisa.
export interface ILinhaCalculavel extends ILinhaDre {
  chave: string;
  ordem: number;
}

const arredondar = (valor: number): number =>
  Math.round((valor || 0) * 100) / 100;

const zeros = (): number[] => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const regrasAtivas = (
  regras: IRegraCalculo[]
): IRegraCalculo[] =>
  regras
    .filter(regra => regra.ativo && !!regra.contaDestino)
    .sort((a, b) => a.ordem - b.ordem);

// Referências da base no formato 'Misto'.
export const referenciasDaRegra = (
  regra: Pick<IRegraCalculo, 'tipoBase' | 'base'>
): string[] =>
  regra.tipoBase === 'Misto'
    ? regra.base
    : regra.tipoBase === 'Grupo'
      ? regra.base.map(grupo => `grupo:${nomeGrupoAtual(grupo)}`)
      : regra.base.map(codigo => `conta:${codigo}`);

const ehDestino = (
  linha: ILinhaDre,
  regra: Pick<IRegraCalculo, 'contaDestino' | 'grupoDestino'>
): boolean =>
  linha.codigo === regra.contaDestino &&
  (!regra.grupoDestino || linha.grupo === regra.grupoDestino);

// Base (com sinal) de uma regra, mês a mês.
const baseDaRegra = <T extends ILinhaCalculavel>(
  regra: IRegraCalculo,
  linhas: T[]
): number[] => {

  const base = zeros();
  const referencias = referenciasDaRegra(regra);
  // A conta destino nunca entra na própria base.
  const semDestino = linhas.filter(linha => !ehDestino(linha, regra));
  const precisaDre = referencias.some(ref => ref.indexOf('linha:') === 0);
  const dre = precisaDre ? calcularDre(semDestino) : {};

  referencias.forEach(ref => {
    let valores: number[];
    if (ref.indexOf('conta:') === 0) {
      valores = valoresDaConta(ref, semDestino);
    } else if (ref.indexOf('linha:') === 0) {
      valores = dre[ref.substring(6)] || zeros();
    } else {
      const grupo = ref.replace(/^grupo:/, '');
      valores = zeros();
      semDestino
        .filter(linha => linha.grupo === grupo)
        .forEach(linha => valoresComSinal(linha).forEach((valor, mes) => { valores[mes] += valor; }));
    }
    valores.forEach((valor, mes) => { base[mes] += valor || 0; });
  });

  return base;
};

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

    // Linha destino: a primeira (pela ordem) com o código (e grupo) da
    // regra. Duplicatas da conta calculada ficam zeradas.
    const destinos =
      resultado
        .filter(linha => ehDestino(linha, regra))
        .sort((a, b) => a.ordem - b.ordem);

    if (destinos.length === 0) {
      return;
    }

    // Valor digitado = percentual × base (com sinal). Na tela, a conta
    // de dedução aparece negativa (sinal da conta).
    const calculados =
      baseDaRegra(regra, resultado).map(valor => arredondar(valor * (regra.percentual || 0) / 100));

    resultado = resultado.map(linha => {
      const indice = destinos.indexOf(linha);
      if (indice < 0) {
        return linha;
      }
      const novos = indice === 0 ? calculados : zeros();
      const igual = novos.every((valor, mes) => valor === linha.valores[mes]);
      return igual ? linha : { ...linha, valores: novos };
    });
  });

  return resultado;
};

const formatarPercentual = (valor: number): string =>
  (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// Texto curto da regra: "1,65% de RECEITA BRUTA + …".
export const descreverRegra = (
  regra: IRegraCalculo
): string => {
  const nomes = referenciasDaRegra(regra).map(ref => nomeDaReferencia(ref));
  const base =
    nomes.length <= 3
      ? nomes.join(' + ')
      : `${nomes.slice(0, 3).join(' + ')} + ${nomes.length - 3} outro(s)`;
  return `${formatarPercentual(regra.percentual)}% de ${base || '(base vazia)'}`;
};

// Chave de uma conta calculada: "grupo|código" ou "*|código".
export const chaveCalculo = (grupo: string | undefined, codigo: string): string =>
  `${grupo || '*'}|${codigo}`;

// Mapa (grupo|código) → descrição da regra que calcula a conta.
export const contasCalculadas = (
  regras: IRegraCalculo[]
): { [chave: string]: string } => {
  const mapa: { [chave: string]: string } = {};
  regrasAtivas(regras).forEach(regra => {
    mapa[chaveCalculo(regra.grupoDestino, regra.contaDestino)] = descreverRegra(regra);
  });
  return mapa;
};

// Descrição do cálculo de uma linha (ou undefined se é digitada).
export const calculoDaLinha = (
  mapa: { [chave: string]: string } | undefined,
  grupo: string,
  codigo: string
): string | undefined =>
  mapa ? mapa[chaveCalculo(grupo, codigo)] || mapa[chaveCalculo(undefined, codigo)] : undefined;

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
    problemas.push('Escolha pelo menos um item como base.');
  }

  const referencias = referenciasDaRegra(regra);
  if (
    referencias.indexOf(`conta:${regra.contaDestino}`) >= 0 ||
    referencias.indexOf(`conta:${regra.contaDestino}@${regra.grupoDestino || ''}`) >= 0
  ) {
    problemas.push('A conta calculada não pode fazer parte da própria base.');
  }

  if (!isFinite(regra.percentual) || regra.percentual < 0 || regra.percentual > 100) {
    problemas.push('O percentual deve estar entre 0 e 100.');
  }

  if (
    regra.ativo &&
    todas.some(outra =>
      outra.id !== regra.id &&
      outra.ativo &&
      outra.contaDestino === regra.contaDestino &&
      (outra.grupoDestino || '') === (regra.grupoDestino || '')
    )
  ) {
    problemas.push('Já existe outra regra ativa calculando esta conta.');
  }

  return problemas;
};

// ------------------------------------------------------------
// Regras da planilha "Orçamento_2027.xlsm" (aba ORÇAMENTO 2027)
// ------------------------------------------------------------

export type RegraPlanilha =
  Pick<IRegraCalculo, 'contaDestino' | 'grupoDestino' | 'base' | 'percentual' | 'ordem'> & {
    // Fórmula original da planilha (documentação).
    formula: string;
  };

// Créditos de PIS/COFINS: contas que a planilha desconta da base.
const CREDITOS_PIS_COFINS: string[] = [
  'conta:4.2.1.01.01.003',   // Despesa com alimentação
  'conta:4.3.1.01.01.002',   // Perdas no adto a fornecedores
  'conta:4.2.1.01.01.026',   // Uniformes de empregados
  'conta:4.2.1.01.01.023',   // Equipamentos de segurança
  'conta:4.2.1.01.01.011',   // Vale transporte
  'conta:4.2.1.01.06.002',   // Assistência contábil
  'conta:4.1.4.01.01.013',   // Serviços terceiros - CSS (comissões)
  'conta:4.2.1.01.01.039',   // Serviço terceiros - PJ
  'conta:4.2.1.01.06.006',   // Depreciações e amortizações matriz
  'conta:4.2.1.01.06.024'    // Perdas no recebimento de créditos
];

const BASE_PIS_COFINS: string[] =
  ['grupo:RECEITA BRUTA', 'conta:4.3.1.01.01.001'].concat(CREDITOS_PIS_COFINS);

export const REGRAS_PLANILHA_2027: RegraPlanilha[] = [
  { contaDestino: '4.1.4.01.01.013', grupoDestino: 'Comissões', base: ['grupo:RECEITA BRUTA'], percentual: 3, ordem: 10, formula: '=-E3*3%' },
  { contaDestino: '3.1.2.01.02.001', grupoDestino: 'Impostos', base: ['conta:3.1.1.02.01.005'], percentual: 17, ordem: 20, formula: '=-E8*17%' },
  { contaDestino: '3.1.2.01.02.002', grupoDestino: 'Impostos', base: ['conta:3.1.1.02.01.001', 'conta:3.1.1.02.01.002', 'conta:3.1.1.02.01.003', 'conta:3.1.1.02.01.004'], percentual: 3, ordem: 30, formula: '=-SUM(E4,E5,E6,E7)*3%' },
  { contaDestino: '3.1.2.01.02.003', grupoDestino: 'Impostos', base: BASE_PIS_COFINS, percentual: 7.6, ordem: 40, formula: '=-(SUM(E250,E3)*7.6%)-(SUM(créditos)*7.6%)' },
  { contaDestino: '3.1.2.01.02.004', grupoDestino: 'Impostos', base: BASE_PIS_COFINS, percentual: 1.65, ordem: 50, formula: '=-(SUM(E250,E3)*1.65%)-(SUM(créditos)*1.65%)' },
  { contaDestino: 'CBS', grupoDestino: 'Impostos', base: ['grupo:RECEITA BRUTA', 'linha:CUSTOS'], percentual: 9.21, ordem: 60, formula: '=-(SUM(E3)*9.21%)-(E23)*9.21%' },
  { contaDestino: '4.1.2.01.01.001', grupoDestino: 'Amortização Projetos', base: ['conta:3.1.1.02.01.002', 'conta:3.1.1.02.01.004'], percentual: 15, ordem: 70, formula: '=-SUM(E5,E7)*15%' },
  { contaDestino: '3.1.2.01.02.005', grupoDestino: 'CSLL', base: ['linha:LAIR'], percentual: 9, ordem: 100, formula: '=-E312*9%' },
  { contaDestino: 'LEIBEM-CSLL', grupoDestino: 'CSLL', base: ['grupo:Custos Pesquisa e Desenvolvimento'], percentual: 0.9, ordem: 110, formula: '=-((E66*10%)*9%)' },
  { contaDestino: '3.1.2.01.02.006', grupoDestino: 'IR', base: ['linha:LAIR'], percentual: 25, ordem: 120, formula: '=-E312*25%' },
  { contaDestino: 'LEIBEM-IR', grupoDestino: 'IR', base: ['grupo:Custos Pesquisa e Desenvolvimento'], percentual: 2.5, ordem: 130, formula: '=-((E66*10%)*25%)' }
];

export const nomeContaDoPlano = (codigo: string, grupo?: string): string => {
  const conta = PLANO_CONTAS.filter(item => item.codigo === codigo && (!grupo || item.grupo === grupo))[0];
  return conta ? conta.conta : codigo;
};
