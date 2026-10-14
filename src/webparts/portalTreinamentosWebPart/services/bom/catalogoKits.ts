// ============================================================
// ARQUITETURA DE SOLUÇÕES — CATÁLOGO DO MONTADOR DE B.O.M.
//
// Fonte: spec-montador-bom-completa.md (planilhas-base de kits
// Bridgefy 2026 — Torre, Box e Mini, público e privado —, Planilha
// Base de Infraestrutura Específica 2026 e alinhamentos com o
// pré-vendas e o especialista de produto, out/2026).
//
// TUDO o que muda com frequência está AQUI, num só lugar, separado
// das regras (montadorBom.ts):
//   • códigos CIGAM e descrições dos itens;
//   • câmeras, switches e controladores homologados;
//   • códigos de SERVIÇO (genéricos — mudam quando as LPUs de
//     serviço forem formadas por suprimentos);
//   • códigos de licença.
// Próximo passo previsto: levar este catálogo para tabelas do
// Dataverse, para que novos homologados entrem sem alterar código.
//
// Código vazio ('') = item ainda SEM código no CIGAM: entra na
// lista marcado como pendente (não orçável até ser cadastrado).
// ============================================================

export type CategoriaItem =
  | 'Câmera'
  | 'Equipamento'
  | 'Infraestrutura'
  | 'Licença'
  | 'Serviço'
  | 'Identificação';

export interface IItemCatalogo {
  codigo: string;
  descricao: string;
  categoria: CategoriaItem;
}

// ------------------------------------------------------------
// Itens (chave interna → código e descrição)
// ------------------------------------------------------------

const item = (codigo: string, descricao: string, categoria: CategoriaItem): IItemCatalogo =>
  ({ codigo, descricao, categoria });

export const ITENS = {

  // Serviços (códigos GENÉRICOS — ver seção 18 da especificação)
  servicoImplantacaoTorre: item('6100050076', 'Serviços implantação torre Bridgefy', 'Serviço'),
  servicoInstalacaoBox: item('6100050078', 'Serviços de instalação ponto Box Bridgefy', 'Serviço'),
  servicoInstalacaoMini: item('6100050077', 'Serviços instalação Mini Bridgefy', 'Serviço'),
  servicoCameraAdicional: item('6100050079', 'Serviços de instalação câmera adicional', 'Serviço'),
  servicoProjetoExecutivo: item('6100050036', 'Elaboração de projeto executivo e as built', 'Serviço'),
  servicoInstalacaoPonto: item('6100050026', 'Serviço de instalação de ponto (porta)', 'Serviço'),
  servicoEletroduto: item('6100050043', 'Instalação de eletroduto PVC/zincado barra 3 m', 'Serviço'),
  servicoCatraca: item('6100050068', 'Instalação de controle de acesso corporativo — catraca gate', 'Serviço'),
  servicoLeitora: item('6100050063', 'Instalação e configuração de leitora de acesso', 'Serviço'),

  // Estruturas Bridgefy — infraestrutura comum
  fonte12v35: item('3700010044', 'DGT fonte chaveada de mesa 12V DC 3,5A', 'Infraestrutura'),
  giroled: item('4700050009', 'Giroled giroflex azul 128 LEDs 12V', 'Infraestrutura'),
  filtroLinha: item('3500010036', 'Margirus filtro de linha 5 tomadas', 'Infraestrutura'),
  suporteVideoTorre: item('4200050022', 'Soluservice suporte SCL para Bridgefy', 'Infraestrutura'),
  suporteOcrTorre: item('4200050008', 'Soluservice SCL suporte metálico câmera fixa fechado', 'Infraestrutura'),
  caixaBox: item('4300010019', 'Caixa Box Bridgefy azul 0,15x0,40 m', 'Infraestrutura'),
  kitFitaLedBox: item('3100100092', 'Teknimas kit Bridgefy zona segura com fita LED 1,10 m', 'Infraestrutura'),
  caixaHermetica: item('3500050081', 'Caixa hermética 250x210x80 mm', 'Infraestrutura'),
  tomadaMultipla5: item('3500010167', 'Tomada múltipla 5 posições', 'Infraestrutura'),
  abracadeiraNailon: item('4600010065', 'Abraçadeira náilon preta 283x4,80 mm', 'Infraestrutura'),
  fixadorChicote: item('3500010165', 'Frontec fixador p/ chicote', 'Infraestrutura'),
  suporteMini: item('4200010026', 'Soluservice suporte Mini Bridgefy 150x50x750 mm', 'Infraestrutura'),
  lanternaMini: item('4700050041', 'Liderauto lanterna LED sinalização estrobo 18W azul', 'Infraestrutura'),

  // Comunicação bidirecional (opcional na Torre)
  suporteInterfone: item('5500010267', 'Soluservice suporte interfone simples', 'Infraestrutura'),
  parafusoAutobrocante: item('3500300032', 'Parafuso autobrocante 4,2x16 mm', 'Infraestrutura'),
  patchCord: item('3250010002', 'Nexans patch cord CAT5e RJ45 1,50 m', 'Infraestrutura'),
  porteiroHikvision: item('5500010274', 'Hikvision porteiro ext. DS-KB8113-IME', 'Equipamento'),

  // Identificação
  adesivoCamera: item('4600010002', 'Adesivo câmera DGT 6x4,3 cm azul', 'Identificação'),
  adesivoBridgefy190: item('4600010040', 'Adesivo Bridgefy 190', 'Identificação'),
  adesivoBridgefy153: item('4600010039', 'Adesivo Bridgefy 153', 'Identificação'),
  adesivoBridgefyDgt: item('4600010038', 'Adesivo Bridgefy DGT', 'Identificação'),
  adesivoBridgefyQr: item('4600010041', 'Adesivo Bridgefy QR', 'Identificação'),
  adesivoBridgefy: item('4600010037', 'Adesivo Bridgefy', 'Identificação'),
  adesivoSuporteMini: item('4600010058', 'Adesivo suporte Mini Bridgefy', 'Identificação'),

  // Licenças — ecossistema Bridgefy
  // v1: sempre a de 30 dias (o código muda por canal numa versão futura).
  licencaSafeCity: item('3300990057', 'Licença Safe City 30 dias', 'Licença'),
  licencaSafeWay: item('3300990053', 'Licença SafeWay adicional faixa BSW03', 'Licença'),
  licencaFaceDetect: item('', 'Licença Face Detect (cadastrada como "Smart Face" — código a levantar)', 'Licença'),

  // Licenças — terceiros
  digifortBase8: item('625.001.0012', 'Digifort Enterprise — base 8 câmeras (DGFEN1008V7)', 'Licença'),
  digifortPack2: item('635.010.0009', 'Digifort Enterprise — pack 2 câmeras (DGFEN1102V7)', 'Licença'),
  digifortPack4: item('635.010.0013', 'Digifort Enterprise — pack 4 câmeras (DGFEN1104V7)', 'Licença'),
  digifortPack8: item('635.010.0048', 'Digifort Enterprise — pack 8 câmeras (DGFEN1108V7)', 'Licença'),
  digifortPack16: item('635.010.0008', 'Digifort Enterprise — pack 16 câmeras (DGFEN1116V7)', 'Licença'),
  digifortPack32: item('330.005.0022', 'Digifort Enterprise — pack 32 câmeras (DGFEN1132V7)', 'Licença'),
  digifortPack64: item('635.010.0010', 'Digifort Enterprise — pack 64 câmeras (DGFEN1164V7)', 'Licença'),
  ipxAnalytics: item('620.005.0054', 'Licença IPX Analytics Pro — mensal (por câmera e pacote)', 'Licença'),
  ipxIntegracao: item('', 'Licença de integração de analítico em servidor de terceiros (Digifort) — código a levantar', 'Licença'),

  // Controle de acesso — porta
  acionadorEmbutir: item('5500010158', 'Intelbras acionador abertura inox embutir 4x2 BT 5000 IN', 'Equipamento'),
  acionadorSobrepor: item('5500010256', 'Intelbras acionador abertura inox sobrepor c/ caixa BT 3000IN', 'Equipamento'),
  molaHidraulica: item('5500010157', 'Intelbras mola hidráulica aérea MH 104 A p/ 85 kg', 'Equipamento'),
  releXr2201: item('', 'Intelbras relé XR 2201 p/ abertura de portões — código a levantar', 'Equipamento'),
  fonte12v5: item('3700010012', 'Fonte chaveada estabilizadora 12V 5A', 'Infraestrutura'),
  caixaEmergencia: item('5300010047', 'Intelbras caixa de emergência rearmável AS2010', 'Equipamento'),
  fechaduraFe21150: item('5500010227', 'Intelbras fechadura FE 21150 c/ sensor', 'Equipamento'),
  suporteVidro: item('4200990045', 'Intelbras suporte p/ vidro SV 21/22 séries preto', 'Infraestrutura'),
  dutotecDuto: item('3500250007', 'Dutotec DS-19040 duto slim 1,5 m', 'Infraestrutura'),
  dutotecPortaEquip: item('3500250016', 'Dutotec DT-76740-30 porta equipamento slim', 'Infraestrutura'),
  eletroduto34: item('3500010060', 'Eletroduto PVC 3/4 preto barra 3 m', 'Infraestrutura'),
  abracadeiraPvc34: item('3500010034', 'Abraçadeira PVC preta 3/4', 'Infraestrutura'),
  conectorBox: item('3500010162', 'Conector box PVC reto 3x4 preto', 'Infraestrutura'),
  tampaoCaixa: item('3500010030', 'Tampão para caixa múltipla 3/4 preto', 'Infraestrutura'),
  condulete: item('3500010173', 'Inpol condulete PVC 1/2 x 3/4 p/ 5 entradas', 'Infraestrutura'),
  tampaCega: item('3500010005', 'Pezzi tampa cega 4x2 PVC', 'Infraestrutura'),
  caboManga: item('3200010013', 'Cabo cobre manga 4 x 26AWG blindado 4 vias (m)', 'Infraestrutura'),
  parafusoPhilips: item('3500300005', 'Parafuso Philips 4,0x40 mm', 'Infraestrutura'),
  buchaPlastica: item('3500300001', 'Bucha plástica 6 mm', 'Infraestrutura'),
  caboUtp: item('3200010005', 'Nexans cabo UTP CAT5e azul (m)', 'Infraestrutura'),

  // Controle de acesso — catraca
  catracaCap3100: item('5500010296', 'Intelbras catraca CAP3100 inox MF Face (2 leitoras)', 'Equipamento'),
  catracaPne: item('5500010298', 'Intelbras catraca 3000 PNE', 'Equipamento'),
  suporteSc3000: item('5500010294', 'Intelbras suporte p/ controlador SC 3000', 'Infraestrutura'),
  miniRack: item('4000010048', 'Intelbras mini rack montado 5U x 370 mm MRM 537', 'Infraestrutura'),
  tomadaExterna: item('3500010114', 'Margirius tomada externa c/ 3 tomadas 2P+T 20A', 'Infraestrutura'),
  tomadaC3: item('3500010006', 'Tomada múltipla C3 TOM 3P 10A', 'Infraestrutura'),
  caixaDistribuicao: item('3500010067', 'Caixa de distribuição p/ 2 disjuntores sobrepor', 'Infraestrutura'),
  disjuntor40: item('3500150009', 'Disjuntor monofásico 40A padrão DIN', 'Infraestrutura'),
  cabo4Azul: item('3200050001', 'Cabo flexível 4 mm² azul (m)', 'Infraestrutura'),
  cabo4Preto: item('3200050002', 'Cabo flexível 4 mm² preto (m)', 'Infraestrutura'),
  cabo25Azul: item('3200050014', 'Cabo flexível 2,5 mm² azul (m)', 'Infraestrutura'),
  conectorRj45: item('5100010005', 'Conector RJ45 macho', 'Infraestrutura'),

  // Licenças W-Access (Invenzi) — confirmar a cada cotação da Invenzi
  waccessLeitora: item('3300800009', 'Invenzi WXS-S-1R-FR-E — licença leitora facial Expert', 'Licença'),
  waccess1000: item('3300800007', 'Invenzi WXS-S-1KCRD-E — 1000 usuários ativos', 'Licença'),
  waccess2Conexoes: item('3300800008', 'Invenzi WXS-S-2CNX-E — 2 conexões simultâneas', 'Licença')
};

export type ChaveItem = keyof typeof ITENS;

// ------------------------------------------------------------
// Câmeras homologadas
// ------------------------------------------------------------

export interface ICameraCatalogo {
  codigo: string;
  modelo: string;
  formato: 'Dome' | 'Bullet';
  zoomOptico: boolean;
  consumoW: number;
  padrao?: boolean;
  observacao?: string;
}

export const CAMERAS_VIDEO: ICameraCatalogo[] = [
  { codigo: '3100050082', modelo: 'Intelbras VIP 5440 D Z IA', formato: 'Dome', zoomOptico: true, consumoW: 9.2, padrao: true },
  { codigo: '3100010165', modelo: 'Intelbras VIP 5460 Z IA', formato: 'Bullet', zoomOptico: true, consumoW: 9.2, observacao: 'Escassa — produção reduzida até novembro' },
  { codigo: '3100010149', modelo: 'Intelbras VIP 7550 Z IA FT', formato: 'Bullet', zoomOptico: true, consumoW: 13 },
  { codigo: '3100050075', modelo: 'Intelbras VIP 7550 D Z IA FT', formato: 'Dome', zoomOptico: true, consumoW: 13 },
  { codigo: '', modelo: 'Intelbras VIP 5440 IA', formato: 'Bullet', zoomOptico: false, consumoW: 7.2, observacao: 'Código CIGAM a preencher' },
  { codigo: '', modelo: 'Intelbras VIP 5440 D IA', formato: 'Dome', zoomOptico: false, consumoW: 8.3, observacao: 'Sem cadastro no CIGAM — não orçável' },
  { codigo: '', modelo: 'Dahua DH-IPC-HDBW4441E-AS', formato: 'Dome', zoomOptico: false, consumoW: 8.3, observacao: 'Código CIGAM a preencher' }
];

export const CAMERAS_OCR: ICameraCatalogo[] = [
  { codigo: '3100150035', modelo: 'Intelbras VIP 94180 LPR IA FT (até 4 pistas, 200 km/h)', formato: 'Bullet', zoomOptico: false, consumoW: 13, padrao: true },
  { codigo: '3100150038', modelo: 'Intelbras VIP 74120 LPR IA FT (1 pista, 120 km/h)', formato: 'Bullet', zoomOptico: false, consumoW: 17 },
  { codigo: '3100010183', modelo: 'Intelbras VIP 5460 LPR IA (1 pista, 60 km/h)', formato: 'Bullet', zoomOptico: false, consumoW: 17 },
  { codigo: '3100010156', modelo: 'Hikvision iDS-TCM403-BI (até 3 pistas, 5–120 km/h)', formato: 'Bullet', zoomOptico: false, consumoW: 15 },
  { codigo: '3100010100', modelo: 'Dahua DHI-ITC431-RW1F-IRL8 (1–2 pistas, 0–200 km/h)', formato: 'Bullet', zoomOptico: false, consumoW: 13 }
];

// Identificador do modelo (o código pode estar vazio).
export const idCamera = (camera: ICameraCatalogo): string => camera.codigo || camera.modelo;

export const CAMERA_VIDEO_PADRAO = CAMERAS_VIDEO[0];
export const CAMERA_OCR_PADRAO = CAMERAS_OCR[0];

// Margem do orçamento PoE (pior caso: WDR + IR + analítico).
export const MARGEM_POE = 1.25;

// ------------------------------------------------------------
// Switches (categoria de alta rotatividade — revisar sempre)
// ------------------------------------------------------------

export interface ISwitchCatalogo {
  codigo: string;
  modelo: string;
  poe: boolean;
  orcamentoW: number;
  portasPoe: number;
  padrao?: boolean;
}

export const SWITCHES: ISwitchCatalogo[] = [
  { codigo: '3300990064', modelo: 'Intelbras S1108F — 8 Fast Ethernet (sem PoE)', poe: false, orcamentoW: 0, portasPoe: 0, padrao: true },
  { codigo: '', modelo: 'TP-Link TL-SG108 — 8 Gigabit (sem PoE)', poe: false, orcamentoW: 0, portasPoe: 0 },
  { codigo: '4400010084', modelo: 'Intelbras S1105G-P — 4 PoE, 56 W', poe: true, orcamentoW: 56, portasPoe: 4 },
  { codigo: '', modelo: 'Intelbras S1110G-PA — 8 PoE, 84,47 W', poe: true, orcamentoW: 84.47, portasPoe: 8 },
  { codigo: '3300990065', modelo: 'Intelbras S1110F-P — 8 PoE, 53,25 W', poe: true, orcamentoW: 53.25, portasPoe: 8 },
  { codigo: '', modelo: 'TP-Link TL-SG1005LP V3 — 4 PoE, 40 W', poe: true, orcamentoW: 40, portasPoe: 4 }
];

export const idSwitch = (sw: ISwitchCatalogo): string => sw.codigo || sw.modelo;
export const SWITCH_PADRAO = SWITCHES[0];
export const SWITCH_CATRACA = SWITCHES[4];

// ------------------------------------------------------------
// Controladores de acesso facial
// ------------------------------------------------------------

export interface IControladorCatalogo {
  codigo: string;
  modelo: string;
  padrao?: boolean;
}

export const CONTROLADORES_PORTA: IControladorCatalogo[] = [
  { codigo: '5300010088', modelo: 'Intelbras SS 5542 MF W', padrao: true },
  { codigo: '5500010108', modelo: 'ZKTeco FaceDepot-7BL (alternativa)' }
];

export const CONTROLADOR_PNE: IControladorCatalogo = { codigo: '5300010089', modelo: 'Intelbras SS 3532 MF W' };

// ------------------------------------------------------------
// Estruturas Bridgefy
// ------------------------------------------------------------

export type EstruturaBridgefy = 'torre' | 'box' | 'mini';

export const ESTRUTURAS: Record<EstruturaBridgefy, {
  nome: string;
  codigoKit: string;
  maxCameras: number;
  aceitaOcr: boolean;
  sinalizacao: string;
}> = {
  torre: { nome: 'Torre Bridgefy', codigoKit: '6300050083', maxCameras: 4, aceitaOcr: true, sinalizacao: 'Giroled 128 LEDs' },
  box: { nome: 'Bridgefy Box', codigoKit: '6300050085', maxCameras: 2, aceitaOcr: false, sinalizacao: 'Fita LED' },
  mini: { nome: 'Bridgefy Mini (Wallfix)', codigoKit: '715/716.001.000x', maxCameras: 2, aceitaOcr: true, sinalizacao: 'Lanterna LED estrobo' }
};

// Itens de kit do Mini no CIGAM (por solução e canal) — referência.
export const KITS_MINI = [
  { codigo: '715.001.0003', descricao: 'Wallfix Bridgefy SafeWay — privado' },
  { codigo: '715.001.0004', descricao: 'Wallfix Bridgefy City — privado' },
  { codigo: '716.001.0003', descricao: 'Wallfix Bridgefy SafeWay — público' },
  { codigo: '716.001.0004', descricao: 'Wallfix Bridgefy City — público' }
];

// Packs do Digifort (câmeras), do maior para o menor.
export const PACKS_DIGIFORT: Array<{ cameras: number; chave: ChaveItem }> = [
  { cameras: 64, chave: 'digifortPack64' },
  { cameras: 32, chave: 'digifortPack32' },
  { cameras: 16, chave: 'digifortPack16' },
  { cameras: 8, chave: 'digifortPack8' },
  { cameras: 4, chave: 'digifortPack4' },
  { cameras: 2, chave: 'digifortPack2' }
];

export const CAMERAS_BASE_DIGIFORT = 8;
