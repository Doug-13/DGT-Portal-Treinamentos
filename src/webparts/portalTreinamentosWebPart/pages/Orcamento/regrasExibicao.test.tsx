/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import PainelFluxoOrcamento from './PainelFluxoOrcamento';
import PainelPropriedadesFluxo from '../Processos/PainelPropriedadesFluxo';
import PainelMetadados from '../Processos/PainelMetadados';

import {
  aplicarMetadadosNaDefinicao
} from '../../services/processos/MetadadosProcessoService';

import {
  gravarConfigColunasJson,
  lerConfigColunasJson
} from '../../services/fluxo/dataverse/MetadadosRepositorioDataverse';

import {
  validarRegrasExibicao
} from '../../services/fluxo/regraExibicao';

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

  it('atividade: só os modos; regras antigas desta etapa continuam e aparecem como tal', () => {
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
    expect(opcoes).toEqual(['Não exibir', 'Opcional', 'Obrigatório', 'Somente leitura', 'Obrigatório (regra antiga desta etapa)']);
    const opcoesExige = Array.prototype.slice.call(raiz.querySelectorAll('select[aria-label="Uso do campo Exige retreinamento?"] option')).map((o: HTMLOptionElement) => o.textContent);
    expect(opcoesExige).toEqual(['Não exibir', 'Opcional', 'Obrigatório', 'Somente leitura']);
    expect((raiz.querySelector('select[aria-label="Uso do campo Justificativa"]') as HTMLSelectElement).value).toBe('condicional');
    expect((raiz.querySelector('select[aria-label="Uso do campo Motivo"]') as HTMLSelectElement).value).toBe('opcionalCondicional');
    expect((raiz.textContent || '').match(/condicional/g)).toHaveLength(2);
    expect(raiz.textContent).toMatch(/Regra antiga desta etapa:/);
    expect(raiz.textContent).toMatch(/metadados do processo/);
  });

  it('regra NO PROCESSO: vale na atividade e no ambiente (obrigatório só quando aparece)', () => {
    // Atividade só com modos (sem regra), processo com a regra.
    const camposSemRegra = [
      { chave: 'exige', rotulo: 'Exige retreinamento?', tipo: 'simNao' as const, obrigatorio: true },
      { chave: 'justificativa', rotulo: 'Justificativa', tipo: 'textoLongo' as const, obrigatorio: true },
      { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto' as const, obrigatorio: false }
    ];
    const metadadosComRegra: IFluxoMetadado[] = [
      METADADOS[0],
      { ...METADADOS[1], exibirQuando: { campo: 'exige', valor: 'nao' } },
      { ...METADADOS[2], exibirQuando: { campo: 'exige', valor: 'sim' } }
    ];
    const definicaoBase = { ...definicao, elementos: definicao.elementos.map(e => (e.id === 'avaliar' ? { ...e, campos: camposSemRegra } : e)) };
    const aplicada = aplicarMetadadosNaDefinicao(definicaoBase, metadadosComRegra);
    const campos = (aplicada.elementos.find(e => e.id === 'avaliar') as IFluxoElemento).campos;
    expect(campos[1]).toMatchObject({ obrigatorio: false, obrigatorioQuando: { campo: 'exige', valor: 'nao' } });
    expect(campos[2]).toMatchObject({ mostrarQuando: { campo: 'exige', valor: 'sim' } });

    const instancia = iniciarInstancia(aplicada, { revisaoId: 'r1', documentoId: 'd1', revisao: 'AUD-1', ator: { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] }, simulado: false }).instancia as IFluxoInstancia;
    instancia.valores.exige = 'nao';
    renderizar(<PainelFluxoOrcamento estado={{ definicao: aplicada, instancia } as never} dadosResponsaveis={{}} vinculos={[]} usuarios={[]} podeAgir={true} processando={false} modoCompacto={true} ocultarHistorico={true} />);
    expect(rotulosVisiveis()).toEqual(['Exige retreinamento? *', 'Justificativa *']);

    // Na atividade: o modo é o da atividade e a regra do processo aparece.
    renderizar(
      <PainelPropriedadesFluxo
        secao="campos"
        selecionado={{ id: 'avaliar', tipoBpmn: 'bpmn:UserTask', nome: 'Avaliar', conexao: false }}
        tipo="tarefaHumana"
        editavel={true}
        configElemento={{ ...configPadraoElemento('tarefaHumana'), campos: camposSemRegra }}
        onAlterarElemento={() => undefined}
        onAlterarTransicao={() => undefined}
        resultadosDisponiveis={[]}
        metadados={metadadosComRegra}
        onRenomear={() => undefined}
        saidas={[]}
        onAlterarSaida={() => undefined}
        onDefinirPadraoSaida={() => undefined}
        onRenomearSaida={() => undefined}
        onSelecionarSaida={() => undefined}
      />
    );
    expect((raiz.querySelector('select[aria-label="Uso do campo Justificativa"]') as HTMLSelectElement).value).toBe('obrigatorio');
    expect(raiz.textContent).toMatch(/Regra do processo: Exibir só quando "Exige retreinamento\?" for Não \(obrigatório só quando aparece\)/);
  });

  it('tela do processo: "+ Regra de exibição" grava a regra no metadado', () => {
    let gravados: IFluxoMetadado[] = [];
    renderizar(<PainelMetadados metadados={METADADOS} editavel={true} usoPorChave={{}} onAlterar={lista => { gravados = lista; }} />);
    const botoes = Array.prototype.slice.call(raiz.querySelectorAll('button')).filter((b: HTMLButtonElement) => b.textContent === '+ Regra de exibição') as HTMLButtonElement[];
    expect(botoes).toHaveLength(3);
    act(() => { botoes[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const aplicar = Array.prototype.slice.call(raiz.querySelectorAll('button')).find((b: HTMLButtonElement) => b.textContent === 'aplicar') as HTMLButtonElement;
    act(() => { aplicar.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(gravados[1].exibirQuando).toEqual({ campo: 'exige', valor: 'sim' });
  });

  it('gravação: regra preservada; tabela sem regra continua no formato antigo', () => {
    const tabela: IFluxoMetadado = { chave: 't', rotulo: 'T', tipo: 'tabela', colunas: [{ chave: 'a', rotulo: 'A', tipo: 'texto' }] };
    expect(gravarConfigColunasJson(tabela)).toBe('[{"chave":"a","rotulo":"A","tipo":"texto"}]');
    expect(lerConfigColunasJson(gravarConfigColunasJson(tabela)).colunas).toEqual(tabela.colunas);
    const comRegra = { ...tabela, exibirQuando: { campo: 'exige', valor: 'nao' } };
    expect(lerConfigColunasJson(gravarConfigColunasJson(comRegra))).toEqual({ colunas: tabela.colunas, avaliacao: undefined, componente: undefined, exibirQuando: { campo: 'exige', valor: 'nao' } });
    const texto: IFluxoMetadado = { chave: 'j', rotulo: 'J', tipo: 'texto', exibirQuando: { campo: 'exige', valor: 'sim' } };
    expect(lerConfigColunasJson(gravarConfigColunasJson(texto)).exibirQuando).toEqual({ campo: 'exige', valor: 'sim' });
    expect(gravarConfigColunasJson({ chave: 'x', rotulo: 'X', tipo: 'texto' })).toBe('');
  });

  it('validação das regras do processo', () => {
    expect(validarRegrasExibicao([METADADOS[0], { ...METADADOS[1], exibirQuando: { campo: 'exige', valor: 'nao' } }])).toEqual([]);
    expect(validarRegrasExibicao([{ ...METADADOS[1], exibirQuando: { campo: 'sumiu', valor: 'x' } }]).join(' ')).toMatch(/não existe/);
    expect(validarRegrasExibicao([METADADOS[0], { ...METADADOS[1], exibirQuando: { campo: 'exige', valor: '' } }]).join(' ')).toMatch(/Informe o valor/);
    expect(validarRegrasExibicao([
      { ...METADADOS[0], exibirQuando: { campo: 'motivo', valor: 'a' } },
      { ...METADADOS[2], exibirQuando: { campo: 'exige', valor: 'sim' } }
    ]).join(' ')).toMatch(/dependem um do outro/);
  });
});
