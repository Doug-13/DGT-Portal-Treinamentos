import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IDefinicaoDashboard,
  Linha
} from '../../services/dashboards/dashboardModelo';

import {
  IContextoMontado,
  IMensagemAssistente,
  montarContextoDados,
  perguntarAoDashboard,
  perguntasSugeridas
} from '../../services/dashboards/assistenteDashboard';

// ============================================================
// CAIXA DE PERGUNTAS À IA (fim do dashboard)
//
// Só aparece quando a definição tem "assistente": { "ativo": true }.
// A IA recebe apenas os dados que o painel carregou (ano e áreas de
// quem está vendo) e responde dentro do escopo gravado no dashboard.
// A conversa existe só nesta tela: não é gravada no Dataverse nem no
// navegador. Ao sair da aba, trocar o filtro ou clicar em "Nova
// conversa", ela é descartada.
// ============================================================

export interface IAssistenteDashboardProps {
  // Sem id (ex.: pré-visualização antes de salvar) a caixa fica desligada.
  dashboardId?: string;
  definicao: IDefinicaoDashboard;
  dados: { [fonte: string]: Linha[] };
  dataverseService: DataverseService;
  ano?: number;
  areaNome?: string;
  // Área filtrada (o consumo da IA vai para ela; vazia = regra do plugin).
  areaId?: string;
}

const COR = {
  navy: '#0B1E2D',
  ciano: '#21BADC',
  texto: '#14232F',
  muted: '#6B7C8C',
  linha: '#E1E8EF',
  fundo: '#F4F7FA',
  erroFundo: '#FDECEA',
  erroTexto: '#A2352A'
};

const MAX_PERGUNTA = 1000;

const AssistenteDashboard: React.FC<IAssistenteDashboardProps> = (props) => {

  const [historico, setHistorico] = React.useState<IMensagemAssistente[]>([]);
  const [pergunta, setPergunta] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const fimRef = React.useRef<HTMLDivElement>(null);

  // Ao trocar ano ou área, os dados mudam: a conversa recomeça para a
  // IA não misturar números de filtros diferentes.
  React.useEffect(() => {
    setHistorico([]);
    setErro('');
  }, [props.ano, props.areaNome, props.dashboardId]);

  React.useEffect(() => {
    if (fimRef.current && historico.length > 0) {
      fimRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [historico.length, enviando]);

  const contexto: IContextoMontado = React.useMemo(
    () => montarContextoDados(props.definicao, props.dados, { ano: props.ano, areaNome: props.areaNome }),
    [props.definicao, props.dados, props.ano, props.areaNome]
  );

  const sugestoes = perguntasSugeridas(props.definicao.assistente);
  const desligado = !props.dashboardId;

  const enviar = async (texto: string): Promise<void> => {
    const limpa = texto.trim();
    if (!limpa || enviando || desligado) {
      return;
    }
    setErro('');
    setEnviando(true);
    setPergunta('');
    const anterior = historico;
    setHistorico(anterior.concat([{ papel: 'usuario', texto: limpa }]));
    try {
      const resposta = await perguntarAoDashboard(props.dataverseService, {
        dashboardId: props.dashboardId as string,
        pergunta: limpa,
        contexto,
        historico: anterior,
        modelo: props.definicao.assistente ? props.definicao.assistente.modelo : undefined,
        areaId: props.areaId
      });
      const cortada = resposta.parada === 'max_tokens' ? '\n\n(Resposta interrompida pelo limite de tamanho. Peça um resumo mais curto.)' : '';
      setHistorico(anterior.concat([
        { papel: 'usuario', texto: limpa },
        { papel: 'assistente', texto: (resposta.texto || 'A IA não retornou texto.') + cortada }
      ]));
    } catch (falha) {
      setHistorico(anterior);
      setPergunta(limpa);
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setEnviando(false);
    }
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      enviar(pergunta).catch(() => undefined);
    }
  };

  const balao = (mensagem: IMensagemAssistente, i: number): React.ReactNode => {
    const doUsuario = mensagem.papel === 'usuario';
    return (
      <div key={i} style={{ display: 'flex', justifyContent: doUsuario ? 'flex-end' : 'flex-start' }}>
        <div
          style={{
            maxWidth: '85%',
            padding: '10px 13px',
            borderRadius: doUsuario ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
            background: doUsuario ? COR.navy : COR.fundo,
            color: doUsuario ? '#FFFFFF' : COR.texto,
            fontSize: '13px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {mensagem.texto}
        </div>
      </div>
    );
  };

  return (
    <section
      className="dgt-assistente-dashboard"
      style={{
        marginTop: '24px',
        background: '#FFFFFF',
        borderRadius: '14px',
        boxShadow: '0 1px 3px rgba(11,30,45,.08),0 6px 18px rgba(11,30,45,.06)',
        padding: '16px 18px',
        borderTop: `4px solid ${COR.ciano}`
      }}
    >
      <style>{'@media print { .dgt-assistente-dashboard { display: none !important; } }'}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: COR.navy }}>Pergunte à IA sobre este painel</div>
          <div style={{ fontSize: '12px', color: COR.muted, marginTop: '2px' }}>
            As respostas usam somente os dados deste painel, com os filtros atuais. Confira os números antes de decisões importantes.
          </div>
        </div>
        {historico.length > 0 && (
          <button
            type="button"
            onClick={() => { setHistorico([]); setErro(''); }}
            disabled={enviando}
            style={{ border: `1px solid ${COR.linha}`, background: '#FFFFFF', color: COR.navy, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
          >
            Nova conversa
          </button>
        )}
      </div>

      {desligado && (
        <div style={{ marginTop: '12px', fontSize: '12.5px', color: COR.muted }}>
          Salve o dashboard para usar a IA (a pré-visualização não envia perguntas).
        </div>
      )}

      {!desligado && historico.length === 0 && sugestoes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {sugestoes.map(sugestao => (
            <button
              key={sugestao}
              type="button"
              onClick={() => { enviar(sugestao).catch(() => undefined); }}
              disabled={enviando}
              style={{ border: `1px solid ${COR.ciano}`, background: '#EAF8FC', color: COR.navy, borderRadius: '999px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
            >
              {sugestao}
            </button>
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {historico.map(balao)}
          {enviando && (
            <div style={{ fontSize: '12.5px', color: COR.muted, fontStyle: 'italic' }}>Analisando os dados do painel...</div>
          )}
          <div ref={fimRef} />
        </div>
      )}

      {historico.length === 0 && enviando && (
        <div style={{ marginTop: '12px', fontSize: '12.5px', color: COR.muted, fontStyle: 'italic' }}>Analisando os dados do painel...</div>
      )}

      {erro && (
        <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: COR.erroFundo, color: COR.erroTexto, fontSize: '12.5px' }}>
          {erro}
        </div>
      )}

      {!desligado && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'flex-end' }}>
          <textarea
            value={pergunta}
            onChange={e => setPergunta(e.target.value.substring(0, MAX_PERGUNTA))}
            onKeyDown={aoTeclar}
            placeholder="Ex.: quais áreas estão acima do orçado em despesas?"
            rows={2}
            disabled={enviando}
            style={{ flex: 1, resize: 'vertical', minHeight: '44px', padding: '9px 11px', borderRadius: '10px', border: `1px solid ${COR.linha}`, fontSize: '13px', fontFamily: 'inherit', color: COR.texto }}
          />
          <button
            type="button"
            onClick={() => { enviar(pergunta).catch(() => undefined); }}
            disabled={enviando || !pergunta.trim()}
            style={{ border: 0, background: enviando || !pergunta.trim() ? COR.muted : COR.navy, color: '#FFFFFF', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: enviando || !pergunta.trim() ? 'default' : 'pointer' }}
          >
            {enviando ? 'Enviando...' : 'Perguntar'}
          </button>
        </div>
      )}

      {!desligado && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: COR.muted }}>
          Base: {contexto.fontes.join(', ') || 'nenhuma fonte'} · {contexto.linhasEnviadas.toLocaleString('pt-BR')} linhas
          {contexto.resumido ? ' · valores somados no ano (detalhe mensal não coube)' : ''}
          {contexto.cortado ? ' · parte das linhas ficou de fora (use os filtros de área/ano)' : ''}
          {' · Enter envia, Shift+Enter quebra a linha · nada fica salvo.'}
        </div>
      )}
    </section>
  );
};

export default AssistenteDashboard;
