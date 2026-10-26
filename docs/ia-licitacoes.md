# Licitações — análise por IA

## Visão geral

```
Busca no PNCP
  └─ edital JÁ TEM PARECER? ──► sim: mostra a marcação (Participar / Não participar), sem gastar IA
                             └─► não: cache tem análise? ──► sim: mostra
                                                          └─► não: analisa (fila, 1 por vez)
```

| Peça | Arquivo |
|---|---|
| Tipos | `models/LicitacaoIa.ts` |
| Provedores (simulado / API) | `services/ia/provedoresIa.ts` |
| Prompts com versões (`dgt_iaprompt`) | `services/ia/PromptIaService.ts` |
| Montagem do prompt + histórico + cache (`dgt_licitacaoanaliseia`) | `services/ia/LicitacaoAnaliseIaService.ts` |
| Fila e estado na tela | `hooks/useAnaliseIaLicitacoes.ts` |
| Tela | `pages/Licitacoes/AnaliseIaLicitacao.tsx`, `ConfigurarIaModal.tsx` |
| Tabelas e Custom API | `scripts/dataverse/criar-tabelas-ia-licitacoes.ps1` |
| Chamada ao Claude | `server/DGT.Treinamentos.Plugins/AnalisarLicitacaoIaPlugin.cs` |

## O histórico como base da IA

Para cada edital, os **pareceres vigentes** da DGT (`dgt_licitacaoparecer`) são comparados
pelo objeto (semelhança de palavras, sem termos genéricos como "contratação", "serviços").
Os mais parecidos (padrão: 15) entram no prompt com a decisão e a **justificativa** da DGT.
Quanto mais pareceres bem justificados, melhores as sugestões.

## Prompt

Variáveis do modelo: `{{contexto_empresa}}`, `{{edital}}` (obrigatória), `{{historico}}`,
`{{estatisticas}}`, `{{formato_resposta}}`. Cada "Salvar" cria uma nova versão; a análise
guarda a versão que a gerou.

## Ligar a API do Claude (via Dataverse, sem Azure)

```
Portal ──login Dataverse──► Custom API dgt_AnalisarLicitacaoIa
       ──► passo do plugin AnalisarLicitacaoIaPlugin ──chave──► API do Claude
```

1. Rodar `scripts/dataverse/criar-tabelas-ia-licitacoes.ps1` (cria as tabelas e a Custom API).
2. Compilar `server/DGT.Treinamentos.Plugins` e dar **Update** no assembly pelo Plugin
   Registration Tool (novo tipo **AnalisarLicitacaoIaPlugin**).
3. **Register New Step**: Message `dgt_AnalisarLicitacaoIa` · Primary Entity *none* ·
   Stage **PostOperation** · **Synchronous** · **Secure Configuration** = a chave do Claude.
4. Licitações › Configurar IA → provedor **API de IA**, modelo `claude-sonnet-5-5` → Salvar.

A chave fica **somente** na Configuração segura do passo (visível só para administradores
do sistema). Quem pode usar a IA: quem tem **Criar** em *Análise de IA de licitação*.

## LGPD

O edital vai para a IA **sem CNPJ** (mascarado) e **sem o link do PNCP**. As análises
guardadas também não têm CNPJ.
