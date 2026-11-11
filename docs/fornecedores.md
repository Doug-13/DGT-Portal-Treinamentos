# Fornecedores — homologação e gestão (fase 1, uso interno)

Módulo para Suprimentos: cadastro mestre de fornecedores, documentos com
validade, consultas automáticas (Receita via CNPJá, CEIS e CNEP via Portal da
Transparência) e status de homologação. Base: escopo "Plataforma de Homologação
e Gestão de Fornecedores" (minuta 1.0, 06/11/2026) e Ficha de Cadastramento RTC.

**Fora desta fase:** portal do fornecedor (acesso externo), kanban com aprovações
por alçada, IQF, integração com o CIGAM, documentos por colaborador terceirizado
(ASO, NRs — aguardam validação do encarregado de dados) e consulta automática do TCU.

Ordem de implantação: **1. aprovação do CNPJ → 2. tabelas → 3. permissões →
4. plugin → 5. tela → 6. fluxos (opcional)**.

---

## 1. Exceção de LGPD para o CNPJ

O portal não grava CNPJ (README, seção 8). Aqui o CNPJ da **empresa** fornecedora
é o identificador do cadastro e das consultas, então ele é a única exceção:

- fica **só** em `dgt_fornecedor.dgt_cnpj`, com **segurança de campo**;
- perfil `DGT - Fornecedores - CNPJ`: Ler = Sim, Criar = Sim, **Atualizar = Não**
  (o CNPJ não muda depois do cadastro; se estiver errado, desative e cadastre de novo);
- quem não está no perfil vê a coluna vazia;
- observações, contatos e textos dos documentos continuam bloqueando CPF/CNPJ.

Aprovar com TI / encarregado de dados **antes** de rodar o script (ele exige
`-ConfirmoAprovacaoCnpj`).

## 2. Tabelas

```powershell
.\scripts\dataverse\criar-tabelas-fornecedores.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao NOME_DA_SOLUCAO -ConfirmoAprovacaoCnpj
```

| Tabela | Para que serve |
|---|---|
| `dgt_fornecedor` | Cadastro mestre (`dgt_name` = razão social), status, categoria, contatos, dados da Receita, última consulta e resultado das sanções |
| `dgt_tipodocumentofornecedor` | Documentos exigidos por categoria, obrigatoriedade, validade padrão e visibilidade (Interno / Externo) |
| `dgt_fornecedordocumento` | Cada versão de documento (Vigente / Substituído), emissão, validade e link do arquivo |
| `dgt_fornecedorconsulta` | Uma linha por consulta externa (CNPJ, CEIS, CNEP), com resultado e resumo |
| `dgt_fornecedorhistorico` | Alterações do cadastro: ação, descrição, usuário |

Nada é apagado pela tela. O script também cria o perfil de segurança de campo e a
Custom API `dgt_ConsultarFornecedor` (exige `prvWritedgt_fornecedor`).

## 3. Permissões

- Função de segurança de Suprimentos: Criar / Ler / Gravar (Organização) nas 5
  tabelas, **sem Excluir**.
- Pessoas (ou equipe) de Suprimentos no perfil de campo `DGT - Fornecedores - CNPJ`.
- Usuários e acessos: liberar o módulo **Fornecedores**; quem aprova homologação
  recebe "Administrador do módulo" (status Homologado, Suspenso, Bloqueado e
  Descredenciado e a aba Tipos de documento).
- SharePoint: edição na biblioteca **Documentos de Fornecedores** (ver item 5).

## 4. Plugin `ConsultarFornecedorPlugin`

1. `dotnet build -c Release` e atualizar o assembly.
2. Registrar o **passo** (como o do ClickUp):
   - Message `dgt_ConsultarFornecedor` · Primary Entity none · PostOperation · Síncrono
   - **Configuração segura** (só aqui ficam as chaves):
     `{ "cnpja": "<chave do CNPJá>", "transparencia": "<chave da API de dados>" }`
   - Configuração não segura (opcional):
     `{ "cnpjaParametros": "maxAge=30", "diasEntreConsultas": 14, "limiteLote": 20 }`

Ações (`PayloadJson`):

| Ação | Payload | O que faz |
|---|---|---|
| `previa` | `{ "acao": "previa", "cnpj": "..." }` | Confere duplicidade e devolve os dados da Receita. Não grava. |
| `consultar` | `{ "acao": "consultar", "fornecedorId": "...", "consultas": ["cnpj","sancoes"] }` | Consulta e grava em `dgt_fornecedorconsulta` e no fornecedor |
| `lote` | `{ "acao": "lote", "consultas": ["sancoes"], "limite": 20 }` | Fornecedores ativos sem consulta há mais de `diasEntreConsultas` dias |

Do CNPJá só entram dados da **empresa** (sem sócios, telefones e e-mails).
A ação `sancoes` consulta **CEIS, CNEP, CEPIM e acordos de leniência** (mesma
chave). O resultado de sanções é "Com registro" apenas com sanção **vigente** no
CEIS/CNEP ou com a entidade no CEPIM (estar no CEPIM já é o impedimento);
sanções encerradas aparecem no resumo. **Leniência é informativa**: o acordo
aparece na aba Consultas, mas não muda o resultado de sanções.

**Testar primeiro** com um fornecedor de teste: o Portal da Transparência pode
bloquear chamadas automatizadas (verificação de segurança do site). O plugin
responde com mensagem clara nesse caso, mas o teste confirma se o servidor do
Dataverse passa.

## 5. Documentos (SharePoint)

`CONFIG_DOCUMENTOS_FORNECEDORES` em `services/fornecedores/FornecedoresService.ts`:
site vazio = site do portal; biblioteca `Documentos de Fornecedores`. Ajustar
`siteUrl` para o site de Compras quando o acesso sair. Enquanto o upload falhar
por permissão, a tela aceita o **link** do arquivo.

Pasta por fornecedor: `Razão social (8 primeiros caracteres do id)` — sem CNPJ
no nome da pasta.

## 6. Fluxos do Power Automate (opcionais, montados por você)

**Reconsulta quinzenal de sanções** — Agendado (diário, 06h):
1. Dataverse › *Executar uma ação não associada* `dgt_ConsultarFornecedor`,
   `PayloadJson` = `{"acao":"lote","consultas":["sancoes"],"limite":20}`.
2. *Fazer até* `haMais` = false (máx. 10 voltas), repetindo o passo 1.
3. Se `comRegistro` > 0: e-mail para Suprimentos com o link do módulo.

Como o plugin só pega quem está há mais de 14 dias sem consulta, rodar todo dia
espalha a carga e cada fornecedor é consultado a cada ~2 semanas.

**Alertas de vencimento (30/15/5 dias)** — Agendado (diário):
1. Dataverse › *Listar linhas* `dgt_fornecedordocumentos`, filtro:
   `dgt_situacao eq 'Vigente' and (dgt_datavencimento eq @{formatDateTime(addDays(utcNow(),30),'yyyy-MM-dd')} or dgt_datavencimento eq @{formatDateTime(addDays(utcNow(),15),'yyyy-MM-dd')} or dgt_datavencimento eq @{formatDateTime(addDays(utcNow(),5),'yyyy-MM-dd')})`,
   expandir `dgt_Fornecedor($select=dgt_name)`.
2. Se houver linhas: e-mail/Teams para Suprimentos com fornecedor, documento e validade.

## 7. Regras da tela

- Pendência = obrigatório faltando, vencido ou vencendo em até 30 dias. A
  suspensão automática (RF-24) ainda não existe: depende de Suprimentos definir
  quais documentos suspendem.
- Documento novo do mesmo tipo marca o anterior como **Substituído**.
- CNPJ alfanumérico (Receita, a partir de 07/2026) já é aceito.
- Tipos sugeridos (botão "Criar sugestões") vêm da Ficha RTC e do relatório de
  due diligence; validades em branco, exceto a CND (6 meses, pela Ficha RTC).
