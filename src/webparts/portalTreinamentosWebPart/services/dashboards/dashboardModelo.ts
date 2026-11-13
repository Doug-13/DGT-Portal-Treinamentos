// ============================================================
// DASHBOARDS DO PORTAL — FORMATO "dgt-portal/dashboard@1"
//
// A definição (JSON) é gerada pela skill "dashboard-dgt" do Claude e
// importada na aba Indicadores. O portal busca os dados ao vivo no
// Dataverse (fontes do catálogo, em fontesDashboard.ts), aplica o
// filtro de área de quem está vendo e desenha cartões, gráficos e
// tabelas.
//
// {
//   "formato": "dgt-portal/dashboard@1",
//   "titulo": "Orçamento da área", "descricao": "…",
//   "filtros": { "ano": true, "area": true },
//   "secoes": [ { "titulo": "…", "pagina"?: "…", "itens": [ ITEM, … ] } ]
// }
//
// PÁGINAS (opcional): seções com o mesmo "pagina" formam uma aba do
// painel (como as páginas do Power BI). Seção sem "pagina" fica na
// página da seção anterior (a primeira, em "Visão geral"). Sem nenhum
// "pagina", o painel tem uma página só, como antes.
//
// ITEM:
//  cartao  { tipo, titulo, fonte, medida, agregacao, filtro?, formato?,
//            comparar?: { medida, agregacao?, rotulo?, direcao? } }
//  grafico { tipo, grafico: barras|barrasEmpilhadas|linhas|rosca,
//            titulo, fonte, dimensao, series: [{ medida, agregacao?, rotulo? }],
//            serieDimensao?, filtro?, formato?, ordenar?, limite?, largura? }
//  tabela  { tipo, titulo, fonte, dimensoes: [campo], medidas: [{ medida,
//            agregacao?, rotulo? }] | colunas: [campo], filtro?, formato?,
//            ordenar?, limite?, largura? }
//
// filtro: { campo: valor | [valores] }  (igual a / um de)
// agregacao: soma | media | contagem | contagemDistinta | minimo | maximo
// formato: moeda | numero | percentual | inteiro
// ordenar: "valor desc" | "valor asc" | "dimensao asc" | "<campo> desc"
//          | "nenhum" (mantém a ordem da fonte, ex.: linhas da DRE)
//
// ASSISTENTE DE IA (opcional) — caixa de perguntas no fim do painel:
//  "assistente": { ativo, escopo, fontes?, perguntasSugeridas?,
//                  camposOcultos?, modelo? }
//  A IA responde SOMENTE com os dados que o painel carregou para quem
//  está vendo (filtros de ano e área já aplicados). O escopo é lido
//  pelo plugin direto do registro do dashboard no Dataverse: o
//  navegador não consegue trocá-lo.
// ============================================================

export const FORMATO_DASHBOARD = 'dgt-portal/dashboard@1';

export type TipoCampo = 'texto' | 'numero' | 'data' | 'mes';

export interface ICampoFonte {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  descricao?: string;
  // Valores aceitos em filtros (quando a lista é fechada).
  valores?: string[];
}

export interface IDescricaoFonte {
  id: string;
  nome: string;
  descricao: string;
  campos: ICampoFonte[];
}

export type Agregacao = 'soma' | 'media' | 'contagem' | 'contagemDistinta' | 'minimo' | 'maximo';
export type FormatoValor = 'moeda' | 'numero' | 'percentual' | 'inteiro';
export type TipoGrafico = 'barras' | 'barrasEmpilhadas' | 'linhas' | 'rosca';

export type Filtro = { [campo: string]: string | number | boolean | Array<string | number | boolean> };

export interface IMedida {
  medida: string;
  agregacao?: Agregacao;
  rotulo?: string;
}

export interface IItemCartao {
  tipo: 'cartao';
  titulo: string;
  fonte: string;
  medida: string;
  agregacao?: Agregacao;
  filtro?: Filtro;
  formato?: FormatoValor;
  // Compara com outra medida (ex.: executado × orçado) e mostra o farol:
  // verde ≥ 80%, amarelo 70–79%, vermelho < 70% (direcao "menor": a
  // relação é invertida, como em custos).
  comparar?: IMedida & { direcao?: 'maior' | 'menor' };
}

export interface IItemGrafico {
  tipo: 'grafico';
  grafico: TipoGrafico;
  titulo: string;
  fonte: string;
  dimensao: string;
  series: IMedida[];
  // Gráfico de barras empilhadas/linhas: uma série por valor deste campo.
  serieDimensao?: string;
  filtro?: Filtro;
  formato?: FormatoValor;
  ordenar?: string;
  limite?: number;
  largura?: 1 | 2;
}

export interface IItemTabela {
  tipo: 'tabela';
  titulo: string;
  fonte: string;
  dimensoes?: string[];
  medidas?: IMedida[];
  colunas?: string[];
  filtro?: Filtro;
  formato?: FormatoValor;
  ordenar?: string;
  limite?: number;
  largura?: 1 | 2;
}

export type ItemDashboard = IItemCartao | IItemGrafico | IItemTabela;

export interface ISecaoDashboard {
  titulo: string;
  descricao?: string;
  // Página (aba) do painel em que a seção aparece.
  pagina?: string;
  itens: ItemDashboard[];
}

export const PAGINA_PADRAO = 'Visão geral';
export const LIMITE_TITULO_PAGINA = 40;

export interface IPaginaDashboard {
  titulo: string;
  // Seções da página, com o índice original (para chaves estáveis).
  secoes: Array<{ secao: ISecaoDashboard; indice: number }>;
}

// Agrupa as seções em páginas, na ordem em que aparecem.
export const paginasDoDashboard = (definicao: IDefinicaoDashboard): IPaginaDashboard[] => {
  const paginas: IPaginaDashboard[] = [];
  let atual = '';
  definicao.secoes.forEach((secao, indice) => {
    const nome = (secao.pagina || '').trim() || atual || PAGINA_PADRAO;
    atual = nome;
    let pagina = paginas.filter(item => item.titulo === nome)[0];
    if (!pagina) {
      pagina = { titulo: nome, secoes: [] };
      paginas.push(pagina);
    }
    pagina.secoes.push({ secao, indice });
  });
  return paginas;
};

export interface IAssistenteDashboard {
  ativo: boolean;
  // Assunto do painel e limites das respostas (vai nas instruções da IA).
  escopo: string;
  // Fontes que a IA pode usar (padrão: as fontes usadas no painel).
  fontes?: string[];
  // Até 6 atalhos exibidos acima da caixa de perguntas.
  perguntasSugeridas?: string[];
  // Campos que nunca vão para a IA (além dos pessoais, sempre ocultos).
  camposOcultos?: string[];
  // Modelo de IA (precisa estar liberado no passo do plugin).
  modelo?: string;
}

export interface IDefinicaoDashboard {
  formato: string;
  titulo: string;
  descricao?: string;
  filtros?: { ano?: boolean; area?: boolean };
  secoes: ISecaoDashboard[];
  assistente?: IAssistenteDashboard;
}

export const LIMITE_ESCOPO_ASSISTENTE = 2000;
export const LIMITE_PERGUNTAS_SUGERIDAS = 6;

export type Linha = { [campo: string]: string | number | boolean | undefined };

const AGREGACOES: Agregacao[] = ['soma', 'media', 'contagem', 'contagemDistinta', 'minimo', 'maximo'];
const FORMATOS: FormatoValor[] = ['moeda', 'numero', 'percentual', 'inteiro'];
const GRAFICOS: TipoGrafico[] = ['barras', 'barrasEmpilhadas', 'linhas', 'rosca'];

// Fontes usadas por uma definição (para carregar só o necessário).
export const fontesUsadas = (definicao: IDefinicaoDashboard): string[] => {
  const lista: string[] = [];
  definicao.secoes.forEach(secao => secao.itens.forEach(item => {
    if (lista.indexOf(item.fonte) < 0) {
      lista.push(item.fonte);
    }
  }));
  return lista;
};

// ------------------------------------------------------------
// Validação (contra o catálogo de fontes)
// ------------------------------------------------------------

export interface IResultadoValidacao {
  definicao?: IDefinicaoDashboard;
  erros: string[];
  avisos: string[];
}

export const validarDashboard = (
  entrada: string | unknown,
  catalogo: IDescricaoFonte[]
): IResultadoValidacao => {

  const erros: string[] = [];
  const avisos: string[] = [];
  let bruto: IDefinicaoDashboard;

  try {
    bruto = (typeof entrada === 'string' ? JSON.parse(entrada) : entrada) as IDefinicaoDashboard;
  } catch (erro) {
    return { erros: [`JSON inválido: ${erro instanceof Error ? erro.message : String(erro)}`], avisos };
  }

  if (!bruto || typeof bruto !== 'object') {
    return { erros: ['O conteúdo não é um objeto JSON.'], avisos };
  }
  if (bruto.formato !== FORMATO_DASHBOARD) {
    erros.push(`"formato" deve ser "${FORMATO_DASHBOARD}".`);
  }
  if (!bruto.titulo || !String(bruto.titulo).trim()) {
    erros.push('Informe o "titulo".');
  }
  if (!Array.isArray(bruto.secoes) || bruto.secoes.length === 0) {
    erros.push('"secoes" deve ter pelo menos uma seção.');
    return { erros, avisos };
  }

  const fonteDe = (id: string): IDescricaoFonte | undefined => catalogo.filter(fonte => fonte.id === id)[0];

  const validarCampo = (onde: string, fonte: IDescricaoFonte, campo: string, numerico = false): void => {
    const encontrado = fonte.campos.filter(item => item.chave === campo)[0];
    if (!encontrado) {
      erros.push(`${onde}: o campo "${campo}" não existe na fonte "${fonte.id}". Campos: ${fonte.campos.map(item => item.chave).join(', ')}.`);
    } else if (numerico && encontrado.tipo !== 'numero') {
      erros.push(`${onde}: "${campo}" não é numérico (use agregacao "contagem" ou "contagemDistinta").`);
    }
  };

  const validarMedida = (onde: string, fonte: IDescricaoFonte, medida: IMedida): void => {
    const agregacao = medida.agregacao || 'soma';
    if (AGREGACOES.indexOf(agregacao) < 0) {
      erros.push(`${onde}: agregacao "${agregacao}" inválida. Use: ${AGREGACOES.join(', ')}.`);
      return;
    }
    if (agregacao === 'contagem' && (!medida.medida || medida.medida === '*')) {
      return;
    }
    validarCampo(onde, fonte, medida.medida, agregacao !== 'contagem' && agregacao !== 'contagemDistinta');
  };

  const validarFiltro = (onde: string, fonte: IDescricaoFonte, filtro?: Filtro): void => {
    Object.keys(filtro || {}).forEach(campo => {
      validarCampo(`${onde}.filtro`, fonte, campo);
      const descricao = fonte.campos.filter(item => item.chave === campo)[0];
      if (descricao && descricao.valores) {
        const esperado = (filtro as Filtro)[campo];
        (Array.isArray(esperado) ? esperado : [esperado]).forEach(valor => {
          if ((descricao.valores as string[]).indexOf(String(valor)) < 0) {
            erros.push(`${onde}.filtro: "${String(valor)}" não é um valor de "${campo}". Valores: ${(descricao.valores as string[]).join(', ')}.`);
          }
        });
      }
    });
  };

  bruto.secoes.forEach((secao, s) => {
    const ondeSecao = `secoes[${s}]`;
    if (secao && secao.pagina !== undefined) {
      if (typeof secao.pagina !== 'string' || !secao.pagina.trim()) {
        erros.push(`${ondeSecao}: "pagina" deve ser um texto (ou ser omitido).`);
      } else if (secao.pagina.trim().length > LIMITE_TITULO_PAGINA) {
        erros.push(`${ondeSecao}: "pagina" deve ter no máximo ${LIMITE_TITULO_PAGINA} caracteres.`);
      }
    }
    if (!Array.isArray(secao.itens) || secao.itens.length === 0) {
      erros.push(`${ondeSecao}: "itens" deve ter pelo menos um item.`);
      return;
    }
    secao.itens.forEach((item, i) => {
      const onde = `${ondeSecao}.itens[${i}] (${item && (item as ItemDashboard).titulo ? (item as ItemDashboard).titulo : item && (item as ItemDashboard).tipo})`;
      const fonte = fonteDe(item.fonte);
      if (!fonte) {
        erros.push(`${onde}: fonte "${item.fonte}" não existe. Fontes: ${catalogo.map(f => f.id).join(', ')}.`);
        return;
      }
      if (!item.titulo) {
        avisos.push(`${onde}: sem "titulo".`);
      }
      if ((item as IItemCartao).formato && FORMATOS.indexOf((item as IItemCartao).formato as FormatoValor) < 0) {
        erros.push(`${onde}: formato inválido. Use: ${FORMATOS.join(', ')}.`);
      }
      validarFiltro(onde, fonte, item.filtro);
      if (item.tipo === 'cartao') {
        validarMedida(onde, fonte, { medida: item.medida, agregacao: item.agregacao });
        if (item.comparar) {
          validarMedida(`${onde}.comparar`, fonte, item.comparar);
        }
      } else if (item.tipo === 'grafico') {
        if (GRAFICOS.indexOf(item.grafico) < 0) {
          erros.push(`${onde}: grafico "${item.grafico}" inválido. Use: ${GRAFICOS.join(', ')}.`);
        }
        validarCampo(`${onde}.dimensao`, fonte, item.dimensao);
        if (item.serieDimensao) {
          validarCampo(`${onde}.serieDimensao`, fonte, item.serieDimensao);
        }
        if (!Array.isArray(item.series) || item.series.length === 0) {
          erros.push(`${onde}: "series" deve ter pelo menos uma medida.`);
        } else {
          item.series.forEach((serie, n) => validarMedida(`${onde}.series[${n}]`, fonte, serie));
        }
      } else if (item.tipo === 'tabela') {
        if (item.colunas && item.colunas.length > 0) {
          item.colunas.forEach(coluna => validarCampo(`${onde}.colunas`, fonte, coluna));
        } else {
          (item.dimensoes || []).forEach(dimensao => validarCampo(`${onde}.dimensoes`, fonte, dimensao));
          if (!item.medidas || item.medidas.length === 0) {
            erros.push(`${onde}: informe "colunas" (lista) ou "dimensoes" + "medidas" (agrupada).`);
          } else {
            item.medidas.forEach((medida, n) => validarMedida(`${onde}.medidas[${n}]`, fonte, medida));
          }
        }
      } else {
        erros.push(`${onde}: tipo "${(item as ItemDashboard).tipo}" inválido. Use cartao, grafico ou tabela.`);
      }
    });
  });

  if (bruto.assistente !== undefined && bruto.assistente !== null) {
    const assistente = bruto.assistente as IAssistenteDashboard;
    if (typeof assistente !== 'object' || Array.isArray(assistente)) {
      erros.push('"assistente" deve ser um objeto.');
    } else {
      if (typeof assistente.ativo !== 'boolean') {
        erros.push('assistente: informe "ativo" (true ou false).');
      }
      const escopo = typeof assistente.escopo === 'string' ? assistente.escopo.trim() : '';
      if (!escopo) {
        erros.push('assistente: informe o "escopo" (o assunto que a IA pode responder).');
      } else if (escopo.length > LIMITE_ESCOPO_ASSISTENTE) {
        erros.push(`assistente: o "escopo" deve ter no máximo ${LIMITE_ESCOPO_ASSISTENTE} caracteres.`);
      }
      const usadas = fontesUsadas(bruto);
      if (assistente.fontes !== undefined) {
        if (!Array.isArray(assistente.fontes) || assistente.fontes.length === 0) {
          erros.push('assistente: "fontes" deve ser uma lista com pelo menos uma fonte (ou ser omitido).');
        } else {
          assistente.fontes.forEach(id => {
            if (!fonteDe(id)) {
              erros.push(`assistente.fontes: fonte "${id}" não existe. Fontes: ${catalogo.map(f => f.id).join(', ')}.`);
            } else if (usadas.indexOf(id) < 0) {
              erros.push(`assistente.fontes: "${id}" não é usada por nenhum item do painel (a IA só recebe dados que o painel carrega).`);
            }
          });
        }
      }
      if (assistente.perguntasSugeridas !== undefined) {
        if (!Array.isArray(assistente.perguntasSugeridas) || assistente.perguntasSugeridas.some(p => typeof p !== 'string' || !p.trim())) {
          erros.push('assistente: "perguntasSugeridas" deve ser uma lista de textos.');
        } else if (assistente.perguntasSugeridas.length > LIMITE_PERGUNTAS_SUGERIDAS) {
          avisos.push(`assistente: só as ${LIMITE_PERGUNTAS_SUGERIDAS} primeiras perguntas sugeridas serão exibidas.`);
        }
      }
      if (assistente.camposOcultos !== undefined && (!Array.isArray(assistente.camposOcultos) || assistente.camposOcultos.some(c => typeof c !== 'string'))) {
        erros.push('assistente: "camposOcultos" deve ser uma lista de nomes de campo.');
      }
      if (assistente.modelo !== undefined && (typeof assistente.modelo !== 'string' || !assistente.modelo.trim())) {
        erros.push('assistente: "modelo" deve ser um texto (ex.: "claude-sonnet-5-5") ou ser omitido.');
      }
    }
  }

  return { definicao: erros.length === 0 ? bruto : undefined, erros, avisos };
};

// ------------------------------------------------------------
// Consultas (filtrar, agrupar, agregar)
// ------------------------------------------------------------

const normalizar = (valor: unknown): string =>
  valor === null || valor === undefined ? '' : String(valor).trim().toLowerCase();

export const aplicarFiltro = (linhas: Linha[], filtro?: Filtro): Linha[] => {
  const campos = Object.keys(filtro || {});
  if (campos.length === 0) {
    return linhas;
  }
  return linhas.filter(linha =>
    campos.every(campo => {
      const esperado = (filtro as Filtro)[campo];
      const lista = Array.isArray(esperado) ? esperado : [esperado];
      return lista.some(valor => normalizar(valor) === normalizar(linha[campo]));
    })
  );
};

export const agregar = (linhas: Linha[], medida: IMedida): number => {
  const agregacao = medida.agregacao || 'soma';
  if (agregacao === 'contagem') {
    return medida.medida && medida.medida !== '*'
      ? linhas.filter(linha => linha[medida.medida] !== null && linha[medida.medida] !== undefined && linha[medida.medida] !== '').length
      : linhas.length;
  }
  if (agregacao === 'contagemDistinta') {
    const vistos: string[] = [];
    linhas.forEach(linha => {
      const valor = normalizar(linha[medida.medida]);
      if (valor && vistos.indexOf(valor) < 0) {
        vistos.push(valor);
      }
    });
    return vistos.length;
  }
  const numeros = linhas.map(linha => Number(linha[medida.medida])).filter(numero => isFinite(numero));
  if (numeros.length === 0) {
    return 0;
  }
  if (agregacao === 'media') {
    return numeros.reduce((soma, numero) => soma + numero, 0) / numeros.length;
  }
  if (agregacao === 'minimo') {
    return Math.min(...numeros);
  }
  if (agregacao === 'maximo') {
    return Math.max(...numeros);
  }
  return Math.round(numeros.reduce((soma, numero) => soma + numero, 0) * 100) / 100;
};

export interface IGrupo {
  chave: string;
  valores: { [campo: string]: string | number | boolean | undefined };
  linhas: Linha[];
}

export const agrupar = (linhas: Linha[], campos: string[]): IGrupo[] => {
  const mapa: { [chave: string]: IGrupo } = {};
  const ordem: string[] = [];
  linhas.forEach(linha => {
    const chave = campos.map(campo => String(linha[campo] === null || linha[campo] === undefined ? '' : linha[campo])).join('¦');
    if (!mapa[chave]) {
      const valores: IGrupo['valores'] = {};
      campos.forEach(campo => { valores[campo] = linha[campo]; });
      mapa[chave] = { chave, valores, linhas: [] };
      ordem.push(chave);
    }
    mapa[chave].linhas.push(linha);
  });
  return ordem.map(chave => mapa[chave]);
};

// Farol: verde ≥ 80%, amarelo 70–79%, vermelho < 70%.
export type Farol = 'verde' | 'amarelo' | 'vermelho' | 'semDado';

export const farolDe = (valor: number, referencia: number, direcao: 'maior' | 'menor' = 'maior'): { farol: Farol; percentual?: number } => {
  const a = Math.abs(valor);
  const b = Math.abs(referencia);
  if (!b && !a) {
    return { farol: 'semDado' };
  }
  if (!b) {
    return { farol: 'semDado' };
  }
  const percentual = direcao === 'menor' ? (a === 0 ? 100 : (b / a) * 100) : (a / b) * 100;
  return {
    farol: percentual >= 80 ? 'verde' : percentual >= 70 ? 'amarelo' : 'vermelho',
    percentual: Math.round((a / b) * 1000) / 10
  };
};

// Ordenação "valor desc" | "valor asc" | "dimensao asc" | "<campo> desc".
export const ordenarGrupos = <T extends { rotulo: string; valor: number; ordem?: number | string }>(
  itens: T[],
  ordenar?: string
): T[] => {
  if (!ordenar || ordenar.trim().toLowerCase() === 'nenhum') {
    return itens;
  }
  const [campo, direcao] = ordenar.trim().split(/\s+/);
  const fator = (direcao || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return itens.slice().sort((a, b) => {
    if (campo === 'valor') {
      return (a.valor - b.valor) * fator;
    }
    const va = a.ordem !== undefined ? a.ordem : a.rotulo;
    const vb = b.ordem !== undefined ? b.ordem : b.rotulo;
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')) * fator;
  });
};
