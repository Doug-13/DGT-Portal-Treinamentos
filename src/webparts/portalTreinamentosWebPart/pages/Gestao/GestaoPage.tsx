import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IEventoTreinamento
} from '../../services/TreinamentoHistoricoService';

import HistoricoTreinamentoModal from
  './HistoricoTreinamentoModal';

import MenuAcoes from '../../components/common/MenuAcoes';

import RemoverTreinamentoModal from
  './RemoverTreinamentoModal';

import {
  IImpactoRemocao,
  IOpcoesRemocao
} from '../../services/TreinamentoRemocaoService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IRevisaoTreinamento,
  TreinamentoRevisaoService
} from '../../services/TreinamentoRevisaoService';

import {
  IControleTreinamento,
  TreinamentoDocumentoControleService
} from '../../services/TreinamentoDocumentoControleService';

import {
  CONTROLE_DOCUMENTAL,
  controleDocumentalHabilitado
} from '../../constants/controleDocumental';

import {
  IDocumento
} from '../../models/Documento';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  SharePointDocumentoService
} from '../../services/sharepoint/SharePointDocumentoService';

import {
  IEtapaFluxoTreinamento,
  useEtapasFluxoTreinamentos
} from '../../hooks/useEtapasFluxoTreinamentos';

import EtapaFluxoTreinamentoModal from
  './EtapaFluxoTreinamentoModal';

import {
  ehAdministrador
} from '../../services/DocumentoVisibilidade';

import AnaliseTreinamentoPanel from
  './AnaliseTreinamentoPanel';

import RevisaoTreinamentoModal from
  './RevisaoTreinamentoModal';

// Descrição resumida com "Ver mais" / "Ver menos".
const LIMITE_DESCRICAO = 160;

const DescricaoResumida: React.FC<{
  texto: string;
}> = ({ texto }) => {

  const [aberta, setAberta] = React.useState(false);

  const completo = (texto || '').trim();

  if (!completo) {
    return null;
  }

  const longo = completo.length > LIMITE_DESCRICAO;

  // Corta no último espaço antes do limite, para não partir palavras.
  let resumo = completo;

  if (longo) {
    const corte = completo.lastIndexOf(' ', LIMITE_DESCRICAO);
    resumo = completo.substring(0, corte > 80 ? corte : LIMITE_DESCRICAO).replace(/[\s,.;:-]+$/, '') + '…';
  }

  return (
    <span
      style={{
        display: 'block',
        marginTop: '4px',
        color: '#66788A',
        fontSize: '12px',
        lineHeight: 1.45,
        maxWidth: '460px'
      }}
    >
      {aberta || !longo ? completo : resumo}

      {longo && (
        <button
          type="button"
          onClick={() => setAberta(!aberta)}
          aria-expanded={aberta}
          style={{
            marginLeft: '6px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: '#0B5CAB',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          {aberta ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </span>
  );
};

// Miniatura da capa do treinamento (com alternativa quando a imagem
// não existe ou não pode ser lida pelo usuário).
const CapaMiniatura: React.FC<{
  url: string;
  codigo: string;
}> = ({ url, codigo }) => {

  const [falhou, setFalhou] = React.useState(false);

  React.useEffect(
    () => setFalhou(false),
    [url]
  );

  // Proporção 16:9, a mesma das capas do catálogo.
  const estilo: React.CSSProperties = {
    width: '128px',
    height: '72px',
    borderRadius: '10px',
    flex: '0 0 auto',
    objectFit: 'cover',
    display: 'block'
  };

  if (url && !falhou) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFalhou(true)}
        style={{
          ...estilo,
          border: '1px solid #D8E2EC',
          background: '#F6F9FC'
        }}
      />
    );
  }

  return (
    <div
      title={
        url
          ? 'Não foi possível carregar a imagem (link inválido ou sem permissão de leitura).'
          : 'Treinamento sem imagem.'
      }
      style={{
        ...estilo,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: url
          ? '#FFF4E5'
          : 'linear-gradient(135deg, #0B2D4D, #0B5CAB)',
        color: url
          ? '#B45309'
          : '#FFFFFF',
        fontSize: url
          ? '20px'
          : '11px',
        fontWeight: 700,
        textAlign: 'center',
        padding: '4px',
        boxSizing: 'border-box'
      }}
    >
      {url ? '⚠' : (codigo || 'TRN').split('-').slice(0, 2).join('-')}
    </div>
  );
};

export interface IGestaoPageProps {

  treinamentos:
    ITreinamentoAdmin[];

  carregando:
    boolean;

  erro:
    string;

  processandoId:
    string;

  onNovoTreinamento:
    () => void;

  onAtribuirTreinamento?:
    () => void;

  onTrilhas?:
    () => void;

  onAreas?:
    () => void;

  onEquipe?:
    () => void;

  onEditarTreinamento:
    (
      treinamento:
        ITreinamentoAdmin
    ) => Promise<void>;

  onDefinirAtivo:
    (
      treinamentoId:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  /*
   * Mantidos temporariamente por compatibilidade
   * com o PortalRouter. Não aparecem mais como
   * botões independentes no dashboard.
   */
  onModulos:
    () => void;

  onAvaliacoes:
    () => void;

  onDocumentos?:
    () => void;

  onConformidade?:
    () => void;

  onIndicadores?:
    () => void;

  // Somente Administrador: exibe o botão "Remover".
  onAnalisarRemocao?:
    (
      treinamento:
        ITreinamentoAdmin
    ) => Promise<IImpactoRemocao>;

  onRemoverTreinamento?:
    (
      treinamento:
        ITreinamentoAdmin,
      aoProgredir:
        (mensagem: string) => void,
      // Remoção forçada (Administrador): motivo obrigatório.
      opcoes?:
        IOpcoesRemocao
    ) => Promise<void>;

  // Quando informado, exibe o botão "Testar" (modo de teste).
  onTestarTreinamento?:
    (
      treinamento:
        ITreinamentoAdmin
    ) => void;

  // Quando informado, exibe o botão "Histórico" em cada treinamento.
  onCarregarHistorico?:
    (
      treinamentoId:
        string
    ) => Promise<IEventoTreinamento[]>;

  // Quando informado, habilita "Revisar treinamento" no menu ⋮
  // e mostra a revisão atual (Rev.XX) ao lado do código.
  dataverseService?:
    DataverseService;

  // Nome de quem registra a revisão (auditoria).
  usuarioNome?:
    string;

  // Id (dgt_usuario) de quem está usando a tela: autor da revisão
  // do documento de controle criado pela Gestão.
  usuarioId?:
    string;

  // Controle documental: abre o documento de controle do treinamento
  // (revisões, etapas do fluxo, responsáveis e prazos).
  onAbrirDocumento?:
    (
      documentoId:
        string
    ) => Promise<boolean>;

  // ---- Fluxo de revisão dos treinamentos DENTRO da Gestão ----

  // Documentos de controle (tipo TRN). Ficam fora do módulo
  // Documentos: a gestão deles é feita aqui.
  documentosControle?:
    IDocumento[];

  // Recarrega a lista de documentos (ex.: documento recém-criado).
  onRecarregarDocumentos?:
    () => Promise<void>;

  // Para calcular as pendências (responsáveis por área/perfil).
  contexto?:
    IContextoAcesso;

  usuariosAreas?:
    IUsuarioAreaAdmin[];

  // Anexar arquivo na etapa do fluxo.
  sharePointDocumentoService?:
    SharePointDocumentoService;

  onAbrirProcesso?:
    (
      processoId:
        string
    ) => void;

  // Abre a análise deste treinamento ao entrar na tela (ex.: logo
  // depois de concluir o assistente de criação).
  analiseInicialTreinamentoId?:
    string;

  onAnaliseInicialAberta?:
    () => void;
}

// ============================================================
// PALETA — cores institucionais DGT (Manual MIV_DGT_160420_01)
// + cores de status/categoria, no padrão pedido pelo usuário
// (referência visual anexada), já que o manual oficial da marca
// não define cores de status. Decisão de projeto, não do manual.
// ============================================================

const DGT = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  cinza: '#888B8D',
  cinzaClaro: '#D9D9D6',
  fundoPagina: '#F5F7FA'
};

// Cada ação do dashboard recebe uma cor de categoria (fundo claro +
// ícone saturado), como nos cards de "Acesso rápido" da referência.
const CORES_ACAO = {
  criar: { bg: '#E8F0FE', icon: '#1D4ED8' },
  atribuir: { bg: '#E6F9FC', icon: '#0B8FA6' }, // ciano DGT
  trilhas: { bg: '#F1EEFB', icon: '#6D5BD0' },
  areas: { bg: '#E8EAF8', icon: DGT.indigo }, // índigo oficial DGT
  equipe: { bg: '#FFF4E5', icon: '#C2760C' },
  documentos: { bg: '#E7F5EE', icon: '#15803D' },
  conformidade: { bg: '#DFF6FA', icon: '#0E7490' },
  indicadores: { bg: '#FDE7EF', icon: '#BE185D' }
} as const;

type ChaveCorAcao = keyof typeof CORES_ACAO;

const CORES_STATUS = {
  sucesso: { bg: '#E7F5EE', texto: '#15803D' },
  alerta: { bg: '#FFF4E5', texto: '#B45309' },
  erro: { bg: '#FDECEC', texto: '#C0392B' },
  neutro: { bg: '#F1F5F9', texto: '#64748B' }
};

// ============================================================
// ÍCONES — SVG inline (sem depender de fonte de ícone ou de
// glifos Unicode, que é o motivo de estarem invisíveis hoje).
// ============================================================

const svgBase:
  React.SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const Icones: Record<ChaveCorAcao, React.FC> = {
  criar: () => (
    <svg {...svgBase}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  atribuir: () => (
    <svg {...svgBase}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
      <path d="M15.5 3.5l2 2-4.2 4.2-2.6.6.6-2.6z" />
    </svg>
  ),
  trilhas: () => (
    <svg {...svgBase}>
      <polygon points="12 3 21 8 12 13 3 8 12 3" />
      <polyline points="3 13 12 18 21 13" />
      <polyline points="3 17.5 12 22.5 21 17.5" />
    </svg>
  ),
  areas: () => (
    <svg {...svgBase}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  ),
  equipe: () => (
    <svg {...svgBase}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 14.6c2.9.4 5.3 2.3 5.3 5.4" />
    </svg>
  ),
  documentos: () => (
    <svg {...svgBase}>
      <path d="M7 3h7l4 4v14H7z" />
      <polyline points="14 3 14 7 18 7" />
      <line x1="9.5" y1="12" x2="15.5" y2="12" />
      <line x1="9.5" y1="15.5" x2="15.5" y2="15.5" />
    </svg>
  ),
  conformidade: () => (
    <svg {...svgBase}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  ),
  indicadores: () => (
    <svg {...svgBase}>
      <line x1="5" y1="20" x2="19" y2="20" />
      <rect x="6.5" y="13" width="3" height="7" />
      <rect x="11" y="9" width="3" height="11" />
      <rect x="15.5" y="5" width="3" height="15" />
    </svg>
  )
};

const thStyle:
  React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '.02em',
  textTransform: 'uppercase',
  color: DGT.azul,
  background: '#F5F7FA',
  whiteSpace: 'nowrap'
};

const tdStyle:
  React.CSSProperties = {
  padding: '13px 14px',
  borderTop: `1px solid ${DGT.cinzaClaro}`,
  color: '#334155',
  fontSize: '13px',
  verticalAlign: 'middle'
};

const inputStyle:
  React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  border: `1px solid ${DGT.cinzaClaro}`,
  borderRadius: '8px',
  fontSize: '14px',
  color: DGT.azul
};

const botaoBase:
  React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: '8px',
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: 'pointer'
};

const botaoEditar:
  React.CSSProperties = {
  ...botaoBase,
  border: `1px solid ${DGT.azul}`,
  background: '#FFFFFF',
  color: DGT.azul
};

const Acao:
  React.FC<{
    titulo: string;
    descricao: string;
    corChave: ChaveCorAcao;
    destaque?: boolean;
    onClick: () => void;
  }> = ({
    titulo,
    descricao,
    corChave,
    destaque,
    onClick
  }) => {

    const cor = CORES_ACAO[corChave];
    const IconeAcao = Icones[corChave];

    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '18px',
          textAlign: 'left',
          border: destaque
            ? `1px solid ${DGT.azul}`
            : `1px solid ${DGT.cinzaClaro}`,
          borderRadius: '14px',
          background: destaque ? DGT.azul : '#FFFFFF',
          color: destaque ? '#FFFFFF' : '#1F2937',
          cursor: 'pointer',
          transition: 'box-shadow .15s, transform .15s'
        }}
      >

        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            background: destaque
              ? 'rgba(255,255,255,.16)'
              : cor.bg,
            color: destaque
              ? '#FFFFFF'
              : cor.icon
          }}
        >
          <IconeAcao />
        </div>

        <strong
          style={{
            display: 'block',
            color: destaque ? '#FFFFFF' : DGT.azul,
            fontSize: '15px'
          }}
        >
          {titulo}
        </strong>

        <span
          style={{
            display: 'block',
            marginTop: '6px',
            color: destaque ? 'rgba(255,255,255,.8)' : DGT.cinza,
            fontSize: '12px',
            lineHeight: 1.45
          }}
        >
          {descricao}
        </span>

      </button>
    );
  };

const GestaoPage:
  React.FC<
    IGestaoPageProps
  > = (
    props
  ) => {

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    // ---------------- Revisões ----------------

    const revisaoService =
      React.useMemo(
        () =>
          props.dataverseService
            ? new TreinamentoRevisaoService(
              props.dataverseService
            )
            : undefined,
        [
          props.dataverseService
        ]
      );

    const [
      revisarDe,
      setRevisarDe
    ] =
      React.useState<
        ITreinamentoAdmin | undefined
      >(
        undefined
      );

    // { treinamentoId → revisão atual } (vazio se a tabela ainda
    // não existir: a tela continua funcionando normalmente).
    const [
      revisaoAtual,
      setRevisaoAtual
    ] =
      React.useState<
        Record<string, string>
      >({});

    React.useEffect(
      () => {

        if (
          !revisaoService
        ) {
          return undefined;
        }

        let ativo =
          true;

        revisaoService
          .listarPorTreinamento()
          .then(
            mapa => {

              if (
                !ativo
              ) {
                return;
              }

              const atual:
                Record<string, string> = {};

              Object.keys(
                mapa
              ).forEach(
                id => {
                  atual[id] =
                    mapa[id][0].rotulo;
                }
              );

              setRevisaoAtual(
                atual
              );
            }
          )
          .catch(
            () => undefined
          );

        return () => {
          ativo =
            false;
        };
      },
      [
        revisaoService
      ]
    );

    const chaveTreinamento =
      (
        id: string
      ): string =>
        String(
          id ||
          ''
        )
          .replace(
            /[{}]/g,
            ''
          )
          .toLowerCase();

    const fecharRevisao =
      React.useCallback(
        (): void =>
          setRevisarDe(
            undefined
          ),
        []
      );

    const aoPublicarRevisao =
      React.useCallback(
        (
          revisao:
            IRevisaoTreinamento
        ): void => {

          setRevisaoAtual(
            atual => ({
              ...atual,
              [revisao.treinamentoId]:
                revisao.rotulo
            })
          );
        },
        []
      );

    // ---------------- Controle documental ----------------
    //
    // Cada treinamento é controlado por um documento (mesmo código,
    // tipo TRN) que segue o fluxo do processo de treinamentos.

    const controleService =
      React.useMemo(
        () =>
          props.dataverseService &&
          controleDocumentalHabilitado()
            ? new TreinamentoDocumentoControleService(
              props.dataverseService
            )
            : undefined,
        [
          props.dataverseService
        ]
      );

    // { treinamentoId → documento de controle }
    const [
      controles,
      setControles
    ] =
      React.useState<
        Record<string, IControleTreinamento>
      >({});

    const [
      controleCarregado,
      setControleCarregado
    ] =
      React.useState(
        false
      );

    const [
      processandoControleId,
      setProcessandoControleId
    ] =
      React.useState('');

    // Treinamento vigente sem revisão aberta: a edição exige uma
    // nova revisão no documento de controle.
    const [
      bloqueioEdicao,
      setBloqueioEdicao
    ] =
      React.useState<
        ITreinamentoAdmin | undefined
      >(
        undefined
      );

    const chaveControle =
      props.treinamentos
        .map(
          item =>
            `${item.id}:${item.codigo}:${item.ativo ? 1 : 0}`
        )
        .join('|');

    const carregarControles =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !controleService
          ) {
            return;
          }

          try {
            setControles(
              await controleService
                .mapear(
                  props.treinamentos
                )
            );
          } catch (error) {
            console.error(
              'Não foi possível ler os documentos de controle dos treinamentos:',
              error
            );
          } finally {
            setControleCarregado(
              true
            );
          }
        },
        [
          controleService,
          chaveControle
        ]
      );

    React.useEffect(
      () => {
        carregarControles()
          .catch(
            (error: unknown) =>
              console.error(error)
          );
      },
      [
        carregarControles
      ]
    );

    const controleDe =
      (
        treinamento:
          ITreinamentoAdmin
      ): IControleTreinamento | undefined =>
        controles[
          String(
            treinamento.id ||
            ''
          )
            .replace(
              /[{}]/g,
              ''
            )
            .toLowerCase()
        ];

    // ---------------- Análise do treinamento (fluxo na Gestão) ----

    const [
      analisandoId,
      setAnalisandoId
    ] =
      React.useState('');

    const abrirDocumentoControle =
      React.useCallback(
        async (
          controle:
            IControleTreinamento
        ): Promise<void> => {

          setAnalisandoId(
            controle.treinamentoId
          );

          window.scrollTo(
            0,
            0
          );
        },
        []
      );

    // Documento recém-criado ainda fora da lista: recarrega uma vez
    // (usado pela análise e por "Ver etapa do fluxo").
    const recarregouDocumentoRef =
      React.useRef('');

    // Abertura automática (ex.: fim do assistente de criação).
    React.useEffect(
      () => {
        if (
          props.analiseInicialTreinamentoId
        ) {
          setAnalisandoId(
            props.analiseInicialTreinamentoId
              .replace(
                /[{}]/g,
                ''
              )
              .toLowerCase()
          );

          if (
            props.onAnaliseInicialAberta
          ) {
            props.onAnaliseInicialAberta();
          }
        }
      },
      [
        props.analiseInicialTreinamentoId
      ]
    );

    // Documentos de controle dos treinamentos listados (memorizado:
    // o hook de pendências recarrega sempre que a lista muda).
    const documentosDosTreinamentos =
      React.useMemo(
        (): IDocumento[] => {

          const ids: Record<string, boolean> = {};

          Object.keys(controles).forEach(
            chave => {
              ids[
                controles[chave]
                  .documentoId
              ] = true;
            }
          );

          return (
            props.documentosControle ||
            []
          ).filter(
            documento =>
              ids[
                String(
                  documento.id ||
                  ''
                )
                  .replace(
                    /[{}]/g,
                    ''
                  )
                  .toLowerCase()
              ]
          );
        },
        [
          controles,
          props.documentosControle
        ]
      );

    // Lista estável (evita recarregar as etapas a cada render).
    const usuariosAreas =
      React.useMemo(
        () =>
          props.usuariosAreas ||
          [],
        [
          props.usuariosAreas
        ]
      );

    const areaPorDocumento =
      React.useMemo(
        () => {
          const mapa: Record<string, string> = {};
          documentosDosTreinamentos.forEach(
            documento => {
              mapa[
                String(
                  documento.id ||
                  ''
                )
                  .replace(
                    /[{}]/g,
                    ''
                  )
                  .toLowerCase()
              ] =
                documento.areaId ||
                '';
            }
          );
          return mapa;
        },
        [
          documentosDosTreinamentos
        ]
      );

    // Onde está cada treinamento em revisão: etapa, responsável,
    // prazo e se está aguardando o usuário logado.
    const etapasFluxo =
      useEtapasFluxoTreinamentos(
        controleService
          ? props.dataverseService
          : undefined,
        controles,
        props.contexto,
        usuariosAreas,
        areaPorDocumento
      );

    const etapaDe =
      (
        treinamento:
          ITreinamentoAdmin
      ): IEtapaFluxoTreinamento | undefined =>
        etapasFluxo.etapas[
          String(
            treinamento.id ||
            ''
          )
            .replace(
              /[{}]/g,
              ''
            )
            .toLowerCase()
        ];

    // "Ver etapa do fluxo" (menu ⋮)
    const [
      verEtapaDe,
      setVerEtapaDe
    ] =
      React.useState<
        ITreinamentoAdmin | undefined
      >(
        undefined
      );

    // "Ver etapa do fluxo" de um documento recém-criado (ainda fora
    // da lista): recarrega os documentos uma vez.
    React.useEffect(
      () => {
        if (!verEtapaDe || !props.onRecarregarDocumentos) {
          return;
        }

        const controleModal =
          controleDe(
            verEtapaDe
          );

        if (
          !controleModal ||
          recarregouDocumentoRef.current ===
            controleModal.documentoId ||
          (props.documentosControle || []).some(
            documento =>
              String(documento.id || '').replace(/[{}]/g, '').toLowerCase() ===
              controleModal.documentoId
          )
        ) {
          return;
        }

        recarregouDocumentoRef.current =
          controleModal.documentoId;

        props.onRecarregarDocumentos()
          .catch(
            (error: unknown) =>
              console.error(error)
          );
      },
      [
        verEtapaDe
      ]
    );

    // Ação do fluxo escolhida na lista (botão na coluna Ações).
    const [
      acaoEscolhida,
      setAcaoEscolhida
    ] =
      React.useState<
        { chave: string; rotulo: string } | undefined
      >(
        undefined
      );

    // Administrador global ou administrador do módulo Treinamentos.
    const souAdministrador =
      ehAdministrador(
        props.contexto,
        'treinamentos'
      );

    // Filtro "Aguardando você"
    const [
      somenteAguardando,
      setSomenteAguardando
    ] =
      React.useState(
        false
      );

    const totalAguardando =
      Object.keys(
        etapasFluxo.etapas
      ).filter(
        chave =>
          etapasFluxo.etapas[chave]
            .aguardandoVoce
      ).length;

    const treinamentoAnalisado =
      analisandoId
        ? props.treinamentos.find(
          item =>
            String(
              item.id ||
              ''
            )
              .replace(
                /[{}]/g,
                ''
              )
              .toLowerCase() ===
            analisandoId
        )
        : undefined;

    const controleAnalisado =
      treinamentoAnalisado
        ? controles[
          analisandoId
        ]
        : undefined;

    const documentoAnalisado =
      controleAnalisado
        ? (
          props.documentosControle ||
          []
        ).find(
          documento =>
            String(
              documento.id ||
              ''
            )
              .replace(
                /[{}]/g,
                ''
              )
              .toLowerCase() ===
            controleAnalisado.documentoId
        )
        : undefined;

    React.useEffect(
      () => {
        if (
          controleAnalisado &&
          !documentoAnalisado &&
          props.onRecarregarDocumentos &&
          recarregouDocumentoRef.current !==
            controleAnalisado.documentoId
        ) {
          recarregouDocumentoRef.current =
            controleAnalisado.documentoId;

          props.onRecarregarDocumentos()
            .catch(
              (error: unknown) =>
                console.error(error)
            );
        }
      },
      [
        controleAnalisado,
        documentoAnalisado
      ]
    );

    const aoAlterarFluxo =
      React.useCallback(
        async (): Promise<void> => {
          await carregarControles();
          await etapasFluxo.recarregar();
          if (props.onRecarregarDocumentos) {
            await props.onRecarregarDocumentos();
          }
        },
        [
          carregarControles,
          etapasFluxo.recarregar,
          props.onRecarregarDocumentos
        ]
      );

    // Treinamento sem documento de controle (criado antes desta
    // funcionalidade ou cuja criação falhou):
    //   ativo   → documento nasce VIGENTE na revisão atual;
    //   inativo → documento nasce em Elaboração (Rev.00A) e segue o fluxo.
    const colocarSobControle =
      React.useCallback(
        async (
          treinamento:
            ITreinamentoAdmin
        ): Promise<void> => {

          if (
            !controleService
          ) {
            return;
          }

          const revisao =
            revisaoAtual[
              chaveTreinamento(
                treinamento.id
              )
            ] ||
            'Rev.00';

          const confirmado =
            window.confirm(
              treinamento.ativo
                ? `Vincular ${treinamento.codigo} ao fluxo de treinamentos?\n\n` +
                  `Será criado o documento ${treinamento.codigo} (tipo ${CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO}), já VIGENTE na ${revisao}, ` +
                  `vinculado ao processo ${CONTROLE_DOCUMENTAL.PROCESSO_CODIGO}. ` +
                  'As próximas revisões seguirão o fluxo do processo. Nenhuma conclusão é alterada.'
                : `Vincular ${treinamento.codigo} ao fluxo de treinamentos?\n\n` +
                  `Será criado o documento ${treinamento.codigo} em ${CONTROLE_DOCUMENTAL.REVISAO_INICIAL} (Elaboração), ` +
                  `que seguirá o fluxo do processo ${CONTROLE_DOCUMENTAL.PROCESSO_CODIGO}. ` +
                  'O treinamento continua inativo até a publicação.'
            );

          if (!confirmado) {
            return;
          }

          setProcessandoControleId(
            treinamento.id
          );

          try {
            // O vínculo com o fluxo é obrigatório: confere antes.
            await controleService
              .verificarPreRequisitos();

            const resultado =
              await controleService
                .garantirDocumentoControle(
                  treinamento.id,
                  {
                    id:
                      props.usuarioId ||
                      '',
                    nome:
                      props.usuarioNome ||
                      ''
                  },
                  treinamento.ativo
                    ? {
                      jaVigenteNaRevisao:
                        revisao,
                      exigirFluxo:
                        true
                    }
                    : {
                      exigirFluxo:
                        true
                    }
                );

            await carregarControles();

            window.alert(
              [
                resultado.criado
                  ? `${resultado.codigo} vinculado ao fluxo de treinamentos.`
                  : `${resultado.codigo} já tinha documento de controle; os vínculos com o fluxo foram conferidos.`,
                resultado.processoNome
                  ? `Processo: ${resultado.processoNome}.`
                  : '',
                ...resultado.avisos
              ]
                .filter(item => !!item)
                .join('\n\n')
            );
          } catch (error) {
            window.alert(
              error instanceof Error
                ? error.message
                : 'Não foi possível criar o documento de controle.'
            );
          } finally {
            setProcessandoControleId(
              ''
            );
          }
        },
        [
          controleService,
          carregarControles,
          revisaoAtual,
          props.usuarioId,
          props.usuarioNome
        ]
      );

    const editarTreinamento =
      (
        treinamento:
          ITreinamentoAdmin
      ): void => {

        const controle =
          controleDe(
            treinamento
          );

        // Vigente e sem revisão aberta: alterar o conteúdo sem revisão
        // quebraria a rastreabilidade (quem foi treinado em quê).
        if (
          controle &&
          controle.vigente &&
          !controle.revisaoEmAndamento
        ) {
          setBloqueioEdicao(
            treinamento
          );
          return;
        }

        void props
          .onEditarTreinamento(
            treinamento
          )
          .catch(
            (
              error:
                unknown
            ) =>
              console.error(
                'Erro ao abrir edição do treinamento:',
                error
              )
          );
      };

    // ---------------- Remoção ----------------

    const [
      removerDe,
      setRemoverDe
    ] =
      React.useState<
        ITreinamentoAdmin | undefined
      >(
        undefined
      );

    // ---------------- Histórico ----------------

    const [
      historicoDe,
      setHistoricoDe
    ] =
      React.useState<
        ITreinamentoAdmin | undefined
      >(
        undefined
      );

    const [
      eventosHistorico,
      setEventosHistorico
    ] =
      React.useState<
        IEventoTreinamento[]
      >([]);

    const [
      carregandoHistorico,
      setCarregandoHistorico
    ] =
      React.useState(
        false
      );

    const [
      erroHistorico,
      setErroHistorico
    ] =
      React.useState('');

    const carregarHistorico =
      React.useCallback(
        async (
          treinamento:
            ITreinamentoAdmin
        ): Promise<void> => {

          if (!props.onCarregarHistorico) {
            return;
          }

          setCarregandoHistorico(
            true
          );

          setErroHistorico('');

          try {

            const eventos =
              await props
                .onCarregarHistorico(
                  treinamento.id
                );

            setEventosHistorico(
              eventos
            );

          } catch (e) {

            setEventosHistorico([]);

            setErroHistorico(
              e instanceof Error
                ? e.message
                : 'Não foi possível carregar o histórico.'
            );

          } finally {

            setCarregandoHistorico(
              false
            );
          }
        },
        [
          props.onCarregarHistorico
        ]
      );

    const abrirHistorico =
      (
        treinamento:
          ITreinamentoAdmin
      ): void => {

        setHistoricoDe(
          treinamento
        );

        setEventosHistorico([]);

        void carregarHistorico(
          treinamento
        );
      };

    const filtrados =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          const chaveId =
            (
              item:
                ITreinamentoAdmin
            ): string =>
              String(
                item.id ||
                ''
              )
                .replace(
                  /[{}]/g,
                  ''
                )
                .toLowerCase();

          const aguardando =
            (
              item:
                ITreinamentoAdmin
            ): boolean => {
              const etapa =
                etapasFluxo.etapas[
                  chaveId(
                    item
                  )
                ];
              return !!etapa &&
                etapa.aguardandoVoce;
            };

          // Os que aguardam uma ação do usuário vêm primeiro.
          const base =
            props
              .treinamentos
              .filter(
                item =>
                  !somenteAguardando ||
                  aguardando(
                    item
                  )
              )
              .slice()
              .sort(
                (a, b) =>
                  Number(
                    aguardando(
                      b
                    )
                  ) -
                  Number(
                    aguardando(
                      a
                    )
                  )
              );

          if (!termo) {
            return base;
          }

          return base
            .filter(
              item =>
                item.nome
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.codigo
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.descricao
                  .toLowerCase()
                  .includes(
                    termo
                  )
            );

        },
        [
          pesquisa,
          props.treinamentos,
          etapasFluxo.etapas,
          somenteAguardando
        ]
      );

    if (
      analisandoId
    ) {
      return (
        <section>

          <PageHeader
            titulo="Gestão de treinamentos"
            subtitulo="Análise do treinamento: fluxo de revisão, etapas, responsáveis e prazos."
          />

          {
            !treinamentoAnalisado ||
            !controleAnalisado
              ? (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '18px 20px'
                  }}
                >
                  {
                    controleCarregado
                      ? 'Este treinamento não tem documento de controle. Use o menu ⋮ → "Colocar sob controle documental".'
                      : 'Carregando...'
                  }

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      style={botaoEditar}
                      onClick={() =>
                        setAnalisandoId(
                          ''
                        )
                      }
                    >
                      Voltar à Gestão
                    </button>
                  </div>
                </div>
              )
              : !documentoAnalisado
                ? (
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '18px 20px'
                    }}
                  >
                    Carregando o documento {controleAnalisado.codigo}...
                  </div>
                )
                : (
                  <AnaliseTreinamentoPanel
                    treinamento={
                      treinamentoAnalisado
                    }
                    documento={
                      documentoAnalisado
                    }
                    contexto={
                      props.contexto
                    }
                    dataverseService={
                      props.dataverseService
                    }
                    sharePointDocumentoService={
                      props.sharePointDocumentoService
                    }
                    onVoltar={() => {
                      setAnalisandoId(
                        ''
                      );
                      void aoAlterarFluxo();
                    }}
                    onAlterado={
                      aoAlterarFluxo
                    }
                    onEditarConteudo={
                      props.onEditarTreinamento
                    }
                    onTestarTreinamento={
                      props.onTestarTreinamento
                    }
                    onAbrirProcesso={
                      props.onAbrirProcesso
                    }
                  />
                )
          }
        </section>
      );
    }

    return (
      <section>

        <PageHeader
          titulo="Gestão de treinamentos"
          subtitulo="Cadastre treinamentos por um fluxo simples e linear. Módulos e avaliação são configurados automaticamente após o cadastro."
        />

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',

            gap:
              '14px',

            marginBottom:
              '28px'
          }}
        >

          <Acao
            titulo="Criar treinamento"
            descricao="Fluxo guiado: treinamento → módulos → avaliação."
            corChave="criar"
            destaque
            onClick={
              props.onNovoTreinamento
            }
          />

          {props.onAtribuirTreinamento && (
            <Acao
              titulo="Atribuir treinamento"
              descricao="Atribua treinamentos diretamente."
              corChave="atribuir"
              onClick={
                props.onAtribuirTreinamento
              }
            />
          )}

          {props.onTrilhas && (
            <Acao
              titulo="Gerenciar trilhas"
              descricao="Organize cursos, sequência e pré-requisitos."
              corChave="trilhas"
              onClick={
                props.onTrilhas
              }
            />
          )}

          {props.onAreas && (
            <Acao
              titulo="Áreas e acessos"
              descricao="Gerencie áreas, usuários e perfis de acesso."
              corChave="areas"
              onClick={
                props.onAreas
              }
            />
          )}

          {props.onEquipe && (
            <Acao
              titulo="Minha equipe"
              descricao="Acompanhe progresso e pendências."
              corChave="equipe"
              onClick={
                props.onEquipe
              }
            />
          )}

          {props.onDocumentos && (
            <Acao
              titulo="Documentos"
              descricao="Gerencie documentos, revisões e retreinamentos."
              corChave="documentos"
              onClick={
                props.onDocumentos
              }
            />
          )}

          {props.onConformidade && (
            <Acao
              titulo="Conformidade"
              descricao="Acompanhe concluídos, pendentes e vencidos."
              corChave="conformidade"
              onClick={
                props.onConformidade
              }
            />
          )}

          {props.onIndicadores && (
            <Acao
              titulo="Indicadores"
              descricao="Acompanhe conformidade, vencimentos e desempenho."
              corChave="indicadores"
              onClick={
                props.onIndicadores
              }
            />
          )}

        </div>


        <div
          style={{
            background:
              '#ffffff',

            border:
              `1px solid ${DGT.cinzaClaro}`,

            borderRadius:
              '14px',

            overflow:
              'hidden'
          }}
        >

          <div
            style={{
              padding:
                '18px',

              borderBottom:
                `1px solid ${DGT.cinzaClaro}`,

              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              gap:
                '15px',

              flexWrap:
                'wrap'
            }}
          >

            <div>

              <strong
                style={{
                  display:
                    'block',

                  color:
                    DGT.azul,

                  fontSize:
                    '16px'
                }}
              >
                Treinamentos cadastrados
              </strong>

              <span
                style={{
                  display:
                    'block',

                  marginTop:
                    '4px',

                  color:
                    DGT.cinza,

                  fontSize:
                    '12px'
                }}
              >
                {
                  props
                    .treinamentos
                    .length
                } treinamento(s)
              </span>

            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
            {
              controleService &&
              totalAguardando > 0 &&
              (
                <button
                  type="button"
                  onClick={() =>
                    setSomenteAguardando(
                      !somenteAguardando
                    )
                  }
                  title="Treinamentos com uma etapa do fluxo aguardando você"
                  style={{
                    border: `1px solid ${DGT.ciano}`,
                    background: somenteAguardando
                      ? DGT.ciano
                      : '#E6F9FC',
                    color: DGT.azul,
                    borderRadius: '999px',
                    padding: '7px 12px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {somenteAguardando ? '✓ ' : ''}Aguardando você ({totalAguardando})
                </button>
              )
            }

            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                ...inputStyle,

                maxWidth:
                  '320px'
              }}
            />
            </div>

          </div>

          {props.erro && (
            <div
              style={{
                margin:
                  '16px',

                padding:
                  '12px',

                background:
                  CORES_STATUS.erro.bg,

                color:
                  CORES_STATUS.erro.texto,

                borderRadius:
                  '8px'
              }}
            >
              {props.erro}
            </div>
          )}

          {props.carregando ? (
            <div
              style={{
                padding:
                  '30px',

                textAlign:
                  'center',

                color:
                  DGT.cinza
              }}
            >
              Carregando treinamentos...
            </div>
          ) : (
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
                  <tr>
                    <th style={thStyle}>
                      Código
                    </th>

                    <th style={thStyle}>
                      Treinamento
                    </th>

                    <th style={thStyle}>
                      Carga
                    </th>

                    <th style={thStyle}>
                      Nota
                    </th>

                    <th style={thStyle}>
                      Validade
                    </th>

                    <th style={thStyle}>
                      Status
                    </th>

                    <th style={thStyle}>
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map(
                    treinamento => {

                      const processando =
                        props.processandoId ===
                          treinamento.id ||
                        processandoControleId ===
                          treinamento.id;

                      const controle =
                        controleDe(
                          treinamento
                        );

                      const etapa =
                        etapaDe(
                          treinamento
                        );

                      // Destaque: etapa do fluxo aguardando o usuário.
                      const aguardandoVoce =
                        !!etapa &&
                        etapa.aguardandoVoce;

                      return (
                        <tr
                          key={
                            treinamento.id
                          }
                          style={
                            aguardandoVoce
                              ? {
                                background: '#E6F9FC',
                                boxShadow: `inset 4px 0 0 ${DGT.ciano}`
                              }
                              : undefined
                          }
                        >
                          <td style={tdStyle}>
                            <strong>
                              {
                                treinamento.codigo ||
                                '-'
                              }
                            </strong>

                            {
                              (revisaoService || controleDe(treinamento)) &&
                              (
                                <span
                                  title="Revisão atual do treinamento"
                                  style={{
                                    display:
                                      'inline-block',
                                    marginLeft:
                                      '6px',
                                    padding:
                                      '1px 7px',
                                    borderRadius:
                                      '999px',
                                    background:
                                      '#EDF0F5',
                                    color:
                                      '#202A44',
                                    fontSize:
                                      '10.5px',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  {
                                    (() => {
                                      const controle =
                                        controleDe(
                                          treinamento
                                        );

                                      if (controle) {
                                        return controle.revisaoVigente ||
                                          (controle.revisaoEmAndamento
                                            ? controle.revisaoEmAndamento.revisao
                                            : CONTROLE_DOCUMENTAL.REVISAO_INICIAL);
                                      }

                                      return revisaoAtual[
                                        chaveTreinamento(
                                          treinamento.id
                                        )
                                      ] ||
                                        'Rev.00';
                                    })()
                                  }
                                </span>
                              )
                            }
                          </td>

                          <td style={tdStyle}>
                            <div
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '14px',

                                alignItems:
                                  'center'
                              }}
                            >
                            <CapaMiniatura
                              url={
                                treinamento.imagemUrl
                              }
                              codigo={
                                treinamento.codigo
                              }
                            />

                            <div>
                            <strong
                              style={{
                                color:
                                  DGT.azul
                              }}
                            >
                              {
                                treinamento.nome
                              }
                            </strong>

                            <DescricaoResumida
                              texto={
                                treinamento.descricao
                              }
                            />
                            </div>
                            </div>
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .cargaHorariaMin
                            } min
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .notaMinima
                            }%
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .validadeMeses >
                                0
                                ? `${treinamento.validadeMeses} meses`
                                : 'Sem validade'
                            }
                          </td>

                          <td style={tdStyle}>
                            <span
                              style={{
                                display:
                                  'inline-block',

                                padding:
                                  '5px 9px',

                                borderRadius:
                                  '20px',

                                background:
                                  treinamento.ativo
                                    ? CORES_STATUS.sucesso.bg
                                    : CORES_STATUS.neutro.bg,

                                color:
                                  treinamento.ativo
                                    ? CORES_STATUS.sucesso.texto
                                    : CORES_STATUS.neutro.texto,

                                fontSize:
                                  '12px',

                                fontWeight:
                                  700
                              }}
                            >
                              {
                                treinamento.ativo
                                  ? 'Ativo'
                                  : 'Inativo'
                              }
                            </span>

                            {
                              (() => {
                                const controle =
                                  controleDe(
                                    treinamento
                                  );

                                if (
                                  controleService &&
                                  controleCarregado &&
                                  !controle
                                ) {
                                  return (
                                    <div
                                      title="Este treinamento não está vinculado ao fluxo de treinamentos: use o botão Vincular ao fluxo"
                                      style={{
                                        marginTop: '5px',
                                        fontSize: '11px',
                                        color: '#B45309',
                                        fontWeight: 700
                                      }}
                                    >
                                      ⚠ Fora do fluxo de treinamentos
                                    </div>
                                  );
                                }

                                if (
                                  !controle ||
                                  !controle.revisaoEmAndamento
                                ) {
                                  return null;
                                }

                                const prazoVencido =
                                  !!etapa &&
                                  !!etapa.prazo &&
                                  new Date(
                                    etapa.prazo.length === 10
                                      ? `${etapa.prazo}T23:59:59`
                                      : etapa.prazo
                                  ).getTime() < Date.now();

                                return (
                                  <div
                                    style={{
                                      marginTop: '5px',
                                      fontSize: '11px',
                                      lineHeight: 1.45,
                                      color: CORES_STATUS.neutro.texto
                                    }}
                                  >
                                    {
                                      aguardandoVoce &&
                                      (
                                        <div
                                          style={{
                                            display: 'inline-block',
                                            marginBottom: '3px',
                                            padding: '2px 8px',
                                            borderRadius: '20px',
                                            background: DGT.azul,
                                            color: '#FFFFFF',
                                            fontWeight: 700
                                          }}
                                        >
                                          Aguardando você
                                        </div>
                                      )
                                    }

                                    <div>
                                      {controle.revisaoEmAndamento.revisao}
                                      {' · '}
                                      {etapa ? etapa.etapa : controle.revisaoEmAndamento.status || 'Elaboração'}
                                    </div>

                                    {
                                      etapa &&
                                      etapa.responsaveis.length > 0 &&
                                      (
                                        <div
                                          title={etapa.responsaveis.join(' · ')}
                                          style={{
                                            maxWidth: '220px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          Resp.: {etapa.responsaveis.join(' · ')}
                                        </div>
                                      )
                                    }

                                    {
                                      prazoVencido &&
                                      etapa &&
                                      etapa.prazo &&
                                      (
                                        <div
                                          style={{
                                            color: CORES_STATUS.erro.texto,
                                            fontWeight: 700
                                          }}
                                        >
                                          Prazo vencido
                                        </div>
                                      )
                                    }
                                  </div>
                                );
                              })()
                            }
                          </td>

                          <td style={tdStyle}>
                            <div
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '7px',

                                flexWrap:
                                  'nowrap',

                                alignItems:
                                  'center'
                              }}
                            >
                              {
                                // Treinamento sob controle documental: no
                                // lugar de "Editar", os botões da etapa
                                // atual do fluxo (ex.: "Enviar para
                                // Avaliação"). A edição do conteúdo fica
                                // no menu ⋮, com revisão em andamento.
                                controleService &&
                                controle
                                  ? (() => {

                                    if (
                                      !controle.revisaoEmAndamento
                                    ) {
                                      return (
                                        <button
                                          type="button"
                                          disabled={processando}
                                          title="Abrir uma nova revisão do treinamento (segue o fluxo do processo)"
                                          onClick={() =>
                                            setAnalisandoId(
                                              String(treinamento.id || '').replace(/[{}]/g, '').toLowerCase()
                                            )
                                          }
                                          style={{
                                            ...botaoEditar,
                                            whiteSpace: 'nowrap',
                                            opacity: processando ? .6 : 1
                                          }}
                                        >
                                          Nova revisão
                                        </button>
                                      );
                                    }

                                    const podeAgirNaEtapa =
                                      !!etapa &&
                                      etapa.acoes.length > 0 &&
                                      (
                                        etapa.aguardandoVoce ||
                                        souAdministrador
                                      );

                                    if (
                                      !podeAgirNaEtapa ||
                                      !etapa
                                    ) {
                                      return (
                                        <button
                                          type="button"
                                          disabled={processando}
                                          title={
                                            etapa && etapa.responsaveis.length > 0
                                              ? `Aguardando: ${etapa.responsaveis.join(' · ')}`
                                              : 'Ver a etapa atual do fluxo'
                                          }
                                          onClick={() => {
                                            setAcaoEscolhida(
                                              undefined
                                            );
                                            setVerEtapaDe(
                                              treinamento
                                            );
                                          }}
                                          style={{
                                            ...botaoEditar,
                                            whiteSpace: 'nowrap',
                                            opacity: processando ? .6 : 1
                                          }}
                                        >
                                          Ver etapa
                                        </button>
                                      );
                                    }

                                    return (
                                      <div
                                        style={{
                                          display: 'flex',
                                          gap: '6px',
                                          flexWrap: 'wrap'
                                        }}
                                      >
                                        {
                                          etapa.acoes.map(
                                            acao => (
                                              <button
                                                key={acao.chave}
                                                type="button"
                                                disabled={processando}
                                                title={`${etapa.etapa}: ${acao.rotulo}`}
                                                onClick={() => {
                                                  setAcaoEscolhida({
                                                    chave: acao.chave,
                                                    rotulo: acao.rotulo
                                                  });
                                                  setVerEtapaDe(
                                                    treinamento
                                                  );
                                                }}
                                                style={{
                                                  ...botaoEditar,
                                                  whiteSpace: 'nowrap',
                                                  background: acao.principal
                                                    ? DGT.azul
                                                    : '#FFFFFF',
                                                  color: acao.principal
                                                    ? '#FFFFFF'
                                                    : DGT.azul,
                                                  opacity: processando ? .6 : 1
                                                }}
                                              >
                                                {acao.rotulo}
                                              </button>
                                            )
                                          )
                                        }
                                      </div>
                                    );
                                  })()
                                  : controleService &&
                                    controleCarregado &&
                                    !controle
                                    ? (
                                      // Fora do fluxo: antes de qualquer
                                      // ação, o treinamento precisa ser
                                      // vinculado ao fluxo de treinamentos.
                                      <button
                                        type="button"
                                        disabled={
                                          processando
                                        }
                                        onClick={() => {
                                          void colocarSobControle(
                                            treinamento
                                          );
                                        }}
                                        title="Este treinamento está fora do fluxo de treinamentos. Vincule-o para editar, revisar ou ativar."
                                        style={{
                                          ...botaoEditar,
                                          background: DGT.azul,
                                          color: '#FFFFFF',
                                          opacity: processando ? .6 : 1
                                        }}
                                      >
                                        Vincular ao fluxo
                                      </button>
                                    )
                                    : (
                                      <button
                                        type="button"
                                        disabled={
                                          processando
                                        }
                                        onClick={() =>
                                          editarTreinamento(
                                            treinamento
                                          )
                                        }
                                        style={{
                                          ...botaoEditar,
                                          opacity: processando ? .6 : 1
                                        }}
                                      >
                                        Editar
                                      </button>
                                    )
                              }

                              {props.onTestarTreinamento && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (props.onTestarTreinamento) {
                                      props.onTestarTreinamento(
                                        treinamento
                                      );
                                    }
                                  }}
                                  title="Percorrer o treinamento como colaborador, sem gerar registros"
                                  style={
                                    botaoEditar
                                  }
                                >
                                  Testar
                                </button>
                              )}

                              {/* Ações secundárias no menu ⋮ */}
                              <MenuAcoes
                                desabilitado={
                                  processando
                                }
                                rotulo={
                                  `Mais ações de ${treinamento.codigo || treinamento.nome}`
                                }
                                itens={[
                                  ...(
                                    controleService &&
                                    controle
                                      ? [
                                        {
                                          rotulo:
                                            'Ver etapa do fluxo',

                                          titulo:
                                            controle.revisaoEmAndamento
                                              ? 'Onde o treinamento está no fluxo: etapa, responsável e prazo'
                                              : 'Nenhuma revisão em andamento',

                                          desabilitado:
                                            !controle.revisaoEmAndamento,

                                          onClick: () => {
                                            setAcaoEscolhida(
                                              undefined
                                            );
                                            setVerEtapaDe(
                                              treinamento
                                            );
                                          }
                                        },
                                        {
                                          rotulo:
                                            'Editar treinamento',

                                          titulo:
                                            controle.revisaoEmAndamento
                                              ? `Alterar dados, módulos e avaliação na ${controle.revisaoEmAndamento.revisao}`
                                              : 'Abra uma nova revisão para alterar o treinamento',

                                          onClick: () =>
                                            editarTreinamento(
                                              treinamento
                                            )
                                        }
                                      ]
                                      : []
                                  ),

                                  ...(
                                    controleService &&
                                    controle
                                      ? [
                                        {
                                          rotulo:
                                            controle.revisaoEmAndamento
                                              ? 'Revisões do treinamento'
                                              : 'Revisões / nova revisão',

                                          titulo:
                                            controle.revisaoEmAndamento
                                              ? 'Ver a etapa atual do fluxo, responsáveis, prazo e histórico'
                                              : 'Ver revisões e abrir uma nova revisão, que seguirá o fluxo do processo',

                                          onClick: () => {
                                            void abrirDocumentoControle(
                                              controle
                                            );
                                          }
                                        }
                                      ]
                                      : []
                                  ),

                                  ...(
                                    controleService &&
                                    controleCarregado &&
                                    !controle
                                      ? [
                                        {
                                          rotulo:
                                            'Vincular ao fluxo de treinamentos',

                                          titulo:
                                            `Criar o documento de controle e vincular ao processo ${CONTROLE_DOCUMENTAL.PROCESSO_CODIGO}`,

                                          onClick: () => {
                                            void colocarSobControle(
                                              treinamento
                                            );
                                          }
                                        }
                                      ]
                                      : []
                                  ),

                                  ...(
                                    revisaoService &&
                                    !controleService
                                      ? [
                                        {
                                          rotulo:
                                            'Revisar treinamento',

                                          titulo:
                                            'Registrar uma nova revisão, com ou sem retreinamento de quem já concluiu',

                                          onClick: () =>
                                            setRevisarDe(
                                              treinamento
                                            )
                                        }
                                      ]
                                      : []
                                  ),

                                  ...(
                                    props.onCarregarHistorico
                                      ? [
                                        {
                                          rotulo:
                                            'Histórico',

                                          onClick: () =>
                                            abrirHistorico(
                                              treinamento
                                            )
                                        }
                                      ]
                                      : []
                                  ),

                                  {
                                    rotulo:
                                      treinamento.ativo
                                        ? 'Desativar'
                                        : 'Ativar',

                                    sucesso:
                                      !treinamento.ativo,

                                    // Controle documental: ativa somente
                                    // depois da publicação pelo fluxo.
                                    desabilitado:
                                      !treinamento.ativo &&
                                      !!controleService &&
                                      (!controle || !controle.vigente),

                                    titulo:
                                      !treinamento.ativo && !!controleService && !controle
                                        ? 'Vincule o treinamento ao fluxo de treinamentos antes de ativá-lo'
                                        : !treinamento.ativo &&
                                          !!controle &&
                                          !controle.vigente
                                          ? `O treinamento é ativado automaticamente quando o documento ${controle.codigo} for publicado pelo fluxo`
                                          : undefined,

                                    onClick: () => {
                                      props
                                        .onDefinirAtivo(
                                          treinamento.id,
                                          !treinamento.ativo
                                        )
                                        .catch(
                                          (
                                            error:
                                              unknown
                                          ) =>
                                            console.error(
                                              error
                                            )
                                        );
                                    }
                                  },

                                  ...(
                                    props.onAnalisarRemocao &&
                                    props.onRemoverTreinamento
                                      ? [
                                        {
                                          rotulo:
                                            'Remover',

                                          perigo:
                                            true,

                                          titulo:
                                            'Excluir definitivamente (somente treinamentos nunca atribuídos)',

                                          onClick: () =>
                                            setRemoverDe(
                                              treinamento
                                            )
                                        }
                                      ]
                                      : []
                                  )
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>  

        {props.onAnalisarRemocao &&
          props.onRemoverTreinamento && (
          <RemoverTreinamentoModal
            treinamento={
              removerDe
            }
            onAnalisar={
              props.onAnalisarRemocao
            }
            onRemover={
              props.onRemoverTreinamento
            }
            onFechar={() =>
              setRemoverDe(
                undefined
              )
            }
          />
        )}

        {
          revisaoService &&
          (
            <RevisaoTreinamentoModal
              treinamento={
                revisarDe
                  ? {
                    id:
                      revisarDe.id,
                    codigo:
                      revisarDe.codigo ||
                      '',
                    nome:
                      revisarDe.nome
                  }
                  : undefined
              }
              service={
                revisaoService
              }
              responsavel={
                props.usuarioNome ||
                ''
              }
              onEditar={
                revisarDe
                  ? () => {
                    const alvo =
                      revisarDe;

                    setRevisarDe(
                      undefined
                    );

                    props
                      .onEditarTreinamento(
                        alvo
                      )
                      .catch(
                        (
                          error:
                            unknown
                        ) =>
                          console.error(
                            error
                          )
                      );
                  }
                  : undefined
              }
              onFechar={
                fecharRevisao
              }
              onPublicada={
                aoPublicarRevisao
              }
            />
          )
        }

        {
          bloqueioEdicao &&
          (() => {
            const controle =
              controleDe(
                bloqueioEdicao
              );

            return (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1000,
                  background: 'rgba(32, 42, 68, .45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '520px',
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '22px',
                    boxShadow: '0 20px 50px rgba(0,0,0,.2)'
                  }}
                >
                  <h2
                    style={{
                      margin: '0 0 10px',
                      color: DGT.azul,
                      fontSize: '18px'
                    }}
                  >
                    Alteração exige nova revisão
                  </h2>

                  <p
                    style={{
                      margin: '0 0 8px',
                      color: '#344054',
                      lineHeight: 1.5
                    }}
                  >
                    <strong>{bloqueioEdicao.codigo}</strong> está vigente
                    {controle && controle.revisaoVigente ? ` na ${controle.revisaoVigente}` : ''}.
                    Para alterar dados, módulos ou avaliação, abra uma nova revisão
                    no documento de controle. A revisão seguirá o fluxo do processo
                    (responsáveis, prazos e decisão de retreinamento) e as conclusões
                    anteriores ficam preservadas no histórico.
                  </p>

                  <p
                    style={{
                      margin: '0 0 18px',
                      color: CORES_STATUS.neutro.texto,
                      fontSize: '13px'
                    }}
                  >
                    Na análise do treinamento, use &quot;Nova revisão&quot; e depois &quot;Editar conteúdo&quot;.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setBloqueioEdicao(
                          undefined
                        )
                      }
                      style={botaoEditar}
                    >
                      Cancelar
                    </button>

                    {controle && (
                      <button
                        type="button"
                        onClick={() => {
                          setBloqueioEdicao(
                            undefined
                          );

                          void abrirDocumentoControle(
                            controle
                          );
                        }}
                        style={{
                          ...botaoEditar,
                          background: DGT.azul,
                          color: '#FFFFFF'
                        }}
                      >
                        Abrir análise do treinamento
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        }

        {
          verEtapaDe &&
          controleDe(
            verEtapaDe
          ) &&
          (() => {
            const controleModal =
              controleDe(
                verEtapaDe
              ) as IControleTreinamento;

            return (
              <EtapaFluxoTreinamentoModal
                treinamento={
                  verEtapaDe
                }
                controle={
                  controleModal
                }
                etapa={
                  etapaDe(
                    verEtapaDe
                  )
                }
                documento={
                  (
                    props.documentosControle ||
                    []
                  ).find(
                    documento =>
                      String(
                        documento.id ||
                        ''
                      )
                        .replace(
                          /[{}]/g,
                          ''
                        )
                        .toLowerCase() ===
                      controleModal.documentoId
                  )
                }
                contexto={
                  props.contexto
                }
                dataverseService={
                  props.dataverseService
                }
                sharePointDocumentoService={
                  props.sharePointDocumentoService
                }
                acaoChave={
                  acaoEscolhida
                    ? acaoEscolhida.chave
                    : undefined
                }
                acaoRotulo={
                  acaoEscolhida
                    ? acaoEscolhida.rotulo
                    : undefined
                }
                onFechar={() => {
                  setVerEtapaDe(
                    undefined
                  );
                  setAcaoEscolhida(
                    undefined
                  );
                }}
                onAlterado={
                  aoAlterarFluxo
                }
                onAbrirProcesso={
                  props.onAbrirProcesso
                }
              />
            );
          })()
        }

        <HistoricoTreinamentoModal
          aberto={
            !!historicoDe
          }
          treinamentoNome={
            historicoDe?.nome || ''
          }
          treinamentoCodigo={
            historicoDe?.codigo || ''
          }
          carregando={
            carregandoHistorico
          }
          erro={
            erroHistorico
          }
          eventos={
            eventosHistorico
          }
          onFechar={() =>
            setHistoricoDe(
              undefined
            )
          }
          onRecarregar={() => {
            if (historicoDe) {
              void carregarHistorico(
                historicoDe
              );
            }
          }}
        />

      </section>
    );
  };

export default GestaoPage;