import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  ILicitacaoResultado,
  IParecerLicitacao
} from '../../models/Licitacao';

import {
  IAnaliseIaLicitacao,
  IEntradaAnaliseIa,
  IExemploHistorico,
  IPromptIa,
  RecomendacaoIa
} from '../../models/LicitacaoIa';

import {
  gerarChaveEdital,
  mascararDadosSensiveis
} from '../LicitacaoParecerService';

import {
  formatarMoeda,
  normalizarTexto
} from '../../utils/licitacoesFiltro';

import {
  FORMATO_RESPOSTA_IA,
  IProvedorIa
} from './provedoresIa';

import {
  ehTabelaIaInexistente
} from './PromptIaService';

// ============================================================
// LICITAÇÕES — ANÁLISE POR IA
//
// 1) Monta a entrada: dados do edital (SEM CNPJ e SEM link do PNCP)
//    + os pareceres da DGT mais PARECIDOS (o histórico é a base de
//    conhecimento da IA) + estatísticas.
// 2) Preenche o prompt configurado ({{variaveis}}).
// 3) Chama o provedor (simulado agora; API quando for ligada).
// 4) Guarda a análise em dgt_licitacaoanaliseia (cache): numa nova
//    busca, o mesmo edital não é analisado de novo.
// ============================================================

export const TABELA_ANALISE_IA = 'dgt_licitacaoanaliseia';

const C = {
  id: 'dgt_licitacaoanaliseiaid',
  nome: 'dgt_name',
  chave: 'dgt_chaveedital',
  recomendacao: 'dgt_recomendacao',
  confianca: 'dgt_confianca',
  resumo: 'dgt_resumo',
  json: 'dgt_respostajson',
  provedor: 'dgt_provedor',
  modeloIa: 'dgt_modeloia',
  promptVersao: 'dgt_promptversao',
  orgao: 'dgt_orgao',
  objeto: 'dgt_objeto'
};

// Palavras que não ajudam a comparar objetos de editais.
const IRRELEVANTES = new Set(
  ('a o e de da do das dos em para com por no na nos nas um uma ao aos as os que ' +
    'contratacao empresa especializada prestacao servicos servico fornecimento aquisicao ' +
    'municipio municipal prefeitura secretaria registro preco precos objeto lote item itens ' +
    'eventual futura conforme edital termo referencia anexo junto locais vinculados').split(' ')
);

const tokens = (texto: string): Set<string> =>
  new Set(
    normalizarTexto(texto)
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(' ')
      .filter(p => p.length > 2 && !IRRELEVANTES.has(p))
  );

// Semelhança de Jaccard entre dois conjuntos (0–1).
const semelhanca = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let comum = 0;
  a.forEach(p => { if (b.has(p)) { comum++; } });
  return comum / (a.size + b.size - comum);
};

const preencher = (modelo: string, valores: Record<string, string>): string =>
  modelo.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (inteiro, nome: string) =>
    Object.prototype.hasOwnProperty.call(valores, nome) ? valores[nome] : inteiro);

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v);
};

export class LicitacaoAnaliseIaService {

  private readonly dataverse?: DataverseService;

  // false = tabela de cache ainda não criada (análises só em memória).
  private cacheDisponivel = true;

  public constructor(dataverse?: DataverseService) {
    this.dataverse = dataverse;
  }

  public get temCache(): boolean {
    return this.cacheDisponivel && !!this.dataverse;
  }

  // ----------------------------------------------------------
  // Entrada (o que vai para a IA)
  // ----------------------------------------------------------

  public montarEntrada(
    item: ILicitacaoResultado,
    prompt: IPromptIa,
    pareceresAtuais: IParecerLicitacao[]
  ): IEntradaAnaliseIa {

    const alvo = tokens(`${item.objeto} ${item.modalidade}`);

    const historico: IExemploHistorico[] = pareceresAtuais
      .map(p => ({
        decisao: p.decisao,
        orgao: p.orgao,
        local: p.local,
        modalidade: p.modalidade,
        objeto: mascararDadosSensiveis(p.objeto).substring(0, 600),
        valorEstimado: p.valorEstimado,
        justificativa: p.justificativa.substring(0, 600),
        data: p.registradoEm,
        semelhanca: Math.round(semelhanca(alvo, tokens(`${p.objeto} ${p.modalidade}`)) * 100) / 100
      }))
      .filter(h => h.semelhanca > 0)
      .sort((a, b) => b.semelhanca - a.semelhanca)
      .slice(0, Math.max(1, prompt.qtdHistorico));

    const estatisticas = {
      totalPareceres: pareceresAtuais.length,
      participar: pareceresAtuais.filter(p => p.decisao === 'Participar').length,
      naoParticipar: pareceresAtuais.filter(p => p.decisao === 'NaoParticipar').length
    };

    const edital = {
      orgao: mascararDadosSensiveis(item.orgao),
      local: item.local,
      modalidade: item.modalidade,
      numero: mascararDadosSensiveis(item.numero),
      objeto: mascararDadosSensiveis(item.objeto).substring(0, 4000),
      valorEstimado: item.valor,
      publicacao: item.publicacao,
      encerramento: item.encerramento,
      aderenciaBusca: item.score,
      criteriosBusca: item.motivos
    };

    const textoEdital = [
      `Órgão: ${edital.orgao}`,
      `Local: ${edital.local}`,
      `Modalidade: ${edital.modalidade}`,
      `Número: ${edital.numero}`,
      `Valor estimado: ${formatarMoeda(edital.valorEstimado)}`,
      `Publicação: ${edital.publicacao || '-'} · Encerramento das propostas: ${edital.encerramento || '-'}`,
      `Aderência aos critérios da busca: ${edital.aderenciaBusca}% (${edital.criteriosBusca.join('; ') || '-'})`,
      `Objeto: ${edital.objeto}`
    ].join('\n');

    const textoHistorico = historico.length === 0
      ? 'Nenhum parecer anterior parecido.'
      : historico.map((h, i) =>
        `${i + 1}. [${h.decisao === 'Participar' ? 'PARTICIPOU' : 'NÃO PARTICIPOU'}] ` +
        `(semelhança ${Math.round(h.semelhanca * 100)}%) ${h.orgao} — ${h.local} — ${h.modalidade}` +
        `${h.valorEstimado !== undefined ? ` — ${formatarMoeda(h.valorEstimado)}` : ''}\n` +
        `   Objeto: ${h.objeto}\n   Justificativa da DGT: ${h.justificativa}`
      ).join('\n');

    const textoEstatisticas =
      `${estatisticas.totalPareceres} edital(is) com parecer: ${estatisticas.participar} "Participar" e ` +
      `${estatisticas.naoParticipar} "Não participar".`;

    const mensagem = preencher(prompt.modeloPrompt, {
      contexto_empresa: prompt.contextoEmpresa,
      edital: textoEdital,
      historico: textoHistorico,
      estatisticas: textoEstatisticas,
      formato_resposta: FORMATO_RESPOSTA_IA
    });

    return {
      edital,
      historico,
      estatisticas,
      sistema: prompt.instrucoesSistema,
      mensagem,
      prompt
    };
  }

  // ----------------------------------------------------------
  // Análise
  // ----------------------------------------------------------

  public async analisar(
    item: ILicitacaoResultado,
    prompt: IPromptIa,
    pareceresAtuais: IParecerLicitacao[],
    provedor: IProvedorIa
  ): Promise<IAnaliseIaLicitacao> {

    const entrada = this.montarEntrada(item, prompt, pareceresAtuais);
    const parcial = await provedor.analisar(entrada);

    const analise: IAnaliseIaLicitacao = {
      ...parcial,
      chaveEdital: gerarChaveEdital(item),
      geradaEm: new Date().toISOString()
    };

    await this.salvar(analise, item).catch(erro => {
      console.warn('[IA Licitações] Análise não foi guardada no cache:', erro);
    });

    return analise;
  }

  // ----------------------------------------------------------
  // Cache (dgt_licitacaoanaliseia)
  // ----------------------------------------------------------

  // { chaveEdital → análise mais recente }
  public async listarCache(): Promise<Record<string, IAnaliseIaLicitacao>> {

    const mapa: Record<string, IAnaliseIaLicitacao> = {};

    if (!this.dataverse || !this.cacheDisponivel) {
      return mapa;
    }

    try {
      const registros = await this.dataverse.listarRegistros(
        TABELA_ANALISE_IA,
        '$select=' + [C.id, C.chave, C.recomendacao, C.confianca, C.resumo, C.json, C.provedor, C.modeloIa, C.promptVersao, 'createdon'].join(',') +
        '&$filter=statecode eq 0&$orderby=createdon desc'
      );

      registros.forEach(r => {
        const chave = texto(r, C.chave);
        if (!chave || mapa[chave]) {
          return;
        }
        let detalhes: Partial<IAnaliseIaLicitacao> = {};
        try {
          detalhes = JSON.parse(texto(r, C.json) || '{}') as Partial<IAnaliseIaLicitacao>;
        } catch {
          detalhes = {};
        }
        mapa[chave] = {
          id: texto(r, C.id),
          chaveEdital: chave,
          recomendacao: (texto(r, C.recomendacao) || 'Avaliar') as RecomendacaoIa,
          confianca: Number(r[C.confianca]) || 0,
          resumo: texto(r, C.resumo),
          pontosFavoraveis: detalhes.pontosFavoraveis || [],
          riscos: detalhes.riscos || [],
          justificativaSugerida: detalhes.justificativaSugerida || '',
          semelhantes: detalhes.semelhantes || [],
          provedor: texto(r, C.provedor) === 'api' ? 'api' : 'simulado',
          modeloIa: texto(r, C.modeloIa),
          promptVersao: Number(r[C.promptVersao]) || 0,
          geradaEm: texto(r, 'createdon')
        };
      });
    } catch (erro) {
      if (ehTabelaIaInexistente(erro)) {
        this.cacheDisponivel = false;
      } else {
        throw erro;
      }
    }

    return mapa;
  }

  private async salvar(
    analise: IAnaliseIaLicitacao,
    item: ILicitacaoResultado
  ): Promise<void> {

    if (!this.dataverse || !this.cacheDisponivel) {
      return;
    }

    try {
      await this.dataverse.criarRegistro(
        TABELA_ANALISE_IA,
        {
          [C.nome]: `IA — ${mascararDadosSensiveis(item.orgao)} ${mascararDadosSensiveis(item.numero)}`.substring(0, 200),
          [C.chave]: analise.chaveEdital,
          [C.recomendacao]: analise.recomendacao,
          [C.confianca]: analise.confianca,
          [C.resumo]: analise.resumo.substring(0, 4000),
          [C.json]: JSON.stringify({
            pontosFavoraveis: analise.pontosFavoraveis,
            riscos: analise.riscos,
            justificativaSugerida: analise.justificativaSugerida,
            semelhantes: analise.semelhantes
          }).substring(0, 100000),
          [C.provedor]: analise.provedor,
          [C.modeloIa]: (analise.modeloIa || '').substring(0, 200),
          [C.promptVersao]: analise.promptVersao,
          [C.orgao]: mascararDadosSensiveis(item.orgao).substring(0, 200),
          [C.objeto]: mascararDadosSensiveis(item.objeto).substring(0, 4000)
        }
      );
    } catch (erro) {
      if (ehTabelaIaInexistente(erro)) {
        this.cacheDisponivel = false;
        return;
      }
      throw erro;
    }
  }
}
