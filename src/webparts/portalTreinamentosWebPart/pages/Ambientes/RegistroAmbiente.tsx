import * as React from 'react';

import {
  IAmbiente,
  IAmbienteRegistro,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  IFluxoElemento
} from '../../models/Fluxo';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IEstadoFluxoRegistro
} from '../../services/ambientes/AmbienteFluxoService';

import {
  IAmbienteLayout,
  estadoDaEtapa,
  etapasDoFluxo
} from '../../services/ambientes/layoutAmbiente';

import {
  formatarValorCampo
} from '../../services/fluxo/FluxoEngine';

import {
  IDadosRevisaoResponsaveis
} from '../../services/fluxo/ResolvedorResponsaveis';

import {
  DataverseService
} from '../../services/DataverseService';

import PainelFluxoOrcamento from
  '../Orcamento/PainelFluxoOrcamento';

import PainelAssinatura, {
  IPainelAssinaturaProps
} from '../../components/fluxo/PainelAssinatura';

import AnexosRegistro from './AnexosRegistro';

import HistoricoRegistroAmbiente from './HistoricoRegistroAmbiente';

import {
  AnexosAmbienteService,
  IRegraAnexos
} from '../../services/ambientes/AnexosAmbienteService';

import FluxoDiagrama from '../../components/fluxo/FluxoDiagrama';

import {
  obterElementoAtual,
  tarefaPendente
} from '../../services/fluxo/FluxoEngine';

import {
  descreverResolvido,
  resolverResponsaveis
} from '../../services/fluxo/ResolvedorResponsaveis';

import {
  lerValorDocumentos
} from '../../services/fluxo/valorDocumento';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import {
  COR,
  CaixaMensagem,
  FONTE,
  Selo,
  SeloPrazo,
  botao,
  cartao,
  formatarDataHora
} from '../Orcamento/orcamentoComum';

// ============================================================
// TELA DO REGISTRO (configurável)
//
// Cabeçalho + BARRA DE ETAPAS do processo (como em Arquitetura de
// Soluções): ✓ concluída, etapa atual, futura. Clicar numa etapa:
//   atual     → painel do fluxo (campos e botões da etapa)
//   concluída → o que foi preenchido, por quem e quando
//   futura    → o que será pedido nela
// As etapas exibidas e seus nomes vêm do layout do ambiente.
// ============================================================

export interface IRegistroAmbienteProps {
  ambiente: IAmbiente;
  registro: IAmbienteRegistro;
  layout: IAmbienteLayout;
  estado?: IEstadoFluxoRegistro;
  carregando: boolean;
  podeAgir: boolean;
  processando: boolean;
  podeCancelar: boolean;
  podeIniciar: boolean;
  motivoNaoIniciar?: string;
  dadosResponsaveis: IDadosRevisaoResponsaveis;
  vinculos: IUsuarioAreaAdmin[];
  usuarios: Array<{ id: string; nome: string }>;
  onVoltar: () => void;
  onCancelar: () => void;
  // Menu ⋮ (Administrador do Sistema): Cancelar registro e Editar como
  // administrador. Sem isso, o menu não aparece.
  podeAdministrarSistema?: boolean;
  onEditarComoAdministrador?: (valores: Record<string, string>, comentario: string) => Promise<string[]>;
  // "Executar ação como administrador": botões da etapa liberados para o
  // Administrador do Sistema, com justificativa obrigatória.
  onExecutarComoAdministrador?: (acaoChave: string, comentario: string, valores: Record<string, string>) => Promise<string[]>;
  onIniciarFluxo: () => void;
  onExecutar: (acaoChave: string, comentario: string, valores: Record<string, string>) => Promise<string[]>;
  // Campos do tipo Componente (dados do Dataverse).
  dataverseService?: DataverseService;
  // Fluxo parado em "Assinatura digital": acompanhamento.
  assinatura?: IPainelAssinaturaProps;
  // Configuração do ambiente: sequência de atividades no topo
  // (undefined = mostra, como nos ambientes antigos).
  mostrarSequencia?: boolean;
  // Anexos do registro (ambiente com "Permitir anexar arquivos").
  anexos?: {
    servico: AnexosAmbienteService;
    pasta: string;
    regra: IRegraAnexos;
    onQuantidade?: (quantidade: number) => void;
  };
}

const CORES_SITUACAO: Record<SituacaoRegistroAmbiente, { texto: string; cor: string; fundo: string }> = {
  emAndamento: { texto: 'Em andamento', cor: '#0F4C81', fundo: '#E8F2FF' },
  concluido: { texto: 'Concluído', cor: '#107C10', fundo: '#E7F6EC' },
  cancelado: { texto: 'Cancelado', cor: '#64748b', fundo: '#F1F5F9' }
};

const ESCURO = {
  azul: '#0B5CAB',
  verde: '#107C10',
  trilho: '#E2E8F0',
  texto: '#202A44',
  texto2: '#64748B'
};

const rotuloInfo: React.CSSProperties = { fontSize: '11.5px', color: COR.texto2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' };
const valorInfo: React.CSSProperties = { fontSize: '13.5px', color: COR.azul, whiteSpace: 'pre-line', wordBreak: 'break-word' };

// ------------------------------------------------------------
// Menu ⋮ do Administrador do Sistema
// ------------------------------------------------------------
const MenuAdministrador: React.FC<{ desabilitado: boolean; onCancelar: () => void; onEditar: () => void; onExecutar?: () => void }> = ({ desabilitado, onCancelar, onEditar, onExecutar }) => {
  const [aberto, setAberto] = React.useState(false);
  const item: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', border: 0, background: '#FFFFFF', padding: '9px 14px',
    fontSize: '13px', fontWeight: 600, color: COR.azul, cursor: 'pointer', fontFamily: FONTE, whiteSpace: 'nowrap'
  };
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label="Ações do administrador"
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={desabilitado}
        onClick={() => setAberto(!aberto)}
        style={{ ...botao('secundario', desabilitado), minWidth: '36px', fontSize: '18px', lineHeight: '18px', padding: '0 10px' }}
      >
        ⋮
      </button>
      {aberto && (
        <div
          role="menu"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '8px', boxShadow: '0 8px 24px rgba(15,23,42,.14)', overflow: 'hidden', minWidth: '210px' }}
        >
          <button type="button" role="menuitem" style={item} onClick={() => { setAberto(false); onEditar(); }}>Editar como administrador</button>
          {onExecutar && (
            <button type="button" role="menuitem" style={{ ...item, borderTop: `1px solid ${COR.borda}` }} onClick={() => { setAberto(false); onExecutar(); }}>Executar ação como administrador</button>
          )}
          <button type="button" role="menuitem" style={{ ...item, color: '#B42318', borderTop: `1px solid ${COR.borda}` }} onClick={() => { setAberto(false); onCancelar(); }}>Cancelar registro</button>
        </div>
      )}
    </span>
  );
};

const RegistroAmbiente: React.FC<IRegistroAmbienteProps> = (props) => {

  const { ambiente, registro, layout, estado } = props;
  const definicao = estado ? estado.definicao : undefined;
  const instancia = estado ? estado.instancia : undefined;

  // Etapas da barra: as do layout que existem na versão do fluxo deste
  // registro; se nenhuma bater (registro numa versão antiga), as da
  // própria versão.
  const etapas: Array<{ elemento: IFluxoElemento; rotulo: string }> = React.useMemo(() => {
    if (!definicao) {
      return [];
    }
    const doLayout =
      layout.etapas
        .filter(item => item.visivel)
        .map(item => ({ item, elemento: definicao.elementos.find(el => el.id === item.elementoId) }))
        .filter(par => !!par.elemento)
        .map(par => ({ elemento: par.elemento as IFluxoElemento, rotulo: par.item.rotulo || (par.elemento as IFluxoElemento).nome }));
    return doLayout.length > 0
      ? doLayout
      : etapasDoFluxo(definicao).map(elemento => ({ elemento, rotulo: elemento.nome }));
  }, [definicao, layout]);

  const atualId = instancia && instancia.status !== 'concluido' ? instancia.elementoAtualId : '';
  const [selecionada, setSelecionada] = React.useState<string>('');

  // Ao carregar/avançar o fluxo: seleciona a etapa atual.
  React.useEffect(() => {
    setSelecionada(atualId);
  }, [registro.id, atualId]);

  const etapaSelecionada = etapas.find(item => item.elemento.id === selecionada);
  const mostrarPainel = !etapaSelecionada || selecionada === atualId;

  const situacao = CORES_SITUACAO[registro.situacao] || CORES_SITUACAO.emAndamento;

  // Duas colunas (padrão): dados à esquerda, campos da etapa à direita.
  const duasColunas = layout.registro.disposicao !== 'umaColuna';
  // "Ver fluxo" sempre começa recolhido; a sequência começa visível
  // (se o ambiente a mostra). Ao abrir outro registro, volta ao início.
  // Painel da direita: o que foi escolhido na coluna da esquerda.
  //   dados     → metadados e valores (campos e ações da etapa)
  //   historico → todas as ocorrências do registro
  //   fluxo     → fluxograma
  const [visaoDireita, setVisaoDireita] = React.useState<'dados' | 'historico' | 'fluxo'>('dados');
  const [sequenciaVisivel, setSequenciaVisivel] = React.useState(true);
  // "Editar como administrador" (menu ⋮).
  const [modoAdmin, setModoAdmin] = React.useState(false);
  // "Executar ação como administrador" (menu ⋮).
  const [modoExecucaoAdmin, setModoExecucaoAdmin] = React.useState(false);
  // Configuração do ambiente (ambiente antigo sem a opção = mostra).
  const mostrarSequencia =
    props.mostrarSequencia !== undefined ? props.mostrarSequencia : ambiente.mostrarSequencia !== false;
  React.useEffect(() => {
    setVisaoDireita('dados');
    setSequenciaVisivel(true);
    setModoAdmin(false);
    setModoExecucaoAdmin(false);
  }, [registro.id]);

  // Ao avançar a etapa, sai do modo de execução administrativa.
  React.useEffect(() => {
    setModoExecucaoAdmin(false);
  }, [atualId]);

  const edicaoAdmin = modoAdmin && !!props.podeAdministrarSistema && !!props.onEditarComoAdministrador && registro.situacao === 'emAndamento';
  const propsEdicaoAdmin = {
    modoEdicaoAdmin: edicaoAdmin,
    onSalvarAdmin: async (valores: Record<string, string>, comentario: string): Promise<string[]> => {
      if (!props.onEditarComoAdministrador) {
        return ['Edição administrativa indisponível.'];
      }
      const erros = await props.onEditarComoAdministrador(valores, comentario);
      if (erros.length === 0) {
        setModoAdmin(false);
      }
      return erros;
    },
    onCancelarEdicaoAdmin: () => setModoAdmin(false)
  };

  const execucaoAdmin =
    modoExecucaoAdmin && !edicaoAdmin && !!props.podeAdministrarSistema && !!props.onExecutarComoAdministrador && registro.situacao === 'emAndamento';
  // No modo administrativo os botões da etapa ficam liberados e a ação
  // vai para onExecutarComoAdministrador (justificativa obrigatória).
  const podeAgirPainel = props.podeAgir || execucaoAdmin;
  const onExecutarPainel = async (acaoChave: string, comentario: string, valores: Record<string, string>): Promise<string[]> => {
    if (execucaoAdmin && !props.podeAgir && props.onExecutarComoAdministrador) {
      if (!(comentario || '').trim()) {
        return ['Informe no comentário a justificativa da ação executada como administrador.'];
      }
      const erros = await props.onExecutarComoAdministrador(acaoChave, comentario, valores);
      if (erros.length === 0) {
        setModoExecucaoAdmin(false);
      }
      return erros;
    }
    return props.onExecutar(acaoChave, comentario, valores);
  };
  const avisoExecucaoAdmin = execucaoAdmin && !props.podeAgir ? (
    <div data-execucao-admin="true" style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '8px', background: '#FFF7E6', border: '1px solid #F5C26B', fontSize: '12.5px', color: '#7A4B00' }}>
      <strong>Executando como administrador.</strong> A ação será registrada no histórico em seu nome, marcada como administrativa.
      O comentário é obrigatório e serve de justificativa.{' '}
      <button type="button" onClick={() => setModoExecucaoAdmin(false)} style={{ border: 0, background: 'transparent', color: '#0874CE', fontWeight: 700, cursor: 'pointer', fontFamily: FONTE, fontSize: '12.5px', padding: 0 }}>
        Sair do modo administrador
      </button>
    </div>
  ) : null;

  const elementoAtual = definicao && instancia ? obterElementoAtual(definicao, instancia) : undefined;
  const tarefaAtual = instancia ? tarefaPendente(instancia) : undefined;
  const responsaveisAtuais =
    tarefaAtual
      ? resolverResponsaveis(tarefaAtual.responsaveis, props.dadosResponsaveis)
        .map(item => descreverResolvido(item, props.vinculos, props.usuarios))
        .filter((texto, indice, lista) => !!texto && lista.indexOf(texto) === indice)
      : [];
  const indiceEtapa = elementoAtual ? etapas.findIndex(item => item.elemento.id === elementoAtual.id) : -1;
  const posicaoEtapa = indiceEtapa >= 0 ? `etapa ${indiceEtapa + 1} de ${etapas.length}` : '';

  // Campos do tipo documento preenchidos (referências do registro).
  const documentosRelacionados =
    definicao && instancia
      ? (definicao.metadados || [])
        .filter(meta => (meta.tipo === 'documento' || meta.tipo === 'documentos') && !!instancia.valores[meta.chave])
        .map(meta => ({ rotulo: meta.rotulo, documentos: lerValorDocumentos(instancia.valores[meta.chave]) }))
        .filter(grupo => grupo.documentos.length > 0)
      : [];

  const concluidaPor = (elementoId: string): { nome: string; data: string } | undefined => {
    if (!instancia) {
      return undefined;
    }
    const passo = instancia.historico.find(item => item.elementoId === elementoId && !item.sistema);
    return passo ? { nome: passo.executadoPorNome, data: passo.data } : undefined;
  };

  const camposDaEtapa = (elemento: IFluxoElemento): React.ReactNode => {
    const campos = elemento.campos || [];
    if (campos.length === 0) {
      return <div style={{ fontSize: '13px', color: COR.texto2 }}>Esta etapa não tem campos.</div>;
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
        {campos.map(campo => (
          <div key={campo.chave}>
            <div style={rotuloInfo}>{campo.rotulo}</div>
            <div style={valorInfo}>{formatarValorCampo(campo.tipo, (instancia && instancia.valores[campo.chave]) || '') || '—'}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: FONTE }}>

      {/* Cabeçalho + barra de etapas */}
      <div style={{ ...cartao, marginBottom: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <button type="button" onClick={props.onVoltar} style={botao('secundario')}>← Visão geral</button>
          <span style={{ padding: '5px 10px', borderRadius: '8px', background: '#EEF4FA', color: ESCURO.texto, fontSize: '12.5px', fontWeight: 700 }}>
            {registro.codigo}
          </span>
          <strong style={{ fontSize: '16px', color: ESCURO.texto, flex: 1, minWidth: '200px' }}>{registro.titulo}</strong>
          <Selo texto={situacao.texto} cor={situacao.cor} fundo={situacao.fundo} />
          {mostrarSequencia && etapas.length > 0 && (
            <button
              type="button"
              aria-expanded={sequenciaVisivel}
              onClick={() => setSequenciaVisivel(!sequenciaVisivel)}
              style={botao('secundario')}
            >
              {sequenciaVisivel ? 'Ocultar sequência' : 'Mostrar sequência'}
            </button>
          )}
          {props.podeAdministrarSistema && registro.situacao === 'emAndamento' && (
            <MenuAdministrador
              desabilitado={props.processando}
              onCancelar={props.onCancelar}
              onEditar={() => { setModoExecucaoAdmin(false); setModoAdmin(true); setVisaoDireita('dados'); }}
              onExecutar={
                props.onExecutarComoAdministrador && estado && instancia && instancia.status === 'emAndamento'
                  ? () => { setModoAdmin(false); setModoExecucaoAdmin(true); setSelecionada(atualId); setVisaoDireita('dados'); }
                  : undefined
              }
            />
          )}
        </div>

        {/* Sequência de atividades: cartões compactos, rolagem horizontal. */}
        {mostrarSequencia && sequenciaVisivel && etapas.length > 0 && (
          <div
            role="list"
            aria-label="Sequência de atividades"
            style={{ display: 'flex', alignItems: 'center', marginTop: '14px', overflowX: 'auto', paddingBottom: '6px' }}
          >
            {etapas.map((etapa, indice) => {
              const estadoEtapa = estadoDaEtapa(etapa.elemento.id, instancia);
              const concluida = estadoEtapa === 'concluida';
              const atual = estadoEtapa === 'atual';
              const marcada = selecionada === etapa.elemento.id;
              const corBorda = atual ? ESCURO.azul : concluida ? ESCURO.verde : '#CBD5E1';
              return (
                <React.Fragment key={etapa.elemento.id}>
                  <button
                    type="button"
                    role="listitem"
                    data-estado={estadoEtapa}
                    title={`${indice + 1}. ${etapa.rotulo} — ${concluida ? 'concluída' : atual ? 'etapa atual' : 'a fazer'}`}
                    onClick={() => setSelecionada(etapa.elemento.id)}
                    aria-current={atual ? 'step' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      flex: '0 0 auto',
                      width: atual ? '200px' : '170px',
                      padding: atual ? '9px 11px' : '7px 10px',
                      borderRadius: '10px',
                      border: `${atual ? 2 : 1}px solid ${corBorda}`,
                      background: atual ? ESCURO.azul : concluida ? '#E7F6EC' : '#F7F9FB',
                      boxShadow: atual ? '0 4px 12px rgba(11,92,171,.25)' : marcada ? `0 0 0 3px ${concluida ? 'rgba(16,124,16,.18)' : 'rgba(100,116,139,.18)'}` : 'none',
                      cursor: 'pointer',
                      fontFamily: FONTE,
                      textAlign: 'left'
                    }}
                  >
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: atual ? '#FFFFFF' : concluida ? ESCURO.verde : '#E2E8F0',
                        color: atual ? ESCURO.azul : concluida ? '#FFFFFF' : ESCURO.texto2,
                        fontSize: '12px',
                        fontWeight: 800
                      }}
                    >
                      {concluida ? '✓' : indice + 1}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: atual ? '13px' : '12.5px',
                          lineHeight: '16px',
                          color: atual ? '#FFFFFF' : concluida ? '#0E5A12' : ESCURO.texto2
                        }}
                      >
                        {etapa.rotulo}
                      </strong>
                      <span style={{ display: 'block', marginTop: '2px', fontSize: '11px', fontWeight: 700, color: atual ? '#D6E7FB' : concluida ? ESCURO.verde : ESCURO.texto2 }}>
                        {concluida ? 'Concluída' : atual ? 'Etapa atual' : 'A fazer'}
                      </span>
                    </span>
                  </button>
                  {indice < etapas.length - 1 && (
                    <span
                      aria-hidden="true"
                      style={{ flex: '0 0 18px', height: '2px', margin: '0 4px', borderRadius: '2px', background: concluida ? ESCURO.verde : ESCURO.trilho }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {props.carregando && <CaixaMensagem tipo="info" texto="Carregando o fluxo..." />}

      {!props.carregando && !estado && registro.situacao === 'emAndamento' && (
        <div style={{ ...cartao, marginBottom: 0 }}>
          <div style={{ fontSize: '13.5px', color: COR.azul, marginBottom: '8px' }}>O fluxo deste registro ainda não foi iniciado.</div>
          <button type="button" disabled={props.processando || !props.podeIniciar} onClick={props.onIniciarFluxo} style={botao('principal', props.processando || !props.podeIniciar)}>
            Iniciar fluxo
          </button>
          {!props.podeIniciar && props.motivoNaoIniciar && <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>{props.motivoNaoIniciar}</div>}
        </div>
      )}

      {/* Etapa escolhida */}
      {!props.carregando && estado && !mostrarPainel && etapaSelecionada && (
        <div style={{ ...cartao, marginBottom: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
            <strong style={{ fontSize: '15px', color: COR.azul }}>{etapaSelecionada.rotulo}</strong>
            {estadoDaEtapa(etapaSelecionada.elemento.id, instancia) === 'concluida'
              ? (() => {
                const quem = concluidaPor(etapaSelecionada.elemento.id);
                return <span style={{ fontSize: '12.5px', color: COR.texto2 }}>Concluída{quem ? ` por ${quem.nome} em ${formatarDataHora(quem.data)}` : ''}</span>;
              })()
              : <span style={{ fontSize: '12.5px', color: COR.texto2 }}>Ainda não alcançada — estes campos serão pedidos nela.</span>}
            <button
              type="button"
              onClick={() => setSelecionada(atualId)}
              style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: '#0874CE', fontWeight: 700, cursor: 'pointer', fontFamily: FONTE, fontSize: '12.5px' }}
            >
              Ir para a etapa atual →
            </button>
          </div>
          {etapaSelecionada.elemento.instrucoes && (
            <div style={{ fontSize: '12.5px', color: COR.texto2, marginBottom: '10px', whiteSpace: 'pre-line' }}>{etapaSelecionada.elemento.instrucoes}</div>
          )}
          {camposDaEtapa(etapaSelecionada.elemento)}
        </div>
      )}

      {!props.carregando && estado && mostrarPainel && duasColunas && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>

            {/* ESQUERDA: dados do registro */}
            <div style={{ flex: '0 1 340px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Menu: escolhe o que aparece no painel da direita */}
              <nav aria-label="Seções do registro" style={{ ...cartao, marginBottom: 0, padding: '6px' }}>
                {([
                  { chave: 'dados', icone: '☰', rotulo: 'Dados do documento', contador: undefined as number | undefined, visivel: true },
                  { chave: 'historico', icone: '⟲', rotulo: 'Histórico', contador: instancia ? instancia.historico.length : undefined, visivel: layout.registro.mostrarHistorico !== false },
                  { chave: 'fluxo', icone: '⧉', rotulo: 'Ver fluxo', contador: undefined as number | undefined, visivel: true }
                ] as Array<{ chave: 'dados' | 'historico' | 'fluxo'; icone: string; rotulo: string; contador?: number; visivel: boolean }>)
                  .filter(item => item.visivel)
                  .map(item => {
                    const ativo = visaoDireita === item.chave;
                    return (
                      <button
                        key={item.chave}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setVisaoDireita(item.chave)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 10px', margin: '1px 0',
                          border: 0, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontFamily: FONTE,
                          background: ativo ? ESCURO.azul : 'transparent', color: ativo ? '#FFFFFF' : ESCURO.texto,
                          fontSize: '13.5px', fontWeight: 700
                        }}
                      >
                        <span aria-hidden="true" style={{ width: '18px', textAlign: 'center', opacity: ativo ? 1 : 0.7 }}>{item.icone}</span>
                        <span style={{ flex: 1 }}>{item.rotulo}</span>
                        {item.contador !== undefined && (
                          <span style={{ minWidth: '22px', padding: '1px 7px', borderRadius: '999px', fontSize: '11.5px', textAlign: 'center', background: ativo ? 'rgba(255,255,255,.22)' : '#EEF2F7', color: ativo ? '#FFFFFF' : ESCURO.texto2 }}>
                            {item.contador}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </nav>

              {/* Resumo do registro */}
              <div style={{ ...cartao, marginBottom: 0, padding: 0, overflow: 'hidden' }}>

                {/* Identificação */}
                <div style={{ padding: '14px 16px 12px' }}>
                  <div style={{ ...rotuloInfo, marginBottom: '2px' }}>{ambiente.rotuloRegistro}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: ESCURO.texto, lineHeight: '21px', wordBreak: 'break-word' }}>{registro.titulo}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#EEF4FA', color: ESCURO.texto, fontSize: '12px', fontWeight: 700 }}>{registro.codigo}</span>
                    <Selo texto={situacao.texto} cor={situacao.cor} fundo={situacao.fundo} />
                  </div>
                </div>

                {/* Etapa atual em destaque */}
                <div style={{ margin: '0 12px', padding: '12px', borderRadius: '10px', background: '#F3F8FE', border: '1px solid #D6E7FB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={rotuloInfo}>Etapa atual</span>
                    {posicaoEtapa && <span style={{ fontSize: '11.5px', fontWeight: 700, color: ESCURO.azul }}>{indiceEtapa + 1}/{etapas.length}</span>}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: ESCURO.texto, marginTop: '3px', lineHeight: '19px' }}>
                    {instancia && instancia.status === 'concluido' ? 'Concluído' : (elementoAtual ? elementoAtual.nome : '—')}
                  </div>
                  {indiceEtapa >= 0 && etapas.length > 0 && (
                    <div aria-hidden="true" style={{ height: '5px', borderRadius: '3px', background: '#DCE6F2', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(((indiceEtapa + 1) / etapas.length) * 100)}%`, height: '100%', background: ESCURO.azul, borderRadius: '3px' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        aria-hidden="true"
                        style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: ESCURO.azul, color: '#FFFFFF', fontSize: '11px', fontWeight: 800 }}
                      >
                        {(responsaveisAtuais[0] || '?').split(' ').filter(Boolean).slice(0, 2).map(parte => parte.charAt(0).toUpperCase()).join('')}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '11px', color: ESCURO.texto2 }}>Responsável</span>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: ESCURO.texto, wordBreak: 'break-word' }}>
                          {responsaveisAtuais.length > 0 ? responsaveisAtuais.join(' · ') : '—'}
                        </span>
                      </span>
                    </div>
                    {tarefaAtual && tarefaAtual.prazo && (
                      <div><SeloPrazo prazo={tarefaAtual.prazo} situacao={situacaoPrazo(tarefaAtual.prazo, tarefaAtual.criadaEm)} /></div>
                    )}
                  </div>
                </div>

                {/* Detalhes: rótulo à esquerda, valor à direita */}
                <dl style={{ margin: 0, padding: '10px 16px 4px' }}>
                  {[
                    { rotulo: 'Aberto por', valor: registro.solicitanteNome || '—' },
                    { rotulo: 'Aberto em', valor: formatarDataHora(registro.criadoEm) },
                    { rotulo: 'Área', valor: registro.areaNome || '' }
                  ]
                    .filter(item => !!item.valor)
                    .map(item => (
                      <div key={item.rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: `1px solid ${COR.borda}` }}>
                        <dt style={{ fontSize: '12.5px', color: ESCURO.texto2 }}>{item.rotulo}</dt>
                        <dd style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: ESCURO.texto, textAlign: 'right', wordBreak: 'break-word' }}>{item.valor}</dd>
                      </div>
                    ))}
                </dl>

                {registro.descricao && (
                  <div style={{ padding: '8px 16px 14px' }}>
                    <div style={{ fontSize: '12.5px', color: ESCURO.texto2, marginBottom: '4px' }}>Descrição</div>
                    <div style={{ fontSize: '13px', color: ESCURO.texto, padding: '8px 10px', background: '#F7F9FB', borderLeft: '3px solid #05C3DD', borderRadius: '4px', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                      {registro.descricao}
                    </div>
                  </div>
                )}
                {!registro.descricao && <div style={{ height: '10px' }} />}
              </div>

              {props.anexos && props.anexos.regra.visivel && (
                <AnexosRegistro servico={props.anexos.servico} pasta={props.anexos.pasta} regra={props.anexos.regra} onQuantidade={props.anexos.onQuantidade} />
              )}

              {/* Documentos relacionados */}
              {documentosRelacionados.length > 0 && (
                <div style={{ ...cartao, marginBottom: 0 }}>
                  <strong style={{ display: 'block', fontSize: '14px', color: COR.azul, marginBottom: '8px' }}>Documentos relacionados</strong>
                  {documentosRelacionados.map(grupo => (
                    <div key={grupo.rotulo} style={{ marginBottom: '8px' }}>
                      <div style={rotuloInfo}>{grupo.rotulo}</div>
                      {grupo.documentos.map(doc => (
                        <div key={doc.id} style={valorInfo}><strong>{doc.codigo}</strong>{doc.titulo ? ` — ${doc.titulo}` : ''}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DIREITA: campos da etapa */}
            <div style={{ ...cartao, marginBottom: 0, flex: '1 1 460px', minWidth: 0 }}>
              {visaoDireita === 'historico' && instancia && (
                <HistoricoRegistroAmbiente historico={instancia.historico} />
              )}
              {visaoDireita === 'fluxo' && instancia && definicao && (
                <>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '8px' }}>
                    Fluxo de {ambiente.nome} · {instancia.processoNome || definicao.nome} · v{definicao.versao}
                  </div>
                  <div style={{ overflowX: 'auto', maxWidth: '100%', border: `1px solid ${COR.borda}`, borderRadius: '8px', background: '#FFFFFF' }}>
                    <FluxoDiagrama definicao={definicao} instancia={instancia} />
                  </div>
                </>
              )}
              <div style={{ display: visaoDireita === 'dados' ? 'block' : 'none' }}>
              <strong style={{ display: 'block', fontSize: '14px', color: COR.azul, marginBottom: '10px' }}>
                {instancia && instancia.status === 'concluido' ? 'Fluxo encerrado' : `Etapa: ${elementoAtual ? elementoAtual.nome : '—'}`}
              </strong>
              {props.assinatura && <div style={{ marginBottom: '10px' }}><PainelAssinatura {...props.assinatura} /></div>}
              {avisoExecucaoAdmin}
              <PainelFluxoOrcamento
                {...propsEdicaoAdmin}
                estado={estado}
                dadosResponsaveis={props.dadosResponsaveis}
                vinculos={props.vinculos}
                usuarios={props.usuarios}
                podeAgir={podeAgirPainel}
                processando={props.processando}
                onExecutar={onExecutarPainel}
                textoConcluido={registro.situacao === 'cancelado' ? 'Registro cancelado' : `✓ ${ambiente.rotuloRegistro} concluído(a) — fluxo encerrado`}
                modoCompacto={true}
                ocultarHistorico={true}
                dataverseService={props.dataverseService}
              />
              </div>
            </div>
          </div>

        </>
      )}

      {!props.carregando && estado && mostrarPainel && !duasColunas && props.assinatura && (
        <PainelAssinatura {...props.assinatura} />
      )}

      {!props.carregando && estado && mostrarPainel && !duasColunas && avisoExecucaoAdmin}

      {!props.carregando && estado && mostrarPainel && !duasColunas && (
        <PainelFluxoOrcamento
                {...propsEdicaoAdmin}
          estado={estado}
          dadosResponsaveis={props.dadosResponsaveis}
          vinculos={props.vinculos}
          usuarios={props.usuarios}
          podeAgir={podeAgirPainel}
          processando={props.processando}
          onExecutar={onExecutarPainel}
          rotuloFluxo={`Fluxo de ${ambiente.nome}`}
          textoConcluido={registro.situacao === 'cancelado' ? 'Registro cancelado' : `✓ ${ambiente.rotuloRegistro} concluído(a) — fluxo encerrado`}
          diagramaAberto={layout.registro.mostrarDiagrama}
          ocultarHistorico={!layout.registro.mostrarHistorico}
          dataverseService={props.dataverseService}
        />
      )}

      {!duasColunas && props.anexos && props.anexos.regra.visivel && (
        <AnexosRegistro servico={props.anexos.servico} pasta={props.anexos.pasta} regra={props.anexos.regra} onQuantidade={props.anexos.onQuantidade} />
      )}

      {/* O quadro "Campos preenchidos" saiu: a etapa mostra só os campos
          configurados nela (os valores continuam gravados). */}
    </div>
  );
};

export default RegistroAmbiente;
