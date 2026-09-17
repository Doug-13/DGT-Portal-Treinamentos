import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';

export interface IAtribuirTreinamentoPageProps { onVoltar: () => void; }

const AtribuirTreinamentoPage: React.FC<IAtribuirTreinamentoPageProps> = ({ onVoltar }) => (
  <section>
    <PageHeader titulo="Atribuir treinamento"
      subtitulo="Atribuições individuais, por grupo, função, reciclagem ou revisão documental."
      acao={<button type="button" onClick={onVoltar}>Voltar</button>} />
  </section>
);
export default AtribuirTreinamentoPage;
