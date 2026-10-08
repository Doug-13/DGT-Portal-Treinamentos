import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  AreaAdminService
} from '../../services/AreaAdminService';

import {
  BomService,
  EtapaBom,
  IAnaliseGoNoGo,
  IBomRegistro,
  ICriterioGoNoGo,
  IDemandaBom,
  IVisaoGeralBom,
  etapaCalculada
} from '../../services/bom/BomService';

import DadosDemandaEtapa, {
  IUsuarioOpcao
} from './DadosDemandaEtapa';

import MatrizGoNoGoEtapa from './MatrizGoNoGoEtapa';

import {
  COR,
  DECISAO,
  ETAPAS,
  FONTE,
  PASSOS,
  Selo,
  botao,
  campo,
  cartao,
  formatarData,
  formatarNumero
} from './arquiteturaComum';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — "Da demanda ao B.O.M. pronto"
//
// Fase 1 (esta): Visão geral dos B.O.M., Novo B.O.M., etapa 1
// (Dados da demanda) e etapa 2 (Matriz Go/No-Go).
// Etapas 3 a 5 (Seleção de kit, Cálculo de HH e B.O.M. pronto)
// aparecem no indicador de progresso como "em definição".
// ============================================================

export interface IArquiteturaPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
}

type Filtro = 'todos' | 'demandaGo' | 'bloqueados' | 'kit' | 'hhPronto' | 'enviados';

const FILTROS: Array<{ id: Filtro; rotulo: string; etapas: EtapaBom[] }> = [
  { id: 'todos', rotulo: 'Todos os B.O.M.', etapas: [] },
  { id: 'demandaGo', rotulo: 'Demanda ou Go/No-Go pendente', etapas: ['Dados da demanda', 'Go/No-Go pendente'] },
  { id: 'bloqueados', rotulo: 'Bloqueados no Go/No-Go', etapas: ['Bloqueado no Go/No-Go'] },
  { id: 'kit', rotulo: 'Em seleção de kit', etapas: ['Seleção de kit'] },
  { id: 'hhPronto', rotulo: 'HH ou B.O.M. pronto', etapas: ['Cálculo de HH', 'B.O.M. pronto'] },
  { id: 'enviados', rotulo: 'Enviados p/ aprovação', etapas: ['Enviado para aprovação'] }
];

const guid = (valor?: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

// ------------------------------------------------------------
// Indicador de progresso (1 a 5)
// ------------------------------------------------------------

const Progresso: React.FC<{ etapa: EtapaBom; aba: 'demanda' | 'gonogo'; onAba: (aba: 'demanda' | 'gonogo') => void }> = ({ etapa, aba, onAba }) => {
  const atual = ETAPAS[etapa].passo;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px', marginBottom: '16px' }}>
      {
        PASSOS.map(item => {
          const clicavel = item.passo <= 2 && (item.passo === 1 || atual >= 2);
          const selecionado = (item.passo === 1 && aba === 'demanda') || (item.passo === 2 && aba === 'gonogo');
          const concluido = atual > item.passo;
          const emDefinicao = item.passo >= 3;
          return (
            <button
              key={item.passo}
              type="button"
              disabled={!clicavel}
              onClick={() => onAba(item.passo === 1 ? 'demanda' : 'gonogo')}
              title={emDefinicao ? 'Etapa em definição — será construída numa próxima fase.' : undefined}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${selecionado ? COR.ciano : COR.borda}`,
                borderTop: `4px solid ${concluido ? '#107C10' : selecionado ? COR.ciano : emDefinicao ? COR.borda : COR.azul}`,
                background: selecionado ? '#E6F9FC' : '#FFFFFF',
                cursor: clicavel ? 'pointer' : 'default',
                opacity: emDefinicao ? 0.55 : 1,
                fontFamily: FONTE,
                color: COR.azul
              }}
            >
              <span style={{ display: 'block', fontSize: '11px', color: COR.texto2 }}>
                {concluido ? '✓ ' : ''}Etapa {item.passo}{emDefinicao ? ' · em definição' : ''}
              </span>
              <strong style={{ fontSize: '13px' }}>{item.nome}</strong>
            </button>
          );
        })
      }
    </div>
  );
};

// ------------------------------------------------------------
// Novo B.O.M. (modal)
// ------------------------------------------------------------

const NovoBomModal: React.FC<{
  demandasLivres: IDemandaBom[];
  usuarios: IUsuarioOpcao[];
  responsavelPadrao: string;
  salvando: boolean;
  onCriar: (demandaId: string | undefined, responsavelId: string) => void;
  onFechar: () => void;
}> = ({ demandasLivres, usuarios, responsavelPadrao, salvando, onCriar, onFechar }) => {

  const [demanda, setDemanda] = React.useState<string>('nova');
  const [responsavel, setResponsavel] = React.useState<string>(responsavelPadrao);

  return ReactDOM.createPortal(
    <div role="dialog" aria-modal="true" aria-label="Novo B.O.M." onClick={() => { if (!salvando) { onFechar(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: FONTE }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 100%)', background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: COR.azul, color: '#FFFFFF', padding: '14px 18px', fontSize: '17px', fontWeight: 700 }}>Novo B.O.M.</div>
        <div style={{ padding: '16px 18px' }}>
          <p style={{ marginTop: 0, fontSize: '13px', color: COR.texto2 }}>
            O B.O.M. nasce na etapa <strong>Dados da demanda</strong>, revisão <strong>RV00</strong>, com o próximo número da sequência.
          </p>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }} htmlFor="nb-dem">Demanda</label>
          <select id="nb-dem" style={campo} value={demanda} onChange={e => setDemanda(e.target.value)}>
            <option value="nova">+ Nova demanda (preencher os dados)</option>
            {demandasLivres.map(item => <option key={item.id} value={item.id}>{item.nome} · já cadastrada</option>)}
          </select>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, margin: '12px 0 5px' }} htmlFor="nb-resp">Responsável pelo B.O.M.</label>
          <select id="nb-resp" style={campo} value={responsavel} onChange={e => setResponsavel(e.target.value)}>
            <option value="">Selecione…</option>
            {usuarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 18px', background: COR.fundo, borderTop: `1px solid ${COR.borda}` }}>
          <button type="button" style={botao('secundario', salvando)} disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" style={botao('principal', salvando || !responsavel)} disabled={salvando || !responsavel} onClick={() => onCriar(demanda === 'nova' ? undefined : demanda, responsavel)}>
            {salvando ? 'Criando…' : 'Criar B.O.M.'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const ArquiteturaPage: React.FC<IArquiteturaPageProps> = ({
  dataverseService,
  contexto
}) => {

  const servico = React.useMemo(() => (dataverseService ? new BomService(dataverseService) : undefined), [dataverseService]);
  const areas = React.useMemo(() => (dataverseService ? new AreaAdminService(dataverseService) : undefined), [dataverseService]);

  const [visao, setVisao] = React.useState<IVisaoGeralBom | undefined>(undefined);
  const [usuarios, setUsuarios] = React.useState<IUsuarioOpcao[]>([]);
  const [membrosArea, setMembrosArea] = React.useState<string[]>([]);
  const [areaArqId, setAreaArqId] = React.useState<string>('');
  const [criterios, setCriterios] = React.useState<ICriterioGoNoGo[]>([]);

  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');
  const [mensagem, setMensagem] = React.useState<string>('');

  const [filtro, setFiltro] = React.useState<Filtro>('todos');
  const [busca, setBusca] = React.useState<string>('');
  const [novoAberto, setNovoAberto] = React.useState<boolean>(false);

  const [bomId, setBomId] = React.useState<string>('');
  const [aba, setAba] = React.useState<'demanda' | 'gonogo'>('demanda');
  const [analises, setAnalises] = React.useState<IAnaliseGoNoGo[]>([]);

  const avisar = (texto: string): void => {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 4000);
  };

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico || !areas) {
      setErro('Dataverse não conectado.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const [dados, listaUsuarios, listaAreas, vinculos, listaCriterios] = await Promise.all([
        servico.carregarVisaoGeral(),
        areas.listarUsuarios(),
        areas.listarAreas(),
        areas.listarUsuariosArea(),
        servico.carregarCriterios()
      ]);
      const arq = listaAreas.find(area => /^arq$/i.test(area.sigla || '') || /arquitetura/i.test(area.nome));
      setAreaArqId(arq ? arq.id : '');
      setMembrosArea(arq ? vinculos.filter(v => v.ativo && guid(v.areaId) === guid(arq.id)).map(v => guid(v.usuarioId)) : []);
      setUsuarios(listaUsuarios.map(item => ({ id: guid(item.id), nome: item.nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
      setCriterios(listaCriterios);
      setVisao(dados);
    } catch (error) {
      setErro(`Não foi possível carregar a Arquitetura de Soluções: ${(error as Error).message}. Confira se as tabelas dgt_bom_* existem e se o seu perfil de segurança permite lê-las.`);
    } finally {
      setCarregando(false);
    }
  }, [servico, areas]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const bom = visao && bomId ? visao.boms.find(item => item.id === bomId) : undefined;
  const demanda = visao && bom ? visao.demandas.find(item => item.id === bom.demandaId) : undefined;

  // Ao abrir um B.O.M., carrega o histórico das análises.
  React.useEffect(() => {
    if (!servico || !demanda) {
      setAnalises([]);
      return;
    }
    servico.carregarAnalises(demanda.id).then(setAnalises).catch(error => setErro((error as Error).message));
  }, [servico, demanda ? demanda.id : '']);

  const etapaDe = (item: IBomRegistro): EtapaBom =>
    visao
      ? etapaCalculada(visao.demandas.find(d => d.id === item.demandaId), visao.ultimaAnalise[item.demandaId], item.etapa)
      : item.etapa;

  const abrirBom = (item: IBomRegistro): void => {
    setBomId(item.id);
    const etapa = etapaDe(item);
    setAba(etapa === 'Dados da demanda' ? 'demanda' : 'gonogo');
    window.scrollTo(0, 0);
  };

  const executar = async (acao: () => Promise<void>, sucesso: string): Promise<void> => {
    setSalvando(true);
    setErro('');
    try {
      await acao();
      await carregar();
      avisar(sucesso);
    } catch (error) {
      setErro((error as Error).message || String(error));
      throw error;
    } finally {
      setSalvando(false);
    }
  };

  // ----------------------------------------------------------
  // Tela do B.O.M.
  // ----------------------------------------------------------

  if (bom && demanda && servico) {

    const etapa = etapaDe(bom);
    const ultima = visao ? visao.ultimaAnalise[demanda.id] : undefined;

    return (
      <section style={{ fontFamily: FONTE }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '12px', color: COR.texto2 }}>BOM {bom.numero.replace(/^BOM\s*/i, '')} · {bom.revisao} · {demanda.numero}</span>
            <h1 style={{ margin: '2px 0 4px', fontSize: '22px', color: COR.azul }}>{demanda.nome === 'Nova demanda (sem título)' ? 'Nova demanda (sem título)' : demanda.nome}</h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12.5px', color: COR.texto2 }}>
              <Selo texto={ETAPAS[etapa].texto} cor={ETAPAS[etapa].cor} fundo={ETAPAS[etapa].fundo} />
              {ultima && <Selo texto={`${DECISAO[ultima.decisao].texto} · ${formatarNumero(ultima.pontuacao)}`} cor={DECISAO[ultima.decisao].cor} fundo={DECISAO[ultima.decisao].fundo} />}
              <span>Responsável: <strong>{bom.responsavelNome}</strong></span>
              {demanda.prazoEntrega && <span>Prazo: <strong>{formatarData(demanda.prazoEntrega)}</strong></span>}
            </div>
          </div>
          <button type="button" style={botao('secundario')} onClick={() => { setBomId(''); window.scrollTo(0, 0); }}>← Visão geral</button>
        </div>

        {mensagem && <div role="status" style={{ ...cartao, background: '#E7F6EC', borderColor: '#107C10', color: '#107C10', fontWeight: 700, padding: '10px 14px' }}>✓ {mensagem}</div>}
        {erro && <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', color: COR.azul, padding: '10px 14px', fontSize: '13px' }}>{erro}</div>}

        <Progresso etapa={etapa} aba={aba} onAba={setAba} />

        {
          aba === 'demanda' && (
            <DadosDemandaEtapa
              demanda={demanda}
              usuarios={usuarios}
              membrosArea={membrosArea}
              canalTravado={analises.length > 0}
              salvando={salvando}
              onSalvar={async (dados, responsaveis, principal, concluir) => {
                await executar(async () => {
                  await servico.salvarDemanda(dados, responsaveis, principal);
                  const novaEtapa = etapaCalculada(dados, ultima, bom.etapa);
                  if (novaEtapa !== bom.etapa) {
                    await servico.atualizarEtapa(bom.id, novaEtapa);
                  }
                }, concluir ? 'Dados da demanda concluídos.' : 'Rascunho salvo.');
                if (concluir) {
                  setAba('gonogo');
                  window.scrollTo(0, 0);
                }
              }}
            />
          )
        }

        {
          aba === 'gonogo' && (
            !demanda.cadastroCompleto
              ? (
                <div style={{ ...cartao, textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 6px', color: COR.azul }}>🔒 Conclua os dados da demanda</h3>
                  <p style={{ fontSize: '13px', color: COR.texto2 }}>A Matriz Go/No-Go é liberada depois que os campos obrigatórios da demanda forem preenchidos.</p>
                  <button type="button" style={botao('principal')} onClick={() => setAba('demanda')}>Ir para Dados da demanda</button>
                </div>
              )
              : (
                <>
                  <MatrizGoNoGoEtapa
                    criterios={criterios}
                    analises={analises}
                    salvando={salvando}
                    onRegistrar={async (notas, justificativas, parecer) => {
                      if (!contexto || !contexto.usuarioId) {
                        setErro('Não foi possível identificar o seu usuário para registrar a análise.');
                        return;
                      }
                      await executar(async () => {
                        await servico.registrarAnalise({
                          demandaId: demanda.id,
                          bomId: bom.id,
                          avaliadorId: contexto.usuarioId as string,
                          criterios,
                          notas,
                          justificativas,
                          parecer
                        });
                        setAnalises(await servico.carregarAnalises(demanda.id));
                      }, 'Análise Go/No-Go registrada.');
                    }}
                  />
                  {
                    ultima && ultima.liberaKit && (
                      <div style={{ ...cartao, background: '#E8F2FF', borderColor: '#0F6CBD', fontSize: '13px', color: COR.azul }}>
                        <strong>Seleção de kit liberada.</strong> A etapa 3 (Seleção de kit) está em definição e será construída na próxima fase,
                        junto com o Cálculo de HH. Este B.O.M. fica na etapa <strong>Seleção de kit</strong> até lá.
                      </div>
                    )
                  }
                </>
              )
          )
        }
      </section>
    );
  }

  // ----------------------------------------------------------
  // Visão geral dos B.O.M.
  // ----------------------------------------------------------

  const linhas =
    visao
      ? visao.boms.map(item => ({
        bom: item,
        demanda: visao.demandas.find(d => d.id === item.demandaId),
        etapa: etapaDe(item),
        analise: visao.ultimaAnalise[item.demandaId]
      }))
      : [];

  const contar = (f: Filtro): number => {
    const def = FILTROS.find(item => item.id === f);
    return !def || def.etapas.length === 0 ? linhas.length : linhas.filter(l => def.etapas.indexOf(l.etapa) >= 0).length;
  };

  const termo = busca.trim().toLowerCase();
  const filtroAtual = FILTROS.find(item => item.id === filtro) as typeof FILTROS[number];

  const visiveis =
    linhas.filter(l =>
      (filtroAtual.etapas.length === 0 || filtroAtual.etapas.indexOf(l.etapa) >= 0) &&
      (!termo || `${l.bom.numero} ${l.demanda ? l.demanda.nome : ''} ${l.demanda ? l.demanda.cliente : ''} ${l.bom.responsavelNome}`.toLowerCase().indexOf(termo) >= 0)
    );

  const demandasLivres =
    visao ? visao.demandas.filter(d => !visao.boms.some(b => b.demandaId === d.id)) : [];

  const meuUsuario = contexto && contexto.usuarioId ? guid(contexto.usuarioId) : '';

  return (
    <section style={{ fontFamily: FONTE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '22px', color: COR.azul }}>Visão geral dos B.O.M.</h1>
        <span style={{ fontSize: '12px', color: COR.texto2 }}>{linhas.length} B.O.M.</span>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: '13px', color: COR.texto2 }}>
        Todos os B.O.M. da Arquitetura de Soluções. Clique em um B.O.M. para abrir a etapa em que ele está.
      </p>

      {mensagem && <div role="status" style={{ ...cartao, background: '#E7F6EC', borderColor: '#107C10', color: '#107C10', fontWeight: 700, padding: '10px 14px' }}>✓ {mensagem}</div>}
      {erro && <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', color: COR.azul, padding: '10px 14px', fontSize: '13px' }}>{erro}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        {
          FILTROS.map(item => (
            <button key={item.id} type="button" onClick={() => setFiltro(item.id)}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', fontFamily: FONTE, background: '#FFFFFF', border: `1px solid ${filtro === item.id ? COR.ciano : COR.borda}`, boxShadow: filtro === item.id ? `0 0 0 2px #E6F9FC` : 'none', color: COR.azul }}>
              <strong style={{ display: 'block', fontSize: '24px' }}>{contar(item.id)}</strong>
              <span style={{ fontSize: '12px', color: COR.texto2 }}>{item.rotulo}</span>
            </button>
          ))
        }
      </div>

      <div style={{ ...cartao, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${COR.borda}`, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '14px', color: COR.azul }}>B.O.M. criados</strong>
          <span style={{ flex: 1 }} />
          <input aria-label="Buscar B.O.M." style={{ ...campo, maxWidth: '280px' }} placeholder="Buscar nº, demanda, cliente ou responsável" value={busca} onChange={e => setBusca(e.target.value)} />
          <button type="button" style={botao('principal', !servico)} disabled={!servico} onClick={() => setNovoAberto(true)}>+ Novo B.O.M.</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
            <thead>
              <tr>
                {['B.O.M.', 'Demanda', 'Responsável', 'Etapa atual', 'Go/No-Go', 'Atualizado', ''].map(coluna => (
                  <th key={coluna} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: COR.texto2, background: '#F8FAFC', borderBottom: `1px solid ${COR.borda}` }}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={7} style={{ padding: '18px', fontSize: '13px', color: COR.texto2 }}>Carregando…</td></tr>}
              {
                !carregando && visiveis.map(l => {
                  const est = ETAPAS[l.etapa];
                  return (
                    <tr key={l.bom.id} onClick={() => abrirBom(l.bom)} style={{ cursor: 'pointer' }}>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        <strong style={{ fontSize: '13px' }}>BOM {l.bom.numero.replace(/^BOM\s*/i, '')}</strong>
                        <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{l.bom.revisao} · criado {formatarData(l.bom.criadoEm)}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        <strong style={{ fontSize: '13px' }}>{l.demanda ? l.demanda.nome : '—'}</strong>
                        <div style={{ fontSize: '11.5px', color: COR.texto2 }}>
                          {l.demanda && l.demanda.cliente ? `${l.demanda.cliente} · ` : ''}{l.demanda ? (l.demanda.canal || 'Canal a definir') : ''}{l.demanda && l.demanda.tipoEntrega ? ` · ${l.demanda.tipoEntrega.split(' ')[0]}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px' }}>{l.bom.responsavelNome}</td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        <span style={{ fontSize: '11px', color: COR.texto2, marginRight: '6px' }}>{est.passo}/5</span>
                        <Selo texto={est.texto} cor={est.cor} fundo={est.fundo} />
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}` }}>
                        {l.analise ? <Selo texto={`${DECISAO[l.analise.decisao].texto} · ${formatarNumero(l.analise.pontuacao)}`} cor={DECISAO[l.analise.decisao].cor} fundo={DECISAO[l.analise.decisao].fundo} /> : <span style={{ fontSize: '12px', color: COR.texto2 }}>Sem análise</span>}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '12.5px' }}>{formatarData(l.bom.atualizadoEm)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'right' }}>
                        <button type="button" style={botao(l.etapa === 'Bloqueado no Go/No-Go' ? 'secundario' : 'principal')} onClick={e => { e.stopPropagation(); abrirBom(l.bom); }}>
                          {l.etapa === 'Dados da demanda' ? 'Preencher' : l.etapa === 'Bloqueado no Go/No-Go' ? 'Revisar' : 'Abrir etapa'} →
                        </button>
                      </td>
                    </tr>
                  );
                })
              }
              {!carregando && visiveis.length === 0 && <tr><td colSpan={7} style={{ padding: '22px', textAlign: 'center', fontSize: '13px', color: COR.texto2 }}>Nenhum B.O.M. neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: COR.texto2 }}>
        Etapas: 1 · Dados da demanda · 2 · Matriz Go/No-Go · 3 · Seleção de kit · 4 · Cálculo de HH · 5 · B.O.M. pronto
        (as etapas 3 a 5 estão em definição).
      </p>

      {
        novoAberto && servico && (
          <NovoBomModal
            demandasLivres={demandasLivres}
            usuarios={usuarios.filter(u => membrosArea.length === 0 || membrosArea.indexOf(u.id) >= 0 || u.id === meuUsuario)}
            responsavelPadrao={meuUsuario}
            salvando={salvando}
            onFechar={() => setNovoAberto(false)}
            onCriar={(demandaId, responsavelId) => {
              let novoId = '';
              executar(async () => {
                novoId = await servico.criarBom({ demandaId, responsavelId, areaId: areaArqId || undefined });
              }, 'B.O.M. criado.')
                .then(() => {
                  setNovoAberto(false);
                  if (novoId) {
                    setBomId(guid(novoId));
                    setAba('demanda');
                  }
                })
                .catch(() => undefined);
            }}
          />
        )
      }
    </section>
  );
};

export default ArquiteturaPage;
