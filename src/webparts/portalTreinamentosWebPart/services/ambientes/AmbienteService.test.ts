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
  layoutJson: '',
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

// ------------------------------------------------------------
// Fluxo existente: avisos de etapas próprias de documentos
// ------------------------------------------------------------

import {
  avisosFluxoAmbiente
} from './compatibilidadeFluxoAmbiente';

import {
  IFluxoDefinicao,
  IFluxoElemento
} from '../../models/Fluxo';

describe('Fluxo de documentos usado num ambiente', () => {

  const elemento = (parcial: Partial<IFluxoElemento>): IFluxoElemento => ({
    id: 'x', tipo: 'tarefaHumana', nome: 'Etapa', responsaveis: [], acoes: [], campos: [],
    posicao: { x: 0, y: 0, largura: 10, altura: 10 }, ...parcial
  });

  const definicao = (elementos: IFluxoElemento[]): IFluxoDefinicao => ({
    id: 'f', nome: 'Fluxo', versao: 1, status: 'publicado', processoId: 'p', tiposDocumento: [],
    larguraDiagrama: 100, alturaDiagrama: 100, elementos, transicoes: []
  });

  it('fluxo simples não gera avisos', () => {
    expect(avisosFluxoAmbiente(definicao([elemento({ tipo: 'inicio' }), elemento({}), elemento({ tipo: 'fim' })]))).toEqual([]);
  });

  it('lista as etapas próprias de documentos', () => {
    const avisos = avisosFluxoAmbiente(definicao([
      elemento({ nome: 'Elaborar', anexoArquivo: 'obrigatorio' }),
      elemento({ tipo: 'tarefaSistema', nome: 'Publicar', acaoSistema: 'publicarSemRetreinamento' }),
      elemento({ tipo: 'eventoRevisao', nome: 'Nova revisão' })
    ]));
    // "Anexo de arquivo" agora vale no ambiente (anexos do registro).
    expect(avisos).toHaveLength(2);
    expect(avisos.join(' ')).toMatch(/Publicar/);
    expect(avisos.join(' ')).not.toMatch(/Elaborar/);
  });
});
