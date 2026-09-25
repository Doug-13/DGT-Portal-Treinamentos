import {
  DataverseService
} from './DataverseService';

export type StatusFluxoDocumento =
  | 'Elaboração'
  | 'Revisão'
  | 'Aprovação'
  | 'Vigente';

export class DocumentoWorkflowService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async enviarParaRevisao(
    documentoRevisaoId:
      string,

    statusAtual:
      string
  ): Promise<void> {

    this.validarTransicao(
      statusAtual,
      'Revisão'
    );

    await this.dataverse
      .alterarStatusDocumentoRevisao(
        documentoRevisaoId,
        'Revisão'
      );
  }

  public async enviarParaAprovacao(
    documentoRevisaoId:
      string,

    statusAtual:
      string
  ): Promise<void> {

    this.validarTransicao(
      statusAtual,
      'Aprovação'
    );

    await this.dataverse
      .alterarStatusDocumentoRevisao(
        documentoRevisaoId,
        'Aprovação'
      );
  }

  public async devolverParaElaboracao(
    documentoRevisaoId:
      string,

    statusAtual:
      string
  ): Promise<void> {

    this.validarTransicao(
      statusAtual,
      'Elaboração'
    );

    await this.dataverse
      .alterarStatusDocumentoRevisao(
        documentoRevisaoId,
        'Elaboração'
      );
  }

  public podePublicar(
    statusAtual:
      string
  ): boolean {

    return this.normalizar(
      statusAtual
    ) ===
      this.normalizar(
        'Aprovação'
      );
  }

  private validarTransicao(
    statusAtual:
      string,

    statusDestino:
      StatusFluxoDocumento
  ): void {

    const atualNormalizado =
      this.normalizar(
        statusAtual
      );

    // Qualquer valor não reconhecido (vazio, ou um status legado de
    // antes deste fluxo existir) é tratado como "elaboracao" — mesma
    // tolerância já aplicada na exibição das telas de documento. Sem
    // isso, um documento com status em branco nunca conseguia sair
    // da Elaboração, mesmo a tela mostrando o botão certo.
    const atual =
      [
        'elaboracao',
        'revisao',
        'aprovacao',
        'vigente'
      ].indexOf(
        atualNormalizado
      ) >= 0
        ? atualNormalizado
        : 'elaboracao';

    const destino =
      this.normalizar(
        statusDestino
      );

    // Fluxo (ver diagrama do processo):
    //   Elaboração → Gestor avalia (Aprovação)
    //   Aprovação: Aprovado → Vigente (via publicar, fora deste mapa)
    //              Reprovado → volta para Elaboração
    //   Vigente → final. Alterações geram uma nova revisão.
    const permitidas:
      Record<
        string,
        string[]
      > = {

      elaboracao:
        [
          'aprovacao'
        ],

      // "Revisão" não existe mais como etapa própria do fluxo atual,
      // mas o mapa é mantido por compatibilidade com revisões antigas
      // que porventura já estejam nesse status.
      revisao:
        [
          'elaboracao',
          'aprovacao'
        ],

      aprovacao:
        [
          'elaboracao'
        ],

      // Vigente é estado final da revisão: para alterar o documento
      // cria-se uma NOVA revisão (ex.: Rev.00 → Rev.01) em Elaboração.
      // A revisão vigente nunca volta para o fluxo, preservando o
      // histórico e a evidência de treinamento naquela revisão.
      vigente:
        []
    };

    const destinos =
      permitidas[
        atual
      ] ||
      [];

    if (
      atual === 'vigente'
    ) {
      throw new Error(
        'Esta revisão já está vigente e não pode voltar para o fluxo. ' +
        'Para alterar o documento, crie uma nova revisão.'
      );
    }

    if (
      destinos.indexOf(
        destino
      ) < 0
    ) {
      throw new Error(
        `Transição inválida: ${statusAtual || 'Sem status'} → ${statusDestino}.`
      );
    }
  }

  private normalizar(
    valor:
      string
  ): string {

    return (
      valor ||
      ''
    )
      .toLowerCase()
      .normalize(
        'NFD'
      )
      .replace(
        /[̀-ͯ]/g,
        ''
      )
      .trim();
  }
}