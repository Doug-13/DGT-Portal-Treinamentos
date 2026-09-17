import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';

const SuportePage: React.FC = () => (
  <section>
    <PageHeader titulo="Ajuda e suporte" subtitulo="Orientações para utilizar o Portal de Treinamentos." />
    <div style={{ display: 'grid', gap: 16 }}>
      <article style={{ padding: 18, border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <h3>Como iniciar um treinamento?</h3>
        <p>Acesse Meus Treinamentos, selecione um treinamento disponível e clique em Iniciar treinamento.</p>
      </article>
      <article style={{ padding: 18, border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <h3>Treinamento bloqueado</h3>
        <p>O treinamento pode depender da conclusão de uma etapa anterior da trilha.</p>
      </article>
    </div>
  </section>
);
export default SuportePage;
