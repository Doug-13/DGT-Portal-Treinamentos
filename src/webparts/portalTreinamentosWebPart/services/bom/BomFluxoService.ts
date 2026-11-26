import {
  DataverseService
} from '../DataverseService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../AreaAdminService';

import {
  IFluxoAcao,
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoElemento,
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
  IFluxoCatalogo
} from '../fluxo/FluxoCatalogoLocal';

import {
  IMetadadosRepositorio
} from '../processos/MetadadosProcessoService';

import {
  IProcessosRepositorio
} from '../processos/ProcessoService';

import {
  obterPersistenciaFluxo
} from '../fluxo/persistenciaFluxo';

import {
  NotificacaoFluxoService
} from '../notificacoes/NotificacaoFluxoService';

import {
  IPassoImportacao,
  PacoteProcessoService
} from '../pacoteProcesso/PacoteProcessoService';

import {
  interpretarPacote
} from '../pacoteProcesso/pacoteProcesso';

import {
  PACOTE_FLUXO_BOM
} from './pacoteFluxoBom';

import {
  adicionarDiasUteis,
  atorPodeExecutar,
  obterElementoAtual,
  validarAcao
} from '../fluxo/FluxoEngine';

import {
  IDadosRevisaoResponsaveis,
  papeisDoUsuario,
  resolverResponsaveis,
  usuarioAtende
} from '../fluxo/ResolvedorResponsaveis';

import {
  BomService,
  EtapaBom,
  IBomRegistro
} from './BomService';

import {
  BOM,
  TABELAS_BOM
} from './esquemaBom';

import {
  PROCESSO_BOM,
  PapelEtapaBom,
  atividadesSemDecisao,
  elementoDoPapel,
  etapaBomCompativel,
  etapaBomDaInstancia,
  papelDoElemento,
  tarefaPendenteBom
} from './fluxoBom';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — FLUXO DO B.O.M. (processo ARQ-SOL)
//
// Mesmo motor de Documentos, Treinamentos e Orçamento: etapas,
// responsáveis, prazos (dias úteis), ações, validações e histórico
// vêm do fluxo PUBLICADO do processo (Processos → editor do fluxo).
//
// O estado do fluxo de cada B.O.M. fica no próprio registro
// (dgt_bom_bom.dgt_bom_fluxoestado), gravado com controle de versão
// (ETag): duas pessoas agindo ao mesmo tempo → a segunda recebe
// "Outra pessoa alterou este registro" e nada é gravado em dobro.
//
// O B.O.M. "congela" a versão do fluxo com que começou (igual às
// revisões de documento).
// ============================================================

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const normalizar = (valor?: string): string =>
  (valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

const gerarId = (prefixo: string): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Coluna ainda não criada no Dataverse (script não executado).
const faltaColunaFluxo = (erro: unknown): boolean =>
  /dgt_bom_fluxoestado/i.test(mensagem(erro));

// ------------------------------------------------------------
// Onde o estado do fluxo é gravado: no próprio B.O.M.
// ------------------------------------------------------------

export class BomFluxoRepositorio implements IFluxoRepositorio {

  public readonly local: boolean = false;

  private readonly dataverse: DataverseService;

  // Versão (ETag) do B.O.M. lida por último.
  private readonly etags: { [bomId: string]: string } = {};

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async obter(bomId: string): Promise<IFluxoInstancia | undefined> {

    const lido = await this.dataverse.obterRegistro(TABELAS_BOM.bom, guid(bomId), [BOM.fluxoEstado]);

    if (!lido) {
      return undefined;
    }

    this.etags[guid(bomId)] = lido.etag;

    const json = lido.registro[BOM.fluxoEstado];

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
        TABELAS_BOM.bom,
        id,
        { [BOM.fluxoEstado]: JSON.stringify(instancia) },
        this.etags[id] || undefined
      );
    this.etags[id] = novaEtag || '';
    return [];
  }

  public async remover(bomId: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_BOM.bom, guid(bomId), { [BOM.fluxoEstado]: null });
  }

  public async renovarVersao(bomId: string): Promise<void> {
    await this.obter(bomId);
  }
}

// ------------------------------------------------------------
// Tipos usados pela tela
// ------------------------------------------------------------

export interface IEstadoFluxoBom {
  instancia: IFluxoInstancia;
  definicao: IFluxoDefinicao;
}

export interface IDisponibilidadeFluxoBom {
  ativo: boolean;
  // Por que o fluxo não está ativo (mostrado ao Administrador).
  motivo: string;
  processo?: IProcesso;
  // O que falta (tela de configuração do Administrador).
  colunaCriada: boolean;
  processoEncontrado: boolean;
  fluxoPublicado: boolean;
  temRascunho: boolean;
  // Versão publicada do fluxo (para atualizar os B.O.M. em andamento).
  versaoPublicada?: number;
  // A versão publicada tem atividade com mais de uma saída sem uma
  // decisão (gateway) para distribuí-las (modelo antigo).
  fluxoSemDecisoes: boolean;
}

export interface IResultadoFluxoBom {
  ok: boolean;
  erros: string[];
  avisos: string[];
  estado?: IEstadoFluxoBom;
}

export interface IExecucaoFluxoBom {
  bom: IBomRegistro;
  contexto: IContextoAcesso;
  // Ação escolhida (painel do fluxo). Sem ela: a ação PRINCIPAL da
  // etapa (botão de conclusão da tela do módulo).
  acaoChave?: string;
  // A tela só conclui a etapa que é dela (ex.: "Concluir seleção de
  // kit" só vale com o B.O.M. na Seleção de kit).
  papelEsperado?: PapelEtapaBom;
  comentario: string;
  // Valores dos campos, lidos dos dados do módulo.
  valores: () => Record<string, string> | Promise<Record<string, string>>;
  // Os valores dependem do que o preparo grava (ex.: a análise Go/No-Go
  // registrada agora)? Então só são validados depois do preparo.
  valoresDependemDoPreparo?: boolean;
  // Grava os dados da tela antes de avançar o fluxo.
  preparar?: () => Promise<void>;
  // Desfaz o preparo se o fluxo recusar a ação.
  desfazer?: () => Promise<void>;
}

export interface IDependenciasFluxoBom {
  catalogo: IFluxoCatalogo;
  metadados: IMetadadosRepositorio;
  processos: IProcessosRepositorio;
}

export class BomFluxoService {

  private readonly dataverse: DataverseService;

  private readonly bom: BomService;

  private readonly repositorio: BomFluxoRepositorio;

  private readonly dependencias: IDependenciasFluxoBom;

  private readonly fluxo: FluxoService;

  private disponibilidade: IDisponibilidadeFluxoBom | undefined;

  private areaId = '';

  private vinculosLista: IUsuarioAreaAdmin[] = [];

  // B.O.M. com uma ação em andamento nesta tela (clique duplo).
  private readonly emExecucao: { [bomId: string]: boolean } = {};

  public constructor(
    dataverse: DataverseService,
    bom: BomService,
    dependencias?: IDependenciasFluxoBom
  ) {
    this.dataverse = dataverse;
    this.bom = bom;
    this.repositorio = new BomFluxoRepositorio(dataverse);

    if (dependencias) {
      this.dependencias = dependencias;
    } else {
      const persistencia = obterPersistenciaFluxo(dataverse);
      this.dependencias = {
        catalogo: persistencia.catalogo,
        metadados: persistencia.metadados,
        processos: persistencia.processos
      };
    }

    this.fluxo =
      new FluxoService(
        this.repositorio,
        this.dependencias.catalogo,
        this.dependencias.metadados,
        new NotificacaoFluxoService(dataverse, 'arquitetura')
      );
  }

  // Área ARQ (responsável "Gestor da área") e vínculos usuário × área.
  public definirContexto(areaId: string, vinculos: IUsuarioAreaAdmin[]): void {
    this.areaId = guid(areaId);
    this.vinculosLista = vinculos;
  }

  public get vinculos(): IUsuarioAreaAdmin[] {
    return this.vinculosLista;
  }

  // ----------------------------------------------------------
  // Disponibilidade (coluna + processo + fluxo publicado)
  // ----------------------------------------------------------

  public async verificar(forcar = false): Promise<IDisponibilidadeFluxoBom> {

    if (this.disponibilidade && !forcar) {
      return this.disponibilidade;
    }

    const resultado: IDisponibilidadeFluxoBom = {
      ativo: false,
      motivo: '',
      colunaCriada: false,
      processoEncontrado: false,
      fluxoPublicado: false,
      temRascunho: false,
      fluxoSemDecisoes: false
    };
    const motivos: string[] = [];

    try {
      // 1. Coluna do estado do fluxo no B.O.M.
      try {
        await this.dataverse.listarRegistros(TABELAS_BOM.bom, `$select=${BOM.id},${BOM.fluxoEstado}&$top=1`);
        resultado.colunaCriada = true;
      } catch (erro) {
        motivos.push(faltaColunaFluxo(erro)
          ? 'A coluna do fluxo (dgt_bom_fluxoestado) ainda não existe: execute scripts/dataverse/criar-fluxo-bom.ps1.'
          : `Não foi possível ler o estado do fluxo: ${mensagem(erro)}`);
      }

      // 2. Processo e fluxo publicado
      const dados = await this.dependencias.processos.carregar(forcar, []);
      const ativos = dados.processos.filter(item => item.ativo !== false);

      const processo =
        PROCESSO_BOM.CODIGOS
          .map(codigo => ativos.find(item => normalizar(item.codigo) === normalizar(codigo)))
          .find(item => !!item) ||
        ativos.find(item => normalizar(item.nome).indexOf(PROCESSO_BOM.NOME_CONTEM) >= 0);

      if (!processo) {
        motivos.push(`O processo ${PROCESSO_BOM.CODIGOS[0]} ainda não existe em Processos. Use "Criar o fluxo em Processos".`);
      } else {
        resultado.processoEncontrado = true;
        resultado.processo = processo;

        const versoes = this.dependencias.catalogo.listarVersoes
          ? await this.dependencias.catalogo.listarVersoes(processo.id).catch(() => [] as IFluxoDefinicao[])
          : [];
        resultado.temRascunho = versoes.some(item => item.status === 'rascunho');

        const publicada = await this.dependencias.catalogo.versaoPublicada(processo.id);

        if (!publicada) {
          motivos.push(resultado.temRascunho
            ? `O processo ${processo.codigo || processo.nome} tem o fluxo em rascunho: abra-o em Processos → Fluxos e publique.`
            : `O processo ${processo.codigo || processo.nome} ainda não tem fluxo. Use "Criar o fluxo em Processos".`);
        } else if (!elementoDoPapel(publicada, 'demanda')) {
          motivos.push(`O fluxo publicado de ${processo.codigo || processo.nome} não tem a atividade "Dados da demanda".`);
        } else {
          resultado.fluxoPublicado = true;
          resultado.versaoPublicada = publicada.versao;
          resultado.fluxoSemDecisoes = atividadesSemDecisao(publicada).length > 0;
        }
      }
    } catch (erro) {
      motivos.push(`Não foi possível ler o processo do B.O.M.: ${mensagem(erro)}`);
    }

    resultado.ativo = resultado.colunaCriada && resultado.processoEncontrado && resultado.fluxoPublicado;
    resultado.motivo = resultado.ativo ? '' : `${motivos.join(' ')} Enquanto isso, o módulo segue sem o fluxo de aprovação.`;

    this.disponibilidade = resultado;
    return resultado;
  }

  // ----------------------------------------------------------
  // Criar o processo ARQ-SOL e o fluxo em Processos
  //
  // Usa o MESMO importador de Processos → Importar JSON, com o pacote
  // padrão (pacoteFluxoBom.ts). Processo com o mesmo código já
  // existente é reaproveitado; campos existentes são mantidos; nada é
  // apagado; não cria ambiente. Depois disso o fluxo aparece em
  // Processos → Fluxos e é alterado pelo editor.
  // ----------------------------------------------------------

  public async criarFluxoEmProcessos(
    publicar: boolean,
    // Atualizar o modelo de um processo que já tem fluxo: um rascunho
    // existente é substituído (as versões publicadas ficam no histórico).
    substituirRascunho = false
  ): Promise<{ ok: boolean; passos: IPassoImportacao[] }> {

    const importador = new PacoteProcessoService(this.dataverse);
    const referencias = await importador.referencias();
    const passos: IPassoImportacao[] = [];

    let interpretado = interpretarPacote(PACOTE_FLUXO_BOM, referencias);

    // Área ARQ com outra sigla: cria o processo sem área (a área pode
    // ser escolhida depois em Processos).
    if (interpretado.erros.length > 0 && interpretado.erros.every(item => /área|area/i.test(item))) {
      const semArea = JSON.parse(JSON.stringify(PACOTE_FLUXO_BOM)) as typeof PACOTE_FLUXO_BOM;
      delete (semArea.processo as { area?: string }).area;
      interpretado = interpretarPacote(semArea, referencias);
      passos.push({ ok: true, texto: 'Área de sigla ARQ não encontrada: o processo foi criado sem área (ajuste em Processos, se quiser).' });
    }

    if (interpretado.erros.length > 0 || !interpretado.pacote) {
      return { ok: false, passos: passos.concat(interpretado.erros.map(texto => ({ ok: false, texto }))) };
    }

    const resultado =
      await importador.importar(interpretado.pacote, {
        publicar,
        criarAmbiente: false,
        substituirRascunho,
        atualizarMetadados: false
      });

    this.disponibilidade = undefined;

    return { ok: resultado.ok, passos: passos.concat(resultado.passos) };
  }

  // Estado do fluxo de todos os B.O.M. (lista, filtros e prazos).
  public async lerEstados(): Promise<{ [bomId: string]: IFluxoInstancia }> {
    const mapa: { [bomId: string]: IFluxoInstancia } = {};
    try {
      const registros =
        await this.dataverse.listarRegistros(
          TABELAS_BOM.bom,
          `$select=${BOM.id},${BOM.fluxoEstado}&$filter=${BOM.ativo} eq true and ${BOM.fluxoEstado} ne null`
        );
      registros.forEach(registro => {
        try {
          mapa[guid(registro[BOM.id])] = JSON.parse(String(registro[BOM.fluxoEstado])) as IFluxoInstancia;
        } catch {
          // Estado ilegível: o B.O.M. aparece sem fluxo.
        }
      });
    } catch {
      // Sem coluna/permissão: lista sem dados do fluxo.
    }
    return mapa;
  }

  // ----------------------------------------------------------
  // Responsáveis
  // ----------------------------------------------------------

  // "Autor da revisão" = responsável pelo B.O.M. (escolhido ao criar);
  // "Gestor da área" = gestores da área ARQ; "Usuário do campo" =
  // valores atuais do módulo (ex.: Responsável principal).
  public dadosResponsaveis(bom: IBomRegistro, valores?: Record<string, string>): IDadosRevisaoResponsaveis {
    return {
      revisaoResponsavelId: bom.responsavelId,
      documentoAreaId: this.areaId || undefined,
      valores
    };
  }

  public ator(
    definicao: IFluxoDefinicao,
    bom: IBomRegistro,
    contexto: IContextoAcesso,
    valores?: Record<string, string>
  ): IFluxoAtor {
    return {
      id: guid(contexto.usuarioId),
      nome: contexto.nome,
      papeisTeste: papeisDoUsuario(definicao, contexto, this.dadosResponsaveis(bom, valores), this.vinculosLista)
    };
  }

  private contextoExecucao(bom: IBomRegistro, valoresModulo?: Record<string, string>): IContextoExecucaoFluxo {
    return {
      resolverResponsaveis: (responsaveis, valores) =>
        resolverResponsaveis(responsaveis, this.dadosResponsaveis(bom, { ...(valores || {}), ...(valoresModulo || {}) }), this.vinculosLista),
      rotuloRevisao: `B.O.M. ${bom.numero} ${bom.revisao}`,
      // O fluxo do B.O.M. não publica documentos.
      executarAcoesSistema: async () => undefined
    };
  }

  // Valores para conferir responsáveis: os do fluxo + os atuais do módulo.
  private valoresConsolidados(instancia: IFluxoInstancia, valoresModulo?: Record<string, string>): Record<string, string> {
    return { ...instancia.valores, ...(valoresModulo || {}) };
  }

  public podeAgir(
    estado: IEstadoFluxoBom,
    bom: IBomRegistro,
    contexto: IContextoAcesso | undefined,
    valoresModulo?: Record<string, string>
  ): boolean {
    if (!contexto || estado.instancia.status !== 'emAndamento') {
      return false;
    }
    const elemento = obterElementoAtual(estado.definicao, estado.instancia);
    return atorPodeExecutar(elemento, this.ator(estado.definicao, bom, contexto, this.valoresConsolidados(estado.instancia, valoresModulo)));
  }

  // A etapa atual aguarda este usuário? (lista "Aguardando você").
  // Usa as pessoas gravadas na pendência quando ela foi criada.
  public aguardaUsuario(instancia: IFluxoInstancia, usuarioId?: string): boolean {
    const tarefa = tarefaPendenteBom(instancia);
    if (!tarefa || !usuarioId || instancia.status !== 'emAndamento') {
      return false;
    }
    return (tarefa.responsaveisResolvidos || []).some(item => usuarioAtende(item, usuarioId, this.vinculosLista));
  }

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  public async carregar(bomId: string): Promise<IEstadoFluxoBom | undefined> {
    const instancia = await this.repositorio.obter(bomId);
    if (!instancia) {
      return undefined;
    }
    const definicao = await this.fluxo.definicaoDaInstancia(instancia);
    return definicao ? { instancia, definicao } : undefined;
  }

  // ----------------------------------------------------------
  // Início (idempotente)
  //
  // B.O.M. criado antes do fluxo: o fluxo começa na etapa em que o
  // B.O.M. já está (registrado no histórico), para não refazer etapas.
  // ----------------------------------------------------------

  public async iniciar(
    bom: IBomRegistro,
    contexto: IContextoAcesso,
    valoresModulo: Record<string, string>,
    papelInicial: PapelEtapaBom = 'demanda'
  ): Promise<IResultadoFluxoBom> {

    const disponibilidade = await this.verificar();

    if (!disponibilidade.ativo || !disponibilidade.processo) {
      return { ok: false, erros: [disponibilidade.motivo], avisos: [] };
    }

    const publicada = await this.dependencias.catalogo.versaoPublicada(disponibilidade.processo.id);

    if (!publicada) {
      return { ok: false, erros: ['O processo não tem fluxo publicado.'], avisos: [] };
    }

    let resultado;

    try {
      resultado =
        await this.fluxo.iniciar(
          disponibilidade.processo,
          {
            revisaoId: bom.id,
            documentoId: bom.demandaId || bom.id,
            revisao: bom.revisao,
            ator: this.ator(publicada, bom, contexto, valoresModulo),
            simulado: false,
            valoresIniciais: valoresModulo
          },
          this.contextoExecucao(bom, valoresModulo)
        );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)], avisos: [] };
    }

    if (!resultado.ok || !resultado.instancia) {
      return { ok: false, erros: resultado.erros, avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    let estado = await this.carregar(bom.id);

    if (estado && papelInicial !== 'demanda' && estado.instancia.historico.length <= 1) {
      const destino = elementoDoPapel(estado.definicao, papelInicial);
      const atual = obterElementoAtual(estado.definicao, estado.instancia);
      if (destino && atual && destino.id !== atual.id) {
        try {
          await this.posicionar(estado, destino, bom, contexto, valoresModulo,
            `B.O.M. criado antes do fluxo de aprovação: o fluxo começa na etapa em que ele já estava (${destino.nome}).`);
          estado = await this.carregar(bom.id);
        } catch (erro) {
          avisos.push(`O fluxo começou em "${atual.nome}": não foi possível levá-lo para "${destino.nome}" (${mensagem(erro)}).`);
        }
      }
    }

    if (estado) {
      const aviso = await this.sincronizar(bom, estado);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    return { ok: true, erros: [], avisos, estado };
  }

  // Leva a instância para uma etapa (início de B.O.M. antigo). O passo
  // fica no histórico; a pendência anterior é cancelada, nunca apagada.
  private async posicionar(
    estado: IEstadoFluxoBom,
    destino: IFluxoElemento,
    bom: IBomRegistro,
    contexto: IContextoAcesso,
    valoresModulo: Record<string, string>,
    motivo: string
  ): Promise<void> {

    const { instancia, definicao } = estado;
    const atual = obterElementoAtual(definicao, instancia);
    const agora = new Date().toISOString();

    instancia.tarefas.forEach(tarefa => {
      if (tarefa.status === 'pendente') {
        tarefa.status = 'cancelada';
        tarefa.concluidaEm = agora;
        tarefa.concluidaPorNome = 'Sistema';
      }
    });

    const nova: IFluxoTarefa = {
      id: gerarId('tarefa'),
      elementoId: destino.id,
      elementoNome: destino.nome,
      responsaveis: destino.responsaveis.slice(),
      responsaveisResolvidos: resolverResponsaveis(destino.responsaveis, this.dadosResponsaveis(bom, this.valoresConsolidados(instancia, valoresModulo)), this.vinculosLista),
      status: 'pendente',
      criadaEm: agora,
      prazo: destino.prazoDiasUteis ? adicionarDiasUteis(agora, destino.prazoDiasUteis) : undefined
    };

    instancia.tarefas.push(nova);

    instancia.historico.unshift({
      id: gerarId('hist'),
      data: agora,
      elementoId: atual ? atual.id : instancia.elementoAtualId,
      elementoNome: atual ? atual.nome : '',
      acaoChave: 'inicioEtapaExistente',
      acaoRotulo: `Fluxo posicionado em "${destino.nome}"`,
      resultado: 'posicionado',
      comentario: motivo,
      executadoPorId: guid(contexto.usuarioId),
      executadoPorNome: contexto.nome,
      sistema: true,
      revisao: instancia.revisao
    });

    // Etapas anteriores contam como percorridas (desenho e limpeza de
    // valores do motor).
    const ordem = ['demanda', 'goNoGo', 'restricao', 'kit', 'hh', 'bomPronto', 'aprovacao'];
    const limite = ordem.indexOf(papelDoElemento(destino));
    definicao.elementos
      .filter(item => {
        const posicao = ordem.indexOf(papelDoElemento(item));
        return posicao >= 0 && posicao <= limite && (papelDoElemento(item) !== 'restricao' || papelDoElemento(destino) === 'restricao');
      })
      .forEach(item => {
        if (instancia.percorridos.indexOf(item.id) < 0) {
          instancia.percorridos.push(item.id);
        }
      });
    if (instancia.percorridos.indexOf(destino.id) < 0) {
      instancia.percorridos.push(destino.id);
    }

    instancia.elementoAtualId = destino.id;
    instancia.valores = { ...instancia.valores, ...valoresModulo };

    await this.repositorio.obter(bom.id);
    await this.repositorio.salvar(instancia);
  }

  // ----------------------------------------------------------
  // Atualização de versão
  //
  // Publicada uma versão nova do fluxo, o B.O.M. em andamento passa
  // para ela NA MESMA ETAPA (mapeada pelo id ou pelo nome), mantendo o
  // prazo, os valores e o histórico — como nos ambientes. Assim o
  // processo sempre segue o fluxo publicado.
  // ----------------------------------------------------------

  public async atualizarVersao(
    bom: IBomRegistro,
    contexto: IContextoAcesso,
    valoresModulo?: Record<string, string>
  ): Promise<{ atualizado: boolean; mensagem: string }> {

    const instancia = await this.repositorio.obter(bom.id);

    if (!instancia || instancia.status !== 'emAndamento' || !instancia.processoId) {
      return { atualizado: false, mensagem: '' };
    }

    const publicada = await this.fluxo.definicaoPublicada(instancia.processoId);

    if (!publicada || publicada.id !== instancia.fluxoId || publicada.versao <= instancia.fluxoVersao) {
      return { atualizado: false, mensagem: '' };
    }

    try {
      const resultado =
        await this.fluxo.transferirParaProcesso(
          bom.id,
          publicada,
          {
            tipo: 'versao',
            processoId: instancia.processoId,
            processoNome: instancia.processoNome || '',
            ator: { id: guid(contexto.usuarioId), nome: contexto.nome || 'Sistema', papeisTeste: [] },
            justificativa: `Atualização automática: o fluxo do processo foi publicado na versão ${publicada.versao}.`,
            manterPrazoEtapa: true
          },
          true,
          this.contextoExecucao(bom, valoresModulo)
        );

      if (!resultado.ok) {
        return { atualizado: false, mensagem: `O B.O.M. continua na versão ${instancia.fluxoVersao} do fluxo: ${resultado.erros.join(' ')}` };
      }
    } catch (erro) {
      return { atualizado: false, mensagem: `O B.O.M. continua na versão ${instancia.fluxoVersao} do fluxo: ${mensagem(erro)}` };
    }

    const estado = await this.carregar(bom.id);
    if (estado) {
      await this.sincronizar(bom, estado);
    }

    return { atualizado: true, mensagem: `Fluxo do B.O.M. atualizado para a versão ${publicada.versao}.` };
  }

  // ----------------------------------------------------------
  // Ação da etapa atual
  // ----------------------------------------------------------

  public async executar(execucao: IExecucaoFluxoBom): Promise<IResultadoFluxoBom> {

    const chave = guid(execucao.bom.id);

    if (this.emExecucao[chave]) {
      return { ok: false, erros: ['Uma ação deste B.O.M. já está em andamento. Aguarde.'], avisos: [] };
    }

    this.emExecucao[chave] = true;

    try {
      return await this.executarInterno(execucao);
    } finally {
      delete this.emExecucao[chave];
    }
  }

  private async executarInterno(execucao: IExecucaoFluxoBom): Promise<IResultadoFluxoBom> {

    const { bom, contexto } = execucao;

    // Versão nova publicada: o B.O.M. passa para ela antes de agir.
    await this.atualizarVersao(bom, contexto);

    // Sempre relê: valida contra o estado atual (outra pessoa pode ter
    // agido depois que a tela foi aberta).
    const antes = await this.carregar(bom.id);

    if (!antes) {
      return { ok: false, erros: ['O fluxo deste B.O.M. ainda não foi iniciado.'], avisos: [] };
    }

    if (antes.instancia.status !== 'emAndamento') {
      return { ok: false, erros: ['O fluxo deste B.O.M. já foi concluído.'], avisos: [] };
    }

    const elemento = obterElementoAtual(antes.definicao, antes.instancia);

    if (!elemento || elemento.tipo !== 'tarefaHumana') {
      return { ok: false, erros: ['A etapa atual não aceita ações.'], avisos: [] };
    }

    if (execucao.papelEsperado && papelDoElemento(elemento) !== execucao.papelEsperado) {
      return { ok: false, erros: [`O B.O.M. está na etapa "${elemento.nome}". Recarregue a página.`], avisos: [] };
    }

    const acao: IFluxoAcao | undefined =
      execucao.acaoChave
        ? elemento.acoes.find(item => item.chave === execucao.acaoChave)
        : elemento.acoes.find(item => item.principal) || elemento.acoes[0];

    if (!acao) {
      return { ok: false, erros: [`Ação não disponível na etapa "${elemento.nome}".`], avisos: [] };
    }

    let valores = await execucao.valores();

    if (!this.podeAgir(antes, bom, contexto, valores)) {
      return { ok: false, erros: [`${contexto.nome} não é responsável pela etapa "${elemento.nome}".`], avisos: [] };
    }

    const validar = (lista: Record<string, string>): string[] =>
      validarAcao(elemento, acao, execucao.comentario, { ...antes.instancia.valores, ...lista });

    if (!execucao.valoresDependemDoPreparo) {
      const erros = validar(valores);
      if (erros.length > 0) {
        return { ok: false, erros, avisos: [] };
      }
    }

    const desfazer = async (): Promise<string[]> => {
      if (!execucao.desfazer) {
        return [];
      }
      try {
        await execucao.desfazer();
        return [];
      } catch (erro) {
        return [`Não foi possível desfazer a gravação dos dados da tela: ${mensagem(erro)}`];
      }
    };

    if (execucao.preparar) {
      try {
        await execucao.preparar();
      } catch (erro) {
        return { ok: false, erros: [mensagem(erro)], avisos: [] };
      }
    }

    if (execucao.valoresDependemDoPreparo) {
      valores = await execucao.valores();
      const erros = validar(valores);
      if (erros.length > 0) {
        return { ok: false, erros: erros.concat(await desfazer()), avisos: [] };
      }
    }

    let resultado;

    try {
      resultado =
        await this.fluxo.executar(
          bom.id,
          {
            acaoChave: acao.chave,
            comentario: execucao.comentario,
            valores,
            ator: this.ator(antes.definicao, bom, contexto, this.valoresConsolidados(antes.instancia, valores))
          },
          this.contextoExecucao(bom, valores)
        );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)].concat(await desfazer()), avisos: [] };
    }

    if (!resultado.ok) {
      return { ok: false, erros: resultado.erros.concat(await desfazer()), avisos: resultado.avisos || [] };
    }

    const avisos = (resultado.avisos || []).slice();
    const depois = await this.carregar(bom.id);

    if (depois) {
      // Devolvido pelo aprovador: a lista congelada no envio volta a ser
      // editável e fica guardada nos envios anteriores.
      if (papelDoElemento(elemento) === 'aprovacao' && depois.instancia.status === 'emAndamento') {
        const aviso = await this.liberarListaCongelada(bom, contexto, execucao.comentario);
        if (aviso) {
          avisos.push(aviso);
        }
      }

      const aviso = await this.sincronizar(bom, depois);
      if (aviso) {
        avisos.push(aviso);
      }
    }

    return { ok: true, erros: [], avisos, estado: depois };
  }

  private async liberarListaCongelada(
    bom: IBomRegistro,
    contexto: IContextoAcesso,
    motivo: string
  ): Promise<string> {
    try {
      const selecao = await this.bom.lerSelecaoKit(bom.id);
      if (!selecao || selecao === 'semColuna' || !selecao.bomEnviado) {
        return '';
      }
      const anteriores = (selecao.enviosAnteriores || []).slice();
      anteriores.push({ ...selecao.bomEnviado, devolvidoEm: new Date().toISOString(), devolvidoPor: contexto.nome, motivo });
      const liberada = { ...selecao, enviosAnteriores: anteriores };
      delete liberada.bomEnviado;
      await this.bom.salvarSelecaoKit(bom.id, liberada, contexto.nome);
      return '';
    } catch (erro) {
      return `O B.O.M. foi devolvido, mas a lista de itens continua congelada: ${mensagem(erro)}`;
    }
  }

  // Grava no B.O.M. a etapa do fluxo (listas, filtros e Power BI).
  public async sincronizar(bom: IBomRegistro, estado: IEstadoFluxoBom): Promise<string> {

    const etapa: EtapaBom = etapaBomDaInstancia(estado.instancia);

    try {
      await this.bom.atualizarEtapa(bom.id, etapa);
      return '';
    } catch (erro) {
      const compativel = etapaBomCompativel(etapa);
      if (compativel !== etapa) {
        try {
          await this.bom.atualizarEtapa(bom.id, compativel);
          return '';
        } catch {
          // segue para o aviso
        }
      }
      return `O fluxo avançou, mas a etapa do B.O.M. não foi atualizada: ${mensagem(erro)}`;
    }
  }
}
