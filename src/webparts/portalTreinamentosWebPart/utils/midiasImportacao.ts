import {
  IModuloImportJson
} from '../services/ImportacaoJsonEtapasService';

// ============================================================
// IMAGENS REFERENCIADAS NO JSON DE IMPORTAÇÃO
//
// No JSON, uma imagem que ainda não está no SharePoint é indicada
// pelo nome do arquivo com o prefixo "midia:":
//
//   { "tipo": "Imagem", "titulo": "Fluxo", "url": "midia:fluxo.png" }
//   "conteudoHtml": "<p>Veja:</p><img src=\"midia:tela-01.png\" alt=\"...\">"
//
// Na importação, o portal pede esses arquivos (soltos ou num .zip),
// envia cada um para "Midias de Treinamento" e troca a referência
// pelo endereço definitivo antes de gravar.
// ============================================================

export const PREFIXO_MIDIA = 'midia:';

const REGEX_HTML =
  /(src\s*=\s*["'])midia:([^"']+)(["'])/gi;

// "imagens/Fluxo do Processo.PNG" → "fluxo do processo.png"
export const normalizarNomeMidia = (
  nome: string
): string => {

  let valor =
    (nome || '').trim();

  try {
    valor = decodeURIComponent(valor);
  } catch {
    // mantém como veio
  }

  const partes =
    valor.split(/[\\/]/);

  return partes[partes.length - 1].trim().toLowerCase();
};

export const ehReferenciaMidia = (
  valor?: string
): boolean =>
  (valor || '').trim().toLowerCase().indexOf(PREFIXO_MIDIA) === 0;

export interface IReferenciaMidia {
  // Nome como aparece no JSON (para mostrar).
  nome: string;
  // Nome normalizado (para casar com os arquivos).
  chave: string;
  // Onde aparece (ex.: "Módulo 1 · Fluxo do processo").
  usos: string[];
}

export const extrairReferenciasMidia = (
  dados: IModuloImportJson | undefined
): IReferenciaMidia[] => {

  const mapa: Record<string, IReferenciaMidia> = {};

  const registrar = (nome: string, uso: string): void => {
    const chave = normalizarNomeMidia(nome);
    if (!chave) {
      return;
    }
    if (!mapa[chave]) {
      mapa[chave] = { nome: nome.split(/[\\/]/).pop() || nome, chave, usos: [] };
    }
    if (mapa[chave].usos.indexOf(uso) < 0) {
      mapa[chave].usos.push(uso);
    }
  };

  ((dados && dados.modulos) || []).forEach(
    (modulo, indiceModulo) => {
      (modulo.conteudos || []).forEach(
        (conteudo, indiceConteudo) => {

          const uso =
            `Módulo ${indiceModulo + 1} · ${conteudo.titulo || `conteúdo ${indiceConteudo + 1}`}`;

          if (ehReferenciaMidia(conteudo.url)) {
            registrar((conteudo.url || '').trim().substring(PREFIXO_MIDIA.length), uso);
          }

          const html =
            conteudo.conteudoHtml || '';

          let encontrado: RegExpExecArray | null;

          REGEX_HTML.lastIndex = 0;

          while ((encontrado = REGEX_HTML.exec(html)) !== null) {
            registrar(encontrado[2], uso);
          }
        }
      );
    }
  );

  return Object.keys(mapa)
    .map(chave => mapa[chave])
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

// Troca cada "midia:nome" pelo endereço enviado. Devolve uma CÓPIA.
export const substituirReferenciasMidia = (
  dados: IModuloImportJson,
  urlPorChave: Record<string, string>
): IModuloImportJson => {

  const copia =
    JSON.parse(JSON.stringify(dados)) as IModuloImportJson;

  const resolver = (nome: string): string | undefined =>
    urlPorChave[normalizarNomeMidia(nome)];

  copia.modulos.forEach(
    modulo => {
      (modulo.conteudos || []).forEach(
        conteudo => {

          if (ehReferenciaMidia(conteudo.url)) {
            const url = resolver((conteudo.url || '').trim().substring(PREFIXO_MIDIA.length));
            if (url) {
              conteudo.url = url;
            }
          }

          if (conteudo.conteudoHtml) {
            conteudo.conteudoHtml =
              conteudo.conteudoHtml.replace(
                REGEX_HTML,
                (trecho: string, inicio: string, nome: string, fim: string) => {
                  const url = resolver(nome);
                  return url ? `${inicio}${url}${fim}` : trecho;
                }
              );
          }
        }
      );
    }
  );

  return copia;
};
