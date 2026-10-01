import {
  IProcesso
} from '../../models/Processo';

import {
  FluxoCatalogoLocal,
  idFluxoDoProcesso
} from './FluxoCatalogoLocal';

import {
  carregarDadosProcessos,
  criarProcessoTeste,
  processoPrincipalDoDocumento,
  vincularDocumentoPorCodigoTeste
} from '../processos/ProcessoService';

// ============================================================
// TESTES DO CATÁLOGO DE FLUXOS POR PROCESSO
// ============================================================

const processo = (
  id: string
): IProcesso => ({
  id,
  codigo: id.toUpperCase(),
  nome: `Processo ${id}`,
  ativo: true,
  origem: 'teste'
});

describe('FluxoCatalogoLocal', () => {

  it('cria o fluxo do processo como rascunho v1 a partir do modelo', async () => {

    const catalogo = new FluxoCatalogoLocal();

    const resultado =
      await catalogo.criarAPartirDoModelo(processo('p1'), 'modelo-revisao-pop');

    expect(resultado.ok).toBe(true);
    expect(resultado.definicao?.versao).toBe(1);
    expect(resultado.definicao?.status).toBe('rascunho');
    expect(resultado.definicao?.id).toBe(idFluxoDoProcesso('p1'));
    expect(await catalogo.versaoPublicada('p1')).toBeUndefined();
  });

  it('publica, cria nova versão e mantém a anterior acessível', async () => {

    const catalogo = new FluxoCatalogoLocal();

    const criado =
      await catalogo.criarAPartirDoModelo(processo('p2'), 'modelo-revisao-pop');

    // O modelo POP exige escolher a área da Qualidade antes de publicar.
    expect((await catalogo.publicarRascunho('p2')).ok).toBe(false);

    const rascunho =
      criado.definicao as NonNullable<typeof criado.definicao>;

    rascunho.elementos
      .filter(elemento => elemento.id === 'aprovacaoQualidade')[0]
      .responsaveis[0].referenciaId = 'area-qualidade';

    await catalogo.salvarRascunho(rascunho);

    expect((await catalogo.publicarRascunho('p2')).ok).toBe(true);

    const nova =
      await catalogo.criarNovaVersao('p2');

    expect(nova.definicao?.versao).toBe(2);

    // Não pode haver dois rascunhos.
    expect((await catalogo.criarNovaVersao('p2')).ok).toBe(false);

    expect((await catalogo.publicarRascunho('p2')).ok).toBe(true);

    const publicada =
      await catalogo.versaoPublicada('p2');

    expect(publicada?.versao).toBe(2);

    const antiga =
      await catalogo.obterVersao(idFluxoDoProcesso('p2'), 1);

    expect(antiga?.status).toBe('arquivado');
  });

  it('não altera versão publicada', async () => {

    const catalogo = new FluxoCatalogoLocal();

    await catalogo.criarAPartirDoModelo(processo('p3'), 'modelo-revisao-pop');
    await catalogo.publicarRascunho('p3');

    const publicada =
      await catalogo.versaoPublicada('p3');

    const resultado =
      await catalogo.salvarRascunho({
        ...(publicada as NonNullable<typeof publicada>),
        nome: 'alterado'
      });

    expect(resultado.ok).toBe(false);
  });

  it('não publica etapa sem responsável', async () => {

    const catalogo = new FluxoCatalogoLocal();

    const criado =
      await catalogo.criarAPartirDoModelo(processo('p4'), 'modelo-revisao-pop');

    const definicao =
      criado.definicao as NonNullable<typeof criado.definicao>;

    definicao.elementos
      .filter(elemento => elemento.tipo === 'tarefaHumana')[0]
      .responsaveis = [];

    await catalogo.salvarRascunho(definicao);

    const resultado =
      await catalogo.publicarRascunho('p4');

    expect(resultado.ok).toBe(false);
  });
});

describe('processoPrincipalDoDocumento', () => {

  it('usa o único vínculo ou o marcado como principal', () => {

    expect(
      processoPrincipalDoDocumento('D1', [
        { id: 'v1', documentoId: 'd1', processoId: 'p1', principal: false, origem: 'teste' }
      ])
    ).toBe('p1');

    expect(
      processoPrincipalDoDocumento('d1', [
        { id: 'v1', documentoId: 'd1', processoId: 'p1', principal: false, origem: 'teste' },
        { id: 'v2', documentoId: 'd1', processoId: 'p2', principal: false, origem: 'dataverse' }
      ])
    ).toBeUndefined();

    expect(
      processoPrincipalDoDocumento('d1', [
        { id: 'v1', documentoId: 'd1', processoId: 'p1', principal: false, origem: 'teste' },
        { id: 'v2', documentoId: 'd1', processoId: 'p2', principal: true, origem: 'dataverse' }
      ])
    ).toBe('p2');
  });
});

describe('vínculo feito na criação do documento (pelo código)', () => {

  it('liga ao documento quando ele aparece e o torna principal', async () => {

    const criado =
      criarProcessoTeste({ codigo: 'PRC-COD', nome: 'Compras', areaId: 'a1', areaNome: 'Suprimentos' }, []);

    expect(criado.ok).toBe(true);

    const processoId =
      (criado.processo as IProcesso).id;

    vincularDocumentoPorCodigoTeste('SUP-POP-001', processoId);

    // Antes de o documento existir, o vínculo não aparece.
    const antes =
      await carregarDadosProcessos(undefined, true, []);

    expect(antes.vinculos.some(item => item.processoId === processoId)).toBe(false);

    const depois =
      await carregarDadosProcessos(undefined, true, [{ id: '{ABC-123}', codigo: 'sup-pop-001' }]);

    const vinculo =
      depois.vinculos.find(item => item.processoId === processoId);

    expect(vinculo?.documentoId).toBe('abc-123');
    expect(vinculo?.principal).toBe(true);
    expect(depois.processos.find(item => item.id === processoId)?.areaNome).toBe('Suprimentos');
  });
});
