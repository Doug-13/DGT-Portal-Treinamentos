using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API: dgt_GerarQuestoesIA
    //
    // Gera questões de avaliação com o Claude (API da Anthropic) a
    // partir do conteúdo dos MÓDULOS do treinamento.
    //
    // Entrada  : PayloadJson  (String)
    //   { "treinamentoId": "...", "avaliacaoId": "...",
    //     "quantidade": 10, "instrucoes": "..." }
    // Saída    : ResultadoJson (String)
    //   { "sucesso": true, "modelo": "...", "questoes": [...],
    //     "avisos": [...], "tokensEntrada": 0, "tokensSaida": 0 }
    //
    // O plugin NÃO grava questões. Ele devolve uma prévia; o portal
    // mostra para revisão e grava as questões aprovadas.
    //
    // Configuração (variáveis de ambiente da solução):
    //   dgt_ClaudeApiKey  (Tipo SECRETO, Azure Key Vault)  obrigatória
    //   dgt_ClaudeModelo  (Texto)                           opcional
    //
    // A chave da API nunca vai para o navegador.
    // ================================================================
    public sealed class GerarQuestoesIAPlugin : IPlugin
    {
        private const string UrlApi = "https://api.anthropic.com/v1/messages";
        private const string VersaoApi = "2023-06-01";
        private const string ModeloPadrao = "claude-sonnet-5-5";

        private const string VariavelChave = "dgt_ClaudeApiKey";
        private const string VariavelModelo = "dgt_ClaudeModelo";

        private const int QuantidadeMaxima = 20;
        private const int LimiteContexto = 80000;
        private const int LimiteConteudo = 12000;
        private const int MaxTokensResposta = 12000;

        // O limite de um plugin síncrono é 2 minutos.
        private static readonly TimeSpan TempoLimite = TimeSpan.FromSeconds(105);

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var tracing =
                (ITracingService)serviceProvider.GetService(
                    typeof(ITracingService));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            // Lê o conteúdo com as permissões de quem chamou.
            var service =
                factory.CreateOrganizationService(
                    context.UserId);

            // Lê as variáveis de ambiente como SYSTEM.
            var sistema =
                factory.CreateOrganizationService(
                    null);

            try
            {
                var payloadJson =
                    context.InputParameters.Contains("PayloadJson")
                        ? context.InputParameters["PayloadJson"] as string
                        : null;

                if (string.IsNullOrWhiteSpace(payloadJson))
                {
                    throw new InvalidPluginExecutionException(
                        "PayloadJson não foi informado.");
                }

                var payload =
                    Json.Ler<PayloadGeracao>(
                        payloadJson);

                var resultado =
                    Processar(
                        service,
                        sistema,
                        tracing,
                        payload);

                context.OutputParameters["ResultadoJson"] =
                    Json.Escrever(
                        resultado);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                tracing.Trace("GerarQuestoesIAPlugin: {0}", ex);

                throw new InvalidPluginExecutionException(
                    "Não foi possível gerar as questões: " + ex.Message,
                    ex);
            }
        }

        // ============================================================
        // PROCESSAMENTO
        // ============================================================

        private static ResultadoGeracao Processar(
            IOrganizationService service,
            IOrganizationService sistema,
            ITracingService tracing,
            PayloadGeracao payload)
        {
            if (payload == null ||
                !Guid.TryParse(
                    payload.treinamentoId,
                    out var treinamentoId))
            {
                throw new InvalidPluginExecutionException(
                    "Treinamento não informado.");
            }

            var quantidade =
                Math.Max(
                    1,
                    Math.Min(
                        payload.quantidade <= 0 ? 10 : payload.quantidade,
                        QuantidadeMaxima));

            var avisos =
                new List<string>();

            // 1. Conteúdo dos módulos
            var treinamento =
                service.Retrieve(
                    "dgt_treinamento",
                    treinamentoId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_descricao"));

            var contexto =
                MontarContexto(
                    service,
                    treinamentoId,
                    treinamento,
                    avisos);

            if (contexto.Texto.Length < 300)
            {
                throw new InvalidPluginExecutionException(
                    $"Os módulos deste treinamento têm pouco conteúdo em texto ({contexto.Texto.Length} caracteres; mínimo 300). " +
                    "Cadastre textos, cards ou destaques nos conteúdos dos módulos (vídeos, PDFs e links não são lidos).");
            }

            // 2. Questões já existentes (para não repetir)
            var existentes =
                Guid.TryParse(
                    payload.avaliacaoId,
                    out var avaliacaoId)
                    ? ObterEnunciadosExistentes(
                        service,
                        avaliacaoId)
                    : new List<string>();

            // 3. Chamada ao Claude
            var chave =
                ObterSegredo(
                    sistema,
                    VariavelChave);

            var modelo =
                ObterVariavelTexto(
                    sistema,
                    VariavelModelo) ??
                ModeloPadrao;

            var prompt =
                MontarPrompt(
                    treinamento.GetAttributeValue<string>("dgt_name"),
                    contexto.Texto,
                    quantidade,
                    payload.instrucoes,
                    existentes);

            tracing.Trace(
                "Chamando {0}. Contexto: {1} caracteres, {2} módulo(s).",
                modelo,
                contexto.Texto.Length,
                contexto.Modulos);

            var resposta =
                ChamarClaude(
                    chave,
                    modelo,
                    prompt);

            if (string.Equals(
                    resposta.stop_reason,
                    "max_tokens",
                    StringComparison.OrdinalIgnoreCase))
            {
                avisos.Add(
                    "A resposta atingiu o limite de tamanho. Gere menos questões por vez.");
            }

            var bruto =
                (resposta.content ?? new List<BlocoConteudo>())
                    .Where(b => b.type == "tool_use" && b.input != null)
                    .SelectMany(b => b.input.questoes ?? new List<QuestaoIA>())
                    .ToList();

            // 4. Validação e normalização
            var questoes =
                Validar(
                    bruto,
                    existentes,
                    avisos);

            if (questoes.Count == 0)
            {
                throw new InvalidPluginExecutionException(
                    "O Claude não retornou questões válidas. Tente novamente ou ajuste as instruções.");
            }

            return new ResultadoGeracao
            {
                sucesso = true,
                modelo = resposta.model ?? modelo,
                questoes = questoes,
                avisos = avisos,
                modulosLidos = contexto.Modulos,
                tokensEntrada = resposta.usage?.input_tokens ?? 0,
                tokensSaida = resposta.usage?.output_tokens ?? 0
            };
        }

        // ============================================================
        // CONTEXTO (texto dos módulos)
        // ============================================================

        private sealed class Contexto
        {
            public string Texto;
            public int Modulos;
        }

        private static Contexto MontarContexto(
            IOrganizationService service,
            Guid treinamentoId,
            Entity treinamento,
            List<string> avisos)
        {
            var sb =
                new StringBuilder();

            sb.AppendLine("# Treinamento: " + (treinamento.GetAttributeValue<string>("dgt_name") ?? ""));

            var descricaoTreinamento =
                LimparTexto(
                    treinamento.GetAttributeValue<string>("dgt_descricao"));

            if (!string.IsNullOrWhiteSpace(descricaoTreinamento))
            {
                sb.AppendLine("Descrição: " + descricaoTreinamento);
            }

            var consultaModulos =
                new QueryExpression("dgt_modulo")
                {
                    // dgt_modulo usa dgt_titulo como coluna de nome (não tem dgt_name).
                    ColumnSet = new ColumnSet("dgt_titulo", "dgt_descricao", "dgt_ordem")
                };

            consultaModulos.Criteria.AddCondition("dgt_treinamento", ConditionOperator.Equal, treinamentoId);
            consultaModulos.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            consultaModulos.AddOrder("dgt_ordem", OrderType.Ascending);

            var modulos =
                service.RetrieveMultiple(consultaModulos).Entities;

            if (modulos.Count == 0)
            {
                throw new InvalidPluginExecutionException(
                    "O treinamento não possui módulos ativos. Crie os módulos antes de gerar as questões.");
            }

            var numero = 0;
            var cortado = false;

            foreach (var modulo in modulos)
            {
                numero++;

                sb.AppendLine();
                sb.AppendLine($"## Módulo {numero}: {modulo.GetAttributeValue<string>("dgt_titulo")}");

                var descricao =
                    LimparTexto(
                        modulo.GetAttributeValue<string>("dgt_descricao"));

                if (!string.IsNullOrWhiteSpace(descricao))
                {
                    sb.AppendLine(descricao);
                }

                var consultaConteudos =
                    new QueryExpression("dgt_moduloconteudo")
                    {
                        ColumnSet = new ColumnSet("dgt_name", "dgt_titulo", "dgt_conteudo", "dgt_ordem", "dgt_ativo")
                    };

                consultaConteudos.Criteria.AddCondition("dgt_modulo", ConditionOperator.Equal, modulo.Id);
                consultaConteudos.AddOrder("dgt_ordem", OrderType.Ascending);

                foreach (var conteudo in service.RetrieveMultiple(consultaConteudos).Entities)
                {
                    if (conteudo.GetAttributeValue<bool?>("dgt_ativo") == false)
                    {
                        continue;
                    }

                    var texto =
                        TextoDoConteudo(
                            conteudo.GetAttributeValue<string>("dgt_conteudo"));

                    if (string.IsNullOrWhiteSpace(texto))
                    {
                        continue;
                    }

                    if (texto.Length > LimiteConteudo)
                    {
                        texto = texto.Substring(0, LimiteConteudo) + "…";
                    }

                    var titulo =
                        conteudo.GetAttributeValue<string>("dgt_titulo") ??
                        conteudo.GetAttributeValue<string>("dgt_name");

                    sb.AppendLine();
                    sb.AppendLine("### " + titulo);
                    sb.AppendLine(texto);

                    if (sb.Length > LimiteContexto)
                    {
                        cortado = true;
                        break;
                    }
                }

                if (cortado)
                {
                    break;
                }
            }

            if (cortado)
            {
                avisos.Add(
                    "O conteúdo dos módulos é extenso e foi parcialmente considerado. " +
                    "As questões podem não cobrir os módulos finais.");
            }

            var textoFinal =
                sb.ToString();

            if (textoFinal.Length > LimiteContexto)
            {
                textoFinal = textoFinal.Substring(0, LimiteContexto);
            }

            return new Contexto
            {
                Texto = MascararDadosPessoais(textoFinal),
                Modulos = numero
            };
        }

        // Conteúdos do tipo "Cards" são gravados pelo portal como
        //   __DGT_CARDS__:[{"numero":"01","titulo":"...","descricao":"..."}]
        // Aqui o JSON vira texto legível para o Claude.
        private const string MarcadorCards = "__DGT_CARDS__:";

        private static string TextoDoConteudo(
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            if (!valor.StartsWith(MarcadorCards, StringComparison.Ordinal))
            {
                return LimparTexto(valor);
            }

            try
            {
                var cards =
                    Json.Ler<List<CardConteudo>>(
                        valor.Substring(MarcadorCards.Length));

                var sb = new StringBuilder();

                foreach (var card in cards ?? new List<CardConteudo>())
                {
                    var titulo = LimparTexto(card?.titulo);
                    var descricao = LimparTexto(card?.descricao);

                    if (string.IsNullOrWhiteSpace(titulo) && string.IsNullOrWhiteSpace(descricao))
                    {
                        continue;
                    }

                    sb.AppendLine($"- {titulo}: {descricao}");
                }

                return sb.ToString().Trim();
            }
            catch
            {
                // JSON inválido: usa o texto bruto sem o marcador.
                return LimparTexto(valor.Substring(MarcadorCards.Length));
            }
        }

        // Remove HTML (o editor de conteúdo grava HTML) e normaliza espaços.
        private static string LimparTexto(
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            var texto =
                Regex.Replace(valor, @"<\s*(br|/p|/div|/li|/h[1-6])\s*/?>", "\n", RegexOptions.IgnoreCase);

            texto = Regex.Replace(texto, @"<\s*li[^>]*>", "- ", RegexOptions.IgnoreCase);
            texto = Regex.Replace(texto, "<[^>]+>", " ");
            texto = WebUtility.HtmlDecode(texto);
            texto = Regex.Replace(texto, @"[ \t]+", " ");
            texto = Regex.Replace(texto, @"\n\s*\n\s*\n+", "\n\n");

            return texto.Trim();
        }

        // Política da DGT: não enviar dados pessoais sensíveis a serviços
        // externos. Mascara CPF, CNPJ e e-mails eventualmente presentes.
        private static string MascararDadosPessoais(
            string texto)
        {
            texto = Regex.Replace(texto, @"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "[CPF removido]");
            texto = Regex.Replace(texto, @"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", "[CNPJ removido]");
            texto = Regex.Replace(texto, @"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[e-mail removido]");

            return texto;
        }

        private static List<string> ObterEnunciadosExistentes(
            IOrganizationService service,
            Guid avaliacaoId)
        {
            var consulta =
                new QueryExpression("dgt_questao")
                {
                    ColumnSet = new ColumnSet("dgt_enunciado"),
                    TopCount = 200
                };

            consulta.Criteria.AddCondition("dgt_avaliacao", ConditionOperator.Equal, avaliacaoId);
            consulta.Criteria.AddCondition("dgt_ativa", ConditionOperator.Equal, true);

            return service
                .RetrieveMultiple(consulta)
                .Entities
                .Select(e => LimparTexto(e.GetAttributeValue<string>("dgt_enunciado")))
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .ToList();
        }

        // ============================================================
        // PROMPT
        // ============================================================

        private const string PromptSistema =
            "Você é um especialista em educação corporativa da DGT e elabora avaliações de treinamentos. " +
            "Crie questões objetivas, claras e em português do Brasil, baseadas EXCLUSIVAMENTE no conteúdo " +
            "fornecido. Não use conhecimento externo, não invente procedimentos, números ou regras que não " +
            "estejam no conteúdo. Cada questão deve avaliar compreensão ou aplicação prática, não memorização " +
            "de detalhes irrelevantes. As alternativas incorretas devem ser plausíveis. Evite 'todas as " +
            "anteriores', 'nenhuma das anteriores', pegadinhas e negativas duplas. Distribua as questões entre " +
            "todos os módulos. Registre as questões usando a ferramenta registrar_questoes.";

        private static string MontarPrompt(
            string nomeTreinamento,
            string contexto,
            int quantidade,
            string instrucoes,
            List<string> existentes)
        {
            var sb =
                new StringBuilder();

            sb.AppendLine($"Elabore {quantidade} questões para a avaliação do treinamento \"{nomeTreinamento}\".");
            sb.AppendLine();
            sb.AppendLine("Regras:");
            sb.AppendLine("- Tipos permitidos: \"Escolha única\" (4 alternativas, exatamente 1 correta), " +
                          "\"Múltipla escolha\" (4 ou 5 alternativas, 2 ou mais corretas) e " +
                          "\"Verdadeiro/Falso\" (alternativas \"Verdadeiro\" e \"Falso\", 1 correta).");
            sb.AppendLine("- Priorize \"Escolha única\" (cerca de 70% das questões).");
            sb.AppendLine("- Em \"explicacao\", explique em 1 ou 2 frases por que a resposta está correta, citando o conteúdo.");
            sb.AppendLine("- Em \"modulo\", informe o nome do módulo de onde a questão foi tirada.");

            if (!string.IsNullOrWhiteSpace(instrucoes))
            {
                sb.AppendLine();
                sb.AppendLine("Instruções adicionais do responsável pelo treinamento:");
                sb.AppendLine(instrucoes.Trim().Length > 1500
                    ? instrucoes.Trim().Substring(0, 1500)
                    : instrucoes.Trim());
            }

            if (existentes.Count > 0)
            {
                sb.AppendLine();
                sb.AppendLine("Estas questões JÁ EXISTEM no banco. Não repita nem crie variações muito parecidas:");

                foreach (var enunciado in existentes.Take(80))
                {
                    sb.AppendLine("- " + (enunciado.Length > 200 ? enunciado.Substring(0, 200) : enunciado));
                }
            }

            sb.AppendLine();
            sb.AppendLine("<conteudo_do_treinamento>");
            sb.AppendLine(contexto);
            sb.AppendLine("</conteudo_do_treinamento>");

            return sb.ToString();
        }

        // ============================================================
        // API DA ANTHROPIC
        // ============================================================

        private const string DefinicaoFerramenta =
            "{\"name\":\"registrar_questoes\"," +
            "\"description\":\"Registra as questões elaboradas para a avaliação.\"," +
            "\"input_schema\":{\"type\":\"object\",\"properties\":{\"questoes\":{\"type\":\"array\",\"items\":{" +
            "\"type\":\"object\",\"properties\":{" +
            "\"enunciado\":{\"type\":\"string\"}," +
            "\"tipo\":{\"type\":\"string\",\"enum\":[\"Escolha única\",\"Múltipla escolha\",\"Verdadeiro/Falso\"]}," +
            "\"alternativas\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{" +
            "\"texto\":{\"type\":\"string\"},\"correta\":{\"type\":\"boolean\"}},\"required\":[\"texto\",\"correta\"]}}," +
            "\"explicacao\":{\"type\":\"string\"}," +
            "\"modulo\":{\"type\":\"string\"}}," +
            "\"required\":[\"enunciado\",\"tipo\",\"alternativas\",\"explicacao\"]}}}," +
            "\"required\":[\"questoes\"]}}";

        private static RespostaClaude ChamarClaude(
            string chave,
            string modelo,
            string prompt)
        {
            var corpo =
                "{" +
                "\"model\":" + Json.Texto(modelo) + "," +
                "\"max_tokens\":" + MaxTokensResposta + "," +
                "\"system\":" + Json.Texto(PromptSistema) + "," +
                "\"tools\":[" + DefinicaoFerramenta + "]," +
                "\"tool_choice\":{\"type\":\"tool\",\"name\":\"registrar_questoes\"}," +
                "\"messages\":[{\"role\":\"user\",\"content\":" + Json.Texto(prompt) + "}]" +
                "}";

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            using (var http = new HttpClient { Timeout = TempoLimite })
            using (var requisicao = new HttpRequestMessage(HttpMethod.Post, UrlApi))
            {
                requisicao.Headers.Add("x-api-key", chave);
                requisicao.Headers.Add("anthropic-version", VersaoApi);
                requisicao.Content = new StringContent(corpo, Encoding.UTF8, "application/json");

                HttpResponseMessage resposta;

                try
                {
                    resposta = http.SendAsync(requisicao).GetAwaiter().GetResult();
                }
                catch (System.Threading.Tasks.TaskCanceledException)
                {
                    throw new InvalidPluginExecutionException(
                        "O Claude demorou demais para responder. Gere menos questões por vez.");
                }

                var texto =
                    resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();

                if (!resposta.IsSuccessStatusCode)
                {
                    throw new InvalidPluginExecutionException(
                        TraduzirErro((int)resposta.StatusCode, texto));
                }

                return Json.Ler<RespostaClaude>(texto);
            }
        }

        private static string TraduzirErro(
            int status,
            string corpo)
        {
            var detalhe = string.Empty;

            try
            {
                detalhe = Json.Ler<ErroClaude>(corpo)?.error?.message ?? string.Empty;
            }
            catch
            {
                // corpo não é JSON
            }

            switch (status)
            {
                case 400:
                    return "Requisição recusada pelo Claude: " + detalhe;
                case 401:
                    return "Chave da API do Claude inválida. Verifique a variável de ambiente dgt_ClaudeApiKey.";
                case 403:
                    return "A chave da API do Claude não tem permissão para esta operação: " + detalhe;
                case 404:
                    return "Modelo do Claude não encontrado. Verifique a variável de ambiente dgt_ClaudeModelo: " + detalhe;
                case 429:
                    return "Limite de uso da API do Claude atingido. Aguarde alguns minutos e tente novamente.";
                case 529:
                case 503:
                    return "O serviço do Claude está sobrecarregado no momento. Tente novamente em instantes.";
                default:
                    return $"Erro {status} ao chamar o Claude: {detalhe}";
            }
        }

        // ============================================================
        // VALIDAÇÃO
        // ============================================================

        private static List<QuestaoGerada> Validar(
            List<QuestaoIA> bruto,
            List<string> existentes,
            List<string> avisos)
        {
            var resultado =
                new List<QuestaoGerada>();

            var vistos =
                new HashSet<string>(
                    existentes.Select(Chave));

            var descartadas = 0;

            foreach (var q in bruto)
            {
                var enunciado =
                    (q?.enunciado ?? string.Empty).Trim();

                if (enunciado.Length < 10)
                {
                    descartadas++;
                    continue;
                }

                if (!vistos.Add(Chave(enunciado)))
                {
                    descartadas++;
                    continue;
                }

                var tipo =
                    NormalizarTipo(q.tipo);

                var alternativas =
                    (q.alternativas ?? new List<AlternativaIA>())
                        .Where(a => !string.IsNullOrWhiteSpace(a?.texto))
                        .Select(a => new AlternativaGerada
                        {
                            texto = a.texto.Trim(),
                            correta = a.correta
                        })
                        .Take(6)
                        .ToList();

                if (tipo == "Verdadeiro/Falso")
                {
                    var verdadeiraCorreta =
                        alternativas.FirstOrDefault(a => Chave(a.texto).StartsWith("verdadeir"))?.correta ??
                        alternativas.FirstOrDefault()?.correta ??
                        true;

                    alternativas = new List<AlternativaGerada>
                    {
                        new AlternativaGerada { texto = "Verdadeiro", correta = verdadeiraCorreta },
                        new AlternativaGerada { texto = "Falso", correta = !verdadeiraCorreta }
                    };
                }

                var corretas =
                    alternativas.Count(a => a.correta);

                var valida =
                    alternativas.Count >= 2 &&
                    corretas >= 1 &&
                    (tipo == "Múltipla escolha" || corretas == 1);

                if (!valida)
                {
                    descartadas++;
                    continue;
                }

                // Múltipla escolha com uma só correta vira Escolha única.
                if (tipo == "Múltipla escolha" && corretas == 1)
                {
                    tipo = "Escolha única";
                }

                resultado.Add(
                    new QuestaoGerada
                    {
                        enunciado = enunciado,
                        tipo = tipo,
                        alternativas = alternativas,
                        explicacao = (q.explicacao ?? string.Empty).Trim(),
                        modulo = (q.modulo ?? string.Empty).Trim()
                    });
            }

            if (descartadas > 0)
            {
                avisos.Add(
                    $"{descartadas} questão(ões) foram descartadas por estarem incompletas, repetidas ou com gabarito inválido.");
            }

            return resultado;
        }

        private static string NormalizarTipo(
            string tipo)
        {
            var t = Chave(tipo);

            if (t.StartsWith("multipla")) return "Múltipla escolha";
            if (t.StartsWith("verdadeiro")) return "Verdadeiro/Falso";

            return "Escolha única";
        }

        private static string Chave(
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            var decomposto =
                valor.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);

            var semAcento =
                new string(
                    decomposto
                        .Where(c =>
                            System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) !=
                            System.Globalization.UnicodeCategory.NonSpacingMark)
                        .ToArray());

            return Regex.Replace(semAcento, @"[^a-z0-9]+", " ").Trim();
        }

        // ============================================================
        // VARIÁVEIS DE AMBIENTE
        // ============================================================

        private static string ObterSegredo(
            IOrganizationService sistema,
            string nomeEsquema)
        {
            try
            {
                var requisicao =
                    new OrganizationRequest("RetrieveEnvironmentVariableSecretValue");

                requisicao["EnvironmentVariableName"] = nomeEsquema;

                var resposta =
                    sistema.Execute(requisicao);

                var valor =
                    resposta.Results.Contains("EnvironmentVariableSecretValue")
                        ? resposta.Results["EnvironmentVariableSecretValue"] as string
                        : null;

                if (!string.IsNullOrWhiteSpace(valor))
                {
                    return valor.Trim();
                }
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException(
                    $"Não foi possível ler a chave da API do Claude (variável de ambiente {nomeEsquema}). " +
                    "Confira se ela é do tipo Segredo e se o Key Vault está configurado. Detalhe: " + ex.Message,
                    ex);
            }

            throw new InvalidPluginExecutionException(
                $"A variável de ambiente {nomeEsquema} está vazia.");
        }

        private static string ObterVariavelTexto(
            IOrganizationService sistema,
            string nomeEsquema)
        {
            var consulta =
                new QueryExpression("environmentvariabledefinition")
                {
                    ColumnSet = new ColumnSet("defaultvalue"),
                    TopCount = 1
                };

            consulta.Criteria.AddCondition("schemaname", ConditionOperator.Equal, nomeEsquema);

            var valor =
                consulta.AddLink(
                    "environmentvariablevalue",
                    "environmentvariabledefinitionid",
                    "environmentvariabledefinitionid",
                    JoinOperator.LeftOuter);

            valor.Columns = new ColumnSet("value");
            valor.EntityAlias = "v";

            var definicao =
                sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();

            if (definicao == null)
            {
                return null;
            }

            var atual =
                definicao.GetAttributeValue<AliasedValue>("v.value")?.Value as string;

            var resultado =
                !string.IsNullOrWhiteSpace(atual)
                    ? atual
                    : definicao.GetAttributeValue<string>("defaultvalue");

            return string.IsNullOrWhiteSpace(resultado)
                ? null
                : resultado.Trim();
        }

        // ============================================================
        // CONTRATOS JSON
        // Públicos de propósito: o sandbox do Dataverse executa em
        // confiança parcial e o DataContractJsonSerializer só
        // serializa tipos públicos nesse modo.
        // ============================================================

        [DataContract]
        public sealed class CardConteudo
        {
            [DataMember] public string numero { get; set; }
            [DataMember] public string titulo { get; set; }
            [DataMember] public string descricao { get; set; }
        }

        [DataContract]
        public sealed class PayloadGeracao
        {
            [DataMember] public string treinamentoId { get; set; }
            [DataMember] public string avaliacaoId { get; set; }
            [DataMember] public int quantidade { get; set; }
            [DataMember] public string instrucoes { get; set; }
        }

        [DataContract]
        public sealed class ResultadoGeracao
        {
            [DataMember] public bool sucesso { get; set; }
            [DataMember] public string modelo { get; set; }
            [DataMember] public List<QuestaoGerada> questoes { get; set; }
            [DataMember] public List<string> avisos { get; set; }
            [DataMember] public int modulosLidos { get; set; }
            [DataMember] public int tokensEntrada { get; set; }
            [DataMember] public int tokensSaida { get; set; }
        }

        [DataContract]
        public sealed class QuestaoGerada
        {
            [DataMember] public string enunciado { get; set; }
            [DataMember] public string tipo { get; set; }
            [DataMember] public List<AlternativaGerada> alternativas { get; set; }
            [DataMember] public string explicacao { get; set; }
            [DataMember] public string modulo { get; set; }
        }

        [DataContract]
        public sealed class AlternativaGerada
        {
            [DataMember] public string texto { get; set; }
            [DataMember] public bool correta { get; set; }
        }

        [DataContract]
        public sealed class RespostaClaude
        {
            [DataMember] public string model { get; set; }
            [DataMember] public string stop_reason { get; set; }
            [DataMember] public List<BlocoConteudo> content { get; set; }
            [DataMember] public Uso usage { get; set; }
        }

        [DataContract]
        public sealed class BlocoConteudo
        {
            [DataMember] public string type { get; set; }
            [DataMember] public EntradaFerramenta input { get; set; }
        }

        [DataContract]
        public sealed class EntradaFerramenta
        {
            [DataMember] public List<QuestaoIA> questoes { get; set; }
        }

        [DataContract]
        public sealed class QuestaoIA
        {
            [DataMember] public string enunciado { get; set; }
            [DataMember] public string tipo { get; set; }
            [DataMember] public List<AlternativaIA> alternativas { get; set; }
            [DataMember] public string explicacao { get; set; }
            [DataMember] public string modulo { get; set; }
        }

        [DataContract]
        public sealed class AlternativaIA
        {
            [DataMember] public string texto { get; set; }
            [DataMember] public bool correta { get; set; }
        }

        [DataContract]
        public sealed class Uso
        {
            [DataMember] public int input_tokens { get; set; }
            [DataMember] public int output_tokens { get; set; }
        }

        [DataContract]
        public sealed class ErroClaude
        {
            [DataMember] public DetalheErro error { get; set; }
        }

        [DataContract]
        public sealed class DetalheErro
        {
            [DataMember] public string type { get; set; }
            [DataMember] public string message { get; set; }
        }

        // ============================================================
        // JSON (bibliotecas nativas do .NET, sem dependências externas)
        // ============================================================

        private static class Json
        {
            private static readonly DataContractJsonSerializerSettings Configuracao =
                new DataContractJsonSerializerSettings
                {
                    UseSimpleDictionaryFormat = true
                };

            public static T Ler<T>(string json)
            {
                var serializador =
                    new DataContractJsonSerializer(typeof(T), Configuracao);

                using (var fluxo = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                {
                    return (T)serializador.ReadObject(fluxo);
                }
            }

            public static string Escrever<T>(T objeto)
            {
                var serializador =
                    new DataContractJsonSerializer(typeof(T), Configuracao);

                using (var fluxo = new MemoryStream())
                {
                    serializador.WriteObject(fluxo, objeto);
                    return Encoding.UTF8.GetString(fluxo.ToArray());
                }
            }

            // Converte um texto em literal JSON ("...").
            public static string Texto(string valor)
            {
                var sb = new StringBuilder("\"");

                foreach (var c in valor ?? string.Empty)
                {
                    switch (c)
                    {
                        case '"': sb.Append("\\\""); break;
                        case '\\': sb.Append("\\\\"); break;
                        case '\n': sb.Append("\\n"); break;
                        case '\r': sb.Append("\\r"); break;
                        case '\t': sb.Append("\\t"); break;
                        default:
                            if (c < ' ')
                            {
                                sb.Append("\\u").Append(((int)c).ToString("x4"));
                            }
                            else
                            {
                                sb.Append(c);
                            }
                            break;
                    }
                }

                return sb.Append('"').ToString();
            }
        }
    }
}
