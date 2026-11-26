import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  DocumentoService
} from '../DocumentoService';

import {
  OrcamentoService
} from '../orcamento/OrcamentoService';

import {
  ITENS_DRE,
  calcularDre,
  sinalDaConta
} from '../orcamento/dreOrcamento';

import {
  termoExibido
} from '../orcamento/planoContasOrcamento';

import {
  IDescricaoFonte,
  Linha
} from './dashboardModelo';

// ============================================================
// CATÁLOGO DE FONTES DOS DASHBOARDS
//
// Só estas fontes podem ser usadas nas definições (a skill
// "dashboard-dgt" tem a mesma lista). Cada fonte devolve linhas
// planas já filtradas pela ÁREA de quem está vendo (e pelo ano).
// Valores do orçamento vêm COM SINAL (receitas +, custos −), como na
// planilha. Para incluir uma fonte: descrevê-la aqui, implementar o
// carregamento e atualizar a referência da skill.
// ============================================================

export interface IContextoFonte {
  dataverse: DataverseService;
  ano: number;
  // Áreas permitidas/selecionadas (undefined = todas).
  areaIds?: string[];
}

interface IFonte extends IDescricaoFonte {
  carregar: (contexto: IContextoFonte) => Promise<Linha[]>;
}

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const guid = (valor?: unknown): string => String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const naArea = (contexto: IContextoFonte, areaId?: string): boolean =>
  !contexto.areaIds || contexto.areaIds.some(id => guid(id) === guid(areaId));

const formatado = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[`${campo}@OData.Community.Display.V1.FormattedValue`] || registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const diasAte = (data?: string): number | undefined => {
  if (!data) {
    return undefined;
  }
  const alvo = new Date(data.length <= 10 ? `${data}T12:00:00` : data).getTime();
  if (isNaN(alvo)) {
    return undefined;
  }
  return Math.floor((alvo - Date.now()) / 86400000);
};

// ------------------------------------------------------------
// Orçamento
// ------------------------------------------------------------

const planilhasDoAno = async (contexto: IContextoFonte): Promise<{ servico: OrcamentoService; planilhas: Awaited<ReturnType<OrcamentoService['listarPlanilhas']>> }> => {
  const servico = new OrcamentoService(contexto.dataverse);
  const planilhas = (await servico.listarPlanilhas(contexto.ano)).filter(planilha => naArea(contexto, planilha.areaId));
  return { servico, planilhas };
};

const fonteOrcamentoLinhas: IFonte = {
  id: 'orcamento.linhas',
  nome: 'Orçamento — linhas por conta e mês',
  descricao: 'Uma linha por conta e mês das planilhas do ano. Valores com sinal (receitas +, deduções/custos/despesas −).',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'grupo', rotulo: 'Grupo', tipo: 'texto', listarValores: true },
    { chave: 'codigo', rotulo: 'Código', tipo: 'texto', listarValores: true },
    { chave: 'conta', rotulo: 'Conta', tipo: 'texto', listarValores: true },
    { chave: 'mes', rotulo: 'Mês', tipo: 'mes' },
    { chave: 'situacao', rotulo: 'Situação da planilha', tipo: 'texto' },
    { chave: 'orcado', rotulo: 'Orçado', tipo: 'numero' },
    { chave: 'executado', rotulo: 'Executado', tipo: 'numero' },
    { chave: 'diferenca', rotulo: 'Executado − Orçado', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const { servico, planilhas } = await planilhasDoAno(contexto);
    if (planilhas.length === 0) {
      return [];
    }
    const porId: { [id: string]: typeof planilhas[0] } = {};
    planilhas.forEach(planilha => { porId[planilha.id] = planilha; });
    const linhas = await servico.carregarLinhasDePlanilhas(planilhas.map(planilha => planilha.id));
    const saida: Linha[] = [];
    linhas.forEach(linha => {
      const planilha = porId[linha.planilhaId];
      if (!planilha) {
        return;
      }
      const sinal = sinalDaConta(linha.codigo);
      for (let mes = 0; mes < 12; mes++) {
        const orcado = Math.round((linha.valores[mes] || 0) * sinal * 100) / 100;
        const executado = Math.round(((linha.executado || [])[mes] || 0) * sinal * 100) / 100;
        if (!orcado && !executado) {
          continue;
        }
        saida.push({
          area: planilha.areaNome || 'Geral',
          grupo: termoExibido(linha.grupo),
          codigo: linha.codigo,
          conta: linha.conta,
          mes: mes + 1,
          situacao: planilha.status,
          orcado,
          executado,
          diferenca: Math.round((executado - orcado) * 100) / 100
        });
      }
    });
    return saida;
  }
};

const fonteOrcamentoDre: IFonte = {
  id: 'orcamento.dre',
  nome: 'Orçamento — linhas da DRE por mês',
  descricao: 'Grupos, seções e resultados da DRE (Receita Bruta, Receita Operacional Líquida, Lucro Bruto, LAIR, Lucro Líquido, EBITDA e %), por área e mês, orçado e executado.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'indicador', rotulo: 'Linha da DRE', tipo: 'texto', descricao: `Valores: ${ITENS_DRE.map(item => item.nome).join(', ')}` },
    { chave: 'indicadorId', rotulo: 'Id da linha da DRE', tipo: 'texto', valores: ITENS_DRE.map(item => item.id) },
    { chave: 'tipoLinha', rotulo: 'Tipo (grupo, secao, resultado, percentual)', tipo: 'texto', valores: ['grupo', 'secao', 'resultado', 'percentual'] },
    { chave: 'mes', rotulo: 'Mês', tipo: 'mes' },
    { chave: 'orcado', rotulo: 'Orçado', tipo: 'numero' },
    { chave: 'executado', rotulo: 'Executado', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const { servico, planilhas } = await planilhasDoAno(contexto);
    if (planilhas.length === 0) {
      return [];
    }
    const linhas = await servico.carregarLinhasDePlanilhas(planilhas.map(planilha => planilha.id));
    const saida: Linha[] = [];
    planilhas.forEach(planilha => {
      const daPlanilha = linhas.filter(linha => linha.planilhaId === planilha.id);
      const orcado = calcularDre(daPlanilha);
      const executado = calcularDre(daPlanilha.map(linha => ({ ...linha, valores: linha.executado || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })));
      ITENS_DRE.forEach(item => {
        for (let mes = 0; mes < 12; mes++) {
          saida.push({
            area: planilha.areaNome || 'Geral',
            indicador: termoExibido(item.id, item.nome),
            indicadorId: item.id,
            tipoLinha: item.tipo,
            mes: mes + 1,
            orcado: (orcado[item.id] || [])[mes] || 0,
            executado: (executado[item.id] || [])[mes] || 0
          });
        }
      });
    });
    return saida;
  }
};

const fonteOrcamentoPlanilhas: IFonte = {
  id: 'orcamento.planilhas',
  nome: 'Orçamento — planilhas por área',
  descricao: 'Uma linha por planilha do ano: situação, etapa do fluxo, atraso e totais (com sinal).',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'situacao', rotulo: 'Situação', tipo: 'texto' },
    { chave: 'etapa', rotulo: 'Etapa do fluxo', tipo: 'texto' },
    { chave: 'atrasada', rotulo: 'Atrasada (Sim/Não)', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'diasAtraso', rotulo: 'Dias de atraso', tipo: 'numero' },
    { chave: 'totalOrcado', rotulo: 'Total orçado (saldo)', tipo: 'numero' },
    { chave: 'totalExecutado', rotulo: 'Total executado (saldo)', tipo: 'numero' },
    { chave: 'planilhas', rotulo: 'Quantidade (1 por planilha)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const { servico, planilhas } = await planilhasDoAno(contexto);
    if (planilhas.length === 0) {
      return [];
    }
    const linhas = await servico.carregarLinhasDePlanilhas(planilhas.map(planilha => planilha.id));
    return planilhas.map(planilha => {
      let totalOrcado = 0;
      let totalExecutado = 0;
      linhas.filter(linha => linha.planilhaId === planilha.id).forEach(linha => {
        const sinal = sinalDaConta(linha.codigo);
        linha.valores.forEach(valor => { totalOrcado += (valor || 0) * sinal; });
        (linha.executado || []).forEach(valor => { totalExecutado += (valor || 0) * sinal; });
      });
      const dias = diasAte(planilha.prazoEtapa || planilha.prazoAjuste);
      const atrasada = dias !== undefined && dias < 0 && planilha.status !== 'Aprovada';
      return {
        area: planilha.areaNome || 'Geral',
        situacao: planilha.status,
        etapa: planilha.etapaAtual || '',
        atrasada: atrasada ? 'Sim' : 'Não',
        diasAtraso: atrasada && dias !== undefined ? -dias : 0,
        totalOrcado: Math.round(totalOrcado * 100) / 100,
        totalExecutado: Math.round(totalExecutado * 100) / 100,
        planilhas: 1
      };
    });
  }
};

// ------------------------------------------------------------
// Documentos
// ------------------------------------------------------------

// Dados extras de documentos e revisões (colunas que o cadastro não
// traz): lidos uma vez por painel e compartilhados pelas fontes.
const cacheDocsExtras = new WeakMap<IContextoFonte, Promise<{ processoDoDocumento: { [id: string]: string }; revisoes: IDataverseRecord[] }>>();

const extrasDocumentos = (contexto: IContextoFonte): Promise<{ processoDoDocumento: { [id: string]: string }; revisoes: IDataverseRecord[] }> => {
  let promessa = cacheDocsExtras.get(contexto);
  if (!promessa) {
    promessa = Promise.all([
      contexto.dataverse.listarRegistros('dgt_documento', '$select=dgt_documentoid,_dgt_processonegocio_value'),
      contexto.dataverse.listarRegistros(
        'dgt_documentorevisao',
        '$select=dgt_documentorevisaoid,dgt_revisao,dgt_status,createdon,dgt_datarevisao,dgt_dataaprovacao,dgt_datavigencia,' +
        'dgt_etapaatual,dgt_situacaofluxo,dgt_motivoalteracao,dgt_requerretreinamento,_dgt_documento_value,_dgt_responsavel_value,_dgt_aprovadopor_value' +
        '&$filter=dgt_ativa ne false'
      )
    ]).then(([documentos, revisoes]) => {
      const processoDoDocumento: { [id: string]: string } = {};
      documentos.forEach(registro => { processoDoDocumento[guid(registro.dgt_documentoid)] = formatado(registro, '_dgt_processonegocio_value'); });
      return { processoDoDocumento, revisoes };
    });
    cacheDocsExtras.set(contexto, promessa);
  }
  return promessa;
};

const dataIso = (valor: unknown): string => {
  const data = new Date(String(valor || ''));
  return valor && !isNaN(data.getTime()) ? data.toISOString().substring(0, 10) : '';
};

const mesDeData = (valor: unknown): number | undefined => {
  const data = new Date(String(valor || ''));
  return valor && !isNaN(data.getTime()) ? data.getMonth() + 1 : undefined;
};

const diasEntre = (inicio: unknown, fim: unknown): number | undefined => {
  const a = new Date(String(inicio || '')).getTime();
  const b = new Date(String(fim || '')).getTime();
  return inicio && fim && !isNaN(a) && !isNaN(b) ? Math.max(0, Math.round((b - a) / 86400000)) : undefined;
};

const fonteDocumentos: IFonte = {
  id: 'documentos.documentos',
  nome: 'Documentos — cadastro e prazos de revisão',
  descricao: 'Uma linha por documento ativo (todos os anos): área, processo, tipo, status, revisão atual, cadastro e prazo da próxima revisão periódica.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Código', tipo: 'texto' },
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto', listarValores: true },
    { chave: 'processo', rotulo: 'Processo', tipo: 'texto', listarValores: true },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'revisao', rotulo: 'Revisão atual', tipo: 'texto' },
    { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
    { chave: 'criadoEm', rotulo: 'Data de cadastro', tipo: 'data' },
    { chave: 'mes', rotulo: 'Mês do prazo da próxima revisão', tipo: 'mes' },
    { chave: 'mesCadastro', rotulo: 'Mês de cadastro', tipo: 'mes' },
    { chave: 'prazoRevisao', rotulo: 'Prazo da próxima revisão', tipo: 'data' },
    { chave: 'situacaoPrazo', rotulo: 'Situação do prazo', tipo: 'texto', valores: ['Vencido', 'Vence em 30 dias', 'Em dia', 'Sem prazo'] },
    { chave: 'diasParaRevisao', rotulo: 'Dias até o prazo (negativo = vencido)', tipo: 'numero' },
    { chave: 'documentos', rotulo: 'Quantidade (1 por documento)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [documentos, extras] = await Promise.all([
      new DocumentoService(contexto.dataverse).getDocumentos(),
      extrasDocumentos(contexto)
    ]);
    return documentos
      .filter(documento => documento.ativo !== false && naArea(contexto, documento.areaId))
      .map(documento => {
        const dias = diasAte(documento.prazoRevisao);
        return {
          area: documento.area || '',
          codigo: documento.codigo,
          titulo: documento.titulo,
          tipo: documento.tipo,
          processo: extras.processoDoDocumento[guid(documento.id)] || 'Sem processo',
          status: documento.status,
          revisao: documento.revisaoAtual || documento.revisao,
          responsavel: documento.responsavel || '',
          criadoEm: documento.criadoEm || '',
          mes: mesDeData(documento.prazoRevisao),
          mesCadastro: mesDeData(documento.criadoEm),
          prazoRevisao: documento.prazoRevisao || '',
          situacaoPrazo: dias === undefined ? 'Sem prazo' : dias < 0 ? 'Vencido' : dias <= 30 ? 'Vence em 30 dias' : 'Em dia',
          diasParaRevisao: dias,
          documentos: 1
        };
      });
  }
};

const fonteRevisoes: IFonte = {
  id: 'documentos.revisoes',
  nome: 'Documentos — revisões em andamento',
  descricao: 'Uma linha por revisão ainda não vigente (em elaboração, revisão, aprovação…): documento, área, responsável, etapa atual do fluxo e há quantos dias está aberta.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Código do documento', tipo: 'texto' },
    { chave: 'titulo', rotulo: 'Título do documento', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo do documento', tipo: 'texto' },
    { chave: 'processo', rotulo: 'Processo', tipo: 'texto' },
    { chave: 'revisao', rotulo: 'Revisão', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status da revisão', tipo: 'texto' },
    { chave: 'etapa', rotulo: 'Etapa atual do fluxo', tipo: 'texto' },
    { chave: 'situacaoFluxo', rotulo: 'Situação do fluxo', tipo: 'texto' },
    { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
    { chave: 'motivo', rotulo: 'Motivo da alteração', tipo: 'texto' },
    { chave: 'retreinamento', rotulo: 'Exige retreinamento', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'dataAbertura', rotulo: 'Data de abertura', tipo: 'data' },
    { chave: 'mes', rotulo: 'Mês de abertura', tipo: 'mes' },
    { chave: 'diasEmAberto', rotulo: 'Dias em aberto', tipo: 'numero' },
    { chave: 'revisoes', rotulo: 'Quantidade (1 por revisão)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [documentos, revisoes, extras] = await Promise.all([
      new DocumentoService(contexto.dataverse).getDocumentos(),
      contexto.dataverse.getDocumentoRevisoesEmAndamento(),
      extrasDocumentos(contexto)
    ]);
    const porId: { [id: string]: typeof documentos[0] } = {};
    documentos.forEach(documento => { porId[guid(documento.id)] = documento; });
    const detalhe: { [id: string]: IDataverseRecord } = {};
    extras.revisoes.forEach(registro => { detalhe[guid(registro.dgt_documentorevisaoid)] = registro; });
    return revisoes
      .map(revisao => ({ revisao, documento: porId[guid(revisao._dgt_documento_value)], extra: detalhe[guid(revisao.dgt_documentorevisaoid)] || {} }))
      .filter(item => !!item.documento && naArea(contexto, item.documento.areaId))
      .map(({ revisao, documento, extra }) => {
        const criada = diasAte(String(revisao.createdon || ''));
        return {
          area: documento.area || '',
          codigo: documento.codigo,
          titulo: documento.titulo,
          tipo: documento.tipo,
          processo: extras.processoDoDocumento[guid(documento.id)] || 'Sem processo',
          revisao: String(revisao.dgt_revisao || ''),
          status: formatado(revisao, 'dgt_status') || 'Em elaboração',
          etapa: String(extra.dgt_etapaatual || '') || 'Sem etapa',
          situacaoFluxo: String(extra.dgt_situacaofluxo || ''),
          responsavel: formatado(revisao, '_dgt_responsavel_value'),
          motivo: String(revisao.dgt_motivoalteracao || ''),
          retreinamento: extra.dgt_requerretreinamento === true ? 'Sim' : 'Não',
          dataAbertura: dataIso(revisao.createdon),
          mes: mesDeData(revisao.createdon),
          diasEmAberto: criada === undefined ? 0 : -criada,
          revisoes: 1
        };
      });
  }
};

// Todas as revisões abertas no ano (andamento, vigentes, substituídas…):
// ciclo de revisão, aprovações e retreinamentos.
const fonteHistoricoRevisoes: IFonte = {
  id: 'documentos.historicoRevisoes',
  nome: 'Documentos — histórico de revisões do ano',
  descricao: 'Uma linha por revisão aberta no ano (em andamento, vigente, substituída…): datas de abertura, aprovação e vigência, dias até aprovar, aprovador, motivo e retreinamento.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Código do documento', tipo: 'texto' },
    { chave: 'titulo', rotulo: 'Título do documento', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo do documento', tipo: 'texto' },
    { chave: 'processo', rotulo: 'Processo', tipo: 'texto' },
    { chave: 'revisao', rotulo: 'Revisão', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status da revisão', tipo: 'texto' },
    { chave: 'etapa', rotulo: 'Etapa atual do fluxo', tipo: 'texto' },
    { chave: 'aprovada', rotulo: 'Aprovada', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
    { chave: 'aprovador', rotulo: 'Aprovado por', tipo: 'texto' },
    { chave: 'motivo', rotulo: 'Motivo da alteração', tipo: 'texto' },
    { chave: 'retreinamento', rotulo: 'Exige retreinamento', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'dataAbertura', rotulo: 'Data de abertura', tipo: 'data' },
    { chave: 'dataAprovacao', rotulo: 'Data da aprovação', tipo: 'data' },
    { chave: 'dataVigencia', rotulo: 'Data de vigência', tipo: 'data' },
    { chave: 'mes', rotulo: 'Mês de abertura', tipo: 'mes' },
    { chave: 'mesAprovacao', rotulo: 'Mês da aprovação', tipo: 'mes' },
    { chave: 'diasAteAprovar', rotulo: 'Dias da abertura até a aprovação', tipo: 'numero' },
    { chave: 'revisoes', rotulo: 'Quantidade (1 por revisão)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [documentos, extras] = await Promise.all([
      new DocumentoService(contexto.dataverse).getDocumentos(),
      extrasDocumentos(contexto)
    ]);
    const porId: { [id: string]: typeof documentos[0] } = {};
    documentos.forEach(documento => { porId[guid(documento.id)] = documento; });
    return extras.revisoes
      .filter(revisao => {
        const data = new Date(String(revisao.createdon || ''));
        return !isNaN(data.getTime()) && data.getFullYear() === contexto.ano;
      })
      .map(revisao => ({ revisao, documento: porId[guid(revisao._dgt_documento_value)] }))
      .filter(item => !!item.documento && naArea(contexto, item.documento.areaId))
      .map(({ revisao, documento }) => {
        const aprovada = !!revisao.dgt_dataaprovacao;
        return {
          area: documento.area || '',
          codigo: documento.codigo,
          titulo: documento.titulo,
          tipo: documento.tipo,
          processo: extras.processoDoDocumento[guid(documento.id)] || 'Sem processo',
          revisao: String(revisao.dgt_revisao || ''),
          status: formatado(revisao, 'dgt_status') || 'Em elaboração',
          etapa: String(revisao.dgt_etapaatual || '') || (aprovada ? 'Concluída' : 'Sem etapa'),
          aprovada: aprovada ? 'Sim' : 'Não',
          responsavel: formatado(revisao, '_dgt_responsavel_value'),
          aprovador: formatado(revisao, '_dgt_aprovadopor_value'),
          motivo: String(revisao.dgt_motivoalteracao || ''),
          retreinamento: revisao.dgt_requerretreinamento === true ? 'Sim' : 'Não',
          dataAbertura: dataIso(revisao.createdon),
          dataAprovacao: dataIso(revisao.dgt_dataaprovacao),
          dataVigencia: dataIso(revisao.dgt_datavigencia),
          mes: mesDeData(revisao.createdon),
          mesAprovacao: mesDeData(revisao.dgt_dataaprovacao),
          diasAteAprovar: diasEntre(revisao.createdon, revisao.dgt_dataaprovacao),
          revisoes: 1
        };
      });
  }
};

// ------------------------------------------------------------
// Consumo de IA (dgt_iaconsumo — gravado pelos plugins de IA)
// ------------------------------------------------------------
// Uma linha por chamada à IA. Não há conteúdo (pergunta/resposta):
// só quem, área, funcionalidade, modelo, tokens e custo. A área segue a
// regra (a) uso / (b) área principal; "Sem área" só aparece para quem
// vê todas as áreas.

const fonteConsumoIa: IFonte = {
  id: 'ia.consumo',
  nome: 'IA — consumo por chamada',
  descricao: 'Uma linha por chamada à IA no ano: usuário, área, funcionalidade, modelo, tokens e custo (US$ e R$).',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'origemArea', rotulo: 'Origem da área (Uso, Principal, Única área, Sem área)', tipo: 'texto', valores: ['Uso', 'Principal', 'Única área', 'Sem área'] },
    { chave: 'usuario', rotulo: 'Usuário', tipo: 'texto' },
    { chave: 'funcionalidade', rotulo: 'Funcionalidade', tipo: 'texto' },
    { chave: 'detalhe', rotulo: 'Detalhe (dashboard ou análise)', tipo: 'texto' },
    { chave: 'modelo', rotulo: 'Modelo de IA', tipo: 'texto' },
    { chave: 'mes', rotulo: 'Mês', tipo: 'mes' },
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'tokensEntrada', rotulo: 'Tokens de entrada', tipo: 'numero' },
    { chave: 'tokensSaida', rotulo: 'Tokens de saída', tipo: 'numero' },
    { chave: 'custoUsd', rotulo: 'Custo (US$)', tipo: 'numero' },
    { chave: 'custoBrl', rotulo: 'Custo (R$)', tipo: 'numero' },
    { chave: 'chamadas', rotulo: 'Quantidade (1 por chamada)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const inicio = new Date(Date.UTC(contexto.ano, 0, 1)).toISOString();
    const fim = new Date(Date.UTC(contexto.ano + 1, 0, 1)).toISOString();
    const registros = await contexto.dataverse.listarRegistros(
      'dgt_iaconsumo',
      '$select=createdon,dgt_areaid,dgt_areanome,dgt_origemarea,dgt_usuarionome,dgt_funcionalidade,dgt_detalhe,dgt_modeloia,dgt_tokensentrada,dgt_tokenssaida,dgt_custousd,dgt_custobrl' +
      `&$filter=createdon ge ${inicio} and createdon lt ${fim}`
    );
    return registros
      .filter(registro => naArea(contexto, String(registro.dgt_areaid || '')))
      .map(registro => {
        const criado = new Date(String(registro.createdon || ''));
        const valido = !isNaN(criado.getTime());
        return {
          area: String(registro.dgt_areanome || 'Sem área'),
          origemArea: String(registro.dgt_origemarea || 'Sem área'),
          usuario: String(registro.dgt_usuarionome || ''),
          funcionalidade: String(registro.dgt_funcionalidade || ''),
          detalhe: String(registro.dgt_detalhe || ''),
          modelo: String(registro.dgt_modeloia || ''),
          mes: valido ? criado.getMonth() + 1 : undefined,
          data: valido ? criado.toISOString().substring(0, 10) : undefined,
          tokensEntrada: Number(registro.dgt_tokensentrada) || 0,
          tokensSaida: Number(registro.dgt_tokenssaida) || 0,
          custoUsd: Number(registro.dgt_custousd) || 0,
          custoBrl: Number(registro.dgt_custobrl) || 0,
          chamadas: 1
        };
      });
  }
};

// ============================================================
// MÓDULOS DA PLATAFORMA — Treinamentos, Documentos (tarefas),
// Ambientes, Licitações, Fornecedores e Projetos
//
// Regra de ÁREA (é o que restringe o gestor ao próprio time):
//  - treinamentos: a linha vale para CADA área ativa do usuário
//    (dgt_usuarioarea); quem está em duas áreas aparece nas duas;
//  - documentos.tarefas: área do documento; ambientes: área do registro;
//  - licitações: área de sigla LIC;
//  - fornecedores e projetos não têm área: só aparecem para quem vê
//    todas as áreas (Administrador), como "Sem área".
// ============================================================

interface IAreaInfo {
  id: string;
  nome: string;
}

// Carga compartilhada por painel: áreas e vínculos usuário → área.
// O cache vale por objeto de contexto (um carregamento de painel).
const cacheBase = new WeakMap<IContextoFonte, Promise<{ areas: { [id: string]: IAreaInfo }; porSigla: { [sigla: string]: IAreaInfo }; areasDoUsuario: { [usuarioId: string]: IAreaInfo[] } }>>();

const baseAreas = (contexto: IContextoFonte): Promise<{ areas: { [id: string]: IAreaInfo }; porSigla: { [sigla: string]: IAreaInfo }; areasDoUsuario: { [usuarioId: string]: IAreaInfo[] } }> => {
  let promessa = cacheBase.get(contexto);
  if (!promessa) {
    promessa = (async () => {
      const [registrosArea, vinculos] = await Promise.all([
        contexto.dataverse.listarRegistros('dgt_area', '$select=dgt_areaid,dgt_name,dgt_sigla'),
        contexto.dataverse.listarRegistros('dgt_usuarioarea', '$select=_dgt_usuario_value,_dgt_area_value&$filter=dgt_ativo eq true')
      ]);
      const areas: { [id: string]: IAreaInfo } = {};
      const porSigla: { [sigla: string]: IAreaInfo } = {};
      registrosArea.forEach(registro => {
        const id = guid(registro.dgt_areaid);
        const sigla = String(registro.dgt_sigla || '').trim();
        const nome = String(registro.dgt_name || '').trim();
        areas[id] = { id, nome: sigla ? `${sigla} · ${nome}` : nome };
        if (sigla) {
          porSigla[sigla.toUpperCase()] = areas[id];
        }
      });
      const areasDoUsuario: { [usuarioId: string]: IAreaInfo[] } = {};
      vinculos.forEach(vinculo => {
        const usuarioId = guid(vinculo._dgt_usuario_value);
        const areaId = guid(vinculo._dgt_area_value);
        if (usuarioId && areaId) {
          (areasDoUsuario[usuarioId] = areasDoUsuario[usuarioId] || []).push(areas[areaId] || { id: areaId, nome: formatado(vinculo, '_dgt_area_value') });
        }
      });
      return { areas, porSigla, areasDoUsuario };
    })();
    cacheBase.set(contexto, promessa);
  }
  return promessa;
};

// Atribuições de treinamento ativas (todas, sem filtro de ano): base de
// avaliações e certificados, que chegam ao usuário por elas.
const cacheAtribuicoes = new WeakMap<IContextoFonte, Promise<{ [atribuicaoId: string]: { usuarioId: string; usuario: string; treinamento: string } }>>();

const atribuicoesPorId = (contexto: IContextoFonte): Promise<{ [atribuicaoId: string]: { usuarioId: string; usuario: string; treinamento: string } }> => {
  let promessa = cacheAtribuicoes.get(contexto);
  if (!promessa) {
    promessa = contexto.dataverse.listarRegistros(
      'dgt_usuariotreinamento',
      '$select=dgt_usuariotreinamentoid,_dgt_usuario_value,_dgt_treinamento_value'
    ).then(registros => {
      const mapa: { [atribuicaoId: string]: { usuarioId: string; usuario: string; treinamento: string } } = {};
      registros.forEach(registro => {
        mapa[guid(registro.dgt_usuariotreinamentoid)] = {
          usuarioId: guid(registro._dgt_usuario_value),
          usuario: formatado(registro, '_dgt_usuario_value'),
          treinamento: formatado(registro, '_dgt_treinamento_value')
        };
      });
      return mapa;
    });
    cacheAtribuicoes.set(contexto, promessa);
  }
  return promessa;
};

// Uma cópia da linha para cada área do usuário que a pessoa pode ver.
// Usuário sem nenhuma área: "Sem área", só para quem vê todas as áreas.
const porAreasDoUsuario = (contexto: IContextoFonte, areas: IAreaInfo[] | undefined, linha: Linha, destino: Linha[]): void => {
  if (!areas || areas.length === 0) {
    if (!contexto.areaIds) {
      destino.push({ ...linha, area: 'Sem área' });
    }
    return;
  }
  areas.filter(area => naArea(contexto, area.id)).forEach(area => destino.push({ ...linha, area: area.nome || 'Sem área' }));
};

// Linhas sem área: só para quem vê todas as áreas.
const semAreaVisivel = (contexto: IContextoFonte): boolean => !contexto.areaIds;

const intervaloDoAno = (contexto: IContextoFonte): { inicio: string; fim: string } => ({
  inicio: new Date(Date.UTC(contexto.ano, 0, 1)).toISOString(),
  fim: new Date(Date.UTC(contexto.ano + 1, 0, 1)).toISOString()
});

// Filtro do ano pela data do registro; sem a data, vale a de criação
// (mesma regra do portal: data da atribuição || createdon).
const filtroAnoComReserva = (contexto: IContextoFonte, campo: string): string => {
  const { inicio, fim } = intervaloDoAno(contexto);
  return `((${campo} ge ${inicio} and ${campo} lt ${fim}) or (${campo} eq null and createdon ge ${inicio} and createdon lt ${fim}))`;
};

const mesDe = (valor: unknown): number | undefined => {
  const data = new Date(String(valor || ''));
  return valor && !isNaN(data.getTime()) ? data.getMonth() + 1 : undefined;
};

const situacaoDeData = (dias: number | undefined, semData: string): string =>
  dias === undefined ? semData : dias < 0 ? 'Vencido' : dias <= 30 ? 'Vence em 30 dias' : 'Em dia';

const SITUACOES_VALIDADE = ['Vencido', 'Vence em 30 dias', 'Em dia', 'Sem validade'];
const SITUACOES_PRAZO = ['Vencido', 'Vence em 30 dias', 'Em dia', 'Sem prazo'];

const simNao = (valor: unknown): string => (valor === true ? 'Sim' : 'Não');

const texto = (valor: unknown): string => (valor === undefined || valor === null ? '' : String(valor));

// ------------------------------------------------------------
// Treinamentos
// ------------------------------------------------------------

const fonteTreinamentosAtribuicoes: IFonte = {
  id: 'treinamentos.atribuicoes',
  nome: 'Treinamentos — atribuições por usuário',
  descricao: 'Uma linha por treinamento atribuído (no ano da atribuição) e área do usuário: status, conclusão, validade, prazo e nota.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'usuario', rotulo: 'Usuário', tipo: 'texto' },
    { chave: 'treinamento', rotulo: 'Treinamento', tipo: 'texto', listarValores: true },
    { chave: 'trilha', rotulo: 'Trilha', tipo: 'texto', listarValores: true },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'origem', rotulo: 'Origem da atribuição', tipo: 'texto', listarValores: true },
    { chave: 'concluido', rotulo: 'Concluído', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'mes', rotulo: 'Mês da atribuição', tipo: 'mes' },
    { chave: 'situacaoValidade', rotulo: 'Situação da validade', tipo: 'texto', valores: SITUACOES_VALIDADE },
    { chave: 'situacaoPrazo', rotulo: 'Situação do prazo (não concluídos)', tipo: 'texto', valores: SITUACOES_PRAZO },
    { chave: 'diasAtraso', rotulo: 'Dias de atraso (não concluídos)', tipo: 'numero' },
    { chave: 'nota', rotulo: 'Nota', tipo: 'numero' },
    { chave: 'atribuicoes', rotulo: 'Quantidade (1 por atribuição)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [base, registros] = await Promise.all([
      baseAreas(contexto),
      contexto.dataverse.listarRegistros(
        'dgt_usuariotreinamento',
        '$select=createdon,dgt_dataatribuicao,dgt_datavalidade,dgt_datalimite,dgt_dataconclusao,dgt_status,dgt_origem,dgt_nota,_dgt_usuario_value,_dgt_treinamento_value,_dgt_trilha_value' +
        `&$filter=dgt_ativo ne false and ${filtroAnoComReserva(contexto, 'dgt_dataatribuicao')}`
      )
    ]);
    const linhas: Linha[] = [];
    registros.forEach(registro => {
      const concluido = !!registro.dgt_dataconclusao;
      const prazo = concluido ? undefined : diasAte(texto(registro.dgt_datalimite) || undefined);
      porAreasDoUsuario(contexto, base.areasDoUsuario[guid(registro._dgt_usuario_value)], {
        usuario: formatado(registro, '_dgt_usuario_value'),
        treinamento: formatado(registro, '_dgt_treinamento_value'),
        trilha: formatado(registro, '_dgt_trilha_value') || 'Sem trilha',
        status: formatado(registro, 'dgt_status'),
        origem: formatado(registro, 'dgt_origem'),
        concluido: simNao(concluido),
        mes: mesDe(registro.dgt_dataatribuicao || registro.createdon),
        situacaoValidade: situacaoDeData(diasAte(texto(registro.dgt_datavalidade) || undefined), 'Sem validade'),
        situacaoPrazo: concluido ? 'Em dia' : situacaoDeData(prazo, 'Sem prazo'),
        diasAtraso: prazo !== undefined && prazo < 0 ? -prazo : 0,
        nota: concluido ? Number(registro.dgt_nota) || 0 : undefined,
        atribuicoes: 1
      }, linhas);
    });
    return linhas;
  }
};

const fonteTreinamentosTrilhas: IFonte = {
  id: 'treinamentos.trilhas',
  nome: 'Treinamentos — trilhas por usuário',
  descricao: 'Uma linha por trilha atribuída (no ano da atribuição) e área do usuário: status, obrigatoriedade, conclusão e prazo.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'usuario', rotulo: 'Usuário', tipo: 'texto' },
    { chave: 'trilha', rotulo: 'Trilha', tipo: 'texto', listarValores: true },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'origem', rotulo: 'Origem da atribuição', tipo: 'texto' },
    { chave: 'obrigatoria', rotulo: 'Obrigatória', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'concluida', rotulo: 'Concluída', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'mes', rotulo: 'Mês da atribuição', tipo: 'mes' },
    { chave: 'situacaoPrazo', rotulo: 'Situação do prazo (não concluídas)', tipo: 'texto', valores: SITUACOES_PRAZO },
    { chave: 'diasAtraso', rotulo: 'Dias de atraso (não concluídas)', tipo: 'numero' },
    { chave: 'trilhas', rotulo: 'Quantidade (1 por trilha atribuída)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [base, registros] = await Promise.all([
      baseAreas(contexto),
      contexto.dataverse.listarRegistros(
        'dgt_usuariotrilha',
        '$select=createdon,dgt_dataatribuicao,dgt_dataconclusao,dgt_datalimite,dgt_obrigatoria,dgt_origem,dgt_status,_dgt_usuario_value,_dgt_trilha_value' +
        `&$filter=dgt_ativa ne false and ${filtroAnoComReserva(contexto, 'dgt_dataatribuicao')}`
      )
    ]);
    const linhas: Linha[] = [];
    registros.forEach(registro => {
      const concluida = !!registro.dgt_dataconclusao;
      const prazo = concluida ? undefined : diasAte(texto(registro.dgt_datalimite) || undefined);
      porAreasDoUsuario(contexto, base.areasDoUsuario[guid(registro._dgt_usuario_value)], {
        usuario: formatado(registro, '_dgt_usuario_value'),
        trilha: formatado(registro, '_dgt_trilha_value'),
        status: formatado(registro, 'dgt_status'),
        origem: formatado(registro, 'dgt_origem'),
        obrigatoria: simNao(registro.dgt_obrigatoria),
        concluida: simNao(concluida),
        mes: mesDe(registro.dgt_dataatribuicao || registro.createdon),
        situacaoPrazo: concluida ? 'Em dia' : situacaoDeData(prazo, 'Sem prazo'),
        diasAtraso: prazo !== undefined && prazo < 0 ? -prazo : 0,
        trilhas: 1
      }, linhas);
    });
    return linhas;
  }
};

const fonteTreinamentosAvaliacoes: IFonte = {
  id: 'treinamentos.avaliacoes',
  nome: 'Treinamentos — tentativas de avaliação',
  descricao: 'Uma linha por tentativa de avaliação iniciada no ano, por área do usuário: nota, acertos, aprovação e tempo.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'usuario', rotulo: 'Usuário', tipo: 'texto' },
    { chave: 'treinamento', rotulo: 'Treinamento', tipo: 'texto' },
    { chave: 'avaliacao', rotulo: 'Avaliação', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status da tentativa', tipo: 'texto' },
    { chave: 'aprovado', rotulo: 'Aprovado', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'numeroTentativa', rotulo: 'Número da tentativa', tipo: 'numero' },
    { chave: 'mes', rotulo: 'Mês', tipo: 'mes' },
    { chave: 'nota', rotulo: 'Nota', tipo: 'numero' },
    { chave: 'acertos', rotulo: 'Acertos', tipo: 'numero' },
    { chave: 'questoes', rotulo: 'Questões', tipo: 'numero' },
    { chave: 'minutos', rotulo: 'Tempo utilizado (min)', tipo: 'numero' },
    { chave: 'tentativas', rotulo: 'Quantidade (1 por tentativa)', tipo: 'numero' },
    { chave: 'aprovacoes', rotulo: 'Aprovações (1 se aprovado)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [base, atribuicoes, registros] = await Promise.all([
      baseAreas(contexto),
      atribuicoesPorId(contexto),
      contexto.dataverse.listarRegistros(
        'dgt_tentativa',
        '$select=createdon,dgt_datainicio,dgt_aprovado,dgt_nota,dgt_acertos,dgt_quantidadequestoes,dgt_numerotentativa,dgt_tempoutilizadoseg,dgt_status,_dgt_avaliacao_value,_dgt_usuariotreinamento_value' +
        `&$filter=dgt_ativa ne false and ${filtroAnoComReserva(contexto, 'dgt_datainicio')}`
      )
    ]);
    const linhas: Linha[] = [];
    registros.forEach(registro => {
      const atribuicao = atribuicoes[guid(registro._dgt_usuariotreinamento_value)];
      if (!atribuicao) {
        return;
      }
      const aprovado = registro.dgt_aprovado === true;
      porAreasDoUsuario(contexto, base.areasDoUsuario[atribuicao.usuarioId], {
        usuario: atribuicao.usuario,
        treinamento: atribuicao.treinamento,
        avaliacao: formatado(registro, '_dgt_avaliacao_value'),
        status: formatado(registro, 'dgt_status'),
        aprovado: simNao(aprovado),
        numeroTentativa: Number(registro.dgt_numerotentativa) || 1,
        mes: mesDe(registro.dgt_datainicio || registro.createdon),
        nota: Number(registro.dgt_nota) || 0,
        acertos: Number(registro.dgt_acertos) || 0,
        questoes: Number(registro.dgt_quantidadequestoes) || 0,
        minutos: Math.round((Number(registro.dgt_tempoutilizadoseg) || 0) / 6) / 10,
        tentativas: 1,
        aprovacoes: aprovado ? 1 : 0
      }, linhas);
    });
    return linhas;
  }
};

const fonteTreinamentosCertificados: IFonte = {
  id: 'treinamentos.certificados',
  nome: 'Treinamentos — certificados emitidos',
  descricao: 'Uma linha por certificado emitido no ano, por área do usuário: treinamento, emissão e situação da validade.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'treinamento', rotulo: 'Treinamento', tipo: 'texto' },
    { chave: 'mes', rotulo: 'Mês da emissão', tipo: 'mes' },
    { chave: 'situacaoValidade', rotulo: 'Situação da validade', tipo: 'texto', valores: SITUACOES_VALIDADE },
    { chave: 'diasParaVencer', rotulo: 'Dias para vencer (negativo = vencido)', tipo: 'numero' },
    { chave: 'certificados', rotulo: 'Quantidade (1 por certificado)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [base, atribuicoes, registros] = await Promise.all([
      baseAreas(contexto),
      atribuicoesPorId(contexto),
      contexto.dataverse.listarRegistros(
        'dgt_certificado',
        '$select=createdon,dgt_dataemissao,dgt_datavalidade,_dgt_usuariotreinamento_value' +
        `&$filter=dgt_ativo ne false and ${filtroAnoComReserva(contexto, 'dgt_dataemissao')}`
      )
    ]);
    const linhas: Linha[] = [];
    registros.forEach(registro => {
      const atribuicao = atribuicoes[guid(registro._dgt_usuariotreinamento_value)];
      if (!atribuicao) {
        return;
      }
      const dias = diasAte(texto(registro.dgt_datavalidade) || undefined);
      porAreasDoUsuario(contexto, base.areasDoUsuario[atribuicao.usuarioId], {
        treinamento: atribuicao.treinamento,
        mes: mesDe(registro.dgt_dataemissao || registro.createdon),
        situacaoValidade: situacaoDeData(dias, 'Sem validade'),
        diasParaVencer: dias,
        certificados: 1
      }, linhas);
    });
    return linhas;
  }
};

// ------------------------------------------------------------
// Documentos — tarefas do fluxo de revisão
// ------------------------------------------------------------

const fonteDocumentosTarefas: IFonte = {
  id: 'documentos.tarefas',
  nome: 'Documentos — tarefas do fluxo de revisão',
  descricao: 'Uma linha por tarefa de etapa do fluxo de revisão criada no ano (pendente ou concluída), pela área do documento.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'documento', rotulo: 'Documento', tipo: 'texto' },
    { chave: 'etapa', rotulo: 'Etapa', tipo: 'texto' },
    { chave: 'situacao', rotulo: 'Situação da tarefa', tipo: 'texto' },
    { chave: 'pendente', rotulo: 'Pendente', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'acao', rotulo: 'Ação executada', tipo: 'texto' },
    { chave: 'mes', rotulo: 'Mês de criação', tipo: 'mes' },
    { chave: 'situacaoPrazo', rotulo: 'Situação do prazo (pendentes)', tipo: 'texto', valores: SITUACOES_PRAZO },
    { chave: 'diasAtraso', rotulo: 'Dias de atraso (pendentes)', tipo: 'numero' },
    { chave: 'diasParaConcluir', rotulo: 'Dias até concluir (concluídas)', tipo: 'numero' },
    { chave: 'tarefas', rotulo: 'Quantidade (1 por tarefa)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const { inicio, fim } = intervaloDoAno(contexto);
    const [documentos, revisoes, registros] = await Promise.all([
      new DocumentoService(contexto.dataverse).getDocumentos(),
      contexto.dataverse.listarRegistros('dgt_documentorevisao', '$select=dgt_documentorevisaoid,_dgt_documento_value'),
      contexto.dataverse.listarRegistros(
        'dgt_tarefafluxo',
        '$select=createdon,dgt_etapanome,dgt_situacao,dgt_acaorotulo,dgt_prazo,dgt_concluidaem,_dgt_documentorevisao_value' +
        `&$filter=createdon ge ${inicio} and createdon lt ${fim}`
      )
    ]);
    const documentoPorId: { [id: string]: { area: string; areaId?: string; rotulo: string } } = {};
    documentos.forEach(documento => {
      documentoPorId[guid(documento.id)] = { area: documento.area || '', areaId: documento.areaId, rotulo: [documento.codigo, documento.titulo].filter(Boolean).join(' — ') };
    });
    const documentoDaRevisao: { [revisaoId: string]: string } = {};
    revisoes.forEach(revisao => { documentoDaRevisao[guid(revisao.dgt_documentorevisaoid)] = guid(revisao._dgt_documento_value); });
    return registros
      .map(registro => ({ registro, documento: documentoPorId[documentoDaRevisao[guid(registro._dgt_documentorevisao_value)]] }))
      .filter(item => !!item.documento && naArea(contexto, item.documento.areaId))
      .map(({ registro, documento }) => {
        const pendente = !registro.dgt_concluidaem;
        const prazo = pendente ? diasAte(texto(registro.dgt_prazo) || undefined) : undefined;
        const criada = new Date(texto(registro.createdon)).getTime();
        const concluida = new Date(texto(registro.dgt_concluidaem)).getTime();
        return {
          area: documento.area || 'Sem área',
          documento: documento.rotulo,
          etapa: texto(registro.dgt_etapanome),
          situacao: texto(registro.dgt_situacao) || (pendente ? 'Pendente' : 'Concluída'),
          pendente: simNao(pendente),
          acao: texto(registro.dgt_acaorotulo),
          mes: mesDe(registro.createdon),
          situacaoPrazo: pendente ? situacaoDeData(prazo, 'Sem prazo') : 'Em dia',
          diasAtraso: prazo !== undefined && prazo < 0 ? -prazo : 0,
          diasParaConcluir: !pendente && !isNaN(criada) && !isNaN(concluida) ? Math.max(0, Math.round((concluida - criada) / 86400000)) : undefined,
          tarefas: 1
        };
      });
  }
};

// ------------------------------------------------------------
// Ambientes — registros (solicitações e processos)
// ------------------------------------------------------------

const fonteAmbientesRegistros: IFonte = {
  id: 'ambientes.registros',
  nome: 'Ambientes — registros dos fluxos',
  descricao: 'Uma linha por registro de ambiente aberto no ano (solicitações, processos…): etapa atual, situação, prazo da etapa e tempo até concluir.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'ambiente', rotulo: 'Ambiente', tipo: 'texto', listarValores: true },
    { chave: 'codigo', rotulo: 'Código', tipo: 'texto' },
    { chave: 'registro', rotulo: 'Registro', tipo: 'texto' },
    { chave: 'etapa', rotulo: 'Etapa atual', tipo: 'texto', listarValores: true },
    { chave: 'situacao', rotulo: 'Situação', tipo: 'texto' },
    { chave: 'concluido', rotulo: 'Concluído/cancelado', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'mes', rotulo: 'Mês de abertura', tipo: 'mes' },
    { chave: 'situacaoPrazo', rotulo: 'Prazo da etapa (em andamento)', tipo: 'texto', valores: SITUACOES_PRAZO },
    { chave: 'diasAtraso', rotulo: 'Dias de atraso da etapa', tipo: 'numero' },
    { chave: 'diasAteConcluir', rotulo: 'Dias até concluir', tipo: 'numero' },
    { chave: 'registros', rotulo: 'Quantidade (1 por registro)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const { inicio, fim } = intervaloDoAno(contexto);
    const [base, registros] = await Promise.all([
      baseAreas(contexto),
      contexto.dataverse.listarRegistros(
        'dgt_ambienteregistro',
        '$select=createdon,dgt_codigo,dgt_name,dgt_etapaatual,dgt_situacao,dgt_prazoetapa,dgt_concluidoem,_dgt_ambiente_value,_dgt_area_value' +
        `&$filter=createdon ge ${inicio} and createdon lt ${fim}`
      )
    ]);
    return registros
      .filter(registro => (registro._dgt_area_value ? naArea(contexto, guid(registro._dgt_area_value)) : semAreaVisivel(contexto)))
      .map(registro => {
        const concluido = !!registro.dgt_concluidoem;
        const prazo = concluido ? undefined : diasAte(texto(registro.dgt_prazoetapa) || undefined);
        const aberto = new Date(texto(registro.createdon)).getTime();
        const fechado = new Date(texto(registro.dgt_concluidoem)).getTime();
        const area = base.areas[guid(registro._dgt_area_value)];
        return {
          area: area ? area.nome : (formatado(registro, '_dgt_area_value') || 'Sem área'),
          ambiente: formatado(registro, '_dgt_ambiente_value'),
          codigo: texto(registro.dgt_codigo),
          registro: texto(registro.dgt_name),
          etapa: concluido ? 'Concluído' : texto(registro.dgt_etapaatual),
          situacao: texto(registro.dgt_situacao),
          concluido: simNao(concluido),
          mes: mesDe(registro.createdon),
          situacaoPrazo: concluido ? 'Em dia' : situacaoDeData(prazo, 'Sem prazo'),
          diasAtraso: prazo !== undefined && prazo < 0 ? -prazo : 0,
          diasAteConcluir: concluido && !isNaN(aberto) && !isNaN(fechado) ? Math.max(0, Math.round((fechado - aberto) / 86400000)) : undefined,
          registros: 1
        };
      });
  }
};

// ------------------------------------------------------------
// Licitações — editais acompanhados
// ------------------------------------------------------------

const fonteLicitacoesEditais: IFonte = {
  id: 'licitacoes.editais',
  nome: 'Licitações — editais acompanhados',
  descricao: 'Uma linha por edital do PNCP acompanhado e ativo (todos os anos de cadastro): órgão, modalidade, situação e valor estimado. Área: Licitações (LIC).',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'edital', rotulo: 'Edital', tipo: 'texto' },
    { chave: 'orgao', rotulo: 'Órgão', tipo: 'texto' },
    { chave: 'modalidade', rotulo: 'Modalidade', tipo: 'texto' },
    { chave: 'local', rotulo: 'Local', tipo: 'texto' },
    { chave: 'situacao', rotulo: 'Situação', tipo: 'texto' },
    { chave: 'abertura', rotulo: 'Abertura das propostas', tipo: 'texto' },
    { chave: 'mes', rotulo: 'Mês do cadastro', tipo: 'mes' },
    { chave: 'valorEstimado', rotulo: 'Valor estimado (R$)', tipo: 'numero' },
    { chave: 'editais', rotulo: 'Quantidade (1 por edital)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [base, registros] = await Promise.all([
      baseAreas(contexto),
      contexto.dataverse.listarRegistros(
        'dgt_licitacaoacompanhamento',
        '$select=createdon,dgt_numeroedital,dgt_name,dgt_orgao,dgt_modalidade,dgt_local,dgt_situacao,dgt_dataabertura,dgt_valorestimado&$filter=dgt_ativo ne false'
      )
    ]);
    const areaLic = base.porSigla.LIC;
    if (areaLic ? !naArea(contexto, areaLic.id) : !semAreaVisivel(contexto)) {
      return [];
    }
    return registros.map(registro => ({
      area: areaLic ? areaLic.nome : 'Sem área',
      edital: texto(registro.dgt_numeroedital) || texto(registro.dgt_name),
      orgao: texto(registro.dgt_orgao),
      modalidade: texto(registro.dgt_modalidade),
      local: texto(registro.dgt_local),
      situacao: texto(registro.dgt_situacao),
      abertura: texto(registro.dgt_dataabertura),
      mes: mesDe(registro.createdon),
      valorEstimado: Number(registro.dgt_valorestimado) || 0,
      editais: 1
    }));
  }
};

// ------------------------------------------------------------
// Fornecedores — documentos e validade (sem área)
// ------------------------------------------------------------

const fonteFornecedoresDocumentos: IFonte = {
  id: 'fornecedores.documentos',
  nome: 'Fornecedores — documentos vigentes',
  descricao: 'Uma linha por documento VIGENTE de fornecedor (todos os anos): tipo, emissão e situação da validade. Sem área: só para quem vê todas as áreas.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'fornecedor', rotulo: 'Fornecedor', tipo: 'texto' },
    { chave: 'tipoDocumento', rotulo: 'Tipo de documento', tipo: 'texto' },
    { chave: 'situacaoValidade', rotulo: 'Situação da validade', tipo: 'texto', valores: SITUACOES_VALIDADE },
    { chave: 'diasParaVencer', rotulo: 'Dias para vencer (negativo = vencido)', tipo: 'numero' },
    { chave: 'mes', rotulo: 'Mês da emissão', tipo: 'mes' },
    { chave: 'documentos', rotulo: 'Quantidade (1 por documento)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    if (!semAreaVisivel(contexto)) {
      return [];
    }
    const registros = await contexto.dataverse.listarRegistros(
      'dgt_fornecedordocumento',
      "$select=dgt_dataemissao,dgt_datavencimento,_dgt_fornecedor_value,_dgt_tipodocumento_value&$filter=dgt_situacao eq 'Vigente'"
    );
    return registros.map(registro => {
      const dias = diasAte(texto(registro.dgt_datavencimento) || undefined);
      return {
        area: 'Sem área',
        fornecedor: formatado(registro, '_dgt_fornecedor_value'),
        tipoDocumento: formatado(registro, '_dgt_tipodocumento_value'),
        situacaoValidade: situacaoDeData(dias, 'Sem validade'),
        diasParaVencer: dias,
        mes: mesDe(registro.dgt_dataemissao),
        documentos: 1
      };
    });
  }
};

// ------------------------------------------------------------
// Projetos (PMO) — atividades do cronograma (sem área)
// ------------------------------------------------------------

const fonteProjetosAtividades: IFonte = {
  id: 'projetos.atividades',
  nome: 'Projetos — atividades do cronograma',
  descricao: 'Uma linha por atividade do cronograma dos projetos do PMO (todos os anos): fase, status, % realizado, peso e atraso em relação ao fim previsto. Sem área: só para quem vê todas as áreas.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'projeto', rotulo: 'Projeto', tipo: 'texto' },
    { chave: 'fase', rotulo: 'Fase / frente', tipo: 'texto' },
    { chave: 'atividade', rotulo: 'Atividade', tipo: 'texto' },
    { chave: 'grupo', rotulo: 'Grupo (G1 a G5)', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'marco', rotulo: 'Marco de medição', tipo: 'texto', valores: ['Sim', 'Não'] },
    { chave: 'situacaoPrazo', rotulo: 'Situação do prazo (não concluídas)', tipo: 'texto', valores: SITUACOES_PRAZO },
    { chave: 'mes', rotulo: 'Mês do fim previsto', tipo: 'mes' },
    { chave: 'percentualRealizado', rotulo: '% realizado', tipo: 'numero' },
    { chave: 'peso', rotulo: 'Peso', tipo: 'numero' },
    { chave: 'diasAtraso', rotulo: 'Dias de atraso (não concluídas)', tipo: 'numero' },
    { chave: 'valorMarco', rotulo: 'Valor do marco (R$)', tipo: 'numero' },
    { chave: 'atividades', rotulo: 'Quantidade (1 por atividade)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    if (!semAreaVisivel(contexto)) {
      return [];
    }
    const registros = await contexto.dataverse.listarRegistros(
      'dgt_projetoatividade',
      '$select=dgt_name,dgt_fase,dgt_grupo,dgt_status,dgt_marco,dgt_fim,dgt_fimrevisado,dgt_fimrealizado,dgt_percentualrealizado,dgt_peso,dgt_valor,_dgt_projeto_value'
    );
    return registros.map(registro => {
      const concluida = !!registro.dgt_fimrealizado || Number(registro.dgt_percentualrealizado) >= 100;
      const fimPrevisto = texto(registro.dgt_fimrevisado) || texto(registro.dgt_fim);
      const prazo = concluida ? undefined : diasAte(fimPrevisto || undefined);
      return {
        area: 'Sem área',
        projeto: formatado(registro, '_dgt_projeto_value'),
        fase: texto(registro.dgt_fase),
        atividade: texto(registro.dgt_name),
        grupo: registro.dgt_grupo ? `G${registro.dgt_grupo}` : '',
        status: texto(registro.dgt_status),
        marco: simNao(registro.dgt_marco),
        situacaoPrazo: concluida ? 'Em dia' : situacaoDeData(prazo, 'Sem prazo'),
        mes: mesDe(fimPrevisto),
        percentualRealizado: Number(registro.dgt_percentualrealizado) || 0,
        peso: Number(registro.dgt_peso) || 0,
        diasAtraso: prazo !== undefined && prazo < 0 ? -prazo : 0,
        valorMarco: Number(registro.dgt_valor) || 0,
        atividades: 1
      };
    });
  }
};

export const FONTES_DASHBOARD: IFonte[] = [
  fonteOrcamentoLinhas,
  fonteOrcamentoDre,
  fonteOrcamentoPlanilhas,
  fonteDocumentos,
  fonteRevisoes,
  fonteHistoricoRevisoes,
  fonteConsumoIa,
  fonteTreinamentosAtribuicoes,
  fonteTreinamentosTrilhas,
  fonteTreinamentosAvaliacoes,
  fonteTreinamentosCertificados,
  fonteDocumentosTarefas,
  fonteAmbientesRegistros,
  fonteLicitacoesEditais,
  fonteFornecedoresDocumentos,
  fonteProjetosAtividades
];

// Catálogo sem as funções (para validar e para a skill).
export const CATALOGO_DASHBOARD: IDescricaoFonte[] =
  FONTES_DASHBOARD.map(fonte => ({ id: fonte.id, nome: fonte.nome, descricao: fonte.descricao, campos: fonte.campos }));

export const carregarFonte = async (id: string, contexto: IContextoFonte): Promise<Linha[]> => {
  const fonte = FONTES_DASHBOARD.filter(item => item.id === id)[0];
  return fonte ? fonte.carregar(contexto) : [];
};

export const rotuloMes = (mes: unknown): string => {
  const numero = Number(mes);
  return numero >= 1 && numero <= 12 ? NOMES_MESES[numero - 1] : String(mes === undefined || mes === null ? '' : mes);
};
