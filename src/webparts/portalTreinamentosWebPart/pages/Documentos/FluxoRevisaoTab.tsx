import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import {
  IFluxoCampo,
  IFluxoElemento
} from '../../models/Fluxo';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  atorPodeExecutar,
  campoObrigatorioAgora,
  obterElementoAtual,
  tarefaPendente
} from '../../services/fluxo/FluxoEngine';

import {
  useFluxoRevisaoTeste
} from '../../hooks/useFluxoRevisaoTeste';

import FluxoDiagrama from
  '../../components/fluxo/FluxoDiagrama';

// ============================================================
// ABA "FLUXO (TESTE)" DO DETALHE DO DOCUMENTO
//
// Simulação do fluxo de revisão configurável. NADA é gravado no
// Dataverse: o estado fica no navegador de quem está testando.
// A aba "Revisão" continua sendo o fluxo oficial.
// ============================================================

export interface IFluxoRevisaoTabProps {
  documento: IDocumento;
  revisoes: IDocumentoRevisao[];
  contexto?: IContextoAcesso;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

const estiloCartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '8px',
  overflow: 'hidden'
};

const estiloBarraSecao: React.CSSProperties = {
  background: COR_AZUL,
  color: '#FFFFFF',
  padding: '10px 20px',
  fontWeight: 700,
  fontSize: '13px',
  letterSpacing: '.06em',
  textTransform: 'uppercase'
};

const estiloRotuloCampo: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  marginBottom: '4px'
};

const estiloBotao = (
  principal: boolean,
  desabilitado: boolean
): React.CSSProperties => ({
  minHeight: '40px',
  padding: '0 18px',
  borderRadius: '6px',
  border: `2px solid ${COR_AZUL}`,
  background: principal ? COR_AZUL : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '13.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.45 : 1
});

const formatarDataHora = (
  valor?: string
): string => {

  if (!valor) {
    return '-';
  }

  const data =
    new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return valor;
  }

  return data.toLocaleString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
};

const formatarData = (
  valor?: string
): string => {

  if (!valor) {
    return '-';
  }

  const data =
    new Date(valor);

  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleDateString('pt-BR');
};

const FluxoRevisaoTab: React.FC<IFluxoRevisaoTabProps> = ({
  documento,
  revisoes,
  contexto
}) => {

  const fluxo =
    useFluxoRevisaoTeste(
      documento,
      revisoes,
      contexto
    );

  const [comentario, setComentario] =
    React.useState<string>('');

  const [valores, setValores] =
    React.useState<Record<string, string>>({});

  const elementoAtual: IFluxoElemento | undefined =
    fluxo.definicao && fluxo.instancia
      ? obterElementoAtual(fluxo.definicao, fluxo.instancia)
      : undefined;

  // Ao mudar de etapa, limpa o formulário.
  React.useEffect(
    () => {
      setComentario('');
      setValores({});
    },
    [fluxo.instancia?.elementoAtualId, fluxo.instancia?.historico.length]
  );

  if (fluxo.carregando) {
    return (
      <div style={{ padding: '24px', color: COR_AZUL }}>
        Carregando simulação do fluxo...
      </div>
    );
  }

  if (
    fluxo.erro ||
    !fluxo.instancia ||
    !fluxo.definicao
  ) {
    return (
      <div
        role="alert"
        style={{
          border: `2px solid ${COR_INDIGO}`,
          borderRadius: '8px',
          padding: '16px',
          color: COR_AZUL
        }}
      >
        <strong style={{ color: COR_INDIGO }}>
          Não foi possível montar o fluxo.
        </strong>{' '}
        {fluxo.erro || 'Definição de fluxo não encontrada.'}
      </div>
    );
  }

  const instancia =
    fluxo.instancia;

  const definicao =
    fluxo.definicao;

  const concluido =
    instancia.status === 'concluido';

  const ator =
    fluxo.atorSelecionado;

  const podeAgir =
    !!ator &&
    atorPodeExecutar(elementoAtual, ator.ator);

  const tarefa =
    tarefaPendente(instancia);

  const exigeComentarioEmAlguma =
    !!elementoAtual &&
    elementoAtual.acoes.some(
      acao => acao.exigeComentario
    );

  const definirValor = (
    chave: string,
    valor: string
  ): void => {
    setValores(
      atual => ({ ...atual, [chave]: valor })
    );
    fluxo.limparErros();
  };

  const executar = (
    acaoChave: string,
    mensagemConfirmacao?: string
  ): void => {

    if (
      mensagemConfirmacao &&
      !window.confirm(mensagemConfirmacao)
    ) {
      return;
    }

    fluxo.executar(
      acaoChave,
      comentario,
      valores
    )
      .catch(
        (error: unknown) => console.error(error)
      );
  };

  const reiniciar = (): void => {

    if (
      !window.confirm(
        'Reiniciar a simulação desta revisão? O histórico simulado será apagado deste navegador.'
      )
    ) {
      return;
    }

    fluxo.reiniciar()
      .catch(
        (error: unknown) => console.error(error)
      );
  };

  const renderizarCampo = (
    campo: IFluxoCampo
  ): React.ReactElement | undefined => {

    if (!elementoAtual) {
      return undefined;
    }

    const valoresVisiveis = {
      ...instancia.valores,
      ...valores
    };

    // Campo condicional só aparece quando a condição é atendida.
    if (
      campo.obrigatorioQuando &&
      (valoresVisiveis[campo.obrigatorioQuando.campo] || '') !==
        campo.obrigatorioQuando.valor
    ) {
      return undefined;
    }

    const obrigatorio =
      campoObrigatorioAgora(
        elementoAtual,
        campo.chave,
        valoresVisiveis,
        'aprovado'
      );

    const valor =
      valoresVisiveis[campo.chave] || '';

    if (campo.tipo === 'simNao') {
      return (
        <fieldset
          key={campo.chave}
          style={{
            border: `1px solid ${COR_BORDA}`,
            borderRadius: '6px',
            padding: '12px 14px',
            margin: 0
          }}
        >
          <legend style={{ ...estiloRotuloCampo, padding: '0 6px', marginBottom: 0 }}>
            {campo.rotulo}{obrigatorio ? ' *' : ''}
          </legend>
          <div style={{ display: 'flex', gap: '8px' }}>
            {
              [
                { chave: 'sim', rotulo: 'Sim' },
                { chave: 'nao', rotulo: 'Não' }
              ].map(
                opcao => {
                  const selecionado =
                    valor === opcao.chave;

                  return (
                    <button
                      key={opcao.chave}
                      type="button"
                      aria-pressed={selecionado}
                      disabled={!podeAgir || fluxo.processando}
                      onClick={() => definirValor(campo.chave, opcao.chave)}
                      style={{
                        ...estiloBotao(selecionado, !podeAgir),
                        minWidth: '72px'
                      }}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                }
              )
            }
          </div>
          {
            campo.ajuda && (
              <div style={{ fontSize: '12.5px', color: COR_AZUL, marginTop: '8px' }}>
                {campo.ajuda}
              </div>
            )
          }
        </fieldset>
      );
    }

    const idCampo =
      `fluxo-campo-${campo.chave}`;

    return (
      <div key={campo.chave}>
        <label htmlFor={idCampo} style={estiloRotuloCampo}>
          {campo.rotulo}{obrigatorio ? ' *' : ''}
        </label>
        <textarea
          id={idCampo}
          rows={2}
          value={valor}
          disabled={!podeAgir || fluxo.processando}
          onChange={evento => definirValor(campo.chave, evento.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${COR_BORDA}`,
            borderRadius: '6px',
            padding: '8px 10px',
            fontFamily: 'inherit',
            fontSize: '14px'
          }}
        />
      </div>
    );
  };

  const retreinamento =
    instancia.valores.retreinamento;

  const resultadoSimulado: string[] =
    retreinamento === 'sim'
      ? [
        `${instancia.revisao} seria marcada como vigente e a revisão anterior como substituída (histórico preservado).`,
        'O impacto seria calculado em dgt_revisaoimpacto a partir dos treinamentos vinculados ao documento.',
        'Novas atribuições seriam criadas com origem "Revisão documental", vinculadas a esta revisão.',
        'Os colaboradores impactados seriam notificados pelo Power Automate.'
      ]
      : [
        `${instancia.revisao} seria marcada como vigente e a revisão anterior como substituída (histórico preservado).`,
        'A dispensa de retreinamento seria registrada com responsável, data e justificativa.',
        'Os treinamentos já concluídos continuariam válidos.'
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

      {/* AVISO DE MODO DE TESTE */}
      <div
        style={{
          border: `2px solid ${COR_INDIGO}`,
          background: '#E8EAF8',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '13.5px',
          lineHeight: '20px'
        }}
      >
        <strong>Modo de teste.</strong>{' '}
        Esta aba simula o fluxo configurável. Nada é gravado no Dataverse nem no SharePoint:
        o estado fica apenas neste navegador. O fluxo oficial continua na aba “Revisão”.
        {
          fluxo.revisaoAlvo?.virtual && (
            <span>
              {' '}Como não há revisão em andamento, a simulação usa uma{' '}
              <strong>{fluxo.revisaoAlvo.revisao} virtual</strong>.
            </span>
          )
        }
      </div>

      {/* CABEÇALHO */}
      <div
        style={{
          ...estiloCartao,
          padding: '14px 20px',
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}
      >
        <div style={{ minWidth: '160px' }}>
          <div style={estiloRotuloCampo}>Revisão</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>{instancia.revisao}</div>
        </div>
        <div style={{ minWidth: '200px' }}>
          <div style={estiloRotuloCampo}>Fluxo (congelado nesta revisão)</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>
            {definicao.nome} v{instancia.fluxoVersao}
          </div>
        </div>
        <div style={{ minWidth: '160px' }}>
          <div style={estiloRotuloCampo}>Etapa</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>
            {concluido ? 'Concluído' : (elementoAtual?.nome || '-')}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', minWidth: '260px' }}>
          <label htmlFor="fluxo-ator" style={estiloRotuloCampo}>
            Executar como
          </label>
          <select
            id="fluxo-ator"
            value={ator?.chave}
            onChange={evento => fluxo.selecionarAtor(evento.target.value)}
            style={{
              minHeight: '40px',
              width: '100%',
              border: `1px solid ${COR_BORDA}`,
              borderRadius: '6px',
              padding: '0 10px',
              fontFamily: 'inherit',
              fontSize: '14px',
              color: COR_AZUL,
              background: '#FFFFFF'
            }}
          >
            {
              fluxo.atores.map(
                item => (
                  <option key={item.chave} value={item.chave}>
                    {item.rotulo}
                  </option>
                )
              )
            }
          </select>
          {
            ator && (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {ator.descricao}
              </div>
            )
          }
        </div>

        <button
          type="button"
          onClick={reiniciar}
          style={estiloBotao(false, false)}
        >
          Reiniciar simulação
        </button>
      </div>

      {/* DIAGRAMA */}
      <section style={estiloCartao}>
        <div style={{ ...estiloBarraSecao, display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <span>Fluxo da revisão</span>
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: 0,
              fontSize: '12.5px'
            }}
          >
            Concluída: contorno cheio · Atual: contorno ciano espesso · Pendente: tracejado
          </span>
        </div>
        <div style={{ padding: '8px 0' }}>
          <FluxoDiagrama
            definicao={definicao}
            instancia={instancia}
          />
        </div>
      </section>

      {/* PAINEL + HISTÓRICO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
          alignItems: 'start'
        }}
      >

        <section style={estiloCartao}>
          <div style={estiloBarraSecao}>
            {concluido ? 'Resultado (simulado)' : `Etapa atual — ${elementoAtual?.nome || '-'}`}
          </div>

          {
            concluido
              ? (
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>
                    Fluxo concluído em {formatarDataHora(instancia.concluidoEm)}
                  </div>
                  <div style={{ fontSize: '13.5px' }}>
                    Em produção, a tarefa de sistema executaria:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '21px' }}>
                    {
                      resultadoSimulado.map(
                        item => <li key={item}>{item}</li>
                      )
                    }
                  </ul>
                  <div style={{ fontSize: '12.5px', borderTop: `1px solid ${COR_BORDA}`, paddingTop: '10px' }}>
                    Nenhuma dessas ações foi executada: a publicação real continua sendo feita pela aba “Revisão”.
                  </div>
                </div>
              )
              : elementoAtual && (
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <div>
                      <div style={estiloRotuloCampo}>Responsável</div>
                      <div style={{ fontSize: '14px' }}>
                        {elementoAtual.responsaveis.map(item => item.descricao).join(', ') || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={estiloRotuloCampo}>Prazo da etapa</div>
                      <div style={{ fontSize: '14px' }}>
                        {tarefa?.prazo ? formatarData(tarefa.prazo) : '-'}
                        {elementoAtual.prazoDiasUteis ? ` (${elementoAtual.prazoDiasUteis} dias úteis)` : ''}
                      </div>
                    </div>
                  </div>

                  {
                    elementoAtual.instrucoes && (
                      <div style={{ background: '#EDF0F5', borderRadius: '6px', padding: '10px 12px', fontSize: '13.5px' }}>
                        <strong>Instruções:</strong> {elementoAtual.instrucoes}
                      </div>
                    )
                  }

                  {
                    !podeAgir && (
                      <div
                        style={{
                          border: `2px solid ${COR_INDIGO}`,
                          borderRadius: '6px',
                          padding: '10px 12px',
                          fontSize: '13.5px'
                        }}
                      >
                        <strong style={{ color: COR_INDIGO }}>Sem permissão nesta etapa.</strong>{' '}
                        {ator?.ator.nome} não é responsável por “{elementoAtual.nome}”.
                        Troque em “Executar como” para simular o responsável.
                      </div>
                    )
                  }

                  {
                    elementoAtual.campos.map(
                      campo => renderizarCampo(campo)
                    )
                  }

                  <div>
                    <label htmlFor="fluxo-comentario" style={estiloRotuloCampo}>
                      Comentário {exigeComentarioEmAlguma ? '(obrigatório para devolver ou reprovar)' : '(opcional)'}
                    </label>
                    <textarea
                      id="fluxo-comentario"
                      rows={3}
                      value={comentario}
                      disabled={!podeAgir || fluxo.processando}
                      onChange={evento => {
                        setComentario(evento.target.value);
                        fluxo.limparErros();
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: `1px solid ${COR_BORDA}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontFamily: 'inherit',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {
                    fluxo.errosAcao.length > 0 && (
                      <div
                        role="alert"
                        style={{
                          border: `2px solid ${COR_INDIGO}`,
                          borderRadius: '6px',
                          padding: '10px 12px',
                          fontSize: '13.5px'
                        }}
                      >
                        <strong style={{ color: COR_INDIGO }}>Não foi possível executar:</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                          {
                            fluxo.errosAcao.map(
                              item => <li key={item}>{item}</li>
                            )
                          }
                        </ul>
                      </div>
                    )
                  }

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {
                      elementoAtual.acoes.map(
                        acao => {
                          const desabilitado =
                            !podeAgir || fluxo.processando;

                          return (
                            <button
                              key={acao.chave}
                              type="button"
                              disabled={desabilitado}
                              onClick={() => executar(acao.chave, acao.mensagemConfirmacao)}
                              style={estiloBotao(acao.principal, desabilitado)}
                            >
                              {acao.rotulo}
                            </button>
                          );
                        }
                      )
                    }
                  </div>
                </div>
              )
          }
        </section>

        <section style={estiloCartao}>
          <div style={estiloBarraSecao}>
            Histórico da tramitação (simulado)
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: '4px 20px 12px' }}>
            {
              instancia.historico.map(
                item => (
                  <li
                    key={item.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: `1px solid ${COR_BORDA}`
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12.5px' }}>
                      <strong>{formatarDataHora(item.data)}</strong>
                      <span>{item.elementoNome}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      {item.acaoRotulo}
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      {item.executadoPorNome}
                    </div>
                    {
                      item.comentario && (
                        <div
                          style={{
                            fontSize: '13px',
                            background: '#F2F2F2',
                            borderLeft: `3px solid ${COR_CIANO}`,
                            borderRadius: '4px',
                            padding: '6px 10px',
                            marginTop: '6px'
                          }}
                        >
                          {item.comentario}
                        </div>
                      )
                    }
                  </li>
                )
              )
            }
          </ol>
        </section>
      </div>
    </div>
  );
};

export default FluxoRevisaoTab;
