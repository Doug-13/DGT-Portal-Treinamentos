import {
  DataverseService
} from '../../services/DataverseService';

import {
  filtrarColunas,
  montarConsultaFonte
} from '../../services/fluxo/valorComponente';

import {
  IConfigScript,
  IEntradaScript,
  IResultadoScript,
  TEMPO_LIMITE_PADRAO,
  filtrarSaidaScript,
  montarDocumentoScript,
  urlPermitida
} from '../../services/fluxo/scriptFluxo';

// ============================================================
// EXECUTOR DE SCRIPTS (navegador)
//
// Cria um <iframe sandbox="allow-scripts"> invisível, SEM
// allow-same-origin: o script não acessa o login, os cookies nem o
// portal. O portal atende a ponte:
//   consultar → só fontes liberadas (tabela + colunas), igualdade
//   http      → só HTTPS para endereços liberados, sem credenciais
//   log       → guardado para o teste
// Ao fim (ou no tempo limite) o quadro é removido.
// ============================================================

const LIMITE_LOG = 200;
const LIMITE_TEXTO = 200000;

interface IMensagemScript {
  canal?: string;
  tipo?: string;
  id?: number;
  fonte?: string;
  filtros?: Record<string, string | number | boolean>;
  url?: string;
  opcoes?: { metodo?: string; corpo?: unknown };
  texto?: string;
  resultado?: { valores?: unknown; mensagem?: unknown; erro?: unknown };
}

export const executarScriptIsolado = (
  config: IConfigScript,
  entrada: IEntradaScript,
  dataverseService?: DataverseService
): Promise<IResultadoScript> =>
  new Promise<IResultadoScript>(resolve => {

    const log: string[] = [];
    const quadro = document.createElement('iframe');
    quadro.setAttribute('sandbox', 'allow-scripts');
    quadro.setAttribute('aria-hidden', 'true');
    quadro.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
    quadro.srcdoc = montarDocumentoScript(config.codigo);

    let terminado = false;
    let relogio = 0;
    // Definido abaixo; declarado aqui para "terminar" poder removê-lo.
    let ouvir: (evento: MessageEvent) => void = () => undefined;

    const terminar = (resultado: IResultadoScript): void => {
      if (terminado) {
        return;
      }
      terminado = true;
      window.clearTimeout(relogio);
      window.removeEventListener('message', ouvir);
      if (quadro.parentNode) {
        quadro.parentNode.removeChild(quadro);
      }
      resolve(resultado);
    };

    const responder = (mensagem: Record<string, unknown>): void => {
      if (quadro.contentWindow) {
        quadro.contentWindow.postMessage({ canal: 'dgt-portal-script', ...mensagem }, '*');
      }
    };

    ouvir = (evento: MessageEvent): void => {
      if (evento.source !== quadro.contentWindow) {
        return;
      }
      const m = evento.data as IMensagemScript;
      if (!m || m.canal !== 'dgt-script') {
        return;
      }

      if (m.tipo === 'pronto') {
        responder({ tipo: 'iniciar', entrada });
        return;
      }

      if (m.tipo === 'log') {
        if (log.length < LIMITE_LOG) {
          log.push(String(m.texto || '').substring(0, 1000));
        }
        return;
      }

      if (m.tipo === 'consultar') {
        const fonte = (config.fontes || []).find(item => item.nome === m.fonte);
        if (!fonte || !dataverseService) {
          responder({ tipo: 'resposta', id: m.id, ok: false, erro: fonte ? 'Sem conexão com o Dataverse.' : `Fonte "${m.fonte}" não está liberada neste script.` });
          return;
        }
        const { consulta, erros } = montarConsultaFonte(fonte, m.filtros);
        if (erros.length > 0) {
          responder({ tipo: 'resposta', id: m.id, ok: false, erro: erros.join(' ') });
          return;
        }
        dataverseService.listarRegistros(fonte.tabela, consulta)
          .then(linhas => responder({ tipo: 'resposta', id: m.id, ok: true, dados: filtrarColunas(fonte, linhas.slice(0, 5000)) }))
          .catch((erro: unknown) => responder({ tipo: 'resposta', id: m.id, ok: false, erro: erro instanceof Error ? erro.message : String(erro) }));
        return;
      }

      if (m.tipo === 'http') {
        const url = String(m.url || '');
        const permissao = urlPermitida(url, config.hostsPermitidos || []);
        if (!permissao.ok) {
          responder({ tipo: 'resposta', id: m.id, ok: false, erro: permissao.motivo });
          return;
        }
        const metodo = String((m.opcoes && m.opcoes.metodo) || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
        const corpo = m.opcoes && m.opcoes.corpo !== undefined ? JSON.stringify(m.opcoes.corpo) : undefined;
        fetch(url, {
          method: metodo,
          credentials: 'omit',
          headers: corpo ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
          body: metodo === 'POST' ? corpo : undefined
        })
          .then(resposta => resposta.text().then(texto => {
            let dados: unknown;
            try { dados = JSON.parse(texto); } catch { dados = undefined; }
            responder({ tipo: 'resposta', id: m.id, ok: true, dados: { status: resposta.status, ok: resposta.ok, dados, texto: texto.substring(0, LIMITE_TEXTO) } });
          }))
          .catch((erro: unknown) => responder({
            tipo: 'resposta',
            id: m.id,
            ok: false,
            erro: `Falha ao chamar ${url}: ${erro instanceof Error ? erro.message : String(erro)} (a API precisa aceitar chamadas do navegador — CORS).`
          }));
        return;
      }

      if (m.tipo === 'fim') {
        const r = m.resultado || {};
        if (r.erro) {
          terminar({ valores: {}, erros: [String(r.erro).substring(0, 500)], log });
          return;
        }
        terminar({
          valores: filtrarSaidaScript(config, r.valores),
          erros: [],
          mensagem: r.mensagem ? String(r.mensagem).substring(0, 300) : undefined,
          log
        });
      }
    };

    const segundos = config.tempoLimiteSegundos || TEMPO_LIMITE_PADRAO;
    relogio = window.setTimeout(
      () => terminar({ valores: {}, erros: [`passou do tempo limite (${segundos} s).`], log }),
      segundos * 1000
    );

    window.addEventListener('message', ouvir);
    document.body.appendChild(quadro);
  });
