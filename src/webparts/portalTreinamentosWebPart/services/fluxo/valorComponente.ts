// ============================================================
// CAMPO "COMPONENTE" (tela personalizada dentro de uma etapa)
//
// Dois formatos, o MESMO contrato com o fluxo:
//   'nativo' → componente do próprio portal, registrado em código e
//              testado (ex.: Montador de B.O.M. da Arquitetura)
//   'html'   → HTML/CSS/JS configurado no portal, executado ISOLADO
//              num iframe sandbox; acessa dados só pela ponte, e só
//              as fontes (tabela + colunas) liberadas na configuração
//
// Valor gravado = ENVELOPE (JSON):
//   { dados, valido, erros, resumo, itens? }
//   dados  → o que o componente precisa para reabrir a tela
//   valido → o Concluir da etapa só libera com true
//   resumo → texto curto (listas, histórico, colunas)
//   itens  → lista gerada (ex.: B.O.M.), lida por etapas seguintes
// ============================================================

export interface IFonteDadosComponente {
  // Nome usado pelo componente (ex.: "itens").
  nome: string;
  // Tabela do Dataverse (nome lógico, ex.: "dgt_kititem").
  tabela: string;
  // Colunas que o componente pode ler (nomes lógicos).
  colunas: string[];
  // Filtro OData fixo, opcional (ex.: "dgt_ativo eq true").
  filtroFixo?: string;
  // Ordenação, opcional (ex.: "dgt_ordem asc").
  ordem?: string;
}

export interface IConfigComponente {
  tipo: 'nativo' | 'html';
  // tipo 'nativo': chave do componente registrado (ex.: "montadorBom").
  nativo?: string;
  // Parâmetros do componente (ex.: { campoCanal: "canal" }).
  parametros?: Record<string, string>;
  // tipo 'html': documento completo (HTML + CSS + JS).
  html?: string;
  fontes?: IFonteDadosComponente[];
  // Altura inicial do quadro (px); o componente pode ajustar.
  altura?: number;
}

export interface IEnvelopeComponente {
  dados?: unknown;
  valido: boolean;
  erros?: string[];
  resumo?: string;
  itens?: Array<{ codigo: string; descricao: string; quantidade: number; categoria?: string }>;
}

// ------------------------------------------------------------
// Envelope
// ------------------------------------------------------------

export const lerEnvelopeComponente = (
  valor?: string
): IEnvelopeComponente | undefined => {
  const texto = (valor || '').trim();
  if (texto.charAt(0) !== '{') {
    return undefined;
  }
  try {
    const objeto = JSON.parse(texto) as IEnvelopeComponente;
    return objeto && typeof objeto === 'object' && typeof objeto.valido === 'boolean' ? objeto : undefined;
  } catch {
    return undefined;
  }
};

const LIMITE_RESUMO = 300;
const LIMITE_ERROS = 20;

// Normaliza o que veio do componente (ele pode errar o formato).
export const gravarEnvelopeComponente = (
  envelope: IEnvelopeComponente
): string => {
  const erros = (Array.isArray(envelope.erros) ? envelope.erros : [])
    .map(item => String(item).substring(0, 300))
    .slice(0, LIMITE_ERROS);
  const itens = Array.isArray(envelope.itens)
    ? envelope.itens
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        codigo: String(item.codigo || ''),
        descricao: String(item.descricao || ''),
        quantidade: Number(item.quantidade) || 0,
        categoria: item.categoria ? String(item.categoria) : undefined
      }))
    : undefined;
  return JSON.stringify({
    dados: envelope.dados,
    valido: envelope.valido === true && erros.length === 0,
    erros,
    resumo: envelope.resumo ? String(envelope.resumo).substring(0, LIMITE_RESUMO) : undefined,
    itens
  });
};

// Validação ao concluir a etapa.
export const validarComponente = (
  rotulo: string,
  valor: string,
  obrigatorio: boolean
): string[] => {
  const envelope = lerEnvelopeComponente(valor);
  if (!envelope) {
    return obrigatorio ? [`Preencha: ${rotulo}`] : [];
  }
  if (!envelope.valido) {
    const erros = envelope.erros || [];
    return erros.length > 0
      ? erros.map(erro => `${rotulo}: ${erro}`)
      : [`${rotulo}: ainda não está completo/válido.`];
  }
  return [];
};

export const formatarValorComponente = (
  valor: string
): string => {
  const envelope = lerEnvelopeComponente(valor);
  if (!envelope) {
    return '';
  }
  return envelope.resumo || (envelope.valido ? 'Preenchido' : 'Incompleto');
};

// ------------------------------------------------------------
// Configuração
// ------------------------------------------------------------

const NOME_LOGICO = /^[a-z][a-z0-9_]{1,99}$/;

export const validarConfigComponente = (
  rotulo: string,
  config: IConfigComponente | undefined,
  nativosDisponiveis: string[]
): string[] => {
  if (!config) {
    return [`Configure o componente "${rotulo}".`];
  }
  const erros: string[] = [];
  if (config.tipo === 'nativo') {
    if (!config.nativo || nativosDisponiveis.indexOf(config.nativo) < 0) {
      erros.push(`Escolha o componente nativo de "${rotulo}" (${nativosDisponiveis.join(', ')}).`);
    }
  } else if (config.tipo === 'html') {
    if (!(config.html || '').trim()) {
      erros.push(`Informe o HTML do componente "${rotulo}".`);
    }
    if ((config.html || '').length > 90000) {
      erros.push(`O HTML do componente "${rotulo}" passa de 90 mil caracteres: simplifique ou divida.`);
    }
    const nomes: string[] = [];
    (config.fontes || []).forEach(fonte => {
      if (!/^[a-z][A-Za-z0-9]{0,39}$/.test(fonte.nome || '')) {
        erros.push(`Fonte de dados "${fonte.nome}" do componente "${rotulo}": nome em camelCase.`);
      }
      if (nomes.indexOf(fonte.nome) >= 0) {
        erros.push(`Fonte de dados repetida no componente "${rotulo}": ${fonte.nome}.`);
      }
      nomes.push(fonte.nome);
      if (!NOME_LOGICO.test(fonte.tabela || '')) {
        erros.push(`Fonte "${fonte.nome}": tabela inválida ("${fonte.tabela}"). Use o nome lógico do Dataverse (ex.: dgt_kititem).`);
      }
      if (!fonte.colunas || fonte.colunas.length === 0 || fonte.colunas.some(coluna => !NOME_LOGICO.test(coluna))) {
        erros.push(`Fonte "${fonte.nome}": informe as colunas liberadas (nomes lógicos, ex.: dgt_codigo).`);
      }
    });
  } else {
    erros.push(`Tipo do componente "${rotulo}" deve ser "nativo" ou "html".`);
  }
  return erros;
};

// ------------------------------------------------------------
// Ponte de dados (HTML): consulta SEGURA a uma fonte liberada
// ------------------------------------------------------------

export type FiltroComponente = Record<string, string | number | boolean>;

const valorOData = (valor: string | number | boolean): string =>
  typeof valor === 'number'
    ? (isFinite(valor) ? String(valor) : '0')
    : typeof valor === 'boolean'
      ? (valor ? 'true' : 'false')
      : `'${String(valor).replace(/'/g, "''")}'`;

// Monta a consulta OData de uma fonte. O componente só escolhe filtros
// de IGUALDADE em colunas liberadas; tabela, colunas, filtro fixo e
// ordenação vêm da configuração (o componente não os altera).
export const montarConsultaFonte = (
  fonte: IFonteDadosComponente,
  filtros?: FiltroComponente
): { consulta: string; erros: string[] } => {
  const erros: string[] = [];
  const condicoes: string[] = [];
  if (fonte.filtroFixo && fonte.filtroFixo.trim()) {
    condicoes.push(`(${fonte.filtroFixo.trim()})`);
  }
  Object.keys(filtros || {}).forEach(coluna => {
    if (fonte.colunas.indexOf(coluna) < 0) {
      erros.push(`A coluna "${coluna}" não está liberada na fonte "${fonte.nome}".`);
      return;
    }
    const valor = (filtros as FiltroComponente)[coluna];
    if (typeof valor !== 'string' && typeof valor !== 'number' && typeof valor !== 'boolean') {
      erros.push(`Filtro "${coluna}": use texto, número ou verdadeiro/falso.`);
      return;
    }
    condicoes.push(`${coluna} eq ${valorOData(valor)}`);
  });
  const partes = [`$select=${fonte.colunas.join(',')}`];
  if (condicoes.length > 0) {
    partes.push(`$filter=${condicoes.join(' and ')}`);
  }
  if (fonte.ordem && /^[a-z][a-z0-9_]*( (asc|desc))?(,[a-z][a-z0-9_]*( (asc|desc))?)*$/.test(fonte.ordem.trim())) {
    partes.push(`$orderby=${fonte.ordem.trim()}`);
  }
  return { consulta: partes.join('&'), erros };
};

// Devolve ao componente só as colunas liberadas (sem anotações OData).
export const filtrarColunas = (
  fonte: IFonteDadosComponente,
  registros: Array<Record<string, unknown>>
): Array<Record<string, unknown>> =>
  registros.map(registro => {
    const limpo: Record<string, unknown> = {};
    fonte.colunas.forEach(coluna => {
      if (registro[coluna] !== undefined) {
        limpo[coluna] = registro[coluna];
      }
    });
    return limpo;
  });
