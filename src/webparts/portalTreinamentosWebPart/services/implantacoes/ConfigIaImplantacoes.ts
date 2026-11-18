import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import type {
  RotaPainel
} from './PonteApiImplantacoes';

// ============================================================
// IMPLANTAÇÕES — "Configurar IA" do Assistente
//
// O administrador do módulo Implantações define o COMPORTAMENTO das
// respostas (tom, tamanho, formato). As regras fixas (usar só os
// dados do painel, consultas, glossário) ficam no código, em
// AssistenteImplantacoes.ts, e não podem ser trocadas aqui.
//
// Gravado em dgt_iaprompt com a chave própria "implantacoes.assistente"
// (a análise de Licitações usa outra chave e não é afetada). Cada
// "Salvar" cria uma NOVA versão ativa; as anteriores ficam guardadas.
// Sem tabela ou sem versão salva, vale o COMPORTAMENTO_PADRAO.
// ============================================================

export const CHAVE_CONFIG_IA_IMPLANTACOES = 'implantacoes.assistente';

const TABELA = 'dgt_iaprompt';

const C = {
  id: 'dgt_iapromptid',
  nome: 'dgt_name',
  chave: 'dgt_chave',
  versao: 'dgt_versao',
  ativo: 'dgt_ativo',
  comportamento: 'dgt_instrucoessistema',
  responsavel: 'dgt_responsavelnome'
};

export const LIMITE_COMPORTAMENTO = 4000;

// Público: diretoria — pouco tempo, quer o dado que responde.
export const COMPORTAMENTO_PADRAO_IMPLANTACOES = `Quem lê são diretores, com pouco tempo. Seja objetivo:
- Comece pela resposta direta à pergunta, em 1 ou 2 frases, já com o número principal.
- Depois, no máximo 5 tópicos curtos com os dados que sustentam a resposta (projeto, data, valor, situação). Sem introdução, sem repetir a pergunta, sem conclusões genéricas.
- NÃO reproduza em texto ou tabela os gráficos, indicadores e listas que o painel já mostra (carteira, curva S, físico x financeiro, cronograma): cite só o número que responde e, se ajudar, diga em qual tela do painel ver o detalhe.
- Tabela só quando a pergunta pedir uma lista ou comparação; no máximo 10 linhas, com as colunas essenciais.
- Até cerca de 150 palavras, salvo quando a pergunta pedir detalhamento.`;

export interface IConfigIaImplantacoes {
  comportamento: string;
  padrao: boolean;
  versao: number;
  responsavel: string;
  registradoEm: string;
  tabelaExiste: boolean;
}

const ehTabelaInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

const padrao = (tabelaExiste: boolean): IConfigIaImplantacoes => ({
  comportamento: COMPORTAMENTO_PADRAO_IMPLANTACOES,
  padrao: true,
  versao: 0,
  responsavel: '',
  registradoEm: '',
  tabelaExiste
});

export class ConfigIaImplantacoes {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  private async versoes(): Promise<IDataverseRecord[]> {
    return this.dataverse.listarRegistros(
      TABELA,
      `$select=${[C.id, C.versao, C.ativo, C.comportamento, C.responsavel, 'createdon'].join(',')}` +
      `&$filter=${C.chave} eq '${CHAVE_CONFIG_IA_IMPLANTACOES}'&$orderby=${C.versao} desc`
    );
  }

  // Comportamento em uso (versão ativa mais nova ou o padrão).
  public async obter(): Promise<IConfigIaImplantacoes> {
    try {
      const ativo = (await this.versoes()).find(r => r[C.ativo] === true);
      const texto = ativo ? String(ativo[C.comportamento] || '').trim() : '';
      if (!ativo || !texto) {
        return padrao(true);
      }
      return {
        comportamento: texto,
        padrao: false,
        versao: Number(ativo[C.versao]) || 0,
        responsavel: String(ativo[C.responsavel] || ''),
        registradoEm: String(ativo.createdon || ''),
        tabelaExiste: true
      };
    } catch (erro) {
      if (ehTabelaInexistente(erro)) {
        return padrao(false);
      }
      throw erro;
    }
  }

  // Nova versão ativa; desativa as anteriores (o histórico fica).
  public async salvar(comportamento: string, responsavel: string): Promise<IConfigIaImplantacoes> {
    const texto = String(comportamento || '').trim();
    if (!texto) {
      throw new Error('Descreva o comportamento da IA (ou use "Restaurar padrão").');
    }
    if (texto.length > LIMITE_COMPORTAMENTO) {
      throw new Error(`O comportamento passa de ${LIMITE_COMPORTAMENTO} caracteres: resuma as instruções.`);
    }

    const anteriores = await this.versoes();
    const versao = anteriores.reduce((maior, r) => Math.max(maior, Number(r[C.versao]) || 0), 0) + 1;

    await this.dataverse.criarRegistro(TABELA, {
      [C.nome]: `Assistente de Implantações v${versao}`,
      [C.chave]: CHAVE_CONFIG_IA_IMPLANTACOES,
      [C.versao]: versao,
      [C.ativo]: true,
      [C.comportamento]: texto,
      [C.responsavel]: (responsavel || '').substring(0, 200)
    });

    await Promise.all(
      anteriores
        .filter(r => r[C.ativo] === true && r[C.id])
        .map(r => this.dataverse.atualizarRegistro(TABELA, String(r[C.id]), { [C.ativo]: false }))
    );

    return {
      comportamento: texto,
      padrao: false,
      versao,
      responsavel,
      registradoEm: new Date().toISOString(),
      tabelaExiste: true
    };
  }

  // Rotas do painel: GET/POST "api/assistente/config".
  // Só o administrador do módulo Implantações (ou do portal).
  public rota(administra: boolean, responsavel: string): RotaPainel {
    return async (caminho: string, corpo: Record<string, unknown>): Promise<{ status: number; corpo: Record<string, unknown> } | undefined> => {
      if (caminho !== 'api/assistente/config') {
        return undefined;
      }
      if (!administra) {
        return { status: 403, corpo: { erro: 'Só o administrador do módulo Implantações configura a IA.' } };
      }
      try {
        if (corpo && (typeof corpo.comportamento === 'string' || corpo.restaurar === true)) {
          const texto = corpo.restaurar === true ? COMPORTAMENTO_PADRAO_IMPLANTACOES : String(corpo.comportamento);
          const salvo = await this.salvar(texto, responsavel);
          return { status: 200, corpo: { ...salvo, padraoTexto: COMPORTAMENTO_PADRAO_IMPLANTACOES } };
        }
        const atual = await this.obter();
        return { status: 200, corpo: { ...atual, padraoTexto: COMPORTAMENTO_PADRAO_IMPLANTACOES } };
      } catch (erro) {
        const m = erro instanceof Error ? erro.message : String(erro);
        if (/\b403\b|prv|privilege/i.test(m)) {
          return { status: 403, corpo: { erro: 'Sem permissão no Dataverse para gravar a configuração da IA (tabela "Prompt de IA").' } };
        }
        return { status: 400, corpo: { erro: m.substring(0, 400) } };
      }
    };
  }
}
