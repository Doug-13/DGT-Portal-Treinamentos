import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../../../models/Processo';

import {
  DataverseService
} from '../../DataverseService';

import {
  IDadosProcessos,
  INovoProcessoTeste,
  IProcessosRepositorio,
  IResultadoNovoProcesso
} from '../../processos/ProcessoService';

import {
  ANOTACAO_FORMATADA,
  DOCUMENTO_PROCESSO,
  DOCUMENTO_PROCESSO_EXTRA,
  escaparOData,
  guid,
  PROCESSO_EXTRA,
  TABELA_AREA,
  TABELA_DOCUMENTO,
  TABELA_DOCUMENTO_PROCESSO,
  TABELA_PROCESSO,
  texto
} from './esquemaFluxo';

// ============================================================
// PROCESSOS E VÍNCULOS NO DATAVERSE
//
//   dgt_processo           (+ coluna nova dgt_area)
//   dgt_documentoprocesso  (+ coluna nova dgt_principal)
//
// Vínculos removidos ficam com dgt_ativo = Não (não são apagados).
// ============================================================

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export class ProcessosRepositorioDataverse
  implements IProcessosRepositorio {

  public readonly local: boolean =
    false;

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async carregar(): Promise<IDadosProcessos> {

    const [registrosProcessos, registrosVinculos] =
      await Promise.all([
        this.dataverse.listarRegistros(
          TABELA_PROCESSO,
          '$select=dgt_processoid,dgt_name,dgt_codigo,dgt_descricao,dgt_ativo,' + PROCESSO_EXTRA.areaValor +
          '&$filter=dgt_ativo eq true' +
          '&$orderby=dgt_codigo asc'
        ),
        this.dataverse.listarRegistros(
          TABELA_DOCUMENTO_PROCESSO,
          `$select=${DOCUMENTO_PROCESSO.id},${DOCUMENTO_PROCESSO.documentoValor},${DOCUMENTO_PROCESSO.processoValor},${DOCUMENTO_PROCESSO_EXTRA.principal}` +
          `&$filter=${DOCUMENTO_PROCESSO.ativo} eq true`
        )
      ]);

    const processos: IProcesso[] =
      registrosProcessos.map(
        registro => ({
          id: guid(registro.dgt_processoid),
          codigo: texto(registro, 'dgt_codigo'),
          nome: texto(registro, 'dgt_name') || texto(registro, 'dgt_codigo'),
          descricao: texto(registro, 'dgt_descricao') || undefined,
          areaId: guid(registro[PROCESSO_EXTRA.areaValor]) || undefined,
          areaNome: texto(registro, PROCESSO_EXTRA.areaValor + ANOTACAO_FORMATADA) || undefined,
          ativo: true,
          origem: 'dataverse' as const
        })
      );

    const vinculos: IDocumentoProcessoVinculo[] =
      registrosVinculos
        .map(
          registro => ({
            id: guid(registro[DOCUMENTO_PROCESSO.id]),
            documentoId: guid(registro[DOCUMENTO_PROCESSO.documentoValor]),
            processoId: guid(registro[DOCUMENTO_PROCESSO.processoValor]),
            principal: registro[DOCUMENTO_PROCESSO_EXTRA.principal] === true,
            origem: 'dataverse' as const
          })
        )
        .filter(vinculo => !!vinculo.documentoId && !!vinculo.processoId);

    return { processos, vinculos, aviso: '' };
  }

  public async criarProcesso(
    dados: INovoProcessoTeste,
    existentes: IProcesso[]
  ): Promise<IResultadoNovoProcesso> {

    const codigo = (dados.codigo || '').trim();
    const nome = (dados.nome || '').trim();

    if (!codigo || !nome) {
      return { ok: false, erro: 'Informe o código e o nome do processo.' };
    }

    if (existentes.some(processo => normalizar(processo.codigo) === normalizar(codigo))) {
      return { ok: false, erro: `Já existe um processo com o código "${codigo}".` };
    }

    const corpo: Record<string, unknown> = {
      dgt_name: nome.slice(0, 200),
      dgt_codigo: codigo.slice(0, 100),
      dgt_descricao: (dados.descricao || '').trim(),
      dgt_ativo: true
    };

    if (dados.areaId) {
      corpo[PROCESSO_EXTRA.areaBind] = await this.dataverse.referenciaLookup(TABELA_AREA, dados.areaId);
    }

    const id =
      await this.dataverse.criarRegistro(TABELA_PROCESSO, corpo);

    return {
      ok: true,
      erro: '',
      processo: {
        id: guid(id),
        codigo,
        nome,
        descricao: (dados.descricao || '').trim() || undefined,
        areaId: dados.areaId,
        areaNome: dados.areaNome,
        ativo: true,
        origem: 'dataverse'
      }
    };
  }

  private async criarVinculo(
    documentoId: string,
    processoId: string,
    principal: boolean
  ): Promise<void> {
    await this.dataverse.criarRegistro(
      TABELA_DOCUMENTO_PROCESSO,
      {
        [DOCUMENTO_PROCESSO.nome]: `Documento × Processo`,
        [DOCUMENTO_PROCESSO.documentoBind]: await this.dataverse.referenciaLookup(TABELA_DOCUMENTO, documentoId),
        [DOCUMENTO_PROCESSO.processoBind]: await this.dataverse.referenciaLookup(TABELA_PROCESSO, processoId),
        [DOCUMENTO_PROCESSO.ativo]: true,
        [DOCUMENTO_PROCESSO_EXTRA.principal]: principal
      }
    );
  }

  public async vincularDocumento(
    documentoId: string,
    processoId: string,
    vinculos: IDocumentoProcessoVinculo[]
  ): Promise<void> {

    const doc = guid(documentoId);

    if (vinculos.some(item => item.documentoId === doc && item.processoId === guid(processoId))) {
      return;
    }

    // Primeiro processo do documento já nasce como principal.
    const primeiro =
      !vinculos.some(item => item.documentoId === doc);

    await this.criarVinculo(doc, processoId, primeiro);
  }

  public async vincularDocumentoPorCodigo(
    documentoCodigo: string,
    processoId: string
  ): Promise<void> {

    const encontrados =
      await this.dataverse.listarRegistros(
        TABELA_DOCUMENTO,
        `$select=dgt_documentoid&$filter=dgt_codigo eq '${escaparOData(documentoCodigo.trim())}'&$top=1`
      );

    if (encontrados.length === 0) {
      throw new Error(`O documento ${documentoCodigo} foi criado, mas não foi encontrado para vincular ao processo. Vincule pela tela do processo.`);
    }

    await this.criarVinculo(guid(encontrados[0].dgt_documentoid), processoId, true);
  }

  public async removerVinculo(
    vinculo: IDocumentoProcessoVinculo
  ): Promise<void> {
    await this.dataverse.atualizarRegistro(
      TABELA_DOCUMENTO_PROCESSO,
      vinculo.id,
      { [DOCUMENTO_PROCESSO.ativo]: false, [DOCUMENTO_PROCESSO_EXTRA.principal]: false }
    );
  }

  public async definirPrincipal(
    documentoId: string,
    processoId: string,
    vinculos: IDocumentoProcessoVinculo[]
  ): Promise<void> {

    const doc = guid(documentoId);

    for (const vinculo of vinculos.filter(item => item.documentoId === doc)) {
      const principal = vinculo.processoId === guid(processoId);

      if (vinculo.principal !== principal) {
        await this.dataverse.atualizarRegistro(
          TABELA_DOCUMENTO_PROCESSO,
          vinculo.id,
          { [DOCUMENTO_PROCESSO_EXTRA.principal]: principal }
        );
      }
    }
  }
}
