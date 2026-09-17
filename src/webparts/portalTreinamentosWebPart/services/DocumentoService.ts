import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  IDocumento,
  IDocumentoRevisao,
  ITreinamentoDocumento
} from '../models/Documento';

export class DocumentoService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ============================================================
  // UTILITÁRIOS
  // ============================================================

  private texto(
    registro: IDataverseRecord,
    campos: string | string[],
    padrao = ''
  ): string {

    const lista =
      Array.isArray(campos)
        ? campos
        : [campos];

    for (const campo of lista) {

      const valor =
        registro[campo];

      if (
        valor !== undefined &&
        valor !== null &&
        String(valor).trim() !== ''
      ) {
        return String(valor);
      }
    }

    return padrao;
  }

  private numero(
    registro: IDataverseRecord,
    campo: string,
    padrao = 0
  ): number {

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

    return Number.isNaN(convertido)
      ? padrao
      : convertido;
  }

  private booleano(
    registro: IDataverseRecord,
    campo: string,
    padrao = true
  ): boolean {

    const valor =
      registro[campo];

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
  }

  private guid(
    valor: string
  ): string {

    return (valor || '')
      .replace(/[{}]/g, '')
      .trim()
      .toLowerCase();
  }

  private formatado(
    registro: IDataverseRecord,
    campo: string
  ): string {

    return this.texto(
      registro,
      `${campo}@OData.Community.Display.V1.FormattedValue`
    );
  }

  // ============================================================
  // DOCUMENTOS
  // ============================================================

  public async getDocumentos():
    Promise<IDocumento[]> {

    const registros =
      await this.dataverse
        .getDocumentos();

    return registros.map(
      registro => {

        const titulo =
          this.texto(
            registro,
            [
              'dgt_titulo',
              'dgt_name'
            ],
            'Documento'
          );

        const tipo =
          this.formatado(
            registro,
            'dgt_tipo'
          ) ||
          this.texto(
            registro,
            'dgt_tipo'
          );

        const status =
          this.formatado(
            registro,
            'dgt_status'
          ) ||
          this.texto(
            registro,
            'dgt_status'
          );

        const responsavel =
          this.formatado(
            registro,
            '_dgt_responsavel_value'
          );

        return {

          id:
            this.guid(
              this.texto(
                registro,
                'dgt_documentoid'
              )
            ),

          codigo:
            this.texto(
              registro,
              'dgt_codigo'
            ),

          titulo,

          documento:
            titulo,

          descricao:
            this.texto(
              registro,
              'dgt_descricao'
            ),

          categoria:
            tipo || '-',

          tipo:
            tipo || '-',

          status:
            status || '-',

          revisao:
            this.texto(
              registro,
              'dgt_revisaoatual',
              '-'
            ),

          revisaoAtual:
            this.texto(
              registro,
              'dgt_revisaoatual',
              '-'
            ),

          responsavelId:
            this.guid(
              this.texto(
                registro,
                '_dgt_responsavel_value'
              )
            ),

          responsavel:
            responsavel || '-',

          ativo:
            this.booleano(
              registro,
              'dgt_ativo',
              true
            )
        };
      }
    );
  }

  // ============================================================
  // REVISÕES
  // ============================================================

  public async getRevisoesDocumento(
    documentoId: string
  ): Promise<IDocumentoRevisao[]> {

    if (!documentoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getDocumentoRevisoes(
          documentoId
        );

    return registros
      .map(registro => {

        const responsavel =
          this.formatado(
            registro,
            '_dgt_responsavel_value'
          );

        const aprovadoPor =
          this.formatado(
            registro,
            '_dgt_aprovadopor_value'
          );

        const status =
          this.formatado(
            registro,
            'dgt_status'
          ) ||
          this.texto(
            registro,
            'dgt_status'
          );

        return {

          id:
            this.guid(
              this.texto(
                registro,
                'dgt_documentorevisaoid'
              )
            ),

          documentoId:
            this.guid(
              this.texto(
                registro,
                '_dgt_documento_value'
              )
            ),

          nome:
            this.texto(
              registro,
              'dgt_name'
            ),

          revisao:
            this.texto(
              registro,
              'dgt_revisao',
              '-'
            ),

          dataRevisao:
            this.texto(
              registro,
              'dgt_datarevisao'
            ),

          dataVigencia:
            this.texto(
              registro,
              'dgt_datavigencia'
            ),

          arquivoUrl:
            this.texto(
              registro,
              'dgt_arquivourl'
            ),

          biblioteca:
            this.texto(
              registro,
              'dgt_biblioteca'
            ),

          sharePointItemId:
            this.texto(
              registro,
              'dgt_sharepointitemid'
            ),

          responsavelId:
            this.guid(
              this.texto(
                registro,
                '_dgt_responsavel_value'
              )
            ),

          responsavel:
            responsavel || '-',

          aprovadoPorId:
            this.guid(
              this.texto(
                registro,
                '_dgt_aprovadopor_value'
              )
            ),

          aprovadoPor:
            aprovadoPor || '-',

          motivoAlteracao:
            this.texto(
              registro,
              'dgt_motivoalteracao'
            ),

          descricaoAlteracoes:
            this.texto(
              registro,
              'dgt_descricaoalteracoes'
            ),

          requerRetreinamento:
            this.booleano(
              registro,
              'dgt_requerretreinamento',
              false
            ),

          justificativa:
            this.texto(
              registro,
              'dgt_justificativa'
            ),

          status:
            status || '-',

          ativa:
            this.booleano(
              registro,
              'dgt_ativa',
              true
            )
        };
      })
      .sort(
        (a, b) => {

          const dataA =
            a.dataRevisao
              ? new Date(
                  a.dataRevisao
                ).getTime()
              : 0;

          const dataB =
            b.dataRevisao
              ? new Date(
                  b.dataRevisao
                ).getTime()
              : 0;

          return dataB - dataA;
        }
      );
  }

  // ============================================================
  // DOCUMENTOS DO TREINAMENTO
  // ============================================================

  public async getTreinamentoDocumentos(
    treinamentoId: string
  ): Promise<ITreinamentoDocumento[]> {

    if (!treinamentoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getTreinamentoDocumentos(
          treinamentoId
        );

    return registros.map(
      registro => ({

        id:
          this.guid(
            this.texto(
              registro,
              'dgt_treinamentodocumentoid'
            )
          ),

        nome:
          this.texto(
            registro,
            'dgt_name'
          ),

        treinamentoId:
          this.guid(
            this.texto(
              registro,
              '_dgt_treinamento_value'
            )
          ),

        documentoId:
          this.guid(
            this.texto(
              registro,
              '_dgt_documento_value'
            )
          ),

        obrigatorio:
          this.booleano(
            registro,
            'dgt_obrigatorio',
            true
          ),

        ordem:
          this.numero(
            registro,
            'dgt_ordem'
          ),

        observacao:
          this.texto(
            registro,
            'dgt_observacao'
          ),

        ativo:
          this.booleano(
            registro,
            'dgt_ativo',
            true
          )
      }))
      .sort(
        (a, b) =>
          a.ordem -
          b.ordem
      );
  }

  // ============================================================
  // DOCUMENTOS VINCULADOS AO TREINAMENTO
  // ============================================================

  public async getDocumentosPorTreinamento(
    treinamentoId: string
  ): Promise<IDocumento[]> {

    const [
      documentos,
      relacionamentos
    ] =
      await Promise.all([
        this.getDocumentos(),
        this.getTreinamentoDocumentos(
          treinamentoId
        )
      ]);

    const ids =
      new Set(
        relacionamentos
          .filter(
            item =>
              item.ativo
          )
          .map(
            item =>
              item.documentoId
          )
      );

    return documentos.filter(
      documento =>
        ids.has(
          documento.id
        )
    );
  }
}