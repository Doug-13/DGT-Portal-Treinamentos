import * as React from 'react';
import {
  IAvaliacao,
  IEnvioAvaliacao,
  IEstadoTentativasAvaliacao,
  IResultadoAvaliacao
} from '../../models/Avaliacao';
import Loading from '../../components/common/Loading';
import ErrorMessage from '../../components/common/ErrorMessage';

export interface IAvaliacaoPageProps {
  avaliacao?: IAvaliacao;
  carregando: boolean;
  erro: string;
  tentativas: IEstadoTentativasAvaliacao;
  envioPreparado?: IEnvioAvaliacao;
  resultado?: IResultadoAvaliacao;
  processando: boolean;
  onVoltar: () => void;
  onEnviar: (respostas: Record<string, string[]>) => void;
}

const doisDigitos = (valor: number): string =>
  valor < 10 ? `0${valor}` : String(valor);

const formatarTempo = (segundos: number): string => {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${doisDigitos(minutos)}:${doisDigitos(resto)}`;
};

const AvaliacaoPage: React.FC<IAvaliacaoPageProps> = ({
  avaliacao,
  carregando,
  erro,
  tentativas,
  envioPreparado,
  resultado,
  processando,
  onVoltar,
  onEnviar
}) => {
  const [respostas, setRespostas] =
    React.useState<Record<string, string[]>>({});
  const [segundosRestantes, setSegundosRestantes] = React.useState(0);
  const [finalizada, setFinalizada] = React.useState(false);

  React.useEffect(() => {
    setRespostas({});
    setFinalizada(false);

    if (avaliacao && avaliacao.tempoLimiteMin > 0) {
      setSegundosRestantes(avaliacao.tempoLimiteMin * 60);
    } else {
      setSegundosRestantes(0);
    }
  }, [avaliacao]);

  React.useEffect(() => {
    if (
      !avaliacao ||
      avaliacao.tempoLimiteMin <= 0 ||
      finalizada ||
      envioPreparado
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSegundosRestantes(atual => {
        if (atual <= 1) {
          window.clearInterval(timer);
          setFinalizada(true);
          return 0;
        }

        return atual - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [avaliacao, finalizada, envioPreparado]);

  React.useEffect(() => {
    if (
      avaliacao &&
      avaliacao.tempoLimiteMin > 0 &&
      segundosRestantes === 0 &&
      finalizada &&
      !envioPreparado
    ) {
      onEnviar(respostas);
    }
  }, [
    avaliacao,
    segundosRestantes,
    finalizada,
    envioPreparado,
    onEnviar,
    respostas
  ]);

  if (carregando) {
    return <Loading mensagem="Preparando avaliação..." />;
  }

  if (erro) {
    return (
      <section>
        <button type="button" onClick={onVoltar}>← Voltar</button>
        <div style={{ marginTop: 20 }}>
          <ErrorMessage mensagem={erro} />
        </div>
      </section>
    );
  }

  if (!avaliacao) {
    return (
      <section>
        <button type="button" onClick={onVoltar}>← Voltar</button>
        <p>A avaliação não foi carregada.</p>
      </section>
    );
  }

  if (processando) {
    return <Loading mensagem="Corrigindo avaliação e registrando resultado..." />;
  }

  if (resultado) {
    return (
      <section style={{ maxWidth: 900, margin: '0 auto' }}>
        <button type="button" onClick={onVoltar}>← Voltar ao treinamento</button>

        <div
          style={{
            marginTop: 24,
            padding: 28,
            border: '1px solid #dbeafe',
            borderRadius: 16,
            background: '#f8fbff'
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            {resultado.aprovado ? '✓ Avaliação concluída' : 'Avaliação finalizada'}
          </h1>

          <h2>
            {resultado.aprovado ? 'Aprovado' : 'Reprovado'} — {resultado.nota.toFixed(2)}%
          </h2>

          <p>{resultado.mensagem}</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
              gap: 12,
              marginTop: 20
            }}
          >
            <div><small>Tentativa</small><strong style={{ display: 'block' }}>#{resultado.numeroTentativa}</strong></div>
            <div><small>Acertos</small><strong style={{ display: 'block' }}>{resultado.acertos}/{resultado.total}</strong></div>
            <div><small>Erros</small><strong style={{ display: 'block' }}>{resultado.erros}</strong></div>
            <div><small>Tentativas restantes</small><strong style={{ display: 'block' }}>{resultado.tentativasRestantes}</strong></div>
          </div>

          {resultado.treinamentoConcluido && (
            <p style={{ marginTop: 22 }}>
              <strong>Treinamento concluído e registrado no Dataverse.</strong>
            </p>
          )}

          {resultado.proximoTreinamentoLiberado && (
            <p>
              Próximo treinamento liberado:
              {' '}
              <strong>{resultado.proximoTreinamentoNome}</strong>
            </p>
          )}
        </div>
      </section>
    );
  }

  if (envioPreparado && erro) {
    return (
      <section>
        <button type="button" onClick={onVoltar}>← Voltar</button>
        <div style={{ marginTop: 20 }}>
          <ErrorMessage mensagem={erro} />
        </div>
      </section>
    );
  }

  const selecionar = (
    questaoId: string,
    alternativaId: string,
    multipla: boolean
  ): void => {
    setRespostas(atual => {
      const selecionadas = atual[questaoId] || [];

      if (!multipla) {
        return {
          ...atual,
          [questaoId]: [alternativaId]
        };
      }

      const existe = selecionadas.indexOf(alternativaId) >= 0;

      return {
        ...atual,
        [questaoId]: existe
          ? selecionadas.filter(id => id !== alternativaId)
          : selecionadas.concat(alternativaId)
      };
    });
  };

  const respondidas = avaliacao.questoes.filter(
    questao => (respostas[questao.id] || []).length > 0
  ).length;

  const enviar = (): void => {
    if (respondidas < avaliacao.questoes.length) {
      const confirmar = window.confirm(
        `Você respondeu ${respondidas} de ${avaliacao.questoes.length} questões. Deseja finalizar mesmo assim?`
      );

      if (!confirmar) {
        return;
      }
    }

    setFinalizada(true);
    onEnviar(respostas);
  };

  return (
    <section style={{ maxWidth: 980, margin: '0 auto' }}>
      <button type="button" onClick={onVoltar}>← Voltar</button>

      <div style={{ marginTop: 18 }}>
        <h1>{avaliacao.nome}</h1>
        <p>{avaliacao.descricao}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          gap: 12,
          margin: '20px 0 28px'
        }}
      >
        <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <small>Questões</small>
          <strong style={{ display: 'block' }}>{avaliacao.questoes.length}</strong>
        </div>

        <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <small>Nota mínima</small>
          <strong style={{ display: 'block' }}>{avaliacao.notaMinima}%</strong>
        </div>

        <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <small>Tentativa</small>
          <strong style={{ display: 'block' }}>
            {tentativas.proximaTentativa}/{tentativas.permitidas}
          </strong>
        </div>

        <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <small>Tempo restante</small>
          <strong style={{ display: 'block' }}>
            {avaliacao.tempoLimiteMin > 0
              ? formatarTempo(segundosRestantes)
              : 'Sem limite'}
          </strong>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {avaliacao.questoes.map((questao, indice) => {
          const selecionadas = respostas[questao.id] || [];

          return (
            <article
              key={questao.id}
              style={{
                padding: 22,
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                background: '#fff'
              }}
            >
              <small>Questão {indice + 1}</small>
              <h3>{questao.enunciado}</h3>

              {questao.multiplasRespostas && (
                <p><small>Selecione todas as alternativas aplicáveis.</small></p>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {questao.alternativas.map(alternativa => {
                  const marcada =
                    selecionadas.indexOf(alternativa.id) >= 0;

                  return (
                    <label
                      key={alternativa.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 12,
                        border: marcada
                          ? '2px solid #2563eb'
                          : '1px solid #d1d5db',
                        borderRadius: 10,
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type={questao.multiplasRespostas ? 'checkbox' : 'radio'}
                        name={`questao-${questao.id}`}
                        checked={marcada}
                        onChange={() =>
                          selecionar(
                            questao.id,
                            alternativa.id,
                            questao.multiplasRespostas
                          )
                        }
                      />
                      <span>{alternativa.texto}</span>
                    </label>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16
        }}
      >
        <span>
          {respondidas}/{avaliacao.questoes.length} respondidas
        </span>

        <button type="button" onClick={enviar}>
          Finalizar avaliação
        </button>
      </div>
    </section>
  );
};

export default AvaliacaoPage;
