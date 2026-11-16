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
  },
  "controladoria": {
    "formato": "dgt-portal/dashboard@1",
    "titulo": "Controladoria — Orçamento consolidado",
    "descricao": "Orçado × executado de todas as áreas, resultado (DRE), desvios e aprovações do CONT-001",
    "filtros": {
      "ano": true,
      "area": true
    },
    "secoes": [
      {
        "pagina": "Visão geral",
        "titulo": "Resultado do ano",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Receita bruta",
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
            "titulo": "Receita Operacional Líquida",
            "fonte": "orcamento.dre",
            "medida": "executado",
            "agregacao": "soma",
            "filtro": {
              "indicadorId": "ROL"
            },
            "formato": "moeda",
            "comparar": {
              "medida": "orcado",
              "rotulo": "Orçado"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "Custos",
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
            "titulo": "Despesas",
            "fonte": "orcamento.dre",
            "medida": "executado",
            "agregacao": "soma",
            "filtro": {
              "indicadorId": "DESPESAS"
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
            "titulo": "EBITDA",
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
            "titulo": "Lucro Líquido",
            "fonte": "orcamento.dre",
            "medida": "executado",
            "agregacao": "soma",
            "filtro": {
              "indicadorId": "LL"
            },
            "formato": "moeda",
            "comparar": {
              "medida": "orcado",
              "rotulo": "Orçado"
            }
          }
        ]
      },
      {
        "pagina": "Visão geral",
        "titulo": "Tendência",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "linhas",
            "titulo": "EBITDA — orçado × executado",
            "fonte": "orcamento.dre",
            "dimensao": "mes",
            "filtro": {
              "indicadorId": "EBITDA"
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
          }
        ]
      },
      {
        "pagina": "Resultado (DRE)",
        "titulo": "Receita e custos no mês",
        "itens": [
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
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Custos — orçado × executado",
            "fonte": "orcamento.dre",
            "dimensao": "mes",
            "filtro": {
              "indicadorId": "CUSTOS"
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
        "pagina": "Resultado (DRE)",
        "titulo": "Linhas da DRE",
        "itens": [
          {
            "tipo": "tabela",
            "titulo": "DRE do ano",
            "fonte": "orcamento.dre",
            "dimensoes": [
              "indicador"
            ],
            "filtro": {
              "indicadorId": [
                "RECEITA BRUTA",
                "DEDUCOES",
                "ROL",
                "CUSTOS",
                "LB",
                "DESPESAS",
                "LO",
                "LAIR",
                "LL",
                "EBITDA"
              ]
            },
            "medidas": [
              {
                "medida": "orcado",
                "rotulo": "Orçado"
              },
              {
                "medida": "executado",
                "rotulo": "Executado"
              }
            ],
            "ordenar": "nenhum",
            "formato": "moeda",
            "largura": 2
          }
        ]
      },
      {
        "pagina": "Por área",
        "titulo": "Comparativo entre áreas",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "EBITDA por área",
            "fonte": "orcamento.dre",
            "dimensao": "area",
            "filtro": {
              "indicadorId": "EBITDA"
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
            "ordenar": "valor desc",
            "limite": 12,
            "formato": "moeda"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Despesas por área",
            "fonte": "orcamento.dre",
            "dimensao": "area",
            "filtro": {
              "indicadorId": "DESPESAS"
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
            "ordenar": "valor asc",
            "limite": 12,
            "formato": "moeda"
          },
          {
            "tipo": "grafico",
            "grafico": "barrasEmpilhadas",
            "titulo": "Receita bruta executada por área, mês a mês",
            "fonte": "orcamento.dre",
            "dimensao": "mes",
            "serieDimensao": "area",
            "filtro": {
              "indicadorId": "RECEITA BRUTA"
            },
            "series": [
              {
                "medida": "executado",
                "rotulo": "Executado"
              }
            ],
            "formato": "moeda",
            "largura": 2
          }
        ]
      },
      {
        "pagina": "Desvios",
        "titulo": "Onde o executado se afasta do orçado",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Orçado por grupo de contas",
            "fonte": "orcamento.linhas",
            "dimensao": "grupo",
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
            "ordenar": "valor asc",
            "limite": 10,
            "formato": "moeda",
            "largura": 2
          },
          {
            "tipo": "tabela",
            "titulo": "Top 12 contas — maior desvio (executado − orçado)",
            "fonte": "orcamento.linhas",
            "dimensoes": [
              "area",
              "codigo",
              "conta"
            ],
            "medidas": [
              {
                "medida": "diferenca",
                "rotulo": "Diferença"
              },
              {
                "medida": "orcado",
                "rotulo": "Orçado"
              },
              {
                "medida": "executado",
                "rotulo": "Executado"
              }
            ],
            "ordenar": "valor asc",
            "limite": 12,
            "formato": "moeda",
            "largura": 2
          }
        ]
      },
      {
        "pagina": "Aprovações",
        "titulo": "Andamento do CONT-001",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Planilhas no ano",
            "fonte": "orcamento.planilhas",
            "medida": "planilhas",
            "agregacao": "soma",
            "formato": "inteiro"
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
          },
          {
            "tipo": "cartao",
            "titulo": "Maior atraso (dias úteis)",
            "fonte": "orcamento.planilhas",
            "medida": "diasAtraso",
            "agregacao": "maximo",
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "rosca",
            "titulo": "Planilhas por situação",
            "fonte": "orcamento.planilhas",
            "dimensao": "situacao",
            "series": [
              {
                "medida": "planilhas",
                "rotulo": "Planilhas"
              }
            ],
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Planilhas por etapa do fluxo",
            "fonte": "orcamento.planilhas",
            "dimensao": "etapa",
            "series": [
              {
                "medida": "planilhas",
                "rotulo": "Planilhas"
              }
            ],
            "ordenar": "valor desc",
            "formato": "inteiro"
          }
        ]
      },
      {
        "pagina": "Aprovações",
        "titulo": "Planilhas por área",
        "itens": [
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
              "totalOrcado",
              "totalExecutado"
            ],
            "ordenar": "diasAtraso desc",
            "formato": "moeda",
            "largura": 2
          }
        ]
      }
    ],
    "assistente": {
      "ativo": true,
      "escopo": "Painel da Controladoria sobre o planejamento orçamentário (processo CONT-001). Responda sobre orçado × executado por área, conta e mês, linhas da DRE (Receita Bruta, ROL, Custos, Despesas, Lucro Bruto, LAIR, EBITDA, Lucro Líquido), desvios entre executado e orçado e o andamento das aprovações das planilhas (situação, etapa e atrasos). Não faça projeções fiscais nem dê parecer contábil, tributário ou jurídico; aponte o que os números mostram e o que vale conferir.",
      "fontes": [
        "orcamento.dre",
        "orcamento.planilhas",
        "orcamento.linhas"
      ],
      "perguntasSugeridas": [
        "Resuma o resultado do ano em 5 pontos.",
        "Quais áreas estão com EBITDA abaixo do orçado?",
        "Quais contas explicam o maior desvio de despesas?",
        "Em que meses o Lucro Líquido ficou mais distante do orçado?",
        "Quais planilhas estão atrasadas e em qual etapa?"
      ]
    }
  },
  "treinamentos": {
    "formato": "dgt-portal/dashboard@1",
    "titulo": "Treinamentos — conformidade das equipes",
    "descricao": "Atribuições, prazos, validade, trilhas, avaliações e certificados por área",
    "filtros": {
      "ano": true,
      "area": true
    },
    "secoes": [
      {
        "pagina": "Visão geral",
        "titulo": "Conformidade no ano",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Treinamentos atribuídos",
            "fonte": "treinamentos.atribuicoes",
            "medida": "atribuicoes",
            "agregacao": "soma",
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Concluídos",
            "fonte": "treinamentos.atribuicoes",
            "medida": "atribuicoes",
            "agregacao": "soma",
            "filtro": {
              "concluido": "Sim"
            },
            "formato": "inteiro",
            "comparar": {
              "medida": "atribuicoes",
              "rotulo": "Atribuídos"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "Atrasados",
            "fonte": "treinamentos.atribuicoes",
            "medida": "atribuicoes",
            "agregacao": "soma",
            "filtro": {
              "situacaoPrazo": "Vencido"
            },
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Validade vencida",
            "fonte": "treinamentos.atribuicoes",
            "medida": "atribuicoes",
            "agregacao": "soma",
            "filtro": {
              "situacaoValidade": "Vencido"
            },
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Vencem em 30 dias",
            "fonte": "treinamentos.atribuicoes",
            "medida": "atribuicoes",
            "agregacao": "soma",
            "filtro": {
              "situacaoValidade": "Vence em 30 dias"
            },
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barrasEmpilhadas",
            "titulo": "Concluídos × pendentes por área",
            "fonte": "treinamentos.atribuicoes",
            "dimensao": "area",
            "serieDimensao": "concluido",
            "series": [
              {
                "medida": "atribuicoes",
                "rotulo": "Treinamentos"
              }
            ],
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "rosca",
            "titulo": "Situação do prazo",
            "fonte": "treinamentos.atribuicoes",
            "dimensao": "situacaoPrazo",
            "series": [
              {
                "medida": "atribuicoes",
                "rotulo": "Treinamentos"
              }
            ],
            "formato": "inteiro"
          }
        ]
      },
      {
        "pagina": "Pendências",
        "titulo": "O que cobrar",
        "itens": [
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Atrasados por treinamento",
            "fonte": "treinamentos.atribuicoes",
            "dimensao": "treinamento",
            "filtro": {
              "situacaoPrazo": "Vencido"
            },
            "series": [
              {
                "medida": "atribuicoes",
                "rotulo": "Atrasados"
              }
            ],
            "limite": 10,
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Validade vencida ou vencendo por área",
            "fonte": "treinamentos.atribuicoes",
            "dimensao": "area",
            "filtro": {
              "situacaoValidade": [
                "Vencido",
                "Vence em 30 dias"
              ]
            },
            "series": [
              {
                "medida": "atribuicoes",
                "rotulo": "Treinamentos"
              }
            ],
            "formato": "inteiro"
          },
          {
            "tipo": "tabela",
            "titulo": "Treinamentos atrasados",
            "fonte": "treinamentos.atribuicoes",
            "filtro": {
              "situacaoPrazo": "Vencido"
            },
            "colunas": [
              "area",
              "usuario",
              "treinamento",
              "status",
              "diasAtraso"
            ],
            "ordenar": "diasAtraso desc",
            "limite": 20,
            "largura": 2
          }
        ]
      },
      {
        "pagina": "Trilhas",
        "titulo": "Trilhas de capacitação",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Trilhas atribuídas",
            "fonte": "treinamentos.trilhas",
            "medida": "trilhas",
            "agregacao": "soma",
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Trilhas concluídas",
            "fonte": "treinamentos.trilhas",
            "medida": "trilhas",
            "agregacao": "soma",
            "filtro": {
              "concluida": "Sim"
            },
            "formato": "inteiro",
            "comparar": {
              "medida": "trilhas",
              "rotulo": "Atribuídas"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "Obrigatórias atrasadas",
            "fonte": "treinamentos.trilhas",
            "medida": "trilhas",
            "agregacao": "soma",
            "filtro": {
              "obrigatoria": "Sim",
              "situacaoPrazo": "Vencido"
            },
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barrasEmpilhadas",
            "titulo": "Andamento por trilha",
            "fonte": "treinamentos.trilhas",
            "dimensao": "trilha",
            "serieDimensao": "concluida",
            "series": [
              {
                "medida": "trilhas",
                "rotulo": "Trilhas"
              }
            ],
            "limite": 12,
            "formato": "inteiro",
            "largura": 2
          }
        ]
      },
      {
        "pagina": "Avaliações",
        "titulo": "Desempenho nas avaliações",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Tentativas",
            "fonte": "treinamentos.avaliacoes",
            "medida": "tentativas",
            "agregacao": "soma",
            "formato": "inteiro"
          },
          {
            "tipo": "cartao",
            "titulo": "Aprovações",
            "fonte": "treinamentos.avaliacoes",
            "medida": "aprovacoes",
            "agregacao": "soma",
            "formato": "inteiro",
            "comparar": {
              "medida": "tentativas",
              "rotulo": "Tentativas"
            }
          },
          {
            "tipo": "cartao",
            "titulo": "Nota média",
            "fonte": "treinamentos.avaliacoes",
            "medida": "nota",
            "agregacao": "media",
            "formato": "numero"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Nota média por treinamento",
            "fonte": "treinamentos.avaliacoes",
            "dimensao": "treinamento",
            "series": [
              {
                "medida": "nota",
                "agregacao": "media",
                "rotulo": "Nota média"
              }
            ],
            "ordenar": "valor asc",
            "limite": 10,
            "formato": "numero"
          },
          {
            "tipo": "grafico",
            "grafico": "linhas",
            "titulo": "Tentativas e aprovações por mês",
            "fonte": "treinamentos.avaliacoes",
            "dimensao": "mes",
            "series": [
              {
                "medida": "tentativas",
                "rotulo": "Tentativas"
              },
              {
                "medida": "aprovacoes",
                "rotulo": "Aprovações"
              }
            ],
            "formato": "inteiro"
          }
        ]
      },
      {
        "pagina": "Certificados",
        "titulo": "Certificados emitidos",
        "itens": [
          {
            "tipo": "cartao",
            "titulo": "Certificados no ano",
            "fonte": "treinamentos.certificados",
            "medida": "certificados",
            "agregacao": "soma",
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "barras",
            "titulo": "Certificados por mês",
            "fonte": "treinamentos.certificados",
            "dimensao": "mes",
            "series": [
              {
                "medida": "certificados",
                "rotulo": "Certificados"
              }
            ],
            "formato": "inteiro"
          },
          {
            "tipo": "grafico",
            "grafico": "rosca",
            "titulo": "Validade dos certificados",
            "fonte": "treinamentos.certificados",
            "dimensao": "situacaoValidade",
            "series": [
              {
                "medida": "certificados",
                "rotulo": "Certificados"
              }
            ],
            "formato": "inteiro"
          }
        ]
      }
    ],
    "assistente": {
      "ativo": true,
      "escopo": "Painel de conformidade de treinamentos das equipes. Responda sobre treinamentos atribuídos, concluídos e atrasados, validade (vencidos e vencendo), trilhas, desempenho nas avaliações e certificados, por área, treinamento e mês. Não avalie nem compare pessoas individualmente; aponte treinamentos e áreas que precisam de atenção.",
      "fontes": [
        "treinamentos.atribuicoes",
        "treinamentos.trilhas",
        "treinamentos.avaliacoes",
        "treinamentos.certificados"
      ],
      "perguntasSugeridas": [
        "Quais áreas têm mais treinamentos atrasados?",
        "Quais treinamentos estão com validade vencida ou vencendo?",
        "Qual a taxa de conclusão por área?",
        "Em quais treinamentos a nota média nas avaliações é mais baixa?",
        "Quantas trilhas obrigatórias estão atrasadas?"
      ]
    }
  }
};
