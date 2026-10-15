import * as React from 'react';

// ============================================================
// ÍCONES DA SELEÇÃO DE KIT (traço, 24×24, herdam a cor do texto)
// ============================================================

export type NomeIconeKit =
  | 'torre'
  | 'mini'
  | 'box'
  | 'portaEletroduto'
  | 'portaDutotec'
  | 'catraca'
  | 'camera'
  | 'placa'
  | 'rede'
  | 'pin'
  | 'kit'
  | 'nuvem'
  | 'servidor'
  | 'mais'
  | 'copiar'
  | 'lixeira'
  | 'check'
  | 'alerta'
  | 'baixar'
  | 'rosto'
  | 'radar'
  | 'chave'
  | 'pessoas';

const CAMINHOS: Record<NomeIconeKit, React.ReactNode> = {
  torre: (<><path d="M12 2v3" /><rect x="8" y="5" width="8" height="5" rx="1" /><path d="M10 10l-2 12h8l-2-12" /><path d="M9 16h6" /></>),
  mini: (<><path d="M4 4h4v16H4z" /><path d="M8 7h10" /><rect x="14" y="7" width="6" height="4" rx="1" /><path d="M8 15h6" /></>),
  box: (<><rect x="4" y="5" width="16" height="12" rx="2" /><circle cx="9" cy="11" r="2" /><circle cx="15" cy="11" r="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>),
  portaEletroduto: (<><rect x="6" y="3" width="12" height="18" rx="1" /><circle cx="15" cy="12" r=".9" fill="currentColor" /><path d="M2 21h20" /></>),
  portaDutotec: (<><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M14 11h2v3h-2z" /><path d="M2 21h20" /><path d="M3 3v18" /></>),
  catraca: (<><rect x="9" y="4" width="6" height="16" rx="1" /><path d="M15 9h6" /><path d="M15 12h5" /><path d="M15 15h4" /><path d="M5 20h14" /></>),
  camera: (<><path d="M3 8h11l3-2v10l-3-2H3z" /><circle cx="8" cy="11" r="2" /><path d="M7 14v5h4" /></>),
  placa: (<><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 12h2" /><path d="M11 12h2" /><path d="M15 12h2" /></>),
  rede: (<><rect x="3" y="14" width="18" height="6" rx="1" /><path d="M7 17h.01" /><path d="M11 17h.01" /><path d="M12 14V8" /><path d="M8 4h8v4H8z" /></>),
  pin: (<><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  kit: (<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5" /><path d="M12 12v9" /><path d="M12 12L4 7.5" /></>),
  nuvem: (<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z" />),
  servidor: (<><rect x="4" y="3" width="16" height="7" rx="1" /><rect x="4" y="14" width="16" height="7" rx="1" /><path d="M8 6.5h.01" /><path d="M8 17.5h.01" /></>),
  mais: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  copiar: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>),
  lixeira: (<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>),
  check: (<polyline points="5 12 10 17 19 7" />),
  alerta: (<><path d="M12 3l10 18H2z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>),
  baixar: (<><path d="M12 4v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 20h14" /></>),
  rosto: (<><circle cx="12" cy="11" r="6" /><path d="M9.5 10h.01" /><path d="M14.5 10h.01" /><path d="M10 13.5c1.2 1 2.8 1 4 0" /><path d="M3 7V4h3" /><path d="M21 7V4h-3" /><path d="M3 17v3h3" /><path d="M21 17v3h-3" /></>),
  radar: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12l6-6" /></>),
  chave: (<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9" /><path d="M17 6l3 3" /></>),
  pessoas: (<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15 15a5 5 0 0 1 6 5" /></>)
};

export const IconeKit: React.FC<{ nome: NomeIconeKit; tamanho?: number; cor?: string }> = ({ nome, tamanho = 18, cor }) => (
  <svg
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke={cor || 'currentColor'}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    {CAMINHOS[nome]}
  </svg>
);
