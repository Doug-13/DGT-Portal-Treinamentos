import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  ModuloAdminService
} from './ModuloAdminService';

import {
  AvaliacaoAdminService
} from './AvaliacaoAdminService';

// ============================================================
// CONTEÚDO DO TREINAMENTO EM CADA REVISÃO
//
// Os módulos e a avaliação são dados "vivos": uma nova revisão os
// altera. Para consultar revisões antigas (obsoletas), o portal
// registra uma fotografia do treinamento na revisão do documento de
// controle (dgt_documentorevisao.dgt_conteudojson):
//
//   • na PUBLICAÇÃO da revisão (o conteúdo que passou a valer);
//   • ao abrir uma NOVA revisão, se a vigente ainda não tiver o
//     registro (antes de qualquer alteração).
//
// Coluna criada por scripts/dataverse/criar-coluna-conteudo-revisao.ps1.
// Sem a coluna, nada quebra: só não há conteúdo para consultar.
// ============================================================

export const COLUNA_CONTEUDO_REVISAO = 'dgt_conteudojson';

// Limite da coluna (Texto multilinha).
const TAMANHO_MAXIMO = 1048576;

export interface IConteudoModuloRevisao {
  tipo: string;
  titulo: string;
  conteudo: string;
  url: string;
  obrigatorio: boolean;
}

export interface IModuloRevisao {
  titulo: string;
  descricao: string;
  tipo: string;
  duracaoMin: number;
  obrigatorio: boolean;
  urlConteudo: string;
  conteudos: IConteudoModuloRevisao[];
}

export interface IQuestaoRevisao {
  enunciado: string;
  peso: number;
  multiplasRespostas: boolean;
  alternativas: Array<{ texto: string; correta: boolean }>;
}

export interface IAvaliacaoRevisao {
  nome: string;
  descricao: string;
  notaMinima: number;
  quantidadeQuestoes: number;
  tentativasPermitidas: number;
  tempoLimiteMin: number;
  sortearQuestoes: boolean;
  questoes: IQuestaoRevisao[];
}

export interface IConteudoRevisaoTreinamento {
  versao: 1;
  revisao: string;
  registradoEm: string;
  // true = conteúdo dos módulos (textos) omitido por tamanho.
  resumido?: boolean;

  treinamento: {
    codigo: string;
    nome: string;
    descricao: string;
    cargaHorariaMin: number;
    notaMinima: number;
    validadeMeses: number;
    imagemUrl: string;
  };

  modulos: IModuloRevisao[];
  avaliacao?: IAvaliacaoRevisao;
}

const texto = (r: IDataverseRecord | undefined, campo: string): string => {
  if (!r) {
    return '';
  }
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v);
};

const numero = (r: IDataverseRecord | undefined, campo: string): number => {
  const v = Number(r ? r[campo] : 0);
  return isNaN(v) ? 0 : v;
};

const guid = (valor: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

// Coluna inexistente (script ainda não executado).
export const ehColunaConteudoInexistente = (erro: unknown): boolean => {
  const msg = erro instanceof Error ? erro.message : String(erro || '');
  return /dgt_conteudojson/i.test(msg) && /(could not find|not found|does not exist|não existe|invalid|0x80060888|0x80041103)/i.test(msg);
};

export class TreinamentoConteudoRevisaoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // Monta a fotografia do treinamento (como está agora).
  // ----------------------------------------------------------
  public async gerar(
    treinamentoId: string,
    revisao: string
  ): Promise<IConteudoRevisaoTreinamento> {

    const id = guid(treinamentoId);

    const lido =
      await this.dataverse.obterRegistro(
        'dgt_treinamento',
        id,
        ['dgt_codigo', 'dgt_name', 'dgt_descricao', 'dgt_cargahorariamin', 'dgt_notaminima', 'dgt_validademeses', 'dgt_imagemurl']
      );

    const t = lido ? lido.registro : undefined;

    // Módulos e conteúdos
    const modulos =
      (await new ModuloAdminService(this.dataverse).listarPorTreinamento(id))
        .filter(item => item.ativo)
        .sort((a, b) => a.ordem - b.ordem);

    const modulosRevisao: IModuloRevisao[] = [];

    for (const modulo of modulos) {
      let conteudos: IConteudoModuloRevisao[] = [];

      try {
        conteudos =
          (await this.dataverse.getConteudosModuloAdmin(modulo.id))
            .filter(r => r.dgt_ativo !== false)
            .map(r => ({
              tipo: texto(r, 'dgt_tipoconteudo@OData.Community.Display.V1.FormattedValue') || texto(r, 'dgt_tipoconteudo'),
              titulo: texto(r, 'dgt_titulo') || texto(r, 'dgt_name'),
              conteudo: texto(r, 'dgt_conteudo'),
              url: texto(r, 'dgt_url'),
              obrigatorio: r.dgt_obrigatorio !== false
            }));
      } catch (erro) {
        console.error('Conteúdos do módulo não lidos:', erro);
      }

      modulosRevisao.push({
        titulo: modulo.titulo,
        descricao: modulo.descricao,
        tipo: modulo.tipoModulo,
        duracaoMin: modulo.duracaoMin,
        obrigatorio: modulo.obrigatorio,
        urlConteudo: modulo.urlConteudo,
        conteudos
      });
    }

    // Avaliação ativa (ou a primeira), com questões e alternativas
    const servicoAvaliacao = new AvaliacaoAdminService(this.dataverse);
    const avaliacoes = await servicoAvaliacao.listarAvaliacoes(id);
    const avaliacao = avaliacoes.find(item => item.ativa) || avaliacoes[0];

    let avaliacaoRevisao: IAvaliacaoRevisao | undefined;

    if (avaliacao) {
      const questoes =
        (await servicoAvaliacao.listarQuestoes(avaliacao.id))
          .filter(item => item.ativa)
          .sort((a, b) => a.ordem - b.ordem);

      const questoesRevisao: IQuestaoRevisao[] = [];

      for (const questao of questoes) {
        const alternativas =
          (await servicoAvaliacao.listarAlternativas(questao.id))
            .filter(item => item.ativa)
            .sort((a, b) => a.ordem - b.ordem);

        questoesRevisao.push({
          enunciado: questao.enunciado || questao.nome,
          peso: questao.peso,
          multiplasRespostas: questao.multiplasRespostas,
          alternativas: alternativas.map(item => ({ texto: item.texto, correta: item.correta }))
        });
      }

      avaliacaoRevisao = {
        nome: avaliacao.nome,
        descricao: avaliacao.descricao,
        notaMinima: avaliacao.notaMinima,
        quantidadeQuestoes: avaliacao.quantidadeQuestoes,
        tentativasPermitidas: avaliacao.tentativasPermitidas,
        tempoLimiteMin: avaliacao.tempoLimiteMin,
        sortearQuestoes: avaliacao.sortearQuestoes,
        questoes: questoesRevisao
      };
    }

    return {
      versao: 1,
      revisao,
      registradoEm: new Date().toISOString(),
      treinamento: {
        codigo: texto(t, 'dgt_codigo'),
        nome: texto(t, 'dgt_name'),
        descricao: texto(t, 'dgt_descricao'),
        cargaHorariaMin: numero(t, 'dgt_cargahorariamin'),
        notaMinima: numero(t, 'dgt_notaminima'),
        validadeMeses: numero(t, 'dgt_validademeses'),
        imagemUrl: texto(t, 'dgt_imagemurl')
      },
      modulos: modulosRevisao,
      avaliacao: avaliacaoRevisao
    };
  }

  // ----------------------------------------------------------
  // Grava a fotografia na revisão do documento de controle.
  // Devolve '' ou uma mensagem de aviso (nunca lança erro).
  // ----------------------------------------------------------
  public async registrar(
    documentoRevisaoId: string,
    treinamentoId: string,
    revisao: string
  ): Promise<string> {

    try {
      const conteudo = await this.gerar(treinamentoId, revisao);

      let json = JSON.stringify(conteudo);

      // Muito grande: guarda sem o texto dos conteúdos dos módulos.
      if (json.length > TAMANHO_MAXIMO) {
        json = JSON.stringify({
          ...conteudo,
          resumido: true,
          modulos: conteudo.modulos.map(modulo => ({
            ...modulo,
            conteudos: modulo.conteudos.map(item => ({ ...item, conteudo: '' }))
          }))
        });
      }

      if (json.length > TAMANHO_MAXIMO) {
        return 'O conteúdo do treinamento é grande demais para ser registrado na revisão.';
      }

      await this.dataverse.atualizarRegistro(
        'dgt_documentorevisao',
        guid(documentoRevisaoId),
        { [COLUNA_CONTEUDO_REVISAO]: json }
      );

      return '';
    } catch (erro) {
      console.error('Conteúdo da revisão não registrado:', erro);

      return ehColunaConteudoInexistente(erro)
        ? 'O conteúdo da revisão não foi registrado: execute scripts/dataverse/criar-coluna-conteudo-revisao.ps1.'
        : 'O conteúdo da revisão não foi registrado (veja o console do navegador).';
    }
  }

  // ----------------------------------------------------------
  // Lê a fotografia de uma revisão.
  //   undefined   → revisão sem registro
  //   'semColuna' → coluna ainda não criada no Dataverse
  // ----------------------------------------------------------
  public async ler(
    documentoRevisaoId: string
  ): Promise<IConteudoRevisaoTreinamento | undefined | 'semColuna'> {

    try {
      const lido =
        await this.dataverse.obterRegistro(
          'dgt_documentorevisao',
          guid(documentoRevisaoId),
          [COLUNA_CONTEUDO_REVISAO]
        );

      const json = texto(lido ? lido.registro : undefined, COLUNA_CONTEUDO_REVISAO);

      if (!json) {
        return undefined;
      }

      return JSON.parse(json) as IConteudoRevisaoTreinamento;
    } catch (erro) {
      if (ehColunaConteudoInexistente(erro)) {
        return 'semColuna';
      }
      throw erro;
    }
  }

  // Tem registro? (sem lançar erro)
  public async possui(documentoRevisaoId: string): Promise<boolean> {
    try {
      const lido = await this.ler(documentoRevisaoId);
      return !!lido && lido !== 'semColuna';
    } catch {
      return false;
    }
  }
}
