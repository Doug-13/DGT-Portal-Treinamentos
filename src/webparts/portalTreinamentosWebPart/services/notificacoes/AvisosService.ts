import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  AreaAdminService,
  IUsuarioAreaAdmin
} from '../AreaAdminService';

import {
  IResponsavelResolvido
} from '../../models/Fluxo';

import {
  usuarioAtende
} from '../fluxo/ResolvedorResponsaveis';

import {
  TABELA_TAREFA_FLUXO,
  TAREFA
} from '../fluxo/dataverse/esquemaFluxo';

import {
  OrcamentoService
} from '../orcamento/OrcamentoService';

import {
  OrcamentoFluxoService
} from '../orcamento/OrcamentoFluxoService';

import {
  STATUS_PLANILHA,
  anoPadraoOrcamento
} from '../orcamento/esquemaOrcamento';

import {
  AcompanhamentoLicitacaoService
} from '../licitacoes/AcompanhamentoLicitacaoService';

import {
  STATUS_USUARIO_TREINAMENTO
} from '../../constants/dataverseChoices';

import {
  CONTROLE_DOCUMENTAL
} from '../../constants/controleDocumental';

import {
  ChaveModuloPortal,
  moduloLiberado
} from '../../utils/modulosPortal';

import {
  IAviso,
  IPreferenciasAvisos
} from './preferenciasNotificacoes';

// ============================================================
// AVISOS NO CANTO DA TELA — O QUE MUDOU PARA O USUÁRIO
//
// Consulta o Dataverse (de tempos em tempos, pelo AvisosPortal) e
// devolve a lista ATUAL de itens que merecem aviso. O AvisosPortal
// compara com o que já foi visto e mostra só os novos.
//
//   fluxo        → etapas de fluxo aguardando o usuário: documentos e
//                  treinamentos (dgt_tarefafluxo) e orçamento (CONT-001)
//   treinamentos → treinamento atribuído; prazo em até 3 dias ou vencido
//   orcamento    → planilha devolvida, em aprovação (nova etapa) ou
//                  aprovada
//   licitacoes   → alterações não lidas nas licitações acompanhadas
//
// Cada fonte é independente: se uma tabela não existir ou o usuário
// não tiver permissão, ela é ignorada sem afetar as outras.
// ============================================================

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const formatado = (registro: IDataverseRecord, campo: string): string =>
  texto(registro, `${campo}@OData.Community.Display.V1.FormattedValue`);

const dataCurta = (valor?: string): string => {
  if (!valor) {
    return '';
  }
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    return '';
  }
  const dois = (numero: number): string => (numero < 10 ? `0${numero}` : String(numero));
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`;
};

const DIAS_AVISO_PRAZO = 3;

export class AvisosService {

  private readonly dataverse: DataverseService;

  private vinculos: IUsuarioAreaAdmin[] | undefined;
  private vinculosLidosEm = 0;

  // Documento de cada revisão (para o título do aviso).
  private readonly documentosPorRevisao: { [revisaoId: string]: { id: string; nome: string; controle: boolean } } = {};

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  private async lerVinculos(): Promise<IUsuarioAreaAdmin[]> {
    if (!this.vinculos || Date.now() - this.vinculosLidosEm > 10 * 60 * 1000) {
      try {
        this.vinculos = await new AreaAdminService(this.dataverse).listarUsuariosArea();
      } catch {
        this.vinculos = this.vinculos || [];
      }
      this.vinculosLidosEm = Date.now();
    }
    return this.vinculos;
  }

  // Lista atual de avisos possíveis (os já vistos são filtrados depois).
  public async coletar(
    contexto: IContextoAcesso,
    preferencias: IPreferenciasAvisos,
    jaVistos: string[]
  ): Promise<IAviso[]> {

    const liberado = (chave: ChaveModuloPortal): boolean =>
      moduloLiberado(contexto.perfil, contexto.modulosPermitidos, chave);

    const fontes: Array<Promise<IAviso[]>> = [];

    if (preferencias.tipos.fluxo) {
      fontes.push(this.etapasDeFluxo(contexto, jaVistos, liberado));
      if (liberado('orcamento')) {
        fontes.push(this.etapasDoOrcamento(contexto));
      }
    }
    if (preferencias.tipos.treinamentos && liberado('treinamentos')) {
      fontes.push(this.treinamentos(contexto));
    }
    if (preferencias.tipos.orcamento && liberado('orcamento')) {
      fontes.push(this.situacaoDoOrcamento(contexto));
    }
    if (preferencias.tipos.licitacoes && liberado('licitacoes')) {
      fontes.push(this.licitacoes());
    }

    const resultados = await Promise.all(fontes.map(fonte => fonte.catch(() => [] as IAviso[])));
    const todos: IAviso[] = [];
    resultados.forEach(lista => lista.forEach(aviso => todos.push(aviso)));
    return todos;
  }

  // ----------------------------------------------------------
  // Etapas de fluxo (documentos e treinamentos)
  // ----------------------------------------------------------

  private async etapasDeFluxo(
    contexto: IContextoAcesso,
    jaVistos: string[],
    liberado: (chave: ChaveModuloPortal) => boolean
  ): Promise<IAviso[]> {

    const tarefas =
      await this.dataverse.listarRegistros(
        TABELA_TAREFA_FLUXO,
        `$select=${TAREFA.id},${TAREFA.revisaoValor},${TAREFA.etapaNome},${TAREFA.responsaveisJson},${TAREFA.prazo},${TAREFA.criadoEm}` +
        `&$filter=${TAREFA.situacao} eq 'pendente'`
      );

    const vinculos = await this.lerVinculos();
    const avisos: IAviso[] = [];

    for (const tarefa of tarefas) {
      const id = `fluxo:${guid(tarefa[TAREFA.id])}`;

      let responsaveis: IResponsavelResolvido[] = [];
      try {
        const lidos = JSON.parse(texto(tarefa, TAREFA.responsaveisJson) || '[]');
        responsaveis = Array.isArray(lidos) ? lidos : [];
      } catch {
        responsaveis = [];
      }

      if (!responsaveis.some(item => usuarioAtende(item, contexto.usuarioId, vinculos))) {
        continue;
      }

      // Detalhes só das que ainda não foram avisadas (evita consultas).
      const revisaoId = guid(tarefa[TAREFA.revisaoValor]);
      const documento = jaVistos.indexOf(id) < 0 ? await this.documentoDaRevisao(revisaoId) : undefined;
      const controle = !!documento && documento.controle;

      if (documento && !liberado(controle ? 'treinamentos' : 'documentos')) {
        continue;
      }

      const prazo = dataCurta(texto(tarefa, TAREFA.prazo));

      avisos.push({
        id,
        tipo: 'fluxo',
        titulo: `Etapa aguardando você: ${texto(tarefa, TAREFA.etapaNome) || 'fluxo'}`,
        detalhe: `${documento ? documento.nome : 'Documento'}${prazo ? ` · prazo ${prazo}` : ''}`,
        data: texto(tarefa, TAREFA.criadoEm),
        acao: controle
          ? { pagina: 'gestao' }
          : documento ? { documentoId: documento.id, pagina: 'documentos' } : { pagina: 'documentos' }
      });
    }

    return avisos;
  }

  private async documentoDaRevisao(
    revisaoId: string
  ): Promise<{ id: string; nome: string; controle: boolean } | undefined> {

    if (!revisaoId) {
      return undefined;
    }
    if (this.documentosPorRevisao[revisaoId]) {
      return this.documentosPorRevisao[revisaoId];
    }
    try {
      const revisao = await this.dataverse.obterRegistro('dgt_documentorevisao', revisaoId, ['_dgt_documento_value', 'dgt_revisao']);
      const documentoId = revisao ? guid(revisao.registro._dgt_documento_value) : '';
      if (!documentoId) {
        return undefined;
      }
      const documento = await this.dataverse.obterRegistro('dgt_documento', documentoId, ['dgt_codigo', 'dgt_titulo', 'dgt_tipo']);
      const registro = documento ? documento.registro : {};
      const tipo = (formatado(registro, 'dgt_tipo') || texto(registro, 'dgt_tipo')).toUpperCase();
      const info = {
        id: documentoId,
        nome: [texto(registro, 'dgt_codigo'), texto(registro, 'dgt_titulo')].filter(Boolean).join(' — ') +
          (revisao ? ` (${texto(revisao.registro, 'dgt_revisao')})` : ''),
        controle: tipo === CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO
      };
      this.documentosPorRevisao[revisaoId] = info;
      return info;
    } catch {
      return undefined;
    }
  }

  // ----------------------------------------------------------
  // Orçamento
  // ----------------------------------------------------------

  private async etapasDoOrcamento(
    contexto: IContextoAcesso
  ): Promise<IAviso[]> {
    const orcamento = new OrcamentoService(this.dataverse);
    const fluxo = new OrcamentoFluxoService(this.dataverse, orcamento);
    const disponibilidade = await fluxo.verificar();
    if (!disponibilidade.ativo) {
      return [];
    }
    const planilhas = await orcamento.listarPlanilhas(anoPadraoOrcamento());
    const pendencias = await fluxo.pendenciasDoUsuario(planilhas, contexto);
    return pendencias.map(item => ({
      id: `orc-etapa:${item.planilha.id}:${item.tarefa.id}`,
      tipo: 'fluxo' as const,
      titulo: `Aprovação aguardando você: ${item.tarefa.elementoNome}`,
      detalhe: `Orçamento ${item.planilha.ano} · ${item.planilha.areaNome || item.planilha.gestorNome}${item.tarefa.prazo ? ` · prazo ${dataCurta(item.tarefa.prazo)}` : ''}`,
      data: item.tarefa.criadaEm,
      acao: { pagina: 'planejamentoOrcamentario' }
    }));
  }

  private async situacaoDoOrcamento(
    contexto: IContextoAcesso
  ): Promise<IAviso[]> {
    const orcamento = new OrcamentoService(this.dataverse);
    const areas =
      (contexto.vinculosArea || [])
        .filter(item => item.perfil === 'Gestor' || item.perfil === 'Administrador da área')
        .map(item => guid(item.areaId));
    const planilhas = await orcamento.listarPlanilhasDoUsuario(anoPadraoOrcamento(), contexto.usuarioId, areas);
    const avisos: IAviso[] = [];
    planilhas.forEach(planilha => {
      const area = planilha.areaNome || 'Geral';
      if (planilha.status === STATUS_PLANILHA.devolvida) {
        avisos.push({
          id: `orc-status:${planilha.id}:devolvida:${planilha.dataDevolucao}`,
          tipo: 'orcamento',
          titulo: `Orçamento ${planilha.ano} devolvido para ajuste`,
          detalhe: `${area}${planilha.devolvidoPor ? ` · por ${planilha.devolvidoPor}` : ''}${planilha.prazoAjuste ? ` · prazo ${dataCurta(planilha.prazoAjuste)}` : ''}`,
          data: planilha.dataDevolucao || planilha.alteradoEm,
          acao: { pagina: 'planejamentoOrcamentario' }
        });
      } else if (planilha.status === STATUS_PLANILHA.aprovada) {
        avisos.push({
          id: `orc-status:${planilha.id}:aprovada`,
          tipo: 'orcamento',
          titulo: `Orçamento ${planilha.ano} aprovado ✓`,
          detalhe: area,
          data: planilha.alteradoEm,
          acao: { pagina: 'planejamentoOrcamentario' }
        });
      } else if (planilha.status === STATUS_PLANILHA.emAprovacao && planilha.etapaAtual) {
        avisos.push({
          id: `orc-status:${planilha.id}:etapa:${planilha.etapaAtual}`,
          tipo: 'orcamento',
          titulo: `Orçamento ${planilha.ano} avançou: ${planilha.etapaAtual}`,
          detalhe: area,
          data: planilha.alteradoEm,
          acao: { pagina: 'planejamentoOrcamentario' }
        });
      }
    });
    return avisos;
  }

  // ----------------------------------------------------------
  // Treinamentos do usuário
  // ----------------------------------------------------------

  private async treinamentos(
    contexto: IContextoAcesso
  ): Promise<IAviso[]> {

    if (!contexto.usuarioId) {
      return [];
    }

    const registros =
      await this.dataverse.listarRegistros(
        'dgt_usuariotreinamento',
        '$select=dgt_usuariotreinamentoid,_dgt_treinamento_value,dgt_datalimite,dgt_status,dgt_liberado,createdon' +
        `&$filter=_dgt_usuario_value eq ${guid(contexto.usuarioId)} and dgt_ativo eq true`
      );

    const encerrados: number[] = [STATUS_USUARIO_TREINAMENTO.CONCLUIDO, STATUS_USUARIO_TREINAMENTO.CANCELADO];
    const agora = Date.now();
    const avisos: IAviso[] = [];

    registros.forEach(registro => {
      const id = guid(registro.dgt_usuariotreinamentoid);
      const nome = formatado(registro, '_dgt_treinamento_value') || 'Treinamento';
      const status = Number(registro.dgt_status);

      if (encerrados.indexOf(status) >= 0) {
        return;
      }

      avisos.push({
        id: `trn-novo:${id}`,
        tipo: 'treinamentos',
        titulo: 'Novo treinamento atribuído',
        detalhe: nome,
        data: texto(registro, 'createdon'),
        acao: { pagina: 'treinamentos' }
      });

      const limite = texto(registro, 'dgt_datalimite');
      const quando = limite ? new Date(limite).getTime() : NaN;
      if (!isNaN(quando)) {
        const dias = (quando - agora) / 86400000;
        if (dias < 0) {
          avisos.push({
            id: `trn-vencido:${id}:${limite.substring(0, 10)}`,
            tipo: 'treinamentos',
            titulo: 'Prazo do treinamento vencido',
            detalhe: `${nome} · venceu em ${dataCurta(limite)}`,
            data: limite,
            acao: { pagina: 'treinamentos' }
          });
        } else if (dias <= DIAS_AVISO_PRAZO) {
          avisos.push({
            id: `trn-prazo:${id}:${limite.substring(0, 10)}`,
            tipo: 'treinamentos',
            titulo: 'Prazo do treinamento vencendo',
            detalhe: `${nome} · até ${dataCurta(limite)}`,
            data: limite,
            acao: { pagina: 'treinamentos' }
          });
        }
      }
    });

    return avisos;
  }

  // ----------------------------------------------------------
  // Licitações acompanhadas
  // ----------------------------------------------------------

  private async licitacoes(): Promise<IAviso[]> {
    const servico = new AcompanhamentoLicitacaoService(this.dataverse);
    const [acompanhamentos, alteracoes] = await Promise.all([servico.listar(), servico.listarAlteracoes()]);
    const nomes: { [id: string]: string } = {};
    acompanhamentos.forEach(item => {
      nomes[item.id] = [item.numero, item.orgao].filter(Boolean).join(' · ') || item.objeto || 'Licitação';
    });
    const limite = Date.now() - 14 * 86400000;
    return alteracoes
      .filter(item => !item.lida && new Date(item.detectadaEm).getTime() >= limite)
      .slice(0, 50)
      .map(item => ({
        id: `lic:${item.id}`,
        tipo: 'licitacoes' as const,
        titulo: 'Alteração em licitação acompanhada',
        detalhe: `${nomes[item.acompanhamentoId] || 'Licitação'} · ${item.descricao || item.tipo}`,
        data: item.detectadaEm,
        acao: { pagina: 'licitacoes' }
      }));
  }
}
