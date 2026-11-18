import { AssistenteImplantacoes } from './AssistenteImplantacoes';
import { BaseImplantacoes } from './BaseImplantacoes';
import {
  CHAVE_CONFIG_IA_IMPLANTACOES,
  COMPORTAMENTO_PADRAO_IMPLANTACOES,
  ConfigIaImplantacoes
} from './ConfigIaImplantacoes';
import { DataverseService } from '../DataverseService';

// ============================================================
// IMPLANTAÇÕES — Assistente IA: resposta inteira (sem aviso de
// "sem espaço") e "Configurar IA" (comportamento, só administrador).
// ============================================================

interface IChamadaIa { sistema: string; mensagem: string }

const montar = (
  respostas: Array<{ texto: string; parada?: string }>,
  registros: Array<Record<string, unknown>> = []
): {
  dataverse: DataverseService;
  chamadas: IChamadaIa[];
  filtros: string[];
  criados: Array<Record<string, unknown>>;
} => {
  const chamadas: IChamadaIa[] = [];
  const filtros: string[] = [];
  const criados: Array<Record<string, unknown>> = [];
  const fila = respostas.slice();
  const dataverse = {
    analisarLicitacaoIa: (pedido: IChamadaIa) => {
      chamadas.push(pedido);
      return Promise.resolve(fila.shift() || { texto: '', parada: 'end_turn' });
    },
    listarRegistros: (_tabela: string, consulta: string) => {
      filtros.push(consulta);
      return Promise.resolve(registros);
    },
    criarRegistro: (_tabela: string, dados: Record<string, unknown>) => {
      criados.push(dados);
      return Promise.resolve('novo-id');
    },
    atualizarRegistro: () => Promise.resolve()
  } as unknown as DataverseService;
  return { dataverse, chamadas, filtros, criados };
};

const base = { balde: () => ({}) } as unknown as BaseImplantacoes;

describe('Assistente de Implantações — tamanho da resposta', () => {

  it('resposta cortada pelo limite: pede a continuação e entrega o texto inteiro, sem aviso', async () => {
    const { dataverse, chamadas } = montar([
      { texto: 'Projeto 10381 no prazo; faturado ', parada: 'max_tokens' },
      { texto: 'R$ 120.000,00 de R$ 300.000,00.', parada: 'end_turn' }
    ]);
    const texto = await new AssistenteImplantacoes(dataverse, base).responder({ pergunta: 'Como está o 10381?' });
    expect(texto).toBe('Projeto 10381 no prazo; faturado R$ 120.000,00 de R$ 300.000,00.');
    expect(texto).not.toMatch(/interrompida|espaço|recorte menor/i);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].mensagem).toContain('Continue EXATAMENTE de onde parou');
    expect(chamadas[1].mensagem).toContain('faturado ');
  });

  it('resposta completa: uma chamada só', async () => {
    const { dataverse, chamadas } = montar([{ texto: 'Tudo no prazo.', parada: 'end_turn' }]);
    expect(await new AssistenteImplantacoes(dataverse, base).responder({ pergunta: 'Resumo?' })).toBe('Tudo no prazo.');
    expect(chamadas).toHaveLength(1);
  });

  it('as instruções proíbem dizer que falta espaço', async () => {
    const { dataverse, chamadas } = montar([{ texto: 'Ok.', parada: 'end_turn' }]);
    await new AssistenteImplantacoes(dataverse, base).responder({ pergunta: 'Resumo?' });
    expect(chamadas[0].sistema).toMatch(/Nunca diga que falta espaço/);
  });
});

describe('Configurar IA (Implantações)', () => {

  it('sem configuração salva, usa o comportamento padrão (objetivo, para diretoria)', async () => {
    const { dataverse, chamadas, filtros } = montar([{ texto: 'Ok.', parada: 'end_turn' }]);
    await new AssistenteImplantacoes(dataverse, base).responder({ pergunta: 'Resumo?' });
    expect(chamadas[0].sistema).toContain(COMPORTAMENTO_PADRAO_IMPLANTACOES);
    expect(COMPORTAMENTO_PADRAO_IMPLANTACOES).toMatch(/NÃO reproduza/);
    // Lê só a chave de Implantações (a análise de Licitações não é tocada).
    expect(filtros[0]).toContain(`'${CHAVE_CONFIG_IA_IMPLANTACOES}'`);
    expect(filtros[0]).not.toContain('licitacoes');
  });

  it('com configuração salva, o comportamento do administrador vai para a IA', async () => {
    const { dataverse, chamadas } = montar(
      [{ texto: 'Ok.', parada: 'end_turn' }],
      [{ dgt_iapromptid: 'p1', dgt_versao: 2, dgt_ativo: true, dgt_instrucoessistema: 'Responda em no máximo 3 linhas.' }]
    );
    await new AssistenteImplantacoes(dataverse, base).responder({ pergunta: 'Resumo?' });
    expect(chamadas[0].sistema).toContain('Responda em no máximo 3 linhas.');
    expect(chamadas[0].sistema).not.toContain(COMPORTAMENTO_PADRAO_IMPLANTACOES);
    // As regras fixas continuam.
    expect(chamadas[0].sistema).toContain('Nunca invente números');
  });

  it('só o administrador do módulo lê ou salva a configuração', async () => {
    const { dataverse, criados } = montar([]);
    const servico = new ConfigIaImplantacoes(dataverse);

    const negado = await servico.rota(false, 'Fulano')('api/assistente/config', { comportamento: 'Curto.' }, '');
    expect(negado && negado.status).toBe(403);
    expect(criados).toHaveLength(0);

    const salvo = await servico.rota(true, 'Admin')('api/assistente/config', { comportamento: 'Curto e direto.' }, '');
    expect(salvo && salvo.status).toBe(200);
    expect(criados).toHaveLength(1);
    expect(criados[0].dgt_chave).toBe(CHAVE_CONFIG_IA_IMPLANTACOES);
    expect(criados[0].dgt_instrucoessistema).toBe('Curto e direto.');

    // Outras rotas seguem para os demais tratadores.
    expect(await servico.rota(true, 'Admin')('api/assistente', {}, '')).toBeUndefined();
  });
});
