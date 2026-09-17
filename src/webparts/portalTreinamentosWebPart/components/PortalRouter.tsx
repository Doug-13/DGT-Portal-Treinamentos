import * as React from 'react';
import { Pagina } from '../constants/routes';
import { ITreinamento, IHistorico, ICertificado } from '../models/Treinamento';
import { IModuloTreinamento } from '../models/Modulo';
import { IDocumento } from '../models/Documento';
import { IColaborador } from '../models/Usuario';
import { IAvaliacao, IEnvioAvaliacao, IEstadoTentativasAvaliacao, IResultadoAvaliacao } from '../models/Avaliacao';
import AvaliacaoPage from '../pages/Avaliacao/AvaliacaoPage';
import InicioPage from '../pages/Inicio/InicioPage';
import MeusTreinamentosPage from '../pages/Treinamentos/MeusTreinamentosPage';
import ExecutarTreinamentoPage from '../pages/Treinamentos/ExecutarTreinamentoPage';
import DocumentosPage from '../pages/Documentos/DocumentosPage';
import HistoricoPage from '../pages/Historico/HistoricoPage';
import CertificadosPage from '../pages/Certificados/CertificadosPage';
import TrilhasPage from '../pages/Trilhas/TrilhasPage';
import SuportePage from '../pages/Suporte/SuportePage';
import GestaoPage from '../pages/Gestao/GestaoPage';
import NovoTreinamentoPage from '../pages/Gestao/NovoTreinamentoPage';
import AtribuirTreinamentoPage from '../pages/Gestao/AtribuirTreinamentoPage';
import EquipePage from '../pages/Gestao/EquipePage';

export interface IPortalRouterProps {
  pagina: Pagina;
  primeiroNome: string;
  treinamentos: ITreinamento[];
  treinamentoSelecionado: ITreinamento | null;
  documentos: IDocumento[];
  historico: IHistorico[];
  certificados: ICertificado[];
  colaboradores?: IColaborador[];
  quantidadeTrilhas: number;
  carregandoDataverse: boolean;
  erroDataverse: string;
  modulos: IModuloTreinamento[];
  carregandoModulos: boolean;
  erroModulos: string;
  erroExecucao: string;
  processandoModuloId: string;
  iniciandoTreinamento: boolean;
  progressoModulos: number;
  avaliacaoLiberada: boolean;
  navegar: (pagina: Pagina) => void;
  abrirTreinamento: (treinamento: ITreinamento) => void;
  iniciarTreinamento: () => void;
  iniciarModulo: (modulo: IModuloTreinamento) => void;
  concluirModulo: (modulo: IModuloTreinamento) => void;
  iniciarAvaliacao: () => void;
  avaliacao?: IAvaliacao;
  carregandoAvaliacao: boolean;
  erroAvaliacao: string;
  tentativasAvaliacao: IEstadoTentativasAvaliacao;
  envioAvaliacaoPreparado?: IEnvioAvaliacao;
  resultadoAvaliacao?: IResultadoAvaliacao;
  processandoAvaliacao: boolean;
  enviarAvaliacao: (respostas: Record<string, string[]>) => void;
}

const PortalRouter: React.FC<IPortalRouterProps> = props => {
  switch (props.pagina) {
    case 'treinamentos':
      return (
        <MeusTreinamentosPage
          treinamentos={props.treinamentos}
          carregando={props.carregandoDataverse}
          erro={props.erroDataverse}
          onAbrirTreinamento={props.abrirTreinamento}
        />
      );

    case 'executarTreinamento':
      return props.treinamentoSelecionado ? (
        <ExecutarTreinamentoPage
          treinamento={props.treinamentoSelecionado}
          modulos={props.modulos}
          carregandoModulos={props.carregandoModulos}
          erroModulos={props.erroModulos}
          erroExecucao={props.erroExecucao}
          processandoModuloId={props.processandoModuloId}
          iniciandoTreinamento={props.iniciandoTreinamento}
          progresso={props.progressoModulos}
          avaliacaoLiberada={props.avaliacaoLiberada}
          onVoltar={() => props.navegar('treinamentos')}
          onIniciarTreinamento={props.iniciarTreinamento}
          onIniciarModulo={props.iniciarModulo}
          onConcluirModulo={props.concluirModulo}
          onIniciarAvaliacao={props.iniciarAvaliacao}
        />
      ) : (
        <MeusTreinamentosPage
          treinamentos={props.treinamentos}
          carregando={props.carregandoDataverse}
          erro={props.erroDataverse}
          onAbrirTreinamento={props.abrirTreinamento}
        />
      );

    case 'documentos':
      return <DocumentosPage documentos={props.documentos} />;

    case 'historico':
      return <HistoricoPage historico={props.historico} />;

    case 'certificados':
      return <CertificadosPage certificados={props.certificados} />;

    case 'trilhas':
      return <TrilhasPage quantidadeTrilhasUsuario={props.quantidadeTrilhas} />;

    case 'suporte':
      return <SuportePage />;

    case 'gestao':
      return (
        <GestaoPage
          onNovoTreinamento={() => props.navegar('novoTreinamento')}
          onAtribuirTreinamento={() => props.navegar('atribuirTreinamento')}
          onTrilhas={() => props.navegar('trilhas')}
          onEquipe={() => props.navegar('equipe')}
        />
      );

    case 'novoTreinamento':
      return <NovoTreinamentoPage onVoltar={() => props.navegar('gestao')} />;

    case 'atribuirTreinamento':
      return <AtribuirTreinamentoPage onVoltar={() => props.navegar('gestao')} />;

    case 'equipe':
      return (
        <EquipePage
          colaboradores={props.colaboradores}
          onVoltar={() => props.navegar('gestao')}
        />
      );

    case 'avaliacao':
      return (
        <AvaliacaoPage
          avaliacao={props.avaliacao}
          carregando={props.carregandoAvaliacao}
          erro={props.erroAvaliacao}
          tentativas={props.tentativasAvaliacao}
          envioPreparado={props.envioAvaliacaoPreparado}
          resultado={props.resultadoAvaliacao}
          processando={props.processandoAvaliacao}
          onVoltar={() => props.navegar('executarTreinamento')}
          onEnviar={props.enviarAvaliacao}
        />
      );

    case 'inicio':
      return (
        <InicioPage
          primeiroNome={props.primeiroNome}
          treinamentos={props.treinamentos}
          documentos={props.documentos}
          carregando={props.carregandoDataverse}
          erro={props.erroDataverse}
          quantidadeTrilhas={props.quantidadeTrilhas}
          onAbrirTreinamento={props.abrirTreinamento}
          onVerTreinamentos={() => props.navegar('treinamentos')}
          onVerDocumentos={() => props.navegar('documentos')}
        />
      );

    default:
      return (
        <InicioPage
          primeiroNome={props.primeiroNome}
          treinamentos={props.treinamentos}
          documentos={props.documentos}
          carregando={props.carregandoDataverse}
          erro={props.erroDataverse}
          quantidadeTrilhas={props.quantidadeTrilhas}
          onAbrirTreinamento={props.abrirTreinamento}
          onVerTreinamentos={() => props.navegar('treinamentos')}
          onVerDocumentos={() => props.navegar('documentos')}
        />
      );
  }
};

export default PortalRouter;
