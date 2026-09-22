import * as React from 'react';
import styles from './PortalTreinamentos.module.scss';
import { IPortalTreinamentosProps } from './IPortalTreinamentosProps';
import logoDgt from '../assets/logo-dgt.png';
import { DataverseService, IDataverseRecord } from '../services/DataverseService';
import { UsuarioService } from '../services/UsuarioService';
import { TrilhaService } from '../services/TrilhaService';
import PortalRouter from './PortalRouter';
import { Icones } from './common/Icones';
import { Pagina } from '../constants/routes';
import {
  obterModuloPagina,
  paginaEhTreinamentos
} from '../constants/moduleRoutes';
import { ITreinamento, IHistorico, ICertificado } from '../models/Treinamento';
import { IDocumento, IDocumentoRevisao } from '../models/Documento';
import { DocumentoService } from '../services/DocumentoService';
import { DocumentoWorkflowService } from '../services/DocumentoWorkflowService';
import { IPublicarRevisao, IResultadoPublicacaoRevisao } from '../services/RevisaoDocumentoAdminService';
import { IColaborador } from '../models/Usuario';
import { ITrilha } from '../models/Trilha';
import { useModulos } from '../hooks/useModulos';
import { useModuloExecucao, IPerguntaRapidaExecucao } from '../hooks/useModuloExecucao';
import { IModuloTreinamento, StatusUsuarioModulo } from '../models/Modulo';
import { useUsuario } from '../hooks/useUsuario';
import { useAvaliacao } from '../hooks/useAvaliacao';
import {
  IEditarTreinamento,
  INovoTreinamento,
  ITreinamentoAdmin
} from '../services/TreinamentoAdminService';
import { useGestaoTreinamentos } from '../hooks/useGestaoTreinamentos';
import { useGestaoTrilhas } from '../hooks/useGestaoTrilhas';
import { useGestaoModulos } from '../hooks/useGestaoModulos';
import { useGestaoModuloConteudos } from '../hooks/useGestaoModuloConteudos';
import { useGestaoAvaliacoes } from '../hooks/useGestaoAvaliacoes';
import { useGestaoAtribuicoes } from '../hooks/useGestaoAtribuicoes';
import { useRevisaoDocumento } from '../hooks/useRevisaoDocumento';
import { useAutorizacao } from '../hooks/useAutorizacao';
import { useGestaoDocumentos } from '../hooks/useGestaoDocumentos';

import { useDocumentoTreinamentos } from '../hooks/useDocumentoTreinamentos';
import { useGestaoAreas } from '../hooks/useGestaoAreas';
import { useConformidade } from '../hooks/useConformidade';
import { obterMenuTreinamento } from '../services/MenuPermissionService';
import { IModuloImportJson, ImportacaoJsonEtapasService } from '../services/ImportacaoJsonEtapasService';
import { SharePointDocumentoService } from '../services/sharepoint/SharePointDocumentoService';
import { useCalendarEvents } from '../hooks/useCalendarEvents';

type DataverseRecord =
  IDataverseRecord;

// ============================================================
// IMAGENS PADRÃO
// ============================================================

const imagensPadraoTreinamento:
  string[] = [

    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80',

    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=80',

    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80',

    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80'
  ];

// ============================================================
// UTILITÁRIOS
// ============================================================

const obterTexto = (
  r: DataverseRecord,
  chaves: string[],
  padrao = ''
): string => {

  for (const chave of chaves) {

    const valor =
      r[chave];

    if (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ''
    ) {
      return String(valor);
    }
  }

  return padrao;
};

const obterNumero = (
  r: DataverseRecord,
  chaves: string[],
  padrao = 0
): number => {

  for (const chave of chaves) {

    const valor =
      r[chave];

    if (
      valor !== undefined &&
      valor !== null &&
      valor !== ''
    ) {

      const numero =
        Number(valor);

      if (
        !Number.isNaN(numero)
      ) {
        return numero;
      }
    }
  }

  return padrao;
};

const obterBooleano = (
  r: DataverseRecord,
  chaves: string[],
  padrao = true
): boolean => {

  for (const chave of chaves) {

    const valor =
      r[chave];

    if (
      typeof valor === 'boolean'
    ) {
      return valor;
    }

    if (
      valor === 1 ||
      valor === '1' ||
      valor === 'true'
    ) {
      return true;
    }

    if (
      valor === 0 ||
      valor === '0' ||
      valor === 'false'
    ) {
      return false;
    }
  }

  return padrao;
};

const obterFormatado = (
  r: DataverseRecord,
  chave: string
): string =>

  obterTexto(
    r,
    [
      `${chave}@OData.Community.Display.V1.FormattedValue`
    ],
    ''
  );

const normalizarStatus = (
  valor: string,
  liberado = true
): ITreinamento['status'] => {

  const status =
    valor
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim();

  if (
    status.includes('conclu') ||
    status.includes('aprov')
  ) {
    return 'Concluído';
  }

  if (
    status.includes('reprov')
  ) {
    return 'Reprovado';
  }

  if (
    status.includes('venc')
  ) {
    return 'Vencido';
  }

  if (
    status.includes('cancel')
  ) {
    return 'Cancelado';
  }

  if (
    status.includes('andamento') ||
    status.includes('iniciado')
  ) {
    return 'Em andamento';
  }

  if (
    status.includes('bloque') ||
    !liberado
  ) {
    return 'Bloqueado';
  }

  return 'Disponível';
};

const formatarData = (
  valor: string
): string => {

  if (!valor) {
    return '-';
  }

  const data =
    new Date(valor);

  return Number.isNaN(
    data.getTime()
  )
    ? valor
    : data.toLocaleDateString(
      'pt-BR'
    );
};

// ============================================================
// COMPONENTE
// ============================================================

const PortalTreinamentos:
  React.FC<IPortalTreinamentosProps> = ({

    userName,
    userEmail,
    siteUrl,
    spHttpClient,
    dataverseClient,
    dataverseApiUrl,
    graphClient

  }) => {

    // ==========================================================
    // ESTADOS
    // ==========================================================

    const [
      paginaAtual,
      setPaginaAtual
    ] =
      React.useState<Pagina>(
        'inicio'
      );
    const [
      fluxoCriacaoTreinamentoId,
      setFluxoCriacaoTreinamentoId
    ] =
      React.useState('');

    const [
      treinamentoSelecionado,
      setTreinamentoSelecionado
    ] =
      React.useState<
        ITreinamento | null
      >(null);
    const [
      moduloSelecionadoExecucao,
      setModuloSelecionadoExecucao
    ] =
      React.useState<
        IModuloTreinamento | undefined
      >(
        undefined
      );

    const [
      carregandoDataverse,
      setCarregandoDataverse
    ] =
      React.useState(true);

    const [
      erroDataverse,
      setErroDataverse
    ] =
      React.useState('');

    const [
      conectadoDataverse,
      setConectadoDataverse
    ] =
      React.useState(false);

    const [
      meusTreinamentos,
      setMeusTreinamentos
    ] =
      React.useState<
        ITreinamento[]
      >([]);

    const [
      historico,
      setHistorico
    ] =
      React.useState<
        IHistorico[]
      >([]);

    const [
      certificados,
      setCertificados
    ] =
      React.useState<
        ICertificado[]
      >([]);

    const [
      trilhasUsuario,
      setTrilhasUsuario
    ] =
      React.useState<
        ITrilha[]
      >([]);

    const [
      colaboradores,
      setColaboradores
    ] =
      React.useState<
        IColaborador[]
      >([]);

    const [
      iniciandoTreinamento,
      setIniciandoTreinamento
    ] =
      React.useState(false);

    const [
      erroExecucaoTreinamento,
      setErroExecucaoTreinamento
    ] =
      React.useState('');

    const [
      documentos,
      setDocumentos
    ] =
      React.useState<
        IDocumento[]
      >([]);

    const [
      documentoSelecionado,
      setDocumentoSelecionado
    ] =
      React.useState<
        IDocumento | undefined
      >(undefined);

    const [
      revisoesDocumento,
      setRevisoesDocumento
    ] =
      React.useState<
        IDocumentoRevisao[]
      >([]);

    const [
      carregandoRevisoes,
      setCarregandoRevisoes
    ] =
      React.useState(false);

    const [
      erroRevisoes,
      setErroRevisoes
    ] =
      React.useState('');


    // ==========================================================
    // SERVICES
    // ==========================================================

    const dataverseService =
      React.useMemo(
        () =>
          new DataverseService(
            dataverseClient,
            dataverseApiUrl
          ),
        [
          dataverseClient,
          dataverseApiUrl
        ]
      );

    const usuarioService =
      React.useMemo(
        () =>
          new UsuarioService(
            dataverseService
          ),
        [
          dataverseService
        ]
      );

    const trilhaService =
      React.useMemo(
        () =>
          new TrilhaService(
            dataverseService
          ),
        [
          dataverseService
        ]
      );

    const documentoService =
      React.useMemo(
        () =>
          new DocumentoService(
            dataverseService
          ),
        [
          dataverseService
        ]
      );

    // Usado pela tela de detalhe do documento (colaborador/gestor) para
    // as transições Elaboração → Revisão → Aprovação, sem depender do
    // hook de administração (que atualiza uma lista de revisões diferente).
    const documentoWorkflowService =
      React.useMemo(
        () =>
          new DocumentoWorkflowService(
            dataverseService
          ),
        [
          dataverseService
        ]
      );


    const sharePointDocumentoService =
      React.useMemo(
        () =>
          new SharePointDocumentoService(
            spHttpClient,
            siteUrl
          ),
        [
          spHttpClient,
          siteUrl
        ]
      );
    const importacaoJsonEtapasService =
      React.useMemo(
        () =>
          new ImportacaoJsonEtapasService(
            dataverseService
          ),
        [
          dataverseService
        ]
      );


    // ==========================================================
    // HOOKS
    // ==========================================================

    const usuario =
      useUsuario(
        userName,
        userEmail,
        siteUrl
      );

    const modulos =
      useModulos(
        dataverseService
      );
    const moduloExecucao =
      useModuloExecucao(
        dataverseService
      );

    const avaliacao =
      useAvaliacao(
        dataverseService
      );

    const gestaoTreinamentos =
      useGestaoTreinamentos(
        dataverseService
      );

    const gestaoTrilhas =
      useGestaoTrilhas(
        dataverseService
      );


    const gestaoModulos =
      useGestaoModulos(
        dataverseService
      );

    const gestaoModuloConteudos =
      useGestaoModuloConteudos(
        dataverseService
      );

    const gestaoAvaliacoes =
      useGestaoAvaliacoes(
        dataverseService
      );

    const gestaoAtribuicoes =
      useGestaoAtribuicoes(
        dataverseService
      );

    const gestaoDocumentos =
      useGestaoDocumentos(
        dataverseService,
        sharePointDocumentoService
      );

    
    const documentoTreinamentos =
      useDocumentoTreinamentos(
        dataverseService
      );
const gestaoAreas =
      useGestaoAreas(
        dataverseService
      );

    const revisaoDocumento =
      useRevisaoDocumento(
        dataverseService
      );

    const autorizacao =
      useAutorizacao(
        dataverseService,
        userEmail
      );

    const conformidade =
      useConformidade(
        dataverseService
      );

    const calendario =
      useCalendarEvents(
        graphClient,
        15
      );
    const perfilExibicao =
      autorizacao.contexto?.perfil ===
        'Administrador'
        ? 'Administrador'
        : autorizacao.contexto?.perfil ===
          'Gestor'
          ? 'Gestor'
          : 'Colaborador';

    // ==========================================================
    // CARREGAR PORTAL
    // ==========================================================

    React.useEffect(() => {

      const carregar =
        async (): Promise<void> => {

          setCarregandoDataverse(
            true
          );

          setErroDataverse('');

          try {

            // ==================================================
            // TREINAMENTOS + ATRIBUIÇÕES
            // ==================================================

            const [
              dadosTreinamentos,
              dadosAtribuicoes
            ] =
              await Promise.all([
                dataverseService
                  .getTreinamentos(),

                dataverseService
                  .getUsuarioTreinamentos()
              ]);

            // ==================================================
            // CATÁLOGO
            // ==================================================

            const catalogo:
              ITreinamento[] =
              dadosTreinamentos
                .map(
                  (
                    r,
                    indice
                  ) => {

                    const minutos =
                      obterNumero(
                        r,
                        [
                          'dgt_cargahorariamin'
                        ],
                        0
                      );

                    const carga =
                      minutos >= 60
                        ? (
                          minutos %
                            60 ===
                            0
                            ? `${minutos / 60}h`
                            : `${Math.floor(
                              minutos /
                              60
                            )}h ${minutos % 60}min`
                        )
                        : (
                          minutos > 0
                            ? `${minutos}min`
                            : 'Carga horária não informada'
                        );

                    const validade =
                      obterNumero(
                        r,
                        [
                          'dgt_validademeses'
                        ],
                        0
                      );

                    const notaMinima =
                      obterNumero(
                        r,
                        [
                          'dgt_notaminima'
                        ],
                        0
                      );

                    const imagemUrl =
                      obterTexto(
                        r,
                        [
                          'dgt_imagemurl'
                        ],
                        ''
                      );

                    return {

                      id:
                        obterTexto(
                          r,
                          [
                            'dgt_treinamentoid'
                          ],
                          `treinamento-${indice}`
                        ),

                      nome:
                        obterTexto(
                          r,
                          [
                            'dgt_nome',
                            'dgt_name'
                          ],
                          'Treinamento'
                        ),

                      codigo:
                        obterTexto(
                          r,
                          [
                            'dgt_codigo'
                          ],
                          ''
                        ),

                      descricao:
                        obterTexto(
                          r,
                          [
                            'dgt_descricao'
                          ],
                          ''
                        ),

                      status: 'Disponível' as ITreinamento['status'],

                      progresso:
                        0,

                      cargaHoraria:
                        carga,

                      validadeMeses:
                        validade > 0
                          ? validade
                          : undefined,

                      notaMinima:
                        notaMinima,

                      cargaHorariaMin:
                        minutos,

                      ativo:
                        obterBooleano(
                          r,
                          [
                            'dgt_ativo'
                          ],
                          true
                        ),

                      imagem:
                        imagemUrl ||
                        imagensPadraoTreinamento[
                        indice %
                        imagensPadraoTreinamento.length
                        ],

                      imagemUrl:
                        imagemUrl
                    };
                  }
                )
                .filter(
                  item =>
                    item.ativo
                );

            // ==================================================
            // ATRIBUIÇÕES DO USUÁRIO LOGADO
            // ==================================================

            const email =
              userEmail
                .trim()
                .toLowerCase();

            const nome =
              userName
                .trim()
                .toLowerCase();

            const atribuicoes =
              dadosAtribuicoes.filter(
                r => {

                  const emailRegistro =
                    obterTexto(
                      r,
                      [
                        'dgt_usuarioemail',
                        'dgt_email'
                      ],
                      ''
                    )
                      .trim()
                      .toLowerCase();

                  const usuarioRegistro =
                    obterTexto(
                      r,
                      [
                        '_dgt_usuario_value@OData.Community.Display.V1.FormattedValue',
                        'dgt_usuario'
                      ],
                      ''
                    )
                      .trim()
                      .toLowerCase();

                  return (
                    emailRegistro ===
                    email ||
                    usuarioRegistro ===
                    nome ||
                    usuarioRegistro ===
                    email
                  );
                }
              );

            // ==================================================
            // TREINAMENTOS DO USUÁRIO
            // ==================================================

            const treinamentosUsuario:
              ITreinamento[] =
              atribuicoes.map(
                (
                  a,
                  indice
                ) => {

                  const lookup =
                    obterTexto(
                      a,
                      [
                        '_dgt_treinamento_value'
                      ],
                      ''
                    )
                      .replace(
                        /[{}]/g,
                        ''
                      )
                      .toLowerCase();

                  const nomeLookup =
                    obterTexto(
                      a,
                      [
                        '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue'
                      ],
                      ''
                    );

                  const item =
                    catalogo.find(
                      t =>
                        t.id
                          .replace(
                            /[{}]/g,
                            ''
                          )
                          .toLowerCase() ===
                        lookup
                    ) ||
                    catalogo.find(
                      t =>
                        t.nome
                          .trim()
                          .toLowerCase() ===
                        nomeLookup
                          .trim()
                          .toLowerCase()
                    );

                  const liberado =
                    obterBooleano(
                      a,
                      [
                        'dgt_liberado'
                      ],
                      true
                    );

                  const status =
                    normalizarStatus(
                      obterFormatado(
                        a,
                        'dgt_status'
                      ) ||
                      obterTexto(
                        a,
                        [
                          'dgt_status'
                        ],
                        ''
                      ),
                      liberado
                    );

                  return {

                    id:
                      item?.id ||
                      lookup ||
                      `atribuicao-${indice}`,

                    usuarioTreinamentoId:
                      obterTexto(
                        a,
                        [
                          'dgt_usuariotreinamentoid'
                        ],
                        ''
                      ),

                    nome:
                      item?.nome ||
                      nomeLookup ||
                      'Treinamento',

                    codigo:
                      item?.codigo ||
                      '',

                    descricao:
                      item?.descricao ||
                      '',

                    status,

                    progresso:
                      status ===
                        'Concluído'
                        ? 100
                        : status ===
                          'Em andamento'
                          ? 50
                          : 0,

                    cargaHoraria:
                      item?.cargaHoraria ||
                      '-',

                    validadeMeses:
                      item
                        ?.validadeMeses,

                    notaMinima:
                      item
                        ?.notaMinima,

                    cargaHorariaMin:
                      item
                        ?.cargaHorariaMin,

                    ativo:
                      item?.ativo ??
                      true,

                    imagem:
                      item?.imagem ||
                      imagensPadraoTreinamento[
                      indice %
                      imagensPadraoTreinamento.length
                      ],

                    imagemUrl:
                      item?.imagemUrl
                  };
                }
              );

            // ==================================================
            // HISTÓRICO
            // ==================================================

            const historicoUsuario:
              IHistorico[] =
              atribuicoes.map(
                (
                  a,
                  indice
                ) => {

                  const lookup =
                    obterTexto(
                      a,
                      [
                        '_dgt_treinamento_value'
                      ],
                      ''
                    )
                      .replace(
                        /[{}]/g,
                        ''
                      )
                      .toLowerCase();

                  const item =
                    catalogo.find(
                      t =>
                        t.id
                          .replace(
                            /[{}]/g,
                            ''
                          )
                          .toLowerCase() ===
                        lookup
                    );

                  const nota =
                    obterNumero(
                      a,
                      [
                        'dgt_nota'
                      ],
                      -1
                    );

                  return {

                    id:
                      obterTexto(
                        a,
                        [
                          'dgt_usuariotreinamentoid'
                        ],
                        `historico-${indice}`
                      ),

                    treinamento:
                      item?.nome ||
                      obterTexto(
                        a,
                        [
                          '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue'
                        ],
                        'Treinamento'
                      ),

                    trilha:
                      obterTexto(
                        a,
                        [
                          '_dgt_trilha_value@OData.Community.Display.V1.FormattedValue'
                        ],
                        '-'
                      ),

                    status:
                      normalizarStatus(
                        obterFormatado(
                          a,
                          'dgt_status'
                        ) ||
                        obterTexto(
                          a,
                          [
                            'dgt_status'
                          ],
                          ''
                        ),

                        obterBooleano(
                          a,
                          [
                            'dgt_liberado'
                          ],
                          true
                        )
                      ),

                    conclusao:
                      formatarData(
                        obterTexto(
                          a,
                          [
                            'dgt_dataconclusao'
                          ],
                          ''
                        )
                      ),

                    nota:
                      nota >= 0
                        ? `${nota}%`
                        : '-',

                    validade:
                      formatarData(
                        obterTexto(
                          a,
                          [
                            'dgt_datavalidade'
                          ],
                          ''
                        )
                      )
                  };
                }
              );

            // ==================================================
            // CERTIFICADOS
            // ==================================================

            const certificadosUsuario:
              ICertificado[] =
              treinamentosUsuario
                .filter(
                  t =>
                    t.status ===
                    'Concluído'
                )
                .map(
                  (
                    t,
                    indice
                  ) => {

                    const a =
                      atribuicoes.find(
                        x =>
                          obterTexto(
                            x,
                            [
                              'dgt_usuariotreinamentoid'
                            ],
                            ''
                          ) ===
                          t.usuarioTreinamentoId
                      );

                    return {

                      id:
                        t.usuarioTreinamentoId ||
                        `cert-${indice}`,

                      treinamento:
                        t.nome,

                      codigo:
                        t.codigo,

                      conclusao:
                        a
                          ? formatarData(
                            obterTexto(
                              a,
                              [
                                'dgt_dataconclusao'
                              ],
                              ''
                            )
                          )
                          : '-',

                      validade:
                        a
                          ? formatarData(
                            obterTexto(
                              a,
                              [
                                'dgt_datavalidade'
                              ],
                              ''
                            )
                          )
                          : '-',

                      cargaHoraria:
                        t.cargaHoraria
                    };
                  }
                );

            // ==================================================
            // EQUIPE + TRILHAS
            // ==================================================

            const [
              dadosEquipe,
              dadosTrilhas,
              dadosDocumentos
            ] =
              await Promise.all([

                usuarioService
                  .getEquipe(),

                trilhaService
                  .carregarTrilhasUsuario(
                    atribuicoes,
                    catalogo
                  ),

                documentoService
                  .getDocumentos()
              ]);

            // ==================================================
            // ATUALIZAR ESTADO
            // ==================================================

            setMeusTreinamentos(
              treinamentosUsuario
            );

            setHistorico(
              historicoUsuario
            );

            setCertificados(
              certificadosUsuario
            );

            setColaboradores(
              dadosEquipe
            );

            setTrilhasUsuario(
              dadosTrilhas
            );
            setDocumentos(
              dadosDocumentos
            );

            setConectadoDataverse(
              true
            );

          } catch (e) {

            setConectadoDataverse(
              false
            );

            setErroDataverse(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar o Dataverse.'
            );

          } finally {

            setCarregandoDataverse(
              false
            );
          }
        };

      carregar().catch(
        (
          error: unknown
        ) => {

          console.error(
            'Erro ao carregar dados do portal:',
            error
          );
        }
      );

    }, [
      dataverseService,
      usuarioService,
      trilhaService,
      documentoService,
      userEmail,
      userName
    ]);

    // ==========================================================
    // SALVAR NOVO TREINAMENTO
    // ==========================================================

    const salvarNovoTreinamento =
      React.useCallback(
        async (
          dados:
            INovoTreinamento
        ): Promise<void> => {

          // ======================================================
          // 1. CRIAR TREINAMENTO
          // ======================================================

          const treinamentoCriado =
            await gestaoTreinamentos
              .criar(
                dados
              );

          if (
            !treinamentoCriado ||
            !treinamentoCriado.id
          ) {

            throw new Error(
              'O treinamento foi criado, mas não foi possível identificar o registro criado.'
            );
          }

          // ======================================================
          // 2. GUARDAR O TREINAMENTO DO FLUXO
          // ======================================================

          setFluxoCriacaoTreinamentoId(
            treinamentoCriado.id
          );

          // ======================================================
          // 3. SELECIONAR AUTOMATICAMENTE NOS MÓDULOS
          // ======================================================

          await gestaoModulos
            .selecionarTreinamento(
              treinamentoCriado.id
            );

          // ======================================================
          // 4. AVANÇAR PARA ETAPA 2
          // ======================================================

          setPaginaAtual(
            'gestaoModulos'
          );

          window.scrollTo(
            0,
            0
          );

        },
        [
          gestaoModulos,
          gestaoTreinamentos
        ]
      );
    // ==========================================================
    // AVANÇAR FLUXO DE CRIAÇÃO PARA AVALIAÇÃO
    // ==========================================================

    const avancarFluxoTreinamentoParaAvaliacao =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !fluxoCriacaoTreinamentoId
          ) {
            throw new Error(
              'O treinamento em criação não foi identificado.'
            );
          }

          await gestaoAvaliacoes
            .selecionarTreinamento(
              fluxoCriacaoTreinamentoId
            );

          setPaginaAtual(
            'gestaoAvaliacoes'
          );

          window.scrollTo(
            0,
            0
          );

        },
        [
          fluxoCriacaoTreinamentoId,
          gestaoAvaliacoes
        ]
      );

    // ==========================================================
    // IMPORTAÇÃO JSON POR ETAPA
    // ==========================================================

    // Só lê e valida o arquivo (não grava nada). Usado para abrir
    // a tela de prévia, onde o usuário revisa e ajusta antes de salvar.
    const analisarModulosJson =
      React.useCallback(
        async (
          arquivo:
            File
        ): Promise<IModuloImportJson> => {

          if (
            !gestaoModulos.treinamentoId
          ) {
            throw new Error(
              'Treinamento não selecionado.'
            );
          }

          return importacaoJsonEtapasService
            .analisarModulosArquivo(
              arquivo
            );
        },
        [
          gestaoModulos,
          importacaoJsonEtapasService
        ]
      );

    // Chamado a partir da tela de prévia, com os dados já
    // revisados/ajustados pelo usuário. Só aqui é gravado no Dataverse.
    const confirmarImportacaoModulosJson =
      React.useCallback(
        async (
          dados:
            IModuloImportJson
        ): Promise<string> => {

          if (
            !gestaoModulos.treinamentoId
          ) {
            throw new Error(
              'Treinamento não selecionado.'
            );
          }

          const mensagem =
            await importacaoJsonEtapasService
              .importarModulosDados(
                gestaoModulos.treinamentoId,
                dados
              );

          await gestaoModulos
            .selecionarTreinamento(
              gestaoModulos.treinamentoId
            );

          return mensagem;
        },
        [
          gestaoModulos,
          importacaoJsonEtapasService
        ]
      );

    const importarAvaliacaoJson =
      React.useCallback(
        async (
          arquivo:
            File
        ): Promise<string> => {

          if (
            !gestaoAvaliacoes.treinamentoId
          ) {
            throw new Error(
              'Treinamento não selecionado.'
            );
          }

          const mensagem =
            await importacaoJsonEtapasService
              .importarAvaliacaoArquivo(
                gestaoAvaliacoes.treinamentoId,
                arquivo
              );

          await gestaoAvaliacoes
            .selecionarTreinamento(
              gestaoAvaliacoes.treinamentoId
            );

          return mensagem;
        },
        [
          gestaoAvaliacoes,
          importacaoJsonEtapasService
        ]
      );

    // ==========================================================
    // ABRIR TREINAMENTO EXISTENTE NO FLUXO COMPLETO DE EDIÇÃO
    // ==========================================================

    const abrirFluxoEdicaoTreinamento =
      React.useCallback(
        async (
          treinamento:
            ITreinamentoAdmin
        ): Promise<void> => {

          if (
            !treinamento ||
            !treinamento.id
          ) {
            throw new Error(
              'Treinamento não identificado.'
            );
          }

          // O mesmo ID passa a controlar o assistente de edição.
          // Dessa forma, a etapa 1 abre os dados existentes e
          // as etapas 2 e 3 carregam módulos e avaliação do mesmo registro.
          setFluxoCriacaoTreinamentoId(
            treinamento.id
          );

          // Pré-carrega módulos e avaliação para que a linha do tempo
          // possa navegar imediatamente entre as três etapas.
          try {

            await gestaoModulos
              .selecionarTreinamento(
                treinamento.id
              );

          } catch (error) {

            console.error(
              'Não foi possível pré-carregar os módulos:',
              error
            );
          }

          try {

            await gestaoAvaliacoes
              .selecionarTreinamento(
                treinamento.id
              );

          } catch (error) {

            console.error(
              'Não foi possível pré-carregar a avaliação:',
              error
            );
          }

          setPaginaAtual(
            'novoTreinamento'
          );

          window.scrollTo(
            0,
            0
          );
        },
        [
          gestaoAvaliacoes,
          gestaoModulos
        ]
      );

    // ==========================================================
    // NAVEGAÇÃO ENTRE AS ETAPAS DO FLUXO
    // ==========================================================

    const navegarEtapaFluxoTreinamento =
      React.useCallback(
        (
          etapa:
            1 | 2 | 3
        ): void => {

          if (
            !fluxoCriacaoTreinamentoId
          ) {
            return;
          }

          if (
            etapa ===
              1
          ) {

            setPaginaAtual(
              'novoTreinamento'
            );

            window.scrollTo(
              0,
              0
            );

            return;
          }

          if (
            etapa ===
              2
          ) {

            void gestaoModulos
              .selecionarTreinamento(
                fluxoCriacaoTreinamentoId
              )
              .then(
                () => {

                  setPaginaAtual(
                    'gestaoModulos'
                  );

                  window.scrollTo(
                    0,
                    0
                  );
                }
              )
              .catch(
                (
                  error:
                    unknown
                ) =>
                  console.error(
                    'Erro ao abrir módulos:',
                    error
                  )
              );

            return;
          }

          void gestaoAvaliacoes
            .selecionarTreinamento(
              fluxoCriacaoTreinamentoId
            )
            .then(
              () => {

                setPaginaAtual(
                  'gestaoAvaliacoes'
                );

                window.scrollTo(
                  0,
                  0
                );
              }
            )
            .catch(
              (
                error:
                  unknown
              ) =>
                console.error(
                  'Erro ao abrir avaliação:',
                  error
                )
            );
        },
        [
          fluxoCriacaoTreinamentoId,
          gestaoAvaliacoes,
          gestaoModulos
        ]
      );

    // ==========================================================
    // ATUALIZAR ETAPA 1 E VOLTAR PARA MÓDULOS
    // ==========================================================

    const atualizarTreinamentoFluxo =
      React.useCallback(
        async (
          dados:
            IEditarTreinamento
        ): Promise<void> => {

          await gestaoTreinamentos
            .editar(
              dados
            );

          await gestaoModulos
            .selecionarTreinamento(
              dados.id
            );

          setPaginaAtual(
            'gestaoModulos'
          );

          window.scrollTo(
            0,
            0
          );
        },
        [
          gestaoModulos,
          gestaoTreinamentos
        ]
      );

    // ==========================================================
    // SALVAR E ENCERRAR A CRIAÇÃO
    // ==========================================================

    const concluirFluxoCriacaoTreinamento =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !fluxoCriacaoTreinamentoId
          ) {
            throw new Error(
              'O treinamento em criação não foi identificado.'
            );
          }

          if (
            gestaoAvaliacoes.avaliacoes.length ===
              0
          ) {
            throw new Error(
              'Cadastre ou importe pelo menos uma avaliação antes de encerrar.'
            );
          }

          setFluxoCriacaoTreinamentoId(
            ''
          );

          setPaginaAtual(
            'gestao'
          );

          window.scrollTo(
            0,
            0
          );
        },
        [
          fluxoCriacaoTreinamentoId,
          gestaoAvaliacoes.avaliacoes
        ]
      );

    // ==========================================================
    // NAVEGAÇÃO
    // ==========================================================

    const navegar =
      React.useCallback(
        (
          pagina: Pagina
        ): void => {

          setPaginaAtual(
            pagina
          );

          window.scrollTo(
            0,
            0
          );
        },
        []
      );

    // ==========================================================
    // ABRIR TREINAMENTO
    // ==========================================================

    const abrirTreinamento =
      React.useCallback(
        async (
          treinamento:
            ITreinamento
        ): Promise<void> => {

          if (
            treinamento.status ===
            'Bloqueado'
          ) {
            return;
          }

          setTreinamentoSelecionado(
            treinamento
          );

          setErroExecucaoTreinamento(
            ''
          );

          navegar(
            'executarTreinamento'
          );

          await modulos.carregar(
            treinamento.id,
            treinamento
              .usuarioTreinamentoId
          );
        },
        [
          modulos,
          navegar
        ]
      );

    // ==========================================================
    // INICIAR TREINAMENTO
    // ==========================================================

    const iniciarTreinamento =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !treinamentoSelecionado
              ?.usuarioTreinamentoId
          ) {

            setErroExecucaoTreinamento(
              'A atribuição deste treinamento não foi localizada.'
            );

            return;
          }

          setIniciandoTreinamento(
            true
          );

          setErroExecucaoTreinamento(
            ''
          );

          try {

            await dataverseService
              .iniciarUsuarioTreinamento(
                treinamentoSelecionado
                  .usuarioTreinamentoId
              );

            const atualizado:
              ITreinamento = {

              ...treinamentoSelecionado,

              status:
                'Em andamento'
            };

            setTreinamentoSelecionado(
              atualizado
            );

            setMeusTreinamentos(
              lista =>
                lista.map(
                  t =>
                    t.usuarioTreinamentoId ===
                      atualizado.usuarioTreinamentoId
                      ? atualizado
                      : t
                )
            );

            await modulos.carregar(
              atualizado.id,
              atualizado
                .usuarioTreinamentoId
            );

          } catch (e) {

            setErroExecucaoTreinamento(
              e instanceof Error
                ? e.message
                : 'Erro ao iniciar treinamento.'
            );

          } finally {

            setIniciandoTreinamento(
              false
            );
          }
        },
        [
          dataverseService,
          treinamentoSelecionado,
          modulos
        ]
      );


    const abrirDocumento =
      React.useCallback(
        async (
          documento: IDocumento
        ): Promise<void> => {

          setDocumentoSelecionado(
            documento
          );

          setCarregandoRevisoes(
            true
          );

          setErroRevisoes('');

          navegar(
            'documentoDetalhe'
          );

          try {

            const revisoes =
              await documentoService
                .getRevisoesDocumento(
                  documento.id
                );

            setRevisoesDocumento(
              revisoes
            );

          } catch (e) {

            setRevisoesDocumento(
              []
            );

            setErroRevisoes(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar revisões.'
            );

          } finally {

            setCarregandoRevisoes(
              false
            );
          }
        },
        [
          documentoService,
          navegar
        ]
      );

    // ==========================================================
    // FLUXO DE APROVAÇÃO — tela de detalhe do documento
    // (Elaboração → Revisão → Aprovação → Vigente)
    // ==========================================================

    const recarregarRevisoesDoDocumentoSelecionado =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !documentoSelecionado
          ) {
            return;
          }

          setRevisoesDocumento(
            await documentoService
              .getRevisoesDocumento(
                documentoSelecionado.id
              )
          );
        },
        [
          documentoSelecionado,
          documentoService
        ]
      );

    const enviarRevisaoDocumentoParaRevisao =
      React.useCallback(
        async (
          revisao:
            IDocumentoRevisao
        ): Promise<void> => {

          await documentoWorkflowService
            .enviarParaRevisao(
              revisao.id,
              revisao.status
            );

          await recarregarRevisoesDoDocumentoSelecionado();
        },
        [
          documentoWorkflowService,
          recarregarRevisoesDoDocumentoSelecionado
        ]
      );

    const enviarRevisaoDocumentoParaAprovacao =
      React.useCallback(
        async (
          revisao:
            IDocumentoRevisao
        ): Promise<void> => {

          await documentoWorkflowService
            .enviarParaAprovacao(
              revisao.id,
              revisao.status
            );

          await recarregarRevisoesDoDocumentoSelecionado();
        },
        [
          documentoWorkflowService,
          recarregarRevisoesDoDocumentoSelecionado
        ]
      );

    const devolverRevisaoDocumentoParaElaboracao =
      React.useCallback(
        async (
          revisao:
            IDocumentoRevisao
        ): Promise<void> => {

          await documentoWorkflowService
            .devolverParaElaboracao(
              revisao.id,
              revisao.status
            );

          await recarregarRevisoesDoDocumentoSelecionado();
        },
        [
          documentoWorkflowService,
          recarregarRevisoesDoDocumentoSelecionado
        ]
      );

    const publicarRevisaoDocumentoSelecionado =
      React.useCallback(
        async (
          dados:
            IPublicarRevisao
        ): Promise<IResultadoPublicacaoRevisao> => {

          const resultado =
            await revisaoDocumento.publicar(
              dados
            );

          await recarregarRevisoesDoDocumentoSelecionado();

          return resultado;
        },
        [
          revisaoDocumento,
          recarregarRevisoesDoDocumentoSelecionado
        ]
      );

    // ==========================================================
    // ABRIR MÓDULO
    // ==========================================================

    const abrirModuloExecucao =
      React.useCallback(
        async (
          modulo:
            IModuloTreinamento
        ): Promise<void> => {

          if (
            !treinamentoSelecionado
              ?.usuarioTreinamentoId
          ) {

            setErroExecucaoTreinamento(
              'A atribuição deste treinamento não foi localizada.'
            );

            return;
          }

          setErroExecucaoTreinamento(
            ''
          );

          if (
            modulo.statusModulo ===
            StatusUsuarioModulo.NaoIniciado
          ) {

            await modulos
              .iniciar(
                modulo
              );
          }

          setModuloSelecionadoExecucao(
            modulo
          );

          await moduloExecucao
            .carregar(
              modulo.id,
              treinamentoSelecionado
                .usuarioTreinamentoId
            );

          navegar(
            'executarModulo'
          );
        },
        [
          moduloExecucao,
          modulos,
          navegar,
          treinamentoSelecionado
        ]
      );

    // ==========================================================
    // CONCLUIR MÓDULO ABERTO
    // ==========================================================

    const concluirModuloExecucao =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !moduloSelecionadoExecucao
          ) {
            return;
          }

          await modulos
            .concluir(
              moduloSelecionadoExecucao
            );

          setModuloSelecionadoExecucao(
            undefined
          );

          moduloExecucao
            .limpar();

          navegar(
            'executarTreinamento'
          );
        },
        [
          moduloExecucao,
          moduloSelecionadoExecucao,
          modulos,
          navegar
        ]
      );
    // ==========================================================
    // INICIAR AVALIAÇÃO
    // ==========================================================

    const iniciarAvaliacao =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !treinamentoSelecionado
          ) {

            setErroExecucaoTreinamento(
              'Nenhum treinamento foi selecionado.'
            );

            return;
          }

          if (
            !treinamentoSelecionado
              .usuarioTreinamentoId
          ) {

            setErroExecucaoTreinamento(
              'A atribuição deste treinamento não foi localizada.'
            );

            return;
          }

          const carregou =
            await avaliacao.carregar(

              treinamentoSelecionado
                .id,

              treinamentoSelecionado
                .usuarioTreinamentoId
            );

          if (carregou) {

            setErroExecucaoTreinamento(
              ''
            );

            navegar(
              'avaliacao'
            );

            return;
          }

          setErroExecucaoTreinamento(
            'Não foi possível abrir a avaliação. Verifique a configuração da avaliação no Dataverse.'
          );
        },
        [
          avaliacao,
          navegar,
          treinamentoSelecionado
        ]
      );

    // ==========================================================
    // ENVIAR AVALIAÇÃO
    // ==========================================================

    const enviarAvaliacao =
      React.useCallback(
        (
          respostas:
            Record<
              string,
              string[]
            >
        ): void => {

          if (
            !treinamentoSelecionado
              ?.usuarioTreinamentoId
          ) {

            setErroExecucaoTreinamento(
              'A atribuição deste treinamento não foi localizada.'
            );

            return;
          }

          avaliacao
            .enviar(
              treinamentoSelecionado
                .usuarioTreinamentoId,
              respostas
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
        },
        [
          avaliacao,
          treinamentoSelecionado
        ]
      );

    // ==========================================================
    // ABAS - CONTROLADAS POR PERFIL
    // ==========================================================

    const abasTreinamento =
      React.useMemo(
        () =>
          obterMenuTreinamento(
            autorizacao.contexto
          ),
        [
          autorizacao.contexto
        ]
      );

    // ==========================================================
    // MENU INTRANET
    // ==========================================================
    const moduloAtual =
      obterModuloPagina(
        paginaAtual
      );

    const menuIntranet:
      Array<{
        label:
          string;

        icon:
          string;

        pagina?:
          Pagina;

        modulo:
          'inicio' |
          'treinamentos' |
          'documentos' |
          'outro';
      }> = [

      {
        label:
          'Início',

        icon:
          '⌂',

        pagina:
          'inicio',

        modulo:
          'inicio'
      },

      {
        label:
          'Treinamentos',

        icon:
          '▣',

        pagina:
          'treinamentosVisaoGeral',

        modulo:
          'treinamentos'
      },

      {
        label:
          'Documentos',

        icon:
          '▤',

        pagina:
          'documentos',

        modulo:
          'documentos'
      },

      {
        label:
          'Processos',

        icon:
          '⌘',

        modulo:
          'outro'
      },

      {
        label:
          'Indicadores',

        icon:
          '▥',

        pagina:
          'indicadores',

        modulo:
          'outro'
      },

      {
        label:
          'RH e Pessoas',

        icon:
          '♟',

        modulo:
          'outro'
      },

      {
        label:
          'Sistemas',

        icon:
          '⌘',

        modulo:
          'outro'
      },

      {
        label:
          'Comunicados',

        icon:
          '◩',

        modulo:
          'outro'
      },

      {
        label:
          'Sobre a DGT',

        icon:
          '?',

        pagina:
          'suporte',

        modulo:
          'outro'
      }
    ];
// ==========================================================
    // RENDER
    // ==========================================================

    return (

      <div
        className={
          styles.portal
        }
      >

        {/* SIDEBAR */}

        <aside
          className={
            styles.sidebar
          }
        >

          <div
            className={
              styles.sidebarLogo
            }
          >
            <img
              src={logoDgt}
              alt="DGT"
            />
          </div>

          <nav
            className={
              styles.intranetMenu
            }
          >

            {menuIntranet.map(
              item => (

                <button
                  key={
                    item.label
                  }
                  type="button"
                  className={
                    moduloAtual ===
                      item.modulo
                      ? styles.intranetMenuActive
                      : styles.intranetMenuItem
                  }
                  title={
                    moduloAtual ===
                      item.modulo
                      ? 'Módulo atual'
                      : 'Módulo da Intranet DGT'
                  }
                  onClick={() => {

                    if (
                      item.pagina
                    ) {
                      navegar(
                        item.pagina
                      );
                    }
                  }}
                >

                  <span
                    className={
                      styles.intranetIcon
                    }
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>

                </button>
              )
            )}

          </nav>

          <div
            className={
              styles.sidebarWords
            }
          >
            <strong>
              CONHECIMENTO
            </strong>

            <strong>
              PROCESSOS
            </strong>

            <strong>
              PESSOAS
            </strong>

            <strong>
              RESULTADOS
            </strong>
          </div>

        </aside>

        {/* WORKSPACE */}

        <div
          className={
            styles.workspace
          }
        >

          {/* HEADER */}

          <header
            className={
              styles.globalHeader
            }
          >

            <label
              className={
                styles.globalSearch
              }
            >

              <span>
                ⌕
              </span>

              <input
                type="text"
                placeholder="Pesquisar pessoas, documentos, treinamentos, processos..."
                aria-label="Pesquisar na Intranet DGT"
              />

            </label>

            <div
              className={
                styles.headerActions
              }
            >

              <span
                className={
                  styles.connection
                }
              >

                {
                  carregandoDataverse
                    ? 'Conectando...'
                    : conectadoDataverse
                      ? '● Dataverse conectado'
                      : '○ Dataverse indisponível'
                }

              </span>

              <button
                type="button"
                className={
                  styles.headerIcon
                }
                title="Notificações"
              >
                ♢
              </button>

              <button
                type="button"
                className={
                  styles.headerIcon
                }
                title="Aplicativos"
              >
                ▦
              </button>

              <div
                className={
                  styles.userBox
                }
              >

                <div
                  className={
                    styles.avatar
                  }
                >

                  {
                    usuario.fotoUsuario &&
                      !usuario.erroFotoUsuario
                      ? (

                        <img
                          src={
                            usuario.fotoUsuario
                          }
                          alt={
                            userName
                          }
                          onError={
                            usuario.registrarErroFoto
                          }
                        />

                      ) : (

                        <span>
                          {
                            usuario.primeiroNome
                              .charAt(0)
                              .toUpperCase()
                          }
                        </span>
                      )
                  }

                </div>

                <div
                  className={
                    styles.userText
                  }
                >

                  <strong>
                    {
                      usuario.primeiroNome
                    }
                  </strong>

                  <span>
                    {
                      autorizacao.carregando
                        ? 'Carregando perfil...'
                        : perfilExibicao
                    }
                  </span>

                </div>

                <span
                  className={
                    styles.chevron
                  }
                >
                  ⌄
                </span>

              </div>

            </div>

          </header>

          {/* CONTEÚDO */}

          <main
            className={
              styles.page
            }
          >
            {
              paginaEhTreinamentos(
                paginaAtual
              ) &&
              (
                <>
                  <section
                    className={
                      styles.trainingHero
                    }
                  >

                    <div
                      className={
                        styles.heroIcon
                      }
                    >
                      <Icones.layers />
                    </div>

                    <div
                      className={
                        styles.heroText
                      }
                    >

                      <h1>
                        Treinamentos
                      </h1>

                      <h2>
                        Desenvolva seu conhecimento. Construa resultados.
                      </h2>

                      <p>
                        Trilhas, cursos, avaliações e certificações em um só lugar.
                      </p>

                    </div>

                    <div
                      className={
                        styles.heroQuote
                      }
                    >

                      <p>
                        “Pessoa que aprende hoje, constrói um amanhã melhor.”
                      </p>

                      <strong>
                        DGT
                      </strong>

                    </div>

                  </section>

                  <nav
                    className={
                      styles.trainingTabs
                    }
                  >

                    {
                      abasTreinamento.map(
                        (
                          aba,
                          indice
                        ) => {

                          const ativo =
                            paginaAtual ===
                            aba.pagina ||

                            (
                              paginaAtual ===
                              'executarTreinamento' &&
                              aba.label ===
                              'Meus treinamentos'
                            ) ||

                            (
                              paginaAtual ===
                              'executarModulo' &&
                              aba.label ===
                              'Meus treinamentos'
                            ) ||

                            (
                              paginaAtual ===
                              'avaliacao' &&
                              aba.label ===
                              'Meus treinamentos'
                            );

                          return (
                            <button
                              key={
                                `${aba.label}-${indice}`
                              }
                              type="button"
                              className={
                                ativo
                                  ? styles.trainingTabActive
                                  : styles.trainingTab
                              }
                              onClick={() =>
                                navegar(
                                  aba.pagina
                                )
                              }
                              aria-current={
                                ativo
                                  ? 'page'
                                  : undefined
                              }
                            >

                              <span
                                style={{
                                  display: 'inline-flex',
                                  color: ativo ? '#0874ce' : '#5C7287'
                                }}
                              >
                                {
                                  (() => {
                                    const IconeAba = Icones[aba.icon];
                                    return <IconeAba />;
                                  })()
                                }
                              </span>

                              <strong>
                                {
                                  aba.label
                                }
                              </strong>

                            </button>
                          );
                        }
                      )
                    }

                  </nav>
                </>
              )
            }


            {/* ROUTER */}

            <div
              className={
                styles.content
              }
            >

              <PortalRouter

                pagina={
                  paginaAtual
                }

                primeiroNome={
                  usuario.primeiroNome
                }

                treinamentos={
                  meusTreinamentos
                }

                treinamentoSelecionado={
                  treinamentoSelecionado
                }

                documentos={
                  documentos
                }

                documentoSelecionado={
                  documentoSelecionado
                }

                revisoesDocumento={
                  revisoesDocumento
                }

                carregandoRevisoes={
                  carregandoRevisoes
                }

                erroRevisoes={
                  erroRevisoes
                }

                processandoFluxoDocumento={
                  revisaoDocumento.processando
                }

                onEnviarRevisaoDocumento={
                  enviarRevisaoDocumentoParaRevisao
                }

                onEnviarAprovacaoDocumento={
                  enviarRevisaoDocumentoParaAprovacao
                }

                onDevolverElaboracaoDocumento={
                  devolverRevisaoDocumentoParaElaboracao
                }

                onPublicarRevisaoDocumento={
                  publicarRevisaoDocumentoSelecionado
                }

                abrirDocumento={documento => {

                  abrirDocumento(
                    documento
                  ).catch(
                    (
                      error:
                        unknown
                    ) =>
                      console.error(
                        error
                      )
                  );
                }}

                historico={
                  historico
                }

                certificados={
                  certificados
                }

                colaboradores={
                  colaboradores
                }

                trilhas={
                  trilhasUsuario
                }

                carregandoDataverse={
                  carregandoDataverse
                }

                erroDataverse={
                  erroDataverse
                }
                eventosCalendario={
                  calendario.eventos
                }

                carregandoCalendario={
                  calendario.carregando
                }

                erroCalendario={
                  calendario.erro
                }

                modulos={
                  modulos.modulos
                }

                carregandoModulos={
                  modulos.carregando
                }

                erroModulos={
                  modulos.erro
                }

                erroExecucao={
                  erroExecucaoTreinamento
                }

                processandoModuloId={
                  modulos.processandoModuloId
                }

                iniciandoTreinamento={
                  iniciandoTreinamento
                }

                progressoModulos={
                  modulos.progresso
                }

                avaliacaoLiberada={
                  modulos.avaliacaoLiberada
                }
                moduloSelecionadoExecucao={
                  moduloSelecionadoExecucao
                }

                conteudosModuloExecucao={
                  moduloExecucao.conteudos
                }

                carregandoModuloExecucao={
                  moduloExecucao.carregando
                }

                erroModuloExecucao={
                  moduloExecucao.erro
                }

                podeConcluirModuloExecucao={
                  moduloExecucao.podeConcluir
                }

                navegar={
                  navegar
                }

                abrirTreinamento={(
                  t: ITreinamento
                ) => {

                  abrirTreinamento(
                    t
                  ).catch(
                    (
                      error:
                        unknown
                    ) =>
                      console.error(
                        error
                      )
                  );
                }}

                iniciarTreinamento={() => {

                  iniciarTreinamento()
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

                iniciarModulo={
                  m => {

                    modulos
                      .iniciar(m)
                      .catch(
                        (
                          error:
                            unknown
                        ) =>
                          console.error(
                            error
                          )
                      );
                  }
                }

                concluirModulo={
                  m => {

                    modulos
                      .concluir(m)
                      .catch(
                        (
                          error:
                            unknown
                        ) =>
                          console.error(
                            error
                          )
                      );
                  }
                }
                abrirModulo={
                  m => {

                    abrirModuloExecucao(
                      m
                    ).catch(
                      (
                        error:
                          unknown
                      ) =>
                        console.error(
                          error
                        )
                    );
                  }
                }

                responderPerguntaModulo={
                  (
                    pergunta:
                      IPerguntaRapidaExecucao,
                    alternativaIds:
                      string[]
                  ) =>
                    moduloExecucao
                      .responderPergunta(
                        pergunta,
                        alternativaIds
                      )
                }

                concluirModuloExecucao={
                  concluirModuloExecucao
                }

                iniciarAvaliacao={() => {

                  iniciarAvaliacao()
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

                avaliacao={
                  avaliacao.avaliacao
                }

                carregandoAvaliacao={
                  avaliacao.carregando
                }

                erroAvaliacao={
                  avaliacao.erro
                }

                tentativasAvaliacao={
                  avaliacao.tentativas
                }

                envioAvaliacaoPreparado={
                  avaliacao.envioPreparado
                }

                resultadoAvaliacao={
                  avaliacao.resultado
                }

                processandoAvaliacao={
                  avaliacao.processando
                }

                enviarAvaliacao={
                  enviarAvaliacao
                }

                salvarNovoTreinamento={
                  salvarNovoTreinamento
                }

                fluxoCriacaoTreinamentoId={
                  fluxoCriacaoTreinamentoId
                }

                avancarFluxoTreinamentoParaAvaliacao={
                  avancarFluxoTreinamentoParaAvaliacao
                }

                navegarEtapaFluxoTreinamento={
                  navegarEtapaFluxoTreinamento
                }

                atualizarTreinamentoFluxo={
                  atualizarTreinamentoFluxo
                }

                concluirFluxoCriacaoTreinamento={
                  concluirFluxoCriacaoTreinamento
                }

                treinamentosAdministrativos={
                  gestaoTreinamentos.treinamentos
                }

                carregandoGestaoTreinamentos={
                  gestaoTreinamentos.carregando
                }

                erroGestaoTreinamentos={
                  gestaoTreinamentos.erro
                }

                processandoTreinamentoId={
                  gestaoTreinamentos.processandoId
                }

                abrirFluxoEdicaoTreinamento={
                  abrirFluxoEdicaoTreinamento
                }

                definirTreinamentoAtivo={
                  gestaoTreinamentos.definirAtivo
                }
                trilhasAdministrativas={
                  gestaoTrilhas.trilhas
                }

                trilhaAdministrativaSelecionada={
                  gestaoTrilhas.trilhaSelecionada
                }

                treinamentosTrilhaAdministrativa={
                  gestaoTrilhas.treinamentosTrilha
                }

                areasTrilhaAdministrativa={
                  gestaoTrilhas.areasTrilha
                }

                carregandoGestaoTrilhas={
                  gestaoTrilhas.carregando
                }

                carregandoConteudoTrilha={
                  gestaoTrilhas.carregandoConteudo
                }

                processandoGestaoTrilhas={
                  gestaoTrilhas.processando
                }

                erroGestaoTrilhas={
                  gestaoTrilhas.erro
                }

                selecionarTrilhaAdministrativa={
                  gestaoTrilhas.selecionarTrilha
                }

                limparTrilhaAdministrativa={
                  gestaoTrilhas.limparSelecao
                }

                criarTrilhaAdministrativa={
                  gestaoTrilhas.criarTrilha
                }

                editarTrilhaAdministrativa={
                  gestaoTrilhas.editarTrilha
                }

                definirTrilhaAtiva={
                  gestaoTrilhas.definirTrilhaAtiva
                }

                salvarTreinamentosTrilha={
                  gestaoTrilhas.salvarTreinamentos
                }

                salvarAreasTrilha={
                  gestaoTrilhas.salvarAreas
                }



                modulosAdministrativos={
                  gestaoModulos.modulos
                }

                treinamentoModuloSelecionadoId={
                  gestaoModulos.treinamentoId
                }

                carregandoGestaoModulos={
                  gestaoModulos.carregando
                }

                processandoGestaoModulos={
                  gestaoModulos.processando
                }

                erroGestaoModulos={
                  gestaoModulos.erro
                }

                selecionarTreinamentoModulo={
                  gestaoModulos.selecionarTreinamento
                }

                criarModuloAdministrativo={
                  gestaoModulos.criar
                }

                editarModuloAdministrativo={
                  gestaoModulos.editar
                }

                definirModuloAtivo={
                  gestaoModulos.definirAtivo
                }

                analisarModulosJson={
                  analisarModulosJson
                }

                confirmarImportacaoModulosJson={
                  confirmarImportacaoModulosJson
                }

                moduloConteudoSelecionadoId={
                  gestaoModuloConteudos.moduloId
                }

                conteudosModuloAdministrativos={
                  gestaoModuloConteudos.conteudos
                }

                carregandoConteudosModulo={
                  gestaoModuloConteudos.carregando
                }

                processandoConteudosModulo={
                  gestaoModuloConteudos.processando
                }

                erroConteudosModulo={
                  gestaoModuloConteudos.erro
                }

                selecionarModuloConteudo={
                  gestaoModuloConteudos.selecionarModulo
                }

                limparModuloConteudo={
                  gestaoModuloConteudos.limpar
                }

                criarConteudoModulo={
                  gestaoModuloConteudos.criar
                }

                editarConteudoModulo={
                  gestaoModuloConteudos.editar
                }

                definirConteudoModuloAtivo={
                  gestaoModuloConteudos.definirAtivo
                }

                moverConteudoModuloAcima={
                  gestaoModuloConteudos.moverAcima
                }

                moverConteudoModuloAbaixo={
                  gestaoModuloConteudos.moverAbaixo
                }

                avaliacoesAdministrativas={
                  gestaoAvaliacoes.avaliacoes
                }

                questoesAdministrativas={
                  gestaoAvaliacoes.questoes
                }

                alternativasAdministrativas={
                  gestaoAvaliacoes.alternativas
                }

                treinamentoAvaliacaoSelecionadoId={
                  gestaoAvaliacoes.treinamentoId
                }

                avaliacaoAdministrativaSelecionada={
                  gestaoAvaliacoes.avaliacaoSelecionada
                }

                questaoAdministrativaSelecionada={
                  gestaoAvaliacoes.questaoSelecionada
                }

                carregandoGestaoAvaliacoes={
                  gestaoAvaliacoes.carregando
                }

                processandoGestaoAvaliacoes={
                  gestaoAvaliacoes.processando
                }

                erroGestaoAvaliacoes={
                  gestaoAvaliacoes.erro
                }

                selecionarTreinamentoAvaliacao={
                  gestaoAvaliacoes.selecionarTreinamento
                }

                selecionarAvaliacaoAdministrativa={
                  gestaoAvaliacoes.selecionarAvaliacao
                }

                selecionarQuestaoAdministrativa={
                  gestaoAvaliacoes.selecionarQuestao
                }

                criarAvaliacaoAdministrativa={
                  gestaoAvaliacoes.criarAvaliacao
                }

                editarAvaliacaoAdministrativa={
                  gestaoAvaliacoes.editarAvaliacao
                }

                definirAvaliacaoAtiva={
                  gestaoAvaliacoes.definirAvaliacaoAtiva
                }

                criarQuestaoAdministrativa={
                  gestaoAvaliacoes.criarQuestao
                }

                criarQuestaoCompletaAdministrativa={
                  gestaoAvaliacoes.criarQuestaoCompleta
                }

                editarQuestaoAdministrativa={
                  gestaoAvaliacoes.editarQuestao
                }

                definirQuestaoAtiva={
                  gestaoAvaliacoes.definirQuestaoAtiva
                }

                criarAlternativaAdministrativa={
                  gestaoAvaliacoes.criarAlternativa
                }

                editarAlternativaAdministrativa={
                  gestaoAvaliacoes.editarAlternativa
                }

                definirAlternativaAtiva={
                  gestaoAvaliacoes.definirAlternativaAtiva
                }

                importarAvaliacaoJson={
                  importarAvaliacaoJson
                }

                usuariosAtribuicao={
                  gestaoAtribuicoes.usuarios
                }

                trilhasAtribuicao={
                  gestaoAtribuicoes.trilhas
                }

                carregandoAtribuicoes={
                  gestaoAtribuicoes.carregando
                }

                processandoAtribuicao={
                  gestaoAtribuicoes.processando
                }

                erroAtribuicao={
                  gestaoAtribuicoes.erro
                }

                resultadoAtribuicao={
                  gestaoAtribuicoes.resultado
                }

                processarAtribuicao={
                  gestaoAtribuicoes.atribuir
                }

                limparResultadoAtribuicao={
                  gestaoAtribuicoes.limparResultado
                }

                contextoAcesso={
                  autorizacao.contexto
                }

                carregandoAutorizacao={
                  autorizacao.carregando
                }

                erroAutorizacao={
                  autorizacao.erro
                }

                areasAdministrativas={
                  gestaoAreas.areas
                }

                usuariosDisponiveisArea={
                  gestaoAreas.usuarios
                }

                usuariosAreasAdministrativos={
                  gestaoAreas.usuariosAreas
                }

                carregandoGestaoAreas={
                  gestaoAreas.carregando
                }

                processandoGestaoAreas={
                  gestaoAreas.processando
                }

                erroGestaoAreas={
                  gestaoAreas.erro
                }

                criarAreaAdministrativa={
                  gestaoAreas.criarArea
                }

                editarAreaAdministrativa={
                  gestaoAreas.editarArea
                }

                definirAreaAtiva={
                  gestaoAreas.definirAreaAtiva
                }

                vincularUsuarioArea={
                  gestaoAreas.vincularUsuario
                }

                editarUsuarioArea={
                  gestaoAreas.editarUsuarioArea
                }

                definirUsuarioAreaAtivo={
                  gestaoAreas.definirUsuarioAreaAtivo
                }

                statusDocumentos={
                  gestaoDocumentos.statusDocumentos
                }

                documentosAdministrativos={
                  gestaoDocumentos.documentos
                }

                documentoAdministrativoSelecionado={
                  gestaoDocumentos.documentoSelecionado
                }

                revisoesAdministrativas={
                  gestaoDocumentos.revisoes
                }
                treinamentosDocumentoAdministrativos={
                  documentoTreinamentos.vinculos
                }

                carregandoTreinamentosDocumento={
                  documentoTreinamentos.carregando
                }

                processandoTreinamentosDocumento={
                  documentoTreinamentos.processando
                }

                erroTreinamentosDocumento={
                  documentoTreinamentos.erro
                }

                vincularTreinamentoDocumento={(
                  documentoId,
                  treinamentoId,
                  obrigatorio,
                  ordem,
                  observacao
                ) =>
                  documentoTreinamentos
                    .vincular(
                      documentoId,
                      treinamentoId,
                      obrigatorio,
                      ordem,
                      observacao
                    )
                }

                desativarTreinamentoDocumento={(
                  documentoId,
                  relacaoId
                ) =>
                  documentoTreinamentos
                    .desativar(
                      documentoId,
                      relacaoId
                    )
                }

                carregandoGestaoDocumentos={
                  gestaoDocumentos.carregando
                }

                processandoGestaoDocumentos={
                  gestaoDocumentos.processando
                }

                erroGestaoDocumentos={
                  gestaoDocumentos.erro
                }

                selecionarDocumentoAdministrativo={
                  async documento => {

                    await gestaoDocumentos
                      .selecionarDocumento(
                        documento
                      );

                    await documentoTreinamentos
                      .carregar(
                        documento.id
                      );
                  }
                }

                criarDocumentoAdministrativo={
                  gestaoDocumentos.criarDocumentoCompleto
                }
                criarRevisaoAdministrativa={
                  gestaoDocumentos.criarRevisaoComArquivo
                }

                enviarRevisaoParaRevisao={
                  gestaoDocumentos
                    .enviarRevisaoParaRevisao
                }

                enviarRevisaoParaAprovacao={
                  gestaoDocumentos
                    .enviarRevisaoParaAprovacao
                }

                devolverRevisaoParaElaboracao={
                  gestaoDocumentos
                    .devolverRevisaoParaElaboracao
                }
                limparDocumentoAdministrativo={
                  () => {
                    gestaoDocumentos
                      .limparSelecao();

                    documentoTreinamentos
                      .limpar();
                  }
                }

                processandoPublicacao={
                  revisaoDocumento.processando
                }

                erroPublicacao={
                  revisaoDocumento.erro
                }

                resultadoPublicacao={
                  revisaoDocumento.resultado
                }

                publicarRevisao={
                  revisaoDocumento.publicar
                }

                limparResultadoPublicacao={
                  revisaoDocumento.limparResultado
                }

                itensConformidade={
                  conformidade.itens
                }

                resumoConformidade={
                  conformidade.resumo
                }

                carregandoConformidade={
                  conformidade.carregando
                }

                erroConformidade={
                  conformidade.erro
                }
              />

            </div>

          </main>

        </div>

      </div>
    );
  };

export default PortalTreinamentos;