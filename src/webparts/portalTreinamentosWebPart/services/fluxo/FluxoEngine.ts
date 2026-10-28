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
  formatarValorUsuario,
  validarValorUsuario
} from './valorUsuario';

import {
  ehTipoDocumento,
  formatarValorDocumentos,
  validarValorDocumentos
} from './valorDocumento';

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

      if (campo.tipo === 'usuario') {
        const erroUsuario = validarValorUsuario(campo.rotulo, valor);
        if (erroUsuario) {
          erros.push(erroUsuario);
        }
      }

      if (ehTipoDocumento(campo.tipo)) {
        const erroDocumento = validarValorDocumentos(campo.rotulo, campo.tipo, valor);
        if (erroDocumento) {
          erros.push(erroDocumento);
        }
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

  if (tipo === 'usuario') {
    return formatarValorUsuario(valor);
  }

  if (ehTipoDocumento(tipo)) {
    return formatarValorDocumentos(valor);
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

// ------------------------------------------------------------
// Retreinamento na publicação pela etapa "Vigente": decidido pelo
// próprio fluxo, sem configuração:
//
//   1. Resposta de um campo de retreinamento (ex.: "Esta revisão
//      exige retreinamento?" = Sim/Não), se houver.
//   2. Caminho percorrido neste ciclo: passou por uma etapa OPCIONAL
//      cujo nome fala de treinamento (ex.: "Revisar Treinamento", que
//      só existe no caminho "Retreinar? → Sim") → com retreinamento.
//   3. Última resposta dada numa etapa sobre treinamento
//      (ex.: "Realizar retreinamento?" → Sim/Não).
//   4. Sem nenhuma indicação → sem retreinamento.
// ------------------------------------------------------------

const PADRAO_TREINAMENTO = /trein/;
const PADRAO_SIM = /(^|[^a-z])(sim|yes|retreinar|realizar|exige)([^a-z]|$)/;
const PADRAO_NAO = /(^|[^a-z])(nao|no|sem|dispens|dispensar)([^a-z]|$)/;

const textoNormal = (
  valor?: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// O alvo continua alcançável a partir do Início sem passar por "excluido"?
const alcancavelSem = (
  definicao: IFluxoDefinicao,
  alvoId: string,
  excluidoId: string
): boolean => {

  const inicio =
    definicao.elementos.find(item => item.tipo === 'inicio');

  if (!inicio) {
    return false;
  }

  const visitados: string[] = [inicio.id];
  const fila: string[] = [inicio.id];

  while (fila.length > 0) {

    const atual = fila.shift() as string;

    if (atual === alvoId) {
      return true;
    }

    definicao.transicoes
      .filter(transicao => transicao.origemId === atual)
      .forEach(transicao => {
        if (
          transicao.destinoId !== excluidoId &&
          visitados.indexOf(transicao.destinoId) < 0
        ) {
          visitados.push(transicao.destinoId);
          fila.push(transicao.destinoId);
        }
      });
  }

  return false;
};

const textoDoPasso = (
  passo: { acaoRotulo: string; resultado: string; acaoChave: string }
): string =>
  `${passo.acaoRotulo} ${passo.resultado} ${passo.acaoChave}`;

export const retreinamentoDecididoNoFluxo = (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia,
  etapaVigenteId: string
): boolean => {

  // 1. Campo de retreinamento respondido
  const chaveCampo =
    Object.keys(instancia.valores || {}).find(
      chave =>
        PADRAO_TREINAMENTO.test(textoNormal(chave)) &&
        !/justific|prazo/.test(textoNormal(chave))
    );

  if (chaveCampo) {
    const valor = textoNormal(String(instancia.valores[chaveCampo]));
    if (valor === 'sim' || valor === 'true') return true;
    if (valor === 'nao' || valor === 'false') return false;
  }

  // 2. Passou por etapa opcional de treinamento neste ciclo
  const passouPorOpcional =
    instancia.percorridos.some(
      id => {
        const elemento = obterElemento(definicao, id);
        return (
          !!elemento &&
          elemento.id !== etapaVigenteId &&
          elemento.tipo === 'tarefaHumana' &&
          PADRAO_TREINAMENTO.test(textoNormal(elemento.nome)) &&
          alcancavelSem(definicao, etapaVigenteId, elemento.id)
        );
      }
    );

  if (passouPorOpcional) {
    return true;
  }

  // 3. Última resposta numa etapa sobre treinamento (deste ciclo)
  const resposta =
    instancia.historico.find(
      passo =>
        !passo.sistema &&
        instancia.percorridos.indexOf(passo.elementoId) >= 0 &&
        PADRAO_TREINAMENTO.test(textoNormal(passo.elementoNome))
    );

  if (resposta) {
    const texto = textoNormal(textoDoPasso(resposta));
    if (PADRAO_NAO.test(texto)) return false;
    if (PADRAO_SIM.test(texto)) return true;
  }

  // 4. Sem indicação
  return false;
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

// Só é apagado o valor de um campo que é PREENCHIDO (editável) em
// etapas fora do caminho atual e em NENHUMA etapa do caminho. Assim
// um metadado preenchido na Elaboração e exibido (somente leitura)
// nas etapas seguintes nunca é apagado ao avançar.
const limparValoresForaDoCaminho = (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia
): void => {

  const chavesDoCaminho: string[] = [];

  definicao.elementos
    .filter(item => instancia.percorridos.indexOf(item.id) >= 0)
    .forEach(item =>
      item.campos
        .filter(campo => !campo.somenteLeitura)
        .forEach(campo => chavesDoCaminho.push(campo.chave))
    );

  definicao.elementos
    .filter(item => instancia.percorridos.indexOf(item.id) < 0)
    .forEach(item =>
      item.campos
        .filter(campo => !campo.somenteLeitura && chavesDoCaminho.indexOf(campo.chave) < 0)
        .forEach(campo => {
          delete instancia.valores[campo.chave];
        })
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
    'Nova revisão',
  removerArquivoRevisao:
    'Arquivo da revisão removido (o novo será anexado na próxima etapa)'
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

      const comRetreinamento =
        retreinamentoDecididoNoFluxo(
          definicao,
          instancia,
          destino.id
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

      // Opcional: a nova revisão começa sem arquivo.
      if (destino.removerArquivo) {

        acoesSistema.push(
          'removerArquivoRevisao'
        );

        instancia.historico.unshift({
          revisao: instancia.revisao,
          id: gerarId('hist'),
          data: agora,
          elementoId: destino.id,
          elementoNome: destino.nome,
          acaoChave: 'removerArquivoRevisao',
          acaoRotulo: DESCRICAO_ACAO_SISTEMA.removerArquivoRevisao,
          resultado: 'concluido',
          executadoPorId: 'sistema',
          executadoPorNome: 'Sistema',
          sistema: true
        });
      }
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

  if (instanciaOriginal.status === 'cancelado') {
    return {
      ok: false,
      erros: ['Esta revisão foi cancelada por um administrador.'],
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

  // Ao VOLTAR para uma etapa já percorrida, as respostas dadas nas
  // etapas seguintes deixam de valer (serão respondidas de novo).
  if (instancia.status !== 'concluido') {
    limparValoresForaDoCaminho(definicao, instancia);
  }

  return {
    ok: true,
    erros: [],
    instancia,
    acoesSistema
  };
};

// ------------------------------------------------------------
// RETORNO DE UM PASSO (somente administrador)
//
// Corrige um avanço indevido voltando a revisão UMA etapa, para o
// lugar onde ela estava imediatamente antes — e só para lá:
//
//   • modo 'etapa': volta para a etapa humana anterior do caminho
//     desta revisão. Se nesse trecho houve um evento de revisão
//     (ex.: 00A → 00B), o número anterior é restaurado; se o arquivo
//     foi removido pelo evento, o endereço anterior é devolvido para
//     ser regravado.
//   • modo 'revisao': a revisão está na 1ª etapa (ex.: Rev.01A em
//     Elaboração, aberta a partir da Rev.00 vigente). Voltar um passo
//     é CANCELAR esta revisão: o documento volta para a revisão
//     vigente. Só é permitido quando existe revisão vigente.
//
// Nunca apaga histórico: o passo é registrado como
// "alterado por administrador", com a justificativa.
// ------------------------------------------------------------

// Endereço do arquivo removido por um evento de revisão (guardado
// nos valores da instância para poder ser restaurado no retorno).
export const CHAVE_ARQUIVO_ANTERIOR = '__arquivoAnteriorUrl';

export const ACAO_RETORNO_ADMINISTRADOR = 'retornoAdministrador';

export const ACAO_CANCELAMENTO_ADMINISTRADOR = 'cancelarRevisaoAdministrador';

export type ModoRetornoFluxo =
  | 'etapa'
  | 'revisao';

export interface IDadosRetornoFluxo {
  ator: IFluxoAtor;
  justificativa: string;
  // Só com revisão vigente (e fora do modo de teste) a 1ª etapa pode
  // voltar para ela (cancelando a revisão em andamento).
  permitirCancelarRevisao: boolean;
  revisaoVigente?: string;
  // O que o usuário viu e confirmou na tela. Se o estado relido for
  // diferente (alguém agiu no meio-tempo), nada é feito.
  modoEsperado?: ModoRetornoFluxo;
  destinoEsperadoId?: string;
}

export interface IResultadoRetorno {
  ok: boolean;
  erros: string[];
  modo?: ModoRetornoFluxo;
  instancia?: IFluxoInstancia;
  etapaOrigem?: string;
  etapaDestino?: string;
  destinoId?: string;
  statusDestino?: string;
  rotuloAnterior?: string;
  // Preenchido quando o retorno desfaz um evento de revisão.
  rotuloRestaurado?: string;
  arquivoRemovidoNoTrecho?: boolean;
  arquivoRestaurarUrl?: string;
  avisos?: string[];
}

const ACOES_EVENTO_REVISAO = ['novaRevisao', 'novaSubRevisao', 'proximaRevisao'];

export const retornarUmPasso = (
  definicao: IFluxoDefinicao,
  instanciaOriginal: IFluxoInstancia,
  dados: IDadosRetornoFluxo
): IResultadoRetorno => {

  if (instanciaOriginal.status === 'concluido') {
    return {
      ok: false,
      erros: ['Esta revisão já foi concluída (publicada). Para alterar o documento, crie uma nova revisão.']
    };
  }

  if (instanciaOriginal.status === 'cancelado') {
    return {
      ok: false,
      erros: ['Esta revisão já foi cancelada.']
    };
  }

  if (
    instanciaOriginal.fluxoId !== definicao.id ||
    instanciaOriginal.fluxoVersao !== definicao.versao
  ) {
    return {
      ok: false,
      erros: ['A definição informada não é a mesma versão com que esta revisão começou.']
    };
  }

  const atual =
    obterElementoAtual(definicao, instanciaOriginal);

  if (!atual || atual.tipo !== 'tarefaHumana') {
    return {
      ok: false,
      erros: ['A etapa atual não permite retorno.']
    };
  }

  const justificativa =
    (dados.justificativa || '').trim();

  if (!justificativa) {
    return {
      ok: false,
      erros: ['Informe a justificativa do retorno.']
    };
  }

  const agora =
    agoraIso();

  const instancia =
    copiarInstancia(instanciaOriginal);

  // Pendência da etapa atual: cancelada (não apagada).
  const cancelarPendentes = (): void => {
    instancia.tarefas.forEach(
      tarefa => {
        if (tarefa.status === 'pendente') {
          tarefa.status = 'cancelada';
          tarefa.concluidaEm = agora;
          tarefa.concluidaPorNome = dados.ator.nome;
        }
      }
    );
  };

  // Etapa humana imediatamente anterior no caminho desta revisão.
  const indiceAtual =
    instancia.percorridos.lastIndexOf(atual.id);

  let destino: IFluxoElemento | undefined;

  for (let indice = indiceAtual - 1; indice >= 0; indice--) {
    const elemento =
      obterElemento(definicao, instancia.percorridos[indice]);

    if (elemento && elemento.tipo === 'tarefaHumana') {
      destino = elemento;
      break;
    }
  }

  const mudouDesdeAPrevia =
    (!!dados.modoEsperado && dados.modoEsperado !== (destino ? 'etapa' : 'revisao')) ||
    (!!dados.destinoEsperadoId && !!destino && destino.id !== dados.destinoEsperadoId);

  if (mudouDesdeAPrevia) {
    return {
      ok: false,
      erros: ['A revisão foi alterada por outra pessoa desde que a tela foi aberta. Recarregue a página e confira antes de voltar a etapa.']
    };
  }

  // ---------- 1ª etapa: volta para a revisão vigente ----------
  if (!destino) {

    if (!dados.permitirCancelarRevisao || !dados.revisaoVigente) {
      return {
        ok: false,
        erros: [
          `A revisão está na primeira etapa do fluxo ("${atual.nome}") e não há revisão vigente para a qual voltar.`
        ]
      };
    }

    cancelarPendentes();

    instancia.status = 'cancelado';
    instancia.concluidoEm = agora;

    instancia.historico.unshift({
      id: gerarId('hist'),
      data: agora,
      elementoId: atual.id,
      elementoNome: atual.nome,
      acaoChave: ACAO_CANCELAMENTO_ADMINISTRADOR,
      acaoRotulo:
        `Revisão ${instancia.revisao} cancelada — alterado por administrador ` +
        `(retorno para a ${dados.revisaoVigente} vigente)`,
      resultado: 'retornado',
      comentario: justificativa,
      executadoPorId: dados.ator.id,
      executadoPorNome: dados.ator.nome,
      sistema: false,
      revisao: instancia.revisao
    });

    return {
      ok: true,
      erros: [],
      modo: 'revisao',
      instancia,
      etapaOrigem: atual.nome,
      etapaDestino: `Vigente (${dados.revisaoVigente})`,
      rotuloAnterior: instanciaOriginal.revisao
    };
  }

  // ---------- Etapa anterior desta revisão ----------
  const destinoFinal =
    destino;

  // Trecho a desfazer: tudo o que aconteceu depois da última ação
  // executada na etapa de destino (histórico: mais novo primeiro).
  const indiceAcaoDestino =
    instancia.historico.findIndex(
      passo =>
        !passo.sistema &&
        passo.elementoId === destinoFinal.id &&
        passo.acaoChave !== ACAO_RETORNO_ADMINISTRADOR
    );

  const trecho =
    indiceAcaoDestino >= 0
      ? instancia.historico.slice(0, indiceAcaoDestino)
      : [];

  const houveEventoRevisao =
    trecho.some(
      passo => passo.sistema && ACOES_EVENTO_REVISAO.indexOf(passo.acaoChave) >= 0
    );

  let rotuloRestaurado: string | undefined;

  if (houveEventoRevisao) {

    const rotuloNaEtapa =
      instancia.historico[indiceAcaoDestino].revisao;

    if (!rotuloNaEtapa) {
      return {
        ok: false,
        erros: [
          'Entre a etapa atual e a anterior houve mudança no número da revisão, mas o registro antigo não guarda o número anterior. ' +
          'O retorno foi bloqueado para não deixar a revisão com número errado.'
        ]
      };
    }

    if (rotuloNaEtapa !== instancia.revisao) {
      rotuloRestaurado = rotuloNaEtapa;
      instancia.revisao = rotuloNaEtapa;
    }
  }

  const arquivoRemovidoNoTrecho =
    trecho.some(
      passo => passo.sistema && passo.acaoChave === 'removerArquivoRevisao'
    );

  const arquivoRestaurarUrl =
    arquivoRemovidoNoTrecho
      ? (instancia.valores[CHAVE_ARQUIVO_ANTERIOR] || undefined)
      : undefined;

  if (arquivoRemovidoNoTrecho) {
    delete instancia.valores[CHAVE_ARQUIVO_ANTERIOR];
  }

  cancelarPendentes();

  // A revisão reassume a etapa de destino.
  instancia.percorridos =
    instancia.percorridos.slice(
      0,
      instancia.percorridos.lastIndexOf(destinoFinal.id) + 1
    );

  limparTransicoesOrfas(definicao, instancia);

  instancia.elementoAtualId =
    destinoFinal.id;

  instancia.tarefas.push(
    criarTarefa(destinoFinal, agora)
  );

  limparValoresForaDoCaminho(definicao, instancia);

  const detalhes: string[] = [justificativa];

  if (rotuloRestaurado) {
    detalhes.push(`Número da revisão restaurado: ${instanciaOriginal.revisao} → ${rotuloRestaurado}`);
  }

  if (arquivoRemovidoNoTrecho) {
    detalhes.push(
      arquivoRestaurarUrl
        ? 'Arquivo removido no evento de revisão foi restaurado'
        : 'O arquivo removido no evento de revisão precisa ser anexado novamente (o anterior continua no SharePoint)'
    );
  }

  instancia.historico.unshift({
    id: gerarId('hist'),
    data: agora,
    elementoId: atual.id,
    elementoNome: atual.nome,
    acaoChave: ACAO_RETORNO_ADMINISTRADOR,
    acaoRotulo: `Retorno de etapa — alterado por administrador: ${atual.nome} → ${destinoFinal.nome}`,
    resultado: 'retornado',
    comentario: detalhes.join(' · '),
    executadoPorId: dados.ator.id,
    executadoPorNome: dados.ator.nome,
    sistema: false,
    revisao: instancia.revisao
  });

  return {
    ok: true,
    erros: [],
    modo: 'etapa',
    instancia,
    etapaOrigem: atual.nome,
    etapaDestino: destinoFinal.nome,
    destinoId: destinoFinal.id,
    statusDestino: destinoFinal.statusDocumento,
    rotuloAnterior: instanciaOriginal.revisao,
    rotuloRestaurado,
    arquivoRemovidoNoTrecho,
    arquivoRestaurarUrl
  };
};

// ------------------------------------------------------------
// EDIÇÃO DO DOCUMENTO POR ETAPA
//
// A etapa diz se o arquivo pode ser aberto para edição
// (permiteEditarDocumento). Sem a opção definida, vale o padrão:
// só na Elaboração — status "Elaboração" ou, com status automático,
// a 1ª etapa humana do fluxo.
// ------------------------------------------------------------

export const primeiraEtapaHumana = (
  definicao: IFluxoDefinicao
): IFluxoElemento | undefined => {

  const inicio =
    definicao.elementos.find(item => item.tipo === 'inicio');

  if (!inicio) {
    return definicao.elementos.find(item => item.tipo === 'tarefaHumana');
  }

  const visitados: Record<string, boolean> = {};
  const fila: string[] = [inicio.id];

  while (fila.length > 0) {
    const id = fila.shift() as string;
    if (visitados[id]) {
      continue;
    }
    visitados[id] = true;
    const elemento = obterElemento(definicao, id);
    if (elemento && elemento.tipo === 'tarefaHumana') {
      return elemento;
    }
    definicao.transicoes
      .filter(transicao => transicao.origemId === id)
      .forEach(transicao => fila.push(transicao.destinoId));
  }

  return undefined;
};

export const etapaPermiteEditarDocumento = (
  definicao: IFluxoDefinicao,
  elemento: IFluxoElemento | undefined
): boolean => {

  if (!elemento || elemento.tipo !== 'tarefaHumana') {
    return false;
  }

  if (typeof elemento.permiteEditarDocumento === 'boolean') {
    return elemento.permiteEditarDocumento;
  }

  if (elemento.statusDocumento) {
    return elemento.statusDocumento === 'Elaboração';
  }

  const primeira =
    primeiraEtapaHumana(definicao);

  return !!primeira && primeira.id === elemento.id;
};

// ------------------------------------------------------------
// TRANSFERÊNCIA PARA O FLUXO DE OUTRO PROCESSO (administrador)
//
// Usada quando documentos foram criados em processos duplicados e
// devem passar a um único processo. A revisão em andamento sai do
// fluxo de origem e continua NA MESMA ETAPA do fluxo de destino.
//
// Correspondência das etapas: pelo id (fluxos copiados mantêm os ids)
// e, se não houver, pelo nome + tipo (único). Se a etapa atual não
// existir no destino, nada é feito.
//
// Nada do histórico é apagado: a pendência atual é cancelada e
// recriada na etapa equivalente, e o passo fica registrado como
// "alterado por administrador".
// ------------------------------------------------------------

export const ACAO_TRANSFERENCIA_ADMINISTRADOR = 'transferenciaProcessoAdministrador';

export type CriterioMapeamento =
  | 'id'
  | 'nome';

export interface IMapeamentoEtapa {
  origemId: string;
  origemNome: string;
  destinoId?: string;
  destinoNome?: string;
  criterio?: CriterioMapeamento;
}

export interface IDadosTransferenciaFluxo {
  processoId: string;
  processoNome: string;
  ator: IFluxoAtor;
  justificativa: string;
  // 'versao' = mesmo processo, versão mais nova do fluxo (atualização);
  // 'processo' (padrão) = outro processo.
  tipo?: 'processo' | 'versao';
}

export const ACAO_ATUALIZACAO_VERSAO = 'atualizacaoVersaoFluxo';

export interface IResultadoTransferencia {
  ok: boolean;
  erros: string[];
  avisos: string[];
  instancia?: IFluxoInstancia;
  etapaOrigem?: string;
  etapaDestino?: string;
  mapeamento: IMapeamentoEtapa[];
}

const normalizarNomeEtapa = (
  valor?: string
): string =>
  (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Etapa equivalente no fluxo de destino.
export const mapearElemento = (
  elemento: IFluxoElemento,
  destino: IFluxoDefinicao
): { elemento?: IFluxoElemento; criterio?: CriterioMapeamento } => {

  const porId =
    destino.elementos.find(item => item.id === elemento.id && item.tipo === elemento.tipo);

  if (porId) {
    return { elemento: porId, criterio: 'id' };
  }

  const nome =
    normalizarNomeEtapa(elemento.nome);

  const porNome =
    destino.elementos.filter(
      item => item.tipo === elemento.tipo && !!nome && normalizarNomeEtapa(item.nome) === nome
    );

  return porNome.length === 1
    ? { elemento: porNome[0], criterio: 'nome' }
    : {};
};

export const transferirInstancia = (
  origem: IFluxoDefinicao,
  destino: IFluxoDefinicao,
  instanciaOriginal: IFluxoInstancia,
  dados: IDadosTransferenciaFluxo
): IResultadoTransferencia => {

  const mapeamento: IMapeamentoEtapa[] = [];

  const falha = (mensagem: string): IResultadoTransferencia => ({
    ok: false,
    erros: [mensagem],
    avisos: [],
    mapeamento
  });

  if (instanciaOriginal.status !== 'emAndamento') {
    return falha('Só revisões com o fluxo em andamento são transferidas (as concluídas ficam no histórico do processo de origem).');
  }

  if (destino.status !== 'publicado') {
    return falha('O fluxo de destino precisa estar publicado.');
  }

  if (
    instanciaOriginal.fluxoId === destino.id &&
    instanciaOriginal.fluxoVersao === destino.versao
  ) {
    return falha(
      dados.tipo === 'versao'
        ? 'A revisão já está na versão publicada.'
        : 'A revisão já está neste fluxo.'
    );
  }

  if (dados.tipo === 'versao' && instanciaOriginal.fluxoVersao > destino.versao) {
    return falha('A revisão usa uma versão mais nova que a publicada.');
  }

  const atual =
    obterElementoAtual(origem, instanciaOriginal);

  if (!atual) {
    return falha('A etapa atual da revisão não foi encontrada no fluxo de origem.');
  }

  // Mapeia tudo o que a revisão percorreu (para o diagrama e as
  // regras de retorno continuarem coerentes no destino).
  const mapa: Record<string, IFluxoElemento | undefined> = {};

  const idsParaMapear =
    instanciaOriginal.percorridos
      .concat([atual.id])
      .concat(instanciaOriginal.tarefas.map(tarefa => tarefa.elementoId))
      .filter((id, indice, lista) => !!id && lista.indexOf(id) === indice);

  idsParaMapear.forEach(
    id => {
      const elemento = obterElemento(origem, id);
      if (!elemento) {
        return;
      }
      const resultado = mapearElemento(elemento, destino);
      mapa[id] = resultado.elemento;
      mapeamento.push({
        origemId: elemento.id,
        origemNome: elemento.nome,
        destinoId: resultado.elemento ? resultado.elemento.id : undefined,
        destinoNome: resultado.elemento ? resultado.elemento.nome : undefined,
        criterio: resultado.criterio
      });
    }
  );

  const atualDestino =
    mapa[atual.id];

  if (!atualDestino) {
    return falha(`A etapa atual "${atual.nome}" não existe no fluxo de destino (nem com o mesmo nome).`);
  }

  if (atualDestino.tipo !== atual.tipo) {
    return falha(`A etapa "${atual.nome}" tem outro tipo no fluxo de destino.`);
  }

  const avisos: string[] = [];

  const naoMapeadas =
    mapeamento.filter(item => !item.destinoId && item.origemId !== atual.id);

  if (naoMapeadas.length > 0) {
    avisos.push(
      `Etapas já percorridas sem equivalente no destino (ficam só no histórico): ${naoMapeadas.map(item => item.origemNome).join(', ')}.`
    );
  }

  if (atualDestino.tipo === 'tarefaHumana' && atualDestino.statusDocumento === 'Vigente') {
    avisos.push(
      `A revisão fica na etapa de publicação "${atualDestino.nome}": abra o documento e use "Concluir publicação" para torná-la vigente.`
    );
  }

  const porNome =
    mapeamento.filter(item => item.criterio === 'nome');

  if (porNome.length > 0) {
    avisos.push(
      `Correspondência feita pelo nome da etapa: ${porNome.map(item => item.origemNome).join(', ')}.`
    );
  }

  const agora =
    agoraIso();

  const instancia =
    copiarInstancia(instanciaOriginal);

  // Caminho percorrido traduzido para o destino.
  instancia.percorridos =
    instanciaOriginal.percorridos
      .map(id => mapa[id])
      .filter((item): item is IFluxoElemento => !!item)
      .map(item => item.id)
      .filter((id, indice, lista) => lista.indexOf(id) === indice);

  if (instancia.percorridos.indexOf(atualDestino.id) < 0) {
    instancia.percorridos.push(atualDestino.id);
  }

  instancia.transicoesPercorridas =
    instanciaOriginal.transicoesPercorridas
      .map(id => origem.transicoes.find(item => item.id === id))
      .map(transicao => {
        if (!transicao) {
          return undefined;
        }
        const de = mapa[transicao.origemId];
        const para = mapa[transicao.destinoId];
        return de && para
          ? destino.transicoes.find(item => item.origemId === de.id && item.destinoId === para.id)
          : undefined;
      })
      .filter((item): item is IFluxoTransicao => !!item)
      .map(item => item.id)
      .filter((id, indice, lista) => lista.indexOf(id) === indice);

  // Tarefas já concluídas passam a apontar para a etapa equivalente
  // (o nome registrado não muda). A pendência atual é cancelada e
  // recriada no destino, com os responsáveis do fluxo de destino.
  instancia.tarefas =
    instancia.tarefas.map(
      tarefa => {
        if (tarefa.status === 'pendente') {
          return { ...tarefa, status: 'cancelada', concluidaEm: agora, concluidaPorNome: dados.ator.nome };
        }
        const equivalente = mapa[tarefa.elementoId];
        return equivalente ? { ...tarefa, elementoId: equivalente.id } : tarefa;
      }
    );

  instancia.tarefas.push(
    criarTarefa(atualDestino, agora)
  );

  const processoAnterior =
    instanciaOriginal.processoNome || 'processo anterior';

  instancia.processoId = dados.processoId;
  instancia.processoNome = dados.processoNome;
  instancia.fluxoId = destino.id;
  instancia.fluxoVersao = destino.versao;
  instancia.elementoAtualId = atualDestino.id;

  instancia.historico.unshift({
    id: gerarId('hist'),
    data: agora,
    elementoId: atualDestino.id,
    elementoNome: atualDestino.nome,
    acaoChave: dados.tipo === 'versao' ? ACAO_ATUALIZACAO_VERSAO : ACAO_TRANSFERENCIA_ADMINISTRADOR,
    acaoRotulo:
      dados.tipo === 'versao'
        ? `Fluxo atualizado da versão v${instanciaOriginal.fluxoVersao} para a v${destino.versao} — ` +
          `etapa mantida: ${atualDestino.nome}`
        : `Processo alterado — alterado por administrador: ${processoAnterior} (fluxo v${instanciaOriginal.fluxoVersao}) → ` +
          `${dados.processoNome} (fluxo v${destino.versao}); etapa mantida: ${atualDestino.nome}`,
    resultado: dados.tipo === 'versao' ? 'atualizado' : 'transferido',
    comentario: (dados.justificativa || '').trim(),
    executadoPorId: dados.ator.id,
    executadoPorNome: dados.ator.nome,
    sistema: false,
    revisao: instancia.revisao
  });

  return {
    ok: true,
    erros: [],
    avisos,
    instancia,
    etapaOrigem: atual.nome,
    etapaDestino: atualDestino.nome,
    mapeamento
  };
};

// ------------------------------------------------------------
// PUBLICAÇÃO PENDENTE
//
// Normalmente, ao CHEGAR numa etapa com status "Vigente" a revisão é
// publicada na hora (avancar). Mas a revisão pode ficar PARADA nessa
// etapa sem ter sido publicada — ex.: troca de processo ou
// atualização de versão do fluxo, que mantêm a revisão "na mesma
// etapa" e só recriam a pendência. Estas funções detectam o caso e
// concluem a publicação como o fluxo faria.
// ------------------------------------------------------------

export const publicacaoPendente = (
  definicao: IFluxoDefinicao | undefined,
  instancia: IFluxoInstancia | undefined
): boolean => {

  if (!definicao || !instancia || instancia.status !== 'emAndamento') {
    return false;
  }

  const atual =
    obterElementoAtual(definicao, instancia);

  return !!atual &&
    atual.tipo === 'tarefaHumana' &&
    atual.statusDocumento === 'Vigente';
};

export const concluirPublicacaoPendente = (
  definicao: IFluxoDefinicao,
  instanciaOriginal: IFluxoInstancia,
  ator: IFluxoAtor
): IResultadoExecucao => {

  if (!publicacaoPendente(definicao, instanciaOriginal)) {
    return {
      ok: false,
      erros: ['Esta revisão não está parada numa etapa de publicação.'],
      acoesSistema: []
    };
  }

  const agora =
    agoraIso();

  const instancia =
    copiarInstancia(instanciaOriginal);

  const destino =
    obterElementoAtual(definicao, instancia) as IFluxoElemento;

  // A pendência da etapa de publicação é encerrada (a etapa não tem
  // botões: publicar é automático).
  instancia.tarefas =
    instancia.tarefas.map(
      tarefa =>
        tarefa.status === 'pendente'
          ? { ...tarefa, status: 'concluida', concluidaEm: agora, concluidaPorNome: ator.nome }
          : tarefa
    );

  const comRetreinamento =
    retreinamentoDecididoNoFluxo(
      definicao,
      instancia,
      destino.id
    );

  const acao: AcaoSistemaFluxo =
    comRetreinamento
      ? 'publicarComRetreinamento'
      : 'publicarSemRetreinamento';

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
      (comRetreinamento ? '(com retreinamento)' : '(sem retreinamento)') +
      ' — publicação concluída após mudança de fluxo',
    resultado: 'publicado',
    executadoPorId: ator.id || 'sistema',
    executadoPorNome: ator.nome || 'Sistema',
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

  return {
    ok: true,
    erros: [],
    instancia,
    acoesSistema: [acao]
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
