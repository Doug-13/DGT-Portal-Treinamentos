import * as React from 'react';

import {
  Icones,
  IconeChave
} from './Icones';

// ============================================================
// SAUDAÇÃO + INDICADORES — padrão das telas "Visão geral"
//
//   Olá, Douglas! 👋                        Data de hoje: ...
//   Aqui está um resumo ...
//   [ 4 Concluídos ] [ 4 Em andamento ] [ 1 Pendentes ] ...
// ============================================================

export interface IIndicadorResumo {
  titulo: string;
  valor: number;
  icone: IconeChave;
  fundo: string;
  corIcone: string;
  detalhe?: string;
  // Opcional: torna o cartão clicável (ex.: filtrar a lista).
  onClick?: () => void;
  ativo?: boolean;
}

export interface IResumoModuloProps {
  primeiroNome?: string;
  mensagem: string;
  indicadores: IIndicadorResumo[];
}

// Paleta padrão dos indicadores — use estas cores em todos os módulos.
export const CORES_INDICADOR = {
  verde: { fundo: '#E8F8F1', corIcone: '#15803D' },
  laranja: { fundo: '#FFF3DE', corIcone: '#C2760C' },
  vermelho: { fundo: '#FFE9EE', corIcone: '#C0392B' },
  azul: { fundo: '#EAF4FF', corIcone: '#1D4ED8' },
  roxo: { fundo: '#F0ECFF', corIcone: '#6D5BD0' }
};

const dataDeHoje = (): string =>
  new Date().toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  );

const ResumoModulo:
  React.FC<IResumoModuloProps> = ({
    primeiroNome,
    mensagem,
    indicadores
  }) => {

    const nome =
      (primeiroNome || '').trim();

    return (
      <>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: '#0A2845',
                fontSize: '29px',
                lineHeight: 1.15
              }}
            >
              Olá{nome ? `, ${nome}` : ''}! 👋
            </h1>

            <p
              style={{
                margin: '4px 0 0',
                color: '#5C7287',
                fontSize: '14px'
              }}
            >
              {mensagem}
            </p>
          </div>

          <div
            style={{
              color: '#64748B',
              fontSize: '13px'
            }}
          >
            Data de hoje: {dataDeHoje()}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, Math.min(indicadores.length, 5))},minmax(150px,1fr))`,
            gap: '14px',
            marginTop: '16px'
          }}
        >
          {
            indicadores.map(
              item => {

                const IconeItem =
                  Icones[item.icone];

                const clicavel =
                  !!item.onClick;

                const conteudo = (
                  <>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,.72)',
                        color: item.corIcone
                      }}
                    >
                      <IconeItem />
                    </div>

                    <div>
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '27px',
                          color: '#0B2D4D',
                          lineHeight: 1
                        }}
                      >
                        {item.valor}
                      </strong>

                      <span
                        style={{
                          display: 'block',
                          marginTop: '5px',
                          color: '#173B5D',
                          fontSize: '13px'
                        }}
                      >
                        {item.titulo}
                      </span>

                      {
                        item.detalhe &&
                        (
                          <small style={{ color: '#5C7287' }}>
                            ({item.detalhe})
                          </small>
                        )
                      }
                    </div>
                  </>
                );

                const estilo: React.CSSProperties = {
                  minHeight: '92px',
                  display: 'grid',
                  gridTemplateColumns: '54px 1fr',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: item.fundo,
                  border: item.ativo
                    ? `2px solid ${item.corIcone}`
                    : '1px solid rgba(15,35,55,.04)',
                  textAlign: 'left',
                  font: 'inherit'
                };

                return clicavel
                  ? (
                    <button
                      key={item.titulo}
                      type="button"
                      onClick={item.onClick}
                      style={{
                        ...estilo,
                        cursor: 'pointer'
                      }}
                    >
                      {conteudo}
                    </button>
                  )
                  : (
                    <div
                      key={item.titulo}
                      style={estilo}
                    >
                      {conteudo}
                    </div>
                  );
              }
            )
          }
        </div>
      </>
    );
  };

export default ResumoModulo;
