import {
  DataverseService
} from './DataverseService';

export type TipoPerguntaRapida =
  | 'EscolhaUnica'
  | 'MultiplaEscolha'
  | 'VerdadeiroFalso'
  | 'SimNao';

export interface IAlternativaPerguntaRapida {
  id: string;
  texto: string;
  correta: boolean;
  ordem: number;
  ativa: boolean;
}

export interface IPerguntaRapidaModulo {
  id: string;
  conteudoModuloId: string;
  enunciado: string;
  tipo: TipoPerguntaRapida;
  exigirAcerto: boolean;
  mostrarFeedback: boolean;
  feedbackAcerto: string;
  feedbackErro: string;
  ativa: boolean;
  alternativas: IAlternativaPerguntaRapida[];
}

export interface INovaPerguntaRapidaModulo {
  conteudoModuloId: string;
  enunciado: string;
  tipo: TipoPerguntaRapida;
  exigirAcerto: boolean;
  mostrarFeedback: boolean;
  feedbackAcerto: string;
  feedbackErro: string;
  alternativas: {
    texto: string;
    correta: boolean;
  }[];
}

const TIPO_VALOR:
  Record<
    TipoPerguntaRapida,
    number
  > = {
  EscolhaUnica: 100000000,
  MultiplaEscolha: 100000001,
  VerdadeiroFalso: 100000002,
  SimNao: 100000003
};

export class ModuloPerguntaAdminService {

  public constructor(
    private readonly dataverse:
      DataverseService
  ) {}

  public async criar(
    dados:
      INovaPerguntaRapidaModulo
  ): Promise<void> {

    if (
      !dados.enunciado
        .trim()
    ) {
      throw new Error(
        'Informe o enunciado da pergunta.'
      );
    }

    const alternativas =
      dados.alternativas
        .filter(
          item =>
            !!item.texto.trim()
        );

    if (
      alternativas.length <
        2
    ) {
      throw new Error(
        'Cadastre pelo menos duas alternativas.'
      );
    }

    const corretas =
      alternativas.filter(
        item =>
          item.correta
      ).length;

    if (
      corretas ===
        0
    ) {
      throw new Error(
        'Marque pelo menos uma alternativa correta.'
      );
    }

    if (
      dados.tipo !==
        'MultiplaEscolha' &&
      corretas !==
        1
    ) {
      throw new Error(
        'Este tipo de pergunta deve possuir exatamente uma resposta correta.'
      );
    }

    const registro =
      await this.dataverse
        .criarPerguntaRapidaModulo(
          dados.conteudoModuloId,
          {
            dgt_name:
              dados.enunciado
                .substring(
                  0,
                  180
                ),

            dgt_enunciado:
              dados.enunciado
                .trim(),

            dgt_tipopergunta:
              TIPO_VALOR[
                dados.tipo
              ],

            dgt_exigiracerto:
              dados.exigirAcerto,

            dgt_mostrarfeedback:
              dados.mostrarFeedback,

            dgt_feedbackacerto:
              dados.feedbackAcerto
                .trim(),

            dgt_feedbackerro:
              dados.feedbackErro
                .trim(),

            dgt_ativo:
              true
          }
        );

    const perguntaId =
      String(
        registro
          .dgt_moduloperguntaid ||
        ''
      );

    if (
      !perguntaId
    ) {
      throw new Error(
        'A pergunta foi criada, mas o identificador não foi retornado.'
      );
    }

    for (
      let indice = 0;
      indice <
        alternativas.length;
      indice += 1
    ) {
      const alternativa =
        alternativas[
          indice
        ];

      await this.dataverse
        .criarAlternativaPerguntaRapidaModulo(
          perguntaId,
          {
            dgt_name:
              alternativa.texto
                .substring(
                  0,
                  180
                ),

            dgt_texto:
              alternativa.texto
                .trim(),

            dgt_correta:
              alternativa.correta,

            dgt_ordem:
              indice +
              1,

            dgt_ativo:
              true
          }
        );
    }
  }
}
