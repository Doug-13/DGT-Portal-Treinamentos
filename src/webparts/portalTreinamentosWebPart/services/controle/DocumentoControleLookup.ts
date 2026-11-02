import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

// ============================================================
// TREINAMENTO ↔ DOCUMENTO DE CONTROLE — ligação pela CHAVE (GUID)
//
// Coluna dgt_treinamento.dgt_documentocontrole (pesquisa → dgt_documento),
// criada e preenchida pelo script aplicar-codigo-imutavel.ps1.
//
// Toda tela que precisa saber "qual é o documento deste treinamento"
// (ou o contrário) usa estas funções. A comparação por CÓDIGO fica só
// como reserva para registro antigo sem a coluna preenchida — e nunca
// aceita um documento que já é controle de OUTRO treinamento.
//
// Se a coluna não existir no ambiente, as funções devolvem vazio e o
// chamador continua pelo código (comportamento anterior).
// ============================================================

export const CONTROLE_NAVEGACAO = 'dgt_DocumentoControle';
export const CONTROLE_COLUNA = '_dgt_documentocontrole_value';

export interface ITreinamentoControlado {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  documentoControleId: string;
}

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const ehGuid = (valor: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const lotes = <T>(itens: T[], tamanho: number): T[][] => {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultado.push(itens.slice(i, i + tamanho));
  }
  return resultado;
};

const SELECT_TREINAMENTO =
  `$select=dgt_treinamentoid,dgt_codigo,dgt_name,dgt_ativo,${CONTROLE_COLUNA}`;

const paraTreinamento = (r: IDataverseRecord): ITreinamentoControlado => ({
  id: guid(r.dgt_treinamentoid),
  codigo: texto(r, 'dgt_codigo').toUpperCase(),
  nome: texto(r, 'dgt_name'),
  // Estrito: só true é ativo.
  ativo: r.dgt_ativo === true,
  documentoControleId: guid(r[CONTROLE_COLUNA])
});

// { treinamentoId → documentoId } (só os que têm a coluna preenchida).
export const documentosDeControle = async (
  dataverse: DataverseService,
  treinamentoIds: string[]
): Promise<Record<string, string>> => {

  const ids = treinamentoIds.map(guid).filter(ehGuid);
  const mapa: Record<string, string> = {};

  try {
    for (const lote of lotes(ids, 20)) {
      const registros =
        await dataverse.listarRegistros(
          'dgt_treinamento',
          `$select=dgt_treinamentoid,${CONTROLE_COLUNA}` +
          '&$filter=' + lote.map(id => `dgt_treinamentoid eq ${id}`).join(' or ')
        );

      registros.forEach(r => {
        const documentoId = guid(r[CONTROLE_COLUNA]);
        if (documentoId) {
          mapa[guid(r.dgt_treinamentoid)] = documentoId;
        }
      });
    }
  } catch (erro) {
    console.warn('[Controle] Coluna Documento de controle indisponível; usando o código.', erro);
    return {};
  }

  return mapa;
};

// { documentoId → treinamento } para os documentos informados.
export const treinamentosDosDocumentos = async (
  dataverse: DataverseService,
  documentoIds: string[]
): Promise<Record<string, ITreinamentoControlado>> => {

  const ids = documentoIds.map(guid).filter(ehGuid);
  const mapa: Record<string, ITreinamentoControlado> = {};

  try {
    for (const lote of lotes(ids, 20)) {
      const registros =
        await dataverse.listarRegistros(
          'dgt_treinamento',
          `${SELECT_TREINAMENTO}&$filter=` +
          lote.map(id => `${CONTROLE_COLUNA} eq ${id}`).join(' or ')
        );

      registros.forEach(r => {
        const treinamento = paraTreinamento(r);
        if (treinamento.documentoControleId && !mapa[treinamento.documentoControleId]) {
          mapa[treinamento.documentoControleId] = treinamento;
        }
      });
    }
  } catch (erro) {
    console.warn('[Controle] Coluna Documento de controle indisponível; usando o código.', erro);
    return {};
  }

  return mapa;
};

// Treinamento controlado por um documento (pela coluna; sem ela,
// pelo código — desde que o treinamento não tenha OUTRO documento
// de controle definido).
export const treinamentoDoDocumentoControle = async (
  dataverse: DataverseService,
  documento: { id: string; codigo: string }
): Promise<ITreinamentoControlado | undefined> => {

  const documentoId = guid(documento.id);

  if (ehGuid(documentoId)) {
    const pelaColuna =
      (await treinamentosDosDocumentos(dataverse, [documentoId]))[documentoId];

    if (pelaColuna) {
      return pelaColuna;
    }
  }

  const codigo = (documento.codigo || '').trim().toUpperCase();

  if (!codigo) {
    return undefined;
  }

  let registros: IDataverseRecord[] = [];

  try {
    registros =
      await dataverse.listarRegistros(
        'dgt_treinamento',
        `${SELECT_TREINAMENTO}&$filter=dgt_codigo eq '${codigo.replace(/'/g, "''")}'`
      );
  } catch {
    // Ambiente sem a coluna: lê sem ela.
    registros =
      await dataverse.listarRegistros(
        'dgt_treinamento',
        `$select=dgt_treinamentoid,dgt_codigo,dgt_name,dgt_ativo&$filter=dgt_codigo eq '${codigo.replace(/'/g, "''")}'`
      );
  }

  const candidato =
    registros
      .map(paraTreinamento)
      .filter(t => t.codigo === codigo)
      .find(t => !t.documentoControleId || t.documentoControleId === documentoId);

  return candidato;
};

// Documento de controle de um treinamento (pela coluna; sem ela, o
// documento de MESMO código que não seja controle de outro treinamento).
export const documentoControleDoTreinamento = async (
  dataverse: DataverseService,
  treinamento: { id: string; codigo: string }
): Promise<string> => {

  const treinamentoId = guid(treinamento.id);

  const pelaColuna =
    (await documentosDeControle(dataverse, [treinamentoId]))[treinamentoId];

  if (pelaColuna) {
    return pelaColuna;
  }

  const codigo = (treinamento.codigo || '').trim().toUpperCase();

  if (!codigo) {
    return '';
  }

  const documentos =
    await dataverse.listarRegistros(
      'dgt_documento',
      `$select=dgt_documentoid&$filter=dgt_codigo eq '${codigo.replace(/'/g, "''")}'&$top=1`
    );

  const documentoId =
    documentos.length > 0 ? guid(documentos[0].dgt_documentoid) : '';

  if (!documentoId) {
    return '';
  }

  const dono =
    (await treinamentosDosDocumentos(dataverse, [documentoId]))[documentoId];

  return dono && dono.id !== treinamentoId ? '' : documentoId;
};

// Grava a coluna Documento de controle do treinamento.
export const definirDocumentoControle = async (
  dataverse: DataverseService,
  treinamentoId: string,
  documentoId: string
): Promise<void> => {

  await dataverse.atualizarRegistro(
    'dgt_treinamento',
    guid(treinamentoId),
    {
      [`${CONTROLE_NAVEGACAO}@odata.bind`]:
        await dataverse.referenciaLookup('dgt_documento', guid(documentoId))
    }
  );
};
