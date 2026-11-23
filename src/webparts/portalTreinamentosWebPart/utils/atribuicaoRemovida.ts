import {
  IDataverseRecord
} from '../services/DataverseService';

import {
  STATUS_USUARIO_TREINAMENTO
} from '../constants/dataverseChoices';

// ============================================================
// ATRIBUIÇÃO REMOVIDA
//
// Desatribuir (desativar regra por área, remover pendentes, corrigir
// duplicidade...) NÃO apaga o registro: ele fica com dgt_ativo = Não
// e/ou status Cancelado, para manter o histórico ("Removidas" em
// Pessoas atribuídas). Esses registros não podem contar em nenhum
// indicador: nem prazo, nem pendência, nem vencido.
//
// Regra única, usada pela Conformidade e pela Minha equipe.
// ============================================================

export const atribuicaoRemovida = (
  registro: IDataverseRecord
): boolean => {

  const ativo =
    registro.dgt_ativo;

  if (
    ativo === false ||
    ativo === 0 ||
    ativo === '0' ||
    ativo === 'false'
  ) {
    return true;
  }

  if (
    Number(registro.dgt_status) ===
    STATUS_USUARIO_TREINAMENTO.CANCELADO
  ) {
    return true;
  }

  const statusTexto =
    String(
      registro['dgt_status@OData.Community.Display.V1.FormattedValue'] || ''
    )
      .toLowerCase();

  return statusTexto.indexOf('cancel') >= 0 ||
    statusTexto.indexOf('removid') >= 0;
};
