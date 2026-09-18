import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type StatusConformidade =
  | 'Concluído'
  | 'Pendente'
  | 'Vencido'
  | 'A vencer'
  | 'Bloqueado'
  | 'Em andamento'
  | 'Reprovado';

export interface IItemConformidade {
  id: string;
  usuario: string;
  treinamento: string;
  trilha: string;
  status: StatusConformidade;
  conclusao: string;
  validade: string;
  diasParaVencer?: number;
  nota?: number;
  origem: string;
}

export interface IResumoConformidade {
  total: number;
  concluidos: number;
  pendentes: number;
  vencidos: number;
  aVencer: number;
  bloqueados: number;
  emAndamento: number;
  reprovados: number;
  conformidadePercentual: number;
}

export interface IConformidadeDados {
  itens: IItemConformidade[];
  resumo: IResumoConformidade;
}

const texto = (
  registro: IDataverseRecord,
  chaves: string[],
  padrao = ''
): string => {

  for (const chave of chaves) {

    const valor =
      registro[chave];

    if (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ''
    ) {
      return String(valor);
    }
  }

  return padrao;
};

const numero = (
  registro: IDataverseRecord,
  chaves: string[],
  padrao = 0
): number => {

  for (const chave of chaves) {

    const valor =
      registro[chave];

    if (
      valor !== undefined &&
      valor !== null &&
      valor !== ''
    ) {
      const n =
        Number(valor);

      if (
        !Number.isNaN(n)
      ) {
        return n;
      }
    }
  }

  return padrao;
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(
    registro,
    [
      `${campo}@OData.Community.Display.V1.FormattedValue`
    ],
    ''
  );

const calcularDias = (
  valor: string
): number | undefined => {

  if (!valor) {
    return undefined;
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return undefined;
  }

  const hoje =
    new Date();

  const inicioHoje =
    new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    );

  const inicioValidade =
    new Date(
      data.getFullYear(),
      data.getMonth(),
      data.getDate()
    );

  return Math.ceil(
    (
      inicioValidade.getTime() -
      inicioHoje.getTime()
    ) /
    86400000
  );
};

const status = (
  registro: IDataverseRecord
): StatusConformidade => {

  const statusFormatado =
    formatado(
      registro,
      'dgt_status'
    );

  const statusCru =
    texto(
      registro,
      [
        'dgt_status'
      ],
      ''
    );

  const valor =
    (
      statusFormatado ||
      statusCru
    )
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      );

  const validade =
    texto(
      registro,
      [
        'dgt_datavalidade'
      ],
      ''
    );

  const dias =
    calcularDias(
      validade
    );

  if (
    dias !== undefined &&
    dias < 0
  ) {
    return 'Vencido';
  }

  if (
    dias !== undefined &&
    dias >= 0 &&
    dias <= 30
  ) {
    return 'A vencer';
  }

  if (
    valor.indexOf(
      'conclu'
    ) >= 0 ||
    valor.indexOf(
      'aprov'
    ) >= 0
  ) {
    return 'Concluído';
  }

  if (
    valor.indexOf(
      'reprov'
    ) >= 0
  ) {
    return 'Reprovado';
  }

  if (
    valor.indexOf(
      'bloque'
    ) >= 0
  ) {
    return 'Bloqueado';
  }

  if (
    valor.indexOf(
      'andamento'
    ) >= 0 ||
    valor.indexOf(
      'iniciado'
    ) >= 0
  ) {
    return 'Em andamento';
  }

  return 'Pendente';
};

export class ConformidadeService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse:
      DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async carregar():
    Promise<IConformidadeDados> {

    const atribuicoes =
      await this.dataverse
        .getUsuarioTreinamentos();

    const itens:
      IItemConformidade[] =
      atribuicoes.map(
        (
          registro,
          indice
        ) => {

          const validade =
            texto(
              registro,
              [
                'dgt_datavalidade'
              ],
              ''
            );

          return {
            id:
              texto(
                registro,
                [
                  'dgt_usuariotreinamentoid'
                ],
                `registro-${indice}`
              ),

            usuario:
              texto(
                registro,
                [
                  '_dgt_usuario_value@OData.Community.Display.V1.FormattedValue',
                  'dgt_usuarioemail',
                  'dgt_email'
                ],
                'Usuário'
              ),

            treinamento:
              texto(
                registro,
                [
                  '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue'
                ],
                'Treinamento'
              ),

            trilha:
              texto(
                registro,
                [
                  '_dgt_trilha_value@OData.Community.Display.V1.FormattedValue'
                ],
                '-'
              ),

            status:
              status(
                registro
              ),

            conclusao:
              texto(
                registro,
                [
                  'dgt_dataconclusao'
                ],
                ''
              ),

            validade,

            diasParaVencer:
              calcularDias(
                validade
              ),

            nota:
              numero(
                registro,
                [
                  'dgt_nota'
                ],
                -1
              ) >= 0
                ? numero(
                    registro,
                    [
                      'dgt_nota'
                    ],
                    0
                  )
                : undefined,

            origem:
              formatado(
                registro,
                'dgt_origem'
              ) ||
              texto(
                registro,
                [
                  'dgt_origem'
                ],
                '-'
              )
          };
        }
      );

    const resumo =
      this.calcularResumo(
        itens
      );

    return {
      itens,
      resumo
    };
  }

  private calcularResumo(
    itens:
      IItemConformidade[]
  ): IResumoConformidade {

    const total =
      itens.length;

    const concluidos =
      itens.filter(
        x =>
          x.status ===
          'Concluído'
      ).length;

    const vencidos =
      itens.filter(
        x =>
          x.status ===
          'Vencido'
      ).length;

    const aVencer =
      itens.filter(
        x =>
          x.status ===
          'A vencer'
      ).length;

    const bloqueados =
      itens.filter(
        x =>
          x.status ===
          'Bloqueado'
      ).length;

    const emAndamento =
      itens.filter(
        x =>
          x.status ===
          'Em andamento'
      ).length;

    const reprovados =
      itens.filter(
        x =>
          x.status ===
          'Reprovado'
      ).length;

    const pendentes =
      total -
      concluidos -
      vencidos -
      aVencer -
      bloqueados -
      emAndamento -
      reprovados;

    const conformidadePercentual =
      total > 0
        ? Math.round(
            (
              concluidos /
              total
            ) *
            100
          )
        : 0;

    return {
      total,
      concluidos,
      pendentes:
        Math.max(
          pendentes,
          0
        ),
      vencidos,
      aVencer,
      bloqueados,
      emAndamento,
      reprovados,
      conformidadePercentual
    };
  }
}
