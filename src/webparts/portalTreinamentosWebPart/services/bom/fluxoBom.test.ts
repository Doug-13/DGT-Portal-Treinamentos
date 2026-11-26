// Testes rodam no Node (Jest); o projeto não inclui @types/node.
declare const require: (modulo: string) => unknown;
declare const __dirname: string;
const fs = require('fs') as { readFileSync: (caminho: string, codificacao: string) => string };
const path = require('path') as { join: (...partes: string[]) => string };

import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  IReferenciasPacote,
  interpretarPacote
} from '../pacoteProcesso/pacoteProcesso';

import {
  aplicarMetadadosNaDefinicao
} from '../processos/MetadadosProcessoService';

import {
  adicionarDiasUteis,
  executarAcao,
  iniciarInstancia
} from '../fluxo/FluxoEngine';

import {
  gravarEnvelopeComponente
} from '../fluxo/valorComponente';

import {
  lerValorUsuario
} from '../fluxo/valorUsuario';

import {
  IAnaliseGoNoGo,
  IBomRegistro,
  IDemandaBom
} from './BomService';

import {
  ISelecaoKit
} from './montadorBom';

import {
  atividadesSemDecisao,
  configAvaliacaoDaDefinicao,
  envelopeCalculoHH,
  etapaBomDaInstancia,
  papelAtual,
  papelDaEtapaLegada,
  papelDoElemento,
  situacaoFluxoBom,
  valoresDoBom
} from './fluxoBom';

import {
  BomFluxoService
} from './BomFluxoService';

import {
  PACOTE_FLUXO_BOM
} from './pacoteFluxoBom';

import {
  DataverseService
} from '../DataverseService';

import {
  BomService
} from './BomService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../AreaAdminService';

// ============================================================
// TESTES — Arquitetura de Soluções × motor de fluxos (ARQ-SOL)
// Usa o MESMO pacote da documentação
// (docs/exemplos/pacote-arquitetura-solucoes-fluxo.json).
// ============================================================

const exemplo = (nome: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'docs', 'exemplos', nome), 'utf8');

const referencias: IReferenciasPacote = {
  areas: [{ id: 'a-arq', sigla: 'ARQ', nome: 'Arquitetura de Soluções' }],
  usuarios: [],
  processos: []
};

const montarDefinicao = (): IFluxoDefinicao => {
  const resultado = interpretarPacote(exemplo('pacote-arquitetura-solucoes-fluxo.json'), referencias);
  expect(resultado.erros).toEqual([]);
  expect(resultado.errosPublicacao).toEqual([]);
  const pacote = resultado.pacote as NonNullable<typeof resultado.pacote>;
  const definicao = pacote.definicao as IFluxoDefinicao;
  return aplicarMetadadosNaDefinicao(
    { ...definicao, id: 'fluxo-arq', versao: 1, status: 'publicado', processoId: 'p-arq' },
    pacote.metadados
  );
};

const todosOsPapeis = (definicao: IFluxoDefinicao): string[] =>
  definicao.elementos
    .reduce((lista, elemento) => lista.concat(elemento.responsaveis.map(r => r.papelTeste)), [] as string[]);

const ator = (definicao: IFluxoDefinicao, nome = 'Responsável'): IFluxoAtor =>
  ({ id: 'u-resp', nome, papeisTeste: todosOsPapeis(definicao) });

const bom: IBomRegistro = {
  id: 'b1',
  numero: 'BOM 001',
  demandaId: 'd1',
  revisao: 'RV00',
  responsavelId: 'u-resp',
  responsavelNome: 'Responsável',
  etapa: 'Dados da demanda',
  criadoEm: '2026-11-02',
  atualizadoEm: '2026-11-02'
};

const demanda: IDemandaBom = {
  id: 'd1',
  numero: 'D-001',
  nome: 'Videomonitoramento',
  cliente: 'Prefeitura Exemplo',
  codigoCigam: '',
  municipio: 'Cidade Exemplo',
  uf: 'RS',
  numeroCrm: '',
  canal: 'Público',
  modalidade: 'Edital / licitação',
  executivoVendasId: '',
  dataEntrada: '2026-11-02',
  prazoEntrega: '2026-11-30',
  statusDemanda: 'Em andamento',
  observacaoEtapa: '',
  tipoEntrega: '',
  solucoes: ['Safe City'],
  tipoProjeto: '',
  escopo: '',
  linkEdital: '',
  origem: 'Portal',
  cadastroCompleto: true,
  responsaveis: [{ usuarioId: 'u-resp', nome: 'Responsável', principal: true, ativo: true }]
};

const usuarios = [{ id: 'u-resp', nome: 'Responsável' }, { id: 'u-gestor', nome: 'Gestora' }];

const analise = (definicao: IFluxoDefinicao, decisao: IAnaliseGoNoGo['decisao'], parecer = ''): IAnaliseGoNoGo => {
  const config = configAvaliacaoDaDefinicao(definicao);
  return {
    id: `a-${decisao}`,
    data: '2026-11-03',
    avaliadorNome: 'Responsável',
    pontuacao: decisao === 'GO' ? 88 : decisao === 'GO com restrição' ? 70 : 40,
    decisao,
    parecer,
    liberaKit: decisao === 'GO' || !!parecer,
    notas: (config ? config.criterios : []).map((criterio, i) => ({
      criterioId: `c${i}`,
      criterioNome: criterio.rotulo,
      peso: criterio.peso,
      nota: 4,
      pontos: 0,
      justificativa: ''
    }))
  };
};

const valoresBase = (definicao: IFluxoDefinicao, extra?: Partial<Parameters<typeof valoresDoBom>[0]>): Record<string, string> =>
  valoresDoBom({ bom, demanda, usuarios, configGoNoGo: configAvaliacaoDaDefinicao(definicao), ...extra });

const kitValido = gravarEnvelopeComponente({ valido: true, resumo: '2 pontos' });
const hhValido = gravarEnvelopeComponente({ valido: true, resumo: 'HH' });

const agir = (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia,
  acaoChave: string,
  valores: Record<string, string> = {},
  comentario = '',
  quem?: IFluxoAtor
): IFluxoInstancia => {
  const resultado = executarAcao(definicao, instancia, { acaoChave, comentario, valores, ator: quem || ator(definicao) });
  if (!resultado.ok || !resultado.instancia) {
    throw new Error(`${acaoChave}: ${resultado.erros.join(' ')}`);
  }
  return resultado.instancia;
};

const ateGoNoGo = (definicao: IFluxoDefinicao): IFluxoInstancia => {
  const inicio = iniciarInstancia(definicao, { revisaoId: 'b1', documentoId: 'd1', revisao: 'RV00', ator: ator(definicao), simulado: true });
  expect(inicio.ok).toBe(true);
  const instancia = inicio.instancia as IFluxoInstancia;
  expect(papelAtual(instancia)).toBe('demanda');
  return agir(definicao, instancia, 'concluir', valoresBase(definicao));
};

const ateAprovacao = (definicao: IFluxoDefinicao): IFluxoInstancia => {
  let instancia = ateGoNoGo(definicao);
  instancia = agir(definicao, instancia, 'registrar', valoresBase(definicao, { analise: analise(definicao, 'GO') }));
  expect(papelAtual(instancia)).toBe('kit');
  instancia = agir(definicao, instancia, 'concluir', { selecaoKit: kitValido });
  expect(papelAtual(instancia)).toBe('hh');
  instancia = agir(definicao, instancia, 'concluir', { calculoHH: hhValido, custoProjeto: '1000' });
  expect(papelAtual(instancia)).toBe('bomPronto');
  instancia = agir(definicao, instancia, 'enviar', { revisaoBom: 'RV00', itensConferidos: 'sim' });
  return instancia;
};

describe('Fluxo do B.O.M. (ARQ-SOL)', () => {

  it('pacote embutido no portal é igual ao da documentação', () => {
    expect(PACOTE_FLUXO_BOM).toEqual(JSON.parse(exemplo('pacote-arquitetura-solucoes-fluxo.json')));
    expect((PACOTE_FLUXO_BOM as { ambiente?: unknown }).ambiente).toBeUndefined();
  });

  it('pacote do fluxo importa sem erros e tem a atividade de aprovação', () => {
    const definicao = montarDefinicao();
    const aprovacao = definicao.elementos.find(item => item.id === 'aprovacao');
    expect(aprovacao && aprovacao.prazoDiasUteis).toBe(2);
    expect(aprovacao && aprovacao.responsaveis[0].tipo).toBe('gestorArea');
    expect((aprovacao ? aprovacao.acoes : []).map(item => item.chave)).toEqual(['aprovar', 'devolverBom', 'devolverKit', 'devolverHH']);
  });

  it('cada atividade tem uma única saída; decisões distribuem os caminhos', () => {
    const definicao = montarDefinicao();
    expect(atividadesSemDecisao(definicao)).toEqual([]);
    definicao.elementos
      .filter(item => item.tipo === 'tarefaHumana' && item.acoes.length > 1)
      .forEach(item => {
        const saidas = definicao.transicoes.filter(t => t.origemId === item.id);
        const destino = definicao.elementos.find(e => e.id === saidas[0].destinoId);
        expect({ atividade: item.id, saidas: saidas.length, destino: destino && destino.tipo }).toEqual({ atividade: item.id, saidas: 1, destino: 'gateway' });
      });
    // Modelo antigo (saídas direto da atividade) é reconhecido.
    const antigo = { ...definicao, transicoes: definicao.transicoes.concat([{ ...definicao.transicoes[0], id: 'extra', origemId: 'kit', destinoId: 'goNoGo' }]) };
    expect(atividadesSemDecisao(antigo).map(item => item.id)).toEqual(['kit']);
  });

  it('GO: percorre todas as etapas, fica aguardando aprovação e a aprovação conclui', () => {
    const definicao = montarDefinicao();
    let instancia = ateAprovacao(definicao);

    expect(situacaoFluxoBom(instancia)).toBe('aguardandoAprovacao');
    expect(etapaBomDaInstancia(instancia)).toBe('Enviado para aprovação');

    // Prazo da aprovação: 2 dias úteis a partir da pendência.
    const tarefa = instancia.tarefas.find(item => item.status === 'pendente');
    expect(tarefa && tarefa.prazo).toBe(adicionarDiasUteis((tarefa as { criadaEm: string }).criadaEm, 2));

    instancia = agir(definicao, instancia, 'aprovar', {}, '', ator(definicao, 'Gestora'));
    expect(instancia.status).toBe('concluido');
    expect(situacaoFluxoBom(instancia)).toBe('aprovado');
    expect(etapaBomDaInstancia(instancia)).toBe('Aprovado');

    // Histórico: quem, o quê, a etapa (do mais recente para o mais antigo).
    expect(instancia.historico[0].acaoChave).toBe('aprovar');
    expect(instancia.historico[0].executadoPorNome).toBe('Gestora');
    expect(instancia.historico.map(item => item.elementoId)).toEqual(
      expect.arrayContaining(['demanda', 'goNoGo', 'kit', 'hh', 'bomPronto', 'aprovacao'])
    );

    // Aprovação repetida: recusada.
    const repetida = executarAcao(definicao, instancia, { acaoChave: 'aprovar', comentario: '', valores: {}, ator: ator(definicao) });
    expect(repetida.ok).toBe(false);
    expect(repetida.erros.join(' ')).toMatch(/concluído/);
  });

  it('devolução da aprovação exige comentário e volta para a etapa escolhida', () => {
    const definicao = montarDefinicao();
    const instancia = ateAprovacao(definicao);

    const semComentario = executarAcao(definicao, instancia, { acaoChave: 'devolverKit', comentario: '', valores: {}, ator: ator(definicao) });
    expect(semComentario.ok).toBe(false);
    expect(semComentario.erros.join(' ')).toMatch(/comentário é obrigatório/);

    const paraKit = agir(definicao, instancia, 'devolverKit', {}, 'Trocar câmeras do ponto 2');
    expect(papelAtual(paraKit)).toBe('kit');
    expect(paraKit.historico[0].comentario).toBe('Trocar câmeras do ponto 2');

    expect(papelAtual(agir(definicao, instancia, 'devolverHH', {}, 'Revisar HH'))).toBe('hh');
    expect(papelAtual(agir(definicao, instancia, 'devolverBom', {}, 'Ajustar observações'))).toBe('bomPronto');
  });

  it('GO com restrição: exige parecer para liberar a seleção de kit', () => {
    const definicao = montarDefinicao();
    let instancia = ateGoNoGo(definicao);
    instancia = agir(definicao, instancia, 'registrar', valoresBase(definicao, { analise: analise(definicao, 'GO com restrição') }));
    expect(papelAtual(instancia)).toBe('restricao');

    const sem = executarAcao(definicao, instancia, { acaoChave: 'liberar', comentario: '', valores: {}, ator: ator(definicao) });
    expect(sem.ok).toBe(false);
    expect(sem.erros.join(' ')).toMatch(/Parecer/);

    instancia = agir(definicao, instancia, 'liberar', { parecer: 'Confirmar infraestrutura de rede com o cliente.' });
    expect(papelAtual(instancia)).toBe('kit');
    expect(instancia.valores.parecer).toMatch(/infraestrutura/);
  });

  it('NO-GO: bloqueia; reabrir exige comentário; encerrar conclui como encerrado', () => {
    const definicao = montarDefinicao();
    let instancia = ateGoNoGo(definicao);
    instancia = agir(definicao, instancia, 'registrar', valoresBase(definicao, { analise: analise(definicao, 'NO-GO') }));
    expect(papelAtual(instancia)).toBe('bloqueado');
    expect(etapaBomDaInstancia(instancia)).toBe('Bloqueado no Go/No-Go');

    expect(executarAcao(definicao, instancia, { acaoChave: 'reabrir', comentario: '', valores: {}, ator: ator(definicao) }).ok).toBe(false);
    const reaberto = agir(definicao, instancia, 'reabrir', {}, 'Cliente reviu o escopo');
    expect(papelAtual(reaberto)).toBe('goNoGo');

    const encerrado = agir(definicao, instancia, 'encerrar', {}, 'Sem aderência ao portfólio');
    expect(encerrado.status).toBe('concluido');
    expect(situacaoFluxoBom(encerrado)).toBe('encerrado');
    expect(etapaBomDaInstancia(encerrado)).toBe('Encerrado (NO-GO)');
  });

  it('quem não é responsável não executa a ação', () => {
    const definicao = montarDefinicao();
    const instancia = ateAprovacao(definicao);
    const resultado = executarAcao(definicao, instancia, { acaoChave: 'aprovar', comentario: '', valores: {}, ator: { id: 'x', nome: 'Visitante', papeisTeste: [] } });
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join(' ')).toMatch(/não é responsável/);
  });

  it('dados do módulo viram valores do fluxo (sem duplicar cadastro)', () => {
    const definicao = montarDefinicao();
    const valores = valoresBase(definicao, { analise: analise(definicao, 'GO com restrição', 'Parecer X') });
    expect(lerValorUsuario(valores.responsavelPrincipal)).toEqual({ id: 'u-resp', nome: 'Responsável', email: undefined });
    expect(JSON.parse(valores.solucoesInteresse)).toEqual([{ solucao: 'Safe City' }]);
    expect(JSON.parse(valores.goNoGo).faixa).toBe('restricao');
    expect(Object.keys(JSON.parse(valores.goNoGo).notas).length).toBe(8);
    expect(valores.parecer).toBe('Parecer X');
    expect(valores.codigoCigam).toBeUndefined();

    // Canal privado: modalidade fora (o campo só vale no canal Público).
    const privado = valoresDoBom({ bom, demanda: { ...demanda, canal: 'Privado', modalidade: 'Proposta Comercial' }, usuarios });
    expect(privado.modalidade).toBeUndefined();

    // HH: perguntas de integração/manutenção pendentes → não válido.
    const selecao = { versao: 1, pontos: [{}], softwares: {} } as unknown as ISelecaoKit;
    expect(JSON.parse(envelopeCalculoHH(selecao)).valido).toBe(false);
    expect(envelopeCalculoHH(undefined)).toBe('');
  });

  it('etapas reconhecidas pelo id ou pelo nome; B.O.M. antigo começa na etapa em que está', () => {
    expect(papelDoElemento({ id: 'x1', nome: 'Matriz Go/No-Go', tipo: 'tarefaHumana' })).toBe('goNoGo');
    expect(papelDoElemento({ id: 'x2', nome: 'Aprovação da diretoria', tipo: 'tarefaHumana' })).toBe('aprovacao');
    expect(papelDoElemento({ id: 'x3', nome: 'Cálculo de HH', tipo: 'tarefaHumana' })).toBe('hh');
    expect(papelDoElemento({ id: 'x4', nome: 'Parecer da restrição', tipo: 'tarefaHumana' })).toBe('restricao');
    expect(papelDaEtapaLegada('Cálculo de HH')).toBe('hh');
    expect(papelDaEtapaLegada('Bloqueado no Go/No-Go', { decisao: 'GO com restrição' } as IAnaliseGoNoGo)).toBe('restricao');
    expect(papelDaEtapaLegada('Enviado para aprovação')).toBe('aprovacao');
  });
});

// ------------------------------------------------------------
// Serviço com Dataverse simulado (ETag, permissões, devolução)
// ------------------------------------------------------------

interface IRegistroFalso {
  versao: number;
  campos: Record<string, unknown>;
}

const esperar = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

class DataverseFalso {
  public registros: Record<string, IRegistroFalso> = {};

  public async obterRegistro(_tabela: string, id: string, campos: string[]): Promise<{ registro: Record<string, unknown>; etag: string } | undefined> {
    await esperar(1);
    const r = this.registros[id];
    if (!r) {
      return undefined;
    }
    const registro: Record<string, unknown> = {};
    campos.forEach(campo => { registro[campo] = r.campos[campo]; });
    return { registro, etag: `W/"${r.versao}"` };
  }

  public async atualizarRegistro(_tabela: string, id: string, dados: Record<string, unknown>, etag?: string): Promise<string> {
    await esperar(3);
    const r = this.registros[id];
    if (etag && etag !== `W/"${r.versao}"`) {
      throw new Error('Outra pessoa alterou este registro enquanto você trabalhava. Recarregue a página e tente de novo.');
    }
    Object.keys(dados).forEach(chave => { r.campos[chave] = dados[chave]; });
    r.versao++;
    return `W/"${r.versao}"`;
  }

  public async listarRegistros(): Promise<Array<Record<string, unknown>>> {
    return Object.keys(this.registros).map(id => ({ dgt_bom_bomid: id, ...this.registros[id].campos }));
  }
}

const contexto = (usuarioId: string, nome: string): IContextoAcesso =>
  ({ usuarioId, nome, email: '', perfil: 'Funcionario', ativo: true } as unknown as IContextoAcesso);

const vinculos = [
  { id: 'v1', usuarioId: 'u-gestor', usuarioNome: 'Gestora', usuarioEmail: '', areaId: 'a-arq', areaNome: 'ARQ', areaSigla: 'ARQ', perfil: 'Gestor', ativo: true }
] as unknown as IUsuarioAreaAdmin[];

const montarServico = (dataverse: DataverseFalso, definicao: IFluxoDefinicao): BomFluxoService => {
  const dv = dataverse as unknown as DataverseService;
  const servico = new BomFluxoService(dv, new BomService(dv), {
    catalogo: { versaoPublicada: async () => definicao, obterVersao: async () => definicao } as never,
    metadados: { local: false, listar: async () => definicao.metadados || [], salvar: async () => [] } as never,
    processos: { carregar: async () => ({ processos: [{ id: 'p-arq', codigo: 'ARQ-SOL', nome: 'B.O.M.', ativo: true, origem: 'dataverse' }], vinculos: [], aviso: '' }) } as never
  });
  servico.definirContexto('a-arq', vinculos);
  return servico;
};

describe('BomFluxoService (Dataverse simulado)', () => {

  const preparar = async (): Promise<{ dataverse: DataverseFalso; definicao: IFluxoDefinicao; servico: BomFluxoService }> => {
    const definicao = montarDefinicao();
    const dataverse = new DataverseFalso();
    dataverse.registros.b1 = {
      versao: 1,
      campos: {
        dgt_bom_selecaokit: JSON.stringify({ versao: 1, pontos: [], softwares: {} })
      }
    };
    const servico = montarServico(dataverse, definicao);
    const resp = contexto('u-resp', 'Responsável');
    const inicio = await servico.iniciar(bom, resp, valoresBase(definicao));
    expect(inicio.erros).toEqual([]);

    const passo = async (valores: Record<string, string>, preparo?: () => Promise<void>): Promise<void> => {
      const r = await servico.executar({ bom, contexto: resp, comentario: '', valores: () => ({ ...valoresBase(definicao), ...valores }), preparar: preparo });
      expect(r.erros).toEqual([]);
    };
    await passo({});
    await passo({ goNoGo: valoresBase(definicao, { analise: analise(definicao, 'GO') }).goNoGo });
    await passo({ selecaoKit: kitValido });
    await passo({ calculoHH: hhValido });
    // Envio: congela a lista (como o módulo faz) e fica aguardando aprovação.
    await passo({ revisaoBom: 'RV00', itensConferidos: 'sim' }, async () => {
      dataverse.registros.b1.campos.dgt_bom_selecaokit = JSON.stringify({
        versao: 1, pontos: [], softwares: {},
        bomEnviado: { em: '2026-11-05', por: 'Responsável', itens: [], alertas: [], totais: { pontos: 0, camerasVideo: 0, camerasOcr: 0, leitoras: 0 }, precos: {}, valorTotal: 0 }
      });
    });
    return { dataverse, definicao, servico };
  };

  it('aprovação: só o aprovador configurado age; a etapa do B.O.M. é sincronizada', async () => {
    const { dataverse, servico } = await preparar();
    expect(dataverse.registros.b1.campos.dgt_bom_etapa).toBe(100000006);

    const doResponsavel = await servico.executar({ bom, contexto: contexto('u-resp', 'Responsável'), acaoChave: 'aprovar', comentario: '', valores: () => ({}) });
    expect(doResponsavel.ok).toBe(false);
    expect(doResponsavel.erros.join(' ')).toMatch(/não é responsável/);

    const daGestora = await servico.executar({ bom, contexto: contexto('u-gestor', 'Gestora'), acaoChave: 'aprovar', comentario: '', valores: () => ({}) });
    expect(daGestora.erros).toEqual([]);
    expect(dataverse.registros.b1.campos.dgt_bom_etapa).toBe(100000007);

    // Persistência: reabrir lê o mesmo estado.
    const relido = await servico.carregar('b1');
    expect(relido && situacaoFluxoBom(relido.instancia)).toBe('aprovado');
  });

  it('aprovação duplicada: clique duplo e duas pessoas ao mesmo tempo gravam uma só vez', async () => {
    const { dataverse, definicao, servico } = await preparar();
    const gestora = contexto('u-gestor', 'Gestora');
    const aprovar = (s: BomFluxoService): ReturnType<BomFluxoService['executar']> =>
      s.executar({ bom, contexto: gestora, acaoChave: 'aprovar', comentario: '', valores: () => ({}) });

    // Clique duplo na mesma tela.
    const [a, b] = await Promise.all([aprovar(servico), aprovar(servico)]);
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1);

    // Duas telas (dois navegadores) ao mesmo tempo, num B.O.M. novo.
    const outro = await preparar();
    const tela1 = outro.servico;
    const tela2 = montarServico(outro.dataverse, outro.definicao);
    const [c, d] = await Promise.all([aprovar(tela1), aprovar(tela2)]);
    expect([c.ok, d.ok].filter(Boolean).length).toBe(1);
    const final = JSON.parse(String(outro.dataverse.registros.b1.campos.dgt_bom_fluxoestado)) as IFluxoInstancia;
    expect(final.historico.filter(item => item.acaoChave === 'aprovar').length).toBe(1);
    expect(dataverse && definicao).toBeTruthy();
  });

  it('devolução da aprovação libera a lista congelada e guarda o envio anterior', async () => {
    const { dataverse, servico } = await preparar();
    const r = await servico.executar({ bom, contexto: contexto('u-gestor', 'Gestora'), acaoChave: 'devolverKit', comentario: 'Rever kit', valores: () => ({}) });
    expect(r.erros).toEqual([]);
    expect(r.estado && papelAtual(r.estado.instancia)).toBe('kit');
    const selecao = JSON.parse(String(dataverse.registros.b1.campos.dgt_bom_selecaokit)) as ISelecaoKit;
    expect(selecao.bomEnviado).toBeUndefined();
    expect((selecao.enviosAnteriores || []).length).toBe(1);
    expect((selecao.enviosAnteriores || [])[0].motivo).toBe('Rever kit');
    expect(dataverse.registros.b1.campos.dgt_bom_etapa).toBe(100000003);
  });

  it('versão nova publicada: o B.O.M. em andamento passa para ela na mesma etapa', async () => {
    const v1 = montarDefinicao();
    const v2 = { ...montarDefinicao(), versao: 2 };
    const dataverse = new DataverseFalso();
    dataverse.registros.b1 = { versao: 1, campos: {} };
    const dv = dataverse as unknown as DataverseService;
    let publicada: IFluxoDefinicao = v1;
    const servico = new BomFluxoService(dv, new BomService(dv), {
      catalogo: { versaoPublicada: async () => publicada, obterVersao: async (_id: string, versao: number) => (versao === 2 ? v2 : v1) } as never,
      metadados: { local: false, listar: async () => v1.metadados || [], salvar: async () => [] } as never,
      processos: { carregar: async () => ({ processos: [{ id: 'p-arq', codigo: 'ARQ-SOL', nome: 'B.O.M.', ativo: true }], vinculos: [], aviso: '' }) } as never
    });
    servico.definirContexto('a-arq', vinculos);
    const resp = contexto('u-resp', 'Responsável');
    await servico.iniciar(bom, resp, valoresBase(v1));
    const r1 = await servico.executar({ bom, contexto: resp, comentario: '', valores: () => valoresBase(v1) });
    expect(r1.erros).toEqual([]);

    publicada = v2;
    const atualizacao = await servico.atualizarVersao(bom, resp);
    expect(atualizacao.atualizado).toBe(true);
    const estado = await servico.carregar('b1');
    expect(estado && estado.instancia.fluxoVersao).toBe(2);
    expect(estado && papelAtual(estado.instancia)).toBe('goNoGo');
    expect(estado && estado.instancia.historico.some(item => /versão 2/.test(`${item.comentario || ''} ${item.acaoRotulo}`))).toBe(true);
  });

  it('sem processo ou só com rascunho: o fluxo fica inativo e a tela diz o que falta', async () => {
    const definicao = montarDefinicao();
    const dv = new DataverseFalso() as unknown as DataverseService;
    const semProcesso = new BomFluxoService(dv, new BomService(dv), {
      catalogo: { versaoPublicada: async () => undefined, obterVersao: async () => undefined, listarVersoes: async () => [] } as never,
      metadados: { listar: async () => [] } as never,
      processos: { carregar: async () => ({ processos: [], vinculos: [], aviso: '' }) } as never
    });
    const d1 = await semProcesso.verificar();
    expect(d1.ativo).toBe(false);
    expect(d1.processoEncontrado).toBe(false);
    expect(d1.motivo).toMatch(/Criar o fluxo em Processos/);

    const comRascunho = new BomFluxoService(dv, new BomService(dv), {
      catalogo: { versaoPublicada: async () => undefined, obterVersao: async () => undefined, listarVersoes: async () => [{ ...definicao, status: 'rascunho' }] } as never,
      metadados: { listar: async () => [] } as never,
      processos: { carregar: async () => ({ processos: [{ id: 'p-arq', codigo: 'ARQ-SOL', nome: 'B.O.M.', ativo: true }], vinculos: [], aviso: '' }) } as never
    });
    const d2 = await comRascunho.verificar();
    expect(d2.processoEncontrado).toBe(true);
    expect(d2.temRascunho).toBe(true);
    expect(d2.fluxoPublicado).toBe(false);
    expect(d2.motivo).toMatch(/rascunho/);
  });

  it('ação recusada pelo fluxo desfaz o que a tela gravou', async () => {
    const definicao = montarDefinicao();
    const dataverse = new DataverseFalso();
    dataverse.registros.b1 = { versao: 1, campos: {} };
    const servico = montarServico(dataverse, definicao);
    const resp = contexto('u-resp', 'Responsável');
    await servico.iniciar(bom, resp, {});
    let desfeito = false;
    const r = await servico.executar({
      bom, contexto: resp, comentario: '',
      valores: () => ({}),
      valoresDependemDoPreparo: true,
      preparar: async () => undefined,
      desfazer: async () => { desfeito = true; }
    });
    expect(r.ok).toBe(false);
    expect(r.erros.join(' ')).toMatch(/Preencha|Cliente/);
    expect(desfeito).toBe(true);
  });
});
