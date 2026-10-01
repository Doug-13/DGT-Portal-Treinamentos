import {
  IFluxoAtor,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  FLUXO_POP_PROCEDIMENTO_V2
} from './definicoes/fluxoPopProcedimento';

import {
  executarAcao,
  iniciarInstancia,
  statusVisualElemento
} from './FluxoEngine';

// ============================================================
// TESTES DO MOTOR DO FLUXO
// Rodam no "heft test" (que já faz parte do npm run build).
// ============================================================

const definicao =
  FLUXO_POP_PROCEDIMENTO_V2;

const ator = (
  papel: string
): IFluxoAtor => ({
  id: papel,
  nome: papel,
  papeisTeste: [papel]
});

const iniciar = (): IFluxoInstancia => {

  const resultado =
    iniciarInstancia(
      definicao,
      {
        revisaoId: 'rev-teste',
        documentoId: 'doc-teste',
        revisao: 'Rev.04',
        ator: ator('autor'),
        simulado: true
      }
    );

  expect(resultado.ok).toBe(true);

  return resultado.instancia as IFluxoInstancia;
};

const agir = (
  instancia: IFluxoInstancia,
  acaoChave: string,
  papel: string,
  comentario: string = '',
  valores: Record<string, string> = {}
): IFluxoInstancia => {

  const resultado =
    executarAcao(
      definicao,
      instancia,
      {
        acaoChave,
        comentario,
        valores,
        ator: ator(papel)
      }
    );

  expect(resultado.erros).toEqual([]);

  return resultado.instancia as IFluxoInstancia;
};

describe('FluxoEngine', () => {

  it('inicia na etapa Elaboração', () => {

    const instancia = iniciar();

    expect(instancia.elementoAtualId).toBe('elaboracao');
    expect(instancia.status).toBe('emAndamento');
    expect(instancia.tarefas.length).toBe(1);
  });

  it('recusa ação de quem não é responsável', () => {

    const instancia = iniciar();

    const resultado =
      executarAcao(
        definicao,
        instancia,
        {
          acaoChave: 'enviarRevisaoTecnica',
          comentario: '',
          valores: {},
          ator: ator('qualidade')
        }
      );

    expect(resultado.ok).toBe(false);
    expect(instancia.elementoAtualId).toBe('elaboracao');
  });

  it('exige comentário para solicitar ajustes e volta para Elaboração', () => {

    let instancia = iniciar();

    instancia = agir(instancia, 'enviarRevisaoTecnica', 'autor');

    const semComentario =
      executarAcao(
        definicao,
        instancia,
        {
          acaoChave: 'solicitarAjustes',
          comentario: '',
          valores: {},
          ator: ator('coordenacao')
        }
      );

    expect(semComentario.ok).toBe(false);

    instancia = agir(instancia, 'solicitarAjustes', 'coordenacao', 'Corrigir item 4');

    expect(instancia.elementoAtualId).toBe('elaboracao');
    expect(statusVisualElemento(instancia, 'revisaoTecnica')).toBe('pendente');
    expect(instancia.historico[0].comentario).toBe('Corrigir item 4');
  });

  it('exige justificativa quando o retreinamento é dispensado', () => {

    let instancia = iniciar();

    instancia = agir(instancia, 'enviarRevisaoTecnica', 'autor');
    instancia = agir(instancia, 'aprovarTecnicamente', 'coordenacao');

    const semJustificativa =
      executarAcao(
        definicao,
        instancia,
        {
          acaoChave: 'aprovarPublicar',
          comentario: '',
          valores: { retreinamento: 'nao' },
          ator: ator('qualidade')
        }
      );

    expect(semJustificativa.ok).toBe(false);

    instancia = agir(
      instancia,
      'aprovarPublicar',
      'qualidade',
      '',
      { retreinamento: 'nao', justificativaRetreinamento: 'Apenas correção ortográfica' }
    );

    expect(instancia.status).toBe('concluido');
    expect(statusVisualElemento(instancia, 'publicarSemRetreinamento')).toBe('concluido');
    expect(statusVisualElemento(instancia, 'publicarComRetreinamento')).toBe('naoPercorrido');
  });

  it('segue para publicação com retreinamento quando a resposta é Sim', () => {

    let instancia = iniciar();

    instancia = agir(instancia, 'enviarRevisaoTecnica', 'autor');
    instancia = agir(instancia, 'aprovarTecnicamente', 'coordenacao');

    const resultado =
      executarAcao(
        definicao,
        instancia,
        {
          acaoChave: 'aprovarPublicar',
          comentario: '',
          valores: { retreinamento: 'sim' },
          ator: ator('qualidade')
        }
      );

    expect(resultado.ok).toBe(true);
    expect(resultado.acoesSistema).toEqual(['publicarComRetreinamento']);
    expect((resultado.instancia as IFluxoInstancia).status).toBe('concluido');
  });

  it('nunca altera a instância original (histórico preservado)', () => {

    const instancia = iniciar();

    const historicoAntes =
      instancia.historico.length;

    agir(instancia, 'enviarRevisaoTecnica', 'autor');

    expect(instancia.historico.length).toBe(historicoAntes);
    expect(instancia.elementoAtualId).toBe('elaboracao');
  });
});
