import {
  MODULOS_PADRAO,
  MODULOS_PORTAL,
  chaveModuloAmbiente,
  gravarModulosAcesso,
  lerModulosAcesso,
  lerModulosAdministrados,
  moduloLiberado,
  modulosEfetivos,
  registrarModulosAmbientes
} from './modulosPortal';

// ============================================================
// TESTES — Ambientes dinâmicos no registro de módulos
// Os ambientes ("amb:<chave>") devem se comportar exatamente como os
// módulos fixos: liberação por usuário, padrão por perfil e
// "Administrador do módulo".
// ============================================================

describe('Ambientes dinâmicos como módulos do portal', () => {

  afterEach(() => registrarModulosAmbientes([]));

  it('registra os ambientes na mesma lista dos módulos fixos (sem duplicar)', () => {
    const fixos = MODULOS_PORTAL.length;
    registrarModulosAmbientes([
      { chave: 'licitacoes-publicas', nome: 'Licitações Públicas', descricao: '', padrao: false },
      { chave: 'compras', nome: 'Compras', descricao: '', padrao: true }
    ]);
    expect(MODULOS_PORTAL.length).toBe(fixos + 2);
    // Registrar de novo substitui, não acumula.
    registrarModulosAmbientes([{ chave: 'compras', nome: 'Compras', descricao: '', padrao: true }]);
    expect(MODULOS_PORTAL.length).toBe(fixos + 1);
    expect(MODULOS_PADRAO.indexOf(chaveModuloAmbiente('compras'))).toBeGreaterThanOrEqual(0);
    registrarModulosAmbientes([]);
    expect(MODULOS_PORTAL.length).toBe(fixos);
    expect(MODULOS_PADRAO.indexOf(chaveModuloAmbiente('compras'))).toBe(-1);
  });

  it('lê a liberação de um ambiente mesmo antes de os ambientes serem carregados', () => {
    const texto = '["treinamentos","amb:compras","admin:amb:compras"]';
    expect(lerModulosAcesso(texto)).toEqual(['treinamentos', 'amb:compras']);
    expect(lerModulosAdministrados(texto)).toEqual(['amb:compras']);
    // Chave inválida continua sendo descartada.
    expect(lerModulosAcesso('["treinamentos","qualquer"]')).toEqual(['treinamentos']);
  });

  it('grava liberação e administração de ambiente igual aos módulos fixos', () => {
    const texto = gravarModulosAcesso(['treinamentos', chaveModuloAmbiente('compras')], [chaveModuloAmbiente('compras')]);
    expect(JSON.parse(texto)).toEqual(['treinamentos', 'amb:compras', 'admin:amb:compras']);
  });

  it('respeita liberação padrão (todos / por perfil) e o Administrador vê tudo', () => {
    registrarModulosAmbientes([
      { chave: 'compras', nome: 'Compras', descricao: '', padrao: true },
      { chave: 'juridico', nome: 'Jurídico', descricao: '', padrao: false, padraoPerfis: ['Gestor'] },
      { chave: 'restrito', nome: 'Restrito', descricao: '', padrao: false }
    ]);

    // Sem lista própria: padrão.
    expect(moduloLiberado('Funcionario', undefined, chaveModuloAmbiente('compras'))).toBe(true);
    expect(moduloLiberado('Funcionario', undefined, chaveModuloAmbiente('juridico'))).toBe(false);
    expect(moduloLiberado('Gestor', undefined, chaveModuloAmbiente('juridico'))).toBe(true);
    expect(moduloLiberado('Gestor', undefined, chaveModuloAmbiente('restrito'))).toBe(false);

    // Liberação individual.
    expect(moduloLiberado('Funcionario', ['treinamentos', chaveModuloAmbiente('restrito')], chaveModuloAmbiente('restrito'))).toBe(true);

    // Administrador global.
    expect(modulosEfetivos('Administrador', undefined)).toContain(chaveModuloAmbiente('restrito'));
  });
});
