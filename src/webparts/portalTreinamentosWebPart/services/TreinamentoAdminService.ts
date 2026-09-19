import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type TipoTreinamentoAdmin =
  | 'POP'
  | 'IT'
  | 'PROC'
  | 'POL'
  | 'INT'
  | 'NR'
  | 'MAN'
  | 'SIS'
  | 'COM'
  | 'TEC'
  | 'OUT';

const TIPO_TREINAMENTO_VALOR:
  Record<
    TipoTreinamentoAdmin,
    number
  > = {
  POP: 100000000,
  IT: 100000001,
  PROC: 100000002,
  POL: 100000003,
  INT: 100000004,
  NR: 100000005,
  MAN: 100000006,
  SIS: 100000007,
  COM: 100000008,
  TEC: 100000009,
  OUT: 100000010
};

const TIPO_TREINAMENTO_POR_VALOR:
  Record<
    number,
    TipoTreinamentoAdmin
  > = {
  100000000: 'POP',
  100000001: 'IT',
  100000002: 'PROC',
  100000003: 'POL',
  100000004: 'INT',
  100000005: 'NR',
  100000006: 'MAN',
  100000007: 'SIS',
  100000008: 'COM',
  100000009: 'TEC',
  100000010: 'OUT'
};

export interface INovoTreinamento {
  nome: string;
  codigo: string;
  descricao: string;
  cargaHorariaMin: number;
  notaMinima: number;
  validadeMeses: number;
  ativo: boolean;
  imagemUrl: string;

  areaId?:
    string;

  tipoTreinamento?:
    TipoTreinamentoAdmin;
}

export interface ITreinamentoAdmin
  extends INovoTreinamento {
  id: string;
}

export interface IEditarTreinamento
  extends INovoTreinamento {
  id: string;
}

export class TreinamentoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  private texto(
    registro: IDataverseRecord,
    campo: string,
    padrao = ''
  ): string {

    const valor =
      registro[campo];

    return (
      valor === undefined ||
      valor === null
    )
      ? padrao
      : String(valor).trim();
  }

  private numero(
    registro: IDataverseRecord,
    campo: string,
    padrao = 0
  ): number {

    const valor =
      registro[campo];

    if (
      valor === undefined ||
      valor === null ||
      valor === ''
    ) {
      return padrao;
    }

    const convertido =
      Number(valor);

    return Number.isNaN(
      convertido
    )
      ? padrao
      : convertido;
  }

  private booleano(
    registro: IDataverseRecord,
    campo: string,
    padrao = true
  ): boolean {

    const valor =
      registro[campo];

    if (
      typeof valor ===
      'boolean'
    ) {
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

  private tipoTreinamento(
    registro:
      IDataverseRecord
  ): TipoTreinamentoAdmin {

    const valor =
      this.numero(
        registro,
        'dgt_tipotreinamento',
        100000010
      );

    return (
      TIPO_TREINAMENTO_POR_VALOR[
        valor
      ] ||
      'OUT'
    );
  }

  private mapear(
    registro: IDataverseRecord
  ): ITreinamentoAdmin {

    return {
      id:
        this.texto(
          registro,
          'dgt_treinamentoid'
        ),

      nome:
        this.texto(
          registro,
          'dgt_name',
          'Treinamento'
        ),

      codigo:
        this.texto(
          registro,
          'dgt_codigo'
        ),

      descricao:
        this.texto(
          registro,
          'dgt_descricao'
        ),

      cargaHorariaMin:
        this.numero(
          registro,
          'dgt_cargahorariamin'
        ),

      notaMinima:
        this.numero(
          registro,
          'dgt_notaminima'
        ),

      validadeMeses:
        this.numero(
          registro,
          'dgt_validademeses'
        ),

      ativo:
        this.booleano(
          registro,
          'dgt_ativo',
          true
        ),

      imagemUrl:
        this.texto(
          registro,
          'dgt_imagemurl'
        ),

      areaId:
        this.texto(
          registro,
          '_dgt_area_value'
        ),

      tipoTreinamento:
        this.tipoTreinamento(
          registro
        )
    };
  }

  public async listar():
    Promise<ITreinamentoAdmin[]> {

    const registros =
      await this.dataverse
        .getTreinamentos();

    return registros
      .map(
        registro =>
          this.mapear(
            registro
          )
      )
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
  ): Promise<ITreinamentoAdmin> {

    this.validar(
      dados
    );

    if (
      !dados.areaId
    ) {
      throw new Error(
        'Selecione a área do treinamento.'
      );
    }

    if (
      !dados.tipoTreinamento
    ) {
      throw new Error(
        'Selecione o tipo do treinamento.'
      );
    }

    const registro =
      await this.dataverse
        .criarTreinamento({
          dgt_name:
            dados.nome.trim(),

          'dgt_Area@odata.bind':
            `/dgt_areas(${(
              dados.areaId ||
              ''
            )
              .replace(
                /[{}]/g,
                ''
              )
              .trim()})`,

          dgt_tipotreinamento:
            TIPO_TREINAMENTO_VALOR[
              dados.tipoTreinamento ||
              'OUT'
            ],

          dgt_descricao:
            dados.descricao.trim(),

          dgt_cargahorariamin:
            Math.round(
              dados.cargaHorariaMin
            ),

          dgt_notaminima:
            dados.notaMinima,

          dgt_validademeses:
            Math.round(
              dados.validadeMeses
            ),

          dgt_ativo:
            dados.ativo,

          dgt_imagemurl:
            dados.imagemUrl.trim()
        });

    const criado =
      this.mapear(
        registro
      );

    if (!criado.id) {
      throw new Error(
        'O treinamento foi criado, mas o Dataverse não retornou o ID do registro.'
      );
    }

    return criado;
  }

  public async editar(
    dados: IEditarTreinamento
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'ID do treinamento não informado.'
      );
    }

    this.validar(
      dados
    );

    await this.dataverse
      .atualizarTreinamento(
        dados.id,
        {
          // dgt_codigo não é alterado aqui.
          // O código é imutável e gerado automaticamente na criação.

          dgt_name:
            dados.nome.trim(),

          dgt_descricao:
            dados.descricao.trim(),

          dgt_cargahorariamin:
            Math.round(
              dados.cargaHorariaMin
            ),

          dgt_notaminima:
            dados.notaMinima,

          dgt_validademeses:
            Math.round(
              dados.validadeMeses
            ),

          dgt_ativo:
            dados.ativo,

          dgt_imagemurl:
            dados.imagemUrl.trim()
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

    await this.dataverse
      .atualizarTreinamento(
        treinamentoId,
        {
          dgt_ativo:
            ativo
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

    if (
      !Number.isFinite(
        dados.cargaHorariaMin
      ) ||
      dados.cargaHorariaMin <= 0
    ) {
      throw new Error(
        'A carga horária deve ser maior que zero.'
      );
    }

    if (
      !Number.isFinite(
        dados.notaMinima
      ) ||
      dados.notaMinima < 0 ||
      dados.notaMinima > 100
    ) {
      throw new Error(
        'A nota mínima deve estar entre 0 e 100.'
      );
    }

    if (
      !Number.isFinite(
        dados.validadeMeses
      ) ||
      dados.validadeMeses < 0
    ) {
      throw new Error(
        'A validade não pode ser negativa.'
      );
    }

    if (
      dados.imagemUrl.trim() &&
      !/^https?:\/\//i.test(
        dados.imagemUrl.trim()
      )
    ) {
      throw new Error(
        'A URL da imagem deve começar com http:// ou https://.'
      );
    }
  }
}
