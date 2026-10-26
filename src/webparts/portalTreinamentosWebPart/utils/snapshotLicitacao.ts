import {
  IDocumentoEdital,
  IItemEdital
} from '../models/Licitacao';

// ============================================================
// ACOMPANHAMENTO DE LICITAÇÕES — "FOTO" DO EDITAL E DIFERENÇAS
//
// A mesma regra existe no plugin AcompanhamentoLicitacaoPlugin.cs
// (verificação automática). Se mudar aqui, mude lá também.
//
// A foto NÃO guarda CNPJ nem links do PNCP (que contêm o CNPJ):
// só situação, valor, datas, objeto, documentos (título/tipo) e a
// situação/valor de cada item.
// ============================================================

export interface ISnapshotDocumento {
  seq: number;
  titulo: string;
  tipo: string;
}

export interface ISnapshotItem {
  n: number;
  situacao: string;
  valor?: number;
}

export interface ISnapshotLicitacao {
  v: 1;
  situacao: string;
  valor?: number;
  abertura: string;
  encerramento: string;
  objeto: string;
  documentos: ISnapshotDocumento[];
  itens: ISnapshotItem[];
}

export type TipoAlteracao =
  | 'inicio'
  | 'situacao'
  | 'data'
  | 'valor'
  | 'objeto'
  | 'documento'
  | 'item';

export interface IAlteracaoDetectada {
  tipo: TipoAlteracao;
  descricao: string;
  anterior: string;
  novo: string;
}

const CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

export const semDadosSensiveis = (texto: string): string =>
  (texto || '').replace(CNPJ, '[dado removido]').replace(CPF, '[dado removido]');

// "2026-10-27T08:59:00" → "2026-10-27T08:59"
const dataCurta = (valor?: string): string =>
  (valor || '').substring(0, 16);

export const formatarDataSnapshot = (valor: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(valor || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}` : ''}` : (valor || '—');
};

const moeda = (valor?: number): string =>
  valor === undefined || valor === null || isNaN(valor)
    ? '—'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const montarSnapshot = (dados: {
  situacao?: string;
  valor?: number;
  abertura?: string;
  encerramento?: string;
  objeto?: string;
  documentos?: IDocumentoEdital[];
  itens?: IItemEdital[];
}): ISnapshotLicitacao => ({
  v: 1,
  situacao: (dados.situacao || '').trim(),
  valor: dados.valor,
  abertura: dataCurta(dados.abertura),
  encerramento: dataCurta(dados.encerramento),
  objeto: semDadosSensiveis(dados.objeto || '').trim().substring(0, 4000),
  documentos: (dados.documentos || [])
    .map(d => ({ seq: d.sequencial, titulo: semDadosSensiveis(d.titulo || '').substring(0, 300), tipo: d.tipo || '' }))
    .sort((a, b) => a.seq - b.seq),
  itens: (dados.itens || [])
    .map(i => ({ n: i.numeroItem, situacao: (i.situacao || '').trim(), valor: i.valorTotal }))
    .sort((a, b) => a.n - b.n)
});

// Compara duas fotos e descreve o que mudou.
// "documentos" ou "itens" vazios na foto nova = não foi possível
// carregar agora: não são tratados como "tudo removido".
export const compararSnapshots = (
  anterior: ISnapshotLicitacao,
  atual: ISnapshotLicitacao
): IAlteracaoDetectada[] => {

  const mudancas: IAlteracaoDetectada[] = [];

  if (atual.situacao && anterior.situacao !== atual.situacao) {
    mudancas.push({ tipo: 'situacao', descricao: 'Situação do edital alterada', anterior: anterior.situacao || '—', novo: atual.situacao });
  }

  if (atual.encerramento && anterior.encerramento !== atual.encerramento) {
    mudancas.push({
      tipo: 'data',
      descricao: 'Encerramento das propostas alterado',
      anterior: formatarDataSnapshot(anterior.encerramento),
      novo: formatarDataSnapshot(atual.encerramento)
    });
  }

  if (atual.abertura && anterior.abertura !== atual.abertura) {
    mudancas.push({
      tipo: 'data',
      descricao: 'Abertura das propostas alterada',
      anterior: formatarDataSnapshot(anterior.abertura),
      novo: formatarDataSnapshot(atual.abertura)
    });
  }

  if (atual.valor !== undefined && Math.abs((anterior.valor || 0) - atual.valor) >= 0.01) {
    mudancas.push({ tipo: 'valor', descricao: 'Valor estimado alterado', anterior: moeda(anterior.valor), novo: moeda(atual.valor) });
  }

  if (atual.objeto && anterior.objeto !== atual.objeto) {
    mudancas.push({ tipo: 'objeto', descricao: 'Objeto do edital alterado', anterior: anterior.objeto, novo: atual.objeto });
  }

  if (atual.documentos.length > 0) {
    const antes = new Set(anterior.documentos.map(d => d.seq));
    const agora = new Set(atual.documentos.map(d => d.seq));
    atual.documentos
      .filter(d => !antes.has(d.seq))
      .forEach(d => mudancas.push({ tipo: 'documento', descricao: 'Novo documento publicado', anterior: '', novo: `${d.titulo}${d.tipo ? ` (${d.tipo})` : ''}` }));
    anterior.documentos
      .filter(d => !agora.has(d.seq))
      .forEach(d => mudancas.push({ tipo: 'documento', descricao: 'Documento retirado', anterior: d.titulo, novo: '' }));
  }

  if (atual.itens.length > 0) {
    const porNumero: { [n: number]: ISnapshotItem } = {};
    anterior.itens.forEach(i => { porNumero[i.n] = i; });
    atual.itens.forEach(i => {
      const velho = porNumero[i.n];
      if (!velho) {
        if (anterior.itens.length > 0) {
          mudancas.push({ tipo: 'item', descricao: `Item ${i.n} incluído`, anterior: '', novo: i.situacao || 'incluído' });
        }
        return;
      }
      if (i.situacao && velho.situacao !== i.situacao) {
        mudancas.push({ tipo: 'item', descricao: `Item ${i.n}: situação alterada`, anterior: velho.situacao || '—', novo: i.situacao });
      }
    });
  }

  return mudancas;
};
