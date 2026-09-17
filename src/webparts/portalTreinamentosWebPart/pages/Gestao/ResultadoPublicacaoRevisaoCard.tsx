import * as React from 'react';

import {
  IResultadoPublicacaoRevisao
} from '../../services/RevisaoDocumentoAdminService';

export interface IResultadoPublicacaoRevisaoCardProps {
  resultado:
    IResultadoPublicacaoRevisao;

  onFechar:
    () => void;
}

const Info:
  React.FC<{
    titulo: string;
    valor: number;
  }> = ({
    titulo,
    valor
  }) => (
    <div
      style={{
        padding: '12px',
        borderRadius: '10px',
        background: '#fff',
        border: '1px solid #e2e8f0'
      }}
    >
      <div
        style={{
          fontSize: '12px',
          color: '#64748b'
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          marginTop: '4px',
          fontSize: '22px',
          fontWeight: 700
        }}
      >
        {valor}
      </div>
    </div>
  );

const ResultadoPublicacaoRevisaoCard:
  React.FC<IResultadoPublicacaoRevisaoCardProps> = ({
    resultado,
    onFechar
  }) => {

    return (
      <div
        style={{
          padding: '18px',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          background: '#f8fafc',
          marginTop: '16px'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'flex-start'
          }}
        >
          <div>
            <strong>
              {
                resultado.sucesso
                  ? 'Publicação concluída'
                  : 'Publicação com pendências'
              }
            </strong>

            <div
              style={{
                marginTop: '6px',
                color: '#475569'
              }}
            >
              {resultado.mensagem}
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            marginTop: '16px'
          }}
        >
          <Info
            titulo="Treinamentos"
            valor={
              resultado
                .treinamentosImpactados
            }
          />

          <Info
            titulo="Usuários"
            valor={
              resultado
                .usuariosImpactados
            }
          />

          <Info
            titulo="Criadas"
            valor={
              resultado
                .atribuicoesCriadas
            }
          />

          <Info
            titulo="Reutilizadas"
            valor={
              resultado
                .atribuicoesReutilizadas
            }
          />

          <Info
            titulo="Bloqueadas"
            valor={
              resultado
                .atribuicoesBloqueadas
            }
          />
        </div>

        {
          resultado.falhas &&
          resultado.falhas.length > 0 &&
          (
            <div
              style={{
                marginTop: '14px'
              }}
            >
              <strong>
                Falhas
              </strong>

              <ul>
                {
                  resultado.falhas.map(
                    (
                      item,
                      index
                    ) => (
                      <li
                        key={
                          `${index}-${item}`
                        }
                      >
                        {item}
                      </li>
                    )
                  )
                }
              </ul>
            </div>
          )
        }
      </div>
    );
  };

export default ResultadoPublicacaoRevisaoCard;
