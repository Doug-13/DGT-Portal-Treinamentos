// ============================================================
// SERVIDOR DA CENTRAL — CATÁLOGO E REGRAS
//
// Complemento à especificação do B.O.M. ("seleção de servidor",
// nov/2026). O servidor deixa de ser "item sem código" e passa a ser
// escolhido no MEMORIAL DE CÁLCULO do fabricante, pela faixa de
// câmeras do projeto. É item do PROJETO INTEIRO, não do ponto.
//
// Cobertura (3 dos 7 softwares que exigem servidor):
//   Digifort Enterprise (gravação) · Milestone XProtect Professional+
//   (gravação) · IPX Analytics (analítico) · Digifort + IPX no mesmo
//   servidor (combinado, até 50 câmeras).
//   Axxon, Briefcam, Invenzi (W-Access) e NX Witness: só lembrete.
//   Bridgefy Safe City: nuvem, sem servidor.
//
// Base de câmeras:
//   V = câmeras de vídeo · P = porteiros (Hikvision DS-KB8113-IME,
//   consomem canal de VMS) · LPR NUNCA entra (grava só frames de placa).
//   Gravação e combinado: V + P · Analítico: V.
//   Necessidade = teto(base × (1 + reserva/100)); faixa = a menor
//   capacidade ≥ necessidade (arredonda sempre para cima).
//
// O catálogo e os textos dos alertas ficam no Dataverse (aba Kits →
// Servidores): corrigir um memorial não exige nova versão do portal.
// As premissas de gravação (FPS, qualidade, 30 dias) estão embutidas
// no memorial e NÃO são editáveis aqui.
// ============================================================

export type SoftwareServidor = 'digifort' | 'milestone' | 'ipx' | 'digifortIpx';

export type FinalidadeServidor = 'gravacao' | 'analitico' | 'gravacao_analitico';

export type Compressao = 'H.264' | 'H.265';

export const SOFTWARES_SERVIDOR: Array<{ software: SoftwareServidor; nome: string; finalidade: FinalidadeServidor; sigla: string }> = [
  { software: 'digifort', nome: 'Digifort Enterprise', finalidade: 'gravacao', sigla: 'DGF' },
  { software: 'milestone', nome: 'Milestone XProtect Professional+', finalidade: 'gravacao', sigla: 'MIL' },
  { software: 'ipx', nome: 'IPX Analytics', finalidade: 'analitico', sigla: 'IPX' },
  { software: 'digifortIpx', nome: 'Digifort + IPX Analytics', finalidade: 'gravacao_analitico', sigla: 'DGFIPX' }
];

export const nomeSoftware = (s: SoftwareServidor): string =>
  (SOFTWARES_SERVIDOR.filter(x => x.software === s)[0] || { nome: s }).nome;

export const LIMITE_COMBINADO = 50;

export const RESERVAS = [0, 10, 20, 30];

export const RESERVA_PADRAO = 10;

// ------------------------------------------------------------
// Catálogo (uma linha = uma faixa/opção de um memorial)
// ------------------------------------------------------------

export interface ILinhaServidor {
  id: string;                 // chave estável (ex.: DGFIPX-010)
  software: SoftwareServidor;
  finalidade: FinalidadeServidor;
  capacidade: number;         // câmeras
  opcao: string;              // '' ou A, B, C (distribuição)
  qtdServidores: number;
  camerasPorServidor: number;
  processadores: string[];    // alternativas equivalentes
  ram: string;
  discoSo: string;
  armazServidorTb: number;
  armazTotalTb: number;
  discosQtd: number;          // por servidor (Milestone)
  discoTamanhoTb: number;
  arranjo: string;
  gpus: string[];             // vazio = sem GPU
  sistemasOperacionais: string[];
  compressaoRef: Compressao;
  iops: string;
  redeCamerasMbps: number;
  codigoCigam: string;
  versaoMemorial: string;
  ativo: boolean;
  observacao: string;
}

// ------------------------------------------------------------
// Alertas (texto e nível vêm da tabela; a condição é do código)
// ------------------------------------------------------------

export type NivelAlertaServidor = 'bloqueio' | 'aviso' | 'informacao';

export interface IAlertaServidorRegra {
  id: string;
  // Regra geral (chave abaixo) ou "linha:<id da linha>".
  regra: string;
  nivel: NivelAlertaServidor;
  texto: string;
  ativo: boolean;
}

export const REGRAS_ALERTA: Array<{ regra: string; descricao: string }> = [
  { regra: 'acimaMaiorFaixa', descricao: 'Necessidade acima da maior faixa do memorial' },
  { regra: 'combinadoAcima50', descricao: 'Digifort + IPX acima de 50 câmeras' },
  { regra: 'semCigam', descricao: 'Servidor escolhido sem código CIGAM' },
  { regra: 'soForaSuporte', descricao: 'SO Windows Server 2012 ou Windows 10' },
  { regra: 'carePlusIrregular', descricao: 'Milestone com prazo de contrato diferente de 12, 36 ou 60 meses' },
  { regra: 'h265Digifort', descricao: 'Digifort com compressão H.265' },
  { regra: 'milestoneRede', descricao: 'Milestone (sempre): rede e IOPS — use {rede} e {iops}' },
  { regra: 'ipxAvulso', descricao: 'Servidor IPX Analytics avulso' },
  { regra: 'semMemorial', descricao: 'Software sem memorial no projeto (W-Access/Invenzi, Axxon, Briefcam, NX Witness)' },
  { regra: 'semLinhaCatalogo', descricao: 'Não há linha ativa no catálogo para o software' },
  { regra: 'revisar', descricao: 'Os pontos mudaram depois de escolher o servidor' }
];

const a = (regra: string, nivel: NivelAlertaServidor, texto: string): IAlertaServidorRegra =>
  ({ id: regra, regra, nivel, texto, ativo: true });

export const ALERTAS_PADRAO: IAlertaServidorRegra[] = [
  a('acimaMaiorFaixa', 'bloqueio', 'Necessidade acima da maior faixa do memorial: peça o dimensionamento ao fornecedor ou divida em mais de um conjunto.'),
  a('combinadoAcima50', 'bloqueio', 'Acima do limite do servidor combinado (50 câmeras): use servidores separados — um de gravação e um de analítico.'),
  a('semCigam', 'aviso', 'Servidor sem código CIGAM: não é orçável até o cadastro.'),
  a('soForaSuporte', 'aviso', 'Sistema operacional fora do suporte da Microsoft (Windows Server 2012 / Windows 10).'),
  a('carePlusIrregular', 'aviso', 'Prazo de contrato diferente de 12, 36 ou 60 meses: o Care Plus do Milestone precisa de cotação específica com o fabricante.'),
  a('h265Digifort', 'informacao', 'Digifort com H.265: armazenamento reduzido à metade do memorial (H.264).'),
  a('milestoneRede', 'informacao', 'Milestone: confira a rede ({rede} Mbps das câmeras) e os IOPS ({iops}) da linha escolhida.'),
  a('ipxAvulso', 'informacao', 'IPX Analytics avulso: este servidor não grava — a gravação precisa de VMS ou nuvem.'),
  a('semMemorial', 'informacao', 'W-Access (Invenzi) e outros softwares sem memorial (Axxon, Briefcam, NX Witness) também exigem servidor: dimensionar à parte.'),
  a('semLinhaCatalogo', 'bloqueio', 'Não há linha ativa no catálogo de servidores para este software: cadastre o memorial na aba Kits → Servidores ou use o orçamento manual.'),
  a('revisar', 'aviso', 'Os pontos mudaram depois da escolha do servidor: revise a faixa.')
];

// ------------------------------------------------------------
// Catálogo padrão (memoriais disponíveis)
// ------------------------------------------------------------

const VERSAO_COMBINADO = 'Digifort Enterprise + IPX Analytics — 3ª revisão, nov/2026';

const linha = (dados: Partial<ILinhaServidor> & Pick<ILinhaServidor, 'id' | 'software' | 'finalidade' | 'capacidade'>): ILinhaServidor => ({
  opcao: '',
  qtdServidores: 1,
  camerasPorServidor: dados.capacidade,
  processadores: [],
  ram: '',
  discoSo: '',
  armazServidorTb: 0,
  armazTotalTb: 0,
  discosQtd: 0,
  discoTamanhoTb: 0,
  arranjo: '',
  gpus: [],
  sistemasOperacionais: [],
  compressaoRef: 'H.264',
  iops: '',
  redeCamerasMbps: 0,
  codigoCigam: '',
  versaoMemorial: '',
  ativo: true,
  observacao: '',
  ...dados
});

const XEON_BRONZE = ['Intel Xeon Bronze 3106', 'Intel Xeon 6325P', 'Intel Xeon 6333P'];
const W_ANTIGO = ['Windows Server 2012 Standard', 'Windows 10 Pro'];

export const CATALOGO_SERVIDORES_PADRAO: ILinhaServidor[] = [
  // Servidor combinado (memorial completo).
  linha({ id: 'DGFIPX-010', software: 'digifortIpx', finalidade: 'gravacao_analitico', capacidade: 10, processadores: XEON_BRONZE, ram: '32 GB DDR4', armazServidorTb: 8.3, armazTotalTb: 8.3, gpus: ['NVIDIA RTX 5050 8GB'], sistemasOperacionais: W_ANTIGO, versaoMemorial: VERSAO_COMBINADO }),
  linha({ id: 'DGFIPX-020', software: 'digifortIpx', finalidade: 'gravacao_analitico', capacidade: 20, processadores: XEON_BRONZE, ram: '32 GB DDR4', armazServidorTb: 19, armazTotalTb: 19, gpus: ['NVIDIA RTX 5060 8GB'], sistemasOperacionais: W_ANTIGO, versaoMemorial: VERSAO_COMBINADO }),
  linha({ id: 'DGFIPX-030', software: 'digifortIpx', finalidade: 'gravacao_analitico', capacidade: 30, processadores: XEON_BRONZE, ram: '32 GB DDR4', armazServidorTb: 28.5, armazTotalTb: 28.5, gpus: ['NVIDIA RTX 5060 8GB'], sistemasOperacionais: W_ANTIGO, versaoMemorial: VERSAO_COMBINADO }),
  linha({ id: 'DGFIPX-040', software: 'digifortIpx', finalidade: 'gravacao_analitico', capacidade: 40, processadores: ['Intel Xeon Silver 4210', 'Intel Xeon 6505P', 'Intel Xeon 6511P'], ram: '32 GB DDR4', armazServidorTb: 38, armazTotalTb: 38, gpus: ['NVIDIA RTX 5060 Ti'], sistemasOperacionais: ['Windows Server 2012 Standard'], versaoMemorial: VERSAO_COMBINADO }),
  linha({ id: 'DGFIPX-050', software: 'digifortIpx', finalidade: 'gravacao_analitico', capacidade: 50, processadores: ['2× Intel Xeon Silver 4214', '2× Intel Xeon 6511P', '2× Intel Xeon 6515P'], ram: '64 GB', armazServidorTb: 47.5, armazTotalTb: 47.5, gpus: ['NVIDIA RTX 5070'], sistemasOperacionais: ['Windows Server 2012 Standard'], versaoMemorial: VERSAO_COMBINADO }),

  // Digifort só gravação, 10 a 50: valores da comparação do memorial
  // combinado. Faltam processador e SO → DESATIVADAS até completar
  // pela planilha "Servidores — Consolidado Memoriais de Cálculo".
  ...[[10, 8], [20, 15], [30, 23], [40, 30], [50, 38]].map(([cap, tb]) => linha({
    id: `DGF-${('00' + cap).slice(-3)}`, software: 'digifort', finalidade: 'gravacao', capacidade: cap,
    ram: '16 GB', armazServidorTb: tb, armazTotalTb: tb, ativo: false,
    versaoMemorial: 'Digifort Enterprise (valores da comparação do memorial combinado)',
    observacao: 'Linha parcial: completar processador e SO pela planilha Consolidado antes de ativar.'
  }))
];

// ------------------------------------------------------------
// Catálogo EM USO (padrão ou Dataverse) — mutável, como ITENS
// ------------------------------------------------------------

export const CATALOGO_SERVIDORES: ILinhaServidor[] = CATALOGO_SERVIDORES_PADRAO.map(l => ({ ...l }));

export const ALERTAS_SERVIDOR: IAlertaServidorRegra[] = ALERTAS_PADRAO.map(x => ({ ...x }));

export const aplicarCatalogoServidores = (linhas: ILinhaServidor[], alertas: IAlertaServidorRegra[]): void => {
  CATALOGO_SERVIDORES.splice(0, CATALOGO_SERVIDORES.length, ...linhas.map(l => ({ ...l })));
  // Regras gerais que faltarem na tabela usam o texto padrão.
  const combinados = ALERTAS_PADRAO
    .filter(p => !alertas.some(x => x.regra === p.regra))
    .map(p => ({ ...p }))
    .concat(alertas.map(x => ({ ...x })));
  ALERTAS_SERVIDOR.splice(0, ALERTAS_SERVIDOR.length, ...combinados);
};

export const codigoSugerido = (l: Pick<ILinhaServidor, 'software' | 'capacidade' | 'opcao'>): string => {
  const sigla = (SOFTWARES_SERVIDOR.filter(s => s.software === l.software)[0] || { sigla: 'SRV' }).sigla;
  return `SRV-${sigla}-${('00' + l.capacidade).slice(-3)}${l.opcao ? `-${l.opcao}` : ''}`;
};

// ------------------------------------------------------------
// Escolhas do arquiteto (gravadas na seleção de kit do B.O.M.)
// ------------------------------------------------------------

export type PapelServidor = 'gravacao' | 'analitico' | 'combinado';

export interface IEscolhaServidor {
  capacidade?: number;
  opcao?: string;
  gpu?: string;
  processador?: string;
  so?: string;
  // Necessidade digitada (substitui base + reserva). Nunca menor que a base.
  ajusteNecessidade?: number;
}

export interface IServidorSelecao {
  reservaPct: number;
  compressao?: Compressao;
  // Digifort + IPX até 50 câmeras: combinado (sugerido) ou separados.
  modo?: 'combinado' | 'separado';
  gravacao?: IEscolhaServidor;
  analitico?: IEscolhaServidor;
  combinado?: IEscolhaServidor;
  // Sai do seletor: servidor orçado à parte pelo arquiteto.
  orcamentoManual?: boolean;
  orcamentoManualMotivo?: string;
  orcamentoManualServidores?: number;
  // Care Plus (Milestone) quando o prazo não vem do tipo de projeto.
  carePlus?: '' | '12' | '36' | '60' | 'cotacao';
  // Base de câmeras no momento da escolha (selo "revisar servidor").
  baseNaEscolha?: number;
}

export const servidorPadrao = (): IServidorSelecao => ({ reservaPct: RESERVA_PADRAO });

// ------------------------------------------------------------
// Análise
// ------------------------------------------------------------

export interface IOpcaoFaixa {
  capacidade: number;
  linhas: ILinhaServidor[];
  habilitada: boolean;
  recomendada: boolean;
  folga: number;
}

export interface IConjuntoServidor {
  papel: PapelServidor;
  software: SoftwareServidor;
  base: number;
  necessidade: number;
  faixas: IOpcaoFaixa[];
  escolha: IEscolhaServidor;
  linha?: ILinhaServidor;
  // Escolhas resolvidas (automáticas quando há uma opção só).
  gpu?: string;
  processador?: string;
  so?: string;
  automatico: { opcao: boolean; gpu: boolean; processador: boolean; so: boolean };
  armazenamentoTb: number;
  // Próxima pergunta em aberto (undefined = conjunto definido).
  pendente?: 'faixa' | 'opcao' | 'gpu' | 'processador' | 'so';
}

export interface IAlertaServidorEmitido {
  regra: string;
  nivel: NivelAlertaServidor;
  texto: string;
}

export interface IItemServidor {
  chave?: string;          // item do catálogo de kits (licenças Milestone/Digifort)
  codigo: string;
  descricao: string;
  quantidade: number;
  pendente: boolean;
}

export interface IAnaliseServidor {
  local: 'nuvem' | 'onPremise' | 'nenhum';
  softwareGravacao?: 'digifort' | 'milestone';
  usaIpx: boolean;
  v: number;
  p: number;
  l: number;
  baseGravacao: number;
  baseAnalitico: number;
  podeCombinar: boolean;
  modo?: 'combinado' | 'separado';
  conjuntos: IConjuntoServidor[];
  servidoresTotal: number;
  definido: boolean;
  alertas: IAlertaServidorEmitido[];
  itens: IItemServidor[];
  carePlus?: { meses?: number; item?: string; cotacao: boolean };
}

export interface IContextoServidor {
  vms: 'safeCity' | 'digifort' | 'milestone';
  ipx: boolean;
  usaWAccess: boolean;
  v: number;
  p: number;
  l: number;
  // Meses do contrato (tipo de projeto "Locação N meses").
  prazoContratoMeses?: number;
}

const textoAlerta = (regra: string, troca?: Record<string, string>): IAlertaServidorEmitido | undefined => {
  const r = ALERTAS_SERVIDOR.filter(x => x.regra === regra)[0];
  if (!r || !r.ativo) {
    return undefined;
  }
  let texto = r.texto;
  Object.keys(troca || {}).forEach(k => { texto = texto.split(`{${k}}`).join((troca as Record<string, string>)[k]); });
  return { regra, nivel: r.nivel, texto };
};

export const necessidadeDe = (base: number, reservaPct: number, ajuste?: number): number => {
  const calculada = Math.ceil(base * (1 + (reservaPct || 0) / 100) - 1e-9);
  return ajuste && ajuste >= base ? Math.ceil(ajuste) : calculada;
};

const linhasDe = (software: SoftwareServidor, compressao?: Compressao): ILinhaServidor[] => {
  const ativas = CATALOGO_SERVIDORES.filter(l => l.software === software && l.ativo);
  // Milestone: se o catálogo tem linhas por compressão, usa a escolhida.
  if (software === 'milestone' && compressao && ativas.some(l => l.compressaoRef === compressao)) {
    return ativas.filter(l => l.compressaoRef === compressao);
  }
  if (software === 'milestone' && compressao && ativas.some(l => l.compressaoRef !== compressao)) {
    return ativas.filter(l => l.compressaoRef === ativas[0].compressaoRef);
  }
  return ativas;
};

const montarConjunto = (
  papel: PapelServidor,
  software: SoftwareServidor,
  base: number,
  sel: IServidorSelecao
): IConjuntoServidor => {

  const escolha = (papel === 'gravacao' ? sel.gravacao : papel === 'analitico' ? sel.analitico : sel.combinado) || {};
  const necessidade = necessidadeDe(base, sel.reservaPct, escolha.ajusteNecessidade);

  const linhas = linhasDe(software, sel.compressao);
  const capacidades = linhas.map(l => l.capacidade).filter((c, i, lista) => lista.indexOf(c) === i).sort((x, y) => x - y);
  const recomendada = capacidades.filter(c => c >= necessidade)[0];

  const faixas: IOpcaoFaixa[] = capacidades.map(c => ({
    capacidade: c,
    linhas: linhas.filter(l => l.capacidade === c).sort((x, y) => x.opcao.localeCompare(y.opcao)),
    habilitada: c >= necessidade && (papel !== 'combinado' || c <= LIMITE_COMBINADO),
    recomendada: c === recomendada,
    folga: c - necessidade
  }));

  const conjunto: IConjuntoServidor = {
    papel, software, base, necessidade, faixas, escolha,
    automatico: { opcao: false, gpu: false, processador: false, so: false },
    armazenamentoTb: 0
  };

  // Faixa: a escolhida (se ainda comporta) ou a recomendada.
  const faixa = faixas.filter(f => f.capacidade === escolha.capacidade && f.habilitada)[0] ||
    faixas.filter(f => f.recomendada && f.habilitada)[0];
  if (!faixa) {
    conjunto.pendente = 'faixa';
    return conjunto;
  }

  // Opção (A, B, C).
  let linhaEscolhida = faixa.linhas.filter(l => l.opcao === (escolha.opcao || ''))[0];
  if (faixa.linhas.length === 1) {
    linhaEscolhida = faixa.linhas[0];
    conjunto.automatico.opcao = true;
  }
  if (!linhaEscolhida) {
    conjunto.pendente = 'opcao';
    return conjunto;
  }
  conjunto.linha = linhaEscolhida;

  const resolver = (alternativas: string[], escolhida: string | undefined, campo: 'gpu' | 'processador' | 'so'): string | undefined | null => {
    if (alternativas.length === 0) {
      return undefined;
    }
    if (alternativas.length === 1) {
      conjunto.automatico[campo] = true;
      return alternativas[0];
    }
    return escolhida && alternativas.indexOf(escolhida) >= 0 ? escolhida : null;
  };

  const gpu = resolver(linhaEscolhida.gpus, escolha.gpu, 'gpu');
  if (gpu === null) { conjunto.pendente = 'gpu'; return conjunto; }
  conjunto.gpu = gpu;

  const processador = resolver(linhaEscolhida.processadores, escolha.processador, 'processador');
  if (processador === null) { conjunto.pendente = 'processador'; return conjunto; }
  conjunto.processador = processador;

  const so = resolver(linhaEscolhida.sistemasOperacionais, escolha.so, 'so');
  if (so === null) { conjunto.pendente = 'so'; return conjunto; }
  conjunto.so = so;

  const fator = (software === 'digifort' || software === 'digifortIpx') && sel.compressao === 'H.265' ? 0.5 : 1;
  conjunto.armazenamentoTb = Math.round(linhaEscolhida.armazTotalTb * fator * 100) / 100;

  return conjunto;
};

const papelNome: Record<PapelServidor, string> = {
  gravacao: 'Servidor de gravação',
  analitico: 'Servidor de analítico',
  combinado: 'Servidor'
};

export const descricaoServidor = (c: IConjuntoServidor): string => {
  const l = c.linha as ILinhaServidor;
  const nome = c.papel === 'combinado' ? `${papelNome.combinado} ${nomeSoftware(c.software)}` : `${papelNome[c.papel]} ${nomeSoftware(c.software)}`;
  const partes = [c.processador, l.ram, `${String(c.armazenamentoTb).replace('.', ',')} TB${l.qtdServidores > 1 ? ' no total' : ''}`, c.gpu].filter(Boolean);
  return `${nome} · ${l.capacidade} câmeras${l.qtdServidores > 1 ? ` (${l.camerasPorServidor} por servidor)` : ''} [${codigoSugerido(l)}] — ${partes.join(', ')}`;
};

export const analisarServidor = (
  sel: IServidorSelecao | undefined,
  ctx: IContextoServidor
): IAnaliseServidor => {

  const s = sel || servidorPadrao();
  const alertas: IAlertaServidorEmitido[] = [];
  const emitir = (regra: string, troca?: Record<string, string>): void => {
    const x = textoAlerta(regra, troca);
    if (x && !alertas.some(y => y.texto === x.texto)) {
      alertas.push(x);
    }
  };

  const baseGravacao = ctx.v + ctx.p;
  const baseAnalitico = ctx.v;

  const resultado: IAnaliseServidor = {
    local: 'nenhum',
    usaIpx: ctx.ipx,
    v: ctx.v, p: ctx.p, l: ctx.l,
    baseGravacao, baseAnalitico,
    podeCombinar: false,
    conjuntos: [],
    servidoresTotal: 0,
    definido: false,
    alertas,
    itens: []
  };

  if (ctx.usaWAccess) {
    emitir('semMemorial');
  }

  if (ctx.vms === 'safeCity' && !ctx.ipx) {
    resultado.local = baseGravacao > 0 ? 'nuvem' : 'nenhum';
    resultado.definido = true;
    return resultado;
  }

  if (baseGravacao === 0 && ctx.vms !== 'safeCity') {
    resultado.local = 'onPremise';
    resultado.definido = true;
    return resultado;
  }

  resultado.local = ctx.vms === 'safeCity' ? 'nuvem' : 'onPremise';
  resultado.softwareGravacao = ctx.vms === 'safeCity' ? undefined : ctx.vms;

  // Finalidade(s).
  const digifortComIpx = ctx.vms === 'digifort' && ctx.ipx;
  const necessidadeCombinado = necessidadeDe(baseGravacao, s.reservaPct, s.combinado && s.combinado.ajusteNecessidade);
  resultado.podeCombinar = digifortComIpx && necessidadeCombinado <= LIMITE_COMBINADO &&
    CATALOGO_SERVIDORES.some(l => l.software === 'digifortIpx' && l.ativo);

  if (digifortComIpx && necessidadeCombinado > LIMITE_COMBINADO && s.modo === 'combinado') {
    emitir('combinadoAcima50');
  }

  const modo: 'combinado' | 'separado' | undefined =
    !digifortComIpx ? undefined
      : resultado.podeCombinar ? (s.modo || 'combinado')
        : 'separado';
  resultado.modo = modo;

  if (modo === 'combinado') {
    resultado.conjuntos.push(montarConjunto('combinado', 'digifortIpx', baseGravacao, s));
  } else {
    if (ctx.vms === 'digifort' || ctx.vms === 'milestone') {
      resultado.conjuntos.push(montarConjunto('gravacao', ctx.vms, baseGravacao, s));
    }
    if (ctx.ipx) {
      resultado.conjuntos.push(montarConjunto('analitico', 'ipx', baseAnalitico, s));
    }
  }

  // ---- alertas e itens por conjunto
  resultado.conjuntos.forEach(c => {
    // Orçamento manual: o servidor sai do seletor (sem alertas de faixa).
    if (s.orcamentoManual) {
      return;
    }
    if (c.faixas.length === 0) {
      emitir('semLinhaCatalogo');
      return;
    }
    if (c.pendente === 'faixa') {
      emitir(c.papel === 'combinado' && c.necessidade > LIMITE_COMBINADO ? 'combinadoAcima50' : 'acimaMaiorFaixa');
    }
    if (c.software === 'ipx') {
      emitir('ipxAvulso');
    }
    if ((c.software === 'digifort' || c.software === 'digifortIpx') && s.compressao === 'H.265') {
      emitir('h265Digifort');
    }
    if (!c.linha) {
      return;
    }
    if (c.software === 'milestone') {
      emitir('milestoneRede', { rede: c.linha.redeCamerasMbps ? String(c.linha.redeCamerasMbps).replace('.', ',') : '—', iops: c.linha.iops || '—' });
    }
    ALERTAS_SERVIDOR
      .filter(x => x.ativo && x.regra === `linha:${c.linha && c.linha.id}`)
      .forEach(x => alertas.push({ regra: x.regra, nivel: x.nivel, texto: x.texto }));
    if (c.pendente) {
      return;
    }
    if (!c.linha.codigoCigam) {
      emitir('semCigam');
    }
    if (c.so && /2012|windows\s*10/i.test(c.so)) {
      emitir('soForaSuporte');
    }
  });

  const definidos = resultado.conjuntos.filter(c => c.linha && !c.pendente);
  resultado.servidoresTotal = definidos.reduce((t, c) => t + (c.linha as ILinhaServidor).qtdServidores, 0);
  resultado.definido = !s.orcamentoManual && resultado.conjuntos.length > 0 && definidos.length === resultado.conjuntos.length;

  if (s.baseNaEscolha !== undefined && s.baseNaEscolha !== baseGravacao && (resultado.definido || s.orcamentoManual)) {
    emitir('revisar');
  }

  // ---- itens
  if (s.orcamentoManual) {
    const qtd = Math.max(1, Math.round(s.orcamentoManualServidores || 1));
    resultado.servidoresTotal = qtd;
    resultado.itens.push({
      codigo: '',
      descricao: `Servidor da central — orçamento manual${s.orcamentoManualMotivo ? ` (${s.orcamentoManualMotivo})` : ''}`,
      quantidade: qtd,
      pendente: true
    });
  } else {
    definidos.forEach(c => {
      const l = c.linha as ILinhaServidor;
      resultado.itens.push({ codigo: l.codigoCigam, descricao: descricaoServidor(c), quantidade: l.qtdServidores, pendente: !l.codigoCigam });
      if (c.so) {
        resultado.itens.push({ codigo: '', descricao: `Sistema operacional ${c.so} — servidor ${codigoSugerido(l)}`, quantidade: l.qtdServidores, pendente: true });
      }
      if (c.software === 'milestone' && l.discosQtd > 0) {
        resultado.itens.push({
          codigo: '',
          descricao: `Disco de vigilância${l.discoTamanhoTb ? ` ${String(l.discoTamanhoTb).replace('.', ',')} TB` : ''} — servidor ${codigoSugerido(l)}`,
          quantidade: l.discosQtd * l.qtdServidores,
          pendente: true
        });
      }
    });
  }

  // ---- Milestone: 1 licença por câmera + Care Plus pelo contrato
  if (ctx.vms === 'milestone' && baseGravacao > 0) {
    resultado.itens.push({ chave: 'milestoneLicenca', codigo: '', descricao: '', quantidade: baseGravacao, pendente: false });

    const meses =
      s.carePlus && s.carePlus !== 'cotacao' ? Number(s.carePlus)
        : s.carePlus === 'cotacao' ? undefined
          : ctx.prazoContratoMeses;
    const chave = meses === 12 ? 'milestoneCare1' : meses === 36 ? 'milestoneCare3' : meses === 60 ? 'milestoneCare5' : undefined;
    resultado.carePlus = { meses, item: chave, cotacao: !chave };
    if (chave) {
      resultado.itens.push({ chave, codigo: '', descricao: '', quantidade: baseGravacao, pendente: false });
    } else {
      emitir('carePlusIrregular');
      resultado.itens.push({
        codigo: '',
        descricao: `Milestone Care Plus — ${meses ? `${meses} meses` : 'prazo a definir'} (cotação pendente com o fabricante)`,
        quantidade: baseGravacao,
        pendente: true
      });
    }
  }

  return resultado;
};

// Meses do contrato a partir do tipo de projeto ("Locação 36 meses").
export const mesesDoTipoProjeto = (tipoProjeto?: string): number | undefined => {
  const m = /(\d+)\s*meses/i.exec(tipoProjeto || '');
  return m ? Number(m[1]) : undefined;
};
