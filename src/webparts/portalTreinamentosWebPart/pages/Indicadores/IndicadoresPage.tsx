import * as React from 'react';

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

// ============================================================
// INDICADORES
//
// A página mostra apenas as abas de dashboards (tabela
// dgt_dashboard), uma por dashboard, sem cabeçalho nem "Visão geral".
//
// - Entrar na página: módulo "Indicadores" liberado ao usuário
//   (RoutePermissionService).
// - Abas visíveis: conforme o campo "Quem vê" de cada dashboard.
// - Gerenciar dashboards: Administrador ou Editor com o módulo
//   Indicadores liberado.
//
// itens/resumo/onVoltar continuam no contrato por compatibilidade
// com o PortalRouter (não são mais exibidos aqui).
// ============================================================

export interface IIndicadoresPageProps {
  itens:
    IItemConformidade[];

  resumo:
    IResumoConformidade;

  onVoltar:
    () => void;

  dataverseService?:
    DataverseService;

  // Perfil para a regra "Quem vê" (Funcionario | Editor | Gestor |
  // Administrador). Gestor/Editor de área chegam aqui como "Gestor".
  perfil?:
    string;

  podeGerenciarDashboards?:
    boolean;
}

const IndicadoresPage:
  React.FC<IIndicadoresPageProps> = (
    props
  ) => {

    const podeGerenciar =
      (props.perfil || '').toLowerCase() === 'administrador' ||
      !!props.podeGerenciarDashboards;

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

    const [dashboards, setDashboards] =
      React.useState<IDashboard[]>([]);

    const [erroDashboards, setErroDashboards] =
      React.useState('');

    const [abaAtiva, setAbaAtiva] =
      React.useState('');

    const [carregando, setCarregando] =
      React.useState(!!props.dataverseService);

    const [gerenciando, setGerenciando] =
      React.useState(false);

    const carregarDashboards =
      React.useCallback(
        async (): Promise<void> => {

          if (!dashboardService) {
            setCarregando(false);
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
            setCarregando(false);
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

    const primeiroDashboardId =
      abasVisiveis.length > 0
        ? abasVisiveis[0].id
        : '';

    // Sem aba válida (início, removida ou sem permissão): abre a 1ª.
    React.useEffect(
      () => {
        if (
          !dashboardAtivo &&
          primeiroDashboardId !== abaAtiva
        ) {
          setAbaAtiva(primeiroDashboardId);
        }
      },
      [abaAtiva, dashboardAtivo, primeiroDashboardId]
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

    return (
      <section>

        {/* ===================== ABAS ===================== */}

        {(abasVisiveis.length > 0 || podeGerenciar) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 0 16px',
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

            {podeGerenciar && dashboardService && (
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

        {erroDashboards && podeGerenciar && (
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
                alignItems: 'center',
                gap: '12px',
                marginBottom: '10px'
              }}
            >
              <span style={{ color: '#64748b', fontSize: '13px' }}>
                {dashboardAtivo.descricao}
              </span>

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

        {/* ===================== SEM DASHBOARDS ===================== */}

        {carregando && (
          <div style={{ color: '#64748b', fontSize: '13px' }}>
            Carregando indicadores...
          </div>
        )}

        {!carregando && abasVisiveis.length === 0 && (
          <article
            style={{
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
              {podeGerenciar && dashboardService
                ? 'Use “Gerenciar dashboards” para adicionar as abas com os relatórios do Power BI.'
                : 'Ainda não há dashboards publicados para o seu perfil.'}
            </p>
          </article>
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
