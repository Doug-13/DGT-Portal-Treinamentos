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
    { chave: 'grupo', rotulo: 'Grupo', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Código', tipo: 'texto' },
    { chave: 'conta', rotulo: 'Conta', tipo: 'texto' },
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

const fonteDocumentos: IFonte = {
  id: 'documentos.documentos',
  nome: 'Documentos — cadastro e prazos de revisão',
  descricao: 'Uma linha por documento ativo: área, tipo, status, revisão atual e prazo da próxima revisão periódica.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Código', tipo: 'texto' },
    { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'revisao', rotulo: 'Revisão atual', tipo: 'texto' },
    { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
    { chave: 'prazoRevisao', rotulo: 'Prazo da próxima revisão', tipo: 'data' },
    { chave: 'situacaoPrazo', rotulo: 'Situação do prazo', tipo: 'texto', valores: ['Vencido', 'Vence em 30 dias', 'Em dia', 'Sem prazo'] },
    { chave: 'diasParaRevisao', rotulo: 'Dias até o prazo (negativo = vencido)', tipo: 'numero' },
    { chave: 'documentos', rotulo: 'Quantidade (1 por documento)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const documentos = await new DocumentoService(contexto.dataverse).getDocumentos();
    return documentos
      .filter(documento => documento.ativo !== false && naArea(contexto, documento.areaId))
      .map(documento => {
        const dias = diasAte(documento.prazoRevisao);
        return {
          area: documento.area || '',
          codigo: documento.codigo,
          titulo: documento.titulo,
          tipo: documento.tipo,
          status: documento.status,
          revisao: documento.revisaoAtual || documento.revisao,
          responsavel: documento.responsavel || '',
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
  descricao: 'Uma linha por revisão ainda não vigente (em elaboração, revisão, aprovação…), com o documento, a área e há quantos dias está aberta.',
  campos: [
    { chave: 'area', rotulo: 'Área', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Código do documento', tipo: 'texto' },
    { chave: 'titulo', rotulo: 'Título do documento', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo do documento', tipo: 'texto' },
    { chave: 'revisao', rotulo: 'Revisão', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status da revisão', tipo: 'texto' },
    { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
    { chave: 'diasEmAberto', rotulo: 'Dias em aberto', tipo: 'numero' },
    { chave: 'revisoes', rotulo: 'Quantidade (1 por revisão)', tipo: 'numero' }
  ],
  carregar: async contexto => {
    const [documentos, revisoes] = await Promise.all([
      new DocumentoService(contexto.dataverse).getDocumentos(),
      contexto.dataverse.getDocumentoRevisoesEmAndamento()
    ]);
    const porId: { [id: string]: typeof documentos[0] } = {};
    documentos.forEach(documento => { porId[guid(documento.id)] = documento; });
    return revisoes
      .map(revisao => ({ revisao, documento: porId[guid(revisao._dgt_documento_value)] }))
      .filter(item => !!item.documento && naArea(contexto, item.documento.areaId))
      .map(({ revisao, documento }) => {
        const criada = diasAte(String(revisao.createdon || ''));
        return {
          area: documento.area || '',
          codigo: documento.codigo,
          titulo: documento.titulo,
          tipo: documento.tipo,
          revisao: String(revisao.dgt_revisao || ''),
          status: formatado(revisao, 'dgt_status') || 'Em elaboração',
          responsavel: formatado(revisao, '_dgt_responsavel_value'),
          diasEmAberto: criada === undefined ? 0 : -criada,
          revisoes: 1
        };
      });
  }
};

export const FONTES_DASHBOARD: IFonte[] = [
  fonteOrcamentoLinhas,
  fonteOrcamentoDre,
  fonteOrcamentoPlanilhas,
  fonteDocumentos,
  fonteRevisoes
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
