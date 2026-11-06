import {
  ISelecaoKit,
  montarBom,
  normalizarSelecao
} from '../../../services/bom/montadorBom';

import {
  hhParaBom
} from '../../../services/hh/calculoHH';

import {
  AREAS_HH,
  IDadosHH
} from '../../../services/hh/modeloHH';

import {
  IVersaoHH
} from '../../../services/hh/HHService';

import {
  IEnvelopeComponente,
  lerEnvelopeComponente
} from '../../../services/fluxo/valorComponente';

// ============================================================
// Cálculo de HH → envelope do campo "Componente" (puro, testável)
//
// Pontos = os da Seleção de kit do registro (campo Componente do
// Montador de B.O.M.). Para cada área com HH VIGENTE: HH por ponto ×
// pontos e a alocação sobre o custo total. O envelope guarda QUAL
// versão de HH foi aplicada (id, número, mês) — auditoria.
// ============================================================

export type VigentesHH = Record<string, { versao: IVersaoHH; dados: IDadosHH }>;

export interface IAreaHHAplicada {
  area: string;
  nome: string;
  versaoId: string;
  versao: number;
  mesReferencia: string;
  hhPorPonto: number;
  pontos: number;
  hhPontos: number;
  pctFixo: number;
  valorAnalista: number;
  horasAnalista: number;
  valorSuprimentos: number;
  horasSuprimentos: number;
}

export interface IDadosComponenteHH {
  custoTotal: number;
  pontos: number;
  kit: string;
  areas: IAreaHHAplicada[];
  totalHHPontos: number;
  calculadoEm: string;
}

export interface IKitDoRegistro {
  pontos: number;
  resumo: string;
  // A Seleção de kit está válida (sem erros)?
  valida: boolean;
}

// Pontos e resumo da Seleção de kit gravada noutro campo.
export const kitDoRegistro = (
  valorCampoKit?: string
): IKitDoRegistro => {
  const envelope = lerEnvelopeComponente(valorCampoKit);
  if (!envelope || !envelope.dados) {
    return { pontos: 0, resumo: '', valida: false };
  }
  const resultado = montarBom(normalizarSelecao(envelope.dados as ISelecaoKit));
  return {
    pontos: resultado.totais.pontos,
    resumo:
      `${resultado.totais.pontos} ponto(s) · ${resultado.totais.camerasVideo} câmera(s) de vídeo · ` +
      `${resultado.totais.camerasOcr} OCR/LPR · ${resultado.totais.leitoras} leitora(s)`,
    valida: envelope.valido
  };
};

const moeda = (valor: number): string =>
  `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const envelopeDoHH = (
  kit: IKitDoRegistro,
  custoTotal: number,
  vigentes: VigentesHH,
  exigirCusto: boolean,
  agora: Date = new Date()
): IEnvelopeComponente => {

  const erros: string[] = [];
  const areas: IAreaHHAplicada[] =
    AREAS_HH
      .filter(area => !!vigentes[area.chave])
      .map(area => {
        const vigente = vigentes[area.chave];
        const r = hhParaBom(area.chave, vigente.dados, kit.pontos, custoTotal);
        return {
          area: area.chave,
          nome: area.nome,
          versaoId: vigente.versao.id,
          versao: vigente.versao.versao,
          mesReferencia: vigente.versao.mesReferencia,
          hhPorPonto: r.hhPorPonto,
          pontos: r.pontos,
          hhPontos: r.hhPontos,
          pctFixo: r.pctFixo,
          valorAnalista: r.valorAnalista,
          horasAnalista: r.horasAnalista,
          valorSuprimentos: r.valorSuprimentos,
          horasSuprimentos: r.horasSuprimentos
        };
      });

  if (kit.pontos <= 0) {
    erros.push('A Seleção de kit ainda não tem pontos: conclua-a antes do HH.');
  } else if (!kit.valida) {
    erros.push('A Seleção de kit tem erros: corrija-a antes do HH.');
  }
  if (areas.length === 0) {
    erros.push('Nenhuma área com HH publicado (menu Cálculo de HH).');
  }
  if (exigirCusto && !(custoTotal > 0)) {
    erros.push('Informe o custo total do projeto para a alocação de horas.');
  }

  const totalHHPontos = areas.reduce((soma, item) => soma + item.hhPontos, 0);
  const dados: IDadosComponenteHH = {
    custoTotal,
    pontos: kit.pontos,
    kit: kit.resumo,
    areas,
    totalHHPontos,
    calculadoEm: agora.toISOString()
  };

  return {
    dados,
    valido: erros.length === 0,
    erros,
    resumo: areas.length > 0
      ? `HH dos pontos ${moeda(totalHHPontos)} · ${kit.pontos} ponto(s) · ${areas.map(item => `${item.nome} v${item.versao}`).join(', ')}`
      : 'Sem HH vigente'
  };
};

// Custo digitado ("250.000,00" ou "250000.5") → número.
export const lerCusto = (texto?: string): number => {
  const limpo = String(texto || '').trim();
  if (!limpo) {
    return 0;
  }
  const normalizado = limpo.indexOf(',') >= 0 ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const numero = Number(normalizado);
  return isFinite(numero) && numero > 0 ? numero : 0;
};
