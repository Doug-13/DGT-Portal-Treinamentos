import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

export interface IGestaoPageProps {

  treinamentos:
    ITreinamentoAdmin[];

  carregando:
    boolean;

  erro:
    string;

  processandoId:
    string;

  onNovoTreinamento:
    () => void;

  onAtribuirTreinamento:
    () => void;

  onTrilhas:
    () => void;

  onAreas:
    () => void;

  onEquipe:
    () => void;

  onEditarTreinamento:
    (
      treinamento:
        ITreinamentoAdmin
    ) => Promise<void>;

  onDefinirAtivo:
    (
      treinamentoId:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  /*
   * Mantidos temporariamente por compatibilidade
   * com o PortalRouter. Não aparecem mais como
   * botões independentes no dashboard.
   */
  onModulos:
    () => void;

  onAvaliacoes:
    () => void;

  onDocumentos:
    () => void;

  onConformidade:
    () => void;

  onIndicadores:
    () => void;
}

// ============================================================
// PALETA — cores institucionais DGT (Manual MIV_DGT_160420_01)
// + cores de status/categoria, no padrão pedido pelo usuário
// (referência visual anexada), já que o manual oficial da marca
// não define cores de status. Decisão de projeto, não do manual.
// ============================================================

const DGT = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  cinza: '#888B8D',
  cinzaClaro: '#D9D9D6',
  fundoPagina: '#F5F7FA'
};

// Cada ação do dashboard recebe uma cor de categoria (fundo claro +
// ícone saturado), como nos cards de "Acesso rápido" da referência.
const CORES_ACAO = {
  criar: { bg: '#E8F0FE', icon: '#1D4ED8' },
  atribuir: { bg: '#E6F9FC', icon: '#0B8FA6' }, // ciano DGT
  trilhas: { bg: '#F1EEFB', icon: '#6D5BD0' },
  areas: { bg: '#E8EAF8', icon: DGT.indigo }, // índigo oficial DGT
  equipe: { bg: '#FFF4E5', icon: '#C2760C' },
  documentos: { bg: '#E7F5EE', icon: '#15803D' },
  conformidade: { bg: '#DFF6FA', icon: '#0E7490' },
  indicadores: { bg: '#FDE7EF', icon: '#BE185D' }
} as const;

type ChaveCorAcao = keyof typeof CORES_ACAO;

const CORES_STATUS = {
  sucesso: { bg: '#E7F5EE', texto: '#15803D' },
  alerta: { bg: '#FFF4E5', texto: '#B45309' },
  erro: { bg: '#FDECEC', texto: '#C0392B' },
  neutro: { bg: '#F1F5F9', texto: '#64748B' }
};

// ============================================================
// ÍCONES — SVG inline (sem depender de fonte de ícone ou de
// glifos Unicode, que é o motivo de estarem invisíveis hoje).
// ============================================================

const svgBase:
  React.SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const Icones: Record<ChaveCorAcao, React.FC> = {
  criar: () => (
    <svg {...svgBase}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  atribuir: () => (
    <svg {...svgBase}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
      <path d="M15.5 3.5l2 2-4.2 4.2-2.6.6.6-2.6z" />
    </svg>
  ),
  trilhas: () => (
    <svg {...svgBase}>
      <polygon points="12 3 21 8 12 13 3 8 12 3" />
      <polyline points="3 13 12 18 21 13" />
      <polyline points="3 17.5 12 22.5 21 17.5" />
    </svg>
  ),
  areas: () => (
    <svg {...svgBase}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  ),
  equipe: () => (
    <svg {...svgBase}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 14.6c2.9.4 5.3 2.3 5.3 5.4" />
    </svg>
  ),
  documentos: () => (
    <svg {...svgBase}>
      <path d="M7 3h7l4 4v14H7z" />
      <polyline points="14 3 14 7 18 7" />
      <line x1="9.5" y1="12" x2="15.5" y2="12" />
      <line x1="9.5" y1="15.5" x2="15.5" y2="15.5" />
    </svg>
  ),
  conformidade: () => (
    <svg {...svgBase}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  ),
  indicadores: () => (
    <svg {...svgBase}>
      <line x1="5" y1="20" x2="19" y2="20" />
      <rect x="6.5" y="13" width="3" height="7" />
      <rect x="11" y="9" width="3" height="11" />
      <rect x="15.5" y="5" width="3" height="15" />
    </svg>
  )
};

const thStyle:
  React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '.02em',
  textTransform: 'uppercase',
  color: DGT.azul,
  background: '#F5F7FA',
  whiteSpace: 'nowrap'
};

const tdStyle:
  React.CSSProperties = {
  padding: '13px 14px',
  borderTop: `1px solid ${DGT.cinzaClaro}`,
  color: '#334155',
  fontSize: '13px',
  verticalAlign: 'middle'
};

const inputStyle:
  React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  border: `1px solid ${DGT.cinzaClaro}`,
  borderRadius: '8px',
  fontSize: '14px',
  color: DGT.azul
};

const botaoBase:
  React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: '8px',
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: 'pointer'
};

const botaoEditar:
  React.CSSProperties = {
  ...botaoBase,
  border: `1px solid ${DGT.azul}`,
  background: '#FFFFFF',
  color: DGT.azul
};

const botaoDesativar:
  React.CSSProperties = {
  ...botaoBase,
  border: `1px solid ${CORES_STATUS.erro.texto}`,
  background: '#FFFFFF',
  color: CORES_STATUS.erro.texto
};

const botaoAtivar:
  React.CSSProperties = {
  ...botaoBase,
  border: `1px solid ${CORES_STATUS.sucesso.texto}`,
  background: '#FFFFFF',
  color: CORES_STATUS.sucesso.texto
};

const Acao:
  React.FC<{
    titulo: string;
    descricao: string;
    corChave: ChaveCorAcao;
    destaque?: boolean;
    onClick: () => void;
  }> = ({
    titulo,
    descricao,
    corChave,
    destaque,
    onClick
  }) => {

    const cor = CORES_ACAO[corChave];
    const IconeAcao = Icones[corChave];

    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '18px',
          textAlign: 'left',
          border: destaque
            ? `1px solid ${DGT.azul}`
            : `1px solid ${DGT.cinzaClaro}`,
          borderRadius: '14px',
          background: destaque ? DGT.azul : '#FFFFFF',
          cursor: 'pointer',
          transition: 'box-shadow .15s, transform .15s'
        }}
      >

        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            background: destaque
              ? 'rgba(255,255,255,.16)'
              : cor.bg,
            color: destaque
              ? '#FFFFFF'
              : cor.icon
          }}
        >
          <IconeAcao />
        </div>

        <strong
          style={{
            display: 'block',
            color: destaque ? '#FFFFFF' : DGT.azul,
            fontSize: '15px'
          }}
        >
          {titulo}
        </strong>

        <span
          style={{
            display: 'block',
            marginTop: '6px',
            color: destaque ? 'rgba(255,255,255,.8)' : DGT.cinza,
            fontSize: '12px',
            lineHeight: 1.45
          }}
        >
          {descricao}
        </span>

      </button>
    );
  };

const GestaoPage:
  React.FC<
    IGestaoPageProps
  > = (
    props
  ) => {

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const filtrados =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          if (!termo) {
            return props
              .treinamentos;
          }

          return props
            .treinamentos
            .filter(
              item =>
                item.nome
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.codigo
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.descricao
                  .toLowerCase()
                  .includes(
                    termo
                  )
            );

        },
        [
          pesquisa,
          props.treinamentos
        ]
      );

    return (
      <section>

        <PageHeader
          titulo="Gestão de treinamentos"
          subtitulo="Cadastre treinamentos por um fluxo simples e linear. Módulos e avaliação são configurados automaticamente após o cadastro."
        />

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',

            gap:
              '14px',

            marginBottom:
              '28px'
          }}
        >

          <Acao
            titulo="Criar treinamento"
            descricao="Fluxo guiado: treinamento → módulos → avaliação."
            corChave="criar"
            destaque
            onClick={
              props.onNovoTreinamento
            }
          />

          <Acao
            titulo="Atribuir treinamento"
            descricao="Atribua treinamentos diretamente."
            corChave="atribuir"
            onClick={
              props.onAtribuirTreinamento
            }
          />

          <Acao
            titulo="Gerenciar trilhas"
            descricao="Organize cursos, sequência e pré-requisitos."
            corChave="trilhas"
            onClick={
              props.onTrilhas
            }
          />

          <Acao
            titulo="Áreas e acessos"
            descricao="Gerencie áreas, usuários e perfis de acesso."
            corChave="areas"
            onClick={
              props.onAreas
            }
          />

          <Acao
            titulo="Minha equipe"
            descricao="Acompanhe progresso e pendências."
            corChave="equipe"
            onClick={
              props.onEquipe
            }
          />

          <Acao
            titulo="Documentos"
            descricao="Gerencie documentos, revisões e retreinamentos."
            corChave="documentos"
            onClick={
              props.onDocumentos
            }
          />

          <Acao
            titulo="Conformidade"
            descricao="Acompanhe concluídos, pendentes e vencidos."
            corChave="conformidade"
            onClick={
              props.onConformidade
            }
          />

          <Acao
            titulo="Indicadores"
            descricao="Acompanhe conformidade, vencimentos e desempenho."
            corChave="indicadores"
            onClick={
              props.onIndicadores
            }
          />

        </div>

        <div
          style={{
            background:
              '#ffffff',

            border:
              `1px solid ${DGT.cinzaClaro}`,

            borderRadius:
              '14px',

            overflow:
              'hidden'
          }}
        >

          <div
            style={{
              padding:
                '18px',

              borderBottom:
                `1px solid ${DGT.cinzaClaro}`,

              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              gap:
                '15px',

              flexWrap:
                'wrap'
            }}
          >

            <div>

              <strong
                style={{
                  display:
                    'block',

                  color:
                    DGT.azul,

                  fontSize:
                    '16px'
                }}
              >
                Treinamentos cadastrados
              </strong>

              <span
                style={{
                  display:
                    'block',

                  marginTop:
                    '4px',

                  color:
                    DGT.cinza,

                  fontSize:
                    '12px'
                }}
              >
                {
                  props
                    .treinamentos
                    .length
                } treinamento(s)
              </span>

            </div>

            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                ...inputStyle,

                maxWidth:
                  '320px'
              }}
            />

          </div>

          {props.erro && (
            <div
              style={{
                margin:
                  '16px',

                padding:
                  '12px',

                background:
                  CORES_STATUS.erro.bg,

                color:
                  CORES_STATUS.erro.texto,

                borderRadius:
                  '8px'
              }}
            >
              {props.erro}
            </div>
          )}

          {props.carregando ? (
            <div
              style={{
                padding:
                  '30px',

                textAlign:
                  'center',

                color:
                  DGT.cinza
              }}
            >
              Carregando treinamentos...
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  'auto'
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
                    <th style={thStyle}>
                      Código
                    </th>

                    <th style={thStyle}>
                      Treinamento
                    </th>

                    <th style={thStyle}>
                      Carga
                    </th>

                    <th style={thStyle}>
                      Nota
                    </th>

                    <th style={thStyle}>
                      Validade
                    </th>

                    <th style={thStyle}>
                      Status
                    </th>

                    <th style={thStyle}>
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map(
                    treinamento => {

                      const processando =
                        props.processandoId ===
                        treinamento.id;

                      return (
                        <tr
                          key={
                            treinamento.id
                          }
                        >
                          <td style={tdStyle}>
                            <strong>
                              {
                                treinamento.codigo ||
                                '-'
                              }
                            </strong>
                          </td>

                          <td style={tdStyle}>
                            <strong
                              style={{
                                color:
                                  DGT.azul
                              }}
                            >
                              {
                                treinamento.nome
                              }
                            </strong>

                            {treinamento.descricao && (
                              <span
                                style={{
                                  display:
                                    'block',

                                  marginTop:
                                    '4px',

                                  color:
                                    DGT.cinza,

                                  fontSize:
                                    '12px',

                                  maxWidth:
                                    '380px'
                                }}
                              >
                                {
                                  treinamento.descricao
                                }
                              </span>
                            )}
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .cargaHorariaMin
                            } min
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .notaMinima
                            }%
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .validadeMeses >
                                0
                                ? `${treinamento.validadeMeses} meses`
                                : 'Sem validade'
                            }
                          </td>

                          <td style={tdStyle}>
                            <span
                              style={{
                                display:
                                  'inline-block',

                                padding:
                                  '5px 9px',

                                borderRadius:
                                  '20px',

                                background:
                                  treinamento.ativo
                                    ? CORES_STATUS.sucesso.bg
                                    : CORES_STATUS.neutro.bg,

                                color:
                                  treinamento.ativo
                                    ? CORES_STATUS.sucesso.texto
                                    : CORES_STATUS.neutro.texto,

                                fontSize:
                                  '12px',

                                fontWeight:
                                  700
                              }}
                            >
                              {
                                treinamento.ativo
                                  ? 'Ativo'
                                  : 'Inativo'
                              }
                            </span>
                          </td>

                          <td style={tdStyle}>
                            <div
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '7px',

                                flexWrap:
                                  'wrap'
                              }}
                            >
                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() => {

                                  void props
                                    .onEditarTreinamento(
                                      treinamento
                                    )
                                    .catch(
                                      (
                                        error:
                                          unknown
                                      ) =>
                                        console.error(
                                          'Erro ao abrir edição do treinamento:',
                                          error
                                        )
                                    );
                                }}
                                style={{
                                  ...botaoEditar,
                                  opacity: processando ? .6 : 1
                                }}
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() => {
                                  props
                                    .onDefinirAtivo(
                                      treinamento.id,
                                      !treinamento.ativo
                                    )
                                    .catch(
                                      (
                                        error:
                                          unknown
                                      ) =>
                                        console.error(
                                          error
                                        )
                                    );
                                }}
                                style={{
                                  ...(treinamento.ativo ? botaoDesativar : botaoAtivar),
                                  opacity: processando ? .6 : 1
                                }}
                              >
                                {
                                  processando
                                    ? 'Processando...'
                                    : treinamento.ativo
                                      ? 'Desativar'
                                      : 'Ativar'
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>  

      </section>
    );
  };

export default GestaoPage;