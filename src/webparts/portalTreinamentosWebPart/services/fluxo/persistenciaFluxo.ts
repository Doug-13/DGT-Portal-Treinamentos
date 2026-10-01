import {
  DataverseService
} from '../DataverseService';

import {
  fluxoNoDataverse
} from '../../constants/featureFlags';

import {
  FluxoCatalogoLocal,
  IFluxoCatalogo
} from './FluxoCatalogoLocal';

import {
  FluxoRepositorioLocal,
  IFluxoRepositorio
} from './FluxoRepositorioLocal';

import {
  FluxoService
} from './FluxoService';

import {
  IMetadadosRepositorio,
  MetadadosRepositorioLocal
} from '../processos/MetadadosProcessoService';

import {
  IProcessosRepositorio,
  ProcessosRepositorioLocal
} from '../processos/ProcessoService';

import {
  FluxoCatalogoDataverse
} from './dataverse/FluxoCatalogoDataverse';

import {
  FluxoRepositorioDataverse
} from './dataverse/FluxoRepositorioDataverse';

import {
  MetadadosRepositorioDataverse
} from './dataverse/MetadadosRepositorioDataverse';

import {
  ProcessosRepositorioDataverse
} from './dataverse/ProcessosRepositorioDataverse';

// ============================================================
// ONDE O FLUXO CONFIGURÁVEL GRAVA OS DADOS
//
// Decide, pela feature flag FLUXO_PERSISTENCIA, se as telas usam o
// Dataverse (produção) ou o navegador (teste). Todas as telas pegam
// as peças daqui, então a troca não exige mudar nenhuma tela.
// ============================================================

export interface IPersistenciaFluxo {
  // true = modo de teste (navegador, usuários simulados).
  local: boolean;

  catalogo: IFluxoCatalogo;
  repositorio: IFluxoRepositorio;
  processos: IProcessosRepositorio;
  metadados: IMetadadosRepositorio;
  servico: FluxoService;
}

let persistenciaLocal: IPersistenciaFluxo | undefined;

const porServico: Array<{ dataverse: DataverseService; persistencia: IPersistenciaFluxo }> = [];

const montar = (
  catalogo: IFluxoCatalogo,
  repositorio: IFluxoRepositorio,
  processos: IProcessosRepositorio,
  metadados: IMetadadosRepositorio
): IPersistenciaFluxo => ({
  local: repositorio.local,
  catalogo,
  repositorio,
  processos,
  metadados,
  servico: new FluxoService(repositorio, catalogo, metadados)
});

export const obterPersistenciaFluxo = (
  dataverse?: DataverseService
): IPersistenciaFluxo => {

  if (fluxoNoDataverse() && dataverse) {

    const existente =
      porServico.find(item => item.dataverse === dataverse);

    if (existente) {
      return existente.persistencia;
    }

    const persistencia =
      montar(
        new FluxoCatalogoDataverse(dataverse),
        new FluxoRepositorioDataverse(dataverse),
        new ProcessosRepositorioDataverse(dataverse),
        new MetadadosRepositorioDataverse(dataverse)
      );

    porServico.push({ dataverse, persistencia });

    return persistencia;
  }

  if (!persistenciaLocal) {
    persistenciaLocal =
      montar(
        new FluxoCatalogoLocal(),
        new FluxoRepositorioLocal(),
        new ProcessosRepositorioLocal(dataverse),
        new MetadadosRepositorioLocal()
      );
  }

  return persistenciaLocal;
};
