import * as React from 'react';

import {
  extensaoArquivo,
  tipoDoArquivo,
  urlParaAbrir
} from './DocumentosTabelaCelulas';

// ============================================================
// PRÉ-VISUALIZAÇÃO DO ARQUIVO (sem sair do portal)
//
//   Word / Excel / PowerPoint / Visio → visualizador do SharePoint
//                                       (Doc.aspx?action=embedview)
//   PDF / texto / HTML                → visualizador do navegador
//   Imagem / vídeo                    → exibidos direto
//   Outros                            → aviso + botão para abrir
//
// Funciona porque o portal e a biblioteca estão no mesmo domínio do
// SharePoint (o SharePoint só permite ser exibido dentro dele mesmo).
// ============================================================

export interface IPreviaDocumentoModalProps {
  aberto: boolean;
  url: string;
  titulo: string;
  revisao: string;
  // Endereço do site (SharePointDocumentoService.urlSite).
  siteUrl?: string;
  // Revisão obsoleta → marca d'água de aviso sobre a prévia.
  obsoleta?: boolean;
  // Revisão ainda não vigente → aviso de rascunho.
  rascunho?: boolean;
  onFechar: () => void;
}

type ModoPrevia = 'office' | 'iframe' | 'imagem' | 'video' | 'indisponivel';

const EXTENSOES_OFFICE = [
  'doc', 'docx', 'docm', 'dot', 'dotx', 'rtf',
  'xls', 'xlsx', 'xlsm', 'xlsb', 'csv',
  'ppt', 'pptx', 'pptm', 'pps', 'ppsx',
  'vsd', 'vsdx', 'vsdm'
];

const EXTENSOES_IFRAME = ['pdf', 'txt', 'htm', 'html'];
const EXTENSOES_IMAGEM = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
const EXTENSOES_VIDEO = ['mp4', 'webm', 'mov'];

const modoDaPrevia = (
  url: string
): ModoPrevia => {

  const extensao =
    extensaoArquivo(url);

  if (EXTENSOES_OFFICE.indexOf(extensao) >= 0) return 'office';
  if (EXTENSOES_IFRAME.indexOf(extensao) >= 0) return 'iframe';
  if (EXTENSOES_IMAGEM.indexOf(extensao) >= 0) return 'imagem';
  if (EXTENSOES_VIDEO.indexOf(extensao) >= 0) return 'video';

  return 'indisponivel';
};

// Site onde o arquivo está: o do serviço (se o arquivo estiver nele)
// ou o /sites/... /teams/... do próprio endereço do arquivo.
const siteDoArquivo = (
  url: string,
  siteUrl?: string
): string => {

  const site =
    (siteUrl || '').replace(/\/$/, '');

  if (
    site &&
    url.toLowerCase().indexOf(site.toLowerCase() + '/') === 0
  ) {
    return site;
  }

  const encontrado =
    url.match(/^(https?:\/\/[^/]+(?:\/(?:sites|teams)\/[^/?#]+)?)/i);

  return encontrado
    ? encontrado[1]
    : site;
};

const urlDaPrevia = (
  url: string,
  modo: ModoPrevia,
  siteUrl?: string
): string => {

  if (modo !== 'office') {
    return url;
  }

  let caminho = '';

  try {
    caminho = decodeURIComponent(new URL(url).pathname);
  } catch {
    return urlParaAbrir(url);
  }

  return (
    `${siteDoArquivo(url, siteUrl)}/_layouts/15/Doc.aspx` +
    `?sourcedoc=${encodeURIComponent(caminho)}` +
    '&action=embedview'
  );
};

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';

const PreviaDocumentoModal:
  React.FC<IPreviaDocumentoModalProps> = ({
    aberto,
    url,
    titulo,
    revisao,
    siteUrl,
    obsoleta,
    rascunho,
    onFechar
  }) => {

    const [carregando, setCarregando] =
      React.useState(true);

    React.useEffect(
      () => {
        if (aberto) {
          setCarregando(true);
        }
      },
      [
        aberto,
        url
      ]
    );

    // Esc fecha a prévia.
    React.useEffect(
      () => {

        if (!aberto) {
          return undefined;
        }

        const aoTeclar = (
          evento: KeyboardEvent
        ): void => {
          if (evento.key === 'Escape') {
            onFechar();
          }
        };

        document.addEventListener('keydown', aoTeclar);

        return () =>
          document.removeEventListener('keydown', aoTeclar);
      },
      [
        aberto,
        onFechar
      ]
    );

    if (!aberto || !url) {
      return null;
    }

    const modo =
      modoDaPrevia(url);

    const src =
      urlDaPrevia(url, modo, siteUrl);

    const tipo =
      tipoDoArquivo(url);

    const fimCarregamento = (): void =>
      setCarregando(false);

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pré-visualização de ${titulo}`}
        onClick={onFechar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'rgba(15,23,42,.6)'
        }}
      >
        <div
          onClick={evento => evento.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '1180px',
            height: '88vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#FFFFFF',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(15,23,42,.35)'
          }}
        >
          {/* CABEÇALHO */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 18px',
              background: COR_AZUL,
              borderBottom: `3px solid ${COR_CIANO}`,
              color: '#FFFFFF'
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                Pré-visualização · {titulo}
              </strong>

              <span style={{ fontSize: '12px', opacity: 0.85 }}>
                {revisao}
                {tipo ? ` · ${tipo.nome}` : ''}
                {' · somente leitura'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <a
                href={urlParaAbrir(url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,.6)',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
              >
                Abrir em nova aba ↗
              </a>

              <button
                type="button"
                onClick={onFechar}
                title="Fechar (Esc)"
                style={{
                  padding: '7px 12px',
                  border: 0,
                  borderRadius: '8px',
                  background: '#FFFFFF',
                  color: COR_AZUL,
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ✕ Fechar
              </button>
            </div>
          </div>

          {
            (obsoleta || rascunho) &&
            (
              <div
                style={{
                  padding: '8px 18px',
                  background: obsoleta ? '#B42318' : '#E6F9FC',
                  color: obsoleta ? '#FFFFFF' : COR_AZUL,
                  fontSize: '12.5px',
                  fontWeight: 700
                }}
              >
                {
                  obsoleta
                    ? '⚠ REVISÃO OBSOLETA — não utilizar. Disponível apenas para consulta do histórico.'
                    : 'Rascunho — esta revisão ainda não está vigente.'
                }
              </div>
            )
          }

          {/* CONTEÚDO */}

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              background: '#F1F5F9'
            }}
          >
            {
              carregando &&
              modo !== 'indisponivel' &&
              (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#64748B',
                    fontSize: '13px',
                    pointerEvents: 'none'
                  }}
                >
                  <strong>Carregando pré-visualização...</strong>
                  <span style={{ fontSize: '12px' }}>
                    Se não aparecer em alguns segundos, use “Abrir em nova aba”.
                  </span>
                </div>
              )
            }

            {
              (modo === 'office' || modo === 'iframe') &&
              (
                <iframe
                  title={`Pré-visualização de ${titulo}`}
                  src={src}
                  onLoad={fimCarregamento}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    border: 0,
                    background: 'transparent'
                  }}
                />
              )
            }

            {
              modo === 'imagem' &&
              (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src={src}
                    alt={titulo}
                    onLoad={fimCarregamento}
                    onError={fimCarregamento}
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                </div>
              )
            }

            {
              modo === 'video' &&
              (
                <video
                  src={src}
                  controls
                  onLoadedData={fimCarregamento}
                  onError={fimCarregamento}
                  style={{ width: '100%', height: '100%', background: '#000' }}
                />
              )
            }

            {
              modo === 'indisponivel' &&
              (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: '#475569',
                    textAlign: 'center',
                    padding: '20px'
                  }}
                >
                  <strong style={{ fontSize: '15px', color: COR_AZUL }}>
                    Pré-visualização não disponível para este tipo de arquivo
                  </strong>
                  <span style={{ fontSize: '13px' }}>
                    Arquivos .{extensaoArquivo(url) || '?'} precisam ser abertos no aplicativo correspondente.
                  </span>
                </div>
              )
            }

            {
              // Marca d'água sobre revisão obsoleta
              obsoleta &&
              (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    overflow: 'hidden'
                  }}
                >
                  <span
                    style={{
                      transform: 'rotate(-28deg)',
                      color: 'rgba(180,35,24,.16)',
                      fontSize: '96px',
                      fontWeight: 900,
                      letterSpacing: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    OBSOLETA
                  </span>
                </div>
              )
            }
          </div>
        </div>
      </div>
    );
  };

export default PreviaDocumentoModal;
