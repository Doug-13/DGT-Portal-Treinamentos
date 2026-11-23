import {
  DIAS_AVISO_VENCIMENTO,
  IContratoFornecedor
} from './modeloFornecedores';

import {
  diasAte
} from './situacaoDocumental';

// ============================================================
// FORNECEDORES — CONTRATOS (cálculo puro, testável)
//
// A situação gravada é só Vigente ou Encerrado (encerrar é manual).
// "Vence em N dias" e "Vencido" são calculados pelo fim da vigência.
// Sem fim de vigência = prazo indeterminado (nunca vence).
// ============================================================

export type SituacaoContrato = 'Vigente' | 'Vence em breve' | 'Vencido' | 'Encerrado';

export interface ISituacaoContrato {
  situacao: SituacaoContrato;
  texto: string;
  dias?: number;
}

export const situacaoDoContrato = (
  c: Pick<IContratoFornecedor, 'situacao' | 'fimVigencia'>,
  hoje: Date = new Date(),
  antecedencia: number = 30
): ISituacaoContrato => {
  if (c.situacao === 'Encerrado') {
    return { situacao: 'Encerrado', texto: 'Encerrado' };
  }
  const dias = diasAte(c.fimVigencia, hoje);
  if (dias === undefined) {
    return { situacao: 'Vigente', texto: 'Vigente (prazo indeterminado)' };
  }
  if (dias < 0) {
    return { situacao: 'Vencido', texto: `Vencido há ${-dias} dia(s)`, dias };
  }
  if (dias <= antecedencia) {
    return { situacao: 'Vence em breve', texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`, dias };
  }
  return { situacao: 'Vigente', texto: 'Vigente', dias };
};

// Contratos que entram no aviso interno de vencimento (Power Automate E2):
// vigentes, com fim de vigência entre hoje e hoje + antecedência.
export const contratoNoAvisoDeVencimento = (
  c: Pick<IContratoFornecedor, 'situacao' | 'fimVigencia'>,
  hoje: Date = new Date(),
  antecedencia: number = DIAS_AVISO_VENCIMENTO
): boolean => {
  if (c.situacao !== 'Vigente') {
    return false;
  }
  const dias = diasAte(c.fimVigencia, hoje);
  return dias !== undefined && dias >= 0 && dias <= antecedencia;
};

export interface IDadosContrato {
  nome: string;
  projeto: string;
  dataAssinatura: string;
  inicioVigencia: string;
  fimVigencia: string;
  observacoes: string;
}

// O que impede gravar (vazio = pode gravar).
export const validarContrato = (d: IDadosContrato): string => {
  if (!(d.nome || '').trim()) {
    return 'Informe o nome do contrato.';
  }
  if (!(d.projeto || '').trim()) {
    return 'Informe o projeto.';
  }
  if (!d.inicioVigencia) {
    return 'Informe o início da vigência.';
  }
  if (d.fimVigencia && d.fimVigencia < d.inicioVigencia) {
    return 'O fim da vigência não pode ser anterior ao início.';
  }
  if (d.dataAssinatura && d.fimVigencia && d.dataAssinatura > d.fimVigencia) {
    return 'A data de assinatura não pode ser posterior ao fim da vigência.';
  }
  return '';
};

// Projetos já usados (para o filtro), sem repetir e em ordem alfabética.
export const projetosDistintos = (contratos: IContratoFornecedor[]): string[] => {
  const vistos: Record<string, string> = {};
  contratos.forEach(c => {
    const p = (c.projeto || '').trim();
    if (p && !vistos[p.toLowerCase()]) {
      vistos[p.toLowerCase()] = p;
    }
  });
  return Object.keys(vistos).map(k => vistos[k]).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

export type OrdemContrato = 'assinatura' | 'inicio' | 'fim';

// Mais recente primeiro; sem data vai para o fim.
export const ordenarContratos = (contratos: IContratoFornecedor[], ordem: OrdemContrato): IContratoFornecedor[] => {
  const campo = ordem === 'assinatura' ? 'dataAssinatura' : ordem === 'inicio' ? 'inicioVigencia' : 'fimVigencia';
  return contratos.slice().sort((a, b) => {
    const va = a[campo] || '';
    const vb = b[campo] || '';
    if (!va && !vb) { return a.nome.localeCompare(b.nome, 'pt-BR'); }
    if (!va) { return 1; }
    if (!vb) { return -1; }
    return vb.localeCompare(va);
  });
};

// Filtro por projeto ('' = todos) e, opcionalmente, só os que vencem em
// até "venceEm" dias (inclui os já vencidos e não encerrados).
export const filtrarContratos = (
  contratos: IContratoFornecedor[],
  projeto: string,
  venceEm?: number,
  hoje: Date = new Date()
): IContratoFornecedor[] =>
  contratos.filter(c => {
    if (projeto && (c.projeto || '').trim().toLowerCase() !== projeto.trim().toLowerCase()) {
      return false;
    }
    if (venceEm !== undefined) {
      const s = situacaoDoContrato(c, hoje, venceEm);
      return s.situacao === 'Vence em breve' || s.situacao === 'Vencido';
    }
    return true;
  });
