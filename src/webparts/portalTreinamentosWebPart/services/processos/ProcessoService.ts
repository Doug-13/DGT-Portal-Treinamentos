import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../../models/Processo';

import {
  gerarIdLocal,
  gravarJson,
  lerJson,
  PREFIXO_ARMAZENAMENTO_TESTE
} from '../../utils/armazenamentoLocal';

// ============================================================
// PROCESSOS E VÍNCULOS DOCUMENTO ↔ PROCESSO
//
// Lê do Dataverse (dgt_processo e dgt_documentoprocesso) SEM
// gravar nada lá. Tudo o que for criado no modo de teste
// (processos, vínculos, escolha do processo principal) fica no
// navegador e aparece marcado como "teste".
// ============================================================

const CHAVE_PROCESSOS =
  `${PREFIXO_ARMAZENAMENTO_TESTE}processos`;

const CHAVE_VINCULOS =
  `${PREFIXO_ARMAZENAMENTO_TESTE}documento-processo`;

const CHAVE_PRINCIPAL =
  `${PREFIXO_ARMAZENAMENTO_TESTE}processo-principal`;

export interface IDadosProcessos {
  processos: IProcesso[];
  vinculos: IDocumentoProcessoVinculo[];

  // Mensagem quando a leitura do Dataverse falhou (a tela continua
  // funcionando só com os dados de teste).
  aviso: string;
}

export interface INovoProcessoTeste {
  codigo: string;
  nome: string;
  descricao?: string;
}

const limparId = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {

  const valor =
    registro[campo];

  return valor === undefined || valor === null
    ? ''
    : String(valor).trim();
};

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// ------------------------------------------------------------
// Cache da leitura do Dataverse (uma vez por carregamento)
// ------------------------------------------------------------

interface ICacheDataverse {
  processos: IProcesso[];
  vinculos: IDocumentoProcessoVinculo[];
  aviso: string;
}

let cacheDataverse: Promise<ICacheDataverse> | undefined;

const lerDataverse = async (
  dataverseService?: DataverseService
): Promise<ICacheDataverse> => {

  if (!dataverseService) {
    return {
      processos: [],
      vinculos: [],
      aviso: 'Serviço do Dataverse indisponível nesta tela. Exibindo apenas os dados de teste.'
    };
  }

  const avisos: string[] = [];

  let processos: IProcesso[] = [];

  let vinculos: IDocumentoProcessoVinculo[] = [];

  try {

    const registros =
      await dataverseService.getProcessos();

    processos =
      registros.map(
        registro => ({
          id: limparId(registro.dgt_processoid),
          codigo: texto(registro, 'dgt_codigo'),
          nome: texto(registro, 'dgt_name') || texto(registro, 'dgt_codigo'),
          descricao: texto(registro, 'dgt_descricao') || undefined,
          ativo: true,
          origem: 'dataverse' as const
        })
      );

  } catch (error) {

    console.error(error);

    avisos.push('Não foi possível ler os processos do Dataverse (dgt_processo).');
  }

  try {

    const registros =
      await dataverseService.getDocumentoProcessos();

    vinculos =
      registros
        .map(
          registro => ({
            id: limparId(registro.dgt_documentoprocessoid),
            documentoId: limparId(registro._dgt_documento_value),
            processoId: limparId(registro._dgt_processo_value),
            principal: false,
            origem: 'dataverse' as const
          })
        )
        .filter(
          vinculo =>
            !!vinculo.documentoId &&
            !!vinculo.processoId
        );

  } catch (error) {

    console.error(error);

    avisos.push('Não foi possível ler os vínculos documento × processo (dgt_documentoprocesso).');
  }

  return {
    processos,
    vinculos,
    aviso:
      avisos.length > 0
        ? `${avisos.join(' ')} Exibindo apenas os dados de teste.`
        : ''
  };
};

// ------------------------------------------------------------
// Dados locais (modo de teste)
// ------------------------------------------------------------

const processosLocais = (): IProcesso[] =>
  lerJson<IProcesso[]>(CHAVE_PROCESSOS, []);

const vinculosLocais = (): IDocumentoProcessoVinculo[] =>
  lerJson<IDocumentoProcessoVinculo[]>(CHAVE_VINCULOS, []);

const principaisLocais = (): Record<string, string> =>
  lerJson<Record<string, string>>(CHAVE_PRINCIPAL, {});

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export const carregarDadosProcessos = async (
  dataverseService?: DataverseService,
  forcarReleitura: boolean = false
): Promise<IDadosProcessos> => {

  if (
    !cacheDataverse ||
    forcarReleitura
  ) {
    cacheDataverse =
      lerDataverse(dataverseService);
  }

  const dataverse =
    await cacheDataverse;

  const processos =
    [
      ...dataverse.processos,
      ...processosLocais()
    ].sort(
      (a, b) =>
        (a.codigo || a.nome).localeCompare(b.codigo || b.nome, 'pt-BR')
    );

  const idsProcessos =
    processos.map(processo => processo.id);

  const principais =
    principaisLocais();

  const vinculos =
    [
      ...dataverse.vinculos,
      ...vinculosLocais()
    ]
      .filter(
        vinculo =>
          idsProcessos.indexOf(vinculo.processoId) >= 0
      )
      .map(
        vinculo => ({
          ...vinculo,
          principal:
            principais[vinculo.documentoId] === vinculo.processoId
        })
      );

  return {
    processos,
    vinculos,
    aviso: dataverse.aviso
  };
};

export const criarProcessoTeste = (
  dados: INovoProcessoTeste,
  existentes: IProcesso[]
): { ok: boolean; erro: string; processo?: IProcesso } => {

  const codigo =
    (dados.codigo || '').trim();

  const nome =
    (dados.nome || '').trim();

  if (!codigo || !nome) {
    return { ok: false, erro: 'Informe o código e o nome do processo.' };
  }

  if (
    existentes.some(
      processo => normalizar(processo.codigo) === normalizar(codigo)
    )
  ) {
    return { ok: false, erro: `Já existe um processo com o código "${codigo}".` };
  }

  const processo: IProcesso = {
    id: gerarIdLocal('processo-teste'),
    codigo,
    nome,
    descricao: (dados.descricao || '').trim() || undefined,
    ativo: true,
    origem: 'teste'
  };

  gravarJson(
    CHAVE_PROCESSOS,
    [...processosLocais(), processo]
  );

  return { ok: true, erro: '', processo };
};

export const vincularDocumentoTeste = (
  documentoId: string,
  processoId: string,
  vinculosAtuais: IDocumentoProcessoVinculo[]
): void => {

  const doc =
    limparId(documentoId);

  if (
    vinculosAtuais.some(
      vinculo =>
        vinculo.documentoId === doc &&
        vinculo.processoId === processoId
    )
  ) {
    return;
  }

  gravarJson(
    CHAVE_VINCULOS,
    [
      ...vinculosLocais(),
      {
        id: gerarIdLocal('vinculo-teste'),
        documentoId: doc,
        processoId,
        principal: false,
        origem: 'teste'
      }
    ]
  );
};

export const removerVinculoTeste = (
  vinculoId: string
): void => {

  gravarJson(
    CHAVE_VINCULOS,
    vinculosLocais().filter(
      vinculo => vinculo.id !== vinculoId
    )
  );
};

export const definirProcessoPrincipalTeste = (
  documentoId: string,
  processoId: string
): void => {

  gravarJson(
    CHAVE_PRINCIPAL,
    {
      ...principaisLocais(),
      [limparId(documentoId)]: processoId
    }
  );
};

// Processo que governa a revisão do documento:
//   1. o marcado como principal;
//   2. senão, se houver só um vínculo, ele;
//   3. senão, nenhum (o usuário precisa escolher).
export const processoPrincipalDoDocumento = (
  documentoId: string,
  vinculos: IDocumentoProcessoVinculo[]
): string | undefined => {

  const doc =
    limparId(documentoId);

  const doDocumento =
    vinculos.filter(
      vinculo => vinculo.documentoId === doc
    );

  const principal =
    doDocumento.find(
      vinculo => vinculo.principal
    );

  if (principal) {
    return principal.processoId;
  }

  return doDocumento.length === 1
    ? doDocumento[0].processoId
    : undefined;
};

export const vinculosDoDocumento = (
  documentoId: string,
  vinculos: IDocumentoProcessoVinculo[]
): IDocumentoProcessoVinculo[] => {

  const doc =
    limparId(documentoId);

  return vinculos.filter(
    vinculo => vinculo.documentoId === doc
  );
};

export const idDocumentoNormalizado = (
  documentoId: string
): string =>
  limparId(documentoId);

// ------------------------------------------------------------
// Navegação: abrir um processo específico a partir de outra tela
// ------------------------------------------------------------

let processoParaAbrir: string | undefined;

export const solicitarAberturaProcesso = (
  processoId: string
): void => {
  processoParaAbrir = processoId;
};

export const consumirAberturaProcesso = (): string | undefined => {

  const valor =
    processoParaAbrir;

  processoParaAbrir = undefined;

  return valor;
};
