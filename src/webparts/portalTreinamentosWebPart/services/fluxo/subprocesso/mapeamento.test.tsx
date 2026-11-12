/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import {
  IConfigSubprocesso,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoMetadado
} from '../../../models/Fluxo';

import {
  adaptarValor,
  adaptarValoresIniciais,
  camposAusentesNoFilho,
  compatibilidade,
  sugerirMapeamentos,
  validarMapeamentos
} from './mapeamentoSubprocesso';

import {
  executarAcao,
  iniciarInstancia
} from '../FluxoEngine';

import {
  validarDefinicao
} from '../FluxoValidacao';

import {
  FluxoService
} from '../FluxoService';

import {
  IFluxoRepositorio
} from '../FluxoRepositorioLocal';

import PainelSubprocesso from '../../../pages/Processos/PainelSubprocesso';

// ============================================================
// TESTES — mapeamento pai → filho (Auditoria → Plano de ação)
// ============================================================

const PAI: IFluxoMetadado[] = [
  { chave: 'areaAuditada', rotulo: 'Área auditada', tipo: 'area' },
  { chave: 'auditor', rotulo: 'Auditor responsável', tipo: 'usuario' },
  { chave: 'grau', rotulo: 'Grau da não conformidade', tipo: 'lista', opcoes: ['Leve', 'Moderada', 'Grave'] },
  { chave: 'dataAuditoria', rotulo: 'Data da auditoria', tipo: 'data' },
  { chave: 'constatacoes', rotulo: 'Constatações', tipo: 'tabela', colunas: [{ chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' }, { chave: 'prazo', rotulo: 'Prazo', tipo: 'data' }] }
];

const FILHO: IFluxoMetadado[] = [
  { chave: 'areaAuditada', rotulo: 'Área responsável', tipo: 'area' },
  { chave: 'responsavelAuditoria', rotulo: 'Auditor responsável', tipo: 'texto' },
  { chave: 'gravidade', rotulo: 'Gravidade', tipo: 'lista', opcoes: ['leve', 'grave'] },
  { chave: 'prazoAcao', rotulo: 'Prazo da ação', tipo: 'data' },
  { chave: 'dono', rotulo: 'Dono', tipo: 'usuario' }
];

const config = (parcial: Partial<IConfigSubprocesso> = {}): IConfigSubprocesso => ({
  fluxoId: 'p-pda', origem: 'tabela', campoTabela: 'constatacoes', campoReferencias: '', tipoDocumento: 'PDA',
  titulo: '{pai.codigo} — {n}', autor: 'executor', mapeamentos: [], aguardar: 'nao', ...parcial
});

const USUARIO = JSON.stringify({ id: 'u1', nome: 'Ana Souza' });
const AREA = JSON.stringify({ id: 'a1', nome: 'Processos', sigla: 'PRO' });

describe('Compatibilidade e adaptação', () => {

  it('compatibilidade por tipo', () => {
    expect(compatibilidade({ tipo: 'area', rotulo: 'A' }, FILHO[0]).nivel).toBe('ok');
    expect(compatibilidade({ tipo: 'usuario', rotulo: 'A' }, FILHO[1]).nivel).toBe('ok'); // vira texto
    const lista = compatibilidade({ tipo: 'lista', opcoes: ['Leve', 'Moderada', 'Grave'], rotulo: 'G' }, FILHO[2]);
    expect(lista.nivel).toBe('aviso');
    expect(lista.mensagem).toMatch(/Moderada/);
    expect(compatibilidade({ tipo: 'texto', rotulo: 'T' }, FILHO[4]).nivel).toBe('incompativel');
  });

  it('adapta o valor ao campo do filho (ou descarta)', () => {
    expect(adaptarValor(USUARIO, FILHO[1])).toBe('Ana Souza');
    expect(adaptarValor(AREA, { chave: 'x', rotulo: 'X', tipo: 'texto' })).toBe('PRO — Processos');
    expect(adaptarValor('Grave', FILHO[2])).toBe('grave');
    expect(adaptarValor('Moderada', FILHO[2])).toBeUndefined();
    expect(adaptarValor('25/11/2026', FILHO[3])).toBe('2026-11-25');
    expect(adaptarValor('1.234,5', { chave: 'n', rotulo: 'N', tipo: 'numero' })).toBe('1234.5');
    expect(adaptarValor('Ana', FILHO[4])).toBeUndefined();
    const r = adaptarValoresIniciais({ responsavelAuditoria: USUARIO, gravidade: 'Moderada', naoExiste: 'x' }, FILHO);
    expect(r.valores).toEqual({ responsavelAuditoria: 'Ana Souza' });
    expect(r.descartados).toEqual(['Gravidade', 'naoExiste']);
  });

  it('mapear automaticamente: mesma chave ou mesmo nome, tipo compatível; não mexe nos existentes', () => {
    const existentes = config({ mapeamentos: [{ origem: 'coluna:prazo', destino: 'prazoAcao' }] });
    expect(sugerirMapeamentos(existentes, PAI, FILHO)).toEqual([
      { origem: 'campo:areaAuditada', destino: 'areaAuditada' },
      { origem: 'campo:auditor', destino: 'responsavelAuditoria' }
    ]);
    expect(camposAusentesNoFilho(PAI, FILHO).map(item => item.chave)).toEqual(['auditor', 'grau', 'dataAuditoria', 'constatacoes']);
  });

  it('validação com os campos do filho: destino inexistente e tipo incompatível', () => {
    const erros = validarMapeamentos('Abrir planos', config({ mapeamentos: [
      { origem: 'campo:dataAuditoria', destino: 'sumiu' },
      { origem: 'coluna:descricao', destino: 'dono' },
      { origem: 'campo:areaAuditada', destino: 'areaAuditada' }
    ] }), PAI, FILHO);
    expect(erros).toHaveLength(2);
    expect(erros[0]).toMatch(/"sumiu" não existe mais/);
    expect(erros[1]).toMatch(/Descrição" → "Dono": Tipos diferentes/);
  });
});

// ---------- motor: herdados ----------

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const etapa = (id: string, nome: string, campos: IFluxoElemento['campos']): IFluxoElemento => ({
  id, tipo: 'tarefaHumana', nome, posicao: pos, campos,
  responsaveis: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }],
  acoes: [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }]
});
const tr = (id: string, o: string, d: string): IFluxoDefinicao['transicoes'][number] =>
  ({ id, origemId: o, destinoId: d, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] });

const definicaoFilho: IFluxoDefinicao = {
  id: 'f', nome: 'Plano de ação', versao: 1, status: 'publicado', processoId: 'p-pda', tiposDocumento: [], larguraDiagrama: 10, alturaDiagrama: 10,
  metadados: FILHO,
  elementos: [
    { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
    etapa('planejar', 'Planejar', [{ chave: 'prazoAcao', rotulo: 'Prazo', tipo: 'data', obrigatorio: false }]),
    // O campo herdado é EDITÁVEL só numa etapa posterior; a etapa pode devolver.
    {
      ...etapa('verificar', 'Verificar', [{ chave: 'responsavelAuditoria', rotulo: 'Auditor', tipo: 'texto', obrigatorio: false }]),
      acoes: [
        { chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false },
        { chave: 'devolver', rotulo: 'Devolver', resultado: 'devolvido', principal: false, exigeComentario: false }
      ]
    },
    { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
  ],
  transicoes: [
    tr('t1', 'inicio', 'planejar'), tr('t2', 'planejar', 'verificar'),
    { ...tr('t3', 'verificar', 'fim'), tipoCondicao: 'resultado', resultado: 'concluido' },
    { ...tr('t4', 'verificar', 'planejar'), tipoCondicao: 'resultado', resultado: 'devolvido', excecao: true }
  ]
};

const ator = { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] };
const origem = { documentoId: 'pai', codigo: 'AUD-1', titulo: 'Auditoria' };

describe('Motor: valores herdados', () => {

  it('CORREÇÃO: na DEVOLUÇÃO, o valor herdado (campo editável de etapa posterior) não é apagado', () => {
    const comOrigem = iniciarInstancia(definicaoFilho, {
      revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00A', ator, simulado: false,
      valoresIniciais: { responsavelAuditoria: 'Ana Souza' }, origemSubprocesso: origem
    }).instancia as IFluxoInstancia;
    const naVerificacao = executarAcao(definicaoFilho, comOrigem, { acaoChave: 'concluir', comentario: '', valores: {}, ator }).instancia as IFluxoInstancia;
    expect(naVerificacao.valores.responsavelAuditoria).toBe('Ana Souza');
    const devolvido = executarAcao(definicaoFilho, naVerificacao, { acaoChave: 'devolver', comentario: '', valores: {}, ator }).instancia as IFluxoInstancia;
    expect(devolvido.elementoAtualId).toBe('planejar');
    expect(devolvido.valores.responsavelAuditoria).toBe('Ana Souza');

    // Antes da correção (sem a marca de herdado), a devolução apagava o valor:
    const semMarca = { ...naVerificacao, camposHerdados: undefined };
    const antes = executarAcao(definicaoFilho, semMarca, { acaoChave: 'devolver', comentario: '', valores: {}, ator }).instancia as IFluxoInstancia;
    expect(antes.valores.responsavelAuditoria).toBeUndefined();
  });

  it('somente leitura no filho: alteração é ignorada pelo motor', () => {
    const inicio = iniciarInstancia(definicaoFilho, {
      revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00A', ator, simulado: false,
      valoresIniciais: { responsavelAuditoria: 'Ana Souza' }, origemSubprocesso: origem, camposSomenteLeitura: ['responsavelAuditoria']
    }).instancia as IFluxoInstancia;
    const naVerificacao = executarAcao(definicaoFilho, inicio, { acaoChave: 'concluir', comentario: '', valores: {}, ator }).instancia as IFluxoInstancia;
    const final = executarAcao(definicaoFilho, naVerificacao, { acaoChave: 'concluir', comentario: '', valores: { responsavelAuditoria: 'Outro' }, ator }).instancia as IFluxoInstancia;
    expect(final.valores.responsavelAuditoria).toBe('Ana Souza');
  });

  it('criação do filho (FluxoService): adapta os valores e registra o que não foi aproveitado', async () => {
    let gravada: IFluxoInstancia | undefined;
    const repositorio: IFluxoRepositorio = { local: false, obter: async () => undefined, salvar: async i => { gravada = i; return []; }, remover: async () => undefined };
    const catalogo = { versaoPublicada: async () => definicaoFilho, obterVersao: async () => definicaoFilho } as unknown as ConstructorParameters<typeof FluxoService>[1];
    const metadados = { listar: async () => FILHO } as unknown as ConstructorParameters<typeof FluxoService>[2];
    const r = await new FluxoService(repositorio, catalogo, metadados).iniciar(
      { id: 'p-pda', codigo: 'PDA', nome: 'Plano de ação', ativo: true } as never,
      { revisaoId: 'r', documentoId: 'd', revisao: 'Rev.00A', ator, simulado: false, origemSubprocesso: origem,
        valoresIniciais: { responsavelAuditoria: USUARIO, gravidade: 'Moderada', areaAuditada: AREA } }
    );
    expect(r.erros).toEqual([]);
    const instancia = gravada as unknown as IFluxoInstancia;
    expect(instancia.valores).toEqual({ responsavelAuditoria: 'Ana Souza', areaAuditada: AREA });
    expect(instancia.historico[0].acaoRotulo).toBe('Valores do documento de origem não aproveitados');
    expect(instancia.historico[0].comentario).toMatch(/Gravidade/);
  });

  it('publicação no editor bloqueia par incompatível', () => {
    const pai: IFluxoDefinicao = {
      ...definicaoFilho, processoId: 'p-aud', metadados: PAI,
      elementos: [
        { id: 'inicio', tipo: 'inicio', nome: 'Início', responsaveis: [], acoes: [], campos: [], posicao: pos },
        etapa('registrar', 'Registrar', [{ chave: 'constatacoes', rotulo: 'Constatações', tipo: 'tabela', obrigatorio: false }]),
        { id: 'sub', tipo: 'subprocesso', nome: 'Abrir planos', responsaveis: [], acoes: [], campos: [], posicao: pos,
          subprocesso: config({ mapeamentos: [{ origem: 'coluna:descricao', destino: 'dono' }] }) },
        { id: 'fim', tipo: 'fim', nome: 'Fim', responsaveis: [], acoes: [], campos: [], posicao: pos }
      ],
      transicoes: [tr('t1', 'inicio', 'registrar'), tr('t2', 'registrar', 'sub'), tr('t3', 'sub', 'fim')]
    };
    expect(validarDefinicao(pai).join(' ')).not.toMatch(/Tipos diferentes/);
    expect(validarDefinicao(pai, { metadadosDoProcesso: id => (id === 'p-pda' ? FILHO : undefined) }).join(' ')).toMatch(/Descrição" → "Dono": Tipos diferentes/);
  });
});

// ---------- tela ----------

let raiz: HTMLDivElement;
beforeEach(() => { raiz = document.createElement('div'); document.body.appendChild(raiz); });
afterEach(() => { ReactDOM.unmountComponentAtNode(raiz); raiz.remove(); });

const renderizar = (elemento: React.ReactElement): void => {
  act(() => { ReactDOM.render(elemento, raiz); });
};

const Teste: React.FC<{ onCriar: (id: string, m: IFluxoMetadado[]) => Promise<string[]> }> = ({ onCriar }) => {
  const [cfg, setCfg] = React.useState<IConfigSubprocesso>(config());
  return (
    <PainelSubprocesso
      config={cfg}
      editavel={true}
      metadados={PAI}
      processos={[{ id: 'p-pda', codigo: 'PDA', nome: 'Plano de ação', publicado: true, metadados: FILHO }]}
      processoAtualId="p-aud"
      areas={[]}
      onAlterar={setCfg}
      onCriarMetadadosFilho={onCriar}
    />
  );
};

const botao = (texto: RegExp): HTMLButtonElement =>
  Array.prototype.slice.call(raiz.querySelectorAll('button')).find((b: HTMLButtonElement) => texto.test(b.textContent || '')) as HTMLButtonElement;

describe('Tela do subprocesso', () => {

  it('"Mapear automaticamente" cria os pares e mostra a compatibilidade', () => {
    renderizar(<Teste onCriar={async () => []} />);
    act(() => { botao(/^Mapear automaticamente$/).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(raiz.querySelectorAll('[data-mapeamento]')).toHaveLength(2);
    expect(Array.prototype.slice.call(raiz.querySelectorAll('[data-compatibilidade]')).map((e: HTMLElement) => e.getAttribute('data-compatibilidade'))).toEqual(['ok', 'ok']);
    expect(raiz.textContent).toMatch(/somente leitura no filho/);
  });

  it('"Criar no filho" chama o serviço com os campos marcados (mesma chave) e já mapeia', async () => {
    const chamadas: Array<{ id: string; chaves: string[] }> = [];
    renderizar(<Teste onCriar={async (id, m) => { chamadas.push({ id, chaves: m.map(x => x.chave) }); return []; }} />);
    const marcar = raiz.querySelector('input[aria-label="Criar Grau da não conformidade no filho"]') as HTMLInputElement;
    act(() => { marcar.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { botao(/^Criar no filho \(1\)$/).dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(chamadas).toEqual([{ id: 'p-pda', chaves: ['grau'] }]);
    expect(raiz.querySelectorAll('[data-mapeamento]')).toHaveLength(1);
    expect(raiz.textContent).toMatch(/1 campo\(s\) criado\(s\)/);
  });
});
