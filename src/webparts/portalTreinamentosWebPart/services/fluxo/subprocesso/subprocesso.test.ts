import {
  IConfigSubprocesso,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia
} from '../../../models/Fluxo';

import {
  executarAcao,
  iniciarInstancia,
  liberarSubprocesso,
  subprocessoAguardando
} from '../FluxoEngine';

import {
  validarDefinicao
} from '../FluxoValidacao';

import {
  tipoBpmnDoElemento,
  tipoFluxoDoBpmn
} from '../bpmn/bpmnConversao';

import {
  assinaturaLinha,
  assinaturasCriadas,
  autorDoFilho,
  juntarReferencias,
  linhasDoSubprocesso,
  montarTitulo,
  proximoCodigoDocumento,
  valoresIniciaisDoFilho
} from './regrasSubprocesso';

// ============================================================
// TESTES — SUBPROCESSO (auditoria → planos de ação)
// ============================================================

const posicao = { x: 0, y: 0, largura: 100, altura: 60 };

const etapa = (parcial: Partial<IFluxoElemento>): IFluxoElemento => ({
  id: 'x',
  tipo: 'tarefaHumana',
  nome: 'Etapa',
  responsaveis: [],
  acoes: [],
  campos: [],
  posicao,
  ...parcial
});

const configSub: IConfigSubprocesso = {
  fluxoId: 'fluxo-plano',
  fluxoNome: 'PDA — Plano de Ação',
  origem: 'tabela',
  campoTabela: 'acoes',
  campoReferencias: 'acoesAbertas',
  tipoDocumento: 'PDA',
  titulo: '{pai.codigo} — Ação {n}: {coluna:oque}',
  autor: 'coluna:responsavel',
  mapeamentos: [
    { origem: 'coluna:prazo', destino: 'prazo' },
    { origem: 'pai:referencia', destino: 'auditoriaOrigem' }
  ]
};

const definicao: IFluxoDefinicao = {
  id: 'fluxo-auditoria',
  nome: 'Auditoria',
  versao: 1,
  status: 'publicado',
  processoId: 'fluxo-auditoria',
  tiposDocumento: [],
  larguraDiagrama: 800,
  alturaDiagrama: 200,
  metadados: [
    {
      chave: 'acoes',
      rotulo: 'Ações',
      tipo: 'tabela',
      colunas: [
        { chave: 'oque', rotulo: 'O quê', tipo: 'texto', obrigatoria: true },
        { chave: 'responsavel', rotulo: 'Responsável', tipo: 'usuario' },
        { chave: 'prazo', rotulo: 'Prazo', tipo: 'data' }
      ]
    },
    { chave: 'acoesAbertas', rotulo: 'Ações abertas', tipo: 'documentos' }
  ],
  elementos: [
    etapa({ id: 'inicio', tipo: 'inicio', nome: 'Início' }),
    etapa({
      id: 'registrar',
      nome: 'Registrar constatações',
      responsaveis: [{ tipo: 'autorRevisao', descricao: 'Auditor', papelTeste: 'auditor' }],
      acoes: [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }],
      campos: [{
        chave: 'acoes',
        rotulo: 'Ações',
        tipo: 'tabela',
        obrigatorio: false,
        colunas: [
          { chave: 'oque', rotulo: 'O quê', tipo: 'texto', obrigatoria: true },
          { chave: 'responsavel', rotulo: 'Responsável', tipo: 'usuario' },
          { chave: 'prazo', rotulo: 'Prazo', tipo: 'data' }
        ]
      }]
    }),
    etapa({ id: 'sub', tipo: 'subprocesso', nome: 'Abrir planos de ação', subprocesso: configSub }),
    etapa({
      id: 'verificar',
      nome: 'Verificar eficácia',
      responsaveis: [{ tipo: 'autorRevisao', descricao: 'Auditor', papelTeste: 'auditor' }],
      acoes: [
        { chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false },
        { chave: 'devolver', rotulo: 'Devolver', resultado: 'devolvido', principal: false, exigeComentario: true }
      ]
    }),
    etapa({ id: 'fim', tipo: 'fim', nome: 'Fim' })
  ],
  transicoes: [
    { id: 't1', origemId: 'inicio', destinoId: 'registrar', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't2', origemId: 'registrar', destinoId: 'sub', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't3', origemId: 'sub', destinoId: 'verificar', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't4', origemId: 'verificar', destinoId: 'fim', tipoCondicao: 'resultado', resultado: 'concluido', padrao: false, excecao: false, pontos: [] },
    { id: 't5', origemId: 'verificar', destinoId: 'registrar', tipoCondicao: 'resultado', resultado: 'devolvido', padrao: false, excecao: true, pontos: [] }
  ]
};

const usuario = (id: string, nome: string): string => JSON.stringify({ id, nome, email: `${nome}@dgt` });

const ACOES = JSON.stringify([
  { oque: 'Calibrar balança', responsavel: usuario('11111111-1111-1111-1111-111111111111', 'Ana'), prazo: '2026-12-01' },
  { oque: '', responsavel: '', prazo: '' },
  { oque: 'Treinar equipe', responsavel: usuario('22222222-2222-2222-2222-222222222222', 'Bruno'), prazo: '2026-12-15' }
]);

const auditor = { id: 'auditor-1', nome: 'Carla', papeisTeste: ['auditor'] };

const iniciar = (): IFluxoInstancia => {
  const resultado = iniciarInstancia(definicao, {
    revisaoId: 'rev-aud', documentoId: 'doc-aud', revisao: 'Rev.00A', ator: auditor, simulado: true
  });
  expect(resultado.erros).toEqual([]);
  return resultado.instancia as IFluxoInstancia;
};

describe('Subprocesso no motor do fluxo', () => {

  it('é a Call Activity do BPMN', () => {
    expect(tipoFluxoDoBpmn('bpmn:CallActivity')).toBe('subprocesso');
    expect(tipoBpmnDoElemento('subprocesso')).toBe('bpmn:CallActivity');
  });

  it('pede a criação dos documentos, guarda quem disparou e segue sem esperar', () => {
    const resultado = executarAcao(definicao, iniciar(), {
      acaoChave: 'concluir', comentario: '', valores: { acoes: ACOES }, ator: auditor
    });

    expect(resultado.erros).toEqual([]);
    expect(resultado.acoesSistema).toContain('criarSubprocessos');

    const instancia = resultado.instancia as IFluxoInstancia;
    expect(instancia.elementoAtualId).toBe('verificar');
    expect(instancia.subprocessos).toHaveLength(1);
    expect(instancia.subprocessos && instancia.subprocessos[0].status).toBe('pendente');
    expect(instancia.subprocessos && instancia.subprocessos[0].executorId).toBe('auditor-1');
    expect(instancia.historico.some(passo => passo.acaoChave === 'criarSubprocessos')).toBe(true);
  });

  it('não apaga as referências aos filhos ao devolver para uma etapa anterior', () => {
    const depois = executarAcao(definicao, iniciar(), {
      acaoChave: 'concluir', comentario: '', valores: { acoes: ACOES }, ator: auditor
    }).instancia as IFluxoInstancia;

    // O executor grava os filhos no campo de referências.
    depois.valores.acoesAbertas = JSON.stringify([{ id: 'f1', codigo: 'QUA-PDA-001', titulo: 'x' }]);

    const devolvido = executarAcao(definicao, depois, {
      acaoChave: 'devolver', comentario: 'refazer', valores: {}, ator: auditor
    });

    expect(devolvido.erros).toEqual([]);
    const instancia = devolvido.instancia as IFluxoInstancia;
    expect(instancia.elementoAtualId).toBe('registrar');
    expect(instancia.valores.acoesAbertas).toContain('QUA-PDA-001');
  });

  it('aceita valores iniciais e a origem ao iniciar o fluxo filho', () => {
    const resultado = iniciarInstancia(definicao, {
      revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00A', ator: auditor, simulado: true,
      valoresIniciais: { prazo: '2026-12-01' },
      origemSubprocesso: { documentoId: 'doc-aud', codigo: 'QUA-AUD-001', titulo: 'Auditoria' }
    });
    const instancia = resultado.instancia as IFluxoInstancia;
    expect(instancia.valores.prazo).toBe('2026-12-01');
    expect(instancia.origemSubprocesso && instancia.origemSubprocesso.codigo).toBe('QUA-AUD-001');
  });
});

describe('Validação do subprocesso na publicação', () => {

  it('aceita a configuração completa', () => {
    expect(validarDefinicao(definicao).filter(erro => /subprocesso/i.test(erro))).toEqual([]);
  });

  it('exige fluxo, campo de referências do tipo certo e proíbe o mesmo fluxo', () => {
    const comConfig = (config: Partial<IConfigSubprocesso>): IFluxoDefinicao => ({
      ...definicao,
      elementos: definicao.elementos.map(item =>
        item.id === 'sub' ? { ...item, subprocesso: { ...configSub, ...config } } : item)
    });

    expect(validarDefinicao(comConfig({ fluxoId: '' })).join(' ')).toMatch(/Escolha o fluxo/);
    expect(validarDefinicao(comConfig({ fluxoId: 'fluxo-auditoria' })).join(' ')).toMatch(/mesmo fluxo/);
    expect(validarDefinicao(comConfig({ campoReferencias: 'acoes' })).join(' ')).toMatch(/Documentos referenciados/);
    expect(validarDefinicao(comConfig({ autor: 'coluna:oque' })).join(' ')).toMatch(/tipo Usuário/);
  });
});

describe('Regras do subprocesso', () => {

  const pai = { id: 'doc-aud', codigo: 'QUA-AUD-001', titulo: 'Auditoria interna' };
  const linhas = linhasDoSubprocesso(configSub, { acoes: ACOES });

  it('uma linha preenchida = um documento (linhas vazias ignoradas)', () => {
    expect(linhas).toHaveLength(2);
    expect(linhas[1].numero).toBe(2);
    expect(linhasDoSubprocesso({ ...configSub, origem: 'unico' }, {})).toHaveLength(1);
  });

  it('monta o título com os marcadores', () => {
    expect(montarTitulo(configSub.titulo, pai, 1, linhas[0].linha, {}))
      .toBe('QUA-AUD-001 — Ação 1: Calibrar balança');
  });

  it('autor vem da coluna Usuário da linha (ou de quem executou)', () => {
    expect(autorDoFilho(configSub, linhas[0].linha, 'exec', 'autorPai')).toBe('11111111-1111-1111-1111-111111111111');
    expect(autorDoFilho({ ...configSub, autor: 'executor' }, linhas[0].linha, 'exec', 'autorPai')).toBe('exec');
    expect(autorDoFilho({ ...configSub, autor: 'autorPai' }, linhas[0].linha, 'exec', 'autorPai')).toBe('autorPai');
  });

  it('leva os valores mapeados e a referência ao pai', () => {
    const valores = valoresIniciaisDoFilho(configSub, pai, linhas[0].linha, {});
    expect(valores.prazo).toBe('2026-12-01');
    expect(JSON.parse(valores.auditoriaOrigem)[0].codigo).toBe('QUA-AUD-001');
  });

  it('não recria linhas que já viraram documento', () => {
    const criadas = assinaturasCriadas([{
      id: 's', elementoId: 'sub', elementoNome: 'x', solicitadoEm: '', status: 'concluido',
      filhos: [{ documentoId: 'f1', codigo: 'QUA-PDA-001', titulo: '', assinatura: linhas[0].assinatura, criadoEm: '' }]
    }], 'sub');
    expect(criadas).toEqual([linhas[0].assinatura]);
    // A assinatura não depende da ordem das colunas.
    expect(assinaturaLinha({ a: '1', b: '2' })).toBe(assinaturaLinha({ b: '2', a: '1' }));
  });

  it('gera o próximo código e junta referências sem repetir', () => {
    expect(proximoCodigoDocumento('qua', 'pda', ['QUA-PDA-001', 'QUA-PDA-009', 'QUA-POP-020'])).toBe('QUA-PDA-010');
    expect(proximoCodigoDocumento('QUA', 'PDA', [])).toBe('QUA-PDA-001');
    expect(juntarReferencias([{ id: 'a', codigo: 'A', titulo: '' }], [{ id: 'a', codigo: 'A', titulo: '' }, { id: 'b', codigo: 'B', titulo: '' }]))
      .toHaveLength(2);
  });
});

describe('Subprocesso em modo "aguardar todos"', () => {

  const definicaoAguardar: IFluxoDefinicao = {
    ...definicao,
    elementos: definicao.elementos.map(item =>
      item.id === 'sub' ? { ...item, subprocesso: { ...configSub, aguardar: 'todos' } } : item)
  };

  const pararNoSubprocesso = (): IFluxoInstancia => {
    const inicio = iniciarInstancia(definicaoAguardar, {
      revisaoId: 'rev-aud', documentoId: 'doc-aud', revisao: 'Rev.00A', ator: auditor, simulado: true
    }).instancia as IFluxoInstancia;
    const resultado = executarAcao(definicaoAguardar, inicio, {
      acaoChave: 'concluir', comentario: '', valores: { acoes: ACOES }, ator: auditor
    });
    expect(resultado.erros).toEqual([]);
    return resultado.instancia as IFluxoInstancia;
  };

  it('para no subprocesso, sem tarefa, esperando os documentos', () => {
    const instancia = pararNoSubprocesso();
    expect(instancia.elementoAtualId).toBe('sub');
    expect(instancia.status).toBe('emAndamento');
    expect(instancia.tarefas.filter(item => item.status === 'pendente')).toHaveLength(0);
    const pedido = subprocessoAguardando(definicaoAguardar, instancia);
    expect(pedido && pedido.aguardando).toBe(true);

    // Ninguém consegue "concluir" enquanto espera.
    const tentativa = executarAcao(definicaoAguardar, instancia, {
      acaoChave: 'concluir', comentario: '', valores: {}, ator: auditor
    });
    expect(tentativa.ok).toBe(false);
  });

  it('segue para a próxima etapa quando os documentos concluem', () => {
    const instancia = pararNoSubprocesso();
    const resultado = liberarSubprocesso(definicaoAguardar, instancia, 'concluidos', { id: 'x', nome: 'Ana' });
    expect(resultado.erros).toEqual([]);
    const depois = resultado.instancia as IFluxoInstancia;
    expect(depois.elementoAtualId).toBe('verificar');
    expect(subprocessoAguardando(definicaoAguardar, depois)).toBeUndefined();
    expect(depois.historico[0].acaoRotulo).toMatch(/fluxo retomado/);
    // O original não muda (cópia).
    expect(instancia.elementoAtualId).toBe('sub');
  });

  it('Administrador só libera sem esperar informando o motivo', () => {
    const instancia = pararNoSubprocesso();
    expect(liberarSubprocesso(definicaoAguardar, instancia, 'administrador', { id: 'adm', nome: 'Admin' }, ' ').ok).toBe(false);
    const liberado = liberarSubprocesso(definicaoAguardar, instancia, 'administrador', { id: 'adm', nome: 'Admin' }, 'Auditoria encerrada pela diretoria');
    expect(liberado.ok).toBe(true);
    const historico = (liberado.instancia as IFluxoInstancia).historico.find(item => item.acaoChave === 'liberarSubprocesso');
    expect(historico && historico.executadoPorNome).toBe('Admin (Administrador)');
    expect(historico && historico.comentario).toBe('Auditoria encerrada pela diretoria');
  });

  it('modo padrão continua sem esperar', () => {
    const resultado = executarAcao(definicao, iniciar(), {
      acaoChave: 'concluir', comentario: '', valores: { acoes: ACOES }, ator: auditor
    });
    const instancia = resultado.instancia as IFluxoInstancia;
    expect(instancia.elementoAtualId).toBe('verificar');
    expect(subprocessoAguardando(definicao, instancia)).toBeUndefined();
  });
});

describe('Subprocesso: filtro de linhas (Lista / Sim-Não)', () => {

  const TABELA = JSON.stringify([
    { oque: 'Calibrar balança', conforme: 'nao', gravidade: 'Maior' },
    { oque: 'Etiquetas ok', conforme: 'sim', gravidade: '' },
    { oque: 'Registro faltando', conforme: 'NAO', gravidade: 'Menor' },
    { oque: '', conforme: '', gravidade: '' }
  ]);

  const comFiltro = (filtro?: { coluna: string; valores: string[] }): IConfigSubprocesso =>
    ({ ...configSub, campoTabela: 'acoes', filtroLinhas: filtro });

  it('sem filtro: todas as linhas preenchidas', () => {
    expect(linhasDoSubprocesso(comFiltro(), { acoes: TABELA })).toHaveLength(3);
  });

  it('Sim/Não: só as não conformidades (sem diferenciar maiúsculas)', () => {
    const linhas = linhasDoSubprocesso(comFiltro({ coluna: 'conforme', valores: ['nao'] }), { acoes: TABELA });
    expect(linhas.map(item => item.linha.oque)).toEqual(['Calibrar balança', 'Registro faltando']);
    // {n} continua sendo a posição na tabela.
    expect(linhas.map(item => item.numero)).toEqual([1, 3]);
  });

  it('Lista: aceita vários valores', () => {
    expect(linhasDoSubprocesso(comFiltro({ coluna: 'gravidade', valores: ['Maior', 'Menor'] }), { acoes: TABELA })).toHaveLength(2);
    expect(linhasDoSubprocesso(comFiltro({ coluna: 'gravidade', valores: ['Crítica'] }), { acoes: TABELA })).toHaveLength(0);
  });

  it('validação: coluna precisa ser Lista ou Sim/Não e ter valor marcado', () => {
    const tabelaComColunas: IFluxoDefinicao = {
      ...definicao,
      metadados: (definicao.metadados || []).map(item => item.chave === 'acoes'
        ? { ...item, colunas: (item.colunas || []).concat({ chave: 'conforme', rotulo: 'Conforme?', tipo: 'simNao' }) }
        : item)
    };
    const comSub = (filtro: { coluna: string; valores: string[] }): IFluxoDefinicao => ({
      ...tabelaComColunas,
      elementos: tabelaComColunas.elementos.map(item =>
        item.id === 'sub' ? { ...item, subprocesso: { ...configSub, filtroLinhas: filtro } } : item)
    });
    expect(validarDefinicao(comSub({ coluna: 'conforme', valores: ['nao'] })).filter(erro => /filtro/i.test(erro))).toEqual([]);
    expect(validarDefinicao(comSub({ coluna: 'conforme', valores: [] })).join(' ')).toMatch(/Marque ao menos um valor/);
    expect(validarDefinicao(comSub({ coluna: 'oque', valores: ['x'] })).join(' ')).toMatch(/Lista ou Sim\/Não/);
  });
});
