import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  calcularHH
} from './calculoHH';

import {
  ChaveAreaHH,
  IDadosHH
} from './modeloHH';

// ============================================================
// CÁLCULO DE HH — DADOS NO DATAVERSE
//
// Tabelas (scripts/dataverse/criar-tabelas-hh.ps1):
//   dgt_hhcalculo    Uma linha por VERSÃO do cálculo de uma área.
//                    Status: Rascunho → Vigente → Substituído.
//                    Os dados (premissas, custos, equipe, quadro,
//                    lançamentos) ficam em JSON; HH por ponto e % fixo
//                    também em colunas, para relatórios.
//   dgt_hhalteracao  Histórico: quem salvou/publicou, quando e por quê.
//
// Regra: nada é apagado. Publicar transforma o rascunho em Vigente e
// a versão vigente anterior em Substituído. O B.O.M. usa a Vigente.
// ============================================================

export const TABELAS_HH = {
  calculo: 'dgt_hhcalculo',
  alteracao: 'dgt_hhalteracao'
};

export const COL_HH = {
  id: 'dgt_hhcalculoid',
  titulo: 'dgt_name',
  area: 'dgt_area',
  mesReferencia: 'dgt_mesreferencia',
  status: 'dgt_status',
  versao: 'dgt_versao',
  dados: 'dgt_dados',
  resultados: 'dgt_resultados',
  hhPorPonto: 'dgt_hhporponto',
  pctFixo: 'dgt_pctfixo',
  motivo: 'dgt_motivo',
  publicadoPor: 'dgt_publicadopor',
  dataPublicacao: 'dgt_datapublicacao',
  alteradoPor: 'dgt_alteradopor'
};

export const COL_HH_ALT = {
  id: 'dgt_hhalteracaoid',
  resumo: 'dgt_name',
  area: 'dgt_area',
  acao: 'dgt_acao',
  versao: 'dgt_versao',
  motivo: 'dgt_motivo',
  usuarioNome: 'dgt_usuarionome'
};

export type StatusHH = 'Rascunho' | 'Vigente' | 'Substituído';

export interface IVersaoHH {
  id: string;
  area: ChaveAreaHH;
  titulo: string;
  mesReferencia: string;
  status: StatusHH;
  versao: number;
  hhPorPonto: number;
  pctFixo: number;
  motivo: string;
  publicadoPor: string;
  dataPublicacao: string;
  alteradoPor: string;
  modificadoEm: string;
}

export interface IAlteracaoHH {
  id: string;
  data: string;
  area: string;
  acao: string;
  versao: number;
  resumo: string;
  motivo: string;
  usuarioNome: string;
}

export interface IAreaHHCarregada {
  disponivel: boolean;          // tabelas existem
  motivoIndisponivel?: string;
  versoes: IVersaoHH[];
  vigente?: { versao: IVersaoHH; dados: IDadosHH };
  rascunho?: { versao: IVersaoHH; dados: IDadosHH };
  alteracoes: IAlteracaoHH[];
}

const guid = (v?: unknown): string => String(v || '').replace(/[{}]/g, '').trim().toLowerCase();
const texto = (r: IDataverseRecord, c: string): string => (r[c] === undefined || r[c] === null ? '' : String(r[c]));
const numero = (r: IDataverseRecord, c: string): number => {
  const v = Number(r[c]);
  return isNaN(v) ? 0 : v;
};

const tabelaInexistente = (erro: unknown): boolean =>
  /404|could not find|does not exist|0x80060888/i.test(String((erro as Error)?.message || erro || ''));

const lerVersao = (r: IDataverseRecord): IVersaoHH => ({
  id: guid(r[COL_HH.id]),
  area: texto(r, COL_HH.area),
  titulo: texto(r, COL_HH.titulo),
  mesReferencia: texto(r, COL_HH.mesReferencia),
  status: (texto(r, COL_HH.status) || 'Rascunho') as StatusHH,
  versao: numero(r, COL_HH.versao),
  hhPorPonto: numero(r, COL_HH.hhPorPonto),
  pctFixo: numero(r, COL_HH.pctFixo),
  motivo: texto(r, COL_HH.motivo),
  publicadoPor: texto(r, COL_HH.publicadoPor),
  dataPublicacao: texto(r, COL_HH.dataPublicacao),
  alteradoPor: texto(r, COL_HH.alteradoPor),
  modificadoEm: texto(r, 'modifiedon')
});

const lerDados = (json: string): IDadosHH | undefined => {
  try {
    const d = JSON.parse(json) as IDadosHH;
    return d && d.premissas ? d : undefined;
  } catch {
    return undefined;
  }
};

// Resumo guardado junto (Power BI e consulta rápida).
const resumoParaGravar = (dados: IDadosHH): { resultados: string; hhPorPonto: number; pctFixo: number } => {
  const r = calcularHH(dados);
  return {
    resultados: JSON.stringify({ resumo: r.resumo, equipe: { hh: r.equipe.hh, custoMensalEquivalente: r.equipe.custoMensalEquivalente }, apoio: r.apoio ? r.apoio.indicadores : undefined }),
    hhPorPonto: Math.round(r.resumo.hhPorPonto * 100) / 100,
    pctFixo: r.resumo.pctFixo
  };
};

export class HHService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  private selectVersao(comDados: boolean): string {
    const colunas = [COL_HH.id, COL_HH.titulo, COL_HH.area, COL_HH.mesReferencia, COL_HH.status, COL_HH.versao, COL_HH.hhPorPonto, COL_HH.pctFixo, COL_HH.motivo, COL_HH.publicadoPor, COL_HH.dataPublicacao, COL_HH.alteradoPor, 'modifiedon'];
    if (comDados) {
      colunas.push(COL_HH.dados);
    }
    return `$select=${colunas.join(',')}`;
  }

  public async carregarArea(area: ChaveAreaHH): Promise<IAreaHHCarregada> {

    let registros: IDataverseRecord[];
    try {
      registros = await this.dataverse.listarRegistros(
        TABELAS_HH.calculo,
        `${this.selectVersao(false)}&$filter=${COL_HH.area} eq '${area}'&$orderby=${COL_HH.versao} desc`
      );
    } catch (erro) {
      return {
        disponivel: false,
        motivoIndisponivel: tabelaInexistente(erro)
          ? 'As tabelas do cálculo de HH ainda não foram criadas no Dataverse (script criar-tabelas-hh.ps1).'
          : `Não foi possível ler o cálculo de HH: ${String((erro as Error)?.message || erro).substring(0, 200)}`,
        versoes: [],
        alteracoes: []
      };
    }

    const versoes = registros.map(lerVersao);
    const resultado: IAreaHHCarregada = { disponivel: true, versoes, alteracoes: [] };

    const carregarDados = async (v?: IVersaoHH): Promise<{ versao: IVersaoHH; dados: IDadosHH } | undefined> => {
      if (!v) {
        return undefined;
      }
      const r = await this.dataverse.listarRegistros(TABELAS_HH.calculo, `$select=${COL_HH.dados}&$filter=${COL_HH.id} eq ${v.id}`);
      const dados = r[0] ? lerDados(texto(r[0], COL_HH.dados)) : undefined;
      return dados ? { versao: v, dados } : undefined;
    };

    [resultado.vigente, resultado.rascunho] = await Promise.all([
      carregarDados(versoes.filter(v => v.status === 'Vigente')[0]),
      carregarDados(versoes.filter(v => v.status === 'Rascunho')[0])
    ]);

    resultado.alteracoes = (await this.dataverse.listarRegistros(
      TABELAS_HH.alteracao,
      `$select=${Object.keys(COL_HH_ALT).map(k => (COL_HH_ALT as Record<string, string>)[k]).join(',')},createdon&$filter=${COL_HH_ALT.area} eq '${area}'&$orderby=createdon desc&$top=200`
    ).catch(() => [] as IDataverseRecord[])).map(r => ({
      id: guid(r[COL_HH_ALT.id]),
      data: texto(r, 'createdon'),
      area: texto(r, COL_HH_ALT.area),
      acao: texto(r, COL_HH_ALT.acao),
      versao: numero(r, COL_HH_ALT.versao),
      resumo: texto(r, COL_HH_ALT.resumo),
      motivo: texto(r, COL_HH_ALT.motivo),
      usuarioNome: texto(r, COL_HH_ALT.usuarioNome)
    }));

    return resultado;
  }

  // Valores vigentes de todas as áreas (para o B.O.M.).
  public async carregarVigentes(): Promise<Record<string, { versao: IVersaoHH; dados: IDadosHH }>> {
    const registros = await this.dataverse.listarRegistros(
      TABELAS_HH.calculo,
      `${this.selectVersao(true)}&$filter=${COL_HH.status} eq 'Vigente'`
    );
    const mapa: Record<string, { versao: IVersaoHH; dados: IDadosHH }> = {};
    registros.forEach(r => {
      const dados = lerDados(texto(r, COL_HH.dados));
      const v = lerVersao(r);
      if (dados && (!mapa[v.area] || mapa[v.area].versao.versao < v.versao)) {
        mapa[v.area] = { versao: v, dados };
      }
    });
    return mapa;
  }

  private async registrar(area: string, acao: string, versao: number, resumo: string, motivo: string, usuarioNome: string): Promise<void> {
    await this.dataverse.criarRegistro(TABELAS_HH.alteracao, {
      [COL_HH_ALT.resumo]: resumo.substring(0, 200),
      [COL_HH_ALT.area]: area,
      [COL_HH_ALT.acao]: acao,
      [COL_HH_ALT.versao]: versao,
      [COL_HH_ALT.motivo]: motivo,
      [COL_HH_ALT.usuarioNome]: usuarioNome
    });
  }

  // Grava o rascunho da área (cria se não existir).
  public async salvarRascunho(
    area: ChaveAreaHH,
    dados: IDadosHH,
    atual: IAreaHHCarregada,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    const resumo = resumoParaGravar(dados);
    const proxima = Math.max(0, ...atual.versoes.map(v => v.versao)) + 1;
    const campos = {
      [COL_HH.titulo]: `${dados.titulo} — ${dados.premissas.mesReferencia}`.substring(0, 200),
      [COL_HH.area]: area,
      [COL_HH.mesReferencia]: dados.premissas.mesReferencia,
      [COL_HH.dados]: JSON.stringify(dados),
      [COL_HH.resultados]: resumo.resultados,
      [COL_HH.hhPorPonto]: resumo.hhPorPonto,
      [COL_HH.pctFixo]: resumo.pctFixo,
      [COL_HH.alteradoPor]: usuarioNome
    };
    if (atual.rascunho) {
      await this.dataverse.atualizarRegistro(TABELAS_HH.calculo, atual.rascunho.versao.id, campos);
    } else {
      await this.dataverse.criarRegistro(TABELAS_HH.calculo, { ...campos, [COL_HH.status]: 'Rascunho', [COL_HH.versao]: proxima });
    }
    await this.registrar(area, 'Rascunho salvo', atual.rascunho ? atual.rascunho.versao.versao : proxima,
      `Rascunho salvo — HH por ponto R$ ${resumo.hhPorPonto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, motivo, usuarioNome);
  }

  // Publica: o rascunho vira a versão Vigente (o B.O.M. passa a usar).
  public async publicar(
    area: ChaveAreaHH,
    dados: IDadosHH,
    atual: IAreaHHCarregada,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {
    await this.salvarRascunho(area, dados, atual, motivo, usuarioNome);
    const recarregado = await this.carregarArea(area);
    if (!recarregado.rascunho) {
      throw new Error('Rascunho não encontrado depois de salvar.');
    }
    if (recarregado.vigente) {
      await this.dataverse.atualizarRegistro(TABELAS_HH.calculo, recarregado.vigente.versao.id, { [COL_HH.status]: 'Substituído' });
    }
    await this.dataverse.atualizarRegistro(TABELAS_HH.calculo, recarregado.rascunho.versao.id, {
      [COL_HH.status]: 'Vigente',
      [COL_HH.motivo]: motivo,
      [COL_HH.publicadoPor]: usuarioNome,
      [COL_HH.dataPublicacao]: new Date().toISOString()
    });
    const r = resumoParaGravar(dados);
    await this.registrar(area, 'Publicação', recarregado.rascunho.versao.versao,
      `Versão ${recarregado.rascunho.versao.versao} publicada — HH por ponto R$ ${r.hhPorPonto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, motivo, usuarioNome);
  }

  // Descarta o rascunho: ele fica no histórico como Substituído.
  public async descartarRascunho(area: ChaveAreaHH, atual: IAreaHHCarregada, usuarioNome: string): Promise<void> {
    if (!atual.rascunho) {
      return;
    }
    await this.dataverse.atualizarRegistro(TABELAS_HH.calculo, atual.rascunho.versao.id, { [COL_HH.status]: 'Substituído', [COL_HH.motivo]: 'Rascunho descartado.' });
    await this.registrar(area, 'Rascunho descartado', atual.rascunho.versao.versao, 'Rascunho descartado (fica no histórico)', '', usuarioNome);
  }

  // Abre uma versão antiga (para consulta ou para começar um rascunho).
  public async lerVersao(id: string): Promise<IDadosHH | undefined> {
    const r = await this.dataverse.listarRegistros(TABELAS_HH.calculo, `$select=${COL_HH.dados}&$filter=${COL_HH.id} eq ${id}`);
    return r[0] ? lerDados(texto(r[0], COL_HH.dados)) : undefined;
  }
}

// ------------------------------------------------------------
// Uso pelo B.O.M. (uma leitura por sessão)
// ------------------------------------------------------------

let vigentes: Promise<Record<string, { versao: IVersaoHH; dados: IDadosHH }>> | undefined;

export const carregarHHVigente = (dataverse?: DataverseService): Promise<Record<string, { versao: IVersaoHH; dados: IDadosHH }>> => {
  if (!dataverse) {
    return Promise.resolve({});
  }
  if (!vigentes) {
    vigentes = new HHService(dataverse).carregarVigentes().catch(() => {
      vigentes = undefined;
      return {};
    });
  }
  return vigentes;
};

export const invalidarHHVigente = (): void => {
  vigentes = undefined;
};
