import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  FLUXO_POP_PROCEDIMENTO_V2
} from './definicoes/fluxoPopProcedimento';

import {
  executarAcao,
  iniciarInstancia
} from './FluxoEngine';

import {
  IConfigNotificacao,
  INotificacaoSolicitada,
  configNotificacaoPadrao,
  emailsDoTexto,
  montarTextoNotificacao,
  validarConfigNotificacao
} from './notificacaoFluxo';

import {
  configPadraoElemento,
  definicaoParaBpmnXml
} from './bpmn/bpmnConversao';

// ============================================================
// TESTES DAS NOTIFICAÇÕES DO FLUXO
// (aba Notificações da atividade e evento de notificação)
// ============================================================

const ator = (papel: string): IFluxoAtor => ({ id: papel, nome: papel, papeisTeste: [papel] });

const notificacao = (parcial: Partial<IConfigNotificacao>): IConfigNotificacao => ({
  ...configNotificacaoPadrao('atividade'),
  ...parcial
});

// Fluxo de exemplo com:
//  • Elaboração → avisa ao concluir só quando o resultado for "reprovado"
//    (não deve disparar) e outra ao concluir com qualquer resultado;
//  • evento de notificação entre Elaboração e Revisão técnica;
//  • Revisão técnica → avisa ao começar.
const montarDefinicao = (): IFluxoDefinicao => {

  const base: IFluxoDefinicao = JSON.parse(JSON.stringify(FLUXO_POP_PROCEDIMENTO_V2));

  const evento: IFluxoElemento = {
    id: 'eventoAviso',
    tipo: 'eventoNotificacao',
    nome: 'Avisar qualidade',
    responsaveis: [],
    acoes: [],
    campos: [],
    posicao: { x: 270, y: 172, largura: 36, altura: 36 },
    notificacoes: [notificacao({ chave: 'n-evento', assunto: '{registro} passou em {etapa}' })]
  };

  base.elementos = base.elementos.map(elemento => {
    if (elemento.id === 'elaboracao') {
      return {
        ...elemento,
        notificacoes: [
          notificacao({ chave: 'n-reprovado', momento: 'aoConcluir', resultados: ['reprovado'] }),
          notificacao({ chave: 'n-concluiu', momento: 'aoConcluir', resultados: [] })
        ]
      };
    }
    if (elemento.id === 'revisaoTecnica') {
      return { ...elemento, notificacoes: [notificacao({ chave: 'n-chegou', momento: 'aoChegar' })] };
    }
    return elemento;
  }).concat([evento]);

  base.transicoes = base.transicoes.map(transicao =>
    transicao.id === 't-elaboracao-revisao' ? { ...transicao, destinoId: 'eventoAviso' } : transicao
  ).concat([{
    id: 't-evento-revisao',
    origemId: 'eventoAviso',
    destinoId: 'revisaoTecnica',
    tipoCondicao: 'sempre',
    padrao: true,
    excecao: false,
    pontos: [{ x: 306, y: 190 }, { x: 330, y: 190 }]
  }]);

  return base;
};

const iniciar = (definicao: IFluxoDefinicao): IFluxoInstancia => {
  const resultado = iniciarInstancia(definicao, {
    revisaoId: 'rev-teste',
    documentoId: 'doc-teste',
    revisao: 'Rev.04',
    ator: ator('autor'),
    simulado: true
  });
  expect(resultado.ok).toBe(true);
  return resultado.instancia as IFluxoInstancia;
};

describe('Notificações do fluxo', () => {

  it('pede as notificações ao concluir, ao passar pelo evento e ao chegar na próxima atividade', () => {

    const definicao = montarDefinicao();
    const instancia = iniciar(definicao);
    delete instancia.notificacoesSolicitadas;

    const resultado = executarAcao(definicao, instancia, {
      acaoChave: 'enviarRevisaoTecnica',
      comentario: 'Pronto para revisão',
      valores: {},
      ator: ator('autor')
    });

    expect(resultado.erros).toEqual([]);

    const depois = resultado.instancia as IFluxoInstancia;
    const pedidos = depois.notificacoesSolicitadas || [];
    const chaves = pedidos.map(item => item.config.chave);

    // Filtro por resultado: "reprovado" não aconteceu.
    expect(chaves).toEqual(['n-concluiu', 'n-evento', 'n-chegou']);

    const concluiu = pedidos[0];
    expect(concluiu.momento).toBe('aoConcluir');
    expect(concluiu.acaoRotulo).toBe('Enviar para revisão técnica');
    expect(concluiu.comentario).toBe('Pronto para revisão');

    expect(pedidos[1].origem).toBe('evento');
    expect(pedidos[1].momento).toBe('aoPassar');

    // O evento não para o fluxo.
    expect(depois.elementoAtualId).toBe('revisaoTecnica');
    expect(pedidos[2].prazo).toBeTruthy();

    // Fica registrado no histórico.
    expect(depois.historico.some(item => item.elementoId === 'eventoAviso' && item.sistema)).toBe(true);

    // Chaves únicas (o mesmo aviso nunca é gravado duas vezes).
    expect(new Set(pedidos.map(item => item.chave)).size).toBe(pedidos.length);
  });

  it('atividade notifica só os responsáveis dela, por e-mail, com Teams opcional', () => {

    const definicao = montarDefinicao();
    definicao.elementos = definicao.elementos.map(elemento =>
      elemento.id === 'revisaoTecnica'
        ? {
          ...elemento,
          notificacoes: [notificacao({
            chave: 'n-chegou',
            incluirResponsaveisEtapa: false,
            destinatarios: [{ tipo: 'autorRevisao', descricao: 'Autor', papelTeste: 'autor' }],
            emailsAdicionais: 'outro@exemplo.com',
            canais: ['teams', 'portal']
          })]
        }
        : elemento);

    const resultado = executarAcao(definicao, iniciar(definicao), {
      acaoChave: 'enviarRevisaoTecnica',
      comentario: '',
      valores: {},
      ator: ator('autor')
    });

    const pedido = ((resultado.instancia as IFluxoInstancia).notificacoesSolicitadas || [])
      .find(item => item.config.chave === 'n-chegou') as INotificacaoSolicitada;

    const revisao = definicao.elementos.find(item => item.id === 'revisaoTecnica') as IFluxoElemento;

    expect(pedido.responsaveisEtapa).toEqual(revisao.responsaveis);
    expect(pedido.config.destinatarios).toEqual([]);
    expect(pedido.config.emailsAdicionais).toBe('');
    expect(pedido.config.canais).toEqual(['email', 'teams']);
  });

  it('notificação desativada não é pedida', () => {

    const definicao = montarDefinicao();
    definicao.elementos = definicao.elementos.map(elemento =>
      elemento.id === 'revisaoTecnica'
        ? { ...elemento, notificacoes: (elemento.notificacoes || []).map(item => ({ ...item, ativa: false })) }
        : elemento);

    const resultado = executarAcao(definicao, iniciar(definicao), {
      acaoChave: 'enviarRevisaoTecnica',
      comentario: '',
      valores: {},
      ator: ator('autor')
    });

    const chaves = ((resultado.instancia as IFluxoInstancia).notificacoesSolicitadas || []).map(item => item.config.chave);
    expect(chaves).not.toContain('n-chegou');
  });

  it('monta o texto com os marcadores', () => {

    const pedido: INotificacaoSolicitada = {
      chave: 'x',
      elementoId: 'e',
      elementoNome: 'Aprovação',
      origem: 'atividade',
      momento: 'aoConcluir',
      config: notificacao({}),
      responsaveisEtapa: [],
      acaoRotulo: 'Reprovar',
      comentario: 'Faltou a seção 3',
      executorNome: 'Fulano',
      prazo: '2026-11-20T12:00:00.000Z',
      solicitadaEm: '2026-11-18T12:00:00.000Z'
    };

    const texto = montarTextoNotificacao(
      '{registro} · {etapa} · {acao} · {comentario} · {executor} · {prazo} · {campo:area} · {campo:resp}',
      pedido,
      {
        origem: 'documento',
        alvoId: 'rev',
        registro: 'PRO-POP-004 Rev.01',
        revisao: '01',
        processo: 'Controle documental',
        valores: { area: 'Processos', resp: '{"id":"1","nome":"Maria","email":"maria@exemplo.com"}' },
        link: 'https://portal'
      }
    );

    expect(texto).toBe('PRO-POP-004 Rev.01 · Aprovação · Reprovar · Faltou a seção 3 · Fulano · 20/11/2026 · Processos · Maria');
  });

  it('valida a configuração', () => {
    const vazia = notificacao({ incluirResponsaveisEtapa: false, destinatarios: [], canais: [], assunto: '', mensagem: '' });
    expect(validarConfigNotificacao(vazia, 'Etapa').length).toBe(4);
    expect(validarConfigNotificacao({ ...vazia, ativa: false }, 'Etapa')).toEqual([]);
    expect(emailsDoTexto('a@x.com; b@y.com, inválido; A@X.COM')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('o evento de notificação vira evento de mensagem (círculo com carta) no BPMN', () => {
    const definicao = montarDefinicao();
    const xml = definicaoParaBpmnXml(definicao);
    expect(xml).toContain('<bpmn:messageEventDefinition id="eventoAviso_msg" />');
    expect((configPadraoElemento('eventoNotificacao').notificacoes || []).length).toBe(1);
  });
});
