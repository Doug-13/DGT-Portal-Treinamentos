import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../services/DataverseService';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../services/AreaAdminService';

import {
  IFluxoDefinicao,
  IResponsavelResolvido
} from '../models/Fluxo';

import {
  IControleTreinamento
} from '../services/TreinamentoDocumentoControleService';

import {
  descreverResolvido,
  resolverResponsaveis,
  usuarioAtende
} from '../services/fluxo/ResolvedorResponsaveis';

import {
  iniciarInstancia
} from '../services/fluxo/FluxoEngine';

import {
  obterAutorDaRevisao
} from '../services/fluxo/AutorRevisaoService';

import {
  obterPersistenciaFluxo
} from '../services/fluxo/persistenciaFluxo';

import {
  processoPrincipalDoDocumento
} from '../services/processos/ProcessoService';

import {
  TABELA_TAREFA_FLUXO,
  TAREFA
} from '../services/fluxo/dataverse/esquemaFluxo';

import {
  fluxoNoDataverse
} from '../constants/featureFlags';

// ============================================================
// ONDE ESTÁ CADA TREINAMENTO NO FLUXO
//
// Para cada treinamento com revisão em andamento: etapa atual,
// responsáveis (com nome), prazo, desde quando está parado e se
// está aguardando o usuário logado.
//
//   Etapa já iniciada   → dgt_tarefafluxo pendente da revisão;
//   Fluxo não iniciado  → 1ª etapa do fluxo publicado do processo
//                         (simulada, sem gravar nada).
// ============================================================

// Ação da etapa (botão), ex.: "Enviar para Avaliação".
export interface IAcaoEtapaTreinamento {
  chave: string;
  rotulo: string;
  principal: boolean;
}

export interface IEtapaFluxoTreinamento {
  treinamentoId: string;
  revisaoId: string;
  revisao: string;
  etapa: string;
  responsaveis: string[];
  prazo?: string;
  desde?: string;
  aguardandoVoce: boolean;
  // true = fluxo ainda não iniciado (ninguém abriu a revisão).
  naoIniciado: boolean;

  // Botões da etapa atual (do fluxo publicado do processo).
  acoes: IAcaoEtapaTreinamento[];
}

export interface IUseEtapasFluxoTreinamentos {
  // treinamentoId → etapa atual
  etapas: Record<string, IEtapaFluxoTreinamento>;
  carregando: boolean;
  erro: string;
  recarregar: () => Promise<void>;
}

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v);
};

const lotes = <T>(itens: T[], tamanho: number): T[][] => {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultado.push(itens.slice(i, i + tamanho));
  }
  return resultado;
};

const ehAutor = (item: IResponsavelResolvido): boolean =>
  item.papelTeste === 'autor' ||
  (item.papelTeste || '').indexOf('autorRevisao') === 0;

export const useEtapasFluxoTreinamentos = (
  dataverse: DataverseService | undefined,
  controles: Record<string, IControleTreinamento>,
  contexto: IContextoAcesso | undefined,
  usuariosAreas: IUsuarioAreaAdmin[],
  // documentoId → áreaId (para "Gestor da área")
  areaPorDocumento: Record<string, string>
): IUseEtapasFluxoTreinamentos => {

  const [etapas, setEtapas] =
    React.useState<Record<string, IEtapaFluxoTreinamento>>({});

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  // Chave estável: só recarrega quando as revisões em andamento mudam.
  const chave =
    Object.keys(controles)
      .map(id => {
        const c = controles[id];
        return c.revisaoEmAndamento ? `${id}:${c.revisaoEmAndamento.id}:${c.revisaoEmAndamento.status}` : '';
      })
      .filter(item => !!item)
      .sort()
      .join('|');

  const recarregar =
    React.useCallback(
      async (): Promise<void> => {

        const emAndamento =
          Object.keys(controles)
            .map(id => controles[id])
            .filter(c => !!c.revisaoEmAndamento);

        if (!dataverse || emAndamento.length === 0) {
          setEtapas({});
          return;
        }

        setCarregando(true);
        setErro('');

        try {
          const meuId = guid(contexto ? contexto.usuarioId : '');
          const revisaoIds = emAndamento.map(c => guid(c.revisaoEmAndamento ? c.revisaoEmAndamento.id : ''));

          // 1) Tarefas pendentes (etapas já iniciadas)
          const tarefas: IDataverseRecord[] = [];

          if (fluxoNoDataverse()) {
            try {
              for (const lote of lotes(revisaoIds, 20)) {
                (await dataverse.listarRegistros(
                  TABELA_TAREFA_FLUXO,
                  `$select=${TAREFA.id},${TAREFA.revisaoValor},${TAREFA.etapaId},${TAREFA.etapaNome},${TAREFA.responsaveisJson},${TAREFA.prazo},${TAREFA.criadoEm}` +
                  `&$filter=${TAREFA.situacao} eq 'pendente' and (` +
                  lote.map(id => `${TAREFA.revisaoValor} eq ${id}`).join(' or ') + ')'
                )).forEach(t => tarefas.push(t));
              }
            } catch (erroTarefas) {
              // Tabela ainda não criada: segue só com a simulação.
              console.error(erroTarefas);
            }
          }

          // 2) Autores (para "Autor da revisão")
          const autores: Record<string, string> = {};

          await Promise.all(
            revisaoIds.map(async id => {
              const autor = await obterAutorDaRevisao(dataverse, id);
              if (autor) {
                autores[id] = guid(autor);
              }
            })
          );

          // 3) Fluxo ainda não iniciado: simula a 1ª etapa
          const persistencia = obterPersistenciaFluxo(dataverse);
          let vinculos: Parameters<typeof processoPrincipalDoDocumento>[1] = [];
          const definicoes: Record<string, Promise<IFluxoDefinicao | undefined>> = {};

          vinculos = (await persistencia.processos.carregar(false, [])).vinculos;

          // Fluxo publicado do processo do documento (para as ações).
          const definicaoDo = async (documentoId: string): Promise<IFluxoDefinicao | undefined> => {
            const processoId = processoPrincipalDoDocumento(documentoId, vinculos);
            if (!processoId) {
              return undefined;
            }
            if (!definicoes[processoId]) {
              definicoes[processoId] = persistencia.catalogo.versaoPublicada(processoId);
            }
            return definicoes[processoId];
          };

          const acoesDo = (
            definicao: IFluxoDefinicao | undefined,
            elementoId: string,
            elementoNome: string
          ): IAcaoEtapaTreinamento[] => {
            if (!definicao) {
              return [];
            }
            const elemento =
              definicao.elementos.find(item => item.id === elementoId) ||
              definicao.elementos.find(item => item.tipo === 'tarefaHumana' && item.nome === elementoNome);
            return elemento
              ? (elemento.acoes || []).map(acao => ({ chave: acao.chave, rotulo: acao.rotulo, principal: !!acao.principal }))
              : [];
          };

          const brutos: Array<{
            controle: IControleTreinamento;
            etapa: string;
            responsaveis: IResponsavelResolvido[];
            prazo?: string;
            desde?: string;
            naoIniciado: boolean;
            acoes: IAcaoEtapaTreinamento[];
          }> = [];

          for (const controle of emAndamento) {

            const revisaoId = guid(controle.revisaoEmAndamento ? controle.revisaoEmAndamento.id : '');
            const tarefa = tarefas.find(t => guid(texto(t, TAREFA.revisaoValor)) === revisaoId);

            if (tarefa) {
              let responsaveis: IResponsavelResolvido[] = [];
              try {
                responsaveis = JSON.parse(texto(tarefa, TAREFA.responsaveisJson) || '[]') as IResponsavelResolvido[];
              } catch {
                responsaveis = [];
              }

              brutos.push({
                controle,
                etapa: texto(tarefa, TAREFA.etapaNome),
                responsaveis: responsaveis.map(item =>
                  autores[revisaoId] && ehAutor(item) && !item.usuarioId
                    ? { ...item, usuarioId: autores[revisaoId] }
                    : item),
                prazo: texto(tarefa, TAREFA.prazo) || undefined,
                desde: texto(tarefa, TAREFA.criadoEm) || undefined,
                naoIniciado: false,
                acoes: acoesDo(
                  await definicaoDo(controle.documentoId),
                  texto(tarefa, TAREFA.etapaId),
                  texto(tarefa, TAREFA.etapaNome)
                )
              });
              continue;
            }

            const definicao = await definicaoDo(controle.documentoId);

            if (!definicao) {
              continue;
            }

            const simulacao =
              iniciarInstancia(definicao, {
                revisaoId,
                documentoId: controle.documentoId,
                revisao: controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : '',
                ator: { id: '', nome: '', papeisTeste: [] },
                simulado: true
              });

            const primeira =
              simulacao.instancia
                ? simulacao.instancia.tarefas.find(item => item.status === 'pendente')
                : undefined;

            if (!primeira) {
              continue;
            }

            brutos.push({
              controle,
              etapa: primeira.elementoNome,
              responsaveis: resolverResponsaveis(primeira.responsaveis, {
                revisaoResponsavelId: autores[revisaoId],
                documentoAreaId: areaPorDocumento[controle.documentoId]
              }),
              naoIniciado: true,
              acoes: acoesDo(definicao, primeira.elementoId, primeira.elementoNome)
            });
          }

          // 4) Nomes das pessoas indicadas diretamente
          const idsPessoas =
            brutos
              .reduce((lista: string[], item) => lista.concat(item.responsaveis.map(r => guid(r.usuarioId))), [])
              .filter((id, i, lista) => !!id && lista.indexOf(id) === i)
              .filter(id => !usuariosAreas.some(v => guid(v.usuarioId) === id));

          const usuarios: Array<{ id: string; nome: string }> = [];

          for (const lote of lotes(idsPessoas, 20)) {
            try {
              (await dataverse.listarRegistros(
                'dgt_usuario',
                '$select=dgt_usuarioid,dgt_name&$filter=' + lote.map(id => `dgt_usuarioid eq ${id}`).join(' or ')
              )).forEach(r => usuarios.push({ id: guid(r.dgt_usuarioid), nome: texto(r, 'dgt_name') }));
            } catch (erroUsuarios) {
              console.error(erroUsuarios);
            }
          }

          const mapa: Record<string, IEtapaFluxoTreinamento> = {};

          brutos.forEach(item => {
            mapa[item.controle.treinamentoId] = {
              treinamentoId: item.controle.treinamentoId,
              revisaoId: guid(item.controle.revisaoEmAndamento ? item.controle.revisaoEmAndamento.id : ''),
              revisao: item.controle.revisaoEmAndamento ? item.controle.revisaoEmAndamento.revisao : '',
              etapa: item.etapa,
              responsaveis: item.responsaveis
                .map(r => descreverResolvido(r, usuariosAreas, usuarios))
                .filter((nome, i, lista) => !!nome && lista.indexOf(nome) === i),
              prazo: item.prazo,
              desde: item.desde,
              aguardandoVoce: item.responsaveis.some(r => usuarioAtende(r, meuId, usuariosAreas)),
              naoIniciado: item.naoIniciado,
              acoes: item.acoes
            };
          });

          setEtapas(mapa);
        } catch (e) {
          console.error(e);
          setErro('Não foi possível ler as etapas do fluxo dos treinamentos.');
        } finally {
          setCarregando(false);
        }
      },
      [dataverse, chave, contexto, usuariosAreas]
    );

  React.useEffect(
    () => {
      recarregar().catch(e => console.error(e));
    },
    [recarregar]
  );

  return {
    etapas,
    carregando,
    erro,
    recarregar
  };
};
