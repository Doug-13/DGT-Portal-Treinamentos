import * as React from 'react';

// ============================================================
// MÓDULO LICITAÇÕES — ESTILOS (inline, mesmo padrão das demais
// páginas do portal). Paleta do Manual de Identidade DGT:
//   azul institucional 202A44 · ciano 05C3DD
//   apoio: índigo 485CC7 · cinza 888B8D · cinza claro D9D9D6
//   tons claros: E6F9FC · EDF0F5 · DFF6FA · E8EAF8 · F2F2F2
//
// Verde/vermelho não fazem parte da paleta: os estados das telas
// são diferenciados por ícone + rótulo + cor de apoio.
// ============================================================

export const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  cinza: '#888B8D',
  cinzaClaro: '#D9D9D6',
  cianoClaro: '#E6F9FC',
  cianoClaro2: '#DFF6FA',
  azulClaro: '#EDF0F5',
  indigoClaro: '#E8EAF8',
  neutro: '#F2F2F2',
  texto: '#202A44',
  textoSecundario: '#5E6670',
  botao: '#0877c9'
};

export const FONTE =
  "Barlow, Arial, 'Segoe UI', sans-serif";

export const cartao: React.CSSProperties = {
  background: '#ffffff',
  border: `1px solid ${COR.cinzaClaro}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
  fontFamily: FONTE
};

export const tituloSecao: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 15,
  fontWeight: 600,
  color: COR.azul
};

export const textoApoio: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: COR.textoSecundario
};

export const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: COR.azul,
  marginBottom: 6
};

export const dica: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: COR.textoSecundario,
  marginTop: 4
};

export const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: `1px solid ${COR.cinzaClaro}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: FONTE,
  color: COR.texto,
  background: '#ffffff'
};

export const grade = (
  minimo: number
): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${minimo}px, 1fr))`,
  gap: 14
});

export const botaoSecundario: React.CSSProperties = {
  background: '#ffffff',
  color: COR.azul,
  border: `1px solid ${COR.cinzaClaro}`
};

export const linhaAcoes: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10
};

export const chip = (
  ativo: boolean
): React.CSSProperties => ({
  background: ativo ? COR.cianoClaro : '#ffffff',
  color: COR.azul,
  border: `1px solid ${ativo ? COR.ciano : COR.cinzaClaro}`,
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: ativo ? 600 : 400
});

export const etiqueta: React.CSSProperties = {
  display: 'inline-block',
  background: COR.azulClaro,
  color: COR.azul,
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 11,
  marginRight: 6,
  marginBottom: 6
};
