import {
  descreverResolvido,
  resolverResponsavel,
  usuarioAtende
} from './ResolvedorResponsaveis';

// ============================================================
// TESTES — responsável "Definido na aba Responsáveis"
// (Planejamento orçamentário → Responsáveis: preenchimento e diretor)
// ============================================================

describe('Definido na aba Responsáveis', () => {

  const dados = {
    documentoAreaId: 'pro',
    pessoasPorPapel: { preenchimento: ['ana'], diretor: ['carlos'] }
  };

  it('preenchimento: só a pessoa definida para a área', () => {
    const resolvido = resolverResponsavel(
      { tipo: 'definidoPorArea', referenciaId: 'preenchimento', descricao: 'Responsável pelo preenchimento', papelTeste: 'p' },
      dados
    );
    expect(usuarioAtende(resolvido, 'ana', [])).toBe(true);
    expect(usuarioAtende(resolvido, 'carlos', [])).toBe(false);
    expect(descreverResolvido(resolvido, [], [{ id: 'ana', nome: 'Ana' }])).toBe('Responsável pelo preenchimento: Ana');
  });

  it('diretor: só o diretor definido para a área', () => {
    const resolvido = resolverResponsavel(
      { tipo: 'definidoPorArea', referenciaId: 'diretor', descricao: 'Diretor responsável', papelTeste: 'd' },
      dados
    );
    expect(usuarioAtende(resolvido, 'carlos', [])).toBe(true);
    expect(usuarioAtende(resolvido, 'ana', [])).toBe(false);
  });

  it('área sem pessoa definida: ninguém age e a tela avisa', () => {
    const resolvido = resolverResponsavel(
      { tipo: 'definidoPorArea', referenciaId: 'diretor', descricao: 'Diretor responsável', papelTeste: 'd' },
      { documentoAreaId: 'adm', pessoasPorPapel: { preenchimento: [], diretor: [] } }
    );
    expect(usuarioAtende(resolvido, 'carlos', [])).toBe(false);
    expect(descreverResolvido(resolvido, [])).toBe('Diretor responsável (não definido para esta área)');
  });
});
