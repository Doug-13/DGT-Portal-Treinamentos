import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoTransicao
} from '../../models/Fluxo';

// ============================================================
// VALIDAÇÃO DE UM FLUXO ANTES DE PUBLICAR
//
// Um rascunho pode ser salvo com erros; só a publicação exige que
// o fluxo esteja completo e coerente.
// ============================================================

const saidasDe = (
  definicao: IFluxoDefinicao,
  elementoId: string
): IFluxoTransicao[] =>
  definicao.transicoes.filter(
    transicao => transicao.origemId === elementoId
  );

const elemento = (
  definicao: IFluxoDefinicao,
  id: string
): IFluxoElemento | undefined =>
  definicao.elementos.find(item => item.id === id);

// Existe caminho para um resultado de ação a partir de um elemento?
// (atravessa gateways; condições por campo contam como possíveis)
const rotaExiste = (
  definicao: IFluxoDefinicao,
  origemId: string,
  resultado: string,
  visitados: string[]
): boolean => {

  if (visitados.indexOf(origemId) >= 0) {
    return false;
  }

  const candidatas =
    saidasDe(definicao, origemId).filter(
      transicao =>
        transicao.tipoCondicao === 'sempre' ||
        transicao.padrao ||
        transicao.tipoCondicao === 'campo' ||
        (transicao.tipoCondicao === 'resultado' && transicao.resultado === resultado)
    );

  return candidatas.some(
    transicao => {
      const destino =
        elemento(definicao, transicao.destinoId);

      if (!destino) {
        return false;
      }

      // Decisões e eventos de revisão repassam o resultado da ação.
      return destino.tipo === 'gateway' || destino.tipo === 'eventoRevisao'
        ? rotaExiste(definicao, destino.id, resultado, visitados.concat(origemId))
        : true;
    }
  );
};

export const validarDefinicao = (
  definicao: IFluxoDefinicao
): string[] => {

  const erros: string[] =
    (definicao.avisosModelagem || []).slice();

  const metadados =
    definicao.metadados || [];

  // ---------------- metadados ----------------

  const chaves: string[] = [];

  metadados.forEach(
    metadado => {

      if (!(metadado.rotulo || '').trim()) {
        erros.push('Há um metadado sem nome.');
      }

      if (chaves.indexOf(metadado.chave) >= 0) {
        erros.push(`O metadado "${metadado.rotulo}" está repetido.`);
      }

      chaves.push(metadado.chave);

      if (
        metadado.tipo === 'lista' &&
        (!metadado.opcoes || metadado.opcoes.filter(opcao => !!opcao.trim()).length === 0)
      ) {
        erros.push(`Informe as opções da lista "${metadado.rotulo}".`);
      }

      if (metadado.tipo === 'tabela') {

        const colunas =
          metadado.colunas || [];

        if (colunas.length === 0) {
          erros.push(`A tabela "${metadado.rotulo}" precisa de pelo menos uma coluna.`);
        }

        const chavesColunas: string[] = [];

        colunas.forEach(
          coluna => {

            if (!(coluna.rotulo || '').trim()) {
              erros.push(`Há uma coluna sem nome na tabela "${metadado.rotulo}".`);
            }

            if (chavesColunas.indexOf(coluna.chave) >= 0) {
              erros.push(`A coluna "${coluna.rotulo}" está repetida na tabela "${metadado.rotulo}".`);
            }

            chavesColunas.push(coluna.chave);

            if (
              coluna.tipo === 'lista' &&
              (!coluna.opcoes || coluna.opcoes.length === 0)
            ) {
              erros.push(`Informe as opções da coluna "${coluna.rotulo}" (tabela "${metadado.rotulo}").`);
            }
          }
        );
      }
    }
  );

  // ---------------- estrutura ----------------

  const inicios =
    definicao.elementos.filter(item => item.tipo === 'inicio');

  const fins =
    definicao.elementos.filter(item => item.tipo === 'fim');

  if (inicios.length !== 1) {
    erros.push(
      inicios.length === 0
        ? 'O fluxo precisa de um evento de início.'
        : 'O fluxo deve ter apenas um evento de início.'
    );
  }

  if (fins.length === 0) {
    erros.push('O fluxo precisa de pelo menos um evento de fim.');
  }

  definicao.elementos.forEach(
    item => {

      const saidas =
        saidasDe(definicao, item.id);

      const entradas =
        definicao.transicoes.filter(
          transicao => transicao.destinoId === item.id
        );

      if (item.tipo !== 'fim' && saidas.length === 0) {
        erros.push(`"${item.nome}" não tem ligação de saída.`);
      }

      if (item.tipo !== 'inicio' && entradas.length === 0) {
        erros.push(`"${item.nome}" não está ligado ao fluxo (nenhuma ligação chega nele).`);
      }

      if (item.tipo === 'tarefaHumana') {

        if (item.responsaveis.length === 0) {
          erros.push(`A etapa "${item.nome}" não tem responsável.`);
        }

        item.responsaveis.forEach(
          responsavel => {
            if (!(responsavel.descricao || '').trim()) {
              erros.push(`Descreva o responsável da etapa "${item.nome}".`);
            }

            if (
              responsavel.tipo === 'grupo' ||
              responsavel.tipo === 'funcao' ||
              responsavel.tipo === 'setor'
            ) {
              erros.push(
                `O responsável "${responsavel.descricao}" da etapa "${item.nome}" é do tipo ${responsavel.tipo === 'grupo' ? 'Grupo' : responsavel.tipo === 'funcao' ? 'Função' : 'Setor'}, que ainda não pode ser resolvido para pessoas. Use Autor da revisão, Gestor da área, Área ou Usuário.`
              );
            }

            if (
              (responsavel.tipo === 'area' || responsavel.tipo === 'usuario') &&
              !(responsavel.referenciaId || '').trim()
            ) {
              erros.push(
                `Escolha ${responsavel.tipo === 'area' ? 'a área' : 'o usuário'} do responsável "${responsavel.descricao}" na etapa "${item.nome}".`
              );
            }
          }
        );

        if (item.acoes.length === 0) {
          erros.push(`A etapa "${item.nome}" não tem ações (botões).`);
        }

        const resultados: string[] = [];

        item.acoes.forEach(
          acao => {

            if (!(acao.rotulo || '').trim()) {
              erros.push(`Há uma ação sem nome na etapa "${item.nome}".`);
            }

            if (!(acao.resultado || '').trim()) {
              erros.push(`A ação "${acao.rotulo}" da etapa "${item.nome}" não tem resultado.`);
            } else if (resultados.indexOf(acao.resultado) >= 0) {
              erros.push(`Duas ações da etapa "${item.nome}" têm o mesmo resultado (${acao.resultado}).`);
            }

            resultados.push(acao.resultado);

            if (
              acao.resultado &&
              saidas.length > 0 &&
              !rotaExiste(definicao, item.id, acao.resultado, [])
            ) {
              erros.push(
                `A ação "${acao.rotulo}" da etapa "${item.nome}" não leva a lugar nenhum: crie uma ligação para o resultado "${acao.resultado}".`
              );
            }
          }
        );

        item.campos.forEach(
          campo => {
            if (chaves.indexOf(campo.chave) < 0) {
              erros.push(`A etapa "${item.nome}" usa um campo que não existe mais (${campo.chave}).`);
            }
          }
        );

        if (
          item.prazoDiasUteis !== undefined &&
          (item.prazoDiasUteis < 0 || item.prazoDiasUteis > 365)
        ) {
          erros.push(`O prazo da etapa "${item.nome}" deve ficar entre 0 e 365 dias úteis.`);
        }
      }

      if (item.tipo === 'eventoRevisao') {

        if (saidas.length > 1) {
          erros.push(`O evento de revisão "${item.nome}" deve ter apenas uma ligação de saída. Para escolher caminhos, use uma decisão depois dele.`);
        }

        if (!item.tipoRevisao) {
          erros.push(`Escolha no evento "${item.nome}" se ele gera uma nova revisão ou uma nova sub-revisão.`);
        }
      }

      if (item.tipo === 'gateway') {

        if (saidas.length < 2) {
          erros.push(`A decisão "${item.nome}" precisa de pelo menos dois caminhos.`);
        }

        if (saidas.filter(transicao => transicao.padrao).length > 1) {
          erros.push(`A decisão "${item.nome}" tem mais de um caminho padrão.`);
        }

        if (
          saidas.length > 0 &&
          saidas.every(transicao => transicao.tipoCondicao === 'sempre')
        ) {
          erros.push(`Defina as condições dos caminhos da decisão "${item.nome}".`);
        }
      }
    }
  );

  // ---------------- ligações ----------------

  definicao.transicoes.forEach(
    transicao => {

      const origem =
        elemento(definicao, transicao.origemId);

      const nome =
        transicao.rotulo ||
        `${origem ? origem.nome : transicao.origemId} → ${(elemento(definicao, transicao.destinoId) || { nome: transicao.destinoId }).nome}`;

      if (
        transicao.tipoCondicao === 'resultado' &&
        !(transicao.resultado || '').trim()
      ) {
        erros.push(`Escolha o resultado da ligação "${nome}".`);
      }

      if (transicao.tipoCondicao === 'campo') {

        if (!transicao.campo || chaves.indexOf(transicao.campo) < 0) {
          erros.push(`Escolha o campo da condição da ligação "${nome}".`);
        }

        const metadadoCondicao =
          metadados.find(item => item.chave === transicao.campo);

        if (metadadoCondicao && metadadoCondicao.tipo === 'tabela') {
          erros.push(`A ligação "${nome}" não pode usar uma tabela como condição.`);
        }

        if (!(transicao.valorEsperado || '').trim()) {
          erros.push(`Informe o valor esperado na ligação "${nome}".`);
        }
      }
    }
  );

  // ---------------- alcance ----------------

  if (inicios.length === 1) {

    const alcancados: string[] = [inicios[0].id];
    const fila: string[] = [inicios[0].id];

    while (fila.length > 0) {
      const atual = fila.shift() as string;

      saidasDe(definicao, atual).forEach(
        transicao => {
          if (alcancados.indexOf(transicao.destinoId) < 0) {
            alcancados.push(transicao.destinoId);
            fila.push(transicao.destinoId);
          }
        }
      );
    }

    definicao.elementos.forEach(
      item => {
        if (alcancados.indexOf(item.id) < 0) {
          erros.push(`"${item.nome}" não pode ser alcançado a partir do início.`);
        }
      }
    );

    if (!fins.some(item => alcancados.indexOf(item.id) >= 0)) {
      erros.push('Nenhum evento de fim pode ser alcançado a partir do início.');
    }
  }

  // Remove mensagens repetidas.
  return erros.filter(
    (erro, indice) => erros.indexOf(erro) === indice
  );
};
