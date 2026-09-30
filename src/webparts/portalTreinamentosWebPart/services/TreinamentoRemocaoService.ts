import {
  DataverseService
} from './DataverseService';

// ============================================================
// REMOÇÃO DE TREINAMENTO (somente Administrador)
//
// Regra do projeto: nunca apagar histórico de colaboradores.
// Por isso a remoção só é permitida quando o treinamento NUNCA foi
// atribuído a ninguém e não faz parte de nenhuma trilha. Nesses
// casos o treinamento é só um rascunho/duplicado e pode sair.
//
// Se houver atribuições (e, portanto, possíveis tentativas, notas
// e certificados), a remoção é bloqueada: o caminho é DESATIVAR.
//
// A exclusão é feita de baixo para cima:
//   alternativas → questões → avaliações
//   alternativas de perguntas → perguntas → conteúdos → módulos
//   vínculos (documentos, regras por área) → treinamento
//
// Cada exclusão continua registrada no histórico
// (dgt_auditorianegocio) pelo AuditarTreinamentoPlugin.
// ============================================================

export interface IImpactoRemocao {
  treinamentoId: string;

  // Bloqueiam a remoção
  atribuicoes: number;
  trilhas: number;

  // Removidos junto com o treinamento
  modulos: number;
  conteudos: number;
  perguntasModulo: number;
  alternativasPerguntas: number;
  avaliacoes: number;
  questoes: number;
  alternativas: number;
  documentosVinculados: number;
  regrasArea: number;

  podeRemover: boolean;
  motivoBloqueio: string;
}

interface IEstrutura {
  modulos: string[];
  conteudos: string[];
  perguntas: string[];
  alternativasPerguntas: string[];
  avaliacoes: string[];
  questoes: string[];
  alternativas: string[];
  documentos: string[];
  regrasArea: string[];
  atribuicoes: string[];
  trilhas: string[];
}

export class TreinamentoRemocaoService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // Tabelas opcionais (podem não existir em algum ambiente).
  private async listarSeguro(
    tabela: string,
    lookup: string,
    ids: string[]
  ): Promise<string[]> {
    try {
      return await this.dataverse.listarIdsPorLookup(tabela, lookup, ids);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);

      if (mensagem.indexOf('0x80060888') >= 0) {
        return [];
      }

      throw e;
    }
  }

  private async levantar(
    treinamentoId: string
  ): Promise<IEstrutura> {

    const id = [treinamentoId];

    const [
      modulos,
      avaliacoes,
      documentos,
      regrasArea,
      atribuicoes,
      trilhas
    ] = await Promise.all([
      this.listarSeguro('dgt_modulo', 'dgt_treinamento', id),
      this.listarSeguro('dgt_avaliacao', 'dgt_treinamento', id),
      this.listarSeguro('dgt_treinamentodocumento', 'dgt_treinamento', id),
      this.listarSeguro('dgt_treinamentoarea', 'dgt_treinamento', id),
      this.listarSeguro('dgt_usuariotreinamento', 'dgt_treinamento', id),
      this.listarSeguro('dgt_trilhatreinamento', 'dgt_treinamento', id)
    ]);

    const [conteudos, questoes] = await Promise.all([
      this.listarSeguro('dgt_moduloconteudo', 'dgt_modulo', modulos),
      this.listarSeguro('dgt_questao', 'dgt_avaliacao', avaliacoes)
    ]);

    const [perguntas, alternativas] = await Promise.all([
      this.listarSeguro('dgt_modulopergunta', 'dgt_moduloconteudo', conteudos),
      this.listarSeguro('dgt_alternativa', 'dgt_questao', questoes)
    ]);

    const alternativasPerguntas =
      await this.listarSeguro('dgt_moduloperguntaalternativa', 'dgt_modulopergunta', perguntas);

    return {
      modulos,
      conteudos,
      perguntas,
      alternativasPerguntas,
      avaliacoes,
      questoes,
      alternativas,
      documentos,
      regrasArea,
      atribuicoes,
      trilhas
    };
  }

  public async analisar(
    treinamentoId: string
  ): Promise<IImpactoRemocao> {

    const e = await this.levantar(treinamentoId);

    let motivoBloqueio = '';

    if (e.atribuicoes.length) {
      motivoBloqueio =
        `Este treinamento já foi atribuído a ${e.atribuicoes.length} colaborador(es). ` +
        'Para preservar o histórico, notas e certificados, ele não pode ser removido. Use "Desativar".';
    } else if (e.trilhas.length) {
      motivoBloqueio =
        `Este treinamento faz parte de ${e.trilhas.length} trilha(s). ` +
        'Retire-o das trilhas em "Gerenciar trilhas" antes de remover.';
    }

    return {
      treinamentoId,
      atribuicoes: e.atribuicoes.length,
      trilhas: e.trilhas.length,
      modulos: e.modulos.length,
      conteudos: e.conteudos.length,
      perguntasModulo: e.perguntas.length,
      alternativasPerguntas: e.alternativasPerguntas.length,
      avaliacoes: e.avaliacoes.length,
      questoes: e.questoes.length,
      alternativas: e.alternativas.length,
      documentosVinculados: e.documentos.length,
      regrasArea: e.regrasArea.length,
      podeRemover: !motivoBloqueio,
      motivoBloqueio
    };
  }

  public async remover(
    treinamentoId: string,
    aoProgredir?: (mensagem: string) => void
  ): Promise<void> {

    // Levanta de novo no momento da remoção (algo pode ter mudado).
    const e = await this.levantar(treinamentoId);

    if (e.atribuicoes.length || e.trilhas.length) {
      throw new Error(
        'O treinamento passou a ter atribuições ou trilhas e não pode mais ser removido. Use "Desativar".'
      );
    }

    const etapas: Array<[string, string, string[]]> = [
      ['Alternativas das questões', 'dgt_alternativa', e.alternativas],
      ['Questões', 'dgt_questao', e.questoes],
      ['Avaliações', 'dgt_avaliacao', e.avaliacoes],
      ['Alternativas das perguntas dos módulos', 'dgt_moduloperguntaalternativa', e.alternativasPerguntas],
      ['Perguntas dos módulos', 'dgt_modulopergunta', e.perguntas],
      ['Conteúdos dos módulos', 'dgt_moduloconteudo', e.conteudos],
      ['Módulos', 'dgt_modulo', e.modulos],
      ['Documentos vinculados', 'dgt_treinamentodocumento', e.documentos],
      ['Regras de atribuição por área', 'dgt_treinamentoarea', e.regrasArea],
      ['Treinamento', 'dgt_treinamento', [treinamentoId]]
    ];

    for (const [rotulo, tabela, ids] of etapas) {

      if (!ids.length) {
        continue;
      }

      if (aoProgredir) {
        aoProgredir(`Removendo ${rotulo.toLowerCase()} (${ids.length})...`);
      }

      for (const id of ids) {
        await this.dataverse.excluirRegistro(tabela, id);
      }
    }
  }
}
