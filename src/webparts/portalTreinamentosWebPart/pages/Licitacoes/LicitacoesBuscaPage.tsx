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
}

interface IDialogoParecer {
  item: ILicitacaoResultado;
  decisao?: DecisaoParecer;
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
  onRegistrarParecer: (item: ILicitacaoResultado, decisao?: DecisaoParecer) => void;
}> = ({ item, onPrevisualizar, parecer, situacaoPareceres, onRegistrarParecer }) => (
  <div
    style={{
      ...cartao,
      borderLeft: `4px solid ${item.score >= 50 ? COR.ciano : COR.indigo}`,
      marginBottom: 12
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
  contexto
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
    (item: ILicitacaoResultado, decisao?: DecisaoParecer): void => {
      setDialogo({ item, decisao });
    },
    []
  );

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

          <button
            type="button"
            style={botaoSecundario}
            onClick={onIrParaTeste}
          >
            Testar conexão
          </button>
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
            </select>
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

              <div>
                <label style={rotulo} htmlFor="lic-rel">Palavras relacionadas</label>
                <input
                  id="lic-rel"
                  style={campo}
                  value={form.relacionadas}
                  onChange={evento => alterar('relacionadas', evento.target.value)}
                  placeholder="BPM, software, digitalização"
                  disabled={busca.buscando}
                />
                <span style={dica}>Aumentam a aderência (+15 cada).</span>
              </div>

              <div>
                <label style={rotulo} htmlFor="lic-neg">Palavras para excluir</label>
                <input
                  id="lic-neg"
                  style={campo}
                  value={form.negativas}
                  onChange={evento => alterar('negativas', evento.target.value)}
                  placeholder="hospitalar, equipamento"
                  disabled={busca.buscando}
                />
                <span style={dica}>Se aparecer no objeto, o resultado é descartado.</span>
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
        </div>
      )}

      <EditalPreviaModal
        item={previa}
        onFechar={fecharPrevia}
        parecer={previa ? pareceres.obter(previa) : undefined}
        situacaoPareceres={pareceres.situacao}
        onRegistrarParecer={previa
          ? (decisao?: DecisaoParecer) => abrirDialogoParecer(previa, decisao)
          : undefined}
        dialogoParecerAberto={!!dialogo}
      />

      <RegistrarParecerDialog
        item={dialogo ? dialogo.item : undefined}
        decisaoInicial={dialogo ? dialogo.decisao : undefined}
        parecerAtual={dialogo ? pareceres.obter(dialogo.item) : undefined}
        onCancelar={fecharDialogoParecer}
        onSalvar={salvarParecer}
      />

    </section>
  );
};

export default LicitacoesBuscaPage;
