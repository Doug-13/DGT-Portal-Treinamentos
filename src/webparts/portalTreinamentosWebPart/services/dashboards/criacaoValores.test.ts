// Fontes simuladas (antes dos imports, para o mock valer).
const consultas: Array<{ fonte: string; ano: number; areaIds?: string[] }> = [];
jest.mock('./fontesDashboard', () => {
  const real = jest.requireActual('./fontesDashboard');
  return {
    ...real,
    carregarFonte: async (fonte: string, contexto: { ano: number; areaIds?: string[] }) => {
      consultas.push({ fonte, ano: contexto.ano, areaIds: contexto.areaIds });
      if (fonte !== 'orcamento.linhas') {
        return [];
      }
      return [
        { area: 'CPU', grupo: 'RECEITA BRUTA', codigo: '3.1.1.02.01.001', conta: 'RECEITA DE LOCAÇÃO', mes: 1, orcado: 8930679.79 },
        { area: 'CPU', grupo: 'RECEITA BRUTA', codigo: '3.1.1.01.01.001', conta: 'RECEITA DE SERVIÇOS', mes: 1, orcado: 100 }
      ];
    }
  };
});

import { gerarDashboard, incluirValoresExistentes } from './criacaoIa';
import { CATALOGO_DASHBOARD } from './fontesDashboard';
import { validarDashboard } from './dashboardModelo';
import { DataverseService } from '../DataverseService';

// ============================================================
// CRIAÇÃO COM IA — valores existentes (contas, subcontas…)
// Caso: "dash de RECEITA DE LOCAÇÃO" (conta 3.1.1.02.01.001).
// ============================================================

const orcamento = CATALOGO_DASHBOARD.filter(f => f.id === 'orcamento.linhas');

const painel = (conta: string): string => JSON.stringify({
  formato: 'dgt-portal/dashboard@1',
  titulo: 'Receita de locação',
  secoes: [{ titulo: 'Meta', itens: [{ tipo: 'cartao', titulo: 'Meta', fonte: 'orcamento.linhas', medida: 'orcado', agregacao: 'soma', filtro: { conta } }] }]
});

beforeEach(() => { consultas.length = 0; });

describe('Valores existentes na criação com IA', () => {

  it('a IA recebe os nomes das contas (sem números), com as áreas do usuário', async () => {
    const catalogo = await incluirValoresExistentes({} as DataverseService, orcamento, { ano: 2026, areasPermitidas: ['ctl'], modulosAdministrados: ['orcamento'] });
    const campo = (chave: string): string[] | undefined => catalogo[0].campos.filter(c => c.chave === chave)[0].valoresExistentes;
    expect(campo('conta')).toEqual(['RECEITA DE LOCAÇÃO', 'RECEITA DE SERVIÇOS']);
    expect(campo('codigo')).toContain('3.1.1.02.01.001');
    expect(campo('grupo')).toEqual(['RECEITA BRUTA']);
    // Só campos de referência: nada de valores numéricos.
    expect(JSON.stringify(catalogo)).not.toMatch(/8930679/);
    // Ano atual e o seguinte; administradora do orçamento vê todas as áreas.
    expect(consultas.map(c => c.ano)).toEqual([2026, 2027]);
    expect(consultas.every(c => c.areaIds === undefined)).toBe(true);
  });

  it('nome escrito diferente é recusado com sugestão do texto exato', async () => {
    const catalogo = await incluirValoresExistentes({} as DataverseService, orcamento, { ano: 2026 });
    const erros = validarDashboard(painel('Receita de Locacao'), catalogo).erros.join(' ');
    expect(erros).toMatch(/não existe em "conta"/);
    expect(erros).toMatch(/parecidos: RECEITA DE LOCAÇÃO/);
    expect(validarDashboard(painel('RECEITA DE LOCAÇÃO'), catalogo).erros).toEqual([]);
    // Fora da criação (sem valoresExistentes), o filtro livre continua aceito.
    expect(validarDashboard(painel('Qualquer conta'), CATALOGO_DASHBOARD).erros).toEqual([]);
  });

  it('a correção automática leva ao nome exato da subconta', async () => {
    const catalogo = await incluirValoresExistentes({} as DataverseService, orcamento, { ano: 2026 });
    const chamadas: Array<Record<string, unknown>> = [];
    const respostas = [{ definicao: painel('Receita de Locacao') }, { definicao: painel('RECEITA DE LOCAÇÃO') }];
    const dataverse = {
      executarCustomApiJson: async (_api: string, payload: Record<string, unknown>) => { chamadas.push(payload); return respostas.shift() || {}; }
    } as unknown as DataverseService;
    const resultado = await gerarDashboard(dataverse, { pedido: 'dash de RECEITA DE LOCAÇÃO', catalogo });
    expect(resultado.correcoes).toBe(1);
    expect(resultado.texto).toMatch(/RECEITA DE LOCAÇÃO/);
    expect(JSON.stringify(chamadas[0].catalogo)).toMatch(/RECEITA DE LOCAÇÃO/);
  });
});
