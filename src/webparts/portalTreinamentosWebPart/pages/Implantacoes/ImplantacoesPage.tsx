import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  BaseImplantacoes,
  IArquivoImportacao,
  IProgressoImportacao,
  tabelaImplantacoesAusente
} from '../../services/implantacoes/BaseImplantacoes';

import {
  ehAdministradorImplantacoes,
  podeNoPainel,
  sessaoImplantacoes
} from '../../services/implantacoes/permissoesImplantacoes';

import {
  criarPonteApi
} from '../../services/implantacoes/PonteApiImplantacoes';

import {
  montarAmbientePainel
} from '../../services/implantacoes/AmbientePainel';

import {
  criarCarregadorBibliotecas
} from '../../services/implantacoes/BibliotecasPainel';

import {
  RelatorioImplantacoes
} from '../../services/implantacoes/RelatorioImplantacoes';

import {
  iniciarPainelLegado
} from './legado/painelApp';

import {
  PAINEL_CSS
} from './legado/painelCss';

import {
  PAINEL_HTML
} from './legado/painelHtml';

// ============================================================
// IMPLANTAÇÕES — página do painel de gestão de implantações
//
// O painel (carteira, cronogramas, físico x financeiro, PMO, equipes
// de campo, assistente IA) foi escrito em JavaScript puro, com a
// própria folha de estilos. Ele é desenhado no fluxo normal da página
// do portal (sem caixa nem rolagem própria), dentro de uma shadow root
// que isola os estilos (services/implantacoes/AmbientePainel.ts):
//
//   1. lê a base no Dataverse (BaseImplantacoes);
//   2. monta a estrutura e os estilos na shadow root (tema do portal);
//   3. entrega ao painel a base, a sessão e as permissões DO PORTAL
//      (window.LOCAL_HOST / SESSAO / PODE) e a ponte das rotas api/*;
//   4. chama o código do painel (legado/painelApp.js).
//
// Login, usuários, setores e perfis do painel antigo não existem
// mais: valem o módulo "implantacoes" e o perfil no portal.
// ============================================================

export interface IImplantacoesPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
}

type Situacao = 'carregando' | 'pronto' | 'erro' | 'semTabela';

interface IJanelaPainel {
  __carregarBiblioteca?: (endereco: string) => Promise<void>;
  __carregarEstilo?: (endereco: string) => void;
  __lerPlanilha?: (arquivo: File) => Promise<string[][]>;
  SESSAO?: unknown;
  PODE?: (recurso: string, acao?: string) => boolean;
  LOCAL_HOST?: unknown;
  __sync?: { txt: string; erro: boolean };
  __avisoPerm?: (mensagem: string) => void;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  texto2: '#5B6478',
  borda: '#D9DEE8',
  fundo: '#F5F7FA',
  erro: '#B42318'
};

const caixa: React.CSSProperties = {
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  background: '#fff',
  padding: '16px 18px',
  marginBottom: '12px',
  color: COR.azul,
  fontSize: '14px',
  lineHeight: 1.5
};

const botao: React.CSSProperties = {
  background: COR.azul,
  color: '#fff',
  border: 0,
  borderRadius: '6px',
  padding: '8px 14px',
  fontWeight: 600,
  cursor: 'pointer'
};

// Ícones do botão de tela cheia (duas setas na diagonal).
const ICONE_TELA_CHEIA =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-7 7"/><path d="M10 20H4v-6"/><path d="M4 20l7-7"/></svg>';

const ICONE_SAIR_TELA_CHEIA =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M4 14h6v6"/><path d="M10 14l-7 7"/></svg>';

const lerArquivo = (arquivo: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || ''));
    leitor.onerror = () => reject(new Error(`Não foi possível ler ${arquivo.name}.`));
    leitor.readAsText(arquivo, 'utf-8');
  });

const ImplantacoesPage: React.FC<IImplantacoesPageProps> = ({ dataverseService, contexto }) => {

  const hospedeiro = React.useRef<HTMLDivElement>(null);
  const base = React.useRef<BaseImplantacoes>();

  const [situacao, setSituacao] = React.useState<Situacao>('carregando');
  const [mensagem, setMensagem] = React.useState<string>('');
  const [vazia, setVazia] = React.useState<boolean>(false);
  const [importacao, setImportacao] = React.useState<IProgressoImportacao>();
  const [importando, setImportando] = React.useState<boolean>(false);
  // Muda a cada (re)carga: recria o painel do zero.
  const [versao, setVersao] = React.useState<number>(0);

  const administra = ehAdministradorImplantacoes(contexto);

  // ----------------------------------------------------------
  // 1. Base de dados
  // ----------------------------------------------------------

  React.useEffect(() => {

    if (!dataverseService || !contexto) {
      setSituacao('erro');
      setMensagem('Conexão com o Dataverse indisponível. Recarregue a página.');
      return;
    }

    let cancelado = false;

    const nova = new BaseImplantacoes(dataverseService, sessaoImplantacoes(contexto));

    setSituacao('carregando');

    nova.carregar()
      .then(() => {
        if (cancelado) {
          return;
        }
        base.current = nova;
        setVazia(nova.vazia);
        setSituacao('pronto');
      })
      .catch((erro: unknown) => {
        if (cancelado) {
          return;
        }
        if (tabelaImplantacoesAusente(erro)) {
          setSituacao('semTabela');
        } else {
          setSituacao('erro');
          setMensagem(erro instanceof Error ? erro.message.substring(0, 500) : String(erro));
        }
      });

    return () => {
      cancelado = true;
      nova.pararSincronia();
    };
  }, [dataverseService, contexto, versao]);

  // ----------------------------------------------------------
  // 2. Painel na página
  // ----------------------------------------------------------

  React.useEffect(() => {

    const dados = base.current;
    const elemento = hospedeiro.current;

    // Base vazia: o painel só abre depois da importação (aberto vazio,
    // ele criaria um "projeto principal" padrão por cima dos dados antigos).
    if (situacao !== 'pronto' || vazia || !dados || !elemento || !dataverseService || !contexto) {
      return;
    }

    const sessao = sessaoImplantacoes(contexto);

    // Estrutura e estilos na shadow root, sem nenhum script (o código
    // vem do pacote do portal). documento/janela: fachadas do ambiente.
    const ambiente = montarAmbientePainel(elemento, PAINEL_CSS, PAINEL_HTML);
    const documento = ambiente.documento;
    const janela = ambiente.janela as unknown as IJanelaPainel & Window;

    // Bibliotecas (PDF, Excel, mapa) do pacote do portal, sob demanda.
    const bibliotecas =
      criarCarregadorBibliotecas(
        janela as unknown as Record<string, unknown>,
        ambiente.cabeca
      );

    janela.__carregarBiblioteca = bibliotecas.carregarScript;
    janela.__carregarEstilo = bibliotecas.carregarEstilo;
    janela.__lerPlanilha = bibliotecas.lerPlanilha;

    // Tela cheia (só neste módulo; não guarda preferência). Esc sai.
    const botaoTela = document.createElement('button');
    botaoTela.type = 'button';
    botaoTela.className = 'implfs';

    const atualizarBotaoTela = (): void => {
      const cheia = document.fullscreenElement === elemento;
      botaoTela.innerHTML = cheia ? ICONE_SAIR_TELA_CHEIA : ICONE_TELA_CHEIA;
      botaoTela.title = cheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia';
      botaoTela.setAttribute('aria-label', botaoTela.title);
      botaoTela.setAttribute('aria-pressed', cheia ? 'true' : 'false');
    };

    botaoTela.addEventListener('click', () => {
      if (document.fullscreenElement === elemento) {
        document.exitFullscreen().catch(() => undefined);
      } else if (elemento.requestFullscreen) {
        elemento.requestFullscreen().catch(() => undefined);
      }
    });

    atualizarBotaoTela();
    ambiente.corpo.appendChild(botaoTela);
    document.addEventListener('fullscreenchange', atualizarBotaoTela);

    janela.SESSAO = sessao;
    janela.PODE = (recurso: string, acao?: string) => podeNoPainel(sessao.perms, recurso, acao);

    janela.LOCAL_HOST = {
      use: async (recurso: string): Promise<unknown> => {
        if (recurso === 'db') {
          return dados;
        }
        if (recurso === 'user') {
          return {
            can: async (permissao: string): Promise<boolean> => {
              if (permissao === 'data.write') {
                return podeNoPainel(sessao.perms, 'projetos', 'editar');
              }
              const partes = String(permissao).split('.');
              return podeNoPainel(sessao.perms, partes[0], partes[1]);
            }
          };
        }
        return undefined;
      }
    };

    // Selo de conexão (o painel mostra window.__sync no topo da carteira).
    dados.aoMudarEstado = estado => {
      janela.__sync = { txt: estado.texto, erro: estado.erro };
      const selos = documento.querySelectorAll('.livetag');
      for (let i = 0; i < selos.length; i++) {
        selos[i].classList.toggle('err', estado.erro);
        const rotulo = selos[i].querySelector('span');
        if (rotulo) {
          rotulo.textContent = estado.texto;
        }
      }
    };

    dados.aoRecusar = texto => {
      if (janela.__avisoPerm) {
        janela.__avisoPerm(texto);
      }
    };

    janela.__sync = { txt: 'Compartilhado · ao vivo', erro: false };

    // E-mails: nos links, o endereço desta página do portal.
    const relatorio =
      new RelatorioImplantacoes(
        dataverseService,
        dados,
        sessao,
        window.location.href.split('#')[0]
      );

    try {
      iniciarPainelLegado(
        janela,
        documento,
        criarPonteApi(janela, dataverseService, dados, sessao, [relatorio.rota])
      );
    } catch (erro) {
      document.removeEventListener('fullscreenchange', atualizarBotaoTela);
      ambiente.desmontar();
      setSituacao('erro');
      setMensagem(`O painel não pôde ser iniciado: ${erro instanceof Error ? erro.message : String(erro)}`);
      return;
    }

    dados.iniciarSincronia();

    // Envios agendados de e-mail: confere ao abrir e a cada 5 minutos.
    const conferir = (): void => {
      relatorio.conferirAgendados().catch(() => undefined);
    };

    const primeiraConferencia = window.setTimeout(conferir, 8000);
    const conferencias = window.setInterval(conferir, 5 * 60 * 1000);

    // Ao voltar para a aba, busca na hora o que os outros mudaram.
    const aoVoltar = (): void => {
      if (!document.hidden) {
        dados.sincronizar().catch(() => undefined);
      }
    };

    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.clearTimeout(primeiraConferencia);
      window.clearInterval(conferencias);
      dados.pararSincronia();
      dados.aoMudarEstado = undefined;
      dados.aoRecusar = undefined;
      document.removeEventListener('fullscreenchange', atualizarBotaoTela);
      ambiente.desmontar();
    };
  }, [situacao, vazia, dataverseService, contexto]);

  // ----------------------------------------------------------
  // Importação da base antiga (dados/*.json)
  // ----------------------------------------------------------

  const importar = async (lista: FileList | null): Promise<void> => { // eslint-disable-line @rushstack/no-new-null

    const dados = base.current;

    if (!dados || !lista || lista.length === 0) {
      return;
    }

    setImportando(true);

    const arquivos: IArquivoImportacao[] = [];
    const ilegiveis: string[] = [];

    for (let i = 0; i < lista.length; i++) {

      const arquivo = lista[i];
      const balde = arquivo.name.replace(/\.json$/i, '');

      // _seq.json é o contador do servidor antigo, não é um projeto.
      if (!/\.json$/i.test(arquivo.name) || balde === '_seq') {
        continue;
      }

      try {
        const conteudo = JSON.parse(await lerArquivo(arquivo)) as Record<string, unknown>;
        arquivos.push({ balde, dados: conteudo });
      } catch {
        ilegiveis.push(arquivo.name);
      }
    }

    try {

      const final = await dados.importar(arquivos, estado => setImportacao(estado));

      final.falhas = ilegiveis.map(nome => `${nome}: arquivo ilegível`).concat(final.falhas);
      setImportacao({ ...final });

      // Recarrega o painel com os dados importados.
      if (final.criados > 0) {
        setVersao(atual => atual + 1);
      }

    } finally {
      setImportando(false);
    }
  };

  // ----------------------------------------------------------
  // Tela
  // ----------------------------------------------------------

  if (situacao === 'semTabela') {
    return (
      <div style={caixa}>
        <strong>O módulo Implantações ainda não foi instalado neste ambiente.</strong>
        <div style={{ marginTop: '6px', color: COR.texto2 }}>
          A tabela <code>dgt_implregistro</code> não existe no Dataverse. Rode
          {' '}<code>scripts/dataverse/criar-tabelas-implantacoes.ps1</code> e libere a tabela
          nos perfis de segurança (docs/implantacoes.md).
        </div>
      </div>
    );
  }

  if (situacao === 'erro') {
    return (
      <div style={{ ...caixa, borderColor: COR.erro }}>
        <strong style={{ color: COR.erro }}>Não foi possível abrir o painel de implantações.</strong>
        <div style={{ marginTop: '6px', color: COR.texto2, wordBreak: 'break-word' }}>{mensagem}</div>
        <div style={{ marginTop: '12px' }}>
          <button type="button" style={botao} onClick={() => setVersao(atual => atual + 1)}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  if (situacao === 'carregando') {
    return (
      <div style={{ ...caixa, color: COR.texto2 }}>Carregando os projetos…</div>
    );
  }

  const mostrarImportacao = administra && (vazia || !!importacao || importando);

  return (
    <div>
      {mostrarImportacao && (
        <div style={{ ...caixa, borderLeft: `4px solid ${COR.ciano}` }}>
          <strong>Importar os dados do painel antigo</strong>
          <div style={{ margin: '6px 0 10px', color: COR.texto2 }}>
            Selecione todos os arquivos <code>.json</code> da pasta <code>dados</code> do painel
            (não inclua a pasta <code>_resgate</code>). A importação só cria o que ainda não
            existe: nada do que já está no portal é sobrescrito.
          </div>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            disabled={importando}
            onChange={evento => {
              const alvo = evento.target;
              importar(alvo.files)
                .catch((erro: unknown) => setMensagem(String(erro)))
                .then(() => { alvo.value = ''; })
                .catch(() => undefined);
            }}
          />
          {importacao && (
            <div style={{ marginTop: '10px' }}>
              {importando ? 'Importando… ' : 'Importação concluída: '}
              {importacao.feitos} de {importacao.total} registros
              {' '}({importacao.criados} criados, {importacao.existentes} já existiam
              {importacao.falhas.length > 0 ? `, ${importacao.falhas.length} com falha` : ''}).
              {importacao.falhas.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: COR.erro, fontSize: '12.5px' }}>
                  {importacao.falhas.slice(0, 8).map((falha, indice) => <li key={indice}>{falha}</li>)}
                </ul>
              )}
              {!importando && (
                <div style={{ marginTop: '8px' }}>
                  <button type="button" style={{ ...botao, background: '#fff', color: COR.azul, border: `1px solid ${COR.borda}` }} onClick={() => setImportacao(undefined)}>Fechar</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!administra && vazia && (
        <div style={{ ...caixa, color: COR.texto2 }}>
          Ainda não há projetos no painel. O administrador do módulo precisa importar os dados.
        </div>
      )}

      {!vazia && <div ref={hospedeiro} key={versao} />}
    </div>
  );
};

export default ImplantacoesPage;
