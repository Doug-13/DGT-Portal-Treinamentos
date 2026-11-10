import * as React from 'react';

import {
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IConfigScript,
  IResultadoScript,
  MODELO_SCRIPT_CEP,
  TEMPO_LIMITE_PADRAO,
  validarConfigScript
} from '../../services/fluxo/scriptFluxo';

import {
  IFonteDadosComponente
} from '../../services/fluxo/valorComponente';

import {
  executarScriptIsolado
} from '../../components/fluxo/executarScriptIsolado';

// ============================================================
// CONFIGURAÇÃO DO SCRIPT (tarefa de sistema "Executar script")
// ============================================================

export interface IEditorScriptProps {
  config?: IConfigScript;
  editavel: boolean;
  nomeTarefa: string;
  metadados: IFluxoMetadado[];
  dataverseService?: DataverseService;
  onAlterar: (config: IConfigScript) => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO2 = '#64748B';

const entrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '32px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '13px',
  color: COR_AZUL,
  fontFamily: 'inherit'
};

const titulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  margin: '10px 0 4px'
};

const pequeno = (perigo = false): React.CSSProperties => ({
  minHeight: '30px',
  padding: '0 10px',
  borderRadius: '6px',
  border: `1px solid ${perigo ? '#B42318' : COR_BORDA}`,
  background: '#FFFFFF',
  color: perigo ? '#B42318' : COR_AZUL,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: 'pointer'
});

// Campos que um script pode preencher.
const PREENCHIVEIS = ['texto', 'textoLongo', 'numero', 'data', 'simNao', 'lista', 'usuario', 'area', 'documento', 'documentos'];

const EditorScript: React.FC<IEditorScriptProps> = ({ config, editavel, nomeTarefa, metadados, dataverseService, onAlterar }) => {

  const atual: IConfigScript = config || { codigo: '', camposSaida: [] };
  const alterar = (parcial: Partial<IConfigScript>): void => onAlterar({ ...atual, ...parcial });
  const fontes = atual.fontes || [];
  const problemas = validarConfigScript(nomeTarefa || 'script', atual, metadados);

  const [valoresTeste, setValoresTeste] = React.useState('{\n  "cep": "01001000"\n}');
  const [testando, setTestando] = React.useState(false);
  const [resultado, setResultado] = React.useState<IResultadoScript | undefined>(undefined);
  const [erroTeste, setErroTeste] = React.useState('');

  const alterarFonte = (indice: number, parcial: Partial<IFonteDadosComponente>): void =>
    alterar({ fontes: fontes.map((item, posicao) => (posicao === indice ? { ...item, ...parcial } : item)) });

  const testar = async (): Promise<void> => {
    setErroTeste('');
    setResultado(undefined);
    let valores: Record<string, string>;
    try {
      const lido = JSON.parse(valoresTeste || '{}');
      valores = lido && typeof lido === 'object' ? lido : {};
    } catch {
      setErroTeste('Os valores de teste precisam ser um JSON (ex.: { "cep": "01001000" }).');
      return;
    }
    setTestando(true);
    try {
      setResultado(await executarScriptIsolado(atual, { valores, registro: { codigo: 'TESTE-0001', titulo: 'Teste' }, usuario: { id: '', nome: 'Teste' } }, dataverseService));
    } finally {
      setTestando(false);
    }
  };

  return (
    <div style={{ padding: '10px 12px', border: `1px dashed ${COR_BORDA}`, borderRadius: '8px', background: '#FAFBFC', color: COR_AZUL }}>

      <div style={{ ...titulo, marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ flex: 1 }}>Script (JavaScript)</span>
        {editavel && (
          <button
            type="button"
            style={pequeno()}
            onClick={() => {
              if (!atual.codigo || window.confirm('Substituir o script pelo exemplo de consulta de CEP (ViaCEP)?')) {
                alterar({ codigo: MODELO_SCRIPT_CEP, hostsPermitidos: Array.from(new Set((atual.hostsPermitidos || []).concat('viacep.com.br'))) });
              }
            }}
          >
            Usar exemplo (CEP)
          </button>
        )}
      </div>
      <textarea
        aria-label="Código do script"
        value={atual.codigo}
        disabled={!editavel}
        rows={14}
        spellCheck={false}
        onChange={evento => alterar({ codigo: evento.target.value })}
        style={{ ...entrada, fontFamily: 'Consolas, monospace', fontSize: '12px', resize: 'vertical' }}
      />
      <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '4px', lineHeight: '17px' }}>
        Corpo de uma função assíncrona. Use <code>entrada.valores.campo</code>, <code>await DGT.consultar(&apos;fonte&apos;, {'{ coluna: valor }'})</code>,{' '}
        <code>await DGT.http(&apos;https://...&apos;)</code> e <code>DGT.log(...)</code>. Termine com{' '}
        <code>return {'{ valores: { campo: valor }, mensagem }'}</code> ou <code>return {'{ erro: \'motivo\' }'}</code> para não deixar concluir.
        Roda isolado: sem acesso ao login nem ao portal.
      </div>

      <div style={titulo}>Campos que o script pode preencher</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '13px' }}>
        {metadados.filter(item => PREENCHIVEIS.indexOf(item.tipo) >= 0).map(item => (
          <label key={item.chave} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={atual.camposSaida.indexOf(item.chave) >= 0}
              disabled={!editavel}
              onChange={() => alterar({
                camposSaida: atual.camposSaida.indexOf(item.chave) >= 0
                  ? atual.camposSaida.filter(chave => chave !== item.chave)
                  : atual.camposSaida.concat(item.chave)
              })}
            />
            {item.rotulo} <span style={{ color: COR_TEXTO2, fontSize: '11.5px' }}>({item.chave})</span>
          </label>
        ))}
        {metadados.length === 0 && <span style={{ color: COR_TEXTO2 }}>Crie os campos em Metadados.</span>}
      </div>
      <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '2px' }}>Nenhum marcado = script só de verificação (bloqueia com {'{ erro }'} ou deixa seguir).</div>

      <div style={titulo}>Endereços de API liberados</div>
      <input
        aria-label="Endereços liberados"
        value={(atual.hostsPermitidos || []).join(', ')}
        disabled={!editavel}
        placeholder="viacep.com.br, brasilapi.com.br"
        onChange={evento => alterar({ hostsPermitidos: evento.target.value.split(',').map(item => item.trim()).filter(item => !!item) })}
        style={entrada}
      />
      <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '2px' }}>Só HTTPS, sem enviar o login. A API precisa aceitar chamadas do navegador (CORS) — ViaCEP e BrasilAPI aceitam.</div>

      <div style={titulo}>Fontes do Dataverse (somente leitura)</div>
      {fontes.map((fonte, indice) => (
        <div key={`${fonte.nome}-${indice}`} style={{ display: 'grid', gridTemplateColumns: '100px 130px minmax(140px, 1fr) minmax(110px, .8fr) auto', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
          <input aria-label="Nome da fonte" placeholder="nome" value={fonte.nome} disabled={!editavel} onChange={evento => alterarFonte(indice, { nome: evento.target.value })} style={entrada} />
          <input aria-label="Tabela" placeholder="dgt_tabela" value={fonte.tabela} disabled={!editavel} onChange={evento => alterarFonte(indice, { tabela: evento.target.value.trim() })} style={entrada} />
          <input aria-label="Colunas" placeholder="dgt_codigo, dgt_name" value={fonte.colunas.join(', ')} disabled={!editavel} onChange={evento => alterarFonte(indice, { colunas: evento.target.value.split(',').map(item => item.trim()).filter(item => !!item) })} style={entrada} />
          <input aria-label="Filtro fixo" placeholder="filtro fixo (opcional)" value={fonte.filtroFixo || ''} disabled={!editavel} onChange={evento => alterarFonte(indice, { filtroFixo: evento.target.value })} style={entrada} />
          {editavel ? <button type="button" aria-label="Remover fonte" style={pequeno(true)} onClick={() => alterar({ fontes: fontes.filter((_f, posicao) => posicao !== indice) })}>✕</button> : <span />}
        </div>
      ))}
      {editavel && (
        <button type="button" style={{ ...pequeno(), marginTop: '6px' }} onClick={() => alterar({ fontes: fontes.concat({ nome: `fonte${fontes.length + 1}`, tabela: '', colunas: [] }) })}>
          + Fonte de dados
        </button>
      )}

      <div style={titulo}>Tempo limite</div>
      <input
        aria-label="Tempo limite em segundos"
        type="number"
        min={1}
        max={60}
        value={atual.tempoLimiteSegundos || TEMPO_LIMITE_PADRAO}
        disabled={!editavel}
        onChange={evento => alterar({ tempoLimiteSegundos: Number(evento.target.value) || TEMPO_LIMITE_PADRAO })}
        style={{ ...entrada, width: '90px' }}
      /> <span style={{ fontSize: '12px', color: COR_TEXTO2 }}>segundos (se passar, a ação não é concluída)</span>

      {problemas.length > 0 && (
        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', background: '#FDE7E9', color: '#8A1C14', fontSize: '12.5px' }}>
          {problemas.map(item => <div key={item}>• {item}</div>)}
        </div>
      )}

      {/* Teste */}
      <div style={titulo}>Testar</div>
      <textarea
        aria-label="Valores de teste (JSON)"
        value={valoresTeste}
        rows={3}
        spellCheck={false}
        onChange={evento => setValoresTeste(evento.target.value)}
        style={{ ...entrada, fontFamily: 'Consolas, monospace', fontSize: '12px' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
        <button type="button" style={pequeno()} disabled={testando || !atual.codigo.trim()} onClick={() => { testar().catch(() => undefined); }}>
          {testando ? 'Executando...' : 'Testar script'}
        </button>
        <span style={{ fontSize: '11.5px', color: COR_TEXTO2 }}>Roda de verdade (APIs e consultas), mas não grava nada.</span>
      </div>
      {erroTeste && <div style={{ color: '#B42318', fontSize: '12.5px', marginTop: '6px' }}>{erroTeste}</div>}
      {resultado && (
        <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '6px', background: resultado.erros.length > 0 ? '#FDE7E9' : '#E7F6EC', fontSize: '12.5px' }}>
          {resultado.erros.length > 0
            ? <div style={{ color: '#8A1C14' }}><strong>Bloquearia a ação:</strong> {resultado.erros.join(' ')}</div>
            : <div style={{ color: '#0E5A12' }}><strong>OK{resultado.mensagem ? ` — ${resultado.mensagem}` : ''}.</strong> Campos que seriam preenchidos:</div>}
          {resultado.erros.length === 0 && (
            <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: '12px' }}>{JSON.stringify(resultado.valores, undefined, 2)}</pre>
          )}
          {resultado.log.length > 0 && (
            <>
              <div style={{ marginTop: '6px', fontWeight: 700 }}>Log</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11.5px', color: COR_TEXTO2 }}>{resultado.log.join('\n')}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorScript;
