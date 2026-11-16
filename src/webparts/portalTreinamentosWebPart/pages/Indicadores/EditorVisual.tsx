import * as React from 'react';

import {
  AlturaGrafico,
  IItemGrafico,
  IItemTabela,
  RotulosGrafico,
  TipoGrafico
} from '../../services/dashboards/dashboardModelo';

// ============================================================
// EDITOR DE VISUAL (ícone ✎ em cada gráfico e tabela)
//
// Ajusta o visual na hora, sem gerar outro JSON: tipo de gráfico,
// rótulos, valores, ordem, quantidade de itens, altura, largura e
// título. Quem pode gerenciar dashboards salva no dashboard; os
// demais veem o ajuste só enquanto estiverem na tela.
// ============================================================

export interface IEditorVisualProps {
  item: IItemGrafico | IItemTabela;
  original: IItemGrafico | IItemTabela;
  onAlterar: (item: IItemGrafico | IItemTabela) => void;
  onFechar: () => void;
}

const TIPOS: Array<{ valor: TipoGrafico; rotulo: string }> = [
  { valor: 'barras', rotulo: 'Barras (colunas)' },
  { valor: 'barrasHorizontais', rotulo: 'Barras horizontais' },
  { valor: 'barrasEmpilhadas', rotulo: 'Barras empilhadas' },
  { valor: 'linhas', rotulo: 'Linhas' },
  { valor: 'rosca', rotulo: 'Rosca' }
];

const ROTULOS: Array<{ valor: RotulosGrafico; rotulo: string }> = [
  { valor: 'auto', rotulo: 'Automático' },
  { valor: 'horizontal', rotulo: 'Horizontal' },
  { valor: 'inclinado', rotulo: 'Inclinado' },
  { valor: 'vertical', rotulo: 'Vertical' }
];

const ALTURAS: Array<{ valor: AlturaGrafico; rotulo: string }> = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'alta', rotulo: 'Alta' }
];

const ORDENS: Array<{ valor: string; rotulo: string }> = [
  { valor: '', rotulo: 'Padrão do painel' },
  { valor: 'valor desc', rotulo: 'Maior valor primeiro' },
  { valor: 'valor asc', rotulo: 'Menor valor primeiro' },
  { valor: 'dimensao asc', rotulo: 'Ordem alfabética / cronológica' },
  { valor: 'nenhum', rotulo: 'Ordem da fonte' }
];

const campo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: '#475569', minWidth: '150px', flex: '1 1 150px' };
const entrada: React.CSSProperties = { padding: '6px 8px', borderRadius: '7px', border: '1px solid #CBD5E1', fontSize: '12.5px', background: '#FFFFFF', color: '#14232F', fontWeight: 400 };

// Campos que o editor altera (comuns a gráfico e tabela, ou só de gráfico).
interface IMudancas {
  titulo?: string;
  grafico?: TipoGrafico;
  rotulos?: RotulosGrafico;
  mostrarValores?: boolean;
  ordenar?: string;
  limite?: number;
  altura?: AlturaGrafico;
  largura?: 1 | 2;
}

const EditorVisual: React.FC<IEditorVisualProps> = ({ item, original, onAlterar, onFechar }) => {

  const alterar = (mudancas: IMudancas): void => {
    const novo: Record<string, unknown> = { ...item, ...mudancas };
    // Campo vazio = volta ao padrão (remove do JSON).
    Object.keys(mudancas).forEach(chave => {
      const valor = (mudancas as Record<string, unknown>)[chave];
      if (valor === undefined || valor === '') {
        delete novo[chave];
      }
    });
    onAlterar(novo as unknown as IItemGrafico | IItemTabela);
  };

  const grafico = item.tipo === 'grafico' ? item : undefined;
  // Rosca só faz sentido com uma medida e sem série por campo.
  const permiteRosca = !!grafico && grafico.series.length === 1 && !grafico.serieDimensao;
  const empilhavel = !!grafico && (grafico.series.length > 1 || !!grafico.serieDimensao);

  return (
    <div
      role="group"
      aria-label={`Editar ${item.titulo}`}
      style={{ background: '#F4F7FA', border: '1px solid #E1E8EF', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <label style={{ ...campo, flex: '2 1 240px' }}>
          Título
          <input style={entrada} value={item.titulo} onChange={e => alterar({ titulo: e.target.value || original.titulo })} />
        </label>

        {grafico && (
          <label style={campo}>
            Tipo de gráfico
            <select
              style={entrada}
              value={grafico.grafico === 'barrasEmpilhadas' && grafico.series.length === 1 && !grafico.serieDimensao ? 'barras' : grafico.grafico}
              onChange={e => alterar({ grafico: e.target.value as TipoGrafico })}
            >
              {TIPOS
                .filter(tipo => (tipo.valor !== 'rosca' || permiteRosca) && (tipo.valor !== 'barrasEmpilhadas' || empilhavel))
                .map(tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>)}
            </select>
          </label>
        )}

        {grafico && grafico.grafico !== 'rosca' && grafico.grafico !== 'barrasHorizontais' && (
          <label style={campo}>
            Nomes no eixo
            <select style={entrada} value={grafico.rotulos || 'auto'} onChange={e => alterar({ rotulos: e.target.value === 'auto' ? undefined : e.target.value as RotulosGrafico })}>
              {ROTULOS.map(opcao => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
            </select>
          </label>
        )}

        {grafico && (
          <label style={campo}>
            Valores no gráfico
            <select
              style={entrada}
              value={grafico.mostrarValores === undefined ? '' : grafico.mostrarValores ? 'sim' : 'nao'}
              onChange={e => alterar({ mostrarValores: e.target.value === '' ? undefined : e.target.value === 'sim' })}
            >
              <option value="">Automático</option>
              <option value="sim">Mostrar</option>
              <option value="nao">Ocultar</option>
            </select>
          </label>
        )}

        {(grafico || (item.tipo === 'tabela' && !item.colunas)) && (
          <label style={campo}>
            Ordem
            <select style={entrada} value={item.ordenar || ''} onChange={e => alterar({ ordenar: e.target.value || undefined })}>
              {ORDENS.map(opcao => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
            </select>
          </label>
        )}

        <label style={{ ...campo, flex: '0 1 120px', minWidth: '110px' }}>
          Mostrar até
          <input
            style={entrada}
            type="number"
            min={1}
            max={500}
            placeholder="todos"
            value={item.limite || ''}
            onChange={e => alterar({ limite: Number(e.target.value) > 0 ? Math.min(500, Math.floor(Number(e.target.value))) : undefined })}
          />
        </label>

        {grafico && grafico.grafico !== 'rosca' && grafico.grafico !== 'barrasHorizontais' && (
          <label style={{ ...campo, flex: '0 1 120px', minWidth: '110px' }}>
            Altura
            <select style={entrada} value={grafico.altura || 'media'} onChange={e => alterar({ altura: e.target.value === 'media' ? undefined : e.target.value as AlturaGrafico })}>
              {ALTURAS.map(opcao => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
            </select>
          </label>
        )}

        <label style={{ ...campo, flex: '0 1 150px' }}>
          Largura
          <select style={entrada} value={item.largura === 2 ? '2' : '1'} onChange={e => alterar({ largura: e.target.value === '2' ? 2 : undefined })}>
            <option value="1">Meia linha</option>
            <option value="2">Linha inteira</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={() => onAlterar(original)}
          style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '12px', cursor: 'pointer' }}
        >
          Restaurar este visual
        </button>
        <button
          type="button"
          onClick={onFechar}
          style={{ padding: '6px 14px', borderRadius: '7px', border: 0, background: '#0B1E2D', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          Concluir
        </button>
      </div>
    </div>
  );
};

export default EditorVisual;
