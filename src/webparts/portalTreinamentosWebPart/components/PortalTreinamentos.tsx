import * as React from 'react';
import styles from './PortalTreinamentos.module.scss';
import { IPortalTreinamentosProps } from './IPortalTreinamentosProps';
import logoDgt from '../assets/logo-dgt.png';
import {
  DataverseService
} from '../services/DataverseService';

type Pagina =
  | 'inicio'
  | 'treinamentos'
  | 'documentos'
  | 'historico'
  | 'certificados'
  | 'suporte'
  | 'gestao'
  | 'novoTreinamento'
  | 'atribuirTreinamento'
  | 'trilhas'
  | 'equipe'
  | 'executarTreinamento';

interface ITreinamento {
  id: string;
  usuarioTreinamentoId?: string;
  nome: string;
  codigo: string;
  descricao: string;
  status: 'Concluído' | 'Em andamento' | 'Disponível' | 'Bloqueado';
  progresso: number;
  cargaHoraria: string;
  validadeMeses?: number;
  ativo: boolean;
  imagem: string;
}

interface IModuloTreinamento {
  id: string;
  titulo: string;
  descricao: string;
  ordem: number;
  duracaoMin: number;
  tipoModulo: number;
  tipoModuloNome: string;
  obrigatorio: boolean;
  ativo: boolean;
  urlConteudo: string;
  usuarioModuloId: string;
  statusModulo: number;
  statusModuloNome: string;
  dataInicio: string;
  dataConclusao: string;
}

interface IDocumento {
  id: number;
  codigo: string;
  documento: string;
  categoria: string;
  status: string;
  revisao: string;
}

interface IHistorico {
  id: string;
  treinamento: string;
  trilha: string;
  status: string;
  conclusao: string;
  nota: string;
  validade: string;
}

interface ICertificado {
  id: string;
  treinamento: string;
  codigo: string;
  conclusao: string;
  validade: string;
  cargaHoraria: string;
}

interface IColaborador {
  id: number;
  nome: string;
  funcao: string;
  setor: string;
  concluidos: number;
  pendentes: number;
  conformidade: string;
}

type DataverseRecord = Record<string, unknown>;

const PortalTreinamentos: React.FC<IPortalTreinamentosProps> = ({
  userName,
  userEmail,
  siteUrl,
  dataverseClient,
  dataverseApiUrl
}) => {

  const [paginaAtual, setPaginaAtual] =
    React.useState<Pagina>('inicio');

  const [treinamentoSelecionado, setTreinamentoSelecionado] =
    React.useState<ITreinamento | null>(null);

  const isGestor: boolean = true;

  const [conectadoDataverse, setConectadoDataverse] =
    React.useState<boolean>(false);

  const [carregandoDataverse, setCarregandoDataverse] =
    React.useState<boolean>(true);

  const [erroDataverse, setErroDataverse] =
    React.useState<string>('');

  const [catalogoTreinamentos, setCatalogoTreinamentos] =
    React.useState<ITreinamento[]>([]);

  const [meusTreinamentos, setMeusTreinamentos] =
    React.useState<ITreinamento[]>([]);

  const [historico, setHistorico] =
    React.useState<IHistorico[]>([]);

  const [certificados, setCertificados] =
    React.useState<ICertificado[]>([]);

  const [quantidadeTrilhasUsuario, setQuantidadeTrilhasUsuario] =
    React.useState<number>(0);

  const [iniciandoTreinamento, setIniciandoTreinamento] =
    React.useState<boolean>(false);

  const [erroExecucaoTreinamento, setErroExecucaoTreinamento] =
    React.useState<string>('');

  const [modulosTreinamento, setModulosTreinamento] =
    React.useState<IModuloTreinamento[]>([]);

  const [carregandoModulos, setCarregandoModulos] =
    React.useState<boolean>(false);

  const [erroModulos, setErroModulos] =
    React.useState<string>('');

  const [processandoModuloId, setProcessandoModuloId] =
    React.useState<string>('');

  const primeiroNome =
    userName && userName.trim() !== ''
      ? userName.split(' ')[0]
      : 'Colaborador';

  const [erroFotoUsuario, setErroFotoUsuario] =
    React.useState<boolean>(false);

  const fotoUsuario =
    userEmail && siteUrl
      ? `${siteUrl}/_layouts/15/userphoto.aspx?size=M&accountname=${encodeURIComponent(
        userEmail
      )}`
      : '';

  const imagensPadraoTreinamento: string[] = [
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80'
  ];

  const obterTexto = (
    registro: DataverseRecord,
    chaves: string[],
    valorPadrao: string = ''
  ): string => {
    for (const chave of chaves) {
      const valor = registro[chave];

      if (
        valor !== undefined &&
        valor !== null &&
        String(valor).trim() !== ''
      ) {
        return String(valor);
      }
    }

    return valorPadrao;
  };

  const obterNumero = (
    registro: DataverseRecord,
    chaves: string[],
    valorPadrao: number = 0
  ): number => {
    for (const chave of chaves) {
      const valor = registro[chave];

      if (
        valor !== undefined &&
        valor !== null &&
        valor !== ''
      ) {
        const numero = Number(valor);

        if (!Number.isNaN(numero)) {
          return numero;
        }
      }
    }

    return valorPadrao;
  };

  const obterBooleano = (
    registro: DataverseRecord,
    chaves: string[],
    valorPadrao: boolean = true
  ): boolean => {
    for (const chave of chaves) {
      const valor = registro[chave];

      if (typeof valor === 'boolean') {
        return valor;
      }

      if (valor === 1 || valor === '1' || valor === 'true') {
        return true;
      }

      if (valor === 0 || valor === '0' || valor === 'false') {
        return false;
      }
    }

    return valorPadrao;
  };

  const obterFormatado = (
    registro: DataverseRecord,
    chave: string
  ): string =>
    obterTexto(
      registro,
      [
        `${chave}@OData.Community.Display.V1.FormattedValue`
      ],
      ''
    );

  const normalizarStatus = (
    valor: string,
    liberado: boolean = true
  ): ITreinamento['status'] => {
    const status = valor
      .toLowerCase()
      .replace(/[áàãâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòõôö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .trim();

    if (
      status.includes('conclu') ||
      status.includes('aprov')
    ) {
      return 'Concluído';
    }

    if (
      status.includes('andamento') ||
      status.includes('iniciado') ||
      status.includes('curso')
    ) {
      return 'Em andamento';
    }

    if (
      status.includes('bloque') ||
      status.includes('aguardando pre') ||
      liberado === false
    ) {
      return 'Bloqueado';
    }

    return 'Disponível';
  };

  const progressoPorStatus = (
    status: ITreinamento['status'],
    progressoDataverse?: number
  ): number => {
    if (
      progressoDataverse !== undefined &&
      progressoDataverse >= 0 &&
      progressoDataverse <= 100
    ) {
      return progressoDataverse;
    }

    switch (status) {
      case 'Concluído':
        return 100;
      default:
        return 0;
    }
  };

  const formatarData = (valor: string): string => {
    if (!valor) {
      return '-';
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
      return valor;
    }

    return data.toLocaleDateString('pt-BR');
  };

  const obterTreinamentoLookupId = (
    registro: DataverseRecord
  ): string =>
    obterTexto(
      registro,
      [
        '_dgt_treinamento_value',
        '_dgt_treinamentoid_value',
        'dgt_treinamentoid'
      ],
      ''
    ).toLowerCase();

  const obterNomeTreinamentoAtribuicao = (
    registro: DataverseRecord
  ): string =>
    obterTexto(
      registro,
      [
        '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue',
        '_dgt_treinamentoid_value@OData.Community.Display.V1.FormattedValue',
        'dgt_treinamento',
        'dgt_nome'
      ],
      ''
    );

  const atribuicaoPertenceAoUsuario = (
    registro: DataverseRecord
  ): boolean => {
    const emailNormalizado = userEmail.trim().toLowerCase();
    const nomeNormalizado = userName.trim().toLowerCase();

    const possiveisEmails = [
      'dgt_usuarioemail',
      'dgt_email',
      'emailaddress1',
      'internalemailaddress'
    ];

    for (const campo of possiveisEmails) {
      const valor = obterTexto(registro, [campo], '')
        .trim()
        .toLowerCase();

      if (valor && valor === emailNormalizado) {
        return true;
      }
    }

    const possiveisUsuarios = [
      '_dgt_usuario_value@OData.Community.Display.V1.FormattedValue',
      '_dgt_colaborador_value@OData.Community.Display.V1.FormattedValue',
      '_dgt_funcionario_value@OData.Community.Display.V1.FormattedValue',
      'dgt_usuario',
      'dgt_colaborador',
      'dgt_funcionario'
    ];

    for (const campo of possiveisUsuarios) {
      const valor = obterTexto(registro, [campo], '')
        .trim()
        .toLowerCase();

      if (
        valor &&
        (
          valor === nomeNormalizado ||
          valor === emailNormalizado
        )
      ) {
        return true;
      }
    }

    return false;
  };

  const mapearTreinamentoCatalogo = (
    registro: DataverseRecord,
    indice: number
  ): ITreinamento => {
    const id = obterTexto(
      registro,
      [
        'dgt_treinamentoid',
        'dgt_treinamentosid'
      ],
      `treinamento-${indice}`
    );

    const nome = obterTexto(
      registro,
      [
        'dgt_nome',
        'dgt_name',
        'name'
      ],
      'Treinamento sem nome'
    );

    const codigo = obterTexto(
      registro,
      [
        'dgt_codigo',
        'dgt_codigotreinamento'
      ],
      ''
    );

    const descricao = obterTexto(
      registro,
      [
        'dgt_descricao',
        'dgt_description'
      ],
      ''
    );

    const cargaMinutos = obterNumero(
      registro,
      [
        'dgt_cargahorariamin'
      ],
      0
    );

    const cargaFormatada =
      cargaMinutos >= 60
        ? cargaMinutos % 60 === 0
          ? `${cargaMinutos / 60}h`
          : `${Math.floor(cargaMinutos / 60)}h ${cargaMinutos % 60}min`
        : cargaMinutos > 0
          ? `${cargaMinutos}min`
          : 'Carga horária não informada';

    const validade = obterNumero(
      registro,
      [
        'dgt_validademeses',
        'dgt_validade_meses'
      ],
      0
    );

    return {
      id,
      nome,
      codigo,
      descricao,
      status: 'Disponível',
      progresso: 0,
      cargaHoraria: cargaFormatada,
      validadeMeses: validade > 0 ? validade : undefined,
      ativo:
        registro.dgt_ativo !== undefined
          ? obterBooleano(
            registro,
            ['dgt_ativo'],
            true
          )
          : obterNumero(
            registro,
            ['statecode'],
            0
          ) === 0,
      imagem:
        imagensPadraoTreinamento[
        indice % imagensPadraoTreinamento.length
        ]
    };
  };

  React.useEffect(() => {

    const carregarDataverse =
      async (): Promise<void> => {

        setCarregandoDataverse(true);
        setErroDataverse('');

        try {

          const service =
            new DataverseService(
              dataverseClient,
              dataverseApiUrl
            );

          const [
            dadosTreinamentos,
            dadosUsuarioTreinamentos
          ] = await Promise.all([
            service.getTreinamentos(),
            service.getUsuarioTreinamentos()
          ]);

          const catalogo: ITreinamento[] =
            (dadosTreinamentos as DataverseRecord[])
              .map(mapearTreinamentoCatalogo)
              .filter(item => item.ativo);

          const atribuicoesDoUsuario =
            (dadosUsuarioTreinamentos as DataverseRecord[])
              .filter(atribuicaoPertenceAoUsuario);

          const treinamentosDoUsuario: ITreinamento[] =
            atribuicoesDoUsuario.map(
              (atribuicao, indice) => {

                const treinamentoLookupId =
                  obterTreinamentoLookupId(atribuicao);

                const nomeTreinamentoAtribuicao =
                  obterNomeTreinamentoAtribuicao(atribuicao);

                const treinamentoCatalogo =
                  catalogo.find(
                    item =>
                      item.id.toLowerCase() === treinamentoLookupId
                  ) ||
                  catalogo.find(
                    item =>
                      item.nome.trim().toLowerCase() ===
                      nomeTreinamentoAtribuicao
                        .trim()
                        .toLowerCase()
                  );

                const liberado =
                  obterBooleano(
                    atribuicao,
                    ['dgt_liberado'],
                    true
                  );

                const statusTexto =
                  obterFormatado(
                    atribuicao,
                    'dgt_status'
                  ) ||
                  obterTexto(
                    atribuicao,
                    ['dgt_status'],
                    liberado
                      ? 'Disponível'
                      : 'Bloqueado'
                  );

                const status =
                  normalizarStatus(
                    statusTexto,
                    liberado
                  );

                const progressoDataverse =
                  obterNumero(
                    atribuicao,
                    [
                      'dgt_progresso',
                      'dgt_percentualconclusao'
                    ],
                    -1
                  );

                return {
                  id:
                    treinamentoCatalogo?.id ||
                    obterTexto(
                      atribuicao,
                      [
                        'dgt_usuariotreinamentoid',
                        'dgt_usuariotreinamentosid'
                      ],
                      `atribuicao-${indice}`
                    ),
                  usuarioTreinamentoId: obterTexto(
                    atribuicao,
                    [
                      'dgt_usuariotreinamentoid',
                      'dgt_usuariotreinamentosid'
                    ],
                    ''
                  ),

                  nome:
                    treinamentoCatalogo?.nome ||
                    nomeTreinamentoAtribuicao ||
                    obterTexto(
                      atribuicao,
                      ['dgt_nome'],
                      'Treinamento'
                    ),

                  codigo:
                    treinamentoCatalogo?.codigo || '',

                  descricao:
                    treinamentoCatalogo?.descricao || '',

                  status,

                  progresso:
                    progressoPorStatus(
                      status,
                      progressoDataverse >= 0
                        ? progressoDataverse
                        : undefined
                    ),

                  cargaHoraria:
                    treinamentoCatalogo?.cargaHoraria ||
                    'Carga horária não informada',

                  validadeMeses:
                    treinamentoCatalogo?.validadeMeses,

                  ativo:
                    treinamentoCatalogo?.ativo ?? true,

                  imagem:
                    treinamentoCatalogo?.imagem ||
                    imagensPadraoTreinamento[
                    indice % imagensPadraoTreinamento.length
                    ]
                };
              }
            );

          const historicoUsuario: IHistorico[] =
            atribuicoesDoUsuario.map(
              (atribuicao, indice) => {

                const treinamentoLookupId =
                  obterTreinamentoLookupId(atribuicao);

                const treinamentoCatalogo =
                  catalogo.find(
                    item =>
                      item.id.toLowerCase() === treinamentoLookupId
                  );

                const nomeTreinamento =
                  treinamentoCatalogo?.nome ||
                  obterNomeTreinamentoAtribuicao(atribuicao) ||
                  obterTexto(
                    atribuicao,
                    ['dgt_nome'],
                    'Treinamento'
                  );

                const statusTexto =
                  obterFormatado(
                    atribuicao,
                    'dgt_status'
                  ) ||
                  obterTexto(
                    atribuicao,
                    ['dgt_status'],
                    'Disponível'
                  );

                const trilha =
                  obterTexto(
                    atribuicao,
                    [
                      '_dgt_trilha_value@OData.Community.Display.V1.FormattedValue',
                      'dgt_trilha'
                    ],
                    '-'
                  );

                const notaNumero =
                  obterNumero(
                    atribuicao,
                    ['dgt_nota'],
                    -1
                  );

                return {
                  id:
                    obterTexto(
                      atribuicao,
                      [
                        'dgt_usuariotreinamentoid',
                        'dgt_usuariotreinamentosid'
                      ],
                      `historico-${indice}`
                    ),

                  treinamento: nomeTreinamento,
                  trilha,
                  status: normalizarStatus(
                    statusTexto,
                    obterBooleano(
                      atribuicao,
                      ['dgt_liberado'],
                      true
                    )
                  ),
                  conclusao: formatarData(
                    obterTexto(
                      atribuicao,
                      ['dgt_dataconclusao'],
                      ''
                    )
                  ),
                  nota:
                    notaNumero >= 0
                      ? `${notaNumero}%`
                      : '-',
                  validade: formatarData(
                    obterTexto(
                      atribuicao,
                      ['dgt_datavalidade'],
                      ''
                    )
                  )
                };
              }
            );

          const certificadosUsuario: ICertificado[] =
            atribuicoesDoUsuario
              .map((atribuicao, indice) => {

                const certificado =
                  obterTexto(
                    atribuicao,
                    [
                      'dgt_certificado',
                      '_dgt_certificado_value@OData.Community.Display.V1.FormattedValue'
                    ],
                    ''
                  );

                if (!certificado) {
                  return undefined;
                }

                const treinamentoLookupId =
                  obterTreinamentoLookupId(atribuicao);

                const treinamentoCatalogo =
                  catalogo.find(
                    item =>
                      item.id.toLowerCase() === treinamentoLookupId
                  );

                return {
                  id:
                    obterTexto(
                      atribuicao,
                      [
                        'dgt_usuariotreinamentoid',
                        'dgt_usuariotreinamentosid'
                      ],
                      `certificado-${indice}`
                    ),
                  treinamento:
                    treinamentoCatalogo?.nome ||
                    obterNomeTreinamentoAtribuicao(atribuicao) ||
                    'Treinamento',
                  codigo: certificado,
                  conclusao: formatarData(
                    obterTexto(
                      atribuicao,
                      ['dgt_dataconclusao'],
                      ''
                    )
                  ),
                  validade: formatarData(
                    obterTexto(
                      atribuicao,
                      ['dgt_datavalidade'],
                      ''
                    )
                  ),
                  cargaHoraria:
                    treinamentoCatalogo?.cargaHoraria || '-'
                } as ICertificado;
              })
              .filter(
                (
                  item
                ): item is ICertificado =>
                  item !== undefined
              );

          const trilhas =
            new Set(
              atribuicoesDoUsuario
                .map(item =>
                  obterTexto(
                    item,
                    [
                      '_dgt_trilha_value@OData.Community.Display.V1.FormattedValue',
                      'dgt_trilha'
                    ],
                    ''
                  )
                )
                .filter(Boolean)
            );

          setCatalogoTreinamentos(catalogo);
          setMeusTreinamentos(treinamentosDoUsuario);
          setHistorico(historicoUsuario);
          setCertificados(certificadosUsuario);
          setQuantidadeTrilhasUsuario(trilhas.size);
          setConectadoDataverse(true);

          console.log(
            'CATÁLOGO DATAVERSE:',
            catalogo
          );

          console.log(
            'ATRIBUIÇÕES DO USUÁRIO:',
            atribuicoesDoUsuario
          );

          if (
            dadosUsuarioTreinamentos.length > 0 &&
            atribuicoesDoUsuario.length === 0
          ) {
            console.warn(
              'Há registros em Usuário Treinamento, mas nenhum pôde ser associado ao usuário logado.',
              {
                userName,
                userEmail,
                camposDisponiveis:
                  Object.keys(
                    dadosUsuarioTreinamentos[0] as DataverseRecord
                  )
              }
            );
          }

        } catch (error) {

          console.error(
            'ERRO AO CARREGAR DATAVERSE:',
            error
          );

          setConectadoDataverse(false);

          setErroDataverse(
            error instanceof Error
              ? error.message
              : 'Erro desconhecido ao consultar o Dataverse.'
          );

        } finally {

          setCarregandoDataverse(false);

        }
      };

    void carregarDataverse();

  }, [
    dataverseClient,
    dataverseApiUrl,
    userEmail,
    userName
  ]);

  /* =====================================================
     DADOS TEMPORÁRIOS DE MÓDULOS AINDA NÃO CONECTADOS
     -----------------------------------------------------
     Treinamentos, histórico e certificados já vêm do
     Dataverse. Documentos e equipe serão conectados em
     etapas posteriores.
  ===================================================== */

  const documentos: IDocumento[] = [
    {
      id: 1,
      codigo: 'POP-001',
      documento: 'Operação Segura de Máquinas',
      categoria: 'Produção',
      status: 'Vigente',
      revisao: 'Rev. 04'
    },
    {
      id: 2,
      codigo: 'POL-003',
      documento: 'Política de Segurança da Informação',
      categoria: 'Corporativo',
      status: 'Vigente',
      revisao: 'Rev. 02'
    },
    {
      id: 3,
      codigo: 'IT-015',
      documento: 'Inspeção de Equipamentos',
      categoria: 'Manutenção',
      status: 'Vigente',
      revisao: 'Rev. 07'
    },
    {
      id: 4,
      codigo: 'MQ-001',
      documento: 'Manual da Qualidade',
      categoria: 'Qualidade',
      status: 'Em revisão',
      revisao: 'Rev. 05'
    }
  ];

  const colaboradores: IColaborador[] = [
    {
      id: 1,
      nome: 'Ana Martins',
      funcao: 'Analista da Qualidade',
      setor: 'Qualidade',
      concluidos: 8,
      pendentes: 1,
      conformidade: '96%'
    },
    {
      id: 2,
      nome: 'Carlos Souza',
      funcao: 'Operador',
      setor: 'Produção',
      concluidos: 5,
      pendentes: 3,
      conformidade: '78%'
    },
    {
      id: 3,
      nome: 'Juliana Lima',
      funcao: 'Técnica de Segurança',
      setor: 'SSMA',
      concluidos: 11,
      pendentes: 0,
      conformidade: '100%'
    },
    {
      id: 4,
      nome: 'Marcos Oliveira',
      funcao: 'Mecânico',
      setor: 'Manutenção',
      concluidos: 6,
      pendentes: 2,
      conformidade: '84%'
    }
  ];

  /* =====================================================
     FUNÇÕES
  ===================================================== */

  const statusClass = (
    status: ITreinamento['status']
  ): string => {

    switch (status) {
      case 'Concluído':
        return styles.statusConcluido;

      case 'Em andamento':
        return styles.statusAndamento;

      case 'Disponível':
        return styles.statusDisponivel;

      default:
        return styles.statusBloqueado;
    }
  };

  const acaoMock = (mensagem: string): void => {
    window.alert(
      `${mensagem}\n\nFuncionalidade simulada. ` +
      'Na integração final esta ação utilizará SharePoint / Power Automate.'
    );
  };

  const voltarGestao = (): void => {
    setPaginaAtual('gestao');
  };

  const obterNomeTipoModulo = (
    tipoModulo: number
  ): string => {
    switch (tipoModulo) {
      case 100000000: return 'Documento';
      case 100000001: return 'Vídeo';
      case 100000002: return 'Página';
      case 100000003: return 'Conteúdo HTML';
      case 100000004: return 'Link externo';
      case 100000005: return 'Outro';
      default: return 'Conteúdo';
    }
  };

  const mapearModuloTreinamento = (
    registro: DataverseRecord
  ): IModuloTreinamento => {
    const tipoModulo = obterNumero(registro, ['dgt_tipomodulo'], -1);

    return {
      id: obterTexto(registro, ['dgt_moduloid'], ''),
      titulo: obterTexto(registro, ['dgt_titulo'], 'Módulo sem título'),
      descricao: obterTexto(registro, ['dgt_descricao'], ''),
      ordem: obterNumero(registro, ['dgt_ordem'], 0),
      duracaoMin: obterNumero(registro, ['dgt_duracaomin'], 0),
      tipoModulo,
      tipoModuloNome:
        obterFormatado(registro, 'dgt_tipomodulo') ||
        obterNomeTipoModulo(tipoModulo),
      obrigatorio: obterBooleano(registro, ['dgt_obrigatorio'], false),
      ativo: obterBooleano(registro, ['dgt_ativo'], true),
      urlConteudo: obterTexto(registro, ['dgt_urlconteudo'], ''),
      usuarioModuloId: '',
      statusModulo: 100000000,
      statusModuloNome: 'Não iniciado',
      dataInicio: '',
      dataConclusao: ''
    };
  };

  const calcularProgressoModulos = (
    modulos: IModuloTreinamento[]
  ): number => {
    const obrigatorios = modulos.filter(item => item.obrigatorio);

    if (obrigatorios.length === 0) {
      return 0;
    }

    const concluidos = obrigatorios.filter(
      item => item.statusModulo === 100000002
    ).length;

    return Math.round((concluidos / obrigatorios.length) * 100);
  };

  const atualizarProgressoTreinamentoNaTela = (
    modulos: IModuloTreinamento[]
  ): void => {
    const progresso = calcularProgressoModulos(modulos);

    setTreinamentoSelecionado(anterior =>
      anterior
        ? { ...anterior, progresso }
        : anterior
    );

    if (treinamentoSelecionado?.usuarioTreinamentoId) {
      const atribuicaoId = treinamentoSelecionado.usuarioTreinamentoId;

      setMeusTreinamentos(anteriores =>
        anteriores.map(item =>
          item.usuarioTreinamentoId === atribuicaoId
            ? { ...item, progresso }
            : item
        )
      );
    }
  };

  const carregarModulosTreinamento =
    async (
      treinamentoId: string,
      usuarioTreinamentoId?: string
    ): Promise<void> => {
      if (!treinamentoId) {
        setModulosTreinamento([]);
        return;
      }

      try {
        setCarregandoModulos(true);
        setErroModulos('');

        const service = new DataverseService(
          dataverseClient,
          dataverseApiUrl
        );

        const [dadosModulos, dadosUsuarioModulos] = await Promise.all([
          service.getModulosTreinamento(treinamentoId),
          usuarioTreinamentoId
            ? service.getUsuarioModulos(usuarioTreinamentoId)
            : Promise.resolve([])
        ]);

        const progressoPorModulo = new Map<string, DataverseRecord>();

        (dadosUsuarioModulos as DataverseRecord[]).forEach(registro => {
          const moduloId = obterTexto(
            registro,
            ['_dgt_modulo_value'],
            ''
          ).toLowerCase();

          if (moduloId) {
            progressoPorModulo.set(moduloId, registro);
          }
        });

        const modulos = (dadosModulos as DataverseRecord[])
          .map(mapearModuloTreinamento)
          .filter(item => item.ativo)
          .map(modulo => {
            const progresso = progressoPorModulo.get(
              modulo.id.toLowerCase()
            );

            if (!progresso) {
              return modulo;
            }

            const statusModulo = obterNumero(
              progresso,
              ['dgt_status'],
              100000000
            );

            return {
              ...modulo,
              usuarioModuloId: obterTexto(
                progresso,
                ['dgt_usuariomoduloid'],
                ''
              ),
              statusModulo,
              statusModuloNome:
                obterFormatado(progresso, 'dgt_status') ||
                (statusModulo === 100000002
                  ? 'Concluído'
                  : statusModulo === 100000001
                    ? 'Em andamento'
                    : 'Não iniciado'),
              dataInicio: obterTexto(
                progresso,
                ['dgt_datainicio'],
                ''
              ),
              dataConclusao: obterTexto(
                progresso,
                ['dgt_dataconclusao'],
                ''
              )
            };
          })
          .sort((a, b) => a.ordem - b.ordem);

        setModulosTreinamento(modulos);

        const progresso = calcularProgressoModulos(modulos);

        setTreinamentoSelecionado(anterior =>
          anterior
            ? { ...anterior, progresso }
            : anterior
        );

        if (usuarioTreinamentoId) {
          setMeusTreinamentos(anteriores =>
            anteriores.map(item =>
              item.usuarioTreinamentoId === usuarioTreinamentoId
                ? { ...item, progresso }
                : item
            )
          );
        }
      } catch (error) {
        console.error('Erro ao carregar módulos do treinamento:', error);
        setModulosTreinamento([]);
        setErroModulos(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os módulos do treinamento.'
        );
      } finally {
        setCarregandoModulos(false);
      }
    };

  const iniciarModulo = async (
    modulo: IModuloTreinamento
  ): Promise<void> => {
    if (!modulo.usuarioModuloId) {
      setErroModulos(
        'Não foi encontrado o registro Usuário Módulo para este módulo.'
      );
      return;
    }

    try {
      setProcessandoModuloId(modulo.id);
      setErroModulos('');

      const service = new DataverseService(
        dataverseClient,
        dataverseApiUrl
      );

      await service.iniciarUsuarioModulo(modulo.usuarioModuloId);

      const agora = new Date().toISOString();
      const atualizados = modulosTreinamento.map(item =>
        item.id === modulo.id
          ? {
            ...item,
            statusModulo: 100000001,
            statusModuloNome: 'Em andamento',
            dataInicio: item.dataInicio || agora
          }
          : item
      );

      setModulosTreinamento(atualizados);
      atualizarProgressoTreinamentoNaTela(atualizados);
    } catch (error) {
      console.error('Erro ao iniciar módulo:', error);
      setErroModulos(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o módulo.'
      );
    } finally {
      setProcessandoModuloId('');
    }
  };

  const concluirModulo = async (
    modulo: IModuloTreinamento
  ): Promise<void> => {
    if (!modulo.usuarioModuloId) {
      setErroModulos(
        'Não foi encontrado o registro Usuário Módulo para este módulo.'
      );
      return;
    }

    try {
      setProcessandoModuloId(modulo.id);
      setErroModulos('');

      const service = new DataverseService(
        dataverseClient,
        dataverseApiUrl
      );

      await service.concluirUsuarioModulo(modulo.usuarioModuloId);

      const agora = new Date().toISOString();
      const atualizados = modulosTreinamento.map(item =>
        item.id === modulo.id
          ? {
            ...item,
            statusModulo: 100000002,
            statusModuloNome: 'Concluído',
            dataConclusao: agora
          }
          : item
      );

      setModulosTreinamento(atualizados);
      atualizarProgressoTreinamentoNaTela(atualizados);
    } catch (error) {
      console.error('Erro ao concluir módulo:', error);
      setErroModulos(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir o módulo.'
      );
    } finally {
      setProcessandoModuloId('');
    }
  };

  const abrirTreinamento = (
    treinamento: ITreinamento
  ): void => {
    if (treinamento.status === 'Bloqueado') {
      return;
    }

    setTreinamentoSelecionado(treinamento);
    setModulosTreinamento([]);
    setErroModulos('');
    setErroExecucaoTreinamento('');
    setPaginaAtual('executarTreinamento');
    void carregarModulosTreinamento(
      treinamento.id,
      treinamento.usuarioTreinamentoId
    );
  };

  /* =====================================================
     CABEÇALHO INTERNO
  ===================================================== */

  const PageHeader = ({
    titulo,
    descricao,
    voltar
  }: {
    titulo: string;
    descricao: string;
    voltar?: boolean;
  }): React.ReactElement => (
    <div className={styles.pageHeaderWithAction}>

      <div>
        {voltar && (
          <button
            className={styles.backButton}
            onClick={voltarGestao}
          >
            ← Voltar para Gestão
          </button>
        )}

        <h1>{titulo}</h1>
        <p>{descricao}</p>
      </div>

    </div>
  );

  /* =====================================================
     VISÃO GERAL DO MÓDULO DE TREINAMENTOS
  ===================================================== */

  const renderInicio = (): React.ReactElement => {
    const treinamentoEmAndamento = meusTreinamentos.find(
      item => item.status === 'Em andamento'
    ) || meusTreinamentos[0];

    const concluidos = meusTreinamentos.filter(
      item => item.status === 'Concluído'
    ).length;

    const emAndamento = meusTreinamentos.filter(
      item => item.status === 'Em andamento'
    ).length;

    const pendentes = meusTreinamentos.filter(
      item => item.status === 'Disponível'
    ).length;

    const bloqueados = meusTreinamentos.filter(
      item => item.status === 'Bloqueado'
    ).length;

    const trilhasUsuario = Array.from(
      new Set(
        historico
          .map(item => item.trilha)
          .filter(item => item && item !== '-')
      )
    );

    const idsAtribuidos = new Set(
      meusTreinamentos.map(item => item.id.toLowerCase())
    );

    const treinamentosDisponiveis = catalogoTreinamentos
      .filter(item => !idsAtribuidos.has(item.id.toLowerCase()))
      .slice(0, 4);

    return (
      <>
        <section className={styles.trainingHero}>
          <div className={styles.trainingHeroIcon}>🎓</div>

          <div className={styles.trainingHeroContent}>
            <h1>Treinamentos</h1>
            <h2>Desenvolva seu conhecimento. Construa resultados.</h2>
            <p>
              Trilhas, cursos, avaliações e certificações em um só lugar.
            </p>
          </div>

          <div className={styles.trainingHeroQuote}>
            <p>
              “Pessoa que aprende hoje, constrói um amanhã melhor.”
            </p>
            <strong>DGT</strong>
          </div>
        </section>

        <nav className={styles.trainingSubnav} aria-label="Navegação de treinamentos">
          <button
            className={styles.trainingSubnavActive}
            onClick={() => setPaginaAtual('inicio')}
          >
            <span>⌂</span>
            Visão geral
          </button>

          <button onClick={() => setPaginaAtual('treinamentos')}>
            <span>▶</span>
            Meus treinamentos
          </button>

          <button onClick={() => setPaginaAtual('trilhas')}>
            <span>▰</span>
            Trilhas
          </button>

          <button onClick={() => setPaginaAtual('gestao')}>
            <span>▣</span>
            Catálogo
          </button>

          <button onClick={() => setPaginaAtual('historico')}>
            <span>◷</span>
            Histórico
          </button>

          <button onClick={() => setPaginaAtual('certificados')}>
            <span>★</span>
            Certificados
          </button>

          {isGestor && (
            <button onClick={() => setPaginaAtual('gestao')}>
              <span>⚙</span>
              Gestão
            </button>
          )}
        </nav>

        <main className={styles.trainingOverview}>
          <section className={styles.trainingOverviewHeader}>
            <div>
              <h2>Olá, {primeiroNome}! 👋</h2>
              <p>Aqui está um resumo da sua jornada de aprendizado.</p>
            </div>

            <span>
              {carregandoDataverse
                ? 'Carregando dados do Dataverse...'
                : erroDataverse
                  ? 'Falha ao consultar o Dataverse'
                  : conectadoDataverse
                    ? 'Dados atualizados pelo Dataverse'
                    : 'Dataverse não conectado'}
            </span>
          </section>

          <section className={styles.trainingKpis}>
            <article className={styles.kpiSuccess}>
              <div className={styles.kpiIcon}>🎓</div>
              <div>
                <strong>{concluidos}</strong>
                <span>Concluídos</span>
              </div>
            </article>

            <article className={styles.kpiProgress}>
              <div className={styles.kpiIcon}>▶</div>
              <div>
                <strong>{emAndamento}</strong>
                <span>Em andamento</span>
              </div>
            </article>

            <article className={styles.kpiPending}>
              <div className={styles.kpiIcon}>◷</div>
              <div>
                <strong>{pendentes}</strong>
                <span>Pendentes</span>
                <small>aguardando início</small>
              </div>
            </article>

            <article className={styles.kpiExpired}>
              <div className={styles.kpiIcon}>▣</div>
              <div>
                <strong>{bloqueados}</strong>
                <span>Bloqueados</span>
                <small>pré-requisito pendente</small>
              </div>
            </article>

            <article className={styles.kpiTrails}>
              <div className={styles.kpiIcon}>▰</div>
              <div>
                <strong>{quantidadeTrilhasUsuario}</strong>
                <span>Trilhas inscritas</span>
              </div>
            </article>
          </section>

          <section className={styles.trainingDashboardGrid}>
            <div className={styles.trainingDashboardMain}>
              <article className={styles.overviewCard}>
                <div className={styles.overviewCardHeader}>
                  <div>
                    <h3>▣ Continuar treinamento</h3>
                    <p>Retome de onde parou.</p>
                  </div>

                  <button onClick={() => setPaginaAtual('treinamentos')}>
                    Ver meus treinamentos →
                  </button>
                </div>

                {carregandoDataverse ? (
                  <div className={styles.continueTraining}>
                    <div className={styles.continueTrainingContent}>
                      <h3>Carregando seus treinamentos...</h3>
                      <p>Aguarde enquanto consultamos o Dataverse.</p>
                    </div>
                  </div>
                ) : erroDataverse ? (
                  <div className={styles.continueTraining}>
                    <div className={styles.continueTrainingContent}>
                      <h3>Não foi possível carregar seus treinamentos</h3>
                      <p>{erroDataverse}</p>
                    </div>
                  </div>
                ) : treinamentoEmAndamento ? (
                  <div className={styles.continueTraining}>
                    <div
                      className={styles.continueTrainingImage}
                      style={{
                        backgroundImage: `url(${treinamentoEmAndamento.imagem})`
                      }}
                    />

                    <div className={styles.continueTrainingContent}>
                      <span
                        className={`${styles.statusBadge} ${statusClass(
                          treinamentoEmAndamento.status
                        )}`}
                      >
                        {treinamentoEmAndamento.status}
                      </span>

                      <h3>{treinamentoEmAndamento.nome}</h3>
                      <p>
                        {treinamentoEmAndamento.descricao ||
                          treinamentoEmAndamento.codigo ||
                          'Treinamento DGT'}
                      </p>
                      <small>{treinamentoEmAndamento.cargaHoraria}</small>

                      <div className={styles.continueProgressRow}>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${treinamentoEmAndamento.progresso}%`
                            }}
                          />
                        </div>

                        <strong>{treinamentoEmAndamento.progresso}%</strong>
                      </div>
                    </div>

                    <button
                      className={styles.continueButton}
                      onClick={() =>
                        abrirTreinamento(treinamentoEmAndamento)
                      }
                    >
                      Continuar →
                    </button>
                  </div>
                ) : (
                  <div className={styles.continueTraining}>
                    <div className={styles.continueTrainingContent}>
                      <h3>Nenhum treinamento atribuído</h3>
                      <p>
                        Ainda não encontramos treinamentos vinculados ao seu usuário.
                      </p>
                    </div>
                  </div>
                )}
              </article>

              <article className={styles.overviewCard}>
                <div className={styles.overviewCardHeader}>
                  <div>
                    <h3>🎓 Meus treinamentos</h3>
                    <p>Seus cursos atribuídos e respectivos status.</p>
                  </div>

                  <button onClick={() => setPaginaAtual('treinamentos')}>
                    Ver todos →
                  </button>
                </div>

                <div className={styles.trainingOverviewCards}>
                  {carregandoDataverse ? (
                    <div className={styles.pagePanel}>
                      Carregando treinamentos do Dataverse...
                    </div>
                  ) : meusTreinamentos.length === 0 ? (
                    <div className={styles.pagePanel}>
                      Nenhum treinamento foi atribuído ao seu usuário.
                    </div>
                  ) : (
                    meusTreinamentos.map(treinamento => (
                      <article
                        className={styles.trainingOverviewCard}
                        key={treinamento.id}
                      >
                        <div
                          className={styles.trainingOverviewImage}
                          style={{
                            backgroundImage: `url(${treinamento.imagem})`
                          }}
                        />

                        <div className={styles.trainingOverviewBody}>
                          <span
                            className={`${styles.statusBadge} ${statusClass(
                              treinamento.status
                            )}`}
                          >
                            {treinamento.status}
                          </span>

                          <strong>{treinamento.nome}</strong>
                          <small>{treinamento.cargaHoraria}</small>

                          {treinamento.progresso > 0 && (
                            <div className={styles.miniProgress}>
                              <div className={styles.progressTrack}>
                                <div
                                  className={styles.progressFill}
                                  style={{
                                    width: `${treinamento.progresso}%`
                                  }}
                                />
                              </div>
                              <span>{treinamento.progresso}%</span>
                            </div>
                          )}

                          <button
                            disabled={treinamento.status === 'Bloqueado'}
                            onClick={() =>
                              abrirTreinamento(treinamento)
                            }
                          >
                            {treinamento.status === 'Concluído'
                              ? 'Ver certificado'
                              : treinamento.status === 'Bloqueado'
                                ? '🔒 Pré-requisito'
                                : 'Continuar'}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </article>

              <article className={styles.overviewCard}>
                <div className={styles.overviewCardHeader}>
                  <div>
                    <h3>✦ Treinamentos disponíveis</h3>
                    <p>Itens ativos do catálogo Dataverse ainda não atribuídos a você.</p>
                  </div>

                  <button onClick={() => setPaginaAtual('gestao')}>
                    Ver catálogo →
                  </button>
                </div>

                <div className={styles.recommendedTrails}>
                  {treinamentosDisponiveis.length === 0 ? (
                    <div className={styles.pagePanel}>
                      Nenhum outro treinamento ativo disponível no catálogo.
                    </div>
                  ) : (
                    treinamentosDisponiveis.map(treinamento => (
                      <button
                        key={treinamento.id}
                        onClick={() => setPaginaAtual('gestao')}
                      >
                        <span>🎓</span>
                        <div>
                          <strong>{treinamento.nome}</strong>
                          <small>
                            {treinamento.codigo ||
                              treinamento.cargaHoraria}
                          </small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </article>
            </div>

            <aside className={styles.trainingDashboardSide}>
              <article className={styles.overviewCard}>
                <div className={styles.overviewCardHeader}>
                  <div>
                    <h3>▣ Próximos treinamentos</h3>
                    <p>Turmas e atividades programadas.</p>
                  </div>
                </div>

                <div className={styles.upcomingList}>
                  <div className={styles.pagePanel}>
                    Próximas turmas ainda não estão conectadas.
                    A próxima etapa será integrar calendário/turmas do Microsoft 365.
                  </div>
                </div>
              </article>

              <article className={styles.overviewCard}>
                <div className={styles.overviewCardHeader}>
                  <div>
                    <h3>▰ Trilhas em andamento</h3>
                    <p>Acompanhe sua evolução por trilha.</p>
                  </div>
                </div>

                <div className={styles.trailProgressList}>
                  {trilhasUsuario.length === 0 ? (
                    <div className={styles.pagePanel}>
                      Nenhuma trilha identificada nas suas atribuições.
                    </div>
                  ) : (
                    trilhasUsuario.map(trilha => (
                      <div key={trilha}>
                        <span>{trilha}</span>
                        <div>
                          <strong>
                            Vínculo identificado no Dataverse
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className={styles.overviewCard}>
                <div className={styles.overviewCardHeader}>
                  <div>
                    <h3>⌁ Acesso rápido</h3>
                    <p>Atalhos do módulo de treinamentos.</p>
                  </div>
                </div>

                <div className={styles.trainingQuickLinks}>
                  <button onClick={() => setPaginaAtual('gestao')}>
                    <span>▣</span>
                    Catálogo
                  </button>

                  <button onClick={() => setPaginaAtual('certificados')}>
                    <span>★</span>
                    Certificados
                  </button>

                  <button onClick={() => setPaginaAtual('suporte')}>
                    <span>?</span>
                    Dúvidas
                  </button>

                  <button onClick={() => setPaginaAtual('suporte')}>
                    <span>☏</span>
                    Suporte
                  </button>
                </div>
              </article>
            </aside>
          </section>
        </main>
      </>
    );
  };

  /* =====================================================
     MEUS TREINAMENTOS
  ===================================================== */

  const renderTreinamentos = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Meus Treinamentos"
        descricao="Acompanhe os treinamentos atribuídos a você e continue sua jornada de desenvolvimento."
      />

      <div className={styles.filtersBar}>

        <input
          placeholder="Buscar treinamento..."
        />

        <select defaultValue="todos">
          <option value="todos">
            Todos os status
          </option>
          <option>Disponível</option>
          <option>Em andamento</option>
          <option>Concluído</option>
          <option>Bloqueado</option>
        </select>

      </div>

      {carregandoDataverse && (
        <div className={styles.pagePanel}>
          Carregando treinamentos do Dataverse...
        </div>
      )}

      {!carregandoDataverse && erroDataverse && (
        <div className={styles.pagePanel}>
          <strong>Erro ao consultar o Dataverse:</strong>
          <br />
          {erroDataverse}
        </div>
      )}

      {!carregandoDataverse &&
        !erroDataverse &&
        meusTreinamentos.length === 0 && (
          <div className={styles.pagePanel}>
            Nenhum treinamento foi atribuído ao usuário {userEmail}.
          </div>
        )}

      <div className={styles.trainingPageGrid}>

        {meusTreinamentos.map(treinamento => (

          <article
            className={styles.trainingLargeCard}
            key={treinamento.id}
          >

            <div
              className={styles.trainingLargeImage}
              style={{
                backgroundImage:
                  `url(${treinamento.imagem})`
              }}
            />

            <div className={styles.trainingLargeBody}>

              <div>
                <strong>
                  {treinamento.nome}
                </strong>

                <span>
                  {treinamento.descricao || treinamento.codigo || 'Treinamento DGT'}
                </span>
              </div>

              <span
                className={`${styles.statusBadge} ${statusClass(
                  treinamento.status
                )}`}
              >
                {treinamento.status}
              </span>

              <div className={styles.progressRow}>

                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width:
                        `${treinamento.progresso}%`
                    }}
                  />
                </div>

                <strong>
                  {treinamento.progresso}%
                </strong>

              </div>

              <div className={styles.trainingFooter}>

                <span>{treinamento.cargaHoraria}</span>

                <button
                  onClick={() =>
                    abrirTreinamento(treinamento)
                  }
                  disabled={
                    treinamento.status === 'Bloqueado'
                  }
                >
                  {treinamento.status === 'Bloqueado'
                    ? 'Bloqueado'
                    : treinamento.status === 'Concluído'
                      ? 'Revisar'
                      : 'Acessar treinamento'}
                </button>

              </div>

            </div>

          </article>

        ))}

      </div>

    </div>
  );

  /* =====================================================
   EXECUÇÃO DO TREINAMENTO
===================================================== */
  const iniciarTreinamento =
    async (): Promise<void> => {

      if (!treinamentoSelecionado) {
        return;
      }

      if (treinamentoSelecionado.status === 'Em andamento') {
        return;
      }

      if (!treinamentoSelecionado.usuarioTreinamentoId) {
        setErroExecucaoTreinamento(
          'Não foi possível identificar a atribuição deste treinamento.'
        );
        return;
      }

      try {

        setIniciandoTreinamento(true);
        setErroExecucaoTreinamento('');

        const service =
          new DataverseService(
            dataverseClient,
            dataverseApiUrl
          );

        await service.iniciarUsuarioTreinamento(
          treinamentoSelecionado.usuarioTreinamentoId
        );

        const treinamentoAtualizado: ITreinamento = {
          ...treinamentoSelecionado,
          status: 'Em andamento',
          progresso: treinamentoSelecionado.progresso
        };

        setTreinamentoSelecionado(
          treinamentoAtualizado
        );

        setMeusTreinamentos(anteriores =>
          anteriores.map(item =>
            item.usuarioTreinamentoId ===
              treinamentoSelecionado.usuarioTreinamentoId
              ? {
                ...item,
                status: 'Em andamento',
                progresso: item.progresso
              }
              : item
          )
        );

      } catch (error) {

        console.error(
          'Erro ao iniciar treinamento:',
          error
        );

        setErroExecucaoTreinamento(
          error instanceof Error
            ? error.message
            : 'Não foi possível iniciar o treinamento.'
        );

      } finally {

        setIniciandoTreinamento(false);
      }
    };

  const renderExecutarTreinamento =
    (): React.ReactElement => {

      if (!treinamentoSelecionado) {
        return (
          <div className={styles.pageContent}>

            <PageHeader
              titulo="Treinamento"
              descricao="Nenhum treinamento foi selecionado."
            />

            <div className={styles.pagePanel}>
              <button
                className={styles.primaryButton}
                onClick={() =>
                  setPaginaAtual('treinamentos')
                }
              >
                ← Voltar para Meus Treinamentos
              </button>
            </div>

          </div>
        );
      }

      return (
        <div className={styles.pageContent}>

          <div className={styles.pageHeaderWithAction}>

            <div>

              <button
                className={styles.backButton}
                onClick={() =>
                  setPaginaAtual('treinamentos')
                }
              >
                ← Meus treinamentos
              </button>

              <h1>
                {treinamentoSelecionado.nome}
              </h1>

              <p>
                {treinamentoSelecionado.descricao ||
                  'Treinamento DGT'}
              </p>

            </div>

          </div>

          <div className={styles.largeFormCard}>

            <div>

              <span
                className={`${styles.statusBadge} ${statusClass(
                  treinamentoSelecionado.status
                )}`}
              >
                {treinamentoSelecionado.status}
              </span>

              <h2>
                {treinamentoSelecionado.nome}
              </h2>

              <p>
                {treinamentoSelecionado.descricao}
              </p>

            </div>

            <div className={styles.historyIndicators}>

              <div>
                <strong>
                  {treinamentoSelecionado.codigo || '-'}
                </strong>
                <span>Código</span>
              </div>

              <div>
                <strong>
                  {treinamentoSelecionado.cargaHoraria}
                </strong>
                <span>Carga horária</span>
              </div>

              <div>
                <strong>
                  {treinamentoSelecionado.validadeMeses
                    ? `${treinamentoSelecionado.validadeMeses} meses`
                    : '-'}
                </strong>
                <span>Validade</span>
              </div>

              <div>
                <strong>
                  {treinamentoSelecionado.progresso}%
                </strong>
                <span>Progresso</span>
              </div>

            </div>

            <div className={styles.pagePanel}>
              <h2>Conteúdo do treinamento</h2>
              <p>Módulos cadastrados no Dataverse para este treinamento.</p>

              {carregandoModulos && (
                <div className={styles.pagePanel}>
                  Carregando módulos do Dataverse...
                </div>
              )}

              {!carregandoModulos && erroModulos && (
                <div className={styles.pagePanel}>
                  <strong>Não foi possível carregar os módulos.</strong>
                  <p>{erroModulos}</p>
                </div>
              )}

              {!carregandoModulos &&
                !erroModulos &&
                modulosTreinamento.length === 0 && (
                  <div className={styles.pagePanel}>
                    Nenhum módulo ativo foi encontrado para este treinamento.
                  </div>
                )}

              {!carregandoModulos &&
                !erroModulos &&
                modulosTreinamento.map(modulo => (
                  <div className={styles.pagePanel} key={modulo.id}>
                    <div className={styles.tableTitle}>
                      <div>
                        <span>Módulo {modulo.ordem}</span>
                        <h3>{modulo.titulo}</h3>
                        <p>
                          {modulo.tipoModuloNome}
                          {modulo.duracaoMin > 0
                            ? ` • ${modulo.duracaoMin} min`
                            : ''}
                          {modulo.obrigatorio
                            ? ' • Obrigatório'
                            : ' • Opcional'}
                        </p>
                      </div>
                    </div>

                    {modulo.descricao && <p>{modulo.descricao}</p>}

                    <p>
                      <strong>Status:</strong> {modulo.statusModuloNome}
                      {modulo.dataInicio
                        ? ` • Iniciado em ${formatarData(modulo.dataInicio)}`
                        : ''}
                      {modulo.dataConclusao
                        ? ` • Concluído em ${formatarData(modulo.dataConclusao)}`
                        : ''}
                    </p>

                    {modulo.urlConteudo ? (
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          window.open(
                            modulo.urlConteudo,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      >
                        Acessar conteúdo →
                      </button>
                    ) : (
                      <button className={styles.secondaryButton} disabled>
                        Conteúdo da página em preparação
                      </button>
                    )}

                    {modulo.statusModulo === 100000000 && (
                      <button
                        className={styles.primaryButton}
                        disabled={
                          processandoModuloId === modulo.id ||
                          !modulo.usuarioModuloId
                        }
                        onClick={() => void iniciarModulo(modulo)}
                      >
                        {processandoModuloId === modulo.id
                          ? 'Iniciando...'
                          : 'Iniciar módulo'}
                      </button>
                    )}

                    {modulo.statusModulo === 100000001 && (
                      <button
                        className={styles.primaryButton}
                        disabled={processandoModuloId === modulo.id}
                        onClick={() => void concluirModulo(modulo)}
                      >
                        {processandoModuloId === modulo.id
                          ? 'Concluindo...'
                          : 'Concluir módulo'}
                      </button>
                    )}

                    {modulo.statusModulo === 100000002 && (
                      <button className={styles.secondaryButton} disabled>
                        ✓ Módulo concluído
                      </button>
                    )}
                  </div>
                ))}

              <div className={styles.pagePanel}>
                {modulosTreinamento
                  .filter(modulo => modulo.obrigatorio)
                  .every(modulo => modulo.statusModulo === 100000002) &&
                  modulosTreinamento.filter(modulo => modulo.obrigatorio).length > 0 ? (
                    <>
                      <h3>🔓 Avaliação liberada</h3>
                      <p>
                        Todos os módulos obrigatórios foram concluídos.
                        A avaliação está pronta para ser conectada na próxima etapa.
                      </p>
                      <button className={styles.primaryButton} disabled>
                        Iniciar avaliação — próxima etapa
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>🔒 Avaliação</h3>
                      <p>
                        Conclua todos os módulos obrigatórios para liberar a avaliação.
                      </p>
                    </>
                  )}
              </div>
            </div>

            {erroExecucaoTreinamento && (
              <div className={styles.pagePanel}>
                <strong>Não foi possível iniciar o treinamento.</strong>
                <p>{erroExecucaoTreinamento}</p>
              </div>
            )}

            <div className={styles.formActions}>

              <button
                className={styles.secondaryButton}
                onClick={() =>
                  setPaginaAtual('treinamentos')
                }
              >
                Voltar
              </button>

              <button
                className={styles.primaryButton}
                disabled={
                  iniciandoTreinamento ||
                  treinamentoSelecionado.status === 'Em andamento'
                }
                onClick={() => void iniciarTreinamento()}
              >
                {iniciandoTreinamento
                  ? 'Iniciando...'
                  : treinamentoSelecionado.status === 'Em andamento'
                    ? 'Treinamento iniciado'
                    : 'Iniciar treinamento'}
              </button>

            </div>

          </div>

        </div>
      );
    };

  /* =====================================================
     DOCUMENTOS
  ===================================================== */

  const renderDocumentos = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Documentos"
        descricao="Consulte procedimentos, políticas, instruções e documentos vinculados aos seus processos."
      />

      <div className={styles.filtersBar}>

        <input placeholder="Buscar documento..." />

        <select defaultValue="todos">
          <option value="todos">
            Todos os processos
          </option>
          <option>Produção</option>
          <option>Qualidade</option>
          <option>Manutenção</option>
        </select>

      </div>

      <div className={styles.pagePanel}>

        <table className={styles.fullTable}>

          <thead>
            <tr>
              <th>Código</th>
              <th>Documento</th>
              <th>Categoria</th>
              <th>Revisão</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {documentos.map(documento => (

              <tr key={documento.id}>

                <td>
                  <strong>
                    {documento.codigo}
                  </strong>
                </td>

                <td>
                  {documento.documento}
                </td>

                <td>
                  {documento.categoria}
                </td>

                <td>
                  {documento.revisao}
                </td>

                <td>
                  <span
                    className={
                      documento.status === 'Vigente'
                        ? styles.documentActive
                        : styles.documentReview
                    }
                  >
                    {documento.status}
                  </span>
                </td>

                <td>

                  <button
                    className={styles.tableAction}
                    onClick={() =>
                      acaoMock(
                        `Visualizando ${documento.documento}`
                      )
                    }
                  >
                    Visualizar
                  </button>

                  <button
                    className={styles.tableAction}
                    onClick={() =>
                      acaoMock(
                        `Baixando ${documento.documento}`
                      )
                    }
                  >
                    Baixar
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );

  /* =====================================================
     HISTÓRICO
  ===================================================== */

  const renderHistorico = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Meu Histórico"
        descricao="Consulte treinamentos realizados, notas, conclusões, validades e registros."
      />

      <div className={styles.historyIndicators}>

        <div>
          <strong>{historico.filter(item => item.status === 'Concluído').length}</strong>
          <span>Concluídos</span>
        </div>

        <div>
          <strong>{historico.filter(item => item.status === 'Em andamento').length}</strong>
          <span>Em andamento</span>
        </div>

        <div>
          <strong>{historico.filter(item => item.validade !== '-' && item.status !== 'Concluído').length}</strong>
          <span>Com validade registrada</span>
        </div>

        <div>
          <strong>{certificados.length}</strong>
          <span>Certificados disponíveis</span>
        </div>

      </div>

      <div className={styles.pagePanel}>

        <table className={styles.fullTable}>

          <thead>
            <tr>
              <th>Treinamento</th>
              <th>Trilha</th>
              <th>Status</th>
              <th>Conclusão</th>
              <th>Nota</th>
              <th>Validade</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {historico.map(item => (

              <tr key={item.id}>

                <td>
                  <strong>
                    {item.treinamento}
                  </strong>
                </td>

                <td>{item.trilha}</td>
                <td>{item.status}</td>
                <td>{item.conclusao}</td>
                <td>{item.nota}</td>
                <td>{item.validade}</td>

                <td>
                  <button
                    className={styles.tableAction}
                    onClick={() =>
                      acaoMock(
                        `Abrindo histórico de ${item.treinamento}`
                      )
                    }
                  >
                    Detalhes
                  </button>
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );

  /* =====================================================
     CERTIFICADOS
  ===================================================== */

  const renderCertificados = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Meus Certificados"
        descricao="Visualize e baixe os certificados dos treinamentos concluídos."
      />

      {carregandoDataverse && (
        <div className={styles.pagePanel}>
          Carregando certificados do Dataverse...
        </div>
      )}

      {!carregandoDataverse &&
        certificados.length === 0 && (
          <div className={styles.pagePanel}>
            Nenhum certificado está vinculado às suas atribuições no Dataverse.
          </div>
        )}

      <div className={styles.certificateGrid}>

        {certificados.map(certificado => (

          <article
            className={styles.certificateCard}
            key={certificado.id}
          >

            <div className={styles.certificateIcon}>
              <img
                src={logoDgt}
                alt="DGT Tecnologia"
              />
            </div>

            <div className={styles.certificateBody}>

              <span>
                Certificado de conclusão
              </span>

              <h3>
                {certificado.treinamento}
              </h3>

              <dl>

                <div>
                  <dt>Código</dt>
                  <dd>{certificado.codigo}</dd>
                </div>

                <div>
                  <dt>Conclusão</dt>
                  <dd>{certificado.conclusao}</dd>
                </div>

                <div>
                  <dt>Validade</dt>
                  <dd>{certificado.validade}</dd>
                </div>

                <div>
                  <dt>Carga horária</dt>
                  <dd>{certificado.cargaHoraria}</dd>
                </div>

              </dl>

              <div className={styles.certificateActions}>

                <button
                  onClick={() =>
                    acaoMock(
                      `Visualizando certificado ${certificado.codigo}`
                    )
                  }
                >
                  Visualizar
                </button>

                <button
                  onClick={() =>
                    acaoMock(
                      `Baixando certificado ${certificado.codigo}`
                    )
                  }
                >
                  ↓ Baixar PDF
                </button>

              </div>

            </div>

          </article>

        ))}

      </div>

    </div>
  );

  /* =====================================================
     SUPORTE
  ===================================================== */

  const renderSuporte = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Ajuda e Suporte"
        descricao="Encontre orientações ou entre em contato com a equipe responsável pelo portal."
      />

      <div className={styles.supportGrid}>

        <article className={styles.supportCard}>
          <span className={styles.supportIcon}>?</span>
          <h3>Dúvidas frequentes</h3>

          <p>
            Consulte respostas sobre treinamentos,
            avaliações e certificados.
          </p>

          <button
            onClick={() =>
              acaoMock('Abrindo FAQ')
            }
          >
            Consultar FAQ →
          </button>
        </article>

        <article className={styles.supportCard}>
          <span className={styles.supportIcon}>🎓</span>

          <h3>Problemas com treinamento</h3>

          <p>
            Informe problemas de acesso,
            módulos ou avaliações.
          </p>

          <button
            onClick={() =>
              acaoMock('Abrindo solicitação de treinamento')
            }
          >
            Abrir solicitação →
          </button>
        </article>

        <article className={styles.supportCard}>
          <span className={styles.supportIcon}>🎧</span>

          <h3>Falar com o suporte</h3>

          <p>
            Entre em contato com a equipe responsável.
          </p>

          <button
            onClick={() =>
              acaoMock('Abrindo canal de suporte')
            }
          >
            Entrar em contato →
          </button>
        </article>

      </div>

      <div className={styles.supportForm}>

        <h2>Abrir chamado</h2>

        <div className={styles.formGrid}>

          <label>
            Assunto
            <input placeholder="Informe o assunto" />
          </label>

          <label>
            Categoria
            <select defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              <option>Acesso</option>
              <option>Treinamento</option>
              <option>Avaliação</option>
              <option>Certificado</option>
              <option>Outro</option>
            </select>
          </label>

          <label className={styles.fullField}>
            Descrição
            <textarea
              rows={5}
              placeholder="Descreva sua solicitação..."
            />
          </label>

        </div>

        <button
          className={styles.primaryButton}
          onClick={() =>
            acaoMock('Chamado enviado')
          }
        >
          Enviar solicitação
        </button>

      </div>

    </div>
  );

  /* =====================================================
     GESTÃO - DASHBOARD
  ===================================================== */

  const renderGestao = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <div className={styles.managerHeader}>

        <div>
          <span className={styles.managerBadge}>
            Área do Gestor
          </span>

          <h1>
            Gestão de Treinamentos
          </h1>

          <p>
            Gerencie treinamentos, trilhas,
            atribuições e acompanhe sua equipe.
          </p>
        </div>

        <button
          className={styles.newTrainingButton}
          onClick={() =>
            setPaginaAtual('novoTreinamento')
          }
        >
          + Novo treinamento
        </button>

      </div>

      <div className={styles.managerIndicators}>

        <article>
          <span>Treinamentos ativos</span>
          <strong>{catalogoTreinamentos.length}</strong>
          <small>Catálogo disponível</small>
        </article>

        <article>
          <span>Colaboradores</span>
          <strong>42</strong>
          <small>Na equipe</small>
        </article>

        <article>
          <span>Pendências</span>
          <strong>11</strong>
          <small>Treinamentos pendentes</small>
        </article>

        <article>
          <span>Conformidade</span>
          <strong>87%</strong>
          <small>Equipe em conformidade</small>
        </article>

      </div>

      <div className={styles.managerActions}>

        <button
          onClick={() =>
            setPaginaAtual('atribuirTreinamento')
          }
        >
          <span>＋</span>

          <div>
            <strong>
              Atribuir treinamento
            </strong>

            <small>
              Usuário, grupo ou função
            </small>
          </div>
        </button>

        <button
          onClick={() =>
            setPaginaAtual('trilhas')
          }
        >
          <span>♢</span>

          <div>
            <strong>
              Gerenciar trilhas
            </strong>

            <small>
              Cursos e pré-requisitos
            </small>
          </div>
        </button>

        <button
          onClick={() =>
            setPaginaAtual('equipe')
          }
        >
          <span>👥</span>

          <div>
            <strong>
              Acompanhar equipe
            </strong>

            <small>
              Progresso e pendências
            </small>
          </div>
        </button>

      </div>

      <div className={styles.pagePanel}>

        <div className={styles.tableTitle}>
          <div>
            <h2>
              Catálogo de treinamentos
            </h2>

            <p>
              Treinamentos cadastrados na plataforma.
            </p>
          </div>

          <input
            placeholder="Buscar treinamento..."
          />
        </div>

        <table className={styles.fullTable}>

          <thead>
            <tr>
              <th>Treinamento</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Carga horária</th>
              <th>Atribuídos</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {catalogoTreinamentos.map(treinamento => (

              <tr key={treinamento.id}>

                <td>
                  <strong>
                    {treinamento.nome}
                  </strong>
                </td>

                <td>
                  {treinamento.descricao || treinamento.codigo || 'Treinamento DGT'}
                </td>

                <td>
                  <span className={styles.documentActive}>
                    Ativo
                  </span>
                </td>

                <td>
                  {treinamento.cargaHoraria}
                </td>

                <td>
                  —
                </td>

                <td>

                  <button
                    className={styles.tableAction}
                    onClick={() =>
                      acaoMock(
                        `Editando ${treinamento.nome}`
                      )
                    }
                  >
                    Editar
                  </button>

                  <button
                    className={styles.tableAction}
                    onClick={() =>
                      setPaginaAtual(
                        'atribuirTreinamento'
                      )
                    }
                  >
                    Atribuir
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );

  /* =====================================================
     NOVO TREINAMENTO
  ===================================================== */

  const renderNovoTreinamento = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Novo Treinamento"
        descricao="Cadastre um novo treinamento no catálogo."
        voltar
      />

      <div className={styles.largeFormCard}>

        <h2>Informações gerais</h2>

        <div className={styles.formGrid}>

          <label>
            Nome do treinamento *
            <input placeholder="Ex.: NR-12" />
          </label>

          <label>
            Código *
            <input placeholder="Ex.: TR-001" />
          </label>

          <label>
            Categoria
            <select defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              <option>Segurança</option>
              <option>Qualidade</option>
              <option>Produção</option>
              <option>Manutenção</option>
              <option>Integração</option>
            </select>
          </label>

          <label>
            Carga horária
            <input
              type="number"
              placeholder="8"
            />
          </label>

          <label>
            Nota mínima (%)
            <input
              type="number"
              defaultValue="70"
            />
          </label>

          <label>
            Validade (meses)
            <input
              type="number"
              defaultValue="12"
            />
          </label>

          <label>
            Quantidade de questões
            <input
              type="number"
              defaultValue="10"
            />
          </label>

          <label>
            Tentativas permitidas
            <input
              type="number"
              defaultValue="3"
            />
          </label>

          <label className={styles.fullField}>
            Descrição
            <textarea
              rows={5}
              placeholder="Descrição do treinamento..."
            />
          </label>

        </div>
        <div className={styles.formActions}>

          <button
            className={styles.secondaryButton}
            onClick={voltarGestao}
          >
            Cancelar
          </button>

          <button
            className={styles.primaryButton}
            onClick={() =>
              acaoMock(
                'Treinamento salvo com sucesso'
              )
            }
          >
            Salvar treinamento
          </button>

        </div>

      </div>

    </div>
  );

  /* =====================================================
     ATRIBUIR TREINAMENTO
  ===================================================== */

  const renderAtribuirTreinamento =
    (): React.ReactElement => (
      <div className={styles.pageContent}>

        <PageHeader
          titulo="Atribuir Treinamento"
          descricao="Crie atribuições individuais, por grupo, função ou trilha."
          voltar
        />

        <div className={styles.largeFormCard}>

          <div className={styles.assignmentOptions}>

            <button className={styles.assignmentActive}>
              👤 Individual
            </button>

            <button>
              👥 Grupo
            </button>

            <button>
              💼 Função
            </button>

            <button>
              ◇ Trilha
            </button>

          </div>

          <div className={styles.formGrid}>

            <label>
              Colaborador
              <select defaultValue="">
                <option value="" disabled>
                  Selecione o colaborador
                </option>

                {colaboradores.map(colaborador => (
                  <option key={colaborador.id}>
                    {colaborador.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Treinamento
              <select defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>

                {catalogoTreinamentos.map(treinamento => (
                  <option key={treinamento.id}>
                    {treinamento.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Origem da atribuição
              <select defaultValue="Gestor">
                <option>Gestor</option>
                <option>Grupo</option>
                <option>Função</option>
                <option>Individual</option>
                <option>Reciclagem</option>
                <option>Revisão documental</option>
              </select>
            </label>

            <label>
              Prazo para conclusão
              <input type="date" />
            </label>

          </div>

          <div className={styles.formActions}>

            <button
              className={styles.secondaryButton}
              onClick={voltarGestao}
            >
              Cancelar
            </button>

            <button
              className={styles.primaryButton}
              onClick={() =>
                acaoMock(
                  'Treinamento atribuído com sucesso'
                )
              }
            >
              Confirmar atribuição
            </button>

          </div>

        </div>

      </div>
    );

  /* =====================================================
     TRILHAS
  ===================================================== */

  const renderTrilhas = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Gerenciar Trilhas"
        descricao="Organize sequências de treinamentos e pré-requisitos."
        voltar
      />

      <div className={styles.trailGrid}>

        <article className={styles.trailCard}>

          <div className={styles.trailHeader}>
            <div>
              <span>TRILHA</span>
              <h3>Formação Produção</h3>
            </div>

            <strong>5 cursos</strong>
          </div>

          <ol>
            <li>
              <span>1</span>
              Integração DGT
            </li>

            <li>
              <span>2</span>
              Segurança Industrial
            </li>

            <li>
              <span>3</span>
              NR-12
            </li>

            <li>
              <span>4</span>
              Qualidade
            </li>

            <li>
              <span>5</span>
              Operação
            </li>
          </ol>

          <div className={styles.trailActions}>
            <button
              onClick={() =>
                acaoMock(
                  'Editando trilha Formação Produção'
                )
              }
            >
              Editar trilha
            </button>
          </div>

        </article>

        <article className={styles.trailCard}>

          <div className={styles.trailHeader}>
            <div>
              <span>TRILHA</span>
              <h3>Formação Qualidade</h3>
            </div>

            <strong>4 cursos</strong>
          </div>

          <ol>
            <li>
              <span>1</span>
              Integração DGT
            </li>

            <li>
              <span>2</span>
              Gestão da Qualidade
            </li>

            <li>
              <span>3</span>
              Auditoria Interna
            </li>

            <li>
              <span>4</span>
              Tratamento de NC
            </li>
          </ol>

          <div className={styles.trailActions}>
            <button
              onClick={() =>
                acaoMock(
                  'Editando trilha Formação Qualidade'
                )
              }
            >
              Editar trilha
            </button>
          </div>

        </article>

        <article className={styles.newTrailCard}>

          <button
            onClick={() =>
              acaoMock('Criando nova trilha')
            }
          >
            <span>＋</span>
            <strong>Nova trilha</strong>
            <small>
              Criar sequência de treinamentos
            </small>
          </button>

        </article>

      </div>

    </div>
  );

  /* =====================================================
     EQUIPE
  ===================================================== */

  const renderEquipe = (): React.ReactElement => (
    <div className={styles.pageContent}>

      <PageHeader
        titulo="Acompanhar Equipe"
        descricao="Visualize progresso, pendências, vencimentos e conformidade da equipe."
        voltar
      />

      <div className={styles.managerIndicators}>

        <article>
          <span>Colaboradores</span>
          <strong>42</strong>
          <small>Total da equipe</small>
        </article>

        <article>
          <span>Conformes</span>
          <strong>36</strong>
          <small>Sem pendências</small>
        </article>

        <article>
          <span>Com pendências</span>
          <strong>6</strong>
          <small>Necessitam atenção</small>
        </article>

        <article>
          <span>Conformidade</span>
          <strong>87%</strong>
          <small>Índice geral</small>
        </article>

      </div>

      <div className={styles.pagePanel}>

        <div className={styles.tableTitle}>
          <div>
            <h2>Minha equipe</h2>
            <p>
              Situação dos colaboradores.
            </p>
          </div>

          <input
            placeholder="Buscar colaborador..."
          />
        </div>

        <table className={styles.fullTable}>

          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Função</th>
              <th>Setor</th>
              <th>Concluídos</th>
              <th>Pendentes</th>
              <th>Conformidade</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {colaboradores.map(colaborador => (

              <tr key={colaborador.id}>

                <td>
                  <strong>
                    {colaborador.nome}
                  </strong>
                </td>

                <td>
                  {colaborador.funcao}
                </td>

                <td>
                  {colaborador.setor}
                </td>

                <td>
                  {colaborador.concluidos}
                </td>

                <td>
                  {colaborador.pendentes}
                </td>

                <td>
                  <strong>
                    {colaborador.conformidade}
                  </strong>
                </td>

                <td>
                  <button
                    className={styles.tableAction}
                    onClick={() =>
                      acaoMock(
                        `Abrindo perfil de ${colaborador.nome}`
                      )
                    }
                  >
                    Ver detalhes
                  </button>
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );

  /* =====================================================
     LAYOUT PRINCIPAL
  ===================================================== */

  return (
    <div className={styles.portal}>

      <aside className={styles.sidebar}>

        <nav className={styles.menu}>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('A Home geral da Intranet DGT será conectada nesta opção')
            }
          >
            <span className={styles.menuIcon}>⌂</span>
            <span>Início</span>
          </button>

          <button
            className={`${styles.menuItem} ${styles.menuActive}`}
            onClick={() => setPaginaAtual('inicio')}
          >
            <span className={styles.menuIcon}>🎓</span>
            <span>Treinamentos</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() => setPaginaAtual('documentos')}
          >
            <span className={styles.menuIcon}>▤</span>
            <span>Documentos</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('O módulo Processos será integrado futuramente à Intranet DGT')
            }
          >
            <span className={styles.menuIcon}>⌘</span>
            <span>Processos</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('O módulo Indicadores receberá os relatórios do Power BI')
            }
          >
            <span className={styles.menuIcon}>▥</span>
            <span>Indicadores</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('O módulo RH e Pessoas será conectado posteriormente')
            }
          >
            <span className={styles.menuIcon}>♟</span>
            <span>RH e Pessoas</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('O módulo Sistemas será conectado posteriormente')
            }
          >
            <span className={styles.menuIcon}>⌁</span>
            <span>Sistemas</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('O módulo Comunicados será conectado ao SharePoint News')
            }
          >
            <span className={styles.menuIcon}>◈</span>
            <span>Comunicados</span>
          </button>

          <button
            className={styles.menuItem}
            onClick={() =>
              acaoMock('A página institucional Sobre a DGT será criada nesta área')
            }
          >
            <span className={styles.menuIcon}>?</span>
            <span>Sobre a DGT</span>
          </button>

        </nav>

        <div className={styles.sidePhrase}>
          <div />

          <p>
            “Pessoas bem treinadas constroem
            resultados extraordinários.”
          </p>
        </div>

      </aside>

      <div className={styles.mainArea}>

        <header className={styles.topbar}>

          <div className={styles.brand}>

            <div className={styles.brandLogo}>
              <img
                src={logoDgt}
                alt="DGT Tecnologia"
              />
            </div>

            <div className={styles.brandText}>
              <span>Intranet DGT</span>

              <small>
                PESSOAS • CONHECIMENTO • RESULTADOS
              </small>
            </div>

          </div>

          <div className={styles.search}>
            <span>⌕</span>

            <input
              placeholder="Pesquisar pessoas, documentos, treinamentos, processos..."
            />
          </div>

          <div className={styles.userArea}>

            <div className={styles.notification}>
              🔔
              <span>3</span>
            </div>

            <div className={styles.avatar}>

              {!erroFotoUsuario && fotoUsuario ? (
                <img
                  src={fotoUsuario}
                  alt={`Foto de ${userName}`}
                  onError={() =>
                    setErroFotoUsuario(true)
                  }
                />
              ) : (
                <span>
                  {primeiroNome
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}

            </div>

            <div className={styles.userText}>
              <strong>
                {primeiroNome}
              </strong>

              <span>
                {isGestor
                  ? 'Gestor'
                  : 'Colaborador'}
              </span>
            </div>

            <span className={styles.chevron}>
              ⌄
            </span>

          </div>

        </header>

        {paginaAtual === 'inicio' &&
          renderInicio()}

        {paginaAtual === 'treinamentos' &&
          renderTreinamentos()}

        {paginaAtual === 'documentos' &&
          renderDocumentos()}

        {paginaAtual === 'historico' &&
          renderHistorico()}

        {paginaAtual === 'certificados' &&
          renderCertificados()}

        {paginaAtual === 'suporte' &&
          renderSuporte()}

        {paginaAtual === 'gestao' &&
          renderGestao()}

        {paginaAtual === 'novoTreinamento' &&
          renderNovoTreinamento()}

        {paginaAtual === 'atribuirTreinamento' &&
          renderAtribuirTreinamento()}

        {paginaAtual === 'trilhas' &&
          renderTrilhas()}

        {paginaAtual === 'equipe' &&
          renderEquipe()}

        {paginaAtual === 'executarTreinamento' &&
          renderExecutarTreinamento()}

      </div>

    </div>
  );
};

export default PortalTreinamentos;