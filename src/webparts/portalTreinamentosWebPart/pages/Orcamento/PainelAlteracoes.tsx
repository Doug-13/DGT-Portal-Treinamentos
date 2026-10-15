import * as React from 'react';

import {
  IAlteracaoOrcamento
} from '../../services/orcamento/OrcamentoService';

import {
  COR,
  FONTE,
  cartao,
  formatarDataHora
} from './orcamentoComum';

// ============================================================
// LOG DE ALTERAÇÕES (linha a linha)
//
// Mostra as linhas alteradas, agrupadas por conta, com cada mudança
// (valor anterior → novo), quem fez e quando. Quando a planilha já
// foi devolvida alguma vez, dá para alternar entre "desde a última
// devolução" e "todas".
// ============================================================

export interface IPainelAlteracoesProps {
  alteracoes: IAlteracaoOrcamento[];
  carregando: boolean;
  // Data/hora da última devolução (habilita o filtro "desde").
  desde?: string;
  // Filtro inicial quando "desde" existe.
  modoInicial?: 'desde' | 'todas';
  titulo?: string;
  // Começa aberto?
  aberto?: boolean;
}

interface IGrupoLinha {
  chave: string;
  codigo: string;
  conta: string;
  grupo: string;
  itens: IAlteracaoOrcamento[];
}

const COR_TIPO: { [tipo: string]: string } = {
  'Inclusão': '#107C10',
  'Alteração': '#0F6CBD',
  'Remoção': '#B42318'
};

const PainelAlteracoes: React.FC<IPainelAlteracoesProps> = (props) => {

  const [modo, setModo] = React.useState<'desde' | 'todas'>(
    props.desde ? props.modoInicial || 'desde' : 'todas'
  );
  const [aberto, setAberto] = React.useState(props.aberto !== false);
  const [linhaAberta, setLinhaAberta] = React.useState('');

  React.useEffect(() => {
    setModo(props.desde ? props.modoInicial || 'desde' : 'todas');
  }, [props.desde, props.modoInicial]);

  const filtradas =
    React.useMemo(() => {
      if (modo === 'desde' && props.desde) {
        const limite = new Date(props.desde).getTime();
        return props.alteracoes.filter(item => new Date(item.data).getTime() >= limite);
      }
      return props.alteracoes;
    }, [props.alteracoes, props.desde, modo]);

  const linhas =
    React.useMemo(() => {
      const mapa: { [chave: string]: IGrupoLinha } = {};
      const ordem: string[] = [];
      filtradas.forEach(item => {
        const chave = item.linhaId || `${item.codigo}|${item.conta}`;
        if (!mapa[chave]) {
          mapa[chave] = { chave, codigo: item.codigo, conta: item.conta, grupo: item.grupo, itens: [] };
          ordem.push(chave);
        }
        mapa[chave].itens.push(item);
      });
      return ordem.map(chave => mapa[chave]);
    }, [filtradas]);

  const botaoFiltro = (ativo: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: '999px',
    border: `1px solid ${ativo ? COR.azulAcao : COR.borda}`,
    background: ativo ? '#E8F2FF' : '#FFFFFF',
    color: ativo ? COR.azulAcao : COR.texto2,
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: FONTE
  });

  return (
    <div style={{ ...cartao, fontFamily: FONTE }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-expanded={aberto}
          style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: FONTE }}
        >
          <span style={{ fontSize: '12px', color: COR.texto2 }}>{aberto ? '▼' : '▶'}</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: COR.azul }}>
            {props.titulo || 'Log de alterações'}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', background: linhas.length ? COR.azulAcao : '#94A3B8', borderRadius: '999px', padding: '2px 9px' }}>
            {linhas.length} linha(s)
          </span>
        </button>
        <div style={{ flex: 1 }} />
        {props.desde && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => setModo('desde')} style={botaoFiltro(modo === 'desde')}>
              Desde a última devolução
            </button>
            <button type="button" onClick={() => setModo('todas')} style={botaoFiltro(modo === 'todas')}>
              Todas
            </button>
          </div>
        )}
      </div>

      {aberto && (
        <div style={{ marginTop: '12px' }}>
          {props.carregando ? (
            <div style={{ fontSize: '13px', color: COR.texto2 }}>Carregando o log de alterações...</div>
          ) : linhas.length === 0 ? (
            <div style={{ fontSize: '13px', color: COR.texto2 }}>
              {modo === 'desde' && props.desde
                ? 'Nenhuma linha foi alterada desde a última devolução.'
                : 'Nenhuma alteração registrada ainda.'}
            </div>
          ) : (
            linhas.map(linha => {
              const expandida = linhaAberta === linha.chave;
              const ultima = linha.itens[0];
              const removida = linha.itens.some(item => item.tipo === 'Remoção');
              const calculada = linha.itens.every(item => item.origem === 'Cálculo automático');
              return (
                <div key={linha.chave} style={{ borderTop: `1px solid ${COR.borda}`, padding: '9px 0' }}>
                  <button
                    type="button"
                    onClick={() => setLinhaAberta(expandida ? '' : linha.chave)}
                    aria-expanded={expandida}
                    style={{ width: '100%', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: FONTE, display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                  >
                    <span style={{ fontSize: '11px', color: COR.texto2, marginTop: '3px' }}>{expandida ? '▼' : '▶'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: removida ? COR.perigo : COR.azul }}>
                        {linha.conta}
                        {removida && <span style={{ fontWeight: 600 }}> (removida)</span>}
                        {calculada && <span style={{ fontWeight: 600, color: '#00707F' }}> (calculada)</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: '12px', color: COR.texto2 }}>
                        {linha.codigo} · {linha.grupo} · {linha.itens.length} alteração(ões) · última em {formatarDataHora(ultima.data)} por {ultima.usuarioNome || '—'}
                      </span>
                      {!expandida && (
                        <span style={{ display: 'block', fontSize: '12.5px', color: COR.azul, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ultima.resumo}
                        </span>
                      )}
                    </span>
                  </button>

                  {expandida && (
                    <div style={{ margin: '8px 0 0 22px' }}>
                      {linha.itens.map(item => (
                        <div key={item.id} style={{ padding: '7px 10px', borderLeft: `3px solid ${COR_TIPO[item.tipo] || COR.borda}`, background: '#F8FAFC', borderRadius: '0 6px 6px 0', marginBottom: '6px' }}>
                          <div style={{ fontSize: '12px', color: COR.texto2 }}>
                            <strong style={{ color: COR_TIPO[item.tipo] || COR.azul }}>{item.tipo}</strong>
                            {' · '}{formatarDataHora(item.data)}
                            {' · '}{item.usuarioNome || '—'}
                            {item.origem === 'Cálculo automático' && ' · cálculo automático'}
                          </div>
                          {item.detalhes.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                              {item.detalhes.map((detalhe, indice) => (
                                <span key={indice} style={{ fontSize: '12px', background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '6px', padding: '2px 8px', color: COR.azul }}>
                                  <strong>{detalhe.campo}:</strong>{' '}
                                  <span style={{ color: COR.texto2, textDecoration: 'line-through' }}>
                                    {typeof detalhe.de === 'number' ? detalhe.de.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : (detalhe.de || '—')}
                                  </span>
                                  {' → '}
                                  <span style={{ fontWeight: 700 }}>
                                    {typeof detalhe.para === 'number' ? detalhe.para.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : (detalhe.para || '—')}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '12.5px', color: COR.azul, marginTop: '4px' }}>{item.resumo}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default PainelAlteracoes;
