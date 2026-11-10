import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoTransicao
} from '../../models/Fluxo';

import {
  corrigirLigacoesParaDecisao,
  ligacoesQueBarramBotoes
} from './correcoesFluxo';

import {
  validarDefinicao
} from './FluxoValidacao';

import {
  FORMATO_PACOTE,
  interpretarPacote
} from '../pacoteProcesso/pacoteProcesso';

// ============================================================
// TESTES — ligação etapa → decisão com botão (caso da auditoria)
// ============================================================

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const resp = [{ tipo: 'autorRevisao' as const, descricao: 'Autor', papelTeste: 'a' }];
const concluir = [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }];
const el = (id: string, tipo: IFluxoElemento['tipo'], nome: string, acoes?: IFluxoElemento['acoes']): IFluxoElemento =>
  ({ id, tipo, nome, responsaveis: tipo === 'tarefaHumana' ? resp : [], acoes: acoes || (tipo === 'tarefaHumana' ? concluir : []), campos: [], posicao: pos });
const tr = (id: string, origemId: string, destinoId: string, extra: Partial<IFluxoTransicao> = {}): IFluxoTransicao =>
  ({ id, origemId, destinoId, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [], ...extra });

const auditoria = (ligacao: Partial<IFluxoTransicao>, extras: IFluxoTransicao[] = []): IFluxoDefinicao => ({
  id: 'f', nome: 'Auditoria', versao: 1, status: 'rascunho', processoId: 'p', tiposDocumento: [], larguraDiagrama: 100, alturaDiagrama: 100, metadados: [],
  elementos: [
    el('inicio', 'inicio', 'Início'),
    el('preencher', 'tarefaHumana', 'Preencher checklist e classificar achados'),
    el('conferir', 'tarefaHumana', 'Conferir achados e revisar NC graves', [
      { chave: 'validar', rotulo: 'Validar classificação e autorizar emissão', resultado: 'aprovado', principal: true, exigeComentario: false },
      { chave: 'devolver', rotulo: 'Devolver classificação', resultado: 'devolvido', principal: false, exigeComentario: true }
    ]),
    el('decisao', 'gateway', ''),
    el('relatorio', 'tarefaHumana', 'Emitir relatório'),
    el('fim', 'fim', 'Fim')
  ],
  transicoes: [
    tr('t1', 'inicio', 'preencher'),
    tr('t2', 'preencher', 'conferir'),
    tr('t3', 'conferir', 'decisao', ligacao),
    tr('t4', 'decisao', 'relatorio', { tipoCondicao: 'resultado', resultado: 'aprovado' }),
    tr('t5', 'decisao', 'preencher', { tipoCondicao: 'resultado', resultado: 'devolvido', excecao: true }),
    tr('t6', 'relatorio', 'fim'),
    ...extras
  ]
});

describe('Ligação etapa → decisão com botão', () => {

  it('o caso da auditoria: aponta a ligação e o botão barrado', () => {
    const definicao = auditoria({ tipoCondicao: 'resultado', resultado: 'aprovado' });
    const achadas = ligacoesQueBarramBotoes(definicao);
    expect(achadas).toEqual([{
      transicaoId: 't3', etapaId: 'conferir', etapaNome: 'Conferir achados e revisar NC graves', decisaoNome: 'decisão',
      botaoPermitido: 'Validar classificação e autorizar emissão', botoesBarrados: ['Devolver classificação']
    }]);
    const erros = validarDefinicao(definicao).join(' ');
    expect(erros).toMatch(/só deixa passar o botão "Validar classificação e autorizar emissão"/);
    expect(erros).not.toMatch(/não leva a lugar nenhum/);
  });

  it('"Corrigir automaticamente" deixa a ligação como Qualquer botão e o fluxo fica publicável', () => {
    const { definicao, corrigidas } = corrigirLigacoesParaDecisao(auditoria({ tipoCondicao: 'resultado', resultado: 'aprovado' }));
    expect(corrigidas).toHaveLength(1);
    expect((definicao.transicoes.find(item => item.id === 't3') as IFluxoTransicao).tipoCondicao).toBe('sempre');
    expect(validarDefinicao(definicao)).toEqual([]);
  });

  it('não acusa quando está certo', () => {
    // Ligação "Qualquer botão" (o correto).
    expect(ligacoesQueBarramBotoes(auditoria({}))).toEqual([]);
    // Devolver ligado direto da etapa (outra saída leva o botão).
    expect(ligacoesQueBarramBotoes(auditoria(
      { tipoCondicao: 'resultado', resultado: 'aprovado' },
      [tr('t7', 'conferir', 'preencher', { tipoCondicao: 'resultado', resultado: 'devolvido', excecao: true })]
    ))).toEqual([]);
  });

  it('importação JSON corrige sozinha e avisa', () => {
    const pacote = {
      formato: FORMATO_PACOTE,
      processo: { codigo: 'QUA-AUD2', nome: 'Auditoria' },
      fluxo: {
        elementos: [
          { id: 'inicio', tipo: 'inicio', nome: 'Início' },
          { id: 'preencher', tipo: 'tarefaHumana', nome: 'Preencher', responsaveis: [{ tipo: 'autorRevisao' }] },
          { id: 'conferir', tipo: 'tarefaHumana', nome: 'Conferir', responsaveis: [{ tipo: 'autorRevisao' }],
            acoes: [{ chave: 'validar', rotulo: 'Validar', resultado: 'aprovado' }, { chave: 'devolver', rotulo: 'Devolver', resultado: 'devolvido', exigeComentario: true }] },
          { id: 'decisao', tipo: 'gateway', nome: 'Validado?' },
          { id: 'fim', tipo: 'fim', nome: 'Fim' }
        ],
        transicoes: [
          { de: 'inicio', para: 'preencher' },
          { de: 'preencher', para: 'conferir' },
          { de: 'conferir', para: 'decisao', quando: { resultado: 'aprovado' } },
          { de: 'decisao', para: 'fim', quando: { resultado: 'aprovado' } },
          { de: 'decisao', para: 'preencher', quando: { resultado: 'devolvido' }, excecao: true }
        ]
      }
    };
    const resultado = interpretarPacote(pacote, { areas: [], usuarios: [], processos: [] });
    expect(resultado.erros).toEqual([]);
    expect(resultado.errosPublicacao).toEqual([]);
    expect(resultado.avisos.join(' ')).toMatch(/Conferir → Validado\?" ajustada para "Qualquer botão"/);
  });
});
