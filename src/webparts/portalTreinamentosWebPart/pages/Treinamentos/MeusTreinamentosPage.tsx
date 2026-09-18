import * as React from 'react';

import { ITreinamento } from '../models/Treinamento';

import styles from './MeusTreinamentosCards.module.scss';

// ============================================================
// PROPS
// ============================================================

export interface IMeusTreinamentosCardsProps {
  treinamentos: ITreinamento[];

  onAbrirTreinamento?: (
    treinamento: ITreinamento
  ) => void;
}

// ============================================================
// COMPONENTE
// ============================================================

const MeusTreinamentosCards:
  React.FC<IMeusTreinamentosCardsProps> = ({
    treinamentos,
    onAbrirTreinamento
  }) => {

  // ==========================================================
  // PROGRESSO
  // ==========================================================

  const normalizarProgresso = (
    valor?: number
  ): number => {

    if (
      valor === undefined ||
      valor === null ||
      Number.isNaN(valor)
    ) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        Math.round(valor)
      )
    );
  };

  // ==========================================================
  // STATUS
  // ==========================================================

  const estaConcluido = (
    treinamento: ITreinamento
  ): boolean => {

    return (
      treinamento.status === 'Concluído'
    );
  };

  const estaBloqueado = (
    treinamento: ITreinamento
  ): boolean => {

    return (
      treinamento.status === 'Bloqueado'
    );
  };

  // ==========================================================
  // CLASSE DO STATUS
  // ==========================================================

  const obterClasseStatus = (
    status?: string
  ): string => {

    switch (
      status
    ) {

      case 'Concluído':
        return styles.statusConcluido;

      case 'Disponível':
        return styles.statusDisponivel;

      case 'Em andamento':
        return styles.statusEmAndamento;

      case 'Bloqueado':
        return styles.statusBloqueado;

      case 'Reprovado':
        return styles.statusReprovado;

      case 'Vencido':
        return styles.statusVencido;

      default:
        return '';
    }
  };

  // ==========================================================
  // PODE ABRIR
  // ==========================================================

  const podeAbrirTreinamento = (
    treinamento: ITreinamento
  ): boolean => {

    if (
      estaBloqueado(
        treinamento
      )
    ) {
      return false;
    }

    return true;
  };

  // ==========================================================
  // TEXTO DO BOTÃO
  // ==========================================================

  const obterTextoBotao = (
    treinamento: ITreinamento
  ): string => {

    switch (
      treinamento.status
    ) {

      case 'Concluído':
        return '✓ Treinamento concluído';

      case 'Em andamento':
        return 'Continuar treinamento';

      case 'Disponível':
        return 'Iniciar treinamento';

      case 'Bloqueado':
        return 'Treinamento bloqueado';

      case 'Reprovado':
        return 'Tentar novamente';

      case 'Vencido':
        return 'Realizar reciclagem';

      default:
        return 'Abrir treinamento';
    }
  };

  // ==========================================================
  // ABRIR TREINAMENTO
  // ==========================================================

  const abrirTreinamento = (
    treinamento: ITreinamento
  ): void => {

    if (
      !podeAbrirTreinamento(
        treinamento
      )
    ) {
      return;
    }

    if (
      onAbrirTreinamento
    ) {
      onAbrirTreinamento(
        treinamento
      );
    }
  };

  // ==========================================================
  // SEM TREINAMENTOS
  // ==========================================================

  if (
    !treinamentos ||
    treinamentos.length === 0
  ) {

    return (
      <div
        className={
          styles.emptyState
        }
      >

        <div
          className={
            styles.emptyStateIcon
          }
        >
          🎓
        </div>

        <div
          className={
            styles.emptyStateTitle
          }
        >
          Nenhum treinamento atribuído
        </div>

        <div
          className={
            styles.emptyStateDescription
          }
        >
          Quando um treinamento for atribuído a você,
          ele aparecerá nesta página.
        </div>

      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className={
        styles.trainingGrid
      }
    >

      {
        treinamentos.map(
          (
            treinamento
          ) => {

            const concluido =
              estaConcluido(
                treinamento
              );

            const bloqueado =
              estaBloqueado(
                treinamento
              );

            const progresso =
              concluido
                ? 100
                : normalizarProgresso(
                    treinamento.progresso
                  );

            return (
              <article
                key={
                  `${
                    treinamento.id
                  }-${
                    treinamento.usuarioTreinamentoId || ''
                  }`
                }
                className={
                  `${styles.trainingCard} ${
                    concluido
                      ? styles.trainingCardConcluido
                      : ''
                  } ${
                    bloqueado
                      ? styles.trainingCardBloqueado
                      : ''
                  }`
                }
              >

                {/* ============================================
                    IMAGEM
                ============================================ */}

                <div
                  className={
                    styles.trainingCardImageWrapper
                  }
                >

                  {
                    treinamento.imagem
                      ? (
                        <img
                          src={
                            treinamento.imagem
                          }
                          alt={
                            treinamento.nome
                          }
                          className={
                            styles.trainingCardImage
                          }
                        />
                      )
                      : (
                        <div
                          className={
                            styles.trainingCardImageFallback
                          }
                        >
                          🎓
                        </div>
                      )
                  }

                  {/* ==========================================
                      BADGE CONCLUÍDO
                  ========================================== */}

                  {
                    concluido && (
                      <div
                        className={
                          styles.badgeConcluido
                        }
                      >

                        <span
                          className={
                            styles.badgeConcluidoIcone
                          }
                        >
                          ✓
                        </span>

                        <span>
                          Concluído
                        </span>

                      </div>
                    )
                  }

                </div>

                {/* ============================================
                    CONTEÚDO
                ============================================ */}

                <div
                  className={
                    styles.trainingCardContent
                  }
                >

                  {/* STATUS */}

                  <div
                    className={
                      styles.statusArea
                    }
                  >

                    <span
                      className={
                        `${styles.trainingStatus} ${
                          obterClasseStatus(
                            treinamento.status
                          )
                        }`
                      }
                    >
                      {
                        treinamento.status
                      }
                    </span>

                  </div>

                  {/* TÍTULO */}

                  <h3
                    className={
                      styles.trainingTitle
                    }
                    title={
                      treinamento.nome
                    }
                  >
                    {
                      treinamento.nome
                    }
                  </h3>

                  {/* DESCRIÇÃO */}

                  <p
                    className={
                      styles.trainingDescription
                    }
                    title={
                      treinamento.descricao ||
                      ''
                    }
                  >
                    {
                      treinamento.descricao ||
                      'Treinamento disponível para sua trilha de aprendizagem.'
                    }
                  </p>

                  {/* CARGA HORÁRIA */}

                  <div
                    className={
                      styles.trainingDuration
                    }
                  >
                    {
                      treinamento.cargaHoraria ||
                      'Carga horária não informada'
                    }
                  </div>

                  {/* ==========================================
                      RODAPÉ
                  ========================================== */}

                  <div
                    className={
                      styles.trainingFooter
                    }
                  >

                    {/* PROGRESSO */}

                    <div
                      className={
                        styles.trainingProgressBlock
                      }
                    >

                      <div
                        className={
                          styles.trainingProgressHeader
                        }
                      >

                        <span>
                          Progresso
                        </span>

                        <strong
                          className={
                            concluido
                              ? styles.progressValueConcluido
                              : ''
                          }
                        >
                          {
                            progresso
                          }%
                        </strong>

                      </div>

                      <div
                        className={
                          styles.trainingProgressBar
                        }
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          progresso
                        }
                        aria-label={
                          `Progresso de ${treinamento.nome}`
                        }
                      >

                        <div
                          className={
                            concluido
                              ? styles.trainingProgressFillConcluido
                              : styles.trainingProgressFill
                          }
                          style={{
                            width:
                              `${progresso}%`
                          }}
                        />

                      </div>

                    </div>

                    {/* BOTÃO */}

                    <button
                      type="button"
                      disabled={
                        bloqueado
                      }
                      className={
                        concluido
                          ? styles.trainingButtonConcluido
                          : bloqueado
                          ? styles.trainingButtonDisabled
                          : styles.trainingButton
                      }
                      onClick={
                        () =>
                          abrirTreinamento(
                            treinamento
                          )
                      }
                    >
                      {
                        obterTextoBotao(
                          treinamento
                        )
                      }
                    </button>

                  </div>

                </div>

              </article>
            );
          }
        )
      }

    </div>
  );
};

export default MeusTreinamentosCards;