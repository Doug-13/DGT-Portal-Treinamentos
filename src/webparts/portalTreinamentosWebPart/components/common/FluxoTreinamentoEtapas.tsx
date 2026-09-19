import * as React from 'react';

export interface IFluxoTreinamentoEtapasProps {
  etapa:
    1 | 2 | 3;

  onEtapaClick?:
    (
      etapa:
        1 | 2 | 3
    ) => void;

  permitirNavegacao?:
    boolean;
}

const FluxoTreinamentoEtapas:
  React.FC<
    IFluxoTreinamentoEtapasProps
  > = ({
    etapa,
    onEtapaClick,
    permitirNavegacao = false
  }) => {

    const etapas:
      Array<{
        numero:
          1 | 2 | 3;

        titulo:
          string;
      }> = [
        {
          numero:
            1,

          titulo:
            'Treinamento'
        },
        {
          numero:
            2,

          titulo:
            'Módulos'
        },
        {
          numero:
            3,

          titulo:
            'Avaliação'
        }
      ];

    return (
      <div
        style={{
          display:
            'grid',

          gridTemplateColumns:
            'repeat(3, minmax(0, 1fr))',

          gap:
            '10px',

          marginBottom:
            '22px'
        }}
      >
        {
          etapas.map(
            item => {

              const concluida =
                item.numero <
                etapa;

              const ativa =
                item.numero ===
                etapa;

              const clicavel =
                permitirNavegacao &&
                !!onEtapaClick;

              return (
                <button
                  key={
                    item.numero
                  }
                  type="button"
                  disabled={
                    !clicavel
                  }
                  onClick={() => {

                    if (
                      clicavel &&
                      onEtapaClick
                    ) {
                      onEtapaClick(
                        item.numero
                      );
                    }
                  }}
                  style={{
                    width:
                      '100%',

                    padding:
                      '12px 14px',

                    border:
                      ativa
                        ? '2px solid #1677ff'
                        : '1px solid #dbe2ea',

                    borderRadius:
                      '10px',

                    background:
                      concluida
                        ? '#eefaf4'
                        : ativa
                          ? '#eef6ff'
                          : '#ffffff',

                    textAlign:
                      'left',

                    cursor:
                      clicavel
                        ? 'pointer'
                        : 'default',

                    opacity:
                      1
                  }}
                  title={
                    clicavel
                      ? `Ir para ${item.titulo}`
                      : undefined
                  }
                >
                  <div
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      gap:
                        '9px'
                    }}
                  >
                    <span
                      style={{
                        display:
                          'inline-flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'center',

                        width:
                          '26px',

                        height:
                          '26px',

                        borderRadius:
                          '50%',

                        background:
                          concluida
                            ? '#13795b'
                            : ativa
                              ? '#1677ff'
                              : '#cbd5e1',

                        color:
                          '#ffffff',

                        fontWeight:
                          700,

                        fontSize:
                          '12px'
                      }}
                    >
                      {
                        concluida
                          ? '✓'
                          : item.numero
                      }
                    </span>

                    <strong
                      style={{
                        color:
                          '#0b1f3a',

                        fontSize:
                          '13px'
                      }}
                    >
                      {
                        item.titulo
                      }
                    </strong>
                  </div>
                </button>
              );
            }
          )
        }
      </div>
    );
  };

export default FluxoTreinamentoEtapas;
