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
  editarCamposAdministrador,
  executarAcao,
  iniciarInstancia
} from '../../services/fluxo/FluxoEngine';

import {
  layoutPadrao
} from '../../services/ambientes/layoutAmbiente';

import {
  AmbienteFluxoService
} from '../../services/ambientes/AmbienteFluxoService';

// ============================================================
// TESTES — menu ⋮ do Administrador do Sistema e fim do rodapé
// ============================================================

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const acoes = [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }];
const etapa = (id: string, nome: string, campos: IFluxoElemento['campos']): IFluxoElemento => ({
  id, tipo: 'tarefaHumana', nome, posicao: pos, campos, acoes,
  responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }]
});
const tr = (id: string, o: string, d: string): IFluxoDefinicao['transicoes'][number] =>
  ({ id, origemId: o, destinoId: d, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] });

const definicao: IFluxoDefinicao = {
  id: 'f', nome: 'Auditoria', versao: 3, status: 'publicado', processoId: 'p', tiposDocumento: [], larguraDiagrama: 10, alturaDiagrama: 10,
  metadados: [
    { chave: 'processo', rotulo: 'Processo auditado', tipo: 'texto' },
    { chave: 'dataRealizada', rotulo: 'Data realizada', tipo: 'data' },
    { chave: 'levantamento', rotulo: 'Levantamento da trilha', tipo: 'textoLongo' },
    { chave: 'auditor', rotulo: 'Auditor', tipo: 'texto' }
  ],
  elementos: [
    { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
    etapa('programar', 'Programar', [{ chave: 'processo', rotulo: 'Processo auditado', tipo: 'texto', obrigatorio: true }]),
    etapa('executar', 'Executar auditoria em campo', [
      { chave: 'dataRealizada', rotulo: 'Data realizada', tipo: 'data', obrigatorio: true },
      { chave: 'levantamento', rotulo: 'Levantamento da trilha', tipo: 'textoLongo', obrigatorio: false },
      { chave: 'auditor', rotulo: 'Auditor', tipo: 'texto', obrigatorio: false, somenteLeitura: true }
    ]),
    { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
  ],
  transicoes: [tr('t1', 'inicio', 'programar'), tr('t2', 'programar', 'executar'), tr('t3', 'executar', 'fim')]
};

const ator = { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] };
const admin = { id: 'adm', nome: 'Admin', papeisTeste: [] };

const naExecucao = (): IFluxoInstancia => {
  const inicio = iniciarInstancia(definicao, { revisaoId: 'r', documentoId: 'd', revisao: 'AUD-1', ator, simulado: false }).instancia as IFluxoInstancia;
  const r = executarAcao(definicao, inicio, { acaoChave: 'concluir', comentario: '', valores: { processo: 'Compras' }, ator });
  const instancia = r.instancia as IFluxoInstancia;
  instancia.valores.dataRealizada = '2026-11-20';
  instancia.valores.auditor = 'William';
  return instancia;
};

describe('Edição administrativa no motor', () => {

  it('salva os campos e MANTÉM a etapa, as tarefas e a situação; registra no histórico', () => {
    const antes = naExecucao();
    const r = editarCamposAdministrador(definicao, antes, { valores: { levantamento: 'Trilha revisada', dataRealizada: '2026-11-21' }, comentario: 'Correção', ator: admin });
    expect(r.erros).toEqual([]);
    const depois = r.instancia as IFluxoInstancia;
    expect(depois.elementoAtualId).toBe('executar');
    expect(depois.status).toBe('emAndamento');
    expect(depois.tarefas).toEqual(antes.tarefas);
    expect(depois.valores).toMatchObject({ processo: 'Compras', levantamento: 'Trilha revisada', dataRealizada: '2026-11-21' });
    expect(depois.historico[0]).toMatchObject({
      acaoChave: 'edicaoAdministrativa', acaoRotulo: 'Edição administrativa', elementoNome: 'Executar auditoria em campo', executadoPorNome: 'Admin'
    });
    expect(depois.historico[0].comentario).toMatch(/^Correção · Data realizada .+ · Levantamento da trilha Trilha revisada$/);
  });

  it('validações: obrigatório não pode ser apagado; somente leitura é ignorado; sem mudança não grava', () => {
    expect(editarCamposAdministrador(definicao, naExecucao(), { valores: { dataRealizada: '' }, comentario: '', ator: admin }).erros)
      .toEqual(['"Data realizada" é obrigatório nesta etapa e não pode ficar vazio.']);
    expect(editarCamposAdministrador(definicao, naExecucao(), { valores: { auditor: 'Outro' }, comentario: '', ator: admin }).erros)
      .toEqual(['Nenhum campo foi alterado.']);
  });
});

describe('Permissão no serviço (usuário comum)', () => {

  const comum = { perfil: 'Funcionario', usuarioId: 'u2', nome: 'Bruno' } as never;
  const amb = { id: 'a1', chave: 'auditoria' } as never;
  const reg = { id: 'r1', situacao: 'emAndamento' } as never;
  // Dataverse falso: qualquer uso falharia o teste.
  const servico = new AmbienteFluxoService({} as never);

  it('recusa cancelar e editar como administrador sem tocar no Dataverse', async () => {
    expect((await servico.cancelar(amb, reg, 'motivo', comum)).erros).toEqual(['Somente o Administrador do Sistema pode cancelar registros.']);
    expect((await servico.editarComoAdministrador(amb, reg, comum, { a: '1' }, '')).erros).toEqual(['Somente o Administrador do Sistema pode editar como administrador.']);
  });
});

// ---------- tela ----------

const ambiente: IAmbiente = {
  id: 'a1', chave: 'auditoria', nome: 'Auditoria', descricao: '', subtitulo: '', icone: 'grid', ordem: 10, ativo: true,
  liberadoParaTodos: false, perfisPadrao: [], processoId: 'p', processoNome: 'AUD', prefixoCodigo: 'AUD', rotuloRegistro: 'Auditoria', layoutJson: ''
};
const registro: IAmbienteRegistro = {
  id: 'r1', ambienteId: 'a1', codigo: 'AUD-2026-0001', titulo: 'TESTE Auditoria', descricao: '', areaId: '', areaNome: '',
  solicitanteId: 'u1', solicitanteNome: 'Ana', situacao: 'emAndamento', etapaAtual: '', etapaAtualId: '', valores: {}, prazoEtapa: '',
  criadoEm: '2026-11-10T17:59:00Z', concluidoEm: ''
};

let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

const renderizar = (adminSistema: boolean, onEditar?: (v: Record<string, string>, c: string) => Promise<string[]>, onCancelar?: () => void): void => {
  act(() => {
    ReactDOM.render(
      <RegistroAmbiente
        ambiente={ambiente}
        registro={registro}
        layout={layoutPadrao(definicao)}
        estado={{ definicao, instancia: naExecucao() } as never}
        carregando={false}
        podeAgir={false}
        processando={false}
        podeCancelar={adminSistema}
        podeAdministrarSistema={adminSistema}
        onEditarComoAdministrador={onEditar}
        podeIniciar={true}
        dadosResponsaveis={{}}
        vinculos={[]}
        usuarios={[]}
        onVoltar={() => undefined}
        onCancelar={onCancelar || (() => undefined)}
        onIniciarFluxo={() => undefined}
        onExecutar={async () => []}
      />,
      raiz
    );
  });
};

const clicar = (seletor: string, texto?: string): void => {
  const alvo = Array.prototype.slice.call(raiz.querySelectorAll(seletor))
    .find((e: HTMLElement) => !texto || (e.textContent || '').trim() === texto) as HTMLElement;
  expect(alvo).toBeDefined();
  act(() => { alvo.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('Tela do registro: administrador × usuário comum', () => {

  it('usuário comum: sem rodapé, sem menu ⋮ e sem "Cancelar registro"', () => {
    renderizar(false);
    expect(raiz.textContent).not.toMatch(/Campos preenchidos/);
    expect(raiz.querySelector('button[aria-label="Ações do administrador"]')).toBeNull();
    expect(raiz.textContent).not.toMatch(/Cancelar registro|Editar como administrador/);
    // Só os campos configurados na etapa (o campo da etapa anterior não aparece).
    // (o histórico ainda cita o campo anterior; o formulário, não).
    const texto = raiz.textContent || '';
    const formulario = texto.substring(texto.indexOf('Etapa: Executar auditoria em campo'));
    expect(formulario).toMatch(/Data realizada/);
    expect(formulario).not.toMatch(/Processo auditado/);
  });

  it('administrador: menu ⋮ com exatamente duas opções; "Cancelar registro" reutiliza a ação atual', () => {
    let cancelou = 0;
    renderizar(true, async () => [], () => { cancelou++; });
    expect(raiz.textContent).not.toMatch(/Campos preenchidos/);
    clicar('button[aria-label="Ações do administrador"]');
    const opcoes = Array.prototype.slice.call(raiz.querySelectorAll('[role="menuitem"]')).map((e: HTMLElement) => e.textContent);
    expect(opcoes).toEqual(['Editar como administrador', 'Cancelar registro']); // sem onExecutarComoAdministrador, a 3ª opção não aparece
    clicar('[role="menuitem"]', 'Cancelar registro');
    expect(cancelou).toBe(1);
  });

  it('"Editar como administrador": formulário editável mesmo sem ser responsável; salvar fecha a edição', async () => {
    const salvos: Array<Record<string, string>> = [];
    renderizar(true, async valores => { salvos.push(valores); return []; });
    expect(raiz.textContent).toMatch(/Somente os responsáveis/);
    clicar('button[aria-label="Ações do administrador"]');
    clicar('[role="menuitem"]', 'Editar como administrador');
    expect(raiz.querySelector('[data-edicao-admin]')).not.toBeNull();
    const area = raiz.querySelector('textarea:not([placeholder^="Ex.: correção"])') as HTMLTextAreaElement;
    expect(area.disabled).toBe(false);
    await act(async () => {
      (Array.prototype.slice.call(raiz.querySelectorAll('button')).find((b: HTMLButtonElement) => b.textContent === 'Salvar campos') as HTMLButtonElement)
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(salvos).toHaveLength(1);
    expect(raiz.querySelector('[data-edicao-admin]')).toBeNull();
  });
});

describe('Executar ação como administrador (motor)', () => {

  it('executa no lugar do responsável, exige justificativa e marca o histórico', () => {
    const antes = naExecucao();
    expect(executarAcao(definicao, antes, { acaoChave: 'concluir', comentario: '', valores: {}, ator: admin }).erros)
      .toEqual(['Admin não é responsável pela etapa "Executar auditoria em campo".']);
    expect(executarAcao(definicao, antes, { acaoChave: 'concluir', comentario: '  ', valores: {}, ator: admin, comoAdministrador: true }).erros)
      .toEqual(['Informe no comentário a justificativa da ação executada como administrador.']);
    const r = executarAcao(definicao, antes, { acaoChave: 'concluir', comentario: 'Auditor de férias', valores: {}, ator: admin, comoAdministrador: true });
    expect(r.erros).toEqual([]);
    const depois = r.instancia as IFluxoInstancia;
    expect(depois.status).toBe('concluido');
    expect(depois.historico.find(h => h.elementoId === 'executar')).toMatchObject({
      acaoRotulo: 'Concluir (como administrador)', executadoPorNome: 'Admin', comoAdministrador: true
    });
  });
});
