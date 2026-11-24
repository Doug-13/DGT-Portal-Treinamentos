// SharePoint simulado (antes dos imports): a biblioteca do SharePoint
// só carrega no navegador.
jest.mock('../sharepoint/SharePointDocumentoService', () => ({
  SharePointDocumentoService: class {
    public enviarArquivoEmPasta(_pastas: string[], nome: string): Promise<unknown> {
      return Promise.resolve({ arquivoUrl: `https://exemplo.sharepoint.com/Homologacao/${nome}`, nomeArquivo: nome });
    }
  }
}));

import {
  faseDoCiclo,
  montarConteudoRelatorio,
  nomeArquivoRelatorio,
  semCpf
} from './relatorioHomologacao';

import {
  FornecedoresService
} from './FornecedoresService';

import {
  DataverseService
} from '../DataverseService';

import {
  calcularSituacao
} from './situacaoDocumental';

import {
  ICicloHomologacao,
  IFornecedor,
  ITipoDocumentoFornecedor
} from './modeloFornecedores';

import {
  SPHttpClient
} from '@microsoft/sp-http';

// ============================================================
// FORNECEDORES — relatório de homologação (PDF) e isolamento dos
// tipos de documento de colaborador. Dados fictícios.
// ============================================================

const CPF_FICTICIO = '123.456.789-09';

const fornecedor = (extra: Partial<IFornecedor> = {}): IFornecedor => ({
  id: 'f1', razaoSocial: 'Empresa Exemplo', nomeFantasia: 'Exemplo', cnpj: '', categoria: 'Serviço', protocolo: 'FORN-2026-0001',
  questionario: {}, dadosBancarios: { banco: '001', agencia: '0001', conta: '99999-9', cnpjTitular: '' }, bancarioConferido: true,
  resultadoSancoes: 'Nada consta', situacaoCadastral: 'Ativa', resultadoCertidoes: 'Regular', ...extra
} as unknown as IFornecedor);

const ciclo = (extra: Partial<ICicloHomologacao> = {}): ICicloHomologacao => ({
  id: 'c1', fornecedorId: 'f1', numero: 2, motivo: 'Cadastro inicial', etapa: 'Em análise', etapaDesde: '', concluidoEm: '',
  protocolo: 'FORN-2026-0001', classificacaoRisco: 'Baixo', resultadoHomologacao: 'Pendente', ressalvas: `Sócio CPF ${CPF_FICTICIO}`,
  validadeCadastro: '', verificacoes: { receita: { ok: true, data: '2026-11-20', responsavel: 'Analista' }, bancario: { ok: true, data: '2026-11-20', responsavel: 'Analista' } },
  responsavelSuprimentos: '', responsavelCompliance: '', bancarioConferido: true, abertoPor: '', criadoEm: '2026-11-19T10:00:00Z',
  fluxoIniciado: true, etapaAtual: 'analise-suprimentos', prazoEtapa: '', responsaveisEtapa: '', ...extra
});

const tipo = (id: string, nome: string, aplicaA: 'Empresa' | 'Colaborador'): ITipoDocumentoFornecedor => ({
  id, nome, aplicaA, descricao: '', categorias: [], obrigatorio: true, exigeValidade: false, visibilidade: 'Interno', ordem: 1, ativo: true
});

const conteudo = (f: IFornecedor, c: ICicloHomologacao): ReturnType<typeof montarConteudoRelatorio> =>
  montarConteudoRelatorio({
    fornecedor: f,
    ciclo: c,
    situacao: calcularSituacao(f, [tipo('t-cs', 'Contrato social', 'Empresa'), tipo('t-aso', 'ASO', 'Colaborador')], []),
    consultas: [],
    historicoFluxo: [{ id: 'h1', data: '2026-11-20T10:00:00Z', elementoId: 'ficha-recebida', elementoNome: 'Ficha recebida', acaoChave: 'solicitar', acaoRotulo: 'Solicitar documentos', resultado: 'solicitar', comentario: `ver CPF ${CPF_FICTICIO}`, executadoPorId: 'u1', executadoPorNome: 'Analista', sistema: false }],
    parecer: '',
    emitidoEm: new Date(2026, 10, 23, 10, 15),
    geradoPor: 'Analista'
  });

const textoTodo = (x: unknown): string => JSON.stringify(x);

describe('Relatório de homologação (conteúdo)', () => {

  it('nunca tem CPF nem dados bancários', () => {
    const t = textoTodo(conteudo(fornecedor(), ciclo()));
    expect(t).not.toContain(CPF_FICTICIO);
    expect(t).toContain('[CPF removido]');
    expect(t).not.toMatch(/99999-9|banc/i);
    expect(t).not.toMatch(/Dados bancários/);
  });

  it('omite o CNPJ quando vem vazio (sem perfil de campo); mostra quando vem', () => {
    expect(textoTodo(conteudo(fornecedor(), ciclo()))).not.toContain('"CNPJ"');
    expect(textoTodo(conteudo(fornecedor({ cnpj: '11222333000181' }), ciclo()))).toContain('11.222.333/0001-81');
  });

  it('fase e prévia corretas', () => {
    const emAndamento = conteudo(fornecedor(), ciclo());
    expect(emAndamento.previa).toBe(true);
    expect(emAndamento.fase).toBe('Em análise (Suprimentos)');
    const final = conteudo(fornecedor(), ciclo({ concluidoEm: '2026-11-23T10:00:00Z', etapa: 'Concluído', resultadoHomologacao: 'Aprovado' }));
    expect(final.previa).toBe(false);
    expect(final.fase).toBe('Concluído — Aprovado');
    expect(faseDoCiclo({ concluidoEm: '', etapa: 'Aguardando Jurídico', resultadoHomologacao: 'Pendente' })).toBe('Aguardando Jurídico');
  });

  it('documentos: só os da empresa (tipo de colaborador nunca entra)', () => {
    const docs = conteudo(fornecedor(), ciclo()).secoes.filter(s => s.titulo.indexOf('Documentos') >= 0)[0];
    expect((docs.linhas || []).map(l => l[0])).toEqual(['Contrato social']);
  });

  it('nome do arquivo: protocolo, ciclo, fase e data, sem CNPJ e sem caracteres inválidos', () => {
    expect(nomeArquivoRelatorio('FORN-2026-0001', 2, 'Concluído — Aprovado com ressalvas', new Date(2026, 10, 23, 9, 5)))
      .toBe('Relatorio homologacao FORN-2026-0001 ciclo 2 - Concluído — Aprovado com ressalvas - 2026-11-23 0905.pdf');
    expect(nomeArquivoRelatorio('FORN-2026-0001', 1, 'Em análise: Suprimentos/Jurídico', new Date(2026, 0, 2, 3, 4)))
      .toBe('Relatorio homologacao FORN-2026-0001 ciclo 1 - Em análise- Suprimentos-Jurídico - 2026-01-02 0304.pdf');
    expect(semCpf('12345678909')).toBe('[CPF removido]');
  });
});

describe('Relatório de homologação (arquivamento)', () => {

  const montar = (): { servico: FornecedoresService; criados: Array<{ tabela: string; dados: Record<string, unknown> }>; atualizados: Array<Record<string, unknown>> } => {
    const criados: Array<{ tabela: string; dados: Record<string, unknown> }> = [];
    const atualizados: Array<Record<string, unknown>> = [];
    const dataverse = {
      obterRegistro: () => Promise.resolve({ etag: 'e', registro: { dgt_relatoriosjson: '[]' } }),
      atualizarRegistro: (_t: string, _id: string, dados: Record<string, unknown>) => { atualizados.push(dados); return Promise.resolve(''); },
      criarRegistro: (tabela: string, dados: Record<string, unknown>) => { criados.push({ tabela, dados }); return Promise.resolve('id'); },
      listarRegistros: (tabela: string) => Promise.resolve(tabela === 'dgt_tipodocumentofornecedor'
        ? [{ dgt_tipodocumentofornecedorid: 't-rel', dgt_name: 'Relatório de homologação' }]
        : []),
      referenciaLookup: (t: string, id: string) => Promise.resolve(`/${t}s(${id})`)
    } as unknown as DataverseService;
    return { servico: new FornecedoresService(dataverse, {} as SPHttpClient, 'https://exemplo.sharepoint.com/sites/Suprimentos'), criados, atualizados };
  };

  const pdf = new Blob(['%PDF-1.4 teste'], { type: 'application/pdf' });

  it('relatório final: salva, entra na lista do ciclo e vira documento', async () => {
    const { servico, criados, atualizados } = montar();
    const r = await servico.arquivarRelatorio(fornecedor(), ciclo(), pdf, 'Relatorio homologacao FORN-2026-0001 ciclo 2 - Concluído — Aprovado - 2026-11-23 1015.pdf',
      { fase: 'Concluído — Aprovado', final: true, geradoPor: 'Analista', emitidoEm: new Date(2026, 10, 23, 10, 15) });
    expect(r.avisos).toEqual([]);
    expect(JSON.parse(String(atualizados[0].dgt_relatoriosjson))[0]).toEqual(expect.objectContaining({ final: true, fase: 'Concluído — Aprovado' }));
    const documento = criados.filter(c => c.tabela === 'dgt_fornecedordocumento')[0];
    expect(documento.dados['dgt_TipoDocumento@odata.bind']).toContain('t-rel');
    expect(String(documento.dados.dgt_arquivourl)).toContain('/Homologacao/');
    expect(criados.some(c => c.tabela === 'dgt_fornecedorhistorico' && /Relatório de homologação emitido/.test(String(c.dados.dgt_name)))).toBe(true);
  });

  it('prévia: salva e lista, mas não vira documento', async () => {
    const { servico, criados } = montar();
    await servico.arquivarRelatorio(fornecedor(), ciclo(), pdf, 'previa.pdf',
      { fase: 'Em análise (Suprimentos)', final: false, geradoPor: 'Analista', emitidoEm: new Date() });
    expect(criados.filter(c => c.tabela === 'dgt_fornecedordocumento')).toHaveLength(0);
  });
});

describe('Isolamento Empresa × Colaborador', () => {

  it('situação documental do fornecedor ignora tipos de colaborador', () => {
    const s = calcularSituacao(fornecedor(), [tipo('t-cs', 'Contrato social', 'Empresa'), tipo('t-aso', 'ASO', 'Colaborador')], []);
    expect(s.itens.map(i => i.tipo.nome)).toEqual(['Contrato social']);
    expect(s.faltando).toBe(1);
  });

  it('carregar separa os tipos: empresa em "tipos", colaborador em "tiposColaborador"', async () => {
    const dataverse = {
      listarRegistros: (tabela: string, consulta: string) => {
        if (tabela === 'dgt_tipodocumentofornecedor' && /\$top=1/.test(consulta)) {
          return Promise.resolve([]);
        }
        if (tabela === 'dgt_tipodocumentofornecedor') {
          return Promise.resolve([
            { dgt_tipodocumentofornecedorid: 't-cs', dgt_name: 'Contrato social', dgt_ativo: true },
            { dgt_tipodocumentofornecedorid: 't-aso', dgt_name: 'ASO', dgt_aplicaa: 'Colaborador', dgt_ativo: true }
          ]);
        }
        return Promise.resolve([]);
      }
    } as unknown as DataverseService;
    const dados = await new FornecedoresService(dataverse).carregar();
    expect(dados.tipos.map(t => t.nome)).toEqual(['Contrato social']);
    expect(dados.tiposColaborador.map(t => t.nome)).toEqual(['ASO']);
  });
});
