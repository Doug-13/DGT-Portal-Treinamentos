import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  DashboardService,
  IDashboard
} from '../../services/DashboardService';

import {
  IAcessoCriacao,
  IResultadoCriacao,
  fontesPermitidas,
  gerarDashboard
} from '../../services/dashboards/criacaoIa';

import DashboardPortalView from './DashboardPortalView';

// ============================================================
// ✦ CRIAR DASHBOARD COM IA (Indicadores)
//
// O usuário descreve o painel; a IA monta a definição usando SÓ as
// fontes que ele pode acessar; a prévia mostra os dados reais (que ele
// já poderia ver); ele refina conversando e salva como dashboard
// PESSOAL (só ele vê). Quem gerencia dashboards pode publicar depois.
// ============================================================

export interface ICriarDashboardIaModalProps {
  dataverseService: DataverseService;
  dashboardService: DashboardService;
  acesso: IAcessoCriacao;
  areas: Array<{ id: string; nome: string }>;
  areasPermitidas?: string[];
  // "Ajustar com IA" de um dashboard pessoal existente.
  existente?: IDashboard;
  onSalvo: (id: string) => void;
  onFechar: () => void;
}

const COR = { navy: '#0B1E2D', ciano: '#21BADC', muted: '#6B7C8C', linha: '#E1E8EF', fundo: '#F4F7FA' };

// Sugestões conforme as fontes liberadas.
const EXEMPLOS: Array<{ prefixo: string; texto: string }> = [
  { prefixo: 'treinamentos.', texto: 'Execução dos treinamentos do meu time: concluídos, atrasados por pessoa e o que vence nos próximos 30 dias.' },
  { prefixo: 'documentos.', texto: 'Documentos da minha área com revisão vencida ou vencendo e o andamento das revisões.' },
  { prefixo: 'orcamento.', texto: 'Orçado × executado da minha área no ano, com EBITDA mês a mês e as contas com maior desvio.' },
  { prefixo: 'ambientes.', texto: 'Solicitações abertas nos ambientes: etapas atrasadas e tempo médio até concluir.' },
  { prefixo: 'licitacoes.', texto: 'Editais acompanhados por órgão e modalidade, com o valor estimado total.' }
];

const botao: React.CSSProperties = { padding: '8px 14px', borderRadius: '8px', border: `1px solid ${COR.linha}`, background: '#FFFFFF', fontSize: '12.5px', cursor: 'pointer', fontWeight: 600 };
const botaoPrimario: React.CSSProperties = { ...botao, border: 0, background: COR.navy, color: '#FFFFFF' };
const caixaTexto: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COR.linha}`, fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' };

const CriarDashboardIaModal: React.FC<ICriarDashboardIaModalProps> = (props) => {

  const catalogo = React.useMemo(() => fontesPermitidas(props.acesso), [props.acesso]);
  const exemplos = EXEMPLOS.filter(exemplo => catalogo.some(fonte => fonte.id.indexOf(exemplo.prefixo) === 0)).slice(0, 3);

  const [pedido, setPedido] = React.useState('');
  const [ajuste, setAjuste] = React.useState('');
  const [resultado, setResultado] = React.useState<IResultadoCriacao | undefined>(undefined);
  const [versao, setVersao] = React.useState(0);
  const [historico, setHistorico] = React.useState<string[]>([]);
  const [nome, setNome] = React.useState(props.existente ? props.existente.nome : '');
  const [gerando, setGerando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const painelBase = resultado ? resultado.texto : (props.existente ? props.existente.definicao : '');

  const gerar = async (texto: string, ajustar: boolean): Promise<void> => {
    const limpo = texto.trim();
    if (!limpo || gerando) {
      return;
    }
    setGerando(true);
    setErro('');
    try {
      const novo = await gerarDashboard(props.dataverseService, {
        pedido: limpo,
        catalogo,
        painelAtual: ajustar ? painelBase : undefined
      });
      setResultado(novo);
      setVersao(atual => atual + 1);
      setHistorico(atual => atual.concat([limpo]));
      if (!nome.trim() || (!props.existente && !ajustar)) {
        setNome(novo.definicao.titulo.substring(0, 200));
      }
      setAjuste('');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setGerando(false);
    }
  };

  const salvar = async (): Promise<void> => {
    if (!resultado || salvando) {
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const existente = props.existente;
      const id = await props.dashboardService.salvar({
        id: existente ? existente.id : undefined,
        nome: (nome || resultado.definicao.titulo).trim().substring(0, 200),
        url: '',
        descricao: (resultado.resumo || resultado.definicao.descricao || '').substring(0, 500),
        ordem: existente ? existente.ordem : 900,
        altura: existente ? existente.altura : 760,
        publico: existente ? existente.publico : 'Todos',
        ativo: true,
        tipo: 'Portal',
        definicao: resultado.texto,
        areas: existente ? existente.areas : [],
        pessoal: existente ? existente.pessoal : true
      });
      props.onSalvo(id);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
      setSalvando(false);
    }
  };

  const ajustando = !!resultado || !!props.existente;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Criar dashboard com IA"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '28px 16px', overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: '1280px', background: COR.fundo, borderRadius: '14px', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 22px', background: '#FFFFFF', borderBottom: `1px solid ${COR.linha}` }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: COR.navy }}>{props.existente ? `✦ Ajustar “${props.existente.nome}” com IA` : '✦ Criar dashboard com IA'}</h3>
            <div style={{ fontSize: '12.5px', color: COR.muted, marginTop: '3px' }}>
              Descreva o que você quer acompanhar. O painel usa só os dados que você já pode ver e fica salvo como pessoal.
            </div>
          </div>
          <button type="button" style={botao} onClick={props.onFechar} disabled={salvando}>Fechar</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {catalogo.length === 0 && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#FDECEA', color: '#A2352A', fontSize: '13px' }}>
              Você não tem acesso a nenhuma fonte de dados para dashboards. Fale com o administrador do portal.
            </div>
          )}

          {catalogo.length > 0 && !ajustando && (
            <>
              <textarea
                rows={3}
                value={pedido}
                maxLength={2000}
                onChange={e => setPedido(e.target.value)}
                placeholder="Ex.: execução dos treinamentos do meu time, com atrasados por pessoa e o que vence no mês"
                style={caixaTexto}
                disabled={gerando}
              />
              {exemplos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  {exemplos.map(exemplo => (
                    <button
                      key={exemplo.prefixo}
                      type="button"
                      disabled={gerando}
                      onClick={() => setPedido(exemplo.texto)}
                      style={{ border: `1px solid ${COR.ciano}`, background: '#EAF8FC', color: COR.navy, borderRadius: '999px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {exemplo.texto}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button type="button" style={botaoPrimario} disabled={gerando || !pedido.trim()} onClick={() => { gerar(pedido, false).catch(() => undefined); }}>
                  {gerando ? 'Montando o painel...' : '✦ Criar painel'}
                </button>
                <span style={{ fontSize: '11.5px', color: COR.muted }}>
                  Dados disponíveis para você: {catalogo.map(fonte => fonte.nome).join(' · ')}
                </span>
              </div>
            </>
          )}

          {ajustando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {resultado && (resultado.resumo || resultado.semDados.length > 0) && (
                <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '12px 14px', borderLeft: `4px solid ${COR.ciano}`, fontSize: '13px', color: '#334155' }}>
                  {resultado.resumo && <div style={{ whiteSpace: 'pre-wrap' }}>{resultado.resumo}</div>}
                  {resultado.semDados.length > 0 && (
                    <div style={{ marginTop: resultado.resumo ? '8px' : 0, padding: '8px 10px', borderRadius: '8px', background: '#FFF4D6', color: '#7A5600', fontSize: '12.5px' }}>
                      <strong>Ficou de fora (não há esse dado no portal):</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>{resultado.semDados.map(item => <li key={item}>{item}</li>)}</ul>
                    </div>
                  )}
                  {historico.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: COR.muted }}>Pedidos: {historico.map(item => `“${item}”`).join(' → ')}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <textarea
                  rows={2}
                  value={ajuste}
                  maxLength={2000}
                  onChange={e => setAjuste(e.target.value)}
                  placeholder="Peça um ajuste: “tire a aba de trilhas”, “mostre só os 10 maiores atrasos”, “inclua uma aba de certificados”…"
                  style={{ ...caixaTexto, flex: '1 1 420px' }}
                  disabled={gerando || salvando}
                />
                <button type="button" style={botao} disabled={gerando || salvando || !ajuste.trim()} onClick={() => { gerar(ajuste, true).catch(() => undefined); }}>
                  {gerando ? 'Ajustando...' : 'Ajustar'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: '#FFFFFF', borderRadius: '12px', padding: '10px 12px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: COR.navy, display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px' }}>
                  Nome da aba
                  <input value={nome} maxLength={200} onChange={e => setNome(e.target.value)} style={{ ...caixaTexto, padding: '7px 10px' }} disabled={salvando} />
                </label>
                <button type="button" style={botaoPrimario} disabled={!resultado || gerando || salvando || !nome.trim()} onClick={() => { salvar().catch(() => undefined); }}>
                  {salvando ? 'Salvando...' : props.existente ? 'Salvar alterações' : 'Salvar em Meus dashboards'}
                </button>
              </div>
            </div>
          )}

          {gerando && (
            <div style={{ marginTop: '12px', fontSize: '12.5px', color: COR.muted, fontStyle: 'italic' }}>
              A IA está montando o painel com os dados disponíveis para você. Isso pode levar até um minuto.
            </div>
          )}

          {erro && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: '#FDECEA', color: '#A2352A', fontSize: '13px', whiteSpace: 'pre-line' }}>{erro}</div>
          )}
        </div>

        {resultado && (
          <div style={{ padding: '0 22px 22px' }}>
            <div style={{ fontSize: '11.5px', color: COR.muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 700 }}>
              Prévia com os seus dados{resultado.correcoes > 0 ? ' · a IA corrigiu o painel automaticamente' : ''}
            </div>
            <DashboardPortalView
              key={versao}
              definicao={resultado.definicao}
              dataverseService={props.dataverseService}
              areas={props.areas}
              areasPermitidas={props.areasPermitidas}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CriarDashboardIaModal;
