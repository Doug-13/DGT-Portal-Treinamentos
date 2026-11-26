import {
  DataverseService
} from '../DataverseService';

import {
  IDefinicaoDashboard,
  IDescricaoFonte,
  validarDashboard
} from './dashboardModelo';

import {
  CATALOGO_DASHBOARD,
  carregarFonte
} from './fontesDashboard';

import {
  areasDaFonte
} from './acessoFontes';

import {
  ChaveModuloPortal,
  modulosEfetivos
} from '../../utils/modulosPortal';

// ============================================================
// CRIAÇÃO DE DASHBOARDS COM IA (Indicadores › ✦ Criar com IA)
//
//   Portal ──► Custom API dgt_GerarDashboardIa ──► plugin ──► Claude
//
//  - a IA recebe só o pedido e a DESCRIÇÃO das fontes que o usuário
//    pode usar (nunca dados de registros);
//  - a definição devolvida é validada aqui com o MESMO catálogo
//    filtrado: fonte fora das permissões é recusada mesmo que a IA a
//    invente; havendo erro, os erros voltam à IA (até 2 correções);
//  - os dados do painel continuam protegidos pelas fontes (áreas que a
//    pessoa pode ver) e pelos perfis de segurança do Dataverse.
// ============================================================

export const IA_API_GERAR_DASHBOARD = 'dgt_GerarDashboardIa';

const MAX_CORRECOES = 2;

export interface IAcessoCriacao {
  perfil?: string;
  modulosPermitidos?: ChaveModuloPortal[];
  // Administrador, ou administra o módulo Indicadores.
  veTodasAsAreas: boolean;
}

// Fonte → o que é preciso para usá-la.
// Fontes "sem área" (fornecedores, projetos) só trazem dados para quem
// vê todas as áreas: para os demais o painel sairia vazio.
const REGRAS: Array<{ prefixo: string; permitido: (acesso: IAcessoCriacao, modulos: ChaveModuloPortal[]) => boolean }> = [
  { prefixo: 'orcamento.', permitido: (_a, m) => m.indexOf('orcamento') >= 0 },
  { prefixo: 'documentos.', permitido: (_a, m) => m.indexOf('documentos') >= 0 },
  { prefixo: 'treinamentos.', permitido: (_a, m) => m.indexOf('treinamentos') >= 0 },
  // Módulos de ambiente (amb:<id>) são registrados ao carregar o portal.
  { prefixo: 'ambientes.', permitido: (a, m) => a.veTodasAsAreas || m.some(chave => String(chave).indexOf('amb:') === 0) },
  { prefixo: 'licitacoes.', permitido: (_a, m) => m.indexOf('licitacoes') >= 0 },
  { prefixo: 'fornecedores.', permitido: (a, m) => a.veTodasAsAreas && m.indexOf('fornecedores') >= 0 },
  { prefixo: 'projetos.', permitido: a => a.veTodasAsAreas },
  { prefixo: 'ia.', permitido: a => (a.perfil || '').toLowerCase() === 'administrador' }
];

export const fontesPermitidas = (acesso: IAcessoCriacao, catalogo: IDescricaoFonte[] = CATALOGO_DASHBOARD): IDescricaoFonte[] => {
  const modulos = modulosEfetivos(acesso.perfil, acesso.modulosPermitidos);
  return catalogo.filter(fonte => {
    const regra = REGRAS.filter(item => fonte.id.indexOf(item.prefixo) === 0)[0];
    // Fonte nova sem regra: só para quem vê todas as áreas.
    return regra ? regra.permitido(acesso, modulos) : acesso.veTodasAsAreas;
  });
};

// A IA não montou painel porque nada do pedido existe nas fontes do
// usuário: resposta legítima, mostrada como explicação (não como erro).
export class SemPainelPossivel extends Error {
  public readonly resumo: string;
  public readonly semDados: string[];

  constructor(resumo: string, semDados: string[]) {
    super(resumo || 'Não há dados no portal para montar esse painel.');
    this.name = 'SemPainelPossivel';
    this.resumo = resumo;
    this.semDados = semDados;
    Object.setPrototypeOf(this, SemPainelPossivel.prototype);
  }
}

// ------------------------------------------------------------
// Valores existentes dos campos de referência (listarValores)
// ------------------------------------------------------------
// Ex.: contas e subcontas do orçamento ("RECEITA DE LOCAÇÃO"), tipos de
// documento, treinamentos. Só NOMES (nunca números), carregados com as
// mesmas regras de área dos painéis: a IA só conhece o que a pessoa vê.

const MAX_VALORES_POR_CAMPO = 400;
const MAX_TAMANHO_VALOR = 90;
const MAX_CARACTERES_VALORES = 45000;

export interface IAcessoDados {
  ano: number;
  areasPermitidas?: string[];
  modulosAdministrados?: string[];
}

export const incluirValoresExistentes = async (
  dataverse: DataverseService,
  catalogo: IDescricaoFonte[],
  acesso: IAcessoDados
): Promise<IDescricaoFonte[]> => {
  let restante = MAX_CARACTERES_VALORES;
  const resultado: IDescricaoFonte[] = [];
  for (const fonte of catalogo) {
    const campos = fonte.campos.filter(campo => campo.listarValores);
    if (campos.length === 0 || restante <= 0) {
      resultado.push(fonte);
      continue;
    }
    const linhas: Array<Record<string, unknown>> = [];
    // Ano atual e o seguinte (o orçamento é planejado para o próximo ano).
    for (const ano of [acesso.ano, acesso.ano + 1]) {
      try {
        const lidas = await carregarFonte(fonte.id, {
          dataverse,
          ano,
          areaIds: areasDaFonte(fonte.id, '', acesso.areasPermitidas, acesso.modulosAdministrados)
        });
        lidas.forEach(linha => linhas.push(linha));
      } catch {
        // Sem acesso ou fonte indisponível: a IA segue sem os valores.
      }
    }
    resultado.push({
      ...fonte,
      campos: fonte.campos.map(campo => {
        if (!campo.listarValores || restante <= 0) {
          return campo;
        }
        const vistos: string[] = [];
        linhas.forEach(linha => {
          const valor = linha[campo.chave];
          const texto = valor === undefined || valor === null ? '' : String(valor).trim().substring(0, MAX_TAMANHO_VALOR);
          if (texto && vistos.indexOf(texto) < 0) {
            vistos.push(texto);
          }
        });
        const valores = vistos.sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, MAX_VALORES_POR_CAMPO);
        const cabem: string[] = [];
        valores.forEach(valor => {
          if (restante - valor.length - 3 > 0) {
            cabem.push(valor);
            restante -= valor.length + 3;
          }
        });
        return cabem.length > 0 ? { ...campo, valoresExistentes: cabem } : campo;
      })
    });
  }
  return resultado;
};

export interface IResultadoCriacao {
  definicao: IDefinicaoDashboard;
  texto: string;
  resumo: string;
  semDados: string[];
  // Quantas vezes a IA precisou corrigir a própria definição.
  correcoes: number;
}

export interface IPedidoCriacao {
  pedido: string;
  catalogo: IDescricaoFonte[];
  // Ajuste de um painel existente (definição atual em JSON).
  painelAtual?: string;
}

interface IRespostaApi {
  resumo?: string;
  semDados?: string[];
  definicao?: string;
}

const mensagemDeErro = (erro: unknown): string => {
  const bruto = erro instanceof Error ? erro.message : String(erro);
  let mensagem = bruto;
  const json = /\{[\s\S]*\}/.exec(bruto);
  if (json) {
    try {
      const dados = JSON.parse(json[0]) as { error?: { message?: string } };
      if (dados.error && dados.error.message) {
        mensagem = dados.error.message;
      }
    } catch {
      mensagem = bruto;
    }
  }
  if (/\b404\b|Resource not found|0x80060888|Could not find/i.test(mensagem)) {
    return `A criação com IA ainda não foi ativada no Dataverse (Custom API ${IA_API_GERAR_DASHBOARD}: rode criar-ia-criacao-dashboards.ps1).`;
  }
  if (/\b403\b|prv|privilege/i.test(mensagem)) {
    return 'Sem permissão para criar dashboards (é preciso Criar em "Dashboard" no perfil de segurança).';
  }
  return mensagem.substring(0, 400);
};

const chamar = async (dataverse: DataverseService, payload: Record<string, unknown>): Promise<IRespostaApi> => {
  let resultado: Record<string, unknown>;
  try {
    resultado = await dataverse.executarCustomApiJson(IA_API_GERAR_DASHBOARD, payload);
  } catch (erro) {
    throw new Error(mensagemDeErro(erro));
  }
  if (Object.keys(resultado).length === 0) {
    throw new Error('A IA não respondeu: o passo do plugin GerarDashboardIaPlugin não está registrado, está desativado ou é assíncrono. Rode scripts/dataverse/diagnosticar-ia.ps1.');
  }
  return resultado as IRespostaApi;
};

export const gerarDashboard = async (dataverse: DataverseService, entrada: IPedidoCriacao): Promise<IResultadoCriacao> => {
  if (entrada.catalogo.length === 0) {
    throw new Error('Você não tem acesso a nenhuma fonte de dados para criar dashboards.');
  }
  const base = {
    pedido: entrada.pedido.trim().substring(0, 2000),
    catalogo: entrada.catalogo
  };

  let resposta = await chamar(dataverse, { ...base, painelAtual: entrada.painelAtual || undefined });
  let correcoes = 0;

  for (;;) {
    const texto = String(resposta.definicao || '');
    if (!texto.trim()) {
      throw new SemPainelPossivel(
        String(resposta.resumo || ''),
        (resposta.semDados || []).map(item => String(item)).filter(Boolean)
      );
    }
    // Mesmo catálogo FILTRADO: fonte fora das permissões é erro.
    const validacao = validarDashboard(texto, entrada.catalogo);
    // A IA não recebe dados: não pode embutir dados no painel (inventaria).
    if (/"fontesEmbutidas"\s*:/.test(texto)) {
      validacao.definicao = undefined;
      validacao.erros.unshift('Não use "fontesEmbutidas": use só as fontes do catálogo recebido.');
    }
    if (validacao.definicao) {
      return {
        definicao: validacao.definicao,
        texto: JSON.stringify(validacao.definicao, null, 2),
        resumo: String(resposta.resumo || ''),
        semDados: (resposta.semDados || []).map(item => String(item)).filter(Boolean),
        correcoes
      };
    }
    if (correcoes >= MAX_CORRECOES) {
      throw new Error(`A IA não conseguiu montar um painel válido. Tente descrever de outro jeito.\n${validacao.erros.slice(0, 5).join('\n')}`);
    }
    correcoes += 1;
    resposta = await chamar(dataverse, {
      ...base,
      painelAtual: texto,
      erros: validacao.erros.slice(0, 30)
    });
  }
};
