import {
  CONTAS_MAE,
  PLANO_CONTAS
} from './planoContasOrcamento';

// ============================================================
// DRE DO ORÇAMENTO — igual à aba "ORÇAMENTO 2027"
//
// SINAL: o gestor digita valores POSITIVOS. Receitas entram positivas
// e deduções/custos/despesas entram NEGATIVAS nos totais e
// resultados (como na planilha), pelo sinal da conta:
//   3.x (receitas)                         → +
//   3.1.2.x (deduções: impostos, CSLL, IR) → −
//   1.x, 2.x, 4.x, 6.x, CBS, Lei do Bem    → −
// Um valor digitado negativo inverte o sinal (ex.: estorno).
//
// Linhas da DRE:
//   grupo     → soma das contas do grupo
//   secao     → soma de grupos (ex.: CUSTOS DE OPERAÇÃO)
//   resultado → fórmula da planilha (ex.: Lucro Bruto, EBITDA)
//   percentual→ resultado ÷ Receita Bruta
// ============================================================

export type TipoItemDre = 'grupo' | 'secao' | 'resultado' | 'percentual';

// Termo de uma fórmula: id de item da DRE, ou conta ("conta:código").
export interface ITermoDre {
  ref: string;
  sinal: 1 | -1;
}

export interface IItemDre {
  id: string;
  tipo: TipoItemDre;
  nome: string;
  // grupo: o nome do grupo é o próprio id.
  // secao/resultado: termos somados (com sinal).
  termos?: ITermoDre[];
  // percentual: item dividido pela Receita Bruta.
  base?: string;
  // Recuo visual (grupos dentro de uma seção).
  nivel?: number;
}

const mais = (...refs: string[]): ITermoDre[] => refs.map(ref => ({ ref, sinal: 1 as const }));

export const ID_RECEITA_BRUTA = 'RECEITA BRUTA';

// Na ordem da planilha. "id" de grupo = nome do grupo.
export const ITENS_DRE: IItemDre[] = [
  { id: 'RECEITA BRUTA', tipo: 'grupo', nome: 'RECEITA BRUTA' },

  { id: 'DEDUCOES', tipo: 'secao', nome: 'DEDUÇÕES SOBRE RECEITA', termos: mais('Impostos', 'Comissões') },
  { id: 'Impostos', tipo: 'grupo', nome: 'Impostos', nivel: 1 },
  { id: 'Comissões', tipo: 'grupo', nome: 'Comissões', nivel: 1 },
  { id: 'ROL', tipo: 'resultado', nome: 'Receita Operacional Líquida', termos: mais('RECEITA BRUTA', 'DEDUCOES') },

  {
    id: 'CUSTOS',
    tipo: 'secao',
    nome: 'CUSTOS DE OPERAÇÃO',
    termos: mais('Mercadorias para revenda', 'Custos Diretos Serviços', 'Custos Diretos Locações Bens (sem amortização)')
  },
  { id: 'Mercadorias para revenda', tipo: 'grupo', nome: 'Mercadorias para revenda', nivel: 1 },
  { id: 'Custos Diretos Serviços', tipo: 'grupo', nome: 'Custos Diretos Serviços', nivel: 1 },
  { id: 'Custos Diretos Locações Bens (sem amortização)', tipo: 'grupo', nome: 'Custos Diretos Locações Bens (sem amortização)', nivel: 1 },
  { id: 'LOAA', tipo: 'resultado', nome: 'Lucro Operacional (antes da amort)', termos: mais('ROL', 'CUSTOS') },
  { id: 'PCT_LOAA', tipo: 'percentual', nome: '% Lucro Operacional (antes da amort)', base: 'LOAA' },

  { id: 'Amortização Projetos', tipo: 'grupo', nome: 'Amortização Projetos' },
  { id: 'Custos Pesquisa e Desenvolvimento', tipo: 'grupo', nome: 'Custos Pesquisa e Desenvolvimento' },
  { id: 'LB', tipo: 'resultado', nome: 'Lucro Bruto', termos: mais('LOAA', 'Amortização Projetos', 'Custos Pesquisa e Desenvolvimento') },
  { id: 'PCT_LB', tipo: 'percentual', nome: '% Lucro Bruto', base: 'LB' },

  {
    id: 'DESPESAS',
    tipo: 'secao',
    nome: 'DESPESAS OPERACIONAIS ADMINISTRATIVAS',
    termos: mais(
      'Salários indiretos', 'Distribuição Resultado', 'Despesas com viagens e representações',
      'Propaganda e Publicidade', 'Despesas com veículos', 'Despesas Gerais', 'Taxas Diversas',
      'Prospecção de Clientes', 'Operações descontinuadas'
    )
  },
  { id: 'Salários indiretos', tipo: 'grupo', nome: 'Salários indiretos', nivel: 1 },
  { id: 'Distribuição Resultado', tipo: 'grupo', nome: 'Distribuição Resultado', nivel: 1 },
  { id: 'Despesas com viagens e representações', tipo: 'grupo', nome: 'Despesas com viagens e representações', nivel: 1 },
  { id: 'Propaganda e Publicidade', tipo: 'grupo', nome: 'Propaganda e Publicidade', nivel: 1 },
  { id: 'Despesas com veículos', tipo: 'grupo', nome: 'Despesas com veículos', nivel: 1 },
  { id: 'Despesas Gerais', tipo: 'grupo', nome: 'Despesas Gerais', nivel: 1 },
  { id: 'Taxas Diversas', tipo: 'grupo', nome: 'Taxas Diversas', nivel: 1 },
  { id: 'Prospecção de Clientes', tipo: 'grupo', nome: 'Prospecção de Clientes', nivel: 1 },
  { id: 'Operações descontinuadas', tipo: 'grupo', nome: 'Operações descontinuadas', nivel: 1 },
  { id: 'LO', tipo: 'resultado', nome: 'Lucro Operacional', termos: mais('LB', 'DESPESAS') },

  { id: 'Despesas financeiras', tipo: 'grupo', nome: 'Despesas financeiras' },
  { id: 'Receitas financeiras', tipo: 'grupo', nome: 'Receitas financeiras' },
  { id: 'Provisões de rendimentos', tipo: 'grupo', nome: 'Provisões de rendimentos' },
  {
    id: 'LAIR',
    tipo: 'resultado',
    nome: 'Lucro Líquido Antes do IRPJ/CSLL',
    termos: mais('LO', 'Despesas financeiras', 'Receitas financeiras', 'Provisões de rendimentos')
  },
  { id: 'PCT_LAIR', tipo: 'percentual', nome: '% Lucro Líquido', base: 'LAIR' },

  { id: 'CSLL', tipo: 'grupo', nome: 'CSLL' },
  { id: 'IR', tipo: 'grupo', nome: 'IR' },
  { id: 'LL', tipo: 'resultado', nome: 'Lucro Líquido após IRPJ/CSLL', termos: mais('LAIR', 'CSLL', 'IR') },
  { id: 'PCT_LL', tipo: 'percentual', nome: '% Lucro Líquido', base: 'LL' },

  // Memória do EBITDA (planilha: =SUM(E64,E168,E190)).
  {
    id: 'DA',
    tipo: 'secao',
    nome: 'Depreciações e Amortizações',
    termos: mais('Amortização Projetos', 'conta:4.2.1.01.06.006', 'conta:4.2.1.01.06.030')
  },
  { id: 'Receitas e Despesas financeiras (ajuste do EBITDA)', tipo: 'grupo', nome: 'Receitas e Despesas financeiras (ajuste do EBITDA)' },
  // Planilha: =(E312-E264-E273-E331-E336)
  {
    id: 'EBITDA',
    tipo: 'resultado',
    nome: 'EBITDA',
    termos: [
      { ref: 'LAIR', sinal: 1 },
      { ref: 'conta:4.2.1.01.08.001@Despesas financeiras', sinal: -1 },
      { ref: 'Receitas financeiras', sinal: -1 },
      { ref: 'DA', sinal: -1 },
      { ref: 'Receitas e Despesas financeiras (ajuste do EBITDA)', sinal: -1 }
    ]
  },
  { id: 'PCT_EBITDA', tipo: 'percentual', nome: '% Sobre Receita', base: 'EBITDA' }
];

// ------------------------------------------------------------
// Sinal da conta
// ------------------------------------------------------------

export const sinalDaConta = (codigo: string): 1 | -1 => {
  const texto = (codigo || '').trim();
  if (/^3\./.test(texto) && !/^3\.1\.2\./.test(texto)) {
    return 1;
  }
  return -1;
};

// Linha mínima usada pelo cálculo.
export interface ILinhaDre {
  grupo: string;
  codigo: string;
  valores: number[];
}

const zeros = (): number[] => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const arredondar = (valor: number): number => Math.round((valor || 0) * 100) / 100;

// Valor com sinal (como na planilha) de uma linha.
export const valoresComSinal = (linha: ILinhaDre): number[] => {
  const sinal = sinalDaConta(linha.codigo);
  return linha.valores.map(valor => arredondar((valor || 0) * sinal));
};

const somarEm = (destino: number[], origem: number[], fator = 1): void => {
  origem.forEach((valor, mes) => {
    destino[mes] = arredondar(destino[mes] + (valor || 0) * fator);
  });
};

// Soma (com sinal) das linhas de uma conta: "conta:código" ou
// "conta:código@grupo".
export const valoresDaConta = (ref: string, linhas: ILinhaDre[]): number[] => {
  const [codigo, grupo] = ref.replace(/^conta:/, '').split('@');
  const total = zeros();
  linhas
    .filter(linha => linha.codigo === codigo && (!grupo || linha.grupo === grupo))
    .forEach(linha => somarEm(total, valoresComSinal(linha)));
  return total;
};

export type ResultadoDre = { [id: string]: number[] };

// Calcula todos os itens da DRE (12 meses, com sinal). Percentuais em
// % (ex.: 12.5 = 12,5%), 0 quando a Receita Bruta do mês é zero.
export const calcularDre = (linhas: ILinhaDre[]): ResultadoDre => {

  const resultado: ResultadoDre = {};

  const valorDe = (ref: string): number[] => {
    if (ref.indexOf('conta:') === 0) {
      return valoresDaConta(ref, linhas);
    }
    return resultado[ref] || zeros();
  };

  // 1º os grupos (as seções aparecem ANTES dos seus grupos na tela).
  ITENS_DRE.filter(item => item.tipo === 'grupo').forEach(item => {
    const total = zeros();
    linhas.filter(linha => linha.grupo === item.id).forEach(linha => somarEm(total, valoresComSinal(linha)));
    resultado[item.id] = total;
  });

  // 2º seções, resultados e %, na ordem da planilha.
  ITENS_DRE.filter(item => item.tipo !== 'grupo').forEach(item => {
    if (item.tipo === 'percentual') {
      const base = resultado[item.base || ''] || zeros();
      const receita = resultado[ID_RECEITA_BRUTA] || zeros();
      resultado[item.id] = base.map((valor, mes) =>
        receita[mes] ? Math.round((valor / receita[mes]) * 10000) / 100 : 0
      );
      return;
    }
    const total = zeros();
    (item.termos || []).forEach(termo => somarEm(total, valorDe(termo.ref), termo.sinal));
    resultado[item.id] = total;
  });

  return resultado;
};

// Total do ano de um item (percentual: resultado do ano ÷ receita do ano).
export const totalAnualDre = (id: string, dre: ResultadoDre): number => {
  const item = ITENS_DRE.filter(atual => atual.id === id)[0];
  if (item && item.tipo === 'percentual') {
    const base = (dre[item.base || ''] || zeros()).reduce((soma, valor) => soma + valor, 0);
    const receita = (dre[ID_RECEITA_BRUTA] || zeros()).reduce((soma, valor) => soma + valor, 0);
    return receita ? Math.round((base / receita) * 10000) / 100 : 0;
  }
  return arredondar((dre[id] || zeros()).reduce((soma, valor) => soma + valor, 0));
};

// Nome legível de uma referência (regras e telas).
export const nomeDaReferencia = (ref: string): string => {
  if (ref.indexOf('conta:') === 0) {
    const [codigo, grupo] = ref.replace(/^conta:/, '').split('@');
    const conta =
      PLANO_CONTAS.filter(item => item.codigo === codigo && (!grupo || item.grupo === grupo))[0];
    const nome = conta ? conta.conta : CONTAS_MAE[codigo] || codigo;
    return grupo ? `${nome} (${grupo})` : nome;
  }
  const ref2 = ref.replace(/^(grupo|linha):/, '');
  const item = ITENS_DRE.filter(atual => atual.id === ref2)[0];
  return item ? item.nome : ref2;
};
