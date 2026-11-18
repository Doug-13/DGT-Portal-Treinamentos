import * as React from 'react';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  AtribuicaoAreaService,
  IRegraAtribuicaoArea
} from '../../services/AtribuicaoAreaService';

// ============================================================
// ATRIBUIR POR ÁREA
//
// O treinamento fica atribuído a todos os membros ativos das áreas
// selecionadas, e também a quem entrar nessas áreas depois.
//
// Ao marcar as áreas, a tela lista as pessoas que vão receber. Quem
// for removido da lista vira EXCEÇÃO da regra (dgt_usuariosexcluidos)
// e não recebe o treinamento por essa regra, nem se sair e voltar
// para a área. Quem está em mais de uma área marcada aparece uma vez
// e, ao ser removido, fica fora de todas elas.
// ============================================================

export interface IAtribuicaoPorAreaPanelProps {
  service: AtribuicaoAreaService;
  treinamentos: ITreinamentoAdmin[];
  areas: IAreaAdmin[];
  usuariosAreas: IUsuarioAreaAdmin[];
}

const C = {
  azul: '#0B5CAB',
  azulEscuro: '#0B2D4D',
  azulClaro: '#EAF3FB',
  branco: '#FFFFFF',
  texto: '#18324A',
  secundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9'
};

const card: React.CSSProperties = {
  background: C.branco,
  border: `1px solid ${C.borda}`,
  borderRadius: '14px',
  padding: '20px',
  marginBottom: '16px'
};

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: `1px solid ${C.borda}`,
  borderRadius: '8px',
  background: C.branco,
  fontSize: '14px'
};

const btn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: `1px solid ${C.borda}`,
  background: C.branco,
  color: C.texto,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const btnPrimario: React.CSSProperties = {
  ...btn,
  padding: '10px 18px',
  border: 'none',
  background: '#1677ff',
  color: C.branco,
  fontWeight: 700
};

const guid = (
  valor: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

interface IPessoaDaSelecao {
  usuarioId: string;
  nome: string;
  email: string;
  // Rótulos (sigla ou nome) das áreas marcadas de que a pessoa é membro.
  areas: string[];
}

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const AtribuicaoPorAreaPanel: React.FC<IAtribuicaoPorAreaPanelProps> = (
  props
) => {

  const [treinamentoId, setTreinamentoId] = React.useState('');
  const [areasMarcadas, setAreasMarcadas] = React.useState<Record<string, boolean>>({});
  const [prazo, setPrazo] = React.useState('');

  // Pessoas removidas da atribuição (id do usuário normalizado).
  const [excluidos, setExcluidos] = React.useState<Record<string, boolean>>({});
  const [pesquisaPessoas, setPesquisaPessoas] = React.useState('');

  const [regras, setRegras] = React.useState<IRegraAtribuicaoArea[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [sucesso, setSucesso] = React.useState('');

  const treinamentosAtivos =
    props.treinamentos
      .filter(t => t.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const areasAtivas =
    props.areas
      .filter(a => a.ativa)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // Quantidade de membros ativos por área.
  const membrosPorArea =
    React.useMemo(
      () => {
        const mapa: Record<string, Record<string, boolean>> = {};

        props.usuariosAreas
          .filter(v => v.ativo)
          .forEach(v => {
            const area = guid(v.areaId);
            mapa[area] = mapa[area] || {};
            mapa[area][guid(v.usuarioId)] = true;
          });

        const resultado: Record<string, number> = {};
        Object.keys(mapa).forEach(area => {
          resultado[area] = Object.keys(mapa[area]).length;
        });

        return resultado;
      },
      [props.usuariosAreas]
    );

  const carregar = React.useCallback(
    async (): Promise<void> => {
      setCarregando(true);
      setErro('');

      try {
        setRegras(await props.service.listar());
      } catch (e) {
        setErro(
          e instanceof Error
            ? `Não foi possível carregar as regras por área: ${e.message}`
            : 'Não foi possível carregar as regras por área.'
        );
      } finally {
        setCarregando(false);
      }
    },
    [props.service]
  );

  React.useEffect(
    () => {
      void carregar();
    },
    [carregar]
  );

  const regrasDoTreinamento =
    regras.filter(r => r.treinamentoId === guid(treinamentoId));

  const areaTemRegraAtiva = (
    areaId: string
  ): boolean =>
    regrasDoTreinamento.some(r => r.areaId === guid(areaId) && r.ativo);

  const selecionadas =
    Object.keys(areasMarcadas).filter(id => areasMarcadas[id]);

  // Pessoas (membros ativos) das áreas marcadas, sem repetição.
  const pessoas: IPessoaDaSelecao[] =
    React.useMemo(
      () => {
        const marcadas: Record<string, string> = {};

        props.areas.forEach(area => {
          if (areasMarcadas[area.id]) {
            marcadas[guid(area.id)] = area.sigla || area.nome;
          }
        });

        const mapa: Record<string, IPessoaDaSelecao> = {};

        props.usuariosAreas
          .filter(v => v.ativo && marcadas[guid(v.areaId)] !== undefined)
          .forEach(v => {
            const id = guid(v.usuarioId);
            const rotulo = marcadas[guid(v.areaId)];

            mapa[id] = mapa[id] || {
              usuarioId: id,
              nome: v.usuarioNome || v.usuarioEmail || 'Usuário',
              email: v.usuarioEmail || '',
              areas: []
            };

            if (mapa[id].areas.indexOf(rotulo) < 0) {
              mapa[id].areas.push(rotulo);
            }
          });

        return Object.keys(mapa)
          .map(id => mapa[id])
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      },
      [props.areas, props.usuariosAreas, areasMarcadas]
    );

  // Membros de cada área marcada (o service guarda em cada regra só
  // as exceções que são da área dela).
  const usuariosPorArea =
    React.useMemo(
      () => {
        const mapa: Record<string, string[]> = {};

        props.usuariosAreas
          .filter(v => v.ativo && areasMarcadas[v.areaId])
          .forEach(v => {
            mapa[v.areaId] = mapa[v.areaId] || [];
            mapa[v.areaId].push(guid(v.usuarioId));
          });

        return mapa;
      },
      [props.usuariosAreas, areasMarcadas]
    );

  const idsExcluidos =
    pessoas
      .filter(p => excluidos[p.usuarioId])
      .map(p => p.usuarioId);

  const pessoasAlcancadas =
    pessoas.length - idsExcluidos.length;

  const pessoasVisiveis =
    pesquisaPessoas.trim()
      ? pessoas.filter(p =>
        normalizar(`${p.nome} ${p.email} ${p.areas.join(' ')}`)
          .indexOf(normalizar(pesquisaPessoas.trim())) >= 0)
      : pessoas;

  const alternarPessoa = (
    usuarioId: string
  ): void =>
    setExcluidos(atual => ({ ...atual, [usuarioId]: !atual[usuarioId] }));

  // Nomes para mostrar as exceções de uma regra já salva.
  const nomeDoUsuario = (
    usuarioId: string
  ): string => {
    const vinculo =
      props.usuariosAreas.find(v => guid(v.usuarioId) === guid(usuarioId));
    return vinculo ? (vinculo.usuarioNome || vinculo.usuarioEmail) : 'Usuário fora das áreas';
  };

  const salvar = async (): Promise<void> => {
    setErro('');
    setSucesso('');

    const treinamento =
      treinamentosAtivos.find(t => t.id === treinamentoId);

    const prazoNumero =
      prazo.trim() ? Number(prazo) : undefined;

    setSalvando(true);

    try {
      const resultado =
        await props.service.criar(
          {
            treinamentoId,
            treinamentoNome: treinamento
              ? `${treinamento.codigo} - ${treinamento.nome}`
              : 'Treinamento',
            areaIds: selecionadas,
            prazoDias: prazoNumero,
            usuariosExcluidos: idsExcluidos,
            usuariosPorArea
          },
          regras
        );

      const partes: string[] = [];
      if (resultado.criadas) partes.push(`${resultado.criadas} regra(s) criada(s)`);
      if (resultado.reativadas) partes.push(`${resultado.reativadas} reativada(s)`);
      if (resultado.jaExistentes) partes.push(`${resultado.jaExistentes} já existia(m)`);

      setSucesso(
        `${partes.join(', ')}. As atribuições estão sendo criadas em segundo plano ` +
        'e aparecem para os colaboradores em alguns instantes. Quem entrar nessas áreas ' +
        'depois também receberá o treinamento.' +
        (idsExcluidos.length
          ? ` ${idsExcluidos.length} pessoa(s) removida(s) da lista não receberão o treinamento por esta regra.`
          : '')
      );

      setAreasMarcadas({});
      setExcluidos({});
      setPesquisaPessoas('');
      await carregar();

    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar a atribuição por área.'
      );
    } finally {
      setSalvando(false);
    }
  };

  const [processandoRegra, setProcessandoRegra] =
    React.useState('');

  const alternarRegra = async (
    regra: IRegraAtribuicaoArea
  ): Promise<void> => {
    setErro('');
    setSucesso('');

    try {

      // Reativar: o plugin atribui de novo aos membros ativos da área.
      if (!regra.ativo) {
        setProcessandoRegra(regra.id);
        await props.service.definirAtiva(regra.id, true);
        setSucesso(
          `Regra reativada. ${regra.treinamentoNome} será atribuído aos membros ativos de ${regra.areaNome} em instantes.`
        );
        await carregar();
        return;
      }

      // Desativar: mostra o impacto e pede confirmação.
      setProcessandoRegra(regra.id);

      const impacto =
        await props.service.impactoDesativacao(regra.id);

      const confirmou =
        window.confirm(
          `Desativar a regra "${regra.treinamentoNome} → ${regra.areaNome}"?\n\n` +
          `• ${impacto.pendentes} atribuição(ões) pendente(s) serão REMOVIDAS: o treinamento deixa de aparecer para essas pessoas.\n` +
          `• ${impacto.concluidas} atribuição(ões) concluída(s) serão MANTIDAS (evidência e certificado).\n` +
          '• Atribuições recebidas por outro caminho (individual, trilha ou outra regra) não são alteradas.\n\n' +
          'Nada é apagado: as atribuições removidas ficam no histórico com o motivo.'
        );

      if (!confirmou) {
        return;
      }

      const resultado =
        await props.service.desativar(regra);

      await carregar();

      setSucesso(
        `Regra desativada. ${resultado.removidas} atribuição(ões) removida(s)` +
        (resultado.concluidasMantidas ? `; ${resultado.concluidasMantidas} concluída(s) mantida(s)` : '') +
        '.'
      );

      if (resultado.falhas.length > 0) {
        setErro(
          `Não foi possível remover ${resultado.falhas.length} atribuição(ões): ${resultado.falhas.join(' | ')}`
        );
      }

    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível alterar a regra.'
      );
    } finally {
      setProcessandoRegra('');
    }
  };

  // Regra já inativa (desativada antes desta versão): remove as
  // pendentes que ficaram.
  const removerPendentes = async (
    regra: IRegraAtribuicaoArea
  ): Promise<void> => {
    setErro('');
    setSucesso('');
    setProcessandoRegra(regra.id);

    try {
      const impacto =
        await props.service.impactoDesativacao(regra.id);

      if (impacto.pendentes === 0) {
        setSucesso(`Não há atribuições pendentes criadas pela regra "${regra.treinamentoNome} → ${regra.areaNome}".`);
        return;
      }

      const confirmou =
        window.confirm(
          `Remover ${impacto.pendentes} atribuição(ões) pendente(s) criada(s) pela regra "${regra.treinamentoNome} → ${regra.areaNome}"?\n\n` +
          `As ${impacto.concluidas} concluída(s) serão mantidas. Nada é apagado: as removidas ficam no histórico com o motivo.`
        );

      if (!confirmou) {
        return;
      }

      const resultado =
        await props.service.removerPendentes(regra);

      setSucesso(`${resultado.removidas} atribuição(ões) removida(s).`);

      if (resultado.falhas.length > 0) {
        setErro(
          `Não foi possível remover ${resultado.falhas.length} atribuição(ões): ${resultado.falhas.join(' | ')}`
        );
      }
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível remover as atribuições.'
      );
    } finally {
      setProcessandoRegra('');
    }
  };

  return (
    <>
      <div style={card}>
        <h3 style={{ margin: '0 0 4px', color: C.azulEscuro }}>
          Atribuir por área
        </h3>
        <p style={{ margin: '0 0 18px', color: C.secundario, fontSize: '13px', lineHeight: 1.5 }}>
          O treinamento é atribuído a todos os membros ativos das áreas selecionadas e,
          automaticamente, a quem entrar nelas depois. Treinamentos já concluídos e válidos
          são reaproveitados.
        </p>

        {erro && (
          <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: C.vermelhoClaro, color: C.vermelho, fontSize: '13px' }}>
            {erro}
          </div>
        )}

        {sucesso && (
          <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: C.verdeClaro, color: C.verde, fontSize: '13px', lineHeight: 1.5 }}>
            {sucesso}
          </div>
        )}

        <label style={{ fontWeight: 600, fontSize: '14px' }}>Treinamento *</label>
        <select
          value={treinamentoId}
          disabled={salvando}
          onChange={e => { setTreinamentoId(e.target.value); setAreasMarcadas({}); setExcluidos({}); setPesquisaPessoas(''); setSucesso(''); }}
          style={{ ...input, marginTop: '6px', marginBottom: '16px' }}
        >
          <option value="">Selecione</option>
          {treinamentosAtivos.map(t => (
            <option key={t.id} value={t.id}>
              {t.codigo} - {t.nome}
            </option>
          ))}
        </select>

        <label style={{ fontWeight: 600, fontSize: '14px' }}>Áreas *</label>
        <div
          style={{
            marginTop: '8px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '8px'
          }}
        >
          {areasAtivas.map(area => {
            const jaAtribuida = !!treinamentoId && areaTemRegraAtiva(area.id);
            const membros = membrosPorArea[guid(area.id)] || 0;
            const marcada = !!areasMarcadas[area.id];

            return (
              <label
                key={area.id}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${marcada ? C.azul : C.borda}`,
                  background: jaAtribuida ? C.fundo : marcada ? C.azulClaro : C.branco,
                  cursor: jaAtribuida || !treinamentoId ? 'default' : 'pointer',
                  opacity: !treinamentoId ? 0.6 : 1
                }}
              >
                <input
                  type="checkbox"
                  checked={marcada || jaAtribuida}
                  disabled={jaAtribuida || !treinamentoId || salvando}
                  onChange={() => setAreasMarcadas({ ...areasMarcadas, [area.id]: !marcada })}
                />
                <span style={{ fontSize: '13px' }}>
                  <strong>{area.sigla ? `${area.sigla} - ` : ''}{area.nome}</strong>
                  <span style={{ display: 'block', color: C.secundario, fontSize: '12px' }}>
                    {jaAtribuida ? 'Já atribuída' : `${membros} membro(s) ativo(s)`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {pessoas.length > 0 && (
          <div
            style={{
              marginBottom: '18px',
              border: `1px solid ${C.borda}`,
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: C.fundo,
                borderBottom: `1px solid ${C.borda}`
              }}
            >
              <div>
                <strong style={{ fontSize: '14px', color: C.azulEscuro }}>
                  Quem vai receber: {pessoasAlcancadas} de {pessoas.length} pessoa(s)
                </strong>
                <span style={{ display: 'block', marginTop: '2px', color: C.secundario, fontSize: '12px' }}>
                  Remova quem não deve receber este treinamento.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="search"
                  value={pesquisaPessoas}
                  onChange={e => setPesquisaPessoas(e.target.value)}
                  placeholder="Pesquisar pessoa..."
                  aria-label="Pesquisar pessoa na lista"
                  style={{ ...input, width: '220px', padding: '7px 10px', fontSize: '13px' }}
                />

                {idsExcluidos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExcluidos({})}
                    disabled={salvando}
                    style={btn}
                  >
                    Incluir todos de volta
                  </button>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {pessoasVisiveis.length === 0 && (
                <div style={{ padding: '14px', color: C.secundario, fontSize: '13px' }}>
                  Nenhuma pessoa encontrada.
                </div>
              )}

              {pessoasVisiveis.map(pessoa => {
                const removida = !!excluidos[pessoa.usuarioId];

                return (
                  <div
                    key={pessoa.usuarioId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '9px 14px',
                      borderTop: `1px solid ${C.borda}`,
                      background: removida ? C.fundo : C.branco
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, opacity: removida ? 0.6 : 1 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: C.texto,
                          textDecoration: removida ? 'line-through' : 'none'
                        }}
                      >
                        {pessoa.nome}
                      </span>
                      <span style={{ display: 'block', fontSize: '12px', color: C.secundario }}>
                        {pessoa.email}
                        {pessoa.email && pessoa.areas.length ? ' · ' : ''}
                        {pessoa.areas.join(', ')}
                      </span>
                    </div>

                    {removida && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: C.secundario }}>
                        Não vai receber
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => alternarPessoa(pessoa.usuarioId)}
                      disabled={salvando}
                      aria-pressed={removida}
                      title={removida ? 'Incluir de volta na atribuição' : 'Remover desta atribuição'}
                      style={{
                        ...btn,
                        padding: '6px 12px',
                        color: removida ? C.verde : C.vermelho,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {removida ? 'Incluir de volta' : 'Remover'}
                    </button>
                  </div>
                );
              })}
            </div>

            {idsExcluidos.length > 0 && (
              <div
                style={{
                  padding: '10px 14px',
                  borderTop: `1px solid ${C.borda}`,
                  background: C.azulClaro,
                  color: C.texto,
                  fontSize: '12px',
                  lineHeight: 1.5
                }}
              >
                As {idsExcluidos.length} pessoa(s) removida(s) ficam como exceção da regra: não recebem
                este treinamento por estas áreas, nem se saírem e voltarem para elas. Se precisarem dele
                depois, atribua individualmente (modo Por pessoa).
              </div>
            )}
          </div>
        )}

        <label style={{ fontWeight: 600, fontSize: '14px' }}>Prazo para conclusão (dias)</label>
        <input
          type="number"
          min={0}
          max={3650}
          value={prazo}
          disabled={salvando}
          onChange={e => setPrazo(e.target.value)}
          placeholder="Opcional. Ex.: 30"
          style={{ ...input, marginTop: '6px', maxWidth: '220px' }}
        />
        <small style={{ display: 'block', marginTop: '4px', color: C.secundario }}>
          Contado a partir da data em que cada pessoa recebe o treinamento.
        </small>

        <button
          type="button"
          disabled={salvando || !treinamentoId || selecionadas.length === 0 || pessoasAlcancadas === 0 && pessoas.length > 0}
          onClick={() => { void salvar(); }}
          style={{
            ...btnPrimario,
            marginTop: '20px',
            opacity: salvando || !treinamentoId || selecionadas.length === 0 ? 0.6 : 1
          }}
        >
          {salvando
            ? 'Salvando...'
            : selecionadas.length
              ? `Atribuir a ${selecionadas.length} área(s) · ${pessoasAlcancadas} pessoa(s) hoje` +
                (idsExcluidos.length ? ` (${idsExcluidos.length} removida(s))` : '')
              : 'Atribuir às áreas selecionadas'}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 4px', color: C.azulEscuro }}>
          Regras por área {treinamentoId ? 'deste treinamento' : ''}
        </h3>
        <p style={{ margin: '0 0 14px', color: C.secundario, fontSize: '13px' }}>
          Desativar uma regra interrompe novas atribuições e remove as atribuições pendentes criadas por ela.
          As concluídas e o histórico são mantidos.
        </p>

        {carregando && <div style={{ color: C.secundario, fontSize: '13px' }}>Carregando...</div>}

        {!carregando && (treinamentoId ? regrasDoTreinamento : regras).length === 0 && (
          <div style={{ color: C.secundario, fontSize: '13px' }}>Nenhuma regra cadastrada.</div>
        )}

        {!carregando && (treinamentoId ? regrasDoTreinamento : regras).length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: C.fundo, textAlign: 'left' }}>
                  {!treinamentoId && <th style={{ padding: '8px 10px' }}>Treinamento</th>}
                  <th style={{ padding: '8px 10px' }}>Área</th>
                  <th style={{ padding: '8px 10px' }}>Prazo</th>
                  <th style={{ padding: '8px 10px' }}>Exceções</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(treinamentoId ? regrasDoTreinamento : regras).map(regra => (
                  <tr key={regra.id} style={{ borderTop: `1px solid ${C.borda}` }}>
                    {!treinamentoId && <td style={{ padding: '8px 10px' }}>{regra.treinamentoNome}</td>}
                    <td style={{ padding: '8px 10px' }}>{regra.areaNome}</td>
                    <td style={{ padding: '8px 10px' }}>{regra.prazoDias ? `${regra.prazoDias} dias` : '—'}</td>
                    <td
                      style={{ padding: '8px 10px', color: regra.usuariosExcluidos.length ? C.texto : C.secundario }}
                      title={regra.usuariosExcluidos.map(nomeDoUsuario).join('\n')}
                    >
                      {regra.usuariosExcluidos.length
                        ? `${regra.usuariosExcluidos.length} pessoa(s) fora`
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '999px',
                          fontWeight: 700,
                          fontSize: '12px',
                          background: regra.ativo ? C.verdeClaro : C.fundo,
                          color: regra.ativo ? C.verde : C.secundario
                        }}
                      >
                        {regra.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <button
                        type="button"
                        onClick={() => { void alternarRegra(regra); }}
                        disabled={!!processandoRegra}
                        style={{ ...btn, color: regra.ativo ? C.vermelho : C.verde, opacity: processandoRegra && processandoRegra !== regra.id ? 0.5 : 1 }}
                      >
                        {processandoRegra === regra.id
                          ? 'Processando...'
                          : regra.ativo ? 'Desativar' : 'Reativar'}
                      </button>

                      {!regra.ativo && (
                        <button
                          type="button"
                          onClick={() => { removerPendentes(regra).catch(() => undefined); }}
                          disabled={!!processandoRegra}
                          title="Remove as atribuições pendentes que esta regra criou antes de ser desativada"
                          style={{ ...btn, marginLeft: '8px', color: C.vermelho, opacity: processandoRegra ? 0.5 : 1 }}
                        >
                          Remover pendentes
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default AtribuicaoPorAreaPanel;
