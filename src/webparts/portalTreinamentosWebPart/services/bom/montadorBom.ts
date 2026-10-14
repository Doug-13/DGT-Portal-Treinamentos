import {
  CAMERAS_BASE_DIGIFORT,
  CAMERAS_OCR,
  CAMERAS_VIDEO,
  CAMERA_OCR_PADRAO,
  CAMERA_VIDEO_PADRAO,
  CONTROLADORES_PORTA,
  CONTROLADOR_PNE,
  ChaveItem,
  CategoriaItem,
  ESTRUTURAS,
  EstruturaBridgefy,
  ICameraCatalogo,
  ISwitchCatalogo,
  ITENS,
  MARGEM_POE,
  PACKS_DIGIFORT,
  SWITCHES,
  SWITCH_CATRACA,
  SWITCH_PADRAO,
  idCamera,
  idSwitch
} from './catalogoKits';

// ============================================================
// MONTADOR DE B.O.M. — REGRAS
//
// O usuário NÃO escolhe item por item. Informa, por ponto:
//   tipo de ponto · nº de câmeras/leitoras · nº de pontos iguais
// e as soluções de software. O montador devolve a lista completa
// (código CIGAM + quantidade) e as validações.
//
// Regra geral dos kits Bridgefy: kit-base + itens adicionais. A
// composição é calculada pelas regras abaixo — o resultado é igual
// aos kits cadastrados para as combinações que têm kit pronto.
// ============================================================

export type TipoPonto =
  | EstruturaBridgefy
  | 'portaEletroduto'
  | 'portaDutotec'
  | 'catraca';

export const TIPOS_PONTO: Array<{ tipo: TipoPonto; nome: string; grupo: 'Bridgefy' | 'Controle de acesso' }> = [
  { tipo: 'torre', nome: 'Torre Bridgefy', grupo: 'Bridgefy' },
  { tipo: 'box', nome: 'Bridgefy Box', grupo: 'Bridgefy' },
  { tipo: 'mini', nome: 'Bridgefy Mini (Wallfix)', grupo: 'Bridgefy' },
  { tipo: 'portaEletroduto', nome: 'Porta — eletroduto', grupo: 'Controle de acesso' },
  { tipo: 'portaDutotec', nome: 'Porta — dutotec', grupo: 'Controle de acesso' },
  { tipo: 'catraca', nome: 'Catraca — pedestal', grupo: 'Controle de acesso' }
];

export const ehBridgefy = (tipo: TipoPonto): tipo is EstruturaBridgefy =>
  tipo === 'torre' || tipo === 'box' || tipo === 'mini';

export interface IPontoKit {
  id: string;
  nome: string;
  tipo: TipoPonto;
  // Pontos iguais a este.
  quantidade: number;

  // Bridgefy
  camerasVideo: number;
  camerasOcr: number;
  faixasPorOcr: number;
  modeloVideo: string;
  modeloOcr: string;
  switchId: string;
  comunicacaoBidirecional: boolean;
  // Instalação alta (torre, poste, via pública) — Face Detect exige zoom.
  pontoAlto: boolean;

  // Controle de acesso
  usaWAccess: boolean;
  portaVidro: boolean;
  controladorPorta: string;
  catracas: number;
  catracasPne: number;
}

export type VmsBom = 'safeCity' | 'digifort';

export interface ISoftwaresKit {
  vms: VmsBom;
  smartDetect: boolean;
  faceDetect: boolean;
  digifortServidores: number;
  ipx: boolean;
  ipxPacotes: number;
  ipxIntegracao: boolean;
  waccessCadastros: number;
  waccessCanais: number;
}

export interface ISelecaoKit {
  versao: 1;
  pontos: IPontoKit[];
  softwares: ISoftwaresKit;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export interface IItemBom {
  codigo: string;
  descricao: string;
  categoria: CategoriaItem;
  quantidade: number;
  origem: string;
  // Sem código no CIGAM: não orçável até ser cadastrado.
  pendente: boolean;
}

export interface IAlertaBom {
  nivel: 'erro' | 'aviso';
  origem: string;
  mensagem: string;
}

export interface IResultadoBom {
  itens: IItemBom[];
  porPonto: Array<{ ponto: IPontoKit; itens: IItemBom[] }>;
  alertas: IAlertaBom[];
  totais: {
    pontos: number;
    camerasVideo: number;
    camerasOcr: number;
    leitoras: number;
  };
}

// ------------------------------------------------------------
// Valores iniciais
// ------------------------------------------------------------

let contador = 0;

export const novoPonto = (tipo: TipoPonto, indice: number): IPontoKit => {
  contador++;
  const nomeTipo = (TIPOS_PONTO.find(t => t.tipo === tipo) || { nome: tipo }).nome;
  return {
    id: `p${Date.now().toString(36)}${contador}`,
    nome: `${nomeTipo} ${indice}`,
    tipo,
    quantidade: 1,
    camerasVideo: tipo === 'torre' || tipo === 'box' || tipo === 'mini' ? 2 : 0,
    camerasOcr: 0,
    faixasPorOcr: 1,
    modeloVideo: idCamera(CAMERA_VIDEO_PADRAO),
    modeloOcr: idCamera(CAMERA_OCR_PADRAO),
    switchId: idSwitch(SWITCH_PADRAO),
    comunicacaoBidirecional: false,
    pontoAlto: tipo === 'torre' || tipo === 'mini',
    usaWAccess: true,
    portaVidro: false,
    controladorPorta: CONTROLADORES_PORTA[0].codigo,
    catracas: tipo === 'catraca' ? 1 : 0,
    catracasPne: 0
  };
};

export const softwaresPadrao = (): ISoftwaresKit => ({
  vms: 'safeCity',
  smartDetect: false,
  faceDetect: false,
  digifortServidores: 1,
  ipx: false,
  ipxPacotes: 1,
  ipxIntegracao: false,
  waccessCadastros: 0,
  waccessCanais: 0
});

export const selecaoVazia = (): ISelecaoKit => ({
  versao: 1,
  pontos: [],
  softwares: softwaresPadrao()
});

// ------------------------------------------------------------
// Auxiliares
// ------------------------------------------------------------

const inteiro = (valor: number, minimo = 0): number =>
  Math.max(minimo, Math.floor(Number(valor) || 0));

export const cameraVideo = (id: string): ICameraCatalogo =>
  CAMERAS_VIDEO.find(c => idCamera(c) === id) || CAMERA_VIDEO_PADRAO;

export const cameraOcr = (id: string): ICameraCatalogo =>
  CAMERAS_OCR.find(c => idCamera(c) === id) || CAMERA_OCR_PADRAO;

export const switchDe = (id: string): ISwitchCatalogo =>
  SWITCHES.find(s => idSwitch(s) === id) || SWITCH_PADRAO;

class Lista {
  public readonly itens: IItemBom[] = [];
  public constructor(private readonly origem: string) {}

  public adicionar(chave: ChaveItem, quantidade: number): void {
    const base = ITENS[chave];
    this.livre(base.codigo, base.descricao, base.categoria, quantidade);
  }

  public livre(codigo: string, descricao: string, categoria: CategoriaItem, quantidade: number): void {
    if (!(quantidade > 0)) {
      return;
    }
    const existente = this.itens.find(i => i.codigo === codigo && i.descricao === descricao);
    if (existente) {
      existente.quantidade += quantidade;
      return;
    }
    this.itens.push({ codigo, descricao, categoria, quantidade, origem: this.origem, pendente: !codigo });
  }
}

// ------------------------------------------------------------
// Ponto Bridgefy (Torre, Box, Mini)
// ------------------------------------------------------------

const montarBridgefy = (
  ponto: IPontoKit,
  softwares: ISoftwaresKit,
  alertas: IAlertaBom[]
): IItemBom[] => {

  const tipo = ponto.tipo as EstruturaBridgefy;
  const estrutura = ESTRUTURAS[tipo];
  const lista = new Lista(ponto.nome);
  const avisar = (nivel: 'erro' | 'aviso', mensagem: string): void => {
    alertas.push({ nivel, origem: ponto.nome, mensagem });
  };

  const nV = inteiro(ponto.camerasVideo);
  const nO = estrutura.aceitaOcr ? inteiro(ponto.camerasOcr) : 0;
  const total = nV + nO;
  const faixas = inteiro(ponto.faixasPorOcr, 1);
  const camVideo = cameraVideo(ponto.modeloVideo);
  const camOcr = cameraOcr(ponto.modeloOcr);
  const sw = switchDe(ponto.switchId);

  // ---- validações
  if (total === 0) {
    avisar('erro', 'Informe ao menos 1 câmera.');
  }
  if (total > estrutura.maxCameras) {
    avisar('erro', `${estrutura.nome} comporta até ${estrutura.maxCameras} câmeras (informadas: ${total}).`);
  }
  if (!estrutura.aceitaOcr && inteiro(ponto.camerasOcr) > 0) {
    avisar('erro', 'O Box não comporta câmera OCR/LPR (tamanho). Use Torre ou Mini.');
  }
  if (softwares.faceDetect && nV > 0 && ponto.pontoAlto && !camVideo.zoomOptico) {
    avisar('aviso', `Face Detect em ponto alto: ${camVideo.modelo} não tem zoom óptico (necessário em ~90% dos casos).`);
  }
  if (nV > 0 && !camVideo.codigo) {
    avisar('aviso', `${camVideo.modelo}: ${camVideo.observacao || 'sem código CIGAM'}.`);
  }
  if (nO > 0 && faixas > 4 && camOcr.codigo === CAMERA_OCR_PADRAO.codigo) {
    avisar('aviso', 'A VIP 94180 monitora até 4 pistas.');
  }

  if (sw.poe) {
    const consumo = (nV * camVideo.consumoW + nO * camOcr.consumoW) * MARGEM_POE;
    if (consumo > sw.orcamentoW) {
      avisar('erro', `Orçamento PoE insuficiente: ${consumo.toFixed(1)} W necessários (com margem de 25%) e o ${sw.modelo.split(' —')[0]} entrega ${sw.orcamentoW} W.`);
    }
    if (total > sw.portasPoe) {
      avisar('erro', `O switch tem ${sw.portasPoe} portas PoE para ${total} câmeras.`);
    }
    if (tipo !== 'torre') {
      avisar('aviso', `Com switch PoE as fontes das câmeras saem. Confirmar a alimentação da sinalização (${estrutura.sinalizacao}).`);
    }
  }

  // ---- câmeras
  if (nV > 0) {
    lista.livre(camVideo.codigo, `Câmera ${camVideo.modelo}`, 'Câmera', nV);
  }
  if (nO > 0) {
    lista.livre(camOcr.codigo, `Câmera OCR/LPR ${camOcr.modelo}`, 'Câmera', nO);
  }

  // ---- switch e fontes
  lista.livre(sw.codigo, `Switch ${sw.modelo}`, 'Equipamento', 1);

  const fontes =
    sw.poe
      ? (tipo === 'torre' ? 1 : 0)              // só a do giroled
      : total + (tipo === 'torre' ? 1 : 0);     // Torre: +1 do giroled
  lista.adicionar('fonte12v35', fontes);

  // ---- estrutura
  if (tipo === 'torre') {
    lista.adicionar('servicoImplantacaoTorre', 1);
    lista.adicionar('giroled', 1);
    lista.adicionar('filtroLinha', 1);
    lista.adicionar('suporteVideoTorre', nV);
    lista.adicionar('suporteOcrTorre', nO);
    lista.adicionar('servicoProjetoExecutivo', 1);
    // Regra: 1 por câmera além da primeira (pendência nº 4: o kit de
    // 3 câmeras cadastrado traz 1 unidade).
    lista.adicionar('servicoCameraAdicional', Math.max(0, total - 1));
    lista.adicionar('adesivoBridgefy190', 2);
    lista.adicionar('adesivoBridgefy153', 2);
    lista.adicionar('adesivoBridgefyDgt', 2);
    lista.adicionar('adesivoBridgefyQr', 2);
    lista.adicionar('adesivoBridgefy', 2);
    lista.adicionar('adesivoCamera', 2 * total);

    if (ponto.comunicacaoBidirecional) {
      lista.adicionar('suporteInterfone', 1);
      lista.adicionar('parafusoAutobrocante', 4);
      lista.adicionar('patchCord', 1);
      lista.adicionar('fonte12v35', 1);
      lista.adicionar('porteiroHikvision', 1);
    }
  }

  if (tipo === 'box') {
    lista.adicionar('servicoInstalacaoBox', 1);
    lista.adicionar('caixaBox', 1);
    lista.adicionar('kitFitaLedBox', 1);
    lista.adicionar('caixaHermetica', 1);
    lista.adicionar('tomadaMultipla5', 1);
    lista.adicionar('abracadeiraNailon', 18);
    lista.adicionar('fixadorChicote', 12);
  }

  if (tipo === 'mini') {
    lista.adicionar('servicoInstalacaoMini', 1);
    lista.adicionar('suporteMini', 1);
    lista.adicionar('lanternaMini', 1);
    lista.adicionar('caixaHermetica', 1);
    lista.adicionar('adesivoSuporteMini', 1);
    lista.adicionar('adesivoCamera', 2 * total);
    lista.adicionar('servicoProjetoExecutivo', 1);
  }

  // ---- licenças por câmera
  if (softwares.vms === 'safeCity') {
    lista.adicionar('licencaSafeCity', nV);
  }
  if (softwares.faceDetect) {
    lista.adicionar('licencaFaceDetect', nV);
  }
  // Safe Way: por FAIXA monitorada (mínimo 1 por câmera OCR).
  lista.adicionar('licencaSafeWay', nO * faixas);

  return lista.itens;
};

// ------------------------------------------------------------
// Pontos de porta
// ------------------------------------------------------------

const montarPorta = (
  ponto: IPontoKit,
  alertas: IAlertaBom[]
): IItemBom[] => {

  const dutotec = ponto.tipo === 'portaDutotec';
  const lista = new Lista(ponto.nome);
  const controlador =
    CONTROLADORES_PORTA.find(c => c.codigo === ponto.controladorPorta) || CONTROLADORES_PORTA[0];

  lista.livre(controlador.codigo, `Controlador de acesso facial ${controlador.modelo}`, 'Equipamento', 1);
  lista.adicionar(dutotec ? 'acionadorSobrepor' : 'acionadorEmbutir', 1);
  lista.adicionar('molaHidraulica', 1);
  lista.adicionar('fonte12v5', 1);
  lista.adicionar('caixaEmergencia', 1);
  lista.adicionar('dutotecDuto', 2);
  lista.adicionar('dutotecPortaEquip', 1);
  lista.adicionar('caboManga', 10);

  if (dutotec) {
    lista.adicionar('fechaduraFe21150', 1);
    if (ponto.portaVidro) {
      lista.adicionar('suporteVidro', 1);
    }
    lista.adicionar('parafusoPhilips', 10);
    lista.adicionar('buchaPlastica', 10);
  } else {
    lista.adicionar('releXr2201', 1);
    lista.adicionar('eletroduto34', 2);
    lista.adicionar('abracadeiraPvc34', 6);
    lista.adicionar('conectorBox', 2);
    lista.adicionar('tampaoCaixa', 3);
    lista.adicionar('condulete', 1);
    lista.adicionar('tampaCega', 1);
    lista.adicionar('parafusoPhilips', 5);
    lista.adicionar('buchaPlastica', 5);
  }

  // Serviço, cabo UTP e software: só quando o ponto usa o W-Access.
  if (ponto.usaWAccess) {
    lista.adicionar('servicoInstalacaoPonto', 1);
    lista.adicionar('caboUtp', 30);
    lista.adicionar('waccessLeitora', 1);
  } else {
    alertas.push({ nivel: 'aviso', origem: ponto.nome, mensagem: 'Ponto sem W-Access: serviço de instalação e cabo UTP não entram (regra da planilha). Confirmar.' });
  }

  return lista.itens;
};

// ------------------------------------------------------------
// Ponto de catraca (pedestal)
// ------------------------------------------------------------

const montarCatraca = (
  ponto: IPontoKit,
  alertas: IAlertaBom[]
): IItemBom[] => {

  const lista = new Lista(ponto.nome);
  const comuns = inteiro(ponto.catracas);
  const pne = inteiro(ponto.catracasPne);
  const total = comuns + pne;

  if (total === 0) {
    alertas.push({ nivel: 'erro', origem: ponto.nome, mensagem: 'Informe ao menos 1 catraca.' });
  }

  // Entrada e saída: 2 leitoras por catraca (a CAP3100 já traz as 2;
  // a PNE leva 2 controladores SS 3532 MF W + 2 suportes SC 3000).
  const leitoras = 2 * total;

  if (leitoras > SWITCH_CATRACA.portasPoe) {
    alertas.push({ nivel: 'aviso', origem: ponto.nome, mensagem: `${leitoras} leitoras para as ${SWITCH_CATRACA.portasPoe} portas PoE do S1110F-P — rever o switch do ponto.` });
  }

  lista.adicionar('catracaCap3100', comuns);
  lista.adicionar('catracaPne', pne);
  lista.adicionar('suporteSc3000', 2 * pne);
  lista.livre(CONTROLADOR_PNE.codigo, `Controlador de acesso facial ${CONTROLADOR_PNE.modelo}`, 'Equipamento', 2 * pne);

  lista.livre(SWITCH_CATRACA.codigo, `Switch ${SWITCH_CATRACA.modelo}`, 'Equipamento', 1);
  lista.adicionar('miniRack', 1);
  lista.adicionar('tomadaExterna', total);
  lista.adicionar('tomadaC3', 1);
  lista.adicionar('caixaDistribuicao', 1);
  lista.adicionar('disjuntor40', 1);
  lista.adicionar('cabo4Azul', 30);
  lista.adicionar('cabo4Preto', 30);
  lista.adicionar('cabo25Azul', 30);
  lista.adicionar('caboUtp', 30 * leitoras);
  lista.adicionar('conectorRj45', 2 * leitoras);

  // 30 m de energia + 30 m de rede a cada 2 catracas = 20 barras de 3 m
  // (máx. 4 cabos UTP por eletroduto).
  const barras = Math.ceil(total / 2) * 20;
  const abracadeiras = 4 * barras;
  lista.adicionar('eletroduto34', barras);
  lista.adicionar('abracadeiraPvc34', abracadeiras);
  lista.adicionar('parafusoPhilips', abracadeiras);
  lista.adicionar('buchaPlastica', abracadeiras);

  lista.adicionar('servicoEletroduto', barras);
  lista.adicionar('servicoCatraca', total);
  lista.adicionar('servicoLeitora', leitoras);

  if (ponto.usaWAccess) {
    lista.adicionar('waccessLeitora', leitoras);
  }

  return lista.itens;
};

// ------------------------------------------------------------
// Digifort: base de 8 câmeras POR SERVIDOR + packs
// ------------------------------------------------------------

export const packsDigifort = (
  cameras: number,
  servidores: number
): Array<{ chave: ChaveItem; quantidade: number }> => {

  const s = inteiro(servidores, 1);
  const resultado: Record<string, number> = {};

  for (let i = 0; i < s; i++) {
    // Divide as câmeras entre os servidores (o primeiro leva a sobra).
    const doServidor = Math.floor(cameras / s) + (i < cameras % s ? 1 : 0);
    let faltam = Math.max(0, doServidor - CAMERAS_BASE_DIGIFORT);

    // Menor pack que cobre o que falta; se nenhum cobre, o maior.
    while (faltam > 0) {
      const cobrem = PACKS_DIGIFORT.filter(p => p.cameras >= faltam);
      const pack =
        cobrem.length > 0
          ? cobrem[cobrem.length - 1]
          : PACKS_DIGIFORT[0];
      resultado[pack.chave] = (resultado[pack.chave] || 0) + 1;
      faltam -= pack.cameras;
    }
  }

  return [
    { chave: 'digifortBase8' as ChaveItem, quantidade: s },
    ...PACKS_DIGIFORT
      .filter(p => resultado[p.chave])
      .map(p => ({ chave: p.chave, quantidade: resultado[p.chave] }))
  ];
};

// ------------------------------------------------------------
// Montagem completa
// ------------------------------------------------------------

export const montarBom = (
  selecao: ISelecaoKit
): IResultadoBom => {

  const alertas: IAlertaBom[] = [];
  const porPonto: Array<{ ponto: IPontoKit; itens: IItemBom[] }> = [];
  const softwares = selecao.softwares;

  let camerasVideo = 0;
  let camerasOcr = 0;
  let leitoras = 0;
  let pontosAcesso = 0;
  let pontos = 0;

  selecao.pontos.forEach(ponto => {

    const qtd = inteiro(ponto.quantidade, 1);

    const itensUm =
      ehBridgefy(ponto.tipo)
        ? montarBridgefy(ponto, softwares, alertas)
        : ponto.tipo === 'catraca'
          ? montarCatraca(ponto, alertas)
          : montarPorta(ponto, alertas);

    porPonto.push({
      ponto,
      itens: itensUm.map(i => ({ ...i, quantidade: i.quantidade * qtd }))
    });

    pontos += qtd;

    if (ehBridgefy(ponto.tipo)) {
      camerasVideo += inteiro(ponto.camerasVideo) * qtd;
      camerasOcr += (ESTRUTURAS[ponto.tipo].aceitaOcr ? inteiro(ponto.camerasOcr) : 0) * qtd;
    } else {
      pontosAcesso += qtd;
      leitoras += (ponto.tipo === 'catraca' ? 2 * (inteiro(ponto.catracas) + inteiro(ponto.catracasPne)) : 1) * qtd;
    }
  });

  // ---- softwares do projeto
  const projeto = new Lista('Softwares do projeto');

  if (softwares.vms === 'digifort' && camerasVideo > 0) {
    if (!(inteiro(softwares.digifortServidores) > 0)) {
      alertas.push({ nivel: 'erro', origem: 'Digifort', mensagem: 'Informe o número de servidores: cada servidor exige a própria base de 8 câmeras.' });
    }
    packsDigifort(camerasVideo, softwares.digifortServidores).forEach(p => projeto.adicionar(p.chave, p.quantidade));
  }

  if (softwares.ipx) {
    if (softwares.vms !== 'digifort') {
      alertas.push({ nivel: 'erro', origem: 'IPX Analytics', mensagem: 'O IPX roda sobre o Digifort: selecione o Digifort como VMS.' });
    }
    projeto.adicionar('ipxAnalytics', camerasVideo * inteiro(softwares.ipxPacotes, 1));
    if (softwares.ipxIntegracao) {
      projeto.adicionar('ipxIntegracao', 1);
    }
  }

  if (pontosAcesso > 0 && selecao.pontos.some(p => !ehBridgefy(p.tipo) && p.usaWAccess)) {
    const cadastros = inteiro(softwares.waccessCadastros);
    const canais = inteiro(softwares.waccessCanais);
    if (cadastros === 0) {
      alertas.push({ nivel: 'aviso', origem: 'W-Access', mensagem: 'Informe o número de cadastros de face (1 licença a cada 1000).' });
    }
    if (canais === 0) {
      alertas.push({ nivel: 'aviso', origem: 'W-Access', mensagem: 'Informe os canais de visualização (1 licença a cada 2 conexões).' });
    }
    projeto.adicionar('waccess1000', Math.ceil(cadastros / 1000));
    projeto.adicionar('waccess2Conexoes', Math.ceil(canais / 2));
    alertas.push({ nivel: 'aviso', origem: 'W-Access', mensagem: 'O licenciamento varia conforme a cotação da Invenzi — confirmar neste projeto.' });
  }

  if (softwares.faceDetect) {
    alertas.push({ nivel: 'aviso', origem: 'Face Detect', mensagem: 'Licença ainda cadastrada como "Smart Face" no CIGAM — código a levantar.' });
  }

  if (softwares.vms === 'safeCity' && selecao.pontos.length > 0) {
    // v1: licença de 30 dias para os dois canais.
    alertas.push({ nivel: 'aviso', origem: 'Safe City', mensagem: 'Licença de 30 dias (3300990057) usada nos dois canais nesta versão.' });
  }

  if (projeto.itens.length > 0) {
    porPonto.push({ ponto: { ...novoPonto('torre', 0), id: 'softwares', nome: 'Softwares do projeto', quantidade: 1 }, itens: projeto.itens });
  }

  // ---- consolidação (mesmo código + descrição)
  const consolidado: IItemBom[] = [];

  porPonto.forEach(grupo => {
    grupo.itens.forEach(i => {
      const existente = consolidado.find(c => c.codigo === i.codigo && c.descricao === i.descricao);
      if (existente) {
        existente.quantidade += i.quantidade;
        if (existente.origem.indexOf(i.origem) < 0) {
          existente.origem = `${existente.origem}; ${i.origem}`;
        }
      } else {
        consolidado.push({ ...i });
      }
    });
  });

  const ordemCategoria: CategoriaItem[] = ['Câmera', 'Equipamento', 'Infraestrutura', 'Licença', 'Serviço', 'Identificação'];
  consolidado.sort((a, b) =>
    ordemCategoria.indexOf(a.categoria) - ordemCategoria.indexOf(b.categoria) ||
    a.descricao.localeCompare(b.descricao));

  if (consolidado.some(i => i.pendente)) {
    alertas.push({ nivel: 'aviso', origem: 'CIGAM', mensagem: 'Há itens sem código no CIGAM (marcados como pendentes): não são orçáveis até o cadastro.' });
  }

  return {
    itens: consolidado,
    porPonto,
    alertas,
    totais: { pontos, camerasVideo, camerasOcr, leitoras }
  };
};

// CSV (separador ;) para levar a lista à planilha/CIGAM.
export const csvDoBom = (resultado: IResultadoBom): string => {
  const linhas = [['Código', 'Descrição', 'Categoria', 'Quantidade', 'Origem', 'Pendente']];
  resultado.itens.forEach(i => linhas.push([
    i.codigo, i.descricao, i.categoria, String(i.quantidade), i.origem, i.pendente ? 'Sim' : ''
  ]));
  return linhas
    .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
};
