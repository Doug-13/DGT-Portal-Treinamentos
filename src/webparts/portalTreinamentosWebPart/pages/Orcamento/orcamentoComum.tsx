import * as React from 'react';

import {
  ILinhaOrcamento,
  arredondar
} from '../../services/orcamento/OrcamentoService';

import {
  CENARIO_EXECUTADO,
  CENARIO_ORCADO,
  NOMES_MESES,
  StatusPlanilha
} from '../../services/orcamento/esquemaOrcamento';

import {
  CONTAS_MAE,
  GRUPOS_ORCAMENTO,
  PLANO_CONTAS,
  termoExibido
} from '../../services/orcamento/planoContasOrcamento';

import {
  ITENS_DRE,
  calcularDre,
  sinalDaConta,
  totalAnualDre,
  valoresComSinal
} from '../../services/orcamento/dreOrcamento';

// ============================================================
// PLANEJAMENTO ORÇAMENTÁRIO — ELEMENTOS VISUAIS E UTILITÁRIOS
// (cores da identidade visual DGT: azul 202A44, ciano 05C3DD)
// ============================================================

export const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  azulAcao: '#0877c9',
  texto2: '#64748b',
  borda: '#E5E7EB',
  fundo: '#F7F9FB',
  fundoGrupo: '#EEF6FA',
  alterado: '#FFF8E1',
  perigo: '#B42318'
};

export const FONTE = "Barlow, Arial, 'Segoe UI', sans-serif";

// Zoom da tela do orçamento (a tela abre sempre em 80%).
export const ZOOM_TELA = 0.8;

// Raiz da tela: aplica o zoom e impede que a largura da tabela
// "empurre" o layout do portal (o menu lateral não se move; quem rola
// para o lado é só a caixa da tabela).
export const estiloRaizTela: React.CSSProperties = {
  zoom: ZOOM_TELA,
  fontFamily: FONTE,
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  contain: 'inline-size',
  boxSizing: 'border-box'
};

export const cartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  padding: '18px 20px',
  marginBottom: '16px'
};

export const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '6px',
  fontSize: '13.5px',
  fontFamily: FONTE,
  color: COR.azul,
  background: '#FFFFFF'
};

export const botao = (
  tipo: 'principal' | 'secundario' | 'perigo' = 'principal',
  desabilitado = false
): React.CSSProperties => ({
  minHeight: '36px',
  padding: '0 16px',
  borderRadius: '6px',
  border: tipo === 'secundario' ? `1px solid ${COR.borda}` : 0,
  background: tipo === 'principal' ? COR.azulAcao : tipo === 'perigo' ? COR.perigo : '#FFFFFF',
  color: tipo === 'secundario' ? COR.azul : '#FFFFFF',
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.5 : 1,
  whiteSpace: 'nowrap',
  fontFamily: FONTE
});

export const estiloAba = (
  ativa: boolean
): React.CSSProperties => ({
  padding: '10px 16px',
  border: 0,
  borderBottom: `3px solid ${ativa ? COR.ciano : 'transparent'}`,
  background: 'transparent',
  color: ativa ? COR.azul : COR.texto2,
  fontWeight: ativa ? 700 : 500,
  fontSize: '14px',
  cursor: 'pointer',
  fontFamily: FONTE,
  whiteSpace: 'nowrap'
});

export const CORES_STATUS: Record<StatusPlanilha, { cor: string; fundo: string }> = {
  'Em preenchimento': { cor: '#B45309', fundo: '#FFF4E5' },
  Enviada: { cor: '#107C10', fundo: '#E7F6EC' },
  'Em aprovação': { cor: '#0F4C81', fundo: '#E8F2FF' },
  Aprovada: { cor: '#FFFFFF', fundo: '#107C10' },
  'Devolvida para ajuste': { cor: '#B42318', fundo: '#FDE7E9' }
};

export const Selo: React.FC<{ texto: string; cor: string; fundo: string }> = ({ texto, cor, fundo }) => (
  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', background: fundo, color: cor, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
    {texto}
  </span>
);

export const SeloStatus: React.FC<{ status: StatusPlanilha }> = ({ status }) => (
  <Selo texto={status} cor={CORES_STATUS[status].cor} fundo={CORES_STATUS[status].fundo} />
);

// Cartão de número (resumo no topo).
export const CartaoNumero: React.FC<{ titulo: string; valor: string; detalhe?: string }> = ({ titulo, valor, detalhe }) => (
  <div style={{ ...cartao, marginBottom: 0, flex: '1 1 180px', minWidth: '180px' }}>
    <div style={{ fontSize: '12px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px' }}>{titulo}</div>
    {/* Valor negativo (dedução, prejuízo) em vermelho. */}
    <div style={{ fontSize: '22px', fontWeight: 700, color: /(^|\s)-\d/.test(valor) ? COR.perigo : COR.azul, marginTop: '6px' }}>{valor}</div>
    {detalhe && <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '4px' }}>{detalhe}</div>}
  </div>
);

// ------------------------------------------------------------
// Números
// ------------------------------------------------------------

export const formatarValor = (valor: number): string =>
  (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatarMoeda = (valor: number): string =>
  `R$ ${formatarValor(valor)}`;

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234" e vazio (= 0).
// Devolve NaN quando o texto não é um número.
export const converterValor = (entrada: string): number => {

  let textoLimpo =
    String(entrada || '')
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .trim();

  if (textoLimpo === '' || textoLimpo === '-') {
    return 0;
  }

  if (textoLimpo.indexOf(',') >= 0) {
    // Formato brasileiro: ponto = milhar, vírgula = decimal.
    textoLimpo = textoLimpo.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(textoLimpo)) {
    // "1.234.567" sem vírgula: pontos são separadores de milhar.
    textoLimpo = textoLimpo.replace(/\./g, '');
  }

  const valor = Number(textoLimpo);

  return isFinite(valor) ? arredondar(valor) : NaN;
};

// Data no fuso do navegador. "2026-10-16T02:59:59Z" (23:59 em
// Brasília) mostra 15/10, e não 16/10.
export const formatarData = (valor?: string): string => {
  if (!valor || !/^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return '—';
  }
  if (valor.length > 10) {
    const data = new Date(valor);
    if (!isNaN(data.getTime())) {
      const dois = (numero: number): string => (numero < 10 ? `0${numero}` : String(numero));
      return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`;
    }
  }
  return `${valor.substring(8, 10)}/${valor.substring(5, 7)}/${valor.substring(0, 4)}`;
};

// "2026-10-15T14:05:00Z" → "15/10/2026 11:05" (horário local).
export const formatarDataHora = (valor?: string): string => {
  if (!valor) {
    return '—';
  }
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    return formatarData(valor);
  }
  const dois = (numero: number): string => (numero < 10 ? `0${numero}` : String(numero));
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} ${dois(data.getHours())}:${dois(data.getMinutes())}`;
};

// ------------------------------------------------------------
// Agrupamento (mesma ordem da planilha modelo)
// ------------------------------------------------------------

export interface IGrupoLinhas {
  grupo: string;
  linhas: ILinhaOrcamento[];
  totais: number[];
  total: number;
}

const ordemConta = (codigo: string): number => {
  for (let i = 0; i < PLANO_CONTAS.length; i++) {
    if (PLANO_CONTAS[i].codigo === codigo) {
      return i;
    }
  }
  return PLANO_CONTAS.length;
};

export const somarMeses = (linhas: ILinhaOrcamento[]): number[] => {
  const totais = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  linhas.forEach(linha => {
    linha.valores.forEach((valor, indice) => {
      totais[indice] = arredondar(totais[indice] + (valor || 0));
    });
  });
  return totais;
};

export const somar = (valores: number[]): number =>
  arredondar(valores.reduce((soma, valor) => soma + (valor || 0), 0));

// Soma mês a mês dos valores com sinal (receitas +, custos −).
export const somarComSinal = (linhas: ILinhaOrcamento[]): number[] => {
  const totais = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  linhas.forEach(linha => {
    valoresComSinal(linha).forEach((valor, indice) => {
      totais[indice] = arredondar(totais[indice] + valor);
    });
  });
  return totais;
};

export const agruparLinhas = (linhas: ILinhaOrcamento[]): IGrupoLinhas[] => {

  const nomes: string[] = GRUPOS_ORCAMENTO.slice();

  // Grupos que não estão no plano atual (contas antigas) vão ao fim.
  linhas.forEach(linha => {
    if (nomes.indexOf(linha.grupo) < 0) {
      nomes.push(linha.grupo);
    }
  });

  return nomes
    .map(grupo => {
      const doGrupo =
        linhas
          .filter(linha => linha.grupo === grupo)
          .sort((a, b) => (ordemConta(a.codigo) - ordemConta(b.codigo)) || (a.ordem - b.ordem));
      // Totais COM SINAL (custos/despesas negativos), como na planilha.
      const totais = somarComSinal(doGrupo);
      return { grupo, linhas: doGrupo, totais, total: somar(totais) };
    })
    .filter(item => item.linhas.length > 0);
};

// ------------------------------------------------------------
// Exportação CSV — mesmo layout de Orcamento_DGT_AAAA.xlsx
// (Cenário;Linha;Código;Conta;Jan/AAAA;...;Dez/AAAA;Total)
//
// Contas iguais (mesmo grupo e código) são SOMADAS, então serve
// tanto para a planilha de um gestor quanto para o consolidado.
// Segue a ordem da aba ORÇAMENTO 2027, com valores COM SINAL
// (deduções/custos negativos), as contas mãe (soma dos subitens) e as
// linhas calculadas (Receita Operacional Líquida, Lucro Bruto, LAIR,
// Lucro Líquido, EBITDA e %).
// ------------------------------------------------------------

const numeroCsv = (valor: number): string =>
  arredondar(valor).toFixed(2).replace('.', ',').replace(',00', '');

const textoCsv = (valor: string): string =>
  /[;"\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

interface IContaSomada {
  codigo: string;
  conta: string;
  valores: number[];
  // Subitem de conta mãe (ex.: 6.1.1.01.* → 4.1.4.01.01.018).
  pai?: string;
}

const agruparTodasContas = (
  linhas: ILinhaOrcamento[],
  incluirContasZeradas: boolean
): Array<{ grupo: string; totais: number[]; contas: IContaSomada[] }> => {

  const nomes: string[] = GRUPOS_ORCAMENTO.slice();
  linhas.forEach(linha => {
    if (nomes.indexOf(linha.grupo) < 0) {
      nomes.push(linha.grupo);
    }
  });

  return nomes
    .map(grupo => {
      const contas: IContaSomada[] = [];

      // Contas do plano, na ordem da planilha modelo.
      PLANO_CONTAS
        .filter(item => item.grupo === grupo)
        .forEach(item => {
          const lancadas = linhas.filter(linha => linha.grupo === grupo && linha.codigo === item.codigo);
          if (lancadas.length > 0 || incluirContasZeradas) {
            contas.push({ codigo: item.codigo, conta: item.conta, valores: somarComSinal(lancadas), pai: item.pai });
          }
        });

      // Contas lançadas que não existem mais no plano.
      linhas
        .filter(linha =>
          linha.grupo === grupo &&
          !PLANO_CONTAS.some(item => item.grupo === grupo && item.codigo === linha.codigo))
        .forEach(linha => {
          const existente = contas.filter(item => item.codigo === linha.codigo)[0];
          const doCodigo = somarComSinal([linha]);
          if (existente) {
            existente.valores = existente.valores.map((valor, mes) => arredondar(valor + doCodigo[mes]));
          } else {
            contas.push({ codigo: linha.codigo, conta: linha.conta, valores: doCodigo, pai: CONTAS_MAE[linha.codigo] ? linha.codigo : undefined });
          }
        });

      const totais = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      contas.forEach(conta => conta.valores.forEach((valor, indice) => {
        totais[indice] = arredondar(totais[indice] + valor);
      }));

      return { grupo, totais, contas };
    })
    .filter(item => item.contas.length > 0);
};

export const gerarCsvOrcamento = (
  ano: number,
  linhas: ILinhaOrcamento[],
  incluirContasZeradas: boolean
): string => {

  const cabecalho =
    ['Cenário', 'Linha', 'Código', 'Conta']
      .concat(NOMES_MESES.map(mes => `${mes}/${ano}`))
      .concat(['Total']);

  const saida: string[] = [cabecalho.join(';')];

  // total: informado nas linhas de % (o % do ano não é a soma dos meses).
  const linhaCsv = (grupo: string, codigo: string, conta: string, valores: number[], total?: number): string =>
    [CENARIO_ORCADO, grupo, codigo, conta].map(textoCsv)
      .concat(valores.map(numeroCsv))
      .concat([numeroCsv(total !== undefined ? total : somar(valores))])
      .join(';');

  // Na ordem da planilha: grupos (TOTAL + contas), seções, resultados
  // e % — valores com sinal (deduções/custos negativos).
  const grupos = agruparTodasContas(linhas, incluirContasZeradas);
  const dre = calcularDre(linhas);

  const exportarGrupo = (grupo: { grupo: string; totais: number[]; contas: IContaSomada[] }): void => {
    saida.push(linhaCsv(termoExibido(grupo.grupo), '', 'TOTAL', grupo.totais));
    const paisExportados: string[] = [];
    grupo.contas.forEach(conta => {
      if (conta.pai && paisExportados.indexOf(conta.pai) < 0) {
        paisExportados.push(conta.pai);
        const soma = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        grupo.contas
          .filter(item => item.pai === conta.pai)
          .forEach(item => item.valores.forEach((valor, mes) => { soma[mes] = arredondar(soma[mes] + valor); }));
        saida.push(linhaCsv(termoExibido(grupo.grupo), conta.pai, CONTAS_MAE[conta.pai] || conta.pai, soma));
      }
      if (conta.codigo !== conta.pai) {
        saida.push(linhaCsv(termoExibido(grupo.grupo), conta.codigo, conta.conta, conta.valores));
      }
    });
  };

  ITENS_DRE.forEach(item => {
    if (item.tipo === 'grupo') {
      const grupo = grupos.filter(atual => atual.grupo === item.id)[0];
      if (grupo) {
        exportarGrupo(grupo);
      }
      return;
    }
    saida.push(linhaCsv(
      termoExibido(item.id, item.nome),
      '',
      item.tipo === 'percentual' ? '%' : 'RESULTADO',
      dre[item.id] || [],
      item.tipo === 'percentual' ? totalAnualDre(item.id, dre) : undefined
    ));
  });

  // Grupos que não existem mais no plano.
  grupos
    .filter(grupo => !ITENS_DRE.some(item => item.tipo === 'grupo' && item.id === grupo.grupo))
    .forEach(exportarGrupo);

  // Executado (realizado), quando houver: uma linha por conta.
  linhas
    .filter(linha => (linha.executado || []).some(valor => !!valor))
    .forEach(linha => {
      const sinal = sinalDaConta(linha.codigo);
      const valores = (linha.executado || []).map(valor => arredondar((valor || 0) * sinal));
      saida.push(
        [CENARIO_EXECUTADO, termoExibido(linha.grupo), linha.codigo, linha.conta].map(textoCsv)
          .concat(valores.map(numeroCsv))
          .concat([numeroCsv(somar(valores))])
          .join(';')
      );
    });

  return saida.join('\r\n');
};

// ------------------------------------------------------------
// EXECUTADO — modelo e importação por CSV
//
// Mesmo layout do "Exportar CSV": Cenário;Linha;Código;Conta;Jan…Dez;
// Total. Valores como aparecem na tela (receitas positivas, deduções,
// custos e despesas negativos). Linhas sem código (TOTAL, resultados)
// e as contas mãe (soma dos subitens) são ignoradas. Do Excel: Salvar
// como → "CSV (separado por ponto e vírgula)".
// ------------------------------------------------------------

export const gerarModeloExecutadoCsv = (
  ano: number,
  linhas: ILinhaOrcamento[]
): string => {
  const cabecalho =
    ['Cenário', 'Linha', 'Código', 'Conta']
      .concat(NOMES_MESES.map(mes => `${mes}/${ano}`))
      .concat(['Total']);
  const saida: string[] = [cabecalho.join(';')];
  linhas
    .filter(linha => !CONTAS_MAE[linha.codigo])
    .forEach(linha => {
      const sinal = sinalDaConta(linha.codigo);
      const valores = (linha.executado || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).map(valor => arredondar((valor || 0) * sinal));
      saida.push(
        [CENARIO_EXECUTADO, termoExibido(linha.grupo), linha.codigo, linha.conta].map(textoCsv)
          .concat(valores.map(numeroCsv))
          .concat([numeroCsv(somar(valores))])
          .join(';')
      );
    });
  return saida.join('\r\n');
};

export interface IImportacaoExecutado {
  // chave da linha → executado (12 meses, como gravado).
  valores: { [chave: string]: number[] };
  contasLidas: number;
  // Códigos do arquivo que não existem na planilha.
  naoEncontradas: string[];
  // Linhas ignoradas por valor inválido.
  invalidas: string[];
}

// "-R$ 1.234,56" / "1234.56" / "(1.234,56)" → número.
const lerNumeroCsv = (texto: string): number | undefined => {
  let limpo = (texto || '').replace(/R\$|\s|"/g, '');
  if (!limpo || limpo === '-') {
    return 0;
  }
  let negativo = false;
  if (/^\(.*\)$/.test(limpo)) {
    negativo = true;
    limpo = limpo.slice(1, -1);
  }
  if (limpo.indexOf(',') >= 0) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  }
  const valor = Number(limpo);
  if (!isFinite(valor)) {
    return undefined;
  }
  return negativo ? -valor : valor;
};

const dividirCsv = (linha: string, separador: string): string[] => {
  const campos: string[] = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        aspas = !aspas;
      }
    } else if (c === separador && !aspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map(campo => campo.trim());
};

const semAcento = (texto: string): string =>
  (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export const lerExecutadoCsv = (
  conteudo: string,
  linhas: ILinhaOrcamento[]
): IImportacaoExecutado => {

  const registros = (conteudo || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(linha => linha.trim() !== '');
  if (registros.length < 2) {
    throw new Error('O arquivo está vazio.');
  }

  const separador = registros[0].split(';').length >= registros[0].split(',').length ? ';' : ',';
  const cabecalho = dividirCsv(registros[0], separador).map(semAcento);
  const colCodigo = cabecalho.findIndex(nome => nome === 'codigo');
  const colLinha = cabecalho.findIndex(nome => nome === 'linha' || nome === 'grupo');
  const prefixos = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const colMeses = prefixos.map(prefixo => cabecalho.findIndex(nome => nome.indexOf(prefixo) === 0));

  if (colCodigo < 0 || colMeses.some(indice => indice < 0)) {
    throw new Error('Cabeçalho não reconhecido. Use o modelo: Cenário;Linha;Código;Conta;Jan/AAAA…Dez/AAAA;Total.');
  }

  const resultado: IImportacaoExecutado = { valores: {}, contasLidas: 0, naoEncontradas: [], invalidas: [] };

  registros.slice(1).forEach((texto, indice) => {
    const campos = dividirCsv(texto, separador);
    const codigo = campos[colCodigo] || '';
    if (!codigo || CONTAS_MAE[codigo]) {
      return;
    }
    const grupo = colLinha >= 0 ? campos[colLinha] : '';
    const candidatas = linhas.filter(linha => linha.codigo === codigo);
    const linha =
      candidatas.filter(item => !!grupo && (item.grupo === grupo || termoExibido(item.grupo) === grupo))[0] ||
      (candidatas.length === 1 ? candidatas[0] : undefined);
    if (!linha) {
      if (resultado.naoEncontradas.indexOf(codigo) < 0) {
        resultado.naoEncontradas.push(codigo);
      }
      return;
    }
    const numeros = colMeses.map(coluna => lerNumeroCsv(campos[coluna]));
    if (numeros.some(numero => numero === undefined)) {
      resultado.invalidas.push(`linha ${indice + 2} (${codigo})`);
      return;
    }
    // Arquivo com sinal da tela → valor gravado (positivo nas deduções).
    const sinal = sinalDaConta(codigo);
    resultado.valores[linha.chave] = (numeros as number[]).map(numero => arredondar(numero * sinal));
    resultado.contasLidas++;
  });

  return resultado;
};

// Baixa o CSV no navegador (UTF-8 com BOM para o Excel abrir os acentos).
export const baixarCsv = (
  nomeArquivo: string,
  conteudo: string
): void => {

  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8' });

  const navegador = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (arquivo: Blob, nome: string) => boolean;
  };

  if (navegador.msSaveOrOpenBlob) {
    navegador.msSaveOrOpenBlob(blob, nomeArquivo);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const nomeArquivoSeguro = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

// ------------------------------------------------------------
// Consolidação (soma várias planilhas conta a conta)
// ------------------------------------------------------------

// Junta as linhas de várias planilhas: mesma conta (grupo + código)
// vira uma linha só, com os meses somados.
export const consolidarLinhas = (
  linhas: ILinhaOrcamento[]
): ILinhaOrcamento[] => {

  const mapa: { [chave: string]: ILinhaOrcamento } = {};
  const ordem: string[] = [];

  linhas.forEach(linha => {
    const chave = `${linha.grupo}|${linha.codigo}`;
    if (!mapa[chave]) {
      mapa[chave] = {
        id: chave,
        chave,
        planilhaId: '',
        grupo: linha.grupo,
        codigo: linha.codigo,
        conta: linha.conta,
        descricao: '',
        ordem: linha.ordem,
        valores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      };
      ordem.push(chave);
    }
    const destino = mapa[chave];
    linha.valores.forEach((valor, mes) => {
      destino.valores[mes] = arredondar(destino.valores[mes] + (valor || 0));
    });
  });

  return ordem.map(chave => mapa[chave]);
};

// ------------------------------------------------------------
// Ícones e selos
// ------------------------------------------------------------

export const IconeOlho: React.FC<{ tamanho?: number }> = ({ tamanho = 16 }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
    <path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Prazo de ajuste (planilha devolvida): "até 17/10 · faltam 2 dias
// úteis" em laranja, ou "vencido · 1 dia útil de atraso" em vermelho.
export const SeloPrazo: React.FC<{ prazo: string; situacao?: { atrasado: boolean; texto: string } }> = ({ prazo, situacao }) => {
  if (!prazo || !situacao) {
    return null;
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: '999px',
        fontSize: '11.5px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        background: situacao.atrasado ? '#B42318' : '#FFF4E5',
        color: situacao.atrasado ? '#FFFFFF' : '#B45309'
      }}
    >
      {situacao.atrasado ? `⏰ Atrasada · ${situacao.texto}` : `⏳ Prazo ${formatarData(prazo)} · ${situacao.texto}`}
    </span>
  );
};

// ------------------------------------------------------------
// Mensagens de erro
// ------------------------------------------------------------

export const mensagemErro = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

// Explica os erros mais comuns (tabela/coluna ainda não criada ou
// falta de permissão na Security Role).
export const explicarErro = (erro: unknown): string => {
  const texto = mensagemErro(erro);
  if (
    /(dgt_orcamento|dgt_motivodevolucao|dgt_datadevolucao|dgt_devolvidopor|dgt_prazoajuste|_dgt_area_value)/i.test(texto) &&
    /(404|not found|does not exist|Could not find)/i.test(texto)
  ) {
    return 'Faltam tabelas ou colunas do Planejamento orçamentário no Dataverse. Execute (de novo) o script scripts/dataverse/criar-tabelas-orcamento.ps1 — ele cria só o que falta. Detalhe: ' + texto;
  }
  if (/(403|privilege|prvRead|prvCreate|prvWrite|prvAppend)/i.test(texto)) {
    return 'Seu usuário não tem a permissão necessária nas tabelas do orçamento (Security Role). Fale com um administrador. Detalhe: ' + texto;
  }
  return texto;
};

export const CaixaMensagem: React.FC<{ tipo: 'erro' | 'sucesso' | 'alerta' | 'info'; texto: string }> = ({ tipo, texto }) => {
  if (!texto) {
    return null;
  }
  const cores = {
    erro: { fundo: '#FDE7E9', borda: '#F3C1C1', cor: '#B42318' },
    sucesso: { fundo: '#E7F6EC', borda: '#B7E1C1', cor: '#107C10' },
    alerta: { fundo: '#FFF8E1', borda: '#F5D58A', cor: '#8A5A00' },
    info: { fundo: '#E8F2FF', borda: '#BBD6F5', cor: '#0F4C81' }
  }[tipo];
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      style={{ ...cartao, background: cores.fundo, borderColor: cores.borda, color: cores.cor, whiteSpace: 'pre-line', fontSize: '13px', fontWeight: tipo === 'sucesso' ? 600 : 400 }}
    >
      {texto}
    </div>
  );
};
