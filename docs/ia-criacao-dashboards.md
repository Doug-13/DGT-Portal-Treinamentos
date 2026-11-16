# Criação de dashboards com IA (dentro do portal)

## Para o usuário

Indicadores › **✦ Criar com IA** → descrever o painel → prévia com os próprios dados → ajustar conversando
("tire a aba X", "mostre só os 10 maiores") ou pelo ✎ → **Salvar em Meus dashboards**.

- Dashboards **pessoais** aparecem como abas "☆ Nome" e **só o dono vê**.
- Na aba pessoal: **✦ Ajustar com IA**, **Excluir** e, para quem gerencia dashboards, **Publicar**
  (para todos, gestores e admins, ou só administradores). Publicado, vira aba oficial (Gerenciar dashboards).

## Como funciona

```
Portal (catálogo FILTRADO pelas permissões) ──► Custom API dgt_GerarDashboardIa ──► GerarDashboardIaPlugin ──► Claude
   ▲                                                              (instruções: Recursos/InstrucoesDashboardIa.md)
   └── validarDashboard com o MESMO catálogo filtrado; com erro, devolve os erros à IA (até 2 correções)
```

| Peça | Arquivo |
|---|---|
| Fontes permitidas, chamada e correção | `services/dashboards/criacaoIa.ts` |
| Tela | `pages/Indicadores/CriarDashboardIaModal.tsx` (botão e abas pessoais em `IndicadoresPage.tsx`) |
| Pessoal e dono | `DashboardService` (`pessoal`, `donoId`, `separarDashboards`) |
| Plugin | `server/DGT.Treinamentos.Plugins/GerarDashboardIaPlugin.cs` |
| Instruções da IA (a "skill") | `server/DGT.Treinamentos.Plugins/Recursos/InstrucoesDashboardIa.md` (embutido na DLL) |
| Dataverse | `scripts/dataverse/criar-ia-criacao-dashboards.ps1` |

## Permissões

| Fonte | Quem pode usar na criação |
|---|---|
| orcamento.* | módulo Planejamento orçamentário liberado |
| documentos.* · treinamentos.* · licitacoes.* | módulo correspondente liberado |
| ambientes.* | algum ambiente liberado (ou quem vê todas as áreas) |
| fornecedores.* | quem vê todas as áreas e tem o módulo Fornecedores |
| projetos.* | quem vê todas as áreas |
| ia.consumo | Administrador |

Segurança dos dados: a IA recebe só o pedido e a descrição das fontes (nunca registros). O painel
criado só mostra o que a pessoa já veria: as fontes filtram pelas áreas dela e o Dataverse aplica os
perfis de segurança. Pessoais: a tabela `dgt_dashboard` é UserOwned — com Criar/Gravar/Excluir em nível
**Usuário**, cada um só altera os próprios.

## Ligar

1. `scripts/dataverse/criar-ia-criacao-dashboards.ps1 -UrlAmbiente <url> -Solucao DGTPortaldeConhecimentoeTreinamentos`
2. Perfis (Colaboradores/Gestores): `dgt_dashboard` → Criar, Gravar, Excluir, Acrescentar = **Usuário**; Ler = **Organização**.
   Quem gerencia dashboards: Gravar/Excluir = Organização (para publicar).
3. Compilar os plugins, **Update** do assembly e **Register New Step**: `dgt_GerarDashboardIa`, none,
   PostOperation, Synchronous, sem Configuração segura, "Delete AsyncOperation" desmarcado.
4. Publicar o `.sppkg`. Conferir com `scripts/dataverse/diagnosticar-ia.ps1`.

Ajustar o comportamento da IA = editar `InstrucoesDashboardIa.md` e recompilar os plugins (sem mexer no código).
Consumo: registrado em "Consumo de IA" como Dashboards · Criação com IA, na área principal do usuário.
