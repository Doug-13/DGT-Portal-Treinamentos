import {
  IFluxoDefinicao,
  IFluxoInstancia,
  ISubprocessoFilho,
  ISubprocessoSolicitado
} from '../../models/Fluxo';

import {
  LinhaTabela
} from '../fluxo/valoresTabela';

import {
  IAmbiente,
  IAmbienteRegistro,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  liberarSubprocessoNaInstancia
} from '../fluxo/FluxoEngine';

import {
  PREFIXO_COLUNA,
  assinaturasCriadas,
  juntarReferencias,
  linhasDoSubprocesso,
  montarTitulo,
  valoresIniciaisDoFilho
} from '../fluxo/subprocesso/regrasSubprocesso';

import {
  gravarValorDocumentos,
  lerValorDocumentos
} from '../fluxo/valorDocumento';

import {
  lerValorUsuario
} from '../fluxo/valorUsuario';

// ============================================================
// SUBPROCESSO ENTRE AMBIENTES (ex.: Auditoria → Não Conformidades)
//
// No registro de um ambiente, a etapa Subprocesso cria REGISTROS no
// ambiente cujo fluxo foi escolhido — um por linha da tabela (com o
// filtro) ou um único — e, no modo "aguardar", o pai fica parado até
// todos os registros filhos terminarem (concluídos ou cancelados).
//
// Solicitante de cada registro filho ("Autor da revisão do novo
// documento" na configuração):
//   coluna:<chave> → a pessoa da coluna Usuário da LINHA. Vazia = a
//                    linha NÃO vira registro (erro no histórico: o
//                    responsável deve estar preenchido na tabela)
//   executor       → quem concluiu a etapa que levou ao subprocesso
//   autorPai       → quem abriu o registro pai
// Linhas que já viraram registro não são recriadas.
// ============================================================

export interface ISolicitanteFilho {
  id: string;
  nome: string;
}

export interface IDependenciasSubprocessoAmbiente {
  // Ambiente ATIVO cujo fluxo é o escolhido no subprocesso.
  ambienteDoFluxo: (fluxoId: string) => Promise<IAmbiente | undefined>;
  criarRegistro: (
    ambiente: IAmbiente,
    dados: { titulo: string; descricao: string; areaId: string },
    solicitante: ISolicitanteFilho
  ) => Promise<IAmbienteRegistro>;
  // Inicia o fluxo do registro filho; devolve erros.
  iniciarFluxo: (
    ambiente: IAmbiente,
    registro: IAmbienteRegistro,
    solicitante: ISolicitanteFilho,
    extras: {
      valoresIniciais: Record<string, string>;
      origemSubprocesso: { documentoId: string; codigo: string; titulo: string; elementoNome: string; linha?: number };
      camposSomenteLeitura: string[];
    }
  ) => Promise<string[]>;
}

const gerarId = (): string => `hist-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

// Solicitante do registro filho (estrito: coluna vazia = erro).
export const solicitanteDoFilho = (
  autor: string,
  linha: LinhaTabela,
  pedido: ISubprocessoSolicitado,
  registroPai: IAmbienteRegistro
): ISolicitanteFilho | undefined => {
  if ((autor || '').indexOf(PREFIXO_COLUNA) === 0) {
    const usuario = lerValorUsuario(linha[autor.substring(PREFIXO_COLUNA.length)] || '');
    return usuario && usuario.id ? { id: usuario.id, nome: usuario.nome } : undefined;
  }
  if (autor === 'autorPai' && registroPai.solicitanteId) {
    return { id: registroPai.solicitanteId, nome: registroPai.solicitanteNome };
  }
  return pedido.executorId ? { id: pedido.executorId, nome: pedido.executorNome || '' } : undefined;
};

const executarPedido = async (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia,
  pedido: ISubprocessoSolicitado,
  registroPai: IAmbienteRegistro,
  deps: IDependenciasSubprocessoAmbiente
): Promise<{ criados: ISubprocessoFilho[]; erros: string[] }> => {

  const erros: string[] = [];
  const criados: ISubprocessoFilho[] = [];
  const elemento = definicao.elementos.find(item => item.id === pedido.elementoId);
  const config = elemento ? elemento.subprocesso : undefined;
  let ignorados = 0;
  let destino: IAmbiente | undefined;

  if (!config) {
    erros.push(`A etapa "${pedido.elementoNome}" não tem configuração de subprocesso nesta versão do fluxo.`);
  } else {
    destino = await deps.ambienteDoFluxo(config.fluxoId);
    if (!destino) {
      erros.push(`O fluxo "${config.fluxoNome || config.fluxoId}" não é de um ambiente ativo: nos ambientes, o subprocesso só cria registros de outro ambiente.`);
    }
  }

  if (config && destino) {
    const jaCriadas = assinaturasCriadas(instancia.subprocessos, pedido.elementoId);
    const pai = { id: registroPai.id, codigo: registroPai.codigo, titulo: registroPai.titulo };
    const colunaAutor = (config.autor || '').indexOf(PREFIXO_COLUNA) === 0 ? config.autor.substring(PREFIXO_COLUNA.length) : '';
    const tabela = (definicao.metadados || []).find(item => item.chave === config.campoTabela);
    const coluna = tabela ? (tabela.colunas || []).find(item => item.chave === colunaAutor) : undefined;
    const somenteLeitura = (config.mapeamentos || []).filter(item => item.somenteLeitura && !!item.destino).map(item => item.destino);

    for (const item of linhasDoSubprocesso(config, instancia.valores)) {
      if (jaCriadas.indexOf(item.assinatura) >= 0) {
        ignorados++;
        continue;
      }
      const onde = config.origem === 'tabela' ? `Linha ${item.numero}` : 'Registro';
      const solicitante = solicitanteDoFilho(config.autor, item.linha, pedido, registroPai);
      if (!solicitante) {
        erros.push(colunaAutor
          ? `${onde}: a coluna "${coluna ? coluna.rotulo : colunaAutor}" (responsável) está vazia — registro não criado.`
          : `${onde}: não foi possível identificar o responsável — registro não criado.`);
        continue;
      }
      const titulo = montarTitulo(config.titulo, pai, item.numero, item.linha, instancia.valores);
      try {
        const registro = await deps.criarRegistro(
          destino,
          {
            titulo: titulo.length >= 3 ? titulo : `${pai.codigo} — ${item.numero}`,
            descricao: `Criado por ${pai.codigo} (${pedido.elementoNome}${config.origem === 'tabela' ? `, linha ${item.numero}` : ''}).`,
            areaId: config.areaId || registroPai.areaId
          },
          solicitante
        );
        const errosInicio = await deps.iniciarFluxo(destino, registro, solicitante, {
          valoresIniciais: valoresIniciaisDoFilho(config, pai, item.linha, instancia.valores),
          origemSubprocesso: { documentoId: pai.id, codigo: pai.codigo, titulo: pai.titulo, elementoNome: pedido.elementoNome, linha: item.numero },
          camposSomenteLeitura: somenteLeitura
        });
        if (errosInicio.length > 0) {
          erros.push(`${onde}: ${registro.codigo} foi criado, mas o fluxo não iniciou: ${errosInicio.join(' ')}`);
        }
        criados.push({
          documentoId: registro.id,
          codigo: registro.codigo,
          titulo: registro.titulo,
          assinatura: item.assinatura,
          linha: config.origem === 'tabela' ? item.numero : undefined,
          criadoEm: new Date().toISOString()
        });
      } catch (erro) {
        erros.push(`${onde}: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }
  }

  // ----- encerra o pedido (mesmo padrão dos documentos) -----
  pedido.filhos = pedido.filhos.concat(criados);
  pedido.ignorados = ignorados;
  pedido.erros = erros.length > 0 ? erros : undefined;
  pedido.status = erros.length === 0 ? 'concluido' : criados.length > 0 ? 'parcial' : 'erro';
  pedido.concluidoEm = new Date().toISOString();

  if (config && config.campoReferencias && criados.length > 0) {
    instancia.valores[config.campoReferencias] = gravarValorDocumentos(
      juntarReferencias(
        lerValorDocumentos(instancia.valores[config.campoReferencias]),
        criados.map(item => ({ id: item.documentoId, codigo: item.codigo, titulo: item.titulo }))
      )
    );
  }

  const partes: string[] = [];
  if (criados.length > 0) {
    partes.push(`${criados.length} registro(s) criado(s)${destino ? ` em ${destino.nome}` : ''}: ${criados.map(item => item.codigo).join(', ')}`);
  }
  if (ignorados > 0) {
    partes.push(`${ignorados} linha(s) já tinham registro`);
  }
  if (criados.length === 0 && ignorados === 0 && erros.length === 0) {
    partes.push(config && config.origem === 'tabela' && config.filtroLinhas
      ? 'nenhuma linha atende ao filtro — nenhum registro criado'
      : 'nenhuma linha preenchida — nenhum registro criado');
  }

  instancia.historico.unshift({
    id: gerarId(),
    data: new Date().toISOString(),
    elementoId: pedido.elementoId,
    elementoNome: pedido.elementoNome,
    acaoChave: erros.length > 0 ? 'subprocessoComErros' : 'subprocessoConcluido',
    acaoRotulo: `Subprocesso: ${partes.join(' · ') || 'nenhum registro criado'}`,
    resultado: erros.length > 0 ? 'parcial' : 'concluido',
    comentario: erros.length > 0 ? `Atenção: ${erros.join(' | ')}` : undefined,
    executadoPorId: 'sistema',
    executadoPorNome: 'Sistema',
    sistema: true,
    revisao: instancia.revisao
  });

  // "Aguardar" sem nada a esperar e sem erros: segue agora.
  if (pedido.aguardando && pedido.filhos.length === 0 && erros.length === 0) {
    liberarSubprocessoNaInstancia(definicao, instancia, 'semDocumentos', { id: 'sistema', nome: 'Sistema' })
      .erros.forEach(erro => erros.push(erro));
  }

  return { criados, erros };
};

// Executa os pedidos de subprocesso pendentes da instância (altera-a).
export const executarSubprocessosAmbiente = async (
  definicao: IFluxoDefinicao,
  instancia: IFluxoInstancia,
  registroPai: IAmbienteRegistro,
  deps: IDependenciasSubprocessoAmbiente
): Promise<{ criados: ISubprocessoFilho[]; erros: string[] }> => {
  const resultado = { criados: [] as ISubprocessoFilho[], erros: [] as string[] };
  for (let rodada = 0; rodada < 10; rodada++) {
    const pendentes = (instancia.subprocessos || []).filter(item => item.status === 'pendente');
    if (pendentes.length === 0) {
      break;
    }
    for (const pedido of pendentes) {
      const parcial = await executarPedido(definicao, instancia, pedido, registroPai, deps);
      resultado.criados = resultado.criados.concat(parcial.criados);
      resultado.erros = resultado.erros.concat(parcial.erros);
    }
  }
  return resultado;
};

// Modo "aguardar": marca os filhos que terminaram (concluído ou
// cancelado). true = todos terminaram.
export const avaliarFilhosAmbiente = (
  pedido: ISubprocessoSolicitado,
  situacoes: Record<string, SituacaoRegistroAmbiente | undefined>
): boolean => {
  pedido.filhos.forEach(filho => {
    const situacao = situacoes[filho.documentoId];
    if (!filho.concluido && (situacao === 'concluido' || situacao === 'cancelado')) {
      filho.concluido = true;
      filho.concluidoEm = new Date().toISOString();
    }
  });
  return pedido.filhos.every(item => item.concluido);
};
