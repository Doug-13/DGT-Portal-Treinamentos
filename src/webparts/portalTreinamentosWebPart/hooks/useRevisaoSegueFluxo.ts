import * as React from 'react';

import {
  IDocumento
} from '../models/Documento';

import {
  IFluxoResponsavel
} from '../models/Fluxo';

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
  iniciarInstancia
} from '../services/fluxo/FluxoEngine';

import {
  carregarUsuariosPortal,
  carregarVinculosPortal,
  obterAutorDaRevisao
} from '../services/fluxo/AutorRevisaoService';

import {
  descreverResolvido,
  resolverResponsaveis
} from '../services/fluxo/ResolvedorResponsaveis';

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
// substituídos pelo fluxo do processo, e o card "Responsável" do
// documento mostra QUEM está com a etapa atual.
// ============================================================

export interface IRevisaoSegueFluxo {
  segue: boolean;
  processoNome: string;
  verificando: boolean;

  // Etapa atual e responsáveis (nomes reais), quando segue o fluxo.
  etapaAtual: string;
  responsaveisAtuais: string[];
}

const VAZIO: IRevisaoSegueFluxo = {
  segue: false,
  processoNome: '',
  verificando: false,
  etapaAtual: '',
  responsaveisAtuais: []
};

export const useRevisaoSegueFluxo = (
  documento: IDocumento | undefined,
  revisaoEmAndamentoId: string | undefined,
  dataverseService?: DataverseService,
  // Muda a cada ação no fluxo, para recarregar.
  versao: number = 0
): IRevisaoSegueFluxo => {

  const [estado, setEstado] =
    React.useState<IRevisaoSegueFluxo>(VAZIO);

  React.useEffect(
    () => {

      if (
        !FEATURE_FLAGS.FLUXO_CONFIGURAVEL_TESTE ||
        !fluxoNoDataverse() ||
        !dataverseService ||
        !documento ||
        !revisaoEmAndamentoId
      ) {
        setEstado(VAZIO);
        return;
      }

      let cancelado = false;

      const descrever = async (
        responsaveis: IFluxoResponsavel[]
      ): Promise<string[]> => {

        const [autor, vinculos, usuarios] =
          await Promise.all([
            obterAutorDaRevisao(dataverseService, revisaoEmAndamentoId),
            carregarVinculosPortal(dataverseService),
            carregarUsuariosPortal(dataverseService)
          ]);

        return resolverResponsaveis(
          responsaveis,
          { revisaoResponsavelId: autor, documentoAreaId: documento.areaId }
        ).map(item => descreverResolvido(item, vinculos, usuarios));
      };

      const verificar = async (): Promise<void> => {

        setEstado(atual => ({ ...atual, verificando: true }));

        const persistencia =
          obterPersistenciaFluxo(dataverseService);

        try {

          const instancia =
            await persistencia.repositorio.obter(revisaoEmAndamentoId);

          if (instancia) {

            const tarefa =
              instancia.status === 'concluido'
                ? undefined
                : instancia.tarefas.find(item => item.status === 'pendente');

            const responsaveis =
              tarefa ? await descrever(tarefa.responsaveis) : [];

            if (!cancelado) {
              setEstado({
                segue: true,
                processoNome: instancia.processoNome || '',
                verificando: false,
                etapaAtual: tarefa ? tarefa.elementoNome : '',
                responsaveisAtuais: responsaveis
              });
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

          if (!publicada) {
            if (!cancelado) {
              setEstado({ ...VAZIO, processoNome: processo ? processo.nome : '' });
            }
            return;
          }

          // Fluxo ainda não iniciado: a 1ª etapa (simulada, sem gravar).
          const simulacao =
            iniciarInstancia(publicada, {
              revisaoId: revisaoEmAndamentoId,
              documentoId: documento.id,
              revisao: '',
              ator: { id: '', nome: '', papeisTeste: [] },
              simulado: true
            });

          const primeira =
            simulacao.instancia
              ? simulacao.instancia.tarefas.find(item => item.status === 'pendente')
              : undefined;

          const responsaveis =
            primeira ? await descrever(primeira.responsaveis) : [];

          if (!cancelado) {
            setEstado({
              segue: true,
              processoNome: processo ? processo.nome : '',
              verificando: false,
              etapaAtual: primeira ? primeira.elementoNome : '',
              responsaveisAtuais: responsaveis
            });
          }

        } catch (error) {

          // Tabelas ainda não criadas ou sem permissão: mantém o fluxo antigo.
          console.error(error);

          if (!cancelado) {
            setEstado(VAZIO);
          }
        }
      };

      verificar()
        .catch((error: unknown) => console.error(error));

      return () => {
        cancelado = true;
      };
    },
    [documento?.id, revisaoEmAndamentoId, dataverseService, versao]
  );

  return estado;
};
