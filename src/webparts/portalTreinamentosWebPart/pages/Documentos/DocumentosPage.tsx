import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface IDocumentosPageProps {
  documentos: IDocumento[];

  carregando?: boolean;

  erro?: string;

  onAbrirDocumento?:
    (documento: IDocumento) => void;
}

// ============================================================
// ESTILOS
// ============================================================

const thStyle:
  React.CSSProperties = {

  padding:
    '13px 14px',

  textAlign:
    'left',

  color:
    '#475569',

  fontSize:
    '12px',

  whiteSpace:
    'nowrap'
};

const tdStyle:
  React.CSSProperties = {

  padding:
    '14px',

  color:
    '#334155',

  fontSize:
    '13px',

  verticalAlign:
    'top'
};

// ============================================================
// COMPONENTE
// ============================================================

const DocumentosPage:
  React.FC<IDocumentosPageProps> = ({

    documentos,
    carregando = false,
    erro = '',
    onAbrirDocumento

  }) => {

    const [
      pesquisa,
      setPesquisa
    ] = React.useState('');

    const filtrados =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          if (!termo) {
            return documentos;
          }

          return documentos.filter(
            item =>
              item.codigo
                .toLowerCase()
                .includes(termo) ||

              item.titulo
                .toLowerCase()
                .includes(termo) ||

              item.tipo
                .toLowerCase()
                .includes(termo) ||

              item.status
                .toLowerCase()
                .includes(termo)
          );
        },
        [
          documentos,
          pesquisa
        ]
      );

    if (carregando) {

      return (
        <section>

          <PageHeader
            titulo="Documentos"
            subtitulo="Carregando documentos..."
          />

          <div
            style={{
              padding: '30px',
              textAlign: 'center'
            }}
          >
            Carregando documentos...
          </div>

        </section>
      );
    }

    return (
      <section>

        <PageHeader
          titulo="Documentos"
          subtitulo="Consulte procedimentos, políticas, instruções e documentos vinculados aos treinamentos."
        />

        {erro && (
          <div
            style={{
              marginBottom: '18px',
              padding: '14px',
              color: '#a4262c',
              background: '#fde7e9',
              borderRadius: '10px'
            }}
          >
            {erro}
          </div>
        )}

        <div
          style={{
            marginBottom: '18px'
          }}
        >
          <input
            type="search"
            placeholder="Pesquisar documento..."
            value={pesquisa}
            onChange={
              event =>
                setPesquisa(
                  event.target.value
                )
            }
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '11px 14px',
              border:
                '1px solid #d8dee8',
              borderRadius: '9px',
              fontSize: '14px'
            }}
          />
        </div>

        {filtrados.length === 0 ? (

          <EmptyState
            titulo="Nenhum documento encontrado"
            descricao="Os documentos ativos cadastrados no Dataverse serão exibidos aqui."
          />

        ) : (

          <div
            style={{
              background: '#ffffff',
              border:
                '1px solid #e5e7eb',
              borderRadius: '14px',
              overflowX: 'auto'
            }}
          >

            <table
              style={{
                width: '100%',
                borderCollapse:
                  'collapse'
              }}
            >

              <thead>
                <tr
                  style={{
                    background:
                      '#f8fafc'
                  }}
                >
                  <th style={thStyle}>
                    Código
                  </th>

                  <th style={thStyle}>
                    Documento
                  </th>

                  <th style={thStyle}>
                    Tipo
                  </th>

                  <th style={thStyle}>
                    Revisão
                  </th>

                  <th style={thStyle}>
                    Responsável
                  </th>

                  <th style={thStyle}>
                    Status
                  </th>

                  <th style={thStyle}>
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>

                {filtrados.map(
                  documento => (

                    <tr
                      key={
                        documento.id
                      }
                      style={{
                        borderTop:
                          '1px solid #edf0f4'
                      }}
                    >

                      <td style={tdStyle}>
                        <strong>
                          {documento.codigo || '-'}
                        </strong>
                      </td>

                      <td style={tdStyle}>

                        <strong
                          style={{
                            display:
                              'block',
                            color:
                              '#1f2937'
                          }}
                        >
                          {documento.titulo}
                        </strong>

                        {documento.descricao && (
                          <span
                            style={{
                              display:
                                'block',
                              color:
                                '#64748b',
                              fontSize:
                                '12px',
                              marginTop:
                                '4px'
                            }}
                          >
                            {documento.descricao}
                          </span>
                        )}

                      </td>

                      <td style={tdStyle}>
                        {documento.tipo}
                      </td>

                      <td style={tdStyle}>
                        {documento.revisaoAtual}
                      </td>

                      <td style={tdStyle}>
                        {documento.responsavel || '-'}
                      </td>

                      <td style={tdStyle}>

                        <span
                          style={{
                            padding:
                              '5px 9px',
                            background:
                              '#e8f2ff',
                            color:
                              '#0f6cbd',
                            borderRadius:
                              '20px',
                            fontWeight:
                              600,
                            fontSize:
                              '12px'
                          }}
                        >
                          {documento.status}
                        </span>

                      </td>

                      <td style={tdStyle}>

                        {onAbrirDocumento && (
                          <button
                            type="button"
                            onClick={() =>
                              onAbrirDocumento(
                                documento
                              )
                            }
                            style={{
                              border:
                                'none',
                              background:
                                '#1677ff',
                              color:
                                '#ffffff',
                              borderRadius:
                                '8px',
                              padding:
                                '8px 12px',
                              cursor:
                                'pointer',
                              fontWeight:
                                600
                            }}
                          >
                            Detalhes
                          </button>
                        )}

                      </td>

                    </tr>
                  )
                )}

              </tbody>
            </table>

          </div>
        )}

      </section>
    );
  };

export default DocumentosPage;