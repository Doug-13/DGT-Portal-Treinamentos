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
  DataverseService
} from '../../services/DataverseService';

import {
  atorPodeExecutar,
  campoObrigatorioAgora,
  formatarValorCampo,
  obterElementoAtual,
  tarefaPendente
} from '../../services/fluxo/FluxoEngine';

import {
  useFluxoRevisaoTeste
} from '../../hooks/useFluxoRevisaoTeste';

import FluxoDiagrama from
  '../../components/fluxo/FluxoDiagrama';

import TabelaCampoFluxo from
  '../../components/fluxo/TabelaCampoFluxo';

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

  // Leitura (somente) de dgt_processo / dgt_documentoprocesso.
  dataverseService?: DataverseService;

  // Abre o processo no módulo Processos (para criar/publicar o fluxo).
  onAbrirProcesso?: (processoId: string) => void;

  // Chamado depois de cada ação (Dataverse), para atualizar status e
  // revisões na tela do documento.
  onRevisaoAlterada?: () => Promise<void>;

  // true = só o painel da etapa atual (responsáveis, campos, botões),
  // para ficar na aba Revisão, na abertura do documento.
  compacto?: boolean;

  // Abre a aba com o fluxo completo (desenho e histórico).
  onVerFluxoCompleto?: () => void;
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
  contexto,
  dataverseService,
  onAbrirProcesso,
  onRevisaoAlterada,
  compacto = false,
  onVerFluxoCompleto
}) => {

  const fluxo =
    useFluxoRevisaoTeste(
      documento,
      revisoes,
      contexto,
      dataverseService,
      onRevisaoAlterada
    );

  const teste =
    fluxo.local ? ' (teste)' : '';

  const [processoEscolhido, setProcessoEscolhido] =
    React.useState<string>('');

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

  const avisoTeste = !fluxo.local
    ? (
      <>
        {
          fluxo.avisos.length > 0 && (
            <div role="status" style={{ border: `2px solid ${COR_INDIGO}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: COR_AZUL, background: '#FFFFFF' }}>
              {fluxo.avisos.join(' ')}
            </div>
          )
        }
      </>
    )
    : (
    <div
      style={{
        border: `2px solid ${COR_INDIGO}`,
        background: '#E8EAF8',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13.5px',
        lineHeight: '20px',
        color: COR_AZUL
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
      {
        fluxo.avisoProcessos && (
          <div style={{ marginTop: '6px' }}>
            {fluxo.avisoProcessos}
          </div>
        )
      }
    </div>
    );

  if (fluxo.situacao === 'carregando') {
    return (
      <div style={{ padding: '24px', color: COR_AZUL }}>
        {fluxo.local ? 'Carregando simulação do fluxo...' : 'Carregando o fluxo da revisão...'}
      </div>
    );
  }

  // ----------------------------------------------------------
  // Documento ainda sem processo / com vários processos / processo
  // sem fluxo publicado
  // ----------------------------------------------------------

  if (fluxo.situacao === 'semRevisao') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>
        {avisoTeste}
        <section style={{ ...estiloCartao, padding: '18px 20px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>Nenhuma revisão em andamento</div>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>
            O fluxo começa quando uma nova revisão é criada. Use a aba “Revisão” para criar a próxima
            revisão do documento; ela seguirá automaticamente o fluxo publicado do processo.
          </div>
        </section>
      </div>
    );
  }

  if (
    fluxo.situacao === 'semProcesso' ||
    fluxo.situacao === 'escolherPrincipal' ||
    fluxo.situacao === 'semFluxo'
  ) {

    const processoAtualId =
      fluxo.processoAtual ? fluxo.processoAtual.id : '';

    const opcoes =
      fluxo.situacao === 'escolherPrincipal'
        ? fluxo.processos.filter(
          processo =>
            fluxo.vinculos.some(
              vinculo => vinculo.processoId === processo.id
            )
        )
        : fluxo.processos;

    const titulo =
      fluxo.situacao === 'semProcesso'
        ? 'Este documento ainda não está vinculado a um processo'
        : fluxo.situacao === 'escolherPrincipal'
          ? 'Este documento pertence a mais de um processo'
          : `O processo “${fluxo.processoAtual?.nome || ''}” ainda não tem fluxo publicado`;

    const explicacao =
      fluxo.situacao === 'semProcesso'
        ? 'O fluxo de revisão é definido no processo. Vincule o documento a um processo para que a revisão siga o fluxo dele.'
        : fluxo.situacao === 'escolherPrincipal'
          ? 'Escolha qual processo governa a revisão deste documento. Os demais vínculos continuam valendo para consulta.'
          : 'Crie e publique o fluxo no módulo Processos. Depois volte aqui: a revisão começa automaticamente na versão publicada.';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

        {avisoTeste}

        <section style={estiloCartao}>
          <div style={estiloBarraSecao}>
            Processo do documento
          </div>

          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <div style={{ fontSize: '17px', fontWeight: 700 }}>{titulo}</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>{explicacao}</div>
            </div>

            {
              fluxo.situacao !== 'semFluxo' && (
                opcoes.length === 0
                  ? (
                    <div style={{ fontSize: '14px' }}>
                      Nenhum processo cadastrado. Cadastre um no módulo <strong>Processos</strong>{' '}
                      (no modo de teste é possível criar processos locais).
                    </div>
                  )
                  : (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ minWidth: '280px', flexGrow: 1, maxWidth: '520px' }}>
                        <label htmlFor="fluxo-processo" style={estiloRotuloCampo}>
                          {fluxo.situacao === 'semProcesso' ? 'Vincular ao processo' : 'Processo principal'}
                        </label>
                        <select
                          id="fluxo-processo"
                          value={processoEscolhido}
                          onChange={evento => setProcessoEscolhido(evento.target.value)}
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
                          <option value="">Selecione...</option>
                          {
                            opcoes.map(
                              processo => (
                                <option key={processo.id} value={processo.id}>
                                  {processo.codigo ? `${processo.codigo} — ` : ''}{processo.nome}
                                  {processo.origem === 'teste' ? ' (teste)' : ''}
                                </option>
                              )
                            )
                          }
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={!processoEscolhido}
                        onClick={() => {
                          const acao =
                            fluxo.situacao === 'semProcesso'
                              ? fluxo.vincularProcesso(processoEscolhido)
                              : fluxo.escolherPrincipal(processoEscolhido);

                          acao.catch(
                            (error: unknown) => console.error(error)
                          );
                        }}
                        style={estiloBotao(true, !processoEscolhido)}
                      >
                        {fluxo.situacao === 'semProcesso' ? `Vincular${teste}` : `Definir como principal${teste}`}
                      </button>
                    </div>
                  )
              )
            }

            {
              fluxo.situacao === 'semFluxo' &&
              fluxo.processoAtual && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {
                    onAbrirProcesso && (
                      <button
                        type="button"
                        onClick={() => onAbrirProcesso(processoAtualId)}
                        style={estiloBotao(true, false)}
                      >
                        Abrir o processo
                      </button>
                    )
                  }
                  <button
                    type="button"
                    onClick={() => {
                      fluxo.recarregar()
                        .catch(
                          (error: unknown) => console.error(error)
                        );
                    }}
                    style={estiloBotao(false, false)}
                  >
                    Verificar novamente
                  </button>
                </div>
              )
            }

            {
              fluxo.vinculos.length > 0 && (
                <div style={{ fontSize: '13px', borderTop: `1px solid ${COR_BORDA}`, paddingTop: '10px' }}>
                  <strong>Vínculos atuais:</strong>{' '}
                  {
                    fluxo.vinculos
                      .map(
                        vinculo => {
                          const processo =
                            fluxo.processos.find(
                              item => item.id === vinculo.processoId
                            );

                          return `${processo ? processo.nome : vinculo.processoId}${vinculo.origem === 'teste' ? ' (teste)' : ''}${vinculo.principal ? ' — principal' : ''}`;
                        }
                      )
                      .join(' · ')
                  }
                </div>
              )
            }
          </div>
        </section>
      </div>
    );
  }

  if (
    fluxo.situacao === 'erro' ||
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

    const valor =
      valoresVisiveis[campo.chave] || '';

    // Somente leitura: mostra o valor preenchido em etapas anteriores.
    if (campo.somenteLeitura && campo.tipo === 'tabela') {
      return (
        <div key={campo.chave}>
          <div style={estiloRotuloCampo}>{campo.rotulo}</div>
          <TabelaCampoFluxo
            id={`fluxo-campo-${campo.chave}`}
            rotulo={campo.rotulo}
            colunas={campo.colunas || []}
            valor={valor}
            somenteLeitura={true}
          />
        </div>
      );
    }

    if (campo.somenteLeitura) {
      return (
        <div key={campo.chave}>
          <div style={estiloRotuloCampo}>{campo.rotulo}</div>
          <div
            style={{
              fontSize: '14px',
              background: '#F2F2F2',
              borderRadius: '6px',
              padding: '8px 10px',
              minHeight: '20px',
              whiteSpace: 'pre-wrap'
            }}
          >
            {formatarValorCampo(campo.tipo, valor) || '—'}
          </div>
        </div>
      );
    }

    const obrigatorio =
      campo.obrigatorio ||
      campoObrigatorioAgora(
        elementoAtual,
        campo.chave,
        valoresVisiveis,
        elementoAtual.acoes.length > 0 ? elementoAtual.acoes[0].resultado : ''
      );

    const desabilitado =
      !podeAgir || fluxo.processando;

    const idCampo =
      `fluxo-campo-${campo.chave}`;

    const ajuda =
      campo.ajuda
        ? (
          <div style={{ fontSize: '12.5px', color: COR_AZUL, marginTop: '6px' }}>
            {campo.ajuda}
          </div>
        )
        : undefined;

    const estiloEntrada: React.CSSProperties = {
      width: '100%',
      boxSizing: 'border-box',
      minHeight: '38px',
      border: `1px solid ${COR_BORDA}`,
      borderRadius: '6px',
      padding: '8px 10px',
      fontFamily: 'inherit',
      fontSize: '14px',
      color: COR_AZUL,
      background: '#FFFFFF'
    };

    if (campo.tipo === 'tabela') {
      return (
        <fieldset
          key={campo.chave}
          style={{
            border: `1px solid ${COR_BORDA}`,
            borderRadius: '6px',
            padding: '12px 14px',
            margin: 0,
            minWidth: 0
          }}
        >
          <legend style={{ ...estiloRotuloCampo, padding: '0 6px', marginBottom: 0 }}>
            {campo.rotulo}{obrigatorio ? ' * (pelo menos uma linha)' : ''}
          </legend>
          <TabelaCampoFluxo
            id={idCampo}
            rotulo={campo.rotulo}
            colunas={campo.colunas || []}
            valor={valor}
            desabilitado={desabilitado}
            onAlterar={novo => definirValor(campo.chave, novo)}
          />
          {ajuda}
        </fieldset>
      );
    }

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
                      disabled={desabilitado}
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
          {ajuda}
        </fieldset>
      );
    }

    let entrada: React.ReactElement;

    if (campo.tipo === 'lista') {
      entrada = (
        <select
          id={idCampo}
          value={valor}
          disabled={desabilitado}
          onChange={evento => definirValor(campo.chave, evento.target.value)}
          style={estiloEntrada}
        >
          <option value="">Selecione...</option>
          {
            (campo.opcoes || []).map(
              opcao => <option key={opcao} value={opcao}>{opcao}</option>
            )
          }
        </select>
      );
    } else if (campo.tipo === 'textoLongo') {
      entrada = (
        <textarea
          id={idCampo}
          rows={3}
          value={valor}
          disabled={desabilitado}
          onChange={evento => definirValor(campo.chave, evento.target.value)}
          style={estiloEntrada}
        />
      );
    } else {
      entrada = (
        <input
          id={idCampo}
          type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
          value={valor}
          disabled={desabilitado}
          onChange={evento => definirValor(campo.chave, evento.target.value)}
          style={estiloEntrada}
        />
      );
    }

    return (
      <div key={campo.chave}>
        <label htmlFor={idCampo} style={estiloRotuloCampo}>
          {campo.rotulo}{obrigatorio ? ' *' : ''}
        </label>
        {entrada}
        {ajuda}
      </div>
    );
  };

  // Metadados já preenchidos nesta revisão.
  const metadadosPreenchidos =
    (definicao.metadados || [])
      .filter(item => !!instancia.valores[item.chave])
      .map(
        item => ({
          chave: item.chave,
          rotulo: item.rotulo,
          tipo: item.tipo,
          colunas: item.colunas || [],
          bruto: instancia.valores[item.chave],
          valor: formatarValorCampo(item.tipo, instancia.valores[item.chave])
        })
      );

  // O que a publicação real faria, conforme as tarefas de sistema
  // que o fluxo percorreu.
  const acoesSistemaExecutadas =
    instancia.historico
      .filter(item => item.sistema)
      .map(item => item.acaoChave);

  const s_ = (seria: string, foi: string): string => (fluxo.local ? seria : foi);

  const resultadoSimulado: string[] =
    acoesSistemaExecutadas.indexOf('publicarComRetreinamento') >= 0
      ? [
        `${instancia.revisao} ${s_('seria marcada', 'foi marcada')} como vigente e a revisão anterior como substituída (histórico preservado).`,
        `O impacto ${s_('seria calculado', 'foi calculado')} em dgt_revisaoimpacto a partir dos treinamentos vinculados ao documento.`,
        `Novas atribuições ${s_('seriam criadas', 'foram criadas')} com origem "Revisão documental", vinculadas a esta revisão.`,
        `Os colaboradores impactados ${s_('seriam notificados', 'são notificados')} pelo Power Automate.`
      ]
      : acoesSistemaExecutadas.indexOf('publicarSemRetreinamento') >= 0
        ? [
          `${instancia.revisao} ${s_('seria marcada', 'foi marcada')} como vigente e a revisão anterior como substituída (histórico preservado).`,
          `A dispensa de retreinamento ${s_('seria registrada', 'foi registrada')} com responsável, data e justificativa.`,
          `Os treinamentos já concluídos ${s_('continuariam', 'continuam')} válidos.`
        ]
        : [
          'O fluxo chegou ao fim sem passar por uma tarefa de sistema de publicação.',
          'A revisão continua fora de vigência até ser publicada. Configure uma tarefa de sistema "Publicar" no fluxo do processo, se for o caso.'
        ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

      {avisoTeste}

      {!compacto && (
      <>
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
          <div style={estiloRotuloCampo}>Processo</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>
            {
              onAbrirProcesso && instancia.processoId
                ? (
                  <button
                    type="button"
                    onClick={() => onAbrirProcesso(instancia.processoId || '')}
                    style={{
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      color: COR_AZUL,
                      font: 'inherit',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                  >
                    {instancia.processoNome || fluxo.processoAtual?.nome || 'Processo'}
                  </button>
                )
                : (instancia.processoNome || '-')
            }
          </div>
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

        {
          fluxo.local
            ? (
              <>
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
              </>
            )
            : (
              <div style={{ marginLeft: 'auto', minWidth: '220px' }}>
                <div style={estiloRotuloCampo}>Você</div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{ator ? ator.rotulo : '-'}</div>
                {
                  ator && ator.descricao && (
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>{ator.descricao}</div>
                  )
                }
              </div>
            )
        }
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

      </>
      )}

      {/* PAINEL + HISTÓRICO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compacto ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
          alignItems: 'start'
        }}
      >

        <section style={estiloCartao}>
          <div style={{ ...estiloBarraSecao, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              {concluido ? (fluxo.local ? 'Resultado (simulado)' : 'Revisão concluída') : `Etapa atual — ${elementoAtual?.nome || '-'}`}
              {compacto && ` · Fluxo ${definicao.nome} v${instancia.fluxoVersao}`}
            </span>
            {
              compacto && onVerFluxoCompleto && (
                <button
                  type="button"
                  onClick={onVerFluxoCompleto}
                  style={{
                    marginLeft: 'auto',
                    minHeight: '30px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,.6)',
                    background: 'transparent',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12px',
                    letterSpacing: 0,
                    textTransform: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Ver fluxo completo e histórico
                </button>
              )
            }
          </div>

          {
            concluido
              ? (
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700 }}>
                    Fluxo concluído em {formatarDataHora(instancia.concluidoEm)}
                  </div>
                  <div style={{ fontSize: '13.5px' }}>
                    {fluxo.local ? 'Em produção, a tarefa de sistema executaria:' : 'O que foi feito na conclusão:'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '21px' }}>
                    {
                      resultadoSimulado.map(
                        item => <li key={item}>{item}</li>
                      )
                    }
                  </ul>
                  {
                    fluxo.local && (
                      <div style={{ fontSize: '12.5px', borderTop: `1px solid ${COR_BORDA}`, paddingTop: '10px' }}>
                        Nenhuma dessas ações foi executada: a publicação real continua sendo feita pela aba “Revisão”.
                      </div>
                    )
                  }
                </div>
              )
              : elementoAtual && (
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <div>
                      <div style={estiloRotuloCampo}>Responsável</div>
                      <div style={{ fontSize: '14px' }}>
                        {
                          (fluxo.responsaveisEtapaAtual.length > 0
                            ? fluxo.responsaveisEtapaAtual
                            : elementoAtual.responsaveis.map(item => item.descricao)
                          ).join(' · ') || '-'
                        }
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
                        {
                          fluxo.local
                            ? (
                              <>
                                <strong style={{ color: COR_INDIGO }}>Sem permissão nesta etapa.</strong>{' '}
                                {ator?.ator.nome} não é responsável por “{elementoAtual.nome}”.
                                Troque em “Executar como” para simular o responsável.
                              </>
                            )
                            : (
                              <>
                                <strong style={{ color: COR_INDIGO }}>Aguardando o responsável.</strong>{' '}
                                A etapa “{elementoAtual.nome}” está com{' '}
                                <strong>{fluxo.responsaveisEtapaAtual.join(' · ') || 'o responsável definido no fluxo'}</strong>.
                                Somente {fluxo.responsaveisEtapaAtual.length > 1 ? 'eles podem' : 'ele pode'} avançar a revisão.
                              </>
                            )
                        }
                      </div>
                    )
                  }

                  {
                    (podeAgir || fluxo.local) &&
                    elementoAtual.campos.map(
                      campo => renderizarCampo(campo)
                    )
                  }

                  {(podeAgir || fluxo.local) && <div>
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
                  </div>}

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
                      (podeAgir || fluxo.local) &&
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

        {!compacto && <section style={estiloCartao}>
          <div style={estiloBarraSecao}>
            {fluxo.local ? 'Histórico da tramitação (simulado)' : 'Histórico da tramitação'}
          </div>
          {
            metadadosPreenchidos.length > 0 && (
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${COR_BORDA}`, background: '#EDF0F5' }}>
                <div style={estiloRotuloCampo}>Metadados desta revisão</div>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '4px 12px', fontSize: '13.5px' }}>
                  {
                    metadadosPreenchidos.map(
                      item => (
                        <React.Fragment key={item.chave}>
                          <dt style={{ fontWeight: 600, gridColumn: item.tipo === 'tabela' ? '1 / -1' : undefined }}>{item.rotulo}</dt>
                          <dd style={{ margin: 0, whiteSpace: 'pre-wrap', gridColumn: item.tipo === 'tabela' ? '1 / -1' : undefined }}>
                            {
                              item.tipo === 'tabela'
                                ? (
                                  <TabelaCampoFluxo
                                    id={`resumo-${item.chave}`}
                                    rotulo={item.rotulo}
                                    colunas={item.colunas}
                                    valor={item.bruto}
                                    somenteLeitura={true}
                                  />
                                )
                                : item.valor
                            }
                          </dd>
                        </React.Fragment>
                      )
                    )
                  }
                </dl>
              </div>
            )
          }
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
        </section>}
      </div>
    </div>
  );
};

export default FluxoRevisaoTab;
