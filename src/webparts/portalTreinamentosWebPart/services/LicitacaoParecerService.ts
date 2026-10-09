import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  DecisaoParecer,
  ILicitacaoResultado,
  IParecerLicitacao,
  ISituacaoParecer,
  ROTULO_DECISAO
} from '../models/Licitacao';

import {
  interpretarIdPncp,
  normalizarTexto
} from '../utils/licitacoesFiltro';

// ============================================================
// MÓDULO LICITAÇÕES — PARECER (Participar / Não participar)
//
// Tabela dgt_licitacaoparecer, criada por
// scripts/dataverse/criar-tabela-pareceres-licitacao.ps1
// (os nomes abaixo DEVEM continuar iguais aos do script).
//
// Regras:
//   • Cada decisão gera um registro NOVO. Nunca atualiza nem
//     apaga: o parecer vigente é o mais recente; os anteriores
//     formam o histórico do edital (auditoria).
//   • Quem registrou e quando: createdby / createdon do Dataverse
//     (+ nome gravado em dgt_responsavelnome para exibição).
//
// LGPD / política da organização:
//   • A chave do edital NÃO usa o CNPJ do órgão. É montada com
//     órgão (nome) + local + ano + sequencial da compra.
//   • O link do PNCP (que contém o CNPJ) NÃO é gravado.
//   • A justificativa é recusada se contiver CPF, CNPJ, senha ou
//     dados bancários. O objeto do edital é gravado com qualquer
//     CPF/CNPJ mascarado.
// ============================================================

export const TABELA_PARECER = 'dgt_licitacaoparecer';

const C = {
  id: 'dgt_licitacaoparecerid',
  nome: 'dgt_name',
  chaveEdital: 'dgt_chaveedital',
  decisao: 'dgt_decisao',
  justificativa: 'dgt_justificativa',
  orgao: 'dgt_orgao',
  local: 'dgt_local',
  modalidade: 'dgt_modalidade',
  numero: 'dgt_numeroedital',
  objeto: 'dgt_objeto',
  valorEstimado: 'dgt_valorestimado',
  encerramento: 'dgt_dataencerramento',
  aderencia: 'dgt_aderencia',
  responsavel: 'dgt_responsavelnome'
};

export const TAMANHO_MINIMO_JUSTIFICATIVA = 15;
export const TAMANHO_MAXIMO_JUSTIFICATIVA = 4000;

// ------------------------------------------------------------
// Dados sensíveis (política da organização)
// ------------------------------------------------------------

const PADRAO_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const PADRAO_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

const PADROES_SENSIVEIS: Array<{ padrao: RegExp; motivo: string }> = [
  { padrao: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, motivo: 'um número que parece ser CNPJ' },
  { padrao: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, motivo: 'um número que parece ser CPF' },
  { padrao: /\b(senha|password|pwd)\s*[:=]/i, motivo: 'uma senha' },
  { padrao: /\bag[eê]ncia\b[\s\S]{0,40}\bconta\b/i, motivo: 'dados bancários (agência e conta)' },
  { padrao: /\bconta(\s+corrente|\s+poupan[cç]a)?\s*(n[ºo°.]*)?\s*[:=]?\s*\d{4,}/i, motivo: 'um número de conta bancária' },
  { padrao: /\bchave\s+pix\b/i, motivo: 'uma chave PIX' }
];

// Devolve o motivo (para explicar ao usuário) ou undefined.
export const detectarDadoSensivel = (
  texto: string
): string | undefined => {

  const encontrado = PADROES_SENSIVEIS.find(regra => regra.padrao.test(texto || ''));

  return encontrado ? encontrado.motivo : undefined;
};

// Usado em textos que vêm do PNCP (ex.: objeto) antes de gravar.
export const mascararDadosSensiveis = (
  texto: string
): string =>
  (texto || '')
    .replace(PADRAO_CNPJ, '[dado removido]')
    .replace(PADRAO_CPF, '[dado removido]');

// ------------------------------------------------------------
// Chave do edital (sem CNPJ)
// ------------------------------------------------------------

export const gerarChaveEdital = (
  item: ILicitacaoResultado
): string => {

  const ref = interpretarIdPncp(item.idPncp);

  const base = [
    normalizarTexto(item.orgao),
    normalizarTexto(item.local)
  ];

  // ref.orgao (CNPJ) é ignorado de propósito.
  const partes = ref
    ? ['v1'].concat(base, [String(ref.ano), String(ref.sequencial)])
    : ['v1n'].concat(base, [
      normalizarTexto(item.modalidade),
      normalizarTexto(item.numero),
      (item.publicacao || '').substring(0, 10)
    ]);

  return mascararDadosSensiveis(partes.join('|')).substring(0, 400);
};

// ------------------------------------------------------------
// Leitura
// ------------------------------------------------------------

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const formatado = (r: IDataverseRecord, campo: string): string =>
  texto(r, `${campo}@OData.Community.Display.V1.FormattedValue`);

const numero = (r: IDataverseRecord, campo: string): number | undefined => {
  const v = r[campo];
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  const n = Number(v);
  return isNaN(n) ? undefined : n;
};

const normalizarDecisao = (
  valor: string
): DecisaoParecer =>
  /^nao|^não/i.test(valor.trim())
    ? 'NaoParticipar'
    : 'Participar';

// Data "independente de fuso" volta como 2026-10-27T08:59:00Z:
// é o horário de Brasília exatamente como veio do PNCP.
const dataPncp = (valor: string): string | undefined =>
  valor ? valor.substring(0, 16) : undefined;

const mapear = (
  r: IDataverseRecord
): IParecerLicitacao => ({
  id: texto(r, C.id),
  chaveEdital: texto(r, C.chaveEdital),
  decisao: normalizarDecisao(texto(r, C.decisao)),
  justificativa: texto(r, C.justificativa),
  orgao: texto(r, C.orgao),
  local: texto(r, C.local),
  modalidade: texto(r, C.modalidade),
  numero: texto(r, C.numero),
  objeto: texto(r, C.objeto),
  valorEstimado: numero(r, C.valorEstimado),
  encerramento: dataPncp(texto(r, C.encerramento)),
  score: numero(r, C.aderencia),
  responsavel: texto(r, C.responsavel) || formatado(r, '_createdby_value') || 'Não identificado',
  registradoEm: texto(r, 'createdon')
});

// Erro de tabela inexistente (script ainda não executado).
export const ehErroTabelaInexistente = (
  erro: unknown
): boolean => {
  const mensagem = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(mensagem);
};

// ------------------------------------------------------------
// Serviço
// ------------------------------------------------------------

export class LicitacaoParecerService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // Todos os pareceres ativos, mais recentes primeiro.
  public async listar(): Promise<IParecerLicitacao[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_PARECER,
        '$select=' +
        [C.id, C.chaveEdital, C.decisao, C.justificativa, C.orgao, C.local, C.modalidade,
          C.numero, C.objeto, C.valorEstimado, C.encerramento, C.aderencia, C.responsavel,
          'createdon', '_createdby_value'].join(',') +
        '&$filter=statecode eq 0' +
        '&$orderby=createdon desc'
      );

    return registros
      .map(mapear)
      .filter(parecer => !!parecer.chaveEdital);
  }

  public async registrar(
    item: ILicitacaoResultado,
    decisao: DecisaoParecer,
    justificativaBruta: string,
    responsavel: string
  ): Promise<IParecerLicitacao> {

    const justificativa = (justificativaBruta || '').trim();

    if (justificativa.length < TAMANHO_MINIMO_JUSTIFICATIVA) {
      throw new Error(
        `Escreva a justificativa com pelo menos ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres.`
      );
    }

    const sensivel = detectarDadoSensivel(justificativa);

    if (sensivel) {
      throw new Error(
        `A justificativa contém ${sensivel}. Remova esse dado antes de salvar: ` +
        'pela política da DGT (LGPD), CPF, CNPJ, senhas e dados bancários não podem ser gravados no portal.'
      );
    }

    const chaveEdital = gerarChaveEdital(item);
    const rotulo = ROTULO_DECISAO[decisao];
    const nome = `${rotulo} — ${item.orgao} ${item.numero}`.substring(0, 200);

    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(item.encerramento || '');
    const encerramento = m ? `${m[1]}T${m[2] || '00:00'}:00Z` : null;

    const dados: Record<string, unknown> = {
      [C.nome]: nome,
      [C.chaveEdital]: chaveEdital,
      [C.decisao]: decisao,
      [C.justificativa]: justificativa.substring(0, TAMANHO_MAXIMO_JUSTIFICATIVA),
      [C.orgao]: mascararDadosSensiveis(item.orgao).substring(0, 200),
      [C.local]: (item.local || '').substring(0, 200),
      [C.modalidade]: (item.modalidade || '').substring(0, 100),
      [C.numero]: mascararDadosSensiveis(item.numero || '').substring(0, 100),
      [C.objeto]: mascararDadosSensiveis(item.objeto || '').substring(0, 4000),
      [C.valorEstimado]: item.valor === undefined || isNaN(item.valor)
        ? null
        : Math.round(item.valor * 100) / 100,
      [C.encerramento]: encerramento,
      [C.aderencia]: Math.round(item.score),
      [C.responsavel]: (responsavel || '').substring(0, 200)
    };

    const id = await this.dataverse.criarRegistro(TABELA_PARECER, dados);

    return {
      id,
      chaveEdital,
      decisao,
      justificativa,
      orgao: item.orgao,
      local: item.local,
      modalidade: item.modalidade,
      numero: item.numero,
      objeto: item.objeto,
      valorEstimado: item.valor,
      encerramento: item.encerramento,
      score: item.score,
      responsavel: responsavel || 'Você',
      registradoEm: new Date().toISOString()
    };
  }
}

// Agrupa a lista (já ordenada do mais recente para o mais antigo)
// por edital.
export const agruparPorEdital = (
  pareceres: IParecerLicitacao[]
): { [chave: string]: ISituacaoParecer } => {

  const mapa: { [chave: string]: ISituacaoParecer } = {};

  pareceres.forEach(parecer => {
    const existente = mapa[parecer.chaveEdital];
    if (existente) {
      existente.historico.push(parecer);
    } else {
      mapa[parecer.chaveEdital] = { atual: parecer, historico: [parecer] };
    }
  });

  return mapa;
};
