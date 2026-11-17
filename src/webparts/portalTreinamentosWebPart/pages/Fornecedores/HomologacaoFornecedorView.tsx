import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  CLASSIFICACOES_RISCO,
  ClassificacaoRisco,
  ETAPAS_HOMOLOGACAO,
  EtapaHomologacao,
  ICicloHomologacao,
  IDadosHomologacao,
  IdVerificacao,
  IFornecedor,
  IVerificacao,
  MOTIVOS_CICLO,
  RESULTADOS_HOMOLOGACAO,
  ResultadoHomologacao,
  VERIFICACOES_HOMOLOGACAO
} from '../../services/fornecedores/modeloFornecedores';

import {
  ISituacaoDocumental
} from '../../services/fornecedores/situacaoDocumental';

import {
  cicloAberto,
  etapaVizinha,
  resultadoConclusivo,
  SituacaoVerificacao,
  statusPeloResultado,
  sugerirVerificacoes,
  validarConclusao,
  verificacoesOk
} from '../../services/fornecedores/homologacao';

import {
  Aviso,
  COR,
  CampoMotivo,
  Modal,
  Selo,
  TomSelo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  formatarDataHora,
  painel,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — HOMOLOGAÇÃO EM KANBAN (item 9 da Ficha SUP-CPL-01)
//
// Colunas: Ficha recebida → Documentos pendentes → Em análise
// (Suprimentos) → Aguardando Jurídico → Homologado / Reprovado.
// Cada card é um CICLO (dgt_fornecedorhomologacao). A ficha que chega
// pelo formulário abre o ciclo sozinha; as colunas seguintes são
// movidas à mão (botões, "Mover para" ou arrastar). Concluir exige o
// resultado e grava também o cadastro (status, risco, validade).
// Ciclo concluído = histórico somente leitura; renovação = ciclo novo.
// Sem notificações nesta fase.
//
// Só o administrador do módulo grava. As sugestões automáticas são
// apoio: quem marca "OK" é a pessoa responsável.
// ============================================================

const TOM: Record<SituacaoVerificacao, TomSelo> = {
  ok: 'ciano',
  atencao: 'indigo',
  pendente: 'azul',
  manual: 'cinza'
};

const ROTULO: Record<SituacaoVerificacao, string> = {
  ok: '✓ sistema: ok',
  atencao: '! atenção',
  pendente: 'pendente',
  manual: 'manual'
};

const hojeIso = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1);
  const dia = String(d.getDate());
  return `${d.getFullYear()}-${m.length < 2 ? '0' + m : m}-${dia.length < 2 ? '0' + dia : dia}`;
};

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const diasDesde = (iso: string): number => {
  const t = Date.parse(iso || '');
  return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

const tomResultado = (r: ResultadoHomologacao): TomSelo =>
  r === 'Aprovado' ? 'ciano' : r === 'Aprovado com ressalvas' ? 'azul' : r === 'Reprovado' ? 'indigo' : 'cinza';

const dadosDoCiclo = (c: ICicloHomologacao, f: IFornecedor): IDadosHomologacao => ({
  classificacaoRisco: c.classificacaoRisco,
  resultadoHomologacao: c.resultadoHomologacao || 'Pendente',
  ressalvas: c.ressalvas,
  validadeCadastro: c.validadeCadastro,
  verificacoes: { ...c.verificacoes },
  responsavelSuprimentos: c.responsavelSuprimentos,
  responsavelCompliance: c.responsavelCompliance,
  // Aberto: conferência viva do cadastro. Concluído: retrato da conclusão.
  bancarioConferido: c.concluidoEm ? c.bancarioConferido : f.bancarioConferido
});

// ------------------------------------------------------------
// Quadro (colunas + cards) — usado aqui e na aba geral
// ------------------------------------------------------------

export interface ICardQuadro {
  ciclo: ICicloHomologacao;
  titulo: string;       // "Ciclo 2" ou a razão social (quadro geral)
  subtitulo: string;
}

export const QuadroKanban: React.FC<{
  cards: ICardQuadro[];
  selecionado?: string;
  podeMover: boolean;
  aoAbrir: (ciclo: ICicloHomologacao) => void;
  aoSoltar?: (ciclo: ICicloHomologacao, destino: EtapaHomologacao) => void;
}> = ({ cards, selecionado, podeMover, aoAbrir, aoSoltar }) => {

  const [arrastando, setArrastando] = React.useState<string>('');
  const [sobre, setSobre] = React.useState<string>('');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ETAPAS_HOMOLOGACAO.length}, minmax(190px, 1fr))`, gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
      {ETAPAS_HOMOLOGACAO.map(etapa => {
        const daColuna = cards.filter(c => c.ciclo.etapa === etapa.id);
        const aceita = podeMover && !!aoSoltar && etapa.id !== 'Concluído';
        return (
          <section
            key={etapa.id}
            aria-label={`Coluna ${etapa.rotulo}`}
            onDragOver={e => { if (aceita && arrastando) { e.preventDefault(); setSobre(etapa.id); } }}
            onDragLeave={() => setSobre('')}
            onDrop={e => {
              e.preventDefault();
              setSobre('');
              const card = cards.filter(c => c.ciclo.id === arrastando)[0];
              setArrastando('');
              if (aceita && card && aoSoltar) { aoSoltar(card.ciclo, etapa.id); }
            }}
            style={{
              background: sobre === etapa.id ? COR.cinzaClaro : COR.fundo,
              border: `1px solid ${COR.cinzaClaro}`,
              borderRadius: '10px',
              padding: '8px',
              minHeight: '120px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: COR.texto2, margin: '2px 4px 8px' }}>
              <span>{etapa.rotulo}</span>
              <span>{daColuna.length}</span>
            </div>
            {daColuna.map(card => {
              const c = card.ciclo;
              const aberto = !c.concluidoEm;
              const ativo = selecionado === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  draggable={podeMover && aberto && !!aoSoltar}
                  onDragStart={e => { setArrastando(c.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setArrastando(''); setSobre(''); }}
                  onClick={() => aoAbrir(c)}
                  aria-pressed={ativo}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: COR.branco,
                    border: `1px solid ${ativo ? COR.ciano : COR.cinzaClaro}`,
                    borderLeft: `4px solid ${aberto ? COR.ciano : COR.cinzaClaro}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: COR.azul,
                    opacity: aberto ? 1 : 0.8,
                    boxShadow: ativo ? '0 0 0 2px rgba(0, 174, 199, .25)' : 'none'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13.5px', lineHeight: 1.3 }}>{card.titulo}</div>
                  <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>{card.subtitulo}</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {aberto
                      ? <Selo tom="cinza">{`há ${diasDesde(c.etapaDesde)} dia(s)`}</Selo>
                      : <Selo tom={tomResultado(c.resultadoHomologacao)}>{c.resultadoHomologacao}</Selo>}
                    <Selo tom="cinza">{`${verificacoesOk(c)}/9`}</Selo>
                    {c.classificacaoRisco && <Selo tom={c.classificacaoRisco === 'Alto' ? 'indigo' : 'azul'}>{`risco ${c.classificacaoRisco.toLowerCase()}`}</Selo>}
                  </div>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------
// Abrir ciclo
// ------------------------------------------------------------

const AbrirCicloModal: React.FC<{
  motivoSugerido: string;
  fechar: () => void;
  confirmar: (motivo: string, etapa: EtapaHomologacao) => Promise<void>;
}> = ({ motivoSugerido, fechar, confirmar }) => {
  const [motivo, setMotivo] = React.useState(motivoSugerido);
  const [etapa, setEtapa] = React.useState<EtapaHomologacao>('Ficha recebida');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const ok = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await confirmar(motivo, etapa);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo="Abrir ciclo de homologação"
      subtitulo="Um card novo no kanban. Os ciclos anteriores ficam como histórico."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={520}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando)} disabled={gravando} onClick={() => { ok().catch(() => undefined); }}>
            {gravando ? 'Abrindo…' : 'Abrir ciclo'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <label style={rotulo} htmlFor="ciclo-motivo">Motivo</label>
      <select id="ciclo-motivo" style={campo} value={motivo} onChange={e => setMotivo(e.target.value)}>
        {MOTIVOS_CICLO.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <label style={rotulo} htmlFor="ciclo-etapa">Começa na coluna</label>
      <select id="ciclo-etapa" style={campo} value={etapa} onChange={e => setEtapa(e.target.value as EtapaHomologacao)}>
        {ETAPAS_HOMOLOGACAO.filter(e => e.id !== 'Concluído').map(e => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
      </select>
    </Modal>
  );
};

// ------------------------------------------------------------
// Card aberto (todos os campos do item 9)
// ------------------------------------------------------------

const CardCiclo: React.FC<{
  servico: FornecedoresService;
  fornecedor: IFornecedor;
  ciclo: ICicloHomologacao;
  situacao: ISituacaoDocumental;
  administra: boolean;
  usuarioNome: string;
  aoAlterar: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, ciclo, situacao, administra, usuarioNome, aoAlterar }) => {

  const [d, setD] = React.useState<IDadosHomologacao>(() => dadosDoCiclo(ciclo, fornecedor));
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState('');
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    setD(dadosDoCiclo(ciclo, fornecedor));
    setMotivo('');
    setErro('');
  }, [ciclo, fornecedor]);

  const aberto = !ciclo.concluidoEm;
  const somenteLeitura = !administra || !aberto;
  const sugestoes = sugerirVerificacoes(fornecedor, situacao);
  const mudar = (parcial: Partial<IDadosHomologacao>): void => setD(a => ({ ...a, ...parcial }));

  const mudarVerificacao = (id: IdVerificacao, ok: boolean): void =>
    setD(a => {
      const atual: IVerificacao = a.verificacoes[id] || { ok: false, data: '', responsavel: '' };
      return {
        ...a,
        verificacoes: {
          ...a.verificacoes,
          [id]: ok ? { ok: true, data: atual.data || hojeIso(), responsavel: atual.responsavel || usuarioNome } : { ok: false, data: '', responsavel: '' }
        }
      };
    });

  const executar = async (rotuloAcao: string, acao: () => Promise<string | undefined>): Promise<void> => {
    setGravando(rotuloAcao);
    setErro('');
    try {
      const aviso = await acao();
      await aoAlterar(aviso);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setGravando('');
    }
  };

  const mover = (destino: EtapaHomologacao): Promise<void> =>
    executar('mover', async () => {
      await servico.moverCiclo(ciclo, destino, usuarioNome);
      return `Ciclo ${ciclo.numero} em "${destino}".`;
    });

  const problemaConclusao = validarConclusao(d);
  const statusDepois = statusPeloResultado(d.resultadoHomologacao, fornecedor.status);
  const anterior = etapaVizinha(ciclo.etapa, -1);
  const proxima = etapaVizinha(ciclo.etapa, 1);
  const pendentesFluxo = situacao.pendencias.length;

  const andamento: Array<{ texto: string; feito: boolean; detalhe: string }> = [
    { texto: 'Ficha recebida (formulário)', feito: !!fornecedor.fichaRecebidaEm, detalhe: ciclo.protocolo || fornecedor.protocolo || 'sem protocolo' },
    { texto: 'Documentos enviados', feito: pendentesFluxo === 0, detalhe: pendentesFluxo ? `${pendentesFluxo} pendência(s) na aba Documentos` : 'sem pendências' },
    { texto: 'Consultas (Receita, sanções, certidões)', feito: !!fornecedor.situacaoCadastral && fornecedor.resultadoSancoes !== 'Não consultado' && fornecedor.resultadoCertidoes !== 'Não consultado', detalhe: `sanções: ${fornecedor.resultadoSancoes} · certidões: ${fornecedor.resultadoCertidoes}` },
    { texto: 'Ficha e Código de Conduta assinados (Clicksign)', feito: /assinad/i.test(fornecedor.assinaturaStatus), detalhe: fornecedor.assinaturaStatus || 'integração aguardando o token' },
    { texto: 'Aprovação do Jurídico', feito: !!d.responsavelCompliance, detalhe: d.responsavelCompliance || 'registre abaixo quem aprovou e quando' }
  ];

  return (
    <div style={{ ...painel, marginTop: '14px', borderTop: `4px solid ${aberto ? COR.ciano : COR.cinzaClaro}` }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Ciclo {ciclo.numero} — {ciclo.motivo || 'homologação'}</div>
          <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
            Aberto em {formatarDataHora(ciclo.criadoEm)}{ciclo.abertoPor ? ` por ${ciclo.abertoPor}` : ''}
            {aberto ? ` · em "${ciclo.etapa}" há ${diasDesde(ciclo.etapaDesde)} dia(s)` : ` · concluído em ${formatarDataHora(ciclo.concluidoEm)}`}
          </div>
        </div>
        {aberto ? <Selo tom="ciano">{ciclo.etapa}</Selo> : <Selo tom={tomResultado(ciclo.resultadoHomologacao)}>{ciclo.resultadoHomologacao}</Selo>}
      </div>

      {!aberto && <Aviso tipo="info">Ciclo concluído: somente leitura. Para renovar ou recontratar, abra um ciclo novo.</Aviso>}
      {aberto && !administra && <Aviso tipo="info">Somente o administrador do módulo move o card e grava a homologação. Você vê o andamento e as sugestões do sistema.</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {aberto && administra && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 12px' }}>
          <button type="button" style={botao('secundario', !anterior || !!gravando)} disabled={!anterior || !!gravando} onClick={() => { if (anterior) { mover(anterior).catch(() => undefined); } }}>
            ← {anterior || 'início'}
          </button>
          <button type="button" style={botao('secundario', !proxima || !!gravando)} disabled={!proxima || !!gravando} onClick={() => { if (proxima) { mover(proxima).catch(() => undefined); } }}>
            {proxima || 'última coluna aberta'} →
          </button>
          <select aria-label="Mover para a coluna" style={{ ...campo, width: 'auto', minWidth: '200px' }} value="" disabled={!!gravando}
            onChange={e => { const destino = e.target.value as EtapaHomologacao; if (destino) { mover(destino).catch(() => undefined); } }}>
            <option value="">Mover para…</option>
            {ETAPAS_HOMOLOGACAO.filter(e => e.id !== 'Concluído' && e.id !== ciclo.etapa).map(e => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
          </select>
          <span style={ajuda}>Homologado / Reprovado: use “Concluir ciclo” abaixo.</span>
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: COR.texto2, margin: '6px 0' }}>Andamento</div>
      <ul style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.8 }}>
        {andamento.map(e => (
          <li key={e.texto}>
            <span style={{ fontWeight: 600 }}>{e.feito ? '✓ ' : ''}{e.texto}</span>
            <span style={{ color: COR.texto2 }}> — {e.detalhe}</span>
          </li>
        ))}
      </ul>

      <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px', marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
          <thead>
            <tr>
              <th style={celulaCabecalho}>Verificação</th>
              {aberto && <th style={celulaCabecalho}>O que o sistema encontrou</th>}
              <th style={celulaCabecalho}>OK</th>
              <th style={celulaCabecalho}>Data</th>
              <th style={celulaCabecalho}>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {VERIFICACOES_HOMOLOGACAO.map(v => {
              const s = sugestoes[v.id];
              const marcada = d.verificacoes[v.id];
              return (
                <tr key={v.id}>
                  <td style={celula}>
                    <div style={{ fontWeight: 600 }}>{v.rotulo}</div>
                    <div style={{ fontSize: '12px', color: COR.texto2 }}>{v.fonte}</div>
                  </td>
                  {aberto && (
                    <td style={celula}>
                      <Selo tom={TOM[s.situacao]}>{ROTULO[s.situacao]}</Selo>
                      <div style={{ fontSize: '12.5px', marginTop: '4px' }}>{s.texto}</div>
                    </td>
                  )}
                  <td style={celula}>
                    <input type="checkbox" aria-label={`OK: ${v.rotulo}`} disabled={somenteLeitura} checked={!!marcada && marcada.ok} onChange={e => mudarVerificacao(v.id, e.target.checked)} />
                  </td>
                  <td style={celula}>
                    {marcada && marcada.ok
                      ? (somenteLeitura
                        ? dataBr(marcada.data)
                        : <input type="date" aria-label={`Data: ${v.rotulo}`} style={{ ...campo, width: '150px' }} value={marcada.data}
                          onChange={e => mudar({ verificacoes: { ...d.verificacoes, [v.id]: { ...marcada, data: e.target.value } } })} />)
                      : '—'}
                  </td>
                  <td style={celula}>
                    {marcada && marcada.ok
                      ? (somenteLeitura
                        ? (marcada.responsavel || '—')
                        : <input aria-label={`Responsável: ${v.rotulo}`} style={{ ...campo, minWidth: '160px' }} value={marcada.responsavel}
                          onChange={e => mudar({ verificacoes: { ...d.verificacoes, [v.id]: { ...marcada, responsavel: e.target.value } } })} />)
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 14px' }}>
        <div>
          <label style={rotulo} htmlFor={`hm-risco-${ciclo.id}`}>Classificação de risco</label>
          <select id={`hm-risco-${ciclo.id}`} style={campo} disabled={somenteLeitura} value={d.classificacaoRisco} onChange={e => mudar({ classificacaoRisco: e.target.value as ClassificacaoRisco })}>
            {CLASSIFICACOES_RISCO.map(r => <option key={r} value={r}>{r || 'Não definida'}</option>)}
          </select>
          <div style={ajuda}>Natureza, porte e complexidade do fornecimento; porte, governança e tradição do fornecedor.</div>
        </div>
        <div>
          <label style={rotulo} htmlFor={`hm-resultado-${ciclo.id}`}>Resultado da homologação</label>
          <select id={`hm-resultado-${ciclo.id}`} style={campo} disabled={somenteLeitura} value={d.resultadoHomologacao} onChange={e => mudar({ resultadoHomologacao: e.target.value as ResultadoHomologacao })}>
            {RESULTADOS_HOMOLOGACAO.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {aberto && resultadoConclusivo(d.resultadoHomologacao) && statusDepois !== fornecedor.status && (
            <div style={ajuda}>Ao concluir, o status do cadastro muda para “{statusDepois}”.</div>
          )}
        </div>
        <div>
          <label style={rotulo} htmlFor={`hm-validade-${ciclo.id}`}>Validade do cadastro / próxima revisão</label>
          <input id={`hm-validade-${ciclo.id}`} type="date" style={campo} disabled={somenteLeitura} value={d.validadeCadastro} onChange={e => mudar({ validadeCadastro: e.target.value })} />
        </div>
      </div>

      <label style={rotulo} htmlFor={`hm-ressalvas-${ciclo.id}`}>Ressalvas, medidas de mitigação ou referência ao parecer</label>
      <textarea id={`hm-ressalvas-${ciclo.id}`} style={{ ...campo, resize: 'vertical' }} rows={3} disabled={somenteLeitura} value={d.ressalvas} onChange={e => mudar({ ressalvas: e.target.value })} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px 14px' }}>
        <div>
          <label style={rotulo} htmlFor={`hm-sup-${ciclo.id}`}>Responsável Suprimentos / data</label>
          <input id={`hm-sup-${ciclo.id}`} style={campo} disabled={somenteLeitura} value={d.responsavelSuprimentos} onChange={e => mudar({ responsavelSuprimentos: e.target.value })} placeholder="Nome — dd/mm/aaaa" />
        </div>
        <div>
          <label style={rotulo} htmlFor={`hm-jur-${ciclo.id}`}>Compliance / Jurídico (se acionado)</label>
          <input id={`hm-jur-${ciclo.id}`} style={campo} disabled={somenteLeitura} value={d.responsavelCompliance} onChange={e => mudar({ responsavelCompliance: e.target.value })} placeholder="Nome — dd/mm/aaaa" />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13.5px' }}>
        <input type="checkbox" disabled={somenteLeitura} checked={d.bancarioConferido} onChange={e => mudar({ bancarioConferido: e.target.checked })} />
        Dados bancários confirmados por contato telefônico independente (número obtido fora da ficha)
      </label>

      {!somenteLeitura && (
        <>
          <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={!!gravando} />
          {resultadoConclusivo(d.resultadoHomologacao) && problemaConclusao && <div style={{ ...ajuda, color: COR.indigo }}>{problemaConclusao}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button type="button" style={botao('secundario', !!gravando)} disabled={!!gravando} onClick={() => { setD(dadosDoCiclo(ciclo, fornecedor)); setMotivo(''); }}>Desfazer</button>
            <button type="button" style={botao('secundario', !!gravando || !motivo.trim())} disabled={!!gravando || !motivo.trim()}
              onClick={() => {
                executar('salvar', async () => {
                  await servico.salvarCiclo(ciclo, fornecedor, d, motivo, usuarioNome);
                  return 'Card salvo.';
                }).catch(() => undefined);
              }}>
              {gravando === 'salvar' ? 'Salvando…' : 'Salvar card'}
            </button>
            <button type="button" style={botao('principal', !!gravando || !motivo.trim() || !!problemaConclusao)} disabled={!!gravando || !motivo.trim() || !!problemaConclusao}
              title={problemaConclusao || undefined}
              onClick={() => {
                executar('concluir', async () => {
                  const status = await servico.concluirCiclo(ciclo, fornecedor, d, motivo, usuarioNome);
                  return `Ciclo ${ciclo.numero} concluído: ${d.resultadoHomologacao}. Status: ${status}.`;
                }).catch(() => undefined);
              }}>
              {gravando === 'concluir' ? 'Concluindo…' : 'Concluir ciclo'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Aba Homologação do fornecedor
// ------------------------------------------------------------

const HomologacaoFornecedorView: React.FC<{
  servico: FornecedoresService;
  fornecedor: IFornecedor;
  situacao: ISituacaoDocumental;
  administra: boolean;
  usuarioNome: string;
  aoAlterar: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, situacao, administra, usuarioNome, aoAlterar }) => {

  const [ciclos, setCiclos] = React.useState<ICicloHomologacao[] | undefined>(undefined);
  const [disponivel, setDisponivel] = React.useState(true);
  const [selecionado, setSelecionado] = React.useState<string>('');
  const [abrindo, setAbrindo] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const carregar = React.useCallback(async (): Promise<void> => {
    try {
      const r = await servico.listarCiclos(fornecedor.id);
      setDisponivel(r.disponivel);
      setCiclos(r.ciclos);
      setSelecionado(atual => {
        if (atual && r.ciclos.some(c => c.id === atual)) { return atual; }
        const aberto = cicloAberto(r.ciclos);
        return aberto ? aberto.id : (r.ciclos[0] ? r.ciclos[0].id : '');
      });
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor.id]);

  React.useEffect(() => {
    setCiclos(undefined);
    carregar().catch(() => undefined);
  }, [carregar]);

  const depoisDeAlterar = async (aviso?: string): Promise<void> => {
    await carregar();
    await aoAlterar(aviso);
  };

  if (!ciclos) {
    return erro ? <Aviso tipo="alerta">{erro}</Aviso> : <div style={{ padding: '20px', color: COR.texto2 }}>Carregando ciclos de homologação…</div>;
  }

  if (!disponivel) {
    return (
      <Aviso tipo="info">
        A tabela de ciclos de homologação ainda não existe no Dataverse. Rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1 e recarregue a página.
      </Aviso>
    );
  }

  const aberto = cicloAberto(ciclos);
  const ciclo = ciclos.filter(c => c.id === selecionado)[0];
  const legadoConcluido = ciclos.length === 0 && resultadoConclusivo(fornecedor.resultadoHomologacao);
  const motivoSugerido = ciclos.length > 0
    ? 'Renovação da homologação'
    : (MOTIVOS_CICLO.indexOf(fornecedor.tipoSolicitacao) >= 0 ? fornecedor.tipoSolicitacao : 'Cadastro inicial');

  const cards: ICardQuadro[] = ciclos.map(c => ({
    ciclo: c,
    titulo: `Ciclo ${c.numero}`,
    subtitulo: [c.motivo, c.concluidoEm ? `concluído ${dataBr(c.concluidoEm)}` : ''].filter(Boolean).join(' · ')
  }));

  return (
    <div>
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: '220px', fontSize: '13px', color: COR.texto2 }}>
          {aberto
            ? `Ciclo ${aberto.numero} em andamento. ${administra ? 'Arraste o card ou use os botões dele para mudar de coluna.' : ''}`
            : ciclos.length > 0 ? 'Nenhum ciclo em andamento.' : 'Nenhum ciclo de homologação registrado.'}
        </div>
        {administra && legadoConcluido && (
          <button type="button" style={botao('secundario')}
            onClick={() => {
              servico.registrarCicloAnterior(fornecedor, usuarioNome)
                .then(() => depoisDeAlterar('Homologação anterior registrada como ciclo 1.'))
                .catch(e => setErro(String((e as Error)?.message || e)));
            }}>
            Registrar a homologação atual como ciclo 1
          </button>
        )}
        {administra && !aberto && (
          <button type="button" style={botao('principal')} onClick={() => setAbrindo(true)}>Abrir ciclo</button>
        )}
      </div>

      {legadoConcluido && (
        <Aviso tipo="info">
          Este fornecedor foi homologado antes do kanban ({fornecedor.resultadoHomologacao}{fornecedor.validadeCadastro ? `, validade ${dataBr(fornecedor.validadeCadastro)}` : ''}).
          {administra ? ' Registre essa homologação como ciclo 1 para ela aparecer no histórico.' : ''}
        </Aviso>
      )}

      <QuadroKanban
        cards={cards}
        selecionado={selecionado}
        podeMover={administra}
        aoAbrir={c => setSelecionado(c.id)}
        aoSoltar={(c, destino) => {
          servico.moverCiclo(c, destino, usuarioNome)
            .then(() => depoisDeAlterar(`Ciclo ${c.numero} em "${destino}".`))
            .catch(e => setErro(String((e as Error)?.message || e)));
        }}
      />

      {ciclo && (
        <CardCiclo
          servico={servico}
          fornecedor={fornecedor}
          ciclo={ciclo}
          situacao={situacao}
          administra={administra}
          usuarioNome={usuarioNome}
          aoAlterar={depoisDeAlterar}
        />
      )}

      {abrindo && (
        <AbrirCicloModal
          motivoSugerido={motivoSugerido}
          fechar={() => setAbrindo(false)}
          confirmar={async (motivo, etapa) => {
            await servico.iniciarCiclo(fornecedor, ciclos, motivo, etapa, usuarioNome);
            setAbrindo(false);
            setSelecionado('');
            await depoisDeAlterar('Ciclo aberto.');
          }}
        />
      )}

      <div style={{ ...ajuda, marginTop: '12px' }}>O contrato é emitido só quando uma demanda fechar, assinado por Jurídico, Suprimentos, comprador e prestador.</div>
    </div>
  );
};

export default HomologacaoFornecedorView;
