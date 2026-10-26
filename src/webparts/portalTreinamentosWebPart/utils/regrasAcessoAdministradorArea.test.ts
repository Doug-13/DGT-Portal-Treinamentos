import {
  administraArea,
  calcularRegrasAcesso
} from './regrasAcesso';

// ============================================================
// TESTES — "Administrador da área" = administrador só daquela área
// (ex.: Fernanda, Colaborador no portal e Administradora da
// CONTROLADORIA, com Treinamentos e Orçamento liberados).
// ============================================================

describe('Administrador da área', () => {

  const vinculos = [
    { areaId: 'ctl', areaNome: 'CONTROLADORIA', perfil: 'Administrador da área' },
    { areaId: 'ger', areaNome: 'GERAL', perfil: 'Membro' }
  ];

  const regras = calcularRegrasAcesso('Funcionario', vinculos, ['treinamentos', 'orcamento']);

  it('tem os poderes de administrador na área, mas não no portal', () => {
    expect(regras.admin).toBe(false);
    expect(regras.areasAdministrador).toEqual(['ctl']);
    expect(regras.gestor).toBe(true);
    expect(regras.editor).toBe(true);
    expect(regras.podeVerEquipe).toBe(true);
    expect(regras.podeAprovarDocumentos).toBe(true);
    expect(regras.podeGerenciarUsuarios).toBe(false);
  });

  it('cria e mantém conteúdo só da sua área e dos módulos liberados', () => {
    expect(regras.areasConteudo).toEqual(['ctl']);
    expect(regras.escopoAreas).toEqual(['ctl']);
    expect(regras.podeGerenciarTreinamentos).toBe(true);
    // Documentos não está liberado para ela.
    expect(regras.podeGerenciarDocumentos).toBe(false);
  });

  it('administra a CONTROLADORIA e não outras áreas', () => {
    expect(administraArea('Funcionario', regras.areasAdministrador, 'ctl')).toBe(true);
    expect(administraArea('Funcionario', regras.areasAdministrador, 'ger')).toBe(false);
    expect(administraArea('Administrador', [], 'ger')).toBe(true);
  });

  it('Editor global continua com todas as áreas de conteúdo', () => {
    const editor = calcularRegrasAcesso('Editor', vinculos, ['treinamentos']);
    expect(editor.areasConteudo).toBeUndefined();
  });
});
