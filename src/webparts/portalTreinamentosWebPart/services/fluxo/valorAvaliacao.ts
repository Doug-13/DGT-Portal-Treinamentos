// ============================================================
// CAMPO "AVALIAÇÃO" (matriz de critérios com nota e peso)
//
// Inspirado na Matriz Go/No-Go da Arquitetura de Soluções:
//   - critérios com descrição e PESO
//   - escala de notas (ex.: 1 a 5) com cores do vermelho ao verde e
//     um rótulo por nota ("Muito favorável"...)
//   - CÁLCULO:
//       'ponderada' → pontuação de 0 a 100 (nota/máximo × peso, com os
//                     pesos normalizados para somar 100)
//       'soma'      → soma simples de nota × peso (pontos absolutos)
//   - FAIXAS (sinaleira): a partir de qual pontuação vale cada
//     resultado (ex.: ≥ 80 GO, ≥ 60 GO com restrição, senão NO-GO)
//   - justificativa por critério (opcional ou obrigatória abaixo de
//     uma nota)
//
// Valor gravado (JSON): { notas, justificativas, total, faixa }.
// "faixa" é a chave da faixa atingida — é o que as condições do fluxo
// e os filtros dos ambientes comparam (ex.: quando faixa = "nogo").
// ============================================================

export interface ICriterioAvaliacao {
  chave: string;
  rotulo: string;
  descricao?: string;
  peso: number;
}

export interface IFaixaAvaliacao {
  chave: string;
  rotulo: string;
  // Pontuação mínima para cair nesta faixa (a maior faixa atingida vale).
  minimo: number;
  cor: string;
}

export interface IConfigAvaliacao {
  criterios: ICriterioAvaliacao[];
  escala: {
    minimo: number;
    maximo: number;
    // Um rótulo por nota, do mínimo ao máximo (opcional).
    rotulos?: string[];
  };
  calculo: 'ponderada' | 'soma';
  faixas: IFaixaAvaliacao[];
  // Justificativa obrigatória para notas MENORES ou iguais a este valor.
  justificativaAte?: number;
}

export interface IValorAvaliacao {
  notas: Record<string, number>;
  justificativas?: Record<string, string>;
  total?: number;
  faixa?: string;
  faixaRotulo?: string;
}

export interface IResultadoAvaliacao {
  // Pontos de cada critério e quanto ele "perde" em relação ao máximo.
  itens: Array<{ chave: string; rotulo: string; nota?: number; pontos: number; maximo: number; perdidos: number }>;
  total: number;
  maximo: number;
  // 0 a 100 (para a barra), em qualquer cálculo.
  percentual: number;
  completo: boolean;
  faixa?: IFaixaAvaliacao;
}

// ------------------------------------------------------------
// Modelo pronto (Matriz Go/No-Go da Arquitetura de Soluções)
// ------------------------------------------------------------

export const ROTULOS_ESCALA_PADRAO = ['Muito desfavorável', 'Desfavorável', 'Aceitável', 'Favorável', 'Muito favorável'];

export const configAvaliacaoPadrao = (): IConfigAvaliacao => ({
  criterios: [
    { chave: 'aderencia', rotulo: 'Aderência ao portfólio', descricao: 'Compatibilidade com soluções e capacidades da empresa', peso: 20 },
    { chave: 'tecnica', rotulo: 'Viabilidade técnica', descricao: 'Capacidade real de implementação', peso: 20 },
    { chave: 'financeira', rotulo: 'Viabilidade financeira', descricao: 'Margem, orçamento e sustentabilidade', peso: 15 },
    { chave: 'prazo', rotulo: 'Prazo', descricao: 'Tempo disponível para executar', peso: 10 },
    { chave: 'competitividade', rotulo: 'Competitividade', descricao: 'Posicionamento frente à concorrência', peso: 10 },
    { chave: 'risco', rotulo: 'Risco jurídico', descricao: 'Risco de exigências críticas', peso: 10 },
    { chave: 'capacidade', rotulo: 'Capacidade operacional', descricao: 'Disponibilidade do time', peso: 10 },
    { chave: 'estrategico', rotulo: 'Impacto estratégico', descricao: 'Relevância para crescimento', peso: 5 }
  ],
  escala: { minimo: 1, maximo: 5, rotulos: ROTULOS_ESCALA_PADRAO.slice() },
  calculo: 'ponderada',
  faixas: [
    { chave: 'go', rotulo: 'GO', minimo: 80, cor: '#107C10' },
    { chave: 'restricao', rotulo: 'GO com restrição', minimo: 60, cor: '#B45309' },
    { chave: 'nogo', rotulo: 'NO-GO', minimo: 0, cor: '#B42318' }
  ]
});

// ------------------------------------------------------------
// Leitura e cálculo
// ------------------------------------------------------------

export const lerValorAvaliacao = (
  valor?: string
): IValorAvaliacao | undefined => {
  const texto = (valor || '').trim();
  if (texto.charAt(0) !== '{') {
    return undefined;
  }
  try {
    const objeto = JSON.parse(texto) as IValorAvaliacao;
    return objeto && typeof objeto === 'object' && objeto.notas && typeof objeto.notas === 'object'
      ? objeto
      : undefined;
  } catch {
    return undefined;
  }
};

const arredondar = (valor: number): number => Math.round(valor * 10) / 10;

export const faixaDaPontuacao = (
  config: IConfigAvaliacao,
  pontuacao: number
): IFaixaAvaliacao | undefined =>
  config.faixas
    .slice()
    .sort((a, b) => b.minimo - a.minimo)
    .find(faixa => pontuacao >= faixa.minimo);

export const calcularAvaliacao = (
  config: IConfigAvaliacao,
  notas: Record<string, number>
): IResultadoAvaliacao => {

  const maximoNota = config.escala.maximo;
  const somaPesos = config.criterios.reduce((total, item) => total + Math.max(0, Number(item.peso) || 0), 0) || 1;
  const ponderada = config.calculo !== 'soma';

  const itens = config.criterios.map(criterio => {
    const peso = Math.max(0, Number(criterio.peso) || 0);
    // Ponderada: o critério vale peso/somaPesos × 100 pontos.
    const maximo = ponderada ? (peso / somaPesos) * 100 : peso * maximoNota;
    const nota = notas[criterio.chave];
    const temNota = typeof nota === 'number' && nota >= config.escala.minimo && nota <= maximoNota;
    const pontos = temNota ? (ponderada ? (nota / maximoNota) * maximo : nota * peso) : 0;
    return {
      chave: criterio.chave,
      rotulo: criterio.rotulo,
      nota: temNota ? nota : undefined,
      pontos: arredondar(pontos),
      maximo: arredondar(maximo),
      perdidos: temNota ? arredondar(maximo - pontos) : 0
    };
  });

  const total = arredondar(itens.reduce((soma, item) => soma + item.pontos, 0));
  const maximo = arredondar(itens.reduce((soma, item) => soma + item.maximo, 0));
  const completo = itens.every(item => item.nota !== undefined);

  return {
    itens,
    total,
    maximo,
    percentual: maximo > 0 ? Math.min(100, Math.max(0, (total / maximo) * 100)) : 0,
    completo,
    // As faixas comparam a pontuação total (0–100 na ponderada).
    faixa: completo ? faixaDaPontuacao(config, total) : undefined
  };
};

// Monta o JSON gravado (com total e faixa já calculados).
export const gravarValorAvaliacao = (
  config: IConfigAvaliacao,
  notas: Record<string, number>,
  justificativas: Record<string, string>
): string => {
  const resultado = calcularAvaliacao(config, notas);
  const justificativasPreenchidas: Record<string, string> = {};
  Object.keys(justificativas).forEach(chave => {
    if ((justificativas[chave] || '').trim()) {
      justificativasPreenchidas[chave] = justificativas[chave].trim();
    }
  });
  if (Object.keys(notas).length === 0 && Object.keys(justificativasPreenchidas).length === 0) {
    return '';
  }
  return JSON.stringify({
    notas,
    justificativas: justificativasPreenchidas,
    total: resultado.total,
    faixa: resultado.faixa ? resultado.faixa.chave : undefined,
    faixaRotulo: resultado.faixa ? resultado.faixa.rotulo : undefined
  });
};

// Validação ao concluir a etapa.
export const validarAvaliacao = (
  rotulo: string,
  config: IConfigAvaliacao | undefined,
  valor: string,
  obrigatorio: boolean
): string[] => {
  if (!config) {
    return [];
  }
  const lido = lerValorAvaliacao(valor);
  const notas = lido ? lido.notas : {};
  const faltando = config.criterios.filter(item => typeof notas[item.chave] !== 'number');
  const erros: string[] = [];
  if (obrigatorio && faltando.length > 0) {
    erros.push(`"${rotulo}": dê nota a ${faltando.length === config.criterios.length ? 'todos os critérios' : faltando.map(item => item.rotulo).join(', ')}.`);
  }
  if (config.justificativaAte !== undefined && lido) {
    config.criterios
      .filter(item => typeof notas[item.chave] === 'number' && notas[item.chave] <= (config.justificativaAte as number))
      .filter(item => !((lido.justificativas || {})[item.chave] || '').trim())
      .forEach(item => erros.push(`"${rotulo}": justifique a nota de "${item.rotulo}" (nota ${notas[item.chave]}).`));
  }
  return erros;
};

// Texto curto (listas, histórico, colunas): "GO · 92/100".
export const formatarValorAvaliacao = (
  valor: string,
  config?: IConfigAvaliacao
): string => {
  const lido = lerValorAvaliacao(valor);
  if (!lido) {
    return '';
  }
  if (config) {
    const resultado = calcularAvaliacao(config, lido.notas);
    const pontos = config.calculo === 'soma' ? `${resultado.total}/${resultado.maximo}` : `${Math.round(resultado.total)}/100`;
    return resultado.faixa ? `${resultado.faixa.rotulo} · ${pontos}` : `${pontos} (incompleta)`;
  }
  return lido.total !== undefined
    ? `${lido.faixaRotulo || lido.faixa ? `${lido.faixaRotulo || lido.faixa} · ` : ''}${lido.total} pts`
    : 'Avaliação (incompleta)';
};

// Faixa gravada no valor (condições do fluxo e filtros).
export const faixaDoValor = (valor?: string): string | undefined => {
  const lido = lerValorAvaliacao(valor);
  return lido && lido.faixa ? lido.faixa : undefined;
};

// ------------------------------------------------------------
// Cores da escala (vermelho → verde) e rótulos
// ------------------------------------------------------------

const CORES_ESCALA = ['#D13438', '#E8661A', '#C9A227', '#4CAF50', '#0E8A4F'];

export const corDaNota = (
  nota: number,
  minimo: number,
  maximo: number
): string => {
  if (maximo <= minimo) {
    return CORES_ESCALA[CORES_ESCALA.length - 1];
  }
  const posicao = (nota - minimo) / (maximo - minimo);
  return CORES_ESCALA[Math.min(CORES_ESCALA.length - 1, Math.max(0, Math.round(posicao * (CORES_ESCALA.length - 1))))];
};

export const rotuloDaNota = (
  config: IConfigAvaliacao,
  nota: number
): string => {
  const rotulos = config.escala.rotulos || [];
  return rotulos[nota - config.escala.minimo] || '';
};

// ------------------------------------------------------------
// Validação da configuração (cadastro de metadados e pacote JSON)
// ------------------------------------------------------------

export const validarConfigAvaliacao = (
  rotulo: string,
  config?: IConfigAvaliacao
): string[] => {
  if (!config) {
    return [`Configure os critérios da avaliação "${rotulo}".`];
  }
  const erros: string[] = [];
  if (!config.criterios || config.criterios.length === 0) {
    erros.push(`A avaliação "${rotulo}" precisa de pelo menos um critério.`);
  }
  const chaves: string[] = [];
  (config.criterios || []).forEach(item => {
    if (!/^[a-z][A-Za-z0-9]{0,49}$/.test(item.chave || '')) {
      erros.push(`Critério "${item.rotulo || item.chave}" da avaliação "${rotulo}": chave inválida (camelCase sem acento).`);
    }
    if (chaves.indexOf(item.chave) >= 0) {
      erros.push(`Critério repetido na avaliação "${rotulo}": ${item.chave}.`);
    }
    chaves.push(item.chave);
    if (!(item.rotulo || '').trim()) {
      erros.push(`Há um critério sem nome na avaliação "${rotulo}".`);
    }
    if (!(Number(item.peso) > 0)) {
      erros.push(`O critério "${item.rotulo}" da avaliação "${rotulo}" precisa de peso maior que zero.`);
    }
  });
  const escala = config.escala || { minimo: 1, maximo: 5 };
  if (!(Number.isInteger(escala.minimo) && Number.isInteger(escala.maximo) && escala.minimo >= 0 && escala.maximo > escala.minimo && escala.maximo <= 10)) {
    erros.push(`A escala da avaliação "${rotulo}" deve ir de um número inteiro a outro maior (até 10), ex.: 1 a 5.`);
  }
  if (!config.faixas || config.faixas.length === 0) {
    erros.push(`A avaliação "${rotulo}" precisa de pelo menos uma faixa de resultado.`);
  } else {
    if (!config.faixas.some(faixa => Number(faixa.minimo) <= 0)) {
      erros.push(`A avaliação "${rotulo}" precisa de uma faixa com mínimo 0 (para qualquer pontuação cair em alguma).`);
    }
    config.faixas.forEach(faixa => {
      if (!/^[a-z][A-Za-z0-9]{0,29}$/.test(faixa.chave || '') || !(faixa.rotulo || '').trim()) {
        erros.push(`Faixa "${faixa.rotulo || faixa.chave}" da avaliação "${rotulo}": informe chave (camelCase) e nome.`);
      }
    });
  }
  return erros;
};
