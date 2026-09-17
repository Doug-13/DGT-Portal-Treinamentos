import * as React from 'react';
import { IColaborador } from '../../models/Usuario';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';

export interface IEquipePageProps { colaboradores?: IColaborador[]; onVoltar: () => void; }

const EquipePage: React.FC<IEquipePageProps> = ({ colaboradores = [], onVoltar }) => (
  <section>
    <PageHeader titulo="Minha equipe" subtitulo="Acompanhe progresso, pendências e conformidade."
      acao={<button type="button" onClick={onVoltar}>Voltar</button>} />
    {colaboradores.length === 0 ? <EmptyState titulo="Nenhum colaborador carregado" /> : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>Colaborador</th><th>Função</th><th>Setor</th><th>Concluídos</th><th>Pendentes</th><th>Conformidade</th></tr></thead>
          <tbody>{colaboradores.map(item => (
            <tr key={String(item.id)}><td>{item.nome}</td><td>{item.funcao}</td><td>{item.setor}</td>
            <td>{item.concluidos}</td><td>{item.pendentes}</td><td>{item.conformidade}</td></tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </section>
);
export default EquipePage;
