import {
  IDadosEdital,
  IFiltrosLicitacao,
  ILicitacaoResultado,
  IRegistroPncp,
  MODALIDADES_PNCP
} from '../models/Licitacao';

// ============================================================
// MÓDULO LICITAÇÕES — REGRAS DE FILTRO E SCORE
//
// Port 1:1 das funções do Agente de Licitações V6 (Python):
//   normalizar_texto     → normalizarTexto
//   converter_float      → converterValor
//   obter_termos_assunto → obterTermosAssunto
//   atende_pre_filtro    → atendePreFiltro
//   calcular_score       → calcularScore
//   processar_registro   → processarRegistro
//
// Funções puras (sem React, sem fetch). Se a busca for movida
// para um backend (Azure Function), estas regras são as mesmas.
// ============================================================

const STOPWORDS: { [palavra: string]: boolean } = {
  a: true, o: true, as: true, os: true,
  de: true, da: true, do: true, das: true, dos: true,
  e: true, em: true, para: true, por: true, com: true,
  um: true, uma: true, na: true, no: true, nas: true, nos: true
};

export const normalizarTexto = (
  texto: unknown
): string => {

  if (texto === null || texto === undefined) {
    return '';
  }

  return String(texto)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const contem = (
  texto: string,
  trecho: string
): boolean =>
  texto.indexOf(trecho) >= 0;

// "1.500.000,00" → 1500000 · "R$ 250000" → 250000 · "" → undefined
export const converterValor = (
  valor: unknown
): number | undefined => {

  if (valor === null || valor === undefined) {
    return undefined;
  }

  if (typeof valor === 'number') {
    return isNaN(valor) ? undefined : valor;
  }

  let texto = String(valor)
    .replace('R$', '')
    .replace(/\s/g, '')
    .trim();

  if (!texto) {
    return undefined;
  }

  if (contem(texto, ',')) {
    texto = texto
      .replace(/\./g, '')
      .replace(',', '.');
  }

  const numero = parseFloat(texto);

  return isNaN(numero) ? undefined : numero;
};

export const limparListaPalavras = (
  texto: string
): string[] =>
  (texto || '')
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);

export const formatarMoeda = (
  valor?: number
): string => {

  if (valor === undefined || valor === null || isNaN(valor)) {
    return '-';
  }

  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

export const formatarDataPncp = (
  data?: string
): string => {

  if (!data) {
    return '-';
  }

  const partes = String(data).substring(0, 10).split('-');

  if (partes.length !== 3) {
    return String(data);
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

// "2026-10-14T08:00:00" → "14/10/2026 08:00"
export const formatarDataHoraPncp = (
  data?: string
): string => {

  if (!data) {
    return '-';
  }

  const texto = String(data);
  const dia = formatarDataPncp(texto);
  const hora = texto.length >= 16 ? texto.substring(11, 16) : '';

  return hora && hora !== '00:00' ? `${dia} ${hora}` : dia;
};

// Converte a data do PNCP (horário de Brasília, sem fuso) em Date.
export const converterDataPncp = (
  data?: string
): Date | undefined => {

  if (!data) {
    return undefined;
  }

  const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);

  if (!m) {
    return undefined;
  }

  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0
  );
};

// ------------------------------------------------------------
// Identificador PNCP: "<órgão>-1-<sequencial>/<ano>"
// Usado SOMENTE para montar endereços da API/portal do PNCP.
// O resultado nunca é exibido, registrado em log ou gravado.
// ------------------------------------------------------------
export interface IRefCompraPncp {
  orgao: string;
  ano: number;
  sequencial: number;
}

export const interpretarIdPncp = (
  idPncp?: string
): IRefCompraPncp | undefined => {

  if (!idPncp) {
    return undefined;
  }

  const m = String(idPncp).match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);

  if (!m) {
    return undefined;
  }

  return {
    orgao: m[1],
    sequencial: parseInt(m[2], 10),
    ano: parseInt(m[3], 10)
  };
};

// "20260930" para a API do PNCP
export const formatarDataApi = (
  data: Date
): string => {

  const ano = data.getFullYear();
  const mes = ('0' + (data.getMonth() + 1)).slice(-2);
  const dia = ('0' + data.getDate()).slice(-2);

  return `${ano}${mes}${dia}`;
};

export const obterTermosAssunto = (
  assunto: string
): string[] => {

  const palavras =
    normalizarTexto(assunto).match(/[a-z0-9]+/g) || [];

  return palavras.filter(
    palavra =>
      !STOPWORDS[palavra] &&
      palavra.length >= 3
  );
};

const obterObjeto = (
  registro: IRegistroPncp
): string =>
  registro.objetoCompra ||
  registro.objeto ||
  '';

export const atendePreFiltro = (
  registro: IRegistroPncp,
  filtros: IFiltrosLicitacao
): boolean => {

  const texto = normalizarTexto(obterObjeto(registro));
  const assuntoNormalizado = normalizarTexto(filtros.assunto);
  const termosAssunto = obterTermosAssunto(filtros.assunto);

  // MODO 1: assunto exato
  if (filtros.modoBusca === '1') {

    if (!contem(texto, assuntoNormalizado)) {
      return false;
    }

  } else {

    // MODO 2/3: termos do assunto (e relacionadas no modo 3)
    let encontrou = termosAssunto.some(
      termo => contem(texto, termo)
    );

    if (!encontrou && filtros.modoBusca === '3') {
      encontrou = filtros.palavrasRelacionadas.some(
        palavra => contem(texto, normalizarTexto(palavra))
      );
    }

    if (!encontrou) {
      return false;
    }
  }

  // Palavras obrigatórias
  for (const palavra of filtros.palavrasObrigatorias) {
    if (!contem(texto, normalizarTexto(palavra))) {
      return false;
    }
  }

  // Palavras negativas
  for (const palavra of filtros.palavrasNegativas) {
    if (contem(texto, normalizarTexto(palavra))) {
      return false;
    }
  }

  // Faixa de valor (registro sem valor não é descartado,
  // igual ao comportamento do script Python)
  const valor = converterValor(registro.valorTotalEstimado);

  if (
    filtros.valorMinimo !== undefined &&
    valor !== undefined &&
    valor < filtros.valorMinimo
  ) {
    return false;
  }

  if (
    filtros.valorMaximo !== undefined &&
    valor !== undefined &&
    valor > filtros.valorMaximo
  ) {
    return false;
  }

  return true;
};

export const calcularScore = (
  registro: IRegistroPncp,
  filtros: IFiltrosLicitacao
): { score: number; motivos: string[] } => {

  const texto = normalizarTexto(obterObjeto(registro));
  const motivos: string[] = [];
  let score = 0;

  if (contem(texto, normalizarTexto(filtros.assunto))) {
    score += 50;
    motivos.push(`Assunto exato: ${filtros.assunto}`);
  }

  for (const termo of obterTermosAssunto(filtros.assunto)) {
    if (contem(texto, termo)) {
      score += 10;
      motivos.push(`Termo do assunto: ${termo}`);
    }
  }

  for (const palavra of filtros.palavrasRelacionadas) {
    if (contem(texto, normalizarTexto(palavra))) {
      score += 15;
      motivos.push(`Relacionada: ${palavra}`);
    }
  }

  for (const palavra of filtros.palavrasObrigatorias) {
    if (contem(texto, normalizarTexto(palavra))) {
      score += 20;
      motivos.push(`Obrigatória: ${palavra}`);
    }
  }

  return {
    score: Math.min(score, 100),
    motivos
  };
};

const extrairOrgao = (
  registro: IRegistroPncp
): string => {

  const orgao = registro.orgaoEntidade;

  if (orgao && typeof orgao === 'object') {
    return orgao.razaoSocial || orgao.nome || '-';
  }

  return '-';
};

const extrairLocal = (
  registro: IRegistroPncp
): string => {

  const unidade = registro.unidadeOrgao || {};

  const municipio =
    unidade.municipioNome ||
    unidade.nomeMunicipio ||
    '';

  const uf =
    unidade.ufSigla ||
    unidade.uf ||
    '';

  if (municipio && uf) {
    return `${municipio}/${uf}`;
  }

  return municipio || uf || '-';
};

// O link usa o numeroControlePNCP só para abrir o edital no
// próprio PNCP. O valor não é exibido em nenhum lugar.
const gerarUrlPncp = (
  registro: IRegistroPncp
): string => {

  if (!registro.numeroControlePNCP) {
    return 'https://pncp.gov.br/app/editais';
  }

  // Link direto para a página do edital
  const ref = interpretarIdPncp(registro.numeroControlePNCP);

  if (ref) {
    return `https://pncp.gov.br/app/editais/${ref.orgao}/${ref.ano}/${ref.sequencial}`;
  }

  return (
    'https://pncp.gov.br/app/editais?q=' +
    encodeURIComponent(registro.numeroControlePNCP)
  );
};

// Número exibido: "123/2026" (sem o identificador PNCP, que
// contém o CNPJ do órgão).
const extrairNumero = (
  registro: IRegistroPncp
): string => {

  if (registro.numeroCompra && registro.anoCompra) {
    return `${registro.numeroCompra}/${registro.anoCompra}`;
  }

  return registro.numeroCompra || '-';
};

const ESFERAS: { [id: string]: string } = {
  F: 'Federal',
  E: 'Estadual',
  M: 'Municipal',
  D: 'Distrital',
  N: 'Não se aplica'
};

const PODERES: { [id: string]: string } = {
  E: 'Executivo',
  L: 'Legislativo',
  J: 'Judiciário',
  N: 'Não se aplica'
};

const textoOuUndefined = (
  valor: unknown
): string | undefined => {
  const texto = valor === undefined || valor === null ? '' : String(valor).trim();
  return texto ? texto : undefined;
};

export const extrairDadosEdital = (
  registro: IRegistroPncp
): IDadosEdital => {

  const orgao = registro.orgaoEntidade || {};
  const unidade = registro.unidadeOrgao || {};
  const amparo = registro.amparoLegal || {};

  return {
    processo: textoOuUndefined(registro.processo),
    informacaoComplementar: textoOuUndefined(registro.informacaoComplementar),
    modoDisputa: textoOuUndefined(registro.modoDisputaNome),
    instrumentoConvocatorio: textoOuUndefined(registro.tipoInstrumentoConvocatorioNome),
    situacao: textoOuUndefined(registro.situacaoCompraNome),
    srp: typeof registro.srp === 'boolean' ? registro.srp : undefined,
    amparoLegalNome: textoOuUndefined(amparo.nome),
    amparoLegalDescricao: textoOuUndefined(amparo.descricao),
    justificativaPresencial: textoOuUndefined(registro.justificativaPresencial),
    valorHomologado: converterValor(registro.valorTotalHomologado),
    unidadeCompradora: textoOuUndefined(unidade.nomeUnidade),
    codigoUnidade: textoOuUndefined(unidade.codigoUnidade),
    esfera: orgao.esferaId ? (ESFERAS[orgao.esferaId] || orgao.esferaId) : undefined,
    poder: orgao.poderId ? (PODERES[orgao.poderId] || orgao.poderId) : undefined,
    sistemaOrigem: textoOuUndefined(registro.usuarioNome),
    linkSistemaOrigem: textoOuUndefined(registro.linkSistemaOrigem),
    linkProcessoEletronico: textoOuUndefined(registro.linkProcessoEletronico),
    dataInclusao: textoOuUndefined(registro.dataInclusao),
    dataAtualizacao: textoOuUndefined(registro.dataAtualizacaoGlobal || registro.dataAtualizacao),
    fontesOrcamentarias: (registro.fontesOrcamentarias || [])
      .map(fonte => textoOuUndefined(fonte.nome || fonte.descricao))
      .filter((fonte): fonte is string => !!fonte)
  };
};

export const obterChaveRegistro = (
  registro: IRegistroPncp,
  modalidade: number
): string =>
  registro.numeroControlePNCP ||
  [
    modalidade,
    registro.numeroCompra,
    registro.dataPublicacaoPncp,
    registro.objetoCompra
  ].join('|');

export const processarRegistro = (
  registro: IRegistroPncp,
  modalidade: number,
  filtros: IFiltrosLicitacao,
  chave: string
): ILicitacaoResultado | undefined => {

  if (!atendePreFiltro(registro, filtros)) {
    return undefined;
  }

  const analise = calcularScore(registro, filtros);

  if (analise.score < filtros.scoreMinimo) {
    return undefined;
  }

  return {
    chave,
    score: analise.score,
    motivos: analise.motivos,
    numero: extrairNumero(registro),
    orgao: extrairOrgao(registro),
    local: extrairLocal(registro),
    modalidade:
      registro.modalidadeNome ||
      MODALIDADES_PNCP[modalidade] ||
      String(modalidade),
    objeto: obterObjeto(registro) || '-',
    valor: converterValor(registro.valorTotalEstimado),
    publicacao: registro.dataPublicacaoPncp,
    abertura: registro.dataAberturaProposta,
    encerramento: registro.dataEncerramentoProposta,
    url: gerarUrlPncp(registro),
    idPncp: registro.numeroControlePNCP,
    dados: extrairDadosEdital(registro)
  };
};
