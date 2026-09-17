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
  IAdicionarTreinamentoTrilha,
  IEditarTreinamentoTrilha,
  IEditarTrilha,
  INovaTrilha,
  ITrilhaAdmin,
  ITrilhaTreinamentoAdmin
} from '../services/TrilhaAdminService';

import {
  IEditarTreinamento,
  INovoTreinamento,
  ITreinamentoAdmin
} from '../services/TreinamentoAdminService';

import AvaliacaoPage from
  '../pages/Avaliacao/AvaliacaoPage';

import InicioPage from
  '../pages/Inicio/InicioPage';

import MeusTreinamentosPage from
  '../pages/Treinamentos/MeusTreinamentosPage';

import ExecutarTreinamentoPage from
  '../pages/Treinamentos/ExecutarTreinamentoPage';

import DocumentosPage from
  '../pages/Documentos/DocumentosPage';

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

import GestaoAvaliacoesPage from
  '../pages/Gestao/GestaoAvaliacoesPage';

import GestaoDocumentosPage from
  '../pages/Gestao/GestaoDocumentosPage';

import {
  IDocumentoAdmin,
  INovaRevisaoDocumento,
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

  treinamentosAdministrativos:
  ITreinamentoAdmin[];

  carregandoGestaoTreinamentos:
  boolean;

  erroGestaoTreinamentos:
  string;

  processandoTreinamentoId:
  string;

  editarTreinamento:
  (
    dados:
      IEditarTreinamento
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

  // ============================================================
  // GESTÃO DOCUMENTAL ADMINISTRATIVA
  // ============================================================

  documentosAdministrativos:
  IDocumentoAdmin[];

  documentoAdministrativoSelecionado?:
  IDocumentoAdmin;

  revisoesAdministrativas:
  IRevisaoAdmin[];

  carregandoGestaoDocumentos:
  boolean;

  processandoGestaoDocumentos:
  boolean;

  erroGestaoDocumentos:
  string;

  selecionarDocumentoAdministrativo:
  (
    documento:
      IDocumentoAdmin
  ) => Promise<void>;

  criarRevisaoAdministrativa:
  (
    dados:
      INovaRevisaoDocumento
  ) => Promise<void>;

  limparDocumentoAdministrativo:
  () => void;

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
  ) => Promise<void>;

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

  adicionarTreinamentoTrilha:
  (
    dados:
      IAdicionarTreinamentoTrilha
  ) => Promise<void>;

  editarTreinamentoTrilha:
  (
    dados:
      IEditarTreinamentoTrilha
  ) => Promise<void>;

  removerTreinamentoTrilha:
  (
    relacaoId:
      string
  ) => Promise<void>;

  // ============================================================
  // ADMINISTRAÇÃO DE TREINAMENTOS
  // ============================================================

  salvarNovoTreinamento:
  (
    dados:
      INovoTreinamento
  ) => Promise<void>;

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
          <InicioPage
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

            onConcluirModulo={
              props.concluirModulo
            }

            onIniciarAvaliacao={
              props.iniciarAvaliacao
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

      case 'documentos':

        return (
          <DocumentosPage
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

            onEquipe={() =>
              props.navegar(
                'equipe'
              )
            }

            onEditarTreinamento={
              props.editarTreinamento
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

            treinamentos={
              props
                .treinamentosAdministrativos
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

            onAdicionarTreinamento={
              props
                .adicionarTreinamentoTrilha
            }

            onEditarTreinamento={
              props
                .editarTreinamentoTrilha
            }

            onRemoverTreinamento={
              props
                .removerTreinamentoTrilha
            }
          />
        );
      case 'novoTreinamento':

        return (
          <NovoTreinamentoPage
            onVoltar={() =>
              props.navegar(
                'gestao'
              )
            }

            onSalvar={
              props.salvarNovoTreinamento
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
          />
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
          <InicioPage
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
          />
        );
    }
  };

export default PortalRouter;