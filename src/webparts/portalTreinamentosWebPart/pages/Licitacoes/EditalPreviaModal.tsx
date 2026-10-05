import * as React from 'react';
import * as ReactDOM from 'react-dom';

import logoDgt from '../../assets/logo-dgt.png';

import {
  ICargaEdital,
  IDadosEdital,
  IDocumentoEdital,
  IItemEdital,
  ILicitacaoResultado
} from '../../models/Licitacao';

import {
  IArquivoEdital,
  baixarArquivoEdital,
  carregarDetalheEdital,
  carregarDocumentosEdital,
  carregarItensEdital
} from '../../services/PncpEditalService';

import {
  converterDataPncp,
  formatarDataHoraPncp,
  formatarDataPncp,
  formatarMoeda
} from '../../utils/licitacoesFiltro';

import {
  IConteudoFicha,
  abrirFichaImpressao,
  linhasFichaTecnica,
  montarResumoTexto
} from '../../utils/relatorioLicitacoes';

import {
  COR,
  FONTE,
  campo,
  etiqueta
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — PRÉ-VISUALIZAÇÃO DO EDITAL
//
// Painel lateral com tudo o que é preciso para decidir se vale
// participar, sem sair do portal:
//
//   Resumo      objeto, prazo, ficha técnica, aderência, itens
//               resumidos (valores, ME/EPP, critério de julgamento)
//   Itens       tabela completa dos itens da contratação
//   Documentos  edital, termo de referência, anexos, avisos
//   Edital      o PDF aberto dentro do portal
//
// Os dados básicos já vêm da busca (abre instantâneo). Itens,
// documentos e o detalhe atualizado são carregados do PNCP em
// paralelo; se uma parte falhar, as outras continuam.
//
// Renderizado com createPortal no <body>: assim o painel fica
// acima do layout do SharePoint e não herda os estilos de
// '.content button' do portal (os botões daqui têm estilo próprio).
// ============================================================

export interface IEditalPreviaModalProps {
  item?: ILicitacaoResultado;
  onFechar: () => void;
}

type Aba = 'resumo' | 'itens' | 'documentos' | 'edital';

interface IEstadoArquivo {
  situacao: 'ocioso' | 'carregando' | 'ok' | 'erro';
  arquivo?: IArquivoEdital;
  erro?: string;
}

// ------------------------------------------------------------
// Estilos locais
// ------------------------------------------------------------

const botaoBase: React.CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONTE,
  whiteSpace: 'nowrap'
};

const botaoPrimario: React.CSSProperties = {
  ...botaoBase,
  background: COR.botao,
  color: '#ffffff'
};

const botaoSecundario: React.CSSProperties = {
  ...botaoBase,
  background: '#ffffff',
  color: COR.azul,
  border: `1px solid ${COR.cinzaClaro}`
};

const linkBotao: React.CSSProperties = {
  ...botaoSecundario,
  display: 'inline-block',
  textDecoration: 'none',
  whiteSpace: 'normal',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  textAlign: 'left',
  boxSizing: 'border-box'
};

const secao: React.CSSProperties = {
  marginBottom: 22,
  minWidth: 0
};

const tituloSecao: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 13,
  fontWeight: 600,
  color: COR.azul
};

const paragrafo: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: COR.azul,
  whiteSpace: 'pre-wrap',
  maxWidth: 860
};

const celulaTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 600,
  color: COR.azul,
  background: COR.azulClaro,
  borderBottom: `1px solid ${COR.cinzaClaro}`,
  whiteSpace: 'nowrap'
};

const celulaTd: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  color: COR.azul,
  borderBottom: `1px solid ${COR.neutro}`,
  verticalAlign: 'top',
  overflowWrap: 'anywhere'
};

// ------------------------------------------------------------
// Prazo das propostas
// ------------------------------------------------------------

interface ISituacaoPrazo {
  rotulo: string;
  detalhe: string;
  aberto: boolean;
  urgente: boolean;
}

const diasEntre = (de: Date, ate: Date): number =>
  Math.ceil((ate.getTime() - de.getTime()) / 86400000);

const calcularPrazo = (
  abertura?: string,
  encerramento?: string
): ISituacaoPrazo => {

  const agora = new Date();
  const inicio = converterDataPncp(abertura);
  const fim = converterDataPncp(encerramento);

  if (!fim) {
    return {
      rotulo: 'Prazo não informado',
      detalhe: 'O PNCP não trouxe a data de encerramento das propostas.',
      aberto: false,
      urgente: false
    };
  }

  if (agora > fim) {
    return {
      rotulo: 'Prazo de propostas encerrado',
      detalhe: `Encerrou em ${formatarDataHoraPncp(encerramento)}.`,
      aberto: false,
      urgente: false
    };
  }

  if (inicio && agora < inicio) {
    const dias = diasEntre(agora, inicio);
    return {
      rotulo: 'Propostas ainda não abertas',
      detalhe:
        `Abre ${dias <= 1 ? 'em menos de 1 dia' : `em ${dias} dias`} ` +
        `(${formatarDataHoraPncp(abertura)}) e encerra em ${formatarDataHoraPncp(encerramento)}.`,
      aberto: false,
      urgente: false
    };
  }

  const dias = diasEntre(agora, fim);
  const mesmoDia = fim.toDateString() === agora.toDateString();

  return {
    rotulo: 'Recebendo propostas',
    detalhe: mesmoDia
      ? `Encerra hoje, ${formatarDataHoraPncp(encerramento).substring(11) || 'no fim do dia'}.`
      : `Encerra em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${formatarDataHoraPncp(encerramento)}).`,
    aberto: true,
    urgente: dias <= 3
  };
};

// ------------------------------------------------------------
// Resumo dos itens (o que mais pesa na decisão de participar)
// ------------------------------------------------------------

interface IResumoItens {
  total: number;
  materiais: number;
  servicos: number;
  sigilosos: number;
  valorSomado: number;
  beneficios: Array<{ nome: string; quantidade: number }>;
  criterios: Array<{ nome: string; quantidade: number }>;
}

const agrupar = (
  valores: Array<string | undefined>
): Array<{ nome: string; quantidade: number }> => {

  const mapa: { [nome: string]: number } = {};

  valores.forEach(valor => {
    if (valor) {
      mapa[valor] = (mapa[valor] || 0) + 1;
    }
  });

  return Object.keys(mapa)
    .map(nome => ({ nome, quantidade: mapa[nome] }))
    .sort((a, b) => b.quantidade - a.quantidade);
};

const resumirItens = (
  itens: IItemEdital[]
): IResumoItens => ({
  total: itens.length,
  materiais: itens.filter(it => /material/i.test(it.tipo)).length,
  servicos: itens.filter(it => /servi/i.test(it.tipo)).length,
  sigilosos: itens.filter(it => it.sigiloso).length,
  valorSomado: itens
    .filter(it => !it.sigiloso && it.valorTotal !== undefined)
    .reduce((soma, it) => soma + (it.valorTotal || 0), 0),
  beneficios: agrupar(itens.map(it => it.beneficio)),
  criterios: agrupar(itens.map(it => it.criterioJulgamento))
});

const formatarBytes = (bytes: number): string =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// ------------------------------------------------------------
// Pequenos componentes
// ------------------------------------------------------------

const Indicador: React.FC<{
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: string;
}> = ({ titulo, valor, detalhe, destaque }) => (
  <div
    style={{
      padding: '12px 14px',
      borderRadius: 10,
      background: '#ffffff',
      border: `1px solid ${COR.cinzaClaro}`,
      borderTop: `3px solid ${destaque || COR.cinzaClaro}`,
      minWidth: 0
    }}
  >
    <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario }}>
      {titulo}
    </span>
    <strong style={{ display: 'block', fontSize: 17, color: COR.azul, fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>
      {valor}
    </strong>
    {detalhe && (
      <span
        title={detalhe}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          fontSize: 11,
          color: COR.textoSecundario,
          marginTop: 2,
          overflowWrap: 'anywhere'
        }}
      >
        {detalhe}
      </span>
    )}
  </div>
);

const AvisoCarga: React.FC<{
  carga: ICargaEdital<unknown[]>;
  rotuloVazio: string;
  onTentarNovamente: () => void;
}> = ({ carga, rotuloVazio, onTentarNovamente }) => {

  if (carga.situacao === 'carregando') {
    return <p style={{ ...paragrafo, color: COR.textoSecundario }}>Carregando do PNCP…</p>;
  }

  if (carga.situacao === 'vazio') {
    return <p style={{ ...paragrafo, color: COR.textoSecundario }}>{rotuloVazio}</p>;
  }

  if (carga.situacao === 'erro') {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: COR.indigoClaro,
          border: `1px solid ${COR.indigo}`,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ fontSize: 12, color: COR.azul, flex: 1 }}>
          ! Não foi possível carregar: {carga.erro || 'erro desconhecido'}
        </span>
        <button type="button" style={botaoSecundario} onClick={onTentarNovamente}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return null;
};

// ------------------------------------------------------------
// Modal
// ------------------------------------------------------------

const CARGA_INICIAL_ITENS: ICargaEdital<IItemEdital[]> = { situacao: 'carregando', dados: [] };
const CARGA_INICIAL_DOCS: ICargaEdital<IDocumentoEdital[]> = { situacao: 'carregando', dados: [] };

const EditalPreviaModal: React.FC<IEditalPreviaModalProps> = ({
  item,
  onFechar
}) => {

  const [aba, setAba] = React.useState<Aba>('resumo');
  const [dados, setDados] = React.useState<IDadosEdital | undefined>(item ? item.dados : undefined);
  const [itens, setItens] = React.useState<ICargaEdital<IItemEdital[]>>(CARGA_INICIAL_ITENS);
  const [documentos, setDocumentos] = React.useState<ICargaEdital<IDocumentoEdital[]>>(CARGA_INICIAL_DOCS);
  const [docSelecionado, setDocSelecionado] = React.useState<IDocumentoEdital | undefined>(undefined);
  const [arquivo, setArquivo] = React.useState<IEstadoArquivo>({ situacao: 'ocioso' });
  const [filtroItens, setFiltroItens] = React.useState<string>('');
  const [mensagem, setMensagem] = React.useState<string>('');
  const [tentativa, setTentativa] = React.useState<number>(0);

  const urlObjetoRef = React.useRef<string | undefined>(undefined);

  const liberarArquivo = (): void => {
    if (urlObjetoRef.current) {
      URL.revokeObjectURL(urlObjetoRef.current);
      urlObjetoRef.current = undefined;
    }
  };

  // Abre/troca de edital: reinicia o estado e carrega tudo.
  React.useEffect(() => {

    liberarArquivo();
    setAba('resumo');
    setFiltroItens('');
    setMensagem('');
    setDocSelecionado(undefined);
    setArquivo({ situacao: 'ocioso' });

    if (!item) {
      return undefined;
    }

    setDados(item.dados);

    if (!item.idPncp) {
      setItens({ situacao: 'erro', dados: [], erro: 'Edital sem identificador PNCP.' });
      setDocumentos({ situacao: 'erro', dados: [], erro: 'Edital sem identificador PNCP.' });
      return undefined;
    }

    const id = item.idPncp;
    const controle = new AbortController();

    setItens(CARGA_INICIAL_ITENS);
    setDocumentos(CARGA_INICIAL_DOCS);

    carregarDetalheEdital(id, controle.signal)
      .then(atualizado => {
        if (atualizado && !controle.signal.aborted) {
          setDados(atualizado);
        }
      })
      .catch(() => undefined); // mantém os dados da busca

    carregarItensEdital(id, controle.signal)
      .then(resultado => {
        if (!controle.signal.aborted) {
          setItens({
            situacao: resultado.itens.length > 0 ? 'ok' : 'vazio',
            dados: resultado.itens,
            truncado: resultado.truncado
          });
        }
      })
      .catch(erro => {
        if (!controle.signal.aborted) {
          setItens({ situacao: 'erro', dados: [], erro: (erro as Error).message });
        }
      });

    carregarDocumentosEdital(id, controle.signal)
      .then(lista => {
        if (!controle.signal.aborted) {
          setDocumentos({ situacao: lista.length > 0 ? 'ok' : 'vazio', dados: lista });
          if (lista.length > 0) {
            setDocSelecionado(lista[0]);
          }
        }
      })
      .catch(erro => {
        if (!controle.signal.aborted) {
          setDocumentos({ situacao: 'erro', dados: [], erro: (erro as Error).message });
        }
      });

    return () => controle.abort();

  }, [item, tentativa]);

  // Baixa o arquivo quando a aba Edital é aberta.
  React.useEffect(() => {

    if (aba !== 'edital' || !docSelecionado) {
      return undefined;
    }

    const controle = new AbortController();

    liberarArquivo();
    setArquivo({ situacao: 'carregando' });

    baixarArquivoEdital(docSelecionado.url, controle.signal)
      .then(resultado => {
        if (controle.signal.aborted) {
          URL.revokeObjectURL(resultado.urlObjeto);
          return;
        }
        urlObjetoRef.current = resultado.urlObjeto;
        setArquivo({ situacao: 'ok', arquivo: resultado });
      })
      .catch(erro => {
        if (!controle.signal.aborted) {
          setArquivo({ situacao: 'erro', erro: (erro as Error).message });
        }
      });

    return () => controle.abort();

  }, [aba, docSelecionado]);

  // Esc fecha; trava a rolagem da página por trás.
  React.useEffect(() => {

    if (!item) {
      return undefined;
    }

    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        onFechar();
      }
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [item, onFechar]);

  // Libera o arquivo ao desmontar.
  React.useEffect(() => () => liberarArquivo(), []);

  const itensFiltrados = React.useMemo(() => {
    const termo = filtroItens.trim().toLowerCase();
    if (!termo) {
      return itens.dados;
    }
    return itens.dados.filter(it =>
      `${it.numeroItem} ${it.descricao} ${it.categoria || ''}`.toLowerCase().indexOf(termo) >= 0
    );
  }, [itens.dados, filtroItens]);

  if (!item || !dados) {
    return null;
  }

  const prazo = calcularPrazo(item.abertura, item.encerramento);
  const resumoItens = resumirItens(itens.dados);

  const conteudoFicha: IConteudoFicha = {
    item,
    dados,
    situacaoPrazo: `${prazo.rotulo} — ${prazo.detalhe}`,
    itens: itens.dados,
    documentos: documentos.dados
  };

  const copiarResumo = (): void => {
    const texto = montarResumoTexto(conteudoFicha);
    const concluir = (): void => {
      setMensagem('Resumo copiado. Cole no Teams ou no e-mail.');
      window.setTimeout(() => setMensagem(''), 4000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(concluir).catch(() => window.prompt('Copie o resumo:', texto));
    } else {
      window.prompt('Copie o resumo:', texto);
    }
  };

  const imprimirFicha = (): void => {
    let urlLogo = logoDgt;
    try {
      urlLogo = new URL(logoDgt, window.location.href).href;
    } catch {
      // mantém o caminho original
    }
    if (!abrirFichaImpressao(conteudoFicha, urlLogo)) {
      setMensagem('O navegador bloqueou a janela. Permita pop-ups para este site.');
    }
  };

  const abrirDocumentoNoPortal = (doc: IDocumentoEdital): void => {
    setDocSelecionado(doc);
    setAba('edital');
  };

  const contagem = (carga: ICargaEdital<unknown[]>): string =>
    carga.situacao === 'carregando' ? '…' : String(carga.dados.length);

  const ABAS: Array<{ id: Aba; rotulo: string }> = [
    { id: 'resumo', rotulo: 'Resumo' },
    { id: 'itens', rotulo: `Itens (${contagem(itens)})` },
    { id: 'documentos', rotulo: `Documentos (${contagem(documentos)})` },
    { id: 'edital', rotulo: 'Edital' }
  ];

  // ==========================================================
  // ABA RESUMO
  // ==========================================================
  const renderResumo = (): React.ReactNode => (
    <>
      <div style={secao}>
        <h3 style={tituloSecao}>Objeto</h3>
        <p style={paragrafo}>{item.objeto}</p>
      </div>

      {dados.informacaoComplementar && (
        <div style={secao}>
          <h3 style={tituloSecao}>Informação complementar</h3>
          <p style={{ ...paragrafo, fontSize: 12 }}>{dados.informacaoComplementar}</p>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 22,
          alignItems: 'start'
        }}
      >
        {/* Ficha técnica */}
        <div style={secao}>
          <h3 style={tituloSecao}>Ficha técnica</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {linhasFichaTecnica(conteudoFicha).map(([chave, valor]) => (
                <tr key={chave}>
                  <th style={{ ...celulaTh, width: '42%', whiteSpace: 'normal', background: 'transparent', fontWeight: 400, color: COR.textoSecundario, borderBottom: `1px solid ${COR.neutro}` }}>
                    {chave}
                  </th>
                  <td style={{ ...celulaTd, fontWeight: 600 }}>{valor}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {dados.amparoLegalDescricao && (
            <p style={{ fontSize: 11, color: COR.textoSecundario, margin: '8px 0 0', lineHeight: 1.5 }}>
              {dados.amparoLegalDescricao}
            </p>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          {/* Aderência */}
          <div style={secao}>
            <h3 style={tituloSecao}>Aderência à busca — {item.score}%</h3>
            <div style={{ height: 6, borderRadius: 3, background: COR.neutro, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${item.score}%`, height: '100%', background: item.score >= 50 ? COR.ciano : COR.indigo }} />
            </div>
            {item.motivos.map(motivo => (
              <span key={motivo} style={etiqueta}>{motivo}</span>
            ))}
          </div>

          {/* Itens resumidos */}
          <div style={secao}>
            <h3 style={tituloSecao}>Itens da contratação</h3>

            {itens.situacao !== 'ok'
              ? (
                <AvisoCarga
                  carga={itens}
                  rotuloVazio="O órgão não publicou itens no PNCP."
                  onTentarNovamente={() => setTentativa(tentativa + 1)}
                />
              )
              : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
                    <Indicador titulo="Itens" valor={resumoItens.total.toLocaleString('pt-BR')} />
                    <Indicador
                      titulo="Material / Serviço"
                      valor={`${resumoItens.materiais} / ${resumoItens.servicos}`}
                    />
                    <Indicador
                      titulo="Soma dos itens"
                      valor={formatarMoeda(resumoItens.valorSomado)}
                      detalhe={resumoItens.sigilosos > 0 ? `${resumoItens.sigilosos} com orçamento sigiloso` : undefined}
                    />
                  </div>

                  {resumoItens.beneficios.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario, marginBottom: 4 }}>
                        Benefício ME/EPP
                      </span>
                      {resumoItens.beneficios.map(b => (
                        <span key={b.nome} style={etiqueta}>{b.nome}: {b.quantidade}</span>
                      ))}
                    </div>
                  )}

                  {resumoItens.criterios.length > 0 && (
                    <div>
                      <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario, marginBottom: 4 }}>
                        Critério de julgamento
                      </span>
                      {resumoItens.criterios.map(c => (
                        <span key={c.nome} style={etiqueta}>{c.nome}: {c.quantidade}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
          </div>

          {/* Links */}
          <div style={secao}>
            <h3 style={tituloSecao}>Onde participar</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={linkBotao}>
                Edital no PNCP ↗
              </a>
              {dados.linkSistemaOrigem && (
                <a href={dados.linkSistemaOrigem} target="_blank" rel="noopener noreferrer" style={linkBotao} title={dados.sistemaOrigem || 'Sistema de origem'}>
                  Plataforma de origem ↗
                </a>
              )}
              {dados.linkProcessoEletronico && (
                <a href={dados.linkProcessoEletronico} target="_blank" rel="noopener noreferrer" style={linkBotao}>
                  Processo eletrônico ↗
                </a>
              )}
            </div>
            {dados.sistemaOrigem && (
              <p style={{ fontSize: 11, color: COR.textoSecundario, margin: '8px 0 0' }}>
                A disputa acontece na plataforma de origem ({dados.sistemaOrigem}). Verifique o cadastro da DGT nela antes do prazo.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ==========================================================
  // ABA ITENS
  // ==========================================================
  const renderItens = (): React.ReactNode => {

    if (itens.situacao !== 'ok') {
      return (
        <AvisoCarga
          carga={itens}
          rotuloVazio="O órgão não publicou itens no PNCP."
          onTentarNovamente={() => setTentativa(tentativa + 1)}
        />
      );
    }

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: COR.textoSecundario, alignSelf: 'center' }}>
            {itensFiltrados.length} de {itens.dados.length} itens
            {itens.truncado ? ' (exibindo os primeiros 1.000)' : ''}
          </span>
          <input
            aria-label="Filtrar itens"
            style={{ ...campo, width: 280 }}
            value={filtroItens}
            onChange={evento => setFiltroItens(evento.target.value)}
            placeholder="Filtrar itens pela descrição…"
          />
        </div>

        <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={celulaTh}>Item</th>
                <th style={celulaTh}>Descrição</th>
                <th style={celulaTh}>Tipo</th>
                <th style={{ ...celulaTh, textAlign: 'right' }}>Qtd.</th>
                <th style={celulaTh}>Unid.</th>
                <th style={{ ...celulaTh, textAlign: 'right' }}>Valor unit.</th>
                <th style={{ ...celulaTh, textAlign: 'right' }}>Valor total</th>
                <th style={celulaTh}>Critério</th>
                <th style={celulaTh}>Benefício</th>
                <th style={celulaTh}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map(it => (
                <tr key={it.numeroItem}>
                  <td style={celulaTd}>{it.numeroItem}</td>
                  <td style={{ ...celulaTd, minWidth: 280 }}>{it.descricao}</td>
                  <td style={celulaTd}>{it.tipo}</td>
                  <td style={{ ...celulaTd, textAlign: 'right' }}>
                    {it.quantidade !== undefined ? it.quantidade.toLocaleString('pt-BR') : '-'}
                  </td>
                  <td style={celulaTd}>{it.unidade || '-'}</td>
                  <td style={{ ...celulaTd, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {it.sigiloso ? 'Sigiloso' : formatarMoeda(it.valorUnitario)}
                  </td>
                  <td style={{ ...celulaTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {it.sigiloso ? 'Sigiloso' : formatarMoeda(it.valorTotal)}
                  </td>
                  <td style={celulaTd}>{it.criterioJulgamento || '-'}</td>
                  <td style={celulaTd}>{it.beneficio || '-'}</td>
                  <td style={celulaTd}>{it.situacao || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // ==========================================================
  // ABA DOCUMENTOS
  // ==========================================================
  const renderDocumentos = (): React.ReactNode => {

    if (documentos.situacao !== 'ok') {
      return (
        <AvisoCarga
          carga={documentos}
          rotuloVazio="Nenhum documento publicado no PNCP para esta contratação."
          onTentarNovamente={() => setTentativa(tentativa + 1)}
        />
      );
    }

    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {documentos.dados.map(doc => (
          <li
            key={doc.sequencial}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 14px',
              border: `1px solid ${COR.cinzaClaro}`,
              borderLeft: `4px solid ${/edital/i.test(doc.tipo) ? COR.ciano : COR.cinzaClaro}`,
              borderRadius: 8,
              marginBottom: 8,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario }}>
                {doc.tipo}{doc.publicacao ? ` · publicado em ${formatarDataPncp(doc.publicacao)}` : ''}
              </span>
              <strong style={{ display: 'block', fontSize: 13, color: COR.azul, fontWeight: 600, wordBreak: 'break-word' }}>
                {doc.titulo}
              </strong>
            </div>

            <button type="button" style={botaoPrimario} onClick={() => abrirDocumentoNoPortal(doc)}>
              Visualizar
            </button>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={linkBotao}>
              Baixar ↓
            </a>
          </li>
        ))}
      </ul>
    );
  };

  // ==========================================================
  // ABA EDITAL (arquivo dentro do portal)
  // ==========================================================
  const renderEdital = (): React.ReactNode => {

    if (documentos.situacao !== 'ok' || !docSelecionado) {
      return (
        <AvisoCarga
          carga={documentos}
          rotuloVazio="Nenhum documento publicado no PNCP para esta contratação."
          onTentarNovamente={() => setTentativa(tentativa + 1)}
        />
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <select
            aria-label="Documento"
            style={{ ...campo, width: 'auto', maxWidth: '100%', flex: '1 1 320px' }}
            value={docSelecionado.sequencial}
            onChange={evento => {
              const doc = documentos.dados.find(d => d.sequencial === Number(evento.target.value));
              if (doc) {
                setDocSelecionado(doc);
              }
            }}
          >
            {documentos.dados.map(doc => (
              <option key={doc.sequencial} value={doc.sequencial}>
                {doc.tipo} — {doc.titulo}
              </option>
            ))}
          </select>

          {arquivo.situacao === 'ok' && arquivo.arquivo && (
            <span style={{ fontSize: 11, color: COR.textoSecundario }}>
              {formatarBytes(arquivo.arquivo.tamanhoBytes)}
            </span>
          )}

          {arquivo.situacao === 'ok' && arquivo.arquivo && arquivo.arquivo.tipo === 'pdf' && (
            <a href={arquivo.arquivo.urlObjeto} target="_blank" rel="noopener noreferrer" style={linkBotao}>
              Tela cheia ↗
            </a>
          )}

          <a href={docSelecionado.url} target="_blank" rel="noopener noreferrer" style={linkBotao}>
            Baixar ↓
          </a>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 480,
            border: `1px solid ${COR.cinzaClaro}`,
            borderRadius: 10,
            background: COR.neutro,
            overflow: 'hidden',
            display: 'flex'
          }}
        >
          {arquivo.situacao === 'carregando' && (
            <p style={{ margin: 'auto', fontSize: 13, color: COR.textoSecundario }}>
              Baixando o documento do PNCP…
            </p>
          )}

          {arquivo.situacao === 'erro' && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 440, padding: 20 }}>
              <p style={{ ...paragrafo, marginBottom: 12 }}>! {arquivo.erro}</p>
              <a href={docSelecionado.url} target="_blank" rel="noopener noreferrer" style={{ ...linkBotao, ...botaoPrimario }}>
                Abrir o documento em outra aba
              </a>
            </div>
          )}

          {arquivo.situacao === 'ok' && arquivo.arquivo && (
            arquivo.arquivo.tipo === 'pdf' || arquivo.arquivo.tipo === 'texto'
              ? (
                <iframe
                  title={docSelecionado.titulo}
                  src={arquivo.arquivo.urlObjeto}
                  style={{ width: '100%', height: '100%', border: 0, background: '#ffffff' }}
                />
              )
              : arquivo.arquivo.tipo === 'imagem'
                ? (
                  <img
                    src={arquivo.arquivo.urlObjeto}
                    alt={docSelecionado.titulo}
                    style={{ maxWidth: '100%', maxHeight: '100%', margin: 'auto', objectFit: 'contain' }}
                  />
                )
                : (
                  <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 440, padding: 20 }}>
                    <p style={{ ...paragrafo, marginBottom: 12 }}>
                      {arquivo.arquivo.tipo === 'compactado'
                        ? 'Este documento é um arquivo compactado (.zip/.rar). O navegador não exibe o conteúdo: baixe e extraia.'
                        : 'Este tipo de arquivo não pode ser exibido no navegador.'}
                    </p>
                    <a href={docSelecionado.url} target="_blank" rel="noopener noreferrer" style={{ ...linkBotao, ...botaoPrimario }}>
                      Baixar o documento
                    </a>
                  </div>
                )
          )}
        </div>
      </div>
    );
  };

  // ==========================================================
  // LAYOUT
  // ==========================================================

  const corPrazo = prazo.aberto
    ? (prazo.urgente ? COR.indigo : COR.ciano)
    : COR.cinza;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pré-visualização do edital — ${item.orgao}`}
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        // Acima da barra superior do SharePoint (que também é fixa).
        zIndex: 2147483000,
        background: 'rgba(32, 42, 68, 0.45)',
        display: 'flex',
        justifyContent: 'flex-end',
        fontFamily: FONTE
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          width: 'min(1200px, 100%)',
          maxWidth: '100%',
          height: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: '#F7F9FB',
          boxShadow: '-12px 0 40px rgba(32, 42, 68, 0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            background: '#ffffff',
            borderBottom: `3px solid ${COR.ciano}`,
            padding: '18px 24px 0'
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: COR.textoSecundario }}>
                {item.modalidade} · {item.local} · Nº {item.numero}
                {dados.situacao ? ` · ${dados.situacao}` : ''}
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 600, color: COR.azul, lineHeight: 1.3 }}>
                {item.orgao}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Fechar"
              onClick={onFechar}
              style={{ ...botaoSecundario, fontSize: 16, lineHeight: 1, padding: '6px 11px' }}
            >
              ×
            </button>
          </div>

          {/* Indicadores principais */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 10,
              margin: '14px 0'
            }}
          >
            <Indicador
              titulo={prazo.rotulo}
              valor={formatarDataHoraPncp(item.encerramento)}
              detalhe={prazo.detalhe}
              destaque={corPrazo}
            />
            <Indicador
              titulo="Valor estimado"
              valor={formatarMoeda(item.valor)}
              detalhe={dados.srp ? 'Registro de preços (SRP)' : undefined}
              destaque={COR.azul}
            />
            <Indicador
              titulo="Modo de disputa"
              valor={dados.modoDisputa || '-'}
              detalhe={dados.sistemaOrigem}
              destaque={COR.cinzaClaro}
            />
            <Indicador
              titulo="Aderência"
              valor={`${item.score}%`}
              detalhe={`${item.motivos.length} critério(s) atendido(s)`}
              destaque={item.score >= 50 ? COR.ciano : COR.indigo}
            />
          </div>

          {/* Abas + ações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <nav style={{ display: 'flex', gap: 2 }} role="tablist">
              {ABAS.map(definicao => {
                const ativa = aba === definicao.id;
                return (
                  <button
                    key={definicao.id}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setAba(definicao.id)}
                    style={{
                      ...botaoBase,
                      background: 'transparent',
                      color: ativa ? COR.azul : COR.textoSecundario,
                      borderRadius: 0,
                      borderBottom: `3px solid ${ativa ? COR.azul : 'transparent'}`,
                      marginBottom: -3,
                      padding: '10px 14px'
                    }}
                  >
                    {definicao.rotulo}
                  </button>
                );
              })}
            </nav>

            <div style={{ display: 'flex', gap: 8, paddingBottom: 8, alignItems: 'center' }}>
              {mensagem && (
                <span style={{ fontSize: 11, color: COR.textoSecundario }}>{mensagem}</span>
              )}
              <button type="button" style={botaoSecundario} onClick={copiarResumo}>
                Copiar resumo
              </button>
              <button type="button" style={botaoSecundario} onClick={imprimirFicha}>
                Imprimir ficha
              </button>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...linkBotao, ...botaoPrimario }}>
                Abrir no PNCP ↗
              </a>
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: aba === 'edital' ? 'hidden' : 'auto',
            overflowX: 'hidden',
            padding: 24,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {aba === 'resumo' && renderResumo()}
          {aba === 'itens' && renderItens()}
          {aba === 'documentos' && renderDocumentos()}
          {aba === 'edital' && renderEdital()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditalPreviaModal;
