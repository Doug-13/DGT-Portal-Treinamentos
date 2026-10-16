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
  IPlanilhaOrcamento,
  OrcamentoService
} from './OrcamentoService';

import {
  PLANILHA,
  PRAZO_AJUSTE_DIAS_UTEIS,
  PROCESSO_ORCAMENTO,
  STATUS_PLANILHA,
  StatusPlanilha,
  TABELAS_ORCAMENTO
} from './esquemaOrcamento';

import {
  adicionarDiasUteis
} from './diasUteis';

import {
  etapaDePreenchimento,
  situacaoDoFluxo,
  ultimoPassoHumano
} from './situacaoFluxoOrcamento';

export { etapaDePreenchimento } from './situacaoFluxoOrcamento';

// ============================================================
// FLUXO DE APROVAÇÃO DO ORÇAMENTO
//
// A aprovação segue o fluxo PUBLICADO do processo CONT-001
// (Processos → Planejamento Orçamentário), com o MESMO motor usado
// em Documentos e Treinamentos: etapas, decisões, responsáveis,
// prazos (dias úteis), campos e ações vêm do desenho do processo.
//
// Diferença: o estado do fluxo fica na própria planilha
// (dgt_orcamentoplanilha.dgt_fluxoestado, JSON), e não numa revisão
// de documento — o orçamento não tem controle de revisões. O
// histórico do orçamento (dgt_orcamentoevento e o log de alterações)
// continua sendo gravado.
//
// A planilha "congela" a versão do fluxo com que começou (igual às
// revisões de documento): publicar uma v2 do processo só vale para
// planilhas que começarem depois.
//
// Situação da planilha (dgt_status) a partir do fluxo:
//   1ª etapa (preenchimento), nunca avaliada → Em preenchimento
//   1ª etapa depois de uma avaliação          → Devolvida para ajuste
//   qualquer outra etapa                      → Em aprovação
//   fluxo concluído                           → Aprovada
// ============================================================

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const normalizar = (valor?: string): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

const gerarId = (prefixo: string): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Soma dias úteis a partir de agora (mesma regra das etapas do
// motor: só sábado e domingo). Usada na devolução pelo Administrador.
const prazoEmDiasUteisDoMotor = (dias: number): string => {
  const data = new Date();
  let restantes = dias;
  while (restantes > 0) {
    data.setDate(data.getDate() + 1);
    if (data.getDay() !== 0 && data.getDay() !== 6) {
      restantes--;
    }
  }
  return data.toISOString();
};

// ------------------------------------------------------------
// Onde o estado do fluxo é gravado: na própria planilha.
// ------------------------------------------------------------

class OrcamentoFluxoRepositorio implements IFluxoRepositorio {

  public readonly local: boolean = false;

  private readonly dataverse: DataverseService;

  // Versão (ETag) da planilha lida por último: impede que duas
  // pessoas avancem o fluxo ao mesmo tempo sobre o mesmo estado.
  private readonly etags: { [planilhaId: string]: string } = {};

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async obter(planilhaId: string): Promise<IFluxoInstancia | undefined> {
    const lido =
      await this.dataverse.obterRegistro(
        TABELAS_ORCAMENTO.planilha,
        planilhaId,
        [PLANILHA.fluxoEstado]
      );

    if (!lido) {
      return undefined;
    }

    this.etags[guid(planilhaId)] = lido.etag;

    const json = lido.registro[PLANILHA.fluxoEstado];

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
        TABELAS_ORCAMENTO.planilha,
        id,
        { [PLANILHA.fluxoEstado]: JSON.stringify(instancia) },
        this.etags[id] || undefined
      );
    this.etags[id] = novaEtag || '';
    return [];
  }

  public async remover(planilhaId: string): Promise<void> {
    await this.dataverse.atualizarRegistro(
      TABELAS_ORCAMENTO.planilha,
      planilhaId,
      { [PLANILHA.fluxoEstado]: null }
    );
  }

  public async renovarVersao(planilhaId: string): Promise<void> {
    await this.obter(planilhaId);
  }
}

// ------------------------------------------------------------
// Tipos usados pelas telas
// ------------------------------------------------------------

export interface IEstadoFluxoPlanilha {
  instancia: IFluxoInstancia;
  definicao: IFluxoDefinicao;
}

export interface IDisponibilidadeFluxo {
  ativo: boolean;
  // Por que o fluxo não está ativo (mostrado ao Administrador).
  motivo: string;
  processo?: IProcesso;
}

export interface IResultadoAcaoFluxo {
  ok: boolean;
  erros: string[];
  avisos: string[];
}

export interface IPendenciaAprovacao {
  planilha: IPlanilhaOrcamento;
  estado: IEstadoFluxoPlanilha;
  tarefa: IFluxoTarefa;
}

export class OrcamentoFluxoService {

  private readonly dataverse: DataverseService;

  private readonly orcamento: OrcamentoService;

  private readonly repositorio: OrcamentoFluxoRepositorio;

  private readonly fluxo: FluxoService;

  private disponibilidade: IDisponibilidadeFluxo | undefined;

  private vinculosCache: IUsuarioAreaAdmin[] | undefined;

  private usuariosCache: Array<{ id: string; nome: string }> | undefined;

  public constructor(
    dataverse: DataverseService,
    orcamento: OrcamentoService
  ) {
    this.dataverse = dataverse;
    this.orcamento = orcamento;
    this.repositorio = new OrcamentoFluxoRepositorio(dataverse);

    // Mesmo catálogo (desenho publicado do processo) e mesmos
    // metadados usados em Documentos e Treinamentos.
    const persistencia = obterPersistenciaFluxo(dataverse);

    this.fluxo =
      new FluxoService(
        this.repositorio,
        persistencia.catalogo,
        persistencia.metadados
      );
  }

  // ----------------------------------------------------------
  // Disponibilidade (processo CONT-001 + fluxo publicado + colunas)
  // ----------------------------------------------------------

  public async verificar(forcar = false): Promise<IDisponibilidadeFluxo> {

    if (this.disponibilidade && !forcar) {
      return this.disponibilidade;
    }

    const resultado: IDisponibilidadeFluxo = { ativo: false, motivo: '' };

    try {
      if (!(await this.orcamento.temColunasFluxo())) {
        resultado.motivo =
          'As colunas do fluxo de aprovação ainda não existem no Dataverse (execute de novo scripts/dataverse/criar-tabelas-orcamento.ps1). Usando a aprovação simples.';
        this.disponibilidade = resultado;
        return resultado;
      }

      const persistencia = obterPersistenciaFluxo(this.dataverse);
      const dados = await persistencia.processos.carregar(forcar, []);
      const ativos = dados.processos.filter(item => item.ativo !== false);

      const processo =
        ativos.filter(item => normalizar(item.codigo) === normalizar(PROCESSO_ORCAMENTO.CODIGO))[0] ||
        ativos.filter(item => normalizar(item.nome).indexOf(PROCESSO_ORCAMENTO.NOME_CONTEM) >= 0)[0];

      if (!processo) {
        resultado.motivo =
          `Processo ${PROCESSO_ORCAMENTO.CODIGO} não encontrado em Processos. Usando a aprovação simples.`;
        this.disponibilidade = resultado;
        return resultado;
      }

      const publicada = await persistencia.catalogo.versaoPublicada(processo.id);

      if (!publicada) {
        resultado.motivo =
          `O processo ${processo.codigo || processo.nome} ainda não tem fluxo publicado. Usando a aprovação simples.`;
        this.disponibilidade = resultado;
        return resultado;
      }

      if (!etapaDePreenchimento(publicada)) {
        resultado.motivo =
          `O fluxo publicado de ${processo.codigo || processo.nome} não tem nenhuma etapa com responsável. Usando a aprovação simples.`;
        this.disponibilidade = resultado;
        return resultado;
      }

      resultado.ativo = true;
      resultado.processo = processo;
    } catch (erro) {
      resultado.motivo = `Não foi possível ler o processo de aprovação: ${mensagem(erro)}. Usando a aprovação simples.`;
    }

    this.disponibilidade = resultado;
    return resultado;
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

  // "Autor da revisão" = quem criou a planilha; "Gestor da área" =
  // gestores da área da planilha.
  public dadosResponsaveis(planilha: IPlanilhaOrcamento): IDadosRevisaoResponsaveis {
    return {
      revisaoResponsavelId: planilha.gestorId,
      documentoAreaId: planilha.areaId
    };
  }

  public async ator(
    definicao: IFluxoDefinicao,
    planilha: IPlanilhaOrcamento,
    contexto: IContextoAcesso
  ): Promise<IFluxoAtor> {
    return {
      id: guid(contexto.usuarioId),
      nome: contexto.nome,
      papeisTeste: papeisDoUsuario(definicao, contexto, this.dadosResponsaveis(planilha), await this.vinculos())
    };
  }

  private contextoExecucao(planilha: IPlanilhaOrcamento): IContextoExecucaoFluxo {
    const dados = this.dadosResponsaveis(planilha);
    return {
      resolverResponsaveis: responsaveis => resolverResponsaveis(responsaveis, dados),
      rotuloRevisao: `Orçamento ${planilha.ano} — ${planilha.areaNome || planilha.gestorNome}`,
      // O fluxo do orçamento não publica documentos: tarefas de
      // sistema (se houver no desenho) apenas seguem adiante.
      executarAcoesSistema: async () => undefined
    };
  }

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  public async carregar(
    planilha: IPlanilhaOrcamento
  ): Promise<IEstadoFluxoPlanilha | undefined> {

    const instancia = await this.repositorio.obter(planilha.id);

    if (!instancia) {
      return undefined;
    }

    const definicao = await this.fluxo.definicaoDaInstancia(instancia);

    return definicao ? { instancia, definicao } : undefined;
  }

  // O usuário pode agir na etapa atual?
  public async podeAgir(
    estado: IEstadoFluxoPlanilha,
    planilha: IPlanilhaOrcamento,
    contexto: IContextoAcesso
  ): Promise<boolean> {
    if (estado.instancia.status === 'concluido') {
      return false;
    }
    const elemento = obterElementoAtual(estado.definicao, estado.instancia);
    return atorPodeExecutar(elemento, await this.ator(estado.definicao, planilha, contexto));
  }

  // ----------------------------------------------------------
  // Início, ações e devolução pelo Administrador
  // ----------------------------------------------------------

  // Inicia o fluxo da planilha (se ainda não tiver). Idempotente.
  public async iniciar(
    planilha: IPlanilhaOrcamento,
    contexto: IContextoAcesso
  ): Promise<IResultadoAcaoFluxo> {

    const disponibilidade = await this.verificar();

    if (!disponibilidade.ativo || !disponibilidade.processo) {
      return { ok: false, erros: [disponibilidade.motivo], avisos: [] };
    }

    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const publicada = await persistencia.catalogo.versaoPublicada(disponibilidade.processo.id);

    if (!publicada) {
      return { ok: false, erros: ['O processo não tem fluxo publicado.'], avisos: [] };
    }

    const resultado =
      await this.fluxo.iniciar(
        disponibilidade.processo,
        {
          revisaoId: planilha.id,
          documentoId: planilha.id,
          revisao: String(planilha.ano),
          ator: await this.ator(publicada, planilha, contexto),
          simulado: false
        },
        this.contextoExecucao(planilha)
      );

    if (!resultado.ok || !resultado.instancia) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const estado = await this.carregar(planilha);
    const avisos = (resultado.avisos || []).slice();

    if (estado) {
      const aviso = await this.sincronizar(planilha, estado);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    return { ok: true, erros: [], avisos };
  }

  // Executa uma ação da etapa atual (ex.: Enviar, Aprovar, Reprovar).
  public async executar(
    planilha: IPlanilhaOrcamento,
    contexto: IContextoAcesso,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ): Promise<IResultadoAcaoFluxo> {

    const antes = await this.carregar(planilha);

    if (!antes) {
      return { ok: false, erros: ['O fluxo de aprovação desta planilha ainda não foi iniciado.'], avisos: [] };
    }

    const elemento = obterElementoAtual(antes.definicao, antes.instancia);
    const acao = elemento ? elemento.acoes.filter(item => item.chave === acaoChave)[0] : undefined;

    let resultado;

    try {
      resultado =
        await this.fluxo.executar(
          planilha.id,
          {
            acaoChave,
            comentario,
            valores,
            ator: await this.ator(antes.definicao, planilha, contexto)
          },
          this.contextoExecucao(planilha)
        );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    const depois = await this.carregar(planilha);

    if (depois) {
      const aviso = await this.sincronizar(planilha, depois);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    // Histórico do orçamento (o mesmo de antes do fluxo).
    const avisoEvento =
      await this.orcamento.registrarEvento(
        planilha,
        `${elemento ? elemento.nome : 'Etapa'}: ${acao ? acao.rotulo : acaoChave}`.substring(0, 200),
        comentario || '',
        contexto.nome
      );

    if (avisoEvento) {
      avisos.push(avisoEvento);
    }

    return { ok: true, erros: [], avisos };
  }

  // Administrador devolve a planilha para a etapa de preenchimento
  // (fora das ações do desenho). Motivo obrigatório. Fica registrado
  // no histórico do fluxo e no histórico do orçamento.
  public async devolverComoAdministrador(
    planilha: IPlanilhaOrcamento,
    motivo: string,
    contexto: IContextoAcesso
  ): Promise<IResultadoAcaoFluxo> {

    if (contexto.perfil !== 'Administrador') {
      return { ok: false, erros: ['Somente o Administrador pode devolver uma planilha.'], avisos: [] };
    }

    const estado = await this.carregar(planilha);

    if (!estado) {
      return { ok: false, erros: ['O fluxo de aprovação desta planilha não foi encontrado.'], avisos: [] };
    }

    const { instancia, definicao } = estado;
    const preenchimento = etapaDePreenchimento(definicao);
    const atual = obterElementoAtual(definicao, instancia);

    if (!preenchimento) {
      return { ok: false, erros: ['O fluxo não tem etapa de preenchimento.'], avisos: [] };
    }

    if (instancia.status !== 'concluido' && atual && atual.id === preenchimento.id) {
      return { ok: false, erros: ['A planilha já está com o gestor (etapa de preenchimento).'], avisos: [] };
    }

    const agora = new Date().toISOString();

    instancia.tarefas.forEach(tarefa => {
      if (tarefa.status === 'pendente') {
        tarefa.status = 'cancelada';
        tarefa.concluidaEm = agora;
        tarefa.concluidaPorNome = contexto.nome;
      }
    });

    instancia.tarefas.push({
      id: gerarId('tarefa'),
      elementoId: preenchimento.id,
      elementoNome: preenchimento.nome,
      responsaveis: preenchimento.responsaveis,
      responsaveisResolvidos: resolverResponsaveis(preenchimento.responsaveis, this.dadosResponsaveis(planilha)),
      status: 'pendente',
      criadaEm: agora,
      prazo: prazoEmDiasUteisDoMotor(preenchimento.prazoDiasUteis || PRAZO_AJUSTE_DIAS_UTEIS)
    });

    // Mesmo padrão do motor: o passo mais recente fica no início.
    instancia.historico.unshift({
      id: gerarId('hist'),
      data: agora,
      elementoId: atual ? atual.id : instancia.elementoAtualId,
      elementoNome: atual ? atual.nome : 'Fluxo concluído',
      acaoChave: 'devolucaoAdministrador',
      acaoRotulo: 'Devolvido para ajuste pelo administrador',
      resultado: 'devolvido',
      comentario: motivo,
      executadoPorId: guid(contexto.usuarioId),
      executadoPorNome: contexto.nome,
      sistema: false,
      revisao: instancia.revisao
    });

    instancia.elementoAtualId = preenchimento.id;
    instancia.status = 'emAndamento';
    instancia.concluidoEm = undefined;
    if (instancia.percorridos.indexOf(preenchimento.id) < 0) {
      instancia.percorridos.push(preenchimento.id);
    }

    try {
      // Relê para pegar a versão atual (ETag) antes de gravar.
      await this.repositorio.obter(planilha.id);
      await this.repositorio.salvar(instancia);
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    const avisos: string[] = [];
    const aviso = await this.sincronizar(planilha, { instancia, definicao });
    if (aviso) {
      avisos.push(aviso);
    }

    const avisoEvento =
      await this.orcamento.registrarEvento(planilha, 'Devolvida para ajuste', motivo, contexto.nome);
    if (avisoEvento) {
      avisos.push(avisoEvento);
    }

    return { ok: true, erros: [], avisos };
  }

  // ----------------------------------------------------------
  // Situação da planilha a partir do fluxo
  // ----------------------------------------------------------

  public situacao(
    estado: IEstadoFluxoPlanilha
  ): StatusPlanilha {
    return situacaoDoFluxo(estado.instancia, estado.definicao);
  }

  // Grava na planilha a situação, a etapa atual e o prazo (usados nas
  // listas, filtros, consolidado e Power BI) e, na devolução, o motivo
  // e o prazo de ajuste. Devolve um aviso se não conseguir gravar.
  public async sincronizar(
    planilha: IPlanilhaOrcamento,
    estado: IEstadoFluxoPlanilha
  ): Promise<string> {

    const { instancia, definicao } = estado;
    const status = this.situacao(estado);
    const atual = obterElementoAtual(definicao, instancia);
    const tarefa = tarefaPendente(instancia);
    const ultimo = ultimoPassoHumano(instancia);

    const corpo: Record<string, unknown> = {
      [PLANILHA.status]: status,
      [PLANILHA.etapaAtual]: (instancia.status === 'concluido' ? 'Aprovada' : atual ? atual.nome : '').substring(0, 200),
      [PLANILHA.prazoEtapa]: tarefa && tarefa.prazo ? tarefa.prazo : null
    };

    if (status === STATUS_PLANILHA.devolvida && ultimo) {
      // Prazo de ajuste: PRAZO_AJUSTE_DIAS_UTEIS dias úteis após a
      // devolução (regra do orçamento); 0 = usar o prazo da etapa.
      const prazoAjuste =
        PRAZO_AJUSTE_DIAS_UTEIS > 0
          ? adicionarDiasUteis(new Date(ultimo.data), PRAZO_AJUSTE_DIAS_UTEIS).toISOString()
          : (tarefa && tarefa.prazo) || null;

      corpo[PLANILHA.motivoDevolucao] = (ultimo.comentario || `${ultimo.elementoNome}: ${ultimo.acaoRotulo}`).substring(0, 4000);
      corpo[PLANILHA.dataDevolucao] = ultimo.data;
      corpo[PLANILHA.devolvidoPor] = (ultimo.executadoPorNome || '').substring(0, 200);
      corpo[PLANILHA.prazoAjuste] = prazoAjuste;
      corpo[PLANILHA.prazoEtapa] = prazoAjuste;
    }

    // Saiu do preenchimento agora: registra a data de envio.
    if (
      status === STATUS_PLANILHA.emAprovacao &&
      ultimo &&
      planilha.status !== STATUS_PLANILHA.emAprovacao
    ) {
      corpo[PLANILHA.dataEnvio] = ultimo.data;
    }

    try {
      await this.dataverse.atualizarRegistro(TABELAS_ORCAMENTO.planilha, planilha.id, corpo);
      return '';
    } catch (erro) {
      return `O fluxo avançou, mas a situação da planilha não foi atualizada: ${mensagem(erro)}`;
    }
  }

  // ----------------------------------------------------------
  // Aprovações pendentes do usuário
  // ----------------------------------------------------------

  // Planilhas do ano (que o usuário consegue ler) com uma etapa
  // aguardando ele. Quem aprova precisa poder LER as planilhas das
  // áreas (perfil "Aprovadores" — ver criar-tabelas-orcamento.ps1).
  public async pendenciasDoUsuario(
    planilhas: IPlanilhaOrcamento[],
    contexto: IContextoAcesso
  ): Promise<IPendenciaAprovacao[]> {

    const disponibilidade = await this.verificar();

    if (!disponibilidade.ativo) {
      return [];
    }

    const vinculos = await this.vinculos();
    const resultado: IPendenciaAprovacao[] = [];

    // Só faz sentido olhar as que estão em avaliação.
    const candidatas =
      planilhas.filter(item => item.status === STATUS_PLANILHA.emAprovacao);

    for (const planilha of candidatas) {
      try {
        const estado = await this.carregar(planilha);
        const tarefa = estado ? tarefaPendente(estado.instancia) : undefined;
        if (!estado || !tarefa) {
          continue;
        }
        const resolvidos =
          tarefa.responsaveisResolvidos ||
          resolverResponsaveis(tarefa.responsaveis, this.dadosResponsaveis(planilha));
        if (resolvidos.some(item => usuarioAtende(item, contexto.usuarioId, vinculos))) {
          resultado.push({ planilha, estado, tarefa });
        }
      } catch {
        // Planilha ilegível para este usuário: ignora.
      }
    }

    return resultado;
  }
}
