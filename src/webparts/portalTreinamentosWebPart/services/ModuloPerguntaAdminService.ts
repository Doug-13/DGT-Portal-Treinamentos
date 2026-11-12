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
    // Na edição: id da alternativa já cadastrada (sem id = nova).
    id?: string;
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

// Valor da opção (dgt_tipopergunta) → tipo.
export const tipoPerguntaDoValor = (
  valor: unknown
): TipoPerguntaRapida => {
  const numero = Number(valor);
  const tipo =
    (Object.keys(TIPO_VALOR) as TipoPerguntaRapida[])
      .find(chave => TIPO_VALOR[chave] === numero);
  return tipo || 'EscolhaUnica';
};

export class ModuloPerguntaAdminService {

  public constructor(
    private readonly dataverse:
      DataverseService
  ) {}

  // Mesmas regras na criação e na edição. Devolve as alternativas
  // preenchidas (sem as vazias).
  private validar(
    dados:
      INovaPerguntaRapidaModulo
  ): INovaPerguntaRapidaModulo['alternativas'] {

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

    return alternativas;
  }

  public async criar(
    dados:
      INovaPerguntaRapidaModulo
  ): Promise<void> {

    const alternativas =
      this.validar(
        dados
      );

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

  // ----------------------------------------------------------
  // EDIÇÃO
  //   • atualiza enunciado, tipo e feedback (a regra "exigir acerto"
  //     é do módulo e não muda aqui);
  //   • alternativas: as que têm id são atualizadas, as sem id são
  //     criadas e as que saíram da lista ficam INATIVAS (não são
  //     apagadas: respostas já registradas continuam válidas).
  // ----------------------------------------------------------
  public async atualizar(
    perguntaId:
      string,
    dados:
      INovaPerguntaRapidaModulo
  ): Promise<void> {

    const id =
      perguntaId
        .replace(/[{}]/g, '')
        .trim()
        .toLowerCase();

    if (!id) {
      throw new Error(
        'Pergunta não informada.'
      );
    }

    const alternativas =
      this.validar(
        dados
      );

    await this.dataverse.atualizarRegistro(
      'dgt_modulopergunta',
      id,
      {
        dgt_name:
          dados.enunciado
            .trim()
            .substring(0, 180),

        dgt_enunciado:
          dados.enunciado
            .trim(),

        dgt_tipopergunta:
          TIPO_VALOR[
            dados.tipo
          ],

        dgt_mostrarfeedback:
          dados.mostrarFeedback,

        dgt_feedbackacerto:
          dados.feedbackAcerto
            .trim(),

        dgt_feedbackerro:
          dados.feedbackErro
            .trim()
      }
    );

    const existentes =
      await this.dataverse
        .getAlternativasPerguntaRapidaModulo(
          id
        );

    const idsExistentes =
      existentes.map(item =>
        String(item.dgt_moduloperguntaalternativaid || '')
          .replace(/[{}]/g, '')
          .toLowerCase()
      );

    const mantidos: string[] = [];

    for (let indice = 0; indice < alternativas.length; indice += 1) {

      const alternativa =
        alternativas[indice];

      const altId =
        String(alternativa.id || '')
          .replace(/[{}]/g, '')
          .toLowerCase();

      const campos = {
        dgt_name:
          alternativa.texto
            .trim()
            .substring(0, 180),

        dgt_texto:
          alternativa.texto
            .trim(),

        dgt_correta:
          alternativa.correta,

        dgt_ordem:
          indice + 1,

        dgt_ativo:
          true
      };

      if (altId && idsExistentes.indexOf(altId) >= 0) {
        await this.dataverse.atualizarRegistro(
          'dgt_moduloperguntaalternativa',
          altId,
          campos
        );
        mantidos.push(altId);
      } else {
        await this.dataverse
          .criarAlternativaPerguntaRapidaModulo(
            id,
            campos
          );
      }
    }

    // Alternativas removidas da lista: ficam inativas.
    for (const existente of idsExistentes) {
      if (existente && mantidos.indexOf(existente) < 0) {
        await this.dataverse.atualizarRegistro(
          'dgt_moduloperguntaalternativa',
          existente,
          {
            dgt_ativo:
              false
          }
        );
      }
    }
  }
}
