import {
  IAmbiente,
  INovoAmbiente
} from '../../models/Ambiente';

import {
  gerarChaveAmbiente,
  gerarPrefixoAmbiente,
  validarDadosAmbiente
} from './AmbienteService';

// ============================================================
// TESTES — cadastro de ambientes
// ============================================================

const dados = (parcial: Partial<INovoAmbiente>): INovoAmbiente => ({
  nome: 'Licitações',
  chave: 'licitacoes-publicas',
  descricao: '',
  subtitulo: '',
  icone: 'gavel',
  ordem: 10,
  liberadoParaTodos: false,
  perfisPadrao: [],
  prefixoCodigo: 'LIC',
  rotuloRegistro: 'Processo licitatório',
  ...parcial
});

const existente = (parcial: Partial<IAmbiente>): IAmbiente => ({
  id: 'a1',
  chave: 'compras',
  nome: 'Compras',
  descricao: '',
  subtitulo: '',
  icone: 'package',
  ordem: 10,
  ativo: true,
  liberadoParaTodos: false,
  perfisPadrao: [],
  processoId: 'p1',
  processoNome: 'Ambiente: Compras',
  prefixoCodigo: 'COM',
  rotuloRegistro: 'Pedido',
  ...parcial
});

describe('Cadastro de ambientes', () => {

  it('gera chave e prefixo a partir do nome', () => {
    expect(gerarChaveAmbiente('Licitações Públicas')).toBe('licitacoes-publicas');
    expect(gerarChaveAmbiente('  Jurídico & Contratos! ')).toBe('juridico-contratos');
    expect(gerarPrefixoAmbiente('Licitações Públicas')).toBe('LP');
    expect(gerarPrefixoAmbiente('Compras')).toBe('COM');
  });

  it('aceita um cadastro válido', () => {
    expect(validarDadosAmbiente(dados({}), [])).toEqual([]);
  });

  it('recusa chave reservada, inválida ou repetida (inclusive de ambiente desativado)', () => {
    expect(validarDadosAmbiente(dados({ chave: 'treinamentos' }), []).length).toBeGreaterThan(0);
    expect(validarDadosAmbiente(dados({ chave: 'Com Espaço' }), []).length).toBeGreaterThan(0);
    expect(validarDadosAmbiente(dados({ chave: 'compras' }), [existente({ ativo: false })]).length).toBeGreaterThan(0);
  });

  it('na edição não acusa a si mesmo como duplicado', () => {
    const atual = existente({});
    expect(validarDadosAmbiente(dados({ nome: 'Compras', chave: 'compras', prefixoCodigo: 'COM' }), [atual], atual.id)).toEqual([]);
  });

  it('exige prefixo e nome do registro', () => {
    expect(validarDadosAmbiente(dados({ prefixoCodigo: 'l' }), []).length).toBeGreaterThan(0);
    expect(validarDadosAmbiente(dados({ rotuloRegistro: ' ' }), []).length).toBeGreaterThan(0);
  });
});
