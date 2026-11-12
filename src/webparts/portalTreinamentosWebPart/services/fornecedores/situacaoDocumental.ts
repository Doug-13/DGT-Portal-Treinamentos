import {
  IDocumentoFornecedor,
  IFornecedor,
  ITipoDocumentoFornecedor
} from './modeloFornecedores';

// ============================================================
// FORNECEDORES — SITUAÇÃO DOCUMENTAL (cálculo puro, testável)
//
// Para cada fornecedor: quais documentos se aplicam (tipo ativo e
// categoria compatível), qual a versão vigente de cada um e o que
// está pendente:
//   Faltando  → documento obrigatório sem versão vigente
//   Vencido   → vencimento anterior a hoje
//   A vencer  → vence em até DIAS_AVISO dias (escopo: alertas 30/15/5)
//
// Esta fase só MOSTRA a pendência. Suspender o fornecedor
// automaticamente (RF-24) depende da regra de Suprimentos sobre quais
// documentos suspendem e quais só alertam.
// ============================================================

export const DIAS_AVISO = 30;

export type EstadoDocumento = 'OK' | 'A vencer' | 'Vencido' | 'Faltando' | 'Sem validade';

export interface IItemSituacao {
  tipo: ITipoDocumentoFornecedor;
  documento?: IDocumentoFornecedor;
  estado: EstadoDocumento;
  dias?: number;   // dias até o vencimento (negativo = vencido)
}

export interface ISituacaoDocumental {
  itens: IItemSituacao[];
  pendencias: IItemSituacao[];   // Faltando, Vencido ou A vencer
  faltando: number;
  vencidos: number;
  aVencer: number;
}

export interface IFornecedorComSituacao {
  fornecedor: IFornecedor;
  situacao: ISituacaoDocumental;
}

// Data local (sem hora) a partir de yyyy-mm-dd.
const dataLocal = (iso: string): Date | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};

export const diasAte = (vencimento: string, hoje: Date = new Date()): number | undefined => {
  const data = dataLocal(vencimento);
  if (!data) {
    return undefined;
  }
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((data.getTime() - base.getTime()) / 86400000);
};

export const estadoPeloVencimento = (
  vencimento: string,
  hoje: Date = new Date()
): { estado: EstadoDocumento; dias?: number } => {
  const dias = diasAte(vencimento, hoje);
  if (dias === undefined) {
    return { estado: 'Sem validade' };
  }
  if (dias < 0) {
    return { estado: 'Vencido', dias };
  }
  return { estado: dias <= DIAS_AVISO ? 'A vencer' : 'OK', dias };
};

export const tipoSeAplica = (
  tipo: ITipoDocumentoFornecedor,
  categoria: string
): boolean =>
  tipo.ativo && (tipo.categorias.length === 0 || tipo.categorias.indexOf(categoria) >= 0);

// Documento vigente mais recente de cada tipo (pela emissão; empate
// pela data de registro).
export const vigentePorTipo = (
  documentos: IDocumentoFornecedor[]
): Record<string, IDocumentoFornecedor> => {
  const mapa: Record<string, IDocumentoFornecedor> = {};
  documentos
    .filter(d => d.situacao === 'Vigente')
    .forEach(d => {
      const atual = mapa[d.tipoId];
      const chave = `${d.emissao || ''}|${d.criadoEm || ''}`;
      const chaveAtual = atual ? `${atual.emissao || ''}|${atual.criadoEm || ''}` : '';
      if (!atual || chave > chaveAtual) {
        mapa[d.tipoId] = d;
      }
    });
  return mapa;
};

export const calcularSituacao = (
  fornecedor: IFornecedor,
  tipos: ITipoDocumentoFornecedor[],
  documentosDoFornecedor: IDocumentoFornecedor[],
  hoje: Date = new Date()
): ISituacaoDocumental => {

  const vigentes = vigentePorTipo(documentosDoFornecedor);

  const itens: IItemSituacao[] = tipos
    .filter(t => tipoSeAplica(t, fornecedor.categoria))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(tipo => {
      const documento = vigentes[tipo.id];
      if (!documento) {
        return { tipo, estado: tipo.obrigatorio ? 'Faltando' : 'OK' } as IItemSituacao;
      }
      if (!tipo.exigeValidade && !documento.vencimento) {
        return { tipo, documento, estado: 'Sem validade' } as IItemSituacao;
      }
      const { estado, dias } = estadoPeloVencimento(documento.vencimento, hoje);
      return { tipo, documento, estado, dias };
    });

  // Documento não obrigatório e nunca enviado não é pendência.
  const pendencias = itens.filter(i =>
    i.estado === 'Faltando' ||
    (i.documento && (i.estado === 'Vencido' || i.estado === 'A vencer')));

  return {
    itens,
    pendencias,
    faltando: pendencias.filter(p => p.estado === 'Faltando').length,
    vencidos: pendencias.filter(p => p.estado === 'Vencido').length,
    aVencer: pendencias.filter(p => p.estado === 'A vencer').length
  };
};

// Soma a validade padrão do tipo à emissão (yyyy-mm-dd).
export const sugerirVencimento = (emissao: string, validadeDias?: number): string => {
  const data = dataLocal(emissao);
  if (!data || !validadeDias || validadeDias <= 0) {
    return '';
  }
  data.setDate(data.getDate() + validadeDias);
  const mes = String(data.getMonth() + 1);
  const dia = String(data.getDate());
  return `${data.getFullYear()}-${mes.length < 2 ? '0' + mes : mes}-${dia.length < 2 ? '0' + dia : dia}`;
};
