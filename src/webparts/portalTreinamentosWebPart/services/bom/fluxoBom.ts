import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoTarefa
} from '../../models/Fluxo';

import {
  EtapaBom,
  IAnaliseGoNoGo,
  IBomRegistro,
  IDemandaBom
} from './BomService';

import {
  DecisaoGoNoGo
} from './esquemaBom';

import {
  ISelecaoKit,
  montarBom
} from './montadorBom';

import {
  IConfigAvaliacao
} from '../fluxo/valorAvaliacao';

import {
  gravarEnvelopeComponente
} from '../fluxo/valorComponente';

import {
  gravarValorUsuario
} from '../fluxo/valorUsuario';

import {
  gravarLinhasTabela
} from '../fluxo/valoresTabela';

import {
  pendenciasComplementos
} from '../hh/complementosHH';

// ============================================================
// ARQUITETURA DE SOLUÇÕES × MOTOR DE FLUXOS (regras puras)
//
// O B.O.M. continua sendo preenchido nas telas do módulo (Dados da
// demanda, Matriz Go/No-Go, Seleção de kit, Cálculo de HH e B.O.M.
// pronto), com os dados nas tabelas dgt_bom_*. O motor de fluxos
// (processo ARQ-SOL) controla QUEM age, QUANDO (prazo em dias úteis),
// QUAIS ações existem em cada etapa e o histórico.
//
// Este arquivo traduz entre os dois mundos, sem Dataverse:
//   • etapa do fluxo → aba do módulo e etapa gravada no B.O.M.;
//   • dados do módulo → valores dos campos do fluxo (calculados na
//     hora de cada ação; nada é cadastrado em dobro);
//   • situação do B.O.M. (em andamento, aguardando aprovação,
//     aprovado, encerrado) a partir do estado do fluxo.
//
// As etapas são reconhecidas pelo id do pacote
// (docs/exemplos/pacote-arquitetura-solucoes-fluxo.json) e, se o
// administrador mudar o desenho no editor, pelo nome da atividade.
// ============================================================

export type PapelEtapaBom =
  | 'demanda'
  | 'goNoGo'
  | 'restricao'
  | 'bloqueado'
  | 'kit'
  | 'hh'
  | 'bomPronto'
  | 'aprovacao'
  | 'outra';

export type AbaFluxoBom = 'demanda' | 'gonogo' | 'kit' | 'hh' | 'pronto';

export type SituacaoFluxoBom =
  | 'emAndamento'
  | 'aguardandoAprovacao'
  | 'aprovado'
  | 'encerrado'
  | 'cancelado';

// Processo que governa o módulo (o primeiro código encontrado vale).
export const PROCESSO_BOM = {
  CODIGOS: ['ARQ-SOL', 'ARQ-BOM'],
  // Sem processo com esses códigos: procura pelo nome.
  NOME_CONTEM: 'arquitetura'
};

const PAPEIS: PapelEtapaBom[] = ['demanda', 'goNoGo', 'restricao', 'bloqueado', 'kit', 'hh', 'bomPronto', 'aprovacao'];

const normalizar = (valor?: string): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Papel de uma atividade do fluxo no módulo.
export const papelDoElemento = (
  elemento?: { id: string; nome?: string; tipo?: string }
): PapelEtapaBom => {

  if (!elemento) {
    return 'outra';
  }

  if (PAPEIS.indexOf(elemento.id as PapelEtapaBom) >= 0) {
    return elemento.id as PapelEtapaBom;
  }

  if (elemento.tipo && elemento.tipo !== 'tarefaHumana') {
    return 'outra';
  }

  const nome = normalizar(elemento.nome);

  if (/restri/.test(nome)) { return 'restricao'; }
  if (/bloque|encerr/.test(nome)) { return 'bloqueado'; }
  if (/demanda/.test(nome)) { return 'demanda'; }
  if (/go.?\/?.?no.?go|matriz/.test(nome)) { return 'goNoGo'; }
  if (/kit/.test(nome)) { return 'kit'; }
  if (/(^|[^a-z])hh([^a-z]|$)|homem.?hora/.test(nome)) { return 'hh'; }
  if (/aprova/.test(nome)) { return 'aprovacao'; }
  if (/pronto|b\.?o\.?m/.test(nome)) { return 'bomPronto'; }

  return 'outra';
};

export const abaDoPapel = (papel: PapelEtapaBom): AbaFluxoBom | undefined => {
  switch (papel) {
    case 'demanda': return 'demanda';
    case 'goNoGo':
    case 'restricao':
    case 'bloqueado': return 'gonogo';
    case 'kit': return 'kit';
    case 'hh': return 'hh';
    case 'bomPronto':
    case 'aprovacao': return 'pronto';
    default: return undefined;
  }
};

// Etapas com tela de preenchimento no módulo: a ação principal fica no
// botão da própria tela (ex.: "Concluir seleção de kit"), que grava os
// dados e executa a ação do fluxo num clique só.
export const PAPEIS_COM_TELA: PapelEtapaBom[] = ['demanda', 'goNoGo', 'kit', 'hh', 'bomPronto'];

export const elementoDoPapel = (
  definicao: IFluxoDefinicao,
  papel: PapelEtapaBom
): IFluxoElemento | undefined =>
  definicao.elementos.find(item => item.tipo === 'tarefaHumana' && item.id === papel) ||
  definicao.elementos.find(item => item.tipo === 'tarefaHumana' && papelDoElemento(item) === papel);

export const tarefaPendenteBom = (instancia: IFluxoInstancia): IFluxoTarefa | undefined =>
  instancia.tarefas.find(item => item.status === 'pendente');

// Papel da etapa atual (sem precisar da definição: usa a pendência).
export const papelAtual = (instancia: IFluxoInstancia): PapelEtapaBom => {
  const tarefa = tarefaPendenteBom(instancia);
  return tarefa
    ? papelDoElemento({ id: tarefa.elementoId, nome: tarefa.elementoNome, tipo: 'tarefaHumana' })
    : papelDoElemento({ id: instancia.elementoAtualId, tipo: 'tarefaHumana' });
};

export const situacaoFluxoBom = (instancia: IFluxoInstancia): SituacaoFluxoBom => {

  if (instancia.status === 'cancelado') {
    return 'cancelado';
  }

  if (instancia.status === 'concluido') {
    const ultimoHumano = instancia.historico.find(item => !item.sistema);
    const encerrado =
      /encerr/i.test(instancia.elementoAtualId) ||
      (!!ultimoHumano && ultimoHumano.resultado === 'encerrado');
    return encerrado ? 'encerrado' : 'aprovado';
  }

  return papelAtual(instancia) === 'aprovacao' ? 'aguardandoAprovacao' : 'emAndamento';
};

// Etapa gravada no B.O.M. (dgt_bom_etapa) a partir do fluxo.
export const etapaBomDaInstancia = (instancia: IFluxoInstancia): EtapaBom => {

  const situacao = situacaoFluxoBom(instancia);

  if (situacao === 'aprovado') { return 'Aprovado'; }
  if (situacao === 'encerrado') { return 'Encerrado (NO-GO)'; }

  switch (papelAtual(instancia)) {
    case 'demanda': return 'Dados da demanda';
    case 'goNoGo':
    case 'restricao': return 'Go/No-Go pendente';
    case 'bloqueado': return 'Bloqueado no Go/No-Go';
    case 'kit': return 'Seleção de kit';
    case 'hh': return 'Cálculo de HH';
    case 'bomPronto': return 'B.O.M. pronto';
    case 'aprovacao': return 'Enviado para aprovação';
    default: return 'Dados da demanda';
  }
};

// Opções novas do dgt_bom_etapa (criadas por criar-fluxo-bom.ps1).
// Enquanto o script não roda, grava a etapa equivalente mais próxima.
export const etapaBomCompativel = (etapa: EtapaBom): EtapaBom =>
  etapa === 'Aprovado'
    ? 'Enviado para aprovação'
    : etapa === 'Encerrado (NO-GO)'
      ? 'Bloqueado no Go/No-Go'
      : etapa;

// B.O.M. criado antes do fluxo: em que etapa o fluxo começa.
export const papelDaEtapaLegada = (
  etapa: EtapaBom,
  analise?: IAnaliseGoNoGo
): PapelEtapaBom => {
  switch (etapa) {
    case 'Go/No-Go pendente': return 'goNoGo';
    case 'Bloqueado no Go/No-Go':
      return analise && analise.decisao === 'GO com restrição' ? 'restricao' : 'bloqueado';
    case 'Seleção de kit': return 'kit';
    case 'Cálculo de HH': return 'hh';
    case 'B.O.M. pronto': return 'bomPronto';
    case 'Enviado para aprovação':
    case 'Aprovado': return 'aprovacao';
    case 'Encerrado (NO-GO)': return 'bloqueado';
    default: return 'demanda';
  }
};

// ------------------------------------------------------------
// Dados do módulo → valores dos campos do fluxo
// ------------------------------------------------------------

export const FAIXA_DA_DECISAO: Record<DecisaoGoNoGo, string> = {
  GO: 'go',
  'GO com restrição': 'restricao',
  'NO-GO': 'nogo'
};

// Valor do campo Avaliação (Matriz Go/No-Go) a partir da análise já
// calculada pelo módulo. A faixa (go / restricao / nogo) é a DECISÃO
// do módulo — é ela que o gateway do fluxo compara.
export const valorGoNoGo = (
  analise: IAnaliseGoNoGo | undefined,
  config?: IConfigAvaliacao
): string => {

  if (!analise) {
    return '';
  }

  const notas: Record<string, number> = {};
  const justificativas: Record<string, string> = {};

  if (config && config.criterios.length > 0) {
    const usadas: number[] = [];
    config.criterios.forEach((criterio, indice) => {
      const alvo = normalizar(criterio.rotulo);
      let posicao = analise.notas.findIndex((nota, i) => usadas.indexOf(i) < 0 && normalizar(nota.criterioNome) === alvo);
      if (posicao < 0) {
        posicao = analise.notas.findIndex((nota, i) => usadas.indexOf(i) < 0 && normalizar(nota.criterioNome).split(' ')[0] === alvo.split(' ')[0]);
      }
      if (posicao < 0 && indice < analise.notas.length && usadas.indexOf(indice) < 0) {
        posicao = indice;
      }
      if (posicao >= 0) {
        usadas.push(posicao);
        notas[criterio.chave] = analise.notas[posicao].nota;
        if (analise.notas[posicao].justificativa) {
          justificativas[criterio.chave] = analise.notas[posicao].justificativa;
        }
      }
    });
  } else {
    analise.notas.forEach(nota => {
      notas[nota.criterioId] = nota.nota;
    });
  }

  const faixa = FAIXA_DA_DECISAO[analise.decisao];
  const faixaConfig = config ? config.faixas.find(item => item.chave === faixa) : undefined;

  return JSON.stringify({
    notas,
    justificativas,
    total: analise.pontuacao,
    faixa,
    faixaRotulo: faixaConfig ? faixaConfig.rotulo : analise.decisao
  });
};

export const envelopeSelecaoKit = (selecao?: ISelecaoKit): string => {

  if (!selecao || selecao.pontos.length === 0) {
    return '';
  }

  if (selecao.bomEnviado) {
    return gravarEnvelopeComponente({
      valido: true,
      resumo: `${selecao.bomEnviado.totais.pontos} ponto(s) · ${selecao.bomEnviado.itens.length} itens (lista congelada no envio)`
    });
  }

  const resultado = montarBom(selecao);
  const erros =
    resultado.alertas
      .filter(item => item.nivel === 'erro')
      .map(item => `${item.origem}: ${item.mensagem}`);

  return gravarEnvelopeComponente({
    valido: erros.length === 0,
    erros,
    resumo: `${resultado.totais.pontos} ponto(s) · ${resultado.itens.length} itens`
  });
};

export const envelopeCalculoHH = (selecao?: ISelecaoKit): string => {

  if (!selecao || selecao.pontos.length === 0) {
    return '';
  }

  const pendencias = pendenciasComplementos(selecao.complementosHH);

  return gravarEnvelopeComponente({
    valido: pendencias.length === 0,
    erros: pendencias,
    resumo: pendencias.length === 0
      ? 'Prévia com o HH vigente; integração e manutenção respondidas'
      : 'Perguntas de integração e manutenção pendentes'
  });
};

export interface IEntradaValoresBom {
  bom: IBomRegistro;
  demanda: IDemandaBom;
  analise?: IAnaliseGoNoGo;
  usuarios: Array<{ id: string; nome: string; email?: string }>;
  selecao?: ISelecaoKit;
  custoProjeto?: number;
  configGoNoGo?: IConfigAvaliacao;
  // Etapa B.O.M. pronto: o envio só sai depois da revisão da lista.
  itensConferidos?: boolean;
}

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

// Valores dos campos do fluxo, lidos dos dados atuais do módulo.
// Campos vazios ficam de fora (o motor os trata como não preenchidos).
export const valoresDoBom = (entrada: IEntradaValoresBom): Record<string, string> => {

  const { bom, demanda, analise, usuarios, selecao } = entrada;

  const usuario = (id?: string): string => {
    const alvo = guid(id);
    if (!alvo) {
      return '';
    }
    const achado = usuarios.find(item => guid(item.id) === alvo);
    return gravarValorUsuario({ id: alvo, nome: achado ? achado.nome : '', email: achado ? achado.email : undefined });
  };

  const ativos = demanda.responsaveis.filter(item => item.ativo);
  const principal = ativos.find(item => item.principal);
  const principalId = principal ? principal.usuarioId : bom.responsavelId;

  const apoio =
    ativos
      .filter(item => guid(item.usuarioId) !== guid(principalId))
      .map(item => ({ usuario: usuario(item.usuarioId) }));

  const valores: Record<string, string> = {
    cliente: demanda.cliente,
    codigoCigam: demanda.codigoCigam,
    municipio: demanda.municipio,
    uf: demanda.uf,
    numeroCrm: demanda.numeroCrm,
    canal: demanda.canal,
    // Canal privado: a modalidade é sempre "Proposta Comercial", que
    // não é opção do campo (ele só aparece no canal Público).
    modalidade: demanda.canal === 'Privado' ? '' : demanda.modalidade,
    executivoVendas: usuario(demanda.executivoVendasId),
    responsavelPrincipal: usuario(principalId),
    responsaveisApoio: gravarLinhasTabela(apoio),
    dataEntrada: demanda.dataEntrada,
    prazoEntrega: demanda.prazoEntrega,
    statusDemanda: demanda.statusDemanda,
    observacaoEtapa: demanda.observacaoEtapa,
    tipoEntrega: demanda.tipoEntrega,
    solucoesInteresse: gravarLinhasTabela(demanda.solucoes.map(solucao => ({ solucao }))),
    tipoProjeto: demanda.tipoProjeto,
    pontosEstimados: demanda.pontosEstimados === undefined ? '' : String(demanda.pontosEstimados),
    linkEdital: demanda.linkEdital,
    escopo: demanda.escopo,
    goNoGo: valorGoNoGo(analise, entrada.configGoNoGo),
    parecer: analise ? analise.parecer : '',
    selecaoKit: envelopeSelecaoKit(selecao),
    custoProjeto: entrada.custoProjeto === undefined ? '' : String(Math.round(entrada.custoProjeto * 100) / 100),
    calculoHH: envelopeCalculoHH(selecao),
    revisaoBom: bom.revisao,
    itensConferidos: entrada.itensConferidos ? 'sim' : ''
  };

  Object.keys(valores).forEach(chave => {
    if (!(valores[chave] || '').trim()) {
      delete valores[chave];
    }
  });

  return valores;
};

// Configuração do campo Avaliação (Matriz Go/No-Go) no fluxo.
export const configAvaliacaoDaDefinicao = (
  definicao: IFluxoDefinicao | undefined,
  chave = 'goNoGo'
): IConfigAvaliacao | undefined => {
  if (!definicao) {
    return undefined;
  }
  const metadado = (definicao.metadados || []).find(item => item.chave === chave && item.tipo === 'avaliacao');
  if (metadado && metadado.avaliacao) {
    return metadado.avaliacao;
  }
  for (const elemento of definicao.elementos) {
    const campo = elemento.campos.find(item => item.chave === chave && item.tipo === 'avaliacao');
    if (campo && campo.avaliacao) {
      return campo.avaliacao;
    }
  }
  return undefined;
};

// Atividades com mais de uma saída sem decisão (gateway) para
// distribuí-las. No modelo do B.O.M., cada atividade tem UMA saída;
// os resultados possíveis são distribuídos por uma decisão.
export const atividadesSemDecisao = (definicao: IFluxoDefinicao): IFluxoElemento[] =>
  definicao.elementos.filter(item =>
    item.tipo === 'tarefaHumana' &&
    definicao.transicoes.filter(transicao => transicao.origemId === item.id).length > 1
  );
