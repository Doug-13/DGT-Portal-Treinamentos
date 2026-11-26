# Histórico de versões do Portal DGT

Anote as mudanças em "Não publicado" enquanto desenvolve, uma por linha,

começando por "- Novo:", "- Melhoria:" ou "- Correção:". No próximo

`.\Gerar-Versao.ps1` elas passam para a nova versão e aparecem em "Novidades".

## [Não publicado]

- Novo: Fornecedores — notificações nativas da homologação (fila padrão de e-mails, dgt_implemail): "Quando a atividade começar" nas 4 etapas do SUP-HOM e evento "Resultado da homologação" para a área Supply, já no pacote; aviso "Nova ficha" para a área Supply gravado pelo plugin. Criação tardia da instância e migração de ciclo antigo não notificam. Os e-mails levam o remetente "fornecedores" (coluna nova dgt_remetente) para sair de fornecedores@ quando o fluxo central tiver a caixa.
- Novo: Fornecedores — relatório de homologação em PDF: botão "Gerar relatório" no card (prévia com a fase atual) e geração automática na conclusão (relatório final, registrado como documento "Relatório de homologação"). Salvo na pasta do fornecedor › Homologação e listado em "Relatórios emitidos". Sem dados bancários e sem CPF; CNPJ só para quem tem o perfil de campo.
- Novo: Fornecedores — tipos de documento de colaborador cadastráveis (Tipos de documento › Colaborador), cada um obrigatório para todos os colaboradores ou opcional. Pendência: obrigatório faltando ou vencido; opcional só quando vence. ASO e NR aplicável criados pelo script; registros antigos continuam valendo.
- Melhoria: Processos — no pacote JSON, destinatário de notificação do tipo Área aceita a sigla ("area": "SUY"), como os responsáveis.
- Correção: Fornecedores — as notificações configuradas no processo SUP-HOM não eram enviadas (o serviço da homologação não usava o despachante de notificações do motor).
- Atenção (deploy): Fornecedores — rodar de novo scripts/dataverse/criar-tabelas-fornecedores.ps1 (tipos de colaborador, relatórios, remetente na fila); aplicar as notificações no SUP-HOM (reimportar o pacote ou "Aplicar alterações" no editor); Criar e Ler (nível Usuário) em dgt_implemail para Suprimentos e Jurídico, com o fluxo de e-mail central ativo; Jurídico: permissões nas tabelas, módulo liberado, gravação na pasta Contratos Fornecedores e perfil de campo do CNPJ (docs/fornecedores.md, seção 3).

## [1.4.32] - 2026-11-25

- Melhoria: Arquitetura de Soluções — Cálculo de HH: ao responder "Sim", o valor HH de desenvolvimento vem preenchido com R$ 350,00 e o valor do ponto da manutenção com R$ 96,92 (editáveis).
- Melhoria: Arquitetura de Soluções — Cálculo de HH do B.O.M. e componente de HH dos fluxos não mostram mais HH por ponto, pontos e HH dos pontos (derivam de salários). Os cálculos continuam; "Cobre o HH?" mostra só Sim/Não, sem a diferença em R$.
- Correção: Arquitetura de Soluções — B.O.M. pronto: o botão "Baixar PDF" gera e baixa o arquivo .pdf na hora (jsPDF), com capa, indicadores, itens, alterações nos kits, integração/manutenção, totais do projeto e numeração de páginas. Antes abria uma janela de impressão, bloqueada como pop-up e sem download.
- Novo: Arquitetura de Soluções — o Cálculo de HH usa o valor total dos itens da Seleção de kit (preços do CIGAM) no lugar do custo digitado: calcula o valor pelo % fixo de Implantação (7%) e Supply (0,5%), mostra se esse valor cobre o HH dos pontos e soma os "Totais do projeto" (itens + Implantação + Supply + integração + manutenção). Os totais aparecem no B.O.M. pronto (indicador, tela e PDF) e são congelados no envio para aprovação.
- Novo: Arquitetura de Soluções — Cálculo de HH: perguntas "Tem integração?" (nº de horas × valor HH de desenvolvimento + taxa BDI) e "Tem contrato de manutenção?" (nº de pontos × valor do ponto). Com "Sim", abrem as colunas para preencher e o total. As respostas ficam gravadas no B.O.M. (quem salvou e quando), são obrigatórias para avançar e aparecem no B.O.M. pronto e no PDF.
- Melhoria: Arquitetura de Soluções — na tabela do Cálculo de HH do B.O.M., as áreas passam a ser Implantação (% fixo 7%) e Supply (% fixo 0,5%). O menu Cálculo de HH não muda.
- Novo: Arquitetura de Soluções — Seleção de kit: cada item do kit gerado pode ser trocado por outro (do catálogo ou informado à mão) ou cancelado, com motivo obrigatório. O item removido aparece riscado e o novo destacado, com quem fez e quando; quantidade igual à do item removido (acompanha o kit) ou outra por ponto.
- Novo: Arquitetura de Soluções — histórico das alterações de itens por ponto (quem, data e hora, motivo, situação). Desfazer não apaga: a alteração fica registrada como desfeita, com quem desfez e quando. Alteração cujo item saiu do kit (configuração mudou) fica como "não aplicada", com aviso.
- Novo: Arquitetura de Soluções — B.O.M. pronto mostra, no kit de cada ponto, o item removido e o adicionado com o histórico; selo "substituto" na lista de itens; seção "Alterações nos kits" na tela e no PDF. O histórico é congelado junto no envio para aprovação.
- Novo: dashboards criados pela IA respeitam o acesso de quem cria — a IA só monta indicadores com as fontes de dados que o usuário pode ver.
- Melhoria: ajustes na criação de dashboards pela IA (instruções do assistente, tela de criação e exibição na página Indicadores).

- Novo: Kits e B.O.M. — consulta e atualização de preços de itens pela integração com o CIGAM, com plugin no servidor, testes e documentação das APIs de consulta.
- Novo: Processos — tela Desenhos de Processo, com componentes de desenho e serviço para armazenamento e consulta dos desenhos vinculados aos processos.
- Melhoria: Arquitetura de Soluções — montagem do B.O.M. e catálogo de itens atualizados para contemplar os valores provenientes do CIGAM.
- Melhoria: testes da montagem do B.O.M., dos complementos de HH e da integração de preços com o CIGAM.
- Melhoria: navegação e permissões de rota atualizadas para contemplar Desenhos de Processo.
- Novo: script scripts/dataverse/criar-tabela-desenhos-processo.ps1 para criação da estrutura de armazenamento dos desenhos no Dataverse.

## [1.4.30] - 2026-11-23

- Novo: Fornecedores — homologação no motor de fluxos (processo SUP-HOM, Processos → Fluxos): Ficha recebida → Documentos pendentes → Análise Suprimentos → Análise Jurídico → Homologado/Reprovado. Responsáveis por área (Suprimentos e Jurídico); quem decide é o Jurídico (Aprovar, Aprovar com ressalvas, Não homologar → Reprovado, Devolver a Suprimentos). Pacote para importar: docs/exemplos/pacote-homologacao-fornecedor.json. Piloto: quem pode agir é conferido no navegador.
- Novo: Fornecedores — aba Pendências ("Aguardando você"): ciclos em que o usuário responde a etapa atual.
- Melhoria: Fornecedores — kanban de homologação só para visualização (inclusive para o administrador): sem arrastar, sem ← / → e sem "Mover para"; o card mostra etapa, tempo na etapa, prazo e quem responde. A etapa só muda pelos botões do fluxo, com comentário e histórico.
- Novo: Fornecedores — contratos do fornecedor (nome, projeto, assinatura, vigência, arquivo), com aba no fornecedor e visão geral no módulo; filtro por projeto e por vencimento; encerrar em vez de excluir.
- Novo: Fornecedores — Conferir → Contrato: o arquivo recebido por e-mail (ex.: retorno do Clicksign) vira contrato com o mesmo arquivo e sai da fila como "Convertido em contrato".
- Novo: Fornecedores — colunas para os avisos do Power Automate (etapa da homologação, documentos pendentes, avisos de vencimento) e instruções dos fluxos 2b (retorno do Clicksign), D2 (aviso de etapa) e D3 (vencimentos ao fornecedor e de contratos) em docs/fornecedores.md.
- Atenção (deploy): rodar de novo scripts/dataverse/criar-tabelas-fornecedores.ps1, atualizar a DLL dos plugins (o ciclo aberto pela ficha já sai com a área Suprimentos; nova chave opcional "areaSuprimentos" na Configuração não segura), importar e publicar o processo SUP-HOM e vincular as pessoas às áreas Suprimentos e Jurídico.
- Novo: Fluxos — aba Notificações nas atividades: avisa os responsáveis da atividade por e-mail quando ela começa ou é concluída (opcional: só para certos botões, ex.: Reprovar). Caixa "Notificar também via Teams" envia também uma mensagem no chat do Teams de cada responsável. Assunto e mensagem aceitam marcadores ({registro}, {etapa}, {acao}, {comentario}, {prazo}, {link}, {campo:chave}...).
- Novo: Fluxos — evento de notificação (círculo com carta) na paleta do editor: ao passar por ele, o fluxo envia a notificação configurada (autor, área, usuário, campo Usuário ou e-mails fixos; e-mail e/ou Teams) e segue sem parar. Duplo clique abre a configuração. Também no pacote JSON do processo (`notificacoes`).
- Novo: sino de notificações no cabeçalho, com o número de avisos não lidos; abre a lista dos últimos avisos (fluxo, treinamentos, orçamento, licitações), leva ao destino e marca como lido.
- Melhoria: as notificações usam a fila de e-mails existente (dgt_implemail, tipo "notificacaoFluxo"), uma linha por destinatário e sem duplicar; o fluxo de e-mail atual não muda. Falha ao registrar a notificação não desfaz a ação do fluxo (aviso na tela).
- Atenção (deploy): dar Criar e Ler (nível Usuário) em "E-mails de implantações" (dgt_implemail) aos perfis Colaboradores, Gestores e Administradores, e criar o fluxo "DGT - Notificações Teams" (filtro dgt_status eq 'PendenteTeams'). Passo a passo em docs/notificacoes-fluxo.md.
- Melhoria: RH e Pessoas — certificações, declarações e terceiros passam a gravar também o vínculo com os cadastros de fabricante e área (o texto continua igual). Lista de áreas vem do cadastro de áreas; aviso quando o fabricante digitado não está cadastrado.
- Novo: RH e Pessoas — terceiro pode ser vinculado a um colaborador de fornecedor (campo opcional). O RH vê só nome, função e fornecedor; CPF, ASO e NR continuam apenas em Fornecedores.
- Melhoria: Registros de Oportunidade — o fabricante passa a oferecer também os fabricantes do cadastro e grava o vínculo com o cadastro (validade e filtros não mudam).
- Atenção (deploy): rodar scripts/dataverse/criar-colunas-alinhamento.ps1 e migrar-referencias-alinhamento.ps1 (ver docs/alinhamento-tabelas.md, fases 3 e 5). Sem as colunas, o portal funciona como antes.

## [1.4.28] - 2026-11-17

- Novo: Fornecedores — homologação em kanban (Ficha recebida → Documentos pendentes → Em análise → Aguardando Jurídico → Homologado/Reprovado), um card por ciclo; ciclo concluído fica somente leitura e renovação abre um ciclo novo. A ficha recebida pelo formulário abre o ciclo sozinha. Aba Homologações com o quadro de todos os fornecedores.
- Novo: Fornecedores — botão Colaboradores: colaboradores do prestador (nome, função, CPF protegido, observações) com ASO e NR aplicável, validade e versões.
- Novo: Fornecedores — documentos recebidos por e-mail (com o protocolo) entram sozinhos como "A conferir": a analista abre o arquivo, escolhe o tipo e as datas (Conferir) ou descarta. Fila na aba Documentos e na Visão geral; "A conferir" não conta como documento entregue. Novas ações do servidor para o fluxo do e-mail: localizarProtocolo e receberDocumentos.
- Novo: Fornecedores — certidão CEAT (ações trabalhistas, TRT da sede) pela Infosimples; RS (TRT4) já configurado, demais TRTs por rota.
- Novo: Licitações — tarefa do ClickUp com os prazos Análise Inicial (7 dias úteis antes do pregão) e Análise Técnica (6 dias úteis antes). Botão "⚡ Urgente" no parecer Participar e no Acompanhamento: define só a prioridade Urgente.
- Melhoria: Licitações — prazos SLA do ClickUp com piso (data de acionamento + 1 dia útil) e teto (pregão − 1 dia útil); Impugnação respeita o limite legal (3 dias úteis antes do pregão) e, fora dele, fica vazia com a etiqueta "impugnacao-fora-do-prazo". Prazos às 18:00 (Brasília). Data de acionamento gravada uma vez na criação; o "Atualizar campos" recalcula a partir dela, nunca de hoje. Feriados extras (municipais, pontos facultativos) configuráveis no plugin, somados aos nacionais. Edital sem encerramento: tarefa com a etiqueta "sem-data-pregao".
- Melhoria: Licitações — todos os campos personalizados vão no mesmo POST de criação da tarefa (a automação de criação do ClickUp já os encontra preenchidos).
- Atenção (deploy): o plugin do ClickUp NÃO grava mais o vencimento (due_date), nem na criação nem no "Atualizar campos". O vencimento passa a depender das automações do ClickUp, que precisam estar ajustadas no deploy.
- Limitação conhecida: o encerramento do PNCP é interpretado como horário de Brasília; editais de MT (e outros fusos) podem ter 1h de diferença na Data Pregão. Os prazos (dias de calendário, às 18:00) não são afetados.
- Novo: Implantações — botão "Configurar IA" no Assistente (só administrador do módulo): define o comportamento das respostas, com versões. Padrão novo: respostas objetivas para a diretoria (resposta direta + até 5 tópicos, sem reproduzir gráficos e listas que o painel já mostra).
- Correção: Implantações — o Assistente não corta mais a resposta com o aviso "Resposta interrompida por tamanho": quando o limite é atingido, o portal pede a continuação e entrega o texto inteiro.
- Correção: Implantações — caixa de pergunta do Assistente com tamanho normal (antes herdava a altura mínima de 170px dos diálogos).
- Novo: colunas de tabela por atividade — no campo de tabela de cada etapa, cada coluna pode ser editável, somente leitura ou não exibida (ex.: o auditor não vê o Grau da NC; a coordenação vê o Resultado só para leitura). Colunas ocultas mantêm os valores e não são exigidas na etapa. Também no pacote JSON (`modoColunas`).
- Correção: subprocesso com "Aguardar todos serem concluídos" seguia na hora quando o fluxo voltava a ele e as linhas já tinham registro ("nenhum documento criado — fluxo retomado"), mesmo com os registros anteriores em andamento; agora a nova passagem espera também os registros/documentos ainda abertos (ambientes e documentos).
- Melhoria: "Documentos relacionados" do registro em cartões clicáveis, com situação e etapa atual de cada referência; o link abre o registro (inclusive em outro ambiente, ex.: RNC em Não Conformidades) ou o documento.
- Melhoria: edição direta do fluxo — a versão em uso abre já editável; "Aplicar alterações" grava, publica e leva os registros em andamento dos ambientes para o desenho novo, na mesma etapa e sem reiniciar o prazo. O rascunho continua disponível ("Criar rascunho") para mudanças grandes.
- Correção: subprocesso em registros de ambiente — antes era ignorado (...)

## [1.4.27] - 2026-11-16

- Novo: criação de dashboards com apoio de IA, permitindo gerar estruturas iniciais a partir das fontes disponíveis no portal.
- Novo: editor visual de dashboards para ajustar componentes, indicadores e organização das informações.
- Novo: plugin no servidor para geração de dashboards com IA.
- Novo: documentação e scripts de configuração da criação de dashboards por IA no Dataverse.
- Novo: exemplo de dashboard para Treinamentos, disponível como modelo de referência.
- Novo: integração de valores e preços do CIGAM com a estrutura de Kits/B.O.M.
- Novo: scripts para criação das colunas de valores do CIGAM e diagnóstico das tabelas e colunas do Dataverse.
- Melhoria: módulo Indicadores ampliado com novas fontes de dados, modelos de dashboard e recursos de edição.
- Melhoria: gráficos e visualização dos dashboards atualizados para suportar os novos modelos e fontes de informação.
- Melhoria: catálogo de Kits atualizado para utilizar informações de valores e preços integradas.
- Melhoria: identidade visual do portal centralizada com novos tokens de design para padronização das telas.
- Melhoria: documentação técnica de IA e dashboards ampliada com orientações de configuração e uso.
- Novo: filtros de período (de mês / até mês) e por campo (até 4 listas, ex.: status, tipo, responsável) nos dashboards; valem também para a IA do painel.
- Melhoria: fontes de documentos com processo, datas e meses de cadastro e abertura, etapa e situação do fluxo, motivo e retreinamento; nova fonte "Documentos — histórico de revisões do ano" (aprovação, vigência e dias até aprovar).

- Novo: Fornecedores — certidões automáticas pela Infosimples (CND Federal, FGTS, CNDT; estadual e municipal por rota configurável): certidão regular entra sozinha em Documentos, irregular vai para Consultas e histórico; lote diário renova as que vencem. Token na Configuração segura do passo do plugin.
- Novo: Fornecedores — Ficha de Cadastro SUP-CPL-01 recebida pelo Microsoft Forms (ação receberFicha), com protocolo FORN-AAAA-NNNN e lista de documentos a enviar por e-mail; abas Ficha (itens 1 a 8, questionário com respostas de atenção destacadas) e Homologação (item 9: checklist com sugestões do sistema, risco, resultado, validade do cadastro). Status Reprovado.
- Novo: Fornecedores — quadro societário e dados bancários em colunas com segurança de campo (perfis próprios), exibidos mascarados e sem valores no histórico.
- Melhoria: Fornecedores — anexos gravados no site de Suprimentos (Contratos Fornecedores), numa subpasta por fornecedor, com a permissão de quem anexa; o portal não cria bibliotecas fora do próprio site.
- Correção: script criar-tabelas-fornecedores.ps1 começava com o BOM escrito como texto e não executava.

- Novo: Implantações — acessos controlados dentro do painel (Gestão de usuários, Setores, Perfis e permissões) e Histórico de atividades; no portal, só o Administrador do módulo.
- Novo: Implantações — e-mails com horário por dia da semana e vários dias no mês; tecla F para tela cheia.
- Melhoria: o assistente IA do Implantações registra o consumo na área de Implantações (Administrar IA).

## [1.4.26] - 2026-11-13

- Melhoria: ajustes e correções internas.

## [1.4.25] - 2026-11-13

- Melhoria: ajustes e correções internas.

## [1.4.24] - 2026-11-13

- Melhoria: botão Tela cheia no cabeçalho do portal e banner dos ambientes exibido somente na visão geral.

- Melhoria: Conformidade de treinamentos exibe as áreas dos usuários e permite filtrar a tabela e os indicadores por área.

- Melhoria: registro de ambiente — saiu o quadro "Campos preenchidos" do rodapé (a etapa mostra só os campos configurados); "Cancelar registro" virou o menu ⋮ do Administrador do Sistema, com "Editar como administrador" (salva os campos da etapa atual sem mudar etapa nem situação, com validações e registro no histórico). Cancelamento restrito ao Administrador do Sistema. Plugin ValidarAcaoAdministrativaRegistroPlugin valida as duas ações no servidor.
- Melhoria: mapeamento pai → filho do subprocesso — compatibilidade por par (bloqueia publicação se incompatível), "somente leitura no filho", "Mapear automaticamente" e "Criar no filho" (mesma chave). Valores ajustados ao tipo do campo do filho na criação, com registro do que não foi aproveitado.
- Correção: valores herdados do documento pai não são mais apagados quando o fluxo filho tem uma devolução e o campo aparece editável numa etapa ainda não percorrida.
- Melhoria: tela de execução da atividade — painel esquerdo com "Dados do documento", "Histórico" (eventos do registro) e "Ver fluxo" (sempre recolhido ao abrir); sequência de atividades compacta, com cores por situação, destaque da etapa atual e rolagem horizontal; nova opção do ambiente "Mostrar sequência de atividades no topo" (com Ocultar/Mostrar na tela; ambientes antigos continuam mostrando).
- Melhoria: regra de exibição ("exibir só quando") passa a ser definida no campo, em Metadados do processo, e vale em todas as atividades que exibem o campo (inclusive versões publicadas). A atividade fica só com o modo (Não exibir/Opcional/Obrigatório/Somente leitura); regras antigas criadas na atividade continuam funcionando e aparecem como "regra antiga desta etapa".
- Correção: regras de exibição dos campos ("exibir só quando") agora valem também nas etapas dos ambientes — antes o campo condicional aparecia sempre. No editor da atividade, as opções passaram a se chamar "Opcional/Obrigatório — exibir só quando…", o campo condicional ganha a etiqueta "condicional" e há uma explicação no topo do bloco.
- Novo: tarefa "Assinatura digital" no fluxo (Clicksign, via Power Automate) — o fluxo para até o documento ser assinado; o portal cria o pedido em dgt_assinatura, acompanha os signatários e libera o fluxo com a situação final (recusa/expiração podem seguir para uma decisão). Script criar-tabelas-assinatura.ps1 e guia em docs/assinatura-digital.md.
- Melhoria: aba Metadados do editor da atividade — no topo, "Metadados da atividade" só com os campos que a etapa exibe (modo por campo; "Não exibir" tira da lista); abaixo, "Campos nesta etapa" recolhido, com busca, para adicionar metadados do processo ainda não vinculados. A definição dos campos (nome, tipo, opções, ajuda) fica só nos metadados do processo.
- Correção: nos ambientes, campos dos tipos Área, Documento e Documentos (e colunas desses tipos em tabelas) agora são editáveis nas etapas — antes só exibiam o valor.
- Novo: anexos nos registros de ambiente (SharePoint) — ligados em Editar ambiente → Anexos; cada etapa do fluxo define se os anexos são só consulta, opcionais (incluir/substituir/remover) ou obrigatórios.
- Melhoria: tela do registro de ambiente em duas colunas — dados do registro, Ver fluxo e documentos relacionados à esquerda; campos da etapa à direita (opção "Disposição" em Personalizar telas).
- Novo: tarefa "Script" no fluxo (caixa com engrenagem) — roda isolado, consulta o Dataverse (fontes liberadas) ou APIs (endereços liberados, ex.: CEP) e preenche campos antes de o fluxo seguir; pode bloquear a ação com uma mensagem. Teste do script no editor. Guia em docs/scripts.md.
- Correção: ligação etapa → decisão com botão (que impedia os outros botões, ex.: Devolver, de chegarem à decisão) — mensagem aponta a ligação exata, botão "Corrigir automaticamente" no editor, aviso na aba Caminhos e correção automática na importação JSON.
- Novo: estrutura para dashboards no próprio portal, com visualização e componentes de gráficos, acompanhada de documentação em docs/dashboards/.
- Novo: telas de Plano de Contas e Responsáveis no Planejamento Orçamentário.
- Melhoria: gestão de dashboards e integração com a página de Indicadores e os serviços de dados.
- Melhoria: catálogo e lógica dos kits, montagem do B.O.M. e seleção de kits na Arquitetura de Soluções.
- Melhoria: telas do Planejamento Orçamentário, incluindo planilhas individuais e consolidadas, contas por área, inclusão de linhas e tabela de orçamento.
- Melhoria: regras e serviços de cálculo do orçamento, fórmulas, DRE e estrutura do plano de contas.
- Melhoria: etapas, painel e serviços do fluxo orçamentário, com ajustes na resolução e configuração de responsáveis dos processos.
- Melhoria: scripts de criação de tabelas de dashboards e orçamento e de limpeza dos dados orçamentários.
- Melhoria: inclusão de arquivos de testes para fórmulas orçamentárias, importação do executado por CSV, plano de ajustes e configuração de responsáveis.
- Novo: módulo "Implantações" — painel de gestão de implantações (carteira, cronogramas, físico x financeiro, Controladoria, PMO, equipes de campo, roteirização e assistente IA) dentro do portal, com acesso pelo módulo em Usuários e acessos e permissões pelo perfil do portal; dados no Dataverse (dgt_implregistro) e importação da base antiga. Guia em docs/implantacoes.md.
- Novo: Controladoria avisa quando há faturamento atrasado no período, mesmo com diferença positiva.
- Novo: e-mails do painel (relatório semanal, resumo gerencial e cronograma para o cliente) com recorrência, prévia, teste e "Enviar agora", enviados pela fila dgt_implemail e pelo fluxo do Power Automate.
- Novo: agendamento de campo por período distribui os pontos por proximidade (uma região por dia).
- Novo: tela cheia no módulo Implantações.
- Melhoria: stakeholders com e-mail e telefone em campos separados.
- Melhoria: exportações em PDF e Excel e mapa da roteirização com bibliotecas do pacote do portal (jsPDF, ExcelJS, Leaflet); importação de vistoria aceita .xlsx e .csv.
- Novo: seleção de servidor na Seleção de kit (Arquitetura) — bloco "Servidores da central" escolhe o servidor de gravação (Digifort, Milestone) e o de analítico (IPX) pelo memorial de cálculo: premissas, compressão, câmeras com reserva, faixa recomendada, distribuição, GPU, processador e SO; o servidor, os discos, o SO e as licenças de VMS só entram no B.O.M. depois de "Adicionar à central".
- Melhoria: as licenças do Digifort passam a ser geradas pelo seletor de servidor (base por servidor + packs pela necessidade); o campo "Servidores" saiu do bloco Projeto. Seleções antigas com Digifort pedem a seleção do servidor para concluir.
- Novo: Milestone como VMS do projeto (licença por câmera e discos de vigilância vêm do seletor de servidor).
- Novo: aba "Servidores" em Kits — as 43 linhas dos memoriais (Digifort, Milestone, IPX), fichas com premissas e alertas editáveis, "Baixar modelo CSV" e "Importar planilha"; linhas com memorial incompleto ficam fora do seletor.
- Novo: aba "Wiki" em Kits — como as soluções, estruturas, controle de acesso, VMS de terceiros e servidores funcionam, sem modelos nem códigos, com links para as abas que definem os kits.
- Melhoria: resolução (MP) no cadastro de câmeras, conferida contra a premissa dos memoriais de servidor.

## [1.4.22] - 2026-11-09

- Melhoria: ajustes e correções internas.

## [1.4.21] - 2026-11-09

- Melhoria: ajustes e correções internas.

## [1.4.20] - 2026-11-08

- Melhoria: ajustes e correções internas.

## [1.4.19] - 2026-11-06

- Novo: excluir ou desativar ambientes (Configuração do ambiente), com opção de excluir junto o processo/fluxo; reativar/excluir ambientes desativados no "+ Adicionar ambiente"; botão Remover no processo aberto. A remoção de fluxo agora é bloqueada enquanto um ambiente usa o fluxo.
- Novo: componente nativo "Cálculo de HH" — a tela da Arquitetura ligada à Seleção de kit do registro; grava o resultado e a versão de HH aplicada. Exemplo da Arquitetura inteira como ambiente configurável (docs/exemplos/pacote-arquitetura-bom.json).
- Novo: tipo de campo "Componente" — telas personalizadas em etapas de fluxo: nativas (Montador de B.O.M. da Arquitetura, a mesma tela de Seleção de kit) ou HTML isolado (iframe sandbox) com ponte de dados somente leitura para tabelas e colunas liberadas; o "válido" da tela libera o Concluir da etapa. Guia em docs/componentes.md.
- Novo: "Importar JSON" e "Exportar JSON" no editor do fluxo — atualiza o processo aberto com um pacote JSON (novo rascunho do fluxo, campos novos e, se marcado, atualização dos campos existentes).
- Novo: tipo de campo "Avaliação" (modelo Matriz Go/No-Go) — critérios com nota colorida (vermelho → verde), peso, justificativa, pontuação ponderada (0–100) ou por soma, faixas com sinaleira e "Onde perde pontos"; a faixa decide caminhos do fluxo e filtra visões dos ambientes. Configurado em Processos → Metadados (com modelo Go/No-Go pronto).
- Melhoria: pacote JSON sem fluxo — o ambiente usa um fluxo existente ("ambiente.fluxo" ou escolha na importação); botão "Abrir o ambiente" ao final da importação e lista das siglas de área quando uma não é encontrada.
- Novo: importar e exportar processos em JSON ("pacote de processo") — um arquivo cria o processo, os campos, o fluxo (rascunho ou publicado) e o ambiente com as telas; ideal para gerar fluxos por IA. Botões em Processos → Fluxos, no "+ Adicionar ambiente" e na Configuração do ambiente. Formato em docs/pacote-processo.md.
- Novo: telas configuráveis nos ambientes (modelo Arquitetura de Soluções) — visão geral com cards de resumo (visões com filtro) e colunas escolhidas, tela do registro com barra de etapas do processo; tudo editável em "Personalizar telas" e gerado do fluxo quando não configurado.

## [1.4.18] - 2026-11-04

- Melhoria: ajustes e correções internas.

## [1.4.17] - 2026-11-04

- Melhoria: ajustes e correções internas.

## [1.4.16] - 2026-11-04

- Novo: subprocesso com condição por linha — cria documentos só para as linhas em que uma coluna Lista ou Sim/Não tem os valores escolhidos (ex.: só as não conformidades).
- Novo: subprocesso com a opção "Aguardar todos serem concluídos" — o documento pai (ex.: auditoria) fica parado até o fluxo de todos os documentos criados (ex.: ações das não conformidades) chegar ao fim; a aba Fluxo mostra a situação de cada um, e o Administrador pode liberar sem esperar, com motivo.
- Novo: ao criar um ambiente é possível usar um fluxo já existente de Processos → Fluxos (além de criar um novo); o fluxo do ambiente pode ser trocado em Configuração → Trocar fluxo, e a tela avisa quando o fluxo tem etapas próprias de documentos.
- Novo: "+ Adicionar ambiente" no menu lateral (Administrador) — cria ambientes como Processo, Licitações ou Compras sem código novo; cada ambiente ganha um processo com fluxo próprio, desenhado em Processos → Fluxos.
- Novo: ambientes liberados em Usuários e acessos exatamente como os módulos atuais (módulo liberado, liberação padrão por perfil e Administrador do módulo).
- Novo: registros de ambiente com código automático (PREFIXO-ANO-0001) que seguem o fluxo publicado: etapas, responsáveis, campos, prazos e histórico; abas Aguardando você, Meus registros, Todos e Configuração.
- Novo: script scripts/dataverse/criar-tabelas-ambientes.ps1 e guia docs/ambientes.md.
- Novo: Subprocesso nos fluxos (paleta do editor) — ao passar por ele, o documento cria documentos que seguem outro fluxo, um por linha de uma tabela (ex.: ações de uma auditoria) ou um único, já com o fluxo iniciado, e os referencia num campo "Documentos referenciados" (ligação visível na aba Referências dos dois documentos).
- Novo: coluna do tipo Usuário nas tabelas dos metadados (ex.: Responsável de cada ação, usado como autor do documento criado pelo subprocesso).
- Novo: módulo de HH para cadastro, consulta e utilização de horas na composição de soluções e B.O.M.
- Novo: etapa de HH no fluxo de Arquitetura de Soluções, permitindo complementar o B.O.M. com esforço estimado.
- Novo: cadastro e gestão de fabricantes e terceiros no módulo de RH.
- Novo: estrutura de dados no Dataverse para fabricantes, terceiros e informações de HH.
- Novo: opção para remover fluxos de processos, com validações para evitar exclusões indevidas.
- Melhoria: módulo de Kits ampliado com ajustes no catálogo de itens, composição de kits, visão geral e integração com a montagem do B.O.M.
- Melhoria: seleção de kits na Arquitetura de Soluções aprimorada para utilizar a estrutura atualizada de itens e composição.
- Melhoria: acompanhamento de licitações aprimorado, incluindo ajustes nos pareceres, análise por IA e informações da oportunidade.
- Melhoria: integração das licitações com pastas e documentos no SharePoint.
- Melhoria: pré-visualização de editais e relatório de licitações atualizados para apresentar as informações de forma mais completa.
- Melhoria: serviços de consulta ao PNCP e acompanhamento de licitações revisados para melhorar o tratamento dos dados retornados.
- Melhoria: gestão de certificados e informações de RH atualizada para suportar os novos cadastros relacionados a fabricantes e terceiros.
- Melhoria: permissões e rotas do Portal DGT atualizadas para contemplar os novos módulos e funcionalidades.
- Novo: menu ⋮ nos cartões de Fluxos (Administrador) com "Remover fluxo": com documentos vinculados, oferece a transferência para outro fluxo; sem documentos, remove o fluxo e todos os dados ligados a ele (versões, metadados, pendências, histórico do fluxo e exceções); se revisões já passaram pelo fluxo, ele é arquivado para preservar o histórico.

## [1.4.15] - 2026-10-28

- Novo: metadado do tipo Usuário nos processos — o campo busca os usuários ativos da plataforma por nome ou e-mail e grava nome e e-mail junto, para o histórico continuar legível.
- Novo: responsável de etapa "Usuário de um metadado" — a etapa vai para a pessoa escolhida num campo do tipo Usuário (ex.: "Responsável pelo processo"); se o campo estiver vazio, vai para o autor da revisão.
- Novo: metadados "Documento referenciado" (um) e "Documentos referenciados (vários)", com filtro por área e por processo, busca por código ou título e link para abrir o documento.
- Novo: aba Referências no documento, com o que ele referencia, quem o referencia (ex.: o filho mostra o pai) e os treinamentos vinculados.
- Novo: referências entre um documento e um treinamento criam automaticamente o vínculo treinamento × documento, usado no retreinamento por revisão documental (nada é apagado ao remover a referência).
- Novo: "Documentos de referência" no cadastro do treinamento, para vincular POPs, ITs e políticas ao curso sem depender de metadados do fluxo.
- Novo: lista de Documentos agrupada por Área › Processo (padrão ligado), com grupos recolhíveis, "Expandir tudo" e opção para desligar o agrupamento (a escolha fica guardada no navegador).
- Novo: "Minhas pendências" na Visão geral de Treinamentos, reunindo etapas do fluxo de treinamentos, documentos aguardando o usuário e treinamentos para realizar.
- Novo: resultado da avaliação com os botões "Sair" e "Ir para o próximo" (abre o próximo treinamento liberado); se reprovado, "Revisar módulos".
- Novo: "Concluir e ir para o próximo" no módulo, que grava a conclusão e abre o módulo seguinte; na revisão de módulo concluído, "Próximo módulo".
- Melhoria: status dos documentos com cores e ícones (✓ Vigente, ✎ Elaboração, ⟳ Revisão, ⏳ Aprovação, ⊘ Cancelada, ✕ Obsoleta); a etapa que aguarda o usuário ganha destaque "SUA VEZ".
- Melhoria: Visão geral de Treinamentos mais limpa — "Continuar treinamento", "Meus treinamentos", "Próximos treinamentos" e "Trilhas em andamento" só aparecem quando têm conteúdo; sem pendências, uma linha "Tudo em dia".
- Correção: documento publicado ou revisão com fluxo concluído/cancelado não aparece mais como pendência do responsável (antes voltava para a 1ª etapa do fluxo); avisos de etapas em revisões encerradas não são mais exibidos.
- Novo: Arquitetura de Soluções — cadastro de Kits (B.O.M.). Requer scripts/dataverse/criar-tabelas-kits.ps1.

## [1.4.14] - 2026-10-26

- Novo: "⟳ Atualizar todos os módulos por JSON" na etapa de edição dos módulos — um JSON com todos os módulos atualiza cada módulo existente correspondente (sugestão pelo título e, depois, pela posição, ajustável na prévia em "Atualiza") e cria os que não têm correspondência; módulos fora do JSON ficam como estão.

- Correção: revisão que ficou parada numa etapa de publicação (status "Vigente") depois de troca de processo ou de versão do fluxo agora mostra "Publicação pendente" com o botão "Concluir publicação", que publica a revisão (documento vigente, anterior obsoleta, retreinamento conforme o fluxo). A troca de fluxo também avisa quando a revisão cai numa etapa de publicação.

- Novo: na etapa de edição dos módulos (assistente do treinamento), "Atualizar por JSON" no menu do módulo substitui título, descrição, duração, obrigatoriedade e conteúdos pelos do JSON (com prévia e imagens), mantendo ordem, situação e vínculos do módulo. Conteúdos com respostas de colaboradores são desativados, não apagados.
- Melhoria: "Excluir módulo" passa a aparecer só na etapa de edição dos módulos, para quem está editando o treinamento (não só o Administrador); continua bloqueado para módulos já iniciados ou com respostas.

- Novo: conteúdos do módulo podem ser reposicionados arrastando e soltando (linha ciano indica onde o conteúdo vai cair); os botões ↑ ↓ continuam.
- Correção: reposicionar conteúdos funciona mesmo com ordens repetidas ou com buracos — a ordem é renumerada (1, 2, 3…) a cada movimento, e o número exibido (#) é a posição real.

- Novo: Arquitetura de Soluções — Modalidade com Dispensa de Licitação, Inexigibilidade e MIP; "Proposta direta" passa a "Proposta Técnica". A modalidade depende do canal: Público com as modalidades de proposta, Privado só com Proposta Comercial (preenchida automaticamente). Requer scripts/dataverse/atualizar-opcoes-bom.ps1.
- Novo: Tipo de projeto com "Locação 48 meses".
- Novo: anexos na Matriz Go/No-Go (SharePoint, biblioteca "Arquitetura de Soluções", pasta Go-No-Go/\<B.O.M.>).
- Melhoria: removidos os campos "Tipo de entrega" e "Pontos estimados" dos Dados da demanda (os valores já gravados são mantidos); a Modalidade passa a ser obrigatória para concluir a etapa.

- Novo: regra de exibição dos campos no editor de fluxo — "Obrigatório quando…" e "Opcional quando…", com "Mostrar quando [campo] for [valor]" editável (ex.: a justificativa da dispensa só aparece quando "Esta revisão exige treinamento?" = Não).

- Novo: em Documentos recentes, a coluna "Etapa atual" mostra em que atividade do fluxo cada documento está (destacada quando aguarda você, com o prazo ao passar o mouse).
- Correção: a coluna Responsável passa a mostrar o responsável pela etapa atual do fluxo (como na tela do documento); o responsável do cadastro aparece ao passar o mouse. A coluna Revisão mostra a revisão em andamento (ex.: Rev.00 após a renumeração).
- Melhoria: removida a coluna lateral da tela de Documentos ("Meus documentos favoritos" e "Links úteis"); a lista passa a ocupar a largura toda.

- Novo: o Catálogo de treinamentos passa a aparecer para o Gestor, mostrando só os treinamentos das áreas dele (áreas de gestão; sem elas, as áreas em que está vinculado). O topo indica as áreas exibidas. O Gestor também pode usar "Testar como colaborador".

## [1.4.13] - 2026-10-23

- Melhoria: ajustes e correções internas.

## [1.4.12] - 2026-10-22

- Melhoria: ajustes e correções internas.

## [1.4.11] - 2026-10-21

- Melhoria: ajustes e correções internas.

## [1.4.10] - 2026-10-21

- Melhoria: ajustes e correções internas.

## [1.4.9] - 2026-10-21

- Melhoria: ajustes e correções internas.

## [1.4.8] - 2026-10-21

- Melhoria: ajustes e correções internas.

## [1.4.7] - 2026-10-19

- Melhoria: ajustes e correções internas.

## [1.4.6] - 2026-10-19

- Novo: Planejamento orçamentário — cada gestor preenche a sua planilha anual (contas do plano de contas × janeiro a dezembro), podendo adicionar e remover linhas, e envia ao concluir.
- Novo: visão "Todas as planilhas" para o Administrador, com consolidado por grupo, consulta de cada planilha, reabertura e exportação CSV no layout da planilha de orçamento.
- Novo: aprovação das planilhas do Planejamento orçamentário pelo fluxo CONT-001, com a tela Aprovações e o painel do fluxo na planilha.
- Novo: etapas do fluxo de aprovação exibidas no Planejamento orçamentário, mostrando em que ponto está cada planilha.
- Novo: painel de Acompanhamento de licitações, com o registro das licitações acompanhadas e um retrato (snapshot) do edital no momento do acompanhamento.
- Novo: aba Estrutura da área em RH e Pessoas, com a hierarquia das áreas e o cargo de cada pessoa na área.
- Novo: scripts criar-tabelas-acompanhamento-licitacoes.ps1 e criar-coluna-cargo-area.ps1 para o Dataverse.
- Melhoria: os responsáveis das etapas do fluxo passam a considerar a hierarquia das áreas.
- Melhoria: análise por IA das licitações ajustada (provedores e montagem da análise).
- Correção: todo treinamento passa a nascer obrigatoriamente vinculado ao fluxo de treinamentos. Antes de criar, o portal confere o tipo TRN, o processo TRE-001 e o fluxo publicado; se o vínculo falhar, a criação é desfeita e nada fica gravado.
- Correção: treinamento fora do fluxo não pode ser ativado nem editado: a lista mostra "⚠ Fora do fluxo de treinamentos" e o botão "Vincular ao fluxo" no lugar de Editar.
- Correção: ajustes na remoção de treinamento na Gestão.

## [1.4.4] - 2026-10-09

- Melhoria: ajustes e correções internas.

## [1.4.3] - 2026-10-09

- Melhoria: ajustes e correções internas.

## [1.4.2] - 2026-10-09

- Melhoria: ajustes e correções internas.

## [1.4.1] - 2026-10-09

- Novo: revisão de treinamento (Rev.01, Rev.02…) com motivo, alterações e opção de retreinar quem já concluiu, sem apagar conclusões anteriores.
- Novo: histórico de revisões do treinamento na Gestão e revisão atual ao lado do código.
- Novo: "Adicionar usuários" em Usuários e acessos, que cadastra no portal com um clique as pessoas já liberadas no ambiente, com opção de vincular à área.
- Novo: parecer "Participar / Não participar" com justificativa e histórico nas licitações, no cartão da busca e na pré-visualização do edital.
- Novo: filtro por parecer na lista de licitações (sem parecer, participar, não participar).
- Novo: módulos concluídos podem ser revisados e as verificações refeitas a qualquer momento, sem alterar a conclusão, a nota ou o certificado.
- Melhoria: certificados em cards com prévia do PDF, selo de validade, filtros, busca e visualização dentro do portal.
- Melhoria: a tela Certificados mostra o número, a revisão do treinamento em que o colaborador foi treinado e abre/baixa o PDF gerado pelo fluxo.
- Melhoria: o código do treinamento aparece nos cards de Meus treinamentos.
- Melhoria: a tela Novidades mostra 5 itens por versão, com "Ver mais".
- Correção: "Concluir módulo" grava a conclusão e o progresso do treinamento é calculado pelos módulos concluídos (antes ficava fixo em 50% na tela inicial).
- Correção: o módulo só pode ser concluído dentro dele, depois de responder corretamente as perguntas obrigatórias.
- Correção: a avaliação é liberada ao concluir os módulos obrigatórios, abre a avaliação ativa que tem questões e mostra o motivo real quando não pode ser aberta.
- Correção: atribuir um treinamento que o usuário já possui (por outra trilha ou individualmente) não cria mais duplicidade.

## [1.4.0] - 2026-10-08

- Novo: tela Registros de Oportunidade no módulo Arquitetura de Soluções, centralizando as oportunidades vinculadas aos B.O.M.
- Novo: integração com registros de oportunidade (R.O.) para carregar e utilizar dados da demanda no fluxo de Arquitetura de Soluções.
- Melhoria: Matriz Go/No-Go atualizada para utilizar as informações da oportunidade e apoiar a avaliação da demanda.
- Melhoria: navegação do módulo Arquitetura de Soluções ampliada com novas rotas e acesso aos Registros de Oportunidade.
- Melhoria: controle de acesso ao módulo Arquitetura ajustado nas telas Usuários e acessos, menus e permissões de rota.
- Melhoria: interface e ícones do módulo Arquitetura atualizados para manter o padrão visual do Portal DGT.
- Novo: integração dos Indicadores com o ClickUp, com sincronização de dados para acompanhamento das iniciativas e resultados no portal.
- Novo: plugin de sincronização com o ClickUp e documentação técnica da integração dos Indicadores.
- Novo: configuração avançada da Pergunta rápida nos módulos, com modal próprio para definir e editar as opções da atividade.
- Melhoria: gestão de módulos e avaliações aprimorada, com ações reorganizadas e edição de conteúdos mais consistente.
- Melhoria: controle de acesso aos Indicadores refinado, respeitando perfil do usuário, permissões por módulo e papéis por área.
- Melhoria: tela Usuários e acessos atualizada para facilitar a administração das permissões dos módulos do portal.
- Melhoria: navegação e permissões das rotas ajustadas para refletir corretamente os módulos disponíveis para cada usuário.
- Novo: script para adicionar o papel de Editor de Área no Dataverse, permitindo ampliar a configuração de permissões por área.
- Correção: Indicadores (dados sensíveis) liberados por padrão só para Gestores e Administradores; Colaboradores e Editores acessam apenas com o módulo marcado em Usuários e acessos.
- Novo: módulo Arquitetura de Soluções, com a Visão geral dos B.O.M., Novo B.O.M., Dados da demanda e Matriz Go/No-Go (seleção de kit e cálculo de HH em definição).
- Novo: colunas "Criado em" e "Vencimento" na lista de documentos e no detalhe; o documento deve ser revisado 1 ano após a criação ou a última publicação, com aviso nos últimos 30 dias e quando vencido.
- Correção: a publicação pelo fluxo do processo passa a definir o prazo da próxima revisão (periodicidade de 12 meses).

## [1.3.0] - 2026-10-06

- Melhoria: histórico único na aba Histórico, no formato da tramitação, com quem executou cada ação e quem disparou os passos automáticos.
- Melhoria: o primeiro evento do histórico aparece como "Documento criado".
- Melhoria: ao criar um documento, ele abre direto na primeira etapa do fluxo, e a lista de documentos já mostra o novo documento.
- Melhoria: no Novo documento, o campo Aprovador passou a ser "Gestor da área"; quem executa cada etapa é definido no fluxo do processo.
- Melhoria: a aba Fluxo de revisão mostra o desenho do fluxo; a etapa atual, os metadados e os botões ficam na aba Revisão.
- Melhoria: a aba Fluxo de revisão sempre mostra o fluxo; sem revisão em andamento, exibe o caminho percorrido pela última revisão.
- Melhoria: a caixa de responsável mostra quem responde pela etapa atual — o criador, o usuário, a área (todos da área podem executar) ou o gestor da área.
- Correção: os metadados preenchidos em uma etapa seguem para as próximas etapas.
- Correção: o novo documento é vinculado ao processo antes de abrir, e a aba Revisão já mostra a etapa do fluxo.
- Correção: a publicação do fluxo é bloqueada quando uma etapa "Vigente" leva a outra etapa "Vigente".

## [1.2.0] - 2026-10-05

- Melhoria: ajustes e correções internas.

## [1.1.0] - 2026-10-05

- Novo: menu do usuário (clique no nome, no topo) com Meu perfil, Usuários e acessos e Áreas e acessos.
- Novo: tela Meu perfil, com as áreas, o papel em cada área e o que o usuário acessa no portal.
- Novo: tela Usuários e acessos para administradores (todos os usuários) e gestores (somente as pessoas das suas áreas), com perfil no portal, papéis por área e módulos.
- Novo: papel por área — a mesma pessoa pode ser Membro em uma área e Gestor em outra; ser Gestor de uma área libera equipe, atribuição, aprovação e gestão de pessoas somente naquela área.
- Novo: módulos liberados por usuário (Treinamentos, Documentos, Processos, Licitações e Indicadores); módulos não liberados somem do menu.
- Novo: script scripts/dataverse/criar-coluna-modulos-acesso.ps1, que cria a coluna "Módulos de acesso" na tabela Usuário.
- Novo: módulo Licitações, com busca de oportunidades no PNCP por assunto, UF, período, modalidades, palavras, valor e score de aderência.
- Novo: teste de conexão com o PNCP na aba Licitações, com diagnóstico de rede e CORS.
- Novo: pré-visualização do edital com resumo, ficha técnica, itens, documentos e o edital aberto dentro do portal.
- Novo: "Copiar resumo" e "Imprimir ficha" do edital, e relatório da busca para salvar em PDF.
- Novo: módulo Processos no menu, com área, metadados e documentos vinculados a cada processo.
- Novo: editor visual do fluxo de revisão de cada processo, com etapas, decisões, caminhos, responsáveis, prazos e botões configuráveis.
- Novo: versões do fluxo do processo (rascunho, publicada e arquivada); revisões em andamento continuam na versão em que começaram.
- Novo: consulta da configuração de cada etapa, decisão e evento nas versões publicadas e arquivadas do fluxo (somente leitura).
- Novo: metadados do processo, inclusive o tipo Tabela, exibidos nas etapas na ordem definida no processo.
- Novo: evento de revisão no fluxo (círculo com "R"), com os tipos Sub-revisão, Revisão, Nova revisão e Fechar revisão.
- Novo: numeração de revisão e sub-revisão — o documento nasce Rev.00A, cada ajuste gera a próxima letra (00B, 00C) e a aprovação fecha no número (Rev.00); a revisão seguinte nasce Rev.01A.
- Novo: status "Vigente" na etapa do fluxo: ao chegar nela a revisão é publicada e o fluxo da revisão termina.
- Novo: o retreinamento na publicação é decidido pelo caminho do fluxo (ex.: passar por "Revisar Treinamento").
- Novo: confirmação ao clicar em uma ação do fluxo, mostrando a próxima atividade, o responsável, o prazo, a mudança de número da revisão e o que o sistema fará automaticamente, com o comentário.
- Novo: no Novo documento é possível escolher o processo, e o Aprovador passa a ser o responsável da etapa de aprovação do fluxo.
- Novo: revisões de documentos vinculados a um processo seguem as etapas do fluxo, com as ações da etapa direto na aba Revisão.
- Novo: aba "Fluxo de revisão" no documento, com o desenho do fluxo, a etapa atual e o histórico da tramitação.
- Novo: a publicação da revisão é feita pelo fluxo, com ou sem retreinamento, e o status do documento acompanha cada etapa.
- Novo: setas ‹ › para navegar entre as revisões do documento e lista dos números anteriores da revisão.
- Novo: a aba Histórico do documento mostra todos os passos do fluxo, com o número da revisão de cada momento.
- Melhoria: cores no histórico — verde para aprovação, vermelho para reprovação, laranja para sub-revisão, índigo para revisão e verde escuro para publicação.
- Melhoria: tela de detalhe do documento mais limpa, sem informações repetidas e com campos exibidos só quando têm valor.
- Melhoria: os caminhos de uma decisão mostram o percurso depois dos eventos (ex.: "→ Revisão → Elaboração"), evitando confundir destinos com o mesmo nome.
- Melhoria: membros da área veem todos os documentos da área, e quem responde por uma etapa vê o documento mesmo fora da sua área.
- Melhoria: "Minhas pendências" mostra as etapas do fluxo que aguardam o usuário.
- Melhoria: a barra de resumo do documento mostra o responsável pelo documento, e o responsável da etapa aparece no quadro do fluxo.
- Correção: uma reprovação nunca conclui, publica ou avança o documento; o fluxo é bloqueado na publicação da versão e na execução.
- Correção: a aprovação nunca pula número de revisão (Rev.00A → Rev.00, e não Rev.01).
- Correção: a revisão publicada nunca fica com letra (Rev.01B é publicada como Rev.01).
- Correção: a gravação do fluxo não é mais recusada como conflito depois das tarefas automáticas.
- Correção: "Criar treinamento" sempre abre um cadastro em branco, e não o último treinamento editado.
- Correção: a pré-visualização do edital não fica mais cortada nem atrás da barra do SharePoint.
- Correção: Licitações aparece no menu somente para quem tem o módulo liberado, igual ao que mostra o perfil.
- Correção: o "Autor da revisão" é quem criou a revisão, e somente os responsáveis da etapa veem os botões de ação.
- Correção: as pendências de revisões com fluxo vão para os responsáveis da etapa, e não para o aprovador do cadastro.
- Correção: o Novo documento não falha mais quando sobrou um arquivo de uma tentativa anterior, nem cria documento sem revisão se o envio do arquivo falhar.
- Melhoria: ações secundárias agrupadas no menu ⋮ (módulos: Desativar e Remover; treinamentos: Histórico, Desativar e Remover).
- Novo: remover módulo (somente administradores, para módulos que nenhum colaborador iniciou).
- Novo: arrastar e soltar os módulos para mudar a ordem.
- Correção: a numeração dos módulos segue a posição e nunca se repete.
- Novo: controle de versão do portal, com número visível e tela de Novidades.
- Novo: botão Remover treinamento (somente administradores, para treinamentos nunca atribuídos).
- Novo: capa do treinamento na lista da Gestão e descrição com "Ver mais".
- Melhoria: áreas da tela Documentos em formato compacto, com busca e "Mostrar todas".
- Novo: aba Catálogo e modo de teste do treinamento (visão do colaborador, sem registros).
- Correção: editar um treinamento não cria mais uma cópia.
- Correção: validação do tamanho e conversão automática do link da imagem do SharePoint.