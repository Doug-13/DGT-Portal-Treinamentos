import * as React from 'react';

import {
  DataverseService
} from '../../../services/DataverseService';

import {
  IConfigComponente,
  IEnvelopeComponente,
  filtrarColunas,
  gravarEnvelopeComponente,
  lerEnvelopeComponente,
  montarConsultaFonte
} from '../../../services/fluxo/valorComponente';

// ============================================================
// COMPONENTE HTML (isolado)
//
// O HTML configurado roda num <iframe sandbox="allow-scripts"> SEM
// "allow-same-origin": não acessa o token, os cookies nem a página do
// portal. Fala com o portal só por mensagens (a "ponte"):
//
//   DGT.aoIniciar(fn)            → recebe { dados, somenteLeitura, valores, tema }
//   DGT.consultar(fonte, filtros) → Promise com as linhas da fonte liberada
//   DGT.alterar({ dados, valido, erros, resumo, itens })
//   DGT.ajustarAltura(px)        → (a altura também é medida sozinha)
//
// O portal só aceita mensagens DESTE iframe, só consulta as fontes da
// configuração (tabela + colunas) e só grava o valor do próprio campo.
// ============================================================

export interface IComponenteHtmlProps {
  config: IConfigComponente;
  valor: string;
  onAlterar: (valor: string) => void;
  somenteLeitura: boolean;
  valoresRegistro?: Record<string, string>;
  dataverseService?: DataverseService;
}

const LIMITE_LINHAS = 5000;

// Tema DGT disponível ao HTML (CSS variables).
const TEMA_CSS = `
:root {
  --dgt-azul: #202A44; --dgt-ciano: #05C3DD; --dgt-borda: #E5E7EB; --dgt-texto2: #64748B;
  --dgt-verde: #107C10; --dgt-ambar: #B45309; --dgt-vermelho: #B42318; --dgt-fundo: #F7F9FB;
  --dgt-fonte: Barlow, Arial, 'Segoe UI', sans-serif;
}
html, body { margin: 0; padding: 0; font-family: var(--dgt-fonte); color: var(--dgt-azul); background: transparent; }
`;

// Ponte injetada no início do documento do componente.
const PONTE_JS = `
(function () {
  var pendentes = {}, sequencia = 0, contexto = null, ouvintes = [];
  function enviar(mensagem) { mensagem.canal = 'dgt-componente'; parent.postMessage(mensagem, '*'); }
  window.addEventListener('message', function (evento) {
    var m = evento.data;
    if (!m || m.canal !== 'dgt-portal') { return; }
    if (m.tipo === 'iniciar') { contexto = m.contexto; ouvintes.forEach(function (f) { try { f(contexto); } catch (e) { console.error(e); } }); }
    if (m.tipo === 'resposta' && pendentes[m.id]) {
      var p = pendentes[m.id]; delete pendentes[m.id];
      if (m.ok) { p.ok(m.dados); } else { p.erro(new Error(m.erro || 'Falha na consulta')); }
    }
  });
  window.DGT = {
    aoIniciar: function (f) { if (contexto) { f(contexto); } else { ouvintes.push(f); } },
    consultar: function (fonte, filtros) {
      return new Promise(function (ok, erro) {
        var id = ++sequencia; pendentes[id] = { ok: ok, erro: erro };
        enviar({ tipo: 'consultar', id: id, fonte: fonte, filtros: filtros || {} });
      });
    },
    alterar: function (envelope) { enviar({ tipo: 'alterar', envelope: envelope }); },
    ajustarAltura: function (altura) { enviar({ tipo: 'altura', altura: altura || document.documentElement.scrollHeight }); }
  };
  var ultima = 0;
  function medir() {
    var altura = document.documentElement.scrollHeight;
    if (Math.abs(altura - ultima) > 4) { ultima = altura; enviar({ tipo: 'altura', altura: altura }); }
  }
  window.addEventListener('load', function () {
    medir();
    if (window.ResizeObserver) { new ResizeObserver(medir).observe(document.body); }
    setInterval(medir, 1000);
  });
  enviar({ tipo: 'pronto' });
})();
`;

// Documento final: tema + ponte + HTML configurado (aceita documento
// completo ou só o corpo).
export const montarDocumentoComponente = (html: string): string => {
  const cabecalho = `<meta charset="utf-8"><style>${TEMA_CSS}</style><script>${PONTE_JS}</script>`;
  const conteudo = html || '';
  if (/<head[^>]*>/i.test(conteudo)) {
    return conteudo.replace(/<head[^>]*>/i, encontrado => `${encontrado}${cabecalho}`);
  }
  if (/<html[^>]*>/i.test(conteudo)) {
    return conteudo.replace(/<html[^>]*>/i, encontrado => `${encontrado}<head>${cabecalho}</head>`);
  }
  return `<!DOCTYPE html><html><head>${cabecalho}</head><body>${conteudo}</body></html>`;
};

interface IMensagemComponente {
  canal?: string;
  tipo?: string;
  id?: number;
  fonte?: string;
  filtros?: Record<string, string | number | boolean>;
  envelope?: IEnvelopeComponente;
  altura?: number;
}

const ComponenteHtml: React.FC<IComponenteHtmlProps> = (props) => {

  const quadro = React.useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = React.useState<number>(props.config.altura || 480);
  const [erroPonte, setErroPonte] = React.useState('');

  // O documento NÃO muda com o valor (senão o iframe recarregaria a
  // cada alteração e o usuário perderia o que está fazendo).
  const documento = React.useMemo(() => montarDocumentoComponente(props.config.html || ''), [props.config.html]);

  // Últimos valores, para o ouvinte de mensagens (registrado uma vez).
  const atual = React.useRef(props);
  atual.current = props;

  React.useEffect(() => {

    const responder = (mensagem: Record<string, unknown>): void => {
      const janela = quadro.current ? quadro.current.contentWindow : undefined;
      if (janela) {
        janela.postMessage({ canal: 'dgt-portal', ...mensagem }, '*');
      }
    };

    const ouvir = (evento: MessageEvent): void => {
      // Só mensagens do NOSSO iframe.
      if (!quadro.current || evento.source !== quadro.current.contentWindow) {
        return;
      }
      const m = evento.data as IMensagemComponente;
      if (!m || m.canal !== 'dgt-componente') {
        return;
      }
      const p = atual.current;

      if (m.tipo === 'pronto') {
        const envelope = lerEnvelopeComponente(p.valor);
        responder({
          tipo: 'iniciar',
          contexto: {
            dados: envelope ? envelope.dados : undefined,
            somenteLeitura: p.somenteLeitura,
            valores: p.valoresRegistro || {},
            tema: { azul: '#202A44', ciano: '#05C3DD', verde: '#107C10', ambar: '#B45309', vermelho: '#B42318' }
          }
        });
        return;
      }

      if (m.tipo === 'consultar') {
        const fonte = (p.config.fontes || []).find(item => item.nome === m.fonte);
        if (!fonte) {
          responder({ tipo: 'resposta', id: m.id, ok: false, erro: `Fonte "${m.fonte}" não está liberada neste componente.` });
          return;
        }
        if (!p.dataverseService) {
          responder({ tipo: 'resposta', id: m.id, ok: false, erro: 'Sem conexão com o Dataverse.' });
          return;
        }
        const { consulta, erros } = montarConsultaFonte(fonte, m.filtros);
        if (erros.length > 0) {
          responder({ tipo: 'resposta', id: m.id, ok: false, erro: erros.join(' ') });
          return;
        }
        p.dataverseService.listarRegistros(fonte.tabela, consulta)
          .then(registros => responder({ tipo: 'resposta', id: m.id, ok: true, dados: filtrarColunas(fonte, registros.slice(0, LIMITE_LINHAS)) }))
          .catch((erro: unknown) => {
            const texto = erro instanceof Error ? erro.message : String(erro);
            setErroPonte(`Consulta à fonte "${fonte.nome}" falhou: ${texto}`);
            responder({ tipo: 'resposta', id: m.id, ok: false, erro: texto });
          });
        return;
      }

      if (m.tipo === 'alterar' && m.envelope && !p.somenteLeitura) {
        p.onAlterar(gravarEnvelopeComponente(m.envelope));
        return;
      }

      if (m.tipo === 'altura' && typeof m.altura === 'number') {
        setAltura(Math.max(120, Math.min(6000, Math.round(m.altura) + 8)));
      }
    };

    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  return (
    <div>
      <iframe
        ref={quadro}
        title="Componente personalizado"
        // Sem allow-same-origin: o componente não acessa nada do portal.
        sandbox="allow-scripts allow-popups allow-downloads"
        srcDoc={documento}
        style={{ width: '100%', height: `${altura}px`, border: 0, display: 'block', background: 'transparent' }}
      />
      {erroPonte && <div style={{ fontSize: '12px', color: '#B42318', marginTop: '4px' }}>{erroPonte}</div>}
    </div>
  );
};

export default ComponenteHtml;
