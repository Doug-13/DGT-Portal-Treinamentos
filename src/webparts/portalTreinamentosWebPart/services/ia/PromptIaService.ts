import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  IPromptIa
} from '../../models/LicitacaoIa';

import {
  FORMATO_RESPOSTA_IA
} from './provedoresIa';

// ============================================================
// PROMPTS DE IA (tabela dgt_iaprompt)
//
// Cada alteração grava uma NOVA VERSÃO (o registro anterior fica
// com Ativo = Não): assim cada análise guarda a versão de prompt
// que a gerou e é possível voltar atrás.
//
// Se a tabela ainda não existir (script pendente), é usado o
// PROMPT_PADRAO_LICITACOES abaixo.
//
// Variáveis aceitas no modelo do prompt:
//   {{contexto_empresa}} {{edital}} {{historico}}
//   {{estatisticas}} {{formato_resposta}}
// ============================================================

export const TABELA_PROMPT = 'dgt_iaprompt';

export const CHAVE_PROMPT_LICITACOES = 'licitacoes.analise';

const C = {
  id: 'dgt_iapromptid',
  nome: 'dgt_name',
  chave: 'dgt_chave',
  versao: 'dgt_versao',
  ativo: 'dgt_ativo',
  sistema: 'dgt_instrucoessistema',
  empresa: 'dgt_contextoempresa',
  modelo: 'dgt_modeloprompt',
  provedor: 'dgt_provedor',
  modeloIa: 'dgt_modeloia',
  temperatura: 'dgt_temperatura',
  maxTokens: 'dgt_maxtokens',
  qtdHistorico: 'dgt_qtdhistorico',
  automatica: 'dgt_analiseautomatica',
  observacoes: 'dgt_observacoes',
  responsavel: 'dgt_responsavelnome'
};

export const PROMPT_PADRAO_LICITACOES: IPromptIa = {
  chave: CHAVE_PROMPT_LICITACOES,
  nome: 'Análise de licitações (PNCP)',
  versao: 0,
  ativo: true,
  instrucoesSistema:
    'Você é analista de licitações públicas da DGT Tecnologia. Sua tarefa é avaliar se a DGT deve ' +
    'participar de um edital publicado no PNCP. Baseie-se no portfólio da empresa e, principalmente, ' +
    'nas decisões anteriores da DGT (histórico de pareceres), que representam o critério real da empresa. ' +
    'Seja objetivo, não invente informações que não estejam no edital e indique incertezas. ' +
    'A decisão final é sempre de uma pessoa: você apenas sugere.',
  contextoEmpresa:
    'Descreva aqui o portfólio da DGT (ex.: videomonitoramento, CFTV, controle de acesso, segurança pública, ' +
    'manutenção de sistemas), regiões de atuação, faixa de valor de interesse, modelos de contratação aceitos ' +
    '(compra, locação, comodato) e exigências que a DGT costuma não atender.',
  modeloPrompt:
    '## Sobre a DGT\n{{contexto_empresa}}\n\n' +
    '## Edital a analisar\n{{edital}}\n\n' +
    '## Decisões anteriores da DGT em editais parecidos (mais parecidos primeiro)\n{{historico}}\n\n' +
    '## Estatísticas do histórico\n{{estatisticas}}\n\n' +
    '## Tarefa\nRecomende se a DGT deve participar, explicando pontos favoráveis e riscos, ' +
    'e sugira um texto curto de justificativa para o parecer.\n\n{{formato_resposta}}',
  provedor: 'simulado',
  modeloIa: '',
  temperatura: 0.2,
  maxTokens: 3000,
  qtdHistorico: 15,
  analiseAutomatica: true,
  observacoes: 'Prompt padrão do portal (ainda não salvo no Dataverse).'
};

export { FORMATO_RESPOSTA_IA };

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v);
};

const numero = (r: IDataverseRecord, campo: string, padrao: number): number => {
  const v = Number(r[campo]);
  return r[campo] === null || r[campo] === undefined || isNaN(v) ? padrao : v;
};

const mapear = (r: IDataverseRecord): IPromptIa => ({
  id: texto(r, C.id).replace(/[{}]/g, '').toLowerCase(),
  chave: texto(r, C.chave),
  nome: texto(r, C.nome),
  versao: numero(r, C.versao, 1),
  ativo: r[C.ativo] !== false,
  instrucoesSistema: texto(r, C.sistema),
  contextoEmpresa: texto(r, C.empresa),
  modeloPrompt: texto(r, C.modelo),
  provedor: texto(r, C.provedor) === 'api' ? 'api' : 'simulado',
  modeloIa: texto(r, C.modeloIa),
  temperatura: numero(r, C.temperatura, 0.2),
  maxTokens: numero(r, C.maxTokens, 1200),
  qtdHistorico: numero(r, C.qtdHistorico, 15),
  analiseAutomatica: r[C.automatica] !== false,
  observacoes: texto(r, C.observacoes),
  responsavel: texto(r, C.responsavel) || texto(r, '_createdby_value@OData.Community.Display.V1.FormattedValue'),
  registradoEm: texto(r, 'createdon')
});

export const ehTabelaIaInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

export class PromptIaService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // Todas as versões (mais nova primeiro).
  public async listarVersoes(chave: string = CHAVE_PROMPT_LICITACOES): Promise<IPromptIa[]> {
    const registros = await this.dataverse.listarRegistros(
      TABELA_PROMPT,
      `$filter=${C.chave} eq '${chave.replace(/'/g, "''")}'&$orderby=${C.versao} desc`
    );
    return registros.map(mapear);
  }

  // Prompt em uso: a versão ativa mais nova; sem tabela/registro,
  // o padrão do portal.
  public async obterAtivo(
    chave: string = CHAVE_PROMPT_LICITACOES
  ): Promise<{ prompt: IPromptIa; salvoNoDataverse: boolean; tabelaExiste: boolean }> {
    try {
      const versoes = await this.listarVersoes(chave);
      const ativo = versoes.find(v => v.ativo);
      return ativo
        ? { prompt: ativo, salvoNoDataverse: true, tabelaExiste: true }
        : { prompt: PROMPT_PADRAO_LICITACOES, salvoNoDataverse: false, tabelaExiste: true };
    } catch (erro) {
      if (ehTabelaIaInexistente(erro)) {
        return { prompt: PROMPT_PADRAO_LICITACOES, salvoNoDataverse: false, tabelaExiste: false };
      }
      throw erro;
    }
  }

  // Grava uma NOVA versão ativa e desativa as anteriores.
  public async salvarNovaVersao(
    prompt: IPromptIa,
    responsavel: string
  ): Promise<IPromptIa> {

    if (!prompt.modeloPrompt.trim()) {
      throw new Error('O modelo do prompt não pode ficar vazio.');
    }
    if (prompt.modeloPrompt.indexOf('{{edital}}') < 0) {
      throw new Error('O modelo do prompt precisa conter {{edital}} (é onde entram os dados da licitação).');
    }

    const versoes = await this.listarVersoes(prompt.chave);
    const versao = versoes.reduce((maior, v) => Math.max(maior, v.versao), 0) + 1;

    const id = await this.dataverse.criarRegistro(
      TABELA_PROMPT,
      {
        [C.nome]: `${prompt.nome || 'Prompt'} v${versao}`.substring(0, 200),
        [C.chave]: prompt.chave,
        [C.versao]: versao,
        [C.ativo]: true,
        [C.sistema]: prompt.instrucoesSistema,
        [C.empresa]: prompt.contextoEmpresa,
        [C.modelo]: prompt.modeloPrompt,
        [C.provedor]: prompt.provedor,
        [C.modeloIa]: prompt.modeloIa,
        [C.temperatura]: prompt.temperatura,
        [C.maxTokens]: Math.round(prompt.maxTokens),
        [C.qtdHistorico]: Math.round(prompt.qtdHistorico),
        [C.automatica]: prompt.analiseAutomatica,
        [C.observacoes]: prompt.observacoes,
        [C.responsavel]: (responsavel || '').substring(0, 200)
      }
    );

    // Desativa as anteriores (o histórico continua guardado).
    await Promise.all(
      versoes
        .filter(v => v.ativo && v.id)
        .map(v => this.dataverse.atualizarRegistro(TABELA_PROMPT, v.id as string, { [C.ativo]: false }))
    );

    return { ...prompt, id, versao, ativo: true, responsavel, registradoEm: new Date().toISOString() };
  }
}
