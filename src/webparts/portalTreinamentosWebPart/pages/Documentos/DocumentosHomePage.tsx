import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import EmptyState from
  '../../components/common/EmptyState';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  ehAdministrador,
  filtrarDocumentosVisiveis,
  obterAreasVisiveis
} from '../../services/DocumentoVisibilidade';

import {
  useDocumentosPendencias
} from '../../hooks/useDocumentosPendencias';

import MinhasPendenciasDocumentos from
  './MinhasPendenciasDocumentos';

import AreasDocumentosCards from
  './AreasDocumentosCards';

import {
  IconeArquivo,
  PrazoCelula,
  ResponsavelCelula
} from './DocumentosTabelaCelulas';

import {
  useArquivosDocumentos
} from '../../hooks/useArquivosDocumentos';

import ResumoModulo, {
  CORES_INDICADOR,
  IIndicadorResumo
} from '../../components/common/ResumoModulo';

export interface IDocumentosHomePageProps {

  documentos:
    IDocumento[];

  carregando?:
    boolean;

  erro?:
    string;

  onAbrirDocumento?:
    (
      documento:
        IDocumento
    ) => void;

  // Mantido por compatibilidade — "Novo documento" agora é uma aba
  // do módulo (mesmo padrão de Treinamentos).
  onNovoDocumento?:
    () => void;

  primeiroNome?:
    string;

  // Perfil do usuário logado: define quais áreas e documentos aparecem.
  contexto?:
    IContextoAcesso;

  // Tabela de Áreas (dgt_area) — gera os cartões.
  areas?:
    IAreaAdmin[];

  // Vínculos usuário × área — define as áreas de cada usuário e quem
  // é Gestor (aprovador).
  usuariosAreas?:
    IUsuarioAreaAdmin[];

  // Usado para buscar as revisões em andamento (Minhas pendências).
  dataverseService?:
    DataverseService;
}

const guidTela = (
  valor?: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

// Filtros acionados pelos cartões de indicador.
type FiltroIndicadorDocumento =
  | ''
  | 'vigentes'
  | 'emRevisao'
  | 'pendencias'
  | 'responsavel';

const ROTULO_FILTRO_INDICADOR:
  Record<Exclude<FiltroIndicadorDocumento, ''>, string> = {
  vigentes: 'Vigentes',
  emRevisao: 'Em revisão',
  pendencias: 'Minhas pendências',
  responsavel: 'Sob minha responsabilidade'
};

const statusEhVigente = (
  status: string
): boolean =>
  (status || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim() === 'vigente';

const atendeFiltroIndicador = (
  documento: IDocumento,
  filtro: FiltroIndicadorDocumento,
  idsPendentes: string[],
  meuId: string
): boolean => {

  switch (filtro) {

    case 'vigentes':
      return statusEhVigente(documento.status);

    case 'emRevisao':
      return !statusEhVigente(documento.status);

    case 'pendencias':
      return idsPendentes.indexOf(guidTela(documento.id)) >= 0;

    case 'responsavel':
      return !!meuId && guidTela(documento.responsavelId) === meuId;

    default:
      return true;
  }
};

const C = {
  azul:
    '#0B67D1',

  azulEscuro:
    '#0A2845',

  texto:
    '#28445F',

  secundario:
    '#61788E',

  borda:
    '#D8E2EC',

  fundo:
    '#F5F8FB',

  branco:
    '#FFFFFF',

  verde:
    '#07825C',

  verdeClaro:
    '#DDF7EC'
};

const tiposNavegacao = [
  {
    icone:
      '📘',

    titulo:
      'POP',

    descricao:
      'Procedimentos Operacionais Padrão'
  },
  {
    icone:
      '🛡',

    titulo:
      'Políticas',

    descricao:
      'Diretrizes e políticas da empresa'
  },
  {
    icone:
      '📖',

    titulo:
      'Instruções',

    descricao:
      'Instruções de trabalho'
  },
  {
    icone:
      '📋',

    titulo:
      'Formulários',

    descricao:
      'Formulários e modelos'
  },
  {
    icone:
      '⚖',

    titulo:
      'Normas',

    descricao:
      'Normas e legislações'
  },
  {
    icone:
      '📚',

    titulo:
      'Manuais',

    descricao:
      'Manuais e guias'
  }
];

const inputStyle:
  React.CSSProperties = {

  width:
    '100%',

  minHeight:
    '42px',

  boxSizing:
    'border-box',

  padding:
    '10px 12px',

  border:
    `1px solid ${C.borda}`,

  borderRadius:
    '9px',

  background:
    C.branco,

  color:
    C.azulEscuro,

  fontSize:
    '13px'
};

const th:
  React.CSSProperties = {

  padding:
    '12px 14px',

  textAlign:
    'left',

  fontSize:
    '12px',

  fontWeight:
    800,

  color:
    '#38536D',

  whiteSpace:
    'nowrap'
};

const td:
  React.CSSProperties = {

  padding:
    '13px 14px',

  color:
    '#28445F',

  fontSize:
    '13px',

  verticalAlign:
    'middle'
};

// Nome do documento: ícone pelo tipo de arquivo + link que abre a
// TELA DO DOCUMENTO (dados, revisões, histórico e botões de ação).
// Para ver o arquivo, use "Pré-visualizar" ou "Abrir documento" lá.
const NomeDocumentoCelula:
  React.FC<{
    documento: IDocumento;
    arquivo?: {
      url: string;
      revisao: string;
      vigente: boolean;
    };
    onAbrirDetalhe?: (documento: IDocumento) => void;
  }> = ({
    documento,
    arquivo,
    onAbrirDetalhe
  }) => {

    const [emFoco, setEmFoco] =
      React.useState(false);

    return (
      <div
        style={{
          display: 'flex',
          gap: '9px',
          alignItems: 'center'
        }}
      >
        <IconeArquivo url={arquivo?.url} />

        <button
          type="button"
          title={`Abrir os dados de ${documento.codigo}`}
          onClick={() => {
            if (onAbrirDetalhe) {
              onAbrirDetalhe(documento);
            }
          }}
          onMouseEnter={() => setEmFoco(true)}
          onMouseLeave={() => setEmFoco(false)}
          onFocus={() => setEmFoco(true)}
          onBlur={() => setEmFoco(false)}
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            color: emFoco ? '#0867D7' : '#0A2845',
            textDecoration: emFoco ? 'underline' : 'none',
            textAlign: 'left',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          <strong style={{ fontSize: '13px' }}>
            {documento.titulo}
          </strong>
        </button>
      </div>
    );
  };

const DocumentosHomePage:
  React.FC<
    IDocumentosHomePageProps
  > = ({
    documentos,
    carregando = false,
    erro = '',
    onAbrirDocumento,
    primeiroNome,
    contexto,
    areas: areasCadastradas = [],
    usuariosAreas = [],
    dataverseService
  }) => {

    // ==========================================================
    // VISIBILIDADE POR PERFIL / ÁREA
    // ==========================================================

    const administrador =
      ehAdministrador(contexto);

    const areasVisiveis =
      React.useMemo(
        () =>
          obterAreasVisiveis(
            contexto,
            areasCadastradas,
            usuariosAreas
          ),
        [
          contexto,
          areasCadastradas,
          usuariosAreas
        ]
      );

    const documentosVisiveis =
      React.useMemo(
        () =>
          filtrarDocumentosVisiveis(
            documentos,
            contexto,
            areasVisiveis,
            usuariosAreas
          ),
        [
          documentos,
          contexto,
          areasVisiveis,
          usuariosAreas
        ]
      );

    // Arquivo atual (revisão vigente) de cada documento: define o ícone
    // e o que abre ao clicar no nome.
    const arquivos =
      useArquivosDocumentos(
        dataverseService,
        documentos
      );

    const pendencias =
      useDocumentosPendencias(
        dataverseService,
        documentos,
        contexto,
        usuariosAreas
      );

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const [
      area,
      setArea
    ] =
      React.useState('');

    const [
      tipo,
      setTipo
    ] =
      React.useState('');

    const [
      status,
      setStatus
    ] =
      React.useState('');

    // ==========================================================
    // FILTRO PELOS CARTÕES DE INDICADOR
    // Clicar num cartão filtra a lista; clicar de novo (ou no ✕)
    // remove o filtro. Combina com pesquisa, área, tipo e status.
    // ==========================================================

    const [
      filtroIndicador,
      setFiltroIndicador
    ] =
      React.useState<FiltroIndicadorDocumento>('');

    const alternarFiltro =
      (
        filtro: FiltroIndicadorDocumento
      ): void =>
        setFiltroIndicador(
          atual =>
            atual === filtro
              ? ''
              : filtro
        );

    const idsPendentes =
      React.useMemo(
        () =>
          pendencias.pendencias.map(
            pendencia => guidTela(pendencia.documento.id)
          ),
        [
          pendencias.pendencias
        ]
      );

    // Lista com pesquisa + área + tipo + status. É a base tanto da
    // tabela quanto dos NÚMEROS dos cards — assim o número do card é
    // sempre igual à quantidade que aparece ao clicar nele.
    const baseFiltrada =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          return documentosVisiveis.filter(
            item => {

              const texto =
                [
                  item.codigo,
                  item.titulo,
                  item.tipo,
                  item.area,
                  item.status,
                  item.revisaoAtual
                ]
                  .join(
                    ' '
                  )
                  .toLowerCase();

              return (
                (
                  !termo ||
                  texto.indexOf(
                    termo
                  ) >=
                  0
                ) &&
                (
                  !area ||
                  guidTela(item.areaId) ===
                  guidTela(area)
                ) &&
                (
                  !tipo ||
                  item.tipo ===
                  tipo
                ) &&
                (
                  !status ||
                  item.status ===
                  status
                )
              );
            }
          );
        },
        [
          documentosVisiveis,
          pesquisa,
          area,
          tipo,
          status
        ]
      );

    const indicadores =
      React.useMemo(
        (): IIndicadorResumo[] => {

          const normalizarStatus = (
            valor: string
          ): string =>
            (valor || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();

          const vigentes =
            baseFiltrada.filter(
              documento =>
                normalizarStatus(documento.status) === 'vigente'
            ).length;

          const emRevisao =
            baseFiltrada.length - vigentes;

          const comPendencia =
            baseFiltrada.filter(
              documento =>
                idsPendentes.indexOf(guidTela(documento.id)) >= 0
            ).length;

          const meuId =
            guidTela(contexto?.usuarioId);

          const minhaResponsabilidade =
            meuId
              ? baseFiltrada.filter(
                documento =>
                  guidTela(documento.responsavelId) === meuId
              ).length
              : 0;

          return [
            {
              titulo: 'Vigentes',
              valor: vigentes,
              icone: 'fileText',
              ...CORES_INDICADOR.verde,
              detalhe: 'disponíveis para consulta',
              ativo: filtroIndicador === 'vigentes',
              onClick: () => alternarFiltro('vigentes')
            },
            {
              titulo: 'Em revisão',
              valor: emRevisao,
              icone: 'play',
              ...CORES_INDICADOR.laranja,
              detalhe: 'elaboração ou aprovação',
              ativo: filtroIndicador === 'emRevisao',
              onClick: () => alternarFiltro('emRevisao')
            },
            {
              titulo: 'Minhas pendências',
              valor: comPendencia,
              icone: 'hourglass',
              ...CORES_INDICADOR.vermelho,
              detalhe: 'elaborar ou aprovar',
              ativo: filtroIndicador === 'pendencias',
              onClick: () => alternarFiltro('pendencias')
            },
            {
              titulo: 'Sob minha responsabilidade',
              valor: minhaResponsabilidade,
              icone: 'checkCircle',
              ...CORES_INDICADOR.azul,
              detalhe: 'documentos',
              ativo: filtroIndicador === 'responsavel',
              onClick: () => alternarFiltro('responsavel')
            },
            {
              // Mostra tudo o que o usuário pode ver: limpa o filtro do
              // indicador e da área (quando ele tem mais de uma).
              titulo: administrador ? 'Áreas' : 'Minhas áreas',
              valor: areasVisiveis.length,
              icone: 'folder',
              ...CORES_INDICADOR.roxo,
              detalhe: administrador ? 'ver todas' : 'ver todos os documentos',
              ativo: !filtroIndicador && (!area || areasVisiveis.length === 1),
              onClick: () => {
                setFiltroIndicador('');

                if (administrador || areasVisiveis.length !== 1) {
                  setArea('');
                }
              }
            }
          ];
        },
        [
          baseFiltrada,
          idsPendentes,
          contexto,
          administrador,
          areasVisiveis,
          filtroIndicador,
          area
        ]
      );

    const filtrados =
      React.useMemo(
        () =>
          baseFiltrada.filter(
            item =>
              atendeFiltroIndicador(
                item,
                filtroIndicador,
                idsPendentes,
                guidTela(contexto?.usuarioId)
              )
          ),
        [
          baseFiltrada,
          filtroIndicador,
          idsPendentes,
          contexto
        ]
      );

    React.useEffect(
      () => {
        if (
          !administrador &&
          areasVisiveis.length === 1 &&
          !area
        ) {
          setArea(areasVisiveis[0].id);
        }
      },
      [
        administrador,
        areasVisiveis
      ]
    );

    const tipos =
      React.useMemo(
        () => {

          const valores:
            string[] = [];

          documentosVisiveis.forEach(
            item => {

              const valor =
                (
                  item.tipo ||
                  ''
                ).trim();

              if (
                valor &&
                valores.indexOf(
                  valor
                ) <
                0
              ) {
                valores.push(
                  valor
                );
              }
            }
          );

          return valores.sort();
        },
        [
          documentosVisiveis
        ]
      );

    const statusDisponiveis =
      React.useMemo(
        () => {

          const valores:
            string[] = [];

          documentosVisiveis.forEach(
            item => {

              const valor =
                (
                  item.status ||
                  ''
                ).trim();

              if (
                valor &&
                valores.indexOf(
                  valor
                ) <
                0
              ) {
                valores.push(
                  valor
                );
              }
            }
          );

          return valores.sort();
        },
        [
          documentosVisiveis
        ]
      );

    return (
      <section
        style={{
          color:
            C.azulEscuro
        }}
      >

        {/* SAUDAÇÃO + INDICADORES (mesmo padrão da Visão geral de Treinamentos) */}

        <ResumoModulo
          primeiroNome={primeiroNome}
          mensagem="Aqui está um resumo dos documentos disponíveis para você."
          indicadores={indicadores}
        />

        {/* MINHAS PENDÊNCIAS (só aparece quando existe alguma) */}

        <MinhasPendenciasDocumentos
          pendencias={pendencias.pendencias}
          carregando={pendencias.carregando}
          erro={pendencias.erro}
          onAbrirDocumento={onAbrirDocumento}
        />

        {/* CARTÕES DE ÁREA */}

        <AreasDocumentosCards
          areas={areasVisiveis}
          documentos={documentosVisiveis}
          mostrarTodas={administrador || !contexto}
          areaSelecionadaId={area}
          onSelecionar={setArea}
        />

        {/* FILTROS */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(320px,1fr) 150px 150px 150px',

            gap:
              '9px',

            marginTop:
              '12px'
          }}
        >
          <input
            type="search"
            placeholder="Pesquisar documentos por nome, código ou palavra-chave..."
            value={
              pesquisa
            }
            onChange={
              event =>
                setPesquisa(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          />

          <select
            value={
              area
            }
            onChange={
              event =>
                setArea(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          >
            {
              (administrador || areasVisiveis.length !== 1) &&
              (
                <option value="">
                  {administrador || !contexto ? 'Todas as áreas' : 'Minhas áreas'}
                </option>
              )
            }

            {
              areasVisiveis.map(
                item => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.nome
                    }
                  </option>
                )
              )
            }
          </select>

          <select
            value={
              tipo
            }
            onChange={
              event =>
                setTipo(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          >
            <option value="">
              Todos os tipos
            </option>

            {
              tipos.map(
                item => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {
                      item
                    }
                  </option>
                )
              )
            }
          </select>

          <select
            value={
              status
            }
            onChange={
              event =>
                setStatus(
                  event.target.value
                )
            }
            style={
              inputStyle
            }
          >
            <option value="">
              Todos os status
            </option>

            {
              statusDisponiveis.map(
                item => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {
                      item
                    }
                  </option>
                )
              )
            }
          </select>
        </div>

        {
          erro &&
          (
            <div
              style={{
                marginTop:
                  '12px',

                padding:
                  '12px 14px',

                borderRadius:
                  '8px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C',

                fontSize:
                  '13px'
              }}
            >
              {
                erro
              }
            </div>
          )
        }

        {/* PRINCIPAL */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(0,1fr) 230px',

            gap:
              '12px',

            marginTop:
              '12px',

            alignItems:
              'start'
          }}
        >

          <div
            style={{
              display:
                'grid',

              gap:
                '12px'
            }}
          >

            <article
              style={{
                background:
                  C.branco,

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '12px',

                overflow:
                  'hidden'
              }}
            >
              <div
                style={{
                  padding:
                    '12px 14px',

                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'center',

                  borderBottom:
                    '1px solid #E6EDF3'
                }}
              >
                <strong
                  style={{
                    fontSize:
                      '14px',

                    color:
                      C.azulEscuro
                  }}
                >
                  📄 {
                    filtroIndicador
                      ? `Documentos · ${ROTULO_FILTRO_INDICADOR[filtroIndicador]}`
                      : 'Documentos recentes'
                  }

                  {
                    filtroIndicador &&
                    (
                      <button
                        type="button"
                        onClick={() => setFiltroIndicador('')}
                        title="Remover filtro"
                        style={{
                          marginLeft: '10px',
                          padding: '2px 10px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Limpar filtro
                      </button>
                    )
                  }
                </strong>

                <span
                  style={{
                    color:
                      '#0867D7',

                    fontSize:
                      '11px',

                    fontWeight:
                      700
                  }}
                >
                  {
                    filtrados.length
                  } encontrado(s)
                </span>
              </div>

              {
                carregando
                  ? (
                    <div
                      style={{
                        padding:
                          '28px',

                        textAlign:
                          'center',

                        color:
                          C.secundario
                      }}
                    >
                      Carregando documentos...
                    </div>
                  )
                  : filtrados.length ===
                      0
                    ? (
                      <div
                        style={{
                          padding:
                            '20px'
                        }}
                      >
                        <EmptyState
                          titulo="Nenhum documento encontrado"
                          descricao={
                            filtroIndicador === 'pendencias'
                              ? 'Você não tem pendências de documentos no momento. 🎉'
                              : 'Ajuste os filtros ou a pesquisa.'
                          }
                        />
                      </div>
                    )
                    : (
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
                            <tr
                              style={{
                                background:
                                  '#F1F5F8'
                              }}
                            >
                              <th style={th}>
                                Nome
                              </th>

                              <th style={th}>
                                Código
                              </th>

                              <th style={th}>
                                Tipo
                              </th>

                              <th style={th}>
                                Área
                              </th>

                              <th style={th}>
                                Responsável
                              </th>

                              <th style={th}>
                                Revisão
                              </th>

                              <th
                                style={th}
                                title="Prazo da próxima revisão periódica do documento"
                              >
                                Prazo
                              </th>

                              <th style={th}>
                                Status
                              </th>

                              <th style={th}>
                                Ações
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {
                              filtrados.map(
                                documento => (
                                  <tr
                                    key={
                                      documento.id
                                    }
                                    style={{
                                      borderTop:
                                        '1px solid #EDF1F5'
                                    }}
                                  >
                                    <td style={td}>
                                      <NomeDocumentoCelula
                                        documento={documento}
                                        arquivo={arquivos[guidTela(documento.id)]}
                                        onAbrirDetalhe={onAbrirDocumento}
                                      />
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.codigo ||
                                        '-'
                                      }
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.tipo ||
                                        '-'
                                      }
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.area ||
                                        '-'
                                      }
                                    </td>

                                    <td style={td}>
                                      <ResponsavelCelula
                                        nome={documento.responsavel}
                                        souEu={
                                          !!contexto?.usuarioId &&
                                          guidTela(documento.responsavelId) ===
                                          guidTela(contexto.usuarioId)
                                        }
                                      />
                                    </td>

                                    <td style={td}>
                                      {
                                        documento.revisaoAtual ||
                                        '-'
                                      }
                                    </td>

                                    <td style={td}>
                                      <PrazoCelula
                                        prazo={documento.prazoRevisao}
                                        publicado={statusEhVigente(documento.status)}
                                      />
                                    </td>

                                    <td style={td}>
                                      <span
                                        style={{
                                          display:
                                            'inline-block',

                                          padding:
                                            '5px 11px',

                                          borderRadius:
                                            '999px',

                                          background:
                                            documento.status
                                              .toLowerCase()
                                              .indexOf(
                                                'vigente'
                                              ) >=
                                                0
                                                ? C.verdeClaro
                                                : '#EEF2F6',

                                          color:
                                            documento.status
                                              .toLowerCase()
                                              .indexOf(
                                                'vigente'
                                              ) >=
                                                0
                                                ? C.verde
                                                : '#53697D',

                                          fontWeight:
                                            700,

                                          fontSize:
                                            '11px'
                                        }}
                                      >
                                        {
                                          documento.status ||
                                          '-'
                                        }
                                      </span>
                                    </td>

                                    <td style={td}>
                                      {
                                        onAbrirDocumento
                                          ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onAbrirDocumento(
                                                  documento
                                                )
                                              }
                                              style={{
                                                border:
                                                  0,

                                                background:
                                                  'transparent',

                                                color:
                                                  C.azul,

                                                fontWeight:
                                                  800,

                                                cursor:
                                                  'pointer',

                                                fontSize:
                                                  '17px'
                                              }}
                                            >
                                              ⋯
                                            </button>
                                          )
                                          : '-'
                                      }
                                    </td>
                                  </tr>
                                )
                              )
                            }
                          </tbody>
                        </table>
                      </div>
                    )
              }
            </article>

            {/* TIPO DE DOCUMENTO */}

            <article
              style={{
                padding:
                  '12px',

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '12px',

                background:
                  C.branco
              }}
            >
              <strong
                style={{
                  display:
                    'block',

                  marginBottom:
                    '10px',

                  color:
                    C.azulEscuro,

                  fontSize:
                    '14px'
                }}
              >
                ▰ Navegar por tipo de documento
              </strong>

              <div
                style={{
                  display:
                    'grid',

                  gridTemplateColumns:
                    'repeat(6,minmax(120px,1fr))',

                  gap:
                    '8px'
                }}
              >
                {
                  tiposNavegacao.map(
                    item => (
                      <button
                        key={
                          item.titulo
                        }
                        type="button"
                        onClick={() =>
                          setTipo(
                            item.titulo
                          )
                        }
                        style={{
                          minHeight:
                            '86px',

                          display:
                            'grid',

                          gridTemplateColumns:
                            '34px 1fr',

                          gap:
                            '8px',

                          alignItems:
                            'start',

                          padding:
                            '11px',

                          border:
                            `1px solid ${C.borda}`,

                          borderRadius:
                            '9px',

                          background:
                            '#FAFCFE',

                          textAlign:
                            'left',

                          cursor:
                            'pointer'
                        }}
                      >
                        <div
                          style={{
                            width:
                              '34px',

                            height:
                              '34px',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'center',

                            borderRadius:
                              '8px',

                            background:
                              '#EEF5FB',

                            fontSize:
                              '17px'
                          }}
                        >
                          {
                            item.icone
                          }
                        </div>

                        <div>
                          <strong
                            style={{
                              display:
                                'block',

                              color:
                                C.azulEscuro,

                              fontSize:
                                '12px',

                              lineHeight:
                                1.2
                            }}
                          >
                            {
                              item.titulo
                            }
                          </strong>

                          <small
                            style={{
                              display:
                                'block',

                              marginTop:
                                '3px',

                              color:
                                C.secundario,

                              fontSize:
                                '9px',

                              lineHeight:
                                1.3
                            }}
                          >
                            {
                              item.descricao
                            }
                          </small>
                        </div>
                      </button>
                    )
                  )
                }
              </div>
            </article>

          </div>

          {/* LATERAL */}

          <aside
            style={{
              display:
                'grid',

              gap:
                '12px'
            }}
          >

            <article
              style={{
                padding:
                  '13px',

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '12px',

                background:
                  C.branco
              }}
            >
              <strong
                style={{
                  display:
                    'block',

                  marginBottom:
                    '7px',

                  color:
                    C.azulEscuro,

                  fontSize:
                    '13px'
                }}
              >
                ⭐ Meus documentos favoritos
              </strong>

              {
                documentosVisiveis
                  .slice(
                    0,
                    3
                  )
                  .map(
                    item => (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() => {

                          if (
                            onAbrirDocumento
                          ) {
                            onAbrirDocumento(
                              item
                            );
                          }

                        }}
                        style={{
                          width:
                            '100%',

                          padding:
                            '10px 0',

                          border:
                            0,

                          borderBottom:
                            '1px solid #EDF1F5',

                          background:
                            'transparent',

                          textAlign:
                            'left',

                          cursor:
                            onAbrirDocumento
                              ? 'pointer'
                              : 'default'
                        }}
                      >
                        <strong
                          style={{
                            display:
                              'block',

                            color:
                              C.azulEscuro,

                            fontSize:
                              '12px',

                            lineHeight:
                              1.3
                          }}
                        >
                          {
                            item.titulo
                          }
                        </strong>

                        <small
                          style={{
                            display:
                              'block',

                            marginTop:
                              '3px',

                            color:
                              C.secundario,

                            fontSize:
                              '10px'
                          }}
                        >
                          {
                            item.codigo
                          } · {
                            item.revisaoAtual ||
                            '-'
                          }
                        </small>
                      </button>
                    )
                  )
              }
            </article>

            <article
              style={{
                padding:
                  '13px',

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '12px',

                background:
                  C.branco
              }}
            >
              <strong
                style={{
                  display:
                    'block',

                  color:
                    C.azulEscuro,

                  fontSize:
                    '13px'
                }}
              >
                🔗 Links úteis
              </strong>

              {
                [
                  'Biblioteca de Templates',
                  'Formulários e Modelos',
                  'Normas e Legislações',
                  'Solicitar nova revisão'
                ].map(
                  item => (
                    <div
                      key={
                        item
                      }
                      style={{
                        padding:
                          '9px 0',

                        borderBottom:
                          '1px solid #EDF1F5',

                        color:
                          '#38536D',

                        fontSize:
                          '11px',

                        lineHeight:
                          1.3
                      }}
                    >
                      {
                        item
                      }
                    </div>
                  )
                )
              }
            </article>

          </aside>
        </div>

      </section>
    );
  };

export default DocumentosHomePage;
