import {
  IColunaTabela,
  IFluxoMetadado,
  TipoCampoFluxo
} from '../../../models/Fluxo';

import {
  DataverseService
} from '../../DataverseService';

import {
  IMetadadosRepositorio
} from '../../processos/MetadadosProcessoService';

import {
  guid,
  lerJsonSeguro,
  METADADO,
  TABELA_PROCESSO,
  TABELA_PROCESSO_METADADO,
  texto
} from './esquemaFluxo';

// ============================================================
// METADADOS DO PROCESSO NO DATAVERSE (dgt_processometadado)
//
// Uma linha por campo. dgt_ordem define a ordem nas telas.
// Campos excluídos não são apagados: ficam com dgt_ativo = Não
// (revisões antigas continuam mostrando o que foi preenchido).
// ============================================================

const COLUNAS = [
  METADADO.id,
  METADADO.nome,
  METADADO.chave,
  METADADO.tipo,
  METADADO.ordem,
  METADADO.opcoesJson,
  METADADO.colunasJson,
  METADADO.ajuda,
  METADADO.ativo
];

export class MetadadosRepositorioDataverse
  implements IMetadadosRepositorio {

  public readonly local: boolean =
    false;

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  private async lerTodos(
    processoId: string
  ): Promise<Array<{ id: string; ativo: boolean; metadado: IFluxoMetadado }>> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_PROCESSO_METADADO,
        `$select=${COLUNAS.join(',')}` +
        `&$filter=${METADADO.processoValor} eq ${guid(processoId)}` +
        `&$orderby=${METADADO.ordem} asc`
      );

    return registros.map(
      registro => ({
        id: guid(registro[METADADO.id]),
        ativo: registro[METADADO.ativo] !== false,
        metadado: {
          id: guid(registro[METADADO.id]),
          chave: texto(registro, METADADO.chave),
          rotulo: texto(registro, METADADO.nome),
          tipo: (texto(registro, METADADO.tipo) || 'texto') as TipoCampoFluxo,
          opcoes: lerJsonSeguro<string[] | undefined>(texto(registro, METADADO.opcoesJson), undefined),
          colunas: lerJsonSeguro<IColunaTabela[] | undefined>(texto(registro, METADADO.colunasJson), undefined),
          ajuda: texto(registro, METADADO.ajuda) || undefined
        }
      })
    );
  }

  public async listar(
    processoId: string
  ): Promise<IFluxoMetadado[]> {
    return (await this.lerTodos(processoId))
      .filter(item => item.ativo)
      .map(item => item.metadado);
  }

  public async salvar(
    processoId: string,
    metadados: IFluxoMetadado[]
  ): Promise<IFluxoMetadado[]> {

    const existentes =
      await this.lerTodos(processoId);

    const usados: string[] = [];

    const resultado: IFluxoMetadado[] = [];

    for (let indice = 0; indice < metadados.length; indice++) {

      const metadado =
        metadados[indice];

      // Mesmo registro: pelo id; se não houver, pela chave (inclusive
      // um campo excluído antes e recriado com a mesma chave).
      const existente =
        existentes.find(item => !!metadado.id && item.id === guid(metadado.id)) ||
        existentes.find(item => item.metadado.chave === metadado.chave && usados.indexOf(item.id) < 0);

      const dados: Record<string, unknown> = {
        [METADADO.nome]: (metadado.rotulo || metadado.chave).slice(0, 200),
        [METADADO.chave]: metadado.chave.slice(0, 100),
        [METADADO.tipo]: metadado.tipo,
        [METADADO.ordem]: indice + 1,
        [METADADO.opcoesJson]: metadado.opcoes ? JSON.stringify(metadado.opcoes) : '',
        [METADADO.colunasJson]: metadado.colunas ? JSON.stringify(metadado.colunas) : '',
        [METADADO.ajuda]: (metadado.ajuda || '').slice(0, 500),
        [METADADO.ativo]: true
      };

      if (existente) {
        usados.push(existente.id);
        await this.dataverse.atualizarRegistro(TABELA_PROCESSO_METADADO, existente.id, dados);
        resultado.push({ ...metadado, id: existente.id });
      } else {
        const id =
          await this.dataverse.criarRegistro(
            TABELA_PROCESSO_METADADO,
            {
              ...dados,
              [METADADO.processoBind]: await this.dataverse.referenciaLookup(TABELA_PROCESSO, processoId)
            }
          );
        usados.push(guid(id));
        resultado.push({ ...metadado, id: guid(id) });
      }
    }

    // Os que saíram da lista ficam inativos.
    for (const existente of existentes) {
      if (existente.ativo && usados.indexOf(existente.id) < 0) {
        await this.dataverse.atualizarRegistro(
          TABELA_PROCESSO_METADADO,
          existente.id,
          { [METADADO.ativo]: false }
        );
      }
    }

    return resultado;
  }
}
