import * as React from 'react';

import {
  IFluxoDefinicao,
  IFluxoMetadado
} from '../models/Fluxo';

import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../models/Processo';

import {
  DataverseService
} from '../services/DataverseService';

import {
  obterPersistenciaFluxo
} from '../services/fluxo/persistenciaFluxo';

import {
  IFluxoCatalogo
} from '../services/fluxo/FluxoCatalogoLocal';

import {
  IDocumentoReferencia,
  INovoProcessoTeste,
  IResultadoNovoProcesso
} from '../services/processos/ProcessoService';

// ============================================================
// HOOK — MÓDULO PROCESSOS
//
// Processos, vínculos, fluxos e metadados, lidos e gravados pela
// persistência configurada (Dataverse em produção; navegador no
// modo de teste).
// ============================================================

export interface IUseProcessos {
  // true = modo de teste (dados no navegador).
  local: boolean;

  carregando: boolean;
  erro: string;
  aviso: string;
  processos: IProcesso[];
  vinculos: IDocumentoProcessoVinculo[];

  // Versões do fluxo por processo (mais nova primeiro).
  fluxosPorProcesso: Record<string, IFluxoDefinicao[]>;

  // Metadados de cada processo, na ordem das telas.
  metadadosPorProcesso: Record<string, IFluxoMetadado[]>;

  // Situação da gravação dos metadados (gravados com pequeno atraso).
  gravandoMetadados: boolean;
  erroMetadados: string;

  catalogo: IFluxoCatalogo;

  salvarMetadados: (processoId: string, metadados: IFluxoMetadado[]) => void;
  recarregar: (forcarReleitura?: boolean) => Promise<void>;
  criarProcesso: (dados: INovoProcessoTeste) => Promise<IResultadoNovoProcesso>;
  vincularDocumento: (documentoId: string, processoId: string) => Promise<void>;
  removerVinculo: (vinculoId: string) => Promise<void>;
  definirPrincipal: (documentoId: string, processoId: string) => Promise<void>;
}

const ATRASO_GRAVACAO_METADADOS_MS = 900;

export const useProcessos = (
  dataverseService?: DataverseService,
  documentos: IDocumentoReferencia[] = []
): IUseProcessos => {

  const persistencia =
    React.useMemo(
      () => obterPersistenciaFluxo(dataverseService),
      [dataverseService]
    );

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

  const [gravandoMetadados, setGravandoMetadados] =
    React.useState<boolean>(false);

  const [erroMetadados, setErroMetadados] =
    React.useState<string>('');

  // Gravação dos metadados com atraso (evita uma gravação por tecla).
  const temporizadores =
    React.useRef<Record<string, number>>({});

  const pendentes =
    React.useRef<Record<string, IFluxoMetadado[]>>({});

  const recarregar =
    React.useCallback(
      async (
        forcarReleitura: boolean = false
      ): Promise<void> => {

        setCarregando(true);
        setErro('');

        try {

          const dados =
            await persistencia.processos.carregar(
              forcarReleitura,
              documentosRef.current
            );

          const fluxos: Record<string, IFluxoDefinicao[]> = {};

          const metadados: Record<string, IFluxoMetadado[]> = {};

          await Promise.all(
            dados.processos.map(
              async processo => {
                fluxos[processo.id] =
                  await persistencia.catalogo.listarVersoes(processo.id);

                metadados[processo.id] =
                  pendentes.current[processo.id] ||
                  await persistencia.metadados.listar(processo.id, fluxos[processo.id]);
              }
            )
          );

          setProcessos(dados.processos);
          setVinculos(dados.vinculos);
          setAviso(dados.aviso);
          setFluxosPorProcesso(fluxos);
          setMetadadosPorProcesso(metadados);

        } catch (error) {

          console.error(error);

          setErro(
            persistencia.local
              ? 'Não foi possível carregar os processos.'
              : 'Não foi possível carregar os processos do Dataverse. Confira se as tabelas do fluxo foram criadas (scripts/dataverse/criar-tabelas-fluxo.ps1) e se o seu perfil tem permissão de leitura.'
          );

        } finally {
          setCarregando(false);
        }
      },
      [persistencia]
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

  // Ao sair da tela, grava o que estiver pendente.
  React.useEffect(
    () => () => {
      Object.keys(temporizadores.current).forEach(
        processoId => {
          window.clearTimeout(temporizadores.current[processoId]);
          const lista = pendentes.current[processoId];
          if (lista) {
            persistencia.metadados.salvar(processoId, lista)
              .catch((error: unknown) => console.error(error));
          }
        }
      );
    },
    [persistencia]
  );

  const salvarMetadados = (
    processoId: string,
    metadados: IFluxoMetadado[]
  ): void => {

    setMetadadosPorProcesso(
      atual => ({ ...atual, [processoId]: metadados })
    );

    pendentes.current[processoId] = metadados;

    window.clearTimeout(temporizadores.current[processoId]);

    setGravandoMetadados(true);
    setErroMetadados('');

    temporizadores.current[processoId] =
      window.setTimeout(
        () => {

          delete temporizadores.current[processoId];

          const lista =
            pendentes.current[processoId];

          persistencia.metadados.salvar(processoId, lista)
            .then(
              gravados => {

                // Só aplica se ninguém digitou de novo enquanto gravava.
                if (pendentes.current[processoId] === lista) {
                  delete pendentes.current[processoId];
                  setMetadadosPorProcesso(
                    atual => ({ ...atual, [processoId]: gravados })
                  );
                }
              }
            )
            .catch(
              (error: unknown) => {
                console.error(error);
                setErroMetadados(
                  'Não foi possível gravar os metadados no Dataverse. As alterações continuam na tela; tente de novo.'
                );
              }
            )
            .then(
              () => {
                if (Object.keys(temporizadores.current).length === 0) {
                  setGravandoMetadados(false);
                }
              },
              () => undefined
            );
        },
        persistencia.local ? 0 : ATRASO_GRAVACAO_METADADOS_MS
      );
  };

  return {
    local: persistencia.local,
    carregando,
    erro,
    aviso,
    processos,
    vinculos,
    fluxosPorProcesso,
    metadadosPorProcesso,
    gravandoMetadados,
    erroMetadados,
    catalogo: persistencia.catalogo,
    salvarMetadados,
    recarregar,

    criarProcesso: async (dados: INovoProcessoTeste) => {

      const resultado =
        await persistencia.processos.criarProcesso(dados, processos);

      if (resultado.ok) {
        await recarregar(true);
      }

      return resultado;
    },

    vincularDocumento: async (documentoId: string, processoId: string) => {
      await persistencia.processos.vincularDocumento(documentoId, processoId, vinculos);
      await recarregar(true);
    },

    removerVinculo: async (vinculoId: string) => {
      const vinculo = vinculos.find(item => item.id === vinculoId);
      if (vinculo) {
        await persistencia.processos.removerVinculo(vinculo);
        await recarregar(true);
      }
    },

    definirPrincipal: async (documentoId: string, processoId: string) => {
      await persistencia.processos.definirPrincipal(documentoId, processoId, vinculos);
      await recarregar(true);
    }
  };
};
