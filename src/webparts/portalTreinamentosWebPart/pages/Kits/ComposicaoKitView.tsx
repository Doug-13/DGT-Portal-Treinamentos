import * as React from 'react';

import {
  CONDICOES,
  ChaveKit,
  CondicaoComponente,
  IComponenteKit,
  ITENS,
  KITS,
  REGRAS_QUANTIDADE,
  RegraQuantidade,
  catalogoPadrao
} from '../../services/bom/catalogoKits';

import {
  IItemBom,
  ISelecaoKit,
  TipoPonto,
  montarBom,
  novoPonto,
  softwaresPadrao
} from '../../services/bom/montadorBom';

import {
  ICatalogoKitsCarregado,
  IKitParametros
} from '../../services/bom/KitsService';

import {
  IconeKit,
  NomeIconeKit
} from '../Arquitetura/IconesKit';

import {
  Aviso,
  COR,
  CampoMotivo,
  Interruptor,
  Modal,
  Numero,
  Selo,
  ajuda,
  botao,
  campo,
  formatarQtd,
  painel,
  rotulo
} from './kitsComum';

// ============================================================
// KITS — COMPOSIÇÃO DE CADA KIT
//
// Lado esquerdo: o que entra no kit-base, escrito como frase
// ("2 × Adesivo câmera, por câmera"). Lado direito: a PRÉVIA de um
// ponto real, recalculada a cada mudança, marcando o que entra,
// sai ou muda em relação ao que está gravado. Nada vai para o
// montador antes de "Salvar alterações".
// ============================================================

interface ILinha extends IComponenteKit {
  k: string;
}

let sequencia = 0;
const comChave = (linhas: IComponenteKit[]): ILinha[] =>
  linhas.map(l => ({ ...l, k: l.id || `n${++sequencia}` }));

const semChave = (linhas: ILinha[]): IComponenteKit[] =>
  linhas.map(l => ({ id: l.id, chaveItem: l.chaveItem, quantidade: l.quantidade, regra: l.regra, condicao: l.condicao, observacao: l.observacao }));

const ehBridgefy = (kit: ChaveKit): boolean => kit === 'torre' || kit === 'box' || kit === 'mini';

const frasesRegra: Record<RegraQuantidade, string> = {
  fixa: 'por ponto',
  porCamera: 'por câmera',
  porCameraVideo: 'por câmera de vídeo',
  porCameraOcr: 'por câmera OCR/LPR',
  porCameraAlemPrimeira: 'por câmera além da 1ª'
};

// Resumo das diferenças entre o gravado e o rascunho.
export const resumoDiferencas = (antes: IComponenteKit[], depois: IComponenteKit[]): { texto: string; total: number } => {
  const chave = (l: IComponenteKit): string => `${l.chaveItem}|${l.condicao}`;
  const mapaAntes: Record<string, IComponenteKit> = {};
  antes.forEach(l => { mapaAntes[chave(l)] = l; });
  const mapaDepois: Record<string, IComponenteKit> = {};
  depois.forEach(l => { mapaDepois[chave(l)] = l; });
  const incluidos = depois.filter(l => !mapaAntes[chave(l)]).length;
  const retirados = antes.filter(l => !mapaDepois[chave(l)]).length;
  const alterados = depois.filter(l => {
    const a = mapaAntes[chave(l)];
    return a && (Number(a.quantidade) !== Number(l.quantidade) || a.regra !== l.regra || (a.observacao || '') !== (l.observacao || ''));
  }).length;
  const ordem = incluidos + retirados + alterados === 0 && antes.map(chave).join() !== depois.map(chave).join() ? 1 : 0;
  const partes: string[] = [];
  if (incluidos) { partes.push(`${incluidos} ${incluidos === 1 ? 'item incluído' : 'itens incluídos'}`); }
  if (retirados) { partes.push(`${retirados} ${retirados === 1 ? 'item retirado' : 'itens retirados'}`); }
  if (alterados) { partes.push(`${alterados} ${alterados === 1 ? 'item alterado' : 'itens alterados'}`); }
  if (ordem) { partes.push('ordem alterada'); }
  return { texto: partes.join(', '), total: incluidos + retirados + alterados + ordem };
};

const mesmosParametros = (a: IKitParametros, b: IKitParametros): boolean =>
  a.nome === b.nome && a.codigoCigam === b.codigoCigam && a.maxCameras === b.maxCameras &&
  a.aceitaOcr === b.aceitaOcr && a.sinalizacao === b.sinalizacao && a.descricao === b.descricao;

// ------------------------------------------------------------
// Prévia
// ------------------------------------------------------------

interface IPrevia {
  camerasVideo: number;
  camerasOcr: number;
  bidirecional: boolean;
  portaVidro: boolean;
  usaWAccess: boolean;
}

const selecaoDaPrevia = (kit: ChaveKit, previa: IPrevia): ISelecaoKit => {
  const ponto = {
    ...novoPonto(kit as TipoPonto, 1),
    id: 'previa',
    nome: 'Prévia',
    camerasVideo: previa.camerasVideo,
    camerasOcr: previa.camerasOcr,
    safeCity: previa.camerasVideo > 0,
    safeWay: previa.camerasOcr > 0,
    comunicacaoBidirecional: previa.bidirecional,
    portaVidro: previa.portaVidro,
    usaWAccess: previa.usaWAccess
  };
  return { versao: 1, pontos: [ponto], softwares: softwaresPadrao() };
};

type Marca = 'igual' | 'novo' | 'sai' | 'muda';

interface ILinhaPrevia {
  item: IItemBom;
  marca: Marca;
  antes?: number;
}

const compararPrevia = (gravado: IItemBom[], rascunho: IItemBom[]): ILinhaPrevia[] => {
  const id = (i: IItemBom): string => `${i.codigo}|${i.descricao}`;
  const linhas: ILinhaPrevia[] = rascunho.map(item => {
    const antes = gravado.find(g => id(g) === id(item));
    if (!antes) {
      return { item, marca: 'novo' };
    }
    return antes.quantidade !== item.quantidade ? { item, marca: 'muda', antes: antes.quantidade } : { item, marca: 'igual' };
  });
  gravado.filter(g => !rascunho.some(r => id(r) === id(g))).forEach(item => linhas.push({ item, marca: 'sai' }));
  return linhas;
};

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

export interface IComposicaoKitViewProps {
  catalogo: ICatalogoKitsCarregado;
  podeEditar: boolean;
  kitInicial?: ChaveKit;
  aoSalvar: (dados: {
    kit: ChaveKit;
    composicao?: { nova: IComponenteKit[]; anterior: IComponenteKit[]; resumo: string };
    parametros?: { novo: IKitParametros; anterior: IKitParametros };
    motivo: string;
  }) => Promise<void>;
  // Avisa a página que há alterações não salvas (para confirmar ao sair).
  aoMudarPendencia?: (pendente: boolean) => void;
}

const ComposicaoKitView: React.FC<IComposicaoKitViewProps> = ({ catalogo, podeEditar, kitInicial, aoSalvar, aoMudarPendencia }) => {

  const [kit, setKit] = React.useState<ChaveKit>(kitInicial || 'torre');
  const gravada = React.useMemo(() => catalogo.composicoes[kit] || [], [catalogo, kit]);
  const parametrosGravados = React.useMemo(
    () => catalogo.kits.find(k => k.chave === kit) as IKitParametros,
    [catalogo, kit]);

  const [linhas, setLinhas] = React.useState<ILinha[]>(() => comChave(gravada));
  const [parametros, setParametros] = React.useState<IKitParametros>(parametrosGravados);
  const [previa, setPrevia] = React.useState<IPrevia>({ camerasVideo: 2, camerasOcr: 0, bidirecional: false, portaVidro: false, usaWAccess: true });
  const [confirmar, setConfirmar] = React.useState(false);
  const [motivo, setMotivo] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [largo, setLargo] = React.useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1150 : true);

  React.useEffect(() => {
    const aoRedimensionar = (): void => setLargo(window.innerWidth >= 1150);
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  // Trocou de kit ou recarregou o catálogo: rascunho volta ao gravado.
  React.useEffect(() => {
    setLinhas(comChave(gravada));
    setParametros(parametrosGravados);
    setErro('');
  }, [gravada, parametrosGravados]);

  const info = KITS.find(k => k.chave === kit) || KITS[0];
  const bridgefy = ehBridgefy(kit);
  const editavel = podeEditar && info.editavel;
  const diferencas = resumoDiferencas(gravada, semChave(linhas));
  const parametrosMudaram = !!parametros && !!parametrosGravados && !mesmosParametros(parametros, parametrosGravados);
  const pendente = diferencas.total > 0 || parametrosMudaram;

  React.useEffect(() => {
    if (aoMudarPendencia) {
      aoMudarPendencia(pendente);
    }
  }, [pendente, aoMudarPendencia]);

  const trocarKit = (novo: ChaveKit): void => {
    if (novo === kit) {
      return;
    }
    if (pendente && !window.confirm('Há alterações não salvas neste kit. Descartar e trocar de kit?')) {
      return;
    }
    setKit(novo);
  };

  // ---------------- edição das linhas ----------------

  const mudarLinha = (k: string, parcial: Partial<IComponenteKit>): void =>
    setLinhas(atual => atual.map(l => (l.k === k ? { ...l, ...parcial } : l)));

  const removerLinha = (k: string): void =>
    setLinhas(atual => atual.filter(l => l.k !== k));

  const mover = (k: string, delta: number): void =>
    setLinhas(atual => {
      const i = atual.findIndex(l => l.k === k);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= atual.length) {
        return atual;
      }
      const copia = atual.slice();
      const [linha] = copia.splice(i, 1);
      copia.splice(j, 0, linha);
      return copia;
    });

  const adicionar = (condicao: CondicaoComponente): void =>
    setLinhas(atual => [...atual, { k: `n${++sequencia}`, chaveItem: '', quantidade: 1, regra: 'fixa', condicao }]);

  const restaurarPadrao = (): void => {
    if (!window.confirm('Trocar o rascunho pela composição padrão do sistema? Nada é gravado até você salvar.')) {
      return;
    }
    const padrao = catalogoPadrao().composicoes[kit] || [];
    // Reaproveita os ids gravados das linhas equivalentes (mesmo item e condição).
    const usados: string[] = [];
    setLinhas(padrao.map(l => {
      const igual = gravada.find(g => g.id && usados.indexOf(g.id) < 0 && g.chaveItem === l.chaveItem && g.condicao === l.condicao);
      if (igual && igual.id) {
        usados.push(igual.id);
      }
      return { ...l, id: igual ? igual.id : undefined, k: igual && igual.id ? igual.id : `n${++sequencia}` };
    }));
  };

  // ---------------- validações ----------------

  const problemas: string[] = [];
  linhas.forEach(l => {
    const item = ITENS[l.chaveItem];
    if (!l.chaveItem) {
      problemas.push('Há uma linha sem item escolhido.');
    } else if (!item) {
      problemas.push(`O item "${l.chaveItem}" não existe no catálogo.`);
    } else if (item.ativo === false) {
      problemas.push(`"${item.descricao}" está desativado no catálogo.`);
    }
    if (!(Number(l.quantidade) > 0)) {
      problemas.push(`${item ? item.descricao : 'Uma linha'}: quantidade precisa ser maior que zero.`);
    }
  });
  const repetidas = linhas.filter((l, i) => l.chaveItem && linhas.findIndex(o => o.chaveItem === l.chaveItem && o.condicao === l.condicao) !== i);
  repetidas.forEach(l => problemas.push(`"${ITENS[l.chaveItem] ? ITENS[l.chaveItem].descricao : l.chaveItem}" aparece duas vezes na mesma condição: some as quantidades numa linha só.`));
  const bloqueiaSalvar = linhas.some(l => !l.chaveItem || !(Number(l.quantidade) > 0)) || repetidas.length > 0;

  // ---------------- prévia ----------------

  const resultadoGravado = React.useMemo(
    () => montarBom(selecaoDaPrevia(kit, previa)),
    // catalogo: depois de gravar, o montador já usa o catálogo novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kit, previa, catalogo]);

  const resultadoRascunho = React.useMemo(
    () => montarBom(selecaoDaPrevia(kit, previa), { composicoes: { [kit]: semChave(linhas) } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kit, previa, linhas, catalogo]);

  const linhasPrevia = compararPrevia(resultadoGravado.itens, resultadoRascunho.itens);

  // ---------------- gravação ----------------

  const salvar = async (): Promise<void> => {
    if (!motivo.trim()) {
      setErro('Informe o motivo da alteração.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({
        kit,
        composicao: diferencas.total > 0 ? { nova: semChave(linhas), anterior: gravada, resumo: diferencas.texto } : undefined,
        parametros: parametrosMudaram ? { novo: parametros, anterior: parametrosGravados } : undefined,
        motivo: motivo.trim()
      });
      setConfirmar(false);
      setMotivo('');
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  // ---------------- itens para escolha ----------------

  const opcoesItens = React.useMemo(() => {
    const grupos: Record<string, Array<{ chave: string; texto: string }>> = {};
    catalogo.itens
      .filter(i => i.tipo === 'item' && i.ativo)
      .sort((a, b) => a.descricao.localeCompare(b.descricao))
      .forEach(i => {
        (grupos[i.categoria] = grupos[i.categoria] || []).push({ chave: i.chave, texto: `${i.descricao}${i.codigo ? ` (${i.codigo})` : ' — sem código'}` });
      });
    return grupos;
  }, [catalogo]);

  const regrasDoKit = REGRAS_QUANTIDADE.filter(r => bridgefy || !r.soBridgefy);
  const condicoesDoKit = CONDICOES.filter(c => c.kits.indexOf(kit) >= 0);

  // ---------------- renderização ----------------

  const seletorKits = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '10px', marginBottom: '16px' }} role="tablist" aria-label="Kits">
      {KITS.map(k => {
        const ativo = k.chave === kit;
        const qtd = (catalogo.composicoes[k.chave] || []).length;
        return (
          <button
            key={k.chave}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => trocarKit(k.chave)}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1px solid ${ativo ? COR.azul : COR.cinzaClaro}`,
              background: ativo ? COR.azul : COR.branco,
              color: ativo ? COR.branco : COR.azul,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: ativo ? `inset 0 -3px 0 ${COR.ciano}` : 'none'
            }}
          >
            <IconeKit nome={k.chave as NomeIconeKit} tamanho={22} cor={ativo ? COR.ciano : COR.azul} />
            <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '6px' }}>{k.nome}</div>
            <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '2px' }}>
              {k.editavel ? `${qtd} ${qtd === 1 ? 'item no kit-base' : 'itens no kit-base'}` : 'calculado por fórmula'}
            </div>
          </button>
        );
      })}
    </div>
  );

  if (!info.editavel) {
    return (
      <div>
        {seletorKits}
        <div style={painel}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: COR.azul, textTransform: 'uppercase' }}>{info.nome}</h3>
          <p style={{ margin: '0 0 12px', color: COR.texto2, fontSize: '14px', lineHeight: 1.5, maxWidth: '75ch' }}>
            A catraca não tem kit-base fixo: tudo é calculado a partir do número de catracas comuns e PNE.
            Para mudar estas regras é preciso alterar o código do montador (montadorBom.ts).
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', color: COR.azul, fontSize: '13.5px', lineHeight: 1.7 }}>
            <li>2 leitoras por catraca (entrada e saída). A CAP3100 já traz as duas; a PNE leva 2 controladores e 2 suportes SC 3000.</li>
            <li>1 switch de catraca, 1 mini rack, 1 tomada C3, 1 caixa de distribuição e 1 disjuntor 40 A por ponto.</li>
            <li>1 tomada externa por catraca; 30 m de cabo 4 mm² azul, 4 mm² preto e 2,5 mm² azul por ponto.</li>
            <li>30 m de cabo UTP e 2 conectores RJ45 por leitora.</li>
            <li>A cada 2 catracas: 20 barras de eletroduto de 3/4 (30 m de energia + 30 m de rede); 4 abraçadeiras, parafusos e buchas por barra.</li>
            <li>Serviços: eletroduto por barra, instalação de catraca por catraca e configuração de leitora por leitora.</li>
            <li>Com W-Access: 1 licença de leitora facial por leitora.</li>
          </ul>
        </div>
      </div>
    );
  }

  const automaticos = bridgefy
    ? [
      'Câmeras de vídeo e OCR/LPR, no modelo escolhido no ponto.',
      'Switch escolhido no ponto (o montador confere o orçamento PoE).',
      kit === 'torre'
        ? 'Fontes 12 V: 1 por câmera sem PoE, mais 1 do giroled.'
        : 'Fontes 12 V: 1 por câmera quando o switch não é PoE.',
      'Licenças por câmera: Safe City, Face Detect; Safe Way por faixa monitorada.'
    ]
    : [
      'Controlador de acesso facial escolhido no ponto.',
      'Licenças de projeto do W-Access (cadastros e canais), somadas no projeto.'
    ];

  const linhaEditor = (l: ILinha, indice: number, total: number): React.ReactElement => {
    const item = ITENS[l.chaveItem] as (typeof ITENS)[string] | undefined;
    const problema = !l.chaveItem || !item || item.ativo === false;
    if (!editavel) {
      return (
        <li key={l.k} style={{ display: 'flex', gap: '10px', alignItems: 'baseline', padding: '8px 0', borderTop: indice ? `1px solid ${COR.azulClaro}` : 0 }}>
          <span style={{ minWidth: '54px', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>{formatarQtd(l.quantidade)} ×</span>
          <span style={{ flex: 1 }}>
            {item ? item.descricao : <em>item “{l.chaveItem}” não cadastrado</em>}
            <span style={{ color: COR.texto2 }}> {frasesRegra[l.regra]}</span>
            {item && !item.codigo && <> <Selo tom="indigo">! sem código</Selo></>}
          </span>
        </li>
      );
    }
    const pequeno: React.CSSProperties = { ...botao('discreto'), minHeight: '30px', padding: '0 6px', fontSize: '15px' };
    return (
      <li key={l.k} style={{ display: 'grid', gridTemplateColumns: largo ? 'minmax(0, 1fr) auto 148px auto' : '1fr', gap: '8px', alignItems: 'center', padding: '8px 10px', margin: '0 -10px', borderTop: indice ? `1px solid ${COR.azulClaro}` : 0, background: problema ? COR.indigoClaro : 'transparent', borderRadius: '6px' }}>
        <select aria-label="Item" style={campo} value={l.chaveItem} onChange={e => mudarLinha(l.k, { chaveItem: e.target.value })}>
          <option value="">Escolha um item…</option>
          {l.chaveItem && !(opcoesItens[item ? item.categoria : ''] || []).some(o => o.chave === l.chaveItem) && (
            <option value={l.chaveItem}>{item ? `${item.descricao} (desativado)` : `${l.chaveItem} (não cadastrado)`}</option>
          )}
          {Object.keys(opcoesItens).map(cat => (
            <optgroup key={cat} label={cat}>
              {opcoesItens[cat].map(o => <option key={o.chave} value={o.chave}>{o.texto}</option>)}
            </optgroup>
          ))}
        </select>
        <Numero valor={Number(l.quantidade) || 0} minimo={0} maximo={9999} passo={1} rotuloAcessivel="Quantidade" aoMudar={n => mudarLinha(l.k, { quantidade: n })} />
        <select aria-label="Regra de quantidade" style={campo} value={l.regra} onChange={e => mudarLinha(l.k, { regra: e.target.value as RegraQuantidade })} title={(REGRAS_QUANTIDADE.find(r => r.regra === l.regra) || { explicacao: '' }).explicacao}>
          {regrasDoKit.map(r => <option key={r.regra} value={r.regra}>{r.nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
          <button type="button" style={pequeno} aria-label="Subir" title="Subir" disabled={indice === 0} onClick={() => mover(l.k, -1)}>↑</button>
          <button type="button" style={pequeno} aria-label="Descer" title="Descer" disabled={indice === total - 1} onClick={() => mover(l.k, 1)}>↓</button>
          {condicoesDoKit.length > 1 && (
            <select aria-label="Quando entra" title="Quando este item entra" style={{ ...campo, width: '96px', minHeight: '30px', padding: '4px 4px', fontSize: '12px' }} value={l.condicao} onChange={e => mudarLinha(l.k, { condicao: e.target.value as CondicaoComponente })}>
              {condicoesDoKit.map(c => <option key={c.condicao} value={c.condicao}>{c.nome}</option>)}
            </select>
          )}
          <button type="button" style={{ ...pequeno, color: COR.indigo }} aria-label="Retirar do kit" title="Retirar do kit" onClick={() => removerLinha(l.k)}>
            <IconeKit nome="lixeira" tamanho={16} />
          </button>
        </div>
      </li>
    );
  };

  const painelComposicao = (
    <div style={painel}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: COR.azul, textTransform: 'uppercase', letterSpacing: '.02em' }}>{parametros ? parametros.nome : info.nome}</h3>
          <div style={{ ...ajuda, marginTop: '3px' }}>{info.resumo}</div>
        </div>
        {catalogo.composicaoGravada[kit] ? <Selo tom="ciano">✓ gravado no Dataverse</Selo> : <Selo tom="cinza">usando o padrão do sistema</Selo>}
      </div>

      {parametros && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', padding: '12px 14px', background: '#F7F8FA', borderRadius: '8px', marginBottom: '16px', alignItems: 'end' }}>
          <div>
            <label style={rotulo}>Código do kit no CIGAM</label>
            <input style={campo} value={parametros.codigoCigam} disabled={!editavel} onChange={e => setParametros({ ...parametros, codigoCigam: e.target.value })} />
          </div>
          {bridgefy && (
            <>
              <div>
                <label style={rotulo}>Máximo de câmeras</label>
                <Numero valor={parametros.maxCameras} minimo={1} maximo={16} desabilitado={!editavel} rotuloAcessivel="Máximo de câmeras" aoMudar={n => setParametros({ ...parametros, maxCameras: n })} />
              </div>
              <div>
                <label style={rotulo}>Sinalização</label>
                <input style={campo} value={parametros.sinalizacao} disabled={!editavel} onChange={e => setParametros({ ...parametros, sinalizacao: e.target.value })} />
              </div>
              <div style={{ paddingBottom: '8px' }}>
                <Interruptor marcado={parametros.aceitaOcr} desabilitado={!editavel} texto="Aceita câmera OCR/LPR" aoMudar={v => setParametros({ ...parametros, aceitaOcr: v })} />
              </div>
            </>
          )}
        </div>
      )}

      <details style={{ marginBottom: '16px', fontSize: '13px', color: COR.texto2 }}>
        <summary style={{ cursor: 'pointer', color: COR.azul, fontWeight: 600 }}>O que o montador acrescenta sozinho neste kit</summary>
        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', lineHeight: 1.65 }}>
          {automaticos.map(t => <li key={t}>{t}</li>)}
        </ul>
        <div style={{ marginTop: '6px' }}>Esses itens dependem das escolhas feitas em cada ponto e não ficam na lista abaixo.</div>
      </details>

      {condicoesDoKit.map(cond => {
        const doGrupo = linhas.filter(l => l.condicao === cond.condicao);
        if (!editavel && doGrupo.length === 0) {
          return null;
        }
        return (
          <section key={cond.condicao} style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', borderBottom: `2px solid ${cond.condicao === 'sempre' ? COR.azul : COR.ciano}`, paddingBottom: '6px', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.04em', color: COR.azul }}>
                {cond.condicao === 'sempre' ? 'Entra sempre' : `Só ${cond.nome.charAt(0).toLowerCase()}${cond.nome.slice(1)}`}
              </h4>
              <span style={{ fontSize: '12px', color: COR.texto2 }}>{cond.explicacao}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, color: COR.azul, fontSize: '13.5px' }}>
              {doGrupo.map((l, i) => linhaEditor(l, i, doGrupo.length))}
              {doGrupo.length === 0 && <li style={{ padding: '8px 0', color: COR.texto2, fontSize: '13px' }}>Nenhum item nesta condição.</li>}
            </ul>
            {editavel && (
              <button type="button" style={{ ...botao('discreto'), marginTop: '4px', color: '#036E7D' }} onClick={() => adicionar(cond.condicao)}>
                <IconeKit nome="mais" tamanho={15} /> Adicionar item
              </button>
            )}
          </section>
        );
      })}

      {editavel && (
        <div style={{ ...ajuda, borderTop: `1px solid ${COR.cinzaClaro}`, paddingTop: '10px' }}>
          Regras de quantidade: {regrasDoKit.map(r => `${r.nome} — ${r.explicacao}`).join(' ')}
        </div>
      )}
    </div>
  );

  const contagemMarca = (m: Marca): number => linhasPrevia.filter(l => l.marca === m).length;

  const painelPrevia = (
    <div style={{ ...painel, position: largo ? 'sticky' : 'static', top: '12px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>Prévia de um ponto</h3>
      <div style={{ ...ajuda, marginTop: 0, marginBottom: '12px' }}>Mude os valores para ver o que o montador gera com o kit {pendente ? 'como está no rascunho' : 'gravado'}.</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end', marginBottom: '14px' }}>
        {bridgefy ? (
          <>
            <div>
              <label style={rotulo}>Câmeras de vídeo</label>
              <Numero valor={previa.camerasVideo} maximo={parametros ? parametros.maxCameras : 4} rotuloAcessivel="Câmeras de vídeo" aoMudar={n => setPrevia({ ...previa, camerasVideo: n })} />
            </div>
            {parametros && parametros.aceitaOcr && (
              <div>
                <label style={rotulo}>Câmeras OCR/LPR</label>
                <Numero valor={previa.camerasOcr} maximo={parametros.maxCameras} rotuloAcessivel="Câmeras OCR" aoMudar={n => setPrevia({ ...previa, camerasOcr: n })} />
              </div>
            )}
            {kit === 'torre' && <Interruptor marcado={previa.bidirecional} texto="Comunicação bidirecional" aoMudar={v => setPrevia({ ...previa, bidirecional: v })} />}
          </>
        ) : (
          <>
            <Interruptor marcado={previa.usaWAccess} texto="Usa W-Access" aoMudar={v => setPrevia({ ...previa, usaWAccess: v })} />
            {kit === 'portaDutotec' && <Interruptor marcado={previa.portaVidro} texto="Porta de vidro" aoMudar={v => setPrevia({ ...previa, portaVidro: v })} />}
          </>
        )}
      </div>

      {pendente && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {contagemMarca('novo') > 0 && <Selo tom="ciano">+ {contagemMarca('novo')} entra</Selo>}
          {contagemMarca('muda') > 0 && <Selo tom="azul">≠ {contagemMarca('muda')} muda</Selo>}
          {contagemMarca('sai') > 0 && <Selo tom="indigo">− {contagemMarca('sai')} sai</Selo>}
        </div>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '13px', color: COR.azul, maxHeight: '460px', overflowY: 'auto' }}>
        {linhasPrevia.map(({ item, marca, antes }) => (
          <li key={`${item.codigo}|${item.descricao}|${marca}`} style={{ display: 'flex', gap: '8px', padding: '6px 4px', borderTop: `1px solid ${COR.azulClaro}`, background: marca === 'novo' ? COR.cianoClaro : marca === 'sai' ? COR.indigoClaro : marca === 'muda' ? COR.azulClaro : 'transparent', textDecoration: marca === 'sai' ? 'line-through' : 'none' }}>
            <span style={{ minWidth: '50px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }} title={marca === 'muda' ? `Antes: ${formatarQtd(antes || 0)}` : undefined}>
              {marca === 'muda' ? <><span style={{ color: COR.cinza, fontWeight: 500 }}>{formatarQtd(antes || 0)}→</span>{formatarQtd(item.quantidade)}</> : formatarQtd(item.quantidade)}
            </span>
            <span style={{ flex: 1 }}>{item.descricao}</span>
            <span style={{ color: item.codigo ? COR.texto2 : COR.indigo, whiteSpace: 'nowrap', fontSize: '12px' }}>{item.codigo || 'sem código'}</span>
          </li>
        ))}
      </ul>

      {resultadoRascunho.alertas.filter(a => a.nivel === 'erro').map(a => (
        <div key={a.mensagem} style={{ marginTop: '8px', fontSize: '12.5px', color: COR.indigo, fontWeight: 600 }}>! {a.mensagem}</div>
      ))}
    </div>
  );

  return (
    <div>
      {seletorKits}

      {!podeEditar && <Aviso tipo="info">Modo consulta: você vê como cada kit é montado. Alterações ficam com o administrador do módulo Kits.</Aviso>}

      {editavel && pendente && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '14px', background: COR.azul, color: COR.branco, borderRadius: '8px', boxShadow: `inset 4px 0 0 ${COR.ciano}` }}>
          <span style={{ flex: 1, fontSize: '13.5px' }}>
            <strong>Alterações não salvas:</strong> {[diferencas.texto, parametrosMudaram ? 'parâmetros do kit' : ''].filter(Boolean).join(', ')}.
            {' '}O montador só passa a usar depois de salvar.
          </span>
          <button type="button" style={{ ...botao('secundario'), background: 'transparent', color: COR.branco, borderColor: 'rgba(255,255,255,.4)' }} onClick={() => { setLinhas(comChave(gravada)); setParametros(parametrosGravados); }}>Descartar</button>
          <button type="button" style={{ ...botao('principal', bloqueiaSalvar), background: COR.ciano, color: COR.azul }} disabled={bloqueiaSalvar} title={bloqueiaSalvar ? 'Corrija os pontos indicados antes de salvar' : undefined} onClick={() => setConfirmar(true)}>Salvar alterações</button>
        </div>
      )}

      {editavel && problemas.length > 0 && (
        <Aviso tipo="alerta">
          {problemas.filter((p, i) => problemas.indexOf(p) === i).slice(0, 4).map(p => <div key={p}>{p}</div>)}
        </Aviso>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: largo ? 'minmax(0, 1.7fr) minmax(320px, 1fr)' : '1fr', gap: '16px', alignItems: 'start' }}>
        {painelComposicao}
        {painelPrevia}
      </div>

      {editavel && (
        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <button type="button" style={botao('discreto')} onClick={restaurarPadrao}>Restaurar a composição padrão do sistema</button>
        </div>
      )}

      {confirmar && (
        <Modal
          titulo={`Salvar ${info.nome}`}
          subtitulo="A partir de agora o montador de B.O.M. usa esta composição em todos os novos cálculos."
          aoFechar={() => setConfirmar(false)}
          rodape={(
            <>
              <button type="button" style={botao('secundario')} onClick={() => setConfirmar(false)}>Voltar</button>
              <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
            </>
          )}
        >
          {erro && <Aviso tipo="alerta">{erro}</Aviso>}
          <div style={{ fontSize: '14px', color: COR.azul, lineHeight: 1.6 }}>
            {diferencas.total > 0 && <div><strong>Composição:</strong> {diferencas.texto}.</div>}
            {parametrosMudaram && <div><strong>Parâmetros:</strong> código, câmeras, OCR ou sinalização alterados.</div>}
            <div style={{ ...ajuda, marginTop: '8px' }}>
              B.O.M. já abertos são recalculados com a composição nova quando forem reabertos.
              As linhas retiradas ficam desativadas no Dataverse (o histórico não se perde).
            </div>
          </div>
          <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={salvando} />
        </Modal>
      )}
    </div>
  );
};

export default ComposicaoKitView;
