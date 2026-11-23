import * as React from 'react';

import {
  EVENTO_HISTORICO,
  IAviso,
  TipoAviso,
  gravarLidos,
  lerHistorico,
  lerLidos
} from '../../services/notificacoes/preferenciasNotificacoes';

// ============================================================
// SINO DE NOTIFICAÇÕES (cabeçalho do portal)
//
// Mostra os avisos que o portal já coleta (AvisosPortal: etapas de
// fluxo aguardando você, treinamentos, orçamento, licitações), com o
// número de não lidos. Clicar num aviso abre o destino e o marca como
// lido. Fica neste navegador, como as preferências de avisos.
// ============================================================

export interface ISinoNotificacoesProps {
  email: string;
  // Mesma classe dos outros botões do cabeçalho (tela cheia).
  classeBotao?: string;
  onNavegar: (pagina: string) => void;
  onAbrirDocumento?: (documentoId: string) => Promise<boolean | void> | boolean | void;
}

const ICONE: { [tipo in TipoAviso]: string } = {
  fluxo: '⏳',
  treinamentos: '🎓',
  orcamento: '💰',
  licitacoes: '📄'
};

const quando = (data: string): string => {
  const instante = new Date(data).getTime();
  if (isNaN(instante)) {
    return '';
  }
  const minutos = Math.round((Date.now() - instante) / 60000);
  if (minutos < 1) {
    return 'agora';
  }
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.round(minutos / 60);
  if (horas < 24) {
    return `há ${horas} h`;
  }
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
};

const Sino: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const SinoNotificacoes: React.FC<ISinoNotificacoesProps> = ({ email, classeBotao, onNavegar, onAbrirDocumento }) => {

  const [avisos, setAvisos] = React.useState<IAviso[]>(() => lerHistorico(email));
  const [lidos, setLidos] = React.useState<string[]>(() => lerLidos(email));
  const [aberto, setAberto] = React.useState(false);
  const caixa = React.useRef<HTMLDivElement>(null);

  // Atualiza quando chegam avisos novos (ou mudam os lidos).
  React.useEffect(() => {
    const atualizar = (): void => {
      setAvisos(lerHistorico(email));
      setLidos(lerLidos(email));
    };
    atualizar();
    window.addEventListener(EVENTO_HISTORICO, atualizar);
    window.addEventListener('storage', atualizar);
    return () => {
      window.removeEventListener(EVENTO_HISTORICO, atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, [email]);

  // Fecha ao clicar fora ou com Esc.
  React.useEffect(() => {
    if (!aberto) {
      return undefined;
    }
    const aoClicar = (evento: MouseEvent): void => {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    };
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const naoLidos = avisos.filter(aviso => lidos.indexOf(aviso.id) < 0);

  const marcarLidos = (ids: string[]): void => {
    const novos = lidos.concat(ids.filter(id => lidos.indexOf(id) < 0));
    setLidos(novos);
    gravarLidos(email, novos);
  };

  const abrir = (aviso: IAviso): void => {
    marcarLidos([aviso.id]);
    setAberto(false);
    const pagina = aviso.acao ? aviso.acao.pagina : undefined;
    if (aviso.acao && aviso.acao.documentoId && onAbrirDocumento) {
      Promise.resolve(onAbrirDocumento(aviso.acao.documentoId))
        .then(abriu => {
          if (abriu === false && pagina) {
            onNavegar(pagina);
          }
        })
        .catch(() => {
          if (pagina) {
            onNavegar(pagina);
          }
        });
      return;
    }
    if (pagina) {
      onNavegar(pagina);
    }
  };

  const rotulo = naoLidos.length > 0
    ? `Notificações: ${naoLidos.length} não lida(s)`
    : 'Notificações';

  return (
    <div ref={caixa} style={{ position: 'relative', display: 'inline-flex' }}>

      <button
        type="button"
        className={classeBotao}
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto(atual => !atual)}
        style={{ position: 'relative' }}
      >
        <Sino />
        {naoLidos.length > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: '3px', right: '2px', minWidth: '16px', height: '16px', padding: '0 4px',
              borderRadius: '8px', background: '#05C3DD', color: '#202A44', fontSize: '10px', fontWeight: 800,
              lineHeight: '16px', textAlign: 'center', boxSizing: 'border-box'
            }}
          >
            {naoLidos.length > 9 ? '9+' : naoLidos.length}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '340px', maxWidth: '90vw', zIndex: 1000,
            background: '#FFFFFF', color: '#202A44', borderRadius: '10px', boxShadow: '0 12px 32px rgba(32,42,68,.25)',
            border: '1px solid #D9D9D6', overflow: 'hidden', fontFamily: 'inherit'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #E5E7EB' }}>
            <strong style={{ fontSize: '14px' }}>Notificações</strong>
            {naoLidos.length > 0 && (
              <button
                type="button"
                onClick={() => marcarLidos(naoLidos.map(aviso => aviso.id))}
                style={{ border: 0, background: 'transparent', color: '#0E7C8C', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {avisos.length === 0 && (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                Nenhuma notificação por enquanto.
              </div>
            )}
            {avisos.map(aviso => {
              const lido = lidos.indexOf(aviso.id) >= 0;
              return (
                <button
                  key={aviso.id}
                  type="button"
                  onClick={() => abrir(aviso)}
                  style={{
                    display: 'flex', gap: '10px', width: '100%', textAlign: 'left', padding: '10px 14px', border: 0,
                    borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontFamily: 'inherit',
                    background: lido ? '#FFFFFF' : '#EAFBFD'
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '18px', lineHeight: '20px' }}>{ICONE[aviso.tipo] || '🔔'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: lido ? 500 : 800, color: '#202A44' }}>{aviso.titulo}</span>
                    {aviso.detalhe && (
                      <span style={{ display: 'block', fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{aviso.detalhe}</span>
                    )}
                    <span style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{quando(aviso.data)}</span>
                  </span>
                  {!lido && <span aria-label="não lida" style={{ width: '8px', height: '8px', borderRadius: '4px', background: '#05C3DD', marginTop: '6px' }} />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { setAberto(false); onNavegar('meuPerfil'); }}
            style={{ width: '100%', padding: '10px 14px', border: 0, borderTop: '1px solid #E5E7EB', background: '#F8FAFC', color: '#202A44', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
          >
            Configurar avisos (Meu perfil)
          </button>
        </div>
      )}
    </div>
  );
};

export default SinoNotificacoes;
