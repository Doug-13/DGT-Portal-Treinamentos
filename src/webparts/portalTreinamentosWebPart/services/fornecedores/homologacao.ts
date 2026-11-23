import {
  ClassificacaoRisco,
  CLASSIFICACOES_RISCO,
  CodigoCertidao,
  EtapaHomologacao,
  ETAPAS_HOMOLOGACAO,
  ICicloHomologacao,
  IDadosHomologacao,
  IdVerificacao,
  IFornecedor,
  QUESTOES_INTEGRIDADE,
  ResultadoHomologacao,
  StatusFornecedor,
  VERIFICACOES_HOMOLOGACAO
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

// ------------------------------------------------------------
// Kanban (ciclos de homologação)
// ------------------------------------------------------------

export const resultadoConclusivo = (resultado: ResultadoHomologacao): boolean =>
  resultado === 'Aprovado' || resultado === 'Aprovado com ressalvas' || resultado === 'Reprovado';

// O que impede concluir o ciclo (vazio = pode concluir). Mesmas regras
// que a aba Homologação já aplicava ao aprovar.
export const validarConclusao = (d: IDadosHomologacao): string => {
  const resultado = d.resultadoHomologacao || 'Pendente';
  const aprovado = resultado === 'Aprovado' || resultado === 'Aprovado com ressalvas';
  if (!resultadoConclusivo(resultado)) {
    return 'Para concluir, defina o resultado: Aprovado, Aprovado com ressalvas ou Reprovado.';
  }
  if (aprovado && !d.classificacaoRisco) {
    return 'Defina a classificação de risco antes de aprovar.';
  }
  if (aprovado && !d.validadeCadastro) {
    return 'Informe a validade do cadastro / próxima revisão antes de aprovar.';
  }
  if ((resultado === 'Aprovado com ressalvas' || resultado === 'Reprovado') && !(d.ressalvas || '').trim()) {
    return 'Descreva as ressalvas, medidas de mitigação ou a referência ao parecer.';
  }
  return '';
};

export const cicloEstaAberto = (c: ICicloHomologacao): boolean => !c.concluidoEm;

export const cicloAberto = (ciclos: ICicloHomologacao[]): ICicloHomologacao | undefined =>
  ciclos.filter(cicloEstaAberto).sort((a, b) => b.numero - a.numero)[0];

export const proximoNumeroCiclo = (ciclos: ICicloHomologacao[]): number =>
  ciclos.reduce((maior, c) => Math.max(maior, c.numero || 0), 0) + 1;

export const etapaValida = (valor: string): EtapaHomologacao =>
  (ETAPAS_HOMOLOGACAO.some(e => e.id === valor) ? valor : 'Ficha recebida') as EtapaHomologacao;

// ------------------------------------------------------------
// Motor de fluxos (processo SUP-HOM)
//
// A etapa do ciclo segue o fluxo publicado. A coluna do kanban
// (dgt_etapa) é DERIVADA da etapa do fluxo, sempre por esta função,
// para o kanban, a aba Homologações e os filtros continuarem iguais.
// ------------------------------------------------------------

// Ids das etapas no pacote docs/exemplos/pacote-homologacao-fornecedor.json.
export const ETAPAS_FLUXO_HOMOLOGACAO = {
  fichaRecebida: 'ficha-recebida',
  documentosPendentes: 'documentos-pendentes',
  analiseSuprimentos: 'analise-suprimentos',
  analiseJuridico: 'analise-juridico'
};

const MAPA_ETAPA_KANBAN: Record<string, EtapaHomologacao> = {
  'ficha-recebida': 'Ficha recebida',
  'documentos-pendentes': 'Documentos pendentes',
  'analise-suprimentos': 'Em análise',
  'analise-juridico': 'Aguardando Jurídico'
};

const semAcento = (valor: string): string =>
  (valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Etapa do fluxo → coluna do kanban. Fluxo concluído → "Concluído".
// Id desconhecido (desenho alterado): decide pelo nome da etapa.
export const etapaKanbanDoFluxo = (elementoId: string, elementoNome: string, concluido: boolean): EtapaHomologacao => {
  if (concluido) {
    return 'Concluído';
  }
  const direta = MAPA_ETAPA_KANBAN[elementoId];
  if (direta) {
    return direta;
  }
  const nome = semAcento(elementoNome);
  if (nome.indexOf('juridic') >= 0) { return 'Aguardando Jurídico'; }
  if (nome.indexOf('document') >= 0) { return 'Documentos pendentes'; }
  if (nome.indexOf('ficha') >= 0) { return 'Ficha recebida'; }
  return 'Em análise';
};

// Coluna antiga do kanban → etapa equivalente do fluxo (ciclos abertos
// antes do motor). "Concluído" não tem equivalente: ciclo fechado.
export const etapaFluxoDaColuna = (etapa: EtapaHomologacao): string | undefined => {
  const ids = Object.keys(MAPA_ETAPA_KANBAN).filter(id => MAPA_ETAPA_KANBAN[id] === etapa);
  return ids[0];
};

// Resultado da ação do Jurídico → resultado da homologação. Vazio = a
// ação não conclui o ciclo (ex.: Devolver a Suprimentos). O botão de
// reprovar chama-se "Não homologar" (resultado naoHomologado): o motor
// não aceita uma ação "reprov…/devol…" que leve ao fim do fluxo.
export const resultadoPelaAcao = (resultadoAcao: string): ResultadoHomologacao => {
  const r = semAcento(resultadoAcao).replace(/[^a-z]/g, '');
  if (r === 'aprovado') { return 'Aprovado'; }
  if (r === 'aprovadoressalvas' || r === 'aprovadocomressalvas') { return 'Aprovado com ressalvas'; }
  if (r === 'reprovado' || r === 'naohomologado') { return 'Reprovado'; }
  return '';
};

// Valores do fluxo usados na conclusão (chaves dos metadados do SUP-HOM).
export const CAMPOS_FLUXO_HOMOLOGACAO = {
  classificacaoRisco: 'classificacaoRisco',
  validadeCadastro: 'validadeCadastro',
  parecer: 'parecer'
};

const riscoValido = (valor: string): ClassificacaoRisco =>
  (CLASSIFICACOES_RISCO.indexOf(valor as ClassificacaoRisco) >= 0 ? valor : '') as ClassificacaoRisco;

// Dados da conclusão pelo Jurídico: risco e validade preenchidos no
// fluxo (Análise Suprimentos) ou já no card; ressalvas = parecer do
// Jurídico ou, sem ele, o comentário da ação.
export const dadosConclusaoPeloFluxo = (
  ciclo: ICicloHomologacao,
  bancarioConferido: boolean,
  valores: Record<string, string>,
  resultado: ResultadoHomologacao,
  comentario: string
): IDadosHomologacao => {
  const v = valores || {};
  const parecer = (v[CAMPOS_FLUXO_HOMOLOGACAO.parecer] || '').trim();
  return {
    classificacaoRisco: riscoValido(v[CAMPOS_FLUXO_HOMOLOGACAO.classificacaoRisco] || '') || ciclo.classificacaoRisco,
    resultadoHomologacao: resultado,
    ressalvas: parecer || (comentario || '').trim() || ciclo.ressalvas,
    validadeCadastro: (v[CAMPOS_FLUXO_HOMOLOGACAO.validadeCadastro] || '').substring(0, 10) || ciclo.validadeCadastro,
    verificacoes: { ...(ciclo.verificacoes || {}) },
    responsavelSuprimentos: ciclo.responsavelSuprimentos,
    responsavelCompliance: ciclo.responsavelCompliance,
    bancarioConferido
  };
};

// Tipos de documento MANUAIS (sem consulta automática) que faltam,
// vencidos ou a vencer: vão no e-mail "Documentos pendentes" ao fornecedor.
export const documentosManuaisPendentes = (situacao: ISituacaoDocumental): string[] =>
  situacao.pendencias
    .filter(p => !p.tipo.codigoConsulta)
    .map(p => p.estado === 'Faltando' ? p.tipo.nome : `${p.tipo.nome} (${p.estado.toLowerCase()})`);

export const verificacoesOk = (c: { verificacoes: ICicloHomologacao['verificacoes'] }): number =>
  VERIFICACOES_HOMOLOGACAO.filter(v => {
    const marcada = (c.verificacoes || {})[v.id];
    return !!marcada && marcada.ok;
  }).length;

// Ciclo novo: parte do que já está no cadastro (homologações feitas antes
// do kanban não se perdem).
export const dadosIniciaisDoCiclo = (f: IFornecedor): IDadosHomologacao => ({
  classificacaoRisco: f.classificacaoRisco,
  resultadoHomologacao: 'Pendente',
  ressalvas: '',
  validadeCadastro: '',
  verificacoes: {},
  responsavelSuprimentos: '',
  responsavelCompliance: '',
  bancarioConferido: f.bancarioConferido
});

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
    cndt: avaliarCertidoes(situacao, ['cndt', 'ceat']),
    ceisCnep: sancoes,
    credito,
    financeira: { situacao: 'manual', texto: 'Área contábil (balanço / DRE).' },
    judicial: { situacao: 'manual', texto: 'Jurídico.' },
    questionario,
    bancario
  };
};
