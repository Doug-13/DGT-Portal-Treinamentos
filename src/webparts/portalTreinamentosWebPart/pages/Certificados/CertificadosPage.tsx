import * as React from 'react';

import {
  ICertificado
} from '../../models/Treinamento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface ICertificadosPageProps {
  certificados:
    ICertificado[];
}

const CertificadosPage:
  React.FC<ICertificadosPageProps> = ({
    certificados
  }) => {

    return (
      <section>
        <PageHeader
          titulo="Certificados"
          subtitulo="Consulte os certificados dos treinamentos concluídos."
        />

        {certificados.length === 0 ? (
          <EmptyState
            titulo="Nenhum certificado disponível"
          />
        ) : (
          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(280px,1fr))',
              gap:
                '16px'
            }}
          >
            {certificados.map(
              item => (
                <article
                  key={
                    item.id
                  }
                  style={{
                    padding:
                      '20px',
                    border:
                      '1px solid #e5e7eb',
                    borderRadius:
                      '14px',
                    background:
                      '#fff'
                  }}
                >
                  <small
                    style={{
                      color:
                        '#64748b'
                    }}
                  >
                    {
                      item.codigo
                    }
                  </small>

                  <h3
                    style={{
                      margin:
                        '6px 0 14px',
                      color:
                        '#0b1f3a'
                    }}
                  >
                    {
                      item.treinamento
                    }
                  </h3>

                  <p>
                    <strong>
                      Conclusão:
                    </strong>{' '}
                    {
                      item.conclusao
                    }
                  </p>

                  <p>
                    <strong>
                      Validade:
                    </strong>{' '}
                    {
                      item.validade
                    }
                  </p>

                  <p>
                    <strong>
                      Carga horária:
                    </strong>{' '}
                    {
                      item.cargaHoraria
                    }
                  </p>

                  <div
                    style={{
                      marginTop:
                        '16px',
                      padding:
                        '10px 12px',
                      borderRadius:
                        '8px',
                      background:
                        '#f8fafc',
                      color:
                        '#64748b',
                      fontSize:
                        '12px'
                    }}
                  >
                    O arquivo PDF será vinculado a este registro pelo fluxo de geração de certificados.
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
    );
  };

export default CertificadosPage;
