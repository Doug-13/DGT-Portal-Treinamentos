import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  INotificacaoSolicitada,
  configNotificacaoPadrao
} from '../fluxo/notificacaoFluxo';

import {
  NotificacaoFluxoService,
  STATUS_PENDENTE_EMAIL,
  STATUS_PENDENTE_TEAMS,
  TABELA_FILA_EMAIL,
  TIPO_NOTIFICACAO_FLUXO,
  mensagemEmHtml
} from './NotificacaoFluxoService';

// Dataverse simulado: só o que o serviço usa (valores fictícios).
const criarDataverse = (): { dv: DataverseService; linhas: Array<{ tabela: string; corpo: IDataverseRecord }> } => {
  const linhas: Array<{ tabela: string; corpo: IDataverseRecord }> = [];
  const dv = {
    listarRegistros: async (tabela: string, consulta: string): Promise<IDataverseRecord[]> => {
      if (tabela === 'dgt_usuarioarea') {
        return [];
      }
      if (tabela === 'dgt_usuario') {
        const id = (consulta.match(/dgt_usuarioid eq ([\w-]+)/) || [])[1];
        return id ? [{ dgt_usuarioid: id, dgt_name: `Pessoa ${id}`, dgt_email: `${id}@exemplo.com`, dgt_ativo: true }] : [];
      }
      const motivo = (consulta.match(/dgt_motivo eq '([^']+)'/) || [])[1];
      return linhas.filter(item => item.tabela === tabela && item.corpo.dgt_motivo === motivo).map(item => item.corpo);
    },
    criarRegistro: async (tabela: string, corpo: IDataverseRecord): Promise<IDataverseRecord> => {
      linhas.push({ tabela, corpo });
      return corpo;
    }
  } as unknown as DataverseService;
  return { dv, linhas };
};

const pedido = (canais: Array<'email' | 'teams'>): INotificacaoSolicitada => ({
  chave: 'rev-1:etapa:not-1:n1',
  elementoId: 'etapa',
  elementoNome: 'Aprovação',
  origem: 'atividade',
  momento: 'aoChegar',
  config: { ...configNotificacaoPadrao('atividade'), canais, assunto: '{registro} em {etapa}', mensagem: 'Acesse <aqui>:\n{link}' },
  responsaveisEtapa: [{ tipo: 'usuario', descricao: 'Usuário', papelTeste: 'x' }],
  solicitadaEm: '2026-11-19T10:00:00.000Z'
});

const dados = {
  origem: '',
  alvoId: 'rev-1',
  registro: 'PRO-POP-004 Rev.01',
  revisao: '01',
  processo: 'Teste',
  valores: {},
  link: 'https://portal.exemplo/pagina',
  // Dois responsáveis (ids fictícios).
  resolverResponsaveis: () => [
    { papelTeste: 'a', descricao: 'A', usuarioId: 'ana' },
    { papelTeste: 'b', descricao: 'B', usuarioId: 'bia' }
  ]
};

describe('NotificacaoFluxoService (fila dgt_implemail)', () => {

  it('grava uma linha por responsável e por canal, sem duplicar', async () => {

    const { dv, linhas } = criarDataverse();
    const servico = new NotificacaoFluxoService(dv, 'documento');

    const avisos = await servico.registrar([pedido(['email', 'teams'])], dados);
    expect(avisos).toEqual([]);

    const fila = linhas.filter(item => item.tabela === TABELA_FILA_EMAIL).map(item => item.corpo);
    expect(fila.length).toBe(4);
    expect(fila.filter(item => item.dgt_status === STATUS_PENDENTE_EMAIL).map(item => item.dgt_para)).toEqual(['ana@exemplo.com', 'bia@exemplo.com']);
    expect(fila.filter(item => item.dgt_status === STATUS_PENDENTE_TEAMS).map(item => item.dgt_para)).toEqual(['ana@exemplo.com', 'bia@exemplo.com']);
    fila.forEach(item => {
      expect(item.dgt_tipo).toBe(TIPO_NOTIFICACAO_FLUXO);
      expect(item.dgt_name).toBe('PRO-POP-004 Rev.01 em Aprovação');
      expect(String(item.dgt_motivo).length).toBeLessThanOrEqual(200);
    });

    // Mesmo pedido de novo: nada novo na fila.
    await servico.registrar([pedido(['email', 'teams'])], dados);
    expect(linhas.filter(item => item.tabela === TABELA_FILA_EMAIL).length).toBe(4);
  });

  it('só e-mail quando o Teams não está marcado', async () => {
    const { dv, linhas } = criarDataverse();
    await new NotificacaoFluxoService(dv, 'documento').registrar([pedido(['email'])], dados);
    const status = linhas.filter(item => item.tabela === TABELA_FILA_EMAIL).map(item => item.corpo.dgt_status);
    expect(status).toEqual([STATUS_PENDENTE_EMAIL, STATUS_PENDENTE_EMAIL]);
  });

  it('converte a mensagem em HTML seguro', () => {
    const html = mensagemEmHtml('Olá <b>\nveja https://portal.exemplo/x');
    expect(html).toContain('Olá &lt;b&gt;<br>veja <a href="https://portal.exemplo/x">https://portal.exemplo/x</a>');
  });
});
