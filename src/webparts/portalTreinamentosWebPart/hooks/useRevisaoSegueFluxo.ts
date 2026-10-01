import * as React from 'react';

import {
  IDocumento
} from '../models/Documento';

import {
  DataverseService
} from '../services/DataverseService';

import {
  FEATURE_FLAGS,
  fluxoNoDataverse
} from '../constants/featureFlags';

import {
  obterPersistenciaFluxo
} from '../services/fluxo/persistenciaFluxo';

import {
  processoPrincipalDoDocumento
} from '../services/processos/ProcessoService';

// ============================================================
// A REVISÃO EM ANDAMENTO SEGUE UM FLUXO DE PROCESSO?
//
// Sim quando (modo Dataverse):
//   - a revisão já tem estado de fluxo gravado; ou
//   - o documento tem processo principal com fluxo publicado
//     (o fluxo começa ao abrir a aba "Fluxo de revisão").
// Nesses casos, os botões do fluxo fixo antigo (aba Revisão) são
// substituídos pelo fluxo do processo.
// ============================================================

export interface IRevisaoSegueFluxo {
  segue: boolean;
  processoNome: string;
  verificando: boolean;
}

export const useRevisaoSegueFluxo = (
  documento: IDocumento | undefined,
  revisaoEmAndamentoId: string | undefined,
  dataverseService?: DataverseService
): IRevisaoSegueFluxo => {

  const [estado, setEstado] =
    React.useState<IRevisaoSegueFluxo>({ segue: false, processoNome: '', verificando: false });

  React.useEffect(
    () => {

      if (
        !FEATURE_FLAGS.FLUXO_CONFIGURAVEL_TESTE ||
        !fluxoNoDataverse() ||
        !dataverseService ||
        !documento ||
        !revisaoEmAndamentoId
      ) {
        setEstado({ segue: false, processoNome: '', verificando: false });
        return;
      }

      let cancelado = false;

      const verificar = async (): Promise<void> => {

        setEstado(atual => ({ ...atual, verificando: true }));

        const persistencia =
          obterPersistenciaFluxo(dataverseService);

        try {

          const instancia =
            await persistencia.repositorio.obter(revisaoEmAndamentoId);

          if (instancia) {
            if (!cancelado) {
              setEstado({ segue: true, processoNome: instancia.processoNome || '', verificando: false });
            }
            return;
          }

          const dados =
            await persistencia.processos.carregar(false, [{ id: documento.id, codigo: documento.codigo }]);

          const principalId =
            processoPrincipalDoDocumento(documento.id, dados.vinculos);

          const processo =
            principalId ? dados.processos.find(item => item.id === principalId) : undefined;

          const publicada =
            processo ? await persistencia.catalogo.versaoPublicada(processo.id) : undefined;

          if (!cancelado) {
            setEstado({
              segue: !!publicada,
              processoNome: processo ? processo.nome : '',
              verificando: false
            });
          }

        } catch (error) {

          // Tabelas ainda não criadas ou sem permissão: mantém o fluxo antigo.
          console.error(error);

          if (!cancelado) {
            setEstado({ segue: false, processoNome: '', verificando: false });
          }
        }
      };

      verificar()
        .catch((error: unknown) => console.error(error));

      return () => {
        cancelado = true;
      };
    },
    [documento?.id, revisaoEmAndamentoId, dataverseService]
  );

  return estado;
};
