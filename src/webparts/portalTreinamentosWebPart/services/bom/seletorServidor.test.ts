import {
  ILinhaServidor,
  aplicarServidores,
  restaurarServidoresPadrao,
  servidoresPadrao
} from './catalogoServidores';

import {
  IContagemCameras,
  ISelecaoServidor,
  avaliarServidor,
  concluirServidor,
  licencasDigifortPorNecessidade,
  necessidadeDe,
  responder,
  selecaoServidorVazia
} from './seletorServidor';

import {
  csvDasLinhas,
  linhasDoCsv
} from './planilhaServidores';

import {
  ISelecaoKit,
  avaliarServidorDoProjeto,
  montarBom,
  novoPonto,
  softwaresPadrao
} from './montadorBom';

// ============================================================
// TESTE — seleção de servidor (spec-complemento-servidores.md)
//
// As linhas do memorial são preenchidas aqui com valores FICTÍCIOS:
// o que se testa é a regra, não o dado da planilha.
// ============================================================

const preencher = (linha: ILinhaServidor): ILinhaServidor => ({
  ...linha,
  qtdServidores: linha.qtdServidores || 1,
  processadores: linha.software === 'digifort' && linha.capacidade === 70 ? ['Xeon Silver 4310', 'Xeon Silver 3106'] : ['Xeon Silver 4310'],
  ram: '32 GB',
  armazServidorTb: linha.finalidade === 'gravacao' ? 40 : 0,
  armazTotalTb: linha.finalidade === 'gravacao' ? 40 * (linha.qtdServidores || 1) : 0,
  gpus: linha.software === 'ipx' ? ['RTX 4000'] : [],
  sistemas: ['Windows Server 2022'],
  discosQtd: linha.software === 'milestone' ? 4 : 0,
  discoTamanhoTb: linha.software === 'milestone' ? 10 : 0,
  licencas: linha.software === 'digifort' ? [{ codigo: 'DGFEN1008V7', qtd: linha.qtdServidores || 1 }, { codigo: 'DGFEN1164V7', qtd: 1 }] : []
});

beforeEach(() => {
  const p = servidoresPadrao();
  aplicarServidores({ linhas: p.linhas.map(preencher), softwares: p.softwares });
});

afterAll(() => restaurarServidoresPadrao());

const contagem = (video: number, lpr = 0, porteiros = 0, mp = 4): IContagemCameras =>
  ({ video, lpr, porteiros, modelosVideo: video > 0 ? [{ modelo: 'Câmera X', mp, quantidade: video }] : [] });

const premissasOk = (estado: ISelecaoServidor, software: 'digifort' | 'milestone' | 'ipx'): ISelecaoServidor => {
  const itens = software === 'ipx' ? ['FPS'] : ['FPS', 'Gravação', 'Taxa por câmera', 'Qualidade'];
  const premissas: Record<string, boolean> = {};
  itens.forEach(i => { premissas[i] = true; });
  return responder(estado, 'premissas', { premissas });
};

describe('seletor de servidor', () => {

  it('o catálogo padrão tem 43 linhas: 21 Digifort, 11 Milestone, 11 IPX', () => {
    const p = servidoresPadrao();
    expect(p.linhas.length).toBe(43);
    expect(p.linhas.filter(l => l.software === 'digifort').length).toBe(21);
    expect(p.linhas.filter(l => l.software === 'milestone').length).toBe(11);
    expect(p.linhas.filter(l => l.software === 'ipx').length).toBe(11);
    expect(p.linhas.map(l => l.chave)).toContain('SRV-DGF-070-A');
    expect(p.linhas.map(l => l.chave)).toContain('SRV-DGF-400-C');
    expect(p.linhas.map(l => l.chave)).toContain('SRV-MIL-150');
  });

  it('necessidade com reserva arredonda para cima', () => {
    expect(necessidadeDe(100, 10)).toBe(110);
    expect(necessidadeDe(61, 10)).toBe(68);
    expect(necessidadeDe(55, 0)).toBe(55);
  });

  it('Safe City no projeto: nuvem, sem servidor de gravação', () => {
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'safeCity', ipx: false, contagem: contagem(40) });
    expect(av.status).toBe('nuvem');
    expect(av.itens.length).toBe(0);
  });

  it('faixa recomendada é a menor que comporta; menores ficam desabilitadas', () => {
    let estado = premissasOk(selecaoServidorVazia('digifort'), 'digifort');
    estado = responder(estado, 'compressao', { compressao: 'H.264' });
    estado = responder(estado, 'cameras', { camerasConfirmadas: true });
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'digifort', ipx: false, estado, contagem: contagem(55, 6) });
    // (55 + 6) × 1,1 = 67,1 → 68
    expect(av.necessidade).toBe(68);
    expect(av.faixaRecomendada).toBe(70);
    expect(av.faixas.filter(f => f.capacidade === 60)[0].habilitada).toBe(false);
    expect(av.faixas.filter(f => f.capacidade === 80)[0].folga).toBe(12);
  });

  it('LPR fica fora da base do analítico', () => {
    const av = avaliarServidor({ finalidade: 'analitico', vms: 'digifort', ipx: true, contagem: contagem(30, 20) });
    expect(av.base).toBe(30);
  });

  it('70 B do Digifort: 2 servidores, 2 licenças base, packs pela necessidade', () => {
    let estado = premissasOk(selecaoServidorVazia('digifort'), 'digifort');
    estado = responder(estado, 'compressao', { compressao: 'H.265' });
    estado = responder(estado, 'cameras', { camerasConfirmadas: true, reservaPct: 0 });
    estado = responder(estado, 'opcao', { chaveLinha: 'SRV-DGF-070-B' });
    estado = responder(estado, 'processador', { processador: 'Xeon Silver 4310' });
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'digifort', ipx: false, estado, contagem: contagem(66) });
    expect(av.status).toBe('pronto');
    expect(av.linha && av.linha.qtdServidores).toBe(2);
    const servidor = av.itens.filter(i => i.categoria === 'Equipamento')[0];
    expect(servidor.quantidade).toBe(2);
    const base = av.itens.filter(i => i.descricao === 'DGFEN1008V7')[0];
    expect(base.quantidade).toBe(2);
    // 66 câmeras em 2 servidores: 33 cada → 8 da base + pack 32 em cada.
    expect(av.itens.filter(i => i.descricao === 'DGFEN1132V7')[0].quantidade).toBe(2);
    // H.265 no Digifort: metade do armazenamento.
    expect(av.armazenamentoTotalTb).toBe(40);
  });

  it('licenças por necessidade: 310 câmeras em 1 servidor não compram 400', () => {
    const lic = licencasDigifortPorNecessidade(310, 1);
    const total = 8 + lic.filter(l => l.codigo !== 'DGFEN1008V7').reduce((s, l) => s + l.qtd * Number(l.codigo.substring(7, 9)), 0);
    expect(total).toBeGreaterThanOrEqual(310);
    expect(total).toBeLessThan(400);
  });

  it('premissa de resolução: câmera de 5 MP trava a conclusão', () => {
    let estado = premissasOk(selecaoServidorVazia('milestone'), 'milestone');
    estado = responder(estado, 'cameras', { camerasConfirmadas: true });
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'milestone', ipx: false, estado, contagem: contagem(20, 0, 0, 5) });
    expect(av.status).toBe('pendente');
    expect(av.alertas.some(a => a.nivel === 'bloqueio' && /Resolução/.test(a.texto))).toBe(true);
  });

  it('acima da maior faixa: bloqueio', () => {
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'milestone', ipx: false, contagem: contagem(200) });
    expect(av.alertas.some(a => a.nivel === 'bloqueio' && /maior faixa/.test(a.texto))).toBe(true);
  });

  it('alterar um passo apaga os seguintes e desfaz a conclusão', () => {
    let estado = premissasOk(selecaoServidorVazia('digifort'), 'digifort');
    estado = responder(estado, 'compressao', { compressao: 'H.264' });
    estado = responder(estado, 'cameras', { camerasConfirmadas: true, ajusteManual: 90 });
    estado = { ...estado, chaveLinha: 'SRV-DGF-090-A', concluido: true };
    const novo = responder(estado, 'compressao', { compressao: 'H.265' });
    expect(novo.camerasConfirmadas).toBe(false);
    expect(novo.ajusteManual).toBeUndefined();
    expect(novo.chaveLinha).toBeUndefined();
    expect(novo.concluido).toBe(false);
    expect(Object.keys(novo.premissas).length).toBe(4);
  });

  it('alerta de tabela por conteúdo: Xeon Silver 3106', () => {
    let estado = premissasOk(selecaoServidorVazia('digifort'), 'digifort');
    estado = responder(estado, 'compressao', { compressao: 'H.264' });
    estado = responder(estado, 'cameras', { camerasConfirmadas: true, reservaPct: 0 });
    estado = responder(estado, 'opcao', { chaveLinha: 'SRV-DGF-070-A' });
    estado = responder(estado, 'processador', { processador: 'Xeon Silver 3106' });
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'digifort', ipx: false, estado, contagem: contagem(65) });
    expect(av.alertas.some(a => a.nivel === 'aviso' && /3106/.test(a.texto))).toBe(true);
  });

  it('concluir grava a necessidade; pontos que mudam pedem revisão', () => {
    let estado = premissasOk(selecaoServidorVazia('milestone'), 'milestone');
    estado = responder(estado, 'cameras', { camerasConfirmadas: true });
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'milestone', ipx: false, estado, contagem: contagem(20) });
    expect(av.status).toBe('pronto');
    const concluido = concluirServidor(av) as ISelecaoServidor;
    expect(concluido.concluido).toBe(true);
    const depois = avaliarServidor({ finalidade: 'gravacao', vms: 'milestone', ipx: false, estado: concluido, contagem: contagem(21) });
    expect(depois.status).toBe('revisar');
    // Milestone: discos × servidores e licença por câmera da necessidade.
    expect(av.itens.filter(i => /Disco/.test(i.descricao))[0].quantidade).toBe(4);
    expect(av.itens.filter(i => i.chaveItem === 'milestoneXprotect')[0].quantidade).toBe(22);
  });

  it('trocar o VMS invalida as respostas', () => {
    const estado = premissasOk(selecaoServidorVazia('digifort'), 'digifort');
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'milestone', ipx: false, estado, contagem: contagem(20) });
    expect(Object.keys(av.estado.premissas).length).toBe(0);
  });

  it('linha sem dados do memorial não pode ser escolhida', () => {
    restaurarServidoresPadrao();
    const av = avaliarServidor({ finalidade: 'gravacao', vms: 'digifort', ipx: false, contagem: contagem(20) });
    expect(av.faixas.every(f => !f.habilitada)).toBe(true);
    expect(av.alertas.some(a => a.nivel === 'bloqueio')).toBe(true);
  });
});

describe('montador de B.O.M. com o seletor de servidor', () => {

  const projeto = (vms: 'digifort' | 'safeCity'): ISelecaoKit => ({
    versao: 1,
    pontos: [{ ...novoPonto('torre', 1), id: 't', nome: 'Torre', quantidade: 10, camerasVideo: 2, camerasOcr: 1, safeWay: true }],
    softwares: { ...softwaresPadrao(), vms }
  });

  it('Digifort sem seleção de servidor: erro e nenhuma licença de VMS', () => {
    const r = montarBom(projeto('digifort'));
    expect(r.alertas.some(a => a.nivel === 'erro' && a.origem === 'Servidor de gravação')).toBe(true);
    expect(r.itens.some(i => /DGFEN/.test(i.descricao))).toBe(false);
  });

  it('Digifort com servidor na central: servidor e licenças entram uma vez só', () => {
    const sel = projeto('digifort');
    // 20 vídeo + 10 LPR = 30 → 33 com reserva → faixa 40.
    let estado = premissasOk(selecaoServidorVazia('digifort'), 'digifort');
    estado = responder(estado, 'compressao', { compressao: 'H.264' });
    estado = responder(estado, 'cameras', { camerasConfirmadas: true });
    sel.servidores = { gravacao: estado };
    const av = avaliarServidorDoProjeto(sel, 'gravacao');
    expect(av.necessidade).toBe(33);
    sel.servidores = { gravacao: concluirServidor(av) as ISelecaoServidor };
    const r = montarBom(sel);
    expect(r.alertas.filter(a => a.nivel === 'erro')).toEqual([]);
    expect(r.itens.filter(i => i.codigo === '625.001.0012').reduce((s2, i) => s2 + i.quantidade, 0)).toBe(1);
    expect(r.itens.some(i => /Servidor de gravação Digifort · 40 câmeras/.test(i.descricao))).toBe(true);
  });

  it('Safe City: sem servidor e sem erro de servidor', () => {
    const r = montarBom(projeto('safeCity'));
    expect(r.alertas.some(a => a.origem === 'Servidor de gravação')).toBe(false);
  });
});

describe('planilha dos memoriais (CSV)', () => {

  it('modelo baixado e reimportado sem mudança não altera nada', () => {
    const linhas = servidoresPadrao().linhas;
    const r = linhasDoCsv(csvDasLinhas(linhas), linhas);
    expect(r.erros).toEqual([]);
    expect(r.linhas.length).toBe(0);
  });

  it('preenche a linha pela chave, com listas e licenças', () => {
    const linhas = servidoresPadrao().linhas;
    const csv = 'chave;qtd_servidores;processadores;ram;armaz_total_tb;licencas;codigo_cigam\r\n' +
      'SRV-DGF-070-B;2;"Xeon Silver 4310 | Xeon Gold 5315Y";64 GB;"120,5";DGFEN1008V7=2 | DGFEN1132V7=2;123456';
    const r = linhasDoCsv(csv, linhas);
    expect(r.erros).toEqual([]);
    expect(r.alteradas).toEqual(['SRV-DGF-070-B']);
    const l = r.linhas[0];
    expect(l.processadores).toEqual(['Xeon Silver 4310', 'Xeon Gold 5315Y']);
    expect(l.armazTotalTb).toBe(120.5);
    expect(l.licencas).toEqual([{ codigo: 'DGFEN1008V7', qtd: 2 }, { codigo: 'DGFEN1132V7', qtd: 2 }]);
    expect(l.codigoCigam).toBe('123456');
    expect(l.alertas.length).toBe(1);
  });
});
