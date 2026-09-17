import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';

export interface ITrilhasPageProps { quantidadeTrilhasUsuario: number; }

const TrilhasPage: React.FC<ITrilhasPageProps> = ({ quantidadeTrilhasUsuario }) => (
  <section>
    <PageHeader titulo="Trilhas" subtitulo={`Você possui ${quantidadeTrilhasUsuario} trilha(s) vinculada(s).`} />
    <EmptyState
      titulo="Detalhamento das trilhas em preparação"
      descricao="Na próxima integração exibiremos os cursos, sequência e progresso de cada trilha."
    />
  </section>
);
export default TrilhasPage;
