import {
  DataverseService
} from './DataverseService';

import {
  interpretarRevisao,
  revisaoInteira
} from '../utils/numeracaoRevisao';

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

    // Revisão publicada nunca tem letra: Rev.00B → Rev.00.
    const camposRotulo: Record<string, string> = {};

    let lido: { registro?: unknown } | undefined;

    try {
      lido =
        await this.dataverse.obterRegistro(
          'dgt_documentorevisao',
          dados.documentoRevisaoId,
          ['dgt_revisao', 'dgt_name']
        );
    } catch (error) {
      // Sem leitura do rótulo: publica como está (não bloqueia).
      console.error(error);
      lido = undefined;
    }

    const rotuloAtual =
      lido && lido.registro
        ? String((lido.registro as Record<string, unknown>).dgt_revisao || '')
        : '';

    const interpretado =
      interpretarRevisao(rotuloAtual);

    if (interpretado && interpretado.sub) {

      const rotuloFinal =
        revisaoInteira(rotuloAtual);

      const nome =
        String((lido && lido.registro && (lido.registro as Record<string, unknown>).dgt_name) || '');

      camposRotulo.dgt_revisao = rotuloFinal;

      if (nome && nome.indexOf(rotuloAtual) >= 0) {
        camposRotulo.dgt_name = nome.replace(rotuloAtual, rotuloFinal).substring(0, 100);
      }
    }

    await this.dataverse
      .atualizarDocumentoRevisao(
        dados.documentoRevisaoId,
        {
          ...camposRotulo,
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

