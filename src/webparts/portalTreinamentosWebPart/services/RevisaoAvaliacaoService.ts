import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

// ============================================================
// REVISÃO DA AVALIAÇÃO (gabarito da tentativa)
//
// Lê o que o ProcessarAvaliacaoPlugin gravou na correção:
//   dgt_tentativaquestao  questões apresentadas (enunciado registrado,
//                         ordem, acertou ou não, pontos)
//   dgt_resposta          cada alternativa apresentada (texto
//                         registrado, se foi marcada, se era a correta)
//
// Usa os textos REGISTRADOS na tentativa: se a questão for alterada
// depois, a revisão continua mostrando exatamente o que a pessoa viu.
//
// A tela só oferece a revisão quando a pessoa foi APROVADA (regra da
// AvaliacaoPage), para não entregar o gabarito antes de uma nova
// tentativa.
// ============================================================

export interface IRevisaoAlternativa {
  id: string;
  texto: string;
  ordem: number;
  selecionada: boolean;
  correta: boolean;
}

export interface IRevisaoQuestao {
  id: string;
  enunciado: string;
  ordem: number;
  acertou: boolean;
  respondida: boolean;
  alternativas: IRevisaoAlternativa[];
}

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v);
};

const numero = (r: IDataverseRecord, campo: string): number => {
  const v = Number(r[campo]);
  return isNaN(v) ? 0 : v;
};

const lotes = <T>(itens: T[], tamanho: number): T[][] => {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultado.push(itens.slice(i, i + tamanho));
  }
  return resultado;
};

export const carregarRevisaoTentativa = async (
  dataverse: DataverseService,
  tentativaId: string
): Promise<IRevisaoQuestao[]> => {

  const id = guid(tentativaId);

  if (!id) {
    return [];
  }

  const questoes =
    await dataverse.listarRegistros(
      'dgt_tentativaquestao',
      '$select=dgt_tentativaquestaoid,dgt_enunciadoregistrado,dgt_name,dgt_ordemapresentada,dgt_correta,dgt_respondida' +
      `&$filter=_dgt_tentativa_value eq ${id}`
    );

  if (questoes.length === 0) {
    return [];
  }

  const respostas: IDataverseRecord[] = [];

  for (const lote of lotes(questoes.map(q => guid(q.dgt_tentativaquestaoid)), 20)) {
    (await dataverse.listarRegistros(
      'dgt_resposta',
      '$select=dgt_respostaid,_dgt_tentativaquestao_value,dgt_textoregistrado,dgt_name,dgt_ordemapresentada,dgt_selecionada,dgt_corretaesperada' +
      '&$filter=' + lote.map(q => `_dgt_tentativaquestao_value eq ${q}`).join(' or ')
    )).forEach(r => respostas.push(r));
  }

  return questoes
    .map(q => {
      const questaoId = guid(q.dgt_tentativaquestaoid);

      return {
        id: questaoId,
        enunciado: texto(q, 'dgt_enunciadoregistrado') || texto(q, 'dgt_name'),
        ordem: numero(q, 'dgt_ordemapresentada'),
        acertou: q.dgt_correta === true,
        respondida: q.dgt_respondida !== false,
        alternativas:
          respostas
            .filter(r => guid(r._dgt_tentativaquestao_value) === questaoId)
            .map(r => ({
              id: guid(r.dgt_respostaid),
              texto: texto(r, 'dgt_textoregistrado') || texto(r, 'dgt_name'),
              ordem: numero(r, 'dgt_ordemapresentada'),
              selecionada: r.dgt_selecionada === true,
              correta: r.dgt_corretaesperada === true
            }))
            .sort((a, b) => a.ordem - b.ordem)
      };
    })
    .sort((a, b) => a.ordem - b.ordem);
};
