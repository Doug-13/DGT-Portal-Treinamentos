import * as React from 'react';
import { IDocumento } from '../../models/Documento';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';

export interface IDocumentosPageProps {
  documentos: IDocumento[];
}

const DocumentosPage: React.FC<IDocumentosPageProps> = ({ documentos }) => (
  <section>
    <PageHeader
      titulo="Documentos"
      subtitulo="Consulte procedimentos, políticas, instruções e documentos relacionados às suas atividades."
    />

    {documentos.length === 0 ? (
      <EmptyState titulo="Nenhum documento disponível" />
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Documento</th>
              <th>Categoria</th>
              <th>Revisão</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map(documento => (
              <tr key={String(documento.id)}>
                <td>{documento.codigo}</td>
                <td>{documento.documento}</td>
                <td>{documento.categoria}</td>
                <td>{documento.revisao}</td>
                <td>{documento.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default DocumentosPage;
