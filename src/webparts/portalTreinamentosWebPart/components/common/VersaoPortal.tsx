import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  COMMIT_BUILD,
  DATA_BUILD,
  INovidadeVersao,
  NOVIDADES,
  TipoNovidade,
  VERSAO_PORTAL,
  VERSAO_SOLUCAO
} from '../../constants/versao';

// ============================================================
// VERSÃO DO PORTAL
//
// A janela de Novidades é renderizada direto no <body> (portal do
// React). Dentro da página do SharePoint, elementos com "transform"
// fazem um position: fixed se prender ao web part, e a janela
// aparecia no canto superior, cortada.
//
// Selo "v1.0.5" no cabeçalho. Ao clicar, abre "Novidades do
// portal" com o histórico gerado a partir do CHANGELOG.md.
//
// Quando o usuário ainda não viu a versão atual, o selo mostra um
// ponto de "novo". A última versão vista fica no navegador
// (localStorage), por usuário e por computador.
// ============================================================

const CHAVE_VISTA = 'dgtPortal.versaoVista';

const COR_TIPO: Record<TipoNovidade, { fundo: string; texto: string }> = {
  Novo: { fundo: '#E7F5EE', texto: '#13795B' },
  Melhoria: { fundo: '#EAF3FB', texto: '#0B5CAB' },
  'Correção': { fundo: '#FFF4E5', texto: '#B45309' }
};

const lerVista = (): string => {
  try {
    return window.localStorage.getItem(CHAVE_VISTA) || '';
  } catch {
    return '';
  }
};

const gravarVista = (): void => {
  try {
    window.localStorage.setItem(CHAVE_VISTA, VERSAO_PORTAL);
  } catch {
    // Navegador sem acesso ao armazenamento local: apenas não marca.
  }
};

const formatarData = (
  iso: string
): string => {
  if (!iso) {
    return '';
  }

  // "AAAA-MM-DD" do CHANGELOG ou ISO completo do build.
  const partes = iso.substring(0, 10).split('-');

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : iso;
};

// Registra a versão no console (ajuda a confirmar se o SharePoint
// está servindo o pacote novo ou um pacote antigo em cache).
let versaoRegistrada = false;

const registrarNoConsole = (): void => {
  if (versaoRegistrada) {
    return;
  }

  versaoRegistrada = true;

  console.info(
    `[Portal DGT] versão ${VERSAO_PORTAL} (pacote ${VERSAO_SOLUCAO}) · build ${DATA_BUILD}` +
    (COMMIT_BUILD ? ` · commit ${COMMIT_BUILD}` : '')
  );
};

const Versao: React.FC<{
  item: INovidadeVersao;
  atual: boolean;
}> = ({ item, atual }) => (
  <li
    style={{
      padding: '14px 0',
      borderTop: '1px solid #D8E2EC'
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}
    >
      <strong style={{ fontSize: '15px', color: '#0B2D4D' }}>
        v{item.versao}
      </strong>

      {atual && (
        <span
          style={{
            padding: '1px 8px',
            borderRadius: '999px',
            background: '#0B2D4D',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          Versão atual
        </span>
      )}

      <span style={{ marginLeft: 'auto', color: '#66788A', fontSize: '12px' }}>
        {formatarData(item.data)}
      </span>
    </div>

    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {item.itens.map((novidade, indice) => (
        <li
          key={`${item.versao}-${indice}`}
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            marginTop: '6px',
            fontSize: '13px',
            lineHeight: 1.45,
            color: '#18324A'
          }}
        >
          <span
            style={{
              flex: '0 0 auto',
              minWidth: '68px',
              padding: '1px 8px',
              borderRadius: '999px',
              background: COR_TIPO[novidade.tipo].fundo,
              color: COR_TIPO[novidade.tipo].texto,
              fontSize: '11px',
              fontWeight: 700,
              textAlign: 'center'
            }}
          >
            {novidade.tipo}
          </span>

          <span>{novidade.texto}</span>
        </li>
      ))}
    </ul>
  </li>
);

const VersaoPortal: React.FC = () => {

  const [aberto, setAberto] = React.useState(false);
  const [temNovidade, setTemNovidade] = React.useState(false);

  React.useEffect(
    () => {
      registrarNoConsole();
      setTemNovidade(lerVista() !== VERSAO_PORTAL);
    },
    []
  );

  const abrir = (): void => {
    setAberto(true);
    setTemNovidade(false);
    gravarVista();
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title={
          `Versão ${VERSAO_PORTAL} · publicada em ${formatarData(DATA_BUILD)}` +
          (temNovidade ? ' · há novidades' : '') +
          ' · clique para ver as novidades'
        }
        style={{
          position: 'relative',
          padding: '3px 10px',
          border: '1px solid rgba(255,255,255,.35)',
          borderRadius: '999px',
          background: 'transparent',
          color: 'inherit',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '.3px',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        v{VERSAO_PORTAL}

        {temNovidade && (
          <span
            aria-label="Há novidades"
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#05C3DD',
              border: '2px solid #0B2D4D'
            }}
          />
        )}
      </button>

      {aberto && ReactDOM.createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Novidades do portal"
          onClick={() => setAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(11, 45, 77, 0.45)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '60px 16px',
            overflowY: 'auto',
            color: '#18324A',
            fontFamily: '"Segoe UI", Barlow, Arial, sans-serif'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '620px',
              background: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 20px 50px rgba(11, 45, 77, 0.25)',
              padding: '22px 24px 10px',
              textAlign: 'left'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px'
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#0B2D4D' }}>
                  Novidades do portal
                </h2>
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#66788A' }}>
                  Versão {VERSAO_PORTAL} · publicada em {formatarData(DATA_BUILD)}
                  {COMMIT_BUILD ? ` · ${COMMIT_BUILD}` : ''}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAberto(false)}
                style={{
                  padding: '7px 14px',
                  border: '1px solid #D8E2EC',
                  borderRadius: '8px',
                  background: '#FFFFFF',
                  color: '#18324A',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>

            {NOVIDADES.length === 0 ? (
              <p style={{ margin: '18px 0', fontSize: '13px', color: '#66788A' }}>
                Nenhuma novidade registrada ainda.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
                {NOVIDADES.map(item => (
                  <Versao
                    key={item.versao}
                    item={item}
                    atual={item.versao === VERSAO_PORTAL}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default VersaoPortal;