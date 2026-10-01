/* eslint-disable */
// ============================================================
// Gera components/fluxo/bpmn/estilosBpmn.ts a partir dos CSS do
// bpmn-js instalado em node_modules.
//
// Por quê: importar os .css do bpmn-js pelo webpack do SPFx quebra
// o "npm run start" (erro ___CSS_LOADER_URL_REPLACEMENT___), porque
// esses arquivos apontam para fontes em pastas relativas. Aqui o CSS
// vira um texto, sem essas referências (a fonte embutida em base64
// é mantida), e o editor injeta esse texto na página.
//
// Rode de novo SOMENTE se atualizar a versão do bpmn-js:
//   node scripts/gerar-estilos-bpmn.js
// ============================================================
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const assets = path.join(raiz, 'node_modules', 'bpmn-js', 'dist', 'assets');
const versao = require(path.join(raiz, 'node_modules', 'bpmn-js', 'package.json')).version;

const ler = (arquivo) => fs.readFileSync(path.join(assets, arquivo), 'utf8');

// Remove blocos @font-face que dependem de arquivos ../font/*
const semFontesRelativas = (css) =>
  css.replace(/@font-face\s*\{[^}]*\.\.\/font\/[^}]*\}/g, '');

const css = [
  ler('diagram-js.css'),
  ler('bpmn-js.css'),
  semFontesRelativas(ler('bpmn-font/css/bpmn-embedded.css'))
].join('\n');

if (/url\(\s*['"]?\.\.?\//.test(css)) {
  console.error('Ainda há url() relativa no CSS gerado. Verifique o script.');
  process.exit(1);
}

const destino = path.join(raiz, 'src', 'webparts', 'portalTreinamentosWebPart', 'components', 'fluxo', 'bpmn', 'estilosBpmn.ts');

fs.writeFileSync(
  destino,
  [
    '/* eslint-disable */',
    '// ARQUIVO GERADO por scripts/gerar-estilos-bpmn.js — não edite à mão.',
    `// Estilos do bpmn-js ${versao} (diagram-js.css, bpmn-js.css, bpmn-embedded.css).`,
    `export const VERSAO_ESTILOS_BPMN = ${JSON.stringify(versao)};`,
    `export const ESTILOS_BPMN: string = ${JSON.stringify(css)};`,
    ''
  ].join('\n'),
  'utf8'
);

console.log(`Gerado ${path.relative(raiz, destino)} (${css.length} caracteres, bpmn-js ${versao}).`);
