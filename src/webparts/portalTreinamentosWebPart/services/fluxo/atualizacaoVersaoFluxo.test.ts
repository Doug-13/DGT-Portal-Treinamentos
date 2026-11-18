import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  FLUXO_POP_PROCEDIMENTO_V2
} from './definicoes/fluxoPopProcedimento';

import {
  adicionarDiasUteis,
  iniciarInstancia,
  transferirInstancia
} from './FluxoEngine';

// ============================================================
// ATUALIZAÇÃO DOS REGISTROS EM ANDAMENTO PARA A VERSÃO PUBLICADA
// (edição direta do fluxo em ambientes): mesma etapa, prazo contado
// da data em que a etapa começou.
// ============================================================

const ator: IFluxoAtor = { id: 'admin', nome: 'Admin', papeisTeste: ['autor'] };

const copiar = (definicao: IFluxoDefinicao): IFluxoDefinicao =>
  JSON.parse(JSON.stringify(definicao)) as IFluxoDefinicao;

const v1 = (): IFluxoDefinicao => ({ ...copiar(FLUXO_POP_PROCEDIMENTO_V2), versao: 1, status: 'publicado' });

const iniciar = (definicao: IFluxoDefinicao): IFluxoInstancia => {
  const resultado = iniciarInstancia(definicao, {
    revisaoId: 'reg-1', documentoId: 'reg-1', revisao: 'AUD-2026-0001', ator, simulado: true
  });
  expect(resultado.ok).toBe(true);
  return resultado.instancia as IFluxoInstancia;
};

const dados = (manterPrazoEtapa: boolean): Parameters<typeof transferirInstancia>[3] => ({
  tipo: 'versao', processoId: 'p1', processoNome: 'Auditoria', ator, justificativa: 'teste', manterPrazoEtapa
});

describe('atualização de versão do fluxo', () => {

  it('mantém a etapa e o início da pendência, recalculando o prazo com a nova versão', () => {
    const origem = v1();
    const instancia = iniciar(origem);
    const pendente = instancia.tarefas.filter(item => item.status === 'pendente')[0];
    expect(pendente).toBeDefined();
    pendente.criadaEm = '2026-11-02T12:00:00.000Z';

    const destino = { ...copiar(origem), versao: 2 };
    const etapa = destino.elementos.filter(item => item.id === instancia.elementoAtualId)[0];
    etapa.prazoDiasUteis = 3;

    const resultado = transferirInstancia(origem, destino, instancia, dados(true));

    expect(resultado.erros).toEqual([]);
    const nova = (resultado.instancia as IFluxoInstancia);
    expect(nova.fluxoVersao).toBe(2);
    expect(nova.elementoAtualId).toBe(instancia.elementoAtualId);
    const novaPendente = nova.tarefas.filter(item => item.status === 'pendente');
    expect(novaPendente.length).toBe(1);
    expect(novaPendente[0].criadaEm).toBe('2026-11-02T12:00:00.000Z');
    expect(novaPendente[0].prazo).toBe(adicionarDiasUteis('2026-11-02T12:00:00.000Z', 3));
  });

  it('sem a opção, a pendência recomeça (comportamento da transferência de documentos)', () => {
    const origem = v1();
    const instancia = iniciar(origem);
    instancia.tarefas.filter(item => item.status === 'pendente')[0].criadaEm = '2026-11-02T12:00:00.000Z';

    const resultado = transferirInstancia(origem, { ...copiar(origem), versao: 2 }, instancia, dados(false));

    expect(resultado.ok).toBe(true);
    const novaPendente = (resultado.instancia as IFluxoInstancia).tarefas.filter(item => item.status === 'pendente')[0];
    expect(novaPendente.criadaEm).not.toBe('2026-11-02T12:00:00.000Z');
  });

  it('não atualiza quando a etapa atual foi removida do desenho', () => {
    const origem = v1();
    const instancia = iniciar(origem);
    const destino = { ...copiar(origem), versao: 2 };
    const atual = destino.elementos.filter(item => item.id === instancia.elementoAtualId)[0];
    destino.elementos = destino.elementos.filter(item => item.id !== atual.id);
    destino.transicoes = destino.transicoes.filter(item => item.origemId !== atual.id && item.destinoId !== atual.id);

    const resultado = transferirInstancia(origem, destino, instancia, dados(true));

    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join(' ')).toContain('não existe no fluxo de destino');
  });
});
