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

const AtribuicaoPorAreaPanel: React.FC<IAtribuicaoPorAreaPanelProps> = (
  props
) => {

  const [treinamentoId, setTreinamentoId] = React.useState('');
  const [areasMarcadas, setAreasMarcadas] = React.useState<Record<string, boolean>>({});
  const [prazo, setPrazo] = React.useState('');

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

  const pessoasAlcancadas =
    selecionadas.reduce((total, id) => total + (membrosPorArea[guid(id)] || 0), 0);

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
            prazoDias: prazoNumero
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
        'depois também receberá o treinamento.'
      );

      setAreasMarcadas({});
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

  const alternarRegra = async (
    regra: IRegraAtribuicaoArea
  ): Promise<void> => {
    setErro('');
    setSucesso('');

    try {
      await props.service.definirAtiva(regra.id, !regra.ativo);
      await carregar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível alterar a regra.'
      );
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
          onChange={e => { setTreinamentoId(e.target.value); setAreasMarcadas({}); setSucesso(''); }}
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
          disabled={salvando || !treinamentoId || selecionadas.length === 0}
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
              ? `Atribuir a ${selecionadas.length} área(s) · ${pessoasAlcancadas} pessoa(s) hoje`
              : 'Atribuir às áreas selecionadas'}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 4px', color: C.azulEscuro }}>
          Regras por área {treinamentoId ? 'deste treinamento' : ''}
        </h3>
        <p style={{ margin: '0 0 14px', color: C.secundario, fontSize: '13px' }}>
          Desativar uma regra interrompe novas atribuições. As atribuições já feitas e o histórico são mantidos.
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
                        style={{ ...btn, color: regra.ativo ? C.vermelho : C.verde }}
                      >
                        {regra.ativo ? 'Desativar' : 'Reativar'}
                      </button>
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
