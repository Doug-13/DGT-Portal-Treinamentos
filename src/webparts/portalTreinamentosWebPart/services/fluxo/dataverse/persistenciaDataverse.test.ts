import {
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../../models/Fluxo';

import {
  IProcesso
} from '../../../models/Processo';

import {
  IUsuarioAreaAdmin
} from '../../AreaAdminService';

import {
  IContextoAcesso
} from '../../AutorizacaoService';

import {
  FluxoService
} from '../FluxoService';

import {
  etapaDeAprovacao,
  papeisDoUsuario,
  resolverResponsavel,
  usuarioAtende,
  usuariosElegiveis
} from '../ResolvedorResponsaveis';

import {
  FLUXO_EM_BRANCO,
  FLUXO_POP_PROCEDIMENTO_V2
} from '../definicoes/fluxoPopProcedimento';

import {
  DataverseFalso
} from './dataverseFalso.test-helper';

import {
  FluxoCatalogoDataverse
} from './FluxoCatalogoDataverse';

import {
  FluxoRepositorioDataverse
} from './FluxoRepositorioDataverse';

import {
  MetadadosRepositorioDataverse
} from './MetadadosRepositorioDataverse';

import {
  ProcessosRepositorioDataverse
} from './ProcessosRepositorioDataverse';

// ============================================================
// TESTES — gravação no Dataverse (com um Dataverse em memória)
// ============================================================

const AREA_QUALIDADE = '00000000-0000-4000-9000-00000000a001';
const AREA_DOC = '00000000-0000-4000-9000-00000000a002';
const AUTOR = '00000000-0000-4000-9000-00000000b001';
const GESTOR_DOC = '00000000-0000-4000-9000-00000000b002';
const GESTOR_QUALIDADE = '00000000-0000-4000-9000-00000000b003';

const vinculos: IUsuarioAreaAdmin[] = [
  { id: 'v1', usuarioId: GESTOR_DOC, usuarioNome: 'Gestor Doc', usuarioEmail: '', areaId: AREA_DOC, areaNome: 'Produção', areaSigla: 'PRD', perfil: 'Gestor', ativo: true },
  { id: 'v2', usuarioId: GESTOR_QUALIDADE, usuarioNome: 'Gestora Qualidade', usuarioEmail: '', areaId: AREA_QUALIDADE, areaNome: 'Qualidade', areaSigla: 'QUA', perfil: 'Gestor', ativo: true },
  { id: 'v3', usuarioId: AUTOR, usuarioNome: 'Autor', usuarioEmail: '', areaId: AREA_DOC, areaNome: 'Produção', areaSigla: 'PRD', perfil: 'Membro', ativo: true }
];

const contexto = (
  usuarioId: string,
  perfil: IContextoAcesso['perfil'] = 'Funcionario'
): IContextoAcesso => ({
  usuarioId,
  nome: usuarioId,
  email: '',
  perfil,
  ativo: true
} as unknown as IContextoAcesso);

const processo: IProcesso = {
  id: '00000000-0000-4000-9000-00000000c001',
  codigo: 'PRO-QUAL',
  nome: 'Controle de documentos',
  ativo: true,
  origem: 'dataverse'
};

// Fluxo POP com a área da Qualidade escolhida, publicado.
const prepararFluxoPublicado = async (
  dv: DataverseFalso
): Promise<FluxoCatalogoDataverse> => {

  const catalogo =
    new FluxoCatalogoDataverse(dv.comoServico());

  const criado =
    await catalogo.criarAPartirDoModelo(processo, 'modelo-revisao-pop');

  expect(criado.ok).toBe(true);

  const rascunho =
    criado.definicao as IFluxoDefinicao;

  rascunho.elementos
    .filter(item => item.id === 'aprovacaoQualidade')[0]
    .responsaveis[0].referenciaId = AREA_QUALIDADE;

  expect((await catalogo.publicarRascunho(processo.id)).ok).toBe(false);

  expect((await catalogo.salvarRascunho(rascunho)).ok).toBe(true);
  expect((await catalogo.publicarRascunho(processo.id)).ok).toBe(true);

  return catalogo;
};

describe('Resolvedor de responsáveis', () => {

  it('resolve autor, gestor da área do documento e área específica', () => {

    const dados = { revisaoResponsavelId: AUTOR, documentoAreaId: AREA_DOC };

    const autor = resolverResponsavel({ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }, dados);
    const gestor = resolverResponsavel({ tipo: 'gestorArea', descricao: 'Gestor', papelTeste: 'g' }, dados);
    const qualidade = resolverResponsavel({ tipo: 'area', referenciaId: AREA_QUALIDADE, somenteGestores: true, descricao: 'Q', papelTeste: 'q' }, dados);

    expect(usuarioAtende(autor, AUTOR, vinculos)).toBe(true);
    expect(usuarioAtende(autor, GESTOR_DOC, vinculos)).toBe(false);
    expect(usuarioAtende(gestor, GESTOR_DOC, vinculos)).toBe(true);
    expect(usuarioAtende(gestor, AUTOR, vinculos)).toBe(false);
    expect(usuarioAtende(qualidade, GESTOR_QUALIDADE, vinculos)).toBe(true);
    expect(usuarioAtende(qualidade, GESTOR_DOC, vinculos)).toBe(false);
  });
});

describe('Etapa de aprovação (campo Aprovador do novo documento)', () => {

  it('encontra a etapa de aprovação e as pessoas que podem aprovar', () => {

    const pop =
      JSON.parse(JSON.stringify(FLUXO_POP_PROCEDIMENTO_V2)) as IFluxoDefinicao;

    const etapa =
      etapaDeAprovacao(pop) as IFluxoDefinicao['elementos'][0];

    expect(etapa.id).toBe('aprovacaoQualidade');

    etapa.responsaveis[0].referenciaId = AREA_QUALIDADE;

    expect(
      usuariosElegiveis(etapa.responsaveis, { documentoAreaId: AREA_DOC }, vinculos).map(item => item.usuarioNome)
    ).toEqual(['Gestora Qualidade']);

    // Fluxo de uma etapa só: ela é a de aprovação.
    expect((etapaDeAprovacao(FLUXO_EM_BRANCO) as IFluxoDefinicao['elementos'][0]).id).toBe('elaboracao');
  });
});

describe('Catálogo de fluxos no Dataverse', () => {

  it('cria, publica, versiona e descarta sem apagar registros', async () => {

    const dv = new DataverseFalso();
    const catalogo = await prepararFluxoPublicado(dv);

    const nova = await catalogo.criarNovaVersao(processo.id);
    expect(nova.definicao?.versao).toBe(2);

    expect((await catalogo.descartarRascunho(processo.id)).ok).toBe(true);

    const versoes = await catalogo.listarVersoes(processo.id);
    expect(versoes.map(item => `${item.versao}:${item.status}`)).toEqual(['1:publicado']);

    // O rascunho descartado continua no banco.
    expect((dv.tabelas.dgt_fluxo || []).length).toBe(2);

    // A próxima versão não reaproveita o número descartado.
    expect((await catalogo.criarNovaVersao(processo.id)).definicao?.versao).toBe(3);
  });
});

describe('Metadados do processo no Dataverse', () => {

  it('grava na ordem, reordena e desativa os removidos', async () => {

    const dv = new DataverseFalso();
    const repositorio = new MetadadosRepositorioDataverse(dv.comoServico());

    const gravados =
      await repositorio.salvar(processo.id, [
        { chave: 'a', rotulo: 'A', tipo: 'texto' },
        { chave: 'b', rotulo: 'B', tipo: 'tabela', colunas: [{ chave: 'x', rotulo: 'X', tipo: 'texto' }] }
      ]);

    expect(gravados.every(item => !!item.id)).toBe(true);

    await repositorio.salvar(processo.id, [gravados[1]]);

    const lidos = await repositorio.listar(processo.id);
    expect(lidos.map(item => item.chave)).toEqual(['b']);
    expect(lidos[0].colunas?.[0].rotulo).toBe('X');

    // "a" não foi apagado: ficou inativo.
    expect((dv.tabelas.dgt_processometadado || []).length).toBe(2);
  });
});

describe('Processos e vínculos no Dataverse', () => {

  it('cria processo com área e vincula o primeiro processo como principal', async () => {

    const dv = new DataverseFalso();
    const repositorio = new ProcessosRepositorioDataverse(dv.comoServico());

    const criado =
      await repositorio.criarProcesso({ codigo: 'P1', nome: 'Processo 1', areaId: AREA_DOC }, []);

    expect(criado.ok).toBe(true);
    expect(dv.tabelas.dgt_processo[0]._dgt_area_value).toBe(AREA_DOC);

    dv.tabelas.dgt_processo[0].dgt_ativo = true;

    await repositorio.vincularDocumento('00000000-0000-4000-9000-00000000d001', (criado.processo as IProcesso).id, []);

    const dados = await repositorio.carregar();
    expect(dados.vinculos.length).toBe(1);
    expect(dados.vinculos[0].principal).toBe(true);
  });
});

describe('Fluxo de uma revisão no Dataverse', () => {

  const REVISAO = '00000000-0000-4000-9000-00000000e001';

  const montar = async (): Promise<{ dv: DataverseFalso; servico: FluxoService; catalogo: FluxoCatalogoDataverse }> => {
    const dv = new DataverseFalso();
    const catalogo = await prepararFluxoPublicado(dv);
    dv.incluir('dgt_documentorevisao', { dgt_documentorevisaoid: REVISAO, dgt_estadofluxojson: '' });
    const servico = new FluxoService(
      new FluxoRepositorioDataverse(dv.comoServico()),
      catalogo,
      new MetadadosRepositorioDataverse(dv.comoServico())
    );
    return { dv, servico, catalogo };
  };

  const dados = { revisaoResponsavelId: AUTOR, documentoAreaId: AREA_DOC };

  const contextoExecucao = {
    rotuloRevisao: 'POP-001 Rev.04',
    resolverResponsaveis: (responsaveis: IFluxoDefinicao['elementos'][0]['responsaveis']) =>
      responsaveis.map(item => resolverResponsavel(item, dados))
  };

  it('inicia, grava o estado, cria pendência com responsáveis e registra o histórico', async () => {

    const { dv, servico } = await montar();

    const inicio =
      await servico.iniciar(
        processo,
        { revisaoId: REVISAO, documentoId: 'd', revisao: 'Rev.04', ator: { id: AUTOR, nome: 'Autor', papeisTeste: [] }, simulado: false },
        contextoExecucao
      );

    expect(inicio.ok).toBe(true);

    const revisao = dv.tabelas.dgt_documentorevisao[0];
    expect(revisao.dgt_etapaatual).toBe('elaboracao');
    expect(revisao.dgt_situacaofluxo).toBe('emAndamento');
    expect(revisao._dgt_fluxo_value).toBeTruthy();

    const tarefas = dv.tabelas.dgt_tarefafluxo;
    expect(tarefas.length).toBe(1);
    expect(JSON.parse(tarefas[0].dgt_responsaveisjson)[0].usuarioId).toBe(AUTOR);

    // O autor envia; a pendência dele é concluída e nasce a do gestor.
    const definicao = await servico.definicaoDaInstancia(inicio.instancia as IFluxoInstancia);
    const papeisAutor = papeisDoUsuario(definicao as IFluxoDefinicao, contexto(AUTOR), dados, vinculos);

    const envio =
      await servico.executar(
        REVISAO,
        { acaoChave: 'enviarRevisaoTecnica', comentario: '', valores: {}, ator: { id: AUTOR, nome: 'Autor', papeisTeste: papeisAutor } },
        contextoExecucao
      );

    expect(envio.ok).toBe(true);
    expect(dv.tabelas.dgt_tarefafluxo.map(item => item.dgt_situacao)).toEqual(['concluida', 'pendente']);
    expect(JSON.parse(dv.tabelas.dgt_tarefafluxo[1].dgt_responsaveisjson)[0].areaId).toBe(AREA_DOC);
    expect(dv.tabelas.dgt_historicofluxo.length).toBe(2);
    expect(dv.tabelas.dgt_historicofluxo[1]._dgt_executadopor_value).toBe(AUTOR);

    // Quem não é responsável não avança.
    const intruso =
      await servico.executar(
        REVISAO,
        {
          acaoChave: 'aprovarTecnicamente',
          comentario: '',
          valores: {},
          ator: { id: AUTOR, nome: 'Autor', papeisTeste: papeisDoUsuario(definicao as IFluxoDefinicao, contexto(AUTOR), dados, vinculos) }
        },
        contextoExecucao
      );

    expect(intruso.ok).toBe(false);
  });

  it('recusa gravar quando outra pessoa alterou a revisão (ETag)', async () => {

    const { dv, servico } = await montar();

    await servico.iniciar(
      processo,
      { revisaoId: REVISAO, documentoId: 'd', revisao: 'Rev.04', ator: { id: AUTOR, nome: 'Autor', papeisTeste: [] }, simulado: false },
      contextoExecucao
    );

    // Outra pessoa grava no meio do caminho.
    dv.tabelas.dgt_documentorevisao[0].__versao = 99;

    const repositorio = new FluxoRepositorioDataverse(dv.comoServico());
    const instancia = await repositorio.obter(REVISAO) as IFluxoInstancia;

    dv.conflitoNoProximo = true;

    await expect(repositorio.salvar(instancia)).rejects.toMatchObject({ codigo: 'CONFLITO' });
  });

  it('não conclui o fluxo se a publicação falhar', async () => {

    const { dv, servico } = await montar();

    const ator = (id: string, perfil: IContextoAcesso['perfil'] = 'Funcionario'): { id: string; nome: string; papeisTeste: string[] } => ({
      id,
      nome: id,
      papeisTeste: ['autor', 'coordenacao', 'qualidade'].concat(perfil === 'Administrador' ? [] : [])
    });

    const inicio = await servico.iniciar(
      processo,
      { revisaoId: REVISAO, documentoId: 'd', revisao: 'Rev.04', ator: ator(AUTOR), simulado: false },
      contextoExecucao
    );

    const definicao = await servico.definicaoDaInstancia(inicio.instancia as IFluxoInstancia) as IFluxoDefinicao;

    // O perfil Administrador NÃO dá acesso a etapas de outros.
    expect(papeisDoUsuario(definicao, contexto(GESTOR_QUALIDADE, 'Administrador'), dados, vinculos)).toEqual(['qualidade']);

    const admin = { id: AUTOR, nome: 'Todos os papéis', papeisTeste: ['autor', 'coordenacao', 'qualidade'] };

    await servico.executar(REVISAO, { acaoChave: 'enviarRevisaoTecnica', comentario: '', valores: {}, ator: admin }, contextoExecucao);
    await servico.executar(REVISAO, { acaoChave: 'aprovarTecnicamente', comentario: '', valores: {}, ator: admin }, contextoExecucao);

    const falha =
      await servico.executar(
        REVISAO,
        { acaoChave: 'aprovarPublicar', comentario: '', valores: { retreinamento: 'sim' }, ator: admin },
        {
          ...contextoExecucao,
          executarAcoesSistema: async () => { throw new Error('API indisponível'); }
        }
      );

    expect(falha.ok).toBe(false);
    expect(dv.tabelas.dgt_documentorevisao[0].dgt_etapaatual).toBe('aprovacaoQualidade');

    let publicou = false;

    const sucesso =
      await servico.executar(
        REVISAO,
        { acaoChave: 'aprovarPublicar', comentario: '', valores: { retreinamento: 'sim' }, ator: admin },
        {
          ...contextoExecucao,
          executarAcoesSistema: async acoes => { publicou = acoes.indexOf('publicarComRetreinamento') >= 0; }
        }
      );

    expect(sucesso.ok).toBe(true);
    expect(publicou).toBe(true);
    expect(dv.tabelas.dgt_documentorevisao[0].dgt_etapaatual).toBe('fim');
    expect(dv.tabelas.dgt_documentorevisao[0].dgt_situacaofluxo).toBe('concluido');
  });
});
