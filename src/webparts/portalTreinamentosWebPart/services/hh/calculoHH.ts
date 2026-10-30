import {
  GRUPOS_CUSTO,
  GrupoCusto,
  IColaboradorApoio,
  IDadosHH,
  ILancamentoHoras,
  TipoCusto
} from './modeloHH';

// ============================================================
// CÁLCULO DE HH — MOTOR
//
// Cada bloco abaixo corresponde a uma aba da planilha, e cada
// campo calculado cita a célula de origem (ex.: "Resumo B29").
// Mesmos arredondamentos e mesmas proteções contra divisão por zero
// das fórmulas (IF(x=0,0,...)). Nada aqui grava dados: recebe IDadosHH
// e devolve IResultadoHH.
// ============================================================

const div = (a: number, b: number): number => (b === 0 || !isFinite(b) ? 0 : a / b);
const n = (v: unknown): number => {
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};
const soma = (lista: number[]): number => lista.reduce((t, v) => t + v, 0);

// "1° mês" / "Anual" / "Recorrente" → colunas de custo
const custoPorTipo = (tipo: TipoCusto, valor: number, quantidade: number): { primeiroMes: number; anual: number; recorrente: number } => ({
  primeiroMes: tipo === '1° mês' ? valor * quantidade : 0,
  anual: tipo === 'Anual' ? valor * quantidade : 0,
  recorrente: tipo === 'Recorrente' ? valor * quantidade : 0
});

// ------------------------------------------------------------
// Resultado
// ------------------------------------------------------------

export interface IFamiliaCalculada {
  familia: string;
  posicoes: number;
  ocupadas?: number;
  salarioTotal: number;
  salarioMedio: number;
  custoEncargos: number;
  horasProdutivas: number;
  hh: number;
}

export interface IItemEquipeCalculado {
  id: string;
  item: string;
  tipo: TipoCusto;
  valor: number;
  quantidade: number;
  primeiroMes: number;
  anual: number;
  recorrente: number;
  maoDeObra: boolean;
  vinculado: boolean;
}

export interface ILancamentoCalculado extends ILancamentoHoras {
  horas: number;              // G
  tipo: 'Interno' | 'Projeto';// H
  vinculo: 'Interno' | 'Terceiro'; // J
  horasDia: number;           // K
  horasConsideradas: number;  // L
}

export interface IColaboradorCalculado extends IColaboradorApoio {
  custoInterno: number;       // F
  custoConsiderado: number;   // K
  horasLancadas: number;      // L
  horasConsideradas: number;  // M
  horasProjeto: number;       // N
  horasInternas: number;      // O
  dias: number;               // P
  mediaDia: number;           // Q
  pctProjeto: number;         // R
}

export interface IOperacionalCalculado {
  id: string;
  item: string;
  grupo: GrupoCusto;
  tipo: TipoCusto;
  valor: number;
  quantidade: number;
  primeiroMes: number;
  anual: number;
  recorrente: number;
  mensalEquivalente: number;
}

export interface IProjetoCalculado {
  projeto: string;
  descricao: string;
  horas: number;
  pessoas: number;
  custo: number;
  pctHoras: number;
  valorBom: number;
  coberto: number;
  saldo: number;
  pctReal: number;
}

export interface IApoioCalculado {
  colaboradores: IColaboradorCalculado[];
  totaisColaboradores: { custo: number; lancadas: number; consideradas: number; projeto: number; internas: number; dias: number; pctProjeto: number };
  operacionais: IOperacionalCalculado[];
  totaisOperacionais: { primeiroMes: number; anual: number; recorrente: number; mensalEquivalente: number };
  lancamentos: ILancamentoCalculado[];
  indicadores: {
    custoInternos: number;         // B34
    custoTerceiros: number;        // B35
    custoOperacional: number;      // B36
    custoTotalEquipe: number;      // B37
    internosConsiderados: number;  // B38
    horasDisponiveisInternos: number; // B39
    horasConsideradas: number;     // B40
    horasProjeto: number;          // B41
    horasProjetoInternos: number;  // B42
    horasProjetoTerceiros: number; // B43
    horasInternas: number;         // B44
    pctProjeto: number;            // B45
    hhEfetivo: number;             // B46
    hhInternos: number;            // B47
    hhTerceiros: number;           // B48
    custoOperacionalHora: number;  // B49
  };
  projetos: IProjetoCalculado[];
  totaisProjetos: { horas: number; custo: number; pctHoras: number; valorBom: number; coberto: number; saldo: number; pctReal: number };
}

export interface IMesHH {
  mes: string;
  custoTotal: number;     // B
  custoPessoal: number;   // C
  headcount: number;      // D
  horasProdutivas: number;// E
  hhCheio: number;        // F
  hhPessoal: number;      // G
  custoPorPessoa: number; // H
}

export interface IResultadoHH {
  premissas: {
    horasDisponiveis: number;     // B7
    horasProdutivas: number;      // B10
    terceiros: number;            // B15
    headcountTotal: number;       // B16
    pctTotal: number;             // B30
    headcountMes: Record<string, number>;
  };
  quadro: { familias: IFamiliaCalculada[]; total: IFamiliaCalculada };
  equipe: {
    itens: IItemEquipeCalculado[];
    subtotal: { primeiroMes: number; anual: number; recorrente: number };
    custoMensalEquivalente: number;   // B27
    pessoas: number;                  // B28
    horasProdutivas: number;          // B29
    hh: number;                       // B30
    hhMaoDeObra: number;              // B31
    pontosDia: number;                // B32
    pontosMes: number;                // B33
    custoPorPonto: number;            // B34
    horasHomemPorPonto: number;       // B35
  };
  apoio?: IApoioCalculado;
  custos: {
    linhas: Array<{ id: string; item: string; grupo: GrupoCusto; valores: Record<string, number>; total: number; vinculo?: string; observacao?: string }>;
    totalMes: Record<string, number>;
    total: number;
    conferencia: Record<string, number | undefined>;
    diferenca: Record<string, number>;
    porGrupo: Array<{ grupo: GrupoCusto; valores: Record<string, number>; total: number; pct: number }>;
  };
  hhMensal: { meses: IMesHH[]; media: IMesHH };
  resumo: {
    hhPorPonto: number;               // B4
    pctFixo: number;                  // B5
    pctAnalista: number;              // B6
    pctSuprimentos: number;           // B7
    bomMinimoPorPonto: number;        // B8
    valorMedioBomPonto: number;       // B9
    pctReal: number;                  // % real (linha removida da planilha; ver B10)
    leitura: string;                  // B10
    custoTotalProjeto: number;        // B13
    valorAnalista: number;            // B14
    horasAnalista: number;            // B15
    valorSuprimentos: number;         // B16
    horasSuprimentos: number;         // B17
    totalAlocado: number;             // B18
    totalHorasAlocadas: number;       // B19
    hhEquipeCampo: number;            // B22
    pessoasEquipe: number;            // B23
    horasProdutivasPessoa: number;    // B24
    pontosDia: number;                // B25
    diasUteis: number;                // B26
    pontosMes: number;                // B27
    horasHomemPorPonto: number;       // B28
    hhCheioMesRef: number;            // B32
    hhPessoalMesRef: number;          // B33
    hhCheioMedia: number;             // B34
    hhEquipe: number;                 // B35
    hhMaoDeObra: number;              // B36
    custoPorPontoEquipe: number;      // B37
    hhQuadro: number;                 // B38
    hhRh: number;                     // B39
    hhRhAjustado: number;             // B40
    diferencaQuadroRh: number;        // B41
    mesReferencia: string;            // B44
    custoMesRef: number;              // B45
    headcountMesRef: number;          // B46
    horasMesRef: number;              // B47
    horasProdutivasMes: number;       // B48
    custoMensalEquipe: number;        // B49
    pontosAtendidosMes: number;       // B50
    horasHomemPonto: number;          // B51
  };
}

// ------------------------------------------------------------
// Apoio (Implantação)
// ------------------------------------------------------------

const minutos = (hhmm: string): number => {
  const partes = String(hhmm || '').split(':');
  return n(partes[0]) * 60 + n(partes[1]) + n(partes[2]) / 60;
};

// G: MOD(fim − início; 1) × 24
export const horasDoLancamento = (inicio: string, fim: string): number => {
  const dif = minutos(fim) - minutos(inicio);
  return (((dif % 1440) + 1440) % 1440) / 60;
};

const normalizarProjeto = (projeto: string): string => String(projeto === undefined || (projeto as unknown) === null ? '' : projeto).trim();

const calcularApoio = (
  d: IDadosHH,
  salarioMedio: (familia: string) => number,
  horasDisponiveis: number
): IApoioCalculado | undefined => {

  const apoio = d.apoio;
  if (!apoio) {
    return undefined;
  }
  const p = d.premissas;

  const vinculoDe = (codigo: string): 'Interno' | 'Terceiro' => {
    const c = apoio.colaboradores.filter(x => x.codigo === codigo)[0];
    return c ? c.vinculo : 'Interno';
  };

  // Horas por lançamento (G, H, J) e total do dia (K).
  const base = apoio.lancamentos.map(l => ({
    ...l,
    projeto: normalizarProjeto(l.projeto),
    horas: horasDoLancamento(l.inicio, l.fim),
    tipo: (normalizarProjeto(l.projeto).toUpperCase() === 'INTERNO' ? 'Interno' : 'Projeto') as 'Interno' | 'Projeto',
    vinculo: vinculoDe(l.colaborador)
  }));

  const totalDia: Record<string, number> = {};
  base.forEach(l => {
    if (l.considerar) {
      const chave = `${l.colaborador}|${l.data}`;
      totalDia[chave] = (totalDia[chave] || 0) + l.horas;
    }
  });

  const lancamentos: ILancamentoCalculado[] = base.map(l => {
    const horasDia = l.considerar ? totalDia[`${l.colaborador}|${l.data}`] || 0 : 0;
    // L: interno rateado para a jornada; terceiro pelas horas lançadas.
    const horasConsideradas = !l.considerar ? 0 : l.vinculo === 'Interno' ? (horasDia > 0 ? l.horas * p.jornadaDiaria / horasDia : 0) : l.horas;
    return { ...l, horasDia, horasConsideradas };
  });

  const colaboradores: IColaboradorCalculado[] = apoio.colaboradores.map(c => {
    const meus = lancamentos.filter(l => l.colaborador === c.codigo);
    const horasLancadas = soma(meus.filter(l => l.considerar).map(l => l.horas));
    const horasConsideradas = soma(meus.map(l => l.horasConsideradas));
    const horasProjeto = soma(meus.filter(l => l.tipo === 'Projeto').map(l => l.horasConsideradas));
    const dias = Object.keys(meus.filter(l => l.considerar).reduce((m, l) => ({ ...m, [l.data]: true }), {} as Record<string, boolean>)).length;
    const custoInterno = c.vinculo === 'Interno' ? salarioMedio(c.familia) * p.fatorEncargos * (1 + (c.periculosidade ? p.periculosidade : 0)) : 0;
    const custoConsiderado = !c.incluiHH ? 0
      : c.vinculo === 'Interno' ? custoInterno * c.fracaoMes
        : c.modalidade === 'Mensal' ? c.valorContrato * c.fracaoMes
          : c.modalidade === 'Hora' ? c.valorContrato * horasConsideradas
            : c.modalidade === 'Diária' ? c.valorContrato * dias
              : 0;
    return {
      ...c,
      custoInterno,
      custoConsiderado,
      horasLancadas,
      horasConsideradas,
      horasProjeto,
      horasInternas: horasConsideradas - horasProjeto,
      dias,
      mediaDia: dias > 0 ? horasLancadas / dias : 0,
      pctProjeto: horasConsideradas > 0 ? horasProjeto / horasConsideradas : 0
    };
  });

  const totConsideradas = soma(colaboradores.map(c => c.horasConsideradas));
  const totProjeto = soma(colaboradores.map(c => c.horasProjeto));

  const operacionais: IOperacionalCalculado[] = apoio.custosOperacionais.map(o => {
    const c = custoPorTipo(o.tipo, n(o.valor), n(o.quantidade));
    return {
      ...o,
      ...c,
      mensalEquivalente: div(c.primeiroMes, p.mesesDiluicao) + c.anual / 12 + c.recorrente
    };
  });

  const incl = colaboradores.filter(c => c.incluiHH);
  const custoInternos = soma(colaboradores.filter(c => c.vinculo === 'Interno').map(c => c.custoConsiderado));
  const custoTerceiros = soma(colaboradores.filter(c => c.vinculo === 'Terceiro').map(c => c.custoConsiderado));
  const custoOperacional = soma(operacionais.map(o => o.mensalEquivalente));
  const custoTotalEquipe = custoInternos + custoTerceiros + custoOperacional;
  const internosConsiderados = soma(incl.filter(c => c.vinculo === 'Interno').map(c => c.fracaoMes));
  const horasConsideradas = soma(incl.map(c => c.horasConsideradas));
  const horasProjeto = soma(incl.map(c => c.horasProjeto));
  const horasProjetoInternos = soma(incl.filter(c => c.vinculo === 'Interno').map(c => c.horasProjeto));
  const horasProjetoTerceiros = soma(incl.filter(c => c.vinculo === 'Terceiro').map(c => c.horasProjeto));
  const hhEfetivo = horasProjeto > 0 ? custoTotalEquipe / horasProjeto : 0;

  // Projetos: os cadastrados + os que aparecem nos lançamentos.
  const ids: string[] = apoio.projetos.map(x => normalizarProjeto(x.projeto));
  lancamentos.forEach(l => {
    if (l.tipo === 'Projeto' && ids.indexOf(l.projeto) < 0) {
      ids.push(l.projeto);
    }
  });

  const horasPorProjeto = (id: string): number => soma(lancamentos.filter(l => l.projeto === id).map(l => l.horasConsideradas));
  const somaHorasProjetos = soma(ids.map(horasPorProjeto));

  const projetos: IProjetoCalculado[] = ids.map(id => {
    const cad = apoio.projetos.filter(x => normalizarProjeto(x.projeto) === id)[0];
    const horas = horasPorProjeto(id);
    const pessoas = Object.keys(lancamentos.filter(l => l.projeto === id && l.considerar).reduce((m, l) => ({ ...m, [l.colaborador]: true }), {} as Record<string, boolean>)).length;
    const custo = horas * hhEfetivo;
    const valorBom = cad ? n(cad.valorBom) : 0;
    const coberto = valorBom > 0 ? valorBom * d.premissas.pctAnalista : 0;
    return {
      projeto: id,
      descricao: cad ? cad.descricao : '',
      horas,
      pessoas,
      custo,
      pctHoras: div(horas, somaHorasProjetos),
      valorBom,
      coberto,
      saldo: valorBom > 0 ? coberto - custo : 0,
      pctReal: valorBom > 0 ? custo / valorBom : 0
    };
  });

  const totValorBom = soma(projetos.map(x => x.valorBom));
  const totCusto = soma(projetos.map(x => x.custo));

  return {
    colaboradores,
    totaisColaboradores: {
      custo: soma(colaboradores.map(c => c.custoConsiderado)),
      lancadas: soma(colaboradores.map(c => c.horasLancadas)),
      consideradas: totConsideradas,
      projeto: totProjeto,
      internas: soma(colaboradores.map(c => c.horasInternas)),
      dias: soma(colaboradores.map(c => c.dias)),
      pctProjeto: totConsideradas > 0 ? totProjeto / totConsideradas : 0
    },
    operacionais,
    totaisOperacionais: {
      primeiroMes: soma(operacionais.map(o => o.primeiroMes)),
      anual: soma(operacionais.map(o => o.anual)),
      recorrente: soma(operacionais.map(o => o.recorrente)),
      mensalEquivalente: custoOperacional
    },
    lancamentos,
    indicadores: {
      custoInternos,
      custoTerceiros,
      custoOperacional,
      custoTotalEquipe,
      internosConsiderados,
      horasDisponiveisInternos: internosConsiderados * horasDisponiveis,
      horasConsideradas,
      horasProjeto,
      horasProjetoInternos,
      horasProjetoTerceiros,
      horasInternas: horasConsideradas - horasProjeto,
      pctProjeto: horasConsideradas > 0 ? horasProjeto / horasConsideradas : 0,
      hhEfetivo,
      hhInternos: horasProjetoInternos > 0 ? custoInternos / horasProjetoInternos : 0,
      hhTerceiros: horasProjetoTerceiros > 0 ? custoTerceiros / horasProjetoTerceiros : 0,
      custoOperacionalHora: horasProjeto > 0 ? custoOperacional / horasProjeto : 0
    },
    projetos,
    totaisProjetos: {
      horas: somaHorasProjetos,
      custo: totCusto,
      pctHoras: soma(projetos.map(x => x.pctHoras)),
      valorBom: totValorBom,
      coberto: soma(projetos.map(x => x.coberto)),
      saldo: soma(projetos.map(x => x.saldo)),
      pctReal: totValorBom > 0 ? totCusto / totValorBom : 0
    }
  };
};

// ------------------------------------------------------------
// Cálculo completo
// ------------------------------------------------------------

export const calcularHH = (d: IDadosHH): IResultadoHH => {

  const p = d.premissas;
  const meses = d.meses;

  // ---- Premissas
  const horasDisponiveis = p.diasUteis * p.jornadaDiaria;                       // B7
  const horasProdutivas = p.horasMes * p.produtividade;                          // B10
  const terceiros = p.terceirosOrigem === 'equipe' && d.apoio                    // B15
    ? d.apoio.colaboradores.filter(c => c.vinculo === 'Terceiro' && c.incluiHH).length
    : n(p.terceirosManual);
  const headcountTotal = n(p.headcountInterno) + terceiros;                      // B16
  const pctTotal = n(p.pctAnalista) + n(p.pctSuprimentos);                       // B30
  const headcountMes: Record<string, number> = {};
  meses.forEach(m => {
    const v = d.headcountMes[m];
    headcountMes[m] = (v as unknown) === null || v === undefined || (v as unknown) === '' ? headcountTotal : n(v);
  });

  // ---- Quadro P.O. agregado
  const familias: IFamiliaCalculada[] = d.quadroPO.map(f => {
    const custoEncargos = n(f.salarioTotal) * p.fatorEncargos;
    const horas = n(f.posicoes) * horasProdutivas;
    return {
      familia: f.familia,
      posicoes: n(f.posicoes),
      ocupadas: f.ocupadas,
      salarioTotal: n(f.salarioTotal),
      salarioMedio: div(n(f.salarioTotal), n(f.posicoes)),
      custoEncargos,
      horasProdutivas: horas,
      hh: div(custoEncargos, horas)
    };
  });
  const totPos = soma(familias.map(f => f.posicoes));
  const totSal = soma(familias.map(f => f.salarioTotal));
  const totCusto = soma(familias.map(f => f.custoEncargos));
  const totHoras = soma(familias.map(f => f.horasProdutivas));
  const ocupadasInformadas = familias.filter(f => (f.ocupadas as unknown) !== null && f.ocupadas !== undefined);
  const quadroTotal: IFamiliaCalculada = {
    familia: 'Total',
    posicoes: totPos,
    ocupadas: ocupadasInformadas.length ? soma(ocupadasInformadas.map(f => n(f.ocupadas))) : 0,
    salarioTotal: totSal,
    salarioMedio: div(totSal, totPos),
    custoEncargos: totCusto,
    horasProdutivas: totHoras,
    hh: div(totCusto, totHoras)
  };
  // INDEX/MATCH exato; não achou → 0 (IFERROR).
  const salarioMedio = (familia: string): number => {
    const f = familias.filter(x => x.familia === familia)[0];
    return f ? f.salarioMedio : 0;
  };

  // ---- Apoio (Implantação)
  const apoio = calcularApoio(d, salarioMedio, horasDisponiveis);

  // ---- Equipe de campo
  const itens: IItemEquipeCalculado[] = d.equipeCampo.map(i => {
    const valor = i.familiaVinculada ? salarioMedio(i.familiaVinculada) * p.fatorEncargos : n(i.valor);
    return { id: i.id, item: i.item, tipo: i.tipo, valor, quantidade: n(i.quantidade), maoDeObra: i.maoDeObra, vinculado: !!i.familiaVinculada, ...custoPorTipo(i.tipo, valor, n(i.quantidade)) };
  });
  const sub = {
    primeiroMes: soma(itens.map(i => i.primeiroMes)),
    anual: soma(itens.map(i => i.anual)),
    recorrente: soma(itens.map(i => i.recorrente))
  };
  const custoMensalEquivalente = sub.recorrente + (p.mesesDiluicao === 0 ? 0 : sub.primeiroMes / p.mesesDiluicao) + sub.anual / 12; // B27
  const pessoas = n(p.pessoasEquipeCampo);                                          // B28
  const horasEquipe = pessoas * horasProdutivas;                                    // B29
  const pontosMes = n(p.pontosPorDia) * p.diasUteis;                                // B33
  const equipe = {
    itens,
    subtotal: sub,
    custoMensalEquivalente,
    pessoas,
    horasProdutivas: horasEquipe,
    hh: div(custoMensalEquivalente, horasEquipe),
    hhMaoDeObra: div(soma(itens.filter(i => i.maoDeObra).map(i => i.recorrente)), horasEquipe),
    pontosDia: n(p.pontosPorDia),
    pontosMes,
    custoPorPonto: div(custoMensalEquivalente, pontosMes),
    horasHomemPorPonto: div(horasEquipe, pontosMes)
  };

  // ---- Custo mensal
  const valorVinculado = (vinculo: string, grupo: GrupoCusto): number => {
    if (vinculo === 'quadroPO') {
      return quadroTotal.custoEncargos;
    }
    if (vinculo === 'terceiros') {
      return apoio ? apoio.indicadores.custoTerceiros : 0;
    }
    if (vinculo === 'operacional') {
      return apoio ? soma(apoio.operacionais.filter(o => o.grupo === grupo).map(o => o.mensalEquivalente)) : 0;
    }
    return 0;
  };

  const linhas = d.custos.map(l => {
    const valores: Record<string, number> = {};
    meses.forEach(m => {
      valores[m] = l.vinculo && m === (l.mesVinculo || p.mesReferencia)
        ? valorVinculado(l.vinculo, l.grupo)
        : n(l.valores[m]);
    });
    return { id: l.id, item: l.item, grupo: l.grupo, valores, total: soma(meses.map(m => valores[m])), vinculo: l.vinculo, observacao: l.observacao };
  });

  const totalMes: Record<string, number> = {};
  const conferencia: Record<string, number | undefined> = {};
  const diferenca: Record<string, number> = {};
  meses.forEach(m => {
    totalMes[m] = soma(linhas.map(l => l.valores[m]));
    const c = d.conferenciaMapa[m];
    conferencia[m] = (c as unknown) === null || c === undefined ? undefined : n(c);
    diferenca[m] = conferencia[m] === undefined ? 0 : totalMes[m] - (conferencia[m] as number);
  });
  const totalGeral = soma(meses.map(m => totalMes[m]));

  const porGrupoBase = GRUPOS_CUSTO.map(g => {
    const valores: Record<string, number> = {};
    meses.forEach(m => {
      valores[m] = soma(linhas.filter(l => l.grupo === g).map(l => l.valores[m]));
    });
    return { grupo: g, valores, total: soma(meses.map(m => valores[m])) };
  });
  const totalGrupos = soma(porGrupoBase.map(g => g.total));
  const porGrupo = porGrupoBase.map(g => ({ ...g, pct: div(g.total, totalGrupos) }));
  const pessoal = porGrupo.filter(g => g.grupo === 'Pessoal')[0];

  // ---- HH mensal
  const mesesHH: IMesHH[] = meses.map(m => {
    const custo = totalMes[m];
    const custoPessoal = pessoal.valores[m];
    const hc = headcountMes[m];
    const horas = hc * horasProdutivas;
    return {
      mes: m,
      custoTotal: custo,
      custoPessoal,
      headcount: hc,
      horasProdutivas: horas,
      hhCheio: custo === 0 || horas === 0 ? 0 : custo / horas,
      hhPessoal: custo === 0 || horas === 0 ? 0 : custoPessoal / horas,
      custoPorPessoa: custo === 0 || hc === 0 ? 0 : custo / hc
    };
  });
  const comCusto = mesesHH.filter(x => x.custoTotal > 0);
  const somaCusto = soma(mesesHH.map(x => x.custoTotal));
  const somaPessoal = soma(mesesHH.map(x => x.custoPessoal));
  const mediaHc = comCusto.length === 0 ? 0 : soma(comCusto.map(x => x.headcount)) / comCusto.length;
  const horasComCusto = soma(comCusto.map(x => x.horasProdutivas));
  const media: IMesHH = {
    mes: 'Média',
    custoTotal: somaCusto,
    custoPessoal: somaPessoal,
    headcount: mediaHc,
    horasProdutivas: horasComCusto,
    hhCheio: div(somaCusto, horasComCusto),
    hhPessoal: div(somaPessoal, horasComCusto),
    custoPorPessoa: mediaHc === 0 || comCusto.length === 0 ? 0 : somaCusto / comCusto.length / mediaHc
  };
  const mesRef = mesesHH.filter(x => x.mes === p.mesReferencia)[0];

  // ---- Resumo HH
  const horasHomemPorPonto = div(pessoas * horasProdutivas, pontosMes);             // B28
  const hhPorPonto = equipe.hh * horasHomemPorPonto;                                // B29 → B4
  const valorMedioBomPonto = n(p.valorMedioBomPonto);
  const pctReal = valorMedioBomPonto > 0 ? hhPorPonto / valorMedioBomPonto : 0;
  const leitura = pctTotal === 0
    ? 'Informe o % fixo aplicado no B.O.M nas premissas.'
    : valorMedioBomPonto === 0
      ? 'Informe o valor médio do B.O.M por ponto nas premissas para calcular o % real.'
      : pctReal <= pctTotal
        ? '% real menor ou igual ao % fixo: o % aplicado cobre o HH do ponto.'
        : '% real maior que o % fixo: o % aplicado não cobre o HH do ponto, revisar.';

  const custoTotalProjeto = n(p.custoTotalProjeto);
  const valorAnalista = custoTotalProjeto * n(p.pctAnalista);
  const horasAnalista = div(valorAnalista, n(p.valorHoraAnalista));
  const valorSuprimentos = custoTotalProjeto * n(p.pctSuprimentos);
  const horasSuprimentos = div(valorSuprimentos, n(p.valorHoraSuprimentos));
  const hhRhAjustado = div(n(p.hhReferenciaRh), p.produtividade);

  return {
    premissas: { horasDisponiveis, horasProdutivas, terceiros, headcountTotal, pctTotal, headcountMes },
    quadro: { familias, total: quadroTotal },
    equipe,
    apoio,
    custos: { linhas, totalMes, total: totalGeral, conferencia, diferenca, porGrupo },
    hhMensal: { meses: mesesHH, media },
    resumo: {
      hhPorPonto,
      pctFixo: pctTotal,
      pctAnalista: n(p.pctAnalista),
      pctSuprimentos: n(p.pctSuprimentos),
      bomMinimoPorPonto: div(hhPorPonto, pctTotal),
      valorMedioBomPonto,
      pctReal,
      leitura,
      custoTotalProjeto,
      valorAnalista,
      horasAnalista,
      valorSuprimentos,
      horasSuprimentos,
      totalAlocado: valorAnalista + valorSuprimentos,
      totalHorasAlocadas: horasAnalista + horasSuprimentos,
      hhEquipeCampo: equipe.hh,
      pessoasEquipe: pessoas,
      horasProdutivasPessoa: horasProdutivas,
      pontosDia: n(p.pontosPorDia),
      diasUteis: p.diasUteis,
      pontosMes,
      horasHomemPorPonto,
      hhCheioMesRef: mesRef ? mesRef.hhCheio : 0,
      hhPessoalMesRef: mesRef ? mesRef.hhPessoal : 0,
      hhCheioMedia: media.hhCheio,
      hhEquipe: equipe.hh,
      hhMaoDeObra: equipe.hhMaoDeObra,
      custoPorPontoEquipe: equipe.custoPorPonto,
      hhQuadro: quadroTotal.hh,
      hhRh: n(p.hhReferenciaRh),
      hhRhAjustado,
      diferencaQuadroRh: hhRhAjustado === 0 ? 0 : quadroTotal.hh / hhRhAjustado - 1,
      mesReferencia: p.mesReferencia,
      custoMesRef: mesRef ? mesRef.custoTotal : 0,
      headcountMesRef: mesRef ? mesRef.headcount : 0,
      horasMesRef: mesRef ? mesRef.horasProdutivas : 0,
      horasProdutivasMes: horasProdutivas,
      custoMensalEquipe: equipe.custoMensalEquivalente,
      pontosAtendidosMes: equipe.pontosMes,
      horasHomemPonto: equipe.horasHomemPorPonto
    }
  };
};

// ------------------------------------------------------------
// Uso no B.O.M.
// ------------------------------------------------------------

export interface IHHParaBom {
  area: string;
  hhPorPonto: number;
  pontos: number;
  hhPontos: number;           // pontos × HH por ponto
  pctFixo: number;
  custoTotalProjeto: number;
  valorAnalista: number;
  horasAnalista: number;
  valorSuprimentos: number;
  horasSuprimentos: number;
}

// Aplica os valores de uma área a um B.O.M. (pontos do kit e, se
// houver, o custo total do projeto).
export const hhParaBom = (
  area: string,
  dados: IDadosHH,
  pontos: number,
  custoTotalProjeto: number
): IHHParaBom => {
  const r = calcularHH({ ...dados, premissas: { ...dados.premissas, custoTotalProjeto } });
  return {
    area,
    hhPorPonto: r.resumo.hhPorPonto,
    pontos,
    hhPontos: r.resumo.hhPorPonto * pontos,
    pctFixo: r.resumo.pctFixo,
    custoTotalProjeto,
    valorAnalista: r.resumo.valorAnalista,
    horasAnalista: r.resumo.horasAnalista,
    valorSuprimentos: r.resumo.valorSuprimentos,
    horasSuprimentos: r.resumo.horasSuprimentos
  };
};
