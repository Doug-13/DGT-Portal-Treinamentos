import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface IDocumentoAdmin {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  area: string;
  areaId: string;
  tipo: string;
  revisaoAtual: string;
  responsavel: string;
  responsavelId: string;
  status: string;
  ativo: boolean;
}

export interface IRevisaoAdmin {
  id: string;
  documentoId: string;
  revisao: string;
  dataRevisao: string;
  dataVigencia: string;
  arquivoUrl: string;
  responsavel: string;
  motivoAlteracao: string;
  descricaoAlteracoes: string;
  requerRetreinamento: boolean;
  justificativa: string;
  status: string;
  ativa: boolean;

  criadoEm: string;
  criadoPor: string;
  modificadoEm: string;
  modificadoPor: string;
  aprovadoPor: string;
  dataAprovacao: string;
}

export interface INovoDocumentoAdmin {
  codigo: string;
  titulo: string;
  descricao: string;
  tipo: string;
  area: string;
  responsavel: string;
  revisaoInicial: string;
  status: string;
  ativo: boolean;
  arquivoNome?: string;
}
export interface INovoDocumentoCompleto
  extends INovoDocumentoAdmin {
  arquivo:
    File;
}
export interface INovaRevisaoDocumentoArquivo
  extends INovaRevisaoDocumento {
  arquivo:
    File;
}
export interface INovaRevisaoDocumento {
  documentoId: string;
  revisao: string;
  dataRevisao?: string;
  dataVigencia?: string;
  arquivoUrl?: string;
  responsavel?: string;
  motivoAlteracao: string;
  descricaoAlteracoes: string;
  requerRetreinamento: boolean;
  justificativa: string;
}

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];

  return valor === undefined ||
    valor === null
    ? padrao
    : String(valor);
};

const textoRelacionado = (
  registro:
    IDataverseRecord,

  relacao:
    string,

  campo:
    string
): string => {

  const relacionado =
    registro[
      relacao
    ];

  if (
    !relacionado ||
    typeof relacionado !==
      'object'
  ) {
    return '';
  }

  const valor =
    (
      relacionado as
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
const formatado = (
  registro:
    IDataverseRecord,

  campo:
    string
): string => {

  return texto(
    registro,
    `${campo}@OData.Community.Display.V1.FormattedValue`
  );
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


const normalizarDataDataverse = (
  valor:
    string | undefined | null
): string | null => {

  if (
    !valor
  ) {
    return null;
  }

  const textoData =
    String(
      valor
    )
      .trim();

  if (
    !textoData
  ) {
    return null;
  }

  // Dataverse Edm.Date espera somente YYYY-MM-DD.
  // Remove horario/timezone de valores como:
  // 2026-09-21T19:32:34.495Z
  if (
    textoData.length >=
      10
  ) {
    return textoData
      .substring(
        0,
        10
      );
  }

  return textoData;
};

const dataHojeDataverse =
  (): string =>
    new Date()
      .toISOString()
      .substring(
        0,
        10
      );
export class DocumentoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async listarDocumentos():
    Promise<IDocumentoAdmin[]> {

    const registros =
      await this.dataverse
        .getDocumentosAdmin();

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_documentoid'
          ),
          codigo: texto(
            registro,
            'dgt_codigo'
          ),
          titulo: texto(
            registro,
            'dgt_titulo',
            texto(
              registro,
              'dgt_name',
              'Documento'
            )
          ),
          descricao: texto(
            registro,
            'dgt_descricao'
          ),
          area: textoRelacionado(
            registro,
            'dgt_Area',
            'dgt_name'
          ),
          areaId: texto(
            registro,
            '_dgt_area_value'
          ),
          // dgt_tipo é um Picklist: o valor cru é um número. O rótulo
          // vem pela anotação FormattedValue (o Dataverse já a inclui
          // automaticamente, via o header Prefer enviado por este
          // serviço) — "dgt_tiponame" não existe como propriedade
          // consultável neste ambiente.
          tipo:
            formatado(registro, 'dgt_tipo') ||
            texto(registro, 'dgt_tipo'),

          revisaoAtual: texto(
            registro,
            'dgt_revisaoatual'
          ),
          // dgt_responsavel é um Lookup: o valor cru é o GUID
          // (_dgt_responsavel_value); o nome vem pela mesma anotação
          // FormattedValue, no valor do lookup.
          responsavel:
            formatado(registro, '_dgt_responsavel_value'),

          responsavelId: texto(
            registro,
            '_dgt_responsavel_value'
          ),
          // dgt_status é um Picklist: mesma lógica de dgt_tipo.
          status:
            formatado(registro, 'dgt_status') ||
            texto(registro, 'dgt_status'),
          ativo: booleano(
            registro,
            'dgt_ativo',
            true
          )
        })
      )
      .sort(
        (a, b) =>
          a.codigo.localeCompare(
            b.codigo,
            'pt-BR'
          )
      );
  }

  public async listarRevisoes(
    documentoId: string
  ): Promise<IRevisaoAdmin[]> {

    const registros =
      await this.dataverse
        .getRevisoesDocumentoAdmin(
          documentoId
        );

    return registros.map(
      registro => ({
        id: texto(
          registro,
          'dgt_documentorevisaoid'
        ),
        documentoId: texto(
          registro,
          '_dgt_documento_value'
        ),
        revisao: texto(
          registro,
          'dgt_revisao'
        ),
        dataRevisao: texto(
          registro,
          'dgt_datarevisao'
        ),
        dataVigencia: texto(
          registro,
          'dgt_datavigencia'
        ),
        arquivoUrl: texto(
          registro,
          'dgt_arquivourl'
        ),
        responsavel: texto(
          registro,
          'dgt_responsavel'
        ),
        motivoAlteracao: texto(
          registro,
          'dgt_motivoalteracao'
        ),
        descricaoAlteracoes: texto(
          registro,
          'dgt_descricaoalteracoes'
        ),
        requerRetreinamento: booleano(
          registro,
          'dgt_requerretreinamento',
          false
        ),
        justificativa: texto(
          registro,
          'dgt_justificativa'
        ),
        status: texto(
          registro,
          'dgt_status'
        ),
        ativa: booleano(
          registro,
          'dgt_ativa',
          true
        ),
        criadoEm:
          texto(
            registro,
            'createdon'
          ),

        criadoPor:
          formatado(
            registro,
            '_createdby_value'
          ),

        modificadoEm:
          texto(
            registro,
            'modifiedon'
          ),

        modificadoPor:
          formatado(
            registro,
            '_modifiedby_value'
          ),

        aprovadoPor:
          formatado(
            registro,
            '_dgt_aprovadopor_value'
          ),

        dataAprovacao:
          texto(
            registro,
            'dgt_dataaprovacao'
          )
      })
    );
  }


  private async resolverAprovadorId(
    valor:
      string
  ): Promise<string> {

    const termo =
      valor
        .trim()
        .toLocaleLowerCase();

    if (
      !termo
    ) {
      throw new Error(
        'Informe o aprovador do documento.'
      );
    }

    const usuarios =
      await this.dataverse
        .getUsuarios();

    const candidatosExatos =
      usuarios.filter(
        registro => {

          const nome =
            texto(
              registro,
              'dgt_name'
            )
              .trim()
              .toLocaleLowerCase();

          const email =
            texto(
              registro,
              'dgt_email'
            )
              .trim()
              .toLocaleLowerCase();

          return (
            nome === termo ||
            email === termo
          );
        }
      );

    let candidatos =
      candidatosExatos;

    if (
      candidatos.length ===
      0
    ) {
      candidatos =
        usuarios.filter(
          registro => {

            const nome =
              texto(
                registro,
                'dgt_name'
              )
                .trim()
                .toLocaleLowerCase();

            const email =
              texto(
                registro,
                'dgt_email'
              )
                .trim()
                .toLocaleLowerCase();

            return (
              nome.startsWith(
                termo
              ) ||
              email.startsWith(
                termo
              )
            );
          }
        );
    }

    if (
      candidatos.length ===
      0
    ) {
      throw new Error(
        `O aprovador "${valor}" não foi encontrado entre os usuários cadastrados. Informe o nome completo ou e-mail.`
      );
    }

    if (
      candidatos.length >
      1
    ) {
      throw new Error(
        `Mais de um usuário corresponde a "${valor}". Informe o e-mail completo do aprovador.`
      );
    }

    const id =
      texto(
        candidatos[0],
        'dgt_usuarioid'
      );

    if (
      !id
    ) {
      throw new Error(
        'O usuário selecionado como aprovador não possui identificador válido.'
      );
    }

    return id;
  }
  public async criarRevisao(
    dados: INovaRevisaoDocumento
  ): Promise<void> {

    if (!dados.documentoId) {
      throw new Error(
        'Documento não informado.'
      );
    }

    if (!dados.revisao.trim()) {
      throw new Error(
        'Informe a revisão.'
      );
    }

    if (
      !dados.requerRetreinamento &&
      !dados.justificativa.trim()
    ) {
      throw new Error(
        'Informe a justificativa para dispensar o retreinamento.'
      );
    }

    await this.dataverse
      .criarDocumentoRevisao(
        dados.documentoId,
        {
          dgt_name:
            `Revisão ${dados.revisao.trim()}`,

          dgt_revisao:
            dados.revisao.trim(),

          dgt_datarevisao:
            normalizarDataDataverse(
              dados.dataRevisao
            ) ||
            dataHojeDataverse(),

          dgt_datavigencia:
            normalizarDataDataverse(
              dados.dataVigencia
            ),

          dgt_arquivourl:
            dados.arquivoUrl?.trim() ||
            '',

          dgt_motivoalteracao:
            dados.motivoAlteracao.trim(),

          dgt_descricaoalteracoes:
            dados.descricaoAlteracoes.trim(),

          dgt_requerretreinamento:
            dados.requerRetreinamento,

          dgt_justificativa:
            dados.justificativa.trim(),

          dgt_ativa:
            true
        }
      );
  }
  public async criarDocumento(
    dados:
      INovoDocumentoAdmin
  ): Promise<IDocumentoAdmin> {

    if (
      !dados.codigo.trim()
    ) {
      throw new Error(
        'Informe o código do documento.'
      );
    }

    if (
      !dados.titulo.trim()
    ) {
      throw new Error(
        'Informe o título do documento.'
      );
    }

    if (
      !dados.responsavel.trim()
    ) {
      throw new Error(
        'Informe o aprovador do documento.'
      );
    }

    const areaRegistro =
      await this.dataverse
        .getAreaAdminPorNome(
          dados.area
        );

    if (
      !areaRegistro
    ) {
      throw new Error(
        `A área "${dados.area}" não está cadastrada ou está inativa no Dataverse.`
      );
    }

    const areaId =
      texto(
        areaRegistro,
        'dgt_areaid'
      );

    if (
      !areaId
    ) {
      throw new Error(
        'A área selecionada não possui identificador válido.'
      );
    }

    const aprovadorId =
      await this
        .resolverAprovadorId(
          dados.responsavel
        );

    const [
      tipoDataverse,
      statusDataverse
    ] =
      await Promise.all([
        this.dataverse
          .getChoiceOptionValue(
            'dgt_documento',
            'dgt_tipo',
            dados.tipo
          ),

        this.dataverse
          .getChoiceOptionValue(
            'dgt_documento',
            'dgt_status',
            dados.status
          )
      ]);

    const criado =
      await this.dataverse
        .criarDocumentoAdminComAreaEAprovador(
          areaId,
          aprovadorId,
          {
            dgt_name:
              dados.titulo.trim(),

            dgt_codigo:
              dados.codigo
                .trim()
                .toUpperCase(),

            dgt_titulo:
              dados.titulo.trim(),

            dgt_descricao:
              dados.descricao.trim(),

            dgt_tipo:
              tipoDataverse,

            dgt_revisaoatual:
              dados.revisaoInicial.trim(),

            dgt_status:
              statusDataverse,

            dgt_ativo:
              true
          }
        );

    return {
      id:
        texto(
          criado,
          'dgt_documentoid'
        ),

      codigo:
        dados.codigo
          .trim()
          .toUpperCase(),

      titulo:
        dados.titulo.trim(),

      descricao:
        dados.descricao.trim(),

      area:
        dados.area.trim(),

      areaId,

      tipo:
        dados.tipo.trim(),

      revisaoAtual:
        dados.revisaoInicial.trim(),

      responsavel:
        dados.responsavel.trim(),

      responsavelId:
        aprovadorId,

      status:
        dados.status.trim(),

      ativo:
        true
    };
  }
}