import * as React from 'react';

import logoDgt from '../../assets/logo-dgt.png';

import {
  DecisaoParecer,
  FiltroParecer,
  IFiltrosLicitacao,
  ILicitacaoResultado,
  ISituacaoParecer,
  MODALIDADES_PNCP,
  ModoBuscaAssunto,
  PRESETS_MODALIDADES,
  UFS_BRASIL
} from '../../models/Licitacao';

import {
  useBuscaLicitacoes
} from '../../hooks/useBuscaLicitacoes';

import {
  SituacaoPareceres,
  useParecerLicitacoes
} from '../../hooks/useParecerLicitacoes';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  ParecerCartao,
  RegistrarParecerDialog
} from './ParecerLicitacao';

import {
  AnaliseIaBloco
} from './AnaliseIaLicitacao';

import SugestoesTermos, {
  SUGESTOES_ASSUNTO,
  SUGESTOES_EXCLUIR,
  SUGESTOES_RELACIONADAS,
  listaDoTexto
} from './SugestoesTermos';

import ConfigurarIaModal from
  './ConfigurarIaModal';

import {
  useAnaliseIaLicitacoes
} from '../../hooks/useAnaliseIaLicitacoes';

import {
  IEstadoAnaliseIa
} from '../../models/LicitacaoIa';

import {
  EnviarParaIa
} from '../../services/ia/provedoresIa';

import {
  useAcompanhamentoLicitacoes
} from '../../hooks/useAcompanhamentoLicitacoes';

import {
  IAcompanhamento
} from '../../services/licitacoes/AcompanhamentoLicitacaoService';

import AcompanhamentoPainel from
  './AcompanhamentoPainel';

import NaoParticiparPainel from
  './NaoParticiparPainel';

import {
  IParecerLicitacao
} from '../../models/Licitacao';

import {
  converterValor,
  formatarDataPncp,
  formatarMoeda,
  limparListaPalavras
} from '../../utils/licitacoesFiltro';

import {
  abrirRelatorioImpressao
} from '../../utils/relatorioLicitacoes';

import {
  CONFIG_PNCP
} from '../../services/PncpService';

import EditalPreviaModal from './EditalPreviaModal';

import {
  COR,
  FONTE,
  botaoSecundario,
  campo,
  cartao,
  chip,
  dica,
  etiqueta,
  grade,
  linhaAcoes,
  rotulo,
  textoApoio,
  tituloSecao
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — BUSCA
//
// Os cartões usam <div> (e não <article>) porque a regra global
// '.content article' do portal força borda com !important e
// apagaria o destaque lateral de aderência.
//
// Equivalente às telas do terminal do Agente V6:
//   solicitar_filtros          → formulário
//   mostrar_resumo_filtros     → cartão de progresso / resumo
//   mostrar_resultados_terminal→ lista de oportunidades
//   gerar_pdf                  → "Imprimir / salvar PDF"
//
// Parecer da DGT: em cada cartão e no painel do edital é possível
// registrar "Participar" ou "Não participar" com justificativa.
// O parecer fica no Dataverse (dgt_licitacaoparecer) e reaparece
// automaticamente em qualquer nova busca que traga o mesmo edital.
// ============================================================

export interface ILicitacoesBuscaPageProps {
  onIrParaTeste: () => void;
  // Opcionais: sem eles a busca funciona, só sem pareceres.
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
  // Chamada à API de IA (ver services/ia/provedoresIa.ts). Sem ela,
  // a análise roda no modo simulado (histórico de pareceres).
  enviarParaIa?: EnviarParaIa;
}

interface IDialogoParecer {
  item: ILicitacaoResultado;
  decisao?: DecisaoParecer;
  // Texto sugerido pela IA ("Usar sugestão").
  justificativa?: string;
}

const FILTROS_PARECER: Array<{ id: FiltroParecer; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'semParecer', rotulo: 'Sem parecer' },
  { id: 'Participar', rotulo: '✓ Participar' },
  { id: 'NaoParticipar', rotulo: '✕ Não participar' }
];

interface IFormulario {
  assunto: string;
  uf: string;
  diasBusca: string;
  modalidades: number[];
  modoBusca: ModoBuscaAssunto;
  obrigatorias: string;
  relacionadas: string;
  negativas: string;
  valorMinimo: string;
  valorMaximo: string;
  scoreMinimo: string;
}

const FORMULARIO_INICIAL: IFormulario = {
  assunto: '',
  uf: '',
  diasBusca: '30',
  modalidades: [6, 4, 8, 9],
  modoBusca: '3',
  obrigatorias: '',
  relacionadas: '',
  negativas: '',
  valorMinimo: '',
  valorMaximo: '',
  scoreMinimo: '10'
};

const CODIGOS_MODALIDADES: number[] =
  Object.keys(MODALIDADES_PNCP).map(chave => Number(chave));

const mesmoConjunto = (
  a: number[],
  b: number[]
): boolean =>
  a.length === b.length &&
  a.every(item => b.indexOf(item) >= 0);

const urlAbsoluta = (
  caminho: string
): string => {
  try {
    return new URL(caminho, window.location.href).href;
  } catch {
    return caminho;
  }
};

// ------------------------------------------------------------
// Barra de score
// ------------------------------------------------------------

const BarraScore: React.FC<{ score: number }> = ({ score }) => (
  <div style={{ minWidth: 120 }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        color: COR.azul,
        marginBottom: 4
      }}
    >
      <span>Aderência</span>
      <strong>{score}%</strong>
    </div>
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: COR.neutro,
        overflow: 'hidden'
      }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={`Aderência de ${score}%`}
    >
      <div
        style={{
          width: `${score}%`,
          height: '100%',
          background: score >= 50 ? COR.ciano : COR.indigo
        }}
      />
    </div>
  </div>
);

// ------------------------------------------------------------
// Cartão de resultado
// ------------------------------------------------------------

const Dado: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div>
    <span style={{ display: 'block', fontSize: 10, color: COR.textoSecundario }}>
      {titulo}
    </span>
    <strong style={{ display: 'block', fontSize: 12, color: COR.azul, fontWeight: 600 }}>
      {valor}
    </strong>
  </div>
);

const CartaoLicitacao: React.FC<{
  item: ILicitacaoResultado;
  onPrevisualizar: (item: ILicitacaoResultado) => void;
  parecer?: ISituacaoParecer;
  situacaoPareceres: SituacaoPareceres;
  onRegistrarParecer: (item: ILicitacaoResultado, decisao?: DecisaoParecer, justificativa?: string) => void;
  estadoIa: IEstadoAnaliseIa;
  onAnalisarIa: (item: ILicitacaoResultado) => void;
  acompanhamento?: IAcompanhamento;
  novidades: number;
  acompanhamentoDisponivel: boolean;
  processandoAcompanhamento: boolean;
  onAcompanhar: (item: ILicitacaoResultado) => void;
  onVerAcompanhamento: () => void;
}> = ({
  item, onPrevisualizar, parecer, situacaoPareceres, onRegistrarParecer, estadoIa, onAnalisarIa,
  acompanhamento, novidades, acompanhamentoDisponivel, processandoAcompanhamento, onAcompanhar, onVerAcompanhamento
}) => (
  <div
    style={{
      ...cartao,
      borderLeft: `4px solid ${parecer && parecer.atual.decisao === 'NaoParticipar' ? '#C0392B' : item.score >= 50 ? COR.ciano : COR.indigo}`,
      marginBottom: 12,
      // Edital já descartado: fica visível, mas em segundo plano.
      opacity: parecer && parecer.atual.decisao === 'NaoParticipar' ? 0.72 : 1
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'flex-start'
      }}
    >
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        <span style={{ fontSize: 11, color: COR.textoSecundario }}>
          {item.modalidade} · {item.local}
        </span>
        <h3 style={{ margin: '2px 0 0', fontSize: 14, color: COR.azul, fontWeight: 600 }}>
          {item.orgao}
        </h3>
      </div>

      <BarraScore score={item.score} />
    </div>

    <p
      style={{
        margin: '12px 0',
        fontSize: 13,
        lineHeight: 1.55,
        color: COR.azul,
        maxWidth: 900
      }}
    >
      {item.objeto}
    </p>

    <div style={{ ...grade(140), marginBottom: 12 }}>
      <Dado titulo="Valor estimado" valor={formatarMoeda(item.valor)} />
      <Dado titulo="Número" valor={item.numero} />
      <Dado titulo="Publicação" valor={formatarDataPncp(item.publicacao)} />
      <Dado titulo="Abertura das propostas" valor={formatarDataPncp(item.abertura)} />
      <Dado titulo="Encerramento das propostas" valor={formatarDataPncp(item.encerramento)} />
    </div>

    {/* Sem parecer: a IA sugere. Com parecer: vale a decisão da DGT. */}
    {!parecer && (
      <AnaliseIaBloco
        estado={estadoIa}
        onAnalisar={() => onAnalisarIa(item)}
        onUsarSugestao={(decisao, justificativa) => onRegistrarParecer(item, decisao, justificativa)}
      />
    )}

    <ParecerCartao
      parecer={parecer}
      situacao={situacaoPareceres}
      onRegistrar={decisao => onRegistrarParecer(item, decisao)}
    />

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ flex: '1 1 300px' }}>
        {item.motivos.map(motivo => (
          <span key={motivo} style={etiqueta}>{motivo}</span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {acompanhamentoDisponivel && (
          acompanhamento
            ? (
              <button
                type="button"
                onClick={onVerAcompanhamento}
                title="Ver a linha do tempo das alterações deste edital"
                style={{ ...botaoSecundario, padding: '5px 10px', fontSize: 12, borderColor: '#B45309', color: '#B45309' }}
              >
                ★ Acompanhando{novidades > 0 ? ` · ${novidades} nova(s)` : ''}
              </button>
            )
            : (
              <button
                type="button"
                disabled={processandoAcompanhamento}
                onClick={() => onAcompanhar(item)}
                title="Acompanhar as alterações deste edital (situação, datas, documentos, itens)"
                style={{ ...botaoSecundario, padding: '5px 10px', fontSize: 12, opacity: processandoAcompanhamento ? 0.5 : 1 }}
              >
                {processandoAcompanhamento ? 'Acompanhando…' : '☆ Acompanhar'}
              </button>
            )
        )}

        {acompanhamento && acompanhamento.pastaUrl && (
          <a
            href={acompanhamento.pastaUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Pasta do edital no SharePoint"
            style={{ fontSize: 12, fontWeight: 700, color: '#0F6CBD', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            📁 Pasta ↗
          </a>
        )}

        {acompanhamento && acompanhamento.clickupUrl && (
          <a
            href={acompanhamento.clickupUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Tarefa de acompanhamento no ClickUp"
            style={{ fontSize: 12, fontWeight: 700, color: '#7B68EE', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            ClickUp ↗
          </a>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COR.indigo,
            textDecoration: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          Abrir no PNCP ↗
        </a>

        <button
          type="button"
          onClick={() => onPrevisualizar(item)}
        >
          Pré-visualizar edital
        </button>
      </div>
    </div>
  </div>
);

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const LicitacoesBuscaPage: React.FC<ILicitacoesBuscaPageProps> = ({
  onIrParaTeste,
  dataverseService,
  contexto,
  enviarParaIa
}) => {

  const busca = useBuscaLicitacoes();

  const pareceres = useParecerLicitacoes(
    dataverseService,
    contexto ? contexto.nome : undefined
  );

  const [filtroParecer, setFiltroParecer] = React.useState<FiltroParecer>('todos');
  const [dialogo, setDialogo] = React.useState<IDialogoParecer | undefined>(undefined);
  const [avisoParecer, setAvisoParecer] = React.useState<string>('');

  const abrirDialogoParecer = React.useCallback(
    (item: ILicitacaoResultado, decisao?: DecisaoParecer, justificativa?: string): void => {
      setDialogo({ item, decisao, justificativa });
    },
    []
  );

  // Análise por IA (só para editais sem parecer).
  const ia = useAnaliseIaLicitacoes(
    dataverseService,
    busca.resultados,
    pareceres.obter,
    pareceres.atuais,
    pareceres.situacao !== 'carregando',
    enviarParaIa
  );

  const [configIaAberta, setConfigIaAberta] = React.useState<boolean>(false);

  // Acompanhamento das alterações dos editais (aba "Acompanhamento").
  const acompanhamento = useAcompanhamentoLicitacoes(
    dataverseService,
    busca.resultados,
    contexto ? contexto.nome : ''
  );

  const [aba, setAba] = React.useState<'busca' | 'acompanhamento' | 'naoParticipar'>('busca');

  const naoParticipar = pareceres.atuais.filter(p => p.decisao === 'NaoParticipar');

  // Administrador global ou administrador do módulo Licitações.
  const ehAdministrador = !!contexto && (contexto.perfil === 'Administrador' || (contexto.modulosAdministrados || []).indexOf('licitacoes') >= 0);

  const fecharDialogoParecer = React.useCallback(
    (): void => setDialogo(undefined),
    []
  );

  const salvarParecer = async (
    decisao: DecisaoParecer,
    justificativa: string
  ): Promise<void> => {
    if (!dialogo) {
      return;
    }
    await pareceres.registrar(dialogo.item, decisao, justificativa);
    // "Participar": acompanha o edital e cria a tarefa no ClickUp.
    if (decisao === 'Participar' && acompanhamento.situacao === 'ok') {
      const estadoIa = ia.estadoDe(dialogo.item);
      acompanhamento.participar(dialogo.item, {
        justificativa,
        responsavel: contexto ? contexto.nome : '',
        analiseIa: estadoIa.analise
          ? {
            recomendacao: estadoIa.analise.recomendacao === 'Participar'
              ? 'Participar'
              : estadoIa.analise.recomendacao === 'NaoParticipar' ? 'Não participar' : 'Avaliar com cuidado',
            compatibilidade: estadoIa.analise.compatibilidade,
            resumo: estadoIa.analise.resumo
          }
          : undefined
      }).catch(() => undefined);
    }
    setDialogo(undefined);
    setAvisoParecer(`Parecer registrado: ${dialogo.item.orgao}.`);
    window.setTimeout(() => setAvisoParecer(''), 5000);
  };

  const [form, setForm] = React.useState<IFormulario>(FORMULARIO_INICIAL);
  const [erroForm, setErroForm] = React.useState<string>('');
  const [mostrarRefinar, setMostrarRefinar] = React.useState<boolean>(false);
  const [filtroLista, setFiltroLista] = React.useState<string>('');
  const [avisoPopup, setAvisoPopup] = React.useState<boolean>(false);
  const [previa, setPrevia] = React.useState<ILicitacaoResultado | undefined>(undefined);

  const fecharPrevia = React.useCallback((): void => setPrevia(undefined), []);

  const alterar = <K extends keyof IFormulario>(
    chave: K,
    valor: IFormulario[K]
  ): void => {
    setForm(atual => ({ ...atual, [chave]: valor }));
  };

  // "Buscar este edital" (aba Não participar): busca pelo número.
  const buscarEditalDoParecer = (parecer: IParecerLicitacao): void => {
    const uf = (parecer.local || '').split('/')[1];
    setForm(atual => ({
      ...atual,
      assunto: parecer.numero && parecer.numero !== '-' ? parecer.numero : parecer.orgao,
      modoBusca: '4',
      uf: uf ? uf.trim() : atual.uf
    }));
    setAba('busca');
    window.scrollTo(0, 0);
  };

  const alternarModalidade = (codigo: number): void => {
    setForm(atual => {
      const existe = atual.modalidades.indexOf(codigo) >= 0;
      return {
        ...atual,
        modalidades: existe
          ? atual.modalidades.filter(item => item !== codigo)
          : atual.modalidades.concat([codigo]).sort((a, b) => a - b)
      };
    });
  };

  const montarFiltros = (): IFiltrosLicitacao | undefined => {

    const assunto = form.assunto.trim();

    if (!assunto) {
      setErroForm('Informe o assunto principal da busca.');
      return undefined;
    }

    if (form.modalidades.length === 0) {
      setErroForm('Selecione ao menos uma modalidade.');
      return undefined;
    }

    const dias = parseInt(form.diasBusca, 10);

    if (isNaN(dias) || dias < 1 || dias > 365) {
      setErroForm('O período deve ficar entre 1 e 365 dias.');
      return undefined;
    }

    const score = parseInt(form.scoreMinimo, 10);

    if (isNaN(score) || score < 0 || score > 100) {
      setErroForm('O score mínimo deve ficar entre 0 e 100.');
      return undefined;
    }

    const valorMinimo = converterValor(form.valorMinimo);
    const valorMaximo = converterValor(form.valorMaximo);

    if (
      valorMinimo !== undefined &&
      valorMaximo !== undefined &&
      valorMinimo > valorMaximo
    ) {
      setErroForm('O valor mínimo não pode ser maior que o valor máximo.');
      return undefined;
    }

    setErroForm('');

    return {
      assunto,
      uf: form.uf || undefined,
      diasBusca: dias,
      modalidades: form.modalidades.slice(),
      modoBusca: form.modoBusca,
      palavrasObrigatorias: limparListaPalavras(form.obrigatorias),
      palavrasRelacionadas: limparListaPalavras(form.relacionadas),
      palavrasNegativas: limparListaPalavras(form.negativas),
      valorMinimo,
      valorMaximo,
      scoreMinimo: score
    };
  };

  const iniciarBusca = (): void => {
    const filtros = montarFiltros();
    if (filtros) {
      setFiltroLista('');
      busca.iniciar(filtros);
    }
  };

  // ---------------- Baixar documentos sem buscar antes ----------------
  // O download precisa do identificador do PNCP, que só existe no
  // resultado de uma busca. Se o edital acompanhado não está na busca
  // atual, o portal busca ESTE edital (modo Edital específico) e, ao
  // encontrá-lo, baixa os documentos sozinho.
  const [downloadPendente, setDownloadPendente] =
    React.useState<{ chave: string; pastaUrl: string } | undefined>(undefined);
  const [avisoDownload, setAvisoDownload] = React.useState<string>('');

  const baixarDocumentosDoAcompanhamento = (acomp: IAcompanhamento): void => {

    if (!acomp.pastaUrl) {
      return;
    }

    const item = busca.resultados.find(r => {
      const a = acompanhamento.obter(r);
      return !!a && a.chaveEdital === acomp.chaveEdital && !!r.idPncp;
    });

    if (item) {
      setAvisoDownload('');
      acompanhamento.baixarDocumentos(item, acomp.pastaUrl).catch(() => undefined);
      return;
    }

    const uf = (acomp.local || '').split('/')[1];
    const codigoModalidade = Object.keys(MODALIDADES_PNCP)
      .map(Number)
      .find(codigo => MODALIDADES_PNCP[codigo] === acomp.modalidade);

    const filtros: IFiltrosLicitacao = {
      assunto: acomp.numero && acomp.numero !== '-' ? acomp.numero : acomp.orgao,
      uf: uf ? uf.trim() : undefined,
      diasBusca: 180,
      modalidades: codigoModalidade ? [codigoModalidade] : Object.keys(MODALIDADES_PNCP).map(Number),
      modoBusca: '4',
      palavrasObrigatorias: [],
      palavrasRelacionadas: [],
      palavrasNegativas: [],
      scoreMinimo: 0
    };

    setForm(atual => ({ ...atual, assunto: filtros.assunto, modoBusca: '4', uf: filtros.uf || atual.uf }));
    setDownloadPendente({ chave: acomp.chaveEdital, pastaUrl: acomp.pastaUrl });
    setAvisoDownload(`Procurando o edital ${acomp.numero || ''} no PNCP para baixar os documentos…`);
    setFiltroLista('');
    busca.iniciar(filtros);
  };

  React.useEffect(() => {
    if (!downloadPendente) {
      return;
    }
    const item = busca.resultados.find(r => {
      const a = acompanhamento.obter(r);
      return !!a && a.chaveEdital === downloadPendente.chave && !!r.idPncp;
    });
    if (item) {
      const pasta = downloadPendente.pastaUrl;
      setDownloadPendente(undefined);
      setAvisoDownload('');
      busca.cancelar();
      acompanhamento.baixarDocumentos(item, pasta).catch(() => undefined);
      return;
    }
    if (!busca.buscando && busca.resumo) {
      setDownloadPendente(undefined);
      setAvisoDownload('O edital não foi encontrado na busca automática (últimos 180 dias). Busque-o manualmente e clique de novo em "Baixar documentos".');
    }
  }, [busca.resultados, busca.buscando, busca.resumo, downloadPendente]);

  const aoTeclar = (evento: React.KeyboardEvent<HTMLInputElement>): void => {
    if (evento.key === 'Enter' && !busca.buscando) {
      iniciarBusca();
    }
  };

  const imprimir = (): void => {
    if (!busca.filtrosUsados) {
      return;
    }
    const abriu = abrirRelatorioImpressao(
      busca.filtrosUsados,
      busca.resultados,
      busca.resumo,
      urlAbsoluta(logoDgt)
    );
    setAvisoPopup(!abriu);
  };

  const obterParecer = pareceres.obter;

  const decisaoDe = React.useCallback(
    (item: ILicitacaoResultado): FiltroParecer => {
      const situacao = obterParecer(item);
      return situacao ? situacao.atual.decisao : 'semParecer';
    },
    [obterParecer]
  );

  const contagemParecer = React.useMemo(() => {
    const contagem: { [filtro: string]: number } = {
      todos: busca.resultados.length,
      semParecer: 0,
      Participar: 0,
      NaoParticipar: 0
    };
    busca.resultados.forEach(item => {
      contagem[decisaoDe(item)]++;
    });
    return contagem;
  }, [busca.resultados, decisaoDe]);

  const resultadosVisiveis = React.useMemo(() => {
    const termo = filtroLista.trim().toLowerCase();
    return busca.resultados.filter(item => {
      if (filtroParecer !== 'todos' && decisaoDe(item) !== filtroParecer) {
        return false;
      }
      if (!termo) {
        return true;
      }
      return (item.objeto + ' ' + item.orgao + ' ' + item.local)
        .toLowerCase()
        .indexOf(termo) >= 0;
    });
  }, [busca.resultados, filtroLista, filtroParecer, decisaoDe]);

  const presetAtivo = PRESETS_MODALIDADES.find(preset =>
    mesmoConjunto(preset.codigos, form.modalidades)
  );

  const progresso = busca.progresso;
  const resumo = busca.resumo;
  const temBusca = busca.buscando || !!resumo;

  const percentualModalidades = progresso && progresso.totalModalidades > 0
    ? Math.round(((progresso.indiceModalidade - 1) / progresso.totalModalidades) * 100 +
      (progresso.totalPaginasModalidade
        ? (progresso.pagina / progresso.totalPaginasModalidade) * (100 / progresso.totalModalidades)
        : 0))
    : 0;

  return (
    <section style={{ fontFamily: FONTE }}>

      {/* ======================================================
          ABAS: busca × acompanhamento
          ====================================================== */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${COR.cinzaClaro}`, marginBottom: 14 }}>
        {([
          ['busca', 'Buscar editais'],
          ['acompanhamento', `Acompanhamento${acompanhamento.acompanhamentos.length ? ` (${acompanhamento.acompanhamentos.length})` : ''}`],
          ['naoParticipar', `Não participar${naoParticipar.length ? ` (${naoParticipar.length})` : ''}`]
        ] as Array<['busca' | 'acompanhamento' | 'naoParticipar', string]>).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            style={{
              padding: '9px 14px',
              border: 0,
              borderBottom: `3px solid ${aba === id ? COR.ciano : 'transparent'}`,
              background: 'transparent',
              color: aba === id ? COR.azul : COR.textoSecundario,
              fontWeight: 700,
              fontSize: 13.5,
              fontFamily: FONTE,
              cursor: 'pointer',
              marginBottom: -1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {rotulo}
            {id === 'acompanhamento' && acompanhamento.totalNaoLidas > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff', background: '#C0392B', borderRadius: 999, padding: '1px 7px' }}>
                {acompanhamento.totalNaoLidas}
              </span>
            )}
          </button>
        ))}
      </div>

      {avisoDownload && (
        <div role="status" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#FFF4E5', color: COR.azul, fontSize: 13 }}>
          {downloadPendente ? '⏳ ' : ''}{avisoDownload}
        </div>
      )}

      {aba === 'acompanhamento' && (
        <AcompanhamentoPainel
          acompanhamento={acompanhamento}
          ehAdministrador={ehAdministrador}
          podeBaixarDocumentos={() => !busca.buscando}
          onBaixarDocumentos={baixarDocumentosDoAcompanhamento}
          onCriarTarefaClickUp={(acomp, atualizar) => {
            const parecer = pareceres.atuais.find(p => p.chaveEdital === acomp.chaveEdital);
            const item = busca.resultados.find(r => acompanhamento.obter(r) === acomp);
            const estadoIa = item ? ia.estadoDe(item) : undefined;
            acompanhamento.criarTarefaClickUp(acomp, item, {
              justificativa: parecer ? parecer.justificativa : '',
              responsavel: parecer ? parecer.responsavel : (contexto ? contexto.nome : ''),
              analiseIa: estadoIa && estadoIa.analise
                ? {
                  recomendacao: estadoIa.analise.recomendacao === 'Participar'
                    ? 'Participar'
                    : estadoIa.analise.recomendacao === 'NaoParticipar' ? 'Não participar' : 'Avaliar com cuidado',
                  compatibilidade: estadoIa.analise.compatibilidade,
                  resumo: estadoIa.analise.resumo
                }
                : undefined
            }, !!atualizar).catch(() => undefined);
          }}
        />
      )}

      {aba === 'naoParticipar' && (
        <NaoParticiparPainel
          pareceres={naoParticipar}
          carregando={pareceres.situacao === 'carregando'}
          historicoDe={pareceres.historicoDe}
          onBuscarEdital={buscarEditalDoParecer}
        />
      )}

      {/* A busca continua montada (escondida) para não perder os resultados. */}
      <div style={{ display: aba === 'busca' ? 'block' : 'none' }}>

      {/* Andamento do "Participar" (pasta, documentos, ClickUp) também na busca. */}
      {acompanhamento.mensagem && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: /não foi possível|não baixados|sem permissão|sem acesso/i.test(acompanhamento.mensagem) ? '#FDECEA' : COR.cianoClaro,
            color: COR.azul,
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          {acompanhamento.processandoChave ? '⏳ ' : ''}{acompanhamento.mensagem}
        </div>
      )}

      {/* ======================================================
          FORMULÁRIO
          ====================================================== */}
      <div style={cartao}>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 16
          }}
        >
          <div>
            <h2 style={tituloSecao}>Buscar licitações no PNCP</h2>
            <p style={textoApoio}>
              Consulta pública ao Portal Nacional de Contratações Públicas. A busca não é gravada;
              só os pareceres (Participar / Não participar) ficam registrados, com histórico.
            </p>
            {pareceres.situacao === 'tabelaInexistente' && (
              <p style={{ ...dica, color: COR.indigo }}>
                ! Pareceres desativados: crie a tabela dgt_licitacaoparecer no Dataverse
                (scripts/dataverse/criar-tabela-pareceres-licitacao.ps1).
              </p>
            )}
            {pareceres.situacao === 'erro' && (
              <p style={{ ...dica, color: COR.indigo }}>
                ! Não foi possível carregar os pareceres. {pareceres.erro}
                {' '}
                <button
                  type="button"
                  style={{ ...botaoSecundario, padding: '2px 8px', fontSize: 11 }}
                  onClick={pareceres.recarregar}
                >
                  Tentar novamente
                </button>
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ehAdministrador && (
              <button
                type="button"
                style={botaoSecundario}
                onClick={() => setConfigIaAberta(true)}
                title="Prompt, provedor e parâmetros da análise por IA"
              >
                🤖 Configurar IA
              </button>
            )}
            <button
              type="button"
              style={botaoSecundario}
              onClick={onIrParaTeste}
            >
              Testar conexão
            </button>
          </div>
        </div>

        {/* O que procurar */}
        <div style={grade(260)}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={rotulo} htmlFor="lic-assunto">Assunto principal</label>
            <input
              id="lic-assunto"
              style={{ ...campo, fontSize: 15, padding: '11px 13px' }}
              value={form.assunto}
              onChange={evento => alterar('assunto', evento.target.value)}
              onKeyDown={aoTeclar}
              placeholder="Ex.: gestão de documentos, automação de processos, software de workflow"
              disabled={busca.buscando}
            />
            <SugestoesTermos
              grupos={SUGESTOES_ASSUNTO}
              valor={form.assunto}
              disabled={busca.buscando}
              onChange={novo => {
                alterar('assunto', novo);
                // Mais de um assunto: compara por termo (o "exato"
                // procuraria a frase inteira, com a vírgula).
                if (listaDoTexto(novo).length > 1 && form.modoBusca === '1') {
                  alterar('modoBusca', '3' as ModoBuscaAssunto);
                }
              }}
            />
          </div>

          <div>
            <label style={rotulo} htmlFor="lic-modo">Como comparar o assunto</label>
            <select
              id="lic-modo"
              style={campo}
              value={form.modoBusca}
              onChange={evento => alterar('modoBusca', evento.target.value as ModoBuscaAssunto)}
              disabled={busca.buscando}
            >
              <option value="1">Assunto exato</option>
              <option value="2">Qualquer palavra do assunto</option>
              <option value="3">Assunto + palavras relacionadas</option>
              <option value="4">Edital específico (número ou nome)</option>
            </select>
            {form.modoBusca === '4' && (
              <span style={dica}>
                Digite o número (ex.: 016/2026) ou o nome do edital no Assunto principal.
                Exclusões e score mínimo não se aplicam. Escolha UF, período e modalidades que incluam o edital.
              </span>
            )}
          </div>

          <div>
            <label style={rotulo} htmlFor="lic-uf">UF</label>
            <select
              id="lic-uf"
              style={campo}
              value={form.uf}
              onChange={evento => alterar('uf', evento.target.value)}
              disabled={busca.buscando}
            >
              <option value="">Brasil inteiro</option>
              {UFS_BRASIL.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={rotulo} htmlFor="lic-dias">Período (dias)</label>
            <input
              id="lic-dias"
              type="number"
              min={1}
              max={365}
              style={campo}
              value={form.diasBusca}
              onChange={evento => alterar('diasBusca', evento.target.value)}
              disabled={busca.buscando}
            />
            <span style={dica}>Publicações dos últimos N dias (até 365).</span>
          </div>
        </div>

        {/* Modalidades */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 8
            }}
          >
            <span style={{ ...rotulo, marginBottom: 0 }}>Modalidades</span>

            <select
              aria-label="Atalho de modalidades"
              style={{ ...campo, width: 'auto', padding: '5px 8px', fontSize: 12 }}
              value={presetAtivo ? presetAtivo.id : ''}
              onChange={evento => {
                const preset = PRESETS_MODALIDADES.find(item => item.id === evento.target.value);
                if (preset) {
                  alterar('modalidades', preset.codigos.slice());
                }
              }}
              disabled={busca.buscando}
            >
              <option value="">Seleção personalizada</option>
              {PRESETS_MODALIDADES.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CODIGOS_MODALIDADES.map(codigo => {
              const ativo = form.modalidades.indexOf(codigo) >= 0;
              return (
                <button
                  key={codigo}
                  type="button"
                  style={chip(ativo)}
                  aria-pressed={ativo}
                  onClick={() => alternarModalidade(codigo)}
                  disabled={busca.buscando}
                >
                  {ativo ? '✓ ' : ''}{MODALIDADES_PNCP[codigo]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Refinar */}
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            style={{ ...botaoSecundario, padding: '6px 12px' }}
            aria-expanded={mostrarRefinar}
            onClick={() => setMostrarRefinar(!mostrarRefinar)}
          >
            {mostrarRefinar ? '▾ Ocultar refinamentos' : '▸ Refinar busca (palavras, valores e score)'}
          </button>

          {mostrarRefinar && (
            <div style={{ ...grade(240), marginTop: 14 }}>
              <div>
                <label style={rotulo} htmlFor="lic-obrig">Palavras obrigatórias</label>
                <input
                  id="lic-obrig"
                  style={campo}
                  value={form.obrigatorias}
                  onChange={evento => alterar('obrigatorias', evento.target.value)}
                  placeholder="workflow, documentos"
                  disabled={busca.buscando}
                />
                <span style={dica}>Todas devem aparecer no objeto. Separe por vírgula.</span>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={rotulo} htmlFor="lic-rel">Palavras relacionadas</label>
                <input
                  id="lic-rel"
                  style={campo}
                  value={form.relacionadas}
                  onChange={evento => alterar('relacionadas', evento.target.value)}
                  placeholder="BPM, software, digitalização"
                  disabled={busca.buscando}
                />
                <span style={dica}>Aumentam a aderência (+15 cada). Clique para incluir:</span>
                <SugestoesTermos
                  grupos={SUGESTOES_RELACIONADAS}
                  valor={form.relacionadas}
                  disabled={busca.buscando}
                  onChange={novo => alterar('relacionadas', novo)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={rotulo} htmlFor="lic-neg">Palavras para excluir</label>
                <input
                  id="lic-neg"
                  style={campo}
                  value={form.negativas}
                  onChange={evento => alterar('negativas', evento.target.value)}
                  placeholder="hospitalar, equipamento"
                  disabled={busca.buscando}
                />
                <span style={dica}>Se aparecer no objeto, o resultado é descartado. Clique para incluir:</span>
                <SugestoesTermos
                  grupos={SUGESTOES_EXCLUIR}
                  valor={form.negativas}
                  disabled={busca.buscando}
                  cor="#9B2C1F"
                  corFundo="#FDECEA"
                  onChange={novo => alterar('negativas', novo)}
                />
              </div>

              <div>
                <label style={rotulo} htmlFor="lic-vmin">Valor mínimo (R$)</label>
                <input
                  id="lic-vmin"
                  style={campo}
                  value={form.valorMinimo}
                  onChange={evento => alterar('valorMinimo', evento.target.value)}
                  placeholder="Sem limite"
                  inputMode="decimal"
                  disabled={busca.buscando}
                />
              </div>

              <div>
                <label style={rotulo} htmlFor="lic-vmax">Valor máximo (R$)</label>
                <input
                  id="lic-vmax"
                  style={campo}
                  value={form.valorMaximo}
                  onChange={evento => alterar('valorMaximo', evento.target.value)}
                  placeholder="Sem limite"
                  inputMode="decimal"
                  disabled={busca.buscando}
                />
                <span style={dica}>Aceita 1.500.000,00 ou 1500000.</span>
              </div>

              <div>
                <label style={rotulo} htmlFor="lic-score">Score mínimo (%)</label>
                <input
                  id="lic-score"
                  type="number"
                  min={0}
                  max={100}
                  style={campo}
                  value={form.scoreMinimo}
                  onChange={evento => alterar('scoreMinimo', evento.target.value)}
                  disabled={busca.buscando}
                />
              </div>
            </div>
          )}
        </div>

        {erroForm && (
          <p
            role="alert"
            style={{
              margin: '16px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              background: COR.indigoClaro,
              color: COR.azul,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            ! {erroForm}
          </p>
        )}

        <div style={{ ...linhaAcoes, marginTop: 18 }}>
          {!busca.buscando && (
            <button type="button" onClick={iniciarBusca}>
              Buscar licitações
            </button>
          )}

          {busca.buscando && (
            <button type="button" style={botaoSecundario} onClick={busca.cancelar}>
              Cancelar busca
            </button>
          )}

          {!busca.buscando && temBusca && (
            <button type="button" style={botaoSecundario} onClick={busca.limpar}>
              Limpar resultados
            </button>
          )}

          {!busca.buscando && (
            <button
              type="button"
              style={{ ...botaoSecundario, border: 'none', color: COR.textoSecundario }}
              onClick={() => setForm(FORMULARIO_INICIAL)}
            >
              Restaurar filtros padrão
            </button>
          )}
        </div>

        <p style={{ ...textoApoio, marginTop: 12, fontSize: 11 }}>
          Para respeitar o limite do PNCP, há uma pausa de {CONFIG_PNCP.intervaloEntreRequisicoesMs / 1000}s
          entre páginas. Períodos longos e muitas modalidades podem levar alguns minutos — mantenha esta tela aberta.
        </p>
      </div>

      {/* ======================================================
          PROGRESSO / RESUMO
          ====================================================== */}
      {temBusca && (
        <div style={cartao} aria-live="polite">

          {busca.buscando && progresso && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <h2 style={tituloSecao}>
                  Consultando {progresso.modalidadeAtual}
                </h2>
                <span style={{ fontSize: 12, color: COR.textoSecundario }}>
                  Modalidade {progresso.indiceModalidade} de {progresso.totalModalidades}
                  {' · '}página {progresso.pagina}
                  {progresso.totalPaginasModalidade ? ` de ${progresso.totalPaginasModalidade}` : ''}
                </span>
              </div>

              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: COR.neutro,
                  overflow: 'hidden',
                  margin: '12px 0'
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(3, percentualModalidades))}%`,
                    height: '100%',
                    background: COR.ciano,
                    transition: 'width .4s ease'
                  }}
                />
              </div>

              {progresso.mensagem && (
                <p style={{ ...textoApoio, marginBottom: 10 }}>{progresso.mensagem}</p>
              )}
            </>
          )}

          {busca.buscando && !progresso && (
            <h2 style={tituloSecao}>Iniciando consulta ao PNCP…</h2>
          )}

          {!busca.buscando && resumo && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                marginBottom: 12
              }}
            >
              <div>
                <h2 style={tituloSecao}>
                  {resumo.cancelada ? 'Busca cancelada — resultados parciais' : 'Busca concluída'}
                </h2>
                <p style={textoApoio}>
                  Período de {resumo.inicio.toLocaleDateString('pt-BR')} a {resumo.fim.toLocaleDateString('pt-BR')}
                  {' · '}duração de {resumo.duracaoSegundos}s
                </p>
              </div>

              <button type="button" onClick={imprimir}>
                Imprimir / salvar PDF
              </button>
            </div>
          )}

          <div style={grade(150)}>
            {[
              {
                titulo: 'Recebidos do PNCP',
                valor: resumo ? resumo.registrosBrutos : (progresso ? progresso.registrosBrutos : 0)
              },
              {
                titulo: 'Registros únicos',
                valor: resumo ? resumo.registrosUnicos : (progresso ? progresso.registrosUnicos : 0)
              },
              {
                titulo: 'Descartados no filtro',
                valor: resumo ? resumo.descartados : (progresso ? progresso.descartados : 0)
              },
              {
                titulo: 'Oportunidades aderentes',
                valor: busca.resultados.length
              }
            ].map(indicador => (
              <div
                key={indicador.titulo}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: COR.azulClaro
                }}
              >
                <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario }}>
                  {indicador.titulo}
                </span>
                <strong style={{ display: 'block', fontSize: 22, color: COR.azul, fontWeight: 600 }}>
                  {indicador.valor.toLocaleString('pt-BR')}
                </strong>
              </div>
            ))}
          </div>

          {resumo && resumo.falhas.length > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${COR.indigo}`,
                background: COR.indigoClaro
              }}
            >
              <strong style={{ display: 'block', fontSize: 12, color: COR.azul, marginBottom: 4 }}>
                ! Algumas consultas falharam ({resumo.falhas.length}) — os resultados podem estar incompletos
              </strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {resumo.falhas.slice(0, 5).map((falha, indice) => (
                  <li key={indice} style={{ fontSize: 11, color: COR.azul }}>{falha}</li>
                ))}
              </ul>
              <span style={{ ...dica, marginTop: 6 }}>
                Se aparecer “Falha de conexão”, rode o teste de conexão para verificar bloqueio CORS.
              </span>
            </div>
          )}

          {avisoPopup && (
            <p style={{ ...dica, marginTop: 10, color: COR.indigo }}>
              O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.
            </p>
          )}
        </div>
      )}

      {/* ======================================================
          RESULTADOS
          ====================================================== */}
      {busca.resultados.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              margin: '4px 0 12px'
            }}
          >
            <h2 style={{ ...tituloSecao, margin: 0 }}>
              Oportunidades ({resultadosVisiveis.length}
              {resultadosVisiveis.length !== busca.resultados.length ? ` de ${busca.resultados.length}` : ''})
            </h2>

            <input
              aria-label="Filtrar resultados"
              style={{ ...campo, width: 280 }}
              value={filtroLista}
              onChange={evento => setFiltroLista(evento.target.value)}
              placeholder="Filtrar por órgão, cidade ou objeto…"
            />
          </div>

          {pareceres.situacao === 'ok' && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '0 0 12px' }}
              role="group"
              aria-label="Filtrar por parecer"
            >
              <span style={{ fontSize: 12, color: COR.textoSecundario, marginRight: 4 }}>Parecer:</span>
              {FILTROS_PARECER.map(filtro => {
                const ativo = filtroParecer === filtro.id;
                return (
                  <button
                    key={filtro.id}
                    type="button"
                    style={chip(ativo)}
                    aria-pressed={ativo}
                    onClick={() => setFiltroParecer(filtro.id)}
                  >
                    {filtro.rotulo} ({contagemParecer[filtro.id] || 0})
                  </button>
                );
              })}
              {avisoParecer && (
                <span role="status" style={{ fontSize: 11, color: COR.textoSecundario, marginLeft: 8 }}>
                  {avisoParecer}
                </span>
              )}
            </div>
          )}

          {resultadosVisiveis.map(item => (
            <CartaoLicitacao
              key={item.chave}
              item={item}
              onPrevisualizar={setPrevia}
              parecer={pareceres.obter(item)}
              situacaoPareceres={pareceres.situacao}
              onRegistrarParecer={abrirDialogoParecer}
              estadoIa={ia.estadoDe(item)}
              onAnalisarIa={ia.analisar}
              acompanhamento={acompanhamento.obter(item)}
              novidades={(() => { const a = acompanhamento.obter(item); return a ? acompanhamento.naoLidas(a.id) : 0; })()}
              acompanhamentoDisponivel={acompanhamento.situacao === 'ok'}
              processandoAcompanhamento={acompanhamento.processandoChave !== '' && acompanhamento.processandoChave !== '*'}
              onAcompanhar={it => { acompanhamento.acompanhar(it).catch(() => undefined); }}
              onVerAcompanhamento={() => setAba('acompanhamento')}
            />
          ))}

          {resultadosVisiveis.length === 0 && (
            <div style={{ ...cartao, background: COR.neutro }}>
              <p style={textoApoio}>Nenhuma oportunidade com este filtro.</p>
            </div>
          )}
        </>
      )}

      {!busca.buscando && resumo && busca.resultados.length === 0 && (
        <div style={{ ...cartao, background: COR.neutro }}>
          <h2 style={tituloSecao}>Nenhuma licitação encontrada</h2>
          <p style={textoApoio}>
            Experimente aumentar o período, buscar no Brasil inteiro, remover palavras obrigatórias,
            adicionar palavras relacionadas ou reduzir o score mínimo.
          </p>
          {form.modoBusca !== '4' && /\d/.test(form.assunto) && (
            <p style={{ ...textoApoio, marginTop: 8 }}>
              Procurando <strong>um edital específico</strong> pelo número ou nome?{' '}
              <button
                type="button"
                style={botaoSecundario}
                onClick={() => {
                  setForm(atual => ({ ...atual, modoBusca: '4' }));
                  window.scrollTo(0, 0);
                }}
              >
                Usar “Edital específico”
              </button>
            </p>
          )}
        </div>
      )}

      </div>

      <EditalPreviaModal
        item={previa}
        onFechar={fecharPrevia}
        parecer={previa ? pareceres.obter(previa) : undefined}
        situacaoPareceres={pareceres.situacao}
        onRegistrarParecer={previa
          ? (decisao?: DecisaoParecer, justificativa?: string) => abrirDialogoParecer(previa, decisao, justificativa)
          : undefined}
        dialogoParecerAberto={!!dialogo || configIaAberta}
        estadoIa={previa ? ia.estadoDe(previa) : undefined}
        onAnalisarIa={previa ? () => ia.analisar(previa) : undefined}
      />

      <ConfigurarIaModal
        aberto={configIaAberta}
        promptAtual={ia.prompt}
        promptService={ia.promptService}
        servicoAnalise={ia.servicoAnalise}
        tabelasExistem={ia.tabelasIaExistem}
        resultados={busca.resultados}
        pareceresAtuais={pareceres.atuais}
        responsavel={contexto ? contexto.nome : ''}
        apiDisponivel={ia.apiDisponivel}
        onSalvo={ia.definirPrompt}
        onFechar={() => setConfigIaAberta(false)}
      />

      <RegistrarParecerDialog
        item={dialogo ? dialogo.item : undefined}
        decisaoInicial={dialogo ? dialogo.decisao : undefined}
        justificativaInicial={dialogo ? dialogo.justificativa : undefined}
        parecerAtual={dialogo ? pareceres.obter(dialogo.item) : undefined}
        onCancelar={fecharDialogoParecer}
        onSalvar={salvarParecer}
      />

    </section>
  );
};

export default LicitacoesBuscaPage;
