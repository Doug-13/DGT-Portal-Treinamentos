import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

// ============================================================
// HISTÓRICO DO TREINAMENTO
//
// Lê os eventos gravados em dgt_auditorianegocio pelo plugin
// AuditarTreinamentoPlugin (servidor):
//
//   dgt_entidade   = 'dgt_treinamento'
//   dgt_registroid = id do treinamento (minúsculo, sem chaves)
//   dgt_dadosnovos = JSON { evento, tabela, tabelaRotulo,
//                           registroId, registroNome, campos[] }
//
// Cobre o próprio treinamento e toda a sua estrutura: módulos,
// conteúdos, perguntas dos módulos, avaliação, questões,
// alternativas, documentos vinculados e trilhas.
//
// Somente leitura. Regra do projeto: NUNCA apagar histórico.
// ============================================================

export const ENTIDADE_HISTORICO_TREINAMENTO =
  'dgt_treinamento';

export type TipoEventoTreinamento =
  | 'CRIACAO'
  | 'ALTERACAO'
  | 'EXCLUSAO'
  | 'OUTRO';

export interface IAlteracaoCampo {
  campo: string;
  rotulo: string;
  anterior: string;
  novo: string;
}

export interface IEventoTreinamento {
  id: string;
  data: Date | undefined;
  titulo: string;
  descricao: string;
  tipo: TipoEventoTreinamento;
  tabela: string;
  tabelaRotulo: string;
  registroNome: string;
  usuario: string;
  origem: string;
  registradoPeloServidor: boolean;
  alteracoes: IAlteracaoCampo[];
}

interface ICampoJson {
  campo?: string;
  rotulo?: string;
  anterior?: string;
  novo?: string;
}

interface IDadosJson {
  evento?: string;
  tabela?: string;
  tabelaRotulo?: string;
  registroNome?: string;
  usuarioNome?: string;
  campos?: ICampoJson[];
}

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];

  return valor === undefined || valor === null
    ? ''
    : String(valor);
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(
    registro,
    `${campo}@OData.Community.Display.V1.FormattedValue`
  );

const lerJson = (
  valor: string
): IDadosJson => {

  if (!valor) {
    return {};
  }

  try {
    const obj = JSON.parse(valor);

    return obj && typeof obj === 'object'
      ? obj as IDadosJson
      : {};

  } catch {
    // JSON truncado ou gravado por outra origem.
    return {};
  }
};

const tipoEvento = (
  evento: string
): TipoEventoTreinamento => {

  const e = (evento || '').toUpperCase();

  if (e === 'CRIACAO' || e === 'CREATE') {
    return 'CRIACAO';
  }

  if (e === 'ALTERACAO' || e === 'UPDATE') {
    return 'ALTERACAO';
  }

  if (e === 'EXCLUSAO' || e === 'DELETE') {
    return 'EXCLUSAO';
  }

  return 'OUTRO';
};

export class TreinamentoHistoricoService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async listar(
    treinamentoId: string
  ): Promise<IEventoTreinamento[]> {

    if (!treinamentoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getAuditoriaNegocioPorRegistro(
          ENTIDADE_HISTORICO_TREINAMENTO,
          treinamentoId
        );

    return registros
      .map(
        registro => {

          const novos =
            lerJson(
              texto(
                registro,
                'dgt_dadosnovos'
              )
            );

          const dataTexto =
            texto(
              registro,
              'dgt_dataevento'
            ) ||
            texto(
              registro,
              'createdon'
            );

          const data =
            dataTexto
              ? new Date(dataTexto)
              : undefined;

          const origem =
            texto(
              registro,
              'dgt_origem'
            );

          const usuario =
            formatado(
              registro,
              '_dgt_usuario_value'
            ) ||
            novos.usuarioNome ||
            formatado(
              registro,
              '_createdby_value'
            ) ||
            'Não identificado';

          const alteracoes =
            (novos.campos || [])
              .map(
                campo => ({
                  campo:
                    campo.campo || '',

                  rotulo:
                    campo.rotulo ||
                    campo.campo ||
                    'Campo',

                  anterior:
                    campo.anterior ?? '',

                  novo:
                    campo.novo ?? ''
                })
              );

          return {
            id:
              texto(
                registro,
                'dgt_auditorianegocioid'
              ),

            data:
              data &&
              !isNaN(
                data.getTime()
              )
                ? data
                : undefined,

            titulo:
              texto(
                registro,
                'dgt_name'
              ) ||
              'Evento',

            descricao:
              texto(
                registro,
                'dgt_descricao'
              ),

            tipo:
              tipoEvento(
                novos.evento || ''
              ),

            tabela:
              novos.tabela || '',

            tabelaRotulo:
              novos.tabelaRotulo ||
              novos.tabela ||
              '',

            registroNome:
              novos.registroNome || '',

            usuario,

            origem,

            registradoPeloServidor:
              origem
                .toLowerCase()
                .indexOf(
                  'plugin'
                ) >= 0,

            alteracoes
          };
        }
      )
      .sort(
        (a, b) =>
          (b.data?.getTime() || 0) -
          (a.data?.getTime() || 0)
      );
  }
}
