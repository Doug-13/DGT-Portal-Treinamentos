import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  BALDE_RAIZ,
  IMPL,
  LIMITE_DADOS,
  TABELA_IMPL_REGISTRO,
  chaveUnica
} from './esquemaImplantacoes';

import {
  ISessaoPainel,
  colecoesOcultas,
  podeNoPainel,
  recursoDaColecao
} from './permissoesImplantacoes';

// ============================================================
// IMPLANTAÇÕES — base de dados do painel no Dataverse
//
// O código do painel (pages/Implantacoes/legado/painelApp.js) lê e
// grava por uma API de "documentos" (collection / doc / get / set /
// update / delete / onSnapshot / batch). Esta classe oferece essa
// MESMA API, guardando cada documento numa linha de dgt_implregistro.
//
//   - carregar(): lê tudo uma vez e mantém em memória (a carteira
//     precisa de todos os projetos);
//   - gravações: aplicadas na memória na hora e enviadas ao Dataverse
//     em fila (ordem garantida por documento);
//   - sincronizar(): a cada 30 s busca o que outras pessoas mudaram
//     (modifiedon) e avisa as telas abertas;
//   - exclusão: lógica (dgt_excluido), nunca apaga a linha.
//
// Vale a última gravação de cada documento (igual ao painel original).
// ============================================================

export type DocumentoPainel = Record<string, unknown>;

type Colecao = Record<string, DocumentoPainel>;
type Balde = Record<string, Colecao>;

type Operacao = 'set' | 'update' | 'delete';

export interface IEstadoBase {
  texto: string;
  erro: boolean;
}

export interface IArquivoImportacao {
  balde: string;
  dados: Record<string, unknown>;
}

export interface IProgressoImportacao {
  feitos: number;
  total: number;
  criados: number;
  existentes: number;
  falhas: string[];
}

interface IRefDocumento {
  id: string;
  _path: string;
  get: () => Promise<unknown>;
  set: (dados: DocumentoPainel) => Promise<void>;
  update: (dados: DocumentoPainel) => Promise<void>;
  delete: () => Promise<void>;
  onSnapshot: (retorno: (instantaneo: unknown) => void) => () => void;
}

interface IOperacaoLote {
  path: string;
  op: Operacao;
  data?: DocumentoPainel;
}

const INTERVALO_SINCRONIA = 30000;
const GRAVACOES_SIMULTANEAS = 4;

const clonar = <T>(valor: T): T =>
  valor === undefined || valor === null
    ? valor
    : JSON.parse(JSON.stringify(valor)) as T;

const partes = (caminho: string): string[] =>
  String(caminho).split('/').filter(parte => !!parte);

const esperar = (ms: number): Promise<void> =>
  new Promise<void>(resolve => { setTimeout(resolve, ms); });

const escaparOData = (valor: string): string =>
  valor.replace(/'/g, "''");

const mensagemDe = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

export const tabelaImplantacoesAusente = (erro: unknown): boolean =>
  /0x80060888|Resource not found for the segment|Could not find a property|dgt_implregistro.*(not found|does not exist)|\b404\b/i
    .test(mensagemDe(erro));

export class BaseImplantacoes {

  private readonly dataverse: DataverseService;
  private readonly sessao: ISessaoPainel;
  private readonly ocultas: string[];

  // balde → coleção → id → documento
  private readonly cache: Record<string, Balde> = {};
  // chave única → id da linha no Dataverse
  private readonly linhas: Record<string, string> = {};
  // chave única → JSON gravado/lido por último (para saber se mudou)
  private readonly textos: Record<string, string> = {};
  // chave única → gravações ainda na fila
  private readonly pendentes: Record<string, number> = {};
  // chave única → última gravação enfileirada (ordem por documento)
  private readonly filaPorChave: Record<string, Promise<void>> = {};

  private readonly ouvintes: Record<string, Array<() => void>> = {};

  private emAndamento: number = 0;
  private readonly espera: Array<() => void> = [];

  private ultimaModificacao: string = '';
  private temporizador: number | undefined;
  private sincronizando: boolean = false;
  private falhas: number = 0;
  private totalLinhas: number = 0;

  // Avisos para a tela (selo "Compartilhado · ao vivo" / erro de conexão
  // e alteração recusada por falta de permissão).
  public aoMudarEstado: ((estado: IEstadoBase) => void) | undefined;
  public aoRecusar: ((mensagem: string) => void) | undefined;

  public constructor(
    dataverse: DataverseService,
    sessao: ISessaoPainel
  ) {
    this.dataverse = dataverse;
    this.sessao = sessao;
    this.ocultas = colecoesOcultas(sessao.perms);
  }

  // ----------------------------------------------------------
  // Carga e sincronização
  // ----------------------------------------------------------

  public get vazia(): boolean {
    return this.totalLinhas === 0;
  }

  public async carregar(): Promise<void> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_IMPL_REGISTRO,
        `$select=${[IMPL.balde, IMPL.colecao, IMPL.chave, IMPL.dados, IMPL.excluido, IMPL.modificadoEm].join(',')}` +
        `&$filter=${IMPL.excluido} ne true`
      );

    Object.keys(this.cache).forEach(balde => { delete this.cache[balde]; });

    this.totalLinhas = registros.length;

    registros.forEach(registro => this.aplicarRegistro(registro, false));

    this.avisarEstado('Compartilhado · ao vivo', false);
  }

  public iniciarSincronia(): void {

    this.pararSincronia();

    this.temporizador =
      window.setInterval(
        () => { this.sincronizar().catch(() => undefined); },
        INTERVALO_SINCRONIA
      );
  }

  public pararSincronia(): void {

    if (this.temporizador !== undefined) {
      window.clearInterval(this.temporizador);
      this.temporizador = undefined;
    }
  }

  // Busca o que mudou no Dataverse desde a última leitura.
  public async sincronizar(): Promise<void> {

    if (this.sincronizando || !this.ultimaModificacao) {
      return;
    }

    this.sincronizando = true;

    try {

      const registros =
        await this.dataverse.listarRegistros(
          TABELA_IMPL_REGISTRO,
          `$select=${[IMPL.balde, IMPL.colecao, IMPL.chave, IMPL.dados, IMPL.excluido, IMPL.modificadoEm].join(',')}` +
          `&$filter=${IMPL.modificadoEm} ge ${this.ultimaModificacao}`
        );

      registros.forEach(registro => this.aplicarRegistro(registro, true));

      if (this.falhas === 0) {
        this.avisarEstado('Compartilhado · ao vivo', false);
      }

    } catch {
      this.avisarEstado('Sem conexão com o Dataverse: tentando de novo…', true);
    } finally {
      this.sincronizando = false;
    }
  }

  private aplicarRegistro(
    registro: IDataverseRecord,
    avisar: boolean
  ): void {

    const balde = String(registro[IMPL.balde] || '');
    const colecao = String(registro[IMPL.colecao] || '');
    const id = String(registro[IMPL.chave] || '');

    if (!balde || !colecao || !id) {
      return;
    }

    const chave = chaveUnica(balde, colecao, id);
    const linhaId = String(registro[IMPL.id] || '');

    if (linhaId) {
      this.linhas[chave] = linhaId;
    }

    const modificado = String(registro[IMPL.modificadoEm] || '');

    if (modificado && modificado > this.ultimaModificacao) {
      this.ultimaModificacao = modificado;
    }

    // Documento com gravação local na fila: vale o que está aqui.
    if (this.pendentes[chave]) {
      return;
    }

    if (this.ocultas.indexOf(colecao) >= 0) {
      return;
    }

    const excluido = registro[IMPL.excluido] === true;
    const texto = String(registro[IMPL.dados] || '');
    const mapa = this.colecao(balde, colecao, !excluido);

    if (excluido) {

      if (mapa[id] === undefined) {
        return;
      }

      delete mapa[id];
      delete this.textos[chave];

    } else {

      if (this.textos[chave] === texto && mapa[id] !== undefined) {
        return;
      }

      let dados: DocumentoPainel;

      try {
        dados = JSON.parse(texto || '{}') as DocumentoPainel;
      } catch {
        return;
      }

      mapa[id] = dados;
      this.textos[chave] = texto;
    }

    if (avisar) {
      this.emitirDocumento(balde, colecao, id);
    }
  }

  // ----------------------------------------------------------
  // Memória
  // ----------------------------------------------------------

  // Leitura direta de um projeto (assistente IA e relatórios).
  public balde(id: string): Balde {
    return this.cache[id === 'main' ? BALDE_RAIZ : id] || {};
  }

  // Todos os projetos em memória (geração dos e-mails). Somente leitura.
  public todosOsBaldes(): Record<string, unknown> {
    return this.cache;
  }

  // Cria um documento SÓ SE ele ainda não existir no Dataverse (a chave
  // alternativa da tabela garante que apenas um navegador consegue).
  // Usado como trava do envio agendado de e-mails.
  public async criarExclusivo(
    colecao: string,
    id: string,
    dados: DocumentoPainel
  ): Promise<boolean> {

    const chave = chaveUnica(BALDE_RAIZ, colecao, id);

    if (this.linhas[chave]) {
      return false;
    }

    const documento = this.carimbar(undefined, dados);

    const novo: Record<string, unknown> = {};
    novo[IMPL.nome] = chave.substring(0, 200);
    novo[IMPL.balde] = BALDE_RAIZ;
    novo[IMPL.colecao] = colecao;
    novo[IMPL.chave] = id;
    novo[IMPL.chaveUnica] = chave;
    novo[IMPL.dados] = JSON.stringify(documento);
    novo[IMPL.excluido] = false;

    try {
      this.linhas[chave] =
        await this.dataverse.criarRegistro(TABELA_IMPL_REGISTRO, novo);
    } catch {
      return false;
    }

    this.totalLinhas++;
    this.colecao(BALDE_RAIZ, colecao, true)[id] = documento;
    this.textos[chave] = String(novo[IMPL.dados]);
    this.emitirDocumento(BALDE_RAIZ, colecao, id);

    return true;
  }

  private colecao(
    balde: string,
    colecao: string,
    criar: boolean
  ): Colecao {

    let b = this.cache[balde];

    if (!b) {
      if (!criar) {
        return {};
      }
      b = this.cache[balde] = {};
    }

    if (!b[colecao]) {
      if (!criar) {
        return {};
      }
      b[colecao] = {};
    }

    return b[colecao];
  }

  // "projetos/{id}/resto…" vai para o balde do projeto; o resto, para o geral.
  private separar(caminho: string): { balde: string; colecao: string } {

    const s = partes(caminho);

    if (s[0] === 'projetos' && s.length > 2) {
      return { balde: s[1], colecao: s.slice(2).join('/') };
    }

    return { balde: BALDE_RAIZ, colecao: s.join('/') };
  }

  private caminhoDaColecao(balde: string, colecao: string): string {
    return balde === BALDE_RAIZ ? colecao : `projetos/${balde}/${colecao}`;
  }

  // ----------------------------------------------------------
  // Ouvintes (onSnapshot)
  // ----------------------------------------------------------

  private ouvir(chave: string, funcao: () => void): () => void {

    if (!this.ouvintes[chave]) {
      this.ouvintes[chave] = [];
    }

    this.ouvintes[chave].push(funcao);

    return () => {
      const lista = this.ouvintes[chave] || [];
      const indice = lista.indexOf(funcao);
      if (indice >= 0) {
        lista.splice(indice, 1);
      }
    };
  }

  private emitir(chave: string): void {
    (this.ouvintes[chave] || []).slice().forEach(funcao => { setTimeout(funcao, 0); });
  }

  private emitirDocumento(balde: string, colecao: string, id: string): void {
    const caminho = this.caminhoDaColecao(balde, colecao);
    this.emitir(`c:${caminho}`);
    this.emitir(`d:${caminho}/${id}`);
  }

  private emitirTudo(): void {
    Object.keys(this.ouvintes).forEach(chave => this.emitir(chave));
  }

  private avisarEstado(texto: string, erro: boolean): void {
    if (this.aoMudarEstado) {
      this.aoMudarEstado({ texto, erro });
    }
  }

  // ----------------------------------------------------------
  // Gravação
  // ----------------------------------------------------------

  // Quem criou e quem alterou por último (usuário, área e data).
  private carimbar(
    anterior: DocumentoPainel | undefined,
    dados: DocumentoPainel
  ): DocumentoPainel {

    const antes =
      ((anterior || {})._audit || {}) as Record<string, unknown>;

    const quem = {
      id: this.sessao.usuario.id,
      nome: this.sessao.usuario.nome,
      setor: this.sessao.usuario.setorNome
    };

    const agora = new Date().toISOString();
    const carimbado: DocumentoPainel = { ...dados };

    carimbado._audit = {
      criadoPor: antes.criadoPor || quem,
      criadoEm: antes.criadoEm || agora,
      atualizadoPor: quem,
      atualizadoEm: agora
    };

    return carimbado;
  }

  private permitido(
    colecao: string,
    id: string,
    op: Operacao,
    existe: boolean
  ): boolean {

    const acao =
      op === 'delete' ? 'excluir' : existe ? 'editar' : 'criar';

    return podeNoPainel(this.sessao.perms, recursoDaColecao(colecao, id), acao);
  }

  // Aplica na memória e devolve o documento que ficou (undefined = excluído).
  private aplicar(
    balde: string,
    colecao: string,
    id: string,
    op: Operacao,
    dados?: DocumentoPainel
  ): DocumentoPainel | undefined {

    const mapa = this.colecao(balde, colecao, true);

    if (op === 'delete') {
      delete mapa[id];
      return undefined;
    }

    const anterior = mapa[id];

    const novo =
      op === 'set'
        ? { ...(dados || {}) }
        : { ...(anterior || {}), ...(dados || {}) };

    mapa[id] = this.carimbar(anterior, novo);

    return mapa[id];
  }

  private async comVaga<T>(tarefa: () => Promise<T>): Promise<T> {

    if (this.emAndamento >= GRAVACOES_SIMULTANEAS) {
      await new Promise<void>(resolve => { this.espera.push(resolve); });
    }

    this.emAndamento++;

    try {
      return await tarefa();
    } finally {
      this.emAndamento--;
      const proximo = this.espera.shift();
      if (proximo) {
        proximo();
      }
    }
  }

  private async localizarLinha(chave: string): Promise<string> {

    const achados =
      await this.dataverse.listarRegistros(
        TABELA_IMPL_REGISTRO,
        `$select=${IMPL.id}&$filter=${IMPL.chaveUnica} eq '${escaparOData(chave)}'&$top=1`
      );

    return achados.length > 0 ? String(achados[0][IMPL.id] || '') : '';
  }

  // Envia um documento ao Dataverse (cria, atualiza ou marca como excluído).
  private async enviar(
    balde: string,
    colecao: string,
    id: string,
    documento: DocumentoPainel | undefined
  ): Promise<void> {

    const chave = chaveUnica(balde, colecao, id);
    const excluir = documento === undefined;
    const texto = excluir ? '' : JSON.stringify(documento);

    if (texto.length > LIMITE_DADOS) {
      throw new Error(`O registro "${id}" ficou grande demais para ser salvo (${texto.length} caracteres).`);
    }

    const campos: Record<string, unknown> = {};
    campos[IMPL.excluido] = excluir;

    if (!excluir) {
      campos[IMPL.dados] = texto;
    }

    let tentativa = 0;

    for (;;) {

      try {

        let linha = this.linhas[chave];

        if (!linha && excluir) {
          linha = await this.localizarLinha(chave);
          if (!linha) {
            return;
          }
          this.linhas[chave] = linha;
        }

        if (linha) {
          await this.dataverse.atualizarRegistro(TABELA_IMPL_REGISTRO, linha, campos);
        } else {

          const novo: Record<string, unknown> = { ...campos };
          novo[IMPL.nome] = chave.substring(0, 200);
          novo[IMPL.balde] = balde;
          novo[IMPL.colecao] = colecao;
          novo[IMPL.chave] = id;
          novo[IMPL.chaveUnica] = chave;

          try {
            this.linhas[chave] =
              await this.dataverse.criarRegistro(TABELA_IMPL_REGISTRO, novo);
            this.totalLinhas++;
          } catch (erroCriar) {

            // Outra pessoa criou o mesmo documento ao mesmo tempo
            // (chave alternativa): passa a atualizar a linha dela.
            const existente = await this.localizarLinha(chave);

            if (!existente) {
              throw erroCriar;
            }

            this.linhas[chave] = existente;
            await this.dataverse.atualizarRegistro(TABELA_IMPL_REGISTRO, existente, campos);
          }
        }

        if (excluir) {
          delete this.textos[chave];
        } else {
          this.textos[chave] = texto;
        }

        return;

      } catch (erro) {

        tentativa++;

        // 429 = limite de requisições do Dataverse: espera e tenta de novo.
        const limite = /\b429\b|Too Many Requests|0x80072322|0x80072321|0x80072326/i.test(mensagemDe(erro));

        if (tentativa >= (limite ? 6 : 2)) {
          throw erro;
        }

        await esperar(limite ? 5000 * tentativa : 800);
      }
    }
  }

  private enfileirar(
    balde: string,
    colecao: string,
    id: string
  ): Promise<void> {

    const chave = chaveUnica(balde, colecao, id);

    this.pendentes[chave] = (this.pendentes[chave] || 0) + 1;

    const anterior = this.filaPorChave[chave] || Promise.resolve();

    const tarefa =
      anterior
        .catch(() => undefined)
        .then(() => this.comVaga(() => {
          // Envia o estado ATUAL do documento: gravações seguidas do
          // mesmo documento viram uma só atualização coerente.
          const atual = this.colecao(balde, colecao, false)[id];
          return this.enviar(balde, colecao, id, atual);
        }))
        .then(
          () => {
            this.pendentes[chave]--;
            if (this.falhas > 0 && this.totalPendentes() === 0) {
              this.falhas = 0;
              this.avisarEstado('Compartilhado · ao vivo', false);
            }
          },
          erro => {
            this.pendentes[chave]--;
            throw erro;
          }
        );

    this.filaPorChave[chave] = tarefa;

    return tarefa;
  }

  private totalPendentes(): number {
    let total = 0;
    Object.keys(this.pendentes).forEach(chave => { total += this.pendentes[chave]; });
    return total;
  }

  private falhou(erro: unknown): void {
    this.falhas++;
    // eslint-disable-next-line no-console
    console.error('Implantações: falha ao salvar no Dataverse:', erro);
    this.avisarEstado('Sem conexão com o Dataverse: a última alteração pode não ter sido salva', true);
  }

  private recusar(): void {
    if (this.aoRecusar) {
      this.aoRecusar('Seu perfil no portal não permite esta alteração.');
    }
    this.emitirTudo();
  }

  private escrever(
    caminhoColecao: string,
    id: string,
    op: Operacao,
    dados?: DocumentoPainel
  ): void {

    const { balde, colecao } = this.separar(caminhoColecao);
    const existe = this.colecao(balde, colecao, false)[id] !== undefined;

    if (!this.permitido(colecao, id, op, existe)) {
      this.recusar();
      return;
    }

    this.aplicar(balde, colecao, id, op, clonar(dados));
    this.emitirDocumento(balde, colecao, id);

    this.enfileirar(balde, colecao, id)
      .catch(erro => this.falhou(erro));
  }

  // ----------------------------------------------------------
  // API de documentos usada pelo painel
  // ----------------------------------------------------------

  private instantaneoDocumento(id: string, valor: DocumentoPainel | undefined): unknown {
    return {
      id,
      exists: valor !== undefined && valor !== null,
      data: () => clonar(valor)
    };
  }

  private instantaneoColecao(mapa: Colecao): unknown {
    return {
      docs: Object.keys(mapa).map(id => ({ id, data: () => clonar(mapa[id]) })),
      get size(): number {
        return Object.keys(mapa).length;
      }
    };
  }

  public doc = (caminho: string): IRefDocumento => {

    const s = partes(caminho);
    const id = s[s.length - 1];
    const caminhoColecao = s.slice(0, -1).join('/');

    const ler = (): DocumentoPainel | undefined => {
      const { balde, colecao } = this.separar(caminhoColecao);
      return this.colecao(balde, colecao, false)[id];
    };

    return {
      id,
      _path: caminho,
      get: async () => this.instantaneoDocumento(id, ler()),
      set: async (dados: DocumentoPainel) => this.escrever(caminhoColecao, id, 'set', dados),
      update: async (dados: DocumentoPainel) => this.escrever(caminhoColecao, id, 'update', dados),
      delete: async () => this.escrever(caminhoColecao, id, 'delete'),
      onSnapshot: (retorno: (instantaneo: unknown) => void) => {
        const disparar = (): void => retorno(this.instantaneoDocumento(id, ler()));
        setTimeout(disparar, 0);
        return this.ouvir(`d:${caminhoColecao}/${id}`, disparar);
      }
    };
  };

  public collection = (caminho: string): unknown => {

    const caminhoColecao = partes(caminho).join('/');

    const ler = (): Colecao => {
      const { balde, colecao } = this.separar(caminhoColecao);
      return this.colecao(balde, colecao, false);
    };

    return {
      doc: (id: string) => this.doc(`${caminhoColecao}/${id}`),
      get: async () => this.instantaneoColecao(ler()),
      onSnapshot: (retorno: (instantaneo: unknown) => void) => {
        const disparar = (): void => retorno(this.instantaneoColecao(ler()));
        setTimeout(disparar, 0);
        return this.ouvir(`c:${caminhoColecao}`, disparar);
      }
    };
  };

  // Lote: aplica tudo na memória e envia; se o Dataverse recusar algum
  // documento, a memória volta ao que estava e quem chamou é avisado.
  // (Não é uma transação no Dataverse: ver docs/implantacoes.md.)
  public batch = (): unknown => {

    const operacoes: IOperacaoLote[] = [];

    const lote = {
      set: (ref: IRefDocumento, dados: DocumentoPainel) => {
        operacoes.push({ path: ref._path, op: 'set', data: clonar(dados || {}) });
        return lote;
      },
      update: (ref: IRefDocumento, dados: DocumentoPainel) => {
        operacoes.push({ path: ref._path, op: 'update', data: clonar(dados || {}) });
        return lote;
      },
      delete: (ref: IRefDocumento) => {
        operacoes.push({ path: ref._path, op: 'delete' });
        return lote;
      },
      commit: async (): Promise<void> => {

        if (operacoes.length === 0) {
          return;
        }

        const itens = operacoes.map(operacao => {
          const s = partes(operacao.path);
          const id = s[s.length - 1];
          const { balde, colecao } = this.separar(s.slice(0, -1).join('/'));
          return {
            balde,
            colecao,
            id,
            op: operacao.op,
            data: operacao.data,
            antes: clonar(this.colecao(balde, colecao, false)[id])
          };
        });

        const negado =
          itens.some(item => !this.permitido(item.colecao, item.id, item.op, item.antes !== undefined));

        if (negado) {
          this.recusar();
          throw new Error('Seu perfil no portal não permite esta alteração.');
        }

        itens.forEach(item => {
          this.aplicar(item.balde, item.colecao, item.id, item.op, item.data);
          this.emitirDocumento(item.balde, item.colecao, item.id);
        });

        try {
          await Promise.all(
            itens.map(item => this.enfileirar(item.balde, item.colecao, item.id))
          );
        } catch (erro) {

          itens.slice().reverse().forEach(item => {
            const mapa = this.colecao(item.balde, item.colecao, true);
            if (item.antes === undefined) {
              delete mapa[item.id];
            } else {
              mapa[item.id] = item.antes;
            }
            this.emitirDocumento(item.balde, item.colecao, item.id);
            // Devolve ao Dataverse o que já tinha sido gravado do lote.
            this.enfileirar(item.balde, item.colecao, item.id)
              .catch(falha => this.falhou(falha));
          });

          throw erro;
        }
      }
    };

    return lote;
  };

  // ----------------------------------------------------------
  // Importação da base antiga (arquivos dados/*.json do painel)
  //
  // Só CRIA o que ainda não existe: nunca sobrescreve um documento
  // que já está no Dataverse.
  // ----------------------------------------------------------

  public async importar(
    arquivos: IArquivoImportacao[],
    progresso: (estado: IProgressoImportacao) => void
  ): Promise<IProgressoImportacao> {

    const itens: Array<{ balde: string; colecao: string; id: string; dados: DocumentoPainel }> = [];

    arquivos.forEach(arquivo => {
      Object.keys(arquivo.dados || {}).forEach(colecao => {

        const mapa = arquivo.dados[colecao];

        // Marcadores do balde (_rev, _origem...) não são coleções.
        if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa) || colecao.charAt(0) === '_') {
          return;
        }

        Object.keys(mapa as Colecao).forEach(id => {

          const dados = (mapa as Colecao)[id];

          if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
            itens.push({ balde: arquivo.balde, colecao, id, dados });
          }
        });
      });
    });

    const estado: IProgressoImportacao = {
      feitos: 0,
      total: itens.length,
      criados: 0,
      existentes: 0,
      falhas: []
    };

    let proximo = 0;

    const trabalhar = async (): Promise<void> => {

      while (proximo < itens.length) {

        const item = itens[proximo++];
        const chave = chaveUnica(item.balde, item.colecao, item.id);

        try {

          if (this.linhas[chave]) {
            estado.existentes++;
          } else {
            this.colecao(item.balde, item.colecao, true)[item.id] = item.dados;
            await this.enviar(item.balde, item.colecao, item.id, item.dados);
            estado.criados++;
          }

        } catch (erro) {
          estado.falhas.push(`${chave}: ${mensagemDe(erro).substring(0, 160)}`);
        }

        estado.feitos++;

        if (estado.feitos % 20 === 0 || estado.feitos === estado.total) {
          progresso({ ...estado, falhas: estado.falhas.slice() });
        }
      }
    };

    const trabalhadores: Array<Promise<void>> = [];

    for (let i = 0; i < GRAVACOES_SIMULTANEAS; i++) {
      trabalhadores.push(trabalhar());
    }

    await Promise.all(trabalhadores);

    return estado;
  }
}
