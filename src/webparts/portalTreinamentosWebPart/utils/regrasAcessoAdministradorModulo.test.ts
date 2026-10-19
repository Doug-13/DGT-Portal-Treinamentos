import {
  administraModulo,
  gravarModulosAcesso,
  lerModulosAcesso,
  lerModulosAdministrados
} from './modulosPortal';

import {
  calcularRegrasAcesso
} from './regrasAcesso';

// ============================================================
// TESTES — "Administrador do módulo"
// Ex.: William (Editor, Administrador da área PROCESSOS) administra
// Treinamentos e Documentos.
// ============================================================

describe('Administrador do módulo', () => {

  it('grava e lê os módulos administrados na mesma coluna', () => {
    const texto = gravarModulosAcesso(['treinamentos', 'documentos', 'processos'], ['treinamentos', 'documentos']);
    expect(JSON.parse(texto)).toEqual(['treinamentos', 'documentos', 'processos', 'admin:treinamentos', 'admin:documentos']);
    expect(lerModulosAcesso(texto)).toEqual(['treinamentos', 'documentos', 'processos']);
    expect(lerModulosAdministrados(texto)).toEqual(['treinamentos', 'documentos']);
    // Lista antiga continua valendo.
    expect(lerModulosAdministrados('["treinamentos"]')).toEqual([]);
  });

  it('administrar um módulo também libera o módulo', () => {
    const texto = gravarModulosAcesso(['treinamentos'], ['orcamento']);
    expect(lerModulosAcesso(texto)).toEqual(['treinamentos', 'orcamento']);
  });

  it('tem poder total só nos módulos administrados', () => {
    const vinculos = [{ areaId: 'pro', areaNome: 'PROCESSOS', perfil: 'Editor' }];
    const regras = calcularRegrasAcesso('Funcionario', vinculos, ['treinamentos', 'documentos', 'processos'], ['treinamentos', 'documentos']);
    expect(regras.admin).toBe(false);
    expect(regras.modulosAdministrados).toEqual(['treinamentos', 'documentos']);
    // Treinamentos: todas as áreas (conteúdo e pessoas).
    expect(regras.areasConteudo).toBeUndefined();
    expect(regras.escopoAreas).toBeUndefined();
    expect(regras.podeGerenciarTreinamentos).toBe(true);
    // Documentos: gerencia e aprova.
    expect(regras.podeGerenciarDocumentos).toBe(true);
    expect(regras.podeAprovarDocumentos).toBe(true);
    // Portal: continua sem administrar acessos.
    expect(regras.podeGerenciarUsuarios).toBe(false);
  });

  it('não administra módulo que não está liberado', () => {
    const regras = calcularRegrasAcesso('Funcionario', [], ['treinamentos'], ['documentos']);
    expect(regras.modulosAdministrados).toEqual([]);
  });

  it('administraModulo considera o Administrador global', () => {
    expect(administraModulo('Administrador', [], 'licitacoes')).toBe(true);
    expect(administraModulo('Editor', ['licitacoes'], 'licitacoes')).toBe(true);
    expect(administraModulo('Editor', ['licitacoes'], 'documentos')).toBe(false);
  });
});
