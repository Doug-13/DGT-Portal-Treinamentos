import * as React from 'react';

import {
  ITreinamento
} from '../../models/Treinamento';

import styles from './TreinamentoCard.module.scss';

// ============================================================
// TIPOS
// ============================================================

export type ModoTreinamentoCard =
  | 'compacto'
  | 'completo';

// ============================================================
// PROPS
// ============================================================

export interface ITreinamentoCardProps {
  treinamento: ITreinamento;

  modo?: ModoTreinamentoCard;

  onAbrir?: (
    treinamento: ITreinamento
  ) => void;
}

// ============================================================
// COMPONENTE
// ============================================================

const TreinamentoCard:
  React.FC<ITreinamentoCardProps> = ({
    treinamento,
    modo = 'completo',
    onAbrir
  }) => {

  // ==========================================================
  // STATUS
  // ==========================================================

  const concluido =
    treinamento.status === 'Concluído';

  const bloqueado =
    treinamento.status === 'Bloqueado';

  const emAndamento =
    treinamento.status === 'Em andamento';

  const disponivel =
    treinamento.status === 'Disponível';

  const reprovado =
    treinamento.status === 'Reprovado';

  const vencido =
    treinamento.status === 'Vencido';

  // ==========================================================
  // PROGRESSO
  // ==========================================================

  const progressoOriginal =
    Number.isFinite(
      treinamento.progresso
    )
      ? treinamento.progresso
      : 0;

  const progresso =
    concluido
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(
              progressoOriginal
            )
          )
        );

  // ==========================================================
  // TEXTO DO BOTÃO
  // ==========================================================

  const obterTextoBotao = (): string => {

    if (
      concluido
    ) {
      return '✓ Treinamento concluído';
    }

    if (
      bloqueado
    ) {
      return 'Treinamento bloqueado';
    }

    if (
      emAndamento
    ) {
      return 'Continuar treinamento';
    }

    if (
      disponivel
    ) {
      return 'Iniciar treinamento';
    }

    if (
      reprovado
    ) {
      return 'Tentar novamente';
    }

    if (
      vencido
    ) {
      return 'Realizar reciclagem';
    }

    return 'Abrir treinamento';
  };

  // ==========================================================
  // CLASSE DO STATUS
  // ==========================================================

  const obterClasseStatus = (): string => {

    switch (
      treinamento.status
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
        return styles.statusPadrao;
    }
  };

  // ==========================================================
  // ABRIR
  // ==========================================================

  const handleAbrir = (): void => {

    if (
      bloqueado
    ) {
      return;
    }

    if (
      onAbrir
    ) {
      onAbrir(
        treinamento
      );
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <article
      className={
        `${styles.card} ${
          modo === 'compacto'
            ? styles.cardCompacto
            : styles.cardCompleto
        } ${
          concluido
            ? styles.cardConcluido
            : ''
        } ${
          bloqueado
            ? styles.cardBloqueado
            : ''
        }`
      }
    >

      {/* ======================================================
          IMAGEM
      ====================================================== */}

      <div
        className={
          `${styles.imagemWrapper} ${
            modo === 'compacto'
              ? styles.imagemCompacta
              : styles.imagemCompleta
          }`
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
                  styles.imagem
                }
              />

            )
            : (

              <div
                className={
                  styles.imagemFallback
                }
              >
                🎓
              </div>

            )
        }

        {/* ====================================================
            BADGE CONCLUÍDO
        ==================================================== */}

        {
          concluido && (

            <div
              className={
                styles.badgeConcluido
              }
            >

              <span
                className={
                  styles.badgeIcone
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

      {/* ======================================================
          CONTEÚDO
      ====================================================== */}

      <div
        className={
          styles.conteudo
        }
      >

        {/* STATUS + CARGA HORÁRIA (mesma linha) */}

        <div
          className={
            styles.statusLinha
          }
        >
          <div
            className={
              styles.statusArea
            }
          >
            <span
              className={
                `${styles.status} ${
                  obterClasseStatus()
                }`
              }
            >
              {
                treinamento.status
              }
            </span>
          </div>

          <span
            className={
              styles.cargaHoraria
            }
            title="Carga horária"
          >
            ◷ {
              treinamento.cargaHoraria ||
              '—'
            }
          </span>
        </div>

        {/* TÍTULO */}

        <h3
          className={
            styles.titulo
          }
          title={
            treinamento.nome
          }
        >
          {
            treinamento.nome
          }
        </h3>

        {/* ====================================================
            CONTEÚDO COMPLETO
        ==================================================== */}

        {
          modo === 'completo' && (

            <p
              className={
                styles.descricao
              }
              title={
                treinamento.descricao
              }
            >
              {
                treinamento.descricao ||
                'Treinamento disponível para sua trilha de aprendizagem.'
              }
            </p>

          )
        }

        {/* ====================================================
            RODAPÉ
        ==================================================== */}

        <div
          className={
            styles.rodape
          }
        >

          {/* ================================================
              PROGRESSO
              SOMENTE NO MODO COMPLETO
          ================================================ */}

          {
            modo === 'completo' && (

              <div
                className={
                  styles.progressoBloco
                }
              >

                <div
                  className={
                    styles.progressoCabecalho
                  }
                >

                  <span>
                    Progresso
                  </span>

                  <strong
                    className={
                      concluido
                        ? styles.progressoValorConcluido
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
                    styles.progressoBarra
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
                        ? styles.progressoPreenchimentoConcluido
                        : styles.progressoPreenchimento
                    }
                    style={{
                      width:
                        `${progresso}%`
                    }}
                  />

                </div>

              </div>

            )
          }

          {/* ================================================
              BOTÃO
          ================================================ */}

          <button
            type="button"
            disabled={
              bloqueado
            }
            onClick={
              handleAbrir
            }
            className={
              `${styles.botao} ${
                concluido
                  ? styles.botaoConcluido
                  : bloqueado
                  ? styles.botaoBloqueado
                  : styles.botaoNormal
              }`
            }
          >
            {
              obterTextoBotao()
            }
          </button>

        </div>

      </div>

    </article>

  );
};

export default TreinamentoCard;