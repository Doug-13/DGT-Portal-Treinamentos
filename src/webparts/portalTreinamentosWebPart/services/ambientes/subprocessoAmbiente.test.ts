import {
  IConfigSubprocesso,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  IAmbiente,
  IAmbienteRegistro
} from '../../models/Ambiente';

import {
  executarAcao,
  iniciarInstancia,
  subprocessoAguardando
} from '../fluxo/FluxoEngine';

import {
  IDependenciasSubprocessoAmbiente,
  avaliarFilhosAmbiente,
  executarSubprocessosAmbiente
} from './subprocessoAmbiente';

import {
  AmbienteFluxoService
} from './AmbienteFluxoService';

// ============================================================
// TESTES — subprocesso entre ambientes (Auditoria → Não Conformidades)
// Checklist: linha 1 C · linha 2 NC (com responsável) · linha 3 OBS ·
//            linha 4 NC (SEM responsável)
// ============================================================

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const acoes = [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }];

const config = (parcial: Partial<IConfigSubprocesso> = {}): IConfigSubprocesso => ({
  fluxoId: 'p-nc', fluxoNome: 'AMB-NAO-CONFORMIDADES', origem: 'tabela', campoTabela: 'checklist',
  filtroLinhas: { coluna: 'resultado', valores: ['NC'] }, campoReferencias: 'rnc', tipoDocumento: 'PDA',
  titulo: '{pai.codigo} — RNC item {coluna:numero}', autor: 'coluna:responsavel',
  mapeamentos: [{ origem: 'coluna:numero', destino: 'itemChecklist', somenteLeitura: true }], aguardar: 'todos', ...parcial
});

const definicao = (cfg: IConfigSubprocesso = config()): IFluxoDefinicao => ({
  id: 'f', nome: 'Auditoria', versao: 3, status: 'publicado', processoId: 'p-aud', tiposDocumento: [], larguraDiagrama: 10, alturaDiagrama: 10,
  metadados: [
    { chave: 'checklist', rotulo: 'Checklist', tipo: 'tabela', colunas: [
      { chave: 'numero', rotulo: 'Nº', tipo: 'texto' },
      { chave: 'resultado', rotulo: 'Resultado', tipo: 'lista', opcoes: ['C', 'NC', 'OBS'] },
      { chave: 'responsavel', rotulo: 'Responsável pela RNC', tipo: 'usuario' }
    ] },
    { chave: 'rnc', rotulo: 'RNC emitidos', tipo: 'documentos' }
  ],
  elementos: [
    { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
    { id: 'preencher', tipo: 'tarefaHumana', nome: 'Preencher checklist', posicao: pos, acoes,
      responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }],
      campos: [{ chave: 'checklist', rotulo: 'Checklist', tipo: 'tabela', obrigatorio: true }] } as IFluxoElemento,
    { id: 'emitir', tipo: 'subprocesso', nome: 'Emitir RNC das NC do checklist', responsaveis: [], acoes: [], campos: [], posicao: pos, subprocesso: cfg },
    { id: 'relatorio', tipo: 'tarefaHumana', nome: 'Emitir relatório', posicao: pos, acoes, campos: [],
      responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }] },
    { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
  ],
  transicoes: [
    { id: 't1', origemId: 'inicio', destinoId: 'preencher', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't2', origemId: 'preencher', destinoId: 'emitir', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't3', origemId: 'emitir', destinoId: 'relatorio', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't4', origemId: 'relatorio', destinoId: 'fim', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] }
  ]
});

const RESP = JSON.stringify({ id: 'u-william', nome: 'William Monteiro' });
const CHECKLIST = JSON.stringify([
  { numero: '1', resultado: 'C', responsavel: '' },
  { numero: '2', resultado: 'NC', responsavel: RESP },
  { numero: '3', resultado: 'OBS', responsavel: RESP },
  { numero: '4', resultado: 'NC', responsavel: '' }
]);

const ator = { id: 'u-douglas', nome: 'Douglas Mello', papeisTeste: ['autor'] };
const registroPai: IAmbienteRegistro = {
  id: 'reg-aud', ambienteId: 'a-aud', codigo: 'AUD-2026-0001', titulo: 'TESTE Auditoria', descricao: '', areaId: 'area-pro', areaNome: 'PROCESSOS',
  solicitanteId: 'u-douglas', solicitanteNome: 'Douglas Mello', situacao: 'emAndamento', etapaAtual: '', etapaAtualId: '', valores: {}, prazoEtapa: '', criadoEm: '', concluidoEm: ''
};
const ambienteNC = { id: 'a-nc', nome: 'Não Conformidades', chave: 'naoConformidades', processoId: 'p-nc', ativo: true } as IAmbiente;

const ateSubprocesso = (def: IFluxoDefinicao, checklist = CHECKLIST): IFluxoInstancia => {
  const inicio = iniciarInstancia(def, { revisaoId: 'reg-aud', documentoId: 'reg-aud', revisao: 'AUD-2026-0001', ator, simulado: false }).instancia as IFluxoInstancia;
  const r = executarAcao(def, inicio, { acaoChave: 'concluir', comentario: '', valores: { checklist }, ator });
  expect(r.erros).toEqual([]);
  return r.instancia as IFluxoInstancia;
};

interface IDepsTeste {
  deps: IDependenciasSubprocessoAmbiente;
  criados: Array<{ titulo: string; descricao: string; areaId: string; solicitante: string }>;
  inicios: Array<{ codigo: string; extras: unknown }>;
}

// semAmbiente = o fluxo não é de nenhum ambiente ativo.
const dependencias = (semAmbiente = false): IDepsTeste => {
  const ambiente: IAmbiente | undefined = semAmbiente ? undefined : ambienteNC;
  const criados: Array<{ titulo: string; descricao: string; areaId: string; solicitante: string }> = [];
  const inicios: Array<{ codigo: string; extras: unknown }> = [];
  const deps: IDependenciasSubprocessoAmbiente = {
    ambienteDoFluxo: async fluxoId => (ambiente && fluxoId === ambiente.processoId ? ambiente : undefined),
    criarRegistro: async (_amb, dados, solicitante) => {
      criados.push({ ...dados, solicitante: solicitante.nome });
      return { ...registroPai, id: `reg-nc-${criados.length}`, codigo: `NC-2026-000${criados.length}`, titulo: dados.titulo, solicitanteId: solicitante.id, solicitanteNome: solicitante.nome };
    },
    iniciarFluxo: async (_amb, registro, _s, extras) => { inicios.push({ codigo: registro.codigo, extras }); return []; }
  };
  return { deps, criados, inicios };
};

describe('Subprocesso Auditoria → Não Conformidades', () => {

  it('cria um registro por linha NC com responsável; linha NC sem responsável vira erro; aguarda', async () => {
    const def = definicao();
    const instancia = ateSubprocesso(def);
    expect(instancia.elementoAtualId).toBe('emitir');
    const { deps, criados, inicios } = dependencias();

    const r = await executarSubprocessosAmbiente(def, instancia, registroPai, deps);

    expect(criados).toEqual([{
      titulo: 'AUD-2026-0001 — RNC item 2', descricao: 'Criado por AUD-2026-0001 (Emitir RNC das NC do checklist, linha 2).',
      areaId: 'area-pro', solicitante: 'William Monteiro'
    }]);
    expect(inicios[0]).toEqual({ codigo: 'NC-2026-0001', extras: {
      valoresIniciais: { itemChecklist: '2' },
      origemSubprocesso: { documentoId: 'reg-aud', codigo: 'AUD-2026-0001', titulo: 'TESTE Auditoria', elementoNome: 'Emitir RNC das NC do checklist', linha: 2 },
      camposSomenteLeitura: ['itemChecklist']
    } });
    expect(r.erros).toEqual(['Linha 4: a coluna "Responsável pela RNC" (responsável) está vazia — registro não criado.']);

    const pedido = subprocessoAguardando(def, instancia);
    expect(pedido && pedido.status).toBe('parcial');
    expect(instancia.elementoAtualId).toBe('emitir');
    expect(JSON.parse(instancia.valores.rnc)).toEqual([{ id: 'reg-nc-1', codigo: 'NC-2026-0001', titulo: 'AUD-2026-0001 — RNC item 2' }]);
    expect(instancia.historico[0].acaoRotulo).toBe('Subprocesso: 1 registro(s) criado(s) em Não Conformidades: NC-2026-0001');
    expect(instancia.historico[0].comentario).toMatch(/Linha 4/);
  });

  it('não recria linhas que já viraram registro', async () => {
    const def = definicao();
    const instancia = ateSubprocesso(def);
    const { deps, criados } = dependencias();
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    (instancia.subprocessos || [])[0].status = 'pendente';
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    expect(criados).toHaveLength(1);
    expect(instancia.historico[0].acaoRotulo).toBe('Subprocesso: 1 linha(s) já tinham registro');
  });

  it('aguardar: só termina quando TODOS os registros terminam (concluído ou cancelado)', async () => {
    const def = definicao();
    const instancia = ateSubprocesso(def, JSON.stringify([
      { numero: '2', resultado: 'NC', responsavel: RESP },
      { numero: '5', resultado: 'NC', responsavel: RESP }
    ]));
    const { deps } = dependencias();
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    const pedido = subprocessoAguardando(def, instancia);
    if (!pedido) { throw new Error('sem pedido'); }
    expect(avaliarFilhosAmbiente(pedido, { 'reg-nc-1': 'concluido', 'reg-nc-2': 'emAndamento' })).toBe(false);
    expect(avaliarFilhosAmbiente(pedido, { 'reg-nc-2': 'cancelado' })).toBe(true);
  });

  it('sem nenhuma NC: segue na hora (nada a esperar)', async () => {
    const def = definicao();
    const instancia = ateSubprocesso(def, JSON.stringify([{ numero: '1', resultado: 'C', responsavel: RESP }]));
    const { deps, criados } = dependencias();
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    expect(criados).toHaveLength(0);
    expect(instancia.elementoAtualId).toBe('relatorio');
  });

  it('fluxo escolhido que não é de um ambiente ativo: erro e NÃO segue', async () => {
    const def = definicao();
    const instancia = ateSubprocesso(def);
    const { deps } = dependencias(true);
    const r = await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    expect(r.erros[0]).toMatch(/não é de um ambiente ativo/);
    expect(instancia.elementoAtualId).toBe('emitir');
  });

  it('liberar sem esperar: só o Administrador do Sistema', async () => {
    const servico = new AmbienteFluxoService({} as never);
    const r = await servico.conferirSubprocesso({} as never, registroPai, { perfil: 'Funcionario', usuarioId: 'u', nome: 'X' } as never, 'motivo qualquer');
    expect(r.erros).toEqual(['Somente o Administrador do Sistema pode liberar sem esperar.']);
  });
});
