import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  ILicitacaoResultado,
  IParecerLicitacao,
  ISituacaoParecer
} from '../models/Licitacao';

import {
  IAnaliseIaLicitacao,
  IEstadoAnaliseIa,
  IPromptIa
} from '../models/LicitacaoIa';

import {
  PromptIaService,
  PROMPT_PADRAO_LICITACOES
} from '../services/ia/PromptIaService';

import {
  LicitacaoAnaliseIaService
} from '../services/ia/LicitacaoAnaliseIaService';

import {
  EnviarParaIa,
  criarProvedorIa
} from '../services/ia/provedoresIa';

import {
  gerarChaveEdital
} from '../services/LicitacaoParecerService';

// ============================================================
// LICITAÇÕES — ESTADO DAS ANÁLISES DE IA
//
// Ao chegar um resultado da busca:
//   • já tem parecer (Participar / Não participar) → analisa por
//     último (só para a aderência); a tela mostra o parecer;
//   • tem análise guardada (cache)                  → mostra;
//   • senão, e com "análise automática" ligada     → entra na fila
//     (uma por vez, para não sobrecarregar a API).
// ============================================================

export interface IUseAnaliseIaLicitacoes {
  prompt: IPromptIa;
  promptSalvo: boolean;
  tabelasIaExistem: boolean;
  cacheAtivo: boolean;
  // Serviço de IA (Claude) configurado no web part?
  apiDisponivel: boolean;
  estadoDe: (item: ILicitacaoResultado) => IEstadoAnaliseIa;
  analisar: (item: ILicitacaoResultado) => void;
  recarregarPrompt: () => void;
  definirPrompt: (prompt: IPromptIa) => void;
  promptService?: PromptIaService;
  servicoAnalise: LicitacaoAnaliseIaService;
}

export const useAnaliseIaLicitacoes = (
  dataverseService: DataverseService | undefined,
  resultados: ILicitacaoResultado[],
  obterParecer: (item: ILicitacaoResultado) => ISituacaoParecer | undefined,
  pareceresAtuais: IParecerLicitacao[],
  pareceresProntos: boolean,
  enviarParaIa?: EnviarParaIa
): IUseAnaliseIaLicitacoes => {

  const promptService = React.useMemo(
    () => (dataverseService ? new PromptIaService(dataverseService) : undefined),
    [dataverseService]
  );

  const servicoAnalise = React.useMemo(
    () => new LicitacaoAnaliseIaService(dataverseService),
    [dataverseService]
  );

  const [prompt, setPrompt] = React.useState<IPromptIa>(PROMPT_PADRAO_LICITACOES);
  const [promptSalvo, setPromptSalvo] = React.useState<boolean>(false);
  const [tabelasIaExistem, setTabelasIaExistem] = React.useState<boolean>(true);
  const [promptPronto, setPromptPronto] = React.useState<boolean>(false);
  const [versaoPrompt, setVersaoPrompt] = React.useState<number>(0);

  const [estados, setEstados] = React.useState<Record<string, IEstadoAnaliseIa>>({});
  const [cachePronto, setCachePronto] = React.useState<boolean>(false);

  // Refs para a fila não depender de re-renderizações.
  const estadosRef = React.useRef(estados);
  estadosRef.current = estados;
  const ocupadoRef = React.useRef<boolean>(false);
  const filaRef = React.useRef<ILicitacaoResultado[]>([]);
  const contextoRef = React.useRef({ prompt, pareceresAtuais, enviarParaIa });
  contextoRef.current = { prompt, pareceresAtuais, enviarParaIa };

  // Prompt ativo
  React.useEffect(() => {
    let ativo = true;
    if (!promptService) {
      setPromptPronto(true);
      return undefined;
    }
    promptService.obterAtivo()
      .then(r => {
        if (ativo) {
          setPrompt(r.prompt);
          setPromptSalvo(r.salvoNoDataverse);
          setTabelasIaExistem(r.tabelaExiste);
        }
      })
      .catch(erro => console.warn('[IA Licitações] Prompt não carregado; usando o padrão.', erro))
      .then(() => { if (ativo) { setPromptPronto(true); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [promptService, versaoPrompt]);

  // Cache de análises
  React.useEffect(() => {
    let ativo = true;
    servicoAnalise.listarCache()
      .then(mapa => {
        if (!ativo) {
          return;
        }
        setEstados(atual => {
          const novo = { ...atual };
          Object.keys(mapa).forEach(chave => {
            if (!novo[chave] || novo[chave].situacao !== 'analisando') {
              novo[chave] = { situacao: 'pronta', analise: mapa[chave] };
            }
          });
          return novo;
        });
      })
      .catch(erro => console.warn('[IA Licitações] Cache de análises indisponível.', erro))
      .then(() => { if (ativo) { setCachePronto(true); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [servicoAnalise]);

  const definirEstado = (chave: string, estado: IEstadoAnaliseIa): void =>
    setEstados(atual => ({ ...atual, [chave]: estado }));

  // Processa a fila, uma análise por vez.
  const processarFila = React.useCallback((): void => {

    if (ocupadoRef.current) {
      return;
    }

    const proximo = filaRef.current.shift();

    if (!proximo) {
      return;
    }

    const chave = gerarChaveEdital(proximo);
    const ctx = contextoRef.current;

    ocupadoRef.current = true;
    definirEstado(chave, { situacao: 'analisando' });

    servicoAnalise
      .analisar(
        proximo,
        ctx.prompt,
        ctx.pareceresAtuais,
        criarProvedorIa(ctx.prompt.provedor, ctx.enviarParaIa)
      )
      .then((analise: IAnaliseIaLicitacao) => definirEstado(chave, { situacao: 'pronta', analise }))
      .catch(erro => definirEstado(chave, {
        situacao: 'erro',
        erro: erro instanceof Error ? erro.message : String(erro)
      }))
      .then(() => {
        ocupadoRef.current = false;
        processarFila();
      })
      .catch(() => undefined);
  }, [servicoAnalise]);

  const enfileirar = React.useCallback((item: ILicitacaoResultado, frente: boolean): void => {
    const chave = gerarChaveEdital(item);
    filaRef.current = filaRef.current.filter(f => gerarChaveEdital(f) !== chave);
    if (frente) {
      filaRef.current.unshift(item);
    } else {
      filaRef.current.push(item);
    }
    if (!estadosRef.current[chave] || estadosRef.current[chave].situacao !== 'analisando') {
      definirEstado(chave, { situacao: 'aguardando' });
    }
    processarFila();
  }, [processarFila]);

  // Análise automática dos resultados sem parecer e sem cache.
  React.useEffect(() => {

    if (!promptPronto || !cachePronto || !pareceresProntos || !prompt.analiseAutomatica) {
      return;
    }

    // Primeiro os editais SEM parecer; depois os já decididos (a
    // aderência mostrada no portal e no ClickUp é a da IA). Cada edital
    // é analisado uma vez só (fica guardado).
    const semParecer = resultados.filter(item => !obterParecer(item));
    const comParecer = resultados.filter(item => !!obterParecer(item));
    semParecer.concat(comParecer).forEach(item => {
      const chave = gerarChaveEdital(item);
      const estado = estadosRef.current[chave];
      if (!estado) {
        enfileirar(item, false);
      }
    });
  }, [resultados, promptPronto, cachePronto, pareceresProntos, prompt.analiseAutomatica, obterParecer, enfileirar]);

  const estadoDe = React.useCallback(
    (item: ILicitacaoResultado): IEstadoAnaliseIa =>
      estados[gerarChaveEdital(item)] || { situacao: 'naoIniciada' },
    [estados]
  );

  return {
    prompt,
    promptSalvo,
    tabelasIaExistem,
    cacheAtivo: servicoAnalise.temCache,
    apiDisponivel: !!enviarParaIa,
    estadoDe,
    analisar: item => enfileirar(item, true),
    recarregarPrompt: () => setVersaoPrompt(v => v + 1),
    definirPrompt: novo => { setPrompt(novo); setPromptSalvo(true); setTabelasIaExistem(true); },
    promptService,
    servicoAnalise
  };
};

export default useAnaliseIaLicitacoes;
