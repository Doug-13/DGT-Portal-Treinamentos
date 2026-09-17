import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';

export interface IGestaoPageProps {
  onNovoTreinamento: () => void; onAtribuirTreinamento: () => void;
  onTrilhas: () => void; onEquipe: () => void;
}
const Acao: React.FC<{ titulo: string; onClick: () => void }> = ({ titulo, onClick }) => (
  <button type="button" onClick={onClick}
    style={{padding:20,textAlign:'left',border:'1px solid #e5e7eb',borderRadius:12,background:'#fff',cursor:'pointer'}}>
    <strong>{titulo}</strong>
  </button>
);
const GestaoPage: React.FC<IGestaoPageProps> = props => (
  <section>
    <PageHeader titulo="Gestão de treinamentos" subtitulo="Gerencie treinamentos, atribuições, trilhas e equipe." />
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
      <Acao titulo="Novo treinamento" onClick={props.onNovoTreinamento}/>
      <Acao titulo="Atribuir treinamento" onClick={props.onAtribuirTreinamento}/>
      <Acao titulo="Gerenciar trilhas" onClick={props.onTrilhas}/>
      <Acao titulo="Minha equipe" onClick={props.onEquipe}/>
    </div>
  </section>
);
export default GestaoPage;
