import {
  pendenciasComplementos,
  totalIntegracao,
  totalManutencao
} from './complementosHH';

import {
  AREAS_BOM,
  nomeAreaBom
} from './calculoHH';

// ============================================================
// TESTE — integração, contrato de manutenção e áreas no B.O.M.
// ============================================================

describe('complementos do Cálculo de HH', () => {

  it('integração: horas × valor HH × (1 + BDI); "Não" não soma', () => {
    expect(totalIntegracao({ tem: true, horas: 40, valorHora: 150, bdi: 25 })).toBe(7500);
    expect(totalIntegracao({ tem: true, horas: 40, valorHora: 150, bdi: 0 })).toBe(6000);
    expect(totalIntegracao({ tem: false, horas: 40, valorHora: 150, bdi: 25 })).toBe(0);
  });

  it('manutenção: pontos × valor do ponto (sem BDI)', () => {
    expect(totalManutencao({ tem: true, pontos: 5, valorPonto: 200 })).toBe(1000);
    expect(totalManutencao({ tem: false, pontos: 5, valorPonto: 200 })).toBe(0);
  });

  it('pendências: perguntas sem resposta ou "Sim" sem valores', () => {
    expect(pendenciasComplementos(undefined).length).toBe(2);
    expect(pendenciasComplementos({ integracao: { tem: false, horas: 0, valorHora: 0, bdi: 0 }, manutencao: { tem: false, pontos: 0, valorPonto: 0 } })).toEqual([]);
    expect(pendenciasComplementos({ integracao: { tem: true, horas: 0, valorHora: 10, bdi: 0 }, manutencao: { tem: false, pontos: 0, valorPonto: 0 } }).length).toBe(1);
  });

  it('áreas no B.O.M.: Implantação 7% e Supply 0,5%', () => {
    expect(AREAS_BOM.implantacao.pctFixo).toBe(0.07);
    expect(AREAS_BOM.suporte.pctFixo).toBe(0.005);
    expect(nomeAreaBom('suporte', 'Suporte')).toBe('Supply');
    expect(nomeAreaBom('terceira', 'Terceira área')).toBe('Terceira área');
  });
});
