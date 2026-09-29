import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

// ============================================================
// ATRIBUIÇÃO POR ÁREA
//
// Uma regra "Treinamento → Área" (dgt_treinamentoarea) faz com que
// TODOS os membros ativos da área recebam o treinamento, inclusive
// quem for vinculado à área depois. O trabalho de atribuir é feito
// no servidor pelo AtribuirPorAreaPlugin (assíncrono).
//
// Desativar a regra interrompe apenas NOVAS atribuições. As
// atribuições já criadas e o histórico são preservados.
// ============================================================

export interface IRegraAtribuicaoArea {
  id: string;
  treinamentoId: string;
  treinamentoNome: string;
  areaId: string;
  areaNome: string;
  prazoDias?: number;
  ativo: boolean;
  criadoEm?: Date;
}

export interface INovaRegraAtribuicaoArea {
  treinamentoId: string;
  treinamentoNome: string;
  areaIds: string[];
  prazoDias?: number;
}

export interface IResultadoRegrasArea {
  criadas: number;
  reativadas: number;
  jaExistentes: number;
}

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];

  return valor === undefined || valor === null
    ? ''
    : String(valor);
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(
    registro,
    `${campo}@OData.Community.Display.V1.FormattedValue`
  );

export class AtribuicaoAreaService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async listar():
    Promise<IRegraAtribuicaoArea[]> {

    const registros =
      await this.dataverse
        .getTreinamentoAreas();

    return registros.map(
      registro => {

        const prazo =
          registro.dgt_prazodias;

        const criado =
          texto(
            registro,
            'createdon'
          );

        return {
          id:
            guid(
              registro.dgt_treinamentoareaid
            ),

          treinamentoId:
            guid(
              registro._dgt_treinamento_value
            ),

          treinamentoNome:
            formatado(
              registro,
              '_dgt_treinamento_value'
            ),

          areaId:
            guid(
              registro._dgt_area_value
            ),

          areaNome:
            formatado(
              registro,
              '_dgt_area_value'
            ),

          prazoDias:
            prazo === undefined || prazo === null
              ? undefined
              : Number(prazo),

          ativo:
            registro.dgt_ativo !== false,

          criadoEm:
            criado
              ? new Date(criado)
              : undefined
        };
      }
    );
  }

  // Cria uma regra por área. Se já existir uma regra para o mesmo
  // treinamento e área, reativa (se inativa) em vez de duplicar.
  public async criar(
    dados: INovaRegraAtribuicaoArea,
    existentes: IRegraAtribuicaoArea[]
  ): Promise<IResultadoRegrasArea> {

    if (!dados.treinamentoId) {
      throw new Error(
        'Selecione o treinamento.'
      );
    }

    if (!dados.areaIds.length) {
      throw new Error(
        'Selecione pelo menos uma área.'
      );
    }

    if (
      dados.prazoDias !== undefined &&
      (
        !Number.isInteger(dados.prazoDias) ||
        dados.prazoDias < 0 ||
        dados.prazoDias > 3650
      )
    ) {
      throw new Error(
        'O prazo deve ser um número inteiro de dias entre 0 e 3650.'
      );
    }

    const resultado: IResultadoRegrasArea = {
      criadas: 0,
      reativadas: 0,
      jaExistentes: 0
    };

    const treinamentoId =
      guid(dados.treinamentoId);

    for (const areaIdBruto of dados.areaIds) {

      const areaId =
        guid(areaIdBruto);

      const existente =
        existentes.find(
          regra =>
            regra.treinamentoId === treinamentoId &&
            regra.areaId === areaId
        );

      if (existente && existente.ativo) {
        resultado.jaExistentes += 1;
        continue;
      }

      if (existente) {

        await this.dataverse
          .atualizarTreinamentoArea(
            existente.id,
            {
              dgt_ativo: true,
              ...(
                dados.prazoDias !== undefined
                  ? { dgt_prazodias: dados.prazoDias }
                  : {}
              )
            }
          );

        resultado.reativadas += 1;
        continue;
      }

      await this.dataverse
        .criarTreinamentoArea(
          treinamentoId,
          areaId,
          {
            dgt_name:
              `${dados.treinamentoNome}`.substring(0, 90),

            dgt_ativo:
              true,

            ...(
              dados.prazoDias !== undefined
                ? { dgt_prazodias: dados.prazoDias }
                : {}
            )
          }
        );

      resultado.criadas += 1;
    }

    return resultado;
  }

  public async definirAtiva(
    regraId: string,
    ativo: boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarTreinamentoArea(
        regraId,
        {
          dgt_ativo:
            ativo
        }
      );
  }
}
