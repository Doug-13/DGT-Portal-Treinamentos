import * as React from 'react';

import {
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IConfigComponente,
  IFonteDadosComponente,
  validarConfigComponente
} from '../../services/fluxo/valorComponente';

import {
  CHAVES_NATIVOS,
  COMPONENTES_NATIVOS,
  validarParametrosNativo
} from '../../services/fluxo/componentesNativos';

import CampoComponenteFluxo from '../../components/fluxo/CampoComponenteFluxo';

// ============================================================
// CONFIGURAÇÃO DO CAMPO "COMPONENTE" (Processos → Metadados)
//
//   Nativo → escolher a tela do portal (ex.: Montador de B.O.M.) e os
//            parâmetros dela
//   HTML   → colar o documento HTML (ex.: gerado por IA) e liberar as
//            FONTES de dados (tabela + colunas) que ele pode ler
//   Pré-visualizar → roda o componente com dados reais, sem gravar
// ============================================================

export interface IEditorComponenteProps {
  config?: IConfigComponente;
  editavel: boolean;
  rotuloCampo: string;
  metadados: IFluxoMetadado[];
  dataverseService?: DataverseService;
  onAlterar: (config: IConfigComponente) => void;
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

const titulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  margin: '12px 0 6px'
};

// Modelo: lista os itens da aba Kits (consome a tabela pela ponte) e
// deixa escolher quantidades — ponto de partida para telas próprias.
export const HTML_EXEMPLO_KITS = `<style>
  .barra { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
  .barra input { flex:1; padding:6px 8px; border:1px solid var(--dgt-borda); border-radius:6px; font-family:inherit; }
  table { width:100%; border-collapse:collapse; font-size:13px; background:#fff; border:1px solid var(--dgt-borda); }
  th { text-align:left; background:var(--dgt-fundo); color:var(--dgt-texto2); font-size:11.5px; padding:6px 8px; }
  td { border-top:1px solid var(--dgt-borda); padding:6px 8px; }
  td input { width:70px; padding:4px; border:1px solid var(--dgt-borda); border-radius:6px; }
  .cod { font-family:Consolas, monospace; color:var(--dgt-texto2); }
  .resumo { margin-top:8px; font-weight:700; }
</style>
<div class="barra"><strong>Itens do catálogo</strong><input id="busca" placeholder="Buscar por código ou descrição"></div>
<table><thead><tr><th>Código</th><th>Item</th><th>Categoria</th><th>Qtd.</th></tr></thead><tbody id="linhas"><tr><td colspan="4">Carregando...</td></tr></tbody></table>
<div class="resumo" id="resumo"></div>
<script>
  var itens = [], quantidades = {}, somenteLeitura = false;
  function publicar() {
    var escolhidos = itens.filter(function (i) { return (quantidades[i.dgt_codigo] || 0) > 0; })
      .map(function (i) { return { codigo: i.dgt_codigo, descricao: i.dgt_name, categoria: i.dgt_categoria, quantidade: quantidades[i.dgt_codigo] }; });
    document.getElementById('resumo').textContent = escolhidos.length + ' item(ns) selecionado(s)';
    DGT.alterar({
      dados: { quantidades: quantidades },
      valido: escolhidos.length > 0,
      erros: escolhidos.length > 0 ? [] : ['Escolha ao menos um item.'],
      resumo: escolhidos.length + ' item(ns)',
      itens: escolhidos
    });
  }
  function desenhar() {
    var termo = document.getElementById('busca').value.toLowerCase();
    var html = itens.filter(function (i) { return !termo || (i.dgt_codigo + ' ' + i.dgt_name).toLowerCase().indexOf(termo) >= 0; })
      .map(function (i) {
        return '<tr><td class="cod">' + (i.dgt_codigo || '—') + '</td><td>' + i.dgt_name + '</td><td>' + (i.dgt_categoria || '') + '</td>' +
          '<td><input type="number" min="0" data-codigo="' + i.dgt_codigo + '" value="' + (quantidades[i.dgt_codigo] || 0) + '"' + (somenteLeitura ? ' disabled' : '') + '></td></tr>';
      }).join('');
    document.getElementById('linhas').innerHTML = html || '<tr><td colspan="4">Nenhum item.</td></tr>';
  }
  document.getElementById('busca').addEventListener('input', desenhar);
  document.getElementById('linhas').addEventListener('change', function (e) {
    if (e.target.dataset.codigo) { quantidades[e.target.dataset.codigo] = Number(e.target.value) || 0; publicar(); }
  });
  DGT.aoIniciar(function (contexto) {
    somenteLeitura = contexto.somenteLeitura;
    quantidades = (contexto.dados && contexto.dados.quantidades) || {};
    DGT.consultar('itens').then(function (linhas) { itens = linhas; desenhar(); })
      .catch(function (erro) { document.getElementById('linhas').innerHTML = '<tr><td colspan="4">' + erro.message + '</td></tr>'; });
  });
</script>`;

export const FONTES_EXEMPLO_KITS: IFonteDadosComponente[] = [
  {
    nome: 'itens',
    tabela: 'dgt_kititem',
    colunas: ['dgt_codigo', 'dgt_name', 'dgt_categoria', 'dgt_chave'],
    filtroFixo: 'dgt_ativo eq true',
    ordem: 'dgt_ordem asc'
  }
];

const EditorComponente: React.FC<IEditorComponenteProps> = ({ config, editavel, rotuloCampo, metadados, dataverseService, onAlterar }) => {

  const atual: IConfigComponente = config || { tipo: 'nativo', nativo: 'montadorBom', parametros: {} };
  const alterar = (parcial: Partial<IConfigComponente>): void => onAlterar({ ...atual, ...parcial });
  const [previa, setPrevia] = React.useState(false);
  const [valorPrevia, setValorPrevia] = React.useState('');

  const nativo = COMPONENTES_NATIVOS.find(item => item.chave === atual.nativo);
  const fontes = atual.fontes || [];
  const problemas =
    validarConfigComponente(rotuloCampo || 'componente', atual, CHAVES_NATIVOS)
      .concat(validarParametrosNativo(rotuloCampo || 'componente', atual, metadados));

  const alterarFonte = (indice: number, parcial: Partial<IFonteDadosComponente>): void =>
    alterar({ fontes: fontes.map((item, posicao) => (posicao === indice ? { ...item, ...parcial } : item)) });

  return (
    <div style={{ marginTop: '10px', padding: '10px 12px', border: `1px dashed ${COR_BORDA}`, borderRadius: '8px', background: '#FAFBFC', color: COR_AZUL }}>
      <strong style={{ fontSize: '13px' }}>Configuração do componente</strong>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', fontSize: '13px' }}>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="radio" name={`tipo-comp-${rotuloCampo}`} checked={atual.tipo === 'nativo'} disabled={!editavel} onChange={() => alterar({ tipo: 'nativo', nativo: atual.nativo || 'montadorBom' })} />
          <span><strong>Nativo do portal</strong> (telas prontas e testadas)</span>
        </label>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="radio" name={`tipo-comp-${rotuloCampo}`} checked={atual.tipo === 'html'} disabled={!editavel} onChange={() => alterar({ tipo: 'html' })} />
          <span><strong>HTML personalizado</strong> (isolado, com fontes de dados liberadas)</span>
        </label>
      </div>

      {atual.tipo === 'nativo' && (
        <>
          <div style={titulo}>Componente</div>
          <select aria-label="Componente nativo" value={atual.nativo || ''} disabled={!editavel} onChange={evento => alterar({ nativo: evento.target.value, parametros: {} })} style={entrada}>
            {COMPONENTES_NATIVOS.map(item => <option key={item.chave} value={item.chave}>{item.nome}</option>)}
          </select>
          {nativo && <div style={{ fontSize: '12px', color: COR_TEXTO2, marginTop: '4px' }}>{nativo.descricao}</div>}
          {nativo && nativo.parametros.length > 0 && (
            <>
              <div style={titulo}>Parâmetros</div>
              {nativo.parametros.map(parametro => (
                <label key={parametro.chave} style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px' }}>
                  <span style={{ display: 'block', fontWeight: 700, marginBottom: '2px' }}>{parametro.rotulo}</span>
                  {parametro.tipo === 'campo'
                    ? (
                      <select
                        value={(atual.parametros || {})[parametro.chave] || ''}
                        disabled={!editavel}
                        onChange={evento => alterar({ parametros: { ...(atual.parametros || {}), [parametro.chave]: evento.target.value } })}
                        style={entrada}
                      >
                        <option value="">{parametro.obrigatorio ? 'Selecione...' : '(nenhum)'}</option>
                        {metadados
                          .filter(item => (parametro.tiposCampo || ['texto', 'lista', 'simNao']).indexOf(item.tipo) >= 0)
                          .filter(item => !parametro.nativoDoCampo || (!!item.componente && item.componente.nativo === parametro.nativoDoCampo))
                          .map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
                      </select>
                    )
                    : parametro.tipo === 'escolha'
                    ? (
                      <select
                        value={(atual.parametros || {})[parametro.chave] || (parametro.opcoes && parametro.opcoes[0] ? parametro.opcoes[0].valor : '')}
                        disabled={!editavel}
                        onChange={evento => alterar({ parametros: { ...(atual.parametros || {}), [parametro.chave]: evento.target.value } })}
                        style={entrada}
                      >
                        {(parametro.opcoes || []).map(opcao => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                      </select>
                    )
                    : (
                      <input
                        value={(atual.parametros || {})[parametro.chave] || ''}
                        disabled={!editavel}
                        onChange={evento => alterar({ parametros: { ...(atual.parametros || {}), [parametro.chave]: evento.target.value } })}
                        style={entrada}
                      />
                    )}
                  {parametro.ajuda && <span style={{ display: 'block', fontSize: '11.5px', color: COR_TEXTO2 }}>{parametro.ajuda}</span>}
                </label>
              ))}
            </>
          )}
        </>
      )}

      {atual.tipo === 'html' && (
        <>
          <div style={{ ...titulo, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1 }}>HTML (com CSS e JavaScript)</span>
            {editavel && (
              <button
                type="button"
                style={pequeno()}
                onClick={() => {
                  if (!atual.html || window.confirm('Substituir o HTML pelo modelo de exemplo (lista de itens da aba Kits)?')) {
                    alterar({ html: HTML_EXEMPLO_KITS, fontes: FONTES_EXEMPLO_KITS });
                  }
                }}
              >
                Usar modelo de exemplo
              </button>
            )}
          </div>
          <textarea
            aria-label="HTML do componente"
            value={atual.html || ''}
            disabled={!editavel}
            rows={12}
            spellCheck={false}
            onChange={evento => alterar({ html: evento.target.value })}
            style={{ ...entrada, fontFamily: 'Consolas, monospace', fontSize: '12px', resize: 'vertical' }}
          />
          <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '4px' }}>
            Ponte disponível no HTML: <code>DGT.aoIniciar(fn)</code>, <code>DGT.consultar(&apos;fonte&apos;, {'{ coluna: valor }'})</code>,{' '}
            <code>DGT.alterar({'{ dados, valido, erros, resumo, itens }'})</code>. Cores da DGT em variáveis CSS (<code>--dgt-azul</code>, <code>--dgt-verde</code>...).
            O HTML roda isolado: não acessa o portal nem a internet do usuário com o login dele.
          </div>

          <div style={titulo}>Fontes de dados liberadas (somente leitura)</div>
          {fontes.map((fonte, indice) => (
            <div key={`${fonte.nome}-${indice}`} style={{ display: 'grid', gridTemplateColumns: '110px 140px minmax(160px, 1fr) minmax(120px, .8fr) 120px auto', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <input aria-label="Nome da fonte" placeholder="nome" value={fonte.nome} disabled={!editavel} onChange={evento => alterarFonte(indice, { nome: evento.target.value })} style={entrada} />
              <input aria-label="Tabela" placeholder="dgt_tabela" value={fonte.tabela} disabled={!editavel} onChange={evento => alterarFonte(indice, { tabela: evento.target.value.trim() })} style={entrada} />
              <input aria-label="Colunas" placeholder="dgt_codigo, dgt_name" value={fonte.colunas.join(', ')} disabled={!editavel} onChange={evento => alterarFonte(indice, { colunas: evento.target.value.split(',').map(item => item.trim()).filter(item => !!item) })} style={entrada} />
              <input aria-label="Filtro fixo" placeholder="filtro fixo (opcional)" value={fonte.filtroFixo || ''} disabled={!editavel} onChange={evento => alterarFonte(indice, { filtroFixo: evento.target.value })} style={entrada} />
              <input aria-label="Ordem" placeholder="ordem (opcional)" value={fonte.ordem || ''} disabled={!editavel} onChange={evento => alterarFonte(indice, { ordem: evento.target.value })} style={entrada} />
              {editavel ? <button type="button" aria-label="Remover fonte" style={pequeno(true)} onClick={() => alterar({ fontes: fontes.filter((_f, posicao) => posicao !== indice) })}>✕</button> : <span />}
            </div>
          ))}
          <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '2px' }}>Colunas: nome · tabela (nome lógico) · colunas liberadas · filtro fixo OData · ordenação</div>
          {editavel && (
            <button type="button" style={{ ...pequeno(), marginTop: '6px' }} onClick={() => alterar({ fontes: fontes.concat({ nome: `fonte${fontes.length + 1}`, tabela: '', colunas: [] }) })}>
              + Fonte de dados
            </button>
          )}
        </>
      )}

      {problemas.length > 0 && (
        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', background: '#FDE7E9', color: '#8A1C14', fontSize: '12.5px' }}>
          {problemas.map(item => <div key={item}>• {item}</div>)}
        </div>
      )}

      <div style={{ marginTop: '10px' }}>
        <button type="button" style={pequeno()} disabled={problemas.length > 0} onClick={() => { setValorPrevia(''); setPrevia(!previa); }}>
          {previa ? 'Fechar pré-visualização' : 'Pré-visualizar'}
        </button>
        {previa && problemas.length === 0 && (
          <div style={{ marginTop: '8px', border: `1px solid ${COR_BORDA}`, borderRadius: '8px', padding: '10px', background: '#FFFFFF' }}>
            <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginBottom: '6px' }}>Pré-visualização com dados reais — nada é gravado.</div>
            <CampoComponenteFluxo
              id="previa-componente"
              rotulo={rotuloCampo}
              config={atual}
              valor={valorPrevia}
              onAlterar={setValorPrevia}
              dataverseService={dataverseService}
              valoresRegistro={{}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorComponente;
