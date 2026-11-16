using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Text;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_GerarDashboardIa — cria/ajusta dashboards com IA
    //
    // Chamada pela tela Indicadores › ✦ Criar com IA.
    //
    // PayloadJson (montado pelo portal):
    //   { "pedido": "o que o usuário quer",
    //     "catalogo": [ { id, nome, descricao, campos: [...] } ],   // SÓ as fontes que ele pode usar
    //     "painelAtual": "{...}",       // opcional: ajuste de um painel
    //     "erros": ["..."] }            // opcional: erros do validador para corrigir
    //
    // ResultadoJson:
    //   { "resumo": "...", "semDados": ["..."], "definicao": "{...}", "modelo": "...",
    //     "tokensEntrada": 0, "tokensSaida": 0 }
    //
    // SEGURANÇA:
    //   - nenhum dado de registro vai para a IA: só o pedido e a DESCRIÇÃO
    //     das fontes (nomes de campos);
    //   - o catálogo já vem filtrado pelas permissões do usuário; mesmo que
    //     não viesse, as fontes do portal só trazem as áreas que ele pode
    //     ver e o Dataverse aplica os perfis de segurança;
    //   - o portal valida a definição devolvida (mesmas regras do cadastro)
    //     antes de mostrar ou salvar;
    //   - instruções fixas (skill dashboard-dgt) embutidas na DLL:
    //     Recursos/InstrucoesDashboardIa.md.
    //
    // Executa quem pode CRIAR dashboards (privilégio da Custom API).
    // CHAVE e CONSUMO: IaComum (chave do portal; consumo "Dashboards ·
    // Criação com IA" na área principal do usuário).
    //
    // REGISTRO (Plugin Registration Tool): passo na mensagem
    //   dgt_GerarDashboardIa · Primary Entity none · PostOperation · Synchronous
    //   (sem Configuração segura; "Delete AsyncOperation" DESMARCADO).
    // ================================================================
    public sealed class GerarDashboardIaPlugin : IPlugin
    {
        private const string UrlClaude = "https://api.anthropic.com/v1/messages";
        private const string VersaoApi = "2023-06-01";
        private const string Recurso = "DGT.Treinamentos.Plugins.InstrucoesDashboardIa.md";

        private const int LimitePedido = 2000;
        private const int LimiteCatalogo = 60000;
        private const int LimitePainel = 80000;

        // O plugin síncrono tem até 2 minutos no total.
        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(105) };

        private static string _instrucoes;

        private readonly string _chaveDoPasso;
        private readonly string _modelo;
        private readonly int _maxTokens;

        public GerarDashboardIaPlugin(string unsecureConfig, string secureConfig)
        {
            _chaveDoPasso = secureConfig;
            _modelo = "claude-sonnet-5-5";
            _maxTokens = 7000;

            if (!string.IsNullOrWhiteSpace(unsecureConfig))
            {
                try
                {
                    var config = JObject.Parse(unsecureConfig);
                    var modelo = (string)config["modelo"];
                    if (!string.IsNullOrWhiteSpace(modelo))
                    {
                        _modelo = modelo.Trim();
                    }
                    var max = (int?)config["maxTokens"];
                    if (max.HasValue && max.Value >= 1000)
                    {
                        _maxTokens = max.Value;
                    }
                }
                catch (JsonException)
                {
                    // Configuração não segura inválida: usa os padrões.
                }
            }
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var servicoSistema = fabrica.CreateOrganizationService(null);

            var configIa = IaComum.LerConfiguracao(servicoSistema, tracing);
            var apiKey = IaComum.ObterChave(configIa, _chaveDoPasso);
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidPluginExecutionException("Chave da IA não configurada: salve-a em Administrar IA.");
            }

            // ---------------- Entrada ----------------

            var payloadJson = context.InputParameters.Contains("PayloadJson")
                ? context.InputParameters["PayloadJson"] as string
                : null;

            JObject payload;
            try
            {
                payload = JObject.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            var pedido = ((string)payload["pedido"] ?? string.Empty).Trim();
            if (pedido.Length == 0)
            {
                throw new InvalidPluginExecutionException("Descreva o dashboard que você quer.");
            }
            if (pedido.Length > LimitePedido)
            {
                throw new InvalidPluginExecutionException($"A descrição deve ter no máximo {LimitePedido} caracteres.");
            }

            var catalogo = payload["catalogo"] as JArray;
            if (catalogo == null || catalogo.Count == 0)
            {
                throw new InvalidPluginExecutionException("Você não tem acesso a nenhuma fonte de dados para dashboards.");
            }
            var catalogoTexto = catalogo.ToString(Formatting.None);
            if (catalogoTexto.Length > LimiteCatalogo)
            {
                throw new InvalidPluginExecutionException("Catálogo de fontes grande demais.");
            }

            var painelAtual = ((string)payload["painelAtual"] ?? string.Empty).Trim();
            if (painelAtual.Length > LimitePainel)
            {
                throw new InvalidPluginExecutionException("O painel atual é grande demais para ajuste com IA.");
            }

            var erros = (payload["erros"] as JArray ?? new JArray())
                .Select(e => IaComum.Cortar((string)e ?? string.Empty, 400))
                .Where(e => e.Length > 0)
                .Take(30)
                .ToList();

            // ---------------- Área do consumo e limite ----------------

            var area = IaComum.ResolverArea(servicoSistema, context.InitiatingUserId, null, tracing);
            IaComum.VerificarLimite(servicoSistema, configIa, area, tracing);

            // ---------------- Mensagem ----------------

            var mensagem = new StringBuilder();
            mensagem.Append("<catalogo>\n").Append(catalogoTexto).Append("\n</catalogo>\n\n");
            if (painelAtual.Length > 0)
            {
                mensagem.Append("<painel_atual>\n").Append(painelAtual).Append("\n</painel_atual>\n\n");
            }
            if (erros.Count > 0)
            {
                mensagem.Append("<erros_do_validador>\n").Append(string.Join("\n", erros)).Append("\n</erros_do_validador>\n\n");
            }
            mensagem.Append("<pedido>\n").Append(pedido).Append("\n</pedido>");

            var corpo = new JObject
            {
                ["model"] = _modelo,
                ["max_tokens"] = _maxTokens,
                ["system"] = Instrucoes(),
                ["messages"] = new JArray(new JObject { ["role"] = "user", ["content"] = mensagem.ToString() })
            };

            // ---------------- Chamada ao Claude ----------------

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            string texto;
            int entrada;
            int saida;
            string parada;

            using (var requisicao = new HttpRequestMessage(HttpMethod.Post, UrlClaude))
            {
                requisicao.Headers.Add("x-api-key", apiKey);
                requisicao.Headers.Add("anthropic-version", VersaoApi);
                requisicao.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");

                HttpResponseMessage resposta;
                string conteudo;
                try
                {
                    resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult();
                    conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    tracing.Trace("Falha de rede ao chamar o Claude: {0}", ex.Message);
                    throw new InvalidPluginExecutionException("Não foi possível falar com a IA agora (ou ela demorou demais). Tente de novo com um pedido mais curto.");
                }

                if (!resposta.IsSuccessStatusCode)
                {
                    var codigo = (int)resposta.StatusCode;
                    tracing.Trace("Claude respondeu {0}: {1}", codigo, IaComum.Cortar(conteudo, 500));
                    throw new InvalidPluginExecutionException(
                        codigo == 401 || codigo == 403
                            ? "A IA recusou a chave configurada (Administrar IA › Chave)."
                            : codigo == 429
                                ? "Limite de uso da IA atingido. Tente novamente em alguns minutos."
                                : $"A IA respondeu com erro ({codigo}).");
                }

                var resultado = JObject.Parse(conteudo);
                texto = string.Join("\n", (resultado["content"] as JArray ?? new JArray())
                    .OfType<JObject>()
                    .Where(b => (string)b["type"] == "text")
                    .Select(b => (string)b["text"])).Trim();
                entrada = (int?)resultado.SelectToken("usage.input_tokens") ?? 0;
                saida = (int?)resultado.SelectToken("usage.output_tokens") ?? 0;
                parada = (string)resultado["stop_reason"] ?? string.Empty;
            }

            IaComum.RegistrarConsumo(servicoSistema, configIa, context.InitiatingUserId, area,
                "Dashboards", "Criação com IA", _modelo, entrada, saida, tracing);

            if (parada == "max_tokens")
            {
                throw new InvalidPluginExecutionException("O painel pedido ficou grande demais para gerar de uma vez. Peça menos páginas ou divida em dois painéis.");
            }

            // ---------------- Resposta ----------------

            var envelope = ExtrairJson(texto);
            if (envelope == null || !(envelope["dashboard"] is JObject))
            {
                tracing.Trace("Resposta fora do formato: {0}", IaComum.Cortar(texto, 500));
                throw new InvalidPluginExecutionException("A IA devolveu um formato inesperado. Tente de novo, descrevendo o painel de outro jeito.");
            }

            context.OutputParameters["ResultadoJson"] = JsonConvert.SerializeObject(new
            {
                resumo = IaComum.Cortar((string)envelope["resumo"] ?? string.Empty, 1500),
                semDados = (envelope["semDados"] as JArray ?? new JArray()).Select(s => IaComum.Cortar((string)s ?? string.Empty, 300)).Take(10).ToArray(),
                definicao = ((JObject)envelope["dashboard"]).ToString(Formatting.None),
                modelo = _modelo,
                tokensEntrada = entrada,
                tokensSaida = saida
            });
        }

        // Instruções fixas (lidas uma vez da DLL).
        private static string Instrucoes()
        {
            if (_instrucoes != null)
            {
                return _instrucoes;
            }
            using (var fluxo = Assembly.GetExecutingAssembly().GetManifestResourceStream(Recurso))
            {
                if (fluxo == null)
                {
                    throw new InvalidPluginExecutionException("Instruções da IA de dashboards não encontradas na DLL (recompile o projeto de plugins).");
                }
                using (var leitor = new StreamReader(fluxo, Encoding.UTF8))
                {
                    _instrucoes = leitor.ReadToEnd();
                }
            }
            return _instrucoes;
        }

        // Aceita o JSON puro, ou dentro de ```json ... ```, ou com texto em volta.
        internal static JObject ExtrairJson(string texto)
        {
            if (string.IsNullOrWhiteSpace(texto))
            {
                return null;
            }
            var inicio = texto.IndexOf('{');
            var fim = texto.LastIndexOf('}');
            if (inicio < 0 || fim <= inicio)
            {
                return null;
            }
            try
            {
                return JObject.Parse(texto.Substring(inicio, fim - inicio + 1));
            }
            catch (JsonException)
            {
                return null;
            }
        }
    }
}
