import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface ITrilhaAdmin {
  id: string;
  nome: string;
  descricao: string;
  diasParaConclusao: number;
  ativa: boolean;
  quantidadeTreinamentos: number;
}

export interface INovaTrilha {
  nome: string;
  descricao: string;
  diasParaConclusao: number;
  ativa: boolean;
}

export interface IEditarTrilha extends INovaTrilha {
  id: string;
}

export interface ITrilhaTreinamentoAdmin {
  id: string;
  trilhaId: string;
  treinamentoId: string;
  treinamentoNome: string;
  treinamentoCodigo: string;
  ordem: number;
  obrigatorio: boolean;
  regraLiberacao: string;
  diasParaConclusao: number;
  ativo: boolean;
}

export interface IAdicionarTreinamentoTrilha {
  trilhaId: string;
  treinamentoId: string;
  ordem: number;
  obrigatorio: boolean;
  regraLiberacao: string;
  diasParaConclusao: number;
}

export interface IEditarTreinamentoTrilha {
  id: string;
  ordem: number;
  obrigatorio: boolean;
  regraLiberacao: string;
  diasParaConclusao: number;
  ativo: boolean;
}

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];

  return valor === undefined || valor === null
    ? padrao
    : String(valor);
};

const numero = (
  registro: IDataverseRecord,
  campo: string,
  padrao = 0
): number => {
  const valor = registro[campo];

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return padrao;
  }

  const convertido = Number(valor);

  return Number.isNaN(convertido)
    ? padrao
    : convertido;
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {
  const valor = registro[campo];

  if (typeof valor === 'boolean') {
    return valor;
  }

  if (
    valor === 1 ||
    valor === '1' ||
    valor === 'true'
  ) {
    return true;
  }

  if (
    valor === 0 ||
    valor === '0' ||
    valor === 'false'
  ) {
    return false;
  }

  return padrao;
};

const limparGuid = (
  valor: string
): string =>
  valor
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

export class TrilhaAdminService {
  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async listarTrilhas():
    Promise<ITrilhaAdmin[]> {
    const [
      trilhas,
      relacionamentos
    ] = await Promise.all([
      this.dataverse.getTrilhasAdministrativas(),
      this.dataverse.getTodosTrilhaTreinamentos()
    ]);

    return trilhas
      .map(
        trilha => {
          const id = texto(
            trilha,
            'dgt_trilhaid'
          );

          const quantidade =
            relacionamentos.filter(
              relacao =>
                limparGuid(
                  texto(
                    relacao,
                    '_dgt_trilha_value'
                  )
                ) === limparGuid(id) &&
                booleano(
                  relacao,
                  'dgt_ativo',
                  true
                )
            ).length;

          return {
            id,
            nome: texto(
              trilha,
              'dgt_name',
              'Trilha'
            ),
            descricao: texto(
              trilha,
              'dgt_descricao'
            ),
            diasParaConclusao: numero(
              trilha,
              'dgt_diasparaconclusao'
            ),
            ativa: booleano(
              trilha,
              'dgt_ativo',
              true
            ),
            quantidadeTreinamentos:
              quantidade
          };
        }
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async criarTrilha(
    dados: INovaTrilha
  ): Promise<void> {
    this.validarTrilha(dados);

    await this.dataverse.criarTrilha({
      dgt_name: dados.nome.trim(),
      dgt_descricao: dados.descricao.trim(),
      dgt_diasparaconclusao:
        dados.diasParaConclusao,
      dgt_ativo: dados.ativa
    });
  }

  public async editarTrilha(
    dados: IEditarTrilha
  ): Promise<void> {
    if (!dados.id) {
      throw new Error(
        'ID da trilha não informado.'
      );
    }

    this.validarTrilha(dados);

    await this.dataverse.atualizarTrilha(
      dados.id,
      {
        dgt_name: dados.nome.trim(),
        dgt_descricao: dados.descricao.trim(),
        dgt_diasparaconclusao:
          dados.diasParaConclusao,
        dgt_ativo: dados.ativa
      }
    );
  }

  public async definirTrilhaAtiva(
    trilhaId: string,
    ativa: boolean
  ): Promise<void> {
    await this.dataverse.atualizarTrilha(
      trilhaId,
      {
        dgt_ativo: ativa
      }
    );
  }

  public async listarTreinamentosTrilha(
    trilhaId: string
  ): Promise<ITrilhaTreinamentoAdmin[]> {
    const [
      relacionamentos,
      treinamentos
    ] = await Promise.all([
      this.dataverse.getTrilhaTreinamentosAdmin(
        trilhaId
      ),
      this.dataverse.getTreinamentos()
    ]);

    return relacionamentos
      .map(
        relacao => {
          const treinamentoId = texto(
            relacao,
            '_dgt_treinamento_value'
          );

          const treinamento =
            treinamentos.find(
              item =>
                limparGuid(
                  texto(
                    item,
                    'dgt_treinamentoid'
                  )
                ) ===
                limparGuid(
                  treinamentoId
                )
            );

          return {
            id: texto(
              relacao,
              'dgt_trilhatreinamentoid'
            ),
            trilhaId,
            treinamentoId,
            treinamentoNome:
              treinamento
                ? texto(
                    treinamento,
                    'dgt_name',
                    'Treinamento'
                  )
                : texto(
                    relacao,
                    '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue',
                    'Treinamento'
                  ),
            treinamentoCodigo:
              treinamento
                ? texto(
                    treinamento,
                    'dgt_codigo'
                  )
                : '',
            ordem: numero(
              relacao,
              'dgt_ordem'
            ),
            obrigatorio: booleano(
              relacao,
              'dgt_obrigatorio',
              true
            ),
            regraLiberacao: texto(
              relacao,
              'dgt_regraliberacao'
            ),
            diasParaConclusao: numero(
              relacao,
              'dgt_diasparaconclusao'
            ),
            ativo: booleano(
              relacao,
              'dgt_ativo',
              true
            )
          };
        }
      )
      .filter(
        item =>
          item.ativo
      )
      .sort(
        (a, b) =>
          a.ordem - b.ordem
      );
  }

  public async adicionarTreinamento(
    dados: IAdicionarTreinamentoTrilha
  ): Promise<void> {
    if (
      !dados.trilhaId ||
      !dados.treinamentoId
    ) {
      throw new Error(
        'Trilha e treinamento são obrigatórios.'
      );
    }

    const existentes =
      await this.listarTreinamentosTrilha(
        dados.trilhaId
      );

    const duplicado =
      existentes.some(
        item =>
          limparGuid(
            item.treinamentoId
          ) ===
          limparGuid(
            dados.treinamentoId
          )
      );

    if (duplicado) {
      throw new Error(
        'Este treinamento já pertence à trilha.'
      );
    }

    await this.dataverse.criarTrilhaTreinamento(
      dados.trilhaId,
      dados.treinamentoId,
      {
        dgt_name:
          `Treinamento da trilha - ${dados.ordem}`,
        dgt_ordem: dados.ordem,
        dgt_obrigatorio: dados.obrigatorio,
        dgt_regraliberacao:
          dados.regraLiberacao.trim(),
        dgt_diasparaconclusao:
          dados.diasParaConclusao,
        dgt_ativo: true
      }
    );
  }

  public async editarTreinamentoTrilha(
    dados: IEditarTreinamentoTrilha
  ): Promise<void> {
    if (!dados.id) {
      throw new Error(
        'Relação Trilha/Treinamento não informada.'
      );
    }

    await this.dataverse
      .atualizarTrilhaTreinamento(
        dados.id,
        {
          dgt_ordem: dados.ordem,
          dgt_obrigatorio:
            dados.obrigatorio,
          dgt_regraliberacao:
            dados.regraLiberacao.trim(),
          dgt_diasparaconclusao:
            dados.diasParaConclusao,
          dgt_ativo: dados.ativo
        }
      );
  }

  public async removerTreinamento(
    relacaoId: string
  ): Promise<void> {
    await this.dataverse
      .atualizarTrilhaTreinamento(
        relacaoId,
        {
          dgt_ativo: false
        }
      );
  }

  private validarTrilha(
    dados: INovaTrilha
  ): void {
    if (!dados.nome.trim()) {
      throw new Error(
        'Informe o nome da trilha.'
      );
    }

    if (
      dados.diasParaConclusao < 0
    ) {
      throw new Error(
        'Dias para conclusão não pode ser negativo.'
      );
    }
  }
}
