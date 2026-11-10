import * as React from 'react';

import {
  Compressao,
  IAnaliseServidor,
  IConjuntoServidor,
  IEscolhaServidor,
  IServidorSelecao,
  LIMITE_COMBINADO,
  RESERVAS,
  codigoSugerido,
  necessidadeDe,
  nomeSoftware,
  servidorPadrao
} from '../../services/bom/servidores';

import {
  COR,
  FONTE
} from './arquiteturaComum';

import {
  IconeKit
} from './IconesKit';

// ============================================================
// SELEÇÃO DE KIT — SERVIDOR DA CENTRAL
//
// Uma pergunta por vez, na ordem da especificação:
//   montagem (combinado/separados) → compressão → câmeras (reserva,
//   ajuste) → faixa → opção → GPU → processador → SO.
// Opção única vira automática (selo "automático"); alterar uma
// resposta apaga as seguintes; faixas que não comportam ficam cinza;
// cada opção mostra o efeito (TB, servidores, processador) antes do
// clique. "Orçamento manual" tira o servidor do seletor.
// ============================================================

export interface IServidorCentralPainelProps {
  analise: IAnaliseServidor;
  selecao?: IServidorSelecao;
  vms: 'safeCity' | 'digifort' | 'milestone';
  prazoContratoMeses?: number;
  bloqueado: boolean;
  onMudar: (s: IServidorSelecao) => void;
}

const VERMELHO = '#B42318';

const Selo: React.FC<{ texto: string; tom?: 'auto' | 'ok' | 'pendente' | 'erro' | 'cinza' }> = ({ texto, tom = 'auto' }) => {
  const cores = {
    auto: { c: COR.indigo, f: '#EEF0FB' },
    ok: { c: '#0E6E7C', f: '#E6F9FC' },
    pendente: { c: '#B45309', f: '#FFF4E5' },
    erro: { c: '#FFFFFF', f: VERMELHO },
    cinza: { c: COR.texto2, f: COR.fundo }
  }[tom];
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700, color: cores.c, background: cores.f, whiteSpace: 'nowrap' }}>{texto}</span>;
};

const Pergunta: React.FC<{ numero: number; titulo: string; ajuda?: string; auto?: boolean; children: React.ReactNode }> = ({ numero, titulo, ajuda, auto, children }) => (
  <div style={{ borderTop: `1px solid ${COR.borda}`, padding: '12px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: COR.azul, color: '#FFFFFF', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{numero}</span>
      <strong style={{ fontSize: '13.5px', color: COR.azul }}>{titulo}</strong>
      {auto && <Selo texto="automático" />}
      {ajuda && <span style={{ fontSize: '12px', color: COR.texto2 }}>{ajuda}</span>}
    </div>
    {children}
  </div>
);

const Opcao: React.FC<{ marcado: boolean; desabilitado?: boolean; onClick: () => void; titulo: string; detalhe?: string; selo?: React.ReactNode; minimo?: number }> =
  ({ marcado, desabilitado, onClick, titulo, detalhe, selo, minimo = 150 }) => (
    <button
      type="button"
      disabled={desabilitado}
      onClick={onClick}
      aria-pressed={marcado}
      style={{
        textAlign: 'left', minWidth: `${minimo}px`, flex: `0 1 ${minimo + 40}px`, padding: '9px 12px', borderRadius: '10px',
        border: `${marcado ? 2 : 1}px solid ${marcado ? COR.ciano : COR.borda}`,
        background: desabilitado ? COR.fundo : marcado ? '#E6F9FC' : '#FFFFFF',
        color: COR.azul, cursor: desabilitado ? 'not-allowed' : 'pointer', opacity: desabilitado ? 0.5 : 1, fontFamily: FONTE
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '13.5px' }}>{titulo}</strong>
        {selo}
      </span>
      {detalhe && <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2, marginTop: '3px', lineHeight: 1.35 }}>{detalhe}</span>}
    </button>
  );

const tb = (n: number): string => `${String(Math.round(n * 100) / 100).replace('.', ',')} TB`;

const PAPEL: Record<string, string> = {
  gravacao: 'Gravação',
  analitico: 'Analítico',
  combinado: 'Gravação + analítico (mesmo servidor)'
};

const ServidorCentralPainel: React.FC<IServidorCentralPainelProps> = ({ analise, selecao, vms, prazoContratoMeses, bloqueado, onMudar }) => {

  const s: IServidorSelecao = selecao || servidorPadrao();
  const [aberto, setAberto] = React.useState(true);

  const mudar = (parcial: Partial<IServidorSelecao>): void => onMudar({ ...s, ...parcial });

  // Alterar uma resposta apaga as seguintes.
  const limparEscolhas = (): Partial<IServidorSelecao> => ({ gravacao: undefined, analitico: undefined, combinado: undefined });

  const mudarEscolha = (papel: IConjuntoServidor['papel'], parcial: Partial<IEscolhaServidor>, ordem: Array<keyof IEscolhaServidor>): void => {
    const atual: IEscolhaServidor = { ...((papel === 'gravacao' ? s.gravacao : papel === 'analitico' ? s.analitico : s.combinado) || {}) };
    const primeiro = Object.keys(parcial)[0] as keyof IEscolhaServidor;
    const indice = ordem.indexOf(primeiro);
    ordem.slice(indice + 1).forEach(k => { delete atual[k]; });
    const nova = { ...atual, ...parcial };
    mudar({ [papel]: nova, baseNaEscolha: analise.baseGravacao } as Partial<IServidorSelecao>);
  };

  const ORDEM: Array<keyof IEscolhaServidor> = ['ajusteNecessidade', 'capacidade', 'opcao', 'gpu', 'processador', 'so'];

  const temGravacao = analise.conjuntos.some(c => c.papel !== 'analitico');
  const status =
    analise.local === 'nuvem' && !analise.usaIpx ? <Selo texto="Nuvem — sem servidor" tom="ok" />
      : analise.local === 'nenhum' ? <Selo texto="Sem câmeras" tom="cinza" />
        : s.orcamentoManual ? <Selo texto="Orçamento manual" tom="pendente" />
          : analise.definido ? <Selo texto={`Definido · ${analise.servidoresTotal} servidor(es)`} tom="ok" />
            : <Selo texto="Pendente" tom="pendente" />;

  const revisar = analise.alertas.some(a => a.regra === 'revisar');

  let numero = 0;

  const blocoConjunto = (c: IConjuntoServidor): React.ReactNode => {
    const escolha = c.escolha;
    const faixaAtual = c.linha ? c.linha.capacidade : undefined;
    const faixa = c.faixas.filter(f => f.capacidade === faixaAtual)[0];
    const fatorH265 = (c.software === 'digifort' || c.software === 'digifortIpx') && s.compressao === 'H.265' ? 0.5 : 1;

    return (
      <div key={c.papel} style={{ border: `1px solid ${COR.borda}`, borderRadius: '12px', padding: '12px 14px', marginTop: '10px', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <IconeKit nome="servidor" tamanho={18} cor={COR.indigo} />
          <strong style={{ color: COR.azul, fontSize: '14px' }}>{PAPEL[c.papel]} — {nomeSoftware(c.software)}</strong>
          <span style={{ fontSize: '12px', color: COR.texto2 }}>
            base {c.base} câmera(s){c.papel === 'analitico' ? ' de vídeo' : ' (vídeo + porteiros)'} → necessidade <strong>{c.necessidade}</strong>
          </span>
          <span style={{ marginLeft: 'auto' }}>{c.pendente ? <Selo texto={c.pendente === 'faixa' ? 'Sem faixa' : 'Falta responder'} tom={c.pendente === 'faixa' ? 'erro' : 'pendente'} /> : <Selo texto="Definido" tom="ok" />}</span>
        </div>

        <Pergunta numero={++numero} titulo="Câmeras" ajuda="reserva sobre a base; arredonda sempre para cima">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12.5px', color: COR.azul, display: 'flex', gap: '6px', alignItems: 'center' }}>
              Ajuste manual da necessidade
              <input
                type="number"
                min={c.base}
                disabled={bloqueado}
                value={escolha.ajusteNecessidade || ''}
                placeholder={String(necessidadeDe(c.base, s.reservaPct))}
                onChange={e => mudarEscolha(c.papel, { ajusteNecessidade: Number(e.target.value) || undefined }, ORDEM)}
                style={{ width: '80px', padding: '6px 8px', border: `1px solid ${COR.borda}`, borderRadius: '8px', fontSize: '13px', fontFamily: FONTE }}
              />
            </label>
            {escolha.ajusteNecessidade !== undefined && escolha.ajusteNecessidade < c.base && <span style={{ fontSize: '12px', color: VERMELHO }}>Menor que a base: ignorado.</span>}
          </div>
        </Pergunta>

        <Pergunta numero={++numero} titulo="Faixa do memorial" auto={!escolha.capacidade && !!faixa} ajuda="a recomendada é a menor que comporta">
          {c.faixas.length === 0
            ? <span style={{ fontSize: '12.5px', color: VERMELHO }}>Sem linha ativa no catálogo para {nomeSoftware(c.software)}. Cadastre o memorial em Kits → Servidores ou use o orçamento manual.</span>
            : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {c.faixas.map(f => {
                  const l = f.linhas[0];
                  return (
                    <Opcao
                      key={f.capacidade}
                      minimo={130}
                      marcado={f.capacidade === faixaAtual}
                      desabilitado={bloqueado || !f.habilitada}
                      onClick={() => mudarEscolha(c.papel, { capacidade: f.capacidade }, ORDEM)}
                      titulo={`${f.capacidade} câmeras`}
                      selo={f.recomendada ? <Selo texto="recomendada" tom="ok" /> : f.habilitada ? <Selo texto={`folga ${f.folga}`} tom="cinza" /> : undefined}
                      detalhe={[
                        tb(l.armazTotalTb * fatorH265),
                        `${l.qtdServidores} servidor${l.qtdServidores > 1 ? 'es' : ''}`,
                        l.gpus.length === 1 ? l.gpus[0].replace('NVIDIA ', '') : l.gpus.length > 1 ? `${l.gpus.length} GPUs` : 'sem GPU',
                        l.processadores[0] || ''
                      ].filter(Boolean).join(' · ')}
                    />
                  );
                })}
              </div>
            )}
          {c.papel === 'combinado' && <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '6px' }}>Servidor combinado vai até {LIMITE_COMBINADO} câmeras. Acima disso: gravação e analítico separados.</div>}
        </Pergunta>

        {faixa && faixa.linhas.length > 1 && (
          <Pergunta numero={++numero} titulo="Distribuição (opção)" ajuda="decisão de projeto">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {faixa.linhas.map(l => (
                <Opcao
                  key={l.opcao}
                  marcado={!!c.linha && c.linha.opcao === l.opcao && !!escolha.opcao}
                  desabilitado={bloqueado}
                  onClick={() => mudarEscolha(c.papel, { opcao: l.opcao }, ORDEM)}
                  titulo={`Opção ${l.opcao || '—'}`}
                  detalhe={`${l.qtdServidores} servidor(es) · ${l.camerasPorServidor} câm./servidor · ${tb(l.armazTotalTb * fatorH265)}${l.discosQtd ? ` · ${l.discosQtd * l.qtdServidores} discos` : ''}`}
                />
              ))}
            </div>
          </Pergunta>
        )}

        {c.linha && c.linha.gpus.length > 0 && (
          <Pergunta numero={++numero} titulo="GPU" auto={c.automatico.gpu}>
            {c.automatico.gpu
              ? <span style={{ fontSize: '13px', color: COR.azul }}>{c.gpu}</span>
              : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {c.linha.gpus.map(g => <Opcao key={g} marcado={c.gpu === g} desabilitado={bloqueado} onClick={() => mudarEscolha(c.papel, { gpu: g }, ORDEM)} titulo={g} />)}
                </div>
              )}
          </Pergunta>
        )}

        {c.linha && c.linha.processadores.length > 0 && (c.pendente !== 'gpu') && (
          <Pergunta numero={++numero} titulo="Processador" auto={c.automatico.processador} ajuda={c.automatico.processador ? undefined : 'alternativas equivalentes do memorial'}>
            {c.automatico.processador
              ? <span style={{ fontSize: '13px', color: COR.azul }}>{c.processador}</span>
              : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {c.linha.processadores.map(p => <Opcao key={p} marcado={c.processador === p} desabilitado={bloqueado} onClick={() => mudarEscolha(c.papel, { processador: p }, ORDEM)} titulo={p} />)}
                </div>
              )}
          </Pergunta>
        )}

        {c.linha && c.linha.sistemasOperacionais.length > 0 && c.pendente !== 'gpu' && c.pendente !== 'processador' && (
          <Pergunta numero={++numero} titulo="Sistema operacional" auto={c.automatico.so}>
            {c.automatico.so
              ? <span style={{ fontSize: '13px', color: COR.azul }}>{c.so}</span>
              : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {c.linha.sistemasOperacionais.map(o => <Opcao key={o} marcado={c.so === o} desabilitado={bloqueado} onClick={() => mudarEscolha(c.papel, { so: o }, ORDEM)} titulo={o} />)}
                </div>
              )}
          </Pergunta>
        )}

        {c.linha && !c.pendente && (
          <div style={{ marginTop: '6px', padding: '10px 12px', background: COR.fundo, borderRadius: '10px', fontSize: '12.5px', color: COR.azul, lineHeight: 1.5 }}>
            <strong>{c.linha.qtdServidores}× {codigoSugerido(c.linha)}</strong> — {[c.processador, c.linha.ram, tb(c.armazenamentoTb), c.gpu || 'sem GPU', c.so].filter(Boolean).join(' · ')}
            <span style={{ display: 'block', color: COR.texto2 }}>
              {c.linha.codigoCigam ? `CIGAM ${c.linha.codigoCigam}` : 'Sem código CIGAM: não orçável até o cadastro.'} · Memorial: {c.linha.versaoMemorial || '—'}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${revisar ? '#F3B8B3' : COR.borda}`, borderRadius: '14px', padding: '14px 18px', marginBottom: '14px', fontFamily: FONTE }}>
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: FONTE, textAlign: 'left' }}>
        <IconeKit nome="servidor" tamanho={20} cor={COR.indigo} />
        <strong style={{ color: COR.azul, fontSize: '15px' }}>Servidor da central</strong>
        <span style={{ fontSize: '12px', color: COR.texto2 }}>item do projeto inteiro</span>
        {revisar && <Selo texto="revisar servidor" tom="erro" />}
        <span style={{ marginLeft: 'auto' }}>{status}</span>
        <span aria-hidden="true" style={{ color: COR.texto2 }}>{aberto ? '▴' : '▾'}</span>
      </button>

      {aberto && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '12px', color: COR.texto2, background: '#EEF0FB', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', lineHeight: 1.45 }}>
            O seletor cobre <strong>Digifort, Milestone e IPX Analytics</strong> (3 dos 7 softwares que exigem servidor).
            Axxon, Briefcam, Invenzi (W-Access) e NX Witness: só o lembrete — servidor dimensionado à parte. Safe City é nuvem.
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {[
              [`${analise.v}`, 'câmeras de vídeo'],
              [`${analise.p}`, 'porteiros (entram na base)'],
              [`${analise.l}`, 'LPR (não entram)'],
              [`${analise.baseGravacao}`, 'base de gravação']
            ].map(([v, r]) => (
              <span key={r} style={{ background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '6px 10px', fontSize: '12px', color: COR.texto2 }}>
                <strong style={{ color: COR.azul, fontSize: '14px' }}>{v}</strong> {r}
              </span>
            ))}
          </div>

          {analise.local === 'nuvem' && !analise.usaIpx && (
            <p style={{ fontSize: '13px', color: COR.azul, margin: '8px 0 0' }}>Gravação em nuvem (Bridgefy Safe City): o projeto não leva servidor.</p>
          )}

          {analise.conjuntos.length > 0 && !s.orcamentoManual && (
            <>
              {vms === 'digifort' && analise.usaIpx && (
                <Pergunta numero={++numero} titulo="Montagem" auto={!analise.podeCombinar} ajuda={analise.podeCombinar ? 'até 50 câmeras dá para usar um servidor só' : 'acima de 50 câmeras: dois servidores'}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Opcao marcado={analise.modo === 'combinado'} desabilitado={bloqueado || !analise.podeCombinar} onClick={() => mudar({ modo: 'combinado', compressao: undefined, ...limparEscolhas() })}
                      titulo="Combinado (Digifort + IPX)" detalhe="Um servidor, com GPU · sugerido até 50 câmeras" minimo={220} />
                    <Opcao marcado={analise.modo === 'separado'} desabilitado={bloqueado} onClick={() => mudar({ modo: 'separado', compressao: undefined, ...limparEscolhas() })}
                      titulo="Separados" detalhe="Gravação Digifort + analítico IPX" minimo={220} />
                  </div>
                </Pergunta>
              )}

              {temGravacao && (
                <Pergunta numero={++numero} titulo="Compressão" ajuda="decisão de projeto">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['H.264', 'H.265'] as Compressao[]).map(cmp => (
                      <Opcao key={cmp} marcado={s.compressao === cmp} desabilitado={bloqueado}
                        onClick={() => mudar({ compressao: cmp, ...limparEscolhas() })}
                        titulo={cmp}
                        detalhe={cmp === 'H.265' && vms === 'digifort' ? 'Digifort: metade do armazenamento do memorial' : 'Armazenamento do memorial'} />
                    ))}
                  </div>
                </Pergunta>
              )}

              {(!temGravacao || s.compressao) && (
                <>
                  <Pergunta numero={++numero} titulo="Reserva" ajuda="sobre a base de câmeras">
                    <div style={{ display: 'inline-flex', background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '3px', gap: '3px' }}>
                      {RESERVAS.map(r => (
                        <button key={r} type="button" disabled={bloqueado} onClick={() => mudar({ reservaPct: r, ...limparEscolhas() })}
                          style={{ border: 0, borderRadius: '8px', padding: '6px 12px', background: s.reservaPct === r ? COR.azul : 'transparent', color: s.reservaPct === r ? '#FFFFFF' : COR.azul, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', fontFamily: FONTE }}>
                          {r}%
                        </button>
                      ))}
                    </div>
                  </Pergunta>
                  {analise.conjuntos.map(blocoConjunto)}
                </>
              )}
            </>
          )}

          {vms === 'milestone' && analise.carePlus && (
            <Pergunta numero={++numero} titulo="Care Plus (Milestone)" auto={!!analise.carePlus.item && !s.carePlus}
              ajuda={prazoContratoMeses ? `contrato de ${prazoContratoMeses} meses` : 'tipo de projeto sem prazo de locação'}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {([['', `Pelo contrato${prazoContratoMeses ? ` (${prazoContratoMeses} meses)` : ''}`], ['12', '1 ano'], ['36', '3 anos'], ['60', '5 anos'], ['cotacao', 'Cotação específica']] as Array<[IServidorSelecao['carePlus'], string]>).map(([v, t]) => (
                  <Opcao key={v || 'auto'} minimo={110} marcado={(s.carePlus || '') === v} desabilitado={bloqueado} onClick={() => mudar({ carePlus: v })} titulo={t} />
                ))}
              </div>
            </Pergunta>
          )}

          {analise.local === 'onPremise' && analise.baseGravacao > 0 && (
            <div style={{ borderTop: `1px solid ${COR.borda}`, marginTop: '10px', paddingTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: COR.azul, cursor: bloqueado ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={!!s.orcamentoManual} disabled={bloqueado} onChange={e => mudar({ orcamentoManual: e.target.checked, baseNaEscolha: analise.baseGravacao })} />
                <strong>Orçamento manual</strong>
              </label>
              <span style={{ fontSize: '12px', color: COR.texto2 }}>Sai do seletor quando a faixa acima ou um contrato-mãe sair mais barato. Decisão comercial.</span>
              {s.orcamentoManual && (
                <>
                  <label style={{ fontSize: '12.5px', color: COR.azul, display: 'flex', gap: '6px', alignItems: 'center' }}>
                    Servidores
                    <input type="number" min={1} value={s.orcamentoManualServidores || 1} disabled={bloqueado}
                      onChange={e => mudar({ orcamentoManualServidores: Math.max(1, Number(e.target.value) || 1) })}
                      style={{ width: '70px', padding: '6px 8px', border: `1px solid ${COR.borda}`, borderRadius: '8px', fontFamily: FONTE }} />
                  </label>
                  <input value={s.orcamentoManualMotivo || ''} disabled={bloqueado} placeholder="Motivo (ex.: contrato-mãe do suprimentos)"
                    onChange={e => mudar({ orcamentoManualMotivo: e.target.value })}
                    style={{ flex: '1 1 260px', padding: '7px 10px', border: `1px solid ${COR.borda}`, borderRadius: '8px', fontSize: '13px', fontFamily: FONTE }} />
                </>
              )}
            </div>
          )}

          {analise.alertas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
              {analise.alertas.map(a => (
                <div key={a.texto} style={{
                  display: 'flex', gap: '8px', alignItems: 'flex-start', borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', lineHeight: 1.4,
                  background: a.nivel === 'bloqueio' ? '#FDE7E9' : a.nivel === 'aviso' ? '#FFF4E5' : '#EEF0FB',
                  color: a.nivel === 'bloqueio' ? VERMELHO : a.nivel === 'aviso' ? '#7C2D12' : COR.indigo
                }}>
                  <IconeKit nome="alerta" tamanho={15} />
                  <span>{a.texto}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServidorCentralPainel;
