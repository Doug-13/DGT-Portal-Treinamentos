import { ITreinamentoDocumentoAdmin } from '../services/TreinamentoDocumentoAdminService';
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

import DocumentoDetalhePage from
  '../pages/Documentos/DocumentoDetalhePage';

import HistoricoPage from
  '../pages/Historico/HistoricoPage';

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

import AcessoNegadoPage from
  '../pages/AcessoNegadoPage';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
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

  importarModulosJson:
  (
    arquivo:
      File
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

    if (
      props.erroAutorizacao
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
        />
      );
    }

    const permissaoRota =
      verificarPermissaoRota(
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
      // ========================================================
      // VISAO GERAL DE TREINAMENTOS
      // ========================================================

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

            carregando={
              props.carregandoDataverse
            }

            erro={
              props.erroDataverse
            }

            onAbrirDocumento={
              props.abrirDocumento
            }
          
            onNovoDocumento={() =>
              props.navegar('novoDocumento')
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

            onVoltar={() =>
              props.navegar(
                'documentos'
              )
            }
          />
        );

      // ========================================================
      // HISTÓRICO
      // ========================================================

      case 'historico':

        return (
          <HistoricoPage
            historico={
              props.historico
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

            onAtribuirTreinamento={() =>
              props.navegar(
                'atribuirTreinamento'
              )
            }

            onTrilhas={() =>
              props.navegar(
                'gestaoTrilhas'
              )
            }
            onAreas={() =>
              props.navegar(
                'gestaoAreas'
              )
            }
            onEquipe={() =>
              props.navegar(
                'equipe'
              )
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

            onDocumentos={() =>
              props.navegar(
                'gestaoDocumentos'
              )
            }

            onConformidade={() =>
              props.navegar(
                'gestaoConformidade'
              )
            }
            onIndicadores={() =>
              props.navegar(
                'indicadores'
              )
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

            onImportarJson={
              props
                .importarModulosJson
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
    }

  };

export default PortalRouter;









