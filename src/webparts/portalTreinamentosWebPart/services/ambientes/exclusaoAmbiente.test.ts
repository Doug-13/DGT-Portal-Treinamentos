import {
  AmbienteService
} from './AmbienteService';

import {
  ExclusaoFluxoService
} from '../processos/ExclusaoFluxoService';

import {
  DataverseService
} from '../DataverseService';

import {
  IAmbiente
} from '../../models/Ambiente';

// ============================================================
// TESTES — exclusão de ambiente (e do fluxo dele) com Dataverse falso
// ============================================================

type Tabelas = Record<string, Array<Record<string, unknown>>>;

const dataverseFalso = (tabelas: Tabelas): { dv: DataverseService; excluidos: string[] } => {
  const excluidos: string[] = [];
  const dv = {
    listarRegistros: async (tabela: string, consulta: string) => {
      const linhas = tabelas[tabela] || [];
      // Filtros usados: "_dgt_processo_value eq X" / "_dgt_ambiente_value eq X" / "_dgt_fluxo_value eq X"
      const filtro = /_(dgt_\w+)_value eq ([\w-]+)/.exec(consulta);
      return filtro ? linhas.filter(linha => String(linha[`_${filtro[1]}_value`]) === filtro[2]) : linhas;
    },
    excluirRegistro: async (tabela: string, id: string) => { excluidos.push(`${tabela}:${id}`); },
    atualizarRegistro: async () => '',
    limparLookup: async () => undefined
  } as unknown as DataverseService;
  return { dv, excluidos };
};

const ambiente = (parcial: Partial<IAmbiente>): IAmbiente => ({
  id: 'amb1', chave: 'compras', nome: 'Compras', descricao: '', subtitulo: '', icone: 'package', ordem: 10, ativo: true,
  liberadoParaTodos: false, perfisPadrao: [], processoId: 'proc1', processoNome: 'COM-SOL', prefixoCodigo: 'COM',
  rotuloRegistro: 'Solicitação', layoutJson: '', ...parcial
});

const base = (): Tabelas => ({
  dgt_ambienteregistro: [
    { dgt_ambienteregistroid: 'r1', _dgt_ambiente_value: 'amb1', dgt_situacao: 'emAndamento' },
    { dgt_ambienteregistroid: 'r2', _dgt_ambiente_value: 'amb1', dgt_situacao: 'concluido' }
  ],
  dgt_ambiente: [{ dgt_ambienteid: 'amb1', dgt_name: 'Compras', _dgt_processo_value: 'proc1' }],
  dgt_fluxo: [{ dgt_fluxoid: 'v1', _dgt_processo_value: 'proc1' }],
  dgt_processometadado: [{ dgt_processometadadoid: 'm1', _dgt_processo_value: 'proc1' }]
});

describe('Exclusão de ambiente', () => {

  it('analisa registros e se o fluxo pode ir junto', async () => {
    const { dv } = dataverseFalso(base());
    const analise = await new AmbienteService(dv).analisarExclusao(ambiente({}), [ambiente({})]);
    expect(analise.registros.total).toBe(2);
    expect(analise.registros.emAndamento).toBe(1);
    expect(analise.podeExcluirFluxo).toBe(true);
  });

  it('exclui na ordem: registros → ambiente → fluxo (versões, campos, processo)', async () => {
    const tabelas = base();
    const { dv, excluidos } = dataverseFalso(tabelas);
    // Depois de apagar o ambiente, a análise do fluxo não o vê mais.
    const original = dv.excluirRegistro;
    (dv as unknown as { excluirRegistro: (t: string, id: string) => Promise<void> }).excluirRegistro = async (t: string, id: string) => {
      if (t === 'dgt_ambiente') { tabelas.dgt_ambiente = []; }
      await original(t, id);
    };
    const avisos = await new AmbienteService(dv).excluir(ambiente({}), [ambiente({})], true);
    expect(avisos).toEqual([]);
    expect(excluidos.slice(0, 3)).toEqual(['dgt_ambienteregistro:r1', 'dgt_ambienteregistro:r2', 'dgt_ambiente:amb1']);
    expect(excluidos).toContain('dgt_fluxo:v1');
    expect(excluidos).toContain('dgt_processometadado:m1');
    expect(excluidos[excluidos.length - 1]).toBe('dgt_processo:proc1');
  });

  it('mantém o fluxo se outro ambiente o usa', async () => {
    const { dv, excluidos } = dataverseFalso(base());
    const outro = ambiente({ id: 'amb2', chave: 'compras2', nome: 'Compras 2' });
    const avisos = await new AmbienteService(dv).excluir(ambiente({}), [ambiente({}), outro], true);
    expect(avisos.join(' ')).toMatch(/também é usado por Compras 2/);
    expect(excluidos.some(item => item.indexOf('dgt_processo:') === 0)).toBe(false);
  });

  it('remover o processo/fluxo é bloqueado enquanto um ambiente o usa', async () => {
    const { dv } = dataverseFalso(base());
    const analise = await new ExclusaoFluxoService(dv).analisar('proc1');
    expect(analise.acao).toBe('ambientes');
    expect(analise.ambientes.map(item => item.nome)).toEqual(['Compras']);
    await expect(new ExclusaoFluxoService(dv).excluir('proc1')).rejects.toThrow(/usado pelo\(s\) ambiente\(s\) Compras/);
  });
});
