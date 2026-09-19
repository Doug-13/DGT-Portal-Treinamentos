import * as React from 'react';

import {
  ITreinamento
} from '../../models/Treinamento';

import TreinamentoCard from
  '../../components/treinamentos/TreinamentoCard';

import Loading from
  '../../components/common/Loading';

import EmptyState from
  '../../components/common/EmptyState';

import ErrorMessage from
  '../../components/common/ErrorMessage';

// ============================================================
// PROPS
// ============================================================

export interface IMeusTreinamentosPageProps {
  treinamentos: ITreinamento[];

  carregando: boolean;

  erro: string;

  onAbrirTreinamento: (
    treinamento: ITreinamento
  ) => void;
}

// ============================================================
// COMPONENTE
// ============================================================

const MeusTreinamentosPage:
  React.FC<IMeusTreinamentosPageProps> = ({
    treinamentos,
    carregando,
    erro,
    onAbrirTreinamento
  }) => {

  // ==========================================================
  // CARREGANDO
  // ==========================================================

  if (
    carregando
  ) {

    return (
      <section>

        <div
          style={{
            marginBottom: 18
          }}
        >
          <h1
            style={{
              margin: '0 0 4px'
            }}
          >
            Meus treinamentos
          </h1>

          <p
            style={{
              margin: 0,
              color: '#61768b'
            }}
          >
            Acompanhe seus treinamentos disponíveis,
            em andamento, concluídos e bloqueados.
          </p>
        </div>

        <Loading
          mensagem="Carregando treinamentos..."
        />

      </section>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section>

      {/* ======================================================
          CABEÇALHO
      ====================================================== */}

      <div
        style={{
          marginBottom: 18
        }}
      >

        <h1
          style={{
            margin: '0 0 4px'
          }}
        >
          Meus treinamentos
        </h1>

        <p
          style={{
            margin: 0,
            color: '#61768b'
          }}
        >
          Acompanhe seus treinamentos disponíveis,
          em andamento, concluídos e bloqueados.
        </p>

      </div>

      {/* ======================================================
          ERRO
      ====================================================== */}

      {
        erro && (
          <ErrorMessage
            mensagem={erro}
          />
        )
      }

      {/* ======================================================
          LISTA
      ====================================================== */}

      {
        treinamentos.length === 0
          ? (
            <EmptyState
              titulo="Nenhum treinamento atribuído"
            />
          )
          : (
            <div
              style={{
                display: 'grid',

                gridTemplateColumns:
                  'repeat(auto-fill,minmax(270px,1fr))',

                gap: 14,

                alignItems: 'stretch'
              }}
            >

              {
                treinamentos.map(
                  treinamento => (
                    <TreinamentoCard
                      key={
                        `${
                          treinamento.id
                        }-${
                          treinamento.usuarioTreinamentoId ||
                          ''
                        }`
                      }
                      treinamento={
                        treinamento
                      }
                      modo="completo"
                      onAbrir={
                        onAbrirTreinamento
                      }
                    />
                  )
                )
              }

            </div>
          )
      }

    </section>
  );
};

export default MeusTreinamentosPage;