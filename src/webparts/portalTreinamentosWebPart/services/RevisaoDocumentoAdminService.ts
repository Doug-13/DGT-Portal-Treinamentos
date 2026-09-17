import {
  DataverseService
} from './DataverseService';

export interface IPublicarRevisao {
  documentoRevisaoId: string;
  dataVigencia?: string;
  dataLimite?: string;
}

export interface IResultadoPublicacaoRevisao {
  sucesso: boolean;
  mensagem: string;
  documentoRevisaoId: string;
  documentoId: string;
  revisao: string;
  requerRetreinamento: boolean;
  treinamentosImpactados: number;
  usuariosImpactados: number;
  atribuicoesCriadas: number;
  atribuicoesReutilizadas: number;
  atribuicoesBloqueadas: number;
  falhas: string[];
}

export class RevisaoDocumentoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async publicar(
    dados:
      IPublicarRevisao
  ): Promise<IResultadoPublicacaoRevisao> {

    if (!dados.documentoRevisaoId) {
      throw new Error(
        'Revisão documental não informada.'
      );
    }

    const resposta =
      await this.dataverse
        .processarRevisaoDocumento({
          DocumentoRevisaoId:
            dados.documentoRevisaoId,

          DataVigencia:
            dados.dataVigencia ||
            '',

          DataLimite:
            dados.dataLimite ||
            ''
        });

    return resposta as unknown as
      IResultadoPublicacaoRevisao;
  }
}
