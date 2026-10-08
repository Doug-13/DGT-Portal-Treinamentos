import * as React from 'react';
import * as ReactDOM from 'react-dom';

// ============================================================
// MENU DE AÇÕES (⋮)
//
// Botão de três pontos que abre uma lista de ações secundárias
// (ex.: Desativar, Remover). Fecha ao clicar fora, ao pressionar
// Esc, ao rolar a página ou ao escolher uma ação.
//
// A lista é desenhada no <body> (portal) com posição fixa calculada a
// partir do botão. Assim ela não é cortada por tabelas/cartões com
// overflow (o que acontecia quando havia poucas linhas na tabela) e
// abre para cima quando não há espaço abaixo.
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
  const botao = React.useRef<HTMLButtonElement>(null);
  const lista = React.useRef<HTMLDivElement>(null);

  const [posicao, setPosicao] =
    React.useState<{ top: number; right: number; paraCima: boolean }>({
      top: 0,
      right: 0,
      paraCima: false
    });

  const calcularPosicao = React.useCallback((): void => {
    if (!botao.current) {
      return;
    }

    const r = botao.current.getBoundingClientRect();
    const alturaEstimada = 8 + 40 * Math.max(1, itens.length);
    const espacoAbaixo = window.innerHeight - r.bottom;
    const paraCima = espacoAbaixo < alturaEstimada + 12 && r.top > espacoAbaixo;

    setPosicao({
      top: paraCima ? r.top - 6 : r.bottom + 6,
      right: Math.max(8, window.innerWidth - r.right),
      paraCima
    });
  }, [itens.length]);

  React.useEffect(
    () => {
      if (!aberto) {
        return undefined;
      }

      const aoClicarFora = (evento: MouseEvent): void => {
        const alvo = evento.target as Node;
        const dentroBotao = !!raiz.current && raiz.current.contains(alvo);
        const dentroLista = !!lista.current && lista.current.contains(alvo);
        if (!dentroBotao && !dentroLista) {
          setAberto(false);
        }
      };

      const aoRolarOuRedimensionar = (): void => {
        setAberto(false);
      };

      const aoTeclar = (evento: KeyboardEvent): void => {
        if (evento.key === 'Escape') {
          setAberto(false);
        }
      };

      document.addEventListener('mousedown', aoClicarFora);
      document.addEventListener('keydown', aoTeclar);
      window.addEventListener('scroll', aoRolarOuRedimensionar, true);
      window.addEventListener('resize', aoRolarOuRedimensionar);

      return () => {
        document.removeEventListener('mousedown', aoClicarFora);
        document.removeEventListener('keydown', aoTeclar);
        window.removeEventListener('scroll', aoRolarOuRedimensionar, true);
        window.removeEventListener('resize', aoRolarOuRedimensionar);
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
        ref={botao}
        type="button"
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={desabilitado}
        onClick={() => {
          if (!aberto) {
            calcularPosicao();
          }
          setAberto(!aberto);
        }}
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

      {aberto && ReactDOM.createPortal(
        <div
          ref={lista}
          role="menu"
          style={{
            position: 'fixed',
            top: posicao.top,
            right: posicao.right,
            transform: posicao.paraCima ? 'translateY(-100%)' : undefined,
            zIndex: 100000,
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default MenuAcoes;
