import {
  DataverseService
} from './DataverseService';

import {
  IModuloAdmin,
  ModuloAdminService
} from './ModuloAdminService';

// ============================================================
// REMOÇÃO DE MÓDULO (somente Administrador)
//
// Regra do projeto: nunca apagar histórico de colaboradores.
// O módulo só pode ser removido se NINGUÉM o iniciou:
//   - sem progresso de colaborador (dgt_usuariomodulo);
//   - sem respostas de colaborador às perguntas do módulo
//     (dgt_moduloperguntaresposta).
// Caso contrário, o caminho é DESATIVAR o módulo.
//
// Exclusão de baixo para cima:
//   alternativas das perguntas → perguntas → conteúdos → módulo
//
// Depois, os módulos restantes são renumerados (1, 2, 3...).
// A remoção fica registrada no histórico do treinamento
// (AuditarTreinamentoPlugin).
// ============================================================

export interface IImpactoRemocaoModulo {
  moduloId: string;

  // Bloqueiam a remoção
  progressos: number;
  respostas: number;

  // Removidos junto com o módulo
  conteudos: number;
  perguntas: number;
  alternativas: number;

  podeRemover: boolean;
  motivoBloqueio: string;
}

interface IEstruturaModulo {
  conteudos: string[];
  perguntas: string[];
  alternativas: string[];
  progressos: string[];
  respostas: string[];
}

export class ModuloRemocaoService {

  private readonly dataverse:
    DataverseService;

  private readonly modulos:
    ModuloAdminService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
    this.modulos = new ModuloAdminService(dataverse);
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
    moduloId: string
  ): Promise<IEstruturaModulo> {

    const id = [moduloId];

    const [conteudos, progressos] = await Promise.all([
      this.listarSeguro('dgt_moduloconteudo', 'dgt_modulo', id),
      this.listarSeguro('dgt_usuariomodulo', 'dgt_modulo', id)
    ]);

    const perguntas =
      await this.listarSeguro('dgt_modulopergunta', 'dgt_moduloconteudo', conteudos);

    const [alternativas, respostas] = await Promise.all([
      this.listarSeguro('dgt_moduloperguntaalternativa', 'dgt_modulopergunta', perguntas),
      this.listarSeguro('dgt_moduloperguntaresposta', 'dgt_modulopergunta', perguntas)
    ]);

    return {
      conteudos,
      perguntas,
      alternativas,
      progressos,
      respostas
    };
  }

  public async analisar(
    moduloId: string
  ): Promise<IImpactoRemocaoModulo> {

    const e = await this.levantar(moduloId);

    let motivoBloqueio = '';

    if (e.progressos.length) {
      motivoBloqueio =
        `Este módulo já foi iniciado por colaboradores (${e.progressos.length} registro(s) de progresso). ` +
        'Para preservar o histórico, ele não pode ser removido. Use "Desativar".';
    } else if (e.respostas.length) {
      motivoBloqueio =
        `As perguntas deste módulo já têm ${e.respostas.length} resposta(s) de colaboradores. ` +
        'Para preservar o histórico, ele não pode ser removido. Use "Desativar".';
    }

    return {
      moduloId,
      progressos: e.progressos.length,
      respostas: e.respostas.length,
      conteudos: e.conteudos.length,
      perguntas: e.perguntas.length,
      alternativas: e.alternativas.length,
      podeRemover: !motivoBloqueio,
      motivoBloqueio
    };
  }

  public async remover(
    modulo: IModuloAdmin
  ): Promise<void> {

    // Confere de novo no momento da remoção.
    const e = await this.levantar(modulo.id);

    if (e.progressos.length || e.respostas.length) {
      throw new Error(
        'O módulo passou a ter registros de colaboradores e não pode mais ser removido. Use "Desativar".'
      );
    }

    const etapas: Array<[string, string[]]> = [
      ['dgt_moduloperguntaalternativa', e.alternativas],
      ['dgt_modulopergunta', e.perguntas],
      ['dgt_moduloconteudo', e.conteudos],
      ['dgt_modulo', [modulo.id]]
    ];

    for (const [tabela, ids] of etapas) {
      for (const id of ids) {
        await this.dataverse.excluirRegistro(tabela, id);
      }
    }

    // Renumera os módulos que ficaram (1, 2, 3...), sem buracos.
    if (modulo.treinamentoId) {
      const restantes =
        await this.modulos.listarPorTreinamento(
          modulo.treinamentoId
        );

      await this.modulos.reordenar(
        restantes
      );
    }
  }
}
