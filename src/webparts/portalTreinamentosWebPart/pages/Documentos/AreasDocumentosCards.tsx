import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

// ============================================================
// CARTÕES DE ÁREA — gerados a partir da tabela de Áreas
//   Administrador → "Todas as áreas" + todas as áreas ativas
//   Demais        → somente as áreas do usuário
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

const Cartao:
  React.FC<{
    titulo: string;
    subtitulo: string;
    visual: IVisualArea;
    ativo: boolean;
    onClick: () => void;
  }> = ({
    titulo,
    subtitulo,
    visual,
    ativo,
    onClick
  }) => (

    <button
      type="button"
      onClick={onClick}
      title={titulo}
      style={{
        minHeight: '110px',
        display: 'grid',
        gridTemplateRows: '42px auto 1fr',
        alignContent: 'start',
        gap: '7px',
        padding: '14px',
        border: ativo
          ? '2px solid #05C3DD'
          : '1px solid #D8E2EC',
        borderRadius: '12px',
        background: ativo
          ? '#F0FCFE'
          : '#FFFFFF',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: ativo
          ? '0 3px 10px rgba(5,195,221,.15)'
          : 'none'
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '9px',
          background: visual.fundo,
          color: visual.cor,
          fontSize: '22px'
        }}
      >
        {visual.icone}
      </div>

      <strong
        style={{
          display: 'block',
          color: '#0A2845',
          fontSize: '14px',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          display: 'block',
          color: '#61788E',
          fontSize: '11px',
          lineHeight: 1.35
        }}
      >
        {subtitulo}
      </span>
    </button>
  );

const contar = (
  documentos: IDocumento[],
  areaId?: string
): string => {

  const lista =
    areaId === undefined
      ? documentos
      : documentos.filter(
        documento => guid(documento.areaId) === guid(areaId)
      );

  const vigentes =
    lista.filter(
      documento => normalizar(documento.status) === 'vigente'
    ).length;

  const outros =
    lista.length - vigentes;

  if (lista.length === 0) {
    return 'Nenhum documento';
  }

  return (
    `${vigentes} vigente(s)` +
    (outros > 0 ? ` · ${outros} em andamento` : '')
  );
};

const AreasDocumentosCards:
  React.FC<IAreasDocumentosCardsProps> = ({
    areas,
    documentos,
    mostrarTodas,
    areaSelecionadaId,
    onSelecionar
  }) => {

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

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '10px',
          marginTop: '12px'
        }}
      >
        {
          // "Todas": para o admin é o acervo inteiro; para os demais,
          // só aparece se ele tiver mais de uma área (junta as dele).
          (mostrarTodas || areas.length > 1) &&
          (
            <Cartao
              titulo={mostrarTodas ? 'Todas as áreas' : 'Minhas áreas'}
              subtitulo={contar(documentos)}
              visual={{ icone: '📁', fundo: '#FFF1CF', cor: '#D98A00' }}
              ativo={!areaSelecionadaId}
              onClick={() => onSelecionar('')}
            />
          )
        }

        {
          areas.map(
            (area, indice) => (
              <Cartao
                key={area.id}
                titulo={area.nome}
                subtitulo={contar(documentos, area.id)}
                visual={visualDaArea(area, indice)}
                ativo={guid(areaSelecionadaId) === guid(area.id)}
                onClick={() => onSelecionar(area.id)}
              />
            )
          )
        }
      </div>
    );
  };

export default AreasDocumentosCards;
