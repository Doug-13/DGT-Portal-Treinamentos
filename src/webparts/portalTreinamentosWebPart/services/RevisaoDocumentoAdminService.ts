import {
  DataverseService
} from './DataverseService';

export interface IPublicarRevisao {
  documentoRevisaoId: string;
  requerRetreinamento: boolean;
  justificativa: string;
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

    if (
      !dados.requerRetreinamento &&
      !dados.justificativa.trim()
    ) {
      throw new Error(
        'Informe a justificativa para publicar sem retreinamento.'
      );
    }

    if (
      dados.requerRetreinamento &&
      !dados.dataLimite
    ) {
      throw new Error(
        'Informe o prazo para conclusão do retreinamento.'
      );
    }

    await this.dataverse
      .atualizarDocumentoRevisao(
        dados.documentoRevisaoId,
        {
          dgt_requerretreinamento:
            dados.requerRetreinamento,

          dgt_justificativa:
            dados.requerRetreinamento
              ? ''
              : dados.justificativa.trim()
        }
      );

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

