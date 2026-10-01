import * as React from 'react';

import {
  IColunaTabela
} from '../../models/Fluxo';

import {
  formatarCelula,
  gravarLinhasTabela,
  LinhaTabela,
  lerLinhasTabela,
  linhasPreenchidas
} from '../../services/fluxo/valoresTabela';

// ============================================================
// CAMPO DO TIPO TABELA (preenchimento e leitura)
//
// Cada linha tem as colunas definidas no metadado do processo.
// O valor sai como texto JSON (lista de linhas).
// ============================================================

export interface ITabelaCampoFluxoProps {
  id: string;
  rotulo: string;
  colunas: IColunaTabela[];
  valor: string;
  somenteLeitura?: boolean;
  desabilitado?: boolean;
  onAlterar?: (valor: string) => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';

const estiloCelula: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '34px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '4px',
  padding: '4px 6px',
  fontFamily: 'inherit',
  fontSize: '13px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const estiloCabecalho: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  background: '#EDF0F5',
  borderBottom: `1px solid ${COR_BORDA}`,
  whiteSpace: 'nowrap'
};

const TabelaCampoFluxo: React.FC<ITabelaCampoFluxoProps> = ({
  id,
  rotulo,
  colunas,
  valor,
  somenteLeitura = false,
  desabilitado = false,
  onAlterar
}) => {

  const linhas =
    lerLinhasTabela(valor);

  const alterarLinhas = (
    novas: LinhaTabela[]
  ): void => {
    if (onAlterar) {
      onAlterar(gravarLinhasTabela(novas));
    }
  };

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  if (somenteLeitura) {

    const preenchidas =
      linhasPreenchidas(linhas);

    if (preenchidas.length === 0) {
      return <div style={{ fontSize: '13.5px' }}>—</div>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label={rotulo}
          style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px', background: '#FFFFFF', border: `1px solid ${COR_BORDA}` }}
        >
          <thead>
            <tr>
              <th style={{ ...estiloCabecalho, width: '32px' }}>#</th>
              {colunas.map(coluna => <th key={coluna.chave} style={estiloCabecalho}>{coluna.rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {
              preenchidas.map(
                (linha, indice) => (
                  <tr key={`l-${indice}`}>
                    <td style={{ padding: '6px 8px', borderBottom: `1px solid ${COR_BORDA}` }}>{indice + 1}</td>
                    {
                      colunas.map(
                        coluna => (
                          <td key={coluna.chave} style={{ padding: '6px 8px', borderBottom: `1px solid ${COR_BORDA}` }}>
                            {formatarCelula(coluna, linha[coluna.chave] || '') || '—'}
                          </td>
                        )
                      )
                    }
                  </tr>
                )
              )
            }
          </tbody>
        </table>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Preenchimento
  // ----------------------------------------------------------

  const celula = (
    coluna: IColunaTabela,
    linha: LinhaTabela,
    indice: number
  ): React.ReactElement => {

    const atual =
      linha[coluna.chave] || '';

    const alterar = (
      novo: string
    ): void => {
      alterarLinhas(
        linhas.map(
          (item, posicao) => posicao === indice ? { ...item, [coluna.chave]: novo } : item
        )
      );
    };

    const rotuloCelula =
      `${coluna.rotulo}, linha ${indice + 1}`;

    if (coluna.tipo === 'simNao' || coluna.tipo === 'lista') {
      return (
        <select
          aria-label={rotuloCelula}
          value={atual}
          disabled={desabilitado}
          onChange={evento => alterar(evento.target.value)}
          style={estiloCelula}
        >
          <option value="">—</option>
          {
            coluna.tipo === 'simNao'
              ? [
                <option key="sim" value="sim">Sim</option>,
                <option key="nao" value="nao">Não</option>
              ]
              : (coluna.opcoes || []).map(
                opcao => <option key={opcao} value={opcao}>{opcao}</option>
              )
          }
        </select>
      );
    }

    return (
      <input
        aria-label={rotuloCelula}
        type={coluna.tipo === 'numero' ? 'number' : coluna.tipo === 'data' ? 'date' : 'text'}
        value={atual}
        disabled={desabilitado}
        onChange={evento => alterar(evento.target.value)}
        style={estiloCelula}
      />
    );
  };

  return (
    <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label={rotulo}
          style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${Math.max(320, colunas.length * 140 + 80)}px`, fontSize: '13px' }}
        >
          <thead>
            <tr>
              <th style={{ ...estiloCabecalho, width: '32px' }}>#</th>
              {
                colunas.map(
                  coluna => (
                    <th key={coluna.chave} style={estiloCabecalho}>
                      {coluna.rotulo}{coluna.obrigatoria ? ' *' : ''}
                    </th>
                  )
                )
              }
              <th style={{ ...estiloCabecalho, width: '40px' }} aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {
              linhas.length === 0 && (
                <tr>
                  <td colSpan={colunas.length + 2} style={{ padding: '10px 8px', fontSize: '13px', borderBottom: `1px solid ${COR_BORDA}` }}>
                    Nenhuma linha. Clique em “+ Linha”.
                  </td>
                </tr>
              )
            }
            {
              linhas.map(
                (linha, indice) => (
                  <tr key={`l-${indice}`}>
                    <td style={{ padding: '4px 8px', borderBottom: `1px solid ${COR_BORDA}` }}>{indice + 1}</td>
                    {
                      colunas.map(
                        coluna => (
                          <td key={coluna.chave} style={{ padding: '4px', borderBottom: `1px solid ${COR_BORDA}` }}>
                            {celula(coluna, linha, indice)}
                          </td>
                        )
                      )
                    }
                    <td style={{ padding: '4px', borderBottom: `1px solid ${COR_BORDA}` }}>
                      <button
                        type="button"
                        aria-label={`Remover a linha ${indice + 1}`}
                        disabled={desabilitado}
                        onClick={() => alterarLinhas(linhas.filter((_item, posicao) => posicao !== indice))}
                        style={{
                          minWidth: '30px',
                          minHeight: '30px',
                          border: `1px solid ${COR_BORDA}`,
                          borderRadius: '4px',
                          background: '#FFFFFF',
                          color: COR_AZUL,
                          cursor: desabilitado ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              )
            }
          </tbody>
        </table>
      </div>

      <div>
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => alterarLinhas([...linhas, {}])}
          style={{
            minHeight: '34px',
            padding: '0 12px',
            border: `2px solid ${COR_AZUL}`,
            borderRadius: '6px',
            background: '#FFFFFF',
            color: COR_AZUL,
            fontWeight: 700,
            fontSize: '13px',
            cursor: desabilitado ? 'not-allowed' : 'pointer',
            opacity: desabilitado ? 0.45 : 1
          }}
        >
          + Linha
        </button>
      </div>
    </div>
  );
};

export default TabelaCampoFluxo;
