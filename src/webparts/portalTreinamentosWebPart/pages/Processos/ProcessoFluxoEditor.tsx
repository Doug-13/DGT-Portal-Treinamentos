import * as React from 'react';

import {
  IFluxoDefinicao,
  IFluxoElemento,
  TipoResponsavelFluxo
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  FLUXO_MODELOS
} from '../../services/fluxo/definicoes/fluxoPopProcedimento';

import {
  fluxoCatalogo,
  IResultadoCatalogo,
  validarDefinicao
} from '../../services/fluxo/FluxoCatalogoLocal';

import FluxoDiagrama from
  '../../components/fluxo/FluxoDiagrama';

// ============================================================
// ABA "FLUXO" DO PROCESSO
//
// Cria o fluxo do processo a partir de um modelo, edita o
// rascunho (prazos, responsáveis, instruções, ações), publica e
// versiona. A ESTRUTURA (etapas e ligações) vem do modelo; a
// edição estrutural virá com a importação de BPMN.
//
// Modo de teste: tudo fica no navegador.
// ============================================================

export interface IProcessoFluxoEditorProps {
  processo: IProcesso;
  versoes: IFluxoDefinicao[];
  podeEditar: boolean;
  onAlterado: () => Promise<void>;
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

const estiloRotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  marginBottom: '4px'
};

const estiloEntrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '38px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '6px 10px',
  fontFamily: 'inherit',
  fontSize: '14px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const estiloBotao = (
  principal: boolean,
  desabilitado: boolean
): React.CSSProperties => ({
  minHeight: '40px',
  padding: '0 16px',
  borderRadius: '6px',
  border: `2px solid ${COR_AZUL}`,
  background: principal ? COR_AZUL : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '13.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.45 : 1
});

const ROTULO_STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicada',
  arquivado: 'Arquivada'
};

const TIPOS_RESPONSAVEL: Array<{ valor: TipoResponsavelFluxo; rotulo: string }> = [
  { valor: 'autorRevisao', rotulo: 'Autor da revisão' },
  { valor: 'gestorArea', rotulo: 'Gestor da área do documento' },
  { valor: 'grupo', rotulo: 'Grupo' },
  { valor: 'funcao', rotulo: 'Função' },
  { valor: 'setor', rotulo: 'Setor' },
  { valor: 'usuario', rotulo: 'Usuário específico' }
];

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
    : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const copiar = (
  definicao: IFluxoDefinicao
): IFluxoDefinicao =>
  JSON.parse(JSON.stringify(definicao)) as IFluxoDefinicao;

const ProcessoFluxoEditor: React.FC<IProcessoFluxoEditorProps> = ({
  processo,
  versoes,
  podeEditar,
  onAlterado
}) => {

  const [versaoSelecionada, setVersaoSelecionada] =
    React.useState<number | undefined>(undefined);

  const [edicao, setEdicao] =
    React.useState<IFluxoDefinicao | undefined>(undefined);

  const [elementoId, setElementoId] =
    React.useState<string>('');

  const [modeloId, setModeloId] =
    React.useState<string>(FLUXO_MODELOS.length > 0 ? FLUXO_MODELOS[0].id : '');

  const [mensagens, setMensagens] =
    React.useState<{ tipo: 'erro' | 'ok'; textos: string[] } | undefined>(undefined);

  const [processando, setProcessando] =
    React.useState<boolean>(false);

  // Versão padrão: o rascunho (se houver), senão a publicada,
  // senão a mais nova.
  const versaoPadrao =
    (versoes.find(item => item.status === 'rascunho') ||
      versoes.find(item => item.status === 'publicado') ||
      versoes[0]);

  const definicaoSelecionada =
    versoes.find(
      item => item.versao === versaoSelecionada
    ) || versaoPadrao;

  // Ao trocar a versão exibida, descarta a edição em memória.
  React.useEffect(
    () => {
      setEdicao(
        definicaoSelecionada && definicaoSelecionada.status === 'rascunho'
          ? copiar(definicaoSelecionada)
          : undefined
      );
    },
    [definicaoSelecionada?.versao, definicaoSelecionada?.status, versoes]
  );

  const editavel =
    podeEditar &&
    !!definicaoSelecionada &&
    definicaoSelecionada.status === 'rascunho';

  const exibida: IFluxoDefinicao | undefined =
    editavel && edicao
      ? edicao
      : definicaoSelecionada;

  const alterado =
    !!edicao &&
    !!definicaoSelecionada &&
    JSON.stringify(edicao) !== JSON.stringify(definicaoSelecionada);

  const etapasHumanas: IFluxoElemento[] =
    exibida
      ? exibida.elementos.filter(item => item.tipo === 'tarefaHumana')
      : [];

  const etapaSelecionada =
    etapasHumanas.find(item => item.id === elementoId) ||
    etapasHumanas[0];

  const executar = async (
    acao: () => Promise<IResultadoCatalogo>,
    sucesso: string,
    aposSucesso?: (resultado: IResultadoCatalogo) => void
  ): Promise<void> => {

    setProcessando(true);
    setMensagens(undefined);

    try {

      const resultado =
        await acao();

      if (!resultado.ok) {
        setMensagens({ tipo: 'erro', textos: resultado.erros });
        return;
      }

      await onAlterado();

      if (aposSucesso) {
        aposSucesso(resultado);
      }

      setMensagens({ tipo: 'ok', textos: [sucesso] });

    } catch (error) {

      console.error(error);

      setMensagens({ tipo: 'erro', textos: ['Erro inesperado. Veja o console do navegador.'] });

    } finally {
      setProcessando(false);
    }
  };

  const alterarEtapa = (
    id: string,
    alteracao: (elemento: IFluxoElemento) => void
  ): void => {

    if (!edicao) {
      return;
    }

    const nova =
      copiar(edicao);

    const elemento =
      nova.elementos.find(item => item.id === id);

    if (!elemento) {
      return;
    }

    alteracao(elemento);

    setEdicao(nova);
    setMensagens(undefined);
  };

  // ----------------------------------------------------------
  // Processo sem fluxo
  // ----------------------------------------------------------

  if (versoes.length === 0 || !exibida) {
    return (
      <section style={estiloCartao}>
        <div style={estiloBarraSecao}>Fluxo do processo</div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', color: COR_AZUL }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>Este processo ainda não tem fluxo</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              Os documentos vinculados a este processo vão seguir o fluxo definido aqui quando uma revisão começar.
            </div>
          </div>

          {
            podeEditar
              ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ minWidth: '280px', flexGrow: 1, maxWidth: '520px' }}>
                    <label htmlFor="modelo-fluxo" style={estiloRotulo}>Começar a partir do modelo</label>
                    <select
                      id="modelo-fluxo"
                      value={modeloId}
                      onChange={evento => setModeloId(evento.target.value)}
                      style={estiloEntrada}
                    >
                      {
                        FLUXO_MODELOS.map(
                          modelo => (
                            <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                          )
                        )
                      }
                    </select>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                      {FLUXO_MODELOS.find(modelo => modelo.id === modeloId)?.descricao}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={processando || !modeloId}
                    onClick={() => {
                      executar(
                        () => fluxoCatalogo.criarAPartirDoModelo(processo, modeloId),
                        'Rascunho da versão 1 criado. Ajuste o que precisar e publique.',
                        () => setVersaoSelecionada(1)
                      ).catch((error: unknown) => console.error(error));
                    }}
                    style={estiloBotao(true, processando)}
                  >
                    Criar fluxo (teste)
                  </button>
                </div>
              )
              : (
                <div style={{ fontSize: '14px' }}>
                  Somente administradores e editores de documentos podem criar o fluxo.
                </div>
              )
          }

          {
            mensagens && (
              <div role="alert" style={{ fontSize: '13.5px', color: mensagens.tipo === 'erro' ? COR_INDIGO : COR_AZUL }}>
                {mensagens.textos.join(' ')}
              </div>
            )
          }
        </div>
      </section>
    );
  }

  const temRascunho =
    versoes.some(item => item.status === 'rascunho');

  const errosValidacao =
    editavel && edicao
      ? validarDefinicao(edicao)
      : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

      {/* VERSÕES */}
      <section style={{ ...estiloCartao, padding: '14px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={estiloRotulo}>Versões</span>
        {
          versoes.map(
            item => {
              const ativa =
                item.versao === exibida.versao;

              return (
                <button
                  key={item.versao}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => {
                    setVersaoSelecionada(item.versao);
                    setMensagens(undefined);
                  }}
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '18px',
                    border: `2px solid ${item.status === 'publicado' ? COR_CIANO : COR_AZUL}`,
                    borderStyle: item.status === 'arquivado' ? 'dashed' : 'solid',
                    background: ativa ? COR_AZUL : '#FFFFFF',
                    color: ativa ? '#FFFFFF' : COR_AZUL,
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  v{item.versao} · {ROTULO_STATUS[item.status]}
                </button>
              );
            }
          )
        }

        <span style={{ marginLeft: 'auto', fontSize: '12.5px', maxWidth: '520px' }}>
          Revisões novas usam a versão <strong>publicada</strong>. Revisões em andamento continuam na versão em que começaram.
        </span>
      </section>

      {/* DIAGRAMA */}
      <section style={estiloCartao}>
        <div style={{ ...estiloBarraSecao, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>{exibida.nome} — v{exibida.versao} ({ROTULO_STATUS[exibida.status]})</span>
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '12.5px' }}>
            {
              exibida.status === 'publicado'
                ? `Publicada em ${formatarData(exibida.publicadoEm)}`
                : exibida.status === 'arquivado'
                  ? `Arquivada em ${formatarData(exibida.arquivadoEm)}`
                  : `Criada em ${formatarData(exibida.criadoEm)}`
            }
          </span>
        </div>
        <div style={{ padding: '8px 0' }}>
          <FluxoDiagrama
            definicao={exibida}
            elementoDestacadoId={editavel && etapaSelecionada ? etapaSelecionada.id : undefined}
          />
        </div>
      </section>

      {/* ETAPAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>

        <section style={estiloCartao}>
          <div style={estiloBarraSecao}>Etapas com responsável</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {
              etapasHumanas.map(
                etapa => {
                  const ativa =
                    etapaSelecionada && etapa.id === etapaSelecionada.id;

                  return (
                    <li key={etapa.id} style={{ borderBottom: `1px solid ${COR_BORDA}` }}>
                      <button
                        type="button"
                        aria-pressed={!!ativa}
                        onClick={() => setElementoId(etapa.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 20px',
                          border: 0,
                          borderLeft: `4px solid ${ativa ? COR_CIANO : 'transparent'}`,
                          background: ativa ? '#E6F9FC' : '#FFFFFF',
                          color: COR_AZUL,
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{etapa.nome}</div>
                        <div style={{ fontSize: '12.5px' }}>
                          {etapa.responsaveis.map(item => item.descricao).join(', ') || 'Sem responsável'}
                          {etapa.prazoDiasUteis !== undefined ? ` · ${etapa.prazoDiasUteis} dias úteis` : ''}
                        </div>
                      </button>
                    </li>
                  );
                }
              )
            }
          </ul>
        </section>

        {
          etapaSelecionada && (
            <section style={estiloCartao}>
              <div style={estiloBarraSecao}>
                {editavel ? 'Editar etapa' : 'Detalhes da etapa'} — {etapaSelecionada.nome}
              </div>

              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {
                  !editavel && (
                    <div style={{ background: '#EDF0F5', borderRadius: '6px', padding: '10px 12px', fontSize: '13.5px' }}>
                      {
                        podeEditar
                          ? temRascunho
                            ? 'Esta versão não pode ser alterada. Selecione o rascunho para editar.'
                            : 'Versões publicadas não são alteradas. Clique em “Criar nova versão” para fazer ajustes.'
                          : 'Somente administradores e editores de documentos podem alterar o fluxo.'
                      }
                    </div>
                  )
                }

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label htmlFor="etapa-nome" style={estiloRotulo}>Nome da etapa</label>
                    <input
                      id="etapa-nome"
                      type="text"
                      value={etapaSelecionada.nome}
                      disabled={!editavel}
                      onChange={evento => {
                        const valor = evento.target.value;
                        alterarEtapa(etapaSelecionada.id, elemento => { elemento.nome = valor; });
                      }}
                      style={estiloEntrada}
                    />
                  </div>
                  <div>
                    <label htmlFor="etapa-subtitulo" style={estiloRotulo}>Texto no diagrama</label>
                    <input
                      id="etapa-subtitulo"
                      type="text"
                      value={etapaSelecionada.subtitulo || ''}
                      disabled={!editavel}
                      onChange={evento => {
                        const valor = evento.target.value;
                        alterarEtapa(etapaSelecionada.id, elemento => { elemento.subtitulo = valor; });
                      }}
                      style={estiloEntrada}
                    />
                  </div>
                  <div>
                    <label htmlFor="etapa-prazo" style={estiloRotulo}>Prazo (dias úteis)</label>
                    <input
                      id="etapa-prazo"
                      type="number"
                      min={0}
                      max={365}
                      value={etapaSelecionada.prazoDiasUteis === undefined ? '' : etapaSelecionada.prazoDiasUteis}
                      disabled={!editavel}
                      onChange={evento => {
                        const bruto = evento.target.value;
                        alterarEtapa(etapaSelecionada.id, elemento => {
                          elemento.prazoDiasUteis = bruto === '' ? undefined : Math.round(Number(bruto));
                        });
                      }}
                      style={estiloEntrada}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="etapa-instrucoes" style={estiloRotulo}>Instruções para o responsável</label>
                  <textarea
                    id="etapa-instrucoes"
                    rows={2}
                    value={etapaSelecionada.instrucoes || ''}
                    disabled={!editavel}
                    onChange={evento => {
                      const valor = evento.target.value;
                      alterarEtapa(etapaSelecionada.id, elemento => { elemento.instrucoes = valor; });
                    }}
                    style={{ ...estiloEntrada, minHeight: '60px' }}
                  />
                </div>

                <fieldset style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '12px 14px', margin: 0 }}>
                  <legend style={{ ...estiloRotulo, padding: '0 6px', marginBottom: 0 }}>Responsável</legend>
                  {
                    etapaSelecionada.responsaveis.map(
                      (responsavel, indice) => (
                        <div
                          key={`${etapaSelecionada.id}-resp-${indice}`}
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}
                        >
                          <div>
                            <label htmlFor={`resp-tipo-${indice}`} style={estiloRotulo}>Tipo</label>
                            <select
                              id={`resp-tipo-${indice}`}
                              value={responsavel.tipo}
                              disabled={!editavel}
                              onChange={evento => {
                                const valor = evento.target.value as TipoResponsavelFluxo;
                                alterarEtapa(etapaSelecionada.id, elemento => {
                                  elemento.responsaveis[indice].tipo = valor;
                                });
                              }}
                              style={estiloEntrada}
                            >
                              {
                                TIPOS_RESPONSAVEL.map(
                                  tipo => (
                                    <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                                  )
                                )
                              }
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`resp-desc-${indice}`} style={estiloRotulo}>Descrição</label>
                            <input
                              id={`resp-desc-${indice}`}
                              type="text"
                              value={responsavel.descricao}
                              disabled={!editavel}
                              onChange={evento => {
                                const valor = evento.target.value;
                                alterarEtapa(etapaSelecionada.id, elemento => {
                                  elemento.responsaveis[indice].descricao = valor;
                                });
                              }}
                              style={estiloEntrada}
                            />
                          </div>
                        </div>
                      )
                    )
                  }
                  <div style={{ fontSize: '12.5px', marginTop: '8px' }}>
                    No modo de teste, a permissão continua sendo simulada pelo papel da etapa
                    (“Executar como” na aba do documento). A escolha do grupo, função ou setor real
                    virá junto com as tabelas do Dataverse.
                  </div>
                </fieldset>

                <fieldset style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '12px 14px', margin: 0 }}>
                  <legend style={{ ...estiloRotulo, padding: '0 6px', marginBottom: 0 }}>Ações (botões da etapa)</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {
                      etapaSelecionada.acoes.map(
                        (acao, indice) => (
                          <div
                            key={acao.chave}
                            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
                          >
                            <div style={{ flexGrow: 1, minWidth: '220px' }}>
                              <label htmlFor={`acao-${acao.chave}`} style={{ ...estiloRotulo, textTransform: 'none', letterSpacing: 0, fontSize: '12px' }}>
                                Texto do botão ({acao.principal ? 'principal' : 'secundário'})
                              </label>
                              <input
                                id={`acao-${acao.chave}`}
                                type="text"
                                value={acao.rotulo}
                                disabled={!editavel}
                                onChange={evento => {
                                  const valor = evento.target.value;
                                  alterarEtapa(etapaSelecionada.id, elemento => {
                                    elemento.acoes[indice].rotulo = valor;
                                  });
                                }}
                                style={estiloEntrada}
                              />
                            </div>
                            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px', minHeight: '44px', cursor: editavel ? 'pointer' : 'default' }}>
                              <input
                                type="checkbox"
                                checked={acao.exigeComentario}
                                disabled={!editavel}
                                onChange={evento => {
                                  const valor = evento.target.checked;
                                  alterarEtapa(etapaSelecionada.id, elemento => {
                                    elemento.acoes[indice].exigeComentario = valor;
                                  });
                                }}
                              />
                              Comentário obrigatório
                            </label>
                          </div>
                        )
                      )
                    }
                  </div>
                </fieldset>

                {
                  etapaSelecionada.campos.length > 0 && (
                    <div style={{ fontSize: '13.5px' }}>
                      <strong>Campos desta etapa:</strong>{' '}
                      {etapaSelecionada.campos.map(campo => campo.rotulo).join(' · ')}
                    </div>
                  )
                }
              </div>
            </section>
          )
        }
      </div>

      {/* MENSAGENS + AÇÕES */}
      {
        (mensagens || errosValidacao.length > 0) && (
          <div
            role="alert"
            style={{
              border: `2px solid ${mensagens && mensagens.tipo === 'ok' && errosValidacao.length === 0 ? COR_CIANO : COR_INDIGO}`,
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13.5px',
              background: '#FFFFFF'
            }}
          >
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {
                (mensagens ? mensagens.textos : []).concat(
                  errosValidacao.map(item => `Para publicar: ${item}`)
                ).map(
                  item => <li key={item}>{item}</li>
                )
              }
            </ul>
          </div>
        )
      }

      {
        podeEditar && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {
              editavel && edicao && (
                <>
                  <button
                    type="button"
                    disabled={!alterado || processando}
                    onClick={() => {
                      executar(
                        () => fluxoCatalogo.salvarRascunho(edicao),
                        'Rascunho salvo neste navegador.'
                      ).catch((error: unknown) => console.error(error));
                    }}
                    style={estiloBotao(false, !alterado || processando)}
                  >
                    Salvar rascunho
                  </button>

                  <button
                    type="button"
                    disabled={!alterado || processando}
                    onClick={() => {
                      if (definicaoSelecionada) {
                        setEdicao(copiar(definicaoSelecionada));
                        setMensagens(undefined);
                      }
                    }}
                    style={estiloBotao(false, !alterado || processando)}
                  >
                    Desfazer alterações
                  </button>

                  <button
                    type="button"
                    disabled={processando || errosValidacao.length > 0}
                    onClick={() => {
                      if (!window.confirm(`Publicar a versão ${edicao.versao}? Revisões novas passarão a usar esta versão.`)) {
                        return;
                      }

                      executar(
                        async () => {
                          const salvo = await fluxoCatalogo.salvarRascunho(edicao);
                          return salvo.ok
                            ? fluxoCatalogo.publicarRascunho(processo.id)
                            : salvo;
                        },
                        `Versão ${edicao.versao} publicada (teste).`
                      ).catch((error: unknown) => console.error(error));
                    }}
                    style={estiloBotao(true, processando || errosValidacao.length > 0)}
                  >
                    Publicar versão {edicao.versao}
                  </button>

                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => {
                      if (!window.confirm('Descartar o rascunho? As alterações desta versão serão perdidas.')) {
                        return;
                      }

                      executar(
                        () => fluxoCatalogo.descartarRascunho(processo.id),
                        'Rascunho descartado.',
                        () => setVersaoSelecionada(undefined)
                      ).catch((error: unknown) => console.error(error));
                    }}
                    style={estiloBotao(false, processando)}
                  >
                    Descartar rascunho
                  </button>
                </>
              )
            }

            {
              !temRascunho && (
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => {
                    executar(
                      () => fluxoCatalogo.criarNovaVersao(processo.id),
                      'Nova versão criada como rascunho, a partir da versão publicada.',
                      resultado => setVersaoSelecionada(resultado.definicao ? resultado.definicao.versao : undefined)
                    ).catch((error: unknown) => console.error(error));
                  }}
                  style={estiloBotao(true, processando)}
                >
                  Criar nova versão
                </button>
              )
            }
          </div>
        )
      }
    </div>
  );
};

export default ProcessoFluxoEditor;
