import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';

export interface IGestaoPageProps {
  onNovoTreinamento: () => void;
  onAtribuirTreinamento: () => void;
  onTrilhas: () => void;
  onEquipe: () => void;
}

const GestaoPage: React.FC<IGestaoPageProps> = ({
  onNovoTreinamento,
  onAtribuirTreinamento,
  onTrilhas,
  onEquipe
}) => (
  <section>
    <PageHeader
      titulo="Gestão de treinamentos"
      subtitulo="Gerencie treinamentos, atribuições, trilhas e acompanhamento da equipe."
    />

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 16
      }}
    >
      <Acao titulo="Novo treinamento" descricao="Cadastre um novo treinamento." onClick={onNovoTreinamento} />
      <Acao titulo="Atribuir treinamento" descricao="Atribua treinamentos a colaboradores." onClick={onAtribuirTreinamento} />
      <Acao titulo="Gerenciar trilhas" descricao="Configure sequências e treinamentos das trilhas." onClick={onTrilhas} />
      <Acao titulo="Minha equipe" descricao="Acompanhe progresso, pendências e conformidade." onClick={onEquipe} />
    </div>
  </section>
);

const Acao: React.FC<{
  titulo: string;
  descricao: string;
  onClick: () => void;
}> = ({ titulo, descricao, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: 20,
      textAlign: 'left',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      background: '#fff',
      cursor: 'pointer'
    }}
  >
    <strong>{titulo}</strong>
    <div style={{ marginTop: 6 }}>{descricao}</div>
  </button>
);

export default GestaoPage;
