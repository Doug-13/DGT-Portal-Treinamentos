import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../services/DataverseService';

import {
  IDocumento
} from '../models/Documento';

// ============================================================
// ARQUIVO ATUAL DE CADA DOCUMENTO
//   Documento com revisão vigente → arquivo da vigente (maior número,
//                                   preferindo a marcada como ativa).
//   Sem vigente ainda              → arquivo da revisão mais recente.
// ============================================================

export interface IArquivoDocumento {
  url: string;
  revisao: string;
  vigente: boolean;
}

const guid = (
  valor?: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const numeroRevisao = (
  revisao: string
): number => {
  const encontrado =
    (revisao || '').match(/(\d+)(?!.*\d)/);

  return encontrado
    ? Number(encontrado[1])
    : -1;
};

const ehVigente = (
  registro: IDataverseRecord
): boolean =>
  String(
    registro['dgt_status@OData.Community.Display.V1.FormattedValue'] || ''
  )
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim() === 'vigente';

// Maior revisão; em empate, a ativa.
const melhor = (
  a: IDataverseRecord | undefined,
  b: IDataverseRecord
): IDataverseRecord => {

  if (!a) {
    return b;
  }

  const na = numeroRevisao(String(a.dgt_revisao || ''));
  const nb = numeroRevisao(String(b.dgt_revisao || ''));

  if (nb !== na) {
    return nb > na ? b : a;
  }

  return b.dgt_ativa === true ? b : a;
};

export const useArquivosDocumentos = (
  dataverse: DataverseService | undefined,
  documentos: IDocumento[]
): Record<string, IArquivoDocumento> => {

  const [registros, setRegistros] =
    React.useState<IDataverseRecord[]>([]);

  // Recarrega quando a lista de documentos muda (nova publicação etc.).
  React.useEffect(
    () => {

      if (!dataverse) {
        return;
      }

      let cancelado = false;

      dataverse
        .getArquivosRevisoesDocumentos()
        .then(
          resultado => {
            if (!cancelado) {
              setRegistros(resultado);
            }
          }
        )
        .catch(
          (error: unknown) =>
            console.error(
              'Não foi possível carregar os arquivos dos documentos.',
              error
            )
        );

      return () => {
        cancelado = true;
      };
    },
    [
      dataverse,
      documentos
    ]
  );

  return React.useMemo(
    () => {

      const vigentes: Record<string, IDataverseRecord> = {};
      const recentes: Record<string, IDataverseRecord> = {};

      registros.forEach(
        registro => {

          const documentoId =
            guid(registro._dgt_documento_value);

          if (!documentoId || !registro.dgt_arquivourl) {
            return;
          }

          recentes[documentoId] =
            melhor(recentes[documentoId], registro);

          if (ehVigente(registro)) {
            vigentes[documentoId] =
              melhor(vigentes[documentoId], registro);
          }
        }
      );

      const resultado: Record<string, IArquivoDocumento> = {};

      Object.keys(recentes).forEach(
        documentoId => {

          const escolhido =
            vigentes[documentoId] ||
            recentes[documentoId];

          resultado[documentoId] = {
            url: String(escolhido.dgt_arquivourl || ''),
            revisao: String(escolhido.dgt_revisao || ''),
            vigente: !!vigentes[documentoId]
          };
        }
      );

      return resultado;
    },
    [
      registros
    ]
  );
};
