/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import PainelFluxoOrcamento from './PainelFluxoOrcamento';
import PainelPropriedadesFluxo from '../Processos/PainelPropriedadesFluxo';

import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  campoVisivel,
  iniciarInstancia
} from '../../services/fluxo/FluxoEngine';

import {
  configPadraoElemento
} from '../../services/fluxo/bpmn/bpmnConversao';

// ============================================================
// TESTES — regras de exibição dos campos ("exibir só quando")
// ============================================================

const METADADOS: IFluxoMetadado[] = [
  { chave: 'exige', rotulo: 'Exige retreinamento?', tipo: 'simNao' },
  { chave: 'justificativa', rotulo: 'Justificativa', tipo: 'textoLongo' },
  { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto' }
];

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const etapa: IFluxoElemento = {
  id: 'avaliar', tipo: 'tarefaHumana', nome: 'Avaliar', posicao: pos,
  responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }],
  acoes: [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }],
  campos: [
    { chave: 'exige', rotulo: 'Exige retreinamento?', tipo: 'simNao', obrigatorio: true },
    { chave: 'justificativa', rotulo: 'Justificativa', tipo: 'textoLongo', obrigatorio: false, obrigatorioQuando: { campo: 'exige', valor: 'nao' } },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto', obrigatorio: false, mostrarQuando: { campo: 'exige', valor: 'sim' } }
  ]
};

const definicao: IFluxoDefinicao = {
  id: 'f', nome: 'Teste', versao: 1, status: 'publicado', processoId: 'p', tiposDocumento: [], larguraDiagrama: 100, alturaDiagrama: 100,
  metadados: METADADOS,
  elementos: [
    { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
    etapa,
    { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
  ],
  transicoes: [
    { id: 't1', origemId: 'inicio', destinoId: 'avaliar', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] },
    { id: 't2', origemId: 'avaliar', destinoId: 'fim', tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] }
  ]
};

let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

// Único ponto de render (o unmount fica no afterEach).
const renderizar = (elemento: React.ReactElement): void => {
  act(() => { ReactDOM.render(elemento, raiz); });
};

const rotulosVisiveis = (): string[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('label > span:first-child')).map((item: HTMLElement) => (item.textContent || '').trim());

const etapaDoAmbiente = (exige: string): void => {
  const instancia = iniciarInstancia(definicao, {
    revisaoId: 'r1', documentoId: 'd1', revisao: 'AUD-1', ator: { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] }, simulado: false
  }).instancia as IFluxoInstancia;
  instancia.valores.exige = exige;
  renderizar(<PainelFluxoOrcamento
        estado={{ definicao, instancia } as never}
        dadosResponsaveis={{}}
        vinculos={[]}
        usuarios={[]}
        podeAgir={true}
        processando={false}
        modoCompacto={true}
        ocultarHistorico={true}
      />);
};

describe('Regra de exibição', () => {

  it('campoVisivel: sem condição sempre; com condição só quando o valor bate', () => {
    expect(campoVisivel(etapa.campos[0], {})).toBe(true);
    expect(campoVisivel(etapa.campos[1], { exige: 'nao' })).toBe(true);
    expect(campoVisivel(etapa.campos[1], { exige: 'sim' })).toBe(false);
    expect(campoVisivel(etapa.campos[2], {})).toBe(false);
  });

  it('ambiente: "Justificativa" só quando "Exige retreinamento?" = Não; "Motivo" só quando = Sim', () => {
    etapaDoAmbiente('nao');
    expect(rotulosVisiveis()).toEqual(['Exige retreinamento? *', 'Justificativa *']);
    etapaDoAmbiente('sim');
    expect(rotulosVisiveis()).toEqual(['Exige retreinamento? *', 'Motivo']);
    etapaDoAmbiente('');
    expect(rotulosVisiveis()).toEqual(['Exige retreinamento? *']);
  });

  it('editor: opções com nome claro e etiqueta "condicional" no campo', () => {
    renderizar(<PainelPropriedadesFluxo
          secao="campos"
          selecionado={{ id: 'avaliar', tipoBpmn: 'bpmn:UserTask', nome: 'Avaliar', conexao: false }}
          tipo="tarefaHumana"
          editavel={true}
          configElemento={{ ...configPadraoElemento('tarefaHumana'), campos: etapa.campos }}
          onAlterarElemento={() => undefined}
          onAlterarTransicao={() => undefined}
          resultadosDisponiveis={[]}
          metadados={METADADOS}
          onRenomear={() => undefined}
          saidas={[]}
          onAlterarSaida={() => undefined}
          onDefinirPadraoSaida={() => undefined}
          onRenomearSaida={() => undefined}
          onSelecionarSaida={() => undefined}
        />);
    const opcoes = Array.prototype.slice.call(raiz.querySelectorAll('select[aria-label="Uso do campo Justificativa"] option')).map((o: HTMLOptionElement) => o.textContent);
    expect(opcoes).toEqual(['Não exibir', 'Opcional', 'Obrigatório', 'Somente leitura', 'Opcional — exibir só quando…', 'Obrigatório — exibir só quando…']);
    expect((raiz.querySelector('select[aria-label="Uso do campo Justificativa"]') as HTMLSelectElement).value).toBe('condicional');
    expect((raiz.querySelector('select[aria-label="Uso do campo Motivo"]') as HTMLSelectElement).value).toBe('opcionalCondicional');
    expect((raiz.textContent || '').match(/condicional/g)).toHaveLength(2);
    expect(raiz.textContent).toMatch(/Exibir só quando/);
    expect(raiz.textContent).toMatch(/Regra de exibição:/);
  });
});
