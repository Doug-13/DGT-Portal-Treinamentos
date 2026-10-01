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
  IFluxoCatalogo,
  IResultadoCatalogo
} from '../../services/fluxo/FluxoCatalogoLocal';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

import {
  validarDefinicao
} from '../../services/fluxo/FluxoValidacao';

import {
  contarUsoMetadados
} from '../../services/processos/MetadadosProcessoService';

import {
  configDaTransicao,
  configDoElemento,
  configPadraoElemento,
  configPadraoTransicao,
  definicaoParaBpmnXml,
  IConfigElemento,
  IConfigTransicao,
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
  IResultadoDisponivel,
  ISaidaElemento,
  SecaoPainelFluxo
} from './PainelPropriedadesFluxo';

import ModalConfiguracaoFluxo, {
  IAbaModalFluxo
} from './ModalConfiguracaoFluxo';

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

  // Metadados do PROCESSO (não da versão), na ordem das telas.
  metadados: IFluxoMetadado[];
  onAlterarMetadados: (metadados: IFluxoMetadado[]) => void;

  // Onde as versões do fluxo são gravadas (Dataverse ou navegador).
  catalogo: IFluxoCatalogo;

  // Para escolher responsáveis do tipo Área e Usuário.
  areas: IAreaAdmin[];
  usuarios: Array<{ id: string; nome: string; email: string }>;

  gravandoMetadados?: boolean;
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
  onAlterado,
  metadados: metadadosProcesso,
  onAlterarMetadados,
  catalogo,
  areas,
  usuarios,
  gravandoMetadados
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

  // Modal aberto: configuração do elemento ou metadados do processo.
  const [modal, setModal] =
    React.useState<{ tipo: 'elemento' | 'metadados' } | undefined>(undefined);

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
      setModal(undefined);
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
      metadados: metadadosProcesso,
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
          const salvo = await catalogo.salvarRascunho(definicao);
          return publicar && salvo.ok
            ? catalogo.publicarRascunho(processo.id)
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
                        () => catalogo.criarAPartirDoModelo(processo, modeloId),
                        'Rascunho da versão 1 criado. Desenhe e configure o fluxo, depois publique.',
                        () => {
                          setVersaoSelecionada(1);

                          // Os campos usados pelo modelo passam a ser
                          // metadados do processo (sem duplicar os que já existem).
                          const modelo =
                            FLUXO_MODELOS.find(item => item.id === modeloId);

                          const doModelo =
                            (modelo && modelo.definicao.metadados) || [];

                          const faltantes =
                            doModelo.filter(
                              item => !metadadosProcesso.some(atual => atual.chave === item.chave)
                            );

                          if (faltantes.length > 0) {
                            onAlterarMetadados(
                              metadadosProcesso.concat(JSON.parse(JSON.stringify(faltantes)) as IFluxoMetadado[])
                            );
                          }
                        }
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

  // Etapas com botões que chegam a um elemento, atravessando decisões
  // encadeadas (decisão → decisão).
  const resultadosQueChegam = (
    destinoId: string,
    visitados: string[]
  ): IResultadoDisponivel[] => {

    if (!snapshotAtual || visitados.indexOf(destinoId) >= 0) {
      return [];
    }

    let lista: IResultadoDisponivel[] = [];

    snapshotAtual.conexoes
      .filter(conexao => conexao.destinoId === destinoId)
      .forEach(
        conexao => {
          const tipo =
            tipoDe(conexao.origemId);

          if (tipo === 'tarefaHumana') {
            lista = lista.concat(acoesDe(conexao.origemId));
          } else if (tipo === 'gateway') {
            lista = lista.concat(resultadosQueChegam(conexao.origemId, visitados.concat(destinoId)));
          }
        }
      );

    return lista;
  };

  // Elemento cujos caminhos de saída estão sendo configurados:
  // a origem da ligação selecionada, ou o próprio elemento.
  const idOrigem: string | undefined =
    selecionado
      ? (selecionado.conexao ? selecionado.origemId : selecionado.id)
      : undefined;

  const tipoOrigem: TipoElementoFluxo | undefined =
    idOrigem ? tipoDe(idOrigem) : undefined;

  let resultadosDisponiveis: IResultadoDisponivel[] = [];

  if (idOrigem && snapshotAtual) {

    if (tipoOrigem === 'tarefaHumana') {
      resultadosDisponiveis = acoesDe(idOrigem);
    } else if (tipoOrigem === 'gateway') {

      resultadosDisponiveis = resultadosQueChegam(idOrigem, []);

      if (resultadosDisponiveis.length === 0) {
        snapshotAtual.formas.forEach(
          forma => { resultadosDisponiveis = resultadosDisponiveis.concat(acoesDe(forma.id)); }
        );
      }
    }
  }

  // Caminhos que saem do elemento selecionado (decisão ou etapa).
  const saidas: ISaidaElemento[] =
    selecionado && !selecionado.conexao && snapshotAtual && edicao
      ? snapshotAtual.conexoes
        .filter(
          conexao =>
            conexao.origemId === selecionado.id &&
            conexao.tipo === 'bpmn:SequenceFlow'
        )
        .map(
          conexao => ({
            id: conexao.id,
            nome: conexao.nome,
            destinoNome: nomeDe(conexao.destinoId),
            destinoTipo: tipoDe(conexao.destinoId),
            config: edicao.configsTransicoes[conexao.id] || configPadraoTransicao()
          })
        )
      : [];

  const alterarConfigTransicao = (
    id: string,
    config: IConfigTransicao
  ): void => {

    if (!edicao) {
      return;
    }

    setEdicao({
      ...edicao,
      configsTransicoes: { ...edicao.configsTransicoes, [id]: config }
    });

    setAlterado(true);
  };

  // Só um caminho padrão por elemento.
  const definirPadraoSaida = (
    id: string | undefined
  ): void => {

    if (!edicao) {
      return;
    }

    const configsTransicoes = { ...edicao.configsTransicoes };

    saidas.forEach(
      saida => {
        configsTransicoes[saida.id] = { ...saida.config, padrao: saida.id === id };
      }
    );

    setEdicao({ ...edicao, configsTransicoes });
    setAlterado(true);
  };

  const usoPorChave: Record<string, number> =
    contarUsoMetadados(
      versoes,
      edicao
        ? Object.keys(edicao.configsElementos).map(id => edicao.configsElementos[id])
        : undefined
    );

  // ----------------------------------------------------------
  // Metadados e modal
  // ----------------------------------------------------------

  const metadadosAtuais: IFluxoMetadado[] =
    metadadosProcesso;

  // Metadados são do processo: gravam na hora (não dependem do
  // rascunho). No rascunho em edição, campos excluídos saem das etapas.
  const alterarMetadados = (
    metadados: IFluxoMetadado[]
  ): void => {

    onAlterarMetadados(metadados);

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

    setEdicao({ ...edicao, configsElementos });
  };

  const editorMetadados = (
    <PainelMetadados
      metadados={metadadosAtuais}
      editavel={podeEditar}
      usoPorChave={usoPorChave}
      onAlterar={alterarMetadados}
    />
  );

  const configSelecionado: IConfigElemento | undefined =
    edicao && selecionado && tipoSelecionado
      ? edicao.configsElementos[selecionado.id] || configPadraoElemento(tipoSelecionado)
      : undefined;

  const painel = (
    secao: SecaoPainelFluxo,
    extraCampos?: React.ReactNode
  ): React.ReactNode =>
    edicao && (
      <PainelPropriedadesFluxo
        key={`${selecionado ? selecionado.id : 'nenhum'}-${secao}`}
        secao={secao}
        extraCampos={extraCampos}
        areas={areas}
        usuarios={usuarios}
        selecionado={selecionado}
        tipo={tipoSelecionado}
        editavel={editavel}
        configElemento={configSelecionado}
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
          if (selecionado) {
            alterarConfigTransicao(selecionado.id, config);
          }
        }}
        saidas={saidas}
        onAlterarSaida={alterarConfigTransicao}
        onDefinirPadraoSaida={definirPadraoSaida}
        onRenomearSaida={(id, nome) => {
          if (editorRef.current) {
            editorRef.current.renomear(id, nome);
          }
        }}
        onSelecionarSaida={id => {
          // Abre a ligação no próprio modal.
          if (editorRef.current) {
            editorRef.current.selecionar(id);
            const ligacao = editorRef.current.elemento(id);
            if (ligacao) {
              setSelecionado(ligacao);
            }
          }
        }}
        tipoOrigem={tipoOrigem}
        resultadosDisponiveis={resultadosDisponiveis}
        metadados={metadadosAtuais}
        onRenomear={nome => {
          if (selecionado && editorRef.current) {
            editorRef.current.renomear(selecionado.id, nome);
          }
        }}
      />
    );

  const nomeTipoSelecionado =
    !selecionado
      ? ''
      : selecionado.conexao
        ? 'Ligação'
        : tipoSelecionado === 'tarefaHumana'
          ? 'Etapa com responsável'
          : tipoSelecionado === 'tarefaSistema'
            ? 'Tarefa de sistema'
            : tipoSelecionado === 'gateway'
              ? 'Decisão'
              : tipoSelecionado === 'inicio'
                ? 'Início'
                : tipoSelecionado === 'fim'
                  ? 'Fim'
                  : 'Elemento não suportado';

  const abasDoModal: IAbaModalFluxo[] =
    tipoSelecionado === 'tarefaHumana' && configSelecionado
      ? [
        { id: 'geral', rotulo: 'Geral e prazo', conteudo: painel('geral') },
        {
          id: 'responsaveis',
          rotulo: 'Responsáveis',
          indicador: String(configSelecionado.responsaveis.length),
          conteudo: painel('responsaveis')
        },
        {
          id: 'acoes',
          rotulo: 'Ações (botões)',
          indicador: String(configSelecionado.acoes.length),
          conteudo: painel('acoes')
        },
        {
          id: 'campos',
          rotulo: 'Metadados',
          indicador: String(configSelecionado.campos.length),
          conteudo: painel(
            'campos',
            <fieldset style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '10px 12px', margin: 0 }}>
              <legend style={{ ...estiloRotulo, padding: '0 6px', marginBottom: 0 }}>Metadados do processo</legend>
              {editorMetadados}
            </fieldset>
          )
        },
        {
          id: 'caminhos',
          rotulo: 'Caminhos',
          indicador: String(saidas.length),
          conteudo: painel('caminhos')
        }
      ]
      : tipoSelecionado === 'gateway' && selecionado && !selecionado.conexao
        ? [
          { id: 'geral', rotulo: 'Geral', conteudo: painel('geral') },
          {
            id: 'caminhos',
            rotulo: 'Caminhos',
            indicador: String(saidas.length),
            conteudo: painel('caminhos')
          }
        ]
        : [
          { id: 'tudo', rotulo: 'Configuração', conteudo: painel('tudo') }
        ];

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

        {/* BARRA: metadados do processo */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '10px 12px 0'
          }}
        >
          <button
            type="button"
            onClick={() => setModal({ tipo: 'metadados' })}
            style={{ ...estiloBotao(false, false), minHeight: '36px' }}
          >
            Metadados do processo ({metadadosAtuais.length})
          </button>
          <span style={{ fontSize: '12.5px' }}>
            {
              editavel
                ? 'Dê duplo clique em uma etapa, decisão ou ligação (ou use ⚙ no menu do elemento) para configurar responsáveis, botões, prazo, metadados e caminhos.'
                : 'Versão somente leitura.'
            }
          </span>
        </div>

        {
          editavel && edicao
            ? (
              <div style={{ padding: '10px 12px 12px' }}>
                <EditorBpmnFluxo
                  key={chaveEditor}
                  ref={editorRef}
                  xmlInicial={edicao.xml}
                  onSelecionar={() => undefined}
                  onConfigurar={elemento => {
                    setSelecionado(elemento);
                    setModal({ tipo: 'elemento' });
                  }}
                  onAlterado={() => {
                    setAlterado(true);

                    // Atualiza o nome exibido no modal após renomear.
                    setSelecionado(
                      atual =>
                        atual && editorRef.current
                          ? editorRef.current.elemento(atual.id)
                          : atual
                    );
                  }}
                />
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

      {/* MODAL: configuração do elemento */}
      {
        modal &&
        modal.tipo === 'elemento' &&
        selecionado &&
        edicao && (
          <ModalConfiguracaoFluxo
            key={`modal-${selecionado.id}`}
            titulo={selecionado.nome || '(sem nome)'}
            subtitulo={nomeTipoSelecionado}
            abas={abasDoModal}
            onFechar={() => setModal(undefined)}
          />
        )
      }

      {/* MODAL: metadados do processo */}
      {
        modal &&
        modal.tipo === 'metadados' && (
          <ModalConfiguracaoFluxo
            titulo="Metadados do processo"
            subtitulo={`${processo.codigo ? `${processo.codigo} — ` : ''}${processo.nome}`}
            abas={[
              {
                id: 'metadados',
                rotulo: 'Metadados',
                conteudo: <div style={{ padding: '16px 20px' }}>{editorMetadados}</div>
              }
            ]}
            onFechar={() => setModal(undefined)}
            rodape={
              podeEditar
                ? 'Os metadados são do processo e ficam salvos na hora, para todas as versões do fluxo.'
                : 'Somente leitura.'
            }
          />
        )
      }

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
                        () => catalogo.descartarRascunho(processo.id),
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
                      () => catalogo.criarNovaVersao(processo.id),
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
