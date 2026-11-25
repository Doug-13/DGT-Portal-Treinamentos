// ============================================================
// CÁLCULO DE HH — COMPLEMENTOS DO B.O.M.
//
// Duas perguntas da etapa Cálculo de HH da Arquitetura:
//   Tem integração?              → nº de horas × valor HH desenvolvimento × (1 + BDI)
//   Tem contrato de manutenção?  → nº de pontos × valor do ponto
// Ficam gravadas na seleção de kit (mesmo JSON do B.O.M.).
// ============================================================

export interface IIntegracaoHH {
  tem: boolean;
  horas: number;
  // R$ por hora de desenvolvimento, antes do BDI.
  valorHora: number;
  // Taxa BDI em % (ex.: 25 = 25%).
  bdi: number;
}

export interface IManutencaoHH {
  tem: boolean;
  pontos: number;
  // R$ por ponto.
  valorPonto: number;
}

export interface IComplementosHH {
  // Vazio = pergunta ainda não respondida.
  integracao?: IIntegracaoHH;
  manutencao?: IManutencaoHH;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

// Valores sugeridos ao responder "Sim" (o usuário pode editar).
export const VALOR_HH_DESENVOLVIMENTO_PADRAO = 350;
export const VALOR_PONTO_MANUTENCAO_PADRAO = 96.92;

const n = (v: number | undefined): number => Math.max(0, Number(v) || 0);

export const totalIntegracaoSemBdi = (i?: IIntegracaoHH): number =>
  i && i.tem ? n(i.horas) * n(i.valorHora) : 0;

export const totalIntegracao = (i?: IIntegracaoHH): number =>
  totalIntegracaoSemBdi(i) * (1 + n(i ? i.bdi : 0) / 100);

export const totalManutencao = (m?: IManutencaoHH): number =>
  m && m.tem ? n(m.pontos) * n(m.valorPonto) : 0;

// O que falta para as respostas estarem completas (vazio = ok).
export const pendenciasComplementos = (c?: IComplementosHH): string[] => {
  const faltas: string[] = [];
  const i = c ? c.integracao : undefined;
  const m = c ? c.manutencao : undefined;
  if (!i) {
    faltas.push('Responda se tem integração.');
  } else if (i.tem && (n(i.horas) === 0 || n(i.valorHora) === 0)) {
    faltas.push('Integração: informe o nº de horas e o valor HH de desenvolvimento.');
  }
  if (!m) {
    faltas.push('Responda se tem contrato de manutenção.');
  } else if (m.tem && (n(m.pontos) === 0 || n(m.valorPonto) === 0)) {
    faltas.push('Manutenção: informe o nº de pontos e o valor do ponto.');
  }
  return faltas;
};
