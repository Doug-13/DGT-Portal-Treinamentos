import * as React from 'react';

import { DataverseService } from '../../services/DataverseService';

import {
  IAnaliseGoNoGo,
  IBomRegistro,
  IDemandaBom
} from '../../services/bom/BomService';

import {
  IBomEnviado,
  IItemBom,
  IRegistroAlteracaoBom,
  IResultadoBom,
  ISelecaoKit,
  historicoAlteracoes,
  nomeKitDoPonto
} from '../../services/bom/montadorBom';

import {
  HistoricoAlteracoes,
  quemQuando
} from './AlteracoesItensKit';

import EtapaHHBom from './EtapaHHBom';

import { valorDoItem } from '../../services/bom/valoresBom';

import {
  IResumoValoresBom,
  resumoValoresBom
} from '../../services/hh/valoresProjeto';

import {
  ILinhaBom,
  baixarBlob,
  gerarPdfBom,
  nomeArquivoPdfBom,
  solucoesDoPonto
} from './pdfBom';

import { gerarJsonBom, nomeArquivoJsonBom } from './jsonBom';

import LancarCigamPainel from './LancarCigamPainel';

import {
  IEnvioCigam,
  andamentoEnvio,
  envioQueBloqueia,
  horaCurta,
  lerEnviosCigam
} from '../../services/bom/envioCigam';

import {
  COR,
  DECISAO,
  FONTE,
  Selo,
  botao,
  cartao,
  formatarData,
  formatarNumero
} from './arquiteturaComum';

// ============================================================
// ETAPA 5 — B.O.M. PRONTO
//
// Apresenta o B.O.M. criado: demanda, Go/No-Go, pontos, lista
// consolidada de itens com código CIGAM e valor do CIGAM, alertas,
// prévia de HH e as saídas (copiar para o CIGAM, CSV e PDF).
//
// "Enviar para aprovação" CONGELA a lista de itens dentro da
// seleção de kit (campo bomEnviado): depois do envio, mudanças no
// catálogo da aba Kits não alteram este B.O.M.
// ============================================================

export interface IEtapaBomProntoProps {
  bom: IBomRegistro;
  demanda: IDemandaBom;
  analise?: IAnaliseGoNoGo;
  selecao?: ISelecaoKit;
  // Resultado do montador com o catálogo atual (antes do envio).
  resultado?: IResultadoBom;
  // Código CIGAM → valor unitário (R$) lido do CIGAM pela aba Kits.
  precos: Record<string, number>;
  dataverseService?: DataverseService;
  dataEnvio?: string;
  salvando: boolean;
  // Quem pode enviar para aprovação (definido pela página).
  // Sem a propriedade, o botão segue liberado como antes.
  podeEnviar?: boolean;
  // Título da faixa de situação definido pela página (opcional).
  tituloSituacao?: string;
  // Aceita propriedades extras que a página passe (compatibilidade com
  // versões da ArquiteturaPage mais novas que este componente).
  [outra: string]: unknown;
  onEnviar: (congelado: IBomEnviado) => Promise<void>;
  // Texto abaixo do título da situação (ex.: "Aprovado em 26/11/2026.").
  textoSituacao?: string;
  aoVoltarKit?: () => void;
  aoVoltarHH?: () => void;
}

const moeda = (v: number): string =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ORDEM_CATEGORIA = ['Estrutura', 'Câmera', 'Equipamento', 'Infraestrutura', 'Identificação', 'Licença', 'Serviço'];

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

const EtapaBomPronto: React.FC<IEtapaBomProntoProps> = ({
  bom, demanda, analise, selecao, resultado, precos, dataverseService, dataEnvio, salvando, podeEnviar = true, tituloSituacao, textoSituacao, onEnviar, aoVoltarKit, aoVoltarHH
}) => {

  const congelado = selecao ? selecao.bomEnviado : undefined;
  const enviado = bom.etapa === 'Enviado para aprovação' || !!congelado;
  const [aviso, setAviso] = React.useState('');
  const [lancandoCigam, setLancandoCigam] = React.useState(false);

  // Lançamentos no CIGAM deste B.O.M. (situação no topo da etapa).
  const [enviosCigam, setEnviosCigam] = React.useState<IEnvioCigam[]>([]);
  const [agoraCigam, setAgoraCigam] = React.useState(new Date());

  const lerEnvios = React.useCallback((): void => {
    if (!dataverseService || !bom.id) {
      return;
    }
    lerEnviosCigam(dataverseService, bom.id)
      .then(lista => { setEnviosCigam(lista || []); setAgoraCigam(new Date()); })
      .catch(() => undefined);
  }, [dataverseService, bom.id]);

  React.useEffect(() => { lerEnvios(); }, [lerEnvios]);

  const ultimoEnvioCigam = enviosCigam.length ? enviosCigam[enviosCigam.length - 1] : undefined;
  const lancadoCigam = envioQueBloqueia(enviosCigam);
  const andamentoCigam = lancadoCigam ? andamentoEnvio(lancadoCigam, agoraCigam) : undefined;

  // Atualiza a situação a cada 5 s enquanto o CIGAM processa (estimado).
  React.useEffect(() => {
    if (!andamentoCigam || !andamentoCigam.emProcessamento) {
      return undefined;
    }
    const relogio = window.setInterval(() => setAgoraCigam(new Date()), 5000);
    return () => window.clearInterval(relogio);
  }, [andamentoCigam ? andamentoCigam.emProcessamento : false]);

  // Depois do envio vale a lista congelada; antes, o montador.
  const itensBase: IItemBom[] = congelado ? congelado.itens : resultado ? resultado.itens : [];
  const alertasBase: string[] = congelado
    ? congelado.alertas
    : resultado ? resultado.alertas.map(a => `${a.nivel === 'erro' ? 'Bloqueio' : 'Aviso'} · ${a.origem}: ${a.mensagem}`) : [];

  const linhas: ILinhaBom[] = itensBase
    .map(item => {
      const valor = congelado
        ? (congelado.precos[item.codigo] !== undefined ? congelado.precos[item.codigo] : undefined)
        : valorDoItem(precos, item.codigo);
      return { ...item, valorUnitario: valor, total: valor !== undefined ? valor * item.quantidade : undefined };
    })
    .sort((a, b) =>
      (ORDEM_CATEGORIA.indexOf(a.categoria) - ORDEM_CATEGORIA.indexOf(b.categoria)) ||
      a.descricao.localeCompare(b.descricao)
    );

  // Trocas e cancelamentos de itens: os congelados no envio ou os atuais.
  const historico: IRegistroAlteracaoBom[] = congelado
    ? (congelado.alteracoes || [])
    : resultado ? historicoAlteracoes(resultado) : [];
  const vigentesDoPonto = (pontoId: string): IRegistroAlteracaoBom[] =>
    historico.filter(r => r.pontoId === pontoId && r.situacao === 'aplicada')
      .sort((a, b) => a.alteracao.em.localeCompare(b.alteracao.em));
  const emVigor = historico.filter(r => r.situacao === 'aplicada').length;

  const valorTotal = linhas.reduce((t, l) => t + (l.total || 0), 0);
  const semPreco = linhas.filter(l => l.valorUnitario === undefined).length;
  // Totais do projeto: congelados no envio ou calculados agora com o
  // valor dos itens e as respostas de integração/manutenção.
  const resumoValores: IResumoValoresBom = congelado && congelado.resumoValores
    ? congelado.resumoValores
    : resumoValoresBom(valorTotal, selecao ? selecao.complementosHH : undefined, semPreco);
  const semCodigo = linhas.filter(l => l.pendente).length;
  const erros = congelado ? 0 : resultado ? resultado.alertas.filter(a => a.nivel === 'erro').length : 0;

  const alertas = [
    ...alertasBase,
    ...(semCodigo ? [`${semCodigo} item(ns) sem código no CIGAM: não orçáveis até o cadastro.`] : []),
    ...(semPreco ? [`${semPreco} item(ns) sem valor na tabela de preços do CIGAM (aba Kits › atualizar valores).`] : [])
  ];

  const pontos = selecao ? selecao.pontos.reduce((t, p) => t + p.quantidade, 0) : 0;
  const totais = congelado ? congelado.totais : resultado ? resultado.totais : { pontos: 0, camerasVideo: 0, camerasOcr: 0, leitoras: 0 };
  const numero = bom.numero.replace(/^BOM\s*/i, '');

  const mostrar = (texto: string): void => {
    setAviso(texto);
    window.setTimeout(() => setAviso(''), 3500);
  };

  const copiarTexto = (texto: string, ok: string): void => {
    const fallback = (): void => {
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); mostrar(ok); } catch { mostrar('Não foi possível copiar.'); }
      document.body.removeChild(area);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => mostrar(ok)).catch(fallback);
    } else {
      fallback();
    }
  };

  // Código e quantidade, uma linha por item: cola direto no CIGAM / Excel.
  const copiarCigam = (): void => {
    const texto = ['Código\tQuantidade\tDescrição']
      .concat(linhas.map(l => `${l.pendente ? '' : l.codigo}\t${l.quantidade}\t${l.descricao}`))
      .join('\n');
    copiarTexto(texto, 'Lista copiada: código, quantidade e descrição.');
  };

  const baixarCsv = (): void => {
    const c = (v: string | number | undefined): string => `"${String(v === undefined ? '' : v).replace(/"/g, '""')}"`;
    const n = (v: number | undefined): string => (v === undefined ? '' : v.toFixed(2).replace('.', ','));
    const conteudo = ['Código CIGAM;Descrição;Categoria;Quantidade;Valor unitário;Total;Origem']
      .concat(linhas.map(l => [c(l.pendente ? '' : l.codigo), c(l.descricao), c(l.categoria), l.quantidade, n(l.valorUnitario), n(l.total), c(l.origem)].join(';')))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOM ${numero} ${bom.revisao}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Gera o arquivo .pdf e baixa na hora (sem janela de impressão).
  const [gerandoPdf, setGerandoPdf] = React.useState(false);
  const gerarPdf = async (): Promise<void> => {
    setGerandoPdf(true);
    try {
      const blob = await gerarPdfBom({ bom, demanda, analise, selecao, linhas, valorTotal, semPreco, alertas, enviado, dataEnvio, historico, resumoValores });
      baixarBlob(blob, nomeArquivoPdfBom(bom, demanda));
      mostrar('PDF gerado e baixado.');
    } catch (erro) {
      mostrar(`Não foi possível gerar o PDF: ${(erro as Error).message || String(erro)}`);
    } finally {
      setGerandoPdf(false);
    }
  };

  // Gera o JSON do B.O.M. (formato dgt-portal/bom@1) para lançamento via API.
  const montarJson = (): string => JSON.stringify(gerarJsonBom({
    bom, demanda, analise, selecao, linhas, valorTotal, semPreco, semCodigo, alertas, enviado,
    congeladoEm: congelado ? congelado.em : undefined,
    dataEnvio, historico, resumoValores, totais
  }), null, 2);

  const baixarJson = (): void => {
    try {
      const blob = new Blob([montarJson()], { type: 'application/json;charset=utf-8' });
      baixarBlob(blob, nomeArquivoJsonBom(bom));
      mostrar('JSON gerado e baixado.');
    } catch (erro) {
      mostrar(`Não foi possível gerar o JSON: ${(erro as Error).message || String(erro)}`);
    }
  };

  const copiarJson = (): void => {
    copiarTexto(montarJson(), 'JSON copiado para a área de transferência.');
  };

  const enviar = async (): Promise<void> => {
    if (!selecao || !resultado || !podeEnviar) {
      return;
    }
    const pend = [
      erros ? `${erros} bloqueio(s) na seleção de kit` : '',
      semCodigo ? `${semCodigo} item(ns) sem código no CIGAM` : '',
      semPreco ? `${semPreco} item(ns) sem valor do CIGAM` : ''
    ].filter(Boolean);
    const confirmar = window.confirm(
      `Enviar o BOM ${numero} ${bom.revisao} para aprovação?\n\n` +
      'A lista de itens será congelada: mudanças futuras nos kits não alteram este B.O.M.' +
      (pend.length ? `\n\nPendências: ${pend.join('; ')}.` : '')
    );
    if (!confirmar) {
      return;
    }
    const precosUsados: Record<string, number> = {};
    linhas.forEach(l => {
      if (l.codigo && l.valorUnitario !== undefined) {
        precosUsados[l.codigo] = l.valorUnitario;
      }
    });
    await onEnviar({
      em: new Date().toISOString(),
      por: '',
      itens: resultado.itens,
      alertas: resultado.alertas.map(a => `${a.nivel === 'erro' ? 'Bloqueio' : 'Aviso'} · ${a.origem}: ${a.mensagem}`),
      totais: resultado.totais,
      precos: precosUsados,
      valorTotal,
      alteracoes: historicoAlteracoes(resultado),
      resumoValores: { ...resumoValoresBom(valorTotal, selecao.complementosHH, semPreco), calculadoEm: new Date().toISOString() }
    });
  };

  // ---------------- estilos locais ----------------
  const th: React.CSSProperties = { padding: '9px 10px', background: COR.azul, color: '#FFFFFF', fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${COR.borda}`, fontSize: '13px', color: COR.azul, verticalAlign: 'top' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const titulo: React.CSSProperties = { margin: '0 0 12px', color: COR.azul, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' };
  const kv = (rotulo: string, valor?: string): JSX.Element => (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '10px', padding: '6px 0', borderBottom: `1px dashed ${COR.borda}`, fontSize: '13px' }}>
      <span style={{ color: COR.texto2 }}>{rotulo}</span>
      <span style={{ color: COR.azul, fontWeight: 600 }}>{valor || '—'}</span>
    </div>
  );
  const indicador = (rotuloInd: string, valor: string, cor: string): JSX.Element => (
    <div style={{ flex: '1 1 150px', background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderLeft: `4px solid ${cor}`, borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: COR.texto2 }}>{rotuloInd}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: COR.azul, marginTop: '4px' }}>{valor}</div>
    </div>
  );

  if (!selecao || (!resultado && !congelado)) {
    return (
      <div style={{ ...cartao, textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 6px', color: COR.azul }}>🔒 Conclua a seleção de kit</h3>
        <p style={{ fontSize: '13px', color: COR.texto2 }}>O B.O.M. pronto é montado a partir dos pontos da seleção de kit.</p>
        {aoVoltarKit && <button type="button" style={botao('principal')} onClick={aoVoltarKit}>Ir para a Seleção de kit</button>}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONTE }}>

      {/* Situação */}
      <div style={{ ...cartao, background: enviado ? '#E7F6EC' : '#E8F2FF', borderColor: enviado ? '#107C10' : '#0F6CBD', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <strong style={{ color: COR.azul, fontSize: '15px' }}>
            {tituloSituacao || (enviado ? `✓ BOM ${numero} ${bom.revisao} enviado para aprovação` : `BOM ${numero} ${bom.revisao} pronto para revisão e envio`)}
          </strong>
          <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '3px' }}>
            {textoSituacao ? `${textoSituacao} ` : ''}{enviado
              ? `Lista de itens congelada${congelado ? ` em ${formatarData(congelado.em.substring(0, 10))}` : ''}${dataEnvio ? ` · data de envio ${formatarData(dataEnvio)}` : ''}. Mudanças na aba Kits não alteram este B.O.M.`
              : 'Lista calculada com o catálogo atual da aba Kits. Ao enviar para aprovação, os itens e valores são congelados.'}
          </div>
          {enviado && lancadoCigam && andamentoCigam && (
            <div style={{ fontSize: '12.5px', marginTop: '6px', fontWeight: 700, color: andamentoCigam.emProcessamento ? '#0F6CBD' : '#107C10' }}>
              {andamentoCigam.emProcessamento
                ? `⏳ Lançado no CIGAM às ${horaCurta(new Date(lancadoCigam.em))} · o CIGAM está criando a oportunidade e o pedido (previsão ${horaCurta(andamentoCigam.terminoPrevisto)}, ${andamentoCigam.percentual}%)`
                : `✓ Lançado no CIGAM em ${new Date(lancadoCigam.em).toLocaleString('pt-BR')} · concluído pela previsão (confira no CIGAM)`}
            </div>
          )}
          {enviado && !lancadoCigam && ultimoEnvioCigam && ultimoEnvioCigam.situacao === 'recusado' && (
            <div style={{ fontSize: '12.5px', marginTop: '6px', fontWeight: 700, color: '#B42318' }}>
              ✕ Última tentativa de lançamento recusada ({new Date(ultimoEnvioCigam.em).toLocaleString('pt-BR')}): {ultimoEnvioCigam.mensagem}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={botao('secundario')} onClick={copiarCigam}>Copiar para o CIGAM</button>
          <button type="button" style={botao('secundario')} onClick={baixarCsv}>Baixar CSV</button>
          <button type="button" style={botao('secundario', gerandoPdf)} disabled={gerandoPdf} onClick={() => { gerarPdf().catch(() => undefined); }}>{gerandoPdf ? 'Gerando PDF…' : 'Baixar PDF'}</button>
          <button type="button" style={botao('secundario')} onClick={baixarJson} title="Baixa o B.O.M. em JSON (dgt-portal/bom@1) para lançamento via API">Gerar JSON</button>
          <button type="button" style={botao('secundario')} onClick={copiarJson} title="Copia o JSON para colar no Postman ou em outro integrador">Copiar JSON</button>
          {enviado && (
            <button
              type="button"
              style={botao(lancadoCigam ? 'secundario' : 'principal')}
              onClick={() => setLancandoCigam(true)}
              title={lancadoCigam ? 'Ver o andamento e os lançamentos deste B.O.M. no CIGAM' : 'Cria a oportunidade e o pedido de venda no CIGAM (Homologação)'}
            >
              {lancadoCigam ? (andamentoCigam && andamentoCigam.emProcessamento ? '⏳ Acompanhar lançamento' : 'Ver lançamento no CIGAM') : 'Lançar no CIGAM'}
            </button>
          )}
          {!enviado && podeEnviar && (
            <button type="button" style={botao('principal', salvando || !resultado || resultado.itens.length === 0)} disabled={salvando || !resultado || resultado.itens.length === 0} onClick={() => { enviar().catch(() => undefined); }}>
              {salvando ? 'Enviando…' : 'Enviar para aprovação →'}
            </button>
          )}
        </div>
      </div>

      {lancandoCigam && (
        <LancarCigamPainel
          dataverseService={dataverseService}
          bomId={bom.id}
          numero={numero}
          revisao={bom.revisao}
          clienteCigam={demanda.codigoCigam || ''}
          prazoEntrega={demanda.prazoEntrega}
          linhas={linhas.length}
          semCodigo={semCodigo}
          semPreco={semPreco}
          enviado={enviado && !!congelado}
          aoFechar={() => { setLancandoCigam(false); lerEnvios(); }}
          aoConcluir={(mensagem: string) => { setLancandoCigam(false); lerEnvios(); mostrar(mensagem); }}
        />
      )}

      {aviso && <div role="status" style={{ ...cartao, padding: '10px 14px', background: '#E7F6EC', borderColor: '#107C10', color: '#107C10', fontWeight: 700 }}>{aviso}</div>}

      {/* Indicadores */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {indicador('Pontos', String(pontos || totais.pontos), COR.ciano)}
        {indicador('Câmeras', `${totais.camerasVideo} vídeo · ${totais.camerasOcr} OCR`, COR.ciano)}
        {indicador('Linhas de itens', String(linhas.length), COR.indigo)}
        {indicador('Valor CIGAM estimado', moeda(valorTotal), '#107C10')}
        {indicador('Total do projeto', moeda(resumoValores.total), COR.azul)}
        {indicador('Sem preço / sem código', `${semPreco} / ${semCodigo}`, semPreco || semCodigo ? '#B45309' : COR.borda)}
      </div>

      {/* Demanda e Go/No-Go */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        <div style={cartao}>
          <h3 style={titulo}>Demanda</h3>
          {kv('Demanda', `${demanda.numero} · ${demanda.nome}`)}
          {kv('Cliente', demanda.cliente)}
          {kv('Município / UF', [demanda.municipio, demanda.uf].filter(Boolean).join(' / '))}
          {kv('Canal / modalidade', [demanda.canal, demanda.modalidade].filter(Boolean).join(' · '))}
          {kv('Tipo de projeto', demanda.tipoProjeto)}
          {kv('Tipo de entrega', demanda.tipoEntrega)}
          {kv('Oportunidade CRM', demanda.numeroCrm)}
          {kv('Prazo de entrega', formatarData(demanda.prazoEntrega))}
          {kv('Responsável pelo B.O.M.', bom.responsavelNome)}
        </div>
        <div style={cartao}>
          <h3 style={titulo}>Matriz Go/No-Go</h3>
          {analise
            ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <Selo texto={DECISAO[analise.decisao].texto} cor={DECISAO[analise.decisao].cor} fundo={DECISAO[analise.decisao].fundo} />
                  <strong style={{ color: COR.azul }}>{formatarNumero(analise.pontuacao)} pontos</strong>
                  <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{analise.avaliadorNome} · {formatarData(analise.data)}</span>
                </div>
                {analise.parecer && (
                  <div style={{ background: '#E6F9FC', borderLeft: `4px solid ${COR.ciano}`, padding: '9px 12px', fontSize: '13px', color: COR.azul, borderRadius: '0 8px 8px 0' }}>
                    <strong>Parecer.</strong> {analise.parecer}
                  </div>
                )}
              </>
            )
            : <p style={{ fontSize: '13px', color: COR.texto2 }}>Sem análise registrada.</p>}
          {demanda.escopo && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: COR.azul }}>
              <strong>Escopo.</strong> {demanda.escopo}
            </div>
          )}
        </div>
      </div>

      {/* Pontos */}
      <div style={{ ...cartao, padding: 0, overflow: 'hidden' }}>
        <h3 style={{ ...titulo, padding: '14px 18px 0' }}>Composição da solução</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead><tr>{['Ponto', 'Kit', 'Qtd.', 'Vídeo', 'OCR/LPR', 'Soluções'].map((t, i) => <th key={t} style={{ ...th, textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{t}</th>)}</tr></thead>
            <tbody>
              {selecao.pontos.map(p => {
                const vigentes = vigentesDoPonto(p.id);
                const borda = vigentes.length ? { borderBottom: 0 } : {};
                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td style={{ ...td, ...borda, fontWeight: 700 }}>{p.nome}</td>
                      <td style={{ ...td, ...borda }}>
                        {nomeKitDoPonto(p)}
                        {vigentes.length > 0 && (
                          <div style={{ marginTop: '3px' }}>
                            <Selo texto={`Kit alterado · ${vigentes.length} item(ns)`} cor="#B45309" fundo="#FFF4E5" />
                          </div>
                        )}
                      </td>
                      <td style={{ ...num, ...borda }}>{p.quantidade}</td>
                      <td style={{ ...num, ...borda }}>{p.camerasVideo}</td>
                      <td style={{ ...num, ...borda }}>{p.camerasOcr}</td>
                      <td style={{ ...td, ...borda, fontSize: '12.5px' }}>{solucoesDoPonto(p)}</td>
                    </tr>
                    {vigentes.length > 0 && (
                      <tr>
                        <td style={td} />
                        <td colSpan={5} style={{ ...td, paddingTop: 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {vigentes.map(r => (
                              <div key={r.alteracao.id} style={{ border: `1px solid ${COR.borda}`, borderLeft: '4px solid #B45309', borderRadius: '8px', padding: '7px 10px', background: '#FFFCF7' }}>
                                <div style={{ fontSize: '12.5px', color: '#B42318', textDecoration: 'line-through' }}>
                                  − {r.alteracao.removido.descricao}
                                  <span style={{ color: COR.texto2 }}> · {r.alteracao.removido.codigo || 'sem código'} · {r.quantidadeRemovida.toLocaleString('pt-BR')} un.</span>
                                </div>
                                {r.alteracao.acao === 'substituir' && r.alteracao.adicionado
                                  ? (
                                    <div style={{ fontSize: '12.5px', color: '#107C10', fontWeight: 600 }}>
                                      + {r.alteracao.adicionado.descricao}
                                      <span style={{ color: COR.texto2, fontWeight: 400 }}> · {r.alteracao.adicionado.codigo || 'sem código'} · {r.quantidadeAdicionada.toLocaleString('pt-BR')} un.</span>
                                    </div>
                                  )
                                  : <div style={{ fontSize: '12px', color: COR.texto2 }}>Cancelado sem substituto</div>}
                                <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>
                                  {r.alteracao.acao === 'substituir' ? 'Substituído' : 'Cancelado'} por {quemQuando(r.alteracao.por, r.alteracao.em)} · Motivo: {r.alteracao.motivo}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itens */}
      <div style={{ ...cartao, padding: 0, overflow: 'hidden' }}>
        <h3 style={{ ...titulo, padding: '14px 18px 0' }}>
          Itens do B.O.M.
          <span style={{ fontSize: '12.5px', fontWeight: 400, color: COR.texto2 }}>{linhas.length} linhas · código CIGAM e valor unitário do CIGAM</span>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead><tr>{['Código CIGAM', 'Descrição', 'Categoria', 'Qtd.', 'Valor unit.', 'Total'].map((t, i) => <th key={t} style={{ ...th, textAlign: i >= 3 ? 'right' : 'left' }}>{t}</th>)}</tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={`${l.codigo}-${i}`} style={{ background: i % 2 ? COR.fundo : '#FFFFFF' }}>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {l.pendente ? <Selo texto="sem código" cor="#B45309" fundo="#FFF4E5" /> : l.codigo}
                  </td>
                  <td style={td}>
                    {l.descricao}
                    {l.substituto && <span style={{ marginLeft: '6px' }}><Selo texto="substituto" cor="#107C10" fundo="#E7F6EC" /></span>}
                    <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{l.origem}</div>
                  </td>
                  <td style={{ ...td, fontSize: '12.5px' }}>{l.categoria}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{l.quantidade}</td>
                  <td style={num}>{l.valorUnitario !== undefined ? moeda(l.valorUnitario) : <span style={{ color: '#B45309' }}>sem preço</span>}</td>
                  <td style={num}>{l.total !== undefined ? moeda(l.total) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ ...td, fontWeight: 700, background: '#EDF0F5', borderTop: `2px solid ${COR.azul}` }}>
                  Total com valores do CIGAM{semPreco ? ` · ${semPreco} item(ns) sem preço não somados` : ''}
                </td>
                <td style={{ ...num, fontWeight: 800, background: '#EDF0F5', borderTop: `2px solid ${COR.azul}` }}>{moeda(valorTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Histórico das trocas de itens */}
      <div style={cartao}>
        <h3 style={titulo}>
          Alterações nos kits
          <span style={{ fontSize: '12.5px', fontWeight: 400, color: COR.texto2 }}>
            {historico.length ? `${emVigor} em vigor · ${historico.length} registro(s) no histórico` : 'nenhum item trocado ou cancelado'}
          </span>
        </h3>
        {historico.length > 0
          ? <HistoricoAlteracoes registros={historico} mostrarPonto />
          : <p style={{ fontSize: '13px', color: COR.texto2, margin: 0 }}>Os kits estão como o montador gerou. Para trocar ou cancelar um item, use a Seleção de kit.</p>}
      </div>

      {/* Alertas */}
      <div style={cartao}>
        <h3 style={titulo}>Alertas e pendências</h3>
        {alertas.length
          ? (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: COR.azul, lineHeight: 1.6 }}>
              {alertas.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )
          : <p style={{ fontSize: '13px', color: COR.texto2, margin: 0 }}>Nenhuma pendência.</p>}
      </div>

      {/* HH (prévia) */}
      <EtapaHHBom
        dataverseService={dataverseService}
        resumoKit={resultado || { itens: itensBase, porPonto: [], alertas: [], totais }}
        custoInicial={valorTotal}
        custoFixo
        notaCusto={congelado ? 'itens e valores do CIGAM congelados no envio' : 'total dos itens, valores do CIGAM'}
        itensSemPreco={semPreco}
        resumoCongelado={congelado ? congelado.resumoValores : undefined}
        somenteLeitura
        complementos={selecao.complementosHH}
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
        {aoVoltarKit && <button type="button" style={botao('secundario')} onClick={aoVoltarKit}>← Ver a Seleção de kit</button>}
        {aoVoltarHH && <button type="button" style={botao('secundario')} onClick={aoVoltarHH}>Ver o Cálculo de HH</button>}
      </div>
    </div>
  );
};

export default EtapaBomPronto;
