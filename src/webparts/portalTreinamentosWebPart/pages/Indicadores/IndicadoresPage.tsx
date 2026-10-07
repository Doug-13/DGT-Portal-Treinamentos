import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IItemConformidade,
  IResumoConformidade
} from '../../services/ConformidadeService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  DashboardService,
  IDashboard,
  podeVerDashboard
} from '../../services/DashboardService';

import GerenciarDashboardsModal from
  './GerenciarDashboardsModal';

export interface IIndicadoresPageProps {
  itens:
    IItemConformidade[];

  resumo:
    IResumoConformidade;

  onVoltar:
    () => void;

  // Opcionais: habilitam as abas de dashboards (tabela dgt_dashboard).
  dataverseService?:
    DataverseService;

  // Perfil global do usuário (Funcionario | Editor | Gestor |
  // Administrador). Administrador gerencia os dashboards.
  perfil?:
    string;
}

const ABA_GERAL = '__geral__';

const Indicador:
  React.FC<{
    titulo: string;
    valor: string | number;
    detalhe?: string;
  }> = ({
    titulo,
    valor,
    detalhe
  }) => (
    <article
      style={{
        background:
          '#ffffff',
        border:
          '1px solid #e5e7eb',
        borderRadius:
          '16px',
        padding:
          '20px',
        minHeight:
          '118px'
      }}
    >
      <span
        style={{
          display:
            'block',
          fontSize:
            '12px',
          color:
            '#64748b',
          marginBottom:
            '8px'
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          display:
            'block',
          fontSize:
            '30px',
          lineHeight:
            1.1,
          color:
            '#0b1f3a'
        }}
      >
        {valor}
      </strong>

      {detalhe && (
        <small
          style={{
            display:
              'block',
            marginTop:
              '8px',
            color:
              '#64748b'
          }}
        >
          {detalhe}
        </small>
      )}
    </article>
  );

const Barra:
  React.FC<{
    label: string;
    valor: number;
    total: number;
  }> = ({
    label,
    valor,
    total
  }) => {

    const percentual =
      total > 0
        ? Math.round(
            (
              valor /
              total
            ) *
            100
          )
        : 0;

    return (
      <div
        style={{
          marginBottom:
            '14px'
        }}
      >
        <div
          style={{
            display:
              'flex',
            justifyContent:
              'space-between',
            gap:
              '12px',
            marginBottom:
              '6px'
          }}
        >
          <span>
            {label}
          </span>

          <strong>
            {valor} ({percentual}%)
          </strong>
        </div>

        <div
          style={{
            height:
              '10px',
            borderRadius:
              '999px',
            background:
              '#eef2f7',
            overflow:
              'hidden'
          }}
        >
          <div
            style={{
              width:
                `${percentual}%`,
              height:
                '100%',
              background:
                '#0091ff',
              borderRadius:
                '999px'
            }}
          />
        </div>
      </div>
    );
  };

const IndicadoresPage:
  React.FC<IIndicadoresPageProps> = (
    props
  ) => {

    const total =
      props.resumo.total;

    // ==========================================================
    // DASHBOARDS (abas)
    // ==========================================================

    // ==========================================================
    // REGRAS DE ACESSO DA PÁGINA
    // ==========================================================
    // - Entrar na página: módulo "Indicadores" liberado ao usuário
    //   (Usuários e acessos) — validado no RoutePermissionService.
    // - Visão geral (dados de conformidade da equipe/empresa):
    //   somente Gestor (inclusive gestor de área) e Administrador.
    // - Abas de dashboards: conforme o campo "Quem vê" de cada uma.
    // - Gerenciar dashboards: somente Administrador.
    // ==========================================================

    const perfilNormalizado =
      (props.perfil || '').toLowerCase();

    const ehAdministrador =
      perfilNormalizado ===
      'administrador';

    // Sem perfil informado (versão antiga do PortalRouter) mantém o
    // comportamento anterior: visão geral visível.
    const podeVerVisaoGeral =
      !props.perfil ||
      ehAdministrador ||
      perfilNormalizado === 'gestor';

    const dashboardService =
      React.useMemo(
        () =>
          props.dataverseService
            ? new DashboardService(
                props.dataverseService
              )
            : undefined,
        [props.dataverseService]
      );

    const [
      dashboards,
      setDashboards
    ] =
      React.useState<IDashboard[]>([]);

    const [
      erroDashboards,
      setErroDashboards
    ] =
      React.useState('');

    const [
      abaAtiva,
      setAbaAtiva
    ] =
      React.useState(
        podeVerVisaoGeral
          ? ABA_GERAL
          : ''
      );

    const [
      carregandoDashboards,
      setCarregandoDashboards
    ] =
      React.useState(
        !!props.dataverseService
      );

    const [
      gerenciando,
      setGerenciando
    ] =
      React.useState(false);

    const carregarDashboards =
      React.useCallback(
        async (): Promise<void> => {

          if (!dashboardService) {
            return;
          }

          try {
            setErroDashboards('');
            setDashboards(
              await dashboardService.listar()
            );
          } catch (e) {
            console.warn('Não foi possível carregar os dashboards (dgt_dashboard).', e);
            setErroDashboards(
              'Não foi possível carregar os dashboards. Confira se a tabela dgt_dashboard foi criada e se o seu perfil tem permissão de leitura.'
            );
          } finally {
            setCarregandoDashboards(false);
          }
        },
        [dashboardService]
      );

    React.useEffect(
      () => {
        carregarDashboards()
          .catch((e: unknown) => console.error(e));
      },
      [carregarDashboards]
    );

    const abasVisiveis =
      dashboards.filter(
        d =>
          d.ativo &&
          podeVerDashboard(
            d,
            props.perfil
          )
      );

    const dashboardAtivo =
      abasVisiveis.find(
        d => d.id === abaAtiva
      );

    // Aba inválida (removida, sem permissão ou ainda não escolhida):
    // vai para a visão geral, se permitida, ou para o 1º dashboard.
    const primeiroDashboardId =
      abasVisiveis.length > 0
        ? abasVisiveis[0].id
        : '';

    React.useEffect(
      () => {

        const valida =
          (abaAtiva === ABA_GERAL && podeVerVisaoGeral) ||
          !!dashboardAtivo;

        if (valida) {
          return;
        }

        const destino =
          podeVerVisaoGeral
            ? ABA_GERAL
            : primeiroDashboardId;

        if (destino !== abaAtiva) {
          setAbaAtiva(destino);
        }
      },
      [abaAtiva, dashboardAtivo, podeVerVisaoGeral, primeiroDashboardId]
    );

    const estiloAba =
      (ativa: boolean): React.CSSProperties => ({
        padding: '10px 16px',
        border: 'none',
        borderBottom: ativa ? '3px solid #1f6feb' : '3px solid transparent',
        background: 'transparent',
        color: ativa ? '#1f4e96' : '#334155',
        fontWeight: ativa ? 700 : 600,
        fontSize: '13px',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      });

    const notas =
      props.itens
        .map(
          item =>
            item.nota
        )
        .filter(
          (
            nota
          ): nota is number =>
            typeof nota ===
              'number'
        );

    const notaMedia =
      notas.length > 0
        ? Math.round(
            notas.reduce(
              (
                soma,
                nota
              ) =>
                soma +
                nota,
              0
            ) /
            notas.length
          )
        : 0;

    const retreinamentos =
      props.itens.filter(
        item =>
          item.origem
            .toLowerCase()
            .indexOf(
              'revis'
            ) >= 0 ||
          item.origem
            .toLowerCase()
            .indexOf(
              'reciclag'
            ) >= 0
      ).length;

    const pessoas =
      new Set(
        props.itens.map(
          item =>
            item.usuario
        )
      ).size;

    const treinamentos =
      new Set(
        props.itens.map(
          item =>
            item.treinamento
        )
      ).size;

    return (
      <section>
        <PageHeader
          titulo="Indicadores"
          subtitulo="Visão consolidada da operação de treinamentos."
        />

        <button
          type="button"
          onClick={
            props.onVoltar
          }
        >
          ← Voltar
        </button>

        {/* ===================== ABAS ===================== */}

        {(abasVisiveis.length > 0 || ehAdministrador) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '16px 0',
              borderBottom: '1px solid #e2e8f0'
            }}
          >
            <div
              role="tablist"
              style={{
                display: 'flex',
                overflowX: 'auto',
                flex: 1
              }}
            >
              {podeVerVisaoGeral && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaAtiva === ABA_GERAL}
                  onClick={() => setAbaAtiva(ABA_GERAL)}
                  style={estiloAba(abaAtiva === ABA_GERAL)}
                >
                  Visão geral
                </button>
              )}

              {abasVisiveis.map(d => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={abaAtiva === d.id}
                  onClick={() => setAbaAtiva(d.id)}
                  style={estiloAba(abaAtiva === d.id)}
                >
                  {d.nome}
                </button>
              ))}
            </div>

            {ehAdministrador && dashboardService && (
              <button
                type="button"
                onClick={() => setGerenciando(true)}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                ⚙ Gerenciar dashboards
              </button>
            )}
          </div>
        )}

        {erroDashboards && ehAdministrador && (
          <div
            style={{
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#fff8e6',
              border: '1px solid #f5d48a',
              color: '#7a5600',
              fontSize: '13px'
            }}
          >
            {erroDashboards}
          </div>
        )}

        {/* ===================== DASHBOARD SELECIONADO ===================== */}

        {dashboardAtivo && (
          <article
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '16px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px'
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: '#0b1f3a' }}>
                  {dashboardAtivo.nome}
                </h3>
                {dashboardAtivo.descricao && (
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                    {dashboardAtivo.descricao}
                  </p>
                )}
              </div>

              <a
                href={dashboardAtivo.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', fontWeight: 600, color: '#1f4e96', whiteSpace: 'nowrap' }}
              >
                Abrir em nova janela ↗
              </a>
            </div>

            <iframe
              key={dashboardAtivo.id}
              title={dashboardAtivo.nome}
              src={dashboardAtivo.url}
              style={{
                width: '100%',
                height: `${dashboardAtivo.altura}px`,
                border: 'none',
                borderRadius: '10px',
                background: '#f8fafc'
              }}
              allowFullScreen={true}
            />
          </article>
        )}

        {/* ===================== SEM CONTEÚDO PARA O PERFIL ===================== */}

        {!podeVerVisaoGeral &&
          !carregandoDashboards &&
          abasVisiveis.length === 0 && (
          <article
            style={{
              marginTop: '16px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              color: '#64748b'
            }}
          >
            <h3 style={{ margin: '0 0 6px', color: '#0b1f3a' }}>
              Nenhum indicador disponível
            </h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              Ainda não há dashboards publicados para o seu perfil.
            </p>
          </article>
        )}

        {!podeVerVisaoGeral &&
          carregandoDashboards && (
          <div style={{ marginTop: '16px', color: '#64748b', fontSize: '13px' }}>
            Carregando indicadores...
          </div>
        )}

        {/* ===================== VISÃO GERAL ===================== */}

        {abaAtiva === ABA_GERAL && podeVerVisaoGeral && (
          <>

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(170px,1fr))',
            gap:
              '14px',
            marginTop:
              '18px'
          }}
        >
          <Indicador
            titulo="Conformidade"
            valor={
              `${props.resumo.conformidadePercentual}%`
            }
          />

          <Indicador
            titulo="Pessoas"
            valor={
              pessoas
            }
          />

          <Indicador
            titulo="Treinamentos"
            valor={
              treinamentos
            }
          />

          <Indicador
            titulo="Concluídos"
            valor={
              props.resumo.concluidos
            }
          />

          <Indicador
            titulo="Pendentes"
            valor={
              props.resumo.pendentes
            }
          />

          <Indicador
            titulo="Vencidos"
            valor={
              props.resumo.vencidos
            }
          />

          <Indicador
            titulo="A vencer"
            valor={
              props.resumo.aVencer
            }
            detalhe="Próximos 30 dias"
          />

          <Indicador
            titulo="Nota média"
            valor={
              `${notaMedia}%`
            }
          />

          <Indicador
            titulo="Retreinamentos"
            valor={
              retreinamentos
            }
          />
        </div>

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(320px,1fr))',
            gap:
              '16px',
            marginTop:
              '18px'
          }}
        >
          <article
            style={{
              background:
                '#fff',
              border:
                '1px solid #e5e7eb',
              borderRadius:
                '16px',
              padding:
                '20px'
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
                color:
                  '#0b1f3a'
              }}
            >
              Distribuição por status
            </h3>

            <Barra
              label="Concluídos"
              valor={
                props.resumo.concluidos
              }
              total={
                total
              }
            />

            <Barra
              label="Pendentes"
              valor={
                props.resumo.pendentes
              }
              total={
                total
              }
            />

            <Barra
              label="Vencidos"
              valor={
                props.resumo.vencidos
              }
              total={
                total
              }
            />

            <Barra
              label="A vencer"
              valor={
                props.resumo.aVencer
              }
              total={
                total
              }
            />

            <Barra
              label="Em andamento"
              valor={
                props.resumo.emAndamento
              }
              total={
                total
              }
            />

            <Barra
              label="Reprovados"
              valor={
                props.resumo.reprovados
              }
              total={
                total
              }
            />
          </article>

          <article
            style={{
              background:
                '#fff',
              border:
                '1px solid #e5e7eb',
              borderRadius:
                '16px',
              padding:
                '20px'
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
                color:
                  '#0b1f3a'
              }}
            >
              Power BI
            </h3>

            <p
              style={{
                color:
                  '#475569',
                lineHeight:
                  1.6
              }}
            >
              {abasVisiveis.length > 0
                ? 'Os dashboards do Power BI estão disponíveis nas abas acima.'
                : ehAdministrador && dashboardService
                  ? 'Nenhum dashboard publicado ainda. Use “Gerenciar dashboards” para adicionar as abas com os relatórios do Power BI.'
                  : 'Os dashboards do Power BI serão publicados nesta página em breve.'}
            </p>

            <div
              style={{
                marginTop:
                  '18px',
                minHeight:
                  '220px',
                border:
                  '1px dashed #cbd5e1',
                borderRadius:
                  '12px',
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                textAlign:
                  'center',
                padding:
                  '20px',
                background:
                  '#f8fafc',
                color:
                  '#64748b'
              }}
            >
              {abasVisiveis.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {abasVisiveis.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setAbaAtiva(d.id)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#1f4e96'
                      }}
                    >
                      {d.nome}
                    </button>
                  ))}
                </div>
              ) : ehAdministrador && dashboardService ? (
                <button
                  type="button"
                  onClick={() => setGerenciando(true)}
                  style={{
                    padding: '9px 14px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#1f4e96',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  + Adicionar dashboard
                </button>
              ) : (
                'Nenhum dashboard publicado.'
              )}
            </div>
          </article>
        </div>
          </>
        )}

        {gerenciando && dashboardService && (
          <GerenciarDashboardsModal
            service={dashboardService}
            dashboards={dashboards}
            onFechar={() => setGerenciando(false)}
            onAlterado={carregarDashboards}
          />
        )}
      </section>
    );
  };

export default IndicadoresPage;
