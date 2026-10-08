import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  FABRICANTES,
  IAlteracaoRo,
  IRegistroOportunidade,
  IRoEdicao,
  MODALIDADES,
  RoService,
  SITUACOES,
  STATUS_RO,
  hojeIso
} from '../../services/bom/RoService';

import {
  COR,
  FONTE,
  botao,
  campo,
  rotulo
} from './arquiteturaComum';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — REGISTROS DE OPORTUNIDADE (RO)
//
// Base única dos ROs de todos os fabricantes (substitui a planilha
// "Tabela de Controle de ROs - Pré-Vendas", uma aba por fabricante).
//   - Indicadores clicáveis (filtros rápidos)
//   - Busca, filtros por fabricante/modalidade/executivo
//   - Tabela ordenável, agrupável por fabricante, exportável (CSV)
//   - Painel lateral para cadastrar/editar, "atualizado hoje" e
//     histórico de alterações (auditoria do Dataverse)
// ============================================================

export interface IRegistrosOportunidadePageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
}

// Prazo para considerar o RO "sem atualização" junto ao fabricante
const DIAS_SEM_ATUALIZACAO = 30;

// Antecedência para avisar o vencimento do RO
const DIAS_VENCIMENTO = 30;

type FiltroRapido = 'ativas' | 'vencendo' | 'desatualizadas' | 'ganhos' | 'perdidas' | 'todas';

type Ordem = { coluna: keyof IRegistroOportunidade; direcao: 1 | -1 };

const COR_FABRICANTE: { [fab: string]: string } = {
  Intelbras: '#0E8A4F',
  Hikvision: '#C8102E',
  Dahua: '#E05A1B',
  'TP-Link': '#1A9AA0',
  NHS: '#D98A1F',
  Milestone: '#1E5AA8',
  Digifort: '#5B3FA8',
  IPX: '#475569',
  Axxon: '#0067B1'
};

const ESTILO_STATUS: { [s: string]: { texto: string; cor: string; fundo: string } } = {
  Ativo: { texto: 'Ativa', cor: '#0B6E8A', fundo: '#E3F5FA' },
  'Avaliação de RO': { texto: 'Em avaliação', cor: '#B45309', fundo: '#FEF3E2' },
  Perdido: { texto: 'Perdida', cor: '#B42318', fundo: '#FDECEC' }
};

const ESTILO_SITUACAO: { [s: string]: { cor: string; fundo: string } } = {
  Ganho: { cor: '#FFFFFF', fundo: '#13A06F' },
  Perdido: { cor: '#B42318', fundo: '#FDECEC' },
  'Em recurso': { cor: '#6B4FBB', fundo: '#F1ECFB' },
  Suspenso: { cor: '#B45309', fundo: '#FEF3E2' },
  Anulado: { cor: '#475569', fundo: '#EEF2F6' },
  'Em andamento': { cor: '#334155', fundo: '#F1F5F9' }
};

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

const moeda = (valor?: number): string =>
  valor === undefined || isNaN(valor)
    ? '—'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const moedaCurta = (valor: number): string => {
  if (valor >= 1e9) return `R$ ${(valor / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (valor >= 1e6) return `R$ ${(valor / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (valor >= 1e3) return `R$ ${(valor / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return moeda(valor);
};

const dataBr = (iso: string): string =>
  iso ? `${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}` : '—';

const dataHoraBr = (valor: string): string => {
  const d = new Date(valor);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const diasDesde = (iso: string): number | undefined => {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return undefined;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const diasAte = (iso: string): number | undefined => {
  const desde = diasDesde(iso);
  return desde === undefined ? undefined : -desde;
};

const normalizar = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const ativa = (r: IRegistroOportunidade): boolean =>
  r.ativo && r.statusRo !== 'Perdido';

const desatualizada = (r: IRegistroOportunidade): boolean => {
  const dias = diasDesde(r.dataAtualizacao);
  return ativa(r) && (dias === undefined || dias > DIAS_SEM_ATUALIZACAO);
};

const vencendo = (r: IRegistroOportunidade): boolean => {
  const dias = diasAte(r.validade);
  return ativa(r) && dias !== undefined && dias <= DIAS_VENCIMENTO;
};

const vazio = (): IRoEdicao => ({
  numero: '',
  fabricante: 'Intelbras',
  numeroProjeto: '',
  dataCriacao: hojeIso(),
  projeto: '',
  valor: undefined,
  modalidade: '',
  situacao: 'Em andamento',
  observacao: '',
  executivo: '',
  editalPregao: '',
  statusRo: 'Ativo',
  dataAtualizacao: hojeIso(),
  validade: '',
  vinculo: '',
  ativo: true
});

// ------------------------------------------------------------
// Componentes visuais
// ------------------------------------------------------------

const Pill: React.FC<{ texto: string; cor: string; fundo: string; forte?: boolean }> = ({ texto, cor, fundo, forte }) => (
  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', background: fundo, color: cor, fontSize: '11.5px', fontWeight: forte ? 800 : 700, whiteSpace: 'nowrap' }}>
    {texto}
  </span>
);

const Fabricante: React.FC<{ nome: string }> = ({ nome }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', fontSize: '12.5px', fontWeight: 600, color: COR.azul }}>
    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COR_FABRICANTE[nome] || '#94A3B8' }} />
    {nome || '—'}
  </span>
);

const Kpi: React.FC<{ titulo: string; valor: string; detalhe?: string; cor: string; ativo: boolean; onClick: () => void }> = ({ titulo, valor, detalhe, cor, ativo, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={ativo}
    style={{
      textAlign: 'left',
      padding: '14px 16px',
      borderRadius: '12px',
      border: `1.5px solid ${ativo ? cor : COR.borda}`,
      background: ativo ? `${cor}0F` : '#FFFFFF',
      boxShadow: ativo ? `0 4px 14px ${cor}22` : '0 1px 3px rgba(15,23,42,.04)',
      cursor: 'pointer',
      fontFamily: FONTE,
      borderTop: `4px solid ${cor}`
    }}
  >
    <span style={{ display: 'block', fontSize: '12px', color: COR.texto2, fontWeight: 600 }}>{titulo}</span>
    <strong style={{ display: 'block', fontSize: '24px', color: COR.azul, marginTop: '2px' }}>{valor}</strong>
    {detalhe && <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>{detalhe}</span>}
  </button>
);

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const RegistrosOportunidadePage: React.FC<IRegistrosOportunidadePageProps> = ({ dataverseService, contexto }) => {

  const servico = React.useMemo(
    () => (dataverseService ? new RoService(dataverseService) : undefined),
    [dataverseService]
  );

  const podeDesativar =
    !!contexto && (contexto.perfil === 'Administrador' || contexto.perfil === 'Editor');

  const [registros, setRegistros] = React.useState<IRegistroOportunidade[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');

  const [filtro, setFiltro] = React.useState<FiltroRapido>('ativas');
  const [busca, setBusca] = React.useState('');
  const [fabricantes, setFabricantes] = React.useState<string[]>([]);
  const [modalidade, setModalidade] = React.useState('');
  const [executivo, setExecutivo] = React.useState('');
  const [agrupar, setAgrupar] = React.useState(false);
  const [ordem, setOrdem] = React.useState<Ordem>({ coluna: 'dataAtualizacao', direcao: -1 });

  const [edicao, setEdicao] = React.useState<IRoEdicao | undefined>(undefined);

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      setCarregando(false);
      setErro('Conexão com o Dataverse indisponível nesta tela.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      setRegistros(await servico.listar());
    } catch (e) {
      setErro(`Não foi possível carregar os ROs: ${(e as Error).message}. Confira se a tabela dgt_bom_ro foi criada (criar-tabela-ros.ps1) e se o seu perfil pode lê-la.`);
    } finally {
      setCarregando(false);
    }
  }, [servico]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const avisar = (texto: string): void => {
    setAviso(texto);
    window.setTimeout(() => setAviso(''), 3500);
  };

  // ---------------- Indicadores ----------------

  // "Todas" inclui também os ROs removidos da lista (para reativar).
  const visiveisBase = registros.filter(r => r.ativo || filtro === 'todas');
  const ativas = visiveisBase.filter(ativa);
  const valorAtivas = ativas.reduce((s, r) => s + (r.valor || 0), 0);
  const qtdVencendo = visiveisBase.filter(vencendo).length;
  const qtdDesatualizadas = visiveisBase.filter(desatualizada).length;
  const qtdGanhos = visiveisBase.filter(r => r.situacao === 'Ganho').length;
  const qtdPerdidas = visiveisBase.filter(r => r.statusRo === 'Perdido').length;
  const qtdAvaliacao = visiveisBase.filter(r => r.statusRo === 'Avaliação de RO').length;

  const executivos = React.useMemo(
    () => registros.map(r => r.executivo).filter((v, i, l) => !!v && l.indexOf(v) === i).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [registros]
  );

  const contagemFabricante = (fab: string): number =>
    visiveisBase.filter(r => r.fabricante === fab && (filtro === 'todas' || filtro === 'perdidas' || ativa(r))).length;

  // ---------------- Filtragem e ordenação ----------------

  const termo = normalizar(busca.trim());

  const filtrados = visiveisBase
    .filter(r => {
      switch (filtro) {
        case 'ativas': return ativa(r);
        case 'vencendo': return vencendo(r);
        case 'desatualizadas': return desatualizada(r);
        case 'ganhos': return r.situacao === 'Ganho';
        case 'perdidas': return r.statusRo === 'Perdido';
        default: return true;
      }
    })
    .filter(r => fabricantes.length === 0 || fabricantes.indexOf(r.fabricante) >= 0)
    .filter(r => !modalidade || (modalidade === '__vazia' ? !r.modalidade : r.modalidade === modalidade))
    .filter(r => !executivo || r.executivo === executivo)
    .filter(r =>
      !termo ||
      normalizar([r.numero, r.numeroProjeto, r.projeto, r.editalPregao, r.executivo, r.observacao, r.vinculo].join(' ')).indexOf(termo) >= 0
    )
    .sort((a, b) => {
      const va = a[ordem.coluna];
      const vb = b[ordem.coluna];
      if (typeof va === 'number' || typeof vb === 'number') {
        return (((va as number) || 0) - ((vb as number) || 0)) * ordem.direcao;
      }
      const sa = String(va || '');
      const sb = String(vb || '');
      if (!sa && sb) return 1;
      if (sa && !sb) return -1;
      return sa.localeCompare(sb, 'pt-BR', { numeric: true }) * ordem.direcao;
    });

  const totalFiltrado = filtrados.reduce((s, r) => s + (r.valor || 0), 0);

  const grupos: { titulo: string; itens: IRegistroOportunidade[] }[] =
    agrupar
      ? FABRICANTES.concat(filtrados.map(r => r.fabricante).filter(f => FABRICANTES.indexOf(f) < 0))
        .filter((f, i, l) => l.indexOf(f) === i)
        .map(f => ({ titulo: f, itens: filtrados.filter(r => r.fabricante === f) }))
        .filter(g => g.itens.length > 0)
      : [{ titulo: '', itens: filtrados }];

  const ordenarPor = (coluna: keyof IRegistroOportunidade): void => {
    setOrdem(atual => ({ coluna, direcao: atual.coluna === coluna ? (atual.direcao === 1 ? -1 : 1) : 1 }));
  };

  const filtrosAtivos =
    fabricantes.length > 0 || !!modalidade || !!executivo || !!busca;

  const limparFiltros = (): void => {
    setFabricantes([]);
    setModalidade('');
    setExecutivo('');
    setBusca('');
  };

  // ---------------- Exportar CSV ----------------

  const exportar = (): void => {
    const cab = ['Nº RO', 'Fabricante', 'Nº projeto', 'Criação', 'Cliente / projeto', 'Valor', 'Modalidade', 'Edital / pregão', 'Executivo', 'Status RO', 'Situação', 'Validade', 'Última atualização', 'Substituição', 'Observações'];
    const esc = (v: string): string => `"${(v || '').replace(/"/g, '""')}"`;
    const linhas = filtrados.map(r => [
      r.numero, r.fabricante, r.numeroProjeto, dataBr(r.dataCriacao), r.projeto,
      r.valor === undefined ? '' : r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      r.modalidade, r.editalPregao, r.executivo, r.statusRo, r.situacao,
      r.validade ? dataBr(r.validade) : '', r.dataAtualizacao ? dataBr(r.dataAtualizacao) : '', r.vinculo, r.observacao
    ].map(esc).join(';'));
    const conteudo = '\ufeff' + [cab.map(esc).join(';')].concat(linhas).join('\r\n');
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registros-de-oportunidade-${hojeIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---------------- Render ----------------

  const th = (titulo: string, coluna?: keyof IRegistroOportunidade, alinhar: 'left' | 'right' = 'left'): JSX.Element => (
    <th
      key={titulo}
      onClick={coluna ? () => ordenarPor(coluna) : undefined}
      style={{
        textAlign: alinhar,
        padding: '10px 12px',
        fontSize: '11.5px',
        fontWeight: 700,
        color: COR.texto2,
        background: '#F8FAFC',
        borderBottom: `1px solid ${COR.borda}`,
        cursor: coluna ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        position: 'sticky',
        top: 0,
        zIndex: 1,
        userSelect: 'none'
      }}
      aria-sort={coluna && ordem.coluna === coluna ? (ordem.direcao === 1 ? 'ascending' : 'descending') : undefined}
    >
      {titulo}
      {coluna && ordem.coluna === coluna && <span style={{ marginLeft: '4px', color: '#0B5CAB' }}>{ordem.direcao === 1 ? '↑' : '↓'}</span>}
    </th>
  );

  const td: React.CSSProperties = { padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '12.5px', color: COR.azul, verticalAlign: 'middle' };

  const linha = (r: IRegistroOportunidade): JSX.Element => {
    const st = ESTILO_STATUS[r.statusRo] || ESTILO_STATUS.Ativo;
    const si = ESTILO_SITUACAO[r.situacao] || ESTILO_SITUACAO['Em andamento'];
    const diasAtual = diasDesde(r.dataAtualizacao);
    const atrasada = desatualizada(r);
    const diasVal = diasAte(r.validade);
    const vence = vencendo(r);

    return (
      <tr
        key={r.id}
        onClick={() => setEdicao({ ...r })}
        style={{ cursor: 'pointer', background: '#FFFFFF' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F9FF'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}
      >
        <td style={td}>
          <strong style={{ fontSize: '12.5px' }}>{r.numero}</strong>
          {!r.ativo && <span style={{ marginLeft: '6px', fontSize: '10.5px', fontWeight: 800, color: '#B42318' }}>REMOVIDO</span>}
          {r.numeroProjeto && <div style={{ fontSize: '11px', color: COR.texto2 }}>{r.numeroProjeto}</div>}
        </td>
        <td style={td}><Fabricante nome={r.fabricante} /></td>
        <td style={{ ...td, maxWidth: '240px' }}>
          <div style={{ fontWeight: 600 }}>{r.projeto || '—'}</div>
          {r.vinculo && <div style={{ fontSize: '11px', color: '#6B4FBB' }} title={r.vinculo}>↔ {r.vinculo}</div>}
        </td>
        <td style={{ ...td, color: r.modalidade ? COR.azul : COR.texto2 }}>{r.modalidade || 'Não informada'}</td>
        <td style={{ ...td, maxWidth: '180px', color: r.editalPregao ? COR.azul : COR.texto2 }}>{r.editalPregao || '—'}</td>
        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: r.valor ? COR.azul : COR.texto2 }}>{moeda(r.valor)}</td>
        <td style={{ ...td, color: r.executivo ? COR.azul : COR.texto2 }}>{r.executivo || '—'}</td>
        <td style={td}><Pill texto={st.texto} cor={st.cor} fundo={st.fundo} /></td>
        <td style={td}><Pill texto={r.situacao === 'Ganho' ? '★ Ganho' : r.situacao} cor={si.cor} fundo={si.fundo} forte={r.situacao === 'Ganho'} /></td>
        <td style={{ ...td, whiteSpace: 'nowrap', color: vence ? '#B42318' : r.validade ? COR.azul : COR.texto2, fontWeight: vence ? 700 : 400 }}
          title={diasVal === undefined ? 'Sem validade informada' : diasVal < 0 ? `Venceu há ${-diasVal} dia(s)` : `Vence em ${diasVal} dia(s)`}>
          {vence && '⚠ '}{r.validade ? dataBr(r.validade) : '—'}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap' }} title={diasAtual === undefined ? 'Sem data de atualização' : `Atualizado há ${diasAtual} dia(s)`}>
          <span style={{ color: atrasada ? '#B45309' : COR.azul, fontWeight: atrasada ? 700 : 400 }}>{atrasada && '⏱ '}{r.dataAtualizacao ? dataBr(r.dataAtualizacao) : '—'}</span>
          {diasAtual !== undefined && <div style={{ fontSize: '11px', color: atrasada ? '#B45309' : COR.texto2 }}>{diasAtual === 0 ? 'hoje' : `há ${diasAtual} dia(s)`}</div>}
        </td>
      </tr>
    );
  };

  const opcoesFiltro: { id: FiltroRapido; texto: string }[] = [
    { id: 'ativas', texto: 'ROs ativas' },
    { id: 'vencendo', texto: `Vencendo em ${DIAS_VENCIMENTO} dias` },
    { id: 'desatualizadas', texto: `Sem atualização há +${DIAS_SEM_ATUALIZACAO} dias` },
    { id: 'ganhos', texto: 'Ganhos' },
    { id: 'perdidas', texto: 'Perdidas / declinadas' },
    { id: 'todas', texto: 'Todas' }
  ];

  return (
    <section style={{ fontFamily: FONTE }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: COR.azul }}>Registros de Oportunidade (RO)</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: COR.texto2 }}>
            Base única de todos os fabricantes. Clique em um RO para editar, registrar a atualização ou ver o histórico.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" style={botao('secundario', filtrados.length === 0)} disabled={filtrados.length === 0} onClick={exportar}>⭳ Exportar CSV</button>
          <button type="button" style={botao('principal', !servico)} disabled={!servico} onClick={() => setEdicao(vazio())}>+ Novo RO</button>
        </div>
      </div>

      {aviso && <div role="status" style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '10px', background: '#E6F6EF', color: '#0E7C56', fontWeight: 700, fontSize: '13px' }}>✓ {aviso}</div>}
      {erro && <div role="alert" style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '10px', background: '#FDECEC', color: '#B42318', fontSize: '13px' }}>{erro}</div>}

      {/* Indicadores (também são filtros) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Kpi titulo="ROs ativas" valor={String(ativas.length)} detalhe={`${qtdAvaliacao} em avaliação`} cor="#0B5CAB" ativo={filtro === 'ativas'} onClick={() => setFiltro('ativas')} />
        <Kpi titulo="Valor registrado (ativas)" valor={moedaCurta(valorAtivas)} detalhe={moeda(valorAtivas)} cor="#13A06F" ativo={false} onClick={() => setFiltro('ativas')} />
        <Kpi titulo={`Vencendo em ${DIAS_VENCIMENTO} dias`} valor={String(qtdVencendo)} detalhe="pela validade do RO" cor="#C8102E" ativo={filtro === 'vencendo'} onClick={() => setFiltro('vencendo')} />
        <Kpi titulo={`Sem atualização +${DIAS_SEM_ATUALIZACAO} dias`} valor={String(qtdDesatualizadas)} detalhe="junto ao fabricante" cor="#D98A1F" ativo={filtro === 'desatualizadas'} onClick={() => setFiltro('desatualizadas')} />
        <Kpi titulo="Ganhos" valor={String(qtdGanhos)} detalhe="projetos ganhos" cor="#6B4FBB" ativo={filtro === 'ganhos'} onClick={() => setFiltro('ganhos')} />
        <Kpi titulo="Perdidas / declinadas" valor={String(qtdPerdidas)} cor="#64748B" ativo={filtro === 'perdidas'} onClick={() => setFiltro('perdidas')} />
      </div>

      {/* Barra de filtros */}
      <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '12px', display: 'grid', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {opcoesFiltro.map(o => (
            <button key={o.id} type="button" onClick={() => setFiltro(o.id)} aria-pressed={filtro === o.id}
              style={{ padding: '6px 12px', borderRadius: '999px', border: `1px solid ${filtro === o.id ? COR.azul : COR.borda}`, background: filtro === o.id ? COR.azul : '#FFFFFF', color: filtro === o.id ? '#FFFFFF' : COR.azul, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: FONTE }}>
              {o.texto}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input aria-label="Buscar" placeholder="Buscar nº do RO, cliente, edital, executivo…" value={busca} onChange={e => setBusca(e.target.value)} style={{ ...campo, flex: '1 1 260px', maxWidth: '360px' }} />
          <select aria-label="Modalidade" value={modalidade} onChange={e => setModalidade(e.target.value)} style={{ ...campo, width: 'auto', minWidth: '170px' }}>
            <option value="">Todas as modalidades</option>
            {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="__vazia">Não informada</option>
          </select>
          <select aria-label="Executivo" value={executivo} onChange={e => setExecutivo(e.target.value)} style={{ ...campo, width: 'auto', minWidth: '160px' }}>
            <option value="">Todos os executivos</option>
            {executivos.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul, cursor: 'pointer' }}>
            <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} /> Agrupar por fabricante
          </label>
          {filtrosAtivos && <button type="button" onClick={limparFiltros} style={{ border: 0, background: 'transparent', color: '#0B5CAB', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Limpar filtros</button>}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: COR.texto2, marginRight: '4px' }}>Fabricante:</span>
          {FABRICANTES.map(f => {
            const sel = fabricantes.indexOf(f) >= 0;
            const qtd = contagemFabricante(f);
            return (
              <button key={f} type="button" aria-pressed={sel}
                onClick={() => setFabricantes(sel ? fabricantes.filter(x => x !== f) : fabricantes.concat(f))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', border: `1px solid ${sel ? COR_FABRICANTE[f] : COR.borda}`, background: sel ? `${COR_FABRICANTE[f]}14` : '#FFFFFF', color: COR.azul, fontSize: '12px', fontWeight: sel ? 700 : 500, cursor: 'pointer', fontFamily: FONTE, opacity: qtd === 0 && !sel ? 0.55 : 1 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: COR_FABRICANTE[f] }} />
                {f}
                <span style={{ fontSize: '11px', color: COR.texto2 }}>{qtd}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${COR.borda}`, fontSize: '12.5px', color: COR.texto2, flexWrap: 'wrap', gap: '8px' }}>
          <span><strong style={{ color: COR.azul }}>{filtrados.length}</strong> RO(s) na lista · {ativas.length} ativas · {registros.filter(r => r.ativo).length} no total</span>
          <span>Valor da lista: <strong style={{ color: COR.azul }}>{moeda(totalFiltrado)}</strong></span>
        </div>

        <div style={{ overflow: 'auto', maxHeight: '68vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1240px' }}>
            <thead>
              <tr>
                {th('Nº RO', 'numero')}
                {th('Fabricante', 'fabricante')}
                {th('Cliente / projeto', 'projeto')}
                {th('Modalidade', 'modalidade')}
                {th('Edital / pregão', 'editalPregao')}
                {th('Valor registrado', 'valor', 'right')}
                {th('Executivo', 'executivo')}
                {th('Status do RO', 'statusRo')}
                {th('Situação', 'situacao')}
                {th('Validade', 'validade')}
                {th('Últ. atualização', 'dataAtualizacao')}
              </tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={11} style={{ ...td, padding: '24px', color: COR.texto2 }}>Carregando registros…</td></tr>}
              {!carregando && filtrados.length === 0 && (
                <tr><td colSpan={11} style={{ ...td, padding: '32px', textAlign: 'center', color: COR.texto2 }}>
                  Nenhum RO encontrado com esses filtros.{filtrosAtivos && <> <button type="button" onClick={limparFiltros} style={{ border: 0, background: 'transparent', color: '#0B5CAB', fontWeight: 700, cursor: 'pointer' }}>Limpar filtros</button></>}
                </td></tr>
              )}
              {!carregando && grupos.map(g => (
                <React.Fragment key={g.titulo || 'todos'}>
                  {agrupar && (
                    <tr>
                      <td colSpan={11} style={{ padding: '8px 12px', background: '#F1F5F9', borderBottom: `1px solid ${COR.borda}` }}>
                        <Fabricante nome={g.titulo} />
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: COR.texto2 }}>
                          {g.itens.length} RO(s) · {moeda(g.itens.reduce((s, r) => s + (r.valor || 0), 0))}
                        </span>
                      </td>
                    </tr>
                  )}
                  {g.itens.map(linha)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ margin: '10px 2px 0', fontSize: '11.5px', color: COR.texto2 }}>
        ⏱ sem atualização junto ao fabricante há mais de {DIAS_SEM_ATUALIZACAO} dias · ⚠ validade vencida ou vencendo em até {DIAS_VENCIMENTO} dias · Alterações ficam registradas por usuário e data (auditoria).
      </p>

      {edicao && servico && (
        <PainelRo
          servico={servico}
          dados={edicao}
          registro={edicao.id ? registros.find(r => r.id === edicao.id) : undefined}
          executivos={executivos}
          podeDesativar={podeDesativar}
          onFechar={() => setEdicao(undefined)}
          onSalvo={async texto => {
            setEdicao(undefined);
            avisar(texto);
            await carregar();
          }}
        />
      )}
    </section>
  );
};

// ------------------------------------------------------------
// Painel lateral (cadastro / edição / histórico)
// ------------------------------------------------------------

const PainelRo: React.FC<{
  servico: RoService;
  dados: IRoEdicao;
  registro?: IRegistroOportunidade;
  executivos: string[];
  podeDesativar: boolean;
  onFechar: () => void;
  onSalvo: (texto: string) => Promise<void>;
}> = ({ servico, dados, registro, executivos, podeDesativar, onFechar, onSalvo }) => {

  const [form, setForm] = React.useState<IRoEdicao>(dados);
  const [valorTexto, setValorTexto] = React.useState<string>(
    dados.valor === undefined ? '' : dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  );
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aba, setAba] = React.useState<'dados' | 'historico'>('dados');
  const [historico, setHistorico] = React.useState<IAlteracaoRo[] | undefined>(undefined);
  const [erroHistorico, setErroHistorico] = React.useState('');

  const novo = !form.id;

  const alterar = <K extends keyof IRoEdicao>(c: K, v: IRoEdicao[K]): void => setForm(f => ({ ...f, [c]: v }));

  React.useEffect(() => {
    if (aba !== 'historico' || !form.id || historico) return;
    servico.historico(form.id)
      .then(setHistorico)
      .catch((e: Error) => setErroHistorico(`Histórico indisponível: ${e.message}. A auditoria precisa estar ligada e o seu perfil precisa poder exibir o histórico de auditoria.`));
  }, [aba, form.id, historico, servico]);

  const lerValor = (t: string): number | undefined => {
    const limpo = t.replace(/[^\d,.-]/g, '');
    if (!limpo) return undefined;
    const n = Number(limpo.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? undefined : n;
  };

  const executar = async (acao: () => Promise<void>, texto: string): Promise<void> => {
    setSalvando(true);
    setErro('');
    try {
      await acao();
      await onSalvo(texto);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const salvar = (): void => {
    executar(() => servico.salvar({ ...form, valor: lerValor(valorTexto) }), novo ? 'RO cadastrado.' : 'RO atualizado.').catch(() => undefined);
  };

  const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
  const bloco: React.CSSProperties = { display: 'grid', gap: '12px', padding: '14px', border: `1px solid ${COR.borda}`, borderRadius: '12px', background: '#FFFFFF' };
  const titBloco: React.CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 800, letterSpacing: '.04em', color: COR.texto2, textTransform: 'uppercase' };

  return ReactDOM.createPortal(
    <div role="dialog" aria-modal="true" aria-label={novo ? 'Novo RO' : `RO ${form.numero}`}
      onClick={() => { if (!salvando) onFechar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(15,23,42,.35)', display: 'flex', justifyContent: 'flex-end', fontFamily: FONTE }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '560px', height: '100%', background: '#F7F9FB', boxShadow: '-12px 0 40px rgba(15,23,42,.18)', display: 'flex', flexDirection: 'column' }}>

        {/* Topo */}
        <div style={{ padding: '16px 20px', background: '#FFFFFF', borderBottom: `1px solid ${COR.borda}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2 }}>{novo ? 'NOVO REGISTRO DE OPORTUNIDADE' : 'REGISTRO DE OPORTUNIDADE'}</span>
              <h3 style={{ margin: '2px 0 0', fontSize: '18px', color: COR.azul }}>{novo ? 'Novo RO' : form.numero}</h3>
              {!novo && <div style={{ marginTop: '4px' }}><Fabricante nome={form.fabricante} /> <span style={{ fontSize: '12.5px', color: COR.texto2 }}>· {form.projeto}</span></div>}
            </div>
            <button type="button" aria-label="Fechar" onClick={onFechar} style={{ border: 0, background: 'transparent', fontSize: '20px', cursor: 'pointer', color: COR.texto2 }}>✕</button>
          </div>
          {!novo && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
              {(['dados', 'historico'] as const).map(a => (
                <button key={a} type="button" onClick={() => setAba(a)}
                  style={{ padding: '6px 12px', border: 0, borderBottom: `3px solid ${aba === a ? '#0B5CAB' : 'transparent'}`, background: 'transparent', color: aba === a ? '#0B5CAB' : COR.texto2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: FONTE }}>
                  {a === 'dados' ? 'Dados' : 'Histórico'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gap: '14px', alignContent: 'start' }}>

          {erro && <div role="alert" style={{ padding: '10px 12px', borderRadius: '10px', background: '#FDECEC', color: '#B42318', fontSize: '13px' }}>{erro}</div>}

          {aba === 'dados' && (
            <>
              <div style={bloco}>
                <p style={titBloco}>Identificação</p>
                <div style={g2}>
                  <label><span style={rotulo}>Nº do RO *</span><input style={campo} value={form.numero} onChange={e => alterar('numero', e.target.value)} placeholder="Ex.: OP-0690583" /></label>
                  <label><span style={rotulo}>Fabricante *</span>
                    <select style={campo} value={form.fabricante} onChange={e => alterar('fabricante', e.target.value)}>
                      {FABRICANTES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                </div>
                <label><span style={rotulo}>Cliente / projeto</span><input style={campo} value={form.projeto} onChange={e => alterar('projeto', e.target.value)} placeholder="Ex.: PROCERGS - Escolas" /></label>
                <div style={g2}>
                  <label><span style={rotulo}>Nº do projeto no fabricante</span><input style={campo} value={form.numeroProjeto} onChange={e => alterar('numeroProjeto', e.target.value)} placeholder="Opcional (ex.: Hikvision EP-PRJ…)" /></label>
                  <label><span style={rotulo}>Executivo</span>
                    <input style={campo} list="ro-executivos" value={form.executivo} onChange={e => alterar('executivo', e.target.value)} />
                    <datalist id="ro-executivos">{executivos.map(x => <option key={x} value={x} />)}</datalist>
                  </label>
                </div>
              </div>

              <div style={bloco}>
                <p style={titBloco}>Oportunidade</p>
                <div style={g2}>
                  <label><span style={rotulo}>Modalidade</span>
                    <select style={campo} value={form.modalidade} onChange={e => alterar('modalidade', e.target.value)}>
                      <option value="">Não informada</option>
                      {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label><span style={rotulo}>Valor registrado (R$)</span><input style={{ ...campo, textAlign: 'right' }} inputMode="decimal" value={valorTexto} onChange={e => setValorTexto(e.target.value)} placeholder="0,00" /></label>
                </div>
                <label><span style={rotulo}>Edital / pregão</span><input style={campo} value={form.editalPregao} onChange={e => alterar('editalPregao', e.target.value)} placeholder="Ex.: Pregão 8/2026" /></label>
                <label><span style={rotulo}>Substitui / substituído por</span><input style={campo} value={form.vinculo} onChange={e => alterar('vinculo', e.target.value)} placeholder="Ex.: Substitui a OP-0534195" /></label>
              </div>

              <div style={bloco}>
                <p style={titBloco}>Situação e prazos</p>
                <div style={g2}>
                  <label><span style={rotulo}>Status do RO</span>
                    <select style={campo} value={form.statusRo} onChange={e => alterar('statusRo', e.target.value)}>
                      {STATUS_RO.map(s => <option key={s} value={s}>{(ESTILO_STATUS[s] || { texto: s }).texto}</option>)}
                    </select>
                  </label>
                  <label><span style={rotulo}>Situação do projeto</span>
                    <select style={campo} value={form.situacao} onChange={e => alterar('situacao', e.target.value)}>
                      {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ ...g2, gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <label><span style={rotulo}>Criação do RO</span><input type="date" style={campo} value={form.dataCriacao} onChange={e => alterar('dataCriacao', e.target.value)} /></label>
                  <label><span style={rotulo}>Validade</span><input type="date" style={campo} value={form.validade} onChange={e => alterar('validade', e.target.value)} /></label>
                  <label><span style={rotulo}>Últ. atualização</span><input type="date" style={campo} value={form.dataAtualizacao} onChange={e => alterar('dataAtualizacao', e.target.value)} /></label>
                </div>
                <label><span style={rotulo}>Observações</span><textarea rows={3} style={{ ...campo, resize: 'vertical' }} value={form.observacao} onChange={e => alterar('observacao', e.target.value)} /></label>
              </div>

              {registro && (
                <p style={{ margin: 0, fontSize: '11.5px', color: COR.texto2 }}>
                  Criado por <strong>{registro.criadoPor || '—'}</strong> em {dataHoraBr(registro.criadoEm)} · Alterado por <strong>{registro.alteradoPor || '—'}</strong> em {dataHoraBr(registro.alteradoEm)}
                </p>
              )}
            </>
          )}

          {aba === 'historico' && (
            <div style={bloco}>
              <p style={titBloco}>Histórico de alterações</p>
              {erroHistorico && <p style={{ margin: 0, fontSize: '12.5px', color: '#B45309' }}>{erroHistorico}</p>}
              {!erroHistorico && !historico && <p style={{ margin: 0, fontSize: '12.5px', color: COR.texto2 }}>Carregando…</p>}
              {historico && historico.length === 0 && <p style={{ margin: 0, fontSize: '12.5px', color: COR.texto2 }}>Nenhuma alteração registrada ainda.</p>}
              {historico && historico.length > 0 && (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {historico.map((h, i) => (
                    <li key={i} style={{ position: 'relative', padding: '0 0 14px 20px', borderLeft: `2px solid ${COR.borda}`, marginLeft: '6px' }}>
                      <span style={{ position: 'absolute', left: '-7px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#FFFFFF', border: '2px solid #0B5CAB' }} />
                      <div style={{ fontSize: '12.5px', color: COR.azul }}><strong>{h.usuario}</strong> · {h.acao}</div>
                      <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{dataHoraBr(h.data)}</div>
                      {h.campos.map((c, j) => (
                        <div key={j} style={{ marginTop: '4px', fontSize: '12px', color: '#334155' }}>
                          <strong>{c.campo}:</strong> <span style={{ textDecoration: 'line-through', color: COR.texto2 }}>{c.antes || 'vazio'}</span> → {c.depois || 'vazio'}
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        {aba === 'dados' && (
          <div style={{ padding: '12px 20px', background: '#FFFFFF', borderTop: `1px solid ${COR.borda}`, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!novo && (
              <button type="button" style={botao('secundario', salvando)} disabled={salvando}
                title="Registra que o RO foi atualizado hoje junto ao fabricante"
                onClick={() => { executar(() => servico.marcarAtualizado(form.id as string), 'RO marcado como atualizado hoje.').catch(() => undefined); }}>
                ↻ Atualizado hoje
              </button>
            )}
            {!novo && podeDesativar && (
              <button type="button" style={{ ...botao('secundario', salvando), color: '#B42318' }} disabled={salvando}
                onClick={() => {
                  if (window.confirm(form.ativo ? 'Remover este RO da lista? Ele fica guardado no histórico e pode ser reativado.' : 'Reativar este RO?')) {
                    executar(() => servico.definirAtivo(form.id as string, !form.ativo), form.ativo ? 'RO removido da lista.' : 'RO reativado.').catch(() => undefined);
                  }
                }}>
                {form.ativo ? 'Remover da lista' : 'Reativar'}
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" style={botao('secundario', salvando)} disabled={salvando} onClick={onFechar}>Cancelar</button>
            <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : novo ? 'Cadastrar RO' : 'Salvar'}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default RegistrosOportunidadePage;
