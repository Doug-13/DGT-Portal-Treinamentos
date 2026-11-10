import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  KitsService,
  invalidarCatalogoKits
} from '../../services/bom/KitsService';

import {
  COLUNAS_MODELO,
  IAlertaServidorGravado,
  ICatalogoServidoresCarregado,
  ILinhaServidorGravada,
  ServidoresService,
  aplicarServidoresNoMontador,
  chaveDaLinha,
  interpretarColado
} from '../../services/bom/ServidoresService';

import {
  Compressao,
  NivelAlertaServidor,
  REGRAS_ALERTA,
  SOFTWARES_SERVIDOR,
  SoftwareServidor,
  codigoSugerido,
  nomeSoftware
} from '../../services/bom/servidores';

import {
  Aviso,
  COR,
  CampoMotivo,
  Interruptor,
  Modal,
  Selo,
  TomSelo,
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
// Catálogo que o painel "Servidor da central" da Seleção de kit usa:
// uma linha por faixa/opção de memorial (Digifort, Milestone, IPX e
// Digifort + IPX), com código CIGAM, versão do memorial e ativo.
// Também os textos e níveis dos alertas — corrigir um memorial não
// exige nova versão do portal.
// ============================================================

export interface IServidoresViewProps {
  dataverseService?: DataverseService;
  podeEditar: boolean;
  usuarioNome: string;
}

const TOM_NIVEL: Record<NivelAlertaServidor, TomSelo> = { bloqueio: 'indigo', aviso: 'azul', informacao: 'ciano' };
const NOME_NIVEL: Record<NivelAlertaServidor, string> = { bloqueio: 'Bloqueio', aviso: 'Aviso', informacao: 'Informação' };

const tb = (n: number): string => (n ? `${String(n).replace('.', ',')} TB` : '—');

// ------------------------------------------------------------
// Editor de linha
// ------------------------------------------------------------

const EditorLinha: React.FC<{
  linha: ILinhaServidorGravada;
  podeEditar: boolean;
  aoFechar: () => void;
  aoSalvar: (l: ILinhaServidorGravada, motivo: string) => Promise<void>;
}> = ({ linha, podeEditar, aoFechar, aoSalvar }) => {

  const [d, setD] = React.useState<ILinhaServidorGravada>({ ...linha });
  const [alt, setAlt] = React.useState({ processadores: linha.processadores.join('\n'), gpus: linha.gpus.join('\n'), sos: linha.sistemasOperacionais.join('\n') });
  const [motivo, setMotivo] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const mudar = (p: Partial<ILinhaServidorGravada>): void => setD(atual => ({ ...atual, ...p }));
  const bloq = !podeEditar || salvando;
  const nova = !linha.registroId;

  const numero = (rot: string, valor: number, aoMudar: (n: number) => void, passo = 1): React.ReactElement => (
    <div>
      <label style={rotulo}>{rot}</label>
      <input type="number" step={passo} min={0} style={campo} value={valor || ''} disabled={bloq} onChange={e => aoMudar(Number(e.target.value) || 0)} />
    </div>
  );
  const texto = (rot: string, valor: string, aoMudar: (v: string) => void, dica?: string): React.ReactElement => (
    <div>
      <label style={rotulo}>{rot}</label>
      <input style={campo} value={valor} disabled={bloq} onChange={e => aoMudar(e.target.value)} />
      {dica && <div style={ajuda}>{dica}</div>}
    </div>
  );
  const alternativas = (rot: string, chave: 'processadores' | 'gpus' | 'sos', dica: string): React.ReactElement => (
    <div>
      <label style={rotulo}>{rot}</label>
      <textarea rows={3} style={{ ...campo, resize: 'vertical' }} value={alt[chave]} disabled={bloq} onChange={e => setAlt({ ...alt, [chave]: e.target.value })} />
      <div style={ajuda}>{dica}</div>
    </div>
  );

  const salvar = async (): Promise<void> => {
    if (!motivo.trim()) {
      setErro('Informe o motivo: ele vai para o histórico.');
      return;
    }
    const sep = (v: string): string[] => v.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const final: ILinhaServidorGravada = {
      ...d,
      finalidade: (SOFTWARES_SERVIDOR.filter(s => s.software === d.software)[0]).finalidade,
      processadores: sep(alt.processadores),
      gpus: sep(alt.gpus),
      sistemasOperacionais: sep(alt.sos),
      camerasPorServidor: d.camerasPorServidor || Math.ceil(d.capacidade / Math.max(1, d.qtdServidores))
    };
    final.id = nova ? chaveDaLinha(final) : d.id;
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

  return (
    <Modal
      titulo={nova ? 'Nova linha de memorial' : `Linha ${codigoSugerido(d)}`}
      subtitulo="Cada linha é uma faixa (e opção) de um memorial de cálculo do fabricante."
      largura={820}
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          {podeEditar && <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar linha'}</button>}
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={rotulo}>Software</label>
          <select style={campo} value={d.software} disabled={bloq || !nova} onChange={e => mudar({ software: e.target.value as SoftwareServidor })}>
            {SOFTWARES_SERVIDOR.map(s => <option key={s.software} value={s.software}>{s.nome}</option>)}
          </select>
        </div>
        {numero('Capacidade (câmeras)', d.capacidade, n => mudar({ capacidade: Math.round(n) }))}
        {texto('Opção', d.opcao, v => mudar({ opcao: v.toUpperCase().substring(0, 2) }), 'A, B, C ou vazio')}
        {numero('Qtd. de servidores', d.qtdServidores, n => mudar({ qtdServidores: Math.max(1, Math.round(n)) }))}
        {numero('Câmeras por servidor', d.camerasPorServidor, n => mudar({ camerasPorServidor: Math.round(n) }))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        {alternativas('Processadores', 'processadores', 'Uma alternativa por linha (equivalentes).')}
        {alternativas('GPUs', 'gpus', 'Uma por linha; vazio = sem GPU. Uma só = automática.')}
        {alternativas('Sistemas operacionais', 'sos', 'Uma por linha. Uma só = automático.')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        {texto('RAM', d.ram, v => mudar({ ram: v }))}
        {texto('Disco do SO', d.discoSo, v => mudar({ discoSo: v }))}
        {numero('Armaz. por servidor (TB)', d.armazServidorTb, n => mudar({ armazServidorTb: n }), 0.1)}
        {numero('Armaz. total (TB)', d.armazTotalTb, n => mudar({ armazTotalTb: n }), 0.1)}
        {numero('Discos por servidor', d.discosQtd, n => mudar({ discosQtd: Math.round(n) }))}
        {numero('Tamanho do disco (TB)', d.discoTamanhoTb, n => mudar({ discoTamanhoTb: n }), 0.1)}
        {texto('Arranjo', d.arranjo, v => mudar({ arranjo: v }))}
        <div>
          <label style={rotulo}>Compressão de referência</label>
          <select style={campo} value={d.compressaoRef} disabled={bloq} onChange={e => mudar({ compressaoRef: e.target.value as Compressao })}>
            <option value="H.264">H.264</option>
            <option value="H.265">H.265</option>
          </select>
        </div>
        {texto('IOPS', d.iops, v => mudar({ iops: v }))}
        {numero('Rede das câmeras (Mbps)', d.redeCamerasMbps, n => mudar({ redeCamerasMbps: n }), 0.1)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        {texto('Código CIGAM', d.codigoCigam, v => mudar({ codigoCigam: v }), d.codigoCigam ? undefined : 'Sem ele o servidor não é orçável.')}
        {texto('Versão do memorial', d.versaoMemorial, v => mudar({ versaoMemorial: v }), 'Rastreabilidade: qual memorial gerou a linha.')}
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo}>Observação</label>
        <input style={campo} value={d.observacao} disabled={bloq} onChange={e => mudar({ observacao: e.target.value })} />
      </div>
      <Interruptor marcado={d.ativo} desabilitado={bloq} texto={d.ativo ? 'Linha ativa (usada pelo seletor)' : 'Linha desativada'} aoMudar={v => mudar({ ativo: v })} />
      {podeEditar && <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={salvando} />}
    </Modal>
  );
};

// ------------------------------------------------------------
// View
// ------------------------------------------------------------

const ServidoresView: React.FC<IServidoresViewProps> = ({ dataverseService, podeEditar, usuarioNome }) => {

  const servico = React.useMemo(() => (dataverseService ? new ServidoresService(dataverseService) : undefined), [dataverseService]);
  const log = React.useMemo(() => (dataverseService ? new KitsService(dataverseService) : undefined), [dataverseService]);

  const [cat, setCat] = React.useState<ICatalogoServidoresCarregado | undefined>(undefined);
  const [erro, setErro] = React.useState('');
  const [mensagem, setMensagem] = React.useState('');
  const [filtro, setFiltro] = React.useState<'' | SoftwareServidor>('');
  const [editando, setEditando] = React.useState<ILinhaServidorGravada | undefined>(undefined);
  const [colar, setColar] = React.useState(false);
  const [textoColado, setTextoColado] = React.useState('');
  const [alertaEditando, setAlertaEditando] = React.useState<IAlertaServidorGravado | undefined>(undefined);
  const [ocupado, setOcupado] = React.useState(false);

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      return;
    }
    try {
      const c = await servico.carregar();
      aplicarServidoresNoMontador(c);
      invalidarCatalogoKits();
      setCat(c);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico]);

  React.useEffect(() => { carregar().catch(() => undefined); }, [carregar]);

  const avisar = (t: string): void => { setMensagem(t); window.setTimeout(() => setMensagem(''), 5000); };

  if (!cat) {
    return erro ? <Aviso tipo="alerta">{erro}</Aviso> : <div style={{ padding: '30px', color: COR.texto2 }}>Carregando o catálogo de servidores…</div>;
  }

  const editavel = podeEditar && cat.origem === 'dataverse' && !cat.vazio;
  const linhas = cat.linhas.filter(l => !filtro || l.software === filtro);

  const salvarLinha = async (l: ILinhaServidorGravada, motivo: string): Promise<void> => {
    if (!servico || !log) {
      return;
    }
    const anterior = cat.linhas.filter(x => x.registroId && x.registroId === l.registroId)[0];
    await servico.salvarLinha(l);
    await log.registrarAlteracao({ entidade: 'Servidor', chave: l.id, acao: anterior ? 'Alteração' : 'Inclusão', resumo: `Servidor ${codigoSugerido(l)} (${nomeSoftware(l.software)})`, motivo, antes: anterior, depois: l, usuarioNome });
    await carregar();
    avisar(`Linha ${codigoSugerido(l)} salva. O seletor de servidor já usa a versão nova.`);
  };

  const importarPadrao = async (): Promise<void> => {
    if (!servico || !log) {
      return;
    }
    setOcupado(true);
    try {
      const n = await servico.importarPadrao(cat);
      await log.registrarAlteracao({ entidade: 'Servidor', chave: 'importacao', acao: 'Importação', resumo: `Catálogo de servidores padrão importado (${n} registros)`, motivo: 'Carga inicial: memorial Digifort + IPX (nov/2026), linhas parciais Digifort e alertas.', usuarioNome });
      await carregar();
      avisar(`${n} registro(s) criados.`);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setOcupado(false);
    }
  };

  const colados = textoColado.trim() ? interpretarColado(textoColado) : [];
  const validos = colados.filter(x => x.dado).map(x => x.dado as ILinhaServidorGravada);

  const importarColado = async (): Promise<void> => {
    if (!servico || !log) {
      return;
    }
    setOcupado(true);
    try {
      const r = await servico.importarLinhas(cat, validos);
      await log.registrarAlteracao({ entidade: 'Servidor', chave: 'colado', acao: 'Importação', resumo: `Memorial colado: ${r.criadas} linha(s) nova(s), ${r.atualizadas} atualizada(s)`, motivo: 'Importação da planilha Servidores — Consolidado Memoriais de Cálculo.', depois: validos, usuarioNome });
      await carregar();
      setColar(false);
      setTextoColado('');
      avisar(`${r.criadas} linha(s) criadas e ${r.atualizadas} atualizadas.`);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setOcupado(false);
    }
  };

  const baixarModelo = (): void => {
    const blob = new Blob(['\ufeff' + COLUNAS_MODELO.join(';') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-servidores-memorial.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const chip = (ativo: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: '999px', border: `1px solid ${ativo ? COR.azul : COR.cinzaClaro}`, background: ativo ? COR.azul : COR.branco, color: ativo ? COR.branco : COR.azul, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' });

  return (
    <div>
      {mensagem && <Aviso tipo="ok">{mensagem}</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {cat.origem === 'padrao' && <Aviso tipo="info">{cat.motivoPadrao} Mostrando o catálogo padrão (memorial Digifort + IPX de nov/2026) — é o que o seletor usa hoje.</Aviso>}
      {podeEditar && cat.origem === 'dataverse' && (cat.vazio || cat.alertas.some(a => !a.registroId)) && (
        <Aviso tipo="alerta" acao={<button type="button" style={botao('principal', ocupado)} disabled={ocupado} onClick={() => { importarPadrao().catch(() => undefined); }}>{ocupado ? 'Importando…' : 'Importar catálogo padrão'}</button>}>
          {cat.vazio ? 'As tabelas de servidores existem, mas estão vazias. Importe o padrão para começar.' : 'Há alertas padrão ainda não gravados no Dataverse.'}
        </Aviso>
      )}

      <Aviso tipo="info">
        Cobertura do seletor: <strong>Digifort, Milestone e IPX Analytics</strong> (e o combinado Digifort + IPX até 50 câmeras).
        Linhas desativadas não são oferecidas. Milestone e IPX avulso precisam do memorial cadastrado (planilha Consolidado).
      </Aviso>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <button type="button" style={chip(filtro === '')} onClick={() => setFiltro('')}>Todos ({cat.linhas.length})</button>
        {SOFTWARES_SERVIDOR.map(s => (
          <button key={s.software} type="button" style={chip(filtro === s.software)} onClick={() => setFiltro(s.software)}>
            {s.nome} ({cat.linhas.filter(l => l.software === s.software && l.ativo).length}/{cat.linhas.filter(l => l.software === s.software).length})
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {editavel && <button type="button" style={botao('secundario')} onClick={() => setColar(true)}>Colar do Consolidado</button>}
          {editavel && <button type="button" style={botao('principal')} onClick={() => setEditando({ ...cat.linhas[0], registroId: undefined, id: '', software: filtro || 'digifort', capacidade: 0, opcao: '', processadores: [], gpus: [], sistemasOperacionais: [], codigoCigam: '', versaoMemorial: '', observacao: '', ativo: true, qtdServidores: 1, camerasPorServidor: 0, armazServidorTb: 0, armazTotalTb: 0, discosQtd: 0, discoTamanhoTb: 0, ram: '', discoSo: '', arranjo: '', iops: '', redeCamerasMbps: 0, compressaoRef: 'H.264', finalidade: 'gravacao' })}>+ Nova linha</button>}
        </span>
      </div>

      <div style={{ ...painel, padding: 0, overflowX: 'auto', marginBottom: '18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px', boxShadow: 'none', borderRadius: 0 }}>
          <thead>
            <tr>{['Linha', 'Software', 'Faixa', 'Servidores', 'Processador', 'RAM', 'Armaz.', 'GPU', 'SO', 'CIGAM', 'Memorial', ''].map(h => <th key={h} style={celulaCabecalho}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.length === 0 && <tr><td colSpan={12} style={{ ...celula, textAlign: 'center', padding: '28px', color: COR.texto2 }}>Nenhuma linha para este software. {editavel ? 'Use “Colar do Consolidado” ou “+ Nova linha”.' : ''}</td></tr>}
            {linhas.map(l => (
              <tr key={l.registroId || l.id} style={{ opacity: l.ativo ? 1 : 0.55 }}>
                <td style={{ ...celula, whiteSpace: 'nowrap', fontWeight: 700 }}>{codigoSugerido(l)}{!l.ativo && <div><Selo tom="cinza">desativada</Selo></div>}</td>
                <td style={celula}>{nomeSoftware(l.software)}</td>
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>{l.capacidade} câm.{l.opcao ? ` · opção ${l.opcao}` : ''}</td>
                <td style={celula}>{l.qtdServidores}{l.qtdServidores > 1 ? ` (${l.camerasPorServidor}/serv.)` : ''}</td>
                <td style={{ ...celula, fontSize: '13px' }}>{l.processadores.length ? l.processadores.join(' · ') : <Selo tom="indigo">a preencher</Selo>}</td>
                <td style={celula}>{l.ram || '—'}</td>
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>{tb(l.armazTotalTb)}{l.discosQtd ? <div style={{ fontSize: '12px', color: COR.texto2 }}>{l.discosQtd} discos/serv.</div> : null}</td>
                <td style={{ ...celula, fontSize: '13px' }}>{l.gpus.length ? l.gpus.join(' · ') : 'sem GPU'}</td>
                <td style={{ ...celula, fontSize: '13px' }}>{l.sistemasOperacionais.length ? l.sistemasOperacionais.join(' · ') : <Selo tom="indigo">a preencher</Selo>}</td>
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>{l.codigoCigam || <Selo tom="indigo">! sem código</Selo>}</td>
                <td style={{ ...celula, fontSize: '12.5px', color: COR.texto2 }}>{l.versaoMemorial || '—'}{l.observacao && <div style={{ color: COR.indigo }}>{l.observacao}</div>}</td>
                <td style={{ ...celula, textAlign: 'right' }}><button type="button" style={botao('secundario')} onClick={() => setEditando(l)}>{editavel ? 'Alterar' : 'Ver'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul, margin: '0 0 8px' }}>Alertas do seletor</h3>
      <div style={{ ...ajuda, marginBottom: '8px' }}>A condição é fixa no sistema; o texto, o nível e se está ativo vêm daqui. Alertas de uma linha específica usam a regra “linha:CHAVE” (ex.: linha:DGFIPX-050).</div>
      <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px', boxShadow: 'none', borderRadius: 0 }}>
          <thead><tr>{['Regra', 'Nível', 'Texto', ''].map(h => <th key={h} style={celulaCabecalho}>{h}</th>)}</tr></thead>
          <tbody>
            {cat.alertas.map(a => (
              <tr key={a.registroId || a.regra} style={{ opacity: a.ativo ? 1 : 0.55 }}>
                <td style={{ ...celula, fontSize: '13px' }}>
                  <strong>{a.regra}</strong>
                  <div style={{ fontSize: '12px', color: COR.texto2 }}>{(REGRAS_ALERTA.filter(r => r.regra === a.regra)[0] || { descricao: 'Alerta de linha do catálogo' }).descricao}</div>
                </td>
                <td style={celula}><Selo tom={TOM_NIVEL[a.nivel]}>{NOME_NIVEL[a.nivel]}</Selo></td>
                <td style={{ ...celula, fontSize: '13px' }}>{a.texto}</td>
                <td style={{ ...celula, textAlign: 'right' }}>{editavel && <button type="button" style={botao('secundario')} onClick={() => setAlertaEditando({ ...a })}>Alterar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editavel && (
        <button type="button" style={{ ...botao('discreto'), marginTop: '8px' }} onClick={() => setAlertaEditando({ id: '', regra: 'linha:', nivel: 'informacao', texto: '', ativo: true })}>+ Alerta de uma linha</button>
      )}

      {editando && (
        <EditorLinha linha={editando} podeEditar={editavel} aoFechar={() => setEditando(undefined)} aoSalvar={salvarLinha} />
      )}

      {alertaEditando && (
        <Modal
          titulo="Alerta do seletor"
          aoFechar={() => setAlertaEditando(undefined)}
          rodape={(
            <>
              <button type="button" style={botao('secundario')} onClick={() => setAlertaEditando(undefined)}>Cancelar</button>
              <button type="button" style={botao('principal', ocupado)} disabled={ocupado} onClick={() => {
                if (!servico || !log || !alertaEditando.texto.trim() || !alertaEditando.regra.trim() || alertaEditando.regra === 'linha:') {
                  setErro('Informe a regra e o texto do alerta.');
                  return;
                }
                setOcupado(true);
                servico.salvarAlerta(alertaEditando)
                  .then(() => log.registrarAlteracao({ entidade: 'Servidor', chave: alertaEditando.regra, acao: 'Alerta', resumo: `Alerta do seletor: ${alertaEditando.regra}`, motivo: 'Texto/nível do alerta ajustado.', depois: alertaEditando, usuarioNome }))
                  .then(() => carregar())
                  .then(() => { setAlertaEditando(undefined); avisar('Alerta salvo.'); })
                  .catch(e => setErro(String((e as Error)?.message || e)))
                  .then(() => setOcupado(false), () => setOcupado(false));
              }}>Salvar</button>
            </>
          )}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={rotulo}>Regra</label>
              <input style={campo} value={alertaEditando.regra} disabled={!!alertaEditando.registroId || REGRAS_ALERTA.some(r => r.regra === alertaEditando.regra)} onChange={e => setAlertaEditando({ ...alertaEditando, regra: e.target.value.trim() })} />
            </div>
            <div>
              <label style={rotulo}>Nível</label>
              <select style={campo} value={alertaEditando.nivel} onChange={e => setAlertaEditando({ ...alertaEditando, nivel: e.target.value as NivelAlertaServidor })}>
                <option value="bloqueio">Bloqueio (impede concluir)</option>
                <option value="aviso">Aviso</option>
                <option value="informacao">Informação</option>
              </select>
            </div>
          </div>
          <label style={rotulo}>Texto</label>
          <textarea rows={3} style={{ ...campo, resize: 'vertical' }} value={alertaEditando.texto} onChange={e => setAlertaEditando({ ...alertaEditando, texto: e.target.value })} />
          <div style={{ marginTop: '10px' }}>
            <Interruptor marcado={alertaEditando.ativo} texto={alertaEditando.ativo ? 'Ativo' : 'Desligado'} aoMudar={v => setAlertaEditando({ ...alertaEditando, ativo: v })} />
          </div>
        </Modal>
      )}

      {colar && (
        <Modal
          titulo="Colar linhas do memorial"
          subtitulo="Organize as colunas como no modelo, copie as linhas no Excel e cole aqui. Linhas com a mesma chave (software + faixa + opção) são atualizadas."
          largura={900}
          aoFechar={() => setColar(false)}
          rodape={(
            <>
              <button type="button" style={botao('discreto')} onClick={baixarModelo}>Baixar modelo (CSV)</button>
              <button type="button" style={botao('secundario')} onClick={() => setColar(false)}>Cancelar</button>
              <button type="button" style={botao('principal', ocupado || validos.length === 0)} disabled={ocupado || validos.length === 0} onClick={() => { importarColado().catch(() => undefined); }}>{ocupado ? 'Importando…' : `Importar ${validos.length} linha(s)`}</button>
            </>
          )}
        >
          <div style={{ ...ajuda, marginTop: 0, marginBottom: '8px' }}>Colunas, na ordem: {COLUNAS_MODELO.join(' · ')}.</div>
          <textarea aria-label="Linhas coladas" rows={7} style={{ ...campo, fontFamily: 'Consolas, monospace', fontSize: '12.5px' }} value={textoColado} onChange={e => setTextoColado(e.target.value)} />
          {colados.length > 0 && (
            <div style={{ maxHeight: '260px', overflow: 'auto', marginTop: '10px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: 'none', borderRadius: 0 }}>
                <thead><tr>{['Linha', 'Chave', 'Processadores', 'Armaz.', 'Situação'].map(h => <th key={h} style={celulaCabecalho}>{h}</th>)}</tr></thead>
                <tbody>
                  {colados.map(x => (
                    <tr key={x.linha}>
                      <td style={celula}>{x.linha}</td>
                      <td style={celula}>{x.dado ? codigoSugerido(x.dado) : '—'}</td>
                      <td style={{ ...celula, fontSize: '13px' }}>{x.dado ? x.dado.processadores.join(' · ') : ''}</td>
                      <td style={celula}>{x.dado ? tb(x.dado.armazTotalTb) : ''}</td>
                      <td style={{ ...celula, color: x.erro ? COR.indigo : COR.azul, fontWeight: 600 }}>{x.erro || (cat.linhas.some(l => l.registroId && x.dado && l.id === x.dado.id) ? 'Atualiza' : 'Nova')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default ServidoresView;
