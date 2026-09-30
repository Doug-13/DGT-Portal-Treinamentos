import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

// ============================================================
// ÁREAS — filtro compacto em "chips"
//   Administrador → "Todas as áreas" + todas as áreas ativas
//   Demais        → somente as áreas do usuário
//
// Para não poluir a tela quando há muitas áreas:
//   - áreas com documentos aparecem primeiro (mais documentos antes);
//   - recolhido, mostra só as áreas com documentos (até LIMITE) e a
//     área selecionada; o restante fica em "Mostrar todas";
//   - com muitas áreas, aparece um campo para filtrar pelo nome.
// ============================================================

export interface IAreasDocumentosCardsProps {
  areas: IAreaAdmin[];
  documentos: IDocumento[];
  mostrarTodas: boolean;
  areaSelecionadaId: string;
  onSelecionar: (areaId: string) => void;
}

interface IVisualArea {
  icone: string;
  fundo: string;
  cor: string;
}

// Ícone pelo nome da área; áreas novas usam a paleta em sequência.
const VISUAL_POR_NOME: Array<{ chave: string[]; visual: IVisualArea }> = [
  { chave: ['qualidade'], visual: { icone: '⚙', fundo: '#E6F2FF', cor: '#0B67D1' } },
  { chave: ['seguranca', 'sesmt'], visual: { icone: '⛑', fundo: '#FFF0D5', cor: '#D98200' } },
  { chave: ['engenharia', 'projeto'], visual: { icone: '🔧', fundo: '#E7F3FF', cor: '#0A6DD8' } },
  { chave: ['rh', 'recursos humanos', 'pessoas'], visual: { icone: '👥', fundo: '#FFE9F0', cor: '#C41C55' } },
  { chave: ['administrativ', 'financeir'], visual: { icone: '🏢', fundo: '#EEEAFE', cor: '#5B43D6' } },
  { chave: ['produc', 'fabrica', 'operac'], visual: { icone: '🏭', fundo: '#E7F6EC', cor: '#107C10' } },
  { chave: ['processo', 'automac'], visual: { icone: '🔄', fundo: '#E6F9FC', cor: '#05838F' } },
  { chave: ['ti', 'tecnologia', 'sistemas'], visual: { icone: '💻', fundo: '#E8EAF8', cor: '#485CC7' } },
  { chave: ['comercial', 'vendas'], visual: { icone: '📈', fundo: '#FFF4E5', cor: '#B45309' } },
  { chave: ['logistic', 'almoxarif', 'expedic'], visual: { icone: '🚚', fundo: '#F1F5F9', cor: '#334155' } }
];

const PALETA: IVisualArea[] = [
  { icone: '📂', fundo: '#E6F9FC', cor: '#05838F' },
  { icone: '📂', fundo: '#E8EAF8', cor: '#485CC7' },
  { icone: '📂', fundo: '#FFF4E5', cor: '#B45309' },
  { icone: '📂', fundo: '#E7F6EC', cor: '#107C10' }
];

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const guid = (
  valor?: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const visualDaArea = (
  area: IAreaAdmin,
  indice: number
): IVisualArea => {

  const nome =
    ` ${normalizar(area.nome)} ${normalizar(area.sigla)} `;

  const encontrado =
    VISUAL_POR_NOME.find(
      item =>
        item.chave.some(
          chave =>
            chave.length <= 3
              ? nome.indexOf(` ${chave} `) >= 0
              : nome.indexOf(chave) >= 0
        )
    );

  return encontrado
    ? encontrado.visual
    : PALETA[indice % PALETA.length];
};

// Quantidade de chips visíveis com a lista recolhida.
const LIMITE_RECOLHIDO = 8;

// A partir de quantas áreas aparece o campo de busca.
const MINIMO_PARA_BUSCA = 10;

interface IContagem {
  total: number;
  vigentes: number;
}

const contarArea = (
  documentos: IDocumento[],
  areaId?: string
): IContagem => {

  const lista =
    areaId === undefined
      ? documentos
      : documentos.filter(
        documento => guid(documento.areaId) === guid(areaId)
      );

  return {
    total: lista.length,
    vigentes: lista.filter(
      documento => normalizar(documento.status) === 'vigente'
    ).length
  };
};

const descreverContagem = (
  c: IContagem
): string =>
  c.total === 0
    ? 'Nenhum documento'
    : `${c.vigentes} vigente(s)` +
      (c.total - c.vigentes > 0 ? ` · ${c.total - c.vigentes} em andamento` : '');

const Chip:
  React.FC<{
    titulo: string;
    dica: string;
    quantidade: number;
    visual: IVisualArea;
    ativo: boolean;
    vazio: boolean;
    onClick: () => void;
  }> = ({
    titulo,
    dica,
    quantidade,
    visual,
    ativo,
    vazio,
    onClick
  }) => (

    <button
      type="button"
      onClick={onClick}
      title={dica}
      aria-pressed={ativo}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        maxWidth: '260px',
        padding: '6px 10px 6px 6px',
        border: ativo
          ? '2px solid #05C3DD'
          : '1px solid #D8E2EC',
        borderRadius: '999px',
        background: ativo
          ? '#F0FCFE'
          : '#FFFFFF',
        cursor: 'pointer',
        opacity: vazio && !ativo ? 0.62 : 1,
        boxShadow: ativo
          ? '0 2px 8px rgba(5,195,221,.18)'
          : 'none'
      }}
    >
      <span
        style={{
          width: '26px',
          height: '26px',
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: visual.fundo,
          color: visual.cor,
          fontSize: '14px'
        }}
      >
        {visual.icone}
      </span>

      <span
        style={{
          color: '#0A2845',
          fontSize: '13px',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {titulo}
      </span>

      <span
        style={{
          flex: '0 0 auto',
          minWidth: '20px',
          padding: '1px 7px',
          borderRadius: '999px',
          background: quantidade > 0
            ? '#0B2D4D'
            : '#EEF2F6',
          color: quantidade > 0
            ? '#FFFFFF'
            : '#61788E',
          fontSize: '11px',
          fontWeight: 700,
          textAlign: 'center'
        }}
      >
        {quantidade}
      </span>
    </button>
  );

const AreasDocumentosCards:
  React.FC<IAreasDocumentosCardsProps> = ({
    areas,
    documentos,
    mostrarTodas,
    areaSelecionadaId,
    onSelecionar
  }) => {

    const [expandido, setExpandido] = React.useState(false);
    const [busca, setBusca] = React.useState('');

    // Áreas com contagem e visual, ordenadas: com documentos primeiro.
    const itens =
      React.useMemo(
        () =>
          areas
            .map((area, indice) => ({
              area,
              contagem: contarArea(documentos, area.id),
              visual: visualDaArea(area, indice)
            }))
            .sort((a, b) =>
              b.contagem.total - a.contagem.total ||
              a.area.nome.localeCompare(b.area.nome, 'pt-BR')
            ),
        [areas, documentos]
      );

    if (
      areas.length === 0 &&
      !mostrarTodas
    ) {
      return (
        <div
          style={{
            marginTop: '12px',
            padding: '14px 16px',
            borderRadius: '12px',
            background: '#FFF4E5',
            color: '#8A5300',
            fontSize: '13px'
          }}
        >
          Você ainda não está vinculado a nenhuma área. Por isso aparecem apenas os documentos
          corporativos. Solicite o vínculo ao Administrador em <strong>Gestão → Áreas e acessos</strong>.
        </div>
      );
    }

    const termo = normalizar(busca);

    const comDocumentos =
      itens.filter(item => item.contagem.total > 0);

    const semDocumentos =
      itens.length - comDocumentos.length;

    // Lista visível
    let visiveis = itens;

    if (termo) {
      visiveis =
        itens.filter(item =>
          normalizar(item.area.nome).indexOf(termo) >= 0 ||
          normalizar(item.area.sigla).indexOf(termo) >= 0
        );
    } else if (!expandido) {
      // Recolhido: áreas com documentos (até o limite). Se nenhuma tiver
      // documentos, mostra as primeiras áreas para não ficar vazio.
      const base =
        comDocumentos.length
          ? comDocumentos
          : itens;

      visiveis = base.slice(0, LIMITE_RECOLHIDO);

      // Garante que a área selecionada apareça.
      const selecionada =
        itens.find(item => guid(item.area.id) === guid(areaSelecionadaId));

      if (selecionada && visiveis.indexOf(selecionada) < 0) {
        visiveis = [...visiveis, selecionada];
      }
    }

    const ocultas =
      itens.length - visiveis.length;

    const mostrarChipTodas =
      mostrarTodas || areas.length > 1;

    const totalGeral =
      contarArea(documentos);

    return (
      <section
        style={{
          marginTop: '12px',
          padding: '14px 16px',
          border: '1px solid #D8E2EC',
          borderRadius: '12px',
          background: '#FFFFFF'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '10px'
          }}
        >
          <div>
            <strong style={{ color: '#0A2845', fontSize: '14px' }}>
              Áreas
            </strong>
            <span style={{ marginLeft: '8px', color: '#61788E', fontSize: '12px' }}>
              {comDocumentos.length} com documentos
              {semDocumentos > 0 ? ` · ${semDocumentos} sem documentos` : ''}
            </span>
          </div>

          {itens.length >= MINIMO_PARA_BUSCA && (
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Filtrar áreas..."
              aria-label="Filtrar áreas"
              style={{
                width: '220px',
                maxWidth: '100%',
                padding: '7px 11px',
                border: '1px solid #D8E2EC',
                borderRadius: '999px',
                fontSize: '12px'
              }}
            />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          {mostrarChipTodas && !termo && (
            <Chip
              titulo={mostrarTodas ? 'Todas as áreas' : 'Minhas áreas'}
              dica={descreverContagem(totalGeral)}
              quantidade={totalGeral.total}
              visual={{ icone: '📁', fundo: '#FFF1CF', cor: '#D98A00' }}
              ativo={!areaSelecionadaId}
              vazio={false}
              onClick={() => onSelecionar('')}
            />
          )}

          {visiveis.map(item => (
            <Chip
              key={item.area.id}
              titulo={item.area.nome}
              dica={`${item.area.sigla ? item.area.sigla + ' - ' : ''}${item.area.nome}: ${descreverContagem(item.contagem)}`}
              quantidade={item.contagem.total}
              visual={item.visual}
              ativo={guid(areaSelecionadaId) === guid(item.area.id)}
              vazio={item.contagem.total === 0}
              onClick={() => onSelecionar(item.area.id)}
            />
          ))}

          {termo && visiveis.length === 0 && (
            <span style={{ color: '#61788E', fontSize: '12px' }}>
              Nenhuma área encontrada.
            </span>
          )}

          {!termo && (ocultas > 0 || expandido) && (
            <button
              type="button"
              onClick={() => setExpandido(!expandido)}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: 'transparent',
                color: '#0B5CAB',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {expandido
                ? 'Mostrar menos'
                : `+ ${ocultas} área(s)`}
            </button>
          )}
        </div>
      </section>
    );
  };

export default AreasDocumentosCards;
