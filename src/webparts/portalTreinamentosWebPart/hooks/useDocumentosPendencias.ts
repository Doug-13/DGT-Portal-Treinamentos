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
  IDocumento
} from '../models/Documento';

import {
  ehAdministrador,
  obterMeusVinculos
} from '../services/DocumentoVisibilidade';

import {
  IFluxoDefinicao,
  IResponsavelResolvido
} from '../models/Fluxo';

import {
  FEATURE_FLAGS,
  fluxoNoDataverse
} from '../constants/featureFlags';

import {
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

// ============================================================
// MINHAS PENDÊNCIAS DE DOCUMENTOS
//
//   Para elaborar → revisão em Elaboração de um documento pelo qual
//                   eu sou o responsável (ou da própria revisão).
//   Para aprovar  → revisão em Aprovação de um documento de uma área
//                   em que eu sou Gestor (ou sou Administrador).
// ============================================================

export type TipoPendenciaDocumento =
  | 'elaborar'
  | 'aprovar'
  // Etapa do fluxo do processo aguardando o usuário (dgt_tarefafluxo).
  | 'fluxo';

export interface IPendenciaDocumento {
  id: string;
  tipo: TipoPendenciaDocumento;
  documento: IDocumento;
  revisao: string;
  status: string;
  desde: string;
  diasParado: number;

  // tipo = 'fluxo'
  etapa?: string;
  prazo?: string;
}

export interface IUseDocumentosPendencias {
  pendencias: IPendenciaDocumento[];
  carregando: boolean;
  erro: string;
  recarregar: () => Promise<void>;
}

const guid = (
  valor?: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];

  return valor === undefined || valor === null
    ? ''
    : String(valor);
};

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const diasDesde = (
  data: string
): number => {

  const inicio =
    new Date(data).getTime();

  if (!inicio) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - inicio) / 86400000
    )
  );
};

export const useDocumentosPendencias = (
  dataverse: DataverseService | undefined,
  documentos: IDocumento[],
  contexto: IContextoAcesso | undefined,
  usuariosAreas: IUsuarioAreaAdmin[]
): IUseDocumentosPendencias => {

  const [registros, setRegistros] =
    React.useState<IDataverseRecord[]>([]);

  // Pendências do fluxo do processo (modo Dataverse).
  const [tarefas, setTarefas] =
    React.useState<IDataverseRecord[]>([]);

  // Revisões que já têm o fluxo iniciado (dgt_situacaofluxo preenchido).
  const [revisoesComFluxo, setRevisoesComFluxo] =
    React.useState<string[]>([]);

  // Autor (quem criou) de cada revisão governada pelo fluxo.
  const [autores, setAutores] =
    React.useState<Record<string, string>>({});

  // Revisões governadas por um processo cujo fluxo ainda não começou
  // (ninguém abriu a aba "Fluxo de revisão"): a pendência é a 1ª etapa.
  const [etapasIniciais, setEtapasIniciais] =
    React.useState<Record<string, { etapa: string; responsaveis: IResponsavelResolvido[] }>>({});

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const recarregar =
    React.useCallback(
      async (): Promise<void> => {

        if (!dataverse || !contexto) {
          setRegistros([]);
          return;
        }

        setCarregando(true);
        setErro('');

        // Descobre quais revisões seguem o fluxo de um processo.
        const carregarGovernadas = async (
          lidos: IDataverseRecord[]
        ): Promise<void> => {

          const comFluxo =
            (await dataverse.listarRegistros(
              'dgt_documentorevisao',
              '$select=dgt_documentorevisaoid,dgt_situacaofluxo&$filter=dgt_situacaofluxo ne null'
            )).map(registro => guid(texto(registro, 'dgt_documentorevisaoid')));

          setRevisoesComFluxo(comFluxo);

          const semFluxo =
            lidos.filter(registro => comFluxo.indexOf(guid(texto(registro, 'dgt_documentorevisaoid'))) < 0);

          if (semFluxo.length === 0) {
            setEtapasIniciais({});
            return;
          }

          const persistencia =
            obterPersistenciaFluxo(dataverse);

          const dadosProcessos =
            await persistencia.processos.carregar(false, []);

          const publicadas: Record<string, Promise<IFluxoDefinicao | undefined>> = {};

          const iniciais: Record<string, { etapa: string; responsaveis: IResponsavelResolvido[] }> = {};

          for (const registro of semFluxo) {

            const documentoId =
              guid(texto(registro, '_dgt_documento_value'));

            const processoId =
              processoPrincipalDoDocumento(documentoId, dadosProcessos.vinculos);

            if (!processoId) {
              continue;
            }

            if (!publicadas[processoId]) {
              publicadas[processoId] = persistencia.catalogo.versaoPublicada(processoId);
            }

            const definicao =
              await publicadas[processoId];

            if (!definicao) {
              continue;
            }

            // Simula o início (sem gravar) só para saber a 1ª etapa.
            const simulacao =
              iniciarInstancia(definicao, {
                revisaoId: guid(texto(registro, 'dgt_documentorevisaoid')),
                documentoId,
                revisao: texto(registro, 'dgt_revisao'),
                ator: { id: '', nome: '', papeisTeste: [] },
                simulado: true
              });

            const tarefa =
              simulacao.instancia
                ? simulacao.instancia.tarefas.find(item => item.status === 'pendente')
                : undefined;

            if (!tarefa) {
              continue;
            }

            const documento =
              documentos.find(item => guid(item.id) === documentoId);

            iniciais[guid(texto(registro, 'dgt_documentorevisaoid'))] = {
              etapa: tarefa.elementoNome,
              responsaveis: resolverResponsaveis(
                tarefa.responsaveis,
                {
                  revisaoResponsavelId:
                    (await obterAutorDaRevisao(dataverse, texto(registro, 'dgt_documentorevisaoid'))) ||
                    texto(registro, '_dgt_responsavel_value'),
                  documentoAreaId: documento ? documento.areaId : undefined
                }
              )
            };
          }

          setEtapasIniciais(iniciais);
        };

        try {
          const registrosLidos =
            await dataverse.getDocumentoRevisoesEmAndamento();

          setRegistros(registrosLidos);

          if (FEATURE_FLAGS.FLUXO_CONFIGURAVEL_TESTE && fluxoNoDataverse()) {
            try {
              const tarefasLidas =
                await dataverse.listarRegistros(
                  TABELA_TAREFA_FLUXO,
                  `$select=${TAREFA.id},${TAREFA.revisaoValor},${TAREFA.etapaNome},${TAREFA.responsaveisJson},${TAREFA.prazo},${TAREFA.criadoEm}` +
                  `&$filter=${TAREFA.situacao} eq 'pendente'`
                );

              setTarefas(tarefasLidas);

              // Autor = quem criou a revisão (resolvido sempre na hora,
              // inclusive para pendências gravadas antes desta regra).
              const idsRevisoes =
                tarefasLidas
                  .map(tarefa => guid(texto(tarefa, TAREFA.revisaoValor)))
                  .concat(registrosLidos.map(registro => guid(texto(registro, 'dgt_documentorevisaoid'))))
                  .filter((id, indice, lista) => !!id && lista.indexOf(id) === indice);

              const mapa: Record<string, string> = {};

              await Promise.all(
                idsRevisoes.map(
                  async id => {
                    const autor = await obterAutorDaRevisao(dataverse, id);
                    if (autor) {
                      mapa[id] = autor;
                    }
                  }
                )
              );

              setAutores(mapa);
            } catch (erroTarefas) {
              // Tabela ainda não criada: segue só com as pendências antigas.
              console.error(erroTarefas);
              setTarefas([]);
            }

            try {
              await carregarGovernadas(registrosLidos);
            } catch (erroFluxo) {
              console.error(erroFluxo);
              setRevisoesComFluxo([]);
              setEtapasIniciais({});
            }
          }
        } catch (e) {
          console.error(e);
          setErro(
            'Não foi possível carregar suas pendências de documentos.'
          );
        } finally {
          setCarregando(false);
        }
      },
      [
        dataverse,
        contexto,
        documentos
      ]
    );

  // Recarrega também quando a lista de documentos muda (ex.: depois
  // de voltar do detalhe onde uma revisão foi enviada/aprovada).
  React.useEffect(
    () => {
      recarregar()
        .catch(
          (error: unknown) =>
            console.error(error)
        );
    },
    [
      recarregar,
      documentos
    ]
  );

  const pendencias =
    React.useMemo(
      (): IPendenciaDocumento[] => {

        if (!contexto) {
          return [];
        }

        const meuId =
          guid(contexto.usuarioId);

        const admin =
          ehAdministrador(contexto);

        const areasOndeSouGestor =
          obterMeusVinculos(
            contexto,
            usuariosAreas
          )
            .filter(
              vinculo =>
                vinculo.perfil === 'Gestor' ||
                vinculo.perfil === 'Administrador da área'
            )
            .map(
              vinculo => guid(vinculo.areaId)
            );

        const lista: IPendenciaDocumento[] = [];

        // Revisões governadas pelo fluxo do processo: a pendência vem
        // da etapa (dgt_tarefafluxo ou 1ª etapa ainda não iniciada),
        // nunca do status antigo nem do "Responsável" do documento.
        const governadas: string[] =
          revisoesComFluxo
            .concat(Object.keys(etapasIniciais))
            .concat(tarefas.map(tarefa => guid(texto(tarefa, TAREFA.revisaoValor))));

        Object.keys(etapasIniciais).forEach(
          revisaoId => {

            const inicial =
              etapasIniciais[revisaoId];

            if (!inicial.responsaveis.some(item => usuarioAtende(item, meuId, usuariosAreas))) {
              return;
            }

            const registro =
              registros.find(item => guid(texto(item, 'dgt_documentorevisaoid')) === revisaoId);

            const documento =
              registro
                ? documentos.find(item => guid(item.id) === guid(texto(registro, '_dgt_documento_value')))
                : undefined;

            if (!registro || !documento) {
              return;
            }

            const desde =
              texto(registro, 'createdon') || texto(registro, 'modifiedon');

            lista.push({
              id: revisaoId,
              tipo: 'fluxo',
              documento,
              revisao: texto(registro, 'dgt_revisao'),
              status: texto(registro, 'dgt_status@OData.Community.Display.V1.FormattedValue') || '',
              desde,
              diasParado: diasDesde(desde),
              etapa: inicial.etapa
            });
          }
        );

        tarefas.forEach(
          tarefa => {

            const revisaoId =
              guid(texto(tarefa, TAREFA.revisaoValor));

            const registro =
              registros.find(item => guid(texto(item, 'dgt_documentorevisaoid')) === revisaoId);

            const documento =
              registro
                ? documentos.find(item => guid(item.id) === guid(texto(registro, '_dgt_documento_value')))
                : undefined;

            if (!registro || !documento) {
              return;
            }

            let responsaveis: IResponsavelResolvido[] = [];

            try {
              responsaveis = JSON.parse(texto(tarefa, TAREFA.responsaveisJson) || '[]') as IResponsavelResolvido[];
            } catch {
              responsaveis = [];
            }

            // Responsável "Autor da revisão" sem pessoa gravada: usa
            // quem criou a revisão.
            responsaveis =
              responsaveis.map(
                item =>
                  autores[revisaoId] &&
                  (item.papelTeste === 'autor' || (item.papelTeste || '').indexOf('autorRevisao') === 0)
                    ? { ...item, usuarioId: autores[revisaoId] }
                    : item
              );

            // Só quem é responsável da etapa recebe a pendência.
            const minha =
              responsaveis.some(item => usuarioAtende(item, meuId, usuariosAreas));

            if (!minha) {
              return;
            }

            const desde =
              texto(tarefa, TAREFA.criadoEm);

            lista.push({
              id: guid(texto(tarefa, TAREFA.id)),
              tipo: 'fluxo',
              documento,
              revisao: texto(registro, 'dgt_revisao'),
              status: texto(registro, 'dgt_status@OData.Community.Display.V1.FormattedValue') || '',
              desde,
              diasParado: diasDesde(desde),
              etapa: texto(tarefa, TAREFA.etapaNome),
              prazo: texto(tarefa, TAREFA.prazo) || undefined
            });
          }
        );

        registros.forEach(
          registro => {

            if (governadas.indexOf(guid(texto(registro, 'dgt_documentorevisaoid'))) >= 0) {
              return;
            }


            const documento =
              documentos.find(
                item =>
                  guid(item.id) ===
                  guid(texto(registro, '_dgt_documento_value'))
              );

            if (!documento) {
              return;
            }

            const status =
              texto(
                registro,
                'dgt_status@OData.Community.Display.V1.FormattedValue'
              ) || 'Elaboração';

            const estagio =
              normalizar(status);

            const desde =
              texto(registro, 'modifiedon') ||
              texto(registro, 'createdon');

            const base = {
              id: guid(texto(registro, 'dgt_documentorevisaoid')),
              documento,
              revisao: texto(registro, 'dgt_revisao'),
              status,
              desde,
              diasParado: diasDesde(desde)
            };

            if (estagio === 'aprovacao') {

              if (
                admin ||
                areasOndeSouGestor.indexOf(guid(documento.areaId)) >= 0
              ) {
                lista.push({
                  ...base,
                  tipo: 'aprovar'
                });
              }

              return;
            }

            const souResponsavel =
              !!meuId &&
              (
                guid(documento.responsavelId) === meuId ||
                guid(texto(registro, '_dgt_responsavel_value')) === meuId
              );

            if (souResponsavel) {
              lista.push({
                ...base,
                tipo: 'elaborar'
              });
            }
          }
        );

        // Mais antigas primeiro — são as mais urgentes.
        return lista.sort(
          (a, b) => b.diasParado - a.diasParado
        );
      },
      [
        registros,
        tarefas,
        autores,
        revisoesComFluxo,
        etapasIniciais,
        documentos,
        contexto,
        usuariosAreas
      ]
    );

  return {
    pendencias,
    carregando,
    erro,
    recarregar
  };
};
