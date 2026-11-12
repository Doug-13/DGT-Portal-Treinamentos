// ============================================================
// SELEÇÃO DE SERVIDOR — CATÁLOGO (memoriais de cálculo)
//
// Fonte: spec-complemento-servidores.md (06/11/2026), "Automação da
// seleção de servidor — lógica e passo a passo" e a planilha
// "Servidores — Consolidado Memoriais de Cálculo".
//
// Três softwares têm memorial e seleção automática: Digifort
// Enterprise, Milestone XProtect e IPX Analytics. Uma LINHA por
// combinação de faixa de capacidade × opção de distribuição (43).
//
// Onde fica: no Dataverse, na mesma tabela dos itens de kit
// (dgt_kititem), com dgt_tipo = 'servidor' (linha) ou
// 'servidorSoftware' (ficha do software: premissas e alertas). Os
// dados técnicos vão em dgt_atributos.servidor. Assim cada linha
// ganha código CIGAM (dgt_codigo), ativo (dgt_ativo) e histórico
// (dgt_kitalteracao) sem tabela nova.
//
// O PADRÃO abaixo só traz o que a especificação define (faixas,
// opções, premissas e alertas). Processador, RAM, discos, GPU, SO e
// licenças vêm da planilha: aba Servidores → "Importar planilha".
// Linha sem esses dados fica PENDENTE e não pode ser escolhida.
// ============================================================

export type SoftwareServidor = 'digifort' | 'milestone' | 'ipx';

export type FinalidadeServidor = 'gravacao' | 'analitico';

export type NivelAlertaServidor = 'bloqueio' | 'aviso' | 'info';

export type OpcaoServidor = '' | 'A' | 'B' | 'C';

// Licença de uma linha (aba Digifort da planilha): código do
// fabricante (ex.: DGFEN1008V7) × quantidade.
export interface ILicencaServidor {
  codigo: string;
  qtd: number;
}

// Alerta vindo de TABELA (não do código): corrigir o memorial apaga
// o alerta sem nova versão do portal. Condição opcional: só vale se
// o campo escolhido contém o texto, ou com a compressão indicada.
// O texto aceita {iops}, {rede}, {processador}, {gpu}, {so}.
export interface IAlertaServidor {
  nivel: NivelAlertaServidor;
  texto: string;
  campo?: 'processador' | 'gpu' | 'so';
  contem?: string;
  compressao?: 'H.264' | 'H.265';
}

export interface ILinhaServidor {
  chave: string;
  codigoCigam: string;
  ativo: boolean;
  software: SoftwareServidor;
  finalidade: FinalidadeServidor;
  capacidade: number;
  opcao: OpcaoServidor;
  qtdServidores: number;
  // Alternativas equivalentes do memorial (o arquiteto escolhe).
  processadores: string[];
  gpus: string[];
  sistemas: string[];
  ram: string;
  discoSo: string;
  armazServidorTb: number;
  armazTotalTb: number;
  discosQtd: number;
  discoTamanhoTb: number;
  arranjo: string;
  compressaoRef: string;
  iops: string;
  redeMbps: string;
  versaoMemorial: string;
  // Códigos CIGAM do disco de vigilância (Milestone) e do sistema
  // operacional, quando cadastrados.
  codigoDisco: string;
  codigoSo: string;
  licencas: ILicencaServidor[];
  alertas: IAlertaServidor[];
}

// 'manual': o arquiteto confirma. 'resolucao': o portal confere com
// as câmeras dos pontos. 'informativo': só exibido.
export type VerificacaoPremissa = 'manual' | 'resolucao' | 'informativo';

export interface IPremissaServidor {
  item: string;
  valor: string;
  verificacao: VerificacaoPremissa;
  // Para 'resolucao': o máximo aceito (MP).
  limiteMp?: number;
}

// Ficha do software (ou 'geral', com as regras que valem para todos).
export interface ISoftwareServidor {
  chave: string;
  software: SoftwareServidor | 'geral';
  nome: string;
  memorial: string;
  dataMemorial: string;
  premissas: IPremissaServidor[];
  alertas: IAlertaServidor[];
}

export const INFO_SOFTWARE: Record<SoftwareServidor, { nome: string; nomeCurto: string; sigla: string; finalidade: FinalidadeServidor }> = {
  digifort: { nome: 'Digifort Enterprise', nomeCurto: 'Digifort', sigla: 'DGF', finalidade: 'gravacao' },
  milestone: { nome: 'Milestone XProtect Professional+', nomeCurto: 'Milestone', sigla: 'MIL', finalidade: 'gravacao' },
  ipx: { nome: 'IPX Analytics', nomeCurto: 'IPX Analytics', sigla: 'IPX', finalidade: 'analitico' }
};

export const SOFTWARES_SERVIDOR: SoftwareServidor[] = ['digifort', 'milestone', 'ipx'];

// Softwares que exigem servidor mas NÃO têm memorial: continuam com
// o item sem código. A tela deixa isso explícito (pendência S6).
export const SOFTWARES_SEM_MEMORIAL = ['Axxon', 'Briefcam', 'Invenzi W-Access', 'Novo VMS (NX Witness)'];

export const NOME_FINALIDADE: Record<FinalidadeServidor, string> = {
  gravacao: 'gravação',
  analitico: 'analítico'
};

// SRV-DGF-070-A, SRV-MIL-070, SRV-IPX-060 (sugestão de código para o
// cadastro — NÃO é código CIGAM).
// 7 → '007' (sem padStart: o alvo do SPFx é ES5).
const tresDigitos = (n: number): string => `00${Math.max(0, Math.floor(n))}`.slice(-3);

export const chaveServidor = (software: SoftwareServidor, capacidade: number, opcao: OpcaoServidor): string =>
  `SRV-${INFO_SOFTWARE[software].sigla}-${tresDigitos(capacidade)}${opcao ? `-${opcao}` : ''}`;

export const nomeLinha = (linha: Pick<ILinhaServidor, 'software' | 'finalidade' | 'capacidade' | 'opcao'>): string =>
  `Servidor de ${NOME_FINALIDADE[linha.finalidade]} ${INFO_SOFTWARE[linha.software].nomeCurto} · ${linha.capacidade} câmeras${linha.opcao ? ` · opção ${linha.opcao}` : ''}`;

// O que falta na linha para ela poder ser escolhida.
export const pendenciasLinha = (linha: ILinhaServidor): string[] => {
  const faltam: string[] = [];
  if (!(linha.qtdServidores > 0)) {
    faltam.push('quantidade de servidores');
  }
  if (linha.processadores.length === 0) {
    faltam.push('processador');
  }
  if (!linha.ram.trim()) {
    faltam.push('memória RAM');
  }
  if (linha.finalidade === 'gravacao' && !(linha.armazTotalTb > 0 || linha.armazServidorTb > 0)) {
    faltam.push('armazenamento');
  }
  if (linha.finalidade === 'analitico' && linha.gpus.length === 0) {
    faltam.push('GPU');
  }
  if (linha.software === 'digifort' && linha.licencas.length === 0) {
    faltam.push('licenças do memorial');
  }
  return faltam;
};

// ------------------------------------------------------------
// Padrão (estrutura definida na especificação)
// ------------------------------------------------------------

const linhaVazia = (software: SoftwareServidor, capacidade: number, opcao: OpcaoServidor, qtdServidores = 0): ILinhaServidor => ({
  chave: chaveServidor(software, capacidade, opcao),
  codigoCigam: '',
  ativo: true,
  software,
  finalidade: INFO_SOFTWARE[software].finalidade,
  capacidade,
  opcao,
  qtdServidores,
  processadores: [],
  gpus: [],
  sistemas: [],
  ram: '',
  discoSo: '',
  armazServidorTb: 0,
  armazTotalTb: 0,
  discosQtd: 0,
  discoTamanhoTb: 0,
  arranjo: '',
  compressaoRef: software === 'digifort' ? 'H.264' : software === 'milestone' ? 'H.265' : '',
  iops: '',
  redeMbps: '',
  versaoMemorial: software === 'ipx' ? 'Spec 2025 (V3)' : '24/04/2026',
  codigoDisco: '',
  codigoSo: '',
  licencas: [],
  alertas: []
});

const ALERTA_LICENCAS_DIGIFORT: IAlertaServidor = {
  nivel: 'aviso',
  texto: 'As licenças do memorial não fecham com a capacidade desta faixa — revisar com o elaborador do memorial.'
};

const linhasPadrao = (): ILinhaServidor[] => {
  const linhas: ILinhaServidor[] = [];

  // Digifort: 10 a 100 (de 10 em 10), 200, 300, 400. Opção única,
  // exceto 70, 80, 90, 200, 300, 400 (A e B) e 300, 400 (C). 21 linhas.
  // Quantidade de servidores conhecida pela especificação: 70 B = 2.
  const capDigifort = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400];
  const comAB = [70, 80, 90, 200, 300, 400];
  const comC = [300, 400];
  const naoFecham = ['070-B', '090-B', '200-B', '300-B', '400-C'];
  capDigifort.forEach(cap => {
    const opcoes: OpcaoServidor[] = comAB.indexOf(cap) >= 0 ? ['A', 'B', ...(comC.indexOf(cap) >= 0 ? ['C' as OpcaoServidor] : [])] : [''];
    opcoes.forEach(op => {
      const linha = linhaVazia('digifort', cap, op, cap === 70 && op === 'B' ? 2 : 0);
      if (naoFecham.indexOf(`${tresDigitos(cap)}-${op}`) >= 0) {
        linha.alertas.push({ ...ALERTA_LICENCAS_DIGIFORT });
      }
      linhas.push(linha);
    });
  });

  // Milestone: 10 a 100 e 150. Sempre opção única, sempre 1 servidor. 11 linhas.
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150].forEach(cap => linhas.push(linhaVazia('milestone', cap, '', 1)));

  // IPX: 11 faixas, sempre opção única.
  [10, 40, 50, 60, 65, 70, 80, 120, 140, 170, 250].forEach(cap => {
    const linha = linhaVazia('ipx', cap, '');
    if (cap === 50) {
      linha.alertas.push({ nivel: 'aviso', texto: 'O memorial indica GPU "GTX 2060 SUPER": o modelo correto é RTX 2060 SUPER.' });
    }
    linhas.push(linha);
  });

  return linhas;
};

const softwaresPadrao = (): ISoftwareServidor[] => [
  {
    chave: 'servidorSoftware:digifort',
    software: 'digifort',
    nome: INFO_SOFTWARE.digifort.nome,
    memorial: 'Memorial de cálculo Digifort Enterprise',
    dataMemorial: '24/04/2026',
    premissas: [
      { item: 'Câmera de referência', valor: 'VIP 5460 Z IA e VIP 5440 D Z IA', verificacao: 'informativo' },
      { item: 'Resolução', valor: '3,8 MP (2240×1680) — até 4 MP', verificacao: 'resolucao', limiteMp: 4 },
      { item: 'FPS', valor: '15', verificacao: 'manual' },
      { item: 'Gravação', valor: 'Contínua, 30 dias', verificacao: 'manual' },
      { item: 'Taxa por câmera', valor: '4 Mbps', verificacao: 'manual' },
      { item: 'Qualidade', valor: 'Média', verificacao: 'manual' },
      { item: 'Compressão de referência', valor: 'H.264 (H.265 reduz o armazenamento à metade)', verificacao: 'informativo' }
    ],
    alertas: [
      { nivel: 'info', texto: 'Compressão H.265: armazenamento reduzido à metade do valor do memorial.', compressao: 'H.265' }
    ]
  },
  {
    chave: 'servidorSoftware:milestone',
    software: 'milestone',
    nome: INFO_SOFTWARE.milestone.nome,
    memorial: 'Memorial de cálculo Milestone XProtect Professional+',
    dataMemorial: '24/04/2026',
    premissas: [
      { item: 'Câmera de referência', valor: '4 MP, lente única', verificacao: 'informativo' },
      { item: 'Resolução', valor: '4 MP', verificacao: 'resolucao', limiteMp: 4 },
      { item: 'FPS', valor: '15', verificacao: 'manual' },
      { item: 'Gravação', valor: 'Contínua 24 h, 30 dias', verificacao: 'manual' },
      { item: 'Taxa por câmera', valor: '4.000 kbit/s', verificacao: 'manual' },
      { item: 'Qualidade', valor: 'Média', verificacao: 'manual' },
      { item: 'Compressão de referência', valor: 'H.265', verificacao: 'informativo' }
    ],
    alertas: [
      { nivel: 'info', texto: 'Rede e IOPS da linha escolhida: {rede} Mbps de câmeras · {iops} IOPS.' },
      { nivel: 'aviso', texto: 'O memorial é do XProtect Professional+; o item no CIGAM (3300110014) é XProtect Express+ Device Licence. Confirmar antes de orçar (pendência S4).' },
      { nivel: 'aviso', texto: 'O suporte do Milestone (3300110016 anual ou 3300110017 5 anos) não é gerado pelo seletor: incluir à parte (pendência S5).' }
    ]
  },
  {
    chave: 'servidorSoftware:ipx',
    software: 'ipx',
    nome: INFO_SOFTWARE.ipx.nome,
    memorial: 'Especificação IPX Analytics',
    dataMemorial: 'Spec 2025 (V3)',
    premissas: [
      { item: 'FPS', valor: '1 por câmera', verificacao: 'manual' },
      { item: 'Gravação', valor: 'Não grava', verificacao: 'informativo' }
    ],
    alertas: [
      { nivel: 'aviso', texto: 'O memorial indica "página 1 de 2": só a página 1 foi recebida (pendência S10).' },
      { nivel: 'info', texto: 'Este servidor não grava — a gravação precisa de VMS ou nuvem.' }
    ]
  },
  {
    chave: 'servidorSoftware:geral',
    software: 'geral',
    nome: 'Regras para todos os softwares',
    memorial: 'Pontos de atenção dos memoriais',
    dataMemorial: '06/11/2026',
    premissas: [],
    alertas: [
      { nivel: 'aviso', campo: 'processador', contem: '3106', texto: 'Processador "Xeon Silver 3106": o 3106 é da linha Bronze — revisar com o elaborador do memorial.' },
      { nivel: 'aviso', campo: 'processador', contem: '3108', texto: 'Processador "Xeon Silver 3108": esse modelo não existe — revisar com o elaborador do memorial.' },
      { nivel: 'aviso', campo: 'so', contem: 'Server 2012', texto: 'Windows Server 2012 está fora do suporte da Microsoft (pendência S11).' },
      { nivel: 'aviso', campo: 'so', contem: 'Windows 10', texto: 'Windows 10 está fora do suporte da Microsoft (pendência S11).' }
    ]
  }
];

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

const PADRAO_LINHAS: ILinhaServidor[] = linhasPadrao();
const PADRAO_SOFTWARES: ISoftwareServidor[] = softwaresPadrao();

export const servidoresPadrao = (): { linhas: ILinhaServidor[]; softwares: ISoftwareServidor[] } =>
  ({ linhas: clonar(PADRAO_LINHAS), softwares: clonar(PADRAO_SOFTWARES) });

// ------------------------------------------------------------
// Catálogo EM USO (mutável, como ITENS em catalogoKits.ts)
// ------------------------------------------------------------

export const LINHAS_SERVIDOR: ILinhaServidor[] = clonar(PADRAO_LINHAS);
export const FICHAS_SOFTWARE: ISoftwareServidor[] = clonar(PADRAO_SOFTWARES);

export const aplicarServidores = (dados: { linhas: ILinhaServidor[]; softwares: ISoftwareServidor[] }): void => {
  LINHAS_SERVIDOR.splice(0, LINHAS_SERVIDOR.length, ...clonar(dados.linhas));
  FICHAS_SOFTWARE.splice(0, FICHAS_SOFTWARE.length, ...clonar(dados.softwares));
};

export const restaurarServidoresPadrao = (): void => {
  aplicarServidores(servidoresPadrao());
};

export const fichaSoftware = (software: SoftwareServidor | 'geral'): ISoftwareServidor | undefined =>
  FICHAS_SOFTWARE.filter(f => f.software === software)[0];

// ------------------------------------------------------------
// Normalização (dados gravados podem vir incompletos)
// ------------------------------------------------------------

const lista = (valor: unknown): string[] =>
  Array.isArray(valor) ? valor.map(v => String(v).trim()).filter(Boolean) : [];

const num = (valor: unknown): number => {
  const n = Number(String(valor === undefined || valor === null ? '' : valor).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

const txt = (valor: unknown): string =>
  valor === undefined || valor === null ? '' : String(valor);

export const normalizarLinha = (bruto: Partial<ILinhaServidor>, chave: string, codigo: string, ativo: boolean): ILinhaServidor => {
  const software = (SOFTWARES_SERVIDOR.indexOf(bruto.software as SoftwareServidor) >= 0 ? bruto.software : 'digifort') as SoftwareServidor;
  const base = linhaVazia(software, num(bruto.capacidade), (['', 'A', 'B', 'C'].indexOf(txt(bruto.opcao)) >= 0 ? txt(bruto.opcao) : '') as OpcaoServidor);
  return {
    ...base,
    chave,
    codigoCigam: codigo,
    ativo,
    finalidade: bruto.finalidade === 'analitico' || bruto.finalidade === 'gravacao' ? bruto.finalidade : base.finalidade,
    qtdServidores: num(bruto.qtdServidores),
    processadores: lista(bruto.processadores),
    gpus: lista(bruto.gpus),
    sistemas: lista(bruto.sistemas),
    ram: txt(bruto.ram),
    discoSo: txt(bruto.discoSo),
    armazServidorTb: num(bruto.armazServidorTb),
    armazTotalTb: num(bruto.armazTotalTb),
    discosQtd: num(bruto.discosQtd),
    discoTamanhoTb: num(bruto.discoTamanhoTb),
    arranjo: txt(bruto.arranjo),
    compressaoRef: txt(bruto.compressaoRef) || base.compressaoRef,
    iops: txt(bruto.iops),
    redeMbps: txt(bruto.redeMbps),
    versaoMemorial: txt(bruto.versaoMemorial) || base.versaoMemorial,
    codigoDisco: txt(bruto.codigoDisco),
    codigoSo: txt(bruto.codigoSo),
    licencas: Array.isArray(bruto.licencas)
      ? bruto.licencas.map(l => ({ codigo: txt(l && l.codigo).trim(), qtd: num(l && l.qtd) })).filter(l => l.codigo && l.qtd > 0)
      : [],
    alertas: Array.isArray(bruto.alertas) ? bruto.alertas.filter(a => a && a.texto) : []
  };
};

export const normalizarFicha = (bruto: Partial<ISoftwareServidor>, chave: string): ISoftwareServidor => ({
  chave,
  software: (bruto.software || 'geral') as ISoftwareServidor['software'],
  nome: txt(bruto.nome),
  memorial: txt(bruto.memorial),
  dataMemorial: txt(bruto.dataMemorial),
  premissas: Array.isArray(bruto.premissas) ? bruto.premissas.filter(p => p && p.item) : [],
  alertas: Array.isArray(bruto.alertas) ? bruto.alertas.filter(a => a && a.texto) : []
});

// O que vai para dgt_atributos.servidor (sem chave, código e ativo,
// que têm coluna própria).
export const dadosGravadosLinha = (linha: ILinhaServidor): Record<string, unknown> => {
  const { chave, codigoCigam, ativo, ...resto } = linha;
  void chave; void codigoCigam; void ativo;
  return resto;
};

export const dadosGravadosFicha = (ficha: ISoftwareServidor): Record<string, unknown> => {
  const { chave, ...resto } = ficha;
  void chave;
  return resto;
};
