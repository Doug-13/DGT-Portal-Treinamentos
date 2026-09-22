export type TipoConteudoImport =
  | 'Texto'
  | 'Video'
  | 'Material'
  | 'Link'
  | 'Imagem'
  | 'Destaque'
  | 'Cards'
  | 'PerguntaRapida';

export type TipoQuestaoImport =
  | 'EscolhaUnica'
  | 'MultiplaEscolha'
  | 'VerdadeiroFalso'
  | 'SimNao';

export interface IAlternativaImport {
  texto: string;
  correta: boolean;
}

export interface IPerguntaRapidaImport {
  enunciado: string;
  tipo: TipoQuestaoImport;
  exigirAcerto?: boolean;
  mostrarFeedback?: boolean;
  feedbackAcerto?: string;
  feedbackErro?: string;
  alternativas: IAlternativaImport[];
}

export interface ICardModuloImport {
  numero?:
    string;

  titulo:
    string;

  descricao:
    string;
}
export interface IConteudoModuloImport {
  tipo: TipoConteudoImport;
  titulo?: string;
  conteudo?: string;
  conteudoHtml?: string;
  url?: string;
  obrigatorio?: boolean;
  pergunta?: IPerguntaRapidaImport;
  cards?:
    ICardModuloImport[];
}

export interface IModuloImport {
  titulo: string;
  descricao?: string;
  ordem: number;
  duracaoMin?: number;
  obrigatorio?: boolean;
  conteudos: IConteudoModuloImport[];
}

export interface IQuestaoAvaliacaoImport {
  tipo: TipoQuestaoImport;
  enunciado: string;
  peso?: number;
  alternativas: IAlternativaImport[];
}

export interface IAvaliacaoImport {
  nome: string;
  notaMinima: number;
  quantidadeQuestoes: number;
  tentativas: number;
  questoes: IQuestaoAvaliacaoImport[];
}

export interface ITreinamentoImport {
  nome: string;
  descricao?: string;
  area: string;
  tipo: string;
  cargaHorariaMin: number;
  notaMinima: number;
  validadeMeses: number;
}

export interface IDgtTrainingJsonV1 {
  versao: '1.0';
  treinamento: ITreinamentoImport;
  modulos: IModuloImport[];
  avaliacao?: IAvaliacaoImport;
}

export interface IResultadoValidacaoImport {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

const TIPOS_CONTEUDO:
  TipoConteudoImport[] = [
  'Texto',
  'Video',
  'Material',
  'Link',
  'Imagem',
  'Destaque',
  'Cards',
  'PerguntaRapida'
];

const TIPOS_QUESTAO:
  TipoQuestaoImport[] = [
  'EscolhaUnica',
  'MultiplaEscolha',
  'VerdadeiroFalso',
  'SimNao'
];

const validarAlternativas = (
  alternativas:
    IAlternativaImport[] | undefined,
  tipo:
    TipoQuestaoImport,
  contexto:
    string,
  erros:
    string[]
): void => {

  if (
    !alternativas ||
    alternativas.length <
      2
  ) {
    erros.push(
      `${contexto}: cadastre pelo menos duas alternativas.`
    );

    return;
  }

  const preenchidas =
    alternativas.filter(
      item =>
        !!item.texto?.trim()
    );

  if (
    preenchidas.length <
      2
  ) {
    erros.push(
      `${contexto}: existem alternativas sem texto.`
    );
  }

  const corretas =
    preenchidas.filter(
      item =>
        item.correta
    ).length;

  if (
    corretas ===
      0
  ) {
    erros.push(
      `${contexto}: marque pelo menos uma alternativa correta.`
    );
  }

  if (
    tipo !==
      'MultiplaEscolha' &&
    corretas !==
      1
  ) {
    erros.push(
      `${contexto}: este tipo exige exatamente uma alternativa correta.`
    );
  }
};

export const validarDgtTrainingJsonV1 =
  (
    dados:
      unknown
  ): {
    dados?: IDgtTrainingJsonV1;
    resultado: IResultadoValidacaoImport;
  } => {

    const erros:
      string[] = [];

    const avisos:
      string[] = [];

    if (
      !dados ||
      typeof dados !==
        'object'
    ) {
      return {
        resultado: {
          valido:
            false,

          erros: [
            'Arquivo JSON inválido.'
          ],

          avisos
        }
      };
    }

    const json =
      dados as
        Partial<IDgtTrainingJsonV1>;

    if (
      json.versao !==
        '1.0'
    ) {
      erros.push(
        'versao deve ser "1.0".'
      );
    }

    if (
      !json.treinamento
    ) {
      erros.push(
        'treinamento é obrigatório.'
      );
    } else {

      if (
        !json.treinamento.nome
          ?.trim()
      ) {
        erros.push(
          'treinamento.nome é obrigatório.'
        );
      }

      if (
        !json.treinamento.area
          ?.trim()
      ) {
        erros.push(
          'treinamento.area é obrigatório.'
        );
      }

      if (
        !json.treinamento.tipo
          ?.trim()
      ) {
        erros.push(
          'treinamento.tipo é obrigatório.'
        );
      }
    }

    if (
      !Array.isArray(
        json.modulos
      ) ||
      json.modulos.length ===
        0
    ) {
      erros.push(
        'Cadastre pelo menos um módulo.'
      );
    } else {

      json.modulos.forEach(
        (
          modulo,
          indiceModulo
        ) => {

          const prefixo =
            `Módulo ${indiceModulo + 1}`;

          if (
            !modulo.titulo
              ?.trim()
          ) {
            erros.push(
              `${prefixo}: título obrigatório.`
            );
          }

          if (
            !Array.isArray(
              modulo.conteudos
            )
          ) {
            erros.push(
              `${prefixo}: conteudos deve ser uma lista.`
            );

            return;
          }

          modulo.conteudos.forEach(
            (
              conteudo,
              indiceConteudo
            ) => {

              const contexto =
                `${prefixo}, conteúdo ${indiceConteudo + 1}`;

              if (
                TIPOS_CONTEUDO.indexOf(
                  conteudo.tipo
                ) ===
                -1
              ) {
                erros.push(
                  `${contexto}: tipo de conteúdo inválido.`
                );

                return;
              }

              if (
                conteudo.tipo ===
                  'Texto' &&
                !conteudo.conteudo
                  ?.trim() &&
                !conteudo.conteudoHtml
                  ?.trim()
              ) {
                erros.push(
                  `${contexto}: informe conteudo ou conteudoHtml.`
                );
              }

              if (
                (
                  conteudo.tipo ===
                    'Video' ||
                  conteudo.tipo ===
                    'Material' ||
                  conteudo.tipo ===
                    'Link' ||
                  conteudo.tipo ===
                    'Imagem'
                ) &&
                !conteudo.url
                  ?.trim()
              ) {
                erros.push(
                  `${contexto}: URL obrigatória.`
                );
              }

              if (
                conteudo.tipo ===
                  'Cards'
              ) {

                if (
                  !Array.isArray(
                    conteudo.cards
                  ) ||
                  conteudo.cards.length <
                    1 ||
                  conteudo.cards.length >
                    3
                ) {
                  erros.push(
                    `${contexto}: o bloco Cards deve possuir de 1 a 3 cards.`
                  );

                  return;
                }

                const cardIncompleto =
                  conteudo.cards.some(
                    card =>
                      !card.titulo
                        ?.trim() ||
                      !card.descricao
                        ?.trim()
                  );

                if (
                  cardIncompleto
                ) {
                  erros.push(
                    `${contexto}: preencha título e descrição de todos os cards.`
                  );
                }
              }
              if (
                conteudo.tipo ===
                  'PerguntaRapida'
              ) {

                if (
                  !conteudo.pergunta
                ) {
                  erros.push(
                    `${contexto}: pergunta obrigatória.`
                  );

                  return;
                }

                if (
                  !conteudo.pergunta.enunciado
                    ?.trim()
                ) {
                  erros.push(
                    `${contexto}: enunciado obrigatório.`
                  );
                }

                if (
                  TIPOS_QUESTAO.indexOf(
                    conteudo.pergunta.tipo
                  ) ===
                  -1
                ) {
                  erros.push(
                    `${contexto}: tipo de pergunta inválido.`
                  );

                  return;
                }

                validarAlternativas(
                  conteudo.pergunta.alternativas,
                  conteudo.pergunta.tipo,
                  contexto,
                  erros
                );
              }
            }
          );
        }
      );
    }

    if (
      json.avaliacao
    ) {

      json.avaliacao.questoes
        ?.forEach(
          (
            questao,
            indice
          ) => {

            const contexto =
              `Avaliação, questão ${indice + 1}`;

            if (
              TIPOS_QUESTAO.indexOf(
                questao.tipo
              ) ===
              -1
            ) {
              erros.push(
                `${contexto}: tipo inválido.`
              );

              return;
            }

            if (
              !questao.enunciado
                ?.trim()
            ) {
              erros.push(
                `${contexto}: enunciado obrigatório.`
              );
            }

            validarAlternativas(
              questao.alternativas,
              questao.tipo,
              contexto,
              erros
            );
          }
        );
    } else {
      avisos.push(
        'Nenhuma avaliação final foi informada.'
      );
    }

    return {
      dados:
        erros.length ===
          0
          ? json as
              IDgtTrainingJsonV1
          : undefined,

      resultado: {
        valido:
          erros.length ===
          0,

        erros,

        avisos
      }
    };
  };

