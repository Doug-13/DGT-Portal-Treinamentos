import * as React from 'react';

import {
  IDocumento,
  IDocumentoEvento,
  IDocumentoRevisao
} from '../../models/Documento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IPublicarRevisao,
  IResultadoPublicacaoRevisao
} from '../../services/RevisaoDocumentoAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  SharePointDocumentoService
} from '../../services/sharepoint/SharePointDocumentoService';

import {
  calcularProximaRevisao,
  estagioRevisao,
  obterRevisaoEmAndamento,
  obterRevisaoVigente
} from '../../services/DocumentoRevisaoFluxoService';

import {
  useDocumentoRevisaoFluxo
} from '../../hooks/useDocumentoRevisaoFluxo';

import PublicarRevisaoModal from
  '../Gestao/PublicarRevisaoModal';

import ResultadoPublicacaoRevisaoCard from
  '../Gestao/ResultadoPublicacaoRevisaoCard';

import RevisaoEditorModal, {
  IRevisaoEditorDados
} from './RevisaoEditorModal';

import DocumentoHistoricoTab from
  './DocumentoHistoricoTab';

import PreviaDocumentoModal from
  './PreviaDocumentoModal';

import {
  urlParaAbrir
} from './DocumentosTabelaCelulas';

import AcoesFluxoRevisao from
  './AcoesFluxoRevisao';

export interface IDocumentoDetalhePageProps {
  documento?: IDocumento;

  revisoes:
    IDocumentoRevisao[];

  carregando:
    boolean;

  erro:
    string;

  // Usados para o fluxo de aprovação: só o Gestor da área do
  // documento (ou um Administrador) pode aprovar e publicar.
  contexto?:
    IContextoAcesso;

  usuariosAreas:
    IUsuarioAreaAdmin[];

  processando:
    boolean;

  // Serviços para criar/editar revisões e gravar o histórico. Se não
  // forem informados, a tela funciona como antes (só leitura + fluxo
  // básico pelos callbacks abaixo).
  dataverseService?:
    DataverseService;

  sharePointDocumentoService?:
    SharePointDocumentoService;

  onRecarregarRevisoes?:
    () => Promise<void>;

  // Mantido por compatibilidade — a etapa "Revisão" não existe mais.
  onEnviarRevisao:
    (
      revisao:
        IDocumentoRevisao
    ) => Promise<void>;

  onEnviarAprovacao:
    (
      revisao:
        IDocumentoRevisao
    ) => Promise<void>;

  onDevolverElaboracao:
    (
      revisao:
        IDocumentoRevisao
    ) => Promise<void>;

  processandoPublicacao:
    boolean;

  erroPublicacao:
    string;

  resultadoPublicacao?:
    IResultadoPublicacaoRevisao;

  onPublicarRevisao:
    (
      dados:
        IPublicarRevisao
    ) => Promise<IResultadoPublicacaoRevisao>;

  onLimparResultadoPublicacao:
    () => void;

  onVoltar:
    () => void;
}

// ============================================================
// IDENTIDADE VISUAL
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';

// ============================================================
// UTILITÁRIOS
// ============================================================

const formatarData = (
  valor?: string
): string => {

  if (!valor) {
    return '-';
  }

  // Colunas "Somente data" vêm como "AAAA-MM-DD". new Date() lê isso
  // como meia-noite UTC, que no Brasil vira o dia ANTERIOR. Formata
  // direto do texto para não deslocar a data.
  const somenteData =
    valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (somenteData) {
    return `${somenteData[3]}/${somenteData[2]}/${somenteData[1]}`;
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return valor;
  }

  return data.toLocaleDateString(
    'pt-BR'
  );
};

const numeroRevisaoTela = (
  revisao: string
): number => {

  const encontrado =
    (revisao || '').match(/(\d+)(?!.*\d)/);

  return encontrado
    ? Number(encontrado[1])
    : -1;
};

const valorOuTraco = (
  valor?: string
): string =>
  valor && valor.trim() && valor.trim() !== '-'
    ? valor
    : '-';

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

const Card:
  React.FC<{
    titulo: string;
    valor: string;
    destaque?: boolean;
  }> = ({
    titulo,
    valor,
    destaque
  }) => (

    <div
      style={{
        background: '#ffffff',
        border: destaque
          ? `1px solid ${COR_CIANO}`
          : '1px solid #e5e7eb',
        borderLeft: destaque
          ? `4px solid ${COR_CIANO}`
          : '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px'
      }}
    >
      <span
        style={{
          display: 'block',
          color: '#64748b',
          fontSize: '12px'
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          display: 'block',
          marginTop: '5px',
          color: '#0b1f3a'
        }}
      >
        {valor}
      </strong>
    </div>
  );

const Informacao:
  React.FC<{
    titulo: string;
    valor: string;
  }> = ({
    titulo,
    valor
  }) => (

    <div>
      <span
        style={{
          display: 'block',
          color: '#64748b',
          fontSize: '12px'
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          display: 'block',
          marginTop: '3px',
          color: '#334155',
          fontSize: '13px'
        }}
      >
        {valor}
      </strong>
    </div>
  );

const BlocoTexto:
  React.FC<{
    titulo: string;
    texto: string;
  }> = ({
    titulo,
    texto
  }) => (

    <div
      style={{
        marginTop: '16px'
      }}
    >
      <strong
        style={{
          display: 'block',
          color: '#334155',
          fontSize: '13px'
        }}
      >
        {titulo}
      </strong>

      <p
        style={{
          margin: '5px 0 0',
          color: '#64748b',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap'
        }}
      >
        {texto}
      </p>
    </div>
  );

// Selo de status exibido no canto de cada revisão.
const seloStatus = (
  revisao: IDocumentoRevisao,
  vigenteAtualId: string
): { texto: string; cor: string; fundo: string } => {

  const estagio =
    estagioRevisao(revisao.status);

  if (estagio === 'vigente') {
    return revisao.id === vigenteAtualId
      ? { texto: 'Vigente', cor: '#107C10', fundo: '#E7F6EC' }
      : { texto: 'Obsoleta', cor: '#B42318', fundo: '#FDE7E9' };
  }

  if (estagio === 'aprovacao') {
    return { texto: 'Aguardando aprovação', cor: '#B45309', fundo: '#FFF4E5' };
  }

  if (estagio === 'revisao') {
    return { texto: 'Revisão (legado)', cor: '#0F6CBD', fundo: '#E8F2FF' };
  }

  return { texto: 'Em elaboração', cor: COR_INDIGO, fundo: '#E8EAF8' };
};

// Último evento de reprovação desta revisão, se ele for o evento de
// fluxo mais recente (ou seja, a revisão ainda não foi reenviada).
const obterReprovacaoPendente = (
  revisao: IDocumentoRevisao,
  eventos: IDocumentoEvento[]
): IDocumentoEvento | undefined => {

  const doFluxo =
    eventos.filter(
      evento =>
        evento.revisaoId === revisao.id &&
        (
          evento.tipo === 'REPROVADA' ||
          evento.tipo === 'ENVIADA_APROVACAO'
        )
    );

  // eventos já vêm do mais recente para o mais antigo
  return doFluxo.length > 0 &&
    doFluxo[0].tipo === 'REPROVADA'
    ? doFluxo[0]
    : undefined;
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

type Aba = 'revisoes' | 'historico';

const DocumentoDetalhePage:
  React.FC<IDocumentoDetalhePageProps> = ({

    documento,
    revisoes,
    carregando,
    erro,
    contexto,
    usuariosAreas,
    processando,
    dataverseService,
    sharePointDocumentoService,
    onRecarregarRevisoes,
    onEnviarAprovacao,
    onDevolverElaboracao,
    processandoPublicacao,
    erroPublicacao,
    resultadoPublicacao,
    onPublicarRevisao,
    onLimparResultadoPublicacao,
    onVoltar

  }) => {

    const [aba, setAba] =
      React.useState<Aba>('revisoes');

    const [
      revisaoParaPublicar,
      setRevisaoParaPublicar
    ] =
      React.useState<
        IDocumentoRevisao | undefined
      >(undefined);

    const [
      revisaoParaReprovar,
      setRevisaoParaReprovar
    ] =
      React.useState<
        IDocumentoRevisao | undefined
      >(undefined);

    const [
      motivoReprovacao,
      setMotivoReprovacao
    ] =
      React.useState('');

    const [
      editor,
      setEditor
    ] =
      React.useState<
        | { modo: 'criar' }
        | { modo: 'editar'; revisao: IDocumentoRevisao }
        | undefined
      >(undefined);

    const [
      erroLegado,
      setErroLegado
    ] =
      React.useState('');

    // Revisão cujo arquivo está sendo pré-visualizado.
    const [
      revisaoEmPrevia,
      setRevisaoEmPrevia
    ] =
      React.useState<
        IDocumentoRevisao | undefined
      >(undefined);

    const fecharPrevia =
      React.useCallback(
        () => setRevisaoEmPrevia(undefined),
        []
      );

    const usuarioFluxo =
      React.useMemo(
        () => ({
          id: contexto?.usuarioId || '',
          nome: contexto?.nome || contexto?.email || ''
        }),
        [
          contexto
        ]
      );

    const recarregar =
      React.useCallback(
        async (): Promise<void> => {
          if (onRecarregarRevisoes) {
            await onRecarregarRevisoes();
          }
        },
        [
          onRecarregarRevisoes
        ]
      );

    const fluxo =
      useDocumentoRevisaoFluxo(
        dataverseService,
        sharePointDocumentoService,
        documento,
        revisoes,
        usuarioFluxo,
        recarregar
      );

    const fluxoDisponivel =
      !!dataverseService &&
      !!sharePointDocumentoService;

    const ocupado =
      processando ||
      fluxo.processando;

    // Gestores ativos da área deste documento — são os únicos que
    // podem aprovar e publicar, além de um Administrador.
    const gestoresDaArea =
      React.useMemo(
        () => {

          if (
            !documento?.areaId
          ) {
            return [];
          }

          return usuariosAreas.filter(
            vinculo =>
              vinculo.areaId === documento.areaId &&
              vinculo.perfil === 'Gestor' &&
              vinculo.ativo
          );
        },
        [
          documento,
          usuariosAreas
        ]
      );

    const podeAprovar =
      React.useMemo(
        () => {

          if (
            contexto?.perfil === 'Administrador'
          ) {
            return true;
          }

          const email =
            (contexto?.email || '')
              .trim()
              .toLowerCase();

          if (
            !email
          ) {
            return false;
          }

          return gestoresDaArea.some(
            vinculo =>
              vinculo.usuarioEmail
                .trim()
                .toLowerCase() === email
          );
        },
        [
          contexto,
          gestoresDaArea
        ]
      );

    // Quem pode abrir e editar revisões: quem gerencia documentos,
    // quem aprova na área, ou o responsável pelo documento.
    const podeEditar =
      React.useMemo(
        () => {

          if (!contexto) {
            return false;
          }

          if (
            contexto.podeGerenciarDocumentos ||
            podeAprovar
          ) {
            return true;
          }

          const responsavel =
            (documento?.responsavelId || '')
              .replace(/[{}]/g, '')
              .toLowerCase();

          const usuario =
            (contexto.usuarioId || '')
              .replace(/[{}]/g, '')
              .toLowerCase();

          return !!responsavel && responsavel === usuario;
        },
        [
          contexto,
          podeAprovar,
          documento
        ]
      );

    const revisaoVigente =
      React.useMemo(
        () => obterRevisaoVigente(revisoes),
        [revisoes]
      );

    const revisaoEmAndamento =
      React.useMemo(
        () => obterRevisaoEmAndamento(revisoes),
        [revisoes]
      );

    const proximaRevisao =
      React.useMemo(
        () => calcularProximaRevisao(revisoes),
        [revisoes]
      );

    // ==========================================================
    // REVISÃO EXIBIDA (lista suspensa)
    // Mostra uma revisão por vez. Padrão: a vigente. As anteriores
    // podem ser consultadas, mas aparecem com a tarja de OBSOLETA.
    // ==========================================================

    const [
      revisaoSelecionadaId,
      setRevisaoSelecionadaId
    ] =
      React.useState('');

    // Depois de criar uma nova revisão, seleciona ela automaticamente
    // assim que a lista for recarregada.
    const selecionarEmAndamentoAoRecarregar =
      React.useRef(false);

    React.useEffect(
      () => {

        if (
          selecionarEmAndamentoAoRecarregar.current &&
          revisaoEmAndamento
        ) {
          selecionarEmAndamentoAoRecarregar.current = false;
          setRevisaoSelecionadaId(revisaoEmAndamento.id);
          return;
        }

        const existe =
          revisoes.some(
            revisao => revisao.id === revisaoSelecionadaId
          );

        if (!existe) {
          setRevisaoSelecionadaId(
            revisaoVigente?.id ||
            revisaoEmAndamento?.id ||
            (revisoes.length > 0 ? revisoes[0].id : '')
          );
        }
      },
      [
        revisoes,
        revisaoVigente,
        revisaoEmAndamento,
        revisaoSelecionadaId
      ]
    );

    // Voltou para outro documento → recomeça pela vigente.
    React.useEffect(
      () => {
        setRevisaoSelecionadaId('');
      },
      [
        documento?.id
      ]
    );

    const revisaoExibida =
      revisoes.find(
        revisao => revisao.id === revisaoSelecionadaId
      ) ||
      revisaoVigente ||
      revisaoEmAndamento ||
      revisoes[0];

    // Revisão vigente que tornou esta obsoleta: a vigente de menor
    // número acima dela.
    const obterSubstituta = (
      revisao: IDocumentoRevisao
    ): IDocumentoRevisao | undefined =>
      revisoes
        .filter(
          item =>
            estagioRevisao(item.status) === 'vigente' &&
            numeroRevisaoTela(item.revisao) > numeroRevisaoTela(revisao.revisao)
        )
        .sort(
          (a, b) =>
            numeroRevisaoTela(a.revisao) -
            numeroRevisaoTela(b.revisao)
        )[0];

    // ==========================================================
    // AÇÕES
    // ==========================================================

    const salvarEditor =
      async (
        dados: IRevisaoEditorDados
      ): Promise<boolean> => {

        if (!editor) {
          return false;
        }

        const ok =
          editor.modo === 'criar'
            ? await fluxo.criarNovaRevisao(dados)
            : await fluxo.editarRevisao(
              editor.revisao,
              dados
            );

        if (ok) {
          if (editor.modo === 'criar') {
            selecionarEmAndamentoAoRecarregar.current = true;
          }

          setEditor(undefined);
          setAba('revisoes');
        }

        return ok;
      };

    const enviarParaAprovacao =
      (
        revisao: IDocumentoRevisao
      ): void => {

        setErroLegado('');

        const acao: Promise<unknown> =
          fluxoDisponivel
            ? fluxo.enviarParaAprovacao(revisao)
            : onEnviarAprovacao(revisao);

        acao.catch(
          (error: unknown) => {
            console.error(error);
            setErroLegado(
              error instanceof Error
                ? error.message
                : 'Erro ao enviar para aprovação.'
            );
          }
        );
      };

    const irParaElaboracao =
      (
        revisao: IDocumentoRevisao
      ): void => {

        setErroLegado('');

        onDevolverElaboracao(revisao)
          .catch(
            (error: unknown) => {
              console.error(error);
              setErroLegado(
                error instanceof Error
                  ? error.message
                  : 'Erro ao mover a revisão para elaboração.'
              );
            }
          );
      };

    const confirmarReprovacao =
      (): void => {

        const revisao =
          revisaoParaReprovar;

        const motivo =
          motivoReprovacao.trim();

        if (!revisao || !motivo) {
          return;
        }

        setRevisaoParaReprovar(undefined);
        setErroLegado('');

        const acao: Promise<unknown> =
          fluxoDisponivel
            ? fluxo.reprovar(revisao, motivo)
            : onDevolverElaboracao(revisao);

        acao.catch(
          (error: unknown) => {
            console.error(error);
            setErroLegado(
              error instanceof Error
                ? error.message
                : 'Erro ao reprovar a revisão.'
            );
          }
        );
      };

    // ==========================================================
    // RENDER
    // ==========================================================

    if (!documento) {

      return (
        <section>

          <PageHeader
            titulo="Documento"
            subtitulo="Documento não localizado."
            acao={
              <button
                type="button"
                onClick={onVoltar}
              >
                Voltar
              </button>
            }
          />

        </section>
      );
    }

    const statusDocumento =
      revisaoVigente
        ? 'Vigente'
        : revisaoEmAndamento
          ? (seloStatus(revisaoEmAndamento, '').texto)
          : valorOuTraco(documento.status);

    const vigenteAtualId =
      revisaoVigente?.id || '';

    const estiloAba = (
      ativa: boolean
    ): React.CSSProperties => ({
      padding: '10px 16px',
      border: 0,
      borderBottom: ativa
        ? `3px solid ${COR_CIANO}`
        : '3px solid transparent',
      background: 'transparent',
      color: ativa ? COR_AZUL : '#64748B',
      fontSize: '13.5px',
      fontWeight: ativa ? 800 : 600,
      cursor: 'pointer'
    });

    const mensagemErro =
      fluxo.erro ||
      erroLegado;

    return (
      <section>

        <PageHeader
          titulo={
            `${documento.codigo} - ${documento.titulo}`
          }
          subtitulo={
            documento.descricao ||
            'Detalhes, revisões e histórico do documento.'
          }
          acao={
            <button
              type="button"
              onClick={onVoltar}
            >
              Voltar
            </button>
          }
        />

        {/* RESUMO */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '18px'
          }}
        >
          <Card
            titulo="Tipo"
            valor={documento.tipo}
          />

          <Card
            titulo="Revisão vigente"
            valor={
              revisaoVigente?.revisao ||
              'Nenhuma (ainda não publicada)'
            }
          />

          <Card
            titulo="Status"
            valor={statusDocumento}
          />

          <Card
            titulo="Em andamento"
            valor={
              revisaoEmAndamento
                ? `${revisaoEmAndamento.revisao} · ${seloStatus(revisaoEmAndamento, vigenteAtualId).texto}`
                : 'Nenhuma'
            }
            destaque={!!revisaoEmAndamento}
          />

          <Card
            titulo="Responsável"
            valor={valorOuTraco(documento.responsavel)}
          />
        </div>

        {
          // Diagnóstico: explica por que o botão de aprovar aparece
          // (ou não) para quem está vendo esta tela agora.
          contexto &&
          (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontSize: '12px',
                color: '#64748B',
                lineHeight: 1.6
              }}
            >
              Você está logado como{' '}
              <strong>
                {contexto.email || 'usuário não identificado'}
              </strong>
              {
                contexto.perfil === 'Administrador'
                  ? ' — perfil Administrador, pode aprovar qualquer documento.'
                  : !documento.areaId
                    ? ' — este documento não tem área definida, então não é possível saber quem aprova.'
                    : gestoresDaArea.length === 0
                      ? (
                        <>
                          {' '}— esta área não tem nenhum Gestor cadastrado em{' '}
                          <strong>Gestão → Áreas e acessos</strong>, então ninguém
                          consegue aprovar este documento ainda.
                        </>
                      )
                      : (
                        <>
                          {' '}— Gestor(es) desta área:{' '}
                          <strong>
                            {
                              gestoresDaArea
                                .map(g => `${g.usuarioNome} (${g.usuarioEmail})`)
                                .join(', ')
                            }
                          </strong>.
                          {
                            podeAprovar
                              ? ' Você é um deles: os botões de aprovação aparecem na revisão em aprovação.'
                              : ' Seu e-mail não bate com nenhum deles, por isso os botões de aprovação não aparecem.'
                          }
                        </>
                      )
              }
            </div>
          )
        }

        {
          // CHAMADA PARA NOVA REVISÃO — só quando não há outra em
          // andamento e já existe uma revisão vigente para partir dela.
          fluxoDisponivel &&
          podeEditar &&
          !carregando &&
          revisaoVigente &&
          !revisaoEmAndamento &&
          (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                flexWrap: 'wrap',
                marginBottom: '18px',
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#E6F9FC',
                border: `1px solid ${COR_CIANO}`
              }}
            >
              <div
                style={{
                  color: COR_AZUL,
                  fontSize: '13px',
                  lineHeight: 1.5
                }}
              >
                <strong>
                  Precisa alterar este documento?
                </strong>
                <br />
                Crie a <strong>{proximaRevisao}</strong> em Elaboração. A{' '}
                <strong>{revisaoVigente.revisao}</strong> continua vigente até a nova ser aprovada.
              </div>

              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  fluxo.limparMensagens();
                  setEditor({ modo: 'criar' });
                }}
                style={{
                  padding: '10px 16px',
                  border: 0,
                  borderRadius: '8px',
                  background: COR_AZUL,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: ocupado ? 'not-allowed' : 'pointer'
                }}
              >
                + Criar nova revisão ({proximaRevisao})
              </button>
            </div>
          )
        }

        {
          mensagemErro &&
          !editor &&
          (
            <div
              style={{
                padding: '12px 14px',
                marginBottom: '18px',
                background: '#fde7e9',
                color: '#a4262c',
                borderRadius: '10px',
                fontSize: '13px'
              }}
            >
              {mensagemErro}
            </div>
          )
        }

        {
          fluxo.aviso &&
          (
            <div
              style={{
                padding: '12px 14px',
                marginBottom: '18px',
                background: '#FFF4E5',
                color: '#8A5300',
                borderRadius: '10px',
                fontSize: '13px'
              }}
            >
              {fluxo.aviso}
            </div>
          )
        }

        {erro && (
          <div
            style={{
              padding: '14px',
              marginBottom: '18px',
              background: '#fde7e9',
              color: '#a4262c',
              borderRadius: '10px'
            }}
          >
            {erro}
          </div>
        )}

        {/* ABAS */}

        <div
          style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid #E2E8F0',
            marginBottom: '18px'
          }}
        >
          <button
            type="button"
            style={estiloAba(aba === 'revisoes')}
            onClick={() => setAba('revisoes')}
          >
            Revisão
          </button>

          <button
            type="button"
            style={estiloAba(aba === 'historico')}
            onClick={() => setAba('historico')}
          >
            Histórico ({fluxo.eventos.length})
          </button>
        </div>

        {
          aba === 'historico'
            ? (
              fluxoDisponivel
                ? (
                  <DocumentoHistoricoTab
                    eventos={fluxo.eventos}
                    carregando={fluxo.carregandoHistorico}
                    erro={fluxo.erroHistorico}
                    onRecarregar={() => {
                      fluxo.recarregarHistorico()
                        .catch(
                          (error: unknown) =>
                            console.error(error)
                        );
                    }}
                  />
                )
                : (
                  <EmptyState
                    titulo="Histórico indisponível"
                    descricao="Os serviços de histórico não foram carregados nesta tela."
                  />
                )
            )
            : carregando
              ? (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center'
                  }}
                >
                  Carregando revisões...
                </div>
              )
              : revisoes.length === 0
                ? (
                  <EmptyState
                    titulo="Nenhuma revisão localizada"
                    descricao="As revisões deste documento serão exibidas aqui."
                  />
                )
                : (
                  <div
                    style={{
                      display: 'grid',
                      gap: '14px'
                    }}
                  >
                    {/* LISTA SUSPENSA DE REVISÕES */}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                        padding: '12px 16px',
                        background: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px'
                      }}
                    >
                      <label
                        htmlFor="dgt-seletor-revisao"
                        style={{
                          color: COR_AZUL,
                          fontSize: '13px',
                          fontWeight: 700
                        }}
                      >
                        Revisão exibida
                      </label>

                      <select
                        id="dgt-seletor-revisao"
                        value={revisaoExibida ? revisaoExibida.id : ''}
                        onChange={event =>
                          setRevisaoSelecionadaId(event.target.value)
                        }
                        style={{
                          minWidth: '260px',
                          padding: '8px 12px',
                          border: `1px solid ${COR_AZUL}`,
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          color: COR_AZUL,
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {
                          revisoes.map(
                            revisao => (
                              <option
                                key={revisao.id}
                                value={revisao.id}
                              >
                                {`${revisao.revisao} — ${seloStatus(revisao, vigenteAtualId).texto}`}
                              </option>
                            )
                          )
                        }
                      </select>

                      <span
                        style={{
                          color: '#64748B',
                          fontSize: '12px'
                        }}
                      >
                        {revisoes.length} {revisoes.length === 1 ? 'revisão' : 'revisões'} no histórico
                      </span>

                      {
                        // Atalho para a revisão em andamento quando outra
                        // estiver sendo exibida.
                        revisaoEmAndamento &&
                        revisaoExibida &&
                        revisaoExibida.id !== revisaoEmAndamento.id &&
                        (
                          <button
                            type="button"
                            onClick={() =>
                              setRevisaoSelecionadaId(revisaoEmAndamento.id)
                            }
                            style={{
                              marginLeft: 'auto',
                              padding: '7px 12px',
                              border: `1px solid ${COR_CIANO}`,
                              borderRadius: '8px',
                              background: '#E6F9FC',
                              color: COR_AZUL,
                              fontSize: '12.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Ver {revisaoEmAndamento.revisao} ({seloStatus(revisaoEmAndamento, vigenteAtualId).texto.toLowerCase()}) →
                          </button>
                        )
                      }
                    </div>

                    {(revisaoExibida ? [revisaoExibida] : []).map(
                      revisao => {

                        const selo =
                          seloStatus(
                            revisao,
                            vigenteAtualId
                          );

                        const estagio =
                          estagioRevisao(
                            revisao.status
                          );

                        const reprovacao =
                          estagio === 'elaboracao'
                            ? obterReprovacaoPendente(
                              revisao,
                              fluxo.eventos
                            )
                            : undefined;

                        const emAndamento =
                          estagio !== 'vigente';

                        const substituida =
                          estagio === 'vigente' &&
                          revisao.id !== vigenteAtualId;

                        return (
                          <article
                            key={revisao.id}
                            style={{
                              padding: '20px',
                              background: '#ffffff',
                              border: substituida
                                ? '1px solid #F3B4AE'
                                : emAndamento
                                  ? `1px solid ${COR_CIANO}`
                                  : '1px solid #e5e7eb',
                              borderRadius: '14px',
                              overflow: 'hidden'
                            }}
                          >
                            {
                              // TARJA: revisão OBSOLETA
                              substituida &&
                              (
                                <div
                                  role="alert"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                    margin: '-20px -20px 18px',
                                    padding: '12px 20px',
                                    background: '#B42318',
                                    color: '#FFFFFF'
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      lineHeight: 1.5
                                    }}
                                  >
                                    <strong
                                      style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        letterSpacing: '.4px',
                                        textTransform: 'uppercase'
                                      }}
                                    >
                                      ⚠ Revisão obsoleta — não utilizar
                                    </strong>
                                    {
                                      (() => {
                                        const substituta =
                                          obterSubstituta(revisao);

                                        return substituta
                                          ? `Substituída pela ${substituta.revisao} em ${formatarData(substituta.dataVigencia || substituta.dataAprovacao)}. `
                                          : '';
                                      })()
                                    }
                                    Disponível apenas para consulta do histórico.
                                    {
                                      revisaoVigente &&
                                      ` A revisão vigente é a ${revisaoVigente.revisao}.`
                                    }
                                  </div>

                                  {
                                    revisaoVigente &&
                                    (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRevisaoSelecionadaId(revisaoVigente.id)
                                        }
                                        style={{
                                          padding: '8px 14px',
                                          border: '1px solid #FFFFFF',
                                          borderRadius: '8px',
                                          background: '#FFFFFF',
                                          color: '#B42318',
                                          fontSize: '12.5px',
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        Ver revisão vigente ({revisaoVigente.revisao})
                                      </button>
                                    )
                                  }
                                </div>
                              )
                            }

                            {
                              // TARJA: revisão ainda NÃO vigente
                              emAndamento &&
                              (
                                <div
                                  style={{
                                    margin: '-20px -20px 18px',
                                    padding: '10px 20px',
                                    background: '#E6F9FC',
                                    borderBottom: `1px solid ${COR_CIANO}`,
                                    color: COR_AZUL,
                                    fontSize: '13px',
                                    lineHeight: 1.5
                                  }}
                                >
                                  <strong>Revisão ainda não vigente.</strong>{' '}
                                  {
                                    revisaoVigente
                                      ? `Até a aprovação, vale a ${revisaoVigente.revisao}.`
                                      : 'O documento passa a valer quando esta revisão for aprovada.'
                                  }
                                </div>
                              )
                            }
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '20px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <div>
                                <h3
                                  style={{
                                    margin: 0,
                                    color: '#1f2937'
                                  }}
                                >
                                  Revisão {revisao.revisao}
                                </h3>

                                <span
                                  style={{
                                    display: 'block',
                                    marginTop: '5px',
                                    color: '#64748b',
                                    fontSize: '13px'
                                  }}
                                >
                                  {
                                    estagio === 'vigente'
                                      ? `Vigente desde ${formatarData(revisao.dataVigencia || revisao.dataAprovacao)}`
                                      : `Criada em ${formatarData(revisao.criadoEm || revisao.dataRevisao)}`
                                  }
                                </span>
                              </div>

                              <span
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '20px',
                                  background: selo.fundo,
                                  color: selo.cor,
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  height: 'fit-content'
                                }}
                              >
                                {selo.texto}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '12px',
                                marginTop: '18px'
                              }}
                            >
                              <Informacao
                                titulo="Vigência"
                                valor={
                                  estagio === 'vigente'
                                    ? formatarData(revisao.dataVigencia)
                                    : 'Após aprovação'
                                }
                              />

                              <Informacao
                                titulo="Responsável"
                                valor={
                                  valorOuTraco(revisao.responsavel) !== '-'
                                    ? valorOuTraco(revisao.responsavel)
                                    : valorOuTraco(revisao.criadoPor)
                                }
                              />

                              <Informacao
                                titulo="Aprovado por"
                                valor={valorOuTraco(revisao.aprovadoPor)}
                              />

                              <Informacao
                                titulo="Retreinamento"
                                valor={
                                  estagio !== 'vigente'
                                    ? 'Definido na aprovação'
                                    : revisao.requerRetreinamento
                                      ? 'Obrigatório'
                                      : 'Não requerido'
                                }
                              />
                            </div>

                            {
                              reprovacao &&
                              (
                                <div
                                  style={{
                                    marginTop: '16px',
                                    padding: '12px 14px',
                                    background: '#FDE7E9',
                                    color: '#A4262C',
                                    borderRadius: '9px',
                                    fontSize: '13px',
                                    lineHeight: 1.5
                                  }}
                                >
                                  <strong>
                                    Reprovada por {reprovacao.usuario} em {formatarData(reprovacao.data)}:
                                  </strong>
                                  <br />
                                  {reprovacao.motivo || reprovacao.descricao}
                                </div>
                              )
                            }

                            {revisao.motivoAlteracao && (
                              <BlocoTexto
                                titulo="Motivo da alteração"
                                texto={revisao.motivoAlteracao}
                              />
                            )}

                            {revisao.descricaoAlteracoes && (
                              <BlocoTexto
                                titulo="Alterações realizadas"
                                texto={revisao.descricaoAlteracoes}
                              />
                            )}

                            {revisao.justificativa && (
                              <BlocoTexto
                                titulo="Justificativa"
                                texto={revisao.justificativa}
                              />
                            )}

                            {revisao.requerRetreinamento && estagio === 'vigente' && (
                              <div
                                style={{
                                  marginTop: '16px',
                                  padding: '12px 14px',
                                  background: '#fff4ce',
                                  color: '#8a6d00',
                                  borderRadius: '9px',
                                  fontWeight: 600
                                }}
                              >
                                Esta revisão exige retreinamento dos usuários impactados.
                              </div>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                gap: '10px',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                marginTop: '18px'
                              }}
                            >
                              {
                                revisao.arquivoUrl
                                  ? (
                                    <>
                                    <button
                                      type="button"
                                      onClick={() => setRevisaoEmPrevia(revisao)}
                                      title="Ver o arquivo aqui mesmo, sem abrir"
                                      style={{
                                        display: 'inline-block',
                                        padding: '9px 14px',
                                        border: `1px solid ${COR_AZUL}`,
                                        background: '#FFFFFF',
                                        color: COR_AZUL,
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      👁 Pré-visualizar
                                    </button>

                                    <a
                                      href={urlParaAbrir(revisao.arquivoUrl)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'inline-block',
                                        padding: '9px 14px',
                                        background: substituida ? '#64748B' : COR_INDIGO,
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                        fontSize: '13px'
                                      }}
                                    >
                                      {
                                        substituida
                                          ? 'Abrir documento (obsoleto)'
                                          : 'Abrir documento'
                                      }
                                    </a>
                                    </>
                                  )
                                  : (
                                    <span
                                      style={{
                                        color: '#94A3B8',
                                        fontSize: '12.5px'
                                      }}
                                    >
                                      Nenhum arquivo anexado a esta revisão.
                                    </span>
                                  )
                              }
                            </div>

                            {
                              emAndamento &&
                              (
                                <div
                                  style={{
                                    marginTop: '18px',
                                    paddingTop: '16px',
                                    borderTop: '1px solid #E2E8F0'
                                  }}
                                >
                                  <AcoesFluxoRevisao
                                    revisao={revisao}
                                    processando={ocupado}
                                    podeAprovar={podeAprovar}
                                    podeEditar={podeEditar && fluxoDisponivel}
                                    onEditar={() => {
                                      fluxo.limparMensagens();
                                      setEditor({ modo: 'editar', revisao });
                                    }}
                                    onEnviarAprovacao={() =>
                                      enviarParaAprovacao(revisao)
                                    }
                                    onIrParaElaboracao={() =>
                                      irParaElaboracao(revisao)
                                    }
                                    onAbrirPublicar={() =>
                                      setRevisaoParaPublicar(revisao)
                                    }
                                    onAbrirReprovar={() => {
                                      setMotivoReprovacao('');
                                      setRevisaoParaReprovar(revisao);
                                    }}
                                  />
                                </div>
                              )
                            }
                          </article>
                        );
                      }
                    )}
                  </div>
                )
        }

        {/* PRÉ-VISUALIZAÇÃO DO ARQUIVO */}

        <PreviaDocumentoModal
          aberto={!!revisaoEmPrevia}
          url={revisaoEmPrevia?.arquivoUrl || ''}
          titulo={`${documento.codigo} - ${documento.titulo}`}
          revisao={revisaoEmPrevia ? `Revisão ${revisaoEmPrevia.revisao}` : ''}
          siteUrl={sharePointDocumentoService?.urlSite}
          obsoleta={
            !!revisaoEmPrevia &&
            estagioRevisao(revisaoEmPrevia.status) === 'vigente' &&
            revisaoEmPrevia.id !== vigenteAtualId
          }
          rascunho={
            !!revisaoEmPrevia &&
            estagioRevisao(revisaoEmPrevia.status) !== 'vigente'
          }
          onFechar={fecharPrevia}
        />

        {/* MODAL: CRIAR / EDITAR REVISÃO */}

        <RevisaoEditorModal
          aberto={!!editor}
          modo={editor ? editor.modo : 'criar'}
          revisaoNumero={
            editor && editor.modo === 'editar'
              ? editor.revisao.revisao
              : proximaRevisao
          }
          revisaoBase={revisaoVigente}
          revisao={
            editor && editor.modo === 'editar'
              ? editor.revisao
              : undefined
          }
          processando={fluxo.processando}
          erro={fluxo.erro}
          onCancelar={() => {
            setEditor(undefined);
            fluxo.limparMensagens();
          }}
          onSalvar={salvarEditor}
        />

        {/* MODAL: REPROVAR */}

        {
          revisaoParaReprovar &&
          (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10600,
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
                  padding: '22px',
                  background: '#FFFFFF',
                  borderRadius: '14px'
                }}
              >
                <strong style={{ display: 'block', marginBottom: '6px', color: '#0B2D4D' }}>
                  Reprovar a revisão {revisaoParaReprovar.revisao}
                </strong>

                <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '13px', lineHeight: 1.5 }}>
                  Explique o que precisa ser ajustado. A revisão volta para Elaboração e o motivo fica registrado no histórico.
                </p>

                <textarea
                  rows={4}
                  value={motivoReprovacao}
                  onChange={event => setMotivoReprovacao(event.target.value)}
                  placeholder="Ex.: faltou detalhar o passo 3, corrigir o responsável..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setRevisaoParaReprovar(undefined)}
                    style={{
                      padding: '9px 14px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      color: '#1F2937',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={!motivoReprovacao.trim() || ocupado}
                    onClick={confirmarReprovacao}
                    style={{
                      padding: '9px 14px',
                      border: 0,
                      borderRadius: '8px',
                      background: motivoReprovacao.trim() ? '#B42318' : '#E8A6A0',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: motivoReprovacao.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Confirmar reprovação
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL: APROVAR / PUBLICAR */}

        <PublicarRevisaoModal
          aberto={
            !!revisaoParaPublicar
          }
          documentoRevisaoId={
            revisaoParaPublicar?.id ||
            ''
          }
          revisao={
            revisaoParaPublicar?.revisao ||
            ''
          }
          ehPrimeiraRevisao={
            !revisaoVigente
          }
          requerRetreinamento={
            revisaoParaPublicar?.requerRetreinamento ||
            false
          }
          processando={
            processandoPublicacao
          }
          onCancelar={() =>
            setRevisaoParaPublicar(undefined)
          }
          onPublicar={
            async dados => {

              const revisaoPublicada =
                revisaoParaPublicar;

              const resultado =
                await onPublicarRevisao(dados);

              setRevisaoParaPublicar(
                undefined
              );

              if (
                revisaoPublicada &&
                resultado &&
                resultado.sucesso !== false
              ) {
                await fluxo.registrarPublicacao(
                  {
                    ...revisaoPublicada,
                    requerRetreinamento: dados.requerRetreinamento,
                    justificativa: dados.justificativa,
                    // Base do prazo da próxima revisão periódica.
                    dataVigencia: dados.dataVigencia || revisaoPublicada.dataVigencia
                  },
                  resultado
                );
              }

              return resultado;
            }
          }
        />

        {
          erroPublicacao &&
          !revisaoParaPublicar &&
          (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#FDE7E9',
                color: '#A4262C'
              }}
            >
              {erroPublicacao}
            </div>
          )
        }

        {
          resultadoPublicacao &&
          (
            <div
              style={{
                marginTop: '16px'
              }}
            >
              <ResultadoPublicacaoRevisaoCard
                resultado={
                  resultadoPublicacao
                }
                onFechar={
                  onLimparResultadoPublicacao
                }
              />
            </div>
          )
        }

      </section>
    );
  };

export default DocumentoDetalhePage;
