import * as React from 'react';

import { DataverseService } from '../../services/DataverseService';
import {
  IEnvioCigam,
  envioQueBloqueia,
  lancarBomNoCigam,
  lerEnviosCigam
} from '../../services/bom/envioCigam';
import { COR, botao, cartao, formatarData } from './arquiteturaComum';

// ============================================================
// LANÇAR NO CIGAM (Homologação)
//
// Painel aberto pelo botão "Lançar no CIGAM" da etapa B.O.M. pronto.
// Só para B.O.M. enviado para aprovação (lista congelada), sem item
// sem código e sem item sem preço. O cliente vem da demanda; o
// representante, a unidade, o controle e a previsão são informados
// aqui. Um segundo lançamento exige justificativa, porque cada
// chamada cria outra oportunidade e outro pedido no CIGAM.
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

const LancarCigamPainel: React.FC<ILancarCigamPainelProps> = (props) => {
  const { dataverseService, bomId, numero, revisao, clienteCigam, linhas, semCodigo, semPreco, enviado, aoFechar, aoConcluir } = props;

  const previsaoInicial = props.prazoEntrega && props.prazoEntrega.substring(0, 10) >= hojeIso()
    ? props.prazoEntrega.substring(0, 10)
    : '';

  const [envios, setEnvios] = React.useState<IEnvioCigam[] | undefined>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [representante, setRepresentante] = React.useState('');
  const [unidade, setUnidade] = React.useState('001');
  const [controle, setControle] = React.useState('NA');
  const [previsao, setPrevisao] = React.useState(previsaoInicial);
  const [justificativa, setJustificativa] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!dataverseService) {
      setCarregando(false);
      return;
    }
    lerEnviosCigam(dataverseService, bomId)
      .then(lista => {
        setEnvios(lista);
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

  const impedimentos = [
    !dataverseService ? 'Conexão com o Dataverse indisponível.' : '',
    envios === undefined ? 'Integração não instalada: execute scripts/dataverse/criar-integracao-bom-cigam.ps1.' : '',
    !enviado ? 'Envie o B.O.M. para aprovação antes: só a lista congelada pode ser lançada.' : '',
    !clienteCigam.trim() ? 'A demanda não tem o código do cliente no CIGAM (cadastro da demanda).' : '',
    semCodigo ? `${semCodigo} item(ns) sem código no CIGAM.` : '',
    semPreco ? `${semPreco} item(ns) sem valor do CIGAM.` : ''
  ].filter(Boolean);

  const camposOk = !!representante.trim() && !!unidade.trim() && !!controle.trim() && !!previsao && previsao >= hojeIso();
  const justificativaOk = !bloqueio || justificativa.trim().length >= 10;
  const podeEnviar = !carregando && !enviando && impedimentos.length === 0 && camposOk && justificativaOk;

  const lancar = async (): Promise<void> => {
    if (!dataverseService || !podeEnviar) {
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
    setEnviando(true);
    setErro('');
    try {
      const r = await lancarBomNoCigam(dataverseService, bomId, {
        representante, unidadeNegocio: unidade, controle, previsaoVenda: previsao,
        reenviar: !!bloqueio, justificativa
      });
      if (r.jaEnviado) {
        setErro(r.mensagem || 'Este B.O.M. já foi lançado no CIGAM.');
      } else if (r.ultimo && r.ultimo.situacao === 'recusado') {
        setErro(r.ultimo.mensagem);
      } else {
        aoConcluir(r.ultimo ? r.ultimo.mensagem : 'Lançamento enviado ao CIGAM.');
        return;
      }
      setEnvios(await lerEnviosCigam(dataverseService, bomId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
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

        {impedimentos.length > 0 && (
          <div style={{ background: '#FDECEC', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#B42318', marginBottom: '12px' }}>
            {impedimentos.map((t, i) => <div key={i}>• {t}</div>)}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <label><span style={rotulo}>Representante *</span>
            <input style={campo} value={representante} maxLength={30} onChange={e => setRepresentante(e.target.value)} placeholder="código CIGAM" /></label>
          <label><span style={rotulo}>Unidade de negócio *</span>
            <input style={campo} value={unidade} maxLength={30} onChange={e => setUnidade(e.target.value)} /></label>
          <label><span style={rotulo}>Controle *</span>
            <input style={campo} value={controle} maxLength={10} onChange={e => setControle(e.target.value.toUpperCase())} /></label>
          <label><span style={rotulo}>Previsão de venda *</span>
            <input style={campo} type="date" min={hojeIso()} value={previsao} onChange={e => setPrevisao(e.target.value)} /></label>
        </div>
        <p style={{ fontSize: '11.5px', color: COR.texto2, margin: '6px 0 0' }}>
          O controle precisa estar com “Publicar dados na web” no CIGAM (na Homologação, NA funciona).
        </p>

        {bloqueio && (
          <div style={{ marginTop: '12px', background: '#FFF4E5', border: '1px solid #B45309', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: COR.azul }}>
            <strong style={{ color: '#B45309' }}>Já lançado em {formatarData(bloqueio.em.substring(0, 10))}.</strong> Um novo lançamento cria outra oportunidade e outro pedido; o anterior não é alterado.
            <label style={{ display: 'block', marginTop: '8px' }}><span style={rotulo}>Justificativa do novo lançamento * (mín. 10 caracteres)</span>
              <textarea style={{ ...campo, minHeight: '60px' }} value={justificativa} maxLength={500} onChange={e => setJustificativa(e.target.value)} /></label>
          </div>
        )}

        {erro && <div role="alert" style={{ marginTop: '12px', whiteSpace: 'pre-line', background: '#FDECEC', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#B42318' }}>{erro}</div>}

        {envios && envios.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div style={rotulo}>Lançamentos anteriores</div>
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
          <button type="button" style={botao('secundario', enviando)} disabled={enviando} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('principal', !podeEnviar)} disabled={!podeEnviar} onClick={() => { lancar().catch(() => undefined); }}>
            {enviando ? 'Lançando…' : bloqueio ? 'Lançar de novo' : 'Lançar no CIGAM'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LancarCigamPainel;
