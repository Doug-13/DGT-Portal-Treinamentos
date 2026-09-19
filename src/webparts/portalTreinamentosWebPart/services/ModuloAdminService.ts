import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type TipoModuloAdmin =
  | 'Documento'
  | 'Vídeo'
  | 'Página'
  | 'Conteúdo HTML'
  | 'Link externo'
  | 'Outro';

export interface IModuloAdmin {
  id: string;
  treinamentoId: string;
  titulo: string;
  descricao: string;
  ordem: number;
  duracaoMin: number;
  tipoModulo: TipoModuloAdmin;
  obrigatorio: boolean;
  ativo: boolean;
  urlConteudo: string;
}

export interface INovoModulo {
  treinamentoId: string;
  titulo: string;
  descricao: string;
  ordem: number;
  duracaoMin: number;
  tipoModulo: TipoModuloAdmin;
  obrigatorio: boolean;
  ativo: boolean;
  urlConteudo: string;
}

export interface IEditarModulo
  extends INovoModulo {
  id: string;
}

const TIPO_MODULO_VALORES:
  Record<
    TipoModuloAdmin,
    number
  > = {

  Documento:
    100000000,

  'Vídeo':
    100000001,

  'Página':
    100000002,

  'Conteúdo HTML':
    100000003,

  'Link externo':
    100000004,

  Outro:
    100000005
};

const TIPO_MODULO_ROTULOS:
  Record<
    number,
    TipoModuloAdmin
  > = {

  100000000:
    'Documento',

  100000001:
    'Vídeo',

  100000002:
    'Página',

  100000003:
    'Conteúdo HTML',

  100000004:
    'Link externo',

  100000005:
    'Outro'
};

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {

  const valor =
    registro[campo];

  return (
    valor === undefined ||
    valor === null
  )
    ? padrao
    : String(valor);
};

const numero = (
  registro: IDataverseRecord,
  campo: string,
  padrao = 0
): number => {

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
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {

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
};

const tipoModuloParaValor = (
  tipo:
    TipoModuloAdmin
): number => {

  return (
    TIPO_MODULO_VALORES[
      tipo
    ] ??
    TIPO_MODULO_VALORES
      .Outro
  );
};

const tipoModuloDoRegistro = (
  registro:
    IDataverseRecord
): TipoModuloAdmin => {

  const valorFormatado =
    texto(
      registro,
      'dgt_tipomodulo@OData.Community.Display.V1.FormattedValue',
      ''
    ).trim();

  if (
    valorFormatado ===
      'Documento' ||
    valorFormatado ===
      'Vídeo' ||
    valorFormatado ===
      'Página' ||
    valorFormatado ===
      'Conteúdo HTML' ||
    valorFormatado ===
      'Link externo' ||
    valorFormatado ===
      'Outro'
  ) {
    return valorFormatado;
  }

  const valor =
    numero(
      registro,
      'dgt_tipomodulo',
      100000002
    );

  return (
    TIPO_MODULO_ROTULOS[
      valor
    ] ||
    'Página'
  );
};

export class ModuloAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async listarPorTreinamento(
    treinamentoId:
      string
  ): Promise<IModuloAdmin[]> {

    if (!treinamentoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getModulosTreinamentoAdmin(
          treinamentoId
        );

    return registros
      .map(
        registro => ({
          id:
            texto(
              registro,
              'dgt_moduloid'
            ),

          treinamentoId:
            texto(
              registro,
              '_dgt_treinamento_value'
            ),

          titulo:
            texto(
              registro,
              'dgt_titulo',
              'Módulo'
            ),

          descricao:
            texto(
              registro,
              'dgt_descricao'
            ),

          ordem:
            numero(
              registro,
              'dgt_ordem'
            ),

          duracaoMin:
            numero(
              registro,
              'dgt_duracaomin'
            ),

          tipoModulo:
            tipoModuloDoRegistro(
              registro
            ),

          obrigatorio:
            booleano(
              registro,
              'dgt_obrigatorio',
              true
            ),

          ativo:
            booleano(
              registro,
              'dgt_ativo',
              true
            ),

          urlConteudo:
            texto(
              registro,
              'dgt_urlconteudo'
            )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          a.ordem -
          b.ordem
      );
  }

  public async criar(
    dados:
      INovoModulo
  ): Promise<void> {

    this.validar(
      dados
    );

    await this.dataverse
      .criarModulo(
        dados.treinamentoId,
        {
          dgt_titulo:
            dados.titulo.trim(),

          dgt_descricao:
            dados.descricao.trim(),

          dgt_ordem:
            dados.ordem,

          dgt_duracaomin:
            dados.duracaoMin,

          dgt_tipomodulo:
            tipoModuloParaValor(
              dados.tipoModulo
            ),

          dgt_obrigatorio:
            dados.obrigatorio,

          dgt_ativo:
            dados.ativo,

          dgt_urlconteudo:
            dados.urlConteudo.trim()
        }
      );
  }

  public async editar(
    dados:
      IEditarModulo
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'ID do módulo não informado.'
      );
    }

    this.validar(
      dados
    );

    await this.dataverse
      .atualizarModulo(
        dados.id,
        {
          dgt_titulo:
            dados.titulo.trim(),

          dgt_descricao:
            dados.descricao.trim(),

          dgt_ordem:
            dados.ordem,

          dgt_duracaomin:
            dados.duracaoMin,

          dgt_tipomodulo:
            tipoModuloParaValor(
              dados.tipoModulo
            ),

          dgt_obrigatorio:
            dados.obrigatorio,

          dgt_ativo:
            dados.ativo,

          dgt_urlconteudo:
            dados.urlConteudo.trim()
        }
      );
  }

  public async definirAtivo(
    moduloId:
      string,
    ativo:
      boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarModulo(
        moduloId,
        {
          dgt_ativo:
            ativo
        }
      );
  }

  private validar(
    dados:
      INovoModulo
  ): void {

    if (
      !dados.treinamentoId
    ) {
      throw new Error(
        'Treinamento não informado.'
      );
    }

    if (
      !dados.titulo.trim()
    ) {
      throw new Error(
        'Informe o título do módulo.'
      );
    }

    if (
      dados.ordem <= 0
    ) {
      throw new Error(
        'A ordem deve ser maior que zero.'
      );
    }

    if (
      dados.duracaoMin < 0
    ) {
      throw new Error(
        'A duração não pode ser negativa.'
      );
    }
  }
}
