# Administração da IA — chave, consumo, limites e áreas

## Visão geral

```
Indicadores › ✦ Administrar IA (só Administrador)
  ├─ Chave ........ Custom API dgt_GerenciarIa ──► GerenciarIaPlugin ──► dgt_iaconfiguracao.dgt_chaveapi (protegida)
  ├─ Preços ....... dgt_iaconfiguracao.dgt_precosjson   (US$ por milhão de tokens)
  ├─ Limites ...... dgt_iaconfiguracao.dgt_limitesjson  (US$ por mês, por área)
  └─ Áreas ........ dgt_iaconfiguracao.dgt_areasfuncionalidadejson e dgt_usuarioarea.dgt_principal

Cada chamada à IA (Licitações, Dashboards)
  plugin ──► IaComum: chave → área → limite → Claude → 1 linha em dgt_iaconsumo (sem conteúdo)

Dashboard "Consumo de IA" (fonte ia.consumo) ──► por área, usuário, funcionalidade e mês
```

| Peça | Arquivo |
|---|---|
| Núcleo compartilhado dos plugins | `server/DGT.Treinamentos.Plugins/IaComum.cs` |
| Salvar / testar / remover a chave | `server/DGT.Treinamentos.Plugins/GerenciarIaPlugin.cs` |
| Plugins de IA (usam o núcleo) | `AnalisarLicitacaoIaPlugin.cs`, `PerguntarDashboardIaPlugin.cs` |
| Tabelas, coluna e Custom API | `scripts/dataverse/criar-ia-administracao.ps1` |
| Serviço do portal | `services/ia/IaAdminService.ts` |
| Tela | `pages/Indicadores/AdministrarIaModal.tsx` (botão em `IndicadoresPage.tsx`) |
| Fonte do dashboard | `services/dashboards/fontesDashboard.ts` → `ia.consumo` |
| Dashboard pronto | `docs/dashboards/exemplos/consumo-ia.json` e "Usar exemplo: Consumo de IA" |

## Chave

- Fica em `dgt_iaconfiguracao.dgt_chaveapi`, coluna com **segurança de coluna** e sem perfil que dê
  leitura: só o SYSTEM (plugins) e administradores do sistema do Dataverse a leem. O portal nunca a lê;
  mostra só o final (…a1B2), quem trocou e quando.
- "Testar e salvar" testa a chave na Anthropic (lista de modelos, **sem gastar tokens**) e só salva se ela funcionar.
- Sem chave salva no portal, os plugins usam a **Configuração segura** do passo (como antes).
- Quem pode trocar: quem tem **Gravar** em `dgt_iaconfiguracao` (Administradores).

## Área do consumo

| Ordem | Regra | Onde |
|---|---|---|
| (a) | Área de onde partiu o uso | Dashboards: área filtrada; sem filtro, a única área do dashboard. Licitações: área escolhida em Administrar IA › Áreas (padrão: sigla **LIC**) |
| (b) | Área principal do usuário | `dgt_usuarioarea.dgt_principal`, definida em Administrar IA › Áreas |
| — | Única área ativa do usuário | quando ele só participa de uma |
| — | "Sem área" | nenhuma das anteriores (aparece no consumo para o Administrador corrigir) |

A coluna "Origem da área" (`Uso`, `Principal`, `Única área`, `Sem área`) mostra qual regra foi usada.

## Custo e limites

- Custo = tokens de entrada × preço de entrada + tokens de saída × preço de saída (por milhão), gravado
  **no momento da chamada**. Mudar o preço não recalcula o passado.
- Modelo sem preço cadastrado: custo zero e aviso na aba Preços.
- Cotação do dólar (opcional) gera também o custo em R$.
- Limite mensal por área (US$): ao atingir, a IA fica bloqueada para aquela área até o mês seguinte.
- Só chamadas **bem-sucedidas** geram consumo (falhas não são cobradas pela Anthropic e não são gravadas).

## Ligar (uma vez por ambiente)

1. `scripts/dataverse/criar-ia-administracao.ps1 -UrlAmbiente <url> -Solucao DGTPortaldeConhecimentoeTreinamentos`
2. Perfis de segurança:
   - Administradores: `dgt_iaconfiguracao` → Ler e Gravar; `dgt_iaconsumo` → Ler; `dgt_usuarioarea` → Gravar (já têm).
   - Gestores que verão o dashboard de consumo: `dgt_iaconsumo` → Ler.
   - Quem usa a IA: nada novo (os plugins gravam o consumo como SYSTEM).
3. Compilar `server/DGT.Treinamentos.Plugins` e dar **Update** no assembly (novo tipo **GerenciarIaPlugin**).
4. **Register New Step**: `dgt_GerenciarIa` · Primary Entity *none* · PostOperation · Synchronous (sem Configuração segura).
5. Publicar o `.sppkg`. Em Indicadores › ✦ Administrar IA › Chave, salvar a chave nova.
6. Gerenciar dashboards › Novo › "Usar exemplo: Consumo de IA" (Quem vê: Somente administradores, ou Gestores).

## LGPD

`dgt_iaconsumo` guarda **quem** usou (usuário e nome), a área e números (tokens e custo). Não guarda
pergunta, resposta, dados enviados nem a chave.
