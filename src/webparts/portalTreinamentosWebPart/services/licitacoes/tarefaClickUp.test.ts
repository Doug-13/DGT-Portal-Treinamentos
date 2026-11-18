import { AcompanhamentoLicitacaoService, IAcompanhamento } from './AcompanhamentoLicitacaoService';
import { DataverseService } from '../DataverseService';
import { ILicitacaoResultado } from '../../models/Licitacao';

// ============================================================
// TAREFA NO CLICKUP — o que o portal envia ao plugin
// As datas (prazos, Data Pregão, acionamento) são do plugin: o portal
// manda o texto do PNCP e nunca um vencimento.
// (Regras de cálculo: server/DGT.Treinamentos.Plugins.Tests.)
// ============================================================

const montar = (): { servico: AcompanhamentoLicitacaoService; chamadas: Array<{ api: string; dados: Record<string, unknown> }> } => {
  const chamadas: Array<{ api: string; dados: Record<string, unknown> }> = [];
  const dataverse = {
    chamarCustomApiJson: (api: string, dados: Record<string, unknown>) => {
      chamadas.push({ api, dados });
      return Promise.resolve({ id: 't1', url: 'https://app.clickup.com/t/t1', existente: false, camposPreenchidos: 3, camposComErro: [] });
    }
  } as unknown as DataverseService;
  return { servico: new AcompanhamentoLicitacaoService(dataverse), chamadas };
};

const edital = (encerramento?: string): ILicitacaoResultado => ({
  chave: 'chave-1',
  score: 80,
  motivos: [],
  numero: '10/2026',
  orgao: 'Prefeitura Exemplo',
  local: 'Cidade Exemplo/RS',
  modalidade: 'Pregão Eletrônico',
  objeto: 'Serviços de exemplo',
  abertura: '2026-12-01T08:00:00',
  encerramento,
  url: '',
  dados: { fontesOrcamentarias: [] }
} as unknown as ILicitacaoResultado);

const acompanhamento = { chaveEdital: 'chave-1', pastaUrl: '', situacao: '' } as unknown as IAcompanhamento;

const temChave = (obj: unknown, chave: string): boolean => JSON.stringify(obj).indexOf(`"${chave}"`) >= 0;

describe('Tarefa do ClickUp — payload do portal', () => {

  it('nenhuma chamada (criação ou "Atualizar campos") contém vencimento ou prazos calculados', async () => {
    const { servico, chamadas } = montar();
    await servico.criarTarefaClickUp(edital('2026-12-18T09:00:00'), acompanhamento, { justificativa: 'ok', responsavel: 'Equipe' });
    await servico.criarTarefaClickUp(edital('2026-12-18T09:00:00'), acompanhamento, { justificativa: 'ok', responsavel: 'Equipe' }, true);
    expect(chamadas).toHaveLength(2);
    chamadas.forEach(c => {
      expect(c.api).toBe('dgt_CriarTarefaClickUp');
      ['dataLimite', 'due_date', 'due_date_time', 'dataPregao', 'prazoAnaliseInicial', 'prazoImpugnacao', 'acionamento']
        .forEach(chave => expect(temChave(c.dados, chave)).toBe(false));
      // Texto do PNCP sem conversão (o plugin interpreta em Brasília).
      expect(c.dados.encerramentoPncp).toBe('2026-12-18T09:00:00');
      expect(c.dados.aberturaPncp).toBe('2026-12-01T08:00:00');
    });
    expect(chamadas[1].dados.atualizarCampos).toBe(true);
  });

  it('Urgente muda só a prioridade', async () => {
    const { servico, chamadas } = montar();
    await servico.criarTarefaClickUp(edital('2026-12-18T09:00:00'), acompanhamento, { justificativa: 'ok', responsavel: 'Equipe' });
    await servico.criarTarefaClickUp(edital('2026-12-18T09:00:00'), acompanhamento, { justificativa: 'ok', responsavel: 'Equipe', urgente: true });
    const [normal, urgente] = chamadas.map(c => c.dados);
    expect(urgente.prioridade).toBe(1);
    expect(urgente.urgente).toBe(true);
    expect(urgente.encerramentoPncp).toBe(normal.encerramentoPncp);
    expect(urgente.campos).toEqual(normal.campos);
  });

  it('edital sem encerramento: cria a tarefa normalmente, sem datas (o plugin põe a etiqueta sem-data-pregao)', async () => {
    const { servico, chamadas } = montar();
    const r = await servico.criarTarefaClickUp(edital(undefined), acompanhamento, { justificativa: 'ok', responsavel: 'Equipe' });
    expect(r.id).toBe('t1');
    expect(chamadas[0].dados.encerramentoPncp).toBeNull();
    expect(temChave(chamadas[0].dados, 'dataLimite')).toBe(false);
  });
});
