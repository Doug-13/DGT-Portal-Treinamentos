import * as React from 'react';

export interface IPageHeaderProps {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<IPageHeaderProps> = ({
  titulo,
  subtitulo,
  acao,
  className
}) => (
  <header
    className={className}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 24
    }}
  >
    <div>
      <h1 style={{ margin: 0 }}>{titulo}</h1>
      {subtitulo && <p style={{ margin: '6px 0 0' }}>{subtitulo}</p>}
    </div>
    {acao && <div>{acao}</div>}
  </header>
);

export default PageHeader;
