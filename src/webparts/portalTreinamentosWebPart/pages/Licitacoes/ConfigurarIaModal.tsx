import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  ILicitacaoResultado,
  IParecerLicitacao
} from '../../models/Licitacao';

import {
  IPromptIa,
  TipoProvedorIa
} from '../../models/LicitacaoIa';

import {
  PROMPT_PADRAO_LICITACOES,
  PromptIaService
} from '../../services/ia/PromptIaService';

import {
  LicitacaoAnaliseIaService
} from '../../services/ia/LicitacaoAnaliseIaService';

import {
  COR,
  FONTE
} from './licitacoesEstilos';

import {
  IA_MODELO_PADRAO
} from '../../constants/ia';

// ============================================================
// LICITAÇÕES — CONFIGURAR IA (somente Administrador)
//
//   Aba "Prompt":      instruções, contexto da DGT, modelo do prompt
//                      com {{variaveis}}, provedor e parâmetros.
//   Aba "Pré-visualizar": o texto EXATO que seria enviado à IA para
//                      um edital da busca atual (com o histórico).
//   Aba "Versões":     todas as versões salvas; "Restaurar" carrega
//                      uma versão antiga no formulário.
//
// Salvar sempre cria uma NOVA versão (nada é sobrescrito).
// ============================================================

export interface IConfigurarIaModalProps {
  aberto: boolean;
  promptAtual: IPromptIa;
  promptService?: PromptIaService;
  servicoAnalise: LicitacaoAnaliseIaService;
  tabelasExistem: boolean;
  resultados: ILicitacaoResultado[];
  pareceresAtuais: IParecerLicitacao[];
  responsavel: string;
  apiDisponivel: boolean;
  onSalvo: (prompt: IPromptIa) => void;
  onFechar: () => void;
}

type Aba = 'prompt' | 'previa' | 'versoes';

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: COR.azul,
  margin: '12px 0 4px'
};

const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: `1px solid ${COR.cinzaClaro}`,
  borderRadius: 6,
  fontSize: 13,
  fontFamily: FONTE,
  color: COR.azul,
  background: '#ffffff'
};

const areaTexto = (linhas: number): React.CSSProperties => ({
  ...campo,
  minHeight: linhas * 20,
  resize: 'vertical',
  fontFamily: "Consolas, 'Courier New', monospace",
  fontSize: 12.5,
  lineHeight: 1.5
});

const botao = (principal: boolean, desabilitado = false): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: 7,
  border: principal ? 0 : `1px solid ${COR.cinzaClaro}`,
  background: principal ? COR.botao : '#ffffff',
  color: principal ? '#ffffff' : COR.azul,
  fontWeight: 700,
  fontSize: 13,
  fontFamily: FONTE,
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.5 : 1
});

const ConfigurarIaModal: React.FC<IConfigurarIaModalProps> = ({
  aberto,
  promptAtual,
  promptService,
  servicoAnalise,
  tabelasExistem,
  resultados,
  pareceresAtuais,
  responsavel,
  apiDisponivel,
  onSalvo,
  onFechar
}) => {

  const [aba, setAba] = React.useState<Aba>('prompt');
  const [form, setForm] = React.useState<IPromptIa>(promptAtual);
  const [versoes, setVersoes] = React.useState<IPromptIa[]>([]);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [mensagem, setMensagem] = React.useState<string>('');
  const [erro, setErro] = React.useState<string>('');
  const [editalPrevia, setEditalPrevia] = React.useState<string>('');

  React.useEffect(() => {
    if (!aberto) {
      return;
    }
    setForm(promptAtual);
    setAba('prompt');
    setMensagem('');
    setErro('');
    setEditalPrevia(resultados.length > 0 ? resultados[0].chave : '');
    if (promptService && tabelasExistem) {
      promptService.listarVersoes(promptAtual.chave)
        .then(setVersoes)
        .catch(() => setVersoes([]));
    }
  // Reabre o formulário a cada abertura.
  }, [aberto]);

  React.useEffect(() => {
    if (!aberto) {
      return undefined;
    }
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !salvando) {
        onFechar();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, salvando, onFechar]);

  if (!aberto) {
    return null;
  }

  const alterar = (parcial: Partial<IPromptIa>): void => {
    setForm(atual => ({ ...atual, ...parcial }));
    setMensagem('');
  };

  const salvar = (): void => {
    if (!promptService) {
      return;
    }
    setSalvando(true);
    setErro('');
    promptService.salvarNovaVersao(form, responsavel)
      .then(salvo => {
        setMensagem(`✓ Versão ${salvo.versao} salva e ativada.`);
        setVersoes(atual => [salvo].concat(atual.map(v => ({ ...v, ativo: false }))));
        setForm(salvo);
        onSalvo(salvo);
      })
      .catch(falha => setErro(falha instanceof Error ? falha.message : String(falha)))
      .then(() => setSalvando(false))
      .catch(() => undefined);
  };

  const itemPrevia = resultados.find(r => r.chave === editalPrevia);
  const previa = itemPrevia
    ? servicoAnalise.montarEntrada(itemPrevia, form, pareceresAtuais)
    : undefined;

  const abaBotao = (id: Aba, texto: string): React.ReactNode => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={aba === id}
      onClick={() => setAba(id)}
      style={{
        padding: '9px 14px',
        border: 0,
        borderBottom: `3px solid ${aba === id ? COR.ciano : 'transparent'}`,
        background: 'transparent',
        color: aba === id ? COR.azul : COR.textoSecundario,
        fontWeight: 700,
        fontSize: 13,
        fontFamily: FONTE,
        cursor: 'pointer'
      }}
    >
      {texto}
    </button>
  );

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurar análise por IA"
      onClick={() => { if (!salvando) { onFechar(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: FONTE }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(920px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 12, borderTop: `4px solid ${COR.indigo}`, boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}
      >
        <div style={{ padding: '16px 20px 0', borderBottom: `1px solid ${COR.cinzaClaro}` }}>
          <h2 style={{ margin: 0, fontSize: 18, color: COR.azul }}>🤖 Configurar análise por IA — Licitações</h2>
          <p style={{ margin: '4px 0 8px', fontSize: 12.5, color: COR.textoSecundario }}>
            Prompt em uso: {promptAtual.versao > 0 ? `versão ${promptAtual.versao}` : 'padrão do portal (não salvo)'} ·
            {' '}provedor: <strong>{promptAtual.provedor === 'api' ? 'API de IA' : 'simulado (histórico)'}</strong>
          </p>
          <div role="tablist" style={{ display: 'flex', gap: 4 }}>
            {abaBotao('prompt', 'Prompt')}
            {abaBotao('previa', 'Pré-visualizar')}
            {abaBotao('versoes', `Versões (${versoes.length})`)}
          </div>
        </div>

        <div style={{ padding: '4px 20px 16px', overflowY: 'auto', flex: 1 }}>

          {!tabelasExistem && (
            <p style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 8, background: '#FFF4E5', fontSize: 12.5, color: COR.azul }}>
              As tabelas de IA ainda não existem. Rode
              {' '}<code>scripts\dataverse\criar-tabelas-ia-licitacoes.ps1</code> para salvar prompts e guardar as análises.
              Até lá, o portal usa o prompt padrão.
            </p>
          )}

          {aba === 'prompt' && (
            <>
              <span style={rotulo}>Instruções do sistema (papel da IA)</span>
              <textarea value={form.instrucoesSistema} onChange={e => alterar({ instrucoesSistema: e.target.value })} style={areaTexto(5)} />

              <span style={rotulo}>Contexto da DGT (portfólio, regiões, valores, restrições) → {'{{contexto_empresa}}'}</span>
              <textarea value={form.contextoEmpresa} onChange={e => alterar({ contextoEmpresa: e.target.value })} style={areaTexto(5)} />

              <span style={rotulo}>Modelo do prompt</span>
              <textarea value={form.modeloPrompt} onChange={e => alterar({ modeloPrompt: e.target.value })} style={areaTexto(10)} />
              <span style={{ fontSize: 11.5, color: COR.textoSecundario }}>
                Variáveis: {'{{contexto_empresa}}'} · {'{{edital}}'} (obrigatória) · {'{{historico}}'} · {'{{estatisticas}}'} · {'{{formato_resposta}}'}.
                Os dados do edital vão sem CNPJ e sem o link do PNCP.
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                <label>
                  <span style={rotulo}>Provedor</span>
                  <select value={form.provedor} onChange={e => alterar({ provedor: e.target.value as TipoProvedorIa })} style={campo}>
                    <option value="simulado">Simulado (histórico, sem API)</option>
                    <option value="api">API de IA</option>
                  </select>
                </label>
                <label>
                  <span style={rotulo}>Modelo de IA</span>
                  <input value={form.modeloIa} onChange={e => alterar({ modeloIa: e.target.value })} style={campo} placeholder={IA_MODELO_PADRAO} />
                </label>
                <label>
                  <span style={rotulo}>Temperatura</span>
                  <input type="number" min={0} max={1} step={0.1} value={form.temperatura} onChange={e => alterar({ temperatura: Number(e.target.value) })} style={campo} />
                </label>
                <label>
                  <span style={rotulo}>Máx. tokens</span>
                  <input type="number" min={200} max={8000} step={100} value={form.maxTokens} onChange={e => alterar({ maxTokens: Number(e.target.value) })} style={campo} />
                </label>
                <label>
                  <span style={rotulo}>Pareceres no contexto</span>
                  <input type="number" min={1} max={50} value={form.qtdHistorico} onChange={e => alterar({ qtdHistorico: Number(e.target.value) })} style={campo} />
                </label>
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 12 }}>
                <input type="checkbox" checked={form.analiseAutomatica} onChange={() => alterar({ analiseAutomatica: !form.analiseAutomatica })} />
                Analisar automaticamente os editais sem parecer ao buscar
              </label>

              {form.provedor === 'api' && !apiDisponivel && (
                <p style={{ margin: '10px 0 0', padding: '10px 12px', borderRadius: 8, background: COR.indigoClaro, fontSize: 12.5, color: COR.azul, lineHeight: 1.5 }}>
                  Sem conexão com o Dataverse nesta tela: o portal continua usando o modo simulado,
                  mesmo com “API de IA” selecionado.
                </p>
              )}

              <span style={rotulo}>Observações (o que mudou nesta versão)</span>
              <input value={form.observacoes} onChange={e => alterar({ observacoes: e.target.value })} style={campo} maxLength={500} />
            </>
          )}

          {aba === 'previa' && (
            resultados.length === 0
              ? <p style={{ fontSize: 13, color: COR.textoSecundario, marginTop: 14 }}>Faça uma busca para pré-visualizar o prompt de um edital.</p>
              : (
                <>
                  <span style={rotulo}>Edital da busca atual</span>
                  <select value={editalPrevia} onChange={e => setEditalPrevia(e.target.value)} style={campo}>
                    {resultados.slice(0, 100).map(r => (
                      <option key={r.chave} value={r.chave}>{r.orgao} — {r.objeto.substring(0, 90)}</option>
                    ))}
                  </select>
                  {previa && (
                    <>
                      <span style={rotulo}>
                        Histórico usado: {previa.historico.length} parecer(es) parecido(s) de {previa.estatisticas.totalPareceres}
                      </span>
                      <span style={rotulo}>Sistema</span>
                      <pre style={{ ...areaTexto(4), whiteSpace: 'pre-wrap', margin: 0, background: COR.neutro }}>{previa.sistema}</pre>
                      <span style={rotulo}>Mensagem enviada</span>
                      <pre style={{ ...areaTexto(14), whiteSpace: 'pre-wrap', margin: 0, background: COR.neutro, maxHeight: 380, overflowY: 'auto' }}>{previa.mensagem}</pre>
                    </>
                  )}
                </>
              )
          )}

          {aba === 'versoes' && (
            versoes.length === 0
              ? <p style={{ fontSize: 13, color: COR.textoSecundario, marginTop: 14 }}>Nenhuma versão salva ainda. Salve a primeira na aba Prompt.</p>
              : (
                <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
                  {versoes.map(v => (
                    <li key={v.id || v.versao} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: `1px solid ${COR.cinzaClaro}`, borderLeft: `3px solid ${v.ativo ? COR.ciano : COR.cinzaClaro}`, borderRadius: 8, marginBottom: 8 }}>
                      <strong style={{ color: COR.azul }}>v{v.versao}</strong>
                      {v.ativo && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#047C8C', textTransform: 'uppercase' }}>em uso</span>}
                      <span style={{ fontSize: 12, color: COR.textoSecundario }}>
                        {v.responsavel || '-'} · {v.registradoEm ? new Date(v.registradoEm).toLocaleString('pt-BR') : '-'} · {v.provedor === 'api' ? 'API' : 'simulado'}
                      </span>
                      {v.observacoes && <span style={{ fontSize: 12, color: COR.azul, flexBasis: '100%' }}>{v.observacoes}</span>}
                      <button type="button" style={{ ...botao(false), padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={() => { setForm({ ...v, observacoes: `Restaurada da v${v.versao}` }); setAba('prompt'); }}>
                        Restaurar no formulário
                      </button>
                    </li>
                  ))}
                </ul>
              )
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: `1px solid ${COR.cinzaClaro}`, background: '#FAFBFC', borderRadius: '0 0 12px 12px' }}>
          <span style={{ marginRight: 'auto', fontSize: 12.5, color: erro ? '#9B2C1F' : COR.textoSecundario }}>{erro || mensagem}</span>
          <button type="button" style={botao(false, salvando)} onClick={() => alterar({ ...PROMPT_PADRAO_LICITACOES, observacoes: 'Volta ao prompt padrão do portal' })} disabled={salvando}>
            Carregar padrão
          </button>
          <button type="button" style={botao(false, salvando)} onClick={onFechar} disabled={salvando}>Fechar</button>
          <button
            type="button"
            style={botao(true, salvando || !promptService || !tabelasExistem)}
            disabled={salvando || !promptService || !tabelasExistem}
            onClick={salvar}
          >
            {salvando ? 'Salvando…' : 'Salvar nova versão'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfigurarIaModal;
