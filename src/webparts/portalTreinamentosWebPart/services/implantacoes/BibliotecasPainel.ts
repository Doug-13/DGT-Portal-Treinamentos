import {
  LEAFLET_CSS
} from '../../pages/Implantacoes/legado/leafletCss';

// ============================================================
// IMPLANTAÇÕES — bibliotecas de exportação, mapa e planilhas
//
// O painel original baixava jsPDF, jsPDF-AutoTable, ExcelJS, SheetJS e
// Leaflet do cdnjs na hora do uso. Dentro do SharePoint isso não
// funciona: a página tem um carregador de módulos (AMD) e essas
// bibliotecas se registram nele em vez de criar window.jspdf,
// window.ExcelJS, window.L... ("Cannot destructure property 'jsPDF'
// of 'window.jspdf'").
//
// Agora elas vêm do npm, no pacote do portal, e só são baixadas quando
// alguém exporta, abre o mapa ou importa uma planilha (import dinâmico =
// arquivo separado do pacote). O painel continua chamando
// loadJS(<endereço do cdnjs>): o endereço só diz QUAL biblioteca carregar.
//
// SheetJS (xlsx) não é usado: a versão do npm está desatualizada e com
// falha de segurança conhecida. A leitura da planilha de vistoria usa o
// ExcelJS (.xlsx) e um leitor próprio de CSV. Arquivos .xls (Excel
// 97-2003) deixam de ser aceitos.
// ============================================================

type Registro = Record<string, unknown>;

interface IJsPdfModulo {
  jsPDF: unknown;
}

interface IAutoTableModulo {
  applyPlugin: (jsPDF: unknown) => void;
}

interface ICelulaExcel {
  text?: string;
}

interface ILinhaExcel {
  getCell: (coluna: number) => ICelulaExcel;
}

interface IPlanilhaExcel {
  name: string;
  rowCount: number;
  columnCount: number;
  getRow: (linha: number) => ILinhaExcel;
}

interface IPastaExcel {
  worksheets: IPlanilhaExcel[];
  xlsx: { load: (dados: ArrayBuffer) => Promise<unknown> };
}

interface IExcelJs {
  Workbook: new () => IPastaExcel;
}

export interface ICarregadorBibliotecas {
  carregarScript: (endereco: string) => Promise<void>;
  carregarEstilo: (endereco: string) => void;
  lerPlanilha: (arquivo: File) => Promise<string[][]>;
}

const padrao = <T>(modulo: unknown): T => {
  const m = modulo as Registro;
  return (m && m.default ? m.default : m) as T;
};

// ------------------------------------------------------------
// CSV (separador ; ou , — o que aparecer mais na primeira linha)
// ------------------------------------------------------------

const decodificar = (dados: ArrayBuffer): string => {
  const utf8 = new TextDecoder('utf-8').decode(dados);
  // Planilhas salvas pelo Excel em português costumam vir em Windows-1252.
  return utf8.indexOf('\uFFFD') >= 0 ? new TextDecoder('windows-1252').decode(dados) : utf8;
};

export const lerCsv = (texto: string): string[][] => {

  const limpo = texto.replace(/^\uFEFF/, '');
  const primeira = limpo.split(/\r?\n/)[0] || '';
  const separador = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;

  for (let i = 0; i < limpo.length; i++) {

    const c = limpo.charAt(i);

    if (aspas) {
      if (c === '"' && limpo.charAt(i + 1) === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo.charAt(i + 1) === '\n') {
        i++;
      }
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }

  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas;
};

// ------------------------------------------------------------
// Carregador
// ------------------------------------------------------------

export const criarCarregadorBibliotecas = (
  janela: Registro,
  cabeca: HTMLElement
): ICarregadorBibliotecas => {

  const carregadas: Record<string, Promise<void>> = {};

  const uma = (nome: string, carregar: () => Promise<void>): Promise<void> => {
    if (!carregadas[nome]) {
      carregadas[nome] = carregar().catch(erro => {
        delete carregadas[nome];
        throw erro;
      });
    }
    return carregadas[nome];
  };

  const jspdf = (): Promise<void> =>
    uma('jspdf', async () => {
      const modulo = await import(/* webpackChunkName: 'implantacoes-pdf' */ 'jspdf');
      janela.jspdf = { jsPDF: (modulo as unknown as IJsPdfModulo).jsPDF };
    });

  const autotable = (): Promise<void> =>
    uma('autotable', async () => {
      await jspdf();
      const modulo = await import(/* webpackChunkName: 'implantacoes-pdf' */ 'jspdf-autotable');
      (modulo as unknown as IAutoTableModulo).applyPlugin((janela.jspdf as IJsPdfModulo).jsPDF);
    });

  const exceljs = (): Promise<void> =>
    uma('exceljs', async () => {
      const modulo = await import(/* webpackChunkName: 'implantacoes-excel' */ 'exceljs');
      janela.ExcelJS = padrao<IExcelJs>(modulo);
    });

  const leaflet = (): Promise<void> =>
    uma('leaflet', async () => {
      const modulo = await import(/* webpackChunkName: 'implantacoes-mapa' */ 'leaflet');
      janela.L = padrao<unknown>(modulo);
    });

  const carregarScript = async (endereco: string): Promise<void> => {

    const e = String(endereco).toLowerCase();

    if (e.indexOf('autotable') >= 0) {
      return autotable();
    }

    if (e.indexOf('jspdf') >= 0) {
      return jspdf();
    }

    if (e.indexOf('exceljs') >= 0) {
      return exceljs();
    }

    if (e.indexOf('leaflet') >= 0) {
      return leaflet();
    }

    if (e.indexOf('xlsx') >= 0) {
      // SheetJS foi substituído (ver cabeçalho): nada a carregar.
      return exceljs();
    }

    throw new Error(`Biblioteca não disponível no portal: ${endereco}`);
  };

  const carregarEstilo = (endereco: string): void => {

    if (String(endereco).toLowerCase().indexOf('leaflet') < 0 || cabeca.querySelector('style[data-leaflet]')) {
      return;
    }

    const estilo = document.createElement('style');
    estilo.setAttribute('data-leaflet', '');
    estilo.textContent = LEAFLET_CSS;
    cabeca.appendChild(estilo);
  };

  // Mesmo resultado do SheetJS com { header: 1, defval: '', raw: false }:
  // uma lista de linhas, cada uma com o texto formatado das células.
  const lerPlanilha = async (arquivo: File): Promise<string[][]> => {

    const nome = String(arquivo.name || '').toLowerCase();
    const dados = await arquivo.arrayBuffer();

    if (/\.csv$/.test(nome) || arquivo.type === 'text/csv') {
      return lerCsv(decodificar(dados));
    }

    if (/\.xls$/.test(nome)) {
      throw new Error('arquivo .xls (Excel 97-2003) não é lido no portal: salve como .xlsx ou .csv e importe de novo');
    }

    await exceljs();

    const pasta = new (janela.ExcelJS as IExcelJs).Workbook();
    await pasta.xlsx.load(dados);

    const planilha =
      pasta.worksheets.filter(p => /vistoria/i.test(p.name))[0] || pasta.worksheets[0];

    if (!planilha) {
      return [];
    }

    const linhas: string[][] = [];

    for (let l = 1; l <= planilha.rowCount; l++) {
      const linha = planilha.getRow(l);
      const valores: string[] = [];
      for (let c = 1; c <= planilha.columnCount; c++) {
        const texto = linha.getCell(c).text;
        valores.push(texto === undefined || texto === null ? '' : String(texto));
      }
      linhas.push(valores);
    }

    return linhas;
  };

  return {
    carregarScript,
    carregarEstilo,
    lerPlanilha
  };
};
