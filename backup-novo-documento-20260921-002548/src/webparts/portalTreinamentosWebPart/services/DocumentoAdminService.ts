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
}
