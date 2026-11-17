import {
  IDocumentoColaborador
} from './modeloFornecedores';

import {
  EstadoDocumento,
  estadoPeloVencimento
} from './situacaoDocumental';

// ============================================================
// FORNECEDORES — COLABORADORES DO PRESTADOR (cálculo puro, testável)
//
// Documentos de cada colaborador:
//   ASO           → obrigatório, com validade (um vigente por vez)
//   NR aplicável  → texto livre com a norma (NR-10, NR-35...), com
//                   validade; um vigente por norma
// O CPF é só identificação: valida o dígito e nunca vai para texto
// livre, histórico ou e-mail.
// ============================================================

export const normalizarCpf = (valor: string): string => (valor || '').replace(/\D/g, '').substring(0, 11);

export const cpfValido = (valor: string): boolean => {
  const cpf = normalizarCpf(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base.charAt(i)) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(cpf.substring(0, 9), 10);
  const d2 = digito(cpf.substring(0, 10), 11);
  return d1 === Number(cpf.charAt(9)) && d2 === Number(cpf.charAt(10));
};

export const formatarCpf = (valor: string): string => {
  const d = normalizarCpf(valor);
  return d.length === 11 ? `${d.substring(0, 3)}.${d.substring(3, 6)}.${d.substring(6, 9)}-${d.substring(9)}` : d;
};

// "***.***.789-01" — só os últimos dígitos, até a pessoa pedir para ver.
export const mascararCpf = (valor: string): string => {
  const d = normalizarCpf(valor);
  return d.length === 11 ? `***.***.${d.substring(6, 9)}-${d.substring(9)}` : (d ? '***' : '');
};

// Mesma norma escrita de jeitos diferentes ("NR 10", "nr-10") = mesma chave.
export const chaveNorma = (norma: string): string =>
  (norma || '').toUpperCase().replace(/\s+/g, '').replace(/^NR-?/, 'NR-');

export const chaveDocumento = (d: Pick<IDocumentoColaborador, 'tipo' | 'norma'>): string =>
  d.tipo === 'ASO' ? 'ASO' : `NR|${chaveNorma(d.norma)}`;

export interface IItemColaborador {
  chave: string;
  rotulo: string;
  documento?: IDocumentoColaborador;
  estado: EstadoDocumento;
  dias?: number;
}

export interface ISituacaoColaborador {
  aso: IItemColaborador;
  nrs: IItemColaborador[];
  pendente: boolean;   // ASO faltando/vencido ou alguma NR vencida
}

// Vigente mais recente por chave (ASO ou NR + norma).
export const vigentesDoColaborador = (documentos: IDocumentoColaborador[]): Record<string, IDocumentoColaborador> => {
  const mapa: Record<string, IDocumentoColaborador> = {};
  documentos
    .filter(d => d.situacao === 'Vigente')
    .forEach(d => {
      const chave = chaveDocumento(d);
      const atual = mapa[chave];
      if (!atual || `${d.emissao}|${d.criadoEm}` > `${atual.emissao}|${atual.criadoEm}`) {
        mapa[chave] = d;
      }
    });
  return mapa;
};

export const situacaoColaborador = (
  documentos: IDocumentoColaborador[],
  hoje: Date = new Date()
): ISituacaoColaborador => {
  const vigentes = vigentesDoColaborador(documentos);

  const item = (chave: string, rotulo: string, documento?: IDocumentoColaborador): IItemColaborador => {
    if (!documento) {
      return { chave, rotulo, estado: 'Faltando' };
    }
    const { estado, dias } = estadoPeloVencimento(documento.vencimento, hoje);
    return { chave, rotulo, documento, estado, dias };
  };

  const aso = item('ASO', 'ASO', vigentes.ASO);
  const nrs = Object.keys(vigentes)
    .filter(k => k !== 'ASO')
    .map(k => item(k, vigentes[k].norma || 'NR', vigentes[k]))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));

  return {
    aso,
    nrs,
    pendente: aso.estado === 'Faltando' || aso.estado === 'Vencido' || nrs.some(n => n.estado === 'Vencido')
  };
};
