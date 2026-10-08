import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  ANALISE,
  ANALISE_NOTA,
  BIND_BOM,
  BOM,
  CRITERIO,
  DEMANDA,
  DEMANDA_RESPONSAVEL,
  DecisaoGoNoGo,
  OPCOES_BOM,
  TABELAS_BOM,
  calcularPontuacao,
  decisaoPorPontuacao,
  liberaSelecaoKit,
  textoOpcao,
  valorOpcao
} from './esquemaBom';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — ACESSO AOS DADOS (Dataverse)
//
// Fase 1: Demanda, B.O.M. e Matriz Go/No-Go.
// Regras de histórico:
//   • análise Go/No-Go nunca é editada: cada registro é uma linha
//     nova; a válida é a mais recente;
//   • responsável retirado da demanda é DESATIVADO, não excluído.
// ============================================================

export type EtapaBom =
  | 'Dados da demanda'
  | 'Go/No-Go pendente'
  | 'Bloqueado no Go/No-Go'
  | 'Seleção de kit'
  | 'Cálculo de HH'
  | 'B.O.M. pronto'
  | 'Enviado para aprovação';

export interface IResponsavelDemanda {
  id?: string;
  usuarioId: string;
  nome: string;
  principal: boolean;
  ativo: boolean;
}

export interface IDemandaBom {
  id: string;
  numero: string;
  nome: string;
  cliente: string;
  codigoCigam: string;
  municipio: string;
  uf: string;
  numeroCrm: string;
  canal: string;
  modalidade: string;
  executivoVendasId: string;
  dataEntrada: string;
  prazoEntrega: string;
  statusDemanda: string;
  observacaoEtapa: string;
  tipoEntrega: string;
  solucoes: string[];
  tipoProjeto: string;
  pontosEstimados?: number;
  escopo: string;
  linkEdital: string;
  origem: string;
  cadastroCompleto: boolean;
  responsaveis: IResponsavelDemanda[];
}

export interface IBomRegistro {
  id: string;
  numero: string;
  demandaId: string;
  revisao: string;
  responsavelId: string;
  responsavelNome: string;
  etapa: EtapaBom;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ICriterioGoNoGo {
  id: string;
  nome: string;
  descricao: string;
  peso: number;
  ordem: number;
  ativo: boolean;
}

export interface INotaAnalise {
  criterioId: string;
  criterioNome: string;
  peso: number;
  nota: number;
  pontos: number;
  justificativa: string;
}

export interface IAnaliseGoNoGo {
  id: string;
  data: string;
  avaliadorNome: string;
  pontuacao: number;
  decisao: DecisaoGoNoGo;
  parecer: string;
  liberaKit: boolean;
  notas: INotaAnalise[];
}

export interface IVisaoGeralBom {
  boms: IBomRegistro[];
  demandas: IDemandaBom[];
  // Última análise de cada demanda (id da demanda → análise).
  ultimaAnalise: { [demandaId: string]: IAnaliseGoNoGo };
}

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const formatado = (registro: IDataverseRecord, campo: string): string =>
  texto(registro, `${campo}@OData.Community.Display.V1.FormattedValue`);

const data = (valor: string): string =>
  valor ? valor.substring(0, 10) : '';

const filtroOu = (campo: string, ids: string[]): string =>
  ids.map(id => `${campo} eq ${guid(id)}`).join(' or ');

// Etapa calculada a partir dos dados (mesma regra do protótipo).
export const etapaCalculada = (
  demanda: IDemandaBom | undefined,
  analise: IAnaliseGoNoGo | undefined,
  etapaGravada: EtapaBom
): EtapaBom => {

  // Etapas posteriores (kit, HH, pronto, enviado) são definidas
  // pelas próprias telas, quando existirem.
  if (['Seleção de kit', 'Cálculo de HH', 'B.O.M. pronto', 'Enviado para aprovação'].indexOf(etapaGravada) >= 0 && analise && analise.liberaKit) {
    return etapaGravada;
  }

  if (!demanda || !demanda.cadastroCompleto) {
    return 'Dados da demanda';
  }

  if (!analise) {
    return 'Go/No-Go pendente';
  }

  return analise.liberaKit ? 'Seleção de kit' : 'Bloqueado no Go/No-Go';
};

export class BomService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  private mapearDemanda(
    registro: IDataverseRecord,
    responsaveis: IResponsavelDemanda[]
  ): IDemandaBom {

    const solucoes =
      texto(registro, DEMANDA.solucoesInteresse)
        .split(',')
        .map(valor => textoOpcao(OPCOES_BOM.solucoesInteresse, valor.trim()))
        .filter(Boolean);

    const pontos = registro[DEMANDA.pontosEstimados];

    return {
      id: guid(registro[DEMANDA.id]),
      numero: texto(registro, DEMANDA.numero),
      nome: texto(registro, DEMANDA.nome),
      cliente: texto(registro, DEMANDA.cliente),
      codigoCigam: texto(registro, DEMANDA.codigoCigam),
      municipio: texto(registro, DEMANDA.municipio),
      uf: textoOpcao(OPCOES_BOM.uf, registro[DEMANDA.uf]),
      numeroCrm: texto(registro, DEMANDA.numeroCrm),
      canal: textoOpcao(OPCOES_BOM.canal, registro[DEMANDA.canal]),
      modalidade: textoOpcao(OPCOES_BOM.modalidade, registro[DEMANDA.modalidade]),
      executivoVendasId: guid(registro[`_${DEMANDA.executivoVendas}_value`]),
      dataEntrada: data(texto(registro, DEMANDA.dataEntrada)),
      prazoEntrega: data(texto(registro, DEMANDA.prazoEntrega)),
      statusDemanda: textoOpcao(OPCOES_BOM.statusDemanda, registro[DEMANDA.statusDemanda]),
      observacaoEtapa: texto(registro, DEMANDA.observacaoEtapa),
      tipoEntrega: textoOpcao(OPCOES_BOM.tipoEntrega, registro[DEMANDA.tipoEntrega]),
      solucoes,
      tipoProjeto: textoOpcao(OPCOES_BOM.tipoProjeto, registro[DEMANDA.tipoProjeto]),
      pontosEstimados: pontos === null || pontos === undefined ? undefined : Number(pontos),
      escopo: texto(registro, DEMANDA.escopo),
      linkEdital: texto(registro, DEMANDA.linkEdital),
      origem: textoOpcao(OPCOES_BOM.origem, registro[DEMANDA.origem]),
      cadastroCompleto: registro[DEMANDA.cadastroCompleto] === true,
      responsaveis
    };
  }

  private async lerResponsaveis(): Promise<IDataverseRecord[]> {
    return this.dataverse.listarRegistros(
      TABELAS_BOM.demandaResponsavel,
      `$select=${DEMANDA_RESPONSAVEL.id},_${DEMANDA_RESPONSAVEL.demanda}_value,_${DEMANDA_RESPONSAVEL.usuario}_value,${DEMANDA_RESPONSAVEL.principal},${DEMANDA_RESPONSAVEL.ativo}`
    );
  }

  private responsaveisDe(
    registros: IDataverseRecord[],
    demandaId: string
  ): IResponsavelDemanda[] {
    return registros
      .filter(item => guid(item[`_${DEMANDA_RESPONSAVEL.demanda}_value`]) === guid(demandaId))
      .map(item => ({
        id: guid(item[DEMANDA_RESPONSAVEL.id]),
        usuarioId: guid(item[`_${DEMANDA_RESPONSAVEL.usuario}_value`]),
        nome: formatado(item, `_${DEMANDA_RESPONSAVEL.usuario}_value`) || 'Usuário',
        principal: item[DEMANDA_RESPONSAVEL.principal] === true,
        ativo: item[DEMANDA_RESPONSAVEL.ativo] !== false
      }));
  }

  private mapearBom(registro: IDataverseRecord): IBomRegistro {
    return {
      id: guid(registro[BOM.id]),
      numero: texto(registro, BOM.numero),
      demandaId: guid(registro[`_${BOM.demanda}_value`]),
      revisao: texto(registro, BOM.revisao) || 'RV00',
      responsavelId: guid(registro[`_${BOM.responsavel}_value`]),
      responsavelNome: formatado(registro, `_${BOM.responsavel}_value`) || '-',
      etapa: (textoOpcao(OPCOES_BOM.etapa, registro[BOM.etapa]) || 'Dados da demanda') as EtapaBom,
      criadoEm: data(texto(registro, 'createdon')),
      atualizadoEm: data(texto(registro, 'modifiedon'))
    };
  }

  private mapearAnalise(registro: IDataverseRecord): IAnaliseGoNoGo {
    return {
      id: guid(registro[ANALISE.id]),
      data: texto(registro, ANALISE.dataAnalise) || texto(registro, 'createdon'),
      avaliadorNome: formatado(registro, `_${ANALISE.avaliador}_value`) || '-',
      pontuacao: Number(registro[ANALISE.pontuacao] || 0),
      decisao: (textoOpcao(OPCOES_BOM.decisao, registro[ANALISE.decisao]) || 'NO-GO') as DecisaoGoNoGo,
      parecer: texto(registro, ANALISE.parecer),
      liberaKit: registro[ANALISE.liberaKit] === true,
      notas: []
    };
  }

  public async carregarVisaoGeral(): Promise<IVisaoGeralBom> {

    const [registrosBom, registrosDemanda, registrosResp, registrosAnalise] =
      await Promise.all([
        this.dataverse.listarRegistros(
          TABELAS_BOM.bom,
          `$select=${BOM.id},${BOM.numero},_${BOM.demanda}_value,${BOM.revisao},_${BOM.responsavel}_value,${BOM.etapa},createdon,modifiedon&$filter=${BOM.ativo} eq true&$orderby=createdon desc`
        ),
        this.dataverse.listarRegistros(TABELAS_BOM.demanda, `$filter=${DEMANDA.ativo} eq true`),
        this.lerResponsaveis(),
        this.dataverse.listarRegistros(
          TABELAS_BOM.analise,
          `$select=${ANALISE.id},_${ANALISE.demanda}_value,_${ANALISE.avaliador}_value,${ANALISE.dataAnalise},${ANALISE.pontuacao},${ANALISE.decisao},${ANALISE.parecer},${ANALISE.liberaKit},createdon&$orderby=createdon desc`
        )
      ]);

    const ultimaAnalise: { [demandaId: string]: IAnaliseGoNoGo } = {};

    registrosAnalise.forEach(registro => {
      const demandaId = guid(registro[`_${ANALISE.demanda}_value`]);
      if (!ultimaAnalise[demandaId]) {
        ultimaAnalise[demandaId] = this.mapearAnalise(registro);
      }
    });

    return {
      boms: registrosBom.map(registro => this.mapearBom(registro)),
      demandas: registrosDemanda.map(registro =>
        this.mapearDemanda(registro, this.responsaveisDe(registrosResp, guid(registro[DEMANDA.id])))
      ),
      ultimaAnalise
    };
  }

  public async carregarCriterios(): Promise<ICriterioGoNoGo[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_BOM.criterio,
        `$select=${CRITERIO.id},${CRITERIO.nome},${CRITERIO.descricao},${CRITERIO.peso},${CRITERIO.ordem},${CRITERIO.ativo}&$orderby=${CRITERIO.ordem} asc`
      );

    return registros.map(registro => ({
      id: guid(registro[CRITERIO.id]),
      nome: texto(registro, CRITERIO.nome),
      descricao: texto(registro, CRITERIO.descricao),
      peso: Number(registro[CRITERIO.peso] || 0),
      ordem: Number(registro[CRITERIO.ordem] || 0),
      ativo: registro[CRITERIO.ativo] !== false
    }));
  }

  public async carregarAnalises(
    demandaId: string
  ): Promise<IAnaliseGoNoGo[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELAS_BOM.analise,
        `$select=${ANALISE.id},_${ANALISE.avaliador}_value,${ANALISE.dataAnalise},${ANALISE.pontuacao},${ANALISE.decisao},${ANALISE.parecer},${ANALISE.liberaKit},createdon&$filter=_${ANALISE.demanda}_value eq ${guid(demandaId)}&$orderby=createdon desc`
      );

    const analises =
      registros.map(registro => this.mapearAnalise(registro));

    if (analises.length === 0) {
      return analises;
    }

    const notas =
      await this.dataverse.listarRegistros(
        TABELAS_BOM.analiseNota,
        `$select=_${ANALISE_NOTA.analise}_value,_${ANALISE_NOTA.criterio}_value,${ANALISE_NOTA.criterioNome},${ANALISE_NOTA.peso},${ANALISE_NOTA.nota},${ANALISE_NOTA.pontos},${ANALISE_NOTA.justificativa}&$filter=${filtroOu(`_${ANALISE_NOTA.analise}_value`, analises.map(item => item.id))}`
      );

    analises.forEach(analise => {
      analise.notas =
        notas
          .filter(nota => guid(nota[`_${ANALISE_NOTA.analise}_value`]) === analise.id)
          .map(nota => ({
            criterioId: guid(nota[`_${ANALISE_NOTA.criterio}_value`]),
            criterioNome: texto(nota, ANALISE_NOTA.criterioNome),
            peso: Number(nota[ANALISE_NOTA.peso] || 0),
            nota: Number(nota[ANALISE_NOTA.nota] || 0),
            pontos: Number(nota[ANALISE_NOTA.pontos] || 0),
            justificativa: texto(nota, ANALISE_NOTA.justificativa)
          }));
    });

    return analises;
  }

  // ----------------------------------------------------------
  // Gravação
  // ----------------------------------------------------------

  private async bind(tabela: string, id: string): Promise<string> {
    return this.dataverse.referenciaLookup(tabela, id);
  }

  // Novo B.O.M.: nasce na etapa "Dados da demanda", revisão RV00.
  public async criarBom(dados: {
    demandaId?: string;
    responsavelId: string;
    areaId?: string;
  }): Promise<string> {

    let demandaId = dados.demandaId;

    if (!demandaId) {
      const corpo: Record<string, unknown> = {
        [DEMANDA.nome]: 'Nova demanda (sem título)',
        [DEMANDA.origem]: valorOpcao(OPCOES_BOM.origem, 'Portal'),
        [DEMANDA.statusDemanda]: valorOpcao(OPCOES_BOM.statusDemanda, 'Lead qualificado'),
        [DEMANDA.cadastroCompleto]: false,
        [DEMANDA.ativo]: true,
        [DEMANDA.dataEntrada]: new Date().toISOString().substring(0, 10)
      };
      if (dados.areaId) {
        corpo[BIND_BOM.demandaArea] = await this.bind('dgt_area', dados.areaId);
      }
      demandaId = await this.dataverse.criarRegistro(TABELAS_BOM.demanda, corpo);

      await this.dataverse.criarRegistro(TABELAS_BOM.demandaResponsavel, {
        dgt_name: 'Responsável',
        [BIND_BOM.responsavelDemanda]: await this.bind(TABELAS_BOM.demanda, demandaId),
        [BIND_BOM.responsavelUsuario]: await this.bind('dgt_usuario', dados.responsavelId),
        [DEMANDA_RESPONSAVEL.principal]: true,
        [DEMANDA_RESPONSAVEL.ativo]: true
      });
    }

    return this.dataverse.criarRegistro(TABELAS_BOM.bom, {
      [BIND_BOM.bomDemanda]: await this.bind(TABELAS_BOM.demanda, demandaId),
      [BIND_BOM.bomResponsavel]: await this.bind('dgt_usuario', dados.responsavelId),
      [BOM.revisao]: 'RV00',
      [BOM.etapa]: valorOpcao(OPCOES_BOM.etapa, 'Dados da demanda'),
      [BOM.ativo]: true
    });
  }

  public async atualizarEtapa(
    bomId: string,
    etapa: EtapaBom
  ): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_BOM.bom, bomId, {
      [BOM.etapa]: valorOpcao(OPCOES_BOM.etapa, etapa)
    });
  }

  public async salvarDemanda(
    demanda: IDemandaBom,
    usuariosResponsaveis: string[],
    principalId: string
  ): Promise<void> {

    await this.dataverse.atualizarRegistro(TABELAS_BOM.demanda, demanda.id, {
      [DEMANDA.nome]: demanda.nome.trim(),
      [DEMANDA.cliente]: demanda.cliente.trim(),
      [DEMANDA.codigoCigam]: demanda.codigoCigam.trim(),
      [DEMANDA.municipio]: demanda.municipio.trim(),
      [DEMANDA.uf]: valorOpcao(OPCOES_BOM.uf, demanda.uf),
      [DEMANDA.numeroCrm]: demanda.numeroCrm.trim(),
      [DEMANDA.canal]: valorOpcao(OPCOES_BOM.canal, demanda.canal),
      [DEMANDA.modalidade]: valorOpcao(OPCOES_BOM.modalidade, demanda.modalidade),
      [BIND_BOM.demandaExecutivo]: demanda.executivoVendasId
        ? await this.bind('dgt_usuario', demanda.executivoVendasId)
        : null,
      [DEMANDA.dataEntrada]: demanda.dataEntrada || null,
      [DEMANDA.prazoEntrega]: demanda.prazoEntrega || null,
      [DEMANDA.statusDemanda]: valorOpcao(OPCOES_BOM.statusDemanda, demanda.statusDemanda),
      [DEMANDA.observacaoEtapa]: demanda.observacaoEtapa.trim(),
      [DEMANDA.tipoEntrega]: valorOpcao(OPCOES_BOM.tipoEntrega, demanda.tipoEntrega),
      [DEMANDA.solucoesInteresse]: demanda.solucoes.length > 0
        ? demanda.solucoes.map(item => valorOpcao(OPCOES_BOM.solucoesInteresse, item)).filter(item => item !== null).join(',')
        : null,
      [DEMANDA.tipoProjeto]: valorOpcao(OPCOES_BOM.tipoProjeto, demanda.tipoProjeto),
      [DEMANDA.pontosEstimados]: demanda.pontosEstimados === undefined ? null : demanda.pontosEstimados,
      [DEMANDA.escopo]: demanda.escopo,
      [DEMANDA.linkEdital]: demanda.linkEdital.trim(),
      [DEMANDA.cadastroCompleto]: demanda.cadastroCompleto
    });

    // Responsáveis: inclui os novos, reativa e desativa (nunca exclui).
    const atuais = demanda.responsaveis;
    const desejados = usuariosResponsaveis.map(guid);

    for (const usuarioId of desejados) {
      const existente = atuais.find(item => item.usuarioId === usuarioId);
      const principal = usuarioId === guid(principalId);
      if (!existente) {
        await this.dataverse.criarRegistro(TABELAS_BOM.demandaResponsavel, {
          dgt_name: 'Responsável',
          [BIND_BOM.responsavelDemanda]: await this.bind(TABELAS_BOM.demanda, demanda.id),
          [BIND_BOM.responsavelUsuario]: await this.bind('dgt_usuario', usuarioId),
          [DEMANDA_RESPONSAVEL.principal]: principal,
          [DEMANDA_RESPONSAVEL.ativo]: true
        });
      } else if (!existente.ativo || existente.principal !== principal) {
        await this.dataverse.atualizarRegistro(TABELAS_BOM.demandaResponsavel, existente.id as string, {
          [DEMANDA_RESPONSAVEL.principal]: principal,
          [DEMANDA_RESPONSAVEL.ativo]: true
        });
      }
    }

    for (const atual of atuais) {
      if (atual.ativo && desejados.indexOf(atual.usuarioId) < 0 && atual.id) {
        await this.dataverse.atualizarRegistro(TABELAS_BOM.demandaResponsavel, atual.id, {
          [DEMANDA_RESPONSAVEL.ativo]: false,
          [DEMANDA_RESPONSAVEL.principal]: false
        });
      }
    }
  }

  // Registra uma análise nova (nunca edita a anterior).
  public async registrarAnalise(dados: {
    demandaId: string;
    bomId: string;
    avaliadorId: string;
    criterios: ICriterioGoNoGo[];
    notas: { [criterioId: string]: number };
    justificativas: { [criterioId: string]: string };
    parecer: string;
  }): Promise<IAnaliseGoNoGo> {

    const ativos = dados.criterios.filter(item => item.ativo);

    const itens =
      ativos.map(criterio => {
        const nota = dados.notas[criterio.id] || 3;
        return {
          criterio,
          nota,
          pontos: Math.round(nota * criterio.peso * 0.2 * 100) / 100,
          justificativa: (dados.justificativas[criterio.id] || '').trim()
        };
      });

    const pontuacao =
      calcularPontuacao(itens.map(item => ({ nota: item.nota, peso: item.criterio.peso })));

    const decisao = decisaoPorPontuacao(pontuacao);
    const libera = liberaSelecaoKit(decisao, dados.parecer);
    const agora = new Date().toISOString();

    const analiseId =
      await this.dataverse.criarRegistro(TABELAS_BOM.analise, {
        [ANALISE.nome]: `Go/No-Go ${agora.substring(0, 10)} · ${decisao} · ${pontuacao}`,
        [BIND_BOM.analiseDemanda]: await this.bind(TABELAS_BOM.demanda, dados.demandaId),
        [BIND_BOM.analiseBom]: await this.bind(TABELAS_BOM.bom, dados.bomId),
        [BIND_BOM.analiseAvaliador]: await this.bind('dgt_usuario', dados.avaliadorId),
        [ANALISE.dataAnalise]: agora,
        [ANALISE.pontuacao]: pontuacao,
        [ANALISE.decisao]: valorOpcao(OPCOES_BOM.decisao, decisao),
        [ANALISE.parecer]: dados.parecer.trim(),
        [ANALISE.liberaKit]: libera
      });

    for (const item of itens) {
      await this.dataverse.criarRegistro(TABELAS_BOM.analiseNota, {
        [ANALISE_NOTA.nome]: item.criterio.nome,
        [BIND_BOM.notaAnalise]: await this.bind(TABELAS_BOM.analise, analiseId),
        [BIND_BOM.notaCriterio]: await this.bind(TABELAS_BOM.criterio, item.criterio.id),
        [ANALISE_NOTA.criterioNome]: item.criterio.nome,
        [ANALISE_NOTA.peso]: item.criterio.peso,
        [ANALISE_NOTA.nota]: item.nota,
        [ANALISE_NOTA.pontos]: item.pontos,
        [ANALISE_NOTA.justificativa]: item.justificativa
      });
    }

    await this.atualizarEtapa(dados.bomId, libera ? 'Seleção de kit' : 'Bloqueado no Go/No-Go');

    return {
      id: guid(analiseId),
      data: agora,
      avaliadorNome: '',
      pontuacao,
      decisao,
      parecer: dados.parecer.trim(),
      liberaKit: libera,
      notas: itens.map(item => ({
        criterioId: item.criterio.id,
        criterioNome: item.criterio.nome,
        peso: item.criterio.peso,
        nota: item.nota,
        pontos: item.pontos,
        justificativa: item.justificativa
      }))
    };
  }
}
