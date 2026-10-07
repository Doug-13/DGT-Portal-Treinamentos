import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type OrigemAtribuicao =
  | 'Individual'
  | 'Grupo'
  | 'Função'
  | 'Reciclagem'
  | 'Revisão documental'
  | 'Mudança de função';

export interface IUsuarioAtribuicao {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface ITrilhaAtribuicao {
  id: string;
  nome: string;
  ativa: boolean;
}

// Valor especial de treinamentoId: atribui TODOS os treinamentos
// ativos da trilha informada, na ordem da trilha.
export const TODOS_TREINAMENTOS_TRILHA =
  '__todos_da_trilha__';

export interface IAtribuicaoManual {
  usuarioId: string;
  treinamentoId: string;
  trilhaId?: string;
  origem: OrigemAtribuicao;
  origemId?: string;
  dataLimite?: string;
  observacao?: string;
}

export interface IResultadoAtribuicao {
  sucesso: boolean;
  mensagem: string;
  usuarioTreinamentoId?: string;
  reutilizado?: boolean;
  criado?: boolean;
  liberado?: boolean;
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

export class AtribuicaoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async listarUsuarios():
    Promise<IUsuarioAtribuicao[]> {

    const registros =
      await this.dataverse
        .getUsuarios();

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_usuarioid'
          ),
          nome: texto(
            registro,
            'dgt_name',
            'Usuário'
          ),
          email: texto(
            registro,
            'dgt_email'
          ),
          ativo: booleano(
            registro,
            'dgt_ativo',
            true
          )
        })
      )
      .filter(
        item =>
          item.ativo
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async listarTrilhas():
    Promise<ITrilhaAtribuicao[]> {

    const registros =
      await this.dataverse
        .getTrilhasAdministrativas();

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_trilhaid'
          ),
          nome: texto(
            registro,
            'dgt_name',
            'Trilha'
          ),
          ativa: booleano(
            registro,
            'dgt_ativo',
            true
          )
        })
      )
      .filter(
        item =>
          item.ativa
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async atribuir(
    dados: IAtribuicaoManual
  ): Promise<IResultadoAtribuicao> {

    if (!dados.usuarioId) {
      throw new Error(
        'Selecione o usuário.'
      );
    }

    if (!dados.treinamentoId) {
      throw new Error(
        'Selecione o treinamento.'
      );
    }

    if (
      dados.treinamentoId ===
      TODOS_TREINAMENTOS_TRILHA
    ) {
      return this.atribuirTrilha(
        dados
      );
    }

    if (!dados.origem) {
      throw new Error(
        'Informe a origem da atribuição.'
      );
    }

    return this.dataverse
      .processarAtribuicao({
        UsuarioId:
          dados.usuarioId,
        TreinamentoId:
          dados.treinamentoId,
        TrilhaId:
          dados.trilhaId || '',
        Origem:
          dados.origem,
        OrigemId:
          dados.origemId || '',
        DataLimite:
          dados.dataLimite || '',
        Observacao:
          dados.observacao || ''
      });
  }

  // ============================================================
  // ATRIBUIR A TRILHA INTEIRA PARA UM USUÁRIO
  // ============================================================
  // Chama a Custom API dgt_ProcessarAtribuicao para cada
  // treinamento ativo da trilha, em ordem crescente de dgt_ordem.
  // A API já cuida de: duplicidade, reaproveitamento de conclusões
  // válidas e liberação respeitando a sequência da trilha (só o
  // primeiro treinamento pendente fica Disponível).
  // ============================================================

  public async atribuirTrilha(
    dados: IAtribuicaoManual
  ): Promise<IResultadoAtribuicao> {

    if (!dados.trilhaId) {
      throw new Error(
        'Selecione a trilha para atribuir todos os treinamentos dela.'
      );
    }

    const relacoes =
      (
        await this.dataverse
          .getTrilhaTreinamentosAdmin(
            dados.trilhaId
          )
      )
        .filter(
          registro =>
            booleano(
              registro,
              'dgt_ativo',
              true
            ) &&
            !!texto(
              registro,
              '_dgt_treinamento_value'
            )
        )
        .sort(
          (a, b) =>
            Number(
              texto(a, 'dgt_ordem', '0')
            ) -
            Number(
              texto(b, 'dgt_ordem', '0')
            )
        );

    if (relacoes.length === 0) {
      throw new Error(
        'Esta trilha não possui treinamentos ativos.'
      );
    }

    let criados = 0;
    let reaproveitados = 0;
    let existentes = 0;
    let liberados = 0;

    const falhas: string[] = [];

    for (const relacao of relacoes) {

      const treinamentoId =
        texto(
          relacao,
          '_dgt_treinamento_value'
        );

      const nomeTreinamento =
        texto(
          relacao,
          '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue',
          texto(
            relacao,
            'dgt_name',
            'Treinamento'
          )
        );

      // Data limite: a informada na tela prevalece; senão usa o
      // prazo (dias) configurado no treinamento dentro da trilha.
      let dataLimite =
        dados.dataLimite || '';

      const dias =
        Number(
          texto(
            relacao,
            'dgt_diasparaconclusao',
            '0'
          )
        );

      if (
        !dataLimite &&
        dias > 0
      ) {
        const limite =
          new Date();

        limite.setDate(
          limite.getDate() +
          dias
        );

        dataLimite =
          limite
            .toISOString()
            .substring(0, 10);
      }

      try {

        const retorno =
          await this.dataverse
            .processarAtribuicao({
              UsuarioId:
                dados.usuarioId,
              TreinamentoId:
                treinamentoId,
              TrilhaId:
                dados.trilhaId,
              Origem:
                dados.origem,
              OrigemId:
                dados.origemId ||
                dados.trilhaId,
              DataLimite:
                dataLimite,
              Observacao:
                dados.observacao ||
                'Atribuição manual da trilha completa.'
            });

        if (retorno.criado) {
          criados++;
        } else if (retorno.reutilizado) {
          reaproveitados++;
        } else {
          existentes++;
        }

        if (retorno.liberado) {
          liberados++;
        }

      } catch (e) {

        falhas.push(
          `${nomeTreinamento}: ${
            e instanceof Error
              ? e.message
              : 'erro desconhecido'
          }`
        );
      }
    }

    const partes: string[] = [
      `${relacoes.length} treinamento(s) da trilha processado(s)`,
      `${criados} atribuído(s)`,
      `${reaproveitados} reaproveitado(s) de conclusão válida`,
      `${existentes} já existia(m)`,
      `${liberados} liberado(s)`
    ];

    let mensagem =
      partes.join(' · ') + '.';

    if (falhas.length > 0) {
      mensagem +=
        ` Falhas: ${falhas.join(' | ')}`;
    }

    return {
      sucesso:
        falhas.length === 0,
      mensagem,
      criado:
        criados > 0,
      reutilizado:
        reaproveitados > 0,
      liberado:
        liberados > 0
    };
  }
}
