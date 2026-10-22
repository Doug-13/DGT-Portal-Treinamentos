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
// ATUALIZAR DOCUMENTOS PARA A VERSÃO PUBLICADA DO FLUXO
//
// Abre sozinho depois de publicar uma versão (e pelo botão na aba
// Documentos do processo). Lista as revisões em andamento que ainda
// estão numa versão antiga e as leva para a publicada, na mesma etapa.
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';

export interface IAtualizarDocumentosFluxoModalProps {
  dataverseService: DataverseService;
  processo: IProcesso;
  vinculos: IDocumentoProcessoVinculo[];
  documentos: IDocumento[];
  usuario: { id: string; nome: string };
  // true quando acabou de publicar (texto de abertura diferente).
  aposPublicar?: boolean;
  onFechar: () => void;
}

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

const AtualizarDocumentosFluxoModal: React.FC<IAtualizarDocumentosFluxoModalProps> = ({
  dataverseService,
  processo,
  vinculos,
  documentos,
  usuario,
  aposPublicar,
  onFechar
}) => {

  const servico =
    React.useMemo(
      () => new TransferenciaProcessoService(dataverseService),
      [dataverseService]
    );

  const [itens, setItens] =
    React.useState<IItemTransferencia[] | undefined>(undefined);

  const [definicao, setDefinicao] =
    React.useState<IFluxoDefinicao | undefined>(undefined);

  const [jaAtualizadas, setJaAtualizadas] =
    React.useState<number>(0);

  const [marcados, setMarcados] =
    React.useState<Record<string, boolean>>({});

  const [processando, setProcessando] =
    React.useState<string>('Procurando revisões em versões anteriores...');

  const [erro, setErro] =
    React.useState<string>('');

  const [resultados, setResultados] =
    React.useState<IResultadoItemTransferencia[] | undefined>(undefined);

  React.useEffect(
    () => {
      let cancelado = false;
      servico.analisarAtualizacao(processo, vinculos, documentos)
        .then(analise => {
          if (cancelado) {
            return;
          }
          setItens(analise.itens);
          setDefinicao(analise.definicaoDestino);
          setJaAtualizadas(analise.atualizadas);
          const marcar: Record<string, boolean> = {};
          analise.itens.forEach(item => { marcar[item.vinculo.id] = item.situacao === 'transferivel'; });
          setMarcados(marcar);
        })
        .catch((error: unknown) => {
          console.error(error);
          if (!cancelado) {
            setErro(error instanceof Error ? error.message : 'Não foi possível analisar as revisões.');
          }
        })
        .then(() => { if (!cancelado) { setProcessando(''); } })
        .catch((error: unknown) => console.error(error));
      return () => { cancelado = true; };
    },
    [servico, processo, vinculos, documentos]
  );

  const selecionados =
    (itens || []).filter(item => marcados[item.vinculo.id] && item.situacao === 'transferivel');

  const pode =
    !!definicao && selecionados.length > 0 && !processando && !resultados;

  const atualizar = (): void => {
    if (!pode || !definicao) {
      return;
    }
    setProcessando(`Atualizando ${selecionados.length} revisão(ões)...`);
    setErro('');
    servico.atualizarVersao(selecionados, processo, definicao, usuario)
      .then(lista => setResultados(lista))
      .catch((error: unknown) => {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível atualizar as revisões.');
      })
      .then(() => setProcessando(''))
      .catch((error: unknown) => console.error(error));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atualizar documentos para a versão publicada"
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
          maxWidth: '960px',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: '16px',
          marginBottom: '40px',
          color: COR_AZUL,
          fontSize: '13.5px',
          lineHeight: 1.5
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>
              {aposPublicar ? 'Versão publicada — atualizar documentos em andamento?' : 'Atualizar documentos para a versão publicada'}
            </h2>
            <div style={{ color: COR_TEXTO_2 }}>
              {processo.codigo ? `${processo.codigo} — ` : ''}{processo.nome}
              {definicao ? ` · versão publicada v${definicao.versao}` : ''}
            </div>
          </div>
          <button type="button" disabled={!!processando && !!itens} onClick={onFechar} style={botao(false, !!processando && !!itens)}>
            {resultados ? 'Concluir' : 'Agora não'}
          </button>
        </div>

        <p style={{ color: COR_TEXTO_2, fontSize: '12.5px' }}>
          As revisões passam para a versão publicada <strong>na mesma etapa</strong>. Daí em diante seguem o fluxo
          novo: atividades incluídas <strong>depois</strong> da etapa atual passam a fazer parte do caminho, e os
          responsáveis e opções da etapa atual passam a ser os da versão nova. Atividades incluídas antes da etapa
          atual não são refeitas. O histórico registra a atualização.
        </p>

        {processando && <div style={{ fontWeight: 600 }}>{processando}</div>}

        {
          erro && (
            <div role="alert" style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_INDIGO}`, background: '#E8EAF8' }}>
              {erro}
            </div>
          )
        }

        {
          itens && !resultados && (
            itens.length === 0
              ? (
                <div style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${COR_CIANO}`, background: '#E6F9FC' }}>
                  Nenhuma revisão em andamento numa versão anterior.
                  {jaAtualizadas > 0 ? ` ${jaAtualizadas} revisão(ões) já usam a versão publicada.` : ''}
                </div>
              )
              : (
                <>
                  <div style={{ overflowX: 'auto', border: `1px solid ${COR_BORDA}`, borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: COR_AZUL, color: '#FFFFFF', textAlign: 'left' }}>
                          <th style={{ padding: '9px 10px', width: '34px' }}>
                            <input
                              type="checkbox"
                              aria-label="Marcar todas"
                              checked={selecionados.length > 0 && selecionados.length === itens.filter(item => item.situacao === 'transferivel').length}
                              onChange={evento => {
                                const marcar: Record<string, boolean> = {};
                                itens.forEach(item => { marcar[item.vinculo.id] = evento.target.checked && item.situacao === 'transferivel'; });
                                setMarcados(marcar);
                              }}
                            />
                          </th>
                          <th style={{ padding: '9px 10px' }}>Documento</th>
                          <th style={{ padding: '9px 10px' }}>Revisão</th>
                          <th style={{ padding: '9px 10px' }}>Etapa atual → na versão nova</th>
                          <th style={{ padding: '9px 10px' }}>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {
                          itens.map(
                            item => (
                              <tr key={item.vinculo.id} style={{ borderTop: `1px solid ${COR_BORDA}`, verticalAlign: 'top' }}>
                                <td style={{ padding: '9px 10px' }}>
                                  <input
                                    type="checkbox"
                                    aria-label={`Atualizar ${item.documento.codigo}`}
                                    disabled={item.situacao !== 'transferivel' || !!processando}
                                    checked={!!marcados[item.vinculo.id] && item.situacao === 'transferivel'}
                                    onChange={evento => setMarcados(atual => ({ ...atual, [item.vinculo.id]: evento.target.checked }))}
                                  />
                                </td>
                                <td style={{ padding: '9px 10px' }}>
                                  <strong>{item.documento.codigo}</strong>
                                  <div style={{ color: COR_TEXTO_2 }}>{item.documento.titulo}</div>
                                </td>
                                <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                  {item.revisao}
                                  <div style={{ color: COR_TEXTO_2 }}>{item.statusRevisao}</div>
                                </td>
                                <td style={{ padding: '9px 10px' }}>
                                  {item.etapaOrigem || '—'} → <strong>{item.etapaDestino || '?'}</strong>
                                </td>
                                <td style={{ padding: '9px 10px', minWidth: '240px', color: item.situacao === 'transferivel' ? COR_AZUL : COR_INDIGO }}>
                                  {item.detalhe}
                                  {item.avisos.map(aviso => <div key={aviso} style={{ marginTop: '3px', color: COR_INDIGO }}>{aviso}</div>)}
                                </td>
                              </tr>
                            )
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button type="button" disabled={!pode} onClick={atualizar} style={botao(true, !pode)}>
                      Atualizar {selecionados.length} revisão(ões)
                    </button>
                    {jaAtualizadas > 0 && <span style={{ color: COR_TEXTO_2, fontSize: '12px' }}>{jaAtualizadas} revisão(ões) já estão na versão publicada.</span>}
                  </div>
                </>
              )
          )
        }

        {
          resultados && (
            <div style={{ marginTop: '6px' }}>
              <strong>{resultados.filter(item => item.ok).length} de {resultados.length} revisão(ões) atualizada(s).</strong>
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

export default AtualizarDocumentosFluxoModal;
