import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  ITrilha,
  ITrilhaTreinamento
} from '../models/Trilha';

import {
  ITreinamento
} from '../models/Treinamento';

export class TrilhaService {

  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ============================================================
  // TEXTO
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

  // ============================================================
  // NÚMERO
  // ============================================================

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

  // ============================================================
  // BOOLEANO
  // ============================================================

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

  // ============================================================
  // GUID
  // ============================================================

  private limparGuid(
    valor: string
  ): string {

    return (valor || '')
      .replace(/[{}]/g, '')
      .trim()
      .toLowerCase();
  }

  // ============================================================
  // STATUS
  // ============================================================

  private obterStatus(
    registro?: IDataverseRecord
  ): ITreinamento['status'] {

    if (!registro) {
      return 'Bloqueado';
    }

    const liberado =
      this.booleano(
        registro,
        'dgt_liberado',
        true
      );

    const valor =
      this.texto(
        registro,
        [
          'dgt_status@OData.Community.Display.V1.FormattedValue',
          'dgt_status'
        ]
      );

    const status =
      valor
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .trim();

    if (
      status.includes('conclu') ||
      status.includes('aprov')
    ) {
      return 'Concluído';
    }

    if (
      status.includes('reprov')
    ) {
      return 'Reprovado';
    }

    if (
      status.includes('venc')
    ) {
      return 'Vencido';
    }

    if (
      status.includes('cancel')
    ) {
      return 'Cancelado';
    }

    if (
      status.includes('andamento') ||
      status.includes('iniciado')
    ) {
      return 'Em andamento';
    }

    if (
      status.includes('bloque') ||
      !liberado
    ) {
      return 'Bloqueado';
    }

    return 'Disponível';
  }

  // ============================================================
  // CARREGAR TRILHAS DO USUÁRIO
  // ============================================================

  public async carregarTrilhasUsuario(
    atribuicoesUsuario: IDataverseRecord[],
    catalogo: ITreinamento[]
  ): Promise<ITrilha[]> {

    const [
      trilhas,
      relacoes
    ] = await Promise.all([
      this.dataverse.getTrilhas(),
      this.dataverse.getTrilhaTreinamentos()
    ]);

    // ==========================================================
    // IDENTIFICAR AS TRILHAS DO USUÁRIO
    // ==========================================================

    const trilhasIdsUsuario =
      new Set<string>(
        atribuicoesUsuario
          .map(item =>
            this.limparGuid(
              this.texto(
                item,
                '_dgt_trilha_value'
              )
            )
          )
          .filter(Boolean)
      );

    const resultado: ITrilha[] = [];

    // ==========================================================
    // PERCORRER TRILHAS
    // ==========================================================

    trilhas.forEach(trilha => {

      const trilhaId =
        this.limparGuid(
          this.texto(
            trilha,
            'dgt_trilhaid'
          )
        );

      if (!trilhaId) {
        return;
      }

      if (
        !trilhasIdsUsuario.has(
          trilhaId
        )
      ) {
        return;
      }

      // ========================================================
      // TREINAMENTOS DA TRILHA
      // ========================================================

      const itens: ITrilhaTreinamento[] =
        relacoes
          .filter(relacao => {

            const lookupTrilha =
              this.limparGuid(
                this.texto(
                  relacao,
                  '_dgt_trilha_value'
                )
              );

            return (
              lookupTrilha ===
              trilhaId
            );
          })
          .map(relacao => {

            // --------------------------------------------------
            // TREINAMENTO
            // --------------------------------------------------

            const treinamentoId =
              this.limparGuid(
                this.texto(
                  relacao,
                  '_dgt_treinamento_value'
                )
              );

            const treinamento =
              catalogo.find(item =>
                this.limparGuid(
                  item.id
                ) === treinamentoId
              );

            // --------------------------------------------------
            // ATRIBUIÇÃO
            // --------------------------------------------------

            const atribuicao =
              atribuicoesUsuario.find(
                registro => {

                  const treinamentoAtribuicao =
                    this.limparGuid(
                      this.texto(
                        registro,
                        '_dgt_treinamento_value'
                      )
                    );

                  const trilhaAtribuicao =
                    this.limparGuid(
                      this.texto(
                        registro,
                        '_dgt_trilha_value'
                      )
                    );

                  return (
                    treinamentoAtribuicao ===
                      treinamentoId &&
                    trilhaAtribuicao ===
                      trilhaId
                  );
                }
              );

            // --------------------------------------------------
            // STATUS
            // --------------------------------------------------

            const status =
              this.obterStatus(
                atribuicao
              );

            // --------------------------------------------------
            // PROGRESSO
            // --------------------------------------------------

            let progresso = 0;

            if (
              status ===
              'Concluído'
            ) {
              progresso = 100;
            } else if (
              status ===
              'Em andamento'
            ) {
              progresso = 50;
            }

            // --------------------------------------------------
            // REGRA LIBERAÇÃO
            // --------------------------------------------------

            const regraLiberacao =
              this.texto(
                relacao,
                [
                  'dgt_regraliberacao@OData.Community.Display.V1.FormattedValue',
                  'dgt_regraLiberacao@OData.Community.Display.V1.FormattedValue',
                  'dgt_regraliberacao',
                  'dgt_regraLiberacao'
                ]
              );

            // --------------------------------------------------
            // RESULTADO
            // --------------------------------------------------

            const item:
              ITrilhaTreinamento = {

              id:
                this.texto(
                  relacao,
                  'dgt_trilhatreinamentoid'
                ),

              treinamentoId,

              usuarioTreinamentoId:
                atribuicao
                  ? this.texto(
                      atribuicao,
                      'dgt_usuariotreinamentoid'
                    )
                  : undefined,

              ordem:
                this.numero(
                  relacao,
                  'dgt_ordem'
                ),

              obrigatorio:
                this.booleano(
                  relacao,
                  'dgt_obrigatorio',
                  true
                ),

              regraLiberacao,

              status,

              progresso,

              treinamento
            };

            return item;
          })
          .sort(
            (a, b) =>
              a.ordem -
              b.ordem
          );

      // ========================================================
      // CONCLUÍDOS
      // ========================================================

      const concluidos =
        itens.filter(
          item =>
            item.status ===
            'Concluído'
        ).length;

      // ========================================================
      // TOTAL
      // ========================================================

      const total =
        itens.length;

      // ========================================================
      // PROGRESSO DA TRILHA
      // ========================================================

      const progresso =
        total === 0
          ? 0
          : Math.round(
              (
                concluidos /
                total
              ) * 100
            );

      // ========================================================
      // ADICIONAR TRILHA
      // ========================================================

      resultado.push({

        id:
          trilhaId,

        nome:
          this.texto(
            trilha,
            [
              'dgt_name',
              'dgt_nome'
            ],
            'Trilha'
          ),

        descricao:
          this.texto(
            trilha,
            'dgt_descricao'
          ),

        ativa:
          this.booleano(
            trilha,
            'dgt_ativa',
            true
          ),

        treinamentos:
          itens,

        concluidos,

        total,

        progresso
      });
    });

    // ==========================================================
    // ORDENAR
    // ==========================================================

    return resultado.sort(
      (a, b) =>
        a.nome.localeCompare(
          b.nome,
          'pt-BR'
        )
    );
  }
}