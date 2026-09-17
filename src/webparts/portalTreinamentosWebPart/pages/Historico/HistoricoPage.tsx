import * as React from 'react';
import { IHistorico } from '../../models/Treinamento';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';

export interface IHistoricoPageProps { historico: IHistorico[]; }

const HistoricoPage: React.FC<IHistoricoPageProps> = ({ historico }) => (
  <section>
    <PageHeader titulo="Meu histórico" subtitulo="Acompanhe conclusões, notas, status e validades." />
    {historico.length === 0 ? <EmptyState titulo="Nenhum histórico encontrado" /> : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>Treinamento</th><th>Trilha</th><th>Status</th><th>Conclusão</th><th>Nota</th><th>Validade</th></tr></thead>
          <tbody>{historico.map(item => (
            <tr key={item.id}><td>{item.treinamento}</td><td>{item.trilha}</td><td>{item.status}</td>
            <td>{item.conclusao}</td><td>{item.nota}</td><td>{item.validade}</td></tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </section>
);
export default HistoricoPage;
