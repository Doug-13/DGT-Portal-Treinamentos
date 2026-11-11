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

import AnexosRegistro from './AnexosRegistro';

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
  onIniciarFluxo: () => void;
  onExecutar: (acaoChave: string, comentario: string, valores: Record<string, string>) => Promise<string[]>;
  // Campos do tipo Componente (dados do Dataverse).
  dataverseService?: DataverseService;
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
  const [verFluxo, setVerFluxo] = React.useState(!!layout.registro.mostrarDiagrama);

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

      {!props.carregando && estado && mostrarPainel && duasColunas && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>

            {/* ESQUERDA: dados do registro */}
            <div style={{ flex: '0 1 340px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ ...cartao, marginBottom: 0 }}>
                <strong style={{ display: 'block', fontSize: '14px', color: COR.azul, marginBottom: '10px' }}>Dados do registro</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <div><div style={rotuloInfo}>{ambiente.rotuloRegistro}</div><div style={{ ...valorInfo, fontWeight: 700 }}>{registro.titulo}</div></div>
                  <div><div style={rotuloInfo}>Código</div><div style={valorInfo}>{registro.codigo}</div></div>
                  <div>
                    <div style={rotuloInfo}>Etapa atual</div>
                    <div style={valorInfo}>
                      {instancia && instancia.status === 'concluido' ? 'Concluído' : (elementoAtual ? elementoAtual.nome : '—')}
                      {posicaoEtapa && <span style={{ color: COR.texto2 }}> · {posicaoEtapa}</span>}
                    </div>
                  </div>
                  <div>
                    <div style={rotuloInfo}>Prazo da etapa</div>
                    <div style={valorInfo}>{tarefaAtual && tarefaAtual.prazo ? <SeloPrazo prazo={tarefaAtual.prazo} situacao={situacaoPrazo(tarefaAtual.prazo, tarefaAtual.criadaEm)} /> : '—'}</div>
                  </div>
                  <div><div style={rotuloInfo}>Responsável da etapa</div><div style={valorInfo}>{responsaveisAtuais.length > 0 ? responsaveisAtuais.join(' · ') : '—'}</div></div>
                  <div><div style={rotuloInfo}>Situação</div><div style={valorInfo}><Selo texto={situacao.texto} cor={situacao.cor} fundo={situacao.fundo} /></div></div>
                  <div><div style={rotuloInfo}>Aberto por</div><div style={valorInfo}>{registro.solicitanteNome || '—'} · {formatarDataHora(registro.criadoEm)}</div></div>
                  {registro.areaNome && <div><div style={rotuloInfo}>Área</div><div style={valorInfo}>{registro.areaNome}</div></div>}
                  {registro.descricao && <div><div style={rotuloInfo}>Descrição</div><div style={valorInfo}>{registro.descricao}</div></div>}
                </div>
                <div style={{ borderTop: `1px solid ${COR.borda}`, marginTop: '12px', paddingTop: '10px' }}>
                  <button type="button" onClick={() => setVerFluxo(!verFluxo)} style={botao('secundario')}>
                    {verFluxo ? 'Ocultar fluxo' : 'Ver fluxo'}
                  </button>
                </div>
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
              <strong style={{ display: 'block', fontSize: '14px', color: COR.azul, marginBottom: '10px' }}>
                {instancia && instancia.status === 'concluido' ? 'Fluxo encerrado' : `Etapa: ${elementoAtual ? elementoAtual.nome : '—'}`}
              </strong>
              <PainelFluxoOrcamento
                estado={estado}
                dadosResponsaveis={props.dadosResponsaveis}
                vinculos={props.vinculos}
                usuarios={props.usuarios}
                podeAgir={props.podeAgir}
                processando={props.processando}
                onExecutar={props.onExecutar}
                textoConcluido={registro.situacao === 'cancelado' ? 'Registro cancelado' : `✓ ${ambiente.rotuloRegistro} concluído(a) — fluxo encerrado`}
                modoCompacto={true}
                ocultarHistorico={true}
                dataverseService={props.dataverseService}
              />
            </div>
          </div>

          {/* Ver fluxo: desenho + histórico em largura total */}
          {verFluxo && instancia && definicao && (
            <div style={{ ...cartao, marginBottom: 0 }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '8px' }}>
                Fluxo de {ambiente.nome} · {instancia.processoNome || definicao.nome} · v{definicao.versao}
              </div>
              <div style={{ overflowX: 'auto', maxWidth: '100%', border: `1px solid ${COR.borda}`, borderRadius: '8px', background: '#FFFFFF' }}>
                <FluxoDiagrama definicao={definicao} instancia={instancia} />
              </div>
              {layout.registro.mostrarHistorico && (
                <div style={{ marginTop: '12px' }}>
                  <strong style={{ display: 'block', fontSize: '13.5px', color: COR.azul, marginBottom: '6px' }}>Histórico do fluxo ({instancia.historico.length})</strong>
                  {instancia.historico.map(passo => (
                    <div key={passo.id} style={{ fontSize: '12.5px', color: COR.azul, padding: '6px 0', borderTop: `1px solid ${COR.borda}` }}>
                      <strong>{passo.elementoNome}</strong> — {passo.acaoRotulo}
                      <span style={{ color: COR.texto2 }}> · {passo.executadoPorNome} · {formatarDataHora(passo.data)}</span>
                      {passo.comentario && <div style={{ color: COR.texto2, whiteSpace: 'pre-line' }}>{passo.comentario}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!props.carregando && estado && mostrarPainel && !duasColunas && (
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
          dataverseService={props.dataverseService}
        />
      )}

      {!duasColunas && props.anexos && props.anexos.regra.visivel && (
        <AnexosRegistro servico={props.anexos.servico} pasta={props.anexos.pasta} regra={props.anexos.regra} onQuantidade={props.anexos.onQuantidade} />
      )}

      {/* Dados do registro / campos preenchidos */}
      {layout.registro.mostrarDados && (
        <div style={{ ...cartao, marginBottom: 0 }}>
          <strong style={{ display: 'block', fontSize: '14px', color: COR.azul, marginBottom: '10px' }}>{duasColunas ? 'Campos preenchidos' : 'Dados do registro'}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {!duasColunas && <div><div style={rotuloInfo}>Aberto por</div><div style={valorInfo}>{registro.solicitanteNome || '—'}</div></div>}
            {!duasColunas && <div><div style={rotuloInfo}>Aberto em</div><div style={valorInfo}>{formatarDataHora(registro.criadoEm)}</div></div>}
            {!duasColunas && <div><div style={rotuloInfo}>Área</div><div style={valorInfo}>{registro.areaNome || '—'}</div></div>}
            {registro.concluidoEm && (
              <div><div style={rotuloInfo}>{registro.situacao === 'cancelado' ? 'Cancelado em' : 'Concluído em'}</div><div style={valorInfo}>{formatarDataHora(registro.concluidoEm)}</div></div>
            )}
            {!duasColunas && registro.descricao && (
              <div style={{ gridColumn: '1 / -1' }}><div style={rotuloInfo}>Descrição</div><div style={valorInfo}>{registro.descricao}</div></div>
            )}
            {duasColunas && definicao && instancia && !(definicao.metadados || []).some(meta => !!instancia.valores[meta.chave]) && (
              <div style={{ color: COR.texto2, fontSize: '13px' }}>Nenhum campo preenchido ainda.</div>
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
