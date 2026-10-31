import {
  CONTROLE_DOCUMENTAL
} from '../../constants/controleDocumental';

// ============================================================
// METADADOS DO TIPO "DOCUMENTO REFERENCIADO"
//
//   'documento'  → um documento
//   'documentos' → vários documentos
//
// Os dois gravam o mesmo formato (JSON, lista):
//
//   [{"id":"<guid dgt_documento>","codigo":"ARQ-IT-003","titulo":"Proposta Comercial"}]
//
// Código e título ficam gravados junto do id para o histórico continuar
// legível mesmo que o documento seja renomeado ou inativado depois.
// ============================================================

export interface IValorDocumento {
  id: string;
  codigo: string;
  titulo: string;
}

const limparGuid = (
  valor?: string
): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const ehTipoDocumento = (
  tipo?: string
): boolean =>
  tipo === 'documento' || tipo === 'documentos';

export const lerValorDocumentos = (
  valor?: string
): IValorDocumento[] => {

  const texto = (valor || '').trim();

  if (!texto) {
    return [];
  }

  try {
    const dado = JSON.parse(texto) as unknown;
    const lista = Array.isArray(dado) ? dado : [dado];

    return lista
      .filter(item => !!item && typeof item === 'object' && !!(item as IValorDocumento).id)
      .map(item => {
        const doc = item as Partial<IValorDocumento>;
        return {
          id: limparGuid(String(doc.id)),
          codigo: String(doc.codigo || ''),
          titulo: String(doc.titulo || '')
        };
      });
  } catch {
    return [];
  }
};

export const gravarValorDocumentos = (
  documentos: IValorDocumento[]
): string =>
  documentos.length === 0
    ? ''
    : JSON.stringify(
      documentos.map(doc => ({
        id: limparGuid(doc.id),
        codigo: doc.codigo || '',
        titulo: doc.titulo || ''
      }))
    );

export const rotuloDocumento = (
  doc: IValorDocumento
): string =>
  [doc.codigo, doc.titulo].filter(item => !!item).join(' — ');

// Texto para exibição (histórico, resumo, somente leitura).
export const formatarValorDocumentos = (
  valor?: string
): string => {

  const lista = lerValorDocumentos(valor);

  return lista.length > 0
    ? lista.map(rotuloDocumento).join('; ')
    : (valor || '').trim();
};

// Mensagem de erro (vazio = válido). Valor vazio é tratado pela regra
// de obrigatoriedade, fora daqui.
export const validarValorDocumentos = (
  rotulo: string,
  tipo: string,
  valor: string
): string => {

  if (!valor.trim()) {
    return '';
  }

  const lista = lerValorDocumentos(valor);

  if (lista.length === 0) {
    return `"${rotulo}" precisa ser um documento da plataforma.`;
  }

  if (tipo === 'documento' && lista.length > 1) {
    return `"${rotulo}" aceita apenas um documento.`;
  }

  return '';
};

// Leitura ESTRITA, para varrer valores sem saber o tipo do campo:
// só aceita o formato gravado por este tipo (lista de objetos com id e
// código). Evita confundir com o valor do tipo Usuário ({id, nome}).
export const lerReferenciasGravadas = (
  valor?: string
): IValorDocumento[] => {

  const texto = (valor || '').trim();

  if (texto.charAt(0) !== '[') {
    return [];
  }

  try {
    const dado = JSON.parse(texto) as unknown;

    if (!Array.isArray(dado)) {
      return [];
    }

    const validos = dado.filter(item =>
      !!item &&
      typeof item === 'object' &&
      !!(item as IValorDocumento).id &&
      Object.prototype.hasOwnProperty.call(item, 'codigo')
    );

    return validos.length === dado.length
      ? lerValorDocumentos(texto)
      : [];
  } catch {
    return [];
  }
};

// ------------------------------------------------------------
// TIPO DO DOCUMENTO
// ------------------------------------------------------------

// dgt_tipo é uma escolha (número). O código (POP, IT, TRN...) vem do
// valor formatado — ex.: "TRN" ou "TRN - Treinamento" → "TRN".
export const codigoTipoDocumento = (
  registro: Record<string, unknown>
): string => {
  const formatado =
    registro['dgt_tipo@OData.Community.Display.V1.FormattedValue'];
  const texto =
    String(formatado === undefined || formatado === null ? '' : formatado).trim();
  return texto.split(/[\s\-–—]+/)[0].toUpperCase();
};

// Tipos permitidos num metadado "Documento referenciado" (opções do
// metadado, ex.: ["POP", "IT"]). Lista vazia = todos, exceto TRN
// (documentos de controle de treinamento só entram se listados).
export const tipoPermitido = (
  tipo: string,
  tiposPermitidos?: string[]
): boolean => {
  const permitidos = (tiposPermitidos || [])
    .map(item => item.split(/[\s\-–—]+/)[0].trim().toUpperCase())
    .filter(item => !!item);

  const codigo = (tipo || '').trim().toUpperCase();

  if (permitidos.length > 0) {
    return permitidos.indexOf(codigo) >= 0;
  }

  return codigo !== CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO;
};
