import {
  CATALOGO_SERVIDORES_PADRAO,
  aplicarCatalogoServidores,
  ALERTAS_PADRAO,
  analisarServidor,
  necessidadeDe
} from './servidores';

import {
  ISelecaoKit,
  IPontoKit,
  montarBom,
  novoPonto,
  softwaresPadrao
} from './montadorBom';

// ============================================================
// TESTE — seleção de servidor (complemento de nov/2026)
// ============================================================

const torre = (v: number, o: number, interfone: boolean, qtd = 1): IPontoKit =>
  ({ ...novoPonto('torre', 1), id: `t${v}${o}${interfone}${qtd}`, nome: `T${v}${o}${qtd}`, quantidade: qtd, camerasVideo: v, camerasOcr: o, safeWay: o > 0, comunicacaoBidirecional: interfone });

describe('servidor da central', () => {

  beforeEach(() => aplicarCatalogoServidores(CATALOGO_SERVIDORES_PADRAO, ALERTAS_PADRAO));

  it('necessidade arredonda sempre para cima', () => {
    expect(necessidadeDe(35, 10)).toBe(39);
    expect(necessidadeDe(10, 10)).toBe(11);
    expect(necessidadeDe(20, 0)).toBe(20);
    expect(necessidadeDe(20, 10, 25)).toBe(25);
  });

  it('Safe City sem IPX: nuvem, sem servidor', () => {
    const r = analisarServidor(undefined, { vms: 'safeCity', ipx: false, usaWAccess: false, v: 20, p: 0, l: 5 });
    expect(r.local).toBe('nuvem');
    expect(r.itens.length).toBe(0);
  });

  it('Digifort + IPX com 35 câmeras: combinado de 40, GPU automática, processador a escolher', () => {
    const r = analisarServidor({ reservaPct: 10 }, { vms: 'digifort', ipx: true, usaWAccess: false, v: 33, p: 2, l: 10 });
    expect(r.modo).toBe('combinado');
    const c = r.conjuntos[0];
    expect(c.base).toBe(35);           // V + P, sem LPR
    expect(c.necessidade).toBe(39);
    expect(c.linha && c.linha.capacidade).toBe(40);
    expect(c.gpu).toBe('NVIDIA RTX 5060 Ti');
    expect(c.automatico.gpu).toBe(true);
    expect(c.pendente).toBe('processador');
    expect(c.faixas.filter(f => !f.habilitada).map(f => f.capacidade)).toEqual([10, 20, 30]);
  });

  it('combinado definido gera servidor (sem CIGAM = pendente) e SO, com alerta de SO fora do suporte', () => {
    const r = analisarServidor(
      { reservaPct: 10, combinado: { processador: 'Intel Xeon 6505P' } },
      { vms: 'digifort', ipx: true, usaWAccess: false, v: 33, p: 2, l: 0 });
    expect(r.definido).toBe(true);
    expect(r.itens[0].descricao).toContain('[SRV-DGFIPX-040]');
    expect(r.itens[0].pendente).toBe(true);
    expect(r.alertas.map(a => a.regra)).toEqual(expect.arrayContaining(['semCigam', 'soForaSuporte']));
  });

  it('acima de 50 câmeras: servidores separados', () => {
    const r = analisarServidor({ reservaPct: 10 }, { vms: 'digifort', ipx: true, usaWAccess: false, v: 60, p: 0, l: 0 });
    expect(r.modo).toBe('separado');
    expect(r.conjuntos.map(c => c.papel)).toEqual(['gravacao', 'analitico']);
  });

  it('H.265 no Digifort reduz o armazenamento à metade', () => {
    const r = analisarServidor(
      { reservaPct: 0, compressao: 'H.265', combinado: { processador: 'Intel Xeon 6325P', so: 'Windows 10 Pro' } },
      { vms: 'digifort', ipx: true, usaWAccess: false, v: 20, p: 0, l: 0 });
    expect(r.conjuntos[0].armazenamentoTb).toBe(9.5);
    expect(r.alertas.map(a => a.regra)).toContain('h265Digifort');
  });

  it('Milestone: 1 licença por câmera e Care Plus pelo prazo; prazo irregular vira cotação', () => {
    const r36 = analisarServidor(undefined, { vms: 'milestone', ipx: false, usaWAccess: false, v: 18, p: 2, l: 4, prazoContratoMeses: 36 });
    expect(r36.itens.filter(i => i.chave === 'milestoneLicenca')[0].quantidade).toBe(20);
    expect(r36.itens.filter(i => i.chave === 'milestoneCare3')[0].quantidade).toBe(20);
    const r24 = analisarServidor(undefined, { vms: 'milestone', ipx: false, usaWAccess: false, v: 18, p: 2, l: 4, prazoContratoMeses: 24 });
    expect(r24.carePlus && r24.carePlus.cotacao).toBe(true);
    expect(r24.itens.some(i => i.pendente && /cotação pendente/.test(i.descricao))).toBe(true);
    // Sem linha ativa de Milestone no catálogo padrão: bloqueio.
    expect(r24.alertas.map(a => a.regra)).toContain('semLinhaCatalogo');
  });

  it('no B.O.M.: porteiro entra na base e Digifort usa 1 base por servidor do seletor', () => {
    const sel: ISelecaoKit = {
      versao: 1,
      pontos: [torre(2, 1, true, 3)],
      softwares: { ...softwaresPadrao(), vms: 'digifort', ipx: true },
      servidor: { reservaPct: 10, combinado: { processador: 'Intel Xeon Bronze 3106', so: 'Windows 10 Pro' } }
    };
    const r = montarBom(sel);
    expect(r.totais.porteiros).toBe(3);
    expect(r.servidor.baseGravacao).toBe(9);   // 6 vídeo + 3 porteiros
    expect(r.servidor.conjuntos[0].linha && r.servidor.conjuntos[0].linha.capacidade).toBe(10);
    expect(r.itens.filter(i => i.codigo === '625.001.0012')[0].quantidade).toBe(1);
  });
});
