import {
  ILinhaServidor,
  OpcaoServidor,
  SOFTWARES_SERVIDOR,
  SoftwareServidor,
  chaveServidor,
  normalizarLinha
} from './catalogoServidores';

// ============================================================
// SERVIDORES — PLANILHA (CSV) ⇄ LINHAS DO MEMORIAL
//
// Para carregar a planilha "Servidores — Consolidado Memoriais de
// Cálculo": baixe o modelo na aba Kits → Servidores (vem com as 43
// linhas e o que já está gravado), preencha a partir da planilha e
// importe. A linha é casada pela coluna "chave" (SRV-DGF-070-A).
//
// Listas (processadores, GPUs, SOs) separadas por " | ".
// Licenças: "DGFEN1008V7=2 | DGFEN1164V7=1".
// Separador do CSV: ";" (padrão do Excel em pt-BR) ou ",".
// ============================================================

export const COLUNAS_PLANILHA = [
  'chave', 'software', 'capacidade', 'opcao', 'codigo_cigam', 'ativo', 'qtd_servidores',
  'processadores', 'ram', 'disco_so', 'armaz_servidor_tb', 'armaz_total_tb', 'discos_qtd',
  'disco_tamanho_tb', 'arranjo', 'gpus', 'sistemas', 'compressao_ref', 'iops',
  'rede_cameras_mbps', 'versao_memorial', 'codigo_disco', 'codigo_so', 'licencas'
];

const num = (n: number): string => (n ? String(n).replace('.', ',') : '');

const escapar = (valor: string): string =>
  /[;",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

export const csvDasLinhas = (linhas: ILinhaServidor[]): string => {
  const corpo = linhas.map(l => [
    l.chave, l.software, String(l.capacidade), l.opcao, l.codigoCigam, l.ativo ? 'sim' : 'nao', num(l.qtdServidores),
    l.processadores.join(' | '), l.ram, l.discoSo, num(l.armazServidorTb), num(l.armazTotalTb), num(l.discosQtd),
    num(l.discoTamanhoTb), l.arranjo, l.gpus.join(' | '), l.sistemas.join(' | '), l.compressaoRef, l.iops,
    l.redeMbps, l.versaoMemorial, l.codigoDisco, l.codigoSo, l.licencas.map(x => `${x.codigo}=${x.qtd}`).join(' | ')
  ].map(escapar).join(';'));
  return [COLUNAS_PLANILHA.join(';')].concat(corpo).join('\r\n');
};

// Parser de CSV com aspas (campos com separador ou quebra de linha).
export const lerCsv = (texto: string): string[][] => {
  const limpo = texto.replace(/^\ufeff/, '');
  const primeira = limpo.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') { aspas = false; } else { campo += c; }
    } else if (c === '"') {
      aspas = true;
    } else if (c === sep) {
      linha.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') { i++; }
      linha.push(campo); campo = '';
      if (linha.some(v => v.trim() !== '')) { linhas.push(linha); }
      linha = [];
    } else {
      campo += c;
    }
  }
  linha.push(campo);
  if (linha.some(v => v.trim() !== '')) { linhas.push(linha); }
  return linhas;
};

export interface IResultadoImportacao {
  linhas: ILinhaServidor[];
  novas: string[];
  alteradas: string[];
  erros: string[];
}

const lista = (v: string): string[] => v.split('|').map(x => x.trim()).filter(Boolean);
const numero = (v: string): number => {
  const n = Number(String(v || '').replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Lê o CSV e devolve as linhas prontas para gravar, a partir das
// atuais (o que a planilha não traz fica como está).
export const linhasDoCsv = (texto: string, atuais: ILinhaServidor[]): IResultadoImportacao => {
  const tabela = lerCsv(texto);
  const resultado: IResultadoImportacao = { linhas: [], novas: [], alteradas: [], erros: [] };
  if (tabela.length < 2) {
    resultado.erros.push('A planilha não tem linhas de dados.');
    return resultado;
  }
  const cab = tabela[0].map(c => c.trim().toLowerCase());
  const col = (nome: string): number => cab.indexOf(nome);
  if (col('chave') < 0 && (col('software') < 0 || col('capacidade') < 0)) {
    resultado.erros.push('Faltam as colunas "chave" ou "software" + "capacidade". Use o modelo baixado nesta tela.');
    return resultado;
  }

  tabela.slice(1).forEach((valores, i) => {
    const v = (nome: string): string | undefined => (col(nome) >= 0 ? (valores[col(nome)] || '').trim() : undefined);
    const software = (v('software') || '').toLowerCase() as SoftwareServidor;
    const capacidade = numero(v('capacidade') || '');
    const opcao = ((v('opcao') || '').toUpperCase()) as OpcaoServidor;
    const chave = v('chave') || (SOFTWARES_SERVIDOR.indexOf(software) >= 0 && capacidade > 0 ? chaveServidor(software, capacidade, opcao) : '');
    if (!chave) {
      resultado.erros.push(`Linha ${i + 2}: sem chave e sem software/capacidade válidos.`);
      return;
    }
    const atual = atuais.filter(l => l.chave === chave)[0];
    if (!atual && (SOFTWARES_SERVIDOR.indexOf(software) < 0 || !(capacidade > 0))) {
      resultado.erros.push(`Linha ${i + 2} (${chave}): linha nova precisa de software (digifort, milestone ou ipx) e capacidade.`);
      return;
    }
    const base: Partial<ILinhaServidor> = atual ? { ...atual } : { software, capacidade, opcao };
    const texto2 = (nome: string, campo: keyof ILinhaServidor): void => {
      const x = v(nome);
      if (x !== undefined) { (base as Record<string, unknown>)[campo] = x; }
    };
    const num2 = (nome: string, campo: keyof ILinhaServidor): void => {
      const x = v(nome);
      if (x !== undefined) { (base as Record<string, unknown>)[campo] = numero(x); }
    };
    const lista2 = (nome: string, campo: keyof ILinhaServidor): void => {
      const x = v(nome);
      if (x !== undefined) { (base as Record<string, unknown>)[campo] = lista(x); }
    };
    num2('qtd_servidores', 'qtdServidores');
    lista2('processadores', 'processadores');
    texto2('ram', 'ram');
    texto2('disco_so', 'discoSo');
    num2('armaz_servidor_tb', 'armazServidorTb');
    num2('armaz_total_tb', 'armazTotalTb');
    num2('discos_qtd', 'discosQtd');
    num2('disco_tamanho_tb', 'discoTamanhoTb');
    texto2('arranjo', 'arranjo');
    lista2('gpus', 'gpus');
    lista2('sistemas', 'sistemas');
    texto2('compressao_ref', 'compressaoRef');
    texto2('iops', 'iops');
    texto2('rede_cameras_mbps', 'redeMbps');
    texto2('versao_memorial', 'versaoMemorial');
    texto2('codigo_disco', 'codigoDisco');
    texto2('codigo_so', 'codigoSo');
    const lic = v('licencas');
    if (lic !== undefined) {
      base.licencas = lista(lic).map(par => {
        const [codigo, qtd] = par.split('=');
        return { codigo: (codigo || '').trim().toUpperCase(), qtd: numero(qtd || '1') || 1 };
      }).filter(l => l.codigo);
    }
    const codigo = v('codigo_cigam') !== undefined ? (v('codigo_cigam') as string) : atual ? atual.codigoCigam : '';
    const ativoTxt = (v('ativo') || '').toLowerCase();
    const ativo = ativoTxt ? !/^(n|nao|não|0|false)$/.test(ativoTxt) : atual ? atual.ativo : true;

    const linha = normalizarLinha(base, chave, codigo, ativo);
    if (atual && JSON.stringify(atual) === JSON.stringify(linha)) {
      return;
    }
    resultado.linhas.push(linha);
    (atual ? resultado.alteradas : resultado.novas).push(chave);
  });

  return resultado;
};
