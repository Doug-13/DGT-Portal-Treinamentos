import * as React from 'react';

import {
  FinalidadeServidor,
  INFO_SOFTWARE,
  SOFTWARES_SEM_MEMORIAL
} from '../../services/bom/catalogoServidores';

import {
  ISelecaoKit,
  avaliarServidorDoProjeto
} from '../../services/bom/montadorBom';

import {
  FINALIDADES,
  IAvaliacaoServidor,
  IPassoAvaliado,
  ISelecaoServidor,
  NOME_STATUS,
  PassoServidor,
  RESERVAS,
  StatusServidor,
  TITULO_FINALIDADE,
  concluirServidor,
  responder
} from '../../services/bom/seletorServidor';

import {
  COR,
  FONTE,
  botao,
  campo
} from './arquiteturaComum';

import {
  IconeKit
} from './IconesKit';

// ============================================================
// SERVIDORES DA CENTRAL — seletor por memorial de cálculo
//
// Fica entre o bloco "Projeto" e os pontos da Seleção de kit. Um
// cartão por finalidade (gravação, analítico); "Abrir seleção" mostra
// os passos, uma pergunta por vez. O servidor e as licenças de VMS só
// entram na lista depois de "Adicionar à central".
// ============================================================

export interface ISeletorServidorProps {
  selecao: ISelecaoKit;
  bloqueado: boolean;
  aoMudar: (servidores: Partial<Record<FinalidadeServidor, ISelecaoServidor>>) => void;
}

const VERDE = '#107C10';
const VERMELHO = '#B42318';
const AMBAR = '#B45309';

const COR_STATUS: Record<StatusServidor, { cor: string; fundo: string }> = {
  naoSeAplica: { cor: COR.texto2, fundo: COR.fundo },
  nuvem: { cor: COR.texto2, fundo: COR.fundo },
  semCameras: { cor: COR.texto2, fundo: COR.fundo },
  emAndamento: { cor: COR.indigo, fundo: '#E8EAF8' },
  pendente: { cor: VERMELHO, fundo: '#FDE7E9' },
  pronto: { cor: '#036E7D', fundo: '#E6F9FC' },
  concluido: { cor: VERDE, fundo: '#E7F6EC' },
  revisar: { cor: AMBAR, fundo: '#FFF4E5' }
};

const formatarTb = (n: number): string =>
  `${(Math.round(n * 100) / 100).toLocaleString('pt-BR')} TB`;

const Selo: React.FC<{ status: StatusServidor }> = ({ status }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 800, background: COR_STATUS[status].fundo, color: COR_STATUS[status].cor, whiteSpace: 'nowrap' }}>
    {(status === 'pendente' || status === 'revisar') && <IconeKit nome="alerta" tamanho={13} />}
    {status === 'concluido' && <IconeKit nome="check" tamanho={13} />}
    {NOME_STATUS[status]}
  </span>
);

const SeloAuto: React.FC = () => (
  <span style={{ fontSize: '11px', fontWeight: 700, color: '#036E7D', background: '#E6F9FC', borderRadius: '999px', padding: '2px 8px', whiteSpace: 'nowrap' }}>automático</span>
);

// Botão de escolha (faixa, opção, alternativa).
const Escolha: React.FC<{
  marcado: boolean;
  desabilitado?: boolean;
  titulo: React.ReactNode;
  detalhe?: React.ReactNode;
  onClick: () => void;
  largura?: string;
  rotuloAcessivel?: string;
}> = ({ marcado, desabilitado, titulo, detalhe, onClick, largura, rotuloAcessivel }) => (
  <button
    type="button"
    disabled={desabilitado}
    aria-pressed={marcado}
    aria-label={rotuloAcessivel}
    onClick={onClick}
    style={{
      textAlign: 'left',
      minWidth: largura || 'auto',
      padding: '8px 12px',
      borderRadius: '10px',
      border: `${marcado ? 2 : 1}px solid ${marcado ? COR.ciano : COR.borda}`,
      background: desabilitado ? COR.fundo : marcado ? '#E6F9FC' : '#FFFFFF',
      color: desabilitado ? '#A3A9B3' : COR.azul,
      cursor: desabilitado ? 'not-allowed' : 'pointer',
      fontFamily: FONTE
    }}
  >
    <strong style={{ display: 'block', fontSize: '13px' }}>{titulo}</strong>
    {detalhe && <span style={{ display: 'block', fontSize: '11.5px', color: desabilitado ? '#A3A9B3' : COR.texto2, marginTop: '2px', lineHeight: 1.35 }}>{detalhe}</span>}
  </button>
);

const NIVEL_ESTILO: Record<'bloqueio' | 'aviso' | 'info', { cor: string; fundo: string; rotulo: string }> = {
  bloqueio: { cor: VERMELHO, fundo: '#FDE7E9', rotulo: 'Bloqueio' },
  aviso: { cor: '#7C2D12', fundo: '#FFF4E5', rotulo: 'Atenção' },
  info: { cor: '#1E3A8A', fundo: '#EAF1FD', rotulo: 'Informação' }
};

const SeletorServidor: React.FC<ISeletorServidorProps> = ({ selecao, bloqueado, aoMudar }) => {

  const [aberto, setAberto] = React.useState<FinalidadeServidor | undefined>(undefined);

  const avaliacoes = FINALIDADES.map(f => avaliarServidorDoProjeto(selecao, f));
  const visiveis = avaliacoes.filter(a => a.status !== 'naoSeAplica');

  const gravar = (finalidade: FinalidadeServidor, estado: ISelecaoServidor): void => {
    aoMudar({ ...(selecao.servidores || {}), [finalidade]: estado });
  };

  // Sem servidor nenhum (Safe City, sem IPX) e VMS sem memorial: uma linha.
  if (visiveis.length === 0) {
    return null;
  }

  const renderizarPasso = (av: IAvaliacaoServidor, passo: IPassoAvaliado, indice: number): React.ReactNode => {

    const estado = av.estado;
    const desabilitado = bloqueado || passo.estado === 'bloqueado';
    const responde = (id: PassoServidor, parcial: Partial<ISelecaoServidor>): void =>
      gravar(av.finalidade, { ...responder(estado, id, parcial), software: av.software });

    const cabecalho = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: passo.estado === 'bloqueado' || passo.estado === 'naoSeAplica' ? 0 : '8px' }}>
        <span style={{
          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800,
          background: passo.estado === 'respondido' || passo.estado === 'automatico' ? COR.azul : passo.estado === 'aberto' ? COR.ciano : COR.fundo,
          color: passo.estado === 'bloqueado' || passo.estado === 'naoSeAplica' ? '#A3A9B3' : '#FFFFFF'
        }}>
          {passo.estado === 'respondido' || passo.estado === 'automatico' ? <IconeKit nome="check" tamanho={13} /> : indice + 1}
        </span>
        <strong style={{ fontSize: '13.5px', color: passo.estado === 'bloqueado' ? '#A3A9B3' : COR.azul }}>{passo.titulo}</strong>
        {passo.estado === 'automatico' && <SeloAuto />}
        {passo.estado === 'naoSeAplica' && <span style={{ fontSize: '12px', color: COR.texto2 }}>não se aplica</span>}
        {passo.valor && passo.estado !== 'bloqueado' && passo.estado !== 'naoSeAplica' && (
          <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: COR.texto2, textAlign: 'right' }}>{passo.valor}</span>
        )}
      </div>
    );

    if (passo.estado === 'bloqueado' || passo.estado === 'naoSeAplica') {
      return cabecalho;
    }

    let corpo: React.ReactNode = null;

    if (passo.id === 'premissas') {
      corpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {av.premissas.map(p => (
            <div key={p.item} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '12.5px', color: COR.azul, padding: '6px 8px', borderRadius: '8px', background: p.atendida === false ? '#FDE7E9' : COR.fundo }}>
              <span style={{ flex: '1 1 220px' }}>
                <strong>{p.item}:</strong> {p.valor}
                {p.detalhe && <span style={{ display: 'block', fontSize: '11.5px', color: p.atendida === false ? VERMELHO : COR.texto2, marginTop: '2px' }}>{p.detalhe}</span>}
              </span>
              {p.automatica
                ? (p.verificacao === 'informativo' ? <span style={{ fontSize: '11.5px', color: COR.texto2 }}>referência</span> : <SeloAuto />)
                : (
                  <span style={{ display: 'inline-flex', gap: '4px' }}>
                    {[true, false].map(v => (
                      <button
                        key={String(v)}
                        type="button"
                        disabled={bloqueado}
                        aria-pressed={estado.premissas[p.item] === v}
                        onClick={() => responde('premissas', { premissas: { ...estado.premissas, [p.item]: v } })}
                        style={{
                          border: `1px solid ${estado.premissas[p.item] === v ? (v ? COR.ciano : VERMELHO) : COR.borda}`,
                          background: estado.premissas[p.item] === v ? (v ? '#E6F9FC' : '#FDE7E9') : '#FFFFFF',
                          color: COR.azul, borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: bloqueado ? 'default' : 'pointer', fontFamily: FONTE
                        }}
                      >
                        {v ? 'Atende' : 'Não atende'}
                      </button>
                    ))}
                  </span>
                )}
            </div>
          ))}
          <div style={{ fontSize: '11.5px', color: COR.texto2 }}>Projeto fora da premissa fica pendente: peça o dimensionamento ao fornecedor.</div>
        </div>
      );
    }

    if (passo.id === 'compressao') {
      corpo = (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {av.compressoes.map(c => (
            <Escolha
              key={c}
              marcado={(av.compressoes.length === 1 ? c : estado.compressao) === c}
              desabilitado={desabilitado || av.compressoes.length === 1}
              titulo={c}
              detalhe={av.software === 'digifort' && c === 'H.265' ? 'Armazenamento do memorial × 0,5' : 'Armazenamento do memorial'}
              onClick={() => responde('compressao', { compressao: c })}
            />
          ))}
        </div>
      );
    }

    if (passo.id === 'cameras') {
      const c = av.contagem;
      corpo = (
        <div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: COR.azul, marginBottom: '10px' }}>
            <span><strong>{c.video}</strong> câm. de vídeo</span>
            <span style={{ opacity: av.finalidade === 'analitico' ? 0.5 : 1 }}><strong>{c.lpr}</strong> câm. LPR{av.finalidade === 'analitico' ? ' (fora do analítico)' : ''}</span>
            {c.porteiros > 0 && <span><strong>{c.porteiros}</strong> porteiro(s)</span>}
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Reserva</div>
              <div style={{ display: 'inline-flex', gap: '4px' }}>
                {RESERVAS.map(r => (
                  <button key={r} type="button" disabled={desabilitado} aria-pressed={estado.reservaPct === r}
                    onClick={() => responde('cameras', { reservaPct: r, ajusteManual: undefined, camerasConfirmadas: false, incluirLpr: estado.incluirLpr, incluirPorteiros: estado.incluirPorteiros })}
                    style={{ border: `1px solid ${estado.reservaPct === r ? COR.ciano : COR.borda}`, background: estado.reservaPct === r ? '#E6F9FC' : '#FFFFFF', color: COR.azul, borderRadius: '8px', padding: '5px 10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: FONTE }}>
                    {r}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Ajuste manual</div>
              <input
                type="number"
                min={0}
                aria-label="Ajuste manual do número de câmeras"
                value={estado.ajusteManual || ''}
                placeholder="—"
                disabled={desabilitado}
                onChange={e => {
                  const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  responde('cameras', { ajusteManual: n > 0 ? n : undefined, reservaPct: estado.reservaPct, camerasConfirmadas: false, incluirLpr: estado.incluirLpr, incluirPorteiros: estado.incluirPorteiros });
                }}
                style={{ ...campo, width: '90px' }}
              />
            </div>
          </div>
          {av.finalidade === 'gravacao' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', color: COR.azul, cursor: 'pointer' }}>
                <input type="checkbox" checked={estado.incluirLpr} disabled={desabilitado}
                  onChange={e => responde('cameras', { incluirLpr: e.target.checked, reservaPct: estado.reservaPct, ajusteManual: estado.ajusteManual, incluirPorteiros: estado.incluirPorteiros, camerasConfirmadas: false })} />
                Incluir câmeras LPR na gravação
                <span style={{ fontSize: '11.5px', color: COR.texto2 }}>(padrão documentado — a confirmar, pendência S1)</span>
              </label>
              {c.porteiros > 0 && (
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', color: COR.azul, cursor: 'pointer' }}>
                  <input type="checkbox" checked={estado.incluirPorteiros} disabled={desabilitado}
                    onChange={e => responde('cameras', { incluirPorteiros: e.target.checked, reservaPct: estado.reservaPct, ajusteManual: estado.ajusteManual, incluirLpr: estado.incluirLpr, camerasConfirmadas: false })} />
                  Incluir os porteiros (consomem canal de VMS — pendência S2)
                </label>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: COR.azul }}>
              Base <strong>{av.base}</strong> → necessidade <strong>{av.necessidade}</strong> câmeras
              {estado.ajusteManual ? ' (ajuste manual)' : ` (reserva ${estado.reservaPct}%)`}
            </span>
            {!estado.camerasConfirmadas && (
              <button type="button" style={botao('principal', desabilitado)} disabled={desabilitado}
                onClick={() => responde('cameras', { camerasConfirmadas: true, reservaPct: estado.reservaPct, ajusteManual: estado.ajusteManual, incluirLpr: estado.incluirLpr, incluirPorteiros: estado.incluirPorteiros })}>
                Confirmar câmeras
              </button>
            )}
          </div>
        </div>
      );
    }

    if (passo.id === 'faixa') {
      corpo = (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {av.faixas.map(f => (
            <Escolha
              key={f.capacidade}
              marcado={av.capacidade === f.capacidade}
              desabilitado={desabilitado || !f.habilitada}
              largura="92px"
              rotuloAcessivel={`Faixa de ${f.capacidade} câmeras`}
              titulo={`${f.capacidade}`}
              detalhe={f.capacidade < av.necessidade
                ? 'não comporta'
                : f.opcoes === 0
                  ? 'memorial incompleto'
                  : f.recomendada ? 'recomendada' : `folga ${f.folga}`}
              onClick={() => responde('faixa', { capacidade: f.capacidade })}
            />
          ))}
        </div>
      );
    }

    if (passo.id === 'opcao') {
      corpo = (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          {av.linhasDaFaixa.map(l => {
            const fator = av.software === 'digifort' && (av.compressoes.length === 1 ? av.compressoes[0] : estado.compressao) === 'H.265' ? 0.5 : 1;
            const tb = (l.armazTotalTb || l.armazServidorTb * l.qtdServidores) * fator;
            return (
              <Escolha
                key={l.chave}
                marcado={!!av.linha && av.linha.chave === l.chave}
                desabilitado={desabilitado || av.linhasDaFaixa.length === 1}
                titulo={l.opcao ? `Opção ${l.opcao}` : 'Opção única'}
                detalhe={(
                  <>
                    {l.qtdServidores} servidor(es) · {Math.round(l.capacidade / Math.max(1, l.qtdServidores))} câm./servidor
                    {av.finalidade === 'gravacao' && tb > 0 && <><br />{formatarTb(tb)} no total</>}
                    <br />{l.processadores.join(' ou ')}
                  </>
                )}
                onClick={() => responde('opcao', { chaveLinha: l.chave })}
              />
            );
          })}
        </div>
      );
    }

    if (passo.id === 'gpu' || passo.id === 'processador' || passo.id === 'so') {
      const linha = av.linha;
      const alternativas = !linha ? [] : passo.id === 'gpu' ? linha.gpus : passo.id === 'processador' ? linha.processadores : linha.sistemas;
      const atual = passo.id === 'gpu' ? av.gpu : passo.id === 'processador' ? av.processador : av.so;
      corpo = (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {alternativas.map(a => (
            <Escolha
              key={a}
              marcado={atual === a}
              desabilitado={desabilitado || alternativas.length === 1}
              titulo={a}
              onClick={() => responde(passo.id, passo.id === 'gpu' ? { gpu: a } : passo.id === 'processador' ? { processador: a } : { so: a })}
            />
          ))}
          {alternativas.length > 1 && <div style={{ width: '100%', fontSize: '11.5px', color: COR.texto2 }}>Alternativas equivalentes no memorial.</div>}
        </div>
      );
    }

    return (
      <>
        {cabecalho}
        <div style={{ paddingLeft: '30px' }}>{corpo}</div>
      </>
    );
  };

  const renderizarResumo = (av: IAvaliacaoServidor): React.ReactNode => {
    const linha = av.linha;
    const estado = av.estado;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {linha
          ? (
            <div style={{ background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', color: COR.azul, lineHeight: 1.55 }}>
              <strong style={{ fontSize: '13.5px' }}>{linha.qtdServidores}× {TITULO_FINALIDADE[av.finalidade]} {INFO_SOFTWARE[linha.software].nomeCurto} · {linha.capacidade} câmeras{linha.opcao ? ` · opção ${linha.opcao}` : ''}</strong><br />
              {[av.processador, linha.ram && `${linha.ram} RAM`, av.gpu].filter(Boolean).join(' · ')}<br />
              {av.finalidade === 'gravacao' && (
                <>{formatarTb(av.armazenamentoServidorTb)} por servidor · {formatarTb(av.armazenamentoTotalTb)} no total{linha.arranjo ? ` · ${linha.arranjo}` : ''}<br /></>
              )}
              {av.so && <>SO: {av.so}<br /></>}
              <span style={{ color: COR.texto2 }}>Código CIGAM: {linha.codigoCigam || <strong style={{ color: AMBAR }}>sem código (sugestão {linha.chave})</strong>}</span>
            </div>
          )
          : <div style={{ fontSize: '12.5px', color: COR.texto2 }}>O servidor aparece aqui quando a faixa e a distribuição estiverem definidas.</div>}

        {(av.software === 'digifort' || av.software === 'milestone') && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Licenças de VMS</div>
            <div style={{ display: 'inline-flex', background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '3px', gap: '3px' }}>
              {(['necessidade', 'faixa'] as Array<ISelecaoServidor['modoLicenca']>).map(m => (
                <button key={m} type="button" disabled={bloqueado} onClick={() => gravar(av.finalidade, { ...estado, software: av.software, modoLicenca: m })}
                  style={{ border: 0, borderRadius: '8px', padding: '5px 10px', background: estado.modoLicenca === m ? COR.azul : 'transparent', color: estado.modoLicenca === m ? '#FFFFFF' : COR.azul, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONTE }}>
                  {m === 'necessidade' ? `Pela necessidade (${av.necessidade})` : `Pela faixa${linha ? ` (${linha.capacidade})` : ''}`}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '4px' }}>Base de licença 1 por servidor; packs cobrem a necessidade. A regra definitiva é a pendência S3.</div>
          </div>
        )}

        {av.alertas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {av.alertas.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', background: NIVEL_ESTILO[a.nivel].fundo, color: NIVEL_ESTILO[a.nivel].cor, borderRadius: '8px', padding: '6px 9px', fontSize: '12px', lineHeight: 1.4 }}>
                <IconeKit nome="alerta" tamanho={14} />
                <span><strong>{NIVEL_ESTILO[a.nivel].rotulo}:</strong> {a.texto}</span>
              </div>
            ))}
          </div>
        )}

        {av.itens.length > 0 && (
          <div style={{ border: `1px solid ${COR.borda}`, borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <tbody>
                {av.itens.map((i, n) => (
                  <tr key={n} style={{ borderTop: n ? `1px solid ${COR.borda}` : 0 }}>
                    <td style={{ padding: '6px 10px', color: COR.azul }}>{i.descricao}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: COR.azul }}>{i.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {av.rastreabilidade && <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{av.rastreabilidade}</div>}

        {!bloqueado && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(av.status === 'pronto' || av.status === 'revisar') && (
              <button type="button" style={botao('principal')} onClick={() => {
                const concluido = concluirServidor(av);
                if (concluido) {
                  gravar(av.finalidade, concluido);
                }
              }}>
                {av.status === 'revisar' ? 'Atualizar na central' : 'Adicionar à central'}
              </button>
            )}
            {av.status === 'pendente' && (
              <button type="button" style={botao('principal', true)} disabled title="Resolva os bloqueios">Adicionar à central</button>
            )}
            {estado.concluido && (
              <button type="button" style={botao('secundario')} onClick={() => gravar(av.finalidade, { ...estado, software: av.software, concluido: false, necessidadeNaConclusao: undefined })}>
                Tirar da central
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '14px', padding: '14px 18px', marginBottom: '14px', fontFamily: FONTE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <IconeKit nome="servidor" tamanho={20} cor={COR.indigo} />
        <strong style={{ color: COR.azul, fontSize: '14px' }}>Servidores da central</strong>
        <span style={{ fontSize: '12px', color: COR.texto2 }}>
          Seleção pelo memorial de cálculo: Digifort, Milestone e IPX. Sem memorial ({SOFTWARES_SEM_MEMORIAL.join(', ')}): inclua o servidor à parte.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visiveis.map(av => {
          const expandido = aberto === av.finalidade;
          const nomeSw = av.software ? INFO_SOFTWARE[av.software].nomeCurto : 'Safe City';
          const resumo = av.status === 'nuvem' || av.status === 'semCameras'
            ? av.mensagem
            : [
              `${av.necessidade} câmeras`,
              av.capacidade !== undefined ? `faixa ${av.capacidade}` : '',
              av.linha ? `${av.linha.qtdServidores} servidor(es)${av.linha.opcao ? ` · opção ${av.linha.opcao}` : ''}` : ''
            ].filter(Boolean).join(' · ');
          const interativo = av.status !== 'nuvem' && av.status !== 'semCameras';
          return (
            <div key={av.finalidade} style={{ border: `1px solid ${expandido ? COR.ciano : COR.borda}`, borderRadius: '12px', background: expandido ? '#FBFEFF' : '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', flexWrap: 'wrap' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '9px', background: COR.fundo, color: COR.azul, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconeKit nome={av.status === 'nuvem' ? 'nuvem' : 'servidor'} tamanho={18} />
                </span>
                <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '13.5px', color: COR.azul }}>{TITULO_FINALIDADE[av.finalidade]} — {nomeSw}</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: av.status === 'revisar' ? AMBAR : COR.texto2 }}>{av.status === 'revisar' ? av.mensagem : resumo}</span>
                </span>
                <Selo status={av.status} />
                {interativo && (
                  <button type="button" style={botao('secundario')} aria-expanded={expandido} onClick={() => setAberto(expandido ? undefined : av.finalidade)}>
                    {expandido ? 'Fechar' : av.estado.concluido ? 'Ver seleção' : 'Abrir seleção'}
                  </button>
                )}
              </div>

              {expandido && interativo && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', padding: '4px 14px 14px', borderTop: `1px solid ${COR.borda}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: COR.texto2 }}>
                      Finalidade: {av.finalidade === 'gravacao' ? 'gravação' : 'analítico'} <SeloAuto /> · Local: on-premise <SeloAuto /> · Software: {av.software ? INFO_SOFTWARE[av.software].nome : '—'} <SeloAuto />
                    </div>
                    {av.passos.map((p, i) => (
                      <div key={p.id} style={{ opacity: p.estado === 'bloqueado' ? 0.6 : 1 }}>
                        {renderizarPasso(av, p, i)}
                      </div>
                    ))}
                  </div>
                  <div style={{ paddingTop: '12px' }}>
                    {renderizarResumo(av)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeletorServidor;
