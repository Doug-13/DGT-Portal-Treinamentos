import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  ILicitacaoResultado
} from '../models/Licitacao';

import {
  AcompanhamentoLicitacaoService,
  IAcompanhamento,
  IAlteracaoLicitacao,
  ehTabelaAcompanhamentoInexistente
} from '../services/licitacoes/AcompanhamentoLicitacaoService';

import {
  gerarChaveEdital
} from '../services/LicitacaoParecerService';

// ============================================================
// LICITAÇÕES — ESTADO DO ACOMPANHAMENTO
//
// • Carrega os editais acompanhados e a linha do tempo.
// • Quando um edital acompanhado aparece numa busca, compara com
//   a última foto (uma vez por sessão) e grava o que mudou.
// ============================================================

export type SituacaoAcompanhamento =
  | 'semConexao'
  | 'carregando'
  | 'ok'
  | 'tabelaInexistente'
  | 'erro';

export interface IUseAcompanhamentoLicitacoes {
  situacao: SituacaoAcompanhamento;
  erro: string;
  acompanhamentos: IAcompanhamento[];
  alteracoes: IAlteracaoLicitacao[];
  processandoChave: string;
  mensagem: string;
  obter: (item: ILicitacaoResultado) => IAcompanhamento | undefined;
  naoLidas: (acompanhamentoId: string) => number;
  totalNaoLidas: number;
  acompanhar: (item: ILicitacaoResultado) => Promise<void>;
  parar: (acompanhamento: IAcompanhamento) => Promise<void>;
  marcarLidas: (acompanhamentoId: string) => void;
  verificarAgora: () => Promise<void>;
  recarregar: () => void;
}

export const useAcompanhamentoLicitacoes = (
  dataverseService: DataverseService | undefined,
  resultados: ILicitacaoResultado[],
  responsavel: string
): IUseAcompanhamentoLicitacoes => {

  const servico = React.useMemo(
    () => (dataverseService ? new AcompanhamentoLicitacaoService(dataverseService) : undefined),
    [dataverseService]
  );

  const [situacao, setSituacao] = React.useState<SituacaoAcompanhamento>(servico ? 'carregando' : 'semConexao');
  const [erro, setErro] = React.useState<string>('');
  const [acompanhamentos, setAcompanhamentos] = React.useState<IAcompanhamento[]>([]);
  const [alteracoes, setAlteracoes] = React.useState<IAlteracaoLicitacao[]>([]);
  const [versao, setVersao] = React.useState<number>(0);
  const [processandoChave, setProcessandoChave] = React.useState<string>('');
  const [mensagem, setMensagem] = React.useState<string>('');

  const verificadosRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!servico) {
      setSituacao('semConexao');
      return undefined;
    }
    let ativo = true;
    Promise.all([servico.listar(), servico.listarAlteracoes()])
      .then(([lista, linha]) => {
        if (ativo) {
          setAcompanhamentos(lista);
          setAlteracoes(linha);
          setSituacao('ok');
        }
      })
      .catch(falha => {
        if (!ativo) {
          return;
        }
        if (ehTabelaAcompanhamentoInexistente(falha)) {
          setSituacao('tabelaInexistente');
        } else {
          setSituacao('erro');
          setErro(falha instanceof Error ? falha.message : String(falha));
        }
      });
    return () => { ativo = false; };
  }, [servico, versao]);

  const recarregar = React.useCallback(() => setVersao(v => v + 1), []);

  const porChave = React.useMemo(() => {
    const mapa: Record<string, IAcompanhamento> = {};
    acompanhamentos.forEach(a => { mapa[a.chaveEdital] = a; });
    return mapa;
  }, [acompanhamentos]);

  const obter = React.useCallback(
    (item: ILicitacaoResultado): IAcompanhamento | undefined => porChave[gerarChaveEdital(item)],
    [porChave]
  );

  const naoLidasPorId = React.useMemo(() => {
    const mapa: Record<string, number> = {};
    alteracoes.filter(a => !a.lida).forEach(a => { mapa[a.acompanhamentoId] = (mapa[a.acompanhamentoId] || 0) + 1; });
    return mapa;
  }, [alteracoes]);

  // Fase 1: verifica os acompanhados que vieram na busca (1x por sessão).
  React.useEffect(() => {
    if (!servico || situacao !== 'ok') {
      return;
    }
    const pendentes = resultados.filter(item => {
      const chave = gerarChaveEdital(item);
      return !!porChave[chave] && !verificadosRef.current.has(chave);
    });
    if (pendentes.length === 0) {
      return;
    }
    pendentes.forEach(item => verificadosRef.current.add(gerarChaveEdital(item)));

    (async () => {
      let mudou = 0;
      for (const item of pendentes) {
        const acomp = porChave[gerarChaveEdital(item)];
        try {
          mudou += (await servico.verificar(item, acomp)).length;
        } catch (falha) {
          console.warn('[Acompanhamento] Falha ao verificar edital:', falha);
        }
      }
      if (mudou > 0) {
        setMensagem(`${mudou} alteração(ões) encontrada(s) nos editais acompanhados.`);
      }
      recarregar();
    })().catch(() => undefined);
  }, [resultados, porChave, servico, situacao, recarregar]);

  const acompanhar = React.useCallback(async (item: ILicitacaoResultado): Promise<void> => {
    if (!servico) {
      return;
    }
    const chave = gerarChaveEdital(item);
    setProcessandoChave(chave);
    setMensagem('');
    try {
      const r = await servico.acompanhar(item, responsavel, porChave[chave]);
      verificadosRef.current.add(chave);
      setMensagem(r.automatico
        ? `Acompanhando "${item.orgao}" — verificação automática diária ligada.`
        : `Acompanhando "${item.orgao}". ${r.aviso || 'A linha do tempo é atualizada a cada busca.'}`);
      recarregar();
    } catch (falha) {
      setMensagem(`Não foi possível acompanhar: ${falha instanceof Error ? falha.message : String(falha)}`);
    } finally {
      setProcessandoChave('');
    }
  }, [servico, responsavel, porChave, recarregar]);

  const parar = React.useCallback(async (acomp: IAcompanhamento): Promise<void> => {
    if (!servico) {
      return;
    }
    setProcessandoChave(acomp.chaveEdital);
    try {
      await servico.parar(acomp);
      setMensagem(`Acompanhamento de "${acomp.orgao}" encerrado. O histórico continua guardado.`);
      recarregar();
    } finally {
      setProcessandoChave('');
    }
  }, [servico, recarregar]);

  const marcarLidas = React.useCallback((acompanhamentoId: string): void => {
    if (!servico) {
      return;
    }
    const alvo = alteracoes.filter(a => a.acompanhamentoId === acompanhamentoId && !a.lida);
    if (alvo.length === 0) {
      return;
    }
    setAlteracoes(lista => lista.map(a => (a.acompanhamentoId === acompanhamentoId ? { ...a, lida: true } : a)));
    servico.marcarLidas(alvo).catch(f => console.warn('[Acompanhamento] Falha ao marcar como lidas:', f));
  }, [servico, alteracoes]);

  const verificarAgora = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      return;
    }
    setProcessandoChave('*');
    setMensagem('');
    try {
      const r = await servico.verificarAgora();
      setMensagem(
        `Verificação concluída: ${r.verificados || 0} edital(is) verificado(s), ` +
        `${r.novasAlteracoes || 0} alteração(ões) nova(s)` +
        `${r.pendentes ? `, ${r.pendentes} para a próxima rodada` : ''}.`
      );
      recarregar();
    } catch (falha) {
      setMensagem(`Verificação automática indisponível: ${falha instanceof Error ? falha.message.substring(0, 200) : String(falha)}`);
    } finally {
      setProcessandoChave('');
    }
  }, [servico, recarregar]);

  return {
    situacao,
    erro,
    acompanhamentos,
    alteracoes,
    processandoChave,
    mensagem,
    obter,
    naoLidas: id => naoLidasPorId[id] || 0,
    totalNaoLidas: Object.keys(naoLidasPorId).reduce((s, k) => s + naoLidasPorId[k], 0),
    acompanhar,
    parar,
    marcarLidas,
    verificarAgora,
    recarregar
  };
};

export default useAcompanhamentoLicitacoes;
