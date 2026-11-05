import {
  calcularAvaliacao,
  configAvaliacaoPadrao,
  faixaDoValor,
  formatarValorAvaliacao,
  gravarValorAvaliacao,
  validarAvaliacao,
  validarConfigAvaliacao
} from './valorAvaliacao';

import {
  escolherTransicao,
  formatarValorCampo
} from './FluxoEngine';

import {
  validarDefinicao
} from './FluxoValidacao';

import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoTransicao
} from '../../models/Fluxo';

import {
  registroAtendeVisao
} from '../ambientes/layoutAmbiente';

import {
  IAmbienteRegistro
} from '../../models/Ambiente';

// ============================================================
// TESTES — campo Avaliação (Matriz Go/No-Go)
// Caso de referência = tela da Arquitetura de Soluções:
// 5,5,5,3,3,5,5,5 → 92/100, GO; perde 4 em Prazo e 4 em Competitividade.
// ============================================================

const config = configAvaliacaoPadrao();

const NOTAS_TELA: Record<string, number> = {
  aderencia: 5, tecnica: 5, financeira: 5, prazo: 3, competitividade: 3, risco: 5, capacidade: 5, estrategico: 5
};

describe('Campo Avaliação — cálculo', () => {

  it('reproduz a Matriz Go/No-Go da Arquitetura (92 / GO)', () => {
    const resultado = calcularAvaliacao(config, NOTAS_TELA);
    expect(resultado.total).toBe(92);
    expect(resultado.maximo).toBe(100);
    expect(resultado.completo).toBe(true);
    expect(resultado.faixa && resultado.faixa.chave).toBe('go');
    const perdas = resultado.itens.filter(item => item.perdidos > 0).map(item => `${item.chave}:${item.perdidos}`);
    expect(perdas).toEqual(['prazo:4', 'competitividade:4']);
  });

  it('faixas: GO com restrição e NO-GO pelos mínimos', () => {
    const notas = (valor: number): Record<string, number> =>
      config.criterios.reduce((acc: Record<string, number>, item) => { acc[item.chave] = valor; return acc; }, {});
    expect((calcularAvaliacao(config, notas(4)).faixa || { chave: '' }).chave).toBe('go');          // 80
    expect((calcularAvaliacao(config, notas(3)).faixa || { chave: '' }).chave).toBe('restricao');   // 60
    expect((calcularAvaliacao(config, notas(2)).faixa || { chave: '' }).chave).toBe('nogo');        // 40
  });

  it('incompleta não tem faixa; obrigatória exige todas as notas', () => {
    const resultado = calcularAvaliacao(config, { aderencia: 5 });
    expect(resultado.completo).toBe(false);
    expect(resultado.faixa).toBeUndefined();
    const valor = gravarValorAvaliacao(config, { aderencia: 5 }, {});
    expect(validarAvaliacao('Go/No-Go', config, valor, true).join(' ')).toMatch(/dê nota/);
    expect(validarAvaliacao('Go/No-Go', config, valor, false)).toEqual([]);
  });

  it('justificativa obrigatória para notas baixas', () => {
    const comRegra = { ...config, justificativaAte: 2 };
    const notas = { ...NOTAS_TELA, prazo: 2 };
    expect(validarAvaliacao('Go/No-Go', comRegra, gravarValorAvaliacao(comRegra, notas, {}), true).join(' ')).toMatch(/justifique.*Prazo/);
    expect(validarAvaliacao('Go/No-Go', comRegra, gravarValorAvaliacao(comRegra, notas, { prazo: 'Edital curto' }), true)).toEqual([]);
  });

  it('cálculo por SOMA (nota × peso)', () => {
    const soma = {
      ...config,
      calculo: 'soma' as const,
      criterios: [{ chave: 'a', rotulo: 'A', peso: 2 }, { chave: 'b', rotulo: 'B', peso: 3 }],
      faixas: [{ chave: 'alto', rotulo: 'Alto', minimo: 20, cor: '#107C10' }, { chave: 'baixo', rotulo: 'Baixo', minimo: 0, cor: '#B42318' }]
    };
    const resultado = calcularAvaliacao(soma, { a: 5, b: 4 });
    expect(resultado.total).toBe(22);     // 5×2 + 4×3
    expect(resultado.maximo).toBe(25);
    expect(resultado.faixa && resultado.faixa.chave).toBe('alto');
  });

  it('valor gravado guarda total e faixa (listas, histórico, condições)', () => {
    const valor = gravarValorAvaliacao(config, NOTAS_TELA, { prazo: '  ' });
    expect(faixaDoValor(valor)).toBe('go');
    expect(formatarValorAvaliacao(valor)).toBe('GO · 92 pts');
    expect(formatarValorAvaliacao(valor, config)).toBe('GO · 92/100');
    expect(formatarValorCampo('avaliacao', valor)).toBe('GO · 92 pts');
    // Justificativa vazia não é gravada.
    expect(JSON.parse(valor).justificativas).toEqual({});
  });

  it('configuração inválida é recusada', () => {
    expect(validarConfigAvaliacao('X', undefined).length).toBeGreaterThan(0);
    expect(validarConfigAvaliacao('X', { ...config, criterios: [] }).join(' ')).toMatch(/pelo menos um critério/);
    expect(validarConfigAvaliacao('X', { ...config, faixas: [{ chave: 'go', rotulo: 'GO', minimo: 80, cor: '#107C10' }] }).join(' ')).toMatch(/mínimo 0/);
  });
});

describe('Campo Avaliação — no fluxo e nos ambientes', () => {

  const posicao = { x: 0, y: 0, largura: 10, altura: 10 };
  const el = (id: string, tipo: IFluxoElemento['tipo'], nome: string): IFluxoElemento =>
    ({ id, tipo, nome, responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'a' }], acoes: [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }], campos: [], posicao });
  const tr = (id: string, origemId: string, destinoId: string, extra: Partial<IFluxoTransicao> = {}): IFluxoTransicao =>
    ({ id, origemId, destinoId, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [], ...extra });

  const definicao: IFluxoDefinicao = {
    id: 'f', nome: 'Go/No-Go', versao: 1, status: 'rascunho', processoId: 'p', tiposDocumento: [],
    larguraDiagrama: 100, alturaDiagrama: 100,
    metadados: [{ chave: 'goNoGo', rotulo: 'Matriz Go/No-Go', tipo: 'avaliacao', avaliacao: config }],
    elementos: [
      { ...el('inicio', 'inicio', 'Início'), responsaveis: [], acoes: [] },
      { ...el('avaliar', 'tarefaHumana', 'Matriz Go/No-Go'), campos: [{ chave: 'goNoGo', rotulo: 'Matriz Go/No-Go', tipo: 'avaliacao', obrigatorio: true, avaliacao: config }] },
      { ...el('decisao', 'gateway', 'Resultado?'), responsaveis: [], acoes: [] },
      el('kit', 'tarefaHumana', 'Seleção de kit'),
      el('bloqueado', 'tarefaHumana', 'Bloqueado no Go/No-Go'),
      { ...el('fim', 'fim', 'Fim'), responsaveis: [], acoes: [] }
    ],
    transicoes: [
      tr('t1', 'inicio', 'avaliar'),
      tr('t2', 'avaliar', 'decisao'),
      tr('t3', 'decisao', 'bloqueado', { tipoCondicao: 'campo', campo: 'goNoGo', valorEsperado: 'nogo' }),
      tr('t4', 'decisao', 'kit', { padrao: true }),
      tr('t5', 'kit', 'fim'),
      tr('t6', 'bloqueado', 'fim')
    ]
  };

  it('a decisão do fluxo usa a faixa da avaliação', () => {
    const go = gravarValorAvaliacao(config, NOTAS_TELA, {});
    const notasNoGo = Object.keys(NOTAS_TELA).reduce((acc: Record<string, number>, chave) => { acc[chave] = 1; return acc; }, {});
    const nogo = gravarValorAvaliacao(config, notasNoGo, {});
    expect((escolherTransicao(definicao, 'decisao', 'concluido', { goNoGo: go }) || { destinoId: '' }).destinoId).toBe('kit');
    expect((escolherTransicao(definicao, 'decisao', 'concluido', { goNoGo: nogo }) || { destinoId: '' }).destinoId).toBe('bloqueado');
  });

  it('publicação valida a faixa usada na condição', () => {
    expect(validarDefinicao(definicao).filter(erro => /faixa|avaliação/i.test(erro))).toEqual([]);
    const errada = { ...definicao, transicoes: definicao.transicoes.map(t => (t.id === 't3' ? { ...t, valorEsperado: 'NO-GO' } : t)) };
    expect(validarDefinicao(errada).join(' ')).toMatch(/não é uma faixa dela \(use: go, restricao, nogo\)/);
  });

  it('visão do ambiente filtra pela faixa', () => {
    const registro = {
      id: 'r', ambienteId: 'a', codigo: 'BOM-1', titulo: 'x', descricao: '', areaId: '', areaNome: '', solicitanteId: 'u',
      solicitanteNome: '', situacao: 'emAndamento', etapaAtual: '', etapaAtualId: '', prazoEtapa: '', criadoEm: '', concluidoEm: '',
      valores: { goNoGo: gravarValorAvaliacao(config, NOTAS_TELA, {}) }
    } as IAmbienteRegistro;
    const ctx = { usuarioId: 'u', aguardandoIds: [] };
    expect(registroAtendeVisao(registro, { tipo: 'campo', campo: 'goNoGo', valores: ['go'] }, ctx)).toBe(true);
    expect(registroAtendeVisao(registro, { tipo: 'campo', campo: 'goNoGo', valores: ['nogo'] }, ctx)).toBe(false);
  });
});
