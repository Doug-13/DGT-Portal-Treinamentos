import {
  VigentesHH,
  envelopeDoHH,
  kitDoRegistro,
  lerCusto
} from './calculoHHEnvelope';

import {
  envelopeDoMontador
} from './montadorBomEnvelope';

import {
  gravarEnvelopeComponente
} from '../../../services/fluxo/valorComponente';

import {
  validarParametrosNativo
} from '../../../services/fluxo/componentesNativos';

import {
  IDadosHH,
  dadosVazios
} from '../../../services/hh/modeloHH';

import {
  IVersaoHH
} from '../../../services/hh/HHService';

import {
  IPontoKit,
  novoPonto,
  softwaresPadrao
} from '../../../services/bom/montadorBom';

// ============================================================
// TESTES — componente nativo "Cálculo de HH"
// Mesmos dados fictícios de services/hh/calculoHH.test.ts
// (HH por ponto = 15.900 / 42).
// ============================================================

const dadosHH = (): IDadosHH => {
  const d = dadosVazios('implantacao', 'Implantação');
  d.meses = ['ago/26', 'set/26'];
  d.premissas = { ...d.premissas, mesReferencia: 'set/26', mesesDiluicao: 12, headcountInterno: 10, pontosPorDia: 2, pessoasEquipeCampo: 2, hhReferenciaRh: 40 };
  d.quadroPO = [{ id: 'q1', familia: 'Técnicos', posicoes: 4, salarioTotal: 12000 }];
  d.equipeCampo = [
    { id: 'e1', item: 'Veículo', tipo: 'Recorrente', valor: 4000, quantidade: 1, maoDeObra: false },
    { id: 'e2', item: 'Notebook', tipo: '1° mês', valor: 6000, quantidade: 1, maoDeObra: false },
    { id: 'e3', item: 'Técnico Pleno', tipo: 'Recorrente', valor: 0, familiaVinculada: 'Técnicos', quantidade: 2, maoDeObra: true }
  ];
  d.custos = [
    { id: 'c1', item: 'Salários', grupo: 'Pessoal', valores: { 'ago/26': 0, 'set/26': 33000 } },
    { id: 'c2', item: 'Combustível', grupo: 'Veículos', valores: { 'set/26': 3000 } }
  ];
  return d;
};

const vigentes: VigentesHH = {
  implantacao: { versao: { id: 'ver-impl-3', versao: 3, mesReferencia: 'set/26' } as IVersaoHH, dados: dadosHH() }
};

const ponto = (parcial: Partial<IPontoKit>): IPontoKit => ({ ...novoPonto('mini', 1), id: 'p1', nome: 'Ponto 1', ...parcial });

const valorKit = (pontos: IPontoKit[]): string =>
  gravarEnvelopeComponente(envelopeDoMontador({ versao: 1, pontos, softwares: softwaresPadrao() }));

describe('Componente nativo: Cálculo de HH', () => {

  it('lê os pontos da Seleção de kit do registro', () => {
    const kit = kitDoRegistro(valorKit([ponto({ camerasVideo: 2 }), { ...ponto({ camerasVideo: 1 }), id: 'p2', nome: 'Ponto 2' }]));
    expect(kit.pontos).toBe(2);
    expect(kit.valida).toBe(true);
    expect(kit.resumo).toMatch(/2 ponto\(s\) · 3 câmera\(s\) de vídeo/);
    expect(kitDoRegistro('').pontos).toBe(0);
  });

  it('aplica o HH vigente (mesmo cálculo da Arquitetura) e grava a versão usada', () => {
    const kit = kitDoRegistro(valorKit([ponto({ camerasVideo: 2 })]));
    const envelope = envelopeDoHH(kit, 200000, vigentes, true);
    expect(envelope.erros).toEqual([]);
    expect(envelope.valido).toBe(true);
    const dados = envelope.dados as { areas: Array<{ versaoId: string; versao: number; hhPontos: number; valorSuprimentos: number }>; totalHHPontos: number };
    expect(dados.areas[0].versaoId).toBe('ver-impl-3');
    expect(dados.areas[0].hhPontos).toBeCloseTo(15900 / 42, 6);
    expect(dados.areas[0].valorSuprimentos).toBeCloseTo(1000, 6);
    expect(envelope.resumo).toMatch(/1 ponto\(s\) · Implantação v3/);
  });

  it('bloqueia o Concluir sem kit, sem HH publicado ou sem custo exigido', () => {
    expect((envelopeDoHH(kitDoRegistro(''), 0, vigentes, false).erros || []).join(' ')).toMatch(/não tem pontos/);
    expect((envelopeDoHH(kitDoRegistro(valorKit([ponto({ camerasVideo: 3 })])), 0, vigentes, false).erros || []).join(' ')).toMatch(/tem erros/);
    const kit = kitDoRegistro(valorKit([ponto({ camerasVideo: 2 })]));
    expect((envelopeDoHH(kit, 0, {}, false).erros || []).join(' ')).toMatch(/Nenhuma área com HH publicado/);
    expect((envelopeDoHH(kit, 0, vigentes, true).erros || []).join(' ')).toMatch(/custo total/);
    expect(envelopeDoHH(kit, 0, vigentes, false).valido).toBe(true);
  });

  it('lê o custo em formato brasileiro ou numérico', () => {
    expect(lerCusto('250.000,50')).toBe(250000.5);
    expect(lerCusto('250000.5')).toBe(250000.5);
    expect(lerCusto('')).toBe(0);
    expect(lerCusto('abc')).toBe(0);
  });

  it('valida o parâmetro: precisa apontar para um campo do Montador de B.O.M.', () => {
    const metadados = [
      { chave: 'selecaoKit', tipo: 'componente', componente: { tipo: 'nativo', nativo: 'montadorBom' } },
      { chave: 'outro', tipo: 'componente', componente: { tipo: 'html' } },
      { chave: 'custo', tipo: 'numero' }
    ];
    expect(validarParametrosNativo('HH', { tipo: 'nativo', nativo: 'calculoHH', parametros: {} }, metadados).join(' ')).toMatch(/Campo com a Seleção de kit/);
    expect(validarParametrosNativo('HH', { tipo: 'nativo', nativo: 'calculoHH', parametros: { campoKit: 'outro' } }, metadados).join(' ')).toMatch(/montadorBom/);
    expect(validarParametrosNativo('HH', { tipo: 'nativo', nativo: 'calculoHH', parametros: { campoKit: 'selecaoKit', campoCusto: 'custo', exigirCusto: 'sim' } }, metadados)).toEqual([]);
    expect(validarParametrosNativo('HH', { tipo: 'nativo', nativo: 'calculoHH', parametros: { campoKit: 'selecaoKit', exigirCusto: 'talvez' } }, metadados).join(' ')).toMatch(/sim ou nao|nao ou sim/);
  });
});
