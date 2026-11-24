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
  podeVerDashboard,
  separarDashboards
} from '../../services/DashboardService';

import GerenciarDashboardsModal from
  './GerenciarDashboardsModal';

import CriarDashboardIaModal from './CriarDashboardIaModal';

import {
  IAcessoCriacao
} from '../../services/dashboards/criacaoIa';

import DashboardPortalView from './DashboardPortalView';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  AreaAdminService
} from '../../services/AreaAdminService';

import {
  IDefinicaoDashboard,
  validarDashboard
} from '../../services/dashboards/dashboardModelo';

import {
  CATALOGO_DASHBOARD
} from '../../services/dashboards/fontesDashboard';

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

  // Áreas do usuário (dashboards do portal: quem vê e quais dados).
  contexto?:
    IContextoAcesso;
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

    // Áreas (seletor dos dashboards do portal e "Áreas que veem").
    const [areas, setAreas] =
      React.useState<Array<{ id: string; nome: string }>>([]);

    React.useEffect(
      () => {
        if (!props.dataverseService) {
          return;
        }
        new AreaAdminService(props.dataverseService).listarAreas()
          .then(lista => setAreas(
            lista
              .filter(area => area.ativa !== false)
              .map(area => ({ id: area.id.replace(/[{}]/g, '').toLowerCase(), nome: area.sigla ? `${area.sigla} · ${area.nome}` : area.nome }))
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          ))
          .catch(() => setAreas([]));
      },
      [props.dataverseService]
    );

    // Áreas do usuário; Administrador (ou administrador do módulo
    // Indicadores) vê os dados de todas.
    const areasDoUsuario =
      (props.contexto && props.contexto.vinculosArea ? props.contexto.vinculosArea : [])
        .map(vinculo => String(vinculo.areaId || '').replace(/[{}]/g, '').toLowerCase())
        .filter((id, indice, lista) => !!id && lista.indexOf(id) === indice);

    const veTodasAsAreas =
      (props.perfil || '').toLowerCase() === 'administrador' ||
      (!!props.contexto && (props.contexto.modulosAdministrados || []).indexOf('indicadores') >= 0);

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

    // Quem sou eu no Dataverse (dono dos dashboards pessoais).
    const [meuId, setMeuId] =
      React.useState('');

    React.useEffect(
      () => {
        if (!props.dataverseService) {
          return;
        }
        props.dataverseService.whoAmI()
          .then(eu => setMeuId(eu.UserId.replace(/[{}]/g, '').toLowerCase()))
          .catch(() => setMeuId(''));
      },
      [props.dataverseService]
    );

    // Dashboards oficiais (publicados) e os pessoais do usuário. Os
    // pessoais de outras pessoas nunca aparecem.
    const { oficiais, meus: meusDashboards } =
      separarDashboards(dashboards, meuId);

    const abasVisiveis =
      oficiais.filter(
        d =>
          d.ativo &&
          podeVerDashboard(
            d,
            veTodasAsAreas ? 'Administrador' : props.perfil,
            areasDoUsuario
          )
      ).concat(meusDashboards);

    // ✦ Criar com IA: qualquer usuário com acesso aos Indicadores (o
    // Dataverse exige Criar em dgt_dashboard; a IA só recebe as fontes
    // liberadas para ele).
    const podeCriarComIa = !!dashboardService && !!props.dataverseService;

    const acessoCriacao: IAcessoCriacao =
      React.useMemo(
        () => ({
          perfil: props.perfil,
          modulosPermitidos: props.contexto ? props.contexto.modulosPermitidos : undefined,
          veTodasAsAreas
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [props.perfil, veTodasAsAreas, JSON.stringify(props.contexto ? props.contexto.modulosPermitidos || [] : [])]
      );

    const [criandoComIa, setCriandoComIa] =
      React.useState<'novo' | 'ajustar' | ''>('');

    const [publicoPublicar, setPublicoPublicar] =
      React.useState<'Todos' | 'Gestor' | 'Administrador'>('Todos');

    const [acaoPessoal, setAcaoPessoal] =
      React.useState('');

    const dashboardAtivo =
      abasVisiveis.find(
        d => d.id === abaAtiva
      );

    const primeiroDashboardId =
      abasVisiveis.length > 0
        ? abasVisiveis[0].id
        : '';

    // Definição do dashboard do portal, convertida UMA vez por texto salvo
    // (antes era refeita a cada renderização: recarregava os dados e
    // apagaria os ajustes feitos no ✎ do painel).
    const textoDefinicao =
      dashboardAtivo && dashboardAtivo.tipo === 'Portal' ? dashboardAtivo.definicao : '';

    const validacaoAtiva =
      React.useMemo(
        () => (textoDefinicao ? validarDashboard(textoDefinicao, CATALOGO_DASHBOARD) : undefined),
        [textoDefinicao]
      );

    // Quem gerencia dashboards grava os ajustes feitos no painel.
    const salvarDefinicao =
      React.useCallback(
        async (definicao: IDefinicaoDashboard): Promise<void> => {
          if (!dashboardService || !dashboardAtivo) {
            return;
          }
          await dashboardService.salvar({ ...dashboardAtivo, definicao: JSON.stringify(definicao, null, 2) });
          await carregarDashboards();
        },
        [dashboardService, dashboardAtivo, carregarDashboards]
      );

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

        {(abasVisiveis.length > 0 || podeGerenciar || podeCriarComIa) && (
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
                  title={d.pessoal ? 'Meu dashboard (só você vê)' : undefined}
                >
                  {d.pessoal ? `☆ ${d.nome}` : d.nome}
                </button>
              ))}
            </div>

            {podeCriarComIa && (
              <button
                type="button"
                onClick={() => setCriandoComIa('novo')}
                style={{
                  padding: '7px 12px',
                  border: 0,
                  borderRadius: '8px',
                  background: '#0B1E2D',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '6px',
                  marginRight: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                ✦ Criar com IA
              </button>
            )}

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

        {/* ===================== MEU DASHBOARD (pessoal) ===================== */}

        {dashboardAtivo && dashboardAtivo.pessoal && dashboardService && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: '#EAF8FC', fontSize: '12.5px', color: '#0B1E2D' }}>
            <span style={{ flex: 1, minWidth: '200px' }}>☆ <strong>Meu dashboard</strong> — só você vê.</span>
            <button type="button" disabled={!!acaoPessoal} onClick={() => setCriandoComIa('ajustar')} style={{ padding: '6px 12px', borderRadius: '7px', border: 0, background: '#0B1E2D', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              ✦ Ajustar com IA
            </button>
            {podeGerenciar && (
              <>
                <select value={publicoPublicar} onChange={e => setPublicoPublicar(e.target.value as 'Todos' | 'Gestor' | 'Administrador')} style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px' }} aria-label="Publicar para">
                  <option value="Todos">Publicar para todos</option>
                  <option value="Gestor">Publicar para gestores e admins</option>
                  <option value="Administrador">Publicar só para administradores</option>
                </select>
                <button
                  type="button"
                  disabled={!!acaoPessoal}
                  onClick={() => {
                    setAcaoPessoal('publicar');
                    dashboardService.salvar({ ...dashboardAtivo, pessoal: false, publico: publicoPublicar })
                      .then(() => carregarDashboards())
                      .catch((e: unknown) => window.alert(e instanceof Error ? e.message : String(e)))
                      .then(() => setAcaoPessoal(''))
                      .catch(() => undefined);
                  }}
                  style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  {acaoPessoal === 'publicar' ? 'Publicando...' : 'Publicar'}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={!!acaoPessoal}
              onClick={() => {
                if (!window.confirm(`Excluir o dashboard “${dashboardAtivo.nome}”?`)) {
                  return;
                }
                setAcaoPessoal('excluir');
                dashboardService.excluir(dashboardAtivo.id)
                  .then(() => carregarDashboards())
                  .catch((e: unknown) => window.alert(e instanceof Error ? e.message : String(e)))
                  .then(() => setAcaoPessoal(''))
                  .catch(() => undefined);
              }}
              style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #f3c1c4', background: '#fff', color: '#a4262c', fontSize: '12px', cursor: 'pointer' }}
            >
              {acaoPessoal === 'excluir' ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        )}

        {/* ===================== DASHBOARD SELECIONADO ===================== */}

        {dashboardAtivo && dashboardAtivo.tipo === 'Portal' && props.dataverseService && validacaoAtiva && (() => {
          const validacao = validacaoAtiva;
          return validacao.definicao
            ? (
              <DashboardPortalView
                key={dashboardAtivo.id}
                dashboardId={dashboardAtivo.id}
                definicao={validacao.definicao}
                dataverseService={props.dataverseService}
                areasPermitidas={veTodasAsAreas ? undefined : areasDoUsuario}
                modulosAdministrados={props.contexto ? props.contexto.modulosAdministrados : undefined}
                areas={areas}
                onSalvarDefinicao={dashboardService && (podeGerenciar || (!!dashboardAtivo.pessoal && dashboardAtivo.donoId === meuId)) ? salvarDefinicao : undefined}
              />
            )
            : (
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#FDECEA', color: '#A2352A', fontSize: '13px', whiteSpace: 'pre-line' }}>
                {`A definição deste dashboard tem problemas:\n${validacao.erros.join('\n')}`}
              </div>
            );
        })()}

        {dashboardAtivo && dashboardAtivo.tipo !== 'Portal' && (
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

        {/* Erro de leitura para quem não administra (ex.: perfil sem
            permissão de Leitura em dgt_dashboard no Dataverse). */}
        {!carregando && erroDashboards && !podeGerenciar && (
          <article
            style={{
              background: '#fff',
              border: '1px solid #f5d48a',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              color: '#7a5600'
            }}
          >
            <h3 style={{ margin: '0 0 6px', color: '#0b1f3a' }}>
              Não foi possível carregar os indicadores
            </h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              Seu perfil ainda não tem permissão para ler os dashboards.
              Fale com um administrador do portal.
            </p>
          </article>
        )}

        {!carregando && !erroDashboards && abasVisiveis.length === 0 && (
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
            dashboards={oficiais}
            onFechar={() => setGerenciando(false)}
            onAlterado={carregarDashboards}
            areas={areas}
          />
        )}

        {criandoComIa && dashboardService && props.dataverseService && (
          <CriarDashboardIaModal
            dataverseService={props.dataverseService}
            dashboardService={dashboardService}
            acesso={acessoCriacao}
            areas={areas}
            areasPermitidas={veTodasAsAreas ? undefined : areasDoUsuario}
            modulosAdministrados={props.contexto ? props.contexto.modulosAdministrados : undefined}
            existente={criandoComIa === 'ajustar' && dashboardAtivo && dashboardAtivo.pessoal ? dashboardAtivo : undefined}
            onFechar={() => setCriandoComIa('')}
            onSalvo={id => {
              setCriandoComIa('');
              carregarDashboards()
                .then(() => setAbaAtiva(id.replace(/[{}]/g, '').toLowerCase()))
                .catch(() => undefined);
            }}
          />
        )}
      </section>
    );
  };

export default IndicadoresPage;
