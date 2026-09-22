import * as React from 'react';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IDocumentoAdmin,
  INovoDocumentoCompleto
} from '../../services/DocumentoAdminService';

export interface INovoDocumentoPageProps {
  statusDocumentos:
    Array<{
      value: number;
      label: string;
    }>;

  usuarioCriador:
    string;

  areas:
    IAreaAdmin[];

  // Vínculos usuário/área (tela "Áreas e acessos"). Usado para
  // derivar o Aprovador automaticamente a partir do Gestor da
  // área selecionada — o aprovador não é mais digitado à mão.
  usuariosAreas:
    IUsuarioAreaAdmin[];

  documentosExistentes:
    IDocumentoAdmin[];

  processando:
    boolean;

  erro:
    string;

  onVoltar:
    () => void;

  onSalvar:
    (
      dados:
        INovoDocumentoCompleto
    ) => Promise<void>;
}

interface ITipoDocumento {
  sigla: string;
  nome: string;
  descricao: string;
}

const TIPOS_DOCUMENTO:
  ITipoDocumento[] = [
    { sigla: 'MAP', nome: 'Mapeamento de Processos (As IS)', descricao: 'Documento base do mapeamento macro do processo: fluxo geral, escopo e limites.' },
    { sigla: 'BPM', nome: 'Mapeamento BPM (To Be)', descricao: 'Modelagem do processo em notação BPMN.' },
    { sigla: 'LIP', nome: 'Levantamento Inicial do Processo', descricao: 'Registro do levantamento inicial realizado com o dono do processo.' },
    { sigla: 'RAC', nome: 'Matriz RACI', descricao: 'Matriz de responsabilidades: Aprovador, Aprovador, Consultado e Informado.' },
    { sigla: 'RMF', nome: 'Relatório de Mapeamento Final', descricao: 'Consolidação final do mapeamento, pronta para validação do dono do processo.' },
    { sigla: 'DDN', nome: 'Descrição de Negócios', descricao: 'Descrição do contexto de negócio em que o processo está inserido.' },
    { sigla: 'DPC', nome: 'Definição dos Processos Críticos', descricao: 'Identificação e justificativa dos processos críticos da área.' },
    { sigla: 'TOR', nome: 'Termo de Referência de Reunião', descricao: 'Registro formal de pauta, participantes e decisões da reunião de mapeamento.' },
    { sigla: 'PDA', nome: 'Plano de Ação', descricao: 'Plano de ação corretiva ou de melhoria, por exemplo 5W2H.' },
    { sigla: 'PIV', nome: 'Priorização de ICs e IVs', descricao: 'Priorização de indicadores críticos e indicadores de valor.' },
    { sigla: 'AES', nome: 'Acompanhamento da Estratégia', descricao: 'Painel de acompanhamento dos objetivos e metas estratégicas.' },
    { sigla: 'POP', nome: 'Procedimento Operacional Padrão', descricao: 'Passo a passo padronizado de execução de um processo.' },
    { sigla: 'RNC', nome: 'Relatório de Não Conformidade', descricao: 'Registro de não conformidades identificadas em auditoria de processos.' },
    { sigla: 'FAC', nome: 'Ferramentas de Análise de Causa', descricao: 'Aplicação de ferramentas de análise de causa raiz.' },
    { sigla: 'PDC', nome: 'Controle de Ciclos de Melhoria', descricao: 'Acompanhamento de ciclos PDCA de melhoria contínua.' },
    { sigla: 'MNS', nome: 'Manual de Nomenclatura e Simbologia', descricao: 'Define regras de nomenclatura, áreas, tipos de documento e pastas de processo.' },
    { sigla: 'LMP', nome: 'Lista Mestra de Processos', descricao: 'Controla sequenciais, nomes de processos e respectivas pastas.' },
    { sigla: 'LMD', nome: 'Lista Mestra de Documentos', descricao: 'Controla sequencial, revisão e status dos documentos controlados.' },
    { sigla: 'LD', nome: 'Lista de Documentos do Processo', descricao: 'Relação consolidada dos documentos produzidos em cada processo.' }
  ];

const C = {
  azul: '#0B67D1',
  azulEscuro: '#0A2845',
  texto: '#28445F',
  secundario: '#61788E',
  borda: '#D8E2EC',
  branco: '#FFFFFF',
  verde: '#067647',
  verdeClaro: '#ECFDF3',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9'
};

const input:
  React.CSSProperties = {
    width: '100%',
    minHeight: '42px',
    padding: '10px 12px',
    boxSizing: 'border-box',
    border: `1px solid ${C.borda}`,
    borderRadius: '8px',
    background: C.branco,
    color: C.azulEscuro,
    fontSize: '13px'
  };

const inputSomenteLeitura:
  React.CSSProperties = {
    ...input,
    background: '#F3F6F9',
    cursor: 'not-allowed',
    fontWeight: 700
  };

const label:
  React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    color: C.texto,
    fontWeight: 700,
    fontSize: '12px'
  };

const normalizarSigla = (
  valor: string
): string =>
  valor
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ''
    );

const formatarSequencial = (
  numero: number
): string =>
  (
    '000' +
    String(
      numero
    )
  ).slice(
    -3
  );

const gerarProximoCodigo = (
  siglaArea: string,
  siglaTipo: string,
  documentos:
    IDocumentoAdmin[]
): string => {
  const area =
    normalizarSigla(
      siglaArea
    );

  const tipo =
    normalizarSigla(
      siglaTipo
    );

  if (
    !area ||
    !tipo
  ) {
    return '';
  }

  const prefixo =
    `${area}-${tipo}-`;

  let maiorSequencial =
    0;

  documentos.forEach(
    documento => {
      const codigo =
        String(
          documento.codigo ||
          ''
        )
          .trim()
          .toUpperCase();

      if (
        !codigo.startsWith(
          prefixo
        )
      ) {
        return;
      }

      const trecho =
        codigo.substring(
          prefixo.length
        );

      if (
        !/^\d+$/.test(
          trecho
        )
      ) {
        return;
      }

      const numero =
        Number(
          trecho
        );

      if (
        Number.isFinite(
          numero
        ) &&
        numero >
          maiorSequencial
      ) {
        maiorSequencial =
          numero;
      }
    }
  );

  return (
    prefixo +
    formatarSequencial(
      maiorSequencial + 1
    )
  );
};

const gerarCodigoPreview = (
  siglaArea:
    string | undefined,

  siglaTipo:
    string | undefined
): string => {
  const area =
    normalizarSigla(
      siglaArea || ''
    ) || 'SETOR';

  const tipo =
    normalizarSigla(
      siglaTipo || ''
    ) || 'TIPO';

  return (
    area +
    '-' +
    tipo +
    '-' +
    formatarSequencial(
      1
    )
  );
};

const NovoDocumentoPage:
  React.FC<
    INovoDocumentoPageProps
  > = (
    props
  ) => {

    const areasDisponiveis =
      React.useMemo(
        () =>
          props.areas
            .filter(
              item =>
                item.ativa
            )
            .sort(
              (a, b) =>
                a.nome.localeCompare(
                  b.nome,
                  'pt-BR'
                )
            ),
        [
          props.areas
        ]
      );

    const [
      titulo,
      setTitulo
    ] =
      React.useState('');

    const [
      descricao,
      setDescricao
    ] =
      React.useState('');

    const [
      tipo,
      setTipo
    ] =
      React.useState(
        'MAP'
      );

    const [
      areaId,
      setAreaId
    ] =
      React.useState('');

    // O aprovador deixou de ser texto livre: agora é sempre o
    // Gestor cadastrado para a área selecionada, em
    // "Áreas e acessos" (vínculo usuário/área com perfil "Gestor").
    const [
      aprovadorEscolhidoId,
      setAprovadorEscolhidoId
    ] =
      React.useState('');

    const [
      revisaoInicial,
      setRevisaoInicial
    ] =
      React.useState(
        'Rev.00'
      );

    // O status inicial NUNCA é escolhido pelo usuário: todo documento
    // novo nasce "Em elaboração" e só chega a "Vigente" passando pelo
    // fluxo de revisão/aprovação do Gestor da área (DocumentoWorkflowCard).
    // Isso evita que alguém cadastre um documento já como Aprovação/Vigente.
    const [
      status,
      setStatus
    ] =
      React.useState(
        'Em elaboração'
      );

    React.useEffect(
      () => {

        if (
          props.statusDocumentos.length === 0
        ) {
          return;
        }

        const opcaoElaboracao =
          props.statusDocumentos.find(
            item =>
              item.label
                .toLowerCase()
                .indexOf('elabora') >= 0
          );

        setStatus(
          opcaoElaboracao?.label ||
          props.statusDocumentos[0].label
        );
      },
      [
        props.statusDocumentos
      ]
    );
    const [
      arquivo,
      setArquivo
    ] =
      React.useState<
        File | undefined
      >(
        undefined
      );

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    // Aviso mostrado antes de gravar: reforça que o documento não
    // nasce Vigente — ele vai para validação do Gestor da área.
    const [
      mostrarAvisoValidacao,
      setMostrarAvisoValidacao
    ] =
      React.useState(false);

    const areaSelecionada =
      React.useMemo(
        () =>
          areasDisponiveis.find(
            item =>
              item.id ===
              areaId
          ),
        [
          areaId,
          areasDisponiveis
        ]
      );

    const tipoSelecionado =
      React.useMemo(
        () =>
          TIPOS_DOCUMENTO.find(
            item =>
              item.sigla ===
              tipo
          ),
        [
          tipo
        ]
      );

    // Gestores ativos vinculados à área selecionada — são os únicos
    // elegíveis a aprovador. Definidos em "Áreas e acessos".
    const gestoresDaArea =
      React.useMemo(
        () =>
          props.usuariosAreas.filter(
            vinculo =>
              vinculo.areaId === areaId &&
              vinculo.perfil === 'Gestor' &&
              vinculo.ativo
          ),
        [
          props.usuariosAreas,
          areaId
        ]
      );

    // Ao trocar de área, o gestor escolhido anteriormente não vale mais.
    React.useEffect(
      () => {
        setAprovadorEscolhidoId('');
      },
      [
        areaId
      ]
    );

    const aprovadorSelecionado =
      React.useMemo(
        () => {
          if (
            gestoresDaArea.length === 1
          ) {
            return gestoresDaArea[0];
          }

          return gestoresDaArea.find(
            vinculo =>
              vinculo.usuarioId === aprovadorEscolhidoId
          );
        },
        [
          gestoresDaArea,
          aprovadorEscolhidoId
        ]
      );

    const codigoGerado =
      React.useMemo(
        () => {
          if (
            !areaSelecionada
          ) {
            return '';
          }

          return gerarProximoCodigo(
            areaSelecionada.sigla ||
              '',
            tipo,
            props.documentosExistentes
          );
        },
        [
          areaSelecionada,
          tipo,
          props.documentosExistentes
        ]
      );

    const codigoExibicao =
      React.useMemo(
        () => {
          if (
            codigoGerado
          ) {
            return codigoGerado;
          }

          return gerarCodigoPreview(
            areaSelecionada?.sigla,
            tipo
          );
        },
        [
          areaSelecionada,
          tipo,
          codigoGerado
        ]
      );

    const salvar =
      async (): Promise<void> => {
        setErroLocal('');

        if (
          !areaSelecionada
        ) {
          setErroLocal(
            'Selecione uma área cadastrada no sistema.'
          );

          return;
        }

        if (
          !codigoGerado
        ) {
          setErroLocal(
            'Não foi possível gerar o código do documento. Verifique a sigla da área.'
          );

          return;
        }

        if (
          !titulo.trim()
        ) {
          setErroLocal(
            'Informe o título do documento.'
          );

          return;
        }

        if (
          !tipo.trim()
        ) {
          setErroLocal(
            'Selecione o tipo do documento.'
          );

          return;
        }

        if (
          !arquivo
        ) {
          setErroLocal(
            'Selecione o arquivo do documento.'
          );

          return;
        }

        if (
          !aprovadorSelecionado
        ) {
          setErroLocal(
            gestoresDaArea.length === 0
              ? `A área "${areaSelecionada.nome}" não possui um Gestor definido. Cadastre um Gestor em "Áreas e acessos" antes de criar o documento.`
              : 'Selecione o Gestor responsável pela aprovação.'
          );

          return;
        }

        try {
          await props
            .onSalvar({
              codigo:
                codigoGerado,
              titulo:
                titulo.trim(),
              descricao:
                descricao.trim(),
              tipo,
              area:
                areaSelecionada.nome,
              responsavel:
                aprovadorSelecionado.usuarioEmail ||
                aprovadorSelecionado.usuarioNome,
              revisaoInicial:
                revisaoInicial.trim() ||
                'Rev.00',
              status,
              ativo:
                true,
              arquivo:
                arquivo as File
            });
        } catch (e) {

          // Volta para o formulário (não o aviso) para que o erro
          // fique visível junto dos campos.
          setMostrarAvisoValidacao(
            false
          );

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Não foi possível criar o documento.'
          );
        }
      };

    return (
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: C.azulEscuro,
                fontSize: '28px'
              }}
            >
              Novo documento
            </h1>

            <p
              style={{
                margin: '5px 0 0',
                color: C.secundario
              }}
            >
              Cadastre os dados principais e selecione o arquivo inicial do documento.
            </p>
          </div>

          <button
            type="button"
            onClick={
              props.onVoltar
            }
            style={{
              padding: '9px 14px',
              border: `1px solid ${C.azul}`,
              borderRadius: '8px',
              background: C.branco,
              color: C.azul,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ← Voltar
          </button>
        </div>

        {
          (
            props.erro ||
            erroLocal
          ) &&
          (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: C.vermelhoClaro,
                color: C.vermelho
              }}
            >
              {
                erroLocal ||
                props.erro
              }
            </div>
          )
        }

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0,1fr) 340px',
            gap: '18px',
            marginTop: '18px',
            alignItems: 'start'
          }}
        >
          <div
            style={{
              padding: '20px',
              border: `1px solid ${C.borda}`,
              borderRadius: '14px',
              background: C.branco
            }}
          >
            <h2
              style={{
                margin: '0 0 18px',
                color: C.azulEscuro,
                fontSize: '18px'
              }}
            >
              Dados do documento
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '180px minmax(0,1fr)',
                gap: '14px'
              }}
            >
              <div>
                <label style={label}>
                  Código
                </label>

                <input
                  value={
                    codigoExibicao
                  }
                  readOnly
                  aria-readonly="true"
                  style={
                    inputSomenteLeitura
                  }
                />

                <div
                  style={{
                    marginTop: '5px',
                    color: C.secundario,
                    fontSize: '11px',
                    lineHeight: 1.45
                  }}
                >
                  {
                    areaSelecionada
                      ? 'Código gerado automaticamente e atualizado conforme a área e o tipo selecionados.'
                      : 'Pré-visualização do código. Selecione a área para gerar o código final.'
                  }
                </div>
              </div>

              <div>
                <label style={label}>
                  Título *
                </label>

                <input
                  value={
                    titulo
                  }
                  placeholder="Ex.: Operação segura de equipamentos"
                  onChange={
                    event =>
                      setTitulo(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3,minmax(150px,1fr))',
                gap: '14px',
                marginTop: '14px'
              }}
            >
              <div>
                <label style={label}>
                  Tipo de documento *
                </label>

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
                    input
                  }
                >
                  {
                    TIPOS_DOCUMENTO.map(
                      item => (
                        <option
                          key={
                            item.sigla
                          }
                          value={
                            item.sigla
                          }
                        >
                          {
                            `${item.sigla} — ${item.nome}`
                          }
                        </option>
                      )
                    )
                  }
                </select>

                {
                  tipoSelecionado &&
                  (
                    <div
                      style={{
                        marginTop: '5px',
                        color: C.secundario,
                        fontSize: '11px',
                        lineHeight: 1.4
                      }}
                    >
                      {
                        tipoSelecionado.descricao
                      }
                    </div>
                  )
                }
              </div>

              <div>
                <label style={label}>
                  Área *
                </label>

                <select
                  value={
                    areaId
                  }
                  onChange={
                    event =>
                      setAreaId(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                >
                  <option value="">
                    Selecione uma área
                  </option>

                  {
                    areasDisponiveis.map(
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
                            item.sigla
                              ? `${item.sigla} — ${item.nome}`
                              : item.nome
                          }
                        </option>
                      )
                    )
                  }
                </select>

                {
                  areasDisponiveis.length ===
                    0 &&
                  (
                    <div
                      style={{
                        marginTop: '5px',
                        color: C.vermelho,
                        fontSize: '11px'
                      }}
                    >
                      Nenhuma área ativa foi encontrada no cadastro.
                    </div>
                  )
                }
              </div>

              <div>
                <label style={label}>
                  Aprovador
                </label>

                {
                  // Sem área selecionada ainda: nada a mostrar.
                  !areaId && (
                    <input
                      value=""
                      placeholder="Selecione a área primeiro"
                      readOnly
                      disabled
                      style={
                        inputSomenteLeitura
                      }
                    />
                  )
                }

                {
                  // Área sem Gestor cadastrado: bloqueia com orientação
                  // clara, em vez de deixar digitar um nome qualquer.
                  areaId &&
                  gestoresDaArea.length === 0 && (
                    <>
                      <input
                        value="Nenhum Gestor definido para esta área"
                        readOnly
                        disabled
                        style={{
                          ...inputSomenteLeitura,
                          color: C.vermelho,
                          background: C.vermelhoClaro
                        }}
                      />
                      <div
                        style={{
                          marginTop: '5px',
                          color: C.vermelho,
                          fontSize: '11px',
                          lineHeight: 1.4
                        }}
                      >
                        Cadastre um Gestor para esta área em
                        {' '}
                        <strong>Gestão → Áreas e acessos</strong>
                        {' '}
                        (perfil &quot;Gestor&quot;) antes de criar o documento.
                      </div>
                    </>
                  )
                }

                {
                  // Exatamente um Gestor: preenchido automaticamente,
                  // sem edição — é sempre o responsável pela área/processo.
                  areaId &&
                  gestoresDaArea.length === 1 && (
                    <>
                      <input
                        value={
                          `${gestoresDaArea[0].usuarioNome} — ${gestoresDaArea[0].usuarioEmail}`
                        }
                        readOnly
                        aria-readonly="true"
                        style={
                          inputSomenteLeitura
                        }
                      />
                      <div
                        style={{
                          marginTop: '5px',
                          color: C.secundario,
                          fontSize: '11px',
                          lineHeight: 1.4
                        }}
                      >
                        Definido automaticamente: é o Gestor cadastrado
                        para esta área.
                      </div>
                    </>
                  )
                }

                {
                  // Mais de um Gestor ativo na área: escolha entre eles
                  // (nunca texto livre — continua restrito aos Gestores).
                  areaId &&
                  gestoresDaArea.length > 1 && (
                    <>
                      <select
                        value={
                          aprovadorEscolhidoId
                        }
                        onChange={
                          event =>
                            setAprovadorEscolhidoId(
                              event.target.value
                            )
                        }
                        style={
                          input
                        }
                      >
                        <option value="">
                          Selecione o Gestor responsável
                        </option>

                        {
                          gestoresDaArea.map(
                            vinculo => (
                              <option
                                key={
                                  vinculo.usuarioId
                                }
                                value={
                                  vinculo.usuarioId
                                }
                              >
                                {
                                  `${vinculo.usuarioNome} — ${vinculo.usuarioEmail}`
                                }
                              </option>
                            )
                          )
                        }
                      </select>

                      <div
                        style={{
                          marginTop: '5px',
                          color: C.secundario,
                          fontSize: '11px',
                          lineHeight: 1.4
                        }}
                      >
                        Esta área tem mais de um Gestor cadastrado;
                        selecione quem vai aprovar este documento.
                      </div>
                    </>
                  )
                }
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '180px 220px 1fr',
                gap: '14px',
                marginTop: '14px'
              }}
            >
              <div>
                <label style={label}>
                  Revisão inicial
                </label>

                <input
                  value={
                    revisaoInicial
                  }
                  onChange={
                    event =>
                      setRevisaoInicial(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                />
              </div>

              <div>
                <label style={label}>
                  Status
                </label>

                <input
                  value={
                    status ||
                    'Em elaboração'
                  }
                  readOnly
                  aria-readonly="true"
                  style={
                    inputSomenteLeitura
                  }
                />

                <div
                  style={{
                    marginTop: '5px',
                    color: C.secundario,
                    fontSize: '11px',
                    lineHeight: 1.4
                  }}
                >
                  Todo documento nasce &quot;Em elaboração&quot;. Ele só se
                  torna <strong>Vigente</strong> depois de passar pelo fluxo
                  de revisão e ser aprovado pelo Gestor da área.
                </div>
              </div>

              <div
                style={{
                  marginTop: '22px',
                  minHeight: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  background: C.verdeClaro,
                  color: C.verde,
                  fontWeight: 700
                }}
              >
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                />
                Documento ativo
              </div>
            </div>

            <div
              style={{
                marginTop: '14px'
              }}
            >
              <label style={label}>
                Criado por
              </label>

              <input
                value={
                  props.usuarioCriador ||
                  'Usuário atual'
                }
                readOnly
                aria-readonly="true"
                style={
                  inputSomenteLeitura
                }
              />

              <div
                style={{
                  marginTop: '5px',
                  color: C.secundario,
                  fontSize: '11px',
                  lineHeight: 1.45
                }}
              >
                O criador é definido automaticamente pelo usuário autenticado que cadastrar o documento.
              </div>
            </div>

            <div
              style={{
                marginTop: '14px'
              }}
            >
              <label style={label}>
                Descrição
              </label>

              <textarea
                rows={
                  5
                }
                value={
                  descricao
                }
                placeholder="Descreva o objetivo, aplicação e observações do documento."
                onChange={
                  event =>
                    setDescricao(
                      event.target.value
                    )
                }
                style={{
                  ...input,
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          <aside
            style={{
              display: 'grid',
              gap: '14px'
            }}
          >
            <div
              style={{
                padding: '18px',
                border: `1px solid ${C.borda}`,
                borderRadius: '14px',
                background: C.branco
              }}
            >
              <h2
                style={{
                  margin: '0 0 5px',
                  color: C.azulEscuro,
                  fontSize: '17px'
                }}
              >
                Arquivo do documento
              </h2>

              <p
                style={{
                  margin: '0 0 14px',
                  color: C.secundario,
                  fontSize: '12px',
                  lineHeight: 1.45
                }}
              >
                Selecione o arquivo correspondente à primeira revisão.
              </p>

              <label
                style={{
                  minHeight: '150px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '18px',
                  border: '2px dashed #B9C9D8',
                  borderRadius: '12px',
                  background: '#F8FBFE',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    fontSize: '34px'
                  }}
                >
                  📤
                </span>

                <strong
                  style={{
                    marginTop: '9px',
                    color: C.azul
                  }}
                >
                  Selecionar arquivo
                </strong>

                <span
                  style={{
                    marginTop: '4px',
                    color: C.secundario,
                    fontSize: '11px'
                  }}
                >
                  PDF, DOCX, XLSX, PPTX ou arquivo compatível
                </span>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  style={{
                    display: 'none'
                  }}
                  onChange={
                    event => {
                      const item =
                        event.target.files &&
                        event.target.files[
                          0
                        ];

                      setArquivo(
                        item ||
                        undefined
                      );
                    }
                  }
                />
              </label>

              {
                arquivo &&
                (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#EEF6FF',
                      color: C.texto,
                      fontSize: '12px'
                    }}
                  >
                    <strong>
                      {
                        arquivo.name
                      }
                    </strong>
                  </div>
                )
              }
            </div>

            <div
              style={{
                padding: '18px',
                border: `1px solid ${C.borda}`,
                borderRadius: '14px',
                background: C.branco
              }}
            >
              <div
                style={{
                  color: C.secundario,
                  fontSize: '12px',
                  lineHeight: 1.55
                }}
              >
                O código é exibido em tempo real enquanto você seleciona o tipo e a área. Ao concluir a seleção da área, o sistema calcula o próximo sequencial disponível.
              </div>

              <button
                type="button"
                disabled={
                  props.processando ||
                  !areaSelecionada ||
                  !codigoGerado ||
                  !titulo.trim() ||
                  !arquivo ||
                  !aprovadorSelecionado
                }
                onClick={
                  () =>
                    setMostrarAvisoValidacao(
                      true
                    )
                }
                style={{
                  width: '100%',
                  marginTop: '16px',
                  minHeight: '44px',
                  border: 0,
                  borderRadius: '8px',
                  background:
                    props.processando
                      ? '#97BCE7'
                      : C.azul,
                  color: C.branco,
                  fontWeight: 700,
                  cursor:
                    props.processando
                      ? 'wait'
                      : 'pointer'
                }}
              >
                {
                  props.processando
                    ? 'Salvando...'
                    : 'Criar documento'
                }
              </button>
            </div>
          </aside>
        </div>

        {
          mostrarAvisoValidacao &&
          aprovadorSelecionado &&
          (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'rgba(15,23,42,.55)'
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '420px',
                  padding: '24px',
                  background: C.branco,
                  borderRadius: '16px'
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                    background: '#FFF4E5',
                    fontSize: '22px'
                  }}
                >
                  ⚠
                </div>

                <h2
                  style={{
                    margin: '0 0 8px',
                    color: C.azulEscuro,
                    fontSize: '18px'
                  }}
                >
                  Este documento irá para validação do Gestor!
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: C.secundario,
                    fontSize: '13px',
                    lineHeight: 1.5
                  }}
                >
                  Ele será criado como <strong>Em elaboração</strong> e só
                  se torna <strong>Vigente</strong> depois de ser revisado
                  e aprovado por{' '}
                  <strong>
                    {aprovadorSelecionado.usuarioNome}
                  </strong>
                  , Gestor da área {areaSelecionada?.nome}.
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '22px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setMostrarAvisoValidacao(false)
                    }
                    style={{
                      padding: '10px 16px',
                      border: `1px solid ${C.borda}`,
                      borderRadius: '8px',
                      background: C.branco,
                      color: C.texto,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {
                      salvar()
                        .catch(
                          () => undefined
                        );
                    }}
                    style={{
                      padding: '10px 16px',
                      border: 0,
                      borderRadius: '8px',
                      background:
                        props.processando
                          ? '#97BCE7'
                          : C.azul,
                      color: C.branco,
                      fontWeight: 700,
                      cursor:
                        props.processando
                          ? 'wait'
                          : 'pointer'
                    }}
                  >
                    {
                      props.processando
                        ? 'Enviando...'
                        : 'Confirmar e enviar'
                    }
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </section>
    );
  };

export default NovoDocumentoPage;