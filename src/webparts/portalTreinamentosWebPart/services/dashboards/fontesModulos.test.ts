// Documentos simulados (antes dos imports, para o mock valer).
jest.mock('../DocumentoService', () => ({
  DocumentoService: class {
    public async getDocumentos(): Promise<unknown[]> {
      return [
        { id: 'doc-1', codigo: 'PRO-POP-001', titulo: 'Compras', area: 'PRO · PROCESSOS', areaId: 'area-pro', ativo: true },
        { id: 'doc-2', codigo: 'CTL-IT-002', titulo: 'Fechamento', area: 'CTL · CONTROLADORIA', areaId: 'area-ctl', ativo: true }
      ];
    }
  }
}));

import { CATALOGO_DASHBOARD, carregarFonte } from './fontesDashboard';
import { DataverseService } from '../DataverseService';

// ============================================================
// FONTES DOS MÓDULOS — regras de área, ano e campos calculados
// Dataverse simulado: cada tabela devolve registros fixos e as
// consultas feitas ficam registradas para conferência.
// ============================================================

const DIA = 86400000;
// Meio dia de margem: o portal arredonda frações de dia para baixo (diasAte).
const emDias = (dias: number): string => new Date(Date.now() + (dias + 0.5) * DIA).toISOString();
const fmt = (valor: string): string => valor;

const TABELAS: { [tabela: string]: Array<Record<string, unknown>> } = {
  dgt_area: [
    { dgt_areaid: 'AREA-PRO', dgt_name: 'PROCESSOS', dgt_sigla: 'PRO' },
    { dgt_areaid: 'area-ctl', dgt_name: 'CONTROLADORIA', dgt_sigla: 'CTL' },
    { dgt_areaid: 'area-lic', dgt_name: 'LICITAÇÕES', dgt_sigla: 'LIC' }
  ],
  dgt_usuarioarea: [
    // Ana está em duas áreas; Bruno só em Controladoria.
    { _dgt_usuario_value: 'u-ana', _dgt_area_value: '{area-pro}' },
    { _dgt_usuario_value: 'u-ana', _dgt_area_value: 'area-ctl' },
    { _dgt_usuario_value: 'u-bruno', _dgt_area_value: 'area-ctl' }
  ],
  dgt_usuariotreinamento: [
    {
      dgt_usuariotreinamentoid: 'ut-1', _dgt_usuario_value: 'u-ana', '_dgt_usuario_value@OData.Community.Display.V1.FormattedValue': fmt('Ana'),
      _dgt_treinamento_value: 't-1', '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue': fmt('NR-12'),
      dgt_dataatribuicao: '2027-02-10T12:00:00Z', dgt_datavalidade: emDias(-5), dgt_dataconclusao: '2027-02-20T12:00:00Z', dgt_nota: 90,
      dgt_status: 2, 'dgt_status@OData.Community.Display.V1.FormattedValue': 'Concluído'
    },
    {
      dgt_usuariotreinamentoid: 'ut-2', _dgt_usuario_value: 'u-bruno', '_dgt_usuario_value@OData.Community.Display.V1.FormattedValue': fmt('Bruno'),
      _dgt_treinamento_value: 't-2', '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue': fmt('Integração'),
      dgt_dataatribuicao: '2027-03-01T12:00:00Z', dgt_datalimite: emDias(-10), dgt_nota: 0
    },
    {
      // Carla: sem vínculo de área, sem data de atribuição (vale createdon) e "ativo" vazio.
      dgt_usuariotreinamentoid: 'ut-3', _dgt_usuario_value: 'u-carla', '_dgt_usuario_value@OData.Community.Display.V1.FormattedValue': fmt('Carla'),
      _dgt_treinamento_value: 't-1', '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue': fmt('NR-12'),
      createdon: '2027-07-15T12:00:00Z'
    }
  ],
  dgt_tentativa: [
    {
      _dgt_usuariotreinamento_value: 'ut-2', dgt_aprovado: false, dgt_nota: 50, dgt_acertos: 5, dgt_quantidadequestoes: 10,
      dgt_tempoutilizadoseg: 600, dgt_numerotentativa: 1, dgt_datainicio: '2027-03-05T12:00:00Z'
    }
  ],
  dgt_certificado: [{ _dgt_usuariotreinamento_value: 'ut-1', dgt_dataemissao: '2027-02-20T12:00:00Z', dgt_datavalidade: emDias(20) }],
  dgt_documentorevisao: [{ dgt_documentorevisaoid: 'rev-1', _dgt_documento_value: 'doc-1' }, { dgt_documentorevisaoid: 'rev-2', _dgt_documento_value: 'doc-2' }],
  dgt_tarefafluxo: [
    { _dgt_documentorevisao_value: 'rev-1', dgt_etapanome: 'Aprovação', dgt_prazo: emDias(-3), createdon: '2027-04-01T12:00:00Z' },
    { _dgt_documentorevisao_value: 'rev-2', dgt_etapanome: 'Revisão', createdon: '2027-04-01T12:00:00Z', dgt_concluidaem: '2027-04-04T12:00:00Z' }
  ],
  dgt_ambienteregistro: [
    { _dgt_area_value: 'area-pro', dgt_codigo: 'SOL-1', dgt_etapaatual: 'Análise', dgt_prazoetapa: emDias(10), createdon: '2027-05-01T12:00:00Z' },
    { dgt_codigo: 'SOL-2', dgt_etapaatual: 'Triagem', createdon: '2027-05-02T12:00:00Z' }
  ],
  dgt_licitacaoacompanhamento: [{ dgt_numeroedital: 'PE 10/2027', dgt_orgao: 'Prefeitura', dgt_valorestimado: 150000, createdon: '2027-06-01T12:00:00Z' }],
  dgt_fornecedordocumento: [{ dgt_datavencimento: emDias(-1), '_dgt_fornecedor_value@OData.Community.Display.V1.FormattedValue': 'Fornecedor X' }],
  dgt_projetoatividade: [{ dgt_name: 'Instalação', dgt_grupo: 2, dgt_fim: emDias(-4), dgt_percentualrealizado: 50, dgt_peso: 3 }],
  dgt_usuariotrilha: [
    { _dgt_usuario_value: 'u-bruno', _dgt_trilha_value: 'tr-1', '_dgt_trilha_value@OData.Community.Display.V1.FormattedValue': 'Formação', dgt_obrigatoria: true, dgt_datalimite: emDias(15), dgt_dataatribuicao: '2027-01-10T12:00:00Z' }
  ]
};

const consultas: string[] = [];

const dataverse = {
  listarRegistros: async (tabela: string, consulta: string) => {
    consultas.push(`${tabela}?${consulta}`);
    return (TABELAS[tabela] || []) as Array<Record<string, unknown>>;
  }
} as unknown as DataverseService;

const carregar = (id: string, areaIds?: string[]): ReturnType<typeof carregarFonte> =>
  carregarFonte(id, { dataverse, ano: 2027, areaIds });

beforeEach(() => { consultas.length = 0; });

describe('Fontes dos módulos da plataforma', () => {

  it('treinamentos.atribuicoes: uma linha por área do usuário; gestor vê só a sua; filtro de ano na consulta', async () => {
    const admin = await carregar('treinamentos.atribuicoes');
    expect(admin.map(l => `${l.usuario}@${l.area}`).sort())
      .toEqual(['Ana@CTL · CONTROLADORIA', 'Ana@PRO · PROCESSOS', 'Bruno@CTL · CONTROLADORIA', 'Carla@Sem área']);
    const consulta = consultas.filter(c => c.indexOf('dgt_usuariotreinamento?') === 0 && c.indexOf('dgt_dataatribuicao') > 0)[0];
    // Ano pela data da atribuição; sem ela, pela criação. Ativo vazio conta como ativo.
    expect(consulta).toContain('dgt_dataatribuicao ge 2027-01-01');
    expect(consulta).toContain('dgt_dataatribuicao eq null and createdon ge 2027-01-01');
    expect(consulta).toContain('dgt_ativo ne false');
    expect(admin.filter(l => l.usuario === 'Carla')[0]).toMatchObject({ mes: 7, concluido: 'Não' });

    // Gestor: só o próprio time; usuário sem área não aparece.
    const gestorPro = await carregar('treinamentos.atribuicoes', ['area-pro']);
    expect(gestorPro.map(l => l.usuario)).toEqual(['Ana']);

    const ana = admin.filter(l => l.usuario === 'Ana')[0];
    expect(ana).toMatchObject({ concluido: 'Sim', situacaoValidade: 'Vencido', nota: 90, diasAtraso: 0, mes: 2 });
    const bruno = admin.filter(l => l.usuario === 'Bruno')[0];
    expect(bruno).toMatchObject({ concluido: 'Não', situacaoPrazo: 'Vencido', diasAtraso: 10, nota: undefined, trilha: 'Sem trilha' });
  });

  it('treinamentos.avaliacoes e .certificados chegam ao usuário pela atribuição', async () => {
    const avaliacoes = await carregar('treinamentos.avaliacoes', ['area-ctl']);
    expect(avaliacoes).toEqual([expect.objectContaining({ usuario: 'Bruno', treinamento: 'Integração', aprovado: 'Não', aprovacoes: 0, minutos: 10, nota: 50 })]);
    const certificados = await carregar('treinamentos.certificados');
    expect(certificados.map(l => l.area).sort()).toEqual(['CTL · CONTROLADORIA', 'PRO · PROCESSOS']);
    expect(certificados[0]).toMatchObject({ treinamento: 'NR-12', situacaoValidade: 'Vence em 30 dias' });
  });

  it('treinamentos.trilhas: obrigatoriedade e prazo', async () => {
    const trilhas = await carregar('treinamentos.trilhas');
    expect(trilhas).toEqual([expect.objectContaining({ area: 'CTL · CONTROLADORIA', trilha: 'Formação', obrigatoria: 'Sim', concluida: 'Não', situacaoPrazo: 'Vence em 30 dias' })]);
  });

  it('documentos.tarefas: área do documento; pendente atrasada e concluída com duração', async () => {
    const todas = await carregar('documentos.tarefas');
    expect(todas.filter(l => l.pendente === 'Sim')[0]).toMatchObject({ area: 'PRO · PROCESSOS', etapa: 'Aprovação', situacaoPrazo: 'Vencido', diasAtraso: 3 });
    expect(todas.filter(l => l.pendente === 'Não')[0]).toMatchObject({ area: 'CTL · CONTROLADORIA', diasParaConcluir: 3 });
    expect((await carregar('documentos.tarefas', ['area-ctl'])).map(l => l.etapa)).toEqual(['Revisão']);
  });

  it('ambientes.registros: registro sem área só aparece para quem vê todas as áreas', async () => {
    expect((await carregar('ambientes.registros')).map(l => l.codigo)).toEqual(['SOL-1', 'SOL-2']);
    expect((await carregar('ambientes.registros', ['area-pro'])).map(l => l.codigo)).toEqual(['SOL-1']);
    expect((await carregar('ambientes.registros', ['area-ctl'])).map(l => l.codigo)).toEqual([]);
  });

  it('licitacoes.editais: área LIC; gestor de outra área não vê', async () => {
    expect(await carregar('licitacoes.editais', ['area-lic'])).toEqual([expect.objectContaining({ area: 'LIC · LICITAÇÕES', edital: 'PE 10/2027', valorEstimado: 150000 })]);
    expect(await carregar('licitacoes.editais', ['area-ctl'])).toEqual([]);
  });

  it('fornecedores e projetos (sem área): só para quem vê todas as áreas', async () => {
    expect(await carregar('fornecedores.documentos', ['area-ctl'])).toEqual([]);
    expect(await carregar('projetos.atividades', ['area-ctl'])).toEqual([]);
    expect(await carregar('fornecedores.documentos')).toEqual([expect.objectContaining({ fornecedor: 'Fornecedor X', situacaoValidade: 'Vencido' })]);
    expect(await carregar('projetos.atividades')).toEqual([expect.objectContaining({ grupo: 'G2', situacaoPrazo: 'Vencido', diasAtraso: 4, percentualRealizado: 50 })]);
  });

  it('áreas e vínculos são carregados uma vez por painel, mesmo com várias fontes', async () => {
    const contexto = { dataverse, ano: 2027 };
    await Promise.all(['treinamentos.atribuicoes', 'treinamentos.trilhas', 'treinamentos.certificados'].map(id => carregarFonte(id, contexto)));
    expect(consultas.filter(c => c.indexOf('dgt_area?') === 0)).toHaveLength(1);
    expect(consultas.filter(c => c.indexOf('dgt_usuarioarea?') === 0)).toHaveLength(1);
  });

  it('todas as fontes novas: cada linha só usa campos declarados e valores da lista fechada', async () => {
    const novas = CATALOGO_DASHBOARD.filter(f => /^(treinamentos|documentos\.tarefas|ambientes|licitacoes|fornecedores|projetos)/.test(f.id));
    expect(novas.map(f => f.id)).toHaveLength(9);
    for (const fonte of novas) {
      const linhas = await carregar(fonte.id);
      expect(linhas.length).toBeGreaterThan(0);
      linhas.forEach(linha => Object.keys(linha).forEach(chave => {
        const campo = fonte.campos.filter(c => c.chave === chave)[0];
        expect(`${fonte.id}.${chave}:${campo ? 'ok' : 'não declarado'}`).toBe(`${fonte.id}.${chave}:ok`);
        if (campo && campo.valores && linha[chave] !== undefined) {
          expect(campo.valores).toContain(linha[chave]);
        }
      }));
    }
  });
});
