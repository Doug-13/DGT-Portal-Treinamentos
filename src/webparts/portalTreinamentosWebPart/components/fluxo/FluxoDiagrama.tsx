import * as React from 'react';

import {
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia,
  IFluxoTransicao,
  StatusVisualElemento
} from '../../models/Fluxo';

import {
  statusVisualElemento
} from '../../services/fluxo/FluxoEngine';

// ============================================================
// DIAGRAMA DO FLUXO (somente leitura)
//
// Desenha a definição em SVG e pinta cada etapa conforme o
// estado da revisão. Não usa bibliotecas externas: quando o
// fluxo passar a ser importado de um XML BPMN, este componente
// pode ser trocado pelo visualizador do bpmn-js sem afetar o
// restante da tela.
//
// Identidade visual DGT: sem verde/vermelho. A diferença entre
// estados é feita por contorno (cheio, espesso, tracejado) e
// pelo rótulo escrito em cada etapa.
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_CINZA = '#888B8D';
const COR_CINZA_CLARO = '#D9D9D6';
const COR_FUNDO_CLARO = '#F2F2F2';
const COR_CIANO_CLARO = '#DFF6FA';

export interface IFluxoDiagramaProps {
  definicao: IFluxoDefinicao;

  // Sem instância = apenas visualizar a definição (ex.: no
  // módulo Processos), todas as etapas em estilo neutro.
  instancia?: IFluxoInstancia;

  // Etapa destacada (ex.: a que está sendo editada).
  elementoDestacadoId?: string;
}

interface IEstiloNo {
  fundo: string;
  contorno: string;
  espessura: number;
  tracejado?: string;
  texto: string;
  rotulo: string;
}

const estiloTarefa = (
  status: StatusVisualElemento
): IEstiloNo => {

  switch (status) {

    case 'concluido':
      return {
        fundo: COR_CIANO_CLARO,
        contorno: COR_AZUL,
        espessura: 2,
        texto: COR_AZUL,
        rotulo: 'CONCLUÍDA'
      };

    case 'atual':
      return {
        fundo: '#FFFFFF',
        contorno: COR_CIANO,
        espessura: 4,
        texto: COR_AZUL,
        rotulo: 'ETAPA ATUAL'
      };

    case 'naoPercorrido':
      return {
        fundo: COR_FUNDO_CLARO,
        contorno: COR_CINZA_CLARO,
        espessura: 2,
        tracejado: '6 5',
        texto: COR_AZUL,
        rotulo: 'NÃO PERCORRIDA'
      };

    case 'definicao':
      return {
        fundo: '#FFFFFF',
        contorno: COR_AZUL,
        espessura: 2,
        texto: COR_AZUL,
        rotulo: ''
      };

    default:
      return {
        fundo: '#FFFFFF',
        contorno: COR_CINZA,
        espessura: 2,
        tracejado: '6 5',
        texto: COR_AZUL,
        rotulo: ''
      };
  }
};

const estiloGateway = (
  status: StatusVisualElemento
): IEstiloNo => {

  switch (status) {

    case 'concluido':
      return { fundo: COR_AZUL, contorno: COR_AZUL, espessura: 0, texto: '#FFFFFF', rotulo: '' };

    case 'atual':
      return { fundo: COR_CIANO, contorno: COR_CIANO, espessura: 0, texto: COR_AZUL, rotulo: '' };

    case 'naoPercorrido':
      return { fundo: COR_FUNDO_CLARO, contorno: COR_CINZA_CLARO, espessura: 1, texto: COR_AZUL, rotulo: '' };

    case 'definicao':
      return { fundo: COR_AZUL, contorno: COR_AZUL, espessura: 0, texto: '#FFFFFF', rotulo: '' };

    default:
      return { fundo: COR_CINZA_CLARO, contorno: COR_CINZA_CLARO, espessura: 0, texto: COR_AZUL, rotulo: '' };
  }
};

const DESCRICAO_STATUS: Record<StatusVisualElemento, string> = {
  concluido: 'concluída',
  atual: 'etapa atual',
  pendente: 'pendente',
  naoPercorrido: 'não percorrida',
  definicao: 'etapa do fluxo'
};

const caminho = (
  transicao: IFluxoTransicao
): string =>
  transicao.pontos
    .map(
      (ponto, indice) =>
        `${indice === 0 ? 'M' : 'L'} ${ponto.x} ${ponto.y}`
    )
    .join(' ');

const renderizarTransicao = (
  transicao: IFluxoTransicao,
  percorrida: boolean
): React.ReactElement => {

  const cor =
    transicao.excecao
      ? COR_INDIGO
      : percorrida
        ? COR_AZUL
        : COR_CINZA;

  const marcador =
    transicao.excecao
      ? 'dgt-fluxo-seta-excecao'
      : percorrida
        ? 'dgt-fluxo-seta-percorrida'
        : 'dgt-fluxo-seta-pendente';

  return (
    <g key={transicao.id}>
      <path
        d={caminho(transicao)}
        fill="none"
        stroke={cor}
        strokeWidth={percorrida ? 2.5 : 1.5}
        strokeDasharray={transicao.excecao ? '6 6' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${marcador})`}
      />
      {
        transicao.rotulo &&
        transicao.rotuloPosicao && (
          <text
            x={transicao.rotuloPosicao.x}
            y={transicao.rotuloPosicao.y + 12}
            fontSize={13}
            fill={transicao.excecao ? COR_INDIGO : COR_AZUL}
            fontFamily="Barlow, Arial, sans-serif"
          >
            {transicao.rotulo}
          </text>
        )
      }
    </g>
  );
};

// Nome fora do símbolo (eventos e decisões pequenos, como os
// desenhados no editor BPMN).
const rotuloExterno = (
  elemento: IFluxoElemento
): React.ReactElement => {

  const { x, y, largura, altura } =
    elemento.posicao;

  const caixa =
    elemento.rotuloPosicao ||
    {
      x: x + largura / 2 - 60,
      y: y + altura + 4,
      largura: 120,
      altura: 32
    };

  return (
    <foreignObject
      x={caixa.x - 10}
      y={caixa.y}
      width={Math.max(caixa.largura + 20, 60)}
      height={Math.max(caixa.altura + 6, 20)}
    >
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Barlow, Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '14px',
          fontWeight: 600,
          color: COR_AZUL
        }}
      >
        {elemento.nome}
      </div>
    </foreignObject>
  );
};

const renderizarElemento = (
  elemento: IFluxoElemento,
  status: StatusVisualElemento,
  destacado: boolean
): React.ReactElement => {

  const { x, y, largura, altura } =
    elemento.posicao;

  const titulo =
    `${elemento.nome} — ${DESCRICAO_STATUS[status]}`;

  const pequeno =
    largura < 90;

  if (
    elemento.tipo === 'inicio' ||
    elemento.tipo === 'fim'
  ) {

    const preenchido =
      elemento.tipo === 'inicio' ||
      status === 'concluido';

    return (
      <g key={elemento.id}>
        <title>{titulo}</title>
        <circle
          cx={x + largura / 2}
          cy={y + altura / 2}
          r={largura / 2 - (elemento.tipo === 'fim' ? 2 : 0)}
          fill={preenchido ? COR_AZUL : '#FFFFFF'}
          stroke={COR_AZUL}
          strokeWidth={elemento.tipo === 'fim' ? 4 : 0}
        />
        {
          largura >= 44
            ? (
              <text
                x={x + largura / 2}
                y={y + altura / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={preenchido ? '#FFFFFF' : COR_AZUL}
                fontFamily="Barlow, Arial, sans-serif"
              >
                {elemento.nome}
              </text>
            )
            : rotuloExterno(elemento)
        }
      </g>
    );
  }

  if (elemento.tipo === 'gateway') {

    const estilo =
      estiloGateway(status);

    const pontos = [
      `${x + largura / 2},${y}`,
      `${x + largura},${y + altura / 2}`,
      `${x + largura / 2},${y + altura}`,
      `${x},${y + altura / 2}`
    ].join(' ');

    return (
      <g key={elemento.id}>
        <title>{titulo}</title>
        <polygon
          points={pontos}
          fill={estilo.fundo}
          stroke={estilo.contorno}
          strokeWidth={estilo.espessura}
        />
        {
          pequeno
            ? rotuloExterno(elemento)
            : (
              <foreignObject
                x={x + largura * 0.2}
                y={y + altura * 0.25}
                width={largura * 0.6}
                height={altura * 0.5}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontFamily: 'Barlow, Arial, sans-serif',
                    fontSize: '12px',
                    lineHeight: '14px',
                    fontWeight: 600,
                    color: estilo.texto
                  }}
                >
                  {elemento.nome}
                </div>
              </foreignObject>
            )
        }
      </g>
    );
  }

  const estiloBase =
    estiloTarefa(status);

  const estilo: IEstiloNo =
    destacado
      ? { ...estiloBase, contorno: COR_CIANO, espessura: 4, tracejado: undefined, rotulo: 'EM EDIÇÃO' }
      : estiloBase;

  return (
    <g key={elemento.id}>
      <title>{titulo}</title>
      <rect
        x={x}
        y={y}
        width={largura}
        height={altura}
        rx={8}
        ry={8}
        fill={estilo.fundo}
        stroke={estilo.contorno}
        strokeWidth={estilo.espessura}
        strokeDasharray={estilo.tracejado}
      />
      <foreignObject
        x={x + 4}
        y={y + 4}
        width={largura - 8}
        height={altura - 8}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: 'Barlow, Arial, sans-serif',
            color: estilo.texto,
            fontSize: largura < 120 ? '12px' : '13px',
            lineHeight: largura < 120 ? '14px' : '16px',
            overflow: 'hidden'
          }}
        >
          <strong>{elemento.nome}</strong>
          {
            elemento.subtitulo && (
              <span>{elemento.subtitulo}</span>
            )
          }
          {
            estilo.rotulo && (
              <span
                style={{
                  marginTop: '2px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  letterSpacing: '.06em'
                }}
              >
                {estilo.rotulo}
              </span>
            )
          }
        </div>
      </foreignObject>
    </g>
  );
};

const marcador = (
  id: string,
  cor: string
): React.ReactElement => (
  <marker
    id={id}
    viewBox="0 0 10 10"
    refX={8}
    refY={5}
    markerWidth={6}
    markerHeight={6}
    orient="auto-start-reverse"
  >
    <path d="M 0 0 L 10 5 L 0 10 z" fill={cor} />
  </marker>
);

const FluxoDiagrama: React.FC<IFluxoDiagramaProps> = ({
  definicao,
  instancia,
  elementoDestacadoId
}) => {

  const percorrida = (
    transicaoId: string
  ): boolean =>
    instancia
      ? instancia.transicoesPercorridas.indexOf(transicaoId) >= 0
      : true;

  const status = (
    elementoId: string
  ): StatusVisualElemento =>
    instancia
      ? statusVisualElemento(instancia, elementoId)
      : 'definicao';

  const transicoesNormais =
    definicao.transicoes.filter(
      transicao => !transicao.excecao
    );

  const transicoesExcecao =
    definicao.transicoes.filter(
      transicao => transicao.excecao
    );

  const atual =
    instancia
      ? definicao.elementos.find(
        elemento => elemento.id === instancia.elementoAtualId
      )
      : undefined;

  const descricao =
    !instancia
      ? `Fluxo ${definicao.nome}, versão ${definicao.versao}.`
      : instancia.status === 'concluido'
        ? `Fluxo ${definicao.nome} concluído.`
        : `Fluxo ${definicao.nome}. Etapa atual: ${atual ? atual.nome : '-'}.`;

  return (
    <div
      style={{
        overflowX: 'auto',
        width: '100%'
      }}
    >
      <svg
        role="img"
        aria-label={descricao}
        viewBox={`0 0 ${definicao.larguraDiagrama} ${definicao.alturaDiagrama}`}
        width={definicao.larguraDiagrama}
        height={definicao.alturaDiagrama}
        style={{
          display: 'block',
          margin: '0 auto',
          maxWidth: 'none'
        }}
      >
        <defs>
          {marcador('dgt-fluxo-seta-percorrida', COR_AZUL)}
          {marcador('dgt-fluxo-seta-pendente', COR_CINZA)}
          {marcador('dgt-fluxo-seta-excecao', COR_INDIGO)}
        </defs>

        {
          transicoesExcecao.map(
            transicao =>
              renderizarTransicao(
                transicao,
                percorrida(transicao.id)
              )
          )
        }

        {
          transicoesNormais.map(
            transicao =>
              renderizarTransicao(
                transicao,
                percorrida(transicao.id)
              )
          )
        }

        {
          definicao.elementos.map(
            elemento =>
              renderizarElemento(
                elemento,
                status(elemento.id),
                elemento.id === elementoDestacadoId
              )
          )
        }
      </svg>
    </div>
  );
};

export default FluxoDiagrama;
