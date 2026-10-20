import * as React from 'react';

import {
  IDocumento
} from '../models/Documento';

import {
  IFluxoInstancia,
  IFluxoResponsavel
} from '../models/Fluxo';

import {
  IProcesso
} from '../models/Processo';

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
  estagioRevisao
} from '../services/DocumentoRevisaoFluxoService';

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
  IDadosProcessos,
  processoPrincipalDoDocumento,
  vinculosDoDocumento
} from '../services/processos/ProcessoService';

// ============================================================
// PROCESSO DO DOCUMENTO E A ETAPA EM QUE ELE ESTÁ
//
// 1) Processo vinculado (dgt_documentoprocesso) — resolvido SEMPRE,
//    com ou sem revisão em andamento. Antes só era procurado quando
//    havia revisão aberta; com a revisão vigente publicada, a tela
//    ficava sem saber a qual processo o documento pertence.
//
// 2) A revisão em andamento segue o fluxo do processo? (modo Dataverse)
//    Sim quando:
//      - a revisão já tem estado de fluxo gravado; ou
//      - o documento tem processo principal com fluxo publicado
//        (o fluxo começa ao abrir a aba "Fluxo de revisão").
//    Nesses casos, os botões do fluxo fixo antigo (aba Revisão) são
//    substituídos pelo fluxo do processo, e o card "Responsável" do
//    documento mostra QUEM está com a etapa atual.
//    (Regra inalterada: "segue" continua igual à versão anterior.)
// ============================================================

// Situação do documento em relação ao processo e ao fluxo.
export type SituacaoProcessoDocumento =
  // Ainda não verificado / módulo Processos desligado.
  | ''
  // Nenhum vínculo em dgt_documentoprocesso.
  | 'semProcesso'
  // Vários vínculos e nenhum marcado como principal.
  | 'variosProcessos'
  // O vínculo aponta para um processo inativo ou sem permissão de leitura.
  | 'processoIndisponivel'
  // O processo existe, mas ainda não tem fluxo publicado.
  | 'semFluxoPublicado'
  // Revisão em andamento, fluxo ainda não iniciado (1ª etapa prevista).
  | 'aguardandoInicio'
  // Revisão em andamento que já avançou no fluxo padrão antes de o
  // processo ter fluxo publicado: termina no fluxo padrão.
  | 'foraDoFluxo'
  // Revisão em andamento dentro do fluxo (etapa atual conhecida).
  | 'emAndamento'
  // Sem revisão em andamento; o fluxo da revisão vigente foi concluído.
  | 'concluido'
  // Sem revisão em andamento e sem registro de fluxo da vigente
  // (ex.: revisão publicada antes de o processo ter fluxo).
  | 'semRevisaoEmAndamento'
  // Não foi possível ler os processos (tabelas/permissão).
  | 'erro';

export interface IRevisaoSegueFluxo {
  segue: boolean;
  processoNome: string;
  verificando: boolean;

  // Etapa atual e responsáveis (nomes reais), quando segue o fluxo.
  etapaAtual: string;
  responsaveisAtuais: string[];

  // ---- Processo vinculado (sempre que possível) ----
  processoId: string;
  processoCodigo: string;

  // Quantos processos o documento tem vinculados.
  totalProcessos: number;

  situacao: SituacaoProcessoDocumento;

  // Versão do fluxo em uso pela revisão (quando conhecida).
  fluxoVersao?: number;

  // Revisão vigente: quando o fluxo terminou e qual foi a última etapa.
  concluidoEm: string;
  ultimaEtapa: string;
}

const VAZIO: IRevisaoSegueFluxo = {
  segue: false,
  processoNome: '',
  verificando: false,
  etapaAtual: '',
  responsaveisAtuais: [],
  processoId: '',
  processoCodigo: '',
  totalProcessos: 0,
  situacao: '',
  fluxoVersao: undefined,
  concluidoEm: '',
  ultimaEtapa: ''
};

const limpar = (
  valor?: string
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

// Última etapa concluída de um fluxo encerrado.
const ultimaEtapaConcluida = (
  instancia: IFluxoInstancia
): string => {

  const concluidas =
    instancia.tarefas
      .filter(item => item.status === 'concluida')
      .slice()
      .sort(
        (a, b) =>
          new Date(a.concluidaEm || a.criadaEm).getTime() -
          new Date(b.concluidaEm || b.criadaEm).getTime()
      );

  return concluidas.length > 0
    ? concluidas[concluidas.length - 1].elementoNome
    : '';
};

export const useRevisaoSegueFluxo = (
  documento: IDocumento | undefined,
  revisaoEmAndamentoId: string | undefined,
  dataverseService?: DataverseService,
  // Muda a cada ação no fluxo, para recarregar.
  versao: number = 0,
  // Revisão vigente — usada para dizer em que pé o fluxo ficou
  // quando não há revisão em andamento. Opcional (compatibilidade).
  revisaoVigenteId?: string,
  // Status da revisão em andamento. Se ela já saiu da Elaboração pelo
  // fluxo padrão, NÃO passa a seguir o fluxo do processo no meio do
  // caminho (ver trava em useFluxoRevisaoTeste). Opcional.
  revisaoEmAndamentoStatus?: string
): IRevisaoSegueFluxo => {

  const [estado, setEstado] =
    React.useState<IRevisaoSegueFluxo>(VAZIO);

  React.useEffect(
    () => {

      if (
        !FEATURE_FLAGS.FLUXO_CONFIGURAVEL_TESTE ||
        !documento
      ) {
        setEstado(VAZIO);
        return;
      }

      let cancelado = false;

      const persistencia =
        obterPersistenciaFluxo(dataverseService);

      // Mesma condição da versão anterior para o fluxo "governar"
      // a revisão em andamento.
      const podeSeguir =
        fluxoNoDataverse() &&
        !!dataverseService &&
        !!revisaoEmAndamentoId;

      const descrever = async (
        responsaveis: IFluxoResponsavel[]
      ): Promise<string[]> => {

        if (!dataverseService || !revisaoEmAndamentoId) {
          return [];
        }

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

      // ---------- 1) Processo vinculado ----------
      const identificarProcesso = (
        dados: IDadosProcessos
      ): {
        processo?: IProcesso;
        principalId?: string;
        total: number;
        situacao: SituacaoProcessoDocumento;
      } => {

        const doDocumento =
          vinculosDoDocumento(documento.id, dados.vinculos);

        // Ignora vínculos repetidos para o mesmo processo.
        const idsProcessos =
          doDocumento
            .map(item => limpar(item.processoId))
            .filter((id, indice, lista) => !!id && lista.indexOf(id) === indice);

        const total =
          idsProcessos.length;

        if (total === 0) {
          return { total, situacao: 'semProcesso' };
        }

        const principalId =
          processoPrincipalDoDocumento(documento.id, dados.vinculos) ||
          (total === 1 ? doDocumento[0].processoId : undefined);

        if (!principalId) {
          return { total, situacao: 'variosProcessos' };
        }

        const processo =
          dados.processos.find(
            item => limpar(item.id) === limpar(principalId)
          );

        return processo
          ? { processo, principalId, total, situacao: '' }
          : { principalId, total, situacao: 'processoIndisponivel' };
      };

      const verificar = async (): Promise<void> => {

        setEstado(atual => ({ ...atual, verificando: true }));

        try {

          // Lê processos e vínculos. Em caso de falha, ainda tenta
          // mostrar o fluxo da revisão em andamento (como antes).
          let dados: IDadosProcessos | undefined;

          try {
            dados =
              await persistencia.processos.carregar(
                versao > 0,
                [{ id: documento.id, codigo: documento.codigo }]
              );
          } catch (error) {
            console.error(error);
          }

          const identificado =
            dados
              ? identificarProcesso(dados)
              : { total: 0, situacao: 'erro' as SituacaoProcessoDocumento, processo: undefined, principalId: undefined };

          const base: IRevisaoSegueFluxo = {
            ...VAZIO,
            processoId: identificado.processo ? identificado.processo.id : (identificado.principalId || ''),
            processoCodigo: identificado.processo ? identificado.processo.codigo : '',
            processoNome: identificado.processo ? identificado.processo.nome : '',
            totalProcessos: identificado.total,
            situacao: identificado.situacao
          };

          // ---------- 2) Revisão em andamento ----------
          if (revisaoEmAndamentoId) {

            const instancia =
              podeSeguir
                ? await persistencia.repositorio.obter(revisaoEmAndamentoId)
                : undefined;

            if (instancia) {

              const tarefa =
                instancia.status === 'concluido'
                  ? undefined
                  : instancia.tarefas.find(item => item.status === 'pendente');

              const responsaveis =
                tarefa ? await descrever(tarefa.responsaveis) : [];

              // A revisão "congela" o processo com que o fluxo começou.
              const processoInstancia =
                instancia.processoId && dados
                  ? dados.processos.find(item => limpar(item.id) === limpar(instancia.processoId))
                  : undefined;

              if (!cancelado) {
                setEstado({
                  ...base,
                  segue: true,
                  processoId: instancia.processoId || base.processoId,
                  processoCodigo: processoInstancia ? processoInstancia.codigo : base.processoCodigo,
                  processoNome: instancia.processoNome || (processoInstancia ? processoInstancia.nome : base.processoNome),
                  situacao: 'emAndamento',
                  fluxoVersao: instancia.fluxoVersao,
                  verificando: false,
                  etapaAtual: tarefa ? tarefa.elementoNome : '',
                  responsaveisAtuais: responsaveis
                });
              }
              return;
            }

            const processo =
              identificado.processo;

            const publicada =
              processo ? await persistencia.catalogo.versaoPublicada(processo.id) : undefined;

            if (!publicada) {
              if (!cancelado) {
                setEstado({
                  ...base,
                  situacao: processo ? 'semFluxoPublicado' : base.situacao
                });
              }
              return;
            }

            // Revisão que já andou no fluxo padrão: continua nele até
            // o fim (os botões antigos permanecem na aba Revisão).
            if (
              revisaoEmAndamentoStatus !== undefined &&
              estagioRevisao(revisaoEmAndamentoStatus) !== 'elaboracao'
            ) {
              if (!cancelado) {
                setEstado({
                  ...base,
                  segue: false,
                  situacao: 'foraDoFluxo',
                  fluxoVersao: publicada.versao
                });
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
              primeira && podeSeguir ? await descrever(primeira.responsaveis) : [];

            if (!cancelado) {
              setEstado({
                ...base,
                segue: podeSeguir,
                situacao: 'aguardandoInicio',
                fluxoVersao: publicada.versao,
                verificando: false,
                etapaAtual: primeira ? primeira.elementoNome : '',
                responsaveisAtuais: responsaveis
              });
            }
            return;
          }

          // ---------- 3) Sem revisão em andamento ----------
          if (!identificado.processo) {
            if (!cancelado) {
              setEstado(base);
            }
            return;
          }

          let instanciaVigente: IFluxoInstancia | undefined;

          if (revisaoVigenteId) {
            try {
              instanciaVigente =
                await persistencia.repositorio.obter(revisaoVigenteId);
            } catch (error) {
              // Sem registro do fluxo da vigente: segue sem ele.
              console.error(error);
            }
          }

          if (instanciaVigente && instanciaVigente.status === 'concluido') {
            if (!cancelado) {
              setEstado({
                ...base,
                situacao: 'concluido',
                fluxoVersao: instanciaVigente.fluxoVersao,
                concluidoEm: instanciaVigente.concluidoEm || '',
                ultimaEtapa: ultimaEtapaConcluida(instanciaVigente)
              });
            }
            return;
          }

          const publicada =
            await persistencia.catalogo.versaoPublicada(identificado.processo.id);

          if (!cancelado) {
            setEstado({
              ...base,
              situacao: publicada ? 'semRevisaoEmAndamento' : 'semFluxoPublicado',
              fluxoVersao: publicada ? publicada.versao : undefined
            });
          }

        } catch (error) {

          // Tabelas ainda não criadas ou sem permissão: mantém o fluxo antigo.
          console.error(error);

          if (!cancelado) {
            setEstado({ ...VAZIO, situacao: 'erro' });
          }
        }
      };

      verificar()
        .catch((error: unknown) => console.error(error));

      return () => {
        cancelado = true;
      };
    },
    [documento?.id, documento?.codigo, revisaoEmAndamentoId, revisaoEmAndamentoStatus, revisaoVigenteId, dataverseService, versao]
  );

  return estado;
};
