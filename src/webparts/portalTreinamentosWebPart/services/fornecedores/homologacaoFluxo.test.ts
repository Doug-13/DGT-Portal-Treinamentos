// Testes rodam no Node (Jest); o projeto não inclui @types/node.
declare const require: (modulo: string) => unknown;
declare const __dirname: string;
const fs = require('fs') as { readFileSync: (caminho: string, codificacao: string) => string };
const path = require('path') as { join: (...partes: string[]) => string };

import {
  interpretarPacote
} from '../pacoteProcesso/pacoteProcesso';

import {
  dadosConclusaoPeloFluxo,
  documentosManuaisPendentes,
  ETAPAS_FLUXO_HOMOLOGACAO,
  etapaFluxoDaColuna,
  etapaKanbanDoFluxo,
  resultadoPelaAcao,
  validarConclusao
} from './homologacao';

import {
  contratoNoAvisoDeVencimento,
  filtrarContratos,
  ordenarContratos,
  projetosDistintos,
  situacaoDoContrato,
  validarContrato
} from './contratos';

import {
  documentoColaboradorNoAviso,
  documentoNoAvisoAoFornecedor,
  ehDocumentoAutomatico,
  fornecedorRecebeAviso
} from './avisosVencimento';

import {
  CodigoCertidao,
  ICicloHomologacao,
  IContratoFornecedor,
  ITipoDocumentoFornecedor
} from './modeloFornecedores';

import {
  ISituacaoDocumental
} from './situacaoDocumental';

// ============================================================
// FORNECEDORES — homologação no motor de fluxos (SUP-HOM),
// contratos e avisos de vencimento
// ============================================================

// lib-commonjs/webparts/portalTreinamentosWebPart/services/fornecedores → raiz
const pacote = (): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'docs', 'exemplos', 'pacote-homologacao-fornecedor.json'), 'utf8');

const ciclo = (extra: Partial<ICicloHomologacao> = {}): ICicloHomologacao => ({
  id: 'c1', fornecedorId: 'f1', numero: 1, motivo: 'Cadastro inicial', etapa: 'Aguardando Jurídico',
  etapaDesde: '', concluidoEm: '', protocolo: 'FORN-2026-0001', classificacaoRisco: '', resultadoHomologacao: 'Pendente',
  ressalvas: '', validadeCadastro: '', verificacoes: {}, responsavelSuprimentos: '', responsavelCompliance: '',
  bancarioConferido: false, abertoPor: '', criadoEm: '', fluxoIniciado: true, etapaAtual: 'analise-juridico',
  prazoEtapa: '', responsaveisEtapa: '', ...extra
});

const hoje = new Date(2026, 10, 19);

describe('Homologação no motor de fluxos', () => {

  it('etapa do fluxo → coluna do kanban (um lugar só)', () => {
    expect(etapaKanbanDoFluxo(ETAPAS_FLUXO_HOMOLOGACAO.fichaRecebida, '', false)).toBe('Ficha recebida');
    expect(etapaKanbanDoFluxo(ETAPAS_FLUXO_HOMOLOGACAO.documentosPendentes, '', false)).toBe('Documentos pendentes');
    expect(etapaKanbanDoFluxo(ETAPAS_FLUXO_HOMOLOGACAO.analiseSuprimentos, '', false)).toBe('Em análise');
    expect(etapaKanbanDoFluxo(ETAPAS_FLUXO_HOMOLOGACAO.analiseJuridico, '', false)).toBe('Aguardando Jurídico');
    expect(etapaKanbanDoFluxo('homologado', 'Homologado', true)).toBe('Concluído');
    // Desenho alterado (id novo): decide pelo nome.
    expect(etapaKanbanDoFluxo('parecer-jur', 'Parecer do Jurídico', false)).toBe('Aguardando Jurídico');
    expect(etapaKanbanDoFluxo('docs2', 'Reenvio de documentos', false)).toBe('Documentos pendentes');
    expect(etapaKanbanDoFluxo('x', 'Conferência', false)).toBe('Em análise');
  });

  it('ciclo anterior ao motor: coluna antiga → etapa equivalente', () => {
    expect(etapaFluxoDaColuna('Aguardando Jurídico')).toBe('analise-juridico');
    expect(etapaFluxoDaColuna('Em análise')).toBe('analise-suprimentos');
    expect(etapaFluxoDaColuna('Concluído')).toBeUndefined();
  });

  it('só as decisões do Jurídico concluem o ciclo', () => {
    expect(resultadoPelaAcao('aprovado')).toBe('Aprovado');
    expect(resultadoPelaAcao('aprovadoRessalvas')).toBe('Aprovado com ressalvas');
    expect(resultadoPelaAcao('reprovado')).toBe('Reprovado');
    expect(resultadoPelaAcao('naoHomologado')).toBe('Reprovado');
    expect(resultadoPelaAcao('devolvido')).toBe('');
    expect(resultadoPelaAcao('enviado')).toBe('');
  });

  it('conclusão pelo Jurídico usa risco e validade do fluxo e as regras de sempre', () => {
    const semRisco = dadosConclusaoPeloFluxo(ciclo(), false, {}, 'Aprovado', '');
    expect(validarConclusao(semRisco)).toMatch(/risco/);

    const ok = dadosConclusaoPeloFluxo(ciclo(), true, { classificacaoRisco: 'Baixo', validadeCadastro: '2027-11-19' }, 'Aprovado', '');
    expect(validarConclusao(ok)).toBe('');
    expect(ok.classificacaoRisco).toBe('Baixo');
    expect(ok.bancarioConferido).toBe(true);

    // Reprovar: ressalvas vêm do comentário; o parecer tem prioridade.
    expect(validarConclusao(dadosConclusaoPeloFluxo(ciclo(), false, {}, 'Reprovado', ''))).toMatch(/ressalvas/);
    expect(dadosConclusaoPeloFluxo(ciclo(), false, {}, 'Reprovado', 'Sanção vigente no CEIS').ressalvas).toBe('Sanção vigente no CEIS');
    expect(dadosConclusaoPeloFluxo(ciclo(), false, { parecer: 'Parecer 12/2026' }, 'Reprovado', 'curto').ressalvas).toBe('Parecer 12/2026');

    // Risco inválido no fluxo não apaga o do card.
    expect(dadosConclusaoPeloFluxo(ciclo({ classificacaoRisco: 'Alto' }), false, { classificacaoRisco: 'xyz' }, 'Aprovado', '').classificacaoRisco).toBe('Alto');
  });

  it('e-mail "Documentos pendentes": só os tipos manuais', () => {
    const tipo = (nome: string, codigo?: CodigoCertidao): ITipoDocumentoFornecedor =>
      ({ id: nome, nome, descricao: '', categorias: [], obrigatorio: true, exigeValidade: true, visibilidade: 'Interno', ordem: 1, ativo: true, codigoConsulta: codigo });
    const situacao = {
      itens: [],
      pendencias: [
        { tipo: tipo('Contrato social'), estado: 'Faltando' },
        { tipo: tipo('CND Federal', 'cnd_federal'), estado: 'Faltando' },
        { tipo: tipo('PGR'), estado: 'Vencido' }
      ],
      faltando: 2, vencidos: 1, aVencer: 0
    } as unknown as ISituacaoDocumental;
    expect(documentosManuaisPendentes(situacao)).toEqual(['Contrato social', 'PGR (vencido)']);
  });

  it('pacote SUP-HOM da documentação: válido, com os ids e resultados que o portal espera', () => {
    const resultado = interpretarPacote(pacote(), {
      areas: [{ id: 'a-sup', sigla: 'SUY', nome: 'Supply' }, { id: 'a-jur', sigla: 'JUR', nome: 'Jurídico' }],
      usuarios: [],
      processos: []
    });
    expect({ erros: resultado.erros, publicacao: resultado.errosPublicacao }).toEqual({ erros: [], publicacao: [] });

    const json = JSON.parse(pacote()) as { fluxo: { elementos: Array<{ id: string; tipo: string; responsaveis?: Array<{ tipo: string }>; acoes?: Array<{ resultado: string }> }> } };
    const ids = json.fluxo.elementos.map(e => e.id);
    Object.keys(ETAPAS_FLUXO_HOMOLOGACAO).forEach(k => expect(ids).toContain((ETAPAS_FLUXO_HOMOLOGACAO as Record<string, string>)[k]));

    // Responsáveis só por área (nunca por pessoa).
    json.fluxo.elementos.filter(e => e.tipo === 'tarefaHumana')
      .forEach(e => (e.responsaveis || []).forEach(r => expect(r.tipo).toBe('area')));

    // Suprimentos não decide; o Jurídico decide os três resultados.
    const acoes = (id: string): string[] => (json.fluxo.elementos.filter(e => e.id === id)[0].acoes || []).map(a => a.resultado);
    expect(acoes('analise-suprimentos').map(resultadoPelaAcao).filter(Boolean)).toEqual([]);
    expect(acoes('analise-juridico').map(resultadoPelaAcao).filter(Boolean)).toEqual(['Aprovado', 'Aprovado com ressalvas', 'Reprovado']);
  });
});

const contrato = (extra: Partial<IContratoFornecedor> = {}): IContratoFornecedor => ({
  id: 'k1', fornecedorId: 'f1', nome: 'Contrato A', projeto: 'Projeto Norte', dataAssinatura: '2026-01-10',
  inicioVigencia: '2026-01-15', fimVigencia: '2026-12-31', arquivoUrl: '', arquivoNome: '', observacoes: '',
  situacao: 'Vigente', origem: 'Manual', documentoOrigemId: '', registradoPor: '', criadoEm: '', ...extra
});

describe('Contratos do fornecedor', () => {

  it('situação calculada pelo fim da vigência', () => {
    expect(situacaoDoContrato(contrato({ fimVigencia: '2027-06-30' }), hoje).situacao).toBe('Vigente');
    expect(situacaoDoContrato(contrato({ fimVigencia: '2026-12-01' }), hoje).texto).toBe('Vence em 12 dia(s)');
    expect(situacaoDoContrato(contrato({ fimVigencia: '2026-11-01' }), hoje).situacao).toBe('Vencido');
    expect(situacaoDoContrato(contrato({ fimVigencia: '' }), hoje).texto).toMatch(/indeterminado/);
    expect(situacaoDoContrato(contrato({ situacao: 'Encerrado', fimVigencia: '2026-11-01' }), hoje).situacao).toBe('Encerrado');
  });

  it('valida nome, projeto e datas', () => {
    const base = { nome: 'C', projeto: 'P', dataAssinatura: '', inicioVigencia: '2026-01-01', fimVigencia: '', observacoes: '' };
    expect(validarContrato(base)).toBe('');
    expect(validarContrato({ ...base, nome: ' ' })).toMatch(/nome/);
    expect(validarContrato({ ...base, projeto: '' })).toMatch(/projeto/);
    expect(validarContrato({ ...base, inicioVigencia: '' })).toMatch(/início/);
    expect(validarContrato({ ...base, fimVigencia: '2025-12-31' })).toMatch(/anterior ao início/);
  });

  it('filtra por projeto, ordena e lista projetos sem repetir', () => {
    const lista = [
      contrato({ id: 'a', projeto: 'Projeto Norte', fimVigencia: '2026-12-01' }),
      contrato({ id: 'b', projeto: 'projeto norte', fimVigencia: '2027-05-01' }),
      contrato({ id: 'c', projeto: 'Sul', fimVigencia: '' })
    ];
    expect(projetosDistintos(lista)).toEqual(['Projeto Norte', 'Sul']);
    expect(filtrarContratos(lista, 'Projeto Norte').map(c => c.id)).toEqual(['a', 'b']);
    expect(filtrarContratos(lista, '', 30, hoje).map(c => c.id)).toEqual(['a']);
    expect(ordenarContratos(lista, 'fim').map(c => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('aviso interno: vigentes vencendo em até 15 dias', () => {
    expect(contratoNoAvisoDeVencimento(contrato({ fimVigencia: '2026-12-01' }), hoje)).toBe(true);
    expect(contratoNoAvisoDeVencimento(contrato({ fimVigencia: '2026-12-10' }), hoje)).toBe(false);
    expect(contratoNoAvisoDeVencimento(contrato({ fimVigencia: '2026-11-18' }), hoje)).toBe(false);
    expect(contratoNoAvisoDeVencimento(contrato({ fimVigencia: '2026-12-01', situacao: 'Encerrado' }), hoje)).toBe(false);
  });
});

describe('Aviso de vencimento ao fornecedor', () => {

  it('só documentos manuais, vigentes, em até 15 dias e ainda não avisados', () => {
    const doc = { situacao: 'Vigente' as const, vencimento: '2026-11-30', registradoPor: 'Analista' };
    expect(documentoNoAvisoAoFornecedor(doc, hoje)).toBe(true);
    expect(ehDocumentoAutomatico('Analista (automático)')).toBe(true);
    expect(documentoNoAvisoAoFornecedor({ ...doc, registradoPor: 'Analista (automático)' }, hoje)).toBe(false);
    expect(documentoNoAvisoAoFornecedor({ ...doc, vencimento: '2026-12-31' }, hoje)).toBe(false);
    expect(documentoNoAvisoAoFornecedor({ ...doc, avisoVencimentoEm: '2026-11-15T10:00:00Z' }, hoje)).toBe(false);
    expect(documentoNoAvisoAoFornecedor({ ...doc, situacao: 'Substituído' }, hoje)).toBe(false);
  });

  it('colaboradores: só ativos; fornecedor bloqueado não recebe', () => {
    const aso = { situacao: 'Vigente' as const, vencimento: '2026-11-25' };
    expect(documentoColaboradorNoAviso(aso, true, hoje)).toBe(true);
    expect(documentoColaboradorNoAviso(aso, false, hoje)).toBe(false);
    expect(fornecedorRecebeAviso('Homologado')).toBe(true);
    expect(fornecedorRecebeAviso('Em homologação')).toBe(true);
    expect(fornecedorRecebeAviso('Bloqueado')).toBe(false);
    expect(fornecedorRecebeAviso('Inativo' as never)).toBe(false);
  });
});
