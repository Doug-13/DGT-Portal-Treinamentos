import * as React from 'react';

import {
  CRM_AMBIENTES,
  CRM_TABELAS,
  IAmbienteCrm,
  IColunaCrm,
  ITabelaCrm
} from '../../constants/crm';

import {
  CrmService,
  FORMATADO,
  IAmbienteDescoberto,
  IEtapaPipeline,
  IMetadadosTabelaCrm,
  IRegistroCrm,
  ITabelaPersonalizadaCrm,
  campoConsulta,
  descobrirAmbientesCrm
} from '../../services/crm/CrmService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  Aviso,
  COR,
  FONTE,
  Modal,
  Selo,
  botao,
  campo,
  celula,
  celulaCabecalho,
  painel,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// CRM — CONSULTA DOS DADOS DO DYNAMICS 365 NO PORTAL
//
// Abas: Visão geral · Contas · Contatos · Leads · Oportunidades ·
// Outras tabelas (tabelas personalizadas do ambiente, ex.: IA Lab).
//
// Quem vê o menu: quem tem o módulo "crm" liberado (Usuários e
// acessos). Quais REGISTROS cada um vê: Security Role do usuário no
// ambiente do CRM (o portal só repassa o token da própria pessoa).
// Primeira fase: somente leitura. Edição continua no app do Dynamics
// (botão "Abrir no Dynamics").
// ============================================================

export interface ICrmPageProps {
  contexto?: IContextoAcesso;
}

type AbaCrm = 'visao' | 'outras' | string;

interface IEstadoLista {
  registros: IRegistroCrm[];
  colunas: IColunaCrm[];
  meta?: IMetadadosTabelaCrm;
  total?: number;
  totalLimitado?: boolean;
  proximaPagina?: string;
}

// ------------------------------------------------------------
// Formatação
// ------------------------------------------------------------

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const valorExibido = (registro: IRegistroCrm, coluna: IColunaCrm): string => {
  const chave = campoConsulta(coluna);
  const formatado = registro[`${chave}${FORMATADO}`];
  const bruto = registro[chave];

  if (bruto === null || bruto === undefined || bruto === '') {
    return '—';
  }

  if (coluna.tipo === 'percentual') {
    return `${bruto}%`;
  }

  if (coluna.tipo === 'data' && typeof bruto === 'string') {
    const data = new Date(bruto);
    return isNaN(data.getTime()) ? String(bruto) : data.toLocaleDateString('pt-BR');
  }

  if (formatado !== undefined && formatado !== null) {
    return String(formatado);
  }

  if (coluna.tipo === 'moeda' && typeof bruto === 'number') {
    return moeda.format(bruto);
  }

  return String(bruto);
};

// Explica os erros mais comuns em linguagem simples.
const explicarErro = (mensagem: string): string => {
  if (/not a member of the organization|403/i.test(mensagem)) {
    return 'Seu usuário ainda não tem acesso ao ambiente do CRM. Peça ao administrador do Power Platform para incluir você no ambiente "DGT - CRM - POC" com uma Security Role (ex.: Vendedor ou uma role de leitura do CRM).';
  }
  if (/401|AADSTS|consent|token/i.test(mensagem)) {
    return 'O SharePoint não conseguiu obter o token para o CRM. Confira se a permissão de API "Dynamics CRM → user_impersonation" está aprovada em SharePoint admin center → Avançado → Acesso à API.';
  }
  if (/Failed to fetch|NetworkError/i.test(mensagem)) {
    return 'Não foi possível alcançar o servidor do CRM. Confira se a URL em constants/crm.ts está correta (ex.: https://orgxxxxxxx.crm2.dynamics.com).';
  }
  return '';
};

// ------------------------------------------------------------
// Componentes pequenos
// ------------------------------------------------------------

const Cartao: React.FC<{ titulo: string; valor: string; detalhe?: string; aoClicar?: () => void }> = ({ titulo, valor, detalhe, aoClicar }) => (
  <button
    type="button"
    onClick={aoClicar}
    disabled={!aoClicar}
    style={{
      ...painel,
      textAlign: 'left',
      cursor: aoClicar ? 'pointer' : 'default',
      borderTop: `4px solid ${COR.ciano}`,
      fontFamily: FONTE,
      color: COR.azul
    }}
  >
    <span style={{ ...rotulo, marginBottom: '8px', color: COR.texto2 }}>{titulo}</span>
    <span style={{ display: 'block', fontSize: '28px', fontWeight: 700, lineHeight: 1.1 }}>{valor}</span>
    {detalhe && <span style={{ display: 'block', marginTop: '6px', fontSize: '12.5px', color: COR.texto2 }}>{detalhe}</span>}
  </button>
);

const ErroCrm: React.FC<{ mensagem: string; aoTentar?: () => void }> = ({ mensagem, aoTentar }) => {
  const explicacao = explicarErro(mensagem);
  return (
    <Aviso
      tipo="alerta"
      acao={aoTentar ? <button type="button" style={botao('secundario')} onClick={aoTentar}>Tentar de novo</button> : undefined}
    >
      <strong>Não foi possível ler o CRM.</strong>{' '}
      {explicacao || 'Veja o detalhe técnico abaixo.'}
      <details style={{ marginTop: '6px', fontSize: '12px', color: COR.texto2 }}>
        <summary style={{ cursor: 'pointer' }}>Detalhe técnico</summary>
        <span style={{ wordBreak: 'break-word' }}>{mensagem}</span>
      </details>
    </Aviso>
  );
};

// ------------------------------------------------------------
// Tela de configuração (URL ainda não preenchida)
// ------------------------------------------------------------

const ConfigurarCrm: React.FC<{ ambiente: IAmbienteCrm }> = ({ ambiente }) => {

  const [ambientes, setAmbientes] = React.useState<IAmbienteDescoberto[] | undefined>(undefined);
  const [buscando, setBuscando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const descobrir = async (): Promise<void> => {
    setBuscando(true);
    setErro('');
    try {
      setAmbientes(await descobrirAmbientesCrm());
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div style={painel}>
      <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>Conectar o portal ao CRM</h3>
      <p style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: 1.55, color: COR.texto2, maxWidth: '80ch' }}>
        Falta informar a URL do ambiente <strong>{ambiente.nome}</strong> no arquivo{' '}
        <code>src/webparts/portalTreinamentosWebPart/constants/crm.ts</code> (campo <code>url</code>).
        O botão abaixo lista os ambientes que o seu usuário acessa, para facilitar.
      </p>
      <button type="button" style={botao('principal', buscando)} disabled={buscando} onClick={() => { descobrir().catch(() => undefined); }}>
        {buscando ? 'Procurando…' : 'Listar meus ambientes'}
      </button>

      {erro && <div style={{ marginTop: '12px' }}><ErroCrm mensagem={erro} /></div>}

      {ambientes && (
        <div style={{ marginTop: '14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={celulaCabecalho}>Ambiente</th>
                <th style={celulaCabecalho}>URL (copiar para crm.ts)</th>
                <th style={celulaCabecalho}>Região</th>
              </tr>
            </thead>
            <tbody>
              {ambientes.map(a => (
                <tr key={a.url} style={{ background: a.nome === ambiente.nome ? COR.cianoClaro : undefined }}>
                  <td style={celula}>{a.nome}</td>
                  <td style={{ ...celula, fontFamily: 'Consolas, monospace', fontSize: '13px', userSelect: 'all' }}>{a.url}</td>
                  <td style={celula}>{a.regiao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Visão geral
// ------------------------------------------------------------

const VisaoGeral: React.FC<{
  servico: CrmService;
  tabelasDisponiveis: ITabelaCrm[];
  aoAbrirAba: (aba: string) => void;
}> = ({ servico, tabelasDisponiveis, aoAbrirAba }) => {

  const [contagens, setContagens] = React.useState<Record<string, number | undefined>>({});
  const [pipeline, setPipeline] = React.useState<IEtapaPipeline[] | undefined>(undefined);
  const [erro, setErro] = React.useState('');
  const [carregando, setCarregando] = React.useState(true);

  const carregar = React.useCallback(async (): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      const valores = await Promise.all(tabelasDisponiveis.map(t => servico.contar(t, true)));
      const mapa: Record<string, number | undefined> = {};
      tabelasDisponiveis.forEach((t, i) => { mapa[t.chave] = valores[i]; });
      setContagens(mapa);

      try {
        setPipeline(await servico.pipeline());
      } catch {
        // Agregação indisponível não impede o resto da visão geral.
        setPipeline(undefined);
      }
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregando(false);
    }
  }, [servico, tabelasDisponiveis]);

  React.useEffect(() => { carregar().catch(() => undefined); }, [carregar]);

  if (erro) {
    return <ErroCrm mensagem={erro} aoTentar={() => { carregar().catch(() => undefined); }} />;
  }

  const totalPipeline = (pipeline || []).reduce((s, e) => s + e.valor, 0);
  const maiorEtapa = Math.max(1, ...(pipeline || []).map(e => e.valor));

  const fmtQtd = (n: number | undefined): string =>
    carregando ? '…' : n === undefined ? '—' : n >= 5000 ? '5.000+' : n.toLocaleString('pt-BR');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
        {tabelasDisponiveis.map(t => (
          <Cartao
            key={t.chave}
            titulo={`${t.rotulo} ${t.filtroAtivos ? 'ativos' : ''}`.trim()}
            valor={fmtQtd(contagens[t.chave])}
            aoClicar={() => aoAbrirAba(t.chave)}
          />
        ))}
        {pipeline && (
          <Cartao
            titulo="Pipeline em aberto"
            valor={carregando ? '…' : moeda.format(totalPipeline)}
            detalhe="Soma do valor estimado das oportunidades abertas"
            aoClicar={() => aoAbrirAba('oportunidades')}
          />
        )}
      </div>

      {pipeline && pipeline.length > 0 && (
        <div style={painel}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Oportunidades abertas por etapa</h3>
          {pipeline.map(e => (
            <div key={e.etapa} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr auto', alignItems: 'center', gap: '12px', marginBottom: '10px', fontSize: '13.5px' }}>
              <span style={{ fontWeight: 600 }}>{e.etapa}</span>
              <span style={{ background: COR.azulClaro, borderRadius: '4px', height: '14px', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.max(2, (e.valor / maiorEtapa) * 100)}%`, background: COR.ciano }} />
              </span>
              <span style={{ whiteSpace: 'nowrap', color: COR.texto2 }}>
                {moeda.format(e.valor)} · {e.quantidade} {e.quantidade === 1 ? 'oportunidade' : 'oportunidades'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!carregando && tabelasDisponiveis.length === 0 && (
        <Aviso tipo="info">Nenhuma das tabelas padrão do CRM (Contas, Contatos, Leads, Oportunidades) foi encontrada neste ambiente. Veja a aba “Outras tabelas”.</Aviso>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Lista de uma tabela padrão
// ------------------------------------------------------------

const ListaTabela: React.FC<{ servico: CrmService; tabela: ITabelaCrm }> = ({ servico, tabela }) => {

  const [estado, setEstado] = React.useState<IEstadoLista>({ registros: [], colunas: [] });
  const [busca, setBusca] = React.useState('');
  const [buscaAplicada, setBuscaAplicada] = React.useState('');
  const [somenteAtivos, setSomenteAtivos] = React.useState(true);
  const [carregando, setCarregando] = React.useState(true);
  const [carregandoMais, setCarregandoMais] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [selecionado, setSelecionado] = React.useState<IRegistroCrm | undefined>(undefined);

  const carregar = React.useCallback(async (): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      const r = await servico.listar(tabela, { busca: buscaAplicada, somenteAtivos });
      setEstado(r);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregando(false);
    }
  }, [servico, tabela, buscaAplicada, somenteAtivos]);

  React.useEffect(() => { carregar().catch(() => undefined); }, [carregar]);

  const carregarMais = async (): Promise<void> => {
    if (!estado.proximaPagina) {
      return;
    }
    setCarregandoMais(true);
    try {
      const mais = await servico.proximaPagina(estado.proximaPagina);
      setEstado(atual => ({
        ...atual,
        registros: atual.registros.concat(mais.registros),
        proximaPagina: mais.proximaPagina
      }));
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregandoMais(false);
    }
  };

  const colunasLista = estado.colunas.filter(c => c.naLista);
  const idCampo = estado.meta ? estado.meta.idPrimario : '';
  const nomeCampo = estado.meta ? estado.meta.nomePrimario : '';

  const totalTexto = estado.total === undefined
    ? ''
    : `${estado.total.toLocaleString('pt-BR')}${estado.totalLimitado ? '+' : ''} ${estado.total === 1 ? 'registro' : 'registros'}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        <input
          aria-label={`Buscar ${tabela.rotulo.toLowerCase()}`}
          placeholder={`Buscar ${tabela.rotulo.toLowerCase()}…`}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setBuscaAplicada(busca); } }}
          style={{ ...campo, width: 'auto', flex: '1 1 260px', maxWidth: '420px' }}
        />
        <button type="button" style={botao('principal')} onClick={() => setBuscaAplicada(busca)}>Buscar</button>
        {buscaAplicada && (
          <button type="button" style={botao('discreto')} onClick={() => { setBusca(''); setBuscaAplicada(''); }}>Limpar</button>
        )}
        {tabela.filtroAtivos && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
            <input type="checkbox" checked={somenteAtivos} onChange={e => setSomenteAtivos(e.target.checked)} />
            Somente ativos
          </label>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: COR.texto2 }}>{carregando ? 'Carregando…' : totalTexto}</span>
        <a href={servico.linkLista(tabela.logicalName)} target="_blank" rel="noopener noreferrer" style={{ ...botao('secundario'), textDecoration: 'none' }}>
          Abrir lista no Dynamics ↗
        </a>
      </div>

      {erro && <ErroCrm mensagem={erro} aoTentar={() => { carregar().catch(() => undefined); }} />}

      {!erro && (
        <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {colunasLista.map(c => <th key={c.nome} style={celulaCabecalho}>{c.rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {!carregando && estado.registros.length === 0 && (
                <tr><td colSpan={Math.max(1, colunasLista.length)} style={{ ...celula, color: COR.texto2, textAlign: 'center', padding: '28px' }}>
                  Nenhum registro encontrado{buscaAplicada ? ` para “${buscaAplicada}”` : ''}.
                </td></tr>
              )}
              {estado.registros.map(r => (
                <tr
                  key={String(r[idCampo])}
                  onClick={() => setSelecionado(r)}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') { setSelecionado(r); } }}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = COR.azulClaro; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  {colunasLista.map(c => (
                    <td key={c.nome} style={{ ...celula, fontWeight: c.nome === nomeCampo ? 600 : 400, whiteSpace: c.tipo === 'moeda' || c.tipo === 'data' ? 'nowrap' : undefined }}>
                      {valorExibido(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estado.proximaPagina && !erro && (
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button type="button" style={botao('secundario', carregandoMais)} disabled={carregandoMais} onClick={() => { carregarMais().catch(() => undefined); }}>
            {carregandoMais ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}

      {selecionado && (
        <Modal
          titulo={String(selecionado[nomeCampo] || tabela.rotuloSingular)}
          subtitulo={tabela.rotuloSingular}
          aoFechar={() => setSelecionado(undefined)}
          rodape={
            <>
              <button type="button" style={botao('secundario')} onClick={() => setSelecionado(undefined)}>Fechar</button>
              <a
                href={servico.linkRegistro(tabela.logicalName, String(selecionado[idCampo]))}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...botao('principal'), textDecoration: 'none' }}
              >
                Abrir no Dynamics ↗
              </a>
            </>
          }
        >
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: '10px 16px', margin: 0, fontSize: '14px' }}>
            {estado.colunas.map(c => (
              <React.Fragment key={c.nome}>
                <dt style={{ ...rotulo, margin: 0, alignSelf: 'center' }}>{c.rotulo}</dt>
                <dd style={{ margin: 0, wordBreak: 'break-word' }}>{valorExibido(selecionado, c)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Outras tabelas (personalizadas)
// ------------------------------------------------------------

const OutrasTabelas: React.FC<{ servico: CrmService }> = ({ servico }) => {

  const [tabelas, setTabelas] = React.useState<ITabelaPersonalizadaCrm[] | undefined>(undefined);
  const [escolhida, setEscolhida] = React.useState('');
  const [registros, setRegistros] = React.useState<IRegistroCrm[]>([]);
  const [total, setTotal] = React.useState<number | undefined>(undefined);
  const [proxima, setProxima] = React.useState<string | undefined>(undefined);
  const [busca, setBusca] = React.useState('');
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    servico.listarTabelasPersonalizadas()
      .then(lista => setTabelas(lista))
      .catch(e => setErro(String((e as Error)?.message || e)));
  }, [servico]);

  const tabela = (tabelas || []).filter(t => t.logicalName === escolhida)[0];

  const carregar = async (buscaTexto: string): Promise<void> => {
    if (!tabela) {
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const pagina = await servico.listarGenerico(tabela, buscaTexto);
      setRegistros(pagina.registros);
      setTotal(pagina.total);
      setProxima(pagina.proximaPagina);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregando(false);
    }
  };

  React.useEffect(() => {
    setRegistros([]);
    setTotal(undefined);
    setProxima(undefined);
    setBusca('');
    carregar('').catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhida]);

  const mais = async (): Promise<void> => {
    if (!proxima) {
      return;
    }
    const pagina = await servico.proximaPagina(proxima);
    setRegistros(atual => atual.concat(pagina.registros));
    setProxima(pagina.proximaPagina);
  };

  const data = (v: unknown): string => {
    const d = new Date(String(v || ''));
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  };

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: '14px', color: COR.texto2, maxWidth: '80ch', lineHeight: 1.5 }}>
        Tabelas personalizadas criadas no ambiente do CRM (por exemplo, as usadas pelo app “DGT - CRM IA Lab”).
        Aqui aparecem só o nome e as datas; para os campos completos, use “Abrir no Dynamics”.
      </p>

      {erro && <ErroCrm mensagem={erro} />}

      {!tabelas && !erro && <span style={{ fontSize: '13.5px', color: COR.texto2 }}>Carregando tabelas…</span>}

      {tabelas && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <select aria-label="Tabela" value={escolhida} onChange={e => setEscolhida(e.target.value)} style={{ ...campo, width: 'auto', minWidth: '260px' }}>
            <option value="">Escolha uma tabela ({tabelas.length})</option>
            {tabelas.map(t => <option key={t.logicalName} value={t.logicalName}>{t.rotulo} ({t.logicalName})</option>)}
          </select>
          {tabela && (
            <>
              <input
                aria-label="Buscar pelo nome"
                placeholder="Buscar pelo nome…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { carregar(busca).catch(() => undefined); } }}
                style={{ ...campo, width: 'auto', flex: '1 1 220px', maxWidth: '360px' }}
              />
              <button type="button" style={botao('principal')} onClick={() => { carregar(busca).catch(() => undefined); }}>Buscar</button>
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: COR.texto2 }}>
                {carregando ? 'Carregando…' : total !== undefined ? `${total.toLocaleString('pt-BR')} registros` : ''}
              </span>
            </>
          )}
        </div>
      )}

      {tabela && !erro && (
        <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={celulaCabecalho}>Nome</th>
                <th style={celulaCabecalho}>Proprietário</th>
                <th style={celulaCabecalho}>Criado em</th>
                <th style={celulaCabecalho}>Modificado em</th>
                <th style={celulaCabecalho} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {!carregando && registros.length === 0 && (
                <tr><td colSpan={5} style={{ ...celula, textAlign: 'center', color: COR.texto2, padding: '28px' }}>Nenhum registro.</td></tr>
              )}
              {registros.map(r => (
                <tr key={String(r[tabela.idPrimario])}>
                  <td style={{ ...celula, fontWeight: 600 }}>{String(r[tabela.nomePrimario] || '—')}</td>
                  <td style={celula}>{String(r[`_ownerid_value${FORMATADO}`] || '—')}</td>
                  <td style={celula}>{data(r.createdon)}</td>
                  <td style={celula}>{data(r.modifiedon)}</td>
                  <td style={{ ...celula, textAlign: 'right' }}>
                    <a href={servico.linkRegistro(tabela.logicalName, String(r[tabela.idPrimario]))} target="_blank" rel="noopener noreferrer" style={{ color: COR.indigo, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Abrir ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proxima && (
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button type="button" style={botao('secundario')} onClick={() => { mais().catch(e => setErro(String((e as Error)?.message || e))); }}>Carregar mais</button>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const CrmPage: React.FC<ICrmPageProps> = () => {

  const [chaveAmbiente, setChaveAmbiente] = React.useState(CRM_AMBIENTES.length > 0 ? CRM_AMBIENTES[0].chave : '');
  const ambiente = CRM_AMBIENTES.filter(a => a.chave === chaveAmbiente)[0];

  const servico = React.useMemo(
    () => (ambiente ? new CrmService(ambiente) : undefined),
    [ambiente]
  );

  const [aba, setAba] = React.useState<AbaCrm>('visao');
  const [disponiveis, setDisponiveis] = React.useState<ITabelaCrm[] | undefined>(undefined);
  const [erro, setErro] = React.useState('');

  const verificar = React.useCallback(async (): Promise<void> => {
    if (!servico || !servico.configurado) {
      return;
    }
    setErro('');
    setDisponiveis(undefined);
    try {
      await servico.testarConexao();
      const metas = await Promise.all(CRM_TABELAS.map(t => servico.obterMetadados(t.logicalName)));
      setDisponiveis(CRM_TABELAS.filter((t, i) => !!metas[i]));
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico]);

  React.useEffect(() => {
    setAba('visao');
    verificar().catch(() => undefined);
  }, [verificar]);

  const abas: Array<{ id: AbaCrm; rotulo: string }> = [{ id: 'visao', rotulo: 'Visão geral' }]
    .concat((disponiveis || []).map(t => ({ id: t.chave, rotulo: t.rotulo })))
    .concat([{ id: 'outras', rotulo: 'Outras tabelas' }]);

  const tabelaAba = (disponiveis || []).filter(t => t.chave === aba)[0];

  return (
    <div style={{ fontFamily: FONTE, color: COR.azul }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>CRM</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: COR.texto2, maxWidth: '70ch', lineHeight: 1.5 }}>
            Contas, contatos, leads e oportunidades do Dynamics 365, sem sair do portal. Para criar ou alterar registros, use “Abrir no Dynamics”.
          </p>
        </div>
        {CRM_AMBIENTES.length > 1 && (
          <select aria-label="Ambiente do CRM" value={chaveAmbiente} onChange={e => setChaveAmbiente(e.target.value)} style={{ ...campo, width: 'auto' }}>
            {CRM_AMBIENTES.map(a => <option key={a.chave} value={a.chave}>{a.nome}</option>)}
          </select>
        )}
        {ambiente && <Selo tom="ciano" titulo={ambiente.url}>{ambiente.nome}</Selo>}
      </div>

      {!ambiente && <Aviso tipo="alerta">Nenhum ambiente de CRM está configurado em constants/crm.ts.</Aviso>}

      {ambiente && servico && !servico.configurado && <ConfigurarCrm ambiente={ambiente} />}

      {servico && servico.configurado && erro && (
        <ErroCrm mensagem={erro} aoTentar={() => { verificar().catch(() => undefined); }} />
      )}

      {servico && servico.configurado && !erro && !disponiveis && (
        <span style={{ fontSize: '13.5px', color: COR.texto2 }}>Conectando ao CRM…</span>
      )}

      {servico && servico.configurado && !erro && disponiveis && (
        <>
          <div role="tablist" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: `2px solid ${COR.cinzaClaro}`, marginBottom: '18px' }}>
            {abas.map(a => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '10px 14px',
                  marginBottom: '-2px',
                  borderBottom: `3px solid ${aba === a.id ? COR.ciano : 'transparent'}`,
                  color: aba === a.id ? COR.azul : COR.texto2,
                  fontWeight: aba === a.id ? 700 : 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: FONTE
                }}
              >
                {a.rotulo}
              </button>
            ))}
          </div>

          {aba === 'visao' && <VisaoGeral servico={servico} tabelasDisponiveis={disponiveis} aoAbrirAba={setAba} />}
          {tabelaAba && <ListaTabela key={tabelaAba.chave} servico={servico} tabela={tabelaAba} />}
          {aba === 'outras' && <OutrasTabelas servico={servico} />}
        </>
      )}
    </div>
  );
};

export default CrmPage;
