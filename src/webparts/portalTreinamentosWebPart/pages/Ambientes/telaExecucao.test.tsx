/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import RegistroAmbiente from './RegistroAmbiente';

import {
  IAmbiente,
  IAmbienteRegistro
} from '../../models/Ambiente';

import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  executarAcao,
  iniciarInstancia
} from '../../services/fluxo/FluxoEngine';

import {
  layoutPadrao
} from '../../services/ambientes/layoutAmbiente';

import {
  colunaAusente
} from '../../services/ambientes/AmbienteService';

// ============================================================
// TESTE DA TELA — execução da atividade (registro de ambiente)
// ============================================================

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const etapa = (id: string, nome: string): IFluxoElemento => ({
  id, tipo: 'tarefaHumana', nome, posicao: pos, campos: [],
  responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }],
  acoes: [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }]
});
const tr = (id: string, o: string, d: string): IFluxoDefinicao['transicoes'][number] =>
  ({ id, origemId: o, destinoId: d, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] });

const definicao: IFluxoDefinicao = {
  id: 'f', nome: 'Auditoria', versao: 3, status: 'publicado', processoId: 'p', tiposDocumento: [], larguraDiagrama: 600, alturaDiagrama: 200, metadados: [],
  elementos: [
    { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
    etapa('programar', 'Programar e confirmar elegibilidade'),
    etapa('executar', 'Executar auditoria em campo'),
    etapa('relatorio', 'Emitir relatório e atualizar controles'),
    { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
  ],
  transicoes: [tr('t1', 'inicio', 'programar'), tr('t2', 'programar', 'executar'), tr('t3', 'executar', 'relatorio'), tr('t4', 'relatorio', 'fim')]
};

const ator = { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] };

const instanciaNaSegunda = (registroId: string): IFluxoInstancia => {
  const inicio = iniciarInstancia(definicao, { revisaoId: registroId, documentoId: registroId, revisao: registroId, ator, simulado: false }).instancia as IFluxoInstancia;
  return executarAcao(definicao, inicio, { acaoChave: 'concluir', comentario: `Programada (${registroId})`, valores: {}, ator }).instancia as IFluxoInstancia;
};

const ambiente = (mostrarSequencia?: boolean): IAmbiente => ({
  id: 'a1', chave: 'auditoria', nome: 'Auditoria', descricao: '', subtitulo: '', icone: 'grid', ordem: 10, ativo: true,
  liberadoParaTodos: false, perfisPadrao: [], processoId: 'p', processoNome: 'AUD', prefixoCodigo: 'AUD', rotuloRegistro: 'Auditoria',
  layoutJson: '', mostrarSequencia
});

const registro = (id: string): IAmbienteRegistro => ({
  id, ambienteId: 'a1', codigo: `AUD-2026-${id}`, titulo: 'TESTE Auditoria', descricao: '', areaId: '', areaNome: 'PROCESSOS',
  solicitanteId: 'u1', solicitanteNome: 'Automacao Processos', situacao: 'emAndamento', etapaAtual: '', etapaAtualId: '',
  valores: {}, prazoEtapa: '', criadoEm: '2026-11-10T17:59:00Z', concluidoEm: ''
});

let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

const renderizar = (amb: IAmbiente, reg: IAmbienteRegistro, instancia: IFluxoInstancia): void => {
  act(() => {
    ReactDOM.render(
      <RegistroAmbiente
        ambiente={amb}
        registro={reg}
        layout={layoutPadrao(definicao)}
        estado={{ definicao, instancia } as never}
        carregando={false}
        podeAgir={true}
        processando={false}
        podeCancelar={false}
        podeIniciar={true}
        dadosResponsaveis={{}}
        vinculos={[]}
        usuarios={[]}
        onVoltar={() => undefined}
        onCancelar={() => undefined}
        onIniciarFluxo={() => undefined}
        onExecutar={async () => []}
      />,
      raiz
    );
  });
};

const clicar = (texto: string | RegExp): void => {
  const botao = Array.prototype.slice.call(raiz.querySelectorAll('button'))
    .find((b: HTMLButtonElement) => (typeof texto === 'string' ? (b.textContent || '').trim() === texto : texto.test(b.textContent || ''))) as HTMLButtonElement;
  expect(botao).toBeDefined();
  act(() => { botao.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

const desenhoAberto = (): boolean => /Fluxo de Auditoria · .+ · v3/.test(raiz.textContent || '');
const itensSequencia = (): HTMLElement[] => Array.prototype.slice.call(raiz.querySelectorAll('[role="list"][aria-label="Sequência de atividades"] [role="listitem"]'));

// Menu "Seções do registro" (painel esquerdo): cada botão tem ícone,
// rótulo e, no Histórico, o contador de eventos.
const itensMenu = (): HTMLButtonElement[] =>
  Array.prototype.slice.call(raiz.querySelectorAll('nav[aria-label="Seções do registro"] button'));
const rotuloMenu = (botao: HTMLButtonElement): string =>
  ((botao.querySelectorAll('span')[1] as HTMLElement).textContent || '').trim();
const contadorMenu = (botao: HTMLButtonElement): string | undefined => {
  const contador = botao.querySelectorAll('span')[2] as HTMLElement | undefined;
  return contador ? (contador.textContent || '').trim() : undefined;
};
const clicarMenu = (rotulo: string): void => {
  const botao = itensMenu().filter(item => rotuloMenu(item) === rotulo)[0];
  expect(botao).toBeDefined();
  act(() => { botao.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('Tela de execução da atividade', () => {

  it('menu do painel esquerdo: Dados do documento → Histórico (com contador) → Ver fluxo; começa em Dados', () => {
    const instancia = instanciaNaSegunda('0001');
    renderizar(ambiente(), registro('0001'), instancia);
    const menu = itensMenu();
    expect(menu.map(rotuloMenu)).toEqual(['Dados do documento', 'Histórico', 'Ver fluxo']);
    expect(contadorMenu(menu[1])).toBe(String(instancia.historico.length));
    expect(menu.map(botao => botao.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  });

  it('"Ver fluxo" abre o fluxo à direita, "Dados do documento" volta e outro registro reabre em Dados', () => {
    renderizar(ambiente(), registro('0001'), instanciaNaSegunda('0001'));
    expect(desenhoAberto()).toBe(false);
    clicarMenu('Ver fluxo');
    expect(desenhoAberto()).toBe(true);
    clicarMenu('Dados do documento');
    expect(desenhoAberto()).toBe(false);
    clicarMenu('Ver fluxo');
    renderizar(ambiente(), registro('0002'), instanciaNaSegunda('0002'));
    expect(desenhoAberto()).toBe(false);
    expect(itensMenu().map(botao => botao.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  });

  it('histórico é o do registro aberto (mesmos eventos gravados, do mais recente para o mais antigo)', () => {
    const instancia = instanciaNaSegunda('0001');
    renderizar(ambiente(), registro('0001'), instancia);
    expect(raiz.querySelectorAll('[data-historico]')).toHaveLength(0);
    clicarMenu('Histórico');
    const ids = Array.prototype.slice.call(raiz.querySelectorAll('[data-historico]')).map((e: HTMLElement) => e.getAttribute('data-historico'));
    const esperado = instancia.historico.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(passo => passo.id);
    expect(ids).toEqual(esperado);
    expect(raiz.textContent).toMatch(/Programada \(0001\)/);
  });

  it('sequência: concluída, atual e a fazer; "Ocultar/Mostrar sequência"', () => {
    renderizar(ambiente(true), registro('0001'), instanciaNaSegunda('0001'));
    expect(itensSequencia().map(item => item.getAttribute('data-estado'))).toEqual(['concluida', 'atual', 'futura']);
    expect(itensSequencia().map(item => `${(item.querySelector('strong') as HTMLElement).textContent} | ${(item.querySelector('strong + span') as HTMLElement).textContent}`)).toEqual([
      'Programar e confirmar elegibilidade | Concluída', 'Executar auditoria em campo | Etapa atual', 'Emitir relatório e atualizar controles | A fazer'
    ]);
    expect(itensSequencia()[1].getAttribute('aria-current')).toBe('step');
    clicar('Ocultar sequência');
    expect(itensSequencia()).toHaveLength(0);
    clicar('Mostrar sequência');
    expect(itensSequencia()).toHaveLength(3);
  });

  it('opção do ambiente desligada: sem faixa e sem controle; "Ver fluxo" continua', () => {
    renderizar(ambiente(false), registro('0001'), instanciaNaSegunda('0001'));
    expect(itensSequencia()).toHaveLength(0);
    expect(raiz.textContent).not.toMatch(/Ocultar sequência|Mostrar sequência/);
    clicarMenu('Ver fluxo');
    expect(desenhoAberto()).toBe(true);
  });

  it('ambiente antigo (sem a configuração salva): mostra a sequência, como antes', () => {
    renderizar(ambiente(undefined), registro('0001'), instanciaNaSegunda('0001'));
    expect(itensSequencia()).toHaveLength(3);
  });

  it('coluna ausente identificada pela mensagem do Dataverse', () => {
    expect(colunaAusente("Could not find a property named 'dgt_mostrarsequencia' on type 'Microsoft.Dynamics.CRM.dgt_ambiente'.")).toBe('dgt_mostrarsequencia');
    expect(colunaAusente('outro erro')).toBeUndefined();
  });
});
