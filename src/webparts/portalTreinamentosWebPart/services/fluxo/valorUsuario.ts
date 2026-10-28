// ============================================================
// METADADO DO TIPO "USUÁRIO"
//
// O valor é gravado como JSON com o id do dgt_usuario, o nome e o
// e-mail no momento da escolha:
//
//   {"id":"<guid>","nome":"Anaelise Cunha","email":"anaelise@dgt..."}
//
// Guardar nome e e-mail junto preserva a rastreabilidade: o histórico
// continua legível mesmo que o usuário seja desativado depois.
// ============================================================

export interface IValorUsuario {
  id: string;
  nome: string;
  email?: string;
}

const limparGuid = (
  valor?: string
): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const lerValorUsuario = (
  valor?: string
): IValorUsuario | undefined => {

  const texto = (valor || '').trim();

  if (!texto) {
    return undefined;
  }

  try {
    const dado = JSON.parse(texto) as Partial<IValorUsuario>;

    if (dado && typeof dado === 'object' && dado.id) {
      return {
        id: limparGuid(String(dado.id)),
        nome: String(dado.nome || ''),
        email: dado.email ? String(dado.email) : undefined
      };
    }
  } catch {
    // Valor antigo/texto livre: tratado como inválido.
  }

  return undefined;
};

export const gravarValorUsuario = (
  usuario?: IValorUsuario
): string =>
  usuario && usuario.id
    ? JSON.stringify({
      id: limparGuid(usuario.id),
      nome: usuario.nome || '',
      email: usuario.email || ''
    })
    : '';

// Texto para exibição (histórico, resumo, somente leitura).
export const formatarValorUsuario = (
  valor?: string
): string => {

  const usuario = lerValorUsuario(valor);

  if (!usuario) {
    return (valor || '').trim();
  }

  return usuario.email
    ? `${usuario.nome} (${usuario.email})`
    : usuario.nome;
};

// Mensagem de erro (vazio = válido). Valor vazio é tratado pela regra
// de obrigatoriedade, fora daqui.
export const validarValorUsuario = (
  rotulo: string,
  valor: string
): string =>
  !valor.trim() || lerValorUsuario(valor)
    ? ''
    : `"${rotulo}" precisa ser um usuário da plataforma.`;
