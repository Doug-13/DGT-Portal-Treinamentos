import * as React from 'react';

import {
  CAMERAS_OCR,
  CAMERAS_VIDEO,
  CONTROLADORES_PORTA,
  ESTRUTURAS,
  IInfoKit,
  KITS,
  SWITCHES,
  idCamera,
  idSwitch
} from '../../services/bom/catalogoKits';

import {
  IAlertaBom,
  IItemBom,
  IPontoKit,
  ISelecaoKit,
  ISoftwaresKit,
  TipoPonto,
  chaveKitDoPonto,
  csvDoBom,
  ehBridgefy,
  kitsAplicados,
  montarBom,
  nomeKitDoPonto,
  normalizarSelecao,
  parametrosDoPonto,
  novoPonto,
  selecaoVazia,
  switchDe
} from '../../services/bom/montadorBom';

import {
  COR,
  FONTE,
  botao,
  campo
} from './arquiteturaComum';

import {
  IconeKit,
  NomeIconeKit
} from './IconesKit';

// ============================================================
// ETAPA 3 — SELEÇÃO DE KIT (montador de B.O.M.)
//
//   ┌ Projeto: VMS, Digifort, IPX, W-Access ──────────────┐
//   ├ Pontos do projeto (cartões) + Adicionar ponto ──────┤
//   │ Configurar ponto            │ Kit gerado             │
//   │ (tipo, soluções, câmeras,   │ (kits aplicados,       │
//   │  equipamentos)              │  resumo, itens)        │
//   └ Barra de ações (salvar / concluir) ─────────────────┘
// ============================================================

export interface ISelecaoKitEtapaProps {
  selecaoInicial?: ISelecaoKit;
  semColuna: boolean;
  canal: string;
  salvando: boolean;
  somenteLeitura: boolean;
  onSalvar: (selecao: ISelecaoKit, concluir: boolean) => Promise<void>;
  // Simulador da aba Kits: monta a lista normalmente, mas sem a
  // barra de salvar/concluir (não existe B.O.M. por trás).
  modoSimulacao?: boolean;
}

const VERDE = '#107C10';
const VERMELHO = '#B42318';
const AMBAR = '#B45309';

const DESCRICAO_TIPO: Record<TipoPonto, string> = {
  torre: 'PRFV · até 4 câmeras · giroled 128 LEDs',
  mini: 'Braço metálico · até 2 câmeras · parede ou poste',
  box: 'Caixa · 2 domes fixas · só vídeo',
  portaEletroduto: 'Eletroímã · eletroduto PVC aparente',
  portaDutotec: 'Fechadura · canaleta Dutotec',
  catraca: 'Catraca pedestal · rack e switch no ponto'
};

const NOME_CURTO: Record<TipoPonto, string> = {
  torre: 'Torre',
  mini: 'Wallfix (Mini)',
  box: 'Box',
  portaEletroduto: 'Porta — eletroduto',
  portaDutotec: 'Porta — dutotec',
  catraca: 'Catraca'
};

// Kits que o arquiteto pode escolher: os do sistema e os configurados
// na aba Kits (ativos), na ordem definida lá. O kit atual do ponto
// aparece mesmo se tiver sido desativado depois.
const kitsDoGrupo = (grupo: IInfoKit['grupo'], atual?: string): IInfoKit[] =>
  KITS.filter(k => k.grupo === grupo && (k.ativo || k.chave === atual));

const descricaoKit = (k: IInfoKit): string => {
  if (k.sistema) {
    return DESCRICAO_TIPO[k.modelo];
  }
  if (k.modelo === 'torre' || k.modelo === 'box' || k.modelo === 'mini') {
    const p = parametrosDoPonto({ tipo: k.modelo, kit: k.chave });
    return p ? `Base ${NOME_CURTO[k.modelo]} · até ${p.maxCameras} câmeras${p.aceitaOcr ? ' · aceita LPR' : ' · só vídeo'}${k.ativo ? '' : ' · desativado'}` : NOME_CURTO[k.modelo];
  }
  return `Base ${NOME_CURTO[k.modelo]}${k.ativo ? '' : ' · desativado'}`;
};

// ------------------------------------------------------------
// Elementos visuais
// ------------------------------------------------------------

const painel: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '14px',
  padding: '18px 20px'
};

const subPainel = (ativo: boolean): React.CSSProperties => ({
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  padding: '12px 14px',
  background: ativo ? '#FFFFFF' : COR.fundo,
  opacity: ativo ? 1 : 0.55
});

const rotuloCampo: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: COR.azul,
  margin: '0 0 5px'
};

const tituloSubPainel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  marginBottom: '10px',
  color: COR.azul,
  fontWeight: 800,
  fontSize: '13.5px'
};

const dica: React.CSSProperties = {
  fontSize: '11.5px',
  color: COR.texto2,
  marginTop: '5px',
  lineHeight: 1.4
};

const TituloPainel: React.FC<{ icone: NomeIconeKit; texto: string; extra?: React.ReactNode }> = ({ icone, texto, extra }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
    <IconeKit nome={icone} tamanho={20} cor={COR.indigo} />
    <h3 style={{ margin: 0, fontSize: '16px', color: COR.azul }}>{texto}</h3>
    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>{extra}</div>
  </div>
);

const Numero: React.FC<{ valor: number; aoMudar: (n: number) => void; minimo?: number; maximo?: number; desabilitado?: boolean; largura?: string }> =
  ({ valor, aoMudar, minimo = 0, maximo = 999999, desabilitado, largura }) => (
    <input
      type="number"
      min={minimo}
      max={maximo}
      value={valor}
      disabled={desabilitado}
      onChange={e => aoMudar(Math.max(minimo, Math.min(maximo, Math.floor(Number(e.target.value) || 0))))}
      style={{ ...campo, width: largura || '100%' }}
    />
  );

// Cartão selecionável (tipo de ponto / solução).
const Ladrilho: React.FC<{
  icone: NomeIconeKit;
  titulo: string;
  descricao: string;
  marcado: boolean;
  desabilitado?: boolean;
  caixa?: boolean;
  onClick: () => void;
}> = ({ icone, titulo, descricao, marcado, desabilitado, caixa, onClick }) => (
  <button
    type="button"
    disabled={desabilitado}
    onClick={onClick}
    aria-pressed={marcado}
    style={{
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
      textAlign: 'left',
      padding: '12px',
      borderRadius: '12px',
      border: `${marcado ? 2 : 1}px solid ${marcado ? COR.ciano : COR.borda}`,
      background: marcado ? '#E6F9FC' : '#FFFFFF',
      cursor: desabilitado ? 'not-allowed' : 'pointer',
      opacity: desabilitado ? 0.45 : 1,
      fontFamily: FONTE,
      minHeight: '64px'
    }}
  >
    {caixa
      ? (
        <span style={{ width: '20px', height: '20px', borderRadius: '5px', border: `2px solid ${marcado ? COR.ciano : '#C5CBD3'}`, background: marcado ? COR.ciano : '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
          {marcado && <IconeKit nome="check" tamanho={14} cor="#FFFFFF" />}
        </span>
      )
      : (
        <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: marcado ? COR.azul : COR.fundo, color: marcado ? '#FFFFFF' : COR.azul, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconeKit nome={icone} tamanho={19} />
        </span>
      )}
    <span>
      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: COR.azul }}>
        {caixa && <IconeKit nome={icone} tamanho={15} cor={COR.indigo} />}
        {titulo}
      </strong>
      <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2, marginTop: '2px', lineHeight: 1.35 }}>{descricao}</span>
    </span>
  </button>
);

const Segmentado: React.FC<{ opcoes: Array<{ id: string; texto: string; icone?: NomeIconeKit }>; valor: string; desabilitado?: boolean; onMudar: (id: string) => void }> =
  ({ opcoes, valor, desabilitado, onMudar }) => (
    <div style={{ display: 'inline-flex', background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '3px', gap: '3px' }}>
      {opcoes.map(o => (
        <button
          key={o.id}
          type="button"
          disabled={desabilitado}
          onClick={() => onMudar(o.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            border: 0, borderRadius: '8px', padding: '6px 12px',
            background: valor === o.id ? COR.azul : 'transparent',
            color: valor === o.id ? '#FFFFFF' : COR.azul,
            fontWeight: 700, fontSize: '12.5px', cursor: desabilitado ? 'default' : 'pointer', fontFamily: FONTE
          }}
        >
          {o.icone && <IconeKit nome={o.icone} tamanho={15} />}
          {o.texto}
        </button>
      ))}
    </div>
  );

const Estatistica: React.FC<{ valor: string; rotulo: string; alerta?: boolean }> = ({ valor, rotulo, alerta }) => (
  <div style={{ flex: '1 1 0', background: COR.fundo, border: `1px solid ${alerta ? '#F3B8B3' : COR.borda}`, borderRadius: '12px', padding: '12px 8px', textAlign: 'center' }}>
    <div style={{ fontSize: '22px', fontWeight: 800, color: alerta ? VERMELHO : COR.azul, lineHeight: 1.1 }}>{valor}</div>
    <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '4px' }}>{rotulo}</div>
  </div>
);

const ListaAlertas: React.FC<{ alertas: IAlertaBom[]; mostrarOrigem?: boolean }> = ({ alertas, mostrarOrigem }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '12px 0' }}>
    {alertas.map((a, i) => (
      <div
        key={i}
        style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          background: a.nivel === 'erro' ? '#FDE7E9' : '#FFF4E5',
          color: a.nivel === 'erro' ? VERMELHO : '#7C2D12',
          borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', lineHeight: 1.4
        }}
      >
        <IconeKit nome="alerta" tamanho={15} />
        <span>{mostrarOrigem && <strong>{a.origem}: </strong>}{a.mensagem}</span>
      </div>
    ))}
  </div>
);

const TabelaItens: React.FC<{ itens: IItemBom[]; mostrarOrigem: boolean }> = ({ itens, mostrarOrigem }) => (
  <div style={{ overflowX: 'auto', border: `1px solid ${COR.borda}`, borderRadius: '10px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ background: COR.fundo, color: COR.azul, textAlign: 'left' }}>
          <th style={{ padding: '9px 12px' }}>Código</th>
          <th style={{ padding: '9px 12px' }}>Item</th>
          <th style={{ padding: '9px 12px', textAlign: 'right' }}>Qtd.</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((i, n) => (
          <tr key={n} style={{ borderTop: `1px solid ${COR.borda}`, background: i.pendente ? '#FFF8EC' : undefined }}>
            <td style={{ padding: '8px 12px', fontFamily: 'Consolas, monospace', fontSize: '12px', color: COR.texto2, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
              {i.codigo || <span style={{ color: AMBAR, fontWeight: 700, fontFamily: FONTE }}>sem código</span>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              <div style={{ color: COR.azul, fontWeight: 600 }}>{i.descricao}</div>
              <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '1px' }}>
                {i.categoria}{mostrarOrigem ? ` · ${i.origem}` : ''}
              </div>
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: COR.azul, verticalAlign: 'top' }}>
              {i.quantidade.toLocaleString('pt-BR')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const botaoIcone = (desabilitado: boolean, perigo?: boolean): React.CSSProperties => ({
  ...botao('secundario', desabilitado),
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '32px',
  padding: '0 10px',
  color: perigo ? VERMELHO : COR.azul
});

// ------------------------------------------------------------
// Tela
// ------------------------------------------------------------

const SelecaoKitEtapa: React.FC<ISelecaoKitEtapaProps> = ({
  selecaoInicial,
  semColuna,
  canal,
  salvando,
  somenteLeitura,
  onSalvar,
  modoSimulacao
}) => {

  const [selecao, setSelecao] = React.useState<ISelecaoKit>(() => normalizarSelecao(selecaoInicial || selecaoVazia()));
  const [pontoId, setPontoId] = React.useState<string>('');
  const [alterado, setAlterado] = React.useState(false);
  const [visaoKit, setVisaoKit] = React.useState<'ponto' | 'projeto'>('ponto');
  const [menuNovo, setMenuNovo] = React.useState(false);
  const [largo, setLargo] = React.useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1100 : true);

  React.useEffect(() => {
    const aoRedimensionar = (): void => setLargo(window.innerWidth >= 1100);
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  React.useEffect(() => {
    const nova = normalizarSelecao(selecaoInicial || selecaoVazia());
    setSelecao(nova);
    setPontoId(nova.pontos.length > 0 ? nova.pontos[0].id : '');
    setAlterado(false);
  }, [selecaoInicial]);

  const resultado = React.useMemo(() => montarBom(selecao), [selecao]);
  const erros = resultado.alertas.filter(a => a.nivel === 'erro');
  const bloqueado = somenteLeitura || salvando;
  const sw = selecao.softwares;
  const temAcesso = selecao.pontos.some(p => !ehBridgefy(p.tipo));

  const ponto = selecao.pontos.find(p => p.id === pontoId) || selecao.pontos[0];
  const grupoPonto = ponto ? resultado.porPonto.find(g => g.ponto.id === ponto.id) : undefined;
  const alertasPonto = ponto ? resultado.alertas.filter(a => a.origem === ponto.nome) : [];
  const errosDoPonto = (p: IPontoKit): number => erros.filter(e => e.origem === p.nome).length;

  // ---------------- alterações ----------------

  const mudarSoftwares = (parcial: Partial<ISoftwaresKit>): void => {
    setSelecao(atual => ({ ...atual, softwares: { ...atual.softwares, ...parcial } }));
    setAlterado(true);
  };

  const mudarPonto = (parcial: Partial<IPontoKit>): void => {
    if (!ponto) {
      return;
    }
    setSelecao(atual => ({ ...atual, pontos: atual.pontos.map(p => (p.id === ponto.id ? { ...p, ...parcial } : p)) }));
    setAlterado(true);
  };

  const adicionarPonto = (kit: IInfoKit): void => {
    const novo = { ...novoPonto(kit.modelo, 0, kit.chave), nome: `Ponto ${selecao.pontos.length + 1}` };
    setSelecao(atual => ({ ...atual, pontos: [...atual.pontos, novo] }));
    setPontoId(novo.id);
    setVisaoKit('ponto');
    setMenuNovo(false);
    setAlterado(true);
  };

  // Troca o kit do ponto. Mesmo modelo: mantém a configuração (câmeras,
  // soluções...). Outro modelo: recomeça, mantendo nome e quantidade.
  const trocarKit = (kit: IInfoKit): void => {
    if (!ponto || chaveKitDoPonto(ponto) === kit.chave) {
      return;
    }
    if (ponto.tipo === kit.modelo) {
      mudarPonto({ kit: kit.chave === kit.modelo ? undefined : kit.chave });
      return;
    }
    mudarPonto({ ...novoPonto(kit.modelo, 0, kit.chave), kit: kit.chave === kit.modelo ? undefined : kit.chave, id: ponto.id, nome: ponto.nome, quantidade: ponto.quantidade });
  };

  const duplicarPonto = (): void => {
    if (!ponto) {
      return;
    }
    const copia = { ...ponto, id: novoPonto(ponto.tipo, 0).id, nome: `${ponto.nome} (cópia)` };
    setSelecao(atual => ({ ...atual, pontos: [...atual.pontos, copia] }));
    setPontoId(copia.id);
    setAlterado(true);
  };

  const removerPonto = (): void => {
    if (!ponto || !window.confirm(`Remover "${ponto.nome}"?`)) {
      return;
    }
    const restantes = selecao.pontos.filter(p => p.id !== ponto.id);
    setSelecao(atual => ({ ...atual, pontos: restantes }));
    setPontoId(restantes.length > 0 ? restantes[0].id : '');
    setAlterado(true);
  };

  // Soluções: ligar/desligar ajusta as câmeras correspondentes.
  const alternarSolucao = (chave: 'safeCity' | 'smartDetect' | 'faceDetect' | 'safeWay'): void => {
    if (!ponto || !ehBridgefy(ponto.tipo)) {
      return;
    }
    const estrutura = parametrosDoPonto(ponto) || ESTRUTURAS[ponto.tipo];
    const novo = !ponto[chave];
    const parcial: Partial<IPontoKit> = { [chave]: novo };

    if (chave === 'safeWay') {
      parcial.camerasOcr = novo ? Math.max(1, ponto.camerasOcr) : 0;
      if (novo && ponto.camerasVideo + 1 > estrutura.maxCameras) {
        parcial.camerasVideo = Math.max(0, estrutura.maxCameras - 1);
      }
    }
    if ((chave === 'safeCity' || chave === 'faceDetect') && novo && ponto.camerasVideo === 0) {
      parcial.camerasVideo = 1;
    }
    if (chave === 'safeCity' && !novo) {
      parcial.smartDetect = false;
    }
    if (chave === 'smartDetect' && novo) {
      parcial.safeCity = true;
    }

    const usaVideo =
      (parcial.safeCity !== undefined ? parcial.safeCity : ponto.safeCity) ||
      (parcial.faceDetect !== undefined ? parcial.faceDetect : ponto.faceDetect) ||
      sw.vms === 'digifort';

    if (!usaVideo) {
      parcial.camerasVideo = 0;
    }

    mudarPonto(parcial);
  };

  const baixarCsv = (): void => {
    const blob = new Blob(['\ufeff' + csvDoBom(resultado)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bom-selecao-kit.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const salvar = (concluir: boolean): void => {
    onSalvar(selecao, concluir)
      .then(() => setAlterado(false))
      .catch(() => undefined);
  };

  // ---------------- projeto (softwares) ----------------

  const blocoProjeto = (
    <div style={{ ...painel, marginBottom: '14px', display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IconeKit nome="kit" tamanho={20} cor={COR.indigo} />
        <strong style={{ color: COR.azul, fontSize: '14px' }}>Projeto</strong>
        <span style={{ background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '999px', padding: '3px 10px', fontSize: '12px', color: COR.azul, fontWeight: 700 }}>
          Canal: {canal || '—'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12.5px', color: COR.texto2, fontWeight: 700 }}>VMS</span>
        <Segmentado
          valor={sw.vms}
          desabilitado={bloqueado}
          onMudar={id => mudarSoftwares({ vms: id as ISoftwaresKit['vms'] })}
          opcoes={[
            { id: 'safeCity', texto: 'Safe City (nuvem)', icone: 'nuvem' },
            { id: 'digifort', texto: 'Digifort (terceiro)', icone: 'servidor' }
          ]}
        />
      </div>

      {sw.vms === 'digifort' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul, fontWeight: 700 }} title="Cada servidor exige a própria base de 8 câmeras">
            Servidores
            <Numero valor={sw.digifortServidores} aoMudar={n => mudarSoftwares({ digifortServidores: n })} minimo={1} maximo={99} desabilitado={bloqueado} largura="70px" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul, cursor: 'pointer' }} title="Analíticos por IA (IP Extreme) — roda sobre o Digifort">
            <input type="checkbox" checked={sw.ipx} disabled={bloqueado} onChange={e => mudarSoftwares({ ipx: e.target.checked })} />
            <strong>IPX Analytics</strong>
          </label>
          {sw.ipx && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul }}>
                Pacotes
                <Numero valor={sw.ipxPacotes} aoMudar={n => mudarSoftwares({ ipxPacotes: n })} minimo={1} maximo={9} desabilitado={bloqueado} largura="60px" />
              </label>
              <label title="Decisão pendente — código a levantar" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul, cursor: 'pointer' }}>
                <input type="checkbox" checked={sw.ipxIntegracao} disabled={bloqueado} onChange={e => mudarSoftwares({ ipxIntegracao: e.target.checked })} />
                Licença de integração
              </label>
            </>
          )}
        </>
      )}

      {temAcesso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <IconeKit nome="chave" tamanho={17} cor={COR.indigo} />
          <strong style={{ fontSize: '12.5px', color: COR.azul }}>W-Access</strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul }} title="1 licença a cada 1000 cadastros">
            Cadastros de face
            <Numero valor={sw.waccessCadastros} aoMudar={n => mudarSoftwares({ waccessCadastros: n })} desabilitado={bloqueado} largura="90px" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: COR.azul }} title="1 licença a cada 2 conexões simultâneas">
            Canais de visualização
            <Numero valor={sw.waccessCanais} aoMudar={n => mudarSoftwares({ waccessCanais: n })} maximo={999} desabilitado={bloqueado} largura="70px" />
          </label>
        </div>
      )}
    </div>
  );

  // ---------------- pontos (cartões) ----------------

  const blocoPontos = (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px', alignItems: 'stretch' }}>
      {selecao.pontos.map(p => {
        const ativo = !!ponto && p.id === ponto.id;
        const nErros = errosDoPonto(p);
        const resumo = ehBridgefy(p.tipo)
          ? `${p.camerasVideo} vídeo · ${(parametrosDoPonto(p) || ESTRUTURAS[p.tipo]).aceitaOcr ? p.camerasOcr : 0} LPR`
          : p.tipo === 'catraca'
            ? `${p.catracas + p.catracasPne} catraca(s)`
            : '1 leitora';
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => { setPontoId(p.id); setVisaoKit('ponto'); setMenuNovo(false); }}
            style={{
              display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, minWidth: '190px', textAlign: 'left',
              padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', fontFamily: FONTE,
              border: `${ativo ? 2 : 1}px solid ${ativo ? COR.ciano : nErros ? '#F3B8B3' : COR.borda}`,
              background: ativo ? '#E6F9FC' : '#FFFFFF'
            }}
          >
            <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: ativo ? COR.azul : COR.fundo, color: ativo ? '#FFFFFF' : COR.azul, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconeKit nome={p.tipo as NomeIconeKit} tamanho={19} />
            </span>
            <span style={{ minWidth: 0 }} title={nomeKitDoPonto(p)}>
              <strong style={{ display: 'block', fontSize: '13px', color: COR.azul, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                {p.nome}{p.quantidade > 1 ? ` ×${p.quantidade}` : ''}
              </strong>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: nErros ? VERMELHO : COR.texto2, whiteSpace: 'nowrap' }}>
                {nErros > 0
                  ? <><IconeKit nome="alerta" tamanho={12} /> {nErros} erro(s)</>
                  : `${chaveKitDoPonto(p) === p.tipo ? NOME_CURTO[p.tipo] : nomeKitDoPonto(p)} · ${resumo}`}
              </span>
            </span>
          </button>
        );
      })}

      {!somenteLeitura && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => setMenuNovo(!menuNovo)}
            aria-pressed={menuNovo}
            style={{
              display: 'flex', gap: '8px', alignItems: 'center', height: '100%', minHeight: '58px', padding: '0 16px',
              borderRadius: '12px', border: `${menuNovo ? 2 : 1}px ${menuNovo ? 'solid' : 'dashed'} ${COR.indigo}`, background: menuNovo ? '#E8EAF8' : '#F5F7FF', color: COR.indigo,
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: FONTE
            }}
          >
            <IconeKit nome="mais" tamanho={17} /> Adicionar ponto
          </button>
        </div>
      )}
    </div>
  );

  // Escolha do tipo do novo ponto: na própria tela (painel da
  // esquerda), sem janela. Aparece sozinha quando não há pontos.
  const escolhaTipo = (
    <div style={painel}>
      <TituloPainel
        icone="pin"
        texto={selecao.pontos.length === 0 ? 'Comece adicionando o primeiro ponto' : 'Que tipo de ponto?'}
        extra={selecao.pontos.length > 0 && (
          <button type="button" style={botaoIcone(false)} onClick={() => setMenuNovo(false)}>Cancelar</button>
        )}
      />
      <p style={{ fontSize: '13px', color: COR.texto2, margin: '-6px 0 14px' }}>
        Escolha o kit do ponto (os kits configurados na aba Kits aparecem aqui). Depois informe as soluções e quantas câmeras ou leitoras ele tem — a lista é montada automaticamente.
      </p>
      {(['Bridgefy', 'Controle de acesso'] as const).map(grupo => (
        <div key={grupo} style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: COR.texto2, marginBottom: '6px' }}>{grupo}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
            {kitsDoGrupo(grupo).map(k => (
              <Ladrilho
                key={k.chave}
                icone={k.modelo as NomeIconeKit}
                titulo={k.sistema ? NOME_CURTO[k.modelo] : k.nome}
                descricao={descricaoKit(k)}
                marcado={false}
                desabilitado={bloqueado}
                onClick={() => adicionarPonto(k)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ---------------- configurar ponto ----------------

  const renderizarConfigurar = (): React.ReactElement => {

    if (!ponto || menuNovo) {
      return somenteLeitura && !ponto
        ? <div style={{ ...painel, color: COR.texto2, fontSize: '13px' }}>Nenhum ponto cadastrado.</div>
        : escolhaTipo;
    }

    const bridgefy = ehBridgefy(ponto.tipo);
    const estrutura = parametrosDoPonto(ponto);
    const usaVideo = bridgefy && (ponto.safeCity || ponto.faceDetect || sw.vms === 'digifort');
    const usaLpr = bridgefy && !!estrutura && estrutura.aceitaOcr && ponto.safeWay;
    const swPonto = switchDe(ponto.switchId);

    return (
      <div style={painel}>
        <TituloPainel
          icone="pin"
          texto="Configurar ponto"
          extra={!somenteLeitura && (
            <>
              <button type="button" title="Duplicar ponto" style={botaoIcone(bloqueado)} disabled={bloqueado} onClick={duplicarPonto}>
                <IconeKit nome="copiar" tamanho={15} /> Duplicar
              </button>
              <button type="button" title="Remover ponto" style={botaoIcone(bloqueado, true)} disabled={bloqueado} onClick={removerPonto}>
                <IconeKit nome="lixeira" tamanho={15} /> Remover
              </button>
            </>
          )}
        />

        {/* nome e quantidade */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={rotuloCampo}>Nome do ponto</label>
            <input value={ponto.nome} disabled={bloqueado} onChange={e => mudarPonto({ nome: e.target.value })} style={campo} />
          </div>
          <div>
            <label style={rotuloCampo} title="Quantos pontos iguais a este o projeto tem">Pontos iguais</label>
            <Numero valor={ponto.quantidade} aoMudar={n => mudarPonto({ quantidade: n })} minimo={1} maximo={999} desabilitado={bloqueado} />
          </div>
        </div>

        {/* tipo */}
        <label style={rotuloCampo}>{bridgefy ? 'Kit (estrutura)' : 'Kit (tipo de ponto)'}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '16px' }}>
          {kitsDoGrupo(bridgefy ? 'Bridgefy' : 'Controle de acesso', chaveKitDoPonto(ponto)).map(k => (
            <Ladrilho
              key={k.chave}
              icone={k.modelo as NomeIconeKit}
              titulo={k.sistema ? NOME_CURTO[k.modelo] : k.nome}
              descricao={descricaoKit(k)}
              marcado={chaveKitDoPonto(ponto) === k.chave}
              desabilitado={bloqueado}
              onClick={() => trocarKit(k)}
            />
          ))}
        </div>

        {bridgefy && estrutura && (
          <>
            {/* soluções */}
            <label style={rotuloCampo}>Soluções no ponto</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {sw.vms === 'safeCity'
                ? <Ladrilho caixa icone="nuvem" titulo="Safe City" descricao="VMS em nuvem · RTMP · licença por câmera" marcado={ponto.safeCity} desabilitado={bloqueado} onClick={() => alternarSolucao('safeCity')} />
                : <Ladrilho caixa icone="servidor" titulo="Digifort (VMS do projeto)" descricao="Licença por servidor + packs, no projeto" marcado desabilitado onClick={() => undefined} />}
              <Ladrilho caixa icone="radar" titulo="Smart Detect" descricao="Módulo do Safe City · licença inclusa" marcado={ponto.smartDetect} desabilitado={bloqueado || sw.vms !== 'safeCity'} onClick={() => alternarSolucao('smartDetect')} />
              <Ladrilho caixa icone="rosto" titulo="Face Detect" descricao="Facial · SFTP · licença por câmera" marcado={ponto.faceDetect} desabilitado={bloqueado} onClick={() => alternarSolucao('faceDetect')} />
              <Ladrilho caixa icone="placa" titulo="Safe Way" descricao={estrutura.aceitaOcr ? 'Leitura de placas · SFTP · licença por faixa' : 'O Box não comporta câmera OCR/LPR'} marcado={ponto.safeWay && estrutura.aceitaOcr} desabilitado={bloqueado || !estrutura.aceitaOcr} onClick={() => alternarSolucao('safeWay')} />
            </div>
            <div style={{ ...dica, marginBottom: '16px' }}>
              Safe City e Safe Way nunca usam a mesma câmera: ponto com vídeo e placas leva duas.
            </div>

            {/* câmeras */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <div style={subPainel(usaVideo)}>
                <div style={tituloSubPainel}><IconeKit nome="camera" tamanho={17} cor={COR.indigo} /> Videomonitoramento</div>
                <label style={rotuloCampo}>Câmeras</label>
                <Numero valor={ponto.camerasVideo} aoMudar={n => mudarPonto({ camerasVideo: n })} maximo={estrutura.maxCameras} desabilitado={bloqueado || !usaVideo} />
                <label style={{ ...rotuloCampo, marginTop: '10px' }}>Modelo</label>
                <select value={ponto.modeloVideo} disabled={bloqueado || !usaVideo} onChange={e => mudarPonto({ modeloVideo: e.target.value })} style={campo}>
                  {CAMERAS_VIDEO.map(c => (
                    <option key={idCamera(c)} value={idCamera(c)}>
                      {c.modelo}{c.padrao ? ' · padrão' : ''}{c.zoomOptico ? ' · zoom' : ''}{c.codigo ? '' : ' · sem código'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={subPainel(usaLpr)}>
                <div style={tituloSubPainel}><IconeKit nome="placa" tamanho={17} cor={COR.indigo} /> Leitura de placas (LPR)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={rotuloCampo}>Câmeras</label>
                    <Numero valor={ponto.camerasOcr} aoMudar={n => mudarPonto({ camerasOcr: n })} maximo={estrutura.maxCameras} desabilitado={bloqueado || !usaLpr} />
                  </div>
                  <div>
                    <label style={rotuloCampo} title="A licença Safe Way é por faixa monitorada">Faixas/câmera</label>
                    <Numero valor={ponto.faixasPorOcr} aoMudar={n => mudarPonto({ faixasPorOcr: n })} minimo={1} maximo={4} desabilitado={bloqueado || !usaLpr} />
                  </div>
                </div>
                <label style={{ ...rotuloCampo, marginTop: '10px' }}>Modelo</label>
                <select value={ponto.modeloOcr} disabled={bloqueado || !usaLpr} onChange={e => mudarPonto({ modeloOcr: e.target.value })} style={campo}>
                  {CAMERAS_OCR.map(c => <option key={idCamera(c)} value={idCamera(c)}>{c.modelo}{c.padrao ? ' · padrão' : ''}</option>)}
                </select>
              </div>
            </div>

            {/* rede, energia e opções */}
            <div style={subPainel(true)}>
              <div style={tituloSubPainel}><IconeKit nome="rede" tamanho={17} cor={COR.indigo} /> Rede, energia e opções</div>
              <label style={rotuloCampo}>Switch</label>
              <select value={ponto.switchId} disabled={bloqueado} onChange={e => mudarPonto({ switchId: e.target.value })} style={campo}>
                {SWITCHES.map(s => <option key={idSwitch(s)} value={idSwitch(s)}>{s.modelo}{s.padrao ? ' · padrão' : ''}{s.codigo ? '' : ' · sem código'}</option>)}
              </select>
              <div style={dica}>
                {swPonto.poe
                  ? `Com PoE as câmeras são alimentadas pelo switch: ${ponto.tipo === 'torre' ? 'fica só a fonte do giroled' : 'as fontes das câmeras saem'}.`
                  : `Sem PoE: 1 fonte por câmera${ponto.tipo === 'torre' ? ' + 1 do giroled' : ''}.`}
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '13px', color: COR.azul }}>
                {ponto.tipo !== 'box' && (
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }} title="Torre, poste ou via pública: o Face Detect exige zoom óptico">
                    <input type="checkbox" checked={ponto.pontoAlto} disabled={bloqueado} onChange={e => mudarPonto({ pontoAlto: e.target.checked })} />
                    Instalação alta
                  </label>
                )}
                {ponto.tipo === 'torre' && (
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={ponto.comunicacaoBidirecional} disabled={bloqueado} onChange={e => mudarPonto({ comunicacaoBidirecional: e.target.checked })} />
                    Comunicação bidirecional (torre de emergência)
                  </label>
                )}
              </div>
            </div>
          </>
        )}

        {!bridgefy && (
          <>
            {ponto.tipo === 'catraca'
              ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  <div style={subPainel(true)}>
                    <div style={tituloSubPainel}><IconeKit nome="catraca" tamanho={17} cor={COR.indigo} /> Catracas CAP3100</div>
                    <Numero valor={ponto.catracas} aoMudar={n => mudarPonto({ catracas: n })} maximo={20} desabilitado={bloqueado} />
                    <div style={dica}>Já vem com 2 leitoras (entrada e saída).</div>
                  </div>
                  <div style={subPainel(true)}>
                    <div style={tituloSubPainel}><IconeKit nome="pessoas" tamanho={17} cor={COR.indigo} /> Catracas PNE</div>
                    <Numero valor={ponto.catracasPne} aoMudar={n => mudarPonto({ catracasPne: n })} maximo={10} desabilitado={bloqueado} />
                    <div style={dica}>Cada uma leva 2 controladores SS 3532 MF W + 2 suportes SC 3000.</div>
                  </div>
                </div>
              )
              : (
                <div style={{ ...subPainel(true), marginBottom: '14px' }}>
                  <div style={tituloSubPainel}><IconeKit nome="rosto" tamanho={17} cor={COR.indigo} /> Controlador de acesso facial</div>
                  <select value={ponto.controladorPorta} disabled={bloqueado} onChange={e => mudarPonto({ controladorPorta: e.target.value })} style={campo}>
                    {CONTROLADORES_PORTA.map(c => <option key={c.codigo} value={c.codigo}>{c.modelo}{c.padrao ? ' · padrão' : ''}</option>)}
                  </select>
                  <div style={dica}>Faz o papel de leitora e de controladora — sem controladora separada.</div>
                </div>
              )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              <Ladrilho caixa icone="chave" titulo="Usa W-Access" descricao="Licença por leitora + cadastros e conexões no projeto" marcado={ponto.usaWAccess} desabilitado={bloqueado} onClick={() => mudarPonto({ usaWAccess: !ponto.usaWAccess })} />
              {ponto.tipo === 'portaDutotec' && (
                <Ladrilho caixa icone="portaDutotec" titulo="Porta de vidro" descricao="Suporte SV 21/22 — 1 por fechadura" marcado={ponto.portaVidro} desabilitado={bloqueado} onClick={() => mudarPonto({ portaVidro: !ponto.portaVidro })} />
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ---------------- kit gerado ----------------

  const errosPontoAtual = alertasPonto.filter(a => a.nivel === 'erro').length;
  const valido = visaoKit === 'ponto' ? errosPontoAtual === 0 : erros.length === 0;

  const renderizarResumoPonto = (): React.ReactElement | null => {
    if (!ponto || !grupoPonto) {
      return (
        <div style={{ fontSize: '13px', color: COR.texto2, padding: '20px 0', textAlign: 'center' }}>Os itens do ponto aparecem aqui.</div>
      );
    }

    const bridgefy = ehBridgefy(ponto.tipo);
    const estrutura = parametrosDoPonto(ponto);
    const nO = estrutura && estrutura.aceitaOcr ? ponto.camerasOcr : 0;
    const sensores = ponto.camerasVideo + nO;

    return (
      <>
        <div style={{ fontSize: '12px', color: COR.texto2, marginBottom: '6px' }}>
          Kits aplicados{ponto.quantidade > 1 ? ` · quantidades × ${ponto.quantidade} pontos` : ''}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {kitsAplicados(ponto).map(k => (
            <span key={k} style={{ border: `1px solid ${COR.borda}`, background: COR.fundo, borderRadius: '8px', padding: '4px 10px', fontSize: '12.5px', color: COR.azul, fontWeight: 600 }}>{k}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {bridgefy && estrutura
            ? (
              <>
                <Estatistica valor={String(ponto.camerasVideo)} rotulo="câm. vídeo" />
                <Estatistica valor={String(nO)} rotulo="câm. LPR" />
                <Estatistica valor={`${sensores}/${estrutura.maxCameras}`} rotulo="sensores" alerta={sensores > estrutura.maxCameras} />
              </>
            )
            : ponto.tipo === 'catraca'
              ? (
                <>
                  <Estatistica valor={String(ponto.catracas + ponto.catracasPne)} rotulo="catracas" />
                  <Estatistica valor={String(2 * (ponto.catracas + ponto.catracasPne))} rotulo="leitoras" />
                  <Estatistica valor={ponto.usaWAccess ? 'Sim' : 'Não'} rotulo="W-Access" />
                </>
              )
              : (
                <>
                  <Estatistica valor="1" rotulo="leitora" />
                  <Estatistica valor={ponto.tipo === 'portaDutotec' ? 'Fechadura' : 'Eletroímã'} rotulo="barreira" />
                  <Estatistica valor={ponto.usaWAccess ? 'Sim' : 'Não'} rotulo="W-Access" />
                </>
              )}
        </div>

        {alertasPonto.length > 0 ? <ListaAlertas alertas={alertasPonto} /> : <div style={{ height: '12px' }} />}
        <TabelaItens itens={grupoPonto.itens} mostrarOrigem={false} />
      </>
    );
  };

  const blocoKit = (
    <div style={{ ...painel, position: largo ? 'sticky' : 'static', top: '12px' }}>
      <TituloPainel
        icone="kit"
        texto={visaoKit === 'ponto' && ponto ? `Kit gerado para ${ponto.nome}` : 'Lista do projeto'}
        extra={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 800, background: valido ? '#E7F6EC' : '#FDE7E9', color: valido ? VERDE : VERMELHO }}>
            <IconeKit nome={valido ? 'check' : 'alerta'} tamanho={13} />
            {valido ? 'Válido' : `${visaoKit === 'ponto' ? errosPontoAtual : erros.length} erro(s)`}
          </span>
        )}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <Segmentado
          valor={visaoKit}
          onMudar={id => setVisaoKit(id as 'ponto' | 'projeto')}
          opcoes={[
            { id: 'ponto', texto: 'Este ponto', icone: 'pin' },
            { id: 'projeto', texto: 'Projeto inteiro', icone: 'kit' }
          ]}
        />
        {visaoKit === 'projeto' && (
          <button type="button" style={botaoIcone(resultado.itens.length === 0)} disabled={resultado.itens.length === 0} onClick={baixarCsv}>
            <IconeKit nome="baixar" tamanho={15} /> Baixar CSV
          </button>
        )}
      </div>

      {visaoKit === 'ponto' && renderizarResumoPonto()}

      {visaoKit === 'projeto' && (
        <>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Estatistica valor={String(resultado.totais.pontos)} rotulo="pontos" />
            <Estatistica valor={String(resultado.totais.camerasVideo)} rotulo="câm. vídeo" />
            <Estatistica valor={String(resultado.totais.camerasOcr)} rotulo="câm. LPR" />
            <Estatistica valor={String(resultado.totais.leitoras)} rotulo="leitoras" />
          </div>
          {resultado.alertas.length > 0 ? <ListaAlertas alertas={resultado.alertas} mostrarOrigem /> : <div style={{ height: '12px' }} />}
          {resultado.itens.length > 0
            ? <TabelaItens itens={resultado.itens} mostrarOrigem />
            : <div style={{ fontSize: '13px', color: COR.texto2 }}>Nenhum item ainda.</div>}
        </>
      )}
    </div>
  );

  // ---------------- tela ----------------

  return (
    <div style={{ fontFamily: FONTE }}>

      {semColuna && (
        <div role="alert" style={{ ...painel, marginBottom: '14px', background: '#FFF4E5', borderColor: '#F5D7A8', color: COR.azul, fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <IconeKit nome="alerta" tamanho={17} cor={AMBAR} />
          <span><strong>Configuração pendente:</strong> execute <code>scripts/dataverse/criar-coluna-selecao-kit.ps1</code> para salvar. Dá para montar a lista e baixar o CSV mesmo assim.</span>
        </div>
      )}

      {blocoProjeto}
      {selecao.pontos.length > 0 && blocoPontos}

      <div style={{ display: 'grid', gridTemplateColumns: largo ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
        {renderizarConfigurar()}
        {blocoKit}
      </div>

      {/* barra de ações */}
      {!somenteLeitura && !modoSimulacao && (
        <div
          style={{
            position: 'sticky', bottom: 0, zIndex: 10, marginTop: '14px',
            display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
            background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '14px',
            padding: '10px 14px', boxShadow: '0 -6px 20px rgba(32,42,68,.08)'
          }}
        >
          <span style={{ fontSize: '12.5px', color: COR.texto2 }}>
            <strong style={{ color: COR.azul }}>{resultado.totais.pontos}</strong> ponto(s) ·{' '}
            <strong style={{ color: COR.azul }}>{resultado.itens.length}</strong> itens
            {erros.length > 0 && <span style={{ color: VERMELHO, fontWeight: 700 }}> · {erros.length} erro(s) para corrigir</span>}
            {alterado && <span style={{ color: AMBAR, fontWeight: 700 }}> · alterações não salvas</span>}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button type="button" style={botao('secundario', salvando || semColuna)} disabled={salvando || semColuna} onClick={() => salvar(false)}>
              Salvar rascunho
            </button>
            <button
              type="button"
              style={botao('principal', salvando || semColuna || erros.length > 0 || selecao.pontos.length === 0)}
              disabled={salvando || semColuna || erros.length > 0 || selecao.pontos.length === 0}
              title={erros.length > 0 ? 'Corrija os erros para concluir' : undefined}
              onClick={() => salvar(true)}
            >
              Concluir seleção de kit →
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SelecaoKitEtapa; 