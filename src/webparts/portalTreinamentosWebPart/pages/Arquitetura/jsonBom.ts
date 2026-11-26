import {
  IAnaliseGoNoGo,
  IBomRegistro,
  IDemandaBom
} from '../../services/bom/BomService';

import {
  IRegistroAlteracaoBom,
  ISelecaoKit,
  nomeKitDoPonto
} from '../../services/bom/montadorBom';

import { IResumoValoresBom } from '../../services/hh/valoresProjeto';

import { ILinhaBom, solucoesDoPonto } from './pdfBom';

// ============================================================
// JSON DO B.O.M. — formato "dgt-portal/bom@1"
//
// Monta o B.O.M. em um objeto pronto para lançamento via API
// (CIGAM, CRM ou outro integrador). Usa exatamente os mesmos
// dados da tela, do CSV e do PDF: depois do envio, a lista
// congelada; antes, o montador com o catálogo atual.
//
// Valores numéricos saem como número (ponto decimal), datas em
// ISO 8601 e campos sem valor como null — nunca strings vazias.
// ============================================================

export const FORMATO_JSON_BOM = 'dgt-portal/bom@1';

export interface IEntradaJsonBom {
  bom: IBomRegistro;
  demanda: IDemandaBom;
  analise?: IAnaliseGoNoGo;
  selecao?: ISelecaoKit;
  linhas: ILinhaBom[];
  valorTotal: number;
  semPreco: number;
  semCodigo: number;
  alertas: string[];
  enviado: boolean;
  congeladoEm?: string;
  dataEnvio?: string;
  historico: IRegistroAlteracaoBom[];
  resumoValores: IResumoValoresBom;
  totais: { pontos: number; camerasVideo: number; camerasOcr: number; leitoras: number };
}

const valor = (v: number | undefined): number | null =>
  v === undefined || v === null || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100;

const texto = (v: string | undefined | null): string | null => {
  const t = (v || '').trim();
  return t ? t : null;
};

export const gerarJsonBom = (e: IEntradaJsonBom): Record<string, unknown> => {
  const numero = e.bom.numero.replace(/^BOM\s*/i, '');
  return {
    formato: FORMATO_JSON_BOM,
    geradoEm: new Date().toISOString(),
    bom: {
      id: e.bom.id,
      numero,
      revisao: e.bom.revisao,
      etapa: e.bom.etapa,
      enviadoParaAprovacao: e.enviado,
      listaCongeladaEm: e.congeladoEm || null,
      dataEnvio: e.dataEnvio || null,
      responsavel: { id: texto(e.bom.responsavelId), nome: texto(e.bom.responsavelNome) },
      criadoEm: e.bom.criadoEm || null,
      atualizadoEm: e.bom.atualizadoEm || null
    },
    demanda: {
      id: e.bom.demandaId || null,
      numero: texto(e.demanda.numero),
      nome: texto(e.demanda.nome),
      cliente: texto(e.demanda.cliente),
      municipio: texto(e.demanda.municipio),
      uf: texto(e.demanda.uf),
      canal: texto(e.demanda.canal),
      modalidade: texto(e.demanda.modalidade),
      tipoProjeto: texto(e.demanda.tipoProjeto),
      tipoEntrega: texto(e.demanda.tipoEntrega),
      oportunidadeCrm: texto(e.demanda.numeroCrm),
      prazoEntrega: texto(e.demanda.prazoEntrega),
      escopo: texto(e.demanda.escopo)
    },
    goNoGo: e.analise
      ? {
        decisao: e.analise.decisao,
        pontuacao: e.analise.pontuacao,
        avaliador: texto(e.analise.avaliadorNome),
        data: texto(e.analise.data),
        parecer: texto(e.analise.parecer)
      }
      : null,
    totais: {
      pontos: e.totais.pontos,
      camerasVideo: e.totais.camerasVideo,
      camerasOcr: e.totais.camerasOcr,
      leitoras: e.totais.leitoras,
      linhasDeItens: e.linhas.length,
      itensSemPreco: e.semPreco,
      itensSemCodigo: e.semCodigo
    },
    valores: {
      moeda: 'BRL',
      valorItensCigam: valor(e.valorTotal),
      areas: (e.resumoValores.areas || []).map(a => ({
        chave: a.chave,
        nome: a.nome,
        percentual: a.pctFixo,
        valor: valor(a.valor)
      })),
      totalAreas: valor(e.resumoValores.totalAreas),
      integracao: valor(e.resumoValores.integracao),
      manutencao: valor(e.resumoValores.manutencao),
      totalProjeto: valor(e.resumoValores.total),
      calculadoEm: e.resumoValores.calculadoEm || null
    },
    pontos: (e.selecao ? e.selecao.pontos : []).map(p => ({
      id: p.id,
      nome: p.nome,
      kit: nomeKitDoPonto(p),
      quantidade: p.quantidade,
      camerasVideo: p.camerasVideo,
      camerasOcr: p.camerasOcr,
      solucoes: solucoesDoPonto(p)
    })),
    itens: e.linhas.map((l, i) => ({
      sequencia: i + 1,
      codigoCigam: l.pendente ? null : texto(l.codigo),
      descricao: l.descricao,
      categoria: l.categoria,
      quantidade: l.quantidade,
      valorUnitario: valor(l.valorUnitario),
      valorTotal: valor(l.total),
      origem: texto(l.origem),
      semCodigo: !!l.pendente,
      substituto: !!l.substituto
    })),
    alteracoesKit: e.historico.map(r => ({
      pontoId: r.pontoId,
      situacao: r.situacao,
      acao: r.alteracao.acao,
      removido: {
        codigo: texto(r.alteracao.removido.codigo),
        descricao: r.alteracao.removido.descricao,
        quantidade: r.quantidadeRemovida
      },
      adicionado: r.alteracao.adicionado
        ? {
          codigo: texto(r.alteracao.adicionado.codigo),
          descricao: r.alteracao.adicionado.descricao,
          quantidade: r.quantidadeAdicionada
        }
        : null,
      motivo: texto(r.alteracao.motivo),
      por: texto(r.alteracao.por),
      em: r.alteracao.em
    })),
    alertas: e.alertas
  };
};

export const nomeArquivoJsonBom = (bom: IBomRegistro): string =>
  `BOM ${bom.numero.replace(/^BOM\s*/i, '')} ${bom.revisao}.json`;
