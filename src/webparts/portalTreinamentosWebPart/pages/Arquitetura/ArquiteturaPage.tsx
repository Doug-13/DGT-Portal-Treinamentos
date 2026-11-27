import * as React from 'react';

import {
  SPHttpClient
} from '@microsoft/sp-http';
import * as ReactDOM from 'react-dom';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  AreaAdminService
} from '../../services/AreaAdminService';

import {
  BomService,
  EtapaBom,
  IAnaliseGoNoGo,
  IBomRegistro,
  ICriterioGoNoGo,
  IDemandaBom,
  IVisaoGeralBom,
  etapaCalculada
} from '../../services/bom/BomService';

import DadosDemandaEtapa, {
  IUsuarioOpcao
} from './DadosDemandaEtapa';

import MatrizGoNoGoEtapa from './MatrizGoNoGoEtapa';

import SelecaoKitEtapa from './SelecaoKitEtapa';

import {
  IBomEnviado,
  ISelecaoKit,
  montarBom
} from '../../services/bom/montadorBom';

import {
  ICatalogoKitsCarregado,
  garantirCatalogoKitsAplicado
} from '../../services/bom/KitsService';

import EtapaHHBom from './EtapaHHBom';

import {
  IComplementosHH,
  pendenciasComplementos
} from '../../services/hh/complementosHH';

import EtapaBomPronto from './EtapaBomPronto';

import {
  BomFluxoService,
  IDisponibilidadeFluxoBom,
  IEstadoFluxoBom,
  IExecucaoFluxoBom
} from '../../services/bom/BomFluxoService';

import {
  IEntradaValoresBom,
  PAPEIS_COM_TELA,
  PapelEtapaBom,
  abaDoPapel,
  configAvaliacaoDaDefinicao,
  etapaBomDaInstancia,
  papelAtual,
  papelDaEtapaLegada,
  papelDoElemento,
  situacaoFluxoBom,
  tarefaPendenteBom,
  valoresDoBom
} from '../../services/bom/fluxoBom';

import {
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  obterElementoAtual
} from '../../services/fluxo/FluxoEngine';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import PainelFluxoOrcamento from '../Orcamento/PainelFluxoOrcamento';

import HistoricoFluxoBom from './HistoricoFluxoBom';

import {
  SeloPrazo
} from '../Orcamento/orcamentoComum';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import {
  mapaPrecosDoCatalogo,
  totalizarItens
} from '../../services/bom/valoresBom';

import {
  COR,
  DECISAO,
  ETAPAS,
  FONTE,
  PASSOS,
  Selo,
  botao,
  campo,
  cartao,
  envioFechado,
  formatarData,
  formatarNumero
} from './arquiteturaComum';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — "Da demanda ao B.O.M. pronto"
//
// Fase 1: Visão geral dos B.O.M., Novo B.O.M., etapa 1 (Dados da
// demanda) e etapa 2 (Matriz Go/No-Go).
// Fase 2: etapa 3 (Seleção de kit — montador de B.O.M.).
// Etapa 4 (Cálculo de HH): prévia com o HH vigente de cada área (menu Cálculo de HH).
// Etapa 5 (B.O.M. pronto): apresentação do B.O.M., saídas (CIGAM, CSV,
// PDF) e envio para aprovação, que congela a lista de itens.
// ============================================================

export interface IArquiteturaPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
  // Anexos do Go/No-Go (SharePoint).
  spHttpClient?: SPHttpClient;
  siteUrl?: string;
  // Abre Processos → Fluxos (editar o fluxo do B.O.M.).
  onAbrirProcessos?: () => void;
}

type Filtro = 'todos' | 'aguardando' | 'demandaGo' | 'bloqueados' | 'kit' | 'hhPronto' | 'enviados' | 'aprovados';

const FILTROS: Array<{ id: Filtro; rotulo: string; etapas: EtapaBom[] }> = [
  { id: 'todos', rotulo: 'Todos os B.O.M.', etapas: [] },
  // Fluxo do B.O.M.: etapa atual com pendência para o usuário.
  { id: 'aguardando', rotulo: 'Aguardando você', etapas: [] },
  { id: 'demandaGo', rotulo: 'Demanda ou Go/No-Go pendente', etapas: ['Dados da demanda', 'Go/No-Go pendente'] },
  { id: 'bloqueados', rotulo: 'Bloqueados ou encerrados no Go/No-Go', etapas: ['Bloqueado no Go/No-Go', 'Encerrado (NO-GO)'] },
  { id: 'kit', rotulo: 'Em seleção de kit', etapas: ['Seleção de kit'] },
  { id: 'hhPronto', rotulo: 'HH ou B.O.M. pronto', etapas: ['Cálculo de HH', 'B.O.M. pronto'] },
  { id: 'enviados', rotulo: 'Aguardando aprovação', etapas: ['Enviado para aprovação'] },
  { id: 'aprovados', rotulo: 'Aprovados', etapas: ['Aprovado'] }
];

// ------------------------------------------------------------
// Identidade visual dos cards de resumo (fundo escuro tingido,
// ícone em bloco colorido, número grande e rótulo claro)
// ------------------------------------------------------------

const svgBase: React.SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const ICONE_FILTRO: Record<Filtro, React.ReactNode> = {
  todos: (
    <svg {...svgBase}>
      <line x1="9" y1="7" x2="19" y2="7" /><line x1="9" y1="12" x2="19" y2="12" /><line x1="9" y1="17" x2="19" y2="17" />
      <circle cx="5" cy="7" r=".8" fill="currentColor" /><circle cx="5" cy="12" r=".8" fill="currentColor" /><circle cx="5" cy="17" r=".8" fill="currentColor" />
    </svg>
  ),
  demandaGo: (
    <svg {...svgBase}>
      <line x1="12" y1="4" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" /><line x1="5" y1="7" x2="19" y2="7" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
    </svg>
  ),
  bloqueados: (
    <svg {...svgBase}>
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  kit: (
    <svg {...svgBase}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5" /><path d="M12 12v9" /><path d="M12 12L4 7.5" />
    </svg>
  ),
  hhPronto: (
    <svg {...svgBase}>
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  enviados: (
    <svg {...svgBase}>
      <path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" />
    </svg>
  ),
  aguardando: (
    <svg {...svgBase}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  aprovados: (
    <svg {...svgBase}>
      <circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16.5 9" />
    </svg>
  )
};

const VISUAL_FILTRO: Record<Filtro, { fundo: string; icone: string }> = {
  todos:      { fundo: '#1E2A52', icone: '#5B8DEF' },
  demandaGo:  { fundo: '#3A2E1A', icone: '#F5A84A' },
  bloqueados: { fundo: '#3D1F2B', icone: '#F2707A' },
  kit:        { fundo: '#2E2152', icone: '#A57CF2' },
  hhPronto:   { fundo: '#1E2A52', icone: '#5B8DEF' },
  enviados:   { fundo: '#12343D', icone: '#38BDF8' },
  aguardando: { fundo: '#1E2A52', icone: '#F5A84A' },
  aprovados:  { fundo: '#0F3A2C', icone: '#1FCB8A' }
};

const guid = (valor?: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

// ------------------------------------------------------------
// Indicador de progresso (1 a 5)
// ------------------------------------------------------------

// Cabeçalho do B.O.M. (painel claro): voltar, número, título,
// situação e as 5 etapas com marcador, linha de ligação e resumo.
// ------------------------------------------------------------

// Paleta clara, alinhada ao restante do portal (azul DGT).
const ESCURO = {
  painel: '#FFFFFF',
  borda: '#E2E8F0',
  texto: '#0B2D4D',
  texto2: '#64748B',
  trilho: '#E2E8F0',
  verde: '#13A06F',
  azul: '#0B5CAB',
  vermelho: '#D64545',
  laranja: '#D98A1F'
};

const IconeCheck: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="5 12.5 10 17.5 19 7.5" />
  </svg>
);

const IconeX: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

type AbaBom = 'demanda' | 'gonogo' | 'kit' | 'hh' | 'pronto';

const ABA_DO_PASSO: Record<number, AbaBom> = { 1: 'demanda', 2: 'gonogo', 3: 'kit', 4: 'hh', 5: 'pronto' };

// Etapa em que o B.O.M. está → aba que abre.
const abaDaEtapa = (etapa: EtapaBom): AbaBom =>
  etapa === 'Dados da demanda'
    ? 'demanda'
    : etapa === 'Go/No-Go pendente' || etapa === 'Bloqueado no Go/No-Go' || etapa === 'Encerrado (NO-GO)'
      ? 'gonogo'
      : etapa === 'Seleção de kit'
        ? 'kit'
        : etapa === 'B.O.M. pronto' || etapa === 'Enviado para aprovação' || etapa === 'Aprovado'
          ? 'pronto'
          : 'hh';

const CabecalhoBom: React.FC<{
  bom: IBomRegistro;
  demanda: IDemandaBom;
  etapa: EtapaBom;
  ultima: IAnaliseGoNoGo | undefined;
  aba: AbaBom;
  onAba: (aba: AbaBom) => void;
  onVoltar: () => void;
}> = ({ bom, demanda, etapa, ultima, aba, onAba, onVoltar }) => {

  const atual = ETAPAS[etapa].passo;
  const bloqueado = etapa === 'Bloqueado no Go/No-Go' || etapa === 'Encerrado (NO-GO)';

  const titulo =
    demanda.nome && demanda.nome !== 'Nova demanda (sem título)'
      ? demanda.nome
      : 'Nova demanda (sem título)';

  const meta = [
    ETAPAS[etapa].texto,
    demanda.canal,
    demanda.modalidade,
    bom.responsavelNome ? `Resp.: ${bom.responsavelNome}` : '',
    demanda.prazoEntrega ? `Prazo ${formatarData(demanda.prazoEntrega)}` : ''
  ].filter(Boolean).join(' · ');

  const resumo = (passo: number): string => {
    if (passo === 1) {
      if (atual > 1) {
        return [demanda.cliente, demanda.municipio].filter(Boolean).join(' · ') || 'Concluída';
      }
      return 'Em preenchimento';
    }
    if (passo === 2) {
      if (ultima) {
        return `${DECISAO[ultima.decisao].texto} · ${formatarNumero(ultima.pontuacao)} pts`;
      }
      return atual >= 2 ? 'Análise pendente' : 'Aguardando a demanda';
    }
    if (passo === 3) {
      return atual > 3 ? 'Concluída' : atual === 3 ? 'Em montagem' : 'Aguardando o Go/No-Go';
    }
    if (passo === 4) {
      return atual >= 4 ? 'Prévia com o HH vigente' : 'Aguardando o kit';
    }
    if (atual > 5) {
      return etapa === 'Aprovado' ? 'Aprovado' : 'Aguardando aprovação';
    }
    return atual === 5 ? 'Pronto para envio' : atual === 4 ? 'Disponível para revisão' : 'Aguardando o kit';
  };

  return (
    <div
      style={{
        background: ESCURO.painel,
        border: `1px solid ${ESCURO.borda}`,
        borderRadius: '14px',
        padding: '14px 18px 16px',
        marginBottom: '16px',
        color: ESCURO.texto,
        boxShadow: '0 2px 10px rgba(11,45,77,.06)'
      }}
    >
      {/* Linha 1: voltar, número, título e situação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onVoltar}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            background: '#FFFFFF',
            color: ESCURO.azul,
            fontFamily: FONTE,
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ← Visão geral
        </button>

        <span
          style={{
            padding: '5px 10px',
            borderRadius: '8px',
            background: '#EEF4FA',
            color: ESCURO.texto,
            fontSize: '12.5px',
            fontWeight: 700,
            letterSpacing: '.02em'
          }}
          title={`${bom.revisao} · ${demanda.numero}`}
        >
          BOM {bom.numero.replace(/^BOM\s*/i, '')}
        </span>

        <strong style={{ fontSize: '15px', color: ESCURO.texto }}>{titulo}</strong>

        <span style={{ fontSize: '12.5px', color: ESCURO.texto2 }}>{meta}</span>
      </div>

      {/* Linha 2: etapas */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px', overflowX: 'auto', gap: 0 }}>
        {
          PASSOS.map((item, indice) => {
            const concluido = atual > item.passo;
            const corrente = atual === item.passo || (item.passo === 5 && atual > 5);
            const travado = bloqueado && item.passo === 2;
            const clicavel =
              item.passo === 1 ||
              (item.passo === 2 && atual >= 2) ||
              (item.passo === 3 && atual >= 3 && !bloqueado) ||
              (item.passo === 4 && atual >= 4) ||
              (item.passo === 5 && atual >= 4);
            const selecionado = ABA_DO_PASSO[item.passo] === aba;

            const corMarcador =
              travado ? ESCURO.vermelho
                : concluido ? ESCURO.verde
                  : corrente ? ESCURO.azul
                    : '#EEF2F6';

            const linhaConcluida = atual > item.passo;

            return (
              <React.Fragment key={item.passo}>
                <button
                  type="button"
                  disabled={!clicavel}
                  onClick={() => onAba(ABA_DO_PASSO[item.passo])}
                  title={item.passo === 5 && atual < 4 ? 'Disponível depois de concluir a seleção de kit.' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                    padding: '6px 8px',
                    borderRadius: '10px',
                    border: 0,
                    background: selecionado ? '#EEF6FF' : 'transparent',
                    cursor: clicavel ? 'pointer' : 'default',
                    fontFamily: FONTE,
                    textAlign: 'left'
                  }}
                >
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: corMarcador,
                      color: concluido || corrente || travado ? '#FFFFFF' : ESCURO.texto2,
                      fontSize: '13px',
                      fontWeight: 800,
                      boxShadow: corrente && !concluido ? '0 0 0 4px rgba(11,92,171,.15)' : 'none'
                    }}
                  >
                    {travado ? <IconeX /> : concluido ? <IconeCheck /> : item.passo}
                  </span>

                  <span>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        color: concluido || corrente || travado ? ESCURO.texto : ESCURO.texto2,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.nome}
                    </strong>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '2px',
                        fontSize: '11.5px',
                        color: travado ? ESCURO.vermelho : ESCURO.texto2,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {resumo(item.passo)}
                    </span>
                  </span>
                </button>

                {
                  indice < PASSOS.length - 1 && (
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 1,
                        minWidth: '28px',
                        height: '2px',
                        margin: '0 6px',
                        borderRadius: '2px',
                        background: linhaConcluida ? ESCURO.verde : ESCURO.trilho
                      }}
                    />
                  )
                }
              </React.Fragment>
            );
          })
        }
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Novo B.O.M. (modal)
// ------------------------------------------------------------

const NovoBomModal: React.FC<{
  demandasLivres: IDemandaBom[];
  usuarios: IUsuarioOpcao[];
  responsavelPadrao: string;
  salvando: boolean;
  onCriar: (demandaId: string | undefined, responsavelId: string) => void;
  onFechar: () => void;
}> = ({ demandasLivres, usuarios, responsavelPadrao, salvando, onCriar, onFechar }) => {

  const [demanda, setDemanda] = React.useState<string>('nova');
  const [responsavel, setResponsavel] = React.useState<string>(responsavelPadrao);

  return ReactDOM.createPortal(
    <div role="dialog" aria-modal="true" aria-label="Novo B.O.M." onClick={() => { if (!salvando) { onFechar(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: FONTE }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 100%)', background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: COR.azul, color: '#FFFFFF', padding: '14px 18px', fontSize: '17px', fontWeight: 700 }}>Novo B.O.M.</div>
        <div style={{ padding: '16px 18px' }}>
          <p style={{ marginTop: 0, fontSize: '13px', color: COR.texto2 }}>
            O B.O.M. nasce na etapa <strong>Dados da demanda</strong>, revisão <strong>RV00</strong>, com o próximo número da sequência.
          </p>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }} htmlFor="nb-dem">Demanda</label>
          <select id="nb-dem" style={campo} value={demanda} onChange={e => setDemanda(e.target.value)}>
            <option value="nova">+ Nova demanda (preencher os dados)</option>
            {demandasLivres.map(item => <option key={item.id} value={item.id}>{item.nome} · já cadastrada</option>)}
          </select>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, margin: '12px 0 5px' }} htmlFor="nb-resp">Responsável pelo B.O.M.</label>
          <select id="nb-resp" style={campo} value={responsavel} onChange={e => setResponsavel(e.target.value)}>
            <option value="">Selecione…</option>
            {usuarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 18px', background: COR.fundo, borderTop: `1px solid ${COR.borda}` }}>
          <button type="button" style={botao('secundario', salvando)} disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" style={botao('principal', salvando || !responsavel)} disabled={salvando || !responsavel} onClick={() => onCriar(demanda === 'nova' ? undefined : demanda, responsavel)}>
            {salvando ? 'Criando…' : 'Criar B.O.M.'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const ArquiteturaPage: React.FC<IArquiteturaPageProps> = ({
  dataverseService,
  contexto,
  spHttpClient,
  siteUrl,
  onAbrirProcessos
}) => {

  const servico = React.useMemo(() => (dataverseService ? new BomService(dataverseService) : undefined), [dataverseService]);
  const areas = React.useMemo(() => (dataverseService ? new AreaAdminService(dataverseService) : undefined), [dataverseService]);

  const [visao, setVisao] = React.useState<IVisaoGeralBom | undefined>(undefined);
  const [usuarios, setUsuarios] = React.useState<IUsuarioOpcao[]>([]);
  const [membrosArea, setMembrosArea] = React.useState<string[]>([]);
  const [areaArqId, setAreaArqId] = React.useState<string>('');
  const [criterios, setCriterios] = React.useState<ICriterioGoNoGo[]>([]);

  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');
  const [mensagem, setMensagem] = React.useState<string>('');

  const [filtro, setFiltro] = React.useState<Filtro>('todos');
  const [busca, setBusca] = React.useState<string>('');
  const [novoAberto, setNovoAberto] = React.useState<boolean>(false);

  const [bomId, setBomId] = React.useState<string>('');
  const [aba, setAba] = React.useState<AbaBom>('demanda');

  // Etapa 3 — seleção de kit do B.O.M. aberto.
  const [selecaoKit, setSelecaoKit] = React.useState<ISelecaoKit | undefined>(undefined);
  const [kitSemColuna, setKitSemColuna] = React.useState(false);
  const [kitCarregado, setKitCarregado] = React.useState('');
  // Etapa 4 — integração e contrato de manutenção (rascunho na tela).
  const [complementosHH, setComplementosHH] = React.useState<IComplementosHH | undefined>(undefined);
  const [complementosAlterados, setComplementosAlterados] = React.useState(false);
  const [analises, setAnalises] = React.useState<IAnaliseGoNoGo[]>([]);

  // Fluxo do B.O.M. (processo ARQ-SOL, motor de fluxos).
  const fluxoServico = React.useMemo(
    () => (dataverseService && servico ? new BomFluxoService(dataverseService, servico) : undefined),
    [dataverseService, servico]
  );
  const [fluxoDisp, setFluxoDisp] = React.useState<IDisponibilidadeFluxoBom | undefined>(undefined);
  const [estadosFluxo, setEstadosFluxo] = React.useState<{ [bomId: string]: IFluxoInstancia }>({});
  const [vinculos, setVinculos] = React.useState<IUsuarioAreaAdmin[]>([]);
  const [estadoFluxo, setEstadoFluxo] = React.useState<IEstadoFluxoBom | undefined>(undefined);
  const [fluxoCarregadoDe, setFluxoCarregadoDe] = React.useState<string>('');
  const [avisoFluxo, setAvisoFluxo] = React.useState<string>('');
  // Criação do processo/fluxo em Processos (Administrador).
  const [criandoFluxo, setCriandoFluxo] = React.useState(false);
  const [publicarAgora, setPublicarAgora] = React.useState(true);
  const [passosCriacao, setPassosCriacao] = React.useState<Array<{ ok: boolean; texto: string }>>([]);

  const avisar = (texto: string): void => {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4000);
  };

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico || !areas) {
      setErro('Dataverse não conectado.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const [dados, listaUsuarios, listaAreas, vinculos, listaCriterios] = await Promise.all([
        servico.carregarVisaoGeral(),
        areas.listarUsuarios(),
        areas.listarAreas(),
        areas.listarUsuariosArea(),
        servico.carregarCriterios()
      ]);
      const arq = listaAreas.find(area => /^arq$/i.test(area.sigla || '') || /arquitetura/i.test(area.nome));
      setAreaArqId(arq ? arq.id : '');
      setMembrosArea(arq ? vinculos.filter(v => v.ativo && guid(v.areaId) === guid(arq.id)).map(v => guid(v.usuarioId)) : []);
      setUsuarios(listaUsuarios.map(item => ({ id: guid(item.id), nome: item.nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
      setCriterios(listaCriterios);
      setVinculos(vinculos);
      if (fluxoServico) {
        fluxoServico.definirContexto(arq ? arq.id : '', vinculos);
        const [disponibilidade, estados] = await Promise.all([fluxoServico.verificar(), fluxoServico.lerEstados()]);
        setFluxoDisp(disponibilidade);
        setEstadosFluxo(estados);
      }
      setVisao(dados);
    } catch (error) {
      setErro(`Não foi possível carregar a Arquitetura de Soluções: ${(error as Error).message}. Confira se as tabelas dgt_bom_* existem e se o seu perfil de segurança permite lê-las.`);
    } finally {
      setCarregando(false);
    }
  }, [servico, areas, fluxoServico]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  // Catálogo de kits (aba Kits): aplica o que está gravado no
  // Dataverse antes de montar o B.O.M. Sem tabela ou sem permissão,
  // o montador segue com o catálogo padrão do sistema.
  const [, setVersaoCatalogo] = React.useState(0);
  // Valores do CIGAM por código (aba Kits), para o B.O.M. pronto.
  const [precos, setPrecos] = React.useState<Record<string, number>>({});
  const [dataEnvio, setDataEnvio] = React.useState('');

  const lerPrecos = (catalogo: ICatalogoKitsCarregado): Record<string, number> => mapaPrecosDoCatalogo(catalogo.itens);

  React.useEffect(() => {
    garantirCatalogoKitsAplicado(dataverseService)
      .then(catalogo => {
        if (catalogo) {
          setPrecos(lerPrecos(catalogo));
          setVersaoCatalogo(v => v + 1);
        }
      })
      .catch(() => undefined);
  }, [dataverseService]);

  const bom = visao && bomId ? visao.boms.find(item => item.id === bomId) : undefined;
  const demanda = visao && bom ? visao.demandas.find(item => item.id === bom.demandaId) : undefined;

  // Ao abrir um B.O.M., carrega o histórico das análises.
  React.useEffect(() => {
    if (!servico || !demanda) {
      setAnalises([]);
      return;
    }
    servico.carregarAnalises(demanda.id).then(setAnalises).catch(error => setErro((error as Error).message));
  }, [servico, demanda ? demanda.id : '']);

  const etapaSemFluxo = (item: IBomRegistro): EtapaBom =>
    visao
      ? etapaCalculada(visao.demandas.find(d => d.id === item.demandaId), visao.ultimaAnalise[item.demandaId], item.etapa)
      : item.etapa;

  // Com o fluxo ativo, a etapa é a do fluxo (a do B.O.M. aberto é a
  // mais recente; as demais vêm da lista).
  const fluxoAtivo = !!fluxoDisp && fluxoDisp.ativo;

  const etapaDe = (item: IBomRegistro): EtapaBom => {
    if (fluxoAtivo && estadoFluxo && item.id === bomId) {
      return etapaBomDaInstancia(estadoFluxo.instancia);
    }
    const instancia = fluxoAtivo ? estadosFluxo[item.id] : undefined;
    return instancia ? etapaBomDaInstancia(instancia) : etapaSemFluxo(item);
  };

  // ----------------------------------------------------------
  // Fluxo do B.O.M. aberto
  // ----------------------------------------------------------

  const ultimaDoBom = visao && demanda ? visao.ultimaAnalise[demanda.id] : undefined;

  // Dados atuais do módulo como valores dos campos do fluxo.
  const entradaValores = (): IEntradaValoresBom | undefined => {
    if (!bom || !demanda) {
      return undefined;
    }
    const selecao = selecaoKit && kitCarregado === bom.id ? selecaoKit : undefined;
    const resultadoKit = selecao && !selecao.bomEnviado ? montarBom(selecao) : undefined;
    const custo =
      selecao && selecao.bomEnviado
        ? selecao.bomEnviado.valorTotal
        : resultadoKit ? totalizarItens(resultadoKit.itens, precos).total : undefined;
    return {
      bom,
      demanda,
      analise: ultimaDoBom,
      usuarios,
      selecao,
      custoProjeto: custo,
      configGoNoGo: configAvaliacaoDaDefinicao(estadoFluxo ? estadoFluxo.definicao : undefined)
    };
  };

  const valoresTela: Record<string, string> = React.useMemo(() => {
    const entrada = entradaValores();
    return entrada ? valoresDoBom(entrada) : {};
  }, [bom, demanda, ultimaDoBom, usuarios, selecaoKit, kitCarregado, precos, estadoFluxo]);

  // Carrega (ou inicia) o fluxo ao abrir um B.O.M.
  React.useEffect(() => {
    setEstadoFluxo(undefined);
    setAvisoFluxo('');
    setFluxoCarregadoDe('');
    if (!fluxoServico || !bom || !demanda || !fluxoAtivo) {
      return;
    }
    let vivo = true;
    (async () => {
      let estado = await fluxoServico.carregar(bom.id);
      // Versão nova do fluxo publicada: o B.O.M. passa para ela, na
      // mesma etapa (o processo segue sempre o fluxo publicado).
      if (estado && contexto && contexto.usuarioId && estado.instancia.status === 'emAndamento') {
        const entrada = entradaValores();
        const atualizacao = await fluxoServico.atualizarVersao(bom, contexto, entrada ? valoresDoBom(entrada) : undefined);
        if (atualizacao.atualizado) {
          estado = await fluxoServico.carregar(bom.id);
          if (vivo) {
            avisar(atualizacao.mensagem);
          }
        } else if (atualizacao.mensagem && vivo) {
          setAvisoFluxo(atualizacao.mensagem);
        }
      }
      if (!estado && contexto && contexto.usuarioId) {
        const entrada = entradaValores();
        const resultado =
          await fluxoServico.iniciar(
            bom,
            contexto,
            entrada ? valoresDoBom(entrada) : {},
            papelDaEtapaLegada(etapaSemFluxo(bom), ultimaDoBom)
          );
        if (!resultado.ok && vivo) {
          setAvisoFluxo(`O fluxo deste B.O.M. não foi iniciado: ${resultado.erros.join(' ')}`);
        }
        estado = resultado.estado;
        if (resultado.ok && vivo) {
          setEstadosFluxo(await fluxoServico.lerEstados());
        }
      }
      if (vivo) {
        setEstadoFluxo(estado);
        setFluxoCarregadoDe(bom.id);
      }
    })().catch(error => {
      if (vivo) {
        setAvisoFluxo(`Não foi possível ler o fluxo deste B.O.M.: ${(error as Error).message}`);
        setFluxoCarregadoDe(bom.id);
      }
    });
    return () => { vivo = false; };
  }, [fluxoServico, bomId, fluxoAtivo, demanda ? demanda.id : '']);

  // Fluxo ativo: TODA alteração passa pelo fluxo. Sem a instância (não
  // iniciada ou ilegível), nada é alterado — a tela fica só para consulta.
  const comFluxo = fluxoAtivo;
  const elementoFluxo = estadoFluxo ? obterElementoAtual(estadoFluxo.definicao, estadoFluxo.instancia) : undefined;
  const papelFluxo: PapelEtapaBom | undefined =
    estadoFluxo && estadoFluxo.instancia.status === 'emAndamento' ? papelDoElemento(elementoFluxo) : undefined;
  const podeAgirFluxo =
    !!estadoFluxo && !!bom && !!fluxoServico && fluxoServico.podeAgir(estadoFluxo, bom, contexto, valoresTela);
  // Fluxo ativo, mas o estado deste B.O.M. ainda está carregando: a
  // tela espera (ninguém age fora do fluxo).
  const fluxoCarregando = fluxoAtivo && !!bom && fluxoCarregadoDe !== bom.id;

  // A tela da etapa pode ser alterada? Sem fluxo: regra antiga.
  const editavel = (papel: PapelEtapaBom): boolean =>
    !comFluxo || (!!estadoFluxo && papelFluxo === papel && podeAgirFluxo);

  const avisoEdicao = (papel: PapelEtapaBom): string =>
    !estadoFluxo
      ? (comFluxo ? 'O fluxo deste B.O.M. não está disponível (veja o aviso acima): os dados ficam só para consulta.' : '')
      : estadoFluxo.instancia.status !== 'emAndamento'
        ? 'O fluxo deste B.O.M. foi concluído: os dados ficam só para consulta.'
        : papelFluxo !== papel
          ? `Esta etapa não está em andamento (etapa atual: ${elementoFluxo ? elementoFluxo.nome : '—'}). Para alterá-la, use as ações de devolução do fluxo.`
          : 'Somente os responsáveis pela etapa atual podem alterar estes dados.';

  // Executa uma ação do fluxo (botão da tela ou do painel).
  const acaoFluxo = async (
    opcoes: Omit<IExecucaoFluxoBom, 'bom' | 'contexto' | 'comentario' | 'valores'> & {
      comentario?: string;
      valores?: IExecucaoFluxoBom['valores'];
      sucesso: string;
      mostrarErro?: boolean;
    }
  ): Promise<string[]> => {
    if (!fluxoServico || !bom || !contexto) {
      return ['O fluxo do B.O.M. não está disponível.'];
    }
    setSalvando(true);
    setErro('');
    try {
      const { sucesso, mostrarErro, comentario, valores, ...resto } = opcoes;
      const resultado =
        await fluxoServico.executar({
          ...resto,
          bom,
          contexto,
          comentario: comentario || '',
          valores: valores || (() => valoresTela)
        });
      if (!resultado.ok) {
        if (mostrarErro !== false) {
          setErro(resultado.erros.join(' '));
        }
        return resultado.erros;
      }
      if (resultado.estado) {
        setEstadoFluxo(resultado.estado);
        const situacao = situacaoFluxoBom(resultado.estado.instancia);
        const proxima =
          situacao === 'encerrado' ? 'gonogo' : situacao === 'aprovado' ? 'pronto' : abaDoPapel(papelAtual(resultado.estado.instancia));
        if (proxima) {
          setAba(proxima);
        }
      }
      // A lista de itens pode ter sido liberada (devolução): relê.
      setKitCarregado('');
      await carregar();
      avisar(resultado.avisos.length > 0 ? `${sucesso} ${resultado.avisos.join(' ')}` : sucesso);
      window.scrollTo(0, 0);
      return [];
    } catch (error) {
      const texto = (error as Error).message || String(error);
      if (opcoes.mostrarErro !== false) {
        setErro(texto);
      }
      return [texto];
    } finally {
      setSalvando(false);
    }
  };

  // Carrega a seleção de kit ao abrir a etapa 3 ou 4.
  React.useEffect(() => {
    if (!servico || !bomId || (aba !== 'kit' && aba !== 'hh' && aba !== 'pronto') || kitCarregado === bomId) {
      return;
    }
    servico.lerSelecaoKit(bomId)
      .then(lida => {
        setKitSemColuna(lida === 'semColuna');
        setSelecaoKit(lida && lida !== 'semColuna' ? lida : undefined);
        setKitCarregado(bomId);
      })
      .catch(error => setErro((error as Error).message));
  }, [servico, bomId, aba, kitCarregado]);

  React.useEffect(() => {
    setComplementosHH(selecaoKit ? selecaoKit.complementosHH : undefined);
    setComplementosAlterados(false);
  }, [selecaoKit]);

  // Data de envio do B.O.M. aberto (etapa 5).
  React.useEffect(() => {
    setDataEnvio('');
    if (servico && bomId && aba === 'pronto') {
      servico.lerDataEnvio(bomId).then(setDataEnvio).catch(() => undefined);
    }
  }, [servico, bomId, aba]);

  const abrirBom = (item: IBomRegistro): void => {
    setBomId(item.id);
    const etapa = etapaDe(item);
    setAba(abaDaEtapa(etapa));
    window.scrollTo(0, 0);
  };

  const executar = async (acao: () => Promise<void>, sucesso: string): Promise<void> => {
    setSalvando(true);
    setErro('');
    try {
      await acao();
      await carregar();
      avisar(sucesso);
    } catch (error) {
      setErro((error as Error).message || String(error));
      throw error;
    } finally {
      setSalvando(false);
    }
  };

  // ----------------------------------------------------------
  // Tela do B.O.M.
  // ----------------------------------------------------------

  if (bom && demanda && servico) {

    const etapa = etapaDe(bom);
    const ultima = visao ? visao.ultimaAnalise[demanda.id] : undefined;

    return (
      <section style={{ fontFamily: FONTE }}>
        <CabecalhoBom
          bom={bom}
          demanda={demanda}
          etapa={etapa}
          ultima={ultima}
          aba={aba}
          onAba={setAba}
          onVoltar={() => { setBomId(''); window.scrollTo(0, 0); }}
        />

        {mensagem && <div role="status" style={{ ...cartao, background: '#E7F6EC', borderColor: '#107C10', color: '#107C10', fontWeight: 700, padding: '10px 14px' }}>✓ {mensagem}</div>}
        {erro && <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', color: COR.azul, padding: '10px 14px', fontSize: '13px' }}>{erro}</div>}

        {avisoFluxo && <div role="alert" style={{ ...cartao, background: '#FFF4E5', borderColor: '#B45309', color: '#7C2D12', padding: '10px 14px', fontSize: '13px' }}>{avisoFluxo}</div>}

        {fluxoCarregando && <div style={{ ...cartao, color: COR.texto2, fontSize: '13px' }}>Carregando o fluxo do B.O.M.…</div>}

        {
          estadoFluxo && fluxoServico && (() => {
            const situacao = situacaoFluxoBom(estadoFluxo.instancia);
            const comTela = !!papelFluxo && PAPEIS_COM_TELA.indexOf(papelFluxo) >= 0;
            const principal = comTela && elementoFluxo ? elementoFluxo.acoes.find(item => item.principal) : undefined;
            const ROTULO_TELA: Partial<Record<PapelEtapaBom, string>> = {
              demanda: 'Concluir e ir para o Go/No-Go',
              goNoGo: 'Registrar análise',
              kit: 'Concluir seleção de kit',
              hh: 'Avançar para B.O.M. pronto',
              bomPronto: 'Enviar para aprovação'
            };
            return (
              <div style={{ marginBottom: '16px' }}>
                <PainelFluxoOrcamento
                  estado={estadoFluxo}
                  dadosResponsaveis={fluxoServico.dadosResponsaveis(bom, { ...estadoFluxo.instancia.valores, ...valoresTela })}
                  vinculos={vinculos}
                  usuarios={usuarios}
                  podeAgir={podeAgirFluxo}
                  processando={salvando}
                  diagramaAberto={false}
                  rotuloFluxo="Fluxo do B.O.M."
                  ocultarHistorico
                  textoConcluido={situacao === 'encerrado' ? '✕ Demanda encerrada no Go/No-Go — fluxo concluído' : '✓ B.O.M. aprovado — fluxo concluído'}
                  valoresExternos={valoresTela}
                  // Etapas com tela no módulo: os campos são preenchidos lá.
                  // Parecer da restrição / bloqueio: o painel mostra o parecer.
                  camposOcultos={comTela || papelFluxo === 'aprovacao' ? 'todos' : ['goNoGo']}
                  acoesOcultas={principal ? [principal.chave] : []}
                  observacaoAcoesOcultas={
                    principal && papelFluxo
                      ? `Para concluir esta etapa, use “${ROTULO_TELA[papelFluxo] || principal.rotulo}” na tela abaixo: os dados são gravados e a etapa avança no mesmo clique.`
                      : undefined
                  }
                  dataverseService={dataverseService}
                  onExecutar={(acaoChave, comentario, valoresPainel) =>
                    acaoFluxo({
                      acaoChave,
                      comentario,
                      valores: () => ({ ...valoresTela, ...valoresPainel }),
                      sucesso: 'Ação registrada no fluxo do B.O.M.',
                      mostrarErro: false
                    })
                  }
                />
              </div>
            );
          })()
        }

        {
          !fluxoCarregando && aba === 'demanda' && (
            <DadosDemandaEtapa
              demanda={demanda}
              usuarios={usuarios}
              membrosArea={membrosArea}
              canalTravado={analises.length > 0}
              salvando={salvando}
              somenteLeitura={comFluxo && !editavel('demanda')}
              avisoSomenteLeitura={avisoEdicao('demanda')}
              rotuloConcluir={comFluxo ? 'Concluir e ir para o Go/No-Go →' : undefined}
              onSalvar={async (dados, responsaveis, principal, concluir) => {
                if (comFluxo) {
                  if (!editavel('demanda')) {
                    setErro(avisoEdicao('demanda'));
                    return;
                  }
                  if (!concluir) {
                    await executar(() => servico.salvarDemanda(dados, responsaveis, principal), 'Rascunho salvo.');
                    return;
                  }
                  const nomeDe = (id: string): string => {
                    const achado = usuarios.find(item => item.id === guid(id));
                    return achado ? achado.nome : '';
                  };
                  const demandaNova: IDemandaBom = {
                    ...dados,
                    responsaveis: responsaveis.map(id => ({ usuarioId: guid(id), nome: nomeDe(id), principal: guid(id) === guid(principal), ativo: true }))
                  };
                  const entrada = entradaValores();
                  await acaoFluxo({
                    papelEsperado: 'demanda',
                    valores: () => (entrada ? valoresDoBom({ ...entrada, demanda: demandaNova }) : {}),
                    preparar: () => servico.salvarDemanda(dados, responsaveis, principal),
                    sucesso: 'Dados da demanda concluídos.'
                  });
                  return;
                }
                await executar(async () => {
                  await servico.salvarDemanda(dados, responsaveis, principal);
                  const novaEtapa = etapaCalculada(dados, ultima, bom.etapa);
                  if (novaEtapa !== bom.etapa) {
                    await servico.atualizarEtapa(bom.id, novaEtapa);
                  }
                }, concluir ? 'Dados da demanda concluídos.' : 'Rascunho salvo.');
                if (concluir) {
                  setAba('gonogo');
                  window.scrollTo(0, 0);
                }
              }}
            />
          )
        }

        {
          !fluxoCarregando && aba === 'gonogo' && (
            !demanda.cadastroCompleto
              ? (
                <div style={{ ...cartao, textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 6px', color: COR.azul }}>🔒 Conclua os dados da demanda</h3>
                  <p style={{ fontSize: '13px', color: COR.texto2 }}>A Matriz Go/No-Go é liberada depois que os campos obrigatórios da demanda forem preenchidos.</p>
                </div>
              )
              : (
                <>
                  <MatrizGoNoGoEtapa
                    criterios={criterios}
                    analises={analises}
                    salvando={salvando}
                    bomCriadoEm={bom.criadoEm}
                    bomResponsavel={bom.responsavelNome}
                    numeroBom={bom.numero}
                    spHttpClient={spHttpClient}
                    siteUrl={siteUrl}
                    somenteLeitura={comFluxo && !editavel('goNoGo')}
                    avisoSomenteLeitura={avisoEdicao('goNoGo')}
                    onRegistrar={async (notas, justificativas, parecer) => {
                      if (!contexto || !contexto.usuarioId) {
                        setErro('Não foi possível identificar o seu usuário para registrar a análise.');
                        return;
                      }
                      if (comFluxo) {
                        if (!editavel('goNoGo')) {
                          setErro(avisoEdicao('goNoGo'));
                          return;
                        }
                        // A análise é registrada (histórico do módulo) e o
                        // resultado já calculado — GO, GO com restrição ou
                        // NO-GO — decide o caminho do fluxo.
                        let nova: IAnaliseGoNoGo | undefined;
                        await acaoFluxo({
                          papelEsperado: 'goNoGo',
                          valoresDependemDoPreparo: true,
                          preparar: async () => {
                            nova = await servico.registrarAnalise({
                              demandaId: demanda.id,
                              bomId: bom.id,
                              avaliadorId: contexto.usuarioId as string,
                              criterios,
                              notas,
                              justificativas,
                              parecer
                            });
                            setAnalises(await servico.carregarAnalises(demanda.id));
                          },
                          valores: () => {
                            const entrada = entradaValores();
                            return entrada ? valoresDoBom({ ...entrada, analise: nova || entrada.analise }) : {};
                          },
                          sucesso: 'Análise Go/No-Go registrada.'
                        });
                        return;
                      }
                      await executar(async () => {
                        await servico.registrarAnalise({
                          demandaId: demanda.id,
                          bomId: bom.id,
                          avaliadorId: contexto.usuarioId as string,
                          criterios,
                          notas,
                          justificativas,
                          parecer
                        });
                        setAnalises(await servico.carregarAnalises(demanda.id));
                      }, 'Análise Go/No-Go registrada.');
                    }}
                  />
                  {
                    (comFluxo ? ETAPAS[etapa].passo >= 3 && etapa !== 'Encerrado (NO-GO)' : ultima && ultima.liberaKit) && (
                      <div style={{ ...cartao, background: '#E8F2FF', borderColor: '#0F6CBD', fontSize: '13px', color: COR.azul }}>
                        <strong>Seleção de kit liberada.</strong> Monte os pontos e as soluções do projeto na etapa 3 (barra de etapas acima).
                      </div>
                    )
                  }
                </>
              )
          )
        }

        {
          !fluxoCarregando && aba === 'kit' && (
            kitCarregado !== bom.id
              ? <div style={{ ...cartao, color: COR.texto2 }}>Carregando a seleção de kit...</div>
              : (
                <SelecaoKitEtapa
                  selecaoInicial={selecaoKit}
                  semColuna={kitSemColuna}
                  canal={demanda.canal}
                  salvando={salvando}
                  somenteLeitura={envioFechado(etapa) || (comFluxo && !editavel('kit'))}
                  usuarioNome={contexto && contexto.nome ? contexto.nome : ''}
                  usuarioId={contexto && contexto.usuarioId ? contexto.usuarioId : undefined}
                  precos={precos}
                  onSalvar={async (selecao, concluir) => {
                    if (comFluxo) {
                      if (!editavel('kit')) {
                        setErro(avisoEdicao('kit'));
                        return;
                      }
                      const nome = contexto && contexto.nome ? contexto.nome : '';
                      if (!concluir) {
                        await executar(async () => {
                          await servico.salvarSelecaoKit(bom.id, selecao, nome);
                          setSelecaoKit(selecao);
                        }, 'Seleção de kit salva.');
                        return;
                      }
                      const entrada = entradaValores();
                      await acaoFluxo({
                        papelEsperado: 'kit',
                        valores: () => (entrada ? valoresDoBom({ ...entrada, selecao }) : {}),
                        preparar: async () => {
                          await servico.salvarSelecaoKit(bom.id, selecao, nome);
                          setSelecaoKit(selecao);
                        },
                        sucesso: 'Seleção de kit concluída.'
                      });
                      return;
                    }
                    await executar(async () => {
                      await servico.salvarSelecaoKit(bom.id, selecao, contexto && contexto.nome ? contexto.nome : '');
                      setSelecaoKit(selecao);
                      if (concluir && ETAPAS[etapa].passo <= 3) {
                        await servico.atualizarEtapa(bom.id, 'Cálculo de HH');
                      }
                    }, concluir ? 'Seleção de kit concluída.' : 'Seleção de kit salva.');
                    if (concluir) {
                      setAba('hh');
                      window.scrollTo(0, 0);
                    }
                  }}
                />
              )
          )
        }

        {
          !fluxoCarregando && aba === 'hh' && (
            <>
              {(() => {
                // Valor dos itens da Seleção de kit (preços do CIGAM): base
                // da alocação de horas e dos % fixos de Implantação/Supply.
                const resultadoKit = selecaoKit ? montarBom(selecaoKit) : undefined;
                const valores = resultadoKit ? totalizarItens(resultadoKit.itens, precos) : undefined;
                return (
              <EtapaHHBom
                dataverseService={dataverseService}
                resumoKit={resultadoKit}
                custoInicial={valores ? valores.total : 0}
                custoFixo={!!valores}
                notaCusto="total dos itens da Seleção de kit, valores do CIGAM"
                itensSemPreco={valores ? valores.semValor + valores.semCodigo : 0}
                complementos={complementosHH}
                somenteLeitura={envioFechado(etapa) || !selecaoKit || ETAPAS[etapa].passo < 4 || (comFluxo && !editavel('hh'))}
                onAlterarComplementos={c => { setComplementosHH(c); setComplementosAlterados(true); }}
              />
                );
              })()}
              {
                selecaoKit && selecaoKit.pontos.length > 0 && ETAPAS[etapa].passo >= 4 && (() => {
                  const enviado = envioFechado(etapa) || (comFluxo && !editavel('hh'));
                  const pendencias = pendenciasComplementos(complementosHH);
                  const avancarNoFluxo = comFluxo && editavel('hh');
                  // Grava as respostas na seleção de kit (mesmo JSON do B.O.M.).
                  const salvarComplementos = async (): Promise<void> => {
                    if (!complementosAlterados || enviado) {
                      return;
                    }
                    const nome = contexto && contexto.nome ? contexto.nome : '';
                    const selecao: ISelecaoKit = {
                      ...selecaoKit,
                      complementosHH: { ...complementosHH, atualizadoEm: new Date().toISOString(), atualizadoPor: nome }
                    };
                    await servico.salvarSelecaoKit(bom.id, selecao, nome);
                    setSelecaoKit(selecao);
                  };
                  return (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                      {!enviado && pendencias.length > 0 && (
                        <span style={{ fontSize: '12.5px', color: '#B45309', marginRight: 'auto' }}>{pendencias.join(' ')}</span>
                      )}
                      {!enviado && complementosAlterados && (
                        <span style={{ fontSize: '12.5px', color: '#B45309', fontWeight: 700 }}>Alterações não salvas</span>
                      )}
                      {!enviado && (
                        <button
                          type="button"
                          style={botao('secundario', salvando || !complementosAlterados)}
                          disabled={salvando || !complementosAlterados}
                          onClick={() => {
                            executar(salvarComplementos, 'Respostas de integração e manutenção salvas.')
                              .then(() => setAba('hh'))
                              .catch(() => undefined);
                          }}
                        >
                          Salvar respostas
                        </button>
                      )}
                      {(!comFluxo || avancarNoFluxo) && (
                      <button
                        type="button"
                        style={botao('principal', salvando || (!enviado && pendencias.length > 0))}
                        disabled={salvando || (!enviado && pendencias.length > 0)}
                        title={!enviado && pendencias.length > 0 ? 'Responda as perguntas de integração e manutenção' : undefined}
                        onClick={() => {
                          (async () => {
                            if (comFluxo) {
                              if (!avancarNoFluxo) {
                                setAba('pronto');
                                window.scrollTo(0, 0);
                                return;
                              }
                              const nome = contexto && contexto.nome ? contexto.nome : '';
                              const selecaoNova: ISelecaoKit = complementosAlterados
                                ? { ...selecaoKit, complementosHH: { ...complementosHH, atualizadoEm: new Date().toISOString(), atualizadoPor: nome } }
                                : selecaoKit;
                              const entrada = entradaValores();
                              await acaoFluxo({
                                papelEsperado: 'hh',
                                valores: () => (entrada ? valoresDoBom({ ...entrada, selecao: selecaoNova }) : {}),
                                preparar: async () => {
                                  if (complementosAlterados) {
                                    await servico.salvarSelecaoKit(bom.id, selecaoNova, nome);
                                    setSelecaoKit(selecaoNova);
                                  }
                                },
                                sucesso: 'B.O.M. pronto para revisão e envio.'
                              });
                              return;
                            }
                            if (complementosAlterados || ETAPAS[etapa].passo === 4) {
                              await executar(async () => {
                                await salvarComplementos();
                                if (ETAPAS[etapa].passo === 4) {
                                  await servico.atualizarEtapa(bom.id, 'B.O.M. pronto');
                                }
                              }, ETAPAS[etapa].passo === 4 ? 'B.O.M. pronto para revisão e envio.' : 'Respostas de integração e manutenção salvas.');
                            }
                            setAba('pronto');
                            window.scrollTo(0, 0);
                          })().catch(() => undefined);
                        }}
                      >
                        Avançar para B.O.M. pronto →
                      </button>
                      )}
                    </div>
                  );
                })()
              }
            </>
          )
        }

        {
          !fluxoCarregando && aba === 'pronto' && (
            kitCarregado !== bom.id
              ? <div style={{ ...cartao, color: COR.texto2 }}>Carregando o B.O.M....</div>
              : (
                <EtapaBomPronto
                  bom={{ ...bom, etapa }}
                  demanda={demanda}
                  analise={
                    // Parecer dado na etapa "Parecer da restrição" do fluxo.
                    ultima && !ultima.parecer && estadoFluxo && estadoFluxo.instancia.valores.parecer
                      ? { ...ultima, parecer: estadoFluxo.instancia.valores.parecer }
                      : ultima
                  }
                  selecao={selecaoKit}
                  resultado={selecaoKit && !selecaoKit.bomEnviado ? montarBom(selecaoKit) : undefined}
                  precos={precos}
                  dataverseService={dataverseService}
                  dataEnvio={dataEnvio}
                  salvando={salvando}
                  podeEnviar={!comFluxo || editavel('bomPronto')}
                  /* Com fluxo, o CIGAM é lançado pela tarefa "Lançar no CIGAM" depois da aprovação: o botão manual vira só consulta. */
                  lancamentoPeloFluxo={comFluxo}
                  tituloSituacao={
                    etapa === 'Aprovado'
                      ? `✓ BOM ${bom.numero.replace(/^BOM\s*/i, '')} ${bom.revisao} aprovado`
                      : etapa === 'Enviado para aprovação' && comFluxo
                        ? `BOM ${bom.numero.replace(/^BOM\s*/i, '')} ${bom.revisao} aguardando aprovação`
                        : undefined
                  }
                  textoSituacao={
                    comFluxo && estadoFluxo && estadoFluxo.instancia.status === 'concluido' && estadoFluxo.instancia.concluidoEm
                      ? `Aprovado em ${formatarData(estadoFluxo.instancia.concluidoEm.substring(0, 10))}.`
                      : undefined
                  }
                  onEnviar={async (congelado: IBomEnviado) => {
                    if (!selecaoKit) {
                      return;
                    }
                    const nome = contexto && contexto.nome ? contexto.nome : '';
                    const selecao: ISelecaoKit = { ...selecaoKit, bomEnviado: { ...congelado, por: nome } };
                    if (comFluxo) {
                      if (!editavel('bomPronto')) {
                        setErro(avisoEdicao('bomPronto'));
                        return;
                      }
                      const anterior = selecaoKit;
                      const entrada = entradaValores();
                      await acaoFluxo({
                        papelEsperado: 'bomPronto',
                        valores: () => (entrada ? valoresDoBom({ ...entrada, selecao, itensConferidos: true }) : {}),
                        // Congela a lista; se o fluxo recusar, volta como estava.
                        preparar: async () => {
                          await servico.enviarParaAprovacao(bom.id, selecao, nome);
                          setSelecaoKit(selecao);
                          setDataEnvio(await servico.lerDataEnvio(bom.id));
                        },
                        desfazer: async () => {
                          await servico.salvarSelecaoKit(bom.id, anterior, nome);
                          await servico.atualizarEtapa(bom.id, 'B.O.M. pronto');
                          setSelecaoKit(anterior);
                        },
                        sucesso: `BOM ${bom.numero.replace(/^BOM\s*/i, '')} enviado para aprovação.`
                      });
                      return;
                    }
                    await executar(async () => {
                      await servico.enviarParaAprovacao(bom.id, selecao, nome);
                      setSelecaoKit(selecao);
                      setDataEnvio(await servico.lerDataEnvio(bom.id));
                    }, `BOM ${bom.numero.replace(/^BOM\s*/i, '')} enviado para aprovação.`);
                    window.scrollTo(0, 0);
                  }}
                />
              )
          )
        }

        {
          !fluxoCarregando && estadoFluxo && (
            <HistoricoFluxoBom instancia={estadoFluxo.instancia} />
          )
        }
      </section>
    );
  }

  // ----------------------------------------------------------
  // Visão geral dos B.O.M.
  // ----------------------------------------------------------

  const linhas =
    visao
      ? visao.boms.map(item => ({
        bom: item,
        demanda: visao.demandas.find(d => d.id === item.demandaId),
        etapa: etapaDe(item),
        analise: visao.ultimaAnalise[item.demandaId]
      }))
      : [];

  const meuId = contexto && contexto.usuarioId ? contexto.usuarioId : '';

  const aguardaVoce = (item: IBomRegistro): boolean => {
    const instancia = fluxoAtivo ? estadosFluxo[item.id] : undefined;
    return !!instancia && !!fluxoServico && fluxoServico.aguardaUsuario(instancia, meuId);
  };

  const noFiltro = (f: Filtro, l: { bom: IBomRegistro; etapa: EtapaBom }): boolean => {
    if (f === 'aguardando') {
      return aguardaVoce(l.bom);
    }
    const def = FILTROS.find(item => item.id === f);
    return !def || def.etapas.length === 0 || def.etapas.indexOf(l.etapa) >= 0;
  };

  const contar = (f: Filtro): number =>
    linhas.filter(l => noFiltro(f, l)).length;

  const termo = busca.trim().toLowerCase();
  const filtroAtual = FILTROS.find(item => item.id === filtro) as typeof FILTROS[number];

  const visiveis =
    linhas.filter(l =>
      noFiltro(filtroAtual.id, l) &&
      (!termo || `${l.bom.numero} ${l.demanda ? l.demanda.nome : ''} ${l.demanda ? l.demanda.cliente : ''} ${l.bom.responsavelNome}`.toLowerCase().indexOf(termo) >= 0)
    );

  const demandasLivres =
    visao ? visao.demandas.filter(d => !visao.boms.some(b => b.demandaId === d.id)) : [];

  const meuUsuario = contexto && contexto.usuarioId ? guid(contexto.usuarioId) : '';

  return (
    <section style={{ fontFamily: FONTE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '22px', color: COR.azul }}>Visão geral dos B.O.M.</h1>
        <span style={{ fontSize: '12px', color: COR.texto2 }}>{linhas.length} B.O.M.</span>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: '13px', color: COR.texto2 }}>
        Todos os B.O.M. da Arquitetura de Soluções. Clique em um B.O.M. para abrir a etapa em que ele está.
      </p>

      {mensagem && <div role="status" style={{ ...cartao, background: '#E7F6EC', borderColor: '#107C10', color: '#107C10', fontWeight: 700, padding: '10px 14px' }}>✓ {mensagem}</div>}
      {erro && <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', color: COR.azul, padding: '10px 14px', fontSize: '13px' }}>{erro}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px',
          borderRadius: '16px',
          background: '#141A33'
        }}
      >
        {
          FILTROS.map(item => {
            const visual = VISUAL_FILTRO[item.id];
            const ativo = filtro === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  minHeight: '92px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: FONTE,
                  background: visual.fundo,
                  border: ativo ? '1.5px solid rgba(255,255,255,.85)' : '1.5px solid transparent',
                  boxShadow: ativo ? '0 6px 18px rgba(0,0,0,.28)' : 'none',
                  transition: 'border-color .15s, box-shadow .15s'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '44px',
                    height: '44px',
                    flexShrink: 0,
                    borderRadius: '10px',
                    background: visual.icone,
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {ICONE_FILTRO[item.id]}
                </span>

                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '26px', lineHeight: 1.1, color: '#FFFFFF' }}>
                    {contar(item.id)}
                  </strong>
                  <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', lineHeight: 1.35, color: '#D7DEEA' }}>
                    {item.rotulo}
                  </span>
                </span>
              </button>
            );
          })
        }
      </div>

      <div style={{ ...cartao, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${COR.borda}`, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '14px', color: COR.azul }}>B.O.M. criados</strong>
          <span style={{ flex: 1 }} />
          <input aria-label="Buscar B.O.M." style={{ ...campo, maxWidth: '280px' }} placeholder="Buscar nº, demanda, cliente ou responsável" value={busca} onChange={e => setBusca(e.target.value)} />
          <button type="button" style={botao('principal', !servico)} disabled={!servico} onClick={() => setNovoAberto(true)}>+ Novo B.O.M.</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
            <thead>
              <tr>
                {['B.O.M.', 'Demanda', 'Responsável', 'Etapa atual', 'Prazo da etapa', 'Go/No-Go', 'Atualizado', ''].map(coluna => (
                  <th key={coluna} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: COR.texto2, background: '#F8FAFC', borderBottom: `1px solid ${COR.borda}` }}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={8} style={{ padding: '18px', fontSize: '13px', color: COR.texto2 }}>Carregando…</td></tr>}
              {
                !carregando && visiveis.map(l => {
                  const est = ETAPAS[l.etapa];
                  return (
                    <tr key={l.bom.id} onClick={() => abrirBom(l.bom)} style={{ cursor: 'pointer' }}>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        <strong style={{ fontSize: '13px' }}>BOM {l.bom.numero.replace(/^BOM\s*/i, '')}</strong>
                        <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{l.bom.revisao} · criado {formatarData(l.bom.criadoEm)}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        <strong style={{ fontSize: '13px' }}>{l.demanda ? l.demanda.nome : '—'}</strong>
                        <div style={{ fontSize: '11.5px', color: COR.texto2 }}>
                          {l.demanda && l.demanda.cliente ? `${l.demanda.cliente} · ` : ''}{l.demanda ? (l.demanda.canal || 'Canal a definir') : ''}{l.demanda && l.demanda.modalidade ? ` · ${l.demanda.modalidade}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px' }}>{l.bom.responsavelNome}</td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        <span style={{ fontSize: '11px', color: COR.texto2, marginRight: '6px' }}>{est.passo}/5</span>
                        <Selo texto={est.texto} cor={est.cor} fundo={est.fundo} />
                        {aguardaVoce(l.bom) && <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#B45309', marginTop: '3px' }}>● Aguardando você</div>}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        {(() => {
                          const instancia = fluxoAtivo ? estadosFluxo[l.bom.id] : undefined;
                          const tarefa = instancia ? tarefaPendenteBom(instancia) : undefined;
                          return tarefa && tarefa.prazo
                            ? <SeloPrazo prazo={tarefa.prazo} situacao={situacaoPrazo(tarefa.prazo, tarefa.criadaEm)} />
                            : <span style={{ fontSize: '12px', color: COR.texto2 }}>—</span>;
                        })()}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        {l.analise ? <Selo texto={`${DECISAO[l.analise.decisao].texto} · ${formatarNumero(l.analise.pontuacao)}`} cor={DECISAO[l.analise.decisao].cor} fundo={DECISAO[l.analise.decisao].fundo} /> : <span style={{ fontSize: '12px', color: COR.texto2 }}>Sem análise</span>}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '12.5px' }}>{formatarData(l.bom.atualizadoEm)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'right' }}>
                        <button type="button" style={botao(l.etapa === 'Bloqueado no Go/No-Go' ? 'secundario' : 'principal')} onClick={e => { e.stopPropagation(); abrirBom(l.bom); }}>
                          {l.etapa === 'Dados da demanda' ? 'Preencher' : l.etapa === 'Bloqueado no Go/No-Go' ? 'Revisar' : 'Abrir etapa'} →
                        </button>
                      </td>
                    </tr>
                  );
                })
              }
              {!carregando && visiveis.length === 0 && <tr><td colSpan={8} style={{ padding: '22px', textAlign: 'center', fontSize: '13px', color: COR.texto2 }}>Nenhum B.O.M. neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: COR.texto2 }}>
        Etapas: 1 · Dados da demanda · 2 · Matriz Go/No-Go · 3 · Seleção de kit · 4 · Cálculo de HH · 5 · B.O.M. pronto → aprovação.
        {fluxoAtivo && fluxoDisp && fluxoDisp.processo ? ` Responsáveis, prazos e aprovações seguem o fluxo publicado do processo ${fluxoDisp.processo.codigo || fluxoDisp.processo.nome}.` : ''}
      </p>

      {
        fluxoDisp && contexto && (contexto.perfil === 'Administrador' || (contexto.modulosAdministrados || []).indexOf('arquitetura') >= 0) && (
          fluxoDisp.ativo
            ? (
              <div style={{ ...cartao, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '12.5px', padding: '10px 14px' }}>
                <span style={{ color: COR.texto2, flex: 1, minWidth: '240px' }}>
                  Fluxo do B.O.M.: processo <strong style={{ color: COR.azul }}>{fluxoDisp.processo ? `${fluxoDisp.processo.codigo} — ${fluxoDisp.processo.nome}` : ''}</strong>.
                  Para mudar etapas, responsáveis, prazos ou ações: Processos → Fluxos → abra o processo → nova versão → publicar.
                  B.O.M. em andamento continuam na versão em que começaram.
                </span>
                {onAbrirProcessos && <button type="button" style={botao('secundario')} onClick={onAbrirProcessos}>Abrir em Processos →</button>}
                {
                  fluxoDisp.fluxoSemDecisoes && fluxoServico && (
                    <div style={{ flexBasis: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', background: '#FFF4E5', color: '#7C2D12' }}>
                      <strong>O fluxo publicado (v{fluxoDisp.versaoPublicada}) tem atividades com mais de uma saída sem decisão.</strong>{' '}
                      Atualize para o modelo em que cada atividade tem uma saída e uma decisão distribui os caminhos. É criada uma nova versão;
                      a atual fica no histórico e os B.O.M. em andamento passam para a nova versão na mesma etapa ao serem abertos.
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                        <button
                          type="button"
                          style={botao('principal', criandoFluxo)}
                          disabled={criandoFluxo}
                          onClick={() => {
                            if (!window.confirm('Criar uma nova versão do fluxo ARQ-SOL com o modelo padrão (com decisões)? Alterações feitas à mão na versão atual não são levadas; um rascunho existente é substituído. As versões publicadas ficam no histórico.')) {
                              return;
                            }
                            setCriandoFluxo(true);
                            setPassosCriacao([]);
                            fluxoServico.criarFluxoEmProcessos(publicarAgora, true)
                              .then(resultado => {
                                setPassosCriacao(resultado.passos);
                                return carregar();
                              })
                              .catch(error => setPassosCriacao([{ ok: false, texto: (error as Error).message }]))
                              .then(() => setCriandoFluxo(false))
                              .catch(() => undefined);
                          }}
                        >
                          {criandoFluxo ? 'Atualizando…' : 'Atualizar o fluxo em Processos'}
                        </button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={publicarAgora} disabled={criandoFluxo} onChange={e => setPublicarAgora(e.target.checked)} />
                          Publicar agora (sem marcar, fica como rascunho para revisar no editor)
                        </label>
                      </div>
                    </div>
                  )
                }
                {
                  passosCriacao.length > 0 && (
                    <ul style={{ flexBasis: '100%', margin: '6px 0 0', paddingLeft: '18px' }}>
                      {passosCriacao.map((passo, indice) => (
                        <li key={indice} style={{ color: passo.ok ? '#107C10' : '#B42318' }}>{passo.ok ? '✓' : '✕'} {passo.texto}</li>
                      ))}
                    </ul>
                  )
                }
              </div>
            )
            : (
              <div role="status" style={{ ...cartao, background: '#FFF4E5', borderColor: '#B45309', color: '#7C2D12', fontSize: '12.5px', padding: '12px 14px' }}>
                <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '6px' }}>Fluxo de aprovação do B.O.M. inativo</strong>
                <div style={{ display: 'grid', gap: '3px', marginBottom: '8px' }}>
                  <span>{fluxoDisp.processoEncontrado ? '✓' : '✕'} Processo {fluxoDisp.processo ? `${fluxoDisp.processo.codigo} — ${fluxoDisp.processo.nome}` : 'ARQ-SOL'} em Processos</span>
                  <span>{fluxoDisp.fluxoPublicado ? '✓' : '✕'} Fluxo publicado{fluxoDisp.temRascunho && !fluxoDisp.fluxoPublicado ? ' (há um rascunho: abra em Processos e publique)' : ''}</span>
                  <span>{fluxoDisp.colunaCriada ? '✓' : '✕'} Coluna do estado do fluxo no B.O.M. (scripts/dataverse/criar-fluxo-bom.ps1)</span>
                </div>
                <div style={{ marginBottom: '8px' }}>{fluxoDisp.motivo}</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {
                    !fluxoDisp.fluxoPublicado && !fluxoDisp.temRascunho && fluxoServico && (
                      <>
                        <button
                          type="button"
                          style={botao('principal', criandoFluxo)}
                          disabled={criandoFluxo}
                          onClick={() => {
                            const texto = fluxoDisp.processoEncontrado
                              ? 'Criar o fluxo padrão do B.O.M. no processo existente? Os campos do processo são mantidos; nada é apagado.'
                              : 'Criar o processo ARQ-SOL com os campos e o fluxo padrão do B.O.M. em Processos? Nenhum ambiente é criado.';
                            if (!window.confirm(texto)) {
                              return;
                            }
                            setCriandoFluxo(true);
                            setPassosCriacao([]);
                            fluxoServico.criarFluxoEmProcessos(publicarAgora)
                              .then(resultado => {
                                setPassosCriacao(resultado.passos);
                                return carregar();
                              })
                              .catch(error => setPassosCriacao([{ ok: false, texto: (error as Error).message }]))
                              .then(() => setCriandoFluxo(false))
                              .catch(() => undefined);
                          }}
                        >
                          {criandoFluxo ? 'Criando…' : 'Criar o fluxo em Processos'}
                        </button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={publicarAgora} disabled={criandoFluxo} onChange={e => setPublicarAgora(e.target.checked)} />
                          Publicar agora (sem marcar, fica como rascunho para revisar no editor)
                        </label>
                      </>
                    )
                  }
                  {onAbrirProcessos && (fluxoDisp.processoEncontrado || passosCriacao.length > 0) && (
                    <button type="button" style={botao('secundario')} onClick={onAbrirProcessos}>Abrir em Processos →</button>
                  )}
                </div>
                {
                  passosCriacao.length > 0 && (
                    <ul style={{ margin: '10px 0 0', paddingLeft: '18px' }}>
                      {passosCriacao.map((passo, indice) => (
                        <li key={indice} style={{ color: passo.ok ? '#107C10' : '#B42318' }}>{passo.ok ? '✓' : '✕'} {passo.texto}</li>
                      ))}
                    </ul>
                  )
                }
              </div>
            )
        )
      }

      {
        novoAberto && servico && (
          <NovoBomModal
            demandasLivres={demandasLivres}
            usuarios={usuarios.filter(u => membrosArea.length === 0 || membrosArea.indexOf(u.id) >= 0 || u.id === meuUsuario)}
            responsavelPadrao={meuUsuario}
            salvando={salvando}
            onFechar={() => setNovoAberto(false)}
            onCriar={(demandaId, responsavelId) => {
              let novoId = '';
              executar(async () => {
                novoId = await servico.criarBom({ demandaId, responsavelId, areaId: areaArqId || undefined });
              }, 'B.O.M. criado.')
                .then(() => {
                  setNovoAberto(false);
                  if (novoId) {
                    setBomId(guid(novoId));
                    setAba('demanda');
                  }
                })
                .catch(() => undefined);
            }}
          />
        )
      }
    </section>
  );
};

export default ArquiteturaPage;
