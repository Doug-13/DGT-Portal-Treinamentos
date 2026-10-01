import * as React from 'react';
import * as ReactDOM from 'react-dom';

// ============================================================
// MODAL DE CONFIGURAÇÃO DO FLUXO
//
// Abre sobre o desenho (duplo clique ou ⚙ no menu do elemento) e
// mostra a configuração em abas: Geral, Responsáveis, Ações,
// Metadados, Caminhos...
//
// As alterações valem na hora para o rascunho em edição; só são
// gravadas ao clicar em "Salvar rascunho".
// ============================================================

export interface IAbaModalFluxo {
  id: string;
  rotulo: string;
  conteudo: React.ReactNode;

  // Indicador ao lado do nome da aba (ex.: quantidade, "!" de pendência).
  indicador?: string;
}

export interface IModalConfiguracaoFluxoProps {
  titulo: string;
  subtitulo?: string;
  abas: IAbaModalFluxo[];
  abaInicial?: string;
  onFechar: () => void;
  rodape?: React.ReactNode;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_BORDA = '#D9D9D6';

const ModalConfiguracaoFluxo: React.FC<IModalConfiguracaoFluxoProps> = ({
  titulo,
  subtitulo,
  abas,
  abaInicial,
  onFechar,
  rodape
}) => {

  const [abaAtual, setAbaAtual] =
    React.useState<string>(abaInicial || (abas.length > 0 ? abas[0].id : ''));

  const dialogoRef =
    React.useRef<HTMLDivElement>(null);

  // Se a lista de abas mudar e a atual sumir, volta para a primeira.
  React.useEffect(
    () => {
      if (abas.length > 0 && !abas.some(aba => aba.id === abaAtual)) {
        setAbaAtual(abas[0].id);
      }
    },
    [abas.map(aba => aba.id).join('|')]
  );

  // Esc fecha; foco vai para o modal ao abrir.
  React.useEffect(
    () => {

      const focoAnterior =
        document.activeElement as HTMLElement | null;

      if (dialogoRef.current) {
        dialogoRef.current.focus();
      }

      const teclar = (evento: KeyboardEvent): void => {
        if (evento.key === 'Escape') {
          evento.stopPropagation();
          onFechar();
        }
      };

      document.addEventListener('keydown', teclar, true);

      return () => {
        document.removeEventListener('keydown', teclar, true);

        if (focoAnterior && typeof focoAnterior.focus === 'function') {
          focoAnterior.focus();
        }
      };
    },
    []
  );

  const aba =
    abas.find(item => item.id === abaAtual) || abas[0];

  const conteudo = (
    <div
      onMouseDown={evento => {
        // Clique fora do modal fecha.
        if (evento.target === evento.currentTarget) {
          onFechar();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(32, 42, 68, .45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        fontFamily: 'Barlow, Arial, sans-serif'
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-fluxo-titulo"
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '10px',
          boxShadow: '0 20px 60px rgba(0,0,0,.25)',
          overflow: 'hidden',
          outline: 'none',
          color: COR_AZUL
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            background: COR_AZUL,
            color: '#FFFFFF',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            {
              subtitulo && (
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .85 }}>
                  {subtitulo}
                </div>
              )
            }
            <div
              id="modal-fluxo-titulo"
              style={{ fontSize: '18px', fontWeight: 700, lineHeight: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {titulo}
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            style={{
              width: '36px',
              height: '36px',
              border: '1px solid rgba(255,255,255,.5)',
              borderRadius: '6px',
              background: 'transparent',
              color: '#FFFFFF',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        {/* ABAS */}
        {
          abas.length > 1 && (
            <div
              role="tablist"
              style={{
                display: 'flex',
                gap: '2px',
                padding: '0 12px',
                borderBottom: `1px solid ${COR_BORDA}`,
                overflowX: 'auto',
                flexShrink: 0
              }}
            >
              {
                abas.map(
                  item => {
                    const ativa =
                      aba && item.id === aba.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={!!ativa}
                        onClick={() => setAbaAtual(item.id)}
                        style={{
                          padding: '12px 14px',
                          border: 0,
                          borderBottom: `3px solid ${ativa ? COR_CIANO : 'transparent'}`,
                          background: 'transparent',
                          color: COR_AZUL,
                          fontSize: '13.5px',
                          fontWeight: ativa ? 800 : 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.rotulo}
                        {
                          item.indicador && (
                            <span
                              style={{
                                marginLeft: '6px',
                                padding: '1px 7px',
                                borderRadius: '10px',
                                background: '#EDF0F5',
                                fontSize: '11.5px',
                                fontWeight: 700
                              }}
                            >
                              {item.indicador}
                            </span>
                          )
                        }
                      </button>
                    );
                  }
                )
              }
            </div>
          )
        }

        {/* CONTEÚDO */}
        <div role="tabpanel" style={{ overflowY: 'auto', flexGrow: 1, minHeight: '200px' }}>
          {aba ? aba.conteudo : undefined}
        </div>

        {/* RODAPÉ */}
        <div
          style={{
            borderTop: `1px solid ${COR_BORDA}`,
            padding: '10px 20px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexShrink: 0,
            background: '#F2F2F2'
          }}
        >
          <span style={{ fontSize: '12.5px', flexGrow: 1 }}>
            {rodape || 'As alterações já valem no rascunho em edição. Para gravá-las, use “Salvar rascunho”.'}
          </span>
          <button
            type="button"
            onClick={onFechar}
            style={{
              minHeight: '38px',
              padding: '0 18px',
              borderRadius: '6px',
              border: `2px solid ${COR_AZUL}`,
              background: COR_AZUL,
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(conteudo, document.body);
};

export default ModalConfiguracaoFluxo;
