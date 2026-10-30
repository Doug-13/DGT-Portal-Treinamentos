// ============================================================
// CÁLCULO DE HH — MODELO DE DADOS
//
// Reproduz as planilhas "CALCULO HH - IMPLANTAÇÃO" e "CALCULO HH -
// SUPORTE" (revisadas em 27/10/2026). As duas áreas usam o MESMO
// modelo; a Implantação tem, além disso, o bloco de apoio (equipe que
// lança horas, custos operacionais e lançamentos de horas).
//
// Aba da planilha               → parte deste modelo
//   Premissas                   → premissas, headcountMes
//   Custo Mensal (oculta)       → custos, conferenciaMapa
//   HH Mensal                   → calculado
//   Equipe de Campo             → equipeCampo
//   Quadro P.O. agregado        → quadroPO
//   Apoio - Equipe e Horas      → apoio.colaboradores, apoio.custosOperacionais
//   Apoio - Horas set-26        → apoio.lancamentos
//   Apoio - Projetos set-26     → apoio.projetos (+ calculado)
//   Resumo HH                   → calculado (IResultadoHH)
//
// Os valores digitados ficam aqui; tudo o que é fórmula está em
// calculoHH.ts. LGPD: o quadro é agregado por família e a equipe usa
// códigos ("Interno 01"), como nas planilhas.
// ============================================================

export type ChaveAreaHH = string;

export type GrupoCusto = 'Pessoal' | 'Despesas gerais' | 'Veículos' | 'Viagens';

export const GRUPOS_CUSTO: GrupoCusto[] = ['Pessoal', 'Despesas gerais', 'Veículos', 'Viagens'];

export type TipoCusto = '1° mês' | 'Anual' | 'Recorrente';

export const TIPOS_CUSTO: TipoCusto[] = ['Recorrente', '1° mês', 'Anual'];

export interface IPremissasHH {
  mesReferencia: string;          // 'set/26'
  diasUteis: number;
  jornadaDiaria: number;          // 8,8 h
  horasMes: number;               // 220 h (padrão RH)
  produtividade: number;          // 0,75
  fatorEncargos: number;          // 1,9
  periculosidade: number;         // 0,3
  mesesDiluicao: number;          // itens de 1º mês
  headcountInterno: number;
  // Terceiros incluídos no HH: digitado (Suporte) ou contado na
  // equipe de apoio (Implantação: terceiros com "Inclui no HH").
  terceirosOrigem: 'manual' | 'equipe';
  terceirosManual: number;
  hhReferenciaRh: number;
  // Equipe de campo e ponto/localidade
  pessoasEquipeCampo: number;
  pontosPorDia: number;
  // Regra de alocação de horas no projeto e parâmetros do B.O.M.
  pctAnalista: number;
  valorHoraAnalista: number;
  pctSuprimentos: number;
  valorHoraSuprimentos: number;
  custoTotalProjeto: number;      // opcional (0 = não informado)
  valorMedioBomPonto: number;     // opcional (0 = não informado)
}

export interface ILinhaCusto {
  id: string;
  item: string;
  grupo: GrupoCusto;
  // Valor digitado por mês (vazio = 0).
  valores: Record<string, number>;
  // Linha calculada a partir de outra parte do modelo (Implantação):
  //   quadroPO     → custo c/ encargos do quadro P.O.
  //   terceiros    → custo dos terceiros da equipe de apoio
  //   operacional  → custos operacionais do mesmo grupo
  vinculo?: 'quadroPO' | 'terceiros' | 'operacional';
  mesVinculo?: string;
  observacao?: string;
}

export interface IItemEquipeCampo {
  id: string;
  item: string;
  tipo: TipoCusto;
  valor: number;
  // Valor = salário médio da família do quadro P.O. × encargos.
  familiaVinculada?: string;
  quantidade: number;
  // Entra no "HH só mão de obra" (técnicos, periculosidade, sobreaviso).
  maoDeObra: boolean;
  observacao?: string;
}

export interface IFamiliaPO {
  id: string;
  familia: string;
  posicoes: number;
  ocupadas?: number;
  salarioTotal: number;
  composicao?: string;
}

export interface IColaboradorApoio {
  codigo: string;                 // 'Interno 01', 'Terceiro 02'
  vinculo: 'Interno' | 'Terceiro';
  atuacao: string;
  familia: string;                // internos
  periculosidade: boolean;
  modalidade: 'Mensal' | 'Hora' | 'Diária' | '';
  valorContrato: number;          // terceiros
  incluiHH: boolean;
  fracaoMes: number;
  observacao?: string;
}

export interface ICustoOperacional {
  id: string;
  item: string;
  grupo: GrupoCusto;
  tipo: TipoCusto;
  valor: number;
  quantidade: number;
  observacao?: string;
}

export interface ILancamentoHoras {
  colaborador: string;
  data: string;                   // AAAA-MM-DD
  projeto: string;                // ID CIGAM ou 'INTERNO'
  atividade: string;
  inicio: string;                 // HH:MM
  fim: string;                    // HH:MM
  considerar: boolean;
  observacao?: string;
}

export interface IProjetoApoio {
  projeto: string;
  descricao: string;
  valorBom: number;               // 0 = não informado
}

export interface IApoioHH {
  colaboradores: IColaboradorApoio[];
  custosOperacionais: ICustoOperacional[];
  lancamentos: ILancamentoHoras[];
  projetos: IProjetoApoio[];
}

export interface IDadosHH {
  versaoModelo: 1;
  area: ChaveAreaHH;
  titulo: string;                 // 'Área de Implantação'
  meses: string[];                // ['jan/26', ..., 'set/26']
  premissas: IPremissasHH;
  // Headcount digitado por mês (vazio = headcount total considerado).
  headcountMes: Record<string, number | undefined>;
  custos: ILinhaCusto[];
  // Total do Mapa contábil por mês, para conferência (vazio = sem).
  conferenciaMapa: Record<string, number | undefined>;
  equipeCampo: IItemEquipeCampo[];
  quadroPO: IFamiliaPO[];
  apoio?: IApoioHH;
}

// Áreas previstas. A terceira ainda não tem planilha.
export interface IAreaHH {
  chave: ChaveAreaHH;
  nome: string;
  disponivel: boolean;
  descricao: string;
}

export const AREAS_HH: IAreaHH[] = [
  { chave: 'implantacao', nome: 'Implantação', disponivel: true, descricao: 'HH da instalação em campo: dupla de técnicos, veículos e apoio.' },
  { chave: 'suporte', nome: 'Suporte', disponivel: true, descricao: 'HH da equipe N2 de suporte em campo.' },
  { chave: 'terceira', nome: 'Terceira área', disponivel: false, descricao: 'Planilha em desenvolvimento. Entra aqui com o mesmo modelo quando ficar pronta.' }
];

export const MESES_PADRAO = ['jan/26', 'fev/26', 'mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26'];

// Prefixos que contam como mão de obra na planilha (fórmula do "HH só
// mão de obra" da aba Equipe de Campo).
export const ehMaoDeObra = (item: string): boolean =>
  item.substring(0, 7) === 'Técnico' || item.substring(0, 10) === 'Sobreaviso' || item.substring(0, 14) === 'Periculosidade';

// Modelo vazio (nova área), com as premissas padrão comuns às duas
// planilhas.
export const dadosVazios = (area: ChaveAreaHH, titulo: string): IDadosHH => ({
  versaoModelo: 1,
  area,
  titulo,
  meses: MESES_PADRAO.slice(),
  premissas: {
    mesReferencia: MESES_PADRAO[MESES_PADRAO.length - 1],
    diasUteis: 21,
    jornadaDiaria: 8.8,
    horasMes: 220,
    produtividade: 0.75,
    fatorEncargos: 1.9,
    periculosidade: 0.3,
    mesesDiluicao: 12,
    headcountInterno: 0,
    terceirosOrigem: 'manual',
    terceirosManual: 0,
    hhReferenciaRh: 0,
    pessoasEquipeCampo: 2,
    pontosPorDia: 1,
    pctAnalista: 0.07,
    valorHoraAnalista: 90,
    pctSuprimentos: 0.005,
    valorHoraSuprimentos: 50,
    custoTotalProjeto: 0,
    valorMedioBomPonto: 0
  },
  headcountMes: {},
  custos: [],
  conferenciaMapa: {},
  equipeCampo: [],
  quadroPO: []
});
