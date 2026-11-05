import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoTransicao
} from '../../models/Fluxo';

import {
  IAmbienteRegistro
} from '../../models/Ambiente';

import {
  estadoDaEtapa,
  etapasDoFluxo,
  layoutPadrao,
  normalizarLayout,
  registroAtendeVisao
} from './layoutAmbiente';

// ============================================================
// TESTES — telas configuráveis dos ambientes
// Fluxo: Início → Dados da demanda → Go/No-Go (decisão) → Seleção de
// kit → Fim, com devolução de Go/No-Go para Dados da demanda.
// ============================================================

const posicao = { x: 0, y: 0, largura: 10, altura: 10 };
const el = (id: string, tipo: IFluxoElemento['tipo'], nome: string): IFluxoElemento =>
  ({ id, tipo, nome, responsaveis: [], acoes: [], campos: [], posicao });
const tr = (id: string, origemId: string, destinoId: string, excecao = false): IFluxoTransicao =>
  ({ id, origemId, destinoId, tipoCondicao: 'sempre' as const, padrao: false, excecao, pontos: [] });

const definicao: IFluxoDefinicao = {
  id: 'f', nome: 'B.O.M.', versao: 1, status: 'publicado', processoId: 'p', tiposDocumento: [],
  larguraDiagrama: 100, alturaDiagrama: 100,
  metadados: [
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'prioridade', rotulo: 'Prioridade', tipo: 'lista', opcoes: ['Alta', 'Baixa'] }
  ],
  elementos: [
    el('inicio', 'inicio', 'Início'),
    el('kit', 'tarefaHumana', 'Seleção de kit'),
    el('dados', 'tarefaHumana', 'Dados da demanda'),
    el('go', 'tarefaHumana', 'Matriz Go/No-Go'),
    el('dec', 'gateway', 'Aprovado?'),
    el('fim', 'fim', 'Fim')
  ],
  transicoes: [
    tr('t1', 'inicio', 'dados'),
    tr('t2', 'dados', 'go'),
    tr('t3', 'go', 'dec'),
    tr('t4', 'dec', 'dados', true),
    tr('t5', 'dec', 'kit'),
    tr('t6', 'kit', 'fim')
  ]
};

const registro = (parcial: Partial<IAmbienteRegistro>): IAmbienteRegistro => ({
  id: 'r1', ambienteId: 'a', codigo: 'BOM-2026-0001', titulo: 'x', descricao: '', areaId: '', areaNome: '',
  solicitanteId: 'u1', solicitanteNome: 'Ana', situacao: 'emAndamento', etapaAtual: 'Matriz Go/No-Go',
  etapaAtualId: 'go', valores: { prioridade: 'Alta' }, prazoEtapa: '', criadoEm: '', concluidoEm: '',
  ...parcial
});

describe('Telas configuráveis dos ambientes', () => {

  it('etapas na ordem do processo (não na ordem do desenho)', () => {
    expect(etapasDoFluxo(definicao).map(item => item.id)).toEqual(['dados', 'go', 'kit']);
  });

  it('layout padrão: visões por etapa, colunas básicas e todas as etapas', () => {
    const layout = layoutPadrao(definicao);
    expect(layout.visoes.map(item => item.nome)).toEqual(['Aguardando você', 'Dados da demanda', 'Matriz Go/No-Go', 'Seleção de kit', 'Concluídos']);
    expect(layout.etapas.map(item => item.elementoId)).toEqual(['dados', 'go', 'kit']);
    expect(layout.colunas).toContain('codigo');
    expect(layout.lista.todosVeemTodos).toBe(false);
  });

  it('normaliza o layout salvo quando o fluxo muda', () => {
    const salvo = {
      ...layoutPadrao(definicao),
      etapas: [{ elementoId: 'go', rotulo: 'Go/No-Go', visivel: true }, { elementoId: 'removida', rotulo: '', visivel: true }],
      colunas: ['codigo', 'campo:cliente', 'campo:sumiu']
    };
    const layout = normalizarLayout(salvo, definicao);
    // etapa removida sai; as novas entram; o nome personalizado fica.
    expect(layout.etapas.map(item => item.elementoId)).toEqual(['go', 'dados', 'kit']);
    expect(layout.etapas[0].rotulo).toBe('Go/No-Go');
    expect(layout.colunas).toEqual(['codigo', 'campo:cliente']);
  });

  it('filtros das visões', () => {
    const ctx = { usuarioId: 'u1', aguardandoIds: ['r1'] };
    const r = registro({});
    expect(registroAtendeVisao(r, { tipo: 'etapas', etapas: ['go'] }, ctx)).toBe(true);
    expect(registroAtendeVisao(r, { tipo: 'etapas', etapas: ['kit'] }, ctx)).toBe(false);
    expect(registroAtendeVisao(r, { tipo: 'aguardandoVoce' }, ctx)).toBe(true);
    expect(registroAtendeVisao(r, { tipo: 'meus' }, { ...ctx, usuarioId: 'outro' })).toBe(false);
    expect(registroAtendeVisao(r, { tipo: 'campo', campo: 'prioridade', valores: ['alta'] }, ctx)).toBe(true);
    expect(registroAtendeVisao(r, { tipo: 'situacao', situacoes: ['concluido'] }, ctx)).toBe(false);
    expect(registroAtendeVisao(registro({ prazoEtapa: '2000-01-01T00:00:00Z' }), { tipo: 'atrasados' }, ctx)).toBe(true);
    // concluído não conta como "na etapa"
    expect(registroAtendeVisao(registro({ situacao: 'concluido' }), { tipo: 'etapas', etapas: ['go'] }, ctx)).toBe(false);
  });

  it('estado de cada etapa na barra do registro', () => {
    const instancia = { status: 'emAndamento', elementoAtualId: 'go', percorridos: ['inicio', 'dados', 'go'] } as unknown as IFluxoInstancia;
    expect(estadoDaEtapa('dados', instancia)).toBe('concluida');
    expect(estadoDaEtapa('go', instancia)).toBe('atual');
    expect(estadoDaEtapa('kit', instancia)).toBe('futura');
  });
});
