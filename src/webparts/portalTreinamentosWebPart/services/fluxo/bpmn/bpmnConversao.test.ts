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
  tarefaSistema: 'bpmn:ServiceTask'
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
