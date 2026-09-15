import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';

export interface INovoTreinamentoPageProps {
  onVoltar: () => void;
}

const NovoTreinamentoPage: React.FC<INovoTreinamentoPageProps> = ({ onVoltar }) => (
  <section>
    <PageHeader
      titulo="Novo treinamento"
      subtitulo="Estrutura preparada para o cadastro administrativo de treinamentos."
      acao={<button type="button" onClick={onVoltar}>Voltar</button>}
    />

    <div style={{ padding: 20, border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <p>
        Esta página será conectada ao Dataverse na etapa de gestão. O cadastro incluirá
        dados gerais, módulos, documentos, avaliação, validade e regras de liberação.
      </p>
    </div>
  </section>
);

export default NovoTreinamentoPage;
