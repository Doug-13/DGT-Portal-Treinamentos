import * as React from 'react';

import {
  IAjustePlanoGravado,
  OrcamentoService
} from '../../services/orcamento/OrcamentoService';

import {
  CONTAS_MAE,
  GRUPOS_ORCAMENTO,
  IAjustePlano,
  PLANO_CONTAS,
  contaBase,
  termoExibido
} from '../../services/orcamento/planoContasOrcamento';

import {
  ITENS_DRE
} from '../../services/orcamento/dreOrcamento';

import {
  COR,
  CaixaMensagem,
  FONTE,
  botao,
  campo,
  cartao,
  explicarErro,
  formatarDataHora
} from './orcamentoComum';

// ============================================================
// PLANO DE CONTAS (Administrador / Administrador do módulo)
//
// Ajustes gravados em dgt_orcamentoplanoajuste SOBRE o plano base
// (planoContasOrcamento.ts) e aplicados em TODAS as planilhas,
// inclusive as em andamento:
//  • Contas: renomear, desativar/reativar, incluir (com conta mãe
//    opcional — vira subitem, como os 6.1.1.01.* da 018).
//  • Termos: nome exibido dos grupos e das linhas da DRE. O
//    identificador interno não muda (DRE, regras e Contas por área
//    continuam funcionando).
//  • Histórico: antes → depois, quem e quando.
// ============================================================

export interface IPlanoContasViewProps {
  servico: OrcamentoService;
  usuarioNome: string;
  // Avisa a página para redesenhar (o plano mudou).
  onAlterado: () => void;
}

type Aba = 'contas' | 'termos' | 'historico';

const chaveConta = (grupo: string, codigo: string): string => `conta|${grupo}|${codigo}`;

const PlanoContasView: React.FC<IPlanoContasViewProps> = (props) => {

  const [aba, setAba] = React.useState<Aba>('contas');
  const [ajustes, setAjustes] = React.useState<IAjustePlanoGravado[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [semTabela, setSemTabela] = React.useState(false);
  const [salvando, setSalvando] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [, setVersao] = React.useState(0);

  // Contas
  const [grupo, setGrupo] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [nomesEditados, setNomesEditados] = React.useState<{ [chave: string]: string }>({});
  const [incluindo, setIncluindo] = React.useState(false);
  const [nova, setNova] = React.useState({ grupo: GRUPOS_ORCAMENTO[0], codigo: '', nome: '', pai: '' });

  // Termos
  const [termosEditados, setTermosEditados] = React.useState<{ [id: string]: string }>({});

  const carregar = React.useCallback(async (): Promise<void> => {
    setCarregando(true);
    try {
      setAjustes(await props.servico.listarAjustesPlano());
      await props.servico.garantirPlano(true);
      setSemTabela(false);
    } catch {
      setSemTabela(true);
      setAjustes([]);
    } finally {
      setCarregando(false);
      setVersao(v => v + 1);
    }
  }, [props.servico]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const ajusteDe = (tipo: 'conta' | 'termo', grupoAjuste: string, codigo: string): IAjustePlanoGravado | undefined =>
    ajustes.filter(item => item.tipo === tipo && item.grupo === grupoAjuste && item.codigo === codigo)[0];

  const gravar = async (ajuste: IAjustePlano, antes: string, depois: string, rotulo: string): Promise<boolean> => {
    setSalvando(rotulo);
    setErro('');
    setAviso('');
    try {
      await props.servico.salvarAjustePlano(ajuste, antes, depois, props.usuarioNome, ajusteDe(ajuste.tipo, ajuste.grupo, ajuste.codigo));
      await carregar();
      props.onAlterado();
      setAviso(`✓ ${rotulo}. Já vale para todas as planilhas.`);
      return true;
    } catch (falha) {
      setErro(explicarErro(falha));
      return false;
    } finally {
      setSalvando('');
    }
  };

  // ----------------------------------------------------------
  // Contas
  // ----------------------------------------------------------

  const salvarNome = async (grupoConta: string, codigo: string): Promise<void> => {
    const chave = chaveConta(grupoConta, codigo);
    const conta = PLANO_CONTAS.filter(item => item.grupo === grupoConta && item.codigo === codigo)[0];
    const novoNome = (nomesEditados[chave] || '').trim();
    if (!conta || !novoNome || novoNome === conta.conta) {
      return;
    }
    const ok = await gravar(
      { tipo: 'conta', grupo: grupoConta, codigo, nome: novoNome, pai: conta.pai, incluida: !!conta.incluida, ativa: !conta.inativa },
      `Nome: ${conta.conta}`,
      `Nome: ${novoNome}`,
      `Conta ${codigo} renomeada`
    );
    if (ok) {
      setNomesEditados(mapa => { const copia = { ...mapa }; delete copia[chave]; return copia; });
    }
  };

  const alternarAtiva = async (grupoConta: string, codigo: string): Promise<void> => {
    const conta = PLANO_CONTAS.filter(item => item.grupo === grupoConta && item.codigo === codigo)[0];
    if (!conta) {
      return;
    }
    const ativar = !!conta.inativa;
    if (!ativar && !window.confirm(
      `Desativar a conta ${codigo} — ${conta.conta}?\n\nEla deixa de entrar em planilhas novas e em "Adicionar linha". ` +
      'Nas planilhas em que já tem valor, a linha continua (marcada como desativada); sem valor, ela some.'
    )) {
      return;
    }
    await gravar(
      { tipo: 'conta', grupo: grupoConta, codigo, nome: conta.conta, pai: conta.pai, incluida: !!conta.incluida, ativa: ativar },
      ativar ? 'Desativada' : 'Ativa',
      ativar ? 'Ativa' : 'Desativada',
      `Conta ${codigo} ${ativar ? 'reativada' : 'desativada'}`
    );
  };

  const restaurarNome = async (grupoConta: string, codigo: string): Promise<void> => {
    const base = contaBase(grupoConta, codigo);
    const conta = PLANO_CONTAS.filter(item => item.grupo === grupoConta && item.codigo === codigo)[0];
    if (!base || !conta || base.conta === conta.conta) {
      return;
    }
    await gravar(
      { tipo: 'conta', grupo: grupoConta, codigo, nome: base.conta, pai: conta.pai, incluida: false, ativa: !conta.inativa },
      `Nome: ${conta.conta}`,
      `Nome: ${base.conta} (original)`,
      `Nome original da conta ${codigo} restaurado`
    );
  };

  const maesDoGrupo = (grupoMae: string): string[] =>
    Object.keys(CONTAS_MAE).filter(codigo => PLANO_CONTAS.some(conta => conta.pai === codigo && conta.grupo === grupoMae));

  const problemaNova = ((): string => {
    if (!nova.codigo.trim() || !nova.nome.trim()) {
      return 'Informe o código e o nome.';
    }
    if (!/^[0-9]+(\.[0-9]+)*$/.test(nova.codigo.trim())) {
      return 'O código deve ter só números e pontos (ex.: 4.2.1.01.06.050).';
    }
    if (PLANO_CONTAS.some(conta => conta.grupo === nova.grupo && conta.codigo === nova.codigo.trim()) || CONTAS_MAE[nova.codigo.trim()]) {
      return 'Já existe uma conta com este código neste grupo.';
    }
    return '';
  })();

  const incluirConta = async (): Promise<void> => {
    if (problemaNova) {
      return;
    }
    const ok = await gravar(
      { tipo: 'conta', grupo: nova.grupo, codigo: nova.codigo.trim(), nome: nova.nome.trim().toUpperCase(), pai: nova.pai || undefined, incluida: true, ativa: true },
      '',
      `Incluída: ${nova.codigo.trim()} — ${nova.nome.trim().toUpperCase()} (${termoExibido(nova.grupo)}${nova.pai ? `, subitem de ${nova.pai}` : ''})`,
      `Conta ${nova.codigo.trim()} incluída`
    );
    if (ok) {
      setIncluindo(false);
      setNova({ grupo: nova.grupo, codigo: '', nome: '', pai: '' });
    }
  };

  // ----------------------------------------------------------
  // Termos
  // ----------------------------------------------------------

  const salvarTermo = async (id: string, original: string): Promise<void> => {
    const novo = (termosEditados[id] === undefined ? termoExibido(id, original) : termosEditados[id]).trim();
    const atual = termoExibido(id, original);
    if (novo === atual) {
      return;
    }
    const ok = await gravar(
      { tipo: 'termo', grupo: '', codigo: id, nome: novo === original ? '' : novo },
      `Termo: ${atual}`,
      `Termo: ${novo || original}`,
      `Termo "${original}" alterado`
    );
    if (ok) {
      setTermosEditados(mapa => { const copia = { ...mapa }; delete copia[id]; return copia; });
    }
  };

  // ----------------------------------------------------------
  // Tela
  // ----------------------------------------------------------

  if (carregando) {
    return <div style={{ ...cartao, color: COR.texto2 }}>Carregando o plano de contas...</div>;
  }

  const termo = busca.trim().toLowerCase();
  const contasFiltradas =
    PLANO_CONTAS.filter(conta =>
      (!grupo || conta.grupo === grupo) &&
      (!termo || conta.codigo.indexOf(termo) >= 0 || conta.conta.toLowerCase().indexOf(termo) >= 0 || termoExibido(conta.grupo).toLowerCase().indexOf(termo) >= 0)
    );
  const qtdIncluidas = PLANO_CONTAS.filter(conta => conta.incluida).length;
  const qtdInativas = PLANO_CONTAS.filter(conta => conta.inativa).length;
  const qtdRenomeadas = PLANO_CONTAS.filter(conta => { const base = contaBase(conta.grupo, conta.codigo); return !!base && base.conta !== conta.conta; }).length;

  const historico =
    ajustes
      .reduce((lista: Array<{ quando: string; quem: string; antes: string; depois: string; alvo: string }>, ajuste) =>
        lista.concat(ajuste.historico.map(item => ({
          ...item,
          alvo: ajuste.tipo === 'termo' ? `Termo ${ajuste.codigo}` : `${ajuste.codigo} (${termoExibido(ajuste.grupo)})`
        }))), [])
      .sort((a, b) => b.quando.localeCompare(a.quando));

  const botaoAba = (chave: Aba, titulo: string): JSX.Element => (
    <button
      type="button"
      onClick={() => setAba(chave)}
      style={{
        padding: '7px 14px',
        border: `1px solid ${aba === chave ? COR.azulAcao : COR.borda}`,
        borderRadius: '999px',
        background: aba === chave ? '#E8F2FF' : '#FFFFFF',
        color: aba === chave ? COR.azulAcao : COR.texto2,
        fontWeight: 700,
        fontSize: '12.5px',
        cursor: 'pointer',
        fontFamily: FONTE
      }}
    >
      {titulo}
    </button>
  );

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '11.5px', color: COR.texto2, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` };
  const td: React.CSSProperties = { padding: '7px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px', verticalAlign: 'middle' };

  return (
    <div style={{ fontFamily: FONTE }}>
      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />
      {semTabela && (
        <CaixaMensagem tipo="alerta" texto="A tabela de ajustes do plano ainda não existe no Dataverse. Execute scripts/dataverse/criar-tabelas-orcamento.ps1 e atualize a página. Até lá, o plano base é usado e não pode ser alterado." />
      )}

      <div style={{ ...cartao, fontSize: '13px', color: COR.texto2 }}>
        O plano base é o da planilha Orçamento 2027. As alterações feitas aqui valem para <strong style={{ color: COR.azul }}>todas as planilhas</strong>,
        inclusive as em andamento: contas renomeadas mudam de nome, contas incluídas entram nas planilhas em preenchimento e contas
        desativadas saem das planilhas novas (onde já têm valor, continuam). Os termos de grupos e da DRE mudam só o nome exibido.
        <div style={{ marginTop: '8px', display: 'flex', gap: '14px', flexWrap: 'wrap', color: COR.azul, fontWeight: 600 }}>
          <span>{PLANO_CONTAS.length} contas</span>
          <span>{qtdIncluidas} incluída(s)</span>
          <span>{qtdRenomeadas} renomeada(s)</span>
          <span>{qtdInativas} desativada(s)</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {botaoAba('contas', 'Contas')}
        {botaoAba('termos', 'Termos de grupos e da DRE')}
        {botaoAba('historico', `Histórico (${historico.length})`)}
      </div>

      {aba === 'contas' && (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <select value={grupo} onChange={evento => setGrupo(evento.target.value)} style={{ ...campo, maxWidth: '320px' }}>
              <option value="">Todos os grupos</option>
              {GRUPOS_ORCAMENTO.map(item => <option key={item} value={item}>{termoExibido(item)}</option>)}
            </select>
            <input type="search" placeholder="Buscar por código ou nome..." value={busca} onChange={evento => setBusca(evento.target.value)} style={{ ...campo, maxWidth: '300px' }} />
            <div style={{ flex: 1 }} />
            <button type="button" disabled={semTabela} onClick={() => { setIncluindo(true); setNova({ grupo: grupo || GRUPOS_ORCAMENTO[0], codigo: '', nome: '', pai: '' }); }} style={botao('principal', semTabela)}>
              + Incluir conta
            </button>
          </div>

          {incluindo && (
            <div style={{ ...cartao, borderColor: COR.ciano, borderWidth: '2px' }}>
              <div style={{ fontWeight: 700, color: COR.azul, marginBottom: '10px' }}>Incluir conta</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label style={{ fontSize: '12px', color: COR.texto2 }}>
                  Grupo *
                  <select value={nova.grupo} onChange={evento => setNova({ ...nova, grupo: evento.target.value, pai: '' })} style={campo}>
                    {GRUPOS_ORCAMENTO.map(item => <option key={item} value={item}>{termoExibido(item)}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '12px', color: COR.texto2 }}>
                  Código *
                  <input value={nova.codigo} placeholder="Ex.: 4.2.1.01.06.050" onChange={evento => setNova({ ...nova, codigo: evento.target.value })} style={campo} />
                </label>
                <label style={{ fontSize: '12px', color: COR.texto2 }}>
                  Nome *
                  <input value={nova.nome} placeholder="Ex.: SERVIÇOS DE CONSULTORIA" onChange={evento => setNova({ ...nova, nome: evento.target.value })} style={campo} />
                </label>
                <label style={{ fontSize: '12px', color: COR.texto2 }}>
                  Conta mãe (opcional)
                  <select value={nova.pai} onChange={evento => setNova({ ...nova, pai: evento.target.value })} style={campo}>
                    <option value="">— conta comum —</option>
                    {maesDoGrupo(nova.grupo).map(codigo => <option key={codigo} value={codigo}>{codigo} · {CONTAS_MAE[codigo]} (subitem)</option>)}
                  </select>
                </label>
              </div>
              {problemaNova && (nova.codigo || nova.nome) && <div style={{ fontSize: '12px', color: COR.perigo, marginTop: '6px' }}>{problemaNova}</div>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setIncluindo(false)} style={botao('secundario')}>Cancelar</button>
                <button type="button" disabled={!!problemaNova || !!salvando} onClick={() => { incluirConta().catch(() => undefined); }} style={botao('principal', !!problemaNova || !!salvando)}>
                  {salvando ? 'Salvando...' : 'Incluir'}
                </button>
              </div>
            </div>
          )}

          <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Grupo</th>
                  <th style={th}>Código</th>
                  <th style={{ ...th, minWidth: '320px' }}>Conta</th>
                  <th style={th}>Origem</th>
                  <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.map(conta => {
                  const chave = chaveConta(conta.grupo, conta.codigo);
                  const base = contaBase(conta.grupo, conta.codigo);
                  const renomeada = !!base && base.conta !== conta.conta;
                  const editado = nomesEditados[chave];
                  const alterado = editado !== undefined && editado.trim() !== '' && editado.trim() !== conta.conta;
                  return (
                    <tr key={chave} style={{ background: conta.inativa ? '#FAFAFA' : undefined, opacity: conta.inativa ? 0.7 : 1 }}>
                      <td style={{ ...td, fontSize: '12px', color: COR.texto2 }}>{termoExibido(conta.grupo)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {conta.codigo}
                        {conta.pai && <span style={{ display: 'block', fontSize: '11px', color: COR.texto2 }}>subitem de {conta.pai}</span>}
                      </td>
                      <td style={td}>
                        <input
                          value={editado !== undefined ? editado : conta.conta}
                          disabled={semTabela}
                          onChange={evento => setNomesEditados(mapa => ({ ...mapa, [chave]: evento.target.value }))}
                          onKeyDown={evento => { if (evento.key === 'Enter') { salvarNome(conta.grupo, conta.codigo).catch(() => undefined); } }}
                          style={{ ...campo, padding: '5px 8px', borderColor: alterado ? COR.ciano : COR.borda }}
                        />
                        {renomeada && base && <div style={{ fontSize: '11px', color: COR.texto2, marginTop: '2px' }}>Original: {base.conta}</div>}
                      </td>
                      <td style={{ ...td, fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {conta.incluida ? <span style={{ color: '#107C10', fontWeight: 700 }}>Incluída</span> : renomeada ? <span style={{ color: COR.azulAcao, fontWeight: 700 }}>Renomeada</span> : <span style={{ color: COR.texto2 }}>Plano base</span>}
                        {conta.inativa && <span style={{ display: 'block', color: '#B45309', fontWeight: 700 }}>Desativada</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {alterado && (
                          <button type="button" disabled={!!salvando} onClick={() => { salvarNome(conta.grupo, conta.codigo).catch(() => undefined); }} style={{ ...botao('principal', !!salvando), padding: '4px 10px', marginRight: '6px' }}>
                            Salvar nome
                          </button>
                        )}
                        {renomeada && !alterado && (
                          <button type="button" disabled={!!salvando || semTabela} onClick={() => { restaurarNome(conta.grupo, conta.codigo).catch(() => undefined); }} style={{ ...botao('secundario', !!salvando || semTabela), padding: '4px 10px', marginRight: '6px' }}>
                            Restaurar nome
                          </button>
                        )}
                        <button type="button" disabled={!!salvando || semTabela} onClick={() => { alternarAtiva(conta.grupo, conta.codigo).catch(() => undefined); }} style={{ ...botao('secundario', !!salvando || semTabela), padding: '4px 10px' }}>
                          {conta.inativa ? 'Reativar' : 'Desativar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {contasFiltradas.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: COR.texto2 }}>Nenhuma conta encontrada.</div>}
          </div>
        </>
      )}

      {aba === 'termos' && (
        <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Tipo</th>
                <th style={th}>Nome original</th>
                <th style={{ ...th, minWidth: '320px' }}>Termo exibido</th>
                <th style={{ ...th, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ITENS_DRE.map(item => {
                const atual = termoExibido(item.id, item.nome);
                const editado = termosEditados[item.id];
                const alterado = editado !== undefined && editado.trim() !== atual;
                const tipo = { grupo: 'Grupo de contas', secao: 'Seção da DRE', resultado: 'Resultado', percentual: 'Percentual' }[item.tipo] || item.tipo;
                return (
                  <tr key={item.id}>
                    <td style={{ ...td, fontSize: '12px', color: COR.texto2, whiteSpace: 'nowrap' }}>{tipo}</td>
                    <td style={{ ...td, fontSize: '12.5px' }}>{item.nome}</td>
                    <td style={td}>
                      <input
                        value={editado !== undefined ? editado : atual}
                        disabled={semTabela}
                        onChange={evento => setTermosEditados(mapa => ({ ...mapa, [item.id]: evento.target.value }))}
                        onKeyDown={evento => { if (evento.key === 'Enter') { salvarTermo(item.id, item.nome).catch(() => undefined); } }}
                        style={{ ...campo, padding: '5px 8px', borderColor: alterado ? COR.ciano : COR.borda }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {alterado && (
                        <button type="button" disabled={!!salvando} onClick={() => { salvarTermo(item.id, item.nome).catch(() => undefined); }} style={{ ...botao('principal', !!salvando), padding: '4px 10px', marginRight: '6px' }}>
                          Salvar
                        </button>
                      )}
                      {atual !== item.nome && !alterado && (
                        <button
                          type="button"
                          disabled={!!salvando || semTabela}
                          onClick={() => { setTermosEditados(mapa => ({ ...mapa, [item.id]: item.nome })); }}
                          style={{ ...botao('secundario', !!salvando || semTabela), padding: '4px 10px' }}
                        >
                          Voltar ao original
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'historico' && (
        <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Quando</th>
                <th style={th}>Quem</th>
                <th style={th}>Conta / termo</th>
                <th style={th}>Antes</th>
                <th style={th}>Depois</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item, indice) => (
                <tr key={indice}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatarDataHora(item.quando)}</td>
                  <td style={td}>{item.quem}</td>
                  <td style={td}>{item.alvo}</td>
                  <td style={{ ...td, color: COR.texto2 }}>{item.antes || '—'}</td>
                  <td style={td}>{item.depois}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {historico.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: COR.texto2 }}>Nenhuma alteração no plano ainda.</div>}
        </div>
      )}
    </div>
  );
};

export default PlanoContasView;
