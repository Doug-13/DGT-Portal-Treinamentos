// SharePoint simulado (antes dos imports, para o mock valer): a
// biblioteca do SharePoint só carrega no navegador.
jest.mock('../sharepoint/SharePointDocumentoService', () => ({
  SharePointDocumentoService: class {}
}));

import { FornecedoresService } from './FornecedoresService';
import { DataverseService } from '../DataverseService';
import {
  IDocumentoFornecedor,
  IFornecedor,
  ITipoDocumentoFornecedor,
  lerSituacaoDocumento
} from './modeloFornecedores';

// ============================================================
// FORNECEDORES — documentos recebidos por e-mail ("A conferir")
// O Fluxo 2 grava cada anexo como "A conferir"; a analista confere
// (tipo e datas → Vigente) ou descarta.
// ============================================================

interface IAtualizacao { tabela: string; id: string; dados: Record<string, unknown> }

const montar = (): { servico: FornecedoresService; atualizacoes: IAtualizacao[]; historico: Array<Record<string, unknown>> } => {
  const atualizacoes: IAtualizacao[] = [];
  const historico: Array<Record<string, unknown>> = [];
  const dataverse = {
    atualizarRegistro: (tabela: string, id: string, dados: Record<string, unknown>) => {
      atualizacoes.push({ tabela, id, dados });
      return Promise.resolve();
    },
    criarRegistro: (_tabela: string, dados: Record<string, unknown>) => {
      historico.push(dados);
      return Promise.resolve('h1');
    },
    referenciaLookup: (tabela: string, id: string) => Promise.resolve(`/${tabela}s(${id})`)
  } as unknown as DataverseService;
  return { servico: new FornecedoresService(dataverse), atualizacoes, historico };
};

const fornecedor = { id: 'f1', razaoSocial: 'Empresa Exemplo' } as unknown as IFornecedor;

const tipoCnd: ITipoDocumentoFornecedor = {
  id: 't-cnd', nome: 'CND Federal', descricao: '', categorias: [], obrigatorio: true, exigeValidade: true,
  visibilidade: 'Interno', ordem: 1, ativo: true, validadeDias: 180
};

const recebido = (extra: Partial<IDocumentoFornecedor> = {}): IDocumentoFornecedor => ({
  id: 'd-novo', fornecedorId: 'f1', tipoId: '', tipoNome: 'Documento', titulo: 'cnd.pdf', emissao: '', vencimento: '',
  arquivoUrl: 'https://exemplo.sharepoint.com/cnd.pdf', arquivoNome: 'cnd.pdf',
  observacoes: 'Recebido por e-mail (protocolo FORN-2026-0042) em 18/11/2026 10:00.',
  situacao: 'A conferir', registradoPor: 'E-mail (FORN-2026-0042)', criadoEm: '', ...extra
});

describe('Documentos recebidos por e-mail', () => {

  it('lê as situações gravadas (vazio = Vigente, legado)', () => {
    expect(lerSituacaoDocumento('A conferir')).toBe('A conferir');
    expect(lerSituacaoDocumento('Descartado')).toBe('Descartado');
    expect(lerSituacaoDocumento('Substituído')).toBe('Substituído');
    expect(lerSituacaoDocumento('')).toBe('Vigente');
  });

  it('conferir: grava tipo e datas, vira Vigente, substitui a versão anterior e registra no histórico', async () => {
    const { servico, atualizacoes, historico } = montar();
    const anterior = recebido({ id: 'd-antigo', situacao: 'Vigente', tipoId: 't-cnd' });
    await servico.conferirDocumento(fornecedor, recebido(),
      { tipo: tipoCnd, emissao: '2026-11-10', vencimento: '2027-05-09', observacoes: '' }, [anterior], 'Analista');

    expect(atualizacoes[0].id).toBe('d-novo');
    expect(atualizacoes[0].dados.dgt_situacao).toBe('Vigente');
    expect(atualizacoes[0].dados.dgt_dataemissao).toBe('2026-11-10');
    expect(atualizacoes[0].dados.dgt_datavencimento).toBe('2027-05-09');
    expect(atualizacoes[0].dados['dgt_TipoDocumento@odata.bind']).toContain('t-cnd');
    expect(atualizacoes[1]).toEqual(expect.objectContaining({ id: 'd-antigo', dados: { dgt_situacao: 'Substituído' } }));
    expect(historico[0].dgt_name).toBe('Documento conferido');
  });

  it('conferir: exige tipo, emissão e validade quando o tipo pede', async () => {
    const { servico, atualizacoes } = montar();
    await expect(servico.conferirDocumento(fornecedor, recebido(),
      { tipo: tipoCnd, emissao: '', vencimento: '', observacoes: '' }, [], 'Analista')).rejects.toThrow(/emissão/);
    await expect(servico.conferirDocumento(fornecedor, recebido(),
      { tipo: tipoCnd, emissao: '2026-11-10', vencimento: '', observacoes: '' }, [], 'Analista')).rejects.toThrow(/validade/);
    await expect(servico.conferirDocumento(fornecedor, recebido({ situacao: 'Vigente' }),
      { tipo: tipoCnd, emissao: '2026-11-10', vencimento: '2027-05-09', observacoes: '' }, [], 'Analista')).rejects.toThrow(/já foi conferido/);
    expect(atualizacoes).toHaveLength(0);
  });

  it('descartar: sai da fila com o motivo; exige motivo', async () => {
    const { servico, atualizacoes, historico } = montar();
    await expect(servico.descartarDocumento(fornecedor, recebido(), '  ', 'Analista')).rejects.toThrow(/motivo/);
    await servico.descartarDocumento(fornecedor, recebido(), 'Logo da assinatura do e-mail', 'Analista');
    expect(atualizacoes[0].dados.dgt_situacao).toBe('Descartado');
    expect(String(atualizacoes[0].dados.dgt_observacoes)).toContain('Logo da assinatura');
    expect(historico[0].dgt_name).toBe('Documento descartado');
  });
});
