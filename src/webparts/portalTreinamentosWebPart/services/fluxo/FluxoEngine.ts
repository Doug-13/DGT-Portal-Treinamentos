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

      const obrigatorio =
        campoObrigatorioAgora(
          elemento,
          campo.chave,
          valores,
          acao.resultado
        );

      if (
        obrigatorio &&
        !(valores[campo.chave] || '').trim()
      ) {
        erros.push(
          `Preencha: ${campo.rotulo}`
        );
      }
    }
  );

  return erros;
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
    'Publicação com dispensa de retreinamento (simulada)'
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
      destino.acaoSistema
    ) {

      acoesSistema.push(
        destino.acaoSistema
      );

      instancia.historico.unshift({
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
        sistema: false
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

      if (valor !== undefined) {
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
        !campo.validarNosResultados ||
        campo.validarNosResultados.length === 0 ||
        campo.validarNosResultados.indexOf(acao.resultado) >= 0;

      if (valor && relevante) {
        comentarioHistorico.push(
          `${campo.rotulo} ${campo.tipo === 'simNao' ? (valor === 'sim' ? 'Sim' : 'Não') : valor}`
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
    sistema: false
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
