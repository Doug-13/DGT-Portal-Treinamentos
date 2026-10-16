import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  ALTERACAO,
  BIND_ORCAMENTO,
  BIND_PROPRIETARIO,
  CENARIO_ORCADO,
  CONFIG_AREA,
  EVENTO,
  LINHA,
  MOTIVO_DEVOLUCAO_MINIMO,
  NOMES_MESES,
  OrigemAlteracao,
  PLANILHA,
  PRAZO_AJUSTE_DIAS_UTEIS,
  REGRA,
  STATUS_PLANILHA,
  StatusPlanilha,
  TABELAS_ORCAMENTO,
  TipoAlteracao,
  TipoBaseRegra,
  TipoEventoOrcamento
} from './esquemaOrcamento';

import {
  PLANO_CONTAS
} from './planoContasOrcamento';

import {
  IRegraCalculo
} from './calculoOrcamento';

import {
  adicionarDiasUteis
} from './diasUteis';

// ============================================================
// PLANEJAMENTO ORÇAMENTÁRIO — ACESSO AOS DADOS (Dataverse)
//
// Quem vê o quê:
//   • Gestor        → as planilhas das ÁREAS em que é gestor (uma por
//                     área, compartilhada com os outros gestores da
//                     área). A planilha, as linhas, o log e o histórico
//                     ficam com a EQUIPE da área como proprietária; o
//                     gestor é membro da equipe (script
//                     sincronizar-equipes-orcamento.ps1) e lê no nível
//                     Usuário — portanto só vê as das suas áreas;
//   • Administrador → todas as planilhas (Ler no nível Organização).
//
// O filtro desta classe organiza a TELA. A proteção real dos dados
// está nas Security Roles do Dataverse (ver o script
// scripts/dataverse/criar-tabelas-orcamento.ps1).
//
// Regras de histórico:
//   • linha removida é DESATIVADA (dgt_ativo = Não), nunca excluída;
//   • a planilha nunca é excluída pelo portal;
//   • toda alteração salva gera um registro em dgt_orcamentoalteracao
//     (valor anterior → novo, quem e quando).
// ============================================================

export interface IPlanilhaOrcamento {
  id: string;
  nome: string;
  ano: number;
  gestorId: string;
  gestorNome: string;
  // Área da planilha ('' = Geral / sem área).
  areaId: string;
  areaNome: string;
  status: StatusPlanilha;
  dataEnvio: string;
  observacao: string;
  // Última devolução para ajuste (vazio se nunca foi devolvida).
  motivoDevolucao: string;
  dataDevolucao: string;
  devolvidoPor: string;
  // Fim do prazo para ajuste (dias úteis após a devolução).
  prazoAjuste: string;
  // Equipe proprietária ('' = dono é um usuário). Tudo o que for
  // criado na planilha vai para a mesma equipe.
  equipeId: string;
  // Fluxo de aprovação: etapa atual e prazo dela (vazio = sem fluxo).
  etapaAtual: string;
  prazoEtapa: string;
  criadoEm: string;
  alteradoEm: string;
}

export interface IEventoOrcamento {
  id: string;
  tipo: string;
  motivo: string;
  usuarioNome: string;
  data: string;
}

export interface ILinhaOrcamento {
  // undefined = linha nova, ainda não gravada.
  id?: string;
  // Chave estável para a tela (id gravado ou um id temporário).
  chave: string;
  planilhaId: string;
  grupo: string;
  codigo: string;
  conta: string;
  descricao: string;
  ordem: number;
  // Sempre 12 posições (janeiro a dezembro).
  valores: number[];
}

export interface IAlteracoesOrcamento {
  novas: ILinhaOrcamento[];
  alteradas: ILinhaOrcamento[];
  removidas: ILinhaOrcamento[];
  // Equipe proprietária da planilha (linhas e log novos vão para ela).
  equipeId?: string;
}

// Contexto do log de alterações gravado junto com o salvamento.
export interface IContextoLog {
  usuarioNome: string;
  // Valores antes da alteração (id da linha → linha como estava).
  originais: { [id: string]: ILinhaOrcamento };
  // Códigos das contas calculadas por regra (origem do log).
  codigosCalculados: string[];
}

export interface IResultadoGravacao {
  gravadas: number;
  falhas: string[];
  // Avisos que não impedem o salvamento (ex.: log não gravado).
  avisos: string[];
  // chave temporária → id criado no Dataverse
  idsCriados: { [chave: string]: string };
}

export interface IDetalheAlteracao {
  campo: string;
  de: string | number;
  para: string | number;
}

export interface IAlteracaoOrcamento {
  id: string;
  planilhaId: string;
  linhaId: string;
  grupo: string;
  codigo: string;
  conta: string;
  tipo: TipoAlteracao;
  origem: OrigemAlteracao;
  detalhes: IDetalheAlteracao[];
  resumo: string;
  usuarioNome: string;
  data: string;
}

export interface IAreaOrcamento {
  id: string;
  nome: string;
}

export interface IConfigArea {
  id: string;
  areaId: string;
  areaNome: string;
  grupos: string[];
  // Equipe da área ('' = ainda não sincronizada).
  equipeId: string;
  alteradoEm: string;
}

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const numero = (valor: unknown): number => {
  const convertido = Number(valor);
  return isFinite(convertido) ? convertido : 0;
};

const lerListaJson = (valor: string): string[] => {
  try {
    const lista = JSON.parse(valor || '[]');
    return Array.isArray(lista) ? lista.map(item => String(item)) : [];
  } catch {
    return [];
  }
};

const formatoValor = (valor: number): string =>
  (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Arredonda em centavos para evitar 0,1 + 0,2 = 0,30000000000000004.
export const arredondar = (valor: number): number =>
  Math.round((valor || 0) * 100) / 100;

export const totalLinha = (linha: ILinhaOrcamento): number =>
  arredondar(linha.valores.reduce((soma, valor) => soma + (valor || 0), 0));

let contadorTemporario = 0;

export const novaChaveTemporaria = (): string => {
  contadorTemporario++;
  return `nova-${new Date().getTime()}-${contadorTemporario}`;
};

export const mesesVazios = (): number[] =>
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// Executa as tarefas com no máximo "limite" chamadas simultâneas ao
// Dataverse (mais rápido que uma a uma, sem provocar limitação de
// requisições do serviço).
const executarEmParalelo = async <T>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<void>
): Promise<void> => {

  let proximo = 0;

  const trabalhador = async (): Promise<void> => {
    while (proximo < itens.length) {
      const atual = itens[proximo];
      proximo++;
      await tarefa(atual);
    }
  };

  const trabalhadores: Array<Promise<void>> = [];

  for (let i = 0; i < Math.min(limite, itens.length); i++) {
    trabalhadores.push(trabalhador());
  }

  await Promise.all(trabalhadores);
};

const GRAVACOES_SIMULTANEAS = 6;

// Linhas do modelo (Orcamento_DGT_AAAA.xlsx), na ordem da planilha,
// todas zeradas. Com "grupos", só as contas desses grupos (contas
// configuradas para a área).
export const linhasDoModelo = (
  planilhaId: string,
  grupos?: string[]
): ILinhaOrcamento[] =>
  PLANO_CONTAS
    .map((conta, indice) => ({
      chave: novaChaveTemporaria(),
      planilhaId,
      grupo: conta.grupo,
      codigo: conta.codigo,
      conta: conta.conta,
      descricao: '',
      ordem: (indice + 1) * 10,
      valores: mesesVazios()
    }))
    .filter(linha => !grupos || grupos.length === 0 || grupos.indexOf(linha.grupo) >= 0);

// Compara a linha com a versão gravada e lista o que mudou.
export const diferencasLinha = (
  antes: ILinhaOrcamento | undefined,
  depois: ILinhaOrcamento
): IDetalheAlteracao[] => {

  const detalhes: IDetalheAlteracao[] = [];

  const anteriores = antes ? antes.valores : mesesVazios();

  depois.valores.forEach((valor, mes) => {
    const anterior = arredondar(anteriores[mes] || 0);
    const novo = arredondar(valor || 0);
    if (anterior !== novo) {
      detalhes.push({ campo: NOMES_MESES[mes], de: anterior, para: novo });
    }
  });

  const descricaoAntes = antes ? antes.descricao || '' : '';

  if (descricaoAntes !== (depois.descricao || '')) {
    detalhes.push({ campo: 'Descrição', de: descricaoAntes, para: depois.descricao || '' });
  }

  return detalhes;
};

export const resumirDetalhes = (
  detalhes: IDetalheAlteracao[]
): string =>
  detalhes
    .map(item =>
      typeof item.de === 'number' && typeof item.para === 'number'
        ? `${item.campo}: ${formatoValor(item.de)} → ${formatoValor(item.para)}`
        : `${item.campo}: "${item.de || '—'}" → "${item.para || '—'}"`
    )
    .join('; ');

export class OrcamentoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // Mapeamento
  // ----------------------------------------------------------

  private mapearPlanilha(registro: IDataverseRecord): IPlanilhaOrcamento {

    const gravado =
      texto(registro, PLANILHA.status);

    const conhecidos: string[] = [
      STATUS_PLANILHA.enviada,
      STATUS_PLANILHA.devolvida,
      STATUS_PLANILHA.emAprovacao,
      STATUS_PLANILHA.aprovada
    ];

    const status: StatusPlanilha =
      conhecidos.indexOf(gravado) >= 0
        ? gravado as StatusPlanilha
        : STATUS_PLANILHA.emPreenchimento;

    return {
      id: guid(registro[PLANILHA.id]),
      nome: texto(registro, PLANILHA.nome),
      ano: numero(registro[PLANILHA.ano]),
      gestorId: guid(registro[PLANILHA.gestorValor]),
      gestorNome:
        texto(registro, PLANILHA.gestorNome) ||
        texto(registro, `${PLANILHA.gestorValor}@OData.Community.Display.V1.FormattedValue`),
      areaId: guid(registro[PLANILHA.areaValor]),
      areaNome:
        texto(registro, PLANILHA.areas) ||
        texto(registro, `${PLANILHA.areaValor}@OData.Community.Display.V1.FormattedValue`),
      status,
      dataEnvio: texto(registro, PLANILHA.dataEnvio),
      observacao: texto(registro, PLANILHA.observacao),
      motivoDevolucao: texto(registro, PLANILHA.motivoDevolucao),
      dataDevolucao: texto(registro, PLANILHA.dataDevolucao),
      devolvidoPor: texto(registro, PLANILHA.devolvidoPor),
      prazoAjuste: texto(registro, PLANILHA.prazoAjuste),
      equipeId: guid(registro[PLANILHA.equipeValor]),
      etapaAtual: texto(registro, PLANILHA.etapaAtual),
      prazoEtapa: texto(registro, PLANILHA.prazoEtapa),
      criadoEm: texto(registro, PLANILHA.criadoEm),
      alteradoEm: texto(registro, PLANILHA.alteradoEm)
    };
  }

  private mapearLinha(registro: IDataverseRecord): ILinhaOrcamento {

    const id =
      guid(registro[LINHA.id]);

    return {
      id,
      chave: id,
      planilhaId: guid(registro[LINHA.planilhaValor]),
      grupo: texto(registro, LINHA.grupo),
      codigo: texto(registro, LINHA.codigo),
      conta: texto(registro, LINHA.conta),
      descricao: texto(registro, LINHA.descricao),
      ordem: numero(registro[LINHA.ordem]),
      valores: LINHA.meses.map(campo => arredondar(numero(registro[campo])))
    };
  }

  // Colunas do fluxo de aprovação existem no Dataverse? (o script
  // criar-tabelas-orcamento.ps1 cria). Sem elas a tela continua
  // funcionando no modo simples. Verificado uma vez por sessão.
  private colunasFluxo: boolean | undefined;

  public async temColunasFluxo(): Promise<boolean> {
    if (this.colunasFluxo === undefined) {
      try {
        await this.dataverse.listarRegistros(
          TABELAS_ORCAMENTO.planilha,
          `$select=${PLANILHA.etapaAtual},${PLANILHA.prazoEtapa},${PLANILHA.fluxoEstado}&$top=1`
        );
        this.colunasFluxo = true;
      } catch {
        this.colunasFluxo = false;
      }
    }
    return this.colunasFluxo;
  }

  private async selectPlanilha(): Promise<string> {
    const base = this.camposPlanilha();
    return (await this.temColunasFluxo())
      ? `${base},${PLANILHA.etapaAtual},${PLANILHA.prazoEtapa}`
      : base;
  }

  private camposPlanilha(): string {
    return [
      PLANILHA.id,
      PLANILHA.nome,
      PLANILHA.ano,
      PLANILHA.gestorValor,
      PLANILHA.gestorNome,
      PLANILHA.areaValor,
      PLANILHA.areas,
      PLANILHA.status,
      PLANILHA.dataEnvio,
      PLANILHA.observacao,
      PLANILHA.motivoDevolucao,
      PLANILHA.dataDevolucao,
      PLANILHA.devolvidoPor,
      PLANILHA.prazoAjuste,
      PLANILHA.equipeValor,
      PLANILHA.criadoEm,
      PLANILHA.alteradoEm
    ].join(',');
  }

  private camposLinha(): string {
    return [
      LINHA.id,
      LINHA.planilhaValor,
      LINHA.grupo,
      LINHA.codigo,
      LINHA.conta,
      LINHA.descricao,
      LINHA.ordem
    ].concat(LINHA.meses).join(',');
  }

  // Corpo gravado de uma linha (sem a pesquisa da planilha).
  private corpoLinha(linha: ILinhaOrcamento): Record<string, unknown> {

    const corpo: Record<string, unknown> = {
      [LINHA.nome]: `${linha.codigo} ${linha.conta}`.trim().substring(0, 200),
      [LINHA.cenario]: CENARIO_ORCADO,
      [LINHA.grupo]: linha.grupo,
      [LINHA.codigo]: linha.codigo,
      [LINHA.conta]: linha.conta,
      [LINHA.descricao]: linha.descricao || '',
      [LINHA.ordem]: linha.ordem
    };

    LINHA.meses.forEach((campo, indice) => {
      corpo[campo] = arredondar(linha.valores[indice] || 0);
    });

    return corpo;
  }

  // ----------------------------------------------------------
  // Áreas
  // ----------------------------------------------------------

  // Áreas ativas (Contas por área, filtros do Administrador).
  public async listarAreas(): Promise<IAreaOrcamento[]> {

    const registros =
      await this.dataverse.listarRegistros(
        'dgt_area',
        '$select=dgt_areaid,dgt_name,dgt_sigla&$filter=dgt_ativo eq true&$orderby=dgt_name asc'
      );

    return registros.map(registro => {
      const sigla = texto(registro, 'dgt_sigla');
      const nome = texto(registro, 'dgt_name');
      return {
        id: guid(registro.dgt_areaid),
        // "CPU · COMERCIAL PÚBLICO" (sigla na frente, se o nome ainda não tiver).
        nome:
          sigla && !(nome === sigla || (nome.indexOf(sigla) === 0 && /^[·\-–:]/.test(nome.substring(sigla.length).trim())))
            ? `${sigla} · ${nome}`
            : nome
      };
    });
  }

  // ----------------------------------------------------------
  // Planilhas
  // ----------------------------------------------------------

  // Planilhas do ano das áreas do usuário (de qualquer gestor da
  // área) + a planilha "Geral" dele (sem área). A Security Role só
  // devolve as de equipes em que ele é membro.
  public async listarPlanilhasDoUsuario(
    ano: number,
    usuarioId: string,
    areaIds: string[]
  ): Promise<IPlanilhaOrcamento[]> {

    const condicoes =
      areaIds
        .filter(id => !!id)
        .map(id => `${PLANILHA.areaValor} eq ${guid(id)}`);

    if (usuarioId) {
      condicoes.push(`(${PLANILHA.areaValor} eq null and ${PLANILHA.gestorValor} eq ${guid(usuarioId)})`);
    }

    if (condicoes.length === 0) {
      return [];
    }

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.planilha,
        `$select=${await this.selectPlanilha()}` +
        `&$filter=${PLANILHA.ano} eq ${ano}` +
        ` and ${PLANILHA.ativo} eq true` +
        ` and (${condicoes.join(' or ')})` +
        `&$orderby=${PLANILHA.criadoEm} asc`
      );

    return registros.map(registro => this.mapearPlanilha(registro));
  }

  // Todas as planilhas do ano (Administrador). Para o Gestor, a
  // Security Role já devolve só as dele.
  public async listarPlanilhas(
    ano: number
  ): Promise<IPlanilhaOrcamento[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.planilha,
        `$select=${await this.selectPlanilha()}` +
        `&$filter=${PLANILHA.ano} eq ${ano} and ${PLANILHA.ativo} eq true` +
        `&$orderby=${PLANILHA.gestorNome} asc`
      );

    return registros.map(registro => this.mapearPlanilha(registro));
  }

  public async carregarLinhas(
    planilhaId: string
  ): Promise<ILinhaOrcamento[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.linha,
        `$select=${this.camposLinha()}` +
        `&$filter=${LINHA.planilhaValor} eq ${guid(planilhaId)}` +
        ` and ${LINHA.ativo} eq true` +
        `&$orderby=${LINHA.ordem} asc`
      );

    return registros.map(registro => this.mapearLinha(registro));
  }

  // Linhas de várias planilhas (consolidado do Administrador).
  // Consulta em blocos para não estourar o tamanho da URL.
  public async carregarLinhasDePlanilhas(
    planilhaIds: string[]
  ): Promise<ILinhaOrcamento[]> {

    const resultado: ILinhaOrcamento[] = [];
    const tamanhoBloco = 15;

    for (let inicio = 0; inicio < planilhaIds.length; inicio += tamanhoBloco) {

      const bloco =
        planilhaIds.slice(inicio, inicio + tamanhoBloco);

      const filtroPlanilhas =
        bloco.map(id => `${LINHA.planilhaValor} eq ${guid(id)}`).join(' or ');

      const registros =
        await this.dataverse.listarRegistros(
          TABELAS_ORCAMENTO.linha,
          `$select=${this.camposLinha()}` +
          `&$filter=(${filtroPlanilhas}) and ${LINHA.ativo} eq true` +
          `&$orderby=${LINHA.ordem} asc`
        );

      registros.forEach(registro => resultado.push(this.mapearLinha(registro)));
    }

    return resultado;
  }

  // Cria a planilha da área (ou a "Geral" do usuário, com area.id
  // vazio). Com "equipeId", a planilha fica com a equipe da área
  // como proprietária (todos os gestores da área veem). Se outro
  // gestor da área já tiver criado, devolve a existente.
  public async criarPlanilha(
    ano: number,
    contexto: IContextoAcesso,
    area: IAreaOrcamento,
    equipeId?: string
  ): Promise<IPlanilhaOrcamento> {

    const buscar = async (): Promise<IPlanilhaOrcamento | undefined> =>
      (await this.listarPlanilhasDoUsuario(ano, contexto.usuarioId, area.id ? [area.id] : []))
        .filter(item => item.areaId === guid(area.id))[0];

    const existente = await buscar();

    if (existente) {
      return existente;
    }

    const corpo: Record<string, unknown> = {
      [PLANILHA.nome]: `Orçamento ${ano} — ${area.nome}`.substring(0, 200),
      [PLANILHA.ano]: ano,
      [PLANILHA.gestorNome]: contexto.nome,
      [PLANILHA.areas]: area.nome.substring(0, 400),
      [PLANILHA.status]: STATUS_PLANILHA.emPreenchimento,
      [PLANILHA.ativo]: true,
      [BIND_ORCAMENTO.planilhaGestor]:
        await this.dataverse.referenciaLookup('dgt_usuario', contexto.usuarioId)
    };

    if (area.id) {
      corpo[BIND_ORCAMENTO.planilhaArea] =
        await this.dataverse.referenciaLookup('dgt_area', area.id);
    }

    if (area.id && equipeId) {
      corpo[BIND_PROPRIETARIO] =
        await this.dataverse.referenciaLookup('team', equipeId);
    }

    await this.dataverse.criarRegistro(
      TABELAS_ORCAMENTO.planilha,
      corpo
    );

    const criada = await buscar();

    if (!criada) {
      throw new Error('A planilha foi criada, mas não foi possível lê-la de volta. Verifique se você é membro da equipe da área (sincronizar-equipes-orcamento.ps1) e a permissão de Leitura na tabela dgt_orcamentoplanilha.');
    }

    return criada;
  }

  // Grava novas, alteradas e removidas (removida = desativada).
  // Continua mesmo se uma linha falhar e devolve o que falhou.
  // Com "log", registra cada alteração em dgt_orcamentoalteracao.
  public async salvarAlteracoes(
    planilhaId: string,
    alteracoes: IAlteracoesOrcamento,
    aoProgredir?: (feitas: number, total: number) => void,
    log?: IContextoLog
  ): Promise<IResultadoGravacao> {

    const resultado: IResultadoGravacao = {
      gravadas: 0,
      falhas: [],
      avisos: [],
      idsCriados: {}
    };

    const referenciaPlanilha =
      await this.dataverse.referenciaLookup(TABELAS_ORCAMENTO.planilha, planilhaId);

    // Linhas e log novos ficam com a mesma equipe da planilha.
    const referenciaEquipe =
      alteracoes.equipeId
        ? await this.dataverse.referenciaLookup('team', alteracoes.equipeId)
        : '';

    const descrever = (linha: ILinhaOrcamento): string =>
      `${linha.codigo} ${linha.conta}`.trim();

    const mensagem = (erro: unknown): string =>
      erro instanceof Error ? erro.message : String(erro);

    const registrosLog: Array<Record<string, unknown>> = [];

    const anotar = (
      linha: ILinhaOrcamento,
      linhaId: string,
      tipo: TipoAlteracao,
      detalhes: IDetalheAlteracao[],
      resumo: string
    ): void => {
      if (!log) {
        return;
      }
      const origem: OrigemAlteracao =
        log.codigosCalculados.indexOf(linha.codigo) >= 0 ? 'Cálculo automático' : 'Gestor';
      registrosLog.push({
        [ALTERACAO.nome]: `${tipo} — ${descrever(linha)}`.substring(0, 200),
        [ALTERACAO.linhaId]: linhaId,
        [ALTERACAO.grupo]: linha.grupo,
        [ALTERACAO.codigo]: linha.codigo,
        [ALTERACAO.conta]: linha.conta,
        [ALTERACAO.tipo]: tipo,
        [ALTERACAO.origem]: origem,
        [ALTERACAO.detalhes]: JSON.stringify(detalhes).substring(0, 4000),
        [ALTERACAO.resumo]: resumo.substring(0, 4000),
        [ALTERACAO.usuarioNome]: log.usuarioNome.substring(0, 200),
        [BIND_ORCAMENTO.alteracaoPlanilha]: referenciaPlanilha,
        ...(referenciaEquipe ? { [BIND_PROPRIETARIO]: referenciaEquipe } : {})
      });
    };

    await executarEmParalelo(alteracoes.removidas, GRAVACOES_SIMULTANEAS, async linha => {
      if (!linha.id) {
        return;
      }
      try {
        await this.dataverse.atualizarRegistro(
          TABELAS_ORCAMENTO.linha,
          linha.id,
          { [LINHA.ativo]: false }
        );
        resultado.gravadas++;
        anotar(linha, linha.id, 'Remoção', [], `Linha removida (total anual de ${formatoValor(totalLinha(linha))}).`);
      } catch (erro) {
        resultado.falhas.push(`Remover "${descrever(linha)}": ${mensagem(erro)}`);
      }
    });

    await executarEmParalelo(alteracoes.alteradas, GRAVACOES_SIMULTANEAS, async linha => {
      if (!linha.id) {
        return;
      }
      try {
        await this.dataverse.atualizarRegistro(
          TABELAS_ORCAMENTO.linha,
          linha.id,
          this.corpoLinha(linha)
        );
        resultado.gravadas++;
        const detalhes = diferencasLinha(log ? log.originais[linha.id] : undefined, linha);
        if (detalhes.length > 0) {
          anotar(linha, linha.id, 'Alteração', detalhes, resumirDetalhes(detalhes));
        }
      } catch (erro) {
        resultado.falhas.push(`Alterar "${descrever(linha)}": ${mensagem(erro)}`);
      }
    });

    let concluidas = 0;

    await executarEmParalelo(alteracoes.novas, GRAVACOES_SIMULTANEAS, async linha => {
      try {
        const corpo =
          this.corpoLinha(linha);

        corpo[LINHA.ativo] = true;
        corpo[BIND_ORCAMENTO.linhaPlanilha] = referenciaPlanilha;

        if (referenciaEquipe) {
          corpo[BIND_PROPRIETARIO] = referenciaEquipe;
        }

        const id =
          guid(await this.dataverse.criarRegistro(
            TABELAS_ORCAMENTO.linha,
            corpo
          ));

        resultado.idsCriados[linha.chave] = id;
        resultado.gravadas++;
        const detalhes = diferencasLinha(undefined, linha);
        anotar(linha, id, 'Inclusão', detalhes, detalhes.length > 0 ? `Linha incluída. ${resumirDetalhes(detalhes)}` : 'Linha incluída.');
      } catch (erro) {
        resultado.falhas.push(`Incluir "${descrever(linha)}": ${mensagem(erro)}`);
      } finally {
        concluidas++;
        if (aoProgredir) {
          aoProgredir(concluidas, alteracoes.novas.length);
        }
      }
    });

    // Log de alterações. Falhar aqui não desfaz o que foi salvo.
    let falhasLog = 0;
    let primeiroErroLog = '';

    await executarEmParalelo(registrosLog, GRAVACOES_SIMULTANEAS, async corpo => {
      try {
        await this.dataverse.criarRegistro(TABELAS_ORCAMENTO.alteracao, corpo);
      } catch (erro) {
        falhasLog++;
        primeiroErroLog = primeiroErroLog || mensagem(erro);
      }
    });

    if (falhasLog > 0) {
      resultado.avisos.push(
        `Os valores foram salvos, mas ${falhasLog} registro(s) do log de alterações não foram gravados: ${primeiroErroLog}`
      );
    }

    return resultado;
  }

  // Quantas linhas a planilha já teve (ativas OU removidas). Zero
  // significa que ela nunca foi preenchida — aí o portal carrega as
  // contas do modelo automaticamente. Se o gestor removeu linhas, elas
  // contam aqui, e o modelo não volta sozinho.
  public async contarLinhasJaCriadas(
    planilhaId: string
  ): Promise<number> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.linha,
        `$select=${LINHA.id}` +
        `&$filter=${LINHA.planilhaValor} eq ${guid(planilhaId)}`
      );

    return registros.length;
  }

  // Grava na planilha as contas do modelo, zeradas (só os grupos da
  // área, quando a área tem configuração). Não gera log.
  public async preencherComModelo(
    planilha: IPlanilhaOrcamento,
    grupos: string[] | undefined,
    aoProgredir?: (feitas: number, total: number) => void
  ): Promise<IResultadoGravacao> {
    return this.salvarAlteracoes(
      planilha.id,
      {
        novas: linhasDoModelo(planilha.id, grupos),
        alteradas: [],
        removidas: [],
        equipeId: planilha.equipeId
      },
      aoProgredir
    );
  }

  // ----------------------------------------------------------
  // Log de alterações
  // ----------------------------------------------------------

  public async listarAlteracoes(
    planilhaId: string
  ): Promise<IAlteracaoOrcamento[]> {

    const campos = [
      ALTERACAO.id,
      ALTERACAO.planilhaValor,
      ALTERACAO.linhaId,
      ALTERACAO.grupo,
      ALTERACAO.codigo,
      ALTERACAO.conta,
      ALTERACAO.tipo,
      ALTERACAO.origem,
      ALTERACAO.detalhes,
      ALTERACAO.resumo,
      ALTERACAO.usuarioNome,
      ALTERACAO.criadoEm
    ].join(',');

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.alteracao,
        `$select=${campos}` +
        `&$filter=${ALTERACAO.planilhaValor} eq ${guid(planilhaId)}` +
        `&$orderby=${ALTERACAO.criadoEm} desc`
      );

    return registros.map(registro => {
      let detalhes: IDetalheAlteracao[] = [];
      try {
        const lidos = JSON.parse(texto(registro, ALTERACAO.detalhes) || '[]');
        detalhes = Array.isArray(lidos) ? lidos : [];
      } catch {
        detalhes = [];
      }
      const tipo = texto(registro, ALTERACAO.tipo);
      return {
        id: guid(registro[ALTERACAO.id]),
        planilhaId: guid(registro[ALTERACAO.planilhaValor]),
        linhaId: guid(registro[ALTERACAO.linhaId]),
        grupo: texto(registro, ALTERACAO.grupo),
        codigo: texto(registro, ALTERACAO.codigo),
        conta: texto(registro, ALTERACAO.conta),
        tipo: (tipo === 'Inclusão' || tipo === 'Remoção' ? tipo : 'Alteração') as TipoAlteracao,
        origem: (texto(registro, ALTERACAO.origem) === 'Cálculo automático' ? 'Cálculo automático' : 'Gestor') as OrigemAlteracao,
        detalhes,
        resumo: texto(registro, ALTERACAO.resumo),
        usuarioNome: texto(registro, ALTERACAO.usuarioNome),
        data: texto(registro, ALTERACAO.criadoEm)
      };
    });
  }

  // ----------------------------------------------------------
  // Ciclo: enviar / devolver para ajuste / histórico
  // ----------------------------------------------------------

  // Registra no histórico. Uma falha aqui NÃO desfaz a ação principal
  // (devolve a mensagem para a tela avisar).
  public async registrarEvento(
    planilha: IPlanilhaOrcamento,
    tipo: TipoEventoOrcamento,
    motivo: string,
    usuarioNome: string
  ): Promise<string> {
    try {
      const corpo: Record<string, unknown> = {
        [EVENTO.nome]: `${tipo} — ${usuarioNome}`.substring(0, 200),
        [EVENTO.tipo]: tipo,
        [EVENTO.motivo]: motivo,
        [EVENTO.usuarioNome]: usuarioNome,
        [BIND_ORCAMENTO.eventoPlanilha]:
          await this.dataverse.referenciaLookup(TABELAS_ORCAMENTO.planilha, planilha.id)
      };
      // Histórico com a equipe da área: todos os gestores da área veem.
      if (planilha.equipeId) {
        corpo[BIND_PROPRIETARIO] = await this.dataverse.referenciaLookup('team', planilha.equipeId);
      }
      await this.dataverse.criarRegistro(TABELAS_ORCAMENTO.evento, corpo);
      return '';
    } catch (erro) {
      return `A ação foi concluída, mas não foi possível registrar o histórico: ${erro instanceof Error ? erro.message : String(erro)}`;
    }
  }

  // Gestor conclui (ou reenvia, após ajuste): fica somente leitura.
  // Devolve um aviso se o histórico não pôde ser gravado.
  public async enviarPlanilha(
    planilha: IPlanilhaOrcamento,
    contexto: IContextoAcesso
  ): Promise<string> {

    await this.dataverse.atualizarRegistro(
      TABELAS_ORCAMENTO.planilha,
      planilha.id,
      {
        [PLANILHA.status]: STATUS_PLANILHA.enviada,
        [PLANILHA.dataEnvio]: new Date().toISOString()
      }
    );

    return this.registrarEvento(planilha, 'Enviada', '', contexto.nome);
  }

  // Administrador devolve a planilha ENVIADA para o gestor ajustar.
  // O motivo é obrigatório e fica na planilha (o gestor vê) e no
  // histórico (todas as devoluções). O prazo para o ajuste é de
  // PRAZO_AJUSTE_DIAS_UTEIS dias úteis.
  public async devolverPlanilha(
    planilha: IPlanilhaOrcamento,
    motivo: string,
    contexto: IContextoAcesso
  ): Promise<string> {

    const motivoLimpo =
      (motivo || '').trim();

    if (motivoLimpo.length < MOTIVO_DEVOLUCAO_MINIMO) {
      throw new Error(`Informe o motivo da devolução (mínimo de ${MOTIVO_DEVOLUCAO_MINIMO} caracteres).`);
    }

    if (contexto.perfil !== 'Administrador') {
      throw new Error('Somente o Administrador pode devolver uma planilha.');
    }

    if (planilha.status !== STATUS_PLANILHA.enviada) {
      throw new Error('Só é possível devolver uma planilha que já foi enviada pelo gestor.');
    }

    const agora = new Date();
    const prazo = adicionarDiasUteis(agora, PRAZO_AJUSTE_DIAS_UTEIS);

    await this.dataverse.atualizarRegistro(
      TABELAS_ORCAMENTO.planilha,
      planilha.id,
      {
        [PLANILHA.status]: STATUS_PLANILHA.devolvida,
        [PLANILHA.motivoDevolucao]: motivoLimpo.substring(0, 4000),
        [PLANILHA.dataDevolucao]: agora.toISOString(),
        [PLANILHA.devolvidoPor]: contexto.nome.substring(0, 200),
        [PLANILHA.prazoAjuste]: prazo.toISOString()
      }
    );

    const dois = (numeroDia: number): string => (numeroDia < 10 ? `0${numeroDia}` : String(numeroDia));
    const prazoTexto = `${dois(prazo.getDate())}/${dois(prazo.getMonth() + 1)}/${prazo.getFullYear()}`;

    return this.registrarEvento(
      planilha,
      'Devolvida para ajuste',
      `${motivoLimpo}\n\nPrazo para ajuste: ${prazoTexto} (${PRAZO_AJUSTE_DIAS_UTEIS} dias úteis).`.substring(0, 4000),
      contexto.nome
    );
  }

  // Histórico da planilha, mais recente primeiro. Os eventos ficam com
  // a equipe da área, então todos os gestores da área os veem.
  public async listarEventos(
    planilhaId: string
  ): Promise<IEventoOrcamento[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.evento,
        `$select=${[EVENTO.id, EVENTO.tipo, EVENTO.motivo, EVENTO.usuarioNome, EVENTO.criadoEm].join(',')}` +
        `&$filter=${EVENTO.planilhaValor} eq ${guid(planilhaId)}` +
        `&$orderby=${EVENTO.criadoEm} desc`
      );

    return registros.map(registro => ({
      id: guid(registro[EVENTO.id]),
      tipo: texto(registro, EVENTO.tipo),
      motivo: texto(registro, EVENTO.motivo),
      usuarioNome: texto(registro, EVENTO.usuarioNome),
      data: texto(registro, EVENTO.criadoEm)
    }));
  }

  // ----------------------------------------------------------
  // Regras de cálculo (Administrador edita; todos leem)
  // ----------------------------------------------------------

  public async listarRegras(): Promise<IRegraCalculo[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.regra,
        `$select=${[REGRA.id, REGRA.nome, REGRA.contaDestino, REGRA.contaDestinoNome, REGRA.tipoBase, REGRA.base, REGRA.percentual, REGRA.ordem, REGRA.ativo].join(',')}` +
        `&$orderby=${REGRA.ordem} asc`
      );

    return registros.map(registro => ({
      id: guid(registro[REGRA.id]),
      nome: texto(registro, REGRA.nome),
      contaDestino: texto(registro, REGRA.contaDestino),
      contaDestinoNome: texto(registro, REGRA.contaDestinoNome),
      tipoBase: (texto(registro, REGRA.tipoBase) === 'Contas' ? 'Contas' : 'Grupo') as TipoBaseRegra,
      base: lerListaJson(texto(registro, REGRA.base)),
      percentual: numero(registro[REGRA.percentual]),
      ordem: numero(registro[REGRA.ordem]),
      ativo: registro[REGRA.ativo] !== false
    }));
  }

  // Cria (id vazio) ou atualiza uma regra.
  public async salvarRegra(
    regra: IRegraCalculo
  ): Promise<void> {

    const corpo: Record<string, unknown> = {
      [REGRA.nome]: `${regra.contaDestinoNome || regra.contaDestino}`.substring(0, 200),
      [REGRA.contaDestino]: regra.contaDestino,
      [REGRA.contaDestinoNome]: (regra.contaDestinoNome || '').substring(0, 200),
      [REGRA.tipoBase]: regra.tipoBase,
      [REGRA.base]: JSON.stringify(regra.base).substring(0, 4000),
      [REGRA.percentual]: Math.round((regra.percentual || 0) * 10000) / 10000,
      [REGRA.ordem]: Math.round(regra.ordem || 0),
      [REGRA.ativo]: regra.ativo
    };

    if (regra.id) {
      await this.dataverse.atualizarRegistro(TABELAS_ORCAMENTO.regra, regra.id, corpo);
    } else {
      await this.dataverse.criarRegistro(TABELAS_ORCAMENTO.regra, corpo);
    }
  }

  // ----------------------------------------------------------
  // Contas por área (Administrador edita; todos leem)
  // ----------------------------------------------------------

  public async listarConfigAreas(): Promise<IConfigArea[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_ORCAMENTO.configArea,
        `$select=${[CONFIG_AREA.id, CONFIG_AREA.areaValor, CONFIG_AREA.areaNome, CONFIG_AREA.grupos, CONFIG_AREA.equipeId, CONFIG_AREA.alteradoEm].join(',')}` +
        `&$filter=${CONFIG_AREA.ativo} eq true`
      );

    return registros.map(registro => ({
      id: guid(registro[CONFIG_AREA.id]),
      areaId: guid(registro[CONFIG_AREA.areaValor]),
      areaNome: texto(registro, CONFIG_AREA.areaNome),
      grupos: lerListaJson(texto(registro, CONFIG_AREA.grupos)),
      equipeId: guid(registro[CONFIG_AREA.equipeId]),
      alteradoEm: texto(registro, CONFIG_AREA.alteradoEm)
    }));
  }

  // Grupos que a área preenche (undefined = sem configuração = todos).
  public async gruposDaArea(
    areaId: string
  ): Promise<string[] | undefined> {

    if (!areaId) {
      return undefined;
    }

    const config =
      (await this.listarConfigAreas()).filter(item => item.areaId === guid(areaId))[0];

    return config && config.grupos.length > 0 ? config.grupos : undefined;
  }

  public async salvarConfigArea(
    area: IAreaOrcamento,
    grupos: string[],
    existenteId?: string
  ): Promise<void> {

    const corpo: Record<string, unknown> = {
      [CONFIG_AREA.nome]: `Contas — ${area.nome}`.substring(0, 200),
      [CONFIG_AREA.areaNome]: area.nome.substring(0, 200),
      [CONFIG_AREA.grupos]: JSON.stringify(grupos).substring(0, 4000),
      [CONFIG_AREA.ativo]: true
    };

    if (existenteId) {
      await this.dataverse.atualizarRegistro(TABELAS_ORCAMENTO.configArea, existenteId, corpo);
      return;
    }

    corpo[BIND_ORCAMENTO.configArea] =
      await this.dataverse.referenciaLookup('dgt_area', area.id);

    await this.dataverse.criarRegistro(TABELAS_ORCAMENTO.configArea, corpo);
  }
}
