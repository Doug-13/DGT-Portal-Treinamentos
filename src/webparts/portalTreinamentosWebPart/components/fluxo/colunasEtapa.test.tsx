/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import TabelaCampoFluxo from './TabelaCampoFluxo';

import {
  IColunaTabela,
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  executarAcao,
  iniciarInstancia
} from '../../services/fluxo/FluxoEngine';

import {
  colunasEditaveis,
  colunasVisiveis,
  limparModoColunas
} from '../../services/fluxo/valoresTabela';

import {
  interpretarPacote
} from '../../services/pacoteProcesso/pacoteProcesso';

// ============================================================
// TESTES — colunas da tabela por etapa (editável / leitura / oculta)
// Ex.: checklist da auditoria — o auditor não vê Grau; a coordenação
// vê Resultado só para leitura e preenche Grau.
// ============================================================

const COLUNAS: IColunaTabela[] = [
  { chave: 'item', rotulo: 'Item verificado', tipo: 'texto', obrigatoria: true },
  { chave: 'resultado', rotulo: 'Resultado', tipo: 'lista', opcoes: ['C', 'NC'], obrigatoria: true },
  { chave: 'grau', rotulo: 'Grau da NC', tipo: 'lista', opcoes: ['Leve', 'Grave'], obrigatoria: true }
];

describe('Colunas da tabela por etapa', () => {

  it('regras: visíveis, editáveis e limpeza de modos inválidos', () => {
    const modos = { grau: 'oculta' as const, item: 'leitura' as const };
    expect(colunasVisiveis(COLUNAS, modos).map(item => item.chave)).toEqual(['item', 'resultado']);
    expect(colunasEditaveis(COLUNAS, modos).map(item => item.chave)).toEqual(['resultado']);
    expect(colunasVisiveis(COLUNAS).length).toBe(3);
    expect(limparModoColunas(COLUNAS, { grau: 'oculta', inexistente: 'oculta', item: 'qualquer' })).toEqual({ grau: 'oculta' });
    expect(limparModoColunas(COLUNAS, {})).toBeUndefined();
  });

  it('motor: coluna obrigatória oculta ou só leitura não é exigida na etapa', () => {
    const pos = { x: 0, y: 0, largura: 10, altura: 10 };
    const acoes = [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }];
    const resp = [{ tipo: 'autorRevisao' as const, descricao: 'Autor', papelTeste: 'autor' }];
    const definicao = (modoColunas?: Record<string, 'oculta' | 'leitura'>): IFluxoDefinicao => ({
      id: 'f', nome: 'Auditoria', versao: 1, status: 'publicado', processoId: 'p', tiposDocumento: [], larguraDiagrama: 10, alturaDiagrama: 10,
      metadados: [{ chave: 'checklist', rotulo: 'Checklist', tipo: 'tabela', colunas: COLUNAS }],
      elementos: [
        { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
        { id: 'preencher', tipo: 'tarefaHumana', nome: 'Preencher', responsaveis: resp, acoes, posicao: pos,
          campos: [{ chave: 'checklist', rotulo: 'Checklist', tipo: 'tabela', obrigatorio: true, colunas: COLUNAS, modoColunas }] },
        { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
      ],
      transicoes: [
        { id: 't1', origemId: 'inicio', destinoId: 'preencher', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
        { id: 't2', origemId: 'preencher', destinoId: 'fim', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] }
      ]
    });
    const ator = { id: 'u', nome: 'Auditor', papeisTeste: ['autor'] };
    const linhas = JSON.stringify([{ item: 'Lista Mestra', resultado: 'NC' }]);
    const tentar = (def: IFluxoDefinicao): string[] => {
      const inicio = iniciarInstancia(def, { revisaoId: 'r', documentoId: 'r', revisao: 'AUD', ator, simulado: true }).instancia as IFluxoInstancia;
      return executarAcao(def, inicio, { acaoChave: 'concluir', comentario: '', valores: { checklist: linhas }, ator }).erros;
    };

    expect(tentar(definicao()).join(' ')).toContain('preencha "Grau da NC"');
    expect(tentar(definicao({ grau: 'oculta' }))).toEqual([]);
    expect(tentar(definicao({ grau: 'leitura' }))).toEqual([]);
  });

  describe('tela', () => {
    let raiz: HTMLDivElement;
    beforeEach(() => {
      raiz = document.createElement('div');
      document.body.appendChild(raiz);
    });
    afterEach(() => {
      ReactDOM.unmountComponentAtNode(raiz);
      raiz.remove();
    });

    it('não mostra a coluna oculta, mostra a só leitura como texto e mantém o valor oculto ao editar', () => {
      const alteracoes: string[] = [];
      const valor = JSON.stringify([{ item: 'Lista Mestra', resultado: 'C', grau: 'Grave' }]);
      act(() => {
        ReactDOM.render(
          <TabelaCampoFluxo
            id="t"
            rotulo="Checklist"
            colunas={COLUNAS}
            modoColunas={{ grau: 'oculta', item: 'leitura' }}
            valor={valor}
            onAlterar={novo => alteracoes.push(novo)}
          />,
          raiz
        );
      });

      const cabecalho = Array.from(raiz.querySelectorAll('th')).map(item => item.textContent || '');
      expect(cabecalho.some(texto => texto.indexOf('Grau') >= 0)).toBe(false);
      expect(cabecalho.some(texto => texto === 'Item verificado')).toBe(true);
      expect(raiz.querySelector('[aria-label="Item verificado, linha 1"]')?.tagName).toBe('DIV');
      expect(raiz.textContent || '').toContain('Lista Mestra');

      const resultado = raiz.querySelector('select[aria-label="Resultado, linha 1"]') as HTMLSelectElement;
      act(() => {
        resultado.value = 'NC';
        resultado.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(JSON.parse(alteracoes[alteracoes.length - 1])).toEqual([{ item: 'Lista Mestra', resultado: 'NC', grau: 'Grave' }]);
    });

    it('somente leitura: também esconde a coluna oculta', () => {
      act(() => {
        ReactDOM.render(
          <TabelaCampoFluxo id="t" rotulo="Checklist" colunas={COLUNAS} modoColunas={{ grau: 'oculta' }} somenteLeitura={true}
            valor={JSON.stringify([{ item: 'A', resultado: 'NC', grau: 'Grave' }])} />,
          raiz
        );
      });
      expect(raiz.textContent || '').not.toContain('Grave');
      expect(raiz.textContent || '').toContain('NC');
    });
  });

  it('pacote JSON: importa e valida modoColunas', () => {
    const pacote = (modoColunas: unknown): unknown => ({
      formato: 'dgt-portal/pacote-processo@1',
      processo: { codigo: 'AMB-TESTE', nome: 'Teste' },
      metadados: [{ chave: 'checklist', rotulo: 'Checklist', tipo: 'tabela', colunas: COLUNAS }],
      fluxo: {
        elementos: [
          { id: 'inicio', tipo: 'inicio', nome: 'Início' },
          { id: 'preencher', tipo: 'tarefaHumana', nome: 'Preencher', responsaveis: [{ tipo: 'autorRevisao' }],
            acoes: [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido' }],
            campos: [{ chave: 'checklist', obrigatorio: true, modoColunas }] },
          { id: 'fim', tipo: 'fim', nome: 'Fim' }
        ],
        transicoes: [{ de: 'inicio', para: 'preencher' }, { de: 'preencher', para: 'fim' }]
      }
    });
    const refs = { areas: [], usuarios: [], processos: [] };

    const ok = interpretarPacote(pacote({ grau: 'oculta', item: 'leitura' }), refs);
    expect(ok.erros).toEqual([]);
    const etapa = ok.pacote && ok.pacote.definicao ? ok.pacote.definicao.elementos.filter(item => item.id === 'preencher')[0] : undefined;
    expect(etapa && etapa.campos[0].modoColunas).toEqual({ grau: 'oculta', item: 'leitura' });

    expect(interpretarPacote(pacote({ naoExiste: 'oculta' }), refs).erros.join(' ')).toContain('a coluna "naoExiste" não existe');
    expect(interpretarPacote(pacote({ grau: 'editavel' }), refs).erros.join(' ')).toContain('use "oculta" ou "leitura"');
  });
});
