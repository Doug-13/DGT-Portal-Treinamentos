import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  atribuicaoRemovida
} from '../utils/atribuicaoRemovida';

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
  // Id do dgt_usuario (usado no recorte por área)
  usuarioId?: string;
  usuarioEmail?: string;
  areas?: { id: string; nome: string }[];
  treinamento: string;
  trilha: string;
  status: StatusConformidade;
  conclusao: string;
  validade: string;
  diasParaVencer?: number;
  // Prazo para realizar o treinamento (dgt_datalimite).
  prazo: string;
  // Dias até o prazo (negativo = expirado). Só para o que não
  // foi concluído.
  diasParaPrazo?: number;
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

// Data só com dia ("2026-11-30", coluna Somente data do Dataverse)
// vira meio-dia LOCAL. Com new Date() direto ela seria lida como
// meia-noite UTC e, no Brasil, cairia no dia anterior.
export const lerDataConformidade = (
  valor?: string
): Date | undefined => {

  if (!valor) {
    return undefined;
  }

  const data =
    /^\d{4}-\d{2}-\d{2}$/.test(valor)
      ? new Date(`${valor}T12:00:00`)
      : new Date(valor);

  return Number.isNaN(data.getTime())
    ? undefined
    : data;
};

const calcularDias = (
  valor: string
): number | undefined => {

  if (!valor) {
    return undefined;
  }

  const data =
    lerDataConformidade(valor) ||
    new Date(NaN);

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

// Usado também para recalcular o resumo após o recorte por área.
export const calcularResumoConformidade = (
  itens:
    IItemConformidade[]
): IResumoConformidade => {

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

    // Atribuições removidas (desatribuídas, regra por área
    // desativada...) ficam fora: não têm prazo, não pendem e não
    // vencem. Continuam no Dataverse só como histórico.
    const atribuicoes =
      (
        await this.dataverse
          .getUsuarioTreinamentos()
      )
        .filter(
          registro =>
            !atribuicaoRemovida(registro)
        );

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

          const prazo =
            texto(
              registro,
              [
                'dgt_datalimite'
              ],
              ''
            );

          const statusRegistro =
            status(
              registro
            );

          // Concluído (ou com certificado a vencer/vencido, que só
          // existe depois da conclusão) não tem prazo em aberto.
          const prazoEmAberto =
            statusRegistro !== 'Concluído' &&
            statusRegistro !== 'A vencer' &&
            statusRegistro !== 'Vencido' &&
            !texto(registro, ['dgt_dataconclusao'], '');

          const diasParaPrazo =
            prazoEmAberto
              ? calcularDias(prazo)
              : undefined;

          // Prazo para realização expirado e treinamento não feito:
          // conta como VENCIDO (Pendente, Em andamento ou Bloqueado).
          // Reprovado continua Reprovado: é uma situação que pede
          // ação diferente (refazer a avaliação).
          const statusItem: StatusConformidade =
            diasParaPrazo !== undefined &&
            diasParaPrazo < 0 &&
            statusRegistro !== 'Reprovado'
              ? 'Vencido'
              : statusRegistro;

          return {
            id:
              texto(
                registro,
                [
                  'dgt_usuariotreinamentoid'
                ],
                `registro-${indice}`
              ),

            usuarioId:
              texto(
                registro,
                [
                  '_dgt_usuario_value'
                ],
                ''
              ),

            usuarioEmail: texto(registro, ['dgt_usuarioemail', 'dgt_email']),

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
              statusItem,

            prazo,

            diasParaPrazo,

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
      calcularResumoConformidade(
        itens
      );

    return {
      itens,
      resumo
    };
  }
}
