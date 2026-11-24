// Motor, catálogo, notificações e áreas simulados (antes dos imports).
interface IMotorSimulado { comNotificacoes: boolean; iniciou: number }
const mockMotores: IMotorSimulado[] = [];

jest.mock('../fluxo/FluxoService', () => ({
  FluxoService: class {
    private readonly registro: IMotorSimulado;
    public constructor(_repo: unknown, _catalogo: unknown, _metadados: unknown, notificacoes?: unknown) {
      this.registro = { comNotificacoes: !!notificacoes, iniciou: 0 };
      mockMotores.push(this.registro);
    }
    public iniciar(): Promise<unknown> {
      this.registro.iniciou++;
      return Promise.resolve({ ok: true, erros: [], instancia: {}, acoesSistema: [] });
    }
    public definicaoDaInstancia(): Promise<unknown> {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return Promise.resolve(mockDefinicao);
    }
  }
}));

jest.mock('../notificacoes/NotificacaoFluxoService', () => ({
  NotificacaoFluxoService: class { }
}));

jest.mock('../AreaAdminService', () => ({
  AreaAdminService: class {
    public listarUsuariosArea(): Promise<unknown[]> { return Promise.resolve([]); }
    public listarUsuarios(): Promise<unknown[]> { return Promise.resolve([]); }
  }
}));

jest.mock('../fluxo/persistenciaFluxo', () => ({
  obterPersistenciaFluxo: () => ({
    catalogo: {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      versaoPublicada: () => Promise.resolve(mockDefinicao)
    },
    metadados: {},
    processos: {
      carregar: () => Promise.resolve({ processos: [{ id: 'p1', codigo: 'SUP-HOM', nome: 'Homologação de fornecedor', ativo: true }] })
    }
  })
}));

import {
  HomologacaoFluxoService,
  rotuloDoCiclo
} from './HomologacaoFluxoService';

import {
  FornecedoresService
} from './FornecedoresService';

import {
  DataverseService
} from '../DataverseService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  ICicloHomologacao,
  IFornecedor
} from './modeloFornecedores';

// ============================================================
// FORNECEDORES — notificações nativas do motor na homologação
//   • o motor da homologação é criado COM o despachante de notificações;
//   • "Abrir ciclo" pelo botão (notificar) usa esse motor;
//   • criação tardia da instância e migração de ciclo antigo NÃO
//     notificam (motor sem despachante);
//   • {registro} = razão social (protocolo), nunca o CNPJ.
// ============================================================

const etapa = (id: string, nome: string): IFluxoDefinicao['elementos'][0] => ({
  id, nome, tipo: 'tarefaHumana', responsaveis: [], acoes: [], campos: [],
  posicao: { x: 0, y: 0, largura: 0, altura: 0 }
});

const mockDefinicao: IFluxoDefinicao = {
  id: 'f1', nome: 'SUP-HOM', versao: 1, status: 'publicado', tiposDocumento: [], larguraDiagrama: 0, alturaDiagrama: 0,
  elementos: [
    { id: 'inicio', nome: 'Início', tipo: 'inicio', responsaveis: [], acoes: [], campos: [], posicao: { x: 0, y: 0, largura: 0, altura: 0 } },
    etapa('ficha-recebida', 'Ficha recebida'),
    etapa('analise-juridico', 'Análise Jurídico')
  ],
  transicoes: []
};

const INSTANCIA: IFluxoInstancia = {
  revisaoId: 'c1', documentoId: 'f1', revisao: 'Ciclo 1', fluxoId: 'f1', fluxoVersao: 1,
  elementoAtualId: 'ficha-recebida', status: 'emAndamento', valores: {}, percorridos: ['inicio', 'ficha-recebida'],
  transicoesPercorridas: [], tarefas: [{ id: 't1', elementoId: 'ficha-recebida', elementoNome: 'Ficha recebida', responsaveis: [], status: 'pendente', criadaEm: '' }],
  historico: [], iniciadoEm: '', simulado: false
};

const montar = (): { servico: HomologacaoFluxoService; gravados: Array<Record<string, unknown>> } => {
  const gravados: Array<Record<string, unknown>> = [];
  const dataverse = {
    obterRegistro: () => Promise.resolve({ etag: 'e1', registro: { dgt_fluxoestado: JSON.stringify(INSTANCIA) } }),
    atualizarRegistro: (_t: string, _id: string, dados: Record<string, unknown>) => {
      gravados.push(dados);
      return Promise.resolve('e2');
    }
  } as unknown as DataverseService;
  const fornecedores = {
    temColunasFluxoCiclo: () => Promise.resolve(true),
    registrarHistoricoFluxo: () => Promise.resolve()
  } as unknown as FornecedoresService;
  mockMotores.length = 0;
  return { servico: new HomologacaoFluxoService(dataverse, fornecedores), gravados };
};

const fornecedor = { id: 'f1', razaoSocial: 'Empresa Exemplo', protocolo: 'FORN-2026-0001', cnpj: '11222333000181' } as unknown as IFornecedor;
const contexto = { usuarioId: 'u1', nome: 'Analista' } as unknown as IContextoAcesso;
const ciclo = (extra: Partial<ICicloHomologacao> = {}): ICicloHomologacao =>
  ({ id: 'c1', numero: 1, etapa: 'Ficha recebida', concluidoEm: '', protocolo: 'FORN-2026-0001', etapaAtual: '', ...extra }) as unknown as ICicloHomologacao;

describe('Homologação × notificações do motor', () => {

  it('cria o motor da homologação com o despachante de notificações (e um sem, para o início tardio)', () => {
    montar();
    expect(mockMotores.map(m => m.comNotificacoes)).toEqual([true, false]);
  });

  it('"Abrir ciclo" pelo botão notifica a 1ª etapa', async () => {
    const { servico } = montar();
    const r = await servico.iniciar(fornecedor, ciclo(), contexto, [], { notificar: true });
    expect(r.ok).toBe(true);
    expect(mockMotores.filter(m => m.comNotificacoes)[0].iniciou).toBe(1);
    expect(mockMotores.filter(m => !m.comNotificacoes)[0].iniciou).toBe(0);
  });

  it('criação tardia da instância (ciclo aberto pela ficha) não notifica', async () => {
    const { servico } = montar();
    await servico.iniciar(fornecedor, ciclo({ etapaAtual: 'ficha-recebida' }), contexto, []);
    expect(mockMotores.filter(m => m.comNotificacoes)[0].iniciou).toBe(0);
    expect(mockMotores.filter(m => !m.comNotificacoes)[0].iniciou).toBe(1);
  });

  it('migração de ciclo antigo para a etapa equivalente não notifica, mesmo pedindo', async () => {
    const { servico, gravados } = montar();
    await servico.iniciar(fornecedor, ciclo({ etapa: 'Aguardando Jurídico' }), contexto, [], { notificar: true });
    expect(mockMotores.filter(m => m.comNotificacoes)[0].iniciou).toBe(0);
    // O estado migrado foi gravado direto (sem o despachante), na etapa do Jurídico.
    const estado = gravados.map(g => g.dgt_fluxoestado).filter(Boolean)[0] as string;
    expect(JSON.parse(estado).elementoAtualId).toBe('analise-juridico');
  });

  it('{registro} = razão social (protocolo) — ciclo N, sem CNPJ', () => {
    const rotulo = rotuloDoCiclo(fornecedor, ciclo());
    expect(rotulo).toBe('Empresa Exemplo (FORN-2026-0001) — ciclo 1');
    expect(rotulo).not.toMatch(/11222333/);
  });
});
