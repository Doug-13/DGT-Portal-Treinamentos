import {
  sincronizarVinculosTreinamentoDetalhado
} from '../services/referencias/ReferenciasDocumentoService';

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
  calcularPrazoRevisao,
  calcularProximaRevisao,
  estagioRevisao,
  obterRevisaoEmAndamento,
  obterRevisaoVigente,
  revisaoCancelada,
  STATUS_REVISAO_CANCELADA
} from '../services/DocumentoRevisaoFluxoService';

import {
  CHAVE_ARQUIVO_ANTERIOR,
  IResultadoRetorno,
  publicacaoPendente,
  retornarUmPasso as simularRetornoUmPasso
} from '../services/fluxo/FluxoEngine';

import {
  compararRevisoes,
  revisaoInteira
} from '../utils/numeracaoRevisao';

import {
  RevisaoDocumentoAdminService
} from '../services/RevisaoDocumentoAdminService';

import {
  ehAdministrador
} from '../services/DocumentoVisibilidade';

import {
  ChaveModuloPortal
} from '../utils/modulosPortal';

import {
  CONTROLE_DOCUMENTAL
} from '../constants/controleDocumental';

import {
  DocumentoHistoricoService
} from '../services/DocumentoHistoricoService';

import {
  TreinamentoDocumentoControleService
} from '../services/TreinamentoDocumentoControleService';

import {
  controleDocumentalHabilitado
} from '../constants/controleDocumental';

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

  // true = sem revisão em andamento: mostra o fluxo da última revisão
  // (ex.: a vigente) só para consulta. Nunca inicia um fluxo novo.
  somenteConsulta?: boolean;

  // Status atual da revisão (dgt_status). Usado para não adotar o
  // fluxo do processo numa revisão que já andou no fluxo padrão.
  status?: string;
}

// Em que ponto a tela está:
//   semRevisao        → (Dataverse) não há revisão em andamento
//   semProcesso       → documento não vinculado a nenhum processo
//   escolherPrincipal → vinculado a vários; falta escolher qual governa
//   semFluxo          → o processo não tem fluxo publicado
//   foraDoFluxo       → a revisão já avançou no fluxo padrão (antigo)
//                       antes de o processo ter fluxo publicado: ela
//                       termina no fluxo padrão; a próxima segue o
//                       fluxo do processo
//   pronto            → fluxo em andamento ou concluído
export type SituacaoFluxoRevisao =
  | 'carregando'
  | 'semRevisao'
  | 'semProcesso'
  | 'escolherPrincipal'
  | 'semFluxo'
  | 'foraDoFluxo'
  | 'pronto'
  | 'erro';

export interface IUseFluxoRevisaoTeste {
  // true = modo de teste (navegador + simulação).
  local: boolean;

  // true = o usuário é Administrador do portal e NÃO é responsável
  // pela etapa atual: pode executá-la mesmo assim (registrado no
  // histórico como "Nome (Administrador)").
  atuandoComoAdministrador: boolean;

  // A revisão está parada numa etapa de publicação (status "Vigente")
  // sem ter sido publicada — ex.: depois de troca de processo ou de
  // versão do fluxo. concluirPublicacao() publica como o fluxo faria.
  publicacaoPendente: boolean;
  concluirPublicacao: () => Promise<boolean>;

  situacao: SituacaoFluxoRevisao;
  processando: boolean;
  erro: string;
  errosAcao: string[];
  avisos: string[];
  avisoProcessos: string;
  revisaoAlvo?: IRevisaoAlvoFluxo;
  processos: IProcesso[];

  // Versão publicada do fluxo de cada processo (id → versão). Processo
  // fora do mapa = sem fluxo publicado = não pode ser escolhido.
  fluxosPublicados: Record<string, number>;

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

  // ---- Retorno de UM passo (somente administrador) ----
  // true = o usuário pode voltar a revisão uma etapa.
  podeRetornar: boolean;
  // Prévia (simulação, nada gravado) do que o retorno faria.
  previaRetorno?: IResultadoRetorno;
  retornarUmPasso: (justificativa: string) => Promise<boolean>;
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

  // Documento de controle de treinamento (TRN) → administrador do módulo
  // Treinamentos; demais → administrador do módulo Documentos.
  const moduloDoFluxo: ChaveModuloPortal =
    documento && String(documento.tipo || '').toUpperCase() === CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO
      ? 'treinamentos'
      : 'documentos';

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

  const [fluxosPublicados, setFluxosPublicados] =
    React.useState<Record<string, number>>({});

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
            virtual: false,
            status: revisaoEmAndamento.status
          };
        }

        // No Dataverse não há revisão "virtual": é preciso criar a
        // revisão (aba Revisão) para começar o fluxo. Enquanto isso, a
        // aba mostra o fluxo da última revisão, só para consulta.
        if (!local) {
          const ultima =
            (revisoes || [])
              .filter(item => !revisaoCancelada(item))
              .slice()
              .sort((a, b) => compararRevisoes(b.revisao, a.revisao))[0];
          return ultima
            ? {
              id: ultima.id,
              revisao: ultima.revisao,
              virtual: false,
              somenteConsulta: true
            }
            : undefined;
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
        documentoAreaId: documento ? documento.areaId : undefined,
        // Metadados preenchidos (responsável "Usuário do campo").
        valores: instancia ? instancia.valores : undefined
      }),
      [revisaoEmAndamento, documento, autorId, instancia]
    );

  // Administrador agindo numa etapa da qual NÃO é responsável.
  const atuandoComoAdministrador =
    React.useMemo(
      (): boolean => {

        if (local || !definicao || !instancia || !ehAdministrador(contexto, moduloDoFluxo)) {
          return false;
        }

        const pendente =
          instancia.tarefas.find(item => item.status === 'pendente');

        const elemento =
          pendente
            ? definicao.elementos.find(item => item.id === pendente.elementoId)
            : undefined;

        if (!elemento) {
          return false;
        }

        const reais =
          papeisDoUsuario(definicao, contexto, dadosResponsaveis, vinculosUsuarios);

        return !elemento.responsaveis.some(
          responsavel => reais.indexOf(responsavel.papelTeste) >= 0
        );
      },
      [local, definicao, instancia, contexto, dadosResponsaveis, vinculosUsuarios]
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

          // Administrador do portal: pode executar QUALQUER etapa do
          // fluxo. Quando age numa etapa da qual não é responsável, o
          // nome vai ao histórico como "Nome (Administrador)".
          if (
            ehAdministrador(contexto, moduloDoFluxo) &&
            definicao
          ) {
            const todos =
              papeisDaDefinicao(definicao)
                .map(papel => papel.papelTeste);

            return [
              {
                chave: 'eu',
                rotulo: nomeReal,
                descricao: '',
                ator: {
                  id: contexto?.usuarioId || '',
                  nome: atuandoComoAdministrador
                    ? `${nomeReal} (Administrador)`
                    : nomeReal,
                  papeisTeste: papeis.concat(
                    todos.filter(papel => papeis.indexOf(papel) < 0)
                  )
                }
              }
            ];
          }

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
      [contexto, definicao, dadosResponsaveis, vinculosUsuarios, local, atuandoComoAdministrador]
    );

  const atorSelecionado =
    atores.find(item => item.chave === atorChave) || atores[0];

  const contextoExecucao = (
    definicaoAtual: IFluxoDefinicao | undefined
  ): IContextoExecucaoFluxo => ({
    rotuloRevisao: documento && revisaoAlvo ? `${documento.codigo} ${revisaoAlvo.revisao}` : undefined,

    // Usa o autor já identificado (ref), mesmo que o estado ainda
    // não tenha sido atualizado na tela.
    resolverResponsaveis: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>): IResponsavelResolvido[] =>
      resolverResponsaveis(
        responsaveis,
        {
          ...dadosResponsaveis,
          revisaoResponsavelId: autorIdRef.current || dadosResponsaveis.revisaoResponsavelId,
          valores: valores || dadosResponsaveis.valores
        },
        // Hierarquia: grava na pendência quem responde agora (avisos).
        vinculosUsuarios
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

        // 2) Evento de revisão com "Remover o arquivo": a revisão segue
        //    SEM arquivo e o novo é anexado numa etapa seguinte. O
        //    arquivo anterior NÃO é apagado do SharePoint (continua no
        //    histórico como "dados anteriores").
        if (
          acoes.indexOf('removerArquivoRevisao') >= 0 &&
          revisaoEmAndamento.arquivoUrl
        ) {
          // Guarda o endereço removido no estado do fluxo: se um
          // administrador voltar um passo, o arquivo é restaurado.
          Object.assign(
            novaInstancia.valores,
            { [CHAVE_ARQUIVO_ANTERIOR]: revisaoEmAndamento.arquivoUrl }
          );

          await dataverseService.atualizarRegistro(
            'dgt_documentorevisao',
            revisaoEmAndamento.id,
            {
              dgt_arquivourl: ''
            }
          );

          if (documento) {
            await new DocumentoHistoricoService(dataverseService)
              .registrarSemInterromper({
                documentoId: documento.id,
                tipo: 'ARQUIVO_SUBSTITUIDO',
                titulo: 'Arquivo da revisão removido pelo fluxo',
                descricao: 'O novo arquivo será anexado numa etapa seguinte. O arquivo anterior continua no SharePoint.',
                revisao: revisaoEmAndamento,
                dadosAnteriores: {
                  arquivoUrl: revisaoEmAndamento.arquivoUrl
                },
                usuarioId: contexto ? contexto.usuarioId : undefined,
                usuarioNome: contexto ? contexto.nome : 'Sistema'
              });
          }
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

        const resultadoPublicacao =
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

        // Documento de controle de TREINAMENTO: ativa o treinamento na
        // primeira publicação e registra a revisão no histórico dele.
        // Nunca interrompe a publicação (já concluída acima).
        if (documento && controleDocumentalHabilitado()) {
          try {
            await new TreinamentoDocumentoControleService(dataverseService)
              .aoPublicarRevisao(
                documento.id,
                revisaoEmAndamento.id,
                resultadoPublicacao,
                contexto ? contexto.nome : ''
              );
          } catch (error) {
            console.error('Revisão publicada, mas o treinamento vinculado não foi atualizado:', error);
          }
        }

        // Nova revisão vigente → o prazo da próxima revisão periódica
        // recomeça (vigência + 12 meses). Sem a coluna, apenas não grava.
        if (documento) {
          try {
            await dataverseService.atualizarPrazoRevisaoDocumento(
              documento.id,
              calcularPrazoRevisao(dataIso(0))
            );
          } catch (error) {
            console.error('Não foi possível definir o prazo da próxima revisão:', error);
          }
        }
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

          // Só consulta (sem revisão em andamento) e a última revisão
          // não teve fluxo: nada a mostrar; nunca inicia fluxo aqui.
          if (revisaoAlvo.somenteConsulta) {
            setSituacao('semRevisao');
            return;
          }

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

          // 3) TRAVA: revisão que já saiu da Elaboração pelo fluxo
          //    padrão (ex.: "Enviar para aprovação do Gestor") não é
          //    puxada para o fluxo do processo no meio do caminho.
          //    Iniciar aqui recolocaria a revisão na 1ª etapa e
          //    sobrescreveria o status (ex.: Aprovação → Elaboração),
          //    perdendo o envio já feito — só por abrir esta aba.
          if (
            !revisaoAlvo.virtual &&
            estagioRevisao(revisaoAlvo.status || '') !== 'elaboracao'
          ) {
            setSituacao('foraDoFluxo');
            return;
          }

          // 4) Inicia com a versão publicada do fluxo do processo.
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

  const pendenteDePublicacao =
    !local && publicacaoPendente(definicao, instancia);

  const concluirPublicacao =
    async (): Promise<boolean> => {

      if (!revisaoAlvo || !atorSelecionado) {
        return false;
      }

      setProcessando(true);
      setErrosAcao([]);
      setAvisos([]);

      try {
        const resultado =
          await servico.concluirPublicacaoPendente(
            revisaoAlvo.id,
            atorSelecionado.ator,
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

        if (onRevisaoAlterada) {
          await onRevisaoAlterada();
        }

        return true;
      } catch (error) {
        console.error(error);
        setErrosAcao([`Erro ao concluir a publicação: ${error instanceof Error ? error.message : String(error)}`]);
        return false;
      } finally {
        setProcessando(false);
      }
    };

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

        // Referências a treinamentos (documento ↔ treinamento) viram
        // vínculo em dgt_treinamentodocumento. Falha aqui não desfaz a
        // ação: só avisa.
        if (!local && dataverseService && documento) {
          try {
            const sincronizacao =
              await sincronizarVinculosTreinamentoDetalhado(
                dataverseService,
                { id: documento.id, codigo: documento.codigo, tipo: documento.tipo },
                resultado.instancia.valores,
                revisaoAlvo.revisao
              );

            const criados = sincronizacao.criados;

            if (sincronizacao.avisos.length > 0 || sincronizacao.desativados > 0) {
              setAvisos(atual => atual.concat(
                sincronizacao.avisos,
                sincronizacao.desativados > 0
                  ? [`${sincronizacao.desativados} vínculo(s) automático(s) que não correspondiam às referências foram desativados.`]
                  : []
              ));
            }

            if (criados > 0) {
              setAvisos(atual => atual.concat(
                criados === 1
                  ? '1 vínculo entre documento e treinamento foi criado pelas referências.'
                  : `${criados} vínculos entre documentos e treinamentos foram criados pelas referências.`
              ));
            }
          } catch (error) {
            console.error(error);
            setAvisos(atual => atual.concat('Os vínculos entre documentos e treinamentos não puderam ser atualizados.'));
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

  // Versão publicada de cada processo — só quando a aba mostra a
  // escolha de processo (evita leituras desnecessárias no resto).
  React.useEffect(
    () => {

      if (
        situacao !== 'semProcesso' &&
        situacao !== 'escolherPrincipal'
      ) {
        return;
      }

      let cancelado = false;

      const mapa: Record<string, number> = {};

      Promise.all(
        processos.map(
          async processo => {
            try {
              const publicada =
                await persistencia.catalogo.versaoPublicada(processo.id);

              if (publicada) {
                mapa[processo.id] = publicada.versao;
              }
            } catch (error) {
              console.error(error);
            }
          }
        )
      )
        .then(
          () => {
            if (!cancelado) {
              setFluxosPublicados(mapa);
            }
          }
        )
        .catch((error: unknown) => console.error(error));

      return () => {
        cancelado = true;
      };
    },
    [situacao, processos, persistencia]
  );

  // Só processo com fluxo publicado pode governar a revisão.
  const exigirFluxoPublicado =
    async (
      processoId: string
    ): Promise<boolean> => {

      const publicada =
        await persistencia.catalogo.versaoPublicada(processoId);

      if (!publicada) {
        const processo =
          processos.find(item => item.id === processoId);

        setErro(
          `O processo “${processo ? processo.nome : processoId}” ainda não tem fluxo publicado. ` +
          'Publique o fluxo no módulo Processos antes de vincular documentos a ele.'
        );
        return false;
      }

      return true;
    };

  const vincularProcesso =
    async (
      processoId: string
    ): Promise<void> => {

      if (!documento) {
        return;
      }

      if (!(await exigirFluxoPublicado(processoId))) {
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

      if (!(await exigirFluxoPublicado(processoId))) {
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

  // ==========================================================
  // RETORNO DE UM PASSO (somente administrador)
  // ==========================================================

  const revisaoVigente =
    React.useMemo(
      () => obterRevisaoVigente(revisoes || []),
      [revisoes]
    );

  const nomeAdministrador =
    `${contexto?.nome || contexto?.email || 'Administrador'} (Administrador)`;

  const podeRetornar =
    ehAdministrador(contexto, moduloDoFluxo) &&
    !!revisaoAlvo &&
    !revisaoAlvo.somenteConsulta &&
    !!instancia &&
    instancia.status === 'emAndamento' &&
    !!definicao;

  // Cancelar a revisão (voltar para a vigente) só no Dataverse e só
  // quando existe revisão vigente.
  const permitirCancelarRevisao =
    !local &&
    !!revisaoVigente &&
    !!revisaoEmAndamento;

  const previaRetorno: IResultadoRetorno | undefined =
    React.useMemo(
      () =>
        podeRetornar && instancia && definicao
          ? simularRetornoUmPasso(
            definicao,
            instancia,
            {
              ator: { id: '', nome: nomeAdministrador, papeisTeste: [] },
              justificativa: 'prévia',
              permitirCancelarRevisao,
              revisaoVigente: revisaoVigente ? revisaoVigente.revisao : undefined
            }
          )
          : undefined,
      [podeRetornar, instancia, definicao, nomeAdministrador, permitirCancelarRevisao, revisaoVigente]
    );

  const retornarUmPasso =
    async (
      justificativa: string
    ): Promise<boolean> => {

      if (!podeRetornar || !revisaoAlvo || !previaRetorno || !previaRetorno.ok) {
        setErrosAcao(previaRetorno ? previaRetorno.erros : ['Retorno não disponível.']);
        return false;
      }

      setProcessando(true);
      setErrosAcao([]);
      setAvisos([]);

      try {

        // Cancelar a revisão exige a opção "Cancelada" em dgt_status.
        // Confere ANTES de gravar qualquer coisa.
        if (previaRetorno.modo === 'revisao' && dataverseService) {
          try {
            await dataverseService.getChoiceOptionValue(
              'dgt_documentorevisao',
              'dgt_status',
              STATUS_REVISAO_CANCELADA
            );
          } catch {
            setErrosAcao([
              'Para voltar à revisão vigente, o status "Cancelada" precisa existir na coluna Status da tabela Revisão do Documento. ' +
              'Rode o script scripts/dataverse/adicionar-status-cancelada-revisao.ps1 e tente novamente. Nada foi alterado.'
            ]);
            return false;
          }
        }

        // Cancelamento: o status "Cancelada" é gravado ANTES do estado do
        // fluxo. Se o fluxo não puder ser gravado, o status volta ao que
        // era — a revisão nunca fica cancelada pela metade.
        const statusOriginal =
          (revisaoEmAndamento && revisaoEmAndamento.status) || 'Elaboração';

        const cancelandoRevisao =
          previaRetorno.modo === 'revisao' &&
          !local &&
          !!dataverseService &&
          !!revisaoEmAndamento;

        const desfazerCancelamento = async (): Promise<void> => {
          if (cancelandoRevisao && dataverseService && revisaoEmAndamento) {
            try {
              await dataverseService.alterarStatusDocumentoRevisao(revisaoEmAndamento.id, statusOriginal);
            } catch (error) {
              console.error('Não foi possível desfazer o status Cancelada:', error);
            }
          }
        };

        if (cancelandoRevisao && dataverseService && revisaoEmAndamento) {
          await dataverseService.alterarStatusDocumentoRevisao(
            revisaoEmAndamento.id,
            STATUS_REVISAO_CANCELADA
          );
        }

        let resultado: IResultadoRetorno;

        try {
          resultado =
          await servico.retornarUmPasso(
            revisaoAlvo.id,
            {
              ator: {
                id: contexto?.usuarioId || 'usuario-atual',
                nome: nomeAdministrador,
                papeisTeste: []
              },
              justificativa,
              // Só cancela se a prévia mostrada ao usuário também era
              // cancelamento (protege contra mudança no meio-tempo).
              permitirCancelarRevisao: permitirCancelarRevisao && previaRetorno.modo === 'revisao',
              revisaoVigente: revisaoVigente ? revisaoVigente.revisao : undefined,
              modoEsperado: previaRetorno.modo,
              destinoEsperadoId: previaRetorno.destinoId
            },
            contextoExecucao(definicao)
          );
        } catch (error) {
          await desfazerCancelamento();
          throw error;
        }

        if (!resultado.ok || !resultado.instancia) {
          await desfazerCancelamento();
          setErrosAcao(
            resultado.erros.length > 0
              ? resultado.erros
              : ['Não foi possível voltar a etapa.']
          );
          return false;
        }

        const avisosRetorno: string[] =
          (resultado.avisos || []).slice();

        if (!local && dataverseService && revisaoEmAndamento && documento) {

          if (resultado.modo !== 'revisao') {

            const alteracoes: Record<string, unknown> = {};

            if (resultado.rotuloRestaurado) {
              alteracoes.dgt_revisao = resultado.rotuloRestaurado;
              alteracoes.dgt_name =
                `${documento.codigo} - ${resultado.rotuloRestaurado}`.substring(0, 100);
            }

            if (resultado.arquivoRestaurarUrl) {
              alteracoes.dgt_arquivourl = resultado.arquivoRestaurarUrl;
            }

            if (Object.keys(alteracoes).length > 0) {
              try {
                await dataverseService.atualizarRegistro(
                  'dgt_documentorevisao',
                  revisaoEmAndamento.id,
                  alteracoes
                );
              } catch (error) {
                console.error(error);
                avisosRetorno.push(
                  'A etapa foi retornada, mas o número/arquivo da revisão não pôde ser restaurado. Confira a revisão.'
                );
              }
            }

            if (resultado.arquivoRemovidoNoTrecho && !resultado.arquivoRestaurarUrl) {
              avisosRetorno.push(
                'O arquivo tinha sido removido pelo evento de revisão e não pôde ser restaurado automaticamente. ' +
                'Anexe-o novamente (o anterior continua no SharePoint e no Histórico).'
              );
            }

            const definicaoAtual =
              await servico.definicaoDaInstancia(resultado.instancia);

            if (definicaoAtual) {
              try {
                await atualizarStatusDocumento(definicaoAtual, resultado.instancia);
              } catch (error) {
                console.error(error);
                avisosRetorno.push('O status do documento não pôde ser atualizado.');
              }
            }
          }

          // Histórico do documento: sempre marcado como alteração do
          // administrador, com a justificativa.
          const avisoHistorico =
            await new DocumentoHistoricoService(dataverseService)
              .registrarSemInterromper({
                documentoId: documento.id,
                tipo: 'OUTRO',
                titulo:
                  resultado.modo === 'revisao'
                    ? `Revisão ${revisaoEmAndamento.revisao} cancelada (alterado por administrador)`
                    : `Etapa retornada (alterado por administrador)`,
                descricao:
                  resultado.modo === 'revisao'
                    ? `Retorno de "${resultado.etapaOrigem}" para ${resultado.etapaDestino}. ` +
                      `O documento volta para a revisão vigente. Justificativa: ${justificativa.trim()}`
                    : `Retorno de "${resultado.etapaOrigem}" para "${resultado.etapaDestino}".` +
                      (resultado.rotuloRestaurado ? ` Número da revisão: ${resultado.rotuloAnterior} → ${resultado.rotuloRestaurado}.` : '') +
                      ` Justificativa: ${justificativa.trim()}`,
                revisao: revisaoEmAndamento,
                statusAnterior: revisaoEmAndamento.status,
                statusNovo:
                  resultado.modo === 'revisao'
                    ? STATUS_REVISAO_CANCELADA
                    : (resultado.statusDestino || undefined),
                motivo: justificativa.trim(),
                usuarioId: contexto ? contexto.usuarioId : undefined,
                usuarioNome: nomeAdministrador
              });

          if (avisoHistorico) {
            avisosRetorno.push(avisoHistorico);
          }
        }

        setInstancia(resultado.instancia);
        setAvisos(avisosRetorno);

        if (!local && onRevisaoAlterada) {
          await onRevisaoAlterada();
        }

        return true;

      } catch (error) {

        console.error(error);

        setErrosAcao([
          (error as { codigo?: string }).codigo === 'CONFLITO'
            ? (error as Error).message
            : `Erro ao voltar a etapa: ${error instanceof Error ? error.message : String(error)}`
        ]);

        return false;

      } finally {
        setProcessando(false);
      }
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
    fluxosPublicados,
    vinculos: documento
      ? vinculosDoDocumento(documento.id, vinculos)
      : [],
    processoAtual: processos.find(item => item.id === processoAtualId),
    definicao,
    instancia,
    atores,
    atorSelecionado,
    atuandoComoAdministrador,
    publicacaoPendente: pendenteDePublicacao,
    concluirPublicacao,
    responsaveisEtapaAtual,
    selecionarAtor: (chave: string) => {
      setAtorChave(chave);
      setErrosAcao([]);
    },
    vincularProcesso,
    escolherPrincipal,
    podeRetornar,
    previaRetorno,
    retornarUmPasso,
    executar,
    reiniciar,
    recarregar: () => carregar(true),
    limparErros: () => setErrosAcao([])
  };
};
