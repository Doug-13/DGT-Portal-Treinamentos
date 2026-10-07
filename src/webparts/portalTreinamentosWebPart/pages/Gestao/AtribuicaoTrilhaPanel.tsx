import * as React from 'react';

import {
  ITrilhaAtribuicao,
  IUsuarioAtribuicao
} from '../../services/AtribuicaoAdminService';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  AtribuicaoTrilhaService,
  IProgressoAtribuicaoTrilha,
  IResumoAtribuicaoTrilha
} from '../../services/AtribuicaoTrilhaService';

export interface IAtribuicaoTrilhaPanelProps {
  modo: 'area' | 'pessoa';
  service: AtribuicaoTrilhaService;
  trilhas: ITrilhaAtribuicao[];
  usuarios: IUsuarioAtribuicao[];
  areas: IAreaAdmin[];
  usuariosAreas: IUsuarioAreaAdmin[];
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #d8dee8',
  borderRadius: '8px',
  background: '#fff',
  marginTop: '6px'
};

const buttonPrimary: React.CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: '8px',
  background: '#1677ff',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
};

const guid = (valor: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const AtribuicaoTrilhaPanel: React.FC<IAtribuicaoTrilhaPanelProps> = props => {

  const [trilhaId, setTrilhaId] = React.useState('');
  const [usuarioId, setUsuarioId] = React.useState('');
  const [areasSelecionadas, setAreasSelecionadas] = React.useState<string[]>([]);
  const [dataLimite, setDataLimite] = React.useState('');
  const [prazoDias, setPrazoDias] = React.useState('');
  const [observacao, setObservacao] = React.useState('');

  const [processando, setProcessando] = React.useState(false);
  const [progresso, setProgresso] = React.useState<IProgressoAtribuicaoTrilha | undefined>(undefined);
  const [erro, setErro] = React.useState('');
  const [resumo, setResumo] = React.useState<IResumoAtribuicaoTrilha | undefined>(undefined);

  const [qtdTreinamentos, setQtdTreinamentos] = React.useState<number | undefined>(undefined);
  const [todasAreas, setTodasAreas] = React.useState(false);

  // Membros ativos por área (sem repetir pessoa)
  const membrosPorArea = React.useMemo(
    (): Record<string, string[]> => {
      const mapa: Record<string, Record<string, string>> = {};

      props.usuariosAreas
        .filter(v => v.ativo && !!v.usuarioId && !!v.areaId)
        .forEach(v => {
          const area = guid(v.areaId);
          mapa[area] = mapa[area] || {};
          mapa[area][guid(v.usuarioId)] = v.usuarioId;
        });

      const resultado: Record<string, string[]> = {};
      Object.keys(mapa).forEach(area => {
        resultado[area] = Object.keys(mapa[area]).map(k => mapa[area][k]);
      });

      return resultado;
    },
    [props.usuariosAreas]
  );

  const totalMembros = (areaId: string): number =>
    (membrosPorArea[guid(areaId)] || []).length;

  const totalPessoasSelecionadas = React.useMemo(
    (): number => {
      const vistos: Record<string, boolean> = {};
      areasSelecionadas.forEach(areaId =>
        (membrosPorArea[guid(areaId)] || []).forEach(u => {
          vistos[guid(u)] = true;
        })
      );
      return Object.keys(vistos).length;
    },
    [areasSelecionadas, membrosPorArea]
  );

  // Ao escolher a trilha: quantidade de treinamentos e se é "todas as áreas"
  React.useEffect(() => {

    setQtdTreinamentos(undefined);
    setTodasAreas(false);

    if (!trilhaId) {
      return;
    }

    let cancelado = false;

    Promise.all([
      props.service.listarTreinamentosDaTrilha(trilhaId),
      props.service.trilhaEhParaTodasAreas(trilhaId).catch(() => false)
    ])
      .then(([itens, todas]) => {
        if (!cancelado) {
          setQtdTreinamentos(itens.length);
          setTodasAreas(todas);
        }
      })
      .catch((e: unknown) => console.error('Erro ao ler treinamentos da trilha:', e));

    return () => {
      cancelado = true;
    };
  }, [trilhaId, props.service]);

  const alternarArea = (areaId: string): void => {
    setAreasSelecionadas(atuais =>
      atuais.indexOf(areaId) >= 0
        ? atuais.filter(id => id !== areaId)
        : [...atuais, areaId]
    );
  };

  const limparResultado = (): void => {
    setErro('');
    setResumo(undefined);
    setProgresso(undefined);
  };

  const atribuir = async (): Promise<void> => {

    limparResultado();

    if (!trilhaId) {
      setErro('Selecione a trilha.');
      return;
    }

    if (props.modo === 'pessoa' && !usuarioId) {
      setErro('Selecione o usuário.');
      return;
    }

    if (props.modo === 'area' && areasSelecionadas.length === 0) {
      setErro('Selecione ao menos uma área.');
      return;
    }

    if (qtdTreinamentos === 0) {
      setErro('Esta trilha não possui treinamentos ativos.');
      return;
    }

    setProcessando(true);

    try {

      const prazo = Number(prazoDias);

      const resultado =
        props.modo === 'pessoa'
          ? await props.service.atribuirParaPessoa(
              usuarioId,
              trilhaId,
              {
                origem: 'Individual',
                dataLimite: dataLimite || undefined,
                observacao: observacao || undefined
              }
            )
          : await props.service.atribuirParaAreas(
              trilhaId,
              areasSelecionadas,
              membrosPorArea,
              {
                origem: 'Grupo',
                prazoDias: prazo > 0 ? prazo : undefined,
                observacao: observacao || undefined
              },
              setProgresso
            );

      setResumo(resultado);

    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atribuir a trilha.');
    } finally {
      setProcessando(false);
      setProgresso(undefined);
    }
  };

  const areasAtivas =
    props.areas
      .filter(a => a.ativa)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <div
      style={{
        padding: '22px',
        border: '1px solid #e5e7eb',
        borderRadius: '14px',
        background: '#fff'
      }}
    >
      <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>
        {props.modo === 'area' ? 'Atribuir trilha por área' : 'Atribuir trilha por pessoa'}
      </h3>

      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
        {props.modo === 'area'
          ? 'Todos os membros ativos das áreas selecionadas recebem todos os treinamentos da trilha, na ordem da trilha. A área também passa a visualizar a trilha.'
          : 'A pessoa recebe todos os treinamentos da trilha, na ordem da trilha. Apenas o primeiro pendente fica liberado; os seguintes são liberados conforme as conclusões.'}
      </p>

      {erro && (
        <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: '#fde7e9', color: '#a4262c' }}>
          {erro}
        </div>
      )}

      {resumo && (
        <div
          style={{
            marginBottom: '14px',
            padding: '14px',
            borderRadius: '10px',
            background: resumo.falhas.length === 0 ? '#e7f5ee' : '#fff4ce',
            color: resumo.falhas.length === 0 ? '#13795b' : '#6a4b00',
            fontSize: '13px'
          }}
        >
          <strong>
            {resumo.falhas.length === 0 ? 'Trilha atribuída' : 'Trilha atribuída com pendências'}
          </strong>
          <div style={{ marginTop: '4px' }}>
            {resumo.pessoas} pessoa(s) · {resumo.criados} treinamento(s) atribuído(s) ·{' '}
            {resumo.reaproveitados} reaproveitado(s) · {resumo.existentes} já existia(m) ·{' '}
            {resumo.liberados} liberado(s) · {resumo.matriculasCriadas} matrícula(s) nova(s) na trilha
          </div>
          {resumo.falhas.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
              {resumo.falhas.slice(0, 10).map((falha, i) => (
                <li key={i}>{falha}</li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: '6px', fontSize: '12px' }}>
            Os colaboradores verão a trilha ao recarregar o portal (F5).
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>

        <div>
          <label>Trilha *</label>
          <select
            value={trilhaId}
            onChange={e => { setTrilhaId(e.target.value); limparResultado(); }}
            style={inputStyle}
          >
            <option value="">Selecione</option>
            {props.trilhas.map(trilha => (
              <option key={trilha.id} value={trilha.id}>{trilha.nome}</option>
            ))}
          </select>
          {trilhaId && qtdTreinamentos !== undefined && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: qtdTreinamentos > 0 ? '#475569' : '#a4262c' }}>
              {qtdTreinamentos > 0
                ? `${qtdTreinamentos} treinamento(s) ativo(s) na trilha`
                : 'Nenhum treinamento ativo nesta trilha'}
            </div>
          )}
        </div>

        {props.modo === 'pessoa' && (
          <div>
            <label>Usuário *</label>
            <select
              value={usuarioId}
              onChange={e => { setUsuarioId(e.target.value); limparResultado(); }}
              style={inputStyle}
            >
              <option value="">Selecione</option>
              {props.usuarios.map(usuario => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome}{usuario.email ? ` - ${usuario.email}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.modo === 'pessoa' ? (
          <div>
            <label>Data limite</label>
            <input
              type="date"
              value={dataLimite}
              onChange={e => setDataLimite(e.target.value)}
              style={inputStyle}
            />
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
              Em branco: vale o prazo de cada treinamento na trilha.
            </div>
          </div>
        ) : (
          <div>
            <label>Prazo para conclusão (dias)</label>
            <input
              type="number"
              min={0}
              value={prazoDias}
              placeholder="Opcional. Ex.: 30"
              onChange={e => setPrazoDias(e.target.value)}
              style={inputStyle}
            />
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
              Em branco: vale o prazo de cada treinamento na trilha.
            </div>
          </div>
        )}
      </div>

      {props.modo === 'area' && (
        <>
          {todasAreas && (
            <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#fff8e6', border: '1px solid #f5d48a', color: '#7a5600', fontSize: '13px' }}>
              Esta trilha está configurada para <strong>todas as áreas</strong>. A atribuição será feita
              apenas aos membros das áreas selecionadas abaixo; a configuração da trilha não é alterada.
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <label>Áreas *</label>
          </div>

          <div
            style={{
              marginTop: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px'
            }}
          >
            {areasAtivas.map(area => {
              const selecionada = areasSelecionadas.indexOf(area.id) >= 0;
              const membros = totalMembros(area.id);

              return (
                <label
                  key={area.id}
                  style={{
                    display: 'flex',
                    gap: '9px',
                    alignItems: 'center',
                    padding: '12px',
                    border: selecionada ? '1px solid #8bbde8' : '1px solid #e2e8f0',
                    borderRadius: '9px',
                    background: selecionada ? '#f5faff' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selecionada}
                    onChange={() => { alternarArea(area.id); limparResultado(); }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span><strong>{area.sigla}</strong>{' - '}{area.nome}</span>
                    <span style={{ fontSize: '12px', color: membros > 0 ? '#475569' : '#94a3b8' }}>
                      {membros === 0 ? 'Nenhum membro' : membros === 1 ? '1 membro' : `${membros} membros`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {areasSelecionadas.length > 0 && (
            <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#334155' }}>
              {totalPessoasSelecionadas === 1
                ? '1 colaborador receberá esta trilha agora.'
                : `${totalPessoasSelecionadas} colaboradores receberão esta trilha agora.`}
            </p>
          )}
        </>
      )}

      <div style={{ marginTop: '16px' }}>
        <label>Observação</label>
        <textarea
          rows={3}
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          disabled={processando}
          onClick={() => {
            atribuir().catch((e: unknown) => console.error(e));
          }}
          style={{ ...buttonPrimary, opacity: processando ? 0.6 : 1 }}
        >
          {processando
            ? 'Processando...'
            : props.modo === 'area'
              ? 'Atribuir trilha às áreas selecionadas'
              : 'Atribuir trilha'}
        </button>

        {progresso && (
          <span style={{ fontSize: '13px', color: '#475569' }}>
            {progresso.descricao}
          </span>
        )}
      </div>
    </div>
  );
};

export default AtribuicaoTrilhaPanel;
