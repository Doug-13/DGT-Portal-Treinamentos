import {
  aplicarCatalogo,
  catalogoPadrao,
  restaurarCatalogoPadrao
} from './catalogoKits';

import {
  IAlteracaoItemKit,
  ISelecaoKit,
  IPontoKit,
  historicoAlteracoes,
  montarBom,
  novoPonto,
  softwaresPadrao
} from './montadorBom';

// ============================================================
// TESTE — montador de B.O.M. com a composição da aba Kits
//
// Os valores esperados são os do montador ANTES da aba Kits (regras
// fixas no código). O kit-base agora vem de COMPOSICAO_KITS, e o
// resultado com o catálogo padrão precisa ser o mesmo.
// ============================================================

const ponto = (tipo: IPontoKit['tipo'], parcial: Partial<IPontoKit>): IPontoKit =>
  ({ ...novoPonto(tipo, 1), id: tipo, nome: tipo, ...parcial });

const selecao = (...pontos: IPontoKit[]): ISelecaoKit =>
  ({ versao: 1, pontos, softwares: softwaresPadrao() });

const qtd = (sel: ISelecaoKit, codigo: string): number =>
  montarBom(sel).itens.filter(i => i.codigo === codigo).reduce((soma, i) => soma + i.quantidade, 0);

describe('montador de B.O.M. — kit-base pela composição', () => {

  afterEach(() => restaurarCatalogoPadrao());

  it('Torre com 2 vídeo + 1 OCR e interfone: igual às regras anteriores', () => {
    const sel = selecao(ponto('torre', { camerasVideo: 2, camerasOcr: 1, safeWay: true, comunicacaoBidirecional: true }));
    expect(qtd(sel, '6300050083')).toBe(1);   // estrutura
    expect(qtd(sel, '4200050022')).toBe(2);   // suporte vídeo: por câmera de vídeo
    expect(qtd(sel, '4200050008')).toBe(1);   // suporte OCR: por câmera OCR
    expect(qtd(sel, '6100050079')).toBe(2);   // câmera adicional: total − 1
    expect(qtd(sel, '4600010002')).toBe(6);   // adesivo câmera: 2 por câmera
    expect(qtd(sel, '3700010044')).toBe(5);   // fontes: 3 câmeras + giroled + interfone
    expect(qtd(sel, '5500010274')).toBe(1);   // porteiro (opcional)
  });

  it('Porta dutotec de vidro sem W-Access: sem serviço e sem UTP', () => {
    const sel = selecao(ponto('portaDutotec', { portaVidro: true, usaWAccess: false }));
    expect(qtd(sel, '4200990045')).toBe(1);   // suporte p/ vidro
    expect(qtd(sel, '3500300005')).toBe(10);  // parafusos
    expect(qtd(sel, '6100050026')).toBe(0);   // serviço de instalação
    expect(qtd(sel, '3200010005')).toBe(0);   // cabo UTP
  });

  it('aplicar o catálogo padrão não muda nada', () => {
    const sel = selecao(ponto('torre', {}), ponto('mini', { camerasVideo: 1, camerasOcr: 1 }), ponto('portaEletroduto', {}), ponto('catraca', { catracas: 2, catracasPne: 1 }));
    const antes = JSON.stringify(montarBom(sel));
    aplicarCatalogo(catalogoPadrao(), 'dataverse');
    expect(JSON.stringify(montarBom(sel))).toBe(antes);
  });

  it('composição e código alterados na aba Kits valem para o montador', () => {
    const dados = catalogoPadrao();
    dados.itens = [{ chave: 'giroled', codigo: '999', descricao: 'Giroled novo', categoria: 'Infraestrutura', ativo: true }];
    dados.composicoes = { box: [{ chaveItem: 'giroled', quantidade: 2, regra: 'porCamera', condicao: 'sempre' }] };
    aplicarCatalogo(dados, 'dataverse');
    const sel = selecao(ponto('box', { camerasVideo: 2 }));
    expect(qtd(sel, '999')).toBe(4);
    expect(qtd(sel, '6300050085')).toBe(0);   // estrutura do Box saiu da composição
  });

  it('rascunho (opções) não altera o catálogo em uso', () => {
    const sel = selecao(ponto('box', { camerasVideo: 2 }));
    const simulado = montarBom(sel, { composicoes: { box: [] } });
    expect(simulado.itens.some(i => i.codigo === '6300050085')).toBe(false);
    expect(qtd(sel, '6300050085')).toBe(1);
  });
});

describe('montador de B.O.M. — trocar e cancelar itens do kit', () => {

  const FONTE = '3700010044';
  const fonte = { codigo: FONTE, descricao: 'DGT fonte chaveada de mesa 12V DC 3,5A', categoria: 'Infraestrutura' as const };
  const nova = { codigo: '123', descricao: 'Fonte nova', categoria: 'Infraestrutura' as const };
  const alteracao = (parcial: Partial<IAlteracaoItemKit>): IAlteracaoItemKit => ({
    id: 'a1', acao: 'substituir', removido: fonte, adicionado: nova, motivo: 'teste', por: 'Fulano', em: '2026-11-24T12:00:00.000Z', ...parcial
  });

  it('substituir: sai o item, entra o novo com a mesma quantidade (× pontos iguais)', () => {
    const sel = selecao(ponto('torre', { quantidade: 2, alteracoes: [alteracao({})] }));
    expect(qtd(sel, FONTE)).toBe(0);
    expect(qtd(sel, '123')).toBe(6);  // 2 câmeras + giroled = 3 por ponto × 2
    const hist = historicoAlteracoes(montarBom(sel));
    expect(hist.length).toBe(1);
    expect(hist[0].situacao).toBe('aplicada');
    expect(hist[0].quantidadeRemovida).toBe(6);
    expect(hist[0].quantidadeAdicionada).toBe(6);
    expect(montarBom(sel).itens.filter(i => i.codigo === '123')[0].substituto).toBe(true);
  });

  it('substituir com quantidade própria e só cancelar', () => {
    expect(qtd(selecao(ponto('torre', { alteracoes: [alteracao({ quantidadePorPonto: 1 })] })), '123')).toBe(1);
    const sel = selecao(ponto('torre', { alteracoes: [alteracao({ acao: 'remover', adicionado: undefined })] }));
    expect(qtd(sel, FONTE)).toBe(0);
    expect(qtd(sel, '123')).toBe(0);
  });

  it('desfeita: o item volta e a alteração fica no histórico', () => {
    const sel = selecao(ponto('torre', { alteracoes: [alteracao({ desfeita: { por: 'Ciclano', em: '2026-11-24T13:00:00.000Z' } })] }));
    expect(qtd(sel, FONTE)).toBe(3);
    expect(qtd(sel, '123')).toBe(0);
    expect(historicoAlteracoes(montarBom(sel))[0].situacao).toBe('desfeita');
  });

  it('item que não está mais no kit: não aplicada, com aviso', () => {
    const fora = { codigo: '000', descricao: 'Item que não existe', categoria: 'Infraestrutura' as const };
    const resultado = montarBom(selecao(ponto('torre', { alteracoes: [alteracao({ removido: fora })] })));
    expect(historicoAlteracoes(resultado)[0].situacao).toBe('naoAplicada');
    expect(resultado.alertas.some(a => a.mensagem.indexOf('não aplicada') >= 0)).toBe(true);
    expect(resultado.itens.some(i => i.codigo === '123')).toBe(false);
  });
});
