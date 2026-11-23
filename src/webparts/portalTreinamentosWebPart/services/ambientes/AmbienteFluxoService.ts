import {
  NotificacaoFluxoService
} from '../notificacoes/NotificacaoFluxoService';

import {
  IDependenciasSubprocessoAmbiente,
  ISolicitanteFilho,
  avaliarFilhosAmbiente,
  executarSubprocessosAmbiente
} from './subprocessoAmbiente';

import {
  executarScriptIsolado
} from '../../components/fluxo/executarScriptIsolado';

import {
  DataverseService
} from '../DataverseService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  AreaAdminService,
  IUsuarioAreaAdmin
} from '../AreaAdminService';

import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoInstancia,
  IFluxoTarefa
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  IAmbiente,
  IAmbienteRegistro,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  FluxoService,
  IContextoExecucaoFluxo
} from '../fluxo/FluxoService';

import {
  IFluxoRepositorio
} from '../fluxo/FluxoRepositorioLocal';

import {
  obterPersistenciaFluxo
} from '../fluxo/persistenciaFluxo';

import {
  subprocessoAguardando,
  atorPodeExecutar,
  obterElementoAtual,
  tarefaPendente
} from '../fluxo/FluxoEngine';

import {
  IDadosRevisaoResponsaveis,
  papeisDoUsuario,
  resolverResponsaveis,
  usuarioAtende
} from '../fluxo/ResolvedorResponsaveis';

import {
  AmbienteService,
  ehAdministradorSistema
} from './AmbienteService';

import {
  avisosFluxoAmbiente
} from './compatibilidadeFluxoAmbiente';

import {
  REGISTRO,
  TABELAS_AMBIENTE
} from './esquemaAmbientes';

// ============================================================
// FLUXO DOS REGISTROS DE UM AMBIENTE
//
// O registro segue o fluxo PUBLICADO do processo do ambiente, com o
// MESMO motor usado em Documentos, Treinamentos e Orçamento: etapas,
// decisões, responsáveis, campos, prazos e ações vêm do desenho.
//
// O estado do fluxo fica no próprio registro
// (dgt_ambienteregistro.dgt_fluxoestado, JSON), igual ao Orçamento.
// Alterações no fluxo valem também para os registros EM ANDAMENTO:
// ao publicar (ou "Aplicar alterações" no editor), cada registro em
// andamento é levado para a versão publicada, na MESMA etapa e com o
// prazo da etapa contado da data em que ela começou
// (atualizarRegistrosDoProcesso). Quem não pôde ser levado (ex.: a
// etapa atual foi removida do desenho) continua na versão em que
// estava, e é tentado de novo ao abrir o registro (atualizarVersao).
//
// Para listas, filtros, avisos (Power Automate) e Power BI, o registro
// também recebe: situação, etapa atual, prazo da etapa, responsáveis
// da etapa (JSON) e data de conclusão.
//
// Responsáveis do desenho:
//   "Autor da revisão"      → quem abriu o registro (solicitante)
//   "Gestor da área"        → gestores da área do registro
//   demais (área, usuário, cargo, hierarquia, usuário do campo)
//                           → iguais aos de Documentos
// ============================================================

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

const gerarId = (prefixo: string): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ------------------------------------------------------------
// Onde o estado do fluxo é gravado: no próprio registro.
// ------------------------------------------------------------

class AmbienteFluxoRepositorio implements IFluxoRepositorio {

  public readonly local: boolean = false;

  private readonly dataverse: DataverseService;

  // Versão (ETag) lida por último: impede que duas pessoas avancem o
  // fluxo ao mesmo tempo sobre o mesmo estado.
  private readonly etags: { [registroId: string]: string } = {};

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async obter(registroId: string): Promise<IFluxoInstancia | undefined> {
    const lido =
      await this.dataverse.obterRegistro(
        TABELAS_AMBIENTE.registro,
        registroId,
        [REGISTRO.fluxoEstado]
      );

    if (!lido) {
      return undefined;
    }

    this.etags[guid(registroId)] = lido.etag;

    const json = lido.registro[REGISTRO.fluxoEstado];

    if (!json) {
      return undefined;
    }

    try {
      return JSON.parse(String(json)) as IFluxoInstancia;
    } catch {
      return undefined;
    }
  }

  public async salvar(instancia: IFluxoInstancia): Promise<string[]> {
    const id = guid(instancia.revisaoId);
    const novaEtag =
      await this.dataverse.atualizarRegistro(
        TABELAS_AMBIENTE.registro,
        id,
        { [REGISTRO.fluxoEstado]: JSON.stringify(instancia) },
        this.etags[id] || undefined
      );
    this.etags[id] = novaEtag || '';
    return [];
  }

  // Nunca apaga o estado (histórico). Mantido só pelo contrato.
  public async remover(): Promise<void> {
    return undefined;
  }

  public async renovarVersao(registroId: string): Promise<void> {
    await this.obter(registroId);
  }
}

// ------------------------------------------------------------
// Tipos usados pelas telas
// ------------------------------------------------------------

export interface IEstadoFluxoRegistro {
  instancia: IFluxoInstancia;
  definicao: IFluxoDefinicao;
}

export interface IDisponibilidadeFluxoAmbiente {
  ativo: boolean;
  // Por que o fluxo não está ativo (mostrado na tela).
  motivo: string;
  processo?: IProcesso;
  definicao?: IFluxoDefinicao;
  // Etapas do fluxo próprias de documentos (ignoradas no ambiente).
  avisos?: string[];
}

export interface IResultadoAcaoAmbiente {
  ok: boolean;
  erros: string[];
  avisos: string[];
}

// Resultado da atualização dos registros em andamento para a versão
// publicada do fluxo.
export interface IResultadoAtualizacaoVersao {
  atualizados: number;
  // Registros que ficaram na versão anterior, com o motivo.
  mantidos: Array<{ codigo: string; motivo: string }>;
  // Texto pronto para mostrar ao usuário (vazio = nada a informar).
  mensagens: string[];
}

export interface IPendenciaAmbiente {
  registro: IAmbienteRegistro;
  estado: IEstadoFluxoRegistro;
  tarefa: IFluxoTarefa;
}

export class AmbienteFluxoService {

  private readonly dataverse: DataverseService;

  private readonly repositorio: AmbienteFluxoRepositorio;

  private readonly fluxo: FluxoService;

  private vinculosCache: IUsuarioAreaAdmin[] | undefined;

  private usuariosCache: Array<{ id: string; nome: string }> | undefined;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
    this.repositorio = new AmbienteFluxoRepositorio(dataverse);

    // Mesmo catálogo (desenho publicado) e mesmos metadados usados
    // em Documentos, Treinamentos e Orçamento.
    const persistencia = obterPersistenciaFluxo(dataverse);

    this.fluxo =
      new FluxoService(
        this.repositorio,
        persistencia.catalogo,
        persistencia.metadados,
        // Notificações do fluxo (aba Notificações e evento com carta).
        new NotificacaoFluxoService(dataverse, 'ambiente')
      );
  }

  // ----------------------------------------------------------
  // Disponibilidade: o processo do ambiente tem fluxo publicado?
  // ----------------------------------------------------------

  public async verificar(
    ambiente: IAmbiente
  ): Promise<IDisponibilidadeFluxoAmbiente> {

    if (!ambiente.processoId) {
      return {
        ativo: false,
        motivo: 'Este ambiente não tem processo de fluxo vinculado. Peça ao Administrador para revisar o cadastro do ambiente.'
      };
    }

    try {
      const persistencia = obterPersistenciaFluxo(this.dataverse);

      if (persistencia.local) {
        return {
          ativo: false,
          motivo: 'O fluxo configurável está em modo de teste (FLUXO_PERSISTENCIA = \'local\'). Ambientes exigem o modo \'dataverse\'.'
        };
      }

      const dados = await persistencia.processos.carregar(false, []);
      const processo = dados.processos.filter(item => guid(item.id) === guid(ambiente.processoId))[0];

      if (!processo) {
        return {
          ativo: false,
          motivo: `O processo do fluxo (${ambiente.processoNome || ambiente.processoId}) não foi encontrado ou está inativo.`
        };
      }

      const publicada = await this.fluxo.definicaoPublicada(processo.id);

      if (!publicada) {
        return {
          ativo: false,
          motivo: `O fluxo do ambiente ainda não foi publicado. Desenhe e publique o fluxo do processo ${processo.codigo} para liberar novos registros.`,
          processo
        };
      }

      return { ativo: true, motivo: '', processo, definicao: publicada, avisos: avisosFluxoAmbiente(publicada) };
    } catch (erro) {
      return { ativo: false, motivo: `Não foi possível ler o fluxo do ambiente: ${mensagem(erro)}` };
    }
  }

  // ----------------------------------------------------------
  // Pessoas (vínculos usuário × área e nomes)
  // ----------------------------------------------------------

  public async vinculos(forcar = false): Promise<IUsuarioAreaAdmin[]> {
    if (!this.vinculosCache || forcar) {
      try {
        this.vinculosCache = await new AreaAdminService(this.dataverse).listarUsuariosArea();
      } catch {
        this.vinculosCache = [];
      }
    }
    return this.vinculosCache;
  }

  public async usuarios(): Promise<Array<{ id: string; nome: string }>> {
    if (!this.usuariosCache) {
      try {
        this.usuariosCache =
          (await new AreaAdminService(this.dataverse).listarUsuarios())
            .map(item => ({ id: guid(item.id), nome: item.nome }));
      } catch {
        this.usuariosCache = [];
      }
    }
    return this.usuariosCache;
  }

  public dadosResponsaveis(
    registro: IAmbienteRegistro,
    instancia?: IFluxoInstancia
  ): IDadosRevisaoResponsaveis {
    return {
      revisaoResponsavelId: registro.solicitanteId,
      documentoAreaId: registro.areaId || undefined,
      valores: instancia ? instancia.valores : undefined
    };
  }

  public async ator(
    definicao: IFluxoDefinicao,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    instancia?: IFluxoInstancia
  ): Promise<IFluxoAtor> {
    return {
      id: guid(contexto.usuarioId),
      nome: contexto.nome,
      papeisTeste: papeisDoUsuario(definicao, contexto, this.dadosResponsaveis(registro, instancia), await this.vinculos())
    };
  }

  private contextoExecucao(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    usuario?: { id: string; nome: string }
  ): IContextoExecucaoFluxo {
    const dados = this.dadosResponsaveis(registro);
    return {
      // Tarefa "Executar script": roda isolada e preenche campos.
      executarScript: async (elemento, instancia) =>
        elemento.script
          ? executarScriptIsolado(
            elemento.script,
            {
              valores: instancia.valores,
              registro: { codigo: registro.codigo, titulo: registro.titulo },
              usuario: usuario || { id: '', nome: '' }
            },
            this.dataverse
          )
          : { valores: {}, erros: ['o script não está configurado.'], log: [] },
      resolverResponsaveis: (responsaveis, valores) =>
        resolverResponsaveis(responsaveis, { ...dados, valores }, this.vinculosCache),
      rotuloRevisao: `${registro.codigo} — ${registro.titulo}`.substring(0, 200),
      // Ambientes não publicam documentos: as demais tarefas de sistema
      // do desenho apenas seguem adiante. O SUBPROCESSO cria registros
      // no ambiente cujo fluxo foi escolhido (ex.: Auditoria → Não
      // Conformidades), um por linha da tabela — ver subprocessoAmbiente.
      executarAcoesSistema: async (acoes, instancia) => {
        if (acoes.indexOf('criarSubprocessos') < 0) {
          return;
        }
        const definicao = await this.fluxo.definicaoDaInstancia(instancia);
        if (definicao) {
          await executarSubprocessosAmbiente(definicao, instancia, registro, this.dependenciasSubprocesso());
        }
      }
    };
  }

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  public async carregar(
    registro: IAmbienteRegistro
  ): Promise<IEstadoFluxoRegistro | undefined> {

    const instancia = await this.repositorio.obter(registro.id);

    if (!instancia) {
      return undefined;
    }

    const definicao = await this.fluxo.definicaoDaInstancia(instancia);

    return definicao ? { instancia, definicao } : undefined;
  }

  // ----------------------------------------------------------
  // Atualização para a versão publicada do fluxo
  // ----------------------------------------------------------

  // Leva o registro em andamento para a versão publicada do fluxo do
  // processo, na mesma etapa (sem reiniciar o prazo dela). Nada muda se
  // ele já estiver na versão publicada, se estiver concluído/cancelado
  // ou se a etapa atual não existir na versão publicada (fica onde está).
  public async atualizarVersao(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    usuario: { id: string; nome: string }
  ): Promise<{ status: 'atualizado' | 'semAlteracao' | 'mantido'; motivo: string }> {

    if (registro.situacao === 'cancelado') {
      return { status: 'semAlteracao', motivo: '' };
    }

    const instancia = await this.repositorio.obter(registro.id);

    if (!instancia || instancia.status !== 'emAndamento') {
      return { status: 'semAlteracao', motivo: '' };
    }

    const processoId = instancia.processoId || ambiente.processoId;

    if (!processoId) {
      return { status: 'semAlteracao', motivo: '' };
    }

    const publicada = await this.fluxo.definicaoPublicada(processoId);

    if (
      !publicada ||
      publicada.id !== instancia.fluxoId ||
      publicada.versao <= instancia.fluxoVersao
    ) {
      return { status: 'semAlteracao', motivo: '' };
    }

    await this.vinculos();

    const ator = { id: guid(usuario.id), nome: usuario.nome || 'Sistema' };

    const resultado =
      await this.fluxo.transferirParaProcesso(
        registro.id,
        publicada,
        {
          tipo: 'versao',
          processoId,
          processoNome: instancia.processoNome || ambiente.processoNome || '',
          ator: { ...ator, papeisTeste: [] },
          justificativa: 'Atualização automática: o fluxo do ambiente foi alterado.',
          manterPrazoEtapa: true
        },
        true,
        this.contextoExecucao(ambiente, registro, ator)
      );

    if (!resultado.ok) {
      return { status: 'mantido', motivo: resultado.erros.join(' ') };
    }

    const estado = await this.carregar(registro);

    if (estado) {
      await this.sincronizar(registro, estado);
    }

    return { status: 'atualizado', motivo: '' };
  }

  // Depois de publicar uma versão do fluxo: leva para ela os registros
  // em andamento de TODOS os ambientes que usam o processo.
  public async atualizarRegistrosDoProcesso(
    processoId: string,
    usuario: { id: string; nome: string }
  ): Promise<IResultadoAtualizacaoVersao> {

    const resultado: IResultadoAtualizacaoVersao = { atualizados: 0, mantidos: [], mensagens: [] };
    const servico = new AmbienteService(this.dataverse);

    let ambientes: IAmbiente[];

    try {
      const lista = await servico.listar();
      ambientes = lista.ambientes.filter(item => guid(item.processoId) === guid(processoId));
    } catch (erro) {
      resultado.mensagens.push(`Não foi possível ler os ambientes que usam este fluxo: ${mensagem(erro)}`);
      return resultado;
    }

    for (const ambiente of ambientes) {

      let registros: IAmbienteRegistro[];

      try {
        registros = (await servico.listarRegistros(ambiente)).filter(item => item.situacao === 'emAndamento');
      } catch (erro) {
        resultado.mensagens.push(`${ambiente.nome}: não foi possível listar os registros (${mensagem(erro)}).`);
        continue;
      }

      for (const registro of registros) {
        try {
          const item = await this.atualizarVersao(ambiente, registro, usuario);
          if (item.status === 'atualizado') {
            resultado.atualizados++;
          } else if (item.status === 'mantido') {
            resultado.mantidos.push({ codigo: registro.codigo, motivo: item.motivo });
          }
        } catch (erro) {
          resultado.mantidos.push({ codigo: registro.codigo, motivo: mensagem(erro) });
        }
      }
    }

    if (resultado.atualizados > 0) {
      resultado.mensagens.unshift(
        `${resultado.atualizados} registro(s) em andamento de ambiente passaram para a nova versão, na mesma etapa.`
      );
    }

    resultado.mantidos.forEach(item =>
      resultado.mensagens.push(`${item.codigo} continua na versão anterior: ${item.motivo}`)
    );

    return resultado;
  }

  public async podeAgir(
    estado: IEstadoFluxoRegistro,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso
  ): Promise<boolean> {
    if (estado.instancia.status === 'concluido' || registro.situacao === 'cancelado') {
      return false;
    }
    const elemento = obterElementoAtual(estado.definicao, estado.instancia);
    return atorPodeExecutar(elemento, await this.ator(estado.definicao, registro, contexto, estado.instancia));
  }

  // ----------------------------------------------------------
  // Início e ações
  // ----------------------------------------------------------

  // Inicia o fluxo do registro (se ainda não tiver). Idempotente.
  public async iniciar(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    // Registro criado por subprocesso: valores herdados e origem.
    extras?: {
      valoresIniciais: Record<string, string>;
      origemSubprocesso: { documentoId: string; codigo: string; titulo: string; elementoNome: string; linha?: number };
      camposSomenteLeitura: string[];
    }
  ): Promise<IResultadoAcaoAmbiente> {

    const disponibilidade = await this.verificar(ambiente);

    if (!disponibilidade.ativo || !disponibilidade.processo || !disponibilidade.definicao) {
      return { ok: false, erros: [disponibilidade.motivo], avisos: [] };
    }

    await this.vinculos();

    let resultado;

    try {
      resultado =
        await this.fluxo.iniciar(
          disponibilidade.processo,
          {
            revisaoId: registro.id,
            documentoId: registro.id,
            revisao: registro.codigo,
            ator: await this.ator(disponibilidade.definicao, registro, contexto),
            simulado: false,
            valoresIniciais: extras ? extras.valoresIniciais : undefined,
            origemSubprocesso: extras ? extras.origemSubprocesso : undefined,
            camposSomenteLeitura: extras ? extras.camposSomenteLeitura : undefined
          },
          this.contextoExecucao(ambiente, registro, { id: guid(contexto.usuarioId), nome: contexto.nome })
        );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    if (!resultado.ok || !resultado.instancia) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    const estado = await this.carregar(registro);

    if (estado) {
      const aviso = await this.sincronizar(registro, estado);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    return { ok: true, erros: [], avisos };
  }

  // Executa uma ação da etapa atual (ex.: Enviar, Aprovar, Reprovar).
  public async executar(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ): Promise<IResultadoAcaoAmbiente> {

    if (registro.situacao === 'cancelado') {
      return { ok: false, erros: ['Este registro foi cancelado.'], avisos: [] };
    }

    const antes = await this.carregar(registro);

    if (!antes) {
      return { ok: false, erros: ['O fluxo deste registro ainda não foi iniciado.'], avisos: [] };
    }

    await this.vinculos();

    let resultado;

    try {
      resultado =
        await this.fluxo.executar(
          registro.id,
          {
            acaoChave,
            comentario,
            valores,
            ator: await this.ator(antes.definicao, registro, contexto, antes.instancia)
          },
          this.contextoExecucao(ambiente, registro, { id: guid(contexto.usuarioId), nome: contexto.nome })
        );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    const depois = await this.carregar(registro);

    if (depois) {
      const aviso = await this.sincronizar(registro, depois);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    return { ok: true, erros: [], avisos };
  }

  // Executa uma ação da etapa atual NO LUGAR do responsável. Só o
  // Administrador do Sistema (conferido também no servidor, pelo
  // plugin). Exige justificativa (comentário) e marca o histórico.
  public async executarComoAdministrador(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ): Promise<IResultadoAcaoAmbiente> {
    if (!ehAdministradorSistema(contexto)) {
      return { ok: false, erros: ['Somente o Administrador do Sistema pode executar ações como administrador.'], avisos: [] };
    }
    if (registro.situacao !== 'emAndamento') {
      return { ok: false, erros: ['Somente registros em andamento aceitam ações.'], avisos: [] };
    }
    if (!(comentario || '').trim()) {
      return { ok: false, erros: ['Informe no comentário a justificativa da ação executada como administrador.'], avisos: [] };
    }
    const antes = await this.carregar(registro);
    if (!antes) {
      return { ok: false, erros: ['O fluxo deste registro ainda não foi iniciado.'], avisos: [] };
    }
    await this.vinculos();
    const usuario = { id: guid(contexto.usuarioId), nome: contexto.nome };
    let resultado;
    try {
      resultado = await this.fluxo.executar(
        registro.id,
        { acaoChave, comentario, valores, ator: { ...usuario, papeisTeste: [] }, comoAdministrador: true },
        this.contextoExecucao(ambiente, registro, usuario)
      );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }
    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }
    const avisos = (resultado.avisos || []).slice();
    const depois = await this.carregar(registro);
    if (depois) {
      const aviso = await this.sincronizar(registro, depois);
      if (aviso) {
        avisos.push(aviso);
      }
    }
    return { ok: true, erros: [], avisos };
  }

  // ----------------------------------------------------------
  // Subprocesso entre ambientes
  // ----------------------------------------------------------

  private dependenciasSubprocesso(): IDependenciasSubprocessoAmbiente {
    const ambientes = new AmbienteService(this.dataverse);
    const contextoDe = (pessoa: ISolicitanteFilho): IContextoAcesso =>
      ({ usuarioId: pessoa.id, nome: pessoa.nome, perfil: 'Funcionario' } as unknown as IContextoAcesso);
    return {
      ambienteDoFluxo: async fluxoId => {
        const lista = await ambientes.listar();
        return lista.ambientes.find(item => item.ativo && guid(item.processoId) === guid(fluxoId));
      },
      criarRegistro: (ambiente, dados, solicitante) => ambientes.criarRegistro(ambiente, dados, contextoDe(solicitante)),
      iniciarFluxo: async (ambiente, registro, solicitante, extras) =>
        (await this.iniciar(ambiente, registro, contextoDe(solicitante), extras)).erros
    };
  }

  // Modo "aguardar": confere os registros filhos e retoma o pai quando
  // todos terminaram. Com "motivo" (Administrador do Sistema), libera sem
  // esperar.
  public async conferirSubprocesso(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    motivo?: string
  ): Promise<IResultadoAcaoAmbiente> {
    if (motivo !== undefined && !ehAdministradorSistema(contexto)) {
      return { ok: false, erros: ['Somente o Administrador do Sistema pode liberar sem esperar.'], avisos: [] };
    }
    const estado = await this.carregar(registro);
    if (!estado || !subprocessoAguardando(estado.definicao, estado.instancia)) {
      return { ok: false, erros: [], avisos: [] };
    }
    let resultado;
    try {
      resultado = await this.fluxo.retomarSubprocesso(
        registro.id,
        await this.ator(estado.definicao, registro, contexto, estado.instancia),
        async pedido => {
          const ids = pedido.filhos.map(item => guid(item.documentoId)).filter(item => !!item);
          const situacoes: Record<string, SituacaoRegistroAmbiente | undefined> = {};
          if (ids.length > 0) {
            const linhas = await this.dataverse.listarRegistros(
              TABELAS_AMBIENTE.registro,
              `$select=${REGISTRO.id},${REGISTRO.situacao}&$filter=${ids.map(id => `${REGISTRO.id} eq ${id}`).join(' or ')}`
            );
            linhas.forEach(linha => {
              situacoes[guid(String(linha[REGISTRO.id]))] = String(linha[REGISTRO.situacao] || '') as SituacaoRegistroAmbiente;
            });
          }
          pedido.filhos.forEach(filho => {
            const situacao = situacoes[guid(filho.documentoId)];
            if (situacao !== undefined) {
              situacoes[filho.documentoId] = situacao;
            }
          });
          return avaliarFilhosAmbiente(pedido, situacoes);
        },
        this.contextoExecucao(ambiente, registro, { id: guid(contexto.usuarioId), nome: contexto.nome }),
        motivo
      );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }
    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros, avisos: [] };
    }
    const depois = await this.carregar(registro);
    if (depois) {
      await this.sincronizar(registro, depois);
    }
    return { ok: true, erros: [], avisos: resultado.avisos || [] };
  }

  // Edição administrativa: salva os campos da etapa atual sem mudar a
  // etapa nem a situação. Só o Administrador do Sistema (conferido
  // também no servidor, pelo plugin).
  public async editarComoAdministrador(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    valores: Record<string, string>,
    comentario: string
  ): Promise<IResultadoAcaoAmbiente> {
    if (!ehAdministradorSistema(contexto)) {
      return { ok: false, erros: ['Somente o Administrador do Sistema pode editar como administrador.'], avisos: [] };
    }
    if (registro.situacao !== 'emAndamento') {
      return { ok: false, erros: ['Somente registros em andamento podem ser editados.'], avisos: [] };
    }
    let resultado;
    try {
      resultado = await this.fluxo.editarCamposAdministrador(
        registro.id,
        { valores, comentario, ator: { id: guid(contexto.usuarioId), nome: contexto.nome, papeisTeste: [] } },
        this.contextoExecucao(ambiente, registro, { id: guid(contexto.usuarioId), nome: contexto.nome })
      );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }
    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros, avisos: [] };
    }
    const depois = await this.carregar(registro);
    if (depois) {
      await this.sincronizar(registro, depois);
    }
    return { ok: true, erros: [], avisos: resultado.avisos || [] };
  }

  // Libera o fluxo parado em "Assinatura digital" (situação final do
  // pedido ou liberação manual do Administrador).
  public async concluirAssinatura(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    contexto: IContextoAcesso,
    chave: string,
    saida: { situacao: string; valores: Record<string, string>; comentario?: string; manual?: boolean }
  ): Promise<string[]> {
    const antes = await this.carregar(registro);
    const ator = antes && saida.manual ? await this.ator(antes.definicao, registro, contexto, antes.instancia) : undefined;
    let resultado;
    try {
      resultado = await this.fluxo.concluirAssinatura(
        registro.id,
        chave,
        { situacao: saida.situacao, valores: saida.valores, comentario: saida.comentario, ator },
        this.contextoExecucao(ambiente, registro, { id: guid(contexto.usuarioId), nome: contexto.nome })
      );
    } catch (erro) {
      return [mensagem(erro)];
    }
    if (!resultado.ok) {
      return resultado.erros;
    }
    const depois = await this.carregar(registro);
    if (depois) {
      await this.sincronizar(registro, depois);
    }
    return [];
  }

  // Cancela o registro (Administrador global ou do ambiente).
  // Motivo obrigatório. O histórico do fluxo é preservado.
  public async cancelar(
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    motivo: string,
    contexto: IContextoAcesso
  ): Promise<IResultadoAcaoAmbiente> {

    // Só o Administrador do Sistema (conferido também no servidor).
    if (!ehAdministradorSistema(contexto)) {
      return { ok: false, erros: ['Somente o Administrador do Sistema pode cancelar registros.'], avisos: [] };
    }

    if (!(motivo || '').trim()) {
      return { ok: false, erros: ['Informe o motivo do cancelamento.'], avisos: [] };
    }

    if (registro.situacao !== 'emAndamento') {
      return { ok: false, erros: ['Somente registros em andamento podem ser cancelados.'], avisos: [] };
    }

    const agora = new Date().toISOString();
    const estado = await this.carregar(registro);

    if (estado) {
      const { instancia, definicao } = estado;
      const atual = obterElementoAtual(definicao, instancia);

      instancia.tarefas.forEach(tarefa => {
        if (tarefa.status === 'pendente') {
          tarefa.status = 'cancelada';
          tarefa.concluidaEm = agora;
          tarefa.concluidaPorNome = contexto.nome;
        }
      });

      // Mesmo padrão do motor: o passo mais recente fica no início.
      instancia.historico.unshift({
        id: gerarId('hist'),
        data: agora,
        elementoId: atual ? atual.id : instancia.elementoAtualId,
        elementoNome: atual ? atual.nome : 'Fluxo',
        acaoChave: 'cancelamentoAdministrador',
        acaoRotulo: 'Registro cancelado pelo administrador',
        resultado: 'cancelado',
        comentario: motivo.trim(),
        executadoPorId: guid(contexto.usuarioId),
        executadoPorNome: contexto.nome,
        sistema: false,
        revisao: instancia.revisao
      });

      try {
        // Relê para pegar a versão atual (ETag) antes de gravar.
        await this.repositorio.obter(registro.id);
        await this.repositorio.salvar(instancia);
      } catch (erro) {
        return { ok: false, erros: [mensagem(erro)], avisos: [] };
      }
    }

    try {
      await this.dataverse.atualizarRegistro(
        TABELAS_AMBIENTE.registro,
        registro.id,
        {
          [REGISTRO.situacao]: 'cancelado',
          [REGISTRO.etapaAtual]: 'Cancelado',
          [REGISTRO.prazoEtapa]: null,
          [REGISTRO.responsaveisEtapa]: null,
          [REGISTRO.concluidoEm]: agora
        }
      );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    return { ok: true, erros: [], avisos: [] };
  }

  // Grava no registro a situação, a etapa atual, o prazo e os
  // responsáveis da etapa. Devolve um aviso se não conseguir gravar.
  public async sincronizar(
    registro: IAmbienteRegistro,
    estado: IEstadoFluxoRegistro
  ): Promise<string> {

    const { instancia, definicao } = estado;
    const concluido = instancia.status === 'concluido';
    const atual = obterElementoAtual(definicao, instancia);
    const tarefa = tarefaPendente(instancia);

    const corpo: Record<string, unknown> = {
      [REGISTRO.situacao]: concluido ? 'concluido' : 'emAndamento',
      [REGISTRO.etapaAtual]: (concluido ? 'Concluído' : atual ? atual.nome : '').substring(0, 200),
      [REGISTRO.prazoEtapa]: tarefa && tarefa.prazo ? tarefa.prazo : null,
      [REGISTRO.responsaveisEtapa]:
        tarefa
          ? JSON.stringify(tarefa.responsaveisResolvidos || resolverResponsaveis(tarefa.responsaveis, this.dadosResponsaveis(registro, instancia), this.vinculosCache))
          : null,
      [REGISTRO.concluidoEm]: concluido ? (instancia.concluidoEm || new Date().toISOString()) : null
    };

    // Colunas das telas configuráveis (opcionais): etapa atual (id) e
    // os valores dos campos, para colunas e filtros da visão geral.
    const corpoLayout: Record<string, unknown> = {
      ...corpo,
      [REGISTRO.etapaAtualId]: concluido || !atual ? null : atual.id,
      [REGISTRO.valores]: JSON.stringify(instancia.valores || {}).substring(0, 1000000)
    };

    try {
      try {
        await this.dataverse.atualizarRegistro(TABELAS_AMBIENTE.registro, registro.id, corpoLayout);
      } catch (erroLayout) {
        if (!/could not find a property|propert(y|ies).*(not exist|não existe)|Could not find/i.test(mensagem(erroLayout))) {
          throw erroLayout;
        }
        // Colunas ainda não criadas: grava o essencial.
        await this.dataverse.atualizarRegistro(TABELAS_AMBIENTE.registro, registro.id, corpo);
      }
      return '';
    } catch (erro) {
      return `O fluxo avançou, mas a situação do registro não foi atualizada: ${mensagem(erro)}`;
    }
  }

  // ----------------------------------------------------------
  // Pendências do usuário neste ambiente
  // ----------------------------------------------------------

  public async pendenciasDoUsuario(
    registros: IAmbienteRegistro[],
    contexto: IContextoAcesso
  ): Promise<IPendenciaAmbiente[]> {

    const vinculos = await this.vinculos();
    const resultado: IPendenciaAmbiente[] = [];

    for (const registro of registros.filter(item => item.situacao === 'emAndamento')) {
      try {
        const estado = await this.carregar(registro);
        const tarefa = estado ? tarefaPendente(estado.instancia) : undefined;
        if (!estado || !tarefa) {
          continue;
        }
        const resolvidos =
          tarefa.responsaveisResolvidos ||
          resolverResponsaveis(tarefa.responsaveis, this.dadosResponsaveis(registro, estado.instancia));
        if (resolvidos.some(item => usuarioAtende(item, contexto.usuarioId, vinculos))) {
          resultado.push({ registro, estado, tarefa });
        }
      } catch {
        // Registro ilegível para este usuário: ignora.
      }
    }

    return resultado;
  }
}
