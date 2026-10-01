import {
  IFluxoDefinicao,
  StatusDefinicaoFluxo
} from '../../../models/Fluxo';

import {
  IProcesso
} from '../../../models/Processo';

import {
  DataverseService,
  IDataverseRecord
} from '../../DataverseService';

import {
  FLUXO_MODELOS
} from '../definicoes/fluxoPopProcedimento';

import {
  definicaoParaBpmnXml,
  metadadosDaDefinicao
} from '../bpmn/bpmnConversao';

import {
  validarDefinicao
} from '../FluxoValidacao';

import {
  IFluxoCatalogo,
  idFluxoDoProcesso,
  IResultadoCatalogo
} from '../FluxoCatalogoLocal';

import {
  FLUXO,
  guid,
  lerJsonSeguro,
  TABELA_FLUXO,
  TABELA_PROCESSO,
  texto
} from './esquemaFluxo';

// ============================================================
// CATÁLOGO DE FLUXOS NO DATAVERSE (tabela dgt_fluxo)
//
// Uma linha por VERSÃO do fluxo de um processo. dgt_situacao:
//   rascunho | publicado | arquivado | descartado
// (rascunhos descartados não são apagados: ficam como "descartado").
//
// dgt_definicaojson guarda etapas, botões, caminhos e posições;
// dgt_bpmnxml guarda o desenho. Os metadados NÃO ficam aqui: são do
// processo (dgt_processometadado).
// ============================================================

const COLUNAS = [
  FLUXO.id,
  FLUXO.nome,
  FLUXO.processoValor,
  FLUXO.versao,
  FLUXO.situacao,
  FLUXO.definicaoJson,
  FLUXO.bpmnXml,
  FLUXO.modelo,
  FLUXO.publicadoEm,
  FLUXO.arquivadoEm,
  FLUXO.criadoEm
];

const PREFIXO_ID = 'processo-';

const processoDoFluxo = (
  fluxoId: string
): string | undefined =>
  fluxoId.indexOf(PREFIXO_ID) === 0
    ? fluxoId.slice(PREFIXO_ID.length)
    : undefined;

// O que vai para dgt_definicaojson (sem desenho e sem metadados).
const serializar = (
  definicao: IFluxoDefinicao
): string =>
  JSON.stringify({
    nome: definicao.nome,
    tiposDocumento: definicao.tiposDocumento,
    larguraDiagrama: definicao.larguraDiagrama,
    alturaDiagrama: definicao.alturaDiagrama,
    elementos: definicao.elementos,
    transicoes: definicao.transicoes,
    avisosModelagem: definicao.avisosModelagem || [],
    // Cópia dos metadados usados, só para referência histórica.
    metadadosNaPublicacao: definicao.metadados || []
  });

const paraDefinicao = (
  registro: IDataverseRecord
): IFluxoDefinicao => {

  const dados =
    lerJsonSeguro<Partial<IFluxoDefinicao> & { metadadosNaPublicacao?: IFluxoDefinicao['metadados'] }>(
      texto(registro, FLUXO.definicaoJson),
      {}
    );

  const processoId =
    guid(registro[FLUXO.processoValor]);

  return {
    id: idFluxoDoProcesso(processoId),
    registroId: guid(registro[FLUXO.id]),
    nome: texto(registro, FLUXO.nome) || dados.nome || 'Fluxo',
    versao: Number(registro[FLUXO.versao] || 0),
    status: (texto(registro, FLUXO.situacao) || 'rascunho') as StatusDefinicaoFluxo,
    processoId,
    modeloId: texto(registro, FLUXO.modelo) || undefined,
    tiposDocumento: dados.tiposDocumento || [],
    larguraDiagrama: dados.larguraDiagrama || 800,
    alturaDiagrama: dados.alturaDiagrama || 300,
    elementos: dados.elementos || [],
    transicoes: dados.transicoes || [],
    avisosModelagem: dados.avisosModelagem || [],
    metadados: dados.metadadosNaPublicacao || [],
    bpmnXml: texto(registro, FLUXO.bpmnXml) || undefined,
    criadoEm: texto(registro, FLUXO.criadoEm) || undefined,
    publicadoEm: texto(registro, FLUXO.publicadoEm) || undefined,
    arquivadoEm: texto(registro, FLUXO.arquivadoEm) || undefined
  };
};

export class FluxoCatalogoDataverse
  implements IFluxoCatalogo {

  public readonly local: boolean =
    false;

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  private async lerVersoes(
    processoId: string
  ): Promise<IFluxoDefinicao[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_FLUXO,
        `$select=${COLUNAS.join(',')}` +
        `&$filter=${FLUXO.processoValor} eq ${guid(processoId)} and ${FLUXO.situacao} ne 'descartado'` +
        `&$orderby=${FLUXO.versao} desc`
      );

    return registros.map(paraDefinicao);
  }

  public async listarVersoes(
    processoId: string
  ): Promise<IFluxoDefinicao[]> {
    return this.lerVersoes(processoId);
  }

  public async versaoPublicada(
    processoId: string
  ): Promise<IFluxoDefinicao | undefined> {
    return (await this.lerVersoes(processoId)).find(
      item => item.status === 'publicado'
    );
  }

  public async obterVersao(
    fluxoId: string,
    versao: number
  ): Promise<IFluxoDefinicao | undefined> {

    const processoId =
      processoDoFluxo(fluxoId);

    if (processoId) {
      return (await this.lerVersoes(processoId)).find(
        item => item.versao === versao
      );
    }

    const modelo =
      FLUXO_MODELOS.find(
        item => item.definicao.id === fluxoId && item.definicao.versao === versao
      );

    return modelo ? modelo.definicao : undefined;
  }

  // Versão pelo id do registro (dgt_documentorevisao.dgt_fluxo).
  public async obterPorRegistro(
    registroId: string
  ): Promise<IFluxoDefinicao | undefined> {

    const lido =
      await this.dataverse.obterRegistro(TABELA_FLUXO, registroId, COLUNAS);

    return lido ? paraDefinicao(lido.registro) : undefined;
  }

  private async criarLinha(
    processoId: string,
    definicao: IFluxoDefinicao
  ): Promise<IFluxoDefinicao> {

    const registroId =
      await this.dataverse.criarRegistro(
        TABELA_FLUXO,
        {
          [FLUXO.nome]: definicao.nome.slice(0, 200),
          [FLUXO.processoBind]: await this.dataverse.referenciaLookup(TABELA_PROCESSO, processoId),
          [FLUXO.versao]: definicao.versao,
          [FLUXO.situacao]: 'rascunho',
          [FLUXO.definicaoJson]: serializar(definicao),
          [FLUXO.bpmnXml]: definicao.bpmnXml || definicaoParaBpmnXml(definicao),
          [FLUXO.modelo]: definicao.modeloId || ''
        }
      );

    return {
      ...definicao,
      registroId: guid(registroId),
      status: 'rascunho'
    };
  }

  public async criarAPartirDoModelo(
    processo: IProcesso,
    modeloId: string
  ): Promise<IResultadoCatalogo> {

    if ((await this.lerVersoes(processo.id)).length > 0) {
      return {
        ok: false,
        erros: ['Este processo já possui fluxo. Crie uma nova versão em vez de outro fluxo.']
      };
    }

    const modelo =
      FLUXO_MODELOS.find(item => item.id === modeloId);

    if (!modelo) {
      return { ok: false, erros: ['Modelo de fluxo não encontrado.'] };
    }

    const base: IFluxoDefinicao = {
      ...(JSON.parse(JSON.stringify(modelo.definicao)) as IFluxoDefinicao),
      id: idFluxoDoProcesso(processo.id),
      nome: `${processo.codigo ? `${processo.codigo} — ` : ''}${processo.nome}`,
      versao: 1,
      status: 'rascunho',
      processoId: processo.id,
      modeloId: modelo.id
    };

    base.metadados = metadadosDaDefinicao(base);
    base.bpmnXml = definicaoParaBpmnXml(base);

    return {
      ok: true,
      erros: [],
      definicao: await this.criarLinha(processo.id, base)
    };
  }

  public async salvarRascunho(
    definicao: IFluxoDefinicao
  ): Promise<IResultadoCatalogo> {

    if (!definicao.processoId) {
      return { ok: false, erros: ['Fluxo sem processo.'] };
    }

    const rascunho =
      (await this.lerVersoes(definicao.processoId)).find(
        item => item.status === 'rascunho' && item.versao === definicao.versao
      );

    if (!rascunho || !rascunho.registroId) {
      return {
        ok: false,
        erros: ['Somente versões em rascunho podem ser alteradas. Crie uma nova versão.']
      };
    }

    await this.dataverse.atualizarRegistro(
      TABELA_FLUXO,
      rascunho.registroId,
      {
        [FLUXO.nome]: definicao.nome.slice(0, 200),
        [FLUXO.definicaoJson]: serializar(definicao),
        [FLUXO.bpmnXml]: definicao.bpmnXml || definicaoParaBpmnXml(definicao)
      }
    );

    return {
      ok: true,
      erros: [],
      definicao: { ...definicao, registroId: rascunho.registroId }
    };
  }

  public async publicarRascunho(
    processoId: string
  ): Promise<IResultadoCatalogo> {

    const versoes =
      await this.lerVersoes(processoId);

    const rascunho =
      versoes.find(item => item.status === 'rascunho');

    if (!rascunho || !rascunho.registroId) {
      return { ok: false, erros: ['Não há rascunho para publicar.'] };
    }

    const erros =
      validarDefinicao(rascunho);

    if (erros.length > 0) {
      return { ok: false, erros };
    }

    const agora =
      new Date().toISOString();

    for (const versao of versoes) {
      if (versao.status === 'publicado' && versao.registroId) {
        await this.dataverse.atualizarRegistro(
          TABELA_FLUXO,
          versao.registroId,
          {
            [FLUXO.situacao]: 'arquivado',
            [FLUXO.arquivadoEm]: agora
          }
        );
      }
    }

    await this.dataverse.atualizarRegistro(
      TABELA_FLUXO,
      rascunho.registroId,
      {
        [FLUXO.situacao]: 'publicado',
        [FLUXO.publicadoEm]: agora
      }
    );

    return {
      ok: true,
      erros: [],
      definicao: { ...rascunho, status: 'publicado', publicadoEm: agora }
    };
  }

  public async criarNovaVersao(
    processoId: string
  ): Promise<IResultadoCatalogo> {

    const versoes =
      await this.lerVersoes(processoId);

    if (versoes.some(item => item.status === 'rascunho')) {
      return {
        ok: false,
        erros: ['Já existe um rascunho. Publique ou descarte antes de criar outra versão.']
      };
    }

    const base =
      versoes.find(item => item.status === 'publicado') ||
      versoes[0];

    if (!base) {
      return { ok: false, erros: ['Este processo ainda não tem fluxo.'] };
    }

    // Considera também as versões descartadas para não repetir número.
    const todas =
      await this.dataverse.listarRegistros(
        TABELA_FLUXO,
        `$select=${FLUXO.versao}&$filter=${FLUXO.processoValor} eq ${guid(processoId)}`
      );

    const maior =
      todas.reduce((atual, registro) => Math.max(atual, Number(registro[FLUXO.versao] || 0)), 0);

    return {
      ok: true,
      erros: [],
      definicao: await this.criarLinha(
        processoId,
        {
          ...base,
          versao: maior + 1,
          status: 'rascunho',
          registroId: undefined,
          publicadoEm: undefined,
          arquivadoEm: undefined
        }
      )
    };
  }

  public async descartarRascunho(
    processoId: string
  ): Promise<IResultadoCatalogo> {

    const rascunho =
      (await this.lerVersoes(processoId)).find(item => item.status === 'rascunho');

    if (!rascunho || !rascunho.registroId) {
      return { ok: false, erros: ['Não há rascunho para descartar.'] };
    }

    await this.dataverse.atualizarRegistro(
      TABELA_FLUXO,
      rascunho.registroId,
      { [FLUXO.situacao]: 'descartado' }
    );

    return { ok: true, erros: [] };
  }
}

