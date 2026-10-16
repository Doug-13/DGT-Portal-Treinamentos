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
import TabelaCampoFluxo from '../../components/fluxo/TabelaCampoFluxo';

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
      ? (tarefa.responsaveisResolvidos || resolverResponsaveis(tarefa.responsaveis, props.dadosResponsaveis))
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

  const renderCampo = (item: IFluxoCampo): React.ReactNode => {
    const valor = valoresConsolidados[item.chave] || '';
    const somenteLeitura = item.somenteLeitura || !props.podeAgir;
    const alterar = (novo: string): void => setValores(atual => ({ ...atual, [item.chave]: novo }));

    if (item.tipo === 'tabela') {
      return (
        <TabelaCampoFluxo
          id={`orc-${item.chave}`}
          rotulo={item.rotulo}
          colunas={item.colunas || []}
          valor={valor}
          somenteLeitura={somenteLeitura}
          desabilitado={props.processando}
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
    <div style={{ ...cartao, fontFamily: FONTE }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Fluxo de aprovação · {instancia.processoNome || definicao.nome} · v{definicao.versao}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: COR.azul, marginTop: '2px' }}>
            {concluido ? '✓ Orçamento aprovado — fluxo concluído' : `Etapa atual: ${elemento ? elemento.nome : '—'}`}
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

      {verDiagrama && (
        <div style={{ overflowX: 'auto', maxWidth: '100%', marginTop: '12px', border: `1px solid ${COR.borda}`, borderRadius: '8px', background: '#FFFFFF' }}>
          <FluxoDiagrama definicao={definicao} instancia={instancia} />
        </div>
      )}

      {/* Ações da etapa */}
      {!concluido && elemento && elemento.tipo === 'tarefaHumana' && (
        <div style={{ marginTop: '14px', borderTop: `1px solid ${COR.borda}`, paddingTop: '12px' }}>

          {elemento.instrucoes && (
            <div style={{ fontSize: '13px', color: COR.azul, background: '#F8FAFC', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', whiteSpace: 'pre-line' }}>
              {elemento.instrucoes}
            </div>
          )}

          {elemento.campos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '10px' }}>
              {elemento.campos.map(item => (
                <label key={item.chave} style={{ display: 'block', gridColumn: item.tipo === 'tabela' || item.tipo === 'textoLongo' ? '1 / -1' : undefined }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>
                    {item.rotulo}{item.obrigatorio ? ' *' : ''}
                  </span>
                  {renderCampo(item)}
                  {item.ajuda && <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2, marginTop: '3px' }}>{item.ajuda}</span>}
                </label>
              ))}
            </div>
          )}

          {props.podeAgir && props.onExecutar ? (
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
    </div>
  );
};

export default PainelFluxoOrcamento;
