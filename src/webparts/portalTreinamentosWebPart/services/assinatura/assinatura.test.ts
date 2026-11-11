import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoTransicao
} from '../../models/Fluxo';

import {
  assinaturaPendente,
  executarAcao,
  iniciarInstancia
} from '../fluxo/FluxoEngine';

import {
  validarDefinicao
} from '../fluxo/FluxoValidacao';

import {
  FluxoService
} from '../fluxo/FluxoService';

import {
  IFluxoRepositorio
} from '../fluxo/FluxoRepositorioLocal';

import {
  IConfigAssinatura
} from '../fluxo/assinaturaFluxo';

import {
  IPedidoAssinatura,
  IAlvoAssinatura,
  IRepositorioAssinatura,
  conferirAssinatura
} from './controleAssinatura';

import {
  avisosFluxoAmbiente
} from '../ambientes/compatibilidadeFluxoAmbiente';

import {
  FORMATO_PACOTE,
  interpretarPacote
} from '../pacoteProcesso/pacoteProcesso';

// ============================================================
// TESTES — Assinatura digital (Elaborar → Assinatura → Conferir)
// ============================================================

const pos = { x: 0, y: 0, largura: 10, altura: 10 };
const resp = [{ tipo: 'autorRevisao' as const, descricao: 'Autor', papelTeste: 'autor' }];
const concluir = [{ chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false }];
const el = (id: string, tipo: IFluxoElemento['tipo'], nome: string, extra: Partial<IFluxoElemento> = {}): IFluxoElemento =>
  ({ id, tipo, nome, responsaveis: tipo === 'tarefaHumana' ? resp : [], acoes: tipo === 'tarefaHumana' ? concluir : [], campos: [], posicao: pos, ...extra });
const tr = (id: string, origemId: string, destinoId: string): IFluxoTransicao =>
  ({ id, origemId, destinoId, tipoCondicao: 'sempre', padrao: false, excecao: false, pontos: [] });

const assinatura = (parcial: Partial<IConfigAssinatura> = {}): IConfigAssinatura => ({
  provedor: 'clicksign',
  documento: 'arquivoRevisao',
  signatarios: [{ origem: 'campo', campo: 'dono', papel: 'assinar' }, { origem: 'usuario', usuarioId: 'u-qua', usuarioNome: 'Qualidade', papel: 'aprovar' }],
  ordemSequencial: true,
  prazoDias: 10,
  ...parcial
});

const definicao = (config: IConfigAssinatura = assinatura()): IFluxoDefinicao => ({
  id: 'f', nome: 'POP', versao: 1, status: 'publicado', processoId: 'p', tiposDocumento: [], larguraDiagrama: 100, alturaDiagrama: 100,
  metadados: [
    { chave: 'dono', rotulo: 'Dono do processo', tipo: 'usuario' },
    { chave: 'situacaoAssinatura', rotulo: 'Situação da assinatura', tipo: 'lista', opcoes: ['assinado', 'recusado', 'expirado', 'cancelado'] }
  ],
  elementos: [
    el('inicio', 'inicio', 'Início'),
    el('elaborar', 'tarefaHumana', 'Elaborar', { campos: [{ chave: 'dono', rotulo: 'Dono do processo', tipo: 'usuario', obrigatorio: false }] }),
    el('assinar', 'tarefaSistema', 'Assinatura digital', { acaoSistema: 'assinaturaDigital', assinatura: config }),
    el('conferir', 'tarefaHumana', 'Conferir'),
    el('fim', 'fim', 'Fim')
  ],
  transicoes: [tr('t1', 'inicio', 'elaborar'), tr('t2', 'elaborar', 'assinar'), tr('t3', 'assinar', 'conferir'), tr('t4', 'conferir', 'fim')]
});

const ator = { id: 'u1', nome: 'Ana', papeisTeste: ['autor'] };
const USUARIOS = [{ id: 'u-dono', nome: 'Dono', email: 'dono@dgt.com.br' }, { id: 'u-qua', nome: 'Qualidade', email: 'qualidade@dgt.com.br' }];
const DONO = JSON.stringify({ id: 'u-dono', nome: 'Dono' });

const ateAssinatura = (def: IFluxoDefinicao): IFluxoInstancia => {
  const inicio = iniciarInstancia(def, { revisaoId: 'r1', documentoId: 'd1', revisao: 'Rev.00A', ator, simulado: false }).instancia as IFluxoInstancia;
  const r = executarAcao(def, inicio, { acaoChave: 'concluir', comentario: '', valores: { dono: DONO }, ator });
  expect(r.erros).toEqual([]);
  return r.instancia as IFluxoInstancia;
};

const repositorioFalso = (): IRepositorioAssinatura & { pedidos: IPedidoAssinatura[] } => {
  const pedidos: IPedidoAssinatura[] = [];
  return {
    pedidos,
    ler: async chave => pedidos.find(item => item.chave === chave),
    criar: async pedido => { const novo = { ...pedido, id: `p${pedidos.length + 1}` }; pedidos.push(novo); return novo; }
  };
};

const alvo = (arquivos = [{ nome: 'POP-001.pdf', url: 'https://x/POP-001.pdf' }]): IAlvoAssinatura => ({
  origem: 'documento' as const, alvoId: 'r1', codigo: 'POP-001 Rev.00A', titulo: 'Recebimento', solicitante: 'Ana',
  arquivos: async () => ({ arquivos })
});

describe('Assinatura digital — motor e pedido', () => {

  it('o fluxo PARA na assinatura com uma chave única', () => {
    const instancia = ateAssinatura(definicao());
    expect(instancia.elementoAtualId).toBe('assinar');
    const pendente = assinaturaPendente(definicao(), instancia);
    expect(pendente && pendente.chave).toMatch(/^ass/);
  });

  it('cria o pedido UMA vez (signatários com e-mail, ordem) e não libera enquanto não assinado', async () => {
    const def = definicao();
    const instancia = ateAssinatura(def);
    const repo = repositorioFalso();
    const concluirChamado: string[] = [];
    const params = {
      definicao: def, instancia, alvo: alvo(), usuarios: async () => USUARIOS, repositorio: repo,
      concluir: async (_c: string, situacao: string) => { concluirChamado.push(situacao); return []; },
      agora: new Date('2026-11-11T12:00:00Z')
    };
    const primeira = await conferirAssinatura(params);
    const segunda = await conferirAssinatura(params);
    expect(repo.pedidos).toHaveLength(1);
    expect(primeira.pedido && primeira.pedido.signatarios).toEqual([
      { nome: 'Dono', email: 'dono@dgt.com.br', papel: 'assinar', ordem: 1 },
      { nome: 'Qualidade', email: 'qualidade@dgt.com.br', papel: 'aprovar', ordem: 2 }
    ]);
    expect(primeira.pedido && primeira.pedido.prazo).toBe('2026-11-21T12:00:00.000Z');
    expect(segunda.liberado).toBe(false);
    expect(concluirChamado).toEqual([]);
  });

  it('"assinado" libera e grava a situação/link; recusa sem campo da situação não libera', async () => {
    const comCampos = definicao(assinatura({ campoSituacao: 'situacaoAssinatura' }));
    const repo = repositorioFalso();
    const instancia = ateAssinatura(comCampos);
    const chamadas: Array<{ situacao: string; valores: Record<string, string> }> = [];
    const params = {
      definicao: comCampos, instancia, alvo: alvo(), usuarios: async () => USUARIOS, repositorio: repo,
      concluir: async (_c: string, situacao: string, valores: Record<string, string>) => { chamadas.push({ situacao, valores }); return []; }
    };
    await conferirAssinatura(params);
    repo.pedidos[0].situacao = 'assinado';
    expect((await conferirAssinatura(params)).liberado).toBe(true);
    expect(chamadas).toEqual([{ situacao: 'assinado', valores: { situacaoAssinatura: 'assinado' } }]);

    // Sem campo da situação: recusado NÃO libera (fica para Reenviar/liberar).
    const semCampo = definicao();
    const repo2 = repositorioFalso();
    const inst2 = ateAssinatura(semCampo);
    const p2 = { ...params, definicao: semCampo, instancia: inst2, repositorio: repo2 };
    await conferirAssinatura(p2);
    repo2.pedidos[0].situacao = 'recusado';
    const antes = chamadas.length;
    expect((await conferirAssinatura(p2)).liberado).toBe(false);
    expect(chamadas.length).toBe(antes);
  });

  it('erros claros: sem arquivo ou signatário vazio (e nenhum pedido criado)', async () => {
    const def = definicao();
    const repo = repositorioFalso();
    const semArquivo = await conferirAssinatura({ definicao: def, instancia: ateAssinatura(def), alvo: alvo([]), usuarios: async () => USUARIOS, repositorio: repo, concluir: async () => [] });
    expect(semArquivo.erros).toEqual(['Não há arquivo para assinar.']);
    const inicio = iniciarInstancia(def, { revisaoId: 'r1', documentoId: 'd1', revisao: 'Rev.00A', ator, simulado: false }).instancia as IFluxoInstancia;
    const semDono = executarAcao(def, inicio, { acaoChave: 'concluir', comentario: '', valores: {}, ator }).instancia as IFluxoInstancia;
    const vazio = await conferirAssinatura({ definicao: def, instancia: semDono, alvo: alvo(), usuarios: async () => USUARIOS, repositorio: repo, concluir: async () => [] });
    expect(vazio.erros.join(' ')).toMatch(/campo "dono" \(signatário\) está vazio/);
    expect(repo.pedidos).toHaveLength(0);
  });

  it('FluxoService.concluirAssinatura: segue para "Conferir" e registra no histórico; outra chave não faz nada', async () => {
    const def = definicao(assinatura({ campoSituacao: 'situacaoAssinatura' }));
    let atual: IFluxoInstancia | undefined = ateAssinatura(def);
    const repositorio: IFluxoRepositorio = { local: false, obter: async () => atual, salvar: async i => { atual = i; return []; }, remover: async () => undefined };
    const catalogo = { obterVersao: async () => def, versaoPublicada: async () => def } as unknown as ConstructorParameters<typeof FluxoService>[1];
    const metadados = { listar: async () => def.metadados || [] } as unknown as ConstructorParameters<typeof FluxoService>[2];
    const servico = new FluxoService(repositorio, catalogo, metadados);
    const chave = (assinaturaPendente(def, atual) as { chave: string }).chave;

    expect((await servico.concluirAssinatura('r1', 'outra', { situacao: 'assinado', valores: {} })).ok).toBe(false);
    const r = await servico.concluirAssinatura('r1', chave, { situacao: 'assinado', valores: { situacaoAssinatura: 'assinado' } });
    expect(r.ok).toBe(true);
    const final = atual as unknown as IFluxoInstancia;
    expect(final.elementoAtualId).toBe('conferir');
    expect(final.valores.situacaoAssinatura).toBe('assinado');
    expect(final.historico[0].acaoRotulo).toBe('Documento assinado');
    expect(final.assinatura).toBeUndefined();
  });
});

describe('Assinatura digital — validação, ambientes e pacote JSON', () => {

  it('publicável quando bem configurada; erros quando não', () => {
    expect(validarDefinicao(definicao())).toEqual([]);
    expect(validarDefinicao(definicao(assinatura({ signatarios: [] }))).join(' ')).toMatch(/ao menos um signatário/);
    const def = definicao(assinatura({ campoSituacao: 'situacaoAssinatura' }));
    const listaIncompleta = { ...def, metadados: (def.metadados || []).map(m => (m.chave === 'situacaoAssinatura' ? { ...m, opcoes: ['assinado'] } : m)) };
    expect(validarDefinicao(listaIncompleta).join(' ')).toMatch(/precisa ter as opções recusado, expirado, cancelado/);
    const duasSaidas = { ...definicao(), transicoes: definicao().transicoes.concat(tr('t5', 'assinar', 'fim')) };
    expect(validarDefinicao(duasSaidas).join(' ')).toMatch(/exatamente uma ligação de saída/);
  });

  it('ambiente: avisa se a assinatura usa o arquivo da revisão', () => {
    expect(avisosFluxoAmbiente(definicao()).join(' ')).toMatch(/Anexos do registro/);
    expect(avisosFluxoAmbiente(definicao(assinatura({ documento: 'anexosRegistro' }))).join(' ')).not.toMatch(/Assinatura digital/);
  });

  it('pacote JSON: signatário fixo pelo e-mail', () => {
    const pacote = {
      formato: FORMATO_PACOTE,
      processo: { codigo: 'QUA-POP', nome: 'POP' },
      metadados: [{ chave: 'dono', rotulo: 'Dono', tipo: 'usuario' }],
      fluxo: {
        elementos: [
          { id: 'inicio', tipo: 'inicio', nome: 'Início' },
          { id: 'elaborar', tipo: 'tarefaHumana', nome: 'Elaborar', responsaveis: [{ tipo: 'autorRevisao' }] },
          { id: 'assinar', tipo: 'tarefaSistema', nome: 'Assinatura digital', acaoSistema: 'assinaturaDigital',
            assinatura: { provedor: 'clicksign', documento: 'arquivoRevisao', prazoDias: 5, ordemSequencial: false,
              signatarios: [{ origem: 'campo', campo: 'dono', papel: 'assinar' }, { origem: 'usuario', email: 'QUALIDADE@dgt.com.br', papel: 'aprovar' }] } },
          { id: 'fim', tipo: 'fim', nome: 'Fim' }
        ],
        transicoes: [{ de: 'inicio', para: 'elaborar' }, { de: 'elaborar', para: 'assinar' }, { de: 'assinar', para: 'fim' }]
      }
    };
    const referencias = { areas: [], usuarios: [{ id: 'u-qua', email: 'qualidade@dgt.com.br', nome: 'Qualidade' }], processos: [] };
    const r = interpretarPacote(pacote, referencias);
    expect(r.erros).toEqual([]);
    expect(r.errosPublicacao).toEqual([]);
    const el2 = r.pacote && r.pacote.definicao ? r.pacote.definicao.elementos.find(e => e.id === 'assinar') : undefined;
    expect(el2 && el2.assinatura && el2.assinatura.signatarios[1]).toEqual({ origem: 'usuario', usuarioId: 'u-qua', usuarioNome: 'Qualidade', papel: 'aprovar' });
    const comErro = JSON.parse(JSON.stringify(pacote));
    comErro.fluxo.elementos[2].assinatura.signatarios[1].email = 'ninguem@dgt.com.br';
    expect(interpretarPacote(comErro, referencias).erros.join(' ')).toMatch(/ninguem@dgt.com.br/);
  });
});
