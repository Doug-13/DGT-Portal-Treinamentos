import * as React from 'react';

// ============================================================
// CÉLULAS DA TABELA DE DOCUMENTOS: Responsável e Prazo
// ============================================================

const DIAS_ALERTA_PRAZO = 30;

const iniciais = (
  nome: string
): string =>
  nome
    .split(/[\s,]+/)
    .filter(parte => !!parte)
    .slice(0, 2)
    .map(parte => parte.charAt(0).toUpperCase())
    .join('');

export const ResponsavelCelula:
  React.FC<{
    nome?: string;
    souEu: boolean;
  }> = ({
    nome,
    souEu
  }) => {

    const valor =
      (nome || '').trim();

    if (!valor || valor === '-') {
      return (
        <span style={{ color: '#94A3B8' }}>
          Não definido
        </span>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px'
        }}
        title={valor}
      >
        <span
          style={{
            width: '26px',
            height: '26px',
            minWidth: '26px',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: souEu ? '#202A44' : '#E8EAF8',
            color: souEu ? '#FFFFFF' : '#485CC7',
            fontSize: '10.5px',
            fontWeight: 800
          }}
        >
          {iniciais(valor)}
        </span>

        <span>
          {valor}
          {
            souEu &&
            (
              <small
                style={{
                  marginLeft: '6px',
                  color: '#05838F',
                  fontWeight: 700
                }}
              >
                (você)
              </small>
            )
          }
        </span>
      </span>
    );
  };

// Diferença em dias entre hoje e "AAAA-MM-DD", sem fuso.
const diasAte = (
  data: string
): number => {

  const alvo =
    new Date(
      Number(data.substring(0, 4)),
      Number(data.substring(5, 7)) - 1,
      Number(data.substring(8, 10))
    );

  const hoje =
    new Date();

  hoje.setHours(0, 0, 0, 0);

  return Math.round(
    (alvo.getTime() - hoje.getTime()) / 86400000
  );
};

export const PrazoCelula:
  React.FC<{
    prazo?: string;
    publicado: boolean;
  }> = ({
    prazo,
    publicado
  }) => {

    if (
      !prazo ||
      !/^\d{4}-\d{2}-\d{2}$/.test(prazo)
    ) {
      return (
        <span
          style={{ color: '#94A3B8' }}
          title={
            publicado
              ? 'Prazo ainda não definido. Ele é calculado automaticamente na próxima publicação de revisão.'
              : 'O prazo é definido quando a revisão for aprovada e publicada.'
          }
        >
          {publicado ? 'Não definido' : 'Após aprovação'}
        </span>
      );
    }

    const dias =
      diasAte(prazo);

    const dataFormatada =
      `${prazo.substring(8, 10)}/${prazo.substring(5, 7)}/${prazo.substring(0, 4)}`;

    const situacao =
      dias < 0
        ? {
          texto: `Vencido há ${Math.abs(dias)} dia(s)`,
          cor: '#B42318',
          fundo: '#FDE7E9'
        }
        : dias <= DIAS_ALERTA_PRAZO
          ? {
            texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`,
            cor: '#B45309',
            fundo: '#FFF4E5'
          }
          : undefined;

    return (
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: '3px'
        }}
      >
        <span>{dataFormatada}</span>

        {
          situacao &&
          (
            <span
              style={{
                width: 'fit-content',
                padding: '1px 7px',
                borderRadius: '8px',
                background: situacao.fundo,
                color: situacao.cor,
                fontSize: '10.5px',
                fontWeight: 700
              }}
            >
              {situacao.texto}
            </span>
          )
        }
      </span>
    );
  };

// ============================================================
// ÍCONE PELO TIPO DE ARQUIVO (extensão do arquivo da revisão)
// ============================================================

interface ITipoArquivo {
  rotulo: string;
  nome: string;
  cor: string;
  fundo: string;
  // Arquivos do Office abrem no navegador (Office Online) com ?web=1
  // em vez de baixar.
  office: boolean;
}

const TIPOS_ARQUIVO: Record<string, ITipoArquivo> = {
  pdf: { rotulo: 'PDF', nome: 'PDF', cor: '#D93025', fundo: '#FDECEA', office: false },
  doc: { rotulo: 'DOC', nome: 'Word', cor: '#185ABD', fundo: '#E8F0FC', office: true },
  xls: { rotulo: 'XLS', nome: 'Excel', cor: '#107C41', fundo: '#E7F5EC', office: true },
  ppt: { rotulo: 'PPT', nome: 'PowerPoint', cor: '#C43E1C', fundo: '#FCEDE8', office: true },
  vsd: { rotulo: 'VSD', nome: 'Visio', cor: '#3955A3', fundo: '#EAEEF8', office: true },
  img: { rotulo: 'IMG', nome: 'Imagem', cor: '#7B3FB8', fundo: '#F3ECFA', office: false },
  vid: { rotulo: 'VID', nome: 'Vídeo', cor: '#B4004E', fundo: '#FBE8F1', office: false },
  txt: { rotulo: 'TXT', nome: 'Texto', cor: '#475569', fundo: '#F1F5F9', office: false },
  zip: { rotulo: 'ZIP', nome: 'Compactado', cor: '#8A6D00', fundo: '#FFF6D6', office: false },
  web: { rotulo: 'WEB', nome: 'Página', cor: '#05838F', fundo: '#E6F9FC', office: false }
};

const EXTENSOES: Record<string, keyof typeof TIPOS_ARQUIVO> = {
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', docm: 'doc', dot: 'doc', dotx: 'doc', rtf: 'doc', odt: 'doc',
  xls: 'xls', xlsx: 'xls', xlsm: 'xls', xlsb: 'xls', csv: 'xls', ods: 'xls',
  ppt: 'ppt', pptx: 'ppt', pptm: 'ppt', pps: 'ppt', ppsx: 'ppt', odp: 'ppt',
  vsd: 'vsd', vsdx: 'vsd', vsdm: 'vsd',
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', bmp: 'img', svg: 'img', webp: 'img',
  mp4: 'vid', mov: 'vid', avi: 'vid', wmv: 'vid', webm: 'vid',
  txt: 'txt', md: 'txt',
  zip: 'zip', rar: 'zip', '7z': 'zip',
  htm: 'web', html: 'web', aspx: 'web'
};

export const extensaoArquivo = (
  url?: string
): string => {

  if (!url) {
    return '';
  }

  let caminho = url.split('?')[0].split('#')[0];

  try {
    caminho = decodeURIComponent(caminho);
  } catch {
    // mantém o caminho original se tiver caractere inválido
  }

  const encontrado =
    caminho.match(/\.([a-z0-9]{1,5})$/i);

  return encontrado
    ? encontrado[1].toLowerCase()
    : '';
};

export const tipoDoArquivo = (
  url?: string
): ITipoArquivo | undefined => {

  const chave =
    EXTENSOES[extensaoArquivo(url)];

  return chave
    ? TIPOS_ARQUIVO[chave]
    : undefined;
};

// Endereço para abrir no navegador (Office Online para Word/Excel/…).
export const urlParaAbrir = (
  url: string
): string => {

  const tipo =
    tipoDoArquivo(url);

  if (
    !tipo ||
    !tipo.office ||
    /[?&]web=1/.test(url)
  ) {
    return url;
  }

  return `${url}${url.indexOf('?') >= 0 ? '&' : '?'}web=1`;
};

export const IconeArquivo:
  React.FC<{
    url?: string;
  }> = ({
    url
  }) => {

    const tipo =
      tipoDoArquivo(url);

    const cor =
      tipo ? tipo.cor : '#94A3B8';

    return (
      <span
        title={
          tipo
            ? `Arquivo ${tipo.nome}`
            : url
              ? 'Arquivo'
              : 'Nenhum arquivo anexado'
        }
        style={{
          width: '30px',
          height: '30px',
          minWidth: '30px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '7px',
          background: tipo ? tipo.fundo : '#F1F5F9'
        }}
      >
        <svg
          width="22"
          height="24"
          viewBox="0 0 22 24"
          aria-hidden="true"
        >
          {/* folha com canto dobrado */}
          <path
            d="M4 1.5h9.5L18.5 6.5V21a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 21V3A1.5 1.5 0 0 1 4 1.5z"
            fill="#FFFFFF"
            stroke={cor}
            strokeWidth="1.3"
          />
          <path
            d="M13.5 1.5V6.5H18.5"
            fill="none"
            stroke={cor}
            strokeWidth="1.3"
          />

          {
            tipo
              ? (
                <>
                  {/* faixa colorida com o tipo */}
                  <rect
                    x="0.5"
                    y="11"
                    width="17"
                    height="8"
                    rx="1.5"
                    fill={cor}
                  />
                  <text
                    x="9"
                    y="17.3"
                    textAnchor="middle"
                    fontSize="6.2"
                    fontWeight="800"
                    fontFamily="Arial, sans-serif"
                    fill="#FFFFFF"
                  >
                    {tipo.rotulo}
                  </text>
                </>
              )
              : (
                <>
                  <line x1="6" y1="11" x2="15" y2="11" stroke={cor} strokeWidth="1.2" />
                  <line x1="6" y1="14.5" x2="15" y2="14.5" stroke={cor} strokeWidth="1.2" />
                  <line x1="6" y1="18" x2="12" y2="18" stroke={cor} strokeWidth="1.2" />
                </>
              )
          }
        </svg>
      </span>
    );
  };
