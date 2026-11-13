import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AreaAdminService
} from '../../services/AreaAdminService';

import {
  FUNCIONALIDADES_IA,
  IConfiguracaoIa,
  IConsumoArea,
  IPrecosIa,
  IUsuarioVariasAreas,
  IaAdminService,
  guidIa
} from '../../services/ia/IaAdminService';

// ============================================================
// ADMINISTRAR IA (menu do usuário › Administrar IA, só Administrador)
//
//  Chave ....... substituir (testa antes de salvar), testar, remover.
//                A chave NUNCA volta para a tela: só o final (…a1B2).
//  Preços ...... US$ por milhão de tokens, por modelo, e cotação do
//                dólar (para o custo em R$).
//  Limites ..... consumo do mês por área e limite mensal (US$).
//  Áreas ....... área de cada funcionalidade (regra a) e área principal
//                de quem tem várias áreas (regra b, reserva).
// ============================================================

export interface IAdministrarIaModalProps {
  dataverseService: DataverseService;
  // Opcional: sem a lista, a tela carrega as áreas ativas sozinha
  // (assim pode ser aberta de qualquer lugar do portal).
  areas?: Array<{ id: string; nome: string }>;
  onFechar: () => void;
}

type Aba = 'chave' | 'precos' | 'limites' | 'areas';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d8dee8',
  borderRadius: '8px', background: '#fff', fontSize: '13px'
};
const botao: React.CSSProperties = {
  padding: '8px 13px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff',
  cursor: 'pointer', fontSize: '12px', fontWeight: 600
};
const botaoPrimario: React.CSSProperties = { ...botao, border: 'none', background: '#1f4e96', color: '#fff' };
const cabecalho: React.CSSProperties = { textAlign: 'left', padding: '8px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' };
const celula: React.CSSProperties = { padding: '8px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };

const usd = (valor: number): string =>
  `US$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: valor > 0 && valor < 0.01 ? 4 : 2 })}`;
const brl = (valor: number): string =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dataHora = (valor: string): string => {
  const data = new Date(valor);
  return valor && !isNaN(data.getTime()) ? data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
};

const AdministrarIaModal: React.FC<IAdministrarIaModalProps> = (props) => {

  const servico = React.useMemo(() => new IaAdminService(props.dataverseService), [props.dataverseService]);

  const [aba, setAba] = React.useState<Aba>('chave');
  const [areasCarregadas, setAreasCarregadas] = React.useState<Array<{ id: string; nome: string }>>([]);
  const areas = props.areas || areasCarregadas;

  React.useEffect(() => {
    if (props.areas) {
      return;
    }
    new AreaAdminService(props.dataverseService).listarAreas()
      .then(lista => setAreasCarregadas(
        lista
          .filter(area => area.ativa !== false)
          .map(area => ({ id: guidIa(area.id), nome: area.sigla ? `${area.sigla} · ${area.nome}` : area.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      ))
      .catch(() => setAreasCarregadas([]));
  }, [props.dataverseService, props.areas]);
  const [config, setConfig] = React.useState<IConfiguracaoIa | undefined>(undefined);
  const [consumo, setConsumo] = React.useState<IConsumoArea[]>([]);
  const [modelosSemPreco, setModelosSemPreco] = React.useState<string[]>([]);
  const [usuarios, setUsuarios] = React.useState<IUsuarioVariasAreas[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [ocupado, setOcupado] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | undefined>(undefined);

  // Edição local
  const [novaChave, setNovaChave] = React.useState('');
  const [precos, setPrecos] = React.useState<Array<{ modelo: string; entrada: string; saida: string }>>([]);
  const [cotacao, setCotacao] = React.useState('');
  const [limites, setLimites] = React.useState<{ [areaId: string]: string }>({});
  const [areasFuncionalidade, setAreasFuncionalidade] = React.useState<{ [funcionalidade: string]: string }>({});

  const aplicarConfig = (lida: IConfiguracaoIa): void => {
    setConfig(lida);
    setPrecos(Object.keys(lida.precos.modelos).map(modelo => ({
      modelo,
      entrada: String(lida.precos.modelos[modelo].entrada),
      saida: String(lida.precos.modelos[modelo].saida)
    })));
    setCotacao(lida.precos.cotacaoBrl ? String(lida.precos.cotacaoBrl) : '');
    const mapaLimites: { [areaId: string]: string } = {};
    Object.keys(lida.limites).forEach(areaId => { mapaLimites[guidIa(areaId)] = String(lida.limites[areaId]); });
    setLimites(mapaLimites);
    setAreasFuncionalidade({ ...lida.areasFuncionalidade });
  };

  const carregar = async (): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      aplicarConfig(await servico.carregarConfiguracao());
      const mes = await servico.consumoDoMes();
      setConsumo(mes.porArea);
      setModelosSemPreco(mes.modelosSemPreco);
      setUsuarios(await servico.usuariosComVariasAreas());
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  };

  React.useEffect(() => { carregar().catch(() => undefined); }, [servico]);

  const executar = async (acao: () => Promise<string>, recarregar = true): Promise<void> => {
    setOcupado(true);
    setErro('');
    setAviso(undefined);
    try {
      const texto = await acao();
      setAviso({ ok: true, texto });
      if (recarregar) {
        aplicarConfig(await servico.carregarConfiguracao());
      }
    } catch (falha) {
      setAviso({ ok: false, texto: falha instanceof Error ? falha.message : String(falha) });
    } finally {
      setOcupado(false);
    }
  };

  // ------------------------------------------------------------
  // Abas
  // ------------------------------------------------------------

  const abaChave = (): React.ReactNode => (
    <div>
      <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px' }}>
        {config && config.chaveFinal
          ? (
            <>
              <div><strong>Chave salva no portal:</strong> {config.chaveFinal}</div>
              <div style={{ color: '#64748b', marginTop: '4px' }}>
                Atualizada {config.chaveAtualizadaEm ? `em ${dataHora(config.chaveAtualizadaEm)}` : ''}{config.chaveAtualizadaPor ? ` por ${config.chaveAtualizadaPor}` : ''}.
                Vale para todas as funcionalidades de IA do portal.
              </div>
            </>
          )
          : (
            <div style={{ color: '#64748b' }}>
              Nenhuma chave salva no portal. Os plugins usam a chave da Configuração segura do passo (Plugin Registration Tool).
            </div>
          )}
      </div>

      <label style={{ display: 'block', marginTop: '16px', fontSize: '13px', fontWeight: 600, color: '#0b1f3a' }}>
        Substituir chave
        <input
          type="password"
          autoComplete="off"
          value={novaChave}
          onChange={e => setNovaChave(e.target.value)}
          placeholder="Cole a chave nova da Anthropic"
          style={{ ...inputStyle, marginTop: '6px' }}
        />
      </label>
      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
        A chave é testada na Anthropic antes de ser salva e fica numa coluna protegida do Dataverse. Depois de salva, ninguém consegue vê-la pelo portal.
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={botaoPrimario}
          disabled={ocupado || novaChave.trim().length < 20}
          onClick={() => executar(async () => {
            const resultado = await servico.gerenciarChave('salvarChave', novaChave);
            setNovaChave('');
            return resultado.mensagem;
          })}
        >
          {ocupado ? 'Testando...' : 'Testar e salvar'}
        </button>
        <button
          type="button"
          style={botao}
          disabled={ocupado || !config || !config.chaveFinal}
          onClick={() => executar(async () => {
            const resultado = await servico.gerenciarChave('testarChave');
            if (!resultado.ok) {
              throw new Error(resultado.mensagem);
            }
            return resultado.mensagem;
          }, false)}
        >
          Testar chave salva
        </button>
        <button
          type="button"
          style={{ ...botao, color: '#a4262c', borderColor: '#f3c1c4' }}
          disabled={ocupado || !config || !config.chaveFinal}
          onClick={() => {
            if (window.confirm('Remover a chave do portal? Os plugins voltam a usar a Configuração segura do passo (se houver).')) {
              executar(async () => (await servico.gerenciarChave('removerChave')).mensagem).catch(() => undefined);
            }
          }}
        >
          Remover chave do portal
        </button>
      </div>
    </div>
  );

  const abaPrecos = (): React.ReactNode => (
    <div>
      <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '10px' }}>
        Preços em <strong>US$ por milhão de tokens</strong>, como na página de preços da Anthropic. Valem para as chamadas feitas
        a partir de agora (o custo de cada chamada é gravado no momento dela).
      </div>
      {modelosSemPreco.length > 0 && (
        <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#fff4d6', color: '#7a5600', fontSize: '12.5px', marginBottom: '10px' }}>
          Modelos usados este mês sem preço cadastrado (custo registrado como zero): {modelosSemPreco.join(', ')}.
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={cabecalho}>Modelo</th><th style={cabecalho}>Entrada (US$/M)</th><th style={cabecalho}>Saída (US$/M)</th><th style={cabecalho} /></tr>
        </thead>
        <tbody>
          {precos.map((linha, i) => (
            <tr key={i}>
              <td style={celula}><input style={inputStyle} value={linha.modelo} onChange={e => setPrecos(precos.map((l, j) => (j === i ? { ...l, modelo: e.target.value } : l)))} placeholder="claude-..." /></td>
              <td style={celula}><input style={inputStyle} inputMode="decimal" value={linha.entrada} onChange={e => setPrecos(precos.map((l, j) => (j === i ? { ...l, entrada: e.target.value } : l)))} /></td>
              <td style={celula}><input style={inputStyle} inputMode="decimal" value={linha.saida} onChange={e => setPrecos(precos.map((l, j) => (j === i ? { ...l, saida: e.target.value } : l)))} /></td>
              <td style={{ ...celula, width: '1%' }}><button type="button" style={botao} onClick={() => setPrecos(precos.filter((_, j) => j !== i))}>Remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginTop: '12px', flexWrap: 'wrap' }}>
        <button type="button" style={botao} onClick={() => setPrecos(precos.concat([{ modelo: '', entrada: '', saida: '' }]))}>+ Modelo</button>
        <label style={{ fontSize: '12.5px', color: '#0b1f3a', fontWeight: 600 }}>
          Cotação do dólar (R$) — opcional, para o custo em reais
          <input style={{ ...inputStyle, marginTop: '4px', maxWidth: '180px', display: 'block' }} inputMode="decimal" value={cotacao} onChange={e => setCotacao(e.target.value)} placeholder="ex.: 5,40" />
        </label>
        <button
          type="button"
          style={botaoPrimario}
          disabled={ocupado || !config}
          onClick={() => executar(async () => {
            const lerNumero = (valor: string): number => Number(String(valor).replace(/\./g, '').replace(',', '.')) || 0;
            const novos: IPrecosIa = { cotacaoBrl: lerNumero(cotacao), modelos: {} };
            precos.filter(l => l.modelo.trim()).forEach(l => {
              novos.modelos[l.modelo.trim()] = { entrada: lerNumero(l.entrada), saida: lerNumero(l.saida) };
            });
            await servico.salvarPrecos((config as IConfiguracaoIa).id, novos);
            return 'Preços salvos.';
          })}
        >
          Salvar preços
        </button>
      </div>
    </div>
  );

  const abaLimites = (): React.ReactNode => {
    const linhas = areas.map(area => {
      const usado = consumo.filter(item => guidIa(item.areaId) === guidIa(area.id))[0];
      return { area, usado };
    });
    const semArea = consumo.filter(item => !item.areaId)[0];
    const total = consumo.reduce((soma, item) => soma + item.custoUsd, 0);
    const totalBrl = consumo.reduce((soma, item) => soma + item.custoBrl, 0);
    return (
      <div>
        <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '10px' }}>
          Consumo do mês atual e limite mensal por área (US$). Ao atingir o limite, a IA fica bloqueada para aquela área até o mês
          seguinte. Deixe em branco para não limitar. Total do mês: <strong>{usd(total)}</strong>{totalBrl > 0 ? ` (${brl(totalBrl)})` : ''}.
        </div>
        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={cabecalho}>Área</th><th style={cabecalho}>Chamadas</th><th style={cabecalho}>Consumo do mês</th><th style={cabecalho}>Limite mensal (US$)</th><th style={cabecalho}>Uso do limite</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ area, usado }) => {
                const limite = Number(String(limites[guidIa(area.id)] || '').replace(',', '.')) || 0;
                const percentual = limite > 0 && usado ? Math.min(100, Math.round((usado.custoUsd / limite) * 100)) : 0;
                return (
                  <tr key={area.id}>
                    <td style={celula}>{area.nome}</td>
                    <td style={celula}>{usado ? usado.chamadas : 0}</td>
                    <td style={celula}>{usd(usado ? usado.custoUsd : 0)}{usado && usado.custoBrl > 0 ? ` · ${brl(usado.custoBrl)}` : ''}</td>
                    <td style={{ ...celula, width: '150px' }}>
                      <input
                        style={inputStyle}
                        inputMode="decimal"
                        value={limites[guidIa(area.id)] || ''}
                        onChange={e => setLimites({ ...limites, [guidIa(area.id)]: e.target.value })}
                        placeholder="sem limite"
                      />
                    </td>
                    <td style={{ ...celula, width: '140px' }}>
                      {limite > 0
                        ? (
                          <div title={`${percentual}%`}>
                            <div style={{ height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{ width: `${percentual}%`, height: '100%', background: percentual >= 100 ? '#d84c3e' : percentual >= 80 ? '#e6a400' : '#1fa971' }} />
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{percentual}%</div>
                          </div>
                        )
                        : <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
              {semArea && (
                <tr>
                  <td style={{ ...celula, fontStyle: 'italic' }}>Sem área (usuário sem área principal)</td>
                  <td style={celula}>{semArea.chamadas}</td>
                  <td style={celula}>{usd(semArea.custoUsd)}</td>
                  <td style={celula} colSpan={2}><span style={{ fontSize: '12px', color: '#64748b' }}>Defina a área principal na aba Áreas.</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            style={botaoPrimario}
            disabled={ocupado || !config}
            onClick={() => executar(async () => {
              const valores: { [areaId: string]: number } = {};
              Object.keys(limites).forEach(areaId => {
                valores[areaId] = Number(String(limites[areaId]).replace(/\./g, '').replace(',', '.')) || 0;
              });
              await servico.salvarLimites((config as IConfiguracaoIa).id, valores);
              return 'Limites salvos.';
            })}
          >
            Salvar limites
          </button>
        </div>
      </div>
    );
  };

  const abaAreas = (): React.ReactNode => (
    <div>
      <strong style={{ fontSize: '14px', color: '#0b1f3a' }}>Área de cada funcionalidade</strong>
      <div style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 10px' }}>
        Regra (a): o consumo vai para a área de onde partiu o uso. Nos dashboards é a área filtrada (ou a única área do dashboard).
        Para as funcionalidades abaixo, escolha a área.
      </div>
      {FUNCIONALIDADES_IA.map(funcionalidade => (
        <label key={funcionalidade.chave} style={{ display: 'block', fontSize: '13px', marginBottom: '10px' }}>
          {funcionalidade.rotulo}
          <select
            style={{ ...inputStyle, marginTop: '4px', maxWidth: '360px', display: 'block' }}
            value={areasFuncionalidade[funcionalidade.chave] || ''}
            onChange={e => setAreasFuncionalidade({ ...areasFuncionalidade, [funcionalidade.chave]: e.target.value })}
          >
            <option value="">Padrão: área de sigla {funcionalidade.siglaPadrao}</option>
            {areas.map(area => <option key={area.id} value={area.id}>{area.nome}</option>)}
          </select>
        </label>
      ))}
      <button
        type="button"
        style={botaoPrimario}
        disabled={ocupado || !config}
        onClick={() => executar(async () => {
          await servico.salvarAreasFuncionalidade((config as IConfiguracaoIa).id, areasFuncionalidade);
          return 'Áreas das funcionalidades salvas.';
        })}
      >
        Salvar áreas das funcionalidades
      </button>

      <strong style={{ display: 'block', fontSize: '14px', color: '#0b1f3a', marginTop: '22px' }}>Área principal de quem participa de várias áreas</strong>
      <div style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 10px' }}>
        Regra (b), reserva: quando o uso não tem área clara, o consumo vai para a área principal. Quem tem uma só área usa essa;
        sem área principal definida, o consumo fica como “Sem área”.
      </div>
      {usuarios.length === 0
        ? <div style={{ fontSize: '13px', color: '#64748b' }}>Nenhum usuário participa de mais de uma área.</div>
        : (
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={cabecalho}>Usuário</th><th style={cabecalho}>Área principal</th></tr></thead>
              <tbody>
                {usuarios.map(usuario => {
                  const atual = usuario.vinculos.filter(v => v.principal)[0];
                  return (
                    <tr key={usuario.usuarioId}>
                      <td style={celula}>{usuario.usuarioNome}</td>
                      <td style={celula}>
                        <select
                          style={{ ...inputStyle, maxWidth: '320px' }}
                          value={atual ? atual.vinculoId : ''}
                          disabled={ocupado}
                          onChange={e => {
                            const vinculoId = e.target.value;
                            if (!vinculoId) {
                              return;
                            }
                            executar(async () => {
                              await servico.definirAreaPrincipal(usuario, vinculoId);
                              setUsuarios(usuarios.map(item => (item.usuarioId === usuario.usuarioId
                                ? { ...item, vinculos: item.vinculos.map(v => ({ ...v, principal: v.vinculoId === vinculoId })) }
                                : item)));
                              return `Área principal de ${usuario.usuarioNome} salva.`;
                            }, false).catch(() => undefined);
                          }}
                        >
                          <option value="">— escolha —</option>
                          {usuario.vinculos.map(v => <option key={v.vinculoId} value={v.vinculoId}>{v.areaNome}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );

  // ------------------------------------------------------------
  // Tela
  // ------------------------------------------------------------

  const abas: Array<{ chave: Aba; rotulo: string }> = [
    { chave: 'chave', rotulo: '🔑 Chave' },
    { chave: 'precos', rotulo: 'Preços' },
    { chave: 'limites', rotulo: 'Limites e consumo do mês' },
    { chave: 'areas', rotulo: 'Áreas' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Administrar IA"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: '980px', background: '#fff', borderRadius: '14px', padding: '22px', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0b1f3a' }}>Administrar IA</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Chave, preços, limites e áreas do consumo de IA. Vale para todas as funcionalidades de IA do portal. O dashboard de consumo usa a fonte “ia.consumo”.
            </p>
          </div>
          <button type="button" style={botao} onClick={props.onFechar}>Fechar</button>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: '6px', marginTop: '16px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          {abas.map(item => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={aba === item.chave}
              onClick={() => { setAba(item.chave); setAviso(undefined); }}
              style={{
                padding: '8px 14px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                color: aba === item.chave ? '#1f4e96' : '#64748b', borderBottom: aba === item.chave ? '3px solid #1f4e96' : '3px solid transparent'
              }}
            >
              {item.rotulo}
            </button>
          ))}
        </div>

        {erro && <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#fde7e9', color: '#a4262c', fontSize: '13px' }}>{erro}</div>}
        {aviso && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: aviso.ok ? '#e6f6ee' : '#fde7e9', color: aviso.ok ? '#11683f' : '#a4262c', fontSize: '13px' }}>
            {aviso.texto}
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          {carregando && <div style={{ fontSize: '13px', color: '#64748b' }}>Carregando...</div>}
          {!carregando && config && aba === 'chave' && abaChave()}
          {!carregando && config && aba === 'precos' && abaPrecos()}
          {!carregando && config && aba === 'limites' && abaLimites()}
          {!carregando && config && aba === 'areas' && abaAreas()}
        </div>
      </div>
    </div>
  );
};

export default AdministrarIaModal;
