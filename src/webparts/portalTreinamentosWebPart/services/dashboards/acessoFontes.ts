// ============================================================
// ÁREAS QUE CADA FONTE MOSTRA (dashboards)
//
// Regra geral: quem não vê todas as áreas (Administrador do portal ou
// do módulo Indicadores) vê só as áreas de que participa.
//
// Exceção — ADMINISTRADOR DO MÓDULO DA FONTE: quem administra um
// módulo vê, nas fontes daquele módulo, as mesmas áreas que vê no
// próprio módulo, ou seja, TODAS. Ex.: a Controladoria, Administradora
// do módulo Planejamento orçamentário, vê o orçamento de todas as
// áreas — como na página de Planejamento orçamentário — mesmo que só
// participe da área CTL. Nas outras fontes, continua vendo só as suas.
// ============================================================

// Fonte → módulo do portal que ela representa.
const MODULO_POR_PREFIXO: Array<{ prefixo: string; modulo: string }> = [
  { prefixo: 'orcamento.', modulo: 'orcamento' },
  { prefixo: 'documentos.', modulo: 'documentos' },
  { prefixo: 'treinamentos.', modulo: 'treinamentos' },
  { prefixo: 'licitacoes.', modulo: 'licitacoes' },
  { prefixo: 'fornecedores.', modulo: 'fornecedores' }
];

export const moduloDaFonte = (fonteId: string): string | undefined => {
  const regra = MODULO_POR_PREFIXO.filter(item => fonteId.indexOf(item.prefixo) === 0)[0];
  return regra ? regra.modulo : undefined;
};

// A pessoa vê todas as áreas nesta fonte?
export const veTodasAsAreasNaFonte = (
  fonteId: string,
  areasPermitidas: string[] | undefined,
  modulosAdministrados: string[] | undefined
): boolean => {
  if (!areasPermitidas) {
    return true;
  }
  const modulo = moduloDaFonte(fonteId);
  return !!modulo && (modulosAdministrados || []).indexOf(modulo) >= 0;
};

// Áreas a carregar numa fonte (undefined = todas).
// Com uma área escolhida no filtro: só ela, e só se a pessoa puder vê-la
// NESTA fonte (lista vazia = nenhum dado).
export const areasDaFonte = (
  fonteId: string,
  areaEscolhida: string,
  areasPermitidas: string[] | undefined,
  modulosAdministrados: string[] | undefined
): string[] | undefined => {
  const todas = veTodasAsAreasNaFonte(fonteId, areasPermitidas, modulosAdministrados);
  if (areaEscolhida) {
    return todas || (areasPermitidas || []).indexOf(areaEscolhida) >= 0 ? [areaEscolhida] : [];
  }
  return todas ? undefined : areasPermitidas;
};
