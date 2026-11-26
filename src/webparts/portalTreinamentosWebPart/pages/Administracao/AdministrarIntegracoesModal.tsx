import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IIntegracao,
  IntegracaoAdminService
} from '../../services/integracoes/IntegracaoAdminService';

// ============================================================
// INTEGRAÇÕES (menu do usuário › Integrações, só Administrador)
//
//  Endereço .... URL e ambiente de cada integração (ex.: CIGAM-BOM).
//  Segredo ..... substituir, verificar, remover. O segredo NUNCA volta
//                para a tela: só o final (…a1B2), quem e quando trocou.
//
//  Mesmo visual e regras do AdministrarIaModal.
// ============================================================

export interface IAdministrarIntegracoesModalProps {
  dataverseService: DataverseService;
  onFechar: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d8dee8',
  borderRadius: '8px', background: '#fff', fontSize: '13px'
};
const botao: React.CSSProperties = {
  padding: '8px 13px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff',
  cursor: 'pointer', fontSize: '12px', fontWeight: 600
};
const botaoPrimario: React.CSSProperties = { ...botao, border: 'none', background: '#1f4e96', color: '#fff' };
const rotulo: React.CSSProperties = { display: 'block', marginTop: '14px', fontSize: '13px', fontWeight: 600, color: '#0b1f3a' };

const dataHora = (valor: string): string => {
  const data = new Date(valor);
  return valor && !isNaN(data.getTime()) ? data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
};

const AdministrarIntegracoesModal: React.FC<IAdministrarIntegracoesModalProps> = (props) => {

  const servico = React.useMemo(() => new IntegracaoAdminService(props.dataverseService), [props.dataverseService]);

  const [lista, setLista] = React.useState<IIntegracao[]>([]);
  const [selecionada, setSelecionada] = React.useState('');
  const [carregando, setCarregando] = React.useState(true);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | undefined>(undefined);

  const [url, setUrl] = React.useState('');
  const [ambiente, setAmbiente] = React.useState('');
  const [novoSegredo, setNovoSegredo] = React.useState('');

  const atual = lista.filter(item => item.nome === selecionada)[0];

  const carregar = async (manterSelecao?: string): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      const lidas = await servico.listar();
      setLista(lidas);
      const nome = manterSelecao && lidas.some(i => i.nome === manterSelecao)
        ? manterSelecao
        : (lidas[0] ? lidas[0].nome : '');
      setSelecionada(nome);
      const item = lidas.filter(i => i.nome === nome)[0];
      setUrl(item ? item.url : '');
      setAmbiente(item ? item.ambiente : '');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  };

  React.useEffect(() => { carregar().catch(() => undefined); }, [servico]);

  const executar = async (acao: () => Promise<{ ok: boolean; mensagem: string }>, recarregar = true): Promise<void> => {
    setOcupado(true);
    setErro('');
    setAviso(undefined);
    try {
      const resultado = await acao();
      setAviso({ ok: resultado.ok, texto: resultado.mensagem });
      if (recarregar) {
        await carregar(selecionada);
      }
    } catch (falha) {
      setAviso({ ok: false, texto: falha instanceof Error ? falha.message : String(falha) });
    } finally {
      setOcupado(false);
    }
  };

  const trocarSelecao = (nome: string): void => {
    setSelecionada(nome);
    setAviso(undefined);
    setNovoSegredo('');
    const item = lista.filter(i => i.nome === nome)[0];
    setUrl(item ? item.url : '');
    setAmbiente(item ? item.ambiente : '');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Integrações"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: '760px', background: '#fff', borderRadius: '14px', padding: '22px', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0b1f3a' }}>Integrações</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Endereço e segredo dos sistemas externos (CIGAM etc.). O segredo fica numa coluna protegida do Dataverse e só os plugins o leem.
            </p>
          </div>
          <button type="button" style={botao} onClick={props.onFechar}>Fechar</button>
        </div>

        {erro && <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#fde7e9', color: '#a4262c', fontSize: '13px' }}>{erro}</div>}
        {aviso && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: aviso.ok ? '#e6f6ee' : '#fde7e9', color: aviso.ok ? '#11683f' : '#a4262c', fontSize: '13px' }}>
            {aviso.texto}
          </div>
        )}

        {carregando && <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>Carregando...</div>}

        {!carregando && lista.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <label style={{ ...rotulo, marginTop: 0 }}>
              Integração
              <select value={selecionada} onChange={e => trocarSelecao(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }}>
                {lista.map(item => <option key={item.id} value={item.nome}>{item.nome}</option>)}
              </select>
            </label>
            {atual && atual.descricao && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>{atual.descricao}</div>}

            {/* Endereço */}
            <label style={rotulo}>
              Endereço (https, sem parâmetros)
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={{ ...inputStyle, marginTop: '6px' }} />
            </label>
            <label style={rotulo}>
              Ambiente
              <input value={ambiente} onChange={e => setAmbiente(e.target.value)} placeholder="Homologação / Produção" style={{ ...inputStyle, marginTop: '6px' }} />
            </label>
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                style={botao}
                disabled={ocupado || !atual || (url.trim() === atual.url && ambiente.trim() === atual.ambiente)}
                onClick={() => executar(() => servico.gerenciar('salvarEndereco', selecionada, { url, ambiente }))}
              >
                Salvar endereço
              </button>
            </div>

            {/* Segredo */}
            <div style={{ marginTop: '18px', padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px' }}>
              {atual && atual.segredoFinal
                ? (
                  <>
                    <div><strong>Segredo salvo no portal:</strong> {atual.segredoFinal}</div>
                    <div style={{ color: '#64748b', marginTop: '4px' }}>
                      Atualizado {atual.segredoAtualizadoEm ? `em ${dataHora(atual.segredoAtualizadoEm)}` : ''}{atual.segredoAtualizadoPor ? ` por ${atual.segredoAtualizadoPor}` : ''}.
                    </div>
                  </>
                )
                : (
                  <div style={{ color: '#64748b' }}>
                    Nenhum segredo salvo no portal. O plugin usa a Configuração segura do passo (Plugin Registration Tool), se houver.
                  </div>
                )}
            </div>

            <label style={rotulo}>
              Substituir segredo
              <input
                type="password"
                autoComplete="new-password"
                value={novoSegredo}
                onChange={e => setNovoSegredo(e.target.value)}
                placeholder="Cole o token/segredo novo"
                style={{ ...inputStyle, marginTop: '6px' }}
              />
            </label>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Depois de salvo, ninguém consegue vê-lo pelo portal. Não envie o segredo por e-mail, Teams ou chat — cole aqui direto.
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={botaoPrimario}
                disabled={ocupado || novoSegredo.trim().length < 8}
                onClick={() => {
                  const valor = novoSegredo;
                  setNovoSegredo('');
                  executar(() => servico.gerenciar('salvarSegredo', selecionada, { segredo: valor })).catch(() => undefined);
                }}
              >
                {ocupado ? 'Salvando...' : 'Salvar segredo'}
              </button>
              <button
                type="button"
                style={botao}
                disabled={ocupado}
                onClick={() => executar(() => servico.gerenciar('verificar', selecionada), false)}
              >
                Verificar configuração
              </button>
              <button
                type="button"
                style={{ ...botao, color: '#a4262c', borderColor: '#f3c1c4' }}
                disabled={ocupado || !atual || !atual.segredoFinal}
                onClick={() => {
                  if (window.confirm('Remover o segredo do portal? O plugin volta a usar a Configuração segura do passo (se houver).')) {
                    executar(() => servico.gerenciar('removerSegredo', selecionada)).catch(() => undefined);
                  }
                }}
              >
                Remover segredo do portal
              </button>
            </div>
          </div>
        )}

        {!carregando && !erro && lista.length === 0 && (
          <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
            Nenhuma integração cadastrada. Rode scripts/dataverse/criar-integracoes-configuracao.ps1.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdministrarIntegracoesModal;
