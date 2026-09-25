import * as React from 'react';

// ============================================================
// Ícones SVG inline compartilhados (sem depender de fonte de
// ícone nem de glifos Unicode — que é a causa de ícones somem
// ou aparecem monocromáticos em vários pontos do portal).
// Cada ícone herda a cor via `currentColor`, então basta
// definir `color` no elemento pai (ou `style={{ color }}`).
// ============================================================

const base:
  React.SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

export type IconeChave =
  | 'home'
  | 'play'
  | 'layers'
  | 'clock'
  | 'hourglass'
  | 'award'
  | 'users'
  | 'checkCircle'
  | 'settings'
  | 'graduationCap'
  | 'alertTriangle'
  | 'fileText'
  | 'filePlus'
  | 'folder'
  | 'bell'
  | 'barChart';

export const Icones:
  Record<IconeChave, React.FC> = {

  home: () => (
    <svg {...base}>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
      <line x1="10" y1="20" x2="10" y2="14" />
      <line x1="14" y1="20" x2="14" y2="14" />
    </svg>
  ),

  play: () => (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="10 8.5 16 12 10 15.5" fill="currentColor" stroke="none" />
    </svg>
  ),

  layers: () => (
    <svg {...base}>
      <polygon points="12 3 21 8 12 13 3 8 12 3" />
      <polyline points="3 13 12 18 21 13" />
      <polyline points="3 17.5 12 22.5 21 17.5" />
    </svg>
  ),

  clock: () => (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  ),

  hourglass: () => (
    <svg {...base}>
      <path d="M6.5 3.5h11" />
      <path d="M6.5 20.5h11" />
      <path d="M7.5 3.5c0 4 3 5.2 4.5 6.5-1.5 1.3-4.5 2.5-4.5 6.5" />
      <path d="M16.5 3.5c0 4-3 5.2-4.5 6.5 1.5 1.3 4.5 2.5 4.5 6.5" />
    </svg>
  ),

  award: () => (
    <svg {...base}>
      <circle cx="12" cy="8.5" r="5.2" />
      <polyline points="12 5.8 12.8 7.4 14.6 7.6 13.3 8.9 13.6 10.6 12 9.8 10.4 10.6 10.7 8.9 9.4 7.6 11.2 7.4" fill="currentColor" stroke="none" />
      <path d="M9 13l-1.8 7 4.8-2.6 4.8 2.6-1.8-7" />
    </svg>
  ),

  users: () => (
    <svg {...base}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 14.6c2.9.4 5.3 2.3 5.3 5.4" />
    </svg>
  ),

  checkCircle: () => (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  ),

  settings: () => (
    <svg {...base}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),

  graduationCap: () => (
    <svg {...base}>
      <polygon points="12 4 22 9 12 14 2 9 12 4" />
      <path d="M7 11v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5" />
      <line x1="21" y1="9" x2="21" y2="16" />
    </svg>
  ),

  alertTriangle: () => (
    <svg {...base}>
      <path d="M12 3.5l9.5 16.5H2.5z" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),

  fileText: () => (
    <svg {...base}>
      <path d="M7 3h7l4 4v14H7z" />
      <polyline points="14 3 14 7 18 7" />
      <line x1="9.5" y1="12" x2="15.5" y2="12" />
      <line x1="9.5" y1="15.5" x2="15.5" y2="15.5" />
    </svg>
  ),

  filePlus: () => (
    <svg {...base}>
      <path d="M7 3h7l4 4v14H7z" />
      <polyline points="14 3 14 7 18 7" />
      <line x1="12.5" y1="11" x2="12.5" y2="17" />
      <line x1="9.5" y1="14" x2="15.5" y2="14" />
    </svg>
  ),

  folder: () => (
    <svg {...base}>
      <path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9a1.5 1.5 0 0 0-1.5-1.5H12L10 5H4.5A1.5 1.5 0 0 0 3 6.5z" />
    </svg>
  ),

  bell: () => (
    <svg {...base}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  ),

  barChart: () => (
    <svg {...base}>
      <line x1="5" y1="20" x2="19" y2="20" />
      <rect x="6.5" y="13" width="3" height="7" />
      <rect x="11" y="9" width="3" height="11" />
      <rect x="15.5" y="5" width="3" height="15" />
    </svg>
  )
};

export default Icones;
