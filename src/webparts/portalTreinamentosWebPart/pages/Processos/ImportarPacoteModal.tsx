import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IAmbiente
} from '../../models/Ambiente';

import {
  FORMATO_PACOTE,
  IReferenciasPacote,
  IResultadoInterpretacao,
  aplicarNoProcesso,
  interpretarPacote
} from '../../services/pacoteProcesso/pacoteProcesso';

import {
  IResultadoImportacao,
  PacoteProcessoService
} from '../../services/pacoteProcesso/PacoteProcessoService';

// ============================================================
// IMPORTAR PACOTE DE PROCESSO (JSON)
//
// 1. Colar o JSON (ou escolher o arquivo) → Validar
// 2. Resumo do que será criado + erros/avisos + opções
// 3. Importar → passo a passo do que foi feito
//
// Formato: docs/pacote-processo.md (gerado por IA a partir da skill).
// ============================================================

export interface IImportarPacoteModalProps {
  dataverseService?: DataverseService;
  ambientes: IAmbiente[];
  onFechar: () => void;
  // Chamado após importar (para recarregar listas / abrir o ambiente).
  onConcluido?: (resultado: IResultadoImportacao) => void;
  // Botão "Abrir o ambiente" no resultado.
  onAbrirAmbiente?: (chave: string) => void;
  // Editor do fluxo: o JSON é aplicado NESTE processo (o "processo" do
  // JSON é ignorado; pode até faltar).
  processoFixo?: { codigo: string; nome: string };
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';
const FONTE = "Barlow, Arial, 'Segoe UI', sans-serif";

const botao = (principal: boolean, desabilitado = false): React.CSSProperties => ({
  minHeight: '36px',
  padding: '0 16px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${COR_BORDA}`,
  background: principal ? '#0877c9' : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.5 : 1,
  fontFamily: FONTE
});

const caixa = (tipo: 'erro' | 'alerta' | 'ok' | 'info'): React.CSSProperties => ({
  borderRadius: '6px',
  padding: '10px 12px',
  fontSize: '12.5px',
  lineHeight: '18px',
  background: tipo === 'erro' ? '#FDE7E9' : tipo === 'alerta' ? '#FFF4E5' : tipo === 'ok' ? '#E7F6EC' : '#EDF0F5',
  color: tipo === 'erro' ? '#8A1C14' : tipo === 'alerta' ? '#7A4100' : tipo === 'ok' ? '#0E5A12' : COR_AZUL
});

const ImportarPacoteModal: React.FC<IImportarPacoteModalProps> = (props) => {

  const [texto, setTexto] = React.useState('');
  const [referencias, setReferencias] = React.useState<IReferenciasPacote | undefined>(undefined);
  const [analise, setAnalise] = React.useState<IResultadoInterpretacao | undefined>(undefined);
  const [publicar, setPublicar] = React.useState(true);
  const [criarAmbiente, setCriarAmbiente] = React.useState(true);
  const [substituirRascunho, setSubstituirRascunho] = React.useState(!!props.processoFixo);
  const [atualizarMetadados, setAtualizarMetadados] = React.useState(!!props.processoFixo);
  const [avisoProcesso, setAvisoProcesso] = React.useState('');
  // Pacote sem fluxo: fluxo escolhido para o ambiente ('' = padrão).
  const [fluxoAmbienteId, setFluxoAmbienteId] = React.useState('');
  const [processando, setProcessando] = React.useState(false);
  const [resultado, setResultado] = React.useState<IResultadoImportacao | undefined>(undefined);
  const [erroGeral, setErroGeral] = React.useState('');

  const servico = React.useMemo(
    () => (props.dataverseService ? new PacoteProcessoService(props.dataverseService) : undefined),
    [props.dataverseService]
  );

  const validar = async (): Promise<void> => {
    if (!servico) {
      setErroGeral('Sem conexão com o Dataverse.');
      return;
    }
    setProcessando(true);
    setErroGeral('');
    setResultado(undefined);
    try {
      const refs = referencias || await servico.referencias();
      setReferencias(refs);
      // Modo editor: aplica o JSON no processo aberto.
      let entrada: unknown = texto;
      setAvisoProcesso('');
      if (props.processoFixo) {
        const aplicado = aplicarNoProcesso(texto, props.processoFixo);
        entrada = aplicado.entrada;
        setAvisoProcesso(aplicado.aviso);
      }
      const lido = interpretarPacote(entrada, refs);
      setAnalise(lido);
      setPublicar(lido.errosPublicacao.length === 0);
      setFluxoAmbienteId(lido.pacote && lido.pacote.ambiente && lido.pacote.ambiente.processoExistenteId ? lido.pacote.ambiente.processoExistenteId : '');
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setProcessando(false);
    }
  };

  const importar = async (): Promise<void> => {
    if (!servico || !analise || !analise.pacote) {
      return;
    }
    setProcessando(true);
    try {
      const feito = await servico.importar(
        analise.pacote,
        { publicar: publicar && analise.errosPublicacao.length === 0, criarAmbiente, substituirRascunho, atualizarMetadados, fluxoAmbienteId: fluxoAmbienteId || undefined },
        props.ambientes
      );
      setResultado(feito);
      if (props.onConcluido) {
        props.onConcluido(feito);
      }
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setProcessando(false);
    }
  };

  const carregarArquivo = (arquivo?: File): void => {
    if (!arquivo) {
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      setTexto(String(leitor.result || ''));
      setAnalise(undefined);
      setResultado(undefined);
    };
    leitor.readAsText(arquivo, 'utf-8');
  };

  const pacote = analise ? analise.pacote : undefined;
  const processoDoPacote = pacote ? pacote.processo : undefined;
  const definicaoDoPacote = pacote ? pacote.definicao : undefined;
  const processoExistente =
    processoDoPacote && referencias
      ? referencias.processos.find(item => item.codigo.toUpperCase() === processoDoPacote.codigo)
      : undefined;
  // Pacote sem fluxo e com ambiente: escolher o fluxo do ambiente.
  const escolherFluxo = !!pacote && !!pacote.ambiente && !definicaoDoPacote && criarAmbiente;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="importar-pacote-titulo"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, .45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px', fontFamily: FONTE }}
    >
      <div style={{ width: '100%', maxWidth: '860px', background: '#FFFFFF', borderRadius: '10px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', overflow: 'hidden', color: COR_AZUL }}>
        <div style={{ background: COR_AZUL, color: '#FFFFFF', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 id="importar-pacote-titulo" style={{ margin: 0, fontSize: '16px', fontWeight: 700, flex: 1 }}>
            {props.processoFixo ? `Atualizar ${props.processoFixo.codigo} a partir de um JSON` : 'Importar processo de um JSON'}
          </h2>
          <button type="button" aria-label="Fechar" disabled={processando} onClick={props.onFechar} style={{ border: 0, background: 'transparent', color: '#FFFFFF', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {!resultado && (
            <>
              {props.processoFixo && (
                <div style={caixa('info')}>
                  O JSON será aplicado <strong>neste processo ({props.processoFixo.codigo})</strong>: campos novos são acrescentados,
                  os existentes podem ser atualizados e o fluxo do JSON vira um novo <strong>rascunho</strong> (que você pode publicar).
                  Campos que não estão no JSON não são apagados. Dica: use <strong>Exportar JSON</strong>, ajuste o arquivo (ou peça à IA) e importe de volta.
                </div>
              )}

              <div style={caixa('info')}>
                Cole o <strong>pacote de processo</strong> (formato <code>{FORMATO_PACOTE}</code>) — por exemplo, gerado por IA com a
                skill de criação de processos — ou escolha o arquivo .json. O portal cria o processo, os campos, o fluxo
                (como rascunho, ou já publicado) e, se o pacote tiver, o ambiente com as telas. Referência: <code>docs/pacote-processo.md</code>.
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <label style={{ ...botao(false), display: 'inline-flex', alignItems: 'center' }}>
                  Escolher arquivo .json
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={evento => carregarArquivo(evento.target.files ? evento.target.files[0] : undefined)} />
                </label>
                <span style={{ fontSize: '12px', color: '#64748B' }}>ou cole abaixo</span>
              </div>

              <textarea
                aria-label="JSON do pacote"
                value={texto}
                onChange={evento => { setTexto(evento.target.value); setAnalise(undefined); }}
                rows={12}
                spellCheck={false}
                placeholder={`{\n  "formato": "${FORMATO_PACOTE}",\n  "processo": { "codigo": "...", "nome": "..." },\n  "metadados": [...],\n  "fluxo": { "elementos": [...], "transicoes": [...] }\n}`}
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Consolas, monospace', fontSize: '12.5px', border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '8px', resize: 'vertical' }}
              />

              <div>
                <button type="button" disabled={processando || !texto.trim()} onClick={() => { validar().catch(() => undefined); }} style={botao(true, processando || !texto.trim())}>
                  {processando && !analise ? 'Validando...' : 'Validar'}
                </button>
              </div>
            </>
          )}

          {erroGeral && <div style={caixa('erro')}>{erroGeral}</div>}

          {avisoProcesso && !resultado && <div style={caixa('alerta')}>{avisoProcesso}</div>}

          {analise && !resultado && analise.erros.length > 0 && (
            <div style={caixa('erro')}>
              <strong>Corrija {analise.erros.length} ponto(s) no JSON:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>{analise.erros.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
          )}

          {pacote && !resultado && (
            <>
              <div style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '8px', padding: '12px 14px', fontSize: '13px', lineHeight: '20px' }}>
                <strong style={{ display: 'block', marginBottom: '6px' }}>O que será feito</strong>
                {processoDoPacote && (
                  <div>Processo <strong>{processoDoPacote.codigo} — {processoDoPacote.nome}</strong>: {processoExistente ? 'já existe (será usado)' : 'será criado'}{processoDoPacote.areaNome ? ` · área ${processoDoPacote.areaNome}` : ''}.</div>
                )}
                {processoDoPacote && (
                  <div>
                    Campos: {pacote.metadados.length} no pacote — novos são criados; os que já existem {atualizarMetadados ? 'são atualizados' : 'ficam como estão'}.
                    Nenhum campo é apagado.
                  </div>
                )}
                {definicaoDoPacote
                  ? (
                    <div>
                      Fluxo: {definicaoDoPacote.elementos.filter(el => el.tipo === 'tarefaHumana').length} etapa(s),{' '}
                      {definicaoDoPacote.elementos.filter(el => el.tipo === 'gateway').length} decisão(ões),{' '}
                      {definicaoDoPacote.elementos.filter(el => el.tipo === 'subprocesso').length} subprocesso(s),{' '}
                      {definicaoDoPacote.transicoes.length} caminho(s) — criado como rascunho.
                    </div>
                  )
                  : <div>Fluxo: <strong>não informado</strong> no pacote{pacote.ambiente ? ' — escolha abaixo qual fluxo o ambiente vai usar.' : ' — desenhe depois em Processos → Fluxos.'}</div>}
                {pacote.ambiente && <div>Ambiente <strong>{pacote.ambiente.nome}</strong> (registros “{pacote.ambiente.rotuloRegistro}”, código {pacote.ambiente.prefixoCodigo || 'automático'}-ANO-0001){pacote.ambiente.layout ? ', com telas configuradas' : ''} — aparece no menu lateral.</div>}
              </div>

              {analise && analise.avisos.length > 0 && (
                <div style={caixa('alerta')}>
                  <strong>Atenção:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>{analise.avisos.map(item => <li key={item}>{item}</li>)}</ul>
                </div>
              )}

              {analise && analise.errosPublicacao.length > 0 && (
                <div style={caixa('alerta')}>
                  <strong>O fluxo pode ser importado como rascunho, mas não publicado ainda:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>{analise.errosPublicacao.map(item => <li key={item}>{item}</li>)}</ul>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {definicaoDoPacote && (
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="checkbox" checked={publicar} disabled={!!analise && analise.errosPublicacao.length > 0} onChange={() => setPublicar(!publicar)} />
                    Publicar o fluxo agora (senão fica como rascunho para revisar no editor)
                  </label>
                )}
                {pacote.ambiente && (
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="checkbox" checked={criarAmbiente} onChange={() => setCriarAmbiente(!criarAmbiente)} />
                    Criar o ambiente “{pacote.ambiente.nome}” no menu
                  </label>
                )}
                {definicaoDoPacote && (
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="checkbox" checked={substituirRascunho} onChange={() => setSubstituirRascunho(!substituirRascunho)} />
                    Se o processo já tiver um rascunho de fluxo, substituí-lo pelo fluxo do JSON
                  </label>
                )}
                {processoExistente && pacote.metadados.length > 0 && (
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="checkbox" checked={atualizarMetadados} onChange={() => setAtualizarMetadados(!atualizarMetadados)} />
                    Atualizar os campos que já existem (rótulo, opções, colunas, avaliação, ajuda) com os do JSON
                  </label>
                )}
              </div>

              {escolherFluxo && pacote && pacote.ambiente && referencias && (
                <div style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '8px', padding: '12px 14px' }}>
                  <label htmlFor="fluxo-ambiente" style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                    Fluxo que o ambiente “{pacote.ambiente.nome}” vai usar
                  </label>
                  <select
                    id="fluxo-ambiente"
                    value={fluxoAmbienteId}
                    onChange={evento => setFluxoAmbienteId(evento.target.value)}
                    style={{ width: '100%', minHeight: '36px', border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '6px 8px', fontFamily: FONTE, fontSize: '13.5px', color: COR_AZUL }}
                  >
                    <option value="">
                      {processoDoPacote
                        ? `O processo deste pacote (${processoDoPacote.codigo}) — desenhar o fluxo depois`
                        : 'Criar um fluxo novo, vazio — desenhar depois'}
                    </option>
                    {referencias.processos
                      .slice()
                      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
                      .map(item => <option key={item.id} value={item.id}>Usar o fluxo existente: {item.codigo} — {item.nome}</option>)}
                  </select>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    O fluxo precisa estar publicado para o ambiente aceitar registros. Dá para trocar depois em Configuração → Trocar fluxo.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" disabled={processando} onClick={props.onFechar} style={botao(false, processando)}>Cancelar</button>
                <button type="button" disabled={processando} onClick={() => { importar().catch(() => undefined); }} style={botao(true, processando)}>
                  {processando ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </>
          )}

          {resultado && (
            <>
              <div style={caixa(resultado.ok ? 'ok' : 'alerta')}>
                <strong>{resultado.ok ? 'Importação concluída.' : 'Importação concluída com pendências.'}</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '0', listStyle: 'none' }}>
                  {resultado.passos.map((passo, indice) => (
                    <li key={indice} style={{ color: passo.ok ? undefined : '#8A1C14' }}>{passo.ok ? '✓' : '✕'} {passo.texto}</li>
                  ))}
                </ul>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                Revise o desenho em Processos → Fluxos (o layout foi montado automaticamente; ajuste posições se quiser).
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {resultado.ambiente && props.onAbrirAmbiente && (
                  <button type="button" onClick={() => { if (props.onAbrirAmbiente && resultado.ambiente) { props.onAbrirAmbiente(resultado.ambiente.chave); } }} style={botao(true)}>
                    Abrir o ambiente “{resultado.ambiente.nome}”
                  </button>
                )}
                <button type="button" onClick={props.onFechar} style={botao(!resultado.ambiente)}>Fechar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportarPacoteModal;
