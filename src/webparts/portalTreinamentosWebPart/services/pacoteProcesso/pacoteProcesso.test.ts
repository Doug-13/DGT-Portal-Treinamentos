// Testes rodam no Node (Jest); o projeto não inclui @types/node.
declare const require: (modulo: string) => unknown;
declare const __dirname: string;
const fs = require('fs') as { readFileSync: (caminho: string, codificacao: string) => string };
const path = require('path') as { join: (...partes: string[]) => string };

import {
  FORMATO_PACOTE,
  IReferenciasPacote,
  exportarPacote,
  interpretarPacote
} from './pacoteProcesso';

import {
  definicaoParaBpmnXml
} from '../fluxo/bpmn/bpmnConversao';

// ============================================================
// TESTES — pacote de processo (JSON gerado por IA)
// Usa os MESMOS exemplos da documentação (docs/exemplos): se o
// formato mudar e a documentação ficar errada, o build acusa.
// ============================================================

// lib-commonjs/webparts/portalTreinamentosWebPart/services/pacoteProcesso → raiz
const exemplo = (nome: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'docs', 'exemplos', nome), 'utf8');

const referencias: IReferenciasPacote = {
  areas: [
    { id: 'a-qua', sigla: 'QUA', nome: 'Qualidade' },
    { id: 'a-com', sigla: 'COM', nome: 'Compras' }
  ],
  usuarios: [{ id: 'u-ana', email: 'ana@dgt.com.br', nome: 'Ana' }],
  processos: [{ id: 'p-pda', codigo: 'QUA-PDA', nome: 'Plano de ação' }]
};

describe('Pacote de processo (JSON)', () => {

  it('Plano de ação: importa sem erros e pronto para publicar', () => {
    const resultado = interpretarPacote(exemplo('pacote-plano-de-acao.json'), referencias);
    expect(resultado.erros).toEqual([]);
    expect(resultado.errosPublicacao).toEqual([]);
    const definicao = resultado.pacote ? resultado.pacote.definicao : undefined;
    expect(definicao && definicao.elementos.length).toBe(4);
    // Layout automático: todos com posição e tamanho.
    expect(definicao && definicao.elementos.every(el => el.posicao.largura > 0 && el.posicao.x > 0)).toBe(true);
    // Gera BPMN para o editor visual.
    expect(definicao ? definicaoParaBpmnXml(definicao) : '').toContain('bpmn:userTask id="executar"');
  });

  it('Auditoria: resolve subprocesso (pelo código), responsável por campo e filtro de linhas', () => {
    const resultado = interpretarPacote(exemplo('pacote-auditoria.json'), referencias);
    expect(resultado.erros).toEqual([]);
    expect(resultado.errosPublicacao).toEqual([]);
    const definicao = resultado.pacote ? resultado.pacote.definicao : undefined;
    const sub = definicao ? definicao.elementos.find(el => el.id === 'abrirAcoes') : undefined;
    expect(sub && sub.subprocesso && sub.subprocesso.fluxoId).toBe('p-pda');
    expect(sub && sub.subprocesso && sub.subprocesso.aguardar).toBe('todos');
    expect(sub && sub.subprocesso && sub.subprocesso.filtroLinhas).toEqual({ coluna: 'conforme', valores: ['nao'] });
    const executar = definicao ? definicao.elementos.find(el => el.id === 'executar') : undefined;
    expect(executar && executar.responsaveis[0].referenciaId).toBe('auditorLider');
    // Campo herda rótulo e tipo do metadado.
    expect(executar && executar.campos[0].tipo).toBe('tabela');
    expect(resultado.pacote && resultado.pacote.processo.areaId).toBe('a-qua');
  });

  it('Auditoria sem o Plano de ação no portal: avisa para importar antes', () => {
    const resultado = interpretarPacote(exemplo('pacote-auditoria.json'), { ...referencias, processos: [] });
    expect(resultado.erros.join(' ')).toMatch(/QUA-PDA/);
  });

  it('Compras: ambiente com telas ligadas às etapas do fluxo', () => {
    const resultado = interpretarPacote(exemplo('pacote-solicitacao-compra.json'), referencias);
    expect(resultado.erros).toEqual([]);
    expect(resultado.errosPublicacao).toEqual([]);
    const ambiente = resultado.pacote ? resultado.pacote.ambiente : undefined;
    expect(ambiente && ambiente.prefixoCodigo).toBe('COM');
    expect(ambiente && ambiente.layout && ambiente.layout.etapas.filter(e => e.visivel).map(e => e.rotulo))
      .toEqual(['Solicitação', 'Gestor', 'Diretoria', 'Pedido']);
    const comprar = resultado.pacote ? resultado.pacote.definicao.elementos.find(el => el.id === 'comprar') : undefined;
    expect(comprar && comprar.responsaveis[0].referenciaId).toBe('a-com');
  });

  it('erros claros para o que a IA costuma errar', () => {
    expect(interpretarPacote('{ nao é json', referencias).erros[0]).toMatch(/JSON válido/);
    expect(interpretarPacote({ processo: {} }, referencias).erros[0]).toMatch(/formato/);

    const base = JSON.parse(exemplo('pacote-plano-de-acao.json'));
    base.fluxo.elementos[1].campos.push({ chave: 'naoDeclarado' });
    base.fluxo.elementos[1].responsaveis.push({ tipo: 'area', area: 'XYZ' }, { tipo: 'usuario', email: 'ninguem@dgt.com.br' });
    base.fluxo.transicoes.push({ de: 'executar', para: 'sumiu' });
    const erros = interpretarPacote(base, referencias).erros.join('\n');
    expect(erros).toMatch(/naoDeclarado/);
    expect(erros).toMatch(/XYZ/);
    expect(erros).toMatch(/ninguem@dgt.com.br/);
    expect(erros).toMatch(/sumiu/);
  });

  it('exporta e reimporta (ida e volta) mantendo o desenho', () => {
    const primeiro = interpretarPacote(exemplo('pacote-solicitacao-compra.json'), referencias);
    const pacote = primeiro.pacote;
    expect(pacote).toBeDefined();
    if (!pacote) { return; }
    const exportado = exportarPacote({
      processo: { ...pacote.processo },
      metadados: pacote.metadados,
      definicao: pacote.definicao,
      ambiente: { nome: 'Compras', prefixoCodigo: 'COM', rotuloRegistro: 'Solicitação' },
      layout: pacote.ambiente ? pacote.ambiente.layout : undefined
    }, referencias);
    expect(exportado.formato).toBe(FORMATO_PACOTE);
    expect(exportado.processo.area).toBe('COM');
    const segundo = interpretarPacote(JSON.stringify(exportado), referencias);
    expect(segundo.erros).toEqual([]);
    const a = pacote.definicao.elementos.map(el => `${el.id}@${el.posicao.x},${el.posicao.y}`);
    const b = segundo.pacote ? segundo.pacote.definicao.elementos.map(el => `${el.id}@${el.posicao.x},${el.posicao.y}`) : [];
    expect(b).toEqual(a);
    expect(segundo.pacote && segundo.pacote.definicao.transicoes.length).toBe(pacote.definicao.transicoes.length);
  });
});
