import {
  DataverseService
} from '../../DataverseService';

import {
  AreaAdminService,
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../AreaAdminService';

import {
  DocumentoHistoricoService
} from '../../DocumentoHistoricoService';

import {
  dataHojeSomenteData
} from '../../DocumentoRevisaoFluxoService';

import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoInstancia,
  IOrigemSubprocesso,
  IFluxoResponsavel,
  IResponsavelResolvido,
  ISubprocessoFilho,
  ISubprocessoSolicitado
} from '../../../models/Fluxo';

import {
  IProcesso
} from '../../../models/Processo';

import {
  obterPersistenciaFluxo
} from '../persistenciaFluxo';

import {
  resolverResponsaveis
} from '../ResolvedorResponsaveis';

import {
  liberarSubprocessoNaInstancia
} from '../FluxoEngine';

import {
  IContextoExecucaoFluxo
} from '../FluxoService';

import {
  gravarValorDocumentos,
  lerValorDocumentos
} from '../valorDocumento';

import {
  IDadosPai,
  assinaturasCriadas,
  autorDoFilho,
  juntarReferencias,
  linhasDoSubprocesso,
  montarTitulo,
  proximoCodigoDocumento,
  valoresIniciaisDoFilho
} from './regrasSubprocesso';

// ============================================================
// EXECUÇÃO DO SUBPROCESSO (cria os documentos filhos)
//
// Chamado pela tarefa automática do documento PAI (aba Fluxo, ação
// "criarSubprocessos"), ANTES de o novo estado do fluxo ser gravado.
// Para cada pedido pendente em instancia.subprocessos:
//
//   1. lê as linhas da tabela de origem (ou uma só, no modo único);
//   2. pula as linhas que já viraram documento (assinatura);
//   3. para cada linha nova:
//        documento ÁREA-TIPO-NNN + revisão Rev.00A (Elaboração),
//        vínculo com o fluxo do subprocesso,
//        início do fluxo filho (já com os valores mapeados e a origem),
//        histórico do documento filho;
//   4. grava os filhos no campo "Documentos referenciados" do pai — é a
//      ligação pai ⇄ filhos mostrada na aba Referências;
//   5. registra o resultado no pedido e no histórico do fluxo do pai.
//
// Nunca interrompe a ação do pai: erros de uma linha ficam registrados
// (pedido "parcial"/"erro" + histórico) e as demais linhas seguem.
// Nada é apagado.
// ============================================================

const REVISAO_INICIAL = 'Rev.00A';

const guid = (
  valor?: unknown
): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const ehGuid = (
  valor?: string
): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid(valor));

const mensagem = (
  erro: unknown
): string =>
  erro instanceof Error ? erro.message : String(erro);

const gerarId = (
  prefixo: string
): string =>
  `${prefixo}-${new Date().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface IDocumentoPaiSubprocesso extends IDadosPai {
  areaId: string;
}

export interface IContextoSubprocesso {
  documento: IDocumentoPaiSubprocesso;
  revisaoId: string;
  // Autor da revisão do pai (dgt_documentorevisao.dgt_responsavel).
  autorPaiId?: string;
  // Usuário que está executando a ação (sessão atual).
  usuarioId: string;
  usuarioNome: string;
}

export interface IResultadoSubprocesso {
  criados: ISubprocessoFilho[];
  erros: string[];
}

export class SubprocessoService {

  private readonly dataverse: DataverseService;

  private areasCache: IAreaAdmin[] | undefined;

  private vinculosCache: IUsuarioAreaAdmin[] | undefined;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  private async areas(): Promise<IAreaAdmin[]> {
    if (!this.areasCache) {
      this.areasCache = await new AreaAdminService(this.dataverse).listarAreas();
    }
    return this.areasCache;
  }

  private async vinculos(): Promise<IUsuarioAreaAdmin[]> {
    if (!this.vinculosCache) {
      try {
        this.vinculosCache = await new AreaAdminService(this.dataverse).listarUsuariosArea();
      } catch {
        this.vinculosCache = [];
      }
    }
    return this.vinculosCache;
  }

  private async opcao(
    tabela: string,
    coluna: string,
    rotulo: string
  ): Promise<number | undefined> {
    try {
      return await this.dataverse.getChoiceOptionValue(tabela, coluna, rotulo);
    } catch {
      return undefined;
    }
  }

  private async codigosExistentes(
    prefixo: string
  ): Promise<string[]> {
    const registros =
      await this.dataverse.listarRegistros(
        'dgt_documento',
        `$select=dgt_codigo&$filter=startswith(dgt_codigo,'${prefixo.replace(/'/g, "''")}')`
      );
    return registros.map(item => String(item.dgt_codigo || ''));
  }

  // ----------------------------------------------------------
  // Execução de todos os pedidos pendentes
  // ----------------------------------------------------------

  public async executarPendentes(
    definicao: IFluxoDefinicao,
    instancia: IFluxoInstancia,
    contexto: IContextoSubprocesso
  ): Promise<IResultadoSubprocesso> {

    const resultado: IResultadoSubprocesso = { criados: [], erros: [] };

    // Em laço: liberar um subprocesso sem documentos pode levar o fluxo
    // a outro subprocesso logo adiante.
    for (let rodada = 0; rodada < 10; rodada++) {
      const pendentes =
        (instancia.subprocessos || []).filter(item => item.status === 'pendente');

      if (pendentes.length === 0) {
        break;
      }

      for (const pedido of pendentes) {
        const parcial = await this.executarPedido(definicao, instancia, pedido, contexto);
        resultado.criados = resultado.criados.concat(parcial.criados);
        resultado.erros = resultado.erros.concat(parcial.erros);
      }
    }

    return resultado;
  }

  private async executarPedido(
    definicao: IFluxoDefinicao,
    instancia: IFluxoInstancia,
    pedido: ISubprocessoSolicitado,
    contexto: IContextoSubprocesso
  ): Promise<IResultadoSubprocesso> {

    const agora = new Date().toISOString();
    const erros: string[] = [];
    const criados: ISubprocessoFilho[] = [];

    const elemento = definicao.elementos.find(item => item.id === pedido.elementoId);
    const config = elemento ? elemento.subprocesso : undefined;

    const encerrar = (ignorados: number): IResultadoSubprocesso => {
      pedido.filhos = pedido.filhos.concat(criados);
      pedido.ignorados = ignorados;
      pedido.erros = erros.length > 0 ? erros : undefined;
      pedido.status = erros.length === 0 ? 'concluido' : criados.length > 0 ? 'parcial' : 'erro';
      pedido.concluidoEm = new Date().toISOString();

      // Ligação pai ⇄ filhos (aba Referências dos dois documentos).
      if (config && config.campoReferencias && criados.length > 0) {
        instancia.valores[config.campoReferencias] =
          gravarValorDocumentos(
            juntarReferencias(
              lerValorDocumentos(instancia.valores[config.campoReferencias]),
              criados.map(item => ({ id: item.documentoId, codigo: item.codigo, titulo: item.titulo }))
            )
          );
      }

      const partes: string[] = [];
      if (criados.length > 0) {
        partes.push(`${criados.length} documento(s) criado(s): ${criados.map(item => item.codigo).join(', ')}`);
      }
      if (ignorados > 0) {
        partes.push(`${ignorados} linha(s) já tinham documento`);
      }
      if (criados.length === 0 && ignorados === 0 && erros.length === 0) {
        partes.push(
          config && config.origem === 'tabela' && config.filtroLinhas
            ? 'nenhuma linha atende ao filtro — nenhum documento criado'
            : 'nenhuma linha preenchida — nenhum documento criado'
        );
      }

      instancia.historico.unshift({
        id: gerarId('hist'),
        data: new Date().toISOString(),
        elementoId: pedido.elementoId,
        elementoNome: pedido.elementoNome,
        acaoChave: erros.length > 0 ? 'subprocessoComErros' : 'subprocessoConcluido',
        acaoRotulo: `Subprocesso: ${partes.join(' · ') || 'concluído'}`,
        resultado: erros.length > 0 ? 'parcial' : 'concluido',
        comentario: erros.length > 0 ? `Atenção: ${erros.join(' | ')}` : undefined,
        executadoPorId: 'sistema',
        executadoPorNome: 'Sistema',
        sistema: true,
        revisao: instancia.revisao
      });

      // Modo "aguardar" sem nenhum documento criado (tabela vazia) e
      // sem erros: não há o que esperar — o fluxo segue agora.
      if (pedido.aguardando && pedido.filhos.length === 0 && erros.length === 0) {
        const liberacao =
          liberarSubprocessoNaInstancia(definicao, instancia, 'semDocumentos', { id: 'sistema', nome: 'Sistema' });
        liberacao.erros.forEach(erro => erros.push(erro));
      }

      return { criados, erros };
    };

    if (!elemento || !config) {
      erros.push(`A etapa "${pedido.elementoNome}" não tem configuração de subprocesso nesta versão do fluxo.`);
      return encerrar(0);
    }

    const persistencia = obterPersistenciaFluxo(this.dataverse);

    if (persistencia.local) {
      erros.push('Modo de teste: os documentos do subprocesso não são criados.');
      return encerrar(0);
    }

    // ---- Fluxo dos filhos ----
    let processoFilho: IProcesso | undefined;
    let vinculosProcessos;

    try {
      const dados = await persistencia.processos.carregar(true, []);
      vinculosProcessos = dados.vinculos;
      processoFilho = dados.processos.find(item => guid(item.id) === guid(config.fluxoId));
    } catch (erro) {
      erros.push(`Não foi possível ler os fluxos: ${mensagem(erro)}`);
      return encerrar(0);
    }

    if (!processoFilho) {
      erros.push(`O fluxo do subprocesso (${config.fluxoNome || config.fluxoId}) não foi encontrado ou está inativo.`);
      return encerrar(0);
    }

    if (!(await persistencia.catalogo.versaoPublicada(processoFilho.id))) {
      erros.push(`O fluxo "${processoFilho.nome}" não tem versão publicada. Publique-o para que o subprocesso crie os documentos.`);
      return encerrar(0);
    }

    // ---- Área, tipo e status ----
    const areaId = guid(config.areaId || contexto.documento.areaId);
    let area: IAreaAdmin | undefined;

    try {
      area = (await this.areas()).find(item => guid(item.id) === areaId);
    } catch (erro) {
      erros.push(`Não foi possível ler as áreas: ${mensagem(erro)}`);
      return encerrar(0);
    }

    if (!area || !ehGuid(areaId)) {
      erros.push('A área dos documentos do subprocesso não foi encontrada (o documento pai tem área?).');
      return encerrar(0);
    }

    if (!(area.sigla || '').trim()) {
      erros.push(`A área "${area.nome}" não tem sigla: ela é necessária para gerar o código dos documentos.`);
      return encerrar(0);
    }

    const tipo = await this.opcao('dgt_documento', 'dgt_tipo', config.tipoDocumento);

    if (tipo === undefined) {
      erros.push(`O tipo de documento "${config.tipoDocumento}" não existe no Dataverse (dgt_documento.dgt_tipo).`);
      return encerrar(0);
    }

    const statusDocumento = await this.opcao('dgt_documento', 'dgt_status', 'Elaboração');
    const statusRevisao = await this.opcao('dgt_documentorevisao', 'dgt_status', 'Elaboração');

    const vinculosArea = await this.vinculos();

    const gestorDaArea =
      vinculosArea.find(item => item.ativo && guid(item.areaId) === areaId && item.perfil === 'Gestor');

    // ---- Linhas ----
    const jaCriadas = assinaturasCriadas(instancia.subprocessos, pedido.elementoId);
    const linhas = linhasDoSubprocesso(config, instancia.valores);
    const novas = linhas.filter(item => jaCriadas.indexOf(item.assinatura) < 0);
    const ignorados = linhas.length - novas.length;

    const prefixo = `${area.sigla.trim().toUpperCase()}-${config.tipoDocumento.trim().toUpperCase()}-`;
    let existentes: string[];

    try {
      existentes = await this.codigosExistentes(prefixo);
    } catch (erro) {
      erros.push(`Não foi possível consultar os códigos existentes: ${mensagem(erro)}`);
      return encerrar(ignorados);
    }

    const executorId =
      ehGuid(pedido.executorId) ? guid(pedido.executorId) : guid(contexto.usuarioId);

    for (const item of novas) {

      const codigo = proximoCodigoDocumento(area.sigla, config.tipoDocumento, existentes);
      existentes.push(codigo);

      const titulo =
        montarTitulo(config.titulo, contexto.documento, item.numero, item.linha, instancia.valores) || codigo;

      const autorId = guid(autorDoFilho(config, item.linha, executorId, guid(contexto.autorPaiId)));
      const aprovadorId = gestorDaArea ? guid(gestorDaArea.usuarioId) : autorId;
      const rotuloLinha = config.origem === 'tabela' ? `linha ${item.numero}` : 'documento';

      try {
        // 1) Documento
        const dadosDocumento: Record<string, unknown> = {
          dgt_name: titulo.substring(0, 100),
          dgt_codigo: codigo,
          dgt_titulo: titulo,
          dgt_descricao: `Criado pelo subprocesso "${pedido.elementoNome}" do documento ${contexto.documento.codigo}` +
            (config.origem === 'tabela' ? ` (linha ${item.numero}).` : '.'),
          dgt_tipo: tipo,
          dgt_revisaoatual: REVISAO_INICIAL,
          dgt_ativo: true
        };

        if (statusDocumento !== undefined) {
          dadosDocumento.dgt_status = statusDocumento;
        }

        const criado =
          ehGuid(aprovadorId)
            ? await this.dataverse.criarDocumentoAdminComAreaEAprovador(areaId, aprovadorId, dadosDocumento)
            : await this.dataverse.criarDocumentoAdminComArea(areaId, dadosDocumento);

        const documentoId = guid(criado.dgt_documentoid);

        if (!documentoId) {
          throw new Error(`o documento ${codigo} foi criado, mas o Dataverse não retornou o ID`);
        }

        // 2) Revisão inicial (Elaboração), com o autor definido
        const dadosRevisao: Record<string, unknown> = {
          dgt_name: `${codigo} - ${REVISAO_INICIAL}`.substring(0, 100),
          dgt_revisao: REVISAO_INICIAL,
          dgt_datarevisao: dataHojeSomenteData(),
          dgt_motivoalteracao: 'Criado por subprocesso'.substring(0, 100),
          dgt_descricaoalteracoes: `Documento aberto automaticamente pelo subprocesso "${pedido.elementoNome}" de ${contexto.documento.codigo}.`,
          dgt_requerretreinamento: false,
          dgt_justificativa: 'Não se aplica à criação do documento.',
          dgt_ativa: true
        };

        if (statusRevisao !== undefined) {
          dadosRevisao.dgt_status = statusRevisao;
        }

        const revisao =
          await this.dataverse.criarDocumentoRevisaoComResponsavel(documentoId, ehGuid(autorId) ? autorId : '', dadosRevisao);

        const revisaoId = guid(revisao.dgt_documentorevisaoid);

        const filho: ISubprocessoFilho = {
          documentoId,
          codigo,
          titulo,
          revisaoId: revisaoId || undefined,
          assinatura: item.assinatura,
          linha: config.origem === 'tabela' ? item.numero : undefined,
          criadoEm: agora
        };

        // A partir daqui o documento existe: entra na lista (e na
        // referência do pai) mesmo que um passo seguinte falhe.
        criados.push(filho);

        // 3) Vínculo com o fluxo do subprocesso
        try {
          await persistencia.processos.vincularDocumento(documentoId, processoFilho.id, vinculosProcessos || []);
        } catch (erro) {
          erros.push(`${codigo}: criado, mas não foi vinculado ao fluxo "${processoFilho.nome}" (${mensagem(erro)}). Vincule em Processos.`);
          continue;
        }

        // 4) Início do fluxo filho
        if (revisaoId) {
          const dadosResponsaveis = { revisaoResponsavelId: autorId, documentoAreaId: areaId };
          const inicio =
            await persistencia.servico.iniciar(
              processoFilho,
              {
                revisaoId,
                documentoId,
                revisao: REVISAO_INICIAL,
                ator: { id: executorId, nome: pedido.executorNome || contexto.usuarioNome, papeisTeste: [] },
                simulado: false,
                valoresIniciais: valoresIniciaisDoFilho(config, contexto.documento, item.linha, instancia.valores),
                origemSubprocesso: {
                  documentoId: contexto.documento.id,
                  codigo: contexto.documento.codigo,
                  titulo: contexto.documento.titulo,
                  revisaoId: contexto.revisaoId,
                  elementoNome: pedido.elementoNome,
                  linha: filho.linha
                }
              },
              {
                rotuloRevisao: `${codigo} ${REVISAO_INICIAL}`,
                resolverResponsaveis: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>): IResponsavelResolvido[] =>
                  resolverResponsaveis(responsaveis, { ...dadosResponsaveis, valores }, vinculosArea)
              }
            );

          if (!inicio.ok) {
            erros.push(`${codigo}: criado, mas o fluxo não começou (${inicio.erros.join(' ')}). Ele começa ao abrir a aba Fluxo do documento.`);
          }
        }

        // 5) Histórico do documento filho (nunca interrompe)
        await new DocumentoHistoricoService(this.dataverse).registrarSemInterromper({
          documentoId,
          tipo: 'REVISAO_CRIADA',
          titulo: 'Documento criado por subprocesso',
          descricao:
            `Criado pelo subprocesso "${pedido.elementoNome}" do documento ${contexto.documento.codigo} — ${contexto.documento.titulo}` +
            (config.origem === 'tabela' ? `, linha ${item.numero}.` : '.'),
          statusNovo: 'Elaboração',
          revisaoNumero: REVISAO_INICIAL,
          usuarioId: contexto.usuarioId,
          usuarioNome: contexto.usuarioNome
        });

      } catch (erro) {
        erros.push(`${rotuloLinha}: ${mensagem(erro)}`);
      }
    }

    // Histórico do documento pai (nunca interrompe)
    if (criados.length > 0) {
      await new DocumentoHistoricoService(this.dataverse).registrarSemInterromper({
        documentoId: contexto.documento.id,
        tipo: 'OUTRO',
        titulo: `Subprocesso "${pedido.elementoNome}": ${criados.length} documento(s) criado(s)`,
        descricao: criados.map(item => `${item.codigo} — ${item.titulo}`).join('\n'),
        usuarioId: contexto.usuarioId,
        usuarioNome: contexto.usuarioNome
      });
    }

    return encerrar(ignorados);
  }

  // ----------------------------------------------------------
  // Modo "aguardar"
  // ----------------------------------------------------------

  // Marca os filhos cujo fluxo já concluiu. true = todos concluídos.
  public async avaliarFilhos(
    pedido: ISubprocessoSolicitado
  ): Promise<boolean> {

    const servico = obterPersistenciaFluxo(this.dataverse).servico;

    for (const filho of pedido.filhos.filter(item => !item.concluido && !!item.revisaoId)) {
      try {
        const instanciaFilho = await servico.obter(filho.revisaoId as string);
        if (instanciaFilho && instanciaFilho.status === 'concluido') {
          filho.concluido = true;
          filho.concluidoEm = instanciaFilho.concluidoEm || new Date().toISOString();
        }
      } catch {
        // Sem permissão de leitura ou fluxo ilegível: continua pendente.
      }
    }

    return pedido.filhos.every(item => item.concluido);
  }

  // Contexto de execução do fluxo do PAI, montado a partir do Dataverse
  // (usado quando quem age é o responsável de um documento filho).
  public async contextoDoPai(
    revisaoId: string,
    usuario: { id: string; nome: string }
  ): Promise<IContextoExecucaoFluxo | undefined> {

    const revisao =
      await this.dataverse.obterRegistro('dgt_documentorevisao', revisaoId, ['_dgt_responsavel_value', '_dgt_documento_value']);

    if (!revisao) {
      return undefined;
    }

    const documentoId = guid(revisao.registro._dgt_documento_value);
    const documento =
      await this.dataverse.obterRegistro('dgt_documento', documentoId, ['_dgt_area_value', 'dgt_codigo', 'dgt_titulo']);

    if (!documento) {
      return undefined;
    }

    const autorId = guid(revisao.registro._dgt_responsavel_value);
    const areaId = guid(documento.registro._dgt_area_value);
    const vinculosArea = await this.vinculos();
    const definicoes = obterPersistenciaFluxo(this.dataverse).servico;

    return {
      rotuloRevisao: String(documento.registro.dgt_codigo || ''),
      resolverResponsaveis: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>): IResponsavelResolvido[] =>
        resolverResponsaveis(responsaveis, { revisaoResponsavelId: autorId, documentoAreaId: areaId, valores }, vinculosArea),
      // Só o subprocesso roda daqui. Uma publicação logo depois do
      // subprocesso fica como "Publicação pendente" no documento pai.
      executarAcoesSistema: async (acoes, instancia) => {
        if (acoes.indexOf('criarSubprocessos') < 0) {
          return;
        }
        const definicao = await definicoes.definicaoDaInstancia(instancia);
        if (definicao) {
          await this.executarPendentes(definicao, instancia, {
            documento: {
              id: documentoId,
              codigo: String(documento.registro.dgt_codigo || ''),
              titulo: String(documento.registro.dgt_titulo || ''),
              areaId
            },
            revisaoId,
            autorPaiId: autorId,
            usuarioId: usuario.id,
            usuarioNome: usuario.nome
          });
        }
      }
    };
  }

  // Um documento filho concluiu: se o pai espera por ele e todos os
  // filhos já concluíram, o pai segue para a próxima etapa.
  // Nunca lança erro (devolve false).
  public async avisarPai(
    origem: IOrigemSubprocesso | undefined,
    usuario: { id: string; nome: string }
  ): Promise<boolean> {

    if (!origem || !origem.revisaoId) {
      return false;
    }

    try {
      const contexto = await this.contextoDoPai(origem.revisaoId, usuario);

      if (!contexto) {
        return false;
      }

      const ator: IFluxoAtor = { id: usuario.id, nome: usuario.nome, papeisTeste: [] };

      const resultado =
        await obterPersistenciaFluxo(this.dataverse).servico.retomarSubprocesso(
          origem.revisaoId,
          ator,
          pedido => this.avaliarFilhos(pedido),
          contexto
        );

      if (resultado.ok) {
        await new DocumentoHistoricoService(this.dataverse).registrarSemInterromper({
          documentoId: origem.documentoId,
          tipo: 'OUTRO',
          titulo: 'Subprocesso concluído — fluxo retomado',
          descricao: `Todos os documentos do subprocesso "${origem.elementoNome || ''}" foram concluídos; o fluxo seguiu para a próxima etapa.`,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome
        });
      }

      return resultado.ok;
    } catch (erro) {
      console.error('Subprocesso: não foi possível avisar o documento de origem:', erro);
      return false;
    }
  }
}
