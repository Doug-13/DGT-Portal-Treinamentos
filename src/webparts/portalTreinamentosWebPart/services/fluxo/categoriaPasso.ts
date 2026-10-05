import {
  CategoriaPassoFluxo
} from '../../models/Documento';

import {
  IFluxoHistorico
} from '../../models/Fluxo';

import {
  ehAcaoDeDevolucao
} from './FluxoEngine';

// ============================================================
// CATEGORIA DE UM PASSO DO FLUXO (cor e ícone no histórico)
//
//   aprovado   verde     · reprovado/devolução  vermelho
//   publicado  verde escuro · sub-revisão laranja · revisão índigo
//   início/fim azul-escuro · avanço comum (Concluir, Enviar) azul
//
// Usado na aba Histórico do documento e no histórico da tramitação
// da aba Fluxo de revisão.
// ============================================================

export const categoriaDoPasso = (
  passo: IFluxoHistorico
): CategoriaPassoFluxo => {

  const chave =
    (passo.acaoChave || '').toLowerCase();

  if (chave === 'iniciar') {
    return 'inicio';
  }

  if (passo.sistema) {
    if (chave === 'novasubrevisao') return 'subrevisao';
    if (chave === 'novarevisao' || chave === 'proximarevisao') return 'revisao';
    if (chave.indexOf('publicar') === 0) return 'publicado';
    if (/conclu|fim/.test(chave)) return 'fim';
    return 'avanco';
  }

  if (ehAcaoDeDevolucao({ chave: passo.acaoChave, resultado: passo.resultado, rotulo: passo.acaoRotulo })) {
    return 'reprovado';
  }

  const texto =
    `${chave} ${passo.resultado || ''} ${passo.acaoRotulo || ''}`.toLowerCase();

  if (/aprov|deferi|aceit/.test(texto)) {
    return 'aprovado';
  }

  return 'avanco';
};

export interface IEstiloPasso {
  cor: string;
  fundo: string;
  icone: string;
  rotulo: string;
}

export const ESTILO_PASSO_FLUXO: Record<CategoriaPassoFluxo, IEstiloPasso> = {
  aprovado: { cor: '#107C10', fundo: '#E7F6EC', icone: '✓', rotulo: 'Aprovado' },
  reprovado: { cor: '#B42318', fundo: '#FDE7E9', icone: '✕', rotulo: 'Reprovado' },
  publicado: { cor: '#0B6B3A', fundo: '#D1FADF', icone: '★', rotulo: 'Publicado' },
  subrevisao: { cor: '#B45309', fundo: '#FFF4E5', icone: 'r', rotulo: 'Sub-revisão' },
  revisao: { cor: '#485CC7', fundo: '#E8EAF8', icone: 'R', rotulo: 'Revisão' },
  inicio: { cor: '#202A44', fundo: '#EDF0F5', icone: '▶', rotulo: 'Início' },
  fim: { cor: '#202A44', fundo: '#EDF0F5', icone: '■', rotulo: 'Fim' },
  avanco: { cor: '#0F6CBD', fundo: '#E8F2FF', icone: '→', rotulo: 'Etapa' }
};
