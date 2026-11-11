import {
  faixaDoValor
} from '../fluxo/valorAvaliacao';

import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  IconeChave
} from '../../components/common/Icones';

import {
  IAmbienteRegistro,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

// ============================================================
// LAYOUT CONFIGURÁVEL DOS AMBIENTES
//
// Modelo de tela inspirado em Arquitetura de Soluções, montado SEM
// código novo a partir do fluxo do ambiente:
//
//   Visão geral  → cards de resumo (VISÕES: contagem + filtro) e a
//                  lista de registros com as COLUNAS escolhidas
//   Registro     → cabeçalho + barra de ETAPAS do processo (concluída,
//                  atual, futura); cada etapa abre os seus campos
//
// Sem configuração salva, tudo sai do fluxo publicado (layoutPadrao):
// uma visão por etapa, colunas básicas e todas as etapas humanas.
// Gravado em dgt_ambiente.dgt_layoutjson.
// ============================================================

export type FiltroVisao =
  | { tipo: 'todos' }
  | { tipo: 'aguardandoVoce' }
  | { tipo: 'meus' }
  | { tipo: 'atrasados' }
  | { tipo: 'etapas'; etapas: string[] }
  | { tipo: 'situacao'; situacoes: SituacaoRegistroAmbiente[] }
  // Campo do fluxo (Lista ou Sim/Não) com um dos valores.
  | { tipo: 'campo'; campo: string; valores: string[] };

export interface IVisaoAmbiente {
  id: string;
  nome: string;
  icone: IconeChave;
  cor: string;
  filtro: FiltroVisao;
}

export interface IEtapaLayout {
  // Id do elemento (etapa humana) no desenho do fluxo.
  elementoId: string;
  // Nome exibido na barra de etapas (vazio = nome da etapa no fluxo).
  rotulo: string;
  visivel: boolean;
}

export interface IAmbienteLayout {
  versao: 1;
  visoes: IVisaoAmbiente[];
  // Colunas da lista: chaves de COLUNAS_BASE ou 'campo:<chave>'.
  colunas: string[];
  etapas: IEtapaLayout[];
  registro: {
    mostrarDados: boolean;
    mostrarHistorico: boolean;
    mostrarDiagrama: boolean;
    // 'duasColunas' (padrão): dados do registro à esquerda, campos da
    // etapa à direita; 'umaColuna': tudo em sequência.
    disposicao?: 'duasColunas' | 'umaColuna';
  };
  lista: {
    // false (padrão) = quem não administra o ambiente vê só os
    // registros que abriu e os que aguardam por ele (como antes).
    todosVeemTodos: boolean;
  };
}

export const PREFIXO_CAMPO_COLUNA = 'campo:';

export const COLUNAS_BASE: Array<{ chave: string; rotulo: string }> = [
  { chave: 'codigo', rotulo: 'Código' },
  { chave: 'titulo', rotulo: 'Título' },
  { chave: 'etapa', rotulo: 'Etapa atual' },
  { chave: 'prazo', rotulo: 'Prazo da etapa' },
  { chave: 'situacao', rotulo: 'Situação' },
  { chave: 'solicitante', rotulo: 'Aberto por' },
  { chave: 'area', rotulo: 'Área' },
  { chave: 'criadoEm', rotulo: 'Aberto em' }
];

const COLUNAS_PADRAO = ['codigo', 'titulo', 'etapa', 'prazo', 'situacao', 'solicitante', 'criadoEm'];

// Cores dos cards (mesma família da Arquitetura de Soluções).
export const CORES_VISAO: Array<{ cor: string; nome: string }> = [
  { cor: '#0F6CBD', nome: 'Azul' },
  { cor: '#B45309', nome: 'Laranja' },
  { cor: '#B42318', nome: 'Vermelho' },
  { cor: '#6B4FBB', nome: 'Roxo' },
  { cor: '#107C10', nome: 'Verde' },
  { cor: '#0E7490', nome: 'Ciano' },
  { cor: '#64748B', nome: 'Cinza' }
];

const gerarId = (): string =>
  `vis-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ------------------------------------------------------------
// Etapas do fluxo na ordem do processo
// ------------------------------------------------------------

// Etapas humanas na ordem em que o processo as percorre: busca em
// largura a partir do Início, seguindo as ligações (decisões e tarefas
// automáticas são atravessadas, não aparecem). Ligações de exceção
// (devolver/retornar) ficam por último, para não bagunçar a ordem.
export const etapasDoFluxo = (
  definicao?: IFluxoDefinicao
): IFluxoElemento[] => {

  if (!definicao) {
    return [];
  }

  const inicio = definicao.elementos.find(item => item.tipo === 'inicio');
  const ordem: IFluxoElemento[] = [];
  const visitados: string[] = [];
  const fila: string[] = inicio ? [inicio.id] : [];

  while (fila.length > 0) {
    const id = fila.shift() as string;
    if (visitados.indexOf(id) >= 0) {
      continue;
    }
    visitados.push(id);

    const elemento = definicao.elementos.find(item => item.id === id);
    if (!elemento) {
      continue;
    }
    if (elemento.tipo === 'tarefaHumana') {
      ordem.push(elemento);
    }

    definicao.transicoes
      .filter(item => item.origemId === id)
      .sort((a, b) => Number(a.excecao) - Number(b.excecao))
      .forEach(item => fila.push(item.destinoId));
  }

  // Etapas soltas (sem caminho a partir do Início) vão ao final.
  definicao.elementos
    .filter(item => item.tipo === 'tarefaHumana' && visitados.indexOf(item.id) < 0)
    .forEach(item => ordem.push(item));

  return ordem;
};

// ------------------------------------------------------------
// Layout padrão e normalização
// ------------------------------------------------------------

export const layoutPadrao = (
  definicao?: IFluxoDefinicao
): IAmbienteLayout => {

  const etapas = etapasDoFluxo(definicao);

  const visoes: IVisaoAmbiente[] = [
    { id: 'aguardando', nome: 'Aguardando você', icone: 'bell', cor: '#B45309', filtro: { tipo: 'aguardandoVoce' } },
    ...etapas.slice(0, 4).map((etapa, indice) => ({
      id: `etapa-${etapa.id}`,
      nome: etapa.nome,
      icone: 'workflow' as IconeChave,
      cor: CORES_VISAO[(indice === 1 ? 3 : indice === 2 ? 5 : 0)].cor,
      filtro: { tipo: 'etapas', etapas: [etapa.id] } as FiltroVisao
    })),
    { id: 'concluidos', nome: 'Concluídos', icone: 'checkCircle', cor: '#107C10', filtro: { tipo: 'situacao', situacoes: ['concluido'] } }
  ];

  return {
    versao: 1,
    visoes,
    colunas: COLUNAS_PADRAO.slice(),
    etapas: etapas.map(item => ({ elementoId: item.id, rotulo: '', visivel: true })),
    registro: { mostrarDados: true, mostrarHistorico: true, mostrarDiagrama: false, disposicao: 'duasColunas' },
    lista: { todosVeemTodos: false }
  };
};

export const lerLayout = (
  json?: string
): IAmbienteLayout | undefined => {
  if (!json) {
    return undefined;
  }
  try {
    const layout = JSON.parse(json) as IAmbienteLayout;
    return layout && layout.versao === 1 && Array.isArray(layout.visoes) ? layout : undefined;
  } catch {
    return undefined;
  }
};

// Ajusta um layout salvo ao fluxo ATUAL: etapas que saíram do desenho
// somem, etapas novas entram visíveis (na ordem do processo); colunas
// e filtros de campos que não existem mais são removidos.
export const normalizarLayout = (
  salvo: IAmbienteLayout | undefined,
  definicao?: IFluxoDefinicao
): IAmbienteLayout => {

  if (!salvo) {
    return layoutPadrao(definicao);
  }

  const etapasFluxo = etapasDoFluxo(definicao);
  const idsFluxo = etapasFluxo.map(item => item.id);
  const metadados = (definicao && definicao.metadados) || [];
  const chavesCampos = metadados.map(item => item.chave);

  // Sem fluxo publicado (ainda): mantém o que foi salvo.
  const etapas =
    !definicao
      ? salvo.etapas
      : salvo.etapas
        .filter(item => idsFluxo.indexOf(item.elementoId) >= 0)
        .concat(
          etapasFluxo
            .filter(item => !salvo.etapas.some(etapa => etapa.elementoId === item.id))
            .map(item => ({ elementoId: item.id, rotulo: '', visivel: true }))
        );

  const colunas =
    salvo.colunas.filter(chave =>
      COLUNAS_BASE.some(item => item.chave === chave) ||
      (chave.indexOf(PREFIXO_CAMPO_COLUNA) === 0 && (!definicao || chavesCampos.indexOf(chave.substring(PREFIXO_CAMPO_COLUNA.length)) >= 0)));

  const visoes =
    salvo.visoes.filter(visao =>
      !definicao ||
      (visao.filtro.tipo !== 'campo' || chavesCampos.indexOf(visao.filtro.campo) >= 0));

  return {
    versao: 1,
    visoes,
    colunas: colunas.length > 0 ? colunas : COLUNAS_PADRAO.slice(),
    etapas,
    registro: { ...{ mostrarDados: true, mostrarHistorico: true, mostrarDiagrama: false, disposicao: 'duasColunas' as const }, ...(salvo.registro || {}) },
    lista: { ...{ todosVeemTodos: false }, ...(salvo.lista || {}) }
  };
};

export const novaVisao = (): IVisaoAmbiente => ({
  id: gerarId(),
  nome: 'Nova visão',
  icone: 'grid',
  cor: CORES_VISAO[0].cor,
  filtro: { tipo: 'todos' }
});

// ------------------------------------------------------------
// Filtros das visões
// ------------------------------------------------------------

export interface IContextoFiltro {
  usuarioId: string;
  // Registros com etapa atual aguardando o usuário.
  aguardandoIds: string[];
  agora?: Date;
}

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const registroAtendeVisao = (
  registro: IAmbienteRegistro,
  filtro: FiltroVisao,
  contexto: IContextoFiltro
): boolean => {

  switch (filtro.tipo) {
    case 'todos':
      return true;
    case 'aguardandoVoce':
      return contexto.aguardandoIds.indexOf(registro.id) >= 0;
    case 'meus':
      return guid(registro.solicitanteId) === guid(contexto.usuarioId);
    case 'atrasados':
      return registro.situacao === 'emAndamento' &&
        !!registro.prazoEtapa &&
        new Date(registro.prazoEtapa).getTime() < (contexto.agora || new Date()).getTime();
    case 'etapas':
      return registro.situacao === 'emAndamento' &&
        !!registro.etapaAtualId &&
        filtro.etapas.indexOf(registro.etapaAtualId) >= 0;
    case 'situacao':
      return filtro.situacoes.indexOf(registro.situacao) >= 0;
    case 'campo': {
      const bruto = (registro.valores || {})[filtro.campo] || '';
      // Avaliação: compara a faixa atingida (ex.: "nogo").
      const valor = (faixaDoValor(bruto) || bruto).trim().toLowerCase();
      return filtro.valores.some(item => (item || '').trim().toLowerCase() === valor);
    }
    default:
      return true;
  }
};

export const descreverFiltro = (
  filtro: FiltroVisao,
  definicao?: IFluxoDefinicao
): string => {
  const nomeEtapa = (id: string): string => {
    const elemento = definicao ? definicao.elementos.find(item => item.id === id) : undefined;
    return elemento ? elemento.nome : '(etapa removida)';
  };
  switch (filtro.tipo) {
    case 'todos': return 'Todos os registros';
    case 'aguardandoVoce': return 'Etapa atual aguardando você';
    case 'meus': return 'Abertos por você';
    case 'atrasados': return 'Em andamento com prazo vencido';
    case 'etapas': return `Na etapa: ${filtro.etapas.map(nomeEtapa).join(' ou ') || '—'}`;
    case 'situacao': return `Situação: ${filtro.situacoes.map(item => item === 'emAndamento' ? 'Em andamento' : item === 'concluido' ? 'Concluído' : 'Cancelado').join(' ou ')}`;
    case 'campo': {
      const campo = definicao && definicao.metadados ? definicao.metadados.find(item => item.chave === filtro.campo) : undefined;
      const nome = (valor: string): string => {
        const faixa = campo && campo.avaliacao ? campo.avaliacao.faixas.find(item => item.chave === valor) : undefined;
        return faixa ? faixa.rotulo : valor === 'sim' ? 'Sim' : valor === 'nao' ? 'Não' : valor;
      };
      return `${campo ? campo.rotulo : filtro.campo} = ${filtro.valores.map(nome).join(' ou ')}`;
    }
    default: return '';
  }
};

// Campos do fluxo que podem filtrar uma visão (Lista, Sim/Não ou a
// faixa de uma Avaliação).
export const camposFiltraveis = (
  definicao?: IFluxoDefinicao
): IFluxoMetadado[] =>
  ((definicao && definicao.metadados) || []).filter(item => item.tipo === 'lista' || item.tipo === 'simNao' || item.tipo === 'avaliacao');

// ------------------------------------------------------------
// Barra de etapas do registro
// ------------------------------------------------------------

export type EstadoEtapa = 'concluida' | 'atual' | 'futura';

export const estadoDaEtapa = (
  elementoId: string,
  instancia?: IFluxoInstancia
): EstadoEtapa => {
  if (!instancia) {
    return 'futura';
  }
  if (instancia.status !== 'concluido' && instancia.elementoAtualId === elementoId) {
    return 'atual';
  }
  return instancia.percorridos.indexOf(elementoId) >= 0 ? 'concluida' : 'futura';
};
