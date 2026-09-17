import * as React from 'react';
import { ICertificado } from '../../models/Treinamento';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';

export interface ICertificadosPageProps { certificados: ICertificado[]; }

const CertificadosPage: React.FC<ICertificadosPageProps> = ({ certificados }) => (
  <section>
    <PageHeader titulo="Certificados" subtitulo="Consulte seus certificados de treinamentos concluídos." />
    {certificados.length === 0 ? <EmptyState titulo="Nenhum certificado disponível" /> : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {certificados.map(item => (
          <article key={item.id} style={{ padding: 18, border: '1px solid #e5e7eb', borderRadius: 12 }}>
            <small>{item.codigo}</small><h3>{item.treinamento}</h3>
            <p>Conclusão: {item.conclusao}</p><p>Validade: {item.validade}</p>
            <p>Carga horária: {item.cargaHoraria}</p>
          </article>
        ))}
      </div>
    )}
  </section>
);
export default CertificadosPage;
