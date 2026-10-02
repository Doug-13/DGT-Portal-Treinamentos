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

import {
  TipoEventoRevisao
} from '../utils/numeracaoRevisao';

export type TipoElementoFluxo =
  | 'inicio'
  | 'tarefaHumana'
  | 'gateway'
  | 'tarefaSistema'
  // Evento de revisão (círculo no desenho): ao ser percorrido,
  // define o número da revisão — inteira (00 → 01) ou
  // sub-revisão (00 → 00A). Ver utils/numeracaoRevisao.ts.
  | 'eventoRevisao'
  | 'fim';

// Quem pode executar uma etapa. Os tipos 'grupo', 'funcao',
// 'setor' e 'usuario' apontarão para dgt_grupo, dgt_funcao,
// dgt_setor e dgt_usuario. 'autorRevisao' e 'gestorArea' são
// resolvidos a partir da própria revisão/documento.
// Resolvidos automaticamente hoje:
//   autorRevisao → responsável da revisão (dgt_documentorevisao.dgt_responsavel)
//   gestorArea   → Gestores da área do documento (dgt_usuarioarea, perfil Gestor)
//   area         → membros (ou só Gestores) de uma área escolhida
//   usuario      → um usuário específico (dgt_usuario)
// Ainda não resolvidos (exigem vínculo usuário × grupo/função/setor):
//   grupo, funcao, setor
export type TipoResponsavelFluxo =
  | 'autorRevisao'
  | 'gestorArea'
  | 'area'
  | 'grupo'
  | 'funcao'
  | 'setor'
  | 'usuario';

export interface IFluxoResponsavel {
  tipo: TipoResponsavelFluxo;

  // Id do registro referenciado (vazio para autorRevisao/gestorArea).
  referenciaId?: string;

  descricao: string;

  // Nome do registro referenciado (área ou usuário), para exibição.
  referenciaNome?: string;

  // tipo = 'area': só os Gestores da área (e não todos os membros).
  somenteGestores?: boolean;

  // Chave do "papel" deste responsável. Identifica o responsável no
  // motor: no modo de teste vira um usuário simulado; no Dataverse
  // é calculada a partir do usuário real.
  papelTeste: string;
}

// Responsável já resolvido para uma revisão concreta: é o que vai
// para a pendência (dgt_tarefafluxo) e permite saber, sem recalcular,
// quem pode executar a etapa.
export interface IResponsavelResolvido {
  papelTeste: string;
  descricao: string;
  usuarioId?: string;
  areaId?: string;
  somenteGestores?: boolean;
}

// Status do documento (dgt_documentorevisao.dgt_status) enquanto a
// revisão está nesta etapa.
export type StatusDocumentoEtapa =
  | 'Elaboração'
  | 'Revisão'
  | 'Aprovação';

// Ação de sistema executada por uma tarefa de sistema.
export type AcaoSistemaFluxo =
  | 'publicarComRetreinamento'
  | 'publicarSemRetreinamento'
  // Gerados pelo evento de revisão (não aparecem na lista da
  // tarefa de sistema).
  | 'novaRevisao'
  | 'novaSubRevisao';

export interface IFluxoAcao {
  chave: string;

  rotulo: string;

  // Resultado gravado no histórico e usado para escolher a
  // transição de saída da etapa.
  resultado: string;

  principal: boolean;

  exigeComentario: boolean;

  // true = esta ação NÃO exige os campos obrigatórios da etapa
  // (ex.: "Reprovar" não precisa responder a pergunta de retreinamento).
  dispensaCampos?: boolean;

  mensagemConfirmacao?: string;
}

// Campo que precisa ser preenchido na etapa antes de concluir.
export type TipoCampoFluxo =
  | 'simNao'
  | 'texto'
  | 'textoLongo'
  | 'numero'
  | 'data'
  | 'lista'
  | 'tabela';

// Tipos permitidos numa coluna de tabela.
export type TipoColunaTabela =
  | 'texto'
  | 'numero'
  | 'data'
  | 'simNao'
  | 'lista';

// Coluna de um metadado do tipo tabela.
export interface IColunaTabela {
  chave: string;

  rotulo: string;

  tipo: TipoColunaTabela;

  // tipo = 'lista'
  opcoes?: string[];

  obrigatoria?: boolean;
}

// Metadado do PROCESSO: campo que pode aparecer nas etapas de
// qualquer versão do fluxo do processo. A ordem da lista é a ordem
// em que os campos aparecem nas telas.
export interface IFluxoMetadado {
  // Id do registro em dgt_processometadado (modo Dataverse).
  id?: string;

  chave: string;

  rotulo: string;

  tipo: TipoCampoFluxo;

  // tipo = 'lista'
  opcoes?: string[];

  // tipo = 'tabela' (o valor é gravado como JSON: lista de linhas)
  colunas?: IColunaTabela[];

  ajuda?: string;
}

export interface IFluxoCampo {
  chave: string;

  rotulo: string;

  tipo: TipoCampoFluxo;

  obrigatorio: boolean;

  // Exibido na etapa, mas não pode ser alterado nela.
  somenteLeitura?: boolean;

  // tipo = 'lista'
  opcoes?: string[];

  // tipo = 'tabela'
  colunas?: IColunaTabela[];

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

  // Rótulo externo (eventos e gateways desenhados no editor BPMN).
  rotuloPosicao?: IFluxoPosicao;

  // tarefaHumana: status do documento durante a etapa.
  statusDocumento?: StatusDocumentoEtapa;

  // eventoRevisao: como o número da revisão muda ao passar aqui.
  tipoRevisao?: TipoEventoRevisao;
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

export type StatusDefinicaoFluxo =
  | 'rascunho'
  | 'publicado'
  | 'arquivado';

export interface IFluxoDefinicao {
  id: string;

  nome: string;

  versao: number;

  status: StatusDefinicaoFluxo;

  // Processo dono do fluxo (dgt_processo). Vazio nos modelos.
  processoId?: string;

  // Id do registro desta VERSÃO em dgt_fluxo (modo Dataverse).
  registroId?: string;

  // Modelo a partir do qual o fluxo foi criado.
  modeloId?: string;

  criadoEm?: string;

  publicadoEm?: string;

  arquivadoEm?: string;

  // Desenho do fluxo no padrão BPMN 2.0 (editor visual).
  bpmnXml?: string;

  // Campos do processo usados pelas etapas.
  metadados?: IFluxoMetadado[];

  // Problemas encontrados ao converter o desenho BPMN (elementos
  // não suportados etc.). Impedem a publicação.
  avisosModelagem?: string[];

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

  // Preenchido no modo Dataverse ao criar a pendência.
  responsaveisResolvidos?: IResponsavelResolvido[];

  status: 'pendente' | 'concluida' | 'cancelada';

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

  // Processo cujo fluxo governa esta revisão (no momento em que
  // o fluxo foi iniciado).
  processoId?: string;

  processoNome?: string;

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
  | 'naoPercorrido'
  // Visualização da definição, sem revisão em andamento.
  | 'definicao';

// Modelo pronto usado para criar o fluxo de um processo.
export interface IFluxoModelo {
  id: string;

  nome: string;

  descricao: string;

  definicao: IFluxoDefinicao;
}
