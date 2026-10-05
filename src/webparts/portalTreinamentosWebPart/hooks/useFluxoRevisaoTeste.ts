import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../models/Documento';

import {
  AcaoSistemaFluxo,
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoInstancia,
  IFluxoResponsavel,
  IResponsavelResolvido
} from '../models/Fluxo';

import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../models/Processo';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
  AreaAdminService,
  IUsuarioAreaAdmin
} from '../services/AreaAdminService';

import {
  DataverseService
} from '../services/DataverseService';

import {
  calcularProximaRevisao,
  obterRevisaoEmAndamento
} from '../services/DocumentoRevisaoFluxoService';

import {
  revisaoInteira
} from '../utils/numeracaoRevisao';

import {
  RevisaoDocumentoAdminService
} from '../services/RevisaoDocumentoAdminService';

import {
  obterPersistenciaFluxo
} from '../services/fluxo/persistenciaFluxo';

import {
  IContextoExecucaoFluxo
} from '../services/fluxo/FluxoService';

import {
  carregarUsuariosPortal,
  obterAutorDaRevisao
} from '../services/fluxo/AutorRevisaoService';

import {
  descreverResolvido,
  papeisDoUsuario,
  resolverResponsaveis
} from '../services/fluxo/ResolvedorResponsaveis';

import {
  processoPrincipalDoDocumento,
  vinculosDoDocumento
} from '../services/processos/ProcessoService';

// ============================================================
// HOOK — FLUXO DE REVISÃO DO DOCUMENTO
//
// Documento → Processo (principal) → Fluxo publicado do processo
//           → Estado do fluxo nesta revisão
//
// Dois modos (constants/featureFlags.ts, FLUXO_PERSISTENCIA):
//   Dataverse → usuário REAL, responsáveis reais, publicação real,
//               status do documento atualizado, nada simulado.
//   Local     → modo de teste: navegador + usuários simulados.
// ============================================================

export interface IAtorSimulado {
  chave: string;
  rotulo: string;
  descricao: string;
  ator: IFluxoAtor;
}

export interface IRevisaoAlvoFluxo {
  id: string;
  revisao: string;

  // true = não existe revisão em andamento; a simulação usa uma
  // revisão "virtual" (próximo número). Só no modo de teste.
  virtual: boolean;
}

// Em que ponto a tela está:
//   semRevisao        → (Dataverse) não há revisão em andamento
//   semProcesso       → documento não vinculado a nenhum processo
//   escolherPrincipal → vinculado a vários; falta escolher qual governa
//   semFluxo          → o processo não tem fluxo publicado
//   pronto            → fluxo em andamento ou concluído
export type SituacaoFluxoRevisao =
  | 'carregando'
  | 'semRevisao'
  | 'semProcesso'
  | 'escolherPrincipal'
  | 'semFluxo'
  | 'pronto'
  | 'erro';

export interface IUseFluxoRevisaoTeste {
  // true = modo de teste (navegador + simulação).
  local: boolean;

  situacao: SituacaoFluxoRevisao;
  processando: boolean;
  erro: string;
  errosAcao: string[];
  avisos: string[];
  avisoProcessos: string;
  revisaoAlvo?: IRevisaoAlvoFluxo;
  processos: IProcesso[];
  vinculos: IDocumentoProcessoVinculo[];
  processoAtual?: IProcesso;
  definicao?: IFluxoDefinicao;
  instancia?: IFluxoInstancia;
  atores: IAtorSimulado[];
  atorSelecionado?: IAtorSimulado;

  // Quem pode executar a etapa atual (nomes reais no Dataverse).
  responsaveisEtapaAtual: string[];

  selecionarAtor: (chave: string) => void;
  vincularProcesso: (processoId: string) => Promise<void>;
  escolherPrincipal: (processoId: string) => Promise<void>;
  executar: (
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ) => Promise<boolean>;
  reiniciar: () => Promise<void>;
  recarregar: () => Promise<void>;
  limparErros: () => void;
}

// Vínculos usuário × área: lidos uma vez por sessão.
const cacheVinculos: Array<{ dataverse: DataverseService; vinculos: Promise<IUsuarioAreaAdmin[]> }> = [];

const carregarVinculosUsuarios = (
  dataverse?: DataverseService
): Promise<IUsuarioAreaAdmin[]> => {

  if (!dataverse) {
    return Promise.resolve([]);
  }

  const existente =
    cacheVinculos.find(item => item.dataverse === dataverse);

  if (existente) {
    return existente.vinculos;
  }

  const vinculos =
    new AreaAdminService(dataverse)
      .listarUsuariosArea()
      .catch(
        (error: unknown) => {
          console.error(error);
          return [] as IUsuarioAreaAdmin[];
        }
      );

  cacheVinculos.push({ dataverse, vinculos });

  return vinculos;
};

const dataIso = (
  dias: number
): string => {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
};

// Papéis simulados (modo de teste): um usuário fictício por responsável.
const papeisDaDefinicao = (
  definicao: IFluxoDefinicao | undefined
): Array<{ papelTeste: string; tipo: string; descricao: string }> => {

  const lista: Array<{ papelTeste: string; tipo: string; descricao: string }> = [];

  if (!definicao) {
    return lista;
  }

  definicao.elementos.forEach(
    elemento => {
      elemento.responsaveis.forEach(
        responsavel => {
          if (
            responsavel.papelTeste &&
            !lista.some(item => item.papelTeste === responsavel.papelTeste)
          ) {
            lista.push({
              papelTeste: responsavel.papelTeste,
              tipo: responsavel.tipo,
              descricao: responsavel.descricao
            });
          }
        }
      );
    }
  );

  return lista;
};

export const useFluxoRevisaoTeste = (
  documento: IDocumento | undefined,
  revisoes: IDocumentoRevisao[],
  contexto: IContextoAcesso | undefined,
  dataverseService?: DataverseService,
  onRevisaoAlterada?: () => Promise<void>
): IUseFluxoRevisaoTeste => {

  const persistencia =
    React.useMemo(
      () => obterPersistenciaFluxo(dataverseService),
      [dataverseService]
    );

  const local =
    persistencia.local;

  const servico =
    persistencia.servico;

  const [situacao, setSituacao] =
    React.useState<SituacaoFluxoRevisao>('carregando');

  const [instancia, setInstancia] =
    React.useState<IFluxoInstancia | undefined>(undefined);

  const [definicao, setDefinicao] =
    React.useState<IFluxoDefinicao | undefined>(undefined);

  const [processos, setProcessos] =
    React.useState<IProcesso[]>([]);

  const [vinculos, setVinculos] =
    React.useState<IDocumentoProcessoVinculo[]>([]);

  // Autor da revisão = quem a criou (dgt_usuario), ver AutorRevisaoService.
  const [autorId, setAutorId] =
    React.useState<string | undefined>(undefined);

  const autorIdRef =
    React.useRef<string | undefined>(undefined);

  const [usuariosPortal, setUsuariosPortal] =
    React.useState<Array<{ id: string; nome: string }>>([]);

  const [vinculosUsuarios, setVinculosUsuarios] =
    React.useState<IUsuarioAreaAdmin[]>([]);

  const [processoAtualId, setProcessoAtualId] =
    React.useState<string | undefined>(undefined);

  const [avisoProcessos, setAvisoProcessos] =
    React.useState<string>('');

  const [processando, setProcessando] =
    React.useState<boolean>(false);

  const [erro, setErro] =
    React.useState<string>('');

  const [errosAcao, setErrosAcao] =
    React.useState<string[]>([]);

  const [avisos, setAvisos] =
    React.useState<string[]>([]);

  const [atorChave, setAtorChave] =
    React.useState<string>('eu');

  const revisaoEmAndamento =
    React.useMemo(
      () => obterRevisaoEmAndamento(revisoes || []),
      [revisoes]
    );

  const revisaoAlvo: IRevisaoAlvoFluxo | undefined =
    React.useMemo(
      () => {

        if (!documento) {
          return undefined;
        }

        if (revisaoEmAndamento) {
          return {
            id: revisaoEmAndamento.id,
            revisao: revisaoEmAndamento.revisao,
            virtual: false
          };
        }

        // No Dataverse não há revisão "virtual": é preciso criar a
        // revisão (aba Revisão) para começar o fluxo.
        if (!local) {
          return undefined;
        }

        return {
          id: `virtual-${documento.id}`,
          revisao: calcularProximaRevisao(revisoes || []),
          virtual: true
        };
      },
      [documento, revisaoEmAndamento, revisoes, local]
    );

  const dadosResponsaveis =
    React.useMemo(
      () => ({
        revisaoResponsavelId: autorId || (revisaoEmAndamento ? revisaoEmAndamento.responsavelId : undefined),
        documentoAreaId: documento ? documento.areaId : undefined
      }),
      [revisaoEmAndamento, documento, autorId]
    );

  const atores: IAtorSimulado[] =
    React.useMemo(
      () => {

        const nomeReal =
          contexto?.nome ||
          contexto?.email ||
          'Usuário atual';

        // ---- Dataverse: só o usuário real ----
        if (!local) {

          const papeis =
            definicao
              ? papeisDoUsuario(definicao, contexto, dadosResponsaveis, vinculosUsuarios)
              : [];

          return [
            {
              chave: 'eu',
              rotulo: nomeReal,
              descricao: '',
              ator: {
                id: contexto?.usuarioId || '',
                nome: nomeReal,
                papeisTeste: papeis
              }
            }
          ];
        }

        // ---- Teste: usuário real (pelas regras disponíveis) + simulados ----
        const papeis =
          papeisDaDefinicao(definicao);

        const papeisReais =
          definicao
            ? papeisDoUsuario(definicao, contexto, dadosResponsaveis, vinculosUsuarios)
            : [];

        return [
          {
            chave: 'eu',
            rotulo: `Eu (${nomeReal})`,
            descricao:
              papeisReais.length > 0
                ? `Seu acesso real permite agir como: ${papeis.filter(papel => papeisReais.indexOf(papel.papelTeste) >= 0).map(papel => papel.descricao).join(', ')}.`
                : 'Com seu acesso real você não é responsável por nenhuma etapa deste fluxo. Use um usuário simulado.',
            ator: {
              id: contexto?.usuarioId || 'usuario-atual',
              nome: nomeReal,
              papeisTeste: papeisReais
            }
          },
          ...papeis.map(
            papel => ({
              chave: papel.papelTeste,
              rotulo: `${papel.descricao} (simulado)`,
              descricao: `Pode executar as etapas de "${papel.descricao}".`,
              ator: {
                id: `simulado-${papel.papelTeste}`,
                nome: `${papel.descricao} (simulado)`,
                papeisTeste: [papel.papelTeste]
              }
            })
          )
        ];
      },
      [contexto, definicao, dadosResponsaveis, vinculosUsuarios, local]
    );

  const atorSelecionado =
    atores.find(item => item.chave === atorChave) || atores[0];

  const contextoExecucao = (
    definicaoAtual: IFluxoDefinicao | undefined
  ): IContextoExecucaoFluxo => ({
    rotuloRevisao: documento && revisaoAlvo ? `${documento.codigo} ${revisaoAlvo.revisao}` : undefined,

    // Usa o autor já identificado (ref), mesmo que o estado ainda
    // não tenha sido atualizado na tela.
    resolverResponsaveis: (responsaveis: IFluxoResponsavel[]): IResponsavelResolvido[] =>
      resolverResponsaveis(
        responsaveis,
        {
          ...dadosResponsaveis,
          revisaoResponsavelId: autorIdRef.current || dadosResponsaveis.revisaoResponsavelId
        }
      ),

    // Publicação REAL (só no Dataverse; no teste é apenas simulada).
    executarAcoesSistema: local || !dataverseService || !revisaoEmAndamento
      ? undefined
      : async (acoes: AcaoSistemaFluxo[], novaInstancia: IFluxoInstancia): Promise<void> => {

        // 1) Evento de revisão: grava o rótulo que o motor calculou
        //    (00 → 00A, 00B → 00) ANTES de publicar, para a revisão já
        //    ser publicada com o número certo.
        const renumerou =
          acoes.some(acao => acao === 'novaRevisao' || acao === 'novaSubRevisao' || acao === 'proximaRevisao');

        if (
          renumerou &&
          novaInstancia.revisao &&
          novaInstancia.revisao !== revisaoEmAndamento.revisao
        ) {
          await dataverseService.atualizarRegistro(
            'dgt_documentorevisao',
            revisaoEmAndamento.id,
            {
              dgt_revisao: novaInstancia.revisao,
              dgt_name: `${documento ? documento.codigo : 'Documento'} - ${novaInstancia.revisao}`.substring(0, 100)
            }
          );
        }

        const publicar =
          acoes.filter(acao => acao === 'publicarComRetreinamento' || acao === 'publicarSemRetreinamento');

        if (publicar.length === 0) {
          return;
        }

        const comRetreinamento =
          publicar.indexOf('publicarComRetreinamento') >= 0;

        const valores =
          novaInstancia.valores;

        // A publicação tira a letra que tiver sobrado (Rev.00B → Rev.00).
        novaInstancia.revisao =
          revisaoInteira(novaInstancia.revisao || revisaoEmAndamento.revisao);

        await new RevisaoDocumentoAdminService(dataverseService)
          .publicar({
            documentoRevisaoId: revisaoEmAndamento.id,
            requerRetreinamento: comRetreinamento,
            justificativa:
              (valores.justificativaRetreinamento || '').trim() ||
              `Publicada pelo fluxo "${definicaoAtual ? definicaoAtual.nome : 'do processo'}" sem retreinamento.`,
            dataVigencia: dataIso(0),
            dataLimite:
              comRetreinamento
                ? ((valores.prazoRetreinamento || '').trim() || dataIso(30))
                : undefined
          });
      }
  });

  // Status do documento (dgt_status) conforme a etapa atual.
  const atualizarStatusDocumento = async (
    definicaoAtual: IFluxoDefinicao,
    instanciaAtual: IFluxoInstancia
  ): Promise<void> => {

    if (local || !dataverseService || !revisaoEmAndamento || instanciaAtual.status === 'concluido') {
      return;
    }

    const etapa =
      definicaoAtual.elementos.find(item => item.id === instanciaAtual.elementoAtualId);

    if (!etapa || etapa.tipo !== 'tarefaHumana') {
      return;
    }

    // Automático: a 1ª etapa do fluxo é Elaboração; as demais, Aprovação.
    const inicio =
      definicaoAtual.elementos.find(item => item.tipo === 'inicio');

    const primeira =
      inicio
        ? definicaoAtual.transicoes.find(item => item.origemId === inicio.id)
        : undefined;

    const status =
      etapa.statusDocumento ||
      (primeira && primeira.destinoId === etapa.id ? 'Elaboração' : 'Aprovação');

    const normalizar = (valor: string): string =>
      (valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (normalizar(revisaoEmAndamento.status || '') === normalizar(status)) {
      return;
    }

    await dataverseService.alterarStatusDocumentoRevisao(revisaoEmAndamento.id, status);
  };

  const carregar =
    React.useCallback(
      async (
        forcarReleitura: boolean = false
      ): Promise<void> => {

        if (!documento) {
          setSituacao('erro');
          setErro('Documento não carregado.');
          return;
        }

        setSituacao('carregando');
        setErro('');

        try {

          const [dados, usuariosAreas, usuarios, autor] =
            await Promise.all([
              persistencia.processos.carregar(
                forcarReleitura,
                [{ id: documento.id, codigo: documento.codigo }]
              ),
              carregarVinculosUsuarios(dataverseService),
              carregarUsuariosPortal(dataverseService),
              local
                ? Promise.resolve(undefined)
                : obterAutorDaRevisao(dataverseService, revisaoEmAndamento ? revisaoEmAndamento.id : undefined)
            ]);

          autorIdRef.current = autor;
          setAutorId(autor);
          setUsuariosPortal(usuarios.map(item => ({ id: item.id, nome: item.nome })));

          setProcessos(dados.processos);
          setVinculos(dados.vinculos);
          setAvisoProcessos(dados.aviso);
          setVinculosUsuarios(usuariosAreas);

          if (!revisaoAlvo) {
            setInstancia(undefined);
            setDefinicao(undefined);
            setSituacao('semRevisao');
            return;
          }

          // 1) Revisão já tem fluxo? Ele vale até o fim, mesmo que o
          //    processo ou o fluxo do processo mudem depois.
          const existente =
            await servico.obter(revisaoAlvo.id);

          if (existente) {

            const definicaoExistente =
              await servico.definicaoDaInstancia(existente);

            setInstancia(existente);
            setDefinicao(definicaoExistente);
            setProcessoAtualId(existente.processoId);

            if (!definicaoExistente) {
              setErro(`A versão ${existente.fluxoVersao} do fluxo usada por esta revisão não foi encontrada.`);
              setSituacao('erro');
              return;
            }

            setSituacao('pronto');
            return;
          }

          setInstancia(undefined);
          setDefinicao(undefined);

          // 2) Qual processo governa o documento?
          const doDocumento =
            vinculosDoDocumento(documento.id, dados.vinculos);

          if (doDocumento.length === 0) {
            setProcessoAtualId(undefined);
            setSituacao('semProcesso');
            return;
          }

          const principalId =
            processoPrincipalDoDocumento(documento.id, dados.vinculos);

          if (!principalId) {
            setProcessoAtualId(undefined);
            setSituacao('escolherPrincipal');
            return;
          }

          setProcessoAtualId(principalId);

          const processo =
            dados.processos.find(item => item.id === principalId);

          if (!processo) {
            setSituacao('semProcesso');
            return;
          }

          // 3) Inicia com a versão publicada do fluxo do processo.
          const resultado =
            await servico.iniciar(
              processo,
              {
                revisaoId: revisaoAlvo.id,
                documentoId: documento.id,
                revisao: revisaoAlvo.revisao,
                ator: {
                  id: contexto?.usuarioId || 'usuario-atual',
                  nome: contexto?.nome || contexto?.email || 'Usuário atual',
                  papeisTeste: []
                },
                simulado: local
              },
              contextoExecucao(undefined)
            );

          if (!resultado.ok || !resultado.instancia) {
            setSituacao('semFluxo');
            return;
          }

          const definicaoNova =
            await servico.definicaoDaInstancia(resultado.instancia);

          setInstancia(resultado.instancia);
          setDefinicao(definicaoNova);
          setAvisos(resultado.avisos || []);
          setSituacao('pronto');

          if (definicaoNova) {
            await atualizarStatusDocumento(definicaoNova, resultado.instancia);
          }

        } catch (error) {

          console.error(error);

          const codigo =
            (error as { codigo?: string }).codigo;

          setErro(
            codigo === 'CONFLITO'
              ? (error as Error).message
              : local
                ? 'Não foi possível carregar a simulação do fluxo.'
                : 'Não foi possível carregar o fluxo desta revisão do Dataverse. Confira se as tabelas do fluxo foram criadas e se o seu perfil tem permissão.'
          );
          setSituacao('erro');
        }
      },
      [documento, revisaoAlvo, persistencia, dataverseService, contexto, local, dadosResponsaveis]
    );

  React.useEffect(
    () => {
      carregar()
        .catch(
          (error: unknown) => console.error(error)
        );
    },
    [documento?.id, revisaoAlvo?.id, persistencia]
  );

  const executar =
    async (
      acaoChave: string,
      comentario: string,
      valores: Record<string, string>
    ): Promise<boolean> => {

      if (!revisaoAlvo || !atorSelecionado) {
        return false;
      }

      setProcessando(true);
      setErrosAcao([]);
      setAvisos([]);

      try {

        const resultado =
          await servico.executar(
            revisaoAlvo.id,
            {
              acaoChave,
              comentario,
              valores,
              ator: atorSelecionado.ator
            },
            contextoExecucao(definicao)
          );

        if (!resultado.ok || !resultado.instancia) {
          setErrosAcao(resultado.erros);
          return false;
        }

        setInstancia(resultado.instancia);
        setAvisos(resultado.avisos || []);

        const definicaoAtual =
          await servico.definicaoDaInstancia(resultado.instancia);

        if (definicaoAtual) {
          setDefinicao(definicaoAtual);

          try {
            await atualizarStatusDocumento(definicaoAtual, resultado.instancia);
          } catch (error) {
            console.error(error);
            setAvisos(atual => atual.concat('O status do documento não pôde ser atualizado.'));
          }
        }

        if (!local && onRevisaoAlterada) {
          await onRevisaoAlterada();
        }

        return true;

      } catch (error) {

        console.error(error);

        setErrosAcao([
          (error as { codigo?: string }).codigo === 'CONFLITO'
            ? (error as Error).message
            : `Erro ao executar a ação: ${error instanceof Error ? error.message : String(error)}`
        ]);

        return false;

      } finally {
        setProcessando(false);
      }
    };

  const reiniciar =
    async (): Promise<void> => {

      if (!revisaoAlvo || !local) {
        return;
      }

      await servico.reiniciar(revisaoAlvo.id);

      setErrosAcao([]);

      await carregar();
    };

  const vincularProcesso =
    async (
      processoId: string
    ): Promise<void> => {

      if (!documento) {
        return;
      }

      try {
        await persistencia.processos.vincularDocumento(documento.id, processoId, vinculos);
        await persistencia.processos.definirPrincipal(
          documento.id,
          processoId,
          (await persistencia.processos.carregar(true, [{ id: documento.id, codigo: documento.codigo }])).vinculos
        );
      } catch (error) {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível vincular o processo.');
      }

      await carregar(true);
    };

  const escolherPrincipal =
    async (
      processoId: string
    ): Promise<void> => {

      if (!documento) {
        return;
      }

      try {
        await persistencia.processos.definirPrincipal(documento.id, processoId, vinculos);
      } catch (error) {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível definir o processo principal.');
      }

      await carregar(true);
    };

  // Quem pode executar a etapa atual.
  const responsaveisEtapaAtual: string[] =
    instancia && instancia.status !== 'concluido'
      ? (() => {
        const tarefa =
          instancia.tarefas.find(item => item.status === 'pendente');

        if (!tarefa) {
          return [];
        }

        // Sempre resolve com os dados atuais (autor = quem criou a
        // revisão), também para pendências gravadas antes desta regra.
        const resolvidos =
          resolverResponsaveis(tarefa.responsaveis, dadosResponsaveis);

        return resolvidos.map(item => descreverResolvido(item, vinculosUsuarios, usuariosPortal));
      })()
      : [];

  return {
    local,
    situacao,
    processando,
    erro,
    errosAcao,
    avisos,
    avisoProcessos,
    revisaoAlvo,
    processos,
    vinculos: documento
      ? vinculosDoDocumento(documento.id, vinculos)
      : [],
    processoAtual: processos.find(item => item.id === processoAtualId),
    definicao,
    instancia,
    atores,
    atorSelecionado,
    responsaveisEtapaAtual,
    selecionarAtor: (chave: string) => {
      setAtorChave(chave);
      setErrosAcao([]);
    },
    vincularProcesso,
    escolherPrincipal,
    executar,
    reiniciar,
    recarregar: () => carregar(true),
    limparErros: () => setErrosAcao([])
  };
};
