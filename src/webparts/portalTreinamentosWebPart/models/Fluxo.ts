// ============================================================
// MODELO DO FLUXO CONFIGURÁVEL DE DOCUMENTOS
//
// Estas interfaces espelham as tabelas que FUTURAMENTE serão
// criadas no Dataverse. Nesta fase de teste elas existem só no
// código (definição fixa + estado no navegador).
//
//   IFluxoDefinicao        → dgt_fluxo
//   IFluxoElemento         → dgt_fluxoetapa
//   IFluxoResponsavel      → dgt_fluxoetaparesponsavel
//   IFluxoAcao             → dgt_fluxoacao
//   IFluxoTransicao        → dgt_fluxotransicao
//   IFluxoInstancia        → colunas novas em dgt_documentorevisao
//   IFluxoTarefa           → dgt_tarefafluxo
//   IFluxoHistorico        → dgt_historicofluxo
// ============================================================

export type TipoElementoFluxo =
  | 'inicio'
  | 'tarefaHumana'
  | 'gateway'
  | 'tarefaSistema'
  | 'fim';

// Quem pode executar uma etapa. Os tipos 'grupo', 'funcao',
// 'setor' e 'usuario' apontarão para dgt_grupo, dgt_funcao,
// dgt_setor e dgt_usuario. 'autorRevisao' e 'gestorArea' são
// resolvidos a partir da própria revisão/documento.
export type TipoResponsavelFluxo =
  | 'autorRevisao'
  | 'gestorArea'
  | 'grupo'
  | 'funcao'
  | 'setor'
  | 'usuario';

export interface IFluxoResponsavel {
  tipo: TipoResponsavelFluxo;

  // Id do registro referenciado (vazio para autorRevisao/gestorArea).
  referenciaId?: string;

  descricao: string;

  // Somente no modo de teste: chave do papel simulado que pode
  // executar a etapa (ex.: 'autor', 'coordenacao', 'qualidade').
  papelTeste: string;
}

// Ação de sistema executada por uma tarefa de sistema.
export type AcaoSistemaFluxo =
  | 'publicarComRetreinamento'
  | 'publicarSemRetreinamento';

export interface IFluxoAcao {
  chave: string;

  rotulo: string;

  // Resultado gravado no histórico e usado para escolher a
  // transição de saída da etapa.
  resultado: string;

  principal: boolean;

  exigeComentario: boolean;

  mensagemConfirmacao?: string;
}

// Campo que precisa ser preenchido na etapa antes de concluir.
export type TipoCampoFluxo =
  | 'simNao'
  | 'texto';

export interface IFluxoCampo {
  chave: string;

  rotulo: string;

  tipo: TipoCampoFluxo;

  obrigatorio: boolean;

  // Só exige este campo quando outro campo tiver o valor indicado.
  // Ex.: justificativa obrigatória apenas quando retreinamento = 'nao'.
  obrigatorioQuando?: {
    campo: string;
    valor: string;
  };

  // Campos só são validados quando a ação executada tem um destes
  // resultados (vazio = qualquer ação).
  validarNosResultados?: string[];

  ajuda?: string;
}

// Posição do elemento no diagrama (px). Futuramente virá do
// XML BPMN importado.
export interface IFluxoPosicao {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface IFluxoElemento {
  id: string;

  tipo: TipoElementoFluxo;

  nome: string;

  descricao?: string;

  instrucoes?: string;

  prazoDiasUteis?: number;

  responsaveis: IFluxoResponsavel[];

  acoes: IFluxoAcao[];

  campos: IFluxoCampo[];

  acaoSistema?: AcaoSistemaFluxo;

  // Texto curto exibido abaixo do nome no diagrama.
  subtitulo?: string;

  posicao: IFluxoPosicao;
}

export type TipoCondicaoTransicao =
  | 'sempre'
  | 'resultado'
  | 'campo';

export interface IFluxoTransicao {
  id: string;

  origemId: string;

  destinoId: string;

  rotulo?: string;

  tipoCondicao: TipoCondicaoTransicao;

  // tipoCondicao = 'resultado'
  resultado?: string;

  // tipoCondicao = 'campo'
  campo?: string;
  valorEsperado?: string;

  padrao: boolean;

  // Caminho de exceção (devolução/reprovação) — desenhado tracejado.
  excecao: boolean;

  // Pontos (px) da seta no diagrama, do início ao fim.
  pontos: Array<{ x: number; y: number }>;

  // Posição (canto superior esquerdo, px) do rótulo da seta.
  rotuloPosicao?: { x: number; y: number };
}

export interface IFluxoDefinicao {
  id: string;

  nome: string;

  versao: number;

  status: 'rascunho' | 'publicado' | 'arquivado';

  // Tipos de documento que usam este fluxo por padrão.
  tiposDocumento: string[];

  larguraDiagrama: number;

  alturaDiagrama: number;

  elementos: IFluxoElemento[];

  transicoes: IFluxoTransicao[];
}

export type StatusInstanciaFluxo =
  | 'emAndamento'
  | 'concluido';

export interface IFluxoHistorico {
  id: string;

  data: string;

  elementoId: string;

  elementoNome: string;

  acaoChave: string;

  acaoRotulo: string;

  resultado: string;

  comentario?: string;

  executadoPorId: string;

  executadoPorNome: string;

  sistema: boolean;
}

export interface IFluxoTarefa {
  id: string;

  elementoId: string;

  elementoNome: string;

  responsaveis: IFluxoResponsavel[];

  status: 'pendente' | 'concluida';

  criadaEm: string;

  prazo?: string;

  concluidaEm?: string;

  concluidaPorNome?: string;
}

// Estado do fluxo de UMA revisão.
export interface IFluxoInstancia {
  revisaoId: string;

  documentoId: string;

  revisao: string;

  // A revisão "congela" a definição e a versão com que começou.
  fluxoId: string;

  fluxoVersao: number;

  elementoAtualId: string;

  status: StatusInstanciaFluxo;

  // Valores dos campos preenchidos nas etapas
  // (ex.: { retreinamento: 'sim' }).
  valores: Record<string, string>;

  // Elementos já percorridos (para colorir o diagrama).
  percorridos: string[];

  // Transições já percorridas.
  transicoesPercorridas: string[];

  tarefas: IFluxoTarefa[];

  historico: IFluxoHistorico[];

  iniciadoEm: string;

  concluidoEm?: string;

  // true = estado simulado, não existe no Dataverse.
  simulado: boolean;
}

// Quem está executando a ação.
export interface IFluxoAtor {
  id: string;

  nome: string;

  // Modo de teste: papéis simulados que este ator possui.
  papeisTeste: string[];
}

export type StatusVisualElemento =
  | 'concluido'
  | 'atual'
  | 'pendente'
  | 'naoPercorrido';
