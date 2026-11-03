import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  AtribuicoesTreinamentoService
} from './AtribuicoesTreinamentoService';

import {
  STATUS_USUARIO_TREINAMENTO
} from '../constants/dataverseChoices';

// ============================================================
// ATRIBUIÇÃO POR ÁREA
//
// Uma regra "Treinamento → Área" (dgt_treinamentoarea) faz com que
// TODOS os membros ativos da área recebam o treinamento, inclusive
// quem for vinculado à área depois. O trabalho de atribuir é feito
// no servidor pelo AtribuirPorAreaPlugin (assíncrono).
//
// DESATIVAR A REGRA
//   • interrompe NOVAS atribuições (o plugin ignora regra inativa);
//   • REMOVE as atribuições PENDENTES criadas por esta regra
//     (dgt_origemid = id da regra): dgt_ativo = Não, status Cancelado,
//     com motivo na auditoria. Nada é apagado;
//   • atribuições CONCLUÍDAS são mantidas (evidência e certificado);
//   • atribuições que a pessoa recebeu por outro caminho (individual,
//     trilha, outra regra) não são tocadas.
// Reativar a regra faz o plugin atribuir de novo aos membros da área.
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

export interface IImpactoDesativacaoRegra {
  // Serão removidas (pendentes, em andamento, reprovadas...).
  pendentes: number;
  // Mantidas: concluídas são evidência de treinamento.
  concluidas: number;
}

export interface IResultadoDesativacaoRegra {
  removidas: number;
  concluidasMantidas: number;
  falhas: string[];
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

  // Atribuições ATIVAS criadas por esta regra.
  private async atribuicoesDaRegra(
    regraId: string
  ): Promise<IDataverseRecord[]> {

    const id = guid(regraId);

    if (!id) {
      return [];
    }

    return this.dataverse.listarRegistros(
      'dgt_usuariotreinamento',
      '$select=dgt_usuariotreinamentoid,dgt_status,dgt_dataconclusao,_dgt_usuario_value' +
      `&$filter=dgt_origemid eq '${id}' and dgt_ativo eq true`
    );
  }

  private static concluida(
    registro: IDataverseRecord
  ): boolean {
    return Number(registro.dgt_status) === STATUS_USUARIO_TREINAMENTO.CONCLUIDO ||
      !!texto(registro, 'dgt_dataconclusao');
  }

  // Quantas atribuições a desativação remove e quantas mantém.
  public async impactoDesativacao(
    regraId: string
  ): Promise<IImpactoDesativacaoRegra> {

    const registros =
      await this.atribuicoesDaRegra(regraId);

    const concluidas =
      registros.filter(AtribuicaoAreaService.concluida).length;

    return {
      pendentes: registros.length - concluidas,
      concluidas
    };
  }

  // Desativa a regra e remove as atribuições pendentes criadas por ela.
  public async desativar(
    regra: IRegraAtribuicaoArea
  ): Promise<IResultadoDesativacaoRegra> {

    // 1) Primeiro a regra: o plugin para de atribuir.
    await this.definirAtiva(regra.id, false);

    // 2) Atribuições pendentes criadas pela regra.
    return this.removerPendentes(regra);
  }

  // Remove as atribuições PENDENTES criadas pela regra (também serve
  // para regras desativadas antes desta versão, que não removiam).
  public async removerPendentes(
    regra: IRegraAtribuicaoArea
  ): Promise<IResultadoDesativacaoRegra> {

    const registros =
      await this.atribuicoesDaRegra(regra.id);

    const remocao =
      new AtribuicoesTreinamentoService(this.dataverse);

    const resultado: IResultadoDesativacaoRegra = {
      removidas: 0,
      concluidasMantidas: 0,
      falhas: []
    };

    for (const registro of registros) {

      if (AtribuicaoAreaService.concluida(registro)) {
        resultado.concluidasMantidas += 1;
        continue;
      }

      try {
        await remocao.remover({
          atribuicaoId: guid(registro.dgt_usuariotreinamentoid),
          motivo:
            `Regra de atribuição por área desativada: ${regra.treinamentoNome} → ${regra.areaNome}.`,
          treinamentoNome: regra.treinamentoNome
        });

        resultado.removidas += 1;

      } catch (erro) {
        const nome =
          formatado(registro, '_dgt_usuario_value') || 'colaborador';

        resultado.falhas.push(
          `${nome}: ${erro instanceof Error ? erro.message : String(erro)}`
        );
      }
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
