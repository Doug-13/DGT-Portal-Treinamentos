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
  // TRILHAS COM MATRÍCULA (dgt_usuariotrilha)
  // ============================================================
  // Matrículas são criadas pela tela "Atribuir treinamento /
  // trilha". Falha de leitura (ex.: permissão) não quebra a página.
  // ============================================================

  private async carregarIdsTrilhasMatriculadas(
    emailUsuario: string
  ): Promise<Set<string>> {

    const ids =
      new Set<string>();

    const email =
      (emailUsuario || '')
        .trim()
        .toLowerCase();

    if (!email) {
      return ids;
    }

    try {

      const usuarios =
        await this.dataverse.getUsuarioAcessoPorEmail(
          email
        );

      const usuarioId =
        usuarios[0]
          ? this.limparGuid(
              this.texto(
                usuarios[0],
                'dgt_usuarioid'
              )
            )
          : '';

      if (!usuarioId) {
        return ids;
      }

      const matriculas =
        await this.dataverse.listarRegistros(
          'dgt_usuariotrilha',
          '$select=_dgt_trilha_value,dgt_ativa' +
          `&$filter=_dgt_usuario_value eq ${usuarioId}` +
          ' and dgt_ativa eq true'
        );

      matriculas.forEach(registro => {
        const trilhaId =
          this.limparGuid(
            this.texto(
              registro,
              '_dgt_trilha_value'
            )
          );

        if (trilhaId) {
          ids.add(trilhaId);
        }
      });

    } catch (e) {
      console.warn(
        'Não foi possível ler as matrículas em trilhas (dgt_usuariotrilha).',
        e
      );
    }

    return ids;
  }

  // ============================================================
  // TRILHAS VISÍVEIS POR ÁREA
  // ============================================================
  // Regra de visibilidade configurada em Gestão > Trilhas >
  // Etapa 3 (Público / Áreas):
  //   dgt_trilha.dgt_todasareas = true  -> visível a todos;
  //   dgt_trilhaarea (ativo)            -> visível aos membros
  //                                        ativos da área
  //                                        (dgt_usuarioarea).
  // Falhas de leitura (ex.: permissão da Security Role) não
  // impedem a página: o usuário continua vendo as trilhas
  // atribuídas a ele.
  // ============================================================

  private async carregarIdsTrilhasVisiveisPorArea(
    emailUsuario: string
  ): Promise<Set<string>> {

    const visiveis =
      new Set<string>();

    const email =
      (emailUsuario || '')
        .trim()
        .toLowerCase();

    if (!email) {
      return visiveis;
    }

    try {

      const [
        usuarios,
        trilhasFluxo
      ] = await Promise.all([
        this.dataverse.getUsuarioAcessoPorEmail(
          email
        ),
        this.dataverse.getTrilhasFluxo()
      ]);

      const usuario =
        usuarios[0];

      if (!usuario) {
        return visiveis;
      }

      const usuarioId =
        this.limparGuid(
          this.texto(
            usuario,
            'dgt_usuarioid'
          )
        );

      // --------------------------------------------------------
      // ÁREAS DO USUÁRIO
      // --------------------------------------------------------

      let areasUsuario =
        new Set<string>();

      try {

        const vinculos =
          await this.dataverse.getUsuariosAreasAdmin();

        areasUsuario =
          new Set<string>(
            vinculos
              .filter(vinculo =>
                this.limparGuid(
                  this.texto(
                    vinculo,
                    '_dgt_usuario_value'
                  )
                ) === usuarioId &&
                this.booleano(
                  vinculo,
                  'dgt_ativo',
                  true
                )
              )
              .map(vinculo =>
                this.limparGuid(
                  this.texto(
                    vinculo,
                    '_dgt_area_value'
                  )
                )
              )
              .filter(Boolean)
          );

      } catch (e) {
        console.warn(
          'Não foi possível ler as áreas do usuário (dgt_usuarioarea).',
          e
        );
      }

      // --------------------------------------------------------
      // TRILHAS ATIVAS
      // --------------------------------------------------------

      const trilhasAtivas =
        trilhasFluxo.filter(trilha =>
          this.booleano(
            trilha,
            'dgt_ativa',
            true
          )
        );

      const trilhasRestritas:
        string[] = [];

      trilhasAtivas.forEach(trilha => {

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
          this.booleano(
            trilha,
            'dgt_todasareas',
            false
          )
        ) {
          visiveis.add(
            trilhaId
          );
        } else {
          trilhasRestritas.push(
            trilhaId
          );
        }
      });

      if (
        areasUsuario.size === 0 ||
        trilhasRestritas.length === 0
      ) {
        return visiveis;
      }

      // --------------------------------------------------------
      // ÁREAS DE CADA TRILHA RESTRITA
      // --------------------------------------------------------

      const areasPorTrilha =
        await Promise.all(
          trilhasRestritas.map(async trilhaId => {
            try {
              return {
                trilhaId,
                areas:
                  await this.dataverse.getTrilhaAreasFluxo(
                    trilhaId
                  )
              };
            } catch (e) {
              console.warn(
                `Não foi possível ler as áreas da trilha ${trilhaId} (dgt_trilhaarea).`,
                e
              );
              return {
                trilhaId,
                areas: [] as IDataverseRecord[]
              };
            }
          })
        );

      areasPorTrilha.forEach(item => {

        const liberada =
          item.areas.some(relacao =>
            this.booleano(
              relacao,
              'dgt_ativo',
              true
            ) &&
            areasUsuario.has(
              this.limparGuid(
                this.texto(
                  relacao,
                  '_dgt_area_value'
                )
              )
            )
          );

        if (liberada) {
          visiveis.add(
            item.trilhaId
          );
        }
      });

    } catch (e) {
      console.warn(
        'Não foi possível calcular as trilhas visíveis por área.',
        e
      );
    }

    return visiveis;
  }

  // ============================================================
  // CARREGAR TRILHAS DO USUÁRIO
  // ============================================================

  public async carregarTrilhasUsuario(
    atribuicoesUsuario: IDataverseRecord[],
    catalogo: ITreinamento[],
    emailUsuario = ''
  ): Promise<ITrilha[]> {

    const [
      trilhas,
      relacoes,
      trilhasIdsVisiveis,
      trilhasIdsMatriculadas
    ] = await Promise.all([
      this.dataverse.getTrilhas(),
      this.dataverse.getTrilhaTreinamentos(),
      this.carregarIdsTrilhasVisiveisPorArea(
        emailUsuario
      ),
      this.carregarIdsTrilhasMatriculadas(
        emailUsuario
      )
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

      // A trilha aparece quando:
      // - o usuário possui atribuição vinculada a ela; OU
      // - a trilha está liberada para todas as áreas ou para
      //   uma área da qual o usuário é membro ativo.
      // Atribuída = possui treinamento vinculado à trilha OU
      // matrícula ativa na trilha (dgt_usuariotrilha). A matrícula
      // cobre o caso em que todos os treinamentos foram
      // reaproveitados de conclusões anteriores.
      const atribuida =
        trilhasIdsUsuario.has(
          trilhaId
        ) ||
        trilhasIdsMatriculadas.has(
          trilhaId
        );

      const visivelPorArea =
        trilhasIdsVisiveis.has(
          trilhaId
        );

      if (
        !atribuida &&
        !visivelPorArea
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

            const atribuicaoNaTrilha =
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

            // Quando o usuário já concluiu este treinamento em outra
            // trilha (ou individualmente) e a conclusão ainda é
            // válida, a Custom API dgt_ProcessarAtribuicao reaproveita
            // essa conclusão em vez de criar um novo registro. Nesse
            // caso a trilha deve exibir o treinamento como Concluído.
            const atribuicao =
              atribuicaoNaTrilha ||
              atribuicoesUsuario.find(
                registro =>
                  this.limparGuid(
                    this.texto(
                      registro,
                      '_dgt_treinamento_value'
                    )
                  ) === treinamentoId &&
                  this.obterStatus(
                    registro
                  ) === 'Concluído'
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

        progresso,

        atribuida
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