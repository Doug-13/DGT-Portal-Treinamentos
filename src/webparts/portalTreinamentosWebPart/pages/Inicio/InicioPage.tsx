import * as React from 'react';
import { ITreinamento } from '../../models/Treinamento';
import { IDocumento } from '../../models/Documento';
import TrainingCard from '../../components/treinamento/TrainingCard';
import Loading from '../../components/common/Loading';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';

export interface IInicioPageProps {
  primeiroNome: string;
  treinamentos: ITreinamento[];
  documentos: IDocumento[];
  carregando: boolean;
  erro: string;
  quantidadeTrilhas: number;
  onAbrirTreinamento: (treinamento: ITreinamento) => void;
  onVerTreinamentos: () => void;
  onVerDocumentos: () => void;
}

const InicioPage: React.FC<IInicioPageProps> = ({
  primeiroNome,
  treinamentos,
  documentos,
  carregando,
  erro,
  quantidadeTrilhas,
  onAbrirTreinamento,
  onVerTreinamentos,
  onVerDocumentos
}) => {
  const concluidos = treinamentos.filter(t => t.status === 'Concluído').length;
  const andamento = treinamentos.filter(t => t.status === 'Em andamento').length;
  const pendentes = treinamentos.filter(t => t.status === 'Disponível').length;
  const bloqueados = treinamentos.filter(t => t.status === 'Bloqueado').length;
  const destaques = treinamentos.filter(t => t.status !== 'Concluído').slice(0, 3);

  return (
    <section>
      <div style={{ marginBottom: 24 }}>
        <h1>Olá, {primeiroNome}!</h1>
        <p>Acompanhe seus treinamentos, trilhas e documentos.</p>
      </div>

      {erro && <ErrorMessage mensagem={erro} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 28
        }}
      >
        <Indicador titulo="Concluídos" valor={concluidos} />
        <Indicador titulo="Em andamento" valor={andamento} />
        <Indicador titulo="Pendentes" valor={pendentes} />
        <Indicador titulo="Bloqueados" valor={bloqueados} />
        <Indicador titulo="Trilhas inscritas" valor={quantidadeTrilhas} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <h2>Meus treinamentos</h2>
        <button type="button" onClick={onVerTreinamentos}>Ver todos</button>
      </div>

      {carregando ? (
        <Loading mensagem="Carregando treinamentos..." />
      ) : destaques.length === 0 ? (
        <EmptyState
          titulo="Nenhum treinamento pendente"
          descricao="Quando houver novos treinamentos atribuídos, eles aparecerão aqui."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16
          }}
        >
          {destaques.map(t => (
            <TrainingCard
              key={`${t.id}-${t.usuarioTreinamentoId || ''}`}
              treinamento={t}
              onAbrir={onAbrirTreinamento}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 32 }}>
        <h2>Documentos</h2>
        <button type="button" onClick={onVerDocumentos}>Ver documentos</button>
      </div>

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
              {documentos.slice(0, 5).map(doc => (
                <tr key={String(doc.id)}>
                  <td>{doc.codigo}</td>
                  <td>{doc.documento}</td>
                  <td>{doc.categoria}</td>
                  <td>{doc.revisao}</td>
                  <td>{doc.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const Indicador: React.FC<{ titulo: string; valor: number }> = ({ titulo, valor }) => (
  <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
    <div style={{ fontSize: 28, fontWeight: 700 }}>{valor}</div>
    <div>{titulo}</div>
  </div>
);

export default InicioPage;
