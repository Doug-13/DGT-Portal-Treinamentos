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

import PainelFluxoOrcamento from
  '../Orcamento/PainelFluxoOrcamento';

import {
  COR,
  CaixaMensagem,
  FONTE,
  Selo,
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
  onIniciarFluxo: () => void;
  onExecutar: (acaoChave: string, comentario: string, valores: Record<string, string>) => Promise<string[]>;
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
          {props.podeCancelar && registro.situacao === 'emAndamento' && (
            <button type="button" disabled={props.processando} onClick={props.onCancelar} style={botao('perigo', props.processando)}>
              Cancelar registro
            </button>
          )}
        </div>

        {etapas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px', overflowX: 'auto' }}>
            {etapas.map((etapa, indice) => {
              const estadoEtapa = estadoDaEtapa(etapa.elemento.id, instancia);
              const concluida = estadoEtapa === 'concluida';
              const atual = estadoEtapa === 'atual';
              const marcada = selecionada === etapa.elemento.id;
              return (
                <React.Fragment key={etapa.elemento.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionada(etapa.elemento.id)}
                    aria-current={atual ? 'step' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexShrink: 0,
                      padding: '6px 8px',
                      borderRadius: '10px',
                      border: 0,
                      background: marcada ? '#EEF6FF' : 'transparent',
                      cursor: 'pointer',
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
                        background: concluida ? ESCURO.verde : atual ? ESCURO.azul : '#EEF2F6',
                        color: concluida || atual ? '#FFFFFF' : ESCURO.texto2,
                        fontSize: '13px',
                        fontWeight: 800,
                        boxShadow: atual ? '0 0 0 4px rgba(11,92,171,.15)' : 'none'
                      }}
                    >
                      {concluida ? '✓' : indice + 1}
                    </span>
                    <span>
                      <strong style={{ display: 'block', fontSize: '13px', color: concluida || atual ? ESCURO.texto : ESCURO.texto2, whiteSpace: 'nowrap' }}>
                        {etapa.rotulo}
                      </strong>
                      <span style={{ display: 'block', marginTop: '2px', fontSize: '11.5px', color: ESCURO.texto2, whiteSpace: 'nowrap' }}>
                        {concluida ? 'Concluída' : atual ? 'Etapa atual' : 'A fazer'}
                      </span>
                    </span>
                  </button>
                  {indice < etapas.length - 1 && (
                    <span
                      aria-hidden="true"
                      style={{ flex: 1, minWidth: '28px', height: '2px', margin: '0 6px', borderRadius: '2px', background: concluida ? ESCURO.verde : ESCURO.trilho }}
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

      {!props.carregando && estado && mostrarPainel && (
        <PainelFluxoOrcamento
          estado={estado}
          dadosResponsaveis={props.dadosResponsaveis}
          vinculos={props.vinculos}
          usuarios={props.usuarios}
          podeAgir={props.podeAgir}
          processando={props.processando}
          onExecutar={props.onExecutar}
          rotuloFluxo={`Fluxo de ${ambiente.nome}`}
          textoConcluido={registro.situacao === 'cancelado' ? 'Registro cancelado' : `✓ ${ambiente.rotuloRegistro} concluído(a) — fluxo encerrado`}
          diagramaAberto={layout.registro.mostrarDiagrama}
          ocultarHistorico={!layout.registro.mostrarHistorico}
        />
      )}

      {/* Dados do registro */}
      {layout.registro.mostrarDados && (
        <div style={{ ...cartao, marginBottom: 0 }}>
          <strong style={{ display: 'block', fontSize: '14px', color: COR.azul, marginBottom: '10px' }}>Dados do registro</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            <div><div style={rotuloInfo}>Aberto por</div><div style={valorInfo}>{registro.solicitanteNome || '—'}</div></div>
            <div><div style={rotuloInfo}>Aberto em</div><div style={valorInfo}>{formatarDataHora(registro.criadoEm)}</div></div>
            <div><div style={rotuloInfo}>Área</div><div style={valorInfo}>{registro.areaNome || '—'}</div></div>
            {registro.concluidoEm && (
              <div><div style={rotuloInfo}>{registro.situacao === 'cancelado' ? 'Cancelado em' : 'Concluído em'}</div><div style={valorInfo}>{formatarDataHora(registro.concluidoEm)}</div></div>
            )}
            {registro.descricao && (
              <div style={{ gridColumn: '1 / -1' }}><div style={rotuloInfo}>Descrição</div><div style={valorInfo}>{registro.descricao}</div></div>
            )}
            {definicao && instancia && (definicao.metadados || [])
              .filter(meta => !!instancia.valores[meta.chave])
              .map(meta => (
                <div key={meta.chave} style={meta.tipo === 'tabela' || meta.tipo === 'textoLongo' ? { gridColumn: '1 / -1' } : undefined}>
                  <div style={rotuloInfo}>{meta.rotulo}</div>
                  <div style={valorInfo}>{formatarValorCampo(meta.tipo, instancia.valores[meta.chave]) || '—'}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroAmbiente;
