// ============================================================
// METADADO / COLUNA DO TIPO "ÁREA"
//
// Valor gravado como JSON com o id da dgt_area, o nome e a sigla no
// momento da escolha (o histórico continua legível mesmo que a área
// seja renomeada ou desativada depois):
//
//   {"id":"<guid>","nome":"ARQUITETURA DE SOLUÇÕES","sigla":"ARQ"}
// ============================================================

export interface IValorArea {
  id: string;
  nome: string;
  sigla?: string;
}

const limparGuid = (
  valor?: string
): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const lerValorArea = (
  valor?: string
): IValorArea | undefined => {

  const texto = (valor || '').trim();

  if (!texto || texto.charAt(0) !== '{') {
    return undefined;
  }

  try {
    const dado = JSON.parse(texto) as Partial<IValorArea>;

    if (dado && typeof dado === 'object' && dado.id) {
      return {
        id: limparGuid(String(dado.id)),
        nome: String(dado.nome || ''),
        sigla: dado.sigla ? String(dado.sigla) : undefined
      };
    }
  } catch {
    // valor antigo/texto livre: inválido
  }

  return undefined;
};

export const gravarValorArea = (
  area?: IValorArea
): string =>
  area && area.id
    ? JSON.stringify({ id: limparGuid(area.id), nome: area.nome || '', sigla: area.sigla || '' })
    : '';

// Texto para exibição (histórico, resumo, somente leitura).
export const formatarValorArea = (
  valor?: string
): string => {
  const area = lerValorArea(valor);
  if (!area) {
    return (valor || '').trim();
  }
  return area.sigla ? `${area.sigla} — ${area.nome}` : area.nome;
};

// Mensagem de erro (vazio = válido).
export const validarValorArea = (
  rotulo: string,
  valor: string
): string =>
  !valor.trim() || lerValorArea(valor)
    ? ''
    : `"${rotulo}" precisa ser uma área cadastrada.`;
