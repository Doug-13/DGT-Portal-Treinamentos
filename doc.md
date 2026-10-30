# CONTEXTO
Você é um(a) engenheiro(a) front-end sênior e designer de produto. Vamos construir o FRONT-END de um ERP completo, moderno e profissional, no nível de UI/UX dos melhores do mercado (referências de qualidade visual: Linear, Stripe Dashboard, Notion, SAP Fiori, Odoo).

Nesta etapa NÃO existe backend. Todos os dados são MOCKADOS, mas a arquitetura deve permitir trocar o mock por uma API real depois, sem reescrever telas.

# STACK
- React 18 + TypeScript (strict) + Vite
- Tailwind CSS + shadcn/ui (Radix) + lucide-react
- React Router v6 (rotas aninhadas, lazy loading, rotas protegidas)
- TanStack Query (consumindo a camada de serviços mockada)
- TanStack Table (tabelas com ordenação, filtros, paginação, seleção, colunas ocultáveis)
- React Hook Form + Zod (formulários e validação)
- Zustand (estado global: sessão, tema, empresa ativa, sidebar)
- Recharts (gráficos)
- @faker-js/faker com locale pt_BR (geração dos dados mock, com seed fixa para resultados estáveis)
- date-fns (locale pt-BR)
- Idioma da interface: português do Brasil. Moeda BRL, datas dd/MM/yyyy, CPF/CNPJ/CEP/telefone com máscara e validação.

# ARQUITETURA (obrigatória)
src/
  app/            (providers, router, layouts)
  components/ui/  (shadcn)
  components/shared/ (DataTable, PageHeader, EmptyState, ConfirmDialog, StatCard, FilterBar, FormField, StatusBadge, CommandPalette, etc.)
  features/<modulo>/ (pages, components, hooks, schemas, types)
  services/       (camada de acesso a dados: interfaces + implementação mock)
  mocks/          (geradores de dados, banco em memória, latência simulada de 300-800ms, erros ocasionais configuráveis)
  lib/            (utils, formatadores, validadores, constantes)
  stores/

Regras:
- Telas NUNCA acessam os mocks diretamente. Elas usam hooks (TanStack Query) que chamam services. Cada service tem uma interface (ex.: ClienteService) e uma implementação mock em memória, com CRUD funcional (criar, editar, excluir realmente altera o estado durante a sessão).
- Tipos TypeScript compartilhados e fortes para todas as entidades.
- Componentes reutilizáveis: nada de copiar e colar tabela/formulário entre módulos.

# DESIGN SYSTEM E UX
- Design tokens (cores, tipografia, espaçamento, raio, sombras) definidos em um único lugar. Paleta neutra e sóbria com uma cor de destaque; cores semânticas para sucesso, alerta, erro e info.
- Tema claro e escuro, com alternância persistida.
- Layout: sidebar recolhível (com ícones, agrupada por módulo, item ativo destacado), topbar com busca global (Command Palette via Ctrl/Cmd+K), seletor de empresa/filial, notificações, menu do usuário, breadcrumbs em todas as páginas internas.
- Totalmente responsivo (desktop primeiro, mas utilizável em tablet e celular; sidebar vira drawer no mobile).
- TODA tela de dados deve ter os 4 estados: carregando (skeletons, não spinners soltos), vazio (com ilustração/ícone, texto útil e ação principal), erro (com botão tentar novamente) e sucesso.
- Listagens: busca, filtros avançados, ordenação, paginação, seleção em massa, exportar (simulado), densidade da tabela (compacta/confortável), colunas configuráveis, ações por linha, clique na linha abre detalhe.
- Formulários: validação inline em tempo real, mensagens claras em português, indicação de campos obrigatórios, máscaras, autosave de rascunho nos formulários longos, aviso ao sair com alterações não salvas, foco automático no primeiro campo, Enter envia, Esc fecha modais.
- Feedback: toasts para ações, diálogos de confirmação para ações destrutivas (com desfazer quando fizer sentido), estados de botão (loading/disabled).
- Acessibilidade (WCAG AA): contraste, foco visível, navegação por teclado, aria-labels, labels em todos os campos, respeito a prefers-reduced-motion.
- Microinterações discretas (transições de 150-200ms), sem exageros.
- Densidade de informação adequada a ERP: dados em destaque, hierarquia visual clara, números alinhados à direita, tabulares (tabular-nums).

# AUTENTICAÇÃO (mock)
Telas:
1. Login: e-mail + senha, mostrar/ocultar senha, "lembrar-me", validação, mensagem de erro de credencial inválida, estado de loading, layout dividido (formulário + painel de marca), tema claro/escuro. Mostrar uma dica discreta com os usuários de teste.
2. Esqueci minha senha (informar e-mail, tela de confirmação).
3. Redefinir senha (nova senha + confirmação com indicador de força).
4. Seleção de empresa/filial após o login (quando o usuário tiver mais de uma).
5. Tela de bloqueio por inatividade (opcional, simulada).
6. Páginas 403 (sem permissão), 404 e erro genérico.

Comportamento: sessão mock persistida em localStorage, rotas protegidas, redirecionamento para o login ao expirar, e RBAC mock com perfis: Administrador, Financeiro, Vendas, Compras, Estoque, RH, Somente leitura. O menu e as ações mudam conforme o perfil (itens sem permissão ficam ocultos ou desabilitados com tooltip).
Usuários de teste (um por perfil), ex.: admin@erp.com / 123456.

# TELAS POR MÓDULO (todas com dados mock realistas, mínimo de 50 a 200 registros por entidade principal)

## 1. Dashboard
- Cards de KPI (faturamento do mês, contas a receber, contas a pagar, pedidos em aberto, ticket médio, estoque crítico) com variação vs. período anterior.
- Gráficos: faturamento x despesas (12 meses), vendas por categoria, fluxo de caixa projetado, top 5 clientes e produtos.
- Listas: tarefas e pendências, alertas (estoque mínimo, títulos vencidos), atividades recentes.
- Filtro de período e atalhos rápidos (novo pedido, novo cliente, lançar despesa).

## 2. Cadastros
- Clientes (lista, detalhe com abas: dados, contatos, endereços, histórico de pedidos, financeiro, anexos; formulário PF/PJ)
- Fornecedores (mesma estrutura)
- Produtos e Serviços (lista, formulário com abas: geral, preços, estoque, fiscal, imagens, variações)
- Categorias, Unidades de medida, Marcas
- Transportadoras
- Condições e formas de pagamento
- Tabelas de preço

## 3. Vendas
- Orçamentos (lista, criação com itens, descontos, frete, impostos simulados, converter em pedido, gerar PDF simulado)
- Pedidos de venda (lista, detalhe com linha do tempo de status, itens, faturamento, entregas)
- Visão Kanban de pedidos por status
- Devoluções
- Comissões de vendedores
- PDV simplificado (tela de caixa com busca de produto, carrinho e pagamento)

## 4. Compras
- Solicitações de compra
- Cotações (comparativo entre fornecedores)
- Pedidos de compra
- Recebimento de mercadorias (conferência com itens)

## 5. Estoque
- Posição de estoque (por produto, depósito, lote)
- Movimentações (entradas, saídas, transferências, ajustes)
- Inventário (contagem simulada com divergências)
- Depósitos/almoxarifados
- Alertas de estoque mínimo e ponto de reposição

## 6. Financeiro
- Contas a pagar e Contas a receber (lista com filtros por status, vencimento, baixa individual e em massa, parcelamento, anexos)
- Fluxo de caixa (realizado x previsto, gráfico e tabela)
- Contas bancárias e extrato
- Conciliação bancária (interface lado a lado: extrato x lançamentos, com ação de conciliar)
- Plano de contas e Centros de custo
- DRE simplificada
- Cobranças / boletos (simulado)

## 7. Fiscal
- Notas fiscais emitidas e recebidas (lista, detalhe, status: autorizada, cancelada, rejeitada)
- Emissão de NF-e (formulário guiado em etapas, apenas simulado)
- Apuração de impostos (resumo mockado)
- Configurações fiscais (CFOP, NCM, regimes) apenas como cadastro

## 8. Produção
- Ordens de produção (lista, detalhe, apontamentos)
- Estrutura de produto (BOM) em árvore
- Planejamento (calendário/Gantt simplificado)
- Controle de qualidade (checklists simulados)

## 9. CRM
- Leads e Oportunidades (funil Kanban com arrastar e soltar)
- Atividades e agenda (calendário)
- Detalhe do contato com histórico de interações

## 10. RH
- Funcionários (lista, ficha completa com abas)
- Cargos e departamentos (organograma simples)
- Ponto e frequência (grade mensal)
- Férias e ausências (calendário)
- Folha de pagamento (resumo e holerite simulado)
- Recrutamento (vagas e candidatos em Kanban)

## 11. Relatórios e BI
- Central de relatórios (catálogo por módulo, favoritos)
- Visualização de relatório com filtros, gráfico, tabela e exportação simulada (PDF/Excel/CSV)
- Construtor simples de dashboards (opcional na fase final)

## 12. Administração
- Usuários (lista, convite, edição, ativar/desativar)
- Perfis e permissões (matriz módulo x ação: visualizar, criar, editar, excluir, aprovar)
- Dados da empresa e filiais
- Log de auditoria (quem, o quê, quando, valor anterior e novo)
- Configurações gerais (preferências, numeração de documentos, e-mails)
- Integrações (cards simulados: banco, emissor fiscal, e-commerce)

## 13. Transversais
- Central de notificações (dropdown + página completa)
- Perfil do usuário (dados, senha, preferências, tema, sessões ativas)
- Busca global (Command Palette) que encontra clientes, produtos, pedidos e navega por telas
- Central de ajuda e atalhos de teclado (modal)
- Tela de aprovações (fluxos pendentes de aprovação)

# FASES DE EXECUÇÃO (siga nesta ordem e PARE ao fim de cada fase para eu validar)
Fase 1: Setup do projeto, design tokens, tema claro/escuro, layout base (sidebar, topbar, breadcrumbs), componentes compartilhados, camada de services/mocks, autenticação completa (todas as telas de auth) com RBAC mock e Dashboard.
Fase 2: Cadastros + Vendas.
Fase 3: Compras + Estoque.
Fase 4: Financeiro + Fiscal.
Fase 5: Produção + CRM + RH.
Fase 6: Relatórios + Administração + Transversais + polimento (acessibilidade, responsividade, performance, revisão de consistência visual).

# CRITÉRIOS DE ACEITE POR FASE
- npm run dev sobe sem erros; npm run build e npm run lint passam; sem any desnecessário.
- Todas as rotas da fase navegáveis pelo menu, sem links quebrados.
- Todas as telas com estados de loading, vazio e erro.
- CRUD mock funcionando nas entidades da fase.
- Visual consistente com o design system (nenhuma tela "solta" com estilo próprio).
- README atualizado com: como rodar, estrutura de pastas, usuários de teste, como trocar um service mock por API real.

# ANTES DE CODAR
1. Proponha em poucas linhas: a estrutura de rotas completa, o mapa do menu e os principais tipos de dados.
2. Me mostre a paleta e a tipografia escolhidas.
3. Só depois comece a Fase 1.
Se alguma decisão for ambígua, escolha a opção mais comum em ERPs de mercado e registre a decisão no README, em vez de me interromper.