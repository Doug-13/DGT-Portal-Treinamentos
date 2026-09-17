import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface INovoTreinamento {
  nome: string;
  codigo: string;
  descricao: string;
  cargaHorariaMin: number;
  notaMinima: number;
  validadeMeses: number;
  ativo: boolean;
}

export interface ITreinamentoAdmin extends INovoTreinamento {
  id: string;
}

export interface IEditarTreinamento extends INovoTreinamento {
  id: string;
}

export class TreinamentoAdminService {
  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  private texto(
    registro: IDataverseRecord,
    campo: string,
    padrao = ''
  ): string {
    const valor = registro[campo];
    return valor === undefined || valor === null
      ? padrao
      : String(valor);
  }

  private numero(
    registro: IDataverseRecord,
    campo: string,
    padrao = 0
  ): number {
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
  }

  private booleano(
    registro: IDataverseRecord,
    campo: string,
    padrao = true
  ): boolean {
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
  }

  public async listar(): Promise<ITreinamentoAdmin[]> {
    const registros = await this.dataverse.getTreinamentos();

    return registros
      .map(registro => ({
        id: this.texto(
          registro,
          'dgt_treinamentoid'
        ),
        nome: this.texto(
          registro,
          'dgt_name',
          'Treinamento'
        ),
        codigo: this.texto(
          registro,
          'dgt_codigo'
        ),
        descricao: this.texto(
          registro,
          'dgt_descricao'
        ),
        cargaHorariaMin: this.numero(
          registro,
          'dgt_cargahorariamin'
        ),
        notaMinima: this.numero(
          registro,
          'dgt_notaminima'
        ),
        validadeMeses: this.numero(
          registro,
          'dgt_validademeses'
        ),
        ativo: this.booleano(
          registro,
          'dgt_ativo',
          true
        )
      }))
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async criar(
    dados: INovoTreinamento
  ): Promise<IDataverseRecord> {
    this.validar(dados);

    return this.dataverse.criarTreinamento({
      dgt_name: dados.nome.trim(),
      dgt_codigo: dados.codigo
        .trim()
        .toUpperCase(),
      dgt_descricao: dados.descricao.trim(),
      dgt_cargahorariamin: dados.cargaHorariaMin,
      dgt_notaminima: dados.notaMinima,
      dgt_validademeses: dados.validadeMeses,
      dgt_ativo: dados.ativo
    });
  }

  public async editar(
    dados: IEditarTreinamento
  ): Promise<void> {
    if (!dados.id) {
      throw new Error(
        'ID do treinamento não informado.'
      );
    }

    this.validar(dados);

    await this.dataverse.atualizarTreinamento(
      dados.id,
      {
        dgt_name: dados.nome.trim(),
        dgt_codigo: dados.codigo
          .trim()
          .toUpperCase(),
        dgt_descricao: dados.descricao.trim(),
        dgt_cargahorariamin: dados.cargaHorariaMin,
        dgt_notaminima: dados.notaMinima,
        dgt_validademeses: dados.validadeMeses,
        dgt_ativo: dados.ativo
      }
    );
  }

  public async definirAtivo(
    treinamentoId: string,
    ativo: boolean
  ): Promise<void> {
    if (!treinamentoId) {
      throw new Error(
        'Treinamento não informado.'
      );
    }

    await this.dataverse.atualizarTreinamento(
      treinamentoId,
      {
        dgt_ativo: ativo
      }
    );
  }

  private validar(
    dados: INovoTreinamento
  ): void {
    if (!dados.nome.trim()) {
      throw new Error(
        'Informe o nome do treinamento.'
      );
    }

    if (!dados.codigo.trim()) {
      throw new Error(
        'Informe o código do treinamento.'
      );
    }

    if (dados.cargaHorariaMin <= 0) {
      throw new Error(
        'A carga horária deve ser maior que zero.'
      );
    }

    if (
      dados.notaMinima < 0 ||
      dados.notaMinima > 100
    ) {
      throw new Error(
        'A nota mínima deve estar entre 0 e 100.'
      );
    }

    if (dados.validadeMeses < 0) {
      throw new Error(
        'A validade não pode ser negativa.'
      );
    }
  }
}
