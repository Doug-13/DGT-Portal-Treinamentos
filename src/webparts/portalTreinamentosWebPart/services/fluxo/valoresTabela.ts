import {
  IColunaTabela
} from '../../models/Fluxo';

// ============================================================
// VALORES DE METADADOS DO TIPO TABELA
//
// O valor de um campo tabela é guardado como texto JSON: uma lista
// de linhas, cada linha um objeto { chaveDaColuna: valor }.
//   [{"item":"Parafuso","quantidade":"10"}, ...]
// ============================================================

export type LinhaTabela = Record<string, string>;

export const lerLinhasTabela = (
  valor: string | undefined
): LinhaTabela[] => {

  if (!valor) {
    return [];
  }

  try {
    const dados =
      JSON.parse(valor) as unknown;

    if (!Array.isArray(dados)) {
      return [];
    }

    return dados
      .filter(linha => !!linha && typeof linha === 'object')
      .map(
        linha => {
          const resultado: LinhaTabela = {};

          Object.keys(linha as Record<string, unknown>).forEach(
            chave => {
              const celula = (linha as Record<string, unknown>)[chave];
              resultado[chave] = celula === undefined || celula === null ? '' : String(celula);
            }
          );

          return resultado;
        }
      );
  } catch {
    return [];
  }
};

export const gravarLinhasTabela = (
  linhas: LinhaTabela[]
): string =>
  linhas.length === 0
    ? ''
    : JSON.stringify(linhas);

// Linha sem nenhum valor preenchido não conta.
export const linhasPreenchidas = (
  linhas: LinhaTabela[]
): LinhaTabela[] =>
  linhas.filter(
    linha => Object.keys(linha).some(chave => (linha[chave] || '').trim() !== '')
  );

export const validarCelula = (
  coluna: IColunaTabela,
  valor: string
): string | undefined => {

  const texto =
    (valor || '').trim();

  if (!texto) {
    return coluna.obrigatoria
      ? `preencha "${coluna.rotulo}"`
      : undefined;
  }

  if (coluna.tipo === 'numero' && Number.isNaN(Number(texto.replace(',', '.')))) {
    return `"${coluna.rotulo}" precisa ser um número`;
  }

  if (coluna.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return `"${coluna.rotulo}" precisa ser uma data`;
  }

  if (coluna.tipo === 'lista' && coluna.opcoes && coluna.opcoes.indexOf(texto) < 0) {
    return `"${coluna.rotulo}" precisa ser uma das opções`;
  }

  if (coluna.tipo === 'simNao' && texto !== 'sim' && texto !== 'nao') {
    return `"${coluna.rotulo}" precisa ser Sim ou Não`;
  }

  return undefined;
};

export const validarTabela = (
  rotulo: string,
  colunas: IColunaTabela[],
  valor: string,
  obrigatorio: boolean
): string[] => {

  const erros: string[] = [];

  const linhas =
    linhasPreenchidas(lerLinhasTabela(valor));

  if (obrigatorio && linhas.length === 0) {
    erros.push(`Adicione pelo menos uma linha em "${rotulo}".`);
  }

  linhas.forEach(
    (linha, indice) => {
      colunas.forEach(
        coluna => {
          const erro =
            validarCelula(coluna, linha[coluna.chave] || '');

          if (erro) {
            erros.push(`${rotulo}, linha ${indice + 1}: ${erro}.`);
          }
        }
      );
    }
  );

  return erros;
};

export const formatarCelula = (
  coluna: IColunaTabela,
  valor: string
): string => {

  if (!valor) {
    return '';
  }

  if (coluna.tipo === 'simNao') {
    return valor === 'sim' ? 'Sim' : 'Não';
  }

  if (coluna.tipo === 'data') {
    const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
  }

  return valor;
};

export const resumoTabela = (
  valor: string
): string => {

  const quantidade =
    linhasPreenchidas(lerLinhasTabela(valor)).length;

  return quantidade === 0
    ? ''
    : `${quantidade} linha${quantidade === 1 ? '' : 's'}`;
};
