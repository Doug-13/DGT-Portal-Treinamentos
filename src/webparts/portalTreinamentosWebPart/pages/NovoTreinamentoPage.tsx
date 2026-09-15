import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';

export interface IAtribuirTreinamentoPageProps {
  onVoltar: () => void;
}

const AtribuirTreinamentoPage: React.FC<IAtribuirTreinamentoPageProps> = ({ onVoltar }) => (
  <section>
    <PageHeader
      titulo="Atribuir treinamento"
      subtitulo="Atribuições individuais, por grupo, função, reciclagem ou revisão documental."
      acao={<button type="button" onClick={onVoltar}>Voltar</button>}
    />

    <div style={{ padding: 20, border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <p>
        A interface está separada e pronta para receber a integração de usuários,
        grupos, funções, trilhas e regras de prevenção de duplicidade.
      </p>
    </div>
  </section>
);

export default AtribuirTreinamentoPage;
