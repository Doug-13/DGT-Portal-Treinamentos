import {
  DataverseService
} from '../DataverseService';

import {
  IAssistenteDashboard,
  IDefinicaoDashboard,
  IItemCartao,
  Linha,
  LIMITE_PERGUNTAS_SUGERIDAS,
  agregar,
  aplicarFiltro,
  fontesUsadas
} from './dashboardModelo';

import {
  CATALOGO_DASHBOARD
} from './fontesDashboard';

// ============================================================
// ASSISTENTE DE IA DOS DASHBOARDS
//
//   Portal ──(login Dataverse)──► Custom API dgt_PerguntarDashboardIa
//          ──► plugin PerguntarDashboardIaPlugin ──(chave)──► Claude
//
// ESCOPO FECHADO:
//  - o portal envia só o ID do dashboard, a pergunta e os DADOS que o
//    painel já carregou para quem está vendo (ano e áreas aplicados);
//  - o plugin lê o "escopo" no registro dgt_dashboard (o navegador
//    não consegue trocá-lo) e monta as instruções da IA;
//  - campos pessoais (nome, e-mail, responsável, CPF...) nunca saem
//    do portal; o plugin mascara CPF/CNPJ de novo;
//  - nada é gravado: a resposta só existe na tela enquanto ela estiver aberta.
// ============================================================

export const IA_CUSTOM_API_DASHBOARD = 'dgt_PerguntarDashboardIa';

// Tamanho máximo do contexto de dados (caracteres). O plugin aceita
// até 60.000; a margem fica para as instruções e o histórico.
const LIMITE_CONTEXTO = 45000;

// Campos sempre ocultos (dados pessoais), qualquer que seja a fonte.
const CAMPO_PESSOAL = /(responsavel|usuario|e-?mail|nome|cpf|cnpj|telefone|celular|matricula|autor|aprovador)/i;

export interface IMensagemAssistente {
  papel: 'usuario' | 'assistente';
  texto: string;
}

export interface IRespostaAssistente {
  texto: string;
  modelo?: string;
  tokensEntrada?: number;
  tokensSaida?: number;
  parada?: string;
}

export interface IFiltrosAssistente {
  ano?: number;
  areaNome?: string;
}

export const assistenteAtivo = (definicao: IDefinicaoDashboard): boolean =>
  !!definicao.assistente && definicao.assistente.ativo === true;

export const perguntasSugeridas = (assistente?: IAssistenteDashboard): string[] =>
  ((assistente && assistente.perguntasSugeridas) || [])
    .map(p => String(p || '').trim())
    .filter(Boolean)
    .slice(0, LIMITE_PERGUNTAS_SUGERIDAS);

// Fontes que a IA recebe: as declaradas no assistente (que precisam
// estar no painel) ou, sem declaração, todas as usadas no painel.
export const fontesDoAssistente = (definicao: IDefinicaoDashboard): string[] => {
  const usadas = fontesUsadas(definicao);
  const declaradas = definicao.assistente && definicao.assistente.fontes;
  return declaradas && declaradas.length > 0
    ? declaradas.filter(id => usadas.indexOf(id) >= 0)
    : usadas;
};

// ------------------------------------------------------------
// Montagem do contexto de dados
// ------------------------------------------------------------

interface ICampoVisivel {
  chave: string;
  rotulo: string;
  numerico: boolean;
}

const camposVisiveis = (fonteId: string, ocultos: string[]): ICampoVisivel[] => {
  const fonte = CATALOGO_DASHBOARD.filter(item => item.id === fonteId)[0];
  if (!fonte) {
    return [];
  }
  return fonte.campos
    .filter(campo => !CAMPO_PESSOAL.test(campo.chave) && ocultos.indexOf(campo.chave) < 0)
    .map(campo => ({ chave: campo.chave, rotulo: campo.rotulo, numerico: campo.tipo === 'numero' }));
};

const celula = (valor: unknown, numerico: boolean): string => {
  if (valor === null || valor === undefined || valor === '') {
    return '';
  }
  if (numerico) {
    const numero = Number(valor);
    return isFinite(numero) ? String(Math.round(numero * 100) / 100) : '';
  }
  // CSV com ponto e vírgula: tira separadores e quebras do texto.
  return String(valor).replace(/[;\r\n]+/g, ' ').trim();
};

const paraCsv = (linhas: Linha[], campos: ICampoVisivel[]): string =>
  [campos.map(c => c.chave).join(';')]
    .concat(linhas.map(linha => campos.map(c => celula(linha[c.chave], c.numerico)).join(';')))
    .join('\n');

// Soma os campos numéricos agrupando pelos de texto (sem "mes").
const resumirSemMes = (linhas: Linha[], campos: ICampoVisivel[]): { linhas: Linha[]; campos: ICampoVisivel[] } => {
  const dimensoes = campos.filter(c => !c.numerico && c.chave !== 'mes');
  const medidas = campos.filter(c => c.numerico);
  const mapa: { [chave: string]: Linha } = {};
  const ordem: string[] = [];
  linhas.forEach(linha => {
    const chave = dimensoes.map(d => String(linha[d.chave] === undefined ? '' : linha[d.chave])).join('¦');
    if (!mapa[chave]) {
      const nova: Linha = {};
      dimensoes.forEach(d => { nova[d.chave] = linha[d.chave]; });
      medidas.forEach(m => { nova[m.chave] = 0; });
      mapa[chave] = nova;
      ordem.push(chave);
    }
    medidas.forEach(m => {
      const numero = Number(linha[m.chave]);
      if (isFinite(numero)) {
        mapa[chave][m.chave] = Number(mapa[chave][m.chave]) + numero;
      }
    });
  });
  return { linhas: ordem.map(chave => mapa[chave]), campos: dimensoes.concat(medidas) };
};

// Valores dos cartões como aparecem no painel (a IA usa como
// referência e não precisa recalcular).
const resumoCartoes = (definicao: IDefinicaoDashboard, dados: { [fonte: string]: Linha[] }, fontes: string[]): string => {
  const linhas: string[] = [];
  definicao.secoes.forEach(secao => secao.itens.forEach(item => {
    if (item.tipo !== 'cartao' || fontes.indexOf(item.fonte) < 0) {
      return;
    }
    const cartao = item as IItemCartao;
    const filtradas = aplicarFiltro(dados[cartao.fonte] || [], cartao.filtro);
    const valor = agregar(filtradas, { medida: cartao.medida, agregacao: cartao.agregacao });
    let texto = `- ${secao.titulo} › ${cartao.titulo}: ${Math.round(valor * 100) / 100}`;
    if (cartao.comparar) {
      const referencia = agregar(filtradas, cartao.comparar);
      texto += ` (${cartao.comparar.rotulo || cartao.comparar.medida}: ${Math.round(referencia * 100) / 100})`;
    }
    linhas.push(texto);
  }));
  return linhas.join('\n');
};

export interface IContextoMontado {
  texto: string;
  fontes: string[];
  linhasEnviadas: number;
  resumido: boolean;
  cortado: boolean;
}

export const montarContextoDados = (
  definicao: IDefinicaoDashboard,
  dados: { [fonte: string]: Linha[] },
  filtros: IFiltrosAssistente
): IContextoMontado => {

  const fontes = fontesDoAssistente(definicao);
  const ocultos = (definicao.assistente && definicao.assistente.camposOcultos) || [];
  const partes: string[] = [];
  let linhasEnviadas = 0;
  let resumido = false;
  let cortado = false;

  partes.push(`Painel: ${definicao.titulo}`);
  partes.push(`Filtros aplicados: ano ${filtros.ano || '(todos)'} · área ${filtros.areaNome || 'todas as áreas que a pessoa pode ver'}`);
  partes.push('Valores monetários em reais (R$). Meses numerados de 1 a 12.');

  const cartoes = resumoCartoes(definicao, dados, fontes);
  if (cartoes) {
    partes.push(`\nINDICADORES EXIBIDOS NO PAINEL:\n${cartoes}`);
  }

  // As fontes menores entram primeiro; o que sobrar do limite vai para
  // as maiores (que podem ser somadas no ano ou cortadas).
  const preparadas = fontes
    .map(fonteId => {
      const descricao = CATALOGO_DASHBOARD.filter(item => item.id === fonteId)[0];
      const campos = camposVisiveis(fonteId, ocultos);
      const linhas = dados[fonteId] || [];
      return { fonteId, descricao, campos, linhas, tamanho: descricao && campos.length > 0 ? paraCsv(linhas, campos).length : 0 };
    })
    .filter(item => item.descricao && item.campos.length > 0)
    .sort((a, b) => a.tamanho - b.tamanho);

  let disponivel = LIMITE_CONTEXTO - partes.join('\n').length;
  const blocos: { [fonte: string]: string } = {};

  preparadas.forEach((item, indice) => {
    const orcamento = Math.max(2000, Math.floor(disponivel / (preparadas.length - indice)));
    let campos = item.campos;
    let linhas = item.linhas;
    let csv = paraCsv(linhas, campos);
    let observacao = '';

    if (csv.length > orcamento && campos.some(c => c.chave === 'mes')) {
      const resumo = resumirSemMes(linhas, campos);
      linhas = resumo.linhas;
      campos = resumo.campos;
      csv = paraCsv(linhas, campos);
      observacao = ' (valores somados no ano: o detalhe mensal não coube no limite)';
      resumido = true;
    }

    if (csv.length > orcamento) {
      const corte = csv.lastIndexOf('\n', orcamento);
      csv = csv.substring(0, corte > 0 ? corte : orcamento);
      const enviadas = Math.max(0, csv.split('\n').length - 1);
      observacao += ` (só as primeiras ${enviadas} de ${linhas.length} linhas couberam no limite)`;
      linhasEnviadas += enviadas;
      cortado = true;
    } else {
      linhasEnviadas += linhas.length;
    }

    const legenda = campos.map(c => `${c.chave} = ${c.rotulo}`).join('; ');
    const bloco = `\nFONTE ${item.fonteId} — ${item.descricao ? item.descricao.nome : item.fonteId}${observacao}\nColunas: ${legenda}\n${csv}`;
    blocos[item.fonteId] = bloco;
    disponivel -= bloco.length;
  });

  // Mantém a ordem das fontes do painel no texto final.
  fontes.forEach(fonteId => {
    if (blocos[fonteId]) {
      partes.push(blocos[fonteId]);
    }
  });

  return { texto: partes.join('\n'), fontes, linhasEnviadas, resumido, cortado };
};

// ------------------------------------------------------------
// Chamada à Custom API
// ------------------------------------------------------------

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
  if (/\b404\b|not found|Resource not found|0x80060888|Could not find/i.test(mensagem)) {
    return `A Custom API ${IA_CUSTOM_API_DASHBOARD} ainda não existe no Dataverse (rode o script criar-ia-dashboards.ps1).`;
  }
  if (/\b403\b|prv|privilege/i.test(mensagem)) {
    return 'Sem permissão para usar a IA dos dashboards (é preciso Ler em "Dashboard").';
  }
  return mensagem.substring(0, 400);
};

export const perguntarAoDashboard = async (
  dataverse: DataverseService,
  entrada: {
    dashboardId: string;
    pergunta: string;
    contexto: IContextoMontado;
    historico: IMensagemAssistente[];
    modelo?: string;
    // Área filtrada no painel: é a área do consumo (regra a).
    areaId?: string;
  }
): Promise<IRespostaAssistente> => {
  try {
    return await dataverse.perguntarDashboardIa({
      dashboardId: entrada.dashboardId,
      pergunta: entrada.pergunta.trim().substring(0, 1000),
      dados: entrada.contexto.texto,
      // Só as últimas trocas, para manter o assunto sem estourar o limite.
      historico: entrada.historico.slice(-6).map(m => ({ papel: m.papel, texto: m.texto.substring(0, 2000) })),
      modelo: entrada.modelo,
      areaId: entrada.areaId || undefined
    });
  } catch (erro) {
    throw new Error(mensagemDeErro(erro));
  }
};
