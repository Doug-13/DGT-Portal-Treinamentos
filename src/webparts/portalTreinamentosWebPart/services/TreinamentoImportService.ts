import {
  DataverseService
} from './DataverseService';

import {
  AreaAdminService
} from './AreaAdminService';

import {
  TreinamentoAdminService,
  TipoTreinamentoAdmin
} from './TreinamentoAdminService';

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

import {
  AvaliacaoAdminService,
  TipoQuestaoCriacao
} from './AvaliacaoAdminService';

import {
  IDgtTrainingJsonV1,
  IConteudoModuloImport,
  TipoQuestaoImport
} from './TreinamentoImportValidator';

export interface IResultadoImportacaoTreinamento {
  treinamentoId:
    string;

  treinamentoCodigo:
    string;

  modulosCriados:
    number;

  conteudosCriados:
    number;

  perguntasRapidasCriadas:
    number;

  avaliacoesCriadas:
    number;

  questoesCriadas:
    number;
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

const mapearTipoConteudo =
  (
    tipo:
      IConteudoModuloImport['tipo']
  ): TipoConteudoModulo => {

    switch (
      tipo
    ) {
      case 'Video':
        return 'Vídeo';

      case 'PerguntaRapida':
        return 'Pergunta rápida';

      default:
        return tipo as
          TipoConteudoModulo;
    }
  };

const mapearTipoPergunta =
  (
    tipo:
      TipoQuestaoImport
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
      TipoQuestaoImport
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

export class TreinamentoImportService {

  private readonly areaService:
    AreaAdminService;

  private readonly treinamentoService:
    TreinamentoAdminService;

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

    this.areaService =
      new AreaAdminService(
        dataverse
      );

    this.treinamentoService =
      new TreinamentoAdminService(
        dataverse
      );

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

  public async importar(
    dados:
      IDgtTrainingJsonV1
  ): Promise<
    IResultadoImportacaoTreinamento
  > {

    const areas =
      await this.areaService
        .listarAreas();

    const area =
      areas.find(
        item =>
          item.ativa &&
          item.sigla
            .trim()
            .toUpperCase() ===
          dados.treinamento.area
            .trim()
            .toUpperCase()
      );

    if (
      !area
    ) {
      throw new Error(
        `Área "${dados.treinamento.area}" não encontrada ou inativa.`
      );
    }

    const tipo =
      dados.treinamento.tipo
        .trim()
        .toUpperCase() as
        TipoTreinamentoAdmin;

    const treinamento =
      await this.treinamentoService
        .criar({
          nome:
            dados.treinamento.nome,

          codigo:
            '',

          descricao:
            dados.treinamento.descricao ||
            '',

          cargaHorariaMin:
            dados.treinamento.cargaHorariaMin,

          notaMinima:
            dados.treinamento.notaMinima,

          validadeMeses:
            dados.treinamento.validadeMeses,

          ativo:
            true,

          imagemUrl:
            '',

          areaId:
            area.id,

          tipoTreinamento:
            tipo
        });

    let modulosCriados =
      0;

    let conteudosCriados =
      0;

    let perguntasRapidasCriadas =
      0;

    for (
      const moduloImport of
      dados.modulos
    ) {

      await this.moduloService
        .criar({
          treinamentoId:
            treinamento.id,

          titulo:
            moduloImport.titulo,

          descricao:
            moduloImport.descricao ||
            '',

          ordem:
            moduloImport.ordem,

          duracaoMin:
            moduloImport.duracaoMin ||
            0,

          tipoModulo:
            'Página',

          obrigatorio:
            moduloImport.obrigatorio ??
            true,

          ativo:
            true,

          urlConteudo:
            ''
        });

      modulosCriados +=
        1;

      await aguardar(
        250
      );

      const modulos =
        await this.moduloService
          .listarPorTreinamento(
            treinamento.id
          );

      const moduloCriado =
        modulos.find(
          item =>
            item.ordem ===
              moduloImport.ordem &&
            item.titulo
              .trim()
              .toLowerCase() ===
            moduloImport.titulo
              .trim()
              .toLowerCase()
        );

      if (
        !moduloCriado
      ) {
        throw new Error(
          `Módulo "${moduloImport.titulo}" foi criado, mas não foi localizado para importar os conteúdos.`
        );
      }

      for (
        let indiceConteudo = 0;
        indiceConteudo <
          moduloImport.conteudos.length;
        indiceConteudo += 1
      ) {

        const conteudoImport =
          moduloImport.conteudos[
            indiceConteudo
          ];

        const tipoConteudo =
          mapearTipoConteudo(
            conteudoImport.tipo
          );

        const textoConteudo =
          conteudoImport.conteudoHtml ||
          conteudoImport.conteudo ||
          '';

        await this.conteudoService
          .criar({
            moduloId:
              moduloCriado.id,

            tipo:
              tipoConteudo,

            titulo:
              conteudoImport.titulo ||
              '',

            conteudo:
              textoConteudo,

            url:
              conteudoImport.url ||
              '',

            ordem:
              indiceConteudo +
              1,

            obrigatorio:
              conteudoImport.obrigatorio ??
              true,

            ativo:
              true
          });

        conteudosCriados +=
          1;

        if (
          conteudoImport.tipo ===
            'PerguntaRapida' &&
          conteudoImport.pergunta
        ) {

          await aguardar(
            200
          );

          const conteudos =
            await this.conteudoService
              .listar(
                moduloCriado.id
              );

          const conteudoCriado =
            conteudos.find(
              item =>
                item.ordem ===
                  indiceConteudo +
                  1 &&
                item.tipo ===
                  'Pergunta rápida'
            );

          if (
            !conteudoCriado
          ) {
            throw new Error(
              `A pergunta rápida do módulo "${moduloImport.titulo}" não pôde ser vinculada ao bloco criado.`
            );
          }

          await this.perguntaService
            .criar({
              conteudoModuloId:
                conteudoCriado.id,

              enunciado:
                conteudoImport
                  .pergunta
                  .enunciado,

              tipo:
                mapearTipoPergunta(
                  conteudoImport
                    .pergunta
                    .tipo
                ),

              exigirAcerto:
                conteudoImport
                  .pergunta
                  .exigirAcerto ??
                true,

              mostrarFeedback:
                conteudoImport
                  .pergunta
                  .mostrarFeedback ??
                true,

              feedbackAcerto:
                conteudoImport
                  .pergunta
                  .feedbackAcerto ||
                'Correto.',

              feedbackErro:
                conteudoImport
                  .pergunta
                  .feedbackErro ||
                'Revise o conteúdo anterior.',

              alternativas:
                conteudoImport
                  .pergunta
                  .alternativas
            });

          perguntasRapidasCriadas +=
            1;
        }
      }
    }

    let avaliacoesCriadas =
      0;

    let questoesCriadas =
      0;

    if (
      dados.avaliacao
    ) {

      await this.avaliacaoService
        .criarAvaliacao({
          treinamentoId:
            treinamento.id,

          nome:
            dados.avaliacao.nome,

          descricao:
            '',

          notaMinima:
            dados.avaliacao.notaMinima,

          quantidadeQuestoes:
            dados.avaliacao.quantidadeQuestoes,

          tentativasPermitidas:
            dados.avaliacao.tentativas,

          tempoLimiteMin:
            0,

          sortearQuestoes:
            true,

          embaralharQuestoes:
            true,

          embaralharAlternativas:
            true,

          mostrarResultado:
            true,

          mostrarRespostasCorretas:
            false,

          ativa:
            true
        });

      avaliacoesCriadas +=
        1;

      await aguardar(
        250
      );

      const avaliacoes =
        await this.avaliacaoService
          .listarAvaliacoes(
            treinamento.id
          );

      const avaliacao =
        avaliacoes.find(
          item =>
            item.nome
              .trim()
              .toLowerCase() ===
            dados.avaliacao
              ?.nome
              .trim()
              .toLowerCase()
        );

      if (
        !avaliacao
      ) {
        throw new Error(
          'A avaliação foi criada, mas não foi localizada para importar as questões.'
        );
      }

      for (
        let indice = 0;
        indice <
          dados.avaliacao.questoes.length;
        indice += 1
      ) {

        const questao =
          dados.avaliacao.questoes[
            indice
          ];

        await this.avaliacaoService
          .criarQuestaoCompleta({
            avaliacaoId:
              avaliacao.id,

            enunciado:
              questao.enunciado,

            ordem:
              indice +
              1,

            peso:
              questao.peso ||
              1,

            tipo:
              mapearTipoAvaliacao(
                questao.tipo
              ),

            alternativas:
              questao.alternativas
          });

        questoesCriadas +=
          1;
      }
    }

    return {
      treinamentoId:
        treinamento.id,

      treinamentoCodigo:
        treinamento.codigo,

      modulosCriados,
      conteudosCriados,
      perguntasRapidasCriadas,
      avaliacoesCriadas,
      questoesCriadas
    };
  }
}
