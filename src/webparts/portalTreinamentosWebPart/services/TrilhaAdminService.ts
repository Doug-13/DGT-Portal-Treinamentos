import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface ITrilhaAdmin {
  id:
    string;

  nome:
    string;

  codigo:
    string;

  descricao:
    string;

  observacoes:
    string;

  ativa:
    boolean;

  todasAreas:
    boolean;

  quantidadeTreinamentos:
    number;

  quantidadeAreas:
    number;
}

export interface INovaTrilha {
  nome:
    string;

  descricao:
    string;

  observacoes:
    string;

  ativa:
    boolean;
}

export interface IEditarTrilha
  extends
    INovaTrilha {
  id:
    string;
}

export interface ITrilhaTreinamentoAdmin {
  id:
    string;

  trilhaId:
    string;

  treinamentoId:
    string;

  treinamentoNome:
    string;

  treinamentoCodigo:
    string;

  ordem:
    number;

  obrigatorio:
    boolean;

  diasParaConclusao:
    number;

  ativo:
    boolean;
}

export interface ITrilhaTreinamentoEdicao {
  treinamentoId:
    string;

  ordem:
    number;

  obrigatorio:
    boolean;

  diasParaConclusao:
    number;
}

export interface ITrilhaAreaAdmin {
  id:
    string;

  trilhaId:
    string;

  areaId:
    string;

  ativa:
    boolean;
}

const texto =
  (
    registro:
      IDataverseRecord,
    campo:
      string,
    padrao =
      ''
  ): string => {

    const valor =
      registro[
        campo
      ];

    return (
      valor ===
        undefined ||
      valor ===
        null
    )
      ? padrao
      : String(
          valor
        );
  };

const numero =
  (
    registro:
      IDataverseRecord,
    campo:
      string,
    padrao =
      0
  ): number => {

    const valor =
      registro[
        campo
      ];

    if (
      valor ===
        undefined ||
      valor ===
        null ||
      valor ===
        ''
    ) {
      return padrao;
    }

    const convertido =
      Number(
        valor
      );

    return Number.isNaN(
      convertido
    )
      ? padrao
      : convertido;
  };

const booleano =
  (
    registro:
      IDataverseRecord,
    campo:
      string,
    padrao =
      true
  ): boolean => {

    const valor =
      registro[
        campo
      ];

    if (
      typeof valor ===
        'boolean'
    ) {
      return valor;
    }

    if (
      valor ===
        1 ||
      valor ===
        '1' ||
      valor ===
        'true'
    ) {
      return true;
    }

    if (
      valor ===
        0 ||
      valor ===
        '0' ||
      valor ===
        'false'
    ) {
      return false;
    }

    return padrao;
  };

const limparGuid =
  (
    valor:
      string
  ): string =>
    valor
      .replace(
        /[{}]/g,
        ''
      )
      .trim()
      .toLowerCase();

const doisDigitos =
  (
    valor:
      number
  ): string =>
    valor <
      10
      ? `0${valor}`
      : String(
          valor
        );

const gerarCodigo =
  (): string => {

    const agora =
      new Date();

    const data =
      `${agora.getFullYear()}` +
      `${doisDigitos(
        agora.getMonth() +
        1
      )}` +
      `${doisDigitos(
        agora.getDate()
      )}`;

    const hora =
      `${doisDigitos(
        agora.getHours()
      )}` +
      `${doisDigitos(
        agora.getMinutes()
      )}` +
      `${doisDigitos(
        agora.getSeconds()
      )}`;

    return `TRI-${data}-${hora}`;
  };

export class TrilhaAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async listarTrilhas():
    Promise<ITrilhaAdmin[]> {

    const trilhas =
      await this.dataverse
        .getTrilhasFluxo();

    const resultado:
      ITrilhaAdmin[] = [];

    for (
      const trilha of
      trilhas
    ) {

      const id =
        texto(
          trilha,
          'dgt_trilhaid'
        );

      const [
        treinamentos,
        areas
      ] =
        await Promise.all([
          this.dataverse
            .getTrilhaTreinamentosFluxo(
              id
            ),

          this.dataverse
            .getTrilhaAreasFluxo(
              id
            )
        ]);

      resultado.push({
        id,

        nome:
          texto(
            trilha,
            'dgt_name',
            'Trilha'
          ),

        codigo:
          texto(
            trilha,
            'dgt_codigo'
          ),

        descricao:
          texto(
            trilha,
            'dgt_descricao'
          ),

        observacoes:
          texto(
            trilha,
            'dgt_observacoes'
          ),

        ativa:
          booleano(
            trilha,
            'dgt_ativa',
            true
          ),

        todasAreas:
          booleano(
            trilha,
            'dgt_todasareas',
            true
          ),

        quantidadeTreinamentos:
          treinamentos
            .filter(
              item =>
                booleano(
                  item,
                  'dgt_ativo',
                  true
                )
            )
            .length,

        quantidadeAreas:
          areas
            .filter(
              item =>
                booleano(
                  item,
                  'dgt_ativo',
                  true
                )
            )
            .length
      });
    }

    return resultado
      .sort(
        (
          a,
          b
        ) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async obterTrilha(
    trilhaId:
      string
  ): Promise<
    ITrilhaAdmin | undefined
  > {

    const trilhas =
      await this.listarTrilhas();

    return trilhas.find(
      item =>
        limparGuid(
          item.id
        ) ===
        limparGuid(
          trilhaId
        )
    );
  }

  public async criarTrilha(
    dados:
      INovaTrilha
  ): Promise<ITrilhaAdmin> {

    this.validarTrilha(
      dados
    );

    const codigo =
      gerarCodigo();

    await this.dataverse
      .criarTrilhaFluxo({
        dgt_name:
          dados.nome
            .trim(),

        dgt_codigo:
          codigo,

        dgt_descricao:
          dados.descricao
            .trim(),

        dgt_observacoes:
          dados.observacoes
            .trim(),

        dgt_ativa:
          dados.ativa,

        dgt_todasareas:
          true
      });

    const trilhas =
      await this.listarTrilhas();

    const criada =
      trilhas
        .slice()
        .reverse()
        .find(
          item =>
            item.codigo ===
            codigo
        );

    if (
      !criada
    ) {
      throw new Error(
        'A trilha foi criada, mas não foi possível localizar o registro.'
      );
    }

    return criada;
  }

  public async editarTrilha(
    dados:
      IEditarTrilha
  ): Promise<void> {

    if (
      !dados.id
    ) {
      throw new Error(
        'ID da trilha não informado.'
      );
    }

    this.validarTrilha(
      dados
    );

    await this.dataverse
      .atualizarTrilhaFluxo(
        dados.id,
        {
          dgt_name:
            dados.nome
              .trim(),

          dgt_descricao:
            dados.descricao
              .trim(),

          dgt_observacoes:
            dados.observacoes
              .trim(),

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async definirTrilhaAtiva(
    trilhaId:
      string,
    ativa:
      boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarTrilhaFluxo(
        trilhaId,
        {
          dgt_ativa:
            ativa
        }
      );
  }

  public async listarTreinamentosTrilha(
    trilhaId:
      string
  ): Promise<
    ITrilhaTreinamentoAdmin[]
  > {

    const [
      relacionamentos,
      treinamentos
    ] =
      await Promise.all([
        this.dataverse
          .getTrilhaTreinamentosFluxo(
            trilhaId
          ),

        this.dataverse
          .getTreinamentos()
      ]);

    return relacionamentos
      .map(
        relacao => {

          const treinamentoId =
            texto(
              relacao,
              '_dgt_treinamento_value'
            );

          const treinamento =
            treinamentos.find(
              item =>
                limparGuid(
                  texto(
                    item,
                    'dgt_treinamentoid'
                  )
                ) ===
                limparGuid(
                  treinamentoId
                )
            );

          return {
            id:
              texto(
                relacao,
                'dgt_trilhatreinamentoid'
              ),

            trilhaId,

            treinamentoId,

            treinamentoNome:
              treinamento
                ? texto(
                    treinamento,
                    'dgt_name',
                    'Treinamento'
                  )
                : 'Treinamento',

            treinamentoCodigo:
              treinamento
                ? texto(
                    treinamento,
                    'dgt_codigo'
                  )
                : '',

            ordem:
              numero(
                relacao,
                'dgt_ordem'
              ),

            obrigatorio:
              booleano(
                relacao,
                'dgt_obrigatorio',
                true
              ),

            diasParaConclusao:
              numero(
                relacao,
                'dgt_diasparaconclusao'
              ),

            ativo:
              booleano(
                relacao,
                'dgt_ativo',
                true
              )
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          a.ordem -
          b.ordem
      );
  }

  public async salvarTreinamentos(
    trilhaId:
      string,
    itens:
      ITrilhaTreinamentoEdicao[]
  ): Promise<void> {

    if (
      !trilhaId
    ) {
      throw new Error(
        'Trilha não informada.'
      );
    }

    if (
      itens.length ===
        0
    ) {
      throw new Error(
        'Selecione pelo menos um treinamento para a trilha.'
      );
    }

    const existentes =
      await this.listarTreinamentosTrilha(
        trilhaId
      );

    const todosRelacionamentos =
      await this.dataverse
        .getTrilhaTreinamentosFluxo(
          trilhaId
        );

    for (
      const item of
      itens
    ) {

      const registro =
        todosRelacionamentos.find(
          relacao =>
            limparGuid(
              texto(
                relacao,
                '_dgt_treinamento_value'
              )
            ) ===
            limparGuid(
              item.treinamentoId
            )
        );

      if (
        registro
      ) {

        await this.dataverse
          .atualizarTrilhaTreinamentoFluxo(
            texto(
              registro,
              'dgt_trilhatreinamentoid'
            ),
            {
              dgt_ordem:
                item.ordem,

              dgt_obrigatorio:
                item.obrigatorio,

              dgt_diasparaconclusao:
                item.diasParaConclusao,

              dgt_ativo:
                true
            }
          );

      } else {

        await this.dataverse
          .criarTrilhaTreinamentoFluxo(
            trilhaId,
            item.treinamentoId,
            {
              dgt_name:
                `Treinamento ${item.ordem}`,

              dgt_ordem:
                item.ordem,

              dgt_obrigatorio:
                item.obrigatorio,

              dgt_diasparaconclusao:
                item.diasParaConclusao,

              dgt_ativo:
                true
            }
          );
      }
    }

    for (
      const existente of
      existentes
    ) {

      const permanece =
        itens.some(
          item =>
            limparGuid(
              item.treinamentoId
            ) ===
            limparGuid(
              existente.treinamentoId
            )
        );

      if (
        !permanece &&
        existente.ativo
      ) {

        await this.dataverse
          .atualizarTrilhaTreinamentoFluxo(
            existente.id,
            {
              dgt_ativo:
                false
            }
          );
      }
    }
  }

  public async listarAreasTrilha(
    trilhaId:
      string
  ): Promise<
    ITrilhaAreaAdmin[]
  > {

    const registros =
      await this.dataverse
        .getTrilhaAreasFluxo(
          trilhaId
        );

    return registros.map(
      registro => ({
        id:
          texto(
            registro,
            'dgt_trilhaareaid'
          ),

        trilhaId,

        areaId:
          texto(
            registro,
            '_dgt_area_value'
          ),

        ativa:
          booleano(
            registro,
            'dgt_ativo',
            true
          )
      })
    );
  }

  public async salvarAreas(
    trilhaId:
      string,
    todasAreas:
      boolean,
    areaIds:
      string[]
  ): Promise<void> {

    if (
      !trilhaId
    ) {
      throw new Error(
        'Trilha não informada.'
      );
    }

    if (
      !todasAreas &&
      areaIds.length ===
        0
    ) {
      throw new Error(
        'Selecione pelo menos uma área ou marque "Todas as áreas".'
      );
    }

    await this.dataverse
      .atualizarTrilhaFluxo(
        trilhaId,
        {
          dgt_todasareas:
            todasAreas
        }
      );

    const existentes =
      await this.dataverse
        .getTrilhaAreasFluxo(
          trilhaId
        );

    if (
      todasAreas
    ) {

      for (
        const registro of
        existentes
      ) {

        if (
          booleano(
            registro,
            'dgt_ativo',
            true
          )
        ) {

          await this.dataverse
            .atualizarTrilhaAreaFluxo(
              texto(
                registro,
                'dgt_trilhaareaid'
              ),
              {
                dgt_ativo:
                  false
              }
            );
        }
      }

      return;
    }

    for (
      const areaId of
      areaIds
    ) {

      const registro =
        existentes.find(
          item =>
            limparGuid(
              texto(
                item,
                '_dgt_area_value'
              )
            ) ===
            limparGuid(
              areaId
            )
        );

      if (
        registro
      ) {

        await this.dataverse
          .atualizarTrilhaAreaFluxo(
            texto(
              registro,
              'dgt_trilhaareaid'
            ),
            {
              dgt_ativo:
                true
            }
          );

      } else {

        await this.dataverse
          .criarTrilhaAreaFluxo(
            trilhaId,
            areaId,
            {
              dgt_name:
                'Área da trilha',

              dgt_ativo:
                true
            }
          );
      }
    }

    for (
      const registro of
      existentes
    ) {

      const areaId =
        texto(
          registro,
          '_dgt_area_value'
        );

      const permanece =
        areaIds.some(
          id =>
            limparGuid(
              id
            ) ===
            limparGuid(
              areaId
            )
        );

      if (
        !permanece &&
        booleano(
          registro,
          'dgt_ativo',
          true
        )
      ) {

        await this.dataverse
          .atualizarTrilhaAreaFluxo(
            texto(
              registro,
              'dgt_trilhaareaid'
            ),
            {
              dgt_ativo:
                false
            }
          );
      }
    }
  }

  public async trilhaVisivelParaAreas(
    trilha:
      ITrilhaAdmin,
    areasUsuario:
      string[]
  ): Promise<boolean> {

    if (
      trilha.todasAreas
    ) {
      return true;
    }

    const areasTrilha =
      await this.listarAreasTrilha(
        trilha.id
      );

    return areasTrilha.some(
      relacao =>
        relacao.ativa &&
        areasUsuario.some(
          areaId =>
            limparGuid(
              areaId
            ) ===
            limparGuid(
              relacao.areaId
            )
        )
    );
  }

  private validarTrilha(
    dados:
      INovaTrilha
  ): void {

    if (
      !dados.nome
        .trim()
    ) {
      throw new Error(
        'Informe o nome da trilha.'
      );
    }
  }
}
