import {
  IFluxoDefinicao,
  IFluxoModelo
} from '../../../models/Fluxo';

// ============================================================
// MODELO "REVISÃO DE POP / PROCEDIMENTO" (definição de TESTE)
//
//   Início
//     → Elaboração (autor da revisão)
//     → Revisão técnica (gestor da área do documento)
//     → [Parecer técnico?]
//          ├─ Ajustes   → volta para Elaboração
//          └─ OK        → Aprovação da Qualidade
//                            ├─ Reprovado → volta para Elaboração
//                            └─ Aprovado  → [Exige retreino?]
//                                              ├─ Sim → Publicar + retreinamento
//                                              └─ Não → Publicar e registrar dispensa
//     → Fim
//
// É um MODELO: cada processo cria o seu próprio fluxo a partir
// dele (módulo Processos) e pode ajustar prazos, responsáveis,
// instruções e ações antes de publicar.
// ============================================================

export const FLUXO_POP_PROCEDIMENTO_V2: IFluxoDefinicao = {

  id: 'fluxo-pop-procedimento',

  nome: 'POP / Procedimento',

  versao: 2,

  status: 'publicado',

  tiposDocumento: [
    'POP',
    'Procedimento',
    'Instrução de Trabalho',
    'Política',
    'Norma',
    'Manual',
    'Documento corporativo'
  ],

  larguraDiagrama: 1280,

  alturaDiagrama: 392,

  elementos: [

    {
      id: 'inicio',
      tipo: 'inicio',
      nome: 'Início',
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 24, y: 166, largura: 48, altura: 48 }
    },

    {
      id: 'elaboracao',
      tipo: 'tarefaHumana',
      nome: 'Elaboração',
      subtitulo: 'Autor da revisão',
      instrucoes:
        'Atualize o arquivo no SharePoint e descreva o que mudou antes de enviar.',
      prazoDiasUteis: 5,
      responsaveis: [
        {
          tipo: 'autorRevisao',
          descricao: 'Autor da revisão',
          papelTeste: 'autor'
        }
      ],
      acoes: [
        {
          chave: 'enviarRevisaoTecnica',
          rotulo: 'Enviar para revisão técnica',
          resultado: 'enviado',
          principal: true,
          exigeComentario: false
        }
      ],
      campos: [],
      posicao: { x: 120, y: 150, largura: 136, altura: 80 }
    },

    {
      id: 'revisaoTecnica',
      tipo: 'tarefaHumana',
      nome: 'Revisão técnica',
      subtitulo: 'Gestor da área',
      instrucoes:
        'Confira se o conteúdo técnico está correto. Para devolver, o comentário é obrigatório.',
      prazoDiasUteis: 3,
      responsaveis: [
        {
          tipo: 'gestorArea',
          descricao: 'Gestor da área do documento',
          papelTeste: 'coordenacao'
        }
      ],
      acoes: [
        {
          chave: 'aprovarTecnicamente',
          rotulo: 'Aprovar tecnicamente',
          resultado: 'aprovado',
          principal: true,
          exigeComentario: false
        },
        {
          chave: 'solicitarAjustes',
          rotulo: 'Solicitar ajustes',
          resultado: 'ajustes',
          principal: false,
          exigeComentario: true
        }
      ],
      campos: [],
      posicao: { x: 304, y: 150, largura: 136, altura: 80 }
    },

    {
      id: 'gatewayParecer',
      tipo: 'gateway',
      nome: 'Parecer técnico?',
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 488, y: 138, largura: 120, altura: 104 }
    },

    {
      id: 'aprovacaoQualidade',
      tipo: 'tarefaHumana',
      nome: 'Aprovação',
      subtitulo: 'Qualidade',
      instrucoes:
        'Aprove a revisão e responda se ela exige retreinamento. A resposta decide o caminho seguinte.',
      prazoDiasUteis: 2,
      responsaveis: [
        {
          tipo: 'funcao',
          referenciaId: '',
          descricao: 'Função: Analista da Qualidade',
          papelTeste: 'qualidade'
        }
      ],
      acoes: [
        {
          chave: 'aprovarPublicar',
          rotulo: 'Aprovar e publicar',
          resultado: 'aprovado',
          principal: true,
          exigeComentario: false,
          mensagemConfirmacao:
            'Confirmar a aprovação? A revisão seguirá para publicação.'
        },
        {
          chave: 'reprovar',
          rotulo: 'Reprovar',
          resultado: 'reprovado',
          principal: false,
          exigeComentario: true
        }
      ],
      campos: [
        {
          chave: 'retreinamento',
          rotulo: 'Esta revisão exige retreinamento?',
          tipo: 'simNao',
          obrigatorio: true,
          validarNosResultados: ['aprovado'],
          ajuda:
            'Sim: gera retreinamento com origem "Revisão documental" para quem foi treinado na revisão anterior.'
        },
        {
          chave: 'justificativaRetreinamento',
          rotulo: 'Justificativa da dispensa de retreinamento',
          tipo: 'texto',
          obrigatorio: false,
          obrigatorioQuando: {
            campo: 'retreinamento',
            valor: 'nao'
          },
          validarNosResultados: ['aprovado']
        }
      ],
      posicao: { x: 656, y: 150, largura: 136, altura: 80 }
    },

    {
      id: 'gatewayRetreino',
      tipo: 'gateway',
      nome: 'Exige retreino?',
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 840, y: 138, largura: 120, altura: 104 }
    },

    {
      id: 'publicarComRetreinamento',
      tipo: 'tarefaSistema',
      nome: 'Publicar + retreino',
      subtitulo: 'Tarefa de sistema',
      acaoSistema: 'publicarComRetreinamento',
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 1008, y: 60, largura: 152, altura: 80 }
    },

    {
      id: 'publicarSemRetreinamento',
      tipo: 'tarefaSistema',
      nome: 'Publicar sem retreino',
      subtitulo: 'Registra a dispensa',
      acaoSistema: 'publicarSemRetreinamento',
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 1008, y: 240, largura: 152, altura: 80 }
    },

    {
      id: 'fim',
      tipo: 'fim',
      nome: 'Fim',
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: { x: 1208, y: 166, largura: 48, altura: 48 }
    }
  ],

  transicoes: [

    {
      id: 't-inicio-elaboracao',
      origemId: 'inicio',
      destinoId: 'elaboracao',
      tipoCondicao: 'sempre',
      padrao: true,
      excecao: false,
      pontos: [{ x: 72, y: 190 }, { x: 118, y: 190 }]
    },

    {
      id: 't-elaboracao-revisao',
      origemId: 'elaboracao',
      destinoId: 'revisaoTecnica',
      tipoCondicao: 'resultado',
      resultado: 'enviado',
      padrao: true,
      excecao: false,
      pontos: [{ x: 256, y: 190 }, { x: 302, y: 190 }]
    },

    {
      id: 't-revisao-gateway',
      origemId: 'revisaoTecnica',
      destinoId: 'gatewayParecer',
      tipoCondicao: 'sempre',
      padrao: true,
      excecao: false,
      pontos: [{ x: 440, y: 190 }, { x: 486, y: 190 }]
    },

    {
      id: 't-parecer-aprovacao',
      origemId: 'gatewayParecer',
      destinoId: 'aprovacaoQualidade',
      rotulo: 'OK',
      tipoCondicao: 'resultado',
      resultado: 'aprovado',
      padrao: false,
      excecao: false,
      pontos: [{ x: 608, y: 190 }, { x: 654, y: 190 }],
      rotuloPosicao: { x: 616, y: 162 }
    },

    {
      id: 't-parecer-ajustes',
      origemId: 'gatewayParecer',
      destinoId: 'elaboracao',
      rotulo: 'Ajustes',
      tipoCondicao: 'resultado',
      resultado: 'ajustes',
      padrao: false,
      excecao: true,
      pontos: [
        { x: 548, y: 242 },
        { x: 548, y: 336 },
        { x: 188, y: 336 },
        { x: 188, y: 232 }
      ],
      rotuloPosicao: { x: 560, y: 281 }
    },

    {
      id: 't-aprovacao-gateway',
      origemId: 'aprovacaoQualidade',
      destinoId: 'gatewayRetreino',
      tipoCondicao: 'resultado',
      resultado: 'aprovado',
      padrao: false,
      excecao: false,
      pontos: [{ x: 792, y: 190 }, { x: 838, y: 190 }]
    },

    {
      id: 't-aprovacao-reprovada',
      origemId: 'aprovacaoQualidade',
      destinoId: 'elaboracao',
      rotulo: 'Reprovado',
      tipoCondicao: 'resultado',
      resultado: 'reprovado',
      padrao: false,
      excecao: true,
      pontos: [
        { x: 724, y: 230 },
        { x: 724, y: 336 },
        { x: 188, y: 336 },
        { x: 188, y: 232 }
      ],
      rotuloPosicao: { x: 736, y: 275 }
    },

    {
      id: 't-retreino-sim',
      origemId: 'gatewayRetreino',
      destinoId: 'publicarComRetreinamento',
      rotulo: 'Sim',
      tipoCondicao: 'campo',
      campo: 'retreinamento',
      valorEsperado: 'sim',
      padrao: false,
      excecao: false,
      pontos: [
        { x: 900, y: 138 },
        { x: 900, y: 100 },
        { x: 1006, y: 100 }
      ],
      rotuloPosicao: { x: 912, y: 111 }
    },

    {
      id: 't-retreino-nao',
      origemId: 'gatewayRetreino',
      destinoId: 'publicarSemRetreinamento',
      rotulo: 'Não',
      tipoCondicao: 'campo',
      campo: 'retreinamento',
      valorEsperado: 'nao',
      padrao: false,
      excecao: false,
      pontos: [
        { x: 900, y: 242 },
        { x: 900, y: 280 },
        { x: 1006, y: 280 }
      ],
      rotuloPosicao: { x: 912, y: 253 }
    },

    {
      id: 't-publicar-sim-fim',
      origemId: 'publicarComRetreinamento',
      destinoId: 'fim',
      tipoCondicao: 'sempre',
      padrao: true,
      excecao: false,
      pontos: [
        { x: 1160, y: 100 },
        { x: 1232, y: 100 },
        { x: 1232, y: 164 }
      ]
    },

    {
      id: 't-publicar-nao-fim',
      origemId: 'publicarSemRetreinamento',
      destinoId: 'fim',
      tipoCondicao: 'sempre',
      padrao: true,
      excecao: false,
      pontos: [
        { x: 1160, y: 280 },
        { x: 1232, y: 280 },
        { x: 1232, y: 216 }
      ]
    }
  ]
};

// Modelos disponíveis para criar o fluxo de um processo.
// A definição acima também continua resolvendo simulações antigas,
// iniciadas antes de o fluxo passar a pertencer ao processo.
export const FLUXO_MODELOS: IFluxoModelo[] = [
  {
    id: 'modelo-revisao-pop',
    nome: 'Revisão de POP / Procedimento',
    descricao:
      'Elaboração → Revisão técnica (gestor da área) → Aprovação da Qualidade → decisão de retreinamento → Publicação.',
    definicao: FLUXO_POP_PROCEDIMENTO_V2
  }
];
