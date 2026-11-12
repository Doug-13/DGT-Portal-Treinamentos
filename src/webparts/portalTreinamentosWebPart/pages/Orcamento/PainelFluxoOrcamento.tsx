import * as React from 'react';

import {
  IFluxoAcao,
  IFluxoCampo
} from '../../models/Fluxo';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  ehAcaoDeDevolucao,
  formatarValorCampo,
  obterElementoAtual,
  tarefaPendente,
  validarAcao
} from '../../services/fluxo/FluxoEngine';

import {
  descreverResolvido,
  resolverResponsaveis,
  IDadosRevisaoResponsaveis
} from '../../services/fluxo/ResolvedorResponsaveis';

import {
  IEstadoFluxoPlanilha
} from '../../services/orcamento/OrcamentoFluxoService';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import FluxoDiagrama from '../../components/fluxo/FluxoDiagrama';
import {
  DataverseService
} from '../../services/DataverseService';

import {
  campoVisivel
} from '../../services/fluxo/FluxoEngine';
import CampoAreaFluxo from '../../components/fluxo/CampoAreaFluxo';
import CampoDocumentoFluxo from '../../components/fluxo/CampoDocumentoFluxo';
import CampoComponenteFluxo from '../../components/fluxo/CampoComponenteFluxo';
import CampoAvaliacaoFluxo from '../../components/fluxo/CampoAvaliacaoFluxo';
import TabelaCampoFluxo from '../../components/fluxo/TabelaCampoFluxo';
import CampoUsuarioFluxo from '../../components/fluxo/CampoUsuarioFluxo';

import {
  COR,
  CaixaMensagem,
  FONTE,
  SeloPrazo,
  botao,
  campo,
  cartao,
  formatarDataHora
} from './orcamentoComum';

// ============================================================
// FLUXO DE APROVAÇÃO DA PLANILHA (processo CONT-001)
//
// Mostra o desenho do processo com a etapa atual, quem responde e o
// prazo; para quem é responsável pela etapa, os campos e as ações
// configurados no processo (ex.: Aprovar / Reprovar); e o histórico
// do fluxo (quem fez o quê, quando e com qual comentário).
// ============================================================

export interface IPainelFluxoOrcamentoProps {
  estado: IEstadoFluxoPlanilha;
  dadosResponsaveis: IDadosRevisaoResponsaveis;
  vinculos: IUsuarioAreaAdmin[];
  usuarios: Array<{ id: string; nome: string }>;
  // O usuário é responsável pela etapa atual?
  podeAgir: boolean;
  processando: boolean;
  // Executa a ação; devolve os erros (vazio = deu certo).
  onExecutar?: (acaoChave: string, comentario: string, valores: Record<string, string>) => Promise<string[]>;
  // Texto acima das ações (ex.: "As alterações não salvas serão
  // salvas antes do envio").
  observacaoAcoes?: string;
  // Começa com o diagrama aberto?
  diagramaAberto?: boolean;
  // Textos do cabeçalho (o painel também é usado pelos Ambientes).
  // Sem eles, ficam os textos do Orçamento.
  rotuloFluxo?: string;
  textoConcluido?: string;
  // Ambientes: esconder o histórico (telas configuráveis).
  ocultarHistorico?: boolean;
  // Ambientes em duas colunas: só instruções, campos, comentário e
  // botões (sem cabeçalho, desenho nem histórico).
  modoCompacto?: boolean;
  // Edição administrativa (Administrador do Sistema): campos da etapa
  // editáveis mesmo sem ser o responsável; "Salvar campos" no lugar das
  // ações (a etapa não muda).
  modoEdicaoAdmin?: boolean;
  onSalvarAdmin?: (valores: Record<string, string>, comentario: string) => Promise<string[]>;
  onCancelarEdicaoAdmin?: () => void;
  // Campos do tipo Componente (dados do Dataverse).
  dataverseService?: DataverseService;
}

const PainelFluxoOrcamento: React.FC<IPainelFluxoOrcamentoProps> = (props) => {

  const { estado } = props;
  const { instancia, definicao } = estado;

  const elemento = obterElementoAtual(definicao, instancia);
  const tarefa = tarefaPendente(instancia);
  const concluido = instancia.status === 'concluido';

  const [valores, setValores] = React.useState<Record<string, string>>({});
  const [comentario, setComentario] = React.useState('');
  const [erros, setErros] = React.useState<string[]>([]);
  const [verDiagrama, setVerDiagrama] = React.useState(props.diagramaAberto !== false);
  const [verHistorico, setVerHistorico] = React.useState(false);

  // Nova etapa: limpa o formulário.
  React.useEffect(() => {
    setValores({});
    setComentario('');
    setErros([]);
  }, [instancia.elementoAtualId, instancia.historico.length]);

  const valoresConsolidados = { ...instancia.valores, ...valores };

  const responsaveis =
    tarefa
      ? resolverResponsaveis(tarefa.responsaveis, props.dadosResponsaveis)
        .map(item => descreverResolvido(item, props.vinculos, props.usuarios))
        .filter((texto, indice, lista) => !!texto && lista.indexOf(texto) === indice)
      : [];

  const prazo = tarefa && tarefa.prazo ? situacaoPrazo(tarefa.prazo, tarefa.criadaEm) : undefined;

  const executar = async (acao: IFluxoAcao): Promise<void> => {
    if (!elemento || !props.onExecutar) {
      return;
    }
    const problemas = validarAcao(elemento, acao, comentario, valoresConsolidados);
    if (problemas.length > 0) {
      setErros(problemas);
      return;
    }
    const confirmacao =
      acao.mensagemConfirmacao ||
      `Confirmar "${acao.rotulo}" na etapa "${elemento.nome}"?`;
    if (!window.confirm(confirmacao)) {
      return;
    }
    setErros([]);
    const resultado = await props.onExecutar(acao.chave, comentario.trim(), valores);
    if (resultado.length > 0) {
      setErros(resultado);
    }
  };

  // Lista usada pelos campos do tipo "usuário" (já carregada pela tela).
  const usuariosBusca = React.useMemo(
    () => props.usuarios.map(usuario => ({ id: usuario.id, nome: usuario.nome })),
    [props.usuarios]
  );

  const renderCampo = (item: IFluxoCampo): React.ReactNode => {
    const valor = valoresConsolidados[item.chave] || '';
    // Herdado do documento pai como somente leitura (subprocesso).
    const somenteLeitura =
      item.somenteLeitura ||
      (!props.podeAgir && !props.modoEdicaoAdmin) ||
      (instancia.camposSomenteLeitura || []).indexOf(item.chave) >= 0;
    const alterar = (novo: string): void => setValores(atual => ({ ...atual, [item.chave]: novo }));

    if (item.tipo === 'componente') {
      return (
        <CampoComponenteFluxo
          id={`orc-${item.chave}`}
          rotulo={item.rotulo}
          config={item.componente}
          valor={valor}
          desabilitado={somenteLeitura || props.processando}
          onAlterar={alterar}
          dataverseService={props.dataverseService}
          valoresRegistro={valoresConsolidados}
        />
      );
    }

    if (item.tipo === 'avaliacao') {
      return (
        <CampoAvaliacaoFluxo
          id={`orc-${item.chave}`}
          rotulo={item.rotulo}
          config={item.avaliacao}
          valor={valor}
          desabilitado={somenteLeitura || props.processando}
          onAlterar={alterar}
        />
      );
    }

    if (item.tipo === 'tabela') {
      return (
        <TabelaCampoFluxo
          id={`orc-${item.chave}`}
          rotulo={item.rotulo}
          colunas={item.colunas || []}
          valor={valor}
          somenteLeitura={somenteLeitura}
          desabilitado={props.processando}
          usuarios={usuariosBusca}
          dataverseService={props.dataverseService}
          onAlterar={alterar}
        />
      );
    }

    if (somenteLeitura) {
      return <div style={{ fontSize: '13.5px', color: COR.azul }}>{formatarValorCampo(item.tipo, valor) || '—'}</div>;
    }

    if (item.tipo === 'textoLongo') {
      return <textarea rows={3} value={valor} onChange={evento => alterar(evento.target.value)} style={{ ...campo, resize: 'vertical' }} />;
    }

    if (item.tipo === 'simNao') {
      return (
        <select value={valor} onChange={evento => alterar(evento.target.value)} style={campo}>
          <option value="">Selecione...</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      );
    }

    // Área e documento(s) referenciado(s): os mesmos campos da aba
    // Fluxo dos documentos (busca no Dataverse). Sem conexão (ex.:
    // orçamento sem Dataverse), só exibe o valor.
    if (item.tipo === 'area') {
      return props.dataverseService
        ? (
          <CampoAreaFluxo
            id={`orcamento-campo-${item.chave}`}
            valor={valor}
            desabilitado={props.processando}
            dataverseService={props.dataverseService}
            onAlterar={alterar}
          />
        )
        : <div style={{ fontSize: '13.5px', color: COR.azul }}>{formatarValorCampo(item.tipo, valor) || '—'}</div>;
    }

    if (item.tipo === 'documento' || item.tipo === 'documentos') {
      return props.dataverseService
        ? (
          <CampoDocumentoFluxo
            id={`orcamento-campo-${item.chave}`}
            valor={valor}
            multiplo={item.tipo === 'documentos'}
            desabilitado={props.processando}
            dataverseService={props.dataverseService}
            tiposPermitidos={item.opcoes}
            onAlterar={alterar}
          />
        )
        : <div style={{ fontSize: '13.5px', color: COR.azul }}>{formatarValorCampo(item.tipo, valor) || '—'}</div>;
    }

    if (item.tipo === 'usuario') {
      return (
        <CampoUsuarioFluxo
          id={`orcamento-campo-${item.chave}`}
          valor={valor}
          desabilitado={somenteLeitura}
          usuarios={usuariosBusca}
          onAlterar={alterar}
        />
      );
    }

    if (item.tipo === 'lista') {
      return (
        <select value={valor} onChange={evento => alterar(evento.target.value)} style={campo}>
          <option value="">Selecione...</option>
          {(item.opcoes || []).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
        </select>
      );
    }

    return (
      <input
        type={item.tipo === 'data' ? 'date' : 'text'}
        inputMode={item.tipo === 'numero' ? 'decimal' : undefined}
        value={valor}
        onChange={evento => alterar(evento.target.value)}
        style={campo}
      />
    );
  };

  // O motor já grava do mais recente para o mais antigo.
  const historico = instancia.historico;

  return (
    <div style={props.modoCompacto ? { fontFamily: FONTE } : { ...cartao, fontFamily: FONTE }}>

      {/* Cabeçalho */}
      {!props.modoCompacto && (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            {props.rotuloFluxo || 'Fluxo de aprovação'} · {instancia.processoNome || definicao.nome} · v{definicao.versao}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: COR.azul, marginTop: '2px' }}>
            {concluido ? (props.textoConcluido || '✓ Orçamento aprovado — fluxo concluído') : `Etapa atual: ${elemento ? elemento.nome : '—'}`}
          </div>
          {!concluido && responsaveis.length > 0 && (
            <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '2px' }}>
              Responsável: {responsaveis.join(' · ')}
            </div>
          )}
          {concluido && instancia.concluidoEm && (
            <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '2px' }}>
              Concluído em {formatarDataHora(instancia.concluidoEm)}
            </div>
          )}
        </div>
        {tarefa && tarefa.prazo && <SeloPrazo prazo={tarefa.prazo} situacao={prazo} />}
        <button type="button" onClick={() => setVerDiagrama(!verDiagrama)} style={botao('secundario')}>
          {verDiagrama ? 'Ocultar desenho' : 'Ver desenho do fluxo'}
        </button>
      </div>
      )}

      {verDiagrama && !props.modoCompacto && (
        <div style={{ overflowX: 'auto', maxWidth: '100%', marginTop: '12px', border: `1px solid ${COR.borda}`, borderRadius: '8px', background: '#FFFFFF' }}>
          <FluxoDiagrama definicao={definicao} instancia={instancia} />
        </div>
      )}

      {/* Ações da etapa */}
      {!concluido && elemento && elemento.tipo === 'tarefaHumana' && (
        <div style={props.modoCompacto ? undefined : { marginTop: '14px', borderTop: `1px solid ${COR.borda}`, paddingTop: '12px' }}>

          {elemento.instrucoes && (
            <div style={{ fontSize: '13px', color: COR.azul, background: '#F8FAFC', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', whiteSpace: 'pre-line' }}>
              {elemento.instrucoes}
            </div>
          )}

          {elemento.campos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '10px' }}>
              {/* Regra de exibição: campo condicional só com a condição atendida. */}
              {elemento.campos.filter(item => campoVisivel(item, valoresConsolidados)).map(item => (
                <label key={item.chave} style={{ display: 'block', gridColumn: item.tipo === 'tabela' || item.tipo === 'textoLongo' || item.tipo === 'avaliacao' || item.tipo === 'componente' ? '1 / -1' : undefined }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>
                    {item.rotulo}{item.obrigatorio || item.obrigatorioQuando ? ' *' : ''}
                  </span>
                  {renderCampo(item)}
                  {item.ajuda && <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2, marginTop: '3px' }}>{item.ajuda}</span>}
                </label>
              ))}
            </div>
          )}

          {props.modoEdicaoAdmin && props.onSalvarAdmin ? (
            <div data-edicao-admin="sim">
              <div style={{ fontSize: '12.5px', background: '#FFFAEB', color: '#B54708', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' }}>
                <strong>Edição administrativa.</strong> Os campos desta etapa são salvos sem concluir a etapa: o registro
                continua em “{elemento.nome}”. A edição fica no histórico.
              </div>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Motivo da edição (opcional)</span>
                <textarea
                  rows={2}
                  value={comentario}
                  maxLength={4000}
                  onChange={evento => setComentario(evento.target.value)}
                  placeholder="Ex.: correção do auditor informado"
                  style={{ ...campo, resize: 'vertical' }}
                />
              </label>
              {erros.length > 0 && <CaixaMensagem tipo="erro" texto={erros.join('\n')} />}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  disabled={props.processando}
                  onClick={() => {
                    if (!props.onSalvarAdmin) {
                      return;
                    }
                    setErros([]);
                    props.onSalvarAdmin(valores, comentario.trim())
                      .then(resultado => {
                        setErros(resultado);
                        if (resultado.length === 0) {
                          setComentario('');
                        }
                      })
                      .catch(falha => setErros([falha instanceof Error ? falha.message : String(falha)]));
                  }}
                  style={botao('principal', props.processando)}
                >
                  {props.processando ? 'Salvando...' : 'Salvar campos'}
                </button>
                <button type="button" disabled={props.processando} onClick={props.onCancelarEdicaoAdmin} style={botao('secundario', props.processando)}>
                  Cancelar edição
                </button>
              </div>
            </div>
          ) : props.podeAgir && props.onExecutar ? (
            <>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>
                  Comentário {elemento.acoes.some(acao => acao.exigeComentario) ? '(obrigatório para algumas ações)' : '(opcional)'}
                </span>
                <textarea
                  rows={3}
                  value={comentario}
                  maxLength={4000}
                  onChange={evento => setComentario(evento.target.value)}
                  placeholder="Ex.: motivo da reprovação ou observação para a próxima etapa"
                  style={{ ...campo, resize: 'vertical' }}
                />
              </label>

              {erros.length > 0 && <CaixaMensagem tipo="erro" texto={erros.join('\n')} />}

              {props.observacaoAcoes && (
                <div style={{ fontSize: '12px', color: COR.texto2, marginBottom: '8px' }}>{props.observacaoAcoes}</div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {elemento.acoes.map(acao => {
                  const devolucao = ehAcaoDeDevolucao(acao);
                  return (
                    <button
                      key={acao.chave}
                      type="button"
                      disabled={props.processando}
                      onClick={() => { executar(acao).catch(() => undefined); }}
                      style={botao(devolucao ? 'perigo' : acao.principal ? 'principal' : 'secundario', props.processando)}
                      title={acao.exigeComentario ? 'Exige comentário' : undefined}
                    >
                      {props.processando ? 'Processando...' : acao.rotulo}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
              Somente os responsáveis pela etapa “{elemento.nome}” podem concluí-la.
            </div>
          )}
        </div>
      )}

      {/* Histórico do fluxo */}
      {props.modoCompacto && concluido && (
        <div style={{ fontSize: '14px', fontWeight: 700, color: COR.azul }}>{props.textoConcluido || '✓ Fluxo concluído'}</div>
      )}

      {!props.ocultarHistorico && !props.modoCompacto && (
      <div style={{ marginTop: '14px', borderTop: `1px solid ${COR.borda}`, paddingTop: '10px' }}>
        <button
          type="button"
          onClick={() => setVerHistorico(!verHistorico)}
          aria-expanded={verHistorico}
          style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONTE, fontSize: '13.5px', fontWeight: 700, color: COR.azul }}
        >
          {verHistorico ? '▼' : '▶'} Histórico do fluxo ({instancia.historico.length})
        </button>
        {verHistorico && (
          <div style={{ marginTop: '8px' }}>
            {historico.map(passo => (
              <div key={passo.id} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderTop: `1px solid ${COR.borda}` }}>
                <div style={{ minWidth: '128px', fontSize: '12.5px', color: COR.texto2 }}>{formatarDataHora(passo.data)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: /reprov|devol/i.test(`${passo.resultado} ${passo.acaoRotulo}`) ? COR.perigo : COR.azul }}>
                    {passo.elementoNome}: {passo.acaoRotulo}
                    <span style={{ fontWeight: 500, color: COR.texto2 }}> · {passo.sistema ? 'sistema' : passo.executadoPorNome || '—'}</span>
                  </div>
                  {passo.comentario && (
                    <div style={{ fontSize: '13px', color: COR.azul, marginTop: '2px', whiteSpace: 'pre-line' }}>{passo.comentario}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default PainelFluxoOrcamento;
