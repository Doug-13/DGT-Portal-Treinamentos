import {
  IAnaliseIaLicitacao,
  IEntradaAnaliseIa,
  RecomendacaoIa
} from '../../models/LicitacaoIa';

import {
  normalizarTexto
} from '../../utils/licitacoesFiltro';

// ============================================================
// PROVEDORES DE IA
//
// A tela não sabe QUAL IA está por trás: ela usa IProvedorIa.
//
//   ProvedorIaSimulado  funciona já, sem custo e sem enviar dados
//                       para fora. Usa o histórico de pareceres da
//                       DGT (semelhança de objeto) + aderência.
//
//   ProvedorIaApi       PRONTO PARA LIGAR. Envia { sistema, mensagem,
//                       modelo, temperatura, maxTokens } a um serviço
//                       nosso (ex.: Azure Function protegida pelo Entra
//                       ID) que chama o modelo de IA e devolve o texto.
//                       A CHAVE DA IA NUNCA FICA NO NAVEGADOR.
//
// Para ligar a API: implementar a função "enviar" (ver
// criarProvedorIa) com o AadHttpClient do web part e trocar, na
// configuração do prompt, o provedor para "api".
// ============================================================

export interface IProvedorIa {
  readonly tipo: 'simulado' | 'api';
  analisar(entrada: IEntradaAnaliseIa): Promise<Omit<IAnaliseIaLicitacao, 'chaveEdital' | 'geradaEm'>>;
}

// Formato que a IA deve devolver (vai no prompt e é validado aqui).
export const FORMATO_RESPOSTA_IA = `Responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato:
{
  "recomendacao": "Participar" | "NaoParticipar" | "Avaliar",
  "confianca": número de 0 a 100,
  "resumo": "até 3 frases sobre a oportunidade",
  "pontosFavoraveis": ["..."],
  "riscos": ["..."],
  "justificativaSugerida": "texto curto para o parecer da DGT",
  "semelhantes": ["editais do histórico que pesaram na decisão"]
}`;

const lista = (valor: unknown): string[] =>
  Array.isArray(valor)
    ? valor.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
    : [];

const recomendacaoValida = (valor: unknown): RecomendacaoIa => {
  const t = normalizarTexto(valor);
  if (/^nao|^não|nao ?particip/.test(t)) {
    return 'NaoParticipar';
  }
  if (/^particip/.test(t)) {
    return 'Participar';
  }
  return 'Avaliar';
};

// Lê a resposta da IA (aceita JSON cercado por ```json ... ```).
export const interpretarRespostaIa = (
  texto: string
): Pick<IAnaliseIaLicitacao, 'recomendacao' | 'confianca' | 'resumo' | 'pontosFavoraveis' | 'riscos' | 'justificativaSugerida' | 'semelhantes'> => {

  const limpo = (texto || '').replace(/```json|```/gi, '').trim();
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');

  if (inicio < 0 || fim <= inicio) {
    throw new Error('A IA não devolveu um JSON válido.');
  }

  const dados = JSON.parse(limpo.substring(inicio, fim + 1)) as Record<string, unknown>;
  const confianca = Math.round(Number(dados.confianca));

  return {
    recomendacao: recomendacaoValida(dados.recomendacao),
    confianca: isNaN(confianca) ? 50 : Math.max(0, Math.min(100, confianca)),
    resumo: String(dados.resumo || '').trim().substring(0, 1500),
    pontosFavoraveis: lista(dados.pontosFavoraveis),
    riscos: lista(dados.riscos),
    justificativaSugerida: String(dados.justificativaSugerida || '').trim().substring(0, 2000),
    semelhantes: lista(dados.semelhantes)
  };
};

// ------------------------------------------------------------
// Simulado (regras + histórico)
// ------------------------------------------------------------

export class ProvedorIaSimulado implements IProvedorIa {

  public readonly tipo = 'simulado' as const;

  public async analisar(
    entrada: IEntradaAnaliseIa
  ): Promise<Omit<IAnaliseIaLicitacao, 'chaveEdital' | 'geradaEm'>> {

    const { edital, historico } = entrada;

    // Peso dos semelhantes (só os com semelhança relevante).
    const relevantes = historico.filter(h => h.semelhanca >= 0.15);
    let pesoSim = 0;
    let pesoNao = 0;
    relevantes.forEach(h => {
      if (h.decisao === 'Participar') {
        pesoSim += h.semelhanca;
      } else {
        pesoNao += h.semelhanca;
      }
    });

    const totalPeso = pesoSim + pesoNao;
    const tendencia = totalPeso > 0 ? (pesoSim - pesoNao) / totalPeso : 0; // -1..1
    const aderencia = (edital.aderenciaBusca - 50) / 50;                      // -1..1

    const pontuacao = relevantes.length > 0
      ? tendencia * 0.7 + aderencia * 0.3
      : aderencia * 0.6;

    const recomendacao: RecomendacaoIa =
      pontuacao >= 0.25 ? 'Participar' : pontuacao <= -0.25 ? 'NaoParticipar' : 'Avaliar';

    const confianca = Math.round(
      Math.min(95, 40 + Math.abs(pontuacao) * 40 + Math.min(relevantes.length, 5) * 3)
    );

    const pontosFavoraveis: string[] = [];
    const riscos: string[] = [];

    if (edital.aderenciaBusca >= 60) {
      pontosFavoraveis.push(`Aderência de ${edital.aderenciaBusca}% aos critérios da busca.`);
    } else {
      riscos.push(`Aderência baixa (${edital.aderenciaBusca}%) aos critérios da busca.`);
    }

    const simParecidos = relevantes.filter(h => h.decisao === 'Participar');
    const naoParecidos = relevantes.filter(h => h.decisao === 'NaoParticipar');

    if (simParecidos.length > 0) {
      pontosFavoraveis.push(`${simParecidos.length} edital(is) parecido(s) em que a DGT decidiu participar.`);
    }
    if (naoParecidos.length > 0) {
      riscos.push(
        `${naoParecidos.length} edital(is) parecido(s) descartado(s). Motivo mais recente: ` +
        `"${naoParecidos[0].justificativa.substring(0, 140)}"`
      );
    }
    if (relevantes.length === 0) {
      riscos.push('Sem histórico parecido: a decisão depende da avaliação da equipe.');
    }

    const resumo =
      relevantes.length > 0
        ? `Comparado a ${relevantes.length} parecer(es) semelhante(s) da DGT, a tendência é "${recomendacao === 'Participar' ? 'participar' : recomendacao === 'NaoParticipar' ? 'não participar' : 'avaliar caso a caso'}".`
        : 'Não há pareceres anteriores parecidos; a sugestão considera só a aderência da busca.';

    return {
      recomendacao,
      confianca,
      resumo,
      pontosFavoraveis,
      riscos,
      justificativaSugerida:
        recomendacao === 'NaoParticipar' && naoParecidos.length > 0
          ? `Semelhante a editais já descartados: ${naoParecidos[0].justificativa}`.substring(0, 600)
          : recomendacao === 'Participar' && simParecidos.length > 0
            ? `Semelhante a editais em que a DGT participou: ${simParecidos[0].justificativa}`.substring(0, 600)
            : '',
      semelhantes: relevantes.slice(0, 3).map(h =>
        `${h.decisao === 'Participar' ? '✓' : '✕'} ${h.orgao} — ${h.objeto.substring(0, 90)}`),
      provedor: 'simulado',
      modeloIa: 'simulado (histórico + aderência)',
      promptVersao: entrada.prompt.versao
    };
  }
}

// ------------------------------------------------------------
// API (pronto para ligar)
// ------------------------------------------------------------

export interface IRequisicaoIa {
  sistema: string;
  mensagem: string;
  modelo: string;
  temperatura: number;
  maxTokens: number;
}

// Função que envia a requisição ao NOSSO serviço e devolve o texto
// gerado pela IA. Implementada no web part (AadHttpClient).
export type EnviarParaIa = (requisicao: IRequisicaoIa) => Promise<string>;

export class ProvedorIaApi implements IProvedorIa {

  public readonly tipo = 'api' as const;

  private readonly enviar: EnviarParaIa;

  public constructor(enviar: EnviarParaIa) {
    this.enviar = enviar;
  }

  public async analisar(
    entrada: IEntradaAnaliseIa
  ): Promise<Omit<IAnaliseIaLicitacao, 'chaveEdital' | 'geradaEm'>> {

    const texto = await this.enviar({
      sistema: entrada.sistema,
      mensagem: entrada.mensagem,
      modelo: entrada.prompt.modeloIa || 'claude-sonnet-5-5',
      temperatura: entrada.prompt.temperatura,
      maxTokens: entrada.prompt.maxTokens
    });

    return {
      ...interpretarRespostaIa(texto),
      provedor: 'api',
      modeloIa: entrada.prompt.modeloIa,
      promptVersao: entrada.prompt.versao
    };
  }
}

// Escolhe o provedor. Sem "enviar" configurado, cai no simulado.
export const criarProvedorIa = (
  tipo: 'simulado' | 'api',
  enviar?: EnviarParaIa
): IProvedorIa =>
  tipo === 'api' && enviar
    ? new ProvedorIaApi(enviar)
    : new ProvedorIaSimulado();
