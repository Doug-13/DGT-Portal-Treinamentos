import {
  IConfigAvaliacao
} from '../services/fluxo/valorAvaliacao';

import {
  IConfigComponente
} from '../services/fluxo/valorComponente';

import {
  IConfigScript
} from '../services/fluxo/scriptFluxo';

import {
  IAssinaturaNaInstancia,
  IConfigAssinatura
} from '../services/fluxo/assinaturaFluxo';

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
  // Subprocesso (Call Activity no BPMN): ao ser percorrido, cria
  // documentos que seguem OUTRO fluxo — um por linha de uma tabela
  // (ex.: ações de uma auditoria) ou um só — e grava as referências
  // a eles num campo "Documentos referenciados" deste fluxo. O fluxo
  // atual segue adiante (não espera os filhos terminarem).
  | 'subprocesso'
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
//   cargoArea        → quem tem um CARGO na área (ex.: Diretor da área),
//                      cadastrado em RH e Pessoas → Estrutura por área
//   nivelHierarquico → o N-ésimo nível da cadeia da área (1º, 2º, 3º…
//                      ou o topo). A cadeia sai dos cargos cadastrados
//                      (ex.: Coordenador → Head → Diretor).
//   campoUsuario     → o usuário escolhido num METADADO do tipo Usuário
//                      (ex.: "Responsável pelo processo"). referenciaId
//                      = chave do metadado; referenciaNome = rótulo.
//                      Campo vazio → vai para o autor da revisão.
// Ainda não resolvidos (exigem vínculo usuário × grupo/função/setor):
//   grupo, funcao, setor
export type TipoResponsavelFluxo =
  | 'autorRevisao'
  | 'gestorArea'
  | 'area'
  | 'cargoArea'
  | 'nivelHierarquico'
  | 'grupo'
  | 'funcao'
  | 'setor'
  | 'usuario'
  | 'campoUsuario'
  // Pessoa definida por área numa aba do módulo (Planejamento
  // orçamentário → Responsáveis). referenciaId = papel:
  // 'preenchimento' ou 'diretor'.
  | 'definidoPorArea';

export interface IFluxoResponsavel {
  tipo: TipoResponsavelFluxo;

  // Id do registro referenciado (vazio para autorRevisao/gestorArea).
  referenciaId?: string;

  descricao: string;

  // Nome do registro referenciado (área ou usuário), para exibição.
  referenciaNome?: string;

  // tipo = 'area': só os Gestores da área (e não todos os membros).
  somenteGestores?: boolean;

  // tipo = 'cargoArea': cargo exigido (ex.: 'Diretor').
  cargo?: string;

  // tipo = 'nivelHierarquico': 1 = primeiro nível da cadeia da área,
  // 2 = segundo…; 0 = topo da cadeia.
  nivel?: number;

  // cargoArea / nivelHierarquico — de qual área:
  //   referenciaId preenchido      → área fixa
  //   origemArea = 'autor'         → área de QUEM CRIOU a revisão/planilha
  //   vazio (padrão)               → área do documento/planilha
  origemArea?: 'documento' | 'autor';

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
  // Hierarquia: quem tem este cargo na área (cargoArea) ou o nível da
  // cadeia da área (nivelHierarquico). Conferido na hora, com os
  // cargos atuais — trocar o Diretor vale para as pendências abertas.
  cargo?: string;
  nivel?: number;
  // Hierarquia pela área de quem criou: as áreas são as do autor
  // (vínculos ativos). Se o autor também é da área do documento,
  // vale só ela (areaPreferidaId).
  autorId?: string;
  areaPreferidaId?: string;
  // Hierarquia: pessoas que respondiam quando a pendência foi criada
  // (para avisos/notificações). Quem pode agir é conferido na hora.
  usuariosIds?: string[];
  // definidoPorArea: pessoa(s) definida(s) para a área do documento.
  pessoas?: string[];
}

// Status do documento (dgt_documentorevisao.dgt_status) enquanto a
// revisão está nesta etapa.
// 'Vigente': ao CHEGAR nesta etapa a revisão é publicada (fica
// vigente) e o fluxo desta revisão termina. Revisões seguintes são
// novas revisões (Rev.01A...), com o próprio fluxo.
export type StatusDocumentoEtapa =
  | 'Elaboração'
  | 'Revisão'
  | 'Aprovação'
  | 'Vigente';

// Ação de sistema executada por uma tarefa de sistema.
export type AcaoSistemaFluxo =
  | 'publicarComRetreinamento'
  | 'publicarSemRetreinamento'
  // Gerados pelo evento de revisão (não aparecem na lista da
  // tarefa de sistema).
  | 'novaRevisao'
  | 'novaSubRevisao'
  | 'proximaRevisao'
  // Evento de revisão com "Remover o arquivo" marcado: a revisão
  // segue sem arquivo (o arquivo anterior continua no SharePoint e
  // no histórico) e o novo é anexado numa etapa seguinte.
  | 'removerArquivoRevisao'
  // Subprocesso: cria os documentos filhos (ver IConfigSubprocesso e
  // IFluxoInstancia.subprocessos).
  | 'criarSubprocessos'
  // Script (caixa com engrenagem): o motor para, o script roda isolado e
  // preenche campos; só então o fluxo segue (ver scriptFluxo.ts).
  | 'executarScript'
  // Assinatura digital (Clicksign via Power Automate): o motor para até
  // o pedido ficar assinado (ver assinaturaFluxo.ts).
  | 'assinaturaDigital';

// Arquivo da revisão numa etapa com responsável:
//   'nao'         a etapa não mostra o anexo (padrão)
//   'opcional'    o responsável pode anexar / substituir o arquivo
//   'obrigatorio' só conclui a etapa com o arquivo anexado
export type AnexoArquivoEtapa =
  | 'nao'
  | 'opcional'
  | 'obrigatorio';

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
  // Matriz de critérios com nota, peso e faixas (Go/No-Go) — ver
  // services/fluxo/valorAvaliacao.ts.
  | 'avaliacao'
  // Tela personalizada (nativa do portal ou HTML isolado) — ver
  // services/fluxo/valorComponente.ts.
  | 'componente'
  | 'simNao'
  | 'texto'
  | 'textoLongo'
  | 'numero'
  | 'data'
  | 'lista'
  | 'tabela'
  // Usuário da plataforma (dgt_usuario). Valor gravado como JSON
  // {id, nome, email} — ver services/fluxo/valorUsuario.ts.
  | 'usuario'
  // Documento(s) da plataforma (dgt_documento). Valor gravado como
  // JSON [{id, codigo, titulo}] — ver services/fluxo/valorDocumento.ts.
  | 'documento'
  | 'documentos'
  // Área cadastrada no portal (dgt_area). Valor gravado como JSON
  // {id, nome, sigla} — ver services/fluxo/valorArea.ts.
  | 'area';

// Tipos permitidos numa coluna de tabela: os mesmos dos metadados,
// exceto tabela dentro de tabela. Em 'documento(s)', as opções da
// coluna são os tipos de documento aceitos.
export type TipoColunaTabela =
  | 'texto'
  | 'textoLongo'
  | 'numero'
  | 'data'
  | 'simNao'
  | 'lista'
  | 'usuario'
  | 'documento'
  | 'documentos'
  | 'area';

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

  // tipo = 'avaliacao'
  avaliacao?: IConfigAvaliacao;

  // tipo = 'componente'
  componente?: IConfigComponente;

  // REGRA DE EXIBIÇÃO do campo (definida nos metadados do processo):
  // o campo só aparece — em qualquer atividade que o exiba — quando o
  // campo "campo" tiver o valor "valor". Se a atividade o marcou como
  // obrigatório, ele é exigido só quando aparece.
  exibirQuando?: { campo: string; valor: string };

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

  // tipo = 'avaliacao'
  avaliacao?: IConfigAvaliacao;

  // tipo = 'componente'
  componente?: IConfigComponente;

  // Só exige este campo quando outro campo tiver o valor indicado.
  // Ex.: justificativa obrigatória apenas quando retreinamento = 'nao'.
  // O campo também só APARECE quando a condição é atendida.
  obrigatorioQuando?: {
    campo: string;
    valor: string;
  };

  // Só MOSTRA este campo (opcional) quando outro campo tiver o valor
  // indicado. Ex.: observação opcional apenas quando houver = 'sim'.
  mostrarQuando?: {
    campo: string;
    valor: string;
  };

  // Campos só são validados quando a ação executada tem um destes
  // resultados (vazio = qualquer ação).
  validarNosResultados?: string[];

  ajuda?: string;
}

// ------------------------------------------------------------
// SUBPROCESSO
// ------------------------------------------------------------

// De onde vem o valor de um metadado do documento filho:
//   'coluna:<chave>'  → célula da linha da tabela de origem
//   'campo:<chave>'   → campo (metadado) do documento pai
//   'pai:referencia'  → o próprio documento pai (para metadados do
//                       tipo Documento referenciado do filho)
//   'pai:codigo' | 'pai:titulo' → texto do documento pai
export interface IMapeamentoSubprocesso {
  origem: string;
  // Chave do metadado do processo do filho.
  destino: string;
}

export interface IFiltroLinhasSubprocesso {
  // Chave da coluna da tabela de origem.
  coluna: string;
  // Valores aceitos (texto da opção da Lista; 'sim'/'nao' no Sim/Não).
  valores: string[];
}

export interface IConfigSubprocesso {
  // Fluxo (dgt_processo) que os documentos filhos seguem. Precisa ter
  // versão publicada quando o subprocesso for executado.
  fluxoId: string;
  fluxoNome?: string;

  // 'tabela' = um documento por linha preenchida da tabela;
  // 'unico'  = um documento por passagem.
  origem: 'tabela' | 'unico';

  // origem = 'tabela': chave do metadado (tipo Tabela) deste fluxo.
  campoTabela?: string;

  // origem = 'tabela': só as linhas em que a coluna (tipo Lista ou
  // Sim/Não) tem um dos valores escolhidos viram documento.
  // Ex.: { coluna: 'conforme', valores: ['nao'] } → só não conformidades.
  // Sem filtro = todas as linhas preenchidas.
  filtroLinhas?: IFiltroLinhasSubprocesso;

  // Metadado deste fluxo (tipo "Documentos referenciados") onde os
  // filhos criados são gravados — é o que liga pai e filhos (aba
  // Referências dos dois documentos).
  campoReferencias: string;

  // Sigla do tipo dos documentos filhos (ex.: PDA). Código gerado:
  // ÁREA-TIPO-NNN, como em "Novo documento".
  tipoDocumento: string;

  // Área dos filhos: '' = a mesma do documento pai; senão o id da área.
  areaId?: string;
  areaNome?: string;

  // Título dos filhos. Marcadores: {pai.codigo} {pai.titulo} {n}
  // {coluna:<chave>} {campo:<chave>}.
  titulo: string;

  // Autor da revisão do filho (responsável "Autor da revisão" do
  // fluxo filho):
  //   'executor'        → quem concluiu a etapa que levou ao subprocesso
  //   'autorPai'        → o autor da revisão do documento pai
  //   'coluna:<chave>'  → usuário de uma coluna do tipo Usuário
  autor: string;

  // Valores iniciais dos metadados do filho.
  mapeamentos: IMapeamentoSubprocesso[];

  // Depois de criar os documentos:
  //   'nao'   → o fluxo atual segue para a próxima etapa (padrão);
  //   'todos' → o fluxo atual PARA no subprocesso e só segue quando
  //             todos os documentos criados tiverem o fluxo concluído
  //             (ex.: auditoria só fecha com as ações resolvidas).
  aguardar?: 'nao' | 'todos';
}

// Documento filho criado por um subprocesso.
export interface ISubprocessoFilho {
  documentoId: string;
  codigo: string;
  titulo: string;
  revisaoId?: string;
  // Identifica a linha de origem (para não recriar o mesmo documento
  // se o fluxo passar de novo pelo subprocesso).
  assinatura: string;
  linha?: number;
  criadoEm: string;
  // Fluxo do documento filho concluído (modo "aguardar").
  concluido?: boolean;
  concluidoEm?: string;
}

// Pedido de execução de um subprocesso, gravado no estado do fluxo do
// pai (auditoria: quando, por qual etapa, o que foi criado e erros).
export interface ISubprocessoSolicitado {
  id: string;
  elementoId: string;
  elementoNome: string;
  solicitadoEm: string;
  status: 'pendente' | 'concluido' | 'parcial' | 'erro';
  // Quem concluiu a etapa que levou ao subprocesso.
  executorId?: string;
  executorNome?: string;
  filhos: ISubprocessoFilho[];
  // Linhas que já tinham documento (não recriadas).
  ignorados?: number;
  // Modo "aguardar": o fluxo do pai está parado neste subprocesso até
  // os filhos concluírem (ou até um administrador liberar).
  aguardando?: boolean;
  liberadoEm?: string;
  // 'concluidos' = todos os filhos concluíram; 'administrador' = liberado
  // sem esperar; 'semDocumentos' = nenhuma linha gerou documento.
  liberadoPor?: 'concluidos' | 'administrador' | 'semDocumentos';
  erros?: string[];
  concluidoEm?: string;
}

// Documento filho: de onde ele veio.
export interface IOrigemSubprocesso {
  documentoId: string;
  codigo: string;
  titulo: string;
  revisaoId?: string;
  elementoNome?: string;
  linha?: number;
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

  // eventoRevisao: true = ao passar aqui, a revisão fica SEM
  // arquivo (o anterior não é apagado do SharePoint: só deixa de
  // ser o arquivo desta revisão). Opcional; padrão = mantém.
  removerArquivo?: boolean;

  // tarefaHumana: o responsável anexa o arquivo da revisão nesta
  // etapa (ex.: Elaboração). Padrão = 'nao'.
  anexoArquivo?: AnexoArquivoEtapa;

  // tarefaHumana: o arquivo da revisão pode ser ABERTO PARA EDIÇÃO
  // nesta etapa ("Abrir documento" no Word/Excel online). Fora das
  // etapas que permitem, só há pré-visualização (somente leitura).
  // Não definido = padrão: só na etapa de Elaboração (status
  // "Elaboração" ou a 1ª etapa do fluxo com status automático).
  permiteEditarDocumento?: boolean;

  // subprocesso: o que criar e como ligar ao documento atual.
  subprocesso?: IConfigSubprocesso;

  // tarefaSistema com acaoSistema 'executarScript'.
  script?: IConfigScript;

  // tarefaSistema com acaoSistema 'assinaturaDigital'.
  assinatura?: IConfigAssinatura;

  // tarefaHumana com status 'Vigente': retreinamento na publicação.
  //   'nao' (padrão) · 'sim' · 'etapa:<id>' = sim, se o fluxo passou
  //   por aquela etapa neste ciclo (ex.: "Revisar Treinamento").
  retreinamentoAoPublicar?: string;
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
  | 'concluido'
  // Revisão cancelada por um administrador (retorno para a revisão
  // vigente anterior). O histórico é preservado.
  | 'cancelado';

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

  // Número da revisão no momento do passo (ex.: Rev.00A). Registros
  // antigos não têm este campo.
  revisao?: string;
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

  // Subprocessos pedidos por este fluxo (documentos filhos criados).
  subprocessos?: ISubprocessoSolicitado[];

  // Documento criado por um subprocesso: o documento pai.
  origemSubprocesso?: IOrigemSubprocesso;

  // Fluxo parado numa "Assinatura digital": chave do pedido em
  // dgt_assinatura (uma por parada).
  assinatura?: IAssinaturaNaInstancia;
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
