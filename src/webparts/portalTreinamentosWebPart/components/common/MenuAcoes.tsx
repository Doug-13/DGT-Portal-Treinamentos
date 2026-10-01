import * as React from 'react';

// ============================================================
// MENU DE AÇÕES (⋮)
//
// Botão de três pontos que abre uma lista de ações secundárias
// (ex.: Desativar, Remover). Fecha ao clicar fora, ao pressionar
// Esc ou ao escolher uma ação.
// ============================================================

export interface IItemMenuAcoes {
  rotulo: string;
  onClick: () => void;
  // Ação destrutiva (ex.: Remover): texto em vermelho.
  perigo?: boolean;
  // Ação positiva (ex.: Ativar): texto em verde.
  sucesso?: boolean;
  desabilitado?: boolean;
  titulo?: string;
}

export interface IMenuAcoesProps {
  itens: IItemMenuAcoes[];
  desabilitado?: boolean;
  rotulo?: string;
}

const MenuAcoes: React.FC<IMenuAcoesProps> = ({
  itens,
  desabilitado,
  rotulo = 'Mais ações'
}) => {

  const [aberto, setAberto] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);

  React.useEffect(
    () => {
      if (!aberto) {
        return undefined;
      }

      const aoClicarFora = (evento: MouseEvent): void => {
        if (raiz.current && !raiz.current.contains(evento.target as Node)) {
          setAberto(false);
        }
      };

      const aoTeclar = (evento: KeyboardEvent): void => {
        if (evento.key === 'Escape') {
          setAberto(false);
        }
      };

      document.addEventListener('mousedown', aoClicarFora);
      document.addEventListener('keydown', aoTeclar);

      return () => {
        document.removeEventListener('mousedown', aoClicarFora);
        document.removeEventListener('keydown', aoTeclar);
      };
    },
    [aberto]
  );

  const visiveis = itens.filter(item => !!item);

  if (!visiveis.length) {
    return null;
  }

  return (
    <div
      ref={raiz}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      <button
        type="button"
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={desabilitado}
        onClick={() => setAberto(!aberto)}
        style={{
          width: '34px',
          height: '34px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: `1px solid ${aberto ? '#94a3b8' : '#cbd5e1'}`,
          borderRadius: '8px',
          background: aberto ? '#f1f5f9' : '#ffffff',
          color: '#0B2D4D',
          cursor: desabilitado ? 'default' : 'pointer',
          opacity: desabilitado ? 0.5 : 1
        }}
      >
        {/* Três pontos verticais */}
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="3" r="1.6" fill="currentColor" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
          <circle cx="8" cy="13" r="1.6" fill="currentColor" />
        </svg>
      </button>

      {aberto && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 60,
            minWidth: '170px',
            padding: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(11, 45, 77, 0.18)'
          }}
        >
          {visiveis.map(item => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              title={item.titulo}
              disabled={item.desabilitado}
              onClick={() => {
                setAberto(false);
                item.onClick();
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 12px',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: 600,
                color: item.perigo
                  ? '#B42318'
                  : item.sucesso
                    ? '#13795B'
                    : '#18324A',
                cursor: item.desabilitado ? 'default' : 'pointer',
                opacity: item.desabilitado ? 0.5 : 1
              }}
              onMouseEnter={evento => {
                if (!item.desabilitado) {
                  evento.currentTarget.style.background = item.perigo ? '#FDE7E9' : '#F1F5F9';
                }
              }}
              onMouseLeave={evento => {
                evento.currentTarget.style.background = 'transparent';
              }}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuAcoes;
