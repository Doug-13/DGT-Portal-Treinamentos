import {
  IFluxoDefinicao
} from '../../../models/Fluxo';

import {
  FLUXO_EM_BRANCO,
  FLUXO_POP_PROCEDIMENTO_V2
} from '../definicoes/fluxoPopProcedimento';

import {
  validarDefinicao
} from '../FluxoValidacao';

import {
  executarAcao,
  iniciarInstancia
} from '../FluxoEngine';

import {
  configDaTransicao,
  configDoElemento,
  definicaoParaBpmnXml,
  gerarChave,
  IBpmnSnapshot,
  IConfigElemento,
  IConfigTransicao,
  montarDefinicao
} from './bpmnConversao';

// ============================================================
// TESTES — desenho BPMN ↔ definição do fluxo
// ============================================================

const TIPO_BPMN: Record<string, string> = {
  inicio: 'bpmn:StartEvent',
  fim: 'bpmn:EndEvent',
  tarefaHumana: 'bpmn:UserTask',
  gateway: 'bpmn:ExclusiveGateway',
  tarefaSistema: 'bpmn:ServiceTask',
  eventoRevisao: 'bpmn:IntermediateThrowEvent'
};

// Simula o "retrato" que o editor visual devolveria.
const snapshotDe = (
  definicao: IFluxoDefinicao,
  deslocamento: number
): IBpmnSnapshot => ({
  formas: definicao.elementos.map(
    elemento => ({
      id: elemento.id,
      tipo: TIPO_BPMN[elemento.tipo],
      nome: elemento.nome,
      x: elemento.posicao.x + deslocamento,
      y: elemento.posicao.y + deslocamento,
      largura: elemento.posicao.largura,
      altura: elemento.posicao.altura
    })
  ),
  conexoes: definicao.transicoes.map(
    transicao => ({
      id: transicao.id,
      tipo: 'bpmn:SequenceFlow',
      nome: transicao.rotulo || '',
      origemId: transicao.origemId,
      destinoId: transicao.destinoId,
      pontos: transicao.pontos.map(ponto => ({ x: ponto.x + deslocamento, y: ponto.y + deslocamento }))
    })
  )
});

const configs = (
  definicao: IFluxoDefinicao
): { elementos: Record<string, IConfigElemento>; transicoes: Record<string, IConfigTransicao> } => {

  const elementos: Record<string, IConfigElemento> = {};
  const transicoes: Record<string, IConfigTransicao> = {};

  definicao.elementos.forEach(item => { elementos[item.id] = configDoElemento(item); });
  definicao.transicoes.forEach(item => { transicoes[item.id] = configDaTransicao(item); });

  return { elementos, transicoes };
};

describe('validarDefinicao', () => {

  it('aceita os modelos prontos (o POP só pede a área da Qualidade)', () => {
    expect(validarDefinicao(FLUXO_POP_PROCEDIMENTO_V2)).toEqual([
      'Escolha a área do responsável "Gestores da área da Qualidade" na etapa "Aprovação".'
    ]);
    expect(validarDefinicao(FLUXO_EM_BRANCO)).toEqual([]);
  });

  it('acusa botão sem caminho', () => {

    const definicao: IFluxoDefinicao =
      JSON.parse(JSON.stringify(FLUXO_EM_BRANCO));

    const etapa =
      definicao.elementos.filter(item => item.tipo === 'tarefaHumana')[0];

    etapa.acoes.push({
      chave: 'devolver',
      rotulo: 'Devolver',
      resultado: 'devolvido',
      principal: false,
      exigeComentario: true
    });

    // A ligação de saída passa a exigir o resultado "concluido":
    // o botão "Devolver" fica sem caminho.
    definicao.transicoes[1].tipoCondicao = 'resultado';
    definicao.transicoes[1].resultado = 'concluido';
    definicao.transicoes[1].padrao = false;

    const erros =
      validarDefinicao(definicao);

    expect(erros.some(erro => erro.indexOf('Devolver') >= 0)).toBe(true);
  });
});

describe('montarDefinicao', () => {

  it('reconstrói o fluxo a partir do desenho, normalizando as posições', () => {

    const { elementos, transicoes } =
      configs(FLUXO_POP_PROCEDIMENTO_V2);

    const definicao =
      montarDefinicao({
        base: FLUXO_POP_PROCEDIMENTO_V2,
        snapshot: snapshotDe(FLUXO_POP_PROCEDIMENTO_V2, 500),
        configsElementos: elementos,
        configsTransicoes: transicoes,
        metadados: FLUXO_POP_PROCEDIMENTO_V2.metadados || [],
        bpmnXml: '<xml/>'
      });

    expect(definicao.elementos.length).toBe(FLUXO_POP_PROCEDIMENTO_V2.elementos.length);
    expect(definicao.transicoes.length).toBe(FLUXO_POP_PROCEDIMENTO_V2.transicoes.length);
    expect(definicao.avisosModelagem).toEqual([]);
    expect(validarDefinicao(definicao)).toEqual(validarDefinicao(FLUXO_POP_PROCEDIMENTO_V2));

    const xs = definicao.elementos.map(item => item.posicao.x);
    expect(Math.min(...xs)).toBe(24);

    // O fluxo montado continua executável.
    const inicio =
      iniciarInstancia(definicao, {
        revisaoId: 'r', documentoId: 'd', revisao: 'Rev.01',
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }, simulado: true
      });

    const enviado =
      executarAcao(definicao, inicio.instancia as NonNullable<typeof inicio.instancia>, {
        acaoChave: 'enviarRevisaoTecnica',
        comentario: '',
        valores: {},
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }
      });

    expect(enviado.ok).toBe(true);
    expect(enviado.instancia?.elementoAtualId).toBe('revisaoTecnica');
  });

  it('avisa sobre elementos BPMN não suportados', () => {

    const snapshot =
      snapshotDe(FLUXO_EM_BRANCO, 0);

    snapshot.formas.push({
      id: 'paralelo', tipo: 'bpmn:ParallelGateway', nome: 'Em paralelo',
      x: 200, y: 200, largura: 50, altura: 50
    });

    const { elementos, transicoes } =
      configs(FLUXO_EM_BRANCO);

    const definicao =
      montarDefinicao({
        base: FLUXO_EM_BRANCO,
        snapshot,
        configsElementos: elementos,
        configsTransicoes: transicoes,
        metadados: [],
        bpmnXml: ''
      });

    expect((definicao.avisosModelagem || []).length).toBe(1);
    expect(validarDefinicao(definicao).length).toBeGreaterThan(0);
  });

  it('gera XML BPMN com todos os elementos e ligações', () => {

    const xml =
      definicaoParaBpmnXml(FLUXO_POP_PROCEDIMENTO_V2);

    FLUXO_POP_PROCEDIMENTO_V2.elementos.forEach(
      item => expect(xml.indexOf(`id="${item.id}"`)).toBeGreaterThan(0)
    );

    FLUXO_POP_PROCEDIMENTO_V2.transicoes.forEach(
      item => expect(xml.indexOf(`bpmnElement="${item.id}"`)).toBeGreaterThan(0)
    );
  });
});

describe('gerarChave', () => {

  it('gera chaves únicas a partir do texto', () => {
    expect(gerarChave('Número da NC')).toBe('numeroDaNc');
    expect(gerarChave('Valor', ['valor'])).toBe('valor2');
    expect(gerarChave('123 itens')).toBe('c123Itens');
  });
});

describe('evento de revisão', () => {

  // Em branco + evento de revisão entre a Elaboração e o Fim.
  const comEvento = (
    tipoRevisao: 'revisao' | 'subrevisao'
  ): IFluxoDefinicao => {

    const definicao: IFluxoDefinicao =
      JSON.parse(JSON.stringify(FLUXO_EM_BRANCO));

    definicao.elementos.push({
      id: 'eventoRev',
      tipo: 'eventoRevisao',
      nome: 'Nova revisão',
      tipoRevisao,
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 300, y: 100, largura: 36, altura: 36 }
    });

    const saida =
      definicao.transicoes.filter(item => item.id === 't-elaboracao-fim')[0];

    saida.destinoId = 'eventoRev';

    definicao.transicoes.push({
      id: 't-evento-fim',
      origemId: 'eventoRev',
      destinoId: 'fim',
      tipoCondicao: 'sempre',
      padrao: false,
      excecao: false,
      pontos: []
    });

    return definicao;
  };

  it('é aceito pela validação e pede a renumeração ao ser percorrido', () => {

    const definicao =
      comEvento('subrevisao');

    expect(validarDefinicao(definicao)).toEqual([]);

    const inicio =
      iniciarInstancia(definicao, {
        revisaoId: 'r', documentoId: 'd', revisao: 'Rev.01',
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }, simulado: true
      });

    const concluido =
      executarAcao(definicao, inicio.instancia as NonNullable<typeof inicio.instancia>, {
        acaoChave: 'concluir',
        comentario: '',
        valores: {},
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }
      });

    expect(concluido.ok).toBe(true);
    expect(concluido.acoesSistema).toEqual(['novaSubRevisao']);
    // O motor já calcula o novo rótulo: Rev.01 → Rev.01A.
    expect(concluido.instancia?.revisao).toBe('Rev.01A');
    expect(concluido.instancia?.status).toBe('concluido');
  });

  it('é reconhecido no desenho BPMN (evento intermediário)', () => {

    const definicao =
      comEvento('revisao');

    const snapshot =
      snapshotDe(definicao, 0);

    snapshot.formas.forEach(forma => {
      if (forma.id === 'eventoRev') {
        forma.tipo = 'bpmn:IntermediateThrowEvent';
      }
    });

    const { elementos, transicoes } =
      configs(definicao);

    const montada =
      montarDefinicao({
        base: definicao,
        snapshot,
        configsElementos: elementos,
        configsTransicoes: transicoes,
        metadados: [],
        bpmnXml: ''
      });

    expect(montada.avisosModelagem).toEqual([]);

    const evento =
      montada.elementos.filter(item => item.id === 'eventoRev')[0];

    expect(evento.tipo).toBe('eventoRevisao');
    expect(evento.tipoRevisao).toBe('revisao');
    expect(definicaoParaBpmnXml(montada).indexOf('bpmn:intermediateThrowEvent')).toBeGreaterThan(0);
  });
});

describe('reprovação nunca conclui nem publica', () => {

  // Em branco + botão "Reprovar" cujo caminho (errado) vai para o Fim.
  const comReprovarErrado = (): IFluxoDefinicao => {

    const definicao: IFluxoDefinicao =
      JSON.parse(JSON.stringify(FLUXO_EM_BRANCO));

    const etapa =
      definicao.elementos.filter(item => item.id === 'elaboracao')[0];

    etapa.acoes.push({
      chave: 'reprovar',
      rotulo: 'Reprovar',
      resultado: 'reprovado',
      principal: false,
      exigeComentario: false
    });

    return definicao;
  };

  it('a validação impede publicar o fluxo', () => {

    const erros =
      validarDefinicao(comReprovarErrado());

    expect(erros.some(erro => erro.indexOf('"Reprovar"') >= 0 && erro.indexOf('reprovação') >= 0)).toBe(true);
  });

  it('o motor bloqueia a ação mesmo num fluxo já publicado', () => {

    const definicao =
      comReprovarErrado();

    const inicio =
      iniciarInstancia(definicao, {
        revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00',
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }, simulado: true
      });

    const reprovado =
      executarAcao(definicao, inicio.instancia as NonNullable<typeof inicio.instancia>, {
        acaoChave: 'reprovar',
        comentario: '',
        valores: {},
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }
      });

    expect(reprovado.ok).toBe(false);
    expect(reprovado.instancia).toBeUndefined();

    // O botão normal continua concluindo.
    const concluido =
      executarAcao(definicao, inicio.instancia as NonNullable<typeof inicio.instancia>, {
        acaoChave: 'concluir',
        comentario: '',
        valores: {},
        ator: { id: 'a', nome: 'A', papeisTeste: ['autor'] }
      });

    expect(concluido.ok).toBe(true);
  });
});

describe('reprovação precisa voltar para uma etapa anterior', () => {

  // Elaboração → Avaliação → decisão → (Aprovar) Elaboração [trocado]
  //                                  → (Reprovar) Documento vigente [trocado]
  const trocado = (): IFluxoDefinicao => {

    const definicao: IFluxoDefinicao =
      JSON.parse(JSON.stringify(FLUXO_EM_BRANCO));

    const base = definicao.elementos.filter(item => item.id === 'elaboracao')[0];

    const etapa = (id: string, nome: string, acoes: Array<[string, string, string]>): typeof base => ({
      ...JSON.parse(JSON.stringify(base)),
      id,
      nome,
      acoes: acoes.map(([chave, rotulo, resultado]) => ({ chave, rotulo, resultado, principal: true, exigeComentario: false }))
    });

    definicao.elementos.push(
      etapa('avaliacao', 'Avaliação', [['aprovar', 'Aprovar', 'aprovado'], ['reprovar', 'Reprovar', 'reprovado']]),
      etapa('vigente', 'Documento vigente', [['concluir', 'Concluir', 'concluido']]),
      { ...JSON.parse(JSON.stringify(base)), id: 'decisao', nome: 'Aprovado?', tipo: 'gateway', responsaveis: [], acoes: [], campos: [] }
    );

    definicao.transicoes = [
      { id: 't1', origemId: 'inicio', destinoId: 'elaboracao', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't2', origemId: 'elaboracao', destinoId: 'avaliacao', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't3', origemId: 'avaliacao', destinoId: 'decisao', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't4', origemId: 'decisao', destinoId: 'elaboracao', tipoCondicao: 'resultado', resultado: 'aprovado', padrao: false, excecao: false, pontos: [] },
      { id: 't5', origemId: 'decisao', destinoId: 'vigente', tipoCondicao: 'resultado', resultado: 'reprovado', padrao: false, excecao: false, pontos: [] },
      { id: 't6', origemId: 'vigente', destinoId: 'elaboracao', tipoCondicao: 'resultado', resultado: 'concluido', padrao: false, excecao: false, pontos: [] },
      { id: 't7', origemId: 'vigente', destinoId: 'fim', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] }
    ];

    return definicao;
  };

  it('a validação aponta o caminho trocado', () => {
    const erros = validarDefinicao(trocado());
    expect(erros.some(erro => erro.indexOf('"Reprovar"') >= 0 && erro.indexOf('Documento vigente') >= 0)).toBe(true);
  });

  it('o motor bloqueia a reprovação que iria para uma etapa nova', () => {

    const definicao = trocado();
    const ator = { id: 'a', nome: 'A', papeisTeste: ['autor'] };

    const inicio =
      iniciarInstancia(definicao, { revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00', ator, simulado: true });

    const enviado =
      executarAcao(definicao, inicio.instancia as NonNullable<typeof inicio.instancia>, {
        acaoChave: 'concluir', comentario: '', valores: {}, ator
      });

    expect(enviado.instancia?.elementoAtualId).toBe('avaliacao');

    const reprovado =
      executarAcao(definicao, enviado.instancia as NonNullable<typeof enviado.instancia>, {
        acaoChave: 'reprovar', comentario: '', valores: {}, ator
      });

    expect(reprovado.ok).toBe(false);
    expect(reprovado.erros[0].indexOf('Documento vigente')).toBeGreaterThan(0);
  });
});

describe('etapa com status Vigente', () => {

  // Elaboração → Realizar retreinamento? → Retreinar?
  //   ├─ Sim → Revisar Treinamento → Documento Vigente
  //   └─ Não → Documento Vigente
  const fluxo = (): IFluxoDefinicao => {

    const definicao: IFluxoDefinicao =
      JSON.parse(JSON.stringify(FLUXO_EM_BRANCO));

    const base = definicao.elementos.filter(item => item.id === 'elaboracao')[0];

    const etapa = (id: string, nome: string, acoes: Array<[string, string, string]>, extra: Record<string, unknown> = {}): typeof base => ({
      ...JSON.parse(JSON.stringify(base)),
      id,
      nome,
      acoes: acoes.map(([chave, rotulo, resultado]) => ({ chave, rotulo, resultado, principal: true, exigeComentario: false })),
      ...extra
    });

    definicao.elementos.push(
      etapa('pergunta', 'Realizar retreinamento?', [['sim', 'Sim', 'sim'], ['nao', 'Não', 'nao']]),
      etapa('revisarTreinamento', 'Revisar Treinamento', [['concluir', 'Concluir', 'concluido']]),
      etapa('vigente', 'Documento Vigente', [['concluir', 'Concluir', 'concluido']], { statusDocumento: 'Vigente' }),
      { ...JSON.parse(JSON.stringify(base)), id: 'retreinar', nome: 'Retreinar?', tipo: 'gateway', responsaveis: [], acoes: [], campos: [] }
    );

    definicao.transicoes = [
      { id: 't1', origemId: 'inicio', destinoId: 'elaboracao', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't2', origemId: 'elaboracao', destinoId: 'pergunta', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't3', origemId: 'pergunta', destinoId: 'retreinar', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't4', origemId: 'retreinar', destinoId: 'revisarTreinamento', tipoCondicao: 'resultado', resultado: 'sim', padrao: false, excecao: false, pontos: [] },
      { id: 't5', origemId: 'retreinar', destinoId: 'vigente', tipoCondicao: 'resultado', resultado: 'nao', padrao: false, excecao: false, pontos: [] },
      { id: 't6', origemId: 'revisarTreinamento', destinoId: 'vigente', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] },
      { id: 't7', origemId: 'vigente', destinoId: 'fim', tipoCondicao: 'sempre', padrao: true, excecao: false, pontos: [] }
    ];

    return definicao;
  };

  const ator = { id: 'a', nome: 'A', papeisTeste: ['autor'] };

  const agir = (definicao: IFluxoDefinicao, instancia: unknown, acaoChave: string): ReturnType<typeof executarAcao> =>
    executarAcao(definicao, instancia as NonNullable<ReturnType<typeof executarAcao>['instancia']>, {
      acaoChave, comentario: '', valores: {}, ator
    });

  it('com retreinamento quando o caminho passa por "Revisar Treinamento"', () => {
    const definicao = fluxo();
    const inicio = iniciarInstancia(definicao, { revisaoId: 'r', documentoId: 'd', revisao: 'Rev.01B', ator, simulado: true });
    const r1 = agir(definicao, inicio.instancia, 'concluir');
    const r2 = agir(definicao, r1.instancia, 'sim');
    expect(r2.instancia?.elementoAtualId).toBe('revisarTreinamento');
    const r3 = agir(definicao, r2.instancia, 'concluir');
    expect(r3.acoesSistema).toEqual(['publicarComRetreinamento']);
    expect(r3.instancia?.status).toBe('concluido');
    expect(r3.instancia?.revisao).toBe('Rev.01');
  });

  it('sem retreinamento quando segue direto para "Documento Vigente"', () => {
    const definicao = fluxo();
    const inicio = iniciarInstancia(definicao, { revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00A', ator, simulado: true });
    const r1 = agir(definicao, inicio.instancia, 'concluir');
    const r2 = agir(definicao, r1.instancia, 'nao');
    expect(r2.acoesSistema).toEqual(['publicarSemRetreinamento']);
    expect(r2.instancia?.revisao).toBe('Rev.00');
  });
});
