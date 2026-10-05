import {
  NOME_PADRAO_EVENTO_REVISAO
} from '../../../utils/numeracaoRevisao';

import {
  IFluxoAcao,
  IFluxoCampo,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoMetadado,
  IFluxoPosicao,
  IFluxoTransicao,
  TipoElementoFluxo
} from '../../../models/Fluxo';

// ============================================================
// CONVERSÃO ENTRE O DESENHO BPMN E A DEFINIÇÃO DO FLUXO
//
// O editor visual (bpmn-js) cuida do DESENHO: etapas, decisões,
// ligações e posições. A configuração de cada etapa (responsável,
// prazo, ações, campos) fica na definição do fluxo, ligada ao
// elemento BPMN pelo mesmo id.
//
// Este arquivo NÃO importa o bpmn-js: trabalha com um "retrato"
// simples do desenho (IBpmnSnapshot), o que permite testar a
// conversão e manter o bpmn-js fora do pacote principal.
// ============================================================

export interface IBpmnForma {
  id: string;
  tipo: string;
  nome: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotulo?: IFluxoPosicao;
}

export interface IBpmnConexao {
  id: string;
  tipo: string;
  nome: string;
  origemId: string;
  destinoId: string;
  pontos: Array<{ x: number; y: number }>;
  rotulo?: IFluxoPosicao;
}

export interface IBpmnSnapshot {
  formas: IBpmnForma[];
  conexoes: IBpmnConexao[];
}

// Configuração de negócio de uma etapa (o que não está no desenho).
export type IConfigElemento = Pick<
  IFluxoElemento,
  'subtitulo' | 'instrucoes' | 'prazoDiasUteis' | 'responsaveis' | 'acoes' | 'campos' | 'acaoSistema' | 'statusDocumento' | 'tipoRevisao' | 'retreinamentoAoPublicar'
>;

// Configuração de negócio de uma ligação.
export type IConfigTransicao = Pick<
  IFluxoTransicao,
  'tipoCondicao' | 'resultado' | 'campo' | 'valorEsperado' | 'padrao' | 'excecao'
>;

// ------------------------------------------------------------
// Tipos BPMN aceitos nesta fase
// ------------------------------------------------------------

const MAPA_TIPOS: Record<string, TipoElementoFluxo> = {
  'bpmn:StartEvent': 'inicio',
  'bpmn:EndEvent': 'fim',
  'bpmn:Task': 'tarefaHumana',
  'bpmn:UserTask': 'tarefaHumana',
  'bpmn:ManualTask': 'tarefaHumana',
  'bpmn:ExclusiveGateway': 'gateway',
  'bpmn:ServiceTask': 'tarefaSistema',
  'bpmn:ScriptTask': 'tarefaSistema',
  // Evento intermediário (círculo) = evento de revisão.
  'bpmn:IntermediateThrowEvent': 'eventoRevisao'
};

// Elementos que podem existir no desenho, mas não afetam o fluxo.
const TIPOS_IGNORADOS: string[] = [
  'bpmn:TextAnnotation',
  'bpmn:Association',
  'bpmn:Process',
  'bpmn:Collaboration',
  'label'
];

const NOME_TIPO_BPMN: Record<string, string> = {
  'bpmn:ParallelGateway': 'gateway paralelo',
  'bpmn:InclusiveGateway': 'gateway inclusivo',
  'bpmn:EventBasedGateway': 'gateway de evento',
  'bpmn:ComplexGateway': 'gateway complexo',
  'bpmn:IntermediateCatchEvent': 'evento intermediário de captura',
  'bpmn:BoundaryEvent': 'evento de borda',
  'bpmn:SubProcess': 'subprocesso',
  'bpmn:CallActivity': 'chamada de processo',
  'bpmn:SendTask': 'tarefa de envio',
  'bpmn:ReceiveTask': 'tarefa de recebimento',
  'bpmn:BusinessRuleTask': 'tarefa de regra de negócio',
  'bpmn:Participant': 'piscina (pool)',
  'bpmn:Lane': 'raia (lane)',
  'bpmn:DataObjectReference': 'objeto de dados',
  'bpmn:DataStoreReference': 'repositório de dados',
  'bpmn:Group': 'grupo'
};

export const tipoFluxoDoBpmn = (
  tipoBpmn: string
): TipoElementoFluxo | undefined =>
  MAPA_TIPOS[tipoBpmn];

const TIPO_BPMN_DO_FLUXO: Record<TipoElementoFluxo, string> = {
  inicio: 'bpmn:startEvent',
  fim: 'bpmn:endEvent',
  tarefaHumana: 'bpmn:userTask',
  gateway: 'bpmn:exclusiveGateway',
  tarefaSistema: 'bpmn:serviceTask',
  eventoRevisao: 'bpmn:intermediateThrowEvent'
};

// Tipo BPMN (como o editor informa) de um elemento da definição.
const TIPO_BPMN_EDITOR: Record<TipoElementoFluxo, string> = {
  inicio: 'bpmn:StartEvent',
  fim: 'bpmn:EndEvent',
  tarefaHumana: 'bpmn:UserTask',
  gateway: 'bpmn:ExclusiveGateway',
  tarefaSistema: 'bpmn:ServiceTask',
  eventoRevisao: 'bpmn:IntermediateThrowEvent'
};

export const tipoBpmnDoElemento = (
  tipo: TipoElementoFluxo
): string =>
  TIPO_BPMN_EDITOR[tipo];

// "Retrato" montado a partir de uma definição salva (versão publicada
// ou arquivada, que é exibida sem o editor visual).
export const snapshotDaDefinicao = (
  definicao: IFluxoDefinicao
): IBpmnSnapshot => ({
  formas: definicao.elementos.map(
    elemento => ({
      id: elemento.id,
      tipo: TIPO_BPMN_EDITOR[elemento.tipo],
      nome: elemento.nome,
      x: elemento.posicao.x,
      y: elemento.posicao.y,
      largura: elemento.posicao.largura,
      altura: elemento.posicao.altura
    })
  ),
  conexoes: definicao.transicoes.map(
    transicao => ({
      id: transicao.id,
      tipo: 'bpmn:SequenceFlow',
      nome: transicao.rotulo || '',
      origemId: transicao.origemId,
      destinoId: transicao.destinoId,
      pontos: transicao.pontos
    })
  )
});

// ------------------------------------------------------------
// Configurações padrão para elementos novos
// ------------------------------------------------------------

export const configPadraoElemento = (
  tipo: TipoElementoFluxo
): IConfigElemento => {

  if (tipo === 'tarefaHumana') {
    return {
      subtitulo: '',
      instrucoes: '',
      prazoDiasUteis: 3,
      responsaveis: [],
      acoes: [
        {
          chave: 'concluir',
          rotulo: 'Concluir',
          resultado: 'concluido',
          principal: true,
          exigeComentario: false
        }
      ],
      campos: []
    };
  }

  if (tipo === 'tarefaSistema') {
    return {
      subtitulo: 'Tarefa de sistema',
      responsaveis: [],
      acoes: [],
      campos: []
    };
  }

  if (tipo === 'eventoRevisao') {
    return {
      tipoRevisao: 'revisao',
      responsaveis: [],
      acoes: [],
      campos: []
    };
  }

  return {
    responsaveis: [],
    acoes: [],
    campos: []
  };
};

export const configPadraoTransicao = (): IConfigTransicao => ({
  tipoCondicao: 'sempre',
  padrao: false,
  excecao: false
});

export const configDoElemento = (
  elemento: IFluxoElemento
): IConfigElemento => ({
  subtitulo: elemento.subtitulo,
  instrucoes: elemento.instrucoes,
  prazoDiasUteis: elemento.prazoDiasUteis,
  responsaveis: elemento.responsaveis,
  acoes: elemento.acoes,
  campos: elemento.campos,
  acaoSistema: elemento.acaoSistema,
  statusDocumento: elemento.statusDocumento,
  tipoRevisao: elemento.tipoRevisao,
  retreinamentoAoPublicar: elemento.retreinamentoAoPublicar
});

export const configDaTransicao = (
  transicao: IFluxoTransicao
): IConfigTransicao => ({
  tipoCondicao: transicao.tipoCondicao,
  resultado: transicao.resultado,
  campo: transicao.campo,
  valorEsperado: transicao.valorEsperado,
  padrao: transicao.padrao,
  excecao: transicao.excecao
});

// Metadados de uma definição antiga (sem a lista de metadados):
// reconstruídos a partir dos campos das etapas.
export const metadadosDaDefinicao = (
  definicao: IFluxoDefinicao
): IFluxoMetadado[] => {

  if (definicao.metadados) {
    return definicao.metadados;
  }

  const lista: IFluxoMetadado[] = [];

  definicao.elementos.forEach(
    elemento => {
      elemento.campos.forEach(
        campo => {
          if (!lista.some(item => item.chave === campo.chave)) {
            lista.push({
              chave: campo.chave,
              rotulo: campo.rotulo,
              tipo: campo.tipo,
              opcoes: campo.opcoes,
              ajuda: campo.ajuda
            });
          }
        }
      );
    }
  );

  return lista;
};

// ------------------------------------------------------------
// Definição → XML BPMN (para abrir no editor visual)
// ------------------------------------------------------------

const escaparXml = (
  valor: string
): string =>
  (valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const definicaoParaBpmnXml = (
  definicao: IFluxoDefinicao
): string => {

  const linhasProcesso: string[] = [];
  const linhasDiagrama: string[] = [];

  definicao.elementos.forEach(
    elemento => {

      const tag =
        TIPO_BPMN_DO_FLUXO[elemento.tipo];

      const entradas =
        definicao.transicoes
          .filter(transicao => transicao.destinoId === elemento.id)
          .map(transicao => `      <bpmn:incoming>${transicao.id}</bpmn:incoming>`);

      const saidas =
        definicao.transicoes
          .filter(transicao => transicao.origemId === elemento.id)
          .map(transicao => `      <bpmn:outgoing>${transicao.id}</bpmn:outgoing>`);

      linhasProcesso.push(
        `    <${tag} id="${escaparXml(elemento.id)}" name="${escaparXml(elemento.nome)}">`,
        ...entradas,
        ...saidas,
        `    </${tag}>`
      );

      const p =
        elemento.posicao;

      linhasDiagrama.push(
        `      <bpmndi:BPMNShape id="${escaparXml(elemento.id)}_di" bpmnElement="${escaparXml(elemento.id)}">`,
        `        <dc:Bounds x="${p.x}" y="${p.y}" width="${p.largura}" height="${p.altura}" />`
      );

      if (elemento.rotuloPosicao) {
        const r = elemento.rotuloPosicao;
        linhasDiagrama.push(
          '        <bpmndi:BPMNLabel>',
          `          <dc:Bounds x="${r.x}" y="${r.y}" width="${r.largura}" height="${r.altura}" />`,
          '        </bpmndi:BPMNLabel>'
        );
      }

      linhasDiagrama.push('      </bpmndi:BPMNShape>');
    }
  );

  definicao.transicoes.forEach(
    transicao => {

      linhasProcesso.push(
        `    <bpmn:sequenceFlow id="${escaparXml(transicao.id)}" name="${escaparXml(transicao.rotulo || '')}" sourceRef="${escaparXml(transicao.origemId)}" targetRef="${escaparXml(transicao.destinoId)}" />`
      );

      linhasDiagrama.push(
        `      <bpmndi:BPMNEdge id="${escaparXml(transicao.id)}_di" bpmnElement="${escaparXml(transicao.id)}">`,
        ...transicao.pontos.map(
          ponto => `        <di:waypoint x="${ponto.x}" y="${ponto.y}" />`
        )
      );

      if (transicao.rotulo && transicao.rotuloPosicao) {
        const r = transicao.rotuloPosicao;
        linhasDiagrama.push(
          '        <bpmndi:BPMNLabel>',
          `          <dc:Bounds x="${r.x}" y="${r.y}" width="${Math.max(24, transicao.rotulo.length * 8)}" height="16" />`,
          '        </bpmndi:BPMNLabel>'
        );
      }

      linhasDiagrama.push('      </bpmndi:BPMNEdge>');
    }
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definicoes_Fluxo" targetNamespace="http://dgt.com.br/portal/fluxo">',
    '  <bpmn:process id="Processo_Fluxo" isExecutable="false">',
    ...linhasProcesso,
    '  </bpmn:process>',
    '  <bpmndi:BPMNDiagram id="Diagrama_Fluxo">',
    '    <bpmndi:BPMNPlane id="Plano_Fluxo" bpmnElement="Processo_Fluxo">',
    ...linhasDiagrama,
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>',
    '</bpmn:definitions>'
  ].join('\n');
};

// ------------------------------------------------------------
// Desenho + configurações → definição do fluxo
// ------------------------------------------------------------

export interface IDadosMontagem {
  // Rascunho atual (id, versão, status, processo...).
  base: IFluxoDefinicao;
  snapshot: IBpmnSnapshot;
  configsElementos: Record<string, IConfigElemento>;
  configsTransicoes: Record<string, IConfigTransicao>;
  metadados: IFluxoMetadado[];
  bpmnXml: string;
}

const MARGEM = 24;

// Sincroniza rótulo/tipo/opções do campo com o metadado do
// processo e descarta campos cujo metadado foi removido.
const camposSincronizados = (
  campos: IFluxoCampo[],
  metadados: IFluxoMetadado[]
): IFluxoCampo[] => {

  const resultado: IFluxoCampo[] = [];

  campos.forEach(
    campo => {
      const metadado =
        metadados.find(item => item.chave === campo.chave);

      if (metadado) {
        resultado.push({
          ...campo,
          rotulo: metadado.rotulo,
          tipo: metadado.tipo,
          opcoes: metadado.opcoes,
          colunas: metadado.colunas,
          ajuda: metadado.ajuda
        });
      }
    }
  );

  return resultado;
};

export const montarDefinicao = (
  dados: IDadosMontagem
): IFluxoDefinicao => {

  const avisos: string[] = [];

  const formasValidas: IBpmnForma[] = [];

  dados.snapshot.formas.forEach(
    forma => {

      if (TIPOS_IGNORADOS.indexOf(forma.tipo) >= 0) {
        return;
      }

      if (!tipoFluxoDoBpmn(forma.tipo)) {
        avisos.push(
          `O elemento "${forma.nome || forma.id}" (${NOME_TIPO_BPMN[forma.tipo] || forma.tipo}) ainda não é suportado. Use etapas, tarefas de sistema, decisões exclusivas, eventos de revisão, início e fim.`
        );
        return;
      }

      formasValidas.push(forma);
    }
  );

  const idsValidos =
    formasValidas.map(forma => forma.id);

  const conexoesValidas =
    dados.snapshot.conexoes.filter(
      conexao =>
        conexao.tipo === 'bpmn:SequenceFlow' &&
        idsValidos.indexOf(conexao.origemId) >= 0 &&
        idsValidos.indexOf(conexao.destinoId) >= 0
    );

  // Normaliza as coordenadas para começar perto de (MARGEM, MARGEM).
  const xs: number[] = [];
  const ys: number[] = [];
  const xsFim: number[] = [];
  const ysFim: number[] = [];

  formasValidas.forEach(
    forma => {
      xs.push(forma.x);
      ys.push(forma.y);
      xsFim.push(forma.x + forma.largura);
      ysFim.push(forma.y + forma.altura);

      if (forma.rotulo) {
        xs.push(forma.rotulo.x);
        ys.push(forma.rotulo.y);
        xsFim.push(forma.rotulo.x + forma.rotulo.largura);
        ysFim.push(forma.rotulo.y + forma.rotulo.altura);
      }
    }
  );

  conexoesValidas.forEach(
    conexao => {
      conexao.pontos.forEach(
        ponto => {
          xs.push(ponto.x);
          ys.push(ponto.y);
          xsFim.push(ponto.x);
          ysFim.push(ponto.y);
        }
      );

      if (conexao.rotulo) {
        xs.push(conexao.rotulo.x);
        ys.push(conexao.rotulo.y);
        xsFim.push(conexao.rotulo.x + conexao.rotulo.largura);
        ysFim.push(conexao.rotulo.y + conexao.rotulo.altura);
      }
    }
  );

  const minX =
    xs.length > 0 ? Math.min(...xs) : 0;

  const minY =
    ys.length > 0 ? Math.min(...ys) : 0;

  const dx =
    MARGEM - minX;

  const dy =
    MARGEM - minY;

  const mover = (
    posicao: IFluxoPosicao
  ): IFluxoPosicao => ({
    x: Math.round(posicao.x + dx),
    y: Math.round(posicao.y + dy),
    largura: Math.round(posicao.largura),
    altura: Math.round(posicao.altura)
  });

  const elementos: IFluxoElemento[] =
    formasValidas.map(
      forma => {

        const tipo =
          tipoFluxoDoBpmn(forma.tipo) as TipoElementoFluxo;

        const config =
          dados.configsElementos[forma.id] ||
          configPadraoElemento(tipo);

        const humana =
          tipo === 'tarefaHumana';

        return {
          id: forma.id,
          tipo,
          nome:
            (forma.nome || '').trim() ||
            (tipo === 'inicio'
              ? 'Início'
              : tipo === 'fim'
                ? 'Fim'
                : tipo === 'eventoRevisao'
                  ? NOME_PADRAO_EVENTO_REVISAO[config.tipoRevisao || 'revisao']
                  : 'Etapa sem nome'),
          subtitulo: humana || tipo === 'tarefaSistema' ? config.subtitulo : undefined,
          instrucoes: humana ? config.instrucoes : undefined,
          prazoDiasUteis: humana ? config.prazoDiasUteis : undefined,
          responsaveis: humana ? config.responsaveis : [],
          acoes: humana ? (config.acoes as IFluxoAcao[]) : [],
          campos: humana ? camposSincronizados(config.campos, dados.metadados) : [],
          acaoSistema: tipo === 'tarefaSistema' ? config.acaoSistema : undefined,
          statusDocumento: humana ? config.statusDocumento : undefined,
          // Retreinamento da etapa "Vigente": decidido pelo fluxo
          // (FluxoEngine.retreinamentoDecididoNoFluxo).
          retreinamentoAoPublicar: undefined,
          tipoRevisao: tipo === 'eventoRevisao' ? (config.tipoRevisao || 'revisao') : undefined,
          posicao: mover({ x: forma.x, y: forma.y, largura: forma.largura, altura: forma.altura }),
          rotuloPosicao: forma.rotulo ? mover(forma.rotulo) : undefined
        };
      }
    );

  const transicoes: IFluxoTransicao[] =
    conexoesValidas.map(
      conexao => {

        const config =
          dados.configsTransicoes[conexao.id] ||
          configPadraoTransicao();

        return {
          id: conexao.id,
          origemId: conexao.origemId,
          destinoId: conexao.destinoId,
          rotulo: (conexao.nome || '').trim() || undefined,
          tipoCondicao: config.tipoCondicao,
          resultado: config.tipoCondicao === 'resultado' ? config.resultado : undefined,
          campo: config.tipoCondicao === 'campo' ? config.campo : undefined,
          valorEsperado: config.tipoCondicao === 'campo' ? config.valorEsperado : undefined,
          padrao: config.padrao,
          excecao: config.excecao,
          pontos: conexao.pontos.map(
            ponto => ({ x: Math.round(ponto.x + dx), y: Math.round(ponto.y + dy) })
          ),
          rotuloPosicao: conexao.rotulo
            ? { x: Math.round(conexao.rotulo.x + dx), y: Math.round(conexao.rotulo.y + dy) }
            : undefined
        };
      }
    );

  const largura =
    xsFim.length > 0 ? Math.ceil(Math.max(...xsFim) + dx + MARGEM) : 400;

  const altura =
    ysFim.length > 0 ? Math.ceil(Math.max(...ysFim) + dy + MARGEM) : 200;

  return {
    ...dados.base,
    larguraDiagrama: largura,
    alturaDiagrama: altura,
    elementos,
    transicoes,
    metadados: dados.metadados,
    bpmnXml: dados.bpmnXml,
    avisosModelagem: avisos
  };
};

// ------------------------------------------------------------
// Utilitário: texto → chave (ex.: "Exige retreino?" → "exigeRetreino")
// ------------------------------------------------------------

export const gerarChave = (
  texto: string,
  existentes: string[] = []
): string => {

  const partes =
    (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(parte => !!parte);

  let base =
    partes
      .map(
        (parte, indice) =>
          indice === 0
            ? parte.toLowerCase()
            : parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase()
      )
      .join('') || 'campo';

  if (/^[0-9]/.test(base)) {
    base = `c${base}`;
  }

  let chave =
    base;

  let contador =
    2;

  while (existentes.indexOf(chave) >= 0) {
    chave = `${base}${contador}`;
    contador++;
  }

  return chave;
};
