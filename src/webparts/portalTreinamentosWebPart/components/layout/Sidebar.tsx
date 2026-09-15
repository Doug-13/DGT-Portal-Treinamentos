import * as React from 'react';

export interface ISidebarItem {
  id: string;
  texto: string;
  icone?: React.ReactNode;
  visivel?: boolean;
}

export interface ISidebarProps {
  itens: ISidebarItem[];
  itemAtivo: string;
  onNavigate: (id: string) => void;
  logo?: React.ReactNode;
  className?: string;
}

const Sidebar: React.FC<ISidebarProps> = ({
  itens,
  itemAtivo,
  onNavigate,
  logo,
  className
}) => (
  <aside
    className={className}
    aria-label="Navegação principal"
    style={{ width: 250, flexShrink: 0 }}
  >
    {logo && <div>{logo}</div>}

    <nav>
      {itens
        .filter(item => item.visivel !== false)
        .map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={itemAtivo === item.id ? 'page' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              padding: '10px 12px',
              border: 0,
              cursor: 'pointer',
              fontWeight: itemAtivo === item.id ? 700 : 400
            }}
          >
            {item.icone}
            <span>{item.texto}</span>
          </button>
        ))}
    </nav>
  </aside>
);

export default Sidebar;
