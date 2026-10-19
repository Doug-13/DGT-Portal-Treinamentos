import * as React from 'react';

// ============================================================
// MENU DO USUÁRIO (clique no nome, no topo do portal)
//
// Cabeçalho com foto/inicial, nome, e-mail e perfil; os papéis por
// área em etiquetas coloridas; e os atalhos (Meu perfil, Usuários e
// acessos, Áreas e acessos) com ícone e descrição.
// Cores da identidade DGT: azul 202A44, ciano 05C3DD.
// ============================================================

export interface IItemMenuUsuario {
  chave: string;
  rotulo: string;
  descricao: string;
  icone: 'perfil' | 'usuarios' | 'areas';
  onClick: () => void;
}

export interface IMenuUsuarioProps {
  nome: string;
  email: string;
  // Perfil global: Administrador, Gestor, Editor, Funcionario.
  perfil: string;
  fotoUrl?: string;
  inicial: string;
  vinculos: Array<{ areaNome: string; perfil: string }>;
  itens: IItemMenuUsuario[];
}

const AZUL = '#202A44';
const CIANO = '#05C3DD';
const TEXTO2 = '#64748B';
const BORDA = '#E5E7EB';

const normalizar = (valor: string): string =>
  (valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Papel por área com o nome certo (ex.: "Administrador da area" vindo
// sem acento do Dataverse) e a cor da etiqueta.
const PAPEIS: { [normalizado: string]: { rotulo: string; fundo: string; cor: string } } = {
  'administrador da area': { rotulo: 'Administrador da área', fundo: '#E0F7FA', cor: '#00707F' },
  gestor: { rotulo: 'Gestor', fundo: '#E7F6EC', cor: '#107C10' },
  editor: { rotulo: 'Editor', fundo: '#F3E8FF', cor: '#6B21A8' },
  membro: { rotulo: 'Membro', fundo: '#F1F5F9', cor: '#475569' }
};

const papel = (valor: string): { rotulo: string; fundo: string; cor: string } =>
  PAPEIS[normalizar(valor)] || { rotulo: valor, fundo: '#F1F5F9', cor: '#475569' };

const ROTULO_PERFIL: { [perfil: string]: string } = {
  Funcionario: 'Colaborador',
  Gestor: 'Gestor',
  Editor: 'Editor',
  Administrador: 'Administrador'
};

const Icone: React.FC<{ tipo: IItemMenuUsuario['icone'] }> = ({ tipo }) => {
  const base = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };
  if (tipo === 'usuarios') {
    return (
      <svg {...base}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (tipo === 'areas') {
    return (
      <svg {...base}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
};

const LIMITE_AREAS = 4;

const MenuUsuario: React.FC<IMenuUsuarioProps> = (props) => {

  const [verTodasAreas, setVerTodasAreas] = React.useState(false);
  const [fotoComErro, setFotoComErro] = React.useState(false);

  const areas = verTodasAreas ? props.vinculos : props.vinculos.slice(0, LIMITE_AREAS);
  const restantes = props.vinculos.length - LIMITE_AREAS;

  return (
    <div
      role="menu"
      aria-label="Menu do usuário"
      className="dgt-menu-usuario"
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 10px)',
        width: '330px',
        maxWidth: 'calc(100vw - 24px)',
        background: '#FFFFFF',
        color: AZUL,
        border: `1px solid ${BORDA}`,
        borderRadius: '16px',
        boxShadow: '0 20px 48px rgba(32,42,68,.24)',
        zIndex: 1000,
        overflow: 'hidden',
        textAlign: 'left',
        fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif"
      }}
    >
      {/* Animação de abertura e destaque ao passar o mouse. */}
      <style>
        {`
          .dgt-menu-usuario { animation: dgtMenuUsuarioEntrar .16s ease-out; }
          @keyframes dgtMenuUsuarioEntrar {
            from { opacity: 0; transform: translateY(-6px) scale(.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .dgt-menu-usuario-item { transition: background .12s ease; }
          .dgt-menu-usuario-item:hover, .dgt-menu-usuario-item:focus-visible { background: #F3F8FB !important; outline: none; }
          .dgt-menu-usuario-item:hover .dgt-menu-usuario-seta { transform: translateX(2px); color: ${CIANO}; }
          .dgt-menu-usuario-seta { transition: transform .12s ease, color .12s ease; }
        `}
      </style>

      {/* Cabeçalho */}
      <div
        style={{
          padding: '18px 18px 16px',
          background: `linear-gradient(135deg, ${AZUL} 0%, #2E3F63 100%)`,
          color: '#FFFFFF',
          display: 'flex',
          gap: '14px',
          alignItems: 'center'
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            flexShrink: 0,
            borderRadius: '999px',
            border: `2px solid ${CIANO}`,
            background: '#3B4C72',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 700
          }}
        >
          {props.fotoUrl && !fotoComErro
            ? <img src={props.fotoUrl} alt="" onError={() => setFotoComErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span>{props.inicial}</span>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15.5px', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {props.nome}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px', overflowWrap: 'anywhere' }}>
            {props.email}
          </div>
          <span
            style={{
              display: 'inline-block',
              marginTop: '8px',
              padding: '2px 10px',
              borderRadius: '999px',
              background: props.perfil === 'Administrador' ? CIANO : 'rgba(255,255,255,.16)',
              color: props.perfil === 'Administrador' ? AZUL : '#FFFFFF',
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '.2px'
            }}
          >
            {ROTULO_PERFIL[props.perfil] || props.perfil}
          </span>
        </div>
      </div>

      {/* Papéis por área */}
      {props.vinculos.length > 0 && (
        <div style={{ padding: '12px 18px 10px', borderBottom: `1px solid ${BORDA}` }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: TEXTO2, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '8px' }}>
            Papéis por área
          </div>
          {areas.map(item => {
            const info = papel(item.perfil);
            return (
              <div
                key={`${item.areaNome}-${item.perfil}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '5px 0' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: AZUL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.areaNome}
                </span>
                <span style={{ flexShrink: 0, padding: '2px 9px', borderRadius: '999px', background: info.fundo, color: info.cor, fontSize: '11.5px', fontWeight: 700 }}>
                  {info.rotulo}
                </span>
              </div>
            );
          })}
          {restantes > 0 && (
            <button
              type="button"
              onClick={() => setVerTodasAreas(!verTodasAreas)}
              style={{ border: 0, background: 'transparent', padding: '4px 0 0', color: '#0F6CBD', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {verTodasAreas ? 'Mostrar menos' : `+ ${restantes} área(s)`}
            </button>
          )}
        </div>
      )}

      {/* Atalhos */}
      <div style={{ padding: '6px' }}>
        {props.itens.map(item => (
          <button
            key={item.chave}
            type="button"
            role="menuitem"
            className="dgt-menu-usuario-item"
            onClick={item.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 12px',
              border: 0,
              borderRadius: '10px',
              background: '#FFFFFF',
              color: AZUL,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit'
            }}
          >
            <span
              style={{
                width: '34px',
                height: '34px',
                flexShrink: 0,
                borderRadius: '10px',
                background: '#EEF6FA',
                color: AZUL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icone tipo={item.icone} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700 }}>{item.rotulo}</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: TEXTO2, marginTop: '1px' }}>{item.descricao}</span>
            </span>
            <span className="dgt-menu-usuario-seta" aria-hidden="true" style={{ color: '#94A3B8', fontSize: '18px', lineHeight: 1 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MenuUsuario;
