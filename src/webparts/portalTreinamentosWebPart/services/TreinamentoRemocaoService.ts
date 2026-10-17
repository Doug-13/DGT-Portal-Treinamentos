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
// EXCEÇÃO — REMOÇÃO FORÇADA (somente Administrador): com motivo
// obrigatório e confirmação, remove também atribuições, tentativas,
// respostas, certificados (registros), progresso, vínculos com
// trilhas e o documento de controle (TRN) com o fluxo. O motivo e o
// resumo do que foi apagado ficam no histórico de auditoria.
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

  // Remoção forçada (Administrador): o que sai junto.
  podeForcar: boolean;
  tentativas: number;
  certificados: number;
  progressos: number;
  documentoControle: string;
}

export interface IOpcoesRemocao {
  // Administrador: remove mesmo com atribuições/trilhas.
  forcar?: boolean;
  motivo?: string;
  usuarioNome?: string;
}

interface IHistorico {
  tentativas: string[];
  questoesTentativa: string[];
  respostas: string[];
  certificados: string[];
  progressos: string[];
  respostasPerguntas: string[];
  revisoesTreinamento: string[];
  documentoId: string;
  documentoCodigo: string;
  revisoesDocumento: string[];
  tarefasFluxo: string[];
  historicoFluxo: string[];
  vinculosProcesso: string[];
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

const unicos = (lista: string[]): string[] =>
  lista.filter((item, i) => !!item && lista.indexOf(item) === i);

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

  // Histórico e controle documental (só na remoção forçada).
  private async levantarHistorico(
    treinamentoId: string,
    e: IEstrutura
  ): Promise<IHistorico> {

    const id = [treinamentoId];

    const [tentativasPorAtribuicao, tentativasPorAvaliacao] = await Promise.all([
      this.listarSeguro('dgt_tentativa', 'dgt_usuariotreinamento', e.atribuicoes),
      this.listarSeguro('dgt_tentativa', 'dgt_avaliacao', e.avaliacoes)
    ]);

    const tentativas = unicos([...tentativasPorAtribuicao, ...tentativasPorAvaliacao]);

    const [questoesPorTentativa, questoesPorQuestao] = await Promise.all([
      this.listarSeguro('dgt_tentativaquestao', 'dgt_tentativa', tentativas),
      this.listarSeguro('dgt_tentativaquestao', 'dgt_questao', e.questoes)
    ]);

    const questoesTentativa = unicos([...questoesPorTentativa, ...questoesPorQuestao]);

    const [respostasPorQuestao, respostasPorAlternativa] = await Promise.all([
      this.listarSeguro('dgt_resposta', 'dgt_tentativaquestao', questoesTentativa),
      this.listarSeguro('dgt_resposta', 'dgt_alternativa', e.alternativas)
    ]);

    const [certPorAtribuicao, certPorTreinamento, progressos, respostasPerguntas, revisoesTreinamento] = await Promise.all([
      this.listarSeguro('dgt_certificado', 'dgt_usuariotreinamento', e.atribuicoes),
      this.listarSeguro('dgt_certificado', 'dgt_treinamento', id),
      this.listarSeguro('dgt_usuariomodulo', 'dgt_modulo', e.modulos),
      this.listarSeguro('dgt_moduloperguntaresposta', 'dgt_modulopergunta', e.perguntas),
      this.listarSeguro('dgt_treinamentorevisao', 'dgt_treinamento', id)
    ]);

    // Documento de controle (mesmo código, tipo TRN).
    let documentoId = '';
    let documentoCodigo = '';
    let revisoesDocumento: string[] = [];
    let tarefasFluxo: string[] = [];
    let historicoFluxo: string[] = [];
    let vinculosProcesso: string[] = [];

    try {
      const lido = await this.dataverse.obterRegistro('dgt_treinamento', treinamentoId, ['dgt_codigo']);
      const codigo = lido ? String(lido.registro.dgt_codigo || '').trim().toUpperCase() : '';

      if (codigo) {
        const docs = await this.dataverse.listarRegistros(
          'dgt_documento',
          `$select=dgt_documentoid,dgt_codigo&$filter=dgt_codigo eq '${codigo.replace(/'/g, "''")}'&$top=1`
        );

        if (docs.length > 0) {
          documentoId = String(docs[0].dgt_documentoid || '').replace(/[{}]/g, '').toLowerCase();
          documentoCodigo = codigo;

          [revisoesDocumento, vinculosProcesso] = await Promise.all([
            this.listarSeguro('dgt_documentorevisao', 'dgt_documento', [documentoId]),
            this.listarSeguro('dgt_documentoprocesso', 'dgt_documento', [documentoId])
          ]);

          [tarefasFluxo, historicoFluxo] = await Promise.all([
            this.listarSeguro('dgt_tarefafluxo', 'dgt_documentorevisao', revisoesDocumento),
            this.listarSeguro('dgt_historicofluxo', 'dgt_documentorevisao', revisoesDocumento)
          ]);
        }
      }
    } catch (erro) {
      console.error('Documento de controle não levantado:', erro);
    }

    return {
      tentativas,
      questoesTentativa,
      respostas: unicos([...respostasPorQuestao, ...respostasPorAlternativa]),
      certificados: unicos([...certPorAtribuicao, ...certPorTreinamento]),
      progressos,
      respostasPerguntas,
      revisoesTreinamento,
      documentoId,
      documentoCodigo,
      revisoesDocumento,
      tarefasFluxo,
      historicoFluxo,
      vinculosProcesso
    };
  }

  public async analisar(
    treinamentoId: string
  ): Promise<IImpactoRemocao> {

    const e = await this.levantar(treinamentoId);
    const h = await this.levantarHistorico(treinamentoId, e);

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
      motivoBloqueio,
      podeForcar: !!motivoBloqueio,
      tentativas: h.tentativas.length,
      certificados: h.certificados.length,
      progressos: h.progressos.length,
      documentoControle: h.documentoCodigo
    };
  }

  public async remover(
    treinamentoId: string,
    aoProgredir?: (mensagem: string) => void,
    opcoes: IOpcoesRemocao = {}
  ): Promise<void> {

    // Levanta de novo no momento da remoção (algo pode ter mudado).
    const e = await this.levantar(treinamentoId);
    const forcar = !!opcoes.forcar;

    if ((e.atribuicoes.length || e.trilhas.length) && !forcar) {
      throw new Error(
        'O treinamento passou a ter atribuições ou trilhas e não pode mais ser removido. Use "Desativar".'
      );
    }

    if (forcar && !(opcoes.motivo || '').trim()) {
      throw new Error('Informe o motivo da remoção forçada.');
    }

    // Remoção forçada: histórico dos colaboradores e controle
    // documental saem ANTES da estrutura (filhos antes dos pais).
    const h = await this.levantarHistorico(treinamentoId, e);

    const etapasHistorico: Array<[string, string, string[]]> = forcar
      ? [
        ['Respostas das tentativas', 'dgt_resposta', h.respostas],
        ['Questões das tentativas', 'dgt_tentativaquestao', h.questoesTentativa],
        ['Tentativas das avaliações', 'dgt_tentativa', h.tentativas],
        ['Certificados', 'dgt_certificado', h.certificados],
        ['Respostas das perguntas dos módulos', 'dgt_moduloperguntaresposta', h.respostasPerguntas],
        ['Progresso nos módulos', 'dgt_usuariomodulo', h.progressos],
        ['Atribuições', 'dgt_usuariotreinamento', e.atribuicoes],
        ['Vínculos com trilhas', 'dgt_trilhatreinamento', e.trilhas]
      ]
      : [];

    // Documento de controle (TRN): sai sempre junto com o treinamento.
    const etapasControle: Array<[string, string, string[]]> = [
      ['Revisões do treinamento', 'dgt_treinamentorevisao', h.revisoesTreinamento],
      ['Histórico do fluxo', 'dgt_historicofluxo', h.historicoFluxo],
      ['Pendências do fluxo', 'dgt_tarefafluxo', h.tarefasFluxo],
      ['Vínculo documento × processo', 'dgt_documentoprocesso', h.vinculosProcesso],
      ['Revisões do documento de controle', 'dgt_documentorevisao', h.revisoesDocumento]
    ];

    for (const [rotulo, tabela, ids] of [...etapasHistorico, ...etapasControle]) {
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

    // Motivo e resumo no histórico de auditoria (antes de apagar o
    // treinamento, para registrar o código e o nome).
    if (forcar) {
      await this.registrarRemocaoForcada(treinamentoId, e, h, opcoes);
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
      ['Documento de controle', 'dgt_documento', h.documentoId ? [h.documentoId] : []],
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

  private async registrarRemocaoForcada(
    treinamentoId: string,
    e: IEstrutura,
    h: IHistorico,
    opcoes: IOpcoesRemocao
  ): Promise<void> {
    try {
      const lido = await this.dataverse.obterRegistro('dgt_treinamento', treinamentoId, ['dgt_codigo', 'dgt_name']);
      const codigo = lido ? String(lido.registro.dgt_codigo || '') : '';
      const nome = lido ? String(lido.registro.dgt_name || '') : '';
      const resumo = {
        tipo: 'REMOCAO_FORCADA',
        codigo,
        nome,
        motivo: opcoes.motivo,
        por: opcoes.usuarioNome,
        atribuicoes: e.atribuicoes.length,
        tentativas: h.tentativas.length,
        certificados: h.certificados.length,
        trilhas: e.trilhas.length,
        documentoControle: h.documentoCodigo
      };

      await this.dataverse.criarRegistro('dgt_auditorianegocio', {
        dgt_name: `Remoção forçada — ${codigo}`.substring(0, 100),
        dgt_entidade: 'dgt_treinamento',
        dgt_registroid: treinamentoId.replace(/[{}]/g, '').toLowerCase(),
        dgt_dataevento: new Date().toISOString(),
        dgt_descricao: (
          `Treinamento ${codigo} — ${nome} removido pelo Administrador ${opcoes.usuarioNome || ''}, ` +
          `com ${e.atribuicoes.length} atribuição(ões), ${h.tentativas.length} tentativa(s) e ${h.certificados.length} certificado(s). ` +
          `Motivo: ${opcoes.motivo || ''}`
        ).substring(0, 1900),
        dgt_dadosnovos: JSON.stringify(resumo),
        dgt_origem: 'Portal — Remoção forçada',
        dgt_ativo: true
      });
    } catch (erro) {
      // O registro do motivo nunca impede a remoção.
      console.error('Motivo da remoção forçada não registrado:', erro);
    }
  }
}

