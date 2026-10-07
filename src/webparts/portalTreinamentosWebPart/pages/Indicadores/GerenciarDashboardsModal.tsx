import * as React from 'react';

import {
  ALTURA_PADRAO,
  analisarLink,
  DashboardService,
  IDashboard,
  IDashboardEdicao,
  PublicoDashboard
} from '../../services/DashboardService';

export interface IGerenciarDashboardsModalProps {
  service: DashboardService;
  dashboards: IDashboard[];
  onFechar: () => void;
  onAlterado: () => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: '1px solid #d8dee8',
  borderRadius: '8px',
  background: '#fff',
  marginTop: '5px',
  fontSize: '13px'
};

const botao: React.CSSProperties = {
  padding: '8px 13px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600
};

const botaoPrimario: React.CSSProperties = {
  ...botao,
  border: 'none',
  background: '#1f4e96',
  color: '#fff'
};

const vazio = (ordem: number): IDashboardEdicao => ({
  nome: '',
  url: '',
  descricao: '',
  ordem,
  altura: ALTURA_PADRAO,
  publico: 'Todos',
  ativo: true
});

const GerenciarDashboardsModal: React.FC<IGerenciarDashboardsModalProps> = props => {

  const proximaOrdem =
    props.dashboards.length > 0
      ? Math.max(...props.dashboards.map(d => d.ordem)) + 10
      : 10;

  const [edicao, setEdicao] = React.useState<IDashboardEdicao | undefined>(undefined);
  const [processando, setProcessando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [previa, setPrevia] = React.useState(false);

  const link = edicao ? analisarLink(edicao.url) : undefined;

  const executar = async (acao: () => Promise<void>): Promise<void> => {
    setErro('');
    setProcessando(true);
    try {
      await acao();
      await props.onAlterado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar o dashboard.');
    } finally {
      setProcessando(false);
    }
  };

  const salvar = (): void => {
    if (!edicao) return;
    executar(async () => {
      await props.service.salvar(edicao);
      setEdicao(undefined);
      setPrevia(false);
    }).catch((e: unknown) => console.error(e));
  };

  const alterar = <K extends keyof IDashboardEdicao>(campo: K, valor: IDashboardEdicao[K]): void => {
    setEdicao(atual => (atual ? { ...atual, [campo]: valor } : atual));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '980px',
          background: '#fff',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0b1f3a' }}>Gerenciar dashboards</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Cada dashboard vira uma aba na página Indicadores.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!edicao && (
              <button type="button" style={botaoPrimario} onClick={() => { setErro(''); setEdicao(vazio(proximaOrdem)); }}>
                + Novo dashboard
              </button>
            )}
            <button type="button" style={botao} onClick={props.onFechar}>Fechar</button>
          </div>
        </div>

        {erro && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#fde7e9', color: '#a4262c', fontSize: '13px' }}>
            {erro}
          </div>
        )}

        {/* ===================== FORMULÁRIO ===================== */}
        {edicao && (
          <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <strong style={{ fontSize: '14px', color: '#0b1f3a' }}>
              {edicao.id ? 'Editar dashboard' : 'Novo dashboard'}
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '13px' }}>Nome da aba *</label>
                <input
                  value={edicao.nome}
                  maxLength={200}
                  placeholder="Ex.: Conformidade por área"
                  onChange={e => alterar('nome', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px' }}>Quem vê</label>
                <select
                  value={edicao.publico}
                  onChange={e => alterar('publico', e.target.value as PublicoDashboard)}
                  style={inputStyle}
                >
                  <option value="Todos">Todos</option>
                  <option value="Gestor">Gestores e administradores</option>
                  <option value="Administrador">Somente administradores</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px' }}>Ordem</label>
                <input
                  type="number"
                  value={edicao.ordem}
                  onChange={e => alterar('ordem', Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px' }}>Altura (px)</label>
                <input
                  type="number"
                  min={300}
                  max={3000}
                  value={edicao.altura}
                  onChange={e => alterar('altura', Number(e.target.value) || ALTURA_PADRAO)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '13px' }}>Link do dashboard *</label>
              <input
                value={edicao.url}
                placeholder="https://app.powerbi.com/reportEmbed?reportId=...&autoAuth=true&ctid=..."
                onChange={e => { alterar('url', e.target.value); setPrevia(false); }}
                style={inputStyle}
              />
              {edicao.url && link && (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: !link.valido ? '#a4262c' : link.aviso ? '#7a5600' : '#13795b'
                  }}
                >
                  {!link.valido
                    ? link.aviso
                    : link.aviso || 'Link válido.'}
                  {link.valido && link.urlIncorporacao !== edicao.url.trim() && (
                    <div style={{ marginTop: '3px', color: '#475569', wordBreak: 'break-all' }}>
                      Será salvo como: {link.urlIncorporacao}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '13px' }}>Descrição (opcional)</label>
              <textarea
                rows={2}
                maxLength={500}
                value={edicao.descricao}
                onChange={e => alterar('descricao', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={edicao.ativo}
                onChange={e => alterar('ativo', e.target.checked)}
              />
              Aba ativa (visível no portal)
            </label>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button type="button" style={botaoPrimario} disabled={processando} onClick={salvar}>
                {processando ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                style={botao}
                disabled={!link || !link.valido}
                onClick={() => setPrevia(v => !v)}
              >
                {previa ? 'Ocultar pré-visualização' : 'Pré-visualizar'}
              </button>
              <button type="button" style={botao} onClick={() => { setEdicao(undefined); setPrevia(false); setErro(''); }}>
                Cancelar
              </button>
            </div>

            {previa && link && link.valido && (
              <iframe
                title="Pré-visualização do dashboard"
                src={link.urlIncorporacao}
                style={{ width: '100%', height: '420px', border: '1px solid #e2e8f0', borderRadius: '10px', marginTop: '14px', background: '#fff' }}
                allowFullScreen={true}
              />
            )}
          </div>
        )}

        {/* ===================== LISTA ===================== */}
        <div style={{ marginTop: '16px', overflowX: 'auto' }}>
          {props.dashboards.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px', fontSize: '13px' }}>
              Nenhum dashboard cadastrado. Clique em “+ Novo dashboard”.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px' }}>Ordem</th>
                  <th style={{ padding: '8px' }}>Aba</th>
                  <th style={{ padding: '8px' }}>Quem vê</th>
                  <th style={{ padding: '8px' }}>Situação</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {props.dashboards.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px' }}>{d.ordem}</td>
                    <td style={{ padding: '8px' }}>
                      <strong>{d.nome}</strong>
                      {d.descricao && (
                        <div style={{ color: '#64748b', fontSize: '12px' }}>{d.descricao}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {d.publico === 'Todos' ? 'Todos' : d.publico === 'Gestor' ? 'Gestores e admins' : 'Administradores'}
                    </td>
                    <td style={{ padding: '8px', color: d.ativo ? '#13795b' : '#94a3b8' }}>
                      {d.ativo ? 'Ativa' : 'Inativa'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        style={botao}
                        onClick={() => {
                          setErro('');
                          setPrevia(false);
                          setEdicao({ ...d });
                        }}
                      >
                        Editar
                      </button>{' '}
                      <button
                        type="button"
                        style={botao}
                        disabled={processando}
                        onClick={() => {
                          executar(() => props.service.definirAtivo(d.id, !d.ativo))
                            .catch((e: unknown) => console.error(e));
                        }}
                      >
                        {d.ativo ? 'Desativar' : 'Ativar'}
                      </button>{' '}
                      <button
                        type="button"
                        style={{ ...botao, color: '#a4262c', borderColor: '#f1b5ba' }}
                        disabled={processando}
                        onClick={() => {
                          if (window.confirm(`Excluir o dashboard "${d.nome}"? Para apenas ocultar, use Desativar.`)) {
                            executar(() => props.service.excluir(d.id))
                              .catch((e: unknown) => console.error(e));
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <details style={{ marginTop: '16px', fontSize: '12px', color: '#475569' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Como obter o link do Power BI</summary>
          <ol style={{ margin: '8px 0 0', paddingLeft: '18px', lineHeight: 1.7 }}>
            <li>No Power BI, abra o <strong>relatório</strong> (não a lista do workspace).</li>
            <li>Menu <strong>Arquivo → Inserir relatório → SharePoint Online</strong> e copie o link.</li>
            <li>Alternativa: copie o endereço do navegador com o relatório aberto; o portal converte automaticamente.</li>
            <li>Quem visualiza precisa ter acesso ao relatório no Power BI (licença Pro/PPU ou workspace em capacidade Premium/Fabric).</li>
          </ol>
        </details>
      </div>
    </div>
  );
};

export default GerenciarDashboardsModal;
