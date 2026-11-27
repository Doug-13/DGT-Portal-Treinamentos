import {
  DataverseService
} from '../DataverseService';

import {
  NotificacaoFluxoService
} from '../notificacoes/NotificacaoFluxoService';

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
  IResponsavelResolvido
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
  FornecedoresService
} from './FornecedoresService';

import {
  ICicloHomologacao,
  IFornecedor,
  PROCESSO_HOMOLOGACAO,
  StatusFornecedor,
  TABELAS_FORN
} from './modeloFornecedores';

import {
  dadosConclusaoPeloFluxo,
  ETAPAS_FLUXO_HOMOLOGACAO,
  etapaFluxoDaColuna,
  etapaKanbanDoFluxo,
  resultadoPelaAcao,
  validarConclusao
} from './homologacao';

// ============================================================
// FORNECEDORES — HOMOLOGAÇÃO NO MOTOR DE FLUXOS (processo SUP-HOM)
//
// Mesmo padrão do Planejamento Orçamentário (OrcamentoFluxoService):
// o estado do fluxo fica no próprio ciclo
// (dgt_fornecedorhomologacao.dgt_fluxoestado, JSON), com controle de
// concorrência pela versão (ETag) do registro.
//
// A cada passo o ciclo recebe (sincronizar):
//   dgt_etapaatual        id da etapa do fluxo (gatilho do aviso, D2)
//   dgt_etapa             coluna do kanban, DERIVADA (etapaKanbanDoFluxo)
//   dgt_prazoetapa        prazo da etapa (dias úteis do motor)
//   dgt_responsaveisetapa responsáveis resolvidos (formato de dgt_responsaveisjson)
//   dgt_documentospendentes  lista para o e-mail ao fornecedor (etapa
//                            "Documentos pendentes")
//
// Ninguém move card à mão: a etapa só muda pelas ações do fluxo, com
// comentário e histórico. Quem decide o resultado é o Jurídico: as
// ações "aprovado", "aprovadoRessalvas" e "reprovado" concluem o ciclo
// com as regras de sempre (validarConclusao / statusPeloResultado).
//
// Avisos (fila padrão do portal, dgt_implemail — o portal não envia):
//   • internos de etapa: aba Notificações das atividades do SUP-HOM e
//     eventos com carta (motor do Douglas, docs/notificacoes-fluxo.md);
//     {registro} = razão social (protocolo) — ciclo N, nunca o CNPJ;
//   • criação TARDIA da instância (ciclo aberto pela ficha, no plugin,
//     ou anterior ao motor) e a migração para a etapa equivalente NÃO
//     notificam: usam o motor sem o despachante. O aviso de "nova
//     ficha" é o do plugin (fila, área Supply). "Abrir ciclo" pelo
//     botão notifica a 1ª etapa normalmente;
//   • ao fornecedor (etapa "Documentos pendentes"): Power Automate, pela
//     caixa monitorada (a resposta precisa cair no Fluxo 2).
//
// PILOTO: quem pode agir é conferido no navegador (como em Documentos
// e Ambientes) até o motor ir para a Custom API.
// ============================================================

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const normalizar = (valor?: string): string =>
  (valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

const gerarId = (prefixo: string): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

// Mesma regra de prazo das etapas do motor (só sábado e domingo).
const prazoEmDiasUteis = (dias: number): string | undefined => {
  if (!dias || dias <= 0) {
    return undefined;
  }
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

// {registro} das notificações e rótulo do ciclo: razão social e
// protocolo (nunca o CNPJ).
export const rotuloDoCiclo = (
  fornecedor: Pick<IFornecedor, 'razaoSocial' | 'protocolo'>,
  ciclo: Pick<ICicloHomologacao, 'numero' | 'protocolo'>
): string => {
  const protocolo = ciclo.protocolo || fornecedor.protocolo;
  return `${fornecedor.razaoSocial}${protocolo ? ` (${protocolo})` : ''} — ciclo ${ciclo.numero}`;
};

// Ciclo anterior ao motor parado numa coluna adiante: será migrado para
// a etapa equivalente (e não notifica).
const etapaFluxoDaColunaDiferente = (ciclo: ICicloHomologacao): boolean => {
  const destino = etapaFluxoDaColuna(ciclo.etapa);
  return !!destino && destino !== ETAPAS_FLUXO_HOMOLOGACAO.fichaRecebida;
};

// ------------------------------------------------------------
// Onde o estado do fluxo é gravado: no próprio ciclo.
// ------------------------------------------------------------

class HomologacaoFluxoRepositorio implements IFluxoRepositorio {

  public readonly local: boolean = false;

  private readonly dataverse: DataverseService;

  // Versão (ETag) do ciclo lida por último: impede que duas pessoas
  // avancem o fluxo ao mesmo tempo sobre o mesmo estado.
  private readonly etags: { [cicloId: string]: string } = {};

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async obter(cicloId: string): Promise<IFluxoInstancia | undefined> {
    const lido = await this.dataverse.obterRegistro(TABELAS_FORN.ciclo, cicloId, ['dgt_fluxoestado']);
    if (!lido) {
      return undefined;
    }
    this.etags[guid(cicloId)] = lido.etag;
    const json = lido.registro.dgt_fluxoestado;
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
    const novaEtag = await this.dataverse.atualizarRegistro(
      TABELAS_FORN.ciclo,
      id,
      { dgt_fluxoestado: JSON.stringify(instancia) },
      this.etags[id] || undefined);
    this.etags[id] = novaEtag || '';
    return [];
  }

  public async remover(cicloId: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_FORN.ciclo, cicloId, { dgt_fluxoestado: null });
  }

  public async renovarVersao(cicloId: string): Promise<void> {
    await this.obter(cicloId);
  }
}

// ------------------------------------------------------------
// Tipos usados pelas telas
// ------------------------------------------------------------

export interface IEstadoFluxoCiclo {
  instancia: IFluxoInstancia;
  definicao: IFluxoDefinicao;
}

export interface IDisponibilidadeHomologacao {
  ativo: boolean;
  // O que falta (mostrado na tela; sem fluxo, ninguém move o ciclo).
  motivo: string;
  processo?: IProcesso;
}

export interface IResultadoAcaoHomologacao {
  ok: boolean;
  erros: string[];
  avisos: string[];
  // Status do cadastro depois da conclusão pelo Jurídico.
  status?: StatusFornecedor;
}

export interface IPendenciaHomologacao {
  ciclo: ICicloHomologacao;
  // Sem instância ainda (ciclo aberto pela ficha): é iniciada ao abrir.
  iniciado: boolean;
}

export class HomologacaoFluxoService {

  private readonly dataverse: DataverseService;
  private readonly fornecedores: FornecedoresService;
  private readonly repositorio: HomologacaoFluxoRepositorio;
  private readonly fluxo: FluxoService;
  // Mesmo motor SEM o despachante: início tardio e migração não notificam.
  private readonly fluxoSemAviso: FluxoService;
  private disponibilidade: IDisponibilidadeHomologacao | undefined;
  private vinculosCache: IUsuarioAreaAdmin[] | undefined;
  private usuariosCache: Array<{ id: string; nome: string }> | undefined;

  public constructor(dataverse: DataverseService, fornecedores: FornecedoresService) {
    this.dataverse = dataverse;
    this.fornecedores = fornecedores;
    this.repositorio = new HomologacaoFluxoRepositorio(dataverse);
    const persistencia = obterPersistenciaFluxo(dataverse);
    this.fluxo = new FluxoService(
      this.repositorio,
      persistencia.catalogo,
      persistencia.metadados,
      // Notificações do fluxo (aba Notificações e evento com carta).
      new NotificacaoFluxoService(dataverse, 'fornecedores'));
    this.fluxoSemAviso = new FluxoService(this.repositorio, persistencia.catalogo, persistencia.metadados);
  }

  // ----------------------------------------------------------
  // Disponibilidade (colunas + processo SUP-HOM + fluxo publicado)
  // ----------------------------------------------------------

  public async verificar(forcar = false): Promise<IDisponibilidadeHomologacao> {

    if (this.disponibilidade && !forcar) {
      return this.disponibilidade;
    }

    const resultado: IDisponibilidadeHomologacao = { ativo: false, motivo: '' };

    try {
      if (!(await this.fornecedores.temColunasFluxoCiclo())) {
        resultado.motivo =
          'As colunas do fluxo de homologação ainda não existem no Dataverse: rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1.';
        this.disponibilidade = resultado;
        return resultado;
      }

      const persistencia = obterPersistenciaFluxo(this.dataverse);
      const dados = await persistencia.processos.carregar(forcar, []);
      const ativos = dados.processos.filter(item => item.ativo !== false);
      const processo =
        ativos.filter(item => normalizar(item.codigo) === normalizar(PROCESSO_HOMOLOGACAO.CODIGO))[0] ||
        ativos.filter(item => normalizar(item.nome).indexOf(PROCESSO_HOMOLOGACAO.NOME_CONTEM) >= 0)[0];

      if (!processo) {
        resultado.motivo =
          `Processo ${PROCESSO_HOMOLOGACAO.CODIGO} (Homologação de fornecedor) não encontrado em Processos → Fluxos. ` +
          'Importe docs/exemplos/pacote-homologacao-fornecedor.json e publique o fluxo.';
        this.disponibilidade = resultado;
        return resultado;
      }

      const publicada = await persistencia.catalogo.versaoPublicada(processo.id);
      if (!publicada) {
        resultado.motivo = `O processo ${processo.codigo || processo.nome} ainda não tem fluxo publicado (Processos → Fluxos → Publicar).`;
        this.disponibilidade = resultado;
        return resultado;
      }

      if (!publicada.elementos.some(item => item.tipo === 'tarefaHumana')) {
        resultado.motivo = `O fluxo publicado de ${processo.codigo || processo.nome} não tem nenhuma etapa com responsável.`;
        this.disponibilidade = resultado;
        return resultado;
      }

      resultado.ativo = true;
      resultado.processo = processo;
    } catch (erro) {
      resultado.motivo = `Não foi possível ler o processo de homologação: ${mensagem(erro)}`;
    }

    this.disponibilidade = resultado;
    return resultado;
  }

  // ----------------------------------------------------------
  // Pessoas
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
        this.usuariosCache = (await new AreaAdminService(this.dataverse).listarUsuarios())
          .map(item => ({ id: guid(item.id), nome: item.nome }));
      } catch {
        this.usuariosCache = [];
      }
    }
    return this.usuariosCache;
  }

  // Os responsáveis do SUP-HOM são áreas (Suprimentos e Jurídico): não
  // dependem de autor nem de área do registro.
  public dadosResponsaveis(instancia?: IFluxoInstancia): IDadosRevisaoResponsaveis {
    return { valores: instancia ? instancia.valores : undefined };
  }

  private async ator(definicao: IFluxoDefinicao, contexto: IContextoAcesso, instancia?: IFluxoInstancia): Promise<IFluxoAtor> {
    return {
      id: guid(contexto.usuarioId),
      nome: contexto.nome,
      papeisTeste: papeisDoUsuario(definicao, contexto, this.dadosResponsaveis(instancia), await this.vinculos())
    };
  }

  private contextoExecucao(fornecedor: IFornecedor, ciclo: ICicloHomologacao): IContextoExecucaoFluxo {
    return {
      resolverResponsaveis: (responsaveis, valores) =>
        resolverResponsaveis(responsaveis, { valores }, this.vinculosCache),
      // {registro} das notificações: razão social e protocolo, nunca o CNPJ.
      rotuloRevisao: rotuloDoCiclo(fornecedor, ciclo),
      // O SUP-HOM não tem tarefas de sistema: seguem adiante.
      executarAcoesSistema: async () => undefined
    };
  }

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  public async carregar(ciclo: ICicloHomologacao): Promise<IEstadoFluxoCiclo | undefined> {
    const instancia = await this.repositorio.obter(ciclo.id);
    if (!instancia) {
      return undefined;
    }
    const definicao = await this.fluxo.definicaoDaInstancia(instancia);
    return definicao ? { instancia, definicao } : undefined;
  }

  public async podeAgir(estado: IEstadoFluxoCiclo, contexto: IContextoAcesso): Promise<boolean> {
    if (estado.instancia.status !== 'emAndamento') {
      return false;
    }
    const elemento = obterElementoAtual(estado.definicao, estado.instancia);
    return atorPodeExecutar(elemento, await this.ator(estado.definicao, contexto, estado.instancia));
  }

  // ----------------------------------------------------------
  // Início (ciclo novo ou aberto pela ficha / antes desta versão)
  // ----------------------------------------------------------

  // Idempotente: ciclo que já tem instância não muda. Ciclo aberto
  // antes do motor numa coluna adiante (ex.: "Aguardando Jurídico")
  // começa na etapa equivalente do fluxo, com registro no histórico.
  // notificar = true só no "Abrir ciclo" pelo botão; o início tardio
  // (primeira abertura do card) e a migração não notificam.
  public async iniciar(
    fornecedor: IFornecedor,
    ciclo: ICicloHomologacao,
    contexto: IContextoAcesso,
    documentosPendentes: string[],
    opcoes: { notificar?: boolean } = {}
  ): Promise<IResultadoAcaoHomologacao> {

    if (ciclo.concluidoEm) {
      return { ok: false, erros: ['Ciclo concluído: o fluxo não é iniciado.'], avisos: [] };
    }

    const disponibilidade = await this.verificar();
    if (!disponibilidade.ativo || !disponibilidade.processo) {
      return { ok: false, erros: [disponibilidade.motivo], avisos: [] };
    }

    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const publicada = await persistencia.catalogo.versaoPublicada(disponibilidade.processo.id);
    if (!publicada) {
      return { ok: false, erros: ['O processo de homologação não tem fluxo publicado.'], avisos: [] };
    }

    await this.vinculos();

    let resultado;
    try {
      const motor = opcoes.notificar && !etapaFluxoDaColunaDiferente(ciclo) ? this.fluxo : this.fluxoSemAviso;
      resultado = await motor.iniciar(
        disponibilidade.processo,
        {
          revisaoId: ciclo.id,
          documentoId: fornecedor.id,
          revisao: `Ciclo ${ciclo.numero}`,
          ator: await this.ator(publicada, contexto),
          simulado: false
        },
        this.contextoExecucao(fornecedor, ciclo));
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    if (!resultado.ok || !resultado.instancia) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    let estado = await this.carregar(ciclo);

    // Ciclo anterior ao motor numa coluna adiante: posiciona na etapa equivalente.
    const destino = etapaFluxoDaColuna(ciclo.etapa);
    if (estado && destino && estado.instancia.elementoAtualId !== destino &&
        estado.instancia.historico.filter(h => !h.sistema && h.acaoChave !== 'iniciar').length === 0) {
      const aviso = await this.posicionar(estado, destino, ciclo, contexto);
      if (aviso) {
        avisos.push(aviso);
      }
      estado = await this.carregar(ciclo);
    }

    if (estado) {
      const aviso = await this.sincronizar(fornecedor, ciclo, estado, documentosPendentes);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    return { ok: true, erros: [], avisos };
  }

  // Leva a instância recém-iniciada para a etapa equivalente à coluna
  // antiga do kanban (mesmo padrão da devolução pelo administrador do
  // Orçamento: cancela a pendência e cria a da etapa escolhida).
  private async posicionar(
    estado: IEstadoFluxoCiclo,
    elementoId: string,
    ciclo: ICicloHomologacao,
    contexto: IContextoAcesso
  ): Promise<string> {
    const { instancia, definicao } = estado;
    const elemento = definicao.elementos.filter(e => e.id === elementoId && e.tipo === 'tarefaHumana')[0];
    if (!elemento) {
      return `O fluxo publicado não tem a etapa "${elementoId}": o ciclo começou na primeira etapa.`;
    }
    const agora = new Date().toISOString();
    instancia.tarefas.forEach(tarefa => {
      if (tarefa.status === 'pendente') {
        tarefa.status = 'cancelada';
        tarefa.concluidaEm = agora;
        tarefa.concluidaPorNome = 'Sistema';
      }
    });
    instancia.tarefas.push({
      id: gerarId('tarefa'),
      elementoId: elemento.id,
      elementoNome: elemento.nome,
      responsaveis: elemento.responsaveis,
      responsaveisResolvidos: resolverResponsaveis(elemento.responsaveis, this.dadosResponsaveis(instancia), await this.vinculos()),
      status: 'pendente',
      criadaEm: agora,
      prazo: prazoEmDiasUteis(elemento.prazoDiasUteis || 0)
    });
    instancia.historico.unshift({
      id: gerarId('hist'),
      data: agora,
      elementoId: elemento.id,
      elementoNome: elemento.nome,
      acaoChave: 'migracaoKanban',
      acaoRotulo: 'Ciclo anterior ao fluxo: começa na etapa equivalente',
      resultado: 'migrado',
      comentario: `Coluna do kanban antes do fluxo: "${ciclo.etapa}".`,
      executadoPorId: guid(contexto.usuarioId),
      executadoPorNome: contexto.nome,
      sistema: true,
      revisao: instancia.revisao
    });
    instancia.elementoAtualId = elemento.id;
    if (instancia.percorridos.indexOf(elemento.id) < 0) {
      instancia.percorridos.push(elemento.id);
    }
    try {
      await this.repositorio.obter(ciclo.id);
      await this.repositorio.salvar(instancia);
    } catch (erro) {
      return `Não foi possível posicionar o ciclo na etapa equivalente: ${mensagem(erro)}`;
    }
    return '';
  }

  // ----------------------------------------------------------
  // Ações da etapa (os botões do fluxo)
  // ----------------------------------------------------------

  public async executar(
    fornecedor: IFornecedor,
    ciclo: ICicloHomologacao,
    contexto: IContextoAcesso,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>,
    documentosPendentes: string[]
  ): Promise<IResultadoAcaoHomologacao> {

    const antes = await this.carregar(ciclo);
    if (!antes) {
      return { ok: false, erros: ['O fluxo deste ciclo ainda não foi iniciado.'], avisos: [] };
    }

    const elemento = obterElementoAtual(antes.definicao, antes.instancia);
    const acao = elemento ? elemento.acoes.filter(item => item.chave === acaoChave)[0] : undefined;
    const resultadoFinal = acao ? resultadoPelaAcao(acao.resultado) : '';

    // Decisão do Jurídico: confere ANTES de mexer no fluxo se o ciclo
    // pode ser concluído (risco, validade, ressalvas).
    if (resultadoFinal) {
      const dados = dadosConclusaoPeloFluxo(ciclo, fornecedor.bancarioConferido,
        { ...antes.instancia.valores, ...valores }, resultadoFinal, comentario);
      const problema = validarConclusao(dados);
      if (problema) {
        return { ok: false, erros: [problema], avisos: [] };
      }
    }

    await this.vinculos();

    let resultado;
    try {
      resultado = await this.fluxo.executar(
        ciclo.id,
        {
          acaoChave,
          comentario,
          valores,
          ator: await this.ator(antes.definicao, contexto, antes.instancia)
        },
        this.contextoExecucao(fornecedor, ciclo));
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    const depois = await this.carregar(ciclo);

    if (depois) {
      const aviso = await this.sincronizar(fornecedor, ciclo, depois, documentosPendentes);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    await this.fornecedores.registrarHistoricoFluxo(
      fornecedor.id,
      `Homologação: ${elemento ? elemento.nome : 'etapa'} → ${acao ? acao.rotulo : acaoChave}`,
      `Ciclo ${ciclo.numero}${comentario ? `\nComentário: ${comentario}` : ''}`,
      contexto.nome);

    let status: StatusFornecedor | undefined;
    if (depois && depois.instancia.status === 'concluido') {
      const conclusao = await this.gravarConclusao(fornecedor, ciclo, depois, contexto);
      status = conclusao.status;
      avisos.push(...conclusao.avisos);
    }

    return { ok: true, erros: [], avisos, status };
  }

  // Fluxo concluído pelo Jurídico → fecha o ciclo e grava o cadastro.
  // Também usado para tentar de novo, se a gravação falhou depois do
  // fluxo concluído (botão "Gravar a conclusão").
  public async gravarConclusao(
    fornecedor: IFornecedor,
    ciclo: ICicloHomologacao,
    estado: IEstadoFluxoCiclo,
    contexto: IContextoAcesso
  ): Promise<{ status?: StatusFornecedor; avisos: string[] }> {

    const { instancia } = estado;
    const decisao = instancia.historico.filter(h => !h.sistema && !!resultadoPelaAcao(h.resultado))[0];
    if (!decisao) {
      return { avisos: ['O fluxo foi concluído sem uma decisão do Jurídico (Aprovar, Aprovar com ressalvas ou Reprovar). Confira o desenho do processo.'] };
    }

    const doSuprimentos = instancia.historico.filter(h =>
      !h.sistema && h.elementoId === ETAPAS_FLUXO_HOMOLOGACAO.analiseSuprimentos)[0];

    const dados = dadosConclusaoPeloFluxo(ciclo, fornecedor.bancarioConferido, instancia.valores,
      resultadoPelaAcao(decisao.resultado), decisao.comentario || '');
    if (doSuprimentos) {
      dados.responsavelSuprimentos = `${doSuprimentos.executadoPorNome} — ${dataBr(doSuprimentos.data)}`;
    }
    dados.responsavelCompliance = `${decisao.executadoPorNome} — ${dataBr(decisao.data)}`;

    try {
      const status = await this.fornecedores.concluirCiclo(ciclo, fornecedor, dados,
        `${decisao.acaoRotulo} (fluxo ${PROCESSO_HOMOLOGACAO.CODIGO})${decisao.comentario ? `: ${decisao.comentario}` : ''}`,
        contexto.nome);
      return { status, avisos: [] };
    } catch (erro) {
      return { avisos: [`O fluxo foi concluído, mas o ciclo não foi gravado: ${mensagem(erro)}. Use "Gravar a conclusão" no card.`] };
    }
  }

  // ----------------------------------------------------------
  // Ciclo ← fluxo
  // ----------------------------------------------------------

  // Grava no ciclo a etapa (id e coluna do kanban), o prazo e os
  // responsáveis. dgt_etapaatual só vai no corpo quando MUDA: é o gatilho
  // do e-mail ao fornecedor (Power Automate, etapa "Documentos pendentes").
  public async sincronizar(
    _fornecedor: IFornecedor,
    ciclo: ICicloHomologacao,
    estado: IEstadoFluxoCiclo,
    documentosPendentes: string[]
  ): Promise<string> {

    const { instancia, definicao } = estado;
    const concluido = instancia.status === 'concluido';
    const atual = obterElementoAtual(definicao, instancia);
    const tarefa = tarefaPendente(instancia);
    const etapaId = instancia.elementoAtualId;
    const resolvidos: IResponsavelResolvido[] = !concluido && tarefa ? (tarefa.responsaveisResolvidos || []) : [];

    const corpo: Record<string, unknown> = {
      dgt_prazoetapa: !concluido && tarefa && tarefa.prazo ? tarefa.prazo : null,
      dgt_responsaveisetapa: JSON.stringify(resolvidos).substring(0, 100000)
    };

    if (!concluido) {
      // No concluído, quem grava a coluna e as datas é a conclusão.
      corpo.dgt_etapa = etapaKanbanDoFluxo(etapaId, atual ? atual.nome : '', false);
    }

    if (etapaId !== ciclo.etapaAtual) {
      corpo.dgt_etapaatual = etapaId.substring(0, 100);
      if (!concluido) {
        corpo.dgt_etapadesde = new Date().toISOString();
      }
      if (etapaId === ETAPAS_FLUXO_HOMOLOGACAO.documentosPendentes) {
        corpo.dgt_documentospendentes = documentosPendentes.join('\n').substring(0, 4000);
      }
    }

    try {
      await this.dataverse.atualizarRegistro(TABELAS_FORN.ciclo, ciclo.id, corpo);
    } catch (erro) {
      return `O fluxo avançou, mas o ciclo não foi atualizado: ${mensagem(erro)}`;
    }
    return '';
  }

  // ----------------------------------------------------------
  // Pendências ("Aguardando você")
  // ----------------------------------------------------------

  // Ciclos abertos em que o usuário atende a etapa atual. Usa os
  // responsáveis gravados no ciclo (dgt_responsaveisetapa, também
  // preenchidos pelo plugin quando a ficha abre o ciclo) e confere com
  // os vínculos atuais. Ciclo antigo sem responsáveis: aparece para o
  // administrador do módulo, para iniciar o fluxo.
  public async pendenciasDoUsuario(
    ciclos: ICicloHomologacao[],
    contexto: IContextoAcesso,
    administra: boolean
  ): Promise<IPendenciaHomologacao[]> {

    const vinculos = await this.vinculos();
    const resultado: IPendenciaHomologacao[] = [];

    ciclos.filter(c => !c.concluidoEm).forEach(ciclo => {
      let resolvidos: IResponsavelResolvido[] = [];
      try {
        resolvidos = ciclo.responsaveisEtapa ? (JSON.parse(ciclo.responsaveisEtapa) as IResponsavelResolvido[]) : [];
      } catch {
        resolvidos = [];
      }
      if (resolvidos.length === 0) {
        if (!ciclo.fluxoIniciado && administra) {
          resultado.push({ ciclo, iniciado: false });
        }
        return;
      }
      if (resolvidos.some(item => usuarioAtende(item, contexto.usuarioId, vinculos))) {
        resultado.push({ ciclo, iniciado: ciclo.fluxoIniciado });
      }
    });

    return resultado.sort((a, b) => (a.ciclo.etapaDesde < b.ciclo.etapaDesde ? -1 : 1));
  }
}
