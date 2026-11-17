import {
  IConfigSubprocesso,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  ISubprocessoSolicitado
} from '../../models/Fluxo';

import {
  IAmbiente,
  IAmbienteRegistro
} from '../../models/Ambiente';

import {
  executarAcao,
  iniciarInstancia,
  liberarSubprocesso,
  subprocessoAguardando
} from '../fluxo/FluxoEngine';

import {
  herdarFilhosEmAndamento
} from '../fluxo/subprocesso/regrasSubprocesso';

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

// ============================================================
// Nova passagem pelo MESMO subprocesso (o fluxo voltou a ele): as linhas
// já viraram RNC e não são recriadas, mas o fluxo precisa continuar
// esperando os RNC ainda em andamento — antes seguia na hora com
// "nenhum documento criado — fluxo retomado" (caso AUD-2026-0002).
// ============================================================

describe('Subprocesso com aguardar — retorno ao mesmo subprocesso', () => {

  // "Emitir relatório" ganha um botão que volta para "Emitir RNC".
  const definicaoComRetorno = (): IFluxoDefinicao => {
    const def = definicao();
    const relatorio = def.elementos.filter(item => item.id === 'relatorio')[0];
    relatorio.acoes = acoes.concat([{ chave: 'refazer', rotulo: 'Voltar ao RNC', resultado: 'refazer', principal: false, exigeComentario: false }]);
    def.transicoes = def.transicoes
      .map(item => (item.id === 't4' ? { ...item, tipoCondicao: 'resultado' as const, resultado: 'concluido' } : item))
      .concat([{ id: 't5', origemId: 'relatorio', destinoId: 'emitir', tipoCondicao: 'resultado', resultado: 'refazer', padrao: false, excecao: true, pontos: [] }]);
    return def;
  };

  const DUAS_NC = JSON.stringify([
    { numero: '4', resultado: 'NC', responsavel: RESP },
    { numero: '5', resultado: 'NC', responsavel: RESP }
  ]);

  it('não segue enquanto os RNC criados na passagem anterior estiverem em andamento', async () => {
    const def = definicaoComRetorno();
    let instancia = ateSubprocesso(def, DUAS_NC);
    const { deps, criados } = dependencias();

    // 1ª passagem: cria os 2 RNC e aguarda.
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    expect(criados).toHaveLength(2);
    expect(instancia.elementoAtualId).toBe('emitir');

    // Liberado sem esperar (ex.: administrador) e, no relatório, o fluxo
    // volta ao subprocesso.
    const liberado = liberarSubprocesso(def, instancia, 'administrador', { id: 'adm', nome: 'Admin' }, 'teste');
    expect(liberado.erros).toEqual([]);
    instancia = liberado.instancia as IFluxoInstancia;
    expect(instancia.elementoAtualId).toBe('relatorio');
    const volta = executarAcao(def, instancia, { acaoChave: 'refazer', comentario: '', valores: {}, ator });
    expect(volta.erros).toEqual([]);
    instancia = volta.instancia as IFluxoInstancia;
    expect(instancia.elementoAtualId).toBe('emitir');

    // 2ª passagem: nada novo a criar, mas os 2 RNC seguem abertos → espera.
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    expect(criados).toHaveLength(2);
    expect(instancia.elementoAtualId).toBe('emitir');
    const pedido = subprocessoAguardando(def, instancia);
    if (!pedido) { throw new Error('o fluxo deveria estar aguardando'); }
    expect(pedido.filhos.map(item => item.codigo)).toEqual(['NC-2026-0001', 'NC-2026-0002']);
    expect(instancia.historico[0].acaoRotulo).toBe(
      'Subprocesso: 2 linha(s) já tinham registro · aguardando também 2 registro(s) ainda em andamento: NC-2026-0001, NC-2026-0002'
    );
    expect(instancia.historico.some(item => item.acaoRotulo === 'Subprocesso: nenhum documento criado — fluxo retomado')).toBe(false);

    // Só segue quando os dois terminam.
    expect(avaliarFilhosAmbiente(pedido, { 'reg-nc-1': 'concluido', 'reg-nc-2': 'emAndamento' })).toBe(false);
    expect(avaliarFilhosAmbiente(pedido, { 'reg-nc-2': 'concluido' })).toBe(true);
  });

  it('RNC anteriores já terminados não seguram o fluxo', async () => {
    const def = definicaoComRetorno();
    let instancia = ateSubprocesso(def, DUAS_NC);
    const { deps } = dependencias();
    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);
    const primeiro = subprocessoAguardando(def, instancia);
    if (!primeiro) { throw new Error('sem pedido'); }
    expect(avaliarFilhosAmbiente(primeiro, { 'reg-nc-1': 'concluido', 'reg-nc-2': 'cancelado' })).toBe(true);
    instancia = liberarSubprocesso(def, instancia, 'concluidos', { id: 'sistema', nome: 'Sistema' }).instancia as IFluxoInstancia;
    instancia = executarAcao(def, instancia, { acaoChave: 'refazer', comentario: '', valores: {}, ator }).instancia as IFluxoInstancia;

    await executarSubprocessosAmbiente(def, instancia, registroPai, deps);

    expect(instancia.elementoAtualId).toBe('relatorio');
  });

  it('pedido anterior que ainda aguardava passa a espera para o novo (sem pedido órfão)', () => {
    const filho = (n: number, concluido = false): { documentoId: string; codigo: string; titulo: string; assinatura: string; criadoEm: string; concluido: boolean } =>
      ({ documentoId: `reg-${n}`, codigo: `RNC-${n}`, titulo: `RNC ${n}`, assinatura: `l${n}`, criadoEm: '', concluido });
    const antigo = { id: 'p1', elementoId: 'emitir', elementoNome: 'Emitir', solicitadoEm: '', status: 'concluido' as const, aguardando: true, filhos: [filho(1), filho(2, true)] };
    const novo: ISubprocessoSolicitado = { id: 'p2', elementoId: 'emitir', elementoNome: 'Emitir', solicitadoEm: '', status: 'pendente', aguardando: true, filhos: [] };
    const outroElemento = { id: 'p3', elementoId: 'outro', elementoNome: 'Outro', solicitadoEm: '', status: 'concluido' as const, aguardando: true, filhos: [filho(3)] };

    const herdados = herdarFilhosEmAndamento([antigo, novo, outroElemento], novo, '2026-11-17T10:00:00.000Z');

    expect(herdados.map(item => item.codigo)).toEqual(['RNC-1']);
    expect(novo.filhos.map(item => item.codigo)).toEqual(['RNC-1']);
    expect(antigo.aguardando).toBe(false);
    expect((antigo as { assumidoPor?: string }).assumidoPor).toBe('p2');
    expect(outroElemento.aguardando).toBe(true);
  });
});
