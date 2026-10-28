import * as React from 'react';

import {
  formatarDataCurta,
  vencimentoDocumento
} from '../../utils/vencimentoDocumento';

import {
  IDocumento
} from '../../models/Documento';

import EmptyState from
  '../../components/common/EmptyState';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  ehAdministrador,
  filtrarDocumentosVisiveis,
  obterAreasVisiveis
} from '../../services/DocumentoVisibilidade';

import {
  useDocumentosPendencias
} from '../../hooks/useDocumentosPendencias';

import {
  useEtapasFluxoDocumentos
} from '../../hooks/useEtapasFluxoDocumentos';

import MinhasPendenciasDocumentos from
  './MinhasPendenciasDocumentos';

import AreasDocumentosCards from
  './AreasDocumentosCards';

import {
  IconeArquivo,
  PrazoCelula,
  ResponsavelCelula
} from './DocumentosTabelaCelulas';

import {
  useArquivosDocumentos
} from '../../hooks/useArquivosDocumentos';

import {
  EtapaFluxoBadge,
  StatusDocumentoBadge
} from '../../components/common/StatusDocumento';

import {
  ProcessoNegocioService
} from '../../services/processos/ProcessoNegocioService';

import ResumoModulo, {
  CORES_INDICADOR,
  IIndicadorResumo
} from '../../components/common/ResumoModulo';

export interface IDocumentosHomePageProps {

  documentos:
    IDocumento[];

  carregando?:
    boolean;

  erro?:
    string;

  onAbrirDocumento?:
    (
      documento:
        IDocumento
    ) => void;

  // Mantido por compatibilidade — "Novo documento" agora é uma aba
  // do módulo (mesmo padrão de Treinamentos).
  onNovoDocumento?:
    () => void;

  primeiroNome?:
    string;

  // Perfil do usuário logado: define quais áreas e documentos aparecem.
  contexto?:
    IContextoAcesso;

  // Tabela de Áreas (dgt_area) — gera os cartões.
  areas?:
    IAreaAdmin[];

  // Vínculos usuário × área — define as áreas de cada usuário e quem
  // é Gestor (aprovador).
  usuariosAreas?:
    IUsuarioAreaAdmin[];

  // Usado para buscar as revisões em andamento (Minhas pendências).
  dataverseService?:
    DataverseService;
}

const guidTela = (
  valor?: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

// Filtros acionados pelos cartões de indicador.
type FiltroIndicadorDocumento =
  | ''
  | 'vigentes'
  | 'emRevisao'
  | 'pendencias'
  | 'responsavel';

const ROTULO_FILTRO_INDICADOR:
  Record<Exclude<FiltroIndicadorDocumento, ''>, string> = {
  vigentes: 'Vigentes',
  emRevisao: 'Em revisão',
  pendencias: 'Minhas pendências',
  responsavel: 'Sob minha responsabilidade'
};

const statusEhVigente = (
  status: string
): boolean =>
  (status || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim() === 'vigente';

const atendeFiltroIndicador = (
  documento: IDocumento,
  filtro: FiltroIndicadorDocumento,
  idsPendentes: string[],
  meuId: string
): boolean => {

  switch (filtro) {

    case 'vigentes':
      return statusEhVigente(documento.status);

    case 'emRevisao':
      return !statusEhVigente(documento.status);

    case 'pendencias':
      return idsPendentes.indexOf(guidTela(documento.id)) >= 0;

    // Responsável pelo documento OU por uma etapa do fluxo que está
    // aguardando o usuário.
    case 'responsavel':
      return (
        (!!meuId && guidTela(documento.responsavelId) === meuId) ||
        idsPendentes.indexOf(guidTela(documento.id)) >= 0
      );

    default:
      return true;
  }
};

const C = {
  azul:
    '#0B67D1',

  azulEscuro:
    '#0A2845',

  texto:
    '#28445F',

  secundario:
    '#61788E',

  borda:
    '#D8E2EC',

  fundo:
    '#F5F8FB',

  branco:
    '#FFFFFF',

  verde:
    '#07825C',

  verdeClaro:
    '#DDF7EC'
};

const tiposNavegacao = [
  {
    icone:
      '📘',

    titulo:
      'POP',

    descricao:
      'Procedimentos Operacionais Padrão'
  },
  {
    icone:
      '🛡',

    titulo:
      'Políticas',

    descricao:
      'Diretrizes e políticas da empresa'
  },
  {
    icone:
      '📖',

    titulo:
      'Instruções',

    descricao:
      'Instruções de trabalho'
  },
  {
    icone:
      '📋',

    titulo:
      'Formulários',

    descricao:
      'Formulários e modelos'
  },
  {
    icone:
      '⚖',

    titulo:
      'Normas',

    descricao:
      'Normas e legislações'
  },
  {
    icone:
      '📚',

    titulo:
      'Manuais',

    descricao:
      'Manuais e guias'
  }
];

const inputStyle:
  React.CSSProperties = {

  width:
    '100%',

  minHeight:
    '42px',

  boxSizing:
    'border-box',

  padding:
    '10px 12px',

  border:
    `1px solid ${C.borda}`,

  borderRadius:
    '9px',

  background:
    C.branco,

  color:
    C.azulEscuro,

  fontSize:
    '13px'
};

// Linhas da tabela: cabeçalhos de grupo (área/processo) ou documento.
type ItemTabelaDocumentos =
  | { tipo: 'area'; chave: string; nome: string; quantidade: number; semProcesso?: boolean }
  | { tipo: 'processo'; chave: string; nome: string; quantidade: number; semProcesso?: boolean }
  | { tipo: 'documento'; documento: IDocumento };

const CHAVE_AGRUPAR = 'dgt-documentos-agrupar';

const th:
  React.CSSProperties = {

  padding:
    '12px 14px',

  textAlign:
    'left',

  fontSize:
    '12px',

  fontWeight:
    800,

  color:
    '#38536D',

  whiteSpace:
    'nowrap'
};

const td:
  React.CSSProperties = {

  padding:
    '13px 14px',

  color:
    '#28445F',

  fontSize:
    '13px',

  verticalAlign:
    'middle'
};

// Nome do documento: ícone pelo tipo de arquivo + link que abre a
// TELA DO DOCUMENTO (dados, revisões, histórico e botões de ação).
// Para ver o arquivo, use "Pré-visualizar" ou "Abrir documento" lá.
const NomeDocumentoCelula:
  React.FC<{
    documento: IDocumento;
    arquivo?: {
      url: string;
      revisao: string;
      vigente: boolean;
    };
    onAbrirDetalhe?: (documento: IDocumento) => void;
  }> = ({
    documento,
    arquivo,
    onAbrirDetalhe
  }) => {

    const [emFoco, setEmFoco] =
      React.useState(false);

    return (
      <div
        style={{
          display: 'flex',
          gap: '9px',
          alignItems: 'center'
        }}
      >
        <IconeArquivo url={arquivo?.url} />

        <button
          type="button"
          title={`Abrir os dados de ${documento.codigo}`}
          onClick={() => {
            if (onAbrirDetalhe) {
              onAbrirDetalhe(documento);
            }
          }}
          onMouseEnter={() => setEmFoco(true)}
          onMouseLeave={() => setEmFoco(false)}
          onFocus={() => setEmFoco(true)}
          onBlur={() => setEmFoco(false)}
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            color: emFoco ? '#0867D7' : '#0A2845',
            textDecoration: emFoco ? 'underline' : 'none',
            textAlign: 'left',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          <strong style={{ fontSize: '13px' }}>
            {documento.titulo}
          </strong>
        </button>
      </div>
    );
  };

// Lista vazia estável (evita recarregar os hooks a cada render).
const SEM_VINCULOS: IUsuarioAreaAdmin[] = [];

const DocumentosHomePage:
  React.FC<
    IDocumentosHomePageProps
  > = ({
    documentos,
    carregando = false,
    erro = '',
    onAbrirDocumento,
    primeiroNome,
    contexto,
    areas: areasCadastradas = [],
    usuariosAreas = SEM_VINCULOS,
    dataverseService
  }) => {

    // ==========================================================
    // VISIBILIDADE POR PERFIL / ÁREA
    // ==========================================================

    const administrador =
      ehAdministrador(contexto);

    const areasVisiveis =
      React.useMemo(
        () =>
          obterAreasVisiveis(
            contexto,
            areasCadastradas,
            usuariosAreas
          ),
        [
          contexto,
          areasCadastradas,
          usuariosAreas
        ]
      );

    // Pendências são calculadas sobre TODOS os documentos: quem é
    // responsável por uma etapa precisa ver o documento mesmo que não
    // seja membro da área dele.
    const pendencias =
      useDocumentosPendencias(
        dataverseService,
        documentos,
        contexto,
        usuariosAreas
      );

    const idsPendentes =
      React.useMemo(
        () =>
          pendencias.pendencias.map(
            pendencia => guidTela(pendencia.documento.id)
          ),
        [
          pendencias.pendencias
        ]
      );

    const documentosVisiveis =
      React.useMemo(
        () =>
          filtrarDocumentosVisiveis(
            documentos,
            contexto,
            areasVisiveis,
            usuariosAreas,
            idsPendentes
          ),
        [
          documentos,
          contexto,
          areasVisiveis,
          usuariosAreas,
          idsPendentes
        ]
      );

    // Onde cada documento está no fluxo: revisão real, etapa atual e
    // o responsável PELA ETAPA (não o responsável do cadastro).
    const fluxoDocumentos =
      useEtapasFluxoDocumentos(
        dataverseService,
        documentosVisiveis,
        contexto,
        usuariosAreas
      );

    // Arquivo atual (revisão vigente) de cada documento: define o ícone
    // e o que abre ao clicar no nome.
    const arquivos =
      useArquivosDocumentos(
        dataverseService,
        documentos
      );

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const [
      area,
      setArea
    ] =
      React.useState('');

    const [
      tipo,
      setTipo
    ] =
      React.useState('');

    const [
      status,
      setStatus
    ] =
      React.useState('');

    // ==========================================================
    // FILTRO PELOS CARTÕES DE INDICADOR
    // Clicar num cartão filtra a lista; clicar de novo (ou no ✕)
    // remove o filtro. Combina com pesquisa, área, tipo e status.
    // ==========================================================

    const [
      filtroIndicador,
      setFiltroIndicador
    ] =
      React.useState<FiltroIndicadorDocumento>('');

    const alternarFiltro =
      (
        filtro: FiltroIndicadorDocumento
      ): void =>
        setFiltroIndicador(
          atual =>
            atual === filtro
              ? ''
              : filtro
        );

    // Lista com pesquisa + área + tipo + status. É a base tanto da
    // tabela quanto dos NÚMEROS dos cards — assim o número do card é
    // sempre igual à quantidade que aparece ao clicar nele.
    const baseFiltrada =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          return documentosVisiveis.filter(
            item => {

              const texto =
                [
                  item.codigo,
                  item.titulo,
                  item.tipo,
                  item.area,
                  item.status,
                  item.revisaoAtual
                ]
                  .join(
                    ' '
                  )
                  .toLowerCase();

              return (
                (
                  !termo ||
                  texto.indexOf(
                    termo
                  ) >=
                  0
                ) &&
                (
                  !area ||
                  guidTela(item.areaId) ===
                  guidTela(area)
                ) &&
                (
                  !tipo ||
                  item.tipo ===
                  tipo
                ) &&
                (
                  !status ||
                  item.status ===
                  status
                )
              );
            }
          );
        },
        [
          documentosVisiveis,
          pesquisa,
          area,
          tipo,
          status
        ]
      );

    const indicadores =
      React.useMemo(
        (): IIndicadorResumo[] => {

          const normalizarStatus = (
            valor: string
          ): string =>
            (valor || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();

          const vigentes =
            baseFiltrada.filter(
              documento =>
                normalizarStatus(documento.status) === 'vigente'
            ).length;

          const emRevisao =
            baseFiltrada.length - vigentes;

          const comPendencia =
            baseFiltrada.filter(
              documento =>
                idsPendentes.indexOf(guidTela(documento.id)) >= 0
            ).length;

          const meuId =
            guidTela(contexto?.usuarioId);

          const minhaResponsabilidade =
            baseFiltrada.filter(
              documento =>
                (!!meuId && guidTela(documento.responsavelId) === meuId) ||
                idsPendentes.indexOf(guidTela(documento.id)) >= 0
            ).length;

          return [
            {
              titulo: 'Vigentes',
              valor: vigentes,
              icone: 'fileText',
              ...CORES_INDICADOR.verde,
              detalhe: 'disponíveis para consulta',
              ativo: filtroIndicador === 'vigentes',
              onClick: () => alternarFiltro('vigentes')
            },
            {
              titulo: 'Em revisão',
              valor: emRevisao,
              icone: 'play',
              ...CORES_INDICADOR.laranja,
              detalhe: 'elaboração ou aprovação',
              ativo: filtroIndicador === 'emRevisao',
              onClick: () => alternarFiltro('emRevisao')
            },
            {
              titulo: 'Minhas pendências',
              valor: comPendencia,
              icone: 'hourglass',
              ...CORES_INDICADOR.vermelho,
              detalhe: 'elaborar ou aprovar',
              ativo: filtroIndicador === 'pendencias',
              onClick: () => alternarFiltro('pendencias')
            },
            {
              titulo: 'Sob minha responsabilidade',
              valor: minhaResponsabilidade,
              icone: 'checkCircle',
              ...CORES_INDICADOR.azul,
              detalhe: 'documento ou etapa do fluxo',
              ativo: filtroIndicador === 'responsavel',
              onClick: () => alternarFiltro('responsavel')
            },
            {
              // Mostra tudo o que o usuário pode ver: limpa o filtro do
              // indicador e da área (quando ele tem mais de uma).
              titulo: administrador ? 'Áreas' : 'Minhas áreas',
              valor: areasVisiveis.length,
              icone: 'folder',
              ...CORES_INDICADOR.roxo,
              detalhe: administrador ? 'ver todas' : 'ver todos os documentos',
              ativo: !filtroIndicador && (!area || areasVisiveis.length === 1),
              onClick: () => {
                setFiltroIndicador('');

                if (administrador || areasVisiveis.length !== 1) {
                  setArea('');
                }
              }
            }
          ];
        },
        [
          baseFiltrada,
          idsPendentes,
          contexto,
          administrador,
          areasVisiveis,
          filtroIndicador,
          area
        ]
      );

    const filtrados =
      React.useMemo(
        () =>
          baseFiltrada.filter(
            item =>
              atendeFiltroIndicador(
                item,
                filtroIndicador,
                idsPendentes,
                guidTela(contexto?.usuarioId)
              )
          ),
        [
          baseFiltrada,
          filtroIndicador,
          idsPendentes,
          contexto
        ]
      );

    // ----------------------------------------------------------
    // AGRUPAMENTO  Área → Processo → Documentos  (padrão: ligado)
    // A escolha do usuário fica guardada no navegador.
    // ----------------------------------------------------------

    const [agrupar, setAgrupar] =
      React.useState<boolean>(() => {
        try {
          return window.localStorage.getItem(CHAVE_AGRUPAR) !== 'nao';
        } catch {
          return true;
        }
      });

    const alternarAgrupar = (): void => {
      const novo = !agrupar;
      setAgrupar(novo);
      try {
        window.localStorage.setItem(CHAVE_AGRUPAR, novo ? 'sim' : 'nao');
      } catch {
        // navegador sem armazenamento: vale só nesta sessão
      }
    };

    // Grupos recolhidos (chave = área ou área|processo).
    const [recolhidos, setRecolhidos] =
      React.useState<Record<string, boolean>>({});

    const alternarGrupo = (chave: string): void =>
      setRecolhidos(atual => ({ ...atual, [chave]: !atual[chave] }));

    // Processo de negócio de cada documento.
    const [processosNegocio, setProcessosNegocio] =
      React.useState<{
        porDocumento: Record<string, string>;
        processos: Record<string, { codigo: string; nome: string; ordem: number }>;
      }>({ porDocumento: {}, processos: {} });

    React.useEffect(
      () => {
        if (!dataverseService) {
          return;
        }

        let ativo = true;
        const servico = new ProcessoNegocioService(dataverseService);

        Promise.all([servico.listar(), servico.processoPorDocumento()])
          .then(([lista, porDocumento]) => {
            if (!ativo) {
              return;
            }
            const processos: Record<string, { codigo: string; nome: string; ordem: number }> = {};
            lista.forEach(item => {
              processos[item.id] = { codigo: item.codigo, nome: item.nome, ordem: item.ordem };
            });
            setProcessosNegocio({ porDocumento, processos });
          })
          .catch(falha => {
            // Sem as tabelas de processos: tudo fica em "Sem processo".
            console.error(falha);
          });

        return () => { ativo = false; };
      },
      [dataverseService]
    );

    const itensTabela =
      React.useMemo(
        (): ItemTabelaDocumentos[] => {

          if (!agrupar) {
            return filtrados.map(documento => ({ tipo: 'documento' as const, documento }));
          }

          // área → processo → documentos (mantém a ordem da lista dentro do grupo)
          const areas: Record<string, { nome: string; processos: Record<string, IDocumento[]> }> = {};

          filtrados.forEach(documento => {
            const chaveArea = guidTela(documento.areaId) || 'sem-area';
            const processoId = processosNegocio.porDocumento[guidTela(documento.id)] || '';
            const chaveProcesso = processoId && processosNegocio.processos[processoId] ? processoId : 'sem-processo';

            if (!areas[chaveArea]) {
              areas[chaveArea] = { nome: documento.area || 'Sem área', processos: {} };
            }
            (areas[chaveArea].processos[chaveProcesso] = areas[chaveArea].processos[chaveProcesso] || []).push(documento);
          });

          const itens: ItemTabelaDocumentos[] = [];

          Object.keys(areas)
            .sort((a, b) =>
              a === 'sem-area' ? 1 : b === 'sem-area' ? -1 : areas[a].nome.localeCompare(areas[b].nome, 'pt-BR')
            )
            .forEach(chaveArea => {
              const grupoArea = areas[chaveArea];
              const total = Object.keys(grupoArea.processos)
                .reduce((soma, chave) => soma + grupoArea.processos[chave].length, 0);

              itens.push({ tipo: 'area', chave: chaveArea, nome: grupoArea.nome, quantidade: total });

              if (recolhidos[chaveArea]) {
                return;
              }

              Object.keys(grupoArea.processos)
                .sort((a, b) => {
                  if (a === 'sem-processo') { return 1; }
                  if (b === 'sem-processo') { return -1; }
                  const pa = processosNegocio.processos[a];
                  const pb = processosNegocio.processos[b];
                  return (pa.ordem - pb.ordem) || (pa.codigo || pa.nome).localeCompare(pb.codigo || pb.nome, 'pt-BR');
                })
                .forEach(chaveProcesso => {
                  const processo = processosNegocio.processos[chaveProcesso];
                  const chaveGrupo = `${chaveArea}|${chaveProcesso}`;
                  const documentos = grupoArea.processos[chaveProcesso];

                  itens.push({
                    tipo: 'processo',
                    chave: chaveGrupo,
                    nome: processo
                      ? `${processo.codigo ? `${processo.codigo} — ` : ''}${processo.nome}`
                      : 'Sem processo definido',
                    quantidade: documentos.length,
                    semProcesso: !processo
                  });

                  if (!recolhidos[chaveGrupo]) {
                    documentos.forEach(documento => itens.push({ tipo: 'documento', documento }));
                  }
                });
            });

          return itens;
        },
        [agrupar, filtrados, processosNegocio, recolhidos]
      );

    // Cabeçalho de grupo (área ou processo) dentro da tabela.
    const renderCabecalhoGrupo = (
      item: ItemTabelaDocumentos
    ): React.ReactElement | null => {

      if (item.tipo === 'documento') {
        return null;
      }

      const recolhido = !!recolhidos[item.chave];
      const ehArea = item.tipo === 'area';

      return (
        <tr key={`grupo-${item.chave}`}>
          <td
            colSpan={11}
            style={{
              padding: ehArea ? '10px 14px' : '7px 14px 7px 34px',
              background: ehArea ? '#EDF0F5' : '#F8FAFC',
              borderTop: ehArea ? '2px solid #D9DEE7' : '1px solid #EDF1F5'
            }}
          >
            <button
              type="button"
              onClick={() => alternarGrupo(item.chave)}
              aria-expanded={!recolhido}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 0,
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: ehArea ? '#202A44' : (item.semProcesso ? '#66788A' : '#485CC7'),
                fontSize: ehArea ? '13px' : '12.5px',
                fontWeight: ehArea ? 800 : 700,
                fontStyle: item.semProcesso ? 'italic' : 'normal'
              }}
            >
              <span style={{ width: '12px', display: 'inline-block' }}>{recolhido ? '▸' : '▾'}</span>
              <span aria-hidden="true">{ehArea ? '🏢' : '⚙'}</span>
              {ehArea ? item.nome.toUpperCase() : item.nome}
              <span
                style={{
                  padding: '0 8px',
                  borderRadius: '10px',
                  background: ehArea ? '#202A44' : '#E8EAF8',
                  color: ehArea ? '#FFFFFF' : '#485CC7',
                  fontSize: '10.5px',
                  lineHeight: '17px',
                  fontStyle: 'normal'
                }}
              >
                {item.quantidade}
              </span>
            </button>
          </td>
        </tr>
      );
    };

    React.useEffect(
      () => {
        if (
          !administrador &&
          areasVisiveis.length === 1 &&
          !area
        ) {
          setArea(areasVisiveis[0].id);
        }
      },
      [
        administrador,
        areasVisiveis
      ]
    );

    const tipos =
      React.useMemo(
        () => {

          const valores:
            string[] = [];

          documentosVisiveis.forEach(
            item => {

              const valor =
                (
                  item.tipo ||
                  ''
                ).trim();

              if (
                valor &&
                valores.indexOf(
                  valor
                ) <
                0
              ) {
                valores.push(
                  valor
                );
              }
            }
          );

          return valores.sort();
        },
        [
          documentosVisiveis
        ]
      );

    const statusDisponiveis =
      React.useMemo(
        () => {

          const valores:
            string[] = [];

          documentosVisiveis.forEach(
            item => {

              const valor =
                (
                  item.status ||
                  ''
                ).trim();

              if (
                valor &&
                valores.indexOf(
                  valor
                ) <
                0
              ) {
                valores.push(
                  valor
                );
              }
            }
          );

          return valores.sort();
        },
        [
          documentosVisiveis
        ]
      );

    return (
      <section
        style={{
          color:
            C.azulEscuro
        }}
      >

        {/* SAUDAÇÃO + INDICADORES (mesmo padrão da Visão geral de Treinamentos) */}

        <ResumoModulo
          primeiroNome={primeiroNome}
          mensagem="Aqui está um resumo dos documentos disponíveis para você."
          indicadores={indicadores}
        />

        {/* MINHAS PENDÊNCIAS (só aparece quando existe alguma) */}

        <MinhasPendenciasDocumentos
          pendencias={pendencias.pendencias}
          carregando={pendencias.carregando}
          erro={pendencias.erro}
          onAbrirDocumento={onAbrirDocumento}
        />

        {/* CARTÕES DE ÁREA */}

        <AreasDocumentosCards
          areas={areasVisiveis}
          documentos={documentosVisiveis}
          mostrarTodas={administrador || !contexto}
          areaSelecionadaId={area}
          onSelecionar={setArea}
        />

        {/* FILTROS */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(320px,1fr) 150px 150px 150px',

            gap:
              '9px',

            marginTop:
              '12px'
          }}
        >
          <input
            type="search"
            placeholder="Pesquisar documentos por nome, código ou palavra-chave..."
            value={
              pesquisa
            }
            onChange={
              event =>
                setPesquisa(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          />

          <select
            value={
              area
            }
            onChange={
              event =>
                setArea(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          >
            {
              (administrador || areasVisiveis.length !== 1) &&
              (
                <option value="">
                  {administrador || !contexto ? 'Todas as áreas' : 'Minhas áreas'}
                </option>
              )
            }

            {
              areasVisiveis.map(
                item => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.nome
                    }
                  </option>
                )
              )
            }
          </select>

          <select
            value={
              tipo
            }
            onChange={
              event =>
                setTipo(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          >
            <option value="">
              Todos os tipos
            </option>

            {
              tipos.map(
                item => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {
                      item
                    }
                  </option>
                )
              )
            }
          </select>

          <select
            value={
              status
            }
            onChange={
              event =>
                setStatus(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          >
            <option value="">
              Todos os status
            </option>

            {
              statusDisponiveis.map(
                item => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {
                      item
                    }
                  </option>
                )
              )
            }
          </select>
        </div>

        {
          erro &&
          (
            <div
              style={{
                marginTop:
                  '12px',

                padding:
                  '12px 14px',

                borderRadius:
                  '8px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C',

                fontSize:
                  '13px'
              }}
            >
              {
                erro
              }
            </div>
          )
        }

        {/* PRINCIPAL */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(0,1fr)',

            gap:
              '12px',

            marginTop:
              '12px',

            alignItems:
              'start'
          }}
        >

          <div
            style={{
              display:
                'grid',

              gap:
                '12px'
            }}
          >

            <article
              style={{
                background:
                  C.branco,

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '12px',

                overflow:
                  'hidden'
              }}
            >
              <div
                style={{
                  padding:
                    '12px 14px',

                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'center',

                  borderBottom:
                    '1px solid #E6EDF3'
                }}
              >
                <strong
                  style={{
                    fontSize:
                      '14px',

                    color:
                      C.azulEscuro
                  }}
                >
                  📄 {
                    filtroIndicador
                      ? `Documentos · ${ROTULO_FILTRO_INDICADOR[filtroIndicador]}`
                      : 'Documentos recentes'
                  }

                  {
                    filtroIndicador &&
                    (
                      <button
                        type="button"
                        onClick={() => setFiltroIndicador('')}
                        title="Remover filtro"
                        style={{
                          marginLeft: '10px',
                          padding: '2px 10px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Limpar filtro
                      </button>
                    )
                  }
                </strong>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <label
                    title="Agrupar a lista por área e, dentro dela, por processo"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#202A44',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agrupar}
                      onChange={alternarAgrupar}
                    />
                    Agrupar por área › processo
                  </label>

                  {
                    agrupar && Object.keys(recolhidos).some(chave => recolhidos[chave]) &&
                    (
                      <button
                        type="button"
                        onClick={() => setRecolhidos({})}
                        style={{
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          color: '#0867D7',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        Expandir tudo
                      </button>
                    )
                  }

                  <span
                    style={{
                      color:
                        '#0867D7',

                      fontSize:
                        '11px',

                      fontWeight:
                        700
                    }}
                  >
                    {
                      filtrados.length
                    } encontrado(s)
                  </span>
                </span>
              </div>

              {
                carregando
                  ? (
                    <div
                      style={{
                        padding:
                          '28px',

                        textAlign:
                          'center',

                        color:
                          C.secundario
                      }}
                    >
                      Carregando documentos...
                    </div>
                  )
                  : filtrados.length ===
                      0
                    ? (
                      <div
                        style={{
                          padding:
                            '20px'
                        }}
                      >
                        <EmptyState
                          titulo="Nenhum documento encontrado"
                          descricao={
                            filtroIndicador === 'pendencias'
                              ? 'Você não tem pendências de documentos no momento. 🎉'
                              : 'Ajuste os filtros ou a pesquisa.'
                          }
                        />
                      </div>
                    )
                    : (
                      <div
                        style={{
                          overflowX:
                            'auto'
                        }}
                      >
                        <table
                          style={{
                            width:
                              '100%',

                            borderCollapse:
                              'collapse'
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                background:
                                  '#F1F5F8'
                              }}
                            >
                              <th style={th}>
                                Nome
                              </th>

                              <th style={th}>
                                Código
                              </th>

                              <th style={th}>
                                Tipo
                              </th>

                              <th style={th}>
                                Área
                              </th>

                              <th style={th}>
                                Etapa atual
                              </th>

                              <th
                                style={th}
                                title="Responsável pela etapa atual do fluxo (ou pelo documento, quando não há revisão em andamento)"
                              >
                                Responsável
                              </th>

                              <th style={th}>
                                Revisão
                              </th>

                              <th style={th}>
                                Criado em
                              </th>

                              <th
                                style={th}
                                title="Data limite da próxima revisão periódica (1 ano após a criação ou a última publicação)"
                              >
                                Vencimento
                              </th>

                              <th style={th}>
                                Status
                              </th>

                              <th style={th}>
                                Ações
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {
                              itensTabela.map(
                                item => item.tipo !== 'documento'
                                  ? renderCabecalhoGrupo(item)
                                  : ((documento: IDocumento) => (
                                  <tr
                                    key={
                                      documento.id
                                    }
                                    style={{
                                      borderTop:
                                        '1px solid #EDF1F5'
                                    }}
                                  >
                                    <td style={td}>
                                      <NomeDocumentoCelula
                                        documento={documento}
                                        arquivo={arquivos[guidTela(documento.id)]}
                                        onAbrirDetalhe={onAbrirDocumento}
                                      />
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.codigo ||
                                        '-'
                                      }
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.tipo ||
                                        '-'
                                      }
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.area ||
                                        '-'
                                      }
                                    </td>

                                    {
                                      (() => {
                                        const situacao =
                                          fluxoDocumentos.situacoes[
                                            guidTela(documento.id)
                                          ];
                                        const etapa =
                                          situacao
                                            ? situacao.etapa
                                            : undefined;
                                        // Fluxo encerrado (concluído/cancelado): sem
                                        // etapa a cumprir, mostra o responsável do documento.
                                        const fluxoEncerrado =
                                          !!etapa && !!etapa.encerrado;
                                        const etapaAtiva =
                                          etapa && !fluxoEncerrado
                                            ? etapa
                                            : undefined;
                                        const publicado =
                                          statusEhVigente(documento.status);
                                        const nomeResponsavel =
                                          etapaAtiva && etapaAtiva.responsaveis.length > 0
                                            ? etapaAtiva.responsaveis.join(' · ')
                                            : documento.responsavel;
                                        // "Você" só indica quem é o responsável;
                                        // pendência é apenas a etapa aguardando você.
                                        const souEu =
                                          etapaAtiva
                                            ? etapaAtiva.aguardandoVoce
                                            : !!contexto?.usuarioId &&
                                              guidTela(documento.responsavelId) ===
                                              guidTela(contexto.usuarioId);

                                        return (
                                          <>
                                            <td style={td}>
                                              {
                                                situacao && situacao.emAndamento && !fluxoEncerrado
                                                  ? (
                                                    etapaAtiva
                                                      ? (
                                                        <EtapaFluxoBadge
                                                          etapa={etapaAtiva.etapa}
                                                          aguardandoVoce={etapaAtiva.aguardandoVoce}
                                                          dica={
                                                            etapaAtiva.prazo
                                                              ? `Prazo da etapa: ${formatarDataCurta(etapaAtiva.prazo)}.`
                                                              : undefined
                                                          }
                                                        />
                                                      )
                                                      : (
                                                        <span style={{ color: '#66788A', fontSize: '12px' }}>
                                                          Carregando...
                                                        </span>
                                                      )
                                                  )
                                                  : publicado
                                                    ? (
                                                      <StatusDocumentoBadge
                                                        status="Vigente"
                                                        rotulo="Publicado"
                                                        dica="Documento publicado. Não há ação pendente — o responsável pode iniciar uma nova revisão quando for necessário."
                                                      />
                                                    )
                                                    : fluxoEncerrado && etapa
                                                      ? (
                                                        <EtapaFluxoBadge
                                                          etapa={etapa.etapa}
                                                          encerrado={true}
                                                        />
                                                      )
                                                      : (
                                                        <span style={{ color: '#66788A', fontSize: '12px' }}>
                                                          -
                                                        </span>
                                                      )
                                              }
                                            </td>

                                            <td
                                              style={td}
                                              title={
                                                etapaAtiva && documento.responsavel
                                                  ? `Responsável pelo documento: ${documento.responsavel}`
                                                  : publicado
                                                    ? 'Responsável pelo documento. Pode iniciar uma nova revisão — não é uma pendência.'
                                                    : undefined
                                              }
                                            >
                                              <ResponsavelCelula
                                                nome={nomeResponsavel}
                                                souEu={souEu}
                                              />
                                            </td>

                                            <td style={td}>
                                              {
                                                (situacao && situacao.revisao) ||
                                                documento.revisaoAtual ||
                                                '-'
                                              }
                                            </td>
                                          </>
                                        );
                                      })()
                                    }

                                    <td style={td}>
                                      {formatarDataCurta(documento.criadoEm)}
                                    </td>

                                    <td style={td}>
                                      {
                                        (() => {
                                          const vencimento = vencimentoDocumento(documento);
                                          return (
                                            <PrazoCelula
                                              prazo={vencimento ? vencimento.data : undefined}
                                              origem={vencimento ? vencimento.origem : undefined}
                                              publicado={statusEhVigente(documento.status)}
                                            />
                                          );
                                        })()
                                      }
                                    </td>

                                    <td style={td}>
                                      {
                                        (() => {
                                          const situacao =
                                            fluxoDocumentos.situacoes[
                                              guidTela(documento.id)
                                            ];
                                          const novaRevisao =
                                            statusEhVigente(documento.status) &&
                                            !!situacao &&
                                            situacao.emAndamento &&
                                            !(situacao.etapa && situacao.etapa.encerrado);

                                          return (
                                            <span
                                              style={{
                                                display: 'inline-flex',
                                                flexDirection: 'column',
                                                gap: '3px'
                                              }}
                                            >
                                              <StatusDocumentoBadge
                                                status={documento.status}
                                              />
                                              {
                                                novaRevisao &&
                                                (
                                                  <small
                                                    title="A revisão vigente continua valendo enquanto a nova revisão percorre o fluxo."
                                                    style={{
                                                      color: '#485CC7',
                                                      fontSize: '10.5px',
                                                      fontWeight: 700,
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                  >
                                                    + nova revisão em andamento
                                                  </small>
                                                )
                                              }
                                            </span>
                                          );
                                        })()
                                      }
                                    </td>

                                    <td style={td}>
                                      {
                                        onAbrirDocumento
                                          ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onAbrirDocumento(
                                                  documento
                                                )
                                              }
                                              style={{
                                                border:
                                                  0,

                                                background:
                                                  'transparent',

                                                color:
                                                  C.azul,

                                                fontWeight:
                                                  800,

                                                cursor:
                                                  'pointer',

                                                fontSize:
                                                  '17px'
                                              }}
                                            >
                                              ⋯
                                            </button>
                                          )
                                          : '-'
                                      }
                                    </td>
                                  </tr>
                                  ))(item.documento)
                              )
                            }
                          </tbody>
                        </table>
                      </div>
                    )
              }
            </article>

            {/* TIPO DE DOCUMENTO */}

            <article
              style={{
                padding:
                  '12px',

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '12px',

                background:
                  C.branco
              }}
            >
              <strong
                style={{
                  display:
                    'block',

                  marginBottom:
                    '10px',

                  color:
                    C.azulEscuro,

                  fontSize:
                    '14px'
                }}
              >
                ▰ Navegar por tipo de documento
              </strong>

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    'repeat(6,minmax(120px,1fr))',

                  gap:
                    '8px'
                }}
              >
                {
                  tiposNavegacao.map(
                    item => (
                      <button
                        key={
                          item.titulo
                        }
                        type="button"
                        onClick={() =>
                          setTipo(
                            item.titulo
                          )
                        }
                        style={{
                          minHeight:
                            '86px',

                          display:
                            'grid',

                          gridTemplateColumns:
                            '34px 1fr',

                          gap:
                            '8px',

                          alignItems:
                            'start',

                          padding:
                            '11px',

                          border:
                            `1px solid ${C.borda}`,

                          borderRadius:
                            '9px',

                          background:
                            '#FAFCFE',

                          textAlign:
                            'left',

                          cursor:
                            'pointer'
                        }}
                      >
                        <div
                          style={{
                            width:
                              '34px',

                            height:
                              '34px',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'center',

                            borderRadius:
                              '8px',

                            background:
                              '#EEF5FB',

                            fontSize:
                              '17px'
                          }}
                        >
                          {
                            item.icone
                          }
                        </div>

                        <div>
                          <strong
                            style={{
                              display:
                                'block',

                              color:
                                C.azulEscuro,

                              fontSize:
                                '12px',

                              lineHeight:
                                1.2
                            }}
                          >
                            {
                              item.titulo
                            }
                          </strong>

                          <small
                            style={{
                              display:
                                'block',

                              marginTop:
                                '3px',

                              color:
                                C.secundario,

                              fontSize:
                                '9px',

                              lineHeight:
                                1.3
                            }}
                          >
                            {
                              item.descricao
                            }
                          </small>
                        </div>
                      </button>
                    )
                  )
                }
              </div>
            </article>

          </div>

          {/* Coluna lateral (favoritos e links úteis) removida: a lista ocupa a largura toda. */}
        </div>

      </section>
    );
  };

export default DocumentosHomePage;
