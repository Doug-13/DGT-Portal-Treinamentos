import { ITreinamentoDocumentoAdmin } from '../services/TreinamentoDocumentoAdminService';
import { IModuloImportJson } from '../services/ImportacaoJsonEtapasService';
import * as React from 'react';

import {
  Pagina
} from '../constants/routes';

import {
  ITreinamento,
  IHistorico,
  ICertificado
} from '../models/Treinamento';

import {
  IModuloTreinamento
} from '../models/Modulo';

import {
  IDocumento,
  IDocumentoRevisao
} from '../models/Documento';

import {
  IColaborador
} from '../models/Usuario';

import {
  ITrilha
} from '../models/Trilha';

import {
  IAvaliacao,
  IEnvioAvaliacao,
  IEstadoTentativasAvaliacao,
  IResultadoAvaliacao
} from '../models/Avaliacao';

import GestaoTrilhasPage from
  '../pages/Gestao/GestaoTrilhasPage';

import {
  IEditarTrilha,
  INovaTrilha,
  ITrilhaAdmin,
  ITrilhaAreaAdmin,
  ITrilhaTreinamentoAdmin,
  ITrilhaTreinamentoEdicao
} from '../services/TrilhaAdminService';

import {
  IEditarTreinamento,
  INovoTreinamento,
  ITreinamentoAdmin
} from '../services/TreinamentoAdminService';

import AvaliacaoPage from
  '../pages/Avaliacao/AvaliacaoPage';

import InicioIntranetPage from
  '../pages/Intranet/Inicio/InicioIntranetPage';

import VisaoGeralTreinamentosPage from
  '../pages/Treinamentos/VisaoGeralTreinamentosPage';

import MeusTreinamentosPage from
  '../pages/Treinamentos/MeusTreinamentosPage';

import ExecutarTreinamentoPage from
  '../pages/Treinamentos/ExecutarTreinamentoPage';

import ModuloExecucaoPage from
  '../pages/Treinamentos/ModuloExecucaoPage';

import {
  IConteudoModuloExecucao,
  IPerguntaRapidaExecucao
} from '../hooks/useModuloExecucao';

import DocumentosHomePage from
  '../pages/Documentos/DocumentosHomePage';

import NovoDocumentoPage from
  '../pages/Documentos/NovoDocumentoPage';

import ProcessosPage from
  '../pages/Processos/ProcessosPage';

import {
  solicitarAberturaProcesso
} from '../services/processos/ProcessoService';

import DocumentoDetalhePage from
  '../pages/Documentos/DocumentoDetalhePage';


import CertificadosPage from
  '../pages/Certificados/CertificadosPage';

import TrilhasPage from
  '../pages/Trilhas/TrilhasPage';

import SuportePage from
  '../pages/Suporte/SuportePage';

import GestaoPage from
  '../pages/Gestao/GestaoPage';

import GestaoAreasPage from
  '../pages/Gestao/GestaoAreasPage';

import NovoTreinamentoPage from
  '../pages/Gestao/NovoTreinamentoPage';

import AtribuirTreinamentoPage from
  '../pages/Gestao/AtribuirTreinamentoPage';

import EquipePage from
  '../pages/Gestao/EquipePage';

import GestaoModulosPage from
  '../pages/Gestao/GestaoModulosPage';

import {
  IEditarModulo,
  IModuloAdmin,
  INovoModulo
} from '../services/ModuloAdminService';

import {
  IEditarModuloConteudo,
  IModuloConteudoAdmin,
  INovoModuloConteudo
} from '../services/ModuloConteudoAdminService';

import GestaoAvaliacoesPage from
  '../pages/Gestao/GestaoAvaliacoesPage';

import GestaoDocumentosPage from
  '../pages/Gestao/GestaoDocumentosPage';

import {
  IDocumentoAdmin,
  INovoDocumentoCompleto,
  INovaRevisaoDocumentoArquivo,
  IRevisaoAdmin
} from '../services/DocumentoAdminService';

import {
  IPublicarRevisao,
  IResultadoPublicacaoRevisao
} from '../services/RevisaoDocumentoAdminService';

import {
  IAlternativaAdmin,
  IAvaliacaoAdmin,
  IEditarAlternativa,
  IEditarAvaliacao,
  IEditarQuestao,
  INovaAlternativa,
  INovaAvaliacao,
  INovaQuestao,
  INovaQuestaoCompleta,
  IQuestaoAdmin
} from '../services/AvaliacaoAdminService';

import {
  IAtribuicaoManual,
  IResultadoAtribuicao,
  ITrilhaAtribuicao,
  IUsuarioAtribuicao
} from '../services/AtribuicaoAdminService';

import {
  DataverseService
} from '../services/DataverseService';

import {
  SharePointDocumentoService
} from '../services/sharepoint/SharePointDocumentoService';

import AcessoNegadoPage from
  '../pages/AcessoNegadoPage';

import DiagnosticoAcessoPanel from
  './common/DiagnosticoAcessoPanel';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import CatalogoTreinamentosPage from
  '../pages/Treinamentos/CatalogoTreinamentosPage';

import {
  IImpactoRemocao
} from '../services/TreinamentoRemocaoService';

import {
  IImpactoRemocaoModulo
} from '../services/ModuloRemocaoService';

import ModoTesteTreinamentoPage from
  '../pages/Treinamentos/ModoTesteTreinamentoPage';

import {
  IEventoTreinamento
} from '../services/TreinamentoHistoricoService';

import {
  AtribuicaoAreaService
} from '../services/AtribuicaoAreaService';

import {
  podeAcessarRota,
  verificarPermissaoRota
} from '../services/RoutePermissionService';

import GestaoConformidadePage from
  '../pages/Gestao/GestaoConformidadePage';

import {
  IItemConformidade,
  IResumoConformidade
} from '../services/ConformidadeService';

import IndicadoresPage from
  '../pages/Indicadores/IndicadoresPage';

import LicitacoesBuscaPage from
  '../pages/Licitacoes/LicitacoesBuscaPage';

import LicitacoesTesteConexaoPage from
  '../pages/Licitacoes/LicitacoesTesteConexaoPage';

import {
  IEventoCalendario
} from '../services/microsoft365/CalendarService';
import {
  IAreaAdmin,
  IEditarArea,
  IEditarUsuarioArea,
  INovaArea,
  INovoUsuarioArea,
  IUsuarioAreaAdmin,
  IUsuarioDisponivelArea
} from '../services/AreaAdminService';

// ============================================================
// PROPS
// ============================================================

export interface IPortalRouterProps {
  avaliacoesAdministrativas:
  IAvaliacaoAdmin[];

  questoesAdministrativas:
  IQuestaoAdmin[];

  alternativasAdministrativas:
  IAlternativaAdmin[];

  treinamentoAvaliacaoSelecionadoId:
  string;

  avaliacaoAdministrativaSelecionada?:
  IAvaliacaoAdmin;

  questaoAdministrativaSelecionada?:
  IQuestaoAdmin;

  carregandoGestaoAvaliacoes:
  boolean;

  processandoGestaoAvaliacoes:
  boolean;

  erroGestaoAvaliacoes:
  string;

  selecionarTreinamentoAvaliacao:
  (id: string) => Promise<void>;

  selecionarAvaliacaoAdministrativa:
  (item: IAvaliacaoAdmin) => Promise<void>;

  selecionarQuestaoAdministrativa:
  (item: IQuestaoAdmin) => Promise<void>;

  criarAvaliacaoAdministrativa:
  (dados: INovaAvaliacao) => Promise<void>;

  editarAvaliacaoAdministrativa:
  (dados: IEditarAvaliacao) => Promise<void>;

  definirAvaliacaoAtiva:
  (id: string, ativa: boolean) => Promise<void>;

  criarQuestaoAdministrativa:
  (dados: INovaQuestao) => Promise<void>;

  criarQuestaoCompletaAdministrativa:
  (dados: INovaQuestaoCompleta) => Promise<void>;

  editarQuestaoAdministrativa:
  (dados: IEditarQuestao) => Promise<void>;

  definirQuestaoAtiva:
  (id: string, ativa: boolean) => Promise<void>;

  criarAlternativaAdministrativa:
  (dados: INovaAlternativa) => Promise<void>;

  editarAlternativaAdministrativa:
  (dados: IEditarAlternativa) => Promise<void>;

  definirAlternativaAtiva:
  (id: string, ativa: boolean) => Promise<void>;

  importarAvaliacaoJson:
  (
    arquivo:
      File
  ) => Promise<string>;

  treinamentosAdministrativos:
  ITreinamentoAdmin[];

  carregandoGestaoTreinamentos:
  boolean;

  erroGestaoTreinamentos:
  string;

  processandoTreinamentoId:
  string;

  abrirFluxoEdicaoTreinamento:
  (
    treinamento:
      ITreinamentoAdmin
  ) => Promise<void>;

  definirTreinamentoAtivo:
  (
    treinamentoId:
      string,
    ativo:
      boolean
  ) => Promise<void>;


  usuariosAtribuicao:
  IUsuarioAtribuicao[];

  trilhasAtribuicao:
  ITrilhaAtribuicao[];

  carregandoAtribuicoes:
  boolean;

  processandoAtribuicao:
  boolean;

  erroAtribuicao:
  string;

  resultadoAtribuicao?:
  IResultadoAtribuicao;

  processarAtribuicao:
  (
    dados:
      IAtribuicaoManual
  ) => Promise<IResultadoAtribuicao>;

  limparResultadoAtribuicao:
  () => void;

  itensConformidade:
  IItemConformidade[];

  resumoConformidade:
  IResumoConformidade;

  carregandoConformidade:
  boolean;

  erroConformidade:
  string;

  // ============================================================
  // ÁREAS E ACESSOS
  // ============================================================

  areasAdministrativas:
  IAreaAdmin[];

  usuariosDisponiveisArea:
  IUsuarioDisponivelArea[];

  usuariosAreasAdministrativos:
  IUsuarioAreaAdmin[];

  carregandoGestaoAreas:
  boolean;

  processandoGestaoAreas:
  boolean;

  erroGestaoAreas:
  string;

  criarAreaAdministrativa:
  (
    dados:
      INovaArea
  ) => Promise<void>;

  editarAreaAdministrativa:
  (
    dados:
      IEditarArea
  ) => Promise<void>;

  definirAreaAtiva:
  (
    areaId:
      string,
    ativa:
      boolean
  ) => Promise<void>;

  vincularUsuarioArea:
  (
    dados:
      INovoUsuarioArea
  ) => Promise<void>;

  editarUsuarioArea:
  (
    dados:
      IEditarUsuarioArea
  ) => Promise<void>;

  definirUsuarioAreaAtivo:
  (
    vinculoId:
      string,
    ativo:
      boolean
  ) => Promise<void>;

  // ============================================================
  // GESTÃO DOCUMENTAL ADMINISTRATIVA
  // ============================================================

  statusDocumentos:
  Array<{
    value: number;
    label: string;
  }>;

  documentosAdministrativos:
  IDocumentoAdmin[];

  documentoAdministrativoSelecionado?:
  IDocumentoAdmin;

  revisoesAdministrativas:
  IRevisaoAdmin[];
  treinamentosDocumentoAdministrativos:
  ITreinamentoDocumentoAdmin[];

  carregandoTreinamentosDocumento:
  boolean;

  processandoTreinamentosDocumento:
  boolean;

  erroTreinamentosDocumento:
  string;

  vincularTreinamentoDocumento:
  (
    documentoId: string,
    treinamentoId: string,
    obrigatorio: boolean,
    ordem: number,
    observacao: string
  ) => Promise<void>;

  desativarTreinamentoDocumento:
  (
    documentoId: string,
    relacaoId: string
  ) => Promise<void>;

  carregandoGestaoDocumentos:
  boolean;

  processandoGestaoDocumentos:
  boolean;

  erroGestaoDocumentos:
  string;

  criarDocumentoAdministrativo:
  (
    dados:
      INovoDocumentoCompleto
  ) => Promise<void>;
  selecionarDocumentoAdministrativo:
  (
    documento:
      IDocumentoAdmin
  ) => Promise<void>;

  criarRevisaoAdministrativa:
  (
    dados:
      INovaRevisaoDocumentoArquivo
  ) => Promise<void>;

  limparDocumentoAdministrativo:
  () => void;
  enviarRevisaoParaRevisao:
  (
    revisao:
      IRevisaoAdmin
  ) => Promise<void>;

  enviarRevisaoParaAprovacao:
  (
    revisao:
      IRevisaoAdmin
  ) => Promise<void>;

  devolverRevisaoParaElaboracao:
  (
    revisao:
      IRevisaoAdmin
  ) => Promise<void>;

  // ============================================================
  // PUBLICAÇÃO DE REVISÃO DOCUMENTAL
  // ============================================================

  processandoPublicacao:
  boolean;

  erroPublicacao:
  string;

  resultadoPublicacao?:
  IResultadoPublicacaoRevisao;

  publicarRevisao:
  (
    dados:
      IPublicarRevisao
  ) => Promise<IResultadoPublicacaoRevisao>;

  limparResultadoPublicacao:
  () => void;

  // ============================================================
  // AUTORIZAÇÃO
  // ============================================================

  contextoAcesso?:
  IContextoAcesso;

  carregandoAutorizacao:
  boolean;

  erroAutorizacao:
  string;
  // ============================================================
  // NAVEGAÇÃO
  // ============================================================

  pagina:
  Pagina;

  navegar:
  (
    pagina:
      Pagina
  ) => void;

  // ============================================================
  // USUÁRIO
  // ============================================================

  primeiroNome:
  string;

  // ============================================================
  // TREINAMENTOS
  // ============================================================

  eventosCalendario:
  IEventoCalendario[];

  carregandoCalendario:
  boolean;

  erroCalendario:
  string;
  treinamentos:
  ITreinamento[];

  treinamentoSelecionado:
  ITreinamento | null;

  abrirTreinamento:
  (
    treinamento:
      ITreinamento
  ) => void;

  iniciarTreinamento:
  () => void;

  iniciandoTreinamento:
  boolean;

  erroExecucao:
  string;


  trilhasAdministrativas:
  ITrilhaAdmin[];

  trilhaAdministrativaSelecionada?:
  ITrilhaAdmin;

  treinamentosTrilhaAdministrativa:
  ITrilhaTreinamentoAdmin[];

  carregandoGestaoTrilhas:
  boolean;

  carregandoConteudoTrilha:
  boolean;

  processandoGestaoTrilhas:
  boolean;

  erroGestaoTrilhas:
  string;

  selecionarTrilhaAdministrativa:
  (
    trilha:
      ITrilhaAdmin
  ) => Promise<void>;

  limparTrilhaAdministrativa:
  () => void;

  criarTrilhaAdministrativa:
  (
    dados:
      INovaTrilha
  ) => Promise<ITrilhaAdmin>;

  editarTrilhaAdministrativa:
  (
    dados:
      IEditarTrilha
  ) => Promise<void>;

  definirTrilhaAtiva:
  (
    trilhaId:
      string,
    ativa:
      boolean
  ) => Promise<void>;

  areasTrilhaAdministrativa:
  ITrilhaAreaAdmin[];

  salvarTreinamentosTrilha:
  (
    trilhaId:
      string,
    itens:
      ITrilhaTreinamentoEdicao[]
  ) => Promise<void>;

  salvarAreasTrilha:
  (
    trilhaId:
      string,
    todasAreas:
      boolean,
    areaIds:
      string[]
  ) => Promise<void>;

  // ============================================================
  // ADMINISTRAÇÃO DE TREINAMENTOS
  // ============================================================

  salvarNovoTreinamento:
  (
    dados:
      INovoTreinamento
  ) => Promise<void>;

  fluxoCriacaoTreinamentoId:
  string;

  avancarFluxoTreinamentoParaAvaliacao:
  () => Promise<void>;

  navegarEtapaFluxoTreinamento:
  (
    etapa:
      1 | 2 | 3
  ) => void;

  atualizarTreinamentoFluxo:
  (
    dados:
      IEditarTreinamento
  ) => Promise<void>;

  // Atribuição por área (regras dgt_treinamentoarea).
  atribuicaoAreaService?:
    AtribuicaoAreaService;

  // Remoção de treinamento (somente Administrador).
  analisarRemocaoTreinamento?:
    (
      treinamento:
        ITreinamentoAdmin
    ) => Promise<IImpactoRemocao>;

  removerTreinamento?:
    (
      treinamento:
        ITreinamentoAdmin,
      aoProgredir:
        (mensagem: string) => void
    ) => Promise<void>;

  // Modo de teste do treinamento (visão do colaborador, sem registros).
  treinamentoEmTesteId?:
    string;

  testarTreinamento?:
    (
      treinamento:
        ITreinamentoAdmin
    ) => void;

  sairModoTeste?:
    () => void;

  // Histórico do treinamento (dgt_auditorianegocio).
  carregarHistoricoTreinamento?:
  (
    treinamentoId:
      string
  ) => Promise<IEventoTreinamento[]>;

  concluirFluxoCriacaoTreinamento:
  () => Promise<void>;

  // ============================================================
  // MÓDULOS
  // ============================================================

  modulos:
  IModuloTreinamento[];

  carregandoModulos:
  boolean;

  erroModulos:
  string;

  processandoModuloId:
  string;

  progressoModulos:
  number;

  avaliacaoLiberada:
  boolean;

  iniciarModulo:
  (
    modulo:
      IModuloTreinamento
  ) => void;

  concluirModulo:
  (
    modulo:
      IModuloTreinamento
  ) => void;
  abrirModulo:
  (
    modulo:
      IModuloTreinamento
  ) => void;

  moduloSelecionadoExecucao?:
  IModuloTreinamento;

  conteudosModuloExecucao:
  IConteudoModuloExecucao[];

  carregandoModuloExecucao:
  boolean;

  erroModuloExecucao:
  string;

  podeConcluirModuloExecucao:
  boolean;

  responderPerguntaModulo:
  (
    pergunta:
      IPerguntaRapidaExecucao,
    alternativaIds:
      string[]
  ) => Promise<boolean>;

  concluirModuloExecucao:
  () => Promise<void>;

  // ============================================================
  // DOCUMENTOS
  // ============================================================

  documentos:
  IDocumento[];

  documentoSelecionado?:
  IDocumento;

  revisoesDocumento:
  IDocumentoRevisao[];

  carregandoRevisoes:
  boolean;

  erroRevisoes:
  string;

  abrirDocumento:
  (
    documento:
      IDocumento
  ) => void;

  processandoFluxoDocumento:
  boolean;

  onEnviarRevisaoDocumento:
  (
    revisao:
      IDocumentoRevisao
  ) => Promise<void>;

  onEnviarAprovacaoDocumento:
  (
    revisao:
      IDocumentoRevisao
  ) => Promise<void>;

  onDevolverElaboracaoDocumento:
  (
    revisao:
      IDocumentoRevisao
  ) => Promise<void>;

  onPublicarRevisaoDocumento:
  (
    dados:
      IPublicarRevisao
  ) => Promise<IResultadoPublicacaoRevisao>;

  // Tela de detalhe do documento: criar/editar revisões e histórico.
  // Também usado pelo teste de conexão do painel de diagnóstico.
  dataverseService?:
  DataverseService;

  // Diagnóstico de acesso: e-mail do usuário logado e recarga das
  // permissões depois de o administrador corrigir o problema.
  usuarioEmail?:
  string;

  onRecarregarAutorizacao?:
  () => void;

  sharePointDocumentoService?:
  SharePointDocumentoService;

  onRecarregarRevisoesDocumento?:
  () => Promise<void>;

  // ============================================================
  // HISTÓRICO
  // ============================================================

  historico:
  IHistorico[];

  // ============================================================
  // CERTIFICADOS
  // ============================================================

  certificados:
  ICertificado[];

  // ============================================================
  // EQUIPE
  // ============================================================

  colaboradores?:
  IColaborador[];

  // ============================================================
  // TRILHAS
  // ============================================================

  trilhas:
  ITrilha[];

  // ============================================================
  // DATAVERSE
  // ============================================================

  carregandoDataverse:
  boolean;

  erroDataverse:
  string;

  // ============================================================
  // AVALIAÇÃO
  // ============================================================

  iniciarAvaliacao:
  () => void;

  avaliacao?:
  IAvaliacao;

  carregandoAvaliacao:
  boolean;

  erroAvaliacao:
  string;

  tentativasAvaliacao:
  IEstadoTentativasAvaliacao;

  envioAvaliacaoPreparado?:
  IEnvioAvaliacao;

  resultadoAvaliacao?:
  IResultadoAvaliacao;

  processandoAvaliacao:
  boolean;

  enviarAvaliacao:
  (
    respostas:
      Record<
        string,
        string[]
      >
  ) => void;

  modulosAdministrativos:
  IModuloAdmin[];

  treinamentoModuloSelecionadoId:
  string;

  carregandoGestaoModulos:
  boolean;

  processandoGestaoModulos:
  boolean;

  erroGestaoModulos:
  string;

  selecionarTreinamentoModulo:
  (
    treinamentoId:
      string
  ) => Promise<void>;

  criarModuloAdministrativo:
  (
    dados:
      INovoModulo
  ) => Promise<void>;

  editarModuloAdministrativo:
  (
    dados:
      IEditarModulo
  ) => Promise<void>;

  definirModuloAtivo:
  (
    moduloId:
      string,
    ativo:
      boolean
  ) => Promise<void>;

  // Remoção de módulo (somente Administrador).
  analisarRemocaoModulo?:
  (
    modulo:
      IModuloAdmin
  ) => Promise<IImpactoRemocaoModulo>;

  removerModulo?:
  (
    modulo:
      IModuloAdmin
  ) => Promise<void>;

  // Arrastar e soltar os cards de módulo.
  reordenarModulos?:
  (
    modulosNaNovaOrdem:
      IModuloAdmin[]
  ) => Promise<void>;

  analisarModulosJson:
  (
    arquivo:
      File
  ) => Promise<IModuloImportJson>;

  confirmarImportacaoModulosJson:
  (
    dados:
      IModuloImportJson
  ) => Promise<string>;

  moduloConteudoSelecionadoId:
  string;

  conteudosModuloAdministrativos:
  IModuloConteudoAdmin[];

  carregandoConteudosModulo:
  boolean;

  processandoConteudosModulo:
  boolean;

  erroConteudosModulo:
  string;

  selecionarModuloConteudo:
  (
    moduloId:
      string
  ) => Promise<void>;

  limparModuloConteudo:
  () => void;

  criarConteudoModulo:
  (
    dados:
      INovoModuloConteudo
  ) => Promise<void>;

  editarConteudoModulo:
  (
    dados:
      IEditarModuloConteudo
  ) => Promise<void>;

  definirConteudoModuloAtivo:
  (
    id:
      string,
    ativo:
      boolean
  ) => Promise<void>;

  moverConteudoModuloAcima:
  (
    item:
      IModuloConteudoAdmin
  ) => Promise<void>;

  moverConteudoModuloAbaixo:
  (
    item:
      IModuloConteudoAdmin
  ) => Promise<void>;
}



// ============================================================
// COMPONENTE
// ============================================================

const PortalRouter:
  React.FC<IPortalRouterProps> = (
    props
  ) => {
    if (
      props.carregandoAutorizacao
    ) {
      return (
        <div
          style={{
            padding: '32px'
          }}
        >
          Carregando permissões...
        </div>
      );
    }

    // Falhou ao carregar as permissões:
    //   • no Início → mostra a página (agenda funciona sem Dataverse)
    //     com uma faixa de diagnóstico no topo;
    //   • nas demais → tela de diagnóstico completa.
    const falhaAutorizacaoNoInicio =
      !!props.erroAutorizacao &&
      props.pagina === 'inicio';

    if (
      props.erroAutorizacao &&
      !falhaAutorizacaoNoInicio
    ) {
      return (
        <AcessoNegadoPage
          mensagem={
            props.erroAutorizacao
          }
          onVoltar={() =>
            props.navegar(
              'inicio'
            )
          }
          email={props.usuarioEmail}
          pagina={props.pagina}
          dataverseService={props.dataverseService}
          onTentarNovamente={props.onRecarregarAutorizacao}
        />
      );
    }

    const permissaoRota =
      falhaAutorizacaoNoInicio
        ? { permitido: true, mensagem: '' }
        : verificarPermissaoRota(
          props.pagina,
          props.contextoAcesso
        );

    if (
      !permissaoRota.permitido
    ) {
      return (
        <AcessoNegadoPage
          mensagem={
            permissaoRota.mensagem
          }
          onVoltar={() =>
            props.navegar(
              'inicio'
            )
          }
        />
      );
    }
    switch (
    props.pagina
    ) {

      // ========================================================
      // INÍCIO
      // ========================================================

      case 'inicio':

        return (
          <>
            {
              props.erroAutorizacao &&
              (
                <DiagnosticoAcessoPanel
                  modo="compacto"
                  erro={props.erroAutorizacao}
                  email={props.usuarioEmail}
                  pagina={props.pagina}
                  dataverseService={props.dataverseService}
                  onTentarNovamente={props.onRecarregarAutorizacao}
                />
              )
            }

          <InicioIntranetPage
            primeiroNome={
              props.primeiroNome
            }

            treinamentos={
              props.treinamentos
            }

            documentos={
              props.documentos
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            quantidadeTrilhas={
              props.trilhas.length
            }

            onAbrirTreinamento={
              props.abrirTreinamento
            }

            onVerTreinamentos={() =>
              props.navegar(
                'treinamentos'
              )
            }

            onVerDocumentos={() =>
              props.navegar(
                'documentos'
              )
            }
          
            onAbrirDocumento={
              props.abrirDocumento
            }

            eventosCalendario={
              props.eventosCalendario
            }

            carregandoCalendario={
              props.carregandoCalendario
            }

            erroCalendario={
              props.erroCalendario
            }
          />
          </>
        );
      // ========================================================
      // VISAO GERAL DE TREINAMENTOS
      // ========================================================

      // A antiga aba "Meu histórico" foi descontinuada. Se alguém
      // chegar à rota 'historico' (link salvo, estado anterior),
      // é levado para a Visão geral. O histórico de alterações fica
      // em cada treinamento (Gestão > Histórico) e em cada documento.
      case 'historico':
      case 'treinamentosVisaoGeral':

        return (
          <VisaoGeralTreinamentosPage
            primeiroNome={
              props.primeiroNome
            }

            treinamentos={
              props.treinamentos
            }

            trilhas={
              props.trilhas
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            quantidadeTrilhas={
              props.trilhas.length
            }

            onAbrirTreinamento={
              props.abrirTreinamento
            }

            onVerTreinamentos={() =>
              props.navegar(
                'treinamentos'
              )
            }

            onVerTrilhas={() =>
              props.navegar(
                'trilhas'
              )
            }

            onVerCertificados={() =>
              props.navegar(
                'certificados'
              )
            }

            onVerGestao={() =>
              props.navegar(
                'gestao'
              )
            }
          />
        );


      // ========================================================
      // MEUS TREINAMENTOS
      // ========================================================

      case 'treinamentos':

        return (
          <MeusTreinamentosPage
            treinamentos={
              props.treinamentos
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            onAbrirTreinamento={
              props.abrirTreinamento
            }
          />
        );

      // ========================================================
      // EXECUTAR TREINAMENTO
      // ========================================================

      case 'executarTreinamento':

        if (
          !props
            .treinamentoSelecionado
        ) {

          return (
            <MeusTreinamentosPage
              treinamentos={
                props.treinamentos
              }

              carregando={
                props.carregandoDataverse
              }

              erro={
                props.erroDataverse
              }

              onAbrirTreinamento={
                props.abrirTreinamento
              }
            />
          );
        }

        return (
          <ExecutarTreinamentoPage
            treinamento={
              props.treinamentoSelecionado
            }

            modulos={
              props.modulos
            }

            carregandoModulos={
              props.carregandoModulos
            }

            erroModulos={
              props.erroModulos
            }

            erroExecucao={
              props.erroExecucao
            }

            processandoModuloId={
              props.processandoModuloId
            }

            iniciandoTreinamento={
              props.iniciandoTreinamento
            }

            progresso={
              props.progressoModulos
            }

            avaliacaoLiberada={
              props.avaliacaoLiberada
            }

            onVoltar={() =>
              props.navegar(
                'treinamentos'
              )
            }

            onIniciarTreinamento={
              props.iniciarTreinamento
            }

            onIniciarModulo={
              props.iniciarModulo
            }
            onAbrirModulo={
              props.abrirModulo
            }

            onConcluirModulo={
              props.concluirModulo
            }

            onIniciarAvaliacao={
              props.iniciarAvaliacao
            }
          />
        );

      // ========================================================
      // EXECUTAR MÓDULO
      // ========================================================

      case 'executarModulo':

        if (
          !props.moduloSelecionadoExecucao
        ) {

          return (
            <ExecutarTreinamentoPage
              treinamento={
                props.treinamentoSelecionado as ITreinamento
              }

              modulos={
                props.modulos
              }

              carregandoModulos={
                props.carregandoModulos
              }

              erroModulos={
                props.erroModulos
              }

              erroExecucao={
                props.erroExecucao
              }

              processandoModuloId={
                props.processandoModuloId
              }

              iniciandoTreinamento={
                props.iniciandoTreinamento
              }

              progresso={
                props.progressoModulos
              }

              avaliacaoLiberada={
                props.avaliacaoLiberada
              }

              onVoltar={() =>
                props.navegar(
                  'treinamentos'
                )
              }

              onIniciarTreinamento={
                props.iniciarTreinamento
              }

              onIniciarModulo={
                props.iniciarModulo
              }

              onAbrirModulo={
                props.abrirModulo
              }

              onConcluirModulo={
                props.concluirModulo
              }

              onIniciarAvaliacao={
                props.iniciarAvaliacao
              }
            />
          );
        }

        return (
          <ModuloExecucaoPage
            modulo={
              props.moduloSelecionadoExecucao
            }

            conteudos={
              props.conteudosModuloExecucao
            }

            carregando={
              props.carregandoModuloExecucao
            }

            erro={
              props.erroModuloExecucao
            }

            podeConcluir={
              props.podeConcluirModuloExecucao
            }

            processando={
              props.processandoModuloId ===
              props.moduloSelecionadoExecucao.id
            }

            onVoltar={() =>
              props.navegar(
                'executarTreinamento'
              )
            }

            onResponderPergunta={
              props.responderPerguntaModulo
            }

            onConcluir={
              props.concluirModuloExecucao
            }
          />
        );
      // ========================================================
      // TRILHAS
      // ========================================================

      case 'trilhas':

        return (
          <TrilhasPage
            trilhas={
              props.trilhas
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            onAbrirTreinamento={
              props.abrirTreinamento
            }
          />
        );

      // ========================================================
      // DOCUMENTOS
      // ========================================================

      case 'novoDocumento':

        return (
          <NovoDocumentoPage
            statusDocumentos={
              props.statusDocumentos
            }

            usuarioCriador={
              props.primeiroNome
            }

            areas={
              props.areasAdministrativas
            }

            usuariosAreas={
              props.usuariosAreasAdministrativos
            }

            dataverseService={
              props.dataverseService
            }

            documentosExistentes={
              props.documentosAdministrativos
            }

            processando={
              props.processandoGestaoDocumentos
            }

            erro={
              props.erroGestaoDocumentos
            }

            onVoltar={() =>
              props.navegar(
                'documentos'
              )
            }

            onSalvar={async dados => {

              await props
                .criarDocumentoAdministrativo(
                  dados
                );

              props.navegar(
                'documentos'
              );
            }}
          />
        );
      case 'documentos':

        return (
          <DocumentosHomePage
            documentos={
              props.documentos
            }

            primeiroNome={
              props.primeiroNome
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            onAbrirDocumento={
              props.abrirDocumento
            }
          
            onNovoDocumento={
              podeAcessarRota(
                'novoDocumento',
                props.contextoAcesso
              )
                ? () =>
                  props.navegar('novoDocumento')
                : undefined
            }

            contexto={
              props.contextoAcesso
            }

            areas={
              props.areasAdministrativas
            }

            usuariosAreas={
              props.usuariosAreasAdministrativos
            }

            dataverseService={
              props.dataverseService
            }
          />
        );

      // ========================================================
      // DETALHE DO DOCUMENTO
      // ========================================================

      case 'documentoDetalhe':

        return (
          <DocumentoDetalhePage
            documento={
              props.documentoSelecionado
            }

            revisoes={
              props.revisoesDocumento
            }

            carregando={
              props.carregandoRevisoes
            }

            erro={
              props.erroRevisoes
            }

            contexto={
              props.contextoAcesso
            }

            usuariosAreas={
              props.usuariosAreasAdministrativos
            }

            processando={
              props.processandoFluxoDocumento
            }

            dataverseService={
              props.dataverseService
            }

            sharePointDocumentoService={
              props.sharePointDocumentoService
            }

            onRecarregarRevisoes={
              props.onRecarregarRevisoesDocumento
            }

            onEnviarRevisao={
              props.onEnviarRevisaoDocumento
            }

            onEnviarAprovacao={
              props.onEnviarAprovacaoDocumento
            }

            onDevolverElaboracao={
              props.onDevolverElaboracaoDocumento
            }

            processandoPublicacao={
              props.processandoPublicacao
            }

            erroPublicacao={
              props.erroPublicacao
            }

            resultadoPublicacao={
              props.resultadoPublicacao
            }

            onPublicarRevisao={
              props.onPublicarRevisaoDocumento
            }

            onLimparResultadoPublicacao={
              props.limparResultadoPublicacao
            }

            onAbrirProcesso={processoId => {
              solicitarAberturaProcesso(processoId);
              props.navegar('processos');
            }}

            onVoltar={() =>
              props.navegar(
                'documentos'
              )
            }
          />
        );

      // ========================================================
      // PROCESSOS (modo de teste — fluxo de revisão por processo)
      // ========================================================

      case 'processos':

        return (
          <ProcessosPage
            documentos={
              props.documentos
            }

            areas={
              props.areasAdministrativas
            }

            usuariosAreas={
              props.usuariosAreasAdministrativos
            }

            contexto={
              props.contextoAcesso
            }

            dataverseService={
              props.dataverseService
            }

            onAbrirDocumento={
              props.abrirDocumento
            }
          />
        );

      // ========================================================
      // CERTIFICADOS
      // ========================================================

      case 'certificados':

        return (
          <CertificadosPage
            certificados={
              props.certificados
            }
          />
        );

      // ========================================================
      // GESTÃO
      // ========================================================

      // ========================================================
      // CATÁLOGO DE TREINAMENTOS (Editor e Administrador)
      // ========================================================

      case 'catalogoTreinamentos':

        return (
          <CatalogoTreinamentosPage
            treinamentos={
              props.treinamentosAdministrativos
            }
            carregando={
              props.carregandoGestaoTreinamentos
            }
            erro={
              props.erroGestaoTreinamentos
            }
            onTestar={treinamento => {
              if (props.testarTreinamento) {
                props.testarTreinamento(
                  treinamento
                );
              }
            }}
          />
        );

      // ========================================================
      // MODO DE TESTE (visão do colaborador, sem registros)
      // ========================================================

      case 'testeTreinamento': {

        const emTeste =
          props.treinamentosAdministrativos
            .find(
              item =>
                item.id ===
                props.treinamentoEmTesteId
            );

        if (
          !emTeste ||
          !props.dataverseService
        ) {
          return (
            <CatalogoTreinamentosPage
              treinamentos={
                props.treinamentosAdministrativos
              }
              carregando={
                props.carregandoGestaoTreinamentos
              }
              erro={
                props.erroGestaoTreinamentos
              }
              onTestar={treinamento => {
                if (props.testarTreinamento) {
                  props.testarTreinamento(
                    treinamento
                  );
                }
              }}
            />
          );
        }

        return (
          <ModoTesteTreinamentoPage
            dataverse={
              props.dataverseService
            }
            treinamento={
              emTeste
            }
            onSair={() => {
              if (props.sairModoTeste) {
                props.sairModoTeste();
              } else {
                props.navegar(
                  'catalogoTreinamentos'
                );
              }
            }}
          />
        );
      }

      case 'gestao':

        return (
          <GestaoPage

            treinamentos={
              props
                .treinamentosAdministrativos
            }

            carregando={
              props
                .carregandoGestaoTreinamentos
            }

            erro={
              props
                .erroGestaoTreinamentos
            }

            processandoId={
              props
                .processandoTreinamentoId
            }

            onNovoTreinamento={() =>
              props.navegar(
                'novoTreinamento'
              )
            }

            // Atalhos exibidos apenas quando o perfil pode acessar
            // a rota de destino (ex.: o Editor não vê "Atribuir",
            // "Áreas e acessos" e "Indicadores").
            //
            // "Minha equipe", "Documentos" e "Conformidade" NÃO são
            // passados: já existem como abas do módulo e foram
            // retirados da tela de Gestão.
            onAtribuirTreinamento={
              podeAcessarRota(
                'atribuirTreinamento',
                props.contextoAcesso
              )
                ? () =>
                  props.navegar(
                    'atribuirTreinamento'
                  )
                : undefined
            }

            onTrilhas={
              podeAcessarRota(
                'gestaoTrilhas',
                props.contextoAcesso
              )
                ? () =>
                  props.navegar(
                    'gestaoTrilhas'
                  )
                : undefined
            }

            onAreas={
              podeAcessarRota(
                'gestaoAreas',
                props.contextoAcesso
              )
                ? () =>
                  props.navegar(
                    'gestaoAreas'
                  )
                : undefined
            }

            onEditarTreinamento={
              props.abrirFluxoEdicaoTreinamento
            }

            onDefinirAtivo={
              props.definirTreinamentoAtivo
            }

            onModulos={() =>
              props.navegar(
                'gestaoModulos'
              )
            }

            onAvaliacoes={() =>
              props.navegar(
                'gestaoAvaliacoes'
              )
            }

            onIndicadores={
              podeAcessarRota(
                'indicadores',
                props.contextoAcesso
              )
                ? () =>
                  props.navegar(
                    'indicadores'
                  )
                : undefined
            }

            onCarregarHistorico={
              props.carregarHistoricoTreinamento
            }

            onTestarTreinamento={
              podeAcessarRota(
                'testeTreinamento',
                props.contextoAcesso
              )
                ? props.testarTreinamento
                : undefined
            }

            // Remover: somente Administrador.
            onAnalisarRemocao={
              props.contextoAcesso?.perfil ===
              'Administrador'
                ? props.analisarRemocaoTreinamento
                : undefined
            }

            onRemoverTreinamento={
              props.contextoAcesso?.perfil ===
              'Administrador'
                ? props.removerTreinamento
                : undefined
            }
          />
        );

      // ========================================================
      // NOVO TREINAMENTO
      // ========================================================
      case 'gestaoTrilhas':

        return (
          <GestaoTrilhasPage

            trilhas={
              props
                .trilhasAdministrativas
            }

            trilhaSelecionada={
              props
                .trilhaAdministrativaSelecionada
            }

            treinamentosTrilha={
              props
                .treinamentosTrilhaAdministrativa
            }

            areasTrilha={
              props
                .areasTrilhaAdministrativa
            }

            treinamentos={
              props
                .treinamentosAdministrativos
            }

            areas={
              props
                .areasAdministrativas
            }

            carregando={
              props
                .carregandoGestaoTrilhas
            }

            carregandoConteudo={
              props
                .carregandoConteudoTrilha
            }

            processando={
              props
                .processandoGestaoTrilhas
            }

            erro={
              props
                .erroGestaoTrilhas
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onSelecionarTrilha={
              props
                .selecionarTrilhaAdministrativa
            }

            onLimparSelecao={
              props
                .limparTrilhaAdministrativa
            }

            onCriarTrilha={
              props
                .criarTrilhaAdministrativa
            }

            onEditarTrilha={
              props
                .editarTrilhaAdministrativa
            }

            onDefinirTrilhaAtiva={
              props
                .definirTrilhaAtiva
            }

            onSalvarTreinamentos={
              props
                .salvarTreinamentosTrilha
            }

            onSalvarAreas={
              props
                .salvarAreasTrilha
            }
          />
        );
      case 'novoTreinamento':

        return (
          <NovoTreinamentoPage
            areas={
              props.areasAdministrativas
            }

            treinamentoExistente={
              props.fluxoCriacaoTreinamentoId
                ? props.treinamentosAdministrativos
                  .find(
                    item =>
                      item.id ===
                      props.fluxoCriacaoTreinamentoId
                  )
                : undefined
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onSalvar={
              props.salvarNovoTreinamento
            }

            onAtualizar={
              props.atualizarTreinamentoFluxo
            }

            // Somente o Administrador altera o sequencial depois da
            // criação (validado também no servidor pelo plugin).
            podeEditarSequencial={
              props.contextoAcesso
                ?.perfil ===
              'Administrador'
            }

            onEtapaClick={
              props.navegarEtapaFluxoTreinamento
            }
          />
        );

      // ========================================================
      // ATRIBUIR TREINAMENTO
      // ========================================================
      case 'atribuirTreinamento':

        return (
          <AtribuirTreinamentoPage

            usuarios={
              props.usuariosAtribuicao
            }

            treinamentos={
              props.treinamentosAdministrativos
            }

            trilhas={
              props.trilhasAtribuicao
            }

            carregando={
              props.carregandoAtribuicoes
            }

            processando={
              props.processandoAtribuicao
            }

            erro={
              props.erroAtribuicao
            }

            resultado={
              props.resultadoAtribuicao
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onAtribuir={
              props.processarAtribuicao
            }

            atribuicaoAreaService={
              props.atribuicaoAreaService
            }

            areas={
              props.areasAdministrativas
            }

            usuariosAreas={
              props.usuariosAreasAdministrativos
            }

            onLimparResultado={
              props.limparResultadoAtribuicao
            }
          />
        );

      // ========================================================
      // EQUIPE
      // ========================================================

      case 'equipe':

        return (
          <EquipePage
            colaboradores={
              props.colaboradores
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }
          />
        );

      // ========================================================
      // AVALIAÇÃO
      // ========================================================

      case 'avaliacao':

        return (
          <AvaliacaoPage
            avaliacao={
              props.avaliacao
            }

            carregando={
              props.carregandoAvaliacao
            }

            erro={
              props.erroAvaliacao
            }

            tentativas={
              props.tentativasAvaliacao
            }

            envioPreparado={
              props.envioAvaliacaoPreparado
            }

            resultado={
              props.resultadoAvaliacao
            }

            processando={
              props.processandoAvaliacao
            }

            onVoltar={() =>
              props.navegar(
                'executarTreinamento'
              )
            }

            onEnviar={
              props.enviarAvaliacao
            }
          />
        );

      case 'gestaoAvaliacoes':

        return (
          <GestaoAvaliacoesPage

            treinamentos={
              props.treinamentosAdministrativos
            }

            treinamentoId={
              props.treinamentoAvaliacaoSelecionadoId
            }

            avaliacaoSelecionada={
              props.avaliacaoAdministrativaSelecionada
            }

            questaoSelecionada={
              props.questaoAdministrativaSelecionada
            }

            avaliacoes={
              props.avaliacoesAdministrativas
            }

            questoes={
              props.questoesAdministrativas
            }

            alternativas={
              props.alternativasAdministrativas
            }

            carregando={
              props.carregandoGestaoAvaliacoes
            }

            processando={
              props.processandoGestaoAvaliacoes
            }

            erro={
              props.erroGestaoAvaliacoes
            }

            modoFluxo={
              !!props.fluxoCriacaoTreinamentoId &&
              props.fluxoCriacaoTreinamentoId ===
              props.treinamentoAvaliacaoSelecionadoId
            }

            onConcluir={
              props.concluirFluxoCriacaoTreinamento
            }

            onEtapaClick={
              props.navegarEtapaFluxoTreinamento
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onSelecionarTreinamento={
              props.selecionarTreinamentoAvaliacao
            }

            onSelecionarAvaliacao={
              props.selecionarAvaliacaoAdministrativa
            }

            onSelecionarQuestao={
              props.selecionarQuestaoAdministrativa
            }

            onCriarAvaliacao={
              props.criarAvaliacaoAdministrativa
            }

            onEditarAvaliacao={
              props.editarAvaliacaoAdministrativa
            }

            onDefinirAvaliacaoAtiva={
              props.definirAvaliacaoAtiva
            }

            onCriarQuestao={
              props.criarQuestaoAdministrativa
            }

            onCriarQuestaoCompleta={
              props.criarQuestaoCompletaAdministrativa
            }

            onEditarQuestao={
              props.editarQuestaoAdministrativa
            }

            onDefinirQuestaoAtiva={
              props.definirQuestaoAtiva
            }

            onCriarAlternativa={
              props.criarAlternativaAdministrativa
            }

            onEditarAlternativa={
              props.editarAlternativaAdministrativa
            }

            onDefinirAlternativaAtiva={
              props.definirAlternativaAtiva
            }

            onImportarJson={
              props.importarAvaliacaoJson
            }
          />
        );

      case 'gestaoModulos':

        return (
          <GestaoModulosPage

            treinamentos={
              props
                .treinamentosAdministrativos
            }

            treinamentoId={
              props
                .treinamentoModuloSelecionadoId
            }

            modulos={
              props
                .modulosAdministrativos
            }

            carregando={
              props
                .carregandoGestaoModulos
            }

            processando={
              props
                .processandoGestaoModulos
            }

            erro={
              props
                .erroGestaoModulos
            }

            modoFluxo={
              !!props
                .fluxoCriacaoTreinamentoId &&
              props
                .fluxoCriacaoTreinamentoId ===
              props
                .treinamentoModuloSelecionadoId
            }

            onAvancar={
              props
                .avancarFluxoTreinamentoParaAvaliacao
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onSelecionarTreinamento={
              props
                .selecionarTreinamentoModulo
            }

            onCriar={
              props
                .criarModuloAdministrativo
            }

            onEditar={
              props
                .editarModuloAdministrativo
            }

            onDefinirAtivo={
              props
                .definirModuloAtivo
            }

            onReordenar={
              props
                .reordenarModulos
            }

            // Remover módulo: somente Administrador.
            onAnalisarRemocaoModulo={
              props.contextoAcesso?.perfil ===
              'Administrador'
                ? props.analisarRemocaoModulo
                : undefined
            }

            onRemoverModulo={
              props.contextoAcesso?.perfil ===
              'Administrador'
                ? props.removerModulo
                : undefined
            }

            onAnalisarJson={
              props
                .analisarModulosJson
            }

            onConfirmarImportacaoJson={
              props
                .confirmarImportacaoModulosJson
            }

            onEtapaClick={
              props
                .navegarEtapaFluxoTreinamento
            }

            moduloConteudoSelecionadoId={
              props
                .moduloConteudoSelecionadoId
            }

            conteudosModulo={
              props
                .conteudosModuloAdministrativos
            }

            carregandoConteudosModulo={
              props
                .carregandoConteudosModulo
            }

            processandoConteudosModulo={
              props
                .processandoConteudosModulo
            }

            erroConteudosModulo={
              props
                .erroConteudosModulo
            }

            onSelecionarModuloConteudo={
              props
                .selecionarModuloConteudo
            }

            onLimparModuloConteudo={
              props
                .limparModuloConteudo
            }

            onCriarConteudoModulo={
              props
                .criarConteudoModulo
            }

            onEditarConteudoModulo={
              props
                .editarConteudoModulo
            }

            onDefinirConteudoModuloAtivo={
              props
                .definirConteudoModuloAtivo
            }

            onMoverConteudoModuloAcima={
              props
                .moverConteudoModuloAcima
            }

            onMoverConteudoModuloAbaixo={
              props
                .moverConteudoModuloAbaixo
            }
          />
        );

      case 'gestaoAreas':

        return (
          <GestaoAreasPage
            areas={
              props.areasAdministrativas
            }

            usuarios={
              props.usuariosDisponiveisArea
            }

            usuariosAreas={
              props.usuariosAreasAdministrativos
            }

            carregando={
              props.carregandoGestaoAreas
            }

            processando={
              props.processandoGestaoAreas
            }

            erro={
              props.erroGestaoAreas
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onCriarArea={
              props.criarAreaAdministrativa
            }

            onEditarArea={
              props.editarAreaAdministrativa
            }

            onDefinirAreaAtiva={
              props.definirAreaAtiva
            }

            onVincularUsuario={
              props.vincularUsuarioArea
            }

            onEditarUsuarioArea={
              props.editarUsuarioArea
            }

            usuarioLogadoEmail={
              props.contextoAcesso
                ?.email
            }

            onDefinirUsuarioAreaAtivo={
              props.definirUsuarioAreaAtivo
            }
          />
        );
      // ========================================================
      // GESTÃO DOCUMENTAL
      // ========================================================

      case 'gestaoDocumentos':

        return (
          <GestaoDocumentosPage
            documentos={
              props
                .documentosAdministrativos
            }

            documentoSelecionado={
              props
                .documentoAdministrativoSelecionado
            }

            revisoes={
              props
                .revisoesAdministrativas
            }

            carregando={
              props
                .carregandoGestaoDocumentos
            }

            processando={
              props
                .processandoGestaoDocumentos
            }

            erro={
              props
                .erroGestaoDocumentos
            }

            processandoPublicacao={
              props
                .processandoPublicacao
            }

            erroPublicacao={
              props
                .erroPublicacao
            }

            resultadoPublicacao={
              props
                .resultadoPublicacao
            }

            contexto={
              props
                .contextoAcesso
            }

            usuariosAreas={
              props
                .usuariosAreasAdministrativos
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onSelecionarDocumento={
              props
                .selecionarDocumentoAdministrativo
            }

            onCriarRevisao={
              props
                .criarRevisaoAdministrativa
            }

            onLimparSelecao={
              props
                .limparDocumentoAdministrativo
            }

            onPublicarRevisao={
              props
                .publicarRevisao
            }

            onLimparResultadoPublicacao={
              props
                .limparResultadoPublicacao
            }
          
          vinculosTreinamentos={
            props.treinamentosDocumentoAdministrativos
          }

          treinamentosDisponiveis={
            props.treinamentosAdministrativos
          }

          carregandoTreinamentos={
            props.carregandoTreinamentosDocumento
          }

          processandoTreinamentos={
            props.processandoTreinamentosDocumento
          }

          erroTreinamentos={
            props.erroTreinamentosDocumento
          }

          onVincularTreinamento={
            props.vincularTreinamentoDocumento
          }

          onDesativarTreinamento={
            props.desativarTreinamentoDocumento
          }        
          onEnviarRevisao={
            props.enviarRevisaoParaRevisao
          }

          onEnviarAprovacao={
            props.enviarRevisaoParaAprovacao
          }

          onDevolverElaboracao={
            props.devolverRevisaoParaElaboracao
          }        />
        );

      // ========================================================
      // SUPORTE
      // ========================================================

      case 'suporte':

        return (
          <SuportePage />
        );

      // ========================================================
      // FALLBACK
      // ========================================================

      default:

        return (
          <InicioIntranetPage
            primeiroNome={
              props.primeiroNome
            }

            treinamentos={
              props.treinamentos
            }

            documentos={
              props.documentos
            }

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            quantidadeTrilhas={
              props.trilhas.length
            }

            onAbrirTreinamento={
              props.abrirTreinamento
            }

            onVerTreinamentos={() =>
              props.navegar(
                'treinamentos'
              )
            }

            onVerDocumentos={() =>
              props.navegar(
                'documentos'
              )
            }
          
            eventosCalendario={
              props.eventosCalendario
            }

            carregandoCalendario={
              props.carregandoCalendario
            }

            erroCalendario={
              props.erroCalendario
            }
          />
        );

      case 'gestaoConformidade':

        return (
          <GestaoConformidadePage
            itens={
              props.itensConformidade
            }

            resumo={
              props.resumoConformidade
            }

            carregando={
              props.carregandoConformidade
            }

            erro={
              props.erroConformidade
            }

            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }
          />

        );
      case 'indicadores':

        return (
          <IndicadoresPage
            itens={
              props.itensConformidade
            }

            resumo={
              props.resumoConformidade
            }

            onVoltar={() =>
              props.navegar(
                'inicio'
              )
            }
          />
        );

      // ========================================================
      // LICITAÇÕES (PNCP)
      // ========================================================

      case 'licitacoes':

        return (
          <LicitacoesBuscaPage
            onIrParaTeste={() =>
              props.navegar(
                'licitacoesTeste'
              )
            }
          />
        );

      case 'licitacoesTeste':

        return (
          <LicitacoesTesteConexaoPage
            onIrParaBusca={() =>
              props.navegar(
                'licitacoes'
              )
            }
          />
        );
    }

  };

export default PortalRouter;