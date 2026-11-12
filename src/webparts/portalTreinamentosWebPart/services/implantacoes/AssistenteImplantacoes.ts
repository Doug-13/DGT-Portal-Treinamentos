import {
  DataverseService
} from '../DataverseService';

import {
  BaseImplantacoes,
  DocumentoPainel
} from './BaseImplantacoes';

import {
  BALDE_RAIZ
} from './esquemaImplantacoes';

// ============================================================
// IMPLANTAÇÕES — Assistente IA
//
// Antes: servidor Python (tools/assistente.py) com chave própria
// (ANTHROPIC_API_KEY). Agora usa a MESMA chave e o mesmo caminho da
// IA de Licitações:
//
//   Portal ──► Custom API dgt_AnalisarLicitacaoIa ──► plugin ──► Claude
//
// Esse plugin recebe um texto e devolve um texto (não tem
// "ferramentas"). Por isso as três consultas do assistente
// (listar_projetos, detalhar_projeto, buscar_atividades) rodam AQUI,
// no navegador, sobre os dados já carregados: a IA pede as consultas
// numa linha "CONSULTAR: {...}", o portal executa e devolve o
// resultado na rodada seguinte, até ela responder.
//
// Contatos (telefone / e-mail) dos stakeholders NÃO vão para a IA.
// ============================================================

export interface IMensagemAssistente {
  role: string;
  texto: string;
}

export interface ICarteiraAssistente {
  id?: string;
  situacao?: string;
  real?: number;
  plan?: number;
  spi?: number;
  tad?: string;
  lim?: string;
  folga?: number;
  atraso_dias_limite?: number;
}

export interface IPedidoAssistente {
  pergunta: string;
  historico?: IMensagemAssistente[];
  carteira?: ICarteiraAssistente[];
}

// Modelos aceitos pelo plugin (Configuração não segura do passo).
const MODELO = 'claude-sonnet-5-5';
const MAX_TOKENS = 4000;
const MAX_RODADAS = 4;
// O plugin recusa mensagens acima de 60.000 caracteres.
const LIMITE_MENSAGEM = 56000;
const LIMITE_RESULTADO = 16000;

const SISTEMA = `Você é o assistente de PMO da DGT Tecnologia, integrado ao painel de acompanhamento de projetos de videomonitoramento (setor público).

Seu trabalho: responder às perguntas da equipe com um texto estruturado em português do Brasil, usando SOMENTE as informações do panorama da carteira e dos resultados de consulta que vêm na mensagem. Nunca invente números, datas, nomes ou situações; quando algo não estiver nos dados, diga que não consta no painel.

CONSULTAS. Se o panorama não bastar, peça consultas respondendo com UMA ÚNICA linha, sem mais nada:
CONSULTAR: {"consultas":[{"nome":"detalhar_projeto","args":{"projeto":"10381"}}]}
Consultas disponíveis (até 3 por vez):
- detalhar_projeto {"projeto": código (ex.: 10381) ou parte do nome}: contrato e prazos, stakeholders (nome e função), itens do contrato, boletins de medição, andamento por frente, pontos, status report e ações.
- buscar_atividades {"projeto": "", "texto": "", "responsavel": "", "situacao": "atrasada|em_andamento|a_iniciar|concluida|aberta", "de": "AAAA-MM-DD", "ate": "AAAA-MM-DD", "limite": 60}: atividades da execução com filtros (todos opcionais; projeto vazio = todos).
Quando já tiver o necessário, responda direto, sem a linha CONSULTAR.

RESPOSTA:
- Cite sempre o código e o nome do projeto. Datas no formato dd/mm/aa; valores em R$.
- Organize com títulos curtos (##), listas e, quando ajudar a comparar, tabelas em Markdown. Comece pelo que responde diretamente à pergunta e termine, se fizer sentido, com pontos de atenção ou próximos passos tirados dos dados.
- Seja objetivo: sem rodeios nem repetir a pergunta.

Glossário do painel:
- Físico realizado: avanço ponderado da execução (G3); início realizado vale 50%, término realizado 100%.
- Físico planejado: avanço esperado na data de hoje pela linha de base (R00) ou revisão vigente.
- SPI = realizado / planejado (abaixo de 1 = atrasado).
- Término planejado (T.A.D.): fim previsto da execução. Limite de implantação: ordem de início + prazo + aditivos. Folga = limite − término planejado (negativa = planejado passa do limite).
- Situação: Concluído; Fora do prazo contratual (limite de implantação = prazo + aditivos já vencido e projeto não concluído; prevalece sobre os demais atrasos); Atraso administrativo (pendência de terceiros, marcada manualmente); Em atraso (atividade com fim planejado vencido, término além do limite ou limite vencido); Atenção (limite em até 15 dias); No prazo.
- PMO do projeto: responsável DGT pelo projeto. Boletins de medição = faturamento realizado.`;

type Registro = Record<string, unknown>;

const texto = (valor: unknown): string =>
  valor === undefined || valor === null ? '' : String(valor);

const normalizar = (valor: unknown): string =>
  texto(valor)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const dataCurta = (valor: unknown): string => {
  const s = texto(valor);
  return s.length >= 10 ? `${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(2, 4)}` : '';
};

const hojeIso = (): string => {
  const d = new Date();
  const dois = (n: number): string => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

const lista = (valor: unknown): Registro[] =>
  Array.isArray(valor) ? valor as Registro[] : [];

const valores = (mapa: unknown): Registro[] =>
  mapa && typeof mapa === 'object'
    ? Object.keys(mapa as Registro).map(chave => (mapa as Record<string, Registro>)[chave])
    : [];

const situacaoDe = (atividade: Registro, fim: string, hoje: string): string => {
  if (atividade.fimReal) {
    return 'concluida';
  }
  if (fim && fim < hoje) {
    return 'atrasada';
  }
  if (atividade.inicioReal) {
    return 'em_andamento';
  }
  return 'a_iniciar';
};

interface IAtividadeBase {
  atividade: Registro;
  inicio: string;
  fim: string;
}

export class AssistenteImplantacoes {

  private readonly dataverse: DataverseService;
  private readonly base: BaseImplantacoes;

  public constructor(
    dataverse: DataverseService,
    base: BaseImplantacoes
  ) {
    this.dataverse = dataverse;
    this.base = base;
  }

  // ----------------------------------------------------------
  // Leitura da base (igual à classe Base de tools/assistente.py)
  // ----------------------------------------------------------

  private projetos(): Record<string, Registro> {
    return (this.base.balde(BALDE_RAIZ).projetos || {}) as Record<string, Registro>;
  }

  private config(pid: string, documento: string): Registro {
    return ((this.base.balde(pid).config || {})[documento] || {}) as DocumentoPainel;
  }

  private nome(pid: string): string {
    return texto(this.config(pid, 'projeto').nome) ||
      texto((this.projetos()[pid] || {}).nome) ||
      pid;
  }

  private achar(referencia: string): string[] {

    const r = normalizar(referencia);
    const projetos = this.projetos();

    return Object.keys(projetos).filter(pid => {
      const nome = normalizar(projetos[pid].nome);
      const codigo = /^\s*0*(\d+)/.exec(texto(projetos[pid].nome));
      return r === normalizar(pid) ||
        (!!codigo && r.replace(/^0+/, '') === codigo[1]) ||
        (!!r && nome.indexOf(r) >= 0);
    });
  }

  private atividades(pid: string): IAtividadeBase[] {

    const revisado = lista(this.config(pid, 'projeto').cronRevs).length > 0;

    return valores(this.base.balde(pid).atividades)
      .filter(atividade => Number(atividade.grupo || 0) === 3)
      .map(atividade => ({
        atividade,
        inicio: texto((revisado && atividade.inicioRev) || atividade.inicio),
        fim: texto((revisado && atividade.fimRev) || atividade.fim)
      }));
  }

  // ----------------------------------------------------------
  // Consultas
  // ----------------------------------------------------------

  private listarProjetos(carteira: Record<string, ICarteiraAssistente>): Registro[] {

    return Object.keys(this.projetos()).map(pid => {

      const cfg = this.config(pid, 'projeto');
      const stk = this.config(pid, 'stakeholders');
      const c = carteira[pid] || {};
      const acoes = lista(cfg.acoes);
      const acao = acoes.length > 0 ? acoes[0] : {};

      let faturado = 0;
      valores(this.base.balde(pid).faturamentos)
        .forEach(boletim => { faturado += Number(boletim.valor || 0) || 0; });

      return {
        id: pid,
        projeto: this.nome(pid),
        cliente: texto(stk.cliente),
        contrato: texto(stk.contrato),
        pmo_do_projeto: lista(stk.dgt).map(pessoa => pessoa.nome),
        situacao: c.situacao,
        atraso_administrativo: !!stk.atrasoAdm,
        motivo_atraso_adm: texto(stk.atrasoAdmMotivo),
        fisico_realizado_pct: c.real,
        fisico_planejado_pct: c.plan,
        spi: c.spi,
        termino_planejado: dataCurta(c.tad),
        limite_implantacao: dataCurta(c.lim),
        folga_dias: c.folga,
        natureza: texto(stk.natureza) || 'locacao',
        valor_contratado: stk.valorContrato,
        faturado_boletins: Math.round(faturado * 100) / 100,
        status_report: texto(cfg.statusReport),
        status_report_data: dataCurta(cfg.statusReportData),
        proxima_acao: texto(acao.t),
        proxima_acao_data: dataCurta(acao.d)
      };
    });
  }

  private detalharProjeto(
    projeto: string,
    carteira: Record<string, ICarteiraAssistente>
  ): Registro {

    const ids = this.achar(projeto);

    if (ids.length === 0) {
      return { erro: `Projeto '${projeto}' não encontrado.` };
    }

    if (ids.length > 1) {
      return {
        erro: 'Mais de um projeto corresponde; especifique o código.',
        opcoes: ids.map(id => this.nome(id))
      };
    }

    const pid = ids[0];
    const cfg = this.config(pid, 'projeto');
    const stk = this.config(pid, 'stakeholders');
    const hoje = hojeIso();

    const frentes: Record<string, Record<string, number | string>> = {};
    const pontos: Record<string, { total: number; concluidas: number; atrasadas: number }> = {};

    this.atividades(pid).forEach(item => {

      const s = situacaoDe(item.atividade, item.fim, hoje);
      const nomeFrente = texto(item.atividade.faseNome) || 'Sem frente';

      const frente = frentes[nomeFrente] ||
        (frentes[nomeFrente] = { total: 0, concluida: 0, em_andamento: 0, atrasada: 0, a_iniciar: 0, fim_planejado: '' });

      frente.total = Number(frente.total) + 1;
      frente[s] = Number(frente[s]) + 1;

      if (item.fim > String(frente.fim_planejado)) {
        frente.fim_planejado = item.fim;
      }

      if (item.atividade.ponto) {
        const nomePonto = texto(item.atividade.pacoteNome) || 'Ponto';
        const ponto = pontos[nomePonto] || (pontos[nomePonto] = { total: 0, concluidas: 0, atrasadas: 0 });
        ponto.total++;
        if (s === 'concluida') { ponto.concluidas++; }
        if (s === 'atrasada') { ponto.atrasadas++; }
      }
    });

    Object.keys(frentes).forEach(nome => {
      frentes[nome].fim_planejado = dataCurta(frentes[nome].fim_planejado);
    });

    const nomesPontos = Object.keys(pontos);
    const c = carteira[pid] || {};

    // Só nome e função: contatos não vão para o modelo.
    const pessoas = (grupo: unknown): Registro[] =>
      lista(grupo).map(pessoa => ({ nome: pessoa.nome, funcao: pessoa.funcao }));

    const boletins = valores(this.base.balde(pid).faturamentos)
      .map(boletim => ({
        comp: boletim.comp,
        compFim: boletim.compFim,
        situacao: boletim.situacao,
        valor: boletim.valor,
        envio: boletim.envio,
        liberacao: boletim.liberacao,
        nf: boletim.nf,
        ref: boletim.ref
      }))
      .sort((a, b) => texto(a.comp) < texto(b.comp) ? -1 : texto(a.comp) > texto(b.comp) ? 1 : 0);

    return {
      projeto: this.nome(pid),
      indicadores: {
        situacao: c.situacao,
        real: c.real,
        plan: c.plan,
        spi: c.spi,
        folga: c.folga,
        termino_planejado: dataCurta(c.tad),
        limite: dataCurta(c.lim)
      },
      cliente: stk.cliente,
      contrato: stk.contrato,
      objeto: stk.objeto,
      natureza: texto(stk.natureza) || 'locacao',
      assinatura: dataCurta(stk.assinatura),
      ordem_inicio: dataCurta(stk.oi),
      prazo_implantacao_dias: stk.prazoImpl,
      prazo_contratual_meses: stk.prazoContrato,
      aditivos: lista(stk.aditivos),
      valor_contratado: stk.valorContrato,
      meses_faturamento: stk.mesesValor,
      atraso_administrativo: !!stk.atrasoAdm,
      motivo_atraso_adm: texto(stk.atrasoAdmMotivo),
      stakeholders_dgt: pessoas(stk.dgt),
      stakeholders_cliente: pessoas(stk.cli),
      itens_contrato: lista(stk.itensContrato),
      boletins,
      frentes,
      pontos: {
        total: nomesPontos.length,
        concluidos: nomesPontos.filter(nome => pontos[nome].concluidas === pontos[nome].total).length,
        com_atraso: nomesPontos.filter(nome => pontos[nome].atrasadas > 0).sort()
      },
      status_report: texto(cfg.statusReport),
      status_report_data: dataCurta(cfg.statusReportData),
      acoes: lista(cfg.acoes)
    };
  }

  private buscarAtividades(args: Registro): Registro {

    const projeto = texto(args.projeto);
    const pids = projeto ? this.achar(projeto) : Object.keys(this.projetos());
    const t = normalizar(args.texto);
    const r = normalizar(args.responsavel);
    const situacao = texto(args.situacao);
    const de = texto(args.de);
    const ate = texto(args.ate);
    const limite = Math.max(1, Math.min(Number(args.limite) || 60, 120));
    const hoje = hojeIso();

    const linhas: Registro[] = [];
    let total = 0;

    pids.forEach(pid => {
      this.atividades(pid).forEach(item => {

        const a = item.atividade;
        const s = situacaoDe(a, item.fim, hoje);

        if (situacao === 'aberta' && s === 'concluida') { return; }
        if (situacao && situacao !== 'aberta' && s !== situacao) { return; }
        if (t && normalizar([a.titulo, a.faseNome, a.pacoteNome].map(texto).join(' ')).indexOf(t) < 0) { return; }
        if (r && normalizar(a.resp).indexOf(r) < 0) { return; }
        if (de && (item.fim || item.inicio) && (item.fim || item.inicio) < de) { return; }
        if (ate && item.inicio && item.inicio > ate) { return; }

        total++;

        if (linhas.length < limite) {
          linhas.push({
            projeto: this.nome(pid),
            frente: texto(a.faseNome),
            pacote: texto(a.pacoteNome),
            atividade: texto(a.titulo),
            responsavel: texto(a.resp),
            inicio_planejado: dataCurta(item.inicio),
            fim_planejado: dataCurta(item.fim),
            inicio_realizado: dataCurta(a.inicioReal),
            fim_realizado: dataCurta(a.fimReal),
            situacao: s,
            obs: texto(a.obs).substring(0, 160)
          });
        }
      });
    });

    return { total_encontrado: total, mostrando: linhas.length, atividades: linhas };
  }

  // ----------------------------------------------------------
  // Conversa
  // ----------------------------------------------------------

  private executar(
    consulta: Registro,
    carteira: Record<string, ICarteiraAssistente>
  ): string {

    const nome = texto(consulta.nome);
    const args = (consulta.args || {}) as Registro;

    let resultado: unknown;

    if (nome === 'detalhar_projeto') {
      resultado = this.detalharProjeto(texto(args.projeto), carteira);
    } else if (nome === 'buscar_atividades') {
      resultado = this.buscarAtividades(args);
    } else if (nome === 'listar_projetos') {
      resultado = { aviso: 'O panorama da carteira já está na mensagem.' };
    } else {
      resultado = { erro: `Consulta desconhecida: ${nome}` };
    }

    const json = JSON.stringify(resultado);

    return `### ${nome} ${JSON.stringify(args)}\n` +
      (json.length > LIMITE_RESULTADO
        ? `${json.substring(0, LIMITE_RESULTADO)}… (resultado cortado: peça um recorte menor)`
        : json);
  }

  public async responder(pedido: IPedidoAssistente): Promise<string> {

    const carteira: Record<string, ICarteiraAssistente> = {};

    (pedido.carteira || []).forEach(item => {
      if (item && item.id) {
        carteira[item.id] = item;
      }
    });

    const hoje = new Date();
    const dois = (n: number): string => (n < 10 ? '0' : '') + n;

    const historico =
      (pedido.historico || [])
        .slice(-6)
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !!m.texto)
        .map(m => `${m.role === 'user' ? 'Pergunta' : 'Resposta'}: ${m.texto.substring(0, 1500)}`)
        .join('\n\n');

    const panorama = JSON.stringify(this.listarProjetos(carteira));

    const consultas: string[] = [];

    for (let rodada = 1; rodada <= MAX_RODADAS; rodada++) {

      const ultima = rodada === MAX_RODADAS;

      let resultados = consultas.join('\n\n');

      // Mantém a mensagem dentro do limite do plugin: corta os
      // resultados mais antigos primeiro.
      const fixo = panorama.length + historico.length + pedido.pergunta.length + 600;

      if (fixo + resultados.length > LIMITE_MENSAGEM) {
        resultados = resultados.substring(Math.max(0, resultados.length - Math.max(0, LIMITE_MENSAGEM - fixo)));
      }

      const mensagem =
        `Hoje é ${dois(hoje.getDate())}/${dois(hoje.getMonth() + 1)}/${hoje.getFullYear()}.\n\n` +
        `## Panorama da carteira (listar_projetos)\n${panorama.substring(0, Math.max(2000, LIMITE_MENSAGEM - 8000))}\n\n` +
        (historico ? `## Conversa até aqui\n${historico}\n\n` : '') +
        (resultados ? `## Resultados das consultas já feitas\n${resultados}\n\n` : '') +
        `## Pergunta da equipe\n${pedido.pergunta.trim()}` +
        (ultima ? '\n\n(Não peça mais consultas: responda agora com o que já tem.)' : '');

      const resposta =
        await this.dataverse.analisarLicitacaoIa({
          sistema: SISTEMA,
          mensagem,
          modelo: MODELO,
          maxTokens: MAX_TOKENS
        });

      const saida = texto(resposta.texto).trim();
      const pedidoConsulta = /^\s*CONSULTAR:\s*(\{[\s\S]*\})\s*$/.exec(saida);

      if (!pedidoConsulta || ultima) {

        if (!saida || pedidoConsulta) {
          return 'O assistente não conseguiu concluir a resposta. Reformule a pergunta ou peça um recorte menor.';
        }

        return resposta.parada === 'max_tokens'
          ? `${saida}\n\n_(Resposta interrompida por tamanho; peça um recorte menor.)_`
          : saida;
      }

      let pedidas: Registro[] = [];

      try {
        pedidas = lista((JSON.parse(pedidoConsulta[1]) as Registro).consultas).slice(0, 3);
      } catch {
        pedidas = [];
      }

      if (pedidas.length === 0) {
        consultas.push('### (pedido de consulta inválido: use o formato CONSULTAR: {"consultas":[...]})');
      } else {
        pedidas.forEach(consulta => consultas.push(this.executar(consulta, carteira)));
      }
    }

    return 'O assistente não conseguiu concluir a resposta.';
  }
}
