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
  IContextoTarefaClickUp,
  IAlteracaoLicitacao,
  ehTabelaAcompanhamentoInexistente
} from '../services/licitacoes/AcompanhamentoLicitacaoService';

import {
  gerarChaveEdital
} from '../services/LicitacaoParecerService';

import {
  PastaSharePointLicitacaoService,
  caminhoDaUrl
} from '../services/licitacoes/PastaSharePointLicitacaoService';

import {
  baixarBlobEdital,
  carregarDocumentosEdital,
  detectarTipo
} from '../services/PncpEditalService';

import {
  IDocumentoEdital
} from '../models/Licitacao';

// Nome do arquivo na pasta: título do PNCP + extensão (pelo tipo
// detectado, quando o título não tem). Sem CNPJ/CPF no nome.
const EXTENSOES: Record<string, string> = { pdf: '.pdf', compactado: '.zip', texto: '.txt' };

const nomeDoArquivo = (doc: IDocumentoEdital, tipo: string, blob: Blob): string => {
  const titulo = (doc.titulo || `Documento ${doc.sequencial}`)
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '')
    .trim();
  if (/\.[a-z0-9]{2,5}$/i.test(titulo)) {
    return titulo;
  }
  const mime = (blob.type || '').toLowerCase();
  const extensao = EXTENSOES[tipo] ||
    (mime.indexOf('png') >= 0 ? '.png' : mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0 ? '.jpg'
      : mime.indexOf('wordprocessingml') >= 0 ? '.docx' : mime.indexOf('spreadsheetml') >= 0 ? '.xlsx'
        : mime.indexOf('msword') >= 0 ? '.doc' : mime.indexOf('rar') >= 0 ? '.rar' : '');
  return `${titulo}${extensao}`;
};

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
  acompanhar: (item: ILicitacaoResultado) => Promise<IAcompanhamento | undefined>;
  // "Participar": acompanha (se preciso) e cria a tarefa no ClickUp.
  participar: (item: ILicitacaoResultado, contexto: IContextoTarefaClickUp) => Promise<void>;
  criarTarefaClickUp: (acompanhamento: IAcompanhamento, item: ILicitacaoResultado | undefined, contexto: IContextoTarefaClickUp, atualizarCampos?: boolean) => Promise<void>;
  // Cria (ou reaproveita) a pasta do edital no SharePoint e devolve o link.
  criarPasta: (acompanhamento: IAcompanhamento) => Promise<string | undefined>;
  // Baixa os documentos do PNCP para a pasta do edital (precisa do
  // edital da busca atual: o identificador do PNCP só existe nela).
  baixarDocumentos: (item: ILicitacaoResultado, pastaUrl: string) => Promise<void>;
  parar: (acompanhamento: IAcompanhamento) => Promise<void>;
  marcarLidas: (acompanhamentoId: string) => void;
  verificarAgora: () => Promise<void>;
  recarregar: () => void;
}

// Mensagem do plugin sem os restos do JSON do Dataverse.
const extrairMensagem = (falha: unknown): string => {
  const bruto = falha instanceof Error ? falha.message : String(falha);
  const json = /\{[\s\S]*\}/.exec(bruto);
  if (json) {
    try {
      const dados = JSON.parse(json[0]) as { error?: { message?: string } };
      if (dados.error && dados.error.message) {
        return dados.error.message.substring(0, 300);
      }
    } catch {
      return bruto.substring(0, 300);
    }
  }
  return bruto.substring(0, 300);
};

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

  const acompanhar = React.useCallback(async (item: ILicitacaoResultado): Promise<IAcompanhamento | undefined> => {
    if (!servico) {
      return undefined;
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
      return r.acompanhamento;
    } catch (falha) {
      setMensagem(`Não foi possível acompanhar: ${falha instanceof Error ? falha.message : String(falha)}`);
      return undefined;
    } finally {
      setProcessandoChave('');
    }
  }, [servico, responsavel, porChave, recarregar]);

  // Cria a tarefa de acompanhamento no ClickUp (uma por edital).
  const criarTarefaClickUp = React.useCallback(async (
    acomp: IAcompanhamento,
    item: ILicitacaoResultado | undefined,
    contexto: IContextoTarefaClickUp,
    atualizarCampos: boolean = false
  ): Promise<void> => {
    if (!servico) {
      return;
    }
    if (acomp.clickupUrl && !atualizarCampos) {
      setMensagem('Este edital já tem tarefa no ClickUp.');
      return;
    }
    // Sem o resultado da busca, monta a tarefa com a última foto.
    const base: ILicitacaoResultado = item || {
      chave: acomp.chaveEdital,
      // -1 = aderência desconhecida (não veio da busca)
      score: -1,
      motivos: [],
      numero: acomp.numero,
      orgao: acomp.orgao,
      local: acomp.local,
      modalidade: acomp.modalidade,
      objeto: acomp.objeto,
      valor: acomp.valor,
      abertura: acomp.abertura,
      encerramento: acomp.encerramento,
      url: '',
      dados: { fontesOrcamentarias: [] }
    };
    setProcessandoChave(acomp.chaveEdital);
    try {
      const r = await servico.criarTarefaClickUp(base, acomp, contexto, atualizarCampos);
      const campos = r.camposPreenchidos !== undefined
        ? ` ${r.camposPreenchidos} campo(s) preenchido(s).`
        : '';
      const falhas = r.camposComErro.length > 0
        ? ` Não preenchidos: ${r.camposComErro.join(' · ')}.`
        : '';
      setMensagem(
        (atualizarCampos
          ? 'Campos da tarefa no ClickUp atualizados.'
          : r.existente ? 'Este edital já tinha tarefa no ClickUp.' : 'Tarefa de acompanhamento criada no ClickUp.') +
        campos + falhas
      );
      recarregar();
    } catch (falha) {
      setMensagem(`Não foi possível criar a tarefa no ClickUp: ${extrairMensagem(falha)}`);
    } finally {
      setProcessandoChave('');
    }
  }, [servico, recarregar]);

  const pastas = React.useMemo(() => new PastaSharePointLicitacaoService(), []);

  const criarPasta = React.useCallback(async (acomp: IAcompanhamento): Promise<string | undefined> => {
    if (!servico) {
      return undefined;
    }
    if (acomp.pastaUrl) {
      return acomp.pastaUrl;
    }
    setProcessandoChave(acomp.chaveEdital);
    try {
      const pasta = await pastas.garantirPasta({
        local: acomp.local,
        orgao: acomp.orgao,
        numero: acomp.numero,
        publicacao: acomp.criadoEm
      });
      await servico.salvarPasta(acomp.id, pasta.url);
      const relativo = pasta.caminho.split('/Shared Documents/')[1] || pasta.caminho;
      setMensagem(pasta.criada
        ? `Pasta criada no SharePoint: ${relativo}${pasta.clienteExistia ? ' (cliente já existia: pasta própria do edital)' : ''}`
        : `A pasta do edital já existia no SharePoint e foi vinculada: ${relativo}`);
      recarregar();
      return pasta.url;
    } catch (falha) {
      setMensagem(`Não foi possível criar a pasta no SharePoint: ${falha instanceof Error ? falha.message : String(falha)}`);
      return undefined;
    } finally {
      setProcessandoChave('');
    }
  }, [servico, pastas, recarregar]);

  const baixarDocumentos = React.useCallback(async (
    item: ILicitacaoResultado,
    pastaUrl: string
  ): Promise<void> => {
    const caminho = caminhoDaUrl(pastaUrl);
    if (!item.idPncp || !caminho) {
      setMensagem('Para baixar os documentos, abra o edital pela busca (o PNCP precisa do identificador do edital).');
      return;
    }
    const chave = gerarChaveEdital(item);
    setProcessandoChave(chave);
    try {
      const documentos = await carregarDocumentosEdital(item.idPncp);
      if (documentos.length === 0) {
        setMensagem('O PNCP não tem documentos publicados para este edital.');
        return;
      }
      let enviados = 0;
      let existentes = 0;
      const falhas: string[] = [];
      for (let i = 0; i < documentos.length; i++) {
        const doc = documentos[i];
        setMensagem(`Baixando documentos do edital para a pasta: ${i + 1} de ${documentos.length}…`);
        try {
          // 1º pelo navegador; se o PNCP bloquear (CORS), pelo servidor.
          let blob: Blob;
          let tipo: string;
          try {
            const direto = await baixarBlobEdital(doc.url);
            blob = direto.blob;
            tipo = direto.tipo;
          } catch (erroDireto) {
            if (!servico) {
              throw erroDireto;
            }
            const pelaApi = await servico.baixarArquivoPeloServidor(doc.url);
            blob = pelaApi.blob;
            tipo = await detectarTipo(blob);
          }
          const resultado = await pastas.enviarArquivo(caminho, nomeDoArquivo(doc, tipo, blob), blob);
          if (resultado === 'enviado') {
            enviados++;
          } else {
            existentes++;
          }
        } catch (falha) {
          const motivo = falha instanceof Error ? falha.message : String(falha);
          console.warn(`[Licitações] Documento "${doc.titulo}" não foi para a pasta:`, falha);
          falhas.push(`${doc.titulo}: ${/failed to fetch|networkerror|load failed/i.test(motivo)
            ? 'o navegador não conseguiu baixar o arquivo do PNCP (bloqueio de acesso entre sites)'
            : motivo}`);
        }
      }
      setMensagem(
        `Documentos na pasta do edital: ${enviados} baixado(s)` +
        `${existentes ? `, ${existentes} já estava(m) lá` : ''}` +
        `${falhas.length ? `. Não baixados: ${falhas.join(' · ')}` : '.'}`
      );
    } catch (falha) {
      console.warn('[Licitações] Falha ao baixar os documentos para a pasta:', falha);
      setMensagem(`Não foi possível baixar os documentos: ${falha instanceof Error ? falha.message : String(falha)}`);
    } finally {
      setProcessandoChave('');
    }
  }, [pastas, servico]);

  // "Participar": acompanha → cria a pasta no SharePoint → baixa os
  // documentos do edital para a pasta → cria a tarefa no ClickUp (já
  // com o link da pasta).
  const participar = React.useCallback(async (
    item: ILicitacaoResultado,
    contexto: IContextoTarefaClickUp
  ): Promise<void> => {
    const acomp = porChave[gerarChaveEdital(item)] || await acompanhar(item);
    if (!acomp) {
      return;
    }
    const novaPasta = !acomp.pastaUrl;
    const pastaUrl = acomp.pastaUrl || await criarPasta({ ...acomp, local: item.local || acomp.local, numero: item.numero || acomp.numero, criadoEm: item.publicacao || acomp.criadoEm });
    if (!acomp.clickupUrl) {
      await criarTarefaClickUp({ ...acomp, pastaUrl: pastaUrl || acomp.pastaUrl }, item, contexto);
    }
    // Por último (pode demorar): os documentos vão para a pasta.
    if (pastaUrl && novaPasta) {
      await baixarDocumentos(item, pastaUrl);
    }
  }, [porChave, acompanhar, criarPasta, criarTarefaClickUp, baixarDocumentos]);

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
    participar,
    criarTarefaClickUp,
    criarPasta,
    baixarDocumentos,
    parar,
    marcarLidas,
    verificarAgora,
    recarregar
  };
};

export default useAcompanhamentoLicitacoes;
