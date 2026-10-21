import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import {
  IFluxoDefinicao
} from '../../models/Fluxo';

import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../../models/Processo';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IItemTransferencia,
  IResultadoItemTransferencia,
  TransferenciaProcessoService
} from '../../services/processos/TransferenciaProcessoService';

// ============================================================
// TRANSFERIR DOCUMENTOS PARA OUTRO PROCESSO (administrador)
//
// 1) escolher o processo de destino (com fluxo publicado);
// 2) analisar: cada documento mostra a etapa atual e a etapa
//    equivalente no destino — nada é gravado;
// 3) marcar os documentos, informar a justificativa e transferir.
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';

export interface ITransferirDocumentosModalProps {
  dataverseService: DataverseService;
  origem: IProcesso;
  processos: IProcesso[];
  fluxosPorProcesso: Record<string, IFluxoDefinicao[]>;
  vinculos: IDocumentoProcessoVinculo[];
  documentos: IDocumento[];
  usuario: { id: string; nome: string };
  onFechar: (alterou: boolean) => void;
}

const versaoPublicada = (
  fluxos: IFluxoDefinicao[] | undefined
): number | undefined => {
  const publicada = (fluxos || []).find(item => item.status === 'publicado');
  return publicada ? publicada.versao : undefined;
};

const botao = (
  principal: boolean,
  desabilitado: boolean
): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${COR_AZUL}`,
  background: desabilitado ? '#CBD5E1' : principal ? COR_AZUL : '#FFFFFF',
  color: principal || desabilitado ? '#FFFFFF' : COR_AZUL,
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: desabilitado ? 'not-allowed' : 'pointer'
});

const rotuloSituacao: Record<IItemTransferencia['situacao'], { texto: string; fundo: string; cor: string; borda: string }> = {
  transferivel: { texto: 'Mantém a etapa', fundo: '#E6F9FC', cor: COR_AZUL, borda: COR_CIANO },
  soVinculo: { texto: 'Só o vínculo', fundo: '#F2F2F2', cor: COR_AZUL, borda: 'transparent' },
  bloqueado: { texto: 'Não pode', fundo: '#E8EAF8', cor: COR_INDIGO, borda: 'transparent' }
};

const TransferirDocumentosModal: React.FC<ITransferirDocumentosModalProps> = ({
  dataverseService,
  origem,
  processos,
  fluxosPorProcesso,
  vinculos,
  documentos,
  usuario,
  onFechar
}) => {

  const servico =
    React.useMemo(
      () => new TransferenciaProcessoService(dataverseService),
      [dataverseService]
    );

  const [destinoId, setDestinoId] =
    React.useState<string>('');

  const [itens, setItens] =
    React.useState<IItemTransferencia[] | undefined>(undefined);

  const [definicaoDestino, setDefinicaoDestino] =
    React.useState<IFluxoDefinicao | undefined>(undefined);

  const [marcados, setMarcados] =
    React.useState<Record<string, boolean>>({});

  const [justificativa, setJustificativa] =
    React.useState<string>('');

  const [processando, setProcessando] =
    React.useState<string>('');

  const [erro, setErro] =
    React.useState<string>('');

  const [resultados, setResultados] =
    React.useState<IResultadoItemTransferencia[] | undefined>(undefined);

  const destinos =
    processos
      .filter(item => item.ativo && item.id !== origem.id)
      .sort((a, b) => (a.codigo || a.nome).localeCompare(b.codigo || b.nome, 'pt-BR'));

  const destino =
    destinos.find(item => item.id === destinoId);

  const analisar = async (): Promise<void> => {
    if (!destino) {
      return;
    }
    setProcessando('Analisando os documentos...');
    setErro('');
    setResultados(undefined);
    try {
      const analise = await servico.analisar(origem, destino, vinculos, documentos);
      setItens(analise.itens);
      setDefinicaoDestino(analise.definicaoDestino);
      const marcar: Record<string, boolean> = {};
      analise.itens.forEach(item => { marcar[item.vinculo.id] = item.situacao !== 'bloqueado'; });
      setMarcados(marcar);
    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : 'Não foi possível analisar os documentos.');
    } finally {
      setProcessando('');
    }
  };

  const selecionados =
    (itens || []).filter(item => marcados[item.vinculo.id] && item.situacao !== 'bloqueado');

  const podeTransferir =
    !!destino &&
    !!definicaoDestino &&
    selecionados.length > 0 &&
    justificativa.trim().length >= 10 &&
    !processando;

  const transferir = async (): Promise<void> => {
    if (!podeTransferir || !destino || !definicaoDestino) {
      return;
    }
    if (!window.confirm(`Transferir ${selecionados.length} documento(s) de ${origem.nome} para ${destino.nome}?`)) {
      return;
    }
    setProcessando(`Transferindo ${selecionados.length} documento(s)...`);
    setErro('');
    try {
      setResultados(
        await servico.transferir(selecionados, origem, destino, definicaoDestino, justificativa, usuario)
      );
    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir a transferência.');
    } finally {
      setProcessando('');
    }
  };

  const concluido =
    !!resultados;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transferir documentos para outro processo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '20px',
        overflowY: 'auto',
        background: 'rgba(15,23,42,.55)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: '16px',
          marginBottom: '40px',
          color: COR_AZUL,
          fontSize: '13.5px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>Transferir documentos para outro processo</h2>
            <div style={{ color: COR_TEXTO_2 }}>
              Origem: <strong>{origem.codigo ? `${origem.codigo} — ` : ''}{origem.nome}</strong> · alterado por administrador
            </div>
          </div>
          <button type="button" disabled={!!processando} onClick={() => onFechar(concluido)} style={botao(false, !!processando)}>
            Fechar
          </button>
        </div>

        <p style={{ color: COR_TEXTO_2, lineHeight: 1.5, fontSize: '12.5px' }}>
          Revisões em andamento passam para o fluxo publicado do destino <strong>na mesma etapa</strong> (as etapas são
          associadas pelo identificador, como nos fluxos copiados, ou pelo nome). Revisões já publicadas não mudam: o
          histórico delas continua no processo de origem. Nada é apagado.
        </p>

        {/* 1) DESTINO */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flexGrow: 1, minWidth: '280px' }}>
            <label htmlFor="transferir-destino" style={{ display: 'block', fontSize: '11px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Processo de destino
            </label>
            <select
              id="transferir-destino"
              value={destinoId}
              disabled={!!processando || concluido}
              onChange={evento => {
                setDestinoId(evento.target.value);
                setItens(undefined);
                setDefinicaoDestino(undefined);
              }}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: `1px solid ${COR_BORDA}`, color: COR_AZUL, fontSize: '13.5px' }}
            >
              <option value="">Selecione...</option>
              {
                destinos.map(
                  item => {
                    const versao = versaoPublicada(fluxosPorProcesso[item.id]);
                    return (
                      <option key={item.id} value={item.id} disabled={!versao}>
                        {item.codigo ? `${item.codigo} — ` : ''}{item.nome}
                        {versao ? ` · fluxo v${versao}` : ' · sem fluxo publicado (indisponível)'}
                      </option>
                    );
                  }
                )
              }
            </select>
          </div>
          <button
            type="button"
            disabled={!destino || !!processando || concluido}
            onClick={() => { analisar().catch((error: unknown) => console.error(error)); }}
            style={botao(true, !destino || !!processando || concluido)}
          >
            Analisar documentos
          </button>
        </div>

        {processando && <div style={{ marginTop: '12px', fontWeight: 600 }}>{processando}</div>}

        {
          erro && (
            <div role="alert" style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_INDIGO}`, background: '#E8EAF8' }}>
              {erro}
            </div>
          )
        }

        {/* 2) ANÁLISE */}
        {
          itens && !resultados && (
            <div style={{ marginTop: '16px' }}>
              {
                itens.length === 0
                  ? <div style={{ color: COR_TEXTO_2 }}>Nenhum documento vinculado ao processo de origem.</div>
                  : (
                    <div style={{ overflowX: 'auto', border: `1px solid ${COR_BORDA}`, borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: COR_AZUL, color: '#FFFFFF', textAlign: 'left' }}>
                            <th style={{ padding: '9px 10px', width: '34px' }} />
                            <th style={{ padding: '9px 10px' }}>Documento</th>
                            <th style={{ padding: '9px 10px' }}>Revisão</th>
                            <th style={{ padding: '9px 10px' }}>Etapa atual → no destino</th>
                            <th style={{ padding: '9px 10px' }}>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {
                            itens.map(
                              item => {
                                const rotulo = rotuloSituacao[item.situacao];
                                return (
                                  <tr key={item.vinculo.id} style={{ borderTop: `1px solid ${COR_BORDA}`, verticalAlign: 'top' }}>
                                    <td style={{ padding: '9px 10px' }}>
                                      <input
                                        type="checkbox"
                                        aria-label={`Transferir ${item.documento.codigo}`}
                                        disabled={item.situacao === 'bloqueado' || !!processando}
                                        checked={!!marcados[item.vinculo.id] && item.situacao !== 'bloqueado'}
                                        onChange={evento => setMarcados(atual => ({ ...atual, [item.vinculo.id]: evento.target.checked }))}
                                      />
                                    </td>
                                    <td style={{ padding: '9px 10px' }}>
                                      <strong>{item.documento.codigo}</strong>
                                      <div style={{ color: COR_TEXTO_2 }}>{item.documento.titulo}</div>
                                    </td>
                                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                      {item.revisao || '—'}
                                      {item.statusRevisao && <div style={{ color: COR_TEXTO_2 }}>{item.statusRevisao}</div>}
                                    </td>
                                    <td style={{ padding: '9px 10px' }}>
                                      {
                                        item.etapaOrigem
                                          ? <span>{item.etapaOrigem} → <strong>{item.etapaDestino || '?'}</strong></span>
                                          : <span style={{ color: COR_TEXTO_2 }}>—</span>
                                      }
                                    </td>
                                    <td style={{ padding: '9px 10px', minWidth: '260px' }}>
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          padding: '1px 8px',
                                          borderRadius: '10px',
                                          fontWeight: 700,
                                          fontSize: '11px',
                                          background: rotulo.fundo,
                                          color: rotulo.cor,
                                          border: `1px solid ${rotulo.borda}`
                                        }}
                                      >
                                        {rotulo.texto}
                                      </span>
                                      <div style={{ marginTop: '4px' }}>{item.detalhe}</div>
                                      {item.avisos.map(aviso => <div key={aviso} style={{ marginTop: '3px', color: COR_INDIGO }}>{aviso}</div>)}
                                    </td>
                                  </tr>
                                );
                              }
                            )
                          }
                        </tbody>
                      </table>
                    </div>
                  )
              }

              {
                itens.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <label htmlFor="transferir-justificativa" style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                      Justificativa (obrigatória, mínimo 10 caracteres)
                    </label>
                    <textarea
                      id="transferir-justificativa"
                      rows={2}
                      value={justificativa}
                      onChange={evento => setJustificativa(evento.target.value)}
                      placeholder="Ex.: processos duplicados; os documentos passam a seguir o processo único da área."
                      style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '8px 10px', fontFamily: 'inherit', fontSize: '13px', color: COR_AZUL }}
                    />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={!podeTransferir}
                        onClick={() => { transferir().catch((error: unknown) => console.error(error)); }}
                        style={botao(true, !podeTransferir)}
                      >
                        Transferir {selecionados.length} documento(s)
                      </button>
                      <span style={{ color: COR_TEXTO_2, fontSize: '12px' }}>
                        Destino: {destino ? destino.nome : ''}{definicaoDestino ? ` · fluxo v${definicaoDestino.versao}` : ''}
                      </span>
                    </div>
                  </div>
                )
              }
            </div>
          )
        }

        {/* 3) RESULTADO */}
        {
          resultados && (
            <div style={{ marginTop: '16px' }}>
              <strong>
                {resultados.filter(item => item.ok).length} de {resultados.length} documento(s) transferido(s).
              </strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                {
                  resultados.map(
                    item => (
                      <li key={item.documento.id} style={{ marginBottom: '4px', color: item.ok ? COR_AZUL : COR_INDIGO }}>
                        <strong>{item.ok ? '✓' : '!'} {item.documento.codigo}</strong> — {item.mensagem}
                      </li>
                    )
                  )
                }
              </ul>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default TransferirDocumentosModal;
