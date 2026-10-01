/* eslint-disable */
// ============================================================
// CONTROLE DE VERSÃO DO PORTAL
//
// Uso:
//   Para gerar uma VERSÃO, use o Gerar-Versao.ps1 (raiz do projeto).
//   Builds comuns (npm run build / npx heft build) não mudam a versão.
//
//   node scripts/versao.js patch   → 1.0.4 → 1.0.5
//   node scripts/versao.js minor   → 1.0.4 → 1.1.0
//   node scripts/versao.js major   → 1.0.4 → 2.0.0
//   node scripts/versao.js none    → não muda o número; só atualiza versao.ts
//
// O que ele faz:
//   1. Calcula a nova versão (fonte: package.json).
//   2. Atualiza package.json e config/package-solution.json
//      (solution.version e features[].version = X.Y.Z.0). Sem isso o
//      SharePoint pode continuar servindo o pacote antigo.
//   3. Move os itens de "## [Não publicado]" do CHANGELOG.md para uma
//      nova seção "## [X.Y.Z] - AAAA-MM-DD".
//   4. Gera src/.../constants/versao.ts, lido pelo portal para mostrar
//      o número da versão e a tela de Novidades.
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const ARQ_PACKAGE = path.join(RAIZ, 'package.json');
const ARQ_SOLUCAO = path.join(RAIZ, 'config', 'package-solution.json');
const ARQ_CHANGELOG = path.join(RAIZ, 'CHANGELOG.md');
const ARQ_VERSAO_TS = path.join(RAIZ, 'src', 'webparts', 'portalTreinamentosWebPart', 'constants', 'versao.ts');

const SECAO_PENDENTE = '## [Não publicado]';
const MAX_VERSOES_NO_PORTAL = 15;

const tipo = (process.argv[2] || 'patch').toLowerCase();

if (['patch', 'minor', 'major', 'none'].indexOf(tipo) < 0) {
  console.error(`Tipo inválido: "${tipo}". Use patch, minor, major ou none.`);
  process.exit(1);
}

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

const lerJson = arquivo => JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, ''));

const gravarJson = (arquivo, objeto) =>
  fs.writeFileSync(arquivo, JSON.stringify(objeto, null, 2) + '\n', 'utf8');

const partes = versao =>
  String(versao || '0.0.0')
    .split('.')
    .slice(0, 3)
    .map(n => parseInt(n, 10) || 0)
    .concat([0, 0, 0])
    .slice(0, 3);

const comparar = (a, b) => {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};

const hoje = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const commitAtual = () => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (e) {
    return '';
  }
};

// ------------------------------------------------------------
// 1. Nova versão
// ------------------------------------------------------------

const pacote = lerJson(ARQ_PACKAGE);
const solucao = lerJson(ARQ_SOLUCAO);

// Começa do maior valor entre package.json e package-solution.json
// (na primeira execução o package.json ainda está em 0.0.1).
let atual = partes(pacote.version);
const daSolucao = partes(solucao.solution && solucao.solution.version);

if (comparar(daSolucao, atual) > 0) {
  atual = daSolucao;
}

let nova = atual.slice();

if (tipo === 'major') nova = [atual[0] + 1, 0, 0];
if (tipo === 'minor') nova = [atual[0], atual[1] + 1, 0];
if (tipo === 'patch') nova = [atual[0], atual[1], atual[2] + 1];

const versao = nova.join('.');
const versaoSolucao = `${versao}.0`;

// ------------------------------------------------------------
// 2. package.json e package-solution.json
// ------------------------------------------------------------

if (tipo !== 'none') {
  pacote.version = versao;
  gravarJson(ARQ_PACKAGE, pacote);

  solucao.solution.version = versaoSolucao;
  (solucao.solution.features || []).forEach(feature => {
    feature.version = versaoSolucao;
  });
  gravarJson(ARQ_SOLUCAO, solucao);
}

// ------------------------------------------------------------
// 3. CHANGELOG.md
// ------------------------------------------------------------

const CABECALHO_CHANGELOG =
  '# Histórico de versões do Portal DGT\n\n' +
  'Anote as mudanças em "Não publicado" enquanto desenvolve, uma por linha,\n' +
  'começando por "- Novo:", "- Melhoria:" ou "- Correção:". No próximo\n' +
  '`Gerar-Versao.ps1` elas passam para a nova versão e aparecem em "Novidades".\n\n';

let changelog = fs.existsSync(ARQ_CHANGELOG)
  ? fs.readFileSync(ARQ_CHANGELOG, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  : CABECALHO_CHANGELOG + SECAO_PENDENTE + '\n\n';

if (changelog.indexOf(SECAO_PENDENTE) < 0) {
  const primeiraVersao = changelog.search(/^## \[/m);
  changelog = primeiraVersao >= 0
    ? changelog.slice(0, primeiraVersao) + SECAO_PENDENTE + '\n\n' + changelog.slice(primeiraVersao)
    : changelog.trimEnd() + '\n\n' + SECAO_PENDENTE + '\n\n';
}

if (tipo !== 'none') {
  const inicio = changelog.indexOf(SECAO_PENDENTE) + SECAO_PENDENTE.length;
  const resto = changelog.slice(inicio);
  const proxima = resto.search(/^## \[/m);
  const pendente = (proxima >= 0 ? resto.slice(0, proxima) : resto).trim();
  const depois = proxima >= 0 ? resto.slice(proxima) : '';

  const itens = pendente
    ? pendente
    : '- Melhoria: ajustes e correções internas.';

  changelog =
    changelog.slice(0, inicio) +
    '\n\n' +
    `## [${versao}] - ${hoje()}\n\n` +
    itens.trim() + '\n\n' +
    depois;

  changelog = changelog.replace(/\n{3,}/g, '\n\n');
}

fs.writeFileSync(ARQ_CHANGELOG, changelog, 'utf8');

// ------------------------------------------------------------
// 4. versao.ts (lido pelo portal)
// ------------------------------------------------------------

const TIPOS = {
  novo: 'Novo',
  nova: 'Novo',
  melhoria: 'Melhoria',
  correcao: 'Correção',
  'correção': 'Correção',
  ajuste: 'Melhoria'
};

const novidades = [];
const regexSecao = /^## \[(\d+\.\d+\.\d+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/gm;
let m;
const secoes = [];

while ((m = regexSecao.exec(changelog)) !== null) {
  secoes.push({ versao: m[1], data: m[2] || '', inicio: regexSecao.lastIndex, cabecalho: m.index });
}

secoes.forEach((secao, i) => {
  const fim = i + 1 < secoes.length ? secoes[i + 1].cabecalho : changelog.length;
  const corpo = changelog.slice(secao.inicio, fim);

  // Para no próximo cabeçalho de outro tipo (ex.: "## [Não publicado]").
  const corte = corpo.search(/^## /m);
  const texto = corte >= 0 ? corpo.slice(0, corte) : corpo;

  const itens = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[-*]\s+/.test(l))
    .map(l => {
      const conteudo = l.replace(/^[-*]\s+/, '');
      const t = conteudo.match(/^([A-Za-zÀ-ú]+)\s*:\s*(.+)$/);
      const chave = t ? t[1].toLowerCase() : '';
      return TIPOS[chave]
        ? { tipo: TIPOS[chave], texto: t[2].trim() }
        : { tipo: 'Melhoria', texto: conteudo };
    });

  novidades.push({ versao: secao.versao, data: secao.data, itens });
});

novidades.sort((a, b) => comparar(partes(b.versao), partes(a.versao)));

const conteudoTs =
`// ============================================================
// ARQUIVO GERADO AUTOMATICAMENTE por scripts/versao.js
// Não edite à mão: anote as mudanças em CHANGELOG.md
// ("## [Não publicado]") e rode npm run build.
// ============================================================

export type TipoNovidade = 'Novo' | 'Melhoria' | 'Correção';

export interface INovidadeItem {
  tipo: TipoNovidade;
  texto: string;
}

export interface INovidadeVersao {
  versao: string;
  data: string;
  itens: INovidadeItem[];
}

export const VERSAO_PORTAL = ${JSON.stringify(versao)};

export const VERSAO_SOLUCAO = ${JSON.stringify(tipo === 'none' ? (solucao.solution.version || versaoSolucao) : versaoSolucao)};

export const DATA_BUILD = ${JSON.stringify(new Date().toISOString())};

export const COMMIT_BUILD = ${JSON.stringify(commitAtual())};

export const NOVIDADES: INovidadeVersao[] = ${JSON.stringify(novidades.slice(0, MAX_VERSOES_NO_PORTAL), null, 2)};
`;

fs.writeFileSync(ARQ_VERSAO_TS, conteudoTs, 'utf8');

// ------------------------------------------------------------
// Resumo
// ------------------------------------------------------------

console.log('');
console.log(tipo === 'none'
  ? `  Versão mantida: ${versao} (versao.ts atualizado)`
  : `  Versão do portal: ${atual.join('.')} → ${versao}  (pacote SharePoint ${versaoSolucao})`);
console.log(`  Novidades publicadas no portal: ${Math.min(novidades.length, MAX_VERSOES_NO_PORTAL)} versão(ões)`);
console.log('');
