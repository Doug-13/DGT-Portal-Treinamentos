import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface IDocumentoAdmin {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  revisaoAtual: string;
  responsavel: string;
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
  arquivoNome: string;
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
          tipo: texto(
            registro,
            'dgt_tipo'
          ),
          revisaoAtual: texto(
            registro,
            'dgt_revisaoatual'
          ),
          responsavel: texto(
            registro,
            'dgt_responsavel'
          ),
          status: texto(
            registro,
            'dgt_status'
          ),
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
        )
      })
    );
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
            dados.dataRevisao ||
            new Date().toISOString(),

          dgt_datavigencia:
            dados.dataVigencia ||
            null,

          dgt_arquivourl:
            dados.arquivoUrl?.trim() ||
            '',

          dgt_responsavel:
            dados.responsavel?.trim() ||
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

    const criado =
      await this.dataverse
        .criarDocumentoAdmin({
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
            dados.tipo.trim(),

          dgt_documento:
            dados.area.trim(),

          dgt_responsavel:
            dados.responsavel.trim(),

          dgt_revisaoatual:
            dados.revisaoInicial.trim(),

          dgt_status:
            dados.status.trim(),

          dgt_ativo:
            dados.ativo
        });

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

      tipo:
        dados.tipo.trim(),

      revisaoAtual:
        dados.revisaoInicial.trim(),

      responsavel:
        dados.responsavel.trim(),

      status:
        dados.status.trim(),

      ativo:
        dados.ativo
    };
  }
}

