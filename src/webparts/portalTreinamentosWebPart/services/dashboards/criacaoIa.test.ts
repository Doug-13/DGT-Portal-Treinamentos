import { SemPainelPossivel, fontesPermitidas, gerarDashboard } from './criacaoIa';
import { CATALOGO_DASHBOARD } from './fontesDashboard';
import { EXEMPLOS_DASHBOARD } from './exemplosDashboard';
import { DataverseService } from '../DataverseService';
import { IDashboard, separarDashboards } from '../DashboardService';

// ============================================================
// CRIAÇÃO DE DASHBOARDS COM IA — permissões, correção e visibilidade
// A Custom API é simulada: cada chamada devolve a próxima resposta da
// fila e as entradas ficam registradas.
// ============================================================

const ids = (lista: Array<{ id: string }>): string[] => lista.map(item => item.id);

describe('Fontes que cada usuário pode usar na criação', () => {

  it('colaborador sem lista própria: só os módulos padrão (sem orçamento, licitações, fornecedores, projetos, IA)', () => {
    const fontes = ids(fontesPermitidas({ perfil: 'Colaborador', veTodasAsAreas: false }));
    expect(fontes.some(id => id.indexOf('treinamentos.') === 0)).toBe(true);
    expect(fontes.some(id => id.indexOf('orcamento.') === 0)).toBe(false);
    expect(fontes).not.toContain('fornecedores.documentos');
    expect(fontes).not.toContain('projetos.atividades');
    expect(fontes).not.toContain('ia.consumo');
  });

  it('com o módulo de orçamento liberado, as fontes de orçamento entram; licitações só com o módulo', () => {
    const comOrcamento = ids(fontesPermitidas({ perfil: 'Gestor', modulosPermitidos: ['treinamentos', 'orcamento'], veTodasAsAreas: false }));
    expect(comOrcamento).toContain('orcamento.dre');
    expect(comOrcamento).not.toContain('licitacoes.editais');
    expect(comOrcamento).not.toContain('documentos.documentos');
  });

  it('administrador usa todas as fontes do catálogo', () => {
    expect(ids(fontesPermitidas({ perfil: 'Administrador', veTodasAsAreas: true }))).toEqual(ids(CATALOGO_DASHBOARD));
  });
});

describe('Geração com validação e correção automática', () => {
  const catalogoGestor = fontesPermitidas({ perfil: 'Gestor', modulosPermitidos: ['treinamentos'], veTodasAsAreas: false });
  const valido = JSON.stringify(EXEMPLOS_DASHBOARD.treinamentos);
  // Usa orçamento, que este gestor NÃO pode usar.
  const foraDaPermissao = JSON.stringify({ ...EXEMPLOS_DASHBOARD.treinamentos, secoes: EXEMPLOS_DASHBOARD.controladoria.secoes });

  const simulado = (respostas: Array<Record<string, unknown>>): { dataverse: DataverseService; chamadas: Array<Record<string, unknown>> } => {
    const chamadas: Array<Record<string, unknown>> = [];
    const dataverse = {
      executarCustomApiJson: async (_nome: string, payload: Record<string, unknown>) => {
        chamadas.push(payload);
        return respostas.shift() || {};
      }
    } as unknown as DataverseService;
    return { dataverse, chamadas };
  };

  it('fonte fora da permissão é recusada e a IA recebe os erros para corrigir', async () => {
    const { dataverse, chamadas } = simulado([
      { resumo: 'v1', definicao: foraDaPermissao },
      { resumo: 'Painel de treinamentos.', semDados: ['Carga horária'], definicao: valido }
    ]);
    const resultado = await gerarDashboard(dataverse, { pedido: 'treinamentos do time', catalogo: catalogoGestor });
    expect(resultado.correcoes).toBe(1);
    expect(resultado.definicao.titulo).toBe(EXEMPLOS_DASHBOARD.treinamentos.titulo);
    expect(resultado.semDados).toEqual(['Carga horária']);
    expect(chamadas).toHaveLength(2);
    expect((chamadas[1].erros as string[]).join(' ')).toMatch(/orcamento\.dre.*não existe/);
    expect(chamadas[1].painelAtual).toBe(foraDaPermissao);
    // A IA só recebe o catálogo permitido (nunca dados).
    expect((chamadas[0].catalogo as Array<{ id: string }>).every(f => f.id.indexOf('treinamentos.') === 0)).toBe(true);
  });

  it('desiste depois de 2 correções sem sucesso', async () => {
    const { dataverse, chamadas } = simulado([{ definicao: '{}' }, { definicao: '{}' }, { definicao: '{}' }]);
    await expect(gerarDashboard(dataverse, { pedido: 'x', catalogo: catalogoGestor })).rejects.toThrow(/não conseguiu montar um painel válido/);
    expect(chamadas).toHaveLength(3);
  });

  it('pedido sem dados no portal: explicação da IA, sem erro e sem gastar correções', async () => {
    const { dataverse, chamadas } = simulado([
      { resumo: 'O Quadro de Metas e o plano de ações não existem no portal.', semDados: ['Quadro de Metas', 'Plano de ações'], definicao: '' }
    ]);
    let recebido: unknown;
    try {
      await gerarDashboard(dataverse, { pedido: 'Planejamento estratégico Visão 2029', catalogo: catalogoGestor });
    } catch (falha) {
      recebido = falha;
    }
    expect(recebido).toBeInstanceOf(SemPainelPossivel);
    expect((recebido as SemPainelPossivel).semDados).toEqual(['Quadro de Metas', 'Plano de ações']);
    expect(chamadas).toHaveLength(1);
  });

  it('resposta vazia = passo do plugin não registrado (mensagem clara)', async () => {
    const { dataverse } = simulado([{}]);
    await expect(gerarDashboard(dataverse, { pedido: 'x', catalogo: catalogoGestor })).rejects.toThrow(/GerarDashboardIaPlugin/);
  });
});

describe('Dashboards pessoais', () => {
  const base = { url: '', descricao: '', ordem: 0, altura: 760, publico: 'Todos' as const, ativo: true, tipo: 'Portal' as const, definicao: '', areas: [] };
  const lista: IDashboard[] = [
    { ...base, id: 'oficial', nome: 'Oficial' },
    { ...base, id: 'meu', nome: 'Meu', pessoal: true, donoId: 'aaa-111' },
    { ...base, id: 'outro', nome: 'Do colega', pessoal: true, donoId: 'bbb-222' }
  ];

  it('cada pessoa vê só os próprios pessoais; os de colegas nunca aparecem', () => {
    const minha = separarDashboards(lista, '{AAA-111}');
    expect(ids(minha.oficiais)).toEqual(['oficial']);
    expect(ids(minha.meus)).toEqual(['meu']);
    expect(ids(separarDashboards(lista, 'ccc-333').meus)).toEqual([]);
    // Sem saber quem é o usuário, nenhum pessoal aparece.
    expect(ids(separarDashboards(lista, '').meus)).toEqual([]);
  });
});
