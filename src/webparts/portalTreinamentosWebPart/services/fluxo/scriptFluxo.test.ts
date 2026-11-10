import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoTransicao
} from '../../models/Fluxo';

import {
  continuarAposScriptNaInstancia,
  executarAcao,
  iniciarInstancia,
  scriptPendente
} from './FluxoEngine';

import {
  validarDefinicao
} from './FluxoValidacao';

import {
  FluxoService
} from './FluxoService';

import {
  IFluxoRepositorio
} from './FluxoRepositorioLocal';

import {
  IConfigScript,
  filtrarSaidaScript,
  montarDocumentoScript,
  urlPermitida,
  validarConfigScript
} from './scriptFluxo';

// ============================================================
// TESTES — tarefa de sistema "Executar script"
// Cadastro (CEP) → Script (preenche endereço e cepEncontrado) →
// Decisão (cepEncontrado = sim → Confirmar; senão → Corrigir)
// ============================================================

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const resp = [{ tipo: 'autorRevisao' as const, descricao: 'Autor', papelTeste: 'autor' }];
const concluir = [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }];
const el = (id: string, tipo: IFluxoElemento['tipo'], nome: string, extra: Partial<IFluxoElemento> = {}): IFluxoElemento =>
  ({ id, tipo, nome, responsaveis: tipo === 'tarefaHumana' ? resp : [], acoes: tipo === 'tarefaHumana' ? concluir : [], campos: [], posicao: pos, ...extra });
const tr = (id: string, origemId: string, destinoId: string, extra: Partial<IFluxoTransicao> = {}): IFluxoTransicao =>
  ({ id, origemId, destinoId, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [], ...extra });

const script: IConfigScript = { codigo: 'return { valores: {} };', camposSaida: ['logradouro', 'cepEncontrado'], hostsPermitidos: ['viacep.com.br'] };

const definicao: IFluxoDefinicao = {
  id: 'f', nome: 'Cadastro', versao: 1, status: 'publicado', processoId: 'p', tiposDocumento: [], larguraDiagrama: 100, alturaDiagrama: 100,
  metadados: [
    { chave: 'cep', rotulo: 'CEP', tipo: 'texto' },
    { chave: 'logradouro', rotulo: 'Logradouro', tipo: 'texto' },
    { chave: 'cepEncontrado', rotulo: 'CEP encontrado?', tipo: 'simNao' }
  ],
  elementos: [
    el('inicio', 'inicio', 'Início'),
    el('cadastro', 'tarefaHumana', 'Cadastro', { campos: [{ chave: 'cep', rotulo: 'CEP', tipo: 'texto', obrigatorio: true }] }),
    el('buscarCep', 'tarefaSistema', 'Script: buscar CEP', { acaoSistema: 'executarScript', script }),
    el('decisao', 'gateway', 'CEP encontrado?'),
    el('confirmar', 'tarefaHumana', 'Confirmar endereço'),
    el('corrigir', 'tarefaHumana', 'Corrigir CEP'),
    el('fim', 'fim', 'Fim')
  ],
  transicoes: [
    tr('t1', 'inicio', 'cadastro'),
    tr('t2', 'cadastro', 'buscarCep'),
    tr('t3', 'buscarCep', 'decisao'),
    tr('t4', 'decisao', 'confirmar', { tipoCondicao: 'campo', campo: 'cepEncontrado', valorEsperado: 'sim' }),
    tr('t5', 'decisao', 'corrigir', { padrao: true }),
    tr('t6', 'confirmar', 'fim'),
    tr('t7', 'corrigir', 'cadastro', { excecao: true })
  ]
};

const ator = { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] };

const ateOScript = (): IFluxoInstancia => {
  const inicio = iniciarInstancia(definicao, { revisaoId: 'r1', documentoId: 'd1', revisao: 'Rev.00A', ator, simulado: false }).instancia as IFluxoInstancia;
  const r = executarAcao(definicao, inicio, { acaoChave: 'concluir', comentario: '', valores: { cep: '01001000' }, ator });
  expect(r.erros).toEqual([]);
  return r.instancia as IFluxoInstancia;
};

describe('Script no motor', () => {

  it('o fluxo PARA no script (sem tarefa humana)', () => {
    const instancia = ateOScript();
    expect(instancia.elementoAtualId).toBe('buscarCep');
    const pendente = scriptPendente(definicao, instancia);
    expect(pendente && pendente.id).toBe('buscarCep');
  });

  it('a decisão logo depois enxerga o campo que o script preencheu', () => {
    const achou = ateOScript();
    continuarAposScriptNaInstancia(definicao, achou, { valores: { logradouro: 'Praça da Sé', cepEncontrado: 'sim' }, mensagem: 'Endereço preenchido' });
    expect(achou.elementoAtualId).toBe('confirmar');
    expect(achou.valores.logradouro).toBe('Praça da Sé');
    expect(achou.historico[0].acaoRotulo).toBe('Script: Endereço preenchido');
    expect(achou.historico[0].comentario).toBe('Campos preenchidos: Logradouro, CEP encontrado?');

    const naoAchou = ateOScript();
    continuarAposScriptNaInstancia(definicao, naoAchou, { valores: { cepEncontrado: 'nao' } });
    expect(naoAchou.elementoAtualId).toBe('corrigir');
  });

  it('validação: script publicável; devolução que passa por script não é "publicação"', () => {
    expect(validarDefinicao(definicao)).toEqual([]);
    const duasSaidas = { ...definicao, transicoes: definicao.transicoes.concat(tr('t8', 'buscarCep', 'fim')) };
    expect(validarDefinicao(duasSaidas).join(' ')).toMatch(/exatamente uma ligação de saída/);
    const semCodigo = { ...definicao, elementos: definicao.elementos.map(item => (item.id === 'buscarCep' ? { ...item, script: { codigo: ' ', camposSaida: [] } } : item)) };
    expect(validarDefinicao(semCodigo).join(' ')).toMatch(/Escreva o script/);
  });
});

describe('Script: orquestração no FluxoService', () => {

  const montar = (executarScript: (elemento: IFluxoElemento) => Promise<{ valores: Record<string, string>; erros: string[]; log: string[] }>): {
    servico: FluxoService; gravados: IFluxoInstancia[]; iniciar: () => Promise<void>;
  } => {
    const gravados: IFluxoInstancia[] = [];
    let atual: IFluxoInstancia | undefined;
    const repositorio: IFluxoRepositorio = {
      local: false,
      obter: async () => atual,
      salvar: async instancia => { atual = instancia; gravados.push(JSON.parse(JSON.stringify(instancia))); return []; },
      remover: async () => undefined
    };
    const catalogo = { obterVersao: async () => definicao, versaoPublicada: async () => definicao } as unknown as ConstructorParameters<typeof FluxoService>[1];
    const metadados = { listar: async () => definicao.metadados || [] } as unknown as ConstructorParameters<typeof FluxoService>[2];
    const servico = new FluxoService(repositorio, catalogo, metadados);
    return {
      servico,
      gravados,
      iniciar: async () => {
        const r = await servico.iniciar({ id: 'p', codigo: 'CAD', nome: 'Cadastro', ativo: true } as never, { revisaoId: 'r1', documentoId: 'd1', revisao: 'Rev.00A', ator, simulado: false }, { executarScript: async elemento => executarScript(elemento) });
        expect(r.erros).toEqual([]);
      }
    };
  };

  it('sucesso: roda o script, aplica os campos e grava já na etapa certa', async () => {
    const teste = montar(async () => ({ valores: { logradouro: 'Praça da Sé', cepEncontrado: 'sim' }, erros: [], log: [] }));
    await teste.iniciar();
    const r = await teste.servico.executar('r1', { acaoChave: 'concluir', comentario: '', valores: { cep: '01001000' }, ator }, { executarScript: async () => ({ valores: { logradouro: 'Praça da Sé', cepEncontrado: 'sim' }, erros: [], log: [] }) });
    expect(r.erros).toEqual([]);
    const gravado = teste.gravados[teste.gravados.length - 1];
    expect(gravado.elementoAtualId).toBe('confirmar');
    expect(gravado.valores.cepEncontrado).toBe('sim');
  });

  it('erro no script: a ação NÃO é concluída e nada é gravado', async () => {
    const teste = montar(async () => ({ valores: {}, erros: [], log: [] }));
    await teste.iniciar();
    const antes = teste.gravados.length;
    const r = await teste.servico.executar('r1', { acaoChave: 'concluir', comentario: '', valores: { cep: '1' }, ator }, { executarScript: async () => ({ valores: {}, erros: ['CEP já cadastrado'], log: [] }) });
    expect(r.ok).toBe(false);
    expect(r.erros).toEqual(['Script "Script: buscar CEP": CEP já cadastrado']);
    expect(teste.gravados.length).toBe(antes);
  });

  it('sem executor (tela que não roda scripts): não avança', async () => {
    const teste = montar(async () => ({ valores: {}, erros: [], log: [] }));
    await teste.iniciar();
    const r = await teste.servico.executar('r1', { acaoChave: 'concluir', comentario: '', valores: { cep: '1' }, ator }, {});
    expect(r.ok).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não executa scripts/);
  });
});

describe('Script: regras de segurança', () => {

  it('só HTTPS para endereços liberados (e subdomínios)', () => {
    expect(urlPermitida('https://viacep.com.br/ws/01001000/json/', ['viacep.com.br']).ok).toBe(true);
    expect(urlPermitida('https://api.viacep.com.br/x', ['viacep.com.br']).ok).toBe(true);
    expect(urlPermitida('http://viacep.com.br/x', ['viacep.com.br']).ok).toBe(false);
    expect(urlPermitida('https://viacep.com.br.ataque.com/x', ['viacep.com.br']).ok).toBe(false);
    expect(urlPermitida('https://outro.com/x', ['viacep.com.br']).motivo).toMatch(/não está liberado/);
  });

  it('só grava os campos declarados, sempre como texto', () => {
    expect(filtrarSaidaScript(script, { logradouro: 'Rua A', cepEncontrado: true, senha: 'x', extra: 1 })).toEqual({ logradouro: 'Rua A', cepEncontrado: 'true' });
  });

  it('configuração: campos existentes e endereços válidos; script só de verificação é válido', () => {
    const metadados = definicao.metadados || [];
    expect(validarConfigScript('S', { codigo: 'return {}', camposSaida: [] }, metadados)).toEqual([]);
    expect(validarConfigScript('S', { codigo: 'x', camposSaida: ['naoExiste'] }, metadados).join(' ')).toMatch(/não existe/);
    expect(validarConfigScript('S', { codigo: 'x', camposSaida: [], hostsPermitidos: ['viacep'] }, metadados).join(' ')).toMatch(/inválido/);
  });

  it('o código não consegue fechar a tag <script> do documento isolado', () => {
    const documento = montarDocumentoScript('const s = "</script><b>x</b>";');
    expect(documento).not.toMatch(/"<\/script><b>/);
    expect(documento).toMatch(/<\\\/script><b>x<\/b>/);
  });
});
