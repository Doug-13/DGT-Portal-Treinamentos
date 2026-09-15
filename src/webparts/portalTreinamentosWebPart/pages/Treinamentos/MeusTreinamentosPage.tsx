import * as React from 'react';
import { ITreinamento } from '../../models/Treinamento';
import TrainingCard from '../../components/treinamento/TrainingCard';
import Loading from '../../components/common/Loading';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';
import PageHeader from '../../components/layout/PageHeader';

export interface IMeusTreinamentosPageProps {
  treinamentos: ITreinamento[];
  carregando: boolean;
  erro: string;
  onAbrirTreinamento: (treinamento: ITreinamento) => void;
}

const MeusTreinamentosPage: React.FC<IMeusTreinamentosPageProps> = ({
  treinamentos,
  carregando,
  erro,
  onAbrirTreinamento
}) => (
  <section>
    <PageHeader
      titulo="Meus treinamentos"
      subtitulo="Acompanhe seus treinamentos disponíveis, em andamento, concluídos e bloqueados."
    />

    {erro && <ErrorMessage mensagem={erro} />}

    {carregando ? (
      <Loading mensagem="Carregando seus treinamentos..." />
    ) : treinamentos.length === 0 ? (
      <EmptyState
        titulo="Nenhum treinamento atribuído"
        descricao="Quando um treinamento for atribuído a você, ele aparecerá nesta página."
      />
    ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18
        }}
      >
        {treinamentos.map(t => (
          <TrainingCard
            key={`${t.id}-${t.usuarioTreinamentoId || ''}`}
            treinamento={t}
            onAbrir={onAbrirTreinamento}
          />
        ))}
      </div>
    )}
  </section>
);

export default MeusTreinamentosPage;
