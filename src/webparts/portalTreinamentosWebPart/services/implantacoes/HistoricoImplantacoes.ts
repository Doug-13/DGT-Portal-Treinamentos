import {
  DataverseService
} from '../DataverseService';

import {
  AcaoDados,
  BaseImplantacoes
} from './BaseImplantacoes';

import {
  BALDE_RAIZ,
  IMPL_LOG,
  TABELA_IMPL_LOG
} from './esquemaImplantacoes';

import {
  ISessaoPainel
} from './permissoesImplantacoes';

// ============================================================
// IMPLANTAÇÕES — histórico de atividades
//
// Como no app original (Configurações › Histórico de atividades):
// quem fez, setor, ação, alvo, detalhe e quando. Cada evento é uma
// linha em dgt_impllog (data = Criado em).
//
//   acesso.login           abriu o módulo
//   usuario.* setor.* perfil.*   cadastros (AdminImplantacoes.ts)
//   relatorio.*            e-mails e relatórios
//   dados.criar / editar / excluir   gravações nos projetos — agrupadas
//                          por projeto e ação a cada poucos segundos
//                          (digitar num campo não vira uma linha por tecla)
// ============================================================

export interface IAlvoHistorico {
  tipo: string;
  id?: string;
  nome?: string;
}

export interface IEventoHistorico {
  id: string;
  em: string;
  uid: string;
  nome: string;
  setor: string;
  acao: string;
  alvo: IAlvoHistorico;
  detalhe: string;
}

export interface IFiltroHistorico {
  q?: string;
  uid?: string;
  setor?: string;
  cat?: string;
  de?: string;
  ate?: string;
  pag?: number;
  por?: number;
}

// Coleções que não entram como "dados" (já têm evento próprio ou são
// controle interno).
const FORA_DO_HISTORICO = ['relatorioEnvios', 'acessoUsuarios', 'acessoSetores', 'acessoPerfis'];

// Teto de leitura por consulta (os filtros vão para o Dataverse).
const LIMITE_LEITURA = 5000;

const AGRUPAR_MS = 4000;

const escaparOData = (valor: string): string =>
  valor.replace(/'/g, "''");

export class HistoricoImplantacoes {

  private readonly dataverse: DataverseService;
  private readonly base: BaseImplantacoes;
  private readonly sessao: ISessaoPainel;

  private pendentes: Record<string, { balde: string; acao: AcaoDados; itens: string[] }> = {};
  private temporizador: number | undefined;

  public constructor(
    dataverse: DataverseService,
    base: BaseImplantacoes,
    sessao: ISessaoPainel
  ) {
    this.dataverse = dataverse;
    this.base = base;
    this.sessao = sessao;
  }

  // ----------------------------------------------------------
  // Gravação
  // ----------------------------------------------------------

  public async registrar(
    acao: string,
    alvo?: IAlvoHistorico,
    detalhe?: string
  ): Promise<void> {

    const linha: Record<string, unknown> = {};
    linha[IMPL_LOG.acao] = acao.substring(0, 200);
    linha[IMPL_LOG.categoria] = acao.split('.')[0].substring(0, 30);
    linha[IMPL_LOG.usuarioId] = this.sessao.usuario.id.substring(0, 100);
    linha[IMPL_LOG.usuarioNome] = this.sessao.usuario.nome.substring(0, 200);
    linha[IMPL_LOG.setor] = this.sessao.usuario.setorNome.substring(0, 100);
    linha[IMPL_LOG.alvo] = JSON.stringify(alvo || {}).substring(0, 2000);
    linha[IMPL_LOG.detalhe] = String(detalhe || '').substring(0, 2000);

    try {
      await this.dataverse.criarRegistro(TABELA_IMPL_LOG, linha);
    } catch (erro) {
      // O histórico nunca impede o trabalho: só avisa no console.
      // eslint-disable-next-line no-console
      console.warn('Implantações: histórico não registrado:', erro);
    }
  }

  private nomeDoProjeto(balde: string): string {
    if (balde === BALDE_RAIZ) {
      return 'Dados gerais';
    }
    const projetos = (this.base.balde(BALDE_RAIZ).projetos || {}) as Record<string, Record<string, unknown>>;
    return String((projetos[balde] || {}).nome || balde);
  }

  // Chamado pela base a cada gravação de dados.
  public registrarDados = (
    balde: string,
    colecao: string,
    id: string,
    acao: AcaoDados
  ): void => {

    if (FORA_DO_HISTORICO.indexOf(colecao) >= 0) {
      return;
    }

    const chave = `${balde}|${acao}`;
    const grupo = this.pendentes[chave] || (this.pendentes[chave] = { balde, acao, itens: [] });
    const item = `${colecao}/${id}`;

    if (grupo.itens.indexOf(item) < 0) {
      grupo.itens.push(item);
    }

    if (this.temporizador === undefined) {
      this.temporizador = window.setTimeout(() => this.descarregar(), AGRUPAR_MS);
    }
  };

  // Grava o que está agrupado (também ao sair da página).
  public descarregar(): void {

    if (this.temporizador !== undefined) {
      window.clearTimeout(this.temporizador);
      this.temporizador = undefined;
    }

    const grupos = this.pendentes;
    this.pendentes = {};

    Object.keys(grupos).forEach(chave => {
      const g = grupos[chave];
      const lista = g.itens.slice(0, 6).join(', ') + (g.itens.length > 6 ? ' …' : '');
      this.registrar(
        `dados.${g.acao}`,
        { tipo: 'registro', id: g.balde, nome: this.nomeDoProjeto(g.balde) },
        `${g.itens.length} registro(s): ${lista}`
      ).catch(() => undefined);
    });
  }

  // ----------------------------------------------------------
  // Consulta (mais recente primeiro), mesmos filtros do original
  // ----------------------------------------------------------

  public async consultar(f: IFiltroHistorico): Promise<{ total: number; pag: number; por: number; itens: IEventoHistorico[]; limite: boolean }> {

    const filtros: string[] = [];

    if (f.uid) {
      filtros.push(`${IMPL_LOG.usuarioId} eq '${escaparOData(f.uid)}'`);
    }

    if (f.setor) {
      filtros.push(`${IMPL_LOG.setor} eq '${escaparOData(f.setor)}'`);
    }

    if (f.cat) {
      filtros.push(`${IMPL_LOG.categoria} eq '${escaparOData(f.cat)}'`);
    }

    // Datas no fuso de quem consulta (início e fim do dia).
    if (f.de && /^\d{4}-\d{2}-\d{2}$/.test(f.de)) {
      filtros.push(`${IMPL_LOG.em} ge ${new Date(`${f.de}T00:00:00`).toISOString()}`);
    }

    if (f.ate && /^\d{4}-\d{2}-\d{2}$/.test(f.ate)) {
      filtros.push(`${IMPL_LOG.em} le ${new Date(`${f.ate}T23:59:59`).toISOString()}`);
    }

    const q = String(f.q || '').trim();

    if (q) {
      const t = escaparOData(q);
      filtros.push(`(${[IMPL_LOG.usuarioNome, IMPL_LOG.acao, IMPL_LOG.alvo, IMPL_LOG.detalhe].map(c => `contains(${c},'${t}')`).join(' or ')})`);
    }

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_IMPL_LOG,
        `$select=${[IMPL_LOG.id, IMPL_LOG.acao, IMPL_LOG.usuarioId, IMPL_LOG.usuarioNome, IMPL_LOG.setor, IMPL_LOG.alvo, IMPL_LOG.detalhe, IMPL_LOG.em].join(',')}` +
        (filtros.length ? `&$filter=${filtros.join(' and ')}` : '') +
        `&$orderby=${IMPL_LOG.em} desc&$top=${LIMITE_LEITURA}`
      );

    const itens: IEventoHistorico[] = registros.map(r => {
      let alvo: IAlvoHistorico = { tipo: '' };
      try {
        alvo = JSON.parse(String(r[IMPL_LOG.alvo] || '{}')) as IAlvoHistorico;
      } catch {
        alvo = { tipo: '' };
      }
      return {
        id: String(r[IMPL_LOG.id] || ''),
        em: String(r[IMPL_LOG.em] || ''),
        uid: String(r[IMPL_LOG.usuarioId] || ''),
        nome: String(r[IMPL_LOG.usuarioNome] || ''),
        setor: String(r[IMPL_LOG.setor] || ''),
        acao: String(r[IMPL_LOG.acao] || ''),
        alvo,
        detalhe: String(r[IMPL_LOG.detalhe] || '')
      };
    });

    const por = Math.max(10, Math.min(5000, Number(f.por) || 50));
    const pag = Math.max(1, Number(f.pag) || 1);

    return {
      total: itens.length,
      pag,
      por,
      itens: itens.slice((pag - 1) * por, pag * por),
      limite: itens.length >= LIMITE_LEITURA
    };
  }
}
