import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  AvisosService
} from '../../services/notificacoes/AvisosService';

import {
  EVENTO_PREFERENCIAS,
  EVENTO_TESTE,
  IAviso,
  IPreferenciasAvisos,
  TipoAviso,
  acrescentarHistorico,
  gravarVistos,
  lerPreferencias,
  lerVistos
} from '../../services/notificacoes/preferenciasNotificacoes';

// ============================================================
// AVISOS NO CANTO DA TELA
//
// De tempos em tempos (preferência do usuário) procura novidades para
// ele — etapas de fluxo aguardando, treinamentos, orçamento,
// licitações — e mostra um cartão no canto da tela para cada novidade.
//
// • Configurável em Meu perfil → Avisos (fica neste navegador).
// • Na primeira vez em um navegador, só registra o que já existe (não
//   enche a tela com pendências antigas).
// • Só procura com a aba do portal visível.
// ============================================================

export interface IAvisosPortalProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
  onNavegar: (pagina: string) => void;
  // Abre o documento; false = não encontrou (vai para a página do aviso).
  onAbrirDocumento?: (documentoId: string) => Promise<boolean | void> | boolean | void;
}

const MAXIMO_NA_TELA = 3;

const ICONE: { [tipo in TipoAviso]: string } = {
  fluxo: '⏳',
  treinamentos: '🎓',
  orcamento: '📊',
  licitacoes: '📣'
};

const COR: { [tipo in TipoAviso]: string } = {
  fluxo: '#05C3DD',
  treinamentos: '#107C10',
  orcamento: '#0F6CBD',
  licitacoes: '#B45309'
};

// Bipe curto (sem arquivo de som).
const tocarSom = (): void => {
  try {
    const Contexto = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) {
      return;
    }
    const audio = new Contexto();
    const oscilador = audio.createOscillator();
    const volume = audio.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = 880;
    volume.gain.setValueAtTime(0.0001, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.15, audio.currentTime + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
    oscilador.connect(volume);
    volume.connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + 0.4);
    window.setTimeout(() => { audio.close().catch(() => undefined); }, 600);
  } catch {
    // Sem áudio: segue só com o aviso visual.
  }
};

interface IAvisoNaTela extends IAviso {
  chaveTela: string;
}

const AvisosPortal: React.FC<IAvisosPortalProps> = (props) => {

  const { dataverseService, contexto } = props;
  const email = contexto ? contexto.email : '';

  const [preferencias, setPreferencias] = React.useState<IPreferenciasAvisos>(() => lerPreferencias(email));
  const [naTela, setNaTela] = React.useState<IAvisoNaTela[]>([]);

  const servico = React.useMemo(
    () => (dataverseService ? new AvisosService(dataverseService) : undefined),
    [dataverseService]
  );

  const procurando = React.useRef(false);
  const liberarProcura = (): void => { procurando.current = false; };

  // Preferências: lê ao trocar de usuário e quando mudam em Meu perfil.
  React.useEffect(() => {
    setPreferencias(lerPreferencias(email));
    const aoMudar = (): void => setPreferencias(lerPreferencias(email));
    window.addEventListener(EVENTO_PREFERENCIAS, aoMudar);
    return () => window.removeEventListener(EVENTO_PREFERENCIAS, aoMudar);
  }, [email]);

  const mostrar = React.useCallback((avisos: IAviso[], prefs: IPreferenciasAvisos): void => {
    if (avisos.length === 0) {
      return;
    }
    // Mais de 3 novidades de uma vez: um cartão de resumo no lugar.
    const lista: IAviso[] =
      avisos.length > MAXIMO_NA_TELA
        ? avisos.slice(0, MAXIMO_NA_TELA - 1).concat([{
          id: `resumo:${Date.now()}`,
          tipo: avisos[MAXIMO_NA_TELA - 1].tipo,
          titulo: `+ ${avisos.length - (MAXIMO_NA_TELA - 1)} novidade(s)`,
          detalhe: 'Veja todas em Meu perfil → Avisos',
          data: new Date().toISOString(),
          acao: { pagina: 'meuPerfil' }
        }])
        : avisos;
    setNaTela(atual =>
      lista
        .map(aviso => ({ ...aviso, chaveTela: `${aviso.id}-${Date.now()}` }))
        .concat(atual)
        .slice(0, MAXIMO_NA_TELA)
    );
    if (prefs.som) {
      tocarSom();
    }
  }, []);

  const procurar = React.useCallback(async (): Promise<void> => {
    if (!servico || !contexto || !contexto.usuarioId || !preferencias.ativo || procurando.current) {
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    procurando.current = true;
    try {
      const vistos = lerVistos(email);
      const atuais = await servico.coletar(contexto, preferencias, vistos || []);
      const conhecidos = vistos || [];
      const novos = atuais.filter(aviso => conhecidos.indexOf(aviso.id) < 0);
      gravarVistos(email, conhecidos.concat(novos.map(aviso => aviso.id)));
      // Primeira vez neste navegador: só registra.
      if (vistos !== undefined && novos.length > 0) {
        acrescentarHistorico(email, novos);
        mostrar(novos, preferencias);
      }
    } catch {
      // Falha momentânea: tenta de novo no próximo intervalo.
    } finally {
      liberarProcura();
    }
  // liberarProcura só mexe na ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, contexto, preferencias, email, mostrar]);

  // Procura logo depois de abrir e depois a cada N minutos.
  React.useEffect(() => {
    if (!preferencias.ativo) {
      return undefined;
    }
    const primeira = window.setTimeout(() => { procurar().catch(() => undefined); }, 8000);
    const intervalo = window.setInterval(
      () => { procurar().catch(() => undefined); },
      Math.max(1, preferencias.intervaloMinutos || 2) * 60 * 1000
    );
    const aoVoltar = (): void => {
      if (document.visibilityState === 'visible') {
        procurar().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [procurar, preferencias.ativo, preferencias.intervaloMinutos]);

  // Botão "Testar aviso" (Meu perfil).
  React.useEffect(() => {
    const aoTestar = (): void => {
      const prefs = lerPreferencias(email);
      mostrar([{
        id: `teste:${Date.now()}`,
        tipo: 'fluxo',
        titulo: 'Assim aparecerão os seus avisos',
        detalhe: 'Etapas aguardando você, treinamentos, orçamento e licitações.',
        data: new Date().toISOString()
      }], prefs);
    };
    window.addEventListener(EVENTO_TESTE, aoTestar);
    return () => window.removeEventListener(EVENTO_TESTE, aoTestar);
  }, [email, mostrar]);

  // Some sozinho depois de N segundos (0 = fica até fechar).
  React.useEffect(() => {
    if (naTela.length === 0 || !preferencias.duracaoSegundos) {
      return undefined;
    }
    const temporizador = window.setTimeout(() => {
      setNaTela(atual => atual.slice(0, -1));
    }, preferencias.duracaoSegundos * 1000);
    return () => window.clearTimeout(temporizador);
  }, [naTela, preferencias.duracaoSegundos]);

  const fechar = (chaveTela: string): void =>
    setNaTela(atual => atual.filter(item => item.chaveTela !== chaveTela));

  const abrir = (aviso: IAvisoNaTela): void => {
    fechar(aviso.chaveTela);
    if (aviso.acao && aviso.acao.documentoId && props.onAbrirDocumento) {
      const pagina = aviso.acao.pagina;
      Promise.resolve(props.onAbrirDocumento(aviso.acao.documentoId))
        .then(abriu => {
          if (abriu === false && pagina) {
            props.onNavegar(pagina);
          }
        })
        .catch(() => {
          if (pagina) {
            props.onNavegar(pagina);
          }
        });
      return;
    }
    if (aviso.acao && aviso.acao.pagina) {
      props.onNavegar(aviso.acao.pagina);
    }
  };

  if (naTela.length === 0) {
    return null;
  }

  const emCima = preferencias.posicao === 'superiorDireito';

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Avisos do portal"
      style={{
        position: 'fixed',
        right: '18px',
        top: emCima ? '78px' : undefined,
        bottom: emCima ? undefined : '18px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: emCima ? 'column' : 'column-reverse',
        gap: '10px',
        width: '340px',
        maxWidth: 'calc(100vw - 36px)',
        fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif"
      }}
    >
      <style>
        {`
          .dgt-aviso { animation: dgtAvisoEntrar .22s ease-out; }
          @keyframes dgtAvisoEntrar {
            from { opacity: 0; transform: translateX(24px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .dgt-aviso-botao:hover { filter: brightness(.95); }
        `}
      </style>
      {naTela.map(aviso => (
        <div
          key={aviso.chaveTela}
          className="dgt-aviso"
          role="status"
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0 14px 36px rgba(32,42,68,.22)',
            borderLeft: `5px solid ${COR[aviso.tipo]}`,
            padding: '12px 14px',
            color: '#202A44'
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ fontSize: '18px', lineHeight: '22px' }}>{ICONE[aviso.tipo]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}>{aviso.titulo}</div>
              {aviso.detalhe && (
                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px', lineHeight: 1.35 }}>{aviso.detalhe}</div>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => fechar(aviso.chaveTela)}
              style={{ border: 0, background: 'transparent', color: '#94A3B8', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
            >
              ×
            </button>
          </div>
          {aviso.acao && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                className="dgt-aviso-botao"
                onClick={() => fechar(aviso.chaveTela)}
                style={{ border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#202A44', borderRadius: '6px', padding: '5px 12px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Dispensar
              </button>
              <button
                type="button"
                className="dgt-aviso-botao"
                onClick={() => abrir(aviso)}
                style={{ border: 0, background: '#202A44', color: '#FFFFFF', borderRadius: '6px', padding: '5px 14px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Abrir
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AvisosPortal;
