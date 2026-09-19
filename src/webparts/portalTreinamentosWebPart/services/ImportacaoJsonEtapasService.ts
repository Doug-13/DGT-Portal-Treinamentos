import {
  AvaliacaoAdminService,
  TipoQuestaoCriacao
} from './AvaliacaoAdminService';

import {
  DataverseService
} from './DataverseService';

import {
  ModuloAdminService
} from './ModuloAdminService';

import {
  ModuloConteudoAdminService,
  TipoConteudoModulo
} from './ModuloConteudoAdminService';

import {
  ModuloPerguntaAdminService,
  TipoPerguntaRapida
} from './ModuloPerguntaAdminService';

export type TipoQuestaoJson =
  | 'EscolhaUnica'
  | 'MultiplaEscolha'
  | 'VerdadeiroFalso'
  | 'SimNao';

export interface IAlternativaJson {
  texto:
    string;

  correta:
    boolean;
}

export interface IPerguntaRapidaJson {
  enunciado:
    string;

  tipo:
    TipoQuestaoJson;

  exigirAcerto?:
    boolean;

  mostrarFeedback?:
    boolean;

  feedbackAcerto?:
    string;

  feedbackErro?:
    string;

  alternativas:
    IAlternativaJson[];
}

export interface IConteudoModuloJson {
  tipo:
    | 'Texto'
    | 'Video'
    | 'Material'
    | 'Link'
    | 'Imagem'
    | 'Destaque'
    | 'PerguntaRapida';

  titulo?:
    string;

  conteudo?:
    string;

  conteudoHtml?:
    string;

  url?:
    string;

  obrigatorio?:
    boolean;

  pergunta?:
    IPerguntaRapidaJson;
}

export interface IModuloJson {
  titulo:
    string;

  descricao?:
    string;

  ordem:
    number;

  duracaoMin?:
    number;

  obrigatorio?:
    boolean;

  conteudos:
    IConteudoModuloJson[];
}

export interface IModuloImportJson {
  versao?:
    string;

  modulos:
    IModuloJson[];
}

export interface IQuestaoAvaliacaoJson {
  tipo:
    TipoQuestaoJson;

  enunciado:
    string;

  peso?:
    number;

  alternativas:
    IAlternativaJson[];
}

export interface IAvaliacaoJson {
  nome:
    string;

  descricao?:
    string;

  notaMinima:
    number;

  quantidadeQuestoes?:
    number;

  tentativas?:
    number;

  tempoLimiteMin?:
    number;

  sortearQuestoes?:
    boolean;

  embaralharQuestoes?:
    boolean;

  embaralharAlternativas?:
    boolean;

  mostrarResultado?:
    boolean;

  mostrarRespostasCorretas?:
    boolean;

  questoes:
    IQuestaoAvaliacaoJson[];
}

export interface IAvaliacaoImportJson {
  versao?:
    string;

  avaliacao:
    IAvaliacaoJson;
}

const aguardar =
  (
    ms:
      number
  ): Promise<void> =>
    new Promise(
      resolve =>
        window.setTimeout(
          resolve,
          ms
        )
    );

const lerArquivoJson =
  async (
    arquivo:
      File
  ): Promise<unknown> => {

    if (
      !arquivo.name
        .toLowerCase()
        .endsWith(
          '.json'
        )
    ) {
      throw new Error(
        'Selecione um arquivo .json.'
      );
    }

    const texto =
      await new Promise<string>(
        (
          resolve,
          reject
        ) => {

          const reader =
            new FileReader();

          reader.onload =
            () =>
              resolve(
                String(
                  reader.result ||
                  ''
                )
              );

          reader.onerror =
            () =>
              reject(
                new Error(
                  'Não foi possível ler o arquivo.'
                )
              );

          reader.readAsText(
            arquivo,
            'utf-8'
          );
        }
      );

    try {
      return JSON.parse(
        texto
      ) as unknown;
    } catch {
      throw new Error(
        'O arquivo não contém um JSON válido.'
      );
    }
  };

const textoObrigatorio =
  (
    valor:
      unknown,
    nome:
      string
  ): string => {

    if (
      typeof valor !==
        'string' ||
      !valor.trim()
    ) {
      throw new Error(
        `${nome} é obrigatório.`
      );
    }

    return valor.trim();
  };

const validarAlternativas =
  (
    alternativas:
      IAlternativaJson[],
    tipo:
      TipoQuestaoJson,
    contexto:
      string
  ): void => {

    if (
      !Array.isArray(
        alternativas
      ) ||
      alternativas.length <
        2
    ) {
      throw new Error(
        `${contexto}: cadastre pelo menos duas alternativas.`
      );
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
      throw new Error(
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
      throw new Error(
        `${contexto}: marque pelo menos uma resposta correta.`
      );
    }

    if (
      tipo !==
        'MultiplaEscolha' &&
      corretas !==
        1
    ) {
      throw new Error(
        `${contexto}: este tipo deve possuir exatamente uma resposta correta.`
      );
    }
  };

const mapearTipoConteudo =
  (
    tipo:
      IConteudoModuloJson['tipo']
  ): TipoConteudoModulo => {

    if (
      tipo ===
        'Video'
    ) {
      return 'Vídeo';
    }

    if (
      tipo ===
        'PerguntaRapida'
    ) {
      return 'Pergunta rápida';
    }

    return tipo as
      TipoConteudoModulo;
  };

const mapearTipoPerguntaRapida =
  (
    tipo:
      TipoQuestaoJson
  ): TipoPerguntaRapida => {

    switch (
      tipo
    ) {
      case 'MultiplaEscolha':
        return 'MultiplaEscolha';

      case 'VerdadeiroFalso':
        return 'VerdadeiroFalso';

      case 'SimNao':
        return 'SimNao';

      default:
        return 'EscolhaUnica';
    }
  };

const mapearTipoAvaliacao =
  (
    tipo:
      TipoQuestaoJson
  ): TipoQuestaoCriacao => {

    switch (
      tipo
    ) {
      case 'MultiplaEscolha':
        return 'Múltipla escolha';

      case 'VerdadeiroFalso':
        return 'Verdadeiro/Falso';

      case 'SimNao':
        return 'Sim/Não';

      default:
        return 'Escolha única';
    }
  };

export class ImportacaoJsonEtapasService {

  private readonly moduloService:
    ModuloAdminService;

  private readonly conteudoService:
    ModuloConteudoAdminService;

  private readonly perguntaService:
    ModuloPerguntaAdminService;

  private readonly avaliacaoService:
    AvaliacaoAdminService;

  public constructor(
    dataverse:
      DataverseService
  ) {

    this.moduloService =
      new ModuloAdminService(
        dataverse
      );

    this.conteudoService =
      new ModuloConteudoAdminService(
        dataverse
      );

    this.perguntaService =
      new ModuloPerguntaAdminService(
        dataverse
      );

    this.avaliacaoService =
      new AvaliacaoAdminService(
        dataverse
      );
  }

  public async importarModulosArquivo(
    treinamentoId:
      string,
    arquivo:
      File
  ): Promise<string> {

    if (
      !treinamentoId
    ) {
      throw new Error(
        'Treinamento não selecionado.'
      );
    }

    const bruto =
      await lerArquivoJson(
        arquivo
      );

    const dados =
      bruto as
        Partial<IModuloImportJson>;

    if (
      !Array.isArray(
        dados.modulos
      ) ||
      dados.modulos.length ===
        0
    ) {
      throw new Error(
        'O JSON precisa possuir a propriedade "modulos" com pelo menos um módulo.'
      );
    }

    let quantidadeModulos =
      0;

    let quantidadeConteudos =
      0;

    let quantidadePerguntas =
      0;

    for (
      let indiceModulo = 0;
      indiceModulo <
        dados.modulos.length;
      indiceModulo += 1
    ) {

      const modulo =
        dados.modulos[
          indiceModulo
        ];

      textoObrigatorio(
        modulo.titulo,
        `Módulo ${indiceModulo + 1}: titulo`
      );

      if (
        !Array.isArray(
          modulo.conteudos
        )
      ) {
        throw new Error(
          `Módulo ${indiceModulo + 1}: "conteudos" deve ser uma lista.`
        );
      }

      await this.moduloService
        .criar({
          treinamentoId,

          titulo:
            modulo.titulo.trim(),

          descricao:
            modulo.descricao?.trim() ||
            '',

          ordem:
            Number(
              modulo.ordem ||
              indiceModulo +
              1
            ),

          duracaoMin:
            Number(
              modulo.duracaoMin ||
              0
            ),

          tipoModulo:
            'Página',

          obrigatorio:
            modulo.obrigatorio ??
            true,

          ativo:
            true,

          urlConteudo:
            ''
        });

      quantidadeModulos +=
        1;

      await aguardar(
        250
      );

      const modulosAtuais =
        await this.moduloService
          .listarPorTreinamento(
            treinamentoId
          );

      const ordem =
        Number(
          modulo.ordem ||
          indiceModulo +
          1
        );

      const moduloCriado =
        modulosAtuais
          .slice()
          .reverse()
          .find(
            item =>
              item.ordem ===
                ordem &&
              item.titulo
                .trim()
                .toLowerCase() ===
              modulo.titulo
                .trim()
                .toLowerCase()
          );

      if (
        !moduloCriado
      ) {
        throw new Error(
          `O módulo "${modulo.titulo}" foi criado, mas não foi localizado para importar o conteúdo.`
        );
      }

      for (
        let indiceConteudo = 0;
        indiceConteudo <
          modulo.conteudos.length;
        indiceConteudo += 1
      ) {

        const conteudo =
          modulo.conteudos[
            indiceConteudo
          ];

        if (
          !conteudo.tipo
        ) {
          throw new Error(
            `Módulo "${modulo.titulo}", conteúdo ${indiceConteudo + 1}: tipo obrigatório.`
          );
        }

        if (
          conteudo.tipo ===
            'PerguntaRapida'
        ) {

          if (
            !conteudo.pergunta
          ) {
            throw new Error(
              `Módulo "${modulo.titulo}", conteúdo ${indiceConteudo + 1}: pergunta obrigatória.`
            );
          }

          textoObrigatorio(
            conteudo.pergunta.enunciado,
            `Módulo "${modulo.titulo}", pergunta rápida`
          );

          validarAlternativas(
            conteudo.pergunta.alternativas,
            conteudo.pergunta.tipo,
            `Módulo "${modulo.titulo}", pergunta rápida`
          );
        }

        await this.conteudoService
          .criar({
            moduloId:
              moduloCriado.id,

            tipo:
              mapearTipoConteudo(
                conteudo.tipo
              ),

            titulo:
              conteudo.titulo?.trim() ||
              '',

            conteudo:
              conteudo.conteudoHtml ||
              conteudo.conteudo ||
              '',

            url:
              conteudo.url?.trim() ||
              '',

            ordem:
              indiceConteudo +
              1,

            obrigatorio:
              conteudo.obrigatorio ??
              true,

            ativo:
              true
          });

        quantidadeConteudos +=
          1;

        if (
          conteudo.tipo ===
            'PerguntaRapida' &&
          conteudo.pergunta
        ) {

          await aguardar(
            180
          );

          const conteudosAtuais =
            await this.conteudoService
              .listar(
                moduloCriado.id
              );

          const blocoCriado =
            conteudosAtuais
              .slice()
              .reverse()
              .find(
                item =>
                  item.ordem ===
                    indiceConteudo +
                    1 &&
                  item.tipo ===
                    'Pergunta rápida'
              );

          if (
            !blocoCriado
          ) {
            throw new Error(
              `Não foi possível localizar o bloco de pergunta rápida do módulo "${modulo.titulo}".`
            );
          }

          await this.perguntaService
            .criar({
              conteudoModuloId:
                blocoCriado.id,

              enunciado:
                conteudo.pergunta
                  .enunciado,

              tipo:
                mapearTipoPerguntaRapida(
                  conteudo.pergunta
                    .tipo
                ),

              exigirAcerto:
                conteudo.pergunta
                  .exigirAcerto ??
                true,

              mostrarFeedback:
                conteudo.pergunta
                  .mostrarFeedback ??
                true,

              feedbackAcerto:
                conteudo.pergunta
                  .feedbackAcerto ||
                'Correto. Você pode continuar.',

              feedbackErro:
                conteudo.pergunta
                  .feedbackErro ||
                'Revise o conteúdo anterior e tente novamente.',

              alternativas:
                conteudo.pergunta
                  .alternativas
            });

          quantidadePerguntas +=
            1;
        }
      }
    }

    return (
      `${quantidadeModulos} módulo(s), ` +
      `${quantidadeConteudos} conteúdo(s) e ` +
      `${quantidadePerguntas} pergunta(s) rápida(s) importados.`
    );
  }

  public async importarAvaliacaoArquivo(
    treinamentoId:
      string,
    arquivo:
      File
  ): Promise<string> {

    if (
      !treinamentoId
    ) {
      throw new Error(
        'Treinamento não selecionado.'
      );
    }

    const bruto =
      await lerArquivoJson(
        arquivo
      );

    const dados =
      bruto as
        Partial<IAvaliacaoImportJson>;

    if (
      !dados.avaliacao
    ) {
      throw new Error(
        'O JSON precisa possuir a propriedade "avaliacao".'
      );
    }

    const avaliacao =
      dados.avaliacao;

    textoObrigatorio(
      avaliacao.nome,
      'avaliacao.nome'
    );

    if (
      !Array.isArray(
        avaliacao.questoes
      ) ||
      avaliacao.questoes.length ===
        0
    ) {
      throw new Error(
        'A avaliação precisa possuir pelo menos uma questão.'
      );
    }

    for (
      let indice = 0;
      indice <
        avaliacao.questoes.length;
      indice += 1
    ) {

      const questao =
        avaliacao.questoes[
          indice
        ];

      textoObrigatorio(
        questao.enunciado,
        `Questão ${indice + 1}: enunciado`
      );

      validarAlternativas(
        questao.alternativas,
        questao.tipo,
        `Questão ${indice + 1}`
      );
    }

    await this.avaliacaoService
      .criarAvaliacao({
        treinamentoId,

        nome:
          avaliacao.nome.trim(),

        descricao:
          avaliacao.descricao?.trim() ||
          '',

        notaMinima:
          Number(
            avaliacao.notaMinima
          ),

        quantidadeQuestoes:
          Number(
            avaliacao.quantidadeQuestoes ||
            avaliacao.questoes.length
          ),

        tentativasPermitidas:
          Number(
            avaliacao.tentativas ||
            3
          ),

        tempoLimiteMin:
          Number(
            avaliacao.tempoLimiteMin ||
            0
          ),

        sortearQuestoes:
          avaliacao.sortearQuestoes ??
          true,

        embaralharQuestoes:
          avaliacao.embaralharQuestoes ??
          true,

        embaralharAlternativas:
          avaliacao.embaralharAlternativas ??
          true,

        mostrarResultado:
          avaliacao.mostrarResultado ??
          true,

        mostrarRespostasCorretas:
          avaliacao.mostrarRespostasCorretas ??
          false,

        ativa:
          true
      });

    await aguardar(
      250
    );

    const avaliacoes =
      await this.avaliacaoService
        .listarAvaliacoes(
          treinamentoId
        );

    const avaliacaoCriada =
      avaliacoes
        .slice()
        .reverse()
        .find(
          item =>
            item.nome
              .trim()
              .toLowerCase() ===
            avaliacao.nome
              .trim()
              .toLowerCase()
        );

    if (
      !avaliacaoCriada
    ) {
      throw new Error(
        'A avaliação foi criada, mas não foi localizada para cadastrar as questões.'
      );
    }

    for (
      let indice = 0;
      indice <
        avaliacao.questoes.length;
      indice += 1
    ) {

      const questao =
        avaliacao.questoes[
          indice
        ];

      await this.avaliacaoService
        .criarQuestaoCompleta({
          avaliacaoId:
            avaliacaoCriada.id,

          enunciado:
            questao.enunciado,

          ordem:
            indice +
            1,

          peso:
            Number(
              questao.peso ||
              1
            ),

          tipo:
            mapearTipoAvaliacao(
              questao.tipo
            ),

          alternativas:
            questao.alternativas
        });
    }

    return (
      `Avaliação "${avaliacao.nome}" importada com ` +
      `${avaliacao.questoes.length} questão(ões).`
    );
  }
}
