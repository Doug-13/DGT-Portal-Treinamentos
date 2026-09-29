import {
  DataverseService
} from './DataverseService';

import {
  TipoQuestaoCriacao
} from './AvaliacaoAdminService';

// ============================================================
// GERAÇÃO DE QUESTÕES COM IA (Claude)
//
// Chama a Custom API dgt_GerarQuestoesIA. O plugin no servidor
// lê o conteúdo dos módulos do treinamento, chama o Claude e
// devolve uma PRÉVIA das questões. Nada é gravado aqui: as
// questões aprovadas na tela são gravadas pelo fluxo normal
// (criarQuestaoCompleta).
// ============================================================

export interface IAlternativaGeradaIA {
  texto: string;
  correta: boolean;
}

export interface IQuestaoGeradaIA {
  // Identificador local (só na tela), para seleção e edição.
  chave: string;
  enunciado: string;
  tipo: TipoQuestaoCriacao;
  alternativas: IAlternativaGeradaIA[];
  explicacao: string;
  modulo: string;
}

export interface IParametrosGeracaoIA {
  treinamentoId: string;
  avaliacaoId?: string;
  quantidade: number;
  instrucoes?: string;
}

export interface IResultadoGeracaoIA {
  questoes: IQuestaoGeradaIA[];
  avisos: string[];
  modelo: string;
  modulosLidos: number;
  tokensEntrada: number;
  tokensSaida: number;
}

const TIPOS_VALIDOS: TipoQuestaoCriacao[] = [
  'Escolha única',
  'Múltipla escolha',
  'Verdadeiro/Falso'
];

const comoTexto = (
  valor: unknown
): string =>
  valor === undefined || valor === null
    ? ''
    : String(valor).trim();

const comoNumero = (
  valor: unknown
): number => {
  const numero = Number(valor);

  return isFinite(numero)
    ? numero
    : 0;
};

const comoLista = (
  valor: unknown
): unknown[] =>
  Array.isArray(valor)
    ? valor
    : [];

export class QuestaoIAService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  public async gerar(
    parametros: IParametrosGeracaoIA
  ): Promise<IResultadoGeracaoIA> {

    if (!parametros.treinamentoId) {
      throw new Error(
        'Selecione o treinamento antes de gerar as questões.'
      );
    }

    const resultado =
      await this.dataverse
        .gerarQuestoesIA({
          treinamentoId:
            parametros.treinamentoId
              .replace(/[{}]/g, '')
              .trim(),

          avaliacaoId:
            (parametros.avaliacaoId || '')
              .replace(/[{}]/g, '')
              .trim(),

          quantidade:
            Math.max(
              1,
              Math.min(
                20,
                Math.round(
                  parametros.quantidade || 10
                )
              )
            ),

          instrucoes:
            (parametros.instrucoes || '').trim()
        });

    const carimbo =
      Date.now();

    const questoes =
      comoLista(
        resultado.questoes
      )
        .map(
          (item, indice): IQuestaoGeradaIA => {

            const registro =
              (item || {}) as Record<string, unknown>;

            const tipoTexto =
              comoTexto(
                registro.tipo
              );

            const tipo =
              (TIPOS_VALIDOS.indexOf(
                tipoTexto as TipoQuestaoCriacao
              ) >= 0
                ? tipoTexto
                : 'Escolha única') as TipoQuestaoCriacao;

            return {
              chave:
                `ia-${carimbo}-${indice}`,

              enunciado:
                comoTexto(
                  registro.enunciado
                ),

              tipo,

              alternativas:
                comoLista(
                  registro.alternativas
                )
                  .map(
                    alternativa => {
                      const a =
                        (alternativa || {}) as Record<string, unknown>;

                      return {
                        texto:
                          comoTexto(a.texto),

                        correta:
                          a.correta === true
                      };
                    }
                  )
                  .filter(
                    a =>
                      !!a.texto
                  ),

              explicacao:
                comoTexto(
                  registro.explicacao
                ),

              modulo:
                comoTexto(
                  registro.modulo
                )
            };
          }
        )
        .filter(
          q =>
            !!q.enunciado &&
            q.alternativas.length >= 2
        );

    return {
      questoes,

      avisos:
        comoLista(
          resultado.avisos
        )
          .map(comoTexto)
          .filter(
            aviso =>
              !!aviso
          ),

      modelo:
        comoTexto(
          resultado.modelo
        ),

      modulosLidos:
        comoNumero(
          resultado.modulosLidos
        ),

      tokensEntrada:
        comoNumero(
          resultado.tokensEntrada
        ),

      tokensSaida:
        comoNumero(
          resultado.tokensSaida
        )
    };
  }
}
