import * as React from 'react';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IProcessoNegocio,
  ProcessoNegocioService
} from '../../services/processos/ProcessoNegocioService';

import {
  DesenhoProcessoService,
  IDadosDesenho,
  IDesenhoProcesso,
  IDesenhoProcessoCompleto,
  ROTULO_STATUS_DESENHO,
  StatusDesenho
} from '../../services/processos/DesenhoProcessoService';

import {
  criarEditorDesenho,
  IEditorDesenho,
  xmlDesenhoInicial
} from '../../components/desenho/editorDesenho';

import {
  baixarArquivo,
  dataUrlParaBlob,
  FormatoPaginaPdf,
  gerarPdfDesenho,
  nomeArquivoDesenho,
  svgParaPng
} from '../../components/desenho/exportarDesenho';

// ============================================================
// PROCESSOS → DESENHOS
//
// Desenho de fluxogramas de documentação (substitui o Visio):
// desenhar em BPMN, salvar com versões e exportar em PDF.
//
// NÃO tem regras de funcionamento: o desenho não define
// responsáveis, ações nem prazos e nunca é executado pelo motor
// de fluxo (os fluxos executáveis continuam na aba "Fluxos").
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';
const COR_FUNDO = '#F6F7F9';
const COR_ERRO = '#B42318';

export interface IDesenhosProcessoPageProps {
  contexto?: IContextoAcesso;
  dataverseService?: DataverseService;
}

// ------------------------------------------------------------
// Estilos
// ------------------------------------------------------------

const estiloBotao: React.CSSProperties = {
  minHeight: '36px',
  padding: '0 14px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  background: '#FFFFFF',
  color: COR_AZUL,
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer'
};

const estiloBotaoPrincipal: React.CSSProperties = {
  ...estiloBotao,
  background: COR_AZUL,
  borderColor: COR_AZUL,
  color: '#FFFFFF'
};

const estiloCampo: React.CSSProperties = {
  width: '100%',
  minHeight: '36px',
  padding: '6px 10px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  fontSize: '13px',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const estiloRotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: COR_TEXTO_2,
  marginBottom: '4px'
};

const estiloCartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '8px',
  padding: '16px'
};

const coresStatus: Record<StatusDesenho, { fundo: string; texto: string }> = {
  rascunho: { fundo: '#FFF4E5', texto: '#9A5B00' },
  publicado: { fundo: '#E6F8FB', texto: '#046C7A' },
  arquivado: { fundo: '#EEEEEE', texto: '#5E6670' }
};

const SeloStatus: React.FC<{ status: StatusDesenho }> = ({ status }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 700,
      background: coresStatus[status].fundo,
      color: coresStatus[status].texto
    }}
  >
    {ROTULO_STATUS_DESENHO[status]}
  </span>
);

const mensagemErro = (
  erro: unknown
): string =>
  erro instanceof Error ? erro.message : String(erro);

const dataCurta = (
  valor: string
): string => {
  if (!valor) {
    return '';
  }
  const data = new Date(valor);
  return isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
};

const dadosDoDesenho = (
  desenho: IDesenhoProcesso
): IDadosDesenho => ({
  titulo: desenho.titulo,
  codigo: desenho.codigo,
  descricao: desenho.descricao,
  processoId: desenho.processoId,
  elaboradoPor: desenho.elaboradoPor,
  aprovadoPor: desenho.aprovadoPor,
  observacao: desenho.observacao
});

// ============================================================
// ÁREA DO DESENHO (bpmn-js)
//
// Para recarregar outro desenho ou trocar entre edição e leitura,
// troque a "key" do componente.
// ============================================================

interface ICanvasDesenhoProps {
  xml: string;
  somenteLeitura: boolean;

  // Altura da área do desenho (CSS). Muda na tela cheia.
  altura: string;

  // Recebe o editor criado (e volta a undefined ao desmontar).
  editorRef: React.MutableRefObject<IEditorDesenho | undefined>;
  onAlterado: () => void;
  onAvisos: (avisos: string[]) => void;
}

const CanvasDesenho: React.FC<ICanvasDesenhoProps> = props => {

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {

    if (!containerRef.current) {
      return undefined;
    }

    const editor =
      criarEditorDesenho(containerRef.current, props.somenteLeitura);

    props.editorRef.current = editor;

    editor.importar(props.xml)
      .then(avisos => {
        if (avisos.length) {
          props.onAvisos(avisos);
        }
      })
      .catch(erro => props.onAvisos([`Não foi possível abrir o desenho: ${mensagemErro(erro)}`]))
      .then(() => {
        // Sempre registra (mesmo após aviso), e só depois de abrir:
        // a importação não conta como alteração.
        editor.aoAlterar(props.onAlterado);
      })
      .catch(() => undefined);

    return () => {
      editor.destruir();
      if (props.editorRef.current === editor) {
        props.editorRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: props.altura,
        minHeight: '360px',
        border: `1px solid ${COR_BORDA}`,
        borderRadius: '8px',
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
};

// ============================================================
// MODAL: NOVO DESENHO
// ============================================================

interface INovoDesenhoModalProps {
  processos: IProcessoNegocio[];
  codigosEmUso: string[];
  onCancelar: () => void;
  onCriar: (dados: IDadosDesenho) => Promise<void>;
}

const NovoDesenhoModal: React.FC<INovoDesenhoModalProps> = props => {

  const [titulo, setTitulo] = React.useState('');
  const [codigo, setCodigo] = React.useState('');
  const [processoId, setProcessoId] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const codigoRepetido =
    !!codigo.trim() &&
    props.codigosEmUso.indexOf(codigo.trim().toUpperCase()) >= 0;

  const criar = async (): Promise<void> => {
    if (!titulo.trim()) {
      setErro('Informe o título do desenho.');
      return;
    }
    setGravando(true);
    setErro('');
    try {
      await props.onCriar({
        titulo,
        codigo,
        descricao,
        processoId,
        elaboradoPor: '',
        aprovadoPor: '',
        observacao: 'Versão inicial'
      });
    } catch (falha) {
      setErro(mensagemErro(falha));
      setGravando(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(32, 42, 68, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div style={{ ...estiloCartao, width: '520px', maxWidth: '92vw' }}>

        <h3 style={{ margin: '0 0 16px', color: COR_AZUL }}>Novo desenho de processo</h3>

        <div style={{ display: 'grid', gap: '12px' }}>

          <div>
            <label style={estiloRotulo}>Título *</label>
            <input
              style={estiloCampo}
              value={titulo}
              maxLength={200}
              onChange={evento => setTitulo(evento.target.value)}
              placeholder="Ex.: Fluxo de compras de materiais"
            />
          </div>

          <div>
            <label style={estiloRotulo}>Código</label>
            <input
              style={estiloCampo}
              value={codigo}
              maxLength={50}
              onChange={evento => setCodigo(evento.target.value.toUpperCase())}
              placeholder="Ex.: SUP-MAP-001"
            />
            {codigoRepetido && (
              <div style={{ fontSize: '12px', color: '#9A5B00', marginTop: '4px' }}>
                Já existe um desenho com este código.
              </div>
            )}
          </div>

          <div>
            <label style={estiloRotulo}>Processo (opcional)</label>
            <select
              style={estiloCampo}
              value={processoId}
              onChange={evento => setProcessoId(evento.target.value)}
            >
              <option value="">— Desenho avulso, sem processo —</option>
              {props.processos.map(processo => (
                <option key={processo.id} value={processo.id}>
                  {processo.codigo ? `${processo.codigo} · ` : ''}{processo.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={estiloRotulo}>Descrição</label>
            <textarea
              style={{ ...estiloCampo, minHeight: '70px' }}
              value={descricao}
              maxLength={2000}
              onChange={evento => setDescricao(evento.target.value)}
            />
          </div>

          {erro && <div style={{ color: COR_ERRO, fontSize: '13px' }}>{erro}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" style={estiloBotao} onClick={props.onCancelar} disabled={gravando}>
              Cancelar
            </button>
            <button type="button" style={estiloBotaoPrincipal} onClick={() => { criar().catch(() => undefined); }} disabled={gravando}>
              {gravando ? 'Criando…' : 'Criar e desenhar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TELA DO EDITOR
// ============================================================

interface IEditorTelaProps {
  id: string;
  versoes: IDesenhoProcesso[];
  processos: IProcessoNegocio[];
  podeEditar: boolean;
  nomeUsuario: string;
  servico: DesenhoProcessoService;
  onVoltar: () => void;
  onAbrirVersao: (id: string) => void;
  onListaAlterada: () => Promise<void>;
}

const EditorTela: React.FC<IEditorTelaProps> = props => {

  const editorRef = React.useRef<IEditorDesenho | undefined>(undefined);
  const arquivoRef = React.useRef<HTMLInputElement>(null);

  const [desenho, setDesenho] = React.useState<IDesenhoProcessoCompleto | undefined>(undefined);
  const [dados, setDados] = React.useState<IDadosDesenho | undefined>(undefined);
  const [chaveCanvas, setChaveCanvas] = React.useState(0);
  const [alterado, setAlterado] = React.useState(false);
  const [ocupado, setOcupado] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [painelAberto, setPainelAberto] = React.useState(true);
  const [telaCheia, setTelaCheia] = React.useState(false);
  const raizRef = React.useRef<HTMLDivElement>(null);

  // Tela cheia de verdade (API do navegador, esconde também as barras
  // do SharePoint e do navegador). Se o navegador recusar, fica a
  // tela cheia "dentro da página" (estilo fixo abaixo).
  const alternarTelaCheia = (): void => {
    if (!telaCheia) {
      setTelaCheia(true);
      const raiz = raizRef.current;
      if (raiz && raiz.requestFullscreen) {
        raiz.requestFullscreen().catch(() => undefined);
      }
      return;
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => undefined);
    }
    setTelaCheia(false);
  };

  // Saiu pelo Esc/F11 do navegador: acompanha.
  React.useEffect(() => {
    const aoMudar = (): void => {
      if (!document.fullscreenElement) {
        setTelaCheia(false);
      }
    };
    document.addEventListener('fullscreenchange', aoMudar);
    return () => {
      document.removeEventListener('fullscreenchange', aoMudar);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  // Tela cheia: trava a rolagem da página, reenquadra o desenho e
  // sai com Esc (se nenhum menu do editor estiver aberto — nesse
  // caso o Esc só fecha o menu).
  React.useEffect(() => {
    const ajustar = window.setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.ajustarNaTela();
      }
    }, 50);

    if (!telaCheia) {
      return () => window.clearTimeout(ajustar);
    }

    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape' && !document.querySelector('.djs-popup')) {
        setTelaCheia(false);
      }
    };
    window.addEventListener('keydown', aoTeclar);

    return () => {
      window.clearTimeout(ajustar);
      document.body.style.overflow = rolagemAnterior;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [telaCheia]);

  const carregar = React.useCallback(async (): Promise<void> => {
    setErro('');
    const completo = await props.servico.obter(props.id);
    if (!completo) {
      setErro('Desenho não encontrado.');
      return;
    }
    setDesenho(completo);
    setDados(dadosDoDesenho(completo));
    setAlterado(false);
    setChaveCanvas(valor => valor + 1);
  }, [props.id, props.servico]);

  React.useEffect(() => {
    carregar().catch(falha => setErro(mensagemErro(falha)));
  }, [carregar]);

  // Aviso do navegador ao fechar a aba com alterações não salvas.
  React.useEffect(() => {
    if (!alterado) {
      return undefined;
    }
    const aoSair = (evento: BeforeUnloadEvent): void => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [alterado]);

  if (!desenho || !dados) {
    return (
      <div style={estiloCartao}>
        {erro
          ? <div style={{ color: COR_ERRO }}>{erro}</div>
          : 'Carregando desenho…'}
        <div style={{ marginTop: '12px' }}>
          <button type="button" style={estiloBotao} onClick={props.onVoltar}>← Voltar</button>
        </div>
      </div>
    );
  }

  const editavel =
    props.podeEditar && desenho.status === 'rascunho';

  const processoAtual =
    props.processos.find(item => item.id === dados.processoId);

  const temRascunho =
    props.versoes.some(item => item.status === 'rascunho');

  const confirmarSaida = (): boolean =>
    !alterado || window.confirm('Há alterações não salvas. Deseja sair mesmo assim?');

  const alterarDados = (campo: keyof IDadosDesenho, valor: string): void => {
    setDados({ ...dados, [campo]: valor });
    setAlterado(true);
  };

  const executar = async (rotulo: string, acao: () => Promise<void>): Promise<void> => {
    setOcupado(rotulo);
    setErro('');
    setAviso('');
    try {
      await acao();
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setOcupado('');
    }
  };

  const salvar = (): Promise<void> =>
    executar('Salvando…', async () => {
      if (!editorRef.current) {
        return;
      }
      if (!dados.titulo.trim()) {
        throw new Error('Informe o título do desenho.');
      }
      const xml = await editorRef.current.exportarXml();
      const etag = await props.servico.salvarRascunho(desenho, dados, xml);
      setDesenho({
        ...desenho,
        ...dados,
        processoNome: processoAtual ? processoAtual.nome : '',
        xml,
        etag: etag || desenho.etag
      });
      setAlterado(false);
      setAviso('Rascunho salvo.');
      await props.onListaAlterada();
    });

  const publicar = (): Promise<void> =>
    executar('Publicando…', async () => {
      if (alterado) {
        throw new Error('Salve o rascunho antes de publicar.');
      }
      if (!dados.aprovadoPor.trim()) {
        setPainelAberto(true);
        throw new Error('Preencha "Aprovado por" no painel ao lado e salve antes de publicar.');
      }
      if (!window.confirm(
        `Publicar a versão ${desenho.versao}? Depois de publicada ela não pode mais ser alterada; ` +
        'a versão publicada anterior (se houver) fica arquivada.'
      )) {
        return;
      }
      await props.servico.publicar(desenho, dados.aprovadoPor);
      await props.onListaAlterada();
      await carregar();
      setAviso(`Versão ${desenho.versao} publicada.`);
    });

  const novaVersao = (): Promise<void> =>
    executar('Criando nova versão…', async () => {
      const id = await props.servico.novaVersao(desenho, props.nomeUsuario);
      await props.onListaAlterada();
      props.onAbrirVersao(id);
    });

  const cabecalhoPdf = (): Parameters<typeof gerarPdfDesenho>[1] => ({
    titulo: dados.titulo,
    codigo: dados.codigo,
    versao: desenho.versao,
    status: ROTULO_STATUS_DESENHO[desenho.status],
    processo: processoAtual
      ? `${processoAtual.codigo ? `${processoAtual.codigo} · ` : ''}${processoAtual.nome}`
      : desenho.processoNome,
    area: processoAtual ? processoAtual.areaNome : '',
    elaboradoPor: dados.elaboradoPor,
    aprovadoPor: dados.aprovadoPor,
    dataPublicacao: dataCurta(desenho.dataPublicacao)
  });

  const exportar = (tipo: string): Promise<void> =>
    executar('Exportando…', async () => {
      if (!editorRef.current) {
        return;
      }
      const nome = (extensao: string): string =>
        nomeArquivoDesenho(dados.codigo, dados.titulo, desenho.versao, extensao);

      if (tipo === 'pdf-a4' || tipo === 'pdf-a3') {
        const svg = await editorRef.current.exportarSvg();
        const formato: FormatoPaginaPdf = tipo === 'pdf-a3' ? 'a3' : 'a4';
        baixarArquivo(await gerarPdfDesenho(svg, cabecalhoPdf(), formato), nome('pdf'));
      } else if (tipo === 'png') {
        const svg = await editorRef.current.exportarSvg();
        const png = await svgParaPng(svg, 2);
        baixarArquivo(dataUrlParaBlob(png.dataUrl), nome('png'));
      } else if (tipo === 'svg') {
        const svg = await editorRef.current.exportarSvg();
        baixarArquivo(new Blob([svg], { type: 'image/svg+xml' }), nome('svg'));
      } else if (tipo === 'bpmn') {
        const xml = await editorRef.current.exportarXml();
        baixarArquivo(new Blob([xml], { type: 'application/xml' }), nome('bpmn'));
      }
    });

  const importarArquivo = async (arquivo: File): Promise<void> => {
    await executar('Importando…', async () => {
      if (!editorRef.current) {
        return;
      }
      const xml = await arquivo.text();
      if (!/<(bpmn\d*:)?definitions[\s>]/i.test(xml)) {
        throw new Error('O arquivo não é um desenho BPMN (.bpmn).');
      }
      const avisos = await editorRef.current.importar(xml);
      setAlterado(true);
      setAviso(
        avisos.length
          ? `Desenho importado com ${avisos.length} aviso(s). Confira o desenho antes de salvar.`
          : 'Desenho importado. Confira e salve o rascunho.'
      );
    });
  };

  const estiloRaiz: React.CSSProperties = telaCheia
    ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10000,
      background: COR_FUNDO,
      padding: '12px 16px',
      boxSizing: 'border-box',
      overflow: 'auto',
      display: 'grid',
      gap: '8px',
      alignContent: 'start'
    }
    : { display: 'grid', gap: '12px' };

  return (
    <div ref={raizRef} style={estiloRaiz}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={estiloBotao}
          onClick={() => { if (confirmarSaida()) { props.onVoltar(); } }}
        >
          ← Desenhos
        </button>

        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: COR_AZUL }}>
            {dados.codigo ? `${dados.codigo} · ` : ''}{dados.titulo || 'Sem título'}
          </div>
          <div style={{ fontSize: '12px', color: COR_TEXTO_2, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>Versão {desenho.versao}</span>
            <SeloStatus status={desenho.status} />
            {alterado && <span style={{ color: '#9A5B00', fontWeight: 600 }}>• alterações não salvas</span>}
          </div>
        </div>

        <select
          style={{ ...estiloCampo, width: 'auto' }}
          value={desenho.id}
          onChange={evento => {
            if (confirmarSaida()) {
              props.onAbrirVersao(evento.target.value);
            }
          }}
          title="Versões deste desenho"
        >
          {props.versoes.map(versao => (
            <option key={versao.id} value={versao.id}>
              Versão {versao.versao} — {ROTULO_STATUS_DESENHO[versao.status]}
            </option>
          ))}
        </select>
      </div>

      {/* Barra de ferramentas */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

        {editavel && (
          <>
            <button type="button" style={estiloBotaoPrincipal} disabled={!!ocupado} onClick={() => { salvar().catch(() => undefined); }}>
              Salvar rascunho
            </button>
            <button type="button" style={estiloBotao} disabled={!!ocupado} onClick={() => { publicar().catch(() => undefined); }}>
              Publicar versão
            </button>
            <button type="button" style={estiloBotao} disabled={!!ocupado} onClick={() => arquivoRef.current && arquivoRef.current.click()}>
              Importar .bpmn
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept=".bpmn,.xml"
              style={{ display: 'none' }}
              onChange={evento => {
                const arquivo = evento.target.files && evento.target.files[0];
                evento.target.value = '';
                if (arquivo) {
                  importarArquivo(arquivo).catch(() => undefined);
                }
              }}
            />
            <span style={{ width: '1px', height: '24px', background: COR_BORDA }} />
            <button type="button" style={estiloBotao} title="Desfazer" onClick={() => editorRef.current && editorRef.current.desfazer()}>↶</button>
            <button type="button" style={estiloBotao} title="Refazer" onClick={() => editorRef.current && editorRef.current.refazer()}>↷</button>
          </>
        )}

        {props.podeEditar && desenho.status !== 'rascunho' && !temRascunho && (
          <button type="button" style={estiloBotaoPrincipal} disabled={!!ocupado} onClick={() => { novaVersao().catch(() => undefined); }}>
            Criar nova versão para editar
          </button>
        )}

        <button type="button" style={estiloBotao} title="Ajustar na tela" onClick={() => editorRef.current && editorRef.current.ajustarNaTela()}>⤢</button>
        <button type="button" style={estiloBotao} title="Aproximar" onClick={() => editorRef.current && editorRef.current.aproximar(1)}>+</button>
        <button type="button" style={estiloBotao} title="Afastar" onClick={() => editorRef.current && editorRef.current.aproximar(-1)}>−</button>

        <select
          style={{ ...estiloCampo, width: 'auto' }}
          value=""
          disabled={!!ocupado}
          onChange={evento => {
            const tipo = evento.target.value;
            if (tipo) {
              exportar(tipo).catch(() => undefined);
            }
          }}
        >
          <option value="">Exportar…</option>
          <option value="pdf-a4">PDF (A4 paisagem)</option>
          <option value="pdf-a3">PDF (A3 paisagem)</option>
          <option value="png">Imagem PNG</option>
          <option value="svg">Imagem SVG</option>
          <option value="bpmn">Arquivo BPMN (.bpmn)</option>
        </select>

        <div style={{ flex: 1 }} />

        <button type="button" style={estiloBotao} onClick={() => setPainelAberto(!painelAberto)}>
          {painelAberto ? 'Ocultar dados' : 'Mostrar dados'}
        </button>

        <button
          type="button"
          style={telaCheia ? estiloBotaoPrincipal : estiloBotao}
          title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
          onClick={alternarTelaCheia}
        >
          {telaCheia ? '✕ Sair da tela cheia' : '⛶ Tela cheia'}
        </button>

        {ocupado && <span style={{ fontSize: '13px', color: COR_TEXTO_2 }}>{ocupado}</span>}
      </div>

      {editavel && !telaCheia && (
        <div style={{ fontSize: '12px', color: COR_TEXTO_2 }}>
          Atividades ficam azuis e decisões amarelas automaticamente. Para mudar a cor, clique no elemento
          (ou selecione vários) e use a chave de boca 🔧.
        </div>
      )}

      {erro && <div style={{ color: COR_ERRO, fontSize: '13px' }}>{erro}</div>}
      {aviso && <div style={{ color: '#046C7A', fontSize: '13px' }}>{aviso}</div>}

      {!editavel && (
        <div style={{ fontSize: '12px', color: COR_TEXTO_2 }}>
          {props.podeEditar
            ? 'Esta versão está publicada ou arquivada e não pode ser alterada. Para mudar o desenho, crie uma nova versão.'
            : 'Somente leitura.'}
        </div>
      )}

      {/* Desenho + painel de dados */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>

        <div style={{ flex: 1, minWidth: 0 }}>
          <CanvasDesenho
            key={`${desenho.id}-${chaveCanvas}-${editavel ? 'e' : 'l'}`}
            editorRef={editorRef}
            xml={desenho.xml || xmlDesenhoInicial(desenho.titulo)}
            somenteLeitura={!editavel}
            altura={telaCheia ? 'calc(100vh - 150px)' : 'calc(100vh - 300px)'}
            onAlterado={() => setAlterado(true)}
            onAvisos={avisos => setAviso(avisos.join(' '))}
          />
        </div>

        {painelAberto && (
          <div style={{ ...estiloCartao, width: '280px', flexShrink: 0, display: 'grid', gap: '10px', alignContent: 'start', background: COR_FUNDO }}>

            <div>
              <label style={estiloRotulo}>Título *</label>
              <input style={estiloCampo} value={dados.titulo} maxLength={200} disabled={!editavel}
                onChange={evento => alterarDados('titulo', evento.target.value)} />
            </div>

            <div>
              <label style={estiloRotulo}>Código</label>
              <input style={estiloCampo} value={dados.codigo} maxLength={50} disabled={!editavel}
                onChange={evento => alterarDados('codigo', evento.target.value.toUpperCase())} />
            </div>

            <div>
              <label style={estiloRotulo}>Processo</label>
              <select style={estiloCampo} value={dados.processoId} disabled={!editavel}
                onChange={evento => alterarDados('processoId', evento.target.value)}>
                <option value="">— Sem processo —</option>
                {props.processos.map(processo => (
                  <option key={processo.id} value={processo.id}>
                    {processo.codigo ? `${processo.codigo} · ` : ''}{processo.nome}
                  </option>
                ))}
                {dados.processoId && !processoAtual && (
                  <option value={dados.processoId}>{desenho.processoNome || 'Processo inativo'}</option>
                )}
              </select>
            </div>

            <div>
              <label style={estiloRotulo}>Descrição</label>
              <textarea style={{ ...estiloCampo, minHeight: '60px' }} value={dados.descricao} maxLength={2000} disabled={!editavel}
                onChange={evento => alterarDados('descricao', evento.target.value)} />
            </div>

            <div>
              <label style={estiloRotulo}>Elaborado por</label>
              <input style={estiloCampo} value={dados.elaboradoPor} maxLength={200} disabled={!editavel}
                placeholder={props.nomeUsuario}
                onChange={evento => alterarDados('elaboradoPor', evento.target.value)} />
            </div>

            <div>
              <label style={estiloRotulo}>Aprovado por (obrigatório para publicar)</label>
              <input style={estiloCampo} value={dados.aprovadoPor} maxLength={200} disabled={!editavel}
                onChange={evento => alterarDados('aprovadoPor', evento.target.value)} />
            </div>

            <div>
              <label style={estiloRotulo}>O que mudou nesta versão</label>
              <textarea style={{ ...estiloCampo, minHeight: '60px' }} value={dados.observacao} maxLength={2000} disabled={!editavel}
                onChange={evento => alterarDados('observacao', evento.target.value)} />
            </div>

            {desenho.dataPublicacao && (
              <div style={{ fontSize: '12px', color: COR_TEXTO_2 }}>
                Publicado em {dataCurta(desenho.dataPublicacao)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// PÁGINA (lista de desenhos)
// ============================================================

interface IDesenhoAgrupado {
  grupo: string;
  atual: IDesenhoProcesso;
  publicada?: IDesenhoProcesso;
  versoes: IDesenhoProcesso[];
}

const DesenhosProcessoPage: React.FC<IDesenhosProcessoPageProps> = props => {

  const { contexto, dataverseService } = props;

  // Mesma regra da aba Fluxos: Administrador ou Editor com o módulo
  // Processos liberado.
  const podeEditar =
    !!contexto &&
    (
      contexto.perfil === 'Administrador' ||
      (contexto.podeGerenciarProcessos !== undefined
        ? contexto.podeGerenciarProcessos
        : contexto.podeGerenciarDocumentos)
    );

  const servico = React.useMemo(
    () => (dataverseService ? new DesenhoProcessoService(dataverseService) : undefined),
    [dataverseService]
  );

  const [desenhos, setDesenhos] = React.useState<IDesenhoProcesso[]>([]);
  const [processos, setProcessos] = React.useState<IProcessoNegocio[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [abertoId, setAbertoId] = React.useState('');
  const [novoAberto, setNovoAberto] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [filtroProcesso, setFiltroProcesso] = React.useState('');

  const recarregarDesenhos = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      return;
    }
    setDesenhos(await servico.listar());
  }, [servico]);

  React.useEffect(() => {

    if (!servico || !dataverseService) {
      setCarregando(false);
      setErro('Serviço do Dataverse indisponível nesta tela.');
      return;
    }

    setCarregando(true);
    setErro('');

    Promise.all([
      servico.listar(),
      new ProcessoNegocioService(dataverseService).listar().catch(falha => {
        console.error('[Desenhos] processos', falha);
        return [] as IProcessoNegocio[];
      })
    ])
      .then(([lista, listaProcessos]) => {
        setDesenhos(lista);
        setProcessos(listaProcessos.filter(item => item.ativo));
        setCarregando(false);
      })
      .catch(falha => {
        setErro(mensagemErro(falha));
        setCarregando(false);
      });

  }, [servico, dataverseService]);

  // Agrupa as versões de cada desenho. "atual" = maior versão.
  const agrupados = React.useMemo((): IDesenhoAgrupado[] => {
    const mapa: Record<string, IDesenhoProcesso[]> = {};
    desenhos.forEach(item => {
      const chave = item.grupo || item.id;
      (mapa[chave] = mapa[chave] || []).push(item);
    });
    return Object.keys(mapa).map(grupo => {
      const versoes = mapa[grupo].slice().sort((a, b) => b.versao - a.versao);
      return {
        grupo,
        atual: versoes[0],
        publicada: versoes.find(item => item.status === 'publicado'),
        versoes
      };
    }).sort((a, b) =>
      (a.atual.codigo || a.atual.titulo).localeCompare(b.atual.codigo || b.atual.titulo, 'pt-BR')
    );
  }, [desenhos]);

  const filtrados = agrupados.filter(item => {
    const termo = busca.trim().toLowerCase();
    const casaBusca =
      !termo ||
      `${item.atual.codigo} ${item.atual.titulo} ${item.atual.processoNome}`.toLowerCase().indexOf(termo) >= 0;
    const casaProcesso =
      !filtroProcesso ||
      (filtroProcesso === '-' ? !item.atual.processoId : item.atual.processoId === filtroProcesso);
    return casaBusca && casaProcesso;
  });

  const nomeUsuario =
    contexto ? contexto.nome : '';

  const criar = async (dados: IDadosDesenho): Promise<void> => {
    if (!servico) {
      return;
    }
    const id = await servico.criar(
      { ...dados, elaboradoPor: dados.elaboradoPor || nomeUsuario },
      xmlDesenhoInicial(dados.titulo)
    );
    await recarregarDesenhos();
    setNovoAberto(false);
    setAbertoId(id);
  };

  const arquivar = async (item: IDesenhoAgrupado): Promise<void> => {
    if (!servico) {
      return;
    }
    if (!window.confirm(
      `Arquivar o desenho "${item.atual.titulo}"? Ele sai da lista, mas nada é apagado ` +
      '(todas as versões continuam guardadas no Dataverse).'
    )) {
      return;
    }
    try {
      await servico.arquivarDesenho(item.grupo);
      await recarregarDesenhos();
    } catch (falha) {
      setErro(mensagemErro(falha));
    }
  };

  // ---------- Editor ----------

  if (abertoId && servico) {
    const grupo =
      agrupados.find(item => item.versoes.some(versao => versao.id === abertoId));

    return (
      <EditorTela
        key={abertoId}
        id={abertoId}
        versoes={grupo ? grupo.versoes : []}
        processos={processos}
        podeEditar={podeEditar}
        nomeUsuario={nomeUsuario}
        servico={servico}
        onVoltar={() => setAbertoId('')}
        onAbrirVersao={id => setAbertoId(id)}
        onListaAlterada={recarregarDesenhos}
      />
    );
  }

  // ---------- Lista ----------

  return (
    <div style={{ display: 'grid', gap: '16px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h2 style={{ margin: 0, color: COR_AZUL }}>Desenhos de processo</h2>
          <div style={{ fontSize: '13px', color: COR_TEXTO_2, marginTop: '4px' }}>
            Fluxogramas para documentar processos (no lugar do Visio). Desenhe, publique versões e exporte em PDF.
            Estes desenhos não executam nada: os fluxos de aprovação continuam na aba Fluxos.
          </div>
        </div>

        {podeEditar && servico && (
          <button type="button" style={estiloBotaoPrincipal} onClick={() => setNovoAberto(true)}>
            + Novo desenho
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          style={{ ...estiloCampo, maxWidth: '320px' }}
          placeholder="Procurar por código, título ou processo"
          value={busca}
          onChange={evento => setBusca(evento.target.value)}
        />
        <select
          style={{ ...estiloCampo, maxWidth: '320px' }}
          value={filtroProcesso}
          onChange={evento => setFiltroProcesso(evento.target.value)}
        >
          <option value="">Todos os processos</option>
          <option value="-">Desenhos avulsos (sem processo)</option>
          {processos.map(processo => (
            <option key={processo.id} value={processo.id}>
              {processo.codigo ? `${processo.codigo} · ` : ''}{processo.nome}
            </option>
          ))}
        </select>
      </div>

      {erro && <div style={{ color: COR_ERRO, fontSize: '13px' }}>{erro}</div>}

      {carregando && <div style={{ color: COR_TEXTO_2 }}>Carregando desenhos…</div>}

      {!carregando && !erro && filtrados.length === 0 && (
        <div style={{ ...estiloCartao, color: COR_TEXTO_2, textAlign: 'center' }}>
          {agrupados.length === 0
            ? 'Nenhum desenho cadastrado ainda.'
            : 'Nenhum desenho encontrado com esses filtros.'}
        </div>
      )}

      {filtrados.length > 0 && (
        <div style={{ ...estiloCartao, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: COR_FUNDO, color: COR_TEXTO_2, textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Código</th>
                <th style={{ padding: '10px 12px' }}>Título</th>
                <th style={{ padding: '10px 12px' }}>Processo</th>
                <th style={{ padding: '10px 12px' }}>Versão</th>
                <th style={{ padding: '10px 12px' }}>Situação</th>
                <th style={{ padding: '10px 12px' }}>Atualizado em</th>
                <th style={{ padding: '10px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {filtrados.map(item => (
                <tr key={item.grupo} style={{ borderTop: `1px solid ${COR_BORDA}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: COR_AZUL, whiteSpace: 'nowrap' }}>
                    {item.atual.codigo || '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{item.atual.titulo}</td>
                  <td style={{ padding: '10px 12px', color: COR_TEXTO_2 }}>{item.atual.processoNome || 'Avulso'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {item.atual.versao}
                    {item.publicada && item.publicada.id !== item.atual.id && (
                      <span style={{ color: COR_TEXTO_2 }}> (publicada: {item.publicada.versao})</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}><SeloStatus status={item.atual.status} /></td>
                  <td style={{ padding: '10px 12px', color: COR_TEXTO_2 }}>{dataCurta(item.atual.modificadoEm)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" style={{ ...estiloBotao, borderColor: COR_CIANO }} onClick={() => setAbertoId(item.atual.id)}>
                      Abrir
                    </button>
                    {podeEditar && (
                      <button
                        type="button"
                        style={{ ...estiloBotao, marginLeft: '6px' }}
                        title="Tirar da lista (nada é apagado)"
                        onClick={() => { arquivar(item).catch(() => undefined); }}
                      >
                        Arquivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novoAberto && (
        <NovoDesenhoModal
          processos={processos}
          codigosEmUso={agrupados.map(item => (item.atual.codigo || '').toUpperCase()).filter(Boolean)}
          onCancelar={() => setNovoAberto(false)}
          onCriar={criar}
        />
      )}
    </div>
  );
};

export default DesenhosProcessoPage;
