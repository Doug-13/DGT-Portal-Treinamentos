import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type TipoConteudoModulo =
  | 'Texto'
  | 'Vídeo'
  | 'Material'
  | 'Link'
  | 'Imagem'
  | 'Destaque'
  | 'Cards'
  | 'Pergunta rápida';

export interface IModuloCardItem {
  numero:
    string;

  titulo:
    string;

  descricao:
    string;
}
export interface IModuloConteudoAdmin {
  id:
    string;

  moduloId:
    string;

  tipo:
    TipoConteudoModulo;

  titulo:
    string;

  conteudo:
    string;

  url:
    string;

  ordem:
    number;

  obrigatorio:
    boolean;

  ativo:
    boolean;
  cards?:
    IModuloCardItem[];
}

export interface INovoModuloConteudo {
  moduloId:
    string;

  tipo:
    TipoConteudoModulo;

  titulo:
    string;

  conteudo:
    string;

  url:
    string;

  ordem:
    number;

  obrigatorio:
    boolean;

  ativo:
    boolean;
  cards?:
    IModuloCardItem[];
}

export interface IEditarModuloConteudo
  extends
    INovoModuloConteudo {
  id:
    string;
}

const MARCADOR_CARDS =
  '__DGT_CARDS__:';

const lerCards = (
  conteudo:
    string
): IModuloCardItem[] => {

  if (
    !conteudo ||
    conteudo.indexOf(
      MARCADOR_CARDS
    ) !==
      0
  ) {
    return [];
  }

  try {

    const dados =
      JSON.parse(
        conteudo.substring(
          MARCADOR_CARDS.length
        )
      ) as IModuloCardItem[];

    return Array.isArray(
      dados
    )
      ? dados.slice(
          0,
          3
        )
      : [];

  } catch {

    return [];
  }
};

const serializarCards = (
  cards:
    IModuloCardItem[] | undefined
): string => {

  const lista =
    (
      cards ||
      []
    )
      .slice(
        0,
        3
      )
      .map(
        (
          item,
          indice
        ) => ({
          numero:
            item.numero ||
            (
              '00' +
              String(
                indice + 1
              )
            ).slice(
              -2
            ),

          titulo:
            item.titulo
              .trim(),

          descricao:
            item.descricao
              .trim()
        })
      );

  return (
    MARCADOR_CARDS +
    JSON.stringify(
      lista
    )
  );
};
const TIPO_VALORES:
  Record<
    TipoConteudoModulo,
    number
  > = {

  Texto:
    100000000,

  Cards:
    100000000,

  Vídeo:
    100000001,

  Material:
    100000002,

  Link:
    100000003,

  Imagem:
    100000004,

  Destaque:
    100000005,

  'Pergunta rápida':
    100000006
};

const TIPO_ROTULOS:
  Record<
    number,
    TipoConteudoModulo
  > = {

  100000000:
    'Texto',

  100000001:
    'Vídeo',

  100000002:
    'Material',

  100000003:
    'Link',

  100000004:
    'Imagem',

  100000005:
    'Destaque',

  100000006:
    'Pergunta rápida'
};

const texto = (
  registro:
    IDataverseRecord,
  campo:
    string,
  padrao =
    ''
): string => {

  const valor =
    registro[
      campo
    ];

  return (
    valor ===
      undefined ||
    valor ===
      null
  )
    ? padrao
    : String(
        valor
      );
};

const numero = (
  registro:
    IDataverseRecord,
  campo:
    string,
  padrao =
    0
): number => {

  const valor =
    registro[
      campo
    ];

  if (
    valor ===
      undefined ||
    valor ===
      null ||
    valor ===
      ''
  ) {
    return padrao;
  }

  const convertido =
    Number(
      valor
    );

  return Number.isNaN(
    convertido
  )
    ? padrao
    : convertido;
};

const booleano = (
  registro:
    IDataverseRecord,
  campo:
    string,
  padrao =
    true
): boolean => {

  const valor =
    registro[
      campo
    ];

  if (
    typeof valor ===
      'boolean'
  ) {
    return valor;
  }

  if (
    valor ===
      1 ||
    valor ===
      '1' ||
    valor ===
      'true'
  ) {
    return true;
  }

  if (
    valor ===
      0 ||
    valor ===
      '0' ||
    valor ===
      'false'
  ) {
    return false;
  }

  return padrao;
};

const obterTipo = (
  registro:
    IDataverseRecord
): TipoConteudoModulo => {
  const conteudoCards =
    texto(
      registro,
      'dgt_conteudo'
    );

  if (
    conteudoCards.indexOf(
      MARCADOR_CARDS
    ) ===
      0
  ) {
    return 'Cards';
  }


  const formatado =
    texto(
      registro,
      'dgt_tipoconteudo@OData.Community.Display.V1.FormattedValue'
    )
      .trim();

  if (
    formatado ===
      'Texto' ||
    formatado ===
      'Vídeo' ||
    formatado ===
      'Video' ||
    formatado ===
      'Material' ||
    formatado ===
      'Link' ||
    formatado ===
      'Imagem' ||
    formatado ===
      'Destaque' ||
    formatado ===
      'Pergunta rápida' ||
    formatado ===
      'Pergunta rapida'
  ) {

    if (
      formatado ===
        'Video'
    ) {
      return 'Vídeo';
    }

    if (
      formatado ===
        'Pergunta rapida'
    ) {
      return 'Pergunta rápida';
    }

    return formatado as
      TipoConteudoModulo;
  }

  return (
    TIPO_ROTULOS[
      numero(
        registro,
        'dgt_tipoconteudo',
        100000000
      )
    ] ||
    'Texto'
  );
};

const tipoParaValor = (
  tipo:
    TipoConteudoModulo
): number =>
  TIPO_VALORES[
    tipo
  ];

export class ModuloConteudoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async listar(
    moduloId:
      string
  ): Promise<
    IModuloConteudoAdmin[]
  > {

    if (
      !moduloId
    ) {
      return [];
    }

    const registros =
      await this.dataverse
        .getConteudosModuloAdmin(
          moduloId
        );

    return registros
      .map(
        registro => ({
          id:
            texto(
              registro,
              'dgt_moduloconteudoid'
            ),

          moduloId:
            texto(
              registro,
              '_dgt_modulo_value'
            ),

          tipo:
            obterTipo(
              registro
            ),

          titulo:
            texto(
              registro,
              'dgt_titulo'
            ),

          conteudo:
            texto(
              registro,
              'dgt_conteudo'
            ),

          url:
            texto(
              registro,
              'dgt_url'
            ),

          ordem:
            numero(
              registro,
              'dgt_ordem'
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

          cards:
            lerCards(
              texto(
                registro,
                'dgt_conteudo'
              )
            )        })
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
      INovoModuloConteudo
  ): Promise<void> {

    this.validar(
      dados
    );

    await this.dataverse
      .criarConteudoModulo(
        dados.moduloId,
        {
          dgt_name:
            this.obterNome(
              dados
            ),

          dgt_tipoconteudo:
            tipoParaValor(
              dados.tipo
            ),

          dgt_titulo:
            dados.titulo
              .trim(),

          dgt_conteudo:
            dados.tipo ===
              'Cards'
              ? serializarCards(
                  dados.cards
                )
              : dados.conteudo
                  .trim(),

          dgt_url:
            dados.url
              .trim(),

          dgt_ordem:
            dados.ordem,

          dgt_obrigatorio:
            dados.obrigatorio,

          dgt_ativo:
            dados.ativo
        }
      );
  }

  public async editar(
    dados:
      IEditarModuloConteudo
  ): Promise<void> {

    if (
      !dados.id
    ) {
      throw new Error(
        'Conteúdo não informado.'
      );
    }

    this.validar(
      dados
    );

    await this.dataverse
      .atualizarConteudoModulo(
        dados.id,
        {
          dgt_name:
            this.obterNome(
              dados
            ),

          dgt_tipoconteudo:
            tipoParaValor(
              dados.tipo
            ),

          dgt_titulo:
            dados.titulo
              .trim(),

          dgt_conteudo:
            dados.tipo ===
              'Cards'
              ? serializarCards(
                  dados.cards
                )
              : dados.conteudo
                  .trim(),

          dgt_url:
            dados.url
              .trim(),

          dgt_ordem:
            dados.ordem,

          dgt_obrigatorio:
            dados.obrigatorio,

          dgt_ativo:
            dados.ativo
        }
      );
  }

  public async definirAtivo(
    id:
      string,
    ativo:
      boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarConteudoModulo(
        id,
        {
          dgt_ativo:
            ativo
        }
      );
  }

  public async mover(
    atual:
      IModuloConteudoAdmin,
    outro:
      IModuloConteudoAdmin
  ): Promise<void> {

    await this.dataverse
      .atualizarConteudoModulo(
        atual.id,
        {
          dgt_ordem:
            outro.ordem
        }
      );

    await this.dataverse
      .atualizarConteudoModulo(
        outro.id,
        {
          dgt_ordem:
            atual.ordem
        }
      );
  }

  private obterNome(
    dados:
      INovoModuloConteudo
  ): string {

    const titulo =
      dados.titulo
        .trim();

    return titulo
      ? `${dados.tipo} - ${titulo}`
      : `${dados.tipo} - Bloco ${dados.ordem}`;
  }

  private validar(
    dados:
      INovoModuloConteudo
  ): void {

    if (
      !dados.moduloId
    ) {
      throw new Error(
        'Módulo não informado.'
      );
    }

    if (
      dados.ordem <=
        0
    ) {
      throw new Error(
        'A ordem deve ser maior que zero.'
      );
    }


    if (
      dados.tipo ===
        'Cards'
    ) {

      const cards =
        dados.cards ||
        [];

      if (
        cards.length <
          1 ||
        cards.length >
          3
      ) {
        throw new Error(
          'O bloco Cards deve possuir de 1 a 3 cards.'
        );
      }

      const incompleto =
        cards.some(
          item =>
            !item.titulo
              .trim() ||
            !item.descricao
              .trim()
        );

      if (
        incompleto
      ) {
        throw new Error(
          'Preencha o título e a descrição de todos os cards.'
        );
      }
    }
    if (
      (
        dados.tipo ===
          'Texto' ||
        dados.tipo ===
          'Destaque'
      ) &&
      !dados.conteudo
        .trim()
    ) {
      throw new Error(
        'Informe o texto do conteúdo.'
      );
    }

    if (
      (
        dados.tipo ===
          'Vídeo' ||
        dados.tipo ===
          'Material' ||
        dados.tipo ===
          'Link' ||
        dados.tipo ===
          'Imagem'
      ) &&
      !dados.url
        .trim()
    ) {
      throw new Error(
        'Informe a URL do conteúdo.'
      );
    }
  }
}


