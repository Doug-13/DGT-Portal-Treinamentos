import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  calcularResumoConformidade,
  IItemConformidade,
  IResumoConformidade,
  lerDataConformidade,
  StatusConformidade
} from '../../services/ConformidadeService';

import {
  exportarConformidadeExcel,
  situacaoDoPrazo
} from '../../utils/exportarConformidadeExcel';

export interface IGestaoConformidadePageProps {
  itens:
    IItemConformidade[];

  resumo:
    IResumoConformidade;

  carregando:
    boolean;

  erro:
    string;

  onVoltar:
    () => void;
}

const formatarData = (
  valor: string
): string => {

  if (!valor) {
    return '-';
  }

  // Data só com dia não pode "voltar" um dia por causa do fuso.
  const data =
    lerDataConformidade(valor);

  if (!data) {
    return valor;
  }

  return data
    .toLocaleDateString(
      'pt-BR'
    );
};

// Paleta por status: a mesma cor no card do resumo e no selo da
// tabela, para a leitura ser imediata.
const CORES_STATUS: Record<StatusConformidade, { cor: string; fundo: string }> = {
  'Concluído': { cor: '#16825d', fundo: '#e7f6ef' },
  'Pendente': { cor: '#b45309', fundo: '#fff4e0' },
  'Vencido': { cor: '#a4262c', fundo: '#fde7e9' },
  'A vencer': { cor: '#a16207', fundo: '#fef9c3' },
  'Em andamento': { cor: '#0f6cbd', fundo: '#e8f2ff' },
  'Bloqueado': { cor: '#5E6670', fundo: '#F2F2F2' },
  'Reprovado': { cor: '#7a1d4f', fundo: '#fbe7f1' }
};

// Card de conformidade na cor da marca (sem semáforo), para a
// página não ficar com vários tons de vermelho ao mesmo tempo.
const COR_MARCA = '#202A44';
const COR_CIANO = '#05C3DD';

const SeloStatus: React.FC<{ status: StatusConformidade }> = ({ status }) => {
  const cores = CORES_STATUS[status] || CORES_STATUS.Pendente;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '12px',
        background: cores.fundo,
        color: cores.cor,
        fontWeight: 700,
        fontSize: '12px',
        whiteSpace: 'nowrap'
      }}
    >
      {status}
    </span>
  );
};

// Cor do aviso de prazo: vermelho expirado, laranja até 7 dias.
const corDoPrazo = (
  dias?: number
): string =>
  dias === undefined
    ? '#64748b'
    : dias < 0
      ? '#a4262c'
      : dias <= 7
        ? '#b45309'
        : '#64748b';

// Cards de status do resumo (ordem de exibição).
const CARDS_STATUS: {
  titulo: string;
  status: StatusConformidade;
  campo: 'concluidos' | 'pendentes' | 'vencidos' | 'aVencer' | 'emAndamento';
  detalhe?: string;
}[] = [
  { titulo: 'Concluídos', status: 'Concluído', campo: 'concluidos' },
  { titulo: 'Pendentes', status: 'Pendente', campo: 'pendentes' },
  { titulo: 'Vencidos', status: 'Vencido', campo: 'vencidos', detalhe: 'Prazo ou validade expirados' },
  { titulo: 'A vencer', status: 'A vencer', campo: 'aVencer', detalhe: 'Próximos 30 dias' },
  { titulo: 'Em andamento', status: 'Em andamento', campo: 'emAndamento' }
];

// Card do resumo. Clicável: filtra a tabela pelo status do card;
// clicar de novo no card ativo volta para "Todos".
const Cartao:
  React.FC<{
    titulo: string;
    valor: string | number;
    detalhe?: string;
    cor?: string;
    // Tom claro usado só quando o card está selecionado.
    fundoAtivo?: string;
    ativo?: boolean;
    dica?: string;
    onClick?: () => void;
    children?: React.ReactNode;
  }> = ({
    titulo,
    valor,
    detalhe,
    cor = COR_MARCA,
    fundoAtivo = '#EDF0F5',
    ativo = false,
    dica,
    onClick,
    children
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={dica}
      style={{
        display: 'block',
        width: '100%',
        padding: '18px',
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        border: ativo ? `2px solid ${cor}` : '1px solid #e5e7eb',
        borderLeft: `5px solid ${cor}`,
        borderRadius: '14px',
        background: ativo ? fundoAtivo : '#fff',
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
          fontSize: '12px'
        }}
      >
        {titulo}
        {ativo && (
          <span style={{ color: cor, fontWeight: 700 }}>
            Filtrando ✓
          </span>
        )}
      </span>

      <strong
        style={{
          display: 'block',
          marginTop: '6px',
          fontSize: '26px',
          color: cor
        }}
      >
        {valor}
      </strong>

      {children}

      {detalhe && (
        <small
          style={{
            display: 'block',
            marginTop: '4px',
            color: '#64748b'
          }}
        >
          {detalhe}
        </small>
      )}
    </button>
  );

const GestaoConformidadePage:
  React.FC<IGestaoConformidadePageProps> = (
    props
  ) => {

    const [
      filtro,
      setFiltro
    ] =
      React.useState<
        StatusConformidade | 'Todos'
      >(
        'Todos'
      );

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const [filtroArea, setFiltroArea] = React.useState('');

    // Clique no card: filtra pelo status; no card já ativo, limpa.
    const alternarFiltroStatus = (
      status: StatusConformidade
    ): void =>
      setFiltro(
        atual => (atual === status ? 'Todos' : status)
      );

    const [exportando, setExportando] = React.useState(false);
    const [erroExportacao, setErroExportacao] = React.useState('');

    const areas = React.useMemo(() => {
      const nomesPorId = new Map<string, string>();
      props.itens.forEach(item => item.areas?.forEach(area => nomesPorId.set(area.id, area.nome)));
      return Array.from(nomesPorId).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    }, [props.itens]);

    const itensDaArea = React.useMemo(() => {
      if (!filtroArea) return props.itens;
      return props.itens.filter(item => filtroArea === 'sem-area'
        ? !item.areas?.length
        : item.areas?.some(area => area.id === filtroArea));
    }, [filtroArea, props.itens]);

    const resumo = React.useMemo(
      () => filtroArea ? calcularResumoConformidade(itensDaArea) : props.resumo,
      [filtroArea, itensDaArea, props.resumo]
    );

    const filtrados =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          return itensDaArea
            .filter(
              item =>
                filtro ===
                  'Todos' ||
                item.status ===
                  filtro
            )
            .filter(
              item =>
                !termo ||
                item.usuario
                  .toLowerCase()
                  .indexOf(
                    termo
                  ) >= 0 ||
                item.treinamento
                  .toLowerCase()
                  .indexOf(
                    termo
                  ) >= 0 ||
                item.trilha
                  .toLowerCase()
                  .indexOf(
                    termo
                  ) >= 0
            );
        },
        [
          filtro,
          pesquisa,
          itensDaArea
        ]
      );

    const exportar = async (): Promise<void> => {

      setErroExportacao('');
      setExportando(true);

      try {

        const nomeArea =
          filtroArea === 'sem-area'
            ? 'Sem área'
            : (areas.find(([id]) => id === filtroArea) || [])[1];

        const filtros = [
          nomeArea ? `Área: ${nomeArea}` : '',
          filtro !== 'Todos' ? `Status: ${filtro}` : '',
          pesquisa.trim() ? `Pesquisa: "${pesquisa.trim()}"` : ''
        ]
          .filter(item => !!item)
          .join(' · ');

        await exportarConformidadeExcel(filtrados, filtros);

      } catch (erro) {

        console.error('[Conformidade] Falha ao exportar Excel:', erro);

        setErroExportacao(
          'Não foi possível gerar o arquivo Excel. Tente novamente; se o erro continuar, recarregue a página.'
        );

      } finally {
        setExportando(false);
      }
    };

    return (
      <section>
        <PageHeader
          titulo="Conformidade de treinamentos"
          subtitulo="Visão consolidada de conclusões, pendências, vencimentos e reciclagens."
        />

        <button
          type="button"
          onClick={
            props.onVoltar
          }
        >
          ← Voltar
        </button>

        {props.erro && (
          <div
            style={{
              marginTop:
                '16px',
              padding:
                '12px',
              borderRadius:
                '8px',
              background:
                '#fde7e9',
              color:
                '#a4262c'
            }}
          >
            {props.erro}
          </div>
        )}

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(160px,1fr))',
            gap:
              '12px',
            marginTop:
              '18px'
          }}
        >
          <Cartao
            titulo="Conformidade"
            valor={`${resumo.conformidadePercentual}%`}
            // Não fica "selecionado": serve para limpar o filtro de status.
            dica={filtro === 'Todos' ? 'Todos os status já estão visíveis' : 'Limpar filtro e mostrar todos os status'}
            onClick={() => setFiltro('Todos')}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                height: '6px',
                marginTop: '8px',
                borderRadius: '3px',
                background: '#E5E7EB',
                overflow: 'hidden'
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${Math.min(Math.max(resumo.conformidadePercentual, 0), 100)}%`,
                  background: COR_CIANO
                }}
              />
            </span>
          </Cartao>

          {
            CARDS_STATUS.map(
              card => (
                <Cartao
                  key={card.status}
                  titulo={card.titulo}
                  valor={resumo[card.campo]}
                  detalhe={card.detalhe}
                  cor={CORES_STATUS[card.status].cor}
                  fundoAtivo={CORES_STATUS[card.status].fundo}
                  ativo={filtro === card.status}
                  dica={
                    filtro === card.status
                      ? 'Clique para mostrar todos os status'
                      : `Mostrar apenas: ${card.status}`
                  }
                  onClick={() => alternarFiltroStatus(card.status)}
                />
              )
            )
          }
        </div>

        <div
          style={{
            marginTop:
              '18px',
            padding:
              '16px',
            border:
              '1px solid #e5e7eb',
            borderRadius:
              '14px',
            background:
              '#fff'
          }}
        >
          <div
            style={{
              display:
                'flex',
              gap:
                '10px',
              flexWrap:
                'wrap'
            }}
          >
            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar usuário, treinamento ou trilha..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                flex:
                  '1 1 280px',
                padding:
                  '10px',
                border:
                  '1px solid #d8dee8',
                borderRadius:
                  '8px'
              }}
            />

            <select
              aria-label="Filtrar por área"
              value={filtroArea}
              onChange={event => setFiltroArea(event.target.value)}
              style={{ padding: '10px', border: '1px solid #d8dee8', borderRadius: '8px' }}
            >
              <option value="">Todas as áreas</option>
              {areas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              {props.itens.some(item => !item.areas?.length) && (
                <option value="sem-area">Sem área</option>
              )}
            </select>

            <select
              aria-label="Filtrar por status"
              value={
                filtro
              }
              onChange={
                event =>
                  setFiltro(
                    event.target.value as
                      StatusConformidade |
                      'Todos'
                  )
              }
              style={{
                padding:
                  '10px',
                border:
                  '1px solid #d8dee8',
                borderRadius:
                  '8px'
              }}
            >
              <option>
                Todos
              </option>
              <option>
                Concluído
              </option>
              <option>
                Pendente
              </option>
              <option>
                Vencido
              </option>
              <option>
                A vencer
              </option>
              <option>
                Bloqueado
              </option>
              <option>
                Em andamento
              </option>
              <option>
                Reprovado
              </option>
            </select>

            <button
              type="button"
              onClick={() => { exportar().catch(() => undefined); }}
              disabled={exportando || props.carregando || filtrados.length === 0}
              title={
                filtrados.length === 0
                  ? 'Não há linhas para exportar com os filtros atuais.'
                  : `Exportar as ${filtrados.length} linhas exibidas para Excel`
              }
              style={{
                padding: '10px 14px',
                border: '1px solid #202A44',
                borderRadius: '8px',
                background: '#202A44',
                color: '#ffffff',
                fontWeight: 700,
                cursor: exportando || filtrados.length === 0 ? 'not-allowed' : 'pointer',
                opacity: exportando || props.carregando || filtrados.length === 0 ? 0.6 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              {exportando ? 'Gerando Excel...' : `Exportar Excel (${filtrados.length})`}
            </button>
          </div>

          {erroExportacao && (
            <div
              role="alert"
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#fde7e9',
                color: '#a4262c',
                fontSize: '13px'
              }}
            >
              {erroExportacao}
            </div>
          )}

          {props.carregando ? (
            <div
              style={{
                padding:
                  '30px',
                textAlign:
                  'center'
              }}
            >
              Carregando conformidade...
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  'auto',
                marginTop:
                  '14px'
              }}
            >
              <table
                style={{
                  width:
                    '100%',
                  borderCollapse:
                    'collapse'
                }}
              >
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Área</th>
                    <th>Treinamento</th>
                    <th>Trilha</th>
                    <th>Status</th>
                    <th>Prazo para realização</th>
                    <th>Conclusão</th>
                    <th>Validade</th>
                    <th title="Dias para vencer a validade do certificado">Dias (validade)</th>
                    <th>Origem</th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.length === 0 && (
                    <tr><td colSpan={10}>Nenhum treinamento encontrado para os filtros selecionados.</td></tr>
                  )}
                  {filtrados.map(
                    item => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          {
                            item.usuario
                          }
                        </td>

                        <td>{item.areas?.map(area => area.nome).join(', ') || 'Sem área'}</td>

                        <td>
                          {
                            item.treinamento
                          }
                        </td>

                        <td>
                          {
                            item.trilha
                          }
                        </td>

                        <td>
                          <SeloStatus status={item.status} />
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          {item.prazo ? formatarData(item.prazo) : '-'}
                          {item.diasParaPrazo !== undefined && (
                            <small
                              style={{
                                display: 'block',
                                marginTop: '2px',
                                color: corDoPrazo(item.diasParaPrazo),
                                fontWeight: 600
                              }}
                            >
                              {situacaoDoPrazo(item)}
                            </small>
                          )}
                        </td>

                        <td>
                          {
                            formatarData(
                              item.conclusao
                            )
                          }
                        </td>

                        <td>
                          {
                            formatarData(
                              item.validade
                            )
                          }
                        </td>

                        <td>
                          {
                            item
                              .diasParaVencer !==
                            undefined
                              ? item
                                  .diasParaVencer
                              : '-'
                          }
                        </td>

                        <td>
                          {
                            item.origem
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  };

export default GestaoConformidadePage;
