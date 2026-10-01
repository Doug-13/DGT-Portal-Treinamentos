import {
  IFluxoDefinicao,
  IFluxoInstancia,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  FLUXO_POP_PROCEDIMENTO_V2
} from '../fluxo/definicoes/fluxoPopProcedimento';

import {
  executarAcao,
  iniciarInstancia
} from '../fluxo/FluxoEngine';

import {
  validarDefinicao
} from '../fluxo/FluxoValidacao';

import {
  gravarLinhasTabela,
  validarTabela
} from '../fluxo/valoresTabela';

import {
  aplicarMetadadosNaDefinicao,
  migrarMetadadosDasVersoes,
  obterMetadadosProcesso,
  salvarMetadadosProcesso
} from './MetadadosProcessoService';

// ============================================================
// TESTES — metadados do processo e campos do tipo tabela
// ============================================================

const TABELA_ITENS: IFluxoMetadado = {
  chave: 'itens',
  rotulo: 'Itens',
  tipo: 'tabela',
  colunas: [
    { chave: 'item', rotulo: 'Item', tipo: 'texto', obrigatoria: true },
    { chave: 'quantidade', rotulo: 'Quantidade', tipo: 'numero' }
  ]
};

const copia = (): IFluxoDefinicao =>
  JSON.parse(JSON.stringify(FLUXO_POP_PROCEDIMENTO_V2)) as IFluxoDefinicao;

describe('metadados do processo', () => {

  it('migra os metadados da versão para o processo uma única vez', () => {

    const versao = { ...copia(), status: 'rascunho' as const };

    const migrados =
      migrarMetadadosDasVersoes('proc-migra', [versao]);

    expect(migrados.map(item => item.chave)).toEqual(['retreinamento', 'justificativaRetreinamento']);

    salvarMetadadosProcesso('proc-migra', [TABELA_ITENS]);

    // Já existe lista no processo: não migra de novo.
    expect(migrarMetadadosDasVersoes('proc-migra', [versao]).map(item => item.chave)).toEqual(['itens']);
    expect(obterMetadadosProcesso('proc-migra').length).toBe(1);
  });

  it('aplica rótulos e a ORDEM do processo nos campos das etapas', () => {

    const metadados: IFluxoMetadado[] = [
      { chave: 'justificativaRetreinamento', rotulo: 'Justificativa', tipo: 'textoLongo' },
      { chave: 'retreinamento', rotulo: 'Precisa retreinar?', tipo: 'simNao' }
    ];

    const aplicada =
      aplicarMetadadosNaDefinicao(copia(), metadados);

    const etapa =
      aplicada.elementos.filter(item => item.id === 'aprovacaoQualidade')[0];

    expect(etapa.campos.map(item => item.chave)).toEqual(['justificativaRetreinamento', 'retreinamento']);
    expect(etapa.campos[1].rotulo).toBe('Precisa retreinar?');
    expect(aplicada.metadados).toEqual(metadados);
  });
});

describe('campo tabela', () => {

  it('valida linhas, colunas obrigatórias e tipos', () => {

    const colunas = TABELA_ITENS.colunas || [];

    expect(validarTabela('Itens', colunas, '', true).length).toBe(1);
    expect(validarTabela('Itens', colunas, '', false)).toEqual([]);

    const valido =
      gravarLinhasTabela([{ item: 'Parafuso', quantidade: '10' }]);

    expect(validarTabela('Itens', colunas, valido, true)).toEqual([]);

    const invalido =
      gravarLinhasTabela([{ item: '', quantidade: 'dez' }]);

    expect(validarTabela('Itens', colunas, invalido, true).length).toBe(2);
  });

  it('é exigido na etapa e bloqueia a ação enquanto incompleto', () => {

    const definicao =
      copia();

    definicao.metadados = [TABELA_ITENS];

    const elaboracao =
      definicao.elementos.filter(item => item.id === 'elaboracao')[0];

    elaboracao.campos = [
      { chave: 'itens', rotulo: 'Itens', tipo: 'tabela', obrigatorio: true, colunas: TABELA_ITENS.colunas }
    ];

    const ator = { id: 'a', nome: 'A', papeisTeste: ['autor'] };

    const inicio =
      iniciarInstancia(definicao, { revisaoId: 'r', documentoId: 'd', revisao: 'Rev.01', ator, simulado: true });

    const instancia =
      inicio.instancia as IFluxoInstancia;

    const semLinhas =
      executarAcao(definicao, instancia, { acaoChave: 'enviarRevisaoTecnica', comentario: '', valores: {}, ator });

    expect(semLinhas.ok).toBe(false);

    const comLinhas =
      executarAcao(definicao, instancia, {
        acaoChave: 'enviarRevisaoTecnica',
        comentario: '',
        valores: { itens: gravarLinhasTabela([{ item: 'Parafuso', quantidade: '10' }]) },
        ator
      });

    expect(comLinhas.ok).toBe(true);
    expect(comLinhas.instancia?.historico[0].comentario).toBe('Itens 1 linha');
  });

  it('exige ao menos uma coluna para publicar', () => {

    const definicao =
      copia();

    definicao.metadados = [
      ...(definicao.metadados || []),
      { chave: 'vazia', rotulo: 'Vazia', tipo: 'tabela', colunas: [] }
    ];

    expect(validarDefinicao(definicao).some(erro => erro.indexOf('Vazia') >= 0)).toBe(true);
  });
});
