import * as React from 'react';

export type TipoEstadoPagina =
  | 'carregando'
  | 'erro'
  | 'vazio'
  | 'sucesso';

export interface IEstadoPaginaProps {
  tipo:
    TipoEstadoPagina;

  titulo?:
    string;

  mensagem?:
    string;

  acaoTexto?:
    string;

  onAcao?:
    () => void;
}

const EstadoPagina:
  React.FC<IEstadoPaginaProps> = (
    props
  ) => {

    const tituloPadrao =
      props.tipo ===
        'carregando'
        ? 'Carregando...'
        : props.tipo ===
            'erro'
          ? 'Não foi possível carregar os dados'
          : props.tipo ===
              'vazio'
            ? 'Nenhum registro encontrado'
            : 'Concluído';

    return (
      <div
        style={{
          minHeight:
            '180px',
          display:
            'flex',
          alignItems:
            'center',
          justifyContent:
            'center',
          padding:
            '24px'
        }}
      >
        <div
          style={{
            width:
              '100%',
            maxWidth:
              '560px',
            padding:
              '28px',
            background:
              '#ffffff',
            border:
              '1px solid #e5e7eb',
            borderRadius:
              '16px',
            textAlign:
              'center'
          }}
        >
          <div
            style={{
              width:
                '44px',
              height:
                '44px',
              margin:
                '0 auto 14px',
              borderRadius:
                '12px',
              display:
                'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              background:
                '#f1f5f9',
              fontSize:
                '22px'
            }}
          >
            {
              props.tipo ===
                'carregando'
                ? '◌'
                : props.tipo ===
                    'erro'
                  ? '!'
                  : props.tipo ===
                      'vazio'
                    ? '∅'
                    : '✓'
            }
          </div>

          <h3
            style={{
              margin:
                '0 0 8px',
              color:
                '#0b1f3a'
            }}
          >
            {
              props.titulo ||
              tituloPadrao
            }
          </h3>

          {
            props.mensagem && (
              <p
                style={{
                  margin:
                    '0',
                  color:
                    '#64748b',
                  lineHeight:
                    1.5
                }}
              >
                {
                  props.mensagem
                }
              </p>
            )
          }

          {
            props.acaoTexto &&
            props.onAcao && (
              <button
                type="button"
                onClick={
                  props.onAcao
                }
                style={{
                  marginTop:
                    '18px',
                  padding:
                    '10px 16px',
                  border:
                    '0',
                  borderRadius:
                    '8px',
                  background:
                    '#0b1f3a',
                  color:
                    '#ffffff',
                  cursor:
                    'pointer'
                }}
              >
                {
                  props.acaoTexto
                }
              </button>
            )
          }
        </div>
      </div>
    );
  };

export default EstadoPagina;
