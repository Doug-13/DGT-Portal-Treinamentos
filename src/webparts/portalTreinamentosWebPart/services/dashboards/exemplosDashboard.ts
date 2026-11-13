// ============================================================
// EXEMPLOS DE DASHBOARDS DO PORTAL (iguais aos da skill
// "dashboard-dgt" e a docs/dashboards/exemplos). Usados nos testes e
// no botão "Usar exemplo" de Gerenciar dashboards.
// ============================================================

import {
  IDefinicaoDashboard
} from './dashboardModelo';

export const EXEMPLOS_DASHBOARD: { [nome: string]: IDefinicaoDashboard } = {
  "orcamento-area": {
    "formato": "dgt-portal/dashboard@1",
    "titulo": "Orçamento da área",
    "descricao": "Orçado × executado no ano, resultado e principais contas",
    "filtros": {
      "ano": true,
      "area": true
    },
    "secoes": [
      {
        "titulo": "Resumo do ano",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Receita bruta executada",
            "fonte": "orcamento.dre",
            "medida": "executado",
            "agregacao": "soma",
            "filtro": {
              "indicadorId": "RECEITA BRUTA"
            },
            "formato": "moeda",
            "comparar": {
              "medida": "orcado",
              "rotulo": "Orçado"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "Custos de operação executados",
            "fonte": "orcamento.dre",
            "medida": "executado",
            "agregacao": "soma",
            "filtro": {
              "indicadorId": "CUSTOS"
            },
            "formato": "moeda",
            "comparar": {
              "medida": "orcado",
              "rotulo": "Orçado",
              "direcao": "menor"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "EBITDA executado",
            "fonte": "orcamento.dre",
            "medida": "executado",
            "agregacao": "soma",
            "filtro": {
              "indicadorId": "EBITDA"
            },
            "formato": "moeda",
            "comparar": {
              "medida": "orcado",
              "rotulo": "Orçado"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "Planilhas atrasadas",
            "fonte": "orcamento.planilhas",
            "medida": "planilhas",
            "agregacao": "soma",
            "filtro": {
              "atrasada": "Sim"
            },
            "formato": "inteiro"
          }
        ]
      },
      {
        "titulo": "Evolução mensal",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "linhas",
            "titulo": "Lucro Líquido — orçado × executado",
            "fonte": "orcamento.dre",
            "dimensao": "mes",
            "filtro": {
              "indicadorId": "LL"
            },
            "series": [
              {
                "medida": "orcado",
                "rotulo": "Orçado"
              },
              {
                "medida": "executado",
                "rotulo": "Executado"
              }
            ],
            "formato": "moeda"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Receita bruta — orçado × executado",
            "fonte": "orcamento.dre",
            "dimensao": "mes",
            "filtro": {
              "indicadorId": "RECEITA BRUTA"
            },
            "series": [
              {
                "medida": "orcado",
                "rotulo": "Orçado"
              },
              {
                "medida": "executado",
                "rotulo": "Executado"
              }
            ],
            "formato": "moeda"
          }
        ]
      },
      {
        "titulo": "Onde está o orçamento",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Orçado por grupo",
            "fonte": "orcamento.linhas",
            "dimensao": "grupo",
            "series": [
              {
                "medida": "orcado",
                "rotulo": "Orçado"
              }
            ],
            "ordenar": "valor asc",
            "limite": 10,
            "formato": "moeda"
          },
          {
            "tipo": "tabela",
            "titulo": "Top 10 contas (maior orçado)",
            "fonte": "orcamento.linhas",
            "dimensoes": [
              "codigo",
              "conta"
            ],
            "medidas": [
              {
                "medida": "orcado",
                "rotulo": "Orçado"
              },
              {
                "medida": "executado",
                "rotulo": "Executado"
              },
              {
                "medida": "diferenca",
                "rotulo": "Diferença"
              }
            ],
            "ordenar": "valor asc",
            "limite": 10,
            "formato": "moeda"
          },
          {
            "tipo": "tabela",
            "titulo": "Situação das planilhas",
            "fonte": "orcamento.planilhas",
            "colunas": [
              "area",
              "situacao",
              "etapa",
              "atrasada",
              "diasAtraso",
              "totalOrcado"
            ],
            "ordenar": "area asc",
            "formato": "moeda",
            "largura": 2
          }
        ]
      }
    ]
  },
  "documentos-area": {
    "formato": "dgt-portal/dashboard@1",
    "titulo": "Documentos da área",
    "descricao": "Situação dos documentos, prazos de revisão e revisões em andamento",
    "filtros": {
      "ano": false,
      "area": true
    },
    "secoes": [
      {
        "titulo": "Resumo",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Documentos ativos",
            "fonte": "documentos.documentos",
            "medida": "documentos",
            "agregacao": "soma",
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Revisão vencida",
            "fonte": "documentos.documentos",
            "medida": "documentos",
            "agregacao": "soma",
            "filtro": {
              "situacaoPrazo": "Vencido"
            },
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Vencem em 30 dias",
            "fonte": "documentos.documentos",
            "medida": "documentos",
            "agregacao": "soma",
            "filtro": {
              "situacaoPrazo": "Vence em 30 dias"
            },
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Revisões em andamento",
            "fonte": "documentos.revisoes",
            "medida": "revisoes",
            "agregacao": "soma",
            "formato": "inteiro"
          }
        ]
      },
      {
        "titulo": "Distribuição",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "rosca",
            "titulo": "Situação dos prazos de revisão",
            "fonte": "documentos.documentos",
            "dimensao": "situacaoPrazo",
            "series": [
              {
                "medida": "documentos",
                "rotulo": "Documentos"
              }
            ],
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barrasEmpilhadas",
            "titulo": "Documentos por tipo e situação do prazo",
            "fonte": "documentos.documentos",
            "dimensao": "tipo",
            "serieDimensao": "situacaoPrazo",
            "series": [
              {
                "medida": "documentos"
              }
            ],
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Revisões em andamento por status",
            "fonte": "documentos.revisoes",
            "dimensao": "status",
            "series": [
              {
                "medida": "revisoes",
                "rotulo": "Revisões"
              }
            ],
            "formato": "inteiro"
          }
        ]
      },
      {
        "titulo": "Atenção",
        "itens": [
          {
            "tipo": "tabela",
            "titulo": "Documentos com revisão vencida ou vencendo",
            "fonte": "documentos.documentos",
            "filtro": {
              "situacaoPrazo": [
                "Vencido",
                "Vence em 30 dias"
              ]
            },
            "colunas": [
              "codigo",
              "titulo",
              "area",
              "responsavel",
              "prazoRevisao",
              "diasParaRevisao",
              "situacaoPrazo"
            ],
            "ordenar": "diasParaRevisao asc",
            "formato": "inteiro",
            "largura": 2
          },
          {
            "tipo": "tabela",
            "titulo": "Revisões abertas há mais tempo",
            "fonte": "documentos.revisoes",
            "colunas": [
              "codigo",
              "titulo",
              "revisao",
              "status",
              "responsavel",
              "diasEmAberto"
            ],
            "ordenar": "diasEmAberto desc",
            "limite": 15,
            "formato": "inteiro",
            "largura": 2
          }
        ]
      }
    ]
  },
  "consumo-ia": {
    "formato": "dgt-portal/dashboard@1",
    "titulo": "Consumo de IA",
    "descricao": "Uso da IA do portal por área, usuário e funcionalidade: chamadas, tokens e custo",
    "filtros": {
      "ano": true,
      "area": true
    },
    "secoes": [
      {
        "titulo": "Resumo do ano",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Custo no ano (US$)",
            "fonte": "ia.consumo",
            "medida": "custoUsd",
            "agregacao": "soma",
            "formato": "numero"
          },
          {
            "tipo": "cartao",
            "titulo": "Custo no ano (R$)",
            "fonte": "ia.consumo",
            "medida": "custoBrl",
            "agregacao": "soma",
            "formato": "moeda"
          },
          {
            "tipo": "cartao",
            "titulo": "Chamadas à IA",
            "fonte": "ia.consumo",
            "medida": "chamadas",
            "agregacao": "soma",
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Usuários que usaram",
            "fonte": "ia.consumo",
            "medida": "usuario",
            "agregacao": "contagemDistinta",
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Chamadas sem área definida",
            "fonte": "ia.consumo",
            "medida": "chamadas",
            "agregacao": "soma",
            "filtro": {
              "origemArea": "Sem área"
            },
            "formato": "inteiro"
          }
        ]
      },
      {
        "titulo": "Por área",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Custo por área (US$)",
            "fonte": "ia.consumo",
            "dimensao": "area",
            "series": [
              {
                "medida": "custoUsd",
                "rotulo": "US$"
              }
            ],
            "ordenar": "valor desc",
            "formato": "numero"
          },
          {
            "tipo": "grafico",
            "grafico": "barrasEmpilhadas",
            "titulo": "Custo mês a mês por área (US$)",
            "fonte": "ia.consumo",
            "dimensao": "mes",
            "serieDimensao": "area",
            "series": [
              {
                "medida": "custoUsd",
                "rotulo": "US$"
              }
            ],
            "formato": "numero",
            "largura": 2
          }
        ]
      },
      {
        "titulo": "Por usuário e funcionalidade",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "rosca",
            "titulo": "Custo por funcionalidade (US$)",
            "fonte": "ia.consumo",
            "dimensao": "funcionalidade",
            "series": [
              {
                "medida": "custoUsd",
                "rotulo": "US$"
              }
            ],
            "formato": "numero"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Custo por modelo (US$)",
            "fonte": "ia.consumo",
            "dimensao": "modelo",
            "series": [
              {
                "medida": "custoUsd",
                "rotulo": "US$"
              }
            ],
            "ordenar": "valor desc",
            "formato": "numero"
          },
          {
            "tipo": "tabela",
            "titulo": "Maiores consumidores",
            "fonte": "ia.consumo",
            "dimensoes": [
              "usuario",
              "area"
            ],
            "medidas": [
              {
                "medida": "custoUsd",
                "rotulo": "Custo (US$)"
              },
              {
                "medida": "chamadas",
                "rotulo": "Chamadas"
              },
              {
                "medida": "tokensEntrada",
                "rotulo": "Tokens de entrada"
              },
              {
                "medida": "tokensSaida",
                "rotulo": "Tokens de saída"
              }
            ],
            "ordenar": "valor desc",
            "limite": 20,
            "formato": "numero",
            "largura": 2
          }
        ]
      }
    ]
  }
};
