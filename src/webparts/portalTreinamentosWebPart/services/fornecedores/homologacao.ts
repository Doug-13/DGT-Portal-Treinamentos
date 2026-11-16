import {
  CodigoCertidao,
  IdVerificacao,
  IFornecedor,
  QUESTOES_INTEGRIDADE,
  ResultadoHomologacao,
  StatusFornecedor
} from './modeloFornecedores';

import {
  ISituacaoDocumental
} from './situacaoDocumental';

import {
  normalizarCnpj
} from '../../utils/cnpj';

// ============================================================
// FORNECEDORES — HOMOLOGAÇÃO (item 9 da Ficha SUP-CPL-01)
//
// Cálculo puro (testável): o que o sistema já sabe sobre cada
// verificação do checklist. É só SUGESTÃO — quem marca "OK" é a
// analista; o resultado final (Aprovado, Aprovado com ressalvas,
// Pendente, Reprovado) é decisão de Suprimentos / Compliance.
// ============================================================

export type SituacaoVerificacao = 'ok' | 'atencao' | 'pendente' | 'manual';

export interface ISugestaoVerificacao {
  situacao: SituacaoVerificacao;
  texto: string;
}

export interface IPontoAtencao {
  id: string;
  texto: string;
  resposta: string;
}

// Resultado da homologação → status do cadastro. Aprovar tira de
// "Em homologação"/"Reprovado"; não mexe em Suspenso, Bloqueado etc.
export const statusPeloResultado = (resultado: ResultadoHomologacao, atual: StatusFornecedor): StatusFornecedor =>
  resultado === 'Aprovado' || resultado === 'Aprovado com ressalvas'
    ? (atual === 'Em homologação' || atual === 'Reprovado' ? 'Homologado' : atual)
    : resultado === 'Reprovado'
      ? 'Reprovado'
      : atual;

// Respostas que pedem análise: "Sim" nas perguntas de risco e "Não"
// em 6.8 (programa de integridade) e 6.9 (LGPD).
export const pontosDeAtencao = (questionario: Record<string, string>): IPontoAtencao[] =>
  QUESTOES_INTEGRIDADE
    .filter(q => (questionario || {})[q.id] === q.atencaoQuando)
    .map(q => ({ id: q.id, texto: q.texto, resposta: questionario[q.id] }));

// Situação das certidões a partir dos documentos (tipos com consulta automática).
const avaliarCertidoes = (
  situacao: ISituacaoDocumental,
  codigos: CodigoCertidao[]
): ISugestaoVerificacao => {
  const itens = situacao.itens.filter(i => i.tipo.codigoConsulta && codigos.indexOf(i.tipo.codigoConsulta as CodigoCertidao) >= 0);
  if (itens.length === 0) {
    return { situacao: 'pendente', texto: 'Nenhum tipo de documento ligado a estas certidões (Tipos de documento › Consulta automática).' };
  }
  const vencidas = itens.filter(i => i.estado === 'Vencido').map(i => i.tipo.nome);
  const faltando = itens.filter(i => !i.documento).map(i => i.tipo.nome);
  if (vencidas.length > 0) {
    return { situacao: 'atencao', texto: `Vencida: ${vencidas.join('; ')}.` };
  }
  if (faltando.length > 0) {
    return { situacao: 'pendente', texto: `Falta: ${faltando.join('; ')}.` };
  }
  const aVencer = itens.filter(i => i.estado === 'A vencer').map(i => `${i.tipo.nome} (${i.dias} dia(s))`);
  return {
    situacao: 'ok',
    texto: aVencer.length > 0 ? `Válidas. Vencem logo: ${aVencer.join('; ')}.` : 'Todas válidas.'
  };
};

export const sugerirVerificacoes = (
  fornecedor: IFornecedor,
  situacao: ISituacaoDocumental
): Record<IdVerificacao, ISugestaoVerificacao> => {

  const receita: ISugestaoVerificacao = !fornecedor.situacaoCadastral
    ? { situacao: 'pendente', texto: 'Receita ainda não consultada.' }
    : /^ativa$/i.test(fornecedor.situacaoCadastral)
      ? { situacao: 'ok', texto: 'Ativa.' }
      : { situacao: 'atencao', texto: `Situação: ${fornecedor.situacaoCadastral}.` };

  const sancoes: ISugestaoVerificacao =
    fornecedor.resultadoSancoes === 'Nada consta' ? { situacao: 'ok', texto: 'Nada consta (CEIS, CNEP e CEPIM).' }
      : fornecedor.resultadoSancoes === 'Com registro' ? { situacao: 'atencao', texto: 'Sanção vigente na última consulta.' }
        : fornecedor.resultadoSancoes === 'Erro na consulta' ? { situacao: 'pendente', texto: 'A última consulta falhou: consulte de novo.' }
          : { situacao: 'pendente', texto: 'Sanções ainda não consultadas.' };

  const resposta65 = (fornecedor.questionario || {})['6.5'];
  const credito: ISugestaoVerificacao = resposta65 === 'Sim'
    ? { situacao: 'atencao', texto: 'O fornecedor declarou constar em cadastro de inadimplentes (6.5).' }
    : { situacao: 'manual', texto: resposta65 ? `Declarado na 6.5: ${resposta65}. Consulta ao birô não automatizada.` : 'Consulta ao birô não automatizada.' };

  const pontos = pontosDeAtencao(fornecedor.questionario || {});
  const respondido = Object.keys(fornecedor.questionario || {}).some(k => !!fornecedor.questionario[k]);
  const questionario: ISugestaoVerificacao = !respondido
    ? { situacao: 'pendente', texto: 'Questionário não respondido.' }
    : pontos.length === 0
      ? { situacao: 'ok', texto: 'Nenhuma resposta de atenção.' }
      : { situacao: 'atencao', texto: `${pontos.length} resposta(s) para analisar: ${pontos.map(p => p.id).join(', ')}.` };

  const banco = fornecedor.dadosBancarios;
  const bancario: ISugestaoVerificacao = !banco
    ? { situacao: 'manual', texto: 'Dados bancários não informados ou sem permissão de leitura.' }
    : !banco.cnpjTitular
      ? { situacao: 'pendente', texto: 'CNPJ do titular não informado.' }
      : fornecedor.cnpj && normalizarCnpj(banco.cnpjTitular) !== normalizarCnpj(fornecedor.cnpj)
        ? { situacao: 'atencao', texto: 'O CNPJ do titular é DIFERENTE do CNPJ cadastrado: pagamento só em conta do próprio CNPJ.' }
        : fornecedor.bancarioConferido
          ? { situacao: 'ok', texto: 'Titular = CNPJ e confirmação telefônica registrada.' }
          : { situacao: 'pendente', texto: 'Titular = CNPJ. Falta a confirmação por contato telefônico independente.' };

  return {
    receita,
    cnds: avaliarCertidoes(situacao, ['cnd_federal', 'fgts', 'cnd_estadual', 'cnd_municipal']),
    cndt: avaliarCertidoes(situacao, ['cndt']),
    ceisCnep: sancoes,
    credito,
    financeira: { situacao: 'manual', texto: 'Área contábil (balanço / DRE).' },
    judicial: { situacao: 'manual', texto: 'Jurídico.' },
    questionario,
    bancario
  };
};
