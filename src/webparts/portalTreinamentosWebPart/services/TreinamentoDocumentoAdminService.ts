import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface ITreinamentoDocumentoAdmin {
  id:
    string;

  documentoId:
    string;

  treinamentoId:
    string;

  treinamentoNome:
    string;

  treinamentoCodigo:
    string;

  obrigatorio:
    boolean;

  ordem:
    number;

  observacao:
    string;

  ativo:
    boolean;
}

export interface INovoTreinamentoDocumento {
  documentoId:
    string;

  treinamentoId:
    string;

  obrigatorio:
    boolean;

  ordem:
    number;

  observacao:
    string;
}

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

  return valor ===
      undefined ||
    valor ===
      null
      ? padrao
      : String(
        valor
      );
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

const numero = (
  registro:
    IDataverseRecord,

  campo:
    string,

  padrao =
    0
): number => {

  const valor =
    Number(
      registro[
        campo
      ]
    );

  return Number.isFinite(
    valor
  )
    ? valor
    : padrao;
};

const relacionado = (
  registro:
    IDataverseRecord,

  relacao:
    string,

  campo:
    string
): string => {

  const obj =
    registro[
      relacao
    ];

  if (
    !obj ||
    typeof obj !==
      'object'
  ) {
    return '';
  }

  const valor =
    (
      obj as
        Record<string, unknown>
    )[
      campo
    ];

  return valor ===
      undefined ||
    valor ===
      null
      ? ''
      : String(
        valor
      );
};

export class TreinamentoDocumentoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async listarPorDocumento(
    documentoId:
      string
  ):
    Promise<
      ITreinamentoDocumentoAdmin[]
    > {

    const registros =
      await this.dataverse
        .getTreinamentosDocumentoAdmin(
          documentoId
        );

    return registros
      .map(
        registro => ({
          id:
            texto(
              registro,
              'dgt_treinamentodocumentoid'
            ),

          documentoId:
            texto(
              registro,
              '_dgt_documento_value'
            ),

          treinamentoId:
            texto(
              registro,
              '_dgt_treinamento_value'
            ),

          treinamentoNome:
            relacionado(
              registro,
              'dgt_Treinamento',
              'dgt_name'
            ),

          treinamentoCodigo:
            relacionado(
              registro,
              'dgt_Treinamento',
              'dgt_codigo'
            ),

          obrigatorio:
            booleano(
              registro,
              'dgt_obrigatorio',
              true
            ),

          ordem:
            numero(
              registro,
              'dgt_ordem',
              0
            ),

          observacao:
            texto(
              registro,
              'dgt_observacao'
            ),

          ativo:
            booleano(
              registro,
              'dgt_ativo',
              true
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

  public async vincular(
    dados:
      INovoTreinamentoDocumento
  ): Promise<void> {

    if (
      !dados.documentoId
    ) {
      throw new Error(
        'Documento não informado.'
      );
    }

    if (
      !dados.treinamentoId
    ) {
      throw new Error(
        'Treinamento não informado.'
      );
    }

    const existentes =
      await this
        .listarPorDocumento(
          dados.documentoId
        );

    const existente =
      existentes.find(
        item =>
          item.treinamentoId
            .toLowerCase() ===
          dados.treinamentoId
            .toLowerCase()
      );

    if (
      existente
    ) {

      if (
        existente.ativo
      ) {
        throw new Error(
          'Este treinamento já está vinculado ao documento.'
        );
      }

      await this.dataverse
        .atualizarTreinamentoDocumento(
          existente.id,
          {
            dgt_ativo:
              true,

            dgt_obrigatorio:
              dados.obrigatorio,

            dgt_ordem:
              dados.ordem,

            dgt_observacao:
              dados.observacao.trim()
          }
        );

      return;
    }

    await this.dataverse
      .criarTreinamentoDocumento(
        dados.documentoId,
        dados.treinamentoId,
        {
          dgt_name:
            'Documento / Treinamento',

          dgt_obrigatorio:
            dados.obrigatorio,

          dgt_ordem:
            dados.ordem,

          dgt_observacao:
            dados.observacao.trim(),

          dgt_ativo:
            true
        }
      );
  }

  public async desativar(
    relacaoId:
      string
  ): Promise<void> {

    await this.dataverse
      .atualizarTreinamentoDocumento(
        relacaoId,
        {
          dgt_ativo:
            false
        }
      );
  }
}
