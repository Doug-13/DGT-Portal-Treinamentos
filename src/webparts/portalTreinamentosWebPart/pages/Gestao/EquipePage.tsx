import * as React from 'react';

import {
  IColaborador,
  ITreinamentoColaborador
} from '../../models/Usuario';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface IEquipePageProps {
  colaboradores?: IColaborador[];
  carregando?: boolean;
  erro?: string;

  // Áreas e vínculos usuário × área (Gestão → Áreas e acessos).
  // Opcionais: sem eles a tela funciona como antes, sem filtro por área.
  areas?: IAreaAdmin[];
  usuariosAreas?: IUsuarioAreaAdmin[];

  onVoltar: () => void;
}

// ============================================================
// IDENTIDADE VISUAL
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';

// Filtro "Sem área": colaboradores sem vínculo ativo com nenhuma área.
const SEM_AREA = '__sem_area__';

// ============================================================
// UTILITÁRIOS
// ============================================================

const normalizarId = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const normalizarEmail = (
  valor?: string
): string =>
  (valor || '')
    .trim()
    .toLowerCase();

const totalDoColaborador = (
  item: IColaborador
): number =>
  item.total ??
  (
    item.concluidos +
    item.pendentes +
    (item.vencidos || 0)
  );

// Conformidade de um grupo: concluídos ÷ total de atribuições.
const conformidadeDoGrupo = (
  lista: IColaborador[]
): string => {

  const total =
    lista.reduce((soma, item) => soma + totalDoColaborador(item), 0);

  if (total === 0) {
    return '-';
  }

  const concluidos =
    lista.reduce((soma, item) => soma + item.concluidos, 0);

  return `${Math.round((concluidos / total) * 100)}%`;
};

// ------------------------------------------------------------
// Datas do detalhe de treinamentos
// Data só com dia ("2026-11-30") vira meio-dia local, para não
// "voltar" um dia ao exibir.
// ------------------------------------------------------------

const lerData = (
  valor?: string
): Date | undefined => {

  if (!valor) {
    return undefined;
  }

  const data =
    /^\d{4}-\d{2}-\d{2}$/.test(valor)
      ? new Date(`${valor}T12:00:00`)
      : new Date(valor);

  return isNaN(data.getTime())
    ? undefined
    : data;
};

const formatarData = (
  valor?: string
): string => {

  const data =
    lerData(valor);

  return data
    ? data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '-';
};

// Dias corridos de hoje até a data (negativo = já passou).
const diasAte = (
  valor?: string
): number | undefined => {

  const data =
    lerData(valor);

  if (!data) {
    return undefined;
  }

  const hoje = new Date();

  const inicio = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return Math.round((inicio(data) - inicio(hoje)) / 86400000);
};

// Ordem do detalhe: em aberto primeiro (prazo mais próximo no topo,
// sem prazo no fim), depois os concluídos (mais recente primeiro).
const ordenarTreinamentos = (
  lista: ITreinamentoColaborador[]
): ITreinamentoColaborador[] =>
  lista
    .slice()
    .sort((a, b) => {

      const aConcluido = a.situacao === 'concluido';
      const bConcluido = b.situacao === 'concluido';

      if (aConcluido !== bConcluido) {
        return aConcluido ? 1 : -1;
      }

      if (aConcluido) {
        return (b.dataConclusao || '').localeCompare(a.dataConclusao || '');
      }

      const pa = lerData(a.dataLimite);
      const pb = lerData(b.dataLimite);

      if (pa && pb) {
        return pa.getTime() - pb.getTime();
      }

      if (pa || pb) {
        return pa ? -1 : 1;
      }

      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

// Cores do selo de status.
const estiloStatus = (
  item: ITreinamentoColaborador
): { fundo: string; cor: string } => {

  if (item.situacao === 'concluido') {
    return { fundo: '#e7f6ef', cor: '#16825d' };
  }

  if (item.situacao === 'vencido' || item.status === 'Reprovado') {
    return { fundo: '#fde7e9', cor: '#a4262c' };
  }

  if (item.status === 'Em andamento') {
    return { fundo: '#e8f2ff', cor: '#0f6cbd' };
  }

  if (item.status === 'Bloqueado') {
    return { fundo: '#F2F2F2', cor: '#5E6670' };
  }

  return { fundo: '#fff4e0', cor: '#b45309' };
};

// Texto do prazo para realização.
const situacaoPrazo = (
  item: ITreinamentoColaborador
): { texto: string; cor: string } | undefined => {

  if (item.situacao === 'concluido') {
    return undefined;
  }

  const dias =
    diasAte(item.dataLimite);

  if (dias === undefined) {
    return undefined;
  }

  if (dias < 0) {
    return {
      texto: `Prazo expirado há ${-dias} dia${dias === -1 ? '' : 's'}`,
      cor: '#a4262c'
    };
  }

  if (dias === 0) {
    return { texto: 'Prazo termina hoje', cor: '#b45309' };
  }

  return {
    texto: `Falta${dias === 1 ? '' : 'm'} ${dias} dia${dias === 1 ? '' : 's'}`,
    cor: dias <= 7 ? '#b45309' : '#64748b'
  };
};

interface IVinculoColaborador {
  areaId: string;
  sigla: string;
  nome: string;
  perfil: string;
}

interface IGrupoArea {
  chave: string;
  titulo: string;
  sigla: string;
  colaboradores: IColaborador[];
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

// Paleta dos status (a mesma da aba Conformidade).
const CORES = {
  concluido: { cor: '#16825d', fundo: '#e7f6ef' },
  pendente: { cor: '#b45309', fundo: '#fff4e0' },
  vencido: { cor: '#a4262c', fundo: '#fde7e9' },
  neutro: { cor: '#94a3b8' }
};

// Card do topo. Clicável: liga/desliga o filtro rápido do card.
// Só o card selecionado ganha fundo colorido.
const Indicador: React.FC<{
  titulo: string;
  valor: number;
  cor?: string;
  fundoAtivo?: string;
  ativo?: boolean;
  dica?: string;
  onClick?: () => void;
}> = ({
  titulo,
  valor,
  cor = COR_AZUL,
  fundoAtivo = '#EDF0F5',
  ativo = false,
  dica,
  onClick
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={ativo}
    title={dica}
    style={{
      display: 'block',
      width: '100%',
      padding: '17px',
      textAlign: 'left',
      font: 'inherit',
      cursor: 'pointer',
      background: ativo ? fundoAtivo : '#ffffff',
      border: ativo ? `2px solid ${cor}` : '1px solid #e5e7eb',
      borderLeft: `5px solid ${cor}`,
      borderRadius: '12px',
      boxShadow: ativo ? '0 2px 8px rgba(32, 42, 68, 0.12)' : 'none',
      transition: 'background 0.15s, box-shadow 0.15s'
    }}
  >
    <span
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '6px',
        color: '#64748b',
        fontSize: '13px'
      }}
    >
      {titulo}
      {ativo && (
        <span style={{ color: cor, fontWeight: 700, fontSize: '12px' }}>
          Filtrando ✓
        </span>
      )}
    </span>

    <strong
      style={{
        display: 'block',
        marginTop: '5px',
        color: cor,
        fontSize: '24px'
      }}
    >
      {valor}
    </strong>
  </button>
);

// Número da tabela: colorido só quando há algo a mostrar; zero
// fica cinza para não encher a tela de verde/laranja/vermelho.
const NumeroStatus: React.FC<{
  valor: number;
  cor: string;
}> = ({
  valor,
  cor
}) => (
  <span
    style={{
      color: valor > 0 ? cor : CORES.neutro.cor,
      fontWeight: valor > 0 ? 700 : 400
    }}
  >
    {valor}
  </span>
);

const Cabecalho: React.FC<{
  children: React.ReactNode;
}> = ({
  children
}) => (
  <th
    style={{
      padding: '13px 14px',
      textAlign: 'left',
      fontSize: '12px',
      color: '#475569',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    {children}
  </th>
);

const Celula: React.FC<{
  children: React.ReactNode;
}> = ({
  children
}) => (
  <td
    style={{
      padding: '14px',
      color: '#334155',
      fontSize: '13px'
    }}
  >
    {children}
  </td>
);

const estiloCampo: React.CSSProperties = {
  padding: '11px 14px',
  border: '1px solid #d8dee8',
  borderRadius: '9px',
  fontSize: '14px',
  outline: 'none',
  background: '#ffffff',
  color: COR_AZUL
};

// ============================================================
// PÁGINA
// ============================================================

const EquipePage:
  React.FC<IEquipePageProps> = ({
    colaboradores = [],
    carregando = false,
    erro = '',
    areas = [],
    usuariosAreas = [],
    onVoltar
  }) => {

    const [
      pesquisa,
      setPesquisa
    ] = React.useState('');

    // '' = todas as áreas · SEM_AREA = sem vínculo · id da área
    const [
      areaFiltro,
      setAreaFiltro
    ] = React.useState('');

    const [
      agruparPorArea,
      setAgruparPorArea
    ] = React.useState(true);

    // Filtros rápidos (combináveis: valem todos os marcados).
    const [
      soComTreinamento,
      setSoComTreinamento
    ] = React.useState(false);

    const [
      soComPendentes,
      setSoComPendentes
    ] = React.useState(false);

    const [
      soComConcluidos,
      setSoComConcluidos
    ] = React.useState(false);

    const [
      soComVencidos,
      setSoComVencidos
    ] = React.useState(false);

    // Colaboradores com o detalhe de treinamentos aberto.
    // Chave = grupo + colaborador (a mesma pessoa pode aparecer em
    // mais de uma área e cada linha abre de forma independente).
    const [
      expandidos,
      setExpandidos
    ] = React.useState<Record<string, boolean>>({});

    const alternarExpandido = (
      chave: string
    ): void =>
      setExpandidos(
        atual => ({
          ...atual,
          [chave]: !atual[chave]
        })
      );

    // ==========================================================
    // ÁREAS DE CADA COLABORADOR
    // Vínculo ativo em dgt_usuarioarea, achado pelo id do usuário
    // ou, na falta dele, pelo e-mail.
    // ==========================================================

    const areaPorId =
      React.useMemo(
        () => {
          const mapa: Record<string, IAreaAdmin> = {};
          areas.forEach(area => { mapa[normalizarId(area.id)] = area; });
          return mapa;
        },
        [areas]
      );

    const vinculosPorColaborador =
      React.useMemo(
        () => {

          const mapa: Record<string, IVinculoColaborador[]> = {};

          colaboradores.forEach(
            colaborador => {

              const id =
                normalizarId(colaborador.id);

              const email =
                normalizarEmail(colaborador.email);

              const lista: IVinculoColaborador[] = [];

              usuariosAreas
                .filter(
                  vinculo =>
                    vinculo.ativo &&
                    (
                      (!!id && normalizarId(vinculo.usuarioId) === id) ||
                      (!!email && normalizarEmail(vinculo.usuarioEmail) === email)
                    )
                )
                .forEach(
                  vinculo => {

                    const areaId =
                      normalizarId(vinculo.areaId);

                    // Área inativa: não entra no filtro nem no grupo.
                    const area =
                      areaPorId[areaId];

                    if (area && !area.ativa) {
                      return;
                    }

                    if (lista.some(item => item.areaId === areaId)) {
                      return;
                    }

                    lista.push({
                      areaId,
                      sigla: (area ? area.sigla : vinculo.areaSigla) || '',
                      nome: (area ? area.nome : vinculo.areaNome) || '',
                      perfil: vinculo.perfil
                    });
                  }
                );

              lista.sort((a, b) => (a.sigla || a.nome).localeCompare(b.sigla || b.nome));

              mapa[String(colaborador.id)] = lista;
            }
          );

          return mapa;
        },
        [
          colaboradores,
          usuariosAreas,
          areaPorId
        ]
      );

    const areasDoColaborador = (
      item: IColaborador
    ): IVinculoColaborador[] =>
      vinculosPorColaborador[String(item.id)] || [];

    const temAreas =
      usuariosAreas.length > 0 ||
      areas.length > 0;

    // Opções do filtro: só as áreas que têm alguém da equipe.
    const opcoesArea =
      React.useMemo(
        () => {

          const mapa: Record<string, { id: string; rotulo: string; quantidade: number }> = {};

          let semArea = 0;

          colaboradores.forEach(
            colaborador => {

              const lista =
                vinculosPorColaborador[String(colaborador.id)] || [];

              if (lista.length === 0) {
                semArea++;
              }

              lista.forEach(
                vinculo => {
                  if (!mapa[vinculo.areaId]) {
                    mapa[vinculo.areaId] = {
                      id: vinculo.areaId,
                      rotulo: [vinculo.sigla, vinculo.nome].filter(item => !!item).join(' — ') || 'Área sem nome',
                      quantidade: 0
                    };
                  }
                  mapa[vinculo.areaId].quantidade++;
                }
              );
            }
          );

          return {
            areas:
              Object.keys(mapa)
                .map(chave => mapa[chave])
                .sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
            semArea
          };
        },
        [
          colaboradores,
          vinculosPorColaborador
        ]
      );

    // Área escolhida deixou de existir (ex.: recarga): volta para todas.
    React.useEffect(
      () => {
        if (
          areaFiltro &&
          areaFiltro !== SEM_AREA &&
          !opcoesArea.areas.some(item => item.id === areaFiltro)
        ) {
          setAreaFiltro('');
        }
      },
      [
        areaFiltro,
        opcoesArea
      ]
    );

    // ==========================================================
    // FILTRO
    // ==========================================================

    const listaFiltrada =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          return colaboradores.filter(
            item => {

              const vinculos =
                vinculosPorColaborador[String(item.id)] || [];

              if (areaFiltro === SEM_AREA && vinculos.length > 0) {
                return false;
              }

              if (
                areaFiltro &&
                areaFiltro !== SEM_AREA &&
                !vinculos.some(vinculo => vinculo.areaId === areaFiltro)
              ) {
                return false;
              }

              if (soComTreinamento && totalDoColaborador(item) === 0) {
                return false;
              }

              if (soComPendentes && item.pendentes === 0) {
                return false;
              }

              if (soComConcluidos && item.concluidos === 0) {
                return false;
              }

              if (soComVencidos && (item.vencidos || 0) === 0) {
                return false;
              }

              if (!termo) {
                return true;
              }

              const textoAreas =
                vinculos
                  .map(vinculo => `${vinculo.sigla} ${vinculo.nome}`)
                  .join(' ')
                  .toLowerCase();

              return (
                item.nome.toLowerCase().includes(termo) ||
                (item.email || '').toLowerCase().includes(termo) ||
                (item.funcao || '').toLowerCase().includes(termo) ||
                (item.setor || '').toLowerCase().includes(termo) ||
                textoAreas.includes(termo)
              );
            }
          );
        },
        [
          colaboradores,
          pesquisa,
          areaFiltro,
          vinculosPorColaborador,
          soComTreinamento,
          soComPendentes,
          soComConcluidos,
          soComVencidos
        ]
      );

    // ==========================================================
    // GRUPOS POR ÁREA
    // Quem pertence a mais de uma área aparece em cada uma delas
    // (os indicadores do topo contam cada pessoa uma única vez).
    // ==========================================================

    const grupos: IGrupoArea[] =
      React.useMemo(
        () => {

          const mapa: Record<string, IGrupoArea> = {};

          const semArea: IColaborador[] = [];

          listaFiltrada.forEach(
            item => {

              const vinculos =
                (vinculosPorColaborador[String(item.id)] || [])
                  // Com uma área escolhida, o grupo é só ela.
                  .filter(vinculo => !areaFiltro || areaFiltro === SEM_AREA || vinculo.areaId === areaFiltro);

              if (vinculos.length === 0) {
                semArea.push(item);
                return;
              }

              vinculos.forEach(
                vinculo => {
                  if (!mapa[vinculo.areaId]) {
                    mapa[vinculo.areaId] = {
                      chave: vinculo.areaId,
                      titulo: vinculo.nome || vinculo.sigla || 'Área sem nome',
                      sigla: vinculo.sigla,
                      colaboradores: []
                    };
                  }
                  mapa[vinculo.areaId].colaboradores.push(item);
                }
              );
            }
          );

          const lista =
            Object.keys(mapa)
              .map(chave => mapa[chave])
              .sort((a, b) => (a.sigla || a.titulo).localeCompare(b.sigla || b.titulo));

          if (semArea.length > 0) {
            lista.push({
              chave: SEM_AREA,
              titulo: 'Sem área cadastrada',
              sigla: '',
              colaboradores: semArea
            });
          }

          return lista;
        },
        [
          listaFiltrada,
          vinculosPorColaborador,
          areaFiltro
        ]
      );

    // ==========================================================
    // INDICADORES (sobre o que está filtrado)
    // ==========================================================

    const totalConcluidos =
      listaFiltrada.reduce((total, item) => total + item.concluidos, 0);

    const totalPendentes =
      listaFiltrada.reduce((total, item) => total + item.pendentes, 0);

    const totalVencidos =
      listaFiltrada.reduce((total, item) => total + (item.vencidos || 0), 0);

    const filtrando =
      !!pesquisa.trim() ||
      !!areaFiltro ||
      soComTreinamento ||
      soComPendentes ||
      soComConcluidos ||
      soComVencidos;

    // Filtros rápidos de status (usados pelo card "Colaboradores"
    // para limpar tudo de uma vez).
    const limparFiltrosRapidos = (): void => {
      setSoComTreinamento(false);
      setSoComPendentes(false);
      setSoComConcluidos(false);
      setSoComVencidos(false);
    };

    // Quantos colaboradores cada filtro rápido mostraria (sobre a
    // equipe toda), para orientar a escolha.
    const contagemComTreinamento =
      colaboradores.filter(item => totalDoColaborador(item) > 0).length;

    const contagemComPendentes =
      colaboradores.filter(item => item.pendentes > 0).length;

    const contagemComConcluidos =
      colaboradores.filter(item => item.concluidos > 0).length;

    const contagemComVencidos =
      colaboradores.filter(item => (item.vencidos || 0) > 0).length;

    const filtroRapido = (
      rotulo: string,
      quantidade: number,
      ativo: boolean,
      alternar: () => void,
      dica: string
    ): React.ReactElement => (
      <button
        type="button"
        aria-pressed={ativo}
        title={dica}
        onClick={alternar}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 12px',
          borderRadius: '20px',
          border: ativo ? `1px solid ${COR_CIANO}` : '1px solid #d8dee8',
          background: ativo ? '#E6F9FC' : '#ffffff',
          color: COR_AZUL,
          fontSize: '12.5px',
          fontWeight: ativo ? 700 : 600,
          cursor: 'pointer'
        }}
      >
        <span aria-hidden="true">{ativo ? '✓' : '+'}</span>
        {rotulo}
        <span
          style={{
            padding: '0 7px',
            borderRadius: '10px',
            background: ativo ? '#ffffff' : '#F2F2F2',
            fontSize: '11.5px'
          }}
        >
          {quantidade}
        </span>
      </button>
    );

    // ==========================================================
    // CARREGANDO
    // ==========================================================

    if (carregando) {

      return (
        <section>

          <PageHeader
            titulo="Minha equipe"
            subtitulo="Carregando dados dos colaboradores..."
            acao={
              <button
                type="button"
                onClick={onVoltar}
              >
                Voltar
              </button>
            }
          />

          <div
            style={{
              padding: '30px',
              textAlign: 'center',
              color: '#64748b'
            }}
          >
            Carregando equipe...
          </div>

        </section>
      );
    }

    // ==========================================================
    // TREINAMENTOS DE UM COLABORADOR (detalhe ao clicar no nome)
    // ==========================================================

    const renderizarTreinamentos = (
      item: IColaborador
    ): React.ReactElement => {

      const lista =
        ordenarTreinamentos(item.treinamentos || []);

      if (lista.length === 0) {
        return (
          <div style={{ padding: '12px 0', color: '#64748b', fontSize: '13px' }}>
            Nenhum treinamento atribuído a este colaborador.
          </div>
        );
      }

      const th: React.CSSProperties = {
        padding: '9px 10px',
        textAlign: 'left',
        fontSize: '11.5px',
        color: '#5E6670',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        borderBottom: '1px solid #e5e7eb'
      };

      const td: React.CSSProperties = {
        padding: '9px 10px',
        fontSize: '12.5px',
        color: '#334155',
        borderBottom: '1px solid #edf0f4',
        verticalAlign: 'top'
      };

      return (
        <div
          style={{
            marginTop: '4px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            overflowX: 'auto'
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
            <caption
              style={{
                padding: '10px 10px 4px',
                textAlign: 'left',
                color: COR_AZUL,
                fontSize: '12.5px',
                fontWeight: 700
              }}
            >
              Treinamentos de {item.nome} ({lista.length})
            </caption>

            <thead>
              <tr>
                <th style={th}>Treinamento</th>
                <th style={th}>Status</th>
                <th style={th}>Prazo para realização</th>
                <th style={th}>Concluído em</th>
                <th style={th}>Validade</th>
              </tr>
            </thead>

            <tbody>
              {
                lista.map(
                  treinamento => {

                    const cores =
                      estiloStatus(treinamento);

                    const prazo =
                      situacaoPrazo(treinamento);

                    return (
                      <tr key={treinamento.id || `${treinamento.treinamentoId}:${treinamento.nome}`}>

                        <td style={td}>
                          <span style={{ display: 'block', fontWeight: 600, color: '#1f2937' }}>
                            {treinamento.nome}
                          </span>
                          {treinamento.trilha && (
                            <span style={{ display: 'block', marginTop: '2px', color: '#64748b', fontSize: '11.5px' }}>
                              Trilha: {treinamento.trilha}
                            </span>
                          )}
                        </td>

                        <td style={td}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              background: cores.fundo,
                              color: cores.cor,
                              fontWeight: 700,
                              fontSize: '11.5px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {treinamento.status}
                          </span>
                        </td>

                        <td style={td}>
                          <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
                            {treinamento.dataLimite ? formatarData(treinamento.dataLimite) : 'Sem prazo definido'}
                          </span>
                          {prazo && (
                            <span style={{ display: 'block', marginTop: '2px', color: prazo.cor, fontSize: '11.5px', fontWeight: 600 }}>
                              {prazo.texto}
                            </span>
                          )}
                        </td>

                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {formatarData(treinamento.dataConclusao)}
                        </td>

                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {formatarData(treinamento.dataValidade)}
                        </td>

                      </tr>
                    );
                  }
                )
              }
            </tbody>
          </table>
        </div>
      );
    };

    // ==========================================================
    // LINHA DE UM COLABORADOR
    // ==========================================================

    const renderizarLinha = (
      item: IColaborador,
      chaveGrupo: string
    ): React.ReactElement => {

      const vinculos =
        areasDoColaborador(item);

      const vinculoDoGrupo =
        vinculos.find(vinculo => vinculo.areaId === chaveGrupo);

      const chaveLinha =
        `${chaveGrupo}:${String(item.id)}`;

      const aberto =
        !!expandidos[chaveLinha];

      const idDetalhe =
        `detalhe-treinamentos-${chaveLinha.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

      return (
        <React.Fragment key={chaveLinha}>
        <tr
          style={{
            borderTop: '1px solid #edf0f4',
            background: aberto ? '#F7FCFD' : undefined
          }}
        >

          {/* COLABORADOR — clique abre os treinamentos */}

          <Celula>

            <strong
              style={{
                display: 'block',
                color: '#1f2937'
              }}
            >
              <button
                type="button"
                onClick={() => alternarExpandido(chaveLinha)}
                aria-expanded={aberto}
                aria-controls={idDetalhe}
                title={aberto ? 'Ocultar treinamentos' : 'Ver treinamentos, status e prazos'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: COR_AZUL,
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  textDecoration: aberto ? 'underline' : 'none',
                  textUnderlineOffset: '3px'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    color: COR_CIANO,
                    transition: 'transform 0.15s',
                    transform: aberto ? 'rotate(90deg)' : 'none'
                  }}
                >
                  ▸
                </span>
                {item.nome}
              </button>

              {
                // Perfil na área do grupo (ex.: Gestor).
                vinculoDoGrupo &&
                vinculoDoGrupo.perfil &&
                vinculoDoGrupo.perfil !== 'Membro' && (
                  <span
                    style={{
                      marginLeft: '6px',
                      padding: '1px 7px',
                      borderRadius: '8px',
                      background: '#E8EAF8',
                      color: COR_INDIGO,
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                  >
                    {vinculoDoGrupo.perfil}
                  </span>
                )
              }
            </strong>

            {item.email && (
              <span
                style={{
                  display: 'block',
                  color: '#64748b',
                  fontSize: '12px',
                  marginTop: '3px'
                }}
              >
                {item.email}
              </span>
            )}

          </Celula>

          {/* FUNÇÃO */}

          <Celula>
            {item.funcao || '-'}
          </Celula>

          {/* ÁREA(S) — no lugar do antigo "Setor", que vinha vazio */}

          <Celula>
            {
              vinculos.length > 0
                ? (
                  <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {
                      vinculos.map(
                        vinculo => (
                          <span
                            key={vinculo.areaId}
                            title={vinculo.nome}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: vinculo.areaId === chaveGrupo ? '#E6F9FC' : '#F2F2F2',
                              border: vinculo.areaId === chaveGrupo ? `1px solid ${COR_CIANO}` : '1px solid transparent',
                              color: COR_AZUL,
                              fontSize: '11.5px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {vinculo.sigla || vinculo.nome}
                          </span>
                        )
                      )
                    }
                  </span>
                )
                : (item.setor || '-')
            }
          </Celula>

          {/* CONCLUÍDOS */}

          <Celula>
            <NumeroStatus valor={item.concluidos} cor={CORES.concluido.cor} />
          </Celula>

          {/* PENDENTES */}

          <Celula>
            <NumeroStatus valor={item.pendentes} cor={CORES.pendente.cor} />
          </Celula>

          {/* VENCIDOS */}

          <Celula>
            <NumeroStatus valor={item.vencidos || 0} cor={CORES.vencido.cor} />
          </Celula>

          {/* TOTAL */}

          <Celula>
            {totalDoColaborador(item)}
          </Celula>

          {/* CONFORMIDADE */}

          <Celula>
            <span
              style={{
                display: 'inline-block',
                padding: '5px 9px',
                borderRadius: '20px',
                background: '#e8f2ff',
                color: '#0f6cbd',
                fontWeight: 700
              }}
            >
              {item.conformidade}
            </span>
          </Celula>

        </tr>

        {aberto && (
          <tr id={idDetalhe}>
            <td
              colSpan={8}
              style={{
                padding: '0 14px 16px 30px',
                background: '#F7FCFD',
                borderBottom: `1px solid ${COR_CIANO}`
              }}
            >
              {renderizarTreinamentos(item)}
            </td>
          </tr>
        )}
        </React.Fragment>
      );
    };

    // Linha de título de um grupo (área), com os totais dele.
    const renderizarTituloGrupo = (
      grupo: IGrupoArea
    ): React.ReactElement => {

      const concluidos =
        grupo.colaboradores.reduce((soma, item) => soma + item.concluidos, 0);

      const pendentes =
        grupo.colaboradores.reduce((soma, item) => soma + item.pendentes, 0);

      const vencidos =
        grupo.colaboradores.reduce((soma, item) => soma + (item.vencidos || 0), 0);

      return (
        <tr
          key={`grupo:${grupo.chave}`}
          style={{
            background: grupo.chave === SEM_AREA ? '#F2F2F2' : '#EDF0F5',
            borderTop: `2px solid ${grupo.chave === SEM_AREA ? '#D9D9D6' : COR_CIANO}`
          }}
        >
          <td
            colSpan={8}
            style={{
              padding: '10px 14px',
              color: COR_AZUL,
              fontSize: '13px'
            }}
          >
            <strong style={{ fontSize: '13.5px' }}>
              {grupo.sigla ? `${grupo.sigla} — ` : ''}{grupo.titulo}
            </strong>
            <span style={{ marginLeft: '10px', color: '#5E6670' }}>
              {grupo.colaboradores.length} colaborador{grupo.colaboradores.length === 1 ? '' : 'es'}
              {' · '}{concluidos} concluído{concluidos === 1 ? '' : 's'}
              {' · '}{pendentes} pendente{pendentes === 1 ? '' : 's'}
              {' · '}{vencidos} vencido{vencidos === 1 ? '' : 's'}
              {' · '}conformidade {conformidadeDoGrupo(grupo.colaboradores)}
            </span>
          </td>
        </tr>
      );
    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
      <section>

        <PageHeader
          titulo="Minha equipe"
          subtitulo="Acompanhe progresso, pendências e conformidade dos colaboradores."
          acao={
            <button
              type="button"
              onClick={onVoltar}
            >
              Voltar
            </button>
          }
        />

        {/* ERRO */}

        {erro && (
          <div
            style={{
              marginBottom: '18px',
              padding: '14px 16px',
              background: '#fde7e9',
              border: '1px solid #f1aeb5',
              borderRadius: '10px',
              color: '#a4262c'
            }}
          >
            {erro}
          </div>
        )}

        {/* INDICADORES (respeitam os filtros) */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '22px'
          }}
        >
          <Indicador
            titulo={filtrando ? 'Colaboradores (filtrados)' : 'Colaboradores'}
            valor={listaFiltrada.length}
            dica="Limpar os filtros de status (concluídos, pendentes, vencidos)"
            onClick={limparFiltrosRapidos}
          />

          <Indicador
            titulo="Concluídos"
            valor={totalConcluidos}
            cor={CORES.concluido.cor}
            fundoAtivo={CORES.concluido.fundo}
            ativo={soComConcluidos}
            dica={soComConcluidos ? 'Clique para remover o filtro' : 'Mostrar só quem tem treinamento concluído'}
            onClick={() => setSoComConcluidos(atual => !atual)}
          />

          <Indicador
            titulo="Pendentes"
            valor={totalPendentes}
            cor={CORES.pendente.cor}
            fundoAtivo={CORES.pendente.fundo}
            ativo={soComPendentes}
            dica={soComPendentes ? 'Clique para remover o filtro' : 'Mostrar só quem tem treinamento pendente'}
            onClick={() => setSoComPendentes(atual => !atual)}
          />

          <Indicador
            titulo="Vencidos"
            valor={totalVencidos}
            cor={CORES.vencido.cor}
            fundoAtivo={CORES.vencido.fundo}
            ativo={soComVencidos}
            dica={soComVencidos ? 'Clique para remover o filtro' : 'Mostrar só quem tem treinamento vencido'}
            onClick={() => setSoComVencidos(atual => !atual)}
          />
        </div>

        {/* PESQUISA E FILTROS */}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '18px'
          }}
        >
          <input
            type="search"
            placeholder="Pesquisar colaborador..."
            value={pesquisa}
            onChange={event => setPesquisa(event.target.value)}
            style={{
              ...estiloCampo,
              width: '100%',
              maxWidth: '420px'
            }}
          />

          {
            temAreas && (
              <>
                <select
                  aria-label="Filtrar por área"
                  value={areaFiltro}
                  onChange={event => setAreaFiltro(event.target.value)}
                  style={{
                    ...estiloCampo,
                    minWidth: '260px',
                    maxWidth: '100%'
                  }}
                >
                  <option value="">Todas as áreas</option>
                  {
                    opcoesArea.areas.map(
                      opcao => (
                        <option key={opcao.id} value={opcao.id}>
                          {opcao.rotulo} ({opcao.quantidade})
                        </option>
                      )
                    )
                  }
                  {
                    opcoesArea.semArea > 0 && (
                      <option value={SEM_AREA}>
                        Sem área cadastrada ({opcoesArea.semArea})
                      </option>
                    )
                  }
                </select>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    color: COR_AZUL,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agruparPorArea}
                    onChange={event => setAgruparPorArea(event.target.checked)}
                  />
                  Agrupar por área
                </label>

                {
                  filtrando && (
                    <button
                      type="button"
                      onClick={() => {
                        setPesquisa('');
                        setAreaFiltro('');
                        setSoComTreinamento(false);
                        setSoComPendentes(false);
                        setSoComConcluidos(false);
                        setSoComVencidos(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        border: `1px solid ${COR_AZUL}`,
                        borderRadius: '8px',
                        background: '#ffffff',
                        color: COR_AZUL,
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Limpar filtros
                    </button>
                  )
                }
              </>
            )
          }
        </div>

        {/* FILTROS RÁPIDOS */}

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginTop: '-6px',
            marginBottom: '18px'
          }}
        >
          <span style={{ color: '#64748b', fontSize: '12.5px', marginRight: '2px' }}>
            Mostrar apenas:
          </span>

          {
            filtroRapido(
              'Com treinamento vinculado',
              contagemComTreinamento,
              soComTreinamento,
              () => setSoComTreinamento(atual => !atual),
              'Colaboradores com pelo menos um treinamento atribuído.'
            )
          }

          {
            filtroRapido(
              'Com pendentes',
              contagemComPendentes,
              soComPendentes,
              () => setSoComPendentes(atual => !atual),
              'Colaboradores com pelo menos um treinamento pendente.'
            )
          }

          {
            filtroRapido(
              'Com concluídos',
              contagemComConcluidos,
              soComConcluidos,
              () => setSoComConcluidos(atual => !atual),
              'Colaboradores com pelo menos um treinamento concluído.'
            )
          }

          {
            filtroRapido(
              'Com vencidos',
              contagemComVencidos,
              soComVencidos,
              () => setSoComVencidos(atual => !atual),
              'Colaboradores com pelo menos um treinamento vencido (prazo ou validade expirados).'
            )
          }

          {
            [soComTreinamento, soComPendentes, soComConcluidos, soComVencidos].filter(item => item).length > 1 && (
              <span style={{ color: '#64748b', fontSize: '12px' }}>
                (mostra quem atende a todos os marcados)
              </span>
            )
          }
        </div>

        {/* SEM RESULTADOS */}

        {listaFiltrada.length === 0 ? (

          <EmptyState
            titulo={
              filtrando
                ? 'Nenhum colaborador encontrado'
                : 'Nenhum colaborador carregado'
            }
            descricao={
              filtrando
                ? 'Tente outra área, desmarque algum filtro rápido ou pesquise por outro nome, e-mail, função ou área.'
                : 'Os colaboradores cadastrados no Dataverse serão exibidos aqui.'
            }
          />

        ) : (

          // ====================================================
          // TABELA
          // ====================================================

          <div
            style={{
              overflowX: 'auto',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '14px'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <Cabecalho>Colaborador</Cabecalho>
                  <Cabecalho>Função</Cabecalho>
                  <Cabecalho>{temAreas ? 'Área' : 'Setor'}</Cabecalho>
                  <Cabecalho>Concluídos</Cabecalho>
                  <Cabecalho>Pendentes</Cabecalho>
                  <Cabecalho>Vencidos</Cabecalho>
                  <Cabecalho>Total</Cabecalho>
                  <Cabecalho>Conformidade</Cabecalho>
                </tr>
              </thead>

              <tbody>
                {
                  temAreas && agruparPorArea
                    ? grupos.map(
                      grupo => (
                        <React.Fragment key={grupo.chave}>
                          {renderizarTituloGrupo(grupo)}
                          {grupo.colaboradores.map(item => renderizarLinha(item, grupo.chave))}
                        </React.Fragment>
                      )
                    )
                    : listaFiltrada.map(item => renderizarLinha(item, areaFiltro))
                }
              </tbody>
            </table>
          </div>
        )}

      </section>
    );
  };

export default EquipePage;
