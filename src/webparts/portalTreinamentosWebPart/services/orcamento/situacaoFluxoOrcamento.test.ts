import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoTransicao
} from '../../models/Fluxo';

import {
  executarAcao,
  iniciarInstancia
} from '../fluxo/FluxoEngine';

import {
  etapaDePreenchimento,
  situacaoDoFluxo
} from './situacaoFluxoOrcamento';

// ============================================================
// TESTES — situação da planilha no fluxo de aprovação
//
// Fluxo igual ao CONT-001 publicado:
//   Início → Preenchimento de Informações → Avaliação do Diretor da
//   Área → ◇ (Aprovado → Avaliação Controladoria | Reprovado →
//   Preenchimento) → ◇ (Aprovado → Diretoria Financeira | Reprovado →
//   Preenchimento) → Fim
// Rodam no "heft test" (parte do npm run build).
// ============================================================

const posicao = { x: 0, y: 0, largura: 100, altura: 60 };

const etapa = (id: string, nome: string, papel: string, comReprovar: boolean): IFluxoElemento => ({
  id,
  tipo: 'tarefaHumana',
  nome,
  responsaveis: [{ tipo: 'usuario', referenciaId: papel, descricao: papel, papelTeste: papel }],
  acoes: [
    { chave: 'aprovar', rotulo: 'Aprovar', resultado: 'aprovado', principal: true, exigeComentario: false }
  ].concat(
    comReprovar
      ? [{ chave: 'reprovar', rotulo: 'Reprovar', resultado: 'reprovado', principal: false, exigeComentario: true }]
      : []
  ),
  campos: [],
  prazoDiasUteis: 2,
  posicao
});

const simples = (id: string, tipo: IFluxoElemento['tipo'], nome: string): IFluxoElemento => ({
  id, tipo, nome, responsaveis: [], acoes: [], campos: [], posicao
});

const transicao = (
  id: string,
  origemId: string,
  destinoId: string,
  resultado?: string,
  excecao = false
): IFluxoTransicao => ({
  id,
  origemId,
  destinoId,
  tipoCondicao: resultado ? 'resultado' : 'sempre',
  resultado,
  padrao: !resultado,
  excecao,
  pontos: []
});

const preenchimento = etapa('preench', 'Preenchimento de Informações', 'gestor', false);
preenchimento.acoes = [
  { chave: 'enviar', rotulo: 'Enviar para avaliação', resultado: 'enviado', principal: true, exigeComentario: false }
];

const definicao: IFluxoDefinicao = {
  id: 'cont-001',
  nome: 'Planejamento Orçamentário',
  versao: 1,
  status: 'publicado',
  tiposDocumento: [],
  larguraDiagrama: 1000,
  alturaDiagrama: 400,
  elementos: [
    simples('inicio', 'inicio', 'Início'),
    preenchimento,
    etapa('diretor', 'Avaliação do Diretor da Área', 'diretor', true),
    simples('g1', 'gateway', 'Decisão diretor'),
    etapa('controladoria', 'Avaliação Controladoria', 'controladoria', true),
    simples('g2', 'gateway', 'Decisão controladoria'),
    etapa('financeiro', 'Diretoria Financeira', 'financeiro', false),
    simples('fim', 'fim', 'Fim')
  ],
  transicoes: [
    transicao('t1', 'inicio', 'preench'),
    transicao('t2', 'preench', 'diretor'),
    transicao('t3', 'diretor', 'g1'),
    transicao('t4', 'g1', 'controladoria', 'aprovado'),
    transicao('t5', 'g1', 'preench', 'reprovado', true),
    transicao('t6', 'controladoria', 'g2'),
    transicao('t7', 'g2', 'financeiro', 'aprovado'),
    transicao('t8', 'g2', 'preench', 'reprovado', true),
    transicao('t9', 'financeiro', 'fim')
  ]
};

const ator = (papel: string): IFluxoAtor => ({ id: papel, nome: papel, papeisTeste: [papel] });

const agir = (instancia: IFluxoInstancia, papel: string, acaoChave: string, comentario = ''): IFluxoInstancia => {
  const resultado = executarAcao(definicao, instancia, { acaoChave, comentario, valores: {}, ator: ator(papel) });
  expect(resultado.erros).toEqual([]);
  return resultado.instancia as IFluxoInstancia;
};

describe('Fluxo de aprovação do orçamento (CONT-001)', () => {

  it('identifica a etapa de preenchimento', () => {
    expect((etapaDePreenchimento(definicao) as IFluxoElemento).id).toBe('preench');
  });

  it('percorre preenchimento → reprovação → reenvio → aprovações → aprovada', () => {

    const inicio = iniciarInstancia(definicao, {
      revisaoId: 'planilha-1', documentoId: 'planilha-1', revisao: '2027', ator: ator('gestor'), simulado: true
    });
    expect(inicio.ok).toBe(true);

    let instancia = inicio.instancia as IFluxoInstancia;
    expect(instancia.elementoAtualId).toBe('preench');
    expect(situacaoDoFluxo(instancia, definicao)).toBe('Em preenchimento');

    instancia = agir(instancia, 'gestor', 'enviar');
    expect(instancia.elementoAtualId).toBe('diretor');
    expect(situacaoDoFluxo(instancia, definicao)).toBe('Em aprovação');

    // Reprovar exige comentário.
    const semMotivo = executarAcao(definicao, instancia, { acaoChave: 'reprovar', comentario: '', valores: {}, ator: ator('diretor') });
    expect(semMotivo.ok).toBe(false);

    instancia = agir(instancia, 'diretor', 'reprovar', 'Rever viagens');
    expect(instancia.elementoAtualId).toBe('preench');
    expect(situacaoDoFluxo(instancia, definicao)).toBe('Devolvida para ajuste');

    instancia = agir(instancia, 'gestor', 'enviar');
    expect(situacaoDoFluxo(instancia, definicao)).toBe('Em aprovação');

    instancia = agir(instancia, 'diretor', 'aprovar');
    expect(instancia.elementoAtualId).toBe('controladoria');

    instancia = agir(instancia, 'controladoria', 'aprovar');
    expect(instancia.elementoAtualId).toBe('financeiro');

    instancia = agir(instancia, 'financeiro', 'aprovar');
    expect(instancia.status).toBe('concluido');
    expect(situacaoDoFluxo(instancia, definicao)).toBe('Aprovada');
  });

  it('só o responsável da etapa pode agir', () => {
    const inicio = iniciarInstancia(definicao, {
      revisaoId: 'planilha-2', documentoId: 'planilha-2', revisao: '2027', ator: ator('gestor'), simulado: true
    });
    const instancia = agir(inicio.instancia as IFluxoInstancia, 'gestor', 'enviar');
    const intruso = executarAcao(definicao, instancia, { acaoChave: 'aprovar', comentario: '', valores: {}, ator: ator('gestor') });
    expect(intruso.ok).toBe(false);
  });

  it('reprovação na Controladoria também devolve ao preenchimento', () => {
    const inicio = iniciarInstancia(definicao, {
      revisaoId: 'planilha-3', documentoId: 'planilha-3', revisao: '2027', ator: ator('gestor'), simulado: true
    });
    let instancia = agir(inicio.instancia as IFluxoInstancia, 'gestor', 'enviar');
    instancia = agir(instancia, 'diretor', 'aprovar');
    instancia = agir(instancia, 'controladoria', 'reprovar', 'Acima do teto');
    expect(instancia.elementoAtualId).toBe('preench');
    expect(situacaoDoFluxo(instancia, definicao)).toBe('Devolvida para ajuste');
    const pendente = instancia.tarefas.filter(tarefa => tarefa.status === 'pendente')[0];
    expect(pendente.elementoId).toBe('preench');
  });
});
