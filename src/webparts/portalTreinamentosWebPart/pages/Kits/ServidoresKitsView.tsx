import * as React from 'react';

import {
  IAlertaServidor,
  ILinhaServidor,
  INFO_SOFTWARE,
  IPremissaServidor,
  ISoftwareServidor,
  NivelAlertaServidor,
  SOFTWARES_SEM_MEMORIAL,
  SOFTWARES_SERVIDOR,
  SoftwareServidor,
  VerificacaoPremissa,
  nomeLinha,
  pendenciasLinha
} from '../../services/bom/catalogoServidores';

import {
  ICatalogoKitsCarregado,
  IItemKit,
  itemDaFicha,
  itemDaLinha,
  servidoresDoCatalogo
} from '../../services/bom/KitsService';

import {
  csvDasLinhas,
  linhasDoCsv
} from '../../services/bom/planilhaServidores';

import {
  Aviso,
  COR,
  CampoMotivo,
  Interruptor,
  Modal,
  Selo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  painel,
  rotulo
} from './kitsComum';

// ============================================================
// KITS — SERVIDORES (memoriais de cálculo)
//
// As linhas que o seletor de servidor da Arquitetura usa: uma por
// faixa de capacidade × opção de distribuição, com a ficha de cada
// software (premissas e alertas). Os alertas vêm daqui, não do
// código: corrigir o memorial apaga o alerta sem nova versão.
// ============================================================

export interface IServidoresKitsViewProps {
  catalogo: ICatalogoKitsCarregado;
  podeEditar: boolean;
  aoGravar: (itens: Array<{ novo: IItemKit; anterior?: IItemKit }>, motivo: string, resumo: string) => Promise<void>;
}

const formatarNum = (n: number): string => (n ? (Math.round(n * 100) / 100).toLocaleString('pt-BR') : '—');

// ------------------------------------------------------------
// Texto ⇄ listas (edição em caixa de texto, uma por linha)
// ------------------------------------------------------------

const NIVEIS: NivelAlertaServidor[] = ['bloqueio', 'aviso', 'info'];
const VERIFICACOES: VerificacaoPremissa[] = ['manual', 'resolucao', 'informativo'];

// "aviso | texto | campo=processador | contem=3106 | compressao=H.265"
const alertasParaTexto = (alertas: IAlertaServidor[]): string =>
  alertas.map(a => [a.nivel, a.texto, a.campo ? `campo=${a.campo}` : '', a.contem ? `contem=${a.contem}` : '', a.compressao ? `compressao=${a.compressao}` : '']
    .filter(Boolean).join(' | ')).join('\n');

const textoParaAlertas = (texto: string): IAlertaServidor[] =>
  texto.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const partes = l.split('|').map(p => p.trim());
    const nivel = (NIVEIS.indexOf(partes[0] as NivelAlertaServidor) >= 0 ? partes[0] : 'aviso') as NivelAlertaServidor;
    const textoAlerta = NIVEIS.indexOf(partes[0] as NivelAlertaServidor) >= 0 ? partes[1] || '' : partes[0];
    const alerta: IAlertaServidor = { nivel, texto: textoAlerta };
    partes.slice(2).forEach(p => {
      const [k, v] = p.split('=').map(x => (x || '').trim());
      if (k === 'campo' && (v === 'processador' || v === 'gpu' || v === 'so')) { alerta.campo = v; }
      if (k === 'contem' && v) { alerta.contem = v; }
      if (k === 'compressao' && (v === 'H.264' || v === 'H.265')) { alerta.compressao = v; }
    });
    return alerta;
  }).filter(a => a.texto);

// "Resolução | até 4 MP | resolucao | 4"
const premissasParaTexto = (premissas: IPremissaServidor[]): string =>
  premissas.map(p => [p.item, p.valor, p.verificacao, p.limiteMp ? String(p.limiteMp) : ''].filter(Boolean).join(' | ')).join('\n');

const textoParaPremissas = (texto: string): IPremissaServidor[] =>
  texto.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [item, valor, verificacao, limite] = l.split('|').map(p => (p || '').trim());
    const v = (VERIFICACOES.indexOf(verificacao as VerificacaoPremissa) >= 0 ? verificacao : 'manual') as VerificacaoPremissa;
    return { item, valor: valor || '', verificacao: v, ...(v === 'resolucao' ? { limiteMp: Number((limite || '4').replace(',', '.')) || 4 } : {}) };
  }).filter(p => p.item);

const separar = (texto: string): string[] => texto.split('|').map(x => x.trim()).filter(Boolean);

// ------------------------------------------------------------
// Editor de linha
// ------------------------------------------------------------

const EditorLinha: React.FC<{
  linha: ILinhaServidor;
  podeEditar: boolean;
  aoFechar: () => void;
  aoSalvar: (linha: ILinhaServidor, motivo: string) => Promise<void>;
}> = ({ linha, podeEditar, aoFechar, aoSalvar }) => {

  const [d, setD] = React.useState<ILinhaServidor>({ ...linha });
  const [textos, setTextos] = React.useState({
    processadores: linha.processadores.join(' | '),
    gpus: linha.gpus.join(' | '),
    sistemas: linha.sistemas.join(' | '),
    licencas: linha.licencas.map(l => `${l.codigo}=${l.qtd}`).join(' | '),
    alertas: alertasParaTexto(linha.alertas)
  });
  const [motivo, setMotivo] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const bloqueado = !podeEditar || salvando;

  const mudar = (p: Partial<ILinhaServidor>): void => setD(atual => ({ ...atual, ...p }));
  const texto = (rot: string, chave: keyof ILinhaServidor, ajudaTexto?: string): React.ReactNode => (
    <div>
      <label style={rotulo}>{rot}</label>
      <input style={campo} value={String(d[chave] || '')} disabled={bloqueado} onChange={e => mudar({ [chave]: e.target.value } as Partial<ILinhaServidor>)} />
      {ajudaTexto && <div style={ajuda}>{ajudaTexto}</div>}
    </div>
  );
  const numero = (rot: string, chave: keyof ILinhaServidor): React.ReactNode => (
    <div>
      <label style={rotulo}>{rot}</label>
      <input style={campo} inputMode="decimal" value={d[chave] ? String(d[chave]).replace('.', ',') : ''} disabled={bloqueado}
        onChange={e => { const n = Number(e.target.value.replace(',', '.')); mudar({ [chave]: isNaN(n) ? 0 : n } as Partial<ILinhaServidor>); }} />
    </div>
  );
  const lista = (rot: string, chave: 'processadores' | 'gpus' | 'sistemas' | 'licencas', exemplo: string): React.ReactNode => (
    <div style={{ gridColumn: '1 / -1' }}>
      <label style={rotulo}>{rot}</label>
      <input style={campo} value={textos[chave]} disabled={bloqueado} placeholder={exemplo} onChange={e => setTextos({ ...textos, [chave]: e.target.value })} />
    </div>
  );

  const salvar = async (): Promise<void> => {
    if (!motivo.trim()) {
      setErro('Informe o motivo da alteração: ele vai para o histórico.');
      return;
    }
    const final: ILinhaServidor = {
      ...d,
      processadores: separar(textos.processadores),
      gpus: separar(textos.gpus),
      sistemas: separar(textos.sistemas),
      licencas: separar(textos.licencas).map(p => {
        const [codigo, qtd] = p.split('=');
        return { codigo: (codigo || '').trim().toUpperCase(), qtd: Number((qtd || '1').trim()) || 1 };
      }).filter(l => l.codigo),
      alertas: textoParaAlertas(textos.alertas)
    };
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar(final, motivo.trim());
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  const faltam = pendenciasLinha(d);

  return (
    <Modal
      titulo={podeEditar ? 'Alterar linha do memorial' : 'Linha do memorial'}
      subtitulo={`${nomeLinha(d)} — ${d.chave}`}
      aoFechar={aoFechar}
      largura={760}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          {podeEditar && <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar linha'}</button>}
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {faltam.length > 0 && <Aviso tipo="info">Falta para a linha poder ser escolhida: {faltam.join(', ')}.</Aviso>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {texto('Código CIGAM', 'codigoCigam', d.codigoCigam ? undefined : `Sem código o servidor não é orçável. Sugestão de cadastro: ${d.chave}.`)}
        {numero('Quantidade de servidores', 'qtdServidores')}
        {texto('Memória RAM', 'ram')}
        {texto('Disco do SO', 'discoSo')}
        {numero('Armazenamento por servidor (TB)', 'armazServidorTb')}
        {numero('Armazenamento total (TB)', 'armazTotalTb')}
        {numero('Quantidade de discos', 'discosQtd')}
        {numero('Tamanho do disco (TB)', 'discoTamanhoTb')}
        {texto('Arranjo', 'arranjo')}
        {texto('Compressão de referência', 'compressaoRef')}
        {texto('IOPS', 'iops')}
        {texto('Rede de câmeras (Mbps)', 'redeMbps')}
        {texto('Versão do memorial', 'versaoMemorial')}
        {texto('Código CIGAM do disco', 'codigoDisco')}
        {texto('Código CIGAM do SO', 'codigoSo')}
        {lista('Processadores (alternativas separadas por |)', 'processadores', 'Ex.: Xeon Silver 4310 | Xeon Gold 5315Y')}
        {lista('GPUs (alternativas separadas por |)', 'gpus', 'Ex.: RTX A4000')}
        {lista('Sistemas operacionais (alternativas separadas por |)', 'sistemas', 'Ex.: Windows Server 2022')}
        {d.software === 'digifort' && lista('Licenças do memorial (código=quantidade, separadas por |)', 'licencas', 'Ex.: DGFEN1008V7=1 | DGFEN1164V7=1')}
      </div>

      <div style={{ marginTop: '14px' }}>
        <label style={rotulo}>Alertas desta linha (um por linha: nível | texto)</label>
        <textarea rows={3} style={{ ...campo, resize: 'vertical' }} value={textos.alertas} disabled={bloqueado} onChange={e => setTextos({ ...textos, alertas: e.target.value })}
          placeholder="aviso | As licenças do memorial não fecham com a faixa" />
        <div style={ajuda}>Nível: bloqueio, aviso ou info. Opcional: campo=processador|gpu|so e contem=texto, ou compressao=H.265.</div>
      </div>

      <div style={{ marginTop: '14px' }}>
        <Interruptor marcado={d.ativo} desabilitado={bloqueado} texto={d.ativo ? 'Linha ativa' : 'Linha desativada (não aparece no seletor)'} aoMudar={v => mudar({ ativo: v })} />
      </div>

      {podeEditar && <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={salvando} />}
    </Modal>
  );
};

// ------------------------------------------------------------
// Editor da ficha do software
// ------------------------------------------------------------

const EditorFicha: React.FC<{
  ficha: ISoftwareServidor;
  podeEditar: boolean;
  aoFechar: () => void;
  aoSalvar: (ficha: ISoftwareServidor, motivo: string) => Promise<void>;
}> = ({ ficha, podeEditar, aoFechar, aoSalvar }) => {
  const [d, setD] = React.useState({ memorial: ficha.memorial, dataMemorial: ficha.dataMemorial, premissas: premissasParaTexto(ficha.premissas), alertas: alertasParaTexto(ficha.alertas) });
  const [motivo, setMotivo] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const bloqueado = !podeEditar || salvando;

  const salvar = async (): Promise<void> => {
    if (!motivo.trim()) {
      setErro('Informe o motivo da alteração: ele vai para o histórico.');
      return;
    }
    setSalvando(true);
    try {
      await aoSalvar({ ...ficha, memorial: d.memorial, dataMemorial: d.dataMemorial, premissas: textoParaPremissas(d.premissas), alertas: textoParaAlertas(d.alertas) }, motivo.trim());
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={podeEditar ? 'Alterar ficha do memorial' : 'Ficha do memorial'}
      subtitulo={ficha.nome}
      aoFechar={aoFechar}
      largura={760}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          {podeEditar && <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar ficha'}</button>}
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
        <div>
          <label style={rotulo}>Memorial</label>
          <input style={campo} value={d.memorial} disabled={bloqueado} onChange={e => setD({ ...d, memorial: e.target.value })} />
        </div>
        <div>
          <label style={rotulo}>Data do memorial</label>
          <input style={campo} value={d.dataMemorial} disabled={bloqueado} onChange={e => setD({ ...d, dataMemorial: e.target.value })} />
        </div>
      </div>
      {ficha.software !== 'geral' && (
        <div style={{ marginTop: '14px' }}>
          <label style={rotulo}>Premissas (uma por linha: item | valor | verificação | limite em MP)</label>
          <textarea rows={6} style={{ ...campo, resize: 'vertical' }} value={d.premissas} disabled={bloqueado} onChange={e => setD({ ...d, premissas: e.target.value })} />
          <div style={ajuda}>Verificação: manual (o arquiteto confirma), resolucao (o portal confere as câmeras dos pontos) ou informativo.</div>
        </div>
      )}
      <div style={{ marginTop: '14px' }}>
        <label style={rotulo}>Alertas (um por linha: nível | texto | condições)</label>
        <textarea rows={5} style={{ ...campo, resize: 'vertical' }} value={d.alertas} disabled={bloqueado} onChange={e => setD({ ...d, alertas: e.target.value })} />
        <div style={ajuda}>Texto aceita {'{iops}'}, {'{rede}'}, {'{processador}'}, {'{gpu}'} e {'{so}'}. Condições: campo=processador|gpu|so com contem=texto, ou compressao=H.265.</div>
      </div>
      {podeEditar && <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={salvando} />}
    </Modal>
  );
};

// ------------------------------------------------------------
// Importação da planilha
// ------------------------------------------------------------

const Importacao: React.FC<{
  linhas: ILinhaServidor[];
  aoFechar: () => void;
  aoGravar: (linhas: ILinhaServidor[], motivo: string) => Promise<void>;
}> = ({ linhas, aoFechar, aoGravar }) => {
  const [resultado, setResultado] = React.useState<ReturnType<typeof linhasDoCsv> | undefined>(undefined);
  const [arquivo, setArquivo] = React.useState('');
  const [motivo, setMotivo] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  const ler = (f: File | undefined): void => {
    if (!f) {
      return;
    }
    setArquivo(f.name);
    const leitor = new FileReader();
    leitor.onload = () => setResultado(linhasDoCsv(String(leitor.result || ''), linhas));
    leitor.readAsText(f, 'utf-8');
  };

  const gravar = async (): Promise<void> => {
    if (!resultado || resultado.linhas.length === 0) {
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe o motivo (ex.: carga da planilha de memoriais de 24/04/2026).');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await aoGravar(resultado.linhas, motivo.trim());
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo="Importar planilha dos memoriais"
      subtitulo="CSV no formato do modelo desta tela. As linhas são casadas pela coluna chave."
      aoFechar={aoFechar}
      largura={680}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('principal', salvando || !resultado || resultado.linhas.length === 0)} disabled={salvando || !resultado || resultado.linhas.length === 0} onClick={() => { gravar().catch(() => undefined); }}>
            {salvando ? 'Gravando…' : `Gravar ${resultado ? resultado.linhas.length : 0} linha(s)`}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <label style={rotulo} htmlFor="srv-csv">Arquivo CSV</label>
      <input id="srv-csv" type="file" accept=".csv,text/csv" onChange={e => ler(e.target.files ? e.target.files[0] : undefined)} />
      <div style={ajuda}>No Excel: Salvar como → CSV UTF-8. Colunas que não vierem no arquivo ficam como estão.</div>
      {resultado && (
        <div style={{ marginTop: '14px', fontSize: '13.5px', color: COR.azul, lineHeight: 1.6 }}>
          <strong>{arquivo}</strong>: {resultado.alteradas.length} linha(s) alterada(s), {resultado.novas.length} nova(s)
          {resultado.linhas.length === 0 && resultado.erros.length === 0 && ' — nada mudou em relação ao que está gravado'}.
          {resultado.novas.length > 0 && <div style={ajuda}>Novas: {resultado.novas.join(', ')}</div>}
          {resultado.erros.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: COR.indigo, fontSize: '13px' }}>
              {resultado.erros.slice(0, 15).map(e => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
      {resultado && resultado.linhas.length > 0 && <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={salvando} />}
    </Modal>
  );
};

// ------------------------------------------------------------
// Tela
// ------------------------------------------------------------

const ServidoresKitsView: React.FC<IServidoresKitsViewProps> = ({ catalogo, podeEditar, aoGravar }) => {

  const { linhas, softwares } = servidoresDoCatalogo(catalogo);
  const [software, setSoftware] = React.useState<SoftwareServidor>('digifort');
  const [editando, setEditando] = React.useState<ILinhaServidor | undefined>(undefined);
  const [ficha, setFicha] = React.useState<ISoftwareServidor | undefined>(undefined);
  const [importando, setImportando] = React.useState(false);
  const [inativas, setInativas] = React.useState(false);

  const itemAtual = (chave: string): IItemKit | undefined => catalogo.itens.filter(i => i.chave === chave)[0];

  const salvarLinhas = async (novas: ILinhaServidor[], motivo: string, resumo: string): Promise<void> => {
    await aoGravar(novas.map(l => {
      const anterior = itemAtual(l.chave);
      const novo = itemDaLinha(l, anterior ? anterior.ordem : linhas.length);
      return { novo: { ...novo, id: anterior ? anterior.id : undefined }, anterior };
    }), motivo, resumo);
  };

  const salvarFicha = async (f: ISoftwareServidor, motivo: string): Promise<void> => {
    const anterior = itemAtual(f.chave);
    const novo = itemDaFicha(f, anterior ? anterior.ordem : 0);
    await aoGravar([{ novo: { ...novo, id: anterior ? anterior.id : undefined }, anterior }], motivo, `Ficha alterada: ${f.nome}`);
  };

  const baixarModelo = (): void => {
    const blob = new Blob(['\ufeff' + csvDasLinhas(linhas.slice().sort((a, b) => a.software.localeCompare(b.software) || a.capacidade - b.capacidade || a.opcao.localeCompare(b.opcao)))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'servidores-memoriais.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const doSoftware = linhas
    .filter(l => l.software === software && (inativas || l.ativo))
    .sort((a, b) => a.capacidade - b.capacidade || a.opcao.localeCompare(b.opcao));
  const fichaSw = softwares.filter(f => f.software === software)[0];
  const geral = softwares.filter(f => f.software === 'geral')[0];
  const completas = linhas.filter(l => l.ativo && pendenciasLinha(l).length === 0).length;
  const semCodigo = linhas.filter(l => l.ativo && !l.codigoCigam.trim()).length;
  const naoGravadas = catalogo.itens.filter(i => (i.tipo === 'servidor' || i.tipo === 'servidorSoftware') && !i.id).length;

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: '999px', border: `1px solid ${ativo ? COR.azul : COR.cinzaClaro}`,
    background: ativo ? COR.azul : COR.branco, color: ativo ? COR.branco : COR.azul, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
  });

  return (
    <div>
      <Aviso tipo="info">
        O seletor de servidor da Arquitetura usa estas linhas. Ele cobre {SOFTWARES_SERVIDOR.map(s => INFO_SOFTWARE[s].nomeCurto).join(', ')};
        {' '}{SOFTWARES_SEM_MEMORIAL.join(', ')} não têm memorial e continuam com o servidor incluído à parte.
      </Aviso>

      {naoGravadas > 0 && podeEditar && (
        <Aviso tipo="alerta">
          Há {naoGravadas} linha(s) ou ficha(s) do padrão que ainda não estão no Dataverse. Use “Importar catálogo padrão” no topo da página antes de importar a planilha.
        </Aviso>
      )}

      <div style={{ ...painel, display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '13.5px', color: COR.azul }}>
          <strong style={{ fontSize: '22px' }}>{completas}</strong> de {linhas.filter(l => l.ativo).length} linhas ativas com dados completos
        </div>
        <div style={{ fontSize: '13.5px', color: semCodigo ? COR.indigo : COR.azul }}>
          <strong style={{ fontSize: '22px' }}>{semCodigo}</strong> sem código CIGAM (não orçáveis)
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={botao('secundario')} onClick={baixarModelo}>Baixar modelo CSV</button>
          {podeEditar && <button type="button" style={botao('principal', naoGravadas > 0)} disabled={naoGravadas > 0} onClick={() => setImportando(true)}>Importar planilha</button>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', alignItems: 'center' }} role="tablist" aria-label="Software">
        {SOFTWARES_SERVIDOR.map(s => (
          <button key={s} type="button" role="tab" aria-selected={software === s} style={chip(software === s)} onClick={() => setSoftware(s)}>
            {INFO_SOFTWARE[s].nome} <span style={{ opacity: 0.7, fontWeight: 500 }}>({linhas.filter(l => l.software === s && l.ativo).length})</span>
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }}><Interruptor marcado={inativas} aoMudar={setInativas} texto="Mostrar desativadas" /></span>
      </div>

      {fichaSw && (
        <div style={{ ...painel, marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: COR.azul }}>{fichaSw.memorial}</h3>
            <Selo tom="cinza">{fichaSw.dataMemorial || 'sem data'}</Selo>
            <button type="button" style={{ ...botao('secundario'), marginLeft: 'auto' }} onClick={() => setFicha(fichaSw)}>{podeEditar ? 'Alterar ficha' : 'Ver ficha'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', fontSize: '13px', color: COR.azul }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Premissas</div>
              {fichaSw.premissas.length === 0 ? <div style={ajuda}>Nenhuma.</div> : (
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
                  {fichaSw.premissas.map(p => <li key={p.item}><strong>{p.item}:</strong> {p.valor} <span style={{ color: COR.texto2 }}>({p.verificacao === 'manual' ? 'confirmação do arquiteto' : p.verificacao === 'resolucao' ? 'conferida pelo portal' : 'referência'})</span></li>)}
                </ul>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Alertas do software</div>
              {fichaSw.alertas.length === 0 ? <div style={ajuda}>Nenhum.</div> : (
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
                  {fichaSw.alertas.map((a, i) => <li key={i}><strong>{a.nivel}:</strong> {a.texto}</li>)}
                </ul>
              )}
              {geral && (
                <div style={{ ...ajuda, marginTop: '8px' }}>
                  Mais {geral.alertas.length} regra(s) para todos os softwares (processador, SO).{' '}
                  <button type="button" onClick={() => setFicha(geral)} style={{ border: 0, background: 'none', padding: 0, color: '#036E7D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>{podeEditar ? 'Alterar' : 'Ver'}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', color: COR.azul, minWidth: '900px', boxShadow: 'none', borderRadius: 0 }}>
          <thead>
            <tr>
              {['Faixa', 'Servidores', 'Processador', 'RAM', software === 'ipx' ? 'GPU' : 'Armazenamento', 'SO', 'Código CIGAM', 'Situação', ''].map(h => <th key={h} style={celulaCabecalho}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {doSoftware.map(l => {
              const faltam = pendenciasLinha(l);
              return (
                <tr key={l.chave} style={{ opacity: l.ativo ? 1 : 0.55 }}>
                  <td style={celula}>
                    <div style={{ fontWeight: 700 }}>{l.capacidade} câmeras{l.opcao ? ` · opção ${l.opcao}` : ''}</div>
                    <div style={{ fontSize: '12px', color: COR.texto2 }}>{l.chave}{l.alertas.length ? ` · ${l.alertas.length} alerta(s)` : ''}</div>
                  </td>
                  <td style={celula}>{l.qtdServidores || '—'}</td>
                  <td style={{ ...celula, fontSize: '12.5px' }}>{l.processadores.join(' ou ') || '—'}</td>
                  <td style={celula}>{l.ram || '—'}</td>
                  <td style={{ ...celula, fontSize: '12.5px' }}>{software === 'ipx' ? (l.gpus.join(' ou ') || '—') : (l.armazTotalTb || l.armazServidorTb ? `${formatarNum(l.armazTotalTb || l.armazServidorTb * l.qtdServidores)} TB` : '—')}</td>
                  <td style={{ ...celula, fontSize: '12.5px' }}>{l.sistemas.join(' ou ') || '—'}</td>
                  <td style={{ ...celula, whiteSpace: 'nowrap' }}>{l.codigoCigam || <Selo tom="indigo" titulo="Servidor não orçável até o cadastro">! sem código</Selo>}</td>
                  <td style={celula}>
                    {!l.ativo ? <Selo tom="cinza">Desativada</Selo> : faltam.length === 0 ? <Selo tom="ciano">Completa</Selo> : <Selo tom="indigo" titulo={`Falta: ${faltam.join(', ')}`}>Memorial incompleto</Selo>}
                  </td>
                  <td style={{ ...celula, padding: '6px 14px', textAlign: 'right' }}>
                    <button type="button" style={botao('secundario')} onClick={() => setEditando(l)}>{podeEditar ? 'Alterar' : 'Ver'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditorLinha
          linha={editando}
          podeEditar={podeEditar}
          aoFechar={() => setEditando(undefined)}
          aoSalvar={(l, motivo) => salvarLinhas([l], motivo, `Servidor alterado: ${l.chave}${l.codigoCigam ? ` (${l.codigoCigam})` : ''}`)}
        />
      )}
      {ficha && <EditorFicha ficha={ficha} podeEditar={podeEditar} aoFechar={() => setFicha(undefined)} aoSalvar={salvarFicha} />}
      {importando && (
        <Importacao
          linhas={linhas}
          aoFechar={() => setImportando(false)}
          aoGravar={(novas, motivo) => salvarLinhas(novas, motivo, `Planilha dos memoriais importada: ${novas.length} linha(s)`)}
        />
      )}
    </div>
  );
};

export default ServidoresKitsView;
