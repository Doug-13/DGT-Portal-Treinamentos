import {
  filtrarColunas,
  formatarValorComponente,
  gravarEnvelopeComponente,
  lerEnvelopeComponente,
  montarConsultaFonte,
  validarComponente,
  validarConfigComponente
} from './valorComponente';

import {
  CHAVES_NATIVOS
} from './componentesNativos';

import {
  validarAcao
} from './FluxoEngine';

import {
  IFluxoElemento
} from '../../models/Fluxo';

import {
  envelopeDoMontador
} from '../../components/fluxo/componentes/montadorBomEnvelope';

import {
  montarDocumentoComponente
} from '../../components/fluxo/componentes/ComponenteHtml';

import {
  IPontoKit,
  ISelecaoKit,
  novoPonto,
  softwaresPadrao
} from '../bom/montadorBom';

import {
  restaurarCatalogoPadrao
} from '../bom/catalogoKits';

import {
  FONTES_EXEMPLO_KITS
} from '../../pages/Processos/EditorComponente';

// ============================================================
// TESTES — campo Componente (nativo e HTML)
// ============================================================

const ponto = (tipo: IPontoKit['tipo'], parcial: Partial<IPontoKit>): IPontoKit =>
  ({ ...novoPonto(tipo, 1), id: tipo, nome: 'Ponto 1', ...parcial });

const selecao = (...pontos: IPontoKit[]): ISelecaoKit =>
  ({ versao: 1, pontos, softwares: softwaresPadrao() });

describe('Componente nativo: Montador de B.O.M.', () => {

  afterEach(() => restaurarCatalogoPadrao());

  it('Wallfix com 2 câmeras (tela da Arquitetura): válido, com a lista de itens', () => {
    const envelope = envelopeDoMontador(selecao(ponto('mini', { camerasVideo: 2, camerasOcr: 0 })));
    expect(envelope.erros).toEqual([]);
    expect(envelope.valido).toBe(true);
    expect((envelope.itens || []).length).toBeGreaterThan(5);
    expect(envelope.resumo).toMatch(/1 ponto\(s\) · \d+ itens · 2 câm\. vídeo/);
  });

  it('erro do montador (Wallfix com 3 câmeras) bloqueia o Concluir', () => {
    const envelope = envelopeDoMontador(selecao(ponto('mini', { camerasVideo: 3, camerasOcr: 0 })));
    expect(envelope.valido).toBe(false);
    expect((envelope.erros || []).length).toBeGreaterThan(0);
    const valor = gravarEnvelopeComponente(envelope);
    expect(validarComponente('Seleção de kit', valor, true).length).toBeGreaterThan(0);
  });

  it('sem pontos não é válido', () => {
    const envelope = envelopeDoMontador(selecao());
    expect(envelope.valido).toBe(false);
    expect(envelope.erros).toContain('Adicione pelo menos um ponto.');
  });
});

describe('Campo Componente: envelope e etapa', () => {

  it('normaliza o que o componente manda (erros derrubam o "valido")', () => {
    const valor = gravarEnvelopeComponente({ dados: { x: 1 }, valido: true, erros: ['falta X'], resumo: 'R' });
    const lido = lerEnvelopeComponente(valor);
    expect(lido && lido.valido).toBe(false);
    expect(formatarValorComponente(valor)).toBe('R');
  });

  it('a etapa não conclui com componente inválido; obrigatório exige preenchimento', () => {
    const etapa = {
      id: 'kit', tipo: 'tarefaHumana', nome: 'Seleção de kit', responsaveis: [], acoes: [],
      campos: [{ chave: 'bom', rotulo: 'Seleção de kit', tipo: 'componente', obrigatorio: true }],
      posicao: { x: 0, y: 0, largura: 1, altura: 1 }
    } as unknown as IFluxoElemento;
    const acao = { chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false };
    expect(validarAcao(etapa, acao, '', {}).join(' ')).toMatch(/Preencha: Seleção de kit/);
    const invalido = gravarEnvelopeComponente({ valido: false, erros: ['O Wallfix aceita até 2 câmeras.'] });
    expect(validarAcao(etapa, acao, '', { bom: invalido }).join(' ')).toMatch(/até 2 câmeras/);
    const valido = gravarEnvelopeComponente({ valido: true, resumo: 'ok' });
    expect(validarAcao(etapa, acao, '', { bom: valido })).toEqual([]);
  });

  it('configuração: nativo existente; HTML com fontes válidas', () => {
    expect(validarConfigComponente('C', { tipo: 'nativo', nativo: 'montadorBom' }, CHAVES_NATIVOS)).toEqual([]);
    expect(validarConfigComponente('C', { tipo: 'nativo', nativo: 'naoExiste' }, CHAVES_NATIVOS).length).toBe(1);
    expect(validarConfigComponente('C', { tipo: 'html', html: '<b>x</b>', fontes: FONTES_EXEMPLO_KITS }, CHAVES_NATIVOS)).toEqual([]);
    expect(validarConfigComponente('C', { tipo: 'html', html: 'x', fontes: [{ nome: 'f', tabela: 'Tabela; drop', colunas: ['a'] }] }, CHAVES_NATIVOS).join(' ')).toMatch(/tabela inválida/);
  });
});

describe('Ponte do componente HTML', () => {

  const fonte = FONTES_EXEMPLO_KITS[0];

  it('só filtra colunas liberadas e escapa os valores', () => {
    const ok = montarConsultaFonte(fonte, { dgt_codigo: "31'00", dgt_chave: 'x' });
    expect(ok.erros).toEqual([]);
    expect(ok.consulta).toBe("$select=dgt_codigo,dgt_name,dgt_categoria,dgt_chave&$filter=(dgt_ativo eq true) and dgt_codigo eq '31''00' and dgt_chave eq 'x'&$orderby=dgt_ordem asc");
    expect(montarConsultaFonte(fonte, { dgt_senha: 'x' }).erros.join(' ')).toMatch(/não está liberada/);
  });

  it('devolve só as colunas liberadas', () => {
    expect(filtrarColunas(fonte, [{ dgt_codigo: '1', dgt_name: 'A', dgt_custo: 99, '@odata.etag': 'x' }]))
      .toEqual([{ dgt_codigo: '1', dgt_name: 'A' }]);
  });

  it('injeta tema e ponte em qualquer formato de HTML', () => {
    expect(montarDocumentoComponente('<b>oi</b>')).toMatch(/^<!DOCTYPE html><html><head>[\s\S]*window\.DGT[\s\S]*<body><b>oi<\/b><\/body>/);
    expect(montarDocumentoComponente('<html><head><title>t</title></head><body>x</body></html>')).toMatch(/<head><meta charset="utf-8">[\s\S]*window\.DGT[\s\S]*<title>t<\/title>/);
  });
});
