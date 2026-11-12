import {
  adaptarValoresIniciais
} from './subprocesso/mapeamentoSubprocesso';

import {
  IResultadoScript
} from './scriptFluxo';

import {
  ISubprocessoSolicitado,
  AcaoSistemaFluxo,
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoResponsavel,
  IResponsavelResolvido
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  IFluxoCatalogo
} from './FluxoCatalogoLocal';

import {
  aplicarMetadadosNaDefinicao,
  IMetadadosRepositorio
} from '../processos/MetadadosProcessoService';

import {
  assinaturaPendente,
  continuarAposAssinaturaNaInstancia,
  continuarAposScriptNaInstancia,
  scriptPendente,
  liberarSubprocesso,
  subprocessoAguardando,
  concluirPublicacaoPendente,
  executarAcao,
  IDadosInicioFluxo,
  IDadosRetornoFluxo,
  IExecucaoAcao,
  iniciarInstancia,
  IResultadoExecucao,
  IDadosTransferenciaFluxo,
  IResultadoRetorno,
  IResultadoTransferencia,
  retornarUmPasso,
  transferirInstancia
} from './FluxoEngine';

import {
  IContextoGravacaoFluxo,
  IFluxoRepositorio
} from './FluxoRepositorioLocal';

// ============================================================
// SERVIÇO DO FLUXO DE REVISÃO
//
// Junta: catálogo (fluxo do processo) + metadados do processo +
// motor (regras) + repositório (estado da revisão).
//
// Regra: o fluxo pertence ao PROCESSO. O documento é vinculado a
// um processo e a revisão usa a versão PUBLICADA do fluxo desse
// processo no momento em que começa — e fica nela até o fim.
// ============================================================

export interface IContextoExecucaoFluxo {
  // Converte os responsáveis da etapa em pessoas/áreas reais
  // (gravado na pendência). Sem ele, a pendência fica sem resolução.
  // "valores" = metadados já preenchidos (responsável "Usuário do campo").
  resolverResponsaveis?: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>) => IResponsavelResolvido[];

  rotuloRevisao?: string;

  // Executa as tarefas de sistema (ex.: publicar a revisão) ANTES de
  // gravar o novo estado. Se falhar, nada é gravado e a ação volta
  // com o erro — o fluxo não fica "concluído" sem a publicação.
  executarAcoesSistema?: (acoes: AcaoSistemaFluxo[], instancia: IFluxoInstancia) => Promise<void>;

  // Roda o script de uma tarefa "Executar script" (isolado) e devolve
  // os campos preenchidos (já filtrados) ou erros. Sem ele, um fluxo
  // que chega a um script não avança (exceto no modo de teste).
  executarScript?: (elemento: IFluxoElemento, instancia: IFluxoInstancia) => Promise<IResultadoScript>;
}

export class FluxoService {

  private readonly repositorio:
    IFluxoRepositorio;

  private readonly catalogo:
    IFluxoCatalogo;

  private readonly metadados:
    IMetadadosRepositorio;

  public constructor(
    repositorio: IFluxoRepositorio,
    catalogo: IFluxoCatalogo,
    metadados: IMetadadosRepositorio
  ) {
    this.repositorio = repositorio;
    this.catalogo = catalogo;
    this.metadados = metadados;
  }

  public get gravaApenasLocalmente(): boolean {
    return this.repositorio.local && this.catalogo.local;
  }

  // Definição EXATA (id + versão) com que a revisão começou, com os
  // metadados ATUAIS do processo (rótulos, tipos, colunas e ordem).
  // ----------------------------------------------------------
  // AJUSTE ADMINISTRATIVO DOS METADADOS
  //
  // Só o Administrador (a tela confere). Altera os valores de qualquer
  // campo da revisão, mesmo de etapas já concluídas, SEM mudar a etapa.
  // O ajuste fica no histórico do fluxo com o motivo e os valores
  // anteriores → novos (rastreabilidade).
  // ----------------------------------------------------------
  public async ajustarValoresAdministrador(
    revisaoId: string,
    novosValores: Record<string, string>,
    ajuste: {
      motivo: string;
      usuarioId: string;
      usuarioNome: string;
      rotuloRevisao?: string;
      // rótulo de cada campo, para o texto do histórico
      rotulos?: Record<string, string>;
    }
  ): Promise<{ instancia: IFluxoInstancia; avisos: string[]; alterados: string[] }> {

    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      throw new Error('Esta revisão não tem fluxo iniciado: não há metadados para ajustar.');
    }

    const definicao =
      await this.definicaoDaInstancia(instancia);

    if (!definicao) {
      throw new Error('A versão do fluxo desta revisão não foi encontrada.');
    }

    const alterados =
      Object.keys(novosValores)
        .filter(chave => (instancia.valores[chave] || '') !== (novosValores[chave] || ''));

    if (alterados.length === 0) {
      return { instancia, avisos: [], alterados };
    }

    const resumo =
      alterados
        .map(chave => (ajuste.rotulos && ajuste.rotulos[chave]) || chave)
        .join(', ');

    alterados.forEach(chave => {
      if (novosValores[chave]) {
        instancia.valores[chave] = novosValores[chave];
      } else {
        delete instancia.valores[chave];
      }
    });

    const etapa =
      definicao.elementos.find(item => item.id === instancia.elementoAtualId);

    instancia.historico.unshift({
      revisao: instancia.revisao,
      id: `hist-adm-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      data: new Date().toISOString(),
      elementoId: instancia.elementoAtualId,
      elementoNome: etapa ? etapa.nome : '',
      acaoChave: 'ajusteAdministrativo',
      acaoRotulo: `Ajuste administrativo dos metadados: ${resumo}`,
      resultado: 'ajuste',
      comentario: ajuste.motivo,
      executadoPorId: ajuste.usuarioId,
      executadoPorNome: ajuste.usuarioNome,
      sistema: false
    });

    const avisos =
      await this.repositorio.salvar(
        instancia,
        this.contextoGravacao(definicao, instancia, { rotuloRevisao: ajuste.rotuloRevisao } as IContextoExecucaoFluxo)
      );

    return { instancia, avisos, alterados };
  }

  public async definicaoDaInstancia(
    instancia: IFluxoInstancia
  ): Promise<IFluxoDefinicao | undefined> {

    const definicao =
      await this.catalogo.obterVersao(
        instancia.fluxoId,
        instancia.fluxoVersao
      );

    if (!definicao) {
      return undefined;
    }

    const processoId =
      instancia.processoId || definicao.processoId;

    return processoId
      ? aplicarMetadadosNaDefinicao(definicao, await this.metadados.listar(processoId))
      : definicao;
  }

  public async obter(
    revisaoId: string
  ): Promise<IFluxoInstancia | undefined> {
    return this.repositorio.obter(revisaoId);
  }

  private preencherResponsaveis(
    instancia: IFluxoInstancia,
    contexto?: IContextoExecucaoFluxo
  ): void {

    if (!contexto || !contexto.resolverResponsaveis) {
      return;
    }

    instancia.tarefas.forEach(
      tarefa => {
        if (tarefa.status === 'pendente' && !tarefa.responsaveisResolvidos) {
          tarefa.responsaveisResolvidos =
            (contexto.resolverResponsaveis as (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>) => IResponsavelResolvido[])(
              tarefa.responsaveis,
              instancia.valores
            );
        }
      }
    );
  }

  private contextoGravacao(
    definicao: IFluxoDefinicao,
    instancia: IFluxoInstancia,
    contexto?: IContextoExecucaoFluxo
  ): IContextoGravacaoFluxo {

    const etapa =
      definicao.elementos.find(item => item.id === instancia.elementoAtualId);

    return {
      fluxoRegistroId: definicao.registroId,
      rotuloRevisao: contexto ? contexto.rotuloRevisao : undefined,
      statusDocumento: etapa ? etapa.statusDocumento : undefined
    };
  }

  // Inicia o fluxo da revisão com a versão publicada do processo.
  // Se a revisão já tem fluxo, devolve o existente (não reinicia).
  public async iniciar(
    processo: IProcesso,
    dados: IDadosInicioFluxo,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoExecucao> {

    const existente =
      await this.repositorio.obter(dados.revisaoId);

    if (existente) {
      return { ok: true, erros: [], instancia: existente, acoesSistema: [] };
    }

    const publicada =
      await this.catalogo.versaoPublicada(processo.id);

    if (!publicada) {
      return {
        ok: false,
        erros: [`O processo "${processo.nome}" ainda não tem fluxo publicado.`],
        acoesSistema: []
      };
    }

    const definicao =
      aplicarMetadadosNaDefinicao(publicada, await this.metadados.listar(processo.id));

    // Valores herdados (subprocesso): ajustados ao tipo de cada campo do
    // filho; o que não serve é descartado e registrado no histórico.
    const adaptacao =
      dados.valoresIniciais
        ? adaptarValoresIniciais(dados.valoresIniciais, definicao.metadados || [])
        : { valores: undefined as Record<string, string> | undefined, descartados: [] as string[] };

    const resultado =
      iniciarInstancia(
        definicao,
        { ...dados, valoresIniciais: adaptacao.valores, simulado: this.repositorio.local }
      );

    if (resultado.ok && resultado.instancia) {

      resultado.instancia.processoId = processo.id;
      resultado.instancia.processoNome = processo.nome;

      if (adaptacao.descartados.length > 0) {
        const inicio = definicao.elementos.find(item => item.tipo === 'inicio');
        resultado.instancia.historico.unshift({
          revisao: resultado.instancia.revisao,
          id: `hist-${new Date().getTime().toString(36)}-herdados`,
          data: new Date().toISOString(),
          elementoId: inicio ? inicio.id : '',
          elementoNome: 'Início',
          acaoChave: 'valoresHerdados',
          acaoRotulo: 'Valores do documento de origem não aproveitados',
          resultado: 'concluido',
          comentario: `Tipo incompatível ou campo inexistente no fluxo: ${adaptacao.descartados.join(', ')}.`,
          executadoPorId: 'sistema',
          executadoPorNome: 'Sistema',
          sistema: true
        });
      }

      // Script logo depois do Início: roda antes de gravar.
      const errosScriptInicio = await this.rodarScripts(definicao, resultado.instancia, resultado.acoesSistema, contexto);
      if (errosScriptInicio.length > 0) {
        return { ok: false, erros: errosScriptInicio, acoesSistema: [] };
      }

      // Subprocesso logo depois do Início: cria os documentos filhos
      // antes de gravar (só esta tarefa automática roda no início).
      if (
        resultado.acoesSistema.indexOf('criarSubprocessos') >= 0 &&
        contexto &&
        contexto.executarAcoesSistema
      ) {
        try {
          await contexto.executarAcoesSistema(['criarSubprocessos'], resultado.instancia);
        } catch (error) {
          console.error('Subprocesso no início do fluxo:', error);
        }
      }

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  public async executar(
    revisaoId: string,
    execucao: IExecucaoAcao,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoExecucao> {

    // Sempre relê antes de agir: se outra pessoa avançou a revisão,
    // a ação é validada contra o estado atual.
    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      return {
        ok: false,
        erros: ['O fluxo desta revisão ainda não foi iniciado.'],
        acoesSistema: []
      };
    }

    const definicao =
      await this.definicaoDaInstancia(instancia);

    if (!definicao) {
      return {
        ok: false,
        erros: [`A versão ${instancia.fluxoVersao} do fluxo usada por esta revisão não foi encontrada.`],
        acoesSistema: []
      };
    }

    const resultado =
      executarAcao(definicao, instancia, execucao);

    if (resultado.ok && resultado.instancia) {

      // Scripts no caminho: rodam ANTES das tarefas de sistema e da
      // gravação; se falharem, a ação não é concluída.
      const errosScript = await this.rodarScripts(definicao, resultado.instancia, resultado.acoesSistema, contexto);
      if (errosScript.length > 0) {
        return { ok: false, erros: errosScript, acoesSistema: [] };
      }

      if (
        resultado.acoesSistema.length > 0 &&
        contexto &&
        contexto.executarAcoesSistema
      ) {
        try {
          await contexto.executarAcoesSistema(resultado.acoesSistema, resultado.instancia);

          // As tarefas automáticas alteram a própria revisão.
          if (this.repositorio.renovarVersao) {
            await this.repositorio.renovarVersao(revisaoId);
          }
        } catch (error) {
          console.error(error);
          return {
            ok: false,
            erros: [
              `A ação não foi concluída porque a tarefa automática falhou: ${error instanceof Error ? error.message : String(error)}`
            ],
            acoesSistema: []
          };
        }
      }

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  // Revisão parada numa etapa de publicação (status "Vigente") sem
  // ter sido publicada — ex.: depois de troca de processo/versão.
  // Executa a publicação como o fluxo faria ao chegar na etapa.
  public async concluirPublicacaoPendente(
    revisaoId: string,
    ator: IFluxoAtor,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoExecucao> {

    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      return { ok: false, erros: ['O fluxo desta revisão ainda não foi iniciado.'], acoesSistema: [] };
    }

    const definicao =
      await this.definicaoDaInstancia(instancia);

    if (!definicao) {
      return { ok: false, erros: [`A versão ${instancia.fluxoVersao} do fluxo usada por esta revisão não foi encontrada.`], acoesSistema: [] };
    }

    const resultado =
      concluirPublicacaoPendente(definicao, instancia, ator);

    if (resultado.ok && resultado.instancia) {

      if (contexto && contexto.executarAcoesSistema) {
        try {
          await contexto.executarAcoesSistema(resultado.acoesSistema, resultado.instancia);
          if (this.repositorio.renovarVersao) {
            await this.repositorio.renovarVersao(revisaoId);
          }
        } catch (error) {
          console.error(error);
          return {
            ok: false,
            erros: [`A publicação não foi concluída: ${error instanceof Error ? error.message : String(error)}`],
            acoesSistema: []
          };
        }
      }

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  // Subprocesso em modo "aguardar": relê o pai e, se TODOS os
  // documentos filhos concluíram (avaliarFilhos marca cada filho), ou
  // se um administrador liberou (forcarComentario), segue para a
  // próxima etapa e grava. Sem pendência de subprocesso: ok = false,
  // sem erro (nada a fazer).
  public async retomarSubprocesso(
    revisaoId: string,
    ator: IFluxoAtor,
    avaliarFilhos: (pedido: ISubprocessoSolicitado) => Promise<boolean>,
    contexto?: IContextoExecucaoFluxo,
    forcarComentario?: string
  ): Promise<IResultadoExecucao> {

    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      return { ok: false, erros: [], acoesSistema: [] };
    }

    const definicao =
      await this.definicaoDaInstancia(instancia);

    const pedido =
      subprocessoAguardando(definicao, instancia);

    if (!definicao || !pedido) {
      return { ok: false, erros: [], acoesSistema: [] };
    }

    const forcado = forcarComentario !== undefined;

    if (!forcado) {
      const todos = await avaliarFilhos(pedido);
      if (!todos) {
        const pendentes = pedido.filhos.filter(item => !item.concluido).length;
        return {
          ok: false,
          erros: [`Aguardando ${pendentes} de ${pedido.filhos.length} documento(s) do subprocesso.`],
          acoesSistema: []
        };
      }
    }

    const resultado =
      liberarSubprocesso(
        definicao,
        instancia,
        forcado ? 'administrador' : (pedido.filhos.length === 0 ? 'semDocumentos' : 'concluidos'),
        ator,
        forcarComentario
      );

    if (resultado.ok && resultado.instancia) {

      const errosScript = await this.rodarScripts(definicao, resultado.instancia, resultado.acoesSistema, contexto);
      if (errosScript.length > 0) {
        return { ok: false, erros: errosScript, acoesSistema: [] };
      }

      if (
        resultado.acoesSistema.length > 0 &&
        contexto &&
        contexto.executarAcoesSistema
      ) {
        try {
          await contexto.executarAcoesSistema(resultado.acoesSistema, resultado.instancia);
          if (this.repositorio.renovarVersao) {
            await this.repositorio.renovarVersao(revisaoId);
          }
        } catch (error) {
          console.error(error);
          return {
            ok: false,
            erros: [`O fluxo não foi retomado porque a tarefa automática falhou: ${error instanceof Error ? error.message : String(error)}`],
            acoesSistema: []
          };
        }
      }

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  // Libera um fluxo parado em "Assinatura digital" com a situação final
  // do pedido (assinado/recusado/expirado/cancelado). "ator" = liberação
  // manual (Administrador), com comentário obrigatório.
  public async concluirAssinatura(
    revisaoId: string,
    chave: string,
    saida: { situacao: string; valores: Record<string, string>; comentario?: string; ator?: IFluxoAtor },
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoExecucao> {

    const instancia = await this.repositorio.obter(revisaoId);
    if (!instancia) {
      return { ok: false, erros: ['Fluxo não encontrado.'], acoesSistema: [] };
    }
    const definicao = await this.definicaoDaInstancia(instancia);
    const pendente = assinaturaPendente(definicao, instancia);
    // Outra pessoa/aba já liberou (ou é outra parada): nada a fazer.
    if (!definicao || !pendente || pendente.chave !== chave) {
      return { ok: false, erros: [], acoesSistema: [] };
    }

    const continuacao = continuarAposAssinaturaNaInstancia(definicao, instancia, saida);
    if (continuacao.erros.length > 0) {
      return { ok: false, erros: continuacao.erros, acoesSistema: [] };
    }

    const acoes = continuacao.acoesSistema.slice();
    const errosScript = await this.rodarScripts(definicao, instancia, acoes, contexto);
    if (errosScript.length > 0) {
      return { ok: false, erros: errosScript, acoesSistema: [] };
    }

    if (acoes.length > 0 && contexto && contexto.executarAcoesSistema) {
      try {
        await contexto.executarAcoesSistema(acoes, instancia);
        if (this.repositorio.renovarVersao) {
          await this.repositorio.renovarVersao(revisaoId);
        }
      } catch (error) {
        return {
          ok: false,
          erros: [`O fluxo não foi liberado porque a tarefa automática falhou: ${error instanceof Error ? error.message : String(error)}`],
          acoesSistema: []
        };
      }
    }

    this.preencherResponsaveis(instancia, contexto);
    const avisos = await this.repositorio.salvar(instancia, this.contextoGravacao(definicao, instancia, contexto));
    return { ok: true, erros: [], acoesSistema: acoes, instancia, avisos };
  }

  // Enquanto o fluxo estiver parado num script: roda, aplica os campos
  // e segue (o próximo trecho pode ter outro script). As tarefas de
  // sistema alcançadas depois do script entram em "acoes". Devolve os
  // erros (a ação não deve ser gravada).
  private async rodarScripts(
    definicao: IFluxoDefinicao,
    instancia: IFluxoInstancia,
    acoes: AcaoSistemaFluxo[],
    contexto?: IContextoExecucaoFluxo
  ): Promise<string[]> {
    for (let rodada = 0; rodada < 10; rodada++) {
      const script = scriptPendente(definicao, instancia);
      if (!script) {
        return [];
      }
      let saida: { valores: Record<string, string>; mensagem?: string; naoExecutado?: boolean };
      if (instancia.simulado || !contexto || !contexto.executarScript) {
        if (!instancia.simulado) {
          return [`O fluxo chegou ao script "${script.nome}", mas esta tela não executa scripts. Abra o registro pelo portal (documento ou ambiente).`];
        }
        saida = { valores: {}, mensagem: 'modo de teste', naoExecutado: true };
      } else {
        let resultado: IResultadoScript;
        try {
          resultado = await contexto.executarScript(script, instancia);
        } catch (error) {
          return [`Script "${script.nome}": ${error instanceof Error ? error.message : String(error)}`];
        }
        if (resultado.erros.length > 0) {
          return resultado.erros.map(erro => `Script "${script.nome}": ${erro}`);
        }
        saida = { valores: resultado.valores, mensagem: resultado.mensagem };
      }
      const continuacao = continuarAposScriptNaInstancia(definicao, instancia, saida);
      if (continuacao.erros.length > 0) {
        return continuacao.erros;
      }
      continuacao.acoesSistema.forEach(acao => acoes.push(acao));
    }
    return ['Scripts demais em sequência (mais de 10): confira se há um ciclo entre scripts no fluxo.'];
  }

  // Retorno de UM passo (administrador). Relê o estado antes de agir:
  // se alguém avançou a revisão nesse meio-tempo, a regra é aplicada
  // sobre o estado atual (e a gravação usa a ETag, como nas ações).
  public async retornarUmPasso(
    revisaoId: string,
    dados: IDadosRetornoFluxo,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoRetorno> {

    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      return {
        ok: false,
        erros: ['O fluxo desta revisão ainda não foi iniciado.']
      };
    }

    const definicao =
      await this.definicaoDaInstancia(instancia);

    if (!definicao) {
      return {
        ok: false,
        erros: [`A versão ${instancia.fluxoVersao} do fluxo usada por esta revisão não foi encontrada.`]
      };
    }

    const resultado =
      retornarUmPasso(definicao, instancia, dados);

    if (resultado.ok && resultado.instancia) {

      this.preencherResponsaveis(resultado.instancia, contexto);

      resultado.avisos =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(definicao, resultado.instancia, contexto)
        );
    }

    return resultado;
  }

  // Versão publicada do fluxo de um processo, com os metadados dele.
  public async definicaoPublicada(
    processoId: string
  ): Promise<IFluxoDefinicao | undefined> {

    const publicada =
      await this.catalogo.versaoPublicada(processoId);

    return publicada
      ? aplicarMetadadosNaDefinicao(publicada, await this.metadados.listar(processoId))
      : undefined;
  }

  // Leva a revisão em andamento para o fluxo publicado de outro
  // processo, mantendo a etapa. gravar = false só simula (prévia).
  public async transferirParaProcesso(
    revisaoId: string,
    destino: IFluxoDefinicao,
    dados: IDadosTransferenciaFluxo,
    gravar: boolean,
    contexto?: IContextoExecucaoFluxo
  ): Promise<IResultadoTransferencia> {

    const instancia =
      await this.repositorio.obter(revisaoId);

    if (!instancia) {
      return { ok: false, erros: ['O fluxo desta revisão ainda não foi iniciado.'], avisos: [], mapeamento: [] };
    }

    const origem =
      await this.definicaoDaInstancia(instancia);

    if (!origem) {
      return {
        ok: false,
        erros: [`A versão ${instancia.fluxoVersao} do fluxo de origem não foi encontrada.`],
        avisos: [],
        mapeamento: []
      };
    }

    const resultado =
      transferirInstancia(origem, destino, instancia, dados);

    if (gravar && resultado.ok && resultado.instancia) {

      this.preencherResponsaveis(resultado.instancia, contexto);

      const avisosGravacao =
        await this.repositorio.salvar(
          resultado.instancia,
          this.contextoGravacao(destino, resultado.instancia, contexto)
        );

      resultado.avisos = resultado.avisos.concat(avisosGravacao || []);
    }

    return resultado;
  }

  public async reiniciar(
    revisaoId: string
  ): Promise<void> {
    await this.repositorio.remover(revisaoId);
  }
}
