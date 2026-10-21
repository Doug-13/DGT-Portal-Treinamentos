// ============================================================
// ÁREA "GERAL"
//
// Um processo (e o fluxo dele) cadastrado na área Geral vale para
// TODAS as áreas: aparece para documentos de qualquer área, assim
// como os processos sem área. A área Geral é reconhecida pelo nome
// ("Geral") ou pela sigla ("GERAL"), sem diferenciar maiúsculas e
// acentos.
// ============================================================

const normalizar = (
  valor?: string
): string =>
  (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const limparIdArea = (
  valor?: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

export const ehNomeAreaGeral = (
  nome?: string
): boolean => {
  // Aceita "Geral", "Área Geral", "GER — Geral", "Geral (GER)";
  // não aceita nomes que só contêm a palavra ("Gestão Geral de...").
  const valor =
    normalizar(nome)
      .replace(/^[a-z0-9]{2,8}\s*[—–-]\s*/, '')
      .replace(/\s*\([^)]*\)$/, '')
      .replace(/^area\s+/, '')
      .trim();
  return valor === 'geral';
};

export const ehAreaGeral = (
  area?: { nome?: string; sigla?: string }
): boolean =>
  !!area &&
  (ehNomeAreaGeral(area.nome) || normalizar(area.sigla) === 'geral');

// Ids das áreas Geral de uma lista de áreas.
export const idsAreasGerais = (
  areas: Array<{ id: string; nome?: string; sigla?: string }>
): string[] =>
  areas
    .filter(area => ehAreaGeral(area))
    .map(area => limparIdArea(area.id));
