import * as React from 'react';

import {
  EtapaBom
} from '../../services/bom/BomService';

import {
  DecisaoGoNoGo
} from '../../services/bom/esquemaBom';

// ============================================================
// ARQUITETURA DE SOLUÇÕES — ELEMENTOS VISUAIS COMUNS
// ============================================================

export const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  texto2: '#64748b',
  borda: '#E5E7EB',
  fundo: '#F7F9FB'
};

export const FONTE = "Barlow, Arial, 'Segoe UI', sans-serif";

export const cartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  padding: '18px 20px',
  marginBottom: '16px'
};

export const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: COR.azul,
  marginBottom: '5px'
};

export const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '6px',
  fontSize: '13.5px',
  fontFamily: FONTE,
  color: COR.azul,
  background: '#FFFFFF'
};

export const botao = (
  tipo: 'principal' | 'secundario' | 'perigo' = 'principal',
  desabilitado = false
): React.CSSProperties => ({
  minHeight: '36px',
  padding: '0 16px',
  borderRadius: '6px',
  border: tipo === 'secundario' ? `1px solid ${COR.borda}` : 0,
  background: tipo === 'principal' ? '#0877c9' : tipo === 'perigo' ? '#B42318' : '#FFFFFF',
  color: tipo === 'secundario' ? COR.azul : '#FFFFFF',
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.5 : 1,
  whiteSpace: 'nowrap',
  fontFamily: FONTE
});

export const chip = (
  ativo: boolean
): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: '999px',
  border: `1px solid ${ativo ? COR.ciano : COR.borda}`,
  background: ativo ? '#E6F9FC' : '#FFFFFF',
  color: COR.azul,
  fontSize: '12.5px',
  fontWeight: ativo ? 700 : 500,
  cursor: 'pointer',
  fontFamily: FONTE
});

// Etapas: número no processo, texto e cores (iguais ao protótipo).
export const ETAPAS: Record<EtapaBom, { passo: number; texto: string; cor: string; fundo: string }> = {
  'Dados da demanda': { passo: 1, texto: 'Dados da demanda a preencher', cor: '#64748b', fundo: '#F1F5F9' },
  'Go/No-Go pendente': { passo: 2, texto: 'Go/No-Go pendente', cor: '#B45309', fundo: '#FFF4E5' },
  'Bloqueado no Go/No-Go': { passo: 2, texto: 'Bloqueado no Go/No-Go', cor: '#B42318', fundo: '#FDE7E9' },
  'Seleção de kit': { passo: 3, texto: 'Seleção de kit', cor: '#0F6CBD', fundo: '#E8F2FF' },
  'Cálculo de HH': { passo: 4, texto: 'Cálculo de HH', cor: '#6B4FBB', fundo: '#F1ECFB' },
  'B.O.M. pronto': { passo: 5, texto: 'B.O.M. pronto para lançar', cor: '#0F6CBD', fundo: '#E8F2FF' },
  'Enviado para aprovação': { passo: 6, texto: 'Enviado para aprovação', cor: '#107C10', fundo: '#E7F6EC' }
};

export const DECISAO: Record<DecisaoGoNoGo, { texto: string; cor: string; fundo: string }> = {
  GO: { texto: '✓ GO', cor: '#107C10', fundo: '#E7F6EC' },
  'GO com restrição': { texto: '◐ GO COM RESTRIÇÃO', cor: '#B45309', fundo: '#FFF4E5' },
  'NO-GO': { texto: '✕ NO-GO', cor: '#B42318', fundo: '#FDE7E9' }
};

export const Selo: React.FC<{ texto: string; cor: string; fundo: string }> = ({ texto, cor, fundo }) => (
  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', background: fundo, color: cor, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
    {texto}
  </span>
);

export const formatarData = (valor?: string): string =>
  valor && /^\d{4}-\d{2}-\d{2}/.test(valor)
    ? `${valor.substring(8, 10)}/${valor.substring(5, 7)}/${valor.substring(0, 4)}`
    : '—';

export const formatarNumero = (valor: number): string =>
  valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Passos do processo (5 etapas do protótipo).
export const PASSOS = [
  { passo: 1, nome: 'Dados da demanda' },
  { passo: 2, nome: 'Matriz Go/No-Go' },
  { passo: 3, nome: 'Seleção de kit' },
  { passo: 4, nome: 'Cálculo de HH' },
  { passo: 5, nome: 'B.O.M. pronto' }
];
