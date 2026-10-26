import * as React from 'react';

import {
  IAreaOrcamento,
  IConfigArea,
  OrcamentoService
} from '../../services/orcamento/OrcamentoService';

import {
  GRUPOS_ORCAMENTO,
  PLANO_CONTAS
} from '../../services/orcamento/planoContasOrcamento';

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
// CONTAS POR ÁREA (Administrador)
//
// Define quais GRUPOS de contas cada área preenche. A planilha nova
// da área vem só com as contas desses grupos, e o "Adicionar linha"
// mostra só eles. Área sem configuração = todos os grupos.
//
// Mudar a configuração não apaga linhas de planilhas já criadas: o
// gestor usa "Adicionar linha > Incluir as contas que faltam" para
// receber as contas de grupos novos.
// ============================================================

export interface IContasPorAreaViewProps {
  servico: OrcamentoService;
  areas: IAreaOrcamento[];
  configs: IConfigArea[];
  onSalvo: () => Promise<void>;
}

const contasPorGrupo: { [grupo: string]: number } = {};
PLANO_CONTAS.forEach(conta => {
  contasPorGrupo[conta.grupo] = (contasPorGrupo[conta.grupo] || 0) + 1;
});

const ContasPorAreaView: React.FC<IContasPorAreaViewProps> = (props) => {

  const [areaId, setAreaId] = React.useState<string>(props.areas.length > 0 ? props.areas[0].id : '');
  const [marcados, setMarcados] = React.useState<string[]>([]);
  const [busca, setBusca] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');

  const configDaArea = (id: string): IConfigArea | undefined =>
    props.configs.filter(item => item.areaId === id)[0];

  const configAtual = configDaArea(areaId);
  const area = props.areas.filter(item => item.id === areaId)[0];

  const original = configAtual && configAtual.grupos.length > 0 ? configAtual.grupos : GRUPOS_ORCAMENTO;

  // Áreas chegaram depois da montagem: seleciona a primeira.
  React.useEffect(() => {
    if (!areaId && props.areas.length > 0) {
      setAreaId(props.areas[0].id);
    }
  }, [areaId, props.areas]);

  // Ao trocar de área (ou recarregar), mostra o que está gravado.
  React.useEffect(() => {
    const config = props.configs.filter(item => item.areaId === areaId)[0];
    setMarcados(config && config.grupos.length > 0 ? config.grupos.slice() : GRUPOS_ORCAMENTO.slice());
    setErro('');
  }, [areaId, props.configs]);

  const alterado =
    marcados.length !== original.length || marcados.some(grupo => original.indexOf(grupo) < 0);

  const alternar = (grupo: string): void => {
    setAviso('');
    setMarcados(atual =>
      atual.indexOf(grupo) >= 0 ? atual.filter(item => item !== grupo) : atual.concat([grupo])
    );
  };

  const trocarArea = (id: string): void => {
    if (alterado && !window.confirm('Descartar as mudanças não salvas desta área?')) {
      return;
    }
    setAviso('');
    setAreaId(id);
  };

  const salvar = async (): Promise<void> => {
    if (!area) {
      return;
    }
    if (marcados.length === 0) {
      setErro('Marque pelo menos um grupo. (Para liberar todos, use "Marcar todos".)');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      // Todos marcados = sem restrição (grava a lista completa mesmo
      // assim, para ficar explícito no Dataverse).
      const ordenados = GRUPOS_ORCAMENTO.filter(grupo => marcados.indexOf(grupo) >= 0);
      await props.servico.salvarConfigArea(area, ordenados, configAtual ? configAtual.id : undefined);
      await props.onSalvo();
      setAviso(`✓ Contas de ${area.nome} salvas: ${ordenados.length} de ${GRUPOS_ORCAMENTO.length} grupos.`);
    } catch (falha) {
      setErro(explicarErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  const areasFiltradas =
    props.areas.filter(item => !busca.trim() || item.nome.toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0);

  const totalContas = marcados.reduce((soma, grupo) => soma + (contasPorGrupo[grupo] || 0), 0);

  if (props.areas.length === 0) {
    return (
      <div style={{ ...cartao, color: COR.texto2 }}>
        Nenhuma área ativa cadastrada. Cadastre as áreas em Administração antes de configurar as contas.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', gap: '16px', alignItems: 'start', fontFamily: FONTE }}>

      {/* Áreas */}
      <div style={{ ...cartao, padding: '12px', marginBottom: 0 }}>
        <input
          type="search"
          placeholder="Buscar área..."
          value={busca}
          onChange={evento => setBusca(evento.target.value)}
          aria-label="Buscar área"
          style={{ ...campo, marginBottom: '8px' }}
        />
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {areasFiltradas.map(item => {
            const config = configDaArea(item.id);
            const ativa = item.id === areaId;
            const qtd = config && config.grupos.length > 0 ? config.grupos.length : GRUPOS_ORCAMENTO.length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => trocarArea(item.id)}
                aria-pressed={ativa}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 10px',
                  marginBottom: '4px',
                  borderRadius: '8px',
                  border: `1px solid ${ativa ? COR.ciano : 'transparent'}`,
                  background: ativa ? '#F0FCFE' : 'transparent',
                  cursor: 'pointer',
                  fontFamily: FONTE
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: COR.azul }}>{item.nome}</div>
                <div style={{ fontSize: '12px', color: config ? COR.texto2 : '#B45309' }}>
                  {config ? `${qtd} de ${GRUPOS_ORCAMENTO.length} grupos` : 'Sem configuração (todos os grupos)'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grupos da área */}
      <div>
        <CaixaMensagem tipo="erro" texto={erro} />
        <CaixaMensagem tipo="sucesso" texto={aviso} />

        <div style={{ ...cartao }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: COR.azul }}>{area ? area.nome : '—'}</div>
              <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
                {marcados.length} de {GRUPOS_ORCAMENTO.length} grupos · {totalContas} conta(s)
                {configAtual && configAtual.alteradoEm && ` · última alteração em ${formatarDataHora(configAtual.alteradoEm)}`}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px', fontWeight: 600, color: configAtual && configAtual.equipeId ? '#107C10' : '#B45309' }}>
                {configAtual && configAtual.equipeId
                  ? '✓ Equipe da área sincronizada: a planilha é compartilhada pelos gestores da área.'
                  : '⚠ Equipe da área ainda não sincronizada (rode o script sincronizar-equipes-orcamento.ps1).'}
              </div>
            </div>
            <button type="button" onClick={() => { setAviso(''); setMarcados(GRUPOS_ORCAMENTO.slice()); }} style={botao('secundario')}>
              Marcar todos
            </button>
            <button type="button" onClick={() => { setAviso(''); setMarcados([]); }} style={botao('secundario')}>
              Desmarcar todos
            </button>
            <button
              type="button"
              onClick={() => { salvar().catch(() => undefined); }}
              disabled={salvando || (!alterado && !!configAtual)}
              style={botao('principal', salvando || (!alterado && !!configAtual))}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          <div style={{ fontSize: '12.5px', color: COR.texto2, marginBottom: '12px' }}>
            Marque os grupos de contas que esta área preenche. A planilha nova da área vem só com essas contas e o
            “Adicionar linha” do gestor mostra só esses grupos. Planilhas já criadas não perdem linhas: o gestor recebe
            as contas de grupos novos em “Adicionar linha › Incluir as contas que faltam”.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
            {GRUPOS_ORCAMENTO.map(grupo => {
              const marcado = marcados.indexOf(grupo) >= 0;
              return (
                <label
                  key={grupo}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${marcado ? COR.ciano : COR.borda}`,
                    background: marcado ? '#F0FCFE' : '#FFFFFF',
                    cursor: 'pointer'
                  }}
                >
                  <input type="checkbox" checked={marcado} onChange={() => alternar(grupo)} style={{ marginTop: '2px' }} />
                  <span>
                    <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: COR.azul }}>{grupo}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: COR.texto2 }}>{contasPorGrupo[grupo] || 0} conta(s)</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContasPorAreaView;
