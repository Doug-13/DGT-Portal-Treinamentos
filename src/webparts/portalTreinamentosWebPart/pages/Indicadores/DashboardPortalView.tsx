import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  Farol,
  FormatoValor,
  IDefinicaoDashboard,
  IItemCartao,
  IItemGrafico,
  IItemTabela,
  ItemDashboard,
  Linha,
  agregar,
  agrupar,
  aplicarFiltro,
  farolDe,
  fontesUsadas,
  ordenarGrupos,
  paginasDoDashboard
} from '../../services/dashboards/dashboardModelo';

import {
  CATALOGO_DASHBOARD,
  carregarFonte,
  rotuloMes
} from '../../services/dashboards/fontesDashboard';

import {
  GraficoBarras,
  GraficoLinhas,
  GraficoRosca
} from './graficosDashboard';

import AssistenteDashboard from './AssistenteDashboard';

import {
  assistenteAtivo
} from '../../services/dashboards/assistenteDashboard';

// ============================================================
// DASHBOARD DO PORTAL (definição JSON da skill "dashboard-dgt")
//
// Busca ao vivo no Dataverse as fontes usadas pela definição, com o
// filtro de ANO e de ÁREA (só as áreas que a pessoa pode ver; o
// Administrador vê todas) e desenha cartões, gráficos e tabelas.
// ============================================================

export interface IDashboardPortalViewProps {
  // Id do registro dgt_dashboard (usado pela IA; vazio na pré-visualização).
  dashboardId?: string;
  definicao: IDefinicaoDashboard;
  dataverseService: DataverseService;
  // Áreas que a pessoa pode ver (undefined = todas).
  areasPermitidas?: string[];
  // Todas as áreas (id, nome) para o seletor.
  areas: Array<{ id: string; nome: string }>;
}

const COR = {
  navy: '#0B1E2D',
  ciano: '#21BADC',
  texto: '#14232F',
  muted: '#6B7C8C',
  linha: '#E1E8EF',
  verde: '#1FA971',
  amarelo: '#E6A400',
  vermelho: '#D84C3E',
  cinza: '#9AA9B8'
};

const COR_FAROL: { [farol in Farol]: string } = { verde: COR.verde, amarelo: COR.amarelo, vermelho: COR.vermelho, semDado: COR.cinza };
const ROTULO_FAROL: { [farol in Farol]: string } = { verde: 'No alvo', amarelo: 'Atenção', vermelho: 'Crítico', semDado: 'Sem dado' };

const formatador = (formato?: FormatoValor): ((valor: number) => string) => (valor: number): string => {
  if (valor === null || valor === undefined || !isFinite(valor)) {
    return '—';
  }
  if (formato === 'moeda') {
    const abs = Math.abs(valor);
    if (abs >= 1000000) {
      return `R$ ${(valor / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
    }
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (formato === 'percentual') {
    return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }
  if (formato === 'inteiro') {
    return Math.round(valor).toLocaleString('pt-BR');
  }
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
};

const campoDe = (fonte: string, campo: string): { tipo: string; rotulo: string } => {
  const descricao = CATALOGO_DASHBOARD.filter(item => item.id === fonte)[0];
  const encontrado = descricao ? descricao.campos.filter(item => item.chave === campo)[0] : undefined;
  return encontrado ? { tipo: encontrado.tipo, rotulo: encontrado.rotulo } : { tipo: 'texto', rotulo: campo };
};

const rotuloValor = (fonte: string, campo: string, valor: unknown): string => {
  if (campoDe(fonte, campo).tipo === 'mes') {
    return rotuloMes(valor);
  }
  if (campoDe(fonte, campo).tipo === 'data' && valor) {
    const data = new Date(String(valor).length <= 10 ? `${valor}T12:00:00` : String(valor));
    return isNaN(data.getTime()) ? String(valor) : data.toLocaleDateString('pt-BR');
  }
  return valor === null || valor === undefined || valor === '' ? '(vazio)' : String(valor);
};

const cartaoEstilo: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '14px',
  boxShadow: '0 1px 3px rgba(11,30,45,.08),0 6px 18px rgba(11,30,45,.06)',
  padding: '16px 18px'
};

// ------------------------------------------------------------
// Itens
// ------------------------------------------------------------

const Cartao: React.FC<{ item: IItemCartao; linhas: Linha[] }> = ({ item, linhas }) => {
  const filtradas = aplicarFiltro(linhas, item.filtro);
  const valor = agregar(filtradas, { medida: item.medida, agregacao: item.agregacao });
  const formatar = formatador(item.formato);
  const comparacao =
    item.comparar
      ? (() => {
        const referencia = agregar(filtradas, item.comparar as IItemCartao['comparar'] & { medida: string });
        return { referencia, ...farolDe(valor, referencia, item.comparar ? item.comparar.direcao : 'maior') };
      })()
      : undefined;
  const corBorda = comparacao ? COR_FAROL[comparacao.farol] : COR.ciano;
  return (
    <div style={{ ...cartaoEstilo, borderLeft: `4px solid ${corBorda}` }}>
      <div style={{ fontSize: '11px', color: COR.muted, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 700 }}>{item.titulo}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: valor < 0 ? COR.vermelho : COR.navy, marginTop: '6px', lineHeight: 1.1 }}>{formatar(valor)}</div>
      {comparacao && item.comparar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11.5px', color: COR.muted }}>
            {item.comparar.rotulo || campoDe(item.fonte, item.comparar.medida).rotulo}: {formatar(comparacao.referencia)}
            {comparacao.percentual !== undefined ? ` · ${comparacao.percentual.toLocaleString('pt-BR')}%` : ''}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: `${COR_FAROL[comparacao.farol]}22`, color: COR_FAROL[comparacao.farol] }}>
            <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: COR_FAROL[comparacao.farol], display: 'inline-block' }} />
            {ROTULO_FAROL[comparacao.farol]}
          </span>
        </div>
      )}
    </div>
  );
};

const Grafico: React.FC<{ item: IItemGrafico; linhas: Linha[] }> = ({ item, linhas }) => {
  const filtradas = aplicarFiltro(linhas, item.filtro);
  const formatar = formatador(item.formato);
  const ehMes = campoDe(item.fonte, item.dimensao).tipo === 'mes';
  let grupos = agrupar(filtradas, [item.dimensao]).map(grupo => ({
    rotulo: rotuloValor(item.fonte, item.dimensao, grupo.valores[item.dimensao]),
    ordem: ehMes ? Number(grupo.valores[item.dimensao]) : undefined,
    valor: agregar(grupo.linhas, item.series[0]),
    linhas: grupo.linhas
  }));
  grupos = ordenarGrupos(grupos, item.ordenar || (ehMes ? 'dimensao asc' : item.grafico === 'linhas' ? undefined : 'valor desc'));
  if (item.limite && item.limite > 0) {
    grupos = grupos.slice(0, item.limite);
  }
  const categorias = grupos.map(grupo => grupo.rotulo);
  let series;
  if (item.serieDimensao) {
    const valoresSerie = agrupar(filtradas, [item.serieDimensao]).map(grupo => grupo.valores[(item.serieDimensao as string)]);
    series = valoresSerie.map(valorSerie => ({
      nome: rotuloValor(item.fonte, item.serieDimensao as string, valorSerie),
      valores: grupos.map(grupo => agregar(grupo.linhas.filter(linha => String(linha[item.serieDimensao as string]) === String(valorSerie)), item.series[0]))
    }));
  } else {
    series = item.series.map(serie => ({
      nome: serie.rotulo || campoDe(item.fonte, serie.medida).rotulo,
      valores: grupos.map(grupo => agregar(grupo.linhas, serie))
    }));
  }
  if (categorias.length === 0) {
    return <div style={{ padding: '30px', textAlign: 'center', color: COR.muted, fontSize: '13px' }}>Sem dados para os filtros escolhidos.</div>;
  }
  if (item.grafico === 'linhas') {
    return <GraficoLinhas categorias={categorias} series={series} formatar={formatar} />;
  }
  if (item.grafico === 'rosca') {
    return <GraficoRosca categorias={categorias} series={series} formatar={formatar} />;
  }
  return <GraficoBarras categorias={categorias} series={series} formatar={formatar} empilhado={item.grafico === 'barrasEmpilhadas'} />;
};

const Tabela: React.FC<{ item: IItemTabela; linhas: Linha[] }> = ({ item, linhas }) => {
  const filtradas = aplicarFiltro(linhas, item.filtro);
  const formatar = formatador(item.formato);
  const cabecalho: React.CSSProperties = { background: COR.navy, color: '#FFFFFF', textAlign: 'left', padding: '9px 10px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' };
  const celula: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${COR.linha}`, fontSize: '12.5px', color: COR.texto };
  const limite = item.limite && item.limite > 0 ? item.limite : 200;

  if (item.colunas && item.colunas.length > 0) {
    let lista = filtradas.slice();
    if (item.ordenar && item.ordenar.trim().toLowerCase() !== 'nenhum') {
      const [campo, direcao] = item.ordenar.split(/\s+/);
      const fator = (direcao || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      lista.sort((a, b) => {
        const va = a[campo];
        const vb = b[campo];
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'pt-BR')) * fator;
      });
    }
    lista = lista.slice(0, limite);
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{item.colunas.map(coluna => <th key={coluna} style={cabecalho}>{campoDe(item.fonte, coluna).rotulo}</th>)}</tr></thead>
          <tbody>
            {lista.map((linha, i) => (
              <tr key={i}>
                {(item.colunas as string[]).map(coluna => {
                  const numerico = campoDe(item.fonte, coluna).tipo === 'numero';
                  const valor = linha[coluna];
                  return (
                    <td key={coluna} style={{ ...celula, textAlign: numerico ? 'right' : 'left', color: numerico && Number(valor) < 0 ? COR.vermelho : COR.texto }}>
                      {numerico ? formatar(Number(valor)) : rotuloValor(item.fonte, coluna, valor)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: COR.muted, fontSize: '13px' }}>Sem dados.</div>}
      </div>
    );
  }

  const dimensoes = item.dimensoes || [];
  const medidas = item.medidas || [];
  let grupos = agrupar(filtradas, dimensoes).map(grupo => ({
    rotulo: dimensoes.map(d => rotuloValor(item.fonte, d, grupo.valores[d])).join(' · '),
    ordem: dimensoes.length === 1 && campoDe(item.fonte, dimensoes[0]).tipo === 'mes' ? Number(grupo.valores[dimensoes[0]]) : undefined,
    valor: medidas[0] ? agregar(grupo.linhas, medidas[0]) : 0,
    grupo
  }));
  grupos = ordenarGrupos(grupos, item.ordenar || 'valor desc').slice(0, limite);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {dimensoes.map(d => <th key={d} style={cabecalho}>{campoDe(item.fonte, d).rotulo}</th>)}
            {medidas.map((m, i) => <th key={i} style={{ ...cabecalho, textAlign: 'right' }}>{m.rotulo || campoDe(item.fonte, m.medida).rotulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ grupo }) => (
            <tr key={grupo.chave}>
              {dimensoes.map(d => <td key={d} style={celula}>{rotuloValor(item.fonte, d, grupo.valores[d])}</td>)}
              {medidas.map((m, i) => {
                const valor = agregar(grupo.linhas, m);
                return <td key={i} style={{ ...celula, textAlign: 'right', color: valor < 0 ? COR.vermelho : COR.texto, fontVariantNumeric: 'tabular-nums' }}>{formatar(valor)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {grupos.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: COR.muted, fontSize: '13px' }}>Sem dados.</div>}
    </div>
  );
};

// ------------------------------------------------------------
// Tela
// ------------------------------------------------------------

const DashboardPortalView: React.FC<IDashboardPortalViewProps> = (props) => {

  const { definicao } = props;
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = React.useState<number>(new Date().getMonth() >= 6 ? anoAtual + 1 : anoAtual);
  const [area, setArea] = React.useState('');
  const [dados, setDados] = React.useState<{ [fonte: string]: Linha[] }>({});
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');

  // Páginas (abas). Com mais de uma página, a IA ganha uma aba própria
  // ("ia"); com uma página só, a caixa da IA fica no fim, como antes.
  const paginas = React.useMemo(() => paginasDoDashboard(definicao), [definicao]);
  const temIa = assistenteAtivo(definicao);
  const comAbas = paginas.length > 1;
  const [abaAtiva, setAbaAtiva] = React.useState<string>('0');
  React.useEffect(() => { setAbaAtiva('0'); }, [definicao]);

  const areasSelecionaveis =
    props.areas.filter(item => !props.areasPermitidas || props.areasPermitidas.indexOf(item.id) >= 0);

  const areaIds = area ? [area] : props.areasPermitidas;

  React.useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    const fontes = fontesUsadas(definicao);
    Promise.all(fontes.map(fonte => carregarFonte(fonte, { dataverse: props.dataverseService, ano, areaIds }).then(linhas => ({ fonte, linhas }))))
      .then(resultados => {
        if (!ativo) {
          return;
        }
        const mapa: { [fonte: string]: Linha[] } = {};
        resultados.forEach(resultado => { mapa[resultado.fonte] = resultado.linhas; });
        setDados(mapa);
      })
      .catch(falha => { if (ativo) { setErro(falha instanceof Error ? falha.message : String(falha)); } })
      .then(() => { if (ativo) { setCarregando(false); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  // areaIds é derivado de area e areasPermitidas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definicao, props.dataverseService, ano, area, (props.areasPermitidas || []).join(',')]);

  const renderItem = (item: ItemDashboard, chave: string): React.ReactNode => {
    const linhas = dados[item.fonte] || [];
    if (item.tipo === 'cartao') {
      return <Cartao key={chave} item={item} linhas={linhas} />;
    }
    return (
      <div key={chave} style={{ ...cartaoEstilo, gridColumn: (item.largura || 1) === 2 ? '1 / -1' : undefined }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: COR.navy, marginBottom: '10px' }}>{item.titulo}</div>
        {item.tipo === 'grafico' ? <Grafico item={item} linhas={linhas} /> : <Tabela item={item} linhas={linhas} />}
      </div>
    );
  };

  const filtros = definicao.filtros || { ano: true, area: true };

  return (
    <div style={{ fontFamily: "'Segoe UI', Barlow, Arial, sans-serif", color: COR.texto }}>
      <div style={{ background: 'linear-gradient(120deg,#0B1E2D 0%,#0E2740 55%,#123553 100%)', color: '#FFFFFF', borderRadius: '14px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{definicao.titulo}</div>
          {definicao.descricao && <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '3px' }}>{definicao.descricao}</div>}
        </div>
        {filtros.ano !== false && (
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Ano
            <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ padding: '6px 8px', borderRadius: '8px', border: 0, fontSize: '13px' }}>
              {[anoAtual - 1, anoAtual, anoAtual + 1].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        )}
        {filtros.area !== false && (
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Área
            <select value={area} onChange={e => setArea(e.target.value)} style={{ padding: '6px 8px', borderRadius: '8px', border: 0, fontSize: '13px', maxWidth: '240px' }}>
              <option value="">{props.areasPermitidas ? 'Todas as minhas áreas' : 'Todas as áreas'}</option>
              {areasSelecionaveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          style={{ border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
        >
          Imprimir / PDF
        </button>
      </div>

      {erro && <div style={{ ...cartaoEstilo, marginTop: '14px', background: '#FDECEA', color: '#A2352A', fontSize: '13px' }}>Não foi possível carregar os dados: {erro}</div>}
      {carregando && <div style={{ ...cartaoEstilo, marginTop: '14px', color: COR.muted, fontSize: '13px' }}>Carregando dados...</div>}

      {!carregando && comAbas && (
        <nav
          aria-label="Páginas do painel"
          className="dgt-dashboard-abas"
          style={{ display: 'flex', gap: '2px', marginTop: '14px', background: '#FFFFFF', borderRadius: '12px', padding: '4px', boxShadow: '0 1px 3px rgba(11,30,45,.08)', overflowX: 'auto' }}
        >
          <style>{'@media print { .dgt-dashboard-abas { display: none !important; } }'}</style>
          {paginas.map((pagina, indice) => {
            const ativa = abaAtiva === String(indice);
            return (
              <button
                key={pagina.titulo}
                type="button"
                aria-current={ativa ? 'page' : undefined}
                onClick={() => setAbaAtiva(String(indice))}
                style={{
                  border: 0, cursor: 'pointer', whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: '9px',
                  fontSize: '12.5px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase',
                  background: ativa ? COR.navy : 'transparent', color: ativa ? '#FFFFFF' : COR.muted,
                  boxShadow: ativa ? `inset 0 -3px 0 ${COR.ciano}` : 'none'
                }}
              >
                {pagina.titulo}
              </button>
            );
          })}
          {temIa && (
            <button
              type="button"
              aria-current={abaAtiva === 'ia' ? 'page' : undefined}
              onClick={() => setAbaAtiva('ia')}
              style={{
                border: 0, cursor: 'pointer', whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: '9px', marginLeft: 'auto',
                fontSize: '12.5px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase',
                background: abaAtiva === 'ia' ? COR.navy : '#EAF8FC', color: abaAtiva === 'ia' ? '#FFFFFF' : COR.navy,
                boxShadow: abaAtiva === 'ia' ? `inset 0 -3px 0 ${COR.ciano}` : 'none'
              }}
            >
              ✦ Pergunte à IA
            </button>
          )}
        </nav>
      )}

      {!carregando && paginas.map((pagina, indicePagina) => (
        (!comAbas || abaAtiva === String(indicePagina)) && pagina.secoes.map(({ secao, indice: s }) => {
          const cartoes = secao.itens.filter(item => item.tipo === 'cartao');
          const outros = secao.itens.filter(item => item.tipo !== 'cartao');
          return (
            <section key={s} style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: COR.navy, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ width: '5px', height: '19px', background: COR.ciano, borderRadius: '3px', display: 'inline-block' }} />
                {secao.titulo}
                {secao.descricao && <small style={{ fontWeight: 500, fontSize: '12px', color: COR.muted }}>— {secao.descricao}</small>}
              </div>
              {cartoes.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: outros.length > 0 ? '14px' : 0 }}>
                  {cartoes.map((item, i) => renderItem(item, `${s}-c${i}`))}
                </div>
              )}
              {outros.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '14px' }}>
                  {outros.map((item, i) => renderItem(item, `${s}-o${i}`))}
                </div>
              )}
            </section>
          );
        })
      ))}

      {/* A IA fica montada (oculta fora da aba) para a conversa não se
          perder ao navegar entre as páginas. */}
      {!carregando && !erro && temIa && (
        <div style={{ display: !comAbas || abaAtiva === 'ia' ? 'block' : 'none' }}>
          <AssistenteDashboard
            dashboardId={props.dashboardId}
            definicao={definicao}
            dados={dados}
            dataverseService={props.dataverseService}
            ano={filtros.ano !== false ? ano : undefined}
            areaNome={area ? (props.areas.filter(item => item.id === area)[0] || { nome: area }).nome : undefined}
            areaId={area || undefined}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPortalView;
