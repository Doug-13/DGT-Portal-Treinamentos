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
  SITUACAO,
  quemQuando
} from './AlteracoesItensKit';

import EtapaHHBom from './EtapaHHBom';

import { valorDoItem } from '../../services/bom/valoresBom';

import {
  totalIntegracao,
  totalManutencao
} from '../../services/hh/complementosHH';

import logoDgt from '../../assets/logo-dgt.png';

import {
  COR,
  DECISAO,
  FONTE,
  Selo,
  botao,
  cartao,
  formatarData,
  formatarDataHora,
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
  onEnviar: (congelado: IBomEnviado) => Promise<void>;
  aoVoltarKit: () => void;
  aoVoltarHH: () => void;
}

interface ILinhaBom extends IItemBom {
  valorUnitario?: number;
  total?: number;
}

const moeda = (v: number): string =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ORDEM_CATEGORIA = ['Estrutura', 'Câmera', 'Equipamento', 'Infraestrutura', 'Identificação', 'Licença', 'Serviço'];

const escapar = (texto: string): string =>
  String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const doisDigitos = (n: number): string => (n < 10 ? `0${n}` : String(n));

const hojeIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
};

const solucoesDoPonto = (ponto: ISelecaoKit['pontos'][number]): string =>
  [
    ponto.safeCity ? 'Safe City' : '',
    ponto.smartDetect ? 'Smart Detect' : '',
    ponto.faceDetect ? 'Face Detect' : '',
    ponto.safeWay ? 'Safe Way' : ''
  ].filter(Boolean).join(', ') || '—';

// ------------------------------------------------------------
// Documento para impressão / PDF (identidade visual DGT)
// ------------------------------------------------------------

const montarDocumento = (dados: {
  bom: IBomRegistro;
  demanda: IDemandaBom;
  analise?: IAnaliseGoNoGo;
  selecao?: ISelecaoKit;
  linhas: ILinhaBom[];
  valorTotal: number;
  semPreco: number;
  alertas: string[];
  enviado: boolean;
  dataEnvio?: string;
  historico: IRegistroAlteracaoBom[];
}): string => {

  const { bom, demanda, analise, selecao, linhas, valorTotal, semPreco, alertas, enviado, dataEnvio, historico } = dados;
  const quem = (por: string, em: string): string => `${escapar(por || 'usuário não identificado')} · ${escapar(formatarDataHora(em))}`;
  const conteudoAlteracao = (r: IRegistroAlteracaoBom): string => {
    const a = r.alteracao;
    return `<span class="sai">− ${escapar(a.removido.descricao)} (${escapar(a.removido.codigo || 'sem código')}${r.quantidadeRemovida ? ` · ${r.quantidadeRemovida} un.` : ''})</span>` +
      (a.acao === 'substituir' && a.adicionado ? `<br><span class="entra">+ ${escapar(a.adicionado.descricao)} (${escapar(a.adicionado.codigo || 'sem código')}${r.quantidadeAdicionada ? ` · ${r.quantidadeAdicionada} un.` : ''})</span>` : '') +
      `<br><span class="hist">${a.acao === 'substituir' ? 'Substituído' : 'Cancelado'} por ${quem(a.por, a.em)} · ${escapar(SITUACAO[r.situacao].texto)} · Motivo: ${escapar(a.motivo)}` +
      (a.desfeita ? ` · Desfeita por ${quem(a.desfeita.por, a.desfeita.em)}${a.desfeita.motivo ? ` (${escapar(a.desfeita.motivo)})` : ''}` : '') +
      '</span>';
  };
  const linhaAlteracao = (r: IRegistroAlteracaoBom): string => `<div class="alt">${conteudoAlteracao(r)}</div>`;
  const logo = new URL(logoDgt, window.location.href).href;
  const kv = (rotulo: string, valor: string): string =>
    `<tr><th>${escapar(rotulo)}</th><td>${escapar(valor || '—')}</td></tr>`;

  const pontos = (selecao ? selecao.pontos : []).map(p => {
    const vigentes = historico.filter(r => r.pontoId === p.id && r.situacao === 'aplicada');
    return `<tr><td><b>${escapar(p.nome)}</b></td><td>${escapar(nomeKitDoPonto(p))}${vigentes.length ? `<br><i>kit alterado: ${vigentes.length} item(ns)</i>` : ''}</td><td class="n">${p.quantidade}</td><td class="n">${p.camerasVideo}</td><td class="n">${p.camerasOcr}</td><td>${escapar(solucoesDoPonto(p))}</td></tr>` +
      (vigentes.length ? `<tr><td></td><td colspan="5">${vigentes.map(linhaAlteracao).join('')}</td></tr>` : '');
  }).join('');

  const itens = linhas.map(l =>
    `<tr><td>${l.pendente ? '<i>sem código</i>' : escapar(l.codigo)}</td><td>${escapar(l.descricao)}${l.substituto ? ' <i>(substituto)</i>' : ''}</td><td>${escapar(l.categoria)}</td><td class="n">${l.quantidade}</td><td class="n">${l.valorUnitario !== undefined ? moeda(l.valorUnitario) : '—'}</td><td class="n">${l.total !== undefined ? moeda(l.total) : '—'}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>BOM ${escapar(bom.numero.replace(/^BOM\s*/i, ''))} ${escapar(bom.revisao)}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box}
body{margin:0;font-family:Barlow,Arial,sans-serif;color:#202A44;font-size:11.5px;line-height:1.4}
.capa{background:#202A44;color:#fff;padding:20px 24px;display:flex;gap:20px;align-items:center;border-bottom:4px solid #05C3DD;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.capa img{height:54px;background:#fff;border-radius:6px;padding:6px}
.k1{font-weight:700;font-size:24px;letter-spacing:.04em;text-transform:uppercase}
.k2{color:#05C3DD;font-weight:600;font-size:14px;letter-spacing:.06em;text-transform:uppercase;margin:2px 0 6px}
.k3{font-weight:600;font-size:14px}.k4{font-weight:300;font-size:11.5px}
.kpis{display:flex;gap:8px;margin:14px 0 4px}
.kpis div{flex:1;background:#EDF0F5;border-left:4px solid #05C3DD;padding:8px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kpis span{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#888B8D;font-weight:600}
.kpis b{font-size:15px}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #05C3DD;display:inline-block}
table{width:100%;border-collapse:collapse;margin-bottom:6px;page-break-inside:auto}
tr{page-break-inside:avoid}
.kv th{width:30%;background:#F2F2F2;text-align:left;font-weight:600;padding:5px 8px;border:1px solid #D9D9D6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kv td{padding:5px 8px;border:1px solid #D9D9D6}
.t thead{display:table-header-group}
.t th{background:#202A44;color:#fff;text-transform:uppercase;font-size:9.5px;letter-spacing:.05em;padding:6px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.t td{padding:5px 6px;border-bottom:1px solid #D9D9D6;vertical-align:top}
.t tbody tr:nth-child(even) td{background:#F2F2F2;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.t tfoot td{font-weight:700;background:#EDF0F5;border-top:2px solid #202A44;padding:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.n{text-align:right;white-space:nowrap}
.dec{display:inline-block;font-weight:700;padding:3px 10px;margin-right:8px}
.dec.go{background:#202A44;color:#fff}.dec.gr{border:2px solid #485CC7;color:#485CC7}.dec.ng{border:2px dashed #888B8D}
.nota{background:#E6F9FC;border-left:4px solid #05C3DD;padding:7px 10px;margin:6px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
ul{margin:4px 0;padding-left:16px}li{margin:3px 0}
.alt{margin:2px 0 6px;font-size:10.5px}.alt .sai{color:#B42318;text-decoration:line-through}.alt .entra{color:#107C10;font-weight:600}.alt .hist{color:#888B8D}
.rodape{margin-top:18px;border-top:1px solid #D9D9D6;padding-top:6px;font-size:9.5px;color:#888B8D;display:flex;justify-content:space-between}
</style></head><body>
<div class="capa"><img src="${logo}" alt="DGT"><div>
<div class="k1">Bill of Materials</div>
<div class="k2">BOM ${escapar(bom.numero.replace(/^BOM\s*/i, ''))} · ${escapar(bom.revisao)}</div>
<div class="k3">${escapar(demanda.nome)}</div>
<div class="k4">${escapar([demanda.cliente, [demanda.municipio, demanda.uf].filter(Boolean).join('/')].filter(Boolean).join(' · '))} · emitido em ${formatarData(hojeIso())}${enviado ? ` · enviado para aprovação${dataEnvio ? ' em ' + formatarData(dataEnvio) : ''}` : ''}</div>
</div></div>
<div class="kpis">
<div><span>Pontos</span><b>${selecao ? selecao.pontos.reduce((t, p) => t + p.quantidade, 0) : 0}</b></div>
<div><span>Linhas de itens</span><b>${linhas.length}</b></div>
<div><span>Valor CIGAM estimado</span><b>${moeda(valorTotal)}</b></div>
<div><span>Itens sem preço</span><b>${semPreco}</b></div>
</div>
<h2>1. Identificação</h2>
<table class="kv">
${kv('Demanda', `${demanda.numero} · ${demanda.nome}`)}${kv('Cliente', demanda.cliente)}${kv('Município / UF', [demanda.municipio, demanda.uf].filter(Boolean).join(' / '))}
${kv('Canal / modalidade', [demanda.canal, demanda.modalidade].filter(Boolean).join(' · '))}${kv('Tipo de projeto', demanda.tipoProjeto)}${kv('Tipo de entrega', demanda.tipoEntrega)}
${kv('Oportunidade CRM', demanda.numeroCrm)}${kv('Prazo de entrega', formatarData(demanda.prazoEntrega))}${kv('Responsável pelo B.O.M.', bom.responsavelNome)}
${kv('Responsáveis da demanda', demanda.responsaveis.filter(r => r.ativo).map(r => r.nome).join(', '))}
</table>
<h2>2. Análise Go/No-Go</h2>
${analise ? `<p><span class="dec ${analise.decisao === 'GO' ? 'go' : analise.decisao === 'NO-GO' ? 'ng' : 'gr'}">${escapar(analise.decisao.toUpperCase())}</span>${formatarNumero(analise.pontuacao)} pontos · ${escapar(analise.avaliadorNome)} · ${formatarData(analise.data)}</p>${analise.parecer ? `<div class="nota"><b>Parecer.</b> ${escapar(analise.parecer)}</div>` : ''}` : '<p>Sem análise registrada.</p>'}
<h2>3. Composição da solução</h2>
<table class="t"><thead><tr><th>Ponto</th><th>Kit</th><th class="n">Qtd.</th><th class="n">Vídeo</th><th class="n">OCR</th><th>Soluções</th></tr></thead><tbody>${pontos}</tbody></table>
<h2>4. Itens do B.O.M.</h2>
<table class="t"><thead><tr><th>Código CIGAM</th><th>Descrição</th><th>Categoria</th><th class="n">Qtd.</th><th class="n">Valor unit.</th><th class="n">Total</th></tr></thead>
<tbody>${itens}</tbody><tfoot><tr><td colspan="5">Total com valores do CIGAM${semPreco ? ` (${semPreco} item(ns) sem preço não somados)` : ''}</td><td class="n">${moeda(valorTotal)}</td></tr></tfoot></table>
<h2>5. Alterações nos kits</h2>
${historico.length ? historico.map(r => `<div class="alt"><b>${escapar(r.pontoNome)}</b> · ${escapar(r.kit)}<br>${conteudoAlteracao(r)}</div>`).join('') : '<p>Nenhum item trocado ou cancelado.</p>'}
<h2>6. Integração e manutenção</h2>
${(() => {
    const c = selecao ? selecao.complementosHH : undefined;
    const i = c ? c.integracao : undefined;
    const m = c ? c.manutencao : undefined;
    const resp = (x?: { tem: boolean }): string => (x ? (x.tem ? 'Sim' : 'Não') : 'Não respondido');
    return `<table class="kv">${kv('Tem integração?', resp(i))}${i && i.tem ? kv('Integração', `${i.horas} h × ${moeda(i.valorHora)} + BDI ${formatarNumero(i.bdi || 0)}% = ${moeda(totalIntegracao(i))}`) : ''}` +
      `${kv('Tem contrato de manutenção?', resp(m))}${m && m.tem ? kv('Manutenção', `${m.pontos} ponto(s) × ${moeda(m.valorPonto)} = ${moeda(totalManutencao(m))}`) : ''}</table>`;
  })()}
<h2>7. Alertas e pendências</h2>
${alertas.length ? `<ul>${alertas.map(a => `<li>${escapar(a)}</li>`).join('')}</ul>` : '<p>Nenhuma pendência.</p>'}
<div class="rodape"><span>BOM ${escapar(bom.numero.replace(/^BOM\s*/i, ''))} ${escapar(bom.revisao)} · Portal DGT · Arquitetura de Soluções</span><span>DGT Tecnologia</span></div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
};

// ------------------------------------------------------------
// Componente
// ------------------------------------------------------------

const EtapaBomPronto: React.FC<IEtapaBomProntoProps> = ({
  bom, demanda, analise, selecao, resultado, precos, dataverseService, dataEnvio, salvando, onEnviar, aoVoltarKit, aoVoltarHH
}) => {

  const congelado = selecao ? selecao.bomEnviado : undefined;
  const enviado = bom.etapa === 'Enviado para aprovação' || !!congelado;
  const [aviso, setAviso] = React.useState('');

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

  const gerarPdf = (): void => {
    const janela = window.open('', '_blank');
    if (!janela) {
      mostrar('O navegador bloqueou a nova janela. Permita pop-ups para este site e tente de novo.');
      return;
    }
    janela.document.open();
    janela.document.write(montarDocumento({ bom, demanda, analise, selecao, linhas, valorTotal, semPreco, alertas, enviado, dataEnvio, historico }));
    janela.document.close();
  };

  const enviar = async (): Promise<void> => {
    if (!selecao || !resultado) {
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
      alteracoes: historicoAlteracoes(resultado)
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
        <button type="button" style={botao('principal')} onClick={aoVoltarKit}>Ir para a Seleção de kit</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONTE }}>

      {/* Situação */}
      <div style={{ ...cartao, background: enviado ? '#E7F6EC' : '#E8F2FF', borderColor: enviado ? '#107C10' : '#0F6CBD', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <strong style={{ color: COR.azul, fontSize: '15px' }}>
            {enviado ? `✓ BOM ${numero} ${bom.revisao} enviado para aprovação` : `BOM ${numero} ${bom.revisao} pronto para revisão e envio`}
          </strong>
          <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '3px' }}>
            {enviado
              ? `Lista de itens congelada${congelado ? ` em ${formatarData(congelado.em.substring(0, 10))}` : ''}${dataEnvio ? ` · data de envio ${formatarData(dataEnvio)}` : ''}. Mudanças na aba Kits não alteram este B.O.M.`
              : 'Lista calculada com o catálogo atual da aba Kits. Ao enviar para aprovação, os itens e valores são congelados.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={botao('secundario')} onClick={copiarCigam}>Copiar para o CIGAM</button>
          <button type="button" style={botao('secundario')} onClick={baixarCsv}>Baixar CSV</button>
          <button type="button" style={botao('secundario')} onClick={gerarPdf}>Gerar PDF</button>
          {!enviado && (
            <button type="button" style={botao('principal', salvando || !resultado || resultado.itens.length === 0)} disabled={salvando || !resultado || resultado.itens.length === 0} onClick={() => { enviar().catch(() => undefined); }}>
              {salvando ? 'Enviando…' : 'Enviar para aprovação →'}
            </button>
          )}
        </div>
      </div>

      {aviso && <div role="status" style={{ ...cartao, padding: '10px 14px', background: '#E7F6EC', borderColor: '#107C10', color: '#107C10', fontWeight: 700 }}>{aviso}</div>}

      {/* Indicadores */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {indicador('Pontos', String(pontos || totais.pontos), COR.ciano)}
        {indicador('Câmeras', `${totais.camerasVideo} vídeo · ${totais.camerasOcr} OCR`, COR.ciano)}
        {indicador('Linhas de itens', String(linhas.length), COR.indigo)}
        {indicador('Valor CIGAM estimado', moeda(valorTotal), '#107C10')}
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
        somenteLeitura
        complementos={selecao.complementosHH}
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
        <button type="button" style={botao('secundario')} onClick={aoVoltarKit}>← Ver a Seleção de kit</button>
        <button type="button" style={botao('secundario')} onClick={aoVoltarHH}>Ver o Cálculo de HH</button>
      </div>
    </div>
  );
};

export default EtapaBomPronto;
