// ============================================================
// LICITAÇÕES — ANÁLISE POR IA (tipos)
//
//   IPromptIa            configuração do prompt (tabela dgt_iaprompt)
//   IEntradaAnaliseIa    o que é enviado à IA (sem CNPJ / sem link)
//   IAnaliseIaLicitacao  resposta normalizada (cache dgt_licitacaoanaliseia)
// ============================================================

export type RecomendacaoIa =
  | 'Participar'
  | 'NaoParticipar'
  | 'Avaliar';

export const ROTULO_RECOMENDACAO_IA: { [r: string]: string } = {
  Participar: 'Participar',
  NaoParticipar: 'Não participar',
  Avaliar: 'Avaliar com cuidado'
};

// 'simulado' = análise local (regras + histórico), sem custo e sem
// enviar dados para fora — usado enquanto a API não é ligada.
// 'api'      = chama o serviço de IA (ver services/ia/provedoresIa.ts).
export type TipoProvedorIa = 'simulado' | 'api';

export interface IPromptIa {
  id?: string;
  chave: string;              // ex.: 'licitacoes.analise'
  nome: string;
  versao: number;
  ativo: boolean;
  instrucoesSistema: string;  // papel da IA e regras gerais
  contextoEmpresa: string;    // portfólio, regiões, valores mínimos…
  modeloPrompt: string;       // texto com {{variaveis}}
  provedor: TipoProvedorIa;
  modeloIa: string;           // ex.: nome do modelo no serviço de IA
  temperatura: number;
  maxTokens: number;
  qtdHistorico: number;       // quantos pareceres semelhantes enviar
  analiseAutomatica: boolean; // analisar sozinho ao buscar
  observacoes: string;
  responsavel?: string;
  registradoEm?: string;
}

export interface IExemploHistorico {
  decisao: 'Participar' | 'NaoParticipar';
  orgao: string;
  local: string;
  modalidade: string;
  objeto: string;
  valorEstimado?: number;
  justificativa: string;
  data: string;
  semelhanca: number; // 0–1
}

export interface IEntradaAnaliseIa {
  edital: {
    orgao: string;
    local: string;
    modalidade: string;
    numero: string;
    objeto: string;
    valorEstimado?: number;
    publicacao?: string;
    encerramento?: string;
    aderenciaBusca: number;
    criteriosBusca: string[];
  };
  historico: IExemploHistorico[];
  estatisticas: {
    totalPareceres: number;
    participar: number;
    naoParticipar: number;
  };
  // Prompt final já montado (o que vai para a API).
  sistema: string;
  mensagem: string;
  prompt: IPromptIa;
}

export interface IAnaliseIaLicitacao {
  id?: string;
  chaveEdital: string;
  recomendacao: RecomendacaoIa;
  confianca: number;          // 0–100 (certeza da IA na recomendação)
  // 0–100: o quanto o edital combina com a DGT (portfólio, critérios
  // e histórico). É o número mostrado na barra da tela.
  compatibilidade: number;
  resumo: string;
  pontosFavoraveis: string[];
  riscos: string[];
  justificativaSugerida: string;
  semelhantes: string[];      // resumos dos editais parecidos usados
  provedor: TipoProvedorIa;
  modeloIa: string;
  promptVersao: number;
  geradaEm: string;
}

export type SituacaoAnaliseIa =
  | 'naoIniciada'
  | 'aguardando'
  | 'analisando'
  | 'pronta'
  | 'erro';

export interface IEstadoAnaliseIa {
  situacao: SituacaoAnaliseIa;
  analise?: IAnaliseIaLicitacao;
  erro?: string;
}
