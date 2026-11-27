import * as React from 'react';

import { DataverseService } from '../../services/DataverseService';
import {
  IEnvioCigam,
  andamentoEnvio,
  envioQueBloqueia,
  horaCurta,
  lancarBomNoCigam,
  lerEnviosCigam
} from '../../services/bom/envioCigam';
import { COR, botao, cartao } from './arquiteturaComum';

// ============================================================
// LANÇAR NO CIGAM (Homologação)
//
// Painel aberto pelo botão "Lançar no CIGAM" da etapa B.O.M. pronto.
// Só para B.O.M. enviado para aprovação (lista congelada), sem item
// sem código e sem item sem preço. O cliente vem da demanda; o
// representante, a unidade, o controle e a previsão são informados aqui.
//
// Estados do painel:
//   formulário ...... nunca lançado (ou última tentativa recusada)
//   enviando ........ aguardando a resposta da MAAX (não fecha)
//   processando ..... recebido: o CIGAM trabalha em segundo plano;
//                     barra com a previsão de término (estimada)
//   já lançado ...... concluído pela previsão; lançar de novo só
//                     marcando "Preciso lançar de novo" + justificativa
//
// A proteção definitiva contra duplicidade está no plugin
// (EnviarBomCigamPlugin trava a linha do B.O.M.); o painel só evita
// o clique repetido e deixa claro o que está acontecendo.
// ============================================================

export interface ILancarCigamPainelProps {
  dataverseService?: DataverseService;
  bomId: string;
  numero: string;
  revisao: string;
  clienteCigam: string;
  prazoEntrega?: string;
  linhas: number;
  semCodigo: number;
  semPreco: number;
  enviado: boolean;
  // B.O.M. com fluxo: o lançamento é feito pela tarefa do fluxo depois
  // da aprovação. O painel só mostra o andamento e os lançamentos.
  somenteConsulta?: boolean;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}

const moeda = (v: number): string =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const hojeIso = (): string => {
  const d = new Date();
  const dois = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

const SITUACAO: Record<string, { texto: string; cor: string }> = {
  recebido: { texto: 'Recebido pela MAAX', cor: '#107C10' },
  indeterminado: { texto: 'Sem resposta (confira no CIGAM)', cor: '#B45309' },
  recusado: { texto: 'Recusado', cor: '#B42318' }
};

// Barra de andamento (estimado) de um envio recebido.
const Andamento: React.FC<{ envio: IEnvioCigam; agora: Date }> = ({ envio, agora }) => {
  const a = andamentoEnvio(envio, agora);
  const restante = Math.max(0, Math.ceil((a.terminoPrevisto.getTime() - agora.getTime()) / 1000));
  const min = Math.floor(restante / 60);
  const seg = restante % 60;
  return (
    <div style={{ marginTop: '12px', background: a.emProcessamento ? '#E8F2FF' : '#E7F6EC', border: `1px solid ${a.emProcessamento ? '#0F6CBD' : '#107C10'}`, borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: COR.azul }}>
      <strong style={{ color: a.emProcessamento ? '#0F6CBD' : '#107C10' }}>
        {a.emProcessamento ? '⏳ O CIGAM está criando a oportunidade e o pedido…' : '✓ Pelo tempo previsto, o CIGAM já deve ter concluído.'}
      </strong>
      <div style={{ marginTop: '4px' }}>
        Enviado às {horaCurta(new Date(envio.em))} · {envio.itens} item(ns) · {moeda(envio.valorTotal)} ·
        {a.emProcessamento
          ? ` previsão de término às ${horaCurta(a.terminoPrevisto)} (faltam ${min > 0 ? `${min} min ` : ''}${seg} s).`
          : ` término previsto às ${horaCurta(a.terminoPrevisto)}.`}
      </div>
      <div style={{ height: '8px', background: '#fff', borderRadius: '4px', marginTop: '8px', overflow: 'hidden', border: `1px solid ${COR.borda}` }}>
        <div style={{ width: `${a.percentual}%`, height: '100%', background: a.emProcessamento ? '#0F6CBD' : '#107C10', transition: 'width 1s linear' }} />
      </div>
      <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '6px' }}>
        O tempo é uma estimativa (cerca de 10 s por item): a MAAX ainda não devolve o número da oportunidade e do pedido ao portal.
        Para confirmar, consulte o CIGAM de Homologação (Vendas/CRM, oportunidades do cliente). Você pode fechar esta janela; o CIGAM continua trabalhando.
      </div>
    </div>
  );
};

const LancarCigamPainel: React.FC<ILancarCigamPainelProps> = (props) => {
  const { dataverseService, bomId, numero, revisao, clienteCigam, linhas, semCodigo, semPreco, enviado, aoFechar, aoConcluir } = props;
  const somenteConsulta = !!props.somenteConsulta;

  const previsaoInicial = props.prazoEntrega && props.prazoEntrega.substring(0, 10) >= hojeIso()
    ? props.prazoEntrega.substring(0, 10)
    : '';

  const [envios, setEnvios] = React.useState<IEnvioCigam[] | undefined>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [representante, setRepresentante] = React.useState('');
  const [unidade, setUnidade] = React.useState('001');
  const [controle, setControle] = React.useState('NA');
  const [previsao, setPrevisao] = React.useState(previsaoInicial);
  const [relancar, setRelancar] = React.useState(false);
  const [justificativa, setJustificativa] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [recemEnviado, setRecemEnviado] = React.useState<IEnvioCigam | undefined>(undefined);
  const [agora, setAgora] = React.useState(new Date());

  // Impede um segundo envio antes de o React redesenhar o botão.
  const emEnvio = React.useRef(false);
  // Em funções separadas: atribuir emEnvio.current depois de um await
  // dispara a regra require-atomic-updates do lint.
  const ocupar = (): void => { emEnvio.current = true; };
  const liberar = (): void => { emEnvio.current = false; };

  const recarregar = async (): Promise<IEnvioCigam[] | undefined> => {
    if (!dataverseService) {
      return [];
    }
    const lista = await lerEnviosCigam(dataverseService, bomId);
    setEnvios(lista);
    return lista;
  };

  React.useEffect(() => {
    if (!dataverseService) {
      setCarregando(false);
      return;
    }
    recarregar()
      .then(lista => {
        const ultimo = lista && lista.length ? lista[lista.length - 1] : undefined;
        if (ultimo) {
          setRepresentante(ultimo.representante || '');
          setUnidade(ultimo.unidadeNegocio || '001');
          setControle(ultimo.controle || 'NA');
        }
      })
      .then(() => setCarregando(false))
      .catch(e => { setErro(e instanceof Error ? e.message : String(e)); setCarregando(false); });
  }, [dataverseService, bomId]);

  const bloqueio = envios ? envioQueBloqueia(envios) : undefined;
  const acompanhado = recemEnviado || bloqueio;
  const processando = !!acompanhado && andamentoEnvio(acompanhado, agora).emProcessamento;

  // Relógio só enquanto há envio em processamento.
  React.useEffect(() => {
    if (!acompanhado || !andamentoEnvio(acompanhado).emProcessamento) {
      return undefined;
    }
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(relogio);
  }, [acompanhado]);

  const impedimentos = [
    !dataverseService ? 'Conexão com o Dataverse indisponível.' : '',
    envios === undefined ? 'Integração não instalada: execute scripts/dataverse/criar-integracao-bom-cigam.ps1.' : '',
    !enviado ? 'Envie o B.O.M. para aprovação antes: só a lista congelada pode ser lançada.' : '',
    !clienteCigam.trim() ? 'A demanda não tem o código do cliente no CIGAM (cadastro da demanda).' : '',
    semCodigo ? `${semCodigo} item(ns) sem código no CIGAM.` : '',
    semPreco ? `${semPreco} item(ns) sem valor do CIGAM.` : ''
  ].filter(Boolean);

  const camposOk = !!representante.trim() && !!unidade.trim() && !!controle.trim() && !!previsao && previsao >= hojeIso();
  const justificativaOk = !bloqueio || (relancar && justificativa.trim().length >= 10);
  const mostrarFormulario = !somenteConsulta && !recemEnviado && !processando && (!bloqueio || relancar);
  const podeEnviar = !carregando && !enviando && mostrarFormulario && impedimentos.length === 0 && camposOk && justificativaOk;

  const lancar = async (): Promise<void> => {
    if (!dataverseService || !podeEnviar || emEnvio.current) {
      return;
    }
    const minutos = Math.max(1, Math.round((linhas * 10 + 10) / 60));
    const ok = window.confirm(
      `Lançar o BOM ${numero} ${revisao} no CIGAM (Homologação)?\n\n` +
      `Serão criados uma oportunidade e um pedido de venda com ${linhas} linha(s). ` +
      `O CIGAM leva cerca de ${minutos} min para concluir.` +
      (bloqueio ? '\n\nATENÇÃO: este B.O.M. já foi lançado. Este novo lançamento cria OUTRA oportunidade e OUTRO pedido.' : '')
    );
    if (!ok) {
      return;
    }
    ocupar();
    setEnviando(true);
    setErro('');
    try {
      const r = await lancarBomNoCigam(dataverseService, bomId, {
        representante, unidadeNegocio: unidade, controle, previsaoVenda: previsao,
        reenviar: !!bloqueio && relancar, justificativa
      });
      if (r.jaEnviado) {
        // Outro lançamento (outra aba, outra pessoa ou o fluxo) chegou antes.
        setErro(r.mensagem || 'Este B.O.M. já foi lançado no CIGAM.');
      } else if (r.ultimo && r.ultimo.situacao === 'recusado') {
        setErro(r.ultimo.mensagem);
      } else if (r.ultimo) {
        setRecemEnviado(r.ultimo);
        setAgora(new Date());
        setRelancar(false);
        setJustificativa('');
      }
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      liberar();
      setEnviando(false);
    }
  };

  const fechar = (): void => {
    if (enviando) {
      return;
    }
    if (recemEnviado) {
      aoConcluir(`BOM ${numero} ${revisao} enviado ao CIGAM; término previsto às ${horaCurta(andamentoEnvio(recemEnviado).terminoPrevisto)}.`);
      return;
    }
    aoFechar();
  };

  const rotulo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, color: COR.texto2, marginBottom: '4px' };
  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${COR.borda}`, borderRadius: '8px', fontSize: '13px', color: COR.azul };

  return (
    <div role="dialog" aria-modal="true" aria-label="Lançar no CIGAM"
      style={{ position: 'fixed', inset: 0, background: 'rgba(32,42,68,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ ...cartao, width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', marginBottom: 0 }}>
        <h3 style={{ margin: '0 0 4px', color: COR.azul }}>Lançar no CIGAM · Homologação</h3>
        <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: COR.texto2 }}>
          BOM {numero} {revisao} · {linhas} linha(s) da lista congelada · cliente CIGAM {clienteCigam || '—'}.
          Cria a oportunidade e o pedido de venda com os itens; o número gerado não volta ao portal nesta versão.
        </p>

        {carregando && <div style={{ fontSize: '13px', color: COR.texto2 }}>Verificando lançamentos anteriores…</div>}

        {/* Enviado nesta abertura ou já em processamento */}
        {!carregando && acompanhado && (recemEnviado || processando) && <Andamento envio={acompanhado} agora={agora} />}

        {/* Já lançado e concluído (pela previsão): relançar é exceção */}
        {!carregando && somenteConsulta && (
          <div style={{ marginTop: '4px', background: '#E8F2FF', border: '1px solid #0F6CBD', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: COR.azul }}>
            Este B.O.M. segue o fluxo de aprovação: o lançamento no CIGAM é feito pela tarefa <strong>Lançar no CIGAM</strong>, automaticamente, depois da aprovação.
            {bloqueio ? ' Abaixo, o andamento e o histórico.' : ' Ainda não há lançamento.'}
          </div>
        )}

        {!carregando && !somenteConsulta && bloqueio && !recemEnviado && !processando && (
          <div style={{ marginTop: '4px', background: '#FFF4E5', border: '1px solid #B45309', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: COR.azul }}>
            <strong style={{ color: '#B45309' }}>Este B.O.M. já foi lançado em {new Date(bloqueio.em).toLocaleString('pt-BR')}.</strong>{' '}
            Confira a oportunidade e o pedido no CIGAM antes de qualquer novo lançamento.
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={relancar} onChange={e => setRelancar(e.target.checked)} style={{ marginTop: '2px' }} />
              <span>Preciso lançar de novo — sei que isso cria <strong>outra</strong> oportunidade e <strong>outro</strong> pedido no CIGAM (o anterior não é alterado nem removido).</span>
            </label>
            {relancar && (
              <label style={{ display: 'block', marginTop: '8px' }}><span style={rotulo}>Justificativa do novo lançamento * (mín. 10 caracteres)</span>
                <textarea style={{ ...campo, minHeight: '60px' }} value={justificativa} maxLength={500} onChange={e => setJustificativa(e.target.value)} /></label>
            )}
          </div>
        )}

        {!carregando && mostrarFormulario && (
          <>
            {impedimentos.length > 0 && (
              <div style={{ background: '#FDECEC', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#B42318', margin: '12px 0' }}>
                {impedimentos.map((t, i) => <div key={i}>• {t}</div>)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '12px' }}>
              <label><span style={rotulo}>Representante *</span>
                <input style={campo} value={representante} maxLength={30} disabled={enviando} onChange={e => setRepresentante(e.target.value)} placeholder="código CIGAM" /></label>
              <label><span style={rotulo}>Unidade de negócio *</span>
                <input style={campo} value={unidade} maxLength={30} disabled={enviando} onChange={e => setUnidade(e.target.value)} /></label>
              <label><span style={rotulo}>Controle *</span>
                <input style={campo} value={controle} maxLength={10} disabled={enviando} onChange={e => setControle(e.target.value.toUpperCase())} /></label>
              <label><span style={rotulo}>Previsão de venda *</span>
                <input style={campo} type="date" min={hojeIso()} value={previsao} disabled={enviando} onChange={e => setPrevisao(e.target.value)} /></label>
            </div>
            <p style={{ fontSize: '11.5px', color: COR.texto2, margin: '6px 0 0' }}>
              O controle precisa estar com “Publicar dados na web” no CIGAM (na Homologação, NA funciona).
            </p>
          </>
        )}

        {enviando && (
          <div role="status" style={{ marginTop: '12px', background: '#E8F2FF', border: '1px solid #0F6CBD', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#0F6CBD', fontWeight: 700 }}>
            ⏳ Enviando o B.O.M. à MAAX… não feche esta janela nem clique de novo.
          </div>
        )}

        {erro && <div role="alert" style={{ marginTop: '12px', whiteSpace: 'pre-line', background: '#FDECEC', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#B42318' }}>{erro}</div>}

        {envios && envios.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div style={rotulo}>Lançamentos deste B.O.M.</div>
            {envios.slice().reverse().map((e, i) => (
              <div key={i} style={{ fontSize: '12.5px', color: COR.azul, padding: '6px 0', borderBottom: `1px dashed ${COR.borda}` }}>
                <strong style={{ color: (SITUACAO[e.situacao] || SITUACAO.recusado).cor }}>{(SITUACAO[e.situacao] || SITUACAO.recusado).texto}</strong>
                {' · '}{new Date(e.em).toLocaleString('pt-BR')} · {e.itens} item(ns) · {moeda(e.valorTotal)} · {e.ambiente}
                <div style={{ color: COR.texto2 }}>{e.mensagem}{e.justificativa ? ` · Justificativa: ${e.justificativa}` : ''}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', flexWrap: 'wrap' }}>
          <button type="button" style={botao('secundario', enviando)} disabled={enviando} onClick={fechar}>
            {somenteConsulta || recemEnviado || (bloqueio && !relancar) ? 'Fechar' : 'Cancelar'}
          </button>
          {mostrarFormulario && (
            <button type="button" style={botao('principal', !podeEnviar)} disabled={!podeEnviar} onClick={() => { lancar().catch(() => undefined); }}>
              {enviando ? 'Enviando…' : bloqueio ? 'Lançar de novo' : 'Lançar no CIGAM'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LancarCigamPainel;
