import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AreaAdminService,
  IAreaAdmin,
  IUsuarioAreaAdmin,
  IUsuarioDisponivelArea
} from '../../services/AreaAdminService';

import {
  CARGOS_HIERARQUIA,
  cadeiaDaArea,
  pessoasComCargo,
  posicaoDoCargo
} from '../../services/fluxo/hierarquiaArea';

// ============================================================
// RH E PESSOAS → ESTRUTURA POR ÁREA (hierarquia)
//
// Define o CARGO de cada pessoa em cada área (Coordenador, Gestor,
// Gerente, Head, Diretor). A cadeia de cada área sai daí (ex.:
// Coordenador → Head → Diretor) e os fluxos de aprovação usam isso
// para achar o responsável certo ("Diretor da área", "2º nível…").
//
// • Mapa: todas as áreas com a cadeia e as pessoas de cada cargo.
// • Por área: cargo de cada pessoa da área.
// • Por pessoa: dar a alguém um cargo em várias áreas de uma vez
//   (Head ou Diretoria que agrupa áreas, gerente de duas áreas).
//
// O cargo NÃO dá acesso: o perfil de acesso continua em Usuários e
// acessos. Onde a pessoa ainda não tem vínculo, é criado um vínculo
// de Membro.
// ============================================================

export interface IEstruturaAreaAbaProps {
  dataverseService?: DataverseService;
}

type Visao = 'mapa' | 'area' | 'pessoa';

const COR = {
  azul: '#202A44',
  azulBotao: '#0B5CAB',
  texto: '#334155',
  sec: '#64748B',
  borda: '#DCE3EC',
  fundo: '#F8FAFC',
  ciano: '#05C3DD',
  cianoClaro: '#F0FCFE',
  vermelho: '#B42318',
  vermelhoClaro: '#FDECEA',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  ambar: '#8A5A00',
  ambarClaro: '#FFF8E1'
};

const cartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  padding: '16px 18px',
  marginBottom: '14px'
};

const campo: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '6px',
  fontSize: '13.5px',
  color: COR.azul,
  background: '#FFFFFF',
  fontFamily: 'inherit',
  boxSizing: 'border-box'
};

const botao = (principal: boolean, desabilitado = false): React.CSSProperties => ({
  minHeight: '34px',
  padding: '0 14px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${COR.borda}`,
  background: principal ? COR.azulBotao : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR.azul,
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.55 : 1,
  fontFamily: 'inherit'
});

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const nomeArea = (area: IAreaAdmin): string =>
  area.sigla && area.nome.indexOf(area.sigla) !== 0 ? `${area.sigla} · ${area.nome}` : area.nome;

const Mensagem: React.FC<{ tipo: 'erro' | 'sucesso' | 'alerta'; texto: string }> = ({ tipo, texto }) => {
  if (!texto) {
    return null;
  }
  const cores = {
    erro: { fundo: COR.vermelhoClaro, cor: COR.vermelho },
    sucesso: { fundo: COR.verdeClaro, cor: COR.verde },
    alerta: { fundo: COR.ambarClaro, cor: COR.ambar }
  }[tipo];
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} style={{ ...cartao, background: cores.fundo, color: cores.cor, borderColor: 'transparent', fontSize: '13px', whiteSpace: 'pre-line' }}>
      {texto}
    </div>
  );
};

const EstruturaAreaAba: React.FC<IEstruturaAreaAbaProps> = (props) => {

  const servico =
    React.useMemo(
      () => (props.dataverseService ? new AreaAdminService(props.dataverseService) : undefined),
      [props.dataverseService]
    );

  const [visao, setVisao] = React.useState<Visao>('mapa');
  const [areas, setAreas] = React.useState<IAreaAdmin[]>([]);
  const [usuarios, setUsuarios] = React.useState<IUsuarioDisponivelArea[]>([]);
  const [vinculos, setVinculos] = React.useState<IUsuarioAreaAdmin[]>([]);
  const [temColuna, setTemColuna] = React.useState(true);
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [busca, setBusca] = React.useState('');

  // Por área
  const [areaId, setAreaId] = React.useState('');
  const [novoUsuarioId, setNovoUsuarioId] = React.useState('');
  const [novoCargo, setNovoCargo] = React.useState(CARGOS_HIERARQUIA[0]);

  // Por pessoa
  const [pessoaId, setPessoaId] = React.useState('');
  const [cargoPessoa, setCargoPessoa] = React.useState('Diretor');
  const [areasMarcadas, setAreasMarcadas] = React.useState<string[]>([]);

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const [listaAreas, listaUsuarios, listaVinculos, coluna] = await Promise.all([
        servico.listarAreas(),
        servico.listarUsuarios(),
        servico.listarUsuariosArea(),
        servico.temColunaCargo()
      ]);
      const ativas = listaAreas.filter(area => area.ativa !== false).sort((a, b) => nomeArea(a).localeCompare(nomeArea(b), 'pt-BR'));
      setAreas(ativas);
      setUsuarios(listaUsuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      setVinculos(listaVinculos);
      setTemColuna(coluna);
      setAreaId(atual => atual || (ativas[0] ? ativas[0].id : ''));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setCarregando(false);
    }
  }, [servico]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  // Por pessoa: marca as áreas em que a pessoa já tem o cargo escolhido.
  React.useEffect(() => {
    setAreasMarcadas(
      vinculos
        .filter(vinculo => vinculo.ativo && guid(vinculo.usuarioId) === guid(pessoaId) && vinculo.cargo === cargoPessoa)
        .map(vinculo => guid(vinculo.areaId))
    );
  }, [pessoaId, cargoPessoa, vinculos]);

  const executar = async (acao: () => Promise<string[] | void>, sucesso: string): Promise<void> => {
    setSalvando(true);
    setErro('');
    setAviso('');
    try {
      const falhas = await acao();
      await carregar();
      if (falhas && falhas.length > 0) {
        setErro(`Algumas alterações não foram gravadas:\n${falhas.join('\n')}`);
      } else {
        setAviso(sucesso);
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setSalvando(false);
    }
  };

  const nomeDaArea = (id: string): string => {
    const area = areas.filter(item => guid(item.id) === guid(id))[0];
    return area ? nomeArea(area) : 'Área';
  };

  if (!servico) {
    return <div style={cartao}>Carregando...</div>;
  }

  if (carregando) {
    return <div style={{ ...cartao, color: COR.sec }}>Carregando a estrutura das áreas...</div>;
  }

  const abaVisao = (chave: Visao, rotulo: string): React.ReactNode => (
    <button
      type="button"
      onClick={() => { setVisao(chave); setAviso(''); setErro(''); }}
      aria-pressed={visao === chave}
      style={{
        padding: '6px 14px',
        borderRadius: '999px',
        border: `1px solid ${visao === chave ? COR.azulBotao : COR.borda}`,
        background: visao === chave ? '#E8F2FF' : '#FFFFFF',
        color: visao === chave ? COR.azulBotao : COR.sec,
        fontWeight: 700,
        fontSize: '12.5px',
        cursor: 'pointer',
        fontFamily: 'inherit'
      }}
    >
      {rotulo}
    </button>
  );

  // Cadeia da área em "chips": Coordenador (Ana) → Head (João) → …
  const renderCadeia = (id: string): React.ReactNode => {
    const cadeia = cadeiaDaArea(id, vinculos);
    if (cadeia.length === 0) {
      return <span style={{ fontSize: '12.5px', color: COR.ambar }}>Sem cargos cadastrados</span>;
    }
    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        {cadeia.map((cargo, indice) => (
          <React.Fragment key={cargo}>
            <span style={{ fontSize: '12.5px', background: COR.cianoClaro, border: `1px solid ${COR.ciano}`, borderRadius: '999px', padding: '2px 10px', color: COR.azul }}>
              <strong>{indice + 1}º · {cargo}</strong>
              {': '}
              {pessoasComCargo(id, cargo, vinculos).map(vinculo => vinculo.usuarioNome).join(', ')}
            </span>
            {indice < cadeia.length - 1 && <span style={{ color: COR.sec }}>→</span>}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const vinculosDaArea =
    vinculos
      .filter(vinculo => guid(vinculo.areaId) === guid(areaId))
      .sort((a, b) =>
        (posicaoDoCargo(b.cargo) - posicaoDoCargo(a.cargo)) ||
        a.usuarioNome.localeCompare(b.usuarioNome, 'pt-BR')
      );

  const areasFiltradas =
    areas.filter(area => !busca.trim() || nomeArea(area).toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0);

  return (
    <div style={{ color: COR.texto }}>

      <div style={{ ...cartao, fontSize: '13px', color: COR.sec }}>
        Defina o <strong style={{ color: COR.azul }}>cargo de cada pessoa em cada área</strong>. A cadeia de cada área (ex.:
        Coordenador → Head → Diretor) é montada a partir daqui, e os fluxos de aprovação usam isso para encontrar o responsável
        certo — por exemplo, a etapa “Avaliação do Diretor da Área” com o responsável <em>Cargo na área: Diretor</em>. Quem
        responde por várias áreas (Head, Diretoria, gerente de duas áreas) recebe o cargo em cada uma, de uma vez, em “Por pessoa”.
        O cargo não dá acesso ao portal: o perfil de acesso continua em Usuários e acessos.
      </div>

      {!temColuna && (
        <Mensagem
          tipo="alerta"
          texto="A coluna do cargo ainda não existe no Dataverse. Execute scripts/dataverse/criar-coluna-cargo-area.ps1 e atualize esta página."
        />
      )}

      <Mensagem tipo="erro" texto={erro} />
      <Mensagem tipo="sucesso" texto={aviso} />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {abaVisao('mapa', 'Mapa da hierarquia')}
        {abaVisao('area', 'Por área')}
        {abaVisao('pessoa', 'Por pessoa (várias áreas)')}
      </div>

      {/* ---------------- Mapa ---------------- */}
      {visao === 'mapa' && (
        <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COR.borda}` }}>
            <input
              type="search"
              placeholder="Buscar área..."
              value={busca}
              onChange={evento => setBusca(evento.target.value)}
              style={{ ...campo, width: '100%', maxWidth: '320px' }}
              aria-label="Buscar área"
            />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: '12px', color: COR.sec, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` }}>Área</th>
                <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: '12px', color: COR.sec, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` }}>Cadeia (do 1º nível ao topo)</th>
                <th style={{ borderBottom: `1px solid ${COR.borda}` }} />
              </tr>
            </thead>
            <tbody>
              {areasFiltradas.map(area => (
                <tr key={area.id}>
                  <td style={{ padding: '10px 14px', fontSize: '13.5px', fontWeight: 700, color: COR.azul, borderBottom: `1px solid ${COR.borda}`, whiteSpace: 'nowrap' }}>{nomeArea(area)}</td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${COR.borda}` }}>{renderCadeia(area.id)}</td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'right' }}>
                    <button type="button" onClick={() => { setAreaId(area.id); setVisao('area'); }} style={botao(false)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- Por área ---------------- */}
      {visao === 'area' && (
        <div style={cartao}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <select value={areaId} onChange={evento => setAreaId(evento.target.value)} style={{ ...campo, minWidth: '260px' }} aria-label="Área">
              {areas.map(area => <option key={area.id} value={area.id}>{nomeArea(area)}</option>)}
            </select>
            {renderCadeia(areaId)}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: COR.sec, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` }}>Pessoa</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: COR.sec, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` }}>Perfil de acesso</th>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: COR.sec, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` }}>Cargo na hierarquia</th>
              </tr>
            </thead>
            <tbody>
              {vinculosDaArea.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '14px 8px', color: COR.sec, fontSize: '13px' }}>Ninguém vinculado a esta área.</td></tr>
              )}
              {vinculosDaArea.map(vinculo => (
                <tr key={vinculo.id} style={{ opacity: vinculo.ativo ? 1 : 0.55 }}>
                  <td style={{ padding: '8px', fontSize: '13.5px', color: COR.azul, borderBottom: `1px solid ${COR.borda}` }}>
                    {vinculo.usuarioNome}
                    {!vinculo.ativo && <span style={{ fontSize: '12px', color: COR.sec }}> (vínculo inativo)</span>}
                  </td>
                  <td style={{ padding: '8px', fontSize: '13px', color: COR.sec, borderBottom: `1px solid ${COR.borda}` }}>{vinculo.perfil}</td>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${COR.borda}` }}>
                    <select
                      value={vinculo.cargo || ''}
                      disabled={salvando || !temColuna}
                      onChange={evento => {
                        const cargo = evento.target.value;
                        executar(
                          () => servico.definirCargo(vinculo.id, cargo),
                          `✓ ${vinculo.usuarioNome}: ${cargo || 'sem cargo'} em ${nomeDaArea(areaId)}.`
                        ).catch(() => undefined);
                      }}
                      style={{ ...campo, minWidth: '180px' }}
                      aria-label={`Cargo de ${vinculo.usuarioNome}`}
                    >
                      <option value="">— Sem cargo —</option>
                      {CARGOS_HIERARQUIA.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', borderTop: `1px solid ${COR.borda}`, paddingTop: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COR.azul }}>Incluir pessoa nesta área:</span>
            <select value={novoUsuarioId} onChange={evento => setNovoUsuarioId(evento.target.value)} style={{ ...campo, minWidth: '240px' }} aria-label="Pessoa">
              <option value="">Escolha a pessoa...</option>
              {usuarios.map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nome}{usuario.email ? ` (${usuario.email})` : ''}</option>)}
            </select>
            <select value={novoCargo} onChange={evento => setNovoCargo(evento.target.value)} style={campo} aria-label="Cargo">
              {CARGOS_HIERARQUIA.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
            <button
              type="button"
              disabled={salvando || !novoUsuarioId || !temColuna}
              onClick={() => {
                const pessoa = usuarios.filter(item => item.id === novoUsuarioId)[0];
                executar(
                  () => servico.atribuirCargoEmAreas(novoUsuarioId, novoCargo, [areaId], vinculos),
                  `✓ ${pessoa ? pessoa.nome : 'Pessoa'} incluída como ${novoCargo} em ${nomeDaArea(areaId)}.`
                ).then(() => setNovoUsuarioId('')).catch(() => undefined);
              }}
              style={botao(true, salvando || !novoUsuarioId || !temColuna)}
            >
              + Incluir
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Por pessoa ---------------- */}
      {visao === 'pessoa' && (
        <div style={cartao}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
            <select value={pessoaId} onChange={evento => setPessoaId(evento.target.value)} style={{ ...campo, minWidth: '260px' }} aria-label="Pessoa">
              <option value="">Escolha a pessoa...</option>
              {usuarios.map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nome}{usuario.email ? ` (${usuario.email})` : ''}</option>)}
            </select>
            <span style={{ fontSize: '13px', color: COR.sec }}>é</span>
            <select value={cargoPessoa} onChange={evento => setCargoPessoa(evento.target.value)} style={campo} aria-label="Cargo">
              {CARGOS_HIERARQUIA.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
            <span style={{ fontSize: '13px', color: COR.sec }}>das áreas marcadas:</span>
          </div>

          {pessoaId ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                {areas.map(area => {
                  const marcada = areasMarcadas.indexOf(guid(area.id)) >= 0;
                  const outros = pessoasComCargo(area.id, cargoPessoa, vinculos).filter(vinculo => guid(vinculo.usuarioId) !== guid(pessoaId));
                  return (
                    <label
                      key={area.id}
                      style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${marcada ? COR.ciano : COR.borda}`, background: marcada ? COR.cianoClaro : '#FFFFFF', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => setAreasMarcadas(atual =>
                          marcada ? atual.filter(id => id !== guid(area.id)) : atual.concat([guid(area.id)])
                        )}
                        style={{ marginTop: '2px' }}
                      />
                      <span>
                        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: COR.azul }}>{nomeArea(area)}</span>
                        {outros.length > 0 && (
                          <span style={{ display: 'block', fontSize: '11.5px', color: COR.sec }}>
                            Também {cargoPessoa}: {outros.map(item => item.usuarioNome).join(', ')}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={salvando || !temColuna}
                onClick={() => {
                  const pessoa = usuarios.filter(item => item.id === pessoaId)[0];
                  const antes = vinculos.filter(vinculo => guid(vinculo.usuarioId) === guid(pessoaId) && vinculo.cargo === cargoPessoa);
                  const retirar = antes.filter(vinculo => areasMarcadas.indexOf(guid(vinculo.areaId)) < 0);
                  executar(
                    async () => {
                      const falhas = await servico.atribuirCargoEmAreas(pessoaId, cargoPessoa, areasMarcadas, vinculos);
                      for (const vinculo of retirar) {
                        try {
                          await servico.definirCargo(vinculo.id, '');
                        } catch (falha) {
                          falhas.push(`${vinculo.areaNome}: ${falha instanceof Error ? falha.message : String(falha)}`);
                        }
                      }
                      return falhas;
                    },
                    `✓ ${pessoa ? pessoa.nome : 'Pessoa'} é ${cargoPessoa} de ${areasMarcadas.length} área(s).`
                  ).catch(() => undefined);
                }}
                style={botao(true, salvando || !temColuna)}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <div style={{ fontSize: '13px', color: COR.sec }}>
              Escolha a pessoa e o cargo. Exemplo: “Maria é Diretor das áreas marcadas” para uma Diretoria que agrupa várias áreas.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EstruturaAreaAba;
