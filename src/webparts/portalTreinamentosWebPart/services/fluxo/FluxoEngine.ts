import {
  AcaoSistemaFluxo,
  IFluxoAcao,
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoHistorico,
  IFluxoInstancia,
  IFluxoTarefa,
  IFluxoTransicao,
  StatusVisualElemento
} from '../../models/Fluxo';

import {
  resumoTabela,
  validarTabela
} from './valoresTabela';

import {
  ROTULO_HISTORICO_EVENTO_REVISAO,
  revisaoInteira,
  rotuloPeloEvento
} from '../../utils/numeracaoRevisao';

// ============================================================
// MOTOR DO FLUXO (lógica pura, sem acesso a dados)
//
// Recebe a definição e o estado atual e devolve o NOVO estado.
// Não grava nada: quem grava é o repositório.
//
// Por ser pura, esta lógica poderá ser levada quase linha a
// linha para a Custom API do Dataverse (dgt_ExecutarAcaoFluxo),
// onde a validação de permissão passa a ser feita no servidor.
// ============================================================

const LIMITE_PASSOS_AUTOMATICOS = 50;

export interface IDadosInicioFluxo {
  revisaoId: string;
  documentoId: string;
  revisao: string;
  ator: IFluxoAtor;
  simulado: boolean;
}

export interface IExecucaoAcao {
  acaoChave: string;
  comentario: string;
  valores: Record<string, string>;
  ator: IFluxoAtor;
}

export interface IResultadoExecucao {
  ok: boolean;
  erros: string[];
  instancia?: IFluxoInstancia;

  // Ações de sistema que o fluxo pediu para executar
  // (ex.: publicar a revisão). No modo de teste elas são apenas
  // descritas na tela, nunca executadas.
  acoesSistema: AcaoSistemaFluxo[];

  // Avisos não bloqueantes da gravação (ex.: réplica do histórico).
  avisos?: string[];
}

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

const gerarId = (
  prefixo: string
): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const agoraIso = (): string =>
  new Date().toISOString();

export const adicionarDiasUteis = (
  dataIso: string,
  dias: number
): string => {

  const data =
    new Date(dataIso);

  let restantes =
    dias;

  while (restantes > 0) {

    data.setDate(
      data.getDate() + 1
    );

    const diaSemana =
      data.getDay();

    if (
      diaSemana !== 0 &&
      diaSemana !== 6
    ) {
      restantes--;
    }
  }

  return data.toISOString();
};

const copiarInstancia = (
  instancia: IFluxoInstancia
): IFluxoInstancia => ({
  ...instancia,
  valores: { ...instancia.valores },
  percorridos: instancia.percorridos.slice(),
  transicoesPercorridas: instancia.transicoesPercorridas.slice(),
  tarefas: instancia.tarefas.map(tarefa => ({ ...tarefa })),
  historico: instancia.historico.slice()
});

export const obterElemento = (
  definicao: IFluxoDefinicao,
  elementoId: string
): IFluxoElemento | undefined =>
  definicao.elementos.find(
    elemento => elemento.id === elementoId
  );

export const obterElementoAtual = (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia
): IFluxoElemento | undefined =>
  obterElemento(
    definicao,
    instancia.elementoAtualId
  );

// ------------------------------------------------------------
// Permissão
// ------------------------------------------------------------

export const atorPodeExecutar = (
  elemento: IFluxoElemento | undefined,
  ator: IFluxoAtor
): boolean => {

  if (
    !elemento ||
    elemento.tipo !== 'tarefaHumana'
  ) {
    return false;
  }

  return elemento.responsaveis.some(
    responsavel =>
      ator.papeisTeste.indexOf(
        responsavel.papelTeste
      ) >= 0
  );
};

// ------------------------------------------------------------
// Validação de campos da etapa
// ------------------------------------------------------------

export const campoObrigatorioAgora = (
  elemento: IFluxoElemento,
  campoChave: string,
  valores: Record<string, string>,
  resultado: string
): boolean => {

  const campo =
    elemento.campos.find(
      item => item.chave === campoChave
    );

  if (!campo) {
    return false;
  }

  if (
    campo.validarNosResultados &&
    campo.validarNosResultados.length > 0 &&
    campo.validarNosResultados.indexOf(resultado) < 0
  ) {
    return false;
  }

  if (campo.obrigatorio) {
    return true;
  }

  if (campo.obrigatorioQuando) {
    return (
      (valores[campo.obrigatorioQuando.campo] || '') ===
      campo.obrigatorioQuando.valor
    );
  }

  return false;
};

export const validarAcao = (
  elemento: IFluxoElemento,
  acao: IFluxoAcao,
  comentario: string,
  valores: Record<string, string>
): string[] => {

  const erros: string[] = [];

  if (
    acao.exigeComentario &&
    !(comentario || '').trim()
  ) {
    erros.push(
      `O comentário é obrigatório para "${acao.rotulo}".`
    );
  }

  elemento.campos.forEach(
    campo => {

      if (campo.somenteLeitura) {
        return;
      }

      const valor =
        (valores[campo.chave] || '').trim();

      const obrigatorio =
        !acao.dispensaCampos &&
        campoObrigatorioAgora(
          elemento,
          campo.chave,
          valores,
          acao.resultado
        );

      if (campo.tipo === 'tabela') {
        validarTabela(
          campo.rotulo,
          campo.colunas || [],
          valor,
          obrigatorio
        ).forEach(erro => erros.push(erro));
        return;
      }

      if (obrigatorio && !valor) {
        erros.push(
          `Preencha: ${campo.rotulo}`
        );
        return;
      }

      if (!valor) {
        return;
      }

      if (
        campo.tipo === 'numero' &&
        Number.isNaN(Number(valor.replace(',', '.')))
      ) {
        erros.push(`"${campo.rotulo}" precisa ser um número.`);
      }

      if (
        campo.tipo === 'data' &&
        !/^\d{4}-\d{2}-\d{2}$/.test(valor)
      ) {
        erros.push(`"${campo.rotulo}" precisa ser uma data válida.`);
      }

      if (
        campo.tipo === 'lista' &&
        campo.opcoes &&
        campo.opcoes.indexOf(valor) < 0
      ) {
        erros.push(`"${campo.rotulo}" precisa ser uma das opções da lista.`);
      }

      if (
        campo.tipo === 'simNao' &&
        valor !== 'sim' &&
        valor !== 'nao'
      ) {
        erros.push(`Responda "${campo.rotulo}" com Sim ou Não.`);
      }
    }
  );

  return erros;
};

export const formatarValorCampo = (
  tipo: string,
  valor: string
): string => {

  if (!valor) {
    return '';
  }

  if (tipo === 'simNao') {
    return valor === 'sim' ? 'Sim' : 'Não';
  }

  if (tipo === 'tabela') {
    return resumoTabela(valor);
  }

  if (tipo === 'data') {
    const partes =
      valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    return partes
      ? `${partes[3]}/${partes[2]}/${partes[1]}`
      : valor;
  }

  return valor;
};

// ------------------------------------------------------------
// Escolha da transição de saída
// ------------------------------------------------------------

const transicaoAtende = (
  transicao: IFluxoTransicao,
  resultado: string,
  valores: Record<string, string>
): boolean => {

  switch (transicao.tipoCondicao) {

    case 'sempre':
      return true;

    case 'resultado':
      return (transicao.resultado || '') === resultado;

    case 'campo':
      return (
        (valores[transicao.campo || ''] || '') ===
        (transicao.valorEsperado || '')
      );

    default:
      return false;
  }
};

export const escolherTransicao = (
  definicao: IFluxoDefinicao,
  origemId: string,
  resultado: string,
  valores: Record<string, string>
): IFluxoTransicao | undefined => {

  const saidas =
    definicao.transicoes.filter(
      transicao => transicao.origemId === origemId
    );

  // Primeiro as condições específicas; a transição padrão só é
  // usada se nenhuma condição for atendida.
  const especifica =
    saidas.find(
      transicao =>
        transicao.tipoCondicao !== 'sempre' &&
        transicaoAtende(transicao, resultado, valores)
    );

  if (especifica) {
    return especifica;
  }

  const sempre =
    saidas.find(
      transicao => transicao.tipoCondicao === 'sempre'
    );

  if (sempre) {
    return sempre;
  }

  return saidas.find(
    transicao => transicao.padrao
  );
};

// ------------------------------------------------------------
// Reprovação / devolução
//
// Regra de segurança: uma ação de reprovação ou devolução NUNCA
// pode levar a revisão ao fim do fluxo nem à publicação, mesmo que
// os caminhos do fluxo tenham sido configurados errado. A ação é
// reconhecida pelo texto (chave, resultado ou nome do botão).
// ------------------------------------------------------------

const PADRAO_DEVOLUCAO =
  /reprov|ajust|devol|rejeit|recus|corrig|negad|indefer|nao aprov|retorn/;

const normalizarTexto = (
  valor?: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const ehAcaoDeDevolucao = (
  acao: Pick<IFluxoAcao, 'chave' | 'resultado' | 'rotulo'>
): boolean =>
  PADRAO_DEVOLUCAO.test(
    normalizarTexto(`${acao.chave} ${acao.resultado} ${acao.rotulo}`)
  );

export const ACOES_DE_PUBLICACAO: AcaoSistemaFluxo[] = [
  'publicarComRetreinamento',
  'publicarSemRetreinamento'
];

// ------------------------------------------------------------
// Movimentação
// ------------------------------------------------------------

const registrarPercurso = (
  instancia: IFluxoInstancia,
  transicao: IFluxoTransicao
): void => {

  const indiceExistente =
    instancia.percorridos.indexOf(
      transicao.destinoId
    );

  if (indiceExistente >= 0) {

    // Voltou para uma etapa anterior (devolução/reprovação):
    // tudo o que vinha depois dela volta a ficar pendente no
    // diagrama. O HISTÓRICO não é alterado. As transições que
    // ficaram sem origem são limpas em limparTransicoesOrfas.
    instancia.percorridos =
      instancia.percorridos.slice(0, indiceExistente);
  }

  instancia.percorridos.push(
    transicao.destinoId
  );

  instancia.transicoesPercorridas.push(
    transicao.id
  );
};

const limparTransicoesOrfas = (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia
): void => {

  instancia.transicoesPercorridas =
    instancia.transicoesPercorridas.filter(
      id => {
        const transicao =
          definicao.transicoes.find(
            item => item.id === id
          );

        return (
          !!transicao &&
          instancia.percorridos.indexOf(transicao.origemId) >= 0 &&
          instancia.percorridos.indexOf(transicao.destinoId) >= 0
        );
      }
    );
};

const criarTarefa = (
  elemento: IFluxoElemento,
  agora: string
): IFluxoTarefa => ({
  id: gerarId('tarefa'),
  elementoId: elemento.id,
  elementoNome: elemento.nome,
  responsaveis: elemento.responsaveis.slice(),
  status: 'pendente',
  criadaEm: agora,
  prazo:
    elemento.prazoDiasUteis
      ? adicionarDiasUteis(agora, elemento.prazoDiasUteis)
      : undefined
});

const DESCRICAO_ACAO_SISTEMA: Record<AcaoSistemaFluxo, string> = {
  publicarComRetreinamento:
    'Publicação com retreinamento (simulada)',
  publicarSemRetreinamento:
    'Publicação com dispensa de retreinamento (simulada)',
  novaRevisao:
    'Revisão fechada na revisão inteira',
  novaSubRevisao:
    'Nova sub-revisão',
  proximaRevisao:
    'Nova revisão'
};

// Avança automaticamente por gateways e tarefas de sistema até
// parar numa tarefa humana ou no fim.
const avancar = (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia,
  origemId: string,
  resultado: string,
  agora: string,
  acoesSistema: AcaoSistemaFluxo[]
): string[] => {

  let atualId =
    origemId;

  let resultadoAtual =
    resultado;

  for (
    let passo = 0;
    passo < LIMITE_PASSOS_AUTOMATICOS;
    passo++
  ) {

    const transicao =
      escolherTransicao(
        definicao,
        atualId,
        resultadoAtual,
        instancia.valores
      );

    if (!transicao) {
      return [
        `Nenhuma transição de saída atende à condição a partir de "${atualId}". Revise a configuração do fluxo.`
      ];
    }

    const destino =
      obterElemento(
        definicao,
        transicao.destinoId
      );

    if (!destino) {
      return [
        `A transição "${transicao.id}" aponta para uma etapa inexistente (${transicao.destinoId}).`
      ];
    }

    registrarPercurso(
      instancia,
      transicao
    );

    instancia.elementoAtualId =
      destino.id;

    // Etapa com status "Vigente": ao chegar, a revisão é PUBLICADA
    // (com ou sem retreinamento) e o fluxo desta revisão termina.
    // Revisar depois = nova revisão (Rev.01A...), com o próprio fluxo.
    if (
      destino.tipo === 'tarefaHumana' &&
      destino.statusDocumento === 'Vigente'
    ) {

      const regra =
        destino.retreinamentoAoPublicar || 'nao';

      const comRetreinamento =
        regra === 'sim' ||
        (
          regra.indexOf('etapa:') === 0 &&
          instancia.percorridos.indexOf(regra.substring(6)) >= 0
        );

      const acao: AcaoSistemaFluxo =
        comRetreinamento
          ? 'publicarComRetreinamento'
          : 'publicarSemRetreinamento';

      acoesSistema.push(
        acao
      );

      // Revisão publicada nunca tem letra.
      instancia.revisao =
        revisaoInteira(instancia.revisao);

      instancia.historico.unshift({
        revisao: instancia.revisao,
        id: gerarId('hist'),
        data: agora,
        elementoId: destino.id,
        elementoNome: destino.nome,
        acaoChave: acao,
        acaoRotulo:
          `Revisão ${instancia.revisao} publicada — vigente ` +
          (comRetreinamento ? '(com retreinamento)' : '(sem retreinamento)'),
        resultado: 'publicado',
        executadoPorId: 'sistema',
        executadoPorNome: 'Sistema',
        sistema: true
      });

      instancia.status =
        'concluido';

      instancia.concluidoEm =
        agora;

      limparTransicoesOrfas(
        definicao,
        instancia
      );

      return [];
    }

    if (destino.tipo === 'tarefaHumana') {

      instancia.tarefas.push(
        criarTarefa(destino, agora)
      );

      limparTransicoesOrfas(
        definicao,
        instancia
      );

      return [];
    }

    if (destino.tipo === 'fim') {

      instancia.status =
        'concluido';

      instancia.concluidoEm =
        agora;

      limparTransicoesOrfas(
        definicao,
        instancia
      );

      return [];
    }

    if (
      destino.tipo === 'tarefaSistema' &&
      !destino.acaoSistema
    ) {

      instancia.historico.unshift({
        revisao: instancia.revisao,
        id: gerarId('hist'),
        data: agora,
        elementoId: destino.id,
        elementoNome: destino.nome,
        acaoChave: 'automatica',
        acaoRotulo: 'Etapa automática concluída (simulada)',
        resultado: 'concluido',
        executadoPorId: 'sistema',
        executadoPorNome: 'Sistema',
        sistema: true
      });

      resultadoAtual =
        'concluido';
    }

    if (
      destino.tipo === 'tarefaSistema' &&
      destino.acaoSistema
    ) {

      acoesSistema.push(
        destino.acaoSistema
      );

      instancia.historico.unshift({
        revisao: instancia.revisao,
        id: gerarId('hist'),
        data: agora,
        elementoId: destino.id,
        elementoNome: destino.nome,
        acaoChave: destino.acaoSistema,
        acaoRotulo: DESCRICAO_ACAO_SISTEMA[destino.acaoSistema],
        resultado: 'concluido',
        executadoPorId: 'sistema',
        executadoPorNome: 'Sistema',
        sistema: true
      });

      resultadoAtual =
        'concluido';
    }

    // Evento de revisão: pede para renumerar a revisão e segue.
    // Mantém o resultado da última ação humana (como um gateway),
    // para que uma decisão logo depois continue funcionando.
    if (destino.tipo === 'eventoRevisao') {

      const acao: AcaoSistemaFluxo =
        destino.tipoRevisao === 'subrevisao'
          ? 'novaSubRevisao'
          : destino.tipoRevisao === 'novaRevisao'
            ? 'proximaRevisao'
            : 'novaRevisao';

      acoesSistema.push(
        acao
      );

      // O motor já define o novo rótulo (00 → 00A, 00B → 00);
      // quem grava em dgt_revisao é a tarefa automática.
      const rotuloAnterior =
        instancia.revisao;

      // Já houve um fechamento de revisão neste fluxo? (Sem isso, uma
      // revisão antiga criada sem letra pularia número na aprovação.)
      const jaFechada =
        instancia.historico.some(
          passo =>
            passo.sistema &&
            (passo.acaoChave === 'novaRevisao' || passo.acaoChave === 'proximaRevisao')
        );

      instancia.revisao =
        rotuloPeloEvento(
          destino.tipoRevisao || 'revisao',
          rotuloAnterior,
          jaFechada
        );

      instancia.historico.unshift({
        revisao: instancia.revisao,
        id: gerarId('hist'),
        data: agora,
        elementoId: destino.id,
        elementoNome: destino.nome,
        acaoChave: acao,
        acaoRotulo:
          rotuloAnterior === instancia.revisao
            ? `${ROTULO_HISTORICO_EVENTO_REVISAO[destino.tipoRevisao || 'revisao']}: ${instancia.revisao} (sem alteração)`
            : `${ROTULO_HISTORICO_EVENTO_REVISAO[destino.tipoRevisao || 'revisao']}: ${rotuloAnterior} → ${instancia.revisao}`,
        resultado: 'concluido',
        executadoPorId: 'sistema',
        executadoPorNome: 'Sistema',
        sistema: true
      });
    }

    // Gateways mantêm o resultado da última ação humana.
    atualId =
      destino.id;
  }

  return [
    'O fluxo excedeu o limite de passos automáticos. Verifique se há um laço entre gateways.'
  ];
};

// ------------------------------------------------------------
// API pública do motor
// ------------------------------------------------------------

export const iniciarInstancia = (
  definicao: IFluxoDefinicao,
  dados: IDadosInicioFluxo
): IResultadoExecucao => {

  const agora =
    agoraIso();

  const inicio =
    definicao.elementos.find(
      elemento => elemento.tipo === 'inicio'
    );

  if (!inicio) {
    return {
      ok: false,
      erros: ['O fluxo não possui evento de início.'],
      acoesSistema: []
    };
  }

  const instancia: IFluxoInstancia = {
    revisaoId: dados.revisaoId,
    documentoId: dados.documentoId,
    revisao: dados.revisao,
    fluxoId: definicao.id,
    fluxoVersao: definicao.versao,
    elementoAtualId: inicio.id,
    status: 'emAndamento',
    valores: {},
    percorridos: [inicio.id],
    transicoesPercorridas: [],
    tarefas: [],
    historico: [
      {
        id: gerarId('hist'),
        data: agora,
        elementoId: inicio.id,
        elementoNome: inicio.nome,
        acaoChave: 'iniciar',
        acaoRotulo: `Fluxo iniciado (${definicao.nome} v${definicao.versao})`,
        resultado: 'iniciado',
        executadoPorId: dados.ator.id,
        executadoPorNome: dados.ator.nome,
        sistema: false,
        revisao: dados.revisao
      }
    ],
    iniciadoEm: agora,
    simulado: dados.simulado
  };

  const acoesSistema: AcaoSistemaFluxo[] = [];

  const erros =
    avancar(
      definicao,
      instancia,
      inicio.id,
      'iniciado',
      agora,
      acoesSistema
    );

  return {
    ok: erros.length === 0,
    erros,
    instancia: erros.length === 0 ? instancia : undefined,
    acoesSistema
  };
};

export const executarAcao = (
  definicao: IFluxoDefinicao,
  instanciaOriginal: IFluxoInstancia,
  execucao: IExecucaoAcao
): IResultadoExecucao => {

  if (instanciaOriginal.status === 'concluido') {
    return {
      ok: false,
      erros: ['Este fluxo já foi concluído.'],
      acoesSistema: []
    };
  }

  if (
    instanciaOriginal.fluxoId !== definicao.id ||
    instanciaOriginal.fluxoVersao !== definicao.versao
  ) {
    return {
      ok: false,
      erros: [
        'A definição informada não é a mesma versão com que esta revisão começou.'
      ],
      acoesSistema: []
    };
  }

  const elemento =
    obterElementoAtual(
      definicao,
      instanciaOriginal
    );

  if (
    !elemento ||
    elemento.tipo !== 'tarefaHumana'
  ) {
    return {
      ok: false,
      erros: ['A etapa atual não aceita ações manuais.'],
      acoesSistema: []
    };
  }

  if (
    !atorPodeExecutar(
      elemento,
      execucao.ator
    )
  ) {
    return {
      ok: false,
      erros: [
        `${execucao.ator.nome} não é responsável pela etapa "${elemento.nome}".`
      ],
      acoesSistema: []
    };
  }

  const acao =
    elemento.acoes.find(
      item => item.chave === execucao.acaoChave
    );

  if (!acao) {
    return {
      ok: false,
      erros: ['Ação não disponível nesta etapa.'],
      acoesSistema: []
    };
  }

  // Só aceita valores dos campos que pertencem à etapa.
  const valoresEtapa: Record<string, string> = {};

  elemento.campos.forEach(
    campo => {
      const valor =
        execucao.valores[campo.chave];

      if (
        valor !== undefined &&
        !campo.somenteLeitura
      ) {
        valoresEtapa[campo.chave] =
          valor;
      }
    }
  );

  const valoresConsolidados: Record<string, string> = {
    ...instanciaOriginal.valores,
    ...valoresEtapa
  };

  const erros =
    validarAcao(
      elemento,
      acao,
      execucao.comentario,
      valoresConsolidados
    );

  if (erros.length > 0) {
    return {
      ok: false,
      erros,
      acoesSistema: []
    };
  }

  const agora =
    agoraIso();

  const instancia =
    copiarInstancia(
      instanciaOriginal
    );

  instancia.valores =
    valoresConsolidados;

  instancia.tarefas.forEach(
    tarefa => {
      if (
        tarefa.status === 'pendente' &&
        tarefa.elementoId === elemento.id
      ) {
        tarefa.status = 'concluida';
        tarefa.concluidaEm = agora;
        tarefa.concluidaPorNome = execucao.ator.nome;
      }
    }
  );

  const comentarioHistorico: string[] = [];

  if ((execucao.comentario || '').trim()) {
    comentarioHistorico.push(
      execucao.comentario.trim()
    );
  }

  elemento.campos.forEach(
    campo => {
      const valor =
        valoresEtapa[campo.chave];

      // Só registra o campo quando ele faz sentido para a ação
      // executada (ex.: a resposta de retreinamento não entra no
      // histórico de uma reprovação).
      const relevante =
        !acao.dispensaCampos &&
        (
          !campo.validarNosResultados ||
          campo.validarNosResultados.length === 0 ||
          campo.validarNosResultados.indexOf(acao.resultado) >= 0
        );

      if (valor && relevante) {
        comentarioHistorico.push(
          `${campo.rotulo} ${formatarValorCampo(campo.tipo, valor)}`
        );
      }
    }
  );

  const entrada: IFluxoHistorico = {
    id: gerarId('hist'),
    data: agora,
    elementoId: elemento.id,
    elementoNome: elemento.nome,
    acaoChave: acao.chave,
    acaoRotulo: acao.rotulo,
    resultado: acao.resultado,
    comentario:
      comentarioHistorico.length > 0
        ? comentarioHistorico.join(' · ')
        : undefined,
    executadoPorId: execucao.ator.id,
    executadoPorNome: execucao.ator.nome,
    sistema: false,
    revisao: instancia.revisao
  };

  instancia.historico.unshift(
    entrada
  );

  const acoesSistema: AcaoSistemaFluxo[] = [];

  const errosAvanco =
    avancar(
      definicao,
      instancia,
      elemento.id,
      acao.resultado,
      agora,
      acoesSistema
    );

  if (errosAvanco.length > 0) {
    return {
      ok: false,
      erros: errosAvanco,
      acoesSistema: []
    };
  }

  // Trava de segurança: reprovação nunca conclui nem publica.
  if (ehAcaoDeDevolucao(acao)) {

    const publicaria =
      acoesSistema.some(item => ACOES_DE_PUBLICACAO.indexOf(item) >= 0);

    // Devolver é VOLTAR: a próxima etapa precisa ser uma das já
    // percorridas por esta revisão (ex.: Elaboração). Ir para uma
    // etapa nova (ex.: "Documento Vigente") é caminho trocado.
    const destino =
      obterElemento(definicao, instancia.elementoAtualId);

    const avancaria =
      instancia.status !== 'concluido' &&
      !!destino &&
      destino.tipo === 'tarefaHumana' &&
      instanciaOriginal.percorridos.indexOf(destino.id) < 0;

    if (avancaria && destino) {
      return {
        ok: false,
        erros: [
          `A ação "${acao.rotulo}" é uma reprovação/devolução, mas o fluxo deste processo a levaria para a etapa ` +
          `"${destino.nome}", que ainda não foi percorrida por esta revisão (ela deveria voltar para uma etapa anterior). ` +
          'A ação foi bloqueada e nada foi gravado. Confira os caminhos da decisão no fluxo do processo e publique uma nova versão.'
        ],
        acoesSistema: []
      };
    }

    if (publicaria || instancia.status === 'concluido') {
      return {
        ok: false,
        erros: [
          `A ação "${acao.rotulo}" é uma reprovação/devolução, mas o fluxo deste processo a levaria ` +
          `${publicaria ? 'à publicação' : 'ao fim'} da revisão. A ação foi bloqueada e nada foi gravado. ` +
          'Corrija os caminhos da decisão no fluxo do processo (o caminho de reprovação deve voltar para uma etapa anterior) ' +
          'e publique uma nova versão do fluxo.'
        ],
        acoesSistema: []
      };
    }
  }

  // Ao voltar para uma etapa já percorrida, o valor dos campos
  // das etapas seguintes deixa de valer (será respondido de novo).
  if (instancia.status !== 'concluido') {
    definicao.elementos.forEach(
      item => {
        if (instancia.percorridos.indexOf(item.id) < 0) {
          item.campos.forEach(
            campo => {
              delete instancia.valores[campo.chave];
            }
          );
        }
      }
    );
  }

  return {
    ok: true,
    erros: [],
    instancia,
    acoesSistema
  };
};

// ------------------------------------------------------------
// Apoio à exibição do diagrama
// ------------------------------------------------------------

export const statusVisualElemento = (
  instancia: IFluxoInstancia,
  elementoId: string
): StatusVisualElemento => {

  if (
    instancia.status === 'emAndamento' &&
    instancia.elementoAtualId === elementoId
  ) {
    return 'atual';
  }

  if (instancia.percorridos.indexOf(elementoId) >= 0) {
    return 'concluido';
  }

  return instancia.status === 'concluido'
    ? 'naoPercorrido'
    : 'pendente';
};

export const tarefaPendente = (
  instancia: IFluxoInstancia
): IFluxoTarefa | undefined =>
  instancia.tarefas.find(
    tarefa => tarefa.status === 'pendente'
  );
