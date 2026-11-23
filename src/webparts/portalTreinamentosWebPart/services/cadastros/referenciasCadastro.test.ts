import {
  IItemCadastro,
  ReferenciasCadastroService,
  normalizarChave,
  resolverPorNome
} from './ReferenciasCadastroService';

import {
  DataverseService
} from '../DataverseService';

// ============================================================
// TESTES — referências a cadastros (alinhamento das tabelas, fase 3)
// ============================================================

const AREAS: IItemCadastro[] = [
  { id: 'a1', nome: 'Suporte', sigla: 'SUP' },
  { id: 'a2', nome: 'Inteligência', sigla: 'INT' }
];

const FABRICANTES: IItemCadastro[] = [
  { id: 'f1', nome: 'Intelbras' },
  { id: 'f2', nome: 'TP-Link' }
];

describe('normalizarChave', () => {
  it('ignora maiúsculas, acentos e espaços repetidos', () => {
    expect(normalizarChave('  Inteligência   Artificial ')).toBe('INTELIGENCIA ARTIFICIAL');
  });
});

describe('resolverPorNome', () => {
  it('encontra a área pelo nome escrito de outro jeito', () => {
    expect((resolverPorNome(AREAS, 'SUPORTE') as IItemCadastro).id).toBe('a1');
    expect((resolverPorNome(AREAS, 'INTELIGÊNCIA') as IItemCadastro).id).toBe('a2');
  });

  it('encontra a área pela sigla', () => {
    expect((resolverPorNome(AREAS, 'int') as IItemCadastro).id).toBe('a2');
  });

  it('encontra o fabricante sem diferenciar maiúsculas', () => {
    expect((resolverPorNome(FABRICANTES, 'intelbras') as IItemCadastro).id).toBe('f1');
    expect((resolverPorNome(FABRICANTES, 'tp-link') as IItemCadastro).id).toBe('f2');
  });

  it('não inventa vínculo quando não há correspondência', () => {
    expect(resolverPorNome(FABRICANTES, 'DASHUA')).toBeUndefined();
    expect(resolverPorNome(FABRICANTES, '')).toBeUndefined();
    expect(resolverPorNome(undefined, 'Intelbras')).toBeUndefined();
  });
});

// Dataverse simulado: registra as chamadas.
const simular = (opcoes: { colunaExiste: boolean; falharGravacao?: boolean }): { dv: DataverseService; chamadas: string[] } => {
  const chamadas: string[] = [];
  const dv = {
    listarRegistros: (tabela: string, consulta: string) => {
      chamadas.push(`ler ${tabela} ${consulta}`);
      if (tabela === 'dgt_fabricante') {
        return Promise.resolve([{ dgt_fabricanteid: 'F1', dgt_name: 'Intelbras' }]);
      }
      return opcoes.colunaExiste ? Promise.resolve([]) : Promise.reject(new Error('400 Could not find a property'));
    },
    referenciaLookup: (tabela: string, id: string) => Promise.resolve(`/${tabela}s(${id})`),
    atualizarRegistro: (tabela: string, id: string, dados: Record<string, unknown>) => {
      chamadas.push(`gravar ${tabela} ${id} ${JSON.stringify(dados)}`);
      return opcoes.falharGravacao ? Promise.reject(new Error('missing prvAppend')) : Promise.resolve('');
    },
    limparLookup: (tabela: string, id: string, navegacao: string) => {
      chamadas.push(`limpar ${tabela} ${id} ${navegacao}`);
      return Promise.resolve();
    }
  } as unknown as DataverseService;
  return { dv, chamadas };
};

const LOOKUP = { coluna: 'dgt_fabricantecadastro', navegacao: 'dgt_FabricanteCadastro' };

describe('ReferenciasCadastroService', () => {
  it('grava o lookup quando a coluna existe e há correspondência', async () => {
    const { dv, chamadas } = simular({ colunaExiste: true });
    await new ReferenciasCadastroService(dv).vincularFabricante('dgt_declaracaofabricante', 'D1', LOOKUP, 'INTELBRAS', true);
    expect(chamadas.filter(c => c.indexOf('gravar') === 0)).toEqual([
      'gravar dgt_declaracaofabricante D1 {"dgt_FabricanteCadastro@odata.bind":"/dgt_fabricantes(f1)"}'
    ]);
  });

  it('não faz nada quando a coluna ainda não foi criada', async () => {
    const { dv, chamadas } = simular({ colunaExiste: false });
    await new ReferenciasCadastroService(dv).vincularFabricante('dgt_declaracaofabricante', 'D1', LOOKUP, 'Intelbras', false);
    expect(chamadas.filter(c => c.indexOf('gravar') === 0 || c.indexOf('limpar') === 0)).toEqual([]);
  });

  it('limpa o vínculo de registro existente quando o fabricante sai do cadastro', async () => {
    const { dv, chamadas } = simular({ colunaExiste: true });
    await new ReferenciasCadastroService(dv).vincularFabricante('dgt_declaracaofabricante', 'D1', LOOKUP, 'Outro', false);
    expect(chamadas.filter(c => c.indexOf('limpar') === 0)).toEqual(['limpar dgt_declaracaofabricante D1 dgt_FabricanteCadastro']);
  });

  it('não limpa nada em registro novo sem correspondência', async () => {
    const { dv, chamadas } = simular({ colunaExiste: true });
    await new ReferenciasCadastroService(dv).vincularFabricante('dgt_declaracaofabricante', 'D1', LOOKUP, 'Outro', true);
    expect(chamadas.filter(c => c.indexOf('gravar') === 0 || c.indexOf('limpar') === 0)).toEqual([]);
  });

  it('nunca lança erro quando a gravação do vínculo falha', async () => {
    const { dv } = simular({ colunaExiste: true, falharGravacao: true });
    const aviso = console.warn;
    console.warn = () => undefined;
    try {
      await expect(new ReferenciasCadastroService(dv).vincularFabricante('dgt_bom_ro', 'R1', LOOKUP, 'Intelbras', true)).resolves.toBeUndefined();
    } finally {
      console.warn = aviso;
    }
  });
});
