import * as React from 'react';

import {
  IFluxoDefinicao,
  IFluxoMetadado
} from '../models/Fluxo';

import {
  migrarMetadadosDasVersoes,
  salvarMetadadosProcesso
} from '../services/processos/MetadadosProcessoService';

import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../models/Processo';

import {
  DataverseService
} from '../services/DataverseService';

import {
  fluxoCatalogo
} from '../services/fluxo/FluxoCatalogoLocal';

import {
  carregarDadosProcessos,
  criarProcessoTeste,
  definirProcessoPrincipalTeste,
  IDocumentoReferencia,
  INovoProcessoTeste,
  removerVinculoTeste,
  vincularDocumentoTeste
} from '../services/processos/ProcessoService';

// ============================================================
// HOOK — MÓDULO PROCESSOS (modo de teste)
//
// Lê processos e vínculos do Dataverse (somente leitura) e junta
// com os dados de teste do navegador. Os fluxos de cada processo
// ficam no catálogo local.
// ============================================================

export interface IUseProcessos {
  carregando: boolean;
  erro: string;
  aviso: string;
  processos: IProcesso[];
  vinculos: IDocumentoProcessoVinculo[];

  // Versões do fluxo por processo (mais nova primeiro).
  fluxosPorProcesso: Record<string, IFluxoDefinicao[]>;

  // Metadados de cada processo, na ordem das telas.
  metadadosPorProcesso: Record<string, IFluxoMetadado[]>;

  salvarMetadados: (processoId: string, metadados: IFluxoMetadado[]) => void;

  recarregar: (forcarReleitura?: boolean) => Promise<void>;
  criarProcesso: (dados: INovoProcessoTeste) => { ok: boolean; erro: string; processo?: IProcesso };
  vincularDocumento: (documentoId: string, processoId: string) => Promise<void>;
  removerVinculo: (vinculoId: string) => Promise<void>;
  definirPrincipal: (documentoId: string, processoId: string) => Promise<void>;
}

export const useProcessos = (
  dataverseService?: DataverseService,
  documentos: IDocumentoReferencia[] = []
): IUseProcessos => {

  // Só os códigos importam para resolver vínculos; evita recarregar
  // a cada nova referência do array.
  const documentosRef =
    React.useRef<IDocumentoReferencia[]>(documentos);

  documentosRef.current = documentos;


  const [carregando, setCarregando] =
    React.useState<boolean>(true);

  const [erro, setErro] =
    React.useState<string>('');

  const [aviso, setAviso] =
    React.useState<string>('');

  const [processos, setProcessos] =
    React.useState<IProcesso[]>([]);

  const [vinculos, setVinculos] =
    React.useState<IDocumentoProcessoVinculo[]>([]);

  const [fluxosPorProcesso, setFluxosPorProcesso] =
    React.useState<Record<string, IFluxoDefinicao[]>>({});

  const [metadadosPorProcesso, setMetadadosPorProcesso] =
    React.useState<Record<string, IFluxoMetadado[]>>({});

  const recarregar =
    React.useCallback(
      async (
        forcarReleitura: boolean = false
      ): Promise<void> => {

        setCarregando(true);
        setErro('');

        try {

          const dados =
            await carregarDadosProcessos(
              dataverseService,
              forcarReleitura,
              documentosRef.current
            );

          const fluxos: Record<string, IFluxoDefinicao[]> = {};

          const metadados: Record<string, IFluxoMetadado[]> = {};

          for (const processo of dados.processos) {
            fluxos[processo.id] =
              await fluxoCatalogo.listarVersoes(processo.id);

            metadados[processo.id] =
              migrarMetadadosDasVersoes(processo.id, fluxos[processo.id]);
          }

          setProcessos(dados.processos);
          setVinculos(dados.vinculos);
          setAviso(dados.aviso);
          setFluxosPorProcesso(fluxos);
          setMetadadosPorProcesso(metadados);

        } catch (error) {

          console.error(error);

          setErro('Não foi possível carregar os processos.');

        } finally {
          setCarregando(false);
        }
      },
      [dataverseService]
    );

  React.useEffect(
    () => {
      recarregar()
        .catch(
          (error: unknown) => console.error(error)
        );
    },
    [recarregar]
  );

  return {
    carregando,
    erro,
    aviso,
    processos,
    vinculos,
    fluxosPorProcesso,
    metadadosPorProcesso,
    recarregar,

    // Grava na hora: os metadados não dependem de rascunho.
    salvarMetadados: (processoId: string, metadados: IFluxoMetadado[]) => {
      salvarMetadadosProcesso(processoId, metadados);
      setMetadadosPorProcesso(
        atual => ({ ...atual, [processoId]: metadados })
      );
    },

    criarProcesso: (dados: INovoProcessoTeste) => {

      const resultado =
        criarProcessoTeste(dados, processos);

      if (resultado.ok) {
        recarregar()
          .catch(
            (error: unknown) => console.error(error)
          );
      }

      return resultado;
    },

    vincularDocumento: async (documentoId: string, processoId: string) => {
      vincularDocumentoTeste(documentoId, processoId, vinculos);
      await recarregar();
    },

    removerVinculo: async (vinculoId: string) => {
      removerVinculoTeste(vinculoId);
      await recarregar();
    },

    definirPrincipal: async (documentoId: string, processoId: string) => {
      definirProcessoPrincipalTeste(documentoId, processoId);
      await recarregar();
    }
  };
};
