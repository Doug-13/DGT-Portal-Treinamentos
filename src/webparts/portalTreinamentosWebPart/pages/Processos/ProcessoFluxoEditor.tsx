import * as React from 'react';

import {
  IFluxoDefinicao,
  IFluxoMetadado,
  TipoElementoFluxo
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  FLUXO_MODELOS
} from '../../services/fluxo/definicoes/fluxoPopProcedimento';

import {
  fluxoCatalogo,
  IResultadoCatalogo
} from '../../services/fluxo/FluxoCatalogoLocal';

import {
  validarDefinicao
} from '../../services/fluxo/FluxoValidacao';

import {
  configDaTransicao,
  configDoElemento,
  configPadraoElemento,
  configPadraoTransicao,
  definicaoParaBpmnXml,
  IConfigElemento,
  IConfigTransicao,
  metadadosDaDefinicao,
  montarDefinicao,
  tipoFluxoDoBpmn
} from '../../services/fluxo/bpmn/bpmnConversao';

import FluxoDiagrama from
  '../../components/fluxo/FluxoDiagrama';

import EditorBpmnFluxo, {
  IEditorBpmnFluxoRef
} from '../../components/fluxo/bpmn/EditorBpmnFluxo';

import {
  IElementoSelecionadoBpmn
} from '../../components/fluxo/bpmn/IModelerFluxo';

import PainelPropriedadesFluxo, {
  IResultadoDisponivel
} from './PainelPropriedadesFluxo';

import PainelMetadados from
  './PainelMetadados';

// ============================================================
// ABA "FLUXO" DO PROCESSO
//
// Rascunho → editor visual BPMN (arrastar etapas, decisões,
// ligações) + painel de propriedades + metadados do processo.
// Publicada/arquivada → somente leitura.
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

interface IEstadoEdicao {
  configsElementos: Record<string, IConfigElemento>;
  configsTransicoes: Record<string, IConfigTransicao>;
  metadados: IFluxoMetadado[];
  xml: string;
}

const estadoInicial = (
  definicao: IFluxoDefinicao
): IEstadoEdicao => {

  const configsElementos: Record<string, IConfigElemento> = {};
  const configsTransicoes: Record<string, IConfigTransicao> = {};

  definicao.elementos.forEach(
    elemento => {
      configsElementos[elemento.id] = JSON.parse(JSON.stringify(configDoElemento(elemento))) as IConfigElemento;
    }
  );

  definicao.transicoes.forEach(
    transicao => {
      configsTransicoes[transicao.id] = configDaTransicao(transicao);
    }
  );

  return {
    configsElementos,
    configsTransicoes,
    metadados: JSON.parse(JSON.stringify(metadadosDaDefinicao(definicao))) as IFluxoMetadado[],
    xml: definicao.bpmnXml || definicaoParaBpmnXml(definicao)
  };
};

const baixarArquivo = (
  nome: string,
  conteudo: string
): void => {

  const blob =
    new Blob([conteudo], { type: 'application/xml' });

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const ProcessoFluxoEditor: React.FC<IProcessoFluxoEditorProps> = ({
  processo,
  versoes,
  podeEditar,
  onAlterado
}) => {

  const editorRef =
    React.useRef<IEditorBpmnFluxoRef>(null);

  const arquivoRef =
    React.useRef<HTMLInputElement>(null);

  const [versaoSelecionada, setVersaoSelecionada] =
    React.useState<number | undefined>(undefined);

  const [edicao, setEdicao] =
    React.useState<IEstadoEdicao | undefined>(undefined);

  const [chaveEditor, setChaveEditor] =
    React.useState<number>(0);

  const [selecionado, setSelecionado] =
    React.useState<IElementoSelecionadoBpmn | undefined>(undefined);

  const [alterado, setAlterado] =
    React.useState<boolean>(false);

  const [modeloId, setModeloId] =
    React.useState<string>(FLUXO_MODELOS.length > 0 ? FLUXO_MODELOS[0].id : '');

  const [mensagens, setMensagens] =
    React.useState<{ tipo: 'erro' | 'ok'; titulo: string; textos: string[] } | undefined>(undefined);

  const [processando, setProcessando] =
    React.useState<boolean>(false);

  // Versão padrão: o rascunho (se houver), senão a publicada.
  const versaoPadrao =
    versoes.find(item => item.status === 'rascunho') ||
    versoes.find(item => item.status === 'publicado') ||
    versoes[0];

  const definicaoSelecionada =
    versoes.find(item => item.versao === versaoSelecionada) ||
    versaoPadrao;

  const editavel =
    podeEditar &&
    !!definicaoSelecionada &&
    definicaoSelecionada.status === 'rascunho';

  // Ao trocar de versão (ou após salvar), recarrega o estado de edição.
  // (salvar o rascunho NÃO recarrega o editor: o estado em memória
  // já é o que foi salvo.)
  const assinatura =
    definicaoSelecionada
      ? `${processo.id}|${definicaoSelecionada.versao}|${definicaoSelecionada.status}`
      : processo.id;

  React.useEffect(
    () => {
      setEdicao(
        definicaoSelecionada && definicaoSelecionada.status === 'rascunho'
          ? estadoInicial(definicaoSelecionada)
          : undefined
      );
      setSelecionado(undefined);
      setAlterado(false);
      setChaveEditor(chave => chave + 1);
    },
    [assinatura]
  );

  const trocarVersao = (
    versao: number
  ): void => {

    if (
      alterado &&
      !window.confirm('Há alterações não salvas no rascunho. Trocar de versão e descartá-las?')
    ) {
      return;
    }

    setVersaoSelecionada(versao);
    setMensagens(undefined);
  };

  const executar = async (
    acao: () => Promise<IResultadoCatalogo>,
    sucesso: string,
    aposSucesso?: (resultado: IResultadoCatalogo) => void
  ): Promise<boolean> => {

    setProcessando(true);
    setMensagens(undefined);

    try {

      const resultado =
        await acao();

      if (!resultado.ok) {
        setMensagens({ tipo: 'erro', titulo: 'Não foi possível concluir:', textos: resultado.erros });
        return false;
      }

      await onAlterado();

      if (aposSucesso) {
        aposSucesso(resultado);
      }

      setMensagens({ tipo: 'ok', titulo: sucesso, textos: [] });

      return true;

    } catch (error) {

      console.error(error);

      setMensagens({ tipo: 'erro', titulo: 'Erro inesperado.', textos: ['Veja o console do navegador (F12).'] });

      return false;

    } finally {
      setProcessando(false);
    }
  };

  // Monta a definição a partir do desenho + configurações atuais.
  const montar = async (): Promise<IFluxoDefinicao | undefined> => {

    if (!edicao || !definicaoSelecionada || !editorRef.current) {
      return undefined;
    }

    const snapshot =
      editorRef.current.obterSnapshot();

    if (!snapshot) {
      return undefined;
    }

    const xml =
      await editorRef.current.exportarXml();

    return montarDefinicao({
      base: definicaoSelecionada,
      snapshot,
      configsElementos: edicao.configsElementos,
      configsTransicoes: edicao.configsTransicoes,
      metadados: edicao.metadados,
      bpmnXml: xml
    });
  };

  const salvar = async (
    publicar: boolean
  ): Promise<void> => {

    const definicao =
      await montar();

    if (!definicao) {
      return;
    }

    const erros =
      validarDefinicao(definicao);

    if (publicar && erros.length > 0) {
      setMensagens({
        tipo: 'erro',
        titulo: `Corrija ${erros.length} ponto(s) antes de publicar:`,
        textos: erros
      });
      return;
    }

    if (
      publicar &&
      !window.confirm(`Publicar a versão ${definicao.versao}? Revisões novas passarão a usar esta versão.`)
    ) {
      return;
    }

    const ok =
      await executar(
        async () => {
          const salvo = await fluxoCatalogo.salvarRascunho(definicao);
          return publicar && salvo.ok
            ? fluxoCatalogo.publicarRascunho(processo.id)
            : salvo;
        },
        publicar
          ? `Versão ${definicao.versao} publicada (teste).`
          : 'Rascunho salvo neste navegador.'
      );

    if (ok && !publicar && erros.length > 0) {
      setMensagens({
        tipo: 'ok',
        titulo: `Rascunho salvo. Antes de publicar, ainda falta resolver ${erros.length} ponto(s):`,
        textos: erros
      });
    }

    if (ok) {
      setAlterado(false);
    }
  };

  const verificar = async (): Promise<void> => {

    const definicao =
      await montar();

    if (!definicao) {
      return;
    }

    const erros =
      validarDefinicao(definicao);

    setMensagens(
      erros.length === 0
        ? { tipo: 'ok', titulo: 'Nenhum problema encontrado. O fluxo pode ser publicado.', textos: [] }
        : { tipo: 'erro', titulo: `${erros.length} ponto(s) para resolver antes de publicar:`, textos: erros }
    );
  };

  const importarArquivo = (
    arquivo: File
  ): void => {

    const leitor =
      new FileReader();

    leitor.onload = () => {

      const xml =
        String(leitor.result || '');

      if (xml.indexOf('bpmn') < 0) {
        setMensagens({ tipo: 'erro', titulo: 'O arquivo não parece ser um BPMN.', textos: [] });
        return;
      }

      setEdicao(
        atual => atual ? { ...atual, xml } : atual
      );
      setSelecionado(undefined);
      setAlterado(true);
      setChaveEditor(chave => chave + 1);
      setMensagens({
        tipo: 'ok',
        titulo: 'Desenho importado. Configure as etapas novas e salve o rascunho.',
        textos: ['Etapas com o mesmo id de antes mantêm a configuração.']
      });
    };

    leitor.readAsText(arquivo);
  };

  // ----------------------------------------------------------
  // Processo sem fluxo
  // ----------------------------------------------------------

  if (versoes.length === 0 || !definicaoSelecionada) {
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
                    <label htmlFor="modelo-fluxo" style={estiloRotulo}>Começar a partir de</label>
                    <select
                      id="modelo-fluxo"
                      value={modeloId}
                      onChange={evento => setModeloId(evento.target.value)}
                      style={estiloEntrada}
                    >
                      {
                        FLUXO_MODELOS.map(
                          modelo => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
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
                        'Rascunho da versão 1 criado. Desenhe e configure o fluxo, depois publique.',
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
                {mensagens.titulo} {mensagens.textos.join(' ')}
              </div>
            )
          }
        </div>
      </section>
    );
  }

  const temRascunho =
    versoes.some(item => item.status === 'rascunho');

  // ----------------------------------------------------------
  // Dados do painel de propriedades
  // ----------------------------------------------------------

  const tipoSelecionado: TipoElementoFluxo | undefined =
    selecionado && !selecionado.conexao
      ? tipoFluxoDoBpmn(selecionado.tipoBpmn)
      : undefined;

  const snapshotAtual =
    editavel && selecionado && editorRef.current
      ? editorRef.current.obterSnapshot()
      : undefined;

  const tipoDe = (
    id: string
  ): TipoElementoFluxo | undefined => {
    const forma =
      snapshotAtual ? snapshotAtual.formas.find(item => item.id === id) : undefined;
    return forma ? tipoFluxoDoBpmn(forma.tipo) : undefined;
  };

  const nomeDe = (
    id: string
  ): string => {
    const forma =
      snapshotAtual ? snapshotAtual.formas.find(item => item.id === id) : undefined;
    return forma ? (forma.nome || 'Etapa sem nome') : id;
  };

  const acoesDe = (
    id: string
  ): IResultadoDisponivel[] => {
    const config =
      edicao ? edicao.configsElementos[id] : undefined;
    return tipoDe(id) === 'tarefaHumana'
      ? (config || configPadraoElemento('tarefaHumana')).acoes.map(
        acao => ({ resultado: acao.resultado, descricao: `${acao.rotulo} (${nomeDe(id)})` })
      )
      : [];
  };

  const tipoOrigem =
    selecionado && selecionado.conexao && selecionado.origemId
      ? tipoDe(selecionado.origemId)
      : undefined;

  let resultadosDisponiveis: IResultadoDisponivel[] = [];

  if (selecionado && selecionado.conexao && selecionado.origemId && snapshotAtual) {

    if (tipoOrigem === 'tarefaHumana') {
      resultadosDisponiveis = acoesDe(selecionado.origemId);
    } else if (tipoOrigem === 'gateway') {
      // Resultados das etapas que chegam na decisão.
      const anteriores =
        snapshotAtual.conexoes
          .filter(conexao => conexao.destinoId === selecionado.origemId)
          .map(conexao => conexao.origemId);

      anteriores.forEach(
        id => { resultadosDisponiveis = resultadosDisponiveis.concat(acoesDe(id)); }
      );

      if (resultadosDisponiveis.length === 0) {
        snapshotAtual.formas.forEach(
          forma => { resultadosDisponiveis = resultadosDisponiveis.concat(acoesDe(forma.id)); }
        );
      }
    }
  }

  const usoPorChave: Record<string, number> = {};

  if (edicao) {
    Object.keys(edicao.configsElementos).forEach(
      id => {
        edicao.configsElementos[id].campos.forEach(
          campo => { usoPorChave[campo.chave] = (usoPorChave[campo.chave] || 0) + 1; }
        );
      }
    );
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

      {/* VERSÕES */}
      <section style={{ ...estiloCartao, padding: '14px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={estiloRotulo}>Versões</span>
        {
          versoes.map(
            item => {
              const ativa =
                item.versao === definicaoSelecionada.versao;

              return (
                <button
                  key={item.versao}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => trocarVersao(item.versao)}
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

      {/* CABEÇALHO DA VERSÃO */}
      <section style={estiloCartao}>
        <div style={{ ...estiloBarraSecao, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>{definicaoSelecionada.nome} — v{definicaoSelecionada.versao} ({ROTULO_STATUS[definicaoSelecionada.status]})</span>
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '12.5px' }}>
            {
              definicaoSelecionada.status === 'publicado'
                ? `Publicada em ${formatarData(definicaoSelecionada.publicadoEm)}`
                : definicaoSelecionada.status === 'arquivado'
                  ? `Arquivada em ${formatarData(definicaoSelecionada.arquivadoEm)}`
                  : `Criada em ${formatarData(definicaoSelecionada.criadoEm)}${alterado ? ' · alterações não salvas' : ''}`
            }
          </span>
        </div>

        {
          editavel && edicao
            ? (
              <div style={{ padding: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'stretch' }}>

                <div style={{ flex: '1 1 640px', minWidth: 0 }}>
                  <EditorBpmnFluxo
                    key={chaveEditor}
                    ref={editorRef}
                    xmlInicial={edicao.xml}
                    onSelecionar={elemento => setSelecionado(elemento)}
                    onAlterado={() => {
                      setAlterado(true);

                      // Atualiza o nome exibido no painel após renomear no desenho.
                      setSelecionado(
                        atual =>
                          atual && editorRef.current
                            ? editorRef.current.elemento(atual.id)
                            : atual
                      );
                    }}
                  />
                </div>

                <div style={{ flex: '1 1 340px', maxWidth: '420px', border: `1px solid ${COR_BORDA}`, borderRadius: '8px', overflowY: 'auto', maxHeight: '612px' }}>
                  <div style={{ ...estiloBarraSecao, padding: '8px 16px', fontSize: '12px' }}>Propriedades</div>
                  <PainelPropriedadesFluxo
                    key={selecionado ? selecionado.id : 'nenhum'}
                    selecionado={selecionado}
                    tipo={tipoSelecionado}
                    editavel={editavel}
                    configElemento={
                      selecionado && tipoSelecionado
                        ? edicao.configsElementos[selecionado.id] || configPadraoElemento(tipoSelecionado)
                        : undefined
                    }
                    onAlterarElemento={config => {
                      if (!selecionado) {
                        return;
                      }
                      setEdicao({
                        ...edicao,
                        configsElementos: { ...edicao.configsElementos, [selecionado.id]: config }
                      });
                      setAlterado(true);
                    }}
                    configTransicao={
                      selecionado && selecionado.conexao
                        ? edicao.configsTransicoes[selecionado.id] || configPadraoTransicao()
                        : undefined
                    }
                    onAlterarTransicao={config => {
                      if (!selecionado) {
                        return;
                      }
                      setEdicao({
                        ...edicao,
                        configsTransicoes: { ...edicao.configsTransicoes, [selecionado.id]: config }
                      });
                      setAlterado(true);
                    }}
                    tipoOrigem={tipoOrigem}
                    resultadosDisponiveis={resultadosDisponiveis}
                    metadados={edicao.metadados}
                    onRenomear={nome => {
                      if (selecionado && editorRef.current) {
                        editorRef.current.renomear(selecionado.id, nome);
                      }
                    }}
                  />
                </div>
              </div>
            )
            : (
              <div style={{ padding: '8px 0' }}>
                <FluxoDiagrama definicao={definicaoSelecionada} />
                {
                  podeEditar && (
                    <div style={{ padding: '8px 20px', fontSize: '13px' }}>
                      {
                        temRascunho
                          ? 'Esta versão não pode ser alterada. Selecione o rascunho para editar.'
                          : 'Versões publicadas não são alteradas. Clique em “Criar nova versão” para editar o desenho.'
                      }
                    </div>
                  )
                }
              </div>
            )
        }
      </section>

      {/* METADADOS */}
      <section style={estiloCartao}>
        <div style={estiloBarraSecao}>Metadados do processo</div>
        <div style={{ padding: '14px 20px' }}>
          <PainelMetadados
            metadados={edicao ? edicao.metadados : metadadosDaDefinicao(definicaoSelecionada)}
            editavel={editavel && !!edicao}
            usoPorChave={usoPorChave}
            onAlterar={metadados => {
              if (!edicao) {
                return;
              }

              const chaves =
                metadados.map(item => item.chave);

              // Retira das etapas os campos cujo metadado foi excluído.
              const configsElementos: Record<string, IConfigElemento> = {};

              Object.keys(edicao.configsElementos).forEach(
                id => {
                  const config = edicao.configsElementos[id];
                  configsElementos[id] = {
                    ...config,
                    campos: config.campos.filter(campo => chaves.indexOf(campo.chave) >= 0)
                  };
                }
              );

              setEdicao({ ...edicao, metadados, configsElementos });
              setAlterado(true);
            }}
          />
        </div>
      </section>

      {/* MENSAGENS */}
      {
        mensagens && (
          <div
            role="alert"
            style={{
              border: `2px solid ${mensagens.tipo === 'ok' ? COR_CIANO : COR_INDIGO}`,
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13.5px',
              background: '#FFFFFF'
            }}
          >
            <strong>{mensagens.titulo}</strong>
            {
              mensagens.textos.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                  {mensagens.textos.map(item => <li key={item}>{item}</li>)}
                </ul>
              )
            }
          </div>
        )
      }

      {/* AÇÕES */}
      {
        podeEditar && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {
              editavel && edicao && (
                <>
                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => { salvar(false).catch((error: unknown) => console.error(error)); }}
                    style={estiloBotao(false, processando)}
                  >
                    Salvar rascunho
                  </button>

                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => { verificar().catch((error: unknown) => console.error(error)); }}
                    style={estiloBotao(false, processando)}
                  >
                    Verificar fluxo
                  </button>

                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => { salvar(true).catch((error: unknown) => console.error(error)); }}
                    style={estiloBotao(true, processando)}
                  >
                    Publicar versão {definicaoSelecionada.versao}
                  </button>

                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => arquivoRef.current && arquivoRef.current.click()}
                    style={estiloBotao(false, processando)}
                  >
                    Importar .bpmn
                  </button>

                  <input
                    ref={arquivoRef}
                    type="file"
                    accept=".bpmn,.xml"
                    aria-label="Importar arquivo BPMN"
                    style={{ display: 'none' }}
                    onChange={evento => {
                      const arquivo = evento.target.files && evento.target.files[0];
                      if (arquivo) {
                        importarArquivo(arquivo);
                      }
                      evento.target.value = '';
                    }}
                  />

                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => {
                      if (!window.confirm('Descartar o rascunho? Todas as alterações desta versão serão perdidas.')) {
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

            <button
              type="button"
              disabled={processando}
              onClick={() => {
                const exportar = async (): Promise<void> => {
                  const xml =
                    editavel && editorRef.current
                      ? await editorRef.current.exportarXml()
                      : definicaoSelecionada.bpmnXml || definicaoParaBpmnXml(definicaoSelecionada);

                  baixarArquivo(
                    `${(processo.codigo || 'fluxo').replace(/[^A-Za-z0-9_-]+/g, '_')}_v${definicaoSelecionada.versao}.bpmn`,
                    xml
                  );
                };

                exportar().catch((error: unknown) => console.error(error));
              }}
              style={estiloBotao(false, processando)}
            >
              Exportar .bpmn
            </button>

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
