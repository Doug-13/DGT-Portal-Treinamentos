// SharePoint simulado (antes dos imports, para o mock valer): a
// biblioteca do SharePoint só carrega no navegador.
jest.mock('../sharepoint/SharePointDocumentoService', () => ({
  SharePointDocumentoService: class {}
}));

import { FornecedoresService } from './FornecedoresService';
import { DataverseService } from '../DataverseService';
import { IFornecedor } from './modeloFornecedores';
import {
  assuntoPedidoDocumentos,
  corpoPedidoDocumentos,
  destinatarioPedido,
  emailValido,
  validarPedidoDocumentos
} from './pedidoDocumentos';

// ============================================================
// FORNECEDORES — pedido de documentos pelo botão do administrador
// e edição dos dados da ficha com histórico. Dados fictícios.
// ============================================================

const contato = (email: string): IFornecedor['contatoComercial'] => ({ nome: 'Fulano', email, telefone: '' });

const fornecedor = (extra: Partial<IFornecedor> = {}): IFornecedor => ({
  id: 'f1',
  razaoSocial: 'Empresa Exemplo <Ltda>',
  protocolo: 'FORN-2026-0042',
  emailPedidos: 'nf@exemplo.com.br',
  contatoComercial: contato('comercial@exemplo.com.br'),
  contatoFiscal: contato(''),
  contatoFinanceiro: contato(''),
  contatoIntegridade: contato(''),
  ...extra
} as unknown as IFornecedor);

interface ICriado { tabela: string; dados: Record<string, unknown> }

const montar = (falhaRemetente = false): { servico: FornecedoresService; criados: ICriado[]; atualizados: Array<Record<string, unknown>> } => {
  const criados: ICriado[] = [];
  const atualizados: Array<Record<string, unknown>> = [];
  let tentativas = 0;
  const dataverse = {
    criarRegistro: (tabela: string, dados: Record<string, unknown>) => {
      if (tabela === 'dgt_implemail' && falhaRemetente && tentativas++ === 0) {
        return Promise.reject(new Error("Invalid property 'dgt_remetente'"));
      }
      criados.push({ tabela, dados: { ...dados } });
      return Promise.resolve('novo');
    },
    atualizarRegistro: (_t: string, _id: string, dados: Record<string, unknown>) => {
      atualizados.push(dados);
      return Promise.resolve();
    },
    referenciaLookup: (tabela: string, id: string) => Promise.resolve(`/${tabela}s(${id})`)
  } as unknown as DataverseService;
  return { servico: new FornecedoresService(dataverse), criados, atualizados };
};

describe('Pedido de documentos (regras)', () => {

  it('valida e-mail', () => {
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido(' a@b.com.br ')).toBe(true);
    expect(emailValido('f')).toBe(false);
    expect(emailValido('a@b')).toBe(false);
    expect(emailValido('a b@c.com')).toBe(false);
    expect(emailValido('a@@c.com')).toBe(false);
    expect(emailValido('a@c.com.')).toBe(false);
  });

  it('destinatário: sempre o e-mail para pedidos / NF, nunca o contato comercial', () => {
    expect(destinatarioPedido(fornecedor())).toBe('nf@exemplo.com.br');
    expect(destinatarioPedido(fornecedor({ emailPedidos: '' }))).toBe('');
  });

  it('assunto com o protocolo e corpo escapado, sem CNPJ', () => {
    const f = fornecedor({ cnpj: '00000000000000' } as Partial<IFornecedor>);
    expect(assuntoPedidoDocumentos(f)).toBe('[FORN-2026-0042] Documentos para cadastro na DGT — Empresa Exemplo <Ltda>');
    const corpo = corpoPedidoDocumentos(f, ['Contrato social', 'Alvará (vencido)'], 'Linha 1\nLinha 2');
    expect(corpo).toContain('Empresa Exemplo &lt;Ltda&gt;');
    expect(corpo).toContain('<li>Alvará (vencido)</li>');
    expect(corpo).toContain('Linha 1<br>Linha 2');
    expect(corpo).toContain('fornecedores@dgt.com.br');
    expect(corpo).not.toContain('00000000000000');
  });

  it('exige protocolo, e-mail de pedidos / NF válido e ao menos um documento', () => {
    expect(validarPedidoDocumentos(fornecedor({ protocolo: '' }), ['X']).ok).toBe(false);
    expect(validarPedidoDocumentos(fornecedor({ emailPedidos: 'f' }), ['X']).ok).toBe(false);
    expect(validarPedidoDocumentos(fornecedor(), []).ok).toBe(false);
    expect(validarPedidoDocumentos(fornecedor(), ['X']).ok).toBe(true);
  });
});

describe('Pedido de documentos (serviço)', () => {

  it('grava na fila com remetente "fornecedores" e registra o histórico sem o endereço', async () => {
    const { servico, criados } = montar();
    await servico.solicitarDocumentos(fornecedor(), ['Contrato social'], '', 'Admin');

    const fila = criados.find(c => c.tabela === 'dgt_implemail');
    expect(fila).toBeDefined();
    expect(fila!.dados.dgt_status).toBe('Pendente');
    expect(fila!.dados.dgt_tipo).toBe('fornecedorPedidoDocumentos');
    expect(fila!.dados.dgt_remetente).toBe('fornecedores');
    expect(fila!.dados.dgt_para).toBe('nf@exemplo.com.br');
    expect(String(fila!.dados.dgt_name)).toContain('[FORN-2026-0042]');

    const hist = criados.find(c => c.tabela === 'dgt_fornecedorhistorico');
    expect(hist!.dados.dgt_name).toBe('Documentos solicitados por e-mail');
    expect(String(hist!.dados.dgt_descricao)).toContain('Para: e-mail para pedidos / NF');
    expect(String(hist!.dados.dgt_descricao)).not.toContain('nf@exemplo.com.br');
  });

  it('sem a coluna dgt_remetente, não grava (sairia de outra caixa)', async () => {
    const { servico, criados } = montar(true);
    await expect(servico.solicitarDocumentos(fornecedor(), ['Alvará'], '', 'Admin')).rejects.toThrow(/dgt_remetente/);
    expect(criados).toHaveLength(0);
  });

  it('não grava nada com e-mail inválido ou CPF na mensagem', async () => {
    const { servico, criados } = montar();
    await expect(servico.solicitarDocumentos(fornecedor({ emailPedidos: 'f' }), ['X'], '', 'Admin')).rejects.toThrow(/pedidos \/ NF/);
    await expect(servico.solicitarDocumentos(fornecedor(), ['X'], 'CPF 111.444.777-35', 'Admin')).rejects.toThrow();
    expect(criados).toHaveLength(0);
  });
});

describe('Edição dos dados da ficha (declarações)', () => {

  it('registra antes → depois das declarações', async () => {
    const { servico, criados, atualizados } = montar();
    const antes = fornecedor({ declaracoes: { aceitas: false, representante: 'Fulano', cargo: '', local: 'Cidade', data: '2026-11-01' } });
    const depois = { ...antes, declaracoes: { aceitas: true, representante: 'Beltrano', cargo: 'Sócio', local: 'Cidade', data: '2026-11-01' } };

    await servico.atualizarFornecedor(depois, antes, 'Retificação por e-mail do fornecedor', 'Admin');

    expect(JSON.parse(String(atualizados[0].dgt_declaracoes))).toEqual(depois.declaracoes);
    const desc = String(criados.find(c => c.tabela === 'dgt_fornecedorhistorico')!.dados.dgt_descricao);
    expect(desc).toContain('Declarações aceitas: "Não" → "Sim"');
    expect(desc).toContain('Representante legal: "Fulano" → "Beltrano"');
    expect(desc).not.toContain('Local das declarações');
  });

  it('sem mudança nas declarações, não grava a coluna', async () => {
    const { servico, atualizados } = montar();
    const dec = { aceitas: true, representante: 'Fulano', cargo: '', local: '', data: '' };
    const antes = fornecedor({ declaracoes: dec, telefone: '1' } as Partial<IFornecedor>);
    await servico.atualizarFornecedor({ ...antes, declaracoes: { ...dec }, telefone: '2' }, antes, 'Ajuste', 'Admin');
    expect(atualizados[0].dgt_declaracoes).toBeUndefined();
    expect(atualizados[0].dgt_telefone).toBe('2');
  });
});
