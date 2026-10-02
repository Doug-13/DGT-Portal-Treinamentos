import {
  IFiltrosLicitacao,
  ILicitacaoResultado,
  IProgressoBusca,
  IRegistroPncp,
  IRespostaPaginaPncp,
  IResumoBusca,
  MODALIDADES_PNCP
} from '../models/Licitacao';

import {
  atendePreFiltro,
  formatarDataApi,
  obterChaveRegistro,
  processarRegistro
} from '../utils/licitacoesFiltro';

// ============================================================
// MÓDULO LICITAÇÕES — SERVIÇO PNCP
//
// Port da parte de rede do Agente de Licitações V6:
//   consultar_pagina        → consultarPagina
//   obter_lista_dados       → obterListaDados
//   possui_proxima_pagina   → possuiProximaPagina
//   executar_consulta       → buscarLicitacoes
//
// Mantém as mesmas proteções do script:
//   • HTTP 204 = página vazia (não é erro)
//   • HTTP 429 = espera (Retry-After ou exponencial) e tenta de novo
//   • timeout e falha de conexão = nova tentativa
//   • remoção de duplicidades entre páginas e modalidades
//
// Diferença do Python: tudo é cancelável (AbortSignal), porque
// a busca roda no navegador e o usuário pode sair da tela.
//
// A API do PNCP é pública e não exige autenticação, por isso é
// usado o fetch do navegador (sem token, sem cookies).
// ============================================================

export const PNCP_BASE_URL =
  'https://pncp.gov.br/api/consulta/v1';

const ENDPOINT_PUBLICACAO =
  `${PNCP_BASE_URL}/contratacoes/publicacao`;

export const CONFIG_PNCP = {
  timeoutMs: 60000,
  tamanhoPagina: 50,
  intervaloEntreRequisicoesMs: 2000,
  intervaloEntreModalidadesMs: 3000,
  maxTentativas: 6,
  esperaInicial429Ms: 10000,
  esperaErroRedeMs: 5000
};

// ------------------------------------------------------------
// Utilitários de espera / cancelamento
// ------------------------------------------------------------

const criarErroCancelado = (): Error => {
  const erro = new Error('Busca cancelada pelo usuário.');
  erro.name = 'AbortError';
  return erro;
};

export const ehCancelamento = (
  erro: unknown
): boolean =>
  !!erro &&
  typeof erro === 'object' &&
  (erro as { name?: string }).name === 'AbortError';

const esperar = (
  ms: number,
  signal?: AbortSignal
): Promise<void> =>
  new Promise<void>((resolve, reject) => {

    if (signal && signal.aborted) {
      reject(criarErroCancelado());
      return;
    }

    const id = window.setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', aoCancelar);
      }
      resolve();
    }, ms);

    function aoCancelar(): void {
      window.clearTimeout(id);
      reject(criarErroCancelado());
    }

    if (signal) {
      signal.addEventListener('abort', aoCancelar);
    }
  });

// fetch com timeout + cancelamento do usuário
const fetchComTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> => {

  const controle = new AbortController();
  let estourouTempo = false;

  const idTimeout = window.setTimeout(() => {
    estourouTempo = true;
    controle.abort();
  }, timeoutMs);

  const repassarCancelamento = (): void => controle.abort();

  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(idTimeout);
      throw criarErroCancelado();
    }
    signal.addEventListener('abort', repassarCancelamento);
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controle.signal
    });
  } catch (erro) {

    if (signal && signal.aborted) {
      throw criarErroCancelado();
    }

    if (estourouTempo) {
      const erroTimeout = new Error('Tempo limite excedido.');
      erroTimeout.name = 'TimeoutError';
      throw erroTimeout;
    }

    throw erro;

  } finally {
    window.clearTimeout(idTimeout);
    if (signal) {
      signal.removeEventListener('abort', repassarCancelamento);
    }
  }
};

const montarUrl = (
  parametros: { [chave: string]: string | number | undefined }
): string => {

  const query = Object.keys(parametros)
    .filter(chave => parametros[chave] !== undefined && parametros[chave] !== '')
    .map(chave =>
      `${encodeURIComponent(chave)}=${encodeURIComponent(String(parametros[chave]))}`
    )
    .join('&');

  return `${ENDPOINT_PUBLICACAO}?${query}`;
};

// ------------------------------------------------------------
// Leitura da resposta
// ------------------------------------------------------------

export const obterListaDados = (
  resposta: unknown
): IRegistroPncp[] => {

  if (!resposta) {
    return [];
  }

  if (Array.isArray(resposta)) {
    return resposta as IRegistroPncp[];
  }

  const objeto = resposta as { [chave: string]: unknown };

  for (const chave of ['data', 'content', 'items', 'resultados']) {
    if (Array.isArray(objeto[chave])) {
      return objeto[chave] as IRegistroPncp[];
    }
  }

  return [];
};

export const possuiProximaPagina = (
  resposta: IRespostaPaginaPncp | undefined,
  quantidade: number
): boolean => {

  if (!resposta) {
    return false;
  }

  if (
    resposta.temMaisPaginas !== undefined &&
    resposta.temMaisPaginas !== null
  ) {
    return !!resposta.temMaisPaginas;
  }

  if (
    resposta.paginasRestantes !== undefined &&
    resposta.paginasRestantes !== null
  ) {
    return Number(resposta.paginasRestantes) > 0;
  }

  if (
    resposta.totalPaginas !== undefined &&
    resposta.numeroPagina !== undefined
  ) {
    return Number(resposta.numeroPagina) < Number(resposta.totalPaginas);
  }

  return quantidade >= CONFIG_PNCP.tamanhoPagina;
};

// ------------------------------------------------------------
// Consulta de UMA página (com 204 / 429 / retry)
// ------------------------------------------------------------

export interface IParametrosPagina {
  dataInicial: string;
  dataFinal: string;
  modalidade: number;
  pagina: number;
  tamanhoPagina?: number;
  uf?: string;
}

export interface IResultadoPagina {
  ok: boolean;
  resposta?: IRespostaPaginaPncp;
  status?: number;
  erro?: string;
}

export const consultarPagina = async (
  parametros: IParametrosPagina,
  signal?: AbortSignal,
  aoAguardar?: (mensagem: string) => void
): Promise<IResultadoPagina> => {

  const url = montarUrl({
    dataInicial: parametros.dataInicial,
    dataFinal: parametros.dataFinal,
    codigoModalidadeContratacao: parametros.modalidade,
    pagina: parametros.pagina,
    tamanhoPagina: parametros.tamanhoPagina || CONFIG_PNCP.tamanhoPagina,
    uf: parametros.uf
  });

  let espera = CONFIG_PNCP.esperaInicial429Ms;
  let ultimoErro = '';

  for (let tentativa = 1; tentativa <= CONFIG_PNCP.maxTentativas; tentativa++) {

    let resposta: Response;

    try {
      resposta = await fetchComTimeout(
        url,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          cache: 'no-store'
        },
        CONFIG_PNCP.timeoutMs,
        signal
      );
    } catch (erro) {

      if (ehCancelamento(erro)) {
        throw erro;
      }

      ultimoErro =
        (erro as Error).name === 'TimeoutError'
          ? 'Tempo limite excedido ao consultar o PNCP.'
          : 'Falha de conexão com o PNCP (rede ou bloqueio CORS).';

      if (aoAguardar) {
        aoAguardar(`${ultimoErro} Nova tentativa ${tentativa}/${CONFIG_PNCP.maxTentativas}...`);
      }

      await esperar(CONFIG_PNCP.esperaErroRedeMs, signal);
      continue;
    }

    // 200 — sucesso
    if (resposta.status === 200) {
      try {
        const json = await resposta.json();
        return {
          ok: true,
          status: 200,
          resposta: Array.isArray(json)
            ? { data: json as IRegistroPncp[] }
            : json as IRespostaPaginaPncp
        };
      } catch {
        return {
          ok: false,
          status: 200,
          erro: 'O PNCP respondeu, mas o conteúdo não é um JSON válido.'
        };
      }
    }

    // 204 — sem registros nesta página
    if (resposta.status === 204) {
      return {
        ok: true,
        status: 204,
        resposta: { data: [], temMaisPaginas: false }
      };
    }

    // 429 — limite de requisições
    if (resposta.status === 429) {

      const retryAfter = parseInt(
        resposta.headers.get('Retry-After') || '',
        10
      );

      if (!isNaN(retryAfter)) {
        espera = Math.max(espera, retryAfter * 1000);
      }

      if (aoAguardar) {
        aoAguardar(
          `Limite do PNCP atingido (HTTP 429). Aguardando ${Math.round(espera / 1000)}s ` +
          `— tentativa ${tentativa}/${CONFIG_PNCP.maxTentativas}.`
        );
      }

      await esperar(espera, signal);
      espera *= 2;
      continue;
    }

    // Outros códigos — não tenta de novo (igual ao Python)
    let detalhe = '';
    try {
      detalhe = (await resposta.text()).substring(0, 300);
    } catch {
      detalhe = '';
    }

    return {
      ok: false,
      status: resposta.status,
      erro: `HTTP ${resposta.status}${detalhe ? ` — ${detalhe}` : ''}`
    };
  }

  return {
    ok: false,
    erro: ultimoErro || 'Número máximo de tentativas atingido.'
  };
};

// ------------------------------------------------------------
// Busca completa (todas as modalidades, todas as páginas)
// ------------------------------------------------------------

export interface ICallbacksBusca {
  onProgresso: (progresso: IProgressoBusca) => void;
  onResultados: (novos: ILicitacaoResultado[]) => void;
}

export const buscarLicitacoes = async (
  filtros: IFiltrosLicitacao,
  callbacks: ICallbacksBusca,
  signal?: AbortSignal
): Promise<IResumoBusca> => {

  const momentoInicio = Date.now();
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - filtros.diasBusca);

  const dataInicial = formatarDataApi(inicio);
  const dataFinal = formatarDataApi(fim);

  // Somente identificadores — nada é persistido.
  const idsProcessados: { [chave: string]: boolean } = {};

  const resumo: IResumoBusca = {
    inicio,
    fim,
    registrosBrutos: 0,
    registrosUnicos: 0,
    descartados: 0,
    aderentes: 0,
    falhas: [],
    cancelada: false,
    duracaoSegundos: 0
  };

  const progresso: IProgressoBusca = {
    modalidadeAtual: '',
    indiceModalidade: 0,
    totalModalidades: filtros.modalidades.length,
    pagina: 0,
    registrosBrutos: 0,
    registrosUnicos: 0,
    descartados: 0,
    aderentes: 0
  };

  const emitir = (mensagem?: string): void => {
    callbacks.onProgresso({
      ...progresso,
      registrosBrutos: resumo.registrosBrutos,
      registrosUnicos: resumo.registrosUnicos,
      descartados: resumo.descartados,
      aderentes: resumo.aderentes,
      mensagem
    });
  };

  try {

    for (let i = 0; i < filtros.modalidades.length; i++) {

      const modalidade = filtros.modalidades[i];
      const nomeModalidade = MODALIDADES_PNCP[modalidade] || String(modalidade);

      progresso.modalidadeAtual = nomeModalidade;
      progresso.indiceModalidade = i + 1;
      progresso.pagina = 0;
      progresso.totalPaginasModalidade = undefined;

      let pagina = 1;

      // eslint-disable-next-line no-constant-condition
      while (true) {

        progresso.pagina = pagina;
        emitir(`Consultando ${nomeModalidade} — página ${pagina}...`);

        const resultado = await consultarPagina(
          {
            dataInicial,
            dataFinal,
            modalidade,
            pagina,
            uf: filtros.uf
          },
          signal,
          mensagem => emitir(mensagem)
        );

        if (!resultado.ok || !resultado.resposta) {
          resumo.falhas.push(
            `${nomeModalidade}, página ${pagina}: ${resultado.erro || 'falha desconhecida'}`
          );
          break;
        }

        const resposta = resultado.resposta;

        if (resposta.totalPaginas) {
          progresso.totalPaginasModalidade = Number(resposta.totalPaginas);
        }

        const registros = obterListaDados(resposta);

        if (registros.length === 0) {
          break;
        }

        resumo.registrosBrutos += registros.length;

        const novos: ILicitacaoResultado[] = [];

        for (const registro of registros) {

          const chave = obterChaveRegistro(registro, modalidade);

          if (idsProcessados[chave]) {
            continue;
          }

          idsProcessados[chave] = true;
          resumo.registrosUnicos++;

          if (!atendePreFiltro(registro, filtros)) {
            resumo.descartados++;
            continue;
          }

          const item = processarRegistro(
            registro,
            modalidade,
            filtros,
            `${modalidade}-${resumo.registrosUnicos}`
          );

          if (item) {
            novos.push(item);
          }
        }

        if (novos.length > 0) {
          resumo.aderentes += novos.length;
          callbacks.onResultados(novos);
        }

        emitir();

        if (!possuiProximaPagina(resposta, registros.length)) {
          break;
        }

        pagina++;
        await esperar(CONFIG_PNCP.intervaloEntreRequisicoesMs, signal);
      }

      if (i < filtros.modalidades.length - 1) {
        emitir('Pausa entre modalidades...');
        await esperar(CONFIG_PNCP.intervaloEntreModalidadesMs, signal);
      }
    }

  } catch (erro) {

    if (ehCancelamento(erro)) {
      resumo.cancelada = true;
    } else {
      resumo.falhas.push((erro as Error).message || String(erro));
    }
  }

  resumo.duracaoSegundos = Math.round((Date.now() - momentoInicio) / 1000);

  return resumo;
};

// ------------------------------------------------------------
// TESTE DE CONEXÃO (viabilidade da chamada direta do navegador)
// ------------------------------------------------------------

export type SituacaoEtapaTeste =
  | 'pendente'
  | 'executando'
  | 'ok'
  | 'alerta'
  | 'falha'
  | 'ignorada';

export interface IEtapaTeste {
  id: string;
  titulo: string;
  situacao: SituacaoEtapaTeste;
  detalhe?: string;
}

export type VeredictoTeste =
  | 'viavel'
  | 'bloqueadoCors'
  | 'semConexao'
  | 'erroApi';

export interface IResultadoTesteConexao {
  veredicto: VeredictoTeste;
  etapas: IEtapaTeste[];
  latenciaMs?: number;
  totalRegistros?: number;
  totalPaginas?: number;
  amostra?: { objeto: string; orgao: string; modalidade: string }[];
  urlTestada: string;
  executadoEm: Date;
}

export const ETAPAS_TESTE_INICIAIS: IEtapaTeste[] = [
  { id: 'online', titulo: 'Navegador conectado à internet', situacao: 'pendente' },
  { id: 'alcance', titulo: 'Servidor do PNCP alcançável', situacao: 'pendente' },
  { id: 'cors', titulo: 'Chamada direta permitida (CORS)', situacao: 'pendente' },
  { id: 'json', titulo: 'Resposta no formato esperado', situacao: 'pendente' },
  { id: 'paginacao', titulo: 'Informações de paginação', situacao: 'pendente' }
];

export const testarConexaoPncp = async (
  aoAtualizar: (etapas: IEtapaTeste[]) => void
): Promise<IResultadoTesteConexao> => {

  const etapas = ETAPAS_TESTE_INICIAIS.map(etapa => ({ ...etapa }));

  const atualizar = (
    id: string,
    situacao: SituacaoEtapaTeste,
    detalhe?: string
  ): void => {
    const etapa = etapas.find(item => item.id === id);
    if (etapa) {
      etapa.situacao = situacao;
      etapa.detalhe = detalhe;
    }
    aoAtualizar(etapas.map(item => ({ ...item })));
  };

  const ignorarRestantes = (aPartirDe: string): void => {
    let marcar = false;
    for (const etapa of etapas) {
      if (etapa.id === aPartirDe) {
        marcar = true;
      }
      if (marcar && etapa.situacao === 'pendente') {
        etapa.situacao = 'ignorada';
      }
    }
    aoAtualizar(etapas.map(item => ({ ...item })));
  };

  // Últimos 7 dias, Pregão Eletrônico, página 1, 10 registros.
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - 7);

  const urlTestada = montarUrl({
    dataInicial: formatarDataApi(inicio),
    dataFinal: formatarDataApi(fim),
    codigoModalidadeContratacao: 6,
    pagina: 1,
    tamanhoPagina: 10
  });

  const base = {
    etapas,
    urlTestada,
    executadoEm: new Date()
  };

  // 1) Online
  atualizar('online', 'executando');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    atualizar('online', 'falha', 'O navegador informa que está sem conexão.');
    ignorarRestantes('alcance');
    return { ...base, veredicto: 'semConexao' };
  }

  atualizar('online', 'ok');

  // 2) Alcance (modo no-cors: não lê a resposta, mas prova que o
  //    servidor respondeu). Se isso funcionar e a etapa 3 falhar,
  //    a causa é bloqueio CORS, não rede.
  atualizar('alcance', 'executando');

  let servidorAlcancavel = false;

  try {
    await fetchComTimeout(
      urlTestada,
      { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store' },
      20000
    );
    servidorAlcancavel = true;
    atualizar('alcance', 'ok', 'O servidor respondeu à requisição.');
  } catch (erro) {
    atualizar(
      'alcance',
      'falha',
      (erro as Error).name === 'TimeoutError'
        ? 'Sem resposta em 20 segundos.'
        : 'Não foi possível alcançar pncp.gov.br (rede, proxy ou firewall corporativo).'
    );
  }

  // 3) CORS
  atualizar('cors', 'executando');

  const inicioChamada = Date.now();
  let resposta: Response | undefined;

  try {
    resposta = await fetchComTimeout(
      urlTestada,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store'
      },
      30000
    );
  } catch {
    resposta = undefined;
  }

  const latenciaMs = Date.now() - inicioChamada;

  if (!resposta) {

    if (servidorAlcancavel) {
      atualizar(
        'cors',
        'falha',
        'O servidor responde, mas o navegador bloqueou a leitura da resposta. ' +
        'É o sinal típico de CORS: a chamada precisa sair de um backend.'
      );
      ignorarRestantes('json');
      return { ...base, veredicto: 'bloqueadoCors', latenciaMs };
    }

    atualizar('cors', 'falha', 'Sem resposta do servidor.');
    ignorarRestantes('json');
    return { ...base, veredicto: 'semConexao', latenciaMs };
  }

  if (resposta.status !== 200 && resposta.status !== 204) {
    atualizar(
      'cors',
      'alerta',
      `A chamada foi permitida, mas o PNCP respondeu HTTP ${resposta.status}.`
    );
    ignorarRestantes('json');
    return { ...base, veredicto: 'erroApi', latenciaMs };
  }

  atualizar(
    'cors',
    'ok',
    `Leitura permitida. HTTP ${resposta.status} em ${latenciaMs} ms.`
  );

  // 4) JSON
  atualizar('json', 'executando');

  if (resposta.status === 204) {
    atualizar('json', 'alerta', 'HTTP 204: nenhum pregão publicado no período de teste. A conexão funciona.');
    atualizar('paginacao', 'ignorada');
    return { ...base, veredicto: 'viavel', latenciaMs, totalRegistros: 0 };
  }

  let json: IRespostaPaginaPncp | undefined;

  try {
    const bruto = await resposta.json();
    json = Array.isArray(bruto)
      ? { data: bruto as IRegistroPncp[] }
      : bruto as IRespostaPaginaPncp;
  } catch {
    atualizar('json', 'falha', 'A resposta não é um JSON válido.');
    ignorarRestantes('paginacao');
    return { ...base, veredicto: 'erroApi', latenciaMs };
  }

  const registros = obterListaDados(json);
  const primeiro = registros[0];

  if (registros.length > 0 && primeiro && !(primeiro.objetoCompra || primeiro.objeto)) {
    atualizar(
      'json',
      'alerta',
      `${registros.length} registros recebidos, mas sem o campo "objetoCompra". O formato da API pode ter mudado.`
    );
  } else {
    atualizar('json', 'ok', `${registros.length} registros de amostra recebidos.`);
  }

  // 5) Paginação
  atualizar('paginacao', 'executando');

  if (json && json.totalPaginas !== undefined) {
    atualizar(
      'paginacao',
      'ok',
      `${json.totalRegistros !== undefined ? json.totalRegistros + ' registros em ' : ''}` +
      `${json.totalPaginas} páginas (com 10 por página).`
    );
  } else {
    atualizar(
      'paginacao',
      'alerta',
      'A resposta não trouxe totalPaginas. A busca usará a quantidade de registros por página para decidir se continua.'
    );
  }

  return {
    ...base,
    veredicto: 'viavel',
    latenciaMs,
    totalRegistros: json ? json.totalRegistros : undefined,
    totalPaginas: json ? json.totalPaginas : undefined,
    amostra: registros.slice(0, 3).map(registro => ({
      objeto: registro.objetoCompra || registro.objeto || '-',
      orgao:
        (registro.orgaoEntidade &&
          (registro.orgaoEntidade.razaoSocial || registro.orgaoEntidade.nome)) ||
        '-',
      modalidade: registro.modalidadeNome || MODALIDADES_PNCP[6]
    }))
  };
};
