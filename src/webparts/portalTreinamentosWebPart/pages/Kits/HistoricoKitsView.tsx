import * as React from 'react';

import {
  CONDICOES,
  ITENS,
  REGRAS_QUANTIDADE
} from '../../services/bom/catalogoKits';

import {
  IAlteracaoKit
} from '../../services/bom/KitsService';

import {
  COR,
  Selo,
  TomSelo,
  campo,
  formatarDataHora,
  painel
} from './kitsComum';

// ============================================================
// KITS — HISTÓRICO DE ALTERAÇÕES
//
// Lê dgt_kitalteracao (só inclusão: nada é editado nem apagado).
// Cada registro guarda quem, quando, o motivo e o antes/depois.
// ============================================================

const TOM_ACAO: Record<string, TomSelo> = {
  'Inclusão': 'ciano',
  'Alteração': 'azul',
  'Composição': 'azul',
  'Parâmetros': 'azul',
  'Desativação': 'indigo',
  'Reativação': 'ciano',
  'Importação': 'cinza'
};

interface ILinhaComp { chaveItem: string; quantidade: number; regra: string; condicao: string }

const lerDetalhes = (json: string): { antes?: unknown; depois?: unknown } | undefined => {
  try {
    const dados = JSON.parse(json || '{}') as { antes?: unknown; depois?: unknown };
    return dados.antes === undefined && dados.depois === undefined ? undefined : dados;
  } catch {
    return undefined;
  }
};

const nomeItem = (chave: string): string => (ITENS[chave] ? ITENS[chave].descricao : chave);
const regraTexto = (regra: string): string => (REGRAS_QUANTIDADE.find(r => r.regra === regra) || { nome: regra }).nome.toLowerCase();
const condTexto = (cond: string): string => (cond === 'sempre' ? '' : ` (${(CONDICOES.find(c => c.condicao === cond) || { nome: cond }).nome.toLowerCase()})`);

// Diferenças legíveis: "Retirado: ...", "Quantidade: 1 → 2"...
const diferencas = (antes: unknown, depois: unknown): string[] => {
  const linhas: string[] = [];

  if (Array.isArray(antes) || Array.isArray(depois)) {
    const a = (antes || []) as ILinhaComp[];
    const d = (depois || []) as ILinhaComp[];
    const id = (l: ILinhaComp): string => `${l.chaveItem}|${l.condicao}`;
    d.filter(l => !a.some(x => id(x) === id(l))).forEach(l =>
      linhas.push(`Incluído: ${l.quantidade} × ${nomeItem(l.chaveItem)}, ${regraTexto(l.regra)}${condTexto(l.condicao)}`));
    a.filter(l => !d.some(x => id(x) === id(l))).forEach(l =>
      linhas.push(`Retirado: ${l.quantidade} × ${nomeItem(l.chaveItem)}${condTexto(l.condicao)}`));
    d.forEach(l => {
      const x = a.filter(y => id(y) === id(l))[0];
      if (x && (Number(x.quantidade) !== Number(l.quantidade) || x.regra !== l.regra)) {
        linhas.push(`${nomeItem(l.chaveItem)}${condTexto(l.condicao)}: ${x.quantidade} ${regraTexto(x.regra)} → ${l.quantidade} ${regraTexto(l.regra)}`);
      }
    });
    if (linhas.length === 0) {
      linhas.push('Ordem dos itens alterada.');
    }
    return linhas;
  }

  const a = (antes || {}) as Record<string, unknown>;
  const d = (depois || {}) as Record<string, unknown>;
  const ROTULOS: Record<string, string> = {
    codigo: 'Código CIGAM', descricao: 'Descrição', categoria: 'Categoria', situacao: 'Situação',
    observacao: 'Observação', ativo: 'Ativo', nome: 'Nome', codigoCigam: 'Código do kit',
    maxCameras: 'Máximo de câmeras', aceitaOcr: 'Aceita OCR/LPR', sinalizacao: 'Sinalização'
  };
  const valor = (v: unknown): string =>
    v === true ? 'sim' : v === false ? 'não' : v === undefined || v === null || v === '' ? '(vazio)' : String(v);

  Object.keys(ROTULOS).forEach(campo => {
    if (campo in d && JSON.stringify(a[campo]) !== JSON.stringify(d[campo])) {
      linhas.push(antes === undefined ? `${ROTULOS[campo]}: ${valor(d[campo])}` : `${ROTULOS[campo]}: ${valor(a[campo])} → ${valor(d[campo])}`);
    }
  });
  const atrA = (a.atributos || {}) as Record<string, unknown>;
  const atrD = (d.atributos || {}) as Record<string, unknown>;
  Object.keys({ ...atrA, ...atrD }).forEach(campo => {
    if (JSON.stringify(atrA[campo]) !== JSON.stringify(atrD[campo])) {
      linhas.push(`${campo}: ${valor(atrA[campo])} → ${valor(atrD[campo])}`);
    }
  });
  return linhas.length ? linhas : ['Sem diferença nos campos principais.'];
};

const Detalhes: React.FC<{ json: string }> = ({ json }) => {
  const dados = lerDetalhes(json);
  if (!dados) {
    return null;
  }
  return (
    <ul style={{ margin: '6px 0 0', padding: '10px 12px 10px 28px', background: '#F7F8FA', borderRadius: '6px', fontSize: '13px', color: COR.azul, lineHeight: 1.6 }}>
      {diferencas(dados.antes, dados.depois).map(l => <li key={l}>{l}</li>)}
    </ul>
  );
};

const HistoricoKitsView: React.FC<{ alteracoes: IAlteracaoKit[]; origemDataverse: boolean }> = ({ alteracoes, origemDataverse }) => {

  const [busca, setBusca] = React.useState('');
  const [aberto, setAberto] = React.useState('');
  const termo = busca.trim().toLowerCase();

  const visiveis = alteracoes.filter(a =>
    !termo || `${a.resumo} ${a.motivo} ${a.usuarioNome} ${a.chave}`.toLowerCase().indexOf(termo) >= 0);

  if (!origemDataverse) {
    return <div style={{ ...painel, color: COR.texto2, fontSize: '14px' }}>O histórico começa quando o catálogo passar a ser gravado no Dataverse.</div>;
  }

  return (
    <div>
      <input aria-label="Buscar no histórico" style={{ ...campo, maxWidth: '420px', marginBottom: '14px' }} placeholder="Buscar por item, kit, motivo ou pessoa" value={busca} onChange={e => setBusca(e.target.value)} />
      <div style={{ ...painel, padding: 0 }}>
        {visiveis.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: COR.texto2 }}>Nenhuma alteração registrada{termo ? ' com essa busca' : ''}.</div>}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visiveis.map((a, i) => (
            <li key={a.id} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${COR.cinzaClaro}` : 0 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12.5px', color: COR.texto2, minWidth: '128px' }}>{formatarDataHora(a.data)}</span>
                <Selo tom={TOM_ACAO[a.acao] || 'cinza'}>{a.acao || a.entidade}</Selo>
                <span style={{ flex: 1, fontWeight: 600, color: COR.azul, fontSize: '14px', minWidth: '200px' }}>{a.resumo}</span>
                <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{a.usuarioNome}</span>
              </div>
              {a.motivo && <div style={{ fontSize: '13px', color: COR.azul, marginTop: '4px', paddingLeft: '138px' }}>Motivo: {a.motivo}</div>}
              {lerDetalhes(a.detalhes) && (
                <div style={{ paddingLeft: '138px' }}>
                  <button type="button" onClick={() => setAberto(aberto === a.id ? '' : a.id)} style={{ border: 0, background: 'none', padding: '4px 0', color: '#036E7D', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {aberto === a.id ? 'Ocultar o que mudou' : 'Ver o que mudou'}
                  </button>
                  {aberto === a.id && <Detalhes json={a.detalhes} />}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default HistoricoKitsView;
